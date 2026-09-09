import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where, orderBy, limit, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { changePassword, logOut } from "./AuthService";
import { useUnreadCount } from "./useChat";
import { color, font, ease } from "./theme";

import StudentFindCompanyScreen, { useOjtPosts } from "./StudentFindCompanyScreen";
import StudentApplicationScreen from "./StudentApplicationScreen";
import StudentMessagesScreen from "./StudentMessagesScreen";
import StudentAccountProfileScreen from "./StudentAccountProfileScreen";
import AboutUsScreen from "./AboutUsScreen";

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
// Same three-tier system as Company/Coordinator dashboards: ink (strongest
// panels, top bar, active nav, primary buttons), steel (mid panels, hover
// states), paper (page background, cards).
const ink       = color.blush50;   // #000000
const inkSoft   = color.blush200;  // #1F1F1F
const inkDeep   = color.blush100;  // #161616
const steel     = "#898989";
const steelSoft = "rgba(137,137,137,0.35)";
const paper     = color.white;     // #FFFFFF
const paperTint = color.wine900;   // #FAFAFA
const paperCard = color.wine800;   // #F2F2F2
const hairline  = color.wine700;   // #EAEAEA
const inkText   = color.ink;       // #141414
const inkMuted  = color.inkMuted;  // #767676

// Every screen uses one UI face — Inter — per theme.js; Monomaniac One is
// reserved for the "OJTern" wordmark only, never for interface text.
const uiFont   = font.ui;
const logoFont = font.logo;

// ── Password strength requirements (mirrors StudentAccountProfileScreen) ───────
const PASSWORD_RULES = [
  { key: "length",    label: "At least 8 characters",                     test: pwd => pwd.length >= 8 },
  { key: "uppercase", label: "At least one uppercase letter (A–Z)",       test: pwd => /[A-Z]/.test(pwd) },
  { key: "lowercase", label: "At least one lowercase letter (a–z)",       test: pwd => /[a-z]/.test(pwd) },
  { key: "number",    label: "At least one number (0–9)",                 test: pwd => /[0-9]/.test(pwd) },
  { key: "special",   label: "At least one special character (!@#$%&*_…)", test: pwd => /[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(pwd) },
  { key: "noSpaces",  label: "No spaces",                                 test: pwd => !/\s/.test(pwd) },
];

const isPasswordStrong = (pwd) => PASSWORD_RULES.every(rule => rule.test(pwd));

const PasswordChecklist = ({ password }) => {
  if (!password) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", margin: "2px 0 12px 2px" }}>
      {PASSWORD_RULES.map(rule => {
        const passed = rule.test(password);
        return (
          <div key={rule.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: passed ? color.success : color.danger, width: "12px", flexShrink: 0 }}>
              {passed ? "✓" : "✗"}
            </span>
            <span style={{ fontFamily: uiFont, fontSize: "0.74rem", color: passed ? color.success : inkMuted }}>
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Monomaniac+One&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: ${steel}; border-radius: 4px; transition: background 0.2s ${ease}; }
    ::-webkit-scrollbar-thumb:hover { background: ${ink}; }
    ::-webkit-scrollbar-track { background: ${paperCard}; }

    @keyframes welcomeIn {
      0%   { opacity: 0; transform: translateY(14px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .welcome-animate {
      animation: welcomeIn 0.5s cubic-bezier(.16,1,.3,1);
    }

    .snav-item {
      position: relative;
      margin: 4px 12px;
      padding-left: 4px;
      border-radius: 14px;
      transition: background 0.18s ${ease}, box-shadow 0.18s ${ease}, transform 0.1s ${ease};
    }
    .snav-item::before {
      content: "";
      position: absolute; left: -12px; top: 50%;
      width: 3px; height: 0;
      background: ${ink};
      border-radius: 0 3px 3px 0;
      transform: translateY(-50%);
      transition: height 0.18s ${ease};
    }
    .snav-item:hover  { background: ${paperCard}; }
    .snav-item.active { background: ${ink}; box-shadow: 0 6px 16px rgba(20,20,20,0.18); }
    .snav-item.active::before { height: 22px; }
    .snav-item:active { transform: scale(0.98); }
    .snav-item .nav-icon,
    .snav-item .nav-label { transition: opacity 0.18s ${ease}, color 0.16s ${ease}; }
    .snav-item.active .nav-label {
      color: ${paper} !important;
      font-weight: 600 !important;
      letter-spacing: 0.01em;
    }
    .snav-item.active .nav-icon { filter: brightness(0) invert(1); }

    .snav-logout {
      margin: 4px 12px 14px;
      padding-left: 4px;
      border-radius: 14px;
      transition: background 0.18s ${ease}, transform 0.1s ${ease};
    }
    .snav-logout:hover  { background: ${paperCard}; }
    .snav-logout:active { transform: scale(0.98); }

    @keyframes badgePop {
      0%   { transform: scale(0.5); opacity: 0; }
      70%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); }
    }
    .nav-badge { animation: badgePop 0.25s ${ease}; box-shadow: 0 2px 6px rgba(20,20,20,0.25); }

    .company-row { transition: background 0.15s; cursor: pointer; }
    .company-row:hover { background: ${hairline} !important; }
    .visited-row { transition: background 0.15s; cursor: pointer; }
    .visited-row:hover { background: ${hairline} !important; }
    .app-row { transition: background 0.15s; cursor: pointer; }
    .app-row:hover { background: ${hairline} !important; }

    .topbar-icon-btn { transition: background 0.18s ${ease}, transform 0.12s ${ease}; border-radius: 999px; }
    .topbar-icon-btn:hover { background: rgba(255,255,255,0.14); }
    .topbar-icon-btn:active { transform: scale(0.94); }

    .stat-view-btn { transition: transform 0.18s ${ease}; }
    .stat-view-btn:hover { transform: scale(1.08); }

    .pill-btn { transition: filter 0.18s ${ease}, transform 0.12s ${ease}, box-shadow 0.18s ${ease}; }
    .pill-btn:hover { filter: brightness(1.25); }
    .pill-btn:active { transform: scale(0.97); }

    .notif-row { transition: background 0.15s ${ease}; }
    .notif-row:hover { background: ${paperCard} !important; }

    /* ── Slide-in drawer ── */
    .ssidebar-drawer {
      position: fixed; top: 0; left: 0;
      height: 100%; width: 260px; z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      background: ${paper}; border-right: 1px solid ${hairline};
      overflow-y: auto; display: flex; flex-direction: column;
    }
    .ssidebar-drawer.open { transform: translateX(0); }

    .ssidebar-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.35); z-index: 199;
      transition: opacity 0.2s ${ease};
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
      font-family: ${uiFont};
      font-weight: 600;
      font-size: clamp(1.9rem, 5vw, 3.4rem);
      color: ${ink};
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .welcome-sub {
      font-family: ${uiFont};
      font-weight: 400;
      font-size: clamp(0.9rem, 2.2vw, 1.15rem);
      color: ${inkMuted};
    }

    /* ── Card section header ── */
    .scard-header {
      padding: 14px 18px 12px 15px;
      border-bottom: 3px solid ${hairline};
    }
    .scard-header span {
      font-family: ${uiFont};
      font-weight: 600;
      font-size: clamp(0.85rem, 2vw, 0.98rem);
      color: ${inkText};
      letter-spacing: -0.01em;
    }

    /* ── Cards: recessed panel resting state + quiet lift on hover ── */
    .sdash-card {
      transition: transform 0.2s ${ease}, box-shadow 0.2s ${ease};
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.10);
    }
    .sdash-card:hover { transform: translateY(-3px); box-shadow: inset 0 2px 8px rgba(0,0,0,0.10), 0 10px 28px rgba(20,20,20,0.10); }

    /* ── Desktop static sidebar ── */
    @media (min-width: 1024px) {
      .ssidebar-static {
        width: 260px; flex-shrink: 0;
        background: ${paper};
        display: flex; flex-direction: column;
        overflow-y: auto; border-right: 1px solid ${hairline};
      }
    }

    /* ── Hamburger ── */
    .hamburger-btn {
      background: none; border: none; cursor: pointer;
      padding: 6px; display: flex; flex-direction: column; gap: 5px;
      -webkit-tap-highlight-color: transparent;
      border-radius: 999px; transition: background 0.18s ${ease};
    }
    .hamburger-btn:hover { background: rgba(255,255,255,0.14); }
    .hamburger-btn span {
      display: block; width: 24px; height: 2px;
      background: white; border-radius: 2px; transition: all 0.2s ${ease};
    }

    /* ── Main content ── */
    .smain-content {
      flex: 1; display: flex; flex-direction: column;
      overflow-y: auto; background: ${paperTint}; min-width: 0; min-height: 0;
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
];

// ── Shared sub-components ──────────────────────────────────────────────────────
// Chip-style avatar (raised, boxed) — matches CompanyAvatar in the
// Coordinator/Company dashboards instead of a bare flat icon.
const CompanyAvatar = ({ size = 38 }) => (
  <div style={{
    width: size, height: size, flexShrink: 0, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: paper,
    boxShadow: "0 1px 3px rgba(20,20,20,0.18), 0 1px 2px rgba(20,20,20,0.10)",
  }}>
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

// ── Status badge ───────────────────────────────────────────────────────────────
// Accepted/Declined map to the theme's semantic success/danger colors, same
// pairing used on the Company/Coordinator dashboards.
const StatusBadge = ({ status }) => {
  const cfg = {
    Accepted:       { bg: "#358D5E", text: paper },
    Declined:       { bg: color.danger, text: paper },
    Pending:        { bg: "#c8a800", text: paper },
    "In Review":    { bg: "#353A8D", text: paper },
    "To Interview": { bg: "#7C2889", text: paper },
  }[status] || { bg: steel, text: paper };

  return (
    <div style={{
      background: cfg.bg, color: cfg.text,
      borderRadius: "20px", padding: "5px 18px",
      fontFamily: uiFont, fontWeight: 700,
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
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "8px", padding: "20px",
  }}>
    <span style={{ fontFamily: uiFont, fontSize: "0.95rem", color: inkMuted, textAlign: "center" }}>
      {label}
    </span>
  </div>
);

// ── URL <-> tab mapping ──────────────────────────────────────────────────────
// The active tab now lives in the URL (/student/<key>) instead of
// sessionStorage, so the address bar always matches what's on screen and a
// refresh/back-button/shared link lands on the right tab.
const STUDENT_BASE_PATH = "/student";
const getStudentNavKeyFromPath = (pathname) => {
  const rest = pathname.startsWith(STUDENT_BASE_PATH) ? pathname.slice(STUDENT_BASE_PATH.length) : "";
  const key = rest.replace(/^\/+|\/+$/g, "");
  return key || "dashboard";
};

// ── Sidebar nav list ───────────────────────────────────────────────────────────
const SidebarNavList = ({ activeNav, onNavigate, onLogout, unreadMessages = 0 }) => (
  <>
    <div style={{ padding: "6px 22px 10px", flexShrink: 0 }} />
    {navItems.map((item) => {
      const isActive = activeNav === item.key;
      return (
        <div
          key={item.key}
          className={`snav-item ${isActive ? "active" : ""}`}
          onClick={() => onNavigate(item.key)}
          style={{
            display: "flex", alignItems: "center", gap: "14px",
            padding: "12px 16px", cursor: "pointer", minHeight: "50px",
          }}
        >
          <img
            src={item.icon} alt={item.label} className="nav-icon"
            style={{ width: "24px", height: "24px", objectFit: "contain", flexShrink: 0, opacity: isActive ? 1 : 0.85 }}
          />
          <span className="nav-label" style={{
            fontFamily: uiFont, fontWeight: 500, fontSize: "0.9rem", flex: 1,
            color: isActive ? paper : inkText,
          }}>
            {item.label}
          </span>
          {item.key === "messages" && unreadMessages > 0 && (
            <span key={unreadMessages} className="nav-badge" style={{
              background: isActive ? paper : ink,
              color: isActive ? inkDeep : paper,
              borderRadius: "50%",
              minWidth: "19px", height: "19px", padding: "0 5px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: uiFont, fontSize: "0.7rem", fontWeight: 700,
              flexShrink: 0,
            }}>
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </span>
          )}
        </div>
      );
    })}

    {onLogout && (
      <>
        <div style={{ flex: 1 }} />
        <hr style={{ border: "none", borderTop: `1px solid ${hairline}`, margin: "0 20px 8px" }} />
        <div
          className="snav-logout"
          onClick={onLogout}
          style={{
            display: "flex", alignItems: "center", gap: "14px",
            padding: "12px 16px", cursor: "pointer", minHeight: "50px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "0.9rem", color: ink }}>
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
      background: paper, borderRadius: "20px",
      padding: "36px 32px", width: "clamp(280px, 85vw, 380px)",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: paperCard, display: "flex",
        alignItems: "center", justifyContent: "center", marginBottom: "4px",
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
          stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </div>
      <p style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "1.15rem", color: inkText, margin: 0, textAlign: "center" }}>Log Out</p>
      <p style={{ fontFamily: uiFont, fontSize: "0.9rem", color: inkMuted, margin: 0, textAlign: "center", lineHeight: 1.5 }}>
        Are you sure you want to log out of your account?
      </p>
      <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "8px" }}>
        <button onClick={onCancel} className="pill-btn" style={{
          flex: 1, padding: "12px", borderRadius: "30px",
          border: `1.5px solid ${hairline}`, background: paper,
          fontFamily: uiFont, fontWeight: 600,
          fontSize: "0.95rem", cursor: "pointer", color: inkMuted,
          boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
        }}>Cancel</button>
        <button onClick={onConfirm} className="pill-btn" style={{
          flex: 1, padding: "12px", borderRadius: "30px",
          border: "none", background: ink,
          fontFamily: uiFont, fontWeight: 700,
          fontSize: "0.95rem", cursor: "pointer", color: paper,
          boxShadow: "0 3px 10px rgba(0,0,0,0.5)",
        }}>Log Out</button>
      </div>
    </div>
  </div>
);

// ── Dashboard Content ──────────────────────────────────────────────────────────
const DashboardContent = ({ onNavigate, onViewCompany, recentVisited = [], recentApplications = [] }) => {

  const { posts: allPosts = [] } = useOjtPosts();
  const recommendedCompanies = allPosts.slice(0, 5);

  return (
    <div style={{ padding: "clamp(16px, 4vw, 32px)", overflowY: "auto", flex: 1 }}>

      {/* Welcome banner — container stays static, only the text animates */}
      <div style={{
        background: paperCard, borderRadius: "18px",
        padding: "clamp(20px, 5vw, 30px) clamp(18px, 5vw, 40px)",
        marginBottom: "24px", textAlign: "center",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.07)",
      }}>
        <h1 className="welcome-heading welcome-animate">Welcome to OJTern</h1>
        <p className="welcome-sub welcome-animate">Find the perfect OJT for you!</p>
      </div>

      <hr style={{ border: "none", borderTop: `1.5px solid ${hairline}`, marginBottom: "24px" }} />

      {/* Top grid: 2-col on ≥768px, 1-col below */}
      <div className="sdash-top-grid">

        {/* Recommended OJT Companies */}
        <div className="sdash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
                    background: paperCard, borderRadius: "8px", padding: "7px 10px", marginRight: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <CompanyAvatar size={38} />
                    <span style={{ fontFamily: uiFont, fontSize: "clamp(0.75rem, 2vw, 0.82rem)", color: inkText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
        <div className="sdash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
                    background: paperCard, borderRadius: "8px", padding: "7px 10px", marginRight: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <CompanyAvatar size={38} />
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: uiFont, fontSize: "clamp(0.75rem, 2vw, 0.82rem)", color: inkText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {company.companyName || company.name}
                      </span>
                      {company.visitedAt && <span style={{ fontFamily: uiFont, fontSize: "0.68rem", color: steel, fontWeight: 600 }}>{timeAgo(company.visitedAt)}</span>}
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
      <div className="sdash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden" }}>
        <div className="scard-header"><span>Recent Application</span></div>
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
          {recentApplications.length > 0 ? (
            recentApplications.map((a, i) => (
              <div
                key={i}
                className="app-row"
                onClick={() => onNavigate("application", a.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: paperCard, borderRadius: "8px", padding: "7px 10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <CompanyAvatar size={38} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: uiFont, fontSize: "clamp(0.75rem, 2vw, 0.82rem)", color: inkText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                      {a.companyName || a.name}
                    </span>
                    {a.createdAt && <span style={{ fontFamily: uiFont, fontSize: "0.68rem", color: inkMuted }}>{new Date(a.createdAt.seconds ? a.createdAt.seconds * 1000 : a.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
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
  const routerNavigate = useNavigate();
  const location = useLocation();
  const activeNav = getStudentNavKeyFromPath(location.pathname);

  // Unread-messages badge for the "Messages" nav item — real-time, persisted
  // in Firestore (see useUnreadCount in useChat.js).
  const unreadMessages = useUnreadCount(user?.uid);
  // Recently visited companies now live in Firestore (students/{uid}.recentVisited)
  // instead of localStorage, so the list follows the account across browsers
  // and devices instead of being stuck on whichever one was used to visit.
  const [recentVisited, setRecentVisited] = useState([]);
  const [recentVisitedLoaded, setRecentVisitedLoaded] = useState(false);
  const [recentApplications, setRecentApplications] = useState([]);
  const [notifications, setNotifications]         = useState([]);
  const [showNotifDropdown, setShowNotifDropdown]  = useState(false);

  // Fetch this student's notifications in real-time (application status updates, etc.)
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "notifications"),
      where("studentId", "==", user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(docs);
    }, (err) => {
      console.error("Failed to load notifications:", err);
    });
    return () => unsub();
  }, [user?.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleToggleNotifDropdown = () => {
    setShowNotifDropdown(prev => {
      const next = !prev;
      if (next) {
        // Mark all unread notifications as read when the dropdown is opened
        notifications.filter(n => !n.read).forEach(n => {
          updateDoc(doc(db, "notifications", n.id), { read: true }).catch(err =>
            console.error("Failed to mark notification as read:", err)
          );
        });
      }
      return next;
    });
  };

  const formatNotifTime = (createdAt) => {
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

  // Fetch recent applications from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "applications"),
      where("studentId", "==", user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setRecentApplications(docs.slice(0, 5));
    }, (err) => {
      console.error("Failed to load recent applications:", err);
    });
    return () => unsub();
  }, [user?.uid]);
  const [initialCompanyId, setInitialCompanyId] = useState(null);
  const [applyCompany, setApplyCompany]         = useState(null);
  const [pendingContact, setPendingContact]     = useState(null);
  const [pendingApplicationId, setPendingApplicationId] = useState(null);
  const [showChangePass, setShowChangePass]     = useState(false);
  const [showPassSuccess, setShowPassSuccess]   = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass]                   = useState("");
  const [confirmPass, setConfirmPass]           = useState("");
  const [passError, setPassError]               = useState("");
  const [passLoading, setPassLoading]           = useState(false);
  const [showNew, setShowNew]                   = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);
  const [showCurrent, setShowCurrent]           = useState(false);

  const handleChangePassword = async () => {
    setPassError("");

    if (!currentPass) {
      setPassError("Please enter your current password.");
      return;
    }

    if (!newPass) {
      setPassError("Please enter a new password.");
      return;
    }

    if (!isPasswordStrong(newPass)) {
      setPassError("Password does not meet all the requirements below.");
      return;
    }

    if (newPass !== confirmPass) {
      setPassError("Passwords do not match.");
      return;
    }

    setPassLoading(true);

    try {
      await changePassword(
        currentPass,
        newPass,
        "students",
        user.uid
      );

      setShowPassSuccess(true);

    } catch (err) {
      setPassError(err.message || "Failed to change password.");
        } finally {
      setPassLoading(false);
    }
  };

  // `user` ay null sa unang render pagka-refresh — naka-mount na ang dashboard
  // bago pa dumating ang profile. Ang null ay "hindi pa alam", hindi "hindi pa
  // nagpalit ng password", kaya hinihintay muna bago magpasya. Isang beses lang
  // bawat user (didGateInit), para hindi muling bumukas ang modal matapos
  // i-dismiss o matapos mag-save.
  const didGateInit = useRef(false);
  useEffect(() => {
    if (!user || didGateInit.current) return;
    didGateInit.current = true;
    setShowChangePass(!user.passwordChanged);
  }, [user]);

  const handleReportSubmit = (report) => {
    console.log("Report submitted:", report);
  };

  useEffect(() => { if (isDesktop) setDrawerOpen(false); }, [isDesktop]);

  // Load recent visited companies from Firestore once we know who the user is.
  useEffect(() => {
    if (!user?.uid) { setRecentVisitedLoaded(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "students", user.uid));
        if (cancelled) return;
        const data = snap.data();
        setRecentVisited(Array.isArray(data?.recentVisited) ? data.recentVisited : []);
      } catch (err) {
        console.error("Failed to load recent visited companies:", err);
      } finally {
        if (!cancelled) setRecentVisitedLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  // Persist recent visited companies to Firestore. Gated on recentVisitedLoaded
  // so this doesn't fire with an empty array and wipe out the saved list
  // before the initial Firestore read above has finished.
  useEffect(() => {
    if (!user?.uid || !recentVisitedLoaded) return;
    setDoc(doc(db, "students", user.uid), { recentVisited }, { merge: true })
      .catch((err) => console.error("Failed to save recent visited companies:", err));
  }, [recentVisited, user?.uid, recentVisitedLoaded]);

  const navigate = (key, id = null) => {
    setDrawerOpen(false);
    if (id && key === "application") setPendingApplicationId(id);
    routerNavigate(`${STUDENT_BASE_PATH}/${key}`);
  };

  useEffect(() => {
    if (activeNav !== "application") setPendingApplicationId(null);
  }, [activeNav]);

  const renderContent = () => {
    if (activeNav === "dashboard") {
      return (
        <DashboardContent
          onNavigate={navigate}
          recentVisited={recentVisited}
          recentApplications={recentApplications}
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
    }
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
          setApplyCompany({
            id: company.companyId || company.id,
            companyId: company.companyId || company.id,
            name: company.companyName || company.company || company.name,
          });
          navigate("application");
        }}
        onVisitCompany={({ id, name }) => {
          setRecentVisited(prev => {
            const filtered = prev.filter(c => c.id !== id);
            return [{ id, name, companyName: name, visitedAt: Date.now() }, ...filtered].slice(0, 5);
          });
        }}
      />
    );

    if (activeNav === "application") return (
      <StudentApplicationScreen
        initialCompany={applyCompany}
        onModalClose={() => setApplyCompany(null)}
        user={user}
        openApplicationId={pendingApplicationId}
        onApplicationOpened={() => setPendingApplicationId(null)}
      />
    );

    if (activeNav === "messages") return (
      <StudentMessagesScreen
        user={user}
        openContact={pendingContact} onContactOpened={() => setPendingContact(null)}
        onReportSubmit={handleReportSubmit}
      />
    );

    if (activeNav === "accountprofile") return <StudentAccountProfileScreen user={user} onLogout={onLogout} />;
    if (activeNav === "about")          return <AboutUsScreen onBack={() => navigate("dashboard")} />;
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
          background: `linear-gradient(90deg, ${ink} 0%, ${inkDeep} 100%)`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
            {showDrawer && (
              <button className="hamburger-btn" onClick={() => setDrawerOpen(o => !o)} aria-label="Toggle menu" style={{ flexShrink: 0 }}>
                <span /><span /><span />
              </button>
            )}
            <button onClick={() => navigate("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", padding: "0", flexShrink: 0 }}>
              <img src={logo} alt="OJTern" style={{ width: "40px", height: "40px", objectFit: "contain", flexShrink: 0 }} />
              <span style={{ fontFamily: logoFont, fontSize: "clamp(1.1rem, 3vw, 1.5rem)", color: paper, letterSpacing: "0.03em", flexShrink: 0 }}>
                OJTern
              </span>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <div className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px", position: "relative" }} onClick={handleToggleNotifDropdown}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: "4px", right: "4px",
                    background: paper, color: ink, borderRadius: "50%",
                    minWidth: "16px", height: "16px", fontSize: "0.65rem",
                    fontFamily: uiFont, fontWeight: "bold",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 3px", lineHeight: 1,
                  }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>

              {showNotifDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setShowNotifDropdown(false)} />
                  <div style={(isMobile || isTablet) ? {
                      position: "fixed", top: "76px", right: "12px", width: "min(320px, 88vw)", maxHeight: "min(45vh, 320px)",
                      overflowY: "auto", background: paper, border: `1px solid ${ink}`,
                      borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 999,
                    } : {
                      position: "absolute", top: "50px", right: 0, width: "340px", maxWidth: "88vw",
                      background: paper, borderRadius: "16px", overflow: "hidden",
                      boxShadow: "0 12px 32px rgba(0,0,0,0.28)", border: `1px solid ${hairline}`, zIndex: 999,
                    }}>
                    <div style={{ padding: "16px 18px 12px", background: paper }}>
                      <span style={{ fontFamily: uiFont, fontWeight: 700, fontSize: "1.05rem", color: inkText }}>
                        Notifications
                      </span>
                    </div>
                    <div style={{ maxHeight: "380px", overflowY: "auto" }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: "28px 16px", textAlign: "center" }}>
                          <span style={{ fontFamily: uiFont, fontSize: "0.85rem", color: inkMuted }}>
                            No notifications yet.
                          </span>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            className="notif-row"
                            onClick={() => {
                              setShowNotifDropdown(false);
                              if (n.applicationId) navigate("application", n.applicationId);
                              if (!n.read) {
                                updateDoc(doc(db, "notifications", n.id), { read: true }).catch(err =>
                                  console.error("Failed to mark notification as read:", err)
                                );
                              }
                            }}
                            style={{
                              padding: "14px 18px",
                              borderTop: `1px solid ${hairline}`,
                              cursor: n.applicationId ? "pointer" : "default",
                              background: n.read ? paper : "#F2F2F2",
                            }}
                          >
                            <p style={{ fontFamily: uiFont, fontSize: "0.85rem", fontWeight: 500, color: inkText, lineHeight: 1.4, marginBottom: "5px" }}>
                              {n.message}
                            </p>
                            <p style={{ fontFamily: uiFont, fontSize: "0.75rem", color: inkMuted }}>
                              {formatNotifTime(n.createdAt)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px" }} onClick={() => navigate("about")} title="About">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8h.01"/>
                <path d="M11 12h1v4h1"/>
              </svg>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>

          {/* Desktop static sidebar */}
          {isDesktop && (
            <div className="ssidebar-static">
              <SidebarNavList activeNav={activeNav} onNavigate={navigate} onLogout={handleLogoutClick} unreadMessages={unreadMessages} />
            </div>
          )}

          {/* Mobile / Tablet drawer */}
          {showDrawer && (
            <>
              <div className={`ssidebar-overlay ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
              <div className={`ssidebar-drawer ${drawerOpen ? "open" : ""}`}>
                <button onClick={() => { navigate("dashboard"); setDrawerOpen(false); }} style={{
                  background: `linear-gradient(90deg, ${ink} 0%, ${inkDeep} 100%)`,
                  padding: "14px 20px", flexShrink: 0,
                  display: "flex", alignItems: "center", gap: "10px",
                  border: "none", cursor: "pointer", width: "100%", justifyContent: "flex-start",
                }}>
                  <img src={logo} alt="OJTern" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
                  <span style={{ fontFamily: logoFont, fontSize: "1.2rem", color: paper }}>OJTern</span>
                </button>
                <SidebarNavList activeNav={activeNav} onNavigate={navigate} onLogout={handleLogoutClick} unreadMessages={unreadMessages} />
              </div>
            </>
          )}

          {/* Main content */}
          <div className="smain-content">{renderContent()}</div>
        </div>
      </div>

      {/* ── Password Change Success Modal ── */}
      {showPassSuccess && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}>
          <div style={{
            background: paper, borderRadius: "20px",
            padding: "36px 32px", width: "clamp(280px, 85vw, 380px)",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}>
            <div style={{
              width: "64px", height: "64px", borderRadius: "50%",
              background: "#e8f5e9", display: "flex",
              alignItems: "center", justifyContent: "center", marginBottom: "4px",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="#2d7a2d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{
              fontFamily: uiFont, fontWeight: 700,
              fontSize: "1.15rem", color: inkText, margin: 0, textAlign: "center",
            }}>Password Changed!</p>
            <p style={{
              fontFamily: uiFont, fontSize: "0.9rem",
              color: inkMuted, margin: 0, textAlign: "center", lineHeight: 1.5,
            }}>Your password has been updated successfully. Please log in again with your new password.</p>
            <button onClick={() => {
              setShowPassSuccess(false);
              onLogout();
            }} className="pill-btn" style={{
              width: "100%", padding: "12px", borderRadius: "30px",
              border: "none", background: ink,
              fontFamily: uiFont, fontWeight: 700,
              fontSize: "0.95rem", cursor: "pointer", color: paper,
              boxShadow: "0 3px 10px rgba(0,0,0,0.5)", marginTop: "8px",
            }}>Done</button>
          </div>
        </div>
      )}

      {/* ── Change Password Modal Overlay ── */}
      {showChangePass && !showPassSuccess && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }}>
          <div style={{
            background: paper, borderRadius: "24px",
            border: `2px solid ${ink}`, overflow: "hidden",
            width: "100%", maxWidth: "370px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}>
            <div style={{ background: ink, padding: "14px", textAlign: "center" }}>
              <span style={{ fontFamily: uiFont, fontWeight: 700, fontSize: "1.15rem", color: paper, letterSpacing: "0.02em" }}>
                Set New Password
              </span>
            </div>
            <div style={{ padding: "20px 24px 28px" }}>
              <p style={{ fontFamily: uiFont, fontSize: "0.85rem", color: inkMuted, textAlign: "center", marginBottom: "16px", lineHeight: 1.6 }}>
                For your security, please change your password before continuing.
              </p>
              <div style={{ position: "relative", marginBottom: "10px" }}>
                <input
                  type={showCurrent ? "text" : "password"}
                  placeholder="Current Password:"
                  value={currentPass}
                  onChange={(e) => {
                    setCurrentPass(e.target.value);
                    setPassError("");
                  }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
                  style={{
                    width: "100%",
                    padding: "10px 44px 10px 16px",
                    background: ink,
                    border: passError ? `1.5px solid ${color.danger}` : "none",
                    borderRadius: "20px",
                    color: paper,
                    fontSize: "0.88rem",
                    fontFamily: uiFont,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <span onClick={() => setShowCurrent(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showCurrent ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                  </svg>
                </span>
              </div>
              <div style={{ position: "relative", marginBottom: "10px" }}>
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="Enter New Password:"
                  value={newPass}
                  onChange={e => { setNewPass(e.target.value); setPassError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
                  style={{ width: "100%", padding: "10px 44px 10px 16px", background: ink, border: passError ? `1.5px solid ${color.danger}` : "none", borderRadius: "20px", color: paper, fontSize: "0.88rem", fontFamily: uiFont, outline: "none", boxSizing: "border-box" }}
                />
                <span onClick={() => setShowNew(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showNew ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                  </svg>
                </span>
              </div>

              <PasswordChecklist password={newPass} />

              <div style={{ position: "relative", marginBottom: "4px" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm New Password:"
                  value={confirmPass}
                  onChange={e => { setConfirmPass(e.target.value); setPassError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
                  style={{ width: "100%", padding: "10px 44px 10px 16px", background: ink, border: passError ? `1.5px solid ${color.danger}` : "none", borderRadius: "20px", color: paper, fontSize: "0.88rem", fontFamily: uiFont, outline: "none", boxSizing: "border-box" }}
                />
                <span onClick={() => setShowConfirm(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showConfirm ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                  </svg>
                </span>
              </div>
              {passError && (
                <p style={{ fontFamily: uiFont, fontSize: "0.78rem", color: color.danger, margin: "4px 0 8px 4px" }}>⚠️ {passError}</p>
              )}
              <hr style={{ border: "none", borderTop: `1.5px solid ${hairline}`, margin: "16px 0" }} />
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={handleChangePassword}
                  disabled={passLoading}
                  className="pill-btn"
                  style={{ background: ink, color: paper, border: "none", borderRadius: "24px", padding: "12px 48px", fontFamily: uiFont, fontWeight: 700, fontSize: "1.05rem", letterSpacing: "0.02em", cursor: passLoading ? "not-allowed" : "pointer", opacity: passLoading ? 0.7 : 1 }}
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