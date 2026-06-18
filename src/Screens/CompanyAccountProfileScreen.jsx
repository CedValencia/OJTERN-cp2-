import React, { useState, useRef, useEffect } from "react";
import { doc, onSnapshot, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db } from "./firebase";
import AccountProfile from "../icons/accountprofile.png";
import viewIcon from "../icons/view.png";
import PersonalAccountProfile from "../icons/personalaccountprofile.png";
import personalInfoIcon from "../icons/personal.png";
import privacyIcon from "../icons/priv.png";
import termsIcon from "../icons/terms.png";
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

    /* ── OTP row ── */
    .cap-otp-row {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      justify-content: center;
      flex-wrap: wrap;
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

// ── Industries ────────────────────────────────────────────────────────────────
// TODO: Populate from backend or config
const INDUSTRIES = [];

// ── College / Program Data ────────────────────────────────────────────────────
// TODO: Populate from backend or config
const COLLEGE_PROGRAM_DATA = {};

// ── Location Data ─────────────────────────────────────────────────────────────
// TODO: Populate from backend or config
const REGIONS = [];

// ── Shared Styles ─────────────────────────────────────────────────────────────
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

// ── Shared Components ─────────────────────────────────────────────────────────
const PngIcon = ({ src, size = 120 }) => (
  <img src={src} alt="" style={{ width: `${size}px`, height: `${size}px`, objectFit: "contain", flexShrink: 0 }} />
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

const BackButton = ({ onClick }) => (
  <button onClick={onClick} title="Go back"
    style={{ background: "rgba(255,255,255,0.18)", border: "2px solid white", borderRadius: "50%", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  </button>
);

const SectionHeaderBar = ({ iconSrc, title, onBack }) => (
  <div className="cap-section-header">
    {onBack && <BackButton onClick={onBack} />}
    {iconSrc && <PngIcon src={iconSrc} size={38} />}
    <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.8rem", color: "white", letterSpacing: "0.02em", margin: 0 }}>{title}</h2>
  </div>
);

const MenuRow = ({ iconSrc, label, onClick }) => (
  <div onClick={onClick} className="cap-menu-row">
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      {iconSrc && <PngIcon src={iconSrc} size={38} />}
      <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1rem", color: "white" }}>{label}</span>
    </div>
    <img src={viewIcon} alt="view" style={{ width: "38px", height: "38px", objectFit: "contain" }} />
  </div>
);

// ── Industry Multi-Select ─────────────────────────────────────────────────────
const IndustrySelect = ({ selected, onChange, otherText, onOtherTextChange, editable = true }) => {
  const [open, setOpen] = useState(false);

  const toggle = (ind) => {
    if (!editable) return;
    if (selected.includes(ind)) onChange(selected.filter(i => i !== ind));
    else onChange([...selected, ind]);
  };

  const displayText = selected.length === 0
    ? "Select Industry"
    : selected.map(i => i === "Others" && otherText ? `Others: ${otherText}` : i).join(", ");

  return (
    <div style={{ position: "relative", marginBottom: "10px" }}>
      <div onClick={() => editable && setOpen(o => !o)}
        style={{ ...fieldStyle, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: editable ? "pointer" : "default" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90%", fontSize: "0.82rem" }}>{displayText}</span>
        <span style={{ fontSize: "0.7rem" }}>▼</span>
      </div>
      {open && editable && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: `1.5px solid ${red}`, borderRadius: "10px", boxShadow: "0 6px 20px rgba(0,0,0,0.15)", zIndex: 300, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "220px" }}>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {INDUSTRIES.map(ind => (
              <div key={ind} onClick={() => toggle(ind)}
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 14px", cursor: "pointer", background: selected.includes(ind) ? "#f5e0e0" : "white", borderBottom: "1px solid #f0f0f0" }}
                onMouseEnter={e => { if (!selected.includes(ind)) e.currentTarget.style.background = "#faf0f0"; }}
                onMouseLeave={e => { if (!selected.includes(ind)) e.currentTarget.style.background = "white"; }}>
                <div style={{ width: "16px", height: "16px", borderRadius: "3px", border: `2px solid ${red}`, background: selected.includes(ind) ? red : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {selected.includes(ind) && <span style={{ color: "white", fontSize: "10px", fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#222" }}>{ind}</span>
              </div>
            ))}
          </div>
          <div onClick={() => setOpen(false)} style={{ padding: "8px 14px", textAlign: "right", borderTop: "1px solid #eee", flexShrink: 0 }}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: red, cursor: "pointer", fontWeight: 600 }}>Done ✓</span>
          </div>
        </div>
      )}
      {selected.includes("Others") && editable && (
        <input type="text" placeholder="Please specify..." value={otherText} onChange={e => onOtherTextChange(e.target.value)} style={{ ...fieldStyle, marginTop: "6px" }} />
      )}
      {selected.includes("Others") && !editable && otherText && (
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.85)", marginTop: "4px", marginLeft: "4px" }}>Others: {otherText}</p>
      )}
    </div>
  );
};

// ── Multi-College Program Picker ──────────────────────────────────────────────
const MultiCollegeProgramPicker = ({ selections, onChange, editable = true }) => {
  const colleges = Object.keys(COLLEGE_PROGRAM_DATA);

  const addEntry    = () => onChange([...selections, { college: "", program: "", specialization: "" }]);
  const removeEntry = (idx) => onChange(selections.filter((_, i) => i !== idx));
  const updateEntry = (idx, field, value) => {
    const updated = selections.map((entry, i) => {
      if (i !== idx) return entry;
      if (field === "college") return { college: value, program: "", specialization: "" };
      if (field === "program") return { ...entry, program: value, specialization: "" };
      return { ...entry, [field]: value };
    });
    onChange(updated);
  };

  const selStyle = {
    ...fieldStyle, appearance: "none", WebkitAppearance: "none",
    paddingRight: "28px", cursor: editable ? "pointer" : "default", marginBottom: "6px",
  };

  return (
    <div>
      {selections.map((entry, idx) => {
        const programs = entry.college ? Object.keys(COLLEGE_PROGRAM_DATA[entry.college].programs) : [];
        const specializations = entry.college && entry.program
          ? COLLEGE_PROGRAM_DATA[entry.college]?.programs[entry.program]?.specializations ?? []
          : [];

        return (
          <div key={idx} style={{ background: "rgba(0,0,0,0.15)", borderRadius: "10px", padding: "8px 10px", marginBottom: "6px", position: "relative" }}>
            {editable && selections.length > 1 && (
              <button onClick={() => removeEntry(idx)}
                style={{ position: "absolute", top: "6px", right: "8px", background: "none", border: "none", color: "white", fontSize: "1rem", cursor: "pointer", fontWeight: "700" }}>✕</button>
            )}
            <div style={{ position: "relative" }}>
              <select disabled={!editable} value={entry.college} onChange={e => updateEntry(idx, "college", e.target.value)} style={selStyle}>
                <option value="">Select College:</option>
                {colleges.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {editable && <span style={{ position: "absolute", right: "10px", top: "38%", transform: "translateY(-50%)", color: "white", pointerEvents: "none", fontSize: "0.7rem" }}>▼</span>}
            </div>
            {entry.college && (
              <div style={{ position: "relative" }}>
                <select disabled={!editable} value={entry.program} onChange={e => updateEntry(idx, "program", e.target.value)} style={selStyle}>
                  <option value="">Select Program:</option>
                  {programs.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {editable && <span style={{ position: "absolute", right: "10px", top: "38%", transform: "translateY(-50%)", color: "white", pointerEvents: "none", fontSize: "0.7rem" }}>▼</span>}
              </div>
            )}
            {entry.program && specializations.length > 0 && (
              <div style={{ position: "relative" }}>
                <select disabled={!editable} value={entry.specialization} onChange={e => updateEntry(idx, "specialization", e.target.value)} style={{ ...selStyle, marginBottom: 0 }}>
                  <option value="">Select Major / Specialization:</option>
                  {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {editable && <span style={{ position: "absolute", right: "10px", top: "38%", transform: "translateY(-50%)", color: "white", pointerEvents: "none", fontSize: "0.7rem" }}>▼</span>}
              </div>
            )}
          </div>
        );
      })}
      {editable && (
        <button onClick={addEntry}
          style={{ background: "none", border: "1.5px dashed rgba(255,255,255,0.5)", borderRadius: "10px", color: "rgba(255,255,255,0.9)", width: "100%", padding: "6px", fontFamily: "'Jersey 25', sans-serif", fontSize: "0.95rem", cursor: "pointer", marginTop: "2px" }}>
          + Add Another College / Program
        </button>
      )}
    </div>
  );
};

// ── Location Picker ───────────────────────────────────────────────────────────
const LocationPicker = ({ location, onChange, editable = true }) => {
  const { region, province, city, barangay, street } = location;
  const regionData   = REGIONS.find(r => r.name === region);
  const provinceData = regionData?.provinces.find(p => p.name === province);
  const cityData     = provinceData?.cities.find(c => c.name === city);

  const handleRegion   = (val) => onChange({ region: val, province: "", city: "", barangay: "", street: "" });
  const handleProvince = (val) => onChange({ region, province: val, city: "", barangay: "", street: "" });
  const handleCity     = (val) => onChange({ region, province, city: val, barangay: "", street: "" });
  const handleBarangay = (val) => onChange({ region, province, city, barangay: val, street });
  const handleStreet   = (val) => onChange({ region, province, city, barangay, street: val });

  const dropStyle = { ...fieldStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "28px", cursor: editable ? "pointer" : "default", marginBottom: "6px" };
  const Arrow = () => <span style={{ position: "absolute", right: "14px", top: "38%", transform: "translateY(-50%)", color: "white", pointerEvents: "none", fontSize: "0.7rem" }}>▼</span>;

  return (
    <div>
      <div style={{ position: "relative" }}>
        <select disabled={!editable} value={region} onChange={e => handleRegion(e.target.value)} style={dropStyle}>
          <option value="">Select Region:</option>
          {REGIONS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        {editable && <Arrow />}
      </div>
      {region && (
        <div style={{ position: "relative" }}>
          <select disabled={!editable} value={province} onChange={e => handleProvince(e.target.value)} style={dropStyle}>
            <option value="">Select Province:</option>
            {regionData?.provinces.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          {editable && <Arrow />}
        </div>
      )}
      {province && (
        <div style={{ position: "relative" }}>
          <select disabled={!editable} value={city} onChange={e => handleCity(e.target.value)} style={dropStyle}>
            <option value="">Select City / Municipality:</option>
            {provinceData?.cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          {editable && <Arrow />}
        </div>
      )}
      {city && (
        <div style={{ position: "relative" }}>
          <select disabled={!editable} value={barangay} onChange={e => handleBarangay(e.target.value)} style={dropStyle}>
            <option value="">Select Barangay:</option>
            {cityData?.barangays.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {editable && <Arrow />}
        </div>
      )}
      {city && (
        <input type="text" disabled={!editable} placeholder="Street / Building (optional):" value={street}
          onChange={e => handleStreet(e.target.value)} style={{ ...fieldStyle, marginBottom: "6px" }} />
      )}
    </div>
  );
};

// ── Reset Steps ───────────────────────────────────────────────────────────────
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
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);
  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...code]; next[i] = val; setCode(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => { if (e.key === "Backspace" && !code[i] && i > 0) inputRefs.current[i - 1]?.focus(); };
  const handleSend = () => { if (code.join("").length < 6) { alert("Please enter the full 6-digit code."); return; } onNext(); };
  return (
    <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888", marginBottom: "16px" }}>Enter the code sent to your gmail account.</p>
      <hr style={{ borderColor: "#ccc", marginBottom: "18px" }} />
      <label style={{ ...labelStyle, color: "#111" }}>Enter the code:</label>
      <div className="cap-otp-row">
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
const PrivacySecurityScreen = ({ onBack }) => {
  const [subView, setSubView] = useState(null);
  if (subView === "resetPassword") return <ResetPasswordScreen onBack={() => setSubView(null)} />;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SectionHeaderBar iconSrc={privacyIcon} title="Privacy and Security" onBack={onBack} />
      <div className="cap-sub-body">
        <div style={{ background: darkRed, borderRadius: "16px", padding: "16px 20px" }}>
          <MenuRow iconSrc={resetIcon} label="Reset Password" onClick={() => setSubView("resetPassword")} />
        </div>
      </div>
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
          By using OJTern, you agree to the following terms and conditions. All information provided must be accurate and up-to-date. The company is responsible for managing OJT postings and applicant data fairly. Misuse of the platform may result in account suspension. Student data must be handled with confidentiality. OJTern reserves the right to update these terms at any time.
        </p>
      </div>
    </div>
  </div>
);

// ── Save Modals ───────────────────────────────────────────────────────────────
const SaveSuccessModal = ({ onClose }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  }}>
    <div style={{
      background: "white", borderRadius: "20px",
      padding: "36px 32px", width: "clamp(280px, 85vw, 360px)",
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
      <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1.15rem", color: "#1a1a1a", margin: 0 }}>
        Saved Successfully!
      </p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#666", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
        Your profile information has been updated.
      </p>
      <button onClick={onClose} style={{
        marginTop: "8px", width: "100%", padding: "12px", borderRadius: "30px",
        border: "none", background: "#8B0000",
        fontFamily: "'Kufam', sans-serif", fontWeight: 700,
        fontSize: "0.95rem", cursor: "pointer", color: "white",
        boxShadow: "0 3px 10px rgba(139,0,0,0.3)",
      }}>Done</button>
    </div>
  </div>
);

const SaveErrorModal = ({ message, onClose }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  }}>
    <div style={{
      background: "white", borderRadius: "20px",
      padding: "36px 32px", width: "clamp(280px, 85vw, 360px)",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: "#fde8e8", display: "flex",
        alignItems: "center", justifyContent: "center", marginBottom: "4px",
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
          stroke="#8B0000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1.15rem", color: "#1a1a1a", margin: 0 }}>
        Save Failed
      </p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#666", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
        {message || "Something went wrong. Please try again."}
      </p>
      <button onClick={onClose} style={{
        marginTop: "8px", width: "100%", padding: "12px", borderRadius: "30px",
        border: "none", background: "#8B0000",
        fontFamily: "'Kufam', sans-serif", fontWeight: 700,
        fontSize: "0.95rem", cursor: "pointer", color: "white",
        boxShadow: "0 3px 10px rgba(139,0,0,0.3)",
      }}>Try Again</button>
    </div>
  </div>
);

// ── Personal Information Screen ───────────────────────────────────────────────
const PersonalInfoScreen = ({ onBack, user }) => {
  const [editing, setEditing]             = useState(false);
  const [loading, setLoading]             = useState(true);

  const [companyName, setCompanyName]     = useState("");
  const [industries, setIndustries]       = useState([]);
  const [otherIndustry, setOtherIndustry] = useState("");
  const [courseSelections, setCourseSelections] = useState([
    { college: "", program: "", specialization: "" }
  ]);
  const [location, setLocation] = useState({
    region: "", province: "", city: "", barangay: "", street: "",
  });
  const [email, setEmail]   = useState("");
  const [errors, setErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError]     = useState(false);
  const [errorMsg, setErrorMsg]       = useState("");

  useEffect(() => {
    const uid = user?.uid || getAuth().currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, "companies", uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setCompanyName(d.companyName || d.name || "");
        setEmail(d.email || "");
        if (d.industry) setIndustries(Array.isArray(d.industry) ? d.industry : [d.industry]);
        if (d.location) setLocation({
          region:   d.location.region   || "",
          province: d.location.province || "",
          city:     d.location.city     || "",
          barangay: d.location.barangay || "",
          street:   d.location.street   || "",
        });
        if (d.courseSelections) setCourseSelections(d.courseSelections);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const validate = () => {
    const e = {};
    if (!companyName.trim()) e.companyName = "Company name is required.";
    if (industries.length === 0) e.industries = "Select at least one industry.";
    if (!email.trim()) e.email = "Email is required.";
    if (!location.region) e.location = "Please select a region.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const uid = user?.uid || getAuth().currentUser?.uid;
    if (!uid) { alert("Error: Not logged in."); return; }
    try {
      await updateDoc(doc(db, "companies", uid), {
        companyName, industry: industries, courseSelections, location, email,
      });
      const postsSnap = await getDocs(query(collection(db, "ojt_posts"), where("companyId", "==", uid)));
      await Promise.all(postsSnap.docs.map(d => updateDoc(d.ref, { companyName, name: companyName })));
      const convsSnap = await getDocs(query(collection(db, "conversations"), where("participants", "array-contains", uid)));
      await Promise.all(convsSnap.docs.map(d => updateDoc(d.ref, { [`participantNames.${uid}`]: companyName })));
      setEditing(false);
      setErrors({});
      setShowSuccess(true);
    } catch (err) {
      console.error("Save failed:", err);
      setErrorMsg(err.message);
      setShowError(true);
    }
  };

  const inlineInputStyle = {
    background: "transparent", border: "none", borderBottom: "1px solid white",
    color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem",
    outline: "none", width: "calc(100% - 120px)", marginLeft: "8px", boxSizing: "border-box",
  };

  const rowStyle = {
    display: "flex", alignItems: editing ? "flex-start" : "center",
    justifyContent: "space-between", background: "#7A4F4F",
    borderRadius: "10px", padding: "12px 16px", marginBottom: "8px",
  };

  const locationDisplay = [location.street, location.barangay, location.city, location.province, location.region].filter(Boolean).join(", ");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {showSuccess && <SaveSuccessModal onClose={() => setShowSuccess(false)} />}
      {showError   && <SaveErrorModal message={errorMsg} onClose={() => setShowError(false)} />}
      <SectionHeaderBar iconSrc={personalInfoIcon} title="Personal Information" onBack={onBack} />
      <div className="cap-info-body">
        <div className="cap-info-card">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
            {!editing && (
              <button onClick={() => setEditing(true)} title="Edit"
                style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2px solid white", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <EditIcon size={15} color="white" />
              </button>
            )}
          </div>

          {/* Company Name */}
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white" }}>Company Name: </span>
              {editing ? (
                <>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company Name" style={inlineInputStyle} />
                  {errors.companyName && <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "2px 0 0 8px" }}>{errors.companyName}</p>}
                </>
              ) : (
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "white", marginLeft: "4px" }}>{companyName || "—"}</span>
              )}
            </div>
          </div>

          {/* Industry */}
          <div style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch" }}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white", marginBottom: editing ? "8px" : "0" }}>
              Industry:{" "}
              {!editing && <span style={{ fontWeight: 400 }}>{industries.length > 0 ? industries.join(", ") : "—"}</span>}
            </span>
            {editing && (
              <>
                <IndustrySelect selected={industries} onChange={setIndustries} otherText={otherIndustry} onOtherTextChange={setOtherIndustry} editable={true} />
                {errors.industries && <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "2px 0 0" }}>{errors.industries}</p>}
              </>
            )}
          </div>

          {/* OJT College / Program */}
          <div style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch" }}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white", marginBottom: "8px" }}>OJT College / Program:</span>
            {editing ? (
              <MultiCollegeProgramPicker selections={courseSelections} onChange={setCourseSelections} editable={true} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {courseSelections.map((sel, i) => (
                  <span key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.9)" }}>
                    {[sel.college, sel.program, sel.specialization].filter(Boolean).join(" → ") || "—"}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch" }}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white", marginBottom: editing ? "8px" : "0" }}>
              Location:{" "}
              {!editing && <span style={{ fontWeight: 400, fontSize: "0.82rem" }}>{locationDisplay || "—"}</span>}
            </span>
            {editing && (
              <>
                <LocationPicker location={location} onChange={setLocation} editable={true} />
                {errors.location && <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "2px 0 0" }}>{errors.location}</p>}
              </>
            )}
          </div>

          {/* Email */}
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white" }}>Email Address: </span>
              {editing ? (
                <>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@gmail.com" style={inlineInputStyle} />
                  {errors.email && <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "2px 0 0 8px" }}>{errors.email}</p>}
                </>
              ) : (
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "white", marginLeft: "4px" }}>{email || "—"}</span>
              )}
            </div>
          </div>

          {editing && (
            <div className="cap-save-row">
              <button onClick={() => { setEditing(false); setErrors({}); }}
                style={{ padding: "6px 18px", borderRadius: "14px", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid white", fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave}
                style={{ padding: "6px 18px", borderRadius: "14px", background: "white", color: darkRed, border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>Save Changes</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Logout Modal ──────────────────────────────────────────────────────────────
const LogoutModal = ({ onConfirm, onCancel }) => (
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
      <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1.15rem", color: "#1a1a1a", margin: 0, textAlign: "center" }}>Log Out</p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#666", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
        Are you sure you want to log out of your account?
      </p>
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

// ── Main Company Account Profile Screen ───────────────────────────────────────
const CompanyAccountProfileScreen = ({ user, onLogout }) => {
  const [view, setView]             = useState("main");
  const [showLogout, setShowLogout] = useState(false);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    const uid = user?.uid || getAuth().currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "companies", uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfileName(d.companyName || d.name || d.displayName || "");
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const handleLogoutConfirm = async () => {
    await signOut(getAuth());
    if (onLogout) onLogout();
  };

  if (view === "personalInfo") return <><ResponsiveStyles /><PersonalInfoScreen onBack={() => setView("main")} user={user} /></>;
  if (view === "privacy")      return <><ResponsiveStyles /><PrivacySecurityScreen onBack={() => setView("main")} /></>;
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
        </div>

        <button onClick={() => setShowLogout(true)}
          style={{ background: "#320000", color: "white", border: "none", borderRadius: "30px", padding: "14px clamp(28px, 8vw, 52px)", fontFamily: "'Jua'", fontSize: "clamp(1rem, 4vw, 1.2rem)", cursor: "pointer", letterSpacing: "0.03em", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
          Log Out
        </button>
      </div>
    </div>
  );
};

export default CompanyAccountProfileScreen;