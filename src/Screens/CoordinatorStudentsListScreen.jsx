import React, { useState, useRef, useCallback, useEffect } from "react";
import XLSX from "xlsx-js-style";
import userIcon from "../icons/user.png";

// Firebase
import { db }                          from "./firebase";
import { createStudentAccount, generateStudentPassword } from "./AuthService";
import {
  collection, query, where,
  onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";

const red = "#8B0000";
const darkRed = "#590101";
const black = "#000000";

// ── College / Program / Specialization Data ───────────────────────────────────
// Adjust colleges, programs, and specializations to match your school's actual data
const COLLEGE_DATA = {
  "CCS": {
    label: "College of Computer Studies",
    programs: ["BSIT"],
  },
  "CBA": {
    label: "College of Business and Accountancy",
    programs: ["BSBA (Major in Marketing Management)", "BSA"],
  },
  "CCJE": {
    label: "College of Criminal Justice Education",
    programs: ["BS CRIM"],
  },
  "CLA": {
    label: "College of Liberal Arts",
    programs: ["BA POLSCI"],
  },
  "CED": {
    label: "College of Education",
    programs: ["BEED", "BSED (Major in English)", "BSED (Major in Mathematics)"],
  },
  "CHM": {
    label: "College of Hospitality Management",
    programs: ["BSTM", "BSHM"],
  },
};

// Derive the flat list of college keys used in dropdowns/filters
const COLLEGE_KEYS = Object.keys(COLLEGE_DATA);

// Year & Section options — adjust to match your school's actual sections
const YEAR_SECTIONS = [
  "4-A","4-B","4-C","4-D","4-E", "4-F",
];

const SEX_OPTIONS = ["Male", "Female", "Prefer not to say"];

const SUFFIX_OPTIONS = ["Jr.", "Sr.", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const EXCEL_COLUMNS = [
  "Student ID", "Last Name", "Middle Initial", "First Name", "Department", "Program",
  "Major", "Year & Section", "Sex", "Age", "Email Address"
];

const NAME_REGEX = /^[A-Za-zÑñ][A-Za-zÑñ\s\-]*$/;
const MIDDLE_INITIAL_REGEX = /^[A-Z]\.$/;
const GMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@gmail\.com$/;

// ── Responsive styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Kufam:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #8B0000; border-radius: 4px; }
    .student-row:hover { background: #d0d0d0 !important; }

    /* Top bar: wraps on mobile */
    .sl-topbar {
      background: ${darkRed};
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      gap: 10px;
      flex-wrap: wrap;
    }
    @media (max-width: 560px) {
      .sl-topbar { padding: 10px 14px; }
    }

    /* Search input width */
    .sl-search-input { width: 160px; }
    @media (max-width: 480px) {
      .sl-search-input { width: 110px; }
    }

    /* Sub bar: wraps on mobile */
    .sl-subbar {
      background: #e0e0e0;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #ccc;
      flex-shrink: 0;
      gap: 8px;
      flex-wrap: wrap;
    }
    @media (max-width: 560px) {
      .sl-subbar { padding: 10px 14px; }
    }

    /* Action buttons in subbar: wrap and shrink on mobile */
    .sl-action-btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    @media (max-width: 400px) {
      .sl-action-btns button { font-size: 0.82rem !important; padding: 6px 12px !important; }
    }

    /* Student list padding */
    .sl-list-area {
      flex: 1;
      overflow-y: auto;
      padding: 14px 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    @media (max-width: 560px) {
      .sl-list-area { padding: 10px 12px; }
    }

    /* Student row: hide program on very small screens */
    .sl-row-program {
      display: inline;
    }
    @media (max-width: 400px) {
      .sl-row-program { display: none; }
    }

    /* Student form modal: full-width on mobile */
    .sl-modal-inner {
      background: #d8d8d8;
      border-radius: 18px;
      width: 760px;
      max-width: calc(100vw - 32px);
      max-height: 92vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }

    /* Modal header */
    .sl-modal-header {
      padding: 20px 28px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    @media (max-width: 560px) {
      .sl-modal-header { padding: 14px 16px 10px; }
    }

    /* Modal body */
    .sl-modal-body {
      overflow-y: auto;
      padding: 0 28px 8px;
      flex: 1;
    }
    @media (max-width: 560px) {
      .sl-modal-body { padding: 0 14px 8px; }
    }

    /* Modal footer */
    .sl-modal-footer {
      background: #b0b0b0;
      padding: 14px 28px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      border-bottom-left-radius: 18px;
      border-bottom-right-radius: 18px;
    }
    @media (max-width: 560px) {
      .sl-modal-footer { padding: 12px 14px; }
    }

    /* Name grid: 4-col on desktop, 2-col on tablet, 1-col on mobile */
    .sl-name-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.7fr 1.2fr 0.6fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    @media (max-width: 600px) {
      .sl-name-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 380px) {
      .sl-name-grid { grid-template-columns: 1fr; }
    }

    /* College/program grid: 2-col → 1-col */
    .sl-college-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    @media (max-width: 600px) {
      .sl-college-grid { grid-template-columns: 1fr; }
    }

    /* Year/sex/age grid: 3-col → 1-col */
    .sl-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    @media (max-width: 600px) {
      .sl-info-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 380px) {
      .sl-info-grid { grid-template-columns: 1fr; }
    }

    /* Import modal */
    .sl-import-inner {
      background: white;
      border-radius: 18px;
      width: 620px;
      max-width: calc(100vw - 32px);
      max-height: 88vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .sl-import-header {
      padding: 22px 28px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    @media (max-width: 560px) {
      .sl-import-header { padding: 14px 16px 10px; }
      .sl-import-header h2 { font-size: 1.3rem !important; }
    }
    .sl-import-body {
      overflow-y: auto;
      padding: 0 28px 4px;
      flex: 1;
    }
    @media (max-width: 560px) {
      .sl-import-body { padding: 0 14px 4px; }
    }
    .sl-import-footer {
      background: #d8d8d8;
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom-left-radius: 18px;
      border-bottom-right-radius: 18px;
      flex-shrink: 0;
    }
    @media (max-width: 560px) {
      .sl-import-footer { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
    }

    /* Filter badge area */
    .sl-filter-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 24px;
      background: #f5f5f5;
      flex-wrap: wrap;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }
    @media (max-width: 560px) {
      .sl-filter-badges { padding: 8px 14px; }
    }
  `}</style>
);

const validators = {
  studentId: (v) => {
    if (!v) return "Required";
    if (!/^\d+$/.test(v)) return "Numbers only";
    if (v.length !== 9) return `${v.length}/9 digits`;
    return "";
  },
  lastName: (v) => {
    if (!v) return "Required";
    if (!NAME_REGEX.test(v)) return "Letters, Ñ/ñ and hyphens only";
    return "";
  },
  middleInitial: (v) => {
    if (!v) return "";
    if (!/^[A-Z]$/.test(v) && !MIDDLE_INITIAL_REGEX.test(v)) return "Format: M.";
    return "";
  },
  firstName: (v) => {
    if (!v) return "Required";
    if (!NAME_REGEX.test(v)) return "Letters, Ñ/ñ and hyphens only";
    return "";
  },
  suffix: (v) => {
    if (!v) return "";
    if (!SUFFIX_OPTIONS.includes(v)) return "e.g. Jr. Sr. II III IV";
    return "";
  },
  college: (v) => (!v ? "Required" : ""),
  program: (v) => (!v ? "Required" : ""),
  yearSection: (v) => (!v ? "Required" : ""),
  sex: (v) => (!v ? "Required" : ""),
  age: (v) => {
    if (!v) return "Required";
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 100) return "Must be 1–100";
    return "";
  },
  email: (v) => {
    if (!v) return "Required";
    if (!GMAIL_REGEX.test(v)) return "Must be @gmail.com";
    return "";
  },

};

const exportToXLSX = (students) => {
  const rows = [EXCEL_COLUMNS];
  students.forEach(s => {
    rows.push([s.studentId, s.lastName, s.middleInitial, s.firstName, s.college, s.program, s.major || s.specialization || "", s.yearSection, s.sex, s.age, s.email]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "students_export_list.xlsx");
};

const downloadTemplateXLSX = () => {
  const rows = [
    EXCEL_COLUMNS,
    [
      "e.g. 201112345", "e.g. Dela Cruz", "e.g. M.", "e.g. Juan",
      "e.g. College of Education", "e.g. Bachelor of Secondary Education",
      "e.g. Major in English or N/A", "e.g. 4-A", "e.g. Male", "e.g. 21",
      "e.g. juandelacruz@gmail.com",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 35 },
    { wch: 40 }, { wch: 25 }, { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 30 },
  ];
  // Note: 11 columns now (added Major), ref updated below
  for (let r = 2; r < 200; r++) {
    for (let c = 0; c < EXCEL_COLUMNS.length; c++) {
      const cell = XLSX.utils.encode_cell({ r, c });
      ws[cell] = { t: "s", v: "", s: { protection: { locked: false } } };
    }
  }
  for (let c = 0; c < EXCEL_COLUMNS.length; c++) {
    const headerCell = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[headerCell]) {
      ws[headerCell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "8B0000" } },
        alignment: { horizontal: "center" },
        protection: { locked: true },
      };
    }
  }
  for (let c = 0; c < EXCEL_COLUMNS.length; c++) {
    const cell = XLSX.utils.encode_cell({ r: 1, c });
    ws[cell].s = {
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
      font: { name: "Calibri", sz: 11, bold: false, italic: false, color: { rgb: "FF0000" } },
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top:    { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left:   { style: "thin", color: { rgb: "000000" } },
        right:  { style: "thin", color: { rgb: "000000" } },
      },
    };
  }
  ws["!ref"] = `A1:K200`;
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Student Template");
  XLSX.writeFile(wb, "student_import_template.xlsx");
};

const StyledSelect = ({ value, onChange, options, placeholder, disabled, hasError }) => (
  <div style={{ position: "relative" }}>
    <select
      value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ width: "100%", appearance: "none", WebkitAppearance: "none", background: disabled ? "#e8e8e8" : "white", border: hasError ? "1.5px solid #c00" : "none", borderRadius: "20px", padding: "8px 36px 8px 14px", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: disabled ? "#aaa" : (value ? "#222" : "#999"), cursor: disabled ? "not-allowed" : "pointer", outline: "none", boxShadow: hasError ? "none" : "inset 0 1px 3px rgba(0,0,0,0.08)" }}
    >
      <option value="">{placeholder || "Select..."}</option>
      {options.map(o => typeof o === 'object' ? <option key={o.value} value={o.value}>{o.label}</option> : <option key={o} value={o}>{o}</option>)}
    </select>
    <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: disabled ? "#bbb" : darkRed }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
    </div>
  </div>
);

const StyledInput = ({ value, onChange, placeholder, type = "text", disabled, hasError }) => (
  <input
    type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    style={{ width: "100%", background: disabled ? "#e8e8e8" : "white", border: hasError ? "1.5px solid #c00" : "none", borderRadius: "20px", padding: "8px 14px", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#222", outline: "none", boxShadow: hasError ? "none" : "inset 0 1px 3px rgba(0,0,0,0.08)", boxSizing: "border-box" }}
  />
);

const FieldLabel = ({ children }) => (
  <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: black, marginBottom: "5px", letterSpacing: "0.03em", marginTop: "10px" }}>{children}</p>
);

const FieldError = ({ msg }) => msg ? (
  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#c00", marginTop: "3px", paddingLeft: "6px" }}>{msg}</p>
) : null;

const useField = (initial = "", validatorKey) => {
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const error = touched ? (validators[validatorKey] ? validators[validatorKey](value) : "") : "";
  const onChange = (val) => { setValue(val); setTouched(true); };
  const touch = () => setTouched(true);
  const reset = (v = "") => { setValue(v); setTouched(false); };
  return { value, onChange, touch, reset, error, hasError: !!error };
};

// ── Student Form ───────────────────────────────────────────────────────────────
const StudentForm = ({ initial = {}, readOnly = false, onClose, onSubmit, submitLabel = "CREATE ACCOUNT" }) => {
  const studentId     = useField(initial.studentId || "", "studentId");
  const lastName      = useField(initial.lastName || "", "lastName");
  const middleInitial = useField(initial.middleInitial || "", "middleInitial");
  const firstName     = useField(initial.firstName || "", "firstName");
  const suffix        = useField(initial.suffix || "", "suffix");
  const sex           = useField(initial.sex || "", "sex");
  const yearSection   = useField(initial.yearSection || "", "yearSection");
  const age           = useField(initial.age || "", "age");
  const email         = useField(initial.email || "", "email");
  const [college, setCollege] = useState(initial.college || "");
  const [program, setProgram] = useState(initial.program || "");
  const [collegeTouched, setCollegeTouched] = useState(false);
  const [programTouched, setProgramTouched] = useState(false);
  const [isEditing, setIsEditing]           = useState(!readOnly);
  const [saving, setSaving]                 = useState(false);
  const [submitError, setSubmitError]       = useState("");

  const programs = college ? (COLLEGE_DATA[college]?.programs || []) : [];
  const collegeError = collegeTouched && !college ? "Required" : "";
  const programError = programTouched && !program ? "Required" : "";

  const handleCollegeChange = (val) => { setCollege(val); setProgram(""); setCollegeTouched(true); };
  const handleProgramChange = (val) => { setProgram(val); setProgramTouched(true); };

  const allFields = [studentId, lastName, middleInitial, firstName, suffix, sex, yearSection, age, email];
  const touchAll = () => { allFields.forEach(f => f.touch()); setCollegeTouched(true); setProgramTouched(true); };

  const isValid = () => {
    if (validators.studentId(studentId.value)) return false;
    if (validators.lastName(lastName.value)) return false;
    if (validators.middleInitial(middleInitial.value)) return false;
    if (validators.firstName(firstName.value)) return false;
    if (validators.suffix(suffix.value)) return false;
    if (validators.sex(sex.value)) return false;
    if (validators.yearSection(yearSection.value)) return false;
    if (validators.age(age.value)) return false;
    if (validators.email(email.value)) return false;
    if (!college) return false;
    if (!program) return false;
    return true;
  };

  // handleSubmit — passes form data up; parent handles Firebase
  const handleSubmit = async () => {
    touchAll();
    if (!isValid()) return;
    setSaving(true);
    setSubmitError("");
    try {
      await onSubmit({
        studentId: studentId.value, lastName: lastName.value,
        middleInitial: middleInitial.value, firstName: firstName.value,
        suffix: suffix.value, college, program, specialization: "",
        yearSection: yearSection.value, sex: sex.value,
        age: age.value, email: email.value,
      });
    } catch (err) {
      setSubmitError(err.message || "Failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const locked = readOnly && !isEditing;
  const fullName = (lastName.value && firstName.value)
    ? `${lastName.value}, ${firstName.value}`
    : (initial.lastName && initial.firstName) ? `${initial.lastName}, ${initial.firstName}` : "New Student";

  const onStudentIdChange     = (v) => { if (/^\d*$/.test(v) && v.length <= 9) studentId.onChange(v); };
  const onLastNameChange      = (v) => { lastName.onChange(v.replace(/[^A-Za-zÑñ\s\-]/g, "")); };
  const onFirstNameChange     = (v) => { firstName.onChange(v.replace(/[^A-Za-zÑñ\s\-]/g, "")); };
  const onMiddleInitialChange = (v) => { middleInitial.onChange(v.replace(/[^A-Z.]/g, "").slice(0, 2)); };
  const onAgeChange           = (v) => { if (v === "" || /^\d+$/.test(v)) age.onChange(v); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div className="sl-modal-inner">
        <div className="sl-modal-header">
          <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 4vw, 1.8rem)", color: darkRed }}>{fullName}</h2>
          <button onClick={onClose} style={{ background: darkRed, border: "none", borderRadius: "50%", width: "30px", height: "30px", color: "white", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", flexShrink: 0 }}>✕</button>
        </div>
        <div className="sl-modal-body">
          <div style={{ marginBottom: "12px" }}>
            <FieldLabel>Student ID:</FieldLabel>
            <div style={{ width: "min(220px, 100%)" }}>
              <StyledInput value={studentId.value} onChange={onStudentIdChange} placeholder="9-digit number" disabled={locked} hasError={!!studentId.error} />
              <FieldError msg={studentId.error} />
            </div>
          </div>
          <div className="sl-name-grid">
            <div>
              <FieldLabel>Last Name:</FieldLabel>
              <StyledInput value={lastName.value} onChange={onLastNameChange}placeholder="Dela Cruz" disabled={locked} hasError={!!lastName.error} />
              <FieldError msg={lastName.error} />
            </div>
            <div>
              <FieldLabel>Middle Initial:</FieldLabel>
              <StyledInput value={middleInitial.value} onChange={onMiddleInitialChange} placeholder="M." disabled={locked} hasError={!!middleInitial.error} />
              <FieldError msg={middleInitial.error} />
            </div>
            <div>
              <FieldLabel>First Name:</FieldLabel>
              <StyledInput value={firstName.value} onChange={onFirstNameChange} placeholder="Juan" disabled={locked} hasError={!!firstName.error} />
              <FieldError msg={firstName.error} />
            </div>
            <div>
              <FieldLabel>Suffix:</FieldLabel>
              <StyledSelect value={suffix.value} onChange={(v) => suffix.onChange(v)} options={SUFFIX_OPTIONS} placeholder="None" disabled={locked} hasError={!!suffix.error} />
              <FieldError msg={suffix.error} />
            </div>
          </div>
          <div className="sl-college-grid">
            <div>
              <FieldLabel>Department:</FieldLabel>
              <StyledSelect value={college} onChange={handleCollegeChange} options={Object.keys(COLLEGE_DATA).map(k => ({ value: k, label: COLLEGE_DATA[k].label }))} placeholder="Select department" disabled={locked} hasError={!!collegeError} />
              <FieldError msg={collegeError} />
            </div>
            <div>
              <FieldLabel>Program:</FieldLabel>
              <StyledSelect value={program} onChange={handleProgramChange} options={programs} placeholder="Select program" disabled={locked || !college} hasError={!!programError} />
              <FieldError msg={programError} />
            </div>
          </div>
          <div className="sl-info-grid">
            <div>
              <FieldLabel>Year & Section:</FieldLabel>
              <StyledSelect value={yearSection.value} onChange={(v) => yearSection.onChange(v)} options={YEAR_SECTIONS} placeholder="Select section" disabled={locked} hasError={!!yearSection.error} />
              <FieldError msg={yearSection.error} />
            </div>
            <div>
              <FieldLabel>Sex:</FieldLabel>
              <StyledSelect value={sex.value} onChange={(v) => sex.onChange(v)} options={SEX_OPTIONS} placeholder="Select sex" disabled={locked} hasError={!!sex.error} />
              <FieldError msg={sex.error} />
            </div>
            <div>
              <FieldLabel>Age:</FieldLabel>
              <StyledInput value={age.value} onChange={onAgeChange}  type="text" disabled={locked} hasError={!!age.error} />
              <FieldError msg={age.error} />
            </div>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <FieldLabel>Email Address:</FieldLabel>
            <StyledInput value={email.value} onChange={(v) => email.onChange(v)} type="email" placeholder="student@gmail.com" disabled={locked} hasError={!!email.error} />
            <FieldError msg={email.error} />
          </div>

          {/* Password preview — only shown on create, updates live as lastName/college changes */}
          {!readOnly && lastName.value && college && (
            <div style={{ background: "#fff8f8", border: "1.5px solid #f5c0c0", borderRadius: "10px", padding: "10px 14px", marginBottom: "10px" }}>
              <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1rem", color: "#8B0000", marginBottom: "4px" }}>🔑 Default Password:</p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.92rem", color: "#320000", fontWeight: "700", margin: 0 }}>
                {(firstName.value && lastName.value && studentId.value && college) ? generateStudentPassword(firstName.value, lastName.value, studentId.value, college) : "—"}
              </p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#888", margin: "4px 0 0" }}>
                Format: lastname + 123. + college code (all lowercase). Student should change this after first login.
              </p>
            </div>
          )}

        </div>
        <div className="sl-modal-footer">
          {/* Global submit error */}
          {submitError && (
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#c00", marginRight: "auto", paddingRight: "12px" }}>
              ⚠️ {submitError}
            </p>
          )}
          {readOnly ? (
            isEditing
              ? <button onClick={handleSubmit} disabled={saving} style={{ padding: "10px 28px", borderRadius: "24px", background: saving ? "#aaa" : darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "SAVING…" : "SAVE"}</button>
              : <button onClick={() => setIsEditing(true)} style={{ padding: "10px 28px", borderRadius: "24px", background: "#444", color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>EDIT</button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} style={{ padding: "10px 28px", borderRadius: "24px", background: saving ? "#aaa" : darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "CREATING…" : submitLabel}</button>
          )}
        </div>
      </div>
    </div>
  );
};

const ALL_COLLEGES = Object.keys(COLLEGE_DATA);
const ALL_PROGRAMS = [...new Set(Object.values(COLLEGE_DATA).flatMap(c => c.programs || []))];

const validateRow = (row, rowIndex) => {
  const errs = []; const r = rowIndex + 2;
  if (!row.studentId) errs.push(`Row ${r}: Student ID is required`);
  else if (!/^\d{9}$/.test(row.studentId)) errs.push(`Row ${r}: Student ID must be exactly 9 digits`);
  if (!row.lastName) errs.push(`Row ${r}: Last Name is required`);
  if (!row.firstName) errs.push(`Row ${r}: First Name is required`);
  if (row.middleInitial && !/^[A-Z]\.$/.test(row.middleInitial.trim())) errs.push(`Row ${r}: Middle Initial must be format "X."`);
  if (!row.college) errs.push(`Row ${r}: College is required`);
  else if (ALL_COLLEGES.length > 0 && !ALL_COLLEGES.includes(row.college)) errs.push(`Row ${r}: College "${row.college}" is not valid`);
  if (!row.program) errs.push(`Row ${r}: Program is required`);
  else if (ALL_PROGRAMS.length > 0 && !ALL_PROGRAMS.includes(row.program)) errs.push(`Row ${r}: Program "${row.program}" is not valid`);
  if (row.college && row.program) {
  }
  if (!row.yearSection) errs.push(`Row ${r}: Year & Section is required`);
  else if (YEAR_SECTIONS.length > 0 && !YEAR_SECTIONS.includes(row.yearSection)) errs.push(`Row ${r}: Year & Section must be one of: ${YEAR_SECTIONS.join(", ")}`);
  if (!row.sex) errs.push(`Row ${r}: Sex is required`);
  else if (SEX_OPTIONS.length > 0 && !SEX_OPTIONS.includes(row.sex)) errs.push(`Row ${r}: Sex must be "Male" or "Female"`);
  if (!row.age) errs.push(`Row ${r}: Age is required`);
  else { const n = Number(row.age); if (!Number.isInteger(n) || n < 1 || n > 100) errs.push(`Row ${r}: Age must be 1–100`); }
  if (!row.email) errs.push(`Row ${r}: Email is required`);
  else if (!GMAIL_REGEX.test(row.email.trim())) errs.push(`Row ${r}: Email must be @gmail.com`);
  return errs;
};

// ── Import Modal ───────────────────────────────────────────────────────────────
const ImportModal = ({ onClose, onImport }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const checkFileType = (f) => {
    const valid = f.name.endsWith(".xlsx") || f.name.endsWith(".xls");
    if (!valid) { setFileError("Only Excel (.xlsx / .xls) files are allowed."); return false; }
    if (f.size > 10 * 1024 * 1024) { setFileError("File exceeds 10 MB limit."); return false; }
    setFileError(""); return true;
  };

  const parseFile = async (f) => {
    setParsing(true); setPreview(null);
    try {
      const ab = await f.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (rows.length < 2) { setPreview({ valid: [], rowErrors: ["The file has no data rows."], headerErrors: [] }); setParsing(false); return; }
      const headerRow = rows[0].map(h => String(h).trim());
      const headerErrors = [];
      EXCEL_COLUMNS.forEach((expected, i) => { if (headerRow[i] !== expected) headerErrors.push(`Column ${i + 1}: expected "${expected}", found "${headerRow[i] || "(empty)"}"`); });
      if (headerErrors.length > 0) { setPreview({ valid: [], rowErrors: [], headerErrors }); setParsing(false); return; }
      const rowErrors = []; const valid = [];
      rows.slice(1).forEach((row, i) => {
        if (row.every(c => c === "" || c === null || c === undefined)) return;
        const student = { studentId: String(row[0]||"").trim(), lastName: String(row[1]||"").trim(), middleInitial: String(row[2]||"").trim(), firstName: String(row[3]||"").trim(), college: String(row[4]||"").trim(), program: String(row[5]||"").trim(), major: String(row[6]||"").trim(), specialization: String(row[6]||"").trim(), yearSection: String(row[7]||"").trim(), sex: String(row[8]||"").trim(), age: String(row[9]||"").trim(), email: String(row[10]||"").trim(), password: "" };
        const errs = validateRow(student, i);
        if (errs.length > 0) rowErrors.push(...errs); else valid.push(student);
      });
      setPreview({ valid, rowErrors, headerErrors: [] });
    } catch (e) { setPreview({ valid: [], rowErrors: ["Failed to read file."], headerErrors: [] }); }
    setParsing(false);
  };

  const handleFile = (f) => { if (!f || !checkFileType(f)) return; setFile(f); parseFile(f); };
  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }, []);
  const clearFile = () => { setFile(null); setPreview(null); setFileError(""); };
  const handleImport = () => { if (!preview || preview.valid.length === 0) return; onImport(preview.valid); onClose(); };
  const canImport = preview && preview.valid.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div className="sl-import-inner">
        <div className="sl-import-header">
          <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.7rem", color: darkRed }}>Import Students from Excel</h2>
          <button onClick={onClose} style={{ background: darkRed, border: "none", borderRadius: "50%", width: "32px", height: "32px", color: "white", fontSize: "1.1rem", cursor: "pointer", fontWeight: "bold", flexShrink: 0 }}>✕</button>
        </div>
        <div className="sl-import-body">
          <div onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onClick={() => !file && fileRef.current.click()}
            style={{ border: `2px dashed ${dragging ? darkRed : "#ccc"}`, borderRadius: "14px", padding: file ? "16px 20px" : "32px 20px", textAlign: "center", background: dragging ? "#fff0f0" : "#f8f8f8", cursor: file ? "default" : "pointer", transition: "all 0.2s" }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={darkRed} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, color: "#222", fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "#888" }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                {parsing && <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#888", flexShrink: 0 }}>Parsing…</span>}
                <button onClick={e => { e.stopPropagation(); clearFile(); }} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0 }}>✕</button>
              </div>
            ) : (
              <>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "8px" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p style={{ fontFamily: "'Kufam', sans-serif", color: "#555", marginBottom: "4px", fontSize: "0.9rem" }}>Drag & drop your Excel file here</p>
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.83rem", color: darkRed, textDecoration: "underline" }}>or browse to upload</p>
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.76rem", color: red, marginTop: "8px", fontWeight: 600 }}>XLSX / XLS – max 10 MB</p>
              </>
            )}
          </div>
          {fileError && <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "crimson", marginTop: "8px" }}>{fileError}</p>}
          <div style={{ background: "#f0e8e8", borderRadius: "10px", padding: "10px 14px", marginTop: "12px" }}>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.73rem", color: darkRed, fontWeight: 700, marginBottom: "4px" }}>Required columns (in order):</p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#555", lineHeight: 1.7 }}>{EXCEL_COLUMNS.join(" | ")}</p>
          </div>
          <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-start" }}>
            <button onClick={downloadTemplateXLSX} style={{ background: darkRed, border: "none", borderRadius: "20px", padding: "8px 16px", color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600 }}>Download XLSX Template</button>
          </div>
          {preview && !parsing && (
            <div style={{ marginTop: "14px" }}>
              {preview.headerErrors.length > 0 && (
                <div style={{ background: "#fff0f0", border: "1px solid #f5c0c0", borderRadius: "10px", padding: "12px 14px", marginBottom: "10px" }}>
                  <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1rem", color: "#b00", marginBottom: "6px" }}>✕ Column headers don't match</p>
                  {preview.headerErrors.map((e, i) => <p key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "#c00", lineHeight: 1.6 }}>• {e}</p>)}
                </div>
              )}
              {preview.rowErrors.length > 0 && preview.headerErrors.length === 0 && (
                <div style={{ background: "#fff8f0", border: "1px solid #f5d8b0", borderRadius: "10px", padding: "12px 14px", marginBottom: "10px", maxHeight: "140px", overflowY: "auto" }}>
                  <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1rem", color: "#a05000", marginBottom: "6px" }}>⚠ {preview.rowErrors.length} issue{preview.rowErrors.length !== 1 ? "s" : ""} found{preview.valid.length > 0 ? ` — ${preview.valid.length} valid row${preview.valid.length !== 1 ? "s" : ""} will still be imported` : ""}</p>
                  {preview.rowErrors.map((e, i) => <p key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "#a05000", lineHeight: 1.6 }}>• {e}</p>)}
                </div>
              )}
              {preview.valid.length > 0 && preview.headerErrors.length === 0 && (
                <div style={{ background: "#f0fff4", border: "1px solid #b0e8c0", borderRadius: "10px", padding: "10px 14px" }}>
                  <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1rem", color: "#1a7a3a" }}>✓ {preview.valid.length} student{preview.valid.length !== 1 ? "s" : ""} ready to import</p>
                </div>
              )}
              {preview.valid.length === 0 && preview.headerErrors.length === 0 && preview.rowErrors.length > 0 && (
                <div style={{ background: "#fff0f0", border: "1px solid #f5c0c0", borderRadius: "10px", padding: "10px 14px" }}>
                  <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1rem", color: "#b00" }}>No valid rows to import.</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="sl-import-footer">
          <button onClick={() => fileRef.current.click()} style={{ background: "none", border: `1px solid ${darkRed}`, borderRadius: "20px", padding: "8px 18px", color: darkRed, fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", cursor: "pointer" }}>Choose different file</button>
          <button onClick={handleImport} disabled={!canImport} style={{ padding: "12px 36px", borderRadius: "28px", background: canImport ? darkRed : "#bbb", color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: canImport ? "pointer" : "not-allowed" }}>
            IMPORT {canImport ? `(${preview.valid.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Filter Panel ───────────────────────────────────────────────────────────────
const FilterPanel = ({ filters, setFilters, filterRef }) => {
  const [expandedCollege, setExpandedCollege] = useState(filters.college || "");
  const allColleges        = COLLEGE_KEYS;
  const allPrograms        = expandedCollege ? (COLLEGE_DATA[expandedCollege]?.programs || []) : [];

  // Derive section letters from YEAR_SECTIONS (e.g. "4-A" → "A")
  const sectionLetters = YEAR_SECTIONS.map(s => s.split("-")[1]).filter(Boolean);

  const clearAll = () => { setExpandedCollege(""); setFilters({ college: "", program: "", sex: "", section: "" }); };
  const toggleSex     = (val) => setFilters(prev => ({ ...prev, sex: prev.sex === val ? "" : val }));
  const toggleSection = (val) => setFilters(prev => ({ ...prev, section: prev.section === val ? "" : val }));
  const toggleCollege = (col) => {
    if (expandedCollege === col) { setExpandedCollege(""); setFilters(prev => ({ ...prev, college: "", program: "" })); }
    else { setExpandedCollege(col); setFilters(prev => ({ ...prev, college: col, program: "", specialization: "" })); }
  };
  const toggleProgram = (prog) => setFilters(prev => ({ ...prev, program: prev.program === prog ? "" : prog, specialization: "" }));
  const locationLevel = !expandedCollege ? "college" : "program";

  return (
    <div ref={filterRef} style={{ position: "absolute", top: "48px", right: 0, width: "260px", background: "white", border: `1.5px solid ${red}`, borderRadius: "10px", boxShadow: "0 6px 24px rgba(0,0,0,0.18)", zIndex: 100, overflow: "hidden", fontFamily: "'Kufam', sans-serif" }}>
      <div style={{ padding: "10px 12px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed }}>Sex:</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontSize: "0.7rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {SEX_OPTIONS.length > 0 ? (
            SEX_OPTIONS.map(s => (<span key={s} onClick={() => toggleSex(s)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.72rem", cursor: "pointer", userSelect: "none", background: filters.sex === s ? red : "#f0e0e0", color: filters.sex === s ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>{s}</span>))
          ) : (
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available</span>
          )}
        </div>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "6px 0" }} />
      <div style={{ padding: "4px 12px 10px" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, marginBottom: "6px" }}>Section:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {sectionLetters.length > 0 ? (
            sectionLetters.map(s => (<span key={s} onClick={() => toggleSection(s)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.72rem", cursor: "pointer", userSelect: "none", background: filters.section === s ? red : "#f0e0e0", color: filters.section === s ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>{s}</span>))
          ) : (
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No sections available</span>
          )}
        </div>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "0" }} />
      <div style={{ padding: "6px 12px 10px" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, marginBottom: "6px" }}>
          Department:
          {expandedCollege && <span style={{ fontWeight: "normal", color: "#888", marginLeft: "6px", fontSize: "0.68rem" }}>{[expandedCollege, filters.program].filter(Boolean).join(" › ")}</span>}
        </p>
        {locationLevel === "college" && (
          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
            {allColleges.length > 0 ? (
              allColleges.map(col => (<div key={col} onClick={() => toggleCollege(col)} style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", cursor: "pointer", background: "#f7f0f0", color: darkRed, border: "1px solid #e0c0c0" }} onMouseEnter={e => e.currentTarget.style.background = "#f0d0d0"} onMouseLeave={e => e.currentTarget.style.background = "#f7f0f0"}>{COLLEGE_DATA[col]?.label || col}</div>))
            ) : (
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No departments available</span>
            )}
          </div>
        )}
        {locationLevel === "program" && (
          <div>
            <div onClick={() => toggleCollege(expandedCollege)} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "8px", color: red, fontSize: "0.72rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {expandedCollege}
            </div>
            <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {allPrograms.map(prog => (<span key={prog} onClick={() => toggleProgram(prog)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: filters.program === prog ? red : "#f0e0e0", color: filters.program === prog ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>{prog}</span>))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const StudentAvatar = ({ size = 42 }) => (
  <img src={userIcon} alt="user" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
);

const StudentRowMenu = ({ onView, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", color: "#555", fontSize: "1.2rem", lineHeight: 1, fontWeight: "bold" }}>⋮</button>
      {showMenu && (
        <div style={{ position: "absolute", top: "28px", right: 0, background: "white", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.18)", zIndex: 100, minWidth: "90px", overflow: "hidden" }}>
          <button onClick={() => { onView(); setShowMenu(false); }} style={{ width: "100%", border: "none", background: "white", padding: "9px 14px", textAlign: "left", cursor: "pointer", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", fontWeight: 600, color: "#222" }} onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"} onMouseLeave={e => e.currentTarget.style.background = "white"}>View</button>
          <div style={{ height: "1px", background: "#e0e0e0", margin: "0 8px" }} />
          <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }} style={{ width: "100%", border: "none", background: "white", padding: "9px 14px", textAlign: "left", cursor: "pointer", fontSize: "0.78rem", color: "#c62828", fontFamily: "'Kufam', sans-serif", fontWeight: 600 }} onMouseEnter={e => e.currentTarget.style.background = "#fff0f0"} onMouseLeave={e => e.currentTarget.style.background = "white"}>Delete</button>
        </div>
      )}
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const mapStudentDoc = (docSnap) => {
  const d = docSnap.data();
  return {
    id:             docSnap.id,       // Firestore doc ID = Firebase Auth UID
    studentId:      d.studentId      || "",
    lastName:       d.lastName       || "",
    middleInitial:  d.middleInitial  || "",
    firstName:      d.firstName      || "",
    suffix:         d.suffix         || "",
    college:        d.college        || "",
    program:        d.program        || "",
    specialization: d.specialization || "",
    yearSection:    d.yearSection    || "",
    sex:            d.sex            || "",
    age:            d.age            || "",
    email:          d.email          || "",
    fullName:       d.fullName       || `${d.firstName} ${d.lastName}`,
    status:         d.status         || "active",
  };
};

// ── Main Screen ────────────────────────────────────────────────────────────────
// Props:
//   coordinatorUid — logged-in coordinator's Firebase UID
const CoordinatorStudentsListScreen = ({ coordinatorUid }) => {
  const [students, setStudents]                 = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [selected, setSelected]                 = useState(new Set());
  const [search, setSearch]                     = useState("");
  const [showNewModal, setShowNewModal]         = useState(false);
  const [showImportModal, setShowImportModal]   = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [viewingStudent, setViewingStudent]     = useState(null);
  const [successInfo, setSuccessInfo]           = useState(null); // { fullName, password }
  const [filters, setFilters]                   = useState({ college: "", program: "", sex: "", section: "" });
  const filterRef = useRef(null);

  // ── Real-time listener: students created by this coordinator ───────────────
  useEffect(() => {
    if (!coordinatorUid) return;
    const q = query(collection(db, "students"), where("createdBy", "==", coordinatorUid));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(mapStudentDoc));
      setLoading(false);
    });
    return () => unsub();
  }, [coordinatorUid]);

  // ── Close filter panel on outside click ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterDrawer(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasFilter = Object.values(filters).some(Boolean);

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch  = `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || s.studentId.includes(q) || s.email.toLowerCase().includes(q);
    const matchCollege = !filters.college || s.college === filters.college;
    const matchProgram = !filters.program || s.program === filters.program;
    const matchSex     = !filters.sex || s.sex === filters.sex;
    const matchSection = !filters.section || s.yearSection.endsWith(`-${filters.section}`);
    return matchSearch && matchCollege && matchProgram && matchSex && matchSection;
  });

  const toggleSelect = (id) => { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleAll    = () => { if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set()); else setSelected(new Set(filtered.map(s => s.id))); };

  // ── Create — calls AuthService then shows success modal ───────────────────
  const handleCreate = async (form) => {
    const { password } = await createStudentAccount(form, coordinatorUid);
    setShowNewModal(false);
    setSuccessInfo({
      fullName:  `${form.firstName} ${form.middleInitial ? form.middleInitial + ". " : ""}${form.lastName}`,
      studentId: form.studentId,
      email:     form.email,
      password,
    });
    // onSnapshot will auto-update the list
  };

  // ── Save (edit) — updates Firestore doc ───────────────────────────────────
  const handleSave = async (form) => {
    await updateDoc(doc(db, "students", viewingStudent.id), {
      ...form,
      fullName: `${form.firstName} ${form.middleInitial ? form.middleInitial + ". " : ""}${form.lastName}`,
      updatedAt: serverTimestamp(),
    });
    setViewingStudent(null);
  };

  // ── Delete single ─────────────────────────────────────────────────────────
  const handleDelete = (id) => {
    setTimeout(async () => {
      if (!window.confirm("Delete this student? This cannot be undone.")) return;
      await deleteDoc(doc(db, "students", id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, 0);
  };

  // ── Delete selected ───────────────────────────────────────────────────────
  const handleDeleteSelected = async () => {
    if (!window.confirm(`Delete ${selected.size} selected student(s)? This cannot be undone.`)) return;
    await Promise.all([...selected].map(id => deleteDoc(doc(db, "students", id))));
    setSelected(new Set());
  };

  // ── Import — batch creates via AuthService ────────────────────────────────
  const handleImport = async (newStudents) => {
    // Fire in sequence to avoid hammering Firebase Auth rate limits
    for (const s of newStudents) {
      try {
        await createStudentAccount(s, coordinatorUid);
      } catch (err) {
        console.warn(`Skipped ${s.studentId}:`, err.message);
      }
    }
    // onSnapshot auto-updates the list
  };

  const handleExport = () => {
    if (students.length === 0) { alert("No students to export."); return; }
    exportToXLSX(students.map(s => ({
      studentId: s.studentId, lastName: s.lastName, middleInitial: s.middleInitial,
      firstName: s.firstName, college: s.college, program: s.program,
      specialization: "", yearSection: s.yearSection,
      sex: s.sex, age: s.age, email: s.email,
    })));
  };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0" }}>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888" }}>Loading students…</p>
      </div>
    );
  }

  return (
    <>
      <ResponsiveStyles />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f0f0f0", overflow: "hidden" }}>

        {/* Top Bar */}
        <div className="sl-topbar">
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 4vw, 1.6rem)", color: "white", letterSpacing: "0.04em" }}>Student Account</span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", borderRadius: "24px", padding: "7px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <div style={{ width: "1px", height: "16px", background: "rgba(0,0,0,0.2)" }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Students"
                className="sl-search-input"
                style={{ border: "none", background: "transparent", outline: "none", color: "black", fontFamily: "'Jersey 25'", fontSize: "1.1rem" }}
              />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1 }}>✕</button>}
            </div>
            <div style={{ position: "relative" }}>
              <div onClick={() => setShowFilterDrawer(v => !v)} style={{ width: "36px", height: "36px", background: "white", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `2px solid ${red}` : "none", position: "relative" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? red : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                {hasFilter && <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "10px", height: "10px", borderRadius: "50%", background: red }} />}
              </div>
              {showFilterDrawer && <FilterPanel filters={filters} setFilters={setFilters} filterRef={filterRef} />}
            </div>
          </div>
        </div>

        {/* Sub Bar */}
        <div className="sl-subbar">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div onClick={toggleAll} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <div style={{ width: "18px", height: "18px", border: `2px solid ${darkRed}`, borderRadius: "3px", background: allSelected ? darkRed : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {allSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", color: darkRed }}>Select All</span>
            </div>
            {selected.size > 0 && (
              <button onClick={handleDeleteSelected} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 14px", borderRadius: "20px", background: "#8B0000", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Delete ({selected.size})
              </button>
            )}
          </div>
          <div className="sl-action-btns">
            {[
              { label: "Export",        onClick: handleExport,                   color: darkRed },
              { label: "Import",        onClick: () => setShowImportModal(true),  color: darkRed },
              { label: "+ New Student", onClick: () => setShowNewModal(true),     color: "#222"  },
            ].map(btn => (
              <button key={btn.label} onClick={btn.onClick} style={{ padding: "7px 18px", borderRadius: "24px", background: btn.color, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "0.95rem", cursor: "pointer" }}>{btn.label}</button>
            ))}
          </div>
        </div>

        {/* Filter badges */}
        {hasFilter && (
          <div className="sl-filter-badges">
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#888" }}>Filters:</span>
            {filters.sex && <span style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>{filters.sex}<span onClick={() => setFilters(prev => ({ ...prev, sex: "" }))} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span></span>}
            {filters.section && <span style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>4-{filters.section}<span onClick={() => setFilters(prev => ({ ...prev, section: "" }))} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span></span>}
            {filters.college && <span style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>{[filters.college ? (COLLEGE_DATA[filters.college]?.label || filters.college) : "", filters.program].filter(Boolean).join(" › ")}<span onClick={() => setFilters(prev => ({ ...prev, college: "", program: "" }))} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span></span>}
            <span onClick={() => setFilters({ college: "", program: "", sex: "", section: "" })} style={{ fontSize: "0.74rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", textDecoration: "underline" }}>Clear all</span>
          </div>
        )}

        {/* Student List */}
        <div className="sl-list-area">
          {filtered.map(s => (
            <div key={s.id} className="student-row" onClick={() => setViewingStudent(s)}
              style={{ background: selected.has(s.id) ? "#d0cece" : "#dadada", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "12px", transition: "background 0.15s", cursor: "pointer" }}
            >
              <div onClick={(e) => { e.stopPropagation(); toggleSelect(s.id); }} style={{ width: "18px", height: "18px", border: `2px solid ${darkRed}`, borderRadius: "3px", background: selected.has(s.id) ? darkRed : "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {selected.has(s.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <StudentAvatar />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                  {s.firstName} {s.middleInitial ? s.middleInitial + " " : ""}{s.lastName}{s.suffix ? ` ${s.suffix}` : ""}
                </span>
                <div style={{ display: "flex", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#666" }}>{s.studentId}</span>
                  {s.yearSection && <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#888" }}>• {s.yearSection}</span>}
                  <span className="sl-row-program">{s.program && <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#888" }}>• {s.program}</span>}</span>
                </div>
              </div>
              <StudentRowMenu onView={() => setViewingStudent(s)} onDelete={() => handleDelete(s.id)} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px", color: "#aaa", fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem" }}>
              {students.length === 0 ? "No students yet. Add a new student to get started." : "No students match your search or filters."}
            </div>
          )}
          {filtered.length > 0 && (
            <p style={{ textAlign: "center", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#aaa", padding: "16px 0" }}>
              Showing {filtered.length} of {students.length} student{students.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {showNewModal    && <StudentForm onClose={() => setShowNewModal(false)} onSubmit={handleCreate} submitLabel="CREATE ACCOUNT" />}
      {viewingStudent  && <StudentForm initial={viewingStudent} readOnly onClose={() => setViewingStudent(null)} onSubmit={handleSave} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} onImport={handleImport} />}

      {/* ── Success modal after creating a student ── */}
      {successInfo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px" }}>
          <div style={{ background: "white", borderRadius: "20px", padding: "28px 24px", width: "100%", maxWidth: "340px", boxShadow: "0 8px 32px rgba(0,0,0,0.22)", textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", marginBottom: "8px" }}>✅</div>
            <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: "#1a1a1a", marginBottom: "6px" }}>Account Created!</p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#555", marginBottom: "14px" }}>Share these credentials with the student:</p>
            <div style={{ background: "#f9f9f9", borderRadius: "12px", padding: "12px 16px", textAlign: "left", marginBottom: "18px" }}>
              {[["Student ID", successInfo.studentId], ["Full Name", successInfo.fullName], ["Email", successInfo.email], ["Password", successInfo.password]].map(([label, val]) => (
                <div key={label} style={{ marginBottom: "6px" }}>
                  <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "0.85rem", color: darkRed }}>{label}: </span>
                  <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#1a1a1a", fontWeight: label === "Password" ? "700" : "400" }}>{val}</span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#aaa", marginBottom: "18px" }}>Remind the student to change their password after first login.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => { setSuccessInfo(null); setShowNewModal(true); }} style={{ background: darkRed, color: "white", border: "none", borderRadius: "20px", padding: "10px 22px", fontFamily: "'Jersey 25', sans-serif", fontSize: "0.95rem", cursor: "pointer" }}>Add Another</button>
              <button onClick={() => setSuccessInfo(null)} style={{ background: "white", color: darkRed, border: `2px solid ${darkRed}`, borderRadius: "20px", padding: "10px 22px", fontFamily: "'Jersey 25', sans-serif", fontSize: "0.95rem", cursor: "pointer" }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CoordinatorStudentsListScreen;