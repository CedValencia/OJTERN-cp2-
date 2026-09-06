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

// Per-role icon + the one-liner shown under each role card. The copy changes
// with `mode`: signing in answers "where do I land", signing up answers
// "am I even allowed to register" — which heads off the dead end into
// InvitedOnlyNotice before the click.
const ROLE_META = {
  coordinator: {
    icon: (
      <>
        <rect x="8" y="4" width="8" height="4" rx="1" />
        <path d="M16 6h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
        <path d="M9 14l2 2 4-4" />
      </>
    ),
    signin: "Manage OJT placements",
    signup: "Invite new Coordinator",
  },
  student: {
    icon: (
      <>
        <path d="M12 4L2 9l10 5 10-5-10-5z" />
        <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
      </>
    ),
    signin: "Find your OJT placement",
    signup: "Enrolled by your coordinator",
  },
  company: {
    icon: (
      <>
        <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
        <path d="M15 9h4a1 1 0 0 1 1 1v11" />
        <path d="M2 21h20" />
        <path d="M8 8h3M8 12h3M8 16h3" />
      </>
    ),
    signin: "Post OJT opportunities",
    signup: "Register your company",
  },
};

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

    .ojt-pill { transition: transform 180ms ${ease}, filter 180ms ${ease}, background 180ms ${ease}, color 180ms ${ease}, border-color 180ms ${ease}, opacity 180ms ${ease}; }
    .ojt-pill:hover { filter: brightness(1.04); }
    .ojt-pill:active { transform: scale(0.985); }

    .back-btn:hover {
      background: #898989 !important;
      color: ${color.white} !important;
    }

    /* The role cards set their own colours, lift, and entrance timing inline
       so the icon and text can flip with the card — brightness would lighten
       the dark fill and break the match with the picked state. */
    .role-card-btn:hover { filter: none !important; }
    .role-card-btn:active { transform: translateY(-2px) scale(0.985) !important; }

    .invited-btn:hover {
      background: #898989 !important;
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
      color: color.ink,
      letterSpacing: "0.02em",
      lineHeight: 1.05,
      textShadow: "none",
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
        // The hub is sized for three role cards now, which is far wider than
        // this control wants to be — cap it and centre it instead.
        maxWidth: "420px", margin: "0 auto",
        borderRadius: radius.pill,
        border: `1.5px solid ${color.blush300}`,
        background: "rgba(0,0,0,0.03)",
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

// The three role cards. Three columns on desktop; on mobile they become
// horizontal rows (icon left) rather than three squeezed columns, which
// stops the description wrapping to four lines on a narrow screen.
const RolePills = ({ role, mode, onSelect, ready = true }) => {
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState(null);
  const hasSelection = !!role;

  return (
    <div
      role="tablist"
      aria-label="Account type"
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
        gap: "14px",
        width: "100%",
      }}
    >
      {ROLES.map((r, i) => {
        const active = role === r.key;
        const isHovered = hovered === r.key;
        // Hover previews the picked state, so the icon and text colours have
        // to flip too — a CSS :hover rule can't reach them while the colours
        // live in inline styles, hence the tracked hover key.
        const dark = active || isHovered;
        const meta = ROLE_META[r.key];
        // Cards arrive left to right rather than as one slab. Once they've
        // landed the delay drops to 0, so hover and selection stay instant.
        const arriveDelay = ready ? 0 : 90 * i;
        return (
          <button
            key={r.key} type="button" role="tab" aria-selected={active}
            onClick={() => onSelect(r.key)} className="ojt-pill role-card-btn"
            onMouseEnter={() => setHovered(r.key)}
            onMouseLeave={() => setHovered(prev => (prev === r.key ? null : prev))}
            onFocus={() => setHovered(r.key)}
            onBlur={() => setHovered(prev => (prev === r.key ? null : prev))}
            style={{
              display: "flex",
              flexDirection: isMobile ? "row" : "column",
              alignItems: "center",
              textAlign: isMobile ? "left" : "center",
              gap: isMobile ? "14px" : "0",
              padding: isMobile ? "16px 18px" : "26px 20px",
              borderRadius: "18px",
              cursor: "pointer",
              border: `1.5px solid ${dark ? color.ink : color.blush300}`,
              background: dark ? color.ink : color.white,
              // Dimming the unpicked cards is mostly a mobile affordance —
              // on desktop the hub slides away almost immediately after the
              // click, so it barely registers there.
              opacity: !ready ? 0 : (hasSelection && !active && !isHovered ? 0.55 : 1),
              transform: !ready
                ? "translateY(14px)"
                : (isHovered ? "translateY(-2px)" : "translateY(0)"),
              transition: `opacity 460ms ${ease} ${340 + arriveDelay}ms, transform ${ready ? "180ms" : `460ms`} ${ease} ${340 + arriveDelay}ms, background 180ms ${ease}, border-color 180ms ${ease}, box-shadow 180ms ${ease}`,
              boxShadow: dark
                ? "0 8px 20px rgba(10,10,10,0.20)"
                : "0 2px 6px rgba(10,10,10,0.05)",
            }}
          >
            <div style={{
              width: "44px", height: "44px", flex: "none",
              borderRadius: "14px",
              margin: isMobile ? "0" : "0 0 14px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.05)",
              transition: `background 180ms ${ease}`,
            }}>
              <svg
                width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
                style={{ color: dark ? color.white : color.ink, transition: `color 180ms ${ease}` }}
              >
                {meta.icon}
              </svg>
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: "1rem", fontWeight: 600, letterSpacing: "-0.01em",
                color: dark ? color.white : color.ink,
                transition: `color 180ms ${ease}`,
              }}>
                {r.label}
              </div>
              <div style={{
                fontSize: "0.75rem", lineHeight: 1.5, marginTop: "6px",
                textWrap: "balance",
                color: dark ? "rgba(255,255,255,0.70)" : color.inkMuted,
                transition: `color 180ms ${ease}`,
              }}>
                {mode === "signup" ? meta.signup : meta.signin}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

const SplashScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [step1Data, setStep1Data]     = useState(null);
  const [resetEmail, setResetEmail]   = useState("");
  const [emailSent, setEmailSent]     = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // ── Info links (Terms & Condition / Privacy Policy / About Us) ───────────
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

  // The Terms / Privacy / About Us links belong to the hub, not the forms —
  // they fade in once the splash settles and fade back out the moment a form
  // opens, so the form has the screen to itself. No delay on the way out so
  // they clear before the panel slides in; the original 240ms delay stays on
  // the way back in, keeping them in step with the rest of the hub entrance.
  const infoVisible = hubReady && !formOpen;

  const infoMenuBlock = (
    <div style={{
      position: "relative",
      zIndex: 30,
      opacity: infoVisible ? 1 : 0,
      transition: `opacity 420ms ${ease} ${formOpen ? "0ms" : "240ms"}`,
      pointerEvents: infoVisible ? "auto" : "none",
    }}>
      <InfoMenu onSelect={(key) => setLegalView(key)} />
    </div>
  );

  // Defensive defaults: a missing token would make the transform string
  // invalid ("translate(0vw, undefinedpx)"), and the browser drops the whole
  // declaration — which looks exactly like the animation not running.
  const G = {
    hubShiftVw:         stageGeom?.hubShiftVw         ?? -27,
    // Three columns of role card need more room than the old stacked pills.
    // At 620 each card lands around 197px, which gives the copy real breathing
    // room instead of hugging the card edges.
    hubMaxPx:           stageGeom?.hubMaxPx           ?? 620,
    formWidthVw:        stageGeom?.formWidthVw        ?? 44,
    formMaxPx:          stageGeom?.formMaxPx          ?? 600,
    formRightVw:        stageGeom?.formRightVw        ?? 8,
    // True centre sits low once the controls are in — optical centre is a
    // touch above it. Applied only after the splash settles, so the lockup
    // still starts dead centre.
    hubLiftPx:          stageGeom?.hubLiftPx          ?? 20,
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
      border: `1px solid ${color.blush300}`,
      background: "rgba(0,0,0,0.03)",
      color: color.ink,
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

  // During "splash" the controls must take up NO height, otherwise the
  // centring column reserves room for them and the lockup sits visibly above
  // centre. Animating grid-template-rows from 0fr to 1fr collapses them
  // without unmounting, so the fade-in still has something to transition.
  //
  // The three pieces then arrive in sequence — switch, label, cards — rather
  // than as one slab, so the eye is led down the screen in reading order.
  const arrive = (delay) => ({
    opacity: hubReady ? 1 : 0,
    transform: hubReady ? "translateY(0)" : "translateY(14px)",
    transition: `opacity 460ms ${ease} ${delay}ms, transform 460ms ${ease} ${delay}ms`,
  });

  const hubControls = (
    <div style={{
      width: "100%",
      maxWidth: `${G.hubMaxPx}px`,
      display: "grid",
      gridTemplateRows: hubReady ? "1fr" : "0fr",
      transition: `grid-template-rows ${timing.rise}ms ${ease}`,
    }}>
      <div style={{ overflow: "hidden", minHeight: 0 }}>
        <div style={{
          display: "flex", flexDirection: "column", gap: "20px",
          marginTop: "30px",
          pointerEvents: hubReady ? "auto" : "none",
        }}>
          <div style={arrive(180)}>
            <ModeSwitch mode={mode} onChange={handleModeChange} />
          </div>
          <div style={{
            fontSize: "0.9375rem", fontWeight: 500, color: color.inkMuted, textAlign: "center",
            ...arrive(260),
          }}>
            {mode === "signin" ? "Sign in as" : "Sign up as"}
          </div>
          <RolePills role={role} mode={mode} onSelect={handleRoleSelect} ready={hubReady} />
        </div>
      </div>
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
          {infoMenuBlock}

          <div style={{
            position: "relative", zIndex: 1,
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "0 20px 48px",
            minHeight: "100dvh",
          }}>
            <div style={{
              // `auto` can't be transitioned, so the closed state is a plain
              // 0dvh floor — the block still holds its natural content height,
              // and the collapse now eases in step with the form instead of
              // snapping back the moment Back is pressed.
              minHeight: formOpen ? "0dvh" : "100dvh",
              paddingTop: formOpen ? "44px" : "0",
              // Same optical-centre lift as desktop. Padding rather than a
              // transform, because this block is in normal flow and the form
              // below it has to move with it.
              paddingBottom: !formOpen && hubReady ? `${G.hubLiftPx * 2}px` : "0",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              flexShrink: 0, width: "100%",
              transition: `min-height ${timing.slide}ms ${ease}, padding-top ${timing.slide}ms ${ease}, padding-bottom ${timing.rise}ms ${ease}`,
            }}>
              <BrandLockup
                markPx={stage === "splash" ? 170 : 96}
                wordRem={stage === "splash" ? 3.4 : 2.1}
              />
              {hubControls}
            </div>

            {/* Kept mounted rather than gated on `formOpen`, otherwise Back
                rips the panel out instantly with nothing to animate. The row
                collapses to 0fr so it still takes no space when closed, and
                the inner block slides — no fade, same as desktop. */}
            <div style={{
              width: "100%", maxWidth: "460px",
              display: "grid",
              gridTemplateRows: formOpen ? "1fr" : "0fr",
              transition: `grid-template-rows ${timing.slide}ms ${ease}`,
            }}>
              <div style={{ overflow: "hidden", minHeight: 0 }}>
                <div style={{
                  marginTop: "28px",
                  display: "flex", flexDirection: "column",
                  transform: formOpen ? "translateY(0)" : "translateY(24px)",
                  transition: `transform ${timing.slide}ms ${ease}`,
                  pointerEvents: formOpen ? "auto" : "none",
                }}>
                  <BackButton />
                  <div style={formPanelStyle}>{formContent}</div>
                </div>
              </div>
            </div>
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
        {infoMenuBlock}

        {/* Hub column */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "32px",
          transform: `translate(${formOpen ? G.hubShiftVw : 0}vw, ${hubReady ? -G.hubLiftPx : 0}px)`,
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
          // Slides clean off the right edge rather than fading in place. The
          // old 56px nudge needed the opacity to hide what was left behind;
          // clearing the panel's own width plus its offset means it's simply
          // gone, and the exit reads as one movement instead of two.
          transform: formOpen
            ? "translateY(-50%) translateX(0)"
            : `translateY(-50%) translateX(calc(100% + ${G.formRightVw}vw))`,
          transition: `transform ${timing.slide}ms ${ease}`,
          pointerEvents: formOpen ? "auto" : "none",
          willChange: "transform",
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