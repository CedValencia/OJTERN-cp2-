import React, { useState, useRef, useEffect, useMemo } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getAuth, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { db } from "./firebase";
import { initiateCoordinatorTransfer, initiateCoordinatorAddition, changePassword, requestCoordinatorEmailChange } from "./AuthService";
import { useDepartmentsPrograms } from "./departmentsPrograms";
import { TERMS_TEXT, PRIVACY_TEXT, parseLegalDoc } from "./legalContent";
import { color, font, type, space, radius, shadow, ease } from "./theme";

import PersonalAccountProfile from "../icons/personalaccountprofile.png";
import viewIcon from "../icons/view.png";

// ── Design tokens, aliased for this screen ────────────────────────────────────
// Same aliases as CoordinatorFindCompanyScreen / CoordinatorMessagesScreen.
// Walang hardcoded hex dito — sa theme.js lang ang edit kung magbabago ang palette.
const ink          = color.ink;
const inkBody      = color.inkBody;
const inkMuted     = color.inkMuted;
const inkFaint     = color.inkFaint;
const surface      = color.wine600;      // cards, rows, modals
const page         = color.wine900;      // page background
const field        = color.wine800;      // inputs / neutral fills
const line         = color.wine700;      // hairlines & borders
const lineSoft     = color.wine800;
const panel        = color.blush100;     // dark panels (banner, headers, footers)
const panelDeep    = color.blush50;
const onPanel      = color.onWine;
const onPanelDim   = color.onWineMuted;
const onPanelFaint = color.onWineFaint;
const danger       = color.danger;
const success      = color.success;
const warning      = color.warning;

// ── Password strength requirements ────────────────────────────────────────────
const PASSWORD_RULES = [
  { key: "length",    label: "At least 8 characters",                     test: pwd => pwd.length >= 8 },
  { key: "uppercase", label: "At least one uppercase letter (A–Z)",       test: pwd => /[A-Z]/.test(pwd) },
  { key: "lowercase", label: "At least one lowercase letter (a–z)",       test: pwd => /[a-z]/.test(pwd) },
  { key: "number",    label: "At least one number (0–9)",                 test: pwd => /[0-9]/.test(pwd) },
  { key: "special",   label: "At least one special character (!@#$%&*_…)", test: pwd => /[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(pwd) },
  { key: "noSpaces",  label: "No spaces",                                 test: pwd => !/\s/.test(pwd) },
];

const isPasswordStrong = (pwd) => PASSWORD_RULES.every(rule => rule.test(pwd));

const PasswordChecklist = ({ password }) => {
  if (!password) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", margin: `2px 0 ${space.md} 2px` }}>
      {PASSWORD_RULES.map(rule => {
        const passed = rule.test(password);
        return (
          <div key={rule.key} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={passed ? success : inkFaint} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              {passed ? <polyline points="20 6 9 17 4 12" /> : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
            </svg>
            <span style={{ fontFamily: font.ui, fontSize: "0.8125rem", lineHeight: 1.45, color: passed ? success : inkMuted }}>
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    .cap-screen *, .cap-modal * { box-sizing: border-box; }

    /* ── Profile header card ── */
    .cap-header-card {
      position: relative;
      z-index: 2;
      margin-top: 52px;
      background: ${surface};
      border-radius: ${radius.card};
      border: 1px solid ${line};
      padding: 44px 44px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: ${shadow.pill};
      min-width: 260px;
    }
    @media (max-width: 480px) {
      .cap-header-card { padding: 44px 22px 14px; min-width: unset; width: 90%; }
    }

    /* ── Menu body ── */
    .cap-body {
      flex: 1;
      overflow-y: auto;
      padding: 0 clamp(16px, 4vw, 32px) 32px;
      background: ${page};
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    /* ── Grouped list ── */
    .cap-menu-stack { width: 100%; }
    .cap-menu-group { margin-bottom: ${space.lg}; }

    /* ── Menu row ── */
    .cap-menu-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${space.md};
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.pill};
      padding: 15px 22px;
      margin-bottom: 10px;
      cursor: pointer;
      box-shadow: ${shadow.input};
      transition: border-color 220ms ${ease}, box-shadow 220ms ${ease};
      width: 100%;
      text-align: left;
      font: inherit;
    }
    .cap-menu-row:last-child { margin-bottom: 0; }
    .cap-menu-row:hover {
      border-color: ${color.wine400};
      box-shadow: 0 8px 22px rgba(10,10,10,0.08);
    }
    @media (max-width: 480px) {
      .cap-menu-row { padding: 13px 16px; }
    }

    /* ── Section header bar ── */
    .cap-section-header {
      background: ${panel};
      padding: 16px clamp(16px, 4vw, 28px);
      display: flex;
      align-items: center;
      gap: ${space.md};
      flex-shrink: 0;
    }

    /* ── Personal info body ── */
    .cap-info-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: clamp(16px, 4vw, 28px) clamp(14px, 4vw, 32px);
      background: ${page};
    }

    /* ── Inner info card ── */
    .cap-info-card { width: 100%; }

    /* ── Info row ── */
    .cap-info-row {
      background: ${surface};
      border: 1px solid ${line};
      border-radius: ${radius.card};
      padding: 14px 18px;
      margin-bottom: 10px;
      box-shadow: ${shadow.input};
    }
    @media (max-width: 480px) {
      .cap-info-row { padding: 12px 14px; }
    }

    /* ── Modal inner ── */
    .cap-modal-inner {
      background: ${surface};
      /* border: 1px solid ${line};  ← tanggalin */
      border-radius: ${radius.panel};
      box-shadow: ${shadow.panel};
      width: 420px;
      max-width: 88vw;
      max-height: 62vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    /* ── Modal scroll body ── */
    .cap-modal-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: ${space.lg};
    }
    @media (max-width: 480px) {
      .cap-modal-inner { max-width: 84vw; max-height: 48vh; }
      .cap-modal-body { padding: ${space.md}; }
    }

    /* ── Modal footer ── */
    .cap-modal-footer {
      background: ${panel};
      border-top: 1px solid ${line};
      padding: 12px ${space.lg};
      display: flex;
      justify-content: flex-end;
      gap: ${space.sm};
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    @media (max-width: 400px) {
      .cap-modal-footer { padding: 10px 14px; flex-direction: column-reverse; align-items: stretch; }
      .cap-modal-footer button { width: 100%; text-align: center; }
    }

    /* ── Divider line ── */
    .cap-divider {
      height: 1px;
      background: ${line};
      margin: ${space.md} clamp(16px, 4vw, 32px) ${space.lg};
    }

    /* ── Save row ── */
    .cap-save-row {
      display: flex;
      justify-content: flex-end;
      gap: ${space.sm};
      margin-top: ${space.md};
      flex-wrap: wrap;
    }

    /* Visible keyboard focus on every control in this screen */
    .cap-screen :focus-visible,
    .cap-modal :focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: ${radius.pill};
    }

    @keyframes capFadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes capLift   { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
    .cap-overlay { animation: capFadeIn 180ms ${ease} both; }
    .cap-dialog  { animation: capLift 240ms ${ease} both; }

    @media (prefers-reduced-motion: reduce) {
      .cap-overlay, .cap-dialog { animation: none !important; }
      .cap-menu-row { transition: none !important; }
    }
  `}</style>
);

// ── Legal panel styles ────────────────────────────────────────────────────────
// Same reading layout as LegalDocScreen — progress rail, "On this page"
// sidebar, sectioned body. The difference is scope: out on the splash screen
// those documents take over the whole window, but in here they open inside
// the content area beside the nav, so every measurement below is against
// this panel's own scroll container rather than the window.
const LegalStyles = () => (
  <style>{`
    .legal-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; background: ${page}; }
    .legal-progress-track { height: 3px; flex-shrink: 0; background: ${lineSoft}; }
    .legal-progress-fill {
      height: 100%;
      background: ${inkMuted};          /* dating ${panel} */
      transition: width 120ms linear;
    }

    .legal-cols { flex: 1; min-height: 0; display: flex; }

    .legal-toc {
      width: clamp(130px, 30vw, 240px);
      flex-shrink: 0;
      overflow-y: auto;
      padding: clamp(20px, 3vw, 28px) 0 40px clamp(16px, 3vw, 28px);
      border-right: 1px solid ${line};
    }
    .legal-toc-heading {
      font-family: ${font.ui};
      font-size: 0.8125rem;
      font-weight: 500;
      color: ${inkMuted};
      margin: 0 0 12px;
    }
    .legal-toc-btn {
      display: block; width: 100%; text-align: left;
      background: none; border: none; cursor: pointer;
      padding: 7px 0 7px 12px;
      font-family: ${font.ui};
      font-size: 0.8125rem;
      line-height: 1.45;
      transition: border-color 160ms ${ease}, color 160ms ${ease};
    }

    .legal-scroll {
      flex: 1;
      min-width: 0;
      position: relative;
      overflow-y: auto;
      padding: clamp(20px, 3vw, 32px) clamp(16px, 4vw, 44px) 56px;
    }

    /* Below this width the rail would eat the reading column, so the
       document runs full-width and sections are reached by scrolling. */

    @media (max-width: 480px) {
      .legal-toc { padding-left: 12px; padding-right: 8px; }
      .legal-toc-heading { font-size: 0.75rem; }
      .legal-toc-btn { font-size: 0.75rem; padding: 6px 0 6px 8px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .legal-progress-fill, .legal-toc-btn { transition: none !important; }
    }
  `}</style>
);

// ── Which parts of the shared legal documents a coordinator sees ──────────────
// TERMS_TEXT and PRIVACY_TEXT in legalContent.js address all three roles at
// once. The numbered subsections listed here are written purely for Students
// or for Companies, so they're dropped from this screen. Everything else is
// kept, which means a new section added to legalContent.js shows up here on
// its own. Subsections that describe what a Coordinator does with student or
// company data (2.2, 2.3, 3.x) stay in on purpose — those are the
// coordinator's own obligations, not another role's.
const COORDINATOR_SKIP = {
  terms:   [],
  privacy: [],
};

const forCoordinator = (blocks, skip) => {
  const out = [];
  let skipping = false;
  for (const b of blocks) {
    if (b.type === "h3")      skipping = skip.some(n => b.text.startsWith(`${n} `));
    else if (b.type === "h2") skipping = false;
    if (!skipping) out.push(b);
  }
  return out;
};

// ── Shared section header bar ─────────────────────────────────────────────────
function SectionHeaderBar({ title, onBack }) {
  return (
    <div className="cap-section-header">
      {onBack && <BackButton onClick={onBack} />}
      <h2 style={{ fontFamily: font.ui, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel, margin: 0 }}>{title}</h2>
    </div>
  );
}

// ── Email addresses in the legal text ─────────────────────────────────────────
// Gmail's compose URL rather than a plain mailto: — this is a web app, and
// mailto: hands the click to whatever desktop client is registered, which on
// most machines is nothing at all, so the link just looks broken. Applied to
// every paragraph and bullet, so any address added to legalContent.js later
// becomes clickable without touching this file.
const EMAIL_SPLIT = /([\w.+-]+@[\w-]+\.[\w-]+)/g;
const IS_EMAIL    = /^[\w.+-]+@[\w-]+\.[\w-]+$/;
const composeUrl  = (addr) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(addr)}`;

const linkifyEmails = (text) =>
  text.split(EMAIL_SPLIT).map((part, i) => {
    if (!IS_EMAIL.test(part)) return part;
    const linkStyle = { color: ink, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" };
    return <a key={i} href={composeUrl(part)} target="_blank" rel="noopener noreferrer" style={linkStyle}>{part}</a>;
  });
  
// ── Legal document panel (Terms / Privacy) ────────────────────────────────────
const LegalPanel = ({ title, text, skip, onBack }) => {
  const blocks    = useMemo(() => forCoordinator(parseLegalDoc(text), skip), [text, skip]);
  const scrollRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState(null);

  // Section list for the rail — built straight from the document's own h2
  // headings, so it can never drift out of sync with the text.
  const toc = useMemo(
    () => blocks.map((b, i) => (b.type === "h2" ? { id: `sec-${i}`, text: b.text } : null)).filter(Boolean),
    [blocks]
  );
  const metaBlocks = useMemo(() => blocks.filter(b => b.type === "meta"), [blocks]);

  // Progress + active-section tracking read from this panel's own scroll
  // container, not the window — nothing behind it scrolls here.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const onScroll = () => {
      const max = box.scrollHeight - box.clientHeight;
      setProgress(max > 0 ? Math.min(100, (box.scrollTop / max) * 100) : 0);

      const headings = box.querySelectorAll("[data-heading]");
      const boxTop   = box.getBoundingClientRect().top;
      let current = null;
      headings.forEach(h => {
        if (h.getBoundingClientRect().top - boxTop <= 90) current = h.getAttribute("data-heading");
      });
      // The last section's heading may never cross that threshold if its
      // body is too short to push it up — snap to it at the bottom instead.
      if (max > 0 && box.scrollTop >= max - 2 && toc.length > 0) current = toc[toc.length - 1].id;
      if (current) setActiveId(current);
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => box.removeEventListener("scroll", onScroll);
  }, [toc]);

  // Keep the highlighted rail item in view as the reader moves down.
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(`toc-link-${activeId}`)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const scrollTo = (id) => {
    const el  = document.getElementById(id);
    const box = scrollRef.current;
    if (!el || !box) return;
    box.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
  };

  let seenFirstH2 = false;

  return (
    <div className="cap-screen legal-panel">
      <LegalStyles />
      <SectionHeaderBar title={title} onBack={onBack} />

      <div className="legal-progress-track">
        <div className="legal-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="legal-cols">
        {toc.length > 0 && (
          <nav className="legal-toc" aria-label="Sections">
            <p className="legal-toc-heading">On this page</p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
              {toc.map(item => {
                const isActive = activeId === item.id;
                return (
                  <li key={item.id} id={`toc-link-${item.id}`}>
                    <button
                      type="button"
                      className="legal-toc-btn"
                      onClick={() => scrollTo(item.id)}
                      style={{
                        borderLeft: `2px solid ${isActive ? ink : "transparent"}`,
                        color: isActive ? ink : inkMuted,
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {item.text}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <div className="legal-scroll" ref={scrollRef}>
          <h1 style={{ fontFamily: font.ui, fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 600, letterSpacing: "-0.02em", color: ink, margin: `0 0 ${space.md}`, lineHeight: 1.2 }}>
            {title}
          </h1>

          {metaBlocks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, marginBottom: space.xl }}>
              {metaBlocks.map((m, i) => (
                <span key={i} style={{ fontFamily: font.ui, ...type.helper, fontWeight: 500, color: onPanel, background: panel, borderRadius: radius.pill, padding: "6px 15px" }}>
                  {m.text}
                </span>
              ))}
            </div>
          )}

          {blocks.map((b, i) => {
            if (b.type === "meta") return null;

            if (b.type === "h2") {
              const id = `sec-${i}`;
              const isFirst = !seenFirstH2;
              seenFirstH2 = true;
              return (
                <h2
                  key={i}
                  id={id}
                  data-heading={id}
                  style={{
                    fontFamily: font.ui, fontSize: "clamp(1.05rem, 3vw, 1.25rem)", fontWeight: 600,
                    letterSpacing: "-0.01em", color: ink,
                    margin: isFirst ? `0 0 ${space.sm}` : `${space.xl} 0 ${space.sm}`,
                    paddingTop: isFirst ? 0 : space.lg,
                    borderTop: isFirst ? "none" : `1px solid ${line}`,
                    scrollMarginTop: space.lg,
                  }}
                >
                  {b.text}
                </h2>
              );
            }

            if (b.type === "h3") {
              return (
                <h3 key={i} style={{ fontFamily: font.ui, fontSize: "1rem", fontWeight: 600, color: ink, margin: `${space.lg} 0 6px` }}>
                  {b.text}
                </h3>
              );
            }

            if (b.type === "ul") {
              return (
                <ul key={i} style={{ margin: `8px 0 ${space.md}`, paddingLeft: "22px" }}>
                  {b.items.map((it, j) => (
                    <li key={j} style={{ fontFamily: font.ui, ...type.body, lineHeight: 1.7, color: inkBody, marginBottom: "5px", maxWidth: "74ch" }}>
                      {linkifyEmails(it)}
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={i} style={{ fontFamily: font.ui, ...type.body, lineHeight: 1.7, color: inkBody, margin: `0 0 ${space.md}`, maxWidth: "74ch" }}>
                {linkifyEmails(b.text)}
              </p>
            );
          })}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: space.xl }}>
            <button
              type="button"
              onClick={onBack}
              style={{ padding: "13px 36px", borderRadius: radius.pill, border: "none", background: panel, color: onPanel, fontFamily: font.ui, ...type.control, cursor: "pointer", boxShadow: shadow.pill, transition: `background 240ms ${ease}` }}
              onMouseEnter={e => (e.currentTarget.style.background = panelDeep)}
              onMouseLeave={e => (e.currentTarget.style.background = panel)}
            >
              I understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TermsScreen   = ({ onBack }) => <LegalPanel title="Terms and conditions" text={TERMS_TEXT}   skip={COORDINATOR_SKIP.terms}   onBack={onBack} />;
const PrivacyScreen = ({ onBack }) => <LegalPanel title="Privacy policy"       text={PRIVACY_TEXT} skip={COORDINATOR_SKIP.privacy} onBack={onBack} />;

// ── Multi-Department Picker ───────────────────────────────────────────────────
const MultiDepartmentPicker = ({ selections, onChange, readOnly, errors, departments, departmentNames }) => {
  const addEntry = () => onChange([...selections, { department: "", program: "", specialization: "" }]);
  const removeEntry = (idx) => onChange(selections.filter((_, i) => i !== idx));
  const updateEntry = (idx, field, value) => {
    const updated = selections.map((entry, i) => {
      if (i !== idx) return entry;
      if (field === "department") return { department: value, program: "", specialization: "" };
      if (field === "program")    return { ...entry, program: value, specialization: "" };
      return { ...entry, [field]: value };
    });
    onChange(updated);
  };

  const pillSelect = {
    width: "100%",
    padding: "8px 30px 8px 14px",
    background: readOnly ? lineSoft : surface,
    border: `1px solid ${line}`,
    borderRadius: radius.pill,
    color: readOnly ? inkMuted : ink,
    fontFamily: font.ui,
    ...type.helper,
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    cursor: readOnly ? "default" : "pointer",
    boxSizing: "border-box",
  };

  const errText = { color: danger, fontSize: "0.75rem", fontFamily: font.ui, margin: "4px 0 0 6px" };
  const caret   = { position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: inkMuted, pointerEvents: "none", fontSize: "0.6rem" };

  return (
    <div style={{ marginTop: space.sm }}>
      {selections.map((entry, idx) => {
        const deptData        = departments[entry.department];
        const programs        = (deptData?.programs ?? []).map(p => p.name);
        const specializations = entry.program
          ? (deptData?.programs ?? []).find(p => p.name === entry.program)?.specializations ?? []
          : [];
        const err             = errors?.[idx] ?? {};

        return (
          <div key={idx} style={{ background: lineSoft, border: `1px solid ${line}`, borderRadius: radius.card, padding: "10px 12px", marginBottom: "8px" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: entry.department ? "8px" : "0" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <select disabled={readOnly} value={entry.department} onChange={e => updateEntry(idx, "department", e.target.value)}
                  style={{ ...pillSelect, borderColor: err.department ? danger : line }}>
                  <option value="">Select department</option>
                  {departmentNames.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span style={caret}>▼</span>
                {err.department && <p style={errText}>Department is required.</p>}
              </div>
              {!readOnly && selections.length > 1 && (
                <button type="button" onClick={() => removeEntry(idx)} aria-label="Remove this department"
                  style={{ width: "28px", height: "28px", borderRadius: "50%", background: surface, border: `1px solid ${line}`, color: inkMuted, fontSize: "0.8rem", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              )}
            </div>
            {entry.department && (
              <div style={{ marginBottom: specializations.length > 0 && entry.program ? "8px" : "0", position: "relative" }}>
                <select disabled={readOnly} value={entry.program} onChange={e => updateEntry(idx, "program", e.target.value)}
                  style={{ ...pillSelect, borderColor: err.program ? danger : line }}>
                  <option value="">Select program</option>
                  {programs.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span style={caret}>▼</span>
                {err.program && <p style={errText}>Program is required.</p>}
              </div>
            )}
            {entry.program && specializations.length > 0 && (
              <div style={{ position: "relative" }}>
                <select disabled={readOnly} value={entry.specialization} onChange={e => updateEntry(idx, "specialization", e.target.value)}
                  style={{ ...pillSelect, borderColor: err.specialization ? danger : line }}>
                  <option value="">Select specialization</option>
                  {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span style={caret}>▼</span>
                {err.specialization && <p style={errText}>Specialization is required.</p>}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <button type="button" onClick={addEntry}
          style={{ background: "transparent", border: `1px dashed ${color.wine400}`, borderRadius: radius.pill, color: inkBody, width: "100%", padding: "9px", fontFamily: font.ui, ...type.control, cursor: "pointer", marginTop: "2px" }}>
          Add another department
        </button>
      )}
    </div>
  );
};

const fieldStyle = {
  width: "100%", padding: "11px 16px",
  background: field, border: `1px solid ${line}`, borderRadius: radius.pill,
  color: ink, fontFamily: font.ui, ...type.body,
  outline: "none", boxSizing: "border-box",
};

const labelStyle = {
  fontFamily: font.ui, ...type.label,
  color: ink, marginBottom: "6px", display: "block",
};

const errorTextStyle = { color: danger, fontSize: "0.8125rem", fontFamily: font.ui, margin: `0 0 ${space.sm} 6px` };

const EditIcon = ({ size = 16, stroke = ink }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const EyeIcon = ({ show, onClick }) => (
  <span onClick={onClick} role="button" tabIndex={0} aria-label={show ? "Hide password" : "Show password"}
    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", display: "flex", alignItems: "center", color: inkMuted }}>
    {show ? (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ) : (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )}
  </span>
);

const GlobalStyles = () => {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      input[type="password"]::-ms-reveal,
      input[type="password"]::-ms-clear,
      input[type="password"]::-webkit-credentials-auto-fill-button,
      input[type="password"]::-webkit-strong-password-auto-fill-button { display: none !important; }
      input::-webkit-contacts-auto-fill-button,
      input::-webkit-credentials-auto-fill-button { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
};

const PasswordInput = ({ value, onChange, placeholder = "••••••••", onKeyDown, invalid }) => {
  const [show, setShow] = useState(false);
  const blockPaste = (e) => e.preventDefault();
  return (
    <div style={{ position: "relative", marginBottom: space.sm }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder}
        onPaste={blockPaste} onCopy={blockPaste} onCut={blockPaste}
        style={{ ...fieldStyle, paddingRight: "44px", borderColor: invalid ? danger : line }} />
      <EyeIcon show={show} onClick={() => setShow(s => !s)} />
    </div>
  );
};

const WarningBanner = ({ text }) => (
  <div style={{ background: lineSoft, border: `1px solid ${line}`, borderLeft: `3px solid ${warning}`, borderRadius: radius.card, padding: "13px 16px", marginBottom: space.md }}>
    <span style={{ fontFamily: font.ui, ...type.helper, color: inkBody }}>{text}</span>
  </div>
);

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Go back"
      style={{ background: "transparent", border: `1px solid ${onPanelFaint}`, borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: onPanel, transition: `background 240ms ${ease}` }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(250,250,250,0.10)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  );
}

// ── Row icons ─────────────────────────────────────────────────────────────────
// Outline strokes lang, 1.8 weight — para hindi nakikipag-agawan sa label.
const RowIcon = ({ children }) => (
  <span style={{ width: "34px", height: "34px", borderRadius: "10px", background: lineSoft, border: `1px solid ${line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ink }}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </span>
);

const icons = {
  person:   <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  key:      <><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/></>,
  addUser:  <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></>,
  transfer: <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  shield:   <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>,
};

// ── Menu row + grouped section ────────────────────────────────────────────────
const MenuRow = ({ label, icon, onClick }) => (
  <button type="button" onClick={onClick} className="cap-menu-row">
    <span style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
      {icon && <RowIcon>{icons[icon]}</RowIcon>}
      <span style={{ fontFamily: font.ui, fontSize: "1rem", fontWeight: 500, letterSpacing: "-0.01em", color: ink }}>{label}</span>
    </span>
    <img src={viewIcon} alt="" style={{ width: "30px", height: "30px", objectFit: "contain", flexShrink: 0 }} />
  </button>
);

const MenuGroup = ({ title, children }) => (
  <div className="cap-menu-group">
    <p style={{ fontFamily: font.ui, fontSize: "1rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, margin: `0 0 10px 6px` }}>{title}</p>
    {children}
  </div>
);

// ── Modal footer buttons ──────────────────────────────────────────────────────
const FooterGhostButton = ({ children, ...rest }) => (
  <button {...rest} style={{ padding: "9px 20px", borderRadius: radius.pill, background: "transparent", color: onPanelDim, border: `1px solid ${onPanelFaint}`, fontFamily: font.ui, ...type.control, cursor: "pointer" }}>{children}</button>
);

const FooterSolidButton = ({ children, disabled, ...rest }) => (
  <button {...rest} disabled={disabled} style={{ padding: "9px 22px", borderRadius: radius.pill, background: color.white, color: ink, border: "none", fontFamily: font.ui, ...type.control, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>{children}</button>
);

const ModalTitle = ({ children, sub }) => (
  <div style={{ marginBottom: space.md }}>
    <p style={{ fontFamily: font.ui, fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, margin: 0 }}>{children}</p>
    {sub && <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, margin: "4px 0 0" }}>{sub}</p>}
  </div>
);

// ── Add Account Modal ─────────────────────────────────────────────────────────
const AddAccountModal = ({ onClose, currentUid, currentEmail, coordinatorDeptSelections = [] }) => {
  const { departments, departmentNames } = useDepartmentsPrograms();
  const [currentPass, setCurrentPass] = useState("");
  const [email, setEmail]             = useState("");
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent]               = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !submitting) {
      handleSubmit();
    }
  };

  const validate = () => {
    const e = {};
    if (!currentPass) e.currentPass = "Your current password is required to confirm this invitation.";
    if (!email.trim()) e.email = "The new coordinator's email is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      // Only sends an invite — this account's own access is completely
      // unaffected, both now and after the invited coordinator accepts.
      await initiateCoordinatorAddition(currentUid, currentEmail, currentPass, email);
      setSent(true);
    } catch (err) {
      setSubmitError(err.message || "The invitation didn't send. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cap-modal cap-overlay" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: space.md }}>
      <div className="cap-modal-inner cap-dialog">
        <div className="cap-modal-body">
          {sent ? (
            <>
              <ModalTitle sub={`Sent to ${email.trim().toLowerCase()}`}>Invitation sent</ModalTitle>
              <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, marginBottom: space.sm }}>
                They'll set up their own name and password when they open the link.
              </p>
              <p style={{ fontFamily: font.ui, ...type.body, color: inkBody }}>
                Your own account and access are unaffected.
              </p>
            </>
          ) : (
            <>
              <WarningBanner text="Invite an additional OJT Coordinator. They'll receive an email with an Accept link and set up their own login — your own account and access won't change." />

              <ModalTitle>Confirm your identity</ModalTitle>
              <label style={labelStyle}>Your current password</label>
              <PasswordInput value={currentPass} onChange={e => setCurrentPass(e.target.value)} onKeyDown={handleKeyDown} invalid={!!errors.currentPass} />
              {errors.currentPass && <p style={errorTextStyle}>{errors.currentPass}</p>}

              <hr style={{ border: "none", borderTop: `1px solid ${line}`, margin: `${space.lg} 0 ${space.md}` }} />

              <ModalTitle>New coordinator</ModalTitle>

              <label style={labelStyle}>Department and program</label>
              <MultiDepartmentPicker
                selections={coordinatorDeptSelections.length ? coordinatorDeptSelections : [{ department: "", program: "", specialization: "" }]}
                onChange={() => {}}
                readOnly={true}
                errors={[]}
                departments={departments}
                departmentNames={departmentNames}
              />
              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, margin: `6px 0 ${space.md} 6px` }}>
                New accounts are added under your own department automatically.
              </p>

              <label style={labelStyle}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="example@gmail.com"
                style={{ ...fieldStyle, borderColor: errors.email ? danger : line, marginBottom: "6px" }} />
              {errors.email && <p style={errorTextStyle}>{errors.email}</p>}

              {submitError && <p style={{ ...errorTextStyle, textAlign: "center", marginTop: space.md }}>{submitError}</p>}
            </>
          )}
        </div>
        <div className="cap-modal-footer">
          <FooterGhostButton onClick={onClose}>{sent ? "Close" : "Cancel"}</FooterGhostButton>
          {!sent && (
            <FooterSolidButton onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Sending…" : "Send invitation"}
            </FooterSolidButton>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Transfer Account Modal ────────────────────────────────────────────────────
const TransferAccountModal = ({ onClose, currentUid, currentEmail, coordinatorDeptSelections = [] }) => {
  const { departments, departmentNames } = useDepartmentsPrograms();
  const [currentPass, setCurrentPass] = useState("");
  const [email, setEmail]             = useState("");
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent]               = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !submitting) {
      handleSubmit();
    }
  };

  const validate = () => {
    const e = {};
    if (!currentPass) e.currentPass = "Your current password is required to confirm this transfer.";
    if (!email.trim()) e.email = "The new coordinator's email is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      // Only sends an invite — the current account keeps full access until
      // the invited coordinator actually accepts it via the emailed link.
      await initiateCoordinatorTransfer(currentUid, currentEmail, currentPass, email);
      setSent(true);
    } catch (err) {
      setSubmitError(err.message || "The transfer invitation didn't send. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cap-modal cap-overlay" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: space.md }}>
      <div className="cap-modal-inner cap-dialog">
        <div className="cap-modal-body">
          {sent ? (
            <>
              <ModalTitle sub={`Sent to ${email.trim().toLowerCase()}`}>Invitation sent</ModalTitle>
              <p style={{ fontFamily: font.ui, ...type.body, color: inkBody }}>
                You keep access to your account until they open the link and finish setting up theirs. At that point your account is transferred and you're signed out automatically.
              </p>
            </>
          ) : (
            <>
              <WarningBanner text="Invite another OJT Coordinator to take over this account. They'll receive an email with an Accept link and set up their own login — your access won't change until they accept." />

              <ModalTitle>Confirm your identity</ModalTitle>
              <label style={labelStyle}>Your current password</label>
              <PasswordInput value={currentPass} onChange={e => setCurrentPass(e.target.value)} onKeyDown={handleKeyDown} invalid={!!errors.currentPass} />
              {errors.currentPass && <p style={errorTextStyle}>{errors.currentPass}</p>}

              <hr style={{ border: "none", borderTop: `1px solid ${line}`, margin: `${space.lg} 0 ${space.md}` }} />

              <ModalTitle>New coordinator</ModalTitle>

              <label style={labelStyle}>Department and program</label>
              <MultiDepartmentPicker
                selections={coordinatorDeptSelections.length ? coordinatorDeptSelections : [{ department: "", program: "", specialization: "" }]}
                onChange={() => {}}
                readOnly={true}
                errors={[]}
                departments={departments}
                departmentNames={departmentNames}
              />
              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, margin: `6px 0 ${space.md} 6px` }}>
                The new coordinator inherits your department automatically.
              </p>

              <label style={labelStyle}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="example@gmail.com"
                style={{ ...fieldStyle, borderColor: errors.email ? danger : line, marginBottom: "6px" }} />
              {errors.email && <p style={errorTextStyle}>{errors.email}</p>}

              {submitError && <p style={{ ...errorTextStyle, textAlign: "center", marginTop: space.md }}>{submitError}</p>}
            </>
          )}
        </div>
        <div className="cap-modal-footer">
          <FooterGhostButton onClick={onClose}>{sent ? "Close" : "Cancel"}</FooterGhostButton>
          {!sent && (
            <FooterSolidButton onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Sending…" : "Send invitation"}
            </FooterSolidButton>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Phone formatter ───────────────────────────────────────────────────────────
const formatPhone = (raw) => {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63")) digits = digits.slice(2);
  if (digits.length > 10) digits = digits.slice(0, 10);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 10);
  let fmt = "+63";
  if (p1) fmt += " " + p1;
  if (p2) fmt += "-" + p2;
  if (p3) fmt += "-" + p3;
  return fmt;
};

// ── Status dialog (shared success / confirmation sheet) ───────────────────────
const StatusDialog = ({ icon, title, body, actionLabel = "Done", onAction }) => (
  <div className="cap-modal cap-overlay" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: space.md }}>
    <div className="cap-dialog" style={{ background: surface, borderRadius: radius.panel, border: `1px solid ${line}`, boxShadow: shadow.panel, padding: `${space.xl} ${space.lg}`, width: "clamp(280px, 85vw, 390px)", display: "flex", flexDirection: "column", alignItems: "center", gap: space.sm, textAlign: "center" }}>
      <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: lineSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: space.xs }}>
        {icon}
      </div>
      <h3 style={{ fontFamily: font.ui, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, margin: 0 }}>{title}</h3>
      <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, margin: 0 }}>{body}</p>
      <button onClick={onAction}
        style={{ width: "100%", padding: "12px", borderRadius: radius.pill, border: "none", background: panel, color: onPanel, fontFamily: font.ui, ...type.control, cursor: "pointer", marginTop: space.sm, boxShadow: shadow.pill, transition: `background 240ms ${ease}` }}
        onMouseEnter={e => (e.currentTarget.style.background = panelDeep)}
        onMouseLeave={e => (e.currentTarget.style.background = panel)}>
        {actionLabel}
      </button>
    </div>
  </div>
);

const CheckIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

const MailIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 6 12 13 2 6"/><path d="M2 6h20v12H2z"/></svg>
);

// ── Email Change Confirm Modal ────────────────────────────────────────────────
// Changing a coordinator's login email needs the current password (Firebase
// treats it as a sensitive Auth operation) and is usually a two-step,
// verify-by-link process — see requestCoordinatorEmailChange in
// AuthService.js for exactly why. This modal collects the password, kicks
// that off, and shows the right outcome (verification-link-sent vs. changed
// immediately). It is NOT a generic "Are you sure?" confirmation — it exists
// because Firebase requires a recent sign-in before it will touch the Auth
// account's email at all.
const CoordinatorEmailChangeConfirmModal = ({ newEmail, uid, onCancel, onDone }) => {
  const [currentPass, setCurrentPass] = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [sent, setSent]               = useState(false); // true once verifyBeforeUpdateEmail succeeded

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleConfirm();
  };

  const handleConfirm = async () => {
    if (!currentPass) { setError("Enter your current password."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await requestCoordinatorEmailChange(currentPass, newEmail, uid);
      if (result.pendingEmail) {
        // Verification-link path — Firestore's `email` field hasn't changed
        // yet, so save everything else now rather than blocking the rest of
        // the form's edits on an email confirmation that might take a while.
        await onDone(uid);
        setSent(true);
      } else {
        // Either nothing actually changed, or this project fell back to the
        // immediate updateEmail() path (already fully applied) — either way
        // there's nothing pending to explain, just finish the save normally.
        await onDone(uid);
        onCancel();
      }
    } catch (err) {
      setError(err.message || "The email didn't update. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <StatusDialog
        icon={<MailIcon />}
        title="Confirmation email sent"
        body={`Open the link we sent to ${newEmail} to finish changing your login email. Until then, keep using your current email to log in.`}
        actionLabel="Got it"
        onAction={onCancel}
      />
    );
  }

  return (
    <div className="cap-modal cap-overlay" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: space.md }}>
      <div className="cap-modal-inner cap-dialog">
        <div className="cap-modal-body">
          <ModalTitle sub={`Changing your login email to ${newEmail}`}>Verify your password</ModalTitle>
          <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, marginBottom: space.md }}>
            This is a security-sensitive change, so you need to confirm your current password before continuing.
          </p>
          <label style={labelStyle}>Current password</label>
          <PasswordInput value={currentPass} onChange={e => { setCurrentPass(e.target.value); setError(""); }} onKeyDown={handleKeyDown} invalid={!!error} />
          {error && <p style={{ ...errorTextStyle, textAlign: "center", marginTop: space.sm }}>{error}</p>}
        </div>
        <div className="cap-modal-footer">
          <FooterGhostButton onClick={onCancel} disabled={loading}>Cancel</FooterGhostButton>
          <FooterSolidButton onClick={handleConfirm} disabled={loading}>{loading ? "Confirming…" : "Confirm"}</FooterSolidButton>
        </div>
      </div>
    </div>
  );
};

// ── Personal Info Screen ──────────────────────────────────────────────────────
const PersonalInfoScreen = ({ user, onBack, onSaved, mandatory = false }) => {
  const { departments, departmentNames } = useDepartmentsPrograms();
  const [editing, setEditing]           = useState(!!mandatory);
  const [name, setName]                 = useState(user?.name || "");
  const [deptSelections, setDeptSelections] = useState(
    user?.deptSelections?.length ? user.deptSelections : [{ department: "", program: "", specialization: "" }]
  );
  const [sex, setSex]         = useState(user?.sex || "");
  const [contact, setContact] = useState(user?.contact || "");
  const [email, setEmail]     = useState(user?.email || "");
  const [address, setAddress] = useState(user?.address || "");
  const [errors, setErrors]     = useState({});
  const [deptErrors, setDeptErrors] = useState([]);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [savedPayload, setSavedPayload] = useState(null);
  // Login-email changes go through Firebase Auth (see
  // requestCoordinatorEmailChange in AuthService.js) — they need the current
  // password AND aren't instant (a verification link usually has to be
  // clicked first). originalEmailRef lets handleSave detect an actual edit;
  // pendingEmail reflects an in-progress verification so the UI can show
  // "confirmation sent" instead of silently pretending the change already
  // happened.
  const originalEmailRef = useRef(user?.email || "");
  const [pendingEmail, setPendingEmail] = useState("");
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);

  // The onSnapshot listener below stays subscribed for as long as this
  // screen is mounted — including while the email-change reauth modal is
  // open and mid-flow. Writing `pendingEmail` to this same document (see
  // requestCoordinatorEmailChange) fires that listener again immediately,
  // and without this guard it would call setEmail(d.email) with the OLD
  // email (Firestore's real `email` field hasn't changed yet) — snapping
  // the input the user is actively looking at back to the old value right
  // in the middle of the flow. `editing` itself can't be read directly
  // inside the listener's closure (it's captured stale from mount), so
  // mirror it into a ref that's always current.
  const editingRef = useRef(editing);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  // ── Always reflect the latest Firestore data, not a stale `user` prop ────
  // (Fixes fields resetting to blank when re-opening Edit after a save.)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "coordinators", uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setName(d.name || "");
      setDeptSelections(d.deptSelections?.length ? d.deptSelections : [{ department: "", program: "", specialization: "" }]);
      setSex(d.sex || "");
      setContact(d.contact || "");
      // Only sync the visible email input from Firestore while NOT actively
      // editing — otherwise an in-progress edit (or the pendingEmail write
      // that happens mid email-change-flow) can visibly stomp on what the
      // user is currently typing/confirming.
      if (!editingRef.current) {
        setEmail(d.email || "");
      }
      originalEmailRef.current = d.email || "";
      setPendingEmail(d.pendingEmail || "");
      setAddress(d.address || "");
    });
    return unsub;
  }, [user?.uid]);

  const validatePhone = (val) => {
    if (!val || val.trim() === "+63" || val.trim() === "+63 ") return "Phone number is required.";
    const digits = val.replace(/\D/g, "");
    if (digits.length < 12) return "Must be a valid +63 number.";
    return "";
  };

  const validateEmail = (val) => {
    if (!val || !val.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return "Invalid email address.";
    return "";
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!sex) e.sex = "Select sex.";
    const phoneErr = validatePhone(contact);
    if (phoneErr) e.contact = phoneErr;
    const emailErr = validateEmail(email);
    if (emailErr) e.email = emailErr;
    if (!address.trim()) e.address = "Address is required.";

    const newDeptErrors = deptSelections.map(entry => {
      const err = {};
      if (!entry.department) err.department = true;
      if (entry.department && !entry.program) err.program = true;
      if (entry.department && entry.program) {
        const specs = (departments[entry.department]?.programs ?? []).find(p => p.name === entry.program)?.specializations ?? [];
        if (specs.length > 0 && !entry.specialization) err.specialization = true;
      }
      return err;
    });
    setDeptErrors(newDeptErrors);
    const hasDeptError = newDeptErrors.some(e => Object.keys(e).length > 0);
    setErrors(e);
    return Object.keys(e).length === 0 && !hasDeptError;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const uid = user?.uid;
    if (!uid) { setSaveError("Missing account reference. Log in again and try once more."); return; }

    // If the email field was edited, that's a Firebase Auth login-email
    // change, not a plain Firestore field update — it needs the current
    // password AND isn't instant (see requestCoordinatorEmailChange in
    // AuthService.js). Route to that flow instead of silently writing the
    // new address to Firestore, which was the original bug: the Firestore
    // field changed but the real Auth login credential never did, so only
    // the OLD email kept working.
    if (email.trim().toLowerCase() !== originalEmailRef.current.trim().toLowerCase()) {
      setShowEmailConfirm(true);
      return;
    }

    await saveNonEmailFields(uid);
  };

  // Everything on this screen EXCEPT the email field — split out so it can
  // run either directly (email unchanged) or after the email-change modal
  // successfully reauthenticates and calls requestCoordinatorEmailChange.
  const saveNonEmailFields = async (uid) => {
    setSaving(true);
    setSaveError("");
    try {
      // Sanitize deptSelections — replace any undefined/null with empty string
      const cleanDeptSelections = deptSelections.map(entry => ({
        department:     entry.department     || "",
        program:        entry.program        || "",
        specialization: entry.specialization || "",
      }));

      const payload = {
        name:           name          || "",
        deptSelections: cleanDeptSelections,
        sex:            sex           || "",
        contact:        contact       || "",
        // `email` intentionally excluded — see handleSave/saveNonEmailFields split above.
        address:        address       || "",
      };
      if (mandatory) payload.profileComplete = true;
      await updateDoc(doc(db, "coordinators", uid), payload);
      setEditing(false);
      setErrors({});
      setDeptErrors([]);
      // Show the confirmation modal first; only notify the parent (which,
      // in the mandatory first-login flow, immediately unmounts this
      // screen) once the coordinator has dismissed it — otherwise the
      // modal never gets a chance to render.
      setSavedPayload(payload);
      setShowSaveSuccess(true);
    } catch (err) {
      setSaveError(err.message || "Your information didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleContactChange = (raw) => {
    const formatted = formatPhone(raw);
    setContact(formatted);
    setErrors(prev => ({ ...prev, contact: validatePhone(formatted) }));
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    setErrors(prev => ({ ...prev, email: validateEmail(val) }));
  };

  const rowLabel = { fontFamily: font.ui, ...type.helper, color: inkMuted, display: "block", marginBottom: "3px" };
  const rowValue = { fontFamily: font.ui, ...type.body, color: ink, margin: 0 };

  const inlineInputStyle = {
    background: "transparent", border: "none", borderBottom: `1px solid ${line}`,
    color: ink, fontFamily: font.ui, ...type.body,
    outline: "none", width: "100%", padding: "4px 0", boxSizing: "border-box",
  };
  const inlineInputErrorStyle = { ...inlineInputStyle, borderBottom: `1.5px solid ${danger}` };
  const inlineErrText = { color: danger, fontSize: "0.75rem", fontFamily: font.ui, margin: "4px 0 0" };

  const deptViewLabel = (entry) => [entry.department, entry.program, entry.specialization].filter(Boolean).join(" · ");

  return (
    <div className="cap-screen" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: page }}>
      <SectionHeaderBar title={editing ? "Edit personal information" : "Personal information"} onBack={onBack} />

      <div className="cap-info-body">
        <div
          className="cap-info-card"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.tagName === "INPUT" && editing) {
              e.preventDefault();
              handleSave();
            }
          }}
        >
          {/* Edit button */}
          {!editing && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: space.sm }}>
              <button onClick={() => setEditing(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 16px", borderRadius: radius.pill, border: `1px solid ${line}`, background: surface, color: ink, fontFamily: font.ui, ...type.control, cursor: "pointer", boxShadow: shadow.input }}>
                <EditIcon size={14} />
                Edit
              </button>
            </div>
          )}

          {/* Name */}
          <div className="cap-info-row">
            <span style={rowLabel}>Name</span>
            {editing ? (
              <>
                <input value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }} placeholder="Full name" style={errors.name ? inlineInputErrorStyle : inlineInputStyle} />
                {errors.name && <p style={inlineErrText}>{errors.name}</p>}
              </>
            ) : (
              <p style={rowValue}>{name || "—"}</p>
            )}
          </div>

          {/* Department */}
          <div className="cap-info-row">
            <span style={rowLabel}>Department</span>
            {editing ? (
              <MultiDepartmentPicker selections={deptSelections} onChange={v => { setDeptSelections(v); setDeptErrors([]); }} readOnly={false} errors={deptErrors} departments={departments} departmentNames={departmentNames} />
            ) : (
              deptSelections.length === 1 ? (
                <p style={rowValue}>{deptViewLabel(deptSelections[0]) || "—"}</p>
              ) : (
                <ul style={{ margin: "2px 0 0", paddingLeft: "18px" }}>
                  {deptSelections.map((entry, i) => (
                    <li key={i} style={{ fontFamily: font.ui, ...type.body, color: ink, marginBottom: "2px" }}>{deptViewLabel(entry) || "—"}</li>
                  ))}
                </ul>
              )
            )}
          </div>

          {/* Sex */}
          <div className="cap-info-row">
            <span style={rowLabel}>Sex</span>
            {editing ? (
              <>
                <select value={sex} onChange={e => { setSex(e.target.value); setErrors(p => ({ ...p, sex: "" })); }}
                  style={{ ...(errors.sex ? inlineInputErrorStyle : inlineInputStyle), cursor: "pointer" }}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
                {errors.sex && <p style={inlineErrText}>{errors.sex}</p>}
              </>
            ) : (
              <p style={rowValue}>{sex || "—"}</p>
            )}
          </div>

          {/* Contact */}
          <div className="cap-info-row">
            <span style={rowLabel}>Contact number</span>
            {editing ? (
              <>
                <input value={contact} onChange={e => handleContactChange(e.target.value)} placeholder="+63 000-000-0000" style={errors.contact ? inlineInputErrorStyle : inlineInputStyle} />
                {errors.contact && <p style={inlineErrText}>{errors.contact}</p>}
              </>
            ) : (
              <p style={rowValue}>{contact || "—"}</p>
            )}
          </div>

          {/* Email */}
          <div className="cap-info-row">
            <span style={rowLabel}>Email address</span>
            {editing ? (
              <>
                <input type="email" value={email} onChange={e => handleEmailChange(e.target.value)} placeholder="example@gmail.com" style={errors.email ? inlineInputErrorStyle : inlineInputStyle} />
                {errors.email && <p style={inlineErrText}>{errors.email}</p>}
              </>
            ) : (
              <p style={rowValue}>{email || "—"}</p>
            )}
            {/* A pendingEmail on file means a verification link is still
                waiting to be clicked — `email` above is still the real,
                active login address until then. */}
            {pendingEmail && (
              <p style={{ fontFamily: font.ui, ...type.helper, color: warning, margin: "6px 0 0" }}>
                Confirmation pending for {pendingEmail} — check that inbox to finish the change.
              </p>
            )}
          </div>

          {/* Address */}
          <div className="cap-info-row">
            <span style={rowLabel}>Address</span>
            {editing ? (
              <>
                <input type="text" value={address}
                  onChange={e => { setAddress(e.target.value); setErrors(p => ({ ...p, address: "" })); }}
                  placeholder="Province, city, barangay, street"
                  style={errors.address ? inlineInputErrorStyle : inlineInputStyle} />
                {errors.address && <p style={inlineErrText}>{errors.address}</p>}
              </>
            ) : (
              <p style={rowValue}>{address || "—"}</p>
            )}
          </div>

          {mandatory && (
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, textAlign: "center", margin: `${space.sm} 0 0` }}>
              Complete your personal information to continue.
            </p>
          )}

          {saveError && (
            <p style={{ ...errorTextStyle, textAlign: "center", margin: `${space.sm} 0 0` }}>{saveError}</p>
          )}

          {/* Cancel / Save */}
          {editing && (
            <div className="cap-save-row">
              {!mandatory && (
                <button onClick={() => { setEditing(false); setErrors({}); setDeptErrors([]); }}
                  style={{ padding: "9px 20px", borderRadius: radius.pill, background: "transparent", color: inkMuted, border: `1px solid ${line}`, fontFamily: font.ui, ...type.control, cursor: "pointer" }}>Cancel</button>
              )}
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "9px 22px", borderRadius: radius.pill, background: panel, color: onPanel, border: "none", fontFamily: font.ui, ...type.control, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: shadow.pill }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showEmailConfirm && (
        <CoordinatorEmailChangeConfirmModal
          newEmail={email.trim()}
          uid={user?.uid}
          onCancel={() => setShowEmailConfirm(false)}
          onDone={saveNonEmailFields}
        />
      )}

      {showSaveSuccess && (
        <CoordinatorSaveSuccessModal onClose={() => { setShowSaveSuccess(false); onSaved?.(savedPayload); }} />
      )}
    </div>
  );
};

// ── Reset Password Modal ──────────────────────────────────────────────────────
const ResetPasswordModal = ({ onClose, user, onLogout }) => {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirm, setConfirm]         = useState("");
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleSave();
    }
  };

  const handleSave = async () => {
    const e = {};
    if (!currentPass)          e.currentPass = "Enter your current password.";
    if (!newPass)              e.newPass = "Enter a new password.";
    else if (!isPasswordStrong(newPass)) e.newPass = "This password doesn't meet all the requirements below.";
    if (newPass !== confirm)   e.confirm = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      // auth.currentUser can be null here if this tab never established its
      // own Firebase Auth session (e.g. persistence is per-tab and this tab
      // was opened/reloaded separately) — reading .email on null crashes,
      // and every Firestore call would also fail as permission-denied.
      // Fail with a clear message instead of a raw null-reference error.
      if (!currentUser) {
        setErrors({ general: "Your session has expired. Refresh the page and log in again." });
        setLoading(false);
        return;
      }
      // Re-authenticate with current password first
      const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
      await reauthenticateWithCredential(currentUser, credential);
      // Now change password and update Firestore flag
      await changePassword(currentPass, newPass, "coordinators", user?.uid, currentUser?.email);
      setSuccess(true);
      setCurrentPass(""); setNewPass(""); setConfirm("");
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErrors({ currentPass: "That current password is incorrect." });
      } else {
        setErrors({ general: err.message || "The password didn't change. Try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  // Password change already signed the user out inside changePassword().
  // "Done" should route the whole app back to the sign-in screen, not just
  // close the modal (which no longer has a valid session anyway).
  const handleDone = () => {
    if (onLogout) onLogout();
    else onClose(); // fallback, shouldn't normally happen
  };

  if (success) {
    return (
      <StatusDialog
        icon={<CheckIcon />}
        title="Password changed"
        body="Your password is updated. Log in again with your new password."
        actionLabel="Done"
        onAction={handleDone}
      />
    );
  }

  return (
    <div className="cap-modal cap-overlay" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: space.md }}>
      <div className="cap-modal-inner cap-dialog">
        <div className="cap-modal-body">
          <ModalTitle sub="Choose a password you don't use anywhere else.">Reset password</ModalTitle>

          <label style={labelStyle}>Current password</label>
          <PasswordInput value={currentPass} onChange={e => { setCurrentPass(e.target.value); setErrors(p => ({ ...p, currentPass: "" })); }} onKeyDown={handleKeyDown} invalid={!!errors.currentPass} />
          {errors.currentPass && <p style={errorTextStyle}>{errors.currentPass}</p>}

          <hr style={{ border: "none", borderTop: `1px solid ${line}`, margin: `${space.lg} 0 ${space.md}` }} />

          <label style={labelStyle}>New password</label>
          <PasswordInput value={newPass} onChange={e => { setNewPass(e.target.value); setErrors(p => ({ ...p, newPass: "" })); }} onKeyDown={handleKeyDown} invalid={!!errors.newPass} />
          {errors.newPass && <p style={errorTextStyle}>{errors.newPass}</p>}

          <PasswordChecklist password={newPass} />

          <label style={labelStyle}>Confirm new password</label>
          <PasswordInput value={confirm} onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: "" })); }} onKeyDown={handleKeyDown} invalid={!!errors.confirm} />
          {errors.confirm && <p style={errorTextStyle}>{errors.confirm}</p>}

          {errors.general && <p style={{ ...errorTextStyle, textAlign: "center", marginTop: space.md }}>{errors.general}</p>}
        </div>
        <div className="cap-modal-footer">
          <FooterGhostButton onClick={onClose}>Cancel</FooterGhostButton>
          <FooterSolidButton onClick={handleSave} disabled={loading}>{loading ? "Saving…" : "Save password"}</FooterSolidButton>
        </div>
      </div>
    </div>
  );
};

// ── First-Login Mandatory Password Change Modal ───────────────────────────────
// Shown as a blocking overlay when the coordinator hasn't changed their
// admin-issued password yet (user.passwordChanged is falsy).
const FirstLoginPasswordModal = ({ user, onLogout }) => {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passError, setPassError]     = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);

  const handleChangePassword = async () => {
    setPassError("");

    if (!currentPass) { setPassError("Enter your current password."); return; }
    if (!newPass) { setPassError("Enter a new password."); return; }
    if (!isPasswordStrong(newPass)) { setPassError("This password doesn't meet all the requirements below."); return; }
    if (newPass !== confirmPass) { setPassError("Passwords do not match."); return; }

    setPassLoading(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setPassError("Your session has expired. Refresh the page and log in again.");
        setPassLoading(false);
        return;
      }
      // Re-authenticate with current (admin-issued) password first
      const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
      await reauthenticateWithCredential(currentUser, credential);
      // Now change password and update Firestore's passwordChanged flag
      await changePassword(currentPass, newPass, "coordinators", user?.uid, currentUser?.email);
      // Show confirmation modal first; onLogout is deferred until the
      // coordinator dismisses it via the "Done" button.
      setPassSuccess(true);
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setPassError("That current password is incorrect.");
      } else {
        setPassError(err.message || "The password didn't change. Try again.");
      }
    } finally {
      setPassLoading(false);
    }
  };

  const onEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); handleChangePassword(); } };

  if (passSuccess) {
    return (
      <StatusDialog
        icon={<CheckIcon />}
        title="Password changed"
        body="Your password is updated. Log in again with your new password."
        actionLabel="Done"
        onAction={() => onLogout?.()}
      />
    );
  }

  return (
    <div className="cap-modal cap-overlay" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,10,10,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: space.md }}>
      <div className="cap-modal-inner cap-dialog" style={{ width: "420px" }}>
        <div style={{ background: panel, padding: `${space.md} ${space.lg}` }}>
          <span style={{ fontFamily: font.ui, fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel }}>Set a new password</span>
          <p style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, margin: "3px 0 0" }}>Required before you can continue.</p>
        </div>
        <div className="cap-modal-body">
          <label style={labelStyle}>Current password</label>
          <PasswordInput value={currentPass} onChange={e => { setCurrentPass(e.target.value); setPassError(""); }} onKeyDown={onEnter} />

          <label style={labelStyle}>New password</label>
          <PasswordInput value={newPass} onChange={e => { setNewPass(e.target.value); setPassError(""); }} onKeyDown={onEnter} />

          <PasswordChecklist password={newPass} />

          <label style={labelStyle}>Confirm new password</label>
          <PasswordInput value={confirmPass} onChange={e => { setConfirmPass(e.target.value); setPassError(""); }} onKeyDown={onEnter} />

          {passError && <p style={{ ...errorTextStyle, marginTop: space.xs }}>{passError}</p>}
        </div>
        <div className="cap-modal-footer">
          <FooterGhostButton onClick={() => onLogout?.()}>Log out</FooterGhostButton>
          <FooterSolidButton onClick={handleChangePassword} disabled={passLoading}>
            {passLoading ? "Saving…" : "Save password"}
          </FooterSolidButton>
        </div>
      </div>
    </div>
  );
};

const CoordinatorSaveSuccessModal = ({ onClose }) => (
  <StatusDialog
    icon={<CheckIcon />}
    title="Changes saved"
    body="Your personal information has been updated."
    actionLabel="Done"
    onAction={onClose}
  />
);

// ── Main Screen ───────────────────────────────────────────────────────────────
const CoordinatorAccountProfileScreen = ({ user, onLogout }) => {
  const [view, setView]                     = useState("main");
  const [showReset, setShowReset]           = useState(false);
  const [showTransfer, setShowTransfer]     = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [profileName, setProfileName]       = useState("");
  // The signed-in coordinator's own department(s) — used to auto-assign the
  // department when adding or transferring an account, instead of letting
  // the coordinator pick a different one.
  const [coordinatorDeptSelections, setCoordinatorDeptSelections] = useState([]);

  useEffect(() => {
    const uid = user?.uid || getAuth().currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "coordinators", uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfileName(d.name || d.fullName || d.displayName || "");
        setCoordinatorDeptSelections(d.deptSelections?.length ? d.deptSelections : []);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  if (view === "personalInfo") return <><ResponsiveStyles /><PersonalInfoScreen user={user} onBack={() => setView("main")} /></>;
  if (view === "terms")        return <><ResponsiveStyles /><TermsScreen onBack={() => setView("main")} /></>;
  if (view === "privacy")      return <><ResponsiveStyles /><PrivacyScreen onBack={() => setView("main")} /></>;

  // Mandatory first-login password change — blocks access to the rest of the
  // account until the coordinator has replaced their admin-issued password.
  if (user && !user.passwordChanged) {
    return <><ResponsiveStyles /><FirstLoginPasswordModal user={user} onLogout={onLogout} /></>;
  }

  return (
    <div className="cap-screen" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: page }}>
      <ResponsiveStyles />
      <GlobalStyles />

      {/* Dark banner + overlapping profile card */}
      <div style={{ position: "relative", flexShrink: 0, zIndex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "78px", background: panel, borderBottomLeftRadius: radius.panel, borderBottomRightRadius: radius.panel, zIndex: 1 }} />
        <div className="cap-header-card">
          <div style={{ position: "absolute", top: "-38px", width: "76px", height: "76px", borderRadius: "50%", background: panelDeep, border: `2px solid ${surface}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, boxShadow: shadow.pill }}>
            <img src={PersonalAccountProfile} alt="" style={{ width: "42px", height: "42px", objectFit: "contain" }} />
          </div>
          <p style={{ fontFamily: font.ui, fontSize: "clamp(1rem, 4vw, 1.125rem)", fontWeight: 600, letterSpacing: "-0.01em", color: ink, margin: 0, textAlign: "center" }}>
            {profileName || "—"}
          </p>
        </div>
      </div>

      <div className="cap-divider" />

      {/* Scrollable body — grouped list */}
      <div className="cap-body">
        <div className="cap-menu-stack">
          <MenuGroup title="Personal Information:">
            <MenuRow icon="person" label="Personal Information" onClick={() => setView("personalInfo")} />
          </MenuGroup>

          <MenuGroup title="Security:">
            <MenuRow icon="key" label="Reset Password" onClick={() => setShowReset(true)} />
          </MenuGroup>

          <MenuGroup title="Account:">
            <MenuRow icon="addUser"  label="Add Account"      onClick={() => setShowAddAccount(true)} />
            <MenuRow icon="transfer" label="Transfer Account" onClick={() => setShowTransfer(true)} />
          </MenuGroup>

          <MenuGroup title="Legal:">
            <MenuRow icon="document" label="Terms & Condition" onClick={() => setView("terms")} />
            <MenuRow icon="shield"   label="Privacy Policy"    onClick={() => setView("privacy")} />
          </MenuGroup>
        </div>

        {showTransfer   && <TransferAccountModal onClose={() => setShowTransfer(false)} currentUid={user?.uid} currentEmail={user?.email} coordinatorDeptSelections={coordinatorDeptSelections} />}
        {showAddAccount && <AddAccountModal      onClose={() => setShowAddAccount(false)} currentUid={user?.uid} currentEmail={user?.email} coordinatorDeptSelections={coordinatorDeptSelections} />}
        {showReset      && <ResetPasswordModal   onClose={() => setShowReset(false)} user={user} onLogout={onLogout} />}
      </div>
    </div>
  );
};

export default CoordinatorAccountProfileScreen;
export { PersonalInfoScreen, ResponsiveStyles, TermsScreen, PrivacyScreen, LegalPanel };