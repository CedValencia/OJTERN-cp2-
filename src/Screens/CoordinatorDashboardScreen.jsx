import React, { useState, useEffect } from "react";
import { changePassword } from "./AuthService";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

import CoordinatorStudentsAcccountScreen      from "./CoordinatorStudentsAcccountScreen";
import CoordinatorStudentListScreen from "./CoordinatorStudentListScreen";
import CoordinatorCompanyListScreen       from "./CoordinatorCompanyListScreen";
import CoordinatorMessagesScreen          from "./CoordinatorMessagesScreen";
import CoordinatorAccountProfileScreen    from "./CoordinatorAccountProfileScreen";
import CoordinatorViewCompanyScreen       from "./CoordinatorViewCompanyScreen";
import CoordinatorReportCompanyScreen, { ReportDetailModal } from "./CoordinatorReportCompanyScreen";
import AboutScreen from "./AboutScreen";

import logo                 from "../icons/ojtern.png";
import dashboardIcon        from "../icons/dashboard.png";
import viewIcon             from "../icons/view.png";
import companyProfileIcon   from "../icons/companyprofile.png";
import viewCompanyIcon      from "../icons/viewcompany.png";
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
  { key: "viewcompany",       label: "View Company",       icon: viewCompanyIcon },
  { key: "studentsaccount",      label: "Students Account",      icon: studentListIcon },
  { key: "studentlist", label: "Student List", icon: studentPlacementIcon },
  { key: "companylist",       label: "Company List",       icon: companyListIcon },
  { key: "reportcompany",     label: "Report Company",     icon: reportCompanyIcon },
  { key: "messages",          label: "Messages",           icon: messagesIcon },
  { key: "accountprofile",    label: "Account Profile",    icon: accountProfileIcon },
  { key: "about",             label: "About",              icon: aboutIcon },
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
const SidebarNav = ({ activeNav, onNavigate }) => (
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
  </>
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
const DashboardContent = ({ onNavigate, onViewCompany, onViewRegistered, coordinatorUid, recentVisited = [] }) => {
  const [recentRegistered, setRecentRegistered] = React.useState([]);
  const [totalStudents,    setTotalStudents]    = React.useState(null);
  const [deployedStudents, setDeployedStudents] = React.useState(null);

  React.useEffect(() => {
    if (!coordinatorUid) return;

    // 1. Recent approved companies
    const companyQ = query(
      collection(db, "companies"),
      where("status", "==", "approved"),
      limit(5)
    );
    const unsubCompany = onSnapshot(companyQ, (snap) => {
      setRecentRegistered(snap.docs.map(d => ({ id: d.id, name: d.data().companyName })));
    });

    // 2. Total students
    const studentQ = query(collection(db, "students"), where("status", "==", "active"));
    const unsubStudents = onSnapshot(studentQ, (snap) => {
      setTotalStudents(snap.size);
    });

    // 3. Deployed students
    const deployedQ = query(collection(db, "students"), where("companyId", "!=", null));
    const unsubDeployed = onSnapshot(deployedQ, (snap) => {
      setDeployedStudents(snap.size);
    });

    return () => { unsubCompany(); unsubStudents(); unsubDeployed(); };
  }, [coordinatorUid]);

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
              label="Deployed Students"
              value={deployedStudents}
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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recentVisited, setRecentVisited] = useState(() => {
    if (!user?.uid) return [];
    try {
      const stored = localStorage.getItem(`recentVisited_coord_${user.uid}`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [activeNav, setActiveNav]                               = useState("dashboard");
  const [reports, setReports]                                   = useState([]);
  const [viewingReport, setViewingReport]                       = useState(null);
  const [messageTarget, setMessageTarget]                       = useState(null);
  const [placementTargetCompanyId, setPlacementTargetCompanyId] = useState(null);
  const [dashboardCompanyId, setDashboardCompanyId]             = useState(null);
  const [dashboardTarget, setDashboardTarget]                   = useState(null);
  const [showChangePass, setShowChangePass]                     = useState(!user?.passwordChanged);
  const [newPass, setNewPass]                                   = useState("");
  const [confirmPass, setConfirmPass]                           = useState("");
  const [passError, setPassError]                               = useState("");
  const [passLoading, setPassLoading]                           = useState(false);
  const [showNew, setShowNew]                                   = useState(false);
  const [showConfirm, setShowConfirm]                           = useState(false);

  const handleChangePassword = async () => {
    setPassError("");
    if (!newPass) { setPassError("Please enter a new password."); return; }
    if (newPass.length < 8) { setPassError("Password must be at least 8 characters."); return; }
    if (newPass !== confirmPass) { setPassError("Passwords do not match."); return; }
    setPassLoading(true);
    try {
      await changePassword(newPass, "coordinators", user?.uid);
      setShowChangePass(false);
    } catch (err) {
      setPassError(err.message || "Failed to change password.");
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

  const handleReportSubmit = (report) => setReports(prev => [report, ...prev]);

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
    setDashboardTarget("viewcompany");
    navigate("viewcompany");
  };

  const handleViewRegistered = (companyId) => {
    setDashboardCompanyId(companyId);
    setDashboardTarget("companylist");
    navigate("companylist");
  };

  const renderContent = () => {
    if (activeNav === "dashboard") return (
      <DashboardContent
        coordinatorUid={user?.uid}
        onNavigate={navigate}
        onViewCompany={handleViewCompany}
        onViewRegistered={handleViewRegistered}
        recentVisited={recentVisited}
      />
    );

    if (activeNav === "viewcompany") return (
      <CoordinatorViewCompanyScreen
        onReportSubmit={handleReportSubmit}
        onNavigateToReports={() => navigate("reportcompany")}
        onMessageNow={handleMessageNow}
        initialCompanyId={dashboardTarget === "viewcompany" ? dashboardCompanyId : placementTargetCompanyId}
        onClearInitialCompany={() => {
          setDashboardCompanyId(null);
          setDashboardTarget(null);
          setPlacementTargetCompanyId(null);
        }}
        coordinator={user}
        onVisitCompany={({ id, name }) => trackVisit(id, name)}
      />
    );

    if (activeNav === "studentsaccount") return <CoordinatorStudentsAcccountScreen coordinatorUid={user?.uid} />;

    if (activeNav === "studentlist") return (
      <CoordinatorStudentListScreen
        onNavigateToCompany={(companyId) => {
          setPlacementTargetCompanyId(companyId);
          navigate("viewcompany");
        }}
      />
    );

    if (activeNav === "companylist") return (
      <CoordinatorCompanyListScreen
        coordinatorUid={user?.uid}
        initialCompanyId={dashboardTarget === "companylist" ? dashboardCompanyId : null}
        onClearInitialCompany={() => { setDashboardCompanyId(null); setDashboardTarget(null); }}
      />
    );

    if (activeNav === "messages") return (
      <CoordinatorMessagesScreen
        user={user}
        onReportSubmit={(report) => {
          handleReportSubmit(report);
          navigate("reportcompany");
        }}
        openContact={messageTarget}
        onContactOpened={() => setMessageTarget(null)}
      />
    );

    if (activeNav === "accountprofile") return <CoordinatorAccountProfileScreen user={user} onLogout={onLogout} />;
    if (activeNav === "about")          return <AboutScreen />;

    if (activeNav === "reportcompany") return (
      <CoordinatorReportCompanyScreen
        reports={reports}
        onViewReport={(r) => setViewingReport(r)}
      />
    );
  };

  const currentLabel = navItems.find(n => n.key === activeNav)?.label ?? "";

  return (
    <>
      <FontImport />
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
          <div style={{ cursor: "pointer", padding: "8px" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>

          {/* Desktop static sidebar */}
          {isDesktop && (
            <div className="sidebar-static">
              <SidebarNav activeNav={activeNav} onNavigate={navigate} />
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
                <SidebarNav activeNav={activeNav} onNavigate={navigate} />
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
        <ReportDetailModal report={viewingReport} onClose={() => setViewingReport(null)} />
      )}
    </>
  );
};

const ChangePasswordModal = ({ show, newPass, setNewPass, confirmPass, setConfirmPass, passError, setPassError, passLoading, handleChangePassword, showNew, setShowNew, showConfirm, setShowConfirm }) => {
  if (!show) return null;
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
          <div style={{ position: "relative", marginBottom: "10px" }}>
            <input type={showNew ? "text" : "password"} placeholder="Enter New Password:" value={newPass}
              onChange={e => { setNewPass(e.target.value); setPassError(""); }}
              style={{ width: "100%", padding: "10px 44px 10px 16px", background: "#590101", border: passError ? "1.5px solid red" : "none", borderRadius: "20px", color: "white", fontSize: "0.88rem", fontFamily: "'Kufam', sans-serif", outline: "none", boxSizing: "border-box" }} />
            <span onClick={() => setShowNew(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showNew ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
              </svg>
            </span>
          </div>
          <div style={{ position: "relative", marginBottom: "4px" }}>
            <input type={showConfirm ? "text" : "password"} placeholder="Confirm New Password:" value={confirmPass}
              onChange={e => { setConfirmPass(e.target.value); setPassError(""); }}
              style={{ width: "100%", padding: "10px 44px 10px 16px", background: "#590101", border: passError ? "1.5px solid red" : "none", borderRadius: "20px", color: "white", fontSize: "0.88rem", fontFamily: "'Kufam', sans-serif", outline: "none", boxSizing: "border-box" }} />
            <span onClick={() => setShowConfirm(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showConfirm ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
              </svg>
            </span>
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