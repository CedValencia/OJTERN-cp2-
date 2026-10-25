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
  "BSBA (Major in Marketing Management)":  "Bachelor of Science in Business Administration",
  "BSA":                                   "Bachelor of Science in Accountancy",
  "BS CRIM":                               "Bachelor of Science in Criminology",
  "BA POLSCI":                             "Bachelor of Arts in Political Science",
  "BEED":                                  "Bachelor of Elementary Education",
  "BSED (Major in English)":               "Bachelor of Secondary Education",
  "BSED (Major in Mathematics)":           "Bachelor of Secondary Education",
  "BSTM":                                  "Bachelor of Science in Tourism Management",
  "BSHM":                                  "Bachelor of Science in Hospitality Management",
};

// ── Sections (per department) ────────────────────────────────────────────────
// There is no fixed list any more. The Section dropdown of a department shows only the sections that
// already exist there (a student is in them), plus "+ Add new section". A department with no
// students yet starts by adding its first section. Nothing is stored apart from each student's
// own yearSection, so a section appears when its first student is saved and disappears with its last.
const sectionKey  = (v) => String(v || "").trim().replace(/\s+/g, " ").toLowerCase();
const collegeKey  = sectionKey;
// A section is identified by its department AND its label: CCS's "4-A" and CBA's "4-A" are two
// different sections, and so are "4-A" and "5-A". Used by the Section filter. "" = no section.
const sectionIdOf = (s) => (sectionKey(s?.yearSection) ? `${collegeKey(s?.college)}|${sectionKey(s.yearSection)}` : "");
// What a coordinator typed -> the label that gets saved, or "" when unusable.
// "a", "4a", "4-a", "4 - A" → "4-A" (4th year is the default year); anything else ("4-Gold", "4-1")
// is kept as typed with its spaces squashed.
const formatSection = (value) => {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  const m = /^(?:(\d)\s*-?\s*)?([A-Za-z])$/.exec(raw);
  if (m) return `${m[1] || "4"}-${m[2].toUpperCase()}`;
  return /^[A-Za-z0-9][A-Za-z0-9 .\-]{0,19}$/.test(raw) ? raw : "";
};
const uniqueSections = (list) => {
  const seen = new Map();
  list.forEach((x) => { const k = sectionKey(x); if (k && !seen.has(k)) seen.set(k, String(x).trim()); });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
};
// { [collegeKey]: ["4-A", "4-B"] } -> the sections of one department.
const sectionsOfCollege = (byCollege, college) => (byCollege && byCollege[collegeKey(college)]) || [];
// Short name of a department for labels ("CCS"), falling back to its full name.
const deptAbbrOf = (departments, college) => {
  const name = Object.keys(departments || {}).find(n => collegeKey(n) === collegeKey(college));
  return (name && departments[name]?.abbr) || college || "";
};

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
// Suffix sits after Middle Initial, same order as the New Student form, and is
// optional per row. Templates downloaded before it existed (no Suffix column)
// are still accepted — see LEGACY_IMPORT_LAYOUTS in parseFile.
const IMPORT_TEMPLATE_COLUMNS = [
  "Student ID", "Last Name", "First Name", "Middle Initial", "Suffix",
];
// Sex is no longer collected. Templates downloaded earlier still have a Sex
// column after Suffix: they match IMPORT_TEMPLATE_COLUMNS above (a prefix match)
// and the extra column is simply ignored.
// There is no Department column any more: every imported student gets the
// coordinator's own department (picked in the Import form only when the
// coordinator has more than one). Older templates are still accepted; their
// Department column is simply ignored.
const LEGACY_IMPORT_LAYOUTS = [
  // Before "Middle Initial": the column held a full middle name (reduced to its initial on import).
  ["Student ID", "Last Name", "First Name", "Middle Name", "Suffix", "Sex"],
  ["Student ID", "Last Name", "First Name", "Middle Name", "Suffix", "Department", "Sex"],
  ["Student ID", "Last Name", "First Name", "Middle Name", "Department", "Sex"],
];

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
// Message for the field's error line ("" = fine). Specific on purpose, so the
// coordinator can see WHAT is wrong with what they typed.
const batchProblem = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "Required";
  if (normalizeBatch(raw)) return "";
  if (/^\d{4}\s*[-\u2013\u2014]\s*\d{2,4}$/.test(raw)) return "The two years must be consecutive, e.g. 2026-2027";
  return "Use an academic year like 2026-2027";
};
// "2026-27" is accepted; tell the person what will really be saved.
const batchHint = (value) => {
  const n = normalizeBatch(value);
  return n && n !== String(value || "").trim() ? `Will be saved as ${n}` : "";
};
const batchStartYear = (key) => Number(String(key).split("-")[0]) || 0;

// Newest batch first; "No batch set" always last.
const sortBatchKeys = (keys) => [...keys].sort((a, b) => {
  if (a === BATCH_NONE) return 1;
  if (b === BATCH_NONE) return -1;
  return batchStartYear(b) - batchStartYear(a);
});

// "Santos" or "S" → "S."; blank stays blank. The rest of the app (profile form,
// fullName, exports) works with a middle initial. New students are entered as an
// initial; older import files may still carry a full middle name.
const toMiddleInitial = (middleName) => {
  const first = String(middleName || "").trim().charAt(0);
  return first ? `${first.toUpperCase()}.` : "";
};

// Accepts "4-A", "4A", "4 - A", or a bare "A" (the only year is 4th year) and returns the
// canonical "4-A" form, or any other well-formed label as typed. "" if it isn't usable.
const normalizeSection = formatSection;

// ── Birthdate / age ──────────────────────────────────────────────────────────
// The student enters a birthdate on first login (StudentAccountProfileScreen) and
// the age is derived from it. Age is worked out here from the birthdate, so it
// stays current; the stored `age` number is only a fallback for accounts that
// predate birthdates. Kept in step with the helpers in that file.
const parseBirthdate = (v) => {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
};
const ageFromBirthdate = (v, today = new Date()) => {
  const b = parseBirthdate(v);
  if (!b) return null;
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
};
const formatBirthdate = (v) => {
  const b = parseBirthdate(v);
  return b ? b.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
};

const NAME_REGEX = /^[A-Za-zÑñ][A-Za-zÑñ\s\-]*$/;
const MIDDLE_INITIAL_REGEX = /^[A-ZÑ]\.$/;
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
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 0;
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

    /* Student table — same layout as the Report List screen: one table per
       batch, with Name / Status / Action columns. Cards take over on phones. */
    .sa-table-wrap {
      width: 100%;
      overflow-x: auto;
      border: 1px solid ${line};
      border-radius: 18px;
      background: ${surface};
    }
    .sa-table {
      width: 100%;
      min-width: 480px;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 0.90rem;
      background: ${surface};
    }
    .sa-th {
      padding: 13px 14px;
      text-align: left;
      color: ${ink};
      background: ${lineSoft};
      border-bottom: 1px solid ${line};
      font-family: ${font.ui};
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .sa-td {
      padding: 15px 14px;
      color: ${ink};
      background: ${surface};
      font-family: ${font.ui};
      font-weight: 500;
      border-bottom: 1px solid ${line};
      vertical-align: middle;
    }
    .sa-table tbody tr:last-child .sa-td { border-bottom: none; }
    .sa-table tbody tr:hover .sa-td { background: ${color.hoverWash}; }
    .sa-card-list { display: none; flex-direction: column; gap: 10px; }
    .sa-card {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: 18px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    @media (max-width: 780px) {
      .sa-table-wrap { display: none; }
      .sa-card-list { display: flex; }
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
      overflow-x: hidden;
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

    /* Let grid cells shrink to the container instead of pushing it wider, and
       stack every field vertically on phones. */
    .sa-name-grid > *,
    .sa-college-grid > *,
    .sa-info-grid > * { min-width: 0; }
    @media (max-width: 560px) {
      .sa-name-grid,
      .sa-college-grid,
      .sa-info-grid { grid-template-columns: minmax(0, 1fr); }
      /* Smaller footer buttons so Archive / Delete / Edit fit on one row */
      .sa-modal-footer { gap: 6px; }
      .sa-modal-footer button {
        padding: 6px 14px !important;
        font-size: 0.78rem !important;
      }
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
  batch: (v) => batchProblem(v),
  middleName: (v) => {
    if (!v) return "";
    if (!NAME_REGEX.test(v)) return "Letters, Ñ/ñ and hyphens only";
    return "";
  },
  middleInitial: (v) => {
    if (!v) return "";
    if (!/^[A-ZÑ]$/.test(v) && !MIDDLE_INITIAL_REGEX.test(v)) return "Format: M.";
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

const IMPORT_TEMPLATE_LAST_ROW = 200;

const escXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const NAME_LETTERS = "abcdefghijklmnopqrstuvwxyzñ";
const excelNameRule = (cell) =>
  `AND(LEN(${cell})<=60,` +
  `ISNUMBER(FIND(LEFT(LOWER(${cell}),1),"${NAME_LETTERS}")),` +
  `SUMPRODUCT(ISNUMBER(FIND(MID(LOWER(${cell}),ROW($1:$60),1),"${NAME_LETTERS} -"))*(MID(${cell},ROW($1:$60),1)<>""))=LEN(${cell}))`;
// Middle initial: one letter, with or without the dot ("S" or "S.").
const excelInitialRule = (cell) =>
  `AND(LEN(${cell})<=2,ISNUMBER(FIND(LEFT(LOWER(${cell}),1),"${NAME_LETTERS}")),OR(LEN(${cell})=1,RIGHT(${cell},1)="."))`;
const excelStudentIdRule = (cell) =>
  `AND(LEN(${cell})=9,SUMPRODUCT(--ISNUMBER(--MID(${cell},ROW($1:$9),1)))=9)`;

// The sheet is PROTECTED and everything outside it is hidden: only Student ID … Suffix
// on rows 3–200 are editable, so nobody can type outside the designated columns. Each editable column also has
// an Excel validation rule that mirrors the checks the import runs, so a wrong
// value is refused while typing instead of failing after Import. (xlsx-js-style
// can write neither data validation nor unlocked cells, so both are patched into
// the XML below.) Protection has no password: it is a guard-rail, not security,
// and Excel's validation can still be bypassed by pasting — the import check
// remains the real safety net.
const buildImportTemplate = async (outType = "blob") => {
  const colCount = IMPORT_TEMPLATE_COLUMNS.length;
  const lastRow = IMPORT_TEMPLATE_LAST_ROW;
  const rows = [
    IMPORT_TEMPLATE_COLUMNS,
    ["e.g. 201112345", "e.g. Dela Cruz", "e.g. Juan", "e.g. S. (or blank)", "e.g. Jr. (or blank)"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 15 }, { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 18 }];

  for (let r = 2; r < lastRow; r++) {
    for (let c = 0; c < colCount; c++) {
      ws[XLSX.utils.encode_cell({ r, c })] = { t: "s", v: "" };
    }
  }
  for (let c = 0; c < colCount; c++) {
    const headerCell = XLSX.utils.encode_cell({ r: 0, c });
    ws[headerCell].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "161616" } },
      alignment: { horizontal: "center" },
    };
    ws[XLSX.utils.encode_cell({ r: 1, c })].s = {
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
      font: { name: "Calibri", sz: 11, color: { rgb: "A85450" } },
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top:    { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left:   { style: "thin", color: { rgb: "000000" } },
        right:  { style: "thin", color: { rgb: "000000" } },
      },
    };
  }
  ws["!ref"] = `A1:${XLSX.utils.encode_col(colCount - 1)}${lastRow}`;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Student Template");

  const col = (name) => XLSX.utils.encode_col(IMPORT_TEMPLATE_COLUMNS.indexOf(name));
  const range = (name) => `${col(name)}3:${col(name)}${lastRow}`;
  const rule = ({ name, type, formula, title, message, prompt }) =>
    `<dataValidation type="${type}" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" ` +
    `errorTitle="${escXml(title)}" error="${escXml(message)}" promptTitle="${escXml(name)}" prompt="${escXml(prompt)}" sqref="${range(name)}">` +
    `<formula1>${escXml(formula)}</formula1></dataValidation>`;
  const rules = [
    rule({ name: "Student ID", type: "custom", formula: excelStudentIdRule(`${col("Student ID")}3`),
      title: "Invalid Student ID", message: "Student ID must be exactly 9 digits. Numbers only, no spaces or symbols.", prompt: "Exactly 9 digits." }),
    rule({ name: "Last Name", type: "custom", formula: excelNameRule(`${col("Last Name")}3`),
      title: "Invalid last name", message: "Use letters, Ñ/ñ, spaces and hyphens only. It must start with a letter.", prompt: "Letters, spaces and hyphens only." }),
    rule({ name: "First Name", type: "custom", formula: excelNameRule(`${col("First Name")}3`),
      title: "Invalid first name", message: "Use letters, Ñ/ñ, spaces and hyphens only. It must start with a letter.", prompt: "Letters, spaces and hyphens only." }),
    rule({ name: "Middle Initial", type: "custom", formula: excelInitialRule(`${col("Middle Initial")}3`),
      title: "Invalid middle initial", message: "Type one letter only, like S or S. Leave it blank if there is none.", prompt: "Optional. One letter, like S." }),
    rule({ name: "Suffix", type: "list", formula: `"${SUFFIX_OPTIONS.join(",")}"`,
      title: "Invalid suffix", message: "Choose a suffix from the list, or leave it blank.", prompt: "Optional. Jr., Sr., II, III … or leave blank." }),
  ];
  const dataValidation = `<dataValidations count="${rules.length}">${rules.join("")}</dataValidations>`;
  const sheetProtection = '<sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0"/>';

  const rawFile = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const zip = await JSZip.loadAsync(rawFile);

  const stylesPath = "xl/styles.xml";
  let styles = await zip.file(stylesPath).async("string");
  const xfsMatch = styles.match(/<cellXfs count="(\d+)">/);
  if (!xfsMatch) throw new Error("cellXfs not found");
  const unlockedIdx = Number(xfsMatch[1]);
  styles = styles
    .replace(xfsMatch[0], `<cellXfs count="${unlockedIdx + 1}">`)
    .replace("</cellXfs>", '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyProtection="1"><protection locked="0"/></xf></cellXfs>');
  zip.file(stylesPath, styles);

  const sheetPath = "xl/worksheets/sheet1.xml";
  let xml = await zip.file(sheetPath).async("string");
  xml = xml.replace(/<c r="([A-Z]+)(\d+)" s="\d+"/g, (m, c, r) => (Number(r) >= 3 && Number(r) <= lastRow ? `<c r="${c}${r}" s="${unlockedIdx}"` : m));
  xml = xml.replace("</sheetData>", `</sheetData>${sheetProtection}`);
  // Everything outside the template is HIDDEN, not just locked: columns after the
  // last one, and every row after the last data row (rows default to hidden;
  // rows 1–lastRow all exist explicitly). Google Sheets ignores a .xlsx's sheet
  // protection but does honour hidden rows/columns, so there is simply nothing
  // outside the template to click into, in any spreadsheet app.
  xml = xml.replace("</cols>", `<col min="${colCount + 1}" max="16384" width="9" customWidth="1" hidden="1"/></cols>`);
  xml = xml.replace("</sheetViews>", '</sheetViews><sheetFormatPr defaultRowHeight="15" zeroHeight="1"/>');
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

  return zip.generateAsync({ type: outType });
};

const downloadTemplateXLSX = async () => {
  try {
    const blob = await buildImportTemplate("blob");
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
    console.error("Failed to build the protected template:", err);
    const ws = XLSX.utils.aoa_to_sheet([IMPORT_TEMPLATE_COLUMNS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student Template");
    XLSX.writeFile(wb, "student_import_template.xlsx");
  }
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
        {/* A disabled (read-only) select with nothing chosen stays blank: its
            placeholder ("None", "Select section"…) would read like saved data. */}
        {selected ? selected.label : (disabled ? "\u00A0" : placeholder)}
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

// Placeholders are hints for typing, so they are hidden while the field is disabled
// (the read-only student view): an empty field there should look empty.
const StyledInput = ({ value, onChange, placeholder, type: inputType = "text", disabled, hasError }) => (
  <input
    type={inputType} value={value} onChange={e => onChange(e.target.value)} placeholder={disabled ? "" : placeholder} disabled={disabled}
    style={{ width: "100%", background: disabled ? color.wine800 : color.white, border: `1px solid ${hasError ? danger : line}`, borderRadius: radius.pill, padding: "9px 14px", fontFamily: font.ui, ...type.helper, color: ink, outline: "none", boxSizing: "border-box" }}
  />
);

const FieldLabel = ({ children }) => (
  <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: "6px", marginTop: "12px" }}>{children}</p>
);

const FieldError = ({ msg }) => msg ? (
  <p style={{ fontFamily: font.ui, ...type.helper, color: danger, marginTop: "4px", paddingLeft: "14px" }}>{msg}</p>
) : null;

// ── Section picker ────────────────────────────────────────────────────────────
// Lists ONLY the sections that already exist in `college` (the `existing` list), plus
// "+ Add new section". A section added here is kept in this form's list straight away; it becomes
// a real, shared section once the student is saved. Needs a department first, because sections
// belong to a department.
const ADD_SECTION = "__add_section__";
const SectionSelect = ({ value, onChange, college, existing = [], disabled, hasError }) => {
  const [added, setAdded]     = useState({});      // { [collegeKey]: [sections added in this form] }
  const [adding, setAdding]   = useState(false);
  const [text, setText]       = useState("");
  const [problem, setProblem] = useState("");
  const ck = collegeKey(college);
  useEffect(() => { setAdding(false); setText(""); setProblem(""); }, [ck]);

  if (!college && !value) {
    return <StyledSelect value="" onChange={() => {}} options={[]} placeholder="Select a department first" disabled />;
  }
  const options = uniqueSections([...existing, ...(added[ck] || []), value]);

  const confirmAdd = () => {
    const label = formatSection(text);
    if (!label) { setProblem("Use a section like 4-A (letters, numbers, spaces or dashes, up to 20 characters)."); return; }
    const duplicate = options.find(o => sectionKey(o) === sectionKey(label));
    const finalLabel = duplicate || label;
    if (!duplicate) setAdded(a => ({ ...a, [ck]: [...(a[ck] || []), finalLabel] }));
    onChange(finalLabel);
    setAdding(false); setText(""); setProblem("");
  };

  if (adding) {
    return (
      <div onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmAdd(); } if (e.key === "Escape") { e.stopPropagation(); setAdding(false); } }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 130px", minWidth: 0 }}>
            <StyledInput value={text} onChange={(v) => { setText(v.slice(0, 20)); setProblem(""); }} placeholder="e.g. 4-A" hasError={!!problem} />
          </div>
          <button type="button" onClick={confirmAdd} style={{ ...primaryBtn, padding: "9px 16px" }}>Add</button>
          <button type="button" onClick={() => { setAdding(false); setText(""); setProblem(""); }} style={{ ...ghostBtn, padding: "9px 16px" }}>Cancel</button>
        </div>
        <FieldError msg={problem} />
      </div>
    );
  }
  return (
    <StyledSelect
      value={value}
      onChange={(v) => (v === ADD_SECTION ? setAdding(true) : onChange(v))}
      options={[...options.map(sec => ({ value: sec, label: sec })), { value: ADD_SECTION, label: "+ Add new section" }]}
      placeholder={options.length ? "Select section" : "No sections yet — add one"}
      disabled={disabled}
      hasError={hasError}
    />
  );
};

const useField = (initial = "", validatorKey) => {
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const error = touched ? (validators[validatorKey] ? validators[validatorKey](value) : "") : "";
  const onChange = (val) => { setValue(val); setTouched(true); };
  const touch = () => setTouched(true);
  const reset = (v = "") => { setValue(v); setTouched(false); };
  return { value, onChange, touch, reset, error, hasError: !!error };
};

// ── Program / Major picker ────────────────────────────────────────────────────
// Department comes from the coordinator. Program is always shown (disabled until a
// department is chosen; pre-selected when the department has only one program), and
// Major only when the chosen program has majors.
// `programs` is the department's [{ name, specializations }] list. Leaving Program
// blank is allowed when there are several: the student then sets it on first login.
const programsOf = (departments, college) => (college ? (departments[college]?.programs || []) : []);
const programMajorState = (programs, program) => {
  const single   = programs.length === 1 ? programs[0] : null;
  const active   = single || programs.find(p => p.name === program) || null;
  const majors   = (active?.specializations || []).filter(Boolean);
  return { showProgram: programs.length > 1, showMajor: majors.length > 0, majors, activeName: active?.name || "" };
};
const ProgramMajorFields = ({ programs, program, major, onProgram, onMajor, Label = FieldLabel, programError = "", majorError = "" }) => {
  const { showMajor, majors, activeName } = programMajorState(programs, program);
  const hasPrograms = programs.length > 0;
  return (
    <>
      <div style={{ gridColumn: "1 / -1" }}>
        <Label>Program <span style={{ color: danger }}>*</span></Label>
        <StyledSelect
          value={program || activeName}
          onChange={onProgram}
          options={programs.map(p => p.name)}
          placeholder={hasPrograms ? "Select program" : "Select a department first"}
          disabled={!hasPrograms}
          hasError={!!programError}
        />
        {programError && <p role="alert" style={{ fontFamily: font.ui, ...type.helper, color: danger, margin: "4px 0 0 14px" }}>{programError}</p>}
      </div>
      {showMajor && (
        <div style={{ gridColumn: "1 / -1" }}>
          <Label>Major <span style={{ color: danger }}>*</span></Label>
          <StyledSelect value={major} onChange={onMajor} options={majors} placeholder="Select major" hasError={!!majorError} />
          {majorError && <p role="alert" style={{ fontFamily: font.ui, ...type.helper, color: danger, margin: "4px 0 0 14px" }}>{majorError}</p>}
        </div>
      )}
    </>
  );
};
const SmallLabel = ({ children }) => (
  <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginBottom: "4px" }}>{children}</p>
);

// ── Student Form ───────────────────────────────────────────────────────────────
const StudentForm = ({ initial = {}, readOnly = false, onClose, onSubmit, submitLabel = "Create account", coordinatorColleges = [], departments = {}, sectionsByCollege = {}, archived = false, onArchive, onRestore, onDelete }) => {
  const studentId     = useField(initial.studentId || "", "studentId");
  const lastName      = useField(initial.lastName || "", "lastName");
  const middleInitial = useField(initial.middleInitial || "", "middleInitial");
  // New accounts ask for exactly what the import template asks for (Student ID,
  // Last Name, First Name, Middle Initial, Section, Department); the student fills
  // in the rest on first login. Viewing/editing an existing student still shows
  // every field.
  const isCreate      = !readOnly;
  const middleName    = useField(initial.middleName || "", "middleInitial");
  // Graduating batch year — separate from Year & section (see BATCH_NONE above).
  const batch         = useField(initial.batch || "", "batch");
  const firstName     = useField(initial.firstName || "", "firstName");
  const suffix        = useField(initial.suffix || "", "suffix");
  // Sex is no longer collected for new students. Existing records keep theirs.
  const [sex]   = useState(initial.sex || "");   // display only — the coordinator no longer edits it
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
  const [major, setMajor]     = useState(initial.specialization || "");   // the student's major, if their program has any
  const [collegeTouched, setCollegeTouched] = useState(false);
  const [programTouched, setProgramTouched] = useState(false);
  const [isEditing, setIsEditing]           = useState(!readOnly);
  const [saving, setSaving]                 = useState(false);
  const [submitError, setSubmitError]       = useState("");

  const programs = college ? (departments[college]?.programs || []).map(p => p.name) : [];
  const collegeError = collegeTouched && !college ? "Required" : "";
  const programError = programTouched && !program ? "Required" : "";

  // Sections belong to a department, so a different department starts with no section chosen.
  const handleCollegeChange = (val) => { setCollege(val); setProgram(""); setMajor(""); setCollegeTouched(true); yearSection.reset(""); };
  const sectionList = sectionsOfCollege(sectionsByCollege, college);
  const handleProgramChange = (val) => { setProgram(val); setMajor(""); setProgramTouched(true); };
  const programObjs = programsOf(departments, college);
  const pm = programMajorState(programObjs, program);
  // The department's only program is filled in automatically; otherwise the
  // coordinator must pick one.
  const createProgram = programObjs.length === 1 ? programObjs[0].name : program;
  const [majorTouched, setMajorTouched] = useState(false);
  const createProgramError = programTouched && !createProgram ? "Required" : "";
  const createMajorError   = majorTouched && pm.showMajor && !major ? "Required" : "";

  const allFields = isCreate
    ? [studentId, lastName, firstName, middleName, suffix, yearSection, batch]
    : [studentId, lastName, middleInitial, firstName, suffix, yearSection, age, batch];
  const touchAll = () => { allFields.forEach(f => f.touch()); setCollegeTouched(true); setProgramTouched(true); setMajorTouched(true); };

  const isValid = () => {
    if (validators.studentId(studentId.value)) return false;
    if (validators.lastName(lastName.value)) return false;
    if (validators.firstName(firstName.value)) return false;
    if (validators.yearSection(yearSection.value)) return false;
    if (!college) return false;
    if (validators.batch(batch.value)) return false;
    if (isCreate) {
      if (validators.middleInitial(middleName.value)) return false;
      if (validators.suffix(suffix.value)) return false;
      // Program and major are set here by the coordinator and are final: the
      // student can no longer change them on first login.
      if (!createProgram) return false;
      if (pm.showMajor && !major) return false;
      return true;
    }
    if (validators.middleInitial(middleInitial.value)) return false;
    if (validators.suffix(suffix.value)) return false;
    // Age is the student's own field (set on their Personal Information), so
    // it's never validated or changed from here.
    if (!program) return false;
    if (pm.showMajor && !major) return false;
    return true;
  };

  // Changing any of these rebuilds the DEFAULT password (see
  // generateStudentPassword), so the student is signed out and must log in
  // again with the updated Student ID + new default password.
  // The name, Student ID and department (editable only for a coordinator who
  // handles more than one) can change the default password.
  const credentialsChanged = !isCreate && (
    college !== String(initial.college || "") ||
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
        // age and email come from the student on first login. The suffix is
        // optional and set here (it's part of the name on the list).
        // Department, program and major are set here and cannot be changed by
        // the student: program is the department's only one, else what was
        // picked; major is required when the program has majors.
        await onSubmit({
          studentId: studentId.value.trim(),
          lastName: lastName.value.trim(),
          firstName: firstName.value.trim(),
          // One letter is all we ask for; both fields get it so anything that reads either works.
          middleName: middleName.value.replace(/\./g, "").trim(),
          middleInitial: toMiddleInitial(middleName.value),
          yearSection: yearSection.value,
          college,
          program: createProgram,
          batch: normalizeBatch(batch.value) || batch.value.trim(),
          specialization: pm.showMajor ? major : "", suffix: isRealSuffix(suffix.value) ? suffix.value : "", age: "",
        });
        return;
      }
      await onSubmit({
        batch: normalizeBatch(batch.value) || batch.value.trim(),
        studentId: studentId.value, lastName: lastName.value,
        middleInitial: middleInitial.value, firstName: firstName.value,
        suffix: suffix.value, college, program,
        // A different program invalidates its old specialization, so it is reset
        // (to the major picked for the new program, if any). With the same
        // program, the major is only sent when it was changed here, so an
        // untouched record is never rewritten.
        ...(program !== (initial.program || "")
          ? { specialization: pm.showMajor ? major : "" }
          : major !== (initial.specialization || "") ? { specialization: major } : {}),
        yearSection: yearSection.value,
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
  // Asterisks only show while the form can actually be edited (hidden in view mode).
  const reqStar = locked ? null : <span style={{ color: danger }}>*</span>;

  // fullName — used for the modal header. Now includes the suffix (e.g. "Jr.")
  // and stays live: it recomputes from the current field values while editing,
  // and falls back to the original `initial` data before any edits are made.
  // Middle initial shown as "S." whether it was typed "S" or "S.". On create
  // the Middle initial input is the one called middleName here.
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
            <FieldLabel>Student ID {reqStar}</FieldLabel>
            <div style={{ width: "min(220px, 100%)" }}>
              <StyledInput value={studentId.value} onChange={onStudentIdChange} placeholder="9-digit number" disabled={locked} hasError={!!studentId.error} />
              <FieldError msg={studentId.error} />
            </div>
          </div>

          {isCreate ? (
            <>
              {/* Same fields, in the same order, as the import template. */}
              <div className="sa-name-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))" }}>
                <div>
                  <FieldLabel>Last name {reqStar}</FieldLabel>
                  <StyledInput value={lastName.value} onChange={onLastNameChange} placeholder="Dela Cruz" hasError={!!lastName.error} />
                  <FieldError msg={lastName.error} />
                </div>
                <div>
                  <FieldLabel>First name {reqStar}</FieldLabel>
                  <StyledInput value={firstName.value} onChange={onFirstNameChange} placeholder="Juan" hasError={!!firstName.error} />
                  <FieldError msg={firstName.error} />
                </div>
                <div>
                  <FieldLabel>Middle initial</FieldLabel>
                  <StyledInput value={middleName.value} onChange={(v) => middleName.onChange(v.toUpperCase().replace(/[^A-ZÑ.]/g, "").slice(0, 2))} placeholder="M. (optional)" hasError={!!middleName.error} />
                  <FieldError msg={middleName.error} />
                </div>
                <div>
                  <FieldLabel>Suffix</FieldLabel>
                  <StyledSelect value={suffix.value} onChange={(v) => suffix.onChange(v)} options={SUFFIX_OPTIONS} placeholder="None" hasError={!!suffix.error} />
                  <FieldError msg={suffix.error} />
                </div>
              </div>

              <div className="sa-college-grid">
                {/* Only a coordinator with more than one department picks one.
                    Everyone else's students simply get their own department. */}
                {coordinatorColleges.length > 1 && (
                  <div>
                    <FieldLabel>Department {reqStar}</FieldLabel>
                    <StyledSelect
                      value={college}
                      onChange={handleCollegeChange}
                      options={coordinatorColleges.map(name => ({ value: name, label: name }))}
                      placeholder="Select department"
                      hasError={!!collegeError}
                    />
                    <FieldError msg={collegeError} />
                  </div>
                )}
                <div>
                  <FieldLabel>Section {reqStar}</FieldLabel>
                  <SectionSelect value={yearSection.value} onChange={(v) => yearSection.onChange(v)} college={college} existing={sectionList} hasError={!!yearSection.error} />
                  <FieldError msg={yearSection.error} />
                </div>
                <div>
                  <FieldLabel>Batch {reqStar}</FieldLabel>
                  <StyledInput value={batch.value} onChange={(v) => batch.onChange(v.replace(/[^\d-]/g, "").slice(0, 9))} placeholder="2026-2027" hasError={!!batch.error} />
                  <FieldError msg={batch.error} />
                  {!batch.error && batchHint(batch.value) && <p style={{ fontFamily: font.ui, ...type.helper, color: success, marginTop: "4px", paddingLeft: "14px" }}>{batchHint(batch.value)}</p>}
                </div>
                <ProgramMajorFields programs={programObjs} program={program} major={major} onProgram={(v) => { handleProgramChange(v); setMajorTouched(false); }} onMajor={(v) => { setMajor(v); setMajorTouched(true); }} programError={createProgramError} majorError={createMajorError} />
              </div>

              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: space.sm, lineHeight: 1.6 }}>
                {coordinatorColleges.length <= 1 && college ? `Added to ${college}, your department. ` : ""}
                {reqStar} Required. Department, program and major are set here and the student can't change them. The student adds their age and personal email on their first login.
              </p>
            </>
          ) : (
          <>
          <div className="sa-name-grid">
            <div>
              <FieldLabel>Last name {reqStar}</FieldLabel>
              <StyledInput value={lastName.value} onChange={onLastNameChange} placeholder="Dela Cruz" disabled={locked} hasError={!!lastName.error} />
              <FieldError msg={lastName.error} />
            </div>
            <div>
              <FieldLabel>Middle initial</FieldLabel>
              <StyledInput value={middleInitial.value} onChange={onMiddleInitialChange} placeholder="M." disabled={locked} hasError={!!middleInitial.error} />
              <FieldError msg={middleInitial.error} />
            </div>
            <div>
              <FieldLabel>First name {reqStar}</FieldLabel>
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
              <FieldLabel>Department{coordinatorColleges.length > 1 && <> {reqStar}</>}</FieldLabel>
              {/* Locked to the coordinator's own department(s) — never the
                  full college list. Single department → static label so it
                  can't be changed. Multiple → dropdown, but restricted to
                  just the coordinator's assigned departments. */}
              {/* A coordinator who handles more than one department can place a
                  new student in, or move an existing one to, any of their own
                  departments. With a single department it stays a fixed label. */}
              {coordinatorColleges.length > 1 ? (
                <>
                  <StyledSelect
                    value={college}
                    onChange={handleCollegeChange}
                    options={(college && !coordinatorColleges.includes(college) ? [college, ...coordinatorColleges] : coordinatorColleges).map(name => ({ value: name, label: name }))}
                    placeholder="Select your department"
                    disabled={locked}
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
              <FieldLabel>Program {reqStar}</FieldLabel>
              <StyledSelect value={program} onChange={handleProgramChange} options={programs} placeholder="Select program" disabled={locked || !college} hasError={!!programError} />
              <FieldError msg={programError} />
            </div>
            {/* Major — only when the program has majors (or one is already on file). */}
            {(pm.showMajor || major) && (
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Major{pm.showMajor && <> {reqStar}</>}</FieldLabel>
                <StyledSelect
                  value={major}
                  onChange={(v) => { setMajor(v); setMajorTouched(true); }}
                  options={major && !pm.majors.includes(major) ? [...pm.majors, major] : pm.majors}
                  placeholder="Not set"
                  disabled={locked || !program}
                  hasError={!!createMajorError}
                />
                <FieldError msg={createMajorError} />
              </div>
            )}
          </div>

          <div id="sa-modal-info" className="sa-info-grid">
            <div>
              <FieldLabel>Year & section {reqStar}</FieldLabel>
              <SectionSelect value={yearSection.value} onChange={(v) => yearSection.onChange(v)} college={college} existing={sectionList} disabled={locked} hasError={!!yearSection.error} />
              <FieldError msg={yearSection.error} />
            </div>
            <div>
              <FieldLabel>Sex</FieldLabel>
              <StyledSelect value={sex} onChange={() => {}} options={SEX_OPTIONS} placeholder="Not set" disabled />
            </div>
            <div>
              <FieldLabel>Birthdate</FieldLabel>
              {/* The student sets this on first login (or in their own profile),
                  so a coordinator never types it here. */}
              <StyledInput value={formatBirthdate(initial.birthdate)} onChange={() => {}} placeholder="Not set yet" disabled hasError={false} />
              {isEditing && readOnly && (
                <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: "4px" }}>Set by the student</p>
              )}
            </div>
            <div>
              <FieldLabel>Age</FieldLabel>
              {/* Worked out from the birthdate, so it stays current. */}
              <StyledInput value={String(age.value ?? "")} onChange={onAgeChange} disabled hasError={false} />
            </div>
            <div>
              <FieldLabel>Batch {reqStar}</FieldLabel>
              <StyledInput value={batch.value} onChange={(v) => batch.onChange(v.replace(/[^\d-]/g, "").slice(0, 9))} placeholder="2026-2027" disabled={locked} hasError={!!batch.error} />
              <FieldError msg={batch.error} />
            </div>
          </div>

          {!locked && (
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: space.sm, lineHeight: 1.6 }}>
            {reqStar} Required. Only the fields marked with an asterisk, plus Middle initial and Suffix, can be edited here. Sex, birthdate, age and personal email are set by the student.
          </p>
          )}

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
          <div className="sa-modal-footer" style={{ flexWrap: "wrap" }}>
            {isEditing ? (
              <>
                <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
                <button onClick={requestSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </>
            ) : (
              <>
                {(onArchive || onRestore || onDelete) && (
                  <div id="sa-modal-account-actions" style={{ marginRight: "auto", display: "flex", gap: space.sm, flexWrap: "wrap" }}>
                    {archived
                      ? onRestore && <button onClick={onRestore} style={ghostBtn}>Restore</button>
                      : onArchive && <button onClick={onArchive} style={ghostBtn}>Archive</button>}
                    {onDelete && <button onClick={onDelete} style={{ ...ghostBtn, color: danger, borderColor: danger }}>Delete</button>}
                  </div>
                )}
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

const validateRow = (row, rowIndex, seenIds = new Map(), existingIds = new Set()) => {
  const errs = []; const r = rowIndex + 3;

  if (!row.studentId) errs.push(`Row ${r}: Student ID is required`);
  else if (!/^\d{9}$/.test(row.studentId)) errs.push(`Row ${r}: Student ID must be exactly 9 digits`);
  else if (existingIds.has(row.studentId)) errs.push(`Row ${r}: Student ID ${row.studentId} already has an account`);
  else if (seenIds.has(row.studentId)) errs.push(`Row ${r}: Student ID ${row.studentId} is repeated (also on row ${seenIds.get(row.studentId)})`);
  else seenIds.set(row.studentId, r);

  if (!row.lastName) errs.push(`Row ${r}: Last Name is required`);
  else if (!NAME_REGEX.test(row.lastName)) errs.push(`Row ${r}: Last Name can only contain letters, spaces, and hyphens`);
  if (!row.firstName) errs.push(`Row ${r}: First Name is required`);
  else if (!NAME_REGEX.test(row.firstName)) errs.push(`Row ${r}: First Name can only contain letters, spaces, and hyphens`);
  if (row.middleName) {
    if (row.middleIsInitial) {
      if (!/^[A-Za-zÑñ]\.?$/.test(row.middleName)) errs.push(`Row ${r}: Middle Initial must be a single letter, like S or S.`);
      else { row.middleInitial = toMiddleInitial(row.middleName); row.middleName = row.middleInitial.replace(".", ""); }
    } else if (!NAME_REGEX.test(row.middleName)) {
      errs.push(`Row ${r}: Middle Name can only contain letters, spaces, and hyphens`);
    }
  }
  delete row.middleIsInitial;
  // Optional. Same options as the New Student form; "jr" / "iii" are tidied up.
  const suffix = normalizeSuffix(row.suffix);
  if (suffix === null) errs.push(`Row ${r}: Suffix "${row.suffix}" must be one of ${SUFFIX_OPTIONS.join(", ")} (or blank)`);
  else row.suffix = suffix;

  // Section, batch, department, program and major are not checked per row: they
  // are chosen once in the import form and stamped onto every row.
  return errs;
};

// ── Import Modal ───────────────────────────────────────────────────────────────
const ImportModal = ({ onClose, onImport, coordinatorColleges = [], departments = {}, sectionsByCollege = {}, existingIds = [] }) => {
  const [dragging, setDragging] = useState(false);
  // Section and batch are typed once here and stamped on every row, instead of
  // being repeated down two template columns where one row could disagree with
  // the rest. One import is therefore one section of one batch.
  const [section, setSection] = useState("");
  const [batch, setBatch]     = useState("");
  // Department: no field when the coordinator has one (it is applied
  // automatically); a dropdown only when they have more than one.
  const [department, setDepartment] = useState(coordinatorColleges.length === 1 ? coordinatorColleges[0] : "");
  const [program, setProgram]       = useState("");
  const [major, setMajor]           = useState("");
  const [batchTouched, setBatchTouched] = useState(false);
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
      const layouts = [IMPORT_TEMPLATE_COLUMNS, ...LEGACY_IMPORT_LAYOUTS];
      const matched = layouts.find(cols => cols.every((c, i) => headerRow[i] === c));
      const expectedColumns = matched || IMPORT_TEMPLATE_COLUMNS;
      const at = (name) => expectedColumns.indexOf(name);   // -1 when the column isn't in this layout
      if (!matched) IMPORT_TEMPLATE_COLUMNS.forEach((expected, i) => { if (headerRow[i] !== expected) headerErrors.push(`Column ${i + 1}: expected "${expected}", found "${headerRow[i] || "(empty)"}"`); });
      if (headerErrors.length > 0) { setPreview({ valid: [], rowErrors: [], headerErrors }); setParsing(false); return; }
      const rowErrors = []; const valid = [];
      const seenIds = new Map();
      const knownIds = new Set(existingIds.map(String));
      rows.slice(2).forEach((row, i) => {
        if (row.every(c => c === "" || c === null || c === undefined)) return;
        // Extra safety net: skip any row that still looks like the
        // template's own "e.g. ..." example row.
        if (String(row[0] ?? "").trim().toLowerCase().startsWith("e.g.")) return;
        const cell = (name) => (at(name) === -1 ? "" : String(row[at(name)] ?? "").trim());
        // Current template: "Middle Initial". Older files: "Middle Name" (a full name).
        const legacyMiddle = !expectedColumns.includes("Middle Initial");
        const middleName = cell(legacyMiddle ? "Middle Name" : "Middle Initial");
        const student = {
          middleIsInitial: !legacyMiddle,
          studentId:     cell("Student ID"),
          lastName:      cell("Last Name"),
          firstName:     cell("First Name"),
          middleName,
          middleInitial: toMiddleInitial(middleName),
          suffix:        cell("Suffix"),   // checked + normalized in validateRow
          // Section and batch are typed once in the import form and stamped on
          // every row there — one import is one section of one batch.
          yearSection:   "",
          batch:         "",
          // Department, program and major come from the import form (or the
          // student on first login) — see handleImport.
          college: "", program: "", major: "", specialization: "",
          age: "",
          email: "", password: "",
        };
        const errs = validateRow(student, i, seenIds, knownIds);
        if (errs.length > 0) rowErrors.push(...errs); else valid.push(student);
      });
      setPreview({ valid, rowErrors, headerErrors: [], ignoredDepartment: expectedColumns.includes("Department") });
    } catch (e) { setPreview({ valid: [], rowErrors: ["The file couldn't be read."], headerErrors: [] }); }
    setParsing(false);
  };

  const handleFile = (f) => { if (!f || !checkFileType(f)) return; setFile(f); parseFile(f); };
  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }, []);
  const clearFile = () => { setFile(null); setPreview(null); setFileError(""); };
  const normalizedSection = normalizeSection(section);
  const normalizedBatch   = normalizeBatch(batch);
  const batchError        = batchTouched ? batchProblem(batch) : "";
  const programObjs       = programsOf(departments, department);
  const pm                = programMajorState(programObjs, program);

  const handleImport = () => {
    if (!canImport) return;
    // Same rule as the New Student form: the department's only program is filled
    // in automatically; otherwise the coordinator must pick one.
    const resolvedProgram = programObjs.length === 1 ? programObjs[0].name : program;
    onImport(preview.valid.map(st => ({
      ...st,
      yearSection: normalizedSection, batch: normalizedBatch,
      college: department, program: resolvedProgram, specialization: pm.showMajor ? major : "",
    })));
    onClose();
  };

  const missing = [
    !normalizedSection && "Section",
    !normalizedBatch && "Batch",
    !department && "Department",
    department && programObjs.length !== 1 && !program && "Program",
    department && pm.showMajor && !major && "Major",
  ].filter(Boolean);
  const canImport = !!preview && preview.valid.length > 0 && missing.length === 0;

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

          {/* One section, batch (and department / program / major) for the whole file. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: space.sm, marginTop: space.md }}>
            {coordinatorColleges.length > 1 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <SmallLabel>Department <span style={{ color: danger }}>*</span></SmallLabel>
                <StyledSelect
                  value={department}
                  onChange={(v) => { setDepartment(v); setProgram(""); setMajor(""); setSection(""); }}
                  options={coordinatorColleges.map(name => ({ value: name, label: name }))}
                  placeholder="Select department"
                />
              </div>
            )}
            <div>
              <SmallLabel>Section <span style={{ color: danger }}>*</span></SmallLabel>
              <SectionSelect value={section} onChange={setSection} college={department} existing={sectionsOfCollege(sectionsByCollege, department)} />
            </div>
            <div>
              <SmallLabel>Batch <span style={{ color: danger }}>*</span></SmallLabel>
              <StyledInput
                value={batch}
                onChange={(v) => { setBatch(v.replace(/[^\d-]/g, "").slice(0, 9)); setBatchTouched(true); }}
                placeholder="2026-2027"
                hasError={!!batchError}
              />
              {batchError && <p role="alert" style={{ fontFamily: font.ui, ...type.helper, color: danger, margin: "4px 0 0 14px" }}>{batchError}</p>}
              {!batchError && batchTouched && batchHint(batch) && <p style={{ fontFamily: font.ui, ...type.helper, color: success, margin: "4px 0 0 14px" }}>{batchHint(batch)}</p>}
            </div>
            <ProgramMajorFields programs={programObjs} program={program} major={major} onProgram={(v) => { setProgram(v); setMajor(""); }} onMajor={setMajor} Label={SmallLabel} />
          </div>

          <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, margin: "8px 0 0", lineHeight: 1.6 }}>
            Every student in this file is saved under the section and batch above
            {coordinatorColleges.length === 1 ? `, in ${coordinatorColleges[0]}, your department` : ""}. For another section, import a separate file.
          </p>

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
                <>
                  <p style={{ fontFamily: font.ui, ...type.label, color: success }}>{preview.valid.length} student{preview.valid.length !== 1 ? "s" : ""} ready to import</p>
                  {preview.ignoredDepartment && <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: "4px" }}>This file has a Department column. It's ignored: students go into the department chosen here.</p>}
                  {missing.length > 0 && <p style={{ fontFamily: font.ui, ...type.helper, color: inkBody, marginTop: "4px" }}>Still needed above: {missing.join(", ")}.</p>}
                </>
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
const EMPTY_FILTERS = { program: "", specialization: "", sex: "", section: "", batch: "" };
// `skip` leaves one filter out, which is how each option list is built from the
// students the OTHER filters still allow (e.g. sections inside the chosen batch).
const matchesPanelFilters = (s, f, skip = "") =>
  (skip === "sex"            || !f.sex            || s.sex === f.sex) &&
  (skip === "section"        || !f.section        || sectionIdOf(s) === f.section) &&
  (skip === "batch"          || !f.batch          || batchKeyOf(s) === f.batch) &&
  (skip === "program"        || !f.program        || s.program === f.program) &&
  (skip === "specialization" || !f.specialization || (s.specialization || s.major) === f.specialization);
const countBy = (list, keyFn) => {
  const m = new Map();
  list.forEach(x => { const k = keyFn(x); m.set(k, (m.get(k) || 0) + 1); });
  return m;
};
// ── Search: first name, middle initial, last name, suffix and student ID only ──
// Every word typed must match one of those fields, so "juan dela cruz", "cruz jr"
// and "m. santos" all work. A single letter matches a middle initial or the start
// of a name/ID, so typing "m" doesn't match every name that merely contains an m.
const searchKey = (v) => String(v ?? "").toLowerCase().replace(/[.,]/g, "").trim();
const matchesStudentSearch = (s, query) => {
  const tokens = searchKey(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const names = [s.firstName, s.lastName, s.suffix].map(searchKey).filter(Boolean);
  const mi = searchKey(s.middleInitial);
  const id = searchKey(s.studentId);
  return tokens.every(t => (t.length === 1
    ? (mi === t || names.some(n => n.startsWith(t)) || id.startsWith(t))
    : (names.some(n => n.includes(t)) || id.includes(t) || mi === t)));
};

// ── Program / Major options for the filter panel ──
// The department itself is fixed (the list is already limited to the coordinator's
// own department(s)), so it is never a filter. Only programs are listed here.
const programOptionsFor = (colleges, departments, departmentNames) => {
  const deps = departments || {};
  const names = departmentNames || [];
  const resolve = (c) => (deps[c] ? c : names.find(n => deps[n]?.abbr === c) || null);
  const scope = [...new Set((colleges || []).map(resolve).filter(Boolean))];
  return (scope.length > 0 ? scope : names).flatMap(dept =>
    (deps[dept]?.programs || []).map(p => ({ dept, name: p.name, specializations: p.specializations || [] })));
};

// batchOptions / sectionOptions are [{ key, label, count }] built from the students that
// really exist (given the other filters), so nothing is offered that returns nobody.
const FilterPanel = ({ filters, setFilters, filterRef, coordinatorColleges = [], departments = {}, departmentNames = [], batchOptions = [], sectionOptions = [] }) => {
  const { isMobile, isTablet } = useBreakpoint();
  // Department is fixed (the coordinator's own), so only Program / Major are filterable,
  // and only when there is something to choose between.
  const programOptions  = programOptionsFor(coordinatorColleges, departments, departmentNames);
  const showDeptLabels  = new Set(programOptions.map(p => p.dept)).size > 1;
  const showPrograms    = programOptions.length > 1;
  const activeProgram   = filters.program ? programOptions.find(p => p.name === filters.program)
                                          : (programOptions.length === 1 ? programOptions[0] : null);
  const majors          = activeProgram?.specializations || [];
  const showMajors      = majors.length > 0;

  const clearAll = () => { setFilters({ ...EMPTY_FILTERS }); };
  const toggleBatch   = (val) => setFilters(prev => ({ ...prev, batch: prev.batch === val ? "" : val }));
  const toggleSex     = (val) => setFilters(prev => ({ ...prev, sex: prev.sex === val ? "" : val }));
  const toggleSection = (val) => setFilters(prev => ({ ...prev, section: prev.section === val ? "" : val }));
  const toggleProgram = (prog) => setFilters(prev => ({ ...prev, program: prev.program === prog ? "" : prog, specialization: "" }));
  const toggleSpec    = (spec) => setFilters(prev => ({ ...prev, specialization: prev.specialization === spec ? "" : spec }));

  const panelStyle = {
    position: "absolute", top: "48px", right: 0, width: "266px",
    background: surface, border: `1px solid ${line}`, borderRadius: radius.card,
    boxShadow: shadow.panel, zIndex: 100, overflowX: "hidden", overflowY: "auto",
    maxHeight: "min(72vh, 560px)",
    fontFamily: font.ui,
  };
  const countTag = (n) => <span style={{ opacity: 0.6, marginLeft: "4px" }}>{n}</span>;

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
          {batchOptions.length > 0 ? batchOptions.map(b => (
            <span key={b.key} onClick={() => toggleBatch(b.key)} style={chip(filters.batch === b.key)}>{b.label}{countTag(b.count)}</span>
          )) : (
            <span style={emptyNote}>No batches yet</span>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: `1px solid ${lineSoft}`, margin: "10px 0" }} />

      {/* Section — only sections that have registered students, per department. */}
      <div style={{ padding: "0 14px 12px" }}>
        <p style={{ ...groupLabel, marginBottom: space.sm }}>Section</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {sectionOptions.length > 0 ? sectionOptions.map(o => (
            <span key={o.key} onClick={() => toggleSection(o.key)} style={chip(filters.section === o.key)}>{o.label}{countTag(o.count)}</span>
          )) : (
            <span style={emptyNote}>No students registered in any section yet</span>
          )}
        </div>
      </div>

      {/* Program and Major. Department is fixed, so there is no Department filter. This
          whole section is hidden when the department has no other program or major to pick. */}
      {(showPrograms || showMajors) && (
        <>
          <hr style={{ border: "none", borderTop: `1px solid ${lineSoft}`, margin: 0 }} />
          <div style={{ padding: "12px 14px 14px" }}>
            {showPrograms && (
              <div style={{ marginBottom: showMajors ? "12px" : 0 }}>
                <p style={{ ...groupLabel, marginBottom: space.sm }}>Program</p>
                <div style={{ maxHeight: "170px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[...new Set(programOptions.map(p => p.dept))].map(dept => (
                    <div key={dept}>
                      {showDeptLabels && <p style={{ ...emptyNote, margin: "0 0 4px" }}>{dept}</p>}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {programOptions.filter(p => p.dept === dept).map(p => (
                          <span key={p.name} onClick={() => toggleProgram(p.name)} style={chip(filters.program === p.name)}>{p.name}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {showMajors && (
              <div>
                <p style={{ ...groupLabel, marginBottom: space.sm }}>Major</p>
                <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {majors.map(m => (
                    <span key={m} onClick={() => toggleSpec(m)} style={chip(filters.specialization === m)}>{m}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ── Student avatar ────────────────────────────────────────────────────────────
const StudentAvatar = ({ size = 34, userIcon: themedUserIcon = blackUserIcon }) => (
  <img src={themedUserIcon} alt="" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
);

// ── Checkbox ──────────────────────────────────────────────────────────────────
const Checkbox = ({ checked, partial = false, onClick }) => (
  <div
    onClick={onClick}
    style={{ width: "18px", height: "18px", border: `1.5px solid ${checked || partial ? panel : color.wine400}`, borderRadius: "5px", background: checked ? panel : color.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
  >
    {partial && !checked && <div style={{ width: "8px", height: "2px", background: panel, borderRadius: "1px" }} />}
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
    specialization: d.specialization || d.major || "",
    yearSection:    d.yearSection    || "",
    sex:            d.sex            || "",
    // Derived from the birthdate when there is one; the stored number only for older accounts.
    age:            ageFromBirthdate(d.birthdate) ?? (d.age || ""),
    birthdate:      d.birthdate      || "",
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

// ── Student table (same look as the Report List screen) ──────────────────────
// Columns: Name · Status (Active / Archived) · Action (View). Archive, Restore
// and Delete are inside the View popup. The checkbox column only appears while
// Select mode is on, so bulk export / archive / delete still work.
const studentDisplayName = (s) =>
  `${s.firstName} ${s.middleInitial ? s.middleInitial + " " : ""}${s.lastName}${isRealSuffix(s.suffix) ? ` ${s.suffix}` : ""}`;

const StudentStatusBadge = ({ archived }) => (
  <span style={{
    fontFamily: font.ui, fontSize: "0.7rem", fontWeight: 700,
    background: archived ? inkFaint : success, color: "white",
    borderRadius: "12px", padding: "3px 10px", whiteSpace: "nowrap", alignSelf: "flex-start",
  }}>{archived ? "Archived" : "Active"}</span>
);

const ViewButton = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "5px 16px", borderRadius: "16px",
      border: `1.5px solid ${panelDeep}`, background: color.white, color: panelDeep,
      fontFamily: font.ui, fontSize: "0.78rem",
      cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
    }}
  >View</button>
);

const StudentTable = ({ rows, selectMode, selected, onToggleSelect, onView }) => (
  <>
    <div className="sa-table-wrap">
      <table className="sa-table">
        <thead>
          <tr>
            {selectMode && <th className="sa-th" style={{ width: "44px" }} />}
            <th className="sa-th">Name</th>
            <th className="sa-th" style={{ width: "150px" }}>Status</th>
            <th className="sa-th" style={{ width: "110px" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(s => (
            <tr key={s.id}>
              {selectMode && (
                <td className="sa-td">
                  <div onClick={() => onToggleSelect(s.id)} style={{ display: "flex", cursor: "pointer" }}>
                    <Checkbox checked={selected.has(s.id)} />
                  </div>
                </td>
              )}
              <td className="sa-td" title={s.email || undefined}>{studentDisplayName(s)}</td>
              <td className="sa-td"><StudentStatusBadge archived={isArchivedStudent(s)} /></td>
              <td className="sa-td"><ViewButton onClick={() => onView(s)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="sa-card-list">
      {rows.map(s => (
        <div key={s.id} className="sa-card" style={{ borderColor: selected.has(s.id) ? panel : undefined }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            {selectMode && (
              <div onClick={() => onToggleSelect(s.id)} style={{ display: "flex", cursor: "pointer" }}>
                <Checkbox checked={selected.has(s.id)} />
              </div>
            )}
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontFamily: font.ui, fontSize: "0.9rem", fontWeight: 600, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{studentDisplayName(s)}</span>
              <StudentStatusBadge archived={isArchivedStudent(s)} />
            </div>
          </div>
          <ViewButton onClick={() => onView(s)} />
        </div>
      ))}
    </div>
  </>
);

// ── Confirm / notice dialog ───────────────────────────────────────────────────
const Dialog = ({ title, body, children, success: showSuccess = false }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: space.md }}>
    <div style={{ background: surface, border: `1px solid ${line}`, borderRadius: radius.panel, padding: `${space.xl} ${space.lg}`, width: "100%", maxWidth: "360px", boxShadow: shadow.panel, textAlign: "center" }}>
      {showSuccess && (
        <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: lineSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: `0 auto ${space.md}` }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      )}
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
// ── Pagination: 10 rows per page ──────────────────────────────────────────────
const PAGE_SIZE = 10;
// The header (title, search, filters) is fixed; only the list under it scrolls, with its own scrollbar
// (same idea as Account Profile in Admin). The list box reaches into the screen padding so its scrollbar sits at the edge.
const PIN_PAD = "clamp(16px, 4vw, 28px)";
const PIN_PAD_X = "clamp(16px, 4vw, 32px)";
const fixedHead = { flexShrink: 0, position: "relative", zIndex: 30 };
const listScroll = { flex: "1 1 auto", minHeight: 0, overflowY: "auto", margin: `0 calc(-1 * ${PIN_PAD_X}) calc(-1 * ${PIN_PAD})`, padding: `0 ${PIN_PAD_X} ${PIN_PAD}` };
// Next/previous page: the list goes back to its start.
const scrollListToTop = (scroller) => { if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" }); };
// « ‹ 1 2 3 … 9 › » — same look as the Admin screens: current-page badge + page buttons in one rounded bar.
const PaginationBar = ({ page: current, totalPages, onPage, from, to, total }) => {
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const items = totalPages <= 7 ? range(1, totalPages)
    : current <= 4 ? [...range(1, 5), "gap-end", totalPages]
    : current >= totalPages - 3 ? [1, "gap-start", ...range(totalPages - 4, totalPages)]
    : [1, "gap-start", current - 1, current, current + 1, "gap-end", totalPages];
  const btn = (on, disabled) => ({
    minWidth: "36px", height: "36px", padding: "0 10px", borderRadius: "10px",
    border: `1.5px solid ${on ? color.blush50 : color.wine700}`, background: on ? color.blush50 : color.white, color: on ? color.white : color.ink,
    fontFamily: font.ui, fontSize: "0.82rem", fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
  });
  return (
    <div style={{ display: "flex", flexWrap: "wrap-reverse", alignItems: "center", justifyContent: total != null ? "space-between" : "center", gap: "12px", padding: "20px 0 4px" }}>
      {total != null && <span style={{ fontFamily: font.ui, fontSize: "0.8rem", color: color.inkMuted }}>Showing {from}–{to} of {total}</span>}
      <nav aria-label="Pagination" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "stretch", maxWidth: "100%", background: color.white, border: `1px solid ${color.wine700}`, borderRadius: "16px", boxShadow: "0 4px 16px rgba(20,20,20,0.06)", overflow: "hidden" }}>
        <div title="Current page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "52px", padding: "0 14px", background: color.wine800, borderRight: `1px solid ${color.wine700}`, fontFamily: font.ui, fontSize: "0.9rem", fontWeight: 700, color: color.ink }}>
          {String(current).padStart(2, "0")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 12px", flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" aria-label="First page" title="First page" style={btn(false, current === 1)} disabled={current === 1} onClick={() => onPage(1)}>«</button>
          <button type="button" aria-label="Previous page" title="Previous page" style={btn(false, current === 1)} disabled={current === 1} onClick={() => onPage(current - 1)}>‹</button>
          {items.map((it) => (typeof it === "number"
            ? <button key={it} type="button" style={btn(it === current, false)} aria-current={it === current ? "page" : undefined} onClick={() => onPage(it)}>{it}</button>
            : <span key={it} style={{ color: color.inkMuted, padding: "0 4px" }}>…</span>))}
          <button type="button" aria-label="Next page" title="Next page" style={btn(false, current === totalPages)} disabled={current === totalPages} onClick={() => onPage(current + 1)}>›</button>
          <button type="button" aria-label="Last page" title="Last page" style={btn(false, current === totalPages)} disabled={current === totalPages} onClick={() => onPage(totalPages)}>»</button>
        </div>
      </nav>
    </div>
  );
};

const CoordinatorStudentsAcccountScreen = ({ coordinatorUid, coordinatorColleges, userIcon: themedUserIcon = blackUserIcon, onViewingStudentChange, onImportModalChange }) => {
  const { departments, departmentNames } = useDepartmentsPrograms();
  const [curPage, setCurPage] = useState(1);
  // Next/previous page: the list goes back to its start.
  const scrollRef = useRef(null);
  const goToPage = (n) => { setCurPage(n); requestAnimationFrame(() => scrollListToTop(scrollRef.current)); };

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
  const [archiveDone, setArchiveDone]         = useState(null); // { mode, count, name } — success dialog
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
  // No `college` filter: the department is fixed (the coordinator's own).
  const [filters, setFilters]                   = useState({ ...EMPTY_FILTERS });
  // "active" | "archived" — which pool the list is showing.
  const [viewTab, setViewTab]                   = useState("active");
  const [confirmArchiveInfo, setConfirmArchiveInfo] = useState(null); // { student, mode: "archive"|"restore" }
  const [archiveBusy, setArchiveBusy]           = useState(false);
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

  // Sections that already exist, per department (active students only). Feeds every Section dropdown.
  const sectionsByCollege = React.useMemo(() => {
    const map = {};
    students.filter(st => !isArchivedStudent(st)).forEach((st) => {
      const k = collegeKey(st.college);
      if (!k || !String(st.yearSection || "").trim()) return;
      if (!map[k]) map[k] = [];
      map[k].push(st.yearSection);
    });
    Object.keys(map).forEach((k) => { map[k] = uniqueSections(map[k]); });
    return map;
  }, [students]);

  // Option lists come from the students actually in this tab AND allowed by the
  // other filters, so the panel never offers a batch or section that returns nobody.
  // A currently-selected value stays listed (even at 0) so it can be switched off.
  const batchCounts = countBy(pool.filter(s => matchesPanelFilters(s, filters, "batch")), batchKeyOf);
  if (filters.batch && !batchCounts.has(filters.batch)) batchCounts.set(filters.batch, 0);
  const batchOptions = sortBatchKeys([...batchCounts.keys()]).map(k => ({
    key: k, label: k === BATCH_NONE ? "No batch" : k, count: batchCounts.get(k),
  }));
  // Sections are per department: one chip per (department, section). With one department the chip
  // is just "4-A"; a coordinator with several sees "4-A · CCS" and "4-A · CBA" as separate chips.
  const sectionInfo = new Map();   // id -> { section, college }, from every student so a chip is always labelled
  students.forEach(st => {
    const id = sectionIdOf(st);
    if (id && !sectionInfo.has(id)) sectionInfo.set(id, { section: String(st.yearSection).trim(), college: st.college });
  });
  const multiDept = normalizedCoordinatorColleges.length > 1;
  const sectionLabelOf = (id) => {
    const info = sectionInfo.get(id);
    if (!info) return id.split("|")[1] || id;
    return multiDept ? `${info.section} · ${deptAbbrOf(departments, info.college)}` : info.section;
  };
  const sectionCounts = countBy(pool.filter(s => matchesPanelFilters(s, filters, "section")), sectionIdOf);
  sectionCounts.delete("");
  if (filters.section && !sectionCounts.has(filters.section)) sectionCounts.set(filters.section, 0);
  const sectionOptions = [...sectionCounts.keys()]
    .sort((a, b) => {
      const [ca, sa] = a.split("|"); const [cb, sb] = b.split("|");
      return ca.localeCompare(cb) || sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
    })
    .map(k => ({ key: k, label: sectionLabelOf(k), count: sectionCounts.get(k) }));

  const filtered = pool.filter(s => matchesStudentSearch(s, search) && matchesPanelFilters(s, filters));

  // Group the visible students by batch, newest year first.
  const groupedByBatch = (() => {
    const groups = {};
    filtered.forEach(s => { (groups[batchKeyOf(s)] ||= []).push(s); });
    return sortBatchKeys(Object.keys(groups)).map(key => ({ key, label: batchLabelOf(key), rows: groups[key] }));
  })();
  useEffect(() => { setCurPage(1); }, [search, filters, viewTab]);

  // ── Pagination: ONE pager for the whole list, 10 students per page ──
  // Students are laid out in batch order (newest first) and cut into pages of
  // 10 in that order. A page shows only the batches that have students on it,
  // so a batch can continue onto the next page.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(curPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const showingFrom = filtered.length ? pageStart + 1 : 0;
  const showingTo = Math.min(pageEnd, filtered.length);
  const pagedGroups = (() => {
    const out = [];
    let offset = 0;
    groupedByBatch.forEach(g => {
      const gStart = offset;
      offset += g.rows.length;
      const from = Math.max(pageStart, gStart);
      const to = Math.min(pageEnd, offset);
      if (from >= to) return;
      out.push({ ...g, all: g.rows, total: g.rows.length, rows: g.rows.slice(from - gStart, to - gStart) });
    });
    return out;
  })();

  const toggleSelect = (id) => { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  // Only what is on screen counts. A tick left on a row that a filter has since
  // hidden is never exported, archived or deleted by accident.
  const selectedIds = filtered.filter(s => selected.has(s.id)).map(s => s.id);
  const toggleAll    = () => { if (selectedIds.length === filtered.length && filtered.length > 0) setSelected(new Set()); else setSelected(new Set(filtered.map(s => s.id))); };
  // One tick for a whole batch group, so "select this batch" needs no filtering first.
  const toggleGroup  = (rows) => setSelected(prev => {
    const n = new Set(prev);
    const all = rows.every(r => n.has(r.id));
    rows.forEach(r => (all ? n.delete(r.id) : n.add(r.id)));
    return n;
  });
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
    if (selectedIds.length === 0) return;
    setConfirmArchiveInfo({
      mode: viewTab === "archived" ? "restore" : "archive",
      bulk: true,
      ids: selectedIds,
      count: selectedIds.length,
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
      // Tell the coordinator it worked instead of the row just vanishing.
      setArchiveDone({ mode, count: bulk ? ids.length : 1, name: bulk ? "" : (student.fullName || student.studentId) });
    } catch (err) {
      console.error(`Failed to ${mode} student(s):`, err);
      setConfirmArchiveInfo(prev => prev && { ...prev, error: "That didn't save. Check your connection and try again." });
    } finally {
      setArchiveBusy(false);
    }
  };

  // ── Delete single ─────────────────────────────────────────────────────────
  const handleDelete = (id) => {
    setTimeout(() => setConfirmDeleteInfo({ type: "single", id }), 0);
  };

  // ── Delete selected ───────────────────────────────────────────────────────
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setConfirmDeleteInfo({ type: "selected", count: selectedIds.length, ids: selectedIds });
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
      const ids = confirmDeleteInfo.ids || [];
      const count = ids.length;
      await Promise.all(ids.map(id => deleteDoc(doc(db, "students", id))));
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
    if (selectedIds.length === 0) return;   // the button is disabled too
    setConfirmExport(true);
  };

  const doExport = () => {
    const studentsToExport = students.filter(s => selectedIds.includes(s.id));
    exportToXLSX(studentsToExport.map(s => ({
      studentId: s.studentId, firstName: s.firstName,
      middleInitial: s.middleInitial, lastName: s.lastName, college: s.college,
    })), departments);
    setConfirmExport(false);
  };

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;

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
        <div style={fixedHead}>

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
                value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID"
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
              {showFilterDrawer && <FilterPanel filters={filters} setFilters={setFilters} filterRef={filterRef} coordinatorColleges={normalizedCoordinatorColleges} departments={departments} departmentNames={departmentNames} batchOptions={batchOptions} sectionOptions={sectionOptions} />}
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
                  onClick={handleArchiveSelected}
                  disabled={selectedIds.length === 0}
                  style={{ ...ghostBtn, opacity: selectedIds.length === 0 ? 0.5 : 1, cursor: selectedIds.length === 0 ? "default" : "pointer" }}
                >
                  {viewTab === "archived"
                    ? (allSelected && selectedIds.length > 0 ? "Restore all" : `Restore${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`)
                    : (allSelected && selectedIds.length > 0 ? "Archive all" : `Archive${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`)}
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0}
                  style={{ ...ghostBtn, color: panel, borderColor: selectedIds.length === 0 ? lineStrong : panel, opacity: selectedIds.length === 0 ? 0.5 : 1, cursor: selectedIds.length === 0 ? "default" : "pointer" }}
                >
                  {allSelected && selectedIds.length > 0 ? "Delete all" : `Delete${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
                </button>
                <button onClick={exitSelectMode} style={{ background: "none", border: "none", fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", textDecoration: "underline" }}>Cancel</button>
              </>
            )}
          </div>
          <div id="sa-toolbar-actions" className="sa-toolbar-group">
            <button
              onClick={handleExport}
              disabled={selectedIds.length === 0}
              title={selectedIds.length === 0 ? "Tick the students to export first (use Select)" : `Export ${selectedIds.length} selected`}
              style={{ ...ghostBtn, opacity: selectedIds.length === 0 ? 0.5 : 1, cursor: selectedIds.length === 0 ? "not-allowed" : "pointer" }}
            >
              Export{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </button>
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
                onClick={() => { setViewTab(t.key); setFilters(prev => ({ ...prev, batch: "", section: "" })); exitSelectMode(); }}
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
              filters.sex            && { label: filters.sex,                   clear: () => setFilters(prev => ({ ...prev, sex: "" })) },
              filters.section        && { label: `Section ${sectionLabelOf(filters.section)}`, clear: () => setFilters(prev => ({ ...prev, section: "" })) },
              filters.program        && { label: filters.program,               clear: () => setFilters(prev => ({ ...prev, program: "", specialization: "" })) },
              filters.specialization && { label: filters.specialization,        clear: () => setFilters(prev => ({ ...prev, specialization: "" })) },
              filters.batch          && { label: batchLabelOf(filters.batch),   clear: () => setFilters(prev => ({ ...prev, batch: "" })) },
            ].filter(Boolean).map(({ label, clear }) => (
              <span key={label} style={{ background: surface, color: inkBody, border: `1px solid ${line}`, borderRadius: radius.pill, padding: "4px 12px", fontFamily: font.ui, ...type.helper, display: "flex", alignItems: "center", gap: "6px" }}>
                {label}<span onClick={clear} style={{ cursor: "pointer", color: inkMuted }}>✕</span>
              </span>
            ))}
            <span onClick={() => setFilters({ ...EMPTY_FILTERS })} style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", textDecoration: "underline" }}>Clear all</span>
          </div>
        )}

        </div>

        <div ref={scrollRef} style={listScroll}>
        {/* Student list */}
        {filtered.length > 0 ? (
          <>
            {pagedGroups.map(group => (
              <section key={group.key} style={{ marginBottom: space.lg }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: space.sm,
                  padding: "0 2px 8px", borderBottom: `1px solid ${line}`, marginBottom: space.sm,
                  flexWrap: "wrap",
                }}>
                  {selectMode && (
                    <div
                      onClick={() => toggleGroup(group.all)}
                      title={`Select every student in ${group.label}`}
                      style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                    >
                      <Checkbox
                        checked={group.all.every(r => selected.has(r.id))}
                        partial={group.all.some(r => selected.has(r.id))}
                      />
                    </div>
                  )}
                  <h3 style={{ fontFamily: font.ui, ...type.label, color: ink, fontWeight: 650, margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>
                    {group.label}
                  </h3>
                  <span style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, whiteSpace: "nowrap" }}>
                    {group.total} student{group.total !== 1 ? "s" : ""}
                  </span>
                </div>
                <StudentTable
                  rows={group.rows}
                  selectMode={selectMode}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onView={setViewingStudent}
                />
              </section>
            ))}
            {/* Pagination: only shown when there are more than 10 students */}
            {filtered.length > PAGE_SIZE && (
              <PaginationBar page={safePage} totalPages={totalPages} onPage={goToPage} from={showingFrom} to={showingTo} total={filtered.length} />
            )}
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
      </div>

      {showNewModal    && <StudentForm coordinatorColleges={normalizedCoordinatorColleges} departments={departments} sectionsByCollege={sectionsByCollege} onClose={() => setShowNewModal(false)} onSubmit={handleCreate} submitLabel="Create account" />}
      {viewingStudent  && (
        <StudentForm
          initial={viewingStudent}
          readOnly
          coordinatorColleges={normalizedCoordinatorColleges}
          departments={departments}
          sectionsByCollege={sectionsByCollege}
          onClose={() => setViewingStudent(null)}
          onSubmit={handleSave}
          archived={isArchivedStudent(viewingStudent)}
          // Close the popup first, then ask for confirmation on the list.
          onArchive={() => { const s = viewingStudent; setViewingStudent(null); handleArchive(s); }}
          onRestore={() => { const s = viewingStudent; setViewingStudent(null); handleRestore(s); }}
          onDelete={() => { const id = viewingStudent.id; setViewingStudent(null); handleDelete(id); }}
        />
      )}
      {showImportModal && <ImportModal existingIds={students.map(s => s.studentId)} coordinatorColleges={normalizedCoordinatorColleges} departments={departments} sectionsByCollege={sectionsByCollege} onClose={() => setShowImportModal(false)} onImport={handleImport} />}

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
          title={`Export ${selectedIds.length} student${selectedIds.length !== 1 ? "s" : ""}?`}
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

      {/* ── Archive / restore done ── */}
      {archiveDone && (() => {
        const archived = archiveDone.mode === "archive";
        const many = archiveDone.count > 1;
        const who = many ? `${archiveDone.count} student accounts` : (archiveDone.name || "The student");
        return (
          <Dialog
            success
            title={archived ? (many ? "Students archived" : "Student archived") : (many ? "Students restored" : "Student restored")}
            body={archived
              ? `${who} ${many ? "were" : "was"} moved to Archived Students. Nothing was deleted, and you can restore ${many ? "them" : "this student"} any time.`
              : `${who} ${many ? "are" : "is"} back in the active student list and can log in again.`}
          >
            <button onClick={() => setArchiveDone(null)} style={primaryBtn}>OK</button>
          </Dialog>
        );
      })()}

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