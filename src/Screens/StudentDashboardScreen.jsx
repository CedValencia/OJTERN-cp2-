import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where, orderBy, limit, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db } from "./firebase";
import { changePassword, logOut } from "./AuthService";
import { normalizeEmail, isValidEmail } from "./studentPersonalEmail";
import { useUnreadCount } from "./useChat";
import { color, font, ease, ACCENT_THEMES, ACCENT_THEME_ORDER, getSavedAccentThemeId, saveAccentThemeId, getAccentThemeVars, getThemedAsset } from "./theme";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

import StudentFindCompanyScreen, { useOjtPosts } from "./StudentFindCompanyScreen";
import StudentApplicationScreen from "./StudentApplicationScreen";
import StudentMessagesScreen from "./StudentMessagesScreen";
import StudentAccountProfileScreen, { PersonalInfoScreen, ResponsiveStyles as ProfileResponsiveStyles } from "./StudentAccountProfileScreen";
import AboutUsScreen from "./AboutUsScreen";

import logo from "../icons/ojtern.png";
import dashboardIcon      from "../icons/dashboard.png";
import blackViewIcon      from "../icons/blackview.png";
import redViewIcon        from "../icons/redview.png";
import blueViewIcon       from "../icons/blueview.png";
import violetViewIcon     from "../icons/violetview.png";
import pinkViewIcon       from "../icons/pinkview.png";
import yellowViewIcon     from "../icons/yellowview.png";

import blackCompanyProfileIcon from "../icons/blackcompanyprofile.png";
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
import applicationIcon    from "../icons/application.png";
import messagesIcon       from "../icons/messages.png";
import accountProfileIcon from "../icons/accountprofile.png";
import aboutIcon          from "../icons/about.png";

// Nav bar "change color" accent theme → matching view-icon asset. Keyed by
// ACCENT_THEMES id (see theme.js); "default" ("Original") uses blackview.png.
// Resolved once per render via getThemedAsset(VIEW_ICON_BY_THEME,
// accentThemeId) and threaded down as a prop, since ViewBtn/ArrowBtn are
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

// ── First-login account setup (Student ID accounts) ────────────────────────────
// Bulk-created student accounts sign in to Firebase Auth with a system-generated
// email nobody can receive mail at. Before the dashboard opens, the student must:
//   1. replace the temporary password  → students/{uid}.passwordChanged = true
//   2. log in again with the new password
//   3. register a real recovery email  → students/{uid}.personalEmail
// The Firebase Auth email is deliberately NOT changed: Student ID login depends
// on it. Forgot Password reads personalEmail server-side (Cloud Function) instead.
// Email validation and the uniqueness index live in ./studentPersonalEmail.
// Decides which setup step to show, from the student's Firestore document.
// Every missing field is treated as "not done yet", so older bulk-created
// documents that never had these fields still enter the first-login flow.
const computeSetupStage = (data = {}, authUser = null) => {
  if (data.passwordChanged !== true) return "password";

  // Password was changed, but this sign-in session started *before* that change
  // (for example, the page was reloaded on the success screen). Require a fresh
  // login with the new password before moving on.
  const changedAtMs  = typeof data.passwordChangedAt?.toMillis === "function" ? data.passwordChangedAt.toMillis() : null;
  const signedInAtMs = authUser?.metadata?.lastSignInTime ? Date.parse(authUser.metadata.lastSignInTime) : null;
  if (changedAtMs && signedInAtMs && signedInAtMs < changedAtMs) return "relogin";

  if (!isValidEmail(data.personalEmail)) return "personal";
  return "done";
};

const isAuthError = (err) => String(err?.code || "").startsWith("auth/");

// changePassword() can throw *after* Firebase already accepted the new password
// (e.g. its Firestore write failed). Re-authenticating with the new password tells
// us which side of that line we're on, so we never show "failed" for a password
// that actually changed.
const passwordNowMatches = async (password) => {
  const authUser = getAuth().currentUser;
  if (!authUser?.email) return false;
  try {
    await reauthenticateWithCredential(authUser, EmailAuthProvider.credential(authUser.email, password));
    return true;
  } catch {
    return false;
  }
};

const SESSION_EXPIRED_MSG = "Your session has expired. Log out, log in again, then set your new password.";
const PASSWORD_ERROR_MESSAGES = {
  "auth/wrong-password":            "Your temporary password is incorrect.",
  "auth/invalid-credential":        "Your temporary password is incorrect.",
  "auth/invalid-login-credentials": "Your temporary password is incorrect.",
  "auth/too-many-requests":         "Too many attempts. Wait a few minutes, then try again.",
  "auth/network-request-failed":    "No internet connection. Check your connection, then try again.",
  "auth/weak-password":             "That password is too weak. Choose a stronger one.",
  "auth/requires-recent-login":     SESSION_EXPIRED_MSG,
  "auth/user-token-expired":        SESSION_EXPIRED_MSG,
};
const friendlyPasswordError = (err) => {
  if (PASSWORD_ERROR_MESSAGES[err?.code]) return PASSWORD_ERROR_MESSAGES[err.code];
  if (isAuthError(err)) return "We couldn't update your password. Try again.";
  return err?.message || "We couldn't update your password. Try again.";
};

// ── Setup modal building blocks (same look as the original Set New Password modal) ──
const EyeIcon = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {open
      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
      : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
  </svg>
);

const SetupModal = ({ title, titleId, children }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.65)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "1rem",
  }}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={{
      background: paper, borderRadius: "24px",
      border: `2px solid ${ink}`, overflow: "hidden",
      width: "100%", maxWidth: "400px", maxHeight: "calc(100vh - 2rem)",
      display: "flex", flexDirection: "column",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    }}>
      <div style={{ background: ink, padding: "14px 18px", textAlign: "center", flexShrink: 0 }}>
        <span id={titleId} style={{ fontFamily: uiFont, fontWeight: 700, fontSize: "1.15rem", color: paper, letterSpacing: "0.02em" }}>
          {title}
        </span>
      </div>
      <div style={{ padding: "20px clamp(16px, 5vw, 24px) 24px", overflowY: "auto", overflowWrap: "anywhere" }}>
        {children}
      </div>
    </div>
  </div>
);

const SetupIntro = ({ children }) => (
  <p style={{ fontFamily: uiFont, fontSize: "0.85rem", color: inkMuted, textAlign: "center", marginBottom: "16px", lineHeight: 1.6 }}>
    {children}
  </p>
);

const setupInputStyle = (hasError, withToggle) => ({
  width: "100%",
  padding: withToggle ? "10px 44px 10px 16px" : "10px 16px",
  background: ink,
  border: hasError ? `1.5px solid ${color.danger}` : "none",
  borderRadius: "20px",
  color: paper,
  fontSize: "0.88rem",
  fontFamily: uiFont,
  outline: "none",
  boxSizing: "border-box",
});

const SetupPasswordInput = ({ value, onChange, placeholder, visible, onToggle, hasError, disabled, onEnter, autoComplete, marginBottom = "10px", id }) => (
  <div id={id} style={{ position: "relative", marginBottom }}>
    <input
      type={visible ? "text" : "password"}
      placeholder={placeholder}
      aria-label={placeholder.replace(/:$/, "")}
      value={value}
      disabled={disabled}
      autoComplete={autoComplete}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }}
      style={setupInputStyle(hasError, true)}
    />
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", background: "none", border: "none", padding: "2px", display: "flex" }}
    >
      <EyeIcon open={visible} />
    </button>
  </div>
);

const SetupError = ({ msg }) => msg ? (
  <p role="alert" style={{ fontFamily: uiFont, fontSize: "0.78rem", color: color.danger, margin: "4px 0 8px 4px", lineHeight: 1.5 }}>⚠️ {msg}</p>
) : null;

const SetupActions = ({ label, loadingLabel, loading, onClick, onLogout, logoutBusy, buttonId }) => (
  <>
    <hr style={{ border: "none", borderTop: `1.5px solid ${hairline}`, margin: "16px 0" }} />
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <button
        id={buttonId}
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        className="pill-btn"
        style={{ background: ink, color: paper, border: "none", borderRadius: "24px", padding: "12px 20px", width: "100%", maxWidth: "260px", fontFamily: uiFont, fontWeight: 700, fontSize: "1.05rem", letterSpacing: "0.02em", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? loadingLabel : label}
      </button>
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          disabled={loading || logoutBusy}
          style={{ background: "none", border: "none", fontFamily: uiFont, fontSize: "0.8rem", color: inkMuted, textDecoration: "underline", cursor: loading || logoutBusy ? "not-allowed" : "pointer", padding: "4px" }}
        >
          {logoutBusy ? "Logging out…" : "Log Out"}
        </button>
      )}
    </div>
  </>
);

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
    .snav-item:hover  { background: ${color.hoverWash}; }
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
    .snav-logout:hover  { background: ${color.hoverWash}; }
    .snav-logout:active { transform: scale(0.98); }

    @keyframes badgePop {
      0%   { transform: scale(0.5); opacity: 0; }
      70%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); }
    }
    .nav-badge { animation: badgePop 0.25s ${ease}; box-shadow: 0 2px 6px rgba(20,20,20,0.25); }

    .company-row { transition: background 0.15s; cursor: pointer; }
    .company-row:hover { background: ${color.hoverWashStrong} !important; }
    .visited-row { transition: background 0.15s; cursor: pointer; }
    .visited-row:hover { background: ${color.hoverWashStrong} !important; }
    .app-row { transition: background 0.15s; cursor: pointer; }
    .app-row:hover { background: ${color.hoverWashStrong} !important; }

    .topbar-icon-btn { transition: background 0.18s ${ease}, transform 0.12s ${ease}; border-radius: 999px; }
    .topbar-icon-btn:hover { background: rgba(255,255,255,0.14); }
    .topbar-icon-btn:active { transform: scale(0.94); }

    .stat-view-btn { transition: transform 0.18s ${ease}; }
    .stat-view-btn:hover { transform: scale(1.08); }
    .company-row-view-btn { transition: transform 0.18s ${ease}; }
    .company-row-view-btn:hover { transform: scale(1.15); }

    .pill-btn { transition: filter 0.18s ${ease}, transform 0.12s ${ease}, box-shadow 0.18s ${ease}; }
    .pill-btn:hover { filter: brightness(1.25); }
    .pill-btn:active { transform: scale(0.97); }

    .notif-row { transition: background 0.15s ${ease}; }
    .notif-row:hover { background: ${color.hoverWash} !important; }

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
  { key: "application",    label: "Recent Application",     icon: applicationIcon },
  { key: "messages",       label: "Messages",        icon: messagesIcon },
  { key: "accountprofile", label: "Account Profile", icon: accountProfileIcon },
];

// ── Shared sub-components ──────────────────────────────────────────────────────
// Chip-style avatar (raised, boxed) — matches CompanyAvatar in the
// Coordinator/Company dashboards instead of a bare flat icon.
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

const ViewBtn = ({ viewIcon: themedViewIcon = blackViewIcon }) => (
  <div className="company-row-view-btn" style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
    <img src={themedViewIcon} alt="view" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
  </div>
);

const ArrowBtn = ({ viewIcon: themedViewIcon = blackViewIcon }) => (
  <div className="company-row-view-btn" style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
    <img src={themedViewIcon} alt="view" style={{ width: "33px", height: "33px", objectFit: "contain" }} />
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
  const key = rest.replace(/^\/+|\/+$/g, ""); // strip leading/trailing slashes
  return key || "dashboard";
};

// ── Cached student uid (theme flash fix, same pattern as Coordinator) ──────
const LAST_STUDENT_UID_KEY = "ojtern-last-student-uid";
const getCachedStudentUid = () => {
  try { return localStorage.getItem(LAST_STUDENT_UID_KEY); } catch { return null; }
};
const setCachedStudentUid = (uid) => {
  try {
    if (uid) localStorage.setItem(LAST_STUDENT_UID_KEY, uid);
    else localStorage.removeItem(LAST_STUDENT_UID_KEY);
  } catch { /* localStorage unavailable */ }
};

// ── Auto-tour helpers — Dashboard, Find Company, Application, Messages, and
// Account Profile each have their own entry below and their own element ids
// in their respective screen files. AUTO_TOUR_NAV_KEYS (further down) is
// just Object.keys(HELP_STEPS_BY_STUDENT_NAV), so adding a new nav key here
// with a matching HELP_STEPS_BY_STUDENT_NAV entry is enough to give any
// other screen this same one-time auto-tour behavior. ─────────────────────
const AUTO_TOUR_DELAY_MS = 450;
// Cards whose step must never scroll/recenter the page when highlighted.
const STEADY_TOUR_ELEMENT_IDS = [];
// Step targets that are their own scroll box on purpose — kept scrollable
// during a tour (every other scrollable container is locked).
const SCROLLABLE_TOUR_TARGET_IDS = ["sprofile-details-full"];

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

