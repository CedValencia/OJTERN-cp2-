import React, { useState } from "react";
import { changePassword } from "./AuthService";

const darkRed = "#320000";
const red = "#8B0000";

const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&display=swap');
    * { box-sizing: border-box; }
    .rps-wrapper {
      width: 100%; max-width: 370px; margin: 0 auto;
      padding: 0 12px; height: 100%;
      display: flex; flex-direction: column; justify-content: center;
    }
    @media (max-width: 400px) { .rps-wrapper { padding: 0 6px; } }
    .rps-title {
      font-family: 'Jersey 25', sans-serif; font-size: 2.6rem;
      font-weight: 400; color: #000; text-align: center;
      margin-bottom: 20px; line-height: 1.1; text-transform: uppercase;
    }
    @media (max-width: 360px) { .rps-title { font-size: 2rem; margin-bottom: 14px; } }
    .rps-card { border: 2px solid #1a1a1a; border-radius: 24px; overflow: hidden; }
    .rps-card-header { background: ${red}; padding: 14px; text-align: center; }
    @media (max-width: 360px) { .rps-card-header { padding: 10px; } }
    .rps-card-body { padding: 20px 24px 28px; background: white; }
    @media (max-width: 400px) { .rps-card-body { padding: 16px 14px 22px; } }
    .rps-input-wrap { position: relative; margin-bottom: 10px; }
    .rps-input {
      width: 100%; padding: 10px 44px 10px 16px;
      background: #590101; border: none; border-radius: 20px;
      color: white; font-size: 0.88rem;
      font-family: 'Kufam', sans-serif; outline: none;
    }
    .rps-input::placeholder { color: rgba(255,255,255,0.7); }
    .rps-input.error { border: 1.5px solid #ff6b6b; }
    @media (max-width: 360px) { .rps-input { font-size: 0.82rem; padding: 9px 40px 9px 14px; } }
    .rps-eye {
      position: absolute; right: 14px; top: 50%;
      transform: translateY(-50%); cursor: pointer;
      user-select: none; display: flex; align-items: center;
    }
    .rps-divider { border: none; border-top: 1.5px solid #ddd; margin: 16px 0; }
    .rps-btn {
      background: ${darkRed}; color: white; border: none;
      border-radius: 24px; padding: 12px 48px;
      font-family: 'Jua', sans-serif; font-size: 1.1rem;
      letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
    }
    .rps-btn:disabled { opacity: 0.65; cursor: not-allowed; }
    @media (max-width: 400px) { .rps-btn { padding: 10px 36px; font-size: 0.95rem; } }
    @media (max-width: 360px) { .rps-btn { width: 100%; } }
  `}</style>
);

const EyeIcon = ({ show, onClick }) => (
  <span className="rps-eye" onClick={onClick}>
    {show ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )}
  </span>
);

// Props:
//   user       — currentUser object from Firestore (has uid and role)
//   onComplete — called after successful password change → redirect to dashboard
const ResetPasswordScreen = ({ user, onComplete }) => {
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!newPass) { setError("Please enter a new password."); return; }
    if (newPass.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPass !== confirmPass) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const collectionName = user?.role === "coordinator" ? "coordinators" : "students";
      await changePassword(newPass, collectionName, user?.uid);
      onComplete?.();
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        setError("Session expired. Please sign in again.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 8 characters.");
      } else {
        setError(err.message || "Failed to change password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ResponsiveStyles />
      <div className="rps-wrapper">

        <h1 className="rps-title">Change<br />Password</h1>

        <div className="rps-card">
          <div className="rps-card-header">
            <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "1.4rem", color: "white", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Set New Password!
            </span>
          </div>

          <div className="rps-card-body">

            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", textAlign: "center", marginBottom: "16px", lineHeight: 1.6 }}>
              For your security, please change your password before continuing.
            </p>

            <div className="rps-input-wrap">
              <input
                type={showNew ? "text" : "password"}
                placeholder="Enter New Password:"
                value={newPass}
                onChange={e => { setNewPass(e.target.value); setError(""); }}
                className={`rps-input${error ? " error" : ""}`}
              />
              <EyeIcon show={showNew} onClick={() => setShowNew(!showNew)} />
            </div>

            <div className="rps-input-wrap">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm New Password:"
                value={confirmPass}
                onChange={e => { setConfirmPass(e.target.value); setError(""); }}
                className={`rps-input${error ? " error" : ""}`}
              />
              <EyeIcon show={showConfirm} onClick={() => setShowConfirm(!showConfirm)} />
            </div>

            {error && (
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "red", margin: "4px 0 8px 4px" }}>
                ⚠️ {error}
              </p>
            )}

            <hr className="rps-divider" />

            <div style={{ textAlign: "center" }}>
              <button onClick={handleSubmit} disabled={loading} className="rps-btn">
                {loading ? "Saving…" : "Continue"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default ResetPasswordScreen;