import React, { useState, useEffect, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import userIcon from "../icons/user.png";
import { color, font, type, space, radius, shadow, ease } from "./theme";

const red = "#8B0000";
const darkRed = "#590101";
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
                background: "none", border: "none", color: red, cursor: "pointer",
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
        <div style={{ maxHeight: "190px", overflowY: "auto", display: "grid", gap: "5px" }}>
          {colleges.map((col) => {
            const selected = filterCollege === col;
            return (
              <button
                key={col}
                onClick={() => { setFilterCollege(selected ? "" : col); setFilterProgram(""); }}
                style={{
                  width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: "10px",
                  border: `1px solid ${selected ? "#D9A4A4" : border}`,
                  background: selected ? "#F8EDED" : color.wine900,
                  color: selected ? darkRed : color.inkBody,
                  cursor: "pointer", fontFamily: font.ui, fontSize: "0.8rem",
                  fontWeight: selected ? 600 : 500, transition: `all 160ms ${ease}`,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "7px", height: "7px", borderRadius: "50%",
                    background: selected ? red : "#D0D0D0", flexShrink: 0,
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
            <div style={{ maxHeight: "145px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {programs.map((prog) => {
                const selected = filterProgram === prog;
                return (
                  <button
                    key={prog}
                    onClick={() => setFilterProgram(selected ? "" : prog)}
                    style={{
                      padding: "7px 10px", borderRadius: radius.pill,
                      border: `1px solid ${selected ? red : border}`,
                      background: selected ? red : color.wine900,
                      color: selected ? color.white : color.inkBody,
                      cursor: "pointer", fontFamily: font.ui, fontSize: "0.76rem",
                      fontWeight: selected ? 600 : 500, transition: `all 160ms ${ease}`,
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
            <div style={{ width: "5px", height: "28px", borderRadius: radius.pill, background: red }} />
            <h2 style={{ ...type.heading, fontSize: isMobile ? "1.45rem" : "1.7rem", margin: 0, color: color.ink }}>
              Coordinators
            </h2>
          </div>
          <p style={{ ...type.helper, color: color.inkMuted, margin: "6px 0 0 14px" }}>
            Connect with your assigned college coordinators.
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
              placeholder="Search coordinators"
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
              onClick={() => setShowFilter(v => !v)}
              aria-label="Filter coordinators"
              aria-expanded={showFilter}
              style={{
                width: "40px", height: "40px", borderRadius: "12px",
                background: activeFilterCount > 0 ? "#F8EDED" : color.white,
                border: `1px solid ${activeFilterCount > 0 ? "#D9A4A4" : border}`,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", position: "relative",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={activeFilterCount > 0 ? red : color.inkBody}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16l-6.5 7.2v5.1l-3 1.7v-6.8L4 5z" />
              </svg>
              {activeFilterCount > 0 && (
                <span style={{
                  position: "absolute", top: "-5px", right: "-5px",
                  minWidth: "17px", height: "17px", padding: "0 4px",
                  borderRadius: radius.pill, background: red, color: color.white,
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
                filterCollege={filterCollege}
                filterProgram={filterProgram}
                setFilterCollege={setFilterCollege}
                setFilterProgram={setFilterProgram}
              />
            )}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isMobile ? "18px 16px 28px" : "24px 32px 36px" }}>
        {!loading && coordinators.length > 0 && (
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
                  background: "none", border: "none", color: red, cursor: "pointer",
                  fontFamily: font.ui, fontSize: "0.78rem", fontWeight: 600, padding: 0,
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        )}

        {loading && (
          <div style={{ maxWidth: "760px", margin: "50px auto", textAlign: "center" }}>
            <div style={{
              width: "34px", height: "34px", margin: "0 auto 12px",
              borderRadius: "50%", border: "3px solid #E8E8E8", borderTopColor: red,
              animation: "cc-spin 0.8s linear infinite",
            }} />
            <p style={{ ...type.helper, color: color.inkMuted, margin: 0 }}>Loading coordinators…</p>
            <style>{`@keyframes cc-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && groupNames.length === 0 && (
          <div style={{
            maxWidth: "560px", margin: "50px auto", padding: "34px 24px",
            background: color.white, border: `1px solid ${border}`,
            borderRadius: radius.card, textAlign: "center",
          }}>
            <div style={{
              width: "48px", height: "48px", margin: "0 auto 14px",
              borderRadius: "14px", background: "#F8EDED", color: red,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.35rem", fontWeight: 700,
            }}>
              {coordinators.length === 0 ? "C" : "⌕"}
            </div>
            <p style={{ ...type.label, color: color.ink, margin: 0 }}>
              {coordinators.length === 0 ? "No coordinators yet" : "No matching coordinators"}
            </p>
            <p style={{ ...type.helper, color: color.inkMuted, margin: "6px 0 0" }}>
              {coordinators.length === 0
                ? "Coordinator profiles will appear here when they are available."
                : "Try a different name or clear your filters."}
            </p>
          </div>
        )}

        {groupNames.map((college, gIdx) => (
          <section key={college} style={{ marginBottom: gIdx < groupNames.length - 1 ? "28px" : 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "9px",
              marginBottom: "10px", paddingLeft: "2px",
            }}>
              <div style={{ width: "4px", height: "18px", borderRadius: radius.pill, background: red }} />
              <h3 style={{ ...type.label, color: color.ink, fontWeight: 650, margin: 0 }}>
                {college}
              </h3>
              <span style={{
                minWidth: "23px", height: "23px", padding: "0 7px",
                borderRadius: radius.pill, background: color.wine700, color: color.inkMuted,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", fontWeight: 600,
              }}>
                {groups[college].length}
              </span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "10px",
            }}>
              {groups[college].map((coord) => (
                <article
                  key={coord.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
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
                    width: "44px", height: "44px", borderRadius: "14px",
                    background: color.wine800, display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0, overflow: "hidden",
                  }}>
                    <CoordinatorAvatar size={38} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      ...type.label, color: color.ink, fontWeight: 650, margin: 0,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {coord.name}
                    </p>
                    <p style={{
                      ...type.helper, color: color.inkMuted, margin: "4px 0 0",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {coord.programs?.length > 0 ? coord.programs.join(", ") : "Coordinator"}
                    </p>
                  </div>

                  <button
                    onClick={() => handleMessage(coord)}
                    style={{
                      background: "#000000", color: color.white, border: "none",
                      borderRadius: radius.pill, padding: "9px 14px", cursor: "pointer",
                      fontFamily: font.ui, fontWeight: 600, fontSize: "0.76rem",
                      flexShrink: 0, transition: `background 160ms ${ease}`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.color = "#000000"; e.currentTarget.style.border = "1px solid #000000"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#000000"; e.currentTarget.style.color = "#FFFFFF"; e.currentTarget.style.border = "none"; }}
                  >
                    Message
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );

};

export default CompanyCoordinatorsScreen;