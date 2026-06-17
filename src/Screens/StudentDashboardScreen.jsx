import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase";
import { changePassword } from "./AuthService";

import StudentFindCompanyScreen, { useOjtPosts } from "./StudentFindCompanyScreen";
import StudentApplicationScreen from "./StudentApplicationScreen";
import StudentMessagesScreen from "./StudentMessagesScreen";
import StudentAccountProfileScreen from "./StudentAccountProfileScreen";
import AboutScreen from "./AboutScreen";

import logo from "../icons/ojtern.png";
import dashboardIcon      from "../icons/dashboard.png";
import viewIcon           from "../icons/view.png";
import companyProfileIcon from "../icons/companyprofile.png";
import findIcon           from "../icons/find.png";
import applicationIcon    from "../icons/application.png";
import messagesIcon       from "../icons/messages.png";
import accountProfileIcon from "../icons/accountprofile.png";
import aboutIcon          from "../icons/about.png";

// ── Design tokens ──────────────────────────────────────────────────────────────
const red     = "#8B0000";
const darkRed = "#590101";

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

    .snav-item { transition: background 0.15s; }
    .snav-item:hover  { background: rgba(185,185,185,0.7) !important; }
    .snav-item.active { background: rgba(185,185,185,0.7) !important; }

    .company-row { transition: background 0.15s; cursor: pointer; }
    .company-row:hover { background: #c8c8c8 !important; }
    .visited-row { transition: background 0.15s; cursor: pointer; }
    .visited-row:hover { background: #c8c8c8 !important; }
    .app-row { transition: background 0.15s; cursor: pointer; }
    .app-row:hover { background: #c8c8c8 !important; }

    /* ── Slide-in drawer ── */
    .ssidebar-drawer {
      position: fixed; top: 0; left: 0;
      height: 100%; width: 260px; z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      background: #e0e0e0; border-right: 1px solid #ccc;
      overflow-y: auto; display: flex; flex-direction: column;
    }
    .ssidebar-drawer.open { transform: translateX(0); }

    .ssidebar-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.35); z-index: 199;
    }
    .ssidebar-overlay.open { display: block; }

    /* ── Dashboard top grid: 2-col ≥768px, 1-col below ── */
    .sdash-top-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    @media (max-width: 767px) {
      .sdash-top-grid { grid-template-columns: 1fr; }
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
    .scard-header {
      background: #590101;
      padding: 10px 16px;
      border-radius: 14px 14px 0 0;
    }
    .scard-header span {
      font-family: 'Kufam', sans-serif;
      font-weight: bold;
      font-size: clamp(0.82rem, 2vw, 1rem);
      color: white;
    }

    /* ── Desktop static sidebar ── */
    @media (min-width: 1024px) {
      .ssidebar-static {
        width: 260px; flex-shrink: 0;
        background: #e0e0e0;
        display: flex; flex-direction: column;
        overflow-y: auto; border-right: 1px solid #ccc;
      }
    }

    /* ── Hamburger ── */
    .hamburger-btn {
      background: none; border: none; cursor: pointer;
      padding: 6px; display: flex; flex-direction: column; gap: 5px;
      -webkit-tap-highlight-color: transparent;
    }
    .hamburger-btn span {
      display: block; width: 24px; height: 2px;
      background: white; border-radius: 2px; transition: all 0.2s;
    }

    /* ── Main content ── */
    .smain-content {
      flex: 1; display: flex; flex-direction: column;
      overflow-y: auto; background: #f5f5f5; min-width: 0;
    }
  `}</style>
);

// ── Nav items ──────────────────────────────────────────────────────────────────
const navItems = [
  { key: "dashboard",      label: "Dashboard",       icon: dashboardIcon },
  { key: "findcompany",    label: "Find Company",    icon: findIcon },
  { key: "application",    label: "Application",     icon: applicationIcon },
  { key: "messages",       label: "Messages",        icon: messagesIcon },
  { key: "accountprofile", label: "Account Profile", icon: accountProfileIcon },
  { key: "about",          label: "About",           icon: aboutIcon },
];

// ── Shared sub-components ──────────────────────────────────────────────────────
const CompanyAvatar = ({ size = 38 }) => (
  <div style={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <img src={companyProfileIcon} alt="company" style={{ width: size, height: size, objectFit: "contain" }} />
  </div>
);

const ViewBtn = () => (
  <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
    <img src={viewIcon} alt="view" style={{ width: "33px", height: "33px", objectFit: "contain" }} />
  </div>
);

const ArrowBtn = () => (
  <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
    <img src={viewIcon} alt="view" style={{ width: "33px", height: "33px", objectFit: "contain" }} />
  </div>
);

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = {
    Accepted:       { bg: "#2d7a2d", text: "white" },
    Declined:       { bg: darkRed,   text: "white" },
    Pending:        { bg: "#c8a800", text: "white" },
    "In Review":    { bg: "#353A8D", text: "white" },
    "To Interview": { bg: "#7C2889", text: "white" },
  }[status] || { bg: "#aaa", text: "white" };

  return (
    <div style={{
      background: cfg.bg, color: cfg.text,
      borderRadius: "20px", padding: "5px 18px",
      fontFamily: "'Kufam', sans-serif", fontWeight: 700,
      fontSize: "0.78rem", cursor: "pointer", flexShrink: 0,
      minWidth: "90px", textAlign: "center",
    }}>
      {status}
    </div>
  );
};

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

// ── Sidebar nav list ───────────────────────────────────────────────────────────
const SidebarNavList = ({ activeNav, onNavigate }) => (
  <>
    {navItems.map((item) => (
      <div
        key={item.key}
        className={`snav-item ${activeNav === item.key ? "active" : ""}`}
        onClick={() => onNavigate(item.key)}
        style={{
          display: "flex", alignItems: "center", gap: "14px",
          padding: "15px 20px", cursor: "pointer",
          borderBottom: "1px solid #ccc", minHeight: "56px",
          background: activeNav === item.key ? "rgba(185,185,185,0.7)" : "transparent",
        }}
      >
        <img src={item.icon} alt={item.label}
          style={{ width: "30px", height: "30px", objectFit: "contain", flexShrink: 0, opacity: activeNav === item.key ? 1 : 0.35 }} />
        <span style={{ fontFamily: "'Jersey 25'", fontSize: "1.3rem", color: "#000000", opacity: activeNav === item.key ? 1 : 0.6, fontWeight: "400" }}>
          {item.label}
        </span>
      </div>
    ))}
  </>
);

// ── Dashboard Content ──────────────────────────────────────────────────────────
const DashboardContent = ({ onNavigate, onViewCompany, recentVisited, recentApplications }) => {
  const { posts: allPosts } = useOjtPosts();
  const recommendedCompanies = allPosts.slice(0, 5);

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

      {/* Top grid: 2-col on ≥768px, 1-col below */}
      <div className="sdash-top-grid">

        {/* Recommended OJT Companies */}
        <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="scard-header"><span>Recommended OJT Companies</span></div>
          <div style={{ padding: "10px 0 10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto" }}>
            {recommendedCompanies.length > 0 ? (
              recommendedCompanies.map((company, i) => (
                <div
                  key={i}
                  className="company-row"
                  onClick={() => onViewCompany(company.id, company)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "#d8d8d8", borderRadius: "8px", padding: "7px 10px", marginRight: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <CompanyAvatar size={38} />
                    <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.75rem, 2vw, 0.82rem)", color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {company.companyName || company.company || company.name}
                    </span>
                  </div>
                  <ViewBtn />
                </div>
              ))
            ) : (
              <EmptyListPlaceholder label="No recommended companies yet" />
            )}
          </div>
        </div>

        {/* Recent Visited Company Profiles */}
        <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="scard-header"><span>Recent Visited Company Profiles</span></div>
          <div style={{ padding: "10px 0 10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto" }}>
            {recentVisited.length > 0 ? (
              recentVisited.map((company, i) => (
                <div
                  key={i}
                  className="visited-row"
                  onClick={() => onViewCompany(company.id, company)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "#d8d8d8", borderRadius: "8px", padding: "7px 10px", marginRight: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <CompanyAvatar size={38} />
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.75rem, 2vw, 0.82rem)", color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {company.companyName || company.name}
                      </span>
                      {company.visitedAt && <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.68rem", color: "#999" }}>{new Date(company.visitedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                  </div>
                  <ArrowBtn />
                </div>
              ))
            ) : (
              <EmptyListPlaceholder label="No recently visited companies" />
            )}
          </div>
        </div>
      </div>

      {/* Recent Application */}
      <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "hidden" }}>
        <div className="scard-header"><span>Recent Application</span></div>
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
          {recentApplications.length > 0 ? (
            recentApplications.map((a, i) => (
              <div
                key={i}
                className="app-row"
                onClick={() => onNavigate("application")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#d8d8d8", borderRadius: "8px", padding: "7px 10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <CompanyAvatar size={38} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.75rem, 2vw, 0.82rem)", color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                      {a.companyName || a.name}
                    </span>
                    {a.appliedAt && <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.68rem", color: "#999" }}>{new Date(a.appliedAt.seconds ? a.appliedAt.seconds * 1000 : a.appliedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))
          ) : (
            <EmptyListPlaceholder label="No recent applications" />
          )}
        </div>
      </div>

    </div>
  );
};

// ── Main Student Dashboard ─────────────────────────────────────────────────────
const StudentDashboardScreen = ({ user, onLogout }) => {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const showDrawer = isMobile || isTablet;

  const [drawerOpen, setDrawerOpen]             = useState(false);
  const [activeNav, setActiveNav]               = useState("dashboard");
  const [recentVisited, setRecentVisited]       = useState([]);
  const [recentApplications, setRecentApplications] = useState([]);

  // Fetch recent applications from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "applications"),
      where("studentId", "==", user.uid),
      orderBy("appliedAt", "desc"),
      limit(5)
    );
    const unsub = onSnapshot(q, snap => {
      setRecentApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [user?.uid]);
  const [initialCompanyId, setInitialCompanyId] = useState(null);
  const [applyCompany, setApplyCompany]         = useState(null);
  const [pendingContact, setPendingContact]     = useState(null);
  const [showChangePass, setShowChangePass]     = useState(!user?.passwordChanged);
  const [newPass, setNewPass]                   = useState("");
  const [confirmPass, setConfirmPass]           = useState("");
  const [passError, setPassError]               = useState("");
  const [passLoading, setPassLoading]           = useState(false);
  const [showNew, setShowNew]                   = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);

  const handleChangePassword = async () => {
    setPassError("");
    if (!newPass) { setPassError("Please enter a new password."); return; }
    if (newPass.length < 8) { setPassError("Password must be at least 8 characters."); return; }
    if (newPass !== confirmPass) { setPassError("Passwords do not match."); return; }
    setPassLoading(true);
    try {
      await changePassword(newPass, "students", user?.uid);
      setShowChangePass(false);
    } catch (err) {
      setPassError(err.message || "Failed to change password.");
    } finally {
      setPassLoading(false);
    }
  };

  const handleReportSubmit = (report) => {
    console.log("Report submitted:", report);
  };

  useEffect(() => { if (isDesktop) setDrawerOpen(false); }, [isDesktop]);

  const navigate = (key) => { setActiveNav(key); setDrawerOpen(false); };

  const renderContent = () => {
    if (activeNav === "dashboard") return (
      <DashboardContent
        onNavigate={navigate}
        onViewCompany={(id, company) => {
          setInitialCompanyId(id);
          if (company) {
            setRecentVisited(prev => {
              const filtered = prev.filter(c => c.id !== id);
              return [{ ...company, visitedAt: Date.now() }, ...filtered].slice(0, 5);
            });
          }
          navigate("findcompany");
        }}
      />
    );

    if (activeNav === "findcompany") return (
      <StudentFindCompanyScreen
        initialCompanyId={initialCompanyId}
        onClearInitialCompany={() => setInitialCompanyId(null)}
        user={user}
        onMessageNow={(company) => {
          setPendingContact({ id: company.companyId || company.id, name: company.companyName || company.name, fromMessageNow: true });
          navigate("messages");
        }}
        onApplyNow={(company) => {
          setApplyCompany({ name: company.name });
          navigate("application");
        }}
      />
    );

    if (activeNav === "application") return (
      <StudentApplicationScreen initialCompany={applyCompany} onModalClose={() => setApplyCompany(null)} />
    );

    if (activeNav === "messages") return (
      <StudentMessagesScreen
        user={user}
        openContact={pendingContact} onContactOpened={() => setPendingContact(null)}
        onReportSubmit={handleReportSubmit}
      />
    );

    if (activeNav === "accountprofile") return <StudentAccountProfileScreen user={user} onLogout={onLogout} />;
    if (activeNav === "about")          return <AboutScreen />;
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
            {showDrawer && (
              <button className="hamburger-btn" onClick={() => setDrawerOpen(o => !o)} aria-label="Toggle menu">
                <span /><span /><span />
              </button>
            )}
            <img src={logo} alt="OJTern" style={{ width: "46px", height: "46px", objectFit: "contain" }} />
            <span style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "clamp(1.1rem, 3vw, 1.5rem)", color: "white", letterSpacing: "0.03em" }}>
              OJTern
            </span>
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
            <div className="ssidebar-static">
              <SidebarNavList activeNav={activeNav} onNavigate={navigate} />
            </div>
          )}

          {/* Mobile / Tablet drawer */}
          {showDrawer && (
            <>
              <div className={`ssidebar-overlay ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
              <div className={`ssidebar-drawer ${drawerOpen ? "open" : ""}`}>
                <div style={{
                  background: `linear-gradient(90deg, ${red} 0%, ${darkRed} 100%)`,
                  padding: "14px 20px", flexShrink: 0,
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <img src={logo} alt="OJTern" style={{ width: "36px", height: "36px", objectFit: "contain" }} />
                  <span style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "1.2rem", color: "white" }}>OJTern</span>
                </div>
                <SidebarNavList activeNav={activeNav} onNavigate={navigate} />
              </div>
            </>
          )}

          {/* Main content */}
          <div className="smain-content">{renderContent()}</div>
        </div>
      </div>

      {/* ── Change Password Modal Overlay ── */}
      {showChangePass && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }}>
          <div style={{
            background: "white", borderRadius: "24px",
            border: "2px solid #1a1a1a", overflow: "hidden",
            width: "100%", maxWidth: "370px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}>
            <div style={{ background: "#8B0000", padding: "14px", textAlign: "center" }}>
              <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "1.3rem", color: "white", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Set New Password!
              </span>
            </div>
            <div style={{ padding: "20px 24px 28px" }}>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", textAlign: "center", marginBottom: "16px", lineHeight: 1.6 }}>
                For your security, please change your password before continuing.
              </p>
              <div style={{ position: "relative", marginBottom: "10px" }}>
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="Enter New Password:"
                  value={newPass}
                  onChange={e => { setNewPass(e.target.value); setPassError(""); }}
                  style={{ width: "100%", padding: "10px 44px 10px 16px", background: "#590101", border: passError ? "1.5px solid red" : "none", borderRadius: "20px", color: "white", fontSize: "0.88rem", fontFamily: "'Kufam', sans-serif", outline: "none", boxSizing: "border-box" }}
                />
                <span onClick={() => setShowNew(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showNew ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                  </svg>
                </span>
              </div>
              <div style={{ position: "relative", marginBottom: "4px" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm New Password:"
                  value={confirmPass}
                  onChange={e => { setConfirmPass(e.target.value); setPassError(""); }}
                  style={{ width: "100%", padding: "10px 44px 10px 16px", background: "#590101", border: passError ? "1.5px solid red" : "none", borderRadius: "20px", color: "white", fontSize: "0.88rem", fontFamily: "'Kufam', sans-serif", outline: "none", boxSizing: "border-box" }}
                />
                <span onClick={() => setShowConfirm(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showConfirm ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                  </svg>
                </span>
              </div>
              {passError && (
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "red", margin: "4px 0 8px 4px" }}>⚠️ {passError}</p>
              )}
              <hr style={{ border: "none", borderTop: "1.5px solid #ddd", margin: "16px 0" }} />
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={handleChangePassword}
                  disabled={passLoading}
                  style={{ background: "#320000", color: "white", border: "none", borderRadius: "24px", padding: "12px 48px", fontFamily: "'Jua', sans-serif", fontSize: "1.1rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: passLoading ? "not-allowed" : "pointer", opacity: passLoading ? 0.7 : 1 }}
                >
                  {passLoading ? "Saving…" : "Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StudentDashboardScreen;