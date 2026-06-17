import React from "react";
import checkIcon from "../icons/check.png";

// ─── Color Tokens ─────────────────────────────────────────────────────────────
const darkRed = "#320000";
const red = "#8B0000";

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&display=swap');
    * { box-sizing: border-box; }

    /* ── Outer wrapper ── */
    .prss-wrapper {
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
      .prss-wrapper { padding: 0 6px; }
    }

    /* ── Card border ── */
    .prss-card {
      border: 2px solid #1a1a1a;
      border-radius: 24px;
      overflow: hidden;
    }

    /* ── Card header ── */
    .prss-card-header {
      background: ${red};
      padding: 14px;
      text-align: center;
    }
    @media (max-width: 360px) {
      .prss-card-header { padding: 10px; }
      .prss-card-header span { font-size: 1.1rem !important; }
    }

    /* ── Card body ── */
    .prss-card-body {
      padding: 32px 24px 28px;
      background: white;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    @media (max-width: 400px) {
      .prss-card-body { padding: 24px 14px 22px; }
    }

    /* ── Success icon ── */
    .prss-icon {
      width: 64px;
      height: 64px;
      object-fit: contain;
      margin-bottom: 20px;
    }
    @media (max-width: 360px) {
      .prss-icon { width: 52px; height: 52px; margin-bottom: 16px; }
    }

    /* ── Divider ── */
    .prss-divider {
      border: none;
      border-top: 1.5px solid #ddd;
      width: 100%;
      margin-bottom: 16px;
    }
    .prss-divider-bottom {
      border: none;
      border-top: 1.5px solid #ddd;
      width: 100%;
      margin-bottom: 20px;
    }

    /* ── Confirmation message ── */
    .prss-message {
      font-family: 'Kufam', sans-serif;
      font-size: 0.88rem;
      color: #333;
      text-align: center;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    @media (max-width: 360px) {
      .prss-message { font-size: 0.82rem; }
    }

    /* ── Sign-In button ── */
    .prss-btn {
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
    @media (max-width: 400px) {
      .prss-btn { padding: 10px 36px; font-size: 0.95rem; }
    }
    @media (max-width: 360px) {
      .prss-btn { width: 100%; }
    }
  `}</style>
);

// ─── PasswordResetSuccessScreen Component ─────────────────────────────────────
const PasswordResetSuccessScreen = ({ onSignIn }) => {
  return (
    <>
      <ResponsiveStyles />
      <div className="prss-wrapper">

        {/* ── Card Container ── */}
        <div className="prss-card">

          {/* ── Card Header ── */}
          <div className="prss-card-header">
            <span style={{
              fontFamily: "'Jua', sans-serif",
              fontSize: "1.4rem",
              color: "white",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>
              Password Reset!
            </span>
          </div>

          {/* ── Card Body ── */}
          <div className="prss-card-body">

            {/* ── Success Icon ── */}
            <img
              src={checkIcon}
              alt="Success"
              className="prss-icon"
            />

            {/* ── Divider ── */}
            <hr className="prss-divider" />

            {/* ── Confirmation Message ── */}
            <p className="prss-message">
              Your password has been reset successfully.
            </p>

            {/* ── Divider ── */}
            <hr className="prss-divider-bottom" />

            {/* ── Sign-In Button ── */}
            <button onClick={() => onSignIn?.()} className="prss-btn">
              Sign-In
            </button>

          </div>
          {/* ── End Card Body ── */}

        </div>
        {/* ── End Card Container ── */}

      </div>
      {/* ── End Page Wrapper ── */}
    </>
  );
};

export default PasswordResetSuccessScreen;