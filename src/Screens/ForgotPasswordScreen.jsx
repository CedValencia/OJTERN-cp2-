import React, { useState } from "react";
import { resetPassword } from "./AuthService";

// ─── Color Tokens ────────────────────────────────────────────────────────────
const darkRed = "#320000";
const red = "#8B0000";

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&display=swap');
    * { box-sizing: border-box; }

    .fp-wrapper {
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
      .fp-wrapper { padding: 0 6px; }
    }

    .fp-title {
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
      .fp-title { font-size: 2rem; margin-bottom: 14px; }
    }

    .fp-card {
      border: 2px solid #1a1a1a;
      border-radius: 24px;
      overflow: hidden;
    }

    .fp-card-header {
      background: ${red};
      padding: 14px;
      text-align: center;
    }
    @media (max-width: 360px) {
      .fp-card-header { padding: 10px; }
      .fp-card-header span { font-size: 1rem !important; }
    }

    .fp-card-body {
      padding: 20px 24px 28px;
      background: white;
    }
    @media (max-width: 400px) {
      .fp-card-body { padding: 16px 14px 22px; }
    }

    .fp-input {
      width: 100%;
      padding: 10px 16px;
      background: #590101;
      border: none;
      border-radius: 20px;
      color: white;
      font-size: 0.88rem;
      font-family: 'Kufam', sans-serif;
      margin-bottom: 2px;
      box-sizing: border-box;
    }
    .fp-input::placeholder { color: rgba(255,255,255,0.6); }
    @media (max-width: 360px) {
      .fp-input { font-size: 0.82rem; padding: 9px 14px; }
    }

    .fp-btn {
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
    .fp-btn:disabled { opacity: 0.65; cursor: not-allowed; }
    @media (max-width: 400px) {
      .fp-btn { padding: 10px 36px; font-size: 0.95rem; }
    }
    @media (max-width: 360px) {
      .fp-btn { width: 100%; }
    }
  `}</style>
);

// ─── ForgotPasswordScreen Component ──────────────────────────────────────────
// Props:
//   onSend(email)  — called with the email after Firebase sends the reset link
//   onBack         — navigate back to sign-in
const ForgotPasswordScreen = ({ onBack, onSend }) => {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [sent, setSent]       = useState(false);

  const handleSend = async () => {
    setError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
      onSend?.(email.trim());
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with that email address.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError(err.message || "Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ResponsiveStyles />
      <div className="fp-wrapper">

        <h1 className="fp-title">
          Forgot<br />Password?
        </h1>

        <div className="fp-card">

          <div className="fp-card-header">
            <span style={{
              fontFamily: "'Jua', sans-serif",
              fontSize: "1.2rem",
              color: "white",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1.2,
              display: "block",
            }}>
              Enter Your Email<br />Address!
            </span>
          </div>

          <div className="fp-card-body">

            {sent ? (
              /* ── Success state ── */
              <p style={{
                fontFamily: "'Kufam', sans-serif",
                fontSize: "0.88rem",
                color: "#2a7a2a",
                textAlign: "center",
                marginBottom: "16px",
                lineHeight: 1.6,
              }}>
                ✅ A password reset link has been sent to <strong>{email}</strong>. Check your inbox and follow the link to reset your password.
              </p>
            ) : (
              <>
                <p style={{
                  fontFamily: "'Kufam', sans-serif",
                  fontSize: "0.88rem",
                  color: "#333",
                  textAlign: "center",
                  marginBottom: "16px",
                  lineHeight: 1.6,
                }}>
                  Enter the email address linked to your account. We'll send a password reset link.
                </p>

                <input
                  type="email"
                  placeholder="Enter email address:"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  className="fp-input"
                  style={{ border: error ? "1.5px solid red" : "none" }}
                />

                {error && (
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "red", margin: "4px 0 8px 4px" }}>
                    ⚠️ {error}
                  </p>
                )}
              </>
            )}

            <hr style={{ border: "none", borderTop: "1.5px solid #ddd", margin: "16px 0" }} />

            <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
              {!sent && (
                <button onClick={handleSend} disabled={loading} className="fp-btn">
                  {loading ? "Sending…" : "Send"}
                </button>
              )}
              <button onClick={() => onBack?.()} className="fp-btn" style={{ background: "#555" }}>
                {sent ? "Back to Sign-In" : "Back"}
              </button>
            </div>

          </div>

        </div>
      </div>
    </>
  );
};

export default ForgotPasswordScreen;