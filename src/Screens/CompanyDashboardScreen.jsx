import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { logOut, getUserProfile } from "./AuthService";
import { useUnreadCount } from "./useChat";
import { color, font, ease } from "./theme";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

import CompanyCreatePostScreen        from "./CompanyCreatePostScreen";
import CompanyApplicantsScreen     from "./CompanyApplicantsScreen";
import CompanyMessageScreen        from "./CompanyMessagesScreen";
import CompanyCoordinatorsScreen   from "./CompanyCoordinatorsScreen";
import CompanyAccountProfileScreen from "./CompanyAccountProfileScreen";
import AboutUsScreen                from "./AboutUsScreen"; 

import logo              from "../icons/ojtern.png";
import dashboardIcon     from "../icons/dashboard.png";
import userIcon          from "../icons/user.png";
import viewIcon          from "../icons/view.png";
import postOJTIcon       from "../icons/post.png";
import applicantsIcon    from "../icons/applicants.png";
import messagesIcon      from "../icons/messages.png";
import coordinatorsIcon from "../icons/coordinators.png";
import accountProfileIcon from "../icons/accountprofile.png";
import aboutIcon         from "../icons/about.png";

// ── Design tokens ──────────────────────────────────────────────────────────────
// Same three-tier system as CoordinatorDashboardScreen: ink (strongest panels,
// top bar, active nav, primary buttons), steel (mid panels, hover states),
// paper (page background, cards).
const ink       = color.blush50;   // #000000 — was the #8B0000 "red" accent
const inkSoft   = color.blush200;  // #1F1F1F — gradient / hover partner for ink
const inkDeep   = color.blush100;  // #161616 — was the #590101 "dark red"
const steel     = "#898989";       // mid-tone panels & hover states
const steelSoft = "rgba(137,137,137,0.35)";
const paper     = color.white;     // #FFFFFF
const paperTint = color.wine900;   // #FAFAFA
const paperCard = color.wine800;   // #F2F2F2
const hairline  = color.wine700;   // #EAEAEA
const inkText   = color.ink;       // #141414 body text on light panels
const inkMuted  = color.inkMuted;  // #767676

