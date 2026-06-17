import React, { useState } from "react";
import { resetPassword } from "./AuthService";

const darkRed = "#320000";
const red = "#8B0000";

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&display=swap');
    * { box-sizing: border-box; }

    .fpc-wrapper {
      width: 100%;
      max-width: 370px;
      margin: 0 auto;
      padding: 0 12px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    @media (max-width: 400px) {
      .fpc-wrapper { padding: 0 6px; }
    }

    .fpc-title {
      font-family: 'Jersey 25', sans-serif;
      font-size: 2.6rem;
      font-weight: 400;
      color: #000000;
      text-align: center;
      margin-bottom: 20px;
      line-height: 1.1;
      text-transform: uppercase;
    }
    @media (max-width: 360px) {
      .fpc-title { font-size: 2rem; margin-bottom: 14px; }
    }

    .fpc-card {
      border: 2px solid #1a1a1a;
      border-radius: 24px;
      overflow: hidden;
    }

    .fpc-card-header {
      background: ${red};
      padding: 14px;
      text-align: center;
    }
    @media (max-width: 360px) {
      .fpc-card-header { padding: 10px; }
      .fpc-card-header span { font-size: 1.1rem !important; }
    }

    .fpc-card-body {
      padding: 24px 24px 28px;
      background: white;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    @media (max-width: 400px) {
      .fpc-card-body { padding: 18px 14px 22px; }
    }

    .fpc-btn {
      background: ${darkRed};
      color: white;
      border: none;
      border-radius: 24px;
      padding: 12px 48px;
      font-family: 'Jua', sans-serif;
      font-size: 1.1rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .fpc-btn:disabled { opacity: 0.65; cursor: not-allowed; }
    @media (max-width: 400px) {
      .fpc-btn { padding: 10px 36px; font-size: 0.95rem; }
    }
    @media (max-width: 360px) {
      .fpc-btn { width: 100%; }
    }
  `}</style>
);

// Props:
//   email    — the address the reset link was sent to (passed from SplashScreen)
//   onResend — resend the email
//   onBack   — go back to Sign-In
const ForgotPasswordCodeScreen = ({ email, onResend, onBack }) => {
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendError, setResendError] = useState("");

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

  return (
    <>
      <ResponsiveStyles />
      <div className="fpc-wrapper">

        <h1 className="fpc-title">
          Check Your<br />Email!
        </h1>

        <div className="fpc-card">

          <div className="fpc-card-header">
            <span style={{
              fontFamily: "'Jua', sans-serif",
              fontSize: "1.4rem",
              color: "white",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>
              Reset Link Sent!
            </span>
          </div>

          <div className="fpc-card-body">

            {/* Email icon */}
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📧</div>

            <p style={{
              fontFamily: "'Kufam', sans-serif",
              fontSize: "0.88rem",
              color: "#333",
              textAlign: "center",
              marginBottom: "8px",
              lineHeight: 1.7,
            }}>
              A password reset link has been sent to:
            </p>
            <p style={{
              fontFamily: "'Jua', sans-serif",
              fontSize: "0.95rem",
              color: darkRed,
              textAlign: "center",
              marginBottom: "16px",
              wordBreak: "break-all",
            }}>
              {email || "your email address"}
            </p>

            <p style={{
              fontFamily: "'Kufam', sans-serif",
              fontSize: "0.82rem",
              color: "#555",
              textAlign: "center",
              marginBottom: "4px",
              lineHeight: 1.6,
            }}>
              Open the link in that email to set a new password. The link expires in 1 hour.
            </p>

            {resendMsg && (
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#2a7a2a", textAlign: "center", marginTop: "8px" }}>
                ✅ {resendMsg}
              </p>
            )}
            {resendError && (
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "red", textAlign: "center", marginTop: "8px" }}>
                ⚠️ {resendError}
              </p>
            )}

            <p style={{
              fontFamily: "'Kufam', sans-serif",
              fontSize: "0.82rem",
              color: "#555",
              textAlign: "center",
              margin: "12px 0 4px",
            }}>
              Didn't receive it?{" "}
              <span
                onClick={!resending ? handleResend : undefined}
                style={{
                  color: resending ? "#aaa" : red,
                  textDecoration: "underline",
                  cursor: resending ? "default" : "pointer",
                  fontWeight: "600",
                }}
              >
                {resending ? "Resending…" : "Resend"}
              </span>
            </p>

            <hr style={{ border: "none", borderTop: "1.5px solid #ddd", width: "100%", margin: "16px 0" }} />

            <button onClick={() => onBack?.()} className="fpc-btn">
              Back to Sign-In
            </button>

          </div>

        </div>
      </div>
    </>
  );
};

export default ForgotPasswordCodeScreen;