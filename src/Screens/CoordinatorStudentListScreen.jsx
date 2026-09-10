import React, { useState, useRef, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import userIcon from "../icons/user.png";
import { color, font, type, space, radius, shadow, ease } from "./theme";

// ── Design tokens, aliased for this screen ────────────────────────────────────
// Same aliases as CoordinatorFindCompanyScreen so the two screens stay in sync.
const ink        = color.ink;
const inkBody    = color.inkBody;
const inkMuted   = color.inkMuted;
const inkFaint   = color.inkFaint;
const surface    = color.wine600;      // rows, cards
const page       = color.wine900;      // page background
const line       = color.wine700;      // hairlines & borders
const lineSoft   = color.wine800;
const panel      = color.blush100;     // dark header bar
const panelDeep  = color.blush50;
const onPanel    = color.onWine;
const onPanelDim = color.onWineMuted;

// Colors for the small status pill shown on each student row / placement modal
const STATUS_COLORS = {
  "Accepted":    { bg: color.success, color: color.white },
  "Declined":    { bg: color.danger,  color: color.white },
  "Pending":     { bg: color.wine400, color: ink },
  "In Review":   { bg: color.warning, color: color.white },
  "To Interview":{ bg: color.info,    color: color.white },
};

// When a student has more than one application, this decides which one
// "represents" them at a glance (list row badge) — most-advanced/most-
// relevant status wins, rather than whichever doc Firestore happened to
// return first. Declined only wins if every single application was
// declined (see matchesStatusFilter below).
const STATUS_PRIORITY = ["Accepted", "To Interview", "In Review", "Pending", "Declined"];

// Full name, assembled the same way everywhere it appears — the list row, the
// placement modal, and the CSV export. Kept in one place so a name can never
// read differently depending on where a coordinator happens to be looking.
const getFullName = (s) =>
  `${s.firstName} ${s.middleInitial ? s.middleInitial + " " : ""}${s.lastName}` +
  `${s.suffix && s.suffix !== "None" && s.suffix !== "N/A" ? " " + s.suffix : ""}`;

const getBestApplication = (apps) => {
  if (!apps || apps.length === 0) return null;
  for (const status of STATUS_PRIORITY) {
    const found = apps.find(a => a.status === status);
    if (found) return found;
  }
  return apps[0];
};

// Non-exclusive filter check — a student can match more than one filter
// at once (e.g. Accepted somewhere AND still has a Pending application
// elsewhere shows up under both "Accepted" and "In Progress").
const matchesStatusFilter = (apps, filterValue) => {
  if (!filterValue) return true; // "All"
  if (filterValue === "No Applications yet") return !apps || apps.length === 0;
  if (!apps || apps.length === 0) return false;
  if (filterValue === "Accepted") return apps.some(a => a.status === "Accepted");
  if (filterValue === "In Progress") return apps.some(a => ["Pending", "In Review", "To Interview"].includes(a.status));
  if (filterValue === "All Declined") return apps.every(a => a.status === "Declined");
  return true;
};

// ── CSV export ────────────────────────────────────────────────────────────────

// Wraps every field in quotes rather than only the ones that look risky.
// Company names and programs routinely contain commas ("Bank Inc., Tarlac
// Branch") and the occasional quote, and a half-escaped file corrupts silently
// — the columns just shift and nobody notices until the numbers are wrong.
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const EXPORT_HEADER = ["Student Name", "Student ID", "College", "Program", "Year & Section", "Placement", "Status"];

// One row per APPLICATION, not per student: a student who applied to three
// companies is genuinely three placement records, and collapsing them to the
// single "best" one (as the list row badge does) would silently drop the rest
// from the export. Students with no applications still get one row, so the
// export and the on-screen count always agree.
//
// Shared by both exports so the CSV and the PDF can never disagree about what
// the same filtered list contains.
const buildExportRows = (students, applicationsByStudent, companies) =>
  students.flatMap(student => {
    const base = [
      getFullName(student),
      student.studentId || "",
      student.college || "",
      student.program || "",
      student.yearSection || "",
    ];

    const apps = applicationsByStudent[student.id] || [];
    if (apps.length === 0) return [[...base, "—", "No applications yet"]];

    return apps.map(app => {
      const company = companies.find(c => c.id === app.companyId);
      return [...base, company?.name || "Unknown company", app.status || ""];
    });
  });

const buildStudentCsv = (rows) =>
  // Leading BOM so Excel reads this as UTF-8. Without it, Excel guesses the
  // legacy codepage and mangles the ñ in names like Muñoz and Santa Iñez.
  "\uFEFF" + [EXPORT_HEADER, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");

// Human-readable summary of what's currently narrowing the list, printed under
// the PDF title. Without it a printed export is unfalsifiable — a coordinator
// holding a 12-row page has no way to tell whether that's the whole cohort or
// the leftovers of four active filters.
const describeExportScope = (filters, search) => {
  const parts = [];
  if (search.trim())          parts.push(`Search: "${search.trim()}"`);
  if (filters.college)        parts.push(filters.college);
  if (filters.program)        parts.push(filters.program);
  if (filters.specialization) parts.push(filters.specialization);
  if (filters.sex)            parts.push(filters.sex);
  if (filters.section)        parts.push(`Section ${filters.section}`);
  if (filters.status)         parts.push(filters.status);
  return parts.length ? parts.join(" · ") : "No filters applied";
};

const downloadBlob = (filename, blob) => {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// jsPDF and its autoTable plugin are ~400KB together, and exporting is a rare,
// deliberate action — loading them eagerly would make every coordinator pay
// that cost on first paint just so the button exists. Imported on click
// instead, so the weight lands only on whoever actually exports.
const buildStudentPdf = async ({ rows, scope, total }) => {
  const { jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  // Landscape: seven columns, and program names like "BS Information
  // Technology" wrap into unreadable slivers at portrait width.
  const doc    = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width  = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Student Placements", margin, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(scope, margin, 62);
  doc.text(
    `${total} student${total === 1 ? "" : "s"} · ${rows.length} placement record${rows.length === 1 ? "" : "s"} · Generated ${new Date().toLocaleDateString()}`,
    margin, 75
  );
  doc.setTextColor(0);

  autoTable(doc, {
    head: [EXPORT_HEADER],
    body: rows,
    startY: 92,
    margin: { left: margin, right: margin, bottom: 46 },
    styles:     { font: "helvetica", fontSize: 8.5, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: [139, 0, 0], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 246, 246] },
    // Column widths are left to autoTable. Pinning them by hand looks tidier
    // in source but fights the layout engine: fixed widths are treated as
    // minimums, so long values like "BS Business Administration major in
    // Marketing Management" push the table past the page edge and autoTable
    // drops the overflow. Auto-sizing distributes by real content and fits.
    columnStyles: { 0: { minCellWidth: 110 }, 3: { minCellWidth: 120 }, 5: { minCellWidth: 110 } },
    // A multi-page placement list is easy to shuffle out of order once it is
    // printed, so every page carries its own number.
    didDrawPage: () => {
      const page   = doc.internal.getNumberOfPages();
      const height = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(`OJTern · Page ${page}`, width - margin, height - 24, { align: "right" });
      doc.setTextColor(0);
    },
  });

  return doc.output("blob");
};

// ── Responsive styles ─────────────────────────────────────────────────────────
// Page shape mirrors Find Company (padded scroll area → floating dark bar →
// chips), but the students themselves stay a full-width horizontal list.
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: ${color.wine400}; border-radius: 999px; }
    ::-webkit-scrollbar-track { background: transparent; }

    /* List wrapper: vertical scroll only */
    .sp-list-wrapper {
      overflow-x: hidden;
      overflow-y: auto;
      width: 100%;
      flex: 1;
      background: ${page};
      padding: clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px);
    }

    /* Floating dark header bar */
    .sp-search-bar {
      background: ${panel};
      border-radius: ${radius.panel};
      padding: 18px 22px;
      margin-bottom: ${space.md};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${space.md};
      flex-wrap: nowrap;
    }
    @media (max-width: 480px) {
      .sp-search-bar { padding: 14px; gap: 10px; }
    }

    .sp-search-input { width: 170px; }
    .sp-search-input::placeholder { color: ${inkFaint}; }
    @media (max-width: 480px) {
      .sp-search-input { width: 90px; }
    }
    @media (max-width: 380px) {
      .sp-search-input { width: 62px; }
    }

    /* Full-width student rows */
    .sp-rows {
      display: flex;
      flex-direction: column;
      gap: ${space.sm};
    }
    .sp-row {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.pill};
      box-shadow: ${shadow.input};
      padding: 10px 20px 10px 10px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      transition: border-color 200ms ${ease}, box-shadow 200ms ${ease};
    }
    .sp-row:hover {
      border-color: ${color.wine400};
      box-shadow: 0 8px 22px rgba(10,10,10,0.08);
    }
    /* Row meta line: wraps gracefully on narrow screens */
    .sp-row-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
      flex-wrap: wrap;
      row-gap: 2px;
    }
    /* The "View placement" link is redundant on small screens — the whole
       row is tappable, and the space is better spent on the name. */
    @media (max-width: 560px) {
      .sp-row { padding: 10px 14px 10px 10px; gap: 10px; }
      .sp-row-action { display: none; }
    }

    .sp-list-wrapper :focus-visible,
    .sp-modal-inner :focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: ${radius.pill};
    }
    .sp-modal-inner {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.panel};
      width: 420px;
      max-width: calc(100vw - 32px);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: ${shadow.panel};
    }

    @media (max-width: 560px) {
      .sp-modal-inner {
        max-width: calc(100vw - 72px);
        max-height: 46vh;
        border-radius: ${radius.card};
      }
    }

    .sp-modal-header {
      padding: 22px 26px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    @media (max-width: 480px) {
      .sp-modal-header { padding: 16px 16px 10px; }
    }

    .sp-modal-body {
      padding: 0 26px 26px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    @media (max-width: 480px) {
      .sp-modal-body { padding: 0 16px 18px; }
    }

    .sp-name-pill {
      display: flex;
      align-items: center;
      gap: 14px;
      background: ${lineSoft};
      border: 1px solid ${line};
      border-radius: ${radius.pill};
      padding: 10px 20px 10px 10px;
      margin-bottom: 20px;
    }
    @media (max-width: 400px) {
      .sp-name-pill { padding: 8px 14px 8px 8px; gap: 10px; }
    }

    /* Detail grid in modal: 2-col → 1-col */
    .sp-detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 400px) {
      .sp-detail-grid { grid-template-columns: 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      .sp-row { transition: none; }
    }
  `}</style>
);

// College > Programs structure — same as CoordinatorStudentsAcccountScreen
const COLLEGE_DATA = {
  "CCS": {
    label: "College of Computer Studies",
    programs: ["BSIT"],
  },
  "CBA": {
    label: "College of Business and Accountancy",
    programs: ["BSBA (Major in Marketing Management)", "BSA"],
  },
  "CCJE": {
    label: "College of Criminal Justice Education",
    programs: ["BS CRIM"],
  },
  "CLA": {
    label: "College of Liberal Arts",
    programs: ["BA POLSCI"],
  },
  "CED": {
    label: "College of Education",
    programs: ["BEED", "BSED (Major in English)", "BSED (Major in Mathematics)"],
  },
  "CHTM": {
    label: "College of Hospitality and Tourism Management",
    programs: ["BSTM", "BSHM"],
  },
};

// Year & Section options
const YEAR_SECTIONS = ["4-A","4-B","4-C","4-D","4-E","4-F"];

// Sex options
const SEX_OPTIONS = ["Male", "Female"];

// ── Shared chip style: one look for every selectable pill in this screen ──────
const chip = (on) => ({
  padding: "5px 12px",
  borderRadius: radius.pill,
  fontFamily: font.ui,
  ...type.helper,
  cursor: "pointer",
  userSelect: "none",
  background: on ? ink : color.wine800,
  color: on ? color.white : inkBody,
  border: `1px solid ${on ? ink : line}`,
  transition: `all 160ms ${ease}`,
});

const StudentAvatar = ({ size = 42 }) => (
  <img
    src={userIcon}
    alt=""
    style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
  />
);

const PlacementModal = ({ student, onClose, onNavigateToCompany, companies, onMessageStudent }) => {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    if (!student?.id) return;
    const q = query(collection(db, "applications"), where("studentId", "==", student.id));
    getDocs(q).then(snap => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [student?.id]);

  const fullName = getFullName(student);

  const handleVisitCompany = (companyId) => {
    if (!companyId) return;
    onClose();
    onNavigateToCompany(companyId, student.id);
  };

  const handleMessage = () => {
    onClose();
    onMessageStudent?.({ id: student.id, name: fullName });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: space.md }}>
      <div className="sp-modal-inner">
        <div className="sp-modal-header">
          <h2 style={{ fontFamily: font.ui, fontSize: "clamp(1.125rem, 4vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: ink }}>Placement</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: lineSoft, border: `1px solid ${line}`, borderRadius: "50%", width: "30px", height: "30px", color: inkMuted, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>

        <div className="sp-modal-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div className="sp-name-pill" style={{ flex: 1, minWidth: 0 }}>
              <StudentAvatar size={42} />
              <span style={{ fontFamily: font.ui, fontSize: "clamp(0.95rem, 4vw, 1.0625rem)", fontWeight: 600, letterSpacing: "-0.01em", color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</span>
            </div>
            <button
              onClick={handleMessage}
              title={`Message ${fullName}`}
              style={{
                display: "flex", alignItems: "center", gap: "7px", flexShrink: 0,
                background: panel, color: onPanel, border: "none", borderRadius: radius.pill,
                padding: "10px 18px", cursor: "pointer", marginBottom: "20px",
                fontFamily: font.ui, ...type.control,
                transition: `background 220ms ${ease}`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = panelDeep)}
              onMouseLeave={e => (e.currentTarget.style.background = panel)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Message
            </button>
          </div>

          {applications.length === 0 ? (
            <div style={{ padding: `${space.lg} ${space.md}`, textAlign: "center", background: color.wine800, border: `1px dashed ${color.wine400}`, borderRadius: radius.card }}>
              <p style={{ fontFamily: font.ui, ...type.body, color: inkBody }}>No applications yet</p>
              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: "2px" }}>Applications appear here once this student applies to a company.</p>
            </div>
          ) : (
            <div>
              <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: space.sm }}>Applications</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {applications.map(app => {
                  const appCompany = companies.find(c => c.id === app.companyId);
                  const sc = STATUS_COLORS[app.status] || { bg: color.wine400, color: ink };
                  return (
                    <div key={app.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", background: color.wine800, border: `1px solid ${line}`, borderRadius: radius.card, padding: "10px 14px" }}>
                      <span style={{ fontFamily: font.ui, ...type.helper, color: inkBody, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {appCompany?.name || "Unknown company"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                        <span style={{ background: sc.bg, color: sc.color, borderRadius: radius.pill, padding: "3px 11px", fontFamily: font.ui, fontSize: "0.75rem", fontWeight: 500 }}>
                          {app.status}
                        </span>
                        {appCompany && (
                          <span
                            onClick={() => handleVisitCompany(appCompany.id)}
                            style={{ fontFamily: font.ui, ...type.helper, fontWeight: 500, color: ink, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "underline", textUnderlineOffset: "3px" }}
                          >
                            View post
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: space.lg, padding: "14px 16px", background: color.wine800, borderRadius: radius.card, border: `1px solid ${line}` }}>
            <div className="sp-detail-grid">
              {[
                { label: "Student ID",     value: student.studentId },
                { label: "Sex",            value: student.sex },
                { label: "College",        value: student.college,        full: true },
                { label: "Program",        value: student.program,        full: true },
                { label: "Year & section", value: student.yearSection },
              ].map(({ label, value, full }) => (
                <div key={label} style={{ gridColumn: full ? "1 / -1" : "auto" }}>
                  <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginBottom: "2px" }}>{label}</p>
                  <p style={{ fontFamily: font.ui, ...type.label, color: ink }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FilterPanel = ({ filters, setFilters, filterRef, coordinatorColleges = [] }) => {
  const [expandedCollege, setExpandedCollege] = useState(filters.college || "");

  // Scoped to the coordinator's own assigned department(s) — never the
  // full school-wide college list.
  const allColleges        = coordinatorColleges.length > 0 ? coordinatorColleges : Object.keys(COLLEGE_DATA);
  const allPrograms        = expandedCollege ? (COLLEGE_DATA[expandedCollege]?.programs || []) : [];
  const allSpecializations = (expandedCollege && filters.program)
    ? (COLLEGE_DATA[expandedCollege]?.programs[filters.program]?.specializations || [])
    : [];

  // Derive section letters from YEAR_SECTIONS (e.g. "4-A" → "A")
  const sectionLetters = YEAR_SECTIONS.map(s => s.split("-")[1]).filter(Boolean);

  const clearAll = () => {
    setExpandedCollege("");
    setFilters(prev => ({ ...prev, college: "", program: "", specialization: "", sex: "", section: "" }));
  };

  const toggleSex     = (val) => setFilters(prev => ({ ...prev, sex:     prev.sex     === val ? "" : val }));
  const toggleSection = (val) => setFilters(prev => ({ ...prev, section: prev.section === val ? "" : val }));

  const toggleCollege = (col) => {
    if (expandedCollege === col) {
      setExpandedCollege("");
      setFilters(prev => ({ ...prev, college: "", program: "", specialization: "" }));
    } else {
      setExpandedCollege(col);
      setFilters(prev => ({ ...prev, college: col, program: "", specialization: "" }));
    }
  };
  const toggleProgram = (prog) => setFilters(prev => ({ ...prev, program: prev.program === prog ? "" : prog, specialization: "" }));
  const toggleSpec    = (spec) => setFilters(prev => ({ ...prev, specialization: prev.specialization === spec ? "" : spec }));

  const locationLevel = !expandedCollege ? "college" : !filters.program ? "program" : "specialization";

  const groupLabel = { fontFamily: font.ui, ...type.label, color: ink };
  const emptyNote  = { fontFamily: font.ui, ...type.helper, color: inkFaint };

  const backRow = (label, onClick) => (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: space.xs, cursor: "pointer", marginBottom: space.sm, color: inkMuted, fontFamily: font.ui, ...type.helper }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      {label}
    </div>
  );

  return (
    <div
      ref={filterRef}
      style={{
        position: "absolute", top: "48px", right: 0, width: "266px",
        background: surface, border: `1px solid ${line}`, borderRadius: radius.card,
        boxShadow: shadow.panel, zIndex: 100, overflow: "hidden",
        fontFamily: font.ui,
      }}
    >
      {/* Sex + Clear all */}
      <div style={{ padding: "12px 14px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm }}>
          <p style={groupLabel}>Sex</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {SEX_OPTIONS.length > 0 ? (
            SEX_OPTIONS.map(s => (
              <span key={s} onClick={() => toggleSex(s)} style={chip(filters.sex === s)}>{s}</span>
            ))
          ) : (
            <span style={emptyNote}>No options available</span>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: `1px solid ${lineSoft}`, margin: "10px 0" }} />

      {/* Section */}
      <div style={{ padding: "0 14px 12px" }}>
        <p style={{ ...groupLabel, marginBottom: space.sm }}>Section</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {sectionLetters.length > 0 ? (
            sectionLetters.map(s => (
              <span key={s} onClick={() => toggleSection(s)} style={chip(filters.section === s)}>{s}</span>
            ))
          ) : (
            <span style={emptyNote}>No sections available</span>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: `1px solid ${lineSoft}`, margin: 0 }} />

      {/* College → Program → Major */}
      <div style={{ padding: "12px 14px 14px" }}>
        <p style={{ ...groupLabel, marginBottom: space.sm }}>
          Department
          {expandedCollege && (
            <span style={{ fontWeight: 400, color: inkMuted, marginLeft: "6px", fontSize: "0.75rem" }}>
              {[expandedCollege, filters.program].filter(Boolean).join(" › ")}
            </span>
          )}
        </p>

        {locationLevel === "college" && (
          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
            {allColleges.length > 0 ? (
              allColleges.map(col => (
                <div key={col} onClick={() => toggleCollege(col)}
                  style={{ padding: "7px 11px", borderRadius: "10px", fontFamily: font.ui, ...type.helper, color: inkBody, cursor: "pointer", background: color.wine800, border: `1px solid ${line}`, transition: `background 160ms ${ease}` }}
                  onMouseEnter={e => e.currentTarget.style.background = color.wine700}
                  onMouseLeave={e => e.currentTarget.style.background = color.wine800}
                >{COLLEGE_DATA[col]?.label || col}</div>
              ))
            ) : (
              <span style={emptyNote}>No colleges available</span>
            )}
          </div>
        )}

        {locationLevel === "program" && (
          <div>
            {backRow(expandedCollege, () => toggleCollege(expandedCollege))}
            <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {allPrograms.map(prog => (
                <span key={prog} onClick={() => toggleProgram(prog)} style={chip(filters.program === prog)}>{prog}</span>
              ))}
            </div>
          </div>
        )}

        {locationLevel === "specialization" && (
          <div>
            {backRow(filters.program, () => setFilters(prev => ({ ...prev, program: "", specialization: "" })))}
            {allSpecializations.length > 0 ? (
              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {allSpecializations.map(spec => (
                  <span key={spec} onClick={() => toggleSpec(spec)} style={chip(filters.specialization === spec)}>{spec}</span>
                ))}
              </div>
            ) : (
              <p style={emptyNote}>No specializations for this program.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CoordinatorStudentListScreen = ({ coordinatorColleges, onNavigateToCompany, onMessageStudent, initialViewingStudentId, onClearInitialViewingStudent }) => {
  const [search, setSearch]                 = useState("");
  const [viewingStudent, setViewingStudent] = useState(null);
  const [showFilter, setShowFilter]         = useState(false);
  const [showExport, setShowExport]         = useState(false);
  const [exportingPdf, setExportingPdf]     = useState(false);
  const [filters, setFilters]               = useState({ college: "", program: "", specialization: "", sex: "", section: "", status: "" });

  const filterRef = useRef(null);
  const exportRef = useRef(null);
  const [students, setStudents]     = useState([]);
  const [companies, setCompanies]   = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [applicationsByStudent, setApplicationsByStudent] = useState({});

  // If we got here because the coordinator pressed "back" on a company
  // profile they reached via a student's Placement modal, reopen that
  // same student's modal instead of dropping them on a bare list.
  useEffect(() => {
    if (!initialViewingStudentId || loadingStudents || students.length === 0) return;
    const match = students.find(s => s.id === initialViewingStudentId);
    if (match) setViewingStudent(match);
    onClearInitialViewingStudent && onClearInitialViewingStudent();
  }, [initialViewingStudentId, loadingStudents, students]);

  // ── Load students — scoped to this coordinator's own department(s). ──────
  // NOTE: needs a Firestore composite index (college + createdAt) the first
  // time it runs; Firestore will log a console link to auto-create it.
  useEffect(() => {
    if (!coordinatorColleges || coordinatorColleges.length === 0) {
      setStudents([]); setLoadingStudents(false); return;
    }
    const q = query(
      collection(db, "students"),
      where("college", "in", coordinatorColleges),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(rows);
      setLoadingStudents(false);

      // 🔍 TEMP DEBUG — remove once the duplicate issue is confirmed/resolved.
      // Logs any studentId (the school ID number, e.g. "201147323") that
      // appears on more than one Firestore document. If Michael shows up
      // here with 2+ doc IDs, that confirms a duplicate student record.
      const byStudentId = {};
      rows.forEach(r => {
        if (!r.studentId) return;
        (byStudentId[r.studentId] ||= []).push(r.id);
      });
      Object.entries(byStudentId).forEach(([sid, docIds]) => {
        if (docIds.length > 1) {
          console.warn(`[DUPLICATE STUDENT] studentId ${sid} has ${docIds.length} Firestore docs:`, docIds);
        }
      });
    }, () => setLoadingStudents(false));
    return () => unsub();
  }, [coordinatorColleges]);

  // ── Load companies ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "companies"), snap => {
      setCompanies(snap.docs.map(d => ({ id: d.id, name: d.data().companyName || "", ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "applications"));
    const unsub = onSnapshot(q, snap => {
      const byStudent = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (!data.studentId) return;
        (byStudent[data.studentId] ||= []).push({ id: d.id, ...data });
      });
      setApplicationsByStudent(byStudent);
    });
    return () => unsub();
  }, []);


  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // The status bar has its own row of chips, so the funnel dot only reflects
  // the panel's own filters (sex, section, department).
  const panelFilterKeys = ["college", "program", "specialization", "sex", "section"];
  const hasFilter = panelFilterKeys.some(k => filters[k]);

  const filtered = students.filter(s => {
    const q        = search.toLowerCase();
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    const matchSearch  = fullName.includes(q) || s.studentId.includes(q) || s.program.toLowerCase().includes(q) || s.college.toLowerCase().includes(q);
    const matchSex     = !filters.sex     || s.sex === filters.sex;
    const matchSection = !filters.section || s.yearSection.endsWith(`-${filters.section}`);
    const matchCollege = !filters.college || s.college  === filters.college;
    const matchProgram = !filters.program || s.program  === filters.program;
    const matchSpec    = !filters.specialization || s.major === filters.specialization;

    // Status filter — non-exclusive, see matchesStatusFilter above.
    const matchStatus = matchesStatusFilter(applicationsByStudent[s.id], filters.status);

    return matchSearch && matchSex && matchSection && matchCollege && matchProgram && matchSpec && matchStatus;
  });

  const clearAllFilters = () => setFilters({ college: "", program: "", specialization: "", sex: "", section: "", status: "" });

  // Both exports use `filtered`, not `students` — what downloads is exactly
  // what the search box and filter chips are currently showing, so the file
  // always matches the "N of M" count in the header. Filter first, then export.
  const exportDate = () => new Date().toISOString().slice(0, 10);

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    setShowExport(false);
    const rows = buildExportRows(filtered, applicationsByStudent, companies);
    downloadBlob(
      `ojtern-students-${exportDate()}.csv`,
      new Blob([buildStudentCsv(rows)], { type: "text/csv;charset=utf-8;" })
    );
  };

  const handleExportPdf = async () => {
    if (filtered.length === 0 || exportingPdf) return;
    setShowExport(false);
    setExportingPdf(true);
    try {
      const rows = buildExportRows(filtered, applicationsByStudent, companies);
      const blob = await buildStudentPdf({
        rows,
        scope: describeExportScope(filters, search),
        total: filtered.length,
      });
      downloadBlob(`ojtern-students-${exportDate()}.pdf`, blob);
    } catch (err) {
      // The PDF libraries are fetched on click, so this also covers a failed
      // chunk load on a bad connection — silence here would look like a dead
      // button with no way to tell whether anything happened.
      console.error("PDF export failed:", err);
      alert("Couldn't generate the PDF. Please check your connection and try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  // ── One full-width row per student ────────────────────────────────────────
  const renderStudentRow = (student) => {
    const fullName = getFullName(student);
    // The row badge shows the single most-advanced application status,
    // so a coordinator can scan placement progress without opening anyone.
    const best = getBestApplication(applicationsByStudent[student.id]);
    const sc   = best ? (STATUS_COLORS[best.status] || { bg: color.wine400, color: ink }) : null;
    const meta = { fontFamily: font.ui, ...type.helper, color: inkMuted, whiteSpace: "nowrap", flexShrink: 0 };
    const dot  = <span style={{ color: color.wine400, flexShrink: 0 }}>·</span>;

    return (
      <div key={student.id} className="sp-row" onClick={() => setViewingStudent(student)}>
        <StudentAvatar size={42} />
        <div style={{ width: "1px", height: "30px", background: line, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: font.ui, ...type.label, color: ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName}</p>
          {/* Meta line — Student ID, College, Program, Year & Section, Sex */}
          <div className="sp-row-meta">
            <span style={meta}>{student.studentId}</span>
            {student.college && <>{dot}<span style={meta}>{student.college}</span></>}
            {student.program && <>{dot}<span style={{ ...meta, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, maxWidth: "220px" }}>{student.program}</span></>}
            {dot}<span style={meta}>{student.yearSection}</span>
            {dot}<span style={meta}>{student.sex}</span>
          </div>
        </div>
        {sc ? (
          <span style={{ background: sc.bg, color: sc.color, borderRadius: radius.pill, padding: "3px 11px", fontFamily: font.ui, fontSize: "0.75rem", fontWeight: 500, flexShrink: 0 }}>
            {best.status}
          </span>
        ) : (
          <span style={{ background: surface, border: `1px solid ${line}`, color: inkMuted, borderRadius: radius.pill, padding: "3px 11px", fontFamily: font.ui, fontSize: "0.75rem", flexShrink: 0 }}>
            Not applied
          </span>
        )}
        <span
          className="sp-row-action"
          onClick={(e) => { e.stopPropagation(); setViewingStudent(student); }}
          style={{ fontFamily: font.ui, ...type.helper, fontWeight: 500, color: ink, cursor: "pointer", flexShrink: 0 }}
        >
          View placement
        </span>
      </div>
    );
  };

  return (
    <>
      <ResponsiveStyles />
      <div className="sp-list-wrapper">

        {/* Header bar — same floating dark panel as Find Company */}
        <div className="sp-search-bar">
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <span title="Students List" style={{ fontFamily: font.ui, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Students List</span>
            {!loadingStudents && (
              <p title={`${filtered.length} of ${students.length} in your departments`} style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {filtered.length} of {students.length} in your departments
              </p>
            )}
          </div>

          <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: space.sm, background: color.white, borderRadius: radius.pill, padding: "9px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search"
                className="sp-search-input"
                style={{ border: "none", background: "transparent", outline: "none", color: ink, fontFamily: font.ui, ...type.control }}
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search" style={{ background: "none", border: "none", color: inkMuted, cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>
              )}
            </div>

            <div ref={exportRef} style={{ position: "relative", marginLeft: "10px" }}>
              <button
                onClick={() => setShowExport(v => !v)}
                disabled={filtered.length === 0 || exportingPdf}
                title="Export the students shown below"
                aria-label="Export students"
                aria-expanded={showExport}
                style={{
                  width: "40px", height: "40px",
                  background: showExport ? color.goldTint : color.white,
                  border: showExport ? `1px solid ${color.onWineFaint}` : "none",
                  borderRadius: radius.pill,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: filtered.length === 0 || exportingPdf ? "not-allowed" : "pointer",
                  opacity: filtered.length === 0 || exportingPdf ? 0.45 : 1,
                  flexShrink: 0, padding: 0,
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={showExport ? onPanel : inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>

              {showExport && (
                <div style={{
                  position: "absolute", top: "48px", right: 0, zIndex: 40,
                  background: color.white, border: `1px solid ${color.wine400}`,
                  borderRadius: radius.card, boxShadow: shadow.panel,
                  padding: "6px", minWidth: "196px",
                }}>
                  <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, padding: "6px 10px 8px" }}>
                    {filtered.length} of {students.length} students
                  </p>
                  {[
                    { label: "Export as CSV", hint: "Opens in Excel or Sheets", onClick: handleExportCsv },
                    { label: "Export as PDF", hint: "Formatted for printing",   onClick: handleExportPdf },
                  ].map(({ label, hint, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        background: "none", border: "none", cursor: "pointer",
                        padding: "8px 10px", borderRadius: radius.pill,
                      }}
                    >
                      <span style={{ display: "block", fontFamily: font.ui, ...type.control, color: ink }}>{label}</span>
                      <span style={{ display: "block", fontFamily: font.ui, ...type.helper, color: inkMuted }}>{hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: "relative", marginLeft: "10px" }}>
              <div
                onClick={() => setShowFilter(v => !v)}
                title="Filters"
                style={{ width: "40px", height: "40px", background: hasFilter ? color.goldTint : color.white, borderRadius: radius.pill, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `1px solid ${color.onWineFaint}` : "none" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? onPanel : inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
              </div>
              {showFilter && <FilterPanel filters={filters} setFilters={setFilters} filterRef={filterRef} coordinatorColleges={coordinatorColleges} />}
            </div>
          </div>
        </div>

        {/* Status chips */}
        <div style={{ display: "flex", gap: space.sm, alignItems: "center", flexWrap: "wrap", marginBottom: space.md }}>
          {["All", "Accepted", "In Progress", "All Declined", "No Applications yet"].map((statusOption) => {
            const isActive = statusOption === "All" ? filters.status === "" : filters.status === statusOption;
            // Each option keeps the colour of the status it represents, so the
            // chips and the row badges read as the same language.
            const statusColor =
              statusOption === "Accepted"            ? "#358D5E" :
              statusOption === "In Progress"         ? "#CCC929" :
              statusOption === "All Declined"        ? "#FF0000" :
              statusOption === "No Applications yet" ? "#A9A9A9" : "#000000";
            const activeText = color.white;

            return (
              <button
                key={statusOption}
                onClick={() => setFilters(p => ({ ...p, status: statusOption === "All" ? "" : statusOption }))}
                style={{
                  background: isActive ? statusColor : surface,
                  color: isActive ? activeText : inkBody,
                  border: isActive ? "none" : `1px solid ${line}`,
                  borderRadius: radius.pill,
                  padding: "7px 16px",
                  fontFamily: font.ui,
                  ...type.helper,
                  fontWeight: isActive ? 500 : 400,
                  cursor: "pointer",
                  transition: `all 180ms ${ease}`,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = color.wine400; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = line; }}
              >
                {statusOption}
              </button>
            );
          })}
        </div>

        {/* Student list */}
        {loadingStudents ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "72px 0" }}>
            <p style={{ fontFamily: font.ui, ...type.body, color: inkFaint }}>Loading students…</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="sp-rows">
            {filtered.map(renderStudentRow)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "72px 24px", gap: space.xs, background: surface, border: `1px dashed ${color.wine400}`, borderRadius: radius.panel }}>
            {students.length === 0 ? (
              <>
                <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink }}>No students in your departments yet</p>
                <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "44ch" }}>Students appear here once their accounts are created under the departments assigned to you.</p>
              </>
            ) : (
              <>
                <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink }}>No students match this search</p>
                <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "44ch" }}>Try a different name or ID, or clear a filter to widen the results.</p>
                <button onClick={clearAllFilters} style={{ marginTop: space.sm, background: panel, color: onPanel, border: "none", borderRadius: radius.pill, padding: "9px 20px", fontFamily: font.ui, ...type.control, cursor: "pointer" }}>
                  Clear filters
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {viewingStudent && (
        <PlacementModal
          student={viewingStudent}
          companies={companies}
          onClose={() => setViewingStudent(null)}
          onNavigateToCompany={(companyId, studentId) => {
            setViewingStudent(null);
            onNavigateToCompany && onNavigateToCompany(companyId, studentId);
          }}
          onMessageStudent={onMessageStudent}
        />
      )}
    </>
  );
};

export default CoordinatorStudentListScreen;