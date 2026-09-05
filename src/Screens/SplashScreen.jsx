import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { checkAndReactivateCompany } from "./AuthService";
import InfoMenu from "./InfoMenu";
import LegalDocScreen from "./LegalDocScreen";
import AboutUsScreen from "./AboutUsScreen";
import { TERMS_TEXT, PRIVACY_TEXT } from "./legalContent";

import SignInScreen               from "./SignInScreen";
import ForgotPasswordScreen       from "./ForgotPasswordScreen";
import ForgotPasswordCodeScreen   from "./ForgotPasswordCodeScreen";
import ResetPasswordScreen        from "./ResetPasswordScreen";
import SignUpStep1Screen          from "./SignUpStep1Screen";
import SignUpStep2Screen          from "./SignUpStep2Screen";
import CoordinatorDashboardScreen from "./CoordinatorDashboardScreen";
import CompanyDashboardScreen     from "./CompanyDashboardScreen";
import StudentDashboardScreen     from "./StudentDashboardScreen";
import CoordinatorFindCompanyScreen from "./CoordinatorFindCompanyScreen";
import AcceptCoordinatorInviteScreen from "./AcceptCoordinatorInviteScreen";

import {
  color, font, ease, timing, stageGeom,
  wineField, capsules, capsuleAngle, radius, shadow,
} from "./theme";

import logo from "../icons/ojtern.png";

export const ROLES = [
  { key: "coordinator", label: "Coordinator" },
  { key: "student",     label: "Student"     },
  { key: "company",     label: "Company"     },
];

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

const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&family=Monomaniac+One&display=swap');

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: ${color.wine900};
      color: ${color.ink};
    }

    body, input, select, textarea, button {
      font-family: ${font.ui};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    input:focus, select:focus, button:focus, a:focus { outline: none; }
    input:focus-visible,
    select:focus-visible,
    button:focus-visible,
    a:focus-visible,
    [role="button"]:focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
    }

    ::selection { background: ${color.blush200}; color: ${color.onWine}; }

    ::-webkit-scrollbar { width: 7px; height: 7px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${color.blush300}; border-radius: 999px; }
    ::-webkit-scrollbar-thumb:hover { background: ${color.inkFaint}; }

    ::placeholder { color: ${color.inkFaint} !important; opacity: 1 !important; }

    input::-ms-reveal,
    input::-ms-clear { display: none; }
    input::-webkit-credentials-auto-fill-button,
    input::-webkit-strong-password-auto-fill-button { display: none !important; visibility: hidden; }

    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus {
      -webkit-text-fill-color: ${color.ink};
      -webkit-box-shadow: 0 0 0 1000px ${color.white} inset;
      caret-color: ${color.ink};
      transition: background-color 9999s ease-in-out 0s;
    }

    .ojt-pill { transition: transform 180ms ${ease}, filter 180ms ${ease}, background 180ms ${ease}, color 180ms ${ease}; }
    .ojt-pill:hover { filter: brightness(1.04); }
    .ojt-pill:active { transform: scale(0.985); }

    /* ── Uniform #898989 hover treatment for splash-screen buttons ── */
    .back-btn:hover {
      background: #898989 !important;
      color: ${color.white} !important;
    }

    .role-pill-btn:hover {
      background: #000000 !important;
      color: ${color.white} !important;
      border-color: transparent !important;
    }

    .invited-btn:hover {
      background: #000000 !important;
      color: ${color.white} !important;
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `}</style>
);

// The drifting diagonal streaks behind everything. Purely decorative.
const CapsuleField = () => (
  <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
    {capsules.map((c, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${c.x}%`,
          top: `${c.y}%`,
          width: `${c.w}px`,
          height: `${c.h}px`,
          borderRadius: "999px",
          background: `rgba(255,255,255,${c.o})`,
          transform: `rotate(${capsuleAngle}deg)`,
          transformOrigin: "center",
        }}
      />
    ))}
  </div>
);

