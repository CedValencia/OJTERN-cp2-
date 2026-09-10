import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import userIcon from "../icons/user.png";
import { useChat } from "./useChat";
import { uploadFilesToFolder, uploadFileToFolder } from "./CloudinaryService";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { color, font, type, space, radius, shadow, ease } from "./theme";
import { AnchoredMenu, MenuItem, ReplyPreview, ReplyComposerBar, EditedTag, EditHistoryModal } from "./MessageExtras";

// ── Design tokens, aliased for this screen ────────────────────────────────────
// Kapareho ng CoordinatorMessagesScreen: lahat galing sa theme.js.
// Walang hardcoded hex dito — kung magbabago ang palette, sa theme.js lang.
const ink          = color.ink;          // primary text on light surfaces
const inkBody      = color.inkBody;      // body copy
const inkMuted     = color.inkMuted;     // secondary/meta text
const inkFaint     = color.inkFaint;     // placeholders, empty states
const surface      = color.wine600;      // cards, rows, modals
const page         = color.wine900;      // page background
const field        = color.wine700;      // inputs / neutral fills
const line         = color.wine700;      // hairlines & borders
const lineSoft     = color.wine800;      // softer fills & separators
const panel        = color.blush100;     // dark panels (header bar, my bubbles)
const panelDeep    = color.blush50;      // hover/pressed state of panel
const onPanel      = color.onWine;       // light text on dark panel
const onPanelDim   = color.onWineMuted;
const onPanelFaint = color.onWineFaint;
const danger       = color.danger;
const success      = color.success;

// Asymmetric bubble corners built from the shared card radius.
const bubbleMine   = `${radius.card} ${radius.card} 6px ${radius.card}`;
const bubbleTheirs = `${radius.card} ${radius.card} ${radius.card} 6px`;

// ─── Report Categories ────────────────────────────────────────────────────────
const reportCategories = [
  {
    label: "Fraud and Scam",
    description: "Job scams are fraudulent schemes where scammers impersonate employers to steal money, personal information, or coerce victims into fake work activities.",
    details: ["Fake job postings requiring payment", "Identity theft", "Misrepresentation of company"],
  },
  {
    label: "Discrimination",
    description: "Discrimination involves unfair treatment based on race, gender, age, religion, disability, or other protected characteristics.",
    details: ["Racial discrimination", "Gender-based bias", "Age discrimination", "Religious intolerance"],
  },
  {
    label: "Sexual Harassment",
    description: "Sexual harassment includes any unwelcome sexual advances or other verbal or physical conduct of a sexual nature.",
    details: ["Unwanted physical contact", "Verbal harassment", "Hostile work environment", "Quid pro quo harassment"],
  },
  {
    label: "Harmful Misinformation",
    description: "Spreading false information about OJT programs, company practices, or student requirements.",
    details: ["False program descriptions", "Fake requirements", "Misleading slot information"],
  },
  {
    label: "Workplace Misconduct",
    description: "Behavior that violates company policies or professional standards, including unsafe working conditions.",
    details: ["Unsafe working conditions", "Violation of OJT agreement", "Forced overtime", "Unpaid work"],
  },
  {
    label: "Others",
    description: "Any other concern not listed above. Please provide a detailed description.",
    details: [],
  },
];

// ── Responsive breakpoint hook ────────────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

// ── Responsive styles injected once ───────────────────────────────────────────
const MessagesStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    /* Chat list search shrinks on narrow screens */
    .msg-search-input { width: 170px; }
    .msg-search-input::placeholder { color: ${inkFaint}; }
    @media (max-width: 480px) {
      .msg-search-input { width: 110px; }
    }

    .msg-composer-input::placeholder { color: ${inkFaint}; }

    /* Visible keyboard focus on every control in this screen */
    .msg-thread :focus-visible,
    .msg-list :focus-visible,
    .msg-modal :focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: ${radius.pill};
    }

    /* Thread padding */
    .msg-thread-body { padding: 24px 32px; overflow-x: hidden; }

    /* Long words and URLs must never widen the thread. */
    .msg-row { max-width: 100%; min-width: 0; }

    /* Brief pulse when you jump to a replied-to message. */
    @keyframes msgFlash {
      0%   { background: transparent; }
      25%  { background: ${color.wine700}; }
      100% { background: transparent; }
    }
    .msg-row-flash { animation: msgFlash 1400ms ${ease} both; border-radius: ${radius.card}; }
    @media (prefers-reduced-motion: reduce) {
      .msg-row-flash { animation: none !important; outline: 2px solid ${color.wine400}; }
    }
    @media (max-width: 640px) {
      .msg-thread-body { padding: 14px 16px; }
    }

    .msg-list-wrapper { padding: clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px); }

    /* Search + title bar, same shape as the Find a company bar */
    .msg-search-bar {
      padding: 18px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${space.md};
      flex-wrap: wrap;
    }
    @media (max-width: 480px) {
      .msg-search-bar { padding: 14px; }
    }

    /* Motion answers an action: a dialog opening, a message arriving. */
    @keyframes msgFadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes msgLift   { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }

    .msg-overlay { animation: msgFadeIn 180ms ${ease} both; }
    .msg-dialog  { animation: msgLift 240ms ${ease} both; }
    .msg-popover { animation: msgLift 160ms ${ease} both; }

    @media (prefers-reduced-motion: reduce) {
      .msg-overlay, .msg-dialog, .msg-popover { animation: none !important; }
      .msg-row, .msg-btn { transition: none !important; }
    }
  `}</style>
);

// ── CompanyAvatar ─────────────────────────────────────────────────────────────
const CompanyAvatar = ({ size = 40 }) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    <img src={userIcon} alt="" style={{ width: size, height: size, objectFit: "contain" }} />
  </div>
);

// ── ImageLightbox ─────────────────────────────────────────────────────────────
const ImageLightbox = ({ src, name, onClose }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = () => {
    const a = document.createElement("a"); a.href = src; a.download = name || "image"; a.click();
  };

  return (
    <div className="msg-modal msg-overlay" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.86)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, flexDirection: "column", gap: space.md }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 0, left: 0, right: 0, padding: `12px ${space.lg}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,10,0.45)" }}>
        <span style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
          <button onClick={handleDownload} style={{ background: "transparent", border: `1px solid ${onPanelFaint}`, borderRadius: radius.pill, padding: "7px 16px", color: onPanel, fontFamily: font.ui, ...type.helper, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: `1px solid ${onPanelFaint}`, borderRadius: "50%", width: "34px", height: "34px", color: onPanel, fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
        </div>
      </div>
      <img src={src} alt={name} onClick={e => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: radius.card, objectFit: "contain", boxShadow: shadow.panel }} />
    </div>
  );
};

// ── downloadFile ──────────────────────────────────────────────────────────────
const downloadFile = (url, name) => {
  const a = document.createElement("a"); a.href = url; a.download = name || "file.pdf"; a.click();
};

// ── AttachmentBubble ──────────────────────────────────────────────────────────
const AttachmentBubble = ({ attachment, isMe }) => {
  const [lightbox, setLightbox] = useState(false);
  const isImage = attachment.type.startsWith("image/");

  const handleClick = (e) => {
    e.stopPropagation();
    if (isImage) setLightbox(true);
    else downloadFile(attachment.url, attachment.name);
  };

  const bg     = isMe ? panel : lineSoft;
  const fg     = isMe ? onPanel : ink;
  const fgDim  = isMe ? onPanelDim : inkMuted;
  const chipBg = isMe ? "rgba(250,250,250,0.10)" : surface;
  const border = isMe ? "none" : `1px solid ${line}`;

  return (
    <>
      <div
        className="msg-btn"
        onClick={handleClick}
        title={isImage ? "Open this image" : "Download this file"}
        style={{ background: bg, border, borderRadius: isMe ? bubbleMine : bubbleTheirs, padding: isImage ? "6px" : "9px 13px", maxWidth: "230px", cursor: "pointer", userSelect: "none", transition: `opacity 180ms ${ease}` }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        {isImage ? (
          <img src={attachment.url} alt={attachment.name} style={{ maxWidth: "190px", maxHeight: "150px", borderRadius: "12px", display: "block" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "34px", height: "34px", background: chipBg, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: font.ui, ...type.helper, fontWeight: 500, color: fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "130px", margin: 0 }}>{attachment.name}</p>
              <p style={{ fontFamily: font.ui, fontSize: "0.75rem", lineHeight: 1.4, color: fgDim, marginTop: "2px" }}>PDF · tap to download</p>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={fgDim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
        )}
      </div>
      {lightbox && <ImageLightbox src={attachment.url} name={attachment.name} onClose={() => setLightbox(false)} />}
    </>
  );
};

// ── ConfirmModal ──────────────────────────────────────────────────────────────
const ConfirmModal = ({ message, onConfirm, onCancel, confirmLabel = "Yes", cancelLabel = "No", destructive = true }) => (
  <div className="msg-modal msg-overlay" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: space.md }}>
    <div className="msg-dialog" style={{ background: surface, borderRadius: radius.card, width: "100%", maxWidth: "360px", overflow: "hidden", border: `1px solid ${line}`, boxShadow: shadow.panel }}>
      <div style={{ padding: `${space.lg} ${space.lg} ${space.md}` }}>
        <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, textAlign: "center", margin: 0 }}>{message}</p>
      </div>
      <div style={{ display: "flex", borderTop: `1px solid ${line}` }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "13px", background: surface, border: "none", borderRight: `1px solid ${line}`, fontFamily: font.ui, ...type.control, color: inkMuted, cursor: "pointer" }}>{cancelLabel}</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: "13px", background: surface, border: "none", fontFamily: font.ui, ...type.control, color: destructive ? danger : ink, cursor: "pointer" }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

// ── InfoModal ─────────────────────────────────────────────────────────────────
const InfoModal = ({ message, onClose }) => (
  <div className="msg-modal msg-overlay" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, padding: space.md }}>
    <div className="msg-dialog" style={{ background: surface, borderRadius: radius.card, width: "100%", maxWidth: "340px", overflow: "hidden", textAlign: "center", border: `1px solid ${line}`, boxShadow: shadow.panel }}>
      <div style={{ padding: `${space.lg} ${space.lg} ${space.md}` }}>
        <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, margin: 0 }}>{message}</p>
      </div>
      <button onClick={onClose} style={{ width: "100%", padding: "13px", border: "none", borderTop: `1px solid ${line}`, background: surface, color: ink, fontFamily: font.ui, ...type.control, cursor: "pointer" }}>OK</button>
    </div>
  </div>
);

// ── Report success confirmation ───────────────────────────────────────────────
const ReportSuccessModal = ({ onClose }) => (
  <div className="msg-modal msg-overlay" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, padding: space.md }}>
    <div className="msg-dialog" style={{ background: surface, borderRadius: radius.panel, padding: `${space.xl} ${space.lg}`, textAlign: "center", maxWidth: "380px", width: "100%", border: `1px solid ${line}`, boxShadow: shadow.panel }}>
      <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: lineSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: `0 auto ${space.md}` }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h3 style={{ fontFamily: font.ui, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, marginBottom: space.sm }}>Report sent</h3>
      <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, marginBottom: space.lg }}>The review team will look into it and get back to you here.</p>
      <button
        onClick={onClose}
        style={{ background: panel, color: onPanel, border: "none", borderRadius: radius.pill, padding: "11px 34px", fontFamily: font.ui, ...type.control, cursor: "pointer", transition: `background 240ms ${ease}` }}
        onMouseEnter={e => (e.currentTarget.style.background = panelDeep)}
        onMouseLeave={e => (e.currentTarget.style.background = panel)}
      >
        Done
      </button>
    </div>
  </div>
);

