import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { getAuth, signOut, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
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
  `}</style>
);

// ─── College & Program Data ───────────────────────────────────────────────────
const COLLEGES = [
    { name: "College of Computer Studies",           programs: [{ name: "Bachelor of Science in Information Technology",                  majors: [] }] },
    { name: "College of Education",                  programs: [{ name: "Bachelor of Elementary Education",                    majors: ["Generalist"] }, { name: "Bachelor of Secondary Education", majors: ["Major in English", "Major in Mathematics"] }] },
    { name: "College of Business and Accountancy",   programs: [{ name: "Bachelor of Science in Accountancy",                  majors: [] }, { name: "Bachelor of Science in Business Administration", majors: [] }] },
    { name: "College of Hospitality Management", programs: [{ name: "Bachelor of Science in Tourism Management",            majors: [] }, { name: "Bachelor of Science in Hospitality Management", majors: [] }] },
    { name: "College of Liberal Arts",               programs: [{ name: "Bachelor of Arts in Political Science",               majors: [] }] },
    { name: "College of Criminal Justice Education", programs: [{ name: "Bachelor of Science in Criminology",                  majors: [] }] },
  ];

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
const PasswordInput = ({ value, onChange, placeholder = "••••••••" }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", marginBottom: "12px" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
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
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    studentId:      "",
    lastName:       "",
    middleInitial:  "",
    firstName:      "",
    college:        "",
    program:        "",
    specialization: "",
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
    "CHM":  "College of Hospitality and Management",
  };

  // Map abbreviated program → full program name used by COLLEGES array
  const PROGRAM_ABBR_MAP = {
    "BSIT":                          "Bachelor of Information Technology",
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
      if (snap.exists() && !editing) {
        const d = snap.data();
        const fullCollege = COLLEGE_ABBR_MAP[d.college] || d.college || "";
        const fullProgram = PROGRAM_ABBR_MAP[d.program] || d.program || "";
        setForm({
          studentId:      d.studentId      || "",
          lastName:       d.lastName       || "",
          middleInitial:  d.middleInitial  || "",
          firstName:      d.firstName      || "",
          college:        fullCollege,
          program:        fullProgram,
          specialization: d.specialization || "",
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

  const collegeData    = COLLEGES.find(c => c.name === form.college);
  const programOptions = collegeData?.programs.map(p => p.name) ?? [];
  const programData    = collegeData?.programs.find(p => p.name === form.program);
  const majorOptions   = programData?.majors ?? [];

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validateStudentId = (v) => {
    if (!v) return "Required";
    if (!/^\d+$/.test(v)) return "Numbers only";
    if (v.length !== 9) return `${v.length}/9 digits`;
    return "";
  };

  const validateMiddleInitial = (v) => {
    if (!v) return "";
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
    const idErr = validateStudentId(form.studentId);
    if (idErr) e.studentId = idErr;
    if (!form.firstName.trim()) e.firstName = "First name is required.";
    if (!form.lastName.trim())  e.lastName  = "Last name is required.";
    const miErr = validateMiddleInitial(form.middleInitial);
    if (miErr) e.middleInitial = miErr;
    const ageErr = validateAge(form.age);
    if (ageErr) e.age = ageErr;
    if (!form.email.endsWith("@gmail.com")) e.email = "Must be a @gmail.com email.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await updateDoc(doc(db, "students", user?.uid), {
        studentId:      form.studentId,
        lastName:       form.lastName,
        middleInitial:  form.middleInitial,
        firstName:      form.firstName,
        fullName:       form.firstName + " " + (form.middleInitial ? form.middleInitial + " " : "") + form.lastName,
        college:        form.college,
        program:        form.program,
        specialization: form.specialization || "",
        yearSection:    form.yearSection,
        sex:            form.sex,
        age:            Number(form.age),
        email:          form.email,
      });
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
    setEditing(false);
    setErrors({});
  };

  const handleStudentIdChange = (v) => {
    const filtered = v.replace(/\D/g, "").slice(0, 9);
    setField("studentId", filtered);
    setErrors(prev => ({ ...prev, studentId: validateStudentId(filtered) }));
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
      <SectionHeaderBar iconSrc={personalInfoIcon} title="Personal Information" onBack={onBack} />

      <div className="sap-info-body">
        <div className="sap-info-card">

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

          {/* Student ID */}
          <div style={rowStyle}>
            {fieldLabel("Student ID")}
            {editing ? (
              <>
                <input
                  value={form.studentId}
                  onChange={e => handleStudentIdChange(e.target.value)}
                  placeholder="9-digit number"
                  style={errors.studentId ? inlineInputErrorStyle : inlineInputStyle}
                />
                {errText(errors.studentId)}
              </>
            ) : (
              <span style={valueStyle}>{form.studentId}</span>
            )}
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

          {/* College */}
          <div style={rowStyle}>
            {fieldLabel("College")}
            {editing ? (
              <select
                value={form.college}
                onChange={e => { setField("college", e.target.value); setField("program", ""); setField("specialization", ""); }}
                style={selectStyle}
              >
                <option value="" style={{ color: "#333" }}>Select</option>
                {COLLEGES.map(c => <option key={c.name} value={c.name} style={{ color: "#333" }}>{c.name}</option>)}
              </select>
            ) : (
              <span style={valueStyle}>{form.college || "—"}</span>
            )}
          </div>

          {/* Program */}
          <div style={rowStyle}>
            {fieldLabel("Program")}
            {editing ? (
              <select
                value={form.program}
                onChange={e => { setField("program", e.target.value); setField("specialization", ""); }}
                style={selectStyle}
              >
                <option value="" style={{ color: "#333" }}>Select</option>
                {programOptions.map(p => <option key={p} value={p} style={{ color: "#333" }}>{p}</option>)}
              </select>
            ) : (
              <span style={valueStyle}>{form.program || "—"}</span>
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
    </div>
  );
};


// ─── ResetStep1 Component ─────────────────────────────────────────────────────
const ResetStep1 = ({ onNext }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSend = () => {
    if (!email.endsWith("@gmail.com")) { setError("Must be a valid @gmail.com email."); return; }
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

  const handleSend = () => {
    const e = {};
    if (newPass.length < 8)   e.newPass = "Minimum 8 characters.";
    if (newPass !== confirm)  e.confirm  = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length === 0) { alert("Password has been reset successfully!"); onDone(); }
  };

  return (
    <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888", marginBottom: "16px" }}>
        Enter your new password and confirm!
      </p>
      <hr style={{ borderColor: "#ccc", marginBottom: "18px" }} />
      <label style={{ ...labelStyle, color: "#111" }}>New Password:</label>
      <PasswordInput value={newPass} onChange={e => setNewPass(e.target.value)} />
      {errors.newPass && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.newPass}</p>}
      <label style={{ ...labelStyle, color: "#111" }}>Confirm Password:</label>
      <PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} />
      {errors.confirm && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.confirm}</p>}
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "8px" }}>
        <button onClick={handleSend} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "12px 40px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>
          Send
        </button>
      </div>
    </div>
  );
};


// ─── ResetPasswordScreen Component ───────────────────────────────────────────
const ResetPasswordScreen = ({ onBack, user }) => {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirm, setConfirm]         = useState("");
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);

  const handleSave = async () => {
    const e = {};
    if (!currentPass)            e.currentPass = "Please enter your current password.";
    if (!newPass)                e.newPass = "Please enter a new password.";
    else if (newPass.length < 8) e.newPass = "Minimum 8 characters.";
    if (newPass !== confirm)     e.confirm = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      // Re-authenticate first to fix auth/requires-recent-login
      const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
      await reauthenticateWithCredential(currentUser, credential);
      // Now safely change password
      await changePassword(newPass, "students", user?.uid);
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SectionHeaderBar iconSrc={resetIcon} title="Reset Password" onBack={onBack} />
      <div className="sap-sub-body">
        <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
          {success ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2d7a2d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "12px" }}><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1rem", fontWeight: 700, color: "#2d7a2d", marginBottom: "6px" }}>Password Changed!</p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#666", marginBottom: "20px" }}>Your password has been updated successfully.</p>
              <button onClick={onBack} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "10px 32px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>Done</button>
            </div>
          ) : (
            <>
              <label style={{ ...labelStyle, color: "#111" }}>Current Password:</label>
              <PasswordInput value={currentPass} onChange={e => { setCurrentPass(e.target.value); setErrors(p => ({ ...p, currentPass: "" })); }} />
              {errors.currentPass && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.currentPass}</p>}

              <hr style={{ border: "none", borderTop: "1px solid #ccc", margin: "14px 0" }} />

              <label style={{ ...labelStyle, color: "#111" }}>New Password:</label>
              <PasswordInput value={newPass} onChange={e => { setNewPass(e.target.value); setErrors(p => ({ ...p, newPass: "" })); }} />
              {errors.newPass && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.newPass}</p>}

              <label style={{ ...labelStyle, color: "#111" }}>Confirm New Password:</label>
              <PasswordInput value={confirm} onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: "" })); }} />
              {errors.confirm && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>{errors.confirm}</p>}

              {errors.general && <p style={{ color: "red", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", marginBottom: "8px" }}>⚠️ {errors.general}</p>}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <button onClick={handleSave} disabled={loading} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "12px 40px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Saving…" : "Save Password"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


// ─── PrivacySecurityScreen Component — now goes directly to Reset Password ────
const PrivacySecurityScreen = ({ onBack, user }) => (
  <ResetPasswordScreen onBack={onBack} user={user} />
);


// ─── TermsScreen Component ────────────────────────────────────────────────────
const TermsScreen = ({ onBack }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <SectionHeaderBar iconSrc={termsIcon} title="Terms & Condition" onBack={onBack} />
    <div className="sap-sub-body">
      <div style={{ background: "#e8e8e8", borderRadius: "16px", padding: "24px 28px" }}>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#444", lineHeight: 1.8 }}>
          By using OJTern, you agree to the following terms and conditions. All information provided must be accurate and up-to-date. Student data must be handled with confidentiality. OJTern reserves the right to update these terms at any time.
        </p>
      </div>
    </div>
  </div>
);


// ─── StudentAccountProfileScreen Component ────────────────────────────────────

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

const StudentAccountProfileScreen = ({ user, onLogout }) => {
  const [view, setView] = useState("main");
  const [showLogout, setShowLogout] = useState(false);
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

  if (view === "personalInfo") return <><ResponsiveStyles /><PersonalInfoScreen onBack={() => setView("main")} user={user} /></>;
  if (view === "privacy")      return <><ResponsiveStyles /><PrivacySecurityScreen onBack={() => setView("main")} user={user} /></>;
  if (view === "terms")        return <><ResponsiveStyles /><TermsScreen           onBack={() => setView("main")} /></>;

  const handleLogoutConfirm = async () => {
    await signOut(getAuth());
    if (onLogout) onLogout();
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      {showLogout && <LogoutModal onConfirm={handleLogoutConfirm} onCancel={() => setShowLogout(false)} />}
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
          <MenuRow iconSrc={privacyIcon}      label="Reset Password"   onClick={() => setView("privacy")} />
          <MenuRow iconSrc={termsIcon}        label="Terms & Condition"    onClick={() => setView("terms")} />
        </div>

        <button
          onClick={() => setShowLogout(true)}
          style={{
            background: "#320000",
            color: "white",
            border: "none",
            borderRadius: "30px",
            padding: "14px clamp(28px, 8vw, 52px)",
            fontFamily: "'Jua'",
            fontSize: "clamp(1rem, 4vw, 1.2rem)",
            cursor: "pointer",
            letterSpacing: "0.03em",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
          }}
        >
          Log Out
        </button>
      </div>
    </div>
  );
};

export default StudentAccountProfileScreen;