// Every screen uses one UI face — Inter — per theme.js; Monomaniac One is
// reserved for the "OJTern" wordmark only, never for interface text.
const uiFont   = font.ui;
const logoFont = font.logo;

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
    ::-webkit-scrollbar-thumb { background: ${ink}; border-radius: 4px; }
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


    @keyframes welcomeIn {
      0%   { opacity: 0; transform: translateY(14px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .cwelcome-animate {
      animation: welcomeIn 0.5s cubic-bezier(.16,1,.3,1);
    }

    .cnav-item {
      position: relative;
      margin: 4px 10px;
      padding-left: 4px;
      border-radius: 12px;
      transition: background 0.18s ease, transform 0.12s ease;
    }
    .cnav-item::before {
      content: "";
      position: absolute; left: -10px; top: 50%;
      width: 3px; height: 0;
      background: ${ink};
      border-radius: 0 3px 3px 0;
      transform: translateY(-50%);
      transition: height 0.2s ease;
    }
    .cnav-item:hover  { background: ${paperCard}; }
    .cnav-item.active { background: ${inkDeep}; }
    .cnav-item.active::before { height: 24px; }
    .cnav-item:active { transform: scale(0.98); }
    .cnav-item .nav-label {
      transition: opacity 0.18s ease, color 0.18s ease;
    }
    .cnav-item .nav-icon {
      transition: opacity 0.18s ease, filter 0.18s ease;
    }
    .cnav-item.active .nav-icon {
      filter: brightness(0) invert(1);
      opacity: 1;
    }

    .cnav-logout {
      margin: 4px 10px 14px;
      padding-left: 4px;
      border-radius: 12px;
      transition: background 0.18s ease, transform 0.12s ease;
    }
    .cnav-logout:hover  { background: ${paperCard}; }
    .cnav-logout:active { transform: scale(0.98); }

    @keyframes badgePop {
      0%   { transform: scale(0.5); opacity: 0; }
      70%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); }
    }
    .nav-badge {
      animation: badgePop 0.25s ease;
      box-shadow: 0 2px 6px rgba(20,20,20,0.25);
    }

    .notif-row { transition: background 0.15s; }
    .notif-row:hover { background: ${hairline} !important; }

    .applicant-row { transition: background 0.15s; cursor: pointer; }
    .applicant-row:hover { background: ${hairline} !important; }

    .post-row { transition: background 0.15s; cursor: pointer; }
    .post-row:hover { background: ${hairline} !important; }

    /* ── Slide-in drawer (mobile / tablet) ── */
    .csidebar-drawer {
      position: fixed; top: 0; left: 0;
      height: 100%; width: 260px; z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      background: ${paper}; border-right: 1px solid ${hairline};
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
      font-family: ${uiFont};
      font-weight: 600;
      font-size: clamp(1.9rem, 5vw, 3.4rem);
      color: ${ink};
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .cwelcome-sub {
      font-family: ${uiFont};
      font-weight: 400;
      font-size: clamp(0.9rem, 2.2vw, 1.15rem);
      color: ${inkMuted};
    }

    /* ── Card section header ── */
    .ccard-header {
      padding: 14px 18px 12px 15px;
      border-bottom: 1px solid ${hairline};
    }
    .ccard-header span {
      font-family: ${uiFont};
      font-weight: 600;
      font-size: clamp(0.85rem, 2vw, 0.98rem);
      color: ${inkText};
      letter-spacing: -0.01em;
    }

    .cdash-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.10);
    }
      .stat-view-btn { transition: transform 0.18s ease; }
      .stat-view-btn:hover { transform: scale(1.08); }
    .cdash-card:hover {
      transform: translateY(-3px);
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.10), 0 10px 28px rgba(20,20,20,0.10);
    }
      

    /* ── Desktop static sidebar ── */
    @media (min-width: 1024px) {
      .csidebar-static {
        width: 260px; flex-shrink: 0;
        background: ${paper};
        display: flex; flex-direction: column;
        overflow-y: auto; border-right: 1px solid ${hairline};
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
      background: ${paper}; border-radius: 2px; transition: all 0.2s;
    }

    /* ── Main content area ── */
    .cmain-content {
      flex: 1; display: flex; flex-direction: column;
      overflow-y: auto; background: ${paperTint}; min-width: 0; min-height: 0;
    }
  `}</style>
);

// ── Nav items ──────────────────────────────────────────────────────────────────
const navItems = [
  { key: "dashboard",      label: "Dashboard",       icon: dashboardIcon },
  { key: "createpost",     label: "Create Post",     icon: postOJTIcon },
  { key: "applicants",     label: "Applicants",      icon: applicantsIcon },
  { key: "messages",       label: "Messages",        icon: messagesIcon },
  { key: "coordinators",   label: "Coordinators",    icon: coordinatorsIcon },
  { key: "accountprofile", label: "Account Profile", icon: accountProfileIcon },
];

// ── URL <-> tab mapping ──────────────────────────────────────────────────────
// The active tab now lives in the URL (/company/<key>) instead of
// sessionStorage, so the address bar always matches what's on screen and a
// refresh/back-button/shared link lands on the right tab.
const COMPANY_BASE_PATH = "/company";
const getCompanyNavKeyFromPath = (pathname) => {
  const rest = pathname.startsWith(COMPANY_BASE_PATH) ? pathname.slice(COMPANY_BASE_PATH.length) : "";
  const key = rest.replace(/^\/+|\/+$/g, "");
  return key || "dashboard";
};

// ── Sidebar nav list (reused in static & drawer) ───────────────────────────────
const SidebarNav = ({ activeNav, onNavigate, onLogout, unreadMessages = 0 }) => (
  <>
    <div style={{ padding: "14px 20px 8px", flexShrink: 0 }} />
    {navItems.map((item) => {
      const isActive = activeNav === item.key;
      return (
        <div
          key={item.key}
          className={`cnav-item ${isActive ? "active" : ""}`}
          onClick={() => onNavigate(item.key)}
          style={{
            display: "flex", alignItems: "center", gap: "14px",
            padding: "12px 16px", cursor: "pointer", minHeight: "50px",
          }}
        >
          <img
            src={item.icon} alt={item.label} className="nav-icon"
            style={{ width: "26px", height: "26px", objectFit: "contain", flexShrink: 0, opacity: isActive ? 1 : 0.85 }}
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
        <hr style={{ border: "none", borderTop: `1px solid ${hairline}`, margin: "0 18px 8px" }} />
        <div
          className="cnav-logout"
          onClick={onLogout}
          style={{
            display: "flex", alignItems: "center", gap: "14px",
            padding: "12px 16px", cursor: "pointer", minHeight: "50px",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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
        <button onClick={onCancel} style={{
          flex: 1, padding: "12px", borderRadius: "30px",
          border: `1.5px solid ${hairline}`, background: paper,
          fontFamily: uiFont, fontWeight: 600,
          fontSize: "0.95rem", cursor: "pointer", color: inkMuted,
          boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
        }}>Cancel</button>
        <button onClick={onConfirm} style={{
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

// ── Stat card ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, bg = steel, onView }) => (
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
        <span style={{ fontFamily: uiFont, fontWeight: 700, fontSize: "clamp(2.2rem, 5vw, 4rem)", color: paper }}>
          {value ?? "—"}
        </span>
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
// ── Status badge ───────────────────────────────────────────────────────────────
// Accepted/Declined map to the theme's semantic success/danger colors — the
// same pair CoordinatorDashboardScreen uses for its password checklist — so
// "good" and "bad" states read consistently across both dashboards. The
// remaining statuses (Pending / In Review / To Interview) keep their own
// distinct functional hues since they're a multi-state pipeline, not a
// brand accent.
const StatusBadge = ({ status }) => {
  const cfg = {
    Accepted:       { bg: "#358D5E", text: paper },
    Declined:       { bg: color.danger, text: paper },
    Pending:        { bg: "#c8a800",   text: paper },
    "In Review":    { bg: "#353A8D",   text: paper },
    "To Interview": { bg: "#7C2889",   text: paper },
  }[status] || { bg: steel, text: paper };

  return (
    <div style={{
      background: cfg.bg, color: cfg.text,
      borderRadius: "20px", padding: "4px 16px",
      fontFamily: uiFont, fontWeight: 700,
      fontSize: "0.78rem", flexShrink: 0,
      minWidth: "90px", textAlign: "center",
    }}>
      {status}
    </div>
  );
};

// ── Notification bell + dropdown (new applicant notifications) ────────────────
const NotificationBell = ({ items, open, onToggle }) => {
  const unread = items.filter((n) => n.unread).length;
  // Same responsive sizing as StudentDashboardScreen: sa desktop, absolute
  // dropdown na naka-anchor sa bell; sa mobile/tablet, fixed panel na naka-pin
  // sa ilalim ng topbar. Kung absolute pa rin sa maliit na screen, lumalabas
  // ang 340px na dropdown sa gilid at umaabot sa baba ng viewport.
  const { isMobile, isTablet } = useBreakpoint();
  return (
    <div style={{ position: "relative" }}>
      <div id="cdash-notif-bell" style={{ cursor: "pointer", padding: "8px", position: "relative" }} onClick={onToggle} aria-label="Notifications">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: "4px", right: "4px",
            background: paper, color: ink, borderRadius: "50%",
            minWidth: "16px", height: "16px", fontSize: "0.65rem",
            fontFamily: uiFont, fontWeight: "bold",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", lineHeight: 1,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>

      {open && (
      <>
        <div onClick={onToggle} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
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
            {items.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center" }}>
                <span style={{ fontFamily: uiFont, fontSize: "0.85rem", color: inkMuted }}>
                  No notifications yet.
                </span>
              </div>
            ) : items.map((n) => (
              <div
                  key={n.id}
                  className="notif-row"
                  onClick={n.onClick}
                  style={{
                    padding: "14px 18px",
                    borderTop: `1px solid ${hairline}`,
                    cursor: "pointer",
                    background: n.unread ? "#F2F2F2" : paper,
                  }}
                >
                <p style={{ fontFamily: uiFont, fontSize: "0.85rem", fontWeight: 500, color: inkText, lineHeight: 1.4, marginBottom: "5px" }}>
                  {n.subtitle ? `${n.title} — ${n.subtitle}` : n.title}
                </p>
                <p style={{ fontFamily: uiFont, fontSize: "0.75rem", color: inkMuted }}>
                  {timeAgo(n.time)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </>
    )}
    </div>
  );
};

// ── Empty state placeholder ────────────────────────────────────────────────────
const EmptyListPlaceholder = ({ label = "No data available" }) => (
  <div style={{
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "20px",
  }}>
    <span style={{ fontFamily: uiFont, fontSize: "0.85rem", color: inkMuted, textAlign: "center" }}>
      {label}
    </span>
  </div>
);

// ── Dashboard Content ──────────────────────────────────────────────────────────
const DashboardContent = ({ onNavigate, applications = [], posts = [] }) => {
  const [playIntro] = useState(true);
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
        background: paperCard, borderRadius: "18px",
        padding: "clamp(20px, 5vw, 30px) clamp(18px, 5vw, 40px)",
        marginBottom: "24px", textAlign: "center",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.07)",
      }}>
        <h1 className={`cwelcome-heading ${playIntro ? "cwelcome-animate" : ""}`}>Welcome to OJTern</h1>
        <p className={`cwelcome-sub ${playIntro ? "cwelcome-animate" : ""}`}>Find the perfect DCT OJT students for your company!</p>
      </div>

      <hr style={{ border: "none", borderTop: `1.5px solid ${hairline}`, marginBottom: "24px" }} />

      {/* Top grid: Company Stats + Recent Posts */}
      <div className="cdash-top-grid">

        {/* Company Stats */}
        <div id="cdash-stats-card" className="cdash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "visible", display: "flex", flexDirection: "column" }}>
          <div className="ccard-header"><span>Applicants Overview</span></div>
          <div className="cstats-inner">
            <StatCard
              label="Total Applicants"
              value={totalApplicants}
              bg={inkDeep}
              onView={() => onNavigate("applicants")}
            />
            <StatCard
              label="Accepted Applicants"
              value={acceptedApplicants}
              bg={steel}
              onView={() => onNavigate("applicants", null, "Accepted")}
            />
          </div>
        </div>

        {/* Recent Posts */}
        <div id="cdash-recent-posts-card" className="cdash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="ccard-header"><span>Recent Post</span></div>
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "240px", overflowY: "auto" }}>
            {recentPosts.length === 0 ? (
              <EmptyListPlaceholder label="No posts yet." />
            ) : recentPosts.map((p, i) => (
              <div
                key={i}
                className="post-row"
                onClick={() => onNavigate("createpost", p.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: paperCard, borderRadius: "8px", padding: "9px 12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily: uiFont, fontSize: "clamp(0.75rem, 2vw, 0.88rem)",
                    color: inkText, fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {p.companyName || "OJT Post"}
                  </p>
                  <p style={{ fontFamily: uiFont, fontSize: "0.72rem", color: inkMuted }}>
                    {p.industry || ""}{p.createdAt?.seconds ? " • " + new Date(p.createdAt.seconds * 1000).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                  </p>
                </div>
                <span style={{
                  fontFamily: uiFont, fontSize: "0.72rem",
                  color: ink, fontWeight: 700, flexShrink: 0, marginLeft: "8px",
                }}>
                  {p.slot || 0} slot{p.slot !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Applicants */}
      <div id="cdash-recent-applicants-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden" }}>
        <div className="cdash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden" }}>
          <div className="ccard-header"><span>Recent Applicants</span></div>
          {recentApplicants.length === 0 ? (
            <EmptyListPlaceholder label="No applicants yet." />
          ) : recentApplicants.map((a, i) => (
            <div
              key={i}
              className="applicant-row"
              onClick={() => onNavigate("applicants", a.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: paperCard, borderRadius: "8px", padding: "9px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img src={userIcon} alt="user" style={{ width: 36, height: 36, objectFit: "contain", flexShrink: 0 }} />
                <div style={{ width: "1px", height: "28px", background: hairline }} />
                <span style={{
                  fontFamily: uiFont,
                  fontSize: "clamp(0.75rem, 2vw, 0.88rem)",
                  color: inkText, fontWeight: 600,
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

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
// ── First-login onboarding tours (driver.js) ────────────────────────────────
// Unlike Coordinator/Student, a Company account sets its own password AND
// fills out its full profile during signup (registerCompany) — there's no
// forced "set new password" or "complete your profile" gate to key the
// onboarding off of. Instead, the very first time a company's own Firestore
// doc is loaded here without a `seenTours` field, we treat that as "hasn't
// been onboarded yet" (a genuinely new account moments after registering,
// or an existing account seeing this feature for the first time), stamp
// `seenTours: {}` once, and every nav screen below auto-plays its tour
// exactly once per screen from then on — see the effects inside the main
// component below.
//
// Every nav screen now has real steps, targeting each screen's own content
// elements. The manual "?" button still works everywhere via the shared
// fallback message if a screen's steps array is ever empty.
// Cards whose step must never scroll/recenter the page when highlighted.
const STEADY_TOUR_ELEMENT_IDS = [];
// Step targets that are their own scroll box on purpose — kept scrollable
// during a tour (every other scrollable container is locked).
const SCROLLABLE_TOUR_TARGET_IDS = [];

// For list steps: highlight just ONE item (the first visible row/card)
// instead of the whole list. Falls back to the list itself (e.g. its empty
// state) when there are no items yet.
const firstListItem = (selectors, fallback) => () => {
  for (const sel of selectors) {
    const el = [...document.querySelectorAll(sel)].find(n => n.getClientRects().length > 0);
    if (el) return el;
  }
  return fallback ? document.querySelector(fallback) : null;
};
// Same, but the LAST visible match — used for chat messages, where the
// newest one (at the bottom, already in view) is the natural one to show.
const lastListItem = (selectors, fallback) => () => {
  for (const sel of selectors) {
    const el = [...document.querySelectorAll(sel)].reverse().find(n => n.getClientRects().length > 0);
    if (el) return el;
  }
  return fallback ? document.querySelector(fallback) : null;
};

// Shared by Terms and Privacy (separate keys so each auto-plays once).
const LEGAL_STEPS = [
    {
      element: "#clegal-header",
      popover: {
        title: "Title & Last Updated",
        description: "The document you're reading and the date it was last updated. If it changes, the date here changes too.",
      },
    },
    {
      element: "#clegal-toc",
      popover: {
        title: "On This Page",
        description: "Every section of this document. Tap one to jump straight to it — the section you're reading is marked.",
      },
    },
    {
      element: "#clegal-first-section",
      popover: {
        title: "Sections",
        description: "Each section explains one part of the document. Scroll down to read them all.",
      },
    },
    {
      element: "#clegal-progress",
      popover: {
        title: "Reading Progress",
        description: "This thin bar fills up as you scroll, showing how far through the document you are.",
      },
    },
    {
      element: "#clegal-understand-btn",
      popover: {
        title: "I Understand",
        description: "When you're done reading, tap this to return to your Account Profile.",
      },
    },
  ];

// Screen sub-view (from each screen's onViewChange) → HELP_STEPS key.
const COMPANY_SUBVIEW_TOUR_KEYS = {
  createpost:     { create: "postcreate", view: "postview", edit: "postedit" },
  applicants:     { detail: "applicantdetail", status: "applicantstatus", report: "applicantreport" },
  messages:       { chat: "messageschat", report: "messagesreport" },
  accountprofile: { personalInfo: "accprofilepersonal", personalInfoEdit: "accprofilepersonaledit", terms: "accprofileterms", privacy: "accprofileprivacy", reset: "accprofilereset" },
};

const HELP_STEPS_BY_NAV = {
  dashboard: [
    {
      element: "#cdash-stats-card",
      popover: { title: "Applicants Overview", description: "See your total and accepted applicant counts at a glance — click a stat to jump straight to that filtered list." },
    },
    {
      element: "#cdash-recent-posts-card",
      popover: { title: "Recent Post", description: "Your most recently created OJT postings show up here — click one to open it." },
    },
    {
      element: "#cdash-recent-applicants-card",
      popover: { title: "Recent Applicants", description: "The latest students who applied to your posts — click a name to view their application." },
    },
    {
      element: "#cdash-notif-bell",
      popover: { title: "Notifications", description: "New applicants and other updates show up here." },
    },
    {
      element: "#cdash-about-icon",
      popover: { title: "About", description: "Learn more about OJTern and the DCT team behind it." },
    },
  ],
  createpost: [
    {
      element: "#cpost-create-btn",
      popover: { title: "Post an OJT Opening", description: "Click here to create a new posting — set the department, slots, work hours, and description." },
    },
    {
      element: firstListItem(["#cpost-list.post-grid > *"], "#cpost-list"),
      popover: { title: "Your Postings", description: "Each card is one of your posts. Click any card to view or edit it, or use ⋮ to disable or delete it." },
    },
  ],
  applicants: [
    {
      element: "#capp-search-bar",
      popover: { title: "Find an Applicant", description: "Search by name, college, or program — the count on the left updates to match your filters." },
    },
    {
      element: "#capp-status-chips",
      popover: { title: "Filter by Status", description: "Jump straight to Pending, In Review, To Interview, Accepted, or Declined applicants." },
    },
    {
      element: firstListItem(["#capp-rows .ca-row"], "#capp-rows"),
      popover: { title: "Applicant List", description: "Each row is one applicant. Click any row to view their details, change their status, or message them." },
    },
  ],
  messages: [
    {
      element: "#cmsg-search-bar",
      popover: { title: "Your Conversations", description: "Search your chats by name — unread conversations are counted here too." },
    },
    {
      element: firstListItem(["#cmsg-conversations .msg-row"], "#cmsg-conversations"),
      popover: { title: "Chat List", description: "Each row is one conversation. Click any row to open the chat." },
    },
  ],
  accountprofile: [
    {
      element: "#cacc-personal-info",
      popover: { title: "Personal Information", description: "Update your company's details here." },
    },
    {
      element: "#cacc-security",
      popover: { title: "Security", description: "Reset your password from here at any time." },
    },
    {
      element: "#cacc-legal",
      popover: { title: "Legal", description: "Review the Terms & Conditions and Privacy Policy any time." },
    },
  ],
  coordinators: [
    {
      element: "#ccoord-search-bar",
      popover: { title: "Find a Coordinator", description: "Search by name or email to quickly find a specific coordinator." },
    },
    {
      element: "#ccoord-filter-btn",
      popover: { title: "Filters", description: "Narrow the list down by college or program." },
    },
    {
      element: firstListItem(["#ccoord-list article"], "#ccoord-list"),
      popover: { title: "Coordinator List", description: "Each card is one coordinator, grouped by college. Use it to see their programs and email, or message them." },
    },
  ],
  // ── Sub-views & modals (set via each screen's onViewChange; see tourKey) ──
  postcreate: [
    {
      element: "#cpostf-header",
      popover: {
        title: "New Post",
        description: "Fill in the details below to create a new OJT post.",
      },
    },
    {
      element: "#cpostf-description",
      popover: {
        title: "Description",
        description: "What the OJT post is about — the role, the work, and what students will learn.",
      },
    },
    {
      element: "#cpostf-requirements",
      popover: {
        title: "Requirements",
        description: "What applicants need to have or submit.",
      },
    },
    {
      element: "#cpostf-location",
      popover: {
        title: "Location",
        description: "Follows your company's location from Account Profile — change it there if you've moved.",
      },
    },
    {
      element: "#cpostf-hours",
      popover: {
        title: "Working Hours",
        description: "Pick a day and a time range. Use + Add Another Working Hours for more days.",
      },
    },
    {
      element: "#cpostf-expiration",
      popover: {
        title: "Post Expiration Date",
        description: "Optional. After this date, students can no longer apply.",
      },
    },
    {
      element: "#cpostf-contact",
      popover: {
        title: "Contact Information",
        description: "The phone number and Gmail address students can reach you at.",
      },
    },
    {
      element: "#cpostf-benefits",
      popover: {
        title: "Benefits",
        description: "What interns get — allowance, meals, certificates, and so on.",
      },
    },
    {
      element: "#cpostf-industry",
      popover: {
        title: "Industry",
        description: "Follows your industry from Account Profile.",
      },
    },
    {
      element: "#cpostf-programs",
      popover: {
        title: "College / Program Required",
        description: "Only departments you've been approved for are listed. Set how many slots each one gets.",
      },
    },
    {
      element: "#cpostf-skills",
      popover: {
        title: "Skills Required",
        description: "The skills applicants should have.",
      },
    },
    {
      element: "#cpostf-footer",
      popover: {
        title: "Close or Post",
        description: "Post publishes it for students in the departments you picked. Close discards it.",
      },
    },
  ],
  postview: [
    {
      element: "#cpostf-header",
      popover: {
        title: "Your Post",
        description: "The details of this OJT post, as students see them.",
      },
    },
    {
      element: "#cpostf-description",
      popover: {
        title: "Description",
        description: "What the OJT post is about — the role, the work, and what students will learn.",
      },
    },
    {
      element: "#cpostf-requirements",
      popover: {
        title: "Requirements",
        description: "What applicants need to have or submit.",
      },
    },
    {
      element: "#cpostf-location",
      popover: {
        title: "Location",
        description: "Follows your company's location from Account Profile — change it there if you've moved.",
      },
    },
    {
      element: "#cpostf-hours",
      popover: {
        title: "Working Hours",
        description: "Pick a day and a time range. Use + Add Another Working Hours for more days.",
      },
    },
    {
      element: "#cpostf-expiration",
      popover: {
        title: "Post Expiration Date",
        description: "Optional. After this date, students can no longer apply.",
      },
    },
    {
      element: "#cpostf-contact",
      popover: {
        title: "Contact Information",
        description: "The phone number and Gmail address students can reach you at.",
      },
    },
    {
      element: "#cpostf-benefits",
      popover: {
        title: "Benefits",
        description: "What interns get — allowance, meals, certificates, and so on.",
      },
    },
    {
      element: "#cpostf-industry",
      popover: {
        title: "Industry",
        description: "Follows your industry from Account Profile.",
      },
    },
    {
      element: "#cpostf-programs",
      popover: {
        title: "College / Program Required",
        description: "Only departments you've been approved for are listed. Set how many slots each one gets.",
      },
    },
    {
      element: "#cpostf-skills",
      popover: {
        title: "Skills Required",
        description: "The skills applicants should have.",
      },
    },
    {
      element: "#cpostf-footer",
      popover: {
        title: "Close or Edit",
        description: "Tap Edit to change this post, or Close to go back.",
      },
    },
  ],
  postedit: [
    {
      element: "#cpostf-header",
      popover: {
        title: "Edit Post",
        description: "Change any of the details below.",
      },
    },
    {
      element: "#cpostf-description",
      popover: {
        title: "Description",
        description: "What the OJT post is about — the role, the work, and what students will learn.",
      },
    },
    {
      element: "#cpostf-requirements",
      popover: {
        title: "Requirements",
        description: "What applicants need to have or submit.",
      },
    },
    {
      element: "#cpostf-location",
      popover: {
        title: "Location",
        description: "Follows your company's location from Account Profile — change it there if you've moved.",
      },
    },
    {
      element: "#cpostf-hours",
      popover: {
        title: "Working Hours",
        description: "Pick a day and a time range. Use + Add Another Working Hours for more days.",
      },
    },
    {
      element: "#cpostf-expiration",
      popover: {
        title: "Post Expiration Date",
        description: "Optional. After this date, students can no longer apply.",
      },
    },
    {
      element: "#cpostf-contact",
      popover: {
        title: "Contact Information",
        description: "The phone number and Gmail address students can reach you at.",
      },
    },
    {
      element: "#cpostf-benefits",
      popover: {
        title: "Benefits",
        description: "What interns get — allowance, meals, certificates, and so on.",
      },
    },
    {
      element: "#cpostf-industry",
      popover: {
        title: "Industry",
        description: "Follows your industry from Account Profile.",
      },
    },
    {
      element: "#cpostf-programs",
      popover: {
        title: "College / Program Required",
        description: "Only departments you've been approved for are listed. Set how many slots each one gets.",
      },
    },
    {
      element: "#cpostf-skills",
      popover: {
        title: "Skills Required",
        description: "The skills applicants should have.",
      },
    },
    {
      element: "#cpostf-footer",
      popover: {
        title: "Close or Save",
        description: "Save updates the post. Close asks before throwing away unsaved changes.",
      },
    },
  ],
  applicantdetail: [
    {
      element: "#cappd-header",
      popover: {
        title: "Student Information",
        description: "Everything this student sent with their application.",
      },
    },
    {
      element: "#cappd-name",
      popover: {
        title: "Name",
        description: "First name, middle initial, last name, and suffix.",
      },
    },
    {
      element: "#cappd-sex",
      popover: {
        title: "Sex",
        description: "The student's sex.",
      },
    },
    {
      element: "#cappd-location",
      popover: {
        title: "Location",
        description: "Where the student lives.",
      },
    },
    {
      element: "#cappd-college",
      popover: {
        title: "College / Program / Major",
        description: "The student's college, program, and major.",
      },
    },
    {
      element: "#cappd-contact",
      popover: {
        title: "Contact & Email",
        description: "The student's mobile number and email address.",
      },
    },
    {
      element: "#cappd-message",
      popover: {
        title: "Application Message",
        description: "The message the student wrote to you.",
      },
    },
    {
      element: "#cappd-files",
      popover: {
        title: "Attached File",
        description: "The resume and requirements the student attached. Tap one to open or download it.",
      },
    },
    {
      element: "#cappd-status",
      popover: {
        title: "Status",
        description: "Move the application along — In Review, To Interview, Accepted, or Declined. Accepted and Declined are final.",
      },
    },
    {
      element: "#cappd-actions",
      popover: {
        title: "Message or Report",
        description: "Message opens a chat with the student once they're In Review. Report flags a problem with this applicant.",
      },
    },
  ],
  applicantstatus: [
    {
      element: "#cstatus-badge",
      popover: {
        title: "New Status",
        description: "The status you're moving this applicant to.",
      },
    },
    {
      element: "#cstatus-message",
      popover: {
        title: "Write a Message",
        description: "A short note to the student about this update — they'll see it with the new status.",
      },
    },
    {
      element: "#cstatus-footer",
      popover: {
        title: "Close or Send",
        description: "Send saves the new status and your message. Close cancels the change.",
      },
    },
  ],
  applicantreport: [
    {
      element: "#creport-progress",
      popover: {
        title: "Report Steps",
        description: "Reporting takes 3 short steps — this bar shows which one you're on.",
      },
    },
    {
      element: "#creport-concerns",
      popover: {
        title: "What Is the Concern?",
        description: "Pick the option that best describes what happened, then tap Continue.",
      },
    },
    {
      element: "#creport-details",
      popover: {
        title: "About This Concern",
        description: "What this kind of concern covers, with common examples — check it matches before continuing.",
      },
    },
    {
      element: "#creport-describe",
      popover: {
        title: "Describe What Happened",
        description: "Include dates, names, and anything the review team should know.",
      },
    },
    {
      element: "#creport-evidence",
      popover: {
        title: "Attach Evidence",
        description: "Attach a PNG or PDF that supports your report.",
      },
    },
    {
      element: "#creport-actions",
      popover: {
        title: "Continue or Send",
        description: "Back and Continue move between steps. On the last step, Send submits the report for review.",
      },
    },
  ],
  messagesreport: [
    {
      element: "#creport-progress",
      popover: {
        title: "Report Steps",
        description: "Reporting takes 3 short steps — this bar shows which one you're on.",
      },
    },
    {
      element: "#creport-concerns",
      popover: {
        title: "What Is the Concern?",
        description: "Pick the option that best describes what happened, then tap Continue.",
      },
    },
    {
      element: "#creport-details",
      popover: {
        title: "About This Concern",
        description: "What this kind of concern covers, with common examples — check it matches before continuing.",
      },
    },
    {
      element: "#creport-describe",
      popover: {
        title: "Describe What Happened",
        description: "Include dates, names, and anything the review team should know.",
      },
    },
    {
      element: "#creport-evidence",
      popover: {
        title: "Attach Evidence",
        description: "Attach a PNG or PDF that supports your report.",
      },
    },
    {
      element: "#creport-actions",
      popover: {
        title: "Continue or Send",
        description: "Back and Continue move between steps. On the last step, Send submits the report for review.",
      },
    },
  ],
  messageschat: [
    {
      element: "#cmsgchat-header",
      popover: {
        title: "Conversation",
        description: "Who you're chatting with. Tap the back arrow to return to all your conversations.",
      },
    },
    {
      element: lastListItem([".msg-thread-body .msg-bubble-wrap"]),
      popover: {
        title: "Messages",
        description: "Tap and hold a message, or tap its ⋮, to reply. Your own messages can also be edited or unsent.",
      },
    },
    {
      element: "#cmsgchat-options",
      popover: {
        title: "Conversation Options",
        description: "More options for this chat — delete the conversation (only for you) or report.",
      },
    },
    {
      element: "#cmsgchat-attach",
      popover: {
        title: "Attach Files",
        description: "Attach PNG images or PDF files to your message.",
      },
    },
    {
      element: "#cmsgchat-input",
      popover: {
        title: "Write a Message",
        description: "Type your message here. Press Enter to send.",
      },
    },
    {
      element: "#cmsgchat-send",
      popover: {
        title: "Send",
        description: "Sends your message and any attached files.",
      },
    },
  ],
  accprofilepersonal: [
    {
      element: "#cpinfo-edit-btn",
      popover: {
        title: "Edit",
        description: "Tap Edit to update your company details below.",
      },
    },
    {
      element: "#cpinfo-name",
      popover: {
        title: "Company Name",
        description: "Your company's name, as students and coordinators see it.",
      },
    },
    {
      element: "#cpinfo-industry",
      popover: {
        title: "Industry",
        description: "Your company's industry. Your posts use this too.",
      },
    },
    {
      element: "#cpinfo-courses",
      popover: {
        title: "Courses / Programs Accepted",
        description: "The colleges and programs you accept interns from.",
      },
    },
    {
      element: "#cpinfo-location",
      popover: {
        title: "Location",
        description: "Your company's address. Your posts and map pin use this.",
      },
    },
    {
      element: "#cpinfo-email",
      popover: {
        title: "Email Address",
        description: "The email you log in with. Changing it needs a confirmation link sent to the new address.",
      },
    },
  ],
  accprofilepersonaledit: [
    {
      element: "#cpinfo-name",
      popover: {
        title: "Company Name",
        description: "Type your company's name.",
      },
    },
    {
      element: "#cpinfo-industry",
      popover: {
        title: "Industry",
        description: "Start typing and pick your industry from the suggestions.",
      },
    },
    {
      element: "#cpinfo-courses",
      popover: {
        title: "Courses / Programs Accepted",
        description: "Pick a college, then a program (and major if it has one). Add more with + Add another college / program.",
      },
    },
    {
      element: "#cpinfo-location",
      popover: {
        title: "Location",
        description: "Pick your region, province, city, and barangay, then add your street. Check the pin on the map.",
      },
    },
    {
      element: "#cpinfo-email",
      popover: {
        title: "Email Address",
        description: "Your login email. If you change it, you'll confirm with your password and a link sent to the new address.",
      },
    },
    {
      element: "#cpinfo-save",
      popover: {
        title: "Save Changes",
        description: "Save your updated details, or Cancel to discard them.",
      },
    },
  ],
  accprofileterms: LEGAL_STEPS,
  accprofileprivacy: LEGAL_STEPS,
  accprofilereset: [
    {
      element: "#creset-current",
      popover: {
        title: "Current Password",
        description: "Enter the password you use now, to confirm it's really you.",
      },
    },
    {
      element: "#creset-new",
      popover: {
        title: "New Password",
        description: "Choose a new password you don't use anywhere else. A checklist appears as you type, showing what's still missing.",
      },
    },
    {
      element: "#creset-confirm",
      popover: {
        title: "Confirm New Password",
        description: "Type the same new password again.",
      },
    },
    {
      element: "#creset-footer",
      popover: {
        title: "Cancel or Save",
        description: "Save password updates it and signs you out — log back in with the new one. Cancel keeps your current password.",
      },
    },
  ],
  about: [
    {
      element: "#cabout-story",
      popover: { title: "Our Story", description: "Learn what OJTern is, what it does, and the mission behind it." },
    },
    {
      element: "#cabout-team",
      popover: { title: "The Team", description: "Meet the team behind OJTern." },
    },
    {
      element: "#cabout-features",
      popover: { title: "What OJTern Offers", description: "A quick look at what OJTern gives students, coordinators, and companies." },
    },
    {
      element: "#cabout-contact",
      popover: { title: "Need Help?", description: "Have questions or feedback? Reach out to the OJTern team any time." },
    },
  ],
};

// Delay before an AUTO-started tour fires — gives the just-mounted screen a
// moment to finish laying out so driver.js measures real element positions
// instead of a pre-layout frame. Manual "?" clicks skip this since the page
// is already fully on-screen.
const AUTO_TOUR_DELAY_MS = 450;

// Shared driver.js launcher — both the "?" button and every auto-tour below
// call this, so they always look and behave identically.
const runTour = (steps) => {
  // driver.js only locks the page/body's own scroll while a tour runs, but
  // every Company screen scrolls inside its own container (.smain-content,
  // .stud-list-wrapper, .stud-profile-content, modal bodies, the chat thread,
  // legal pages…). Rather than keep a hand-written list of those, lock EVERY
  // element that's currently scrollable, then restore them all on close.
  // Step targets that are their own scroll box on purpose (e.g. a company
  // post's "Post Details") are left scrollable — see SCROLLABLE_TOUR_TARGET_IDS.
  const scrollLockTargets = [...document.querySelectorAll("body *")].filter(el => {
    if (SCROLLABLE_TOUR_TARGET_IDS.includes(el.id)) return false;
    if (el.scrollHeight <= el.clientHeight + 1) return false;
    const oy = getComputedStyle(el).overflowY;
    return oy === "auto" || oy === "scroll" || oy === "overlay";
  });
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


// ── Floating "?" help button ────────────────────────────────────────────────
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


const CompanyDashboardScreen = ({ user, onLogout, onAuthStateChange }) => {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const showDrawer = isMobile || isTablet;

  const routerNavigate = useNavigate();
  const location = useLocation();
  const activeNav = getCompanyNavKeyFromPath(location.pathname);

  // Unread-messages badge for the "Messages" nav item — real-time, persisted
  // in Firestore (see useUnreadCount in useChat.js).
  const unreadMessages = useUnreadCount(user?.uid);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ── First-login onboarding tour state (persisted in Firestore) ─────────
  // Fetched fresh from Firestore (not just the `user` prop, which is
  // captured at login and can go stale) so `seenTours` is always accurate.
  const [companyProfile, setCompanyProfile]             = useState(null);
  const [companyProfileLoaded, setCompanyProfileLoaded] = useState(false);
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getUserProfile("companies", user.uid).then((data) => {
      if (cancelled) return;
      setCompanyProfile(data);
      setCompanyProfileLoaded(true);
    });
    return () => { cancelled = true; };
  }, [user?.uid]);

  // The first time this account's doc is seen WITHOUT a `seenTours` field,
  // stamp it once — that's the signal every nav screen below watches to
  // decide whether it should auto-play its tour. Fires exactly once per
  // account, ever (guarded by the ref, and by the field's own presence in
  // Firestore from then on).
  const tourInitRef = useRef(false);
  useEffect(() => {
    if (!user?.uid || !companyProfileLoaded || tourInitRef.current) return;
    tourInitRef.current = true;
    if (!companyProfile?.seenTours) {
      setDoc(doc(db, "companies", user.uid), { seenTours: {} }, { merge: true })
        .catch((err) => console.error("Failed to initialize onboarding tour tracking:", err));
      setCompanyProfile(prev => ({ ...(prev || {}), seenTours: {} }));
    }
  }, [user?.uid, companyProfileLoaded, companyProfile]);

  // Auto-plays each nav screen's tour once, the first time this account's
  // session lands on it — never again after that, tracked permanently in
  // Firestore via `seenTours`. Prevents double-fire within the same short
  // gap before the Firestore write reflects in local state (e.g. React
  // Strict Mode in dev); the real tracker is `seenTours` in Firestore.
  // Which part of the current screen is showing (list, a post, a modal…),
  // reported by each screen's onViewChange. tourKey picks that part's own
  // steps when it has some, otherwise the nav screen's. No reset-on-nav
  // effect on purpose: each screen resets this itself when it unmounts.
  const [screenSubView, setScreenSubView] = useState("list");
  const tourKey = COMPANY_SUBVIEW_TOUR_KEYS[activeNav]?.[screenSubView] || activeNav;

  const tourFiringRef = useRef({});
  useEffect(() => {
    if (!user?.uid || !companyProfileLoaded || !companyProfile?.seenTours) return;
    const steps = HELP_STEPS_BY_NAV[tourKey];
    if (!steps || steps.length === 0) return;
    if (companyProfile.seenTours[tourKey] || tourFiringRef.current[tourKey]) return;

    tourFiringRef.current[tourKey] = true;
    const t = setTimeout(() => {
      runTour(steps);
      setDoc(doc(db, "companies", user.uid), { seenTours: { [tourKey]: true } }, { merge: true })
        .catch((err) => console.error("Failed to save seen tour state:", err));
      setCompanyProfile(prev => ({
        ...(prev || {}),
        seenTours: { ...(prev?.seenTours || {}), [tourKey]: true },
      }));
    }, AUTO_TOUR_DELAY_MS);
    return () => clearTimeout(t);
  }, [tourKey, user?.uid, companyProfileLoaded, companyProfile]);

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
  const [posts, setPosts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [pendingContact, setPendingContact] = useState(null);
  const [pendingApplicantId, setPendingApplicantId] = useState(null);
  const [pendingPostId, setPendingPostId] = useState(null);
  const [pendingStatusFilter, setPendingStatusFilter] = useState(null);

  // ── Suspension / Block enforcement while already logged in ─────────────────
  // signIn() in AuthService.js already blocks a suspended/blocked company
  // from signing back IN, but a company that was already logged in when a
  // coordinator takes action needs to be caught here too — this listens for
  // a live status change on the company's own doc and locks the dashboard
  // immediately, without waiting for a refresh.
  const [accountLocked, setAccountLocked] = useState(null); // null | "suspended" | "blocked"
  const [lockedByName, setLockedByName] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "companies", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const status = data.status;
      if (status === "suspended" || status === "blocked") {
        setAccountLocked(status);
        setLockedByName(data.statusUpdatedByName || "");
      }
    }, err => console.error("Account status listener error:", err));
    return () => unsub();
  }, [user?.uid]);

  const handleLockedSignOut = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      onLogout?.();
    }
  };

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

  // ── Notifications: new applicants, time-sorted ──────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  // Last-seen notification timestamp now lives in Firestore
  // (companies/{uid}.lastSeenNotif) instead of localStorage, so "seen" state
  // follows the account across browsers and devices.
  const [lastSeenNotif, setLastSeenNotif] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "companies", user.uid));
        if (cancelled) return;
        const data = snap.data();
        setLastSeenNotif(Number(data?.lastSeenNotif) || 0);
      } catch (err) {
        console.error("Failed to load notification seen state:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const notifications = React.useMemo(() => {
    return [...applications]
      .map((a) => ({
        id: `app-${a.id}`,
        time: (a.createdAt?.seconds || 0) * 1000,
        title: "New applicant",
        subtitle: [
          [a.firstName, a.middleInitial, a.lastName].filter(Boolean).join(" ") || a.studentName || a.studentFullName || a.name || "A student",
          a.jobTitle || a.postTitle || a.position,
        ].filter(Boolean).join(" — applied for "),
        applicantId: a.id,
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 30)
      .map((n) => ({ ...n, unread: n.time > lastSeenNotif, onClick: () => { setNotifOpen(false); navigate("applicants", n.applicantId); } }));
  }, [applications, lastSeenNotif]);

  const toggleNotif = () => {
    setNotifOpen((prev) => {
      const next = !prev;
      if (next) {
        const now = Date.now();
        setLastSeenNotif(now);
        if (user?.uid) {
          setDoc(doc(db, "companies", user.uid), { lastSeenNotif: now }, { merge: true })
            .catch((err) => console.error("Failed to save notification seen state:", err));
        }
      }
      return next;
    });
  };

  const navigate = (key, id = null, status = null) => { 
    setDrawerOpen(false);
    if (id) {
      if (key === "applicants") setPendingApplicantId(id);
      if (key === "createpost") setPendingPostId(id);
    }
    if (status && key === "applicants") setPendingStatusFilter(status);
    routerNavigate(`${COMPANY_BASE_PATH}/${key}`);
  };

  const handleNavigateToMessages = (contact) => {
    setPendingContact(contact);
    navigate("messages");
  };

  const handleNavigateToApplicant = (applicantId) => {
    setPendingApplicantId(applicantId);
    navigate("applicants");
  };

  useEffect(() => {
    if (activeNav !== "messages") setPendingContact(null);
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== "applicants") setPendingApplicantId(null);
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== "createpost") setPendingPostId(null);
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== "applicants") setPendingStatusFilter(null);
  }, [activeNav]);

  const renderContent = () => {
    switch (activeNav) {
      case "dashboard":
        return <DashboardContent onNavigate={navigate} applications={applications} posts={posts} />;
      case "createpost":
        return (
          <CompanyCreatePostScreen
            embedded
            onViewChange={setScreenSubView}
            user={user}
            openPostId={pendingPostId}
            onPostOpened={() => setPendingPostId(null)}
          />
        );
      case "applicants":
        return (
          <CompanyApplicantsScreen
            embedded
            onViewChange={setScreenSubView}
            user={user}
            onNavigateToMessages={handleNavigateToMessages}
            openApplicantId={pendingApplicantId}
            onApplicantOpened={() => setPendingApplicantId(null)}
            initialStatusFilter={pendingStatusFilter}
            onStatusFilterApplied={() => setPendingStatusFilter(null)}
          />
        );
      case "messages":
        return (
          <CompanyMessageScreen
            onViewChange={setScreenSubView}
            user={user}
            openContact={pendingContact}
            onContactOpened={() => setPendingContact(null)}
          />
        );
      case "accountprofile":
        return <CompanyAccountProfileScreen user={user} onLogout={onLogout} onViewChange={setScreenSubView} />;
      case "coordinators":
        return (
          <CompanyCoordinatorsScreen
            embedded
            user={user}
            onNavigateToMessages={handleNavigateToMessages}
          />
        );
      case "about":
        return <AboutUsScreen onBack={() => navigate("dashboard")} />;
      default:
        return <DashboardContent onNavigate={navigate} applications={applications} posts={posts} />;
    }
  };

  const currentLabel = navItems.find(n => n.key === activeNav)?.label ?? "";

  // Hard gate: a suspended/blocked company sees only this — no dashboard
  // content, forms, or nav underneath it, and their only option is to sign out.
  if (accountLocked) {
    const isBlocked = accountLocked === "blocked";
    return (
      <>
        <FontImport />
        <div style={{
          width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "18px",
          background: `linear-gradient(180deg, ${ink} 0%, ${inkDeep} 100%)`, padding: "24px", textAlign: "center",
        }}>
          <span style={{ fontSize: "3rem" }}>{isBlocked ? "⛔" : "⏸"}</span>
          <h1 style={{ fontFamily: uiFont, fontWeight: 700, fontSize: "2.2rem", color: paper }}>
            {isBlocked ? "Account Blocked" : "Account Suspended"}
          </h1>
          <p style={{ fontFamily: uiFont, fontSize: "0.95rem", color: "rgba(255,255,255,0.85)", maxWidth: "420px", lineHeight: 1.6 }}>
            {isBlocked
              ? `Your company account has been blocked ${lockedByName ? `by ${lockedByName}` : "by a coordinator"}. Please contact the system administrator for more information.`
              : `Your company account has been suspended ${lockedByName ? `by ${lockedByName}` : "by a coordinator"}. Please contact the system administrator for more information.`}
          </p>
          <button
            onClick={handleLockedSignOut}
            style={{
              marginTop: "10px", padding: "11px 28px", borderRadius: "24px",
              background: paper, color: inkDeep, border: "none",
              fontFamily: uiFont, fontWeight: 700, fontSize: "1.1rem", cursor: "pointer",
            }}
          >Sign Out</button>
        </div>
      </>
    );
  }

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
              <button className="chamburger-btn" onClick={() => setDrawerOpen(o => !o)} aria-label="Toggle menu" style={{ flexShrink: 0 }}>
                <span /><span /><span />
              </button>
            )}
            <button onClick={() => navigate("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", padding: "0", flexShrink: 0 }}>
              <img src={logo} alt="OJTern" style={{ width: "40px", height: "40px", objectFit: "contain", flexShrink: 0 }} />
              <span style={{
                fontFamily: logoFont,
                fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
                color: paper, letterSpacing: "0.03em", flexShrink: 0,
              }}>
                OJTern
              </span>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            <NotificationBell items={notifications} open={notifOpen} onToggle={toggleNotif} />
            <div id="cdash-about-icon" style={{ cursor: "pointer", padding: "8px" }} onClick={() => navigate("about")} title="About">
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
            <div className="csidebar-static">
              <SidebarNav activeNav={activeNav} onNavigate={navigate} onLogout={handleLogoutClick} unreadMessages={unreadMessages} />
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
          <div className="cmain-content">
            {renderContent()}
          </div>
        </div>

        <FloatingHelpButton
          activeNav={tourKey}
          onBeforeTour={() => setNotifOpen(false)}
        />
      </div>
    </>
  );
};

// ── Named exports kept for backward compatibility ──────────────────────────────
export const Sidebar    = ({ activeNav, setActiveNav }) => <SidebarNav activeNav={activeNav} onNavigate={setActiveNav} />;
export const TopNavBar  = () => (
  <div style={{
    height: "70px", flexShrink: 0,
    background: `linear-gradient(90deg, ${ink} 0%, ${inkDeep} 100%)`,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <img src={require("../icons/ojtern.png")} alt="OJTern" style={{ width: "46px", height: "46px", objectFit: "contain" }} />
      <span style={{ fontFamily: logoFont, fontSize: "1.5rem", color: paper, letterSpacing: "0.03em" }}>OJTern</span>
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