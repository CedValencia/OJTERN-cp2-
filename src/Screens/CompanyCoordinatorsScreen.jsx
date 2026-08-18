import React, { useState, useEffect, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import userIcon from "../icons/user.png";

const red     = "#8B0000";
const darkRed = "#590101";

// Canonical college order — keeps the grouping consistent with the rest of
// the app instead of falling back to alphabetical sorting.
const COLLEGE_ORDER = [
  "College of Computer Studies",
  "College of Business and Accountancy",
  "College of Criminal Justice Education",
  "College of Liberal Arts",
  "College of Education",
  "College of Hospitality Management",
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
  "College of Hospitality Management": {
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
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

// ── CoordinatorAvatar ─────────────────────────────────────────────────────────
const CoordinatorAvatar = ({ size = 44 }) => (
  <img
    src={userIcon}
    alt="coordinator"
    style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
  />
);

// ── FilterPanel ───────────────────────────────────────────────────────────────
const FilterPanel = ({ filterRef, filterCollege, filterProgram, setFilterCollege, setFilterProgram }) => {
  const colleges = Object.keys(COLLEGE_DATA);

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
        position: "absolute", top: "48px", right: 0, width: "260px",
        background: "white", border: `1.5px solid ${red}`, borderRadius: "10px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.18)", zIndex: 100, overflow: "hidden",
        fontFamily: "'Kufam', sans-serif",
      }}
    >
      {/* College / Program */}
      <div style={{ padding: "10px 12px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed }}>College:</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontSize: "0.7rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        {colleges.length > 0 ? (
          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
            {colleges.map(col => (
              <div key={col}
                onClick={() => { setFilterCollege(filterCollege === col ? "" : col); setFilterProgram(""); }}
                style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", cursor: "pointer", background: filterCollege === col ? "#f0d0d0" : "#f7f0f0", color: darkRed, border: "1px solid #e0c0c0" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f0d0d0"}
                onMouseLeave={e => e.currentTarget.style.background = filterCollege === col ? "#f0d0d0" : "#f7f0f0"}
              >{col}</div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available.</p>
        )}

        {filterCollege && (
          <>
            <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, margin: "8px 0 6px" }}>Program:</p>
            {programs.length > 0 ? (
              <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {programs.map(prog => (
                  <span key={prog} onClick={() => setFilterProgram(filterProgram === prog ? "" : prog)}
                    style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: filterProgram === prog ? red : "#f0e0e0", color: filterProgram === prog ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>
                    {prog}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};


// ── Main CompanyCoordinatorsScreen ────────────────────────────────────────────
const CompanyCoordinatorsScreen = ({ embedded, user, onNavigateToMessages }) => {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showFilter, setShowFilter] = useState(false);
  const [filterCollege, setFilterCollege] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const filterRef = useRef(null);

  // Close the filter panel on outside click.
  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // All coordinators, no filtering by industry — full directory.
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

  const filtered = coordinators.filter((c) => {
    const matchesName = c.name.toLowerCase().includes(search.toLowerCase());
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

  const handleMessage = (coordinator) => {
    if (onNavigateToMessages) {
      onNavigateToMessages({ id: coordinator.id, name: coordinator.name, role: "coordinator" });
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5", height: embedded ? "100%" : "100vh" }}>
      {/* ── Header bar ── */}
      <div style={{
        background: darkRed, padding: isMobile ? "10px 14px" : "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px",
      }}>
        <h2 style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1.3rem", fontWeight: 700, color: "white", margin: 0 }}>
          Coordinators
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", borderRadius: "24px", padding: "7px 16px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <div style={{ width: "1px", height: "16px", background: "rgba(0,0,0,0.2)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Coordinator"
              style={{ border: "none", background: "transparent", outline: "none", color: "black", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.05rem", width: isMobile ? "110px" : "160px" }} />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1 }}>✕</button>
            )}
          </div>

          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setShowFilter(v => !v)}
              style={{
                width: "36px", height: "36px", background: "white", borderRadius: "8px",
                border: activeFilterCount > 0 ? `2px solid ${red}` : "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={activeFilterCount > 0 ? red : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {activeFilterCount > 0 && (
                <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "10px", height: "10px", borderRadius: "50%", background: red }} />
              )}
            </button>

            {showFilter && (
              <FilterPanel
                filterRef={filterRef}
                filterCollege={filterCollege}
                filterProgram={filterProgram}
                setFilterCollege={setFilterCollege}
                setFilterProgram={setFilterProgram}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isMobile ? "14px 16px" : "16px 24px" }}>
        {loading && (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#aaa" }}>Loading coordinators…</p>
          </div>
        )}
        {!loading && groupNames.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#aaa" }}>
              {coordinators.length === 0 ? "No coordinators found." : `No results for "${search}"`}
            </p>
          </div>
        )}

        {groupNames.map((college, gIdx) => (
          <div key={college} style={{ marginBottom: gIdx < groupNames.length - 1 ? "22px" : 0 }}>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 800, fontSize: isMobile ? "0.85rem" : "0.92rem", color: darkRed, margin: "0 0 8px 4px" }}>
              {college} ({groups[college].length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {groups[college].map((coord) => (
                <div key={coord.id}
                  style={{ display: "flex", alignItems: "center", gap: isMobile ? "10px" : "14px", padding: isMobile ? "10px 14px" : "12px 18px", background: "#e0e0e0", borderRadius: "12px" }}
                >
                  <CoordinatorAvatar size={isMobile ? 36 : 42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: isMobile ? "0.85rem" : "0.92rem", color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>{coord.name}</p>
                    {coord.programs?.length > 0 && (
                      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.74rem", color: "#888", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {coord.programs.join(", ")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleMessage(coord)}
                    style={{
                      background: red, color: "white", border: "none", borderRadius: "18px",
                      padding: isMobile ? "6px 14px" : "8px 18px", cursor: "pointer",
                      fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: isMobile ? "0.74rem" : "0.8rem",
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = darkRed}
                    onMouseLeave={e => e.currentTarget.style.background = red}
                  >
                    Message
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompanyCoordinatorsScreen;