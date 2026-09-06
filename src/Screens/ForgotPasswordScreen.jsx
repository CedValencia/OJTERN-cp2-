import React, { useState } from "react";
import { resetPassword } from "./AuthService";
import { color, ease, font } from "./theme";

// ── Hover-swap style for the continue button, mirrored from SignInScreen ────
const ForgotPasswordStyles = () => (
  <style>{`
    .fp-continue-btn {
      background: linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%);
      color: ${color.ink};
      transition: background 160ms ${ease}, color 160ms ${ease};
    }
    .fp-continue-btn:hover:not(:disabled) {
      background: #898989;
      color: ${color.white};
    }
  `}</style>
);

const MailIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="m3.5 6.5 8.5 6 8.5-6" />
  </svg>
);

// Same pale circular badge used in SignInScreen's FieldIcon.
const FieldIcon = ({ children }) => (
  <span
    aria-hidden="true"
    style={{
      position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
      width: "30px", height: "30px", borderRadius: "50%",
      background: color.wine400, color: color.inkMuted,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
    }}
  >
    {children}
  </span>
);

// Props:
//   onProceed(email) — called with email to move to reset password screen
const ForgotPasswordScreen = ({ onProceed }) => {
  const [email, setEmail]     = useState("");
  const [error, setError]     = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleProceed = async () => {
    setError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      await resetPassword(email.trim());
      onProceed?.(email.trim());
    } catch (err) {
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Fully-rounded pill field (radius = half the height), not the mildly-
  // rounded rectangle sign-in uses — this screen's field is a true pill.
  const inputStyle = {
    width: "100%",
    height: "54px",
    padding: "0 20px 0 54px",
    background: color.white,
    border: `1.5px solid ${focused ? color.ink : (error ? color.danger : "transparent")}`,
    borderRadius: "999px",
    color: color.ink,
    fontSize: "0.9375rem",
    fontWeight: 400,
    outline: "none",
    transition: `border-color 160ms ${ease}`,
  };

  // The parent (SplashScreen) already renders the outer black panel AND its
  // own "Back" button for this screen — confirmed by the live app showing a
  // duplicated panel-in-a-panel and two Back buttons when this component also
  // rendered its own copies of both. So, same as SignInScreen, this component
  // now returns bare content only: no page wrapper, no panel div, no Back
  // button. It relies entirely on the parent for those.
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", fontFamily: font.ui }}>
      <ForgotPasswordStyles />

      <h1 style={{
        fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.02em",
        lineHeight: 1.15, color: color.onWine, margin: 0,
      }}>
        Forgot Password?
      </h1>
      <p style={{
        fontSize: "0.9375rem", color: color.onWineMuted, lineHeight: 1.5,
        margin: "8px 0 26px",
      }}>
        Enter the email address linked to your account. We'll help you reset your password.
      </p>

      <div style={{ position: "relative" }}>
        <FieldIcon><MailIcon /></FieldIcon>
        <input
          type="email"
          aria-label="Email"
          placeholder="Email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleProceed()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={inputStyle}
        />
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "flex-start", gap: "9px",
            background: color.white,
            border: `1px solid ${color.blush300}`,
            borderRadius: "14px",
            padding: "11px 13px",
            margin: "14px 0 0",
            fontSize: "0.8125rem", lineHeight: 1.45, color: color.danger,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: "1px" }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <button
          onClick={handleProceed}
          disabled={sending}
          className="ojt-pill fp-continue-btn"
          style={{
            width: "auto", height: "52px", marginTop: "28px",
            padding: "0 44px",
            border: "none", borderRadius: "999px",
            fontSize: "0.9375rem", fontWeight: 700, letterSpacing: "0.02em",
            cursor: sending ? "not-allowed" : "pointer",
            opacity: sending ? 0.65 : 1,
            boxShadow: "0 6px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(0,0,0,0.04)",
          }}
        >
          {sending ? "Sending…" : "CONTINUE"}
        </button>
      </div>
    </div>
  );
};

export default ForgotPasswordScreen;