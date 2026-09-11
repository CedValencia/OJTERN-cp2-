import React, { useState, useRef, useEffect, useMemo } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebase";
import { changePassword } from "./AuthService";
import { useDepartmentsPrograms } from "./departmentsPrograms";
import { color, font, type, space, radius, shadow, ease } from "./theme";

import PersonalAccountProfile from "../icons/personalaccountprofile.png";
import viewIcon from "../icons/view.png";

// ── Design tokens, aliased for this screen ────────────────────────────────────
// Same aliases as CoordinatorAccountProfileScreen — lahat galing sa theme.js.
// Walang hardcoded hex dito; sa theme.js lang ang edit kung magbabago ang palette.
const ink          = color.ink;
const inkBody      = color.inkBody;
const inkMuted     = color.inkMuted;
const inkFaint     = color.inkFaint;
const surface      = color.wine600;      // cards, rows, modals
const page         = color.wine900;      // page background
const field        = color.wine800;      // inputs / neutral fills
const line         = color.wine700;      // hairlines & borders
const lineSoft     = color.wine800;
const panel        = color.blush100;     // dark panels (banner, headers, footers)
const panelDeep    = color.blush50;
const onPanel      = color.onWine;
const onPanelDim   = color.onWineMuted;
const onPanelFaint = color.onWineFaint;
const danger       = color.danger;
const success      = color.success;

// ── Password strength requirements ────────────────────────────────────────────
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
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", margin: `2px 0 ${space.md} 2px` }}>
      {PASSWORD_RULES.map(rule => {
        const passed = rule.test(password);
        return (
          <div key={rule.key} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={passed ? success : inkFaint} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              {passed ? <polyline points="20 6 9 17 4 12" /> : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
            </svg>
            <span style={{ fontFamily: font.ui, fontSize: "0.8125rem", lineHeight: 1.45, color: passed ? success : inkMuted }}>
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    .sap-screen *, .sap-modal * { box-sizing: border-box; }

    /* ── Profile header card ── */
    .sap-header-card {
      position: relative;
      z-index: 2;
      margin-top: 52px;
      background: ${surface};
      border-radius: ${radius.card};
      border: 1px solid ${line};
      padding: 44px 44px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: ${shadow.pill};
      min-width: 260px;
    }
    @media (max-width: 480px) {
      .sap-header-card { padding: 44px 22px 14px; min-width: unset; width: 90%; }
    }

    /* ── Menu body ── */
    .sap-body {
      flex: 1;
      overflow-y: auto;
      padding: 0 clamp(16px, 4vw, 32px) 32px;
      background: ${page};
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    /* ── Grouped list ── */
    .sap-menu-stack { width: 100%; }
    .sap-menu-group { margin-bottom: ${space.lg}; }

    /* ── Menu row ── */
    .sap-menu-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${space.md};
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.pill};
      padding: 15px 22px;
      margin-bottom: 10px;
      cursor: pointer;
      box-shadow: ${shadow.input};
      transition: border-color 220ms ${ease}, box-shadow 220ms ${ease};
      width: 100%;
      text-align: left;
      font: inherit;
    }
    .sap-menu-row:last-child { margin-bottom: 0; }
    .sap-menu-row:hover {
      border-color: ${color.wine400};
      box-shadow: 0 8px 22px rgba(10,10,10,0.08);
    }
    @media (max-width: 480px) {
      .sap-menu-row { padding: 13px 16px; }
    }

    /* ── Section header bar ── */
    .sap-section-header {
      background: ${panel};
      padding: 16px clamp(16px, 4vw, 28px);
      display: flex;
      align-items: center;
      gap: ${space.md};
      flex-shrink: 0;
    }

    /* ── Personal info body ── */
    .sap-info-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: clamp(16px, 4vw, 28px) clamp(14px, 4vw, 32px);
      background: ${page};
    }

    /* ── Inner info card ── */
    .sap-info-card { width: 100%; }

    /* ── Info row ── */
    .sap-info-row {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.card};
      padding: 14px 18px;
      margin-bottom: 10px;
      box-shadow: ${shadow.input};
    }
    @media (max-width: 480px) {
      .sap-info-row { padding: 12px 14px; }
    }

    /* ── Modal inner ── */
    .sap-modal-inner {
      background: ${surface};
      border-radius: ${radius.panel};
      box-shadow: ${shadow.panel};
      width: 420px;
      max-width: 88vw;
      max-height: 62vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    /* ── Modal scroll body ── */
    .sap-modal-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: ${space.lg};
    }
    @media (max-width: 480px) {
      .sap-modal-inner { max-width: 84vw; max-height: 48vh; }
      .sap-modal-body { padding: ${space.md}; }
    }

    /* ── Modal footer ── */
    .sap-modal-footer {
      background: ${panel};
      border-top: 1px solid ${line};
      padding: 12px ${space.lg};
      display: flex;
      justify-content: flex-end;
      gap: ${space.sm};
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    @media (max-width: 400px) {
      .sap-modal-footer { padding: 10px 14px; flex-direction: column-reverse; align-items: stretch; }
      .sap-modal-footer button { width: 100%; text-align: center; }
    }

    /* ── Divider line ── */
    .sap-divider {
      height: 1px;
      background: ${line};
      margin: ${space.md} clamp(16px, 4vw, 32px) ${space.lg};
    }

    /* ── Save row ── */
    .sap-save-row {
      display: flex;
      justify-content: flex-end;
      gap: ${space.sm};
      margin-top: ${space.md};
      flex-wrap: wrap;
    }

    /* Visible keyboard focus on every control in this screen */
    .sap-screen :focus-visible,
    .sap-modal :focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: ${radius.pill};
    }

    @keyframes sapFadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes sapLift   { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
    .sap-overlay { animation: sapFadeIn 180ms ${ease} both; }
    .sap-dialog  { animation: sapLift 240ms ${ease} both; }

    @media (prefers-reduced-motion: reduce) {
      .sap-overlay, .sap-dialog { animation: none !important; }
      .sap-menu-row { transition: none !important; }
    }
  `}</style>
);

// ── Legal panel styles ────────────────────────────────────────────────────────
// Same reading layout as the coordinator's legal screens — progress rail,
// "On this page" sidebar, sectioned body — measured against this panel's own
// scroll container, since it opens inside the content area beside the nav
// rather than taking over the window.
const LegalStyles = () => (
  <style>{`
    .legal-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; background: ${page}; }
    .legal-progress-track { height: 3px; flex-shrink: 0; background: ${lineSoft}; }
    .legal-progress-fill {
      height: 100%;
      background: ${inkMuted};
      transition: width 120ms linear;
    }

    .legal-cols { flex: 1; min-height: 0; display: flex; }

    .legal-toc {
      width: clamp(130px, 30vw, 240px);
      flex-shrink: 0;
      overflow-y: auto;
      padding: clamp(20px, 3vw, 28px) 0 40px clamp(16px, 3vw, 28px);
      border-right: 1px solid ${line};
    }
    .legal-toc-heading {
      font-family: ${font.ui};
      font-size: 0.8125rem;
      font-weight: 500;
      color: ${inkMuted};
      margin: 0 0 12px;
    }
    .legal-toc-btn {
      display: block; width: 100%; text-align: left;
      background: none; border: none; cursor: pointer;
      padding: 7px 0 7px 12px;
      font-family: ${font.ui};
      font-size: 0.8125rem;
      line-height: 1.45;
      transition: border-color 160ms ${ease}, color 160ms ${ease};
    }

    .legal-scroll {
      flex: 1;
      min-width: 0;
      position: relative;
      overflow-y: auto;
      padding: clamp(20px, 3vw, 32px) clamp(16px, 4vw, 44px) 56px;
    }

    @media (max-width: 480px) {
      .legal-toc { padding-left: 12px; padding-right: 8px; }
      .legal-toc-heading { font-size: 0.75rem; }
      .legal-toc-btn { font-size: 0.75rem; padding: 6px 0 6px 8px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .legal-progress-fill, .legal-toc-btn { transition: none !important; }
    }
  `}</style>
);

// ── Shared field styles ───────────────────────────────────────────────────────
const fieldStyle = {
  width: "100%", padding: "11px 16px",
  background: field, border: `1px solid ${line}`, borderRadius: radius.pill,
  color: ink, fontFamily: font.ui, ...type.body,
  outline: "none", boxSizing: "border-box",
};

const labelStyle = {
  fontFamily: font.ui, ...type.label,
  color: ink, marginBottom: "6px", display: "block",
};

const errorTextStyle = { color: danger, fontSize: "0.8125rem", fontFamily: font.ui, margin: `0 0 ${space.sm} 6px` };

// ── Icons ─────────────────────────────────────────────────────────────────────
const EditIcon = ({ size = 16, stroke = ink }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const EyeIcon = ({ show, onClick }) => (
  <span onClick={onClick} role="button" tabIndex={0} aria-label={show ? "Hide password" : "Show password"}
    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", display: "flex", alignItems: "center", color: inkMuted }}>
    {show ? (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ) : (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )}
  </span>
);

const GlobalStyles = () => {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      input[type="password"]::-ms-reveal,
      input[type="password"]::-ms-clear,
      input[type="password"]::-webkit-credentials-auto-fill-button,
      input[type="password"]::-webkit-strong-password-auto-fill-button { display: none !important; }
      input::-webkit-contacts-auto-fill-button,
      input::-webkit-credentials-auto-fill-button { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
};

const PasswordInput = ({ value, onChange, placeholder = "••••••••", onKeyDown, invalid }) => {
  const [show, setShow] = useState(false);
  const blockPaste = (e) => e.preventDefault();
  return (
    <div style={{ position: "relative", marginBottom: space.sm }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder}
        onPaste={blockPaste} onCopy={blockPaste} onCut={blockPaste}
        style={{ ...fieldStyle, paddingRight: "44px", borderColor: invalid ? danger : line }} />
      <EyeIcon show={show} onClick={() => setShow(s => !s)} />
    </div>
  );
};

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Go back"
      style={{ background: "transparent", border: `1px solid ${onPanelFaint}`, borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: onPanel, transition: `background 240ms ${ease}` }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(250,250,250,0.10)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  );
}

// ── Shared section header bar ─────────────────────────────────────────────────
function SectionHeaderBar({ title, onBack }) {
  return (
    <div className="sap-section-header">
      {onBack && <BackButton onClick={onBack} />}
      <h2 style={{ fontFamily: font.ui, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel, margin: 0 }}>{title}</h2>
    </div>
  );
}

// ── Row icons ─────────────────────────────────────────────────────────────────
// Outline strokes lang, 1.8 weight — para hindi nakikipag-agawan sa label.
const RowIcon = ({ children }) => (
  <span style={{ width: "34px", height: "34px", borderRadius: "10px", background: lineSoft, border: `1px solid ${line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ink }}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </span>
);

const icons = {
  person:   <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  key:      <><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  shield:   <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>,
};

// ── Menu row + grouped section ────────────────────────────────────────────────
const MenuRow = ({ label, icon, onClick }) => (
  <button type="button" onClick={onClick} className="sap-menu-row">
    <span style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
      {icon && <RowIcon>{icons[icon]}</RowIcon>}
      <span style={{ fontFamily: font.ui, fontSize: "1rem", fontWeight: 500, letterSpacing: "-0.01em", color: ink }}>{label}</span>
    </span>
    <img src={viewIcon} alt="" style={{ width: "30px", height: "30px", objectFit: "contain", flexShrink: 0 }} />
  </button>
);

const MenuGroup = ({ title, children }) => (
  <div className="sap-menu-group">
    <p style={{ fontFamily: font.ui, fontSize: "1rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, margin: `0 0 10px 6px` }}>{title}</p>
    {children}
  </div>
);

// ── Modal footer buttons ──────────────────────────────────────────────────────
const FooterGhostButton = ({ children, ...rest }) => (
  <button {...rest} style={{ padding: "9px 20px", borderRadius: radius.pill, background: "transparent", color: onPanelDim, border: `1px solid ${onPanelFaint}`, fontFamily: font.ui, ...type.control, cursor: "pointer" }}>{children}</button>
);

const FooterSolidButton = ({ children, disabled, ...rest }) => (
  <button {...rest} disabled={disabled} style={{ padding: "9px 22px", borderRadius: radius.pill, background: color.white, color: ink, border: "none", fontFamily: font.ui, ...type.control, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>{children}</button>
);

const ModalTitle = ({ children, sub }) => (
  <div style={{ marginBottom: space.md }}>
    <p style={{ fontFamily: font.ui, fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, margin: 0 }}>{children}</p>
    {sub && <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, margin: "4px 0 0" }}>{sub}</p>}
  </div>
);

// ── Status dialog (shared success / confirmation sheet) ───────────────────────
const StatusDialog = ({ icon, title, body, actionLabel = "Done", onAction }) => (
  <div className="sap-modal sap-overlay" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: space.md }}>
    <div className="sap-dialog" style={{ background: surface, borderRadius: radius.panel, border: `1px solid ${line}`, boxShadow: shadow.panel, padding: `${space.xl} ${space.lg}`, width: "clamp(280px, 85vw, 390px)", display: "flex", flexDirection: "column", alignItems: "center", gap: space.sm, textAlign: "center" }}>
      <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: lineSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: space.xs }}>
        {icon}
      </div>
      <h3 style={{ fontFamily: font.ui, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, margin: 0 }}>{title}</h3>
      <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, margin: 0 }}>{body}</p>
      <button onClick={onAction}
        style={{ width: "100%", padding: "12px", borderRadius: radius.pill, border: "none", background: panel, color: onPanel, fontFamily: font.ui, ...type.control, cursor: "pointer", marginTop: space.sm, boxShadow: shadow.pill, transition: `background 240ms ${ease}` }}
        onMouseEnter={e => (e.currentTarget.style.background = panelDeep)}
        onMouseLeave={e => (e.currentTarget.style.background = panel)}>
        {actionLabel}
      </button>
    </div>
  </div>
);

const CheckIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

const StudentSaveSuccessModal = ({ onClose }) => (
  <StatusDialog
    icon={<CheckIcon />}
    title="Changes saved"
    body="Your personal information has been updated."
    actionLabel="Done"
    onAction={onClose}
  />
);

// ─── College & Program Data ───────────────────────────────────────────────────
// Loaded live from Firestore via useDepartmentsPrograms() (see
// ./departmentsPrograms) — the same source SignUpStep1Screen,
// CoordinatorAccountProfileScreen, and CompanyCreatePostScreen all use, so
// a student's College/Program always matches the exact same full names a
// company registers/posts under and a coordinator is assigned to. This used
// to be its own separate hardcoded copy (with its own short CODES like
// "CCS"/"BSIT" as the actual stored value — see the legacy-migration note
// near LEGACY_COLLEGE_CODE_MAP below for why that broke matching).

const YEAR_SECTIONS = [
  "4-A", "4-B", "4-C", "4-D",
];

// ─── PersonalInfoScreen ───────────────────────────────────────────────────────
const PersonalInfoScreen = ({ onBack, user }) => {
  const [editing, setEditing] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const editingRef = useRef(false);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState("");

  const [form, setForm] = useState({
    studentId:      "",
    lastName:       "",
    middleInitial:  "",
    firstName:      "",
    suffix:         "",
    collegeCode:    "",   // holds the full College name now (e.g. "College of Computer Studies") — see LEGACY_COLLEGE_CODE_MAP below for why the field name still says "Code"
    programCode:    "",   // holds the full Program name now
    yearSection:    "",
    sex:            "",
    age:            "",
    email:          "",
  });

  const { departments, departmentNames } = useDepartmentsPrograms();

  // ── Load student data from Firestore ──────────────────────────────────────
  // ── Legacy short-code migration ────────────────────────────────────────
  // Student accounts created before this screen switched to storing full
  // College/Program names (the same full names companies register/post
  // under and coordinators are assigned to — see ./departmentsPrograms and
  // CompanyCreatePostScreen.jsx's courseSelections) have `college`/`program`
  // saved as short CODES instead ("CCS", "BSIT"). Those codes never matched
  // anything elsewhere in the app, which silently broke Find Company
  // filtering for every such student. These two maps translate an old code
  // into today's canonical full name purely for display/matching here;
  // saving the profile (even with no other change) rewrites the Firestore
  // fields to the full name, self-healing the record from then on — same
  // pattern as the coordinator-side migration.
  const LEGACY_COLLEGE_CODE_MAP = {
    CCS:  "College of Computer Studies",
    CBA:  "College of Business and Accountancy",
    CCJE: "College of Criminal Justice Education",
    CLA:  "College of Liberal Arts",
    CED:  "College of Education",
    CHTM: "College of Hospitality and Tourism Management",
  };
  const LEGACY_PROGRAM_CODE_MAP = {
    "BSIT":                                  "Bachelor of Science in Information Technology",
    "BSBA (Major in Marketing Management)":  "BS Business Administration — Major in Marketing Management",
    "BSA":                                   "Bachelor of Science in Accountancy",
    "BS CRIM":                               "Bachelor of Science in Criminology",
    "BA POLSCI":                             "Bachelor of Arts in Political Science",
    "BEED":                                  "Bachelor of Elementary Education",
    "BSED (Major in English)":               "BS Education — Major in English",
    "BSED (Major in Mathematics)":           "BS Education — Major in Mathematics",
    "BSTM":                                  "Bachelor of Science in Tourism Management",
    "BSHM":                                  "Bachelor of Science in Hospitality Management",
  };

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "students", user.uid), (snap) => {
      if (snap.exists() && !editingRef.current) {
        const d = snap.data();
        const rawCollege = d.college || "";
        const rawProgram = d.program || "";
        setForm({
          studentId:      d.studentId      || "",
          lastName:       d.lastName       || "",
          middleInitial:  d.middleInitial  || "",
          firstName:      d.firstName      || "",
          suffix:         d.suffix         || "",
          collegeCode:    LEGACY_COLLEGE_CODE_MAP[rawCollege] || rawCollege,
          programCode:    LEGACY_PROGRAM_CODE_MAP[rawProgram] || rawProgram,
          yearSection:    d.yearSection    || "",
          sex:            d.sex            || "",
          age:            String(d.age     || ""),
          email:          d.email          || "",
        });
      }
      setLoading(false);
    }, (err) => {
      console.error("Failed to load student profile:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const [errors, setErrors] = useState({});

  // form.collegeCode/programCode already ARE the full display names now, so
  // no separate code→label lookup is needed the way the old hardcoded
  // COLLEGE_PROGRAM_MAP required.
  const collegeLabel   = form.collegeCode || "—";
  const programLabel   = form.programCode || "—";
  const programEntries = (departments[form.collegeCode]?.programs || []).map(p => [p.name, p.name]);
  // Defensive fallback: if the student's stored program/college doesn't match
  // any currently-known name (e.g. a legacy code this file doesn't recognize,
  // or a Program removed/renamed since), still show it as a selectable
  // option instead of leaving the dropdown blank / forcing a reselect the
  // student didn't ask for.
  const programEntriesForSelect = (form.programCode && !programEntries.some(([name]) => name === form.programCode))
    ? [...programEntries, [form.programCode, programLabel]]
    : programEntries;
  const collegeEntriesForSelect = (form.collegeCode && !departmentNames.includes(form.collegeCode))
    ? [...departmentNames.map(name => [name, { label: name }]), [form.collegeCode, { label: collegeLabel }]]
    : departmentNames.map(name => [name, { label: name }]);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const handleCollegeChange = (code) => setForm(f => ({ ...f, collegeCode: code, programCode: "" }));
  const handleProgramChange = (code) => setForm(f => ({ ...f, programCode: code }));

  const validateMiddleInitial = (v) => {
    if (!v) return "";
    if (!/^[A-Z]\.$/.test(v)) return "Use a single letter and a period, e.g. A.";
    return "";
  };

  const validateAge = (v) => {
    if (!v) return "Age is required.";
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 100) return "Enter an age between 1 and 100.";
    return "";
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "First name is required.";
    if (!form.collegeCode) e.collegeCode = "College is required.";
    if (!form.programCode) e.programCode = "Program is required.";
    if (!form.lastName.trim())  e.lastName  = "Last name is required.";
    const miErr = validateMiddleInitial(form.middleInitial);
    if (miErr) e.middleInitial = miErr;
    if (!form.suffix) e.suffix = "Select a suffix, or None.";
    if (!form.yearSection) e.yearSection = "Year and section is required.";
    if (!form.sex) e.sex = "Select sex.";
    const ageErr = validateAge(form.age);
    if (ageErr) e.age = ageErr;
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Invalid email address.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError("");
    try {
      await updateDoc(doc(db, "students", user?.uid), {
        // studentId intentionally omitted — no longer editable from this screen.
        lastName:       form.lastName,
        middleInitial:  form.middleInitial,
        firstName:      form.firstName,
        suffix:         form.suffix,
        fullName: form.firstName + " " + (form.middleInitial ? form.middleInitial + " " : "") + form.lastName + (form.suffix && form.suffix !== "None" ? " " + form.suffix : ""),
        college:        form.collegeCode,
        program:        form.programCode,
        yearSection:    form.yearSection,
        sex:            form.sex,
        age:            Number(form.age),
        email:          form.email,
      });
      setEditing(false);
      setErrors({});
      setShowSaveSuccess(true);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setSaveError(err.message || "Your information didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleMiddleInitialChange = (v) => {
    const filtered = v.replace(/[^A-Z.]/g, "").slice(0, 2);
    setField("middleInitial", filtered);
    setErrors(prev => ({ ...prev, middleInitial: validateMiddleInitial(filtered) }));
  };

  const handleAgeChange = (v) => {
    if (v === "" || /^\d+$/.test(v)) {
      setField("age", v);
      setErrors(prev => ({ ...prev, age: validateAge(v) }));
    }
  };

  const rowLabel = { fontFamily: font.ui, ...type.helper, color: inkMuted, display: "block", marginBottom: "3px" };
  const rowValue = { fontFamily: font.ui, ...type.body, color: ink, margin: 0, display: "block" };

  const inlineInputStyle = {
    background: "transparent", border: "none", borderBottom: `1px solid ${line}`,
    color: ink, fontFamily: font.ui, ...type.body,
    outline: "none", width: "100%", padding: "4px 0", boxSizing: "border-box",
  };
  const inlineInputErrorStyle = { ...inlineInputStyle, borderBottom: `1.5px solid ${danger}` };
  const selectStyle      = { ...inlineInputStyle, cursor: "pointer" };
  const selectErrorStyle = { ...inlineInputErrorStyle, cursor: "pointer" };
  const inlineErrText = { color: danger, fontSize: "0.75rem", fontFamily: font.ui, margin: "4px 0 0" };

  const fieldLabel = (text) => <span style={rowLabel}>{text}</span>;
  const errText = (msg) => (msg ? <p style={inlineErrText}>{msg}</p> : null);

  if (loading) {
    return (
      <div className="sap-screen" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: page }}>
        <SectionHeaderBar title="Personal information" onBack={onBack} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontFamily: font.ui, ...type.body, color: inkFaint }}>Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sap-screen" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: page }}>
      <SectionHeaderBar title={editing ? "Edit personal information" : "Personal information"} onBack={onBack} />

      <div className="sap-info-body">
        <div
          className="sap-info-card"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.tagName === "INPUT" && editing) {
              e.preventDefault();
              handleSave();
            }
          }}
        >
          {/* Edit button */}
          {!editing && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: space.sm }}>
              <button onClick={() => setEditing(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 16px", borderRadius: radius.pill, border: `1px solid ${line}`, background: surface, color: ink, fontFamily: font.ui, ...type.control, cursor: "pointer", boxShadow: shadow.input }}>
                <EditIcon size={14} />
                Edit
              </button>
            </div>
          )}

          {/* Student ID — never editable: it's how the account is looked up
              at login (see AuthService.signIn resolving email by studentId),
              so changing it here would be able to break sign-in / mismatch
              the account's own identifier. Always shown as plain text, even
              while the rest of the form is in edit mode. */}
          <div className="sap-info-row">
            {fieldLabel("Student ID")}
            <span style={rowValue}>{form.studentId || "—"}</span>
          </div>

          {/* First name */}
          <div className="sap-info-row">
            {fieldLabel("First name")}
            {editing ? (
              <>
                <input
                  value={form.firstName}
                  onChange={e => { setField("firstName", e.target.value); setErrors(p => ({ ...p, firstName: "" })); }}
                  placeholder="First name"
                  style={errors.firstName ? inlineInputErrorStyle : inlineInputStyle}
                />
                {errText(errors.firstName)}
              </>
            ) : (
              <span style={rowValue}>{form.firstName || "—"}</span>
            )}
          </div>

          {/* Middle initial */}
          <div className="sap-info-row">
            {fieldLabel("Middle initial")}
            {editing ? (
              <>
                <input
                  value={form.middleInitial}
                  onChange={e => handleMiddleInitialChange(e.target.value)}
                  placeholder="e.g. M."
                  maxLength={2}
                  style={errors.middleInitial ? inlineInputErrorStyle : inlineInputStyle}
                />
                {errText(errors.middleInitial)}
              </>
            ) : (
              <span style={rowValue}>{form.middleInitial || "—"}</span>
            )}
          </div>

          {/* Last name */}
          <div className="sap-info-row">
            {fieldLabel("Last name")}
            {editing ? (
              <>
                <input
                  value={form.lastName}
                  onChange={e => { setField("lastName", e.target.value); setErrors(p => ({ ...p, lastName: "" })); }}
                  placeholder="Last name"
                  style={errors.lastName ? inlineInputErrorStyle : inlineInputStyle}
                />
                {errText(errors.lastName)}
              </>
            ) : (
              <span style={rowValue}>{form.lastName || "—"}</span>
            )}
          </div>

          {/* Suffix */}
          <div className="sap-info-row">
            {fieldLabel("Suffix")}
            {editing ? (
              <>
                <select
                  value={form.suffix}
                  onChange={e => { setField("suffix", e.target.value); setErrors(p => ({ ...p, suffix: "" })); }}
                  style={errors.suffix ? selectErrorStyle : selectStyle}
                >
                  <option value="">Select</option>
                  <option value="None">None</option>
                  <option value="Jr.">Jr.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                  <option value="V">V</option>
                </select>
                {errText(errors.suffix)}
              </>
            ) : (
              <span style={rowValue}>{form.suffix && form.suffix !== "None" ? form.suffix : "—"}</span>
            )}
          </div>

          {/* College */}
          <div className="sap-info-row">
            {fieldLabel("College")}
            {editing ? (
              <>
                <select
                  value={form.collegeCode}
                  onChange={e => handleCollegeChange(e.target.value)}
                  style={errors.collegeCode ? selectErrorStyle : selectStyle}
                >
                  <option value="">Select</option>
                  {collegeEntriesForSelect.map(([code, info]) => (
                    <option key={code} value={code}>{info.label}</option>
                  ))}
                </select>
                {errText(errors.collegeCode)}
              </>
            ) : (
              <span style={rowValue}>{collegeLabel}</span>
            )}
          </div>

          {/* Program */}
          <div className="sap-info-row">
            {fieldLabel("Program")}
            {editing ? (
              <>
                <select
                  value={form.programCode}
                  onChange={e => handleProgramChange(e.target.value)}
                  style={errors.programCode ? selectErrorStyle : selectStyle}
                >
                  <option value="">Select</option>
                  {programEntriesForSelect.map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
                {errText(errors.programCode)}
              </>
            ) : (
              <span style={rowValue}>{programLabel}</span>
            )}
          </div>

          {/* Year and section */}
          <div className="sap-info-row">
            {fieldLabel("Year and section")}
            {editing ? (
              <>
                <select
                  value={form.yearSection}
                  onChange={e => { setField("yearSection", e.target.value); setErrors(p => ({ ...p, yearSection: "" })); }}
                  style={errors.yearSection ? selectErrorStyle : selectStyle}
                >
                  <option value="">Select</option>
                  {YEAR_SECTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errText(errors.yearSection)}
              </>
            ) : (
              <span style={rowValue}>{form.yearSection || "—"}</span>
            )}
          </div>

          {/* Sex */}
          <div className="sap-info-row">
            {fieldLabel("Sex")}
            {editing ? (
              <>
                <select
                  value={form.sex}
                  onChange={e => { setField("sex", e.target.value); setErrors(p => ({ ...p, sex: "" })); }}
                  style={errors.sex ? selectErrorStyle : selectStyle}
                >
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
                {errText(errors.sex)}
              </>
            ) : (
              <span style={rowValue}>{form.sex || "—"}</span>
            )}
          </div>

          {/* Age */}
          <div className="sap-info-row">
            {fieldLabel("Age")}
            {editing ? (
              <>
                <input
                  value={form.age}
                  onChange={e => handleAgeChange(e.target.value)}
                  placeholder="1–100"
                  style={errors.age ? inlineInputErrorStyle : inlineInputStyle}
                />
                {errText(errors.age)}
              </>
            ) : (
              <span style={rowValue}>{form.age || "—"}</span>
            )}
          </div>

          {/* Email address */}
          <div className="sap-info-row">
            {fieldLabel("Email address")}
            {editing ? (
              <>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => { setField("email", e.target.value); setErrors(p => ({ ...p, email: "" })); }}
                  placeholder="example@gmail.com"
                  style={errors.email ? inlineInputErrorStyle : inlineInputStyle}
                />
                {errText(errors.email)}
              </>
            ) : (
              <span style={rowValue}>{form.email || "—"}</span>
            )}
          </div>

          {saveError && (
            <p style={{ ...errorTextStyle, textAlign: "center", margin: `${space.sm} 0 0` }}>{saveError}</p>
          )}

          {/* Cancel / Save */}
          {editing && (
            <div className="sap-save-row">
              <button onClick={() => { setEditing(false); setErrors({}); setSaveError(""); }}
                style={{ padding: "9px 20px", borderRadius: radius.pill, background: "transparent", color: inkMuted, border: `1px solid ${line}`, fontFamily: font.ui, ...type.control, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "9px 22px", borderRadius: radius.pill, background: panel, color: onPanel, border: "none", fontFamily: font.ui, ...type.control, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: shadow.pill }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showSaveSuccess && <StudentSaveSuccessModal onClose={() => setShowSaveSuccess(false)} />}
    </div>
  );
};

