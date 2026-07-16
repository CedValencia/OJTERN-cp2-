import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

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
  const [animate, setAnimate]         = useState(false);
  const [showRight, setShowRight]     = useState(false);
  const [view, setView]               = useState("signin");
  const isMobile                      = useIsMobile();
  const [step1Data, setStep1Data]     = useState(null);
  const [resetEmail, setResetEmail]   = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Helper to change view and persist it so refresh restores same screen
  const changeView = (v) => {
    setView(v);
    if (["coordinator_dashboard","company_dashboard","student_dashboard"].includes(v)) {
      sessionStorage.setItem("ojtern_view", v);
    } else {
      sessionStorage.removeItem("ojtern_view");
    }
  };

  // ── Restore session after page refresh ────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const collections = ["coordinators", "students", "companies"];
        let userData = null;
        for (const col of collections) {
          const snap = await getDoc(doc(db, col, firebaseUser.uid));
          if (snap.exists()) { userData = snap.data(); break; }
        }
        if (userData && userData.status === "active") {
          setCurrentUser(userData);
          // Restore the view they were on before refresh
          const savedView = sessionStorage.getItem("ojtern_view");
          if (savedView) {
            setView(savedView);
          } else {
            if (userData.role === "coordinator") setView("coordinator_dashboard");
            else if (userData.role === "student")  setView("student_dashboard");
            else if (userData.role === "company")  setView("company_dashboard");
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

  // ── Full-screen dashboard views ────────────────────────────────────────────
  if (authChecking) return (
    <div style={{ width: "100vw", height: "100vh", background: "linear-gradient(180deg, #A32424 0%, #320000 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <img src={logo} alt="OJTern Logo" style={{ width: "120px", height: "120px", objectFit: "contain", marginBottom: "-10px" }} />
      <div style={{ fontFamily: "'Monomaniac One', sans-serif", fontSize: "3.5rem", color: "white", letterSpacing: "0.03em" }}>OJTern</div>
    </div>
  );

  if (view === "coordinator_dashboard") return <CoordinatorDashboardScreen user={currentUser} onLogout={() => { sessionStorage.removeItem("ojtern_view"); sessionStorage.removeItem("ojtern_coord_nav"); setCurrentUser(null); setView("signin"); }} />;
  if (view === "company_dashboard")     return <CompanyDashboardScreen     user={currentUser} onLogout={() => { sessionStorage.removeItem("ojtern_view"); setCurrentUser(null); setView("signin"); }} />;
  if (view === "student_dashboard")     return <StudentDashboardScreen     user={currentUser} onLogout={() => { sessionStorage.removeItem("ojtern_view"); sessionStorage.removeItem("ojtern_student_nav"); setCurrentUser(null); setView("signin"); }} />;

  // ── Right panel content ────────────────────────────────────────────────────
  const rightPanel = (
    <>
      {view === "signin" && (
        <SignInScreen
          onGoSignUp={() => setView("signup1")}
          onSignInCoordinator={(userData) => { setCurrentUser(userData); changeView("coordinator_dashboard"); }}
          onSignInStudent={(userData) => { setCurrentUser(userData); changeView("student_dashboard"); }}
          onSignInCompany={(userData) => { setCurrentUser(userData); changeView("company_dashboard"); }}
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