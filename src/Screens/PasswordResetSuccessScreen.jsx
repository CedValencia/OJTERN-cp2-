import React from "react";
import { color, ease, font } from "./theme";

// ── Hover-swap style for the primary button, same pattern as the other
//    screens in this auth flow. ──────────────────────────────────────────────
const SuccessScreenStyles = () => (
  <style>{`
    .prss-btn {
      background: linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%);
      color: ${color.ink};
      transition: background 160ms ${ease}, color 160ms ${ease};
    }
    .prss-btn:hover:not(:disabled) {
      background: #898989;
      color: ${color.white};
    }
  `}</style>
);

// Same stroke-icon language as the rest of this flow — a checkmark instead
// of the imported PNG, so it inherits color.success rather than shipping a
// separate fixed-color asset.
const CheckIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color.success} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 12.5 9.5 18 20 6" />
  </svg>
);

// Props:
//   onSignIn — called when the person taps through to sign in again
const PasswordResetSuccessScreen = ({ onSignIn }) => {
  // Bare content only — no own panel, no own header/card chrome. The parent
  // (SplashScreen) already supplies the dark rectangular panel for this flow,
  // same as ForgotPasswordScreen and ForgotPasswordCodeScreen.
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontFamily: font.ui }}>
      <SuccessScreenStyles />

      <span
        aria-hidden="true"
        style={{
          width: "56px", height: "56px", borderRadius: "50%",
          background: color.white,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "18px",
        }}
      >
        <CheckIcon />
      </span>

      <h1 style={{
        fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.02em",
        lineHeight: 1.15, color: color.onWine, margin: 0,
      }}>
        Password Reset!
      </h1>

      <p style={{ fontSize: "0.9375rem", color: color.onWineMuted, lineHeight: 1.5, margin: "12px 0 4px" }}>
        Your password has been reset successfully.
      </p>

      <hr style={{ border: "none", borderTop: "1.5px solid rgba(255,255,255,0.15)", width: "100%", margin: "24px 0" }} />

      <button onClick={() => onSignIn?.()} className="ojt-pill prss-btn" style={{
        width: "auto", height: "52px", padding: "0 44px",
        border: "none", borderRadius: "999px",
        fontSize: "0.9375rem", fontWeight: 700, letterSpacing: "0.02em",
        cursor: "pointer",
        boxShadow: "0 6px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(0,0,0,0.04)",
      }}>
        Sign In
      </button>
    </div>
  );
};

export default PasswordResetSuccessScreen;