import React, { useState, useRef, useEffect } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getAuth, signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from "firebase/auth";
import { db } from "./firebase";
import { initiateCoordinatorTransfer, initiateCoordinatorAddition, changePassword } from "./AuthService";

import AccountProfile from "../icons/accountprofile.png";
import viewIcon from "../icons/view.png";
import PersonalAccountProfile from "../icons/personalaccountprofile.png";
import personalInfoIcon from "../icons/personal.png";
import privacyIcon from "../icons/priv.png";
import termsIcon from "../icons/terms.png";
import addAccountIcon from "../icons/add.png";
import transferIcon from "../icons/transfer.png";
import resetIcon from "../icons/reset.png";

const red = "#590101";
const darkRed = "#590101";
const fieldBg = "#7A4F4F";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", margin: "2px 0 12px 2px" }}>
      {PASSWORD_RULES.map(rule => {
        const passed = rule.test(password);
        return (
          <div key={rule.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: passed ? "#2a7a2a" : "#c0392b", width: "12px", flexShrink: 0 }}>
              {passed ? "✓" : "✗"}
            </span>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.74rem", color: passed ? "#2a7a2a" : "#888" }}>
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
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&family=Monomaniac+One&display=swap');
    * { box-sizing: border-box; }

    /* ── Profile header card ── */
    .cap-header-card {
      position: relative;
      z-index: 2;
      margin-top: 60px;
      background: white;
      border-radius: 16px;
      padding: 48px 48px 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 260px;
    }
    @media (max-width: 480px) {
      .cap-header-card { padding: 48px 24px 14px; min-width: unset; width: 90%; }
    }

    /* ── Menu body ── */
    .cap-body {
      flex: 1;
      overflow-y: auto;
      padding: 0 24px 28px;
      background: #f0f0f0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    @media (max-width: 480px) {
      .cap-body { padding: 0 12px 24px; }
    }

    /* ── Menu box ── */
    .cap-menu-box {
      background: #590101;
      border-radius: 16px;
      padding: 16px 20px;
      margin-bottom: 28px;
      width: 100%;
      box-sizing: border-box;
    }
    @media (max-width: 480px) {
      .cap-menu-box { padding: 12px 12px; }
    }

    /* ── Menu row ── */
    .cap-menu-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #7A4F4F;
      border-radius: 10px;
      padding: 14px 18px;
      cursor: pointer;
      margin-bottom: 10px;
      transition: background 0.15s;
    }
    .cap-menu-row:hover { background: #8f5f5f; }
    @media (max-width: 480px) {
      .cap-menu-row { padding: 10px 12px; }
    }

    /* ── Section header bar ── */
    .cap-section-header {
      background: linear-gradient(90deg, #590101 0%, #590101 100%);
      padding: 16px 28px;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }
    @media (max-width: 480px) {
      .cap-section-header { padding: 12px 14px; gap: 10px; }
      .cap-section-header h2 { font-size: 1.3rem !important; }
    }

    /* ── Personal info body ── */
    .cap-info-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 24px 32px;
      background: #f5f5f5;
    }
    @media (max-width: 560px) {
      .cap-info-body { padding: 16px 14px; }
    }

    /* ── Inner info card ── */
    .cap-info-card {
      background: #590101;
      border-radius: 16px;
      padding: 16px 20px;
    }
    @media (max-width: 480px) {
      .cap-info-card { padding: 12px 12px; }
    }

    /* ── Info row ── */
    .cap-info-row {
      background: #7A4F4F;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 8px;
    }
    @media (max-width: 480px) {
      .cap-info-row { padding: 10px 12px; }
    }

    /* ── Reset / Privacy / Terms scroll body ── */
    .cap-sub-body {
      flex: 1;
      overflow-y: auto;
      padding: 28px 32px;
      background: #f5f5f5;
    }
    @media (max-width: 560px) {
      .cap-sub-body { padding: 16px 14px; }
    }

    /* ── Terms content typography ── */
    .cap-terms-card h3 {
      font-family: 'Kufam', sans-serif;
      font-weight: 700;
      font-size: 0.95rem;
      color: #590101;
      margin: 18px 0 6px;
    }
    .cap-terms-card h3:first-of-type { margin-top: 0; }
    .cap-terms-card p {
      font-family: 'Kufam', sans-serif;
      font-size: 0.85rem;
      color: #444;
      line-height: 1.7;
      margin: 0 0 10px;
    }
    .cap-terms-card .cap-terms-sub {
      margin: 6px 0 10px 14px;
    }
    .cap-terms-card .cap-terms-sub p {
      margin: 0 0 6px;
    }
    .cap-terms-card .cap-terms-updated {
      font-family: 'Kufam', sans-serif;
      font-size: 0.78rem;
      color: #888;
      margin: -4px 0 16px;
      font-style: italic;
    }
    /* Decimal sub-headers, e.g. "3.1 Authorized Users." */
    .cap-terms-subhead {
      font-family: 'Jua', sans-serif;
      color: #1a1a1a;
      font-size: 0.95rem;
      font-weight: 400;
    }
    .cap-terms-def-row {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #dcdcdc;
    }
    .cap-terms-def-row:last-child { border-bottom: none; }
    .cap-terms-def-term {
      font-family: 'Jua', sans-serif;
      font-size: 0.95rem;
      color: #1a1a1a;
      flex: 0 0 110px;
    }
    .cap-terms-def-desc {
      font-family: 'Kufam', sans-serif;
      font-size: 0.8rem;
      color: #444;
      line-height: 1.6;
      flex: 1;
    }

    /* ── Modal inner ── */
    .cap-modal-inner {
      background: white;
      border-radius: 20px;
      width: 480px;
      max-width: 95vw;
      max-height: 88vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Modal scroll body ── */
    .cap-modal-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 24px 28px;
    }
    @media (max-width: 480px) {
      .cap-modal-body { padding: 16px 16px; }
    }

    /* ── Modal footer ── */
    .cap-modal-footer {
      background: #590101;
      padding: 14px 24px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    @media (max-width: 400px) {
      .cap-modal-footer { padding: 10px 14px; flex-direction: column-reverse; align-items: stretch; }
      .cap-modal-footer button { width: 100%; text-align: center; }
    }

    /* ── OTP digit inputs ── */
    .cap-otp-input {
      width: 52px;
      height: 60px;
      text-align: center;
      background: #590101;
      border: none;
      border-radius: 12px;
      color: white;
      font-family: 'Jersey 25', sans-serif;
      font-size: 1.8rem;
      outline: none;
    }
    @media (max-width: 400px) {
      .cap-otp-input { width: 38px; height: 48px; font-size: 1.4rem; border-radius: 8px; }
    }

    /* ── Divider line ── */
    .cap-divider {
      width: 80%;
      height: 1.5px;
      background: #ccc;
      margin: 16px auto;
      border-radius: 2px;
    }
    @media (max-width: 480px) {
      .cap-divider { width: 92%; }
    }

    /* ── Save row ── */
    .cap-save-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
  `}</style>
);

// ── Department / Program data ─────────────────────────────────────────────────
// TODO: Populate from backend or config
const DEPARTMENT_PROGRAM_DATA = {
  "College of Computer Studies":           { programs: ["BSIT"] },
  "College of Business and Accountancy":   { programs: ["BSBA (Major in Marketing Management)", "BSA"] },
  "College of Education":                  { programs: ["BSED (Major in English)", "BSED (Major in Mathematics)", "BEED (Generalist)"] },
  "College of Criminal Justice Education": { programs: ["BS Crim"] },
  "College of Hospitality Management":     { programs: ["BSTM", "BSHM"] },
  "College of Liberal Arts":               { programs: ["BA Pol Sci"] },
};

const DEPARTMENTS = Object.keys(DEPARTMENT_PROGRAM_DATA);

// ── Multi-Department Picker ───────────────────────────────────────────────────
const MultiDepartmentPicker = ({ selections, onChange, readOnly, errors }) => {
  const addEntry = () => onChange([...selections, { department: "", program: "", specialization: "" }]);
  const removeEntry = (idx) => onChange(selections.filter((_, i) => i !== idx));
  const updateEntry = (idx, field, value) => {
    const updated = selections.map((entry, i) => {
      if (i !== idx) return entry;
      if (field === "department") return { department: value, program: "", specialization: "" };
      if (field === "program")    return { ...entry, program: value, specialization: "" };
      return { ...entry, [field]: value };
    });
    onChange(updated);
  };

  const pillSelect = {
    width: "100%",
    padding: "7px 30px 7px 12px",
    background: readOnly ? "#6a4040" : "#8f5f5f",
    border: "none",
    borderRadius: "20px",
    color: "white",
    fontSize: "0.8rem",
    fontFamily: "'Kufam', sans-serif",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    cursor: readOnly ? "default" : "pointer",
    boxSizing: "border-box",
  };

  return (
    <div style={{ marginTop: "8px" }}>
      {selections.map((entry, idx) => {
        const deptData        = DEPARTMENT_PROGRAM_DATA[entry.department];
        const programs        = deptData?.programs ?? [];
        const specMap         = deptData?.specializations ?? {};
        const specializations = entry.program ? (specMap[entry.program] ?? []) : [];
        const err             = errors?.[idx] ?? {};

        return (
          <div key={idx} style={{ background: "rgba(0,0,0,0.15)", borderRadius: "10px", padding: "8px 10px", marginBottom: "6px" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: entry.department ? "6px" : "0" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <select disabled={readOnly} value={entry.department} onChange={e => updateEntry(idx, "department", e.target.value)}
                  style={{ ...pillSelect, border: err.department ? "1.5px solid #ffaaaa" : "none" }}>
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "white", pointerEvents: "none", fontSize: "0.65rem" }}>▼</span>
                {err.department && <p style={{ color: "#ffcccc", fontSize: "0.7rem", fontFamily: "'Kufam', sans-serif", margin: "3px 0 0 4px" }}>Department is required.</p>}
              </div>
              {!readOnly && selections.length > 1 && (
                <button type="button" onClick={() => removeEntry(idx)}
                  style={{ width: "26px", height: "26px", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "none", color: "white", fontSize: "0.8rem", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              )}
            </div>
            {entry.department && (
              <div style={{ marginBottom: specializations.length > 0 && entry.program ? "6px" : "0", position: "relative" }}>
                <select disabled={readOnly} value={entry.program} onChange={e => updateEntry(idx, "program", e.target.value)}
                  style={{ ...pillSelect, border: err.program ? "1.5px solid #ffaaaa" : "none" }}>
                  <option value="">Select Program</option>
                  {programs.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "white", pointerEvents: "none", fontSize: "0.65rem" }}>▼</span>
                {err.program && <p style={{ color: "#ffcccc", fontSize: "0.7rem", fontFamily: "'Kufam', sans-serif", margin: "3px 0 0 4px" }}>Program is required.</p>}
              </div>
            )}
            {entry.program && specializations.length > 0 && (
              <div style={{ position: "relative" }}>
                <select disabled={readOnly} value={entry.specialization} onChange={e => updateEntry(idx, "specialization", e.target.value)}
                  style={{ ...pillSelect, border: err.specialization ? "1.5px solid #ffaaaa" : "none" }}>
                  <option value="">Select Specialization</option>
                  {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "white", pointerEvents: "none", fontSize: "0.65rem" }}>▼</span>
                {err.specialization && <p style={{ color: "#ffcccc", fontSize: "0.7rem", fontFamily: "'Kufam', sans-serif", margin: "3px 0 0 4px" }}>Specialization is required.</p>}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <button type="button" onClick={addEntry}
          style={{ background: "none", border: "1.5px dashed rgba(255,255,255,0.5)", borderRadius: "20px", color: "white", width: "100%", padding: "7px", fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600, marginTop: "2px" }}>
          + Add Another Department
        </button>
      )}
    </div>
  );
};

const fieldStyle = {
  width: "100%", padding: "10px 16px",
  background: fieldBg, border: "none", borderRadius: "20px",
  color: "white", fontSize: "0.88rem",
  fontFamily: "'Kufam', sans-serif", outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  fontFamily: "'Kufam', sans-serif",
  fontWeight: 700, fontSize: "0.88rem",
  color: "#222", marginBottom: "4px", display: "block",
};

const PngIcon = ({ src, size = 120 }) => (
  <img src={src} alt="" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
);

const EditIcon = ({ size = 16, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const EyeIcon = ({ show, onClick }) => (
  <span onClick={onClick} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", display: "flex", alignItems: "center" }}>
    {show ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const PasswordInput = ({ value, onChange, placeholder = "••••••••", onKeyDown }) => {
  const [show, setShow] = useState(false);
  const blockPaste = (e) => e.preventDefault();
  return (
    <div style={{ position: "relative", marginBottom: "12px" }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder}
        onPaste={blockPaste} onCopy={blockPaste} onCut={blockPaste}
        style={{ ...fieldStyle, paddingRight: "44px" }} />
      <EyeIcon show={show} onClick={() => setShow(s => !s)} />
    </div>
  );
};

const WarningBanner = ({ text }) => (
  <div style={{ background: "#f5f0e0", border: "1px solid #d4b800", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
    <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>⚠️</span>
    <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#555", lineHeight: 1.5 }}>{text}</span>
  </div>
);

const BackButton = ({ onClick }) => (
  <button onClick={onClick} title="Go back"
    style={{ background: "rgba(255,255,255,0.18)", border: "2px solid white", borderRadius: "50%", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  </button>
);

// ── Shared section header bar ─────────────────────────────────────────────────
const SectionHeaderBar = ({ iconSrc, title, onBack }) => (
  <div className="cap-section-header">
    {onBack && <BackButton onClick={onBack} />}
    {iconSrc && <PngIcon src={iconSrc} size={38} />}
    <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.8rem", color: "white", letterSpacing: "0.02em", margin: 0 }}>{title}</h2>
  </div>
);

// ── Menu row ─────────────────────────────────────────────────────────────────
const MenuRow = ({ iconSrc, label, onClick }) => (
  <div onClick={onClick} className="cap-menu-row">
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      {iconSrc && <PngIcon src={iconSrc} size={38} />}
      <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1rem", color: "white" }}>{label}</span>
    </div>
    <img src={viewIcon} alt="view" style={{ width: "38px", height: "38px", objectFit: "contain" }} />
  </div>
);

// ── Add Account Modal ─────────────────────────────────────────────────────────
const AddAccountModal = ({ onClose, currentUid, currentEmail, coordinatorDeptSelections = [] }) => {
  const [currentPass, setCurrentPass] = useState("");
  const [email, setEmail]             = useState("");
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent]               = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !submitting) {
      handleSubmit();
    }
  };

  const validate = () => {
    const e = {};
    if (!currentPass) e.currentPass = "Your current password is required to confirm this invitation.";
    if (!email.trim()) e.email = "New coordinator's email is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      // Only sends an invite — this account's own access is completely
      // unaffected, both now and after the invited coordinator accepts.
      await initiateCoordinatorAddition(currentUid, currentEmail, currentPass, email);
      setSent(true);
    } catch (err) {
      setSubmitError(err.message || "Failed to send the invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div className="cap-modal-inner">
        <div className="cap-modal-body">
          {sent ? (
            <>
              <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>Invitation Sent!</p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444", marginBottom: "8px" }}>
                An email with an "Accept Invitation" link has been sent to <strong>{email.trim().toLowerCase()}</strong>.
              </p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444" }}>
                They'll set up their own name and password when they accept. Your own account and access are unaffected.
              </p>
            </>
          ) : (
            <>
              <WarningBanner text="Invite an additional OJT Coordinator. They'll receive an email with an Accept link and set up their own login — your own account and access won't change." />
              <hr style={{ borderColor: "#eee", marginBottom: "16px" }} />

              <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>CONFIRM YOUR IDENTITY:</p>
              <label style={labelStyle}>Your Current Password:</label>
              <PasswordInput value={currentPass} onChange={e => setCurrentPass(e.target.value)} onKeyDown={handleKeyDown} />
              {errors.currentPass && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.currentPass}</p>}

              <hr style={{ borderColor: "#eee", margin: "16px 0" }} />

              <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>NEW COORDINATOR'S EMAIL:</p>

              <label style={labelStyle}>Department / Program:</label>
              <div style={{ background: fieldBg, borderRadius: "14px", padding: "10px 12px", marginBottom: "6px" }}>
                <MultiDepartmentPicker
                  selections={coordinatorDeptSelections.length ? coordinatorDeptSelections : [{ department: "", program: "", specialization: "" }]}
                  onChange={() => {}}
                  readOnly={true}
                  errors={[]}
                />
              </div>
              <p style={{ fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", color: "#777", margin: "-2px 0 8px 4px" }}>
                New accounts are automatically added under your own department.
              </p>

              <label style={labelStyle}>Email Address:</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="example@gmail.com" style={{ ...fieldStyle, marginBottom: "4px" }} />
              {errors.email && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.email}</p>}

              {submitError && (
                <p style={{ color: "red", fontSize: "0.8rem", fontFamily: "'Kufam', sans-serif", textAlign: "center", marginTop: "12px" }}>
                  ⚠️ {submitError}
                </p>
              )}
            </>
          )}
        </div>
        <div className="cap-modal-footer">
          <button onClick={onClose} style={{ padding: "10px 28px", borderRadius: "20px", background: "white", color: darkRed, border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>
            {sent ? "Close" : "Cancel"}
          </button>
          {!sent && (
            <button onClick={handleSubmit} disabled={submitting} style={{ padding: "10px 28px", borderRadius: "20px", background: "rgba(255,255,255,0.25)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Sending…" : "Send Invitation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Transfer Account Modal ────────────────────────────────────────────────────
const TransferAccountModal = ({ onClose, currentUid, currentEmail, coordinatorDeptSelections = [] }) => {
  const [currentPass, setCurrentPass] = useState("");
  const [email, setEmail]             = useState("");
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent]               = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !submitting) {
      handleSubmit();
    }
  };

  const validate = () => {
    const e = {};
    if (!currentPass) e.currentPass = "Your current password is required to confirm this transfer.";
    if (!email.trim()) e.email = "New coordinator's email is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      // Only sends an invite — the current account keeps full access until
      // the invited coordinator actually accepts it via the emailed link.
      await initiateCoordinatorTransfer(currentUid, currentEmail, currentPass, email);
      setSent(true);
    } catch (err) {
      setSubmitError(err.message || "Failed to send the transfer invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div className="cap-modal-inner">
        <div className="cap-modal-body">
          {sent ? (
            <>
              <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>Invitation Sent!</p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444", marginBottom: "8px" }}>
                An email with an "Accept Invitation" link has been sent to <strong>{email.trim().toLowerCase()}</strong>.
              </p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444" }}>
                You'll keep access to your account until they open the link and finish setting up theirs — at that point your account will be transferred and you'll be signed out automatically.
              </p>
            </>
          ) : (
            <>
              <WarningBanner text="Invite another OJT Coordinator to take over this account. They'll receive an email with an Accept link and set up their own login — your access won't change until they accept." />
              <hr style={{ borderColor: "#eee", marginBottom: "16px" }} />

              <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>CONFIRM YOUR IDENTITY:</p>
              <label style={labelStyle}>Your Current Password:</label>
              <PasswordInput value={currentPass} onChange={e => setCurrentPass(e.target.value)} onKeyDown={handleKeyDown} />
              {errors.currentPass && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.currentPass}</p>}

              <hr style={{ borderColor: "#eee", margin: "16px 0" }} />

              <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>NEW COORDINATOR'S EMAIL:</p>

              <label style={labelStyle}>Department / Program:</label>
              <div style={{ background: fieldBg, borderRadius: "14px", padding: "10px 12px", marginBottom: "6px" }}>
                <MultiDepartmentPicker
                  selections={coordinatorDeptSelections.length ? coordinatorDeptSelections : [{ department: "", program: "", specialization: "" }]}
                  onChange={() => {}}
                  readOnly={true}
                  errors={[]}
                />
              </div>
              <p style={{ fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", color: "#777", margin: "-2px 0 8px 4px" }}>
                The new coordinator will inherit your department automatically.
              </p>

              <label style={labelStyle}>Email Address:</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="example@gmail.com" style={{ ...fieldStyle, marginBottom: "4px" }} />
              {errors.email && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.email}</p>}

              {submitError && (
                <p style={{ color: "red", fontSize: "0.8rem", fontFamily: "'Kufam', sans-serif", textAlign: "center", marginTop: "12px" }}>
                  ⚠️ {submitError}
                </p>
              )}
            </>
          )}
        </div>
        <div className="cap-modal-footer">
          <button onClick={onClose} style={{ padding: "10px 28px", borderRadius: "20px", background: "white", color: darkRed, border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>
            {sent ? "Close" : "Cancel"}
          </button>
          {!sent && (
            <button onClick={handleSubmit} disabled={submitting} style={{ padding: "10px 28px", borderRadius: "20px", background: "rgba(255,255,255,0.25)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Sending…" : "Send Invitation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Phone formatter ───────────────────────────────────────────────────────────
const formatPhone = (raw) => {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63")) digits = digits.slice(2);
  if (digits.length > 10) digits = digits.slice(0, 10);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 10);
  let fmt = "+63";
  if (p1) fmt += " " + p1;
  if (p2) fmt += "-" + p2;
  if (p3) fmt += "-" + p3;
  return fmt;
};

// ── Personal Info Screen ──────────────────────────────────────────────────────
const PersonalInfoScreen = ({ user, onBack, onSaved, mandatory = false }) => {
  const [editing, setEditing]           = useState(!!mandatory);
  const [name, setName]                 = useState(user?.name || "");
  const [deptSelections, setDeptSelections] = useState(
    user?.deptSelections?.length ? user.deptSelections : [{ department: "", program: "", specialization: "" }]
  );
  const [sex, setSex]         = useState(user?.sex || "");
  const [contact, setContact] = useState(user?.contact || "");
  const [email, setEmail]     = useState(user?.email || "");
  const [address, setAddress] = useState(user?.address || "");
  const [errors, setErrors]     = useState({});
  const [deptErrors, setDeptErrors] = useState([]);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [savedPayload, setSavedPayload] = useState(null);

  // ── Always reflect the latest Firestore data, not a stale `user` prop ────
  // (Fixes fields resetting to blank when re-opening Edit after a save.)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "coordinators", uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setName(d.name || "");
      setDeptSelections(d.deptSelections?.length ? d.deptSelections : [{ department: "", program: "", specialization: "" }]);
      setSex(d.sex || "");
      setContact(d.contact || "");
      setEmail(d.email || "");
      setAddress(d.address || "");
    });
    return unsub;
  }, [user?.uid]);

  const validatePhone = (val) => {
    if (!val || val.trim() === "+63" || val.trim() === "+63 ") return "Phone number is required.";
    const digits = val.replace(/\D/g, "");
    if (digits.length < 12) return "Must be a valid +63 number.";
    return "";
  };

  const validateEmail = (val) => {
    if (!val || !val.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return "Invalid email address.";
    return "";
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!sex) e.sex = "Select sex.";
    const phoneErr = validatePhone(contact);
    if (phoneErr) e.contact = phoneErr;
    const emailErr = validateEmail(email);
    if (emailErr) e.email = emailErr;
    if (!address.trim()) e.address = "Address is required.";

    const newDeptErrors = deptSelections.map(entry => {
      const err = {};
      if (!entry.department) err.department = true;
      if (entry.department && !entry.program) err.program = true;
      if (entry.department && entry.program) {
        const specs = DEPARTMENT_PROGRAM_DATA[entry.department]?.specializations?.[entry.program] ?? [];
        if (specs.length > 0 && !entry.specialization) err.specialization = true;
      }
      return err;
    });
    setDeptErrors(newDeptErrors);
    const hasDeptError = newDeptErrors.some(e => Object.keys(e).length > 0);
    setErrors(e);
    return Object.keys(e).length === 0 && !hasDeptError;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const uid = user?.uid;
    if (!uid) { setSaveError("Missing account reference. Please re-login and try again."); return; }
    setSaving(true);
    setSaveError("");
    try {
      // Sanitize deptSelections — replace any undefined/null with empty string
      const cleanDeptSelections = deptSelections.map(entry => ({
        department:     entry.department     || "",
        program:        entry.program        || "",
        specialization: entry.specialization || "",
      }));

      const payload = {
        name:           name          || "",
        deptSelections: cleanDeptSelections,
        sex:            sex           || "",
        contact:        contact       || "",
        email:          email         || "",
        address:        address       || "",
      };
      if (mandatory) payload.profileComplete = true;
      await updateDoc(doc(db, "coordinators", uid), payload);
      setEditing(false);
      setErrors({});
      setDeptErrors([]);
      // Show the confirmation modal first; only notify the parent (which,
      // in the mandatory first-login flow, immediately unmounts this
      // screen) once the coordinator has dismissed it — otherwise the
      // modal never gets a chance to render.
      setSavedPayload(payload);
      setShowSaveSuccess(true);
    } catch (err) {
      setSaveError(err.message || "Failed to save your information.");
    } finally {
      setSaving(false);
    }
  };

  const handleContactChange = (raw) => {
    const formatted = formatPhone(raw);
    setContact(formatted);
    setErrors(prev => ({ ...prev, contact: validatePhone(formatted) }));
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    setErrors(prev => ({ ...prev, email: validateEmail(val) }));
  };

  const rowStyle = { background: "#7A4F4F", borderRadius: "10px", padding: "12px 16px", marginBottom: "8px" };

  const inlineInputStyle = {
    background: "transparent", border: "none", borderBottom: "1px solid white",
    color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem",
    outline: "none", width: "calc(100% - 120px)", marginLeft: "8px", boxSizing: "border-box",
  };
  const inlineInputErrorStyle = { ...inlineInputStyle, borderBottom: "1.5px solid #ffaaaa" };

  const deptViewLabel = (entry) => [entry.department, entry.program, entry.specialization].filter(Boolean).join(" — ");

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SectionHeaderBar iconSrc={personalInfoIcon} title={editing ? "Edit Personal Information" : "Personal Information"} onBack={onBack} />

      <div className="cap-info-body">
        <div
          className="cap-info-card"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.tagName === "INPUT" && editing) {
              e.preventDefault();
              handleSave();
            }
          }}
        >
          {/* Edit button */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
            
            {!editing && (
              <button onClick={() => setEditing(true)} title="Edit"
                style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2px solid white", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <EditIcon size={15} color="white" />
              </button>
            )}
          </div>

          {/* Name */}
          <div style={rowStyle}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white" }}>Name:</span>
            {editing ? (
              <>
                <input value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }} placeholder="Full Name" style={errors.name ? inlineInputErrorStyle : inlineInputStyle} />
                {errors.name && <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "4px 0 0 0" }}>{errors.name}</p>}
              </>
            ) : (
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "white", marginLeft: "6px" }}>{name || "—"}</span>
            )}
          </div>

          {/* Department */}
          <div style={rowStyle}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white" }}>Department:</span>
            {editing ? (
              <MultiDepartmentPicker selections={deptSelections} onChange={v => { setDeptSelections(v); setDeptErrors([]); }} readOnly={false} errors={deptErrors} />
            ) : (
              deptSelections.length === 1 ? (
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "white", marginLeft: "6px" }}>{deptViewLabel(deptSelections[0]) || "—"}</span>
              ) : (
                <ul style={{ margin: "6px 0 0 0", paddingLeft: "18px" }}>
                  {deptSelections.map((entry, i) => (
                    <li key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "white", marginBottom: "3px" }}>{deptViewLabel(entry) || "—"}</li>
                  ))}
                </ul>
              )
            )}
          </div>

          {/* Sex */}
          <div style={rowStyle}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white" }}>Sex:</span>
            {editing ? (
              <>
                <select value={sex} onChange={e => { setSex(e.target.value); setErrors(p => ({ ...p, sex: "" })); }}
                  style={{ background: "transparent", border: "none", borderBottom: errors.sex ? "1px solid #ffcccc" : "1px solid white", color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", outline: "none", cursor: "pointer", marginLeft: "8px" }}>
                  <option value="" style={{ color: "#333" }}>Select</option>
                  <option style={{ color: "#333" }}>Male</option>
                  <option style={{ color: "#333" }}>Female</option>
                </select>
                {errors.sex && <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "4px 0 0 0" }}>{errors.sex}</p>}
              </>
            ) : (
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "white", marginLeft: "6px" }}>{sex || "—"}</span>
            )}
          </div>

          {/* Contact */}
          <div style={rowStyle}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white" }}>Contact Info:</span>
            {editing ? (
              <>
                <input value={contact} onChange={e => handleContactChange(e.target.value)} placeholder="+63 000-000-0000" style={errors.contact ? inlineInputErrorStyle : inlineInputStyle} />
                {errors.contact && <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "4px 0 0 0" }}>{errors.contact}</p>}
              </>
            ) : (
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "white", marginLeft: "6px" }}>{contact || "—"}</span>
            )}
          </div>

          {/* Email */}
          <div style={rowStyle}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white" }}>Email Address:</span>
            {editing ? (
              <>
                <input type="email" value={email} onChange={e => handleEmailChange(e.target.value)} placeholder="example@gmail.com" style={errors.email ? inlineInputErrorStyle : inlineInputStyle} />
                {errors.email && <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "4px 0 0 0" }}>{errors.email}</p>}
              </>
            ) : (
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "white", marginLeft: "6px" }}>{email || "—"}</span>
            )}
          </div>

          {/* Address */}
          <div style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch" }}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white", marginBottom: editing ? "8px" : "0" }}>
              Address:{" "}
              {!editing && (
                <span style={{ fontWeight: 400, fontSize: "0.82rem" }}>
                  {address || "—"}
                </span>
              )}
            </span>
            {editing && (
              <>
                <input type="text" value={address}
                  onChange={e => { setAddress(e.target.value); setErrors(p => ({ ...p, address: "" })); }}
                  placeholder="Province, City, Barangay, Street"
                  style={{
                    background: "transparent", border: "none",
                    borderBottom: errors.address ? "1.5px solid #ffaaaa" : "1px solid white",
                    color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem",
                    outline: "none", width: "100%", boxSizing: "border-box", padding: "4px 0",
                  }} />
                {errors.address && <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "2px 0 0" }}>{errors.address}</p>}
              </>
            )}
          </div>

          {mandatory && (
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#ffe0e0", textAlign: "center", margin: "4px 0 10px" }}>
              Please complete your personal information to continue.
            </p>
          )}

          {saveError && (
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#ffcccc", textAlign: "center", margin: "4px 0 10px" }}>
              ⚠️ {saveError}
            </p>
          )}

          {/* Cancel / Save */}
          {editing && (
            <div className="cap-save-row">
              {!mandatory && (
                <button onClick={() => { setEditing(false); setErrors({}); setDeptErrors([]); }}
                  style={{ padding: "6px 18px", borderRadius: "14px", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid white", fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", cursor: "pointer" }}>Cancel</button>
              )}
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "6px 18px", borderRadius: "14px", background: "white", color: darkRed, border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showSaveSuccess && (
        <CoordinatorSaveSuccessModal onClose={() => { setShowSaveSuccess(false); onSaved?.(savedPayload); }} />
      )}
    </div>
  );
};

// ── Reset Password Steps ──────────────────────────────────────────────────────
const ResetStep1 = ({ onNext }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSend = () => {
    if (!email.trim()) { setError("Email is required."); return; }
    setError(""); onNext(email);
  };

  return (
    <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888", marginBottom: "16px", lineHeight: 1.6 }}>
        Enter the email address linked to your account.<br />We'll send a password reset link.
      </p>
      <hr style={{ borderColor: "#ccc", marginBottom: "18px" }} />
      <label style={{ ...labelStyle, color: "#111" }}>Email Address:</label>
      <div style={{ background: darkRed, borderRadius: "20px", padding: "12px 20px", marginBottom: "8px" }}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@gmail.com"
          style={{ background: "transparent", border: "none", outline: "none", color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", width: "100%" }} />
      </div>
      {error && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
        <button onClick={handleSend} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "12px 40px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>Send</button>
      </div>
    </div>
  );
};

const ResetStep2 = ({ onNext }) => {
  const [code, setCode]   = useState(["", "", "", "", "", ""]);
  const inputRefs         = useRef([]);

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...code]; next[i] = val; setCode(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };
  const handleSend = () => {
    if (code.join("").length < 6) { alert("Please enter the full 6-digit code."); return; }
    onNext();
  };

  return (
    <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888", marginBottom: "16px" }}>Enter the code sent to your gmail account.</p>
      <hr style={{ borderColor: "#ccc", marginBottom: "18px" }} />
      <label style={{ ...labelStyle, color: "#111" }}>Enter the code:</label>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", justifyContent: "center", flexWrap: "wrap" }}>
        {code.map((digit, i) => (
          <input key={i} ref={el => inputRefs.current[i] = el} value={digit}
            onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
            maxLength={1} className="cap-otp-input" />
        ))}
      </div>
      <p style={{ textAlign: "center", fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", marginBottom: "16px" }}>
        Didn't receive the code?{" "}
        <span onClick={() => setCode(["", "", "", "", "", ""])} style={{ color: red, cursor: "pointer", fontWeight: 600 }}>Resend!</span>
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button onClick={handleSend} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "12px 40px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>Send</button>
      </div>
    </div>
  );
};

// ── Reset Password Modal ──────────────────────────────────────────────────────
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
    if (!currentPass)          e.currentPass = "Please enter your current password.";
    if (!newPass)              e.newPass = "Please enter a new password.";
    else if (!isPasswordStrong(newPass)) e.newPass = "Password does not meet all the requirements below.";
    if (newPass !== confirm)   e.confirm = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      // auth.currentUser can be null here if this tab never established its
      // own Firebase Auth session (e.g. persistence is per-tab and this tab
      // was opened/reloaded separately) — reading .email on null crashes,
      // and every Firestore call would also fail as permission-denied.
      // Fail with a clear message instead of a raw null-reference error.
      if (!currentUser) {
        setErrors({ general: "Your session has expired. Please refresh the page and log in again." });
        setLoading(false);
        return;
      }
      // Re-authenticate with current password first
      const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
      await reauthenticateWithCredential(currentUser, credential);
      // Now change password and update Firestore flag
      await changePassword(currentPass, newPass, "coordinators", user?.uid, currentUser?.email);
      setSuccess(true);
      setCurrentPass(""); setNewPass(""); setConfirm("");
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErrors({ currentPass: "Incorrect current password." });
      } else {
        setErrors({ general: err.message || "Failed to change password. Please try again." });
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
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}>
        <div style={{
          background: "white", borderRadius: "20px",
          padding: "36px 32px", width: "clamp(280px, 85vw, 380px)",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "#e8f5e9", display: "flex",
            alignItems: "center", justifyContent: "center", marginBottom: "4px",
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2d7a2d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <p style={{
            fontFamily: "'Kufam', sans-serif", fontWeight: 700,
            fontSize: "1.15rem", color: "#1a1a1a", margin: 0, textAlign: "center",
          }}>Password Changed!</p>
          <p style={{
            fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem",
            color: "#666", margin: 0, textAlign: "center", lineHeight: 1.5,
          }}>Your password has been updated successfully. Please log in again with your new password.</p>
          <button onClick={handleDone} style={{
            width: "100%", padding: "12px", borderRadius: "30px",
            border: "none", background: "#590101",
            fontFamily: "'Kufam', sans-serif", fontWeight: 700,
            fontSize: "0.95rem", cursor: "pointer", color: "white",
            boxShadow: "0 3px 10px rgba(89,1,1,0.3)", marginTop: "8px",
          }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div className="cap-modal-inner">
        <div className="cap-modal-body">
          <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>RESET PASSWORD:</p>

          <label style={labelStyle}>Current Password:</label>
          <PasswordInput value={currentPass} onChange={e => { setCurrentPass(e.target.value); setErrors(p => ({ ...p, currentPass: "" })); }} onKeyDown={handleKeyDown} />
          {errors.currentPass && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.currentPass}</p>}

          <hr style={{ borderColor: "#eee", margin: "16px 0" }} />

          <label style={labelStyle}>New Password:</label>
          <PasswordInput value={newPass} onChange={e => { setNewPass(e.target.value); setErrors(p => ({ ...p, newPass: "" })); }} onKeyDown={handleKeyDown} />
          {errors.newPass && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.newPass}</p>}

          <PasswordChecklist password={newPass} />

          <label style={labelStyle}>Confirm New Password:</label>
          <PasswordInput value={confirm} onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: "" })); }} onKeyDown={handleKeyDown} />
          {errors.confirm && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.confirm}</p>}

          {errors.general && (
            <p style={{ color: "red", fontSize: "0.8rem", fontFamily: "'Kufam', sans-serif", textAlign: "center", marginTop: "12px" }}>
              ⚠️ {errors.general}
            </p>
          )}
        </div>
        <div className="cap-modal-footer">
          <button onClick={onClose} style={{ padding: "10px 28px", borderRadius: "20px", background: "white", color: darkRed, border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} style={{ padding: "10px 28px", borderRadius: "20px", background: "rgba(255,255,255,0.25)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Saving…" : "Save Password"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Privacy & Security Screen ─────────────────────────────────────────────────
const PrivacySecurityScreen = ({ onBack, user, onLogout }) => {
  const [showReset, setShowReset] = useState(false);

  if (showReset) return <ResetPasswordModal onClose={() => setShowReset(false)} user={user} onLogout={onLogout} />;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SectionHeaderBar iconSrc={privacyIcon} title="Privacy and Security" onBack={onBack} />
      <div className="cap-sub-body">
        <div style={{ background: darkRed, borderRadius: "16px", padding: "16px 20px" }}>
          <MenuRow iconSrc={resetIcon} label="Reset Password" onClick={() => setShowReset(true)} />
        </div>
      </div>
    </div>
  );
};

// ── Terms Screen ──────────────────────────────────────────────────────────────
// Definitions table data (Section 2 of the OJTern Terms and Conditions,
// as published by Dominican College of Tarlac, Inc. — last updated July 19, 2026)
const TERMS_DEFINITIONS = [
  { term: "Coordinator", desc: "A School-authorized OJT Coordinator responsible for managing students, reviewing and approving company registrations within assigned departments or industries, and overseeing the OJT process." },
  { term: "Student", desc: "An officially enrolled student authorized to participate in the School's OJT program through the Platform." },
  { term: "Company", desc: "A partner organization that registers to host student interns, subject to approval by the appropriate Coordinator." },
  { term: "Account", desc: "The unique login credentials and associated user profile assigned to each User." },
  { term: "Personal Information", desc: "Any information that identifies or can reasonably identify a User, including but not limited to name, student ID, company information, email address, contact number, and home address." },
  { term: "Platform", desc: "OJTern, including its website, database, services, and related features." },
];

const TermsScreen = ({ onBack }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <SectionHeaderBar iconSrc={termsIcon} title="Terms & Condition" onBack={onBack} />
    <div className="cap-sub-body">
      <div className="cap-terms-card" style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>

        <p className="cap-terms-updated">Last updated: July 19, 2026</p>

        <h3>1. Introduction</h3>
        <p>
          These Terms and Conditions ("Terms") govern access to and use of OJTern (the "Platform"), a
          web-based On-the-Job Training (OJT) Management Platform designed to connect OJT
          Coordinators, Students, and Partner Companies for the administration of internship
          placements, monitoring, communication, and reporting.
        </p>
        <p>
          The Platform is provided for the official use of Dominican College of Tarlac, Inc. ("the
          School") and its authorized coordinators, enrolled students, and approved partner
          companies.
        </p>
        <p>
          By creating an account, selecting the "I have read and agree to the Terms and Conditions"
          checkbox, logging in, or otherwise using the Platform, you acknowledge that you have read,
          understood, and agree to be legally bound by these Terms. Electronic acceptance of these
          Terms shall have the same legal effect as a handwritten signature.
        </p>
        <p>
          If you do not agree to these Terms, you must not access or use the Platform.
        </p>

        <h3>2. Definitions</h3>
        <div>
          {TERMS_DEFINITIONS.map((row) => (
            <div key={row.term} className="cap-terms-def-row">
              <span className="cap-terms-def-term">{row.term}</span>
              <span className="cap-terms-def-desc">{row.desc}</span>
            </div>
          ))}
        </div>

        <h3>3. Eligibility and Account Roles</h3>
        <p><strong className="cap-terms-subhead">3.1 Authorized Users.</strong> Access to the Platform is limited to:</p>
        <div className="cap-terms-sub">
          <p>• Authorized OJT Coordinators;</p>
          <p>• Officially enrolled students of the School; and</p>
          <p>• Companies approved by the School through the Platform's registration process.</p>
        </div>
        <p>
          <strong className="cap-terms-subhead">3.2 Student Accounts.</strong> Student accounts are created by an authorized OJT
          Coordinator. Students receive a temporary system-generated password and are required to
          change their password upon first login, and complete all required personal information
          before accessing the Platform's full functionality.
        </p>
        <p><strong className="cap-terms-subhead">3.3 Coordinator Accounts.</strong> Coordinator accounts may be created through either:</p>
        <div className="cap-terms-sub">
          <p>• Initial setup by the School or System Administrator; or</p>
          <p>
            • The "Add Account" feature, which lets an existing Coordinator invite another Coordinator
            with the same department(s) and industry scope. The invited person receives an email and
            sets up their own name and password to accept — the inviting Coordinator's own account and
            access are unaffected before and after the invitation is accepted.
          </p>
        </div>
        <p>
          New Coordinators set their own password as part of accepting an invitation, and must
          complete their personal information upon first login.
        </p>
        <p>
          <strong className="cap-terms-subhead">3.4 Company Accounts.</strong> Companies register through the Platform's
          self-registration process. Company accounts remain in Pending status until reviewed by the
          Coordinator(s) assigned to the selected industry. Pending or rejected Companies may not log
          in or access internship-related features until officially approved. The School and its
          authorized Coordinators reserve the right to approve or reject Company registrations that do
          not satisfy the School's partnership, accreditation, or administrative requirements.
        </p>
        <p>
          <strong className="cap-terms-subhead">3.5 Accuracy of Information.</strong> All Users agree to provide information that is
          accurate, complete, and current and shall promptly update their information whenever
          necessary.
        </p>

        <h3>4. Account Security and Responsibilities</h3>
        <p>
          Users are responsible for maintaining the confidentiality of their login credentials and for
          all activities performed using their Account. Users agree to:
        </p>
        <div className="cap-terms-sub">
          <p>• Keep passwords confidential;</p>
          <p>• Never share login credentials with another person;</p>
          <p>
            • Immediately report any unauthorized access or suspected security breach to the School or
            Platform administrator; and
          </p>
          <p>• Use the Platform only for authorized educational and internship purposes.</p>
        </div>
        <p>
          Temporary passwords issued during account creation must be changed upon first login.
          Passwords should contain at least eight (8) characters and include a combination of
          uppercase letters, lowercase letters, numbers, and special characters to improve account
          security.
        </p>
        <p>
          Failure to comply with these responsibilities may result in suspension or termination of the
          Account.
        </p>

        <h3>5. Coordinator Account Transfer</h3>
        <p>
          The Platform provides a Transfer Account feature to facilitate official changes in
          coordinatorship. Initiating a transfer sends an email invitation to the replacement
          Coordinator; the transfer only takes effect once that invitation is accepted:
        </p>
        <div className="cap-terms-sub">
          <p>• The replacement Coordinator receives an emailed invitation and sets up their own account to accept it;</p>
          <p>
            • Upon acceptance, the replacement Coordinator inherits the transferring Coordinator's assigned
            department(s), industry scope, and management responsibilities;
          </p>
          <p>• The original Coordinator retains full access until the invitation is accepted, at which point they immediately and permanently lose access to the Platform; and</p>
          <p>• The transfer cannot be reversed through the Platform once accepted.</p>
        </div>
        <p>
          Before a transfer invitation is sent, the transferring Coordinator must verify their identity by
          entering their current password.
        </p>
        <p>
          The School is responsible for ensuring that account transfers reflect officially authorized
          personnel changes.
        </p>

        <h3>6. Company Registration and Approval</h3>
        <p>
          Companies must provide truthful organizational information during registration. Each Company
          selects an industry classification, which determines the Coordinator(s) responsible for
          reviewing the application. Approval decisions are based on the School's partnership
          policies, accreditation standards, and administrative requirements.
        </p>
        <p>Approved Companies are expected to:</p>
        <div className="cap-terms-sub">
          <p>• Maintain accurate company information;</p>
          <p>• Provide lawful internship opportunities;</p>
          <p>• Comply with School OJT policies; and</p>
          <p>• Treat students professionally and fairly.</p>
        </div>

        <h3>7. Acceptable Use</h3>
        <p>Users agree not to:</p>
        <div className="cap-terms-sub">
          <p>• Violate any applicable law or regulation;</p>
          <p>• Submit false or misleading information;</p>
          <p>• Access another User's Account without authorization;</p>
          <p>• Upload malicious software, viruses, or harmful code;</p>
          <p>• Interfere with the operation, security, or availability of the Platform;</p>
          <p>• Harass, discriminate against, threaten, or abuse other Users;</p>
          <p>• Use automated tools to scrape or extract Platform data without authorization; or</p>
          <p>• Misuse the Platform for purposes unrelated to the School's OJT program.</p>
        </div>

        <h3>8. Data Privacy</h3>
        <p>
          The School is committed to protecting Personal Information in accordance with the Data
          Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations.
        </p>
        <p>The Platform collects and processes Personal Information necessary for administering the OJT program, including:</p>
        <div className="cap-terms-sub">
          <p>• Names;</p>
          <p>• Student IDs;</p>
          <p>• Contact information;</p>
          <p>• Email addresses;</p>
          <p>• Home addresses;</p>
          <p>• Company information;</p>
          <p>• Internship applications; and</p>
          <p>• Uploaded documents such as resumes and other internship requirements.</p>
        </div>
        <p>
          Personal Information will be used solely for legitimate educational and administrative
          purposes related to internship placement, monitoring, reporting, and communication. Only
          information reasonably necessary for internship placement may be shared with approved
          partner Companies, such as the student's name, program, contact information, resume, and
          application status.
        </p>
        <p>
          The Platform uses secure cloud-based services for authentication and data storage and
          implements reasonable administrative, technical, and organizational safeguards to protect
          User information against unauthorized access, alteration, disclosure, or destruction.
        </p>
        <p>Personal Information will not be sold or disclosed to unauthorized third parties except:</p>
        <div className="cap-terms-sub">
          <p>• With the User's consent;</p>
          <p>• When required by law; or</p>
          <p>• When necessary for legitimate OJT administration.</p>
        </div>
        <p>
          Users may request access to, correction of, or deletion of their Personal Information,
          subject to applicable laws and the School's record-retention obligations.
        </p>
        <p>
          By using the Platform, Users consent to the collection, processing, storage, and use of
          their Personal Information as described in these Terms.
        </p>

        <h3>9. Intellectual Property</h3>
        <p>
          All software, source code, logos, graphics, content, interface designs, databases, and other
          materials forming part of the Platform are the intellectual property of the School and/or
          its developers and are protected by applicable intellectual property laws.
        </p>
        <p>
          Users receive only a limited, non-exclusive, non-transferable license to use the Platform
          solely for its intended educational and internship management purposes. No ownership rights
          are transferred to Users.
        </p>

        <h3>10. Service Availability</h3>
        <p>While reasonable efforts are made to maintain continuous availability, the Platform may occasionally become unavailable due to:</p>
        <div className="cap-terms-sub">
          <p>• Scheduled maintenance;</p>
          <p>• Software updates;</p>
          <p>• Server failures;</p>
          <p>• Internet interruptions; or</p>
          <p>• Circumstances beyond the School's reasonable control.</p>
        </div>
        <p>The School does not guarantee uninterrupted or error-free operation of the Platform.</p>

        <h3>11. Limitation of Liability</h3>
        <p>The Platform is provided on an "as is" and "as available" basis.</p>
        <p>
          To the fullest extent permitted by law, neither the School nor the Platform's developers
          shall be liable for indirect, incidental, consequential, or special damages arising from:
        </p>
        <div className="cap-terms-sub">
          <p>• Temporary system downtime;</p>
          <p>• Data loss caused by factors beyond reasonable control;</p>
          <p>• Communication issues between Students and Companies;</p>
          <p>• Unsuccessful internship applications;</p>
          <p>• Internship-related disputes; or</p>
          <p>• Inability to access the Platform.</p>
        </div>
        <p>
          The Platform facilitates internship administration only and does not guarantee internship
          placement, employment opportunities, or internship quality.
        </p>

        <h3>12. Account Suspension and Termination</h3>
        <p>The School or an authorized Coordinator may suspend, deactivate, or terminate an Account for:</p>
        <div className="cap-terms-sub">
          <p>• Violation of these Terms;</p>
          <p>• Submission of false information;</p>
          <p>• Unauthorized access attempts;</p>
          <p>• Misuse of the Platform; or</p>
          <p>• Conduct that threatens the integrity or security of the Platform.</p>
        </div>
        <p>Rejected or revoked Company accounts will lose access to internship-related services.</p>
        <p>Transferred Coordinator accounts are permanently deactivated following a successful account transfer.</p>
        <p>
          Termination of an Account may result in loss of access to Platform services, subject to the
          School's legal record-retention obligations.
        </p>

        <h3>13. Changes to These Terms</h3>
        <p>The School reserves the right to modify these Terms at any time.</p>
        <p>
          Material changes will be communicated through the Platform or via the User's registered
          email address.
        </p>
        <p>
          Continued use of the Platform after changes become effective constitutes acceptance of the
          revised Terms.
        </p>

        <h3>14. Governing Law</h3>
        <p>
          These Terms shall be governed by and interpreted in accordance with the laws of the Republic
          of the Philippines.
        </p>
        <p>
          Any dispute relating to these Terms or the Platform shall first be addressed through the
          School's internal grievance or administrative procedures before any other legal remedy is
          pursued.
        </p>

        <h3>15. Contact Information</h3>
        <p>
          For questions, concerns, or requests regarding these Terms or your Personal Information,
          please contact the School through its designated OJT Coordinator or official support
          channel.
        </p>
        <p style={{ fontFamily: "'Jua', sans-serif", color: "#1a1a1a" }}>Email: support@ojtern.com</p>

        <p style={{ marginTop: "16px", fontStyle: "italic" }}>
          By creating an Account, selecting the Terms and Conditions acceptance checkbox, logging in,
          or otherwise using OJTern, you acknowledge that you have read, understood, and agree to be
          legally bound by these Terms and Conditions.
        </p>

      </div>
    </div>
  </div>
);

// ── Main Screen ───────────────────────────────────────────────────────────────

// ── First-Login Mandatory Password Change Modal ───────────────────────────────
// Shown as a blocking overlay when the coordinator hasn't changed their
// admin-issued password yet (user.passwordChanged is falsy).
const FirstLoginPasswordModal = ({ user, onLogout }) => {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passError, setPassError]     = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);

  const handleChangePassword = async () => {
    setPassError("");

    if (!currentPass) { setPassError("Please enter your current password."); return; }
    if (!newPass) { setPassError("Please enter a new password."); return; }
    if (!isPasswordStrong(newPass)) { setPassError("Password does not meet all the requirements below."); return; }
    if (newPass !== confirmPass) { setPassError("Passwords do not match."); return; }

    setPassLoading(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setPassError("Your session has expired. Please refresh the page and log in again.");
        setPassLoading(false);
        return;
      }
      // Re-authenticate with current (admin-issued) password first
      const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
      await reauthenticateWithCredential(currentUser, credential);
      // Now change password and update Firestore's passwordChanged flag
      await changePassword(currentPass, newPass, "coordinators", user?.uid, currentUser?.email);
      // Show confirmation modal first; onLogout is deferred until the
      // coordinator dismisses it via the "Done" button.
      setPassSuccess(true);
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
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

  const blockPaste = (e) => e.preventDefault();

  const inputStyle = {
    width: "100%", padding: "10px 44px 10px 16px",
    background: "#590101", border: passError ? "1.5px solid red" : "none",
    borderRadius: "20px", color: "white", fontSize: "0.88rem",
    fontFamily: "'Kufam', sans-serif", outline: "none",
  };

  if (passSuccess) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}>
        <div style={{
          background: "white", borderRadius: "20px",
          padding: "36px 32px", width: "clamp(280px, 85vw, 380px)",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "#e8f5e9", display: "flex",
            alignItems: "center", justifyContent: "center", marginBottom: "4px",
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2d7a2d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <p style={{
            fontFamily: "'Kufam', sans-serif", fontWeight: 700,
            fontSize: "1.15rem", color: "#1a1a1a", margin: 0, textAlign: "center",
          }}>Password Changed!</p>
          <p style={{
            fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem",
            color: "#666", margin: 0, textAlign: "center", lineHeight: 1.5,
          }}>Your password has been updated successfully. Please log in again with your new password.</p>
          <button onClick={() => onLogout?.()} style={{
            width: "100%", padding: "12px", borderRadius: "30px",
            border: "none", background: "#590101",
            fontFamily: "'Kufam', sans-serif", fontWeight: 700,
            fontSize: "0.95rem", cursor: "pointer", color: "white",
            boxShadow: "0 3px 10px rgba(89,1,1,0.3)", marginTop: "8px",
          }}>Done</button>
        </div>
      </div>
    );
  }

  return (
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
              type={showCurrent ? "text" : "password"}
              placeholder="Current Password:"
              value={currentPass}
              onChange={e => { setCurrentPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              onPaste={blockPaste}
              onCopy={blockPaste}
              onCut={blockPaste}
              style={inputStyle}
            />
            <EyeIcon show={showCurrent} onClick={() => setShowCurrent(v => !v)} />
          </div>

          <div style={{ position: "relative", marginBottom: "4px" }}>
            <input
              type={showNew ? "text" : "password"}
              placeholder="New Password:"
              value={newPass}
              onChange={e => { setNewPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              onPaste={blockPaste}
              onCopy={blockPaste}
              onCut={blockPaste}
              style={inputStyle}
            />
            <EyeIcon show={showNew} onClick={() => setShowNew(v => !v)} />
          </div>

          <PasswordChecklist password={newPass} />

          <div style={{ position: "relative", marginBottom: "4px" }}>
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm New Password:"
              value={confirmPass}
              onChange={e => { setConfirmPass(e.target.value); setPassError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } }}
              onPaste={blockPaste}
              onCopy={blockPaste}
              onCut={blockPaste}
              style={inputStyle}
            />
            <EyeIcon show={showConfirm} onClick={() => setShowConfirm(v => !v)} />
          </div>

          {passError && (
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "red", margin: "4px 0 8px 4px" }}>
              ⚠️ {passError}
            </p>
          )}

          <hr style={{ border: "none", borderTop: "1.5px solid #ddd", margin: "16px 0" }} />

          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <button onClick={handleChangePassword} disabled={passLoading} style={{
              background: darkRed, color: "white", border: "none", borderRadius: "24px",
              padding: "12px 40px", fontFamily: "'Jua', sans-serif", fontSize: "1rem",
              letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: passLoading ? "not-allowed" : "pointer", opacity: passLoading ? 0.7 : 1,
            }}>
              {passLoading ? "Saving…" : "Save"}
            </button>
            <button onClick={() => onLogout?.()} style={{
              background: "#555", color: "white", border: "none", borderRadius: "24px",
              padding: "12px 32px", fontFamily: "'Jua', sans-serif", fontSize: "1rem",
              letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
            }}>
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CoordinatorSaveSuccessModal = ({ onClose }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <div style={{
      background: "white", borderRadius: "20px",
      padding: "36px 32px", width: "clamp(280px, 85vw, 380px)",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: "#e6f7ec", display: "flex",
        alignItems: "center", justifyContent: "center", marginBottom: "4px",
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
          stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <p style={{
        fontFamily: "'Kufam', sans-serif", fontWeight: 700,
        fontSize: "1.15rem", color: "#1a1a1a", margin: 0, textAlign: "center",
      }}>Saved Successfully!</p>
      <p style={{
        fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem",
        color: "#666", margin: 0, textAlign: "center", lineHeight: 1.5,
      }}>Your personal information has been updated.</p>
      <button onClick={onClose} style={{
        width: "100%", padding: "12px", borderRadius: "30px", marginTop: "8px",
        background: darkRed, color: "white", border: "none",
        fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
      }}>OK</button>
    </div>
  </div>
);

const CoordinatorAccountProfileScreen = ({ user, onLogout }) => {
  const [view, setView]                     = useState("main");
  const [showReset, setShowReset]           = useState(false);
  const [showTransfer, setShowTransfer]     = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [profileName, setProfileName]       = useState("");
  // The signed-in coordinator's own department(s) — used to auto-assign the
  // department when adding or transferring an account, instead of letting
  // the coordinator pick a different one.
  const [coordinatorDeptSelections, setCoordinatorDeptSelections] = useState([]);

  useEffect(() => {
    const uid = user?.uid || getAuth().currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "coordinators", uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfileName(d.name || d.fullName || d.displayName || "");
        setCoordinatorDeptSelections(d.deptSelections?.length ? d.deptSelections : []);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  if (view === "personalInfo") return <><ResponsiveStyles /><PersonalInfoScreen user={user} onBack={() => setView("main")} /></>;
  if (view === "terms")        return <><ResponsiveStyles /><TermsScreen onBack={() => setView("main")} /></>;

  // Mandatory first-login password change — blocks access to the rest of the
  // account until the coordinator has replaced their admin-issued password.
  if (!user?.passwordChanged) {
    return <><ResponsiveStyles /><FirstLoginPasswordModal user={user} onLogout={onLogout} /></>;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      <ResponsiveStyles />
      <GlobalStyles />

      {/* Red banner + overlapping profile card */}
      <div style={{ position: "relative", flexShrink: 0, zIndex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "80px", background: "#590101", borderBottomLeftRadius: "30px", borderBottomRightRadius: "30px", zIndex: 1 }} />
        <div className="cap-header-card">
          <div style={{ position: "absolute", top: "-40px", width: "80px", height: "80px", borderRadius: "50%", background: "#320000", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
            <PngIcon src={PersonalAccountProfile} size={50} />
          </div>
          {/* TODO: Replace with coordinator name from backend / auth context */}
          <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.1rem, 5vw, 1.5rem)", color: darkRed, fontWeight: 500, margin: 0, textAlign: "center" }}>
            {profileName || "—"}
          </p>
        </div>
      </div>

      <div className="cap-divider" />

      {/* Scrollable body */}
      <div className="cap-body">
        <div className="cap-menu-box">
          <MenuRow iconSrc={personalInfoIcon} label="Personal Information" onClick={() => setView("personalInfo")} />
          <MenuRow iconSrc={resetIcon}        label="Reset Password"       onClick={() => setShowReset(true)} />
          <MenuRow iconSrc={termsIcon}        label="Terms & Condition"    onClick={() => setView("terms")} />
          <MenuRow iconSrc={addAccountIcon}   label="Add Account"          onClick={() => setShowAddAccount(true)} />
          <MenuRow iconSrc={transferIcon}     label="Transfer Account"     onClick={() => setShowTransfer(true)} />
        </div>

        {showTransfer   && <TransferAccountModal onClose={() => setShowTransfer(false)} currentUid={user?.uid} currentEmail={user?.email} coordinatorDeptSelections={coordinatorDeptSelections} />}
        {showAddAccount && <AddAccountModal      onClose={() => setShowAddAccount(false)} currentUid={user?.uid} currentEmail={user?.email} coordinatorDeptSelections={coordinatorDeptSelections} />}
        {showReset      && <ResetPasswordModal   onClose={() => setShowReset(false)} user={user} onLogout={onLogout} />}
      </div>
    </div>
  );
};

export default CoordinatorAccountProfileScreen;
export { PersonalInfoScreen, ResponsiveStyles };