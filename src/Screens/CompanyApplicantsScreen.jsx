import React, { useState, useRef, useEffect } from "react";
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import { buildFullName } from "./useChat";
import { color, font, type, space, radius, shadow, ease } from "./theme";

import logo from "../icons/ojtern.png";
import dashboardIcon      from "../icons/dashboard.png";
import userIcon from "../icons/user.png";
import postOJTIcon        from "../icons/post.png";
import applicantsIcon     from "../icons/applicants.png";
import messagesIcon       from "../icons/messages.png";
import accountProfileIcon from "../icons/accountprofile.png";
import aboutIcon          from "../icons/about.png";
import downloadIcon       from "../icons/download.png";
import pdfIcon            from "../icons/pdf.png";
import viewIcon           from "../icons/view.png";

// ── Design tokens, aliased for this screen ────────────────────────────────────
// Same aliases as CoordinatorStudentListScreen so the two screens stay in sync.
const ink        = color.ink;
const inkBody    = color.inkBody;
const inkMuted   = color.inkMuted;
const inkFaint   = color.inkFaint;
const surface    = color.wine600;      // rows, cards
const page       = color.wine900;      // page background
const line       = color.wine700;      // hairlines & borders
const lineSoft   = color.wine800;
const panel      = color.blush100;     // dark header bar
const panelDeep  = color.blush50;
const onPanel    = color.onWine;
const onPanelDim = color.onWineMuted;

// ── College → Program → Specialization data ────────────────────────────────
const COLLEGE_DATA = {
  "College of Computer Studies": {
    programs: {
      "Bachelor of Science in Information Technology": { specializations: [] },
    },
  },
  "College of Business and Accountancy": {
    programs: {
      "BS Business Administration — Major in Marketing Management": { specializations: [] },
      "Bachelor of Science in Accountancy": { specializations: [] },
    },
  },
  "College of Criminal Justice Education": {
    programs: {
      "Bachelor of Science in Criminology": { specializations: [] },
    },
  },
  "College of Liberal Arts": {
    programs: {
      "Bachelor of Arts in Political Science": { specializations: [] },
    },
  },
  "College of Education": {
    programs: {
      "Bachelor of Elementary Education": { specializations: [] },
      "BS Education — Major in English": { specializations: [] },
      "BS Education — Major in Mathematics": { specializations: [] },
    },
  },
  "College of Hospitality and Tourism Management": {
    programs: {
      "Bachelor of Science in Tourism Management": { specializations: [] },
      "Bachelor of Science in Hospitality Management": { specializations: [] },
    },
  },
};

// ── Status options & colors (kept in sync with CoordinatorStudentListScreen) ──
const STATUS_OPTIONS = ["Accepted", "Declined", "Pending", "In Review", "To Interview"];

const STATUS_COLORS = {
  "Accepted":     { bg: "#358D5E", color: color.white },
  "Declined":     { bg: "#FF0000", color: color.white },
  "Pending":      { bg: "#CCC929", color: ink },
  "In Review":    { bg: "#353A8D", color: color.white },
  "To Interview": { bg: "#7C2889", color: color.white },
};

// Forward-only progression order. "Declined" isn't part of the sequence since
// an applicant can be declined from any non-final stage.
const STATUS_RANK = { "Pending": 0, "In Review": 1, "To Interview": 2, "Accepted": 3 };

// An applicant can only move forward through the sequence (or be declined at
// any point) — never back to an earlier status. Accepted/Declined are final
// and are handled separately via the `locked` prop.
const getDisabledStatusOptions = (currentStatus) => {
  if (!(currentStatus in STATUS_RANK)) return [];
  return STATUS_OPTIONS.filter(
    opt => opt in STATUS_RANK && STATUS_RANK[opt] < STATUS_RANK[currentStatus]
  );
};

const DROPDOWN_ITEM_HEIGHT = 36;
const DROPDOWN_PADDING = 16;
const DROPDOWN_HEIGHT = STATUS_OPTIONS.length * DROPDOWN_ITEM_HEIGHT + DROPDOWN_PADDING;

// TODO: Populate from backend
const SEX_OPTIONS = [];

// ── Shared chip style: one look for every selectable pill in this screen ──────
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

// ── Responsive styles ─────────────────────────────────────────────────────────
// Page shape mirrors CoordinatorStudentListScreen (padded scroll area →
// floating dark bar → chips → full-width rows).
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Monomaniac+One&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: ${color.wine400}; border-radius: 999px; }
    ::-webkit-scrollbar-track { background: transparent; }
    .app-msg-scroll::-webkit-scrollbar { width: 4px; }
    .app-msg-scroll::-webkit-scrollbar-thumb { background: ${color.wine400}; border-radius: 4px; }
    .app-msg-scroll::-webkit-scrollbar-track { background: transparent; }

    /* List wrapper: vertical scroll only */
    .ca-list-wrapper {
      flex: 1;
      overflow-x: hidden;
      overflow-y: auto;
      width: 100%;
      background: ${page};
      padding: clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px);
    }

    /* Floating dark header bar */
    .ca-search-bar {
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
      .ca-search-bar { padding: 14px; gap: 10px; }
    }

    .ca-search-input { width: 170px; }
    .ca-search-input::placeholder { color: ${inkFaint}; }
    @media (max-width: 480px) {
      .ca-search-input { width: 90px; }
    }
    @media (max-width: 380px) {
      .ca-search-input { width: 62px; }
    }

    /* Full-width applicant rows */
    .ca-rows {
      display: flex;
      flex-direction: column;
      gap: ${space.sm};
    }
    .ca-row {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.pill};
      box-shadow: ${shadow.input};
      padding: 8px 16px 8px 8px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      transition: border-color 200ms ${ease}, box-shadow 200ms ${ease};
    }
    .ca-row:hover {
      border-color: ${color.wine400};
      box-shadow: 0 8px 22px rgba(10,10,10,0.08);
    }
    .ca-row-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
      overflow: hidden;
    }
    /* Hide program on very small screens */
    .ca-row-program { display: inline; }
    @media (max-width: 400px) {
      .ca-row-program { display: none; }
    }
    @media (max-width: 560px) {
      .ca-row { padding: 8px 12px 8px 8px; gap: 10px; }
    }

    .ca-list-wrapper :focus-visible,
    .ca-modal-inner :focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: ${radius.pill};
    }

    /* ── Personal Details Modal — sized to match CoordinatorReportCompanyScreen's report modal ── */
    .ca-modal-inner {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: 18px;
      width: min(460px, calc(100vw - 48px));
      max-width: 100%;
      max-height: 62vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 50px rgba(0,0,0,0.25);
    }
    @media (max-width: 560px) {
      .ca-modal-inner {
        width: calc(100vw - 72px);
        max-height: 46vh;
        border-radius: 14px;
      }
    }

    .ca-modal-header {
      background: ${surface};
      border-bottom: 1px solid ${line};
      min-height: 60px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
    }
    @media (max-width: 560px) {
      .ca-modal-header { min-height: 48px; padding: 10px 14px; }
      .ca-modal-header h2 { font-size: 1.1rem !important; }
    }

    .ca-modal-body {
      overflow-y: auto;
      overflow-x: hidden;   /* ← idagdag */
      padding: 20px;
      flex: 1;
    }
    @media (max-width: 560px) {
      .ca-modal-body { padding: 14px; }
    }

    /* Name fields: wrap on small screens */
    .ca-name-row {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 14px;
      align-items: flex-end;
    }

    /* Contact row: wrap on small screens */
    .ca-contact-row {
      display: flex;
      gap: 36px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }

    /* File + status row: stack on small screens */
    .ca-file-status-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    }

    /* Status block: align right on desktop, left on mobile */
    .ca-status-block {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }
    @media (max-width: 480px) {
      .ca-status-block { align-items: flex-start; }
    }

    /* ── Status description popup ── */
    .ca-popup-inner {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.panel};
      width: 100%;
      max-width: 600px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: ${shadow.panel};
    }

    .ca-popup-body {
      padding: 16px 28px 0;
    }
    @media (max-width: 480px) {
      .ca-popup-body { padding: 12px 16px 0; }
    }

    .ca-popup-footer {
      background: ${panel};
      padding: 14px 24px;
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    @media (max-width: 480px) {
      .ca-popup-footer { padding: 12px 16px; }
    }

    /* ── Standalone layout (non-embedded) ── */

    /* App header */
    .ca-app-header {
      height: 70px;
      flex-shrink: 0;
      background: ${panel};
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      border-bottom: 1px solid ${color.blush300};
    }
    @media (max-width: 560px) {
      .ca-app-header { padding: 0 14px; height: 58px; }
    }

    /* Sidebar: hidden on mobile */
    .ca-sidebar {
      width: 260px;
      flex-shrink: 0;
      background: ${panel};
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      border-right: 1px solid ${color.blush300};
    }
    @media (max-width: 700px) {
      .ca-sidebar { display: none; }
    }

    .ca-nav-label { display: inline; }

    @media (prefers-reduced-motion: reduce) {
      .ca-row { transition: none; }
    }
  `}</style>
);

const Chip = ({ label }) => (
  <span style={{
    display: "inline-block", padding: "5px 14px", borderRadius: radius.pill,
    background: color.wine800, border: `1px solid ${line}`,
    fontFamily: font.ui, ...type.helper, color: inkBody, whiteSpace: "nowrap",
  }}>
    {label}
  </span>
);

const FieldLabel = ({ children, style }) => (
  <p style={{
    fontFamily: font.ui, ...type.label, color: ink, marginBottom: "6px", ...style,
  }}>
    {children}
  </p>
);

const StudentAvatar = ({ size = 42 }) => (
  <img
    src={userIcon}
    alt=""
    style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
  />
);

// ── StatusDropdown ─────────────────────────────────────────────────────────────
const StatusDropdown = ({ status, onChange, open, setOpen, locked = false, disabledOptions = [] }) => {
  const ref = useRef(null);
  const current = STATUS_COLORS[status] || { bg: color.wine400, color: ink };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setOpen]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span style={{
        background: current.bg, color: current.color, borderRadius: radius.pill,
        padding: "4px 13px", fontFamily: font.ui, fontSize: "0.78rem",
        fontWeight: 500, userSelect: "none", whiteSpace: "nowrap",
      }}>
        {status}
      </span>
      {!locked && (
        <div
          onClick={() => setOpen(v => !v)}
          style={{
            background: color.wine800, border: `1px solid ${line}`, borderRadius: "8px", width: "26px", height: "26px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="10" height="7" viewBox="0 0 10 7" fill={inkMuted} stroke="none">
            <polygon points="0,0 10,0 5,7"/>
          </svg>
        </div>
      )}
      {open && !locked && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: surface, border: `1px solid ${line}`, borderRadius: radius.card, padding: "8px",
          zIndex: 9999, display: "flex", flexDirection: "column", gap: "4px",
          minWidth: "130px", boxShadow: shadow.panel,
        }}>
          {STATUS_OPTIONS.map(opt => {
            const sc = STATUS_COLORS[opt];
            const isActive = opt === status;
            const isDisabled = !isActive && disabledOptions.includes(opt);
            return (
              <div
                key={opt}
                onClick={() => { if (isDisabled) return; onChange(opt); setOpen(false); }}
                style={{
                  background: isActive ? sc.bg : "transparent",
                  color: isActive ? sc.color : inkBody,
                  borderRadius: radius.pill, padding: "5px 12px",
                  fontFamily: font.ui, fontSize: "0.78rem",
                  fontWeight: 500, cursor: isDisabled ? "not-allowed" : "pointer", textAlign: "center",
                  whiteSpace: "nowrap", transition: `background 140ms ${ease}, color 140ms ${ease}`, userSelect: "none",
                  opacity: isDisabled ? 0.5 : 1,
                  textDecoration: isDisabled ? "line-through" : "none",
                }}
                onMouseEnter={e => { if (isDisabled) return; e.currentTarget.style.background = sc.bg; e.currentTarget.style.color = sc.color; }}
                onMouseLeave={e => {
                  if (isDisabled) return;
                  e.currentTarget.style.background = isActive ? sc.bg : "transparent";
                  e.currentTarget.style.color = isActive ? sc.color : inkBody;
                }}
              >
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AttachedFileChip = ({ file }) => {
  const isPng = /\.png$/i.test(file.name || "");
  const [downloading, setDownloading] = useState(false);

  // NOTE: We deliberately avoid Cloudinary's `fl_attachment:<filename>` URL
  // transformation here. It's fragile — filenames with spaces or certain
  // special characters (even after encodeURIComponent) can make Cloudinary
  // return an HTTP 400 on the transformed URL. Fetching the raw file and
  // triggering a client-side Blob download works regardless of filename
  // content and doesn't depend on Cloudinary's transformation parsing.
  const handleDownload = async () => {
    if (!file.url || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.name || "file";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
      console.error("Download failed, opening file in a new tab instead:", err);
      window.open(file.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      onClick={handleDownload}
      title={downloading ? "Downloading…" : `Download ${file.name}`}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: downloading ? "wait" : "pointer", opacity: downloading ? 0.6 : 1, userSelect: "none" }}
    >
      <div style={{ position: "relative", width: "68px", height: "78px" }}>
        <img src={pdfIcon} alt={isPng ? "PNG" : "PDF"} style={{ position: "absolute", top: 0, left: 0, width: "68px", height: "78px", objectFit: "contain", zIndex: 1 }} />
        <img src={downloadIcon} alt="Download" style={{ position: "absolute", top: "-6px", right: "-6px", width: "24px", height: "24px", objectFit: "contain", zIndex: 2 }} />
      </div>
      <span style={{ fontFamily: font.ui, fontSize: "0.7rem", color: inkMuted, textAlign: "center", wordBreak: "break-all", maxWidth: "80px", lineHeight: 1.3, marginTop: "4px" }}>
        {downloading ? "Downloading…" : file.name}
      </span>
    </div>
  );
};

// ── Status-saved confirmation modal ─────────────────────────────────────────────
const StatusSavedModal = ({ onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: "16px" }}>
    <div style={{ background: color.white, border: `1px solid ${line}`, borderRadius: radius.panel, maxWidth: "320px", width: "90%", padding: "30px 22px 24px", boxShadow: shadow.panel, textAlign: "center" }}>
      <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(90,117,96,0.14)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: "1.6rem", color: color.success }}>
        ✓
      </div>
      <p style={{ fontFamily: font.ui, fontSize: "1.1rem", fontWeight: 600, color: ink, margin: "0 0 6px" }}>Status saved successfully!</p>
      <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, margin: "0 0 20px" }}>
        The applicant has been notified of this update.
      </p>
      <button onClick={onClose} style={{ padding: "9px 30px", borderRadius: radius.pill, background: panel, color: onPanel, border: "none", fontFamily: font.ui, ...type.control, cursor: "pointer" }}>
        OK
      </button>
    </div>
  </div>
);

// ── Status Description Popup ──────────────────────────────────────────────────
const StatusDescriptionPopup = ({ status, onClose, onSend }) => {
  const [description, setDescription] = useState("");
  const sc = STATUS_COLORS[status] || { bg: color.success, color: color.white };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px" }}>
      <div className="ca-popup-inner">
        <div style={{ padding: "20px 28px 0 28px" }}>
          <span style={{ display: "inline-block", background: sc.bg, color: sc.color, borderRadius: radius.pill, padding: "5px 18px", fontFamily: font.ui, fontSize: "0.85rem", fontWeight: 500 }}>
            {status}
          </span>
        </div>
        <div style={{ margin: "16px 28px 0", borderTop: `1px solid ${line}` }} />
        <div className="ca-popup-body">
          <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: "10px" }}>Write a message:</p>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Write your message to the applicant..."
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(description);
                onClose();
              }
            }}
            style={{ width: "100%", minHeight: "90px", border: "none", outline: "none", background: "transparent", fontFamily: font.ui, ...type.body, color: inkBody, resize: "none", lineHeight: 1.6 }} />
        </div>
        <div className="ca-popup-footer">
          <button onClick={() => { onSend(description); onClose(); }}
            style={{ background: color.goldTint, border: "none", borderRadius: radius.pill, padding: "9px 26px", color: onPanel, fontFamily: font.ui, ...type.control, cursor: "pointer" }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Personal Details Modal ─────────────────────────────────────────────────────
const PersonalDetailsModal = ({ applicant, onClose, onStatusChange, onMessage }) => {
  const locationChips = [applicant.region, applicant.province, applicant.city, applicant.barangay].filter(Boolean);
  const collegeChips  = [applicant.college, applicant.program, applicant.major].filter(Boolean);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showStatusSaved, setShowStatusSaved] = useState(false);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.50)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
        <div className="ca-modal-inner">

          {/* Header */}
          <div className="ca-modal-header">
            <h2 title="Student Information" style={{ fontFamily: font.ui, fontSize: "clamp(1.05rem, 4vw, 1.3rem)", fontWeight: 600, letterSpacing: "-0.01em", margin: 0, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>Student Information</h2>
            <button onClick={onClose} aria-label="Close" style={{ background: color.wine800, border: `1px solid ${line}`, borderRadius: "50%", width: "28px", height: "28px", color: ink, fontSize: "1rem", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
          </div>

          {/* Body */}
          <div className="ca-modal-body">
            {/* Name row */}
            <div className="ca-name-row">
              <div><FieldLabel>First Name</FieldLabel><Chip label={applicant.firstName} /></div>
              <div><FieldLabel>Middle Initial</FieldLabel><Chip label={applicant.middleInitial || "—"} /></div>
              <div><FieldLabel>Last Name</FieldLabel><Chip label={applicant.lastName} /></div>
              {applicant.suffix && <div><FieldLabel>Suffix</FieldLabel><Chip label={applicant.suffix} /></div>}
            </div>

            <div style={{ marginBottom: "14px" }}><FieldLabel>Sex</FieldLabel><Chip label={applicant.sex} /></div>

            <div style={{ marginBottom: "14px" }}>
              <FieldLabel>Location</FieldLabel>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {locationChips.map((c, i) => <Chip key={i} label={c} />)}
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <FieldLabel>College / Program / Major</FieldLabel>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {collegeChips.map((c, i) => <Chip key={i} label={c} />)}
              </div>
            </div>

            <hr style={{ border: "none", borderTop: `1px solid ${line}`, margin: "16px 0" }} />

            {/* Contact row */}
            <div className="ca-contact-row">
              <div><FieldLabel>Contact Information</FieldLabel><Chip label={applicant.contact} /></div>
              <div><FieldLabel>Email address</FieldLabel><Chip label={applicant.email} /></div>
            </div>

            {/* Application message */}
            <div style={{ marginBottom: "16px" }}>
              <FieldLabel>Application message</FieldLabel>
              <div className="app-msg-scroll" style={{ background: color.wine800, border: `1px solid ${line}`, borderRadius: radius.card, padding: "13px 18px", maxHeight: "110px", overflowY: "auto", position: "relative" }}>
                <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, margin: 0, wordBreak: "break-word" }}>
                  {applicant.message}
                </p>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: `1px solid ${line}`, margin: "16px 0" }} />

            {/* File + Status */}
            <div className="ca-file-status-row">
              <div>
                <FieldLabel>Attached File</FieldLabel>
                {applicant.attachedFiles && applicant.attachedFiles.length > 0
                  ? <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {applicant.attachedFiles.map((file, idx) => <AttachedFileChip key={idx} file={file} />)}
                    </div>
                  : <span style={{ fontFamily: font.ui, ...type.helper, color: inkFaint, fontStyle: "italic" }}>No file attached</span>
                }
              </div>

              <div className="ca-status-block">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FieldLabel style={{ margin: 0 }}>Status:</FieldLabel>
                  <StatusDropdown
                    status={applicant.status}
                    onChange={setPendingStatus}
                    open={dropdownOpen}
                    setOpen={setDropdownOpen}
                    locked={applicant.status === "Accepted" || applicant.status === "Declined"}
                    disabledOptions={getDisabledStatusOptions(applicant.status)}
                  />
                </div>
                {(applicant.status === "Accepted" || applicant.status === "Declined") && (
                  <span style={{ fontFamily: font.ui, ...type.helper, color: inkFaint, fontStyle: "italic" }}>
                    This applicant has been {applicant.status.toLowerCase()}. Status is locked and can no longer be changed.
                  </span>
                )}

                {dropdownOpen && (
                  <div style={{ height: DROPDOWN_HEIGHT, flexShrink: 0 }} aria-hidden="true" />
                )}

                <button
                  onClick={() => onMessage(applicant)}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    background: panel, border: "none", borderRadius: radius.pill,
                    padding: "9px 18px", cursor: "pointer", color: onPanel,
                    fontFamily: font.ui, ...type.control,
                    transition: `background 220ms ${ease}`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = panelDeep)}
                  onMouseLeave={e => (e.currentTarget.style.background = panel)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingStatus && (
        <StatusDescriptionPopup
          status={pendingStatus}
          onClose={() => setPendingStatus(null)}
          onSend={(description) => {
            onStatusChange(applicant.id, pendingStatus, description);
            setPendingStatus(null);
            setShowStatusSaved(true);
          }}
        />
      )}

      {showStatusSaved && (
        <StatusSavedModal onClose={() => setShowStatusSaved(false)} />
      )}
    </>
  );
};

// ── Filter Panel ──────────────────────────────────────────────────────────────
const FilterPanel = ({
  filters, setFilters,
  filterRef,
}) => {
  const sexOptions = ["Male", "Female"];

  const colleges = Object.keys(COLLEGE_DATA);

  const programs = filters.college
    ? Object.keys(COLLEGE_DATA[filters.college]?.programs || {})
    : [];

  const specializations = (filters.college && filters.program)
    ? (COLLEGE_DATA[filters.college]?.programs?.[filters.program]?.specializations || [])
    : [];

  const clearAll = () => {
    setFilters({ sex: "", college: "", program: "", specialization: "", status: "" });
  };

  const toggleSex    = (val) => setFilters(prev => ({ ...prev, sex: prev.sex === val ? "" : val }));
  const toggleStatus = (val) => setFilters(prev => ({ ...prev, status: prev.status === val ? "" : val }));

  const groupLabel = { fontFamily: font.ui, ...type.label, color: ink };
  const emptyNote  = { fontFamily: font.ui, ...type.helper, color: inkFaint, fontStyle: "italic" };

  return (
    <div
      ref={filterRef}
      style={{
        position: "absolute", top: "48px", right: 0, width: "266px",
        background: surface, border: `1px solid ${line}`, borderRadius: radius.card,
        boxShadow: shadow.panel, zIndex: 100, overflow: "hidden",
        fontFamily: font.ui,
      }}
    >
      {/* Sex */}
      <div style={{ padding: "12px 14px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm }}>
          <p style={groupLabel}>Sex</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        {sexOptions.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {sexOptions.map(s => (
              <span key={s} onClick={() => toggleSex(s)} style={chip(filters.sex === s)}>{s}</span>
            ))}
          </div>
        ) : (
          <p style={emptyNote}>No options available.</p>
        )}
      </div>

      <hr style={{ border: "none", borderTop: `1px solid ${lineSoft}`, margin: "10px 0" }} />

      {/* College / Program / Specialization */}
      <div style={{ padding: "0 14px 10px" }}>
        <p style={{ ...groupLabel, marginBottom: space.sm }}>College</p>
        {colleges.length > 0 ? (
          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
            {colleges.map(col => (
              <div key={col}
                onClick={() => setFilters(prev => ({ ...prev, college: prev.college === col ? "" : col, program: "", specialization: "" }))}
                style={{ padding: "7px 11px", borderRadius: "10px", fontFamily: font.ui, ...type.helper, color: inkBody, cursor: "pointer", background: filters.college === col ? color.wine700 : color.wine800, border: `1px solid ${line}`, transition: `background 160ms ${ease}` }}
                onMouseEnter={e => e.currentTarget.style.background = color.wine700}
                onMouseLeave={e => e.currentTarget.style.background = filters.college === col ? color.wine700 : color.wine800}
              >{col}</div>
            ))}
          </div>
        ) : (
          <p style={emptyNote}>No options available.</p>
        )}

        {filters.college && (
          <>
            <p style={{ ...groupLabel, margin: "10px 0 6px" }}>Program</p>
            {programs.length > 0 ? (
              <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {programs.map(prog => (
                  <span key={prog} onClick={() => setFilters(prev => ({ ...prev, program: prev.program === prog ? "" : prog, specialization: "" }))} style={chip(filters.program === prog)}>
                    {prog}
                  </span>
                ))}
              </div>
            ) : (
              <p style={emptyNote}>No options available.</p>
            )}
          </>
        )}

        {filters.program && (
          <>
            <p style={{ ...groupLabel, margin: "10px 0 6px" }}>Specialization</p>
            {specializations.length > 0 ? (
              <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {specializations.map(spec => (
                  <span key={spec} onClick={() => setFilters(prev => ({ ...prev, specialization: prev.specialization === spec ? "" : spec }))} style={chip(filters.specialization === spec)}>
                    {spec}
                  </span>
                ))}
              </div>
            ) : (
              <p style={emptyNote}>No specializations available.</p>
            )}
          </>
        )}
      </div>

      <hr style={{ border: "none", borderTop: `1px solid ${lineSoft}`, margin: 0 }} />

      {/* Status */}
      <div style={{ padding: "10px 14px 12px" }}>
        <p style={{ ...groupLabel, marginBottom: space.sm }}>Status</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {STATUS_OPTIONS.map(s => (
            <span key={s} onClick={() => toggleStatus(s)} style={chip(filters.status === s)}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
const CompanyApplicantsScreen = ({ embedded = false, onNavigateToMessages, user, openApplicantId, onApplicantOpened, initialStatusFilter, onStatusFilterApplied }) => {
  const [applicants, setApplicants] = useState([]);

  // Fetch applications for this company from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "applications"),
      where("companyId", "==", user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setApplicants(docs);
    }, err => console.error("Applicants fetch error:", err));
    return () => unsub();
  }, [user?.uid]);
  const [search, setSearch]                     = useState("");
  const [viewingApplicant, setViewingApplicant] = useState(null);
  const [showFilter, setShowFilter]             = useState(false);
  const [filters, setFilters]                   = useState({ sex: "", college: "", program: "", specialization: "", status: "" });
  const [activeNav, setActiveNav]               = useState("Applicants");

  // Auto-open personal details when navigated here with a specific applicant
  // (e.g. clicking a "Recent Applicant" on the dashboard).
  useEffect(() => {
    if (!openApplicantId) return;
    const target = applicants.find(a => a.id === openApplicantId);
    if (target) {
      setViewingApplicant(target);
      onApplicantOpened?.();
    }
  }, [openApplicantId, applicants, onApplicantOpened]);

  const filterRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Set initial status filter when navigated from dashboard
  useEffect(() => {
    if (initialStatusFilter) {
      setFilters(p => ({ ...p, status: initialStatusFilter }));
      onStatusFilterApplied?.();
    }
  }, [initialStatusFilter, onStatusFilterApplied]);

  const navItems = [
    { key: "dashboard",      label: "Dashboard",       icon: dashboardIcon },
    { key: "postojt",        label: "Post OJT",        icon: postOJTIcon },
    { key: "applicants",     label: "Applicants",      icon: applicantsIcon },
    { key: "messages",       label: "Messages",        icon: messagesIcon },
    { key: "accountprofile", label: "Account Profile", icon: accountProfileIcon },
    { key: "about",          label: "About",           icon: aboutIcon },
  ];

  const hasFilter = filters.sex || filters.college || filters.program || filters.specialization || filters.status;

  const filtered = applicants.filter(a => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    const q = search.toLowerCase();
    const matchSearch   = fullName.includes(q) || (a.college || "").toLowerCase().includes(q) || (a.program || "").toLowerCase().includes(q);
    const matchSex      = !filters.sex || a.sex === filters.sex;
    const matchCollege  = !filters.college || a.college === filters.college;
    const matchProgram  = !filters.program || a.program === filters.program;
    const matchSpec     = !filters.specialization || a.major === filters.specialization;
    const matchStatus   = !filters.status || a.status === filters.status;
    return matchSearch && matchSex && matchCollege && matchProgram && matchSpec && matchStatus;
  });

  // Human-readable phrasing per status, used in the notification sent to the student.
  const STATUS_NOTIF_TEXT = {
    "In Review":     "is now in review",
    "To Interview":  "has moved to the interview stage",
    "Accepted":      "has been accepted",
    "Declined":      "has been declined",
  };

  const handleStatusChange = async (id, newStatus, description = "") => {
    const current = applicants.find(a => a.id === id);
    // No actual change — nothing to persist, and importantly nothing that
    // should trigger another status-update email (the backend Cloud
    // Function guards this too via oldData.status !== newData.status, but
    // catching it here avoids an unnecessary Firestore write in the first
    // place).
    if (current?.status === newStatus) {
      return;
    }
    // Accepted/Declined are final — no further changes.
    if (current?.status === "Accepted" || current?.status === "Declined") {
      console.warn(`Blocked status change: applicant already ${current.status}.`);
      return;
    }
    // Block backward moves (e.g. In Review -> Pending). Declined is always
    // allowed since an applicant can be declined at any stage.
    if (newStatus !== "Declined" && getDisabledStatusOptions(current?.status).includes(newStatus)) {
      console.warn(`Blocked status change: cannot revert from ${current?.status} back to ${newStatus}.`);
      return;
    }
    const note = (description || "").trim();
    // Optimistic local update
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: newStatus, statusNote: note } : a));
    if (viewingApplicant?.id === id) setViewingApplicant(prev => ({ ...prev, status: newStatus, statusNote: note }));
    // Persist to Firestore
    try {
      await updateDoc(doc(db, "applications", id), { status: newStatus, statusNote: note });

      // When a student is accepted, the specific post they applied to has
      // one fewer open slot. Uses a transaction (not a plain increment) so
      // the count never goes below 0 even if multiple accepts land at once.
      if (newStatus === "Accepted" && current?.postId) {
        try {
          await runTransaction(db, async (tx) => {
            const postRef = doc(db, "ojt_posts", current.postId);
            const postSnap = await tx.get(postRef);
            if (postSnap.exists()) {
              const currentSlot = postSnap.data().slot ?? 0;
              tx.update(postRef, { slot: Math.max(0, currentSlot - 1) });
            }
          });
        } catch (slotErr) {
          console.error("Failed to update post slot count:", slotErr);
        }
      }

      // Notify the student about this status change
      if (current?.studentId) {
        const statusText = STATUS_NOTIF_TEXT[newStatus] || `is now ${newStatus.toLowerCase()}`;
        const baseMessage = `Your application on ${current.companyName || "the company"} ${statusText}.`;
        await addDoc(collection(db, "notifications"), {
          studentId:     current.studentId,
          message:       note ? `${baseMessage} Message from the company: "${note}"` : baseMessage,
          companyNote:   note,
          type:          "application_status",
          applicationId: id,
          companyName:   current.companyName || "",
          status:        newStatus,
          read:          false,
          createdAt:     serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleMessage = (applicant) => {
    setViewingApplicant(null);
    if (onNavigateToMessages) {
      onNavigateToMessages({
        id: applicant.studentId,        // ✅ real student uid, not applicant.id
        name: buildFullName(applicant), // ✅ includes middle initial + suffix
      });
    }
  };

  const contentArea = (
    <div className="ca-list-wrapper">

      {/* Header bar — same floating dark panel as Students List */}
      <div className="ca-search-bar">
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: font.ui, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel }}>Applicants</span>
          <p style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, marginTop: "2px" }}>
            {filtered.length} of {applicants.length} applicant{applicants.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0, gap: "10px" }}>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, background: color.white, borderRadius: radius.pill, padding: "9px 16px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Application"
              className="ca-search-input"
              style={{ border: "none", background: "transparent", outline: "none", color: ink, fontFamily: font.ui, ...type.control }}
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search" style={{ background: "none", border: "none", color: inkMuted, cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>
            )}
          </div>

          {/* Filter button */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setShowFilter(v => !v)}
              title="Filters"
              style={{ width: "40px", height: "40px", background: hasFilter ? color.goldTint : color.white, borderRadius: radius.pill, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `1px solid ${color.onWineFaint}` : "none" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? onPanel : inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
            </div>
            {showFilter && (
              <FilterPanel
                filters={filters} setFilters={setFilters}
                filterRef={filterRef}
              />
            )}
          </div>
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: "flex", gap: space.sm, alignItems: "center", flexWrap: "wrap", marginBottom: space.md }}>
        {["All", "Accepted", "Declined", "Pending", "In Review", "To Interview"].map((statusOption) => {
          const isActive = statusOption === "All" ? filters.status === "" : filters.status === statusOption;
          // Each option keeps the colour of the status it represents, so the
          // chips and the row badges read as the same language.
          const statusColor = statusOption === "All" ? ink : (STATUS_COLORS[statusOption]?.bg || color.wine400);
          const activeText  = statusOption === "All" ? color.white : (STATUS_COLORS[statusOption]?.color || ink);

          return (
            <button
              key={statusOption}
              onClick={() => setFilters(p => ({ ...p, status: statusOption === "All" ? "" : statusOption }))}
              style={{
                background: isActive ? statusColor : surface,
                color: isActive ? activeText : inkBody,
                border: isActive ? "none" : `1px solid ${line}`,
                borderRadius: radius.pill,
                padding: "7px 16px",
                fontFamily: font.ui,
                ...type.helper,
                fontWeight: isActive ? 500 : 400,
                cursor: "pointer",
                transition: `all 180ms ${ease}`,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = color.wine400; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = line; }}
            >
              {statusOption}
            </button>
          );
        })}
      </div>

      {/* Applicant list */}
      {filtered.length > 0 ? (
        <div className="ca-rows">
          {filtered.map(applicant => {
            const fullName = buildFullName(applicant) !== "User" ? buildFullName(applicant) : "this applicant";
            const sc = STATUS_COLORS[applicant.status] || { bg: color.wine400, color: ink };
            return (
              <div
                key={applicant.id}
                className="ca-row"
                onClick={() => setViewingApplicant(applicant)}
              >
                <StudentAvatar size={42} />
                <div style={{ width: "1px", height: "30px", background: line, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: font.ui, ...type.label, color: ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fullName}
                  </p>
                  <div className="ca-row-meta">
                    <span style={{ background: sc.bg, color: sc.color, borderRadius: radius.pill, padding: "2px 10px", fontFamily: font.ui, fontSize: "0.72rem", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {applicant.status}
                    </span>
                    <span className="ca-row-program" style={{ color: color.wine400, fontSize: "0.7rem", flexShrink: 0 }}>·</span>
                    <span className="ca-row-program" style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {applicant.program}
                    </span>
                  </div>
                </div>
                <img src={viewIcon} alt="view" style={{ width: "32px", height: "32px", objectFit: "contain", flexShrink: 0, opacity: 0.7 }} />
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "72px 24px", gap: space.xs, background: surface, border: `1px dashed ${color.wine400}`, borderRadius: radius.panel }}>
          <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink }}>
            {applicants.length === 0 ? "No applicants yet" : "No applicants match your search or filters"}
          </p>
          <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "44ch" }}>
            {applicants.length === 0
              ? "Applicants will appear here once students apply to your OJT posts."
              : "Try a different name or ID, or clear a filter to widen the results."}
          </p>
        </div>
      )}
    </div>
  );

  const overlays = (
    <>
      {viewingApplicant && (
        <PersonalDetailsModal
          applicant={viewingApplicant}
          onClose={() => setViewingApplicant(null)}
          onStatusChange={handleStatusChange}
          onMessage={handleMessage}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <>
        <ResponsiveStyles />
        {contentArea}
        {overlays}
      </>
    );
  }

  return (
    <>
      <ResponsiveStyles />
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: page }}>

        {/* App header */}
        <div className="ca-app-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src={logo} alt="OJTern" style={{ width: "42px", height: "42px", objectFit: "contain" }} />
            <span style={{ fontFamily: font.logo, fontSize: "clamp(1.1rem, 3vw, 1.4rem)", color: onPanel, letterSpacing: "0.03em" }}>OJTern</span>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Sidebar — hidden on mobile via CSS */}
          <div className="ca-sidebar">
            {navItems.map((item) => (
              <div
                key={item.key}
                onClick={() => setActiveNav(item.label)}
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px", cursor: "pointer", borderBottom: `1px solid ${color.blush300}`, transition: `background 160ms ${ease}`, background: activeNav === item.label ? color.goldTint : "transparent" }}
              >
                <img src={item.icon} alt="" style={{ width: "26px", height: "26px", objectFit: "contain", flexShrink: 0, opacity: activeNav === item.label ? 1 : 0.4 }} />
                <span className="ca-nav-label" style={{ fontFamily: font.ui, fontSize: "0.95rem", fontWeight: activeNav === item.label ? 600 : 400, color: onPanel, opacity: activeNav === item.label ? 1 : 0.6 }}>{item.label}</span>
              </div>
            ))}
          </div>

          {contentArea}
        </div>

        {overlays}
      </div>
    </>
  );
};

export default CompanyApplicantsScreen;