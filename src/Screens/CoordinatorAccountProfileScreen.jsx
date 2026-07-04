import React, { useState, useRef, useEffect } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db } from "./firebase";
import { createCoordinatorAccount, transferCoordinatorAccount } from "./AuthService";

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

const PasswordInput = ({ value, onChange, placeholder = "••••••••" }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", marginBottom: "12px" }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder}
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
const AddAccountModal = ({ onClose, currentUid }) => {
  const [name, setName]                     = useState("");
  const [deptSelections, setDeptSelections] = useState([{ department: "", program: "", specialization: "" }]);
  const [sex, setSex]                       = useState("");
  const [contact, setContact]               = useState("");
  const [email, setEmail]                   = useState("");
  const [address, setAddress]               = useState("");
  const [password, setPassword]             = useState("");
  const [confirm, setConfirm]               = useState("");
  const [errors, setErrors]                 = useState({});
  const [deptErrors, setDeptErrors]         = useState([]);
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState("");

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!sex) e.sex = "Select sex.";
    if (!contact.match(/^\+63 \d{3}-\d{3}-\d{4}$/)) e.contact = "Format: +63 000-000-0000";
    if (!email.endsWith("@gmail.com")) e.email = "Must be a @gmail.com email.";
    if (!address.trim()) e.address = "Address is required.";
    if (password.length < 8) e.password = "Minimum 8 characters.";
    if (password !== confirm) e.confirm = "Passwords do not match.";

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

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      await createCoordinatorAccount({ name, sex, contact, email, address, password, deptSelections }, currentUid);
      alert(`Account for ${name} has been added successfully. They can now log in and will be prompted to set up their own password.`);
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to add account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div className="cap-modal-inner">
        <div className="cap-modal-body">
          <WarningBanner text="Add new OJT Coordinator account. This action cannot be undone." />
          <hr style={{ borderColor: "#eee", marginBottom: "16px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Name:</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" style={{ ...fieldStyle, marginBottom: "2px" }} />
              {errors.name && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif" }}>{errors.name}</p>}
            </div>
            <div>
              <label style={labelStyle}>Department / Program:</label>
              <div style={{ background: fieldBg, borderRadius: "14px", padding: "10px 12px" }}>
                <MultiDepartmentPicker selections={deptSelections} onChange={setDeptSelections} readOnly={false} errors={deptErrors} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Sex:</label>
              <div style={{ position: "relative" }}>
                <select value={sex} onChange={e => setSex(e.target.value)} style={{ ...fieldStyle, appearance: "none", paddingRight: "36px", cursor: "pointer" }}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
                <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "white", pointerEvents: "none", fontSize: "0.7rem" }}>▼</span>
              </div>
              {errors.sex && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif" }}>{errors.sex}</p>}
            </div>
            <div>
              <label style={labelStyle}>Contact Information:</label>
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="+63 000-000-0000" style={{ ...fieldStyle, marginBottom: "2px" }} />
              {errors.contact && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif" }}>{errors.contact}</p>}
            </div>
            <div>
              <label style={labelStyle}>Email Address:</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@gmail.com" style={{ ...fieldStyle, marginBottom: "2px" }} />
              {errors.email && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif" }}>{errors.email}</p>}
            </div>
            <div>
              <label style={labelStyle}>Address:</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="City, Province" style={{ ...fieldStyle, marginBottom: "2px" }} />
              {errors.address && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif" }}>{errors.address}</p>}
            </div>
          </div>
          <hr style={{ borderColor: "#eee", margin: "16px 0" }} />
          <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>SET PASSWORD:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Enter Password:</label>
              <PasswordInput value={password} onChange={e => setPassword(e.target.value)} />
              {errors.password && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif" }}>{errors.password}</p>}
            </div>
            <div>
              <label style={labelStyle}>Confirm Password:</label>
              <PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} />
              {errors.confirm && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif" }}>{errors.confirm}</p>}
            </div>
          </div>
          {submitError && (
            <p style={{ color: "red", fontSize: "0.8rem", fontFamily: "'Kufam', sans-serif", textAlign: "center", marginTop: "12px" }}>
              ⚠️ {submitError}
            </p>
          )}
        </div>
        <div className="cap-modal-footer">
          <button onClick={onClose} style={{ padding: "10px 28px", borderRadius: "20px", background: "white", color: darkRed, border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ padding: "10px 28px", borderRadius: "20px", background: "rgba(255,255,255,0.25)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Adding…" : "Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Transfer Account Modal ────────────────────────────────────────────────────
const TransferAccountModal = ({ onClose, currentUid, currentEmail }) => {
  const [currentPass, setCurrentPass] = useState("");
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");

  const validate = () => {
    const e = {};
    if (!currentPass) e.currentPass = "Your current password is required to confirm this transfer.";
    if (!name.trim()) e.name = "New coordinator's name is required.";
    if (!email.endsWith("@gmail.com")) e.email = "Must be a valid @gmail.com email.";
    if (newPass.length < 8) e.newPass = "Minimum 8 characters.";
    if (newPass !== confirmPass) e.confirmPass = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      await transferCoordinatorAccount(currentUid, currentEmail, currentPass, { name, email, password: newPass });
      alert(`Account successfully transferred to ${name}. You will no longer have access to this account.`);
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to transfer account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div className="cap-modal-inner">
        <div className="cap-modal-body">
          <WarningBanner text="Transfer to another OJT Coordinator account. This action cannot be undone — you will lose access to this account once transferred." />
          <hr style={{ borderColor: "#eee", marginBottom: "16px" }} />

          <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>CONFIRM YOUR IDENTITY:</p>
          <label style={labelStyle}>Your Current Password:</label>
          <PasswordInput value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
          {errors.currentPass && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.currentPass}</p>}

          <hr style={{ borderColor: "#eee", margin: "16px 0" }} />

          <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>NEW COORDINATOR'S DETAILS:</p>
          <label style={labelStyle}>Full Name:</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" style={{ ...fieldStyle, marginBottom: "2px" }} />
          {errors.name && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.name}</p>}

          <label style={labelStyle}>Email Address:</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@gmail.com" style={{ ...fieldStyle, marginBottom: "4px" }} />
          {errors.email && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.email}</p>}

          <label style={labelStyle}>Set Their Password:</label>
          <PasswordInput value={newPass} onChange={e => setNewPass(e.target.value)} />
          {errors.newPass && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.newPass}</p>}
          <label style={labelStyle}>Confirm Password:</label>
          <PasswordInput value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
          {errors.confirmPass && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.confirmPass}</p>}

          {submitError && (
            <p style={{ color: "red", fontSize: "0.8rem", fontFamily: "'Kufam', sans-serif", textAlign: "center", marginTop: "12px" }}>
              ⚠️ {submitError}
            </p>
          )}
        </div>
        <div className="cap-modal-footer">
          <button onClick={onClose} style={{ padding: "10px 28px", borderRadius: "20px", background: "white", color: darkRed, border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ padding: "10px 28px", borderRadius: "20px", background: "rgba(255,255,255,0.25)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Transferring…" : "Transfer Account"}
          </button>
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
    if (!val.toLowerCase().endsWith("@gmail.com")) return "Must be a @gmail.com email.";
    return "";
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Name is required.";
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
      onSaved?.(payload);
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
      <SectionHeaderBar iconSrc={personalInfoIcon} title="Personal Information" onBack={mandatory ? undefined : onBack} />
      <div className="cap-info-body">
        <div className="cap-info-card">
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
              <select value={sex} onChange={e => setSex(e.target.value)}
                style={{ background: "transparent", border: "none", borderBottom: "1px solid white", color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", outline: "none", cursor: "pointer", marginLeft: "8px" }}>
                <option value="" style={{ color: "#333" }}>Select</option>
                <option style={{ color: "#333" }}>Male</option>
                <option style={{ color: "#333" }}>Female</option>
              </select>
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
    </div>
  );
};

// ── Reset Password Steps ──────────────────────────────────────────────────────
const ResetStep1 = ({ onNext }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSend = () => {
    if (!email.endsWith("@gmail.com")) { setError("Must be a valid @gmail.com email."); return; }
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

const ResetStep3 = ({ onDone }) => {
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors]   = useState({});

  const handleSend = () => {
    const e = {};
    if (newPass.length < 8) e.newPass = "Minimum 8 characters.";
    if (newPass !== confirm) e.confirm = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length === 0) { alert("Password has been reset successfully!"); onDone(); }
  };

  return (
    <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888", marginBottom: "16px" }}>Enter your new password and confirm!</p>
      <hr style={{ borderColor: "#ccc", marginBottom: "18px" }} />
      <label style={{ ...labelStyle, color: "#111" }}>New Password:</label>
      <PasswordInput value={newPass} onChange={e => setNewPass(e.target.value)} />
      {errors.newPass && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.newPass}</p>}
      <label style={{ ...labelStyle, color: "#111" }}>Confirm Password:</label>
      <PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} />
      {errors.confirm && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.confirm}</p>}
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "8px" }}>
        <button onClick={handleSend} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "12px 40px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>Send</button>
      </div>
    </div>
  );
};

const ResetPasswordScreen = ({ onBack }) => {
  const [step, setStep] = useState(1);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SectionHeaderBar iconSrc={resetIcon} title="Reset Password" onBack={onBack} />
      <div className="cap-sub-body">
        {step === 1 && <ResetStep1 onNext={() => setStep(2)} />}
        {step === 2 && <ResetStep2 onNext={() => setStep(3)} />}
        {step === 3 && <ResetStep3 onDone={onBack} />}
      </div>
    </div>
  );
};

// ── Privacy & Security Screen ─────────────────────────────────────────────────
const PrivacySecurityScreen = ({ onBack, user }) => {
  const [subView, setSubView]               = useState(null);
  const [showTransfer, setShowTransfer]     = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);

  if (subView === "resetPassword") return <ResetPasswordScreen onBack={() => setSubView(null)} />;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SectionHeaderBar iconSrc={privacyIcon} title="Privacy and Security" onBack={onBack} />
      <div className="cap-sub-body">
        <div style={{ background: darkRed, borderRadius: "16px", padding: "16px 20px" }}>
          <MenuRow iconSrc={resetIcon}      label="Reset Password"   onClick={() => setSubView("resetPassword")} />
          <MenuRow iconSrc={transferIcon}   label="Transfer Account" onClick={() => setShowTransfer(true)} />
          <MenuRow iconSrc={addAccountIcon} label="Add Account"      onClick={() => setShowAddAccount(true)} />
        </div>
      </div>
      {showTransfer   && <TransferAccountModal onClose={() => setShowTransfer(false)} currentUid={user?.uid} currentEmail={user?.email} />}
      {showAddAccount && <AddAccountModal      onClose={() => setShowAddAccount(false)} currentUid={user?.uid} />}
    </div>
  );
};

