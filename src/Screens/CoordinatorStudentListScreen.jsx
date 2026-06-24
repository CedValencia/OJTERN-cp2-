import React, { useState, useRef, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import viewIcon from "../icons/view.png";
import userIcon from "../icons/user.png";

const red = "#8B0000";
const darkRed = "#590101";

// ── Responsive styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Kufam:wght@400;600;700&family=Jua&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #8B0000; border-radius: 4px; }
    ::-webkit-scrollbar-track { background: #f0f0f0; }
    .placement-row:hover { background: #d0d0d0 !important; }
    .view-icon-btn img { border-radius: 50%; }
    .view-icon-btn:hover { background: transparent !important; }

    /* Top bar: wraps on mobile */
    .sp-topbar {
      background: ${darkRed};
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      gap: 10px;
      flex-wrap: wrap;
    }
    @media (max-width: 560px) {
      .sp-topbar { padding: 10px 14px; }
    }

    /* Search input width */
    .sp-search-input { width: 160px; }
    @media (max-width: 480px) {
      .sp-search-input { width: 110px; }
    }

    /* Filter badge area */
    .sp-filter-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 24px;
      background: #f5f5f5;
      flex-wrap: wrap;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }
    @media (max-width: 560px) {
      .sp-filter-badges { padding: 8px 14px; }
    }

    /* Student list padding */
    .sp-list-area {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    @media (max-width: 560px) {
      .sp-list-area { padding: 10px 12px; }
    }

    /* Placement modal: full-width on mobile */
    .sp-modal-inner {
      background: white;
      border-radius: 24px;
      width: 480px;
      max-width: calc(100vw - 32px);
      max-height: 92vh;
      overflow-y: auto;
      box-shadow: 0 24px 64px rgba(0,0,0,0.3);
    }

    /* Modal header */
    .sp-modal-header {
      padding: 22px 26px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    @media (max-width: 480px) {
      .sp-modal-header { padding: 14px 16px 10px; }
    }

    /* Modal body */
    .sp-modal-body {
      padding: 0 26px 24px;
    }
    @media (max-width: 480px) {
      .sp-modal-body { padding: 0 14px 18px; }
    }

    /* Student name pill in modal */
    .sp-name-pill {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #e8e8e8;
      border-radius: 50px;
      padding: 10px 18px 10px 10px;
      margin-bottom: 22px;
    }
    @media (max-width: 400px) {
      .sp-name-pill { padding: 8px 12px 8px 8px; gap: 10px; }
    }

    /* Detail grid in modal: 2-col → 1-col */
    .sp-detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    @media (max-width: 400px) {
      .sp-detail-grid { grid-template-columns: 1fr; }
    }
  `}</style>
);

// TODO: Populate from backend — college > programs > specializations structure
const COLLEGE_DATA = {};

// TODO: Populate from backend or config — available year & section options
const YEAR_SECTIONS = [];

// TODO: Populate from backend or config — sex options
const SEX_OPTIONS = [];

// TODO: Replace with real data from backend

// TODO: Replace with real data from backend

const StudentAvatar = ({ size = 42 }) => (
  <img
    src={userIcon}
    alt="user"
    style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
  />
);

const ViewIcon = ({ onClick }) => (
  <div
    onClick={(e) => onClick(e)}
    className="view-icon-btn"
    style={{ alignItems: "center", justifyContent: "center", cursor: "pointer" }}
  >
    <img src={viewIcon} alt="view" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
  </div>
);

const PlacementModal = ({ student, onClose, onNavigateToCompany, companies }) => {
  const [application, setApplication] = useState(null);

  useEffect(() => {
    if (!student?.id) return;
    // Look for an accepted/pending application for this student
    const q = query(collection(db, "applications"), where("studentId", "==", student.id));
    getDocs(q).then(snap => {
      if (!snap.empty) setApplication(snap.docs[0].data());
    });
  }, [student?.id]);

  const companyId = application?.companyId || student.companyId || null;
  const company   = companyId ? companies.find(c => c.id === companyId) : null;
  const fullName = `${student.firstName} ${student.middleInitial ? student.middleInitial + " " : ""}${student.lastName}`;

  const handleVisitCompany = () => {
    onClose();
    onNavigateToCompany(companyId);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div className="sp-modal-inner">
        <div className="sp-modal-header">
          <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 4vw, 1.55rem)", color: darkRed }}>Student Placement</h2>
          <button onClick={onClose} style={{ background: darkRed, border: "none", borderRadius: "50%", width: "30px", height: "30px", color: "white", fontSize: "1rem", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>

        <div className="sp-modal-body">
          <div className="sp-name-pill">
            <StudentAvatar size={44} />
            <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1rem, 4vw, 1.35rem)", color: "#222" }}>{fullName}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.15rem", color: "#222", marginBottom: "4px" }}>Placement:</p>
              {company ? (
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#777", marginBottom: "8px" }}>{company.name}</p>
              ) : (
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#bbb", fontStyle: "italic", marginBottom: "8px" }}>{application ? "Application pending company approval" : "No company assigned yet"}</p>
              )}
            </div>
            {company && (
              <div style={{ marginLeft: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <ViewIcon onClick={handleVisitCompany} />
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.65rem", color: "#aaa" }}>Visit</span>
              </div>
            )}
          </div>

          <div style={{ marginTop: "18px", padding: "12px 14px", background: "#fafafa", borderRadius: "10px", border: "1px solid #f0e0e0" }}>
            <div className="sp-detail-grid">
              {[
                { label: "Student ID",     value: student.studentId },
                { label: "Sex",            value: student.sex },
                { label: "College",        value: student.college,        full: true },
                { label: "Program",        value: student.program,        full: true },
                { label: "Major",          value: student.major || "N/A", full: true },
                { label: "Year & Section", value: student.yearSection },
                { label: "Application Status", value: application?.status || "No application yet", full: true },
              ].map(({ label, value, full }) => (
                <div key={label} style={{ gridColumn: full ? "1 / -1" : "auto" }}>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.68rem", color: "#bbb", marginBottom: "2px" }}>{label}</p>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#444", fontWeight: 600 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FilterPanel = ({ filters, setFilters, filterRef }) => {
  const [expandedCollege, setExpandedCollege] = useState(filters.college || "");

  const allColleges        = Object.keys(COLLEGE_DATA);
  const allPrograms        = expandedCollege ? Object.keys(COLLEGE_DATA[expandedCollege]?.programs || {}) : [];
  const allSpecializations = (expandedCollege && filters.program)
    ? (COLLEGE_DATA[expandedCollege]?.programs[filters.program]?.specializations || [])
    : [];

  // Derive section letters from YEAR_SECTIONS (e.g. "4-A" → "A")
  const sectionLetters = YEAR_SECTIONS.map(s => s.split("-")[1]).filter(Boolean);

  const clearAll = () => {
    setExpandedCollege("");
    setFilters({ college: "", program: "", specialization: "", sex: "", section: "" });
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

  return (
    <div
      ref={filterRef}
      style={{
        position: "absolute", top: "48px", right: 0, width: "260px",
        background: "white", border: `1.5px solid ${red}`, borderRadius: "10px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.18)", zIndex: 100, overflow: "hidden",
        fontFamily: "'Kufam', sans-serif",
      }}
    >
      {/* Sex + Clear All */}
      <div style={{ padding: "10px 12px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed }}>Sex:</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontSize: "0.7rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {SEX_OPTIONS.length > 0 ? (
            SEX_OPTIONS.map(s => (
              <span key={s} onClick={() => toggleSex(s)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.72rem", cursor: "pointer", userSelect: "none", background: filters.sex === s ? red : "#f0e0e0", color: filters.sex === s ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>
                {s}
              </span>
            ))
          ) : (
            <span style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available</span>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "6px 0" }} />

      {/* Section */}
      <div style={{ padding: "4px 12px 10px" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, marginBottom: "6px" }}>Section:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {sectionLetters.length > 0 ? (
            sectionLetters.map(s => (
              <span key={s} onClick={() => toggleSection(s)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.72rem", cursor: "pointer", userSelect: "none", background: filters.section === s ? red : "#f0e0e0", color: filters.section === s ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>
                {s}
              </span>
            ))
          ) : (
            <span style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No sections available</span>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "0" }} />

      {/* College → Program → Major */}
      <div style={{ padding: "6px 12px 10px" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, marginBottom: "6px" }}>
          College:
          {expandedCollege && (
            <span style={{ fontWeight: "normal", color: "#888", marginLeft: "6px", fontSize: "0.68rem" }}>
              {[expandedCollege, filters.program].filter(Boolean).join(" › ")}
            </span>
          )}
        </p>

        {locationLevel === "college" && (
          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
            {allColleges.length > 0 ? (
              allColleges.map(col => (
                <div key={col} onClick={() => toggleCollege(col)}
                  style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", cursor: "pointer", background: "#f7f0f0", color: darkRed, border: "1px solid #e0c0c0" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0d0d0"}
                  onMouseLeave={e => e.currentTarget.style.background = "#f7f0f0"}
                >{col}</div>
              ))
            ) : (
              <span style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No colleges available</span>
            )}
          </div>
        )}

        {locationLevel === "program" && (
          <div>
            <div onClick={() => toggleCollege(expandedCollege)} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "8px", color: red, fontSize: "0.72rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {expandedCollege}
            </div>
            <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {allPrograms.map(prog => (
                <span key={prog} onClick={() => toggleProgram(prog)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: filters.program === prog ? red : "#f0e0e0", color: filters.program === prog ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>
                  {prog}
                </span>
              ))}
            </div>
          </div>
        )}

        {locationLevel === "specialization" && (
          <div>
            <div onClick={() => setFilters(prev => ({ ...prev, program: "", specialization: "" }))} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "8px", color: red, fontSize: "0.72rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {filters.program}
            </div>
            {allSpecializations.length > 0 ? (
              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {allSpecializations.map(spec => (
                  <span key={spec} onClick={() => toggleSpec(spec)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: filters.specialization === spec ? red : "#f0e0e0", color: filters.specialization === spec ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>
                    {spec}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.72rem", color: "#aaa", fontStyle: "italic" }}>No specializations for this program.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CoordinatorStudentListScreen = ({ onNavigateToCompany }) => {
  const [search, setSearch]                 = useState("");
  const [viewingStudent, setViewingStudent] = useState(null);
  const [showFilter, setShowFilter]         = useState(false);
  const [filters, setFilters]               = useState({ college: "", program: "", specialization: "", sex: "", section: "" });

  const filterRef = useRef(null);
  const [students, setStudents]     = useState([]);
  const [companies, setCompanies]   = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingStudents(false);
    }, () => setLoadingStudents(false));
    return () => unsub();
  }, []);

  // ── Load companies ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "companies"), snap => {
      setCompanies(snap.docs.map(d => ({ id: d.id, name: d.data().companyName || "", ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasFilter = Object.values(filters).some(Boolean);

  const filtered = students.filter(s => {
    const q        = search.toLowerCase();
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    const matchSearch  = fullName.includes(q) || s.studentId.includes(q) || s.program.toLowerCase().includes(q) || s.college.toLowerCase().includes(q);
    const matchSex     = !filters.sex     || s.sex === filters.sex;
    const matchSection = !filters.section || s.yearSection.endsWith(`-${filters.section}`);
    const matchCollege = !filters.college || s.college  === filters.college;
    const matchProgram = !filters.program || s.program  === filters.program;
    const matchSpec    = !filters.specialization || s.major === filters.specialization;
    return matchSearch && matchSex && matchSection && matchCollege && matchProgram && matchSpec;
  });

  return (
    <>
      <ResponsiveStyles />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f0f0f0", overflow: "hidden" }}>

        {/* Top bar */}
        <div className="sp-topbar">
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 4vw, 1.6rem)", color: "white", letterSpacing: "0.04em" }}>Student List</span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", borderRadius: "24px", padding: "7px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <div style={{ width: "1px", height: "16px", background: "rgba(0,0,0,0.2)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Students"
                className="sp-search-input"
                style={{ border: "none", background: "transparent", outline: "none", color: "black", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.1rem" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1 }}>✕</button>
              )}
            </div>

            {/* Filter icon */}
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setShowFilter(v => !v)}
                style={{ width: "36px", height: "36px", background: "white", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `2px solid ${red}` : "none", position: "relative" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? red : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {hasFilter && <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "10px", height: "10px", borderRadius: "50%", background: red }} />}
              </div>
              {showFilter && <FilterPanel filters={filters} setFilters={setFilters} filterRef={filterRef} />}
            </div>
          </div>
        </div>

        {/* Active filter badges */}
        {hasFilter && (
          <div className="sp-filter-badges">
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#888" }}>Filters:</span>
            {filters.sex && (
              <span style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                {filters.sex}<span onClick={() => setFilters(prev => ({ ...prev, sex: "" }))} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
              </span>
            )}
            {filters.section && (
              <span style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                4-{filters.section}<span onClick={() => setFilters(prev => ({ ...prev, section: "" }))} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
              </span>
            )}
            {filters.college && (
              <span style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                {[filters.college, filters.program, filters.specialization].filter(Boolean).join(" › ")}
                <span onClick={() => setFilters(prev => ({ ...prev, college: "", program: "", specialization: "" }))} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
              </span>
            )}
            <span onClick={() => setFilters({ college: "", program: "", specialization: "", sex: "", section: "" })} style={{ fontSize: "0.74rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", textDecoration: "underline" }}>Clear all</span>
          </div>
        )}

        {/* Student list */}
        <div className="sp-list-area">
          {filtered.map(student => {
            const fullName = `${student.firstName} ${student.middleInitial ? student.middleInitial + " " : ""}${student.lastName}`;
            return (
              <div
                key={student.id}
                className="placement-row"
                onClick={() => setViewingStudent(student)}
                style={{ background: "#dadada", borderRadius: "50px", padding: "8px 14px 8px 8px", display: "flex", alignItems: "center", gap: "14px", transition: "background 0.15s", cursor: "pointer" }}
              >
                <StudentAvatar size={42} />
                <div style={{ width: "1px", height: "32px", background: "rgba(0,0,0,0.12)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 600, fontSize: "0.92rem", color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", overflow: "hidden" }}>
                    <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.71rem", color: "#777", whiteSpace: "nowrap", flexShrink: 0 }}>{student.sex}</span>
                    {student.program && (
                      <>
                        <span style={{ color: "#ccc", fontSize: "0.7rem", flexShrink: 0 }}>•</span>
                        <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.71rem", color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{student.program}</span>
                      </>
                    )}
                    <span style={{ color: "#ccc", fontSize: "0.7rem", flexShrink: 0 }}>•</span>
                    <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.71rem", color: "#777", whiteSpace: "nowrap", flexShrink: 0 }}>{student.yearSection}</span>
                  </div>
                </div>
                <ViewIcon onClick={(e) => { e.stopPropagation(); setViewingStudent(student); }} />
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px", color: "#aaa", fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem" }}>
              {loadingStudents ? "Loading students..." : students.length === 0 ? "No students yet." : "No students match your search."}
            </div>
          )}

          {filtered.length > 0 && (
            <p style={{ textAlign: "center", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#aaa", padding: "16px 0" }}>
              No more recent students!
            </p>
          )}
        </div>
      </div>

      {viewingStudent && (
        <PlacementModal
          student={viewingStudent}
          companies={companies}
          onClose={() => setViewingStudent(null)}
          onNavigateToCompany={(companyId) => {
            setViewingStudent(null);
            onNavigateToCompany && onNavigateToCompany(companyId);
          }}
        />
      )}
    </>
  );
};

export default CoordinatorStudentListScreen;