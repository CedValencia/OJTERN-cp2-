import React from "react";
import { color, ease, font } from "./theme";

// Terms / Privacy / About Us, listed straight across the top-right rather
// than hidden behind an icon. There's only three of them and they're all
// short, so a menu was one click of friction for no gain.
//
// `open` / `onToggle` are accepted but unused — there's no longer a dropdown
// to open. They're kept so callers that still pass them don't break.
const InfoMenu = ({ onSelect }) => {
  const items = [
    { key: "terms",   label: "Terms & Condition" },
    { key: "privacy", label: "Privacy Policy" },
    { key: "about",   label: "About Us" },
  ];

  return (
    <>
      <style>{`
        .info-links {
          position: absolute;
          top: 22px;
          right: 32px;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 34px;
        }
        .info-link {
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          font: inherit;
          font-size: 0.875rem;
          font-weight: 500;
          color: ${color.ink};
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-thickness: 1px;
          white-space: nowrap;
          transition: opacity 160ms ${ease}, text-decoration-thickness 160ms ${ease};
        }
        .info-link:hover {
          opacity: 0.62;
          text-decoration-thickness: 2px;
        }
        .info-link:active { opacity: 0.45; }

        /* Three links plus the gaps run to roughly 330px, so they'd crowd the
           logo on a phone before they'd ever wrap. Tightening both the gap and
           the type keeps them on one line down to ~340px wide. */
        @media (max-width: 560px) {
          .info-links { top: 16px; right: 16px; gap: 16px; }
          .info-link  { font-size: 0.75rem; }
        }
        @media (max-width: 380px) {
          .info-links { gap: 12px; }
          .info-link  { font-size: 0.6875rem; }
        }
      `}</style>

      <nav className="info-links" aria-label="About this app">
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            className="info-link"
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
};

export default InfoMenu;