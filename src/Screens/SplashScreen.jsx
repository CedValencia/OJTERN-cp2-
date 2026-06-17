import React, { useEffect, useState } from "react";

import SignInScreen               from "./SignInScreen";
import ForgotPasswordScreen       from "./ForgotPasswordScreen";
import ForgotPasswordCodeScreen   from "./ForgotPasswordCodeScreen";
import ResetPasswordScreen        from "./ResetPasswordScreen";
import PasswordResetSuccessScreen from "./PasswordResetSuccessScreen";
import SignUpStep1Screen          from "./SignUpStep1Screen";
import SignUpStep2Screen          from "./SignUpStep2Screen";
import CoordinatorDashboardScreen from "./CoordinatorDashboardScreen";
import CompanyDashboardScreen     from "./CompanyDashboardScreen";
import StudentDashboardScreen     from "./StudentDashboardScreen";

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
  const [animate, setAnimate]     = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [view, setView]           = useState("signin");
  const isMobile                  = useIsMobile();

  // ── FIX 2: Store Step 1 data here so it survives navigation ──────────────
  const [step1Data, setStep1Data] = useState(null);
  const [resetEmail, setResetEmail] = useState("");

  // ── FIX 1: Store signed-in user data so coordinator dashboard gets it ─────
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimate(true),  2000);
    const t2 = setTimeout(() => setShowRight(true), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── Full-screen dashboard views ────────────────────────────────────────────
  if (view === "coordinator_dashboard") return <CoordinatorDashboardScreen user={currentUser} onLogout={() => { setCurrentUser(null); setView("signin"); }} />;
  if (view === "company_dashboard")     return <CompanyDashboardScreen user={currentUser} onLogout={() => { setCurrentUser(null); setView("signin"); }} />;
  if (view === "student_dashboard")     return <StudentDashboardScreen user={currentUser} onLogout={() => { setCurrentUser(null); setView("signin"); }} />;

  // ── Right panel content ────────────────────────────────────────────────────
  const rightPanel = (
    <>
      {view === "signin" && (
        <SignInScreen
          onGoSignUp={() => setView("signup1")}
          onSignInCoordinator={(userData) => { setCurrentUser(userData); setView("coordinator_dashboard"); }}
          onSignInStudent={(userData) => { setCurrentUser(userData); setView("student_dashboard"); }}
          onSignInCompany={(userData) => { setCurrentUser(userData); setView("company_dashboard"); }}
          onForgotPassword={() => setView("forgot_password")}
        />
      )}
      {view === "forgot_password" && (
        <ForgotPasswordScreen
          onSend={(email) => { setResetEmail(email); setView("forgot_code"); }}
          onBack={() => setView("signin")}
        />
      )}
      {view === "forgot_code" && (
        <ForgotPasswordCodeScreen
          email={resetEmail}
          onResend={() => {}}
          onBack={() => setView("signin")}
        />
      )}

      {view === "signup1" && (
        <SignUpStep1Screen
          // FIX 2a: Save step1Data to parent state, then go to step 2
          onContinue={(data) => { setStep1Data(data); setView("signup2"); }}
          onGoSignIn={() => { setStep1Data(null); setView("signin"); }}
          // FIX 2b: Pass saved data back so fields are restored on Back
          initialData={step1Data}
        />
      )}
      {view === "signup2" && (
        <SignUpStep2Screen
          // FIX 2c: Pass step1Data as prop so Step 2 can use it
          step1Data={step1Data}
          // FIX 2d: Going Back does NOT clear step1Data — fields stay filled
          onBack={() => setView("signup1")}
          onGoSignIn={() => { setStep1Data(null); setView("signin"); }}
          onSubmitSuccess={() => { setStep1Data(null); setView("signin"); }}
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