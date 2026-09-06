import React, { useState, useEffect } from "react";
import { verifyResetCode, confirmReset } from "./AuthService";
import { color, ease, font } from "./theme";

// ── Hover-swap styles for the primary/secondary buttons, same pattern as
//    the rest of this auth flow. ─────────────────────────────────────────────
const ResetPasswordStyles = () => (
  <style>{`
    .rp-primary-btn {
      background: linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%);
      color: ${color.ink};
      transition: background 160ms ${ease}, color 160ms ${ease};
    }
    .rp-primary-btn:hover:not(:disabled) {
      background: #898989;
      color: ${color.white};
    }
    .rp-secondary-btn {
      background: transparent;
      color: ${color.onWineMuted};
      border: 1.5px solid rgba(255,255,255,0.25);
      transition: background 160ms ${ease}, color 160ms ${ease};
    }
    .rp-secondary-btn:hover:not(:disabled) {
      background: rgba(255,255,255,0.08);
      color: ${color.onWine};
    }
  `}</style>
);

// Same lock stroke icon as SignInScreen's LockIcon.
const LockIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

// Same pale circular badge used across this flow.
const FieldIcon = ({ children }) => (
  <span
    aria-hidden="true"
    style={{
      position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
      width: "30px", height: "30px", borderRadius: "50%",
      background: color.white, color: color.ink,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
    }}
  >
    {children}
  </span>
);

// Same eye toggle as SignInScreen's EyeIcon, recolored for a dark stroke on
// the now-white field (the original used a white stroke for a dark field).
const EyeIcon = ({ show, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={show ? "Hide password" : "Show password"}
    style={{
      position: "absolute", right: "8px", top: "50%",
      transform: "translateY(-50%)", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "34px", height: "34px",
      background: "transparent", border: "none", borderRadius: "50%",
      color: color.inkMuted, padding: 0,
    }}
  >
    {show ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )}
  </button>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "8px 0 4px 2px" }}>
      {PASSWORD_RULES.map(rule => {
        const passed = rule.test(password);
        return (
          <div key={rule.key} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: passed ? color.success : color.danger, width: "12px", flexShrink: 0 }}>
              {passed ? "✓" : "✗"}
            </span>
            <span style={{ fontFamily: font.ui, fontSize: "0.78rem", color: passed ? color.success : color.onWineMuted }}>
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const PasswordInput = ({ value, onChange, onKeyDown, focused, name, onFocus, onBlur, placeholder = "Password" }) => {
  const [show, setShow] = useState(false);
  const blockPaste = (e) => e.preventDefault();

  return (
    <div style={{ position: "relative" }}>
      <FieldIcon><LockIcon /></FieldIcon>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onPaste={blockPaste}
        onCopy={blockPaste}
        onCut={blockPaste}
        placeholder={placeholder}
        style={{
          width: "100%", height: "54px", padding: "0 50px 0 54px",
          background: color.white,
          border: `1.5px solid ${focused === name ? color.ink : "transparent"}`,
          borderRadius: "999px", color: color.ink, fontSize: "0.9375rem",
          fontWeight: 400, outline: "none", transition: `border-color 160ms ${ease}`,
        }}
      />
      <EyeIcon show={show} onClick={() => setShow((s) => !s)} />
    </div>
  );
};

// Props:
//   oobCode — Firebase reset code parsed from the email link's URL
//   onBack  — go back to ForgotPasswordScreen (e.g. to request a new link)
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
  const [focused, setFocused]                 = useState("");

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
    window.location.href = "/signin";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !saving) handleSave();
  };

  const heading = { fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: color.onWine, margin: 0 };
  const subhead = { fontSize: "0.9375rem", color: color.onWineMuted, lineHeight: 1.5, margin: "8px 0 26px" };
  const primaryBtn = {
    width: "auto", height: "52px", padding: "0 44px",
    border: "none", borderRadius: "999px",
    fontSize: "0.9375rem", fontWeight: 700, letterSpacing: "0.02em",
    boxShadow: "0 6px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(0,0,0,0.04)",
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", fontFamily: font.ui }}>
      <ResetPasswordStyles />

      {verifying ? (
        <p style={{ fontSize: "0.9375rem", color: color.onWineMuted, textAlign: "center", margin: "8px 0" }}>
          Verifying your reset link…
        </p>

      ) : verifyError ? (
        <div style={{ textAlign: "center" }}>
          <h1 style={heading}>Invalid or expired link</h1>
          <p style={subhead}>{verifyError}</p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button onClick={() => onBack?.()} className="ojt-pill rp-primary-btn" style={{ ...primaryBtn, cursor: "pointer" }}>
              Request a new link
            </button>
          </div>
        </div>

      ) : !success ? (
        <div>
          <h1 style={heading}>Reset password</h1>
          <p style={subhead}>
            Resetting password for <span style={{ color: color.onWine, fontWeight: 600 }}>{verifiedEmail}</span>.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <PasswordInput
              name="newPassword"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              focused={focused}
              onFocus={() => setFocused("newPassword")}
              onBlur={() => setFocused("")}
              placeholder="New password"
            />
            {errors.newPassword && (
              <p style={{ color: color.danger, fontSize: "0.8125rem", margin: "0 0 0 2px" }}>{errors.newPassword}</p>
            )}
            <PasswordChecklist password={newPassword} />

            <PasswordInput
              name="confirmPassword"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              focused={focused}
              onFocus={() => setFocused("confirmPassword")}
              onBlur={() => setFocused("")}
              placeholder="Confirm new password"
            />
            {errors.confirmPassword && (
              <p style={{ color: color.danger, fontSize: "0.8125rem", margin: "0 0 0 2px" }}>{errors.confirmPassword}</p>
            )}
          </div>

          {saveError && (
            <p style={{ color: color.danger, fontSize: "0.8125rem", textAlign: "center", margin: "14px 0 0" }}>{saveError}</p>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "center" }}>
            <button
              onClick={() => onBack?.()}
              className="ojt-pill rp-secondary-btn"
              style={{ height: "52px", padding: "0 32px", borderRadius: "999px", fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "0.02em", cursor: "pointer" }}
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="ojt-pill rp-primary-btn"
              style={{ ...primaryBtn, opacity: saving ? 0.65 : 1, cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

      ) : (
        <div style={{ textAlign: "center" }}>
          <h1 style={heading}>Password reset!</h1>
          <p style={subhead}>
            Your password has been successfully changed. You can now sign in with your new password.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button onClick={handleContinue} className="ojt-pill rp-primary-btn" style={{ ...primaryBtn, cursor: "pointer" }}>
              Continue to sign in
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResetPasswordScreen;