// AdminScreen.jsx
// Separate ADMIN account for OJTern: its own sign-in at /admin and its own
// collection (admins/{uid}). An admin is not a coordinator, student or company.
//
// Sign-in is EMAIL + password (a normal Firebase Auth account). That same email is where
// "Forgot password" sends its reset link (adminRequestPasswordReset in functions/adminFunctions.js),
// and it is changed from Account Profile with Firebase's verify-before-update email flow.
//
// Modules (same set as the other dashboards, except Messages, which needs the chat layer):
//   Notifications   bell in the top bar (e.g. "<coordinator> accepted your invitation")
//   Account Profile name, sign-in email, change password, and Add / Transfer an administrator account
//                   (server side: functions/adminFunctions.js)
//   About           the shared About Us page, via the (i) icon in the top bar
//
// What the admin can do:
//   Departments  – add a department (with its first program), add programs and
//                  majors. Live data in the Firestore "departments" collection,
//                  the same one every other screen reads via useDepartmentsPrograms().
//   Coordinators – invite a coordinator to ANY department (the existing invite
//                  email + accept flow is reused, so no password is ever shared),
//                  change a coordinator's department/program, cancel pending invites.
//
// On purpose there is NO rename or delete for departments/programs/majors, and
// the abbreviation is fixed once created: student, company and coordinator docs
// store these names as plain text, so changing one would orphan their records.

import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from "firebase/auth";
import {
  collection, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";
import DashboardSwitcher from "./DashboardSwitcher";
import { DEFAULT_DEPARTMENTS, normalizeDept, splitLegacyProgram } from "./departmentsPrograms";
import { color, font, type, space, radius, ease } from "./theme";
import { TERMS_TEXT, PRIVACY_TEXT, parseLegalDoc } from "./legalContent";
import logo from "../icons/admin_ojtern_logo.png";               // sign-in screen (and anything else that shares it)
import topbarLogo from "../icons/admin_topbar_logo.png";         // top-left logo beside the OJTern text: top bar + mobile menu
import AboutUsScreen from "./AboutUsScreen";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── Design tokens: the same ones the Student / Coordinator / Company dashboards use (theme.js) ──
const ink       = color.blush50;    // #000000  top bar, active nav, primary buttons
const inkDeep   = color.blush100;   // #161616  gradient partner for ink
const paper     = color.white;
const paperTint = color.wine900;    // #FAFAFA  page background
const paperCard = color.wine800;    // #F2F2F2  hover states
const hairline  = color.wine700;    // #EAEAEA  borders
const inkText   = color.ink;        // #141414  body text
const inkMuted  = color.inkMuted;   // #767676
const uiFont    = font.ui;
const logoFont  = font.logo;        // reserved for the "OJTern" wordmark

const C = {
  ink: inkText, muted: inkMuted, line: hairline, soft: paperTint, white: paper,
  danger: color.danger, ok: color.success,
  okBg: "rgba(90,117,96,0.14)", errBg: "rgba(168,84,80,0.14)",
};
const FONT = uiFont;
const S = {
  card:   { background: paper, border: `1px solid ${hairline}`, borderRadius: "16px", padding: "18px", marginBottom: "16px", boxShadow: "0 2px 10px rgba(20,20,20,0.04)" },
  h2:     { fontFamily: FONT, fontSize: "1.02rem", fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 4px", color: inkText },
  help:   { fontFamily: FONT, fontSize: "0.82rem", color: inkMuted, margin: "0 0 12px", lineHeight: 1.55 },
  label:  { display: "block", fontFamily: FONT, fontSize: "0.8rem", fontWeight: 600, margin: "10px 0 4px", color: inkText },
  input:  { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1.5px solid ${hairline}`, borderRadius: "12px", fontFamily: FONT, fontSize: "0.9rem", background: paper, color: inkText, outline: "none" },
  btn:    { padding: "10px 20px", borderRadius: "30px", border: "none", background: ink, color: paper, fontFamily: FONT, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 3px 10px rgba(0,0,0,0.25)" },
  btn2:   { padding: "8px 14px", borderRadius: "30px", border: `1.5px solid ${hairline}`, background: paper, color: inkText, fontFamily: FONT, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" },
  chip:   { display: "inline-block", padding: "3px 10px", borderRadius: "999px", background: paperTint, border: `1px solid ${hairline}`, fontFamily: FONT, fontSize: "0.75rem", margin: "0 6px 6px 0", color: inkText },
  err:    { background: C.errBg, color: C.danger, borderRadius: "12px", padding: "10px 13px", fontFamily: FONT, fontSize: "0.82rem", margin: "10px 0" },
  okMsg:  { background: C.okBg, color: C.ok, borderRadius: "12px", padding: "10px 13px", fontFamily: FONT, fontSize: "0.82rem", margin: "0 0 14px" },
};
const Req = () => <span aria-hidden="true" style={{ color: C.danger, marginLeft: "3px" }}>*</span>;

// ── helpers ──
const timeAgo = (ts) => {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
};
// Same password rules as the coordinator / student screens.
const PASSWORD_RULES = [
  { key: "length",    label: "At least 8 characters",                      test: (p) => p.length >= 8 },
  { key: "uppercase", label: "At least one uppercase letter (A–Z)",        test: (p) => /[A-Z]/.test(p) },
  { key: "lowercase", label: "At least one lowercase letter (a–z)",        test: (p) => /[a-z]/.test(p) },
  { key: "number",    label: "At least one number (0–9)",                  test: (p) => /[0-9]/.test(p) },
  { key: "special",   label: "At least one special character (!@#$%&*_)",  test: (p) => /[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(p) },
  { key: "noSpaces",  label: "No spaces",                                  test: (p) => !/\s/.test(p) },
];
const isPasswordStrong = (p) => PASSWORD_RULES.every((r) => r.test(p));
const norm = (s) => String(s ?? "").trim();
const same = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();
// Reads a department's programs the same way every other screen does (useDepartmentsPrograms):
// a stored "BS Education — Major in English" is shown as the program Bachelor of Secondary
// Education with the major English, never as a program of its own. When an admin adds a program
// or a major, the cleaned list is what gets written back, so the data fixes itself as it is used.
const programsOf = (d) => normalizeDept({ programs: d?.programs }).programs;
// A coordinator's saved selection may still hold an old combined program name; read it as program + major.
const normSel = (s) => {
  if (!s?.program) return s;
  const sp = splitLegacyProgram(s.program);
  return { ...s, program: sp.program, specialization: s.specialization || sp.specialization };
};
const slug = (s) => norm(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const describeSel = (raw) => {
  const s = normSel(raw);
  return `${s.department}${s.program ? ` › ${s.program}` : ""}${s.specialization ? ` › ${s.specialization}` : ""}`;
};
const authMessage = (e) => {
  const code = e?.code || "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(code)) return "Incorrect email or password.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
  if (code === "auth/network-request-failed") return "Network error. Check your connection and try again.";
  return e?.message || "Could not sign in.";
};

// ═══════════════════════════ Shared shell pieces ═══════════════════════════
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

const AdminStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Monomaniac+One&display=swap');
    .adm-nav-item {
      position: relative; margin: 4px 10px; padding-left: 4px; border-radius: 12px;
      transition: background 0.18s ease, transform 0.12s ease;
    }
    .adm-nav-item::before {
      content: ""; position: absolute; left: -10px; top: 50%; width: 3px; height: 0;
      background: ${ink}; border-radius: 0 3px 3px 0; transform: translateY(-50%);
      transition: height 0.2s ease;
    }
    .adm-nav-item:hover  { background: ${paperCard}; }
    .adm-nav-item.active { background: ${inkDeep}; }
    .adm-nav-item.active::before { height: 24px; }
    .adm-nav-item:active { transform: scale(0.98); }
    .adm-nav-logout { margin: 4px 10px 14px; padding-left: 4px; border-radius: 12px; transition: background 0.18s ease, transform 0.12s ease; }
    .adm-nav-logout:hover  { background: ${paperCard}; }
    .adm-nav-logout:active { transform: scale(0.98); }

    .adm-drawer {
      position: fixed; top: 0; left: 0; height: 100%; width: 260px; z-index: 200;
      transform: translateX(-100%); transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      background: ${paper}; border-right: 1px solid ${hairline};
      overflow-y: auto; display: flex; flex-direction: column;
    }
    .adm-drawer.open { transform: translateX(0); }
    .adm-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 199; }
    .adm-overlay.open { display: block; }
    @media (min-width: 1024px) {
      .adm-static {
        width: 260px; flex-shrink: 0; background: ${paper};
        display: flex; flex-direction: column; overflow-y: auto; border-right: 1px solid ${hairline};
      }
    }
    .adm-hamburger {
      background: none; border: none; cursor: pointer; padding: 6px;
      display: flex; flex-direction: column; gap: 5px; -webkit-tap-highlight-color: transparent;
    }
    .adm-hamburger span { display: block; width: 24px; height: 2px; background: ${paper}; border-radius: 2px; }
    .adm-main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: ${paperTint}; min-width: 0; min-height: 0; }
    .adm-input:focus, .adm-main select:focus, .adm-main input:focus { border-color: ${ink} !important; }
    .adm-main select, .adm-main input { transition: border-color 160ms ease; }

    /* Departments tab: same shapes as Student Accounts (bar, rows, pop-up) */
    .dp-bar {
      background: linear-gradient(90deg, ${ink} 0%, ${inkDeep} 100%); border-radius: 20px; padding: 18px 22px; margin-bottom: 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
    }
    .dp-search { display: flex; align-items: center; gap: 8px; background: ${paper}; border-radius: 999px; padding: 9px 16px; flex-shrink: 0; }
    .dp-search input { border: none !important; background: transparent; outline: none; box-shadow: none; width: 200px; color: ${inkText}; font-family: ${uiFont}; font-size: 0.85rem; padding: 0; }
    .dp-search input:focus { border: none !important; }
    @media (max-width: 560px) { .dp-bar { padding: 14px; gap: 10px; } .dp-search input { width: 110px; } }
    .dp-row {
      display: flex; align-items: center; gap: 14px; background: ${paper}; border: 1px solid ${hairline}; border-radius: 16px;
      padding: 14px 20px; cursor: pointer; min-width: 0; box-shadow: 0 2px 10px rgba(20,20,20,0.04);
      transition: border-color 200ms ease, box-shadow 200ms ease;
    }
    .dp-row:hover { border-color: #BDBDBD; box-shadow: 0 6px 20px rgba(10,10,10,0.08); }
    @media (max-width: 560px) { .dp-row { padding: 12px 14px; gap: 10px; } .dp-row-view { display: none; } }
    .dp-modal { background: ${paper}; border: 1px solid ${hairline}; border-radius: 24px; width: 660px; max-width: calc(100vw - 32px); height: min(460px, 80vh); overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.18); }
    .dp-modal-header { flex: 0 0 auto; padding: 22px 28px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid ${hairline}; }
    .dp-modal-body { overflow-y: auto; overflow-x: hidden; padding: 6px 28px 22px; flex: 1 1 auto; min-height: 0; }
    .dp-modal-footer { flex: 0 0 auto; background: ${paperCard}; border-top: 1px solid ${hairline}; padding: 14px 28px; display: flex; justify-content: flex-end; gap: 8px; }
    @media (max-width: 560px) { .dp-modal-header { padding: 16px; } .dp-modal-body { padding: 4px 16px 18px; } .dp-modal-footer { padding: 12px 16px; } }

    /* Button hover: Manage (light) and the primary Add a department / Invite a coordinator (dark) */
    .adm-btn-light, .adm-btn-dark { transition: background 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 120ms ease; }
    .adm-btn-light:hover { background: ${ink} !important; color: ${paper} !important; border-color: ${ink} !important; box-shadow: 0 4px 12px rgba(0,0,0,0.22); }
    .adm-btn-dark:hover  { background: ${paper} !important; color: ${ink} !important; box-shadow: 0 0 0 1.5px ${ink}, 0 6px 16px rgba(0,0,0,0.18) !important; }
    .adm-btn-light:active, .adm-btn-dark:active { transform: scale(0.97); }
    .adm-btn-light:disabled:hover, .adm-btn-dark:disabled:hover { transform: none; }

    /* Account Profile: same look as the coordinator's (full-width banner, overlapping header card, pill menu rows) */
    .ap-screen { width: 100%; }
    .ap-fixed { display: flex; flex-direction: column; overflow: hidden; }
    .ap-fixed .ap-header-wrap, .ap-fixed .ap-divider, .ap-fixed .ap-sub-header { flex-shrink: 0; }
    .ap-fixed .ap-body, .ap-fixed .ap-sub-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
    .ap-header-wrap { position: relative; display: flex; justify-content: center; }
    .ap-banner { position: absolute; top: 0; left: 0; right: 0; height: 98px; background: ${inkDeep}; border-radius: 0 0 40px 40px; }
    .ap-header-card { position: relative; z-index: 2; margin-top: 66px; background: ${paper}; border: 1px solid ${hairline}; border-radius: 20px; padding: 56px 44px 20px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 3px 10px rgba(20,20,20,0.12); min-width: 260px; }
    .ap-avatar { position: absolute; top: -47px; width: 94px; height: 94px; border-radius: 50%; background: ${ink}; border: 3px solid ${paper}; display: flex; align-items: center; justify-content: center; z-index: 3; box-shadow: 0 3px 10px rgba(20,20,20,0.18); }
    .ap-divider { height: 1px; background: ${hairline}; margin: 22px clamp(16px, 4vw, 32px) 22px; }
    .ap-body { padding: 0 clamp(16px, 4vw, 32px) 40px; }
    .ap-group { margin-bottom: 22px; }
    .ap-group-title { font-family: ${uiFont}; font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; color: ${inkText}; margin: 0 0 10px 8px; }
    .ap-menu-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: 100%; text-align: left; font: inherit; cursor: pointer; background: ${paper}; border: 1px solid ${hairline}; border-radius: 999px; padding: 15px 22px; margin-bottom: 12px; box-shadow: 0 2px 10px rgba(20,20,20,0.04); transition: border-color 220ms ease, box-shadow 220ms ease; }
    .ap-menu-row:last-child { margin-bottom: 0; }
    .ap-menu-row:hover { border-color: #BDBDBD; box-shadow: 0 8px 22px rgba(10,10,10,0.08); }
    .ap-row-icon { width: 34px; height: 34px; border-radius: 10px; background: ${paperCard}; border: 1px solid ${hairline}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${inkText}; }
    .ap-go { flex-shrink: 0; transition: transform 0.18s ease; }
    .ap-go:hover { transform: scale(1.15); }
    .ap-sub-header { display: flex; align-items: center; gap: 16px; background: ${inkDeep}; padding: 20px clamp(16px, 4vw, 32px); }
    .ap-back { width: 40px; height: 40px; border-radius: 50%; background: #1f1f1f; border: 1px solid rgba(255,255,255,0.28); padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s ease, transform 0.15s ease; }
    .ap-back:hover { background: #2c2c2c; transform: scale(1.06); }
    .ap-sub-body { padding: clamp(16px, 4vw, 28px) clamp(14px, 4vw, 32px) 40px; }
    .ap-edit-btn { display: inline-flex; align-items: center; gap: 8px; background: ${paper}; border: 1px solid ${hairline}; border-radius: 999px; padding: 11px 22px; font-family: ${uiFont}; font-size: 1rem; font-weight: 500; color: ${inkText}; cursor: pointer; box-shadow: 0 2px 10px rgba(20,20,20,0.04); transition: border-color 200ms ease, box-shadow 200ms ease, background 200ms ease; }
    .ap-edit-btn:hover { border-color: #BDBDBD; background: ${paperCard}; box-shadow: 0 6px 16px rgba(10,10,10,0.08); }
    .ap-info-card { background: ${paper}; border: 1px solid ${hairline}; border-radius: 22px; padding: 16px 24px; margin-bottom: 14px; box-shadow: 0 2px 10px rgba(20,20,20,0.04); }
    .ap-info-label { font-family: ${uiFont}; font-size: 0.85rem; color: ${inkMuted}; margin: 0 0 6px; }
    .ap-info-value { font-family: ${uiFont}; font-size: 1.05rem; color: ${inkText}; margin: 0; overflow-wrap: anywhere; }
    /* Account Profile pop-ups: white rounded panel, pill inputs, black footer. Fixed size, the body scrolls. */
    .ap-overlay { position: fixed; inset: 0; background: rgba(10,10,10,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
    .ap-modal { background: ${paper}; border-radius: 24px; width: 420px; max-width: 88vw; height: min(max(62vh, 400px), 92vh); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.28); }
    .ap-modal-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 22px 24px 16px; }
    /* Thin, rounded scrollbar in every pop-up form (Account Profile pop-ups and the Departments / Coordinators ones) */
    .ap-modal-body::-webkit-scrollbar, .dp-modal-body::-webkit-scrollbar { width: 6px; }
    .ap-modal-body::-webkit-scrollbar-track, .dp-modal-body::-webkit-scrollbar-track { background: transparent; margin: 6px 0; }
    .ap-modal-body::-webkit-scrollbar-thumb, .dp-modal-body::-webkit-scrollbar-thumb { background: #C6C6C6; border-radius: 999px; }
    .ap-modal-body::-webkit-scrollbar-thumb:hover, .dp-modal-body::-webkit-scrollbar-thumb:hover { background: #A9A9A9; }
    @supports not selector(::-webkit-scrollbar) { .ap-modal-body, .dp-modal-body { scrollbar-width: thin; scrollbar-color: #C6C6C6 transparent; } }
    .ap-modal-footer { flex: 0 0 auto; background: ${inkDeep}; padding: 12px 24px; display: flex; justify-content: flex-end; gap: 10px; }
    .ap-modal-title { font-family: ${uiFont}; font-size: 1.125rem; font-weight: 600; letter-spacing: -0.01em; color: ${inkText}; margin: 0; }
    .ap-modal-sub { font-family: ${uiFont}; font-size: 0.85rem; color: ${inkMuted}; margin: 4px 0 0; line-height: 1.5; }
    .ap-label { display: block; font-family: ${uiFont}; font-size: 0.9rem; font-weight: 500; color: ${inkText}; margin: 14px 0 6px; }
    .ap-field { position: relative; }
    .ap-input { width: 100%; box-sizing: border-box; height: 46px; border-radius: 999px; border: 1.5px solid transparent; background: ${paperCard}; padding: 0 18px; font-family: ${uiFont}; font-size: 0.9rem; color: ${inkText}; outline: none; transition: border-color 160ms ease, background 160ms ease; }
    .ap-input:focus { border-color: ${ink} !important; background: ${paper}; }
    .ap-field .ap-input { padding-right: 46px; }
    .ap-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 6px; cursor: pointer; display: flex; color: ${inkMuted}; }
    .ap-eye:hover { color: ${inkText}; }
    .ap-hr { border: none; border-top: 1px solid ${hairline}; margin: 16px 0 0; }
    .ap-fbtn { font-family: ${uiFont}; font-size: 0.9rem; font-weight: 500; border-radius: 999px; padding: 9px 22px; cursor: pointer; transition: background 160ms ease, color 160ms ease, border-color 160ms ease; }
    .ap-fbtn.ghost { background: transparent; color: rgba(255,255,255,0.88); border: 1px solid rgba(255,255,255,0.3); }
    .ap-fbtn.ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.5); }
    .ap-fbtn.solid { background: ${paper}; color: ${ink}; border: 1px solid ${paper}; }
    .ap-fbtn.solid:hover { background: #E6E6E6; border-color: #E6E6E6; }
    .ap-fbtn:disabled { opacity: 0.55; cursor: not-allowed; }
    @media (max-width: 480px) { .ap-modal { max-width: 90vw; height: min(70vh, 520px); } .ap-modal-body { padding: 18px 18px 12px; } .ap-modal-footer { padding: 10px 18px; } }
    .ap-name-input { width: 100%; box-sizing: border-box; border-radius: 999px; border: 2px solid #C8C8C8; background: ${paper}; padding: 9px 18px; font-family: ${uiFont}; font-size: 1.05rem; color: ${inkText}; outline: none; transition: border-color 160ms ease; }
    .ap-name-input:focus { border-color: ${ink}; }
    @media (max-width: 480px) { .ap-header-card { padding: 56px 22px 16px; min-width: unset; width: 90%; } .ap-menu-row { padding: 12px 16px; } }

    /* Manage Coordinators: table in the Report Company style, cards on narrow screens */
    .mc-wrap { width: 100%; overflow-x: auto; border: 1px solid ${hairline}; border-radius: 18px; background: ${paper}; }
    .mc-table { width: 100%; min-width: 680px; border-collapse: separate; border-spacing: 0; font-size: 0.9rem; background: ${paper}; }
    .mc-th { padding: 13px 14px; text-align: left; color: #000; background: #F4F4F4; border-bottom: 1px solid ${hairline}; font-family: ${uiFont}; font-size: 1rem; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; }
    .mc-td { padding: 15px 14px; color: ${inkText}; background: ${paper}; font-family: ${uiFont}; font-weight: 500; border-bottom: 1px solid ${hairline}; vertical-align: middle; }
    .mc-table tbody tr:last-child .mc-td { border-bottom: none; }
    .mc-table tbody tr:hover .mc-td { background: #FAFAFA; }
    .mc-cards { display: none; flex-direction: column; gap: 10px; }
    .mc-card { background: ${paper}; border: 1px solid ${hairline}; border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
    .mc-card-label { font-family: ${uiFont}; font-size: 0.66rem; color: ${inkMuted}; margin: 0 0 3px 0; }
    @media (max-width: 780px) { .mc-wrap { display: none; } .mc-cards { display: flex; } }

    /* Floating "?" help button: same as the Student dashboard's. Idle pulse ring to catch the eye,
       lifts on hover/press, ring fades in while the 1s hover-to-drag countdown runs. */
    @keyframes adm-help-btn-pulse {
      0%   { box-shadow: 0 6px 20px color-mix(in srgb, ${ink} 25%, transparent), 0 0 0 0 color-mix(in srgb, ${ink} 16%, transparent); }
      70%  { box-shadow: 0 6px 20px color-mix(in srgb, ${ink} 25%, transparent), 0 0 0 10px color-mix(in srgb, ${ink} 0%, transparent); }
      100% { box-shadow: 0 6px 20px color-mix(in srgb, ${ink} 25%, transparent), 0 0 0 0 color-mix(in srgb, ${ink} 0%, transparent); }
    }
    .adm-help-fab {
      animation: adm-help-btn-pulse 2.6s ease-out infinite;
      transition: transform 0.18s ${ease}, background 0.18s ${ease}, opacity 0.45s ${ease};
    }
    /* After a drag is released it glides to the nearest side instead of jumping there. */
    .adm-help-fab.adm-help-fab-snapping {
      transition: left 0.32s cubic-bezier(0.22, 1, 0.36, 1), top 0.32s cubic-bezier(0.22, 1, 0.36, 1),
                  transform 0.18s ${ease}, background 0.18s ${ease}, opacity 0.45s ${ease};
    }
    /* Idle (untouched for 10s): faded, and the pulse ring stops. Back to full on hover/press/focus. */
    .adm-help-fab.adm-help-fab-idle { opacity: 0.4; animation: none; }
    .adm-help-fab:hover {
      transform: translateY(-3px) scale(1.06);
      background: ${ink} !important;
      animation-play-state: paused;
    }
    .adm-help-fab:hover .adm-help-fab-icon { stroke: ${paper} !important; }
    .adm-help-fab:hover .adm-help-fab-icon-dot { fill: ${paper} !important; }
    .adm-help-fab:active { transform: translateY(-1px) scale(0.98); }
    /* Being dragged: lift it, drop the pulse/hover effects, grabbing cursor. */
    .adm-help-fab.adm-help-fab-dragging,
    .adm-help-fab.adm-help-fab-dragging:hover {
      animation: none !important;
      transform: scale(1.1) !important;
      box-shadow: 0 10px 28px rgba(0,0,0,0.28) !important;
      cursor: grabbing !important;
      background: ${paper} !important;
    }
    .adm-help-fab.adm-help-fab-dragging .adm-help-fab-icon { stroke: ${ink} !important; }
    .adm-help-fab.adm-help-fab-dragging .adm-help-fab-icon-dot { fill: ${ink} !important; }
    /* Mouse hovering, counting down to "follow the cursor": a ring fades in around the button over that 1 second. */
    .adm-help-fab.adm-help-fab-arming::after {
      content: ""; position: absolute; inset: -6px; border-radius: 50%;
      border: 2px solid ${ink}; opacity: 0; pointer-events: none;
      animation: adm-help-fab-arm 1s linear forwards;
    }
    @keyframes adm-help-fab-arm {
      0%   { opacity: 0;    transform: scale(0.8); }
      100% { opacity: 0.55; transform: scale(1); }
    }
    .adm-help-fab:focus-visible { outline: 2px solid ${ink}; outline-offset: 3px; }
    /* Hide the "?" button while a tour is running (driver.js adds .driver-active to <body>). */
    body.driver-active .adm-help-fab { visibility: hidden; animation: none; }
  `}</style>
);

const NAV = [
  {
    key: "departments", label: "Departments & Programs",
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 10h.01" /><path d="M15 10h.01" />
      </svg>
    ),
  },
  {
    key: "coordinators", label: "Manage Coordinators",
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17.5" cy="9" r="2.5" /><path d="M17 14c2.5 0 4.5 1.8 4.5 4.5" />
      </svg>
    ),
  },
  {
    key: "accountprofile", label: "Account Profile",
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

// ═══════════════════════════ Context-aware help ═══════════════════════════
// Every pop-up and sub-screen registers itself as the "help topic" while it is open (useHelpTopic / <HelpTopic>).
// The floating "?" button then opens the guide of the TOP-MOST topic, so inside a pop-up, Personal Information,
// Terms & Conditions, Privacy Policy or About it explains that very screen. With nothing open it falls back
// to the current module's guide.
const HelpTopicContext = React.createContext(null);
const useHelpTopic = (key) => {
  const register = useContext(HelpTopicContext);
  useEffect(() => (key && register ? register(key) : undefined), [key, register]);
};
const HelpTopic = ({ id }) => { useHelpTopic(id); return null; };

const SidebarNav = ({ activeNav, onNavigate, onLogout }) => (
  <>
    {/* Role of the signed-in account, same spot the other dashboards use */}
    <div style={{ padding: "14px 22px 8px", flexShrink: 0 }}>
      <span style={{ fontFamily: uiFont, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: inkMuted }}>
        Administrator
      </span>
    </div>
    {NAV.map((item) => {
      const isActive = activeNav === item.key;
      return (
        <div key={item.key} className={`adm-nav-item ${isActive ? "active" : ""}`} onClick={() => onNavigate(item.key)}
          style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", cursor: "pointer", minHeight: "50px" }}>
          {item.icon(isActive ? paper : inkText)}
          <span style={{ fontFamily: uiFont, fontWeight: 500, fontSize: "0.9rem", flex: 1, color: isActive ? paper : inkText }}>{item.label}</span>
        </div>
      );
    })}
    <div style={{ flex: 1 }} />
    <hr style={{ border: "none", borderTop: `1px solid ${hairline}`, margin: "0 18px 8px" }} />
    <div className="adm-nav-logout" onClick={onLogout}
      style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", cursor: "pointer", minHeight: "50px" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "0.9rem", color: ink }}>Log Out</span>
    </div>
  </>
);

const LogoutConfirmModal = ({ onConfirm, onCancel }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
    <HelpTopic id="logout" />
    <div data-tour="confirm-card" style={{ background: paper, borderRadius: "20px", padding: "36px 32px", width: "clamp(280px, 85vw, 380px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: paperCard, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </div>
      <p style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "1.15rem", color: inkText, margin: 0, textAlign: "center" }}>Log Out</p>
      <p style={{ fontFamily: uiFont, fontSize: "0.9rem", color: inkMuted, margin: 0, textAlign: "center", lineHeight: 1.5 }}>Are you sure you want to log out of your account?</p>
      <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "8px" }}>
        <button data-tour="confirm-cancel" onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: `1.5px solid ${hairline}`, background: paper, fontFamily: uiFont, fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", color: inkMuted, boxShadow: "0 3px 10px rgba(0,0,0,0.3)" }}>Cancel</button>
        <button data-tour="confirm-ok" onClick={onConfirm} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: "none", background: ink, fontFamily: uiFont, fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", color: paper, boxShadow: "0 3px 10px rgba(0,0,0,0.5)" }}>Log Out</button>
      </div>
    </div>
  </div>
);

// "Are you sure?" dialog for every add / save / cancel / send in the admin screens. Same look as the
// Log Out dialog. Use the hook: `const [confirm, confirmDialog] = useConfirm();` render {confirmDialog}
// once, then `if (!(await confirm({ title, body, confirmLabel }))) return;` before the action.
// tone: "danger" for things that discard or cancel something.
const ConfirmModal = ({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default", onConfirm, onCancel }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const accent = tone === "danger" ? C.danger : ink;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <HelpTopic id="confirm" />
      <div data-tour="confirm-card" style={{ background: paper, borderRadius: "20px", padding: "32px 28px", width: "clamp(280px, 85vw, 400px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: paperCard, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "2px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <p style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "1.1rem", color: inkText, margin: 0, textAlign: "center" }}>{title}</p>
        <p style={{ fontFamily: uiFont, fontSize: "0.9rem", color: inkMuted, margin: 0, textAlign: "center", lineHeight: 1.5, overflowWrap: "anywhere" }}>{body}</p>
        <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "8px" }}>
          <button type="button" data-tour="confirm-cancel" onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: `1.5px solid ${hairline}`, background: paper, fontFamily: uiFont, fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", color: inkMuted, boxShadow: "0 3px 10px rgba(0,0,0,0.3)" }}>{cancelLabel}</button>
          <button type="button" data-tour="confirm-ok" autoFocus onClick={onConfirm} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: "none", background: accent, fontFamily: uiFont, fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", color: paper, boxShadow: "0 3px 10px rgba(0,0,0,0.5)" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

const useConfirm = () => {
  const [state, setState] = useState(null);
  const confirm = (opts) => new Promise((resolve) => setState({ ...opts, resolve }));
  const finish = (answer) => { state?.resolve(answer); setState(null); };
  const dialog = state
    ? <ConfirmModal {...state} onConfirm={() => finish(true)} onCancel={() => finish(false)} />
    : null;
  return [confirm, dialog];
};

// ═══════════════════════════ Sign in ═══════════════════════════
const AdminSignIn = ({ onExit }) => {
  const [mode, setMode] = useState("signin");            // "signin" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (m) => { setMode(m); setError(""); setInfo(""); setPassword(""); setShowPass(false); };

  const submit = async (e) => {
    e.preventDefault();
    const loginEmail = norm(email).toLowerCase();
    if (!loginEmail || !password) { setError("Enter your email and password."); return; }
    if (!EMAIL_RE.test(loginEmail)) { setError("Enter a valid email address."); return; }
    setBusy(true); setError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail, password);
      const snap = await getDoc(doc(db, "admins", cred.user.uid));
      if (!snap.exists() || snap.get("role") !== "admin" || snap.get("status") !== "active") {
        await signOut(auth);
        setError("This account is not an administrator account.");
      }
      // On success, onAuthStateChanged in <AdminScreen> swaps this form for the dashboard.
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Always answers the same way, so it can't be used to discover which emails are administrators.
  const sendReset = async (e) => {
    e.preventDefault();
    const target = norm(email).toLowerCase();
    if (!EMAIL_RE.test(target)) { setError("Enter a valid email address."); return; }
    setBusy(true); setError(""); setInfo("");
    try {
      await httpsCallable(functions, "adminRequestPasswordReset")({ email: target });
      setInfo("If that email belongs to an administrator account, a password reset link has been sent to it. Check your inbox and spam folder. You can ask for another one after a minute.");
    } catch (err) {
      setError(err?.message || "Could not send the reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = (name) => ({
    width: "100%", boxSizing: "border-box", height: "52px", padding: "0 16px", background: paperTint,
    border: `1.5px solid ${focused === name ? ink : hairline}`, borderRadius: "16px", color: inkText,
    fontFamily: uiFont, fontSize: "0.9375rem", outline: "none", transition: "border-color 160ms ease",
  });
  const linkBtn = { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: uiFont, fontSize: "0.82rem", fontWeight: 600, color: inkText, textDecoration: "underline" };
  const emailField = (
    <>
      <label style={{ ...S.label, marginTop: 0 }} htmlFor="ad-email">Email<Req /></label>
      <input id="ad-email" type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        value={email} onChange={(e) => setEmail(e.target.value)}
        onFocus={() => setFocused("email")} onBlur={() => setFocused("")} style={field("email")} />
    </>
  );

  return (
    <>
      <AdminStyles />
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: `linear-gradient(180deg, ${paper} 0%, ${paperCard} 100%)`, fontFamily: uiFont, color: inkText }}>
        <div style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
          <img src={logo} alt="OJTern" style={{ display: "block", margin: "0 auto", width: "130px", height: "130px", objectFit: "contain", }}/>
          <div style={{ fontFamily: logoFont, fontSize: "2.3rem", color: ink, letterSpacing: "0.03em", lineHeight: 1.1, marginBottom: "10px" }}>OJTern</div>
          <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: "30px", background: ink, color: paper, fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "22px" }}>
            Administrator
          </div>

          {mode === "signin" ? (
            <form onSubmit={submit} noValidate style={{ ...S.card, padding: "26px", textAlign: "left", marginBottom: 0, borderRadius: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Sign In</h1>
              <p style={{ ...S.help, margin: "0 0 18px" }}>Use the administrator email and password.</p>

              {emailField}

              <label style={{ ...S.label, marginTop: "14px" }} htmlFor="ad-pass">Password<Req /></label>
              <div style={{ position: "relative" }}>
                <input id="ad-pass" type={showPass ? "text" : "password"} autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocused("pass")} onBlur={() => setFocused("")}
                  style={{ ...field("pass"), paddingRight: "64px" }} />
                <button type="button" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontFamily: uiFont, fontSize: "0.75rem", fontWeight: 600, color: inkMuted }}>
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
              <div style={{ textAlign: "right", marginTop: "10px" }}>
                <button type="button" style={linkBtn} onClick={() => switchMode("forgot")}>Forgot password?</button>
              </div>

              {error && <div role="alert" style={S.err}>{error}</div>}
              <button type="submit" disabled={busy}
                style={{ ...S.btn, width: "100%", height: "52px", marginTop: "14px", fontSize: "0.95rem", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Signing in…" : "Sign In"}
              </button>
              {onExit && (
                <button type="button" onClick={onExit} style={{ ...S.btn2, width: "100%", height: "46px", marginTop: "10px" }}>Back to OJTern</button>
              )}
            </form>
          ) : (
            <form onSubmit={sendReset} noValidate style={{ ...S.card, padding: "26px", textAlign: "left", marginBottom: 0, borderRadius: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Forgot password</h1>
              <p style={{ ...S.help, margin: "0 0 18px" }}>Enter your administrator email. We’ll send a password reset link to it.</p>

              {emailField}

              {error && <div role="alert" style={S.err}>{error}</div>}
              {info && <div role="status" style={{ ...S.okMsg, margin: "14px 0 0" }}>{info}</div>}
              <button type="submit" disabled={busy}
                style={{ ...S.btn, width: "100%", height: "52px", marginTop: "18px", fontSize: "0.95rem", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
              <button type="button" onClick={() => switchMode("signin")} style={{ ...S.btn2, width: "100%", height: "46px", marginTop: "10px" }}>Back to sign in</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

// ═══════════════ CustomSelect: the dropdown used in the Student Accounts forms ═══════════════
// Replaces the browser's native <select> list (which can't be styled and spills past the pop-up) with
// our own: white card, 12px corners, soft shadow, hover + selected tints. It opens up or down,
// whichever side has more room inside the nearest scrolling container, and caps its height to fit,
// so it never goes past the edge of the pop-up. Keyboard: arrows, Enter/Space, Escape.
const CS_MAX_LIST_HEIGHT = 240;
const CS_MIN_LIST_HEIGHT = 96;
const CS_EDGE_GAP = 8;
const csNormalize = (o) =>
  o !== null && typeof o === "object"
    ? { value: String(o.value ?? ""), label: String(o.label ?? o.value ?? "") }
    : { value: String(o ?? ""), label: String(o ?? "") };
const csFindClipParent = (el) => {
  for (let p = el?.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden" || oy === "clip") return p;
  }
  return null;
};

function CustomSelect({ value, onChange, options = [], placeholder = "Select…", showPlaceholderOption = true, disabled = false, hasError = false, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [maxHeight, setMaxH] = useState(CS_MAX_LIST_HEIGHT);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const items = [
    ...(showPlaceholderOption ? [{ value: "", label: placeholder, isPlaceholder: true }] : []),
    ...options.map(csNormalize),
  ];
  const current = String(value ?? "");
  const selected = items.find((i) => !i.isPlaceholder && i.value === current);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); };
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const clip = csFindClipParent(wrapRef.current);
    const bounds = clip ? clip.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const top = Math.max(bounds.top, 0);
    const bottom = Math.min(bounds.bottom, window.innerHeight);
    const below = bottom - rect.bottom - CS_EDGE_GAP;
    const above = rect.top - top - CS_EDGE_GAP;
    const wanted = Math.min(CS_MAX_LIST_HEIGHT, items.length * 36 + 8);
    const up = below < wanted && above > below;
    setOpenUp(up);
    setMaxH(Math.max(CS_MIN_LIST_HEIGHT, Math.min(CS_MAX_LIST_HEIGHT, up ? above : below)));
    const idx = items.findIndex((i) => i.value === current);
    setActive(idx >= 0 ? idx : 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || active < 0 || !listRef.current) return;
    listRef.current.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (item) => { onChange?.(item.value); setOpen(false); };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Escape") { if (open) { e.stopPropagation(); setOpen(false); } return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive((a) => { const n = items.length; return e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n; });
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && open && active >= 0) { e.preventDefault(); choose(items[active]); }
  };

  const trigger = {
    ...S.input,
    textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", outline: "none",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "32px",
    background: disabled ? paperCard : paper,
    color: selected ? inkText : inkMuted,
    borderColor: hasError ? C.danger : open ? ink : hairline,
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)} onKeyDown={onKeyDown} style={trigger}>
        {selected ? selected.label : (disabled ? "\u00A0" : placeholder)}
      </button>
      <span aria-hidden="true" style={{ position: "absolute", right: "12px", top: "50%", transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: "transform 160ms ease", pointerEvents: "none", display: "flex", color: disabled ? "#BDBDBD" : inkMuted }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
      </span>
      {open && !disabled && (
        <div ref={listRef} role="listbox" style={{
          position: "absolute", left: 0, right: 0, [openUp ? "bottom" : "top"]: "calc(100% + 4px)",
          background: paper, borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          maxHeight: `${maxHeight}px`, overflowY: "auto", zIndex: 2000, padding: "4px 0",
        }}>
          {items.map((item, i) => {
            const isSel = !item.isPlaceholder && item.value === current;
            const bg = i === active ? "#F5F5F5" : isSel ? paperCard : paper;
            return (
              <div key={`${item.value}-${i}`} role="option" aria-selected={isSel}
                onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item)} onMouseEnter={() => setActive(i)}
                style={{ padding: "8px 14px", fontFamily: uiFont, fontSize: "0.82rem", lineHeight: 1.4, cursor: "pointer", background: bg, color: item.isPlaceholder ? inkMuted : inkText, fontWeight: isSel ? 600 : 400, whiteSpace: "normal", overflowWrap: "anywhere" }}>
                {item.label}
              </div>
            );
          })}
          {items.length === 0 && <div style={{ padding: "10px 14px", fontFamily: uiFont, fontSize: "0.8rem", color: inkMuted }}>No options</div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════ Department / program / major picker rows ═══════════════
// value: [{ department, program, specialization }]
const DeptSelectionsEditor = ({ depts, value, onChange }) => {
  const setRow = (i, patch) => onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div>
      {value.map((row, i) => {
        const dept = depts.find((d) => d.name === row.department);
        const progs = programsOf(dept);
        const prog = progs.find((p) => p.name === row.program);
        const specs = prog?.specializations || [];
        return (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end", marginBottom: "8px", ...(i > 0 ? { borderTop: `1px solid ${hairline}`, marginTop: "14px", paddingTop: "6px" } : null) }}>
            <div style={{ flex: "1 1 220px" }}>
              <label style={S.label}>Department<Req /></label>
              <CustomSelect value={row.department} placeholder="Select department"
                onChange={(v) => setRow(i, { department: v, program: "", specialization: "" })}
                options={depts.map((d) => ({ value: d.name, label: `${d.name}${d.abbr ? ` (${d.abbr})` : ""}` }))} />
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <label style={S.label}>Program<Req /></label>
              <CustomSelect value={row.program} disabled={!dept} placeholder="All programs in this department"
                onChange={(v) => setRow(i, { program: v, specialization: "" })}
                options={progs.map((p) => p.name)} />
            </div>
            {specs.length > 0 && (
              <div style={{ flex: "1 1 180px" }}>
                <label style={S.label}>Major</label>
                <CustomSelect value={row.specialization} placeholder="All majors"
                  onChange={(v) => setRow(i, { specialization: v })} options={specs} />
              </div>
            )}
            {value.length > 1 && (
              <button type="button" style={S.btn2} onClick={() => onChange(value.filter((_, idx) => idx !== i))}>Remove</button>
            )}
          </div>
        );
      })}
      <button type="button" style={S.btn2} onClick={() => onChange([...value, { department: "", program: "", specialization: "" }])}>+ Add another department</button>
    </div>
  );
};
const emptySel = () => [{ department: "", program: "", specialization: "" }];

// ═══════════════════════════ Departments tab ═══════════════════════════
const AddInline = ({ placeholder, onAdd }) => {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!norm(v)) return;
    setBusy(true);
    const ok = await onAdd(norm(v));
    setBusy(false);
    if (ok) setV("");
  };
  return (
    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} style={{ ...S.input, padding: "6px 10px", fontSize: "0.82rem" }}
        onKeyDown={(e) => { if (e.key === "Enter") go(); }} />
      <button type="button" style={S.btn2} disabled={busy || !norm(v)} onClick={go}>Add</button>
    </div>
  );
};

// Pop-up shell for the Departments tab (same look as the New Student modal in Student Accounts).
const DeptModal = ({ title, onClose, children, footer, help }) => {
  useHelpTopic(help);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "clamp(16px, 5vw, 24px)" }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="dp-modal">
        <div className="dp-modal-header">
          <h2 style={{ fontFamily: uiFont, fontSize: "clamp(1.125rem, 4vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: inkText, margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: paperCard, border: `1px solid ${hairline}`, borderRadius: "50%", width: "30px", height: "30px", color: inkMuted, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>
        <div className="dp-modal-body">{children}</div>
        <div className="dp-modal-footer">{footer}</div>
      </div>
    </div>
  );
};

// Filter button + panel for Departments & Programs: Department → Program → Major, all built from the live data.
const CascadeFilter = ({ depts, filters, programOptions, majorOptions, onPick, onClear }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const hasFilter = !!(filters.department || filters.program || filters.major);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const chip = (on) => ({ padding: "5px 12px", borderRadius: "999px", fontFamily: uiFont, fontSize: "0.78rem", cursor: "pointer", userSelect: "none", textAlign: "left", background: on ? ink : paperCard, color: on ? paper : inkText, border: `1px solid ${on ? ink : hairline}` });
  const label = { fontFamily: uiFont, fontSize: "0.8rem", fontWeight: 700, color: inkText, margin: "0 0 8px" };
  const rule = <hr style={{ border: "none", borderTop: `1px solid ${hairline}`, margin: "0 0 12px" }} />;
  return (
    <div ref={ref} data-tour="filter" style={{ position: "relative" }}>
      <button type="button" title="Filters" aria-label="Filters" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        style={{ width: "40px", height: "40px", borderRadius: "999px", border: hasFilter ? `2px solid ${paperCard}` : "none", background: hasFilter ? paperCard : paper, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? ink : inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "48px", right: 0, width: "min(300px, 80vw)", maxHeight: "min(70vh, 520px)", overflowY: "auto", background: paper, border: `1px solid ${hairline}`, borderRadius: "16px", boxShadow: "0 12px 32px rgba(0,0,0,0.22)", zIndex: 100, padding: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontFamily: uiFont, fontSize: "1rem", fontWeight: 700, color: inkText }}>Filters</span>
            <button type="button" onClick={onClear} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: uiFont, fontSize: "0.8rem", color: inkMuted, textDecoration: "underline" }}>Clear all</button>
          </div>
          <p style={label}>Department</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
            {depts.length === 0 && <span style={{ fontSize: "0.78rem", color: inkMuted }}>No departments yet</span>}
            {depts.map((d) => (
              <button key={d.id} type="button" title={d.name} style={chip(filters.department === d.name)}
                onClick={() => onPick({ department: filters.department === d.name ? "" : d.name, program: "", major: "" })}>{d.abbr || d.name}</button>
            ))}
          </div>
          {!filters.department && <p style={{ fontFamily: uiFont, fontSize: "0.76rem", color: inkMuted, margin: 0 }}>Pick a department to filter by its programs and majors.</p>}
          {programOptions.length > 0 && (
            <>
              {rule}
              <p style={label}>Program</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                {programOptions.map((n) => (
                  <button key={n} type="button" style={chip(filters.program === n)}
                    onClick={() => onPick({ program: filters.program === n ? "" : n, major: "" })}>{n}</button>
                ))}
              </div>
            </>
          )}
          {majorOptions.length > 0 && (
            <>
              {rule}
              <p style={label}>Major</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {majorOptions.map((m) => (
                  <button key={m} type="button" style={chip(filters.major === m)}
                    onClick={() => onPick({ major: filters.major === m ? "" : m })}>{m}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const DepartmentsTab = ({ depts, loaded, flash }) => {
  const [form, setForm] = useState({ name: "", abbr: "", program: "", majors: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // The screen fills the area under the top bar; only the list inside it scrolls.
  const screenRef = useRef(null);
  const fitH = useFillHeight(screenRef, "tab", true);
  const scrollRef = useRef(null);
  const goToPage = (n) => { setPage(n); requestAnimationFrame(() => scrollListToTop(scrollRef.current)); };
  const [showAdd, setShowAdd] = useState(false);
  const [managingId, setManagingId] = useState(null);
  const [filters, setFilters] = useState({ department: "", program: "", major: "" });
  const [confirm, confirmDialog] = useConfirm();
  const sorted = useMemo(() => [...depts].sort((a, b) => a.name.localeCompare(b.name)), [depts]);
  const notSeeded = loaded && depts.length === 0;

  const run = async (fn, okMsg) => {
    setError("");
    try { await fn(); if (okMsg) flash(okMsg); return true; }
    catch (e) { console.error(e); setError(e?.message || "Could not save. Please try again."); return false; }
  };

  const seed = async () => {
    if (!(await confirm({ title: "Save default departments", body: "Are you sure you want to save the built-in default departments to Firestore?", confirmLabel: "Save" }))) return false;
    return run(async () => {
    for (const [name, v] of Object.entries(DEFAULT_DEPARTMENTS)) {
      await setDoc(doc(db, "departments", slug(v.abbr || name)), { name, abbr: v.abbr || "", programs: v.programs, createdAt: serverTimestamp() });
    }
  }, "Default departments saved to Firestore.");
  };

  const addDepartment = async () => {
    const name = norm(form.name), abbr = norm(form.abbr).toUpperCase(), program = norm(form.program);
    if (!name || !abbr || !program) { setError("Department name, abbreviation and first program are all required."); return; }
    if (!/^[A-Z0-9]{2,10}$/.test(abbr)) { setError("Abbreviation must be 2–10 letters or numbers, e.g. CON."); return; }
    if (depts.some((d) => same(d.name, name))) { setError("A department with that name already exists."); return; }
    if (depts.some((d) => same(d.abbr, abbr))) { setError("That abbreviation is already used by another department."); return; }
    // Majors are kept apart from the program name: they are stored in the program's own list.
    const specializations = [];
    for (const m of form.majors.split(",").map(norm).filter(Boolean)) {
      if (!specializations.some((x) => same(x, m))) specializations.push(m);
    }
    const majorsText = specializations.length ? ` with the major${specializations.length > 1 ? "s" : ""} ${specializations.join(", ")}` : "";
    if (!(await confirm({
      title: "Add department",
      body: `Are you sure you want to add ${name} (${abbr}) with the program ${program}${majorsText}? The name and abbreviation can't be changed afterwards.`,
      confirmLabel: "Add department",
    }))) return;
    setBusy(true);
    const ok = await run(
      () => setDoc(doc(db, "departments", slug(abbr)), { name, abbr, programs: [{ name: program, specializations }], createdAt: serverTimestamp() }),
      `${name} added.`
    );
    setBusy(false);
    if (ok) { setForm({ name: "", abbr: "", program: "", majors: "" }); setShowAdd(false); }
  };

  const addProgram = async (d, name) => {
    if (programsOf(d).some((p) => same(p.name, name))) { setError(`"${name}" already exists in ${d.name}.`); return false; }
    if (!(await confirm({ title: "Add program", body: `Are you sure you want to add the program "${name}" to ${d.name}?`, confirmLabel: "Add program" }))) return false;
    return run(() => updateDoc(doc(db, "departments", d.id), { programs: [...programsOf(d), { name, specializations: [] }] }), `Program added to ${d.name}.`);
  };

  const addMajor = async (d, programName, major) => {
    const prog = programsOf(d).find((p) => p.name === programName);
    if (prog?.specializations.some((m) => same(m, major))) { setError(`"${major}" already exists in ${programName}.`); return false; }
    if (!(await confirm({ title: "Add major", body: `Are you sure you want to add the major "${major}" to ${programName}?`, confirmLabel: "Add major" }))) return false;
    const programs = programsOf(d).map((p) => (p.name === programName ? { ...p, specializations: [...p.specializations, major] } : p));
    return run(() => updateDoc(doc(db, "departments", d.id), { programs }), `Major added to ${programName}.`);
  };

  // ── List: search + pagination (10 per page), same idea as the Student Accounts list ──
  const PAGE_SIZE = 10;
  const q = norm(search).toLowerCase();
  // Filter options come from the live departments, so anything added later shows up here by itself.
  // Same as Manage Coordinators: Department first; its Programs appear once a department is picked,
  // and that program's Majors appear once a program is picked.
  const hasFilter = !!(filters.department || filters.program || filters.major);
  const scopeDepts = filters.department ? sorted.filter((d) => d.name === filters.department) : sorted;
  const uniq = (list) => [...new Set(list)].sort((a, b) => a.localeCompare(b));
  const programOptions = filters.department ? uniq(scopeDepts.flatMap((d) => programsOf(d).map((p) => p.name))) : [];
  const majorOptions = filters.program ? uniq(scopeDepts.flatMap((d) => programsOf(d)).filter((p) => p.name === filters.program).flatMap((p) => p.specializations)) : [];
  const matchesFilter = (d) => {
    if (filters.department && d.name !== filters.department) return false;
    const progs = programsOf(d).filter((p) => !filters.program || same(p.name, filters.program));
    if (filters.program && progs.length === 0) return false;
    if (filters.major && !progs.some((p) => p.specializations.some((m) => same(m, filters.major)))) return false;
    return true;
  };
  // Search looks at the department name, its abbreviation, every program and every major.
  // Each word typed must match somewhere, so "computer studies", "ccs" or "bs information" all work.
  const words = q.split(/\s+/).filter(Boolean);
  const matchesSearch = (d) => {
    if (words.length === 0) return true;
    const hay = [d.name, d.abbr, ...programsOf(d).flatMap((p) => [p.name, ...p.specializations])]
      .map((x) => String(x || "").toLowerCase()).join(" | ");
    return words.every((w) => hay.includes(w));
  };
  const filtered = useMemo(() => sorted.filter((d) => matchesFilter(d) && matchesSearch(d)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sorted, q, filters]);
  const setFilter = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const clearFilters = () => { setFilters({ department: "", program: "", major: "" }); setPage(1); };
  const totalPrograms = useMemo(() => depts.reduce((n, d) => n + programsOf(d).length, 0), [depts]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pageItems = (() => {
    // Up to 7 pages: show all. More: 1 2 3 4 5 … last near the start, 1 … last-4 … last near the end, 1 … p-1 p p+1 … last in the middle.
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    if (totalPages <= 7) return range(1, totalPages);
    if (safePage <= 4) return [...range(1, 5), "gap-end", totalPages];
    if (safePage >= totalPages - 3) return [1, "gap-start", ...range(totalPages - 4, totalPages)];
    return [1, "gap-start", safePage - 1, safePage, safePage + 1, "gap-end", totalPages];
  })();
  const managing = managingId ? depts.find((d) => d.id === managingId) : null;
  const modalOpen = showAdd || !!managing;

  const openAdd = () => { setError(""); setForm({ name: "", abbr: "", program: "", majors: "" }); setShowAdd(true); };
  const closeAdd = async () => {
    // Ask only when something was typed: nothing to lose otherwise.
    if ((form.name || form.abbr || form.program || form.majors)
      && !(await confirm({ title: "Cancel", body: "Are you sure you want to cancel? What you entered will be discarded.", confirmLabel: "Discard", cancelLabel: "Keep editing", tone: "danger" }))) return;
    setShowAdd(false); setError("");
  };

  const errorBox = error ? <div role="alert" style={S.err}>{error}</div> : null;
  const pageBtn = (on, disabled) => ({
    minWidth: "36px", height: "36px", padding: "0 10px", borderRadius: "10px",
    border: `1.5px solid ${on ? ink : hairline}`, background: on ? ink : paper, color: on ? paper : inkText,
    fontFamily: uiFont, fontSize: "0.82rem", fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
  });

  return (
    <div ref={screenRef} style={{ display: "flex", flexDirection: "column", height: fitH ? `${fitH}px` : undefined }}>
      {confirmDialog}
      <div style={tabHeadStyle}>
      {!modalOpen && errorBox}

      {notSeeded && (
        <div style={{ ...S.card, borderColor: C.danger }}>
          <h2 style={S.h2}>Departments are not in Firestore yet</h2>
          <p style={S.help}>
            The app is currently showing its built-in default list. Seed that list into Firestore first — if you add
            a new department before seeding, the default ones would disappear from every dropdown.
          </p>
          <button type="button" style={S.btn} onClick={seed}>Seed default departments</button>
        </div>
      )}

      {/* Floating dark header bar: same shape as Student Accounts */}
      <div className="dp-bar">
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <span style={{ fontFamily: uiFont, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: paper, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Departments & Programs</span>
          <p style={{ fontFamily: uiFont, fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filtered.length} of {depts.length} department{depts.length !== 1 ? "s" : ""} · {totalPrograms} program{totalPrograms !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <div className="dp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search department or program" name="dp-search" autoComplete="off" spellCheck={false} />
            {search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }} style={{ background: "none", border: "none", color: inkMuted, cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>}
          </div>
          <CascadeFilter depts={sorted} filters={filters} programOptions={programOptions} majorOptions={majorOptions} onPick={setFilter} onClear={clearFilters} />
        </div>
      </div>

      {/* Toolbar */}
      {!notSeeded && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {hasFilter && (
              <>
                {[
                  filters.department && { label: sorted.find((d) => d.name === filters.department)?.abbr || filters.department, clear: () => setFilter({ department: "", program: "", major: "" }) },
                  filters.program && { label: filters.program, clear: () => setFilter({ program: "", major: "" }) },
                  filters.major && { label: filters.major, clear: () => setFilter({ major: "" }) },
                ].filter(Boolean).map(({ label, clear }) => (
                  <span key={label} style={{ background: paper, color: inkText, border: `1px solid ${hairline}`, borderRadius: "999px", padding: "4px 12px", fontFamily: uiFont, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    {label}<span role="button" aria-label={`Remove filter ${label}`} onClick={clear} style={{ cursor: "pointer", color: inkMuted }}>✕</span>
                  </span>
                ))}
                <button type="button" onClick={clearFilters} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: uiFont, fontSize: "0.78rem", color: inkMuted, textDecoration: "underline" }}>Clear all</button>
              </>
            )}
          </div>
          <button type="button" data-tour="add-dept" className="adm-btn-dark" style={S.btn} onClick={openAdd}>Add a department</button>
        </div>
      )}

      </div>

      <div ref={scrollRef} style={tabScrollStyle}>
      {/* Department list: full-width rows */}
      {pageRows.length > 0 ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {pageRows.map((d) => {
              const progs = programsOf(d);
              const majorCount = progs.reduce((n, p) => n + p.specializations.length, 0);
              const meta = `${progs.length} program${progs.length !== 1 ? "s" : ""} · ${majorCount} major${majorCount !== 1 ? "s" : ""}`;
              return (
                <div key={d.id} className="dp-row" role="button" tabIndex={0} onClick={() => { setError(""); setManagingId(d.id); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { setError(""); setManagingId(d.id); } }}>
                  <div style={{ width: "45px", height: "45px", borderRadius: "50%", background: paperCard, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={inkText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontFamily: uiFont, fontSize: "1rem", fontWeight: 600, letterSpacing: "-0.01em", color: inkText, margin: 0, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.name}{d.abbr && <span style={{ color: inkMuted, fontWeight: 600 }}> ({d.abbr})</span>}
                    </h3>
                    <p style={{ fontFamily: uiFont, fontSize: "0.8rem", color: inkMuted, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</p>
                  </div>
                  <button type="button" className="dp-row-view adm-btn-light" style={S.btn2} onClick={(e) => { e.stopPropagation(); setError(""); setManagingId(d.id); }}>Manage</button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", flexWrap: "wrap-reverse", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "20px 0 4px" }}>
            <span style={{ fontFamily: uiFont, fontSize: "0.8rem", color: inkMuted }}>Showing {showingFrom}–{showingTo} of {filtered.length}</span>
            {/* Pill bar: current page badge + « ‹ 1 2 3 4 5 … 10 › » (always shown, buttons disable at the ends) */}
            <nav aria-label="Pagination" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "stretch", maxWidth: "100%", background: paper, border: `1px solid ${hairline}`, borderRadius: "16px", boxShadow: "0 4px 16px rgba(20,20,20,0.06)", overflow: "hidden" }}>
              <div title="Current page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "52px", padding: "0 14px", background: paperCard, borderRight: `1px solid ${hairline}`, fontFamily: uiFont, fontSize: "0.9rem", fontWeight: 700, color: inkText }}>
                {String(safePage).padStart(2, "0")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 12px", flexWrap: "wrap", justifyContent: "center" }}>
                <button type="button" aria-label="First page" title="First page" style={pageBtn(false, safePage === 1)} disabled={safePage === 1} onClick={() => goToPage(1)}>«</button>
                <button type="button" aria-label="Previous page" title="Previous page" style={pageBtn(false, safePage === 1)} disabled={safePage === 1} onClick={() => goToPage(safePage - 1)}>‹</button>
                {pageItems.map((it) => (typeof it === "number"
                  ? <button key={it} type="button" style={pageBtn(it === safePage, false)} aria-current={it === safePage ? "page" : undefined} onClick={() => goToPage(it)}>{it}</button>
                  : <span key={it} style={{ color: inkMuted, padding: "0 4px" }}>…</span>))}
                <button type="button" aria-label="Next page" title="Next page" style={pageBtn(false, safePage === totalPages)} disabled={safePage === totalPages} onClick={() => goToPage(safePage + 1)}>›</button>
                <button type="button" aria-label="Last page" title="Last page" style={pageBtn(false, safePage === totalPages)} disabled={safePage === totalPages} onClick={() => goToPage(totalPages)}>»</button>
              </div>
            </nav>
          </div>
        </>
      ) : (
        !notSeeded && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "72px 24px", gap: "4px", background: paper, border: `1px dashed ${hairline}`, borderRadius: "20px" }}>
            <p style={{ fontFamily: uiFont, fontSize: "1.0625rem", fontWeight: 600, color: inkText, margin: 0 }}>{depts.length === 0 ? "No departments yet" : "No departments match this search"}</p>
            <p style={{ fontFamily: uiFont, fontSize: "0.82rem", color: inkMuted, margin: 0, maxWidth: "44ch" }}>
              {depts.length === 0 ? "Use Add a department to create the first one." : "Try a different search, or clear a filter."}
            </p>
          </div>
        )
      )}
      </div>

      {/* ── Add a department (pop-up form) ── */}
      {showAdd && (
        <DeptModal help="dept-add" title="Add a department" onClose={closeAdd}
          footer={(
            <>
              <button type="button" style={S.btn2} disabled={busy} onClick={closeAdd}>Cancel</button>
              <button type="button" style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={addDepartment}>{busy ? "Adding…" : "Add department"}</button>
            </>
          )}>
          <p style={S.help}>Name and abbreviation can’t be changed after saving, so double-check them. You can add more programs and majors later; a major is always added to a specific program.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ flex: "2 1 260px" }}>
              <label style={S.label}>Department name<Req /></label>
              <input data-tour="dept-name" style={S.input} value={form.name} placeholder="College of Nursing" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ flex: "1 1 110px" }}>
              <label style={S.label}>Abbreviation<Req /></label>
              <input data-tour="dept-abbr" style={S.input} value={form.abbr} placeholder="CON" maxLength={10} onChange={(e) => setForm({ ...form, abbr: e.target.value.toUpperCase() })} />
            </div>
            <div style={{ flex: "1 1 100%" }}>
              <label style={S.label}>First program<Req /></label>
              <input data-tour="dept-program" style={S.input} value={form.program} placeholder="Bachelor of Science in Nursing" onChange={(e) => setForm({ ...form, program: e.target.value })} />
            </div>
            <div style={{ flex: "1 1 100%" }}>
              <label style={S.label}>Majors of that program (optional)</label>
              <input data-tour="dept-majors" style={S.input} value={form.majors} placeholder="e.g. English, Mathematics — separate with commas; leave blank if it has none" onChange={(e) => setForm({ ...form, majors: e.target.value })} />
              <p style={{ ...S.help, margin: "6px 0 0" }}>Don’t put the major in the program name — write “Bachelor of Secondary Education” here and “English” above.</p>
            </div>
          </div>
          {errorBox}
        </DeptModal>
      )}

      {/* ── Programs & majors of one department (pop-up) ── */}
      {managing && (
        <DeptModal help="dept-manage" title={`${managing.name}${managing.abbr ? ` (${managing.abbr})` : ""}`} onClose={() => { setManagingId(null); setError(""); }}
          footer={<button type="button" style={S.btn} onClick={() => { setManagingId(null); setError(""); }}>Done</button>}>
          {programsOf(managing).map((p) => (
            <div key={p.name} style={{ borderTop: `1px solid ${C.line}`, padding: "10px 0" }}>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.name}</div>
              <div style={{ marginTop: "6px" }}>
                {p.specializations.length === 0
                  ? <span style={{ fontSize: "0.78rem", color: C.muted }}>No majors</span>
                  : p.specializations.map((m) => <span key={m} style={S.chip}>{m}</span>)}
              </div>
              <AddInline placeholder="Add a major to this program" onAdd={(v) => addMajor(managing, p.name, v)} />
            </div>
          ))}
          <div data-tour="add-program" style={{ borderTop: `1px solid ${C.line}`, paddingTop: "10px" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Add a program to {managing.abbr || managing.name}</div>
            <AddInline placeholder="Program name" onAdd={(v) => addProgram(managing, v)} />
          </div>
          {errorBox}
        </DeptModal>
      )}
    </div>
  );
};

// Departments / Manage Coordinators: the header bar + filters are fixed, only the list under them scrolls
// (same idea as Account Profile). The list box reaches into the screen padding so its scrollbar sits at the edge.
const tabHeadStyle = { flexShrink: 0, position: "relative", zIndex: 30 };
const tabScrollStyle = { flex: "1 1 auto", minHeight: 0, overflowY: "auto", margin: "0 calc(-1 * clamp(16px, 4vw, 32px)) calc(-1 * clamp(16px, 4vw, 28px))", padding: "0 clamp(16px, 4vw, 32px) clamp(16px, 4vw, 28px)" };
// Next/previous page: the list goes back to its start.
const scrollListToTop = (scroller) => { if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" }); };

// Page bar used by the list screens: current-page badge + « ‹ 1 2 3 4 5 … 10 › » (always shown, buttons disable at the ends).
const PaginationBar = ({ page, totalPages, onPage, from, to, total }) => {
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const items = totalPages <= 7 ? range(1, totalPages)
    : page <= 4 ? [...range(1, 5), "gap-end", totalPages]
    : page >= totalPages - 3 ? [1, "gap-start", ...range(totalPages - 4, totalPages)]
    : [1, "gap-start", page - 1, page, page + 1, "gap-end", totalPages];
  const btn = (on, disabled) => ({
    minWidth: "36px", height: "36px", padding: "0 10px", borderRadius: "10px",
    border: `1.5px solid ${on ? ink : hairline}`, background: on ? ink : paper, color: on ? paper : inkText,
    fontFamily: uiFont, fontSize: "0.82rem", fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
  });
  return (
    <div style={{ display: "flex", flexWrap: "wrap-reverse", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "20px 0 4px" }}>
      <span style={{ fontFamily: uiFont, fontSize: "0.8rem", color: inkMuted }}>Showing {from}–{to} of {total}</span>
      <nav aria-label="Pagination" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "stretch", maxWidth: "100%", background: paper, border: `1px solid ${hairline}`, borderRadius: "16px", boxShadow: "0 4px 16px rgba(20,20,20,0.06)", overflow: "hidden" }}>
        <div title="Current page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "52px", padding: "0 14px", background: paperCard, borderRight: `1px solid ${hairline}`, fontFamily: uiFont, fontSize: "0.9rem", fontWeight: 700, color: inkText }}>
          {String(page).padStart(2, "0")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 12px", flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" aria-label="First page" title="First page" style={btn(false, page === 1)} disabled={page === 1} onClick={() => onPage(1)}>«</button>
          <button type="button" aria-label="Previous page" title="Previous page" style={btn(false, page === 1)} disabled={page === 1} onClick={() => onPage(page - 1)}>‹</button>
          {items.map((it) => (typeof it === "number"
            ? <button key={it} type="button" style={btn(it === page, false)} aria-current={it === page ? "page" : undefined} onClick={() => onPage(it)}>{it}</button>
            : <span key={it} style={{ color: inkMuted, padding: "0 4px" }}>…</span>))}
          <button type="button" aria-label="Next page" title="Next page" style={btn(false, page === totalPages)} disabled={page === totalPages} onClick={() => onPage(page + 1)}>›</button>
          <button type="button" aria-label="Last page" title="Last page" style={btn(false, page === totalPages)} disabled={page === totalPages} onClick={() => onPage(totalPages)}>»</button>
        </div>
      </nav>
    </div>
  );
};

// ═══════════════════════════ Manage Coordinators tab ═══════════════════════════
// List style follows the Report Company screen (table with Name/Email, Department, Status, Action;
// cards on narrow screens). Inviting and managing happen in pop-ups, like Departments & Programs.
const statusBadge = (status) => {
  const s = String(status || "").toLowerCase();
  const bg = s === "active" ? C.ok : s === "pending" ? "#8a5a00" : ["disabled", "suspended", "inactive", "cancelled"].includes(s) ? C.danger : inkMuted;
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
  return <span style={{ fontFamily: uiFont, fontSize: "0.7rem", fontWeight: 700, background: bg, color: "white", borderRadius: "12px", padding: "3px 10px", whiteSpace: "nowrap" }}>{label}</span>;
};

const CoordinatorsTab = ({ admin, depts, flash }) => {
  const PAGE_SIZE = 10;
  const [coordinators, setCoordinators] = useState([]);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [sel, setSel] = useState(emptySel());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // The screen fills the area under the top bar; only the list inside it scrolls.
  const screenRef = useRef(null);
  const fitH = useFillHeight(screenRef, "tab", true);
  const scrollRef = useRef(null);
  const goToPage = (n) => { setPage(n); requestAnimationFrame(() => scrollListToTop(scrollRef.current)); };
  const [showInvite, setShowInvite] = useState(false);
  const [managingKey, setManagingKey] = useState(null);   // "c:<uid>" | "i:<inviteId>"
  const [filters, setFilters] = useState({ department: "", program: "", major: "" });
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef(null);
  useEffect(() => {
    if (!showFilter) return;
    const onDown = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showFilter]);
  const [editSel, setEditSel] = useState(emptySel());
  const [confirm, confirmDialog] = useConfirm();
  // UIDs that already have an active admins/{uid} doc (so their row shows "Admin" instead of the button).
  // If the rules don't let an admin list the collection this just stays empty; promoting is idempotent anyway.
  const [adminUids, setAdminUids] = useState(() => new Set());
  useEffect(() => onSnapshot(collection(db, "admins"),
    (s) => setAdminUids(new Set(s.docs.filter((d) => d.get("status") === "active").map((d) => d.id))),
    (e) => console.error("admins:", e)), []);

  // The selection a coordinator has on file, in the shape the editor uses (also what "unchanged" means).
  const initialSel = (c) => (c.deptSelections?.length
    ? c.deptSelections.map((raw) => { const s = normSel(raw); return { department: s.department || "", program: s.program || "", specialization: s.specialization || "" }; })
    : emptySel());
  const selSig = (v) => JSON.stringify((v || []).map((r) => [r.department || "", r.program || "", r.specialization || ""]));

  useEffect(() => onSnapshot(collection(db, "coordinators"),
    (s) => setCoordinators(s.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)))),
    (e) => console.error("coordinators:", e)), []);

  useEffect(() => onSnapshot(
    query(collection(db, "coordinatorInvites"), where("fromUid", "==", admin.uid), where("status", "==", "pending")),
    (s) => setInvites(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v) => v.type !== "admin")),   // admin invitations live in Account Profile, not here
    (e) => console.error("invites:", e)), [admin.uid]);

  const call = async (name, payload) => {
    setError("");
    try { return await httpsCallable(functions, name)(payload); }
    catch (e) { console.error(e); setError(e?.message || "Something went wrong. Please try again."); return null; }
  };

  const invite = async () => {
    const to = email.trim().toLowerCase();
    if (!EMAIL_RE.test(to)) { setError("Enter a valid email address."); return; }
    if (sel.some((r) => !r.department)) { setError("Choose a department for every row."); return; }
    if (!(await confirm({
      title: "Send invitation",
      body: `Are you sure you want to invite ${to} as a coordinator for ${sel.map(describeSel).join("; ")}?`,
      confirmLabel: "Send invitation",
    }))) return;
    setBusy(true);
    const res = await call("adminInviteCoordinator", { email: to, deptSelections: sel });
    setBusy(false);
    if (res) { flash(`Invitation sent to ${to}. They set their own name and password from the email link.`); setEmail(""); setSel(emptySel()); setShowInvite(false); }
  };

  const saveDepts = async (uid) => {
    if (editSel.some((r) => !r.department)) { setError("Choose a department for every row."); return; }
    const who = coordinators.find((c) => c.uid === uid);
    if (!(await confirm({
      title: "Save changes",
      body: `Are you sure you want to save the department changes for ${who?.name || who?.email || "this coordinator"}?`,
      confirmLabel: "Save",
    }))) return;
    setBusy(true);
    const res = await call("adminSetCoordinatorDepartments", { uid, deptSelections: editSel });
    setBusy(false);
    if (res) { flash("Coordinator department updated."); setManagingKey(null); }
  };

  // Gives this coordinator admin access with the SAME login. They keep their coordinator account and can
  // switch dashboards from the top bar.
  const promoteToAdmin = async (c) => {
    const who = c.name || c.email || "this coordinator";
    if (!(await confirm({
      title: "Promote to admin",
      body: `Are you sure you want to give ${who} admin access? They keep their coordinator account and sign in with the same email and password. Admins can manage departments and every coordinator.`,
      confirmLabel: "Promote to admin",
    }))) return;
    setBusy(true);
    const res = await call("adminPromoteCoordinator", { uid: c.uid });
    setBusy(false);
    if (res) {
      setAdminUids((prev) => new Set(prev).add(c.uid));
      flash(res.data?.alreadyAdmin ? `${who} is already an admin.` : `${who} is now an admin. They can switch dashboards from the top bar.`);
    }
  };

  const resendInvite = async (v) => {
    if (!(await confirm({ title: "Resend invitation", body: `Are you sure you want to send the invitation to ${v.toEmail} again? The earlier link will stop working.`, confirmLabel: "Resend" }))) return;
    setBusy(true);
    const res = await call("adminInviteCoordinator", { email: v.toEmail, deptSelections: v.deptSelections || [] });
    setBusy(false);
    if (res) flash(`Invitation sent again to ${v.toEmail}. The earlier link no longer works.`);
  };

  const cancelInvite = async (id) => {
    const inv = invites.find((v) => v.id === id);
    if (!(await confirm({
      title: "Cancel invitation",
      body: `Are you sure you want to cancel the invitation${inv?.toEmail ? ` sent to ${inv.toEmail}` : ""}? Their link will stop working.`,
      confirmLabel: "Cancel invitation", cancelLabel: "Keep it", tone: "danger",
    }))) return;
    setError("");
    try { await updateDoc(doc(db, "coordinatorInvites", id), { status: "cancelled" }); flash("Invitation cancelled."); setManagingKey(null); }
    catch (e) { console.error(e); setError("Could not cancel the invitation."); }
  };

  // One list: pending invitations first (they need action), then the coordinators.
  const rows = useMemo(() => [
    ...invites.map((v) => ({ key: `i:${v.id}`, kind: "invite", name: "", email: v.toEmail || "", status: "pending", sels: v.deptSelections || [], ref: v })),
    ...coordinators.map((c) => ({ key: `c:${c.uid}`, kind: "coord", name: c.name || "", email: c.email || "", status: c.status || "", sels: c.deptSelections || [], ref: c })),
  ], [invites, coordinators]);

  // Search is by coordinator name only. Department / Program / Major are chosen in the filter, and the
  // options come straight from the live departments list, so new departments, programs and majors show up on their own.
  const q = norm(search).toLowerCase();
  const hasFilter = !!(filters.department || filters.program || filters.major);
  const filterDept = depts.find((d) => d.name === filters.department) || null;
  const filterPrograms = filterDept ? programsOf(filterDept) : [];
  const filterMajors = filterPrograms.find((p) => p.name === filters.program)?.specializations || [];
  const sortedDepts = useMemo(() => [...depts].sort((a, b) => a.name.localeCompare(b.name)), [depts]);
  // A selection with no program (or no major) means "all of them", so it also matches a specific program / major.
  const matchesFilter = (r) => !hasFilter || r.sels.some((raw) => {
    const s = normSel(raw);
    const deptOk = !filters.department || same(s.department, filters.department) || (!!filterDept?.abbr && same(s.department, filterDept.abbr));
    const progOk = !filters.program || !s.program || same(s.program, filters.program);
    const majorOk = !filters.major || !s.specialization || same(s.specialization, filters.major);
    return deptOk && progOk && majorOk;
  });
  const filtered = useMemo(() => rows.filter((r) => (!q || String(r.name || "").toLowerCase().includes(q)) && matchesFilter(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, q, filters, depts]);
  const setFilter = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const clearFilters = () => { setFilters({ department: "", program: "", major: "" }); setPage(1); };
  const filterChip = (on) => ({ padding: "5px 12px", borderRadius: "999px", fontFamily: uiFont, fontSize: "0.78rem", cursor: "pointer", userSelect: "none", textAlign: "left", background: on ? ink : paperCard, color: on ? paper : inkText, border: `1px solid ${on ? ink : hairline}` });
  const filterLabel = { fontFamily: uiFont, fontSize: "0.8rem", fontWeight: 700, color: inkText, margin: "0 0 8px" };
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(safePage * PAGE_SIZE, filtered.length);

  const managing = managingKey ? rows.find((r) => r.key === managingKey) : null;
  const modalOpen = showInvite || !!managing;
  const dirty = managing?.kind === "coord" && selSig(editSel) !== selSig(initialSel(managing.ref));

  const openInvite = () => { setError(""); setEmail(""); setSel(emptySel()); setShowInvite(true); };
  const closeInvite = async () => {
    if ((email || sel.some((r) => r.department))
      && !(await confirm({ title: "Cancel", body: "Are you sure you want to cancel? What you entered will be discarded.", confirmLabel: "Discard", cancelLabel: "Keep editing", tone: "danger" }))) return;
    setShowInvite(false); setError("");
  };
  const openManage = (r) => { setError(""); setEditSel(r.kind === "coord" ? initialSel(r.ref) : emptySel()); setManagingKey(r.key); };
  const closeManage = async () => {
    // Only ask when something was actually changed; nothing to lose otherwise.
    if (dirty && !(await confirm({ title: "Cancel changes", body: "Are you sure you want to cancel? Your changes will be discarded.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" }))) return;
    setManagingKey(null); setError("");
  };

  const errorBox = error ? <div role="alert" style={S.err}>{error}</div> : null;
  const nameOf = (r) => r.name || (r.kind === "invite" ? "Awaiting sign-up" : "(name not set yet)");
  const deptCell = (r) => {
    if (r.sels.length === 0) return <span style={{ fontSize: "0.82rem", color: C.danger }}>No department assigned</span>;
    const more = r.sels.length - 1;
    return (
      <span title={r.sels.map(describeSel).join("\n")} style={{ fontSize: "0.88rem" }}>
        {describeSel(r.sels[0])}{more > 0 && <span style={{ color: inkMuted, fontWeight: 600 }}> +{more} more</span>}
      </span>
    );
  };
  const nameBlock = (r) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: "0.95rem", color: inkText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: r.name ? "normal" : "italic" }}>{nameOf(r)}</div>
      <div style={{ fontSize: "0.8rem", color: inkMuted, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email || "—"}</div>
    </div>
  );

  return (
    <div ref={screenRef} style={{ display: "flex", flexDirection: "column", height: fitH ? `${fitH}px` : undefined }}>
      {confirmDialog}
      <div style={tabHeadStyle}>
      {!modalOpen && errorBox}
      {/* Floating dark header bar: same shape as Student Accounts / Departments */}
      <div className="dp-bar">
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <span style={{ fontFamily: uiFont, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: paper, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Manage Coordinators</span>
          <p style={{ fontFamily: uiFont, fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filtered.length} of {rows.length} · {coordinators.length} coordinator{coordinators.length !== 1 ? "s" : ""}, {invites.length} pending invitation{invites.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <div className="dp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={search} name="mc-search" autoComplete="off" spellCheck={false} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search coordinator name" />
            {search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }} style={{ background: "none", border: "none", color: inkMuted, cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>}
          </div>
          <div ref={filterRef} data-tour="filter" style={{ position: "relative" }}>
            <button type="button" title="Filters" aria-label="Filters" aria-expanded={showFilter} onClick={() => setShowFilter((v) => !v)}
              style={{ width: "40px", height: "40px", borderRadius: "999px", border: hasFilter ? `2px solid ${paperCard}` : "none", background: hasFilter ? paperCard : paper, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? ink : inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            </button>
            {showFilter && (
              <div style={{ position: "absolute", top: "48px", right: 0, width: "min(300px, 80vw)", maxHeight: "min(70vh, 520px)", overflowY: "auto", background: paper, border: `1px solid ${hairline}`, borderRadius: "16px", boxShadow: "0 12px 32px rgba(0,0,0,0.22)", zIndex: 100, padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontFamily: uiFont, fontSize: "1rem", fontWeight: 700, color: inkText }}>Filters</span>
                  <button type="button" onClick={clearFilters} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: uiFont, fontSize: "0.8rem", color: inkMuted, textDecoration: "underline" }}>Clear all</button>
                </div>

                <p style={filterLabel}>Department</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                  {sortedDepts.length === 0 && <span style={{ fontSize: "0.78rem", color: inkMuted }}>No departments yet</span>}
                  {sortedDepts.map((d) => (
                    <button key={d.id} type="button" title={d.name} style={filterChip(filters.department === d.name)}
                      onClick={() => setFilter({ department: filters.department === d.name ? "" : d.name, program: "", major: "" })}>{d.abbr || d.name}</button>
                  ))}
                </div>

                {filterDept && (
                  <>
                    <hr style={{ border: "none", borderTop: `1px solid ${hairline}`, margin: "0 0 12px" }} />
                    <p style={filterLabel}>Program</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                      {filterPrograms.map((pr) => (
                        <button key={pr.name} type="button" style={filterChip(filters.program === pr.name)}
                          onClick={() => setFilter({ program: filters.program === pr.name ? "" : pr.name, major: "" })}>{pr.name}</button>
                      ))}
                    </div>
                  </>
                )}

                {filters.program && filterMajors.length > 0 && (
                  <>
                    <hr style={{ border: "none", borderTop: `1px solid ${hairline}`, margin: "0 0 12px" }} />
                    <p style={filterLabel}>Major</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {filterMajors.map((m) => (
                        <button key={m} type="button" style={filterChip(filters.major === m)}
                          onClick={() => setFilter({ major: filters.major === m ? "" : m })}>{m}</button>
                      ))}
                    </div>
                  </>
                )}

                {!filterDept && <p style={{ fontFamily: uiFont, fontSize: "0.76rem", color: inkMuted, margin: 0 }}>Pick a department to filter by its programs and majors.</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {hasFilter && (
            <>
              {[
                filters.department && { label: filterDept?.abbr || filters.department, clear: () => setFilter({ department: "", program: "", major: "" }) },
                filters.program && { label: filters.program, clear: () => setFilter({ program: "", major: "" }) },
                filters.major && { label: filters.major, clear: () => setFilter({ major: "" }) },
              ].filter(Boolean).map(({ label, clear }) => (
                <span key={label} style={{ background: paper, color: inkText, border: `1px solid ${hairline}`, borderRadius: "999px", padding: "4px 12px", fontFamily: uiFont, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  {label}<span role="button" aria-label={`Remove filter ${label}`} onClick={clear} style={{ cursor: "pointer", color: inkMuted }}>✕</span>
                </span>
              ))}
              <button type="button" onClick={clearFilters} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: uiFont, fontSize: "0.78rem", color: inkMuted, textDecoration: "underline" }}>Clear all</button>
            </>
          )}
        </div>
        <button type="button" data-tour="invite" className="adm-btn-dark" style={S.btn} onClick={openInvite}>Invite a coordinator</button>
      </div>

      </div>

      <div ref={scrollRef} style={tabScrollStyle}>
      {/* List */}
      {pageRows.length > 0 ? (
        <>
          {/* Desktop: table */}
          <div className="mc-wrap">
            <table className="mc-table">
              <thead>
                <tr>{["Name", "Department", "Status", "Action"].map((h) => <th key={h} className="mc-th">{h}</th>)}</tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.key}>
                    <td className="mc-td" style={{ maxWidth: "340px" }}>{nameBlock(r)}</td>
                    <td className="mc-td">{deptCell(r)}</td>
                    <td className="mc-td">{statusBadge(r.status)}</td>
                    <td className="mc-td"><button type="button" className="adm-btn-light" style={S.btn2} onClick={() => openManage(r)}>Manage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="mc-cards">
            {pageRows.map((r) => (
              <div key={r.key} className="mc-card">
                {nameBlock(r)}
                <div>
                  <p className="mc-card-label">Department</p>
                  {deptCell(r)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", paddingTop: "8px", borderTop: `1px solid ${hairline}` }}>
                  {statusBadge(r.status)}
                  <button type="button" className="adm-btn-light" style={S.btn2} onClick={() => openManage(r)}>Manage</button>
                </div>
              </div>
            ))}
          </div>

          <PaginationBar page={safePage} totalPages={totalPages} onPage={goToPage} from={showingFrom} to={showingTo} total={filtered.length} />
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "72px 24px", gap: "4px", background: paper, border: `1px dashed ${hairline}`, borderRadius: "20px" }}>
          <p style={{ fontFamily: uiFont, fontSize: "1.0625rem", fontWeight: 600, color: inkText, margin: 0 }}>{rows.length === 0 ? "No coordinators yet" : "No coordinators match this search"}</p>
          <p style={{ fontFamily: uiFont, fontSize: "0.82rem", color: inkMuted, margin: 0, maxWidth: "44ch" }}>
            {rows.length === 0 ? "Use Invite a coordinator to send the first invitation." : "Try a different name, or clear a filter."}
          </p>
        </div>
      )}
      </div>

      {/* ── Invite a coordinator (pop-up form) ── */}
      {showInvite && (
        <DeptModal help="coord-invite" title="Invite a coordinator" onClose={closeInvite}
          footer={(
            <>
              <button type="button" style={S.btn2} disabled={busy} onClick={closeInvite}>Cancel</button>
              <button type="button" style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={invite}>{busy ? "Sending…" : "Send invitation"}</button>
            </>
          )}>
          <p style={S.help}>
            Pick the department (and optionally the program/major) they will handle. They receive an email link and set their own
            name and password — no password is ever shared. Works for brand-new departments too.
          </p>
          <label style={S.label}>Email address<Req /></label>
          <input style={S.input} type="email" name="invite-email" autoComplete="off" value={email} placeholder="name@school.edu.ph" onChange={(e) => setEmail(e.target.value)} />
          <div data-tour="invite-depts" style={{ marginTop: "6px" }}><DeptSelectionsEditor depts={depts} value={sel} onChange={setSel} /></div>
          {errorBox}
        </DeptModal>
      )}

      {/* ── Manage: summary + departments (pop-up) ── */}
      {managing && (
        <DeptModal help={managing.kind === "invite" ? "coord-invite-pending" : "coord-manage"} title={managing.kind === "invite" ? "Pending invitation" : "Coordinator"} onClose={closeManage}
          footer={managing.kind === "coord" ? (
            <>
              <button type="button" style={S.btn2} disabled={busy} onClick={closeManage}>Cancel</button>
              <button type="button" style={{ ...S.btn, opacity: busy || !dirty ? 0.5 : 1 }} disabled={busy || !dirty} onClick={() => saveDepts(managing.ref.uid)}>{busy ? "Saving…" : "Save changes"}</button>
            </>
          ) : (
            <>
              <button type="button" style={{ ...S.btn2, color: C.danger, borderColor: C.danger }} disabled={busy} onClick={() => cancelInvite(managing.ref.id)}>Cancel invitation</button>
              <button type="button" style={S.btn2} disabled={busy} onClick={() => resendInvite(managing.ref)}>Resend</button>
              <button type="button" style={S.btn} onClick={closeManage}>Close</button>
            </>
          )}>
          <InfoRow label="Name">{managing.name || <span style={{ color: inkMuted }}>{managing.kind === "invite" ? "Not signed up yet" : "(name not set yet)"}</span>}</InfoRow>
          <InfoRow label="Email">{managing.email || "—"}</InfoRow>
          <InfoRow label="Status">{statusBadge(managing.status)}</InfoRow>
          {managing.kind === "coord" && (
            <InfoRow label="Admin access">
              {adminUids.has(managing.ref.uid)
                ? <span style={S.chip}>Admin</span>
                : <button type="button" data-tour="promote" className="adm-btn-light" style={S.btn2} disabled={busy} onClick={() => promoteToAdmin(managing.ref)}>Promote to Admin</button>}
            </InfoRow>
          )}
          {managing.kind === "invite" && managing.ref.createdAt?.toMillis && <InfoRow label="Invitation sent">{timeAgo(managing.ref.createdAt.toMillis())}</InfoRow>}
          {managing.kind === "invite" ? (
            <InfoRow label="Department">
              {managing.sels.length === 0 ? <span style={{ color: C.danger }}>No department assigned</span> : managing.sels.map((s, i) => <span key={i} style={S.chip}>{describeSel(s)}</span>)}
            </InfoRow>
          ) : (
            <div style={{ borderTop: `1px solid ${hairline}`, paddingTop: "12px" }}>
              <span style={{ fontFamily: FONT, fontSize: "0.82rem", fontWeight: 600, color: inkMuted }}>Departments</span>
              <div data-tour="manage-depts" style={{ marginTop: "6px" }}><DeptSelectionsEditor depts={depts} value={editSel} onChange={setEditSel} /></div>
            </div>
          )}
          {errorBox}
        </DeptModal>
      )}
    </div>
  );
};

// ═══════════════════════════ Notifications ═══════════════════════════
// Reads notifications/{id} where recipientId == the admin's uid (firestore.rules already allows the
// recipient to read and update their own). Written by Cloud Functions:
//   • "<name> (<email>) accepted your invitation…"          acceptCoordinatorInvite
//   • "<name> completed their account setup (<department>)"  adminNotifySetupCompleted
//   • "The invitation sent to <email> hasn't been accepted after 7 days."  adminStaleInviteReminders
// Opening the bell shows them; closing it marks them read.
const NOTIF_TITLES = {
  coordinator_invite_accepted: "Invitation accepted",   // written by acceptCoordinatorInvite
  coordinator_setup_completed: "Setup completed",       // adminNotifySetupCompleted (first-login profile finished)
  coordinator_invite_stale:    "Invitation pending",    // adminStaleInviteReminders (7 days without a response)
};

const NotificationBell = ({ items, open, onToggle, onSelect }) => {
  const { isMobile, isTablet } = useBreakpoint();
  const unread = items.filter((n) => n.unread).length;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ cursor: "pointer", padding: "8px", position: "relative" }} onClick={onToggle} aria-label="Notifications" role="button">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{ position: "absolute", top: "4px", right: "4px", background: paper, color: ink, borderRadius: "50%", minWidth: "16px", height: "16px", fontSize: "0.65rem", fontFamily: uiFont, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>
      {open && (
        <>
          <div onClick={onToggle} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
          <div style={(isMobile || isTablet) ? {
            position: "fixed", top: "76px", right: "12px", width: "min(320px, 88vw)", maxHeight: "min(45vh, 320px)", overflowY: "auto",
            background: paper, border: `1px solid ${ink}`, borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 999,
          } : {
            position: "absolute", top: "50px", right: 0, width: "340px", maxWidth: "88vw", background: paper, borderRadius: "16px", overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,0.28)", border: `1px solid ${hairline}`, zIndex: 999,
          }}>
            <div style={{ padding: "16px 18px 12px", background: paper }}>
              <span style={{ fontFamily: uiFont, fontWeight: 700, fontSize: "1.05rem", color: inkText }}>Notifications</span>
            </div>
            <div style={{ maxHeight: "380px", overflowY: "auto" }}>
              {items.length === 0 ? (
                <div style={{ padding: "28px 16px", textAlign: "center" }}>
                  <span style={{ fontFamily: uiFont, fontSize: "0.85rem", color: inkMuted }}>No notifications yet.</span>
                </div>
              ) : items.map((n) => (
                <div key={n.id} onClick={() => onSelect(n)}
                  style={{ padding: "14px 18px", borderTop: `1px solid ${hairline}`, cursor: "pointer", background: n.unread ? paperCard : paper }}>
                  {NOTIF_TITLES[n.type] && (
                    <p style={{ fontFamily: uiFont, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: inkMuted, margin: "0 0 4px" }}>{NOTIF_TITLES[n.type]}</p>
                  )}
                  <p style={{ fontFamily: uiFont, fontSize: "0.85rem", fontWeight: 500, color: inkText, lineHeight: 1.4, margin: "0 0 5px" }}>{n.message}</p>
                  <p style={{ fontFamily: uiFont, fontSize: "0.75rem", color: inkMuted, margin: 0 }}>{timeAgo(n.time)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════ Account Profile ═══════════════════════════
const PasswordChecklist = ({ password }) => {
  if (!password) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", margin: "8px 0 4px 2px" }}>
      {PASSWORD_RULES.map((r) => {
        const pass = r.test(password);
        return (
          <span key={r.key} style={{ fontFamily: FONT, fontSize: "0.76rem", color: pass ? C.ok : inkMuted }}>
            {pass ? "✓" : "○"} {r.label}
          </span>
        );
      })}
    </div>
  );
};

// Re-checks the password before anything sensitive (profile edit, password change). The fresh
// sign-in is also what the server-side "recent login" check on adminUpdateProfile looks at.
const reauthenticate = async (password) => {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Please sign in again.");
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } catch (e) {
    if (e?.code === "auth/too-many-requests") throw new Error("Too many attempts. Please wait a moment and try again.");
    throw new Error("Your current password is incorrect.");
  }
  await user.getIdToken(true);
};

const InfoRow = ({ label, children }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", padding: "12px 0", borderTop: `1px solid ${hairline}` }}>
    <span style={{ flex: "0 0 160px", fontFamily: FONT, fontSize: "0.82rem", fontWeight: 600, color: inkMuted }}>{label}</span>
    <div style={{ flex: "1 1 220px", minWidth: 0, fontFamily: FONT, fontSize: "0.92rem", color: inkText, overflowWrap: "anywhere" }}>{children}</div>
  </div>
);
const FieldError = ({ children }) => (children ? <p style={{ fontFamily: FONT, fontSize: "0.78rem", color: C.danger, margin: "4px 0 0" }}>{children}</p> : null);

// Maps the errors from changing the sign-in email to something readable.
const emailChangeMessage = (err) => {
  const code = err?.code || "";
  if (code === "auth/email-already-in-use") return "That email is already used by another OJTern account.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/requires-recent-login") return "Please enter your current password again.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
  return err?.message || "Could not send the verification link. Please try again.";
};

// ??? Administrator accounts: Add account / Transfer account ???
// Add: invites another administrator (full access). Transfer: hands THIS administrator role to someone
// else; you keep access until they sign in for the first time, so a mistyped email can never lock the
// system out. No password is shared. Both: the new person gets an "Accept Invitation" email and types their own name + password on that page.
// Server side: functions/adminFunctions.js (adminAddAdmin, adminTransferAdmin, adminCancelTransfer,
// adminCompleteTransfer).
// Pop-up shell + inputs for the Account Profile forms.
const ApModal = ({ title, sub, onClose, footer, children, help }) => {
  useHelpTopic(help);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="ap-overlay">
      <div role="dialog" aria-modal="true" aria-label={title} className="ap-modal">
        <div className="ap-modal-body">
          <h2 className="ap-modal-title">{title}</h2>
          {sub && <p className="ap-modal-sub">{sub}</p>}
          {children}
        </div>
        <div className="ap-modal-footer">{footer}</div>
      </div>
    </div>
  );
};
const ApInput = ({ label, ...rest }) => (
  <>
    <label className="ap-label">{label}<Req /></label>
    <input className="ap-input" {...rest} />
  </>
);
const ApPassword = ({ label, ...rest }) => {
  const [show, setShow] = useState(false);
  return (
    <>
      <label className="ap-label">{label}<Req /></label>
      <div className="ap-field">
        <input className="ap-input" type={show ? "text" : "password"} {...rest} />
        <button type="button" className="ap-eye" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {show
              ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
              : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>}
          </svg>
        </button>
      </div>
    </>
  );
};

const AdminAccountModal = ({ mode, pending, onChanged, flash, confirm, onClose }) => {   // mode: "add" | "transfer"
  const [form, setForm] = useState({ email: "", password: "" });
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState([]);   // added admins who have not signed in yet (add mode)

  const loadWaiting = async () => {
    if (mode !== "add") return;
    try { const r = await httpsCallable(functions, "adminListPendingAdmins")(); setWaiting(r?.data?.pending || []); }
    catch (e) { console.error(e); }
  };
  useEffect(() => { loadWaiting(); }, [mode]);   // eslint-disable-line react-hooks/exhaustive-deps

  const cancelAdded = async (w) => {
    if (!(await confirm({ title: "Cancel invitation", body: `Are you sure you want to cancel the invitation sent to ${w.email}? Their link will stop working and the email can be used again.`, confirmLabel: "Cancel invitation", cancelLabel: "Keep it", tone: "danger" }))) return;
    setBusy(true); setError("");
    try {
      await httpsCallable(functions, "adminCancelAddedAdmin")({ uid: w.uid });
      flash("Invitation cancelled.");
      await loadWaiting();
    } catch (err) {
      setError(err?.message || "Could not cancel the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    // Asking only when something was typed: nothing to lose otherwise.
    if (!info && (form.email || form.password)
      && !(await confirm({ title: "Cancel", body: "Are you sure you want to cancel? What you entered will be discarded.", confirmLabel: "Discard", cancelLabel: "Keep editing", tone: "danger" }))) return;
    onClose();
  };

  const submit = async () => {
    setError(""); setInfo("");
    const email = norm(form.email).toLowerCase();
    if (!EMAIL_RE.test(email)) { setError("Enter a valid email address."); return; }
    if (email === norm(auth.currentUser?.email).toLowerCase()) { setError("That is your own email. Enter the other person's email."); return; }
    if (!form.password) { setError("Enter your current password to confirm."); return; }
    if (mode === "transfer" && !ack) { setError("Tick the box to confirm you understand."); return; }
    if (!(await confirm(mode === "add"
      ? { title: "Add administrator", body: `Are you sure you want to add ${email} as an administrator? They will have full administrator access.`, confirmLabel: "Add account" }
      : { title: "Transfer account", body: `Are you sure you want to transfer your administrator role to ${email}? Your access ends once they accept the invitation and sign in for the first time.`, confirmLabel: "Start transfer", tone: "danger" }))) return;
    setBusy(true);
    try {
      await reauthenticate(form.password);
      const res = await httpsCallable(functions, mode === "add" ? "adminAddAdmin" : "adminTransferAdmin")({ email });
      const mailed = res?.data?.mailed !== false;
      const promoted = res?.data?.promoted === true;   // the email was an existing coordinator: same login, now also an admin
      const done = mode === "add" ? (promoted ? "Administrator access given." : "Invitation sent.") : "Transfer started.";
      onChanged();
      loadWaiting();
      flash(done);
      setInfo(promoted && mode === "transfer"
        ? `${email} is an existing coordinator, so the transfer uses the login they already have. Your access ends once they sign in to the administrator page.${mailed ? "" : " We couldn’t send them the notice email, so please tell them yourself."}`
        : promoted
        ? `${email} is an existing coordinator, so they now also have administrator access. They sign in with the email and password they already use.${mailed ? "" : " We couldn’t send them the notice email, so please tell them yourself."}`
        : mailed
        ? (mode === "add"
          ? `We emailed ${email} an invitation. They click Accept Invitation, enter their name and choose a password, and then they can sign in.`
          : `We emailed ${email} an invitation. They click Accept Invitation, enter their name and choose a password, and then sign in. Your access ends once they sign in for the first time.`)
        : `The account was created, but we couldn’t send the email. Ask ${email} to use “Forgot password” on the sign-in page.`);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const cancelTransfer = async () => {
    if (!(await confirm({ title: "Cancel transfer", body: `Are you sure you want to cancel the transfer${pending?.email ? ` to ${pending.email}` : ""}? Their invitation link will stop working, or their account will be switched off if they already accepted but haven't signed in yet.`, confirmLabel: "Cancel transfer", cancelLabel: "Keep it", tone: "danger" }))) return;
    setBusy(true); setError("");
    try {
      await httpsCallable(functions, "adminCancelTransfer")();
      onChanged();
      flash("Transfer cancelled.");
      onClose();
    } catch (err) {
      setError(err?.message || "Could not cancel the transfer.");
    } finally {
      setBusy(false);
    }
  };

  const transferPending = mode === "transfer" && !!pending;
  const showForm = !info && !transferPending;
  return (
    <ApModal help={mode === "add" ? "profile-admin-add" : "profile-admin-transfer"} title={mode === "add" ? "Add administrator account" : "Transfer administrator account"} onClose={close}
      sub={mode === "add"
        ? "They get an email with an Accept Invitation button, then enter their own name and password. Nothing is shared."
        : "They get an email with an Accept Invitation button, then enter their own name and password. You keep access until they sign in once. After that your account is switched off and you are signed out."}
      footer={showForm ? (
        <>
          <button type="button" className="ap-fbtn ghost" disabled={busy} onClick={close}>Cancel</button>
          <button type="button" className="ap-fbtn solid" disabled={busy} onClick={submit}>
            {busy ? "Working…" : mode === "add" ? "Send invitation" : "Start transfer"}
          </button>
        </>
      ) : <button type="button" className="ap-fbtn solid" onClick={onClose}>Close</button>}>
      {transferPending && (
        <div role="status" style={{ ...S.okMsg, margin: "16px 0 14px" }}>
          Transfer to <strong>{pending.email || "the new administrator"}</strong> is pending. You keep full access until they accept the invitation and sign in for the first time; then your account is switched off.
          <div style={{ marginTop: "10px" }}>
            <button type="button" className="adm-btn-light" style={{ ...S.btn2, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={cancelTransfer}>Cancel transfer</button>
          </div>
        </div>
      )}
      {error && transferPending && <div role="alert" style={S.err}>{error}</div>}
      {mode === "add" && waiting.length > 0 && (
        <div style={{ marginTop: "18px", fontFamily: FONT, fontSize: "0.85rem" }}>
          <div style={{ fontWeight: 600, marginBottom: "6px" }}>Waiting to accept the invitation</div>
          {waiting.map((w) => (
            <div key={w.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "6px 0" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{w.email}</span>
              <button type="button" className="adm-btn-light" style={{ ...S.btn2, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => cancelAdded(w)}>Cancel invitation</button>
            </div>
          ))}
          {error && <div role="alert" style={S.err}>{error}</div>}
        </div>
      )}
      {info && <div role="status" style={{ ...S.okMsg, margin: "16px 0 14px" }}>{info}</div>}
      {showForm && (
        <div>
          <ApInput label="Email" type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <ApPassword label="Your current password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {mode === "transfer" && (
            <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "18px", fontFamily: FONT, fontSize: "0.85rem" }}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: "3px" }} />
              <span>I understand my administrator access will end once they sign in.</span>
            </label>
          )}
          {error && <div role="alert" style={S.err}>{error}</div>}
        </div>
      )}
    </ApModal>
  );
};

// ── Terms & Conditions / Privacy Policy: same reading layout as the coordinator's Account Profile ──
// (header bar, progress line, "On this page" rail, sectioned body). The text itself comes from legalContent.js.
const ApLegalStyles = () => (
  <style>{`
    .ap-legal { display: flex; flex-direction: column; background: ${paperTint}; overflow: hidden; }
    .ap-legal-progress { height: 3px; flex-shrink: 0; background: ${paperCard}; }
    .ap-legal-fill { height: 100%; background: color-mix(in srgb, ${inkDeep} 55%, #ffffff); transition: width 120ms linear; }
    .ap-legal-cols { flex: 1; min-height: 0; display: flex; }
    .ap-legal-toc { width: clamp(130px, 30vw, 240px); flex-shrink: 0; overflow-y: auto; padding: clamp(22px, 3vw, 30px) 0 40px clamp(16px, 3vw, 28px); border-right: 1px solid ${hairline}; }
    .ap-legal-toc-heading { font-family: ${uiFont}; font-size: 0.8125rem; font-weight: 500; color: ${inkMuted}; margin: 0 0 12px; }
    .ap-legal-toc-btn { display: block; width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 7px 0 7px 12px; font-family: ${uiFont}; font-size: 0.8125rem; line-height: 1.45; transition: border-color 160ms ${ease}, color 160ms ${ease}; }
    .ap-legal-toc-btn:hover { color: ${inkText} !important; }
    .ap-legal-scroll { flex: 1; min-width: 0; position: relative; overflow-y: auto; padding: clamp(32px, 4vw, 44px) clamp(16px, 4vw, 44px) 56px; }
    @media (max-width: 480px) {
      .ap-legal-toc { padding-left: 12px; padding-right: 8px; }
      .ap-legal-toc-heading { font-size: 0.75rem; }
      .ap-legal-toc-btn { font-size: 0.75rem; padding: 6px 0 6px 8px; }
    }
    @media (prefers-reduced-motion: reduce) { .ap-legal-fill, .ap-legal-toc-btn { transition: none !important; } }
  `}</style>
);

// Email addresses in the text become Gmail compose links (a plain mailto: does nothing on most machines).
const AP_EMAIL_SPLIT = /([\w.+-]+@[\w-]+\.[\w-]+)/g;
const AP_IS_EMAIL    = /^[\w.+-]+@[\w-]+\.[\w-]+$/;
const apLinkify = (text) =>
  text.split(AP_EMAIL_SPLIT).map((part, i) => (AP_IS_EMAIL.test(part)
    ? <a key={i} href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(part)}`} target="_blank" rel="noopener noreferrer"
        style={{ color: inkText, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" }}>{part}</a>
    : part));

// legalContent.js text -> { meta: [...], sections: [{ title, blocks: [{ type: "p" | "h3" | "ul", ... }] }] }.
// Lines that start with "- " (or a bullet) are list items, whichever way the text was written.
const buildLegalSections = (raw) => {
  const meta = [];
  const sections = [];
  let cur = null;
  for (const b of parseLegalDoc(raw)) {
    if (b.type === "meta") { meta.push(b.text.replace(/^Version:\s*Version/i, "Version")); continue; }
    if (b.type === "h2") { cur = { title: b.text, blocks: [] }; sections.push(cur); continue; }
    if (!cur) continue;
    const addItems = (items) => {
      const last = cur.blocks[cur.blocks.length - 1];
      if (last && last.type === "ul") last.items.push(...items);
      else cur.blocks.push({ type: "ul", items: [...items] });
    };
    if (b.type === "ul") { addItems(b.items); continue; }
    if (b.type === "p" && /^[-•]\s+/.test(b.text)) { addItems([b.text.replace(/^[-•]\s+/, "")]); continue; }
    cur.blocks.push(b);
  }
  return { meta, sections };
};

const ApLegalPanel = ({ title, raw, onBack }) => {
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const tocRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [height, setHeight] = useState(null);
  const { meta, sections } = useMemo(() => buildLegalSections(raw), [raw]);
  const toc = useMemo(() => sections.map((sec, i) => ({ id: `ap-sec-${i}`, text: sec.title })), [sections]);

  // The panel scrolls inside itself (like the coordinator's), so it takes the rest of the visible area.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const main = el?.closest(".adm-main");
    if (!el || !main) return undefined;
    const fit = () => {
      main.scrollTop = 0;
      const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top;
      setHeight(Math.max(360, main.clientHeight - top));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return undefined;
    const onScroll = () => {
      const max = box.scrollHeight - box.clientHeight;
      setProgress(max > 0 ? Math.min(100, (box.scrollTop / max) * 100) : 0);
      const boxTop = box.getBoundingClientRect().top;
      let current = null;
      box.querySelectorAll("[data-heading]").forEach((h) => {
        if (h.getBoundingClientRect().top - boxTop <= 90) current = h.getAttribute("data-heading");
      });
      if (max > 0 && box.scrollTop >= max - 2 && toc.length > 0) current = toc[toc.length - 1].id;
      if (current) setActiveId(current);

      // Keep the "On this page" rail moving together with the document: its scrollbar follows the
      // reading progress, and the highlighted section is never left outside the rail's view.
      const nav = tocRef.current;
      if (nav) {
        const navMax = nav.scrollHeight - nav.clientHeight;
        if (navMax > 0) nav.scrollTop = (max > 0 ? box.scrollTop / max : 0) * navMax;
        const li = current && document.getElementById(`ap-toc-${current}`);
        if (li && navMax > 0) {
          const nr = nav.getBoundingClientRect(), lr = li.getBoundingClientRect();
          if (lr.top < nr.top + 12) nav.scrollTop -= nr.top + 12 - lr.top;
          else if (lr.bottom > nr.bottom - 12) nav.scrollTop += lr.bottom - (nr.bottom - 12);
        }
      }
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => box.removeEventListener("scroll", onScroll);
  }, [toc, height]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    const box = scrollRef.current;
    if (el && box) box.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
  };

  const body = { fontFamily: uiFont, ...type.body, lineHeight: 1.7, color: color.inkBody, maxWidth: "74ch" };
  return (
    <div ref={rootRef} className="ap-screen ap-legal" style={{ height: height ? `${height}px` : "70vh" }}>
      <ApLegalStyles />
      <div className="ap-sub-header">
        <button type="button" className="ap-back" aria-label="Back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={paper} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span style={{ fontFamily: uiFont, fontSize: "clamp(1.25rem, 4vw, 1.625rem)", fontWeight: 600, letterSpacing: "-0.01em", color: paper }}>{title}</span>
      </div>

      <div className="ap-legal-progress"><div className="ap-legal-fill" style={{ width: `${progress}%` }} /></div>

      <div className="ap-legal-cols">
        {toc.length > 0 && (
          <nav className="ap-legal-toc" aria-label="Sections" ref={tocRef}>
            <p className="ap-legal-toc-heading">On this page</p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
              {toc.map((item) => {
                const on = activeId === item.id;
                return (
                  <li key={item.id} id={`ap-toc-${item.id}`}>
                    <button type="button" className="ap-legal-toc-btn" onClick={() => scrollTo(item.id)}
                      style={{ borderLeft: `2px solid ${on ? inkText : "transparent"}`, color: on ? inkText : inkMuted, fontWeight: on ? 600 : 400 }}>
                      {item.text}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <div className="ap-legal-scroll" ref={scrollRef}>
          <h1 style={{ fontFamily: uiFont, fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 600, letterSpacing: "-0.02em", color: inkText, margin: `0 0 ${space.md}`, lineHeight: 1.2 }}>{title}</h1>
          {meta.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, marginBottom: space.xl }}>
              {meta.map((m) => (
                <span key={m} style={{ fontFamily: uiFont, ...type.helper, fontWeight: 500, color: paper, background: inkDeep, borderRadius: radius.pill, padding: "6px 15px" }}>{m}</span>
              ))}
            </div>
          )}

          {sections.map((sec, idx) => {
            const id = `ap-sec-${idx}`;
            const first = idx === 0;
            return (
              <section key={id}>
                <h2 id={id} data-heading={id}
                  style={{ fontFamily: uiFont, fontSize: "clamp(1.05rem, 3vw, 1.25rem)", fontWeight: 600, letterSpacing: "-0.01em", color: inkText,
                    margin: first ? `0 0 ${space.sm}` : `${space.xl} 0 ${space.sm}`, paddingTop: first ? 0 : space.lg,
                    borderTop: first ? "none" : `1px solid ${hairline}`, scrollMarginTop: space.lg }}>
                  {sec.title}
                </h2>
                {sec.blocks.map((b, i) => {
                  if (b.type === "h3") {
                    return <h3 key={i} style={{ fontFamily: uiFont, fontSize: "clamp(0.95rem, 2.6vw, 1.05rem)", fontWeight: 600, color: inkText, margin: `${space.lg} 0 ${space.xs}` }}>{b.text}</h3>;
                  }
                  if (b.type === "ul") {
                    return (
                      <ul key={i} style={{ margin: `8px 0 ${space.md}`, paddingLeft: "22px" }}>
                        {b.items.map((it, j) => <li key={j} style={{ ...body, marginBottom: "5px" }}>{apLinkify(it)}</li>)}
                      </ul>
                    );
                  }
                  return <p key={i} style={{ ...body, margin: `0 0 ${space.md}` }}>{apLinkify(b.text)}</p>;
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Sizes a screen to the visible area under the top bar, so only its inner part scrolls (like the coordinator's).
const useFillHeight = (ref, dep, observe = false) => {
  const [h, setH] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const main = el?.closest(".adm-main");
    if (!el || !main) return undefined;
    const fit = () => {
      main.scrollTop = 0;
      const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top;
      const bottomPad = parseFloat(getComputedStyle(el.parentElement).paddingBottom) || 0;
      setH(Math.max(360, main.clientHeight - top - bottomPad));
    };
    fit();
    window.addEventListener("resize", fit);
    // A notice appearing above the screen moves it down: measure again.
    const ro = observe && typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(el.parentElement);
    return () => { window.removeEventListener("resize", fit); if (ro) ro.disconnect(); };
  }, [dep]); // eslint-disable-line react-hooks/exhaustive-deps
  return h;
};

const AccountProfile = ({ admin, flash }) => {
  const [name, setName] = useState(admin.name || "");
  const [loadError, setLoadError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [emailForm, setEmailForm] = useState({ email: "", password: "" });
  const [emailError, setEmailError] = useState("");
  const [emailInfo, setEmailInfo] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailStep, setEmailStep] = useState("form");   // form | code
  const [emailCode, setEmailCode] = useState("");

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pending, setPending] = useState(null);   // { email } while a transfer of this account is pending
  const [confirm, confirmDialog] = useConfirm();
  const [view, setView] = useState("main");   // main | personal | terms | privacy
  const screenRef = useRef(null);
  const fitH = useFillHeight(screenRef, view);
  const [modal, setModal] = useState(null);      // null | email | password | add | transfer
  useHelpTopic(view === "main" ? null : `profile-${view}`);   // personal | terms | privacy get their own guide

  const loadName = async () => {
    try {
      const snap = await getDoc(doc(db, "admins", admin.uid));
      const d = snap.data() || {};
      setName(d.name || "");
      setPending(d.transferPendingTo || d.transferPendingInvite ? { email: d.transferPendingEmail || "" } : null);
      setLoadError("");
    } catch (e) {
      console.error(e);
      setLoadError("Could not load your profile.");
    }
  };
  useEffect(() => { loadName(); }, [admin.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveName = async () => {
    if (!norm(nameDraft)) { setNameError("Name is required."); return; }
    if (!(await confirm({ title: "Save changes", body: `Are you sure you want to save "${norm(nameDraft)}" as your name?`, confirmLabel: "Save" }))) return;
    setSavingName(true); setNameError("");
    try {
      await httpsCallable(functions, "adminUpdateProfile")({ name: norm(nameDraft) });
      await loadName();
      setEditingName(false);
      flash("Name updated.");
    } catch (err) {
      setNameError(err?.message || "Could not save your name.");
    } finally {
      setSavingName(false);
    }
  };

  // The email you type here becomes your sign-in email AND the address password reset links go to.
  // Step 1 mails a 6-digit code to the NEW address (server: adminSendRecoveryCode). Step 2 checks the
  // code and switches the Firebase Auth email + admins/{uid}.email + recoveryEmail together
  // (server: adminConfirmRecoveryCode), so login, "Forgot password" and this screen all use the same email.
  const submitEmail = async () => {
    setEmailError(""); setEmailInfo("");
    const next = norm(emailForm.email).toLowerCase();
    if (!EMAIL_RE.test(next)) { setEmailError("Enter a valid email address."); return; }
    if (next === norm(admin.email).toLowerCase()) { setEmailError("That is already your sign-in email."); return; }
    if (!emailForm.password) { setEmailError("Enter your current password to confirm."); return; }
    setEmailBusy(true);
    try {
      await reauthenticate(emailForm.password);
      await httpsCallable(functions, "adminSendRecoveryCode")({ email: next });
      setEmailCode("");
      setEmailStep("code");
      setEmailInfo(`We sent a 6-digit code to ${next}. It expires in 10 minutes.`);
    } catch (err) {
      setEmailError(emailChangeMessage(err));
    } finally {
      setEmailBusy(false);
    }
  };

  const submitEmailCode = async () => {
    setEmailError("");
    const code = norm(emailCode);
    if (!/^\d{6}$/.test(code)) { setEmailError("Enter the 6-digit code."); return; }
    setEmailBusy(true);
    try {
      const res = await httpsCallable(functions, "adminConfirmRecoveryCode")({ code });
      setModal(null);
      setEmailForm({ email: "", password: "" }); setEmailCode(""); setEmailStep("form"); setEmailInfo("");
      if (res?.data?.signInEmailChanged) {
        // The server revoked the old sessions: sign out so they log in again with the new email.
        flash(`Email changed to ${res.data.email}. Please sign in again with it.`);
        setTimeout(() => { signOut(auth).catch(() => {}).finally(() => window.location.replace("/signin")); }, 1800);
      } else {
        flash("Email confirmed.");
      }
    } catch (err) {
      setEmailError(err?.message || "Could not confirm the code. Please try again.");
    } finally {
      setEmailBusy(false);
    }
  };

  const submitPassword = async () => {
    setPwError("");
    if (!pw.current || !pw.next || !pw.confirm) { setPwError("Fill in all the password fields."); return; }
    if (!isPasswordStrong(pw.next)) { setPwError("The new password doesn’t meet all the requirements below."); return; }
    if (pw.next !== pw.confirm) { setPwError("The new password and its confirmation don’t match."); return; }
    if (pw.next === pw.current) { setPwError("The new password must be different from the current one."); return; }
    if (!(await confirm({ title: "Change password", body: "Are you sure you want to change your password?", confirmLabel: "Change password" }))) return;
    setPwBusy(true);
    try {
      await reauthenticate(pw.current);
      await updatePassword(auth.currentUser, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      flash("Password changed.");
      setModal(null);
    } catch (err) {
      setPwError(err?.message || "Could not change the password.");
    } finally {
      setPwBusy(false);
    }
  };

  const openEmail = () => { setEmailForm({ email: "", password: "" }); setEmailCode(""); setEmailStep("form"); setEmailError(""); setEmailInfo(""); setModal("email"); };
  const openPassword = () => { setPw({ current: "", next: "", confirm: "" }); setPwError(""); setModal("password"); };
  const dirty = (modal === "email" && (emailForm.email || emailForm.password || emailCode))
    || (modal === "password" && (pw.current || pw.next || pw.confirm));
  const closeModal = async () => {
    if (dirty && !(await confirm({ title: "Cancel", body: "Are you sure you want to cancel? What you entered will be discarded.", confirmLabel: "Discard", cancelLabel: "Keep editing", tone: "danger" }))) return;
    setModal(null);
  };

  const icons = {
    person:   <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    mail:     <><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></>,
    key:      <><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" /></>,
    addUser:  <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
    shield:   <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>,
    transfer: <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
  };
  const MenuRow = ({ icon, label, onClick }) => (
    <button type="button" className="ap-menu-row" onClick={onClick}>
      <span style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
        <span className="ap-row-icon">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[icon]}</svg>
        </span>
        <span style={{ fontFamily: uiFont, fontSize: "1rem", fontWeight: 500, letterSpacing: "-0.01em", color: inkText }}>{label}</span>
      </span>
      <svg className="ap-go" width="35" height="35" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="17" fill={ink} />
        <path d="M11 18h14M19 12l6 6-6 6" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  // Terms and Privacy open as their own screens, with the text from legalContent.js.
  if (view === "terms")   return <ApLegalPanel title="Terms and conditions" raw={TERMS_TEXT} onBack={() => setView("main")} />;
  if (view === "privacy") return <ApLegalPanel title="Privacy policy" raw={PRIVACY_TEXT} onBack={() => setView("main")} />;

  // Personal Information opens as its own screen; everything else is a pop-up form on top of the menu.
  if (view === "personal") {
    return (
      <div ref={screenRef} className="ap-screen ap-fixed" style={{ height: fitH ? `${fitH}px` : undefined }}>
        {confirmDialog}
        <div className="ap-sub-header">
          <button type="button" className="ap-back" aria-label="Back" onClick={() => { setView("main"); setEditingName(false); setNameError(""); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={paper} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span style={{ fontFamily: uiFont, fontSize: "clamp(1.25rem, 4vw, 1.625rem)", fontWeight: 600, letterSpacing: "-0.01em", color: paper }}>Personal Information</span>
        </div>
        <div className="ap-sub-body">
          {!editingName && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <button type="button" data-tour="pi-edit" className="ap-edit-btn" onClick={() => { setNameDraft(name); setNameError(""); setEditingName(true); }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                Edit
              </button>
            </div>
          )}
          {loadError && <div role="alert" style={S.err}>{loadError}</div>}

          <div className="ap-info-card" data-tour="pi-name">
            <p className="ap-info-label">Name{editingName && <Req />}</p>
            {!editingName ? (
              <p className="ap-info-value">{name || "—"}</p>
            ) : (
              <>
                <input className="ap-name-input" value={nameDraft} maxLength={60} autoFocus onChange={(e) => setNameDraft(e.target.value)} />
                <FieldError>{nameError}</FieldError>
              </>
            )}
          </div>
          <div className="ap-info-card" data-tour="pi-email">
            <p className="ap-info-label">Email address</p>
            <p className="ap-info-value">{admin.email || "—"}</p>
          </div>
          <div className="ap-info-card" data-tour="pi-role">
            <p className="ap-info-label">Role</p>
            <p className="ap-info-value">Administrator</p>
          </div>

          {editingName && (
            <div data-tour="pi-save" style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button type="button" style={S.btn2} disabled={savingName} onClick={async () => {
                if (norm(nameDraft) !== norm(name)
                  && !(await confirm({ title: "Cancel changes", body: "Are you sure you want to cancel? Your changes will be discarded.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" }))) return;
                setEditingName(false);
              }}>Cancel</button>
              <button type="button" style={{ ...S.btn, opacity: savingName ? 0.6 : 1 }} disabled={savingName} onClick={saveName}>{savingName ? "Saving…" : "Save"}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={screenRef} className="ap-screen ap-fixed" style={{ height: fitH ? `${fitH}px` : undefined }}>
      {confirmDialog}

      {/* Dark banner + overlapping profile card (same as the coordinator's Account Profile) */}
      <div className="ap-header-wrap">
        <div className="ap-banner" />
        <div className="ap-header-card">
          <div className="ap-avatar">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={paper} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
          <p style={{ fontFamily: uiFont, fontSize: "clamp(1rem, 4vw, 1.125rem)", fontWeight: 600, letterSpacing: "-0.01em", color: inkText, margin: 0, textAlign: "center" }}>{name || "—"}</p>
        </div>
      </div>

      <div className="ap-divider" />

      <div className="ap-body">
        <div className="ap-group">
          <p className="ap-group-title">Personal Information:</p>
          <MenuRow icon="person" label="Personal Information" onClick={() => setView("personal")} />
        </div>
        <div className="ap-group">
          <p className="ap-group-title">Security:</p>
          <MenuRow icon="mail" label="Change Email" onClick={openEmail} />
          <MenuRow icon="key" label="Change Password" onClick={openPassword} />
        </div>
        <div className="ap-group">
          <p className="ap-group-title">Administrator Accounts:</p>
          <MenuRow icon="addUser" label="Add Account" onClick={() => setModal("add")} />
          <MenuRow icon="transfer" label="Transfer Account" onClick={() => setModal("transfer")} />
        </div>
        <div className="ap-group">
          <p className="ap-group-title">Legal:</p>
          <MenuRow icon="document" label="Terms & Condition" onClick={() => setView("terms")} />
          <MenuRow icon="shield" label="Privacy Policy" onClick={() => setView("privacy")} />
        </div>
      </div>

      {/* ── Pop-up forms ── */}
      {modal === "email" && (
        <ApModal help={emailStep === "form" ? "profile-email" : "profile-email-code"} title="Sign-in email" onClose={closeModal}
          sub="This is the email you sign in with, and where password reset links are sent. We’ll send a 6-digit code to the new address to confirm it’s yours."
          footer={
            <>
              <button type="button" className="ap-fbtn ghost" disabled={emailBusy} onClick={closeModal}>Cancel</button>
              {emailStep === "form"
                ? <button type="button" className="ap-fbtn solid" disabled={emailBusy} onClick={submitEmail}>{emailBusy ? "Sending…" : "Send code"}</button>
                : <button type="button" className="ap-fbtn solid" disabled={emailBusy} onClick={submitEmailCode}>{emailBusy ? "Checking…" : "Confirm"}</button>}
            </>
          }>
          {emailStep === "form" ? (
            <>
              <ApInput label="New email" type="email" autoComplete="off" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} />
              <ApPassword label="Current password" autoComplete="current-password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} />
            </>
          ) : (
            <ApInput label="6-digit code" type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))} />
          )}
          {emailError && <div role="alert" style={S.err}>{emailError}</div>}
          {emailInfo && <div role="status" style={{ ...S.okMsg, margin: "16px 0 0" }}>{emailInfo}</div>}
        </ApModal>
      )}

      {modal === "password" && (
        <ApModal help="profile-password" title="Change password" sub="Enter your current password, then choose a new one." onClose={closeModal}
          footer={(
            <>
              <button type="button" className="ap-fbtn ghost" disabled={pwBusy} onClick={closeModal}>Cancel</button>
              <button type="button" className="ap-fbtn solid" disabled={pwBusy} onClick={submitPassword}>{pwBusy ? "Saving…" : "Change password"}</button>
            </>
          )}>
          <ApPassword label="Current password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <hr className="ap-hr" />
          <ApPassword label="New password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <div data-tour="pw-checklist"><PasswordChecklist password={pw.next} /></div>
          <ApPassword label="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          {pwError && <div role="alert" style={S.err}>{pwError}</div>}
        </ApModal>
      )}

      {(modal === "add" || modal === "transfer") && (
        <AdminAccountModal mode={modal} pending={pending} onChanged={loadName} flash={flash} confirm={confirm} onClose={() => setModal(null)} />
      )}
    </div>
  );
};

// ═══════════════════════════ Help: guided tour + floating "?" button ═══════════════════════════
// Same way of guiding as the Student dashboard: driver.js (dimmed page, highlighted element, a small
// popover with "1 of N", Previous / Next and ✕). Every module has its own tour. It starts by itself the
// first time this admin opens that module (remembered per admin, in this browser), and the floating "?"
// button replays it at any time. No welcome screen: it goes straight to pointing things out.
//
// A step points at an element with a list of CSS selectors; the first match that is actually visible wins,
// so one step can cover both the desktop and the mobile layout. A step whose target is not on screen
// (no rows yet, a sub-page) is left out, so the tour never points at nothing.
const TOUR_TOPBAR = [
  { target: ['[aria-label="Notifications"]'], title: "Notifications", body: "Updates land here, for example when a coordinator accepts an invitation, finishes setting up, or hasn't accepted after 7 days. Tap one to jump straight to it." },
  { target: ['[aria-label="About"]'], title: "About OJTern", body: "Learn more about OJTern and the team behind it." },
];

const TOUR_PAGINATION = { target: ['nav[aria-label="Pagination"]'], title: "Pages", body: "Lists show 10 entries per page. Use the arrows or the page numbers to move through them." };

const TOURS = {
  departments: [
    { target: [".dp-search"], title: "Search", body: "Type a department or program name to narrow the list." },
    { target: ['[data-tour="filter"]'], title: "Filter", body: "Pick a department first, then its programs and majors appear. Active filters show as chips under the header, with a Clear option." },
    { target: ['[data-tour="add-dept"]'], title: "Add a department", body: "Create a department together with its first program (majors are optional). The name and abbreviation can't be changed after saving, so double-check them." },
    { target: [".dp-row"], title: "Department list", body: "Each row is a department with its program and major counts. Tap a row, or Manage, to add programs to it or majors to a program. Nothing can be renamed or deleted, because student, company and coordinator records store these names." },
    TOUR_PAGINATION,
    ...TOUR_TOPBAR,
  ],
  coordinators: [
    { target: [".dp-search"], title: "Search", body: "Search for a coordinator by name." },
    { target: ['[data-tour="filter"]'], title: "Filter", body: "Show only the coordinators and pending invitations of one department, program or major." },
    { target: ['[data-tour="invite"]'], title: "Invite a coordinator", body: "Enter their email and choose the department (and optionally the program or major) they will handle. They receive an email link and set their own name and password, so no password is ever shared." },
    { target: [".mc-table tbody tr:first-child", ".mc-cards .mc-card:first-child"], title: "Coordinators & invitations", body: "Each entry is either a coordinator or a pending invitation, shown with its department and status." },
    { target: [".mc-table tbody .adm-btn-light", ".mc-cards .mc-card .adm-btn-light"], title: "Manage", body: "Change the departments a coordinator handles or promote them to Admin. For a pending invitation you can resend or cancel it." },
    TOUR_PAGINATION,
  ],
  accountprofile: [
    { target: [".ap-header-card"], title: "Your profile", body: "The administrator account you are signed in with." },
    { target: [".ap-body .ap-group:nth-child(1)"], title: "Personal Information", body: "View your details and edit your name." },
    { target: [".ap-body .ap-group:nth-child(2)"], title: "Security", body: "Change your sign-in email (we send a 6-digit code to the new address to confirm it) or your password." },
    { target: [".ap-body .ap-group:nth-child(3)"], title: "Administrator accounts", body: "Add Account invites another administrator. Transfer Account hands your administrator role to someone else; your access ends once they accept the invitation and sign in for the first time." },
    { target: [".ap-body .ap-group:nth-child(4)"], title: "Legal", body: "Read the Terms & Conditions and the Privacy Policy." },
  ],
  // ── About ──
  about: [
    { target: [".adm-main"], title: "About OJTern", body: "Learn what OJTern is for and the team behind it. Scroll down to read the whole page." },
    { title: "Leaving this page", body: "Use the page's back button, or pick Departments, Coordinators or Account Profile in the sidebar." },
  ],

  // ── Account Profile: full screens ──
  "profile-personal": [
    { target: [".ap-sub-header .ap-back"], title: "Back", body: "Return to Account Profile." },
    { target: ['[data-tour="pi-edit"]'], title: "Edit", body: "Tap Edit to change your name. Your email and role can't be edited here." },
    { target: ['[data-tour="pi-name"]'], title: "Name", body: "The name shown across OJTern for your administrator account." },
    { target: ['[data-tour="pi-email"]'], title: "Email address", body: "The email you sign in with. To change it, go back and use Change Email under Security." },
    { target: ['[data-tour="pi-role"]'], title: "Role", body: "Your role in OJTern. This account is an Administrator." },
    { target: [".ap-name-input"], title: "Your name", body: "Type your new name (up to 60 characters)." },
    { target: ['[data-tour="pi-save"]'], title: "Save or cancel", body: "Save asks you to confirm before your name is updated. Cancel discards what you typed." },
  ],
  "profile-terms": [
    { target: [".ap-legal .ap-back"], title: "Back", body: "Return to Account Profile." },
    { target: [".ap-legal-progress"], title: "Reading progress", body: "This thin line fills up as you scroll through the Terms and Conditions." },
    { target: [".ap-legal-toc"], title: "On this page", body: "Jump straight to any section. The one you're reading is highlighted." },
    { target: [".ap-legal-scroll"], title: "Terms and Conditions", body: "The rules for using OJTern. Scroll to read them; email addresses in the text are tappable." },
  ],
  "profile-privacy": [
    { target: [".ap-legal .ap-back"], title: "Back", body: "Return to Account Profile." },
    { target: [".ap-legal-progress"], title: "Reading progress", body: "This thin line fills up as you scroll through the Privacy Policy." },
    { target: [".ap-legal-toc"], title: "On this page", body: "Jump straight to any section. The one you're reading is highlighted." },
    { target: [".ap-legal-scroll"], title: "Privacy Policy", body: "How OJTern collects, uses and protects personal data. Scroll to read it; email addresses in the text are tappable." },
  ],

  // ── Account Profile: pop-ups ──
  "profile-email": [
    { target: [".ap-modal-sub"], title: "Sign-in email", body: "This is the email you sign in with, and where password reset links are sent." },
    { target: [".ap-modal-body .ap-input"], title: "New email", body: "Type the address you want to use from now on, then your current password to confirm it's you." },
    { target: [".ap-modal-footer"], title: "Send code", body: "We email a 6-digit code to the new address. Cancel closes this pop-up without changing anything." },
  ],
  "profile-email-code": [
    { target: [".ap-modal-body .ap-input"], title: "6-digit code", body: "Enter the code we sent to your new email. It expires in 10 minutes." },
    { target: [".ap-modal-footer"], title: "Confirm", body: "Confirm switches your sign-in email. You'll then be signed out and must sign in again with the new email." },
  ],
  "profile-password": [
    { target: [".ap-modal-sub"], title: "Change password", body: "Enter your current password first, then choose a new one." },
    { target: ['[data-tour="pw-checklist"]'], title: "Password rules", body: "Your new password has to meet every requirement in this list. Each one ticks off as you type." },
    { target: [".ap-modal-footer"], title: "Save or cancel", body: "Change password asks you to confirm first. Cancel closes this pop-up (you're asked before anything you typed is discarded)." },
  ],
  "profile-admin-add": [
    { target: [".ap-modal-sub"], title: "Add administrator account", body: "The new administrator gets an email with an Accept Invitation button and then sets their own name and password. Nothing is shared." },
    { target: [".ap-modal-body .ap-input"], title: "Their email", body: "Type the new administrator's email, then your current password to confirm." },
    { target: [".ap-modal-footer"], title: "Send invitation", body: "Sends the invitation email. Invitations still waiting to be accepted are listed here, where you can cancel them." },
  ],
  "profile-admin-transfer": [
    { target: [".ap-modal-sub"], title: "Transfer administrator account", body: "Hands your administrator role to someone else. You keep access until they accept the invitation and sign in once; after that your account is switched off." },
    { target: [".ap-modal-body .ap-input"], title: "New administrator's email", body: "Type the email of the person taking over, then your current password to confirm." },
    { target: [".ap-modal-body input[type=\"checkbox\"]"], title: "Acknowledge", body: "Tick the box to confirm you understand your administrator access will end." },
    { target: [".ap-modal-footer"], title: "Start transfer", body: "Starts the transfer. If one is already pending you can cancel it from this pop-up." },
  ],
  namegate: [
    { target: [".ap-modal-body .ap-input"], title: "Your name", body: "Type your name (up to 60 characters). It's shown across OJTern. This step can't be skipped." },
    { target: [".ap-modal-footer"], title: "Continue", body: "Saves your name and opens the dashboard, where a short guide shows you around." },
  ],

  // ── Departments & Coordinators: pop-ups ──
  "dept-add": [
    { target: ['[data-tour="dept-name"]'], title: "Department name", body: "The full name, for example College of Nursing. It can't be changed after saving." },
    { target: ['[data-tour="dept-abbr"]'], title: "Abbreviation", body: "A short code of up to 10 characters, like CON. It can't be changed later either." },
    { target: ['[data-tour="dept-program"]'], title: "First program", body: "Every department starts with one program, such as Bachelor of Science in Nursing. You can add more later." },
    { target: ['[data-tour="dept-majors"]'], title: "Majors (optional)", body: "Majors of that program, separated by commas. Leave it blank if it has none, and don't put the major in the program name." },
    { target: [".dp-modal-footer"], title: "Save or cancel", body: "Add department saves it. Cancel closes this pop-up without saving." },
    { target: ['.dp-modal [aria-label="Close"]'], title: "Close", body: "The ✕ closes the pop-up, same as Cancel." },
  ],
  "dept-manage": [
    { target: [".dp-modal-body > div"], title: "Programs and majors", body: "Each block is a program with its majors. Type in the box to add a major to that program; it's saved right away." },
    { target: ['[data-tour="add-program"]'], title: "Add a program", body: "Add another program to this department. Majors are always added to a specific program." },
    { target: [".dp-modal-footer"], title: "Done", body: "Closes this pop-up. Nothing can be renamed or deleted, because student, company and coordinator records store these names." },
    { target: ['.dp-modal [aria-label="Close"]'], title: "Close", body: "The ✕ does the same as Done." },
  ],
  "coord-invite": [
    { target: ['input[name="invite-email"]'], title: "Email address", body: "Where the invitation link is sent. They set their own name and password, so no password is ever shared." },
    { target: ['[data-tour="invite-depts"]'], title: "Department they handle", body: "Choose a department, and optionally a program or major. Use + Add another department if they handle more than one." },
    { target: [".dp-modal-footer"], title: "Send or cancel", body: "Send invitation emails the link. Cancel closes this pop-up without sending." },
    { target: ['.dp-modal [aria-label="Close"]'], title: "Close", body: "The ✕ closes the pop-up, same as Cancel." },
  ],
  "coord-manage": [
    { target: [".dp-modal-body"], title: "Coordinator details", body: "Name, email and status of this coordinator." },
    { target: ['[data-tour="promote"]'], title: "Promote to Admin", body: "Gives this person administrator access." },
    { target: ['[data-tour="manage-depts"]'], title: "Departments", body: "Change which departments, programs or majors this coordinator handles." },
    { target: [".dp-modal-footer"], title: "Save or cancel", body: "Save changes becomes available once you change something. Cancel closes this pop-up without saving." },
  ],
  "coord-invite-pending": [
    { target: [".dp-modal-body"], title: "Invitation details", body: "Who was invited, when it was sent, its status and the department they will handle." },
    { target: [".dp-modal-footer"], title: "What you can do", body: "Resend sends the email again. Cancel invitation withdraws it. Close just closes this pop-up." },
    { target: ['.dp-modal [aria-label="Close"]'], title: "Close", body: "The ✕ does the same as Close." },
  ],

  // ── Confirmation dialogs ──
  confirm: [
    { target: ['[data-tour="confirm-card"]'], title: "Are you sure?", body: "OJTern asks before it adds, saves, cancels or sends anything. Read the message to make sure it's what you meant." },
    { target: ['[data-tour="confirm-ok"]'], title: "Confirm", body: "Goes ahead with the action." },
    { target: ['[data-tour="confirm-cancel"]'], title: "Cancel", body: "Goes back without doing anything." },
  ],
  logout: [
    { target: ['[data-tour="confirm-card"]'], title: "Log Out", body: "Signing out ends your administrator session on this device." },
    { target: ['[data-tour="confirm-ok"]'], title: "Log Out", body: "Signs you out and takes you to the sign-in page." },
    { target: ['[data-tour="confirm-cancel"]'], title: "Cancel", body: "Stay signed in and go back." },
  ],
};

const AUTO_TOUR_KEYS = new Set(["departments", "coordinators", "accountprofile"]);   // guides that start by themselves the first time

const AUTO_TOUR_DELAY_MS = 450;     // same pause the Student dashboard waits before its auto-tour
const AUTO_TOUR_MAX_WAIT_MS = 2000; // …then up to this long for lists to fill in from Firestore

const tourSeenKey = (uid) => `ojtern_admin_tour_seen_${uid}`;
const readTourSeen = (uid) => { try { return JSON.parse(localStorage.getItem(tourSeenKey(uid)) || "{}") || {}; } catch { return {}; } };
const writeTourSeen = (uid, v) => { try { localStorage.setItem(tourSeenKey(uid), JSON.stringify(v)); } catch { /* storage blocked: the tour may show again next visit */ } };

const findTourTarget = (selectors) => {
  for (const sel of selectors || []) {
    let list;
    try { list = document.querySelectorAll(sel); } catch { continue; }
    for (const el of list) if (el.getClientRects().length > 0) return el;
  }
  return null;
};

// Scrolls each scrollable ancestor of `el` just enough that it is fully visible inside it
// (driver.js only knows about the window's scroll, not the scroll boxes inside this layout).
const scrollIntoScrollParents = (el) => {
  const PAD = 12;
  let moved = false;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (p.scrollHeight <= p.clientHeight + 1) continue;
    if (!/(auto|scroll|hidden|overlay)/.test(getComputedStyle(p).overflowY)) continue;
    const pr = p.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    let delta = 0;
    if (er.height > pr.height - PAD * 2 || er.top < pr.top + PAD) delta = er.top - (pr.top + PAD);
    else if (er.bottom > pr.bottom - PAD) delta = er.bottom - (pr.bottom - PAD);
    if (Math.abs(delta) > 1) {
      const before = p.scrollTop;
      p.scrollTop = before + delta;
      if (p.scrollTop !== before) moved = true;
    }
  }
  return moved;
};

let activeTourDriver = null;
const stopTour = () => { try { activeTourDriver?.destroy(); } catch { /* already gone */ } activeTourDriver = null; };

// Same setup as the Student dashboard's runTour: while a tour runs the page can't be scrolled or clicked
// (only the popover's own buttons respond), and the tour ends only with ✕ or "Done".
const runTour = (rawSteps) => {
  if (activeTourDriver) return;

  // Steps whose target isn't on screen right now are dropped.
  const steps = (rawSteps || [])
    .map((s) => {
      const popover = { title: s.title, description: s.body };
      if (!s.target) return { popover };
      const element = findTourTarget(s.target);
      return element ? { element, popover } : null;
    })
    .filter(Boolean);

  // Lock EVERY element that is currently scrollable, then restore them all on close.
  const scrollLockTargets = [...document.querySelectorAll("body *")].filter((el) => {
    if (el.scrollHeight <= el.clientHeight + 1) return false;
    const oy = getComputedStyle(el).overflowY;
    return oy === "auto" || oy === "scroll" || oy === "overlay";
  });
  const initialScrollTop = scrollLockTargets.map((el) => el.scrollTop);
  const prevOverflowY = scrollLockTargets.map((el) => el.style.overflowY || "");
  const lockedScrollTop = scrollLockTargets.map((el) => el.scrollTop);
  let allowTourScroll = false;   // driver's own scroll to the next step is let through; user / momentum scroll snaps back
  const snapBack = () => {
    if (allowTourScroll) return;
    scrollLockTargets.forEach((el, i) => { el.scrollTop = lockedScrollTop[i]; });
  };
  scrollLockTargets.forEach((el) => { el.style.overflowY = "hidden"; el.addEventListener("scroll", snapBack); });
  const restoreScroll = () => {
    scrollLockTargets.forEach((el, i) => {
      el.removeEventListener("scroll", snapBack);
      el.style.overflowY = prevOverflowY[i];
      if (el.isConnected) el.scrollTop = initialScrollTop[i];
    });
  };

  // Block clicks outside the popover (capture phase, before React), and swallow Esc so only ✕ / Done end the tour.
  const blockOutsidePopover = (e) => {
    if (e.target?.closest?.(".driver-popover")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const BLOCKED_EVENTS = ["click", "dblclick", "auxclick", "contextmenu"];
  BLOCKED_EVENTS.forEach((ev) => window.addEventListener(ev, blockOutsidePopover, true));
  const blockEscape = (e) => { if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); e.stopImmediatePropagation(); } };
  ["keydown", "keyup"].forEach((ev) => window.addEventListener(ev, blockEscape, true));
  const unblockClicks = () => {
    BLOCKED_EVENTS.forEach((ev) => window.removeEventListener(ev, blockOutsidePopover, true));
    ["keydown", "keyup"].forEach((ev) => window.removeEventListener(ev, blockEscape, true));
  };

  let resizeObserver = null;
  const tourDriver = driver({
    showProgress: steps.length > 1,
    allowClose: true,
    showButtons: ["next", "previous", "close"],
    onDestroyed: () => { restoreScroll(); unblockClicks(); resizeObserver?.disconnect(); if (activeTourDriver === tourDriver) activeTourDriver = null; },
    onHighlighted: (element) => {
      // Keep the highlight glued to the target if its size changes while it's showing (a list filling in, etc.).
      resizeObserver?.disconnect();
      if (element && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => tourDriver?.refresh?.());
        resizeObserver.observe(element);
      }
      setTimeout(() => {
        scrollLockTargets.forEach((el, i) => { lockedScrollTop[i] = el.scrollTop; });
        allowTourScroll = false;
      }, 60);
    },
    onHighlightStarted: (element) => {
      allowTourScroll = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (element && scrollIntoScrollParents(element)) requestAnimationFrame(() => tourDriver?.refresh?.());
    },
    steps: steps.length > 0
      ? steps
      : [{ popover: { title: "Help", description: "There's no guided tour for this page yet." } }],
  });
  activeTourDriver = tourDriver;
  tourDriver.drive();
};

// Floating "?" help button: same look and behaviour as the Student dashboard's.
//  • Mouse: hover it for 1 second (a ring fades in around it) and it follows the cursor; click
//    anywhere to drop it there, Esc to drop it. A normal click before the 1s is up opens the guide.
//  • Touch / pen: hold and move to drag straight away; a plain tap opens the guide.
//  • After a drag it glides to the nearer side; the spot is remembered on this device.
//  • Untouched for 10 seconds: fades to low opacity (and the pulse ring stops).
const HELP_FAB_SIZE         = 56;
const HELP_FAB_EDGE         = 12;      // min gap kept from every screen edge
const HELP_FAB_HOVER_FOLLOW = 1000;    // mouse: hover this long → it follows the cursor
const HELP_FAB_DRAG_START   = 6;       // touch: px of finger movement that starts a drag
const HELP_FAB_POS_KEY      = "ojtern.adminHelpFabPos";
const HELP_FAB_SNAP_GAP     = 24;      // space kept from the side it snaps to
const HELP_FAB_TOP_MIN      = 86;      // stay below the 70px top bar (+ gap)
const HELP_FAB_IDLE_MS      = 10000;   // fade after 10s untouched

const clampHelpFabPos = ({ x, y }) => ({
  x: Math.min(Math.max(HELP_FAB_EDGE, x), Math.max(HELP_FAB_EDGE, window.innerWidth  - HELP_FAB_SIZE - HELP_FAB_EDGE)),
  y: Math.min(Math.max(HELP_FAB_EDGE, y), Math.max(HELP_FAB_EDGE, window.innerHeight - HELP_FAB_SIZE - HELP_FAB_EDGE)),
});

// Where it settles after being let go: the nearer LEFT or RIGHT side, with a gap, keeping the height
// it was dropped at but never under the top bar or off the bottom.
const snapHelpFabPos = ({ x, y }) => {
  const w = window.innerWidth, h = window.innerHeight;
  const toLeft = x + HELP_FAB_SIZE / 2 < w / 2;
  const maxY = Math.max(HELP_FAB_TOP_MIN, h - HELP_FAB_SIZE - HELP_FAB_SNAP_GAP);
  return {
    x: toLeft ? HELP_FAB_SNAP_GAP : Math.max(HELP_FAB_SNAP_GAP, w - HELP_FAB_SIZE - HELP_FAB_SNAP_GAP),
    y: Math.min(Math.max(HELP_FAB_TOP_MIN, y), maxY),
  };
};

const HelpFab = ({ onOpen }) => {
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HELP_FAB_POS_KEY) || "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return snapHelpFabPos(saved);
    } catch { /* storage unavailable: use the default corner */ }
    return null;   // null = default bottom-right corner
  });
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [idle, setIdle]         = useState(false);
  const [arming, setArming]     = useState(false);   // mouse hover countdown running

  const idleTimer     = useRef(null);
  const snapTimer     = useRef(null);
  const hoverTimer    = useRef(null);
  const followCleanup = useRef(null);
  const hovering      = useRef(false);
  const following     = useRef(false);
  const dragActive    = useRef(false);
  const suppressClick = useRef(false);   // swallow the click that ends a drag
  const posRef        = useRef(pos);
  const pressStart    = useRef(null);    // { x, y } where a touch press began
  const grabOffset    = useRef({ x: 0, y: 0 });
  const lastMouse     = useRef({ x: 0, y: 0 });

  useEffect(() => { posRef.current = pos; }, [pos]);

  // Any interaction wakes it to full opacity and restarts the 10s countdown (paused while hovered or dragged).
  const scheduleIdle = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!hovering.current && !dragActive.current) setIdle(true);
    }, HELP_FAB_IDLE_MS);
  };
  const wake = () => { setIdle(false); scheduleIdle(); };

  useEffect(() => {
    const onResize = () => setPos((p) => (p ? snapHelpFabPos(p) : p));
    window.addEventListener("resize", onResize);
    scheduleIdle();   // first 10s countdown starts on mount
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(idleTimer.current);
      clearTimeout(snapTimer.current);
      clearTimeout(hoverTimer.current);
      followCleanup.current?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Mouse: hover 1s → follow the cursor, click anywhere to drop ──
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
    // The click that drops it must not ALSO press whatever is underneath (or open the guide): swallow exactly that click.
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

  // ── Touch / pen: hold and move to drag straight away ──
  const endPress = (e) => {
    if (e?.pointerType === "mouse") return;
    pressStart.current = null;
    try { e?.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* not captured */ }
    if (dragActive.current && !following.current) {
      dragActive.current = false;
      suppressClick.current = true;   // the lift after a drag isn't a tap
      setDragging(false);
      settle();
    }
    hovering.current = false;
    scheduleIdle();
  };

  const onPointerDown = (e) => {
    wake();
    if (e.pointerType === "mouse") {
      // A real click before the 1s hover finished: it's a click, not a move.
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
      if (Math.hypot(dx, dy) < HELP_FAB_DRAG_START) return;   // still just a tap
      dragActive.current = true;
      setDragging(true);
      navigator.vibrate?.(10);
    }
    e.preventDefault();
    setPos(clampHelpFabPos({ x: e.clientX - grabOffset.current.x, y: e.clientY - grabOffset.current.y }));
  };

  const handleClick = () => {
    wake();
    if (suppressClick.current) { suppressClick.current = false; return; }   // was a drag, not a tap
    onOpen();
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
      onContextMenu={(e) => e.preventDefault()}   // no long-press menu on touch screens
      aria-label="Help"
      title="Need Help? - hover it 1 second and drag it (just drag it on mobile devices)"
      className={`adm-help-fab${dragging ? " adm-help-fab-dragging" : ""}${arming && !dragging ? " adm-help-fab-arming" : ""}${snapping ? " adm-help-fab-snapping" : ""}${idle && !dragging ? " adm-help-fab-idle" : ""}`}
      style={{
        position: "fixed",
        ...(pos
          ? { left: `${pos.x}px`, top: `${pos.y}px`, right: "auto", bottom: "auto" }
          : { bottom: "24px", right: "24px" }),
        touchAction: "none",   // so holding and dragging on a touch screen moves the button, not the page
        userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
        width: `${HELP_FAB_SIZE}px`, height: `${HELP_FAB_SIZE}px`, borderRadius: "50%",
        background: paper, border: `1px solid ${hairline}`,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        zIndex: 10000,  // above every pop-up, including the 9999 confirm / logout dialogs (it hides itself while a guide runs)
      }}
    >
      <svg className="adm-help-fab-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" style={{ transition: `stroke 0.18s ${ease}` }}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a2.9 2.9 0 0 1 5.66.9c0 1.9-2.66 2.4-2.66 4.1" />
        <circle className="adm-help-fab-icon-dot" cx="12" cy="17.15" r="1.05" fill={ink} stroke="none" />
      </svg>
    </button>
  );
};

// ═══════════════════════════ Dashboard shell ═══════════════════════════
// Same layout as the Student / Coordinator / Company dashboards: black top bar with the
// logo, a 260px sidebar (slide-in drawer on mobile/tablet) with the role label and Log Out,
// and a light content area.
const PAGE_TITLES = {
  departments:  { title: "Departments & Programs", sub: "Add departments, programs and majors. Changes show up across OJTern right away." },
  coordinators: { title: "Manage Coordinators",     sub: "Invite coordinators and choose which department each one handles." },
  accountprofile: { title: "Account Profile",      sub: "Your administrator details, password and administrator accounts." },
};

// A newly added administrator has no name yet: they type it here the first time they sign in
// (like a coordinator does when accepting an invitation). It cannot be skipped.
const AdminNameGate = ({ onSaved }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const v = norm(name);
    if (!v) { setError("Enter your name."); return; }
    if (v.length > 60) { setError("Name can be up to 60 characters."); return; }
    setBusy(true); setError("");
    try {
      await httpsCallable(functions, "adminUpdateProfile")({ name: v });
      onSaved(v);
    } catch (err) {
      setError(err?.message || "Could not save your name. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ApModal help="namegate" title="Welcome to OJTern" onClose={() => {}}
      sub="Enter your name to finish setting up your administrator account."
      footer={<button type="button" className="ap-fbtn solid" disabled={busy} onClick={save}>{busy ? "Saving…" : "Continue"}</button>}>
      <ApInput label="Your name" maxLength={60} autoFocus autoComplete="name" value={name}
        onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
      {error && <div role="alert" style={S.err}>{error}</div>}
    </ApModal>
  );
};

const AdminDashboard = ({ admin: adminProp }) => {
  const [savedName, setSavedName] = useState(adminProp.name || "");
  const admin = { ...adminProp, name: savedName };
  const { isMobile, isDesktop } = useBreakpoint();
  const showDrawer = !isDesktop;
  const [activeNav, setActiveNav] = useState("departments");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [depts, setDepts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [rawNotifs, setRawNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // Help: guided tour per module (driver.js, like the Student dashboard). `seen` remembers which ones this
  // admin has already been shown; the floating "?" button replays the current module's tour any time.
  const [seen, setSeen] = useState(() => readTourSeen(adminProp.uid));
  const tourTimer = useRef(null);
  // Pop-ups / sub-screens that are open register here; the "?" button opens the guide of the top-most one.
  const [helpStack, setHelpStack] = useState([]);
  const registerHelp = useCallback((key) => {
    const id = {};
    setHelpStack((s) => [...s, { id, key }]);
    return () => setHelpStack((s) => s.filter((e) => e.id !== id));
  }, []);
  const helpKey = helpStack.length ? helpStack[helpStack.length - 1].key : activeNav;
  const startTour = (key, auto) => {
    const moduleSteps = TOURS[key];
    if (!moduleSteps) return;
    if (AUTO_TOUR_KEYS.has(key)) setSeen((s) => { const n = { ...s, [key]: true }; writeTourSeen(adminProp.uid, n); return n; });
    // Close any open top-bar dropdown / drawer first, then start on the next frame once React has removed it.
    setNotifOpen(false); setDrawerOpen(false);
    window.clearTimeout(tourTimer.current);
    if (!auto) { requestAnimationFrame(() => runTour(moduleSteps)); return; }
    // Auto-start: a short pause, then wait (a little) for lists to fill in so their steps aren't skipped.
    const t0 = Date.now();
    const tick = () => {
      const ready = moduleSteps.every((st) => !st.target || findTourTarget(st.target));
      if (ready || Date.now() - t0 > AUTO_TOUR_MAX_WAIT_MS) runTour(moduleSteps);
      else tourTimer.current = window.setTimeout(tick, 150);
    };
    tourTimer.current = window.setTimeout(tick, AUTO_TOUR_DELAY_MS);
  };
  useEffect(() => () => { window.clearTimeout(tourTimer.current); stopTour(); }, []);

  // Notifications addressed to this admin (no orderBy, so no composite index is needed; sorted below).
  useEffect(() => onSnapshot(
    query(collection(db, "notifications"), where("recipientId", "==", admin.uid)),
    (snap) => setRawNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => console.error("Failed to load notifications:", e)), [admin.uid]);

  const notifications = useMemo(() => rawNotifs
    .map((n) => ({ ...n, time: n.createdAt?.toMillis ? n.createdAt.toMillis() : 0, unread: n.read !== true }))
    .sort((a, b) => b.time - a.time), [rawNotifs]);

  // Opening the bell shows what's new; closing it marks everything as read.
  const toggleNotif = () => {
    if (notifOpen) {
      notifications.filter((n) => n.unread).forEach((n) =>
        updateDoc(doc(db, "notifications", n.id), { read: true })
          .catch((e) => console.error("Failed to mark notification read:", e)));
    }
    setNotifOpen((o) => !o);
  };
  const selectNotif = (n) => {
    setNotifOpen(false);
    if (String(n.type || "").startsWith("coordinator_")) setActiveNav("coordinators");
    if (n.unread) updateDoc(doc(db, "notifications", n.id), { read: true }).catch((e) => console.error(e));
  };

  // Raw Firestore docs (with their ids) rather than the hook, so edits know which doc to update.
  useEffect(() => onSnapshot(collection(db, "departments"),
    (snap) => {
      setDepts(snap.docs.map((d) => { const x = d.data(); return { id: d.id, name: norm(x.name || d.id), abbr: x.abbr || "", programs: x.programs || [] }; }));
      setLoaded(true);
    },
    (e) => { console.error("departments:", e); setLoaded(true); }), []);

  useEffect(() => { if (isDesktop) setDrawerOpen(false); }, [isDesktop]);

  // First time this admin opens a module, its guide starts by itself (after the name has been entered,
  // and for Departments once its list has loaded).
  useEffect(() => {
    if (!norm(savedName) || !AUTO_TOUR_KEYS.has(activeNav) || seen[activeNav]) return;
    if (activeNav === "departments" && !loaded) return;
    startTour(activeNav, true);
  }, [activeNav, savedName, loaded, seen]); // eslint-disable-line react-hooks/exhaustive-deps

  const flashTimer = useRef(null);
  const flash = (m) => {
    setNotice(m);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setNotice(""), 6000);
  };

  const navigate = (key) => { setActiveNav(key); setDrawerOpen(false); setNotice(""); setNotifOpen(false); window.clearTimeout(tourTimer.current); stopTour(); };
  const askLogout = () => { setDrawerOpen(false); setShowLogout(true); };
  const confirmLogout = async () => {
    setShowLogout(false);
    // Signed out → back to the normal sign-in page (the same one everyone uses), not the /admin form.
    // Only after a successful sign-out, otherwise the sign-in page would send a still-signed-in admin back here.
    try {
      await signOut(auth);
      window.location.replace("/signin");
    } catch (e) { console.error("Logout failed:", e); }
  };

  const page = PAGE_TITLES[activeNav] || PAGE_TITLES.departments;

  return (
    <HelpTopicContext.Provider value={registerHelp}>
      <AdminStyles />
      {!norm(savedName) && <AdminNameGate onSaved={setSavedName} />}
      {showLogout && <LogoutConfirmModal onConfirm={confirmLogout} onCancel={() => setShowLogout(false)} />}
      {(norm(savedName) || helpKey === "namegate") && TOURS[helpKey] && <HelpFab onOpen={() => startTour(helpKey, false)} />}
      <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: uiFont }}>

        {/* ── Top Navbar ── */}
        <div style={{
          height: "70px", flexShrink: 0, zIndex: 100,
          background: `linear-gradient(90deg, ${ink} 0%, ${inkDeep} 100%)`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
            {showDrawer && (
              <button className="adm-hamburger" onClick={() => setDrawerOpen((o) => !o)} aria-label="Toggle menu" style={{ flexShrink: 0 }}>
                <span /><span /><span />
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <img src={topbarLogo} alt="OJTern" style={{ width: "40px", height: "40px", objectFit: "contain", flexShrink: 0 }} />
              <span style={{ fontFamily: logoFont, fontSize: "clamp(1.1rem, 3vw, 1.5rem)", color: paper, letterSpacing: "0.03em" }}>OJTern</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            <DashboardSwitcher current="admin" />
            {!isMobile && (
              <span style={{ fontFamily: uiFont, fontSize: "0.82rem", color: "rgba(255,255,255,0.8)", marginRight: "8px" }}>{admin.name || admin.email}</span>
            )}
            <NotificationBell items={notifications} open={notifOpen} onToggle={toggleNotif} onSelect={selectNotif} />
            <div style={{ cursor: "pointer", padding: "8px" }} onClick={() => navigate("about")} title="About" role="button" aria-label="About">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 8h.01" /><path d="M11 12h1v4h1" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
          {isDesktop && (
            <div className="adm-static">
              <SidebarNav activeNav={activeNav} onNavigate={navigate} onLogout={askLogout} />
            </div>
          )}

          {showDrawer && (
            <>
              <div className={`adm-overlay ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
              <div className={`adm-drawer ${drawerOpen ? "open" : ""}`}>
                <div style={{ background: `linear-gradient(90deg, ${ink} 0%, ${inkDeep} 100%)`, padding: "14px 20px", flexShrink: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                  <img src={topbarLogo} alt="OJTern" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
                  <span style={{ fontFamily: logoFont, fontSize: "1.2rem", color: paper }}>OJTern</span>
                </div>
                <SidebarNav activeNav={activeNav} onNavigate={navigate} onLogout={askLogout} />
              </div>
            </>
          )}

          <div className="adm-main">
            {activeNav === "about" ? (
              <AboutUsScreen onBack={() => navigate("departments")} />
            ) : (
              <div style={{
                width: "100%",
                // Departments and Manage Coordinators use the full width, like Student Accounts; the other tabs keep the narrow column.
                maxWidth: (activeNav === "departments" || activeNav === "coordinators" || activeNav === "accountprofile") ? "none" : "1040px",
                margin: "0 auto",
                padding: activeNav === "accountprofile" ? "0"
                  : (activeNav === "departments" || activeNav === "coordinators")
                  ? "clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px) clamp(16px, 4vw, 28px)"
                  : isMobile ? "20px 14px 64px" : "28px 24px 64px",
                boxSizing: "border-box",
              }}>
                {activeNav !== "accountprofile" && (
                  <>
                    <h1 style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "clamp(1.5rem, 4vw, 2.2rem)", color: ink, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{page.title}</h1>
                    <p style={{ fontFamily: uiFont, fontSize: "clamp(0.85rem, 2vw, 1rem)", color: inkMuted, margin: "0 0 22px" }}>{page.sub}</p>
                  </>
                )}
                {notice && <div role="status" style={activeNav === "accountprofile" ? { ...S.okMsg, margin: "14px clamp(16px, 4vw, 32px) 0" } : S.okMsg}>{notice}</div>}
                {activeNav === "departments" ? <DepartmentsTab depts={depts} loaded={loaded} flash={flash} />
                  : activeNav === "coordinators" ? <CoordinatorsTab admin={admin} depts={depts} flash={flash} />
                  : <AccountProfile admin={admin} flash={flash} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </HelpTopicContext.Provider>
  );
};

// ═══════════════════════════ Entry point ═══════════════════════════
// Running as an installed app (PWA window): there is no address bar and no "OJTern" page to go back to,
// so the "Back to OJTern" button is not shown there.
const isStandalone = () =>
  typeof window !== "undefined" &&
  ((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true);

// Usage (see ADMIN_SETUP.md):  <AdminScreen onExit={() => { window.location.href = "/"; }} />
const AdminScreen = ({ onExit }) => {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  // True once this session was a signed-in admin. If the session then ends for any reason
  // (changed sign-in email, revoked session, transfer, logout), go to the normal sign-in page
  // instead of falling back to this separate /admin form.
  const wasAdmin = useRef(false);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) {
      if (wasAdmin.current) { window.location.replace("/signin"); return; }
      setAdmin(null); setChecking(false); return;
    }
    try {
      // A coordinator/student/company who happens to be signed in is simply not an admin here:
      // we show the admin sign-in form and do NOT sign them out.
      const snap = await getDoc(doc(db, "admins", u.uid));
      const ok = snap.exists() && snap.get("role") === "admin" && snap.get("status") === "active";
      wasAdmin.current = !!ok;
      setAdmin(ok ? { uid: u.uid, name: snap.get("name") || "", email: u.email || "" } : null);
      // The new administrator of a pending transfer: signing in proves they own the email, so this is
      // the moment the previous administrator's account is switched off (server-side, and a no-op unless
      // a transfer to this account really is pending).
      if (ok && snap.get("transferFrom")) {
        httpsCallable(functions, "adminCompleteTransfer")().catch((e) => console.error("adminCompleteTransfer:", e));
      }
    } catch {
      setAdmin(null);
    }
    setChecking(false);
  }), []);

  // Once an admin is signed in, keep "/admin" out of the address bar: show the site root instead.
  // history.replaceState changes only the displayed URL (the router isn't told, so this screen stays
  // mounted). On refresh the root page sees the signed-in admin and sends them back here, where
  // this runs again. It is cosmetic only: access is enforced by firestore.rules and requireAdmin.
  useEffect(() => {
    if (admin && window.location.pathname.startsWith("/admin")) {
      try { window.history.replaceState(window.history.state, "", "/"); } catch { /* keep the URL as is */ }
    }
  }, [admin]);

  if (checking) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: paperTint, color: inkMuted, fontFamily: uiFont }}>Loading…</div>;
  return admin ? <AdminDashboard admin={admin} /> : <AdminSignIn onExit={isStandalone() ? undefined : onExit} />;
};

export default AdminScreen;