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

const darkRed  = "#590101";
const gold     = "#FFFFFF";
const goldSoft = "#C7C7C7";
const teamGray = "#C7C7C7";

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&family=Monomaniac+One&display=swap');
    * { box-sizing: border-box; }

    .about-header-card {
      position: relative;
      z-index: 2;
      margin-top: 46px;
      background: white;
      border-radius: 14px;
      padding: 56px 40px 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 220px;
    }
    @media (max-width: 480px) {
      .about-header-card {
        padding: 56px 20px 10px;
        min-width: unset;
        width: 50%;
      }
    }

    .about-body {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding: 0 24px 16px;
      background: #f0f0f0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    @media (max-width: 480px) {
      .about-body { padding: 0 12px 14px; }
    }

    .about-app-name {
      font-family: 'Jersey 25', sans-serif;
      font-size: clamp(1.4rem, 5.5vw, 1.7rem);
      color: ${darkRed};
      font-weight: 500;
      margin: 0;
      line-height: 1;
      white-space: nowrap;
    }

    .about-tabs {
      display: flex;
      gap: 8px;
      width: 100%;
      max-width: 420px;
      margin: 18px auto 14px;
      padding: 0 4px;
    }

    .about-tab-btn {
      flex: 1;
      border: none;
      cursor: pointer;
      font-family: 'Kufam', sans-serif;
      font-weight: 700;
      font-size: clamp(0.72rem, 2.2vw, 0.8rem);
      padding: 8px 12px;
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

    /* ── Story split: narrative left, team spotlight right ── */
    .about-story {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 0;
      background: ${darkRed};
      border-radius: 18px;
      overflow: hidden;
      width: 100%;
      max-width: 100%;
      margin-bottom: 10px;
      min-height: 300px;
      flex-shrink: 0;   /* 👈 idagdag ito */
    }
    @media (max-width: 620px) {
    .about-story {
      grid-template-columns: 1fr;
      min-height: unset;
      flex-shrink: 0;   /* 👈 idagdag din dito para sigurado */
    }
    .about-story-seal {
      border-left: none !important;
      border-top: 1px dashed rgba(0,0,0,0.15);
    }
  }

    .about-story-main {
      background: ${darkRed};
      padding: 18px 20px;
      max-height: 420px;
      overflow-y: auto;
      overflow-x: hidden;
      min-width: 0;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.25) transparent;
    }
    .about-story-main::-webkit-scrollbar { width: 6px; }
    .about-story-main::-webkit-scrollbar-track { background: transparent; }
    .about-story-main::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.25);
      border-radius: 10px;
    }
    /* Mobile: let the story flow with the page instead of trapping scroll
       in its own inner box. Placed AFTER the base rule above so it wins. */
    @media (max-width: 620px) {
      .about-story-main { max-height: none; overflow-y: visible; }
    }
    @media (max-width: 480px) {
      .about-story-main { padding: 16px 14px; }
    }

    .about-headline {
      font-family: 'Jua', sans-serif;
      font-size: clamp(1.05rem, 4vw, 1.25rem);
      color: white;
      margin: 0 0 12px;
      line-height: 1.3;
      text-align: center;
    }

    .about-story-eyebrow {
      font-family: 'Kufam', sans-serif;
      color: white;
      font-size: 0.85rem;
      margin: 0 0 5px;
      font-weight: 700;
      text-transform: none;
      letter-spacing: normal;
    }

    .about-story-block { margin-bottom: 12px; }
    .about-story-block:last-child { margin-bottom: 0; }

    .about-story-block h4 {
      font-family: 'Kufam', sans-serif;
      color: white;
      font-size: 0.85rem;
      margin: 0 0 5px;
      font-weight: 700;
    }

    .about-story-block p {
      font-family: 'Kufam', sans-serif;
      color: rgba(255,255,255,0.85);
      font-size: clamp(0.78rem, 2.3vw, 0.85rem);
      line-height: 1.55;
      margin: 0;
      text-align: justify;   /* 👈 galing sa "left" */
    }

    .about-story-seal {
      background: ${teamGray};
      padding: 16px 18px;
      border-left: 1px dashed rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 0;
    }

    .about-team-eyebrow {
      font-family: 'Jua', sans-serif;
      font-size: clamp(1rem, 3.8vw, 1.2rem);
      font-weight: normal;
      letter-spacing: normal;
      text-transform: none;
      color: ${darkRed};
      margin: 0 0 6px;
      line-height: 1.3;
      text-align: center;
      align-self: center;
    }

    /* Centers the image + info in the remaining space below the heading */
    .about-spotlight-wrap {
      flex: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* ── Spotlight carousel ── */
    .about-spotlight {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }

    .about-nav-arrow {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: none;
      background: rgba(0,0,0,0.08);
      color: ${darkRed};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .about-nav-arrow:hover { background: rgba(89,1,1,0.18); }
    .about-nav-arrow:active { transform: scale(0.92); }

    .about-spotlight-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .about-spot-photo-ring {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 2.5px solid ${darkRed};
      padding: 3px;
      margin-bottom: 8px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.25);
      transition: opacity 0.15s ease;
      flex-shrink: 0;
    }
    @media (max-width: 620px) {
      .about-spot-photo-ring { width: 130px; height: 130px; }
    }
    @media (max-width: 380px) {
      .about-spot-photo-ring { width: 100px; height: 100px; }
      .about-nav-arrow { width: 22px; height: 22px; }
    }

    .about-spot-photo {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      display: block;
    }

    .about-spot-name {
      font-family: 'Kufam', sans-serif;
      color: #2A1414;
      font-size: 0.88rem;
      font-weight: 700;
      margin: 0 0 3px;
      line-height: 1.25;
      transition: opacity 0.15s ease;
    }

    .about-spot-role {
      font-family: 'Kufam', sans-serif;
      color: ${darkRed};
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      transition: opacity 0.15s ease;
    }

    .about-spot-fade { opacity: 0; }

    .about-spot-dots {
      display: flex;
      gap: 6px;
      justify-content: center;
      margin-top: 10px;
    }

    .about-spot-dots button {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      border: none;
      padding: 0;
      background: rgba(0,0,0,0.2);
      cursor: pointer;
      transition: background 0.15s ease, transform 0.15s ease;
    }

    .about-spot-dots button.active {
      background: ${darkRed};
      transform: scale(1.2);
    }

    /* ── Why Choose Us / Features ── */
    .about-features-title {
      font-family: 'Jua', sans-serif;
      font-size: clamp(1rem, 3.6vw, 1.15rem);
      color: ${darkRed};
      margin: 4px 0 12px;
      text-align: center;
    }

    .about-features-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      width: 100%;
      margin-bottom: 10px;
    }
    @media (max-width: 420px) {
      .about-features-grid { grid-template-columns: 1fr; }
    }

    .about-feature-card {
      background: white;
      border-radius: 14px;
      padding: 14px 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .about-feature-icon {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: ${darkRed};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      margin-bottom: 4px;
    }

    .about-feature-title {
      font-family: 'Kufam', sans-serif;
      font-size: 0.8rem;
      font-weight: 700;
      color: #2A1414;
      margin: 0;
    }

    .about-feature-desc {
      font-family: 'Kufam', sans-serif;
      font-size: 0.72rem;
      color: #6b6b6b;
      line-height: 1.45;
      margin: 0;
    }

    /* ── Contact ── */
    .about-contact {
      margin-top: 4px;
      background: ${goldSoft};
      border-radius: 16px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      width: 100%;
    }
    @media (max-width: 480px) {
      .about-contact { padding: 14px 14px; }
    }

    .about-contact p {
      margin: 0;
      font-family: 'Kufam', sans-serif;
      font-size: 0.76rem;
      color: #2A1414;
      max-width: 340px;
      line-height: 1.4;
    }

    .about-contact strong {
      display: block;
      font-family: 'Jersey 25', sans-serif;
      font-size: 1rem;
      color: ${darkRed};
      margin-bottom: 3px;
      font-weight: 400;
    }

    .about-cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: ${darkRed};
      color: white;
      border: none;
      border-radius: 30px;
      padding: 10px 22px;
      font-family: 'Kufam', sans-serif;
      font-weight: 700;
      font-size: 0.78rem;
      cursor: pointer;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(89,1,1,0.3);
      white-space: nowrap;
    }

    /* ── Privacy ── */
    .about-privacy-block {
      background: ${darkRed};
      border-radius: 16px;
      padding: 16px 20px;
      width: 100%;
    }
    @media (max-width: 480px) {
      .about-privacy-block { padding: 14px 14px; }
    }

    .about-privacy-item {
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .about-privacy-item:last-child { border-bottom: none; }

    .about-privacy-heading {
      font-family: 'Kufam', sans-serif;
      font-size: 0.64rem;
      color: ${gold};
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .about-privacy-body {
      font-family: 'Kufam', sans-serif;
      font-size: clamp(0.7rem, 2vw, 0.76rem);
      color: rgba(255,255,255,0.82);
      line-height: 1.5;
      margin: 0;
      text-align: justify;
    }

    .about-footer-note {
      font-family: 'Kufam', sans-serif;
      font-size: 0.68rem;
      color: #aaa;
      text-align: center;
      margin-top: 12px;
      font-weight: 600;
    }
  `}</style>
);

// ─── PRIVACY ITEM ───────────────────────────────────────────────────────────
const PrivacyItem = ({ heading, children, last }) => (
  <div
    className="about-privacy-item"
    style={last ? { borderBottom: "none" } : undefined}
  >
    <p className="about-privacy-heading">{heading}</p>
    <p className="about-privacy-body">{children}</p>
  </div>
);

// ─── TEAM SPOTLIGHT CAROUSEL ────────────────────────────────────────────────
const TeamSpotlight = () => {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const member = team[index];

  const changeMember = (direction) => {
    setFading(true);
    setTimeout(() => {
      setIndex((prev) => (prev + direction + team.length) % team.length);
      setFading(false);
    }, 120);
  };

  const goToMember = (i) => {
    if (i === index) return;
    setFading(true);
    setTimeout(() => {
      setIndex(i);
      setFading(false);
    }, 120);
  };

  return (
    <>
      <p className="about-team-eyebrow">Meet the Team</p>

      <div className="about-spotlight-wrap">
        <div className="about-spotlight">
          <button className="about-nav-arrow" onClick={() => changeMember(-1)} aria-label="Previous">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="about-spotlight-content">
            <div className={`about-spot-photo-ring ${fading ? "about-spot-fade" : ""}`}>
              <img src={member.photo} alt={member.name} className="about-spot-photo" />
            </div>
            <p className={`about-spot-name ${fading ? "about-spot-fade" : ""}`}>{member.name}</p>
            <span className={`about-spot-role ${fading ? "about-spot-fade" : ""}`}>{member.role}</span>
          </div>

          <button className="about-nav-arrow" onClick={() => changeMember(1)} aria-label="Next">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="about-spot-dots">
          {team.map((_, i) => (
            <button
              key={i}
              className={i === index ? "active" : ""}
              onClick={() => goToMember(i)}
              aria-label={`Member ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </>
  );
};

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
            position: "absolute", top: "-28px",
            width: "75px", height: "75px", borderRadius: "50%",
            background: "#320000",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 3, boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}>
            <img src={logo} alt="OJTern"
              style={{ width: "56px", height: "56px", objectFit: "contain", display: "block" }} />
          </div>

          <p className="about-app-name">OJTern</p>
          <span style={{
            fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem",
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
            {/* Story (left) + Team spotlight carousel (right) */}
            <div className="about-story">
              <div className="about-story-main">
                <p className="about-headline">Your OJT Journey, Simplified.</p>
                <p className="about-story-eyebrow">Our Story</p>

                <div className="about-story-block">
                  <p>
                    OJTern started as a capstone project by five college students who
                    went through the same messy, paper-heavy OJT process we're now
                    fixing — scattered requirements, unclear application statuses, and
                    no easy way for coordinators to keep track of everyone.
                  </p>
                </div>

                <div className="about-story-block">
                  <h4>What We Do</h4>
                  <p>
                    We simplify the entire OJT journey — from discovering the right
                    company match, to submitting and tracking applications, logging
                    daily time records, submitting weekly reports, and completing
                    your internship with full documentation.
                  </p>
                </div>

                <div className="about-story-block">
                  <h4>Our Mission</h4>
                  <p>
                    To make On-the-Job Training accessible, meaningful, and digitally
                    empowered for every Filipino student — regardless of school,
                    location, or industry.
                  </p>
                </div>

                <div className="about-story-block">
                  <h4>Our Values</h4>
                  <p>
                    Transparency in every application status, simplicity in every
                    workflow, and accountability in every record — we build OJTern
                    around the people who use it: students, coordinators, and
                    partner companies alike.
                  </p>
                </div>

                <div className="about-story-block">
                  <h4>Where We're Headed</h4>
                  <p>
                    We're continuously expanding OJTern's reach to more schools and
                    industries, with upcoming features for automated evaluation
                    forms, in-app messaging with coordinators, and deeper analytics
                    for OJT supervisors.
                  </p>
                </div>
              </div>

              <div className="about-story-seal">
                <TeamSpotlight />
              </div>
            </div>

            {/* Why choose us */}
            <p className="about-features-title">OJTERN Offers</p>
            <div className="about-features-grid">
              <div className="about-feature-card">
                <div className="about-feature-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                </div>
                <p className="about-feature-title">Real-Time Tracking</p>
                <p className="about-feature-desc">
                  Monitor your daily time records and OJT hours as they're logged —
                  no more manual tallying.
                </p>
              </div>

              <div className="about-feature-card">
                <div className="about-feature-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                </div>
                <p className="about-feature-title">Smart Company Matching</p>
                <p className="about-feature-desc">
                  Discover partner companies aligned with your program and career
                  interests.
                </p>
              </div>

              <div className="about-feature-card">
                <div className="about-feature-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
                    <path d="M14 3v6h6" />
                  </svg>
                </div>
                <p className="about-feature-title">Paperless Documentation</p>
                <p className="about-feature-desc">
                  Submit requirements, reports, and evaluations digitally, all in
                  one place.
                </p>
              </div>

              <div className="about-feature-card">
                <div className="about-feature-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <p className="about-feature-title">Coordinator Dashboard</p>
                <p className="about-feature-desc">
                  Give school coordinators a live view of every student's OJT
                  progress.
                </p>
              </div>
            </div>

            {/* Contact */}
            <div className="about-contact">
              <p>
                <strong>Need a hand?</strong>
                Have questions, feedback, or need help with your account? We'd love
                to hear from you.
              </p>
              <a href="mailto:ojtern@gmail.com" className="about-cta-btn">
                ✉️ Contact Us
              </a>
            </div>
          </>
        )}

        {tab === "privacy" && (
          <div className="about-privacy-block">
            <PrivacyItem heading="1. Information We Collect">
              OJTern collects personal information you voluntarily provide during
              registration and platform use — including your full name, email
              address, school or institution details, student ID, program and year
              level, and OJT-related records such as time logs, reports, and
              company placements.
            </PrivacyItem>

            <PrivacyItem heading="2. How We Use Your Information">
              Your data is used solely to operate and improve the OJTern platform.
              This includes facilitating OJT applications, enabling coordinator
              monitoring, generating progress reports, and maintaining academic
              records. We do not use your data for advertising or unauthorized
              profiling.
            </PrivacyItem>

            <PrivacyItem heading="3. Data Sharing & Third Parties">
              We do not sell, rent, or trade your personal information to any third
              party. Data may be shared with your academic institution or authorized
              partner companies strictly for OJT coordination purposes, and only
              with your knowledge and consent.
            </PrivacyItem>

            <PrivacyItem heading="4. Data Security">
              All data transmitted through OJTern is protected using
              industry-standard encryption protocols. We employ secure servers and
              access controls to prevent unauthorized access, disclosure, or
              alteration of your personal information.
            </PrivacyItem>

            <PrivacyItem heading="5. Data Retention">
              Your information is retained only for as long as necessary to fulfill
              the purposes described in this policy, or as required by your
              academic institution. Upon request, you may ask for the deletion of
              your account and associated data, subject to institutional and legal
              requirements.
            </PrivacyItem>

            <PrivacyItem heading="6. Your Rights">
              You have the right to access, update, or request deletion of your
              personal data at any time. For any privacy-related concerns, you may
              contact our support team at ojtern@gmail.com.
            </PrivacyItem>

            <PrivacyItem heading="7. Compliance with Philippine Law">
              OJTern is committed to protecting your personal data in accordance
              with the Data Privacy Act of 2012 (Republic Act No. 10173) of the
              Republic of the Philippines and its Implementing Rules and
              Regulations. This includes upholding the principles of transparency,
              legitimate purpose, and proportionality in all our data processing
              activities.
            </PrivacyItem>

            <PrivacyItem heading="8. Changes to This Policy" last>
              We may update this Privacy Policy from time to time. Any significant
              changes will be communicated through in-app notifications or via
              email. Continued use of OJTern after such changes constitutes
              acceptance of the updated policy.
            </PrivacyItem>
          </div>
        )}

        {/* Footer */}
        <p className="about-footer-note">
          © 2026 OJTern. All rights reserved. · ojtern@gmail.com
        </p>

      </div>
    </div>
  );
};

export default AboutScreen;