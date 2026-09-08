import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { changePassword, logOut, getUserProfile } from "./AuthService";
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc, setDoc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { PersonalInfoScreen, ResponsiveStyles } from "./CoordinatorAccountProfileScreen";
import { useUnreadCount } from "./useChat";
import { color, font, ease } from "./theme";

import CoordinatorStudentsAcccountScreen      from "./CoordinatorStudentsAcccountScreen";
import CoordinatorStudentListScreen from "./CoordinatorStudentListScreen";
import CoordinatorCompanyListScreen       from "./CoordinatorCompanyListScreen";
import CoordinatorMessagesScreen          from "./CoordinatorMessagesScreen";
import CoordinatorAccountProfileScreen    from "./CoordinatorAccountProfileScreen";
import CoordinatorViewCompanyScreen       from "./CoordinatorFindCompanyScreen";
import CoordinatorReportCompanyScreen, { ReportDetailModal } from "./CoordinatorReportCompanyScreen";
import AboutUsScreen from "./AboutUsScreen";

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
// Pulled straight from theme.js so this screen shares the app's palette.
// Three-tier system per the current visual direction:
//   · "ink"  (near-black)   — the strongest panels: top bar, section headers,
//                              the active nav item, primary buttons.
//   · "steel" (#898989)     — the mid panels: hover states, secondary stat
//                              boxes, list-row backgrounds.
//   · "paper" (white family) — everything else: page background, cards.
const ink       = color.blush50;   // #000000 — was the #8B0000 "red" accent
const inkSoft   = color.blush200;  // #1F1F1F — gradient / hover partner for ink
const inkDeep   = color.blush100;  // #161616 — was the #590101 "dark red"
const steel     = "#898989";       // mid-tone panels & hover states
const steelSoft = "rgba(137,137,137,0.35)";
const paper     = color.white;     // #FFFFFF
const paperTint = color.wine900;   // #FAFAFA
const paperCard = color.wine800;   // #F2F2F2
const hairline  = color.wine700;   // #EAEAEA
const inkText  = color.ink;        // #141414 body text on light panels
const inkMuted = color.inkMuted;   // #767676

// Every screen uses one UI face — Inter — per theme.js; Monomaniac One is
// reserved for the "OJTern" wordmark only, never for interface text.
const uiFont   = font.ui;
const logoFont = font.logo;

