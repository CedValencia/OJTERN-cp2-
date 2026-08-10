import React, { useState } from "react";
import logo from "../icons/ojtern.png";
import photoMichael from "../icons/team/Valencia.png";
import photoJames from "../icons/team/Day.png";
import photoRose from "../icons/team/Natino.png";
import photoHenrick from "../icons/team/Guanlao.png";
import photoJayem from "../icons/team/Gueco.png";

const team = [
  { name: "Michael Cedrick Valencia", role: "Programmer",           photo: photoMichael },
  { name: "James Anthony M. Day",     role: "Project Manager",      photo: photoJames },
  { name: "Rose Ann M. Natino",       role: "Database Designer",    photo: photoRose },
  { name: "John Henrick B. Guanlao",  role: "UI/UX Designer",       photo: photoHenrick },
  { name: "Jay-em C. Gueco",          role: "Quality Assurance Tester", photo: photoJayem },
];

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

    .about-tabs {
      display: flex;
      gap: 8px;
      width: 100%;
      max-width: 420px;
      margin: 18px auto 4px;
      padding: 0 4px;
    }

    .about-tab-btn {
      flex: 1;
      border: none;
      cursor: pointer;
      font-family: 'Kufam', sans-serif;
      font-weight: 700;
      font-size: clamp(0.78rem, 2.6vw, 0.88rem);
      padding: 10px 12px;
      border-radius: 10px;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .about-tab-btn.active {
      background: ${darkRed};
      color: white;
    }

    .about-tab-btn:not(.active) {
      background: #e2e2e2;
      color: #666;
    }

    .about-headline {
      font-family: 'Jua', sans-serif;
      font-size: clamp(1.1rem, 4.5vw, 1.35rem);
      color: white;
      margin: 0 0 4px;
      line-height: 1.35;
    }

    .about-team-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 16px;
      width: 100%;
    }

    .about-team-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
    }

    .about-team-photo {
      width: 84px;
      height: 84px;
      border-radius: 50%;
      object-fit: cover;
      border: 2.5px solid white;
      box-shadow: 0 3px 10px rgba(0,0,0,0.25);
    }

    .about-team-name {
      font-family: 'Kufam', sans-serif;
      font-weight: 700;
      font-size: clamp(0.72rem, 2.4vw, 0.8rem);
      color: white;
      margin: 0;
      line-height: 1.3;
    }

    .about-team-role {
      font-family: 'Kufam', sans-serif;
      font-size: clamp(0.65rem, 2.1vw, 0.7rem);
      color: rgba(255,255,255,0.75);
      margin: 0;
    }

    .about-cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 6px;
      padding: 12px 28px;
      border-radius: 30px;
      border: none;
      background: white;
      color: ${darkRed};
      font-family: 'Kufam', sans-serif;
      font-weight: 700;
      font-size: clamp(0.82rem, 2.6vw, 0.9rem);
      cursor: pointer;
      text-decoration: none;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
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
const AboutScreen = ({ onBack }) => {
  const [tab, setTab] = useState("about"); // "about" | "privacy"

  return (
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

      {/* ── Tabs ── */}
      <div className="about-tabs">
        <button
          className={`about-tab-btn ${tab === "about" ? "active" : ""}`}
          onClick={() => setTab("about")}
        >
          About Us
        </button>
        <button
          className={`about-tab-btn ${tab === "privacy" ? "active" : ""}`}
          onClick={() => setTab("privacy")}
        >
          Privacy Policy
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="about-body">

        {tab === "about" && (
          <>
            {/* Catchy Headline + Origin Story + Mission */}
            <SectionBlock title="About">
              <p className="about-headline">
                Your OJT Journey, Simplified.
              </p>
              <p className="about-policy-body">
                <span style={{ fontWeight: 700 }}>Our Story{"\n"}</span>
                OJTern started as a capstone project by five college students who
                went through the same messy, paper-heavy OJT process we're now
                fixing — scattered requirements, unclear application statuses, and
                no easy way for coordinators to keep track of everyone. We built
                OJTern to turn that frustration into a single, organized platform
                for students, coordinators, and companies alike.
                {"\n\n"}
                <span style={{ fontWeight: 700 }}>What We Do{"\n"}</span>
                We simplify the entire OJT journey — from discovering the right
                company match, submitting and tracking applications, logging daily
                time records, submitting weekly reports, to completing your
                internship with full documentation and confidence.
                {"\n\n"}
                <span style={{ fontWeight: 700 }}>Our Mission{"\n"}</span>
                To make On-the-Job Training accessible, meaningful, and digitally
                empowered for every Filipino student — regardless of school,
                location, or industry.
              </p>
            </SectionBlock>

            {/* Meet the Team */}
            <SectionBlock title="Meet the Team">
              <div className="about-team-grid">
                {team.map((member) => (
                  <div className="about-team-card" key={member.name}>
                    <img src={member.photo} alt={member.name} className="about-team-photo" />
                    <p className="about-team-name">{member.name}</p>
                    <p className="about-team-role">{member.role}</p>
                  </div>
                ))}
              </div>
            </SectionBlock>

            {/* Next Steps */}
            <SectionBlock title="Contact & Support">
              <p className="about-policy-body" style={{ marginBottom: "12px" }}>
                Have questions, feedback, or need help with your account? We'd love
                to hear from you.
              </p>
              <a href="mailto:support@ojtern.app" className="about-cta-btn">
                ✉️ Contact Us
              </a>
            </SectionBlock>
          </>
        )}

        {tab === "privacy" && (
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
              contact our support team at{" "}
              <span style={{ fontWeight: 700 }}>support@ojtern.app</span>.
            </PolicyItem>

            <PolicyItem heading="7. Compliance with Philippine Law">
              OJTern is committed to protecting your personal data in accordance
              with the Data Privacy Act of 2012 (Republic Act No. 10173) of the
              Republic of the Philippines and its Implementing Rules and
              Regulations. This includes upholding the principles of transparency,
              legitimate purpose, and proportionality in all our data processing
              activities.
            </PolicyItem>

            <div style={{ marginBottom: 0 }}>
              <p className="about-policy-heading">8. Changes to This Policy</p>
              <p className="about-policy-body">
                We may update this Privacy Policy from time to time. Any significant
                changes will be communicated through in-app notifications or via
                email. Continued use of OJTern after such changes constitutes
                acceptance of the updated policy.
              </p>
            </div>

          </SectionBlock>
        )}

        {/* Footer */}
        <p style={{
          fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem",
          color: "#aaa", textAlign: "center", marginTop: "8px",
        }}>
          © 2026 OJTern. All rights reserved. · support@ojtern.app
        </p>

      </div>
    </div>
  );
};

export default AboutScreen;