// ─── Reset Password Modal ─────────────────────────────────────────────────────
const ResetPasswordModal = ({ onClose, user, onLogout }) => {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirm, setConfirm]         = useState("");
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleSave();
    }
  };

  const handleSave = async () => {
    const e = {};
    if (!currentPass) e.currentPass = "Enter your current password.";
    if (!newPass) e.newPass = "Enter a new password.";
    else if (!isPasswordStrong(newPass)) e.newPass = "This password doesn't meet all the requirements below.";
    if (newPass !== confirm) e.confirm = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    try {
      // auth.currentUser can be null here if this tab never established its
      // own Firebase Auth session (e.g. persistence is per-tab and this tab
      // was opened/reloaded separately) — every call below would then fail
      // as permission-denied. Fail with a clear message instead.
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        setErrors({ general: "Your session has expired. Refresh the page and log in again." });
        setLoading(false);
        return;
      }
      await changePassword(currentPass, newPass, "students", user?.uid, currentUser.email);
      setSuccess(true);
      setCurrentPass(""); setNewPass(""); setConfirm("");
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErrors({ currentPass: "That current password is incorrect." });
      } else {
        setErrors({ general: err.message || "The password didn't change. Try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  // Password change already signed the user out inside changePassword().
  // "Done" should route the whole app back to the sign-in screen, not just
  // close the modal (which no longer has a valid session anyway).
  const handleDone = () => {
    if (onLogout) onLogout();
    else onClose(); // fallback, shouldn't normally happen
  };

  if (success) {
    return (
      <StatusDialog
        icon={<CheckIcon />}
        title="Password changed"
        body="Your password is updated. Log in again with your new password."
        actionLabel="Done"
        onAction={handleDone}
      />
    );
  }

  return (
    <div className="sap-modal sap-overlay" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: space.md }}>
      <div className="sap-modal-inner sap-dialog">
        <div className="sap-modal-body">
          <ModalTitle sub="Choose a password you don't use anywhere else.">Reset password</ModalTitle>

          <label style={labelStyle}>Current password</label>
          <PasswordInput value={currentPass} onChange={e => { setCurrentPass(e.target.value); setErrors(p => ({ ...p, currentPass: "" })); }} onKeyDown={handleKeyDown} invalid={!!errors.currentPass} />
          {errors.currentPass && <p style={errorTextStyle}>{errors.currentPass}</p>}

          <hr style={{ border: "none", borderTop: `1px solid ${line}`, margin: `${space.lg} 0 ${space.md}` }} />

          <label style={labelStyle}>New password</label>
          <PasswordInput value={newPass} onChange={e => { setNewPass(e.target.value); setErrors(p => ({ ...p, newPass: "" })); }} onKeyDown={handleKeyDown} invalid={!!errors.newPass} />
          {errors.newPass && <p style={errorTextStyle}>{errors.newPass}</p>}

          <PasswordChecklist password={newPass} />

          <label style={labelStyle}>Confirm new password</label>
          <PasswordInput value={confirm} onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: "" })); }} onKeyDown={handleKeyDown} invalid={!!errors.confirm} />
          {errors.confirm && <p style={errorTextStyle}>{errors.confirm}</p>}

          {errors.general && <p style={{ ...errorTextStyle, textAlign: "center", marginTop: space.md }}>{errors.general}</p>}
        </div>
        <div className="sap-modal-footer">
          <FooterGhostButton onClick={onClose}>Cancel</FooterGhostButton>
          <FooterSolidButton onClick={handleSave} disabled={loading}>{loading ? "Saving…" : "Save password"}</FooterSolidButton>
        </div>
      </div>
    </div>
  );
};

// ─── Terms & Conditions Data ──────────────────────────────────────────────────
const TERMS_LAST_UPDATED = "July 19, 2026";

const TERMS_SECTIONS = [
  {
    title: "1. Account Usage",
    items: [
      "Your account is created by an authorized OJT Coordinator and is intended solely for your official On-the-Job Training (OJT) activities.",
      "You must change your temporary password and complete your personal information upon your first login before accessing the Platform's full features.",
    ],
  },
  {
    title: "2. Account Security",
    items: [
      "You are responsible for maintaining the confidentiality of your account credentials.",
      "Do not share your username, student ID, email, or password with anyone.",
      "Immediately report any unauthorized access or suspected security breach to your OJT Coordinator.",
    ],
  },
  {
    title: "3. Accuracy of Information",
    items: [
      "You agree to provide accurate, complete, and up-to-date personal information.",
      "Any false or misleading information may affect your internship application or result in disciplinary action in accordance with School policies.",
    ],
  },
  {
    title: "4. Internship Applications",
    items: [
      "You may use OJTern to browse internship opportunities, submit applications, monitor your application status, and communicate with approved partner companies.",
      "Submission of an application does not guarantee acceptance or internship placement.",
    ],
  },
  {
    title: "5. Acceptable Use",
    intro: "You agree not to misuse the Platform by:",
    items: [
      "Accessing another user's account without authorization;",
      "Uploading harmful, illegal, or inappropriate content;",
      "Providing false information;",
      "Interfering with the operation or security of the Platform; or",
      "Using the Platform for purposes unrelated to the School's OJT Program.",
    ],
  },
  {
    title: "6. Data Privacy",
    items: [
      "Your personal information, including your name, student ID, contact information, resume, and other submitted documents, will be collected and processed solely for internship placement, monitoring, reporting, and other legitimate OJT-related purposes.",
      "Relevant information may be shared only with approved partner companies and authorized School personnel as necessary for internship placement and administration, in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).",
    ],
  },
  {
    title: "7. Account Suspension or Termination",
    items: [
      "The School may suspend or terminate your account if you violate these Terms and Conditions, provide false information, misuse the Platform, or engage in activities that compromise the security or integrity of OJTern.",
    ],
  },
  {
    title: "8. Contact Information",
    items: [
      "For questions, concerns, or requests regarding these Terms or your Personal Information, please contact the School through its designated OJT Coordinator or official support channel.",
      "Email: ojtern@gmail.com",
    ],
  },
];

