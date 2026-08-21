import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db } from "./firebase";
import { changePassword } from "./AuthService";
import AccountProfile from "../icons/accountprofile.png";
import viewIcon from "../icons/view.png";
import PersonalAccountProfile from "../icons/personalaccountprofile.png";
import personalInfoIcon from "../icons/personal.png";
import privacyIcon from "../icons/priv.png";
import termsIcon from "../icons/terms.png";
import resetIcon from "../icons/priv.png";

// ─── Color Tokens ─────────────────────────────────────────────────────────────
const red     = "#590101";
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

    .sap-header-card {
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
      .sap-header-card { padding: 48px 20px 14px; min-width: unset; width: 90%; }
    }

    .sap-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px 28px;
      background: #f0f0f0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    @media (max-width: 480px) {
      .sap-body { padding: 12px 12px 24px; }
    }

    .sap-menu-box {
      background: #590101;
      border-radius: 16px;
      padding: 16px 20px;
      margin-bottom: 28px;
      width: 100%;
      box-sizing: border-box;
      overflow-y: auto;
      max-height: 260px;
    }
    @media (max-width: 480px) {
      .sap-menu-box { padding: 12px 12px; }
    }

    .sap-menu-row {
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
    .sap-menu-row:hover { background: #8f5f5f; }
    @media (max-width: 480px) {
      .sap-menu-row { padding: 10px 12px; }
    }

    .sap-section-header {
      background: linear-gradient(90deg, #590101 0%, #590101 100%);
      padding: 16px 28px;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }
    @media (max-width: 480px) {
      .sap-section-header { padding: 12px 14px; gap: 10px; }
      .sap-section-header h2 { font-size: 1.3rem !important; }
    }

    .sap-info-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 24px 32px;
      background: #f5f5f5;
    }
    @media (max-width: 560px) {
      .sap-info-body { padding: 16px 14px; }
    }

    .sap-info-card {
      background: #590101;
      border-radius: 16px;
      padding: 16px 20px;
    }
    @media (max-width: 480px) {
      .sap-info-card { padding: 12px 12px; }
    }

    .sap-sub-body {
      flex: 1;
      overflow-y: auto;
      padding: 28px 32px;
      background: #f5f5f5;
    }
    @media (max-width: 560px) {
      .sap-sub-body { padding: 16px 14px; }
    }

    .sap-otp-row {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .sap-otp-input {
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
      .sap-otp-input { width: 38px; height: 48px; font-size: 1.4rem; border-radius: 8px; }
    }

    .sap-divider {
      width: 80%;
      height: 1px;
      background: #ccc;
      margin: 16px 0;
    }
    @media (max-width: 480px) {
      .sap-divider { width: 92%; }
    }

    .sap-save-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    /* ── Modal inner ── */
    .sap-modal-inner {
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
    .sap-modal-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 24px 28px;
    }
    @media (max-width: 480px) {
      .sap-modal-body { padding: 16px 16px; }
    }

    /* ── Modal footer ── */
    .sap-modal-footer {
      background: #590101;
      padding: 14px 24px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    @media (max-width: 400px) {
      .sap-modal-footer { padding: 10px 14px; flex-direction: column-reverse; align-items: stretch; }
      .sap-modal-footer button { width: 100%; text-align: center; }
    }
  `}</style>
);

// ─── College & Program Data ───────────────────────────────────────────────────
const COLLEGE_PROGRAM_MAP = {
  CCS:  { label: "College of Computer Studies",
          programs: { BSIT: "Bachelor of Science in Information Technology" } },
  CBA:  { label: "College of Business and Accountancy",
          programs: {
            "BSBA (Major in Marketing Management)": "BS Business Administration — Major in Marketing Management",
            BSA: "Bachelor of Science in Accountancy",
          } },
  CCJE: { label: "College of Criminal Justice Education",
          programs: { "BS CRIM": "Bachelor of Science in Criminology" } },
  CLA:  { label: "College of Liberal Arts",
          programs: { "BA POLSCI": "Bachelor of Arts in Political Science" } },
  CED:  { label: "College of Education",
          programs: {
            BEED: "Bachelor of Elementary Education",
            "BSED (Major in English)": "BS Education — Major in English",
            "BSED (Major in Mathematics)": "BS Education — Major in Mathematics",
          } },
  CHM:  { label: "College of Hospitality Management",
          programs: {
            BSTM: "Bachelor of Science in Tourism Management",
            BSHM: "Bachelor of Science in Hospitality Management",
          } },
};

const YEAR_SECTIONS = [
  "4-A","4-B","4-C","4-D",
];

// ─── Shared Field Style ───────────────────────────────────────────────────────
const fieldStyle = {
  width: "100%",
  padding: "10px 16px",
  background: fieldBg,
  border: "none",
  borderRadius: "20px",
  color: "white",
  fontSize: "0.88rem",
  fontFamily: "'Kufam', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

// ─── Shared Label Style ───────────────────────────────────────────────────────
const labelStyle = {
  fontFamily: "'Kufam', sans-serif",
  fontWeight: 700,
  fontSize: "0.88rem",
  color: "#222",
  marginBottom: "4px",
  display: "block",
};


// ─── PngIcon Component ────────────────────────────────────────────────────────
const PngIcon = ({ src, size = 80 }) => (
  <img
    src={src}
    alt=""
    style={{
      width: size,
      height: size,
      objectFit: "contain",
      flexShrink: 0,
    }}
  />
);


// ─── EditIcon Component ───────────────────────────────────────────────────────
const EditIcon = ({ size = 16, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);


// ─── EyeIcon Component ────────────────────────────────────────────────────────
const EyeIcon = ({ show, onClick }) => (
  <span
    onClick={onClick}
    style={{
      position: "absolute",
      right: "14px",
      top: "50%",
      transform: "translateY(-50%)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
    }}
  >
    {show ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
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


// ─── GlobalStyles Component ───────────────────────────────────────────────────
const GlobalStyles = () => {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      input[type="password"]::-ms-reveal,
      input[type="password"]::-ms-clear { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
};


// ─── PasswordInput Component ──────────────────────────────────────────────────
const PasswordInput = ({ value, onChange, placeholder = "••••••••", onKeyDown }) => {
  const [show, setShow] = useState(false);
  const blockPaste = (e) => e.preventDefault();
  return (
    <div style={{ position: "relative", marginBottom: "12px" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        onPaste={blockPaste}
        onCopy={blockPaste}
        onCut={blockPaste}
        style={{ ...fieldStyle, paddingRight: "44px" }}
      />
      <EyeIcon show={show} onClick={() => setShow(s => !s)} />
    </div>
  );
};


// ─── BackButton Component ─────────────────────────────────────────────────────
const BackButton = ({ onClick }) => (
  <button
    onClick={onClick}
    title="Go back"
    style={{
      background: "rgba(255,255,255,0.18)",
      border: "2px solid white",
      borderRadius: "50%",
      width: "34px",
      height: "34px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flexShrink: 0,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  </button>
);


// ─── SectionHeaderBar Component ───────────────────────────────────────────────
const SectionHeaderBar = ({ iconSrc, title, onBack }) => (
  <div className="sap-section-header">
    {onBack && <BackButton onClick={onBack} />}
    {iconSrc && <PngIcon src={iconSrc} size={38} />}
    <h2 style={{
      fontFamily: "'Jersey 25', sans-serif",
      fontSize: "1.8rem",
      color: "white",
      letterSpacing: "0.02em",
      margin: 0,
    }}>
      {title}
    </h2>
  </div>
);


// ─── MenuRow Component ────────────────────────────────────────────────────────
const MenuRow = ({ iconSrc, label, onClick }) => (
  <div
    onClick={onClick}
    className="sap-menu-row"
  >
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      {iconSrc && <PngIcon src={iconSrc} size={38} />}
      <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1rem", color: "white" }}>
        {label}
      </span>
    </div>
    <img src={viewIcon} alt="view" style={{ width: "38px", height: "38px", objectFit: "contain" }} />
  </div>
);


// ─── PersonalInfoScreen Component ─────────────────────────────────────────────
const PersonalInfoScreen = ({ onBack, user }) => {
  const [editing, setEditing] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const editingRef = useRef(false);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    studentId:      "",
    lastName:       "",
    middleInitial:  "",
    firstName:      "",
    suffix:         "",
    collegeCode:    "",
    programCode:    "",
    yearSection:    "",
    sex:            "",
    age:            "",
    email:          "",
  });

  // ── Load student data from Firestore ──────────────────────────────────────
  // Map abbreviation → full college name used by COLLEGES array
  const COLLEGE_ABBR_MAP = {
    "CCS":  "College of Computer Studies",
    "CBA":  "College of Business and Accountancy",
    "CCJE": "College of Criminal Justice Education",
    "CLA":  "College of Liberal Arts",
    "CED":  "College of Education",
    "CHM":  "College of Hospitality Management",
  };

  // Map abbreviated program → full program name used by COLLEGES array
  const PROGRAM_ABBR_MAP = {
    "BSIT":                          "Bachelor of Science in Information Technology",
    "BSBA (Major in Marketing Management)": "Bachelor of Science in Business Administration",
    "BSA":                           "Bachelor of Science in Accountancy",
    "BS CRIM":                       "Bachelor of Science in Criminology",
    "BA POLSCI":                     "Bachelor of Arts in Political Science",
    "BEED":                          "Bachelor of Elementary Education",
    "BSED (Major in English)":       "Bachelor of Secondary Education",
    "BSED (Major in Mathematics)":   "Bachelor of Secondary Education",
    "BSTM":                          "Bachelor of Science in Tourism Management",
    "BSHM":                          "Bachelor of Science in Hospitality Management",
  };

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "students", user.uid), (snap) => {
      if (snap.exists() && !editingRef.current) {
        const d = snap.data();
        setForm({
          studentId:      d.studentId      || "",
          lastName:       d.lastName       || "",
          middleInitial:  d.middleInitial  || "",
          firstName:      d.firstName      || "",
          suffix:         d.suffix         || "",
          collegeCode:    d.college        || "",
          programCode:    d.program        || "",
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

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", fontFamily: "'Kufam', sans-serif", color: "#888" }}>
      Loading profile…
    </div>
  );

  const collegeInfo    = COLLEGE_PROGRAM_MAP[form.collegeCode];
  const collegeLabel   = collegeInfo?.label || form.collegeCode || "—";
  const programLabel   = collegeInfo?.programs?.[form.programCode] || form.programCode || "—";
  const programEntries = collegeInfo ? Object.entries(collegeInfo.programs) : [];
  // Defensive fallback: if the student's stored program/college code doesn't match
  // any known key (e.g. imported with a different format), still show it as a
  // selectable option instead of leaving the dropdown blank / forcing a reselect.
  const programEntriesForSelect = (form.programCode && !programEntries.some(([code]) => code === form.programCode))
    ? [...programEntries, [form.programCode, programLabel]]
    : programEntries;
  const collegeEntriesForSelect = (form.collegeCode && !COLLEGE_PROGRAM_MAP[form.collegeCode])
    ? [...Object.entries(COLLEGE_PROGRAM_MAP), [form.collegeCode, { label: collegeLabel }]]
    : Object.entries(COLLEGE_PROGRAM_MAP);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const handleCollegeChange = (code) => setForm(f => ({ ...f, collegeCode: code, programCode: "" }));
  const handleProgramChange = (code) => setForm(f => ({ ...f, programCode: code }));

  const validateMiddleInitial = (v) => {
    if (!v) return "Required";
    if (!/^[A-Z]\.$/.test(v)) return "Format: e.g. (A.)";
    return "";
  };

  const validateAge = (v) => {
    if (!v) return "Required";
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 100) return "Must be 1–100";
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
    if (!form.suffix) e.suffix = "Required.";
    if (!form.yearSection) e.yearSection = "Required.";
    if (!form.sex) e.sex = "Required.";
    const ageErr = validateAge(form.age);
    if (ageErr) e.age = ageErr;
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Invalid email address.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
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
      setShowSaveSuccess(true);
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
    setEditing(false);
    setErrors({});
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

  const rowStyle = {
    background: "#7A4F4F",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "8px",
  };

  const inlineInputStyle = {
    background: "transparent",
    border: "none",
    borderBottom: "1px solid white",
    color: "white",
    fontFamily: "'Kufam', sans-serif",
    fontSize: "0.88rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const inlineInputErrorStyle = {
    ...inlineInputStyle,
    borderBottom: "1.5px solid #ffaaaa",
  };

  const selectStyle = {
    background: "transparent",
    border: "none",
    borderBottom: "1px solid white",
    color: "white",
    fontFamily: "'Kufam', sans-serif",
    fontSize: "0.88rem",
    outline: "none",
    width: "100%",
    cursor: "pointer",
  };

  const selectErrorStyle = {
    ...selectStyle,
    borderBottom: "1.5px solid #ffaaaa",
  };

  const valueStyle = {
    fontFamily: "'Kufam', sans-serif",
    fontSize: "0.88rem",
    color: "white",
    display: "block",
  };

  const fieldLabel = (text) => (
    <span style={{
      fontFamily: "'Kufam', sans-serif",
      fontWeight: 700,
      fontSize: "0.82rem",
      color: "rgba(255,255,255,0.7)",
      display: "block",
      marginBottom: "4px",
    }}>
      {text}
    </span>
  );

  const errText = (msg) => msg
    ? <p style={{ color: "#ffcccc", fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif", margin: "4px 0 0" }}>{msg}</p>
    : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SectionHeaderBar iconSrc={personalInfoIcon} title={editing ? "Edit Personal Information" : "Personal Information"} onBack={onBack} />

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

          {!editing && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
              <button
                onClick={() => setEditing(true)}
                title="Edit"
                style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  border: "2px solid white", background: "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <EditIcon size={15} color="white" />
              </button>
            </div>
          )}

          {/* Student ID — never editable: it's how the account is looked up
              at login (see AuthService.signIn resolving email by studentId),
              so changing it here would be able to break sign-in / mismatch
              the account's own identifier. Always shown as plain text, even
              while the rest of the form is in edit mode. */}
          <div style={rowStyle}>
            {fieldLabel("Student ID")}
            <span style={valueStyle}>{form.studentId}</span>
          </div>

          {/* First Name */}
          <div style={rowStyle}>
            {fieldLabel("First Name")}
            {editing ? (
              <>
                <input
                  value={form.firstName}
                  onChange={e => { setField("firstName", e.target.value); setErrors(p => ({ ...p, firstName: "" })); }}
                  placeholder="First Name"
                  style={errors.firstName ? inlineInputErrorStyle : inlineInputStyle}
                />
                {errText(errors.firstName)}
              </>
            ) : (
              <span style={valueStyle}>{form.firstName}</span>
            )}
          </div>

          {/* Middle Initial */}
          <div style={rowStyle}>
            {fieldLabel("Middle Initial")}
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
              <span style={valueStyle}>{form.middleInitial || "—"}</span>
            )}
          </div>

          {/* Last Name */}
          <div style={rowStyle}>
            {fieldLabel("Last Name")}
            {editing ? (
              <>
                <input
                  value={form.lastName}
                  onChange={e => { setField("lastName", e.target.value); setErrors(p => ({ ...p, lastName: "" })); }}
                  placeholder="Last Name"
                  style={errors.lastName ? inlineInputErrorStyle : inlineInputStyle}
                />
                {errText(errors.lastName)}
              </>
            ) : (
              <span style={valueStyle}>{form.lastName}</span>
            )}
          </div>

            {/* Suffix */}
          <div style={rowStyle}>
            {fieldLabel("Suffix")}
            {editing ? (
              <>
                <select
                  value={form.suffix}
                  onChange={e => { setField("suffix", e.target.value); setErrors(p => ({ ...p, suffix: "" })); }}
                  style={errors.suffix ? selectErrorStyle : selectStyle}
                >
                  <option value="" style={{ color: "#333" }}>Select</option>
                  <option value="None" style={{ color: "#333" }}>None</option>
                  <option value="Jr." style={{ color: "#333" }}>Jr.</option>
                  <option value="Sr." style={{ color: "#333" }}>Sr.</option>
                  <option value="II" style={{ color: "#333" }}>II</option>
                  <option value="III" style={{ color: "#333" }}>III</option>
                  <option value="IV" style={{ color: "#333" }}>IV</option>
                  <option value="V" style={{ color: "#333" }}>V</option>
                </select>
                {errText(errors.suffix)}
              </>
            ) : (
              <span style={valueStyle}>{form.suffix && form.suffix !== "None" ? form.suffix : "—"}</span>
            )}
          </div>

          {/* College */}
          <div style={rowStyle}>
            {fieldLabel("College")}
            {editing ? (
              <>
                <select
                  value={form.collegeCode}
                  onChange={e => handleCollegeChange(e.target.value)}
                  style={errors.collegeCode ? selectErrorStyle : selectStyle}
                >
                  <option value="" style={{ color: "#333" }}>Select</option>
                  {collegeEntriesForSelect.map(([code, info]) => (
                    <option key={code} value={code} style={{ color: "#333" }}>{info.label}</option>
                  ))}
                </select>
                {errText(errors.collegeCode)}
              </>
            ) : (
              <span style={valueStyle}>{collegeLabel}</span>
            )}
          </div>

          {/* Program */}
          <div style={rowStyle}>
            {fieldLabel("Program")}
            {editing ? (
              <>
                <select
                  value={form.programCode}
                  onChange={e => handleProgramChange(e.target.value)}
                  style={errors.programCode ? selectErrorStyle : selectStyle}
                >
                  <option value="" style={{ color: "#333" }}>Select</option>
                  {programEntriesForSelect.map(([code, label]) => (
                    <option key={code} value={code} style={{ color: "#333" }}>{label}</option>
                  ))}
                </select>
                {errText(errors.programCode)}
              </>
            ) : (
              <span style={valueStyle}>{programLabel}</span>
            )}
          </div>

          {/* Year & Section */}
          <div style={rowStyle}>
            {fieldLabel("Year & Section")}
            {editing ? (
              <>
                <select
                  value={form.yearSection}
                  onChange={e => { setField("yearSection", e.target.value); setErrors(p => ({ ...p, yearSection: "" })); }}
                  style={errors.yearSection ? selectErrorStyle : selectStyle}
                >
                  <option value="" style={{ color: "#333" }}>Select</option>
                  {YEAR_SECTIONS.map(s => (
                    <option key={s} value={s} style={{ color: "#333" }}>{s}</option>
                  ))}
                </select>
                {errText(errors.yearSection)}
              </>
            ) : (
              <span style={valueStyle}>{form.yearSection || "—"}</span>
            )}
          </div>

          {/* Sex */}
          <div style={rowStyle}>
            {fieldLabel("Sex")}
            {editing ? (
              <>
                <select
                  value={form.sex}
                  onChange={e => { setField("sex", e.target.value); setErrors(p => ({ ...p, sex: "" })); }}
                  style={errors.sex ? selectErrorStyle : selectStyle}
                >
                  <option value="" style={{ color: "#333" }}>Select</option>
                  <option style={{ color: "#333" }}>Male</option>
                  <option style={{ color: "#333" }}>Female</option>
                </select>
                {errText(errors.sex)}
              </>
            ) : (
              <span style={valueStyle}>{form.sex || "—"}</span>
            )}
          </div>

          {/* Age */}
          <div style={rowStyle}>
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
              <span style={valueStyle}>{form.age || "—"}</span>
            )}
          </div>

          {/* Email Address */}
          <div style={rowStyle}>
            {fieldLabel("Email Address")}
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
              <span style={valueStyle}>{form.email}</span>
            )}
          </div>

          {editing && (
            <div className="sap-save-row">
              <button
                onClick={() => { setEditing(false); setErrors({}); }}
                style={{ padding: "6px 18px", borderRadius: "14px", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid white", fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{ padding: "6px 18px", borderRadius: "14px", background: "white", color: darkRed, border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
              >
                Save Changes
              </button>
            </div>
          )}

        </div>
      </div>

      {showSaveSuccess && (
        <StudentSaveSuccessModal onClose={() => setShowSaveSuccess(false)} />
      )}
    </div>
  );
};


// ─── ResetStep1 Component ─────────────────────────────────────────────────────
const ResetStep1 = ({ onNext }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSend = () => {
  
    setError("");
    onNext(email);
  };

  return (
    <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888", marginBottom: "16px", lineHeight: 1.6 }}>
        Enter the email address linked to your account.<br />We'll send a password reset link.
      </p>
      <hr style={{ borderColor: "#ccc", marginBottom: "18px" }} />
      <label style={{ ...labelStyle, color: "#111" }}>Email Address:</label>
      <div style={{ background: darkRed, borderRadius: "20px", padding: "12px 20px", marginBottom: "8px" }}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="example@gmail.com"
          style={{ background: "transparent", border: "none", outline: "none", color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", width: "100%" }}
        />
      </div>
      {error && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
        <button onClick={handleSend} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "12px 40px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>
          Send
        </button>
      </div>
    </div>
  );
};


// ─── ResetStep2 Component ─────────────────────────────────────────────────────
const ResetStep2 = ({ onNext }) => {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  return (
    <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888", marginBottom: "16px" }}>
        Enter the code sent to your gmail account.
      </p>
      <hr style={{ borderColor: "#ccc", marginBottom: "18px" }} />
      <label style={{ ...labelStyle, color: "#111" }}>Enter the code:</label>
      <div className="sap-otp-row">
        {code.map((digit, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            maxLength={1}
            className="sap-otp-input"
          />
        ))}
      </div>
      <p style={{ textAlign: "center", fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", marginBottom: "16px" }}>
        Didn't receive the code?{" "}
        <span onClick={() => setCode(["", "", "", "", "", ""])} style={{ color: red, cursor: "pointer", fontWeight: 600 }}>
          Resend!
        </span>
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button onClick={onNext} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "12px 40px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>
          Send
        </button>
      </div>
    </div>
  );
};


// ─── ResetStep3 Component ─────────────────────────────────────────────────────
const ResetStep3 = ({ onDone }) => {
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors]   = useState({});
  const [showSuccess, setShowSuccess] = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  const handleSend = () => {
    const e = {};
    if (newPass.length < 8)   e.newPass = "Password must be at least 8 characters";
    if (newPass !== confirm)  e.confirm  = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length === 0) { setShowSuccess(true); }
  };

  return (
    <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888", marginBottom: "16px" }}>
        Enter your new password and confirm!
      </p>
      <hr style={{ borderColor: "#ccc", marginBottom: "18px" }} />
      <label style={{ ...labelStyle, color: "#111" }}>New Password:</label>
      <PasswordInput value={newPass} onChange={e => setNewPass(e.target.value)} onKeyDown={handleKeyDown} />
      {errors.newPass && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.newPass}</p>}
      <label style={{ ...labelStyle, color: "#111" }}>Confirm Password:</label>
      <PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={handleKeyDown} />
      {errors.confirm && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.confirm}</p>}
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "8px" }}>
        <button onClick={handleSend} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "12px 40px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>
          Send
        </button>
      </div>
      {showSuccess && <InfoModal message="Password has been reset successfully!" onClose={() => { setShowSuccess(false); onDone(); }} />}
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
    if (!currentPass) e.currentPass = "Please enter your current password.";
    if (!newPass) e.newPass = "Please enter a new password.";
    else if (!isPasswordStrong(newPass)) e.newPass = "Password does not meet all the requirements below.";
    if (newPass !== confirm) e.confirm = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    try {
      await changePassword(currentPass, newPass, "students", user?.uid, getAuth().currentUser?.email);
      setSuccess(true);
      setCurrentPass(""); setNewPass(""); setConfirm("");
    } catch (err) {
      setErrors({ general: err.message || "Failed to change password. Please try again." });
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
      <div className="sap-modal-inner">
        <div className="sap-modal-body">
          <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "12px" }}>RESET PASSWORD:</p>
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#666", marginBottom: "16px" }}>Enter your current password, then your new password below.</p>

          <label style={labelStyle}>Current Password:</label>
          <PasswordInput value={currentPass} onChange={e => { setCurrentPass(e.target.value); setErrors(p => ({ ...p, currentPass: "" })); }} onKeyDown={handleKeyDown} />
          {errors.currentPass && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.currentPass}</p>}

          <label style={labelStyle}>New Password:</label>
          <PasswordInput value={newPass} onChange={e => { setNewPass(e.target.value); setErrors(p => ({ ...p, newPass: "" })); }} onKeyDown={handleKeyDown} />
          {errors.newPass && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.newPass}</p>}

          <PasswordChecklist password={newPass} />

          <label style={labelStyle}>Confirm Password:</label>
          <PasswordInput value={confirm} onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: "" })); }} onKeyDown={handleKeyDown} />
          {errors.confirm && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.confirm}</p>}

          {errors.general && (
            <p style={{ color: "red", fontSize: "0.8rem", fontFamily: "'Kufam', sans-serif", textAlign: "center", marginTop: "12px" }}>
              ⚠️ {errors.general}
            </p>
          )}
        </div>
        <div className="sap-modal-footer">
          <button onClick={onClose} style={{ padding: "10px 28px", borderRadius: "20px", background: "white", color: darkRed, border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} style={{ padding: "10px 28px", borderRadius: "20px", background: "rgba(255,255,255,0.25)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Saving…" : "Save New Password"}
          </button>
        </div>
      </div>
    </div>
  );
};


// ─── PrivacySecurityScreen Component — now goes directly to Reset Password ────
const PrivacySecurityScreen = ({ onBack, user, onLogout }) => (
  <ResetPasswordModal onClose={onBack} user={user} onLogout={onLogout} />
);


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
      "Email: support@ojtern.com",
    ],
  },
];

// ─── TermsScreen Component ────────────────────────────────────────────────────
const TermsScreen = ({ onBack }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <SectionHeaderBar iconSrc={termsIcon} title="Terms & Condition" onBack={onBack} />
    <div className="sap-sub-body">
      <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>

        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", fontStyle: "italic", color: "#888", marginBottom: "18px" }}>
          Last updated: {TERMS_LAST_UPDATED}
        </p>

        {TERMS_SECTIONS.map((section, idx) => (
          <div key={section.title} style={{ marginBottom: idx === TERMS_SECTIONS.length - 1 ? 0 : "20px" }}>
            <h3 style={{
              fontFamily: "'Kufam', sans-serif",
              fontWeight: 700,
              fontSize: "0.92rem",
              color: darkRed,
              margin: "0 0 8px",
            }}>
              {section.title}
            </h3>

            {section.intro && (
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444", lineHeight: 1.7, margin: "0 0 6px" }}>
                {section.intro}
              </p>
            )}

            {section.items.map((item, i) => {
              const isEmailLine = typeof item === "string" && item.startsWith("Email:");
              const isBulleted = !!section.intro; // only sections with an intro (e.g. "5. Acceptable Use") get bullets
              return (
                <p
                  key={i}
                  style={{
                    fontFamily: isEmailLine ? "'Jua', sans-serif" : "'Kufam', sans-serif",
                    fontSize: "0.85rem",
                    color: isEmailLine ? "#1a1a1a" : "#444",
                    lineHeight: 1.7,
                    margin: i === section.items.length - 1 ? 0 : "0 0 6px",
                    display: isBulleted ? "flex" : undefined,
                    gap: isBulleted ? "6px" : undefined,
                  }}
                >
                  {isBulleted && <span style={{ flexShrink: 0 }}>•</span>}
                  <span>{item}</span>
                </p>
              );
            })}
          </div>
        ))}

      </div>
    </div>
  </div>
);


// ─── StudentAccountProfileScreen Component ────────────────────────────────────

const StudentSaveSuccessModal = ({ onClose }) => (
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

const InfoModal = ({ message, onClose }) => (
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
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p style={{
        fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem",
        color: "#333", margin: 0, textAlign: "center", lineHeight: 1.5,
      }}>{message}</p>
      <div style={{ display: "flex", width: "100%", marginTop: "8px" }}>
        <button onClick={onClose} style={{
          flex: 1, padding: "12px", borderRadius: "30px",
          border: "none", background: "#8B0000",
          fontFamily: "'Kufam', sans-serif", fontWeight: 700,
          fontSize: "0.95rem", cursor: "pointer", color: "white",
          boxShadow: "0 3px 10px rgba(139,0,0,0.3)",
        }}>OK</button>
      </div>
    </div>
  </div>
);

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
if (view === "terms")        return <><ResponsiveStyles /><GlobalStyles /><TermsScreen           onBack={() => setView("main")} /></>;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      <ResponsiveStyles />
      <GlobalStyles />

      {/* ── Red header + overlapping white card ── */}
      <div style={{
        position: "relative",
        flexShrink: 0,
        zIndex: 1,
        display: "flex",
        justifyContent: "center",
      }}>
        {/* Red bar */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "80px",
          background: "#590101",
          borderBottomLeftRadius: "30px",
          borderBottomRightRadius: "30px",
          zIndex: 1,
        }} />

        {/* White card */}
        <div className="sap-header-card">
          {/* Avatar */}
          <div style={{
            position: "absolute",
            top: "-40px",
            width: "80px", height: "80px",
            borderRadius: "50%",
            background: "#320000",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 3,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}>
            <PngIcon src={PersonalAccountProfile} size={50} />
          </div>

          <p style={{
            fontFamily: "'Jersey 25', sans-serif",
            fontSize: "clamp(1.1rem, 5vw, 1.5rem)",
            color: darkRed,
            fontWeight: 500,
            margin: 0,
            textAlign: "center",
          }}>
            {profileName || "—"}
          </p>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="sap-body">
        <div className="sap-divider" />

        <div className="sap-menu-box">
          <MenuRow iconSrc={personalInfoIcon} label="Personal Information" onClick={() => setView("personalInfo")} />
          <MenuRow iconSrc={privacyIcon}      label="Reset Password"   onClick={() => setShowReset(true)} />
          <MenuRow iconSrc={termsIcon}        label="Terms & Condition"    onClick={() => setView("terms")} />
        </div>

        {showReset && <ResetPasswordModal onClose={() => setShowReset(false)} user={user} onLogout={onLogout} />}
      </div>
    </div>
  );
};

export default StudentAccountProfileScreen;