// ── Password strength requirements (mirrors CoordinatorAccountProfileScreen) ───
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
        // Pass/fail state is functional, not brand styling, so it keeps its
        // own semantic colors (theme.color.success / theme.color.danger)
        // rather than the ink/steel/paper panel system.
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
  "College of Hospitality and Tourism Management":    "CHTM",
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Monomaniac+One&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: ${steel}; border-radius: 4px; transition: background 0.2s ${ease}; }
    ::-webkit-scrollbar-thumb:hover { background: ${ink}; }
    ::-webkit-scrollbar-track { background: ${paperCard}; }

    /* Pill-shaped, sits off the edges with real depth on hover/press so it
       reads as a button rather than a static row. Icons stay full opacity
       always — dimming them to indicate "inactive" is what made the whole
       rail look disabled. */
    .nav-item {
      position: relative;
      margin: 4px 12px;
      padding-left: 4px;
      border-radius: 14px;
      transition: background 0.18s ${ease}, box-shadow 0.18s ${ease}, transform 0.1s ${ease};
    }
    .nav-item::before {
      content: "";
      position: absolute;
      left: -12px; top: 50%;
      width: 3px; height: 0;
      background: ${ink};
      border-radius: 0 3px 3px 0;
      transform: translateY(-50%);
      transition: height 0.18s ${ease};
    }
    .nav-item:hover {
      background: ${paperCard};
    }
    .nav-item.active {
      background: ${ink};
      box-shadow: 0 6px 16px rgba(20,20,20,0.18);
    }
    .nav-item.active::before {
      height: 22px;
    }
    .nav-item:active { transform: scale(0.98); }
    .nav-item .nav-icon,
    .nav-item .nav-label { transition: color 0.16s ${ease}; }
    .nav-item.active .nav-label {
      color: ${paper} !important;
      font-weight: 600 !important;
      letter-spacing: 0.01em;
    }

    .nav-logout {
      margin: 4px 12px 14px;
      padding-left: 4px;
      border-radius: 14px;
      transition: background 0.18s ${ease}, transform 0.1s ${ease};
    }
    .nav-logout:hover  { background: ${paperCard}; }
    .nav-logout:active { transform: scale(0.98); }

    .nav-badge {
      animation: badgePop 0.25s ${ease};
      box-shadow: 0 2px 6px rgba(20,20,20,0.25);
    }


    /* Cards get a resting inset shadow — matches the Welcome banner's
       treatment — so the container reads as a recessed panel, plus a quiet
       lift with an outer shadow on hover. */
    .dash-card {
      transition: transform 0.2s ${ease}, box-shadow 0.2s ${ease};
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.10);
    }
    .dash-card:hover { transform: translateY(-3px); box-shadow: inset 0 2px 8px rgba(0,0,0,0.10), 0 10px 28px rgba(20,20,20,0.10); }

    .stat-view-btn { transition: transform 0.18s ${ease}, filter 0.18s ${ease}; }
    .stat-view-btn:hover { transform: scale(1.08); }

    .topbar-icon-btn { transition: background 0.18s ${ease}, transform 0.12s ${ease}; border-radius: 999px; }
    .topbar-icon-btn:hover { background: rgba(255,255,255,0.14); }
    .topbar-icon-btn:active { transform: scale(0.94); }

    .pill-btn { transition: filter 0.18s ${ease}, transform 0.12s ${ease}, box-shadow 0.18s ${ease}; }
    .pill-btn:hover { filter: brightness(1.25); }
    .pill-btn:active { transform: scale(0.97); }

    .notif-row { transition: background 0.15s ${ease}; }
    .notif-row:hover { background: ${paperCard}; }

    .company-row { transition: background 0.15s ${ease}; }
    .company-row:hover { background: ${hairline} !important; }

    /* ── Slide-in drawer (mobile / tablet) ── */
    .sidebar-drawer {
      position: fixed; top: 0; left: 0;
      height: 100%; width: 260px; z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      background: ${paper}; border-right: 1px solid ${hairline};
      overflow-y: auto; display: flex; flex-direction: column;
    }
    .sidebar-drawer.open { transform: translateX(0); }

    .sidebar-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.35); z-index: 199;
      transition: opacity 0.2s ${ease};
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

    @keyframes welcomeIn {
      0%   { opacity: 0; transform: translateY(14px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .welcome-animate {
      animation: welcomeIn 0.5s cubic-bezier(.16,1,.3,1);
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
    /* Left accent bar makes the title read as its own section instead of
       blending into the card body, which shares the same background. */
    .card-header {
      padding: 14px 18px 12px 15px;
      border-bottom: 3px solid ${hairline};
    }
    .card-header span {
      font-family: ${uiFont};
      font-weight: 600;
      font-size: clamp(0.85rem, 2vw, 0.98rem);
      color: ${inkText};
      letter-spacing: -0.01em;
    }

    /* ── Desktop static sidebar ── */
    @media (min-width: 1024px) {
      .sidebar-static {
        width: 260px; flex-shrink: 0;
        background: ${paper};
        display: flex; flex-direction: column;
        overflow-y: auto; border-right: 1px solid ${hairline};
      }
    }

    /* ── Hamburger button ── */
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

    /* ── Main content area ── */
    .main-content {
      flex: 1; display: flex; flex-direction: column;
      overflow-y: auto; background: ${paperTint}; min-width: 0; min-height: 0;
    }
  `}</style>
);

// ── Nav items ──────────────────────────────────────────────────────────────────
const navItems = [
  { key: "dashboard",         label: "Dashboard",          icon: dashboardIcon },
  { key: "findcompany",       label: "Find Company",      icon: findIcon },
  { key: "studentlist", label: "Student List", icon: studentPlacementIcon },
  { key: "studentsaccount",      label: "Students Account",      icon: studentListIcon },
  { key: "companylist",       label: "Company List",       icon: companyListIcon },
  { key: "reportcompany",     label: "Report List",     icon: reportCompanyIcon },
  { key: "messages",          label: "Messages",           icon: messagesIcon },
  { key: "accountprofile",    label: "Account Profile",    icon: accountProfileIcon },
];

// ── URL <-> tab mapping ──────────────────────────────────────────────────────
// The active tab now lives in the URL (/coordinator/dashboard/<key>) instead of
// sessionStorage, so the address bar always matches what's on screen and a
// refresh/back-button/shared link lands on the right tab.
const BASE_PATH = "/coordinator";
const getNavKeyFromPath = (pathname) => {
  const rest = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : "";
  const key = rest.replace(/^\/+|\/+$/g, ""); // strip leading/trailing slashes
  return key || "dashboard";
};

// ── Shared sub-components ──────────────────────────────────────────────────────
// Box shadow added so the icon itself reads as a raised chip against the
// row background, instead of sitting flush/flat with no visible edge.
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

// ── Sidebar nav list (reused in static & drawer) ───────────────────────────────
const SidebarNav = ({ activeNav, onNavigate, onLogout, unreadMessages = 0 }) => (
  <>
    <div style={{ padding: "6px 22px 10px", flexShrink: 0 }}> 
      
    </div>
    {navItems.map((item) => {
      const isActive = activeNav === item.key;
      return (
        <div
          key={item.key}
          className={`nav-item ${isActive ? "active" : ""}`}
          onClick={() => onNavigate(item.key)}
          style={{
            display: "flex", alignItems: "center", gap: "14px",
            padding: "12px 16px", cursor: "pointer", minHeight: "46px",
          }}
        >
          <img
            src={item.icon}
            alt={item.label}
            className="nav-icon"
            style={{ width: "20px", height: "20px", objectFit: "contain", flexShrink: 0 }}
          />
          <span
            className="nav-label"
            style={{ fontFamily: uiFont, fontWeight: 500, fontSize: "0.9rem", color: inkText, flex: 1 }}
          >
            {item.label}
          </span>
          {item.key === "messages" && unreadMessages > 0 && (
            <span key={unreadMessages} className="nav-badge" style={{
              background: ink, color: paper, borderRadius: "50%",
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
          className="nav-logout"
          onClick={onLogout}
          style={{
            display: "flex", alignItems: "center", gap: "14px",
            padding: "12px 16px", cursor: "pointer", minHeight: "46px",
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
      gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
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

// ── Company row ────────────────────────────────────────────────────────────────
const CompanyRow = ({ company, onView, mr = "0", showTime = false }) => (
  <div
    className="company-row"
    onClick={() => onView(company.id)}
    style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: paperCard, borderRadius: "8px",
      padding: "7px 10px", marginRight: mr,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
      <CompanyAvatar />
      <div style={{ minWidth: 0 }}>
        <span className="company-row-name" style={{
          fontFamily: uiFont,
          fontWeight: 500,
          fontSize: "clamp(0.78rem, 2vw, 0.85rem)",
          color: inkText,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "block",
          transition: `color 0.15s ${ease}`,
        }}>
          {company.name}
        </span>
        {showTime && company.visitedAt && (
          <span className="company-row-time" style={{ fontFamily: uiFont, fontSize: "0.68rem", color: steel, fontWeight: 600, transition: `color 0.15s ${ease}` }}>
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
const StatCard = ({ label, value, bg = steel, onView }) => (
  <div style={{ flex: 1, background: "transparent", borderRadius: "12px", padding: "2px 16px", display: "flex", flexDirection: "column" }}>
    <p style={{ fontFamily: uiFont, fontWeight: 500, fontSize: "clamp(0.9rem, 1.8vw, 1.05rem)", color: inkText, marginBottom: "12px" }}>
      {label}
    </p>
    <div style={{ position: "relative", marginBottom: "35px" }}>
      <div style={{
        background: bg, borderRadius: "8px",
        width: "100%", height: "155px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {value !== null ? (
          <span style={{ fontFamily: uiFont, fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.4rem)", color: paper }}>
            {value}
          </span>
        ) : (
          <span style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "2rem", color: "rgba(255,255,255,0.4)" }}>
            —
          </span>
        )}
      </div>
      <div
        className="stat-view-btn"
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
        background: paperCard, borderRadius: "18px",
        padding: "clamp(20px, 5vw, 30px) clamp(18px, 5vw, 40px)",
        marginBottom: "24px", textAlign: "center",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.10)",
      }}>
        <h1 className="welcome-heading welcome-animate">Welcome to OJTern</h1>
        <p className="welcome-sub welcome-animate">Find the perfect OJT for you!</p>
      </div>

      <hr style={{ border: "none", borderTop: `1.5px solid ${hairline}`, marginBottom: "24px" }} />

      {/* Top grid: Students Stats + Recent Registered Company */}
      <div className="dash-top-grid">

        {/* Students Stats */}
        <div className="dash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "visible", display: "flex", flexDirection: "column" }}>
          <div className="card-header"><span>Students Overview</span></div>
          <div className="stats-inner">
            <StatCard
              label="Total Students"
              value={totalStudents}
              bg={steel}
              onView={() => onNavigate("studentlist")}
            />
            <StatCard
              label="Accepted Students"
              value={acceptedStudents}
              bg={ink}
              onView={() => onNavigate("studentlist")}
            />
          </div>
        </div>

        {/* Recent Registered Company */}
        <div className="dash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
      <div className="dash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden" }}>
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

  // Unread-messages badge for the "Messages" nav item — real-time via
  // Firestore onSnapshot (see useUnreadCount in useChat.js), so it updates
  // live and stays correct across refreshes.
  const unreadMessages = useUnreadCount(user?.uid);

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
  // Recently visited companies now live in Firestore (coordinators/{uid}.recentVisited)
  // instead of localStorage, so the list follows the account across browsers
  // and devices instead of being stuck on whichever one was used to visit.
  const [recentVisited, setRecentVisited] = useState([]);
  const [recentVisitedLoaded, setRecentVisitedLoaded] = useState(false);
  const routerNavigate = useNavigate();
  const location = useLocation();
  const activeNav = getNavKeyFromPath(location.pathname);

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
  const [companyIndustryMapLoaded, setCompanyIndustryMapLoaded]  = useState(false);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "companies"), (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const name = data?.companyName || data?.name;
        if (name) map[name] = Array.isArray(data.industry) ? data.industry : (data.industry ? [data.industry] : []);
      });
      setCompanyIndustryMap(map);
      setCompanyIndustryMapLoaded(true);
    }, (err) => console.error("Failed to load company industries:", err));
    return unsub;
  }, []);

  // Reports scoped to this coordinator's assigned industries (via the
  // reported company's industry). Used for both the notification dropdown
  // and the full Report Company list.
  //
  // Fails CLOSED, not open: a report whose company we can't match to an
  // industry, or a coordinator with no assigned industries, must be hidden —
  // never shown to everyone. The only case that legitimately shows
  // everything is the brief window before the initial company fetch above
  // resolves (companyIndustryMapLoaded), same reasoning as the activity log.
  const scopedReports = React.useMemo(() => {
    if (!companyIndustryMapLoaded) return reports;
    if (coordinatorIndustries.length === 0) return [];
    return reports.filter(r => {
      const ind = companyIndustryMap[r.company];
      if (!ind || ind.length === 0) return false;
      return ind.some(i => coordinatorIndustries.includes(i));
    });
  }, [reports, companyIndustryMap, companyIndustryMapLoaded, coordinatorIndustries]);


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
  // Separate from coordinatorScopes itself (an empty {} is indistinguishable
  // from "still loading" otherwise) — lets the filter below tell "haven't
  // fetched yet" apart from "fetched, and this coordinator genuinely has no
  // department assigned", which must NOT be treated the same way.
  const [scopesLoaded, setScopesLoaded]                          = useState(false);
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
      setScopesLoaded(true);
    }).catch(err => console.error("Failed to load coordinator names:", err));
  }, []);

  // Only show activity from coordinators whose department/college scope
  // overlaps with the current coordinator's own scope.
  //
  // Fails CLOSED, not open: an empty scope — for either the viewer or the
  // coordinator who performed the action — must hide the entry, never show
  // it to everyone. Department activity is exactly what this filter exists
  // to keep private, so "we don't know their department" should never
  // default to "show it anyway". The one legitimate reason to show
  // everything is the brief window before the initial fetch above resolves,
  // which is tracked separately via scopesLoaded.
  const visibleActivity = !scopesLoaded
    ? recentActivity
    : recentActivity.filter(entry => {
        const actorColleges = coordinatorScopes[entry.coordinatorUid] || [];
        if (coordinatorColleges.length === 0 || actorColleges.length === 0) return false;
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
  const [lastSeenNotifAt, setLastSeenNotifAt]                    = useState(0);
  const unreadNotifCount = coordinatorNotifications.filter(
    n => (n.createdAt?.seconds || 0) * 1000 > lastSeenNotifAt
  ).length;

  const handleToggleNotifDropdown = () => {
    setShowNotifDropdown(prev => {
      const next = !prev;
      if (next) {
        const now = Date.now();
        setLastSeenNotifAt(now);
        if (user?.uid) {
          setDoc(doc(db, "coordinators", user.uid), { lastSeenNotifAt: now }, { merge: true })
            .catch((err) => console.error("Failed to save notification seen state:", err));
        }
      }
      return next;
    });
  };

  const [messageTarget, setMessageTarget]                       = useState(null);
  const [placementTargetCompanyId, setPlacementTargetCompanyId] = useState(null);
  const [dashboardCompanyId, setDashboardCompanyId]             = useState(null);
  const [dashboardTarget, setDashboardTarget]                   = useState(null);
  // Which student's "Student Placement" modal a Find-Company deep link came
  // from (Visit → view company → back should reopen that same modal instead
  // of dropping the coordinator on the bare Find Company list).
  const [placementTargetStudentId, setPlacementTargetStudentId] = useState(null);
  // Where to send the coordinator back to when they press "back" from a
  // company profile they reached via a deep link — "studentlist" (Visit,
  // from a student's Placement modal) or "dashboard" (a recent/registered
  // company row). Null means the profile was opened normally from within
  // Find Company's own list, so its default (show that list again) applies.
  const [findCompanyOrigin, setFindCompanyOrigin]               = useState(null);
  const [showChangePass, setShowChangePass] = useState(false);
  const [showPassSuccess, setShowPassSuccess]   = useState(false);
  const [showEditInfo,   setShowEditInfo]   = useState(false);
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
    if (!isPasswordStrong(newPass)) { setPassError("Password does not meet all the requirements below."); return; }
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
    setShowEditInfo(!!user.passwordChanged && !user.profileComplete);
  }, [user]);

  // Close drawer when resizing to desktop
  useEffect(() => { if (isDesktop) setDrawerOpen(false); }, [isDesktop]);

  // Load recent visited companies + last-seen notification timestamp from
  // Firestore once we know who the user is (one read covers both fields).
  useEffect(() => {
    if (!user?.uid) { setRecentVisitedLoaded(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "coordinators", user.uid));
        if (cancelled) return;
        const data = snap.data();
        setRecentVisited(Array.isArray(data?.recentVisited) ? data.recentVisited : []);
        setLastSeenNotifAt(Number(data?.lastSeenNotifAt) || 0);
      } catch (err) {
        console.error("Failed to load coordinator dashboard preferences:", err);
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
    setDoc(doc(db, "coordinators", user.uid), { recentVisited }, { merge: true })
      .catch((err) => console.error("Failed to save recent visited companies:", err));
  }, [recentVisited, user?.uid, recentVisitedLoaded]);

  const navigate = (key) => {
    setDrawerOpen(false);
    routerNavigate(`${BASE_PATH}/${key}`);
  };

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

  const handleMessageStudent = (student) => {
    setMessageTarget({ id: student.id, name: student.name, role: "student" });
    navigate("messages");
  };

  useEffect(() => {
    if (activeNav !== "messages") setMessageTarget(null);
  }, [activeNav]);

  const handleViewCompany = (companyId) => {
    setDashboardCompanyId(companyId);
    setDashboardTarget("findcompany");
    setFindCompanyOrigin("dashboard");
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
        onBackToOrigin={
          findCompanyOrigin
            ? () => { const origin = findCompanyOrigin; setFindCompanyOrigin(null); navigate(origin); }
            : undefined
        }
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
        onNavigateToCompany={(companyId, studentId) => {
          setPlacementTargetCompanyId(companyId);
          setPlacementTargetStudentId(studentId);
          setFindCompanyOrigin("studentlist");
          navigate("findcompany");
        }}
        initialViewingStudentId={placementTargetStudentId}
        onClearInitialViewingStudent={() => setPlacementTargetStudentId(null)}
        onMessageStudent={handleMessageStudent}
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
    if (activeNav === "about") return <AboutUsScreen onBack={() => navigate("dashboard")} />;

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
          background: `linear-gradient(90deg, ${ink} 0%, ${inkDeep} 100%)`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
            {/* Hamburger — only on mobile / tablet */}
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
            {/* Current page label — mobile only */}
            {isMobile && (
              <span style={{
                fontFamily: uiFont, fontWeight: 500, fontSize: "0.9rem", color: "rgba(255,255,255,0.7)", marginLeft: "4px",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
              }}>
                / {currentLabel}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            {/* Activity Log */}
            <div style={{ position: "relative" }}>
              <div className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px" }} onClick={() => setShowActivityDropdown(prev => !prev)} title="Activity Log">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 7v5l3 3"/>
                </svg>
              </div>
              {showActivityDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowActivityDropdown(false)} />
                  <div style={(isMobile || isTablet) ? {
                      position: "fixed", top: "76px", right: "12px", width: "min(320px, 88vw)", maxHeight: "min(45vh, 340px)",
                      overflowY: "auto", overflowX: "hidden", background: paper, border: `1px solid ${ink}`,
                      borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
                    } : {
                      position: "absolute", top: "48px", right: 0, width: "min(560px, 90vw)", maxHeight: "320px",
                      overflowY: "auto", background: paper, border: `1px solid ${ink}`,
                      borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
                    }}>
                    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${hairline}`, fontFamily: uiFont, fontWeight: 600, fontSize: "1rem", color: ink, position: "sticky", top: 0, background: paper }}>
                      Activity Log
                    </div>
                    {visibleActivity.length === 0 ? (
                      <div style={{ padding: "24px 14px", textAlign: "center", fontFamily: uiFont, fontSize: "0.82rem", color: inkMuted }}>
                        No recent activity yet.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: uiFont }}>
                          <thead>
                            <tr style={{ background: paperCard }}>
                              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: inkMuted, fontWeight: 600 }}>Activity</th>
                              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: inkMuted, fontWeight: 600, whiteSpace: "nowrap" }}>Date</th>
                              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: inkMuted, fontWeight: 600, whiteSpace: "nowrap" }}>Coordinator</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleActivity.map(entry => (
                              <tr key={entry.id} className="notif-row" style={{ borderTop: `1px solid ${hairline}` }}>
                                <td style={{ padding: "9px 12px", fontSize: "0.8rem", color: inkText }}>{entry.description}</td>
                                <td style={{ padding: "9px 12px", fontSize: "0.74rem", color: inkMuted, whiteSpace: "nowrap" }}>{formatActivityTime(entry.createdAt)}</td>
                                <td style={{ padding: "9px 12px", fontSize: "0.78rem", color: steel, whiteSpace: "nowrap" }}>{coordinatorNames[entry.coordinatorUid] || "Unknown"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <div style={{ position: "relative" }}>
              <div className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px", position: "relative" }} onClick={handleToggleNotifDropdown}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadNotifCount > 0 && (
                  <span style={{
                    position: "absolute", top: "4px", right: "4px",
                    background: paper, color: ink, borderRadius: "50%",
                    minWidth: "16px", height: "16px", fontSize: "0.65rem",
                    fontFamily: uiFont, fontWeight: "bold",
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
                  <div style={(isMobile || isTablet) ? {
                      position: "fixed", top: "76px", right: "12px", width: "min(320px, 88vw)", maxHeight: "min(45vh, 320px)",
                      overflowY: "auto", background: paper, border: `1px solid ${ink}`,
                      borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
                    } : {
                      position: "absolute", top: "48px", right: 0, width: "320px", maxHeight: "300px",
                      overflowY: "auto", background: paper, border: `1px solid ${ink}`,
                      borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
                    }}>
                    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${hairline}`, fontFamily: uiFont, fontWeight: 600, fontSize: "1rem", color: ink }}>
                      Notifications
                    </div>
                    {coordinatorNotifications.length === 0 ? (
                      <div style={{ padding: "24px 14px", textAlign: "center", fontFamily: uiFont, fontSize: "0.82rem", color: inkMuted }}>
                        No notifications yet.
                      </div>
                    ) : (
                      coordinatorNotifications.map(n => (
                        <div
                          key={n.id}
                          className="notif-row"
                          onClick={() => handleNotificationClick(n)}
                          style={{ padding: "10px 14px", borderBottom: `1px solid ${hairline}`, fontFamily: uiFont, cursor: "pointer" }}
                        >
                          <p style={{ margin: 0, fontSize: "0.82rem", color: inkText, lineHeight: 1.4 }}>{n.message}</p>
                          <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: inkMuted }}>{formatActivityTime(n.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* About */}
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
            <div className="sidebar-static">
              <SidebarNav activeNav={activeNav} onNavigate={navigate} onLogout={handleLogoutClick} unreadMessages={unreadMessages} />
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
                <button onClick={() => { navigate("dashboard"); setDrawerOpen(false); }} style={{
                  background: `linear-gradient(90deg, ${ink} 0%, ${inkDeep} 100%)`,
                  padding: "14px 20px", flexShrink: 0,
                  display: "flex", alignItems: "center", gap: "10px",
                  border: "none", cursor: "pointer", width: "100%", justifyContent: "flex-start",
                }}>
                  <img src={logo} alt="OJTern" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
                  <span style={{ fontFamily: logoFont, fontSize: "1.2rem", color: paper }}>OJTern</span>
                </button>
                <SidebarNav activeNav={activeNav} onNavigate={navigate} onLogout={handleLogoutClick} unreadMessages={unreadMessages} />
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
        <ReportDetailModal report={viewingReport} onClose={() => setViewingReport(null)} coordinatorUid={user?.uid} coordinatorName={user?.name} />
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
            background: ink,
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
    width: "100%", padding: "10px 44px 10px 16px", background: ink,
    border: hasError ? `1.5px solid ${color.danger}` : "none", borderRadius: "20px",
    color: paper, fontSize: "0.88rem", fontFamily: uiFont,
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
      <div style={{ background: paper, borderRadius: "24px", border: `2px solid ${ink}`, overflow: "hidden", width: "100%", maxWidth: "370px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <div style={{ background: ink, padding: "14px", textAlign: "center" }}>
          <span style={{ fontFamily: uiFont, fontWeight: 700, fontSize: "1.15rem", color: paper, letterSpacing: "0.02em" }}>Set New Password</span>
        </div>
        <div style={{ padding: "20px 24px 28px" }}>
          <p style={{ fontFamily: uiFont, fontSize: "0.85rem", color: inkMuted, textAlign: "center", marginBottom: "16px", lineHeight: 1.6 }}>
            For your security, please change your password before continuing.
          </p>

          {/* Current Password */}
          <p style={{ fontFamily: uiFont, fontSize: "0.8rem", fontWeight: 700, color: inkText, marginBottom: "4px" }}>Current Password:</p>
          <div style={{ position: "relative", marginBottom: "10px" }}>
            <input type={showCurrent ? "text" : "password"} placeholder="Enter Current Password:" value={currentPass}
              onChange={e => { setCurrentPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              style={inputStyle(passError)} />
            <EyeBtn show={showCurrent} onToggle={() => setShowCurrent(p => !p)} />
          </div>

          <hr style={{ border: "none", borderTop: `1px solid ${hairline}`, margin: "12px 0" }} />

          {/* New Password */}
          <p style={{ fontFamily: uiFont, fontSize: "0.8rem", fontWeight: 700, color: inkText, marginBottom: "4px" }}>New Password:</p>
          <div style={{ position: "relative", marginBottom: "10px" }}>
            <input type={showNew ? "text" : "password"} placeholder="Enter New Password:" value={newPass}
              onChange={e => { setNewPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              style={inputStyle(passError)} />
            <EyeBtn show={showNew} onToggle={() => setShowNew(p => !p)} />
          </div>

          <PasswordChecklist password={newPass} />

          {/* Confirm New Password */}
          <p style={{ fontFamily: uiFont, fontSize: "0.8rem", fontWeight: 700, color: inkText, marginBottom: "4px" }}>Confirm New Password:</p>
          <div style={{ position: "relative", marginBottom: "4px" }}>
            <input type={showConfirm ? "text" : "password"} placeholder="Confirm New Password:" value={confirmPass}
              onChange={e => { setConfirmPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              style={inputStyle(passError)} />
            <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(p => !p)} />
          </div>

          {passError && <p style={{ fontFamily: uiFont, fontSize: "0.78rem", color: color.danger, margin: "4px 0 8px 4px" }}>⚠️ {passError}</p>}
          <hr style={{ border: "none", borderTop: `1.5px solid ${hairline}`, margin: "16px 0" }} />
          <div style={{ textAlign: "center" }}>
            <button onClick={handleChangePassword} disabled={passLoading} className="pill-btn"
              style={{ background: ink, color: paper, border: "none", borderRadius: "24px", padding: "12px 48px", fontFamily: uiFont, fontWeight: 700, fontSize: "1.05rem", letterSpacing: "0.02em", cursor: passLoading ? "not-allowed" : "pointer", opacity: passLoading ? 0.7 : 1 }}>
              {passLoading ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorDashboardScreen;