import React, { useState, useEffect } from "react";
import { verifyResetCode, confirmReset } from "./AuthService";

import logo from "../icons/ojtern.png";

const red     = "#8B0000";
const darkRed = "#590101";
const fieldBg = "#7A4F4F";

const fieldStyle = {
  width: "100%", padding: "10px 16px",
  background: fieldBg, border: "none", borderRadius: "20px",
  color: "white", fontSize: "0.88rem",
  fontFamily: "'Kufam', sans-serif", outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  fontFamily: "'Kufam', sans-serif",
  fontWeight: 700, fontSize: "0.88rem",
  color: "#222", marginBottom: "4px", display: "block",
};

const EyeIcon = ({ show, onClick }) => (
  <span onClick={onClick} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", display: "flex", alignItems: "center" }}>
    {show ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )}
  </span>
);

const PASSWORD_RULES = [
  { key: "length",    label: "At least 8 characters",                     test: pwd => pwd.length >= 8 },
  { key: "uppercase", label: "At least one uppercase letter (A–Z)",       test: pwd => /[A-Z]/.test(pwd) },
  { key: "lowercase", label: "At least one lowercase letter (a–z)",       test: pwd => /[a-z]/.test(pwd) },
  { key: "number",    label: "At least one number (0–9)",                 test: pwd => /[0-9]/.test(pwd) },
  { key: "special",   label: "At least one special character (!@#$%&*_…)", test: pwd => /[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(pwd) },
  { key: "noSpaces",  label: "No spaces",                                 test: pwd => !/\s/.test(pwd) },
];

const isPasswordStrong = (pwd) => PASSWORD_RULES.every(rule => rule.test(pwd));

const PasswordChecklist = ({ password }) => {
  if (!password) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", margin: "2px 0 12px 2px" }}>
      {PASSWORD_RULES.map(rule => {
        const passed = rule.test(password);
        return (
          <div key={rule.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: passed ? "#2a7a2a" : "#c0392b", width: "12px", flexShrink: 0 }}>
              {passed ? "✓" : "✗"}
            </span>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.74rem", color: passed ? "#2a7a2a" : "#888" }}>
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const PasswordInput = ({ value, onChange, onKeyDown, placeholder = "••••••••" }) => {
  const [show, setShow] = useState(false);
  const blockPaste = (e) => e.preventDefault();

  return (
    <div style={{ position: "relative", marginBottom: "2px" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onPaste={blockPaste}
        onCopy={blockPaste}
        onCut={blockPaste}
        placeholder={placeholder}
        style={{ ...fieldStyle, paddingRight: "44px" }}
      />
      <EyeIcon show={show} onClick={() => setShow((s) => !s)} />
    </div>
  );
};

// ─── ResetPasswordScreen Component ───────────────────────────────────────────
// Props:
//   oobCode          — Firebase reset code parsed from the email link's URL
//   onBack           — go back to ForgotPasswordScreen (e.g. to request a new link)
const ResetPasswordScreen = ({ oobCode, onBack }) => {
  const [verifying, setVerifying]             = useState(true);
  const [verifiedEmail, setVerifiedEmail]      = useState("");
  const [verifyError, setVerifyError]          = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors]                   = useState({});
  const [saving, setSaving]                   = useState(false);
  const [saveError, setSaveError]             = useState("");
  const [success, setSuccess]                 = useState(false);

  // Verify the link's oobCode as soon as this screen loads — this is what
  // catches expired/invalid/already-used links before showing the form.
  useEffect(() => {
    if (!oobCode) {
      setVerifyError("This password reset link is missing required information.");
      setVerifying(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const emailForCode = await verifyResetCode(oobCode);
        if (!cancelled) setVerifiedEmail(emailForCode);
      } catch (err) {
        if (!cancelled) setVerifyError(err.message || "This password reset link is invalid or has expired.");
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();
    return () => { cancelled = true; };
  }, [oobCode]);

  const validate = () => {
    const e = {};
    if (!isPasswordStrong(newPassword)) e.newPassword = "Password does not meet all the requirements below.";
    if (newPassword !== confirmPassword) e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaveError("");
    setSaving(true);
    try {
      await confirmReset(oobCode, newPassword);
      setSuccess(true);
    } catch (err) {
      setSaveError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    // Redirect to sign-in
    window.location.href = "/signin";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !saving) handleSave();
  };

  return (
    <div style={{
      width: "100vw", minHeight: "100vh",
      background: "linear-gradient(180deg, #A32424 0%, #320000 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: "440px",
        background: "white", borderRadius: "18px",
        padding: "32px 28px", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" }}>
          <img src={logo} alt="OJTern Logo" style={{ width: "64px", height: "64px", objectFit: "contain", marginBottom: "4px" }} />
          <span style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "1.6rem", color: darkRed, letterSpacing: "0.03em" }}>OJTern</span>
        </div>

        {verifying ? (
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#555", textAlign: "center" }}>
            Verifying your reset link…
          </p>
        ) : verifyError ? (
          <>
            <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "8px", textAlign: "center" }}>
              Invalid or Expired Link
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", textAlign: "center", marginBottom: "20px" }}>
              {verifyError}
            </p>
            <button
              onClick={() => onBack?.()}
              style={{
                width: "100%", padding: "12px", borderRadius: "20px",
                background: red, color: "white", border: "none",
                fontFamily: "'Kufam', sans-serif", fontWeight: 700,
                fontSize: "0.9rem", cursor: "pointer"
              }}
            >
              Request a New Link
            </button>
          </>
        ) : !success ? (
          <>
            <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "8px", textAlign: "center" }}>
              Reset Password
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", textAlign: "center", marginBottom: "20px" }}>
              Resetting password for <strong>{verifiedEmail}</strong>.
            </p>

            {/* New Password */}
            <label style={{ ...labelStyle, marginTop: "14px" }}>New Password:</label>
            <PasswordInput 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              onKeyDown={handleKeyDown} 
            />
            {errors.newPassword && (
              <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>
                ⚠️ {errors.newPassword}
              </p>
            )}
            <PasswordChecklist password={newPassword} />

            {/* Confirm Password */}
            <label style={{ ...labelStyle, marginTop: "10px" }}>Confirm New Password:</label>
            <PasswordInput 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              onKeyDown={handleKeyDown} 
            />
            {errors.confirmPassword && (
              <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>
                ⚠️ {errors.confirmPassword}
              </p>
            )}

            {saveError && (
              <p style={{ color: "red", fontSize: "0.8rem", fontFamily: "'Kufam', sans-serif", textAlign: "center", marginTop: "12px" }}>
                ⚠️ {saveError}
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ 
                  flex: 1, padding: "12px", borderRadius: "20px", 
                  background: red, color: "white", border: "none", 
                  fontFamily: "'Kufam', sans-serif", fontWeight: 700, 
                  fontSize: "0.9rem", cursor: saving ? "not-allowed" : "pointer", 
                  opacity: saving ? 0.7 : 1 
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => onBack?.()}
                style={{ 
                  flex: 1, padding: "12px", borderRadius: "20px", 
                  background: "#555", color: "white", border: "none", 
                  fontFamily: "'Kufam', sans-serif", fontWeight: 700, 
                  fontSize: "0.9rem", cursor: "pointer" 
                }}
              >
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "8px", textAlign: "center" }}>
              Password Reset!
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", textAlign: "center", marginBottom: "20px" }}>
              Your password has been successfully changed. You can now sign in with your new password.
            </p>
            <button
              onClick={handleContinue}
              style={{ 
                width: "100%", padding: "12px", borderRadius: "20px", 
                background: red, color: "white", border: "none", 
                fontFamily: "'Kufam', sans-serif", fontWeight: 700, 
                fontSize: "0.9rem", cursor: "pointer" 
              }}
            >
              Continue to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordScreen;