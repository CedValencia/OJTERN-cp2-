import React, { useState, useEffect } from "react";
import { signIn } from "./AuthService";

const darkRed = "#320000";
const red = "#8B0000";

// ── useIsMobile ───────────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

const inputStyle = {
  width: "100%",
  padding: "10px 16px",
  background: "#590101",
  border: "none",
  borderRadius: "20px",
  color: "white",
  fontSize: "0.88rem",
  fontFamily: "'Kufam', sans-serif",
  marginBottom: "2px",
};

const labelStyle = {
  display: "block",
  fontFamily: "'Jua', sans-serif",
  fontSize: "1rem",
  fontWeight: "700",
  color: "#000000",
  marginBottom: "4px",
  marginTop: "10px",
};

const EyeIcon = ({ show, onClick }) => (
  <span onClick={onClick} style={{
    position: "absolute", right: "14px", top: "50%",
    transform: "translateY(-50%)", cursor: "pointer",
    userSelect: "none", display: "flex", alignItems: "center",
  }}>
    {show ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )}
  </span>
);

// Props:
//   onGoSignUp           — navigate to company sign-up (signup1)
//   onSignInCoordinator  — called when OJT Coordinator clicks Sign In
//   onSignInStudent      — called when Student clicks Sign In
//   onSignInCompany      — called when Company clicks Sign In
//   onForgotPassword     — called when Forgot Password is clicked
const SignInScreen = ({ onGoSignUp, onSignInCoordinator, onSignInStudent, onSignInCompany, onForgotPassword }) => {
  const [role, setRole]           = useState("coordinator");
  const [showPass, setShowPass]   = useState(false);
  const [email, setEmail]         = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword]   = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading]     = useState(false);
  const isMobile                  = useIsMobile();

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setEmail("");
    setStudentId("");
    setPassword("");
    setShowPass(false);
    setAuthError("");
  };

  // ── Firebase sign-in with role-based Firestore check ─────────────────────
  const handleSignIn = async () => {
    setAuthError("");

    // Basic field check
    if (role === "student" && !studentId.trim()) {
      setAuthError("Please enter your Student ID.");
      return;
    }
    if (role !== "student" && !email.trim()) {
      setAuthError("Please enter your email.");
      return;
    }
    if (!password) {
      setAuthError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const identifier = role === "student" ? studentId : email;

      // ✅ FIXED: signIn called only once
      const { userData } = await signIn(role, identifier, password);

      // ✅ Route based on actual role from Firestore, not UI selection
      const actualRole = userData.role;
      if (actualRole === "coordinator") onSignInCoordinator(userData);
      else if (actualRole === "student") onSignInStudent?.(userData);
      else if (actualRole === "company") onSignInCompany?.(userData);

    } catch (err) {
      setAuthError(err.message || "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { key: "coordinator", label: "OJT Coordinator" },
    { key: "student",     label: "Student"          },
    { key: "company",     label: "Company"           },
  ];

  return (
    <div style={{
      width: "100%",
      maxWidth: isMobile ? "100%" : "370px",
      margin: "0 auto",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: isMobile ? "flex-start" : "center",
      paddingBottom: isMobile ? "1rem" : "0",
    }}>
      <h1 style={{
        fontFamily: "'Jersey 25', sans-serif",
        fontSize: isMobile ? "2rem" : "2.6rem",
        fontWeight: "400",
        color: "#000000",
        textAlign: "center",
        marginBottom: isMobile ? "14px" : "20px",
        lineHeight: 1.1,
        textTransform: "uppercase",
      }}>
        Hi, Welcome<br />Back!
      </h1>

      <div style={{ border: "2px solid #1a1a1a", borderRadius: "24px", overflow: "hidden", position: "relative" }}>
        <div style={{ background: red, padding: isMobile ? "10px" : "14px", textAlign: "center" }}>
          <span style={{ fontFamily: "'Jua', sans-serif", fontSize: isMobile ? "1.2rem" : "1.4rem", color: "white", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Sign-In
          </span>
        </div>

        <div style={{ padding: isMobile ? "12px 16px 20px" : "15px 24px 24px", background: "white" }}>
          <p style={{ fontFamily: "'Jua', sans-serif", textAlign: "center", fontSize: isMobile ? "1.2rem" : "1.5rem", color: "#1a1a1a", marginBottom: "10px" }}>
            Sign-in as:
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? "8px" : "12px", marginBottom: "14px", flexWrap: "wrap" }}>
            {roles.map(r => (
              <label key={r.key} onClick={() => handleRoleChange(r.key)} style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontFamily: "'Kufam', sans-serif", fontSize: isMobile ? "0.76rem" : "0.82rem", color: "#1a1a1a" }}>
                <div style={{
                  width: "18px", height: "18px", borderRadius: "50%",
                  border: `2px solid ${role === r.key ? red : "#888"}`,
                  background: role === r.key ? red : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {role === r.key && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "white" }} />}
                </div>
                {r.label}
              </label>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "12px" }} />

          {role === "student" ? (
            <>
              <label style={labelStyle}>Student ID:</label>
              <input type="text" placeholder="Student ID:" value={studentId} onChange={e => setStudentId(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignIn()} style={inputStyle} />
            </>
          ) : (
            <>
              <label style={labelStyle}>Email:</label>
              <input type="email" placeholder="Enter your Email:" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignIn()} style={inputStyle} />
            </>
          )}

          <label style={labelStyle}>Password:</label>
          <div style={{ position: "relative", marginBottom: "4px" }}>
            <input type={showPass ? "text" : "password"} placeholder="Password:" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignIn()} style={{ ...inputStyle, paddingRight: "44px" }} />
            <EyeIcon show={showPass} onClick={() => setShowPass(!showPass)} />
          </div>

          <div style={{ textAlign: "right", marginBottom: "12px" }}>
            <span
              onClick={() => onForgotPassword?.()}
              style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555", textDecoration: "underline", cursor: "pointer" }}
            >
              Forgot Password?
            </span>
          </div>

          <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "16px" }} />

          {authError && (
            <p style={{
              fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "red",
              textAlign: "center", marginBottom: "10px",
            }}>
              ⚠️ {authError}
            </p>
          )}

          <div style={{ textAlign: "center" }}>
            <button
              onClick={handleSignIn}
              disabled={loading}
              style={{
                background: darkRed, color: "white", border: "none",
                borderRadius: "24px", padding: isMobile ? "10px 36px" : "12px 48px",
                fontFamily: "'Jua', sans-serif", fontSize: isMobile ? "1rem" : "1.1rem",
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </div>

          {role === "company" && (
            <>
              <hr style={{ border: "none", borderTop: "1.5px solid #ddd", margin: "16px 0 25px" }} />
              <p style={{ fontFamily: "'Kufam', sans-serif", textAlign: "center", fontSize: "0.88rem", color: "#555" }}>
                Don't have an account?{" "}
                <span onClick={onGoSignUp} style={{ color: red, textDecoration: "underline", cursor: "pointer", fontWeight: "600" }}>
                  Sign-up
                </span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignInScreen;