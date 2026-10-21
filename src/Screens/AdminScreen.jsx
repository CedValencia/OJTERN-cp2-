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

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail,
} from "firebase/auth";
import {
  collection, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";
import { DEFAULT_DEPARTMENTS, normalizeDept, splitLegacyProgram } from "./departmentsPrograms";
import { color, font } from "./theme";
import logo from "../icons/ojtern.png";
import AboutUsScreen from "./AboutUsScreen";

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
    key: "coordinators", label: "Coordinators",
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

const SidebarNav = ({ activeNav, onNavigate, onLogout }) => (
  <>
    {/* Role of the signed-in account, same spot the other dashboards use */}
    <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
      <span style={{ fontFamily: uiFont, fontSize: "1.15rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: inkText }}>
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
    <div style={{ background: paper, borderRadius: "20px", padding: "36px 32px", width: "clamp(280px, 85vw, 380px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: paperCard, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </div>
      <p style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "1.15rem", color: inkText, margin: 0, textAlign: "center" }}>Log Out</p>
      <p style={{ fontFamily: uiFont, fontSize: "0.9rem", color: inkMuted, margin: 0, textAlign: "center", lineHeight: 1.5 }}>Are you sure you want to log out of your account?</p>
      <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "8px" }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: `1.5px solid ${hairline}`, background: paper, fontFamily: uiFont, fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", color: inkMuted, boxShadow: "0 3px 10px rgba(0,0,0,0.3)" }}>Cancel</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: "none", background: ink, fontFamily: uiFont, fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", color: paper, boxShadow: "0 3px 10px rgba(0,0,0,0.5)" }}>Log Out</button>
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
      <div style={{ background: paper, borderRadius: "20px", padding: "32px 28px", width: "clamp(280px, 85vw, 400px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: paperCard, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "2px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <p style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "1.1rem", color: inkText, margin: 0, textAlign: "center" }}>{title}</p>
        <p style={{ fontFamily: uiFont, fontSize: "0.9rem", color: inkMuted, margin: 0, textAlign: "center", lineHeight: 1.5, overflowWrap: "anywhere" }}>{body}</p>
        <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "8px" }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: `1.5px solid ${hairline}`, background: paper, fontFamily: uiFont, fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", color: inkMuted, boxShadow: "0 3px 10px rgba(0,0,0,0.3)" }}>{cancelLabel}</button>
          <button type="button" autoFocus onClick={onConfirm} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: "none", background: accent, fontFamily: uiFont, fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", color: paper, boxShadow: "0 3px 10px rgba(0,0,0,0.5)" }}>{confirmLabel}</button>
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
          <img src={logo} alt="OJTern" style={{ width: "104px", height: "104px", objectFit: "contain" }} />
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
          <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end", marginBottom: "8px" }}>
            <div style={{ flex: "1 1 220px" }}>
              <label style={S.label}>Department<Req /></label>
              <select value={row.department} style={S.input}
                onChange={(e) => setRow(i, { department: e.target.value, program: "", specialization: "" })}>
                <option value="">Select department</option>
                {depts.map((d) => <option key={d.id} value={d.name}>{d.name}{d.abbr ? ` (${d.abbr})` : ""}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <label style={S.label}>Program</label>
              <select value={row.program} disabled={!dept} style={S.input}
                onChange={(e) => setRow(i, { program: e.target.value, specialization: "" })}>
                <option value="">All programs in this department</option>
                {progs.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            {specs.length > 0 && (
              <div style={{ flex: "1 1 180px" }}>
                <label style={S.label}>Major</label>
                <select value={row.specialization} style={S.input} onChange={(e) => setRow(i, { specialization: e.target.value })}>
                  <option value="">All majors</option>
                  {specs.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
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

const DepartmentsTab = ({ depts, loaded, flash }) => {
  const [form, setForm] = useState({ name: "", abbr: "", program: "", majors: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    if (ok) setForm({ name: "", abbr: "", program: "", majors: "" });
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

  return (
    <div>
      {confirmDialog}
      {error && <div role="alert" style={S.err}>{error}</div>}

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

      {!notSeeded && (
        <div style={S.card}>
          <h2 style={S.h2}>Add a department</h2>
          <p style={S.help}>Name and abbreviation can’t be changed after saving, so double-check them. You can add more programs and majors later; a major is always added to a specific program.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ flex: "2 1 260px" }}>
              <label style={S.label}>Department name<Req /></label>
              <input style={S.input} value={form.name} placeholder="College of Nursing" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ flex: "1 1 110px" }}>
              <label style={S.label}>Abbreviation<Req /></label>
              <input style={S.input} value={form.abbr} placeholder="CON" maxLength={10} onChange={(e) => setForm({ ...form, abbr: e.target.value.toUpperCase() })} />
            </div>
            <div style={{ flex: "2 1 260px" }}>
              <label style={S.label}>First program<Req /></label>
              <input style={S.input} value={form.program} placeholder="Bachelor of Science in Nursing" onChange={(e) => setForm({ ...form, program: e.target.value })} />
            </div>
            <div style={{ flex: "1 1 100%" }}>
              <label style={S.label}>Majors of that program (optional)</label>
              <input style={S.input} value={form.majors} placeholder="e.g. English, Mathematics — separate with commas; leave blank if it has none" onChange={(e) => setForm({ ...form, majors: e.target.value })} />
              <p style={{ ...S.help, margin: "6px 0 0" }}>Don’t put the major in the program name — write “Bachelor of Secondary Education” here and “English” above.</p>
            </div>
          </div>
          <button type="button" style={{ ...S.btn, marginTop: "14px", opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={addDepartment}>Add department</button>
        </div>
      )}

      {sorted.map((d) => (
        <div key={d.id} style={S.card}>
          <h2 style={S.h2}>{d.name} {d.abbr && <span style={{ color: C.muted, fontWeight: 600 }}>({d.abbr})</span>}</h2>
          {programsOf(d).map((p) => (
            <div key={p.name} style={{ borderTop: `1px solid ${C.line}`, padding: "10px 0" }}>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.name}</div>
              <div style={{ marginTop: "6px" }}>
                {p.specializations.length === 0
                  ? <span style={{ fontSize: "0.78rem", color: C.muted }}>No majors</span>
                  : p.specializations.map((m) => <span key={m} style={S.chip}>{m}</span>)}
              </div>
              <AddInline placeholder="Add a major to this program" onAdd={(v) => addMajor(d, p.name, v)} />
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: "10px" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Add a program to {d.abbr || d.name}</div>
            <AddInline placeholder="Program name" onAdd={(v) => addProgram(d, v)} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════ Coordinators tab ═══════════════════════════
const CoordinatorsTab = ({ admin, depts, flash }) => {
  const [coordinators, setCoordinators] = useState([]);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [sel, setSel] = useState(emptySel());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingUid, setEditingUid] = useState(null);
  const [editSel, setEditSel] = useState(emptySel());
  const [confirm, confirmDialog] = useConfirm();

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
    (s) => setInvites(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
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
    if (res) { flash(`Invitation sent to ${to}. They set their own name and password from the email link.`); setEmail(""); setSel(emptySel()); }
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
    if (res) { flash("Coordinator department updated."); setEditingUid(null); }
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
    try { await updateDoc(doc(db, "coordinatorInvites", id), { status: "cancelled" }); flash("Invitation cancelled."); }
    catch (e) { console.error(e); setError("Could not cancel the invitation."); }
  };

  return (
    <div>
      {confirmDialog}
      {error && <div role="alert" style={S.err}>{error}</div>}

      <div style={S.card}>
        <h2 style={S.h2}>Invite a coordinator</h2>
        <p style={S.help}>
          Pick the department (and optionally the program/major) they will handle. They receive an email link and set their own
          name and password — no password is ever shared. Works for brand-new departments too.
        </p>
        <label style={S.label}>Email address<Req /></label>
        <input style={{ ...S.input, maxWidth: "420px" }} type="email" value={email} placeholder="name@school.edu.ph" onChange={(e) => setEmail(e.target.value)} />
        <div style={{ marginTop: "6px" }}><DeptSelectionsEditor depts={depts} value={sel} onChange={setSel} /></div>
        <button type="button" style={{ ...S.btn, marginTop: "14px", opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={invite}>Send invitation</button>
      </div>

      {invites.length > 0 && (
        <div style={S.card}>
          <h2 style={S.h2}>Pending invitations</h2>
          {invites.map((v) => (
            <div key={v.id} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${C.line}`, padding: "10px 0" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{v.toEmail}</div>
                <div style={{ fontSize: "0.78rem", color: C.muted }}>{(v.deptSelections || []).map(describeSel).join(" · ")}</div>
                {v.createdAt?.toMillis && <div style={{ fontSize: "0.75rem", color: C.muted }}>Sent {timeAgo(v.createdAt.toMillis())}</div>}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" style={S.btn2} disabled={busy} onClick={() => resendInvite(v)}>Resend</button>
                <button type="button" style={S.btn2} onClick={() => cancelInvite(v.id)}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <h2 style={S.h2}>Coordinators ({coordinators.length})</h2>
        {coordinators.map((c) => (
          <div key={c.uid} style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{c.name || "(name not set yet)"} <span style={{ ...S.chip, marginLeft: "6px" }}>{c.status || "—"}</span></div>
                <div style={{ fontSize: "0.78rem", color: C.muted }}>{c.email}</div>
              </div>
              {editingUid !== c.uid && (
                <button type="button" style={S.btn2} onClick={() => { setEditingUid(c.uid); setEditSel(c.deptSelections?.length ? c.deptSelections.map((raw) => { const s = normSel(raw); return { department: s.department || "", program: s.program || "", specialization: s.specialization || "" }; }) : emptySel()); }}>
                  Manage
                </button>
              )}
            </div>
            {editingUid === c.uid ? (
              <div style={{ marginTop: "8px" }}>
                <DeptSelectionsEditor depts={depts} value={editSel} onChange={setEditSel} />
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button type="button" style={S.btn} disabled={busy} onClick={() => saveDepts(c.uid)}>Save</button>
                  <button type="button" style={S.btn2} onClick={async () => {
                    // Only ask when something was actually changed; nothing to lose otherwise.
                    if (selSig(editSel) !== selSig(initialSel(c))
                      && !(await confirm({ title: "Cancel changes", body: "Are you sure you want to cancel? Your changes will be discarded.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" }))) return;
                    setEditingUid(null);
                  }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "6px" }}>
                {(c.deptSelections || []).length === 0
                  ? <span style={{ fontSize: "0.78rem", color: C.danger }}>No department assigned</span>
                  : c.deptSelections.map((s, i) => <span key={i} style={S.chip}>{describeSel(s)}</span>)}
              </div>
            )}
          </div>
        ))}
        {coordinators.length === 0 && <p style={S.help}>No coordinators yet.</p>}
      </div>
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
// system out. No password is shared: the SERVER emails the new person a "set your password" link.
// Server side: functions/adminFunctions.js (adminAddAdmin, adminTransferAdmin, adminCancelTransfer,
// adminCompleteTransfer).
const AdminAccountsCard = ({ pending, onChanged, flash, confirm }) => {
  const [mode, setMode] = useState(null);            // null | "add" | "transfer"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (m) => { setMode(m); setForm({ name: "", email: "", password: "" }); setAck(false); setError(""); setInfo(""); };
  const close = async () => {
    // Asking only when something was typed: nothing to lose otherwise.
    if ((form.name || form.email || form.password)
      && !(await confirm({ title: "Cancel", body: "Are you sure you want to cancel? What you entered will be discarded.", confirmLabel: "Discard", cancelLabel: "Keep editing", tone: "danger" }))) return;
    setMode(null); setError("");
  };

  const submit = async () => {
    setError(""); setInfo("");
    const name = norm(form.name);
    const email = norm(form.email).toLowerCase();
    if (!name) { setError("Enter the person's name."); return; }
    if (!EMAIL_RE.test(email)) { setError("Enter a valid email address."); return; }
    if (email === norm(auth.currentUser?.email).toLowerCase()) { setError("That is your own email. Enter the other person's email."); return; }
    if (!form.password) { setError("Enter your current password to confirm."); return; }
    if (mode === "transfer" && !ack) { setError("Tick the box to confirm you understand."); return; }
    if (!(await confirm(mode === "add"
      ? { title: "Add administrator", body: `Are you sure you want to add ${name} (${email}) as an administrator? They will have full administrator access.`, confirmLabel: "Add account" }
      : { title: "Transfer account", body: `Are you sure you want to transfer your administrator role to ${name} (${email})? Your access ends once they sign in for the first time.`, confirmLabel: "Start transfer", tone: "danger" }))) return;
    setBusy(true);
    try {
      await reauthenticate(form.password);
      const res = await httpsCallable(functions, mode === "add" ? "adminAddAdmin" : "adminTransferAdmin")({ name, email });
      const mailed = res?.data?.mailed !== false;
      const done = mode === "add" ? "Administrator account created." : "Transfer started.";
      setMode(null);
      onChanged();
      flash(done);
      setInfo(mailed
        ? `We emailed ${email} a link to set their password. ${mode === "transfer" ? "Your access ends once they sign in for the first time." : "They can sign in after that."}`
        : `The account was created, but we couldn’t send the email. Ask ${email} to use “Forgot password” on the sign-in page.`);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const cancelTransfer = async () => {
    if (!(await confirm({ title: "Cancel transfer", body: `Are you sure you want to cancel the transfer${pending?.email ? ` to ${pending.email}` : ""}? Their account will be switched off if they haven't signed in yet.`, confirmLabel: "Cancel transfer", cancelLabel: "Keep it", tone: "danger" }))) return;
    setBusy(true); setError("");
    try {
      await httpsCallable(functions, "adminCancelTransfer")();
      onChanged();
      flash("Transfer cancelled.");
    } catch (err) {
      setError(err?.message || "Could not cancel the transfer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={S.card}>
      <h2 style={S.h2}>Administrator accounts</h2>
      <p style={S.help}>
        Add another administrator, or hand your administrator role to someone else. They set their own password from an emailed link, so no password is ever shared.
      </p>

      {pending && (
        <div role="status" style={{ ...S.okMsg, margin: "0 0 14px" }}>
          Transfer to <strong>{pending.email || "the new administrator"}</strong> is pending. You keep full access until they sign in for the first time; then your account is switched off.
          <div style={{ marginTop: "10px" }}>
            <button type="button" style={{ ...S.btn2, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={cancelTransfer}>Cancel transfer</button>
          </div>
        </div>
      )}
      {info && !pending && <div role="status" style={{ ...S.okMsg, margin: "0 0 14px" }}>{info}</div>}
      {error && !mode && <div role="alert" style={S.err}>{error}</div>}

      {!mode && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" style={S.btn} onClick={() => open("add")}>Add account</button>
          <button type="button" style={{ ...S.btn2, opacity: pending ? 0.5 : 1 }} disabled={!!pending} title={pending ? "A transfer is already pending" : undefined} onClick={() => open("transfer")}>Transfer account</button>
        </div>
      )}

      {mode && (
        <div>
          <h3 style={{ ...S.label, fontSize: "0.9rem", marginTop: 0 }}>{mode === "add" ? "Add an administrator account" : "Transfer your administrator account"}</h3>
          {mode === "transfer" && (
            <p style={S.help}>Enter the person who will take over. You keep access until they open the emailed link, set a password and sign in once. After that your account is switched off and you are signed out.</p>
          )}
          <label style={S.label}>Name<Req /></label>
          <input style={{ ...S.input, maxWidth: "420px" }} maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label style={S.label}>Email<Req /></label>
          <input style={{ ...S.input, maxWidth: "420px" }} type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label style={S.label}>Your current password<Req /></label>
          <input style={{ ...S.input, maxWidth: "420px" }} type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {mode === "transfer" && (
            <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "14px", fontFamily: FONT, fontSize: "0.82rem", maxWidth: "460px" }}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: "3px" }} />
              <span>I understand my administrator access will end once they sign in.</span>
            </label>
          )}
          {error && <div role="alert" style={S.err}>{error}</div>}
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <button type="button" style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submit}>
              {busy ? "Working…" : mode === "add" ? "Create and send link" : "Start transfer"}
            </button>
            <button type="button" style={S.btn2} disabled={busy} onClick={close}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
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

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pending, setPending] = useState(null);   // { email } while a transfer of this account is pending
  const [confirm, confirmDialog] = useConfirm();

  const loadName = async () => {
    try {
      const snap = await getDoc(doc(db, "admins", admin.uid));
      const d = snap.data() || {};
      setName(d.name || "");
      setPending(d.transferPendingTo ? { email: d.transferPendingEmail || "" } : null);
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
  // Firebase first mails a verification link to the NEW address; the change only happens once it is
  // opened, so a typo can never lock you out. Until then the current email keeps working.
  const submitEmail = async () => {
    setEmailError(""); setEmailInfo("");
    const next = norm(emailForm.email).toLowerCase();
    if (!EMAIL_RE.test(next)) { setEmailError("Enter a valid email address."); return; }
    if (next === norm(admin.email).toLowerCase()) { setEmailError("That is already your sign-in email."); return; }
    if (!emailForm.password) { setEmailError("Enter your current password to confirm."); return; }
    if (!(await confirm({
      title: "Change sign-in email",
      body: `Are you sure you want to change your sign-in email to ${next}? We'll send a verification link to that address first, and the change only happens once it is opened.`,
      confirmLabel: "Send link",
    }))) return;
    setEmailBusy(true);
    try {
      await reauthenticate(emailForm.password);
      try {
        await verifyBeforeUpdateEmail(auth.currentUser, next, { url: `${window.location.origin}/admin` });
      } catch (err) {
        // The site isn't in Firebase's authorized domains for the return link: send it without one.
        if (err?.code === "auth/unauthorized-continue-uri" || err?.code === "auth/invalid-continue-uri") {
          await verifyBeforeUpdateEmail(auth.currentUser, next);
        } else { throw err; }
      }
      setEmailForm({ email: "", password: "" });
      setEmailInfo(`We sent a verification link to ${next}. Your sign-in email changes after you open it. Until then, keep signing in with ${admin.email}. After the change you will be asked to sign in again with the new email.`);
    } catch (err) {
      setEmailError(emailChangeMessage(err));
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
    } catch (err) {
      setPwError(err?.message || "Could not change the password.");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div>
      {confirmDialog}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <h2 style={S.h2}>Personal information</h2>
          {!editingName && <button type="button" style={S.btn2} onClick={() => { setNameDraft(name); setNameError(""); setEditingName(true); }}>Edit name</button>}
        </div>
        {loadError && <div role="alert" style={S.err}>{loadError}</div>}

        {!editingName ? (
          <InfoRow label="Name">{name || "—"}</InfoRow>
        ) : (
          <>
            <label style={S.label}>Name<Req /></label>
            <input style={{ ...S.input, maxWidth: "420px" }} value={nameDraft} maxLength={60} onChange={(e) => setNameDraft(e.target.value)} />
            <FieldError>{nameError}</FieldError>
            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              <button type="button" style={{ ...S.btn, opacity: savingName ? 0.6 : 1 }} disabled={savingName} onClick={saveName}>{savingName ? "Saving…" : "Save"}</button>
              <button type="button" style={S.btn2} disabled={savingName} onClick={async () => {
              if (norm(nameDraft) !== norm(name)
                && !(await confirm({ title: "Cancel changes", body: "Are you sure you want to cancel? Your changes will be discarded.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" }))) return;
              setEditingName(false);
            }}>Cancel</button>
            </div>
          </>
        )}
        <InfoRow label="Email">{admin.email || "—"}</InfoRow>
        <InfoRow label="Role">Administrator</InfoRow>
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>Sign-in email</h2>
        <p style={S.help}>
          This is the email you sign in with, and where password reset links are sent. To change it, enter the new email and your
          current password. We’ll send a verification link to the new address, and the change takes effect when you open it.
        </p>
        <label style={S.label}>New email<Req /></label>
        <input style={{ ...S.input, maxWidth: "420px" }} type="email" autoComplete="off" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} />
        <label style={S.label}>Current password<Req /></label>
        <input style={{ ...S.input, maxWidth: "420px" }} type="password" autoComplete="current-password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} />
        {emailError && <div role="alert" style={S.err}>{emailError}</div>}
        {emailInfo && <div role="status" style={{ ...S.okMsg, margin: "14px 0 0" }}>{emailInfo}</div>}
        <button type="button" style={{ ...S.btn, marginTop: "14px", opacity: emailBusy ? 0.6 : 1 }} disabled={emailBusy} onClick={submitEmail}>
          {emailBusy ? "Sending…" : "Send verification link"}
        </button>
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>Change password</h2>
        <p style={S.help}>Enter your current password, then choose a new one.</p>
        <label style={S.label}>Current password<Req /></label>
        <input style={{ ...S.input, maxWidth: "420px" }} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <label style={S.label}>New password<Req /></label>
        <input style={{ ...S.input, maxWidth: "420px" }} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <PasswordChecklist password={pw.next} />
        <label style={S.label}>Confirm new password<Req /></label>
        <input style={{ ...S.input, maxWidth: "420px" }} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        {pwError && <div role="alert" style={S.err}>{pwError}</div>}
        <button type="button" style={{ ...S.btn, marginTop: "14px", opacity: pwBusy ? 0.6 : 1 }} disabled={pwBusy} onClick={submitPassword}>
          {pwBusy ? "Saving…" : "Change password"}
        </button>
      </div>

      <AdminAccountsCard pending={pending} onChanged={loadName} flash={flash} confirm={confirm} />
    </div>
  );
};

// ═══════════════════════════ Dashboard shell ═══════════════════════════
// Same layout as the Student / Coordinator / Company dashboards: black top bar with the
// logo, a 260px sidebar (slide-in drawer on mobile/tablet) with the role label and Log Out,
// and a light content area.
const PAGE_TITLES = {
  departments:  { title: "Departments & Programs", sub: "Add departments, programs and majors. Changes show up across OJTern right away." },
  coordinators: { title: "Coordinators",           sub: "Invite coordinators and choose which department each one handles." },
  accountprofile: { title: "Account Profile",      sub: "Your administrator details, password and administrator accounts." },
};

const AdminDashboard = ({ admin }) => {
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

  const flashTimer = useRef(null);
  const flash = (m) => {
    setNotice(m);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setNotice(""), 6000);
  };

  const navigate = (key) => { setActiveNav(key); setDrawerOpen(false); setNotice(""); setNotifOpen(false); };
  const askLogout = () => { setDrawerOpen(false); setShowLogout(true); };
  const confirmLogout = async () => {
    setShowLogout(false);
    // Stays on the admin page: onAuthStateChanged in <AdminScreen> brings the sign-in form back.
    try { await signOut(auth); } catch (e) { console.error("Logout failed:", e); }
  };

  const page = PAGE_TITLES[activeNav] || PAGE_TITLES.departments;

  return (
    <>
      <AdminStyles />
      {showLogout && <LogoutConfirmModal onConfirm={confirmLogout} onCancel={() => setShowLogout(false)} />}
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
              <img src={logo} alt="OJTern" style={{ width: "40px", height: "40px", objectFit: "contain", flexShrink: 0 }} />
              <span style={{ fontFamily: logoFont, fontSize: "clamp(1.1rem, 3vw, 1.5rem)", color: paper, letterSpacing: "0.03em" }}>OJTern</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
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
                  <img src={logo} alt="OJTern" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
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
              <div style={{ width: "100%", maxWidth: "1040px", margin: "0 auto", padding: isMobile ? "20px 14px 64px" : "28px 24px 64px", boxSizing: "border-box" }}>
                <h1 style={{ fontFamily: uiFont, fontWeight: 600, fontSize: "clamp(1.5rem, 4vw, 2.2rem)", color: ink, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{page.title}</h1>
                <p style={{ fontFamily: uiFont, fontSize: "clamp(0.85rem, 2vw, 1rem)", color: inkMuted, margin: "0 0 22px" }}>{page.sub}</p>
                {notice && <div role="status" style={S.okMsg}>{notice}</div>}
                {activeNav === "departments" ? <DepartmentsTab depts={depts} loaded={loaded} flash={flash} />
                  : activeNav === "coordinators" ? <CoordinatorsTab admin={admin} depts={depts} flash={flash} />
                  : <AccountProfile admin={admin} flash={flash} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
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

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { setAdmin(null); setChecking(false); return; }
    try {
      // A coordinator/student/company who happens to be signed in is simply not an admin here:
      // we show the admin sign-in form and do NOT sign them out.
      const snap = await getDoc(doc(db, "admins", u.uid));
      const ok = snap.exists() && snap.get("role") === "admin" && snap.get("status") === "active";
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

  if (checking) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: paperTint, color: inkMuted, fontFamily: uiFont }}>Loading…</div>;
  return admin ? <AdminDashboard admin={admin} /> : <AdminSignIn onExit={isStandalone() ? undefined : onExit} />;
};

export default AdminScreen;