const runTour = (steps) => {
  // driver.js only locks the page/body's own scroll while a tour runs, but
  // every Student screen scrolls inside its own container (.smain-content,
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

// Shared by Terms and Privacy (separate keys so each auto-plays once).
const LEGAL_STEPS = [
    {
      element: "#slegal-header",
      popover: {
        title: "Title & Last Updated",
        description: "The document you're reading and the date it was last updated. If it changes, the date here changes too.",
      },
    },
    {
      element: "#slegal-toc",
      popover: {
        title: "On This Page",
        description: "Every section of this document. Tap one to jump straight to it — the section you're reading is marked.",
      },
    },
    {
      element: "#slegal-first-section",
      popover: {
        title: "Sections",
        description: "Each section explains one part of the document. Scroll down to read them all.",
      },
    },
    {
      element: "#slegal-progress",
      popover: {
        title: "Reading Progress",
        description: "This thin bar fills up as you scroll, showing how far through the document you are.",
      },
    },
    {
      element: "#slegal-understand-btn",
      popover: {
        title: "I Understand",
        description: "When you're done reading, tap this to return to your Account Profile.",
      },
    },
  ];

// Screen sub-view (from each screen's onViewChange) → HELP_STEPS key.
const STUDENT_SUBVIEW_TOUR_KEYS = {
  findcompany:    { profile: "findcompanyprofile", report: "findcompanyreport", apply: "applyform" },
  application:    { apply: "applyform", view: "applicationview", edit: "applicationedit" },
  messages:       { chat: "messageschat", report: "messagesreport" },
  accountprofile: { personalInfo: "accprofilepersonal", personalInfoEdit: "accprofilepersonaledit", terms: "accprofileterms", privacy: "accprofileprivacy", reset: "accprofilereset" },
};

const HELP_STEPS_BY_STUDENT_NAV = {
  dashboard: [
    {
      element: "#sdash-recommended",
      popover: {
        title: "Recommended OJT Companies",
        description: "Companies open to your program. Tap one to view its full post.",
      },
    },
    {
      element: "#sdash-recent-visited",
      popover: {
        title: "Recent Visited Company Post",
        description: "Companies you've recently opened, with how long ago you visited each one.",
      },
    },
    {
      element: "#sdash-recent-application",
      popover: {
        title: "Recent Application",
        description: "Your latest applications and their current status. Tap one to see the full details.",
      },
    },
    {
      element: "#stopbar-notifications",
      popover: {
        title: "Notifications",
        description: "Updates on your applications land here. Tap one to jump straight to it.",
      },
    },
    {
      element: "#stopbar-about",
      popover: {
        title: "About",
        description: "Learn more about OJTern and the team behind it.",
      },
    },
    {
      element: "#stopbar-theme-picker",
      popover: {
        title: "Theme Customization",
        description: "Change the dashboard's accent color. Your choice is saved on this device and applies across every module.",
      },
    },
  ],
  findcompany: [
    {
      element: "#sfind-search-bar",
      popover: {
        title: "Search Company Posts",
        description: "Search by company name, industry, or location. The count above updates to match your current search and filters.",
      },
    },
    {
      element: "#sfind-filter-btn",
      popover: {
        title: "Filters",
        description: "Narrow the list down by industry or city. Active filters show as removable chips below the search bar.",
      },
    },
    {
      element: firstListItem(["#sfind-grid > *"], "#sfind-grid"),
      popover: {
        title: "Company Posts",
        description: "Each card is one open post for your program. Tap any card to view the full company profile, apply, or message them.",
      },
    },
  ],
  application: [
    {
      element: "#sapp-search-bar",
      popover: {
        title: "Search Applications",
        description: "Search your applications by company name. The count above updates to match what you type.",
      },
    },
    {
      element: "#sapp-status-chips",
      popover: {
        title: "Filter by Status",
        description: "Quickly filter your applications — Accepted, Declined, Pending, In Review, or To Interview.",
      },
    },
    {
      element: firstListItem(["#sapp-list .sa-app-row"], "#sapp-list"),
      popover: {
        title: "Your Applications",
        description: "Each row is one application you've submitted. Tap any row to see its full details and current status, or use ⋮ for more options.",
      },
    },
  ],
  messages: [
    {
      element: "#smsg-search-bar",
      popover: {
        title: "Search Conversations",
        description: "Search your chats by company name. The list below updates to match what you type.",
      },
    },
    {
      element: firstListItem(["#smsg-chat-list .msg-row"], "#smsg-chat-list"),
      popover: {
        title: "Conversations",
        description: "Each row is one chat, newest activity first. Tap any row to open the full conversation.",
      },
    },
  ],
  accountprofile: [
    {
      element: "#sacc-personal-info",
      popover: {
        title: "Personal Information",
        description: "View and edit your name, contact details, and other personal info on file.",
      },
    },
    {
      element: "#sacc-security",
      popover: {
        title: "Reset Password",
        description: "Change your account password. You'll be asked for your current password first.",
      },
    },
    {
      element: "#sacc-legal",
      popover: {
        title: "Terms & Privacy",
        description: "Review OJTern's Terms & Conditions and Privacy Policy at any time.",
      },
    },
  ],
  // ── Sub-views & modals (set via each screen's onViewChange; see tourKey) ──
  findcompanyprofile: [
    {
      element: "#sprofile-details",
      popover: {
        title: "Company Name & Description",
        description: "Who the company is and what this post is about. Tap Back to return to the list.",
      },
    },
    {
      element: "#sprofile-map",
      popover: {
        title: "Location Map",
        description: "Where the company is. Use Open full map for a bigger, interactive view.",
      },
    },
    {
      element: "#sprofile-details-full",
      popover: {
        title: "Post Details",
        description: "Requirements, working hours, contact, location, benefits, open programs and their slots, industry, and skills required. Scroll inside to read everything.",
      },
    },
    {
      element: "#sprofile-apply-btn",
      popover: {
        title: "Apply Now!",
        description: "Opens the application form for this post.",
      },
    },
    {
      element: "#sprofile-message-btn",
      popover: {
        title: "Message Now!",
        description: "Chat with the company directly about this post.",
      },
    },
    {
      element: "#sprofile-report-btn",
      popover: {
        title: "Report",
        description: "Report this company if something about it or its post seems wrong.",
      },
    },
  ],
  findcompanyreport: [
    {
      element: "#sreport-progress",
      popover: {
        title: "Report Steps",
        description: "Reporting takes 3 short steps — this bar shows which one you're on.",
      },
    },
    {
      element: "#sreport-concerns",
      popover: {
        title: "What Is the Concern?",
        description: "Pick the option that best describes what happened, then tap Continue.",
      },
    },
    {
      element: "#sreport-details",
      popover: {
        title: "About This Concern",
        description: "What this kind of concern covers, with common examples — check it matches before continuing.",
      },
    },
    {
      element: "#sreport-describe",
      popover: {
        title: "Describe What Happened",
        description: "Include dates, names, and anything the review team should know.",
      },
    },
    {
      element: "#sreport-evidence",
      popover: {
        title: "Attach Evidence",
        description: "Attach one PNG or PDF (up to 10MB) that supports your report. It's required.",
      },
    },
    {
      element: "#sreport-actions",
      popover: {
        title: "Continue or Send",
        description: "Back and Continue move between steps. On the last step, Send report submits it for review.",
      },
    },
  ],
  messagesreport: [
    {
      element: "#sreport-progress",
      popover: {
        title: "Report Steps",
        description: "Reporting takes 3 short steps — this bar shows which one you're on.",
      },
    },
    {
      element: "#sreport-concerns",
      popover: {
        title: "What Is the Concern?",
        description: "Pick the option that best describes what happened, then tap Continue.",
      },
    },
    {
      element: "#sreport-details",
      popover: {
        title: "About This Concern",
        description: "What this kind of concern covers, with common examples — check it matches before continuing.",
      },
    },
    {
      element: "#sreport-describe",
      popover: {
        title: "Describe What Happened",
        description: "Include dates, names, and anything the review team should know.",
      },
    },
    {
      element: "#sreport-evidence",
      popover: {
        title: "Attach Evidence",
        description: "Attach one PNG or PDF (up to 10MB) that supports your report. It's required.",
      },
    },
    {
      element: "#sreport-actions",
      popover: {
        title: "Continue or Send",
        description: "Back and Continue move between steps. On the last step, Send report submits it for review.",
      },
    },
  ],
  applyform: [
    {
      element: "#sapply-header",
      popover: {
        title: "Apply Now",
        description: "The company you're applying to. If you've already applied to this post, or it isn't accepting applications, you'll see that here instead.",
      },
    },
    {
      element: "#sform-name",
      popover: {
        title: "Name",
        description: "Your first name, middle initial, last name, and suffix.",
      },
    },
    {
      element: "#sform-sex",
      popover: {
        title: "Sex",
        description: "Choose Male or Female.",
      },
    },
    {
      element: "#sform-location",
      popover: {
        title: "Location",
        description: "Pick your region, province, city, and barangay, then add your street.",
      },
    },
    {
      element: "#sform-college",
      popover: {
        title: "College, Program, Major",
        description: "Your college, then your program, then your major if it has one.",
      },
    },
    {
      element: "#sform-contact",
      popover: {
        title: "Contact & Email",
        description: "Your mobile number and an email address the company can reach you at.",
      },
    },
    {
      element: "#sform-message",
      popover: {
        title: "Application Message",
        description: "A short message to the company about why you're applying.",
      },
    },
    {
      element: "#sform-files",
      popover: {
        title: "Attach File",
        description: "Attach your resume and other requirements — up to 10MB in total.",
      },
    },
    {
      element: "#sapply-footer",
      popover: {
        title: "Cancel or Submit",
        description: "Submit sends your application to the company. Cancel closes the form without applying.",
      },
    },
  ],
  applicationview: [
    {
      element: "#sview-header",
      popover: {
        title: "Application",
        description: "Your name and the company this application was sent to.",
      },
    },
    {
      element: "#sview-status",
      popover: {
        title: "Current Status",
        description: "Where your application stands right now.",
      },
    },
    {
      element: "#sview-tracker",
      popover: {
        title: "Application Status",
        description: "Progress from Pending → In Review → To Interview → Accepted. Declined applications show here too.",
      },
    },
    {
      element: "#sform-name",
      popover: {
        title: "Name",
        description: "The first name, middle initial, last name, and suffix you applied with.",
      },
    },
    {
      element: "#sform-sex",
      popover: {
        title: "Sex",
        description: "The sex you put on this application.",
      },
    },
    {
      element: "#sform-location",
      popover: {
        title: "Location",
        description: "The region, province, city, barangay, and street you gave.",
      },
    },
    {
      element: "#sform-college",
      popover: {
        title: "College, Program, Major",
        description: "The college, program, and major you applied under.",
      },
    },
    {
      element: "#sform-contact",
      popover: {
        title: "Contact & Email",
        description: "The mobile number and email the company can reach you at.",
      },
    },
    {
      element: "#sform-message",
      popover: {
        title: "Application Message",
        description: "The message you sent to the company.",
      },
    },
    {
      element: "#sform-files",
      popover: {
        title: "Attached Files",
        description: "The files you attached. Tap one to open it.",
      },
    },
    {
      element: "#sview-footer",
      popover: {
        title: "Edit",
        description: "You can edit your application while it's still Pending. Once it moves on, it's locked.",
      },
    },
  ],
  applicationedit: [
    {
      element: "#sform-name",
      popover: {
        title: "Name",
        description: "Your first name, middle initial, last name, and suffix.",
      },
    },
    {
      element: "#sform-sex",
      popover: {
        title: "Sex",
        description: "Choose Male or Female.",
      },
    },
    {
      element: "#sform-location",
      popover: {
        title: "Location",
        description: "Pick your region, province, city, and barangay, then add your street.",
      },
    },
    {
      element: "#sform-college",
      popover: {
        title: "College, Program, Major",
        description: "Your college, then your program, then your major if it has one.",
      },
    },
    {
      element: "#sform-contact",
      popover: {
        title: "Contact & Email",
        description: "Your mobile number and an email address the company can reach you at.",
      },
    },
    {
      element: "#sform-message",
      popover: {
        title: "Application Message",
        description: "A short message to the company about why you're applying.",
      },
    },
    {
      element: "#sform-files",
      popover: {
        title: "Attach File",
        description: "Attach your resume and other requirements — up to 10MB in total.",
      },
    },
    {
      element: "#sview-footer",
      popover: {
        title: "Cancel or Save",
        description: "Save updates your application. Cancel discards your changes.",
      },
    },
  ],
  messageschat: [
    {
      element: "#smsgchat-header",
      popover: {
        title: "Conversation",
        description: "Who you're chatting with. Tap the back arrow to return to all your conversations.",
      },
    },
    {
      element: lastListItem([".msg-thread-body .msg-bubble-wrap"]),
      popover: {
        title: "Messages",
        description: "Tap and hold a message, or tap its ⋮, to reply. Your own messages can also be edited or unsent. Seen shows once they've read your latest one.",
      },
    },
    {
      element: "#smsgchat-options",
      popover: {
        title: "Conversation Options",
        description: "More options for this chat — delete the conversation (only for you) or report the company.",
      },
    },
    {
      element: "#smsgchat-attach",
      popover: {
        title: "Attach Files",
        description: "Attach PNG images or PDF files to your message.",
      },
    },
    {
      element: "#smsgchat-input",
      popover: {
        title: "Write a Message",
        description: "Type your message here. Press Enter to send.",
      },
    },
    {
      element: "#smsgchat-send",
      popover: {
        title: "Send",
        description: "Sends your message and any attached files.",
      },
    },
  ],
  accprofilepersonal: [
    {
      element: "#spinfo-edit-btn",
      popover: {
        title: "Edit",
        description: "Tap Edit to update your age and email address.",
      },
    },
    {
      element: "#spinfo-studentid",
      popover: {
        title: "Student ID",
        description: "Your student ID number. It's how your account is identified, so it can't be changed.",
      },
    },
    {
      element: "#spinfo-first",
      popover: {
        title: "First Name",
        description: "Your first name.",
      },
    },
    {
      element: "#spinfo-middle",
      popover: {
        title: "Middle Initial",
        description: "Your middle initial.",
      },
    },
    {
      element: "#spinfo-last",
      popover: {
        title: "Last Name",
        description: "Your last name.",
      },
    },
    {
      element: "#spinfo-suffix",
      popover: {
        title: "Suffix",
        description: "Your suffix, like Jr. or III, if you have one.",
      },
    },
    {
      element: "#spinfo-college",
      popover: {
        title: "College",
        description: "The college you belong to.",
      },
    },
    {
      element: "#spinfo-program",
      popover: {
        title: "Program & Major",
        description: "Your program, and your major if it has one. This decides which company posts you see.",
      },
    },
    {
      element: "#spinfo-section",
      popover: {
        title: "Year and Section",
        description: "Your current year and section.",
      },
    },
    {
      element: "#spinfo-sex",
      popover: {
        title: "Sex",
        description: "Your sex on file.",
      },
    },
    {
      element: "#spinfo-age",
      popover: {
        title: "Age",
        description: "Your age on file.",
      },
    },
    {
      element: "#spinfo-email",
      popover: {
        title: "Email Address",
        description: "Your personal email — used if you ever need to reset a forgotten password.",
      },
    },
  ],
  accprofilepersonaledit: [
    {
      element: "#spinfo-age",
      popover: {
        title: "Age",
        description: "Type your current age.",
      },
    },
    {
      element: "#spinfo-email",
      popover: {
        title: "Email Address",
        description: "Your personal email, used for Forgot Password. Make sure it's one you can open.",
      },
    },
    {
      element: "#spinfo-save",
      popover: {
        title: "Save Changes",
        description: "Save your updated age and email, or Cancel to discard them.",
      },
    },
  ],
  accprofileterms: LEGAL_STEPS,
  accprofileprivacy: LEGAL_STEPS,
  accprofilereset: [
    {
      element: "#sreset-current",
      popover: {
        title: "Current Password",
        description: "Enter the password you use now, to confirm it's really you.",
      },
    },
    {
      element: "#sreset-new",
      popover: {
        title: "New Password",
        description: "Choose a new password you don't use anywhere else. A checklist appears as you type, showing what's still missing.",
      },
    },
    {
      element: "#sreset-confirm",
      popover: {
        title: "Confirm New Password",
        description: "Type the same new password again.",
      },
    },
    {
      element: "#sreset-footer",
      popover: {
        title: "Cancel or Save",
        description: "Save password updates it and signs you out — log back in with the new one. Cancel keeps your current password.",
      },
    },
  ],
  about: [
    {
      element: "#cabout-story",
      popover: {
        title: "Our Story",
        description: "Learn what OJTern is, what it does, and the mission behind it.",
      },
    },
    {
      element: "#cabout-team",
      popover: {
        title: "The Team",
        description: "Meet the team behind OJTern.",
      },
    },
    {
      element: "#cabout-features",
      popover: {
        title: "What OJTern Offers",
        description: "A quick look at what OJTern gives students, coordinators, and companies.",
      },
    },
    {
      element: "#cabout-contact",
      popover: {
        title: "Need Help?",
        description: "Have questions or feedback? Reach out to the OJTern team any time.",
      },
    },
  ],
};

// ── First-login gate tours ──────────────────────────────────────────────────────
// The two mandatory pop-ups a brand-new student account walks through before it
// ever reaches the dashboard: forced password reset (setupStage "password"),
// then mandatory profile completion (setupStage "personal"). Both get their own
// one-time driver.js walkthrough, auto-started the moment each stage becomes
// active — see the setupStage-triggered effect further down.
const STUDENT_CHANGE_PASSWORD_STEPS = [
  {
    element: "#sp-current-password",
    popover: {
      title: "Current Password",
      description: "Enter the temporary password you were given when this account was created.",
    },
  },
  {
    element: "#sp-new-password",
    popover: {
      title: "New Password",
      description: "Choose your own password. The checklist below shows exactly what's still missing.",
    },
  },
  {
    element: "#sp-checklist",
    popover: {
      title: "Password Requirements",
      description: "Every item here needs a check mark before you can continue.",
    },
  },
  {
    element: "#sp-confirm-password",
    popover: {
      title: "Confirm Password",
      description: "Re-type the same new password to confirm it.",
    },
  },
  {
    element: "#sp-save-btn",
    popover: {
      title: "Save Password",
      description: "Saves your new password and signs you out. Log back in with it to finish setting up your account.",
    },
  },
];

const STUDENT_EDIT_INFO_STEPS = [
  {
    element: "#seditinfo-card",
    popover: {
      title: "Complete Your Profile",
      description: "Before you can use the dashboard, add your personal information here and save it. This only appears once.",
    },
  },
];

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
    requestAnimationFrame(() => runTour(HELP_STEPS_BY_STUDENT_NAV[activeNav]));
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
const DashboardContent = ({ onNavigate, onViewCompany, recentVisited = [], recentApplications = [], viewIcon: themedViewIcon = blackViewIcon, companyProfileIcon: themedCompanyIcon = blackCompanyProfileIcon }) => {

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
        <p className="welcome-sub welcome-animate">Find the perfect OJT placements for you!</p>
      </div>

      <hr style={{ border: "none", borderTop: `1.5px solid ${hairline}`, marginBottom: "24px" }} />

      {/* Top grid: 2-col on ≥768px, 1-col below */}
      <div className="sdash-top-grid">

        {/* Recommended OJT Companies */}
          <div id="sdash-recommended" className="sdash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
                    <CompanyAvatar size={38} companyProfileIcon={themedCompanyIcon} />
                    <span style={{ fontFamily: uiFont, fontSize: "clamp(0.75rem, 2vw, 0.82rem)", color: inkText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {company.companyName || company.company || company.name}
                    </span>
                  </div>
                  <ViewBtn viewIcon={themedViewIcon} />
                </div>
              ))
            ) : (
              <EmptyListPlaceholder label="No recommended companies yet" />
            )}
          </div>
        </div>

        {/* Recent Visited Company Profiles */}
          <div id="sdash-recent-visited" className="sdash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="scard-header"><span>Recent Visited Company Post</span></div>
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
                    <CompanyAvatar size={38} companyProfileIcon={themedCompanyIcon} />
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: uiFont, fontSize: "clamp(0.75rem, 2vw, 0.82rem)", color: inkText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {company.companyName || company.name}
                      </span>
                      {company.visitedAt && <span style={{ fontFamily: uiFont, fontSize: "0.68rem", color: steel, fontWeight: 600 }}>{timeAgo(company.visitedAt)}</span>}
                    </div>
                  </div>
                  <ArrowBtn viewIcon={themedViewIcon} />
                </div>
              ))
            ) : (
              <EmptyListPlaceholder label="No recently visited companies" />
            )}
          </div>
        </div>
      </div>

      {/* Recent Application */}
        <div id="sdash-recent-application" className="sdash-card" style={{ background: paperCard, borderRadius: "14px", overflow: "hidden" }}>
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
                  <CompanyAvatar size={38} companyProfileIcon={themedCompanyIcon} />
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

    const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    setCachedStudentUid(null);
    onLogout?.();
    logOut().catch((err) => console.error("Logout failed:", err));
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

  // ── Nav bar accent color picker ─────────────────────────────────────────────
  // Per-ACCOUNT scope ngayon ("student-{uid}"), hindi na bare "student" —
  // dati, lahat ng student accounts sa parehong device ay nagsha-share ng
  // parehong kulay (theme "leaking" sa pagitan ng accounts). Cached uid din
  // bilang best-guess habang hinihintay ang auth resolve pag-refresh, para
  // walang flash ng ibang/maling kulay.
  const resolveAccentScope = (uid) => (uid ? `student-${uid}` : null);
  const initialAccentScope = resolveAccentScope(user?.uid || getCachedStudentUid());

  const accentScope = resolveAccentScope(user?.uid);
  const [accentThemeId, setAccentThemeId] = useState(() =>
    initialAccentScope ? getSavedAccentThemeId(initialAccentScope) : "default"
  );
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    setCachedStudentUid(user.uid);
    setAccentThemeId(getSavedAccentThemeId(`student-${user.uid}`));
  }, [user?.uid]);

  const handleSelectAccent = (id) => {
    if (!accentScope) return;
    setAccentThemeId(saveAccentThemeId(accentScope, id));
    setShowThemeDropdown(false);
  };
  // View-icon PNG matching the current accent color (falls back to the
  // original black/white blackview.png for "default").
  const themedViewIcon = getThemedAsset(VIEW_ICON_BY_THEME, accentThemeId);
  // blackuser.png / blackcompanyprofile.png (default) and colored variants for the same accent color.
  const themedUserIcon    = getThemedAsset(USER_ICON_BY_THEME, accentThemeId);
  const themedCompanyIcon = getThemedAsset(COMPANY_PROFILE_ICON_BY_THEME, accentThemeId);

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
  // ── First-login account setup gate ─────────────────────────────────────────
  // Stages: "checking" → "password" → "relogin" → (log in again) → "personal" → "done".
  // Re-computed from Firestore on every load (computeSetupStage), so closing or
  // reloading the page part-way through never skips a step.
  const [setupStage, setSetupStage]             = useState("checking");
  const [setupProfile, setSetupProfile]         = useState({});
  const [setupLogoutBusy, setSetupLogoutBusy]   = useState(false);
  const [seenTours, setSeenTours]               = useState(null);
  const [seenToursLoaded, setSeenToursLoaded]   = useState(false);

  // Step 1 — Set new password
  const [currentPass, setCurrentPass]           = useState("");
  const [newPass, setNewPass]                   = useState("");
  const [confirmPass, setConfirmPass]           = useState("");
  const [passError, setPassError]               = useState("");
  const [passLoading, setPassLoading]           = useState(false);
  const [passFlagPending, setPassFlagPending]   = useState(false);
  const [showNew, setShowNew]                   = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);
  const [showCurrent, setShowCurrent]           = useState(false);


  const loadSetupStatus = async (uid) => {
    setSetupStage("checking");
    try {
      const snap = await getDoc(doc(db, "students", uid));
      const data = snap.exists() ? snap.data() : {};
      setSetupProfile({ personalEmail: isValidEmail(data.personalEmail) ? normalizeEmail(data.personalEmail) : "" });
      const stage = computeSetupStage(data, getAuth().currentUser);
      setSetupStage(stage);

      // Onboarding tours ay opt-in per account, permanenteng naka-mark sa
      // Firestore (hindi sa in-memory ref lang), para hindi ito nawawala
      // kahit anong session/refresh pa. Isang beses lang ito ma-i-initialize:
      // sa unang beses na makita nating hindi pa "done" ang setup ng account
      // (ibig sabihin, tunay na bagong account). Kung wala kailanman itong
      // stage na hindi "done" (existing/returning account), hindi kailanman
      // magkakaroon ng `seenTours` field — kaya manual "?" button lang, walang
      // auto-tour.
      if (stage !== "done" && !data.seenTours) {
        setDoc(doc(db, "students", uid), { seenTours: {} }, { merge: true }).catch((err) =>
          console.error("Failed to initialize onboarding tour tracking:", err)
        );
        setSeenTours({});
      } else {
        setSeenTours(data.seenTours || null);
      }
      setSeenToursLoaded(true);
    } catch (err) {
      console.error("Failed to load account setup status:", err);
      setSetupStage("error");
    }
  };

  // `user` ay null sa unang render pagka-refresh — naka-mount na ang dashboard
  // bago pa dumating ang profile. Ang null ay "hindi pa alam", kaya hinihintay
  // muna bago magpasya. Isang beses lang bawat user (didGateInit). The status is
  // read straight from Firestore instead of trusting the `user` prop, because the
  // prop can be stale right after a password or email update.
  const didGateInit = useRef(null);
  useEffect(() => {
    if (!user?.uid || didGateInit.current === user.uid) return;
    didGateInit.current = user.uid;
    loadSetupStatus(user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Auto-starts the walkthrough the moment each mandatory first-login pop-up
  // appears — fires once per mount (guarded by the ref, not by Firestore/
  // localStorage) because each stage only ever shows once in an account's
  // life: "password" clears the moment the temp password is replaced, and
  // "personal" clears the moment PersonalInfoScreen saves.
  const passwordTourFired = useRef(false);
  useEffect(() => {
    if (setupStage !== "password" || passwordTourFired.current) return;
    passwordTourFired.current = true;
    const t = setTimeout(() => runTour(STUDENT_CHANGE_PASSWORD_STEPS), AUTO_TOUR_DELAY_MS);
    return () => clearTimeout(t);
  }, [setupStage]);

  const editInfoTourFired = useRef(false);
  useEffect(() => {
    if (setupStage !== "personal" || editInfoTourFired.current) return;
    editInfoTourFired.current = true;
    const t = setTimeout(() => runTour(STUDENT_EDIT_INFO_STEPS), AUTO_TOUR_DELAY_MS);
    return () => clearTimeout(t);
  }, [setupStage]);

  // Child screens get the freshly saved personal email even before the parent
  // reloads the profile (e.g. to pre-fill the application form).
  const effectiveUser = useMemo(() => (
    user && setupProfile.personalEmail ? { ...user, personalEmail: setupProfile.personalEmail } : user
  ), [user, setupProfile.personalEmail]);

  const handleSetupLogout = () => {
    if (setupLogoutBusy) return;
    setSetupLogoutBusy(true);
    setCachedStudentUid(null);
    onLogout?.();
    logOut().catch((err) => console.error("Logout failed:", err));
  };

  // Records that the temporary password is gone. passwordChangedAt lets
  // computeSetupStage demand a fresh login if the page is reloaded afterwards.
  // The new password itself is never written anywhere — only Firebase Auth has it.
  const finishPasswordStep = async () => {
    if (!getAuth().currentUser) {
      // AuthService already ended the session; nothing more to write from here.
      setSetupStage("relogin");
      return;
    }
    try {
      await setDoc(
        doc(db, "students", user.uid),
        { passwordChanged: true, passwordChangedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Password changed, but saving setup progress failed:", err);
      setPassFlagPending(true);
      setPassError(
        "Your password was changed, but we couldn't save your setup progress. Select Retry. " +
        "If this keeps failing, log out and log in with your NEW password — you'll be asked to confirm it once more."
      );
      return;
    }
    setPassFlagPending(false);
    setCurrentPass(""); setNewPass(""); setConfirmPass(""); setPassError("");
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    setSetupStage("relogin");
  };

  const handleChangePassword = async () => {
    if (passLoading) return;
    setPassError("");

    // Password already changed in Auth; only the Firestore flag needs retrying.
    if (passFlagPending) {
      setPassLoading(true);
      try { await finishPasswordStep(); } finally { setPassLoading(false); }
      return;
    }

    if (!currentPass) {
      setPassError("Enter the temporary password you used to log in.");
      return;
    }
    if (!newPass) {
      setPassError("Enter a new password.");
      return;
    }
    if (!isPasswordStrong(newPass)) {
      setPassError("Password does not meet all the requirements below.");
      return;
    }
    if (newPass === currentPass) {
      setPassError("Your new password must be different from your temporary password.");
      return;
    }
    if (newPass !== confirmPass) {
      setPassError("Passwords do not match.");
      return;
    }

    const authUser = getAuth().currentUser;
    if (!authUser) {
      setPassError("Your session has expired. Refresh the page and log in again.");
      return;
    }

    setPassLoading(true);
    try {
      try {
        await changePassword(currentPass, newPass, "students", user.uid, authUser.email);
      } catch (err) {
        const actuallyChanged = !isAuthError(err) && await passwordNowMatches(newPass);
        if (!actuallyChanged) {
          setPassError(friendlyPasswordError(err));
          return;
        }
      }
      await finishPasswordStep();
    } finally {
      setPassLoading(false);
    }
  };

  // Step 2 — Personal information. PersonalInfoScreen (setupMode) validates the
  // whole form and saves personalEmail through the studentPersonalEmails index.
  const handlePersonalInfoComplete = (savedEmail) => {
    setSetupProfile(prev => ({ ...prev, personalEmail: savedEmail }));
    setSetupStage("done");
  };

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

  // Which part of the current screen is showing (list, a post, a modal…),
  // reported by each screen's onViewChange. tourKey picks that part's own
  // steps when it has some, otherwise the nav screen's.
  // No reset-on-nav effect here on purpose: each screen resets this itself
  // when it unmounts, and a parent effect would run AFTER the new screen's
  // own report (child effects fire first) and wipe out e.g. a deep-linked post.
  const [screenSubView, setScreenSubView] = useState("list");
  const tourKey = STUDENT_SUBVIEW_TOUR_KEYS[activeNav]?.[screenSubView] || activeNav;

  const AUTO_TOUR_NAV_KEYS = Object.keys(HELP_STEPS_BY_STUDENT_NAV);
  const tourFiringRef = useRef({});
  useEffect(() => {
    if (setupStage !== "done" || !seenToursLoaded || !seenTours) return;
    if (!AUTO_TOUR_NAV_KEYS.includes(tourKey)) return;
    if (seenTours[tourKey] || tourFiringRef.current[tourKey]) return;
    const steps = HELP_STEPS_BY_STUDENT_NAV[tourKey];
    if (!steps || steps.length === 0) return;

    tourFiringRef.current[tourKey] = true;
    const t = setTimeout(() => {
      runTour(steps);
      if (user?.uid) {
        setDoc(doc(db, "students", user.uid), { seenTours: { [tourKey]: true } }, { merge: true })
          .catch((err) => console.error("Failed to save seen tour state:", err));
      }
      setSeenTours(prev => ({ ...(prev || {}), [tourKey]: true }));
    }, AUTO_TOUR_DELAY_MS);
    return () => clearTimeout(t);
  }, [tourKey, setupStage, seenToursLoaded, seenTours, user?.uid]);

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
          viewIcon={themedViewIcon}
          companyProfileIcon={themedCompanyIcon}
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
        onViewChange={setScreenSubView}
        initialCompanyId={initialCompanyId}
        onClearInitialCompany={() => setInitialCompanyId(null)}
        user={effectiveUser}
        onMessageNow={(company) => {
          setPendingContact({ id: company.companyId || company.id, name: company.companyName || company.name, fromMessageNow: true });
          navigate("messages");
        }}
        onApplyNow={() => {
          // No-op / no navigation here — the Apply modal should pop up right
          // on FindCompany (StudentFindCompanyScreen already opens it locally
          // via its own showApplyModal state). We only navigate to the
          // Applications screen after a successful submit, via
          // onNavigateToApplications below — so there's nothing to track here.
        }}
        onNavigateToApplications={() => {
          setApplyCompany(null);
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
        onViewChange={setScreenSubView}
        initialCompany={applyCompany}
        onModalClose={() => setApplyCompany(null)}
        user={effectiveUser}
        openApplicationId={pendingApplicationId}
        onApplicationOpened={() => setPendingApplicationId(null)}
        companyProfileIcon={themedCompanyIcon}
      />
    );

    if (activeNav === "messages") return (
      <StudentMessagesScreen
        onViewChange={setScreenSubView}
        user={effectiveUser}
        openContact={pendingContact} onContactOpened={() => setPendingContact(null)}
        onReportSubmit={handleReportSubmit}
        userIcon={themedUserIcon}
      />
    );

    if (activeNav === "accountprofile") return <StudentAccountProfileScreen user={effectiveUser} onLogout={onLogout} viewIcon={themedViewIcon} onViewChange={setScreenSubView} />;
    if (activeNav === "about")          return <AboutUsScreen onBack={() => navigate("dashboard")} />;
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
                <div id="stopbar-notifications" className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px", position: "relative" }} onClick={handleToggleNotifDropdown}>
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

              <div id="stopbar-about" className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px" }} onClick={() => navigate("about")} title="About">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8h.01"/>
                <path d="M11 12h1v4h1"/>
              </svg>
            </div>

            {/* Theme color picker */}
            <div style={{ position: "relative" }}>
                <div id="stopbar-theme-picker" className="topbar-icon-btn" style={{ cursor: "pointer", padding: "8px" }} onClick={() => setShowThemeDropdown(p => !p)} title="Dashboard theme color">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 0 20c1.1 0 1.8-.85 1.8-1.85 0-.5-.2-.95-.5-1.28-.32-.33-.5-.75-.5-1.27a1.9 1.9 0 0 1 1.9-1.9h2.24C19.6 15.7 22 13.35 22 10.4 22 5.76 17.5 2 12 2z"/>
                  <circle cx="7.5" cy="10.5" r="1" fill="white" stroke="none"/>
                  <circle cx="11" cy="7" r="1" fill="white" stroke="none"/>
                  <circle cx="15.5" cy="8" r="1" fill="white" stroke="none"/>
                </svg>
              </div>
              {showThemeDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setShowThemeDropdown(false)} />
                  <div style={{
                      position: "absolute", top: "50px", right: 0, width: "224px",
                      background: paper, border: `1px solid ${hairline}`,
                      borderRadius: "16px", boxShadow: "0 12px 32px rgba(0,0,0,0.28)", zIndex: 999,
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

          {/* Main content — laging tumatawag ng renderContent() kahit naka-
              gate pa, kagaya ng Coordinator, para makita ang totoong
              dashboard (banner, cards) sa likod ng setup modal, hindi lang
              yung chrome. Ligtas ito dahil naka-overlay pa rin ang modal sa
              ibabaw (dark backdrop), kaya hindi naman ma-i-interact ang
              laman sa likod hangga't hindi "done" ang setup. */}
          <div className="smain-content">{(user || activeNav === "dashboard") ? renderContent() : null}</div>
        </div>

      {/* ── First-login setup gate: naka-overlay sa ibabaw ng buong shell,
          kagaya ng ginagawa ng Coordinator — hindi na ito hiwalay na
          "return", kaya laging makikita ang tunay na dashboard (topbar
          gradient, sidebar, theme) sa likod ng modal, hindi na plain
          background lang. ── */}
      {setupStage !== "done" && setupStage !== "checking" && (
        <>
        {setupStage === "error" && (
          <SetupModal title="Couldn't Load Your Account" titleId="setup-error-title">
            <SetupIntro>
              We couldn't check your account setup. Check your internet connection, then try again.
            </SetupIntro>
            <SetupActions
              label="Try Again"
              loadingLabel="Checking…"
              loading={false}
              onClick={() => user?.uid && loadSetupStatus(user.uid)}
              onLogout={handleSetupLogout}
              logoutBusy={setupLogoutBusy}
            />
          </SetupModal>
        )}

        {/* ── Step 1: Set New Password ── */}
        {setupStage === "password" && (
          <SetupModal title="Set New Password" titleId="setup-password-title">
            <SetupIntro>
              Welcome! Before you continue, replace the current password you were given with a new one that only you know.
            </SetupIntro>

            <SetupPasswordInput
              id="sp-current-password"
              placeholder="Current Password:"
              autoComplete="current-password"
              value={currentPass}
              onChange={v => { setCurrentPass(v); setPassError(""); }}
              visible={showCurrent}
              onToggle={() => setShowCurrent(p => !p)}
              hasError={!!passError && !passFlagPending}
              disabled={passLoading || passFlagPending}
              onEnter={handleChangePassword}
            />
            <SetupPasswordInput
              id="sp-new-password"
              placeholder="Enter New Password:"
              autoComplete="new-password"
              value={newPass}
              onChange={v => { setNewPass(v); setPassError(""); }}
              visible={showNew}
              onToggle={() => setShowNew(p => !p)}
              hasError={!!passError && !passFlagPending}
              disabled={passLoading || passFlagPending}
              onEnter={handleChangePassword}
            />

            <div id="sp-checklist">
              {!passFlagPending && <PasswordChecklist password={newPass} />}
            </div>

            <SetupPasswordInput
              id="sp-confirm-password"
              placeholder="Confirm New Password:"
              autoComplete="new-password"
              value={confirmPass}
              onChange={v => { setConfirmPass(v); setPassError(""); }}
              visible={showConfirm}
              onToggle={() => setShowConfirm(p => !p)}
              hasError={!!passError && !passFlagPending}
              disabled={passLoading || passFlagPending}
              onEnter={handleChangePassword}
              marginBottom="4px"
            />

            <SetupError msg={passError} />

            <SetupActions
              buttonId="sp-save-btn"
              label={passFlagPending ? "Retry" : "Save Password"}
              loadingLabel="Saving…"
              loading={passLoading}
              onClick={handleChangePassword}
              onLogout={handleSetupLogout}
              logoutBusy={setupLogoutBusy}
            />
          </SetupModal>
        )}

        {/* ── Password updated → must log in again ── */}
        {setupStage === "relogin" && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}>
            <div role="dialog" aria-modal="true" aria-labelledby="setup-relogin-title" style={{
              background: paper, borderRadius: "20px",
              padding: "36px clamp(20px, 6vw, 32px)", width: "clamp(280px, 85vw, 380px)",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}>
              <div style={{
                width: "64px", height: "64px", borderRadius: "50%",
                background: "#e8f5e9", display: "flex",
                alignItems: "center", justifyContent: "center", marginBottom: "4px",
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                  stroke="#2d7a2d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p id="setup-relogin-title" style={{
                fontFamily: uiFont, fontWeight: 700,
                fontSize: "1.15rem", color: inkText, margin: 0, textAlign: "center",
              }}>Password Updated</p>
              <p style={{
                fontFamily: uiFont, fontSize: "0.9rem",
                color: inkMuted, margin: 0, textAlign: "center", lineHeight: 1.5,
              }}>
                Password updated successfully.<br />
                Please log in again using your Student ID and new password.
              </p>
              <button onClick={handleSetupLogout} disabled={setupLogoutBusy} className="pill-btn" style={{
                width: "100%", padding: "12px", borderRadius: "30px",
                border: "none", background: ink,
                fontFamily: uiFont, fontWeight: 700,
                fontSize: "0.95rem", cursor: setupLogoutBusy ? "not-allowed" : "pointer", color: paper,
                boxShadow: "0 3px 10px rgba(0,0,0,0.5)", marginTop: "8px",
                opacity: setupLogoutBusy ? 0.7 : 1,
              }}>{setupLogoutBusy ? "Logging out…" : "Log In Again"}</button>
            </div>
          </div>
        )}

        {/* ── Step 2: Personal Information (full edit form, like the coordinator's first login) ── */}
        {setupStage === "personal" && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "clamp(0px, 3vw, 24px)",
          }}>
            <div id="seditinfo-card" role="dialog" aria-modal="true" aria-label="Edit personal information" style={{
              width: "100%", maxWidth: "760px",
              height: "100%", maxHeight: "900px",
              display: "flex", flexDirection: "column",
              borderRadius: "clamp(0px, 3vw, 20px)", overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}>
              <ProfileResponsiveStyles />
              <PersonalInfoScreen
                user={effectiveUser}
                setupMode
                onSetupComplete={handlePersonalInfoComplete}
                onLogout={handleSetupLogout}
                logoutBusy={setupLogoutBusy}
              />
            </div>
          </div>
        )}
        </>
      )}
      <FloatingHelpButton
        activeNav={tourKey}
        onBeforeTour={() => { setShowNotifDropdown(false); setShowThemeDropdown(false); }}
      />
    </div>
  );
};

export default StudentDashboardScreen;