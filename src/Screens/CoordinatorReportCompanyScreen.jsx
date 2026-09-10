import React, { useState, useEffect } from "react";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { color, font, type, space, radius, shadow, ease } from "./theme";
import {
  logActivity,
  applyCompanyEnforcement,
  recordCompanyAction,
  notifyCompany,
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
const lineSoft   = "#F4F4F4";
const panel      = "#000000";
const panelDeep  = "#222222";
const onPanel    = "#FFFFFF";
const onPanelDim = "#F5F5F5";

const red      = "#111111";
const darkRed = "#000000";

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
      background: ${panel} !important;
      border: 1px solid ${panel} !important;
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

    @media (max-width: 560px) {
      .rc-modal-inner {
        width: calc(100vw - 72px) !important;
        max-height: 68vh !important;
        border-radius: 14px !important;
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
      background: ${lineSoft} !important;
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
const ActionHistoryModal = ({ open, onClose, loading, history }) => {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1300, padding: "16px",
    }}>
      <div style={{
        background: color.white, borderRadius: "18px", width: "100%", maxWidth: "460px",
        maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
      }}>
        <div style={{ background: color.white, borderBottom: `1px solid ${line}`, padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: font.ui, fontSize: "1.3rem", color: ink }}>Action History</span>
          <button onClick={onClose} style={{ background: lineSoft, border: `1px solid ${line}`, borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", fontSize: "0.9rem", color: ink }}>✕</button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {loading && <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: inkFaint, textAlign: "center", padding: "20px" }}>Loading…</p>}
          {!loading && history.length === 0 && (
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
                By {h.coordinatorName} • {h.previousAccountStatus} → {h.newAccountStatus}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ReportDetailModal = ({ report, onClose, coordinatorUid, coordinatorName }) => {
  const [lightbox, setLightbox]           = useState(false);
  const [status, setStatus]               = useState(report?.status || "pending");
  const [working, setWorking]             = useState(false);
  const [resolvingPanel, setResolvingPanel] = useState(false);
  const [confirmingDismiss, setConfirmingDismiss] = useState(false);
  const [confirmingResolve, setConfirmingResolve] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [otherActionText, setOtherActionText] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [suspensionDays, setSuspensionDays]   = useState("7");
  const [savedAction, setSavedAction]         = useState(report?.resolutionAction || "");
  const [savedNotes, setSavedNotes]           = useState(report?.resolutionNotes || "");
  const [enforcementNote, setEnforcementNote] = useState(null);
  const [companyStatus, setCompanyStatus]     = useState(null); // live accountStatus, fetched below
  const [historyOpen, setHistoryOpen]         = useState(false);
  const [history, setHistory]                 = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

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
    if (!report?.companyId) return;
    setHistoryLoading(true);
    try {
      setHistory(await getCompanyActionHistory(report.companyId));
    } catch (err) {
      console.error("Failed to load action history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (!report) return null;

  const file    = report.attachedFile;
  const allowed = isAllowedType(file);
  const isImage = allowed && file.type === "image/png";
  const isPdf   = allowed && file.type === "application/pdf";

  const badge = REPORT_STATUS_BADGE[status] || REPORT_STATUS_BADGE.pending;
  const availableActions = STANDARD_ACTIONS;
  const canConfirmResolve = selectedAction
    && resolutionNotes.trim().length > 0
    && (selectedAction !== "Others" || otherActionText.trim().length > 0)
    && (selectedAction !== "Suspend Account" || Number(suspensionDays) > 0);

  const handleDismiss = async () => {
    if (working || status !== "pending") return;
    setWorking(true);
    try {
      await updateDoc(doc(db, "reports", report.id), {
        status:      "dismissed",
        resolvedBy:  coordinatorUid || "",
        resolvedAt:  serverTimestamp(),
      });
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

  const handleConfirmResolve = async () => {
    if (working || status !== "pending" || !canConfirmResolve) return;
    setWorking(true);
    const finalAction = selectedAction === "Others" ? otherActionText.trim() : selectedAction;
    try {
      await updateDoc(doc(db, "reports", report.id), {
        status:           "resolved",
        resolutionAction: finalAction,
        resolutionNotes:  resolutionNotes.trim(),
        resolvedBy:       coordinatorUid || "",
        resolvedAt:       serverTimestamp(),
      });
      logActivity(
        coordinatorUid,
        "report_resolved",
        `Resolved report on ${report.company} (${finalAction})`,
        { targetId: report.id, targetName: report.company }
      ).catch(err => console.error("Failed to log activity:", err));

      // Actually enforce the action on the company itself, not just the report.
      let enforcementResult = null;
      try {
        enforcementResult = await applyCompanyEnforcement(report.companyId, finalAction, coordinatorUid, suspensionDays);
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
        await notifyCompany(
          coordinatorUid,
          coordinatorName || "Coordinator",
          report.companyId,
          report.company,
          buildNotificationText(finalAction, resolutionNotes.trim()),
        );
      } catch (err) {
        console.error("Failed to notify company:", err);
      }

      setSavedAction(finalAction);
      setSavedNotes(resolutionNotes.trim());
      setStatus("resolved");
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
          message: `Are you sure you want to suspend ${report.company} for ${Number(suspensionDays) > 0 ? suspensionDays : 7} day(s)? They will not be able to log in until the suspension ends.`,
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
        <div className="rc-modal-inner">
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
            <p style={{ fontFamily: font.ui, fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Reported Company:</b> {report.company}
            </p>
            <p style={{ fontFamily: font.ui, fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Concern:</b> {report.concern}
            </p>
            <p style={{ fontFamily: font.ui, fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Date:</b> {report.date}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
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
            <p style={{ fontFamily: font.ui, fontSize: "0.9rem", fontWeight: 700, marginBottom: "6px" }}>
              DESCRIPTION:
            </p>
            <div style={{ background: lineSoft, borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
              <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: inkBody, lineHeight: 1.6 }}>
                {report.description}
              </p>
            </div>

            {file && (
              <>
                <p style={{ fontFamily: font.ui, fontSize: "0.9rem", fontWeight: 700, marginBottom: "10px" }}>
                  Attached File:
                </p>
                {!allowed && (
                  <div style={{
                    background: lineSoft, border: `1px solid ${red}`,
                    borderRadius: "8px", padding: "12px 14px",
                    fontFamily: font.ui, fontSize: "0.82rem", color: red,
                  }}>
                    Unsupported file type. Only PNG images and PDF files can be previewed or downloaded.
                  </div>
                )}
                {isImage && (
                  <div>
                    <div
                      onClick={() => setLightbox(true)}
                      style={{ position: "relative", display: "inline-block", cursor: "zoom-in", marginBottom: "10px" }}
                    >
                      <img
                        src={file.url} alt="attachment"
                        style={{ maxWidth: "100%", borderRadius: "8px", border: `1px solid ${line}`, display: "block" }}
                      />
                      <div
                        style={{
                          position: "absolute", inset: 0, borderRadius: "8px",
                          background: "rgba(0,0,0,0.22)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: 0, transition: "opacity 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0"}
                      >
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          <line x1="11" y1="8" x2="11" y2="14"/>
                          <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                      </div>
                    </div>
                    <button onClick={() => handleDownload(file)} style={downloadBtnStyle}>
                      <DownloadIcon /> Download Image
                    </button>
                  </div>
                )}
                {isPdf && (
                  <div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      background: lineSoft, padding: "10px 14px",
                      borderRadius: "8px", marginBottom: "10px",
                      width: "100%", minWidth: 0, boxSizing: "border-box",
                    }}>
                      <PdfIcon />
                      <span style={{ fontFamily: font.ui, fontSize: "0.82rem", color: inkBody, flex: "1 1 0%", minWidth: 0, maxWidth: "100%", wordBreak: "break-all", overflowWrap: "anywhere" }}>
                        {file.name}
                      </span>
                    </div>
                    <button onClick={() => handleDownload(file)} style={downloadBtnStyle}>
                      <DownloadIcon /> Download PDF
                    </button>
                  </div>
                )}
              </>
            )}
            {status !== "pending" && savedAction && (
              <div style={{ background: lineSoft, borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem" }}>{RESOLUTION_ACTION_META[savedAction]?.icon || "📝"}</span>
                <div>
                  <p style={{ fontFamily: font.ui, fontSize: "0.85rem", color: color.success }}>{savedAction}</p>
                  <p style={{ fontFamily: font.ui, fontSize: "0.8rem", color: inkBody, marginTop: "2px" }}>{savedNotes}</p>
                </div>
              </div>
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
            {status === "pending" ? (
              <>
                <button
                  onClick={() => setConfirmingDismiss(true)}
                  disabled={working}
                  style={{
                    padding: "9px 22px", borderRadius: "22px", background: color.white,
                    color: "#111111", border: `1px solid ${line}`, fontFamily: font.ui,
                    fontSize: "0.82rem", fontWeight: 600, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
                    transition: `background 160ms ${ease}, color 160ms ${ease}`,
                  }}
                  onMouseEnter={e => { if (!working) { e.currentTarget.style.background = "#8C8C8C"; e.currentTarget.style.color = "#ffffff"; } }}
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
                  onMouseEnter={e => { if (!working) { e.currentTarget.style.background = color.success; e.currentTarget.style.color = "#ffffff"; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = color.white; e.currentTarget.style.color = "#111111"; }}
                >RESOLVE</button>
              </>
            ) : (
              <p style={{ margin: 0, fontFamily: font.ui, fontSize: "0.8rem", color: onPanelDim, display: "flex", alignItems: "center", gap: "6px" }}>
                This report has been {status} and can no longer be changed.
              </p>
            )}
          </div>
        </div>
      </div>

      {lightbox && isImage && (
        <ImageLightbox src={file.url} name={file.name} onClose={() => setLightbox(false)} />
      )}

      {resolvingPanel && (
        <ResolveActionModal
          availableActions={availableActions}
          selectedAction={selectedAction}
          setSelectedAction={setSelectedAction}
          otherActionText={otherActionText}
          setOtherActionText={setOtherActionText}
          resolutionNotes={resolutionNotes}
          setResolutionNotes={setResolutionNotes}
          suspensionDays={suspensionDays}
          setSuspensionDays={setSuspensionDays}
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
          message="Are you sure you want to dismiss this report? This action cannot be undone."
          confirmLabel="DISMISS"
          working={working}
          onCancel={() => setConfirmingDismiss(false)}
          onConfirm={handleDismiss}
        />
      )}

      <ActionHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        loading={historyLoading}
        history={history}
      />
    </>
  );
};

// ── Generic confirm dialog (e.g. "are you sure?") ─────────────────────────────
const ConfirmModal = ({ title, message, confirmLabel = "CONFIRM", working, onCancel, onConfirm }) => (
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
          onMouseEnter={e => { if (!working) { e.currentTarget.style.background = "#8C8C8C"; e.currentTarget.style.color = "#ffffff"; } }}
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
          onMouseEnter={e => { if (!working) { e.currentTarget.style.background = panel; e.currentTarget.style.color = "#ffffff"; } }}
          onMouseLeave={e => { e.currentTarget.style.background = color.white; e.currentTarget.style.color = "#111111"; }}
        >{working ? "..." : confirmLabel}</button>
      </div>
    </div>
  </div>
);

// ── Resolve Action Modal (separate overlay, opened from RESOLVE) ─────────────
const ResolveActionModal = ({
  availableActions, selectedAction, setSelectedAction,
  otherActionText, setOtherActionText,
  resolutionNotes, setResolutionNotes,
  suspensionDays, setSuspensionDays,
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

      <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
        <div style={{ background: lineSoft, border: `1.5px solid ${red}`, borderRadius: "12px", padding: "16px" }}>
          <p style={{ fontFamily: font.ui, fontSize: "1.1rem", color: darkRed, marginBottom: "10px" }}>
            What action was taken?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
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

          {selectedAction === "Others" && (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontFamily: font.ui, fontSize: "0.9rem", color: ink, marginBottom: "6px" }}>
                Specify the action taken
              </p>
              <input
                type="text"
                value={otherActionText}
                onChange={e => setOtherActionText(e.target.value)}
                placeholder=""
                style={{
                  width: "100%", borderRadius: "10px",
                  border: `1.5px solid ${line}`, padding: "10px 12px",
                  fontFamily: font.ui, fontSize: "0.82rem", color: ink,
                  outline: "none", background: color.white, boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {selectedAction === "Suspend Account" && (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontFamily: font.ui, fontSize: "0.9rem", color: ink, marginBottom: "6px" }}>
                Suspend for how many days?
              </p>
              <input
                type="number"
                min="1"
                value={suspensionDays}
                onChange={e => setSuspensionDays(e.target.value)}
                placeholder="e.g. 7"
                style={{
                  width: "120px", borderRadius: "10px",
                  border: `1.5px solid ${line}`, padding: "10px 12px",
                  fontFamily: font.ui, fontSize: "0.82rem", color: ink,
                  outline: "none", background: color.white, boxSizing: "border-box",
                }}
              />
              <p style={{ fontFamily: font.ui, fontSize: "0.7rem", color: inkMuted, marginTop: "6px" }}>
                Account auto-reactivates once this period ends.
              </p>
            </div>
          )}

          <p style={{ fontFamily: font.ui, fontSize: "0.9rem", color: ink, marginBottom: "6px" }}>
            How was this resolved?
          </p>
          <textarea
            value={resolutionNotes}
            onChange={e => setResolutionNotes(e.target.value)}
            placeholder="Describe the resolution"
            style={{
              width: "100%", minHeight: "80px", borderRadius: "10px",
              border: `1.5px solid ${line}`, padding: "10px 12px",
              fontFamily: font.ui, fontSize: "0.82rem", color: ink,
              resize: "vertical", outline: "none", background: color.white,
            }}
          />
        </div>
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
          onMouseEnter={e => { if (!working) { e.currentTarget.style.background = "#8C8C8C"; e.currentTarget.style.color = "#ffffff"; } }}
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
          onMouseEnter={e => { if (!working && canConfirm) { e.currentTarget.style.background = color.success; e.currentTarget.style.color = "#ffffff"; } }}
          onMouseLeave={e => { e.currentTarget.style.background = color.white; e.currentTarget.style.color = "#111111"; }}
        >CONFIRM RESOLUTION</button>
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
  resolved:  { bg: color.success, label: "Resolved" },
  dismissed: { bg: lineSoft, label: "Dismissed" },
};
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
const CoordinatorReportCompanyScreen = ({ reports = [], onViewReport }) => (
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
          aria-label={`Total reports: ${reports.length}`}
        >
          <div style={{
            fontFamily: font.ui,
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            color: ink,
            lineHeight: 1,
          }}>
            {reports.length}
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
            {reports.map((r, i) => (
              <tr key={r.id || i}>
                <td className="rc-td">{r.company}</td>
                <td className="rc-td">{r.concern}</td>
                <td className="rc-td">{r.date}</td>
                <td className="rc-td">
                  <StatusBadge status={r.status || "pending"} />
                </td>
                <td className="rc-td">
                  <ViewButton onClick={() => onViewReport && onViewReport(r)} />
                </td>
              </tr>
            ))}

            {reports.length === 0 && (
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
        {reports.map((r, i) => (
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
              <StatusBadge status={r.status || "pending"} />
            </div>
          </div>
        ))}

        {reports.length === 0 && (
          <div style={{ paddingTop: "60px" }}>
            <EmptyState />
          </div>
        )}
      </div>

    </div>
  </>
);

export default CoordinatorReportCompanyScreen;