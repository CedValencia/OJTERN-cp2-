import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { checkAndReactivateCompany } from "./AuthService";

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
  const [resetEmail, setResetEmail]   = useState("");  // Email the reset link was sent to
  const [emailSent, setEmailSent]     = useState(false); // Whether the "check your email" step should show
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

  useEffect(() => {
    const t1 = setTimeout(() => setAnimate(true),  2000);
    const t2 = setTimeout(() => setShowRight(true), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

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

  // ── Full-screen dashboard views ────────────────────────────────────────────
  if (currentView === "accept_invite") {
    return <AcceptCoordinatorInviteScreen />;
  }

  // Password reset via the emailed Firebase link (?oobCode=...)
  if (currentView === "reset_password_link") {
    const oobCode = new URLSearchParams(location.search).get("oobCode");
    return <ResetPasswordScreen oobCode={oobCode} onBack={() => navigate("/forgot-password")} />;
  }

  const LoadingSplash = () => (
    <div style={{ width: "100vw", height: "100vh", background: "linear-gradient(180deg, #A32424 0%, #320000 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <img src={logo} alt="OJTern Logo" style={{ width: "120px", height: "120px", objectFit: "contain", marginBottom: "-10px" }} />
      <div style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "3.5rem", color: "white", letterSpacing: "0.03em" }}>OJTern</div>
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