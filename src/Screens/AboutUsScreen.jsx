import React, { useState, useEffect, useRef, useCallback } from "react";
import logo from "../icons/ojtern.png";
import photoMichael from "../icons/team/Valencia.png";
import photoJames from "../icons/team/Day.png";
import photoRose from "../icons/team/Natino.png";
import photoHenrick from "../icons/team/Guanlao.png";
import photoJayem from "../icons/team/Gueco.png";

import { color, font, ease, radius, shadow } from "./theme";

const team = [
  { name: "Michael Cedrick Valencia", role: "Programmer",           photo: photoMichael },
  { name: "James Anthony M. Day",     role: "Project Manager",      photo: photoJames },
  { name: "Rose Ann M. Natino",       role: "Database Designer",    photo: photoRose },
  { name: "John Henrick B. Guanlao",  role: "UI/UX Designer",       photo: photoHenrick },
  { name: "Jay-em C. Gueco",          role: "Quality Assurance Tester", photo: photoJayem },
];

const AUTOPLAY_MS = 3000;

// ─── Shared styles, all pulled from theme.js so this always matches the
// current front-end (light field + dark panel) instead of its own palette ──
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;500;600;700&display=swap');

    .au-root { width: 100%; display: flex; flex-direction: column; background: ${color.wine800}; }

    .au-header {
      position: relative; flex-shrink: 0;
      background: linear-gradient(165deg, ${color.blush100} 0%, #0c0c0c 100%);
      border-bottom-left-radius: 30px; border-bottom-right-radius: 30px;
      display: flex; justify-content: center;
      padding: 60px 20px 46px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.16);
      overflow: visible;
    }
    @media (max-width: 520px) {
      .au-header { padding: 52px 16px 42px; }
    }

    .au-back-btn {
      position: absolute; top: 18px; left: 18px; z-index: 5;
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 18px 9px 14px; border-radius: 999px;
      border: 1.5px solid ${color.onWineFaint};
      background: rgba(255,255,255,0.06);
      color: ${color.onWine};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 700; font-size: 0.85rem;
      cursor: pointer;
      transition: background 160ms ${ease}, transform 160ms ${ease}, border-color 160ms ${ease};
    }
    .au-back-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.4); }
    .au-back-btn:active { transform: scale(0.96); }

    .au-header-card {
      position: absolute; left: 50%; bottom: 0;
      transform: translate(-50%, 50%);
      z-index: 5;
      background: ${color.wine700};
      border-radius: 20px;
      padding: 20px 40px 16px;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.40);
      min-width: 220px;
    }
    .au-logo-badge {
      width: 80px; height: 80px; border-radius: 50%;
      background: #898989;
      border: 2px solid #ffffff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.28);
      margin-top: -40px;
      margin-bottom: 6px;
    }
    .au-logo-badge img { width: 70px; height: 70px; object-fit: contain; filter: brightness(0) invert(1); }
    .au-app-name {
      font-family: 'Jersey 25', sans-serif;
      font-size: clamp(1.4rem, 5.5vw, 1.7rem);
      color: ${color.ink}; font-weight: 500; margin: 0; line-height: 1;
    }

    /* ── Body: wider content column so the story + team panel gets more room ── */
    .au-body {
      padding: 76px 24px 40px;
      display: flex; flex-direction: column; align-items: center; gap: 22px;
      max-width: 1600px; width: 100%; margin: 0 auto;
    }

    /* ── Story split ── */
    .au-story {
      display: grid; grid-template-columns: 1.15fr 1fr; gap: 0;
      background: ${color.blush100};
      border-radius: ${radius.panel};
      overflow: hidden; width: 100%;
      min-height: 320px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.08);
      animation: auFadeUp 480ms ${ease} both;
    }
    @media (max-width: 720px) {
      .au-story { grid-template-columns: 1fr; min-height: unset; }
      .au-story-seal { border-left: none !important; border-top: 1px dashed ${color.blush300}; }
    }

    .au-story-main { padding: 30px 34px 28px; }
    .au-headline {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: clamp(1.05rem, 4vw, 1.3rem); font-weight: 700;
      color: ${color.onWine}; margin: 0 0 16px; text-align: center;
    }
    .au-story-block { margin-bottom: 14px; }
    .au-story-block:last-child { margin-bottom: 0; }
    .au-story-block h4 {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${color.onWine};
      font-size: 0.85rem; margin: 0 0 5px; font-weight: 700;
    }
    .au-story-block p {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${color.onWineMuted};
      font-size: clamp(0.78rem, 2.3vw, 0.85rem); line-height: 1.6;
      margin: 0; text-align: justify;
    }

    .au-story-seal {
      background: ${color.wine800};
      padding: 22px 20px;
      border-left: 1px dashed ${color.blush300};
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-width: 0;
    }
    .au-team-eyebrow {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: clamp(1.1rem, 4.2vw, 1.4rem); font-weight: 700;
      color: ${color.ink}; margin: 40px 0 14px; text-align: center;
    }

    .au-spotlight-wrap { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .au-spotlight { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; }

    .au-nav-arrow {
      flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%;
      border: 1.5px solid ${color.blush300};
      background: ${color.white}; color: ${color.ink};
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: ${shadow.input};
      transition: background 160ms ${ease}, transform 160ms ${ease}, box-shadow 160ms ${ease};
    }
    .au-nav-arrow:hover { background: ${color.ink}; color: ${color.white}; box-shadow: ${shadow.pill}; }
    .au-nav-arrow:active { transform: scale(0.9); }

    .au-spotlight-content { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }

    .au-spot-photo-ring {
      width: 168px; height: 168px; border-radius: 50%;
      border: 4px solid ${color.ink}; padding: 3px; margin-bottom: 14px;
      box-shadow: 0 8px 22px rgba(0,0,0,0.18);
      background: ${color.white};
      transition: opacity 220ms ${ease}, transform 220ms ${ease};
    }
    .au-spot-photo { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
    .au-spot-name { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${color.ink}; font-size: 1.15rem; font-weight: 700; margin: 0 0 4px; transition: opacity 220ms ${ease}; }
    .au-spot-role {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${color.inkMuted};
      font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      transition: opacity 220ms ${ease};
    }
    .au-spot-fade-enter { opacity: 0; transform: translateY(6px) scale(0.97); }
    .au-spot-fade-enter-photo { opacity: 0; transform: scale(0.94); }

    .au-spot-dots { display: flex; gap: 7px; justify-content: center; margin-top: 14px; }
    .au-spot-dots button {
      width: 7px; height: 7px; border-radius: 50%; border: none; padding: 0;
      background: ${color.blush300}; cursor: pointer;
      transition: background 160ms ${ease}, transform 160ms ${ease}, width 220ms ${ease};
    }
    .au-spot-dots button.active { background: ${color.ink}; width: 20px; border-radius: 999px; }
    .au-spot-dots button:hover:not(.active) { background: ${color.inkMuted}; }

    /* ── Features ── */
    .au-features-title {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: clamp(1rem, 3.6vw, 1.2rem); font-weight: 700;
      color: ${color.ink}; margin: 4px 0 4px; text-align: center;
    }
    .au-features-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; width: 100%;
    }
    @media (max-width: 880px) { .au-features-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 520px) { .au-features-grid { grid-template-columns: 1fr; } }

    .au-feature-card {
      background: ${color.white}; border-radius: ${radius.card};
      padding: 18px 18px; box-shadow: ${shadow.input};
      display: flex; flex-direction: column; gap: 5px;
      border: 1px solid transparent;
      transition: transform 200ms ${ease}, box-shadow 200ms ${ease}, border-color 200ms ${ease};
      animation: auFadeUp 480ms ${ease} both;
    }
    .au-feature-card:hover {
      transform: translateY(-4px);
      box-shadow: ${shadow.panel};
      border-color: ${color.blush300};
    }
    .au-feature-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: ${color.ink};
      display: flex; align-items: center; justify-content: center;
      color: ${color.white}; margin-bottom: 4px;
      transition: transform 200ms ${ease};
    }
    .au-feature-card:hover .au-feature-icon { transform: rotate(-6deg) scale(1.06); }
    .au-feature-title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.85rem; font-weight: 700; color: ${color.ink}; margin: 0; }
    .au-feature-desc { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.76rem; color: ${color.inkMuted}; line-height: 1.5; margin: 0; }

    /* ── Contact ── */
    .au-contact {
      background: ${color.blush100};
      border-radius: ${radius.panel};
      padding: 20px 24px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; flex-wrap: wrap; width: 100%;
      box-shadow: 0 6px 20px rgba(0,0,0,0.08);
    }
    .au-contact p { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.8rem; color: ${color.onWineMuted}; max-width: 360px; line-height: 1.5; }
    .au-contact strong { display: block; font-family: 'Jersey 25', sans-serif; font-size: 1.05rem; color: ${color.onWine}; margin-bottom: 3px; font-weight: 400; }
    .au-cta-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: ${color.white}; color: ${color.ink};
      border: none; border-radius: 999px; padding: 12px 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 700; font-size: 0.82rem;
      cursor: pointer; text-decoration: none; white-space: nowrap;
      box-shadow: ${shadow.pill};
      transition: transform 160ms ${ease}, filter 160ms ${ease};
    }
    .au-cta-btn:hover { filter: brightness(1.05); transform: translateY(-2px); }
    .au-cta-btn:active { transform: scale(0.97); }

    .au-footer-note { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.7rem; color: ${color.inkFaint}; text-align: center; margin-top: 4px; font-weight: 600; }

    @keyframes auFadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `}</style>
);

// ─── TEAM SPOTLIGHT — autoplay + manual controls + progress dots ───────────
const TeamSpotlight = () => {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);
  const member = team[index];

  const goTo = useCallback((next) => {
    if (next === index) return;
    setFading(true);
    setTimeout(() => {
      setIndex(next);
      setFading(false);
    }, 180);
  }, [index]);

  const step = useCallback((dir) => {
    goTo((index + dir + team.length) % team.length);
  }, [index, goTo]);

  // Autoplay — resets its own clock any time the slide changes (manual or auto)
  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % team.length);
        setFading(false);
      }, 180);
    }, AUTOPLAY_MS);
    return () => clearInterval(timerRef.current);
  }, [index]);

  const pause = () => clearInterval(timerRef.current);
  const resume = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % team.length);
        setFading(false);
      }, 180);
    }, AUTOPLAY_MS);
  };

  return (
    <>
      <p className="au-team-eyebrow">Meet the Team</p>

      <div className="au-spotlight-wrap" onMouseEnter={pause} onMouseLeave={resume}>
        <div className="au-spotlight">
          <button className="au-nav-arrow" onClick={() => step(-1)} aria-label="Previous member">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="au-spotlight-content">
            <div className={`au-spot-photo-ring ${fading ? "au-spot-fade-enter-photo" : ""}`}>
              <img src={member.photo} alt={member.name} className="au-spot-photo" />
            </div>
            <p className={`au-spot-name ${fading ? "au-spot-fade-enter" : ""}`}>{member.name}</p>
            <span className={`au-spot-role ${fading ? "au-spot-fade-enter" : ""}`}>{member.role}</span>
          </div>

          <button className="au-nav-arrow" onClick={() => step(1)} aria-label="Next member">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="au-spot-dots">
          {team.map((_, i) => (
            <button
              key={i}
              className={i === index ? "active" : ""}
              onClick={() => goTo(i)}
              aria-label={`Member ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </>
  );
};

const FeatureIcon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
    <path d={d} />
  </svg>
);

const AboutUsScreen = ({ onBack }) => (
  <div className="au-root">
    <Styles />

    <div className="au-header">
      <button className="au-back-btn" onClick={onBack} type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>

      <div className="au-header-card">
        <div className="au-logo-badge">
          <img src={logo} alt="OJTern" />
        </div>
        <p className="au-app-name">OJTern</p>
      </div>
    </div>

    <div className="au-body">
      <div className="au-story">
        <div className="au-story-main">
          <p className="au-headline">Your OJT Journey, Simplified.</p>

          <div className="au-story-block">
            <h4>Our Story</h4>
            <p>
              OJTern started as a capstone project by five college students who
              went through the same messy, paper-heavy OJT process we're now
              fixing — scattered requirements, unclear application statuses, and
              no easy way for coordinators to keep track of everyone.
            </p>
          </div>

          <div className="au-story-block">
            <h4>What We Do</h4>
            <p>
              We simplify the entire OJT journey — from discovering the right
              company match, to submitting and tracking applications, logging
              daily time records, submitting weekly reports, and completing
              your internship with full documentation.
            </p>
          </div>

          <div className="au-story-block">
            <h4>Our Mission</h4>
            <p>
              To make On-the-Job Training accessible, meaningful, and digitally
              empowered for every Filipino student — regardless of school,
              location, or industry.
            </p>
          </div>

          <div className="au-story-block">
            <h4>Our Values</h4>
            <p>
              Transparency in every application status, simplicity in every
              workflow, and accountability in every record — we build OJTern
              around the people who use it: students, coordinators, and
              partner companies alike.
            </p>
          </div>

          <div className="au-story-block">
            <h4>Where We're Headed</h4>
            <p>
              We're continuously expanding OJTern's reach to more schools and
              industries, with upcoming features for automated evaluation
              forms, in-app messaging with coordinators, and deeper analytics
              for OJT supervisors.
            </p>
          </div>
        </div>

        <div className="au-story-seal">
          <TeamSpotlight />
        </div>
      </div>

      <p className="au-features-title">OJTERN Offers</p>
      <div className="au-features-grid">
        <div className="au-feature-card">
          <div className="au-feature-icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <p className="au-feature-title">Centralized Overview</p>
          <p className="au-feature-desc">
            See relevant stats and recent activity at a glance, so you
            always know where things stand.
          </p>
        </div>

        <div className="au-feature-card">
          <div className="au-feature-icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p className="au-feature-title">Find Companies</p>
          <p className="au-feature-desc">
            Students can search and filter through OJT opportunities to
            find the right company fit, faster.
          </p>
        </div>

        <div className="au-feature-card">
          <div className="au-feature-icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <p className="au-feature-title">Company Verification</p>
          <p className="au-feature-desc">
            Coordinators can review, approve, or decline registered
            companies to keep listings trustworthy.
          </p>
        </div>

        <div className="au-feature-card">
          <div className="au-feature-icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <path d="M17 8l-5-5-5 5" />
              <path d="M12 3v12" />
            </svg>
          </div>
          <p className="au-feature-title">Upload OJT Opportunities</p>
          <p className="au-feature-desc">
            Companies can post and manage open OJT opportunities, making
            it easy for students to discover and apply.
          </p>
        </div>

        <div className="au-feature-card">
          <div className="au-feature-icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <p className="au-feature-title">Application Tracking</p>
          <p className="au-feature-desc">
            Students can submit and follow every application from start
            to placement, with status updates the moment things change.
          </p>
        </div>

        <div className="au-feature-card">
          <div className="au-feature-icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10L12 5 2 10l10 5 10-5z" />
              <path d="M6 12v5c0 1.1 3 2 6 2s6-.9 6-2v-5" />
            </svg>
          </div>
          <p className="au-feature-title">Student Oversight</p>
          <p className="au-feature-desc">
            Coordinators can manage student accounts and keep track of
            everyone's OJT placement status in one place.
          </p>
        </div>

        <div className="au-feature-card">
          <div className="au-feature-icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <p className="au-feature-title">Manage Applicants</p>
          <p className="au-feature-desc">
            Companies can review and manage student applications with ease,
            from first submission to final decision.
          </p>
        </div>

        <div className="au-feature-card">
          <div className="au-feature-icon">
            <FeatureIcon d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </div>
          <p className="au-feature-title">Direct Messaging</p>
          <p className="au-feature-desc">
            Reach your coordinator or company directly in-app — no more
            chasing replies across email and chat groups.
          </p>
        </div>

        <div className="au-feature-card">
          <div className="au-feature-icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h4l3 8 4-16 3 8h4" />
            </svg>
          </div>
          <p className="au-feature-title">Activity Monitoring</p>
          <p className="au-feature-desc">
            Coordinators can track account activity across the system,
            keeping every action visible and accountable.
          </p>
        </div>
      </div>

      <div className="au-contact">
        <p>
          <strong>Need a hand?</strong>
          Have questions, feedback, or need help with your account? We'd love
          to hear from you.
        </p>
        <a href="mailto:ojtern@gmail.com" className="au-cta-btn">✉️ Contact Us</a>
      </div>

      <p className="au-footer-note">© 2026 OJTern. All rights reserved. · ojtern@gmail.com</p>
    </div>
  </div>
);

export default AboutUsScreen;