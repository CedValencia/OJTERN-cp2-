import React, { useState, useRef, useEffect } from "react";
import userIcon from "../icons/user.png";
import viewIcon from "../icons/view.png";
import { useChat } from "./useChat";

const red     = "#8B0000";
const darkRed = "#590101";

const reportCategories = [
  { label: "Fraud and Scam",         description: "Job scams are fraudulent schemes where scammers impersonate employers to steal money, personal information, or coerce victims into fake work activities.", details: ["Fake job postings requiring payment", "Identity theft", "Misrepresentation of company"] },
  { label: "Discrimination",         description: "Discrimination involves unfair treatment based on race, gender, age, religion, disability, or other protected characteristics.",                          details: ["Racial discrimination", "Gender-based bias", "Age discrimination", "Religious intolerance"] },
  { label: "Sexual Harassment",      description: "Sexual harassment includes any unwelcome sexual advances or other verbal or physical conduct of a sexual nature.",                                       details: ["Unwanted physical contact", "Verbal harassment", "Hostile work environment", "Quid pro quo harassment"] },
  { label: "Harmful Misinformation", description: "Spreading false information about OJT programs, company practices, or student requirements.",                                                           details: ["False program descriptions", "Fake requirements", "Misleading slot information"] },
  { label: "Workplace Misconduct",   description: "Behavior that violates company policies or professional standards, including unsafe working conditions.",                                               details: ["Unsafe working conditions", "Violation of OJT agreement", "Forced overtime", "Unpaid work"] },
  { label: "Others",                 description: "Any other concern not listed above. Please provide a detailed description.",                                                                            details: [] },
];

// ── useIsMobile ───────────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

// ── CompanyAvatar ─────────────────────────────────────────────────────────────
const CompanyAvatar = ({ size = 40 }) => (
  <div style={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <img src={userIcon} alt="user" style={{ width: size, height: size, objectFit: "contain" }} />
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, flexDirection: "column", gap: "16px" }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.5)" }}>
        <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.8)", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={handleDownload} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", padding: "7px 14px", color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: "34px", height: "34px", color: "white", fontSize: "1.1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      </div>
      <img src={src} alt={name} onClick={e => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: "10px", objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }} />
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

  return (
    <>
      <div onClick={handleClick} title={isImage ? "Click to view" : "Click to download"}
        style={{ background: isMe ? darkRed : "#555", borderRadius: "12px", padding: "8px 12px", maxWidth: "220px", cursor: "pointer", userSelect: "none", transition: "opacity 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        {isImage ? (
          <img src={attachment.url} alt={attachment.name} style={{ maxWidth: "180px", maxHeight: "150px", borderRadius: "8px", display: "block" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.15)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "130px" }}>{attachment.name}</p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.68rem", color: "rgba(255,255,255,0.65)", marginTop: "2px" }}>PDF • tap to download</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
        )}
      </div>
      {lightbox && <ImageLightbox src={attachment.url} name={attachment.name} onClose={() => setLightbox(false)} />}
    </>
  );
};

// ── ReportModal ───────────────────────────────────────────────────────────────
const ReportModal = ({ company, onClose, onSubmit }) => {
  const [step, setStep]               = useState(1);
  const [selected, setSelected]       = useState(null);
  const [description, setDescription] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const fileRef  = useRef();
  const isMobile = useIsMobile();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!["image/png", "application/pdf"].includes(file.type)) { alert("Only PNG and PDF files are allowed."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("File must be under 10MB."); return; }
    setAttachedFile({ name: file.name, type: file.type, url: URL.createObjectURL(file) });
  };

  const handleSubmit = () => {
    if (!description.trim()) { alert("Please write a description."); return; }
    onSubmit({ company: company.name, concern: selected?.label || "Others", date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), description, attachedFile });
    onClose();
  };

  const cat = reportCategories.find(c => c.label === selected?.label);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: isMobile ? "12px" : "0" }}>
      <div style={{ background: "white", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: isMobile ? "92vh" : "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eee" }}>
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.5rem", color: darkRed }}>Reports:</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#555" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {step === 1 && (
            <>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "14px" }}>Please select:</p>
              {reportCategories.map((cat) => (
                <div key={cat.label} onClick={() => setSelected(cat)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", border: `2px solid ${red}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: selected?.label === cat.label ? red : "white" }}>
                    {selected?.label === cat.label && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "white" }} />}
                  </div>
                  <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.93rem", color: "#222" }}>{cat.label}</span>
                </div>
              ))}
            </>
          )}
          {step === 2 && cat && (
            <>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: "6px" }}>{cat.label}</p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#666", marginBottom: "12px" }}>More about this reason:</p>
              <hr style={{ borderColor: "#eee", marginBottom: "14px" }} />
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444", lineHeight: 1.7, marginBottom: "14px" }}>{cat.description}</p>
              {cat.details.length > 0 && (<><p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", marginBottom: "8px" }}>Common Types:</p><ul style={{ paddingLeft: "18px" }}>{cat.details.map((d, i) => <li key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.83rem", color: "#555", marginBottom: "4px" }}>{d}</li>)}</ul></>)}
            </>
          )}
          {step === 3 && (
            <>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "10px" }}>Write a description:</p>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue..."
                style={{ width: "100%", minHeight: "100px", border: "none", borderBottom: `2px solid ${red}`, outline: "none", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", resize: "none", background: "transparent", color: "#222", marginBottom: "20px", boxSizing: "border-box" }} />
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "10px" }}>Attach File:</p>
              <input ref={fileRef} type="file" accept=".png,.pdf" style={{ display: "none" }} onChange={handleFile} />
              {!attachedFile ? (
                <div onClick={() => fileRef.current.click()} style={{ width: "80px", height: "80px", background: "#e8c8c8", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f5f5f5", padding: "10px 14px", borderRadius: "8px" }}>
                  {attachedFile.type.startsWith("image/") ? <img src={attachedFile.url} alt="preview" style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px" }} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#555" }}>{attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "1rem" }}>✕</button>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ background: darkRed, padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}>
          {step < 3 ? (
            <button onClick={() => { if (step === 1 && !selected) { alert("Please select a concern."); return; } setStep(step + 1); }} style={{ padding: "8px 20px", borderRadius: "20px", background: "rgba(255,255,255,0.2)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}>Next {step}/3</button>
          ) : (
            <button onClick={handleSubmit} style={{ padding: "8px 20px", borderRadius: "20px", background: "rgba(255,255,255,0.2)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}>Submit report</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── ChatView ──────────────────────────────────────────────────────────────────
const ChatView = ({ contact, messages, onSend, onBack, onDeleteConversation, onReport }) => {
  const [input, setInput]           = useState("");
  const [attachment, setAttachment] = useState(null);
  const [showInfo, setShowInfo]     = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [editText, setEditText]     = useState("");
  const [popupMsgId, setPopupMsgId] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const bottomRef      = useRef();
  const fileRef        = useRef();
  const infoRef        = useRef();
  const longPressTimer = useRef(null);
  const isMobile       = useIsMobile();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const handler = (e) => {
      if (infoRef.current && !infoRef.current.contains(e.target)) setShowInfo(false);
      if (popupMsgId !== null) setPopupMsgId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popupMsgId]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!["image/png", "application/pdf"].includes(file.type)) { alert("Only PNG and PDF files are allowed."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("File must be under 10MB."); return; }
    setAttachment({ name: file.name, type: file.type, url: URL.createObjectURL(file) });
    e.target.value = "";
  };

  const handleSend = () => {
    if (!input.trim() && !attachment) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase().replace(" ", "");
    onSend(contact.id, { id: Date.now(), sender: "me", text: input.trim(), time: timeStr, edited: false, unsent: false, attachment: attachment || null });
    setInput(""); setAttachment(null);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const startLongPress = (e, msg) => {
    if (msg.sender !== "me" || msg.unsent) return;
    longPressTimer.current = setTimeout(() => { setPopupMsgId(prev => prev === msg.id ? null : msg.id); setEditingId(null); }, 500);
  };
  const cancelLongPress = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
  const startEdit       = (msg)   => { if (!msg.text) return; setEditingId(msg.id); setEditText(msg.text); setPopupMsgId(null); };
  const saveEdit        = (msgId) => { if (!editText.trim()) return; onSend(contact.id, { __edit: true, id: msgId, text: editText.trim() }); setEditingId(null); setEditText(""); };
  const handleUnsent    = (msgId) => { onSend(contact.id, { __unsent: true, id: msgId }); setPopupMsgId(null); };
  const handleDeleteConversation = () => { onDeleteConversation(contact.id); setShowInfo(false); };

  const avatarSize     = isMobile ? 30 : 36;
  const bubbleMaxWidth = isMobile ? "75%" : "60%";
  const headerPadding  = isMobile ? "10px 14px" : "14px 20px";
  const msgPadding     = isMobile ? "12px 14px" : "20px 24px";
  const inputPadding   = isMobile ? "8px 12px"  : "12px 20px";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "white" }}>
      {/* Header */}
      <div style={{ background: darkRed, padding: headerPadding, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "12px" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}>
            <svg width={isMobile ? 18 : 20} height={isMobile ? 18 : 20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: isMobile ? "1.2rem" : "1.5rem", color: "white" }}>{contact.name}</span>
        </div>
        <div ref={infoRef} style={{ position: "relative" }}>
          <button onClick={() => setShowInfo(v => !v)} style={{ background: "white", border: "none", borderRadius: "50%", width: isMobile ? "28px" : "32px", height: isMobile ? "28px" : "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={darkRed} stroke={darkRed} strokeWidth="1">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="8" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <line x1="12" y1="12" x2="12" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          {showInfo && (
            <div style={{ position: "absolute", top: "38px", right: 0, background: "white", borderRadius: "10px", boxShadow: "0 4px 20px rgba(0,0,0,0.18)", zIndex: 200, minWidth: "170px", overflow: "hidden" }}>
              <div onClick={handleDeleteConversation} style={{ padding: "12px 18px", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#222", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }} onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"} onMouseLeave={e => e.currentTarget.style.background = "white"}>Delete Conversation</div>
              <div onClick={() => { setShowInfo(false); setShowReport(true); }} style={{ padding: "12px 18px", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: red, fontWeight: 700, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#fff0f0"} onMouseLeave={e => e.currentTarget.style.background = "white"}>Report</div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: msgPadding, display: "flex", flexDirection: "column", gap: "4px" }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#bbb" }}>No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMe        = msg.sender === "me";
          const msgTs       = msg.ts || 0;
          const prevTs      = messages[idx - 1]?.ts || 0;
          const msgTimeStr  = msgTs ? new Date(msgTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (msg.time || "");
          const showTime    = idx === 0 || (msgTs - prevTs) > 10 * 60 * 1000;
          const isPopupOpen = popupMsgId === msg.id;
          const hasText     = !!msg.text;

          return (
            <React.Fragment key={msg.id}>
              {showTime && msgTimeStr && (
                <div style={{ textAlign: "center", margin: "12px 0 6px", fontFamily: "'Kufam', sans-serif", fontSize: isMobile ? "0.7rem" : "0.75rem", color: "#aaa" }}>{msgTimeStr}</div>
              )}
              <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? "6px" : "10px", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: "4px" }}>
                {!isMe && <CompanyAvatar size={avatarSize} />}
                <div style={{ maxWidth: bubbleMaxWidth, display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: "3px", position: "relative" }}>
                  {isPopupOpen && isMe && !msg.unsent && (
                    <div onMouseDown={e => e.stopPropagation()} style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, background: "white", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.18)", zIndex: 100, minWidth: "120px", overflow: "hidden" }}>
                      {hasText && <div onClick={() => startEdit(msg)} style={{ padding: "10px 16px", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#222", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }} onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"} onMouseLeave={e => e.currentTarget.style.background = "white"}>Edit</div>}
                      <div onClick={() => handleUnsent(msg.id)} style={{ padding: "10px 16px", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: red, fontWeight: 700, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#fff0f0"} onMouseLeave={e => e.currentTarget.style.background = "white"}>Unsent</div>
                    </div>
                  )}
                  {msg.unsent ? (
                    <div style={{ background: "transparent", border: "1.5px dashed #bbb", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "9px 16px", fontFamily: "'Kufam', sans-serif", fontSize: isMobile ? "0.78rem" : "0.82rem", color: "#aaa", fontStyle: "italic", userSelect: "none" }}>Unsent Message</div>
                  ) : editingId === msg.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                      <input value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveEdit(msg.id); if (e.key === "Escape") setEditingId(null); }} autoFocus
                        style={{ padding: "8px 14px", borderRadius: "20px", border: `2px solid ${darkRed}`, fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", outline: "none", background: "#fff8f8", minWidth: isMobile ? "140px" : "180px" }} />
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => setEditingId(null)} style={{ padding: "5px 14px", borderRadius: "14px", background: "#eee", color: "#555", border: "none", fontFamily: "'Kufam', sans-serif", fontSize: "0.76rem", cursor: "pointer" }}>Cancel</button>
                        <button onClick={() => saveEdit(msg.id)} style={{ padding: "5px 14px", borderRadius: "14px", background: darkRed, color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontSize: "0.76rem", cursor: "pointer" }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {msg.text && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                          {isMe && (
                            <button onClick={() => setPopupMsgId(prev => prev === msg.id ? null : msg.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "#aaa", fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>⋮</button>
                          )}
                          <div
                            onMouseDown={e => startLongPress(e, msg)} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress}
                            onTouchStart={e => startLongPress(e, msg)} onTouchEnd={cancelLongPress} onTouchMove={cancelLongPress}
                            onContextMenu={e => e.preventDefault()}
                            style={{ background: isMe ? darkRed : "#555", color: "white", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: isMobile ? "8px 12px" : "10px 16px", fontFamily: "'Kufam', sans-serif", fontSize: isMobile ? "0.82rem" : "0.88rem", lineHeight: 1.5, cursor: isMe ? "pointer" : "default", userSelect: "none", outline: isPopupOpen ? "2px solid rgba(255,255,255,0.4)" : "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
                          >
                            {msg.text}
                          </div>
                        </div>
                      )}
                      {msg.attachment && (
                        <div style={{ marginTop: msg.text ? "4px" : "0" }} onMouseDown={e => startLongPress(e, msg)} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress} onTouchStart={e => startLongPress(e, msg)} onTouchEnd={cancelLongPress} onTouchMove={cancelLongPress} onContextMenu={e => e.preventDefault()}>
                          <AttachmentBubble attachment={msg.attachment} isMe={isMe} />
                        </div>
                      )}
                      {msg.edited && <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.68rem", color: "#aaa", marginTop: "2px" }}>edited</span>}
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

      {/* Attachment preview */}
      {attachment && (
        <div style={{ padding: isMobile ? "6px 12px" : "8px 20px", background: "#f9f9f9", borderTop: "1px solid #eee", display: "flex", alignItems: "center", gap: "10px" }}>
          {attachment.type.startsWith("image/") ? (
            <img src={attachment.url} alt="preview" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "6px", border: "1px solid #ddd" }} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f0e0e0", padding: "6px 12px", borderRadius: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: darkRed }}>{attachment.name}</span>
            </div>
          )}
          <button onClick={() => setAttachment(null)} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: inputPadding, borderTop: "1px solid #eee", display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px", background: "#f5f5f5", flexShrink: 0 }}>
        <input ref={fileRef} type="file" accept=".png,.pdf" style={{ display: "none" }} onChange={handleFile} />
        <button onClick={() => fileRef.current.click()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0, padding: "4px" }}>
          <svg width={isMobile ? 22 : 26} height={isMobile ? 22 : 26} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Hello!"
          style={{ flex: 1, background: "#e8e8e8", border: "none", borderRadius: "24px", padding: isMobile ? "8px 14px" : "10px 18px", fontFamily: "'Kufam', sans-serif", fontSize: isMobile ? "0.85rem" : "0.9rem", outline: "none", color: "#222", minWidth: 0 }} />
        <button onClick={handleSend} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0, padding: "4px" }}>
          <svg width={isMobile ? 22 : 26} height={isMobile ? 22 : 26} viewBox="0 0 24 24" fill="none" stroke={darkRed} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>

      {showReport && <ReportModal company={contact} onClose={() => setShowReport(false)} onSubmit={report => { onReport(report); setShowReport(false); }} />}
    </div>
  );
};

// ── ChatListView ──────────────────────────────────────────────────────────────

// ── Time formatter (Messenger-style) ─────────────────────────────────────────
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

const ChatListView = ({ contacts, messages, onOpen, readConvIds }) => {
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      <div style={{ margin: isMobile ? "14px 14px 0" : "20px 24px 0", background: darkRed, borderRadius: "14px", overflow: "hidden" }}>
        <div style={{ padding: isMobile ? "12px 16px" : "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: isMobile ? "1.5rem" : "1.8rem", color: "white" }}>Chats</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", borderRadius: "24px", padding: isMobile ? "5px 12px" : "7px 16px", flex: isMobile ? 1 : "unset", maxWidth: isMobile ? "unset" : "220px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <div style={{ width: "2px", height: "16px", background: "rgba(0,0,0,0.2)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
              style={{ border: "none", background: "transparent", outline: "none", fontFamily: "'Jersey 25'", fontSize: isMobile ? "1rem" : "1.2rem", color: "#333", width: "100%", minWidth: 0 }} />
          </div>
        </div>
        <div style={{ background: "#e8e8e8", maxHeight: isMobile ? "55vh" : "320px", overflowY: "auto" }}>
          {filtered.length === 0 && activeContacts.length === 0 && <div style={{ padding: "24px", textAlign: "center" }}><p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#aaa" }}>No conversations yet.</p></div>}
          {filtered.length === 0 && activeContacts.length > 0 && <div style={{ padding: "24px", textAlign: "center" }}><p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#aaa" }}>No results for "{search}"</p></div>}
          {filtered.map((contact, idx) => {
            const msgs    = (messages[contact.convId] || []).filter(m => !m.unsent);
            const lm      = contact.lastMessage;
            const fallback = lm ? {
              text:   lm.text || "",
              ts:     lm.ts?.seconds ? lm.ts.seconds * 1000 : (typeof lm.ts === "number" ? lm.ts : Date.now()),
              sender: lm.senderId === contact.id ? "them" : "me",
            } : null;
            const lastMsg = msgs[msgs.length - 1] || fallback;
            const isUnread = !!(lastMsg && lastMsg.sender === "them") && !readConvIds.has(contact.convId);
            return (
              <div key={contact.id} onClick={() => onOpen(contact)}
                style={{ display: "flex", alignItems: "center", gap: isMobile ? "10px" : "14px", padding: isMobile ? "10px 14px" : "13px 20px", background: isUnread ? "#f0e8e8" : "#e0e0e0", borderBottom: idx < filtered.length - 1 ? "1px solid #d0d0d0" : "none", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#d4d4d4"}
                onMouseLeave={e => e.currentTarget.style.background = isUnread ? "#f0e8e8" : "#e0e0e0"}
              >
                <CompanyAvatar size={isMobile ? 34 : 40} />
                <div style={{ width: "1px", height: "32px", background: "#bbb", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                    <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: isUnread ? 800 : 700, fontSize: isMobile ? "0.85rem" : "0.92rem", color: isUnread ? "#590101" : "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0, flex: 1 }}>{contact.name}</p>
                    <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: isUnread ? "#8B0000" : "#aaa", flexShrink: 0, marginLeft: "6px", fontWeight: isUnread ? 700 : 400 }}>{formatChatTime(lastMsg?.ts)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {lastMsg ? (
                      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.76rem", color: isUnread ? "#590101" : "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: isUnread ? 700 : 400, margin: 0, flex: 1 }}>
                        {lastMsg.sender === "me" ? "You: " : ""}
                        {lastMsg.text ? lastMsg.text : lastMsg.attachment ? "📎 Attachment" : ""}
                      </p>
                    ) : <span />}
                    {isUnread && <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#8B0000", flexShrink: 0, marginLeft: "6px" }} />}
                  </div>
                </div>
                <img src={viewIcon} alt="view" style={{ width: "35px", height: "35px", objectFit: "contain", flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ padding: isMobile ? "16px 14px" : "20px 24px" }}>
        {activeContacts.length > 0 && <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#aaa", textAlign: "center" }}>No more available chats!</p>}
      </div>
    </div>
  );
};

// ── Main CoordinatorMessagesScreen ────────────────────────────────────────────
const CoordinatorMessagesScreen = ({
  user,               // { uid, name, role: "coordinator" }
  onReportSubmit,
  openContact,        // { id: uid, name, role }
  onContactOpened,
}) => {
  const {
    contacts, messages, loading,
    openConversation, ensureConversation,
    sendMessage, editMessage, unsendMessage, deleteConversation,
  } = useChat(user?.uid, user?.name || "Coordinator", "coordinator");

  const [activeContact, setActiveContact] = useState(null);
  const [readConvIds, setReadConvIds]     = useState(new Set());

  useEffect(() => {
    if (!activeContact?.convId) return;
    openConversation(activeContact.convId);
  }, [activeContact, openConversation]);

  useEffect(() => {
    if (!openContact || !user?.uid) return;
    (async () => {
      const convId = await ensureConversation(
        openContact.id,
        openContact.name,
        openContact.role || "student",
      );
      const contact = { id: openContact.id, name: openContact.name, role: openContact.role || "student", convId };
      setReadConvIds(prev => new Set([...prev, contact.convId]));
      setActiveContact(contact);
      openConversation(convId);
      if (onContactOpened) onContactOpened();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openContact]);

  const handleSend = async (convId, msgOrAction) => {
    if (msgOrAction.__edit)        await editMessage(convId, msgOrAction.id, msgOrAction.text);
    else if (msgOrAction.__unsent) await unsendMessage(convId, msgOrAction.id);
    else await sendMessage(convId, { text: msgOrAction.text, attachment: msgOrAction.attachment });
  };

  const handleDeleteConversation = async (convId) => {
    await deleteConversation(convId);
    setActiveContact(null);
  };

  const handleReport = (report) => { if (onReportSubmit) onReportSubmit(report); };

  const uiMessages = {};
  contacts.forEach(c => { uiMessages[c.id] = messages[c.convId] || []; });

  if (loading) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontFamily: "'Kufam', sans-serif", color: "#aaa" }}>Loading chats…</p>
    </div>
  );

  if (activeContact) {
    return (
      <ChatView
        contact={activeContact}
        messages={uiMessages[activeContact.id] || []}
        onSend={(_, msg) => handleSend(activeContact.convId, msg)}
        onBack={() => setActiveContact(null)}
        onDeleteConversation={() => handleDeleteConversation(activeContact.convId)}
        onReport={handleReport}
      />
    );
  }

  return (
    <ChatListView
      contacts={contacts}
      messages={uiMessages}
      readConvIds={readConvIds}
      onOpen={async (c) => {
        const convId = await ensureConversation(c.id, c.name, c.role || "student");
        const contact = { ...c, convId };
        openConversation(convId);
        setReadConvIds(prev => new Set([...prev, contact.convId]));
      setActiveContact(contact);
      }}
    />
  );
};

export default CoordinatorMessagesScreen;