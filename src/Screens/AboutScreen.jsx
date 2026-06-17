import React from "react";
import logo from "../icons/ojtern.png";

const darkRed = "#590101";
const cardBg  = "#7A4F4F";

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&family=Monomaniac+One&display=swap');
    * { box-sizing: border-box; }

    .about-header-card {
      position: relative;
      z-index: 2;
      margin-top: 60px;
      background: white;
      border-radius: 16px;
      padding: 52px 48px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 260px;
    }
    @media (max-width: 480px) {
      .about-header-card {
        padding: 52px 20px 14px;
        min-width: unset;
        width: 90%;
      }
    }

    .about-body {
      flex: 1;
      overflow-y: auto;
      padding: 0 24px 28px;
      background: #f0f0f0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    @media (max-width: 480px) {
      .about-body { padding: 0 12px 24px; }
    }

    .about-section-block {
      background: ${darkRed};
      border-radius: 16px;
      padding: 18px 20px;
      margin-bottom: 14px;
      width: 100%;
      box-sizing: border-box;
    }
    @media (max-width: 480px) {
      .about-section-block { padding: 14px 12px; }
    }

    .about-card-inner {
      background: ${cardBg};
      border-radius: 10px;
      padding: 14px 16px;
    }
    @media (max-width: 480px) {
      .about-card-inner { padding: 12px 10px; }
    }

    .about-divider {
      width: 80%;
      height: 1.5px;
      background: #ccc;
      margin: 16px auto;
      border-radius: 2px;
    }
    @media (max-width: 480px) {
      .about-divider { width: 92%; }
    }

    .about-app-name {
      font-family: 'Jersey 25', sans-serif;
      font-size: clamp(1.2rem, 5vw, 1.5rem);
      color: ${darkRed};
      font-weight: 500;
      margin: 0;
      white-space: nowrap;
    }

    .about-section-title {
      font-family: 'Kufam', sans-serif;
      font-weight: 700;
      font-size: clamp(0.9rem, 3vw, 1.05rem);
      color: white;
      margin: 0 0 12px;
    }

    .about-policy-body {
      font-family: 'Kufam', sans-serif;
      font-size: clamp(0.78rem, 2.5vw, 0.85rem);
      color: white;
      line-height: 1.8;
      margin: 0;
    }

    .about-policy-heading {
      font-family: 'Kufam', sans-serif;
      font-size: clamp(0.72rem, 2.2vw, 0.78rem);
      color: white;
      font-weight: 700;
      margin: 0 0 5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  `}</style>
);

// ─── SECTION BLOCK ─────────────────────────────────────────────────────────────
const SectionBlock = ({ title, children }) => (
  <div className="about-section-block">
    <h2 className="about-section-title">{title}</h2>
    <div className="about-card-inner">{children}</div>
  </div>
);

// ─── POLICY ITEM ───────────────────────────────────────────────────────────────
const PolicyItem = ({ heading, children }) => (
  <div style={{ marginBottom: "14px", paddingBottom: "14px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
    <p className="about-policy-heading">{heading}</p>
    <p className="about-policy-body">{children}</p>
  </div>
);

// ─── ABOUT SCREEN ─────────────────────────────────────────────────────────────
const AboutScreen = ({ onBack }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f0f0f0" }}>
    <ResponsiveStyles />

    {/* ── Red header ── */}
    <div style={{ position: "relative", flexShrink: 0, zIndex: 1, display: "flex", justifyContent: "center" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: "80px", background: darkRed,
        borderBottomLeftRadius: "30px", borderBottomRightRadius: "30px",
        zIndex: 1,
      }} />

      <div className="about-header-card">
        {/* Logo circle */}
        <div style={{
          position: "absolute", top: "-40px",
          width: "80px", height: "80px", borderRadius: "50%",
          background: "#320000",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 3, boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}>
          <img src={logo} alt="OJTern"
            style={{ width: "70px", height: "70px", objectFit: "contain", display: "block" }} />
        </div>

        <p className="about-app-name">OJTern</p>
        <span style={{
          fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem",
          color: "#888", fontWeight: 600, marginTop: "2px",
        }}>
          Version 2.1.0
        </span>
      </div>
    </div>

    <div className="about-divider" />

    {/* ── Scrollable body ── */}
    <div className="about-body">

      {/* ── About ── */}
      <SectionBlock title="About">
        <p className="about-policy-body">
          <span style={{ fontWeight: 700 }}>OJTern</span> is a comprehensive
          On-the-Job Training management platform designed specifically for
          Filipino college students, academic coordinators, and partner companies
          across the Philippines.
          {"\n\n"}
          We simplify the entire OJT journey — from discovering the right company
          match, submitting and tracking applications, logging daily time records,
          submitting weekly reports, to completing your internship with full
          documentation and confidence.
          {"\n\n"}
          Our platform bridges the gap between education and industry by creating
          a transparent, structured, and efficient environment for all
          stakeholders. Students gain real-world exposure, coordinators maintain
          oversight with ease, and companies connect with motivated young talent —
          all within a single, unified system.
          {"\n\n"}
          <span style={{ fontWeight: 700 }}>Our Mission{"\n"}</span>
          To make On-the-Job Training accessible, meaningful, and digitally
          empowered for every Filipino student — regardless of school, location,
          or industry.
        </p>
      </SectionBlock>

      {/* ── Privacy Policy ── */}
      <SectionBlock title="Privacy Policy">

        <PolicyItem heading="1. Information We Collect">
          <span style={{ fontWeight: 700 }}>OJTern</span> collects personal
          information you voluntarily provide during registration and platform use
          — including your full name, email address, school or institution details,
          student ID, program and year level, and OJT-related records such as time
          logs, reports, and company placements.
        </PolicyItem>

        <PolicyItem heading="2. How We Use Your Information">
          Your data is used solely to operate and improve the OJTern platform.
          This includes facilitating OJT applications, enabling coordinator
          monitoring, generating progress reports, and maintaining academic
          records. We do not use your data for advertising or unauthorized
          profiling.
        </PolicyItem>

        <PolicyItem heading="3. Data Sharing & Third Parties">
          We do not sell, rent, or trade your personal information to any third
          party. Data may be shared with your academic institution or authorized
          partner companies strictly for OJT coordination purposes, and only with
          your knowledge and consent.
        </PolicyItem>

        <PolicyItem heading="4. Data Security">
          All data transmitted through OJTern is protected using industry-standard
          encryption protocols. We employ secure servers and access controls to
          prevent unauthorized access, disclosure, or alteration of your personal
          information.
        </PolicyItem>

        <PolicyItem heading="5. Data Retention">
          Your information is retained only for as long as necessary to fulfill
          the purposes described in this policy, or as required by your academic
          institution. Upon request, you may ask for the deletion of your account
          and associated data, subject to institutional and legal requirements.
        </PolicyItem>

        <PolicyItem heading="6. Your Rights">
          You have the right to access, update, or request deletion of your
          personal data at any time. For any privacy-related concerns, you may
          contact our support team directly through the app or via our official
          communication channels.
        </PolicyItem>

        <div style={{ marginBottom: 0 }}>
          <p className="about-policy-heading">7. Changes to This Policy</p>
          <p className="about-policy-body">
            We may update this Privacy Policy from time to time. Any significant
            changes will be communicated through in-app notifications or via
            email. Continued use of OJTern after such changes constitutes
            acceptance of the updated policy.
          </p>
        </div>

      </SectionBlock>

      {/* Footer */}
      <p style={{
        fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem",
        color: "#aaa", textAlign: "center", marginTop: "8px",
      }}>
        © 2026 OJTern. All rights reserved.
      </p>

    </div>
  </div>
);

export default AboutScreen;