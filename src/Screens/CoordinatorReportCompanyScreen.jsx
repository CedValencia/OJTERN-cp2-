import React, { useState, useEffect } from "react";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import {
  logActivity,
  applyCompanyEnforcement,
  recordCompanyAction,
  notifyCompany,
  getCompanyActionHistory,
} from "./AuthService";

const red     = "#8B0000";
const darkRed = "#590101";

// ── Responsive styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Kufam:wght@400;600;700&family=Jua&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #8B0000; border-radius: 4px; }

    /* Main scroll area */
    .rc-screen {
      flex: 1;
      overflow-y: auto;
      padding: 28px 32px;
    }
    @media (max-width: 560px) {
      .rc-screen { padding: 18px 14px; }
    }

    /* Header row */
    .rc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    /* Title */
    .rc-title {
      font-family: 'Jersey 25', sans-serif;
      font-size: 3rem;
      color: ${darkRed};
      line-height: 1.1;
    }
    @media (max-width: 480px) {
      .rc-title { font-size: 2rem; }
    }

    /* Total badge */
    .rc-total-badge {
      border: 2px solid #333;
      border-radius: 12px;
      padding: 10px 20px;
      text-align: center;
      min-width: 80px;
    }
    @media (max-width: 480px) {
      .rc-total-badge { padding: 8px 14px; min-width: 60px; }
    }

    /* ── TABLE — desktop only ── */
    .rc-table-wrap { width: 100%; }
    .rc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.83rem;
    }
    .rc-th {
      padding: 10px 14px;
      text-align: left;
      color: white;
      font-family: 'Kufam', sans-serif;
      font-weight: 600;
      white-space: nowrap;
    }
    .rc-td {
      padding: 12px 14px;
      font-family: 'Kufam', sans-serif;
      font-weight: 600;
      border-bottom: 1px solid #eee;
    }

    /* ── CARD LIST — mobile only ── */
    .rc-card-list { display: none; flex-direction: column; gap: 10px; }

    .rc-card {
      background: #dadada;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rc-card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .rc-card-bottom {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 8px;
    }

    .rc-card-label {
      font-family: 'Kufam', sans-serif;
      font-size: 0.68rem;
      color: #999;
      margin-bottom: 2px;
    }

    .rc-card-value {
      font-family: 'Kufam', sans-serif;
      font-size: 0.84rem;
      font-weight: 600;
      color: #222;
    }

    /* Switch between table and cards at 560px */
    @media (max-width: 560px) {
      .rc-table-wrap { display: none; }
      .rc-card-list  { display: flex; }
    }

    /* Report detail modal */
    .rc-modal-inner {
      background: white;
      border-radius: 16px;
      width: 520px;
      max-width: calc(100vw - 32px);
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .rc-modal-header {
      background: ${darkRed};
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .rc-modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    @media (max-width: 480px) {
      .rc-modal-body { padding: 14px; }
    }
  `}</style>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const isAllowedType = (file) =>
  file && (file.type === "image/png" || file.type === "application/pdf");

const handleDownload = async (file) => {
  try {
    const res = await fetch(file.url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = file.name || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Download failed, falling back to opening in a new tab:", err);
    window.open(file.url, "_blank", "noopener,noreferrer");
  }
};

// ── Image Lightbox ────────────────────────────────────────────────────────────
const ImageLightbox = ({ src, name, onClose }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9000, flexDirection: "column",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(0,0,0,0.5)",
        }}
      >
        <span style={{
          fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem",
          color: "rgba(255,255,255,0.8)",
          maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => handleDownload({ url: src, name })}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px",
              padding: "7px 14px", color: "white",
              fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
              width: "34px", height: "34px", color: "white", fontSize: "1.1rem",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>
      </div>

      <img
        src={src} alt={name}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "90vw", maxHeight: "80vh",
          borderRadius: "10px", objectFit: "contain",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
};

// ── Shared styles & icons ─────────────────────────────────────────────────────
const downloadBtnStyle = {
  display: "flex", alignItems: "center", gap: "6px",
  padding: "7px 18px", borderRadius: "16px",
  border: `1.5px solid ${red}`, background: "white", color: red,
  fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem",
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
  approved:  { bg: "#2a7a2a", label: "Active" },
  active:    { bg: "#2a7a2a", label: "Active" },
  pending:   { bg: "#e0a800", label: "Pending" },
  rejected:  { bg: "#666",    label: "Rejected" },
  suspended: { bg: "#e0a800", label: "Suspended" },
  blocked:   { bg: red,       label: "Blocked" },
};
const CompanyStatusBadge = ({ status }) => {
  const b = COMPANY_STATUS_BADGE[status] || { bg: "#999", label: status };
  return (
    <span style={{
      fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", fontWeight: 700,
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
        background: "white", borderRadius: "18px", width: "100%", maxWidth: "460px",
        maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
      }}>
        <div style={{ background: darkRed, padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: "white" }}>Action History</span>
          <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", fontSize: "0.9rem", color: darkRed }}>✕</button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {loading && <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#aaa", textAlign: "center", padding: "20px" }}>Loading…</p>}
          {!loading && history.length === 0 && (
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#aaa", textAlign: "center", padding: "20px" }}>No actions recorded for this company yet.</p>
          )}
          {!loading && history.map((h) => (
            <div key={h.id} style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "0.85rem", color: "#1a1a1a" }}>{h.actionType}</span>
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#999" }}>
                  {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleString() : ""}
                </span>
              </div>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#555", marginBottom: "4px" }}>{h.reason}</p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#999" }}>
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
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "16px",
      }}>
        <div className="rc-modal-inner">
          <div className="rc-modal-header">
            <span style={{
              fontFamily: "'Jersey 25', sans-serif",
              fontSize: "clamp(1.1rem, 4vw, 1.4rem)",
              color: "white",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              {report.company}
              <span style={{
                fontFamily: "'Kufam', sans-serif", fontSize: "0.68rem", fontWeight: 700,
                background: badge.bg, color: "white", borderRadius: "12px",
                padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0,
              }}>{badge.label}</span>
            </span>
            <button
              onClick={onClose}
              style={{
                background: "white", border: "none", borderRadius: "50%",
                width: "28px", height: "28px", cursor: "pointer",
                fontWeight: "bold", fontSize: "1rem", color: "#333",
                flexShrink: 0, marginLeft: "10px",
              }}
            >✕</button>
          </div>

          <div className="rc-modal-body">
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Reported Company:</b> {report.company}
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Concern:</b> {report.concern}
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Date:</b> {report.date}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", margin: 0 }}>
                <b>Company Account Status:</b>{" "}
                {companyStatus
                  ? <CompanyStatusBadge status={companyStatus} />
                  : <span style={{ color: "#aaa", fontSize: "0.8rem" }}>Loading…</span>}
              </p>
              <button
                onClick={openHistory}
                style={{
                  padding: "4px 14px", borderRadius: "14px",
                  border: `1.5px solid ${red}`, background: "white", color: red,
                  fontFamily: "'Kufam', sans-serif", fontSize: "0.74rem", fontWeight: 600,
                  cursor: "pointer",
                }}
              >View Action History</button>
            </div>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", fontWeight: 700, marginBottom: "6px" }}>
              DESCRIPTION:
            </p>
            <div style={{ background: "#f5f5f5", borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444", lineHeight: 1.6 }}>
                {report.description}
              </p>
            </div>

            {file && (
              <>
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", fontWeight: 700, marginBottom: "10px" }}>
                  Attached File:
                </p>
                {!allowed && (
                  <div style={{
                    background: "#fff3f3", border: `1px solid ${red}`,
                    borderRadius: "8px", padding: "12px 14px",
                    fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: red,
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
                        style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid #ddd", display: "block" }}
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
                      background: "#f5f5f5", padding: "10px 14px",
                      borderRadius: "8px", marginBottom: "10px",
                    }}>
                      <PdfIcon />
                      <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#555", flex: 1 }}>
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
              <div style={{ background: "#f2f8f2", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem" }}>{RESOLUTION_ACTION_META[savedAction]?.icon || "📝"}</span>
                <div>
                  <p style={{ fontFamily: "'Jua', sans-serif", fontSize: "0.85rem", color: "#2a7a2a" }}>{savedAction}</p>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555", marginTop: "2px" }}>{savedNotes}</p>
                </div>
              </div>
            )}
            {enforcementNote && (
              <div style={{ background: "#fdf1f1", border: `1.5px solid ${red}`, borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem" }}>⛔</span>
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: darkRed }}>{enforcementNote}</p>
              </div>
            )}
          </div>

          <div style={{
            display: "flex", justifyContent: "flex-end", gap: "10px",
            padding: "14px 20px", borderTop: "1px solid #eee",
          }}>
            {status === "pending" ? (
              <>
                <button
                  onClick={() => setConfirmingDismiss(true)}
                  disabled={working}
                  style={{
                    padding: "9px 22px", borderRadius: "22px", background: "#666",
                    color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif",
                    fontSize: "1rem", cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
                  }}
                >DISMISS</button>
                <button
                  onClick={() => setResolvingPanel(true)}
                  disabled={working}
                  style={{
                    padding: "9px 22px", borderRadius: "22px", background: "#2a7a2a",
                    color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif",
                    fontSize: "1rem", cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
                  }}
                >RESOLVE</button>
              </>
            ) : (
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#888", margin: 0 }}>
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
      background: "white", borderRadius: "18px", width: "100%", maxWidth: "380px",
      overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
    }}>
      <div style={{ padding: "26px 24px 8px" }}>
        <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: darkRed, marginBottom: "8px" }}>
          {title}
        </p>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", lineHeight: 1.5 }}>
          {message}
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "18px 22px" }}>
        <button
          onClick={onCancel}
          disabled={working}
          style={{
            padding: "9px 22px", borderRadius: "22px", background: "white",
            color: "#666", border: "1.5px solid #ccc", fontFamily: "'Jersey 25', sans-serif",
            fontSize: "1rem", cursor: working ? "not-allowed" : "pointer",
          }}
        >CANCEL</button>
        <button
          onClick={onConfirm}
          disabled={working}
          style={{
            padding: "9px 22px", borderRadius: "22px", background: "#666",
            color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif",
            fontSize: "1rem", cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1,
          }}
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
    <div style={{
      background: "white", borderRadius: "18px", width: "100%", maxWidth: "480px",
      maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden",
      boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
    }}>
      <div style={{ background: red, padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.4rem", color: "white", letterSpacing: "0.03em" }}>Resolve Report</span>
        <button
          onClick={onCancel}
          disabled={working}
          style={{ background: "white", border: "none", borderRadius: "50%", width: "26px", height: "26px", cursor: working ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", color: darkRed, flexShrink: 0 }}
        >✕</button>
      </div>

      <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
        <div style={{ background: "#fdf1f1", border: `1.5px solid ${red}`, borderRadius: "12px", padding: "16px" }}>
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1.1rem", color: darkRed, marginBottom: "10px" }}>
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
                    border: `2px solid ${isSelected ? red : "#e5e5e5"}`,
                    background: isSelected ? "white" : "#fbfbfb",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{meta.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Jua', sans-serif", fontSize: "0.85rem", color: "#1a1a1a" }}>{action}</p>
                    <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#888" }}>{meta.desc}</p>
                  </div>
                  <div style={{
                    width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${isSelected ? red : "#bbb"}`,
                    background: isSelected ? red : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isSelected && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "white" }} />}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedAction === "Others" && (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontFamily: "'Jua', sans-serif", fontSize: "0.9rem", color: "#1a1a1a", marginBottom: "6px" }}>
                Specify the action taken
              </p>
              <input
                type="text"
                value={otherActionText}
                onChange={e => setOtherActionText(e.target.value)}
                placeholder=""
                style={{
                  width: "100%", borderRadius: "10px",
                  border: "1.5px solid #ddd", padding: "10px 12px",
                  fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#1a1a1a",
                  outline: "none", background: "white", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {selectedAction === "Suspend Account" && (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontFamily: "'Jua', sans-serif", fontSize: "0.9rem", color: "#1a1a1a", marginBottom: "6px" }}>
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
                  border: "1.5px solid #ddd", padding: "10px 12px",
                  fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#1a1a1a",
                  outline: "none", background: "white", boxSizing: "border-box",
                }}
              />
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#888", marginTop: "6px" }}>
                Account auto-reactivates once this period ends.
              </p>
            </div>
          )}

          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#1a1a1a", marginBottom: "6px" }}>
            How was this resolved?
          </p>
          <textarea
            value={resolutionNotes}
            onChange={e => setResolutionNotes(e.target.value)}
            placeholder="Describe the resolution"
            style={{
              width: "100%", minHeight: "80px", borderRadius: "10px",
              border: "1.5px solid #ddd", padding: "10px 12px",
              fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#1a1a1a",
              resize: "vertical", outline: "none", background: "white",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 20px", borderTop: "1px solid #eee" }}>
        <button
          onClick={onCancel}
          disabled={working}
          style={{
            padding: "9px 22px", borderRadius: "22px", background: "white",
            color: "#666", border: "1.5px solid #ccc", fontFamily: "'Jersey 25', sans-serif",
            fontSize: "1rem", cursor: working ? "not-allowed" : "pointer",
          }}
        >CANCEL</button>
        <button
          onClick={onConfirm}
          disabled={working || !canConfirm}
          style={{
            padding: "9px 22px", borderRadius: "22px",
            background: canConfirm ? "#2a7a2a" : "#ccc",
            color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif",
            fontSize: "1rem", cursor: (working || !canConfirm) ? "not-allowed" : "pointer",
          }}
        >CONFIRM RESOLUTION</button>
      </div>
    </div>
  </div>
);

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <p style={{ color: "#bbb", fontSize: "1rem", fontFamily: "'Jua', sans-serif" }}>No reports submitted yet.</p>
    <p style={{ color: "#ccc", fontSize: "0.82rem", fontFamily: "'Kufam', sans-serif" }}>Reports submitted from a company profile will appear here.</p>
  </div>
);

// ── View button (reused in both table and cards) ──────────────────────────────
const ViewButton = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "5px 16px", borderRadius: "16px",
      border: `1.5px solid ${red}`, background: "white", color: red,
      fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem",
      cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
    }}
  >View</button>
);

// ── Status badge (reused in table and cards) ──────────────────────────────────
const REPORT_STATUS_BADGE = {
  pending:   { bg: "#e0a800", label: "Pending" },
  resolved:  { bg: "#2a7a2a", label: "Resolved" },
  dismissed: { bg: "#666",    label: "Dismissed" },
};
const StatusBadge = ({ status }) => {
  const b = REPORT_STATUS_BADGE[status] || REPORT_STATUS_BADGE.pending;
  return (
    <span style={{
      fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", fontWeight: 700,
      background: b.bg, color: "white", borderRadius: "12px",
      padding: "3px 10px", whiteSpace: "nowrap",
    }}>{b.label}</span>
  );
};

// ── Report Company Screen ─────────────────────────────────────────────────────
const CoordinatorReportCompanyScreen = ({ reports = [], onViewReport }) => (
  <>
    <ResponsiveStyles />
    <div className="rc-screen">

      {/* Header */}
      <div className="rc-header">
        <h1 className="rc-title">Report<br />List</h1>
        <div className="rc-total-badge">
          <div style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.4rem, 4vw, 2rem)", color: "#222" }}>
            {reports.length}
          </div>
          <div style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", fontWeight: 700, color: "#222" }}>
            Total
          </div>
        </div>
      </div>

      {/* ── Desktop: table ── */}
      <div className="rc-table-wrap">
        <table className="rc-table">
          <thead>
            <tr style={{ background: darkRed }}>
              {["Reported Company", "Concern", "Date", "Status", "Action"].map(h => (
                <th key={h} className="rc-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={i}>
                <td className="rc-td">{r.company}</td>
                <td className="rc-td">{r.concern}</td>
                <td className="rc-td">{r.date}</td>
                <td className="rc-td"><StatusBadge status={r.status || "pending"} /></td>
                <td className="rc-td">
                  <ViewButton onClick={() => onViewReport && onViewReport(r)} />
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "60px" }}>
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
          <div key={i} className="rc-card">
            <div className="rc-card-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="rc-card-label">Reported Company</p>
                <p className="rc-card-value" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.company}
                </p>
              </div>
              <ViewButton onClick={() => onViewReport && onViewReport(r)} />
            </div>
            <div className="rc-card-bottom">
              <div>
                <p className="rc-card-label">Concern</p>
                <p className="rc-card-value">{r.concern}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p className="rc-card-label">Date</p>
                <p className="rc-card-value">{r.date}</p>
              </div>
            </div>
            <div style={{ marginTop: "8px" }}>
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