import React, { useState, useEffect, useRef } from "react";
import { signIn, logOut, applyEmailVerification } from "./AuthService";
import { color, ease, radius, shadow } from "./theme";

// ── useIsMobile ───────────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

// ── Hover-swap styles for toggle & primary buttons ─────────────────────────
const SignInStyles = () => (
  <style>{`
    .si-toggle-btn {
      background: transparent;
      color: ${color.onWineMuted};
      transition: background 160ms ${ease}, color 160ms ${ease};
    }
    .si-toggle-btn--active {
      background: ${color.ink};
      color: ${color.white};
    }
    .si-toggle-btn--active:hover {
      background: #898989;
      color: ${color.ink};
    }
    .si-signin-btn {
      background: linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%);
      color: ${color.ink};
      transition: background 160ms ${ease}, color 160ms ${ease};
    }
    .si-signin-btn:hover:not(:disabled) {
      background: #898989;
      color: ${color.white};
    }
  `}</style>
);

// ── Icons ────────────────────────────────────────────────────────────────────
const Ico = ({ d, children }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {children ?? <path d={d} />}
  </svg>
);

const UserIcon = () => (
  <Ico><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></Ico>
);
const MailIcon = () => (
  <Ico><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="m3.5 6.5 8.5 6 8.5-6" /></Ico>
);
const LockIcon = () => (
  <Ico><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></Ico>
);

// The pale circular badge each field carries on its left, as in the comps.
// Sits on the dark panel now, so the badge itself stays light for contrast.
const FieldIcon = ({ children }) => (
  <span
    aria-hidden="true"
    style={{
      position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
      width: "30px", height: "30px", borderRadius: "50%",
      background: color.wine400, color: color.inkMuted,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
    }}
  >
    {children}
  </span>
);

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
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )}
  </button>
);

// Props:
//   role                 — which sign-in form to show; owned by SplashScreen's
//                          role pills. Falls back to internal state if absent.
//   onRoleChange         — notify the parent when the role changes here
//   onGoSignUp           — switch to company sign-up
//   onSignInCoordinator  — called when OJT Coordinator clicks Sign In
//   onSignInStudent      — called when Student clicks Sign In
//   onSignInCompany      — called when Company clicks Sign In
//   onForgotPassword     — called when Forgot Password is clicked
const SignInScreen = ({ role: roleProp, onRoleChange, onGoSignUp, onSignInCoordinator, onSignInStudent, onSignInCompany, onForgotPassword }) => {
  const [role, setRole]           = useState(roleProp ?? "coordinator");
  const [showPass, setShowPass]   = useState(false);
  const [email, setEmail]         = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword]   = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading]     = useState(false);
  const [focused, setFocused]     = useState("");
  const [verifyStatus, setVerifyStatus] = useState(null); // { ok: boolean, message: string } | null
  const isMobile                  = useIsMobile();

  // This screen is the `continueUrl` on the "Activate" button in the company
  // approval email (see functions/index.js sendApprovalEmail). Because this
  // Firebase project has a custom Action URL configured (see AuthService.js —
  // resetPasswordInApp's docstring explains the same thing for password
  // reset), clicking that link lands DIRECTLY here with
  // `?mode=verifyEmail&oobCode=...` in the URL — Firebase's own hosted
  // verification page never runs, so nothing actually applies the code unless
  // we do it ourselves, right here, on mount.
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const mode    = params.get("mode");
    const oobCode = params.get("oobCode");
    if (mode !== "verifyEmail" || !oobCode) return;

    applyEmailVerification(oobCode)
      .then(() => setVerifyStatus({ ok: true, message: "Your account has been activated! You can now sign in below." }))
      .catch(err => setVerifyStatus({ ok: false, message: err.message }));

    // Strip the query params so refreshing this page doesn't try to reapply
    // an oobCode that's already been used (Firebase action codes are single-use).
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setEmail("");
    setStudentId("");
    setPassword("");
    setShowPass(false);
    setAuthError("");
    onRoleChange?.(newRole);
  };

  // The panel pills (in SplashScreen) are the source of truth when a role
  // prop is supplied. Switching there clears the form exactly as the old
  // radio group did.
  const prevRoleProp = useRef(roleProp);
  useEffect(() => {
    if (roleProp == null || roleProp === prevRoleProp.current) return;
    prevRoleProp.current = roleProp;
    setRole(roleProp);
    setEmail("");
    setStudentId("");
    setPassword("");
    setShowPass(false);
    setAuthError("");
  }, [roleProp]);

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

      const { userData } = await signIn(role, identifier, password);

      // Defense-in-depth: only route to the dashboard matching the role the
      // user actually selected in this form. AuthService.signIn already checks
      // this, but we never want this screen to silently redirect someone to a
      // different dashboard than the one they clicked, even if signIn's own
      // check were ever bypassed by a future bug elsewhere.
      const actualRole = userData.role;
      if (actualRole !== role) {
        await logOut();
        const label = role === "coordinator" ? "OJT Coordinator" : role.charAt(0).toUpperCase() + role.slice(1);
        setAuthError(`This account is not registered as a ${label}.`);
        return;
      }

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

  const roleLabel = roles.find(r => r.key === role)?.label ?? "";

  const inputStyle = (name) => ({
    width: "100%",
    height: "52px",
    padding: "0 16px 0 50px",
    background: color.white,
    border: `1.5px solid ${focused === name ? color.ink : "transparent"}`,
    borderRadius: radius.field,
    color: color.ink,
    fontSize: "0.9375rem",
    fontWeight: 400,
    outline: "none",
    transition: `border-color 160ms ${ease}`,
  });

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
      <SignInStyles />

      <h1 style={{
        fontSize: isMobile ? "1.75rem" : "2rem",
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: 1.15,
        color: color.onWine,
        margin: 0,
      }}>
        Sign In
      </h1>
      <p style={{
        fontSize: "0.9375rem",
        color: color.onWineMuted,
        lineHeight: 1.5,
        margin: "8px 0 26px",
      }}>
        Welcome back. Signing in as <span style={{ color: color.onWine, fontWeight: 600 }}>{roleLabel}</span>.
      </p>

      {verifyStatus && (
        <div
          role="status"
          style={{
            display: "flex", alignItems: "flex-start", gap: "9px",
            background: verifyStatus.ok ? "rgba(90,117,96,0.14)" : "rgba(168,84,80,0.14)",
            border: `1px solid ${verifyStatus.ok ? color.success : color.danger}`,
            borderRadius: "14px",
            padding: "11px 13px",
            margin: "0 0 18px",
            fontSize: "0.8125rem", lineHeight: 1.45,
            color: verifyStatus.ok ? color.success : color.danger,
          }}
        >
          <span>{verifyStatus.ok ? "✅" : "⚠️"}</span>
          <span>{verifyStatus.message}</span>
        </div>
      )}

      {/* Role selector — only rendered when this screen owns the choice.
          When SplashScreen passes a role prop, the panel pills replace this. */}
      {roleProp == null && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "22px" }}>
          {roles.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => handleRoleChange(r.key)}
              className={`si-toggle-btn${role === r.key ? " si-toggle-btn--active" : ""}`}
              style={{
                flex: 1, padding: "11px 8px", borderRadius: radius.pill, cursor: "pointer",
                fontSize: "0.8125rem", fontWeight: role === r.key ? 600 : 500,
                border: `1.5px solid ${role === r.key ? "transparent" : color.blush300}`,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {role === "student" ? (
          <div style={{ position: "relative" }}>
            <FieldIcon><UserIcon /></FieldIcon>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Student ID"
              placeholder="Student ID"
              value={studentId}
              onChange={e => setStudentId(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleSignIn()}
              onFocus={() => setFocused("studentId")}
              onBlur={() => setFocused("")}
              style={inputStyle("studentId")}
            />
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <FieldIcon><MailIcon /></FieldIcon>
            <input
              type="email"
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSignIn()}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused("")}
              style={inputStyle("email")}
            />
          </div>
        )}

        <div style={{ position: "relative" }}>
          <FieldIcon><LockIcon /></FieldIcon>
          <input
            type={showPass ? "text" : "password"}
            aria-label="Password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSignIn()}
            onCopy={e => e.preventDefault()}
            onCut={e => e.preventDefault()}
            onPaste={e => e.preventDefault()}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused("")}
            style={{ ...inputStyle("password"), paddingRight: "50px" }}
          />
          <EyeIcon show={showPass} onClick={() => setShowPass(!showPass)} />
        </div>
      </div>

      <div style={{ textAlign: "right", marginTop: "12px" }}>
        <button
          type="button"
          onClick={() => onForgotPassword?.()}
          style={{
            background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
            fontSize: "0.8125rem", fontWeight: 600, color: color.onWine,
          }}
        >
          Forgot password?
        </button>
      </div>

      {authError && (
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "flex-start", gap: "9px",
            background: color.white,
            border: `1px solid ${color.blush300}`,
            borderRadius: "14px",
            padding: "11px 13px",
            margin: "14px 0 0",
            fontSize: "0.8125rem", lineHeight: 1.45, color: color.danger,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: "1px" }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{authError}</span>
        </div>
      )}

      <button
        onClick={handleSignIn}
        disabled={loading}
        className="ojt-pill si-signin-btn"
        style={{
          width: "100%", height: "52px", marginTop: "22px",
          border: "none", borderRadius: radius.pill,
          fontSize: "1rem", fontWeight: 600, letterSpacing: "0.02em",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.65 : 1,
          boxShadow: "0 6px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(0,0,0,0.04)",
        }}
      >
        {loading ? "Signing in…" : "SIGN IN"}
      </button>

      {role === "company" && (
        <p style={{ textAlign: "center", fontSize: "0.875rem", color: color.onWineMuted, margin: "18px 0 0" }}>
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onGoSignUp}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: "0.875rem", fontWeight: 700, color: color.onWine,
            }}
          >
            Sign up
          </button>
        </p>
      )}
    </div>
  );
};

export default SignInScreen;