import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { auth, db } from "./firebase";

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

import logo from "../icons/ojtern.png";

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

const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&family=Monomaniac+One&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    input:focus { outline: none; }
    select:focus { outline: none; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #8B0000; border-radius: 4px; }
    ::placeholder {
      color: rgba(255, 255, 255, 0.6) !important;
      opacity: 1 !important;
    }
    select { color: rgba(255, 255, 255, 0.6); }
    select:valid { color: white; }
    input::-ms-reveal,
    input::-ms-clear { display: none; }
    input::-webkit-credentials-auto-fill-button,
    input::-webkit-strong-password-auto-fill-button { display: none !important; visibility: hidden; }
  `}</style>
);

const SplashScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [animate, setAnimate]         = useState(false);
  const [showRight, setShowRight]     = useState(false);
  const isMobile                      = useIsMobile();
  const [step1Data, setStep1Data]     = useState(null);
  const [resetEmail, setResetEmail]   = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Determine current view based on URL path
  const getViewFromPath = (path) => {
    if (path.startsWith("/accept-invite")) return "accept_invite";
    if (path.startsWith("/student")) return "student_dashboard";
    if (path.startsWith("/coordinator")) return "coordinator_dashboard";
    if (path.startsWith("/company")) return "company_dashboard";
    if (path.includes("/signup/step-2")) return "signup2";
    if (path.includes("/signup")) return "signup1";
    if (path.includes("/forgot-password/code")) return "forgot_code";
    if (path.includes("/forgot-password")) return "forgot_password";
    if (path.startsWith("/reset-password")) return "reset_password";
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
  // True only once auth has resolved AND the signed-in user's role matches
  // the dashboard being requested — this is what actually gates the view,
  // not just the URL the person happened to type in.
  const isAuthorizedForView = !requiredRoleForView
    || (!!currentUser && currentUser.role === requiredRoleForView);

  const isInitialAuthCheck = useRef(true);

  // ── Restore session after page refresh ────────────────────────────────────
  // NOTE: onAuthStateChanged fires on EVERY auth change, not just page load —
  // including the brief sign-in Firebase does internally while AuthService.signIn()
  // is still validating the selected role. We only want this listener to restore
  // a session on initial mount; any sign-in attempt made while already on this
  // screen must be routed exclusively by SignInScreen's own role-checked callbacks
  // (onSignInCoordinator/onSignInStudent/onSignInCompany), never by this listener,
  // or a wrong-role sign-in attempt gets briefly (and wrongly) routed to whatever
  // dashboard matches the account's real role before AuthService signs it back out.
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

      const badStatuses = ["pending", "rejected", "transferred"];
      if (userData && !badStatuses.includes(userData.status)) {
        setCurrentUser(userData);
        // Navigate to dashboard if not already on one — but never hijack the
        // Accept Invitation or Reset Password links (used by Transfer/Add
        // Account and the emailed password-reset flow respectively). Without
        // this exemption, opening either link in a browser where someone is
        // still signed in would immediately bounce back to their own
        // dashboard before that screen ever gets to render, silently
        // aborting the flow.
        const onDashboardRoute = ["/coordinator", "/student", "/company"].some(p => location.pathname.startsWith(p));
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

  useEffect(() => {
    const t1 = setTimeout(() => setAnimate(true),  2000);
    const t2 = setTimeout(() => setShowRight(true), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Redirect to /signin if no path is set — but only once we've confirmed
  // there's no signed-in user. Without the currentUser check, this could
  // race the session-restore navigate() above: if authChecking flips to
  // false a beat before location.pathname reflects the dashboard redirect,
  // this would send an already-authenticated person back to /signin.
  useEffect(() => {
    if (location.pathname === "/" && !authChecking && !currentUser) {
      navigate("/signin", { replace: true });
    }
  }, [location.pathname, authChecking, currentUser, navigate]);

  // Guard: kick anyone off a dashboard URL they're not authenticated/authorized
  // for — e.g. typing /student directly while logged out, or while
  // logged in as a different role. Runs once auth has finished resolving so
  // it doesn't fire during the brief window before onAuthStateChanged settles.
  useEffect(() => {
    if (!authChecking && requiredRoleForView && !isAuthorizedForView) {
      navigate("/signin", { replace: true });
    }
  }, [authChecking, requiredRoleForView, isAuthorizedForView, navigate]);

  // ── Full-screen dashboard views ────────────────────────────────────────────
  // Fully public, standalone pages — reached via an emailed link. Placed
  // after all hooks above (Rules of Hooks) but before the authChecking gate
  // below, since neither needs an auth check to render.
  if (currentView === "accept_invite") {
    return <AcceptCoordinatorInviteScreen />;
  }
  if (currentView === "reset_password") {
    return <ResetPasswordScreen />;
  }

  if (authChecking) return (
    <div style={{ width: "100vw", height: "100vh", background: "linear-gradient(180deg, #A32424 0%, #320000 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <img src={logo} alt="OJTern Logo" style={{ width: "120px", height: "120px", objectFit: "contain", marginBottom: "-10px" }} />
      <div style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "3.5rem", color: "white", letterSpacing: "0.03em" }}>OJTern</div>
    </div>
  );

  // Someone hit a dashboard URL without being authenticated/authorized for it
  // — show the same loading splash for the one tick it takes the guard effect
  // above to redirect to /signin, instead of flashing the dashboard itself.
  if (requiredRoleForView && !isAuthorizedForView) return (
    <div style={{ width: "100vw", height: "100vh", background: "linear-gradient(180deg, #A32424 0%, #320000 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <img src={logo} alt="OJTern Logo" style={{ width: "120px", height: "120px", objectFit: "contain", marginBottom: "-10px" }} />
      <div style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "3.5rem", color: "white", letterSpacing: "0.03em" }}>OJTern</div>
    </div>
  );

  // Dashboard routes
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

  // ── Right panel content ────────────────────────────────────────────────────
  const rightPanel = (
    <>
      {currentView === "signin" && (
        <SignInScreen
          onGoSignUp={() => navigate("/signup")}
          onSignInCoordinator={(userData) => { setCurrentUser(userData); navigate("/coordinator/dashboard"); }}
          onSignInStudent={(userData) => { setCurrentUser(userData); navigate("/student/dashboard"); }}
          onSignInCompany={(userData) => { setCurrentUser(userData); navigate("/company/dashboard"); }}
          onForgotPassword={() => navigate("/forgot-password")}
        />
      )}
      {currentView === "forgot_password" && (
        <ForgotPasswordScreen
          onSend={(email) => { setResetEmail(email); navigate("/forgot-password/code"); }}
          onBack={() => navigate("/signin")}
        />
      )}
      {currentView === "forgot_code" && (
        <ForgotPasswordCodeScreen
          email={resetEmail}
          onResend={() => {}}
          onBack={() => navigate("/signin")}
        />
      )}

      {currentView === "signup1" && (
        <SignUpStep1Screen
          onContinue={(data) => { setStep1Data(data); navigate("/signup/step-2"); }}
          onGoSignIn={() => { setStep1Data(null); navigate("/signin"); }}
          initialData={step1Data}
        />
      )}
      {currentView === "signup2" && (
        <SignUpStep2Screen
          step1Data={step1Data}
          onBack={() => navigate("/signup")}
          onGoSignIn={() => { setStep1Data(null); navigate("/signin"); }}
          onSubmitSuccess={() => { setStep1Data(null); navigate("/signin"); }}
        />
      )}
    </>
  );

  // ── MOBILE layout ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <FontImport />
        <div style={{ width: "100vw", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          <div style={{
            width: "100%",
            height: animate ? "160px" : "100vh",
            background: "linear-gradient(180deg, #A32424 0%, #320000 100%)",
            transition: "height 0.85s cubic-bezier(0.77, 0, 0.18, 1)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            flexShrink: 0, overflow: "hidden",
          }}>
            <img
              src={logo} alt="OJTern Logo"
              style={{
                width: animate ? "70px" : "180px",
                height: animate ? "70px" : "180px",
                objectFit: "contain",
                marginBottom: animate ? "-6px" : "-20px",
                transition: "width 0.85s cubic-bezier(0.77, 0, 0.18, 1), height 0.85s cubic-bezier(0.77, 0, 0.18, 1), margin-bottom 0.85s cubic-bezier(0.77, 0, 0.18, 1)",
              }}
            />
            <div style={{
              fontFamily: "'Monomaniac One', sans-serif",
              fontSize: animate ? "2.2rem" : "4.5rem",
              color: "white",
              letterSpacing: "0.03em",
              textShadow: "0 2px 12px rgba(0,0,0,0.3)",
              transition: "font-size 0.85s cubic-bezier(0.77, 0, 0.18, 1)",
            }}>
              OJTern
            </div>
          </div>

          <div style={{
            flex: 1,
            background: "white",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "flex-start",
            opacity: showRight ? 1 : 0,
            transform: showRight ? "translateY(0)" : "translateY(40px)",
            transition: "opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
            padding: "1.5rem 1.25rem",
            overflowY: "auto",
          }}>
            {rightPanel}
          </div>

        </div>
      </>
    );
  }

  // ── DESKTOP layout ────────────────────────────────────────────────────────
  return (
    <>
      <FontImport />
      <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", display: "flex" }}>

        <div style={{
          position: "absolute", top: 0, left: 0,
          width: animate ? "45%" : "100%", height: "100%",
          background: "linear-gradient(180deg, #A32424 0%, #320000 100%)",
          transition: "width 0.85s cubic-bezier(0.77, 0, 0.18, 1)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", zIndex: 10,
        }}>
          <img src={logo} alt="OJTern Logo" style={{ width: "250px", height: "250px", objectFit: "contain", marginBottom: "-25px" }} />
          <div style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "5.5rem", color: "white", letterSpacing: "0.03em", textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
            OJTern
          </div>
        </div>

        <div style={{
          position: "absolute", top: 0, right: 0,
          width: "55%", height: "100%", background: "white",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          opacity: showRight ? 1 : 0,
          transform: showRight ? "translateX(0)" : "translateX(40px)",
          transition: "opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
          padding: "2rem", overflowY: "auto",
        }}>
          {rightPanel}
        </div>

      </div>
    </>
  );
};

export default SplashScreen;