// ── Terms Screen ──────────────────────────────────────────────────────────────
const TermsScreen = ({ onBack }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <SectionHeaderBar iconSrc={termsIcon} title="Terms & Condition" onBack={onBack} />
    <div className="cap-sub-body">
      <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#444", lineHeight: 1.8 }}>
          By using OJTern, you agree to the following terms and conditions. All information provided must be accurate and up-to-date. The coordinator is responsible for managing student OJT placements fairly. Misuse of the platform may result in account suspension. Student data must be handled with confidentiality. OJTern reserves the right to update these terms at any time.
        </p>
      </div>
    </div>
  </div>
);

// ── Main Screen ───────────────────────────────────────────────────────────────

const LogoutModal = ({ onConfirm, onCancel }) => (
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
      {/* Icon */}
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: "#fde8e8", display: "flex",
        alignItems: "center", justifyContent: "center", marginBottom: "4px",
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
          stroke="#8B0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </div>
      <p style={{
        fontFamily: "'Kufam', sans-serif", fontWeight: 700,
        fontSize: "1.15rem", color: "#1a1a1a", margin: 0, textAlign: "center",
      }}>Log Out</p>
      <p style={{
        fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem",
        color: "#666", margin: 0, textAlign: "center", lineHeight: 1.5,
      }}>Are you sure you want to log out of your account?</p>
      <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "8px" }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: "12px", borderRadius: "30px",
          border: "1.5px solid #ccc", background: "white",
          fontFamily: "'Kufam', sans-serif", fontWeight: 600,
          fontSize: "0.95rem", cursor: "pointer", color: "#555",
        }}>Cancel</button>
        <button onClick={onConfirm} style={{
          flex: 1, padding: "12px", borderRadius: "30px",
          border: "none", background: "#8B0000",
          fontFamily: "'Kufam', sans-serif", fontWeight: 700,
          fontSize: "0.95rem", cursor: "pointer", color: "white",
          boxShadow: "0 3px 10px rgba(139,0,0,0.3)",
        }}>Log Out</button>
      </div>
    </div>
  </div>
);

const CoordinatorAccountProfileScreen = ({ user, onLogout }) => {
  const [view, setView]                     = useState("main");
  const [showTransfer, setShowTransfer]     = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [profileName, setProfileName]       = useState("");
  const [showLogout, setShowLogout]         = useState(false);

  useEffect(() => {
    const uid = user?.uid || getAuth().currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "coordinators", uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfileName(d.name || d.fullName || d.displayName || "");
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const handleLogoutConfirm = async () => {
    await signOut(getAuth());
    if (onLogout) onLogout();
  };

  if (view === "personalInfo") return <><ResponsiveStyles /><PersonalInfoScreen user={user} onBack={() => setView("main")} /></>;
  if (view === "privacy")      return <><ResponsiveStyles /><PrivacySecurityScreen onBack={() => setView("main")} user={user} /></>;
  if (view === "terms")        return <><ResponsiveStyles /><TermsScreen onBack={() => setView("main")} /></>;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      {showLogout && <LogoutModal onConfirm={handleLogoutConfirm} onCancel={() => setShowLogout(false)} />}
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
          <MenuRow iconSrc={privacyIcon}      label="Privacy & Security"   onClick={() => setView("privacy")} />
          <MenuRow iconSrc={termsIcon}        label="Terms & Condition"    onClick={() => setView("terms")} />
          <MenuRow iconSrc={addAccountIcon}   label="Add Account"          onClick={() => setShowAddAccount(true)} />
          <MenuRow iconSrc={transferIcon}     label="Transfer Account"     onClick={() => setShowTransfer(true)} />
        </div>

        <button onClick={() => setShowLogout(true)}
          style={{ background: "#320000", color: "white", border: "none", borderRadius: "30px", padding: "14px clamp(28px, 8vw, 52px)", fontFamily: "'Jua'", fontSize: "clamp(1rem, 4vw, 1.2rem)", cursor: "pointer", letterSpacing: "0.03em", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
          Log Out
        </button>

        {showTransfer   && <TransferAccountModal onClose={() => setShowTransfer(false)} currentUid={user?.uid} currentEmail={user?.email} />}
        {showAddAccount && <AddAccountModal      onClose={() => setShowAddAccount(false)} currentUid={user?.uid} />}
      </div>
    </div>
  );
};

export default CoordinatorAccountProfileScreen;
export { PersonalInfoScreen };