// ── Report Modal ──────────────────────────────────────────────────────────────
const ReportModal = ({ company, onClose, onSubmit }) => {
  const [step, setStep]                 = useState(1);
  const [selected, setSelected]         = useState(null);
  const [description, setDescription]   = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [infoMsg, setInfoMsg]           = useState(null);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ["image/png", "application/pdf"];
    if (!allowed.includes(file.type)) { setInfoMsg("That file type isn't supported. Attach a PNG or a PDF."); return; }
    if (file.size > 10 * 1024 * 1024) { setInfoMsg("That file is over 10MB. Attach a smaller one."); return; }
    setAttachedFile({ name: file.name, type: file.type, url: URL.createObjectURL(file), file });
  };

  const handleSubmit = () => {
    if (!description.trim()) { setInfoMsg("Add a description of what happened."); return; }
    if (!attachedFile)       { setInfoMsg("Attach a file that supports your report."); return; }
    onSubmit({
      company: company.name,
      companyId: company.id || "",
      concern: selected?.label || "Others",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      description,
      attachedFile,
    });
    onClose();
  };

  const cat = reportCategories.find(c => c.label === selected?.label);

  return (
    <div className="msg-modal msg-overlay" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: space.md }}>
      <div className="msg-dialog" style={{ background: surface, borderRadius: radius.panel, width: "100%", maxWidth: "540px", maxHeight: "86vh", overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${line}`, boxShadow: shadow.panel }}>
        <div style={{ padding: `${space.md} ${space.lg}`, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${line}` }}>
          <div>
            <span style={{ fontFamily: font.ui, fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink }}>Report this company</span>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: "2px" }}>Step {step} of 3</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: "1.15rem", cursor: "pointer", color: inkMuted, lineHeight: 1 }}>✕</button>
        </div>

        {/* Progress hairline — three segments, one per step */}
        <div style={{ display: "flex", gap: "3px", padding: `0 ${space.lg}`, marginTop: "10px" }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ flex: 1, height: "3px", borderRadius: radius.pill, background: n <= step ? ink : line, transition: `background 260ms ${ease}` }} />
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: `${space.md} ${space.lg} ${space.lg}` }}>
          {step === 1 && (
            <>
              <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: "12px" }}>What is the concern?</p>
              {reportCategories.map((c) => {
                const isOn = selected?.label === c.label;
                return (
                  <div key={c.label} onClick={() => setSelected(c)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", cursor: "pointer", borderBottom: `1px solid ${lineSoft}` }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: `1.5px solid ${isOn ? ink : color.wine400}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: isOn ? ink : surface, transition: `all 180ms ${ease}` }}>
                      {isOn && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: color.white }} />}
                    </div>
                    <span style={{ fontFamily: font.ui, ...type.body, color: isOn ? ink : inkBody }}>{c.label}</span>
                  </div>
                );
              })}
            </>
          )}
          {step === 2 && cat && (
            <>
              <p style={{ fontFamily: font.ui, fontSize: "1rem", fontWeight: 600, color: ink, marginBottom: space.sm }}>{cat.label}</p>
              <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, marginBottom: space.md, maxWidth: "62ch" }}>{cat.description}</p>
              {cat.details.length > 0 && (
                <>
                  <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: space.sm }}>Common forms this takes</p>
                  <ul style={{ paddingLeft: "18px", margin: 0 }}>
                    {cat.details.map((d, i) => <li key={i} style={{ fontFamily: font.ui, ...type.helper, color: inkBody, marginBottom: space.xs }}>{d}</li>)}
                  </ul>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: space.sm }}>Describe what happened</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Include dates, names, and anything the review team should see."
                style={{ width: "100%", minHeight: "112px", border: `1px solid ${line}`, borderRadius: radius.card, padding: "12px 14px", outline: "none", fontFamily: font.ui, ...type.body, resize: "vertical", background: color.wine800, color: ink, marginBottom: space.lg, boxSizing: "border-box" }}
              />
              <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: space.xs }}>Attach evidence</p>
              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginBottom: space.sm }}>PNG or PDF, up to 10MB.</p>
              <input ref={fileRef} type="file" accept=".png,.pdf" style={{ display: "none" }} onChange={handleFile} />
              {!attachedFile ? (
                <button onClick={() => fileRef.current.click()} style={{ display: "flex", alignItems: "center", gap: space.sm, background: color.wine800, border: `1px dashed ${color.wine400}`, borderRadius: radius.card, padding: "12px 18px", cursor: "pointer", fontFamily: font.ui, ...type.control, color: ink }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  Choose a file
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: color.wine800, border: `1px solid ${line}`, padding: "10px 14px", borderRadius: radius.card }}>
                  {attachedFile.type.startsWith("image/") ? (
                    <img src={attachedFile.url} alt="Attachment preview" style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "10px" }} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  )}
                  <span style={{ fontFamily: font.ui, ...type.helper, color: inkBody, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} aria-label="Remove file" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: inkMuted, fontSize: "0.95rem" }}>✕</button>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ background: panel, padding: `12px ${space.lg}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
          <p style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, margin: 0, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company.name}</p>
          <div style={{ display: "flex", gap: space.sm, flexShrink: 0 }}>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                style={{ padding: "9px 18px", borderRadius: radius.pill, background: "transparent", color: onPanelDim, border: `1px solid ${onPanelFaint}`, fontFamily: font.ui, ...type.control, cursor: "pointer" }}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => { if (step === 1 && !selected) { setInfoMsg("Pick a concern to continue."); return; } setStep(step + 1); }}
                style={{ padding: "9px 22px", borderRadius: radius.pill, background: color.white, color: ink, border: "none", fontFamily: font.ui, ...type.control, cursor: "pointer" }}
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                style={{ padding: "9px 22px", borderRadius: radius.pill, background: color.white, color: ink, border: "none", fontFamily: font.ui, ...type.control, cursor: "pointer" }}
              >
                Send report
              </button>
            )}
          </div>
        </div>
      </div>
      {infoMsg && <InfoModal message={infoMsg} onClose={() => setInfoMsg(null)} />}
    </div>
  );
};

// ── ChatView ──────────────────────────────────────────────────────────────────
const ChatView = ({ contact, messages, onSend, onBack, onDeleteConversation, onReport }) => {
  const [input, setInput]             = useState("");
  const [attachments, setAttachments] = useState([]);
  const [showInfo, setShowInfo]       = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [editText, setEditText]       = useState("");
  const [popupMsgId, setPopupMsgId]   = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [unsendTarget, setUnsendTarget] = useState(null);
  const [replyTo, setReplyTo]         = useState(null);   // composer reply target
  const [historyMsg, setHistoryMsg]   = useState(null);   // message whose edit history is open
  const [highlightId, setHighlightId] = useState(null);   // message being flashed after a jump
  const [menuAnchor, setMenuAnchor]   = useState(null);   // DOM node the action menu is anchored to
  const flashTimer                    = useRef(null);
  const [showReport, setShowReport]   = useState(false);
  const [infoMsg, setInfoMsg]         = useState(null);
  const bottomRef      = useRef();
  const fileRef        = useRef();
  const infoRef        = useRef();
  const longPressTimer = useRef(null);
  const isMobile       = useIsMobile();
  // Tracks the contact.id we've already done the initial "instant landing"
  // scroll for. Only gets set once messages for that contact have actually
  // loaded (not just switched to) — Firestore delivers messages
  // asynchronously, so switching contact.id and messages populating aren't
  // the same render.
  const scrolledContactId = useRef(null);

  // Runs BEFORE the browser paints — jumps straight to the bottom with no
  // animation the first time a conversation's messages actually load, so the
  // user never sees it start at the top and scroll down. useLayoutEffect
  // (not useEffect) is what makes this happen before paint instead of after.
  useLayoutEffect(() => {
    if (!contact?.id || !messages || messages.length === 0) return;
    if (scrolledContactId.current !== contact.id) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      scrolledContactId.current = contact.id;
    }
  }, [contact?.id, messages]);

  // Smoothly scrolls down for new messages arriving in a conversation
  // that's already fully loaded (not the initial load itself — that's
  // handled above, instantly, to avoid the visible top-then-down flash).
  useEffect(() => {
    if (scrolledContactId.current !== contact?.id) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handler = (e) => {
      if (infoRef.current && !infoRef.current.contains(e.target)) setShowInfo(false);
      if (popupMsgId !== null) { setPopupMsgId(null); setMenuAnchor(null); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popupMsgId]);

  const MAX_ATTACHMENTS = 5;
  const [sending, setSending] = useState(false);
  const handleFile = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const allowed = ["image/png", "application/pdf"];
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) { setInfoMsg(`You can attach up to ${MAX_ATTACHMENTS} files per message.`); e.target.value = ""; return; }
    const next = [];
    let rejected = false;
    for (const file of files.slice(0, room)) {
      if (!allowed.includes(file.type)) { rejected = true; continue; }
      if (file.size > 10 * 1024 * 1024) { rejected = true; continue; }
      next.push({ name: file.name, type: file.type, url: URL.createObjectURL(file), file });
    }
    if (files.length > room) setInfoMsg(`Only ${room} more file(s) could be added (max ${MAX_ATTACHMENTS} per message).`);
    else if (rejected) setInfoMsg("Only PNG and PDF files under 10MB are allowed.");
    if (next.length > 0) setAttachments(prev => [...prev, ...next]);
    e.target.value = "";
  };

  const handleSend = async () => {
    if (sending) return;
    if (!input.trim() && attachments.length === 0) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase().replace(" ", "");
    let uploadedAttachments = null;
    if (attachments.length > 0) {
      setSending(true);
      try {
        const uploaded = await uploadFilesToFolder(attachments.map(a => a.file), "chat_attachments");
        uploadedAttachments = uploaded.map((u, i) => ({ name: u.name, url: u.url, type: attachments[i].type, publicId: u.publicId, resourceType: u.resourceType }));
      } catch (err) {
        console.error("Failed to upload attachments:", err);
        setInfoMsg("The attachment didn't upload. Try again.");
        setSending(false);
        return;
      }
      setSending(false);
    }
    onSend(contact.id, {
      id: Date.now(), sender: "me", text: input.trim(), time: timeStr,
      edited: false, unsent: false, attachments: uploadedAttachments,
      // Viewer-relative sender is normalised back to a uid inside useChat.
      replyTo: replyTo
        ? { id: replyTo.id, sender: replyTo.sender, senderName: replyTo.senderName, text: replyTo.text }
        : null,
    });
    setInput(""); setAttachments([]); setReplyTo(null);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const startLongPress = (e, msg) => {
    if (msg.unsent) return;
    // Anchor the menu to whatever was long-pressed, so the portalled popup
    // still opens next to the message on touch devices.
    const el = e.currentTarget;
    longPressTimer.current = setTimeout(() => {
      setPopupMsgId(prev => {
        const next = prev === msg.id ? null : msg.id;
        setMenuAnchor(next ? el : null);
        return next;
      });
      setEditingId(null);
    }, 500);
  };
  const cancelLongPress = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
  const EDIT_WINDOW_MS  = 15 * 60 * 1000; // messages older than this can no longer be edited
  const canEditMsg      = (msg) => !!msg.text && (Date.now() - (msg.ts || 0)) < EDIT_WINDOW_MS;
  const startEdit       = (msg)   => { if (!canEditMsg(msg)) return; setEditingId(msg.id); setEditText(msg.text); setPopupMsgId(null); };
  const saveEdit        = (msgId) => { if (!editText.trim()) return; onSend(contact.id, { __edit: true, id: msgId, text: editText.trim() }); setEditingId(null); setEditText(""); };
  const handleUnsent    = (msgId) => { setUnsendTarget(msgId); setPopupMsgId(null); };
  const confirmUnsend   = () => { onSend(contact.id, { __unsent: true, id: unsendTarget }); setUnsendTarget(null); };
  const handleDeleteConversation = () => { setShowInfo(false); setShowDeleteConfirm(true); };

  // Reply ------------------------------------------------------------------
  const startReply = (msg) => {
    setReplyTo({
      id: msg.id,
      senderId: msg.senderId,
      sender: msg.sender === "me" ? "me" : "them",
      senderName: msg.sender === "me" ? "You" : (contact.name || "them"),
      text: msg.text || "",
    });
    setPopupMsgId(null); setMenuAnchor(null); setEditingId(null);
  };

  // Jump to the original message and flash it, Messenger-style.
  const jumpToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(msgId);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setHighlightId(null), 1500);
  };
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  const confirmDeleteConversation = () => { onDeleteConversation(contact.id); setShowDeleteConfirm(false); };

  const avatarSize     = isMobile ? 30 : 34;
  // Reserves room for the avatar and the 3-dot button at every width, so a
  // long message can never push the action button off screen.
  const bubbleMaxWidth = isMobile ? "min(78%, calc(100% - 44px))" : "min(56%, calc(100% - 72px))";
  const headerPadding  = isMobile ? "12px 16px" : "14px 24px";
  const inputPadding   = isMobile ? "10px 14px" : "14px 24px";

  const menuItem = { padding: "12px 18px", fontFamily: font.ui, ...type.helper, cursor: "pointer" };

  return (
    <div className="msg-thread" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: page }}>
      <MessagesStyles />

      {/* Header */}
      <div style={{ background: panel, padding: headerPadding, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: space.sm, minWidth: 0 }}>
          <button onClick={onBack} aria-label="Back to chats" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: onPanelDim, padding: "4px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontFamily: font.ui, fontSize: isMobile ? "1rem" : "1.0625rem", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contact.name}</span>
        </div>
        <div ref={infoRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowInfo(v => !v)}
            aria-label="Conversation options"
            style={{ background: "transparent", border: `1px solid ${onPanelFaint}`, borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: onPanel, transition: `background 240ms ${ease}` }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(250,250,250,0.10)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
          {showInfo && (
            <div className="msg-popover" style={{ position: "absolute", top: "40px", right: 0, background: surface, borderRadius: radius.card, border: `1px solid ${line}`, boxShadow: shadow.panel, zIndex: 200, minWidth: "190px", overflow: "hidden" }}>
              <div
                onClick={() => { setShowInfo(false); setShowReport(true); }}
                style={{ ...menuItem, color: inkBody, borderBottom: `1px solid ${lineSoft}` }}
                onMouseEnter={e => e.currentTarget.style.background = lineSoft}
                onMouseLeave={e => e.currentTarget.style.background = surface}
              >
                Report this company
              </div>
              <div
                onClick={handleDeleteConversation}
                style={{ ...menuItem, color: danger, fontWeight: 500 }}
                onMouseEnter={e => e.currentTarget.style.background = lineSoft}
                onMouseLeave={e => e.currentTarget.style.background = surface}
              >
                Delete conversation
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="msg-thread-body" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: space.sm, textAlign: "center", padding: `56px ${space.lg}` }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={inkFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink, margin: 0 }}>No messages yet</p>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "40ch", margin: 0 }}>Send the first message to start this conversation.</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMe        = msg.sender === "me";
          const msgTs       = msg.ts || 0;
          const prevTs      = messages[idx - 1]?.ts || 0;
          const msgTimeStr  = msgTs ? new Date(msgTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (msg.time || "");
          const showTime    = idx === 0 || (msgTs - prevTs) > 10 * 60 * 1000;
          const isPopupOpen = popupMsgId === msg.id;
          const canEdit     = canEditMsg(msg);
          const hasHistory  = Array.isArray(msg.editHistory) && msg.editHistory.length > 0;
          const replyMissing = !!msg.replyTo && !messages.some(m => String(m.id) === String(msg.replyTo.id));
          // Whether this is the very last message in the thread and it's
          // mine — Messenger-style, the send status only shows under that
          // one message, not every message I've sent.
          const isLastMine  = isMe && idx === messages.length - 1 && !msg.unsent;
          const otherReadMs = contact.lastRead?.[contact.id]?.seconds ? contact.lastRead[contact.id].seconds * 1000 : 0;
          const isSeen      = isLastMine && otherReadMs >= msgTs;

          // Anchored to the 3-dot button and portalled to <body>, so it can never
          // be clipped by the thread's overflow or fall off the viewport edge.
          const popupMenu = (
            <AnchoredMenu
              anchorEl={isPopupOpen ? menuAnchor : null}
              open={isPopupOpen && !msg.unsent}
              onClose={() => { setPopupMsgId(null); setMenuAnchor(null); }}
            >
              <MenuItem onClick={() => startReply(msg)} divider={isMe}>Reply</MenuItem>
              {isMe && canEdit && <MenuItem onClick={() => startEdit(msg)} divider>Edit</MenuItem>}
              {isMe && hasHistory && (
                <MenuItem onClick={() => { setHistoryMsg(msg); setPopupMsgId(null); setMenuAnchor(null); }} divider>
                  View edit history
                </MenuItem>
              )}
              {isMe && <MenuItem onClick={() => handleUnsent(msg.id)} tone="danger">Unsend</MenuItem>}
            </AnchoredMenu>
          );

          const kebab = (
            <>
              <button
                onClick={(e) => {
                  const btn = e.currentTarget;
                  setPopupMsgId(prev => {
                    const next = prev === msg.id ? null : msg.id;
                    setMenuAnchor(next ? btn : null);
                    return next;
                  });
                }}
                aria-label="Message options"
                aria-haspopup="menu"
                aria-expanded={isPopupOpen}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: inkFaint, display: "flex", alignItems: "center", lineHeight: 1, flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </button>
              {popupMenu}
            </>
          );

          return (
            <React.Fragment key={msg.id}>
              {showTime && msgTimeStr && (
                <div style={{ textAlign: "center", margin: "14px 0 8px", fontFamily: font.ui, fontSize: "0.75rem", lineHeight: 1.4, color: inkFaint }}>{msgTimeStr}</div>
              )}
              <div
                id={`msg-${msg.id}`}
                className={`msg-row${highlightId === msg.id ? " msg-row-flash" : ""}`}
                style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? "6px" : "10px", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: "4px", maxWidth: "100%", minWidth: 0 }}
              >
                {!isMe && <CompanyAvatar size={avatarSize} />}
                <div style={{ maxWidth: bubbleMaxWidth, minWidth: 0, flex: "0 1 auto", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: "3px", position: "relative" }}>
                  {msg.unsent ? (
                    <div style={{ background: "transparent", border: `1px dashed ${color.wine400}`, borderRadius: isMe ? bubbleMine : bubbleTheirs, padding: "9px 16px", fontFamily: font.ui, ...type.helper, color: inkFaint, userSelect: "none" }}>Message unsent</div>
                  ) : (
                    <>
                      {msg.replyTo && (
                        <ReplyPreview
                          replyTo={msg.replyTo}
                          isMe={isMe}
                          authorName={isMe ? "You" : (contact.name || "They")}
                          missing={replyMissing}
                          onJump={() => jumpToMessage(msg.replyTo.id)}
                        />
                      )}
                      {msg.edited && <EditedTag msg={msg} onClick={() => setHistoryMsg(msg)} />}
                      {msg.text && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: isMe ? "flex-end" : "flex-start", minWidth: 0, maxWidth: "100%", width: "100%" }}>
                          {isMe && kebab}
                          <div
                            onMouseDown={e => startLongPress(e, msg)} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress}
                            onTouchStart={e => startLongPress(e, msg)} onTouchEnd={cancelLongPress} onTouchMove={cancelLongPress}
                            onContextMenu={e => e.preventDefault()}
                            style={{
                              background: isMe ? panel : lineSoft,
                              color: isMe ? onPanel : inkBody,
                              border: isMe ? "none" : `1px solid ${line}`,
                              borderRadius: isMe ? bubbleMine : bubbleTheirs,
                              padding: isMobile ? "9px 13px" : "10px 16px",
                              fontFamily: font.ui, ...type.body,
                              cursor: "pointer", userSelect: "none",
                              boxShadow: (isPopupOpen || editingId === msg.id) ? shadow.focus : "none",
                              transition: `box-shadow 200ms ${ease}`,
                              WebkitUserSelect: "none", WebkitTouchCallout: "none",
                              // Shrinkable: `flex: 0 1 auto` + `min-width: 0` is what stops a
                              // long message from pushing the 3-dot button out of the layout.
                              flex: "0 1 auto", width: "auto", minWidth: 0, maxWidth: "100%", boxSizing: "border-box",
                              overflowWrap: "anywhere", wordBreak: "break-word",
                            }}
                          >
                            {msg.text}
                          </div>
                          {!isMe && kebab}
                        </div>
                      )}
                      {(() => {
                        const attachmentsList = msg.attachments || (msg.attachment ? [msg.attachment] : []);
                        if (attachmentsList.length === 0) return null;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: isMe ? "flex-end" : "flex-start", marginTop: msg.text ? "4px" : "0", minWidth: 0, maxWidth: "100%" }}>
                            {isMe && !msg.text && kebab}
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: isMe ? "flex-end" : "flex-start" }}>
                              {attachmentsList.map((att, ai) => (
                                <div key={ai} onMouseDown={e => startLongPress(e, msg)} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress} onTouchStart={e => startLongPress(e, msg)} onTouchEnd={cancelLongPress} onTouchMove={cancelLongPress} onContextMenu={e => e.preventDefault()}>
                                  <AttachmentBubble attachment={att} isMe={isMe} />
                                </div>
                              ))}
                            </div>
                            {!isMe && !msg.text && kebab}
                          </div>
                        );
                      })()}
                      {isLastMine && <span style={{ fontFamily: font.ui, fontSize: "0.75rem", lineHeight: 1.4, color: inkFaint, marginTop: "2px" }}>{isSeen ? "Seen" : "Sent"}</span>}
                    </>
                  )}
                </div>
                {isMe && <CompanyAvatar size={avatarSize} />}
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {editingId ? (
        /* ── Edit Message Bar ── */
        <div style={{ padding: isMobile ? "10px 14px" : "12px 24px", borderTop: `1px solid ${line}`, background: lineSoft, display: "flex", flexDirection: "column", gap: space.sm, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: font.ui, ...type.label, color: ink }}>Edit message</span>
            <button onClick={() => { setEditingId(null); setEditText(""); }} aria-label="Cancel edit" style={{ background: "none", border: "none", cursor: "pointer", color: inkMuted, fontSize: "0.95rem", lineHeight: 1, padding: "2px" }}>✕</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
            <input
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveEdit(editingId); if (e.key === "Escape") { setEditingId(null); setEditText(""); } }}
              autoFocus
              style={{ flex: 1, background: surface, border: `1px solid ${line}`, borderRadius: radius.pill, padding: isMobile ? "9px 16px" : "10px 18px", fontFamily: font.ui, ...type.body, outline: "none", color: ink, minWidth: 0, boxSizing: "border-box" }}
            />
            <button
              onClick={() => saveEdit(editingId)}
              disabled={!editText.trim()}
              aria-label="Save changes"
              style={{ background: editText.trim() ? panel : color.wine400, border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: editText.trim() ? "pointer" : "not-allowed", flexShrink: 0, transition: `background 240ms ${ease}` }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={onPanel} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Attachment preview */}
          {attachments.length > 0 && (
            <div style={{ padding: isMobile ? "8px 14px" : "10px 24px", background: lineSoft, borderTop: `1px solid ${line}`, display: "flex", alignItems: "center", gap: space.sm, overflowX: "auto" }}>
              {sending && <span style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, flexShrink: 0 }}>Uploading…</span>}
              {attachments.map((att, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, opacity: sending ? 0.6 : 1 }}>
                  {att.type.startsWith("image/") ? (
                    <img src={att.url} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "10px", border: `1px solid ${line}` }} />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", background: surface, border: `1px solid ${line}`, padding: "7px 13px", borderRadius: radius.pill }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span style={{ fontFamily: font.ui, ...type.helper, color: inkBody, maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                    </div>
                  )}
                  <button disabled={sending} onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} aria-label="Remove file" style={{ background: "none", border: "none", color: inkMuted, cursor: sending ? "not-allowed" : "pointer", fontSize: "0.9rem", lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <ReplyComposerBar replyTo={replyTo} isMobile={isMobile} onCancel={() => setReplyTo(null)} />

          {/* Composer */}
          <div style={{ padding: inputPadding, borderTop: `1px solid ${line}`, display: "flex", alignItems: "center", gap: space.sm, background: surface, flexShrink: 0 }}>
            <input ref={fileRef} type="file" accept=".png,.pdf" multiple style={{ display: "none" }} onChange={handleFile} />
            <button onClick={() => fileRef.current.click()} aria-label="Attach a file" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0, padding: "6px", color: inkMuted }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input
              className="msg-composer-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message"
              style={{ flex: 1, background: color.wine800, border: `1px solid ${line}`, borderRadius: radius.pill, padding: isMobile ? "9px 16px" : "10px 18px", fontFamily: font.ui, ...type.body, outline: "none", color: ink, minWidth: 0, boxSizing: "border-box" }}
            />
            <button
              onClick={handleSend}
              disabled={sending}
              aria-label="Send message"
              style={{ background: sending ? color.wine400 : panel, border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: sending ? "not-allowed" : "pointer", flexShrink: 0, boxShadow: shadow.pill, transition: `background 240ms ${ease}` }}
              onMouseEnter={e => { if (!sending) e.currentTarget.style.background = panelDeep; }}
              onMouseLeave={e => { if (!sending) e.currentTarget.style.background = panel; }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={onPanel} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </>
      )}

      {showReport && (
        <ReportModal
          company={contact}
          onClose={() => setShowReport(false)}
          onSubmit={report => { onReport(report); setShowReport(false); }}
        />
      )}

      {showDeleteConfirm && <ConfirmModal message="Delete this conversation? It will be removed for you." confirmLabel="Delete" cancelLabel="Keep" onConfirm={confirmDeleteConversation} onCancel={() => setShowDeleteConfirm(false)} />}
      {unsendTarget && <ConfirmModal message="This message will be unsent for everyone in the chat." confirmLabel="Unsend" cancelLabel="Cancel" onConfirm={confirmUnsend} onCancel={() => setUnsendTarget(null)} />}
      {historyMsg && <EditHistoryModal msg={historyMsg} onClose={() => setHistoryMsg(null)} />}
      {infoMsg && <InfoModal message={infoMsg} onClose={() => setInfoMsg(null)} />}
    </div>
  );
};

// ── Time formatter ────────────────────────────────────────────────────────────
const formatChatTime = (ts) => {
  if (!ts) return "";
  const now  = new Date();
  const date = new Date(ts);
  const diff = now - date;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days < 7)   return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

// ── ChatListView ──────────────────────────────────────────────────────────────
const ChatListView = ({ contacts, messages, onOpen, myUid }) => {
  const [search, setSearch] = useState("");
  const isMobile = useIsMobile();

  const activeContacts = contacts.filter(c => c.convId && (contacts.length > 0));

  const sorted = [...activeContacts].sort((a, b) => {
    const aTs = a.lastMessage?.ts?.seconds
      ? a.lastMessage.ts.seconds * 1000
      : (a.lastMessage?.ts || 0);
    const bTs = b.lastMessage?.ts?.seconds
      ? b.lastMessage.ts.seconds * 1000
      : (b.lastMessage?.ts || 0);
    return bTs - aTs;
  });
  const filtered = sorted.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const unreadCount = sorted.reduce((n, contact) => {
    const msgs   = (messages[contact.convId] || []).filter(m => !m.unsent);
    const lm     = contact.lastMessage;
    const fb     = lm ? { ts: lm.ts?.seconds ? lm.ts.seconds * 1000 : (typeof lm.ts === "number" ? lm.ts : 0), sender: lm.senderId === contact.id ? "them" : "me" } : null;
    const last   = msgs[msgs.length - 1] || fb;
    const readMs = contact.lastRead?.[myUid]?.seconds ? contact.lastRead[myUid].seconds * 1000 : 0;
    return n + ((last && last.sender === "them" && (last.ts || 0) > readMs) ? 1 : 0);
  }, 0);

  return (
    <>
      <MessagesStyles />
      <div className="msg-list msg-list-wrapper" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto", background: page }}>

        {/* Title + search bar */}
        <div className="msg-search-bar" style={{ background: panel, borderRadius: radius.panel, marginBottom: space.lg, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontFamily: font.ui, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel }}>Messages</span>
            <p style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, marginTop: "2px" }}>
              {activeContacts.length === 0
                ? "No conversations yet"
                : unreadCount > 0
                  ? `${unreadCount} unread of ${activeContacts.length} ${activeContacts.length === 1 ? "conversation" : "conversations"}`
                  : `${activeContacts.length} ${activeContacts.length === 1 ? "conversation" : "conversations"}`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, background: color.white, borderRadius: radius.pill, padding: "9px 16px", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              className="msg-search-input"
              style={{ border: "none", background: "transparent", outline: "none", color: ink, fontFamily: font.ui, ...type.control }}
            />
            {search && <button onClick={() => setSearch("")} aria-label="Clear search" style={{ background: "none", border: "none", color: inkMuted, cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>}
          </div>
        </div>

        {/* Conversations */}
        {activeContacts.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 24px", gap: space.sm, textAlign: "center", background: surface, border: `1px dashed ${color.wine400}`, borderRadius: radius.panel }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={inkFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink, margin: 0 }}>No conversations yet</p>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "44ch", margin: 0 }}>Open a company post and choose Message company to start one.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 24px", gap: space.sm, textAlign: "center", background: surface, border: `1px dashed ${color.wine400}`, borderRadius: radius.panel }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={inkFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink, margin: 0 }}>No chats match this search</p>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "44ch", margin: 0 }}>Try a different name, or clear the search to see everyone.</p>
            <button onClick={() => setSearch("")} style={{ marginTop: space.sm, background: panel, color: onPanel, border: "none", borderRadius: radius.pill, padding: "9px 20px", fontFamily: font.ui, ...type.control, cursor: "pointer" }}>Clear search</button>
          </div>
        ) : (
          <div style={{ background: surface, border: `1px solid ${line}`, borderRadius: radius.panel, overflow: "hidden", boxShadow: shadow.input }}>
            {filtered.map((contact, idx) => {
              const msgs    = (messages[contact.convId] || []).filter(m => !m.unsent);
              const lm      = contact.lastMessage;
              const fallback = lm ? {
                text:   lm.text || "",
                ts:     lm.ts?.seconds ? lm.ts.seconds * 1000 : (typeof lm.ts === "number" ? lm.ts : Date.now()),
                sender: lm.senderId === contact.id ? "them" : "me",
              } : null;
              const lastMsg      = msgs[msgs.length - 1] || fallback;
              const lastMsgTs    = lastMsg?.ts || 0;
              const myLastReadMs = contact.lastRead?.[myUid]?.seconds ? contact.lastRead[myUid].seconds * 1000 : 0;
              const isUnread     = !!(lastMsg && lastMsg.sender === "them") && lastMsgTs > myLastReadMs;
              const baseBg       = isUnread ? lineSoft : surface;

              return (
                <div
                  key={contact.id}
                  className="msg-row"
                  onClick={() => onOpen(contact)}
                  style={{
                    display: "flex", alignItems: "center", gap: isMobile ? "10px" : "14px",
                    padding: isMobile ? "13px 16px" : "16px 22px",
                    background: baseBg,
                    borderBottom: idx < filtered.length - 1 ? `1px solid ${lineSoft}` : "none",
                    cursor: "pointer",
                    transition: `background 200ms ${ease}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = field}
                  onMouseLeave={e => e.currentTarget.style.background = baseBg}
                >
                  <CompanyAvatar size={isMobile ? 36 : 42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: space.sm, marginBottom: "2px" }}>
                      <p style={{ fontFamily: font.ui, fontSize: isMobile ? "0.9375rem" : "1rem", fontWeight: isUnread ? 600 : 500, letterSpacing: "-0.01em", color: ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0, flex: 1 }}>{contact.name}</p>
                      <span style={{ fontFamily: font.ui, fontSize: "0.75rem", lineHeight: 1.4, color: isUnread ? inkBody : inkFaint, flexShrink: 0 }}>{formatChatTime(lastMsg?.ts)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
                      {lastMsg ? (
                        <p style={{ fontFamily: font.ui, ...type.helper, color: isUnread ? inkBody : inkMuted, fontWeight: isUnread ? 500 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0, flex: 1 }}>
                          {lastMsg.sender === "me" ? "You: " : ""}
                          {lastMsg.text
                            ? lastMsg.text
                            : (lastMsg.attachments?.length > 1
                                ? `${lastMsg.attachments.length} attachments`
                                : (lastMsg.attachments?.length === 1 || lastMsg.attachment) ? "Attachment" : "")}
                        </p>
                      ) : <span />}
                      {isUnread && <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: ink, flexShrink: 0 }} />}
                    </div>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={inkFaint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

// ─── StudentMessagesScreen ────────────────────────────────────────────────────
const StudentMessagesScreen = ({
  user,               // { uid, name, role: "student" }
  onReportSubmit,
  openContact,        // { id: uid, name, role } — navigate directly to this chat
  onContactOpened,
}) => {
  const {
    contacts, messages, loading,
    openConversation, ensureConversation,
    sendMessage, editMessage, unsendMessage, deleteConversation,
    markConversationRead,
  } = useChat(user?.uid, user?.fullName || user?.name || user?.displayName || "Student", "student");

  const [activeContact, setActiveContact] = useState(null);
  const [showReportSuccess, setShowReportSuccess] = useState(false);
  const [reportError, setReportError] = useState("");

  // Subscribe to messages whenever a contact is opened
  useEffect(() => {
    if (!activeContact?.convId) return;
    openConversation(activeContact.convId);
    markConversationRead(activeContact.convId);
  }, [activeContact, openConversation, markConversationRead]);

  // Handle external openContact (e.g. from Apply / View Applicant)
  useEffect(() => {
    if (!openContact || !user?.uid) return;
    (async () => {
      const convId = await ensureConversation(
        openContact.id,
        openContact.name,
        openContact.role || "company",
      );
      const contact = { id: openContact.id, name: openContact.name, role: openContact.role || "company", convId };
      setActiveContact(contact);
      openConversation(convId);
      markConversationRead(convId);
      if (onContactOpened) onContactOpened();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openContact]);

  // Translate the UI's handleSend signature → Firebase
  const handleSend = async (convId, msgOrAction) => {
    if (msgOrAction.__edit) {
      await editMessage(convId, msgOrAction.id, msgOrAction.text);
    } else if (msgOrAction.__unsent) {
      await unsendMessage(convId, msgOrAction.id);
    } else {
      await sendMessage(convId, { text: msgOrAction.text, attachments: msgOrAction.attachments, replyTo: msgOrAction.replyTo || null });
    }
  };

  const handleDeleteConversation = async (convId) => {
    await deleteConversation(convId);
    setActiveContact(null);
  };

  const handleReport = async (report) => {
    try {
      let uploadedFile = null;
      if (report.attachedFile?.file) {
        uploadedFile = await uploadFileToFolder(report.attachedFile.file, "report_attachments");
      }
      await addDoc(collection(db, "reports"), {
        company:      report.company,
        companyId:    report.companyId || "",
        concern:      report.concern,
        date:         report.date,
        description:  report.description,
        attachedFile: uploadedFile ? { name: uploadedFile.name, url: uploadedFile.url, type: report.attachedFile.type } : null,
        status:       "pending",
        reporterId:   user?.uid || "",
        reporterName: user?.fullName || user?.name || user?.displayName || "",
        reporterRole: "student",
        createdAt:    serverTimestamp(),
      });
      setShowReportSuccess(true);
      if (onReportSubmit) onReportSubmit(report);
    } catch (err) {
      console.error("Failed to submit report:", err);
      setReportError("The report didn't send. Try again.");
    }
  };

  // Adapt contacts/messages shape for existing UI (it uses contact.id and messages[contact.id])
  const uiMessages = {};
  contacts.forEach(c => { uiMessages[c.id] = messages[c.convId] || []; });

  // Re-derive the active contact from the live `contacts` list on every
  // render so `lastRead` (used for the Seen/Sent indicator) stays fresh
  // as the other participant reads the conversation.
  const liveActiveContact = activeContact
    ? (contacts.find(c => c.convId === activeContact.convId) || activeContact)
    : null;

  if (loading) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: page }}>
      <MessagesStyles />
      <p style={{ fontFamily: font.ui, ...type.body, color: inkFaint }}>Loading chats…</p>
    </div>
  );

  if (activeContact) {
    return (
      <>
        <ChatView
          contact={liveActiveContact}
          messages={uiMessages[activeContact.id] || []}
          onSend={(_, msg) => handleSend(activeContact.convId, msg)}
          onBack={() => setActiveContact(null)}
          onDeleteConversation={() => handleDeleteConversation(activeContact.convId)}
          onReport={handleReport}
        />
        {showReportSuccess && <ReportSuccessModal onClose={() => setShowReportSuccess(false)} />}
        {reportError && <InfoModal message={reportError} onClose={() => setReportError("")} />}
      </>
    );
  }

  return (
    <ChatListView
      contacts={contacts}
      messages={uiMessages}
      myUid={user?.uid}
      onOpen={async (c) => {
        const convId = await ensureConversation(c.id, c.name, c.role || "company");
        const contact = { ...c, convId };
        openConversation(convId);
        markConversationRead(convId);
        setActiveContact(contact);
      }}
    />
  );
};

export default StudentMessagesScreen;