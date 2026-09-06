import React, { useState } from "react";
import { resetPassword } from "./AuthService";
import { color, ease, font } from "./theme";

// ── Hover-swap style for the primary button, same pattern as the other
//    auth screens in this flow. ──────────────────────────────────────────────
const CodeScreenStyles = () => (
  <style>{`
    .fpc-btn {
      background: linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%);
      color: ${color.ink};
      transition: background 160ms ${ease}, color 160ms ${ease};
    }
    .fpc-btn:hover:not(:disabled) {
      background: #898989;
      color: ${color.white};
    }
  `}</style>
);

// Same stroke-icon style as MailIcon in ForgotPasswordScreen / SignInScreen.
const MailIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color.inkMuted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="m3.5 6.5 8.5 6 8.5-6" />
  </svg>
);

// Props:
//   email    — the address the reset link was sent to (passed from SplashScreen)
//   onResend — resend the email
//   onBack   — go back to Sign-In. If omitted, falls back to a direct
//              redirect to /signin, matching the other screens in this flow.
const ForgotPasswordCodeScreen = ({ email, onResend, onBack }) => {
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendError, setResendError] = useState("");

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = "/signin";
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResendMsg("");
    setResendError("");
    setResending(true);
    try {
      await resetPassword(email);
      setResendMsg("Reset link resent! Check your inbox.");
      onResend?.();
    } catch (err) {
      if (err.code === "auth/too-many-requests") {
        setResendError("Too many attempts. Please wait a moment.");
      } else {
        setResendError("Failed to resend. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  // Bare content only — no own panel, no own Back button. The parent
  // (SplashScreen) already supplies the dark rectangular panel and the Back
  // pill above it for this flow, same as ForgotPasswordScreen.
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontFamily: font.ui }}>
      <CodeScreenStyles />

      <span
        aria-hidden="true"
        style={{
          width: "56px", height: "56px", borderRadius: "50%",
          background: color.wine400,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "18px",
        }}
      >
        <MailIcon />
      </span>

      <h1 style={{
        fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.02em",
        lineHeight: 1.15, color: color.onWine, margin: 0,
      }}>
        Check Your Email!
      </h1>

      <p style={{ fontSize: "0.9375rem", color: color.onWineMuted, lineHeight: 1.5, margin: "12px 0 4px" }}>
        A password reset link has been sent to:
      </p>
      <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: color.onWine, lineHeight: 1.5, margin: "0 0 16px", wordBreak: "break-all" }}>
        {email || "your email address"}
      </p>

      <p style={{ fontSize: "0.8125rem", color: color.onWineMuted, lineHeight: 1.6, margin: "0 0 4px" }}>
        Open the link in that email to set a new password. The link expires in 1 hour.
      </p>

      {resendMsg && (
        <p style={{ fontSize: "0.8125rem", color: color.success, margin: "8px 0 0" }}>{resendMsg}</p>
      )}
      {resendError && (
        <p style={{ fontSize: "0.8125rem", color: color.danger, margin: "8px 0 0" }}>{resendError}</p>
      )}

      <p style={{ fontSize: "0.8125rem", color: color.onWineMuted, margin: "16px 0 4px" }}>
        Didn't receive it?{" "}
        <span
          onClick={!resending ? handleResend : undefined}
          style={{
            textDecoration: "underline", fontWeight: 600,
            cursor: resending ? "default" : "pointer",
            color: resending ? color.onWineMuted : color.onWine,
          }}
        >
          {resending ? "Resending…" : "Resend"}
        </span>
      </p>

      <hr style={{ border: "none", borderTop: `1.5px solid rgba(255,255,255,0.15)`, width: "100%", margin: "20px 0" }} />

      <button onClick={handleBack} className="ojt-pill fpc-btn" style={{
        width: "auto", height: "52px", padding: "0 44px",
        border: "none", borderRadius: "999px",
        fontSize: "0.9375rem", fontWeight: 700, letterSpacing: "0.02em",
        cursor: "pointer",
        boxShadow: "0 6px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(0,0,0,0.04)",
      }}>
        Back to Sign-In
      </button>
    </div>
  );
};

export default ForgotPasswordCodeScreen;