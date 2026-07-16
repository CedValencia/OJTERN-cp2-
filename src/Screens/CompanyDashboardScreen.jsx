import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

import CompanyCreatePostScreen        from "./CompanyCreatePostScreen";
import CompanyApplicantsScreen     from "./CompanyApplicantsScreen";
import CompanyMessageScreen        from "./CompanyMessagesScreen";
import CompanyAccountProfileScreen from "./CompanyAccountProfileScreen";
import AboutScreen                 from "./AboutScreen";

import logo              from "../icons/ojtern.png";
import dashboardIcon     from "../icons/dashboard.png";
import userIcon          from "../icons/user.png";
import viewIcon          from "../icons/view.png";
import postOJTIcon       from "../icons/post.png";
import applicantsIcon    from "../icons/applicants.png";
import messagesIcon      from "../icons/messages.png";
import accountProfileIcon from "../icons/accountprofile.png";
import aboutIcon         from "../icons/about.png";

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

    .cnav-item { transition: background 0.15s; }
    .cnav-item:hover  { background: rgba(185,185,185,0.7) !important; }
    .cnav-item.active { background: rgba(185,185,185,0.9) !important; }

    .applicant-row { transition: background 0.15s; cursor: pointer; }
    .applicant-row:hover { background: #d4d4d4 !important; }

    .post-row { transition: background 0.15s; cursor: pointer; }
    .post-row:hover { background: #d4d4d4 !important; }

    /* ── Slide-in drawer (mobile / tablet) ── */
    .csidebar-drawer {
      position: fixed; top: 0; left: 0;
      height: 100%; width: 260px; z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      background: #e0e0e0; border-right: 1px solid #ccc;
      overflow-y: auto; display: flex; flex-direction: column;
    }
    .csidebar-drawer.open { transform: translateX(0); }

    .csidebar-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.35); z-index: 199;
    }
    .csidebar-overlay.open { display: block; }

    /* ── Dashboard top grid: 2-col ≥768px, 1-col below ── */
    .cdash-top-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    @media (max-width: 767px) {
      .cdash-top-grid { grid-template-columns: 1fr; }
    }

    /* ── Stats inner row ── */
    .cstats-inner {
      display: flex;
      gap: 14px;
      padding: 12px;
      min-height: 220px;
      overflow: visible;
    }
    @media (max-width: 480px) {
      .cstats-inner { flex-direction: column; min-height: unset; }
    }

    /* ── Fluid welcome heading ── */
    .cwelcome-heading {
      font-family: 'Jersey 25', sans-serif;
      font-size: clamp(2.2rem, 6vw, 5.5rem);
      color: #590101;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: -6px;
    }
    .cwelcome-sub {
      font-family: 'Kufam', sans-serif;
      font-size: clamp(0.95rem, 2.5vw, 1.5rem);
      color: #590101;
    }

    /* ── Card section header ── */
    .ccard-header {
      background: #590101;
      padding: 10px 16px;
      border-radius: 14px 14px 0 0;
    }
    .ccard-header span {
      font-family: 'Kufam', sans-serif;
      font-weight: bold;
      font-size: clamp(0.82rem, 2vw, 1rem);
      color: white;
    }

    /* ── Desktop static sidebar ── */
    @media (min-width: 1024px) {
      .csidebar-static {
        width: 260px; flex-shrink: 0;
        background: #e0e0e0;
        display: flex; flex-direction: column;
        overflow-y: auto; border-right: 1px solid #ccc;
      }
    }

    /* ── Hamburger button ── */
    .chamburger-btn {
      background: none; border: none; cursor: pointer;
      padding: 6px; display: flex; flex-direction: column; gap: 5px;
      -webkit-tap-highlight-color: transparent;
    }
    .chamburger-btn span {
      display: block; width: 24px; height: 2px;
      background: white; border-radius: 2px; transition: all 0.2s;
    }

    /* ── Main content area ── */
    .cmain-content {
      flex: 1; display: flex; flex-direction: column;
      overflow-y: auto; background: #f5f5f5; min-width: 0;
    }
  `}</style>
);

// ── Nav items ──────────────────────────────────────────────────────────────────
const navItems = [
  { key: "dashboard",      label: "Dashboard",       icon: dashboardIcon },
  { key: "createpost",        label: "Create Post",        icon: postOJTIcon },
  { key: "applicants",     label: "Applicants",      icon: applicantsIcon },
  { key: "messages",       label: "Messages",        icon: messagesIcon },
  { key: "accountprofile", label: "Account Profile", icon: accountProfileIcon },
  { key: "about",          label: "About",           icon: aboutIcon },
];

// ── Sidebar nav list (reused in static & drawer) ───────────────────────────────
const SidebarNav = ({ activeNav, onNavigate }) => (
  <>
    {navItems.map((item) => (
      <div
        key={item.key}
        className={`cnav-item ${activeNav === item.key ? "active" : ""}`}
        onClick={() => onNavigate(item.key)}
        style={{
          display: "flex", alignItems: "center", gap: "14px",
          padding: "15px 20px", cursor: "pointer",
          borderBottom: "1px solid #ccc", minHeight: "56px",
          background: activeNav === item.key ? "rgba(139,0,0,0.10)" : "transparent",
        }}
      >
        <img
          src={item.icon} alt={item.label}
          style={{ width: "30px", height: "30px", objectFit: "contain", flexShrink: 0, opacity: activeNav === item.key ? 1 : 0.35 }}
        />
        <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", opacity: activeNav === item.key ? 1 : 0.35 }}>
          {item.label}
        </span>
      </div>
    ))}
  </>
);

// ── Stat card ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, bg = "rgba(0,0,0,0.15)", onView }) => (
  <div style={{ flex: 1, background: "transparent", borderRadius: "12px", padding: "2px 16px", display: "flex", flexDirection: "column" }}>
    <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.9rem, 1.8vw, 1.2rem)", color: "#000000", marginBottom: "12px" }}>
      {label}
    </p>
    <div style={{ position: "relative", marginBottom: "35px" }}>
      <div style={{
        background: bg, borderRadius: "8px",
        width: "100%", height: "120px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(2.2rem, 5vw, 4rem)", color: "white" }}>
          {value ?? "—"}
        </span>
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

// ── Status badge ───────────────────────────────────────────────────────────────
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
      borderRadius: "20px", padding: "4px 16px",
      fontFamily: "'Kufam', sans-serif", fontWeight: 700,
      fontSize: "0.78rem", flexShrink: 0,
      minWidth: "90px", textAlign: "center",
    }}>
      {status}
    </div>
  );
};

// ── Empty state placeholder ────────────────────────────────────────────────────
const EmptyListPlaceholder = ({ label = "No data available" }) => (
  <div style={{
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "20px",
  }}>
    <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#aaa", fontStyle: "italic", textAlign: "center" }}>
      {label}
    </span>
  </div>
);

// ── Dashboard Content ──────────────────────────────────────────────────────────
const DashboardContent = ({ onNavigate, applications = [], posts = [] }) => {
  const totalApplicants    = applications.length;
  const acceptedApplicants = applications.filter(a => a.status === "Accepted").length;

  const recentApplicants = [...applications]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 5);

  const recentPosts = posts.slice(0, 5);

  return (
    <div style={{ padding: "clamp(16px, 4vw, 32px)", overflowY: "auto", flex: 1 }}>

      {/* Welcome banner */}
      <div style={{
        background: "#e8e8e8", borderRadius: "18px",
        padding: "clamp(20px, 5vw, 30px) clamp(18px, 5vw, 40px)",
        marginBottom: "24px", textAlign: "center",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.07)",
      }}>
        <h1 className="cwelcome-heading">Welcome to OJTern</h1>
        <p className="cwelcome-sub">Find the perfect OJT for you!</p>
      </div>

      <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "24px" }} />

      {/* Top grid: Company Stats + Recent Posts */}
      <div className="cdash-top-grid">

        {/* Company Stats */}
        <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "visible", display: "flex", flexDirection: "column" }}>
          <div className="ccard-header"><span>Company Stats</span></div>
          <div className="cstats-inner">
            <StatCard
              label="Total Applicants"
              value={totalApplicants}
              bg={darkRed}
              onView={() => onNavigate("applicants")}
            />
            <StatCard
              label="Accepted Applicants"
              value={acceptedApplicants}
              bg="rgba(0,0,0,0.15)"
              onView={() => onNavigate("applicants")}
            />
          </div>
        </div>

        {/* Recent Posts */}
        <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="ccard-header"><span>Recent Post</span></div>
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "240px", overflowY: "auto" }}>
            {recentPosts.length === 0 ? (
              <EmptyListPlaceholder label="No posts yet." />
            ) : recentPosts.map((p, i) => (
              <div
                key={i}
                className="post-row"
                onClick={() => onNavigate("createpost")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#d8d8d8", borderRadius: "8px", padding: "9px 12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.75rem, 2vw, 0.88rem)",
                    color: "#222", fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {p.companyName || "OJT Post"}
                  </p>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#888" }}>
                    {p.industry || ""}{p.createdAt?.seconds ? " • " + new Date(p.createdAt.seconds * 1000).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                  </p>
                </div>
                <span style={{
                  fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem",
                  color: darkRed, fontWeight: 700, flexShrink: 0, marginLeft: "8px",
                }}>
                  {p.slot || 0} slot{p.slot !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Applicants */}
      <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "hidden" }}>
        <div className="ccard-header"><span>Recent Applicants</span></div>
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
          {recentApplicants.length === 0 ? (
            <EmptyListPlaceholder label="No applicants yet." />
          ) : recentApplicants.map((a, i) => (
            <div
              key={i}
              className="applicant-row"
              onClick={() => onNavigate("applicants")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#d8d8d8", borderRadius: "8px", padding: "9px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img src={userIcon} alt="user" style={{ width: 36, height: 36, objectFit: "contain", flexShrink: 0 }} />
                <div style={{ width: "1px", height: "28px", background: "#bbb" }} />
                <span style={{
                  fontFamily: "'Kufam', sans-serif",
                  fontSize: "clamp(0.75rem, 2vw, 0.88rem)",
                  color: "#222", fontWeight: 600,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  maxWidth: "clamp(80px, 20vw, 200px)",
                }}>
                  {[a.firstName, a.middleInitial, a.lastName].filter(Boolean).join(" ") || a.studentName || a.studentFullName || a.name || "Student"}
                </span>
              </div>
              <StatusBadge status={a.status || "Pending"} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main Company Dashboard ─────────────────────────────────────────────────────
const CompanyDashboardScreen = ({ user, onLogout }) => {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const showDrawer = isMobile || isTablet;

  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [activeNav,      setActiveNav]      = useState("dashboard");
  const [applications,   setApplications]   = useState([]);
  const [posts,          setPosts]          = useState([]);
  const [pendingContact, setPendingContact] = useState(null);

  // Close drawer when resizing to desktop
  useEffect(() => { if (isDesktop) setDrawerOpen(false); }, [isDesktop]);

  // Fetch posts
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "ojt_posts"), where("companyId", "==", user.uid));
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error("Posts error:", err));
    return () => unsub();
  }, [user?.uid]);

  // Fetch applications
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "applications"), where("companyId", "==", user.uid));
    const unsub = onSnapshot(q, snap => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error("Applications error:", err));
    return () => unsub();
  }, [user?.uid]);

  const navigate = (key) => { setActiveNav(key); setDrawerOpen(false); };

  const handleNavigateToMessages = (contact) => {
    setPendingContact(contact);
    navigate("messages");
  };

  useEffect(() => {
    if (activeNav !== "messages") setPendingContact(null);
  }, [activeNav]);

  const renderContent = () => {
    switch (activeNav) {
      case "dashboard":
        return <DashboardContent onNavigate={navigate} applications={applications} posts={posts} />;
      case "createpost":
        return <CompanyCreatePostScreen embedded user={user} />;
      case "applicants":
        return <CompanyApplicantsScreen embedded user={user} onNavigateToMessages={handleNavigateToMessages} />;
      case "messages":
        return (
          <CompanyMessageScreen
            user={user}
            openContact={pendingContact}
            onContactOpened={() => setPendingContact(null)}
          />
        );
      case "accountprofile":
        return <CompanyAccountProfileScreen user={user} onLogout={onLogout} />;
      case "about":
        return <AboutScreen />;
      default:
        return <DashboardContent onNavigate={navigate} applications={applications} posts={posts} />;
    }
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
              <button className="chamburger-btn" onClick={() => setDrawerOpen(o => !o)} aria-label="Toggle menu">
                <span /><span /><span />
              </button>
            )}
            <img src={logo} alt="OJTern" style={{ width: "46px", height: "46px", objectFit: "contain" }} />
            <span style={{
              fontFamily: "'Monomaniac One', sans-serif",
              fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
              color: "white", letterSpacing: "0.03em",
            }}>
              OJTern
            </span>
            {/* Current page label — mobile only */}
            {isMobile && (
              <span style={{
                fontFamily: "'Jersey 25', sans-serif",
                fontSize: "1rem", color: "rgba(255,255,255,0.75)", marginLeft: "4px",
              }}>
                / {currentLabel}
              </span>
            )}
          </div>
          <div style={{ cursor: "pointer", padding: "8px" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>

          {/* Desktop static sidebar */}
          {isDesktop && (
            <div className="csidebar-static">
              <SidebarNav activeNav={activeNav} onNavigate={navigate} />
            </div>
          )}

          {/* Mobile / Tablet drawer */}
          {showDrawer && (
            <>
              <div
                className={`csidebar-overlay ${drawerOpen ? "open" : ""}`}
                onClick={() => setDrawerOpen(false)}
              />
              <div className={`csidebar-drawer ${drawerOpen ? "open" : ""}`}>
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
          <div className="cmain-content">
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
};

// ── Named exports kept for backward compatibility ──────────────────────────────
export const Sidebar    = ({ activeNav, setActiveNav }) => <SidebarNav activeNav={activeNav} onNavigate={setActiveNav} />;
export const TopNavBar  = () => (
  <div style={{
    height: "70px", flexShrink: 0,
    background: `linear-gradient(90deg, ${red} 0%, ${darkRed} 100%)`,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <img src={require("../icons/ojtern.png")} alt="OJTern" style={{ width: "46px", height: "46px", objectFit: "contain" }} />
      <span style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "1.5rem", color: "white", letterSpacing: "0.03em" }}>OJTern</span>
    </div>
    <div style={{ cursor: "pointer" }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    </div>
  </div>
);

export default CompanyDashboardScreen;