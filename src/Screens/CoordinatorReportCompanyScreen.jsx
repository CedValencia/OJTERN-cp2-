import React, { useState, useEffect } from "react";
import { doc, updateDoc, getDoc, getDocs, collection, query, where, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { color, font, type, space, radius, shadow, ease } from "./theme";
import pdfIcon from "../icons/pdf.png";
import imgIcon from "../icons/img.png";
import downloadIcon from "../icons/download.png";
import {
  logActivity,
  applyCompanyEnforcement,
  recordCompanyAction,
  notifyCompanyAccount,
  notifyReporter,
  getCompanyActionHistory,
} from "./AuthService";

// ── CoordinatorStudentList theme ─────────────────────────────────────────────
// Typography matches CoordinatorStudentListScreen through the shared theme.
// ── Shared OJTERN black & white palette — matches CoordinatorStudentListScreen ──
// ── Black & white UI palette ─────────────────────────────────────────────────
// Matches the clean black/white visual language of CoordinatorStudentList.
// Semantic status colors (success/warning/danger/info) remain unchanged.
const ink        = "#111111";
const inkBody    = "#222222";
const inkMuted   = "#666666";
const inkFaint   = "#999999";
const surface    = "#FFFFFF";
const page       = "#FFFFFF";
const line       = "#E5E5E5";
// stronger border for buttons & pills (the plain `line` is too faint on them)
const lineStrong = "#7A7A7A";
const lineSoft   = "#F4F4F4";
// These now resolve through theme.js's CSS custom properties (--ojt-ink,
// --ojt-ink-deep, --ojt-badge, ...) instead of fixed hex, so this screen
// repaints along with the coordinator's theme-color picker just like
// CoordinatorDashboardScreen does. Relies on this screen being rendered as
// a descendant of the dashboard's top-level wrapper, which is where
// getAccentThemeVars(accentThemeId) is spread.
const panel      = color.blush50;   // var(--ojt-ink, #000000)
const panelDeep  = color.blush100;  // var(--ojt-ink-deep, #161616)
const onPanel    = color.onWine;
const onPanelDim = color.onWineMuted;

const red      = color.blush50;   // was fixed "#111111" — now tracks --ojt-ink
const darkRed  = color.blush100;  // was fixed "#000000" — now tracks --ojt-ink-deep

// ── Responsive styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    .rc-screen {
      width: 100% !important;
      min-width: 0 !important;
      min-height: 100% !important;
      height: 100% !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      background: ${page} !important;
      padding: clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px) !important;
      color: ${ink} !important;
      font-family: ${font.ui} !important;
    }

    .rc-screen,
    .rc-screen * {
      box-sizing: border-box;
    }

    .rc-screen h1,
    .rc-screen h2,
    .rc-screen h3,
    .rc-screen p,
    .rc-screen span,
    .rc-screen td,
    .rc-screen th {
      color: inherit;
    }

    /* Header row — keeps the title panel and total badge as separate containers */
    .rc-header-row {
      display: flex !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 18px !important;
      margin-bottom: 22px !important;
    }

    .rc-header {
      flex: 1 !important;
      min-width: 0 !important;
      padding: 18px 28px !important;
      background: ${panelDeep} !important;
      border: 1px solid ${panelDeep} !important;
      border-radius: 18px !important;
      box-shadow: none !important;
    }

    .rc-title {
      margin: 0 !important;
      font-family: ${font.ui} !important;
      font-size: clamp(1rem, 4vw, 1.5rem) !important;
      font-weight: 600 !important;
      color: #ffffff !important;
      line-height: 1 !important;
      letter-spacing: -0.01em !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      display: block !important;
    }

    /* Report total — separate white panel outside the black header */
    .rc-total-badge {
      min-width: 82px !important;
      height: 90px !important;
      padding: 12px 16px !important;
      border: 1px solid ${line} !important;
      border-radius: 16px !important;
      background: ${color.white} !important;
      text-align: center !important;
      box-shadow: none !important;
      flex-shrink: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .rc-total-badge > div:first-child {
      color: ${ink} !important;
    }

    .rc-total-badge > div:last-child {
      color: ${inkMuted} !important;
    }

    .rc-table-wrap {
      width: 100% !important;
      overflow-x: auto !important;
      border: 1px solid ${line} !important;
      border-radius: 18px !important;
      background: ${surface} !important;
      box-shadow: none !important;
    }

    .rc-table {
      width: 100% !important;
      min-width: 680px !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      font-size: 0.90rem !important;
      background: ${surface} !important;
    }

    .rc-th {
      padding: 13px 14px !important;
      text-align: left !important;
      color: #000000 !important;
      background: ${lineSoft} !important;
      border-bottom: 1px solid ${line} !important;
      font-family: ${font.ui} !important;
      font-size: 1rem !important;
      font-weight: 700 !important;
      letter-spacing: 0.02em !important;
      white-space: nowrap !important;
    }

    .rc-td {
      padding: 15px 14px !important;
      color: ${ink} !important;
      background: ${surface} !important;
      font-family: ${font.ui} !important;
      font-weight: 500 !important;
      border-bottom: 1px solid ${line} !important;
      vertical-align: middle !important;
    }

    .rc-modal-inner {
      background: #ffffff !important;
      opacity: 1 !important;
      border-radius: 18px !important;
      overflow: hidden !important;
      width: min(460px, calc(100vw - 48px)) !important;
      max-height: 80vh !important;
      display: flex !important;
      flex-direction: column !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25) !important;
    }

    /* Report Detail modal only: fixed size. The header and footer stay put and
       only .rc-modal-body scrolls when the content doesn't fit. */
    .rc-modal-inner.rc-detail-inner {
      height: min(520px, 80vh) !important;
    }

    .rc-modal-header {
      flex: 0 0 auto !important;
      min-height: 60px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      padding: 14px 20px !important;
      background: #ffffff !important;
      color: #111111 !important;
      border-bottom: 1px solid ${line} !important;
    }

    .rc-modal-header > span {
      min-width: 0 !important;
      flex: 1 1 auto !important;
    }

    .rc-modal-header button {
      width: 30px !important;
      height: 30px !important;
      flex: 0 0 30px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: 0 !important;
      padding: 0 !important;
      background: ${lineSoft} !important;
      color: #111111 !important;
      border: 1px solid ${line} !important;
      border-radius: 50% !important;
      cursor: pointer !important;
    }

    .rc-modal-body {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding: 20px !important;
      background: #ffffff !important;
      color: #222222 !important;
    }

    .rc-modal-body p {
      color: #222222;
    }

    .rc-modal-body button {
      color: #ffffff !important;
    }

    .rc-modal-inner > div:last-child {
      flex: 0 0 auto !important;
    }
    /* Action History has no footer, so its scrolling body IS the last child. */
    .rc-modal-inner.rc-ah-inner > div:last-child {
      flex: 1 1 auto !important;
      min-height: 0 !important;
    }

    @media (max-width: 560px) {
      .rc-modal-inner {
        width: calc(100vw - 72px) !important;
        max-height: 68vh !important;
        border-radius: 14px !important;
      }

      .rc-modal-inner.rc-detail-inner {
        height: 68vh !important;
      }

      .rc-modal-header {
        min-height: 48px !important;
        padding: 10px 14px !important;
      }

      .rc-modal-body {
        padding: 14px !important;
      }
    }

    .rc-table tbody tr:last-child .rc-td {
      border-bottom: none !important;
    }

    .rc-table tbody tr:hover .rc-td {
      background: ${color.hoverWash} !important;
    }

    .rc-card-list {
      display: none;
      flex-direction: column;
      gap: 10px;
    }

    .rc-card {
      background: ${surface} !important;
      border: 1px solid ${line} !important;
      border-radius: 18px !important;
      padding: 14px 16px !important;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: none !important;
    }

    .rc-card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .rc-card-bottom {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      padding-top: 8px;
      border-top: 1px solid ${line} !important;
    }

    .rc-card-label {
      font-family: ${font.ui} !important;
      font-size: 0.66rem !important;
      color: ${inkMuted} !important;
      margin: 0 0 3px 0 !important;
    }

    .rc-card-value {
      font-family: ${font.ui} !important;
      font-size: 0.82rem !important;
      font-weight: 600 !important;
      color: ${ink} !important;
      margin: 0 !important;
    }

    @media (max-width: 780px) {
      .rc-table-wrap { display: none !important; }
      .rc-card-list { display: flex !important; }
    }

    @media (max-width: 560px) {
      .rc-screen { padding: 16px !important; }

      .rc-header-row {
        gap: 10px !important;
      }

      .rc-header {
        padding: 14px !important;
      }

      .rc-title {
        font-size: 1.1rem !important;
      }

      .rc-total-badge {
        min-width: 72px !important;
        height: 78px !important;
        padding: 8px 10px !important;
      }
    }

    .rc-screen button {
      font-family: ${font.ui};
    }

    .rc-screen button:focus-visible,
    .rc-screen :focus-visible {
      outline: 2px solid ${color.white} !important;
      outline-offset: 2px !important;
    }
  `}</style>
);

// ── Shared styles & icons ─────────────────────────────────────────────────────
const downloadBtnStyle = {
  display: "flex", alignItems: "center", gap: "6px",
  padding: "7px 18px", borderRadius: "16px",
  border: `1.5px solid ${panel}`, background: panel, color: "white",
  fontFamily: font.ui, fontSize: "0.82rem",
  cursor: "pointer", fontWeight: 600,
};

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const PdfIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

// ── Attachment helpers ────────────────────────────────────────────────────────

const isAllowedType = (file) => {
  if (!file) return false;

  return (
    file.type === "image/png" ||
    file.type === "application/pdf"
  );
};

const handleDownload = async (file) => {
  if (!file?.url) return;

  try {
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = file.name || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Failed to download attachment:", err);

    // Fallback if the file cannot be fetched as a blob.
    window.open(file.url, "_blank", "noopener,noreferrer");
  }
};

// ── Image Lightbox ───────────────────────────────────────────────────────────

const ImageLightbox = ({ src, name, onClose }) => {
  if (!src) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        cursor: "zoom-out",
      }}
    >
      <img
        src={src}
        alt={name || "Attachment preview"}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "95vw",
          maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: "10px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          cursor: "default",
        }}
      />

      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          width: "38px",
          height: "38px",
          border: "none",
          borderRadius: "50%",
          background: color.white,
          color: darkRed,
          fontSize: "1.2rem",
          fontWeight: "bold",
          cursor: "pointer",
        }}
        aria-label="Close image preview"
      >
        ✕
      </button>
    </div>
  );
};

// ── Report Detail Modal ───────────────────────────────────────────────────────
// ── Resolution actions ─────────────────────────────────────────────────────
// Fixed set of actions available for every report, matching the coordinator
// review form: Require Correction, Warning Issued, Suspend Account, Others,
// Block Account. Enforcement + audit trail + company notification for all of
// these now live in AuthService.js (applyCompanyEnforcement / recordCompanyAction
// / notifyCompany) so account-status logic has one home instead of being
// duplicated between this screen and the login flow.
// Input ceilings. Both the field and the state are capped, so a paste can't
// slip past maxLength (which only limits typing in some browsers).
const OTHER_ACTION_MAX     = 500;
const DISMISS_REASON_MAX   = 500;
// An "Awaiting correction" report older than this is flagged in the list, so a
// correction nobody followed up on stops being invisible.
const CORRECTION_OVERDUE_DAYS = 7;
const RESOLUTION_NOTES_MAX = 1500;

const STANDARD_ACTIONS = ["Require Correction", "Warning Issued", "Suspend Account", "Others", "Block Account"];

const RESOLUTION_ACTION_META = {
  "Require Correction": { icon: "✏️", desc: "Company must edit or remove the flagged content." },
  "Warning Issued":     { icon: "⚠️", desc: "Formal notice sent; account stays active." },
  "Suspend Account":    { icon: "⏸", desc: "Temporary hold while further review takes place." },
  "Others":             { icon: "📝", desc: "Action taken not covered by the options above." },
  "Block Account":      { icon: "⛔", desc: "Company loses access to the platform immediately." },
};

// The message sent to the company (via notifyCompany) for each action type.
// Custom "Others" text and the coordinator's resolution notes are appended.
const buildNotificationText = (actionType, resolutionNotes) => {
  const notes = resolutionNotes ? ` Details: ${resolutionNotes}` : "";
  switch (actionType) {
    case "Require Correction":
      return `A coordinator has reviewed a report concerning your account and found content that needs to be edited or removed. Please make the required corrections.${notes}`;
    case "Warning Issued":
      return `This is a formal warning regarding your company account. Please review and comply with platform guidelines.${notes}`;
    case "Suspend Account":
      return `Your company account has been suspended following a coordinator review.${notes}`;
    case "Block Account":
      return `Your company account has been blocked. Please contact the system administrator for more information.${notes}`;
    default:
      return `A coordinator has taken the following action on your account: ${actionType}.${notes}`;
  }
};

// ── Company account-status badge (Active/Approved, Suspended, Blocked) ────────
const COMPANY_STATUS_BADGE = {
  approved:  { bg: color.success, label: "Active" },
  active:    { bg: color.success, label: "Active" },
  pending:   { bg: color.warning, label: "Pending" },
  rejected:  { bg: lineSoft, label: "Rejected" },
  suspended: { bg: color.warning, label: "Suspended" },
  blocked:   { bg: red,       label: "Blocked" },
};
const CompanyStatusBadge = ({ status }) => {
  const b = COMPANY_STATUS_BADGE[status] || { bg: inkFaint, label: status };
  return (
    <span style={{
      fontFamily: font.ui, fontSize: "0.7rem", fontWeight: 700,
      background: b.bg, color: "white", borderRadius: "12px",
      padding: "3px 10px", whiteSpace: "nowrap",
    }}>{b.label}</span>
  );
};

// ── Action History Modal (audit trail for a single company) ───────────────────
const ActionHistoryModal = ({ open, onClose, loading, history, error }) => {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1300, padding: "16px",
    }}>
      <div className="rc-modal-inner rc-ah-inner">
        <div className="rc-modal-header">
          <span style={{ fontFamily: font.ui, fontSize: "1.3rem", color: ink }}>Action History</span>
          <button onClick={onClose} style={{ background: lineSoft, border: `1px solid ${line}`, borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", fontSize: "0.9rem", color: ink }}>✕</button>
        </div>
        <div className="rc-modal-body">
          {loading && <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: inkFaint, textAlign: "center", padding: "20px" }}>Loading…</p>}
          {!loading && error && (
            <p role="alert" style={{ fontFamily: font.ui, fontSize: "0.85rem", color: color.danger, textAlign: "center", padding: "20px", lineHeight: 1.5 }}>{error}</p>
          )}
          {!loading && !error && history.length === 0 && (
            <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: inkFaint, textAlign: "center", padding: "20px" }}>No actions recorded for this company yet.</p>
          )}
          {!loading && history.map((h) => (
            <div key={h.id} style={{ borderBottom: `1px solid ${line}`, padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontFamily: font.ui, fontSize: "0.85rem", color: ink }}>{h.actionType}</span>
                <span style={{ fontFamily: font.ui, fontSize: "0.7rem", color: inkMuted }}>
                  {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleString() : ""}
                </span>
              </div>
              <p style={{ fontFamily: font.ui, fontSize: "0.78rem", color: inkBody, marginBottom: "4px" }}>{h.reason}</p>
              <p style={{ fontFamily: font.ui, fontSize: "0.72rem", color: inkMuted }}>
                By {h.coordinatorName}
                {h.previousAccountStatus && h.newAccountStatus ? ` • ${h.previousAccountStatus} → ${h.newAccountStatus}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ReportDetailModal = ({ report, onClose, coordinatorUid, coordinatorName, onResolvePanelChange }) => {
  const [lightbox, setLightbox]           = useState(false);
  const [status, setStatus]               = useState(report?.status || "pending");
  const [working, setWorking]             = useState(false);
  const [resolvingPanel, setResolvingPanel] = useState(false);
  const [confirmingDismiss, setConfirmingDismiss] = useState(false);
  const [dismissReason, setDismissReason]         = useState("");
  const [dismissError, setDismissError]           = useState("");
  // Other reports about this same company that are still open. Resolving them
  // together counts as ONE disciplinary action: five students reporting the
  // same post shouldn't push a company to the 3-action auto-suspension.
  const [siblingReports, setSiblingReports]       = useState([]);
  // Opt-in: the coordinator has to tick the box to push one decision onto the
  // company's other open reports. Defaulting to true silently moved every other
  // report (even different concerns) to the same status as the one being resolved.
  const [applyToAll, setApplyToAll]               = useState(false);
  const [confirmingCorrected, setConfirmingCorrected] = useState(false);
  const [confirmingResolve, setConfirmingResolve] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [otherActionText, setOtherActionText] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [suspensionDays, setSuspensionDays]   = useState("7");
  const suspensionDaysNum = Number(suspensionDays);
  // A suspension is a temporary hold, not a ban — anything beyond a month is a
  // Block. Typing is capped here because min/max on a number input only
  // constrains the arrows; a pasted "10000000000" would otherwise go straight
  // through to applyCompanyEnforcement.
  const suspensionDaysError =
    selectedAction !== "Suspend Account" ? ""
    : !String(suspensionDays).trim() ? "Enter the number of days."
    : !Number.isInteger(suspensionDaysNum) || suspensionDaysNum < SUSPENSION_MIN_DAYS || suspensionDaysNum > SUSPENSION_MAX_DAYS
      ? `Enter a whole number from ${SUSPENSION_MIN_DAYS} to ${SUSPENSION_MAX_DAYS} days.`
      : "";
  const [savedAction, setSavedAction]         = useState(report?.resolutionAction || "");
  const [savedNotes, setSavedNotes]           = useState(report?.resolutionNotes || "");
  // What the reported company/student sent back: their description and proof
  // (ReportResponseModal). Watched live, so it appears without a reload.
  const [response, setResponse] = useState(report?.correctionResponse || null);

  // What this report is about. Companies can report students from chat, and
  // those reports live in the same collection — without this the resolve flow
  // would call applyCompanyEnforcement with a student's uid, find no company
  // document, and silently do nothing while the report still said "resolved".
  // Older reports have no subjectType, and those were all about companies.
  const subjectType = String(report?.subjectType || "company").toLowerCase();
  const isCompanySubject = subjectType === "company";

  // A coordinator must not rule on a report about themselves. Those belong to
  // another coordinator of the same department (or an administrator).
  const isAboutMe = !!coordinatorUid && (
    report?.subjectId === coordinatorUid || report?.companyId === coordinatorUid
  );

  useEffect(() => {
    if (!report?.id) return;
    const unsub = onSnapshot(
      doc(db, "reports", report.id),
      (snap) => { if (snap.exists()) setResponse(snap.data()?.correctionResponse || null); },
      (err) => console.error("Failed to watch the report response:", err)
    );
    return () => unsub();
  }, [report?.id]);

  useEffect(() => {
    if (!report?.companyId || status !== "pending") { setSiblingReports([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "reports"), where("companyId", "==", report.companyId)));
        if (cancelled) return;
        setSiblingReports(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(r => r.id !== report.id && r.status !== "resolved" && r.status !== "dismissed")
        );
      } catch (err) {
        console.error("Failed to load the company's other open reports:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [report?.companyId, report?.id, status]);
  const [enforcementNote, setEnforcementNote] = useState(null);
  const [companyStatus, setCompanyStatus]     = useState(null); // live accountStatus, fetched below
  const [historyOpen, setHistoryOpen]         = useState(false);
  const [history, setHistory]                 = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [historyError, setHistoryError]       = useState("");
  // Lets the dashboard's "?" help button and auto-tour switch to
  // HELP_STEPS_BY_NAV.reportresolve while the Resolve Report modal is open
  // (and back to .reportdetail when it closes / this modal unmounts).
  useEffect(() => { onResolvePanelChange?.(resolvingPanel); }, [resolvingPanel]);
  useEffect(() => () => onResolvePanelChange?.(false), []);

  // Live company account status — lets the coordinator see whether this
  // company is currently Active/Approved, Suspended, or Blocked, without
  // needing a separate company-list screen open.
  useEffect(() => {
    if (!report?.companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "companies", report.companyId));
        if (!cancelled && snap.exists()) setCompanyStatus(snap.data().status || "approved");
      } catch (err) {
        console.error("Failed to fetch company status:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [report?.companyId, enforcementNote]); // re-fetch after an enforcement action changes it

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryError("");
    if (!report?.companyId) return;
    setHistoryLoading(true);
    try {
      setHistory(await getCompanyActionHistory(report.companyId));
    } catch (err) {
      // Say so instead of showing an empty list, which reads as "nothing ever
      // happened" when the real answer is "couldn't check".
      console.error("Failed to load action history:", err);
      setHistory([]);
      setHistoryError(err?.code === "permission-denied"
        ? "You don't have permission to view this company's action history."
        : "Couldn't load the action history. Check your connection and try again.");
    } finally {
      setHistoryLoading(false);
    }
  };

  if (!report) return null;

  // New reports carry attachedFiles[]; older ones only have a single attachedFile.
  const files = (Array.isArray(report.attachedFiles) && report.attachedFiles.length > 0)
    ? report.attachedFiles
    : (report.attachedFile ? [report.attachedFile] : []);
  const unsupportedCount = files.filter(f => !isAllowedType(f)).length;

  const badge = REPORT_STATUS_BADGE[status] || REPORT_STATUS_BADGE.pending;
  // Suspend and Block act on a COMPANY account (applyCompanyEnforcement), so
  // they aren't offered when the report is about a student — a coordinator
  // would otherwise pick a penalty that quietly does nothing. Student cases are
  // handled with Require Correction / Warning / Others, and archiving the
  // account from Student Accounts if it comes to that.
  const availableActions = isCompanySubject
    ? STANDARD_ACTIONS
    : STANDARD_ACTIONS.filter(a => a !== "Suspend Account" && a !== "Block Account");
  const canConfirmResolve = selectedAction
    && resolutionNotes.trim().length > 0
    && (selectedAction !== "Others" || otherActionText.trim().length > 0)
    && (selectedAction !== "Suspend Account" || !suspensionDaysError);

  const handleDismiss = async () => {
    if (working || status !== "pending") return;
    const reason = dismissReason.trim();
    // A dismissal is permanent and goes on the record. Without a reason, nobody
    // reading this later knows why it was dropped — including the student who
    // filed it, who now gets told.
    if (!reason) { setDismissError("Say why this report is being dismissed."); return; }
    setWorking(true);
    try {
      await updateDoc(doc(db, "reports", report.id), {
        status:          "dismissed",
        dismissalReason: reason,
        resolvedBy:      coordinatorUid || "",
        resolvedAt:      serverTimestamp(),
      });

      notifyReporter(report.reportedBy, report.reporterRole, {
        title: "Your report was reviewed",
        body: `Your report about ${report.company} was reviewed and closed without action. Reason: ${reason}`,
        reportId: report.id,
      }).catch(err => console.error("Failed to notify the reporter:", err));
      logActivity(
        coordinatorUid,
        "report_dismissed",
        `Dismissed report on ${report.company}`,
        { targetId: report.id, targetName: report.company }
      ).catch(err => console.error("Failed to log activity:", err));
      setStatus("dismissed");
      setConfirmingDismiss(false);
    } catch (err) {
      console.error("Failed to dismiss report:", err);
    } finally {
      setWorking(false);
    }
  };

  // The follow-up check: a coordinator looks at the flagged content again and
  // says whether it was fixed. Only then does the report close.
  const handleMarkCorrected = async () => {
    if (working || status !== "awaiting_correction") return;
    setWorking(true);
    try {
      await updateDoc(doc(db, "reports", report.id), {
        status:      "resolved",
        correctedAt: serverTimestamp(),
        correctedBy: coordinatorUid || "",
      });
      logActivity(
        coordinatorUid,
        "report_correction_confirmed",
        `Confirmed ${report.company} made the required correction`,
        { targetId: report.id, targetName: report.company }
      ).catch(err => console.error("Failed to log activity:", err));
      setStatus("resolved");
      setConfirmingCorrected(false);
    } catch (err) {
      console.error("Failed to mark the correction as done:", err);
    } finally {
      setWorking(false);
    }
  };

  // Not fixed → reopen the Resolve window for a stronger action. The report
  // goes back to pending so the normal resolve path applies, and that new
  // action is recorded separately in the company's history.
  const handleEscalate = async () => {
    if (working || status !== "awaiting_correction") return;
    setWorking(true);
    try {
      await updateDoc(doc(db, "reports", report.id), { status: "pending" });
      setStatus("pending");
      setSelectedAction("");
      setResolutionNotes("");
      setResolvingPanel(true);
    } catch (err) {
      console.error("Failed to reopen the report:", err);
    } finally {
      setWorking(false);
    }
  };

  const handleConfirmResolve = async () => {
    if (working || status !== "pending" || !canConfirmResolve) return;
    setWorking(true);
    const finalAction = selectedAction === "Others" ? otherActionText.trim() : selectedAction;
    try {
      // Require Correction is the one action that isn't finished when it's
      // chosen — it waits for the company to act and a coordinator to confirm.
      const nextStatus = finalAction === "Require Correction" ? "awaiting_correction" : "resolved";
      await updateDoc(doc(db, "reports", report.id), {
        status:           nextStatus,
        resolutionAction: finalAction,
        resolutionNotes:  resolutionNotes.trim(),
        resolvedBy:       coordinatorUid || "",
        resolvedAt:       serverTimestamp(),
      });
      logActivity(
        coordinatorUid,
        nextStatus === "awaiting_correction" ? "report_awaiting_correction" : "report_resolved",
        nextStatus === "awaiting_correction"
          ? `Required correction from ${report.company} — awaiting their fix`
          : `Resolved report on ${report.company} (${finalAction})`,
        { targetId: report.id, targetName: report.company }
      ).catch(err => console.error("Failed to log activity:", err));

      // Actually enforce the action on the company itself, not just the report.
      let enforcementResult = null;
      try {
        enforcementResult = isCompanySubject
          ? await applyCompanyEnforcement(report.companyId, finalAction, coordinatorUid, clampSuspensionDays(suspensionDays))
          : null;
        if (enforcementResult) {
          setCompanyStatus(enforcementResult.status);
          if (enforcementResult.status === "blocked" || enforcementResult.status === "suspended") {
            const untilStr = enforcementResult.suspendedUntil?.toDate
              ? enforcementResult.suspendedUntil.toDate().toLocaleDateString()
              : null;
            setEnforcementNote(
              enforcementResult.autoEscalated
                ? `This company was auto-${enforcementResult.status}${untilStr ? ` until ${untilStr}` : ""} after accumulating multiple disciplinary actions.`
                : enforcementResult.status === "suspended"
                  ? `Company account has been suspended${untilStr ? ` until ${untilStr}` : ""}.`
                  : `Company account has been ${enforcementResult.status}.`
            );
            logActivity(
              coordinatorUid,
              enforcementResult.autoEscalated ? "company_auto_suspended" : "company_status_changed",
              `${report.company} is now ${enforcementResult.status}${enforcementResult.autoEscalated ? " (auto-escalated)" : ""}`,
              { targetId: report.companyId, targetName: report.company }
            ).catch(err => console.error("Failed to log activity:", err));
          }
        }
      } catch (err) {
        console.error("Failed to apply company enforcement:", err);
      }

      // Audit trail — dedicated record for this disciplinary action.
      try {
        await recordCompanyAction({
          companyId:             report.companyId,
          reportId:              report.id,
          companyName:           report.company,
          coordinatorId:         coordinatorUid,
          coordinatorName:       coordinatorName || "Coordinator",
          actionType:            finalAction,
          reason:                resolutionNotes.trim(),
          previousAccountStatus: enforcementResult?.previousStatus || companyStatus || "approved",
          newAccountStatus:      enforcementResult?.status || companyStatus || "approved",
        });
      } catch (err) {
        console.error("Failed to record company action history:", err);
      }

      // Notify the company — reuses the existing chat/messaging system.
      try {
        // Goes to the company's notifications, not the chat thread — a
        // coordinator decision is an account notice, not a message.
        await notifyCompanyAccount(report.companyId, {
          title: `Account update: ${finalAction}`,
          body: buildNotificationText(finalAction, resolutionNotes.trim()),
          type: "report_resolution",
          action: finalAction,
          reportId: report.id || null,
          coordinatorUid,
        });
      } catch (err) {
        console.error("Failed to notify company:", err);
      }

      // Tell whoever filed it what came of their report.
      notifyReporter(report.reportedBy, report.reporterRole, {
        title: "Your report was reviewed",
        body: `Your report about ${report.company} was reviewed. Action taken: ${finalAction}.`,
        reportId: report.id,
      }).catch(err => console.error("Failed to notify the reporter:", err));

      // Close the company's other open reports under this same decision, so a
      // single incident reported five times counts as one action rather than
      // five (three would otherwise trigger the automatic suspension).
      if (applyToAll && siblingReports.length > 0) {
        await Promise.all(siblingReports.map(r =>
          updateDoc(doc(db, "reports", r.id), {
            status:           nextStatus,
            resolutionAction: finalAction,
            resolutionNotes:  resolutionNotes.trim(),
            resolvedBy:       coordinatorUid || "",
            resolvedAt:       serverTimestamp(),
            resolvedWith:     report.id,   // the report this decision came from
          }).catch(err => console.error(`Failed to close sibling report ${r.id}:`, err))
        ));
        siblingReports.forEach(r => {
          notifyReporter(r.reportedBy, r.reporterRole, {
            title: "Your report was reviewed",
            body: `Your report about ${report.company} was reviewed alongside other reports about the same company. Action taken: ${finalAction}.`,
            reportId: r.id,
          }).catch(err => console.error("Failed to notify the reporter:", err));
        });
      }

      setSavedAction(finalAction);
      setSavedNotes(resolutionNotes.trim());
      setStatus(nextStatus);
      setResolvingPanel(false);
    } catch (err) {
      console.error("Failed to resolve report:", err);
    } finally {
      setWorking(false);
      setConfirmingResolve(false);
    }
  };

  // Confirmation copy shown right before an action is actually applied —
  // tailored per action so the coordinator knows exactly what they're about
  // to trigger (especially the two that affect login access).
  const buildResolveConfirmCopy = () => {
    const finalAction = selectedAction === "Others" ? otherActionText.trim() : selectedAction;
    switch (selectedAction) {
      case "Block Account":
        return {
          title: "Block this company?",
          message: `Are you sure you want to block ${report.company}? Their account will be blocked immediately and they will no longer be able to log in until a coordinator reverses this.`,
          confirmLabel: "BLOCK ACCOUNT",
        };
      case "Suspend Account":
        return {
          title: "Suspend this company?",
          message: `Are you sure you want to suspend ${report.company} for ${clampSuspensionDays(suspensionDays)} day(s)? They will not be able to log in until the suspension ends.`,
          confirmLabel: "SUSPEND ACCOUNT",
        };
      case "Require Correction":
        return {
          title: "Require correction?",
          message: `${report.company} will be notified that they must edit or remove the flagged content. Their account stays active. Continue?`,
          confirmLabel: "CONFIRM",
        };
      case "Warning Issued":
        return {
          title: "Issue this warning?",
          message: `${report.company} will receive a formal warning notice. Their account stays active. Continue?`,
          confirmLabel: "CONFIRM",
        };
      default:
        return {
          title: "Confirm this resolution?",
          message: `You're about to resolve this report with the action "${finalAction || "Others"}". Continue?`,
          confirmLabel: "CONFIRM",
        };
    }
  };

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "16px",
      }}>
        <div className="rc-modal-inner rc-detail-inner">
          <div className="rc-modal-header">
            <span style={{
              display: "flex", alignItems: "center", gap: "8px",
              minWidth: 0, flexWrap: "nowrap",
            }}>
              <span style={{
                fontFamily: font.ui,
                fontSize: "clamp(0.95rem, 3.6vw, 1.3rem)",
                color: "#111111",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                minWidth: 0, flex: "0 1 auto",
              }}>
                {report.company}
              </span>
              <span style={{
                fontFamily: font.ui, fontSize: "0.66rem", fontWeight: 700,
                background: badge.bg, color: "white", borderRadius: "12px",
                padding: "3px 9px", whiteSpace: "nowrap", flexShrink: 0,
              }}>{badge.label}</span>
            </span>
            <button
              onClick={onClose}
              style={{
                background: lineSoft, border: `1px solid ${line}`, borderRadius: "50%",
                width: "28px", height: "28px", cursor: "pointer",
                fontWeight: "bold", fontSize: "1rem", color: ink,
                flexShrink: 0, marginLeft: "10px",
              }}
            >✕</button>
          </div>

          <div className="rc-modal-body">
            <div id="rc-detail-info" style={{ width: "fit-content", maxWidth: "100%" }}>
            <p style={{ fontFamily: font.ui, fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Reported Company:</b> {report.company}
            </p>
            <p style={{ fontFamily: font.ui, fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Concern:</b> {report.concern}
            </p>
            <p style={{ fontFamily: font.ui, fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Date:</b> {report.date}
            </p>
            </div>
            <div id="rc-detail-status" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap", width: "fit-content", maxWidth: "100%" }}>
              <p style={{ fontFamily: font.ui, fontSize: "0.9rem", margin: 0 }}>
                <b>Company Account Status:</b>{" "}
                {companyStatus
                  ? <CompanyStatusBadge status={companyStatus} />
                  : <span style={{ color: inkFaint, fontSize: "0.8rem" }}>Loading…</span>}
              </p>
              <button
                onClick={openHistory}
                style={{
                  padding: "4px 14px", borderRadius: "14px",
                  border: `1.5px solid ${panel}`, background: panel, color: "white",
                  fontFamily: font.ui, fontSize: "0.74rem", fontWeight: 600,
                  cursor: "pointer",
                }}
              >View Action History</button>
            </div>
            <div id="rc-detail-description">
            <p style={{ fontFamily: font.ui, fontSize: "0.9rem", fontWeight: 700, marginBottom: "6px" }}>
              DESCRIPTION:
            </p>
            <div style={{ background: lineSoft, borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
              <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: inkBody, lineHeight: 1.6 }}>
                {report.description}
              </p>
            </div>
            </div>

            {files.length > 0 && (
              <div id="rc-detail-attachment">
                <p style={{ fontFamily: font.ui, fontSize: "0.9rem", fontWeight: 700, marginBottom: "10px" }}>
                  {files.length > 1 ? `Attached Files (${files.length}):` : "Attached File:"}
                </p>
                {unsupportedCount > 0 && (
                  <div style={{
                    background: lineSoft, border: `1px solid ${red}`,
                    borderRadius: "8px", padding: "12px 14px", marginBottom: "10px",
                    fontFamily: font.ui, fontSize: "0.82rem", color: red,
                  }}>
                    {unsupportedCount === files.length ? "Unsupported file type" : `${unsupportedCount} file(s) have an unsupported type`}. Only PNG images and PDF files can be previewed or downloaded.
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", maxHeight: "150px", overflowY: "auto", overflowX: "hidden", padding: "8px 14px 4px 0", marginBottom: "10px" }}>
                  {files.filter(isAllowedType).map((f, idx) => {
                    const img = f.type === "image/png";
                    return (
                      <button
                        key={idx}
                        onClick={() => (img ? setLightbox(f) : handleDownload(f))}
                        title={img ? `View ${f.name}` : `Download ${f.name}`}
                        style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", padding: 0, width: "96px" }}
                      >
                        <div style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
                          <img src={img ? imgIcon : pdfIcon} alt={img ? "Image" : "PDF"} style={{ width: "62px", height: "auto", objectFit: "contain", display: "block" }} />
                          <img src={downloadIcon} alt="Download" style={{ position: "absolute", top: "-4px", right: "-10px", width: "20px", height: "20px", objectFit: "contain" }} />
                        </div>
                        <span style={{ fontFamily: font.ui, fontSize: "0.7rem", color: inkBody, textAlign: "center", wordBreak: "break-all", maxWidth: "96px", lineHeight: 1.3 }}>
                          {f.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {status !== "pending" && savedAction && (
              <div id="rc-detail-resolution" style={{ background: lineSoft, borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem" }}>{RESOLUTION_ACTION_META[savedAction]?.icon || "📝"}</span>
                <div>
                  <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: color.success }}>{savedAction}</p>
                  <p style={{ fontFamily: font.ui, fontSize: "0.8rem", color: inkBody, marginTop: "2px" }}>{savedNotes}</p>
                </div>
              </div>
            )}
            {response?.description && (
              <div style={{ background: color.white, border: `1.5px solid ${line}`, borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
                <p style={{ fontFamily: font.ui, fontSize: "0.72rem", color: inkMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "6px" }}>
                  Response from {response.submittedName || report.company}
                </p>
                <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: inkBody, lineHeight: 1.6, overflowWrap: "anywhere", marginBottom: response.attachedFile ? "10px" : 0 }}>
                  {response.description}
                </p>
                {response.attachedFile?.url && (
                  <a
                    href={response.attachedFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "8px",
                      padding: "8px 14px", borderRadius: "20px", border: `1px solid ${line}`,
                      fontFamily: font.ui, fontSize: "0.78rem", fontWeight: 600,
                      color: ink, textDecoration: "none", background: lineSoft, overflowWrap: "anywhere",
                    }}
                  >
                    <img src={/\.(png|jpe?g|gif|webp)$/i.test(response.attachedFile.name || "") || /^image\//i.test(response.attachedFile.type || "") ? imgIcon : pdfIcon} alt="" style={{ width: "18px", height: "22px", objectFit: "contain", flexShrink: 0 }} />
                    {response.attachedFile.name || "View proof"}
                  </a>
                )}
                {response.submittedAt && (
                  <p style={{ fontFamily: font.ui, fontSize: "0.72rem", color: inkMuted, marginTop: "8px" }}>
                    Submitted {new Date(response.submittedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {status === "awaiting_correction" && !response?.description && (
              <p style={{ fontFamily: font.ui, fontSize: "0.78rem", color: inkMuted, marginBottom: "16px" }}>
                No correction has been submitted yet.
              </p>
            )}

            {enforcementNote && (
              <div style={{ background: lineSoft, border: `1.5px solid ${red}`, borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem" }}>⛔</span>
                <p style={{ fontFamily: font.ui, fontSize: "0.8rem", color: darkRed }}>{enforcementNote}</p>
              </div>
            )}
          </div>

          <div style={
            status === "pending"
              ? { display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 20px", borderTop: `1px solid ${line}` }
              : { display: "flex", justifyContent: "flex-end", padding: "16px 28px", borderTop: `1px solid ${line}`, background: panel }
          }>
            {status === "pending" && isAboutMe ? (
              <p style={{ margin: 0, fontFamily: font.ui, fontSize: "0.8rem", color: onPanelDim, lineHeight: 1.5 }}>
                This report is about your own account, so another coordinator has to review it.
              </p>
            ) : status === "pending" ? (
              <div id="rc-detail-actions" style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setConfirmingDismiss(true)}
                  disabled={working}
                  style={{
                    padding: "9px 22px", borderRadius: "22px", background: color.white,
                    color: "#111111", border: `1px solid ${line}`, fontFamily: font.ui,
                    fontSize: "0.82rem", fontWeight: 600, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
                    transition: `background 160ms ${ease}, color 160ms ${ease}`,
                  }}
                  onMouseEnter={e => { if (!working) { e.currentTarget.style.background = panel; e.currentTarget.style.color = onPanel; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = color.white; e.currentTarget.style.color = "#111111"; }}
                >DISMISS</button>
                <button
                  onClick={() => setResolvingPanel(true)}
                  disabled={working}
                  style={{
                    padding: "9px 22px", borderRadius: "22px", background: color.white,
                    color: "#111111", border: `1px solid ${line}`, fontFamily: font.ui,
                    fontSize: "0.82rem", fontWeight: 600, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
                    transition: `background 160ms ${ease}, color 160ms ${ease}`,
                  }}
                  onMouseEnter={e => { if (!working) { e.currentTarget.style.background = panel; e.currentTarget.style.color = onPanel; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = color.white; e.currentTarget.style.color = "#111111"; }}
                >RESOLVE</button>
              </div>
            ) : status === "awaiting_correction" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", width: "100%" }}>
                <span style={{ fontFamily: font.ui, fontSize: "0.78rem", color: onPanelDim, marginRight: "auto" }}>
                  Waiting for {report.company} to make the correction.
                </span>
                <button
                  onClick={handleEscalate}
                  disabled={working}
                  style={{
                    padding: "9px 18px", borderRadius: "22px", background: "transparent",
                    color: onPanel, border: `1px solid ${onPanelDim}`, fontFamily: font.ui,
                    fontSize: "0.82rem", fontWeight: 600, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
                  }}
                >NOT CORRECTED</button>
                <button
                  onClick={() => setConfirmingCorrected(true)}
                  disabled={working}
                  style={{
                    padding: "9px 18px", borderRadius: "22px", background: color.white,
                    color: "#111111", border: `1px solid ${line}`, fontFamily: font.ui,
                    fontSize: "0.82rem", fontWeight: 600, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
                  }}
                >MARK AS CORRECTED</button>
              </div>
            ) : (
              <p id="rc-detail-locked" style={{ margin: 0, fontFamily: font.ui, fontSize: "0.8rem", color: onPanelDim, display: "flex", alignItems: "center", gap: "6px" }}>
                This report has been {status === "resolved" ? "resolved" : status} and can no longer be changed.
              </p>
            )}
          </div>
        </div>
      </div>

      {lightbox && lightbox.url && (
        <ImageLightbox src={lightbox.url} name={lightbox.name} onClose={() => setLightbox(false)} />
      )}

      {resolvingPanel && (
        <ResolveActionModal
          availableActions={availableActions}
          siblingCount={siblingReports.length}
          applyToAll={applyToAll}
          setApplyToAll={setApplyToAll}
          selectedAction={selectedAction}
          setSelectedAction={setSelectedAction}
          otherActionText={otherActionText}
          setOtherActionText={setOtherActionText}
          resolutionNotes={resolutionNotes}
          setResolutionNotes={setResolutionNotes}
          suspensionDays={suspensionDays}
          setSuspensionDays={setSuspensionDays}
          suspensionDaysError={suspensionDaysError}
          working={working}
          canConfirm={canConfirmResolve}
          onCancel={() => { setResolvingPanel(false); setSelectedAction(null); setOtherActionText(""); setResolutionNotes(""); setSuspensionDays("7"); }}
          onConfirm={() => setConfirmingResolve(true)}
        />
      )}

      {confirmingResolve && (
        <ConfirmModal
          {...buildResolveConfirmCopy()}
          working={working}
          onCancel={() => setConfirmingResolve(false)}
          onConfirm={handleConfirmResolve}
        />
      )}

      {confirmingDismiss && (
        <ConfirmModal
          title="Dismiss Report?"
          message="This closes the report with no action against the company. It can't be undone, and the reason below is sent to whoever filed it."
          confirmLabel="DISMISS"
          working={working}
          onCancel={() => { setConfirmingDismiss(false); setDismissError(""); }}
          onConfirm={handleDismiss}
        >
          <div style={{ width: "100%", marginBottom: "4px" }}>
            <textarea
              value={dismissReason}
              onChange={e => { setDismissReason(e.target.value.slice(0, DISMISS_REASON_MAX)); setDismissError(""); }}
              maxLength={DISMISS_REASON_MAX}
              placeholder="Why is this being dismissed?"
              disabled={working}
              style={{
                width: "100%", boxSizing: "border-box", minHeight: "90px", resize: "vertical",
                padding: "10px 12px", borderRadius: "10px",
                border: `1.5px solid ${dismissError ? color.danger : line}`,
                fontFamily: font.ui, fontSize: "0.82rem", color: ink, outline: "none", background: color.white,
              }}
            />
            <p style={{ fontSize: "0.7rem", color: "#8a8a8a", textAlign: "right", margin: "4px 0 0" }}>
              {(dismissReason || "").length}/{DISMISS_REASON_MAX}
            </p>
            {dismissError && (
              <p role="alert" style={{ fontFamily: font.ui, fontSize: "0.72rem", color: color.danger, margin: "2px 0 0" }}>{dismissError}</p>
            )}
          </div>
        </ConfirmModal>
      )}

      {confirmingCorrected && (
        <ConfirmModal
          title="Mark as corrected?"
          message={`Confirm that ${report.company} has made the required correction. The report closes as resolved. If they haven't, choose "Not corrected" instead and apply a stronger action.`}
          confirmLabel="MARK AS CORRECTED"
          working={working}
          onCancel={() => setConfirmingCorrected(false)}
          onConfirm={handleMarkCorrected}
        />
      )}

      <ActionHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        loading={historyLoading}
        history={history}
        error={historyError}
      />
    </>
  );
};

// ── Generic confirm dialog (e.g. "are you sure?") ─────────────────────────────
const ConfirmModal = ({ title, message, confirmLabel = "CONFIRM", working, onCancel, onConfirm, children }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1200, padding: "16px",
  }}>
    <div style={{
      background: color.white, borderRadius: "18px",
      width: "min(380px, calc(100vw - 48px))",
      overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
    }}>
      <div style={{ padding: "26px 24px 8px" }}>
        <p style={{ fontFamily: font.ui, fontSize: "1.3rem", color: darkRed, marginBottom: "8px" }}>
          {title}
        </p>
        <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: inkBody, lineHeight: 1.5 }}>
          {message}
        </p>
        {children}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 20px", borderTop: `1px solid ${line}` }}>
        <button
          onClick={onCancel}
          disabled={working}
          style={{
            padding: "9px 22px", borderRadius: "22px", background: color.white,
            color: "#111111", border: `1px solid ${line}`, fontFamily: font.ui,
            fontSize: "0.82rem", fontWeight: 600, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
            transition: `background 160ms ${ease}, color 160ms ${ease}`,
          }}
          onMouseEnter={e => { if (!working) { e.currentTarget.style.background = panel; e.currentTarget.style.color = onPanel; } }}
          onMouseLeave={e => { e.currentTarget.style.background = color.white; e.currentTarget.style.color = "#111111"; }}
        >CANCEL</button>
        <button
          onClick={onConfirm}
          disabled={working}
          style={{
            padding: "9px 22px", borderRadius: "22px", background: color.white,
            color: "#111111", border: `1px solid ${line}`, fontFamily: font.ui,
            fontSize: "0.82rem", fontWeight: 600, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
            transition: `background 160ms ${ease}, color 160ms ${ease}`,
          }}
          onMouseEnter={e => { if (!working) { e.currentTarget.style.background = panel; e.currentTarget.style.color = onPanel; } }}
          onMouseLeave={e => { e.currentTarget.style.background = color.white; e.currentTarget.style.color = "#111111"; }}
        >{working ? "..." : confirmLabel}</button>
      </div>
    </div>
  </div>
);

// ── Resolve Action Modal (separate overlay, opened from RESOLVE) ─────────────
const ResolveActionModal = ({
  availableActions, selectedAction, setSelectedAction,
  siblingCount = 0, applyToAll = true, setApplyToAll = () => {},
  otherActionText, setOtherActionText,
  resolutionNotes, setResolutionNotes,
  suspensionDays, setSuspensionDays, suspensionDaysError = "",
  working, canConfirm,
  onCancel, onConfirm,
}) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1100, padding: "16px",
  }}>
    <div className="rc-modal-inner">
      <div style={{ background: color.white, borderBottom: `1px solid ${line}`, padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: font.ui, fontSize: "1.4rem", color: ink, letterSpacing: "0.03em" }}>Resolve Report</span>
        <button
          onClick={onCancel}
          disabled={working}
          style={{ background: lineSoft, border: `1px solid ${line}`, borderRadius: "50%", width: "26px", height: "26px", cursor: working ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", color: ink, flexShrink: 0 }}
        >✕</button>
      </div>

      <div className="rc-resolve-body" style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
        <div style={{ background: lineSoft, border: `1.5px solid ${red}`, borderRadius: "12px", padding: "16px" }}>
          <div id="rc-resolve-actions" style={{ marginBottom: "16px" }}>
          <p style={{ fontFamily: font.ui, fontSize: "1.1rem", color: darkRed, marginBottom: "10px" }}>
            What action was taken?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {availableActions.map(action => {
              const meta = RESOLUTION_ACTION_META[action];
              const isSelected = selectedAction === action;
              return (
                <div
                  key={action}
                  onClick={() => setSelectedAction(action)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "9px 12px", borderRadius: "10px", cursor: "pointer",
                    border: `2px solid ${isSelected ? red : line}`,
                    background: isSelected ? color.white : lineSoft,
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{meta.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: ink }}>{action}</p>
                    <p style={{ fontFamily: font.ui, fontSize: "0.7rem", color: inkMuted }}>{meta.desc}</p>
                  </div>
                  <div style={{
                    width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${isSelected ? red : inkFaint}`,
                    background: isSelected ? red : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isSelected && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: color.white }} />}
                  </div>
                </div>
              );
            })}
          </div>
          </div>

          {selectedAction === "Others" && (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontFamily: font.ui, fontSize: "0.9rem", color: ink, marginBottom: "6px" }}>
                Specify the action taken
              </p>
              <input
                type="text"
                value={otherActionText}
                onChange={e => setOtherActionText(e.target.value.slice(0, OTHER_ACTION_MAX))}
                maxLength={OTHER_ACTION_MAX}
                placeholder=""
                style={{
                  width: "100%", borderRadius: "10px",
                  border: `1.5px solid ${line}`, padding: "10px 12px",
                  fontFamily: font.ui, fontSize: "0.82rem", color: ink,
                  outline: "none", background: color.white, boxSizing: "border-box",
                }}
              />
                <p style={{ fontSize: "0.7rem", color: "#8a8a8a", textAlign: "right", margin: "4px 0 0" }}>{(otherActionText || "").length}/{OTHER_ACTION_MAX}</p>
            </div>
          )}

          {selectedAction === "Suspend Account" && (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontFamily: font.ui, fontSize: "0.9rem", color: ink, marginBottom: "6px" }}>
                Suspend for how many days? ({SUSPENSION_MIN_DAYS}–{SUSPENSION_MAX_DAYS})
              </p>
              <input
                type="number"
                inputMode="numeric"
                min={SUSPENSION_MIN_DAYS}
                max={SUSPENSION_MAX_DAYS}
                step="1"
                value={suspensionDays}
                onChange={e => {
                  // Digits only, and the whole number is clamped to the
                  // maximum — so a pasted 10000000000 becomes 31, not 10.
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  if (digits === "") { setSuspensionDays(""); return; }
                  setSuspensionDays(String(Math.min(Number(digits), SUSPENSION_MAX_DAYS) || SUSPENSION_MIN_DAYS));
                }}
                placeholder="e.g. 7"
                aria-invalid={!!suspensionDaysError}
                style={{
                  width: "120px", borderRadius: "10px",
                  border: `1.5px solid ${suspensionDaysError ? color.danger : line}`, padding: "10px 12px",
                  fontFamily: font.ui, fontSize: "0.82rem", color: ink,
                  outline: "none", background: color.white, boxSizing: "border-box",
                }}
              />
              {suspensionDaysError ? (
                <p role="alert" style={{ fontFamily: font.ui, fontSize: "0.7rem", color: color.danger, marginTop: "6px" }}>
                  {suspensionDaysError}
                </p>
              ) : (
                <p style={{ fontFamily: font.ui, fontSize: "0.7rem", color: inkMuted, marginTop: "6px" }}>
                  Account auto-reactivates once this period ends. For anything longer, use Block Account.
                </p>
              )}
            </div>
          )}

          <div id="rc-resolve-notes">
          <p style={{ fontFamily: font.ui, fontSize: "0.9rem", color: ink, marginBottom: "6px" }}>
            How was this resolved?
          </p>
          {siblingCount > 0 && (
            <label style={{
              display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "14px",
              fontFamily: font.ui, fontSize: "0.8rem", color: inkBody, cursor: "pointer", lineHeight: 1.5,
            }}>
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={e => setApplyToAll(e.target.checked)}
                style={{ marginTop: "3px", flexShrink: 0 }}
              />
              <span>
                Apply this decision to the {siblingCount} other open report{siblingCount !== 1 ? "s" : ""} about this company.
                They close together and count as one action, instead of {siblingCount + 1}.
              </span>
            </label>
          )}

          <textarea
            value={resolutionNotes}
            onChange={e => setResolutionNotes(e.target.value.slice(0, RESOLUTION_NOTES_MAX))}
            maxLength={RESOLUTION_NOTES_MAX}
            placeholder="Describe the resolution"
            style={{
              width: "100%", minHeight: "80px", borderRadius: "10px",
              border: `1.5px solid ${line}`, padding: "10px 12px",
              fontFamily: font.ui, fontSize: "0.82rem", color: ink,
              resize: "vertical", outline: "none", background: color.white,
              boxSizing: "border-box", display: "block",
            }}
          />
            <p style={{ fontSize: "0.7rem", color: "#8a8a8a", textAlign: "right", margin: "4px 0 0" }}>{(resolutionNotes || "").length}/{RESOLUTION_NOTES_MAX}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 20px", borderTop: `1px solid ${line}` }}>
        <div id="rc-resolve-footer" style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={onCancel}
          disabled={working}
          style={{
            padding: "9px 22px", borderRadius: "22px", background: color.white,
            color: "#111111", border: `1px solid ${line}`, fontFamily: font.ui,
            fontSize: "0.82rem", fontWeight: 600, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
            transition: `background 160ms ${ease}, color 160ms ${ease}`,
          }}
          onMouseEnter={e => { if (!working) { e.currentTarget.style.background = panel; e.currentTarget.style.color = onPanel; } }}
          onMouseLeave={e => { e.currentTarget.style.background = color.white; e.currentTarget.style.color = "#111111"; }}
        >CANCEL</button>
        <button
          onClick={onConfirm}
          disabled={working || !canConfirm}
          style={{
            padding: "9px 22px", borderRadius: "22px", background: color.white,
            color: "#111111", border: `1px solid ${line}`, fontFamily: font.ui,
            fontSize: "0.82rem", fontWeight: 600, cursor: (working || !canConfirm) ? "not-allowed" : "pointer", opacity: (working || !canConfirm) ? 0.5 : 1,
            transition: `background 160ms ${ease}, color 160ms ${ease}`,
          }}
          onMouseEnter={e => { if (!working && canConfirm) { e.currentTarget.style.background = panel; e.currentTarget.style.color = onPanel; } }}
          onMouseLeave={e => { e.currentTarget.style.background = color.white; e.currentTarget.style.color = "#111111"; }}
        >CONFIRM RESOLUTION</button>
        </div>
      </div>
    </div>
  </div>
);

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <p style={{ color: inkBody, fontSize: "1rem", fontFamily: font.ui }}>No reports submitted yet.</p>
    <p style={{ color: inkMuted, fontSize: "0.82rem", fontFamily: font.ui }}>Reports submitted from a company profile will appear here.</p>
  </div>
);

// ── View button (reused in both table and cards) ──────────────────────────────
const ViewButton = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "5px 16px", borderRadius: "16px",
      border: `1.5px solid ${red}`, background: color.white, color: red,
      fontFamily: font.ui, fontSize: "0.78rem",
      cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
    }}
  >View</button>
);

// ── Status badge (reused in table and cards) ──────────────────────────────────
const REPORT_STATUS_BADGE = {
  pending:   { bg: inkFaint, label: "Pending" },
  // Require Correction leaves the report OPEN: the company was told to fix
  // something, but nothing verifies that they did. Closing it as "resolved"
  // right away would file away a matter nobody has actually checked.
  awaiting_correction: { bg: "#B8860B", label: "Awaiting correction" },
  resolved:  { bg: color.success, label: "Resolved" },
  dismissed: { bg: lineSoft, label: "Dismissed" },
};
// An "Awaiting correction" report nobody has followed up on.
const isCorrectionOverdue = (report) => {
  if (report?.status !== "awaiting_correction") return false;
  const since = report.resolvedAt?.seconds ? report.resolvedAt.seconds * 1000 : 0;
  if (!since) return false;
  return Date.now() - since > CORRECTION_OVERDUE_DAYS * 24 * 60 * 60 * 1000;
};

const OverdueFlag = () => (
  <span title={`No correction submitted for over ${CORRECTION_OVERDUE_DAYS} days`} style={{
    marginLeft: "6px", background: "#F7E9E9", color: darkRed, borderRadius: "999px",
    padding: "1px 8px", fontFamily: font.ui, fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap",
  }}>Overdue</span>
);

const StatusBadge = ({ status }) => {
  const b = REPORT_STATUS_BADGE[status] || REPORT_STATUS_BADGE.pending;
  return (
    <span style={{
      fontFamily: font.ui, fontSize: "0.7rem", fontWeight: 700,
      background: b.bg, color: "white", borderRadius: "12px",
      padding: "3px 10px", whiteSpace: "nowrap",
    }}>{b.label}</span>
  );
};

// ── Report Company Screen ─────────────────────────────────────────────────────
// A suspension is a temporary hold: 1 day minimum, one month maximum. Anything
// longer is a Block, which has no end date. Both the input and the value handed
// to applyCompanyEnforcement are held to this range.
const SUSPENSION_MIN_DAYS = 1;
const SUSPENSION_MAX_DAYS = 365;
const SUSPENSION_DEFAULT_DAYS = 7;
const clampSuspensionDays = (value) => {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < SUSPENSION_MIN_DAYS) return SUSPENSION_DEFAULT_DAYS;
  return Math.min(n, SUSPENSION_MAX_DAYS);
};

// `reports` are the ones in this coordinator's assigned industries;
// `otherReports` is everything else, including companies whose industry
// matches no coordinator at all. Those used to be invisible to everyone (the
// scope fails closed by design), which meant a serious report about an
// unassigned company could sit unread — the second tab makes them reachable
// without mixing them into the default view.
const CoordinatorReportCompanyScreen = ({ reports = [], otherReports = [], onViewReport }) => {
  // Open on "All reports" when this coordinator's own industries have nothing:
  // an empty default list reads as "no reports exist", which is exactly the
  // confusion the second tab is meant to prevent.
  const [tab, setTab] = useState(() => (reports.length === 0 && otherReports.length > 0 ? "all" : "mine"));
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch]             = useState("");

  const inScope = tab === "all" ? [...reports, ...otherReports] : reports;
  const pendingOther = otherReports.filter(r => r.status !== "resolved" && r.status !== "dismissed").length;

  // Default to the work queue — Pending and Awaiting correction — instead of a
  // single pile where closed reports bury the ones still needing a decision.
  const isOpenReport = (r) => r.status !== "resolved" && r.status !== "dismissed";
  const q = search.trim().toLowerCase();
  const shown = inScope
    .filter(r => statusFilter === "all"
      || (statusFilter === "open" && isOpenReport(r))
      || r.status === statusFilter)
    .filter(r => !q || [r.company, r.concern, r.subjectName].filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q)))
    // Oldest open report first: the one that has waited longest needs a
    // decision most. Closed ones read better newest-first.
    .sort((a, b) => {
      const ao = isOpenReport(a), bo = isOpenReport(b);
      if (ao !== bo) return ao ? -1 : 1;
      const at = a.createdAt?.seconds || 0, bt = b.createdAt?.seconds || 0;
      return ao ? at - bt : bt - at;
    });

  const statusCounts = {
    open:      inScope.filter(isOpenReport).length,
    resolved:  inScope.filter(r => r.status === "resolved").length,
    dismissed: inScope.filter(r => r.status === "dismissed").length,
  };

  return (
  <>
    <ResponsiveStyles />
    <div className="rc-screen" style={{ background: page, color: ink }}>

      {/* Header — title and total are separate containers */}
      <div className="rc-header-row">
        <div className="rc-header">
          <h1 className="rc-title" title="Report List">Report List</h1>
        </div>

        <div
          className="rc-total-badge"
          id="rc-total-badge"
          aria-label={`Total reports: ${shown.length}`}
        >
          <div style={{
            fontFamily: font.ui,
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            color: ink,
            lineHeight: 1,
          }}>
            {shown.length}
          </div>

          <div style={{
            fontFamily: font.ui,
            fontSize: "0.68rem",
            fontWeight: 700,
            color: inkMuted,
            marginTop: "4px",
          }}>
            Total
          </div>
        </div>
      </div>

      {otherReports.length > 0 && (
        <div role="tablist" aria-label="Report scope" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
          {[
            { key: "mine", label: "My industries", count: reports.length },
            { key: "all",  label: "All reports",   count: reports.length + otherReports.length },
          ].map(t => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                style={{
                  border: `1.5px solid ${on ? panel : lineStrong}`, background: on ? panel : color.white,
                  color: on ? color.white : inkBody, borderRadius: "999px",
                  padding: "7px 16px", cursor: "pointer", fontFamily: font.ui,
                  fontSize: "0.8rem", fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: "8px", maxWidth: "100%",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                <span style={{ background: on ? "rgba(255,255,255,0.22)" : color.wine700, color: on ? color.white : inkMuted, borderRadius: "999px", padding: "1px 8px", fontSize: "0.72rem", fontWeight: 700 }}>{t.count}</span>
                {t.key === "all" && pendingOther > 0 && !on && (
                  <span title={`${pendingOther} unresolved outside your industries`} style={{ width: "7px", height: "7px", borderRadius: "50%", background: color.danger, flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Status filter + search. A Report List with no way to separate the work
          queue from closed cases is just a pile that grows. */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
        {[
          { key: "open",      label: "Needs action", count: statusCounts.open },
          { key: "resolved",  label: "Resolved",     count: statusCounts.resolved },
          { key: "dismissed", label: "Dismissed",    count: statusCounts.dismissed },
          { key: "all",       label: "All",          count: inScope.length },
        ].map(f => {
          const on = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{
                border: `1.5px solid ${on ? panel : lineStrong}`, background: on ? panel : color.white,
                color: on ? color.white : inkBody, borderRadius: "999px", padding: "6px 14px",
                cursor: "pointer", fontFamily: font.ui, fontSize: "0.78rem", fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: "7px",
              }}
            >
              {f.label}
              <span style={{
                background: on ? "rgba(255,255,255,0.22)" : lineSoft,
                color: on ? color.white : inkMuted, borderRadius: "999px",
                padding: "1px 7px", fontSize: "0.7rem", fontWeight: 700,
              }}>{f.count}</span>
            </button>
          );
        })}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search company or concern"
          aria-label="Search reports"
          style={{
            marginLeft: "auto", minWidth: "200px", flex: "0 1 260px",
            padding: "8px 14px", borderRadius: "999px", border: `1px solid ${line}`,
            fontFamily: font.ui, fontSize: "0.8rem", color: ink, outline: "none", background: color.white,
          }}
        />
      </div>

      <div id="rc-report-list">
        {/* ── Desktop: table ── */}
        <div className="rc-table-wrap">
          <table className="rc-table">
            <thead>
              <tr>
                {["Reported Company", "Concern", "Date", "Status", "Action"].map(h => (
                  <th key={h} className="rc-th">{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {shown.map((r, i) => (
                <tr key={r.id || i}>
                  <td className="rc-td">{r.company}</td>
                  <td className="rc-td">{r.concern}</td>
                  <td className="rc-td">{r.date}</td>
                  <td className="rc-td">
                    <StatusBadge status={r.status || "pending"} />{isCorrectionOverdue(r) && <OverdueFlag />}
                  </td>
                  <td className="rc-td">
                    <ViewButton onClick={() => onViewReport && onViewReport(r)} />
                  </td>
                </tr>
              ))}

              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} style={{
                    padding: "60px 20px",
                    background: surface,
                  }}>
                    <EmptyState />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile: cards ── */}
        <div className="rc-card-list">
          {shown.map((r, i) => (
            <div key={r.id || i} className="rc-card">
              <div className="rc-card-top">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="rc-card-label">Reported Company</p>
                  <p
                    className="rc-card-value"
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.company}
                  </p>
                </div>

                <ViewButton onClick={() => onViewReport && onViewReport(r)} />
              </div>

              <div className="rc-card-bottom">
                <div style={{ minWidth: 0 }}>
                  <p className="rc-card-label">Concern</p>
                  <p className="rc-card-value">{r.concern}</p>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p className="rc-card-label">Date</p>
                  <p className="rc-card-value">{r.date}</p>
                </div>
              </div>

              <div style={{ marginTop: "2px" }}>
                <StatusBadge status={r.status || "pending"} />{isCorrectionOverdue(r) && <OverdueFlag />}
              </div>
            </div>
          ))}

          {shown.length === 0 && (
            <div style={{ paddingTop: "60px" }}>
              <EmptyState />
            </div>
          )}
        </div>
      </div>

    </div>
  </>
  );
};

export default CoordinatorReportCompanyScreen;