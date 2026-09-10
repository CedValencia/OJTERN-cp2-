import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { color, font, type, space, radius, shadow, ease } from "./theme";

// ─────────────────────────────────────────────────────────────────────────────
// Shared message affordances for the three Messages screens
// (Student / Coordinator / Company).
//
// Isa lang ang kopya nito para hindi tatlong beses ma-fix ang parehong bug.
// Lahat ng token galing sa theme.js — walang hardcoded hex dito.
// ─────────────────────────────────────────────────────────────────────────────

const ink      = color.ink;
const inkBody  = color.inkBody;
const inkMuted = color.inkMuted;
const inkFaint = color.inkFaint;
const surface  = color.wine600;
const field    = color.wine700;
const line     = color.wine700;
const lineSoft = color.wine800;
const panel    = color.blush100;
const onPanel  = color.onWine;
const danger   = color.danger;

const GAP = 6;   // space between the 3-dot button and the menu
const PAD = 8;   // minimum distance the menu keeps from the viewport edge

// ── AnchoredMenu ─────────────────────────────────────────────────────────────
// Renders into document.body via a portal, so no `overflow: hidden` on the
// chat body, the message row or any ancestor can ever clip it.
//
// Placement: prefers directly ABOVE the anchor, right-edge aligned (so the
// menu opens toward the left of the button). Falls back to below when there
// isn't room above, and is always clamped inside the viewport horizontally.
export const AnchoredMenu = ({ anchorEl, open, onClose, children }) => {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const el = menuRef.current;
    if (!anchorEl || !el) return;
    const a = anchorEl.getBoundingClientRect();
    const m = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Vertical: above if it fits, otherwise below, otherwise pinned to the
    // bottom edge. Never off-screen either way.
    let top = a.top - m.height - GAP;
    if (top < PAD) {
      const below = a.bottom + GAP;
      top = below + m.height + PAD <= vh ? below : Math.max(PAD, vh - m.height - PAD);
    }

    // Horizontal: right edge of the menu meets the right edge of the button,
    // then clamped so it can never sit under the edge of the screen.
    let left = a.right - m.width;
    left = Math.min(Math.max(PAD, left), Math.max(PAD, vw - m.width - PAD));

    setPos({ top, left });
  }, [anchorEl]);

  // Measure-then-place happens before paint, so the menu never flashes at 0,0.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const reflow = () => place();
    // `true` = capture phase, so scrolling the message list (not just the
    // window) keeps the menu glued to its button.
    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, place, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="msg-popover"
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: pos ? pos.top : 0,
        left: pos ? pos.left : 0,
        visibility: pos ? "visible" : "hidden",
        background: surface,
        borderRadius: radius.card,
        border: `1px solid ${line}`,
        boxShadow: shadow.panel,
        zIndex: 4000,
        minWidth: "150px",
        maxWidth: "min(240px, calc(100vw - 16px))",
        overflow: "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
};

// ── MenuItem ─────────────────────────────────────────────────────────────────
export const MenuItem = ({ onClick, tone = "default", divider = false, children }) => (
  <div
    role="menuitem"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
    style={{
      padding: "10px 16px",
      fontFamily: font.ui,
      ...type.helper,
      color: tone === "danger" ? danger : inkBody,
      fontWeight: tone === "danger" ? 500 : 400,
      cursor: "pointer",
      whiteSpace: "nowrap",
      borderBottom: divider ? `1px solid ${lineSoft}` : "none",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = lineSoft)}
    onMouseLeave={(e) => (e.currentTarget.style.background = surface)}
  >
    {children}
  </div>
);

// ── replyLabel ───────────────────────────────────────────────────────────────
// `replyTo.sender` is viewer-relative ("me" / "them"), normalised in useChat
// exactly the way `msg.sender` already is.
//   - replying to your own message  → "You reply to yourself"
//   - replying to someone else's    → "Your reply to <name>"
export const replyLabel = (replyTo, isMe, authorName) => {
  if (!replyTo) return "";
  const origIsMine = replyTo.sender === "me";

  // Your own reply — the wording specified in the brief.
  if (isMe) {
    return origIsMine ? "You reply to yourself" : `Your reply to ${replyTo.senderName || "them"}`;
  }

  // The other person's reply, read from your side. A 1:1 thread only has two
  // people, so "not mine" here means they replied to their own message.
  const who = authorName || "They";
  return origIsMine ? `${who} replied to you` : `${who} replied to themselves`;
};

const snippet = (text, max = 80) => {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return "Attachment";
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

// ── ReplyPreview ─────────────────────────────────────────────────────────────
// The small quoted strip that sits ABOVE the bubble. Clicking it jumps to the
// original message.
export const ReplyPreview = ({ replyTo, isMe, authorName, onJump, missing }) => {
  if (!replyTo) return null;
  return (
    <button
      type="button"
      onClick={missing ? undefined : onJump}
      aria-label={missing ? "Original message unavailable" : "Go to the original message"}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMe ? "flex-end" : "flex-start",
        gap: "2px",
        maxWidth: "100%",
        minWidth: 0,
        margin: 0,
        padding: "5px 12px",
        background: "transparent",
        border: "none",
        borderLeft: isMe ? "none" : `2px solid ${color.wine400}`,
        borderRight: isMe ? `2px solid ${color.wine400}` : "none",
        textAlign: isMe ? "right" : "left",
        cursor: missing ? "default" : "pointer",
        opacity: missing ? 0.55 : 1,
        font: "inherit",
      }}
    >
      <span style={{ fontFamily: font.ui, fontSize: "0.6875rem", lineHeight: 1.4, color: inkFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
        {replyLabel(replyTo, isMe, authorName)}
      </span>
      <span
        style={{
          fontFamily: font.ui,
          fontSize: "0.75rem",
          lineHeight: 1.45,
          color: inkMuted,
          maxWidth: "100%",
          minWidth: 0,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {missing ? "Original message unavailable" : snippet(replyTo.text)}
      </span>
    </button>
  );
};

// ── ReplyComposerBar ─────────────────────────────────────────────────────────
// Messenger-style "Replying to X" strip above the composer.
export const ReplyComposerBar = ({ replyTo, isMobile, onCancel }) => {
  if (!replyTo) return null;
  const who = replyTo.sender === "me" ? "yourself" : (replyTo.senderName || "them");
  return (
    <div
      style={{
        padding: isMobile ? "8px 14px" : "10px 24px",
        background: lineSoft,
        borderTop: `1px solid ${line}`,
        display: "flex",
        alignItems: "flex-start",
        gap: space.sm,
        flexShrink: 0,
      }}
    >
      <div style={{ width: "2px", alignSelf: "stretch", background: color.wine400, borderRadius: "2px", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
        <span style={{ fontFamily: font.ui, ...type.label, color: ink }}>{`Replying to ${who}`}</span>
        <span
          style={{
            fontFamily: font.ui,
            ...type.helper,
            color: inkMuted,
            minWidth: 0,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {snippet(replyTo.text, 120)}
        </span>
      </div>
      <button
        onClick={onCancel}
        aria-label="Cancel reply"
        style={{ background: "none", border: "none", cursor: "pointer", color: inkMuted, fontSize: "0.95rem", lineHeight: 1, padding: "2px", flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
};

// ── EditedTag ────────────────────────────────────────────────────────────────
// Subtle, and only clickable when there is actually history to show.
export const EditedTag = ({ msg, onClick }) => {
  const hasHistory = Array.isArray(msg.editHistory) && msg.editHistory.length > 0;
  return (
    <span
      role={hasHistory ? "button" : undefined}
      tabIndex={hasHistory ? 0 : undefined}
      onClick={hasHistory ? onClick : undefined}
      onKeyDown={hasHistory ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      title={hasHistory ? "View edit history" : undefined}
      style={{
        fontFamily: font.ui,
        fontSize: "0.75rem",
        lineHeight: 1.4,
        color: inkFaint,
        cursor: hasHistory ? "pointer" : "default",
        textDecoration: hasHistory ? "underline dotted" : "none",
        textUnderlineOffset: "2px",
      }}
    >
      Edited
    </span>
  );
};

// ── EditHistoryModal ─────────────────────────────────────────────────────────
// Versions oldest → newest, with the live text last as the current version.
export const EditHistoryModal = ({ msg, onClose }) => {
  if (!msg) return null;
  const history = Array.isArray(msg.editHistory) ? msg.editHistory : [];
  const versions = [
    ...history.map((h, i) => ({
      label: `Version ${i + 1}`,
      text: h.text,
      at: h.editedAt,
    })),
    { label: `Version ${history.length + 1} · Current`, text: msg.text, at: msg.updatedAt || msg.ts, current: true },
  ];

  const stamp = (v) => {
    if (!v) return "";
    const ms = typeof v === "number" ? v : v?.seconds ? v.seconds * 1000 : (v?.toMillis ? v.toMillis() : 0);
    if (!ms) return "";
    return new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return createPortal(
    <div
      className="msg-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: space.md, zIndex: 5000,
      }}
    >
      <div
        className="msg-dialog msg-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit history"
        style={{
          background: surface, borderRadius: radius.card, border: `1px solid ${line}`,
          boxShadow: shadow.panel, width: "min(420px, 100%)", maxHeight: "min(70vh, 560px)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${lineSoft}`, flexShrink: 0 }}>
          <span style={{ fontFamily: font.ui, ...type.label, color: ink }}>Edit history</span>
          <button onClick={onClose} aria-label="Close edit history" style={{ background: "none", border: "none", cursor: "pointer", color: inkMuted, fontSize: "0.95rem", lineHeight: 1, padding: "2px" }}>✕</button>
        </div>

        <div style={{ padding: "14px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: space.sm }}>
          {versions.map((v, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: space.sm }}>
                <span style={{ fontFamily: font.ui, fontSize: "0.6875rem", lineHeight: 1.4, color: v.current ? inkBody : inkFaint, fontWeight: v.current ? 600 : 400 }}>{v.label}</span>
                {stamp(v.at) && <span style={{ fontFamily: font.ui, fontSize: "0.6875rem", lineHeight: 1.4, color: inkFaint }}>{stamp(v.at)}</span>}
              </div>
              <div
                style={{
                  background: v.current ? panel : field,
                  color: v.current ? onPanel : inkBody,
                  border: v.current ? "none" : `1px solid ${line}`,
                  borderRadius: radius.card,
                  padding: "9px 13px",
                  fontFamily: font.ui,
                  ...type.body,
                  minWidth: 0,
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {v.text}
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <span style={{ fontFamily: font.ui, ...type.helper, color: inkFaint }}>
              No earlier versions were recorded for this message.
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};