import React, { useState, useEffect, useRef } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import userIcon from "../icons/user.png";
import { color, font, type, space, radius, shadow, ease } from "./theme";

const accent = color.blush100;      // var(--ojt-ink-deep) — tracks the nav-bar theme picker
const accentDeep = color.blush50;   // var(--ojt-ink)
const border = "#E5E5E5";

// Canonical college order — keeps the grouping consistent with the rest of
// the app instead of falling back to alphabetical sorting.
const COLLEGE_ORDER = [
  "College of Computer Studies",
  "College of Business and Accountancy",
  "College of Criminal Justice Education",
  "College of Liberal Arts",
  "College of Education",
  "College of Hospitality and Tourism Management",
];

// ── College → Program data (kept consistent with CompanyApplicantsScreen) ──
const COLLEGE_DATA = {
  "College of Computer Studies": {
    programs: {
      "Bachelor of Science in Information Technology": { specializations: [] },
    },
  },
  "College of Business and Accountancy": {
    programs: {
      "BS Business Administration — Major in Marketing Management": { specializations: [] },
      "Bachelor of Science in Accountancy": { specializations: [] },
    },
  },
  "College of Criminal Justice Education": {
    programs: {
      "Bachelor of Science in Criminology": { specializations: [] },
    },
  },
  "College of Liberal Arts": {
    programs: {
      "Bachelor of Arts in Political Science": { specializations: [] },
    },
  },
  "College of Education": {
    programs: {
      "Bachelor of Elementary Education": { specializations: [] },
      "BS Education — Major in English": { specializations: [] },
      "BS Education — Major in Mathematics": { specializations: [] },
    },
  },
  "College of Hospitality and Tourism Management": {
    programs: {
      "Bachelor of Science in Tourism Management": { specializations: [] },
      "Bachelor of Science in Hospitality Management": { specializations: [] },
    },
  },
};

// ── Filter-label → stored-value mapping ─────────────────────────────────────
// The filter UI above shows full program names, but coordinators' Firestore
// docs (deptSelections[].program, see DEPARTMENT_PROGRAM_DATA in
// CoordinatorAccountProfileScreen.jsx) actually store short codes instead
// (e.g. "BSED (Major in English)"). Without this mapping, matchesProgram
// below compares two different vocabularies and never matches anything —
// selecting a program filter always returned zero results.
const PROGRAM_CODE_MAP = {
  "Bachelor of Science in Information Technology": "BSIT",
  "BS Business Administration — Major in Marketing Management": "BSBA (Major in Marketing Management)",
  "Bachelor of Science in Accountancy": "BSA",
  "Bachelor of Science in Criminology": "BS Crim",
  "Bachelor of Arts in Political Science": "BA Pol Sci",
  "Bachelor of Elementary Education": "BEED (Generalist)",
  "BS Education — Major in English": "BSED (Major in English)",
  "BS Education — Major in Mathematics": "BSED (Major in Mathematics)",
  "Bachelor of Science in Tourism Management": "BSTM",
  "Bachelor of Science in Hospitality Management": "BSHM",
};

// ── useIsMobile ───────────────────────────────────────────────────────────────
const useIsMobile = (breakpoint = 640) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

// ── CoordinatorAvatar ─────────────────────────────────────────────────────────
const CoordinatorAvatar = ({ size = 44, icon = userIcon }) => (
  <img
    src={icon}
    alt="coordinator"
    style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
  />
);

