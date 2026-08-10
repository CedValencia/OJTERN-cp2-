import React, { useState, useEffect } from "react";
import { changePassword, logOut, getUserProfile } from "./AuthService";
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { PersonalInfoScreen, ResponsiveStyles } from "./CoordinatorAccountProfileScreen";

import CoordinatorStudentsAcccountScreen      from "./CoordinatorStudentsAcccountScreen";
import CoordinatorStudentListScreen from "./CoordinatorStudentListScreen";
import CoordinatorCompanyListScreen       from "./CoordinatorCompanyListScreen";
import CoordinatorMessagesScreen          from "./CoordinatorMessagesScreen";
import CoordinatorAccountProfileScreen    from "./CoordinatorAccountProfileScreen";
import CoordinatorViewCompanyScreen       from "./CoordinatorFindCompanyScreen";
import CoordinatorReportCompanyScreen, { ReportDetailModal } from "./CoordinatorReportCompanyScreen";
import AboutScreen from "./AboutScreen";

import logo                 from "../icons/ojtern.png";
import dashboardIcon        from "../icons/dashboard.png";
import viewIcon             from "../icons/view.png";
import companyProfileIcon   from "../icons/companyprofile.png";
import findIcon           from "../icons/find.png";
import studentListIcon      from "../icons/studentlist.png";
import studentPlacementIcon from "../icons/studentsplacement.png";
import companyListIcon      from "../icons/companylist.png";
import reportCompanyIcon    from "../icons/reportcompany.png";
import messagesIcon         from "../icons/messages.png";
import accountProfileIcon   from "../icons/accountprofile.png";
import aboutIcon            from "../icons/about.png";

// ── Design tokens ──────────────────────────────────────────────────────────────
const red     = "#8B0000";
const darkRed = "#590101";

// ── Coordinator department scoping ─────────────────────────────────────────────
// Coordinator docs store assigned departments as `deptSelections`, an array of
// { department: "College of Computer Studies", program, specialization } — the
// FULL label, not the short key ("CCS") used on student records. Map label ->
// key here so dashboard queries can filter students by college.
// IMPORTANT: keep this list in sync with the COLLEGE_DATA labels in
// CoordinatorStudentListScreen.jsx and CoordinatorStudentsAcccountScreen.jsx.
const DEPT_LABEL_TO_COLLEGE_KEY = {
  "College of Computer Studies":          "CCS",
  "College of Business and Accountancy":  "CBA",
  "College of Criminal Justice Education":"CCJE",
  "College of Liberal Arts":              "CLA",
  "College of Education":                 "CED",
  "College of Hospitality Management":    "CHM",
};

// A coordinator can be assigned to more than one department, so this returns
// an array of college keys (deduped) instead of a single value. All
// coordinators assigned to the same college (e.g. all CED coordinators) see
// the same set of students, regardless of program/major — the specific
// program is just shown per-student in the Student List, not used to further
// split which coordinator sees which student.
const getAssignedCollegeKeys = (deptSelections) => {
  if (!Array.isArray(deptSelections)) return [];
  const keys = deptSelections
    .map((sel) => DEPT_LABEL_TO_COLLEGE_KEY[sel?.department])
    .filter(Boolean);
  return [...new Set(keys)];
};

// ── Time ago helper ────────────────────────────────────────────────────────────
const timeAgo = (ts) => {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)    return "Just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
};

// ── Responsive breakpoint hook ─────────────────────────────────────────────────
const useBreakpoint = () => {
  const [bp, setBp] = useState({ isMobile: false, isTablet: false, isDesktop: true });
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setBp({ isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return bp;
};

// ── Global styles ──────────────────────────────────────────────────────────────
const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&family=Monomaniac+One&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #8B0000; border-radius: 4px; }
    ::-webkit-scrollbar-track { background: #f0f0f0; }

    .nav-item { transition: background 0.15s; }
    .nav-item:hover  { background: rgba(185,185,185,0.7) !important; }
    .nav-item.active { background: rgba(185,185,185,0.9) !important; }

    .company-row { transition: background 0.15s; cursor: pointer; }
    .company-row:hover { background: #c8c8c8 !important; }

    /* ── Slide-in drawer (mobile / tablet) ── */
    .sidebar-drawer {
      position: fixed; top: 0; left: 0;
      height: 100%; width: 260px; z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      background: #e0e0e0; border-right: 1px solid #ccc;
      overflow-y: auto; display: flex; flex-direction: column;
    }
    .sidebar-drawer.open { transform: translateX(0); }

    .sidebar-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.35); z-index: 199;
    }
    .sidebar-overlay.open { display: block; }

    /* ── Dashboard top grid: 2-col ≥768px, 1-col below ── */
    .dash-top-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    @media (max-width: 767px) {
      .dash-top-grid { grid-template-columns: 1fr; }
    }

    /* ── Stats inner row ── */
    .stats-inner {
      display: flex;
      gap: 14px;
      padding: 12px;
      min-height: 260px;
      overflow: visible;
    }
    @media (max-width: 480px) {
      .stats-inner { flex-direction: column; min-height: unset; }
    }

    /* ── Fluid welcome heading ── */
    .welcome-heading {
      font-family: 'Jersey 25', sans-serif;
      font-size: clamp(2.2rem, 6vw, 5.5rem);
      color: #590101;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: -6px;
    }
    .welcome-sub {
      font-family: 'Kufam', sans-serif;
      font-size: clamp(0.95rem, 2.5vw, 1.5rem);
      color: #590101;
    }

    /* ── Card section header ── */
    .card-header {
      background: #590101;
      padding: 10px 16px;
      border-radius: 14px 14px 0 0;
    }
    .card-header span {
      font-family: 'Kufam', sans-serif;
      font-weight: bold;
      font-size: clamp(0.82rem, 2vw, 1rem);
      color: white;
    }

    /* ── Desktop static sidebar ── */
    @media (min-width: 1024px) {
      .sidebar-static {
        width: 260px; flex-shrink: 0;
        background: #e0e0e0;
        display: flex; flex-direction: column;
        overflow-y: auto; border-right: 1px solid #ccc;
      }
    }

    /* ── Hamburger button ── */
    .hamburger-btn {
      background: none; border: none; cursor: pointer;
      padding: 6px; display: flex; flex-direction: column; gap: 5px;
      -webkit-tap-highlight-color: transparent;
    }
    .hamburger-btn span {
      display: block; width: 24px; height: 2px;
      background: white; border-radius: 2px; transition: all 0.2s;
    }

    /* ── Main content area ── */
    .main-content {
      flex: 1; display: flex; flex-direction: column;
      overflow-y: auto; background: #f5f5f5; min-width: 0;
    }
  `}</style>
);

// ── Nav items ──────────────────────────────────────────────────────────────────
const navItems = [
  { key: "dashboard",         label: "Dashboard",          icon: dashboardIcon },
  { key: "findcompany",       label: "Find Company",      icon: findIcon },
  { key: "studentsaccount",      label: "Students Account",      icon: studentListIcon },
  { key: "studentlist", label: "Student List", icon: studentPlacementIcon },
  { key: "companylist",       label: "Company List",       icon: companyListIcon },
  { key: "reportcompany",     label: "Report Company",     icon: reportCompanyIcon },
  { key: "messages",          label: "Messages",           icon: messagesIcon },
  { key: "accountprofile",    label: "Account Profile",    icon: accountProfileIcon },
];

// ── Shared sub-components ──────────────────────────────────────────────────────
const CompanyAvatar = ({ size = 38 }) => (
  <div style={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <img src={companyProfileIcon} alt="company" style={{ width: size, height: size, objectFit: "contain" }} />
  </div>
);

// ── Empty state placeholder ────────────────────────────────────────────────────
const EmptyListPlaceholder = ({ label = "No data available" }) => (
  <div style={{
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "8px", padding: "20px",
  }}>
    <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#aaa", textAlign: "center" }}>
      {label}
    </span>
  </div>
);

// ── Sidebar nav list (reused in static & drawer) ───────────────────────────────
const SidebarNav = ({ activeNav, onNavigate, onLogout }) => (
  <>
    {navItems.map((item) => (
      <div
        key={item.key}
        className={`nav-item ${activeNav === item.key ? "active" : ""}`}
        onClick={() => onNavigate(item.key)}
        style={{
          display: "flex", alignItems: "center", gap: "14px",
          padding: "15px 20px", cursor: "pointer",
          borderBottom: "1px solid #ccc", minHeight: "56px",
          background: activeNav === item.key ? "rgba(139,0,0,0.10)" : "transparent",
        }}
      >
        <img src={item.icon} alt={item.label}
          style={{ width: "30px", height: "30px", objectFit: "contain", flexShrink: 0, opacity: activeNav === item.key ? 1 : 0.35 }} />
        <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", opacity: activeNav === item.key ? 1 : 0.35 }}>
          {item.label}
        </span>
      </div>
    ))}

    {onLogout && (
      <>
        <div style={{ flex: 1 }} />
        <div
          onClick={onLogout}
          style={{
            display: "flex", alignItems: "center", gap: "14px",
            padding: "15px 20px", cursor: "pointer",
            minHeight: "56px", borderTop: "1px solid #ccc",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8B0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: "#8B0000" }}>
            Log Out
          </span>
        </div>
      </>
    )}
  </>
);

// ── Logout Confirmation Modal ──────────────────────────────────────────────
const LogoutConfirmModal = ({ onConfirm, onCancel }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  }}>
    <div style={{
      background: "white", borderRadius: "20px",
      padding: "36px 32px", width: "clamp(280px, 85vw, 380px)",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: "#fde8e8", display: "flex",
        alignItems: "center", justifyContent: "center", marginBottom: "4px",
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
          stroke="#8B0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </div>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1.15rem", color: "#1a1a1a", margin: 0, textAlign: "center" }}>Log Out</p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#666", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
        Are you sure you want to log out of your account?
      </p>
      <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "8px" }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: "12px", borderRadius: "30px",
          border: "1.5px solid #ccc", background: "white",
          fontFamily: "'Kufam', sans-serif", fontWeight: 600,
          fontSize: "0.95rem", cursor: "pointer", color: "#555",
        }}>Cancel</button>
        <button onClick={onConfirm} style={{
          flex: 1, padding: "12px", borderRadius: "30px",
          border: "none", background: "#8B0000",
          fontFamily: "'Kufam', sans-serif", fontWeight: 700,
          fontSize: "0.95rem", cursor: "pointer", color: "white",
          boxShadow: "0 3px 10px rgba(139,0,0,0.3)",
        }}>Log Out</button>
      </div>
    </div>
  </div>
);

// ── Company row ────────────────────────────────────────────────────────────────
const CompanyRow = ({ company, onView, mr = "0", showTime = false }) => (
  <div
    className="company-row"
    onClick={() => onView(company.id)}
    style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "#d8d8d8", borderRadius: "8px",
      padding: "7px 10px", marginRight: mr,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
      <CompanyAvatar />
      <div style={{ minWidth: 0 }}>
        <span style={{
          fontFamily: "'Kufam', sans-serif",
          fontSize: "clamp(0.75rem, 2vw, 0.82rem)",
          color: "#333",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "block",
        }}>
          {company.name}
        </span>
        {showTime && company.visitedAt && (
          <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.68rem", color: "#8B0000", fontWeight: 600 }}>
            {timeAgo(company.visitedAt)}
          </span>
        )}
      </div>
    </div>
    <div
      onClick={(e) => { e.stopPropagation(); onView(company.id); }}
      style={{
        width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
      }}
    >
      <img src={viewIcon} alt="view" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
    </div>
  </div>
);

// ── Stat card ──────────────────────────────────────────────────────────────────
// Label on top → coloured rounded box (155px) → big number or "—" centred →
// view button overlapping the bottom-right corner of the box (responsive, no
// hardcoded left/top pixel values).
const StatCard = ({ label, value, bg = "rgba(0,0,0,0.15)", onView }) => (
  <div style={{ flex: 1, background: "transparent", borderRadius: "12px", padding: "2px 16px", display: "flex", flexDirection: "column" }}>
    <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.9rem, 1.8vw, 1.2rem)", color: "#000000", marginBottom: "12px" }}>
      {label}
    </p>
    <div style={{ position: "relative", marginBottom: "35px" }}>
      <div style={{
        background: bg, borderRadius: "8px",
        width: "100%", height: "155px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {value !== null ? (
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(2.2rem, 5vw, 4rem)", color: "white" }}>
            {value}
          </span>
        ) : (
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "2rem", color: "rgba(255,255,255,0.4)" }}>
            —
          </span>
        )}
      </div>
      <div
        onClick={onView}
        style={{
          position: "absolute",
          bottom: "-30px", right: "-12px", 
          width: "55px", height: "55px",  
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", WebkitTapHighlightColor: "transparent",
          zIndex: 2,
        }}
      >
        <img src={viewIcon} alt="view" style={{ width: "70px", height: "70px", objectFit: "contain" }} />
      </div>
    </div>
  </div>
);

// ── Dashboard Content ──────────────────────────────────────────────────────────
const DashboardContent = ({ onNavigate, onViewCompany, onViewRegistered, coordinatorUid, coordinatorColleges, coordinatorIndustries = [], recentVisited = [] }) => {
  const [recentRegistered, setRecentRegistered] = React.useState([]);
  const [totalStudents,    setTotalStudents]    = React.useState(null);
  const [acceptedStudents, setAcceptedStudents] = React.useState(null);

  // Track raw sets so we can intersect "active students in my department(s)"
  // with "students who have an Accepted application" — applications don't
  // carry a college field, so the accepted count is derived client-side.
  const [activeStudentIds,     setActiveStudentIds]     = React.useState(new Set());
  const [acceptedAppStudentIds, setAcceptedAppStudentIds] = React.useState(new Set());

  React.useEffect(() => {
    if (!coordinatorUid) return;

    // 1. Recent approved companies — scoped to this coordinator's assigned
    //    industries (same "industry array-contains-any" pattern already used
    //    successfully in CoordinatorCompanyListScreen). Without this, every
    //    coordinator saw every approved company regardless of industry.
    let unsubCompany = () => {};
    if (coordinatorIndustries.length > 0) {
      const companyQ = query(
        collection(db, "companies"),
        where("status", "==", "approved"),
        where("industry", "array-contains-any", coordinatorIndustries.slice(0, 30)),
        limit(5)
      );
      unsubCompany = onSnapshot(companyQ, (snap) => {
        setRecentRegistered(snap.docs.map(d => ({ id: d.id, name: d.data().companyName })));
      });
    } else {
      setRecentRegistered([]);
    }

    // If this coordinator has no recognized department assigned yet, don't
    // run the (invalid) empty "in" query — just show zero instead of crashing.
    if (!coordinatorColleges || coordinatorColleges.length === 0) {
      setTotalStudents(0);
      setActiveStudentIds(new Set());
      return () => { unsubCompany(); };
    }

    // 2. Total students — scoped to college/department only. All coordinators
    //    assigned to the same college (e.g. all of CED) see the same set of
    //    students regardless of program/major — the specific program is shown
    //    per-student in the Student List, not used to further split coordinators.
    //    NOTE: needs a Firestore composite index (status + college) the first
    //    time it runs; Firestore will log a console link to create it.
    const studentQ = query(
      collection(db, "students"),
      where("status", "==", "active"),
      where("college", "in", coordinatorColleges)
    );
    const unsubStudents = onSnapshot(studentQ, (snap) => {
      setTotalStudents(snap.size);
      setActiveStudentIds(new Set(snap.docs.map(d => d.id)));
    });

    // 3. Accepted students — an "accepted" student is one with at least one
    //    application whose status is "Accepted" (set by the company in
    //    CompanyApplicantsScreen). Count unique studentId values since a
    //    student could have multiple applications. Filtered down to only
    //    student IDs that belong to this coordinator's department(s) (see #2).
    const acceptedQ = query(collection(db, "applications"), where("status", "==", "Accepted"));
    const unsubAccepted = onSnapshot(acceptedQ, (snap) => {
      setAcceptedAppStudentIds(new Set(snap.docs.map(d => d.data().studentId)));
    });

    return () => { unsubCompany(); unsubStudents(); unsubAccepted(); };
  }, [coordinatorUid, coordinatorColleges, coordinatorIndustries]);

  React.useEffect(() => {
    let count = 0;
    activeStudentIds.forEach((id) => { if (acceptedAppStudentIds.has(id)) count += 1; });
    setAcceptedStudents(count);
  }, [activeStudentIds, acceptedAppStudentIds]);

  return (
    <div style={{ padding: "clamp(16px, 4vw, 32px)", overflowY: "auto", flex: 1 }}>

      {/* Welcome banner */}
      <div style={{
        background: "#e8e8e8", borderRadius: "18px",
        padding: "clamp(20px, 5vw, 30px) clamp(18px, 5vw, 40px)",
        marginBottom: "24px", textAlign: "center",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.07)",
      }}>
        <h1 className="welcome-heading">Welcome to OJTern</h1>
        <p className="welcome-sub">Find the perfect OJT for you!</p>
      </div>

      <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "24px" }} />

      {/* Top grid: Students Stats + Recent Registered Company */}
      <div className="dash-top-grid">

        {/* Students Stats */}
        <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "visible", display: "flex", flexDirection: "column" }}>
          <div className="card-header"><span>Students Stats</span></div>
          <div className="stats-inner">
            <StatCard
              label="Total Students"
              value={totalStudents}
              bg="rgba(0,0,0,0.15)"
              onView={() => onNavigate("studentlist")}
            />
            <StatCard
              label="Accepted Students"
              value={acceptedStudents}
              bg="rgba(89,1,1,0.35)"
              onView={() => onNavigate("studentlist")}
            />
          </div>
        </div>

        {/* Recent Registered Company */}
        <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="card-header"><span>Recent Registered Company</span></div>
          <div style={{ padding: "10px 0 10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "240px", overflowY: "auto" }}>
            {recentRegistered.length > 0 ? (
              recentRegistered.map((company, i) => (
                <CompanyRow key={i} company={company} onView={onViewRegistered} mr="12px" />
              ))
            ) : (
              <EmptyListPlaceholder label="No registered companies yet" />
            )}
          </div>
        </div>
      </div>

      {/* Recent Visited Company */}
      <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "hidden" }}>
        <div className="card-header"><span>Recent Visited Company</span></div>
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
          {recentVisited.length > 0 ? (
            recentVisited.map((company, i) => (
              <CompanyRow key={i} company={company} onView={onViewCompany} showTime />
            ))
          ) : (
            <EmptyListPlaceholder label="No recently visited companies" />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Shell ────────────────────────────────────────────────────────────────
const CoordinatorDashboardScreen = ({ user, onLogout }) => {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const showDrawer = isMobile || isTablet;

  // The `user` prop is captured at login and can go stale — e.g. if this
  // coordinator completed their mandatory department/industry setup AFTER
  // that snapshot was taken, `user.deptSelections` here would still be
  // empty/outdated even though Firestore has the right data (this is why
  // Account Profile, which reads Firestore directly, showed the correct
  // department while the dashboard showed 0 students). So we fetch the
  // coordinator's own doc fresh here too, same pattern already used
  // successfully in CoordinatorCompanyListScreen for assignedIndustries.
  const [coordinatorProfile, setCoordinatorProfile] = useState(null);
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getUserProfile("coordinators", user.uid).then((data) => {
      if (!cancelled) setCoordinatorProfile(data || null);
    });
    return () => { cancelled = true; };
  }, [user?.uid]);

  // Derived once per change of the fetched deptSelections — memoized so this
  // array keeps a stable reference across renders (it's used as a useEffect
  // dependency downstream, and a fresh array every render would resubscribe
  // Firestore listeners on every parent re-render).
  const coordinatorColleges = React.useMemo(
    () => getAssignedCollegeKeys(coordinatorProfile?.deptSelections),
    [coordinatorProfile?.deptSelections]
  );

  // Same idea for industries — used to scope "Recent Registered Company" on
  // the dashboard to only the companies under this coordinator's assigned
  // industries (mirrors CoordinatorCompanyListScreen's own scoping).
  const coordinatorIndustries = React.useMemo(
    () => coordinatorProfile?.assignedIndustries || [],
    [coordinatorProfile?.assignedIndustries]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    setDrawerOpen(false);
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    try {
      await logOut();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      onLogout?.();
    }
  };
  const [recentVisited, setRecentVisited] = useState(() => {
    if (!user?.uid) return [];
    try {
      const stored = localStorage.getItem(`recentVisited_coord_${user.uid}`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [activeNav, setActiveNav] = useState(() => sessionStorage.getItem("ojtern_coord_nav") || "dashboard");

  const [reports, setReports]                                   = useState([]);
  const [viewingReport, setViewingReport]                       = useState(null);
  const [recentActivity, setRecentActivity]                     = useState([]);
  const [coordinatorNames, setCoordinatorNames]                  = useState({});
  const [showActivityDropdown, setShowActivityDropdown]         = useState(false);

  // ── Load reports from Firestore in real-time ───────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // ── Map company name -> industry, so reports (which only store a company
  //    name, not an id) can be scoped to this coordinator's assigned industries ──
  const [companyIndustryMap, setCompanyIndustryMap]              = useState({});
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "companies"), (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const name = data?.companyName || data?.name;
        if (name) map[name] = Array.isArray(data.industry) ? data.industry : (data.industry ? [data.industry] : []);
      });
      setCompanyIndustryMap(map);
    }, (err) => console.error("Failed to load company industries:", err));
    return unsub;
  }, []);

  // Reports scoped to this coordinator's assigned industries (via the
  // reported company's industry). Used for both the notification dropdown
  // and the full Report Company list.
  const scopedReports = React.useMemo(() => {
    if (coordinatorIndustries.length === 0) return reports; // fail open until scope is loaded
    return reports.filter(r => {
      const ind = companyIndustryMap[r.company];
      if (!ind || ind.length === 0) return true; // unknown company — fail open rather than hide
      return ind.some(i => coordinatorIndustries.includes(i));
    });
  }, [reports, companyIndustryMap, coordinatorIndustries]);


  // ── Load the shared activity log — every coordinator's actions, newest first ──
  useEffect(() => {
    const q = query(
      collection(db, "activity_logs"),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecentActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Failed to load activity log:", err));
    return unsub;
  }, []);

  // ── Look up every coordinator's name + department scope once, so the
  //    activity table can show who did what — and be filtered to only show
  //    coordinators whose scope overlaps with the current coordinator's. ────
  const [coordinatorScopes, setCoordinatorScopes]                = useState({});
  useEffect(() => {
    getDocs(collection(db, "coordinators")).then(snap => {
      const namesMap = {};
      const scopesMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        namesMap[d.id]  = data?.name || "Unknown";
        scopesMap[d.id] = getAssignedCollegeKeys(data?.deptSelections);
      });
      setCoordinatorNames(namesMap);
      setCoordinatorScopes(scopesMap);
    }).catch(err => console.error("Failed to load coordinator names:", err));
  }, []);

  // Only show activity from coordinators whose department/college scope
  // overlaps with the current coordinator's own scope.
  const visibleActivity = recentActivity.filter(entry => {
    const actorColleges = coordinatorScopes[entry.coordinatorUid] || [];
    if (coordinatorColleges.length === 0 || actorColleges.length === 0) return true; // fail open until scopes are loaded
    return actorColleges.some(c => coordinatorColleges.includes(c));
  });

  const formatActivityTime = (createdAt) => {
    if (!createdAt?.seconds) return "";
    const diffMs = Date.now() - createdAt.seconds * 1000;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  // ── Notifications: company registrations (scoped to this coordinator's
  //    industries) + reports — kept as a persistent history log rather than
  //    an "action needed" queue, so items stay listed after being
  //    approved/declined/resolved instead of disappearing. ────────────────
  const [scopedCompanies, setScopedCompanies]                    = useState([]);
  useEffect(() => {
    if (coordinatorIndustries.length === 0) { setScopedCompanies([]); return; }
    const q = query(
      collection(db, "companies"),
      where("industry", "array-contains-any", coordinatorIndustries.slice(0, 30))
    );
    const unsub = onSnapshot(q, (snap) => {
      setScopedCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Failed to load companies for notifications:", err));
    return unsub;
  }, [coordinatorIndustries]);

  const coordinatorNotifications = React.useMemo(() => {
    const fromCompanies = scopedCompanies.map(c => ({
      id: `company_${c.id}`,
      message: `${c.companyName || c.name || "A company"} registered and is awaiting review.`,
      createdAt: c.createdAt,
      kind: "company",
      companyId: c.id,
    }));
    const fromReports = scopedReports.map(r => ({
      id: `report_${r.id}`,
      message: `New report submitted for ${r.company}.`,
      createdAt: r.createdAt,
      kind: "report",
      reportId: r.id,
    }));
    return [...fromCompanies, ...fromReports]
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 30);
  }, [scopedCompanies, scopedReports]);

  const [showNotifDropdown, setShowNotifDropdown]                = useState(false);
  const [lastSeenNotifAt, setLastSeenNotifAt]                    = useState(() =>
    Number(localStorage.getItem(`ojtern_coord_notif_seen_${user?.uid || ""}`)) || 0
  );
  const unreadNotifCount = coordinatorNotifications.filter(
    n => (n.createdAt?.seconds || 0) * 1000 > lastSeenNotifAt
  ).length;

  const handleToggleNotifDropdown = () => {
    setShowNotifDropdown(prev => {
      const next = !prev;
      if (next) {
        const now = Date.now();
        localStorage.setItem(`ojtern_coord_notif_seen_${user?.uid || ""}`, String(now));
        setLastSeenNotifAt(now);
      }
      return next;
    });
  };

  const [messageTarget, setMessageTarget]                       = useState(null);
  const [placementTargetCompanyId, setPlacementTargetCompanyId] = useState(null);
  const [dashboardCompanyId, setDashboardCompanyId]             = useState(null);
  const [dashboardTarget, setDashboardTarget]                   = useState(null);
  const [showChangePass, setShowChangePass] = useState(!user?.passwordChanged);
  const [showEditInfo,   setShowEditInfo]   = useState(!!user?.passwordChanged && !user?.profileComplete);
  const [currentPass, setCurrentPass]       = useState("");
  const [newPass, setNewPass]               = useState("");
  const [confirmPass, setConfirmPass]       = useState("");
  const [passError, setPassError]           = useState("");
  const [passLoading, setPassLoading]       = useState(false);
  const [showNew, setShowNew]               = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);

  const handleChangePassword = async () => {
    setPassError("");
    if (!currentPass) { setPassError("Please enter your current password."); return; }
    if (!newPass) { setPassError("Please enter a new password."); return; }
    if (newPass.length < 8) { setPassError("Password must be at least 8 characters."); return; }
    if (newPass !== confirmPass) { setPassError("Passwords do not match."); return; }
    setPassLoading(true);
    try {
      await changePassword(currentPass, newPass, "coordinators", user?.uid);
      await logOut();
      onLogout?.();
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setPassError("Incorrect current password.");
      } else {
        setPassError(err.message || "Failed to change password.");
      }
    } finally {
      setPassLoading(false);
    }
  };
  

  // Close drawer when resizing to desktop
  useEffect(() => { if (isDesktop) setDrawerOpen(false); }, [isDesktop]);

  useEffect(() => {
    if (!user?.uid) return;
    try { localStorage.setItem(`recentVisited_coord_${user.uid}`, JSON.stringify(recentVisited)); } catch {}
  }, [recentVisited, user?.uid]);

  const navigate = (key) => { setActiveNav(key); setDrawerOpen(false); };

  // Always keep sessionStorage in sync with activeNav — more reliable than saving only in navigate()
  useEffect(() => {
    sessionStorage.setItem("ojtern_coord_nav", activeNav);
  }, [activeNav]);

  const handleReportSubmit = () => {}; // Firestore onSnapshot auto-updates the reports list

  const trackVisit = (id, name) => {
    if (!id) return;
    setRecentVisited(prev => {
      const filtered = prev.filter(c => c.id !== id);
      return [{ id, name: name || id, visitedAt: Date.now() }, ...filtered].slice(0, 5);
    });
  };


  const handleMessageNow = (company) => {
    setMessageTarget({ id: company.companyId || company.id, name: company.companyName || company.name });
    navigate("messages");
  };

  useEffect(() => {
    if (activeNav !== "messages") setMessageTarget(null);
  }, [activeNav]);

  const handleViewCompany = (companyId) => {
    setDashboardCompanyId(companyId);
    setDashboardTarget("findcompany");
    navigate("findcompany");
  };

  const handleViewRegistered = (companyId) => {
    setDashboardCompanyId(companyId);
    setDashboardTarget("companylist");
    navigate("companylist");
  };

  // Routes a notification tap to the right screen: a pending company
  // registration opens that company in the Company List (where it can be
  // reviewed/approved), a report opens its detail modal via ReportCompany.
  const handleNotificationClick = (n) => {
    setShowNotifDropdown(false);
    if (n.kind === "company" && n.companyId) {
      handleViewRegistered(n.companyId);
    } else if (n.kind === "report" && n.reportId) {
      const report = scopedReports.find(r => r.id === n.reportId);
      navigate("reportcompany");
      if (report) setViewingReport(report);
    }
  };

  const renderContent = () => {
    if (activeNav === "dashboard") return (
      <DashboardContent
        coordinatorUid={user?.uid}
        coordinatorColleges={coordinatorColleges}
        coordinatorIndustries={coordinatorIndustries}
        onNavigate={navigate}
        onViewCompany={handleViewCompany}
        onViewRegistered={handleViewRegistered}
        recentVisited={recentVisited}
      />
    );

    if (activeNav === "findcompany") return (
      <CoordinatorViewCompanyScreen
        onReportSubmit={handleReportSubmit}
        onNavigateToReports={() => navigate("reportcompany")}
        onMessageNow={handleMessageNow}
        initialCompanyId={dashboardTarget === "findcompany" ? dashboardCompanyId : placementTargetCompanyId}
        onClearInitialCompany={() => {
          setDashboardCompanyId(null);
          setDashboardTarget(null);
          setPlacementTargetCompanyId(null);
        }}
        coordinator={user}
        onVisitCompany={({ id, name }) => trackVisit(id, name)}
      />
    );

    if (activeNav === "studentsaccount") return (
      <CoordinatorStudentsAcccountScreen
        coordinatorUid={user?.uid}
        coordinatorColleges={coordinatorColleges}
      />
    );

    if (activeNav === "studentlist") return (
      <CoordinatorStudentListScreen
        coordinatorColleges={coordinatorColleges}
        onNavigateToCompany={(companyId) => {
          setPlacementTargetCompanyId(companyId);
          navigate("findcompany");
        }}
      />
    );

    if (activeNav === "companylist") return (
      <CoordinatorCompanyListScreen
        coordinatorUid={user?.uid}
        initialCompanyId={dashboardTarget === "companylist" ? dashboardCompanyId : null}
        onClearInitialCompany={() => { setDashboardCompanyId(null); setDashboardTarget(null); }}
        onBackToOrigin={() => navigate("dashboard")}
      />
    );

    if (activeNav === "messages") return (
      <CoordinatorMessagesScreen
        user={user}
        onReportSubmit={handleReportSubmit}
        onNavigateToReports={() => navigate("reportcompany")}
        openContact={messageTarget}
        onContactOpened={() => setMessageTarget(null)}
      />
    );

    if (activeNav === "accountprofile") return <CoordinatorAccountProfileScreen user={user} onLogout={onLogout} />;
    if (activeNav === "about")          return <AboutScreen />;

    if (activeNav === "reportcompany") return (
      <CoordinatorReportCompanyScreen
        reports={scopedReports}
        onViewReport={(r) => setViewingReport(r)}
      />
    );
  };

  const currentLabel = navItems.find(n => n.key === activeNav)?.label ?? "";

  return (
    <>
      <FontImport />
      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
      <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── Top Navbar ── */}
        <div style={{
          height: "70px", flexShrink: 0, zIndex: 100,
          background: `linear-gradient(90deg, ${red} 0%, ${darkRed} 100%)`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Hamburger — only on mobile / tablet */}
            {showDrawer && (
              <button className="hamburger-btn" onClick={() => setDrawerOpen(o => !o)} aria-label="Toggle menu">
                <span /><span /><span />
              </button>
            )}
            <img src={logo} alt="OJTern" style={{ width: "46px", height: "46px", objectFit: "contain" }} />
            <span style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "clamp(1.1rem, 3vw, 1.5rem)", color: "white", letterSpacing: "0.03em" }}>
              OJTern
            </span>
            {/* Current page label — mobile only */}
            {isMobile && (
              <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1rem", color: "rgba(255,255,255,0.75)", marginLeft: "4px" }}>
                / {currentLabel}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {/* Activity Log */}
            <div style={{ position: "relative" }}>
              <div style={{ cursor: "pointer", padding: "8px" }} onClick={() => setShowActivityDropdown(prev => !prev)} title="Activity Log">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 7v5l3 3"/>
                </svg>
              </div>
              {showActivityDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowActivityDropdown(false)} />
                  <div style={{
                    position: "absolute", top: "48px", right: 0, width: "min(560px, 90vw)", maxHeight: "420px",
                    overflowY: "auto", background: "white", border: `1px solid ${darkRed}`,
                    borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
                  }}>
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid #eee", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.05rem", color: darkRed, position: "sticky", top: 0, background: "white" }}>
                      Activity Log
                    </div>
                    {visibleActivity.length === 0 ? (
                      <div style={{ padding: "24px 14px", textAlign: "center", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#888" }}>
                        No recent activity yet.
                      </div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Kufam', sans-serif" }}>
                        <thead>
                          <tr style={{ background: "#f5f5f5" }}>
                            <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: "#888", fontWeight: 600 }}>Activity</th>
                            <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: "#888", fontWeight: 600, whiteSpace: "nowrap" }}>Date</th>
                            <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: "#888", fontWeight: 600, whiteSpace: "nowrap" }}>Coordinator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleActivity.map(entry => (
                            <tr key={entry.id} style={{ borderTop: "1px solid #f2f2f2" }}>
                              <td style={{ padding: "9px 12px", fontSize: "0.8rem", color: "#333" }}>{entry.description}</td>
                              <td style={{ padding: "9px 12px", fontSize: "0.74rem", color: "#999", whiteSpace: "nowrap" }}>{formatActivityTime(entry.createdAt)}</td>
                              <td style={{ padding: "9px 12px", fontSize: "0.78rem", color: "#555", whiteSpace: "nowrap" }}>{coordinatorNames[entry.coordinatorUid] || "Unknown"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <div style={{ position: "relative" }}>
              <div style={{ cursor: "pointer", padding: "8px", position: "relative" }} onClick={handleToggleNotifDropdown}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadNotifCount > 0 && (
                  <span style={{
                    position: "absolute", top: "4px", right: "4px",
                    background: "#e63946", color: "white", borderRadius: "50%",
                    minWidth: "16px", height: "16px", fontSize: "0.65rem",
                    fontFamily: "'Kufam', sans-serif", fontWeight: "bold",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 3px", lineHeight: 1,
                  }}>
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </div>
              {showNotifDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowNotifDropdown(false)} />
                  <div style={{
                    position: "absolute", top: "48px", right: 0, width: "320px", maxHeight: "400px",
                    overflowY: "auto", background: "white", border: `1px solid ${darkRed}`,
                    borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
                  }}>
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid #eee", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.05rem", color: darkRed }}>
                      Notifications
                    </div>
                    {coordinatorNotifications.length === 0 ? (
                      <div style={{ padding: "24px 14px", textAlign: "center", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#888" }}>
                        No notifications yet.
                      </div>
                    ) : (
                      coordinatorNotifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          style={{ padding: "10px 14px", borderBottom: "1px solid #f2f2f2", fontFamily: "'Kufam', sans-serif", cursor: "pointer" }}
                        >
                          <p style={{ margin: 0, fontSize: "0.82rem", color: "#333", lineHeight: 1.4 }}>{n.message}</p>
                          <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "#999" }}>{formatActivityTime(n.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* About */}
            <div style={{ cursor: "pointer", padding: "8px" }} onClick={() => navigate("about")} title="About">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8h.01"/>
                <path d="M11 12h1v4h1"/>
              </svg>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>

          {/* Desktop static sidebar */}
          {isDesktop && (
            <div className="sidebar-static">
              <SidebarNav activeNav={activeNav} onNavigate={navigate} onLogout={handleLogoutClick} />
            </div>
          )}

          {/* Mobile / Tablet drawer */}
          {showDrawer && (
            <>
              <div
                className={`sidebar-overlay ${drawerOpen ? "open" : ""}`}
                onClick={() => setDrawerOpen(false)}
              />
              <div className={`sidebar-drawer ${drawerOpen ? "open" : ""}`}>
                {/* Drawer header */}
                <div style={{
                  background: `linear-gradient(90deg, ${red} 0%, ${darkRed} 100%)`,
                  padding: "14px 20px", flexShrink: 0,
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <img src={logo} alt="OJTern" style={{ width: "36px", height: "36px", objectFit: "contain" }} />
                  <span style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "1.2rem", color: "white" }}>OJTern</span>
                </div>
                <SidebarNav activeNav={activeNav} onNavigate={navigate} onLogout={handleLogoutClick} />
              </div>
            </>
          )}

          {/* Main content */}
          <div className="main-content">
            {renderContent()}
          </div>
        </div>
      </div>

      {viewingReport && (
        <ReportDetailModal report={viewingReport} onClose={() => setViewingReport(null)} coordinatorUid={user?.uid} />
      )}

      {/* ── Forced first-login flow: reset password, then complete profile ── */}
      <ChangePasswordModal
        show={showChangePass}
        currentPass={currentPass} setCurrentPass={setCurrentPass}
        newPass={newPass} setNewPass={setNewPass}
        confirmPass={confirmPass} setConfirmPass={setConfirmPass}
        passError={passError} setPassError={setPassError}
        passLoading={passLoading} handleChangePassword={handleChangePassword}
        showNew={showNew} setShowNew={setShowNew}
        showConfirm={showConfirm} setShowConfirm={setShowConfirm}
      />
      {showEditInfo && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}>
          <div style={{
            width: "100%", maxWidth: "520px",
            height: "85vh",
            background: "#590101",
            borderRadius: "24px",
            overflow: "hidden",
            display: "flex", flexDirection: "column",
            boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          }}>
            <ResponsiveStyles />
            <PersonalInfoScreen
              user={user}
              mandatory
              onSaved={() => setShowEditInfo(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

const ChangePasswordModal = ({ show, currentPass, setCurrentPass, newPass, setNewPass, confirmPass, setConfirmPass, passError, setPassError, passLoading, handleChangePassword, showNew, setShowNew, showConfirm, setShowConfirm }) => {
  const [showCurrent, setShowCurrent] = useState(false);

  if (!show) return null;

  const inputStyle = (hasError) => ({
    width: "100%", padding: "10px 44px 10px 16px", background: "#590101",
    border: hasError ? "1.5px solid red" : "none", borderRadius: "20px",
    color: "white", fontSize: "0.88rem", fontFamily: "'Kufam', sans-serif",
    outline: "none", boxSizing: "border-box",
  });

  const EyeBtn = ({ show: s, onToggle }) => (
    <span onClick={onToggle} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {s ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
      </svg>
    </span>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "white", borderRadius: "24px", border: "2px solid #1a1a1a", overflow: "hidden", width: "100%", maxWidth: "370px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#8B0000", padding: "14px", textAlign: "center" }}>
          <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "1.3rem", color: "white", letterSpacing: "0.1em", textTransform: "uppercase" }}>Set New Password!</span>
        </div>
        <div style={{ padding: "20px 24px 28px" }}>
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", textAlign: "center", marginBottom: "16px", lineHeight: 1.6 }}>
            For your security, please change your password before continuing.
          </p>

          {/* Current Password */}
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#333", marginBottom: "4px" }}>Current Password:</p>
          <div style={{ position: "relative", marginBottom: "10px" }}>
            <input type={showCurrent ? "text" : "password"} placeholder="Enter Current Password:" value={currentPass}
              onChange={e => { setCurrentPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              style={inputStyle(passError)} />
            <EyeBtn show={showCurrent} onToggle={() => setShowCurrent(p => !p)} />
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "12px 0" }} />

          {/* New Password */}
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#333", marginBottom: "4px" }}>New Password:</p>
          <div style={{ position: "relative", marginBottom: "10px" }}>
            <input type={showNew ? "text" : "password"} placeholder="Enter New Password:" value={newPass}
              onChange={e => { setNewPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              style={inputStyle(passError)} />
            <EyeBtn show={showNew} onToggle={() => setShowNew(p => !p)} />
          </div>

          {/* Confirm New Password */}
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#333", marginBottom: "4px" }}>Confirm New Password:</p>
          <div style={{ position: "relative", marginBottom: "4px" }}>
            <input type={showConfirm ? "text" : "password"} placeholder="Confirm New Password:" value={confirmPass}
              onChange={e => { setConfirmPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              style={inputStyle(passError)} />
            <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(p => !p)} />
          </div>

          {passError && <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "red", margin: "4px 0 8px 4px" }}>⚠️ {passError}</p>}
          <hr style={{ border: "none", borderTop: "1.5px solid #ddd", margin: "16px 0" }} />
          <div style={{ textAlign: "center" }}>
            <button onClick={handleChangePassword} disabled={passLoading}
              style={{ background: "#320000", color: "white", border: "none", borderRadius: "24px", padding: "12px 48px", fontFamily: "'Jua', sans-serif", fontSize: "1.1rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: passLoading ? "not-allowed" : "pointer", opacity: passLoading ? 0.7 : 1 }}>
              {passLoading ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorDashboardScreen;