import React, { useState, useRef, useCallback, useEffect } from "react";
import XLSX from "xlsx-js-style";
import JSZip from "jszip";
import blackUserIcon from "../icons/blackuser.png";

// Firebase
import { db }                          from "./firebase";
import { createStudentAccount, generateStudentPassword, logActivity, updateStudentAccountByCoordinator } from "./AuthService";
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
// stronger border for buttons & pills (the plain `line` is too faint on them)
const lineStrong = "#7A7A7A";
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

// For the bulk import: a spreadsheet cell is free text, so "jr", "JR." and "iii"
// are accepted and turned into the exact option the New Student form offers
// ("Jr.", "III"). Blank / "None" / "N/A" mean no suffix → "". Anything else is
// not a suffix → null, so the row can be reported instead of saved as typed.
const normalizeSuffix = (v) => {
  const raw = String(v ?? "").trim();
  if (!isRealSuffix(raw)) return "";
  const key = raw.replace(/\.$/, "").toLowerCase();
  return SUFFIX_OPTIONS.find(o => o.replace(/\.$/, "").toLowerCase() === key) || null;
};

const EXCEL_COLUMNS = [
  "Student ID", "Full Name", "Default Password"
];

// Columns for the bulk-IMPORT template — separate from EXCEL_COLUMNS above,
// which is only for the 3-column credentials export. Order must match the
// columns read in ImportModal.parseFile below (by position, in this order).
// Only what the school's class list already has. Everything else — email,
// program (when the department offers more than one), and age — the
// student fills in themselves on first login, in the Edit personal
// information form that opens before the dashboard. The downloadable
// template, the header check, and the "Columns, in this order" hint are all
// derived from this list.
// Suffix sits after Middle Name, same order as the New Student form, and is
// optional per row. Templates downloaded before it existed (no Suffix column)
// are still accepted — see LEGACY_IMPORT_COLUMNS in parseFile.
const IMPORT_TEMPLATE_COLUMNS = [
  "Student ID", "Last Name", "First Name", "Middle Name", "Suffix", "Department", "Sex",
];
const LEGACY_IMPORT_COLUMNS = IMPORT_TEMPLATE_COLUMNS.filter(c => c !== "Suffix");

// ── Batch + archive ──────────────────────────────────────────────────────────
// `batch` is the student's ACADEMIC YEAR ("2026-2027") and is NOT the same as
// yearSection ("4-A"). Older student docs predate the field, so a missing batch
// groups under "No batch set" instead of hiding the student.
// Archiving is a status change only: isArchived + archivedAt are written, and
// nothing (doc, Auth account, applications, messages) is ever deleted.
const BATCH_NONE = "__none__";
const batchKeyOf   = (s) => { const b = String(s?.batch || "").trim(); return b || BATCH_NONE; };
const batchLabelOf = (key) => (key === BATCH_NONE ? "No batch set" : `Batch ${key}`);
const isArchivedStudent = (s) => s?.isArchived === true;   // missing field = active
// Accepts "2026-2027", "2026 - 2027", "2026-27" and a bare "2026", and returns
// the canonical "2026-2027". Anything else (including a section like "4-A")
// returns "" so it can be reported as invalid.
const normalizeBatch = (value) => {
  const raw = String(value || "").replace(/[\s\u2013\u2014]/g, (m) => (m === "\u2013" || m === "\u2014" ? "-" : ""));
  const inRange = (y) => y >= 1990 && y <= 2100;

  const single = raw.match(/^(\d{4})$/);
  if (single) {
    const start = Number(single[1]);
    return inRange(start) ? `${start}-${start + 1}` : "";
  }
  const span = raw.match(/^(\d{4})-(\d{2}|\d{4})$/);
  if (span) {
    const start = Number(span[1]);
    const end = span[2].length === 2
      ? Number(String(start).slice(0, 2) + span[2])   // "2026-27" → 2027
      : Number(span[2]);
    // One school year only: the end must be the year right after the start.
    if (inRange(start) && end === start + 1) return `${start}-${end}`;
  }
  return "";
};
const isValidBatch = (v) => normalizeBatch(v) !== "";
const batchStartYear = (key) => Number(String(key).split("-")[0]) || 0;

// Newest batch first; "No batch set" always last.
const sortBatchKeys = (keys) => [...keys].sort((a, b) => {
  if (a === BATCH_NONE) return 1;
  if (b === BATCH_NONE) return -1;
  return batchStartYear(b) - batchStartYear(a);
});

// "m", "MALE", "Female", "f" → "Male" / "Female"; anything else → "".
const normalizeSex = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "m" || raw === "male") return "Male";
  if (raw === "f" || raw === "female") return "Female";
  return "";
};

// "Santos" → "S."; blank stays blank. The rest of the app (profile form,
// fullName, exports) works with a middle initial, so it's derived here.
const toMiddleInitial = (middleName) => {
  const first = String(middleName || "").trim().charAt(0);
  return first ? `${first.toUpperCase()}.` : "";
};

// Accepts "4-A", "4A", "4 - A", or a bare "A" (the only year is 4th year) and
// returns the canonical "4-A" form used everywhere else, or "" if it doesn't
// match a known section.
const normalizeSection = (value) => {
  const raw = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  const direct = raw.includes("-") ? raw : (/^\d[A-Z]$/.test(raw) ? `${raw[0]}-${raw[1]}` : raw);
  if (YEAR_SECTIONS.includes(direct)) return direct;
  if (/^[A-Z]$/.test(raw)) {
    const match = YEAR_SECTIONS.find(sec => sec.split("-")[1] === raw);
    if (match) return match;
  }
  return "";
};

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
      flex-wrap: nowrap;
    }
    @media (max-width: 480px) {
      .sa-search-bar { padding: 14px; gap: 10px; }
    }

    .sa-search-input { width: 170px; }
    .sa-search-input::placeholder { color: ${inkFaint}; }
    .sa-search-input:focus,
    .sa-search-input:focus-visible {
      outline: none;
      box-shadow: none;
      -webkit-box-shadow: none;
    }
    @media (max-width: 480px) {
      .sa-search-input { width: 90px; }
    }
    @media (max-width: 380px) {
      .sa-search-input { width: 62px; }
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
      border-color: ${color.hoverBorder};
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
  background: on ? panel : color.wine800,
  color: on ? onPanel : inkBody,
  border: `1px solid ${on ? panel : line}`,
  transition: `all 160ms ${ease}`,
});

const primaryBtn = {
  padding: "9px 20px", borderRadius: radius.pill, background: panel, color: onPanel,
  border: "none", fontFamily: font.ui, ...type.control, cursor: "pointer",
};
const ghostBtn = {
  padding: "9px 20px", borderRadius: radius.pill, background: surface, color: inkBody,
  border: `1.5px solid ${lineStrong}`, fontFamily: font.ui, ...type.control, cursor: "pointer",
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
  batch: (v) => {
    if (!v) return "Required";
    if (!isValidBatch(v)) return "Academic year, e.g. 2026-2027";
    return "";
  },
  middleName: (v) => {
    if (!v) return "";
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
      "e.g. 201112345", "e.g. Dela Cruz", "e.g. Juan", "e.g. Santos (or blank)",
      "e.g. Jr. (or blank)", "e.g. CCS", "e.g. Male",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 15 }, { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 38 }, { wch: 12 },
  ];
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
  ws["!ref"] = `A1:${XLSX.utils.encode_col(IMPORT_TEMPLATE_COLUMNS.length - 1)}200`;
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Student Template");

  // Sex is a dropdown in the sheet, so the coordinator picks Male or Female
  // instead of typing it. xlsx-js-style cannot write data validation, so the
  // workbook is generated first and the <dataValidations> element is injected
  // into the sheet XML — the same markup Excel writes for a list validation.
  const sexCol = XLSX.utils.encode_col(IMPORT_TEMPLATE_COLUMNS.indexOf("Sex"));
  const suffixCol = XLSX.utils.encode_col(IMPORT_TEMPLATE_COLUMNS.indexOf("Suffix"));
  const dataValidation =
    '<dataValidations count="2">' +
      '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" ' +
      'errorTitle="Invalid sex" error="Choose Male or Female from the list." ' +
      'promptTitle="Sex" prompt="Choose Male or Female." ' +
      `sqref="${sexCol}3:${sexCol}200">` +
        '<formula1>"Male,Female"</formula1>' +
      '</dataValidation>' +
      // Suffix: the same options as the New Student form's dropdown; blank is fine.
      '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" ' +
      'errorTitle="Invalid suffix" error="Choose a suffix from the list, or leave it blank." ' +
      'promptTitle="Suffix" prompt="Optional. Jr., Sr., II, III … or leave blank." ' +
      `sqref="${suffixCol}3:${suffixCol}200">` +
        `<formula1>"${SUFFIX_OPTIONS.join(",")}"</formula1>` +
      '</dataValidation>' +
    '</dataValidations>';

  (async () => {
    try {
      const rawFile = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const zip = await JSZip.loadAsync(rawFile);
      const sheetPath = "xl/worksheets/sheet1.xml";
      let xml = await zip.file(sheetPath).async("string");
      // <dataValidations> has a FIXED slot in the sheet XML: after sheetData,
      // and before hyperlinks / printOptions / pageMargins / pageSetup /
      // headerFooter / ... / ignoredErrors / drawing / tableParts. Excel is
      // strict about that order and answers an out-of-order element with "We
      // found a problem with some content ... recover?". xlsx-js-style writes
      // NO <pageMargins> but DOES write <ignoredErrors>, so the old
      // "append before </worksheet>" fallback put it AFTER <ignoredErrors> --
      // which is exactly what produced that error. Insert it before whichever
      // later element comes first instead.
      const AFTER_DATA_VALIDATIONS = [
        "hyperlinks", "printOptions", "pageMargins", "pageSetup", "headerFooter",
        "rowBreaks", "colBreaks", "customProperties", "cellWatches", "ignoredErrors",
        "smartTags", "drawing", "legacyDrawing", "legacyDrawingHF", "drawingHF",
        "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst",
      ];
      const later = AFTER_DATA_VALIDATIONS.map(tag => xml.indexOf(`<${tag}`)).filter(i => i !== -1);
      const insertAt = later.length ? Math.min(...later) : xml.lastIndexOf("</worksheet>");
      xml = xml.slice(0, insertAt) + dataValidation + xml.slice(insertAt);
      zip.file(sheetPath, xml);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "student_import_template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // Never leave the coordinator without a template.
      console.error("Failed to add the Sex dropdown to the template:", err);
      XLSX.writeFile(wb, "student_import_template.xlsx");
    }
  })();
};

// ── CustomSelect ──────────────────────────────────────────────────────────────
// Drop-in replacement for a native <select> whose option list is drawn by us
// instead of the browser/OS. The native list (the big grey box that spilled
// past the modal) can't be styled or kept inside a container; this one:
//   • looks like the dropdown in the student "Apply Now" modal — white card,
//     12px corners, soft shadow, roomy rows, hover + selected tints;
//   • stays INSIDE the container it's in (modal body, card, page): it opens
//     downward or upward, whichever side has more room inside the nearest
//     clipping/scrolling ancestor, and caps its height to that room, so it
//     never overlaps past the container's edge;
//   • keeps the trigger looking exactly like the field it replaces — pass the
//     old <select>'s style as `triggerStyle`.
//
// Props:
//   value, onChange(value)  — same as a controlled <select> (string values)
//   options                 — strings, or { value, label } objects
//   placeholder             — text shown when nothing is picked; also listed
//                             as the first row so the choice can be cleared
//   showPlaceholderOption   — set false to leave that first row out
//   disabled, hasError      — hasError swaps the border to `errorColor`
//   triggerStyle            — style for the closed field (the old select's)
//   ariaLabel               — accessible name when there's no <label>

const CS_MAX_LIST_HEIGHT = 240;
const CS_MIN_LIST_HEIGHT = 96;
const CS_EDGE_GAP        = 8;

const csNormalize = (o) =>
  o !== null && typeof o === "object"
    ? { value: String(o.value ?? ""), label: String(o.label ?? o.value ?? "") }
    : { value: String(o ?? ""), label: String(o ?? "") };

// Nearest ancestor that clips its content (a scrolling modal body, a card
// with overflow hidden…). The list has to fit inside it.
const csFindClipParent = (el) => {
  for (let p = el?.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden" || oy === "clip") return p;
  }
  return null;
};

function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  showPlaceholderOption = true,
  disabled = false,
  hasError = false,
  errorColor = color.danger,
  triggerStyle = {},
  ariaLabel,
}) {
  const [open, setOpen]         = useState(false);
  const [openUp, setOpenUp]     = useState(false);
  const [maxHeight, setMaxH]    = useState(CS_MAX_LIST_HEIGHT);
  const [active, setActive]     = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const items = [
    ...(showPlaceholderOption ? [{ value: "", label: placeholder, isPlaceholder: true }] : []),
    ...options.map(csNormalize),
  ];
  const current  = String(value ?? "");
  const selected = items.find(i => !i.isPlaceholder && i.value === current);

  // Close on any press outside the field + list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // When it opens: pick the side with more room inside the container, cap the
  // height to that room, and bring the current choice into view.
  React.useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect   = wrapRef.current.getBoundingClientRect();
    const clip   = csFindClipParent(wrapRef.current);
    const bounds = clip ? clip.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const top    = Math.max(bounds.top, 0);
    const bottom = Math.min(bounds.bottom, window.innerHeight);
    const below  = bottom - rect.bottom - CS_EDGE_GAP;
    const above  = rect.top - top - CS_EDGE_GAP;
    const wanted = Math.min(CS_MAX_LIST_HEIGHT, items.length * 36 + 8);
    const up     = below < wanted && above > below;
    setOpenUp(up);
    setMaxH(Math.max(CS_MIN_LIST_HEIGHT, Math.min(CS_MAX_LIST_HEIGHT, up ? above : below)));
    const idx = items.findIndex(i => i.value === current);
    setActive(idx >= 0 ? idx : 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the keyboard-highlighted row visible while arrowing through.
  useEffect(() => {
    if (!open || active < 0 || !listRef.current) return;
    listRef.current.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (item) => {
    onChange?.(item.value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Escape") { if (open) { e.stopPropagation(); setOpen(false); } return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive(a => {
        const n = items.length;
        return e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n;
      });
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && open && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    }
  };

  const baseTrigger = {
    width: "100%",
    textAlign: "left",
    cursor: disabled ? "not-allowed" : "pointer",
    outline: "none",
    boxSizing: "border-box",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    // leave room for the caret on the right
    paddingRight: "32px",
  };
  const merged = { ...baseTrigger, ...triggerStyle };
  if (!merged.paddingRight || parseInt(merged.paddingRight, 10) < 28) merged.paddingRight = "32px";
  if (hasError) merged.borderColor = errorColor;
  if (!selected) merged.color = color.inkFaint;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onKeyDown}
        style={merged}
      >
        {selected ? selected.label : placeholder}
      </button>

      <span
        aria-hidden="true"
        style={{
          position: "absolute", right: "12px", top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: "transform 160ms ease",
          pointerEvents: "none", display: "flex",
          color: disabled ? color.inkFaint : color.inkMuted,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
      </span>

      {open && !disabled && (
        <div
          ref={listRef}
          role="listbox"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            [openUp ? "bottom" : "top"]: "calc(100% + 4px)",
            background: color.white,
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            zIndex: 2000,
            padding: "4px 0",
          }}
        >
          {items.map((item, i) => {
            const isSel = !item.isPlaceholder && item.value === current;
            const bg = i === active ? color.hoverWash : isSel ? color.wine800 : color.white;
            return (
              <div
                key={`${item.value}-${i}`}
                role="option"
                aria-selected={isSel}
                onMouseDown={(e) => e.preventDefault()}   // keep focus on the field
                onClick={() => choose(item)}
                onMouseEnter={() => setActive(i)}
                style={{
                  padding: "8px 14px",
                  fontFamily: font.ui,
                  fontSize: "0.82rem",
                  lineHeight: 1.4,
                  cursor: "pointer",
                  background: bg,
                  color: item.isPlaceholder ? color.inkFaint : color.ink,
                  fontWeight: isSel ? 600 : 400,
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                }}
              >
                {item.label}
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ padding: "10px 14px", fontFamily: font.ui, fontSize: "0.8rem", color: color.inkFaint }}>
              No options
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// Custom dropdown (CustomSelect above): same look as the student Apply Now
// modal's dropdown, and its list stays inside the modal instead of the
// browser's native option box spilling past it. The closed field keeps the
// exact look it had as a native <select>.
const StyledSelect = ({ value, onChange, options, placeholder, disabled, hasError }) => (
  <CustomSelect
    value={value}
    onChange={onChange}
    options={options}
    placeholder={placeholder || "Select…"}
    disabled={disabled}
    hasError={hasError}
    errorColor={danger}
    triggerStyle={{
      background: disabled ? color.wine800 : color.white,
      border: `1px solid ${hasError ? danger : line}`,
      borderRadius: radius.pill,
      padding: "9px 36px 9px 14px",
      fontFamily: font.ui, ...type.helper,
      color: disabled ? inkFaint : (value ? ink : inkFaint),
    }}
  />
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
  // New accounts ask for exactly what the import template asks for (Student ID,
  // Last Name, First Name, Middle Name, Section, Department); the student fills
  // in the rest on first login. Viewing/editing an existing student still shows
  // every field.
  const isCreate      = !readOnly;
  const middleName    = useField(initial.middleName || "", "middleName");
  // Graduating batch year — separate from Year & section (see BATCH_NONE above).
  const batch         = useField(initial.batch || "", "batch");
  const firstName     = useField(initial.firstName || "", "firstName");
  const suffix        = useField(initial.suffix || "", "suffix");
  const sex           = useField(initial.sex || "", "sex");
  const yearSection   = useField(initial.yearSection || "", "yearSection");
  const age           = useField(initial.age || "", "age");

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

  const allFields = isCreate
    ? [studentId, lastName, firstName, middleName, suffix, yearSection, sex, batch]
    : [studentId, lastName, middleInitial, firstName, suffix, sex, yearSection, age, batch];
  const touchAll = () => { allFields.forEach(f => f.touch()); setCollegeTouched(true); if (!isCreate) setProgramTouched(true); };

  const isValid = () => {
    if (validators.studentId(studentId.value)) return false;
    if (validators.lastName(lastName.value)) return false;
    if (validators.firstName(firstName.value)) return false;
    if (validators.yearSection(yearSection.value)) return false;
    if (!college) return false;
    if (validators.batch(batch.value)) return false;
    if (isCreate) {
      if (validators.middleName(middleName.value)) return false;
      if (validators.suffix(suffix.value)) return false;
      if (validators.sex(sex.value)) return false;
      return true;
    }
    if (validators.middleInitial(middleInitial.value)) return false;
    if (validators.suffix(suffix.value)) return false;
    if (validators.sex(sex.value)) return false;
    // Age is the student's own field (set on their Personal Information), so
    // it's never validated or changed from here.
    if (!program) return false;
    return true;
  };

  // Changing any of these rebuilds the DEFAULT password (see
  // generateStudentPassword), so the student is signed out and must log in
  // again with the updated Student ID + new default password.
  // The department can't be edited, so only the name and Student ID can
  // change the default password.
  const credentialsChanged = !isCreate && (
    firstName.value.trim().toLowerCase() !== String(initial.firstName || "").trim().toLowerCase() ||
    lastName.value.trim().toLowerCase()  !== String(initial.lastName  || "").trim().toLowerCase() ||
    studentId.value.trim()               !== String(initial.studentId || "").trim()
  );
  const [confirmCredentialChange, setConfirmCredentialChange] = useState(false);

  // handleSubmit — passes form data up; parent handles Firebase
  const handleSubmit = async () => {
    touchAll();
    if (!isValid()) return;
    setSaving(true);
    setSubmitError("");
    try {
      if (isCreate) {
        // Same shape a bulk-imported row produces (see ImportModal.parseFile):
        // program is filled in only when the department offers exactly one;
        // sex, age, and email come from the student on first login. The
        // suffix is optional and set here (it's part of the name on the list).
        const deptPrograms = (departments[college]?.programs || []).map(p => p.name).filter(Boolean);
        await onSubmit({
          studentId: studentId.value.trim(),
          lastName: lastName.value.trim(),
          firstName: firstName.value.trim(),
          middleName: middleName.value.trim(),
          middleInitial: toMiddleInitial(middleName.value),
          yearSection: yearSection.value,
          college,
          program: deptPrograms.length === 1 ? deptPrograms[0] : "",
          sex: sex.value,
          batch: normalizeBatch(batch.value) || batch.value.trim(),
          specialization: "", suffix: isRealSuffix(suffix.value) ? suffix.value : "", age: "",
        });
        return;
      }
      await onSubmit({
        batch: normalizeBatch(batch.value) || batch.value.trim(),
        studentId: studentId.value, lastName: lastName.value,
        middleInitial: middleInitial.value, firstName: firstName.value,
        suffix: suffix.value, college, program,
        // A different program invalidates its old specialization; otherwise
        // whatever is on file stays as it is.
        ...(program !== (initial.program || "") ? { specialization: "" } : {}),
        yearSection: yearSection.value, sex: sex.value,
        // No `age` — it's the student's own field (Personal Information).
        // Sinasadyang WALANG `email` dito. Sa create, si createStudentAccount
        // na ang gumagawa ng `<studentId>@pending.student` na placeholder at
        // nagtatakda ng hasRealEmail:false. Sa edit naman, isinasalin ng
        // handleSave ang buong `form` papunta sa updateDoc — kaya kung
        // magpapadala tayo ng `email: ""` dito, mabubura ang tunay na email
        // na naisulat mismo ng estudyante. Ang hindi pagpapadala ang siyang
        // nag-iiwan sa field na hindi nagagalaw.
      });
    } catch (err) {
      setSubmitError(err.message || "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Edit → Save: asks first when the change will reset the default password.
  const requestSave = () => {
    touchAll();
    if (!isValid()) return;
    if (credentialsChanged) { setConfirmCredentialChange(true); return; }
    handleSubmit();
  };

  const locked = readOnly && !isEditing;

  // fullName — used for the modal header. Now includes the suffix (e.g. "Jr.")
  // and stays live: it recomputes from the current field values while editing,
  // and falls back to the original `initial` data before any edits are made.
  // Middle initial shown as "S." whether it was typed "S" or "S.". On create
  // there is no initial field — it's derived from the Middle name input.
  const asInitial = (v) => {
    const letter = String(v || "").trim().replace(/\./g, "").charAt(0);
    return letter ? `${letter.toUpperCase()}.` : "";
  };
  const buildFullName = (last, first, mi, suf) =>
    last && first
      ? `${last}, ${first}${asInitial(mi) ? " " + asInitial(mi) : ""}${isRealSuffix(suf) ? " " + suf : ""}`
      : null;

  const fullName =
    buildFullName(lastName.value, firstName.value, isCreate ? middleName.value : middleInitial.value, suffix.value) ||
    buildFullName(initial.lastName, initial.firstName, initial.middleInitial || initial.middleName, initial.suffix) ||
    "New student";

  const onStudentIdChange     = (v) => { if (/^\d*$/.test(v) && v.length <= 9) studentId.onChange(v); };
  const onLastNameChange      = (v) => { lastName.onChange(v.replace(/[^A-Za-zÑñ\s\-]/g, "")); };
  const onFirstNameChange     = (v) => { firstName.onChange(v.replace(/[^A-Za-zÑñ\s\-]/g, "")); };
  const onMiddleInitialChange = (v) => { middleInitial.onChange(v.replace(/[^A-Z.]/g, "").slice(0, 2)); };
  // Hinaharang na ang 101 pataas sa mismong pagta-type, hindi lang sa
  // validation pagka-submit: tinatanggihan ang keystroke kaya hindi na
  // lumalabas sa input. Pinapayagan pa rin ang blangko para makabura, at
  // tatlong digit ang pinakamahaba na posible (100).
  const onAgeChange           = (v) => {
    if (v === "") { age.onChange(v); return; }
    if (!/^\d{1,3}$/.test(v)) return;
    if (Number(v) > 100) return;
    age.onChange(v);
  };

  return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "clamp(16px, 5vw, 24px)" }}>
      <div className="sa-modal-inner">
        <div className="sa-modal-header">
          <h2 style={{ fontFamily: font.ui, fontSize: "clamp(1.125rem, 4vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: ink }}>{fullName}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: lineSoft, border: `1px solid ${line}`, borderRadius: "50%", width: "30px", height: "30px", color: inkMuted, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>

        <div className="sa-modal-body">
          <div id="sa-modal-studentid" style={{ marginBottom: "12px" }}>
            <FieldLabel>Student ID</FieldLabel>
            <div style={{ width: "min(220px, 100%)" }}>
              <StyledInput value={studentId.value} onChange={onStudentIdChange} placeholder="9-digit number" disabled={locked} hasError={!!studentId.error} />
              <FieldError msg={studentId.error} />
            </div>
          </div>

          {isCreate ? (
            <>
              {/* Same fields, in the same order, as the import template. */}
              <div className="sa-name-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                <div>
                  <FieldLabel>Last name</FieldLabel>
                  <StyledInput value={lastName.value} onChange={onLastNameChange} placeholder="Dela Cruz" hasError={!!lastName.error} />
                  <FieldError msg={lastName.error} />
                </div>
                <div>
                  <FieldLabel>First name</FieldLabel>
                  <StyledInput value={firstName.value} onChange={onFirstNameChange} placeholder="Juan" hasError={!!firstName.error} />
                  <FieldError msg={firstName.error} />
                </div>
                <div>
                  <FieldLabel>Middle name</FieldLabel>
                  <StyledInput value={middleName.value} onChange={(v) => middleName.onChange(v.replace(/[^A-Za-zÑñ\s\-]/g, ""))} placeholder="Santos (optional)" hasError={!!middleName.error} />
                  <FieldError msg={middleName.error} />
                </div>
                <div>
                  <FieldLabel>Suffix</FieldLabel>
                  <StyledSelect value={suffix.value} onChange={(v) => suffix.onChange(v)} options={SUFFIX_OPTIONS} placeholder="None" hasError={!!suffix.error} />
                  <FieldError msg={suffix.error} />
                </div>
              </div>

              <div className="sa-college-grid">
                <div>
                  <FieldLabel>Section</FieldLabel>
                  <StyledSelect value={yearSection.value} onChange={(v) => yearSection.onChange(v)} options={YEAR_SECTIONS} placeholder="Select section" hasError={!!yearSection.error} />
                  <FieldError msg={yearSection.error} />
                </div>
                <div>
                  <FieldLabel>Department</FieldLabel>
                  {coordinatorColleges.length > 1 ? (
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
              </div>

              <div className="sa-college-grid" style={{ marginTop: "12px" }}>
                <div>
                  <FieldLabel>Sex</FieldLabel>
                  <StyledSelect value={sex.value} onChange={(v) => sex.onChange(v)} options={SEX_OPTIONS} placeholder="Select sex" hasError={!!sex.error} />
                  <FieldError msg={sex.error} />
                </div>
                <div>
                  <FieldLabel>Batch</FieldLabel>
                  <StyledInput value={batch.value} onChange={(v) => batch.onChange(v.replace(/[^\d-]/g, "").slice(0, 9))} placeholder="2026-2027" hasError={!!batch.error} />
                  <FieldError msg={batch.error} />
                </div>
              </div>

              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: space.sm, lineHeight: 1.6 }}>
                The student adds their program, age, and personal email on their first login.
              </p>
            </>
          ) : (
          <>
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

          <div id="sa-modal-department" className="sa-college-grid">
            <div>
              <FieldLabel>Department</FieldLabel>
              {/* Locked to the coordinator's own department(s) — never the
                  full college list. Single department → static label so it
                  can't be changed. Multiple → dropdown, but restricted to
                  just the coordinator's assigned departments. */}
              {/* Editing an existing student never changes the department —
                  only a NEW student can be placed in one of the coordinator's
                  departments. */}
              {coordinatorColleges.length > 1 && !readOnly ? (
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

          <div id="sa-modal-info" className="sa-info-grid">
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
              {/* Age is the student's to set (first-login setup / their own
                  profile), so a coordinator never types it here. */}
              <StyledInput value={age.value} onChange={onAgeChange} disabled hasError={false} />
              {isEditing && readOnly && (
                <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: "4px" }}>Set by the student</p>
              )}

            </div>
            <div>
              <FieldLabel>Batch</FieldLabel>
              <StyledInput value={batch.value} onChange={(v) => batch.onChange(v.replace(/[^\d-]/g, "").slice(0, 9))} placeholder="2026-2027" disabled={locked} hasError={!!batch.error} />
              <FieldError msg={batch.error} />
            </div>
          </div>

          </>
          )}

          {/* Password preview — shown on create, and when coordinator views an existing student */}
          {lastName.value && college && (
            <div id="sa-modal-password" style={{ background: color.wine800, border: `1px solid ${line}`, borderRadius: radius.card, padding: "12px 16px", marginTop: space.md }}>
              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginBottom: "4px" }}>Default password</p>
              <p style={{ fontFamily: font.ui, ...type.label, color: ink, margin: 0 }}>
                {(firstName.value && lastName.value && studentId.value && college) ? generateStudentPassword(firstName.value, lastName.value, studentId.value, departments[college]?.abbr || college) : "—"}
              </p>
              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, margin: "6px 0 0" }}>
                Built from the last name, 123., and the college code, all lowercase. The student should change it after signing in.
              </p>
            </div>
          )}

          {readOnly && isEditing && credentialsChanged && (
            <p style={{ fontFamily: font.ui, ...type.helper, color: "#8a5a00", background: "#FFF3D6", border: "1px solid #F0D48A", borderRadius: radius.card, padding: "10px 14px", marginTop: space.md, lineHeight: 1.5 }}>
              Changing the name or Student ID changes this student's default password to the one shown above.
              The student is notified to log out and sign in again with the updated Student ID and new default password,
              then set a new password. Their applications and messages stay as they are.
            </p>
          )}

          {submitError && (
            <p style={{ fontFamily: font.ui, ...type.helper, color: danger, marginTop: space.md }}>{submitError}</p>
          )}
        </div>

        {readOnly && (
          <div className="sa-modal-footer">
            {isEditing ? (
              <>
                <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
                <button onClick={requestSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </>
            ) : (
              <>
                <button onClick={onClose} style={ghostBtn}>Close</button>
                <button id="sa-modal-edit" onClick={() => setIsEditing(true)} style={primaryBtn}>Edit</button>
              </>
            )}
          </div>
        )}

        {confirmCredentialChange && (
          <Dialog
            title="Change this student's default password?"
            body={`Saving changes the student's password to the new default password: ${(firstName.value && lastName.value && studentId.value && college) ? generateStudentPassword(firstName.value, lastName.value, studentId.value, departments[college]?.abbr || college) : "—"}. The student will be notified to log out and sign in again with Student ID ${studentId.value.trim()} and this password, then set a new password. Give them these details.`}
          >
            <button onClick={() => setConfirmCredentialChange(false)} style={ghostBtn}>Cancel</button>
            <button onClick={() => { setConfirmCredentialChange(false); handleSubmit(); }} style={primaryBtn}>Save changes</button>
          </Dialog>
        )}

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
  // Reverse-lookup: short Department code (e.g. "CCS") → canonical full name,
  // derived from each department's `abbr` in the live Firestore data — so
  // the spreadsheet can stay compact while what's saved is always the same
  // full name companies/coordinators/posts use. Matching ignores case.
  const abbrToFullName = {};
  departmentNames.forEach(name => {
    if (departments[name]?.abbr) abbrToFullName[String(departments[name].abbr).toUpperCase()] = name;
  });
  const fullNameByLower = {};
  departmentNames.forEach(name => { fullNameByLower[name.toLowerCase()] = name; });

  if (!row.studentId) errs.push(`Row ${r}: Student ID is required`);
  else if (!/^\d{9}$/.test(row.studentId)) errs.push(`Row ${r}: Student ID must be exactly 9 digits`);
  if (!row.lastName) errs.push(`Row ${r}: Last Name is required`);
  else if (!NAME_REGEX.test(row.lastName)) errs.push(`Row ${r}: Last Name can only contain letters, spaces, and hyphens`);
  if (!row.firstName) errs.push(`Row ${r}: First Name is required`);
  else if (!NAME_REGEX.test(row.firstName)) errs.push(`Row ${r}: First Name can only contain letters, spaces, and hyphens`);
  if (row.middleName && !NAME_REGEX.test(row.middleName)) errs.push(`Row ${r}: Middle Name can only contain letters, spaces, and hyphens`);
  // Optional. Same options as the New Student form; "jr" / "iii" are tidied up.
  const suffix = normalizeSuffix(row.suffix);
  if (suffix === null) errs.push(`Row ${r}: Suffix "${row.suffix}" must be one of ${SUFFIX_OPTIONS.join(", ")} (or blank)`);
  else row.suffix = suffix;

  if (!row.sex) {
    errs.push(`Row ${r}: Sex is required`);
  } else {
    const sex = normalizeSex(row.sex);
    if (!sex) errs.push(`Row ${r}: Sex "${row.sex}" must be Male or Female`);
    else row.sex = sex; // normalize in place, e.g. "m" → "Male"
  }

  // Section and batch are not checked per row: they are typed once in the import
  // form and validated there, then stamped onto every row.

  if (!row.college) {
    errs.push(`Row ${r}: Department is required`);
  } else {
    // Accept either the short code ("CCS") or the full name, in any case.
    const resolvedCollege = abbrToFullName[row.college.toUpperCase()] || fullNameByLower[row.college.toLowerCase()] || null;
    if (!resolvedCollege) errs.push(`Row ${r}: Department "${row.college}" is not valid`);
    else if (coordinatorColleges.length > 0 && !coordinatorColleges.includes(resolvedCollege)) errs.push(`Row ${r}: Department "${row.college}" is not one of your assigned departments — you can only import your own department's students`);
    else {
      row.college = resolvedCollege; // normalize in place to the canonical full name before this row gets saved
      // No Program column: a department with exactly one program gets it
      // filled in automatically; otherwise the student picks it on first login.
      const programs = (departments[resolvedCollege]?.programs || []).map(p => p.name).filter(Boolean);
      row.program = programs.length === 1 ? programs[0] : "";
    }
  }
  return errs;
};

// ── Import Modal ───────────────────────────────────────────────────────────────
const ImportModal = ({ onClose, onImport, coordinatorColleges = [], departments = {} }) => {
  const [dragging, setDragging] = useState(false);
  // Section and batch are typed once here and stamped on every row, instead of
  // being repeated down two template columns where one row could disagree with
  // the rest. One import is therefore one section of one batch.
  const [section, setSection] = useState("");
  const [batch, setBatch]     = useState("");
  const [fieldError, setFieldError] = useState("");
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
      // The Suffix column is optional: an older template without it is read in
      // its old layout instead of being rejected.
      const expectedColumns = headerRow[IMPORT_TEMPLATE_COLUMNS.indexOf("Suffix")] === "Suffix" ? IMPORT_TEMPLATE_COLUMNS : LEGACY_IMPORT_COLUMNS;
      const at = (name) => expectedColumns.indexOf(name);   // -1 when the column isn't in this layout
      expectedColumns.forEach((expected, i) => { if (headerRow[i] !== expected) headerErrors.push(`Column ${i + 1}: expected "${expected}", found "${headerRow[i] || "(empty)"}"`); });
      if (headerErrors.length > 0) { setPreview({ valid: [], rowErrors: [], headerErrors }); setParsing(false); return; }
      const rowErrors = []; const valid = [];
      rows.slice(2).forEach((row, i) => {
        if (row.every(c => c === "" || c === null || c === undefined)) return;
        // Extra safety net: skip any row that still looks like the
        // template's own "e.g. ..." example row.
        if (String(row[0] ?? "").trim().toLowerCase().startsWith("e.g.")) return;
        const cell = (name) => (at(name) === -1 ? "" : String(row[at(name)] ?? "").trim());
        const middleName = cell("Middle Name");
        const student = {
          studentId:     cell("Student ID"),
          lastName:      cell("Last Name"),
          firstName:     cell("First Name"),
          middleName,
          middleInitial: toMiddleInitial(middleName),
          suffix:        cell("Suffix"),   // checked + normalized in validateRow
          college:       cell("Department"),
          sex:           cell("Sex"),
          // Section and batch are typed once in the import form and stamped on
          // every row there — one import is one section of one batch.
          yearSection:   "",
          batch:         "",
          // Not in the template — filled in by validateRow (single-program
          // departments) or by the student on first login.
          program: "", major: "", specialization: "",
          age: "",
          email: "", password: "",
        };
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
  const normalizedSection = normalizeSection(section);
  const normalizedBatch   = normalizeBatch(batch);

  const handleImport = () => {
    if (!preview || preview.valid.length === 0) return;
    if (!normalizedSection) { setFieldError(`Choose the section for these students (${YEAR_SECTIONS.join(", ")}).`); return; }
    if (!normalizedBatch)   { setFieldError("Enter the batch as an academic year, e.g. 2026-2027."); return; }
    onImport(preview.valid.map(st => ({ ...st, yearSection: normalizedSection, batch: normalizedBatch })));
    onClose();
  };

  const canImport = preview && preview.valid.length > 0 && !!normalizedSection && !!normalizedBatch;

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
          <div id="sa-import-dropzone" onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onClick={() => !file && fileRef.current.click()}
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
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={inkFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: `0 auto ${space.sm}` }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, marginBottom: "4px" }}>Drop your Excel file here, or click to browse</p>
                <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted }}>.xlsx or .xls, up to 10MB</p>
              </>
            )}
          </div>

          {fileError && <p style={{ fontFamily: font.ui, ...type.helper, color: danger, marginTop: space.sm }}>{fileError}</p>}

          {/* One section and one batch for the whole file. */}
          <div style={{ display: "flex", gap: space.sm, flexWrap: "wrap", marginTop: space.md }}>
            <div>
              <label htmlFor="sa-import-section" style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, display: "block", marginBottom: "4px" }}>
                Section <span style={{ color: danger }}>*</span>
              </label>
              <StyledSelect
                value={section}
                onChange={(v) => { setSection(v); setFieldError(""); }}
                options={YEAR_SECTIONS}
                placeholder="Select section"
                hasError={!!fieldError && !normalizedSection}
              />
            </div>
            <div>
              <label htmlFor="sa-import-batch" style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, display: "block", marginBottom: "4px" }}>
                Batch <span style={{ color: danger }}>*</span>
              </label>
              <StyledInput
                value={batch}
                onChange={(v) => { setBatch(v.replace(/[^\d-]/g, "").slice(0, 9)); setFieldError(""); }}
                placeholder="2026-2027"
                hasError={!!fieldError && !normalizedBatch}
              />
            </div>
          </div>

          {fieldError
            ? <p role="alert" style={{ fontFamily: font.ui, ...type.helper, color: danger, margin: "6px 0 0" }}>{fieldError}</p>
            : <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, margin: "6px 0 0", lineHeight: 1.6 }}>
                Students are imported one section at a time: every student in this file is saved under the section and batch above.
                For another section, import a separate file.
              </p>}

          <div id="sa-import-columns" style={{ background: color.wine800, border: `1px solid ${line}`, borderRadius: radius.card, padding: "12px 16px", marginTop: space.md }}>
            <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: "4px" }}>Columns, in this order</p>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkBody, lineHeight: 1.7 }}>{IMPORT_TEMPLATE_COLUMNS.join(" · ")}</p>
          </div>

          <div id="sa-import-template" style={{ marginTop: space.sm, display: "flex", justifyContent: "flex-start", width: "fit-content", maxWidth: "100%" }}>
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

        <div id="sa-import-footer" className="sa-import-footer">
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
const FilterPanel = ({ filters, setFilters, filterRef, coordinatorColleges = [], departments = {}, departmentNames = [], batchOptions = [], hasUnbatched = false }) => {
  const { isMobile, isTablet } = useBreakpoint();
  const [expandedCollege, setExpandedCollege] = useState(filters.college || "");
  // Scoped to the coordinator's own assigned department(s) — never the
  // full school-wide college list.
  const allColleges        = coordinatorColleges.length > 0 ? coordinatorColleges : departmentNames;
  const allPrograms        = expandedCollege ? (departments[expandedCollege]?.programs || []).map(p => p.name) : [];

  // Derive section letters from YEAR_SECTIONS (e.g. "4-A" → "A")
  const sectionLetters = YEAR_SECTIONS.map(s => s.split("-")[1]).filter(Boolean);

  const clearAll = () => { setExpandedCollege(""); setFilters({ college: "", program: "", sex: "", section: "", batch: "" }); };
  const toggleBatch   = (val) => setFilters(prev => ({ ...prev, batch: prev.batch === val ? "" : val }));
  const toggleSex     = (val) => setFilters(prev => ({ ...prev, sex: prev.sex === val ? "" : val }));
  const toggleSection = (val) => setFilters(prev => ({ ...prev, section: prev.section === val ? "" : val }));
  const toggleCollege = (col) => {
    if (expandedCollege === col) { setExpandedCollege(""); setFilters(prev => ({ ...prev, college: "", program: "" })); }
    else { setExpandedCollege(col); setFilters(prev => ({ ...prev, college: col, program: "", specialization: "" })); }
  };
  const toggleProgram = (prog) => setFilters(prev => ({ ...prev, program: prev.program === prog ? "" : prog, specialization: "" }));
  const locationLevel = !expandedCollege ? "college" : "program";

  const panelStyle = {
    position: "absolute", top: "48px", right: 0, width: "266px",
    background: surface, border: `1px solid ${line}`, borderRadius: radius.card,
    boxShadow: shadow.panel, zIndex: 100, overflow: "hidden",
    fontFamily: font.ui,
  };

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

      {/* Batch — the graduating year, not the section. Options come from the
          students currently loaded, so no year is offered that has nobody. */}
      <div style={{ padding: "0 14px 12px" }}>
        <p style={{ ...groupLabel, marginBottom: space.sm }}>Batch</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {batchOptions.length > 0 || hasUnbatched ? (
            <>
              {batchOptions.map(b => (<span key={b} onClick={() => toggleBatch(b)} style={chip(filters.batch === b)}>{b}</span>))}
              {hasUnbatched && (
                <span onClick={() => toggleBatch(BATCH_NONE)} style={chip(filters.batch === BATCH_NONE)}>No batch</span>
              )}
            </>
          ) : (
            <span style={emptyNote}>No batches yet</span>
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
                  onMouseEnter={e => e.currentTarget.style.background = color.hoverWashStrong}
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
const StudentAvatar = ({ size = 34, userIcon: themedUserIcon = blackUserIcon }) => (
  <img src={themedUserIcon} alt="" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
);

// ── Row overflow menu ─────────────────────────────────────────────────────────
const StudentRowMenu = ({ onView, onDelete, onArchive, onRestore, archived }) => {
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
      onMouseEnter={e => e.currentTarget.style.background = color.hoverWash}
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
          {archived
            ? item("Restore", (e) => { e.stopPropagation(); onRestore(); setShowMenu(false); })
            : item("Archive", (e) => { e.stopPropagation(); onArchive(); setShowMenu(false); })}
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
    style={{ width: "18px", height: "18px", border: `1.5px solid ${checked ? panel : color.wine400}`, borderRadius: "5px", background: checked ? panel : color.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
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
    // Batch + archive state. Missing fields on older docs stay harmless:
    // no batch → "No batch set" group; no isArchived → active.
    batch:          d.batch          || "",
    isArchived:     d.isArchived === true,
    archivedAt:     d.archivedAt     || null,
  };
};

// ── Student Row ───────────────────────────────────────────────────────────────
// Full-width row, matching the Student List screen: avatar + name on top, a
// single meta line under it, then the badge/action cluster on the right. Rows
// rather than a card grid because bulk-select is the core workflow here — the
// checkboxes stack into one vertical column, so a ticked set reads at a glance.
// The email lives in the row's tooltip instead of the meta line: it's the one
// field long enough to break the alignment everything else depends on.
const StudentRow = ({ student: s, selectMode, isSelected, onToggleSelect, onView, onDelete, onArchive, onRestore, userIcon: themedUserIcon = blackUserIcon }) => {
  const meta = [s.studentId, s.program, s.yearSection, s.sex].filter(Boolean).join(" · ");

  return (
    <div
      className="sa-row"
      onClick={() => onView(s)}
      style={{ borderColor: isSelected ? panel : undefined }}
    >
      {selectMode && (
        <div onClick={(e) => { e.stopPropagation(); onToggleSelect(s.id); }}>
          <Checkbox checked={isSelected} />
        </div>
      )}

      <StudentAvatar size={45} userIcon={themedUserIcon} />

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
        <div onClick={(e) => e.stopPropagation()}>
          <StudentRowMenu
            onView={() => onView(s)}
            onDelete={() => onDelete(s.id)}
            onArchive={() => onArchive(s)}
            onRestore={() => onRestore(s)}
            archived={isArchivedStudent(s)}
          />
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
const CoordinatorStudentsAcccountScreen = ({ coordinatorUid, coordinatorColleges, userIcon: themedUserIcon = blackUserIcon, onViewingStudentChange, onImportModalChange }) => {
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

  // ── College name variants, for the Firestore query only ────────────────
  // Normalizing to the full name assumes every student doc uses the full name
  // too, and they don't — older ones hold the short code ("CCS"). Matching on
  // the full name alone silently hides those, which is how this screen and the
  // Student List screen ended up showing different people. Match on both forms
  // until the data is cleaned up. Firestore allows 10 values in an "in" clause.
  const fullNameToAbbr = React.useMemo(() => {
    const map = {};
    departmentNames.forEach(name => { if (departments[name]?.abbr) map[name] = departments[name].abbr; });
    return map;
  }, [departments, departmentNames]);

  const collegeQueryVariants = React.useMemo(() => {
    const out = new Set();
    normalizedCoordinatorColleges.forEach(name => {
      if (!name) return;
      out.add(name);
      if (fullNameToAbbr[name]) out.add(fullNameToAbbr[name]);
    });
    return [...out].slice(0, 10);
  }, [normalizedCoordinatorColleges, fullNameToAbbr]);

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
  // Lets the dashboard's "?" help button and auto-tour switch to
  // HELP_STEPS_BY_NAV.studentsaccountmodal while a student's view/edit modal
  // is open, instead of always running the list's steps (search / filter /
  // toolbar / list) against a screen that's currently covered by the modal.
  // Mirrors CoordinatorViewCompanyScreen's onViewChange → findCompanySubView.
  useEffect(() => { onViewingStudentChange?.(!!viewingStudent); }, [viewingStudent, onViewingStudentChange]);
  // Same idea for the Import modal: while it's open the "?" button runs
  // HELP_STEPS_BY_NAV.studentsaccountimport (dropzone / columns / template /
  // footer) instead of the list steps hidden behind its overlay.
  useEffect(() => { onImportModalChange?.(showImportModal); }, [showImportModal, onImportModalChange]);
  const [successInfo, setSuccessInfo]           = useState(null); // { fullName, password }
  const [importResult, setImportResult]        = useState(null); // { successCount, failures[] }
  const [filters, setFilters]                   = useState({ college: "", program: "", sex: "", section: "", batch: "" });
  // "active" | "archived" — which pool the list is showing.
  const [viewTab, setViewTab]                   = useState("active");
  const [confirmArchiveInfo, setConfirmArchiveInfo] = useState(null); // { student, mode: "archive"|"restore" }
  const [archiveBusy, setArchiveBusy]           = useState(false);
  // Bulk "Set batch" — fills the academic year on the ticked rows. Existing
  // student records predate the batch field, so without this every one of them
  // would have to be edited by hand to leave "No batch set".
  const [batchAssign, setBatchAssign]           = useState(null); // { ids, value, error, busy }
  const filterRef = useRef(null);

  // ── Real-time listener: ALL students in this coordinator's department(s) ──
  // Same scope as the Student List screen — every coordinator assigned to a
  // given college (e.g. all of CED) manages the same pool of student
  // accounts, regardless of which coordinator originally created them.
  //
  // FIX: `collegeQueryVariants` is a new array reference on every render
  // (it's the end of a useMemo chain fed by coordinatorColleges/departments,
  // which aren't guaranteed stable identities from the parent/hook). Using
  // it directly as a dependency made this effect re-fire on EVERY render,
  // and `setStudents([])` below was always a fresh [] reference — which
  // always triggers another render — producing an infinite loop
  // ("Maximum update depth exceeded"). Depending on a stable, content-based
  // string key instead means the effect only re-runs when the actual list
  // of colleges changes.
  const collegeQueryKey = collegeQueryVariants.join("|");

  useEffect(() => {
    if (!coordinatorUid || collegeQueryVariants.length === 0) {
      console.warn("[StudentAccounts] No colleges assigned to this coordinator — nothing to load.", coordinatorColleges);
      setStudents(prev => (prev.length === 0 ? prev : []));
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "students"),
      where("college", "in", collegeQueryVariants)
    );
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(mapStudentDoc));
      setLoading(false);
    }, (err) => {
      // Without this the listener fails silently and an errored query is
      // indistinguishable from an empty department.
      console.error("[StudentAccounts] Failed to load students:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [coordinatorUid, collegeQueryKey]);

  // ── Close filter panel on outside click ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterDrawer(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasFilter = Object.values(filters).some(Boolean);

  // Split first so each tab keeps its own count and its own batch options,
  // and so the two never interfere with each other.
  const activeStudents   = students.filter(s => !isArchivedStudent(s));
  const archivedStudents = students.filter(s => isArchivedStudent(s));
  const pool = viewTab === "archived" ? archivedStudents : activeStudents;

  // Batch options come from the students actually in this tab, so the list
  // never offers a year that returns nothing.
  const batchOptions = sortBatchKeys([...new Set(pool.map(batchKeyOf))])
    .filter(k => k !== BATCH_NONE);
  const hasUnbatched = pool.some(s => batchKeyOf(s) === BATCH_NONE);

  const filtered = pool.filter(s => {
    const q = search.toLowerCase();
    const matchSearch  = [s.firstName, s.lastName, s.fullName, s.studentId, s.email, s.college, s.program, s.batch]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    const matchCollege = !filters.college || s.college === filters.college;
    const matchProgram = !filters.program || s.program === filters.program;
    const matchSex     = !filters.sex || s.sex === filters.sex;
    const matchSection = !filters.section || s.yearSection.endsWith(`-${filters.section}`);
    const matchBatch   = !filters.batch || batchKeyOf(s) === filters.batch;
    return matchSearch && matchCollege && matchProgram && matchSex && matchSection && matchBatch;
  });

  // Group the visible students by batch, newest year first.
  const groupedByBatch = (() => {
    const groups = {};
    filtered.forEach(s => { (groups[batchKeyOf(s)] ||= []).push(s); });
    return sortBatchKeys(Object.keys(groups)).map(key => ({ key, label: batchLabelOf(key), rows: groups[key] }));
  })();

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
    const fullName = `${form.firstName} ${form.middleInitial ? form.middleInitial.replace(/\.$/, "") + ". " : ""}${form.lastName}${isRealSuffix(form.suffix) ? " " + form.suffix : ""}`;
    logActivity(coordinatorUid, "student_created", `Created student account for ${fullName}`, { targetId: form.studentId, targetName: fullName }).catch(err => console.error("Failed to log activity:", err));
    setShowNewModal(false);
    setSuccessInfo({
      fullName,
      studentId: form.studentId,
      password,
    });
    // onSnapshot will auto-update the list
  };

  // ── Save (edit) — updates Firestore doc ───────────────────────────────────
  // Saved through the updateStudentAccount Cloud Function (AuthService →
  // updateStudentAccountByCoordinator): it keeps Student IDs unique, never
  // touches the student's own age/email, and — when the name, Student ID or
  // department changes — resets the default password and signs the student
  // out. Errors are thrown back so the form shows them.
  const [credentialResetInfo, setCredentialResetInfo] = useState(null);
  const handleSave = async (form) => {
    const result = await updateStudentAccountByCoordinator({
      studentUid:  viewingStudent.id,
      updates:     form,
      collegeAbbr: departments[form.college]?.abbr || form.college,
    });
    const fullName = result?.fullName || `${form.firstName} ${form.lastName}`;
    // Shared activity log: every coordinator of the department sees exactly
    // what changed — including a program/major change that moves the student
    // to another coordinator.
    const changes = Array.isArray(result?.changes) ? result.changes : [];
    const describe = (c) => `${c.label} from "${c.from || "—"}" to "${c.to || "—"}"`;
    const moved = changes.some(c => c.field === "program" || c.field === "specialization");
    if (changes.length) {
      logActivity(
        coordinatorUid,
        result?.passwordReset ? "student_edited_password_reset" : moved ? "student_program_changed" : "student_edited",
        `Edited student account for ${fullName}: ${changes.map(describe).join("; ")}${result?.passwordReset ? " (default password changed)" : ""}`,
        { targetId: viewingStudent.id, targetName: fullName, changes }
      ).catch(err => console.error("Failed to log activity:", err));
    }
    setViewingStudent(null);
    if (result?.passwordReset) {
      setCredentialResetInfo({ fullName, studentId: form.studentId, password: result.newPassword });
    } else if (result?.authMissing) {
      setCredentialResetInfo({ fullName, studentId: form.studentId, authMissing: true });
    }
  };

  // ── Archive / restore ─────────────────────────────────────────────────────
  // A status change only: the student doc, their Auth account, applications,
  // placements and messages are all left untouched.
  const handleArchive = (student) => setTimeout(() => setConfirmArchiveInfo({ student, mode: "archive" }), 0);
  const handleRestore = (student) => setTimeout(() => setConfirmArchiveInfo({ student, mode: "restore" }), 0);

  // Bulk archive/restore over the ticked rows. Which one it is follows the tab
  // the coordinator is in — the Archived tab can only restore, and vice versa.
  const handleArchiveSelected = () => {
    if (selected.size === 0) return;
    setConfirmArchiveInfo({
      mode: viewTab === "archived" ? "restore" : "archive",
      bulk: true,
      ids: [...selected],
      count: selected.size,
    });
  };

  const confirmArchive = async () => {
    if (!confirmArchiveInfo || archiveBusy) return;
    const { student, mode, bulk, ids = [] } = confirmArchiveInfo;
    const archiving = mode === "archive";
    const payload = archiving
      ? { isArchived: true,  archivedAt: serverTimestamp() }
      : { isArchived: false, archivedAt: null };

    setArchiveBusy(true);
    try {
      if (bulk) {
        await Promise.all(ids.map(id => updateDoc(doc(db, "students", id), payload)));
        logActivity(
          coordinatorUid,
          archiving ? "student_archived_bulk" : "student_restored_bulk",
          `${archiving ? "Archived" : "Restored"} ${ids.length} student account(s)`,
          { targetCount: ids.length }
        ).catch(err => console.error("Failed to log activity:", err));
        setSelected(new Set());
        exitSelectMode();
      } else {
        await updateDoc(doc(db, "students", student.id), payload);
        const name = student.fullName || student.studentId;
        logActivity(
          coordinatorUid,
          archiving ? "student_archived" : "student_restored",
          `${archiving ? "Archived" : "Restored"} student account for ${name}`,
          { targetId: student.id, targetName: name }
        ).catch(err => console.error("Failed to log activity:", err));
        // Deselect: a row that just left this tab shouldn't stay ticked.
        setSelected(prev => { const n = new Set(prev); n.delete(student.id); return n; });
      }
      setConfirmArchiveInfo(null);
    } catch (err) {
      console.error(`Failed to ${mode} student(s):`, err);
      setConfirmArchiveInfo(prev => prev && { ...prev, error: "That didn't save. Check your connection and try again." });
    } finally {
      setArchiveBusy(false);
    }
  };

  // ── Bulk: set the batch on the selected students ──────────────────────────
  const handleSetBatchSelected = () => {
    if (selected.size === 0) return;
    setBatchAssign({ ids: [...selected], value: "", error: "", busy: false });
  };

  const confirmSetBatch = async () => {
    if (!batchAssign || batchAssign.busy) return;
    const batch = normalizeBatch(batchAssign.value);
    if (!batch) {
      setBatchAssign(prev => prev && { ...prev, error: "Enter an academic year like 2026-2027." });
      return;
    }
    setBatchAssign(prev => prev && { ...prev, busy: true, error: "" });
    try {
      await Promise.all(batchAssign.ids.map(id => updateDoc(doc(db, "students", id), { batch })));
      logActivity(coordinatorUid, "student_batch_set", `Set batch ${batch} on ${batchAssign.ids.length} student account(s)`, { targetCount: batchAssign.ids.length })
        .catch(err => console.error("Failed to log activity:", err));
      setSelected(new Set());
      exitSelectMode();
      setBatchAssign(null);
    } catch (err) {
      console.error("Failed to set batch:", err);
      setBatchAssign(prev => prev && { ...prev, busy: false, error: "That didn't save. Check your connection and try again." });
    }
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
      // Back to the plain "Select" button once the bulk delete is done.
      setSelected(new Set());
      exitSelectMode();
    }
    setConfirmDeleteInfo(null);
  };

  // ── Import — batch creates via AuthService ────────────────────────────────
  const handleImport = async (newStudents) => {
    let successCount = 0;
    const failures = [];
    // Fire in sequence to avoid hammering Firebase Auth rate limits
    for (const s of newStudents) {
      try {
        // s.college is already normalized to the full name by validateRow —
        // collegeAbbr here is only for the password suffix, same as handleCreate.
        await createStudentAccount({ ...s, collegeAbbr: departments[s.college]?.abbr || s.college }, coordinatorUid);
        successCount++;
      } catch (err) {
        console.warn(`Skipped ${s.studentId}:`, err.message);
        failures.push({ studentId: s.studentId, message: err.message });
      }
    }
    if (successCount > 0) {
      logActivity(coordinatorUid, "student_imported_bulk", `Imported ${successCount} student account(s)`, { targetCount: successCount }).catch(err => console.error("Failed to log activity:", err));
    }
    // Silence here used to look exactly like success: rows that failed at the
    // Auth step were only ever console.warn-ed, so a fully failed import
    // looked like nothing had happened at all.
    setImportResult({ successCount, failures });
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
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <span title="Student Accounts" style={{ fontFamily: font.ui, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Student Accounts</span>
            <p title={`${filtered.length} of ${pool.length} ${viewTab === "archived" ? "archived" : "active"} students`} style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {filtered.length} of {pool.length} {viewTab === "archived" ? "archived" : "active"} · {activeStudents.length} active, {archivedStudents.length} archived
            </p>
          </div>

          <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div id="sa-search-bar" style={{ display: "flex", alignItems: "center", gap: space.sm, background: color.white, borderRadius: radius.pill, padding: "9px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
                className="sa-search-input"
                style={{ border: "none", background: "transparent", outline: "none", boxShadow: "none", WebkitAppearance: "none", appearance: "none", color: ink, fontFamily: font.ui, ...type.control }}
              />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search" style={{ background: "none", border: "none", color: inkMuted, cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>}
            </div>
            <div id="sa-filter-btn" style={{ position: "relative", marginLeft: "10px" }}>
              <div
                onClick={() => setShowFilterDrawer(v => !v)}
                title="Filters"
                style={{ width: "40px", height: "40px", background: hasFilter ? color.goldTint : color.white, borderRadius: radius.pill, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `1px solid ${color.onWineFaint}` : "none" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? onPanel : inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              </div>
              {showFilterDrawer && <FilterPanel filters={filters} setFilters={setFilters} filterRef={filterRef} coordinatorColleges={normalizedCoordinatorColleges} departments={departments} departmentNames={departmentNames} batchOptions={batchOptions} hasUnbatched={hasUnbatched} />}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="sa-toolbar">
          <div id="sa-toolbar-select" className="sa-toolbar-group">
            {!selectMode ? (
              <button onClick={enterSelectMode} style={ghostBtn}>Select</button>
            ) : (
              <>
                <div onClick={toggleAll} style={{ display: "flex", alignItems: "center", gap: space.sm, cursor: "pointer", padding: "9px 16px", background: surface, border: `1.5px solid ${lineStrong}`, borderRadius: radius.pill }}>
                  <Checkbox checked={allSelected} />
                  <span style={{ fontFamily: font.ui, ...type.control, color: inkBody }}>Select all</span>
                </div>
                <button
                  onClick={handleSetBatchSelected}
                  disabled={selected.size === 0}
                  style={{ ...ghostBtn, opacity: selected.size === 0 ? 0.5 : 1, cursor: selected.size === 0 ? "default" : "pointer" }}
                >
                  {allSelected && selected.size > 0 ? "Set batch (all)" : `Set batch${selected.size > 0 ? ` (${selected.size})` : ""}`}
                </button>
                <button
                  onClick={handleArchiveSelected}
                  disabled={selected.size === 0}
                  style={{ ...ghostBtn, opacity: selected.size === 0 ? 0.5 : 1, cursor: selected.size === 0 ? "default" : "pointer" }}
                >
                  {viewTab === "archived"
                    ? (allSelected && selected.size > 0 ? "Restore all" : `Restore${selected.size > 0 ? ` (${selected.size})` : ""}`)
                    : (allSelected && selected.size > 0 ? "Archive all" : `Archive${selected.size > 0 ? ` (${selected.size})` : ""}`)}
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selected.size === 0}
                  style={{ ...ghostBtn, color: panel, borderColor: selected.size === 0 ? lineStrong : panel, opacity: selected.size === 0 ? 0.5 : 1, cursor: selected.size === 0 ? "default" : "pointer" }}
                >
                  {allSelected && selected.size > 0 ? "Delete all" : `Delete${selected.size > 0 ? ` (${selected.size})` : ""}`}
                </button>
                <button onClick={exitSelectMode} style={{ background: "none", border: "none", fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", textDecoration: "underline" }}>Cancel</button>
              </>
            )}
          </div>
          <div id="sa-toolbar-actions" className="sa-toolbar-group">
            <button onClick={handleExport} style={ghostBtn}>Export</button>
            <button onClick={() => setShowImportModal(true)} style={ghostBtn}>Import</button>
            <button onClick={() => setShowNewModal(true)} style={primaryBtn}>New student</button>
          </div>
        </div>

        {/* Active / Archived — archiving never deletes anything, so both pools
            stay in Firestore and a student can be moved back at any time. */}
        <div id="sa-view-tabs" role="tablist" aria-label="Student pool" style={{ display: "flex", gap: "6px", marginBottom: space.md, flexWrap: "wrap" }}>
          {[
            { key: "active",   label: "Active Students",   count: activeStudents.length },
            { key: "archived", label: "Archived Students", count: archivedStudents.length },
          ].map(t => {
            const on = viewTab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => { setViewTab(t.key); setFilters(prev => ({ ...prev, batch: "" })); exitSelectMode(); }}
                style={{
                  border: `1.5px solid ${on ? panel : lineStrong}`, background: on ? panel : surface,
                  color: on ? color.white : inkBody, borderRadius: radius.pill,
                  padding: "7px 16px", cursor: "pointer", fontFamily: font.ui, ...type.control,
                  display: "inline-flex", alignItems: "center", gap: "8px", maxWidth: "100%",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                <span style={{ background: on ? "rgba(255,255,255,0.22)" : color.wine700, color: on ? color.white : inkMuted, borderRadius: radius.pill, padding: "1px 8px", fontSize: "0.72rem", fontWeight: 700 }}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* Active filter chips */}
        {hasFilter && (
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.md, flexWrap: "wrap" }}>
            {[
              filters.sex     && { label: filters.sex,          clear: () => setFilters(prev => ({ ...prev, sex: "" })) },
              filters.section && { label: `4-${filters.section}`, clear: () => setFilters(prev => ({ ...prev, section: "" })) },
              filters.college && { label: [filters.college, filters.program].filter(Boolean).join(" › "), clear: () => setFilters(prev => ({ ...prev, college: "", program: "" })) },
              filters.batch   && { label: batchLabelOf(filters.batch), clear: () => setFilters(prev => ({ ...prev, batch: "" })) },
            ].filter(Boolean).map(({ label, clear }) => (
              <span key={label} style={{ background: surface, color: inkBody, border: `1px solid ${line}`, borderRadius: radius.pill, padding: "4px 12px", fontFamily: font.ui, ...type.helper, display: "flex", alignItems: "center", gap: "6px" }}>
                {label}<span onClick={clear} style={{ cursor: "pointer", color: inkMuted }}>✕</span>
              </span>
            ))}
            <span onClick={() => setFilters({ college: "", program: "", sex: "", section: "", batch: "" })} style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", textDecoration: "underline" }}>Clear all</span>
          </div>
        )}

        {/* Student list */}
        {filtered.length > 0 ? (
          <>
            {groupedByBatch.map(group => (
              <section key={group.key} style={{ marginBottom: space.lg }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: space.sm,
                  padding: "0 2px 8px", borderBottom: `1px solid ${line}`, marginBottom: space.sm,
                  flexWrap: "wrap",
                }}>
                  <h3 style={{ fontFamily: font.ui, ...type.label, color: ink, fontWeight: 650, margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>
                    {group.label}
                  </h3>
                  <span style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, whiteSpace: "nowrap" }}>
                    {group.rows.length} student{group.rows.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="sa-student-list">
                  {group.rows.map(s => (
                    <StudentRow
                      key={s.id}
                      student={s}
                      selectMode={selectMode}
                      isSelected={selected.has(s.id)}
                      onToggleSelect={toggleSelect}
                      onView={setViewingStudent}
                      onDelete={handleDelete}
                      onArchive={handleArchive}
                      onRestore={handleRestore}
                      userIcon={themedUserIcon}
                    />
                  ))}
                </div>
              </section>
            ))}
            <p style={{ textAlign: "center", fontFamily: font.ui, ...type.helper, color: inkFaint, padding: "20px 0 4px" }}>
              Showing {filtered.length} of {pool.length} {viewTab === "archived" ? "archived" : "active"} student{pool.length !== 1 ? "s" : ""}
            </p>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "72px 24px", gap: space.xs, background: surface, border: `1px dashed ${color.wine400}`, borderRadius: radius.panel }}>
            {viewTab === "archived" ? (
              <>
                <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink }}>
                  {archivedStudents.length === 0 ? "No archived students" : "No archived students match this search"}
                </p>
                <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "44ch" }}>
                  {archivedStudents.length === 0
                    ? "Archiving a student moves them here. Their records, applications and account are kept."
                    : "Try a different name, ID, or batch, or clear a filter to widen the results."}
                </p>
              </>
            ) : students.length === 0 ? (
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

      {/* ── Default password was reset by an edit ── */}
      {credentialResetInfo && (
        <Dialog
          title={credentialResetInfo.authMissing ? "Saved — no login account found" : "Student account updated"}
          body={credentialResetInfo.authMissing
            ? `${credentialResetInfo.fullName}'s details were saved, but this student has no login account, so there was no password to reset. If they should be able to log in, delete this record and create the account again from New student.`
            : `${credentialResetInfo.fullName} has been notified to log out and sign in again with Student ID ${credentialResetInfo.studentId} and the new default password ${credentialResetInfo.password || "(see the student's record)"}, then set a new password. Give them these details.`}
        >
          <button onClick={() => setCredentialResetInfo(null)} style={primaryBtn}>OK</button>
        </Dialog>
      )}

      {/* ── Nothing selected for export ── */}
      {exportEmptyWarning && (
        <Dialog title="Select the students to export first" body="Tap Select, tick the students you need, then choose Export.">
          <button onClick={() => setExportEmptyWarning(false)} style={primaryBtn}>OK</button>
        </Dialog>
      )}

      {/* ── Import result ── */}
      {/* Rows that fail at the Firebase Auth step used to be console.warn-ed
          only, so a fully failed import was indistinguishable from nothing
          happening at all. Dialog renders `body` inside a <p>, so the failure
          list uses block-display spans rather than divs. */}
      {importResult && (
        <Dialog
          title={
            importResult.successCount > 0
              ? `Imported ${importResult.successCount} student${importResult.successCount !== 1 ? "s" : ""}`
              : "No students were imported"
          }
          body={
            importResult.failures.length === 0
              ? "Every row went through."
              : (
                <>
                  <span style={{ display: "block", marginBottom: space.sm }}>
                    {importResult.failures.length} row{importResult.failures.length !== 1 ? "s" : ""} couldn't be created:
                  </span>
                  <span style={{ display: "block", textAlign: "left", maxHeight: "150px", overflowY: "auto", background: color.wine800, border: `1px solid ${warning}`, borderRadius: radius.card, padding: "10px 14px" }}>
                    {importResult.failures.map((f, i) => (
                      <span key={i} style={{ display: "block", ...type.helper, color: inkBody, lineHeight: 1.6 }}>
                        {f.studentId}: {f.message}
                      </span>
                    ))}
                  </span>
                </>
              )
          }
        >
          <button onClick={() => setImportResult(null)} style={primaryBtn}>OK</button>
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

      {/* ── Bulk set batch ── */}
      {batchAssign && (
        <Dialog
          title={`Set batch for ${batchAssign.ids.length} student${batchAssign.ids.length !== 1 ? "s" : ""}`}
          body="Type the academic year these students belong to. This replaces whatever batch they have now."
        >
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: space.sm, marginBottom: space.sm }}>
            <input
              value={batchAssign.value}
              autoFocus
              onChange={e => {
                const v = e.target.value.replace(/[^\d-]/g, "").slice(0, 9);
                setBatchAssign(prev => prev && { ...prev, value: v, error: "" });
              }}
              onKeyDown={e => { if (e.key === "Enter") confirmSetBatch(); }}
              placeholder="2026-2027"
              disabled={batchAssign.busy}
              style={{
                width: "160px", textAlign: "center", padding: "10px 12px",
                borderRadius: radius.pill, border: `1.5px solid ${batchAssign.error ? danger : line}`,
                fontFamily: font.ui, ...type.control, color: ink, outline: "none", background: color.white,
              }}
            />
            {batchAssign.error && (
              <p role="alert" style={{ fontFamily: font.ui, ...type.helper, color: danger, margin: 0, textAlign: "center" }}>{batchAssign.error}</p>
            )}
          </div>
          <button onClick={() => setBatchAssign(null)} disabled={batchAssign.busy} style={ghostBtn}>Cancel</button>
          <button onClick={confirmSetBatch} disabled={batchAssign.busy} style={primaryBtn}>
            {batchAssign.busy ? "Saving…" : "Set batch"}
          </button>
        </Dialog>
      )}

      {/* ── Archive / restore confirmation ── */}
      {confirmArchiveInfo && (
        <Dialog
          title={confirmArchiveInfo.bulk
            ? (confirmArchiveInfo.mode === "archive"
                ? `Archive ${confirmArchiveInfo.count} student account${confirmArchiveInfo.count !== 1 ? "s" : ""}?`
                : `Restore ${confirmArchiveInfo.count} student account${confirmArchiveInfo.count !== 1 ? "s" : ""}?`)
            : (confirmArchiveInfo.mode === "archive" ? "Archive student?" : "Restore student?")}
          body={confirmArchiveInfo.bulk
            ? (confirmArchiveInfo.mode === "archive"
                ? `These accounts move to the Archived Students section and the students can no longer log in. Their records and application history are not deleted, and you can restore them any time.`
                : `These accounts return to the active student list and the students will be able to log in again.`)
            : (confirmArchiveInfo.mode === "archive"
                ? `Are you sure you want to archive ${confirmArchiveInfo.student.fullName || confirmArchiveInfo.student.studentId}? This account moves to the Archived Students section. Their records and application history are not deleted, and they can be restored later.`
                : `Restore ${confirmArchiveInfo.student.fullName || confirmArchiveInfo.student.studentId} to the active student list? They'll be able to log in again.`)}
        >
          {confirmArchiveInfo.error && (
            <p role="alert" style={{ fontFamily: font.ui, ...type.helper, color: danger, width: "100%", textAlign: "center", marginBottom: space.sm }}>
              {confirmArchiveInfo.error}
            </p>
          )}
          <button onClick={() => setConfirmArchiveInfo(null)} disabled={archiveBusy} style={ghostBtn}>Cancel</button>
          <button onClick={confirmArchive} disabled={archiveBusy} style={primaryBtn}>
            {archiveBusy
              ? (confirmArchiveInfo.mode === "archive" ? "Archiving…" : "Restoring…")
              : confirmArchiveInfo.bulk
                ? (confirmArchiveInfo.mode === "archive" ? `Archive ${confirmArchiveInfo.count}` : `Restore ${confirmArchiveInfo.count}`)
                : (confirmArchiveInfo.mode === "archive" ? "Archive" : "Restore")}
          </button>
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
              {[["Student ID", successInfo.studentId], ["Full name", successInfo.fullName], ["Password", successInfo.password]].map(([label, val]) => (
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