// ─── Privacy Policy Data ────────────────────────────────────────────────────
const PRIVACY_LAST_UPDATED = "July 19, 2026";

const PRIVACY_SECTIONS = [
  {
    title: "1. Introduction",
    items: [
      'This Privacy Policy explains how OJTern — the On-the-Job Training Management Platform of Dominican College of Tarlac, Inc. ("the School") — collects, uses, stores, and protects your Personal Information as a Student user, in compliance with the Data Privacy Act of 2012 (Republic Act No. 10173).',
      "By creating and using your Student account, you consent to the collection and processing of your Personal Information as described in this Policy.",
    ],
  },
  {
    title: "2. Information We Collect",
    items: [
      "Personal details you provide, such as your full name, student ID, program, year level, contact number, and email address.",
      "Application materials you upload, including your resume, requirements, and other OJT-related documents.",
      "Activity on the Platform, such as internship applications submitted, messages exchanged with Coordinators and Companies, and account login records.",
    ],
  },
  {
    title: "3. How We Use Your Information",
    items: [
      "To create and manage your Student account and verify your enrollment status.",
      "To match you with internship opportunities and process your applications with partner Companies.",
      "To allow your assigned OJT Coordinator to monitor and evaluate your OJT progress.",
      "To send you Platform notifications, such as application status updates and Coordinator announcements.",
    ],
  },
  {
    title: "4. Sharing of Your Information",
    items: [
      "Your name, program, contact information, resume, and application status may be shared with the specific Company you apply to, solely for internship evaluation and placement.",
      "Your information may also be accessed by your assigned OJT Coordinator and other authorized School personnel for administrative and monitoring purposes.",
      "The School does not sell, rent, or trade your Personal Information to third parties for marketing purposes.",
    ],
  },
  {
    title: "5. Data Storage and Security",
    items: [
      "Your information is stored using secure, cloud-based infrastructure with access controls limited to authorized personnel.",
      "The Platform applies reasonable organizational, physical, and technical safeguards to protect your data against unauthorized access, alteration, disclosure, or destruction.",
    ],
  },
  {
    title: "6. Your Rights Under the Data Privacy Act",
    intro: "As a data subject, you have the right to:",
    items: [
      "Be informed of how your Personal Information is collected and processed;",
      "Access the Personal Information the Platform holds about you;",
      "Request correction of inaccurate or outdated information;",
      "Object to or withdraw consent for certain processing, subject to legitimate School requirements; and",
      "File a complaint with the National Privacy Commission if you believe your rights have been violated.",
    ],
  },
  {
    title: "7. Data Retention",
    items: [
      "Your Personal Information is retained for as long as your account remains active, and for a reasonable period afterward as required for School records, reporting, and legal compliance.",
    ],
  },
  {
    title: "8. Changes to This Policy",
    items: [
      "The School may update this Privacy Policy from time to time.",
      "Material changes will be communicated through the Platform or your registered email address.",
    ],
  },
  {
    title: "9. Contact Information",
    items: [
      "For questions, concerns, or requests regarding this Privacy Policy or your Personal Information, please contact the School through your assigned OJT Coordinator or the official support channel.",
      "Email: ojtern@gmail.com",
    ],
  },
];

// ── Email addresses in the legal text ─────────────────────────────────────────
// Gmail's compose URL rather than a plain mailto: — this is a web app, and
// mailto: hands the click to whatever desktop client is registered, which on
// most machines is nothing at all, so the link just looks broken.
const EMAIL_SPLIT = /([\w.+-]+@[\w-]+\.[\w-]+)/g;
const IS_EMAIL    = /^[\w.+-]+@[\w-]+\.[\w-]+$/;
const composeUrl  = (addr) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(addr)}`;

const linkifyEmails = (text) =>
  text.split(EMAIL_SPLIT).map((part, i) => {
    if (!IS_EMAIL.test(part)) return part;
    const linkStyle = { color: ink, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" };
    return <a key={i} href={composeUrl(part)} target="_blank" rel="noopener noreferrer" style={linkStyle}>{part}</a>;
  });

// ── Legal document panel ──────────────────────────────────────────────────────
// Same reading layout the coordinator gets: a progress rail across the top,
// an "On this page" sidebar built straight from the section titles (so it
// can't drift out of sync with the text), and the document body itself.
const LegalPanel = ({ title, lastUpdated, sections, onBack }) => {
  const scrollRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState(null);

  const toc = useMemo(
    () => sections.map((s, i) => ({ id: `sec-${i}`, text: s.title })),
    [sections]
  );

  // Progress + active-section tracking read from this panel's own scroll
  // container, not the window — nothing behind it scrolls here.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const onScroll = () => {
      const max = box.scrollHeight - box.clientHeight;
      setProgress(max > 0 ? Math.min(100, (box.scrollTop / max) * 100) : 0);

      const headings = box.querySelectorAll("[data-heading]");
      const boxTop   = box.getBoundingClientRect().top;
      let current = null;
      headings.forEach(h => {
        if (h.getBoundingClientRect().top - boxTop <= 90) current = h.getAttribute("data-heading");
      });
      // The last section's heading may never cross that threshold if its
      // body is too short to push it up — snap to it at the bottom instead.
      if (max > 0 && box.scrollTop >= max - 2 && toc.length > 0) current = toc[toc.length - 1].id;
      if (current) setActiveId(current);
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => box.removeEventListener("scroll", onScroll);
  }, [toc]);

  // Keep the highlighted rail item in view as the reader moves down.
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(`toc-link-${activeId}`)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const scrollTo = (id) => {
    const el  = document.getElementById(id);
    const box = scrollRef.current;
    if (!el || !box) return;
    box.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
  };

  return (
    <div className="sap-screen legal-panel">
      <LegalStyles />
      <SectionHeaderBar title={title} onBack={onBack} />

      <div className="legal-progress-track">
        <div className="legal-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="legal-cols">
        {toc.length > 0 && (
          <nav className="legal-toc" aria-label="Sections">
            <p className="legal-toc-heading">On this page</p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
              {toc.map(item => {
                const isActive = activeId === item.id;
                return (
                  <li key={item.id} id={`toc-link-${item.id}`}>
                    <button
                      type="button"
                      className="legal-toc-btn"
                      onClick={() => scrollTo(item.id)}
                      style={{
                        borderLeft: `2px solid ${isActive ? ink : "transparent"}`,
                        color: isActive ? ink : inkMuted,
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {item.text}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <div className="legal-scroll" ref={scrollRef}>
          <h1 style={{ fontFamily: font.ui, fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 600, letterSpacing: "-0.02em", color: ink, margin: `0 0 ${space.md}`, lineHeight: 1.2 }}>
            {title}
          </h1>

          {lastUpdated && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, marginBottom: space.xl }}>
              <span style={{ fontFamily: font.ui, ...type.helper, fontWeight: 500, color: onPanel, background: panel, borderRadius: radius.pill, padding: "6px 15px" }}>
                Last updated {lastUpdated}
              </span>
            </div>
          )}

          {sections.map((section, idx) => {
            const id = `sec-${idx}`;
            const isFirst = idx === 0;
            return (
              <section key={section.title}>
                <h2
                  id={id}
                  data-heading={id}
                  style={{
                    fontFamily: font.ui, fontSize: "clamp(1.05rem, 3vw, 1.25rem)", fontWeight: 600,
                    letterSpacing: "-0.01em", color: ink,
                    margin: isFirst ? `0 0 ${space.sm}` : `${space.xl} 0 ${space.sm}`,
                    paddingTop: isFirst ? 0 : space.lg,
                    borderTop: isFirst ? "none" : `1px solid ${line}`,
                    scrollMarginTop: space.lg,
                  }}
                >
                  {section.title}
                </h2>

                {section.intro && (
                  <p style={{ fontFamily: font.ui, ...type.body, lineHeight: 1.7, color: inkBody, margin: `0 0 ${space.sm}`, maxWidth: "74ch" }}>
                    {section.intro}
                  </p>
                )}

                {section.intro ? (
                  <ul style={{ margin: `8px 0 ${space.md}`, paddingLeft: "22px" }}>
                    {section.items.map((item, i) => (
                      <li key={i} style={{ fontFamily: font.ui, ...type.body, lineHeight: 1.7, color: inkBody, marginBottom: "5px", maxWidth: "74ch" }}>
                        {linkifyEmails(item)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  section.items.map((item, i) => (
                    <p key={i} style={{ fontFamily: font.ui, ...type.body, lineHeight: 1.7, color: inkBody, margin: `0 0 ${space.md}`, maxWidth: "74ch" }}>
                      {linkifyEmails(item)}
                    </p>
                  ))
                )}
              </section>
            );
          })}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: space.xl }}>
            <button
              type="button"
              onClick={onBack}
              style={{ padding: "13px 36px", borderRadius: radius.pill, border: "none", background: panel, color: onPanel, fontFamily: font.ui, ...type.control, cursor: "pointer", boxShadow: shadow.pill, transition: `background 240ms ${ease}` }}
              onMouseEnter={e => (e.currentTarget.style.background = panelDeep)}
              onMouseLeave={e => (e.currentTarget.style.background = panel)}
            >
              I understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TermsScreen = ({ onBack }) => (
  <LegalPanel title="Terms and conditions" lastUpdated={TERMS_LAST_UPDATED} sections={TERMS_SECTIONS} onBack={onBack} />
);

const PrivacyScreen = ({ onBack }) => (
  <LegalPanel title="Privacy policy" lastUpdated={PRIVACY_LAST_UPDATED} sections={PRIVACY_SECTIONS} onBack={onBack} />
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const StudentAccountProfileScreen = ({ user, onLogout }) => {
  const [view, setView] = useState("main");
  const [showReset, setShowReset] = useState(false);
  const [profileName, setProfileName] = useState("");

  React.useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "students", user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfileName(d.fullName || d.name || d.firstName || "");
      }
    });
    return () => unsub();
  }, [user?.uid]);

  if (view === "personalInfo") return <><ResponsiveStyles /><GlobalStyles /><PersonalInfoScreen onBack={() => setView("main")} user={user} /></>;
  if (view === "terms")        return <><ResponsiveStyles /><GlobalStyles /><TermsScreen        onBack={() => setView("main")} /></>;
  if (view === "privacy")      return <><ResponsiveStyles /><GlobalStyles /><PrivacyScreen       onBack={() => setView("main")} /></>;

  return (
    <div className="sap-screen" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: page }}>
      <ResponsiveStyles />
      <GlobalStyles />

      {/* Dark banner + overlapping profile card */}
      <div style={{ position: "relative", flexShrink: 0, zIndex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "78px", background: panel, borderBottomLeftRadius: radius.panel, borderBottomRightRadius: radius.panel, zIndex: 1 }} />
        <div className="sap-header-card">
          <div style={{ position: "absolute", top: "-38px", width: "76px", height: "76px", borderRadius: "50%", background: panelDeep, border: `2px solid ${surface}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, boxShadow: shadow.pill }}>
            <img src={PersonalAccountProfile} alt="" style={{ width: "42px", height: "42px", objectFit: "contain" }} />
          </div>
          <p style={{ fontFamily: font.ui, fontSize: "clamp(1rem, 4vw, 1.125rem)", fontWeight: 600, letterSpacing: "-0.01em", color: ink, margin: 0, textAlign: "center" }}>
            {profileName || "—"}
          </p>
        </div>
      </div>

      <div className="sap-divider" />

      {/* Scrollable body — grouped list */}
      <div className="sap-body">
        <div className="sap-menu-stack">
          <MenuGroup title="Personal Information:">
            <MenuRow icon="person" label="Personal Information" onClick={() => setView("personalInfo")} />
          </MenuGroup>

          <MenuGroup title="Security:">
            <MenuRow icon="key" label="Reset Password" onClick={() => setShowReset(true)} />
          </MenuGroup>

          <MenuGroup title="Legal:">
            <MenuRow icon="document" label="Terms & Condition" onClick={() => setView("terms")} />
            <MenuRow icon="shield" label="Privacy Policy" onClick={() => setView("privacy")} />
          </MenuGroup>
        </div>

        {showReset && <ResetPasswordModal onClose={() => setShowReset(false)} user={user} onLogout={onLogout} />}
      </div>
    </div>
  );
};

export default StudentAccountProfileScreen;
export { PersonalInfoScreen, ResponsiveStyles, TermsScreen, PrivacyScreen, LegalPanel };