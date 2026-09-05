import React, { useEffect, useRef, useState } from "react";
import { color, radius, shadow, ease } from "./theme";

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="11" />
    <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

const InfoMenu = ({ open, onToggle, onSelect }) => {
  const wrapRef = useRef(null);
  const [iconHover, setIconHover] = useState(false);
  const [hoverKey, setHoverKey] = useState(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onToggle(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onToggle]);

  const items = [
    { key: "terms",   label: "Terms & Condition" },
    { key: "privacy", label: "Privacy Policy" },
    { key: "about",   label: "About Us" },
  ];

  return (
    <div ref={wrapRef} style={{ position: "absolute", top: "20px", right: "20px", zIndex: 20 }}>
      <button
        type="button"
        aria-label="About this app"
        onClick={() => onToggle(!open)}
        onMouseEnter={() => setIconHover(true)}
        onMouseLeave={() => setIconHover(false)}
        style={{
          width: "34px", height: "34px", borderRadius: "50%",
          border: "none", cursor: "pointer",
          background: iconHover ? "#000000" : "rgba(0,0,0,0.08)",
          color: iconHover ? "#fff" : color.ink,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: `background 160ms ${ease}, color 160ms ${ease}`,
        }}
      >
        <InfoIcon />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "42px", right: 0,
            minWidth: "190px",
            background: "#2b2b2b",
            borderRadius: radius?.panel ?? "14px",
            boxShadow: shadow?.panel ?? "0 10px 30px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button" role="menuitem"
              onClick={() => { onToggle(false); onSelect(item.key); }}
              onMouseEnter={() => setHoverKey(item.key)}
              onMouseLeave={() => setHoverKey(null)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 16px", border: "none",
                borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.12)" : "none",
                borderTopLeftRadius: i === 0 ? (radius?.panel ?? "14px") : 0,
                borderTopRightRadius: i === 0 ? (radius?.panel ?? "14px") : 0,
                borderBottomLeftRadius: i === items.length - 1 ? (radius?.panel ?? "14px") : 0,
                borderBottomRightRadius: i === items.length - 1 ? (radius?.panel ?? "14px") : 0,
                background: hoverKey === item.key ? "#ffffff" : "transparent",
                color: hoverKey === item.key ? "#000000" : "#fff",
                fontSize: "0.9rem", fontWeight: 500, cursor: "pointer",
                transition: `background 160ms ${ease}`,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default InfoMenu;