// ── FilterPanel ───────────────────────────────────────────────────────────────
const FilterPanel = ({ filterRef, filterCollege, filterProgram, setFilterCollege, setFilterProgram, allowedColleges }) => {
  // Only the student's own college is offered; the other colleges are never listed.
  const allowedLower = (allowedColleges || []).map(c => String(c).trim().toLowerCase());
  const colleges = Object.keys(COLLEGE_DATA).filter(c => !allowedLower.length || allowedLower.includes(c.toLowerCase()));
  const programs = filterCollege
    ? Object.keys(COLLEGE_DATA[filterCollege]?.programs || {})
    : [];

  const clearAll = () => {
    setFilterCollege("");
    setFilterProgram("");
  };

  return (
    <div
      ref={filterRef}
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        right: 0,
        width: "min(330px, calc(100vw - 32px))",
        background: color.white,
        border: `1px solid ${border}`,
        borderRadius: radius.card,
        boxShadow: shadow.panel,
        zIndex: 100,
        overflow: "hidden",
        fontFamily: font.ui,
      }}
    >
      <div style={{ padding: space.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm }}>
          <div>
            <p style={{ ...type.label, color: color.ink, margin: 0 }}>Filter coordinators</p>
            <p style={{ ...type.helper, color: color.inkMuted, margin: "3px 0 0" }}>Narrow the directory by college and program.</p>
          </div>
          {(filterCollege || filterProgram) && (
            <button
              onClick={clearAll}
              style={{
                background: "none", border: "none", color: accent, cursor: "pointer",
                fontFamily: font.ui, fontSize: "0.78rem", fontWeight: 600, padding: "4px 0",
              }}
            >
              Clear
            </button>
          )}
        </div>

        <p style={{ ...type.helper, color: color.inkMuted, margin: "16px 0 7px", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
          College
        </p>
        <div style={{ maxHeight: "190px", overflowY: "auto", overflowX: "hidden", display: "grid", gap: "5px" }}>
          {colleges.map((col) => {
            const selected = filterCollege === col;
            return (
              <button
                key={col}
                onClick={() => { setFilterCollege(selected ? "" : col); setFilterProgram(""); }}
                style={{
                  width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: "10px",
                  border: `1px solid ${selected ? color.hoverBorder : border}`,
                  background: selected ? color.hoverWash : color.wine900,
                  color: selected ? accentDeep : color.inkBody,
                  cursor: "pointer", fontFamily: font.ui, fontSize: "0.8rem",
                  fontWeight: selected ? 600 : 500, transition: `all 160ms ${ease}`,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "7px", height: "7px", borderRadius: "50%",
                    background: selected ? accent : "#D0D0D0", flexShrink: 0,
                  }} />
                  {col}
                </span>
              </button>
            );
          })}
        </div>

        {filterCollege && (
          <>
            <p style={{ ...type.helper, color: color.inkMuted, margin: "16px 0 7px", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
              Program
            </p>
            <div style={{ maxHeight: "145px", overflowY: "auto", overflowX: "hidden", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {programs.map((prog) => {
                const selected = filterProgram === prog;
                return (
                  <button
                    key={prog}
                    onClick={() => setFilterProgram(selected ? "" : prog)}
                    style={{
                      padding: "7px 10px", borderRadius: radius.pill,
                      border: `1px solid ${selected ? accent : border}`,
                      background: selected ? accent : color.wine900,
                      color: selected ? color.white : color.inkBody,
                      cursor: "pointer", fontFamily: font.ui, fontSize: "0.76rem",
                      fontWeight: selected ? 600 : 500, transition: `all 160ms ${ease}`,
                      maxWidth: "100%", whiteSpace: "normal", wordBreak: "break-word", textAlign: "left",
                    }}
                  >
                    {prog}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};


// Pulls department names out of a company doc, whichever shape it uses.
// Entries may be plain strings or objects ({ department } / { college }).
const departmentNamesOf = (data) => {
  // A student belongs to one college (students/{uid}.college), and that label
  // is the same one coordinators store in deptSelections[].department, so the
  // two compare directly.
  const college = String(data?.college || "").trim();
  return college ? [college] : [];
};

// ── Current vs previous coordinator ───────────────────────────────────────────
// A coordinator handles a Department, optionally narrowed to a Program (and a
// major/specialization). The student's CURRENT coordinator is the one whose
// assignment covers the student's program and major now; when a coordinator
// changes the student's program or major, the former one is kept as
// "Previous coordinator" (students/{uid}.previousCoordinatorScopes, written by
// updateStudentAccount) so the student can still contact them.
const scopeNorm = (v) => String(v || "").replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
const selectionCovers = (sel, scope) => {
  if (!sel || !scope) return false;
  if (scopeNorm(sel.department) !== scopeNorm(scope.department)) return false;
  if (scopeNorm(sel.program) && scopeNorm(sel.program) !== scopeNorm(scope.program)) return false;
  const selMajor = sel.specialization || sel.major || "";
  if (scopeNorm(selMajor) && scopeNorm(selMajor) !== scopeNorm(scope.specialization)) return false;
  return true;
};
const coordinatorRelation = (coord, studentScope) => {
  if (!studentScope) return null;
  const sels = Array.isArray(coord.department) ? coord.department : [];
  if (sels.some(sel => selectionCovers(sel, studentScope.current))) return "current";
  if ((studentScope.previous || []).some(prev => sels.some(sel => selectionCovers(sel, prev)))) return "previous";
  return null;
};
const RELATION_LABEL = { current: "Your coordinator", previous: "Previous coordinator" };
const RelationBadge = ({ relation }) => relation ? (
  <span style={{
    display: "inline-block", marginLeft: "6px", padding: "1px 8px", borderRadius: "10px", verticalAlign: "middle",
    fontFamily: font.ui, fontSize: "0.66rem", fontWeight: 700, whiteSpace: "nowrap",
    color: relation === "current" ? "#ffffff" : "#555555",
    background: relation === "current" ? "#111111" : "#EDEDED",
    border: relation === "current" ? "1px solid #111111" : "1px solid #D6D6D6",
  }}>
    {RELATION_LABEL[relation]}
  </span>
) : null;

// ── CoordinatorDetailsModal ───────────────────────────────────────────────────
// Opens when a coordinator card is clicked. The card itself only shows the name
// and program; contact details (email) and the Message action live here.
const CoordinatorDetailsModal = ({ coordinator, onClose, onMessage, canMessage, userIcon: themedUserIcon = userIcon }) => {
  const closeRef = useRef(null);
  // Same 560px breakpoint as the Recent Application modal (StudentApplicationScreen).
  const isNarrow = useIsMobile(561);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const departments = coordinator.colleges || [];
  const programs = coordinator.programs || [];
  const rowLabel = { ...type.helper, color: color.inkMuted, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 };
  const rowValue = { fontFamily: font.ui, fontSize: "0.9rem", color: color.ink, margin: "4px 0 0", lineHeight: 1.5, overflowWrap: "anywhere" };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coordinator-details-title"
        style={{
          width: "100%", maxWidth: isNarrow ? "calc(100vw - 72px)" : "420px", maxHeight: "calc(100vh - 32px)", overflowY: "auto",
          background: color.white, borderRadius: radius.card, boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
          fontFamily: font.ui,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "18px 18px 14px", borderBottom: `1px solid ${border}` }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "14px", background: color.wine800,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden",
          }}>
            <CoordinatorAvatar size={48} icon={themedUserIcon} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="coordinator-details-title" style={{ ...type.label, fontSize: "1.05rem", color: color.ink, fontWeight: 650, margin: 0, overflowWrap: "anywhere" }}>
              {coordinator.name}
            </h3>
            <p style={{ ...type.helper, color: color.inkMuted, margin: "3px 0 0" }}>{RELATION_LABEL[coordinator.relation] || "Coordinator"}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            style={{
              width: "34px", height: "34px", borderRadius: "50%", border: `1px solid ${border}`,
              background: color.white, cursor: "pointer", fontSize: "1.05rem", color: color.inkBody, flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "16px 18px", display: "grid", gap: "14px" }}>
          <div id="scoord-details-dept">
            <p style={rowLabel}>Department</p>
            <p style={rowValue}>{departments.length > 0 ? departments.join(", ") : "Unassigned"}</p>
          </div>
          <div>
            <p style={rowLabel}>Program</p>
            <p style={rowValue}>{programs.length > 0 ? programs.join(", ") : "—"}</p>
          </div>
          <div id="scoord-details-email">
            <p style={rowLabel}>Email address</p>
            {coordinator.email ? (
              <a href={`mailto:${coordinator.email}`} style={{ ...rowValue, display: "block", color: color.ink, textDecoration: "underline" }}>
                {coordinator.email}
              </a>
            ) : (
              <p style={{ ...rowValue, color: color.inkMuted }}>Not provided yet</p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "0 18px 18px" }}>
          <button
            onClick={onClose}
            style={{
              background: color.white, color: color.ink, border: `1px solid ${border}`,
              borderRadius: radius.pill, padding: "9px 16px", cursor: "pointer",
              fontFamily: font.ui, fontWeight: 600, fontSize: "0.8rem",
            }}
          >
            Close
          </button>
          {canMessage && (
            <button
              id="scoord-details-message"
              onClick={() => onMessage(coordinator)}
              style={{
                background: accent, color: color.white, border: `1px solid ${accent}`,
                borderRadius: radius.pill, padding: "9px 18px", cursor: "pointer",
                fontFamily: font.ui, fontWeight: 600, fontSize: "0.8rem", transition: `background 160ms ${ease}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.color = accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = accent; e.currentTarget.style.color = "#FFFFFF"; }}
            >
              Message
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main CompanyCoordinatorsScreen ────────────────────────────────────────────
// ── Pagination: 10 rows per page ──────────────────────────────────────────────
const PAGE_SIZE = 10;
// Next/previous page: the list goes back to its start.
const scrollListToTop = (scroller) => { if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" }); };
// « ‹ 1 2 3 … 9 › » — same look as the Admin screens: current-page badge + page buttons in one rounded bar.
const PaginationBar = ({ page: current, totalPages, onPage, from, to, total }) => {
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const items = totalPages <= 7 ? range(1, totalPages)
    : current <= 4 ? [...range(1, 5), "gap-end", totalPages]
    : current >= totalPages - 3 ? [1, "gap-start", ...range(totalPages - 4, totalPages)]
    : [1, "gap-start", current - 1, current, current + 1, "gap-end", totalPages];
  const btn = (on, disabled) => ({
    minWidth: "36px", height: "36px", padding: "0 10px", borderRadius: "10px",
    border: `1.5px solid ${on ? color.blush50 : color.wine700}`, background: on ? color.blush50 : color.white, color: on ? color.white : color.ink,
    fontFamily: font.ui, fontSize: "0.82rem", fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
  });
  return (
    <div style={{ display: "flex", flexWrap: "wrap-reverse", alignItems: "center", justifyContent: total != null ? "space-between" : "center", gap: "12px", padding: "20px 0 4px" }}>
      {total != null && <span style={{ fontFamily: font.ui, fontSize: "0.8rem", color: color.inkMuted }}>Showing {from}–{to} of {total}</span>}
      <nav aria-label="Pagination" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "stretch", maxWidth: "100%", background: color.white, border: `1px solid ${color.wine700}`, borderRadius: "16px", boxShadow: "0 4px 16px rgba(20,20,20,0.06)", overflow: "hidden" }}>
        <div title="Current page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "52px", padding: "0 14px", background: color.wine800, borderRight: `1px solid ${color.wine700}`, fontFamily: font.ui, fontSize: "0.9rem", fontWeight: 700, color: color.ink }}>
          {String(current).padStart(2, "0")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 12px", flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" aria-label="First page" title="First page" style={btn(false, current === 1)} disabled={current === 1} onClick={() => onPage(1)}>«</button>
          <button type="button" aria-label="Previous page" title="Previous page" style={btn(false, current === 1)} disabled={current === 1} onClick={() => onPage(current - 1)}>‹</button>
          {items.map((it) => (typeof it === "number"
            ? <button key={it} type="button" style={btn(it === current, false)} aria-current={it === current ? "page" : undefined} onClick={() => onPage(it)}>{it}</button>
            : <span key={it} style={{ color: color.inkMuted, padding: "0 4px" }}>…</span>))}
          <button type="button" aria-label="Next page" title="Next page" style={btn(false, current === totalPages)} disabled={current === totalPages} onClick={() => onPage(current + 1)}>›</button>
          <button type="button" aria-label="Last page" title="Last page" style={btn(false, current === totalPages)} disabled={current === totalPages} onClick={() => onPage(totalPages)}>»</button>
        </div>
      </nav>
    </div>
  );
};

const StudentCoordinatorsScreen = ({ embedded, user, onNavigateToMessages, onViewChange, userIcon: themedUserIcon = userIcon }) => {
  const isMobile = useIsMobile();
  // Coordinator icon size — same as the chat-list icon in CompanyMessagesScreen.
  const avatarSize = isMobile ? 46 : 48;
  const [search, setSearch] = useState("");
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);

  // Departments this company picked at Sign-Up Step 1 (companies/{uid}.departments,
  // with deptSelections[].department as the fallback shape). null = still loading,
  // [] = the company picked none, so nothing can be matched against.
  const [companyDepartments, setCompanyDepartments] = useState(null);
  // { current: {department, program, specialization}, previous: [...] }
  const [studentScope, setStudentScope] = useState(null);

  const [showFilter, setShowFilter] = useState(false);
  // Coordinator whose details window is open (null = closed).
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [filterCollege, setFilterCollege] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const filterRef = useRef(null);
  const [curPage, setCurPage] = useState(1);
  // Next/previous page: the list goes back to its start.
  const scrollRef = useRef(null);
  const goToPage = (n) => { setCurPage(n); requestAnimationFrame(() => scrollListToTop(scrollRef.current)); };

  // List vs. open details window → Dashboard's "?" help button / auto-tour.
  const subView = selectedCoordinator ? "details" : "list";
  useEffect(() => { onViewChange?.(subView); }, [subView]);
  useEffect(() => () => onViewChange?.("list"), []);

  // Close the filter panel on outside click.
  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Read the student's own college live, so a coordinator correcting it
  // updates this list without a reload.
  //
  // Company docs carry their Department/Program picks under more than one
  // shape depending on when and how they registered — `departments` (plain
  // names), `deptSelections` ([{ department, program }], written by
  // registerCompany) and `collegePrograms` ([{ college, program }], the shape
  // CoordinatorCompanyListScreen reads). All three are collected, so a company
  // is never matched against an empty list just because of which one it uses.
  useEffect(() => {
    if (!user?.uid) {
      console.warn("[Coordinators] No student uid on `user` — cannot scope the list by college.");
      setCompanyDepartments([]);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "students", user.uid),
      (snap) => {
        const data = snap.exists() ? (snap.data() || {}) : {};
        setCompanyDepartments(departmentNamesOf(data));
        setStudentScope({
          current: { department: data.college || "", program: data.program || "", specialization: data.specialization || "" },
          previous: Array.isArray(data.previousCoordinatorScopes) ? data.previousCoordinatorScopes : [],
        });
      },
      (err) => {
        // Don't strand the company with an empty screen on a read failure —
        // fall back to whatever their session profile already carries.
        console.error("Failed to load the student college:", err);
        setCompanyDepartments(departmentNamesOf(user));
      }
    );
    return () => unsub();
  }, [user?.uid]);

  // Coordinators of the departments this company selected at sign-up.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "coordinators"),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() || {};
          const colleges = Array.isArray(data.deptSelections)
            ? [...new Set(data.deptSelections.map(sel => sel?.department).filter(Boolean))]
            : [];
          const programs = Array.isArray(data.deptSelections)
            ? [...new Set(data.deptSelections.map(sel => sel?.program).filter(Boolean))]
            : [];
          return {
            id: d.id,
            name: data.name || "Coordinator",
            // The address the coordinator gave during first-login setup and can
            // update from their Account Profile (requestUserEmailChange keeps
            // this field and their Auth login email in step).
            email: String(data.email || "").trim(),
            department: Array.isArray(data.deptSelections) ? data.deptSelections : [],
            colleges,
            programs,
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCoordinators(list);
        setLoading(false);
      },
      (err) => { console.error("Failed to load coordinators:", err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  // Safety net: if the selected college changes (or is cleared) and no
  // longer offers the currently selected program, clear the program filter.
  useEffect(() => {
    if (filterCollege && filterProgram && COLLEGE_DATA[filterCollege] && !(filterProgram in COLLEGE_DATA[filterCollege].programs)) {
      setFilterProgram("");
    }
  }, [filterCollege]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilterCount = (filterCollege ? 1 : 0) + (filterProgram ? 1 : 0);
  // Loading = coordinators still loading, or the student profile hasn't arrived yet (e.g. right after a refresh).
  const listLoading = loading || companyDepartments === null || !user?.uid;

  // Only coordinators who handle at least one of the company's departments.
  // While the departments are still loading, show nothing rather than briefly
  // flashing the full directory.
  const companyDeptsLower = (companyDepartments || []).map(d => String(d).trim().toLowerCase());
  const RELATION_ORDER = { current: 0, previous: 1 };
  const scoped = companyDepartments === null
    ? []
    : coordinators
        .filter(c => (c.colleges || []).some(col => companyDeptsLower.includes(String(col).trim().toLowerCase())))
        // A coordinator may handle several colleges, but this student only belongs to
        // one. Keep just the student's own college(s) (and that college's programs) so
        // the coordinator is not also listed under the colleges the student isn't in.
        .map(c => {
          const inStudentCollege = (name) => companyDeptsLower.includes(String(name).trim().toLowerCase());
          const sels = Array.isArray(c.department) ? c.department.filter(sel => inStudentCollege(sel?.department)) : [];
          const selPrograms = [...new Set(sels.map(sel => sel?.program).filter(Boolean))];
          return {
            ...c,
            colleges: (c.colleges || []).filter(inStudentCollege),
            programs: selPrograms.length ? selPrograms : (c.programs || []),
          };
        })
        .map(c => ({ ...c, relation: coordinatorRelation(c, studentScope) }))
        // Your coordinator first, then the previous one, then the rest.
        .sort((a, b) => (RELATION_ORDER[a.relation] ?? 2) - (RELATION_ORDER[b.relation] ?? 2) || a.name.localeCompare(b.name));

  // One line in the console makes a naming mismatch obvious: if the company's
  // departments and the coordinators' departments are spelled differently,
  // nothing matches and this says so in the data's own words.
  useEffect(() => {
    if (companyDepartments === null || coordinators.length === 0) return;
    console.debug(
      "[Coordinators] student college:", companyDepartments,
      "| coordinator departments:", [...new Set(coordinators.flatMap(c => c.colleges || []))],
      "| matched:", scoped.length, "of", coordinators.length
    );
  }, [companyDepartments, coordinators, scoped.length]);

  const filtered = scoped.filter((c) => {
    const term = search.toLowerCase();
    const matchesName = c.name.toLowerCase().includes(term) || (c.email || "").toLowerCase().includes(term);
    const matchesCollege = !filterCollege || (c.colleges || []).includes(filterCollege);
    const filterProgramCode = PROGRAM_CODE_MAP[filterProgram] || filterProgram;
    const matchesProgram = !filterProgram || (c.programs || []).includes(filterProgramCode);
    return matchesName && matchesCollege && matchesProgram;
  });

  // Group by college — a coordinator with multiple assigned colleges appears
  // under each one. Coordinators with no college assignment go under "Unassigned".
  const groups = {};
  filtered.forEach((c) => {
    const colleges = Array.isArray(c.colleges) ? c.colleges : [];
    const cols = colleges.length > 0 ? colleges : ["Unassigned"];
    cols.forEach((col) => {
      if (!groups[col]) groups[col] = [];
      groups[col].push(c);
    });
  });
  const groupNames = Object.keys(groups).sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    const ai = COLLEGE_ORDER.indexOf(a);
    const bi = COLLEGE_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1; // known colleges before unrecognized ones
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  useEffect(() => { setCurPage(1); }, [search, filterCollege, filterProgram]);

  // ── Pagination (10 per page) ──
  // Pages run over the college-ordered list; the rows of a page are grouped by college again.
  const totalEntries = groupNames.reduce((n, g) => n + groups[g].length, 0);
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const safePage = Math.min(curPage, totalPages);
  const showingFrom = totalEntries ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(safePage * PAGE_SIZE, totalEntries);
  const pagedGroups = (() => {
    let skip = (safePage - 1) * PAGE_SIZE, left = PAGE_SIZE;
    const out = [];
    for (const g of groupNames) {
      if (left <= 0) break;
      const all = groups[g];
      if (skip >= all.length) { skip -= all.length; continue; }
      const rows = all.slice(skip, skip + left);
      skip = 0; left -= rows.length;
      out.push({ college: g, rows, total: all.length });
    }
    return out;
  })();

  const handleMessage = (coordinator) => {
    setSelectedCoordinator(null);
    if (onNavigateToMessages) {
      onNavigateToMessages({ id: coordinator.id, name: coordinator.name, role: "coordinator" });
    }
  };

  return (
    <div
      style={{
        flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
        background: color.wine500, height: embedded ? "100%" : "100vh",
        fontFamily: font.ui, color: color.ink,
      }}
    >
      {/* Header */}
      <header
        style={{
          background: color.white,
          borderBottom: `1px solid ${border}`,
          padding: isMobile ? "18px 16px" : "22px 32px",
          display: "flex", alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between", gap: space.md, flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div style={{ width: "5px", height: "28px", borderRadius: radius.pill, background: accent }} />
            <h2 style={{ ...type.heading, fontSize: isMobile ? "1.45rem" : "1.7rem", margin: 0, color: color.ink }}>
              Coordinators
            </h2>
          </div>
          <p style={{ ...type.helper, color: color.inkMuted, margin: "6px 0 0 14px" }}>
            Connect with the coordinators of your college.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", width: isMobile ? "100%" : "auto" }}>
          <div
            style={{
              flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "9px",
              background: color.wine900, border: `1px solid ${border}`,
              borderRadius: radius.field, padding: "9px 13px",
              boxShadow: shadow.input,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color.inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7.5" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="scoord-search"
              placeholder="Search name or email"
              aria-label="Search coordinators"
              style={{
                width: isMobile ? "100%" : "205px", border: "none", background: "transparent",
                outline: "none", color: color.ink, fontFamily: font.ui, fontSize: "0.875rem",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                style={{ background: "none", border: "none", color: color.inkMuted, cursor: "pointer", fontSize: "0.95rem", padding: 0 }}
              >
                ×
              </button>
            )}
          </div>

          <div ref={filterRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              id="scoord-filter-btn"
              onClick={() => setShowFilter(v => !v)}
              aria-label="Filter coordinators"
              aria-expanded={showFilter}
              style={{
                width: "40px", height: "40px", borderRadius: "12px",
                background: activeFilterCount > 0 ? color.hoverWash : color.white,
                border: `1px solid ${activeFilterCount > 0 ? color.hoverBorder : border}`,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", position: "relative",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={activeFilterCount > 0 ? accent : color.inkBody}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16l-6.5 7.2v5.1l-3 1.7v-6.8L4 5z" />
              </svg>
              {activeFilterCount > 0 && (
                <span style={{
                  position: "absolute", top: "-5px", right: "-5px",
                  minWidth: "17px", height: "17px", padding: "0 4px",
                  borderRadius: radius.pill, background: accent, color: color.white,
                  fontSize: "0.62rem", fontWeight: 700, display: "flex",
                  alignItems: "center", justifyContent: "center", border: `2px solid ${color.white}`,
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilter && (
              <FilterPanel
                filterRef={undefined}
                allowedColleges={companyDepartments || []}
                filterCollege={filterCollege}
                filterProgram={filterProgram}
                setFilterCollege={setFilterCollege}
                setFilterProgram={setFilterProgram}
              />
            )}
          </div>
        </div>
      </header>

      {/* Count + reset: stays fixed with the header — only the list below scrolls */}
      {!listLoading && scoped.length > 0 && (
        <div style={{ flexShrink: 0, padding: isMobile ? "18px 16px 0" : "24px 32px 0" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: "18px", gap: "12px",
          }}>
            <p style={{ ...type.helper, color: color.inkMuted, margin: 0 }}>
              {filtered.length} {filtered.length === 1 ? "coordinator" : "coordinators"} shown
            </p>
            {(search || activeFilterCount > 0) && (
              <button
                onClick={() => { setSearch(""); setFilterCollege(""); setFilterProgram(""); }}
                style={{
                  background: "none", border: "none", color: accent, cursor: "pointer",
                  fontFamily: font.ui, fontSize: "0.78rem", fontWeight: 600, padding: 0,
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      )}

      <main id="scoord-list" ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: isMobile ? "18px 16px 28px" : "24px 32px 36px", ...(!listLoading && scoped.length > 0 ? { paddingTop: 0 } : {}) }}>
        {listLoading && (
          <div style={{ maxWidth: "760px", margin: "50px auto", textAlign: "center" }}>
            <div style={{
              width: "34px", height: "34px", margin: "0 auto 12px",
              borderRadius: "50%", border: "3px solid #E8E8E8", borderTopColor: accent,
              animation: "cc-spin 0.8s linear infinite",
            }} />
            <p style={{ ...type.helper, color: color.inkMuted, margin: 0 }}>Loading coordinators…</p>
            <style>{`@keyframes cc-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!listLoading && groupNames.length === 0 && (
          <div style={{
            maxWidth: "560px", margin: "50px auto", padding: "34px 24px",
            background: color.white, border: `1px solid ${border}`,
            borderRadius: radius.card, textAlign: "center",
          }}>
            <div style={{
              width: "48px", height: "48px", margin: "0 auto 14px",
              borderRadius: "14px", background: color.hoverWash, color: accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.35rem", fontWeight: 700,
            }}>
              {scoped.length === 0 ? "C" : "⌕"}
            </div>
            <p style={{ ...type.label, color: color.ink, margin: 0 }}>
              {scoped.length === 0 ? "No coordinators yet" : "No matching coordinators"}
            </p>
            <p style={{ ...type.helper, color: color.inkMuted, margin: "6px 0 0" }}>
              {scoped.length > 0
                ? "Try a different name or clear your filters."
                : (companyDepartments && companyDepartments.length === 0
                    ? "Your college isn't set on your account yet, so we can't match you to a coordinator."
                    : "No coordinator handles your college yet. They'll appear here once assigned.")}
            </p>
          </div>
        )}

        {pagedGroups.map(({ college, rows, total }, gIdx) => (
          <section key={college} style={{ marginBottom: gIdx < pagedGroups.length - 1 ? "28px" : 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "9px",
              marginBottom: "10px", paddingLeft: "2px",
            }}>
              <div style={{ width: "4px", height: "18px", borderRadius: radius.pill, background: accent, flexShrink: 0 }} />
              <h3 style={{
                ...type.label, color: color.ink, fontWeight: 650, margin: 0,
                minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: isMobile ? "normal" : "nowrap",
              }}>
                {college}
              </h3>
              <span style={{
                minWidth: "23px", height: "23px", padding: "0 7px",
                borderRadius: radius.pill, background: color.wine700, color: color.inkMuted,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", fontWeight: 600, flexShrink: 0,
              }}>
                {total}
              </span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "10px",
            }}>
              {rows.map((coord) => (
                <article
                  key={coord.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${coord.name}'s details`}
                  onClick={() => setSelectedCoordinator(coord)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCoordinator(coord); } }}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px", cursor: "pointer",
                    padding: isMobile ? "13px" : "14px 16px",
                    background: color.white, border: `1px solid ${border}`,
                    borderRadius: radius.card, boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    transition: `transform 160ms ${ease}, box-shadow 160ms ${ease}, border-color 160ms ${ease}`,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,0.07)";
                    e.currentTarget.style.borderColor = "#D7D7D7";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
                    e.currentTarget.style.borderColor = border;
                  }}
                >
                  <div style={{
                    width: `${avatarSize}px`, height: `${avatarSize}px`, borderRadius: "14px",
                    background: color.wine800, display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0, overflow: "hidden",
                  }}>
                    <CoordinatorAvatar size={avatarSize} icon={themedUserIcon} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      ...type.label, color: color.ink, fontWeight: 650, margin: 0,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {coord.name}
                      <RelationBadge relation={coord.relation} />
                    </p>
                    <p style={{
                      ...type.helper, color: color.inkMuted, margin: "4px 0 0",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {coord.programs?.length > 0 ? coord.programs.join(", ") : "Coordinator"}
                    </p>
                  </div>

                  {/* Chevron: tells the user the card opens more details. */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color.inkMuted}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Pagination: only shown when there are more than 10 coordinators */}
        {!listLoading && totalEntries > PAGE_SIZE && (
          <PaginationBar page={safePage} totalPages={totalPages} onPage={goToPage} from={showingFrom} to={showingTo} total={totalEntries} />
        )}
      </main>

      {selectedCoordinator && (
        <CoordinatorDetailsModal
          userIcon={themedUserIcon}
          coordinator={selectedCoordinator}
          onClose={() => setSelectedCoordinator(null)}
          onMessage={handleMessage}
          canMessage={!!onNavigateToMessages}
        />
      )}
    </div>
  );

};

export default StudentCoordinatorsScreen;