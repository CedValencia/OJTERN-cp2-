import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getCoordinatorInvite, acceptCoordinatorInvite } from "./AuthService";

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

// Same rules/component used on Reset Password (CoordinatorAccountProfileScreen.jsx)
// — kept identical here so the password bar is consistent everywhere a
// coordinator sets one.
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

// Password field with show/hide toggle and paste/copy/cut disabled (must be
// typed, not pasted from elsewhere).
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

// Wording that differs between a Transfer Account invite and an Add Account
// invite — everything else about this screen (fields, validation, submit
// flow) is identical for both.
const INVITE_COPY = {
  transfer: (invite) => (
    <>
      <strong>{invite.fromName}</strong> is transferring their OJT Coordinator account to <strong>{invite.toEmail}</strong>. Set up your account below to accept.
    </>
  ),
  add: (invite) => (
    <>
      <strong>{invite.fromName}</strong> is inviting you to join OJTern as an additional OJT Coordinator. Set up your account below to accept.
    </>
  ),
};

// Accept-invitation screen shared by the Transfer Account and Add Account
// flows. Reached via the "Accept Invitation" link emailed by
// sendCoordinatorInviteEmail (Cloud Function) — expects
// ?id=<inviteId>&token=<token> in the URL.
const AcceptCoordinatorInviteScreen = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inviteId = searchParams.get("id");
  const token    = searchParams.get("token");

  const [status, setStatus]     = useState("loading"); // loading | ready | invalid | success
  const [invite, setInvite]     = useState(null);
  const [loadError, setLoadError] = useState("");

  const [name, setName]               = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!inviteId || !token) {
      setStatus("invalid");
      setLoadError("This invitation link is missing required information.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getCoordinatorInvite(inviteId, token);
        if (cancelled) return;
        setInvite(data);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || "This invitation could not be verified.");
        setStatus("invalid");
      }
    })();
    return () => { cancelled = true; };
  }, [inviteId, token]);

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Your full name is required.";
    if (!isPasswordStrong(password)) e.password = "Password does not meet all the requirements below.";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      await acceptCoordinatorInvite(inviteId, token, name, password);
      setStatus("success");
    } catch (err) {
      setSubmitError(err.message || "Failed to accept the invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !submitting) handleSubmit();
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

        {status === "loading" && (
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#555", textAlign: "center" }}>
            Verifying your invitation…
          </p>
        )}

        {status === "invalid" && (
          <>
            <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "8px", textAlign: "center" }}>
              Invalid or Expired Invitation
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", textAlign: "center", marginBottom: "20px" }}>
              {loadError}
            </p>
            <button
              onClick={() => navigate("/signin")}
              style={{ width: "100%", padding: "12px", borderRadius: "20px", background: red, color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}
            >
              Go to Sign In
            </button>
          </>
        )}

        {status === "success" && (
          <>
            <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "8px", textAlign: "center" }}>
              You're All Set!
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", textAlign: "center", marginBottom: "20px" }}>
              Your OJT Coordinator account has been created. You can now sign in with your email and the password you just set.
            </p>
            <button
              onClick={() => navigate("/signin")}
              style={{ width: "100%", padding: "12px", borderRadius: "20px", background: red, color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}
            >
              Go to Sign In
            </button>
          </>
        )}

        {status === "ready" && invite && (
          <>
            <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: red, marginBottom: "8px", textAlign: "center" }}>
              Coordinator Invitation
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", textAlign: "center", marginBottom: "20px" }}>
              {(INVITE_COPY[invite.type] || INVITE_COPY.add)(invite)}
            </p>

            <label style={labelStyle}>Full Name:</label>
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Full Name" style={{ ...fieldStyle, marginBottom: "2px" }} />
            {errors.name && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.name}</p>}

            <label style={{ ...labelStyle, marginTop: "10px" }}>Set Password:</label>
            <PasswordInput value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} />
            {errors.password && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.password}</p>}
            <PasswordChecklist password={password} />

            <label style={{ ...labelStyle, marginTop: "10px" }}>Confirm Password:</label>
            <PasswordInput value={confirmPassword} onChange={e => setConfirm(e.target.value)} onKeyDown={handleKeyDown} />
            {errors.confirmPassword && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.confirmPassword}</p>}

            {submitError && (
              <p style={{ color: "red", fontSize: "0.8rem", fontFamily: "'Kufam', sans-serif", textAlign: "center", marginTop: "12px" }}>
                ⚠️ {submitError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ width: "100%", padding: "12px", borderRadius: "20px", background: red, color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, marginTop: "18px" }}
            >
              {submitting ? "Setting Up Account…" : "Accept & Create Account"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptCoordinatorInviteScreen;