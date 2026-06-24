import React, { useState, useRef, useEffect } from "react";
import { collection, onSnapshot, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

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

const red     = "#8B0000";
const darkRed = "#590101";

const STATUS_OPTIONS = ["Accept", "Decline", "Pending", "In Review", "To Interview"];

const STATUS_COLORS = {
  "Accept":      { bg: "#4CAF50", color: "white" },
  "Decline":     { bg: "#8B0000", color: "white" },
  "Pending":     { bg: "#C8B800", color: "white" },
  "In Review":   { bg: "#1A3A8B", color: "white" },
  "To Interview":{ bg: "#6B21A8", color: "white" },
};

const DROPDOWN_ITEM_HEIGHT = 38;
const DROPDOWN_PADDING = 20;
const DROPDOWN_HEIGHT = STATUS_OPTIONS.length * DROPDOWN_ITEM_HEIGHT + DROPDOWN_PADDING;

// TODO: Populate from backend
const SEX_OPTIONS = [];

// ── Responsive styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&family=Monomaniac+One&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #8B0000; border-radius: 4px; }
    ::-webkit-scrollbar-track { background: #f0f0f0; }
    .applicant-row:hover { background: #d0d0d0 !important; }
    .app-msg-scroll::-webkit-scrollbar { width: 4px; }
    .app-msg-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.4); border-radius: 4px; }
    .app-msg-scroll::-webkit-scrollbar-track { background: transparent; }

    /* ── Top bar ── */
    .ca-topbar {
      background: ${darkRed};
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    @media (max-width: 560px) {
      .ca-topbar { padding: 10px 14px; }
    }

    /* Search input */
    .ca-search-input { width: 160px; }
    @media (max-width: 480px) {
      .ca-search-input { width: 110px; }
    }

    /* ── Filter badge area ── */
    .ca-filter-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      background: #f5f5f5;
      flex-wrap: wrap;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }
    @media (max-width: 560px) {
      .ca-filter-badges { padding: 8px 14px; }
    }

    /* ── List scroll area ── */
    .ca-list-area {
      flex: 1;
      overflow-y: auto;
      padding: 14px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    @media (max-width: 560px) {
      .ca-list-area { padding: 10px 12px; }
    }

    /* ── Applicant row subtitle ── */
    .ca-row-subtitle {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
      overflow: hidden;
    }

    /* Hide program on very small screens */
    .ca-row-program { display: inline; }
    @media (max-width: 400px) {
      .ca-row-program { display: none; }
    }

    /* ── Personal Details Modal ── */
    .ca-modal-inner {
      background: #e8e8e8;
      border-radius: 22px;
      width: 100%;
      max-width: 700px;
      max-height: 92vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 56px rgba(0,0,0,0.35);
    }

    .ca-modal-header {
      background: #e8e8e8;
      padding: 22px 30px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #d0d0d0;
      flex-shrink: 0;
    }
    @media (max-width: 560px) {
      .ca-modal-header { padding: 14px 16px 12px; }
      .ca-modal-header h2 { font-size: 1.4rem !important; }
    }

    .ca-modal-body {
      overflow-y: auto;
      padding: 22px 30px 30px;
      flex: 1;
    }
    @media (max-width: 560px) {
      .ca-modal-body { padding: 14px 16px 20px; }
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
      background: #e8e8e8;
      border-radius: 22px;
      width: 100%;
      max-width: 600px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 56px rgba(0,0,0,0.35);
    }

    .ca-popup-body {
      padding: 16px 28px 0;
    }
    @media (max-width: 480px) {
      .ca-popup-body { padding: 12px 16px 0; }
    }

    .ca-popup-footer {
      background: ${darkRed};
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
      background: linear-gradient(90deg, ${red} 0%, ${darkRed} 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.25);
    }
    @media (max-width: 560px) {
      .ca-app-header { padding: 0 14px; height: 58px; }
    }

    /* Sidebar: hidden on mobile */
    .ca-sidebar {
      width: 260px;
      flex-shrink: 0;
      background: #e0e0e0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      border-right: 1px solid #ccc;
    }
    @media (max-width: 700px) {
      .ca-sidebar { display: none; }
    }

    /* Sidebar nav item label */
    .ca-nav-label { display: inline; }

    /* ── Applicants container card ── */
    .ca-card {
      background: #e0e0e0;
      border-radius: 14px;
      padding: 16px 20px;
    }
    @media (max-width: 560px) {
      .ca-card { padding: 12px 14px; }
    }

    /* ── Applicants card heading ── */
    .ca-card-heading {
      font-family: 'Jersey 25', sans-serif;
      font-size: clamp(1.1rem, 4vw, 1.8rem);
      font-weight: 400;
      color: #1a1a1a;
      margin-bottom: 12px;
    }

    /* ── Applicant row: hide program text on very small screens ── */
    .ca-row-inner {
      background: #dadada;
      border-radius: 50px;
      padding: 8px 14px 8px 8px;
      display: flex;
      align-items: center;
      gap: 14px;
      transition: background 0.15s;
      cursor: pointer;
    }

    /* ── Footer count text ── */
    .ca-count-text {
      text-align: center;
      font-family: 'Kufam', sans-serif;
      font-size: 0.82rem;
      color: #aaa;
      padding: 16px 0 4px;
    }
  `}</style>
);

const Chip = ({ label }) => (
  <span style={{
    display: "inline-block", padding: "5px 16px", borderRadius: "20px",
    background: "rgba(40,1,1,0.50)", fontFamily: "'Kufam', sans-serif",
    fontSize: "0.85rem", color: "white", whiteSpace: "nowrap",
  }}>
    {label}
  </span>
);

const FieldLabel = ({ children, style }) => (
  <p style={{
    fontFamily: "'Jersey 25', sans-serif", fontSize: "1.2rem",
    fontWeight: "500", color: "#1a1a1a", marginBottom: "6px", ...style,
  }}>
    {children}
  </p>
);

const StudentAvatar = ({ size = 42 }) => (
  <img
    src={userIcon}
    alt="user"
    style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
  />
);

// ── StatusDropdown ─────────────────────────────────────────────────────────────
const StatusDropdown = ({ status, onChange, open, setOpen }) => {
  const ref = useRef(null);
  const current = STATUS_COLORS[status] || { bg: "#888", color: "white" };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setOpen]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <div style={{
        background: current.bg, color: "white", borderRadius: "20px",
        padding: "5px 14px", fontFamily: "'Jua', sans-serif",
        fontSize: "0.82rem", fontWeight: "500", userSelect: "none", whiteSpace: "nowrap",
      }}>
        {status}
      </div>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          background: "white", borderRadius: "8px", width: "28px", height: "28px",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }}
      >
        <svg width="10" height="7" viewBox="0 0 10 7" fill="#555" stroke="none">
          <polygon points="0,0 10,0 5,7"/>
        </svg>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "rgba(160,160,160,0.92)", borderRadius: "16px", padding: "10px",
          zIndex: 9999, display: "flex", flexDirection: "column", gap: "6px",
          minWidth: "120px", boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
        }}>
          {STATUS_OPTIONS.map(opt => {
            const sc = STATUS_COLORS[opt];
            const isActive = opt === status;
            return (
              <div
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  background: isActive ? sc.bg : "transparent",
                  color: isActive ? "white" : sc.bg,
                  borderRadius: "20px", padding: "5px 12px",
                  fontFamily: "'Jua', sans-serif", fontSize: "0.82rem",
                  fontWeight: "500", cursor: "pointer", textAlign: "center",
                  whiteSpace: "nowrap", transition: "background 0.12s, color 0.12s", userSelect: "none",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = sc.bg; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isActive ? sc.bg : "transparent";
                  e.currentTarget.style.color = isActive ? "white" : sc.bg;
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
  return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" title={`Open ${file.name}`}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer", textDecoration: "none" }}>
      <div style={{ position: "relative", width: "72px", height: "82px" }}>
        <img src={pdfIcon} alt={isPng ? "PNG" : "PDF"} style={{ position: "absolute", top: 0, left: 0, width: "72px", height: "82px", objectFit: "contain", zIndex: 1 }} />
        <img src={downloadIcon} alt="Download" style={{ position: "absolute", top: "-6px", right: "-6px", width: "26px", height: "26px", objectFit: "contain", zIndex: 2 }} />
      </div>
      <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.58rem", color: "#555", textAlign: "center", wordBreak: "break-all", maxWidth: "80px", lineHeight: 1.3, marginTop: "4px" }}>
        {file.name}
      </span>
    </a>
  );
};

// ── Status Description Popup ──────────────────────────────────────────────────
const StatusDescriptionPopup = ({ status, onClose, onSend }) => {
  const [description, setDescription] = useState("");
  const sc = STATUS_COLORS[status] || { bg: "#4CAF50", color: "white" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px" }}>
      <div className="ca-popup-inner">
        <div style={{ padding: "20px 28px 0 28px" }}>
          <span style={{ display: "inline-block", background: sc.bg, color: "white", borderRadius: "20px", padding: "6px 20px", fontFamily: "'Jua', sans-serif", fontSize: "0.9rem", fontWeight: "500" }}>
            {status === "Accept" ? "Accepted" : status === "Decline" ? "Declined" : status}
          </span>
        </div>
        <div style={{ margin: "16px 28px 0", borderTop: "2px solid #ccc" }} />
        <div className="ca-popup-body">
          <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", fontWeight: "500", color: "#1a1a1a", marginBottom: "10px" }}>Write a description:</p>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Write your message to the applicant..."
            style={{ width: "100%", minHeight: "90px", border: "none", outline: "none", background: "transparent", fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#222", resize: "none", lineHeight: 1.6 }} />
        </div>
        <div className="ca-popup-footer">
          <button onClick={() => { onSend(description); onClose(); }}
            style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: "20px", padding: "8px 28px", color: "white", fontFamily: "'Jersey 25', sans-serif", fontSize: "1rem", cursor: "pointer", fontWeight: "500" }}>
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

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.50)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
        <div className="ca-modal-inner">

          {/* Header */}
          <div className="ca-modal-header">
            <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.3rem, 4vw, 2rem)", fontWeight: "500", margin: 0, color: "#1a1a1a" }}>Personal Details</h2>
            <button onClick={onClose} style={{ background: darkRed, border: "none", borderRadius: "50%", width: "32px", height: "32px", color: "white", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
          </div>

          {/* Body */}
          <div className="ca-modal-body">
            {/* Name row */}
            <div className="ca-name-row">
              <div><FieldLabel>First Name:</FieldLabel><Chip label={applicant.firstName} /></div>
              <div><FieldLabel>Middle Initial:</FieldLabel><Chip label={applicant.middleInitial || "—"} /></div>
              <div><FieldLabel>Last Name:</FieldLabel><Chip label={applicant.lastName} /></div>
              {applicant.suffix && <div><FieldLabel>Suffix:</FieldLabel><Chip label={applicant.suffix} /></div>}
            </div>

            <div style={{ marginBottom: "14px" }}><FieldLabel>Sex:</FieldLabel><Chip label={applicant.sex} /></div>

            <div style={{ marginBottom: "14px" }}>
              <FieldLabel>Location:</FieldLabel>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {locationChips.map((c, i) => <Chip key={i} label={c} />)}
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <FieldLabel>College / Program / Major:</FieldLabel>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {collegeChips.map((c, i) => <Chip key={i} label={c} />)}
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "2px solid #ccc", margin: "16px 0" }} />

            {/* Contact row */}
            <div className="ca-contact-row">
              <div><FieldLabel>Contact Information</FieldLabel><Chip label={applicant.contact} /></div>
              <div><FieldLabel>Email address:</FieldLabel><Chip label={applicant.email} /></div>
            </div>

            {/* Application message */}
            <div style={{ marginBottom: "16px" }}>
              <FieldLabel>Application message:</FieldLabel>
              <div className="app-msg-scroll" style={{ background: "rgba(40,1,1,0.50)", borderRadius: "14px", padding: "13px 18px", maxHeight: "110px", overflowY: "auto", position: "relative" }}>
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "white", lineHeight: 1.65, margin: 0, wordBreak: "break-word" }}>
                  {applicant.message}
                </p>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "2px solid #ccc", margin: "16px 0" }} />

            {/* File + Status */}
            <div className="ca-file-status-row">
              <div>
                <FieldLabel>Attached File:</FieldLabel>
                {applicant.attachedFiles && applicant.attachedFiles.length > 0
                  ? <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {applicant.attachedFiles.map((file, idx) => <AttachedFileChip key={idx} file={file} />)}
                    </div>
                  : <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#aaa", fontStyle: "italic" }}>No file attached</span>
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
                  />
                </div>

                {dropdownOpen && (
                  <div style={{ height: DROPDOWN_HEIGHT, flexShrink: 0 }} aria-hidden="true" />
                )}

                <button
                  onClick={() => onMessage(applicant)}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    background: darkRed, border: "none", borderRadius: "20px",
                    padding: "8px 18px", cursor: "pointer", color: "white",
                    fontFamily: "'Jua', sans-serif", fontSize: "0.9rem", fontWeight: "500",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          onSend={() => { onStatusChange(applicant.id, pendingStatus); setPendingStatus(null); }}
        />
      )}
    </>
  );
};

// ── Filter Panel ──────────────────────────────────────────────────────────────
const FilterPanel = ({
  filters, setFilters,
  selectedRegion, setSelectedRegion,
  selectedProvince, setSelectedProvince,
  selectedCity, setSelectedCity,
  selectedBarangay, setSelectedBarangay,
  filterRef,
}) => {
  // TODO: Fetch sex options from backend
  const sexOptions = [];

  // TODO: Fetch colleges from backend
  const colleges = [];

  // TODO: Fetch programs from backend based on filters.college
  const programs = [];

  // TODO: Fetch specializations from backend based on filters.college + filters.program
  const specializations = [];

  // TODO: Fetch regions from backend
  const regions = [];

  // TODO: Fetch provinces from backend based on selectedRegion
  const provinces = [];

  // TODO: Fetch cities from backend based on selectedProvince
  const cities = [];

  // TODO: Fetch barangays from backend based on selectedCity
  const barangays = [];

  const clearAll = () => {
    setFilters({ sex: "", college: "", program: "", specialization: "" });
    setSelectedRegion(""); setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay("");
  };

  const toggleSex = (val) => setFilters(prev => ({ ...prev, sex: prev.sex === val ? "" : val }));

  return (
    <div
      ref={filterRef}
      style={{
        position: "absolute", top: "48px", right: 0, width: "260px",
        background: "white", border: `1.5px solid ${red}`, borderRadius: "10px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.18)", zIndex: 100, overflow: "hidden",
        fontFamily: "'Kufam', sans-serif",
      }}
    >
      {/* Sex */}
      <div style={{ padding: "10px 12px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed }}>Sex:</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontSize: "0.7rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        {sexOptions.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {sexOptions.map(s => (
              <span key={s} onClick={() => toggleSex(s)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.72rem", cursor: "pointer", userSelect: "none", background: filters.sex === s ? red : "#f0e0e0", color: filters.sex === s ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available.</p>
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "6px 0" }} />

      {/* College / Program / Specialization */}
      <div style={{ padding: "4px 12px 10px" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, marginBottom: "6px" }}>College:</p>
        {colleges.length > 0 ? (
          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
            {colleges.map(col => (
              <div key={col}
                onClick={() => setFilters(prev => ({ ...prev, college: prev.college === col ? "" : col, program: "", specialization: "" }))}
                style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", cursor: "pointer", background: filters.college === col ? "#f0d0d0" : "#f7f0f0", color: darkRed, border: "1px solid #e0c0c0" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f0d0d0"}
                onMouseLeave={e => e.currentTarget.style.background = filters.college === col ? "#f0d0d0" : "#f7f0f0"}
              >{col}</div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available.</p>
        )}

        {filters.college && (
          <>
            <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, margin: "8px 0 6px" }}>Program:</p>
            {programs.length > 0 ? (
              <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {programs.map(prog => (
                  <span key={prog} onClick={() => setFilters(prev => ({ ...prev, program: prev.program === prog ? "" : prog, specialization: "" }))}
                    style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: filters.program === prog ? red : "#f0e0e0", color: filters.program === prog ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>
                    {prog}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available.</p>
            )}
          </>
        )}

        {filters.program && (
          <>
            <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, margin: "8px 0 6px" }}>Specialization:</p>
            {specializations.length > 0 ? (
              <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {specializations.map(spec => (
                  <span key={spec} onClick={() => setFilters(prev => ({ ...prev, specialization: prev.specialization === spec ? "" : spec }))}
                    style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: filters.specialization === spec ? red : "#f0e0e0", color: filters.specialization === spec ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>
                    {spec}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No specializations available.</p>
            )}
          </>
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "0" }} />

      {/* Location */}
      <div style={{ padding: "6px 12px 10px" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, marginBottom: "6px" }}>Location:</p>

        {/* Region */}
        {!selectedRegion && (
          regions.length > 0 ? (
            <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
              {regions.map(r => (
                <div key={r} onClick={() => { setSelectedRegion(r); setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); }}
                  style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", cursor: "pointer", background: "#f7f0f0", color: darkRed, border: "1px solid #e0c0c0" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0d0d0"}
                  onMouseLeave={e => e.currentTarget.style.background = "#f7f0f0"}
                >{r}</div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available.</p>
          )
        )}

        {/* Province */}
        {selectedRegion && !selectedProvince && (
          <div>
            <div onClick={() => { setSelectedRegion(""); setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); }}
              style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "8px", color: red, fontSize: "0.72rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {selectedRegion}
            </div>
            {provinces.length > 0 ? (
              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
                {provinces.map(p => (
                  <div key={p} onClick={() => { setSelectedProvince(p); setSelectedCity(""); setSelectedBarangay(""); }}
                    style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", cursor: "pointer", background: "#f7f0f0", color: darkRed, border: "1px solid #e0c0c0" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f0d0d0"}
                    onMouseLeave={e => e.currentTarget.style.background = "#f7f0f0"}
                  >{p}</div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available.</p>
            )}
          </div>
        )}

        {/* City */}
        {selectedProvince && !selectedCity && (
          <div>
            <div onClick={() => { setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); }}
              style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "8px", color: red, fontSize: "0.72rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {selectedProvince}
            </div>
            {cities.length > 0 ? (
              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {cities.map(c => (
                  <span key={c} onClick={() => { setSelectedCity(c); setSelectedBarangay(""); }}
                    style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#e0c0c0"}
                    onMouseLeave={e => e.currentTarget.style.background = "#f0e0e0"}
                  >{c}</span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available.</p>
            )}
          </div>
        )}

        {/* Barangay */}
        {selectedCity && (
          <div>
            <div onClick={() => { setSelectedCity(""); setSelectedBarangay(""); }}
              style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "8px", color: red, fontSize: "0.72rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {selectedCity}
            </div>
            {barangays.length > 0 ? (
              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {barangays.map(b => (
                  <span key={b} onClick={() => setSelectedBarangay(prev => prev === b ? "" : b)}
                    style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: selectedBarangay === b ? red : "#f0e0e0", color: selectedBarangay === b ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}
                  >{b}</span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No options available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
const CompanyApplicantsScreen = ({ embedded = false, onNavigateToMessages, user }) => {
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
  const [filters, setFilters]                   = useState({ sex: "", college: "", program: "", specialization: "" });
  const [selectedRegion, setSelectedRegion]     = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedCity, setSelectedCity]         = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [activeNav, setActiveNav]               = useState("Applicants");

  const filterRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navItems = [
    { key: "dashboard",      label: "Dashboard",       icon: dashboardIcon },
    { key: "postojt",        label: "Post OJT",        icon: postOJTIcon },
    { key: "applicants",     label: "Applicants",      icon: applicantsIcon },
    { key: "messages",       label: "Messages",        icon: messagesIcon },
    { key: "accountprofile", label: "Account Profile", icon: accountProfileIcon },
    { key: "about",          label: "About",           icon: aboutIcon },
  ];

  const hasFilter = filters.sex || filters.college || filters.program || filters.specialization || selectedRegion || selectedCity || selectedBarangay;
  const activeFilterCount = [filters.sex, filters.college, filters.program, filters.specialization, selectedRegion, selectedProvince, selectedCity, selectedBarangay].filter(Boolean).length;

  const filtered = applicants.filter(a => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    const q = search.toLowerCase();
    const matchSearch   = fullName.includes(q) || (a.college || "").toLowerCase().includes(q) || (a.program || "").toLowerCase().includes(q);
    const matchSex      = !filters.sex || a.sex === filters.sex;
    const matchCollege  = !filters.college || a.college === filters.college;
    const matchProgram  = !filters.program || a.program === filters.program;
    const matchSpec     = !filters.specialization || a.major === filters.specialization;
    const matchRegion   = !selectedRegion || a.region === selectedRegion;
    const matchProvince = !selectedProvince || a.province === selectedProvince;
    const matchCity     = !selectedCity || a.city === selectedCity;
    const matchBarangay = !selectedBarangay || a.barangay === selectedBarangay;
    return matchSearch && matchSex && matchCollege && matchProgram && matchSpec && matchRegion && matchProvince && matchCity && matchBarangay;
  });

  const handleStatusChange = async (id, newStatus) => {
    // Optimistic local update
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    if (viewingApplicant?.id === id) setViewingApplicant(prev => ({ ...prev, status: newStatus }));
    // Persist to Firestore
    try {
      await updateDoc(doc(db, "applications", id), { status: newStatus });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleMessage = (applicant) => {
    setViewingApplicant(null);
    if (onNavigateToMessages) {
      onNavigateToMessages({
        id: applicant.id,
        name: `${applicant.firstName} ${applicant.lastName}`,
      });
    }
  };

  const contentArea = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <div className="ca-topbar">
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", borderRadius: "24px", padding: "7px 16px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <div style={{ width: "1px", height: "16px", background: "rgba(0,0,0,0.2)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Application"
            className="ca-search-input"
            style={{ border: "none", background: "transparent", outline: "none", color: "black", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.05rem" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </div>

        {/* Filter button */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setShowFilter(v => !v)}
            style={{ width: "36px", height: "36px", background: "white", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `2px solid ${red}` : "none", position: "relative" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? red : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {activeFilterCount > 0 && (
              <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "10px", height: "10px", borderRadius: "50%", background: red }} />
            )}
          </div>
          {showFilter && (
            <FilterPanel
              filters={filters} setFilters={setFilters}
              selectedRegion={selectedRegion}     setSelectedRegion={setSelectedRegion}
              selectedProvince={selectedProvince} setSelectedProvince={setSelectedProvince}
              selectedCity={selectedCity}         setSelectedCity={setSelectedCity}
              selectedBarangay={selectedBarangay} setSelectedBarangay={setSelectedBarangay}
              filterRef={filterRef}
            />
          )}
        </div>
      </div>

      {/* ── Active filter badges ── */}
      {hasFilter && (
        <div className="ca-filter-badges">
          <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#888" }}>Filters:</span>
          {[
            { key: "sex",            val: filters.sex,            clear: () => setFilters(p => ({ ...p, sex: "" })) },
            { key: "college",        val: filters.college,        clear: () => setFilters(p => ({ ...p, college: "", program: "", specialization: "" })) },
            { key: "program",        val: filters.program,        clear: () => setFilters(p => ({ ...p, program: "", specialization: "" })) },
            { key: "specialization", val: filters.specialization, clear: () => setFilters(p => ({ ...p, specialization: "" })) },
            { key: "region",   val: selectedRegion,   clear: () => { setSelectedRegion(""); setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); } },
            { key: "province", val: selectedProvince, clear: () => { setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); } },
            { key: "city",     val: selectedCity,     clear: () => { setSelectedCity(""); setSelectedBarangay(""); } },
            { key: "barangay", val: selectedBarangay, clear: () => setSelectedBarangay("") },
          ].filter(f => f.val).map(f => (
            <span key={f.key} style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "inline-flex", alignItems: "center", gap: "5px" }}>
              {f.val}
              <span onClick={f.clear} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
            </span>
          ))}
          <span
            onClick={() => {
              setFilters({ sex: "", college: "", program: "", specialization: "" });
              setSelectedRegion(""); setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay("");
            }}
            style={{ fontSize: "0.74rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", textDecoration: "underline" }}
          >
            Clear all
          </span>
        </div>
      )}

      {/* ── Applicant list ── */}
      <div className="ca-list-area">
        <div className="ca-card">
          <h2 className="ca-card-heading">Applicants</h2>
          <hr style={{ border: "none", borderTop: "2px solid #c0c0c0", marginBottom: "14px" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map(applicant => {
              const fullName = `${applicant.firstName}${applicant.middleInitial ? " " + applicant.middleInitial : ""} ${applicant.lastName}`;
              const sc = STATUS_COLORS[applicant.status] || { bg: "#888", color: "white" };
              return (
                <div
                  key={applicant.id}
                  className="applicant-row ca-row-inner"
                  onClick={() => setViewingApplicant(applicant)}
                >
                  <StudentAvatar size={42} />
                  <div style={{ width: "1px", height: "32px", background: "rgba(0,0,0,0.12)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 600, fontSize: "0.92rem", color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {fullName}
                    </p>
                    <div className="ca-row-subtitle">
                      <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "0.68rem", background: sc.bg, color: sc.color, borderRadius: "10px", padding: "1px 8px", fontWeight: "500", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {applicant.status}
                      </span>
                      <span className="ca-row-program" style={{ color: "#ccc", fontSize: "0.7rem", flexShrink: 0 }}>•</span>
                      <span className="ca-row-program" style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.71rem", color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                        {applicant.program}
                      </span>
                    </div>
                  </div>
                  <img src={viewIcon} alt="view" style={{ width: "35px", height: "35px", objectFit: "contain", flexShrink: 0 }} />
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px", color: "#aaa", fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem" }}>
                {applicants.length === 0 ? "No applicants yet." : "No applicants match your search or filters."}
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <p className="ca-count-text">
              Showing {filtered.length} of {applicants.length} applicant{applicants.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
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
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f0f0f0" }}>

        {/* App header */}
        <div className="ca-app-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src={logo} alt="OJTern" style={{ width: "46px", height: "46px", objectFit: "contain" }} />
            <span style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "clamp(1.1rem, 3vw, 1.5rem)", color: "white", letterSpacing: "0.03em" }}>OJTern</span>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Sidebar — hidden on mobile via CSS */}
          <div className="ca-sidebar">
            {navItems.map((item) => (
              <div
                key={item.key}
                onClick={() => setActiveNav(item.label)}
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px", cursor: "pointer", borderBottom: "1px solid #ccc", transition: "background 0.15s", background: activeNav === item.label ? "rgba(139,0,0,0.10)" : "transparent" }}
              >
                <img src={item.icon} alt={item.label} style={{ width: "30px", height: "30px", objectFit: "contain", flexShrink: 0, opacity: activeNav === item.label ? 1 : 0.35 }} />
                <span className="ca-nav-label" style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", opacity: activeNav === item.label ? 1 : 0.35 }}>{item.label}</span>
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