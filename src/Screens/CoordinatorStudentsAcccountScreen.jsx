import React, { useState, useRef, useCallback, useEffect } from "react";
import XLSX from "xlsx-js-style";
import userIcon from "../icons/user.png";

// Firebase
import { db }                          from "./firebase";
import { createStudentAccount, generateStudentPassword, logActivity } from "./AuthService";
import { useDepartmentsPrograms }      from "./departmentsPrograms";
import {
  collection, query, where,
  onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { color, font, type, space, radius, shadow, ease } from "./theme";

// ── Design tokens, aliased for this screen ────────────────────────────────────
// Same aliases as the other coordinator screens so all three stay in sync.
const ink        = color.ink;
const inkBody    = color.inkBody;
const inkMuted   = color.inkMuted;
const inkFaint   = color.inkFaint;
const surface    = color.wine600;      // rows, modals
const page       = color.wine900;      // page background
const line       = color.wine700;      // hairlines & borders
const lineSoft   = color.wine800;
const panel      = color.blush100;     // dark header bar, primary buttons
const panelDeep  = color.blush50;
const onPanel    = color.onWine;
const onPanelDim = color.onWineMuted;
const danger     = color.danger;
const success    = color.success;
const warning    = color.warning;

// Used by FilterPanel to switch to viewport-anchored positioning on narrow
// screens, instead of positioning relative to the small filter icon button
// (which caused it to overflow off the left edge of the screen on mobile).
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

// ── College / Program / Specialization Data ───────────────────────────────────
// Now loaded live from Firestore via useDepartmentsPrograms() (see
// ./departmentsPrograms) — the same source SignUpStep1Screen,
// CoordinatorAccountProfileScreen, StudentAccountProfileScreen, and
// CompanyCreatePostScreen all use. This used to be its own fifth hardcoded
// copy, keyed by short CODE ("CCS") with a `label` full name — and worse,
// the CODE itself (not the full name) is what actually got saved onto the
// student's `college` field in Firestore, which never matched the full
// names everyone else in the app uses. See LEGACY_PROGRAM_CODE_MAP below
// for the CSV-import bridge that still accepts the old short forms.
//
// LEGACY_PROGRAM_CODE_MAP — same short-form → canonical-full-name bridge
// used in StudentAccountProfileScreen.jsx, kept here too so the bulk-import
// "Program Code" spreadsheet column can still be filled in with the old
// short forms ("BSIT") without every school having to retype full names —
// while what's actually saved to Firestore is always the canonical full
// name, matching companies'/coordinators'/posts' Program values exactly.
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

// Year & Section options — adjust to match your school's actual sections
const YEAR_SECTIONS = [
  "4-A","4-B","4-C","4-D","4-E", "4-F",
];

const SEX_OPTIONS = ["Male", "Female"];

const SUFFIX_OPTIONS = ["Jr.", "Sr.", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// Some older/imported records stored a literal "None" or "N/A" instead of
// leaving the suffix blank — treat those the same as having no suffix.
const isRealSuffix = (v) => !!v && !["none", "n/a"].includes(String(v).trim().toLowerCase());

const EXCEL_COLUMNS = [
  "Student ID", "Full Name", "Default Password"
];

// Columns for the bulk-IMPORT template — separate from EXCEL_COLUMNS above,
// which is only for the 3-column credentials export. Order must match the
// row[0..10] indices read in ImportModal.parseFile below.
const IMPORT_TEMPLATE_COLUMNS = [
  "Student ID", "Last Name", "Middle Initial", "First Name",
  "College Code", "Program Code", "Major/Specialization (or N/A)",
  "Year & Section", "Sex", "Age", "Email",
];

const NAME_REGEX = /^[A-Za-zÑñ][A-Za-zÑñ\s\-]*$/;
const MIDDLE_INITIAL_REGEX = /^[A-Z]\.$/;
const GMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@gmail\.com$/;

// ── Responsive styles ─────────────────────────────────────────────────────────
// Page shape mirrors Find Company: padded scroll area → floating dark bar →
// toolbar row → student list.
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: ${color.wine400}; border-radius: 999px; }
    ::-webkit-scrollbar-track { background: transparent; }

    /* Page wrapper */
    .sa-list-wrapper {
      overflow-x: hidden;
      overflow-y: auto;
      width: 100%;
      flex: 1;
      background: ${page};
      padding: clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px);
    }

    /* Floating dark header bar */
    .sa-search-bar {
      background: ${panel};
      border-radius: ${radius.panel};
      padding: 18px 22px;
      margin-bottom: ${space.md};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${space.md};
      flex-wrap: wrap;
    }
    @media (max-width: 480px) {
      .sa-search-bar { padding: 14px; }
    }

    .sa-search-input { width: 170px; }
    .sa-search-input::placeholder { color: ${inkFaint}; }
    @media (max-width: 480px) {
      .sa-search-input { width: 110px; }
    }

    /* Toolbar row under the bar */
    .sa-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${space.md};
      flex-wrap: wrap;
      margin-bottom: ${space.md};
    }
    .sa-toolbar-group {
      display: flex;
      align-items: center;
      gap: ${space.sm};
      flex-wrap: wrap;
    }

    /* Student list — full-width rows, so bulk-select checkboxes line up in
       one vertical column and a whole section scans in a single glance. */
    .sa-student-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .sa-row {
      display: flex;
      align-items: center;
      gap: 14px;
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.card};
      padding: 14px 20px;
      cursor: pointer;
      min-width: 0;
      box-shadow: ${shadow.input};
      transition: border-color 200ms ${ease}, box-shadow 200ms ${ease};
    }
    .sa-row:hover {
      border-color: ${color.wine400};
      box-shadow: 0 6px 20px rgba(10,10,10,0.08);
    }

    .sa-row-main    { flex: 1; min-width: 0; }
    .sa-row-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

    @media (max-width: 560px) {
      .sa-row { padding: 12px 14px; gap: 10px; }
      /* The section already shows in the meta line, and View lives in the
         ⋮ menu, so both can go on narrow screens. */
      .sa-row-badge,
      .sa-row-view { display: none; }
    }

    .sa-list-wrapper :focus-visible,
    .sa-modal-inner :focus-visible,
    .sa-import-inner :focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: ${radius.pill};
    }

    /* Student form modal */
    .sa-modal-inner {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.panel};
      width: 660px;
      max-width: calc(100vw - 32px);
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: ${shadow.panel};
    }
    .sa-modal-header {
      padding: 22px 28px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid ${line};
    }
     @media (max-width: 560px) {
      .sa-modal-inner {
        max-width: calc(100vw - 72px);
        max-height: 46vh;
        border-radius: ${radius.card};
      }
      .sa-modal-header { padding: 16px 16px 12px; }
    }
    .sa-modal-body {
      overflow-y: auto;
      padding: 18px 28px 22px;
      flex: 1;
    }
    @media (max-width: 560px) {
      .sa-modal-body { padding: 14px 16px 18px; }
    }
    .sa-modal-footer {
      background: ${color.wine800};
      border-top: 1px solid ${line};
      padding: 14px 28px;
      display: flex;
      justify-content: flex-end;
      gap: ${space.sm};
    }
    @media (max-width: 560px) {
      .sa-modal-footer { padding: 12px 16px; }
    }

    /* Name grid: 4-col on desktop, 2-col on tablet, 1-col on mobile */
    .sa-name-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.7fr 1.2fr 0.6fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    @media (max-width: 600px) {
      .sa-name-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 380px) {
      .sa-name-grid { grid-template-columns: 1fr; }
    }

    .sa-college-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    @media (max-width: 600px) {
      .sa-college-grid { grid-template-columns: 1fr; }
    }

    .sa-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    @media (max-width: 600px) {
      .sa-info-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 380px) {
      .sa-info-grid { grid-template-columns: 1fr; }
    }

    /* Import modal */
    .sa-import-inner {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.panel};
      width: 540px;
      max-width: calc(100vw - 32px);
      max-height: 76vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: ${shadow.panel};
    }
    .sa-import-header {
      padding: 22px 28px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      border-bottom: 1px solid ${line};
    }
    @media (max-width: 560px) {
      .sa-import-header { padding: 16px 16px 12px; }
    }
    .sa-import-body {
      overflow-y: auto;
      padding: 18px 28px;
      flex: 1;
    }
    @media (max-width: 560px) {
      .sa-import-body { padding: 14px 16px; }
    }
      .sa-import-inner {
        max-width: calc(100vw - 56px);
        max-height: 78vh;
        border-radius: ${radius.card};
      }
    .sa-import-footer {
      background: ${color.wine800};
      border-top: 1px solid ${line};
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${space.sm};
      flex-shrink: 0;
    }
    @media (max-width: 560px) {
      .sa-import-footer { padding: 12px 16px; flex-wrap: wrap; }
    }

    @media (prefers-reduced-motion: reduce) {
      .sa-row { transition: none; }
    }
  `}</style>
);

// ── Shared control styles ─────────────────────────────────────────────────────
const chip = (on) => ({
  padding: "5px 12px",
  borderRadius: radius.pill,
  fontFamily: font.ui,
  ...type.helper,
  cursor: "pointer",
  userSelect: "none",
  background: on ? ink : color.wine800,
  color: on ? color.white : inkBody,
  border: `1px solid ${on ? ink : line}`,
  transition: `all 160ms ${ease}`,
});

const primaryBtn = {
  padding: "9px 20px", borderRadius: radius.pill, background: panel, color: onPanel,
  border: "none", fontFamily: font.ui, ...type.control, cursor: "pointer",
};
const ghostBtn = {
  padding: "9px 20px", borderRadius: radius.pill, background: surface, color: inkBody,
  border: `1px solid ${line}`, fontFamily: font.ui, ...type.control, cursor: "pointer",
};

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
    return "";
  },

};

const exportToXLSX = (students, departments) => {
  const rows = [EXCEL_COLUMNS];
  students.forEach(s => {
    const fullName = `${s.firstName} ${s.middleInitial ? s.middleInitial + " " : ""}${s.lastName}`.trim();
    // Must derive the SAME abbreviation used at account-creation time (see
    // createStudentAccount/handleCreate) so the regenerated password here
    // actually matches the real one, not a mismatched ".collegeofcomputer..."
    // suffix — s.college is the full name saved on the student doc.
    const collegeAbbr = departments[s.college]?.abbr || s.college;
    const defaultPassword = generateStudentPassword(s.firstName, s.lastName, s.studentId, collegeAbbr);
    rows.push([s.studentId, fullName, defaultPassword]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 16 }, { wch: 30 }, { wch: 24 }];

  const cellBorder = {
    top:    { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left:   { style: "thin", color: { rgb: "000000" } },
    right:  { style: "thin", color: { rgb: "000000" } },
  };

  // Header row — bold + bordered
  for (let c = 0; c < EXCEL_COLUMNS.length; c++) {
    const headerCell = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[headerCell]) {
      ws[headerCell].s = {
        font: { bold: true },
        border: cellBorder,
        alignment: { horizontal: "left", vertical: "center" },
      };
    }
  }

  // Data rows — bordered
  for (let r = 1; r <= students.length; r++) {
    for (let c = 0; c < EXCEL_COLUMNS.length; c++) {
      const cell = XLSX.utils.encode_cell({ r, c });
      if (ws[cell]) {
        ws[cell].s = { border: cellBorder, alignment: { vertical: "center" } };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Student Credentials");
  XLSX.writeFile(wb, "student_credentials.xlsx");
};

const downloadTemplateXLSX = () => {
  const rows = [
    IMPORT_TEMPLATE_COLUMNS,
    [
      "e.g. 201112345", "e.g. Dela Cruz", "e.g. M.", "e.g. Juan",
      "e.g. CED", "e.g. BSED (Major in English)",
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
    for (let c = 0; c < IMPORT_TEMPLATE_COLUMNS.length; c++) {
      const cell = XLSX.utils.encode_cell({ r, c });
      ws[cell] = { t: "s", v: "", s: { protection: { locked: false } } };
    }
  }
  for (let c = 0; c < IMPORT_TEMPLATE_COLUMNS.length; c++) {
    const headerCell = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[headerCell]) {
      ws[headerCell].s = {
        // Header fill follows the app's dark panel, not the old maroon.
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "161616" } },
        alignment: { horizontal: "center" },
        protection: { locked: true },
      };
    }
  }
  for (let c = 0; c < IMPORT_TEMPLATE_COLUMNS.length; c++) {
    const cell = XLSX.utils.encode_cell({ r: 1, c });
    ws[cell].s = {
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
      font: { name: "Calibri", sz: 11, bold: false, italic: false, color: { rgb: "A85450" } },
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
      style={{ width: "100%", appearance: "none", WebkitAppearance: "none", background: disabled ? color.wine800 : color.white, border: `1px solid ${hasError ? danger : line}`, borderRadius: radius.pill, padding: "9px 36px 9px 14px", fontFamily: font.ui, ...type.helper, color: disabled ? inkFaint : (value ? ink : inkFaint), cursor: disabled ? "not-allowed" : "pointer", outline: "none" }}
    >
      <option value="">{placeholder || "Select…"}</option>
      {options.map(o => typeof o === 'object' ? <option key={o.value} value={o.value}>{o.label}</option> : <option key={o} value={o}>{o}</option>)}
    </select>
    <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: disabled ? inkFaint : inkMuted }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
    </div>
  </div>
);

const StyledInput = ({ value, onChange, placeholder, type: inputType = "text", disabled, hasError }) => (
  <input
    type={inputType} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    style={{ width: "100%", background: disabled ? color.wine800 : color.white, border: `1px solid ${hasError ? danger : line}`, borderRadius: radius.pill, padding: "9px 14px", fontFamily: font.ui, ...type.helper, color: ink, outline: "none", boxSizing: "border-box" }}
  />
);

const FieldLabel = ({ children }) => (
  <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: "6px", marginTop: "12px" }}>{children}</p>
);

const FieldError = ({ msg }) => msg ? (
  <p style={{ fontFamily: font.ui, ...type.helper, color: danger, marginTop: "4px", paddingLeft: "14px" }}>{msg}</p>
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
const StudentForm = ({ initial = {}, readOnly = false, onClose, onSubmit, submitLabel = "Create account", coordinatorColleges = [], departments = {} }) => {
  const studentId     = useField(initial.studentId || "", "studentId");
  const lastName      = useField(initial.lastName || "", "lastName");
  const middleInitial = useField(initial.middleInitial || "", "middleInitial");
  const firstName     = useField(initial.firstName || "", "firstName");
  const suffix        = useField(initial.suffix || "", "suffix");
  const sex           = useField(initial.sex || "", "sex");
  const yearSection   = useField(initial.yearSection || "", "yearSection");
  const age           = useField(initial.age || "", "age");
  const email         = useField(initial.email || "", "email");

  // New students are always created under one of the coordinator's own
  // assigned department(s) — it's not a free choice of ALL colleges anymore.
  // The specific program within that department is a free choice, though:
  // all coordinators of the same college (e.g. all of CED) see and manage
  // the same students regardless of program/major.
  // Default to the single assigned college if there's only one; existing
  // students being edited keep whatever college they already have.
  const [college, setCollege] = useState(
    initial.college || (coordinatorColleges.length === 1 ? coordinatorColleges[0] : "")
  );
  const [program, setProgram] = useState(initial.program || "");
  const [collegeTouched, setCollegeTouched] = useState(false);
  const [programTouched, setProgramTouched] = useState(false);
  const [isEditing, setIsEditing]           = useState(!readOnly);
  const [saving, setSaving]                 = useState(false);
  const [submitError, setSubmitError]       = useState("");

  const programs = college ? (departments[college]?.programs || []).map(p => p.name) : [];
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
      setSubmitError(err.message || "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const locked = readOnly && !isEditing;

  // fullName — used for the modal header. Now includes the suffix (e.g. "Jr.")
  // and stays live: it recomputes from the current field values while editing,
  // and falls back to the original `initial` data before any edits are made.
  const buildFullName = (last, first, suf) =>
    last && first ? `${last}, ${first}${isRealSuffix(suf) ? " " + suf : ""}` : null;

  const fullName =
    buildFullName(lastName.value, firstName.value, suffix.value) ||
    buildFullName(initial.lastName, initial.firstName, initial.suffix) ||
    "New student";

  const onStudentIdChange     = (v) => { if (/^\d*$/.test(v) && v.length <= 9) studentId.onChange(v); };
  const onLastNameChange      = (v) => { lastName.onChange(v.replace(/[^A-Za-zÑñ\s\-]/g, "")); };
  const onFirstNameChange     = (v) => { firstName.onChange(v.replace(/[^A-Za-zÑñ\s\-]/g, "")); };
  const onMiddleInitialChange = (v) => { middleInitial.onChange(v.replace(/[^A-Z.]/g, "").slice(0, 2)); };
  const onAgeChange           = (v) => { if (v === "" || /^\d+$/.test(v)) age.onChange(v); };

  return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "clamp(16px, 5vw, 24px)" }}>
      <div className="sa-modal-inner">
        <div className="sa-modal-header">
          <h2 style={{ fontFamily: font.ui, fontSize: "clamp(1.125rem, 4vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: ink }}>{fullName}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: lineSoft, border: `1px solid ${line}`, borderRadius: "50%", width: "30px", height: "30px", color: inkMuted, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>

        <div className="sa-modal-body">
          <div style={{ marginBottom: "12px" }}>
            <FieldLabel>Student ID</FieldLabel>
            <div style={{ width: "min(220px, 100%)" }}>
              <StyledInput value={studentId.value} onChange={onStudentIdChange} placeholder="9-digit number" disabled={locked} hasError={!!studentId.error} />
              <FieldError msg={studentId.error} />
            </div>
          </div>

          <div className="sa-name-grid">
            <div>
              <FieldLabel>Last name</FieldLabel>
              <StyledInput value={lastName.value} onChange={onLastNameChange} placeholder="Dela Cruz" disabled={locked} hasError={!!lastName.error} />
              <FieldError msg={lastName.error} />
            </div>
            <div>
              <FieldLabel>Middle initial</FieldLabel>
              <StyledInput value={middleInitial.value} onChange={onMiddleInitialChange} placeholder="M." disabled={locked} hasError={!!middleInitial.error} />
              <FieldError msg={middleInitial.error} />
            </div>
            <div>
              <FieldLabel>First name</FieldLabel>
              <StyledInput value={firstName.value} onChange={onFirstNameChange} placeholder="Juan" disabled={locked} hasError={!!firstName.error} />
              <FieldError msg={firstName.error} />
            </div>
            <div>
              <FieldLabel>Suffix</FieldLabel>
              <StyledSelect value={suffix.value} onChange={(v) => suffix.onChange(v)} options={SUFFIX_OPTIONS} placeholder="None" disabled={locked} hasError={!!suffix.error} />
              <FieldError msg={suffix.error} />
            </div>
          </div>

          <div className="sa-college-grid">
            <div>
              <FieldLabel>Department</FieldLabel>
              {/* Locked to the coordinator's own department(s) — never the
                  full college list. Single department → static label so it
                  can't be changed. Multiple → dropdown, but restricted to
                  just the coordinator's assigned departments. */}
              {coordinatorColleges.length > 1 && !locked ? (
                <>
                  <StyledSelect
                    value={college}
                    onChange={handleCollegeChange}
                    options={coordinatorColleges.map(name => ({ value: name, label: name }))}
                    placeholder="Select your department"
                    hasError={!!collegeError}
                  />
                  <FieldError msg={collegeError} />
                </>
              ) : (
                <div style={{
                  width: "100%", padding: "9px 14px", borderRadius: radius.pill,
                  background: color.wine800, color: inkBody, fontFamily: font.ui,
                  ...type.helper, border: `1px solid ${line}`,
                }}>
                  {college || "—"}
                </div>
              )}
            </div>
            <div>
              <FieldLabel>Program</FieldLabel>
              <StyledSelect value={program} onChange={handleProgramChange} options={programs} placeholder="Select program" disabled={locked || !college} hasError={!!programError} />
              <FieldError msg={programError} />
            </div>
          </div>

          <div className="sa-info-grid">
            <div>
              <FieldLabel>Year & section</FieldLabel>
              <StyledSelect value={yearSection.value} onChange={(v) => yearSection.onChange(v)} options={YEAR_SECTIONS} placeholder="Select section" disabled={locked} hasError={!!yearSection.error} />
              <FieldError msg={yearSection.error} />
            </div>
            <div>
              <FieldLabel>Sex</FieldLabel>
              <StyledSelect value={sex.value} onChange={(v) => sex.onChange(v)} options={SEX_OPTIONS} placeholder="Select sex" disabled={locked} hasError={!!sex.error} />
              <FieldError msg={sex.error} />
            </div>
            <div>
              <FieldLabel>Age</FieldLabel>
              <StyledInput value={age.value} onChange={onAgeChange} disabled={locked} hasError={!!age.error} />
              <FieldError msg={age.error} />
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <FieldLabel>Email address</FieldLabel>
            <StyledInput value={email.value} onChange={(v) => email.onChange(v)} type="email" placeholder="student@gmail.com" disabled={locked} hasError={!!email.error} />
            <FieldError msg={email.error} />
          </div>

          {/* Password preview — shown on create, and when coordinator views an existing student */}
          {lastName.value && college && (
            <div style={{ background: color.wine800, border: `1px solid ${line}`, borderRadius: radius.card, padding: "12px 16px", marginTop: space.md }}>
              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginBottom: "4px" }}>Default password</p>
              <p style={{ fontFamily: font.ui, ...type.label, color: ink, margin: 0 }}>
                {(firstName.value && lastName.value && studentId.value && college) ? generateStudentPassword(firstName.value, lastName.value, studentId.value, departments[college]?.abbr || college) : "—"}
              </p>
              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, margin: "6px 0 0" }}>
                Built from the last name, 123., and the college code, all lowercase. The student should change it after signing in.
              </p>
            </div>
          )}

          {submitError && (
            <p style={{ fontFamily: font.ui, ...type.helper, color: danger, marginTop: space.md }}>{submitError}</p>
          )}
        </div>

        {!readOnly && (
          <div className="sa-modal-footer">
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
            <button onClick={handleSubmit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Creating…" : submitLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const validateRow = (row, rowIndex, coordinatorColleges = [], departments = {}) => {
  const errs = []; const r = rowIndex + 3;
  const departmentNames = Object.keys(departments);
  // Reverse-lookup: short College Code (e.g. "CCS") → canonical full name,
  // derived from each department's `abbr` in the live Firestore data — so
  // the spreadsheet can stay compact while what's saved is always the same
  // full name companies/coordinators/posts use.
  const abbrToFullName = {};
  departmentNames.forEach(name => { if (departments[name]?.abbr) abbrToFullName[departments[name].abbr] = name; });

  if (!row.studentId) errs.push(`Row ${r}: Student ID is required`);
  else if (!/^\d{9}$/.test(row.studentId)) errs.push(`Row ${r}: Student ID must be exactly 9 digits`);
  if (!row.lastName) errs.push(`Row ${r}: Last Name is required`);
  if (!row.firstName) errs.push(`Row ${r}: First Name is required`);
  if (row.middleInitial && !/^[A-Z]\.$/.test(row.middleInitial.trim())) errs.push(`Row ${r}: Middle Initial must be format "X."`);

  if (!row.college) {
    errs.push(`Row ${r}: College is required`);
  } else {
    // Accept either the short Code ("CCS") or the full name directly.
    const resolvedCollege = abbrToFullName[row.college] || (departmentNames.includes(row.college) ? row.college : null);
    if (!resolvedCollege) errs.push(`Row ${r}: College "${row.college}" is not valid`);
    else if (coordinatorColleges.length > 0 && !coordinatorColleges.includes(resolvedCollege)) errs.push(`Row ${r}: College "${row.college}" is not one of your assigned departments — you can only import your own department's students`);
    else row.college = resolvedCollege; // normalize in place to the canonical full name before this row gets saved
  }

  if (!row.program) {
    errs.push(`Row ${r}: Program is required`);
  } else if (row.college && departmentNames.includes(row.college)) {
    const collegePrograms = (departments[row.college]?.programs || []).map(p => p.name);
    // Accept either the exact full Program name, or one of the old short
    // forms via LEGACY_PROGRAM_CODE_MAP — same bridge used in
    // StudentAccountProfileScreen.jsx.
    const resolvedProgram = collegePrograms.includes(row.program)
      ? row.program
      : (LEGACY_PROGRAM_CODE_MAP[row.program] && collegePrograms.includes(LEGACY_PROGRAM_CODE_MAP[row.program]))
        ? LEGACY_PROGRAM_CODE_MAP[row.program]
        : null;
    if (!resolvedProgram) errs.push(`Row ${r}: Program "${row.program}" is not valid for College "${row.college}"`);
    else row.program = resolvedProgram; // normalize in place
  }

  if (!row.yearSection) errs.push(`Row ${r}: Year & Section is required`);
  else if (YEAR_SECTIONS.length > 0 && !YEAR_SECTIONS.includes(row.yearSection)) errs.push(`Row ${r}: Year & Section must be one of: ${YEAR_SECTIONS.join(", ")}`);
  if (!row.sex) errs.push(`Row ${r}: Sex is required`);
  else if (SEX_OPTIONS.length > 0 && !SEX_OPTIONS.includes(row.sex)) errs.push(`Row ${r}: Sex must be "Male" or "Female"`);
  if (!row.age) errs.push(`Row ${r}: Age is required`);
  else { const n = Number(row.age); if (!Number.isInteger(n) || n < 1 || n > 100) errs.push(`Row ${r}: Age must be 1–100`); }
  if (!row.email) errs.push(`Row ${r}: Email is required`);
  return errs;
};

// ── Import Modal ───────────────────────────────────────────────────────────────
const ImportModal = ({ onClose, onImport, coordinatorColleges = [], departments = {} }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const checkFileType = (f) => {
    const valid = f.name.endsWith(".xlsx") || f.name.endsWith(".xls");
    if (!valid) { setFileError("That file type isn't supported. Use an .xlsx or .xls file."); return false; }
    if (f.size > 10 * 1024 * 1024) { setFileError("That file is over 10MB. Split it into smaller batches."); return false; }
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
      IMPORT_TEMPLATE_COLUMNS.forEach((expected, i) => { if (headerRow[i] !== expected) headerErrors.push(`Column ${i + 1}: expected "${expected}", found "${headerRow[i] || "(empty)"}"`); });
      if (headerErrors.length > 0) { setPreview({ valid: [], rowErrors: [], headerErrors }); setParsing(false); return; }
      const rowErrors = []; const valid = [];
      rows.slice(2).forEach((row, i) => {
        if (row.every(c => c === "" || c === null || c === undefined)) return;
        // Extra safety net: skip any row that still looks like the
        // template's own "e.g. ..." example row.
        if (String(row[0] ?? "").trim().toLowerCase().startsWith("e.g.")) return;
        const student = { studentId: String(row[0]||"").trim(), lastName: String(row[1]||"").trim(), middleInitial: String(row[2]||"").trim(), firstName: String(row[3]||"").trim(), college: String(row[4]||"").trim(), program: String(row[5]||"").trim(), major: String(row[6]||"").trim(), specialization: String(row[6]||"").trim(), yearSection: String(row[7]||"").trim(), sex: String(row[8]||"").trim(), age: String(row[9]||"").trim(), email: String(row[10]||"").trim(), password: "" };
        const errs = validateRow(student, i, coordinatorColleges, departments);
        if (errs.length > 0) rowErrors.push(...errs); else valid.push(student);
      });
      setPreview({ valid, rowErrors, headerErrors: [] });
    } catch (e) { setPreview({ valid: [], rowErrors: ["The file couldn't be read."], headerErrors: [] }); }
    setParsing(false);
  };

  const handleFile = (f) => { if (!f || !checkFileType(f)) return; setFile(f); parseFile(f); };
  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }, []);
  const clearFile = () => { setFile(null); setPreview(null); setFileError(""); };
  const handleImport = () => { if (!preview || preview.valid.length === 0) return; onImport(preview.valid); onClose(); };
  const canImport = preview && preview.valid.length > 0;

  const noticeBox = (borderColor, children) => (
    <div style={{ background: color.wine800, border: `1px solid ${borderColor}`, borderRadius: radius.card, padding: "12px 16px", marginBottom: space.sm }}>
      {children}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: space.md }}>
      <div className="sa-import-inner">
        <div className="sa-import-header">
          <h2 style={{ fontFamily: font.ui, fontSize: "clamp(1.125rem, 4vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: ink }}>Import students</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: lineSoft, border: `1px solid ${line}`, borderRadius: "50%", width: "30px", height: "30px", color: inkMuted, fontSize: "0.9rem", cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>

        <div className="sa-import-body">
          <div onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onClick={() => !file && fileRef.current.click()}
            style={{ border: `1px dashed ${dragging ? ink : color.wine400}`, borderRadius: radius.card, padding: file ? "16px 20px" : "32px 20px", textAlign: "center", background: dragging ? color.wine700 : color.wine800, cursor: file ? "default" : "pointer", transition: `all 180ms ${ease}` }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: font.ui, ...type.label, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                  <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                {parsing && <span style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, flexShrink: 0 }}>Reading…</span>}
                <button onClick={e => { e.stopPropagation(); clearFile(); }} aria-label="Remove file" style={{ background: "none", border: "none", color: inkMuted, cursor: "pointer", fontSize: "1rem", flexShrink: 0 }}>✕</button>
              </div>
            ) : (
              <>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={inkFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: space.sm }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, marginBottom: "4px" }}>Drop your Excel file here, or click to browse</p>
                <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted }}>.xlsx or .xls, up to 10MB</p>
              </>
            )}
          </div>

          {fileError && <p style={{ fontFamily: font.ui, ...type.helper, color: danger, marginTop: space.sm }}>{fileError}</p>}

          <div style={{ background: color.wine800, border: `1px solid ${line}`, borderRadius: radius.card, padding: "12px 16px", marginTop: space.md }}>
            <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: "4px" }}>Columns, in this order</p>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkBody, lineHeight: 1.7 }}>{IMPORT_TEMPLATE_COLUMNS.join(" · ")}</p>
          </div>

          <div style={{ marginTop: space.sm, display: "flex", justifyContent: "flex-start" }}>
            <button onClick={downloadTemplateXLSX} style={{ ...ghostBtn, padding: "8px 16px" }}>Download the template</button>
          </div>

          {preview && !parsing && (
            <div style={{ marginTop: space.md }}>
              {preview.headerErrors.length > 0 && noticeBox(danger, (
                <>
                  <p style={{ fontFamily: font.ui, ...type.label, color: danger, marginBottom: "6px" }}>The column headers don't match the template</p>
                  {preview.headerErrors.map((e, i) => <p key={i} style={{ fontFamily: font.ui, ...type.helper, color: inkBody, lineHeight: 1.6 }}>{e}</p>)}
                </>
              ))}
              {preview.rowErrors.length > 0 && preview.headerErrors.length === 0 && (
                <div style={{ background: color.wine800, border: `1px solid ${warning}`, borderRadius: radius.card, padding: "12px 16px", marginBottom: space.sm, maxHeight: "140px", overflowY: "auto" }}>
                  <p style={{ fontFamily: font.ui, ...type.label, color: warning, marginBottom: "6px" }}>
                    {preview.rowErrors.length} issue{preview.rowErrors.length !== 1 ? "s" : ""} found{preview.valid.length > 0 ? ` — the other ${preview.valid.length} row${preview.valid.length !== 1 ? "s" : ""} will still import` : ""}
                  </p>
                  {preview.rowErrors.map((e, i) => <p key={i} style={{ fontFamily: font.ui, ...type.helper, color: inkBody, lineHeight: 1.6 }}>{e}</p>)}
                </div>
              )}
              {preview.valid.length > 0 && preview.headerErrors.length === 0 && noticeBox(success, (
                <p style={{ fontFamily: font.ui, ...type.label, color: success }}>{preview.valid.length} student{preview.valid.length !== 1 ? "s" : ""} ready to import</p>
              ))}
              {preview.valid.length === 0 && preview.headerErrors.length === 0 && preview.rowErrors.length > 0 && noticeBox(danger, (
                <p style={{ fontFamily: font.ui, ...type.label, color: danger }}>No rows can be imported yet. Fix the issues above and upload again.</p>
              ))}
            </div>
          )}
        </div>

        <div className="sa-import-footer">
          <button onClick={() => fileRef.current.click()} style={ghostBtn}>Choose another file</button>
          <button onClick={handleImport} disabled={!canImport} style={{ ...primaryBtn, opacity: canImport ? 1 : 0.5, cursor: canImport ? "pointer" : "not-allowed" }}>
            Import{canImport ? ` ${preview.valid.length}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Filter Panel ───────────────────────────────────────────────────────────────
const FilterPanel = ({ filters, setFilters, filterRef, coordinatorColleges = [], departments = {}, departmentNames = [] }) => {
  const { isMobile, isTablet } = useBreakpoint();
  const [expandedCollege, setExpandedCollege] = useState(filters.college || "");
  // Scoped to the coordinator's own assigned department(s) — never the
  // full school-wide college list.
  const allColleges        = coordinatorColleges.length > 0 ? coordinatorColleges : departmentNames;
  const allPrograms        = expandedCollege ? (departments[expandedCollege]?.programs || []).map(p => p.name) : [];

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

  const base = {
    background: surface, border: `1px solid ${line}`, borderRadius: radius.card,
    boxShadow: shadow.panel, zIndex: 100, fontFamily: font.ui,
  };
  const panelStyle = (isMobile || isTablet)
    ? { ...base, position: "fixed", top: "84px", left: "12px", right: "12px", maxHeight: "70vh", overflowY: "auto" }
    : { ...base, position: "absolute", top: "48px", right: 0, width: "266px", overflow: "hidden" };

  const groupLabel = { fontFamily: font.ui, ...type.label, color: ink };
  const emptyNote  = { fontFamily: font.ui, ...type.helper, color: inkFaint };

  return (
    <div ref={filterRef} style={panelStyle}>
      <div style={{ padding: "12px 14px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm }}>
          <p style={groupLabel}>Sex</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {SEX_OPTIONS.length > 0 ? (
            SEX_OPTIONS.map(s => (<span key={s} onClick={() => toggleSex(s)} style={chip(filters.sex === s)}>{s}</span>))
          ) : (
            <span style={emptyNote}>No options available</span>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: `1px solid ${lineSoft}`, margin: "10px 0" }} />

      <div style={{ padding: "0 14px 12px" }}>
        <p style={{ ...groupLabel, marginBottom: space.sm }}>Section</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {sectionLetters.length > 0 ? (
            sectionLetters.map(s => (<span key={s} onClick={() => toggleSection(s)} style={chip(filters.section === s)}>{s}</span>))
          ) : (
            <span style={emptyNote}>No sections available</span>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: `1px solid ${lineSoft}`, margin: 0 }} />

      <div style={{ padding: "12px 14px 14px" }}>
        <p style={{ ...groupLabel, marginBottom: space.sm }}>
          Department
          {expandedCollege && <span style={{ fontWeight: 400, color: inkMuted, marginLeft: "6px", fontSize: "0.75rem" }}>{[expandedCollege, filters.program].filter(Boolean).join(" › ")}</span>}
        </p>
        {locationLevel === "college" && (
          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
            {allColleges.length > 0 ? (
              allColleges.map(col => (
                <div key={col} onClick={() => toggleCollege(col)}
                  style={{ padding: "7px 11px", borderRadius: "10px", fontFamily: font.ui, ...type.helper, color: inkBody, cursor: "pointer", background: color.wine800, border: `1px solid ${line}`, transition: `background 160ms ${ease}` }}
                  onMouseEnter={e => e.currentTarget.style.background = color.wine700}
                  onMouseLeave={e => e.currentTarget.style.background = color.wine800}
                >{col}</div>
              ))
            ) : (
              <span style={emptyNote}>No departments available</span>
            )}
          </div>
        )}
        {locationLevel === "program" && (
          <div>
            <div onClick={() => toggleCollege(expandedCollege)} style={{ display: "flex", alignItems: "center", gap: space.xs, cursor: "pointer", marginBottom: space.sm, color: inkMuted, fontFamily: font.ui, ...type.helper }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {expandedCollege}
            </div>
            <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {allPrograms.map(prog => (<span key={prog} onClick={() => toggleProgram(prog)} style={chip(filters.program === prog)}>{prog}</span>))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Student avatar ────────────────────────────────────────────────────────────
const StudentAvatar = ({ size = 34 }) => (
  <img src={userIcon} alt="" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
);

// ── Row overflow menu ─────────────────────────────────────────────────────────
const StudentRowMenu = ({ onView, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef();

  // Close the menu on any click/tap outside of it — not just when the
  // ⋮ button is pressed again. Using mousedown (not click) so it closes
  // before a click on the row underneath registers and opens the profile.
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const item = (label, onClick, isDanger) => (
    <button
      onClick={onClick}
      style={{ width: "100%", border: "none", background: surface, padding: "10px 14px", textAlign: "left", cursor: "pointer", fontFamily: font.ui, ...type.helper, color: isDanger ? danger : inkBody }}
      onMouseEnter={e => e.currentTarget.style.background = color.wine800}
      onMouseLeave={e => e.currentTarget.style.background = surface}
    >
      {label}
    </button>
  );

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }} aria-label="More actions" style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", color: inkMuted, fontSize: "1.1rem", lineHeight: 1 }}>⋮</button>
      {showMenu && (
        <div style={{ position: "absolute", top: "28px", right: 0, background: surface, border: `1px solid ${line}`, borderRadius: radius.card, boxShadow: shadow.panel, zIndex: 100, minWidth: "110px", overflow: "hidden" }}>
          {item("View", (e) => { e.stopPropagation(); onView(); setShowMenu(false); })}
          <div style={{ height: "1px", background: lineSoft }} />
          {item("Delete", (e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }, true)}
        </div>
      )}
    </div>
  );
};

// ── Checkbox ──────────────────────────────────────────────────────────────────
const Checkbox = ({ checked, onClick }) => (
  <div
    onClick={onClick}
    style={{ width: "18px", height: "18px", border: `1.5px solid ${checked ? ink : color.wine400}`, borderRadius: "5px", background: checked ? ink : color.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
  >
    {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
  </div>
);

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

// ── Student Row ───────────────────────────────────────────────────────────────
// Full-width row, matching the Student List screen: avatar + name on top, a
// single meta line under it, then the badge/action cluster on the right. Rows
// rather than a card grid because bulk-select is the core workflow here — the
// checkboxes stack into one vertical column, so a ticked set reads at a glance.
// The email lives in the row's tooltip instead of the meta line: it's the one
// field long enough to break the alignment everything else depends on.
const StudentRow = ({ student: s, selectMode, isSelected, onToggleSelect, onView, onDelete }) => {
  const meta = [s.studentId, s.program, s.yearSection, s.sex].filter(Boolean).join(" · ");

  return (
    <div
      className="sa-row"
      onClick={() => onView(s)}
      style={{ borderColor: isSelected ? ink : undefined }}
    >
      {selectMode && (
        <div onClick={(e) => { e.stopPropagation(); onToggleSelect(s.id); }}>
          <Checkbox checked={isSelected} />
        </div>
      )}

      <StudentAvatar size={38} />

      <div className="sa-row-main">
        <h3 style={{
          fontFamily: font.ui, fontSize: "1rem", fontWeight: 600,
          letterSpacing: "-0.01em", color: ink, lineHeight: 1.35,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {s.firstName} {s.middleInitial ? s.middleInitial + " " : ""}{s.lastName}
          {isRealSuffix(s.suffix) ? ` ${s.suffix}` : ""}
        </h3>
        <p
          title={s.email}
          style={{
            fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: "2px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {meta || "—"}
        </p>
      </div>

      <div className="sa-row-actions">
        {s.yearSection && (
          <span className="sa-row-badge" style={{
            background: color.wine800, border: `1px solid ${line}`, color: inkMuted,
            borderRadius: radius.pill, padding: "3px 11px",
            fontFamily: font.ui, fontSize: "0.75rem", whiteSpace: "nowrap",
          }}>
            {s.yearSection}
          </span>
        )}
        <span
          className="sa-row-view"
          onClick={(e) => { e.stopPropagation(); onView(s); }}
          style={{ fontFamily: font.ui, ...type.helper, fontWeight: 500, color: ink, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          View
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <StudentRowMenu onView={() => onView(s)} onDelete={() => onDelete(s.id)} />
        </div>
      </div>
    </div>
  );
};

// ── Confirm / notice dialog ───────────────────────────────────────────────────
const Dialog = ({ title, body, children }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: space.md }}>
    <div style={{ background: surface, border: `1px solid ${line}`, borderRadius: radius.panel, padding: `${space.xl} ${space.lg}`, width: "100%", maxWidth: "360px", boxShadow: shadow.panel, textAlign: "center" }}>
      <p style={{ fontFamily: font.ui, fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, marginBottom: body ? space.sm : space.lg }}>{title}</p>
      {body && <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, marginBottom: space.lg }}>{body}</p>}
      <div style={{ display: "flex", gap: space.sm, justifyContent: "center", flexWrap: "wrap" }}>{children}</div>
    </div>
  </div>
);

// ── Main Screen ────────────────────────────────────────────────────────────────
// Props:
//   coordinatorUid      — logged-in coordinator's Firebase UID
//   coordinatorColleges — array of college names derived from the
//                         coordinator's deptSelections — a coordinator can be
//                         assigned to more than one department. All
//                         coordinators of the same college see the same
//                         students, regardless of program/major.
//                         NOTE: this is normalized below (see
//                         normalizedCoordinatorColleges) to tolerate the
//                         parent still passing legacy short codes ("CCS")
//                         instead of the full name — students/companies/
//                         coordinators/posts all key on the full name now.
const CoordinatorStudentsAcccountScreen = ({ coordinatorUid, coordinatorColleges }) => {
  const { departments, departmentNames } = useDepartmentsPrograms();

  // coordinatorColleges may arrive as either full names (canonical) or
  // legacy short codes, depending on what the parent screen currently
  // computes from the coordinator's deptSelections. Normalize once here so
  // the Firestore query below, and every comparison against a student's own
  // `college` (always a full name — see StudentAccountProfileScreen.jsx and
  // handleCreate below), is on the same footing. Without this, a parent
  // still passing codes would make the query below match ZERO students.
  const abbrToFullName = React.useMemo(() => {
    const map = {};
    departmentNames.forEach(name => { if (departments[name]?.abbr) map[departments[name].abbr] = name; });
    return map;
  }, [departments, departmentNames]);
  const normalizedCoordinatorColleges = React.useMemo(
    () => (coordinatorColleges || []).map(c => abbrToFullName[c] || c),
    [coordinatorColleges, abbrToFullName]
  );

  const [students, setStudents]                 = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [selected, setSelected]                 = useState(new Set());
  const [selectMode, setSelectMode]             = useState(false);
  const [confirmDeleteInfo, setConfirmDeleteInfo] = useState(null); // { type: "single" | "selected", id?, count? }
  const [confirmExport, setConfirmExport]         = useState(false);
  const [exportEmptyWarning, setExportEmptyWarning] = useState(false);
  const [search, setSearch]                     = useState("");
  const [showNewModal, setShowNewModal]         = useState(false);
  const [showImportModal, setShowImportModal]   = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [viewingStudent, setViewingStudent]     = useState(null);
  const [successInfo, setSuccessInfo]           = useState(null); // { fullName, password }
  const [filters, setFilters]                   = useState({ college: "", program: "", sex: "", section: "" });
  const filterRef = useRef(null);

  // ── Real-time listener: ALL students in this coordinator's department(s) ──
  // Same scope as the Student List screen — every coordinator assigned to a
  // given college (e.g. all of CED) manages the same pool of student
  // accounts, regardless of which coordinator originally created them.
  useEffect(() => {
    if (!coordinatorUid || normalizedCoordinatorColleges.length === 0) {
      setStudents([]); setLoading(false); return;
    }
    const q = query(
      collection(db, "students"),
      where("college", "in", normalizedCoordinatorColleges)
    );
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(mapStudentDoc));
      setLoading(false);
    });
    return () => unsub();
  }, [coordinatorUid, normalizedCoordinatorColleges]);

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
  const enterSelectMode = () => setSelectMode(true);
  const exitSelectMode  = () => { setSelectMode(false); setSelected(new Set()); };

  // ── Create — calls AuthService then shows success modal ───────────────────
  const handleCreate = async (form) => {
    // collegeAbbr: only used by generateStudentPassword for a short password
    // suffix (e.g. ".ccs") — form.college itself (the full name) is what
    // actually gets saved to the student's Firestore doc, matching the
    // full-name convention used everywhere else in the app.
    const { password } = await createStudentAccount({ ...form, collegeAbbr: departments[form.college]?.abbr || form.college }, coordinatorUid);
    const fullName = `${form.firstName} ${form.middleInitial ? form.middleInitial + ". " : ""}${form.lastName}`;
    logActivity(coordinatorUid, "student_created", `Created student account for ${fullName}`, { targetId: form.studentId, targetName: fullName }).catch(err => console.error("Failed to log activity:", err));
    setShowNewModal(false);
    setSuccessInfo({
      fullName,
      studentId: form.studentId,
      email:     form.email,
      password,
    });
    // onSnapshot will auto-update the list
  };

  // ── Save (edit) — updates Firestore doc ───────────────────────────────────
  const handleSave = async (form) => {
    const fullName = `${form.firstName} ${form.middleInitial ? form.middleInitial + ". " : ""}${form.lastName}${isRealSuffix(form.suffix) ? " " + form.suffix : ""}`;
    await updateDoc(doc(db, "students", viewingStudent.id), {
      ...form,
      fullName,
      updatedAt: serverTimestamp(),
    });
    logActivity(coordinatorUid, "student_edited", `Edited student account for ${fullName}`, { targetId: viewingStudent.id, targetName: fullName }).catch(err => console.error("Failed to log activity:", err));
    setViewingStudent(null);
  };

  // ── Delete single ─────────────────────────────────────────────────────────
  const handleDelete = (id) => {
    setTimeout(() => setConfirmDeleteInfo({ type: "single", id }), 0);
  };

  // ── Delete selected ───────────────────────────────────────────────────────
  const handleDeleteSelected = () => {
    setConfirmDeleteInfo({ type: "selected", count: selected.size });
  };

  // ── Runs the actual deletion once confirmed in the modal ────────────────────
  const confirmDelete = async () => {
    if (!confirmDeleteInfo) return;
    if (confirmDeleteInfo.type === "single") {
      const id = confirmDeleteInfo.id;
      const target = students.find(s => s.id === id);
      await deleteDoc(doc(db, "students", id));
      logActivity(coordinatorUid, "student_deleted", `Deleted student account for ${target?.fullName || target?.studentId || id}`, { targetId: id, targetName: target?.fullName || "" }).catch(err => console.error("Failed to log activity:", err));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      const count = selected.size;
      await Promise.all([...selected].map(id => deleteDoc(doc(db, "students", id))));
      logActivity(coordinatorUid, "student_deleted_bulk", `Deleted ${count} student account(s)`, { targetCount: count }).catch(err => console.error("Failed to log activity:", err));
      setSelected(new Set());
    }
    setConfirmDeleteInfo(null);
  };

  // ── Import — batch creates via AuthService ────────────────────────────────
  const handleImport = async (newStudents) => {
    let successCount = 0;
    // Fire in sequence to avoid hammering Firebase Auth rate limits
    for (const s of newStudents) {
      try {
        // s.college is already normalized to the full name by validateRow —
        // collegeAbbr here is only for the password suffix, same as handleCreate.
        await createStudentAccount({ ...s, collegeAbbr: departments[s.college]?.abbr || s.college }, coordinatorUid);
        successCount++;
      } catch (err) {
        console.warn(`Skipped ${s.studentId}:`, err.message);
      }
    }
    if (successCount > 0) {
      logActivity(coordinatorUid, "student_imported_bulk", `Imported ${successCount} student account(s)`, { targetCount: successCount }).catch(err => console.error("Failed to log activity:", err));
    }
    // onSnapshot auto-updates the list
  };

  const handleExport = () => {
    if (selected.size === 0) { setExportEmptyWarning(true); return; }
    setConfirmExport(true);
  };

  const doExport = () => {
    const studentsToExport = students.filter(s => selected.has(s.id));
    exportToXLSX(studentsToExport.map(s => ({
      studentId: s.studentId, firstName: s.firstName,
      middleInitial: s.middleInitial, lastName: s.lastName, college: s.college,
    })), departments);
    setConfirmExport(false);
  };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: page }}>
        <p style={{ fontFamily: font.ui, ...type.body, color: inkFaint }}>Loading students…</p>
      </div>
    );
  }

  return (
    <>
      <ResponsiveStyles />
      <div className="sa-list-wrapper">

        {/* Header bar — same floating dark panel as Find Company */}
        <div className="sa-search-bar">
          <div style={{ minWidth: 0 }}>
            <span style={{ fontFamily: font.ui, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel }}>Student accounts</span>
            <p style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, marginTop: "2px" }}>
              {filtered.length} of {students.length} in your departments
            </p>
          </div>

          <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: space.sm, background: color.white, borderRadius: radius.pill, padding: "9px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
                className="sa-search-input"
                style={{ border: "none", background: "transparent", outline: "none", color: ink, fontFamily: font.ui, ...type.control }}
              />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search" style={{ background: "none", border: "none", color: inkMuted, cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>}
            </div>
            <div style={{ position: "relative", marginLeft: "10px" }}>
              <div
                onClick={() => setShowFilterDrawer(v => !v)}
                title="Filters"
                style={{ width: "40px", height: "40px", background: hasFilter ? color.goldTint : color.white, borderRadius: radius.pill, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `1px solid ${color.onWineFaint}` : "none" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? onPanel : inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              </div>
              {showFilterDrawer && <FilterPanel filters={filters} setFilters={setFilters} filterRef={filterRef} coordinatorColleges={normalizedCoordinatorColleges} departments={departments} departmentNames={departmentNames} />}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="sa-toolbar">
          <div className="sa-toolbar-group">
            {!selectMode ? (
              <button onClick={enterSelectMode} style={ghostBtn}>Select</button>
            ) : (
              <>
                <div onClick={toggleAll} style={{ display: "flex", alignItems: "center", gap: space.sm, cursor: "pointer", padding: "9px 16px", background: surface, border: `1px solid ${line}`, borderRadius: radius.pill }}>
                  <Checkbox checked={allSelected} />
                  <span style={{ fontFamily: font.ui, ...type.control, color: inkBody }}>Select all</span>
                </div>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selected.size === 0}
                  style={{ ...ghostBtn, color: danger, borderColor: selected.size === 0 ? line : danger, opacity: selected.size === 0 ? 0.5 : 1, cursor: selected.size === 0 ? "default" : "pointer" }}
                >
                  {allSelected && selected.size > 0 ? "Delete all" : `Delete${selected.size > 0 ? ` (${selected.size})` : ""}`}
                </button>
                <button onClick={exitSelectMode} style={{ background: "none", border: "none", fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", textDecoration: "underline" }}>Cancel</button>
              </>
            )}
          </div>
          <div className="sa-toolbar-group">
            <button onClick={handleExport} style={ghostBtn}>Export</button>
            <button onClick={() => setShowImportModal(true)} style={ghostBtn}>Import</button>
            <button onClick={() => setShowNewModal(true)} style={primaryBtn}>New student</button>
          </div>
        </div>

        {/* Active filter chips */}
        {hasFilter && (
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.md, flexWrap: "wrap" }}>
            {[
              filters.sex     && { label: filters.sex,          clear: () => setFilters(prev => ({ ...prev, sex: "" })) },
              filters.section && { label: `4-${filters.section}`, clear: () => setFilters(prev => ({ ...prev, section: "" })) },
              filters.college && { label: [filters.college, filters.program].filter(Boolean).join(" › "), clear: () => setFilters(prev => ({ ...prev, college: "", program: "" })) },
            ].filter(Boolean).map(({ label, clear }) => (
              <span key={label} style={{ background: surface, color: inkBody, border: `1px solid ${line}`, borderRadius: radius.pill, padding: "4px 12px", fontFamily: font.ui, ...type.helper, display: "flex", alignItems: "center", gap: "6px" }}>
                {label}<span onClick={clear} style={{ cursor: "pointer", color: inkMuted }}>✕</span>
              </span>
            ))}
            <span onClick={() => setFilters({ college: "", program: "", sex: "", section: "" })} style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", textDecoration: "underline" }}>Clear all</span>
          </div>
        )}

        {/* Student list */}
        {filtered.length > 0 ? (
          <>
            <div className="sa-student-list">
              {filtered.map(s => (
                <StudentRow
                  key={s.id}
                  student={s}
                  selectMode={selectMode}
                  isSelected={selected.has(s.id)}
                  onToggleSelect={toggleSelect}
                  onView={setViewingStudent}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            <p style={{ textAlign: "center", fontFamily: font.ui, ...type.helper, color: inkFaint, padding: "20px 0 4px" }}>
              Showing {filtered.length} of {students.length} student{students.length !== 1 ? "s" : ""}
            </p>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "72px 24px", gap: space.xs, background: surface, border: `1px dashed ${color.wine400}`, borderRadius: radius.panel }}>
            {students.length === 0 ? (
              <>
                <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink }}>No student accounts yet</p>
                <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "44ch" }}>Add students one at a time, or import a whole section from a spreadsheet.</p>
                <div style={{ display: "flex", gap: space.sm, marginTop: space.sm, flexWrap: "wrap", justifyContent: "center" }}>
                  <button onClick={() => setShowNewModal(true)} style={primaryBtn}>New student</button>
                  <button onClick={() => setShowImportModal(true)} style={ghostBtn}>Import</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink }}>No students match this search</p>
                <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "44ch" }}>Try a different name, ID, or email, or clear a filter to widen the results.</p>
              </>
            )}
          </div>
        )}
      </div>

      {showNewModal    && <StudentForm coordinatorColleges={normalizedCoordinatorColleges} departments={departments} onClose={() => setShowNewModal(false)} onSubmit={handleCreate} submitLabel="Create account" />}
      {viewingStudent  && <StudentForm initial={viewingStudent} readOnly coordinatorColleges={normalizedCoordinatorColleges} departments={departments} onClose={() => setViewingStudent(null)} onSubmit={handleSave} />}
      {showImportModal && <ImportModal coordinatorColleges={normalizedCoordinatorColleges} departments={departments} onClose={() => setShowImportModal(false)} onImport={handleImport} />}

      {/* ── Nothing selected for export ── */}
      {exportEmptyWarning && (
        <Dialog title="Select the students to export first" body="Tap Select, tick the students you need, then choose Export.">
          <button onClick={() => setExportEmptyWarning(false)} style={primaryBtn}>OK</button>
        </Dialog>
      )}

      {/* ── Export confirmation ── */}
      {confirmExport && (
        <Dialog
          title={`Export ${selected.size} student${selected.size !== 1 ? "s" : ""}?`}
          body="The file includes each student's ID, full name, and default password."
        >
          <button onClick={() => setConfirmExport(false)} style={ghostBtn}>Cancel</button>
          <button onClick={doExport} style={primaryBtn}>Export</button>
        </Dialog>
      )}

      {/* ── Delete confirmation (replaces window.confirm) ── */}
      {confirmDeleteInfo && (
        <Dialog
          title={confirmDeleteInfo.type === "single" ? "Delete this student account?" : `Delete ${confirmDeleteInfo.count} student account${confirmDeleteInfo.count !== 1 ? "s" : ""}?`}
          body="This can't be undone."
        >
          <button onClick={() => setConfirmDeleteInfo(null)} style={ghostBtn}>Cancel</button>
          <button onClick={confirmDelete} style={{ ...primaryBtn, background: danger }}>Delete</button>
        </Dialog>
      )}

      {/* ── Success after creating a student ── */}
      {successInfo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: space.md }}>
          <div style={{ background: surface, border: `1px solid ${line}`, borderRadius: radius.panel, padding: `${space.xl} ${space.lg}`, width: "100%", maxWidth: "380px", boxShadow: shadow.panel, textAlign: "center" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: lineSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: `0 auto ${space.md}` }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ fontFamily: font.ui, fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, marginBottom: space.xs }}>Account created</p>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginBottom: space.md }}>Share these details with the student.</p>
            <div style={{ background: color.wine800, border: `1px solid ${line}`, borderRadius: radius.card, padding: "14px 16px", textAlign: "left", marginBottom: space.md }}>
              {[["Student ID", successInfo.studentId], ["Full name", successInfo.fullName], ["Email", successInfo.email], ["Password", successInfo.password]].map(([label, val]) => (
                <div key={label} style={{ marginBottom: space.sm }}>
                  <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted }}>{label}</p>
                  <p style={{ fontFamily: font.ui, ...type.label, color: ink, wordBreak: "break-all" }}>{val}</p>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginBottom: space.md }}>Remind them to change the password after signing in.</p>
            <div style={{ display: "flex", gap: space.sm, justifyContent: "center" }}>
              <button onClick={() => { setSuccessInfo(null); setShowNewModal(true); }} style={ghostBtn}>Add another</button>
              <button onClick={() => setSuccessInfo(null)} style={primaryBtn}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CoordinatorStudentsAcccountScreen;