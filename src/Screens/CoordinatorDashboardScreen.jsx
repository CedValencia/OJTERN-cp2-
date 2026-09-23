import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { changePassword, logOut, getUserProfile } from "./AuthService";
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc, setDoc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { PersonalInfoScreen, ResponsiveStyles } from "./CoordinatorAccountProfileScreen";
import { useUnreadCount } from "./useChat";
import { color, font, ease, ACCENT_THEMES, ACCENT_THEME_ORDER, getSavedAccentThemeId, saveAccentThemeId, getAccentThemeVars, getThemedAsset } from "./theme";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

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
import blackViewIcon        from "../icons/blackview.png";
import redViewIcon          from "../icons/redview.png";
import blueViewIcon         from "../icons/blueview.png";
import violetViewIcon       from "../icons/violetview.png";
import pinkViewIcon         from "../icons/pinkview.png";
import yellowViewIcon       from "../icons/yellowview.png";

import blackCompanyProfileIcon   from "../icons/blackcompanyprofile.png";
import blackUserIcon              from "../icons/blackuser.png";
import redUserIcon           from "../icons/reduser.png";
import blueUserIcon          from "../icons/blueuser.png";
import yellowUserIcon        from "../icons/yellowuser.png";
import pinkUserIcon          from "../icons/pinkuser.png";
import violetUserIcon        from "../icons/violetuser.png";
import redCompanyProfileIcon    from "../icons/redcompanyprofile.png";
import blueCompanyProfileIcon   from "../icons/bluecompanyprofile.png";
import yellowCompanyProfileIcon from "../icons/yellowcompanyprofile.png";
import pinkCompanyProfileIcon   from "../icons/pinkcompanyprofile.png";
import violetCompanyProfileIcon from "../icons/violetcompanyprofile.png";
import findIcon           from "../icons/find.png";
import studentListIcon      from "../icons/studentlist.png";
import studentPlacementIcon from "../icons/studentsplacement.png";
import companyListIcon      from "../icons/companylist.png";
import reportCompanyIcon    from "../icons/reportcompany.png";
import messagesIcon         from "../icons/messages.png";
import accountProfileIcon   from "../icons/accountprofile.png";
import aboutIcon            from "../icons/about.png";

// Nav bar "change color" accent theme → matching view-icon asset. Keyed by
// ACCENT_THEMES id (see theme.js); "default" ("Original") uses blackview.png.
// Resolved once per render via getThemedAsset(VIEW_ICON_BY_THEME,
// accentThemeId) and threaded down as a prop, since CompanyRow/StatCard are
// module-level components that don't otherwise see accentThemeId.
const VIEW_ICON_BY_THEME = {
  default: blackViewIcon,
  red:     redViewIcon,
  blue:    blueViewIcon,
  violet:  violetViewIcon,
  pink:    pinkViewIcon,
  yellow:  yellowViewIcon,
};

// Nav bar "change color" accent theme → matching user / company-profile icon.
// Same keying as VIEW_ICON_BY_THEME above; "default" ("Original") keeps the
// original blackuser.png / blackcompanyprofile.png. Resolved once in the screen
// component via getThemedAsset(...) and threaded down as props.
const USER_ICON_BY_THEME = {
  default: blackUserIcon,
  red:     redUserIcon,
  blue:    blueUserIcon,
  violet:  violetUserIcon,
  pink:    pinkUserIcon,
  yellow:  yellowUserIcon,
};
const COMPANY_PROFILE_ICON_BY_THEME = {
  default: blackCompanyProfileIcon,
  red:     redCompanyProfileIcon,
  blue:    blueCompanyProfileIcon,
  violet:  violetCompanyProfileIcon,
  pink:    pinkCompanyProfileIcon,
  yellow:  yellowCompanyProfileIcon,
};

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

    /* Floating "?" help button — idle pulse ring to catch the eye, lifts and
       deepens its shadow on hover/press so it reads as clearly tappable.
       The ring is mixed from the CURRENT accent theme's ink color (via
       color-mix against the --ojt-ink custom property, which the
       Coordinator's theme picker repaints live), not a fixed black — so it
       re-colors itself the instant the user picks a new theme, same as the
       icon below. color-mix() has full support in all current browsers. */
    @keyframes help-btn-pulse {
      0%   { box-shadow: 0 6px 20px color-mix(in srgb, ${ink} 25%, transparent), 0 0 0 0 color-mix(in srgb, ${ink} 16%, transparent); }
      70%  { box-shadow: 0 6px 20px color-mix(in srgb, ${ink} 25%, transparent), 0 0 0 10px color-mix(in srgb, ${ink} 0%, transparent); }
      100% { box-shadow: 0 6px 20px color-mix(in srgb, ${ink} 25%, transparent), 0 0 0 0 color-mix(in srgb, ${ink} 0%, transparent); }
    }
    .help-fab {
      animation: help-btn-pulse 2.6s ease-out infinite;
      transition: transform 0.18s ${ease}, background 0.18s ${ease}, opacity 0.45s ${ease};
    }
    /* After a drag is released it glides to the nearest side instead of
       jumping there. Only on while snapping, so dragging itself stays 1:1. */
    .help-fab.help-fab-snapping {
      transition: left 0.32s cubic-bezier(0.22, 1, 0.36, 1), top 0.32s cubic-bezier(0.22, 1, 0.36, 1),
                  transform 0.18s ${ease}, background 0.18s ${ease}, opacity 0.45s ${ease};
    }
    /* Idle (untouched for 10s): faded, and the pulse ring stops so it
       doesn't keep pulling attention. Back to full on hover/press/focus. */
    .help-fab.help-fab-idle { opacity: 0.4; animation: none; }
    .help-fab:hover {
      transform: translateY(-3px) scale(1.06);
      background: ${ink} !important;
      animation-play-state: paused;
    }
    .help-fab:hover .help-fab-icon { stroke: ${paper} !important; }
    .help-fab:hover .help-fab-icon-dot { fill: ${paper} !important; }
    .help-fab:active { transform: translateY(-1px) scale(0.98); }
    /* Hide the "?" button while a tour is running (driver.js adds
       .driver-active to <body>) — otherwise it floats on top of whatever is
       highlighted in the bottom-right corner, e.g. Company List's Accept button. */
    body.driver-active .help-fab { visibility: hidden; animation: none; }
    /* Being dragged (after a long press): lift it, drop the pulse/hover
       effects, and show a grabbing cursor so it's obvious it's moving. */
    .help-fab.help-fab-dragging,
    .help-fab.help-fab-dragging:hover {
      animation: none !important;
      transform: scale(1.1) !important;
      box-shadow: 0 10px 28px rgba(0,0,0,0.28) !important;
      cursor: grabbing !important;
      background: ${paper} !important;
    }
    .help-fab.help-fab-dragging .help-fab-icon { stroke: ${ink} !important; }
    .help-fab.help-fab-dragging .help-fab-icon-dot { fill: ${ink} !important; }
    /* Mouse hovering, counting down to "follow the cursor": a ring fades in
       around the button over that 1 second so it's clear it's about to move. */
    .help-fab.help-fab-arming::after {
      content: ""; position: absolute; inset: -6px; border-radius: 50%;
      border: 2px solid ${ink}; opacity: 0; pointer-events: none;
      animation: help-fab-arm 1s linear forwards;
    }
    @keyframes help-fab-arm {
      0%   { opacity: 0;    transform: scale(0.8); }
      100% { opacity: 0.55; transform: scale(1); }
    }

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
      background: ${color.hoverWash};
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
    .nav-item .nav-label { transition: filter 0.16s ${ease}, color 0.16s ${ease}; }
    .nav-item.active .nav-label {
      color: ${paper} !important;
      font-weight: 600 !important;
      letter-spacing: 0.01em;
    }
    .nav-item.active .nav-icon { filter: brightness(0) invert(1); }

    .nav-logout {
      margin: 4px 12px 14px;
      padding-left: 4px;
      border-radius: 14px;
      transition: background 0.18s ${ease}, transform 0.1s ${ease};
    }
    .nav-logout:hover  { background: ${color.hoverWash}; }
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
    /* While driver.js is spotlighting a dash-card, the cursor sitting on top of it can
       still trigger :hover through the overlay's cutout — cancel the lift so the card
       (and Students Overview / Recent Registered specifically) stays put during the tour. */
    .dash-card.driver-active-element,
    .dash-card.driver-active-element:hover { transform: none; }

    .stat-view-btn { transition: transform 0.18s ${ease}, filter 0.18s ${ease}; }
    .stat-view-btn:hover { transform: scale(1.08); }
    .company-row-view-btn { transition: transform 0.18s ${ease}, filter 0.18s ${ease}; }
    .company-row-view-btn:hover { transform: scale(1.15); }

    .topbar-icon-btn { transition: background 0.18s ${ease}, transform 0.12s ${ease}; border-radius: 999px; }
    .topbar-icon-btn:hover { background: rgba(255,255,255,0.14); }
    .topbar-icon-btn:active { transform: scale(0.94); }

    .pill-btn { transition: filter 0.18s ${ease}, transform 0.12s ${ease}, box-shadow 0.18s ${ease}; }
    .pill-btn:hover { filter: brightness(1.25); }
    .pill-btn:active { transform: scale(0.97); }

    .notif-row { transition: background 0.15s ${ease}; }
    .notif-row:hover { background: ${color.hoverWash}; }

    .company-row { transition: background 0.15s ${ease}; }
    .company-row:hover { background: ${color.hoverWashStrong} !important; }

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
      min-height: 220px;
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
  { key: "studentsaccount",      label: "Students Account",      icon: studentListIcon },
  { key: "studentlist", label: "Student List", icon: studentPlacementIcon },  
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

// Best-effort na "sino ba ang naka-login" bago pa man ma-resolve ang
// Firebase Auth sa bagong pageload (refresh) — binabasa mula sa localStorage
// sa halip na hintayin ang `user` prop, para ang PINAKAUNANG paint mismo ay
// makapagbasa na ng tamang account-specific na theme, hindi neutral default.
const LAST_COORDINATOR_UID_KEY = "ojtern-last-coordinator-uid";
const getCachedCoordinatorUid = () => {
  try { return localStorage.getItem(LAST_COORDINATOR_UID_KEY); } catch { return null; }
};
const setCachedCoordinatorUid = (uid) => {
  try {
    if (uid) localStorage.setItem(LAST_COORDINATOR_UID_KEY, uid);
    else localStorage.removeItem(LAST_COORDINATOR_UID_KEY);
  } catch { /* localStorage unavailable — fall back to the plain flash-fix below */ }
};

// ── Shared sub-components ──────────────────────────────────────────────────────
// Box shadow added so the icon itself reads as a raised chip against the
// row background, instead of sitting flush/flat with no visible edge.
const CompanyAvatar = ({ size = 38, companyProfileIcon: themedCompanyIcon = blackCompanyProfileIcon }) => (
  <div style={{
    width: size, height: size, flexShrink: 0, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: paper,
    boxShadow: "0 1px 3px rgba(20,20,20,0.18), 0 1px 2px rgba(20,20,20,0.10)",
  }}>
    <img src={themedCompanyIcon} alt="company" style={{ width: size, height: size, objectFit: "contain" }} />
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
const CompanyRow = ({ company, onView, mr = "0", showTime = false, viewIcon: themedViewIcon = blackViewIcon, companyProfileIcon: themedCompanyIcon = blackCompanyProfileIcon }) => (
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
      <CompanyAvatar companyProfileIcon={themedCompanyIcon} />
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
      className="company-row-view-btn"
      onClick={(e) => { e.stopPropagation(); onView(company.id); }}
      style={{
        width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
      }}
    >
      <img src={themedViewIcon} alt="view" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
    </div>
  </div>
);

// ── Stat card ──────────────────────────────────────────────────────────────────
// Label on top → coloured rounded box (120px) → big number or "—" centred →
// view button overlapping the bottom-right corner of the box (responsive, no
// hardcoded left/top pixel values).
const StatCard = ({ label, value, bg = steel, onView, viewIcon: themedViewIcon = blackViewIcon }) => (
  <div style={{ flex: 1, background: "transparent", borderRadius: "12px", padding: "2px 16px", display: "flex", flexDirection: "column" }}>
    <p style={{ fontFamily: uiFont, fontWeight: 500, fontSize: "clamp(0.9rem, 1.8vw, 1.05rem)", color: inkText, marginBottom: "12px" }}>
      {label}
    </p>
    <div style={{ position: "relative", marginBottom: "35px" }}>
      <div style={{
        background: bg, borderRadius: "8px",
        width: "100%", height: "120px",
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
        <img src={themedViewIcon} alt="view" style={{ width: "70px", height: "70px", objectFit: "contain" }} />
      </div>
    </div>
  </div>
);

// ── Dashboard Content ──────────────────────────────────────────────────────────
const DashboardContent = ({ onNavigate, onViewCompany, onViewRegistered, coordinatorUid, coordinatorColleges, coordinatorIndustries = [], recentVisited = [], viewIcon: themedViewIcon = blackViewIcon, companyProfileIcon: themedCompanyIcon = blackCompanyProfileIcon }) => {
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
        <p className="welcome-sub welcome-animate">Find the perfect OJT partners for your department!</p>
      </div>

      <hr style={{ border: "none", borderTop: `1.5px solid ${hairline}`, marginBottom: "24px" }} />

      {/* Top grid: Students Stats + Recent Registered Company */}
      <div className="dash-top-grid">

        {/* Students Stats */}
        <div id="dash-students-overview" className="dash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "visible", display: "flex", flexDirection: "column" }}>
          <div className="card-header"><span>Students Overview</span></div>
          <div className="stats-inner">
            <StatCard
              label="Total Students"
              value={totalStudents}
              bg={steel}
              onView={() => onNavigate("studentlist")}
              viewIcon={themedViewIcon}
            />
            <StatCard
              label="Accepted Students"
              value={acceptedStudents}
              bg={ink}
              onView={() => onNavigate("studentlist")}
              viewIcon={themedViewIcon}
            />
          </div>
        </div>

        {/* Recent Registered Company */}
        <div id="dash-recent-registered" className="dash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="card-header"><span>Recent Registered Company</span></div>
          <div style={{ padding: "10px 0 10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "240px", overflowY: "auto" }}>
            {recentRegistered.length > 0 ? (
              recentRegistered.map((company, i) => (
                <CompanyRow key={i} company={company} onView={onViewRegistered} mr="12px" viewIcon={themedViewIcon} companyProfileIcon={themedCompanyIcon} />
              ))
            ) : (
              <EmptyListPlaceholder label="No registered companies yet" />
            )}
          </div>
        </div>
      </div>

      {/* Recent Visited Company */}
      <div id="dash-recent-visited" className="dash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden" }}>
        <div className="card-header"><span>Recent Visited Company Post</span></div>
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", height: "156px", overflowY: "auto" }}>
          {recentVisited.length > 0 ? (
            recentVisited.map((company, i) => (
              <CompanyRow key={i} company={company} onView={onViewCompany} showTime viewIcon={themedViewIcon} companyProfileIcon={themedCompanyIcon} />
            ))
          ) : (
            <EmptyListPlaceholder label="No recently visited companies" />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Contextual "?" help tour steps, keyed by sidebar nav key ───────────────────
// Add an entry here (and matching `id`s on the target elements) to give any
// other screen its own guided tour. Screens with no entry get a generic
// one-line popover instead of a broken tour.
// For list steps: highlight just ONE item (the first visible row/card)
// instead of the whole list. Returns a resolver that runTour calls right
// when the tour starts; tries each selector in order and takes the first
// match that's actually rendered (e.g. Report List's desktop table row vs.
// its mobile card), falling back to the whole list — e.g. its empty state —
// when there are no items yet.
const firstListItem = (selectors, fallback) => () => {
  for (const sel of selectors) {
    const el = [...document.querySelectorAll(sel)].find(n => n.getClientRects().length > 0);
    if (el) return el;
  }
  return document.querySelector(fallback);
};

// Same idea as firstListItem, but picks the LAST visible match — used for
// chat messages, where the newest one (at the bottom, already in view) is
// the natural one to point at.
const lastListItem = (selectors, fallback) => () => {
  for (const sel of selectors) {
    const el = [...document.querySelectorAll(sel)].reverse().find(n => n.getClientRects().length > 0);
    if (el) return el;
  }
  return fallback ? document.querySelector(fallback) : null;
};

// Account Profile sub-view (from its onViewChange) → HELP_STEPS_BY_NAV key.
// "main" isn't listed, so the menu keeps the regular `accountprofile` steps.
const PROFILE_TOUR_KEYS = {
  personalInfo:     "accprofilepersonal",
  personalInfoEdit: "accprofilepersonaledit",
  terms:            "accprofileterms",
  privacy:          "accprofileprivacy",
  reset:            "accprofilereset",
  add:              "accprofileadd",
  transfer:         "accprofiletransfer",
};

const HELP_STEPS_BY_NAV = {
  dashboard: [
    {
      element: "#dash-students-overview",
      popover: {
        title: "Students Overview",
        description: "Total students in your department, and how many have been accepted by a company. Tap the round arrow to open the full Student List.",
      },
    },
    {
      element: "#dash-recent-registered",
      popover: {
        title: "Recent Registered Company",
        description: "The latest companies approved for your assigned industries. Tap one to view its profile.",
      },
    },
    {
      element: "#dash-recent-visited",
      popover: {
        title: "Recent Visited Company Post",
        description: "Companies you've recently opened, with how long ago you visited each one.",
      },
    },
    {
      element: "#topbar-activity-log",
      popover: {
        title: "Activity Log",
        description: "See what coordinators in your department have been doing lately, newest first.",
      },
    },
    {
      element: "#topbar-notifications",
      popover: {
        title: "Notifications",
        description: "New company registrations and other alerts land here. Tap one to jump straight to it.",
      },
    },
    {
      element: "#topbar-about",
      popover: {
        title: "About",
        description: "Learn more about OJTern and the team behind it.",
      },
    },
    {
      element: "#topbar-theme-picker",
      popover: {
        title: "Theme Customization",
        description: "Change the dashboard's accent color. Your choice is saved on this device and applies across every module.",
      },
    },
  ],
  findcompany: [
    {
      element: "#findcompany-search-bar",
      popover: {
        title: "Search Company Posts",
        description: "Search by company name, industry, or location. The count above updates to match your current search and filters.",
      },
    },
    {
      element: "#findcompany-filter",
      popover: {
        title: "Filters",
        description: "Narrow the list down by industry or city. Active filters show as removable chips below the search bar.",
      },
    },
    {
      element: firstListItem(["#findcompany-grid > *"], "#findcompany-grid"),
      popover: {
        title: "Company Posts",
        description: "Each card is one open post for your assigned programs. Tap any card to view the full company profile and message them.",
      },
    },
  ],
  // Steps for the single-post view inside Find Company (CompanyProfile in
  // CoordinatorFindCompanyScreen.jsx) — reached either by tapping a card in
  // the list above, or via a deep link (a Recent Visited row on the
  // Dashboard, or "Visit" from a student's Placement). Kept separate from
  // `findcompany` above since that screen's list elements (#findcompany-
  // search-bar, -filter, -grid) don't exist while a post is open.
  findcompanyprofile: [
    {
      element: "#cprofile-details",
      popover: {
        title: "Company Name & Description",
        description: "Who the company is and what this post is about.",
      },
    },
    {
      element: "#cprofile-map",
      popover: {
        title: "Location Map",
        description: "Where the company is. Use \"Open full map\" for a bigger, interactive view.",
      },
    },
    {
      element: "#cprofile-details-full",
      popover: {
        title: "Post Details",
        description: "Requirements, working hours, contact info, location, benefits, open programs, industry, and skills required — everything to check before messaging.",
      },
    },
    {
      element: "#cprofile-message-btn",
      popover: {
        title: "Message Now!",
        description: "Reach out to the company directly about this post.",
      },
    },
  ],
  companylist: [
    {
      element: "#clist-search-pill",
      popover: {
        title: "Search Companies",
        description: "Search by company name, industry, or location. The count above updates to match your current search and filters.",
      },
    },
    {
      element: "#clist-filter-btn",
      popover: {
        title: "Filters",
        description: "Narrow the list down by industry or location. Active filters show as removable chips below the search bar.",
      },
    },
    {
      element: firstListItem(["#clist-registered-section .clist-card"], "#clist-registered-section"),
      popover: {
        title: "Registered Companies",
        description: "Each card is a company already approved for your assigned industries. Tap any card to view its full profile.",
      },
    },
    {
      element: firstListItem(["#clist-review-section .clist-card"], "#clist-review-section"),
      popover: {
        title: "Companies in Review",
        description: "Each card here is a company still pending approval. Tap Verify on any card to check its details and accept or decline it.",
      },
    },
  ],
  // Steps for a single company's profile inside Company List — one set per
  // section, since the list's own steps (#clist-search-pill, etc.) don't
  // exist while a profile is open. Set via CoordinatorCompanyListScreen's
  // onViewChange ("registered" | "review"). Each auto-plays once on a new
  // account's first visit, same as every other HELP_STEPS_BY_NAV key.
  companylistregistered: [
    {
      element: "#clprofile-header",
      popover: {
        title: "Registered Company",
        description: "This company is already approved for your department. Tap Back to return to the list.",
      },
    },
    {
      element: "#clprofile-map",
      popover: {
        title: "Location Map",
        description: "Where the company is located, based on the address they registered with.",
      },
    },
    {
      element: "#clprofile-info",
      popover: {
        title: "Company Details",
        description: "Name, industry, department/program approval status, full address, email, and registration date.",
      },
    },
    {
      element: "#clprofile-docs",
      popover: {
        title: "Verification Documents",
        description: "The documents this company submitted when registering. Tap one to view it larger.",
      },
    },
  ],
  companylistreview: [
    {
      element: "#clprofile-header",
      popover: {
        title: "Company in Review",
        description: "This company is still waiting for approval from your department. Tap Back to return to the list.",
      },
    },
    {
      element: "#clprofile-map",
      popover: {
        title: "Location Map",
        description: "Check that the company's location matches the address they registered with.",
      },
    },
    {
      element: "#clprofile-info",
      popover: {
        title: "Company Details",
        description: "Name, industry, address, email, and date. The badges show each department's status — Pending, Approved, or Rejected.",
      },
    },
    {
      element: "#clprofile-docs",
      popover: {
        title: "Verification Documents",
        description: "Review the submitted documents carefully before deciding. Tap one to view it larger.",
      },
    },
    {
      element: "#clprofile-actions",
      popover: {
        title: "Accept or Decline",
        description: "Accept adds the company to your Registered Companies; Decline rejects it for your department only. Both ask you to confirm first.",
      },
    },
  ],
  reportcompany: [
    {
      element: "#rc-total-badge",
      popover: {
        title: "Total Reports",
        description: "The total number of company reports filed so far.",
      },
    },
    {
      element: firstListItem(["#rc-report-list .rc-table-wrap tbody tr", "#rc-report-list .rc-card"], "#rc-report-list"),
      popover: {
        title: "Report List",
        description: "Each row is one report — the reported company, its concern, date filed, and status. Tap View on any row to see the full report.",
      },
    },
  ],
  // Steps for a single report's detail modal (ReportDetailModal) — used
  // whenever it's open, whether from Report List's View button or from a
  // notification on any screen. Steps whose element isn't rendered (no
  // attachment; DISMISS/RESOLVE vs. the "can no longer be changed" note)
  // are skipped automatically by runTour.
  reportdetail: [
    {
      element: "#rc-detail-info",
      popover: {
        title: "Report Summary",
        description: "Which company was reported, the concern raised, and the date the report was filed.",
      },
    },
    {
      element: "#rc-detail-status",
      popover: {
        title: "Company Account Status",
        description: "The reported company's current account status. View Action History shows every action taken on this company so far.",
      },
    },
    {
      element: "#rc-detail-description",
      popover: {
        title: "Description",
        description: "The full details of the report, as written by the one who filed it.",
      },
    },
    {
      element: "#rc-detail-attachment",
      popover: {
        title: "Attached File",
        description: "Supporting evidence attached to the report. Images can be tapped to view larger; use the button to download it.",
      },
    },
    {
      element: "#rc-detail-resolution",
      popover: {
        title: "Action Taken",
        description: "The action chosen when this report was resolved, together with the resolution notes.",
      },
    },
    {
      element: "#rc-detail-actions",
      popover: {
        title: "Dismiss or Resolve",
        description: "Dismiss closes the report with no action. Resolve lets you record the action taken on the company. Neither can be undone.",
      },
    },
    {
      element: "#rc-detail-locked",
      popover: {
        title: "Closed Report",
        description: "This report has already been resolved or dismissed, so it can no longer be changed.",
      },
    },
  ],
  // Steps for the Resolve Report modal, opened from RESOLVE above.
  reportresolve: [
    {
      element: "#rc-resolve-actions",
      popover: {
        title: "What Action Was Taken?",
        description: "Pick the action taken against the company — from requiring a correction or issuing a warning, up to suspending or blocking the account.",
      },
    },
    {
      element: "#rc-resolve-notes",
      popover: {
        title: "How Was This Resolved?",
        description: "Describe what was done to resolve the report. This is saved with the report.",
      },
    },
    {
      element: "#rc-resolve-footer",
      popover: {
        title: "Cancel or Confirm",
        description: "Cancel goes back without saving. Confirm Resolution unlocks once an action is picked and notes are written, then asks you to confirm once more.",
      },
    },
  ],
  studentsaccount: [
    {
      element: "#sa-search-bar",
      popover: {
        title: "Search",
        description: "Search students by name, ID, or email. The count above updates to match your current search and filters.",
      },
    },
    {
      element: "#sa-filter-btn",
      popover: {
        title: "Filters",
        description: "Narrow the list down by college, program, sex, or section. Active filters show as removable chips below.",
      },
    },
    {
      element: "#sa-toolbar-select",
      popover: {
        title: "Select & Delete",
        description: "Tap Select to check multiple students, then delete them in bulk — or select all at once.",
      },
    },
    {
      element: "#sa-toolbar-actions",
      popover: {
        title: "Export, Import, New Student",
        description: "Export selected students' credentials, bulk-import a whole section from a spreadsheet, or add one student account at a time.",
      },
    },
    {
      element: firstListItem(["#sa-student-list > .sa-row"], "#sa-student-list"),
      popover: {
        title: "Student List",
        description: "Each row is one student account in your department(s). Tap any row to view or edit that student's details, or use ⋮ for more actions.",
      },
    },
  ],
  // Steps for the student view/edit modal itself — separate from `studentsaccount`
  // above (which only covers the list view) since the modal covers the list once
  // it's open. Auto-fires the first time a new account opens a student, right
  // after (or independently of) the list's own auto-tour — see `tourKey` and the
  // AUTO_TOUR_NAV_KEYS effect below, same mechanism as `findcompanyprofile`.
  studentsaccountmodal: [
    {
      element: "#sa-modal-studentid",
      popover: {
        title: "Student ID",
        description: "The student's 9-digit ID number, used to generate their account and default password.",
      },
    },
    {
      element: "#sa-modal-department",
      popover: {
        title: "Department & Program",
        description: "The student's assigned department and program. Department is locked to your own; program can vary.",
      },
    },
    {
      element: "#sa-modal-info",
      popover: {
        title: "Section, Sex, Age",
        description: "Year & section, sex, and age on file for this student.",
      },
    },
    {
      element: "#sa-modal-password",
      popover: {
        title: "Default Password",
        description: "The student's auto-generated default password. Share this with them — they should change it after signing in.",
      },
    },
  ],
  // Steps for the Import modal inside Students Account — same idea as
  // `studentsaccountmodal`: the modal covers the list, so the list's own
  // steps would point at hidden elements. Set via onImportModalChange.
  studentsaccountimport: [
    {
      element: "#sa-import-dropzone",
      popover: {
        title: "Upload Your File",
        description: "Drop an Excel file here or click to browse. Only .xlsx or .xls files up to 10MB are accepted.",
      },
    },
    {
      element: "#sa-import-columns",
      popover: {
        title: "Required Columns",
        description: "Your file's header row must follow this exact column order, or the import will be rejected.",
      },
    },
    {
      element: "#sa-import-template",
      popover: {
        title: "Download the Template",
        description: "Get a ready-made Excel file with the correct columns already set up. Fill it in, then upload it here.",
      },
    },
    {
      element: "#sa-import-footer",
      popover: {
        title: "Choose File & Import",
        description: "Pick a different file anytime. Import becomes active once at least one valid row is found, and shows how many will be added.",
      },
    },
  ],
  messages: [
    {
      element: "#messages-search-bar",
      popover: {
        title: "Search Conversations",
        description: "Search your chats by company name. The list below updates to match what you type.",
      },
    },
    {
      element: firstListItem(["#messages-chat-list .msg-row"], "#messages-chat-list"),
      popover: {
        title: "Conversations",
        description: "Each row is one chat, newest activity first — unread ones are shaded. Tap any row to open the full conversation.",
      },
    },
  ],
  // Steps for an open conversation inside Messages (ChatView). Set via
  // CoordinatorMessagesScreen's onViewChange ("chat").
  messageschat: [
    {
      element: "#msgchat-header",
      popover: {
        title: "Conversation",
        description: "Who you're chatting with. Tap the back arrow to return to all your conversations.",
      },
    },
    {
      element: lastListItem([".msg-thread-body .msg-bubble-wrap"]),
      popover: {
        title: "Messages",
        description: "Tap and hold a message, or tap its ⋮, to reply to it. Your own messages can also be edited or unsent. \"Seen\" shows once they've read your latest message.",
      },
    },
    {
      element: "#msgchat-options",
      popover: {
        title: "Conversation Options",
        description: "More options for this chat, like deleting the conversation. Deleting only removes it for you.",
      },
    },
    {
      element: "#msgchat-attach",
      popover: {
        title: "Attach Files",
        description: "Attach PNG images or PDF files — up to 5 per message.",
      },
    },
    {
      element: "#msgchat-input",
      popover: {
        title: "Write a Message",
        description: "Type your message here. Press Enter to send.",
      },
    },
    {
      element: "#msgchat-send",
      popover: {
        title: "Send",
        description: "Sends your message and any attached files.",
      },
    },
  ],
  accountprofile: [
    {
      element: "#accprofile-personal-info",
      popover: {
        title: "Personal Information",
        description: "View and edit your name, contact details, and other personal info on file.",
      },
    },
    {
      element: "#accprofile-security",
      popover: {
        title: "Reset Password",
        description: "Change your account password. You'll be asked for your current password first.",
      },
    },
    {
      element: "#accprofile-account",
      popover: {
        title: "Add / Transfer Account",
        description: "Add a new coordinator account, or transfer this one to another coordinator in your department.",
      },
    },
    {
      element: "#accprofile-legal",
      popover: {
        title: "Terms & Privacy",
        description: "Review OJTern's Terms & Conditions and Privacy Policy at any time.",
      },
    },
  ],
  // ── Account Profile sub-views & modals ──────────────────────────────
  // Set via CoordinatorAccountProfileScreen's onViewChange (see tourKey).
  accprofilepersonal: [
    {
      element: "#pinfo-edit-btn",
      popover: {
        title: "Edit",
        description: "Tap Edit to update any of your details below.",
      },
    },
    {
      element: "#pinfo-name",
      popover: {
        title: "Name",
        description: "Your full name, as students and companies see it.",
      },
    },
    {
      element: "#pinfo-dept",
      popover: {
        title: "Department",
        description: "The department and program(s) you're assigned to. This decides which students and companies you see.",
      },
    },
    {
      element: "#pinfo-sex",
      popover: {
        title: "Sex",
        description: "Your sex on file.",
      },
    },
    {
      element: "#pinfo-contact",
      popover: {
        title: "Contact Number",
        description: "The mobile number you can be reached at.",
      },
    },
    {
      element: "#pinfo-email",
      popover: {
        title: "Email Address",
        description: "The email you log in with. Changing it needs a confirmation link sent to the new address.",
      },
    },
    {
      element: "#pinfo-address",
      popover: {
        title: "Address",
        description: "Your address on file.",
      },
    },
  ],
  accprofilepersonaledit: [
    {
      element: "#pinfo-name",
      popover: {
        title: "Name",
        description: "Type your full name.",
      },
    },
    {
      element: "#pinfo-sex",
      popover: {
        title: "Sex",
        description: "Choose Male or Female.",
      },
    },
    {
      element: "#pinfo-contact",
      popover: {
        title: "Contact Number",
        description: "Your mobile number — it's formatted as +63 000-000-0000 automatically as you type.",
      },
    },
    {
      element: "#pinfo-email",
      popover: {
        title: "Email Address",
        description: "Your login email. If you change it, you'll confirm with your password and a link sent to the new address.",
      },
    },
    {
      element: "#pinfo-address",
      popover: {
        title: "Address",
        description: "Province, city, barangay, and street.",
      },
    },
    {
      element: "#pinfo-save",
      popover: {
        title: "Save Changes",
        description: "Save your updated details, or Cancel to discard them.",
      },
    },
  ],
  accprofileterms: [
    {
      element: "#legal-header",
      popover: {
        title: "Title & Last Updated",
        description: "The document you're reading and the date it was last updated. If it changes, the date here changes too.",
      },
    },
    {
      element: "#legal-toc",
      popover: {
        title: "On This Page",
        description: "Every section of this document. Tap one to jump straight to it — the section you're reading is marked.",
      },
    },
    {
      element: "#legal-first-section",
      popover: {
        title: "Sections",
        description: "Each section explains one part of the document. Scroll down to read them all.",
      },
    },
    {
      element: "#legal-progress",
      popover: {
        title: "Reading Progress",
        description: "This thin bar fills up as you scroll, showing how far through the document you are.",
      },
    },
    {
      element: "#legal-understand-btn",
      popover: {
        title: "I Understand",
        description: "When you're done reading, tap this to return to your Account Profile.",
      },
    },
  ],
  accprofileprivacy: [
    {
      element: "#legal-header",
      popover: {
        title: "Title & Last Updated",
        description: "The document you're reading and the date it was last updated. If it changes, the date here changes too.",
      },
    },
    {
      element: "#legal-toc",
      popover: {
        title: "On This Page",
        description: "Every section of this document. Tap one to jump straight to it — the section you're reading is marked.",
      },
    },
    {
      element: "#legal-first-section",
      popover: {
        title: "Sections",
        description: "Each section explains one part of the document. Scroll down to read them all.",
      },
    },
    {
      element: "#legal-progress",
      popover: {
        title: "Reading Progress",
        description: "This thin bar fills up as you scroll, showing how far through the document you are.",
      },
    },
    {
      element: "#legal-understand-btn",
      popover: {
        title: "I Understand",
        description: "When you're done reading, tap this to return to your Account Profile.",
      },
    },
  ],
  accprofilereset: [
    {
      element: "#accreset-current",
      popover: {
        title: "Current Password",
        description: "Enter the password you use now, to confirm it's really you.",
      },
    },
    {
      element: "#accreset-new",
      popover: {
        title: "New Password",
        description: "Choose a new password you don't use anywhere else. A checklist appears as you type, showing what's still missing.",
      },
    },
    {
      element: "#accreset-confirm",
      popover: {
        title: "Confirm New Password",
        description: "Type the same new password again.",
      },
    },
    {
      element: "#accreset-footer",
      popover: {
        title: "Cancel or Save",
        description: "Save password updates it and signs you out — log back in with the new one. Cancel keeps your current password.",
      },
    },
  ],
  accprofileadd: [
    {
      element: "#accadd-banner",
      popover: {
        title: "Add Account",
        description: "Invites an additional OJT Coordinator. They get an email with an Accept link and set up their own login — your account stays exactly as it is.",
      },
    },
    {
      element: "#accadd-identity",
      popover: {
        title: "Confirm Your Identity",
        description: "Enter your own current password first, so no one else can do this from your account.",
      },
    },
    {
      element: "#accadd-dept",
      popover: {
        title: "Department and Program",
        description: "Locked to your own department — the new coordinator is placed under it automatically.",
      },
    },
    {
      element: "#accadd-email",
      popover: {
        title: "Email Address",
        description: "The new coordinator's email address. The invitation is sent here.",
      },
    },
    {
      element: "#accadd-footer",
      popover: {
        title: "Cancel or Send",
        description: "Send invitation emails the Accept link. Cancel closes this without sending anything.",
      },
    },
  ],
  accprofiletransfer: [
    {
      element: "#acctransfer-banner",
      popover: {
        title: "Transfer Account",
        description: "Hands this account over to another OJT Coordinator. You keep access until they accept — then the account is theirs and you're signed out automatically.",
      },
    },
    {
      element: "#acctransfer-identity",
      popover: {
        title: "Confirm Your Identity",
        description: "Enter your own current password first, so no one else can do this from your account.",
      },
    },
    {
      element: "#acctransfer-dept",
      popover: {
        title: "Department and Program",
        description: "Locked to your own department — the new coordinator is placed under it automatically.",
      },
    },
    {
      element: "#acctransfer-email",
      popover: {
        title: "Email Address",
        description: "The email of the coordinator taking over. The invitation is sent here.",
      },
    },
    {
      element: "#acctransfer-footer",
      popover: {
        title: "Cancel or Send",
        description: "Send invitation emails the Accept link. Nothing is transferred until they accept.",
      },
    },
  ],
  studentlist: [
    {
      element: "#sl-search-bar",
      popover: {
        title: "Search",
        description: "Search students by name, ID, or program. The count above updates to match your current search and filters.",
      },
    },
    {
      element: "#sl-export-btn",
      popover: {
        title: "Export",
        description: "Export the currently filtered list as a CSV (for Excel/Sheets) or a formatted PDF for printing.",
      },
    },
    {
      element: "#sl-filter-btn",
      popover: {
        title: "Filters",
        description: "Narrow the list down by college, program, specialization, sex, or section. Active filters show as removable chips below.",
      },
    },
    {
      element: "#sl-status-chips",
      popover: {
        title: "Placement Status",
        description: "Quickly filter by placement progress — Accepted, In Progress, All Declined, or No Applications yet.",
      },
    },
    {
      element: firstListItem(["#sl-student-list > *"], "#sl-student-list"),
      popover: {
        title: "Student List",
        description: "Each row is one student and their placement status. Tap any student to view their full placement details and application history.",
      },
    },
  ],
  // Steps for the Placement modal inside Student List — separate from
  // `studentlist` above since the modal covers the list once it's open.
  // Set via CoordinatorStudentListScreen's onViewingStudentChange.
  studentlistmodal: [
    {
      element: "#sl-modal-name",
      popover: {
        title: "Student",
        description: "The student whose placement you're viewing.",
      },
    },
    {
      element: "#sl-modal-message-btn",
      popover: {
        title: "Message",
        description: "Open a chat with this student directly from here.",
      },
    },
    {
      element: "#sl-modal-applications",
      popover: {
        title: "Applications",
        description: "Every company this student has applied to, with its current status. Tap \"View post\" to open that company's post.",
      },
    },
    {
      element: "#sl-modal-details",
      popover: {
        title: "Student Details",
        description: "Student ID, sex, college, program, and year & section on file for this student.",
      },
    },
  ],
};

// ── First-login gate tours ──────────────────────────────────────────────────────
// The two mandatory pop-ups a brand-new coordinator account walks through
// before it ever reaches the dashboard: forced password reset, then (on the
// NEXT login, since resetting the password signs them out) mandatory profile
// completion. Both get their own one-time driver.js walkthrough, auto-started
// the moment each pop-up mounts — see the `show`-triggered effects below.
const CHANGE_PASSWORD_STEPS = [
  {
    element: "#cp-current-password",
    popover: {
      title: "Current Password",
      description: "Enter the temporary password you were given when this account was created.",
    },
  },
  {
    element: "#cp-new-password",
    popover: {
      title: "New Password",
      description: "Choose your own password. The checklist below shows exactly what's still missing.",
    },
  },
  {
    element: "#cp-checklist",
    popover: {
      title: "Password Requirements",
      description: "Every item here needs a check mark before you can continue.",
    },
  },
  {
    element: "#cp-confirm-password",
    popover: {
      title: "Confirm Password",
      description: "Re-type the same new password to confirm it.",
    },
  },
  {
    element: "#cp-continue-btn",
    popover: {
      title: "Continue",
      description: "Saves your new password and signs you out. Log back in with it to finish setting up your account.",
    },
  },
];

const EDIT_INFO_STEPS = [
  {
    element: "#editinfo-card",
    popover: {
      title: "Complete Your Profile",
      description: "Before you can use the dashboard, add your personal information here and save it. This only appears once.",
    },
  },
];

// Delay before an AUTO-started tour (the two first-login gate pop-ups, and
// the dashboard's one-time welcome tour) fires — gives the just-mounted
// screen a moment to finish laying out so driver.js measures real element
// positions instead of a pre-layout frame. Manual "?" clicks skip this since
// the page is already fully on-screen.
const AUTO_TOUR_DELAY_MS = 450;

// Steps whose target must never cause the page to scroll/recenter when
// driver.js highlights them — Students Overview and Recent Registered
// Company should stay exactly where they are; only the tour popover moves.
const STEADY_TOUR_ELEMENT_IDS = ["dash-students-overview", "dash-recent-registered", "sa-student-list"];

// Shared driver.js launcher — both the "?" button and every auto-tour below
// call this, so they always look and behave identically.
const runTour = (steps) => {
  // driver.js only locks the page/body's own scroll while a tour is active —
  // it has no idea the dashboard actually scrolls through .main-content (and
  // Find Company's post view scrolls through its own inner div,
  // .coord-profile-content) instead of the body, so those containers stayed
  // freely scrollable underneath every step — including from a manual/touch
  // scroll — letting the highlighted card drift out from under the spotlight.
  // Both are locked here for the duration of the tour and restored on close.
  // #cprofile-details-full keeps its own inner scroll (it's the one step
  // where scrolling is the point) since it's a separate scroll box nested
  // inside .coord-profile-content, unaffected by locking the outer one.
  const scrollLockTargets = [
    document.querySelector(".main-content"),
    document.querySelector(".coord-profile-content"),
    // Company List (both its list and a company profile) scrolls through
    // its own .clist-list-wrapper, not .main-content.
    document.querySelector(".clist-list-wrapper"),
    // Report modals scroll inside their own bodies — lock those too so the
    // content can't slide out from under the highlight mid-step.
    document.querySelector(".rc-resolve-body"),
    document.querySelector(".rc-modal-body"),
    // An open conversation scrolls inside its own thread body.
    document.querySelector(".msg-thread-body"),
    // Account Profile: modal bodies, the info card body, and legal pages.
    document.querySelector(".cap-modal-body"),
    document.querySelector(".cap-info-body"),
    document.querySelector(".legal-scroll"),
    document.querySelector(".legal-toc"),
  ].filter(Boolean);
  // Where each container was before the tour, so we can put it back after —
  // the tour scrolls boxes to reach later steps (e.g. "I understand" at the
  // very bottom of Terms), which shouldn't leave the page scrolled there.
  const initialScrollTop = scrollLockTargets.map(el => el.scrollTop);
  const prevOverflowY = scrollLockTargets.map(el => el.style.overflowY || "");
  // Remember exactly where each container was sitting when the tour opened,
  // so if anything still manages to scroll it (e.g. iOS momentum scroll,
  // which can keep coasting for a moment even after overflow is hidden),
  // it snaps straight back instead of leaving the highlight stranded.
  const lockedScrollTop = scrollLockTargets.map(el => el.scrollTop);
  // driver.js's own scrollIntoView (moving to the next step) must still be
  // allowed through — otherwise snapBack undoes it and any step below the
  // fold (e.g. Company List's "Company Details") gets highlighted off-screen.
  // Only user/momentum scrolling is snapped back.
  let allowTourScroll = false;
  const snapBack = () => {
    if (allowTourScroll) return;
    scrollLockTargets.forEach((el, i) => { el.scrollTop = lockedScrollTop[i]; });
  };
  scrollLockTargets.forEach(el => {
    el.style.overflowY = "hidden";
    el.addEventListener("scroll", snapBack);
  });
  const restoreScroll = () => {
    scrollLockTargets.forEach((el, i) => {
      el.removeEventListener("scroll", snapBack);
      el.style.overflowY = prevOverflowY[i];
      if (el.isConnected) el.scrollTop = initialScrollTop[i];
    });
  };

  // Drop any step whose target isn't on screen right now (e.g. Accept/Decline
  // only renders while a department is still pending, and the Department /
  // Program block only when the company has one) — otherwise driver.js
  // shows that step as a floating popover pointing at nothing.
  steps = (steps || [])
    .map(s => (typeof s.element === "function" ? { ...s, element: s.element() || undefined, _resolved: true } : s))
    .filter(s => s._resolved ? !!s.element : (!s.element || document.querySelector(s.element)))
    .map(({ _resolved, ...s }) => s);

  // Scrolls each scrollable ancestor of `el` (modal bodies, .clist-list-
  // wrapper, etc. — including ones locked to overflow: hidden above, which
  // still scroll programmatically) just enough that `el` is fully visible
  // inside it, with a little breathing room. If `el` is taller than the box,
  // its top is aligned instead. Returns true if anything moved.
  const scrollIntoScrollParents = (el) => {
    const PAD = 12;
    let moved = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.scrollHeight <= p.clientHeight + 1) continue;
      const oy = getComputedStyle(p).overflowY;
      if (!/(auto|scroll|hidden|overlay)/.test(oy)) continue;
      const pr = p.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      let delta = 0;
      if (er.height > pr.height - PAD * 2 || er.top < pr.top + PAD) {
        delta = er.top - (pr.top + PAD);          // align top
      } else if (er.bottom > pr.bottom - PAD) {
        delta = er.bottom - (pr.bottom - PAD);    // bring bottom into view
      }
      if (Math.abs(delta) > 1) {
        const before = p.scrollTop;
        p.scrollTop = before + delta;
        if (p.scrollTop !== before) moved = true;
      }
    }
    return moved;
  };

  let activeResizeObserver = null;

  // Lock everything while a tour is running: the highlighted element can't
  // be clicked/tapped (so e.g. "Message Now!", Accept/Decline, Back, or a
  // document thumbnail won't fire mid-tour) — only the tour popover's own
  // Previous / Next / Done buttons respond. Done in the capture phase on
  // window so it runs before React's handlers. Deliberately NOT using
  // driver.js's `disableActiveInteraction`, since that sets pointer-events:
  // none on the target and would also kill wheel/touch scrolling inside the
  // steps that are their own scroll boxes (#cprofile-details-full,
  // #clprofile-info) — here only clicks are blocked, scrolling still works.
  const blockOutsidePopover = (e) => {
    if (e.target?.closest?.(".driver-popover")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const BLOCKED_EVENTS = ["click", "dblclick", "auxclick", "contextmenu"];
  BLOCKED_EVENTS.forEach(ev => window.addEventListener(ev, blockOutsidePopover, true));
  // driver.js closes on Escape when allowClose is on — swallow it here (in
  // the capture phase, before driver's own key listener) so only the ✕
  // button or "Done" ends the tour.
  const blockEscape = (e) => {
    if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  ["keydown", "keyup"].forEach(ev => window.addEventListener(ev, blockEscape, true));
  const unblockClicks = () => {
    BLOCKED_EVENTS.forEach(ev => window.removeEventListener(ev, blockOutsidePopover, true));
    ["keydown", "keyup"].forEach(ev => window.removeEventListener(ev, blockEscape, true));
  };

  const tourDriver = driver({
    showProgress: (steps?.length ?? 0) > 1,
    // The tour can be exited two ways only: the ✕ button on the popover, or
    // "Done" on the last step. Clicking the dark overlay still does nothing
    // (that click is swallowed by blockOutsidePopover above, since the
    // overlay isn't inside .driver-popover) and Esc is swallowed by
    // blockEscape — so it can't be dismissed by accident.
    allowClose: true,
    showButtons: ["next", "previous", "close"],
    onDestroyed: () => { restoreScroll(); unblockClicks(); activeResizeObserver?.disconnect(); },
    // driver.js calls element.scrollIntoView() every time it highlights a
    // step's target, which can shift the whole page even when the card is
    // already fully on screen. For the two cards that must stay put, swap
    // scrollIntoView for a no-op just long enough for that one call to fire,
    // then put the real one back — every other step's scrolling is untouched.
    onHighlighted: (element) => {
      // Keep the highlight glued to the target if its size changes while
      // it's showing — e.g. "Loading…" turning into a status badge, a map
      // or image finishing loading, or a list filling in from Firestore.
      activeResizeObserver?.disconnect();
      if (element && typeof ResizeObserver !== "undefined") {
        activeResizeObserver = new ResizeObserver(() => tourDriver?.refresh?.());
        activeResizeObserver.observe(element);
      }
      // Driver has finished scrolling to this step — make that the new
      // locked position, then resume snapping back any other scroll.
      setTimeout(() => {
        scrollLockTargets.forEach((el, i) => { lockedScrollTop[i] = el.scrollTop; });
        allowTourScroll = false;
      }, 60);
    },
    onHighlightStarted: (element) => {
      allowTourScroll = true;
      activeResizeObserver?.disconnect();
      activeResizeObserver = null;
      if (element?.id && STEADY_TOUR_ELEMENT_IDS.includes(element.id)) {
        const original = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function () {};
        setTimeout(() => { Element.prototype.scrollIntoView = original; }, 0);
        return;
      }
      // driver.js only scrolls when the target is outside the WINDOW's
      // viewport — it doesn't know about scroll boxes inside modals (e.g. the
      // Resolve Report body), so a target sitting below that box's visible
      // area (like "How was this resolved?") got highlighted half-hidden,
      // with the spotlight spilling over the footer. Scroll every scrollable
      // ancestor ourselves so the target is fully in view, then have driver
      // re-measure so the highlight lands exactly on it.
      if (element && scrollIntoScrollParents(element)) {
        requestAnimationFrame(() => tourDriver?.refresh?.());
      }
    },
    steps: steps && steps.length > 0
      ? steps
      : [{
          popover: {
            title: "Help",
            description: "There's no guided tour for this page yet.",
          },
        }],
  });
  tourDriver.drive();
};

// ── Floating "?" help button ────────────────────────────────────────────────────
// Fixed to the bottom-right corner and rendered once at the top level of the
// screen (outside renderContent), so it stays on-screen no matter which nav
// item is active. Runs a driver.js spotlight tour scoped to HELP_STEPS_BY_NAV
// for the current screen; falls back to a plain centered message for any
// screen that doesn't have steps configured yet. This is the ALWAYS-available
// manual trigger — separate from (and unaffected by) the auto-tours below,
// which only ever fire once each: once for the password gate, once for the
// profile-completion gate, and once for the dashboard's first-ever visit
// right after a genuinely new account finishes that gate flow.
// Drag settings for the "?" button (accessibility: move it out of the way of
// whatever it's covering — e.g. a chat's send button).
const HELP_FAB_SIZE        = 56;
const HELP_FAB_EDGE        = 12;   // min gap kept from every screen edge
const HELP_FAB_HOVER_FOLLOW = 1000; // mouse: hover this long → it follows the cursor
const HELP_FAB_DRAG_START  = 6;    // touch: px of finger movement that starts a drag
const HELP_FAB_POS_KEY     = "ojtern.helpFabPos";
const HELP_FAB_SNAP_GAP    = 24;   // space kept from the side it snaps to
const HELP_FAB_TOP_MIN     = 86;   // stay below the 70px top bar (+ gap)
const HELP_FAB_IDLE_MS     = 10000; // fade after 10s untouched

// Keeps the button fully on-screen for the current window size.
const clampHelpFabPos = ({ x, y }) => ({
  x: Math.min(Math.max(HELP_FAB_EDGE, x), Math.max(HELP_FAB_EDGE, window.innerWidth  - HELP_FAB_SIZE - HELP_FAB_EDGE)),
  y: Math.min(Math.max(HELP_FAB_EDGE, y), Math.max(HELP_FAB_EDGE, window.innerHeight - HELP_FAB_SIZE - HELP_FAB_EDGE)),
});

// Where it settles after being let go: the nearer LEFT or RIGHT side, with
// HELP_FAB_SNAP_GAP of space (not flush against the edge), keeping the
// height it was dropped at but never under the top bar or off the bottom.
const snapHelpFabPos = ({ x, y }) => {
  const w = window.innerWidth, h = window.innerHeight;
  const toLeft = x + HELP_FAB_SIZE / 2 < w / 2;
  const maxY = Math.max(HELP_FAB_TOP_MIN, h - HELP_FAB_SIZE - HELP_FAB_SNAP_GAP);
  return {
    x: toLeft ? HELP_FAB_SNAP_GAP : Math.max(HELP_FAB_SNAP_GAP, w - HELP_FAB_SIZE - HELP_FAB_SNAP_GAP),
    y: Math.min(Math.max(HELP_FAB_TOP_MIN, y), maxY),
  };
};

const FloatingHelpButton = ({ activeNav, onBeforeTour }) => {
  // ── Draggable position ──────────────────────────────────────────────────
  // • Touch / pen: just hold and move — it drags right away, no long press.
  //   A plain tap (no movement) opens the tour.
  // • Mouse: hover over it for HELP_FAB_HOVER_FOLLOW (1s) and it starts
  //   following the cursor; click anywhere to drop it there. A normal click
  //   before the 1s is up opens the tour.
  // null = default bottom-right corner. The chosen spot is remembered on
  // this device (localStorage) and re-clamped if the window is resized.
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HELP_FAB_POS_KEY) || "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return snapHelpFabPos(saved);
    } catch { /* storage unavailable — fall back to the default corner */ }
    return null;
  });
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [idle, setIdle]         = useState(false);
  const [arming, setArming]     = useState(false); // mouse hover countdown running
  const idleTimer  = useRef(null);
  const snapTimer  = useRef(null);
  const hovering   = useRef(false);

  // ── Idle fade ───────────────────────────────────────────────────────────
  // Any interaction with the button wakes it to full opacity and restarts
  // the 10s countdown; the countdown is paused while hovered or dragged.
  const scheduleIdle = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!hovering.current && !dragActive.current) setIdle(true);
    }, HELP_FAB_IDLE_MS);
  };
  const wake = () => { setIdle(false); scheduleIdle(); };
  const posRef        = useRef(pos);
  const pressTimer    = useRef(null);
  const pressStart    = useRef(null);   // { x, y } where the press began
  const grabOffset    = useRef({ x: 0, y: 0 });
  const dragActive    = useRef(false);
  const suppressClick = useRef(false);  // swallow the click that ends a drag

  useEffect(() => { posRef.current = pos; }, [pos]);

  useEffect(() => {
    const onResize = () => setPos(p => (p ? snapHelpFabPos(p) : p));
    window.addEventListener("resize", onResize);
    scheduleIdle(); // start the first 10s countdown on mount
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(pressTimer.current);
      clearTimeout(idleTimer.current);
      clearTimeout(snapTimer.current);
      clearTimeout(hoverTimer.current);
      followCleanup.current?.();
    };
  }, []);

  // Glide to the nearer side (with a gap), then remember that spot.
  const settle = () => {
    if (!posRef.current) return;
    const snapped = snapHelpFabPos(posRef.current);
    setSnapping(true);
    setPos(snapped);
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => setSnapping(false), 360);
    try { localStorage.setItem(HELP_FAB_POS_KEY, JSON.stringify(snapped)); } catch { /* ignore */ }
  };

  // ── Mouse: hover 1s → follow the cursor, click anywhere to drop ──────────
  const hoverTimer    = useRef(null);
  const following     = useRef(false);
  const followCleanup = useRef(null);
  const lastMouse     = useRef({ x: 0, y: 0 });

  const stopFollowing = () => {
    if (!following.current) return;
    following.current = false;
    dragActive.current = false;
    followCleanup.current?.();
    followCleanup.current = null;
    setDragging(false);
    settle();
    scheduleIdle();
  };

  const startFollowing = () => {
    following.current = true;
    dragActive.current = true;
    setArming(false);
    setDragging(true);
    const half = HELP_FAB_SIZE / 2;
    const place = (x, y) => setPos(clampHelpFabPos({ x: x - half, y: y - half }));
    place(lastMouse.current.x, lastMouse.current.y);
    const onMove = (ev) => place(ev.clientX, ev.clientY);
    // The click that drops it must not ALSO press whatever is underneath
    // (or open the tour) — swallow exactly that one click.
    const swallowClick = (ev) => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      window.removeEventListener("click", swallowClick, true);
    };
    const onDown = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      window.addEventListener("click", swallowClick, true);
      setTimeout(() => window.removeEventListener("click", swallowClick, true), 600);
      stopFollowing();
    };
    const onKey = (ev) => { if (ev.key === "Escape") stopFollowing(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    followCleanup.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  };

  const onPointerEnter = (e) => {
    hovering.current = true;
    setIdle(false);
    clearTimeout(idleTimer.current);
    if (e.pointerType !== "mouse" || following.current) return;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setArming(true);
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(startFollowing, HELP_FAB_HOVER_FOLLOW);
  };

  const onPointerLeave = (e) => {
    hovering.current = false;
    if (e.pointerType === "mouse" && !following.current) {
      clearTimeout(hoverTimer.current);
      setArming(false);
    }
    scheduleIdle();
  };

  // ── Touch / pen: hold and move to drag straight away ─────────────────────
  const endPress = (e) => {
    if (e?.pointerType === "mouse") return;
    pressStart.current = null;
    try { e?.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* not captured */ }
    if (dragActive.current && !following.current) {
      dragActive.current = false;
      suppressClick.current = true; // the lift after a drag isn't a tap
      setDragging(false);
      settle();
    }
    hovering.current = false;
    scheduleIdle();
  };

  const onPointerDown = (e) => {
    wake();
    if (e.pointerType === "mouse") {
      // A real click before the 1s hover finished — it's a click, not a move.
      clearTimeout(hoverTimer.current);
      setArming(false);
      return;
    }
    setSnapping(false);
    suppressClick.current = false;
    const rect = e.currentTarget.getBoundingClientRect();
    pressStart.current = { x: e.clientX, y: e.clientY };
    grabOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onPointerMove = (e) => {
    if (e.pointerType === "mouse") { lastMouse.current = { x: e.clientX, y: e.clientY }; return; }
    if (!pressStart.current) return;
    if (!dragActive.current) {
      const dx = e.clientX - pressStart.current.x, dy = e.clientY - pressStart.current.y;
      if (Math.hypot(dx, dy) < HELP_FAB_DRAG_START) return; // still just a tap
      dragActive.current = true;
      setDragging(true);
      navigator.vibrate?.(10);
    }
    e.preventDefault();
    setPos(clampHelpFabPos({ x: e.clientX - grabOffset.current.x, y: e.clientY - grabOffset.current.y }));
  };

  // Close any open top-bar dropdown (Activity Log / Notifications / Theme)
  // first, then start the tour on the next frame once React has removed it —
  // otherwise the dropdown stays floating over the page under the tour.
  // (In-screen filter / export panels already close themselves on any
  // outside mousedown, which pressing this button is.)
  const handleClick = () => {
    wake();
    if (suppressClick.current) { suppressClick.current = false; return; } // was a drag, not a tap
    onBeforeTour?.();
    requestAnimationFrame(() => runTour(HELP_STEPS_BY_NAV[activeNav]));
  };

  return (
    <button
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={wake}
      // Stops the long-press context menu / callout on touch screens.
      onContextMenu={e => e.preventDefault()}
      aria-label="Help"
      title="Need Help? - hover it 1 second and drag it (just drag it on mobile devices)"
      className={`help-fab${dragging ? " help-fab-dragging" : ""}${arming && !dragging ? " help-fab-arming" : ""}${snapping ? " help-fab-snapping" : ""}${idle && !dragging ? " help-fab-idle" : ""}`}
      style={{
        position: "fixed",
        ...(pos
          ? { left: `${pos.x}px`, top: `${pos.y}px`, right: "auto", bottom: "auto" }
          : { bottom: "24px", right: "24px" }),
        // touch-action: none so a long press + drag on touch screens moves
        // the button instead of scrolling the page underneath it.
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        width: "56px",
        height: "56px",
        borderRadius: "50%",
        background: paper,
        border: `1px solid ${hairline}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        // 500 used to sit under CoordinatorStudentsAcccountScreen's own
        // modals (StudentForm view/edit = 1000, ImportModal = 1000, its
        // Dialog = 2100, the "Account created" card = 2000) — so opening
        // "View" on a student, or any other in-screen modal there, buried
        // the FAB behind the dark overlay instead of floating on top of it.
        // 3000 clears every in-screen modal on every coordinator screen
        // while staying below the app-wide 9999 blocking gates (forced
        // password change, logout confirm) — those SHOULD still cover it.
        zIndex: 3000,
      }}
    >
      <svg
        className="help-fab-icon"
        width="26" height="26" viewBox="0 0 24 24"
        fill="none" stroke={ink} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: `stroke 0.18s ${ease}` }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a2.9 2.9 0 0 1 5.66.9c0 1.9-2.66 2.4-2.66 4.1" />
        {/* r was 0.1 — effectively sub-pixel at this icon size, so the dot of
            the "?" all but disappeared (the "putol" look). 1.05 renders as a
            proper solid dot while still sitting inside the circle comfortably. */}
        <circle className="help-fab-icon-dot" cx="12" cy="17.15" r="1.05" fill={ink} stroke="none" />
      </svg>
    </button>
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
  const [coordinatorProfileLoaded, setCoordinatorProfileLoaded] = useState(false);
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getUserProfile("coordinators", user.uid).then((data) => {
      if (!cancelled) {
        setCoordinatorProfile(data || null);
        setCoordinatorProfileLoaded(true);
      }
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

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    // I-unmount muna agad ang dashboard (kasama ang malinis na pag-unsubscribe
    // ng lahat ng live na onSnapshot listeners nito) BAGO pa aktwal na
    // mag-sign-out sa Firebase. Kung hihintayin muna natin ang signOut()
    // bago mag-navigate — habang buo pang naka-mount ang dashboard — sabay-
    // sabay na mag-eerror ang lahat ng listeners nito (reports, companies,
    // activity_logs, atbp.) sa sandaling ma-invalidate ang auth token, at
    // doon nagmumula ang pakiramdam na "matagal, parang stuck." Sa pag-
    // navigate/unmount muna, malinis munang natatanggal ang mga listeners
    // bago pa sila magkaroon ng pagkakataong mag-error.
    setCachedCoordinatorUid(null);
    onLogout?.();
    logOut().catch((err) => console.error("Logout failed:", err));
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

  // ── Nav bar accent color picker ─────────────────────────────────────────────
  // Scoped per ACCOUNT (uid), not just per role — `coordinator-${uid}` is its
  // own storage key, completely separate from every other coordinator
  // account's choice. This is the fix for the theme "leaking" between
  // accounts that share a browser/device: a brand-new account's uid has
  // never been seen on this browser before, so there's no entry for it yet,
  // and getSavedAccentThemeId's own fallback returns "default" (black/
  // white) — exactly the "always default on a fresh login" behavior wanted,
  // with zero dependency on department/college. (Before this, the key was
  // just "coordinator" — shared by every coordinator account on the same
  // browser, which is why a brand-new account could inherit whatever color
  // a DIFFERENT account had last picked there.)
  // Walang binabasa mula sa localStorage habang hindi pa alam ang uid ng
  // account — dati, gumagamit ito ng generic/bare "coordinator" key bilang
  // fallback, na maaaring may lumang natirang data pa mula bago pa i-scope
  // per account ang key na ito. Kaya sa bawat refresh, sandaling kumikislap
  // yung LUMANG/ibang kulay bago mag-switch sa tamang account-specific na
  // kulay. Sa halip, magsisimula muna tayo sa neutral na "default"
  // (black/white) habang hinihintay ang uid, para wala nang lumalabas na
  // maling/ibang account's na kulay kahit sandali man lang.
  // Priyoridad: (1) totoong uid mula sa `user` prop kapag available na, (2)
  // yung huling na-cache na uid sa localStorage bilang best-guess habang
  // hinihintay pa ang auth. Kaya kahit sa PINAKAUNANG render pagka-refresh,
  // tama na agad ang scope na binabasa — hindi na kailangang dumaan sa
  // "default muna" bago sa tamang kulay.
  const resolveAccentScope = (uid) => (uid ? `coordinator-${uid}` : null);
  const initialAccentScope = resolveAccentScope(user?.uid || getCachedCoordinatorUid());

  const accentScope = resolveAccentScope(user?.uid);
  const [accentThemeId, setAccentThemeId] = useState(() =>
    initialAccentScope ? getSavedAccentThemeId(initialAccentScope) : "default"
  );
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    // I-remember ang uid na ito para sa PINAKAUNANG paint ng susunod na
    // refresh — hindi na kailangang hintayin ulit ang auth para malaman kung
    // sinong account ito.
    setCachedCoordinatorUid(user.uid);
    setAccentThemeId(getSavedAccentThemeId(`coordinator-${user.uid}`));
  }, [user?.uid]);

  const handleSelectAccent = (id) => {
    if (!accentScope) return; // walang dapat masave habang hindi pa alam ang account uid
    setAccentThemeId(saveAccentThemeId(accentScope, id));
    setShowThemeDropdown(false);
  };
  // View-icon PNG matching the current accent color (falls back to the
  // original black/white blackview.png for "default").
  const themedViewIcon = getThemedAsset(VIEW_ICON_BY_THEME, accentThemeId);
  // blackuser.png / blackcompanyprofile.png (default) and colored variants for the same accent color.
  const themedUserIcon    = getThemedAsset(USER_ICON_BY_THEME, accentThemeId);
  const themedCompanyIcon = getThemedAsset(COMPANY_PROFILE_ICON_BY_THEME, accentThemeId);

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
  // Tracks whether Find Company is showing its list or a single company's
  // post ("profile"). Lets the "?" help button and the auto-tour switch to
  // HELP_STEPS_BY_NAV.findcompanyprofile while a post is open, instead of
  // always running the list's steps (search bar / filter / grid) against a
  // screen that isn't showing them. Set via CoordinatorViewCompanyScreen's
  // onViewChange, so it updates the same way whether the post was opened by
  // clicking a card in the list OR by a deep link (Recent Visited, Placement).
  const [findCompanySubView, setFindCompanySubView] = useState("list");
  // Mirrors findCompanySubView: true while a student's view/edit modal is open
  // inside Students Account, so the "?" button and auto-tour can switch to
  // HELP_STEPS_BY_NAV.studentsaccountmodal instead of the list's own steps.
  // Set via CoordinatorStudentsAcccountScreen's onViewingStudentChange.
  const [studentAccountModalOpen, setStudentAccountModalOpen] = useState(false);
  // Same as above for the Import modal (Students Account) and the Placement
  // modal (Student List) — switch the "?" tour to their own steps.
  const [studentImportModalOpen, setStudentImportModalOpen]   = useState(false);
  const [studentListModalOpen, setStudentListModalOpen]       = useState(false);
  // Company List: "list" | "registered" | "review" — which profile (if any)
  // is open, so the "?" tour matches it. Set via its onViewChange.
  const [companyListSubView, setCompanyListSubView]           = useState("list");
  // True while the Resolve Report modal is open on top of a report's detail
  // modal. Set via ReportDetailModal's onResolvePanelChange.
  const [reportResolveOpen, setReportResolveOpen]             = useState(false);
  // Messages: "list" | "chat" — set via CoordinatorMessagesScreen's onViewChange.
  const [messagesSubView, setMessagesSubView]                 = useState("list");
  // Account Profile: which sub-view / modal is showing ("main" = the menu).
  const [profileSubView, setProfileSubView]                   = useState("main");
  const [currentPass, setCurrentPass]       = useState("");
  const [newPass, setNewPass]               = useState("");
  const [confirmPass, setConfirmPass]       = useState("");
  const [passError, setPassError]           = useState("");
  const [passLoading, setPassLoading]       = useState(false);
  const [showNew, setShowNew]               = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [setupLogoutBusy, setSetupLogoutBusy] = useState(false);

  // Lets a brand-new coordinator bail out of the mandatory password/profile
  // gate instead of being stuck — mirrors StudentDashboardScreen's
  // handleSetupLogout (clear the cached uid, notify the parent, sign out).
  const handleSetupLogout = () => {
    if (setupLogoutBusy) return;
    setSetupLogoutBusy(true);
    setCachedCoordinatorUid(null);
    onLogout?.();
    logOut().catch((err) => console.error("Logout failed:", err));
  };

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
  //
  // wasNewAccountFlow ang tunay na basehan ng automatic help sa dashboard sa
  // baba: totoo lang ito kung, sa mismong pag-check na ito (ibig sabihin sa
  // simula ng SESSION/LOGIN na ito), kailangan pa palang punan ang personal
  // info (`user.passwordChanged && !user.profileComplete`) — ibig sabihin
  // literal na dumaan sila sa set-password-then-add-info na flow. Kung sa
  // simula pa lang ng session na ito ay kumpleto na yung dalawa (existing
  // account, hindi bago), `false` agad ito at manatiling `false` habang buo
  // ang session — kahit ano pang mangyari sa showChangePass/showEditInfo
  // states pagkatapos nito, hindi na ito magbabago. Galing mismo ito sa mga
  // field na sinusulat ng AuthService (`passwordChanged`, `profileComplete`),
  // hindi sa hiwalay na "seen" flag.
  const didGateInit = useRef(false);
  useEffect(() => {
    if (!user?.uid || !coordinatorProfileLoaded || didGateInit.current) return;
    didGateInit.current = true;
    const passwordChanged = coordinatorProfile?.passwordChanged ?? user.passwordChanged;
    const profileComplete = coordinatorProfile?.profileComplete ?? user.profileComplete;
    const needsProfileInfo = !!passwordChanged && !profileComplete;
    setShowChangePass(!passwordChanged);
    setShowEditInfo(needsProfileInfo);

    // Onboarding tours ay opt-in PER ACCOUNT, at ang "opt-in" mismo ay
    // permanenteng naka-mark sa Firestore sa pamamagitan ng presensya ng
    // `seenTours` field — hindi na sa in-memory ref lang tulad ng dati, kaya
    // hindi na ito nawawala pag-refresh o bagong session. Isang beses lang
    // itong ma-i-initialize: sa mismong sandaling ma-confirm nating kailangan
    // pa palang punan ng account ang profile nito (ibig sabihin, tunay na
    // bagong account). Kung wala kailanman itong `needsProfileInfo` na true
    // (existing/returning account), hindi kailanman magkakaroon ng
    // `seenTours` field — kaya manual "?" button lang pa rin sila, gaya ng
    // dati.
    if (needsProfileInfo && !coordinatorProfile?.seenTours) {
      setDoc(doc(db, "coordinators", user.uid), { seenTours: {} }, { merge: true })
        .catch((err) => console.error("Failed to initialize onboarding tour tracking:", err));
      setCoordinatorProfile(prev => ({ ...(prev || {}), seenTours: {} }));
    }
  }, [user?.uid, coordinatorProfileLoaded, coordinatorProfile]);

  // Auto-starts the walkthrough the moment the mandatory "complete your
  // profile" pop-up appears — same one-time-per-mount pattern as the
  // password gate. This only ever mounts once per account too: it shows
  // exactly while passwordChanged is true and profileComplete is still
  // false, and closes itself for good once PersonalInfoScreen saves.
  const editInfoTourFired = useRef(false);
  useEffect(() => {
    if (!showEditInfo || editInfoTourFired.current) return;
    editInfoTourFired.current = true;
    const t = setTimeout(() => runTour(EDIT_INFO_STEPS), AUTO_TOUR_DELAY_MS);
    return () => clearTimeout(t);
  }, [showEditInfo]);

  // ── Auto-tour: the screens that get one for a brand-new account ────────
  // Same "new account" flow as before (forced password reset → forced
  // profile completion → THEN screens become reachable), but generalized
  // beyond just "dashboard" so Find Company gets its own one-time tour too:
  // the first time a new account's session lands on Find Company, its steps
  // (HELP_STEPS_BY_NAV.findcompany) auto-play once, independently of
  // whether the dashboard tour already fired. Add another nav key here
  // (with a matching HELP_STEPS_BY_NAV entry) to give any other screen this
  // same treatment.
  // Effective key for tour lookups: normally just the nav tab, but while a
  // company post is open inside Find Company, its own steps take over (see
  // findCompanySubView above).
  // A report's detail modal can be opened from any screen (notifications),
  // so it takes priority over every nav-based key.
  const tourKey = viewingReport ? (reportResolveOpen ? "reportresolve" : "reportdetail")
    : (activeNav === "findcompany" && findCompanySubView === "profile") ? "findcompanyprofile"
    : (activeNav === "studentsaccount" && studentImportModalOpen) ? "studentsaccountimport"
    : (activeNav === "studentsaccount" && studentAccountModalOpen) ? "studentsaccountmodal"
    : (activeNav === "studentlist" && studentListModalOpen) ? "studentlistmodal"
    : (activeNav === "companylist" && companyListSubView === "registered") ? "companylistregistered"
    : (activeNav === "companylist" && companyListSubView === "review") ? "companylistreview"
    : (activeNav === "messages" && messagesSubView === "chat") ? "messageschat"
    : (activeNav === "accountprofile" && PROFILE_TOUR_KEYS[profileSubView]) ? PROFILE_TOUR_KEYS[profileSubView]
    : activeNav;

  const AUTO_TOUR_NAV_KEYS = Object.keys(HELP_STEPS_BY_NAV);
  // Pumipigil lang sa double-fire sa loob ng maikling gap bago maisave sa
  // Firestore/ma-reflect sa local state (hal. dahil sa React Strict Mode sa
  // dev) — hindi ito ang "totoong" tracker, `seenTours` sa Firestore iyon.
  const tourFiringRef = useRef({});
  useEffect(() => {
    if (!user?.uid || showChangePass || showEditInfo) return;
    // Walang `seenTours` field = hindi ito onboarding account (existing/
    // returning account) — manual "?" button lang, walang auto-tour kahit saan.
    if (!coordinatorProfileLoaded || !coordinatorProfile?.seenTours) return;
    if (!AUTO_TOUR_NAV_KEYS.includes(tourKey)) return;
    if (coordinatorProfile.seenTours[tourKey] || tourFiringRef.current[tourKey]) return;
    const steps = HELP_STEPS_BY_NAV[tourKey];
    if (!steps || steps.length === 0) return;

    tourFiringRef.current[tourKey] = true;
    const t = setTimeout(() => {
      runTour(steps);
      // Permanenteng i-mark sa Firestore na nakita na ito ng account — kahit
      // anong session/refresh/araw pa, hindi na ito muling lalabas dito.
      setDoc(doc(db, "coordinators", user.uid), { seenTours: { [tourKey]: true } }, { merge: true })
        .catch((err) => console.error("Failed to save seen tour state:", err));
      setCoordinatorProfile(prev => ({
        ...(prev || {}),
        seenTours: { ...(prev?.seenTours || {}), [tourKey]: true },
      }));
    }, AUTO_TOUR_DELAY_MS);
    return () => clearTimeout(t);
  }, [tourKey, user?.uid, showChangePass, showEditInfo, coordinatorProfileLoaded, coordinatorProfile]);

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
      return [{ id, name: name || id, visitedAt: Date.now() }, ...filtered];
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

  useEffect(() => {
    if (activeNav !== "studentsaccount") { setStudentAccountModalOpen(false); setStudentImportModalOpen(false); }
    if (activeNav !== "studentlist") setStudentListModalOpen(false);
    if (activeNav !== "companylist") setCompanyListSubView("list");
    if (activeNav !== "messages") setMessagesSubView("list");
    if (activeNav !== "accountprofile") setProfileSubView("main");
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
        viewIcon={themedViewIcon}
        companyProfileIcon={themedCompanyIcon}
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
        onViewChange={setFindCompanySubView}
      />
    );

    if (activeNav === "studentsaccount") return (
      <CoordinatorStudentsAcccountScreen
        coordinatorUid={user?.uid}
        coordinatorColleges={coordinatorColleges}
        userIcon={themedUserIcon}
        onViewingStudentChange={setStudentAccountModalOpen}
        onImportModalChange={setStudentImportModalOpen}
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
        userIcon={themedUserIcon}
        viewIcon={themedViewIcon}
        onViewingStudentChange={setStudentListModalOpen}
      />
    );

    if (activeNav === "companylist") return (
      <CoordinatorCompanyListScreen
        coordinatorUid={user?.uid}
        initialCompanyId={dashboardTarget === "companylist" ? dashboardCompanyId : null}
        onClearInitialCompany={() => { setDashboardCompanyId(null); setDashboardTarget(null); }}
        onBackToOrigin={() => navigate("dashboard")}
        onViewChange={setCompanyListSubView}
      />
    );

    if (activeNav === "messages") return (
      <CoordinatorMessagesScreen
        user={user}
        onReportSubmit={handleReportSubmit}
        onNavigateToReports={() => navigate("reportcompany")}
        openContact={messageTarget}
        onContactOpened={() => setMessageTarget(null)}
        userIcon={themedUserIcon}
        onViewChange={setMessagesSubView}
      />
    );

    if (activeNav === "accountprofile") return <CoordinatorAccountProfileScreen user={user} onLogout={onLogout} viewIcon={themedViewIcon} onViewChange={setProfileSubView} />;
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
    <div style={{
      width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden",
      ...getAccentThemeVars(accentThemeId),
    }}>
      <FontImport />
      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            {/* Activity Log */}
            <div style={{ position: "relative" }}>
              <div id="topbar-activity-log" className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px" }} onClick={() => setShowActivityDropdown(prev => !prev)} title="Activity Log">
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
                      overflowY: "auto", overflowX: "hidden", background: paper, border: `1px solid ${hairline}`,
                      borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
                    } : {
                      position: "absolute", top: "48px", right: 0, width: "min(560px, 90vw)", maxHeight: "320px",
                      overflowY: "auto", background: paper, border: `1px solid ${hairline}`,
                      borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
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
              <div id="topbar-notifications" className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px", position: "relative" }} onClick={handleToggleNotifDropdown}>
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
                      overflowY: "auto", background: paper, border: `1px solid ${hairline}`,
                      borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
                    } : {
                      position: "absolute", top: "48px", right: 0, width: "320px", maxHeight: "300px",
                      overflowY: "auto", background: paper, border: `1px solid ${hairline}`,
                      borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
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
            <div id="topbar-about" className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px" }} onClick={() => navigate("about")} title="About">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8h.01"/>
                <path d="M11 12h1v4h1"/>
              </svg>
            </div>

            {/* Theme color picker */}
            <div style={{ position: "relative" }}>
              <div id="topbar-theme-picker" className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px" }} onClick={() => setShowThemeDropdown(p => !p)} title="Dashboard theme color">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 0 20c1.1 0 1.8-.85 1.8-1.85 0-.5-.2-.95-.5-1.28-.32-.33-.5-.75-.5-1.27a1.9 1.9 0 0 1 1.9-1.9h2.24C19.6 15.7 22 13.35 22 10.4 22 5.76 17.5 2 12 2z"/>
                  <circle cx="7.5" cy="10.5" r="1" fill="white" stroke="none"/>
                  <circle cx="11" cy="7" r="1" fill="white" stroke="none"/>
                  <circle cx="15.5" cy="8" r="1" fill="white" stroke="none"/>
                </svg>
              </div>
              {showThemeDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowThemeDropdown(false)} />
                  <div style={{
                      position: "absolute", top: "48px", right: 0, width: "224px",
                      background: paper, border: `1px solid ${hairline}`,
                      borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
                      padding: "16px",
                    }}>
                    <p style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "0.85rem", color: inkText, margin: "0 0 3px" }}>
                      Theme Color Customization
                    </p>
                    <p style={{ fontFamily: uiFont, fontSize: "0.72rem", color: inkMuted, margin: "0 0 14px", lineHeight: 1.4 }}>
                      Applies to every module. Saved on this device — stays after you log out.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px 10px" }}>
                      {ACCENT_THEME_ORDER.map((id) => {
                        const t = ACCENT_THEMES[id];
                        const isSelected = accentThemeId === id;
                        return (
                          <button
                            key={id}
                            onClick={() => handleSelectAccent(id)}
                            title={t.label}
                            style={{
                              display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                              background: "none", border: "none", cursor: "pointer", padding: "2px",
                            }}
                          >
                            <span style={{
                              width: "30px", height: "30px", borderRadius: "50%",
                              background: id === "default" ? "linear-gradient(135deg, #000000 50%, #FFFFFF 50%)" : t.swatch,
                              border: isSelected ? `2px solid ${t.ink}` : `1px solid ${hairline}`,
                              outline: isSelected ? `2px solid ${hairline}` : "none",
                              outlineOffset: isSelected ? "1px" : "0",
                              boxSizing: "border-box",
                            }} />
                            <span style={{ fontFamily: uiFont, fontSize: "0.68rem", fontWeight: isSelected ? 700 : 400, color: isSelected ? inkText : inkMuted }}>
                              {t.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
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

      <FloatingHelpButton
        activeNav={tourKey}
        onBeforeTour={() => { setShowActivityDropdown(false); setShowNotifDropdown(false); setShowThemeDropdown(false); }}
      />

      {viewingReport && (
        <ReportDetailModal report={viewingReport} onClose={() => { setViewingReport(null); setReportResolveOpen(false); }} coordinatorUid={user?.uid} coordinatorName={user?.name} onResolvePanelChange={setReportResolveOpen} />
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
        onLogout={handleSetupLogout}
        logoutBusy={setupLogoutBusy}
      />
      {showEditInfo && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}>
          <div id="editinfo-card" style={{
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
              onLogout={handleSetupLogout}
              logoutBusy={setupLogoutBusy}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ChangePasswordModal = ({ show, currentPass, setCurrentPass, newPass, setNewPass, confirmPass, setConfirmPass, passError, setPassError, passLoading, handleChangePassword, showNew, setShowNew, showConfirm, setShowConfirm, onLogout, logoutBusy }) => {
  const [showCurrent, setShowCurrent] = useState(false);

  // Auto-starts the walkthrough the moment this mandatory pop-up appears —
  // fires once per mount (guarded by the ref, not by localStorage) because
  // `show` only ever goes true→false ONE time in an account's life: once the
  // password is saved, `passwordChanged` flips true in Firestore and this
  // gate never shows again for this account.
  const tourFired = useRef(false);
  useEffect(() => {
    if (!show || tourFired.current) return;
    tourFired.current = true;
    const t = setTimeout(() => runTour(CHANGE_PASSWORD_STEPS), AUTO_TOUR_DELAY_MS);
    return () => clearTimeout(t);
  }, [show]);

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
          <div id="cp-current-password" style={{ position: "relative", marginBottom: "10px" }}>
            <input type={showCurrent ? "text" : "password"} placeholder="Enter Current Password:" value={currentPass}
              onChange={e => { setCurrentPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              style={inputStyle(passError)} />
            <EyeBtn show={showCurrent} onToggle={() => setShowCurrent(p => !p)} />
          </div>

          <hr style={{ border: "none", borderTop: `1px solid ${hairline}`, margin: "12px 0" }} />

          {/* New Password */}
          <p style={{ fontFamily: uiFont, fontSize: "0.8rem", fontWeight: 700, color: inkText, marginBottom: "4px" }}>New Password:</p>
          <div id="cp-new-password" style={{ position: "relative", marginBottom: "10px" }}>
            <input type={showNew ? "text" : "password"} placeholder="Enter New Password:" value={newPass}
              onChange={e => { setNewPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              style={inputStyle(passError)} />
            <EyeBtn show={showNew} onToggle={() => setShowNew(p => !p)} />
          </div>

          <div id="cp-checklist">
            <PasswordChecklist password={newPass} />
          </div>

          {/* Confirm New Password */}
          <p style={{ fontFamily: uiFont, fontSize: "0.8rem", fontWeight: 700, color: inkText, marginBottom: "4px" }}>Confirm New Password:</p>
          <div id="cp-confirm-password" style={{ position: "relative", marginBottom: "4px" }}>
            <input type={showConfirm ? "text" : "password"} placeholder="Confirm New Password:" value={confirmPass}
              onChange={e => { setConfirmPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              style={inputStyle(passError)} />
            <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(p => !p)} />
          </div>

          {passError && <p style={{ fontFamily: uiFont, fontSize: "0.78rem", color: color.danger, margin: "4px 0 8px 4px" }}>⚠️ {passError}</p>}
          <hr style={{ border: "none", borderTop: `1.5px solid ${hairline}`, margin: "16px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <button id="cp-continue-btn" onClick={handleChangePassword} disabled={passLoading} className="pill-btn"
              style={{ background: ink, color: paper, border: "none", borderRadius: "24px", padding: "12px 48px", fontFamily: uiFont, fontWeight: 700, fontSize: "1.05rem", letterSpacing: "0.02em", cursor: passLoading ? "not-allowed" : "pointer", opacity: passLoading ? 0.7 : 1 }}>
              {passLoading ? "Saving…" : "Continue"}
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                disabled={passLoading || logoutBusy}
                style={{ background: "none", border: "none", fontFamily: uiFont, fontSize: "0.8rem", color: inkMuted, textDecoration: "underline", cursor: passLoading || logoutBusy ? "not-allowed" : "pointer", padding: "4px" }}
              >
                {logoutBusy ? "Logging out…" : "Log out"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorDashboardScreen;