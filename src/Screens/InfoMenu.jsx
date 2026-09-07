import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { color, ease, font, radius, shadow } from "./theme";

// Terms / Privacy / About Us.
//
// Desktop: listed straight across the top-right — there's only three of
// them and they're all short, so a menu is one click of friction for no
// gain at that width.
//
// Mobile: the three links plus gaps don't leave the logo any room once the
// screen narrows, so below 560px they collapse behind a single "info"
// button. Tapping it opens a small dropdown with the same three items.
const InfoMenu = ({ onSelect }) => {
  const items = [
    { key: "terms",   label: "Terms & Condition" },
    { key: "privacy", label: "Privacy Policy" },
    { key: "about",   label: "About Us" },
  ];

  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const pillRef = useRef(null);
  const [pillWidth, setPillWidth] = useState(0);

  // fr-based grid transitions don't reliably anchor to one edge across
  // browsers — the track can grow from both sides instead of purely from
  // the right, which is what made this look like it was expanding outward
  // rather than sliding left from the button. Measuring the pill's real
  // width and animating an explicit px width fixes the anchor: the wrap
  // sits in a row with the button fixed on the right, so a width change
  // only ever moves the wrap's *left* edge.
  useLayoutEffect(() => {
    const measure = () => {
      if (pillRef.current) setPillWidth(pillRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Close on outside click / Escape / route away, same as any dropdown.
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleSelect = (key) => {
    setOpen(false);
    onSelect(key);
  };

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
          gap: 16px;
        }
        .info-link-divider {
          color: rgba(10,10,10,0.22);
          font-size: 0.875rem;
          line-height: 1;
        }
        .info-link {
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          font-family: ${font.ui};
          font-size: 0.875rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: ${color.ink};
          text-decoration: underline;
          text-underline-offset: 4px;
          text-decoration-thickness: 1.4px;
          text-decoration-color: rgba(10,10,10,0.35);
          white-space: nowrap;
          transition: color 160ms ${ease}, text-decoration-color 160ms ${ease}, text-decoration-thickness 160ms ${ease};
        }
        .info-link:hover {
          opacity: 0.68;
          text-decoration-color: currentColor;
          text-decoration-thickness: 1.8px;
        }
        .info-link:active { opacity: 0.5; }

        .info-menu-mobile {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 20;
          display: none;
          align-items: center;
          gap: 10px;
        }
        .info-menu-btn {
          width: 34px;
          height: 34px;
          flex: none;
          border-radius: 999px;
          border: 1.5px solid rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.14);
          color: ${color.ink};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 160ms ${ease}, transform 160ms ${ease};
        }
        .info-menu-btn:hover { background: rgba(255,255,255,0.22); }
        .info-menu-btn:active { transform: scale(0.94); }

        /* Sits directly beside the button rather than dropping below it.
           Width is driven from JS (measured off the real pill) and
           transitioned as an explicit px value rather than a grid fr
           track — that's what keeps the growth anchored to the right edge
           (beside the button) instead of expanding from both sides. The
           inner layer adds a small padding/negative-margin buffer so the
           pill's own shadow has room to render without getting hard-clipped
           by the overflow that makes the collapse animation work. */
        .info-menu-links-wrap {
          overflow: hidden;
          opacity: 0;
          transition: width 340ms ${ease}, opacity 200ms ${ease};
        }
        .info-menu-links-wrap.open {
          opacity: 1;
        }
        .info-menu-links-inner {
          overflow: hidden;
          min-width: 0;
          margin: -12px;
          padding: 12px;
        }
        .info-menu-pill {
          background: ${color.white};
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 999px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          width: max-content;
        }
        .info-menu-item {
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          font-family: ${font.ui};
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: ${color.ink};
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-thickness: 1.2px;
          text-decoration-color: rgba(10,10,10,0.35);
          white-space: nowrap;
          transition: color 140ms ${ease}, text-decoration-color 140ms ${ease};
        }
        .info-menu-item:hover {
          opacity: 0.68;
          text-decoration-color: currentColor;
        }
        .info-menu-item:active { opacity: 0.5; }
        .info-menu-divider {
          color: rgba(10,10,10,0.22);
          font-size: 0.75rem;
          line-height: 1;
        }

        /* Three links plus the gaps run to roughly 330px, so they'd crowd the
           logo on a phone before they'd ever wrap. Below this width, swap the
           inline links for the single button + slide-out pill instead. */
        @media (max-width: 560px) {
          .info-links { display: none; }
          .info-menu-mobile { display: flex; }
        }
      `}</style>

      {/* Desktop / wide viewport: inline links */}
      <nav className="info-links" aria-label="About this app">
        {items.map((item, i) => (
          <React.Fragment key={item.key}>
            {i > 0 && <span className="info-link-divider" aria-hidden="true">|</span>}
            <button
              type="button"
              className="info-link"
              onClick={() => onSelect(item.key)}
            >
              {item.label}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {/* Narrow viewport: single button; the links pill slides out beside it */}
      <div className="info-menu-mobile" ref={containerRef}>
        <div
          className={`info-menu-links-wrap${open ? " open" : ""}`}
          style={{ width: open ? `${pillWidth}px` : "0px" }}
        >
          <div className="info-menu-links-inner">
            <div className="info-menu-pill" role="menu" ref={pillRef}>
              {items.map((item, i) => (
                <React.Fragment key={item.key}>
                  {i > 0 && <span className="info-menu-divider" aria-hidden="true">|</span>}
                  <button
                    type="button"
                    role="menuitem"
                    className="info-menu-item"
                    onClick={() => handleSelect(item.key)}
                  >
                    {item.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="info-menu-btn"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="About this app"
          onClick={() => setOpen(prev => !prev)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="11" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      </div>
    </>
  );
};

export default InfoMenu;