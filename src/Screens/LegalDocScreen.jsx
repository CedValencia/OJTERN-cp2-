import React, { useEffect, useMemo, useRef, useState } from "react";
import logo from "../icons/ojtern.png";
import { parseLegalDoc } from "./legalContent";
import { color, radius, shadow, ease } from "./theme";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Shared chrome: reading-progress rail, focus rings, and the sidebar's
// mobile behavior — kept in one place so the inline styles below stay simple.
const Styles = () => (
  <style>{`
    .legal-root { background: #ffffff; }
    .legal-toc-btn:focus-visible,
    .legal-cta:focus-visible {
      outline: 2px solid ${color.wine700};
      outline-offset: 2px;
    }
    .legal-cta {
      transition: background 160ms ${ease}, color 160ms ${ease}, border-color 160ms ${ease};
      border: 1.5px solid ${color.ink};
    }
    .legal-cta:hover {
      background: #ffffff !important;
      color: ${color.ink} !important;
    }
    .legal-toc { display: flex; flex-direction: column; }
    .legal-content { margin-left: calc(clamp(12px, 4vw, 96px) + clamp(130px, 26vw, 220px) + clamp(16px, 3vw, 40px)); padding-top: clamp(24px, 5vw, 40px); }
    @media (prefers-reduced-motion: reduce) {
      .legal-progress-fill, .legal-toc-btn { transition: none !important; }
    }
  `}</style>
);

function LegalDocScreen({ title, text, onBack }) {
  const blocks = useMemo(() => parseLegalDoc(text), [text]);
  const contentRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState(null);

  // Section list for the "on this page" rail — built straight from the
  // document's own h2 headings, so it can never drift out of sync.
  const toc = useMemo(
    () =>
      blocks
        .map((b, i) => (b.type === "h2" ? { id: `sec-${i}`, text: b.text } : null))
        .filter(Boolean),
    [blocks]
  );

  const metaBlocks = useMemo(() => blocks.filter((b) => b.type === "meta"), [blocks]);

  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (window.scrollY / docHeight) * 100) : 0);

      const headings = contentRef.current
        ? contentRef.current.querySelectorAll("[data-heading]")
        : [];
      let current = null;
      headings.forEach((h) => {
        if (h.getBoundingClientRect().top <= 140) current = h.getAttribute("data-heading");
      });

      // If there's nothing left to scroll, the last section's own heading
      // may never cross the threshold above (its content is too short to
      // push it that far up) — snap the highlight to the last item instead.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom && toc.length > 0) current = toc[toc.length - 1].id;

      if (current) setActiveId(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the highlighted "On this page" item in view — as the person scrolls
  // the content and the active section changes, the sidebar's own scroll
  // follows it instead of leaving the highlight to drift off-screen.
  useEffect(() => {
    if (!activeId) return;
    const el = document.getElementById(`toc-link-${activeId}`);
    if (el) el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  let seenFirstH2 = false;

  return (
    <div className="legal-root" style={{ width: "100%", minHeight: "100dvh", fontFamily: FONT }}>
      <Styles />

      {/* Reading progress — track stays invisible until there's something to show */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "3px", zIndex: 20, background: "transparent" }}>
        <div
          className="legal-progress-fill"
          style={{ height: "100%", width: `${progress}%`, background: color.wine700, transition: "width 120ms linear" }}
        />
      </div>

      {/* Left column — logo/name and the section list share one fixed rail,
          on every screen size (no mobile stacking). Sizes scale down with
          clamp() so it still fits narrow phones without collapsing. */}
      <div
        className="legal-toc"
        style={{ position: "fixed", top: "40px", bottom: 0, left: "clamp(12px, 4vw, 96px)", width: "clamp(130px, 26vw, 220px)", overflowY: "auto", paddingBottom: "48px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "0px", marginBottom: "15px" }}>
          <img
            src={logo}
            alt=""
            style={{ width: "clamp(48px, 12vw, 100px)", height: "clamp(48px, 12vw, 100px)", objectFit: "contain", filter: "brightness(0)" }}
          />
          <span style={{ fontSize: "clamp(1rem, 3.4vw, 1.8rem)", fontWeight: 700, letterSpacing: "0.01em", color: color.ink }}>
            OJTern
          </span>
        </div>

        {toc.length > 0 && (
          <nav aria-label="Sections">
            <p style={{ fontSize: "clamp(0.72rem, 2vw, 0.82rem)", color: color.inkFaint, fontWeight: 700, textTransform: "none", margin: "0 0 12px" }}>
              On this page
            </p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
              {toc.map((item) => {
                const isActive = activeId === item.id;
                return (
                <li key={item.id} id={`toc-link-${item.id}`}>
                    <button
                      type="button"
                      className="legal-toc-btn"
                      onClick={() => scrollTo(item.id)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        background: "none", border: "none", cursor: "pointer",
                        padding: "7px 0 7px 10px",
                        borderLeft: `2px solid ${isActive ? color.wine700 : "transparent"}`,
                        color: isActive ? color.ink : color.inkMuted,
                        fontWeight: isActive ? 700 : 500,
                        fontSize: "clamp(0.78rem, 2.2vw, 0.95rem)", lineHeight: 1.4,
                        fontFamily: FONT,
                        transition: `border-color 160ms ${ease}, color 160ms ${ease}`,
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
      </div>

      <div
        className="legal-content"
        style={{
          paddingLeft: "16px", paddingRight: "clamp(16px, 5vw, 56px)", paddingBottom: "32px",
        }}
      >
        <div ref={contentRef}>
          <h1 style={{ fontSize: "clamp(1.4rem, 5vw, 2.1rem)", fontWeight: 700, color: color.ink, margin: "0 0 18px", lineHeight: 1.25 }}>
            {title}
          </h1>

          {metaBlocks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "36px" }}>
              {metaBlocks.map((m, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "0.88rem", color: "#ffffff", fontWeight: 600,
                    background: color.blush100, borderRadius: "999px",
                    padding: "7px 16px",
                  }}
                >
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
                    fontSize: "clamp(1.05rem, 3.6vw, 1.35rem)", fontWeight: 700, color: color.ink,
                    margin: isFirst ? "0 0 12px" : "40px 0 12px",
                    paddingTop: isFirst ? 0 : "26px",
                    borderTop: isFirst ? "none" : `1px solid ${color.blush300}`,
                    scrollMarginTop: "24px",
                  }}
                >
                  {b.text}
                </h2>
              );
            }

            if (b.type === "h3")
              return (
                <h3 key={i} style={{ fontSize: "1.1rem", fontWeight: 700, color: color.ink, margin: "20px 0 8px" }}>
                  {b.text}
                </h3>
              );

            if (b.type === "ul")
              return (
                <ul key={i} style={{ margin: "8px 0 18px", paddingLeft: "22px" }}>
                  {b.items.map((it, j) => (
                    <li key={j} style={{ fontSize: "1rem", lineHeight: 1.75, color: "#4b4b52", marginBottom: "6px" }}>
                      {it}
                    </li>
                  ))}
                </ul>
              );

            return (
              <p key={i} style={{ fontSize: "1rem", lineHeight: 1.75, color: "#4b4b52", margin: "0 0 18px" }}>
                {b.text}
              </p>
            );
          })}

          {/* CTA now sits at the end of the document flow, not floating over it —
              the person only reaches it once there's nothing left to scroll. */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "48px" }}>
            <button
              type="button"
              className="legal-cta"
              onClick={onBack}
              style={{
                padding: "16px 44px", borderRadius: "999px", border: "none",
                background: color.ink, color: "#fff", fontFamily: FONT,
                fontWeight: 700, fontSize: "0.98rem", letterSpacing: "0.01em",
                cursor: "pointer", boxShadow: shadow.pill,
              }}
            >
              I understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LegalDocScreen;