const BrandLockup = ({ markPx, wordRem }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <img
      src={logo} alt=""
      style={{
        width: `${markPx}px`, height: `${markPx}px`,
        objectFit: "contain", display: "block",
        marginBottom: `${-markPx * 0.06}px`,
        filter: "invert(1) drop-shadow(0 8px 18px rgba(0,0,0,0.12))",
        transition: `width ${timing.rise}ms ${ease}, height ${timing.rise}ms ${ease}, margin-bottom ${timing.rise}ms ${ease}`,
      }}
    />
    <div style={{
      fontFamily: font.logo,
      fontSize: `${wordRem}rem`,
      color: color.ink,           // was color.white
      letterSpacing: "0.02em",
      lineHeight: 1.05,
      textShadow: "none",         // dark shadow di na kailangan sa light bg
      transition: `font-size ${timing.rise}ms ${ease}`,
    }}>
      OJTern
    </div>
  </div>
);

// Sign In / Sign Up segmented switch — outlined track with a sliding dark
// thumb underneath the labels. The thumb animates its position via
// transform (translateX) whenever `mode` changes, so switching between
// Sign In and Sign Up glides instead of flipping instantly.
const ModeSwitch = ({ mode, onChange }) => {
  const options = [
    { key: "signin", label: "Sign In" },
    { key: "signup", label: "Sign Up" },
  ];
  const activeIndex = options.findIndex(o => o.key === mode);

  return (
    <div
      role="tablist"
      aria-label="Sign in or sign up"
      style={{
        position: "relative",
        display: "flex", width: "100%", padding: "5px",
        borderRadius: radius.pill,
        border: `1.5px solid ${color.blush300}`,   // was onWineFaint
        background: "rgba(0,0,0,0.03)",             // was rgba(255,255,255,0.07)
        overflow: "hidden",
      }}
    >
      {/* Sliding thumb — sits behind the labels, animates left/right */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "5px", bottom: "5px", left: "5px",
          width: "calc(50% - 5px)",
          borderRadius: radius.pill,
          background: color.ink,
          boxShadow: shadow.pill,
          transform: `translateX(${activeIndex * 100}%)`,
          transition: `transform 340ms ${ease}`,
          zIndex: 0,
        }}
      />
      {options.map(m => {
        const active = mode === m.key;
        return (
          <button
            key={m.key} type="button" role="tab" aria-selected={active}
            onClick={() => onChange(m.key)} className="ojt-pill mode-switch-btn"
            style={{
              position: "relative", zIndex: 1,
              flex: 1, padding: "12px 18px", borderRadius: radius.pill,
              border: "none", background: "transparent", cursor: "pointer", whiteSpace: "nowrap",
              fontSize: "1.0625rem", fontWeight: active ? 600 : 500,
              color: active ? color.white : color.ink,
              transition: `color 260ms ${ease}`,
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
};

// The three blush role pills.
const RolePills = ({ role, onSelect }) => (
  <div role="tablist" aria-label="Account type" style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
    {ROLES.map(r => {
      const active = role === r.key;
      return (
        <button
          key={r.key} type="button" role="tab" aria-selected={active}
          onClick={() => onSelect(r.key)} className="ojt-pill role-pill-btn"
          style={{
            width: "100%", padding: "18px 26px", borderRadius: radius.pill,
            cursor: "pointer", whiteSpace: "nowrap",
            fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em",
            border: active ? "none" : `1.5px solid ${color.blush300}`,
            color: active ? color.white : color.ink,
            background: active
              ? "linear-gradient(180deg, #262626 0%, #0A0A0A 100%)"
              : color.white,
            boxShadow: active
              ? "0 6px 16px rgba(10,10,10,0.22), inset 0 1px 0 rgba(255,255,255,0.06)"
              : "0 2px 6px rgba(10,10,10,0.05)",
          }}
        >
          {r.label}
        </button>
      );
    })}
  </div>
);

const SplashScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [step1Data, setStep1Data]     = useState(null);
  const [resetEmail, setResetEmail]   = useState("");
  const [emailSent, setEmailSent]     = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // ── Info menu (Terms & Condition / Privacy Policy / About Us) ────────────
  const [infoOpen, setInfoOpen] = useState(false);
  const [legalView, setLegalView] = useState(null); // null | "terms" | "privacy" | "about"

  // ── Presentation state for the three-stage entrance ──────────────────────
  // "splash" = logo fills the screen, "hub" = logo up + controls, "form" =
  // hub shifts aside and the form panel slides in.
  const [stage, setStage] = useState("splash");
  const [mode, setMode]   = useState("signin"); // signin | signup
  const [role, setRole]   = useState(null);

  const prefersReducedMotion = useRef(
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ).current;

  // Determine current view based on URL path
  const getViewFromPath = (path) => {
    if (path.startsWith("/accept-invite")) return "accept_invite";
    if (path.startsWith("/student")) return "student_dashboard";
    if (path.startsWith("/coordinator")) return "coordinator_dashboard";
    if (path.startsWith("/company")) return "company_dashboard";
    if (path.includes("/signup/step-2")) return "signup2";
    if (path.includes("/signup")) return "signup1";
    // Email-link password reset flow:
    if (path.startsWith("/reset-password")) return "reset_password_link"; // Landed here from the emailed link (?oobCode=...)
    if (path.includes("/forgot-password")) return "forgot_password";      // Email input screen (+ "check your email" once sent)
    return "signin";
  };

  const currentView = getViewFromPath(location.pathname);

  // Which account role is allowed to view each dashboard route.
  const DASHBOARD_ROLE_FOR_VIEW = {
    coordinator_dashboard: "coordinator",
    company_dashboard:     "company",
    student_dashboard:     "student",
  };
  const requiredRoleForView = DASHBOARD_ROLE_FOR_VIEW[currentView];
  const isAuthorizedForView = !requiredRoleForView
    || (!!currentUser && currentUser.role === requiredRoleForView);

  const isInitialAuthCheck = useRef(true);

  // ── Restore session after page refresh ────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const isInitial = isInitialAuthCheck.current;
      isInitialAuthCheck.current = false;

      if (firebaseUser && isInitial) {
        const collections = ["coordinators", "students", "companies"];
        let userData = null;
        for (const col of collections) {
          const snap = await getDoc(doc(db, col, firebaseUser.uid));
          if (snap.exists()) { userData = snap.data(); break; }
        }

        // A timed suspension may have already expired since the last time
        // this company signed in — reflect that before deciding whether to
        // restore the session, same as signIn() does in AuthService.js.
        if (userData?.role === "company" && userData.status === "suspended") {
          await checkAndReactivateCompany(firebaseUser.uid).catch(() => {});
          const freshSnap = await getDoc(doc(db, "companies", firebaseUser.uid));
          if (freshSnap.exists()) userData = freshSnap.data();
        }

        // "suspended"/"blocked" MUST be excluded here too — otherwise a
        // company whose account was suspended/blocked while logged in could
        // regain access simply by refreshing the page, since this is what
        // restores `currentUser` (and therefore dashboard access) on refresh.
        const badStatuses = ["pending", "rejected", "transferred", "suspended", "blocked"];
        if (userData && badStatuses.includes(userData.status)) {
          // Don't leave a live Firebase Auth session sitting around for an
          // account that isn't allowed to use the app right now.
          await signOut(auth).catch(() => {});
        }
        if (userData && !badStatuses.includes(userData.status)) {
          setCurrentUser(userData);
          const onDashboardRoute = ["/coordinator", "/student", "/company"].some(p => location.pathname.startsWith(p));
          // Also exempt the emailed password-reset link — a stale/logged-in
          // session shouldn't bounce someone away from a reset link they just clicked.
          const onPublicStandaloneRoute = ["/accept-invite", "/reset-password"].some(p => location.pathname.startsWith(p));
          if (!onDashboardRoute && !onPublicStandaloneRoute) {
            if (userData.role === "coordinator") navigate("/coordinator/dashboard");
            else if (userData.role === "student")  navigate("/student/dashboard");
            else if (userData.role === "company")  navigate("/company/dashboard");
          }
        }
      }
      setAuthChecking(false);
    });
    return unsub;
  }, []);

  // Splash → hub. If the URL already points at a form (a refresh mid-sign-up,
  // or a forgot-password link), skip the hub and open straight into the form.
  useEffect(() => {
    const deepLinked = currentView === "signup1" || currentView === "signup2" || currentView === "forgot_password";
    const settle = () => {
      if (deepLinked) {
        setMode(currentView === "forgot_password" ? "signin" : "signup");
        setRole(prev => prev ?? "company");
        setStage("form");
      } else {
        setStage("hub");
      }
    };
    if (prefersReducedMotion) { settle(); return; }
    const t = setTimeout(settle, timing.hold);
    return () => clearTimeout(t);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (location.pathname === "/" && !authChecking && !currentUser) {
      navigate("/signin", { replace: true });
    }
  }, [location.pathname, authChecking, currentUser, navigate]);

  useEffect(() => {
    if (!authChecking && requiredRoleForView && !isAuthorizedForView) {
      navigate("/signin", { replace: true });
    }
  }, [authChecking, requiredRoleForView, isAuthorizedForView, navigate]);

  // ══════════════════════════════════════════════════════════════════════════
  // Every hook above this line runs on EVERY render, no matter what. From this
  // point down are early returns only — nothing below here may call a hook.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Full-screen dashboard views ────────────────────────────────────────────
  if (currentView === "accept_invite") {
    return <AcceptCoordinatorInviteScreen />;
  }

  // Password reset via the emailed Firebase link (?oobCode=...)
  if (currentView === "reset_password_link") {
    const oobCode = new URLSearchParams(location.search).get("oobCode");
    return <ResetPasswordScreen oobCode={oobCode} onBack={() => navigate("/forgot-password")} />;
  }

  // ── Info menu screens (Terms & Condition / Privacy Policy / About Us) ────
  if (legalView === "terms") {
    return <LegalDocScreen title="Terms & Conditions" text={TERMS_TEXT} onBack={() => setLegalView(null)} />;
  }
  if (legalView === "privacy") {
    return <LegalDocScreen title="Privacy Policy" text={PRIVACY_TEXT} onBack={() => setLegalView(null)} />;
  }
  if (legalView === "about") {
    return <AboutUsScreen onBack={() => setLegalView(null)} />;
  }

  const wineSurface = {
    backgroundColor: color.wine700,
    backgroundImage: wineField,
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
  };

  const LoadingSplash = () => (
    <div
      role="status"
      aria-label="Loading OJTern"
      style={{
        width: "100%", minHeight: "100dvh", position: "relative",
        ...wineSurface,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <CapsuleField />
      <div style={{ position: "relative", zIndex: 1 }}>
        <BrandLockup markPx={stageGeom?.markSplashPx ?? 210} wordRem={stageGeom?.wordSplashRem ?? 4.4} />
      </div>
    </div>
  );

  if (authChecking) return <LoadingSplash />;
  if (requiredRoleForView && !isAuthorizedForView) return <LoadingSplash />;

  // ── Dashboard routes ───────────────────────────────────────────────────────
  if (currentView === "coordinator_dashboard") {
    return <CoordinatorDashboardScreen user={currentUser} onLogout={() => { 
      setCurrentUser(null); 
      navigate("/signin"); 
    }} />;
  }
  if (currentView === "company_dashboard") {
    return <CompanyDashboardScreen user={currentUser} onLogout={() => { 
      setCurrentUser(null); 
      navigate("/signin"); 
    }} />;
  }
  if (currentView === "student_dashboard") {
    return <StudentDashboardScreen user={currentUser} onLogout={() => { 
      setCurrentUser(null); 
      navigate("/signin"); 
    }} />;
  }

  // ── Stage transitions ─────────────────────────────────────────────────────
  // Only company accounts self-register — coordinators arrive by invite and
  // students are enrolled by their coordinator, so Sign Up + those two roles
  // shows an explainer instead of a form. No auth behaviour changes here.
  const goToRoute = (nextMode, nextRole) => {
    if (nextMode === "signup" && nextRole === "company") {
      if (currentView !== "signup1" && currentView !== "signup2") navigate("/signup");
    } else if (currentView !== "signin") {
      setStep1Data(null);
      setEmailSent(false);
      navigate("/signin");
    }
  };

  const handleRoleSelect = (nextRole) => {
    setRole(nextRole);
    setStage("form");
    goToRoute(mode, nextRole);
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    if (role) {
      setStage("form");
      goToRoute(nextMode, role);
    }
  };

  const formOpen = stage === "form";
  const hubReady = stage === "hub" || stage === "form";

  // Defensive defaults: a missing token would make the transform string
  // invalid ("translate(0vw, undefinedpx)"), and the browser drops the whole
  // declaration — which looks exactly like the animation not running.
  const G = {
    hubShiftVw:         stageGeom?.hubShiftVw         ?? -27,
    hubMaxPx:           stageGeom?.hubMaxPx           ?? 420,
    formWidthVw:        stageGeom?.formWidthVw        ?? 44,
    formMaxPx:          stageGeom?.formMaxPx          ?? 600,
    formRightVw:        stageGeom?.formRightVw        ?? 8,
    splashLiftPx:       stageGeom?.splashLiftPx       ?? 236,
    splashLiftMobilePx: stageGeom?.splashLiftMobilePx ?? 200,
    markSplashPx:       stageGeom?.markSplashPx       ?? 210,
    markHubPx:          stageGeom?.markHubPx          ?? 176,
    markFormPx:         stageGeom?.markFormPx         ?? 156,
    wordSplashRem:      stageGeom?.wordSplashRem      ?? 4.4,
    wordHubRem:         stageGeom?.wordHubRem         ?? 3.5,
    wordFormRem:        stageGeom?.wordFormRem        ?? 3.1,
  };

  // Closes the form and returns the hub to centre. Clears any half-finished
  // sign-up draft so reopening starts clean.
  const handleBack = () => {
    setStage("hub");
    setRole(null);
    setStep1Data(null);
    setEmailSent(false);
    if (currentView !== "signin") navigate("/signin");
  };

  const BackButton = () => (
  <button
    type="button" onClick={handleBack} className="ojt-pill back-btn"
    style={{
      display: "inline-flex", alignItems: "center", gap: "8px",
      alignSelf: "flex-start", marginBottom: "14px",
      padding: "9px 18px 9px 14px", borderRadius: radius.pill,
      border: `1px solid ${color.blush300}`,     // was onWineFaint
      background: "rgba(0,0,0,0.03)",             // was rgba(255,255,255,0.10)
      color: color.ink,                            // was onWine
      fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
    }}
  >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Back
    </button>
  );

  // ── Form panel contents ───────────────────────────────────────────────────
  const selfServeSignup = mode === "signup" && role === "company";
  const invitedOnlySignup = mode === "signup" && (role === "coordinator" || role === "student");

  const InvitedOnlyNotice = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
    <h2 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.02em", color: color.onWine }}>
      Accounts are created for you
    </h2>
    <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.6, color: color.onWineMuted }}>
      {role === "coordinator"
        ? "Coordinator accounts are set up by the OJT office. You'll get an email invite with a link to finish setting yours up."
        : "Student accounts are enrolled by your OJT coordinator. Once you're enrolled, sign in with your Student ID."}
    </p>
    <button
      type="button"
      onClick={() => handleModeChange("signin")}
      className="ojt-pill invited-btn"
      style={{
      alignSelf: "flex-start", marginTop: "6px",
      padding: "13px 26px", borderRadius: radius.pill, border: "none", cursor: "pointer",
      fontSize: "0.9375rem", fontWeight: 600, color: color.ink,
      background: color.white,
      boxShadow: shadow.pill,
    }}
    >
      Go to sign in
    </button>
  </div>
);

  const formContent = (
    <>
      {currentView === "signin" && !invitedOnlySignup && (
        <SignInScreen
          role={role ?? "coordinator"}
          onRoleChange={setRole}
          onGoSignUp={() => handleModeChange("signup")}
          onSignInCoordinator={(userData) => { setCurrentUser(userData); navigate("/coordinator/dashboard"); }}
          onSignInStudent={(userData) => { setCurrentUser(userData); navigate("/student/dashboard"); }}
          onSignInCompany={(userData) => { setCurrentUser(userData); navigate("/company/dashboard"); }}
          onForgotPassword={() => navigate("/forgot-password")}
        />
      )}

      {currentView === "signin" && invitedOnlySignup && <InvitedOnlyNotice />}

      {/* Email-link password reset flow: email → "check your email" → link in inbox */}
      {currentView === "forgot_password" && !emailSent && (
        <ForgotPasswordScreen
          onBack={() => navigate("/signin")}
          onProceed={(email) => {
            setResetEmail(email);
            setEmailSent(true); // resetPassword() already sent the email at this point
          }}
        />
      )}

      {currentView === "forgot_password" && emailSent && (
        <ForgotPasswordCodeScreen
          email={resetEmail}
          onResend={() => {}}
          onBack={() => { setEmailSent(false); navigate("/signin"); }}
        />
      )}

      {currentView === "signup1" && (
        <SignUpStep1Screen
          onContinue={(data) => { setStep1Data(data); navigate("/signup/step-2"); }}
          onGoSignIn={() => { setStep1Data(null); handleModeChange("signin"); }}
          initialData={step1Data}
        />
      )}
      {currentView === "signup2" && (
        <SignUpStep2Screen
          step1Data={step1Data}
          onBack={() => navigate("/signup")}
          onGoSignIn={() => { setStep1Data(null); handleModeChange("signin"); }}
          onSubmitSuccess={() => { setStep1Data(null); handleModeChange("signin"); }}
        />
      )}
    </>
  );

  // The sign-up screens bring their own card chrome, so the blush panel drops
  // its padding for those routes rather than double-boxing them.
  const bareForm = currentView === "signup1" || currentView === "signup2";

  const formPanelStyle = {
    background: bareForm ? "transparent" : color.blush100,
    borderRadius: radius.panel,
    padding: bareForm ? "0" : (isMobile ? "28px 22px 32px" : "40px 40px 44px"),
    width: "100%",
  };

  const markPx  = stage === "splash" ? G.markSplashPx : (formOpen ? G.markFormPx : G.markHubPx);
  const wordRem = stage === "splash" ? G.wordSplashRem : (formOpen ? G.wordFormRem : G.wordHubRem);

  const hubControls = (
    <div style={{
      width: "100%",
      maxWidth: `${G.hubMaxPx}px`,
      display: "flex", flexDirection: "column", gap: "20px",
      marginTop: "30px",
      opacity: hubReady ? 1 : 0,
      transform: hubReady ? "translateY(0)" : "translateY(18px)",
      transition: `opacity 520ms ${ease} 240ms, transform 520ms ${ease} 240ms`,
      pointerEvents: hubReady ? "auto" : "none",
    }}>
      <ModeSwitch mode={mode} onChange={handleModeChange} />
      <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: color.inkMuted, textAlign: "center" }}>
        {mode === "signin" ? "Sign in as" : "Sign up as"}
      </div>
      <RolePills role={role} onSelect={handleRoleSelect} />
    </div>
  );

  // ── MOBILE layout ─────────────────────────────────────────────────────────
  // Same three stages stacked vertically: the lockup shrinks in place and the
  // form drops in underneath instead of sliding in from the side.
  if (isMobile) {
    return (
      <>
        <FontImport />
        <div style={{
          position: "relative", width: "100%", minHeight: "100dvh",
          ...wineSurface,
          overflowX: "hidden",
        }}>
          <CapsuleField />
          <div style={{
            position: "relative",
            zIndex: 30,
            opacity: hubReady ? 1 : 0,
            transition: `opacity 420ms ${ease} 240ms`,
            pointerEvents: hubReady ? "auto" : "none",
            transform: "scale(1.15)",
            transformOrigin: "top right",
          }}>
            <InfoMenu
              open={infoOpen}
              onToggle={setInfoOpen}
              onSelect={(key) => setLegalView(key)}
            />
          </div>

          <div style={{
            position: "relative", zIndex: 1,
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "0 20px 48px",
            minHeight: "100dvh",
          }}>
            <div style={{
              minHeight: formOpen ? "auto" : "100dvh",
              paddingTop: formOpen ? "44px" : "0",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              flexShrink: 0, width: "100%",
              transform: "translateY(0px)",
              transition: `transform ${timing.rise}ms ${ease}`,
            }}>
              <BrandLockup
                markPx={stage === "splash" ? 170 : 96}
                wordRem={stage === "splash" ? 3.4 : 2.1}
              />
              {hubControls}
            </div>

            {formOpen && (
              <div style={{
                width: "100%", maxWidth: "460px", marginTop: "28px",
                display: "flex", flexDirection: "column",
              }}>
                <BackButton />
                <div style={formPanelStyle}>{formContent}</div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── DESKTOP layout ────────────────────────────────────────────────────────
  // The hub is a centred column that slides left on transform when a form
  // opens; the blush panel slides in from the right to meet it.
  return (
    <>
      <FontImport />
      <div style={{
        position: "fixed", inset: 0,
        ...wineSurface, overflow: "hidden",
      }}>
        <CapsuleField />
        <div style={{
          position: "relative",
          zIndex: 30,
          opacity: hubReady ? 1 : 0,
          transition: `opacity 420ms ${ease} 240ms`,
          pointerEvents: hubReady ? "auto" : "none",
          transform: "scale(1.15)",
          transformOrigin: "top right",
        }}>
          <InfoMenu
            open={infoOpen}
            onToggle={setInfoOpen}
            onSelect={(key) => setLegalView(key)}
          />
        </div>

        {/* Hub column */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "32px",
          transform: `translate(${formOpen ? G.hubShiftVw : 0}vw, 0px)`,
          transition: `transform ${timing.rise}ms ${ease}`,
          willChange: "transform",
          pointerEvents: "none",
        }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            width: "100%", maxWidth: `${G.hubMaxPx}px`,
            pointerEvents: "auto",
          }}>
            <BrandLockup markPx={markPx} wordRem={wordRem} />
            {hubControls}
          </div>
        </div>

        {/* Form panel */}
        <div style={{
          position: "absolute", top: "50%", right: `${G.formRightVw}vw`, zIndex: 3,
          width: `${G.formWidthVw}vw`,
          maxWidth: `${G.formMaxPx}px`,
          maxHeight: "90vh",
          overflowY: "auto",
          transform: formOpen
            ? "translateY(-50%) translateX(0)"
            : "translateY(-50%) translateX(56px)",
          opacity: formOpen ? 1 : 0,
          transition: `opacity ${timing.slide}ms ${ease}, transform ${timing.slide}ms ${ease}`,
          pointerEvents: formOpen ? "auto" : "none",
          willChange: "transform, opacity",
          display: "flex", flexDirection: "column",
        }}>
          <BackButton />
          <div style={formPanelStyle}>{formContent}</div>
        </div>

      </div>
    </>
  );
};

export default SplashScreen;