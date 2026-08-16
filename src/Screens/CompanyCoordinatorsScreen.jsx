import React, { useState, useEffect } from "react";
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

// ── Main CompanyCoordinatorsScreen ────────────────────────────────────────────
const CompanyCoordinatorsScreen = ({ embedded, user, onNavigateToMessages }) => {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const filtered = coordinators.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

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
      <div style={{ padding: isMobile ? "14px 16px 0" : "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: isMobile ? "1.6rem" : "1.9rem", color: darkRed }}>Coordinators</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", border: "1px solid #ddd", borderRadius: "24px", padding: isMobile ? "5px 12px" : "7px 16px", flex: isMobile ? 1 : "unset", maxWidth: isMobile ? "unset" : "220px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div style={{ width: "2px", height: "16px", background: "rgba(0,0,0,0.2)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
            style={{ border: "none", background: "transparent", outline: "none", fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#333", width: "100%", minWidth: 0 }} />
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