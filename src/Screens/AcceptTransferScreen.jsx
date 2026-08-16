import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getCoordinatorTransferInvite, acceptCoordinatorTransfer } from "./AuthService";

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

// Accept-invitation screen for the coordinator handoff flow. Reached via the
// "Accept Invitation" link emailed by sendCoordinatorTransferInviteEmail
// (Cloud Function) — expects ?id=<inviteId>&token=<token> in the URL.
const AcceptTransferScreen = () => {
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
        const data = await getCoordinatorTransferInvite(inviteId, token);
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
    if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      await acceptCoordinatorTransfer(inviteId, token, name, password);
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
              <strong>{invite.fromName}</strong> is transferring their OJT Coordinator account to <strong>{invite.toEmail}</strong>. Set up your account below to accept.
            </p>

            <label style={labelStyle}>Full Name:</label>
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Full Name" style={{ ...fieldStyle, marginBottom: "2px" }} />
            {errors.name && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.name}</p>}

            <label style={{ ...labelStyle, marginTop: "10px" }}>Set Password:</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="••••••••" style={{ ...fieldStyle, marginBottom: "2px" }} />
            {errors.password && <p style={{ color: "red", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", marginBottom: "6px" }}>{errors.password}</p>}

            <label style={{ ...labelStyle, marginTop: "10px" }}>Confirm Password:</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirm(e.target.value)} onKeyDown={handleKeyDown} placeholder="••••••••" style={{ ...fieldStyle, marginBottom: "2px" }} />
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

export default AcceptTransferScreen;