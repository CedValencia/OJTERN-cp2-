import React, { useState, useRef, useEffect } from "react";
import reportIcon from "../icons/report.png";
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { color, font, type, space, radius, shadow, ease } from "./theme";

// ── Design tokens, aliased for this screen ────────────────────────────────────
// Everything below reads from theme.js. Walang hardcoded hex dito — kung
// magbabago ang palette, sa theme.js lang ang edit.
const ink        = color.ink;          // primary text on light surfaces
const inkBody    = color.inkBody;      // body copy
const inkMuted   = color.inkMuted;     // secondary/meta text
const inkFaint   = color.inkFaint;     // placeholders, empty states
const surface    = color.wine600;      // cards
const page       = color.wine900;      // page background
const field      = color.wine700;      // inputs / neutral fills
const line       = color.wine700;      // hairlines & borders
const lineSoft   = color.wine800;
const panel      = color.blush100;     // dark panels (header bar, modal footer)
const panelDeep  = color.blush50;
const onPanel    = color.onWine;
const onPanelDim = color.onWineMuted;
const danger     = color.danger;
const success    = color.success;

const MAPBOX_TOKEN = "pk.eyJ1IjoibWFraWlpaS0iLCJhIjoiY21wbTgybHVmMmc1ZzJycTFuZXRlb3NoNCJ9.FIpjF2lKTHkbU1e6qrL_Pw";

// ── Mapbox read-only map view ──────────────────────────────────────────────────
const MapboxStaticView = ({ lat, lng, address }) => {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const [showZoom, setShowZoom] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!lat || !lng) return;

    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    document.head.appendChild(link);

    const initMap = () => {
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lng, lat],
        zoom: 15,
        interactive: true,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      new mapboxgl.Marker({ color: danger }).setLngLat([lng, lat]).addTo(map);
      mapRef.current = map;
    };

    if (window.mapboxgl) { initMap(); return; }
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = initMap;
    document.head.appendChild(script);
  }, [lat, lng]);

  if (!lat || !lng) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "200px", borderRadius: radius.card, background: field, border: `1px solid ${line}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: space.sm }}>
        <svg width="26" height="32" viewBox="0 0 24 30" fill={inkFaint}><path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>
        <span style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, textAlign: "center", padding: `0 ${space.md}` }}>{address || "No location set"}</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%", borderRadius: radius.card, overflow: "hidden", border: `1px solid ${line}` }} />
      <button
        onClick={() => setShowZoom(true)}
        title="Open the full map"
        style={{
          position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)",
          background: panelDeep, color: onPanel, border: "none", borderRadius: radius.pill,
          padding: "6px 14px", fontFamily: font.ui, ...type.helper, fontWeight: 500,
          cursor: "pointer", zIndex: 5, boxShadow: shadow.pill,
        }}
      >
        Open full map
      </button>
      {showZoom && <MapZoomModal lat={lat} lng={lng} onClose={() => setShowZoom(false)} />}
    </div>
  );
};

// ── Fullscreen map modal ───────────────────────────────────────────────────────
const MapZoomModal = ({ lat, lng, onClose }) => {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);

  useEffect(() => {
    const loadMap = () => {
      if (!mapContainerRef.current || mapRef.current) return;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      mapRef.current = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style:     "mapbox://styles/mapbox/standard-satellite",
        center:    [lng, lat],
        zoom:      15,
      });
      mapRef.current.addControl(new window.mapboxgl.NavigationControl(), "top-right");
      new window.mapboxgl.Marker({ color: danger }).setLngLat([lng, lat]).addTo(mapRef.current);
    };

    if (window.mapboxgl) { loadMap(); return; }
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = loadMap;
    document.head.appendChild(script);

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [lat, lng]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: space.md }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "min(92vw, 800px)", height: "min(85vh, 560px)", borderRadius: radius.panel, overflow: "hidden", position: "relative", boxShadow: shadow.panel }}
      >
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        <button
          onClick={onClose}
          style={{ position: "absolute", top: space.md, left: space.md, zIndex: 10, background: panel, color: onPanel, border: "none", borderRadius: radius.pill, padding: "8px 18px", fontFamily: font.ui, ...type.control, cursor: "pointer", boxShadow: shadow.pill }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

const CLOUDINARY_CLOUD_NAME    = "doalndt5l";
const CLOUDINARY_UPLOAD_PRESET = "ojtern_docs";

// ─── SUCCESS MODAL ────────────────────────────────────────────────────────────
const SuccessModal = ({ onClose }) => {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,10,0.5)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: space.md,
      }}
    >
      <div
        style={{
          background: surface,
          borderRadius: radius.panel,
          padding: `${space.xl} ${space.lg}`,
          textAlign: "center",
          maxWidth: "380px",
          border: `1px solid ${line}`,
          boxShadow: shadow.panel,
        }}
      >
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: lineSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: `0 auto ${space.md}` }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 style={{ fontFamily: font.ui, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, marginBottom: space.sm }}>Report sent</h3>
        <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, marginBottom: space.lg }}>The review team will look into it and get back to you here.</p>
        <button
          onClick={onClose}
          style={{
            background: panel,
            color: onPanel,
            border: "none",
            borderRadius: radius.pill,
            padding: "11px 34px",
            fontFamily: font.ui,
            ...type.control,
            cursor: "pointer",
            transition: `background 240ms ${ease}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = panelDeep)}
          onMouseLeave={(e) => (e.currentTarget.style.background = panel)}
        >
          Done
        </button>
      </div>
    </div>
  );
};

// ── Location data (unused — replaced by free-text city search in FilterPanel) ─
const REGIONS = [];

// ── Industry categories — must match exactly what companies select on sign-up ─
const INDUSTRIES = [];

// Kept for legacy import compatibility — use useOjtPosts hook instead
export const ALL_COMPANIES = [];

// ── Hook: fetch live OJT posts from Firestore ─────────────────────────────────
const useOjtPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "ojt_posts"), where("disabled", "==", false));
    const unsub = onSnapshot(q, snap => {
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loaded.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(loaded);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);
  return { posts, loading };
};

const reportCategories = [
  { label: "Fraud and Scam", description: "Job scams are fraudulent schemes where scammers impersonate employers to steal money, personal information, or coerce victims into fake work activities, but awareness and verification can prevent victimization.", details: ["Fake job postings requiring payment", "Identity theft", "Misrepresentation of company"] },
  { label: "Discrimination", description: "Discrimination in the workplace involves unfair treatment of individuals based on race, gender, age, religion, disability, or other protected characteristics.", details: ["Racial discrimination", "Gender-based bias", "Age discrimination", "Religious intolerance"] },
  { label: "Sexual Harassment", description: "Sexual harassment includes any unwelcome sexual advances, requests for sexual favors, or other verbal or physical conduct of a sexual nature in the workplace.", details: ["Unwanted physical contact", "Verbal harassment", "Hostile work environment", "Quid pro quo harassment"] },
  { label: "Harmful Misinformation", description: "Spreading false information about OJT programs, company practices, or student requirements that can mislead or harm students.", details: ["False program descriptions", "Fake requirements", "Misleading slot information"] },
  { label: "Workplace Misconduct", description: "Workplace misconduct refers to behavior that violates company policies or professional standards, including unsafe working conditions and policy violations.", details: ["Unsafe working conditions", "Violation of OJT agreement", "Forced overtime", "Unpaid work"] },
  { label: "Others", description: "Any other concern not listed above. Please provide a detailed description of the issue.", details: [] },
];

// ── Responsive breakpoint hook ─────────────────────────────────────────────────
const useBreakpoint = () => {
  const [bp, setBp] = useState({ isMobile: false, isTablet: false, isDesktop: true });
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setBp({ isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return bp;
};

// ── Responsive styles injected once ───────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    /* Company grid: 2-col ≥768px, 1-col below — NO horizontal scroll */
    .coord-company-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: ${space.md};
    }
    @media (max-width: 767px) {
      .coord-company-grid { grid-template-columns: 1fr; }
    }

    /* Search bar shrinks on mobile */
    .coord-search-input { width: 170px; }
    .coord-search-input::placeholder { color: ${inkFaint}; }
    @media (max-width: 480px) {
      .coord-search-input { width: 110px; }
    }

    /* Visible keyboard focus on every control in this screen */
    .coord-list-wrapper :focus-visible,
    .coord-profile-content :focus-visible,
    .coord-modal :focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: ${radius.pill};
    }

    /* Company profile content padding */
    .coord-profile-content {
      padding: 28px 32px 104px;
    }
    @media (max-width: 640px) {
      .coord-profile-content { padding: 16px 16px 104px; }
    }

    /* Profile top row: side-by-side on desktop, stacked on mobile */
    .coord-profile-top {
      display: flex;
      gap: ${space.lg};
      margin-bottom: ${space.lg};
    }
    @media (max-width: 640px) {
      .coord-profile-top { flex-direction: column; }
    }

    /* Map: full width on mobile */
    .coord-map-box {
      width: 320px;
      height: 260px;
      flex-shrink: 0;
    }
    @media (max-width: 640px) {
      .coord-map-box { width: 100%; height: 240px; }
    }

    /* Profile bottom bar */
    .coord-profile-bar { padding: 14px 32px; }
    @media (max-width: 640px) {
      .coord-profile-bar { padding: 12px 16px; }
    }

    /* Search+filter bar layout */
    .coord-search-bar {
      padding: 18px 22px;
      margin-bottom: ${space.lg};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${space.md};
    }
    @media (max-width: 480px) {
      .coord-search-bar { padding: 14px; }
    }

    /* List wrapper: vertical scroll only, no horizontal overflow */
    .coord-list-wrapper {
      overflow-x: hidden;
      width: 100%;
    }

    @media (prefers-reduced-motion: reduce) {
      .coord-card { transition: none !important; }
    }
  `}</style>
);

// ── Alert Modal (replaces native window.alert with an in-app styled dialog) ──
const AlertModal = ({ message, onClose }) => (
  <div className="coord-modal" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: space.md }}>
    <div style={{ background: surface, borderRadius: radius.card, width: "100%", maxWidth: "340px", overflow: "hidden", textAlign: "center", border: `1px solid ${line}`, boxShadow: shadow.panel }}>
      <div style={{ padding: `${space.lg} ${space.lg} ${space.md}` }}>
        <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, margin: 0 }}>{message}</p>
      </div>
      <button onClick={onClose} style={{ width: "100%", padding: "13px", border: "none", borderTop: `1px solid ${line}`, background: surface, color: ink, fontFamily: font.ui, ...type.control, cursor: "pointer" }}>OK</button>
    </div>
  </div>
);

// ── Report Modal ───────────────────────────────────────────────────────────────
const ReportModal = ({ company, onClose, onSubmit, reporter }) => {
  const [step, setStep]               = useState(1);
  const [selected, setSelected]       = useState(null);
  const [description, setDescription] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);  // { name, type, url (local preview), file (raw) }
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [alertMsg, setAlertMsg]       = useState("");
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ["image/png", "application/pdf"];
    if (!allowed.includes(file.type)) { setAlertMsg("That file type isn't supported. Attach a PNG or a PDF."); return; }
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) { setAlertMsg("That file is over 10MB. Attach a smaller one."); return; }
    const url = URL.createObjectURL(file);
    setAttachedFile({ name: file.name, type: file.type, url, file });
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "ojtern_reports");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("The file didn't upload. Try again.");
    const data = await res.json();
    return { url: data.secure_url, name: file.name, type: file.type };
  };

  const handleSubmit = async () => {
    if (!description.trim()) { setAlertMsg("Add a description of what happened."); return; }
    if (!attachedFile)        { setAlertMsg("Attach a file that supports your report."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      let fileData = null;
      if (attachedFile?.file) {
        fileData = await uploadToCloudinary(attachedFile.file);
      }

      const reportDoc = {
        // `company` here is an ojt_posts document (see useOjtPosts), whose
        // own `.id` is the POST's Firestore doc ID — not the company's.
        // The actual owning company's uid is stored on the post as
        // `companyId` (see CompanyDashboardScreen's `where("companyId", "==", user.uid)`
        // query against ojt_posts). Reading `company.id` here instead of
        // `company.companyId` was writing the wrong id into every report —
        // silently breaking any downstream lookup of `companies/{companyId}`
        // (status changes, suspension/block, etc. never found the account).
        companyId:      company.companyId || company.id || company.uid || "",
        company:        company.companyName || company.name || "",
        concern:        selected?.label || "Others",
        description,
        attachedFile:   fileData,
        reportedBy:     reporter?.uid  || "",
        reporterName:   reporter?.name || reporter?.companyName || "Unknown",
        reporterRole:   reporter?.role || "coordinator",
        date:           new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        createdAt:      serverTimestamp(),
        status:         "pending",
      };

      await addDoc(collection(db, "reports"), reportDoc);
      onSubmit?.({ ...reportDoc, attachedFile: fileData || attachedFile });
      onClose();
    } catch (err) {
      setSubmitError(err.message || "The report didn't send. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const cat = reportCategories.find(c => c.label === selected?.label);

  return (
    <div className="coord-modal" style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: space.md }}>
      <div style={{ background: surface, borderRadius: radius.panel, width: "100%", maxWidth: "540px", maxHeight: "86vh", overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${line}`, boxShadow: shadow.panel }}>
        <div style={{ padding: `${space.md} ${space.lg}`, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${line}` }}>
          <div>
            <span style={{ fontFamily: font.ui, fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink }}>Report this company</span>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginTop: "2px" }}>Step {step} of 3</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: "1.15rem", cursor: "pointer", color: inkMuted, lineHeight: 1 }}>✕</button>
        </div>

        {/* Progress hairline — three segments, one per step */}
        <div style={{ display: "flex", gap: "3px", padding: `0 ${space.lg}`, marginTop: "10px" }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ flex: 1, height: "3px", borderRadius: radius.pill, background: n <= step ? ink : line, transition: `background 260ms ${ease}` }} />
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: `${space.md} ${space.lg} ${space.lg}` }}>
          {step === 1 && (
            <>
              <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: "12px" }}>What is the concern?</p>
              {reportCategories.map((c) => {
                const isOn = selected?.label === c.label;
                return (
                  <div key={c.label} onClick={() => setSelected(c)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", cursor: "pointer", borderBottom: `1px solid ${lineSoft}` }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: `1.5px solid ${isOn ? ink : color.wine400}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: isOn ? ink : surface, transition: `all 180ms ${ease}` }}>
                      {isOn && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: color.white }} />}
                    </div>
                    <span style={{ fontFamily: font.ui, ...type.body, color: isOn ? ink : inkBody }}>{c.label}</span>
                  </div>
                );
              })}
            </>
          )}
          {step === 2 && cat && (
            <>
              <p style={{ fontFamily: font.ui, fontSize: "1rem", fontWeight: 600, color: ink, marginBottom: space.sm }}>{cat.label}</p>
              <p style={{ fontFamily: font.ui, ...type.body, color: inkBody, marginBottom: space.md, maxWidth: "62ch" }}>{cat.description}</p>
              {cat.details.length > 0 && (
                <>
                  <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: space.sm }}>Common forms this takes</p>
                  <ul style={{ paddingLeft: "18px", margin: 0 }}>
                    {cat.details.map((d, i) => <li key={i} style={{ fontFamily: font.ui, ...type.helper, color: inkBody, marginBottom: space.xs }}>{d}</li>)}
                  </ul>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: space.sm }}>Describe what happened</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Include dates, names, and anything the review team should see."
                style={{ width: "100%", minHeight: "112px", border: `1px solid ${line}`, borderRadius: radius.card, padding: "12px 14px", outline: "none", fontFamily: font.ui, ...type.body, resize: "vertical", background: color.wine800, color: ink, marginBottom: space.lg, boxSizing: "border-box" }}
              />
              <p style={{ fontFamily: font.ui, ...type.label, color: ink, marginBottom: space.xs }}>Attach evidence</p>
              <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, marginBottom: space.sm }}>PNG or PDF, up to 10MB.</p>
              <input ref={fileRef} type="file" accept=".png,.pdf" style={{ display: "none" }} onChange={handleFile} />
              {!attachedFile ? (
                <button onClick={() => fileRef.current.click()} style={{ display: "flex", alignItems: "center", gap: space.sm, background: color.wine800, border: `1px dashed ${color.wine400}`, borderRadius: radius.card, padding: "12px 18px", cursor: "pointer", fontFamily: font.ui, ...type.control, color: ink }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  Choose a file
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: color.wine800, border: `1px solid ${line}`, padding: "10px 14px", borderRadius: radius.card }}>
                  {attachedFile.type.startsWith("image/") ? (
                    <img src={attachedFile.url} alt="Attachment preview" style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "10px" }} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  )}
                  <span style={{ fontFamily: font.ui, ...type.helper, color: inkBody, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} aria-label="Remove file" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: inkMuted, fontSize: "0.95rem" }}>✕</button>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ background: panel, padding: `12px ${space.lg}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
          <div>
            {submitError
              ? <p style={{ fontFamily: font.ui, ...type.helper, color: "#E8A5A2", margin: 0 }}>{submitError}</p>
              : <p style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, margin: 0 }}>{company.companyName || company.name}</p>}
          </div>
          <div style={{ display: "flex", gap: space.sm }}>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                style={{ padding: "9px 18px", borderRadius: radius.pill, background: "transparent", color: onPanelDim, border: `1px solid ${color.onWineFaint}`, fontFamily: font.ui, ...type.control, cursor: "pointer" }}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => { if (step === 1 && !selected) { setAlertMsg("Pick a concern to continue."); return; } setStep(step + 1); }}
                style={{ padding: "9px 22px", borderRadius: radius.pill, background: color.white, color: ink, border: "none", fontFamily: font.ui, ...type.control, cursor: "pointer" }}
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ padding: "9px 22px", borderRadius: radius.pill, background: color.white, color: ink, border: "none", fontFamily: font.ui, ...type.control, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "Sending…" : "Send report"}
              </button>
            )}
          </div>
        </div>
      </div>
      {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg("")} />}
    </div>
  );
};

// ── Small section heading used across the profile ─────────────────────────────
const SectionTitle = ({ children }) => (
  <h2 style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, letterSpacing: "-0.01em", color: ink, marginBottom: space.sm }}>{children}</h2>
);

// ── Company Profile ────────────────────────────────────────────────────────────
const CompanyProfile = ({ company, onBack, onMessageNow }) => {
  const _sA = company?.slots || "0/0";
  const isFull = _sA.split("/")[0] === _sA.split("/")[1];
  const loc = company.location || {};
  const locationParts = [loc.street, loc.barangay, loc.city, loc.province, loc.region].filter(Boolean);
  const fullLocation = loc.fullAddress || locationParts.join(", ");
  const locationLines = [
    loc.region   ? ["Region", loc.region]              : null,
    loc.province ? ["Province", loc.province]          : null,
    loc.city     ? ["City or municipality", loc.city]  : null,
    loc.barangay ? ["Barangay", loc.barangay]          : null,
    loc.street   ? ["Street or building", loc.street]  : null,
  ].filter(Boolean);

  const bodyStyle = { fontFamily: font.ui, ...type.body, color: inkBody, maxWidth: "68ch" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: page, overflow: "hidden", position: "relative" }}>
      <div className="coord-profile-content" style={{ flex: 1, overflowY: "auto" }}>

        {/* Top row: description + map */}
        <div className="coord-profile-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <button
              onClick={onBack}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", fontFamily: font.ui, ...type.helper, color: inkMuted, padding: 0, marginBottom: "10px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
            <h1 style={{ fontFamily: font.ui, fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em", color: ink, marginBottom: "10px" }}>{company.companyName || company.name}</h1>
            <p style={bodyStyle}>{company.description}</p>
          </div>
          <div className="coord-map-box" style={{ borderRadius: radius.card, overflow: "hidden" }}>
            <MapboxStaticView
              lat={company.postLocation?.lat || company.location?.lat}
              lng={company.postLocation?.lng || company.location?.lng}
              address={company.postLocation?.address || fullLocation}
            />
          </div>
        </div>

        <hr style={{ border: "none", borderTop: `1px solid ${line}`, margin: `0 0 ${space.lg}` }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: space.lg, flexWrap: "wrap", gap: space.md }}>
          <div>
            <SectionTitle>Requirements</SectionTitle>
            <p style={{ ...bodyStyle, whiteSpace: "pre-line" }}>{Array.isArray(company.requirements) ? company.requirements.join("\n") : (company.requirements || "Not listed")}</p>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: space.sm, background: surface, border: `1px solid ${line}`, borderRadius: radius.pill, padding: "8px 16px" }}>
            <span style={{ fontFamily: font.ui, ...type.helper, color: inkMuted }}>Slots</span>
            <span style={{ fontFamily: font.ui, ...type.control, color: isFull ? danger : success }}>{company.slot || company.slots}</span>
          </div>
        </div>

        <SectionTitle>Working hours</SectionTitle>
        <p style={{ ...bodyStyle, marginBottom: space.lg, whiteSpace: "pre-line" }}>{company.workingHours}</p>

        <SectionTitle>Contact</SectionTitle>
        <p style={{ ...bodyStyle, marginBottom: space.xs }}>Phone: {company.phone || company.contact?.phone || "Not listed"}</p>
        <p style={{ ...bodyStyle, marginBottom: space.lg }}>Email: {company.contactEmail || company.contact?.email || company.email || "Not listed"}</p>

        <SectionTitle>Location</SectionTitle>
        <div style={{ marginBottom: space.lg }}>
          {locationLines.length > 0 ? (
            locationLines.map(([k, v], i) => (
              <p key={i} style={{ ...bodyStyle, marginBottom: "3px" }}>
                <span style={{ color: inkMuted }}>{k}: </span>{v}
              </p>
            ))
          ) : (
            <p style={bodyStyle}>{company.postLocation?.address || "No location set"}</p>
          )}
        </div>

        <SectionTitle>Benefits</SectionTitle>
        <p style={{ ...bodyStyle, whiteSpace: "pre-line", marginBottom: space.lg }}>{Array.isArray(company.benefits) ? company.benefits.join("\n") : (company.benefits || "Not listed")}</p>

        <SectionTitle>Open to these programs</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, marginBottom: space.lg }}>
          {(Array.isArray(company.courseSelections) ? company.courseSelections : []).map((cp, i) => {
            const label = [cp.college, cp.program, cp.specialization].filter(Boolean).join(" · ");
            return (
              <span key={i} style={{ padding: "5px 14px", borderRadius: radius.pill, background: color.wine800, border: `1px solid ${line}`, color: inkBody, fontFamily: font.ui, ...type.helper }}>
                {label}
              </span>
            );
          })}
        </div>

        <SectionTitle>Skills required</SectionTitle>
        <p style={{ ...bodyStyle, whiteSpace: "pre-line" }}>{Array.isArray(company.skillsRequired) ? company.skillsRequired.join("\n") : (company.skillsRequired || company.skills?.join(", ") || "Not listed")}</p>
      </div>

      {/* Bottom action bar */}
      <div className="coord-profile-bar" style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: surface, borderTop: `1px solid ${line}`, display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        <button
          onClick={onMessageNow}
          style={{ background: panel, color: onPanel, border: "none", borderRadius: radius.pill, padding: "12px 28px", fontFamily: font.ui, ...type.control, cursor: "pointer", boxShadow: shadow.pill, transition: `background 240ms ${ease}` }}
          onMouseEnter={e => (e.currentTarget.style.background = panelDeep)}
          onMouseLeave={e => (e.currentTarget.style.background = panel)}
        >
          Message company
        </button>
      </div>
    </div>
  );
};

// ── Back link ──────────────────────────────────────────────────────────────────
const BackLink = ({ label, onClick }) => (
  <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: space.xs, cursor: "pointer", marginBottom: "6px", color: inkMuted, fontFamily: font.ui, ...type.helper }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    {label}
  </div>
);

// ── Filter Panel ───────────────────────────────────────────────────────────────
const FilterPanel = ({ selectedIndustries, setSelectedIndustries, citySearch, setCitySearch }) => {
  const toggleIndustry = (ind) => setSelectedIndustries(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]);

  const clearAll = () => { setSelectedIndustries([]); setCitySearch(""); };

  return (
    <div style={{ position: "absolute", top: "48px", right: 0, width: "250px", background: surface, border: `1px solid ${line}`, borderRadius: radius.card, boxShadow: shadow.panel, zIndex: 100, overflow: "hidden", fontFamily: font.ui }}>
      <div style={{ padding: `12px 14px 6px` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm }}>
          <p style={{ ...type.label, color: ink }}>Industry</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", ...type.helper, color: inkMuted, cursor: "pointer", fontFamily: font.ui, padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        <div style={{ maxHeight: "130px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {INDUSTRIES.map(ind => {
            const on = selectedIndustries.includes(ind);
            return (
              <span key={ind} onClick={() => toggleIndustry(ind)} style={{ padding: "4px 11px", borderRadius: radius.pill, ...type.helper, cursor: "pointer", userSelect: "none", background: on ? ink : color.wine800, color: on ? color.white : inkBody, border: `1px solid ${on ? ink : line}`, transition: `all 160ms ${ease}` }}>{ind}</span>
            );
          })}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: `1px solid ${lineSoft}`, margin: `10px 0` }} />

      <div style={{ padding: `0 14px 14px` }}>
        <p style={{ ...type.label, color: ink, marginBottom: space.sm }}>Location</p>
        <input
          type="text"
          value={citySearch}
          onChange={e => setCitySearch(e.target.value)}
          placeholder="City, province, or region"
          style={{ width: "100%", padding: "9px 14px", borderRadius: radius.pill, border: `1px solid ${line}`, background: color.wine800, ...type.helper, fontFamily: font.ui, outline: "none", boxSizing: "border-box", color: ink }}
        />
      </div>
    </div>
  );
};

// ── Company Card ───────────────────────────────────────────────────────────────
const CompanyCard = ({ company, onViewProfile }) => {
  const isActive = company.disabled === false || company.active !== false;
  const displayName = company.companyName || company.name || "Unnamed company";
  const displayIndustry = Array.isArray(company.industry) ? (company.industry.join(", ") || "—") : (company.industry || "—");
  const displayLocation = typeof company.location === "object"
    ? [company.location.barangay, company.location.city, company.location.province, company.location.region].filter(Boolean).join(", ")
    : (company.location || "—");
  const _sB = company?.slots || "0/0";
  const totalSlots = company?.slot ?? (typeof _sB === "string" ? parseInt(_sB.split("/")[1]) : 0) ?? 0;
  const usedSlots  = typeof _sB === "string" ? parseInt(_sB.split("/")[0]) : 0;
  const isFull = usedSlots >= totalSlots && totalSlots > 0;
  const postedDate = company.createdAt?.seconds
    ? new Date(company.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : (company.posted || "");

  const meta = { fontFamily: font.ui, ...type.helper, color: inkMuted };

  return (
    <div
      className="coord-card"
      onClick={() => isActive && onViewProfile(company)}
      style={{
        background: isActive ? surface : color.wine800,
        borderRadius: radius.card,
        border: `1px solid ${line}`,
        padding: "20px 22px",
        display: "flex", flexDirection: "column", gap: "6px",
        boxShadow: isActive ? shadow.input : "none",
        opacity: isActive ? 1 : 0.72,
        transition: `box-shadow 220ms ${ease}, border-color 220ms ${ease}`,
        cursor: isActive ? "pointer" : "default",
        position: "relative",
        minWidth: 0, overflow: "hidden",
      }}
      onMouseEnter={e => { if (isActive) { e.currentTarget.style.boxShadow = "0 10px 28px rgba(10,10,10,0.10)"; e.currentTarget.style.borderColor = color.wine400; } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = isActive ? shadow.input : "none"; e.currentTarget.style.borderColor = line; }}
    >
      <div style={{ position: "absolute", top: "18px", right: "18px", background: isFull ? color.wine700 : surface, border: `1px solid ${isFull ? color.wine400 : line}`, borderRadius: radius.pill, padding: "3px 10px", fontFamily: font.ui, ...type.helper, color: isFull ? inkMuted : success, fontWeight: 500 }}>
        {isFull ? "Full" : `${totalSlots} slot${totalSlots !== 1 ? "s" : ""}`}
      </div>
      <h3 style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, letterSpacing: "-0.01em", color: isActive ? ink : inkMuted, paddingRight: "76px", lineHeight: 1.3, margin: 0 }}>{displayName}</h3>
      <p style={meta}>{displayIndustry}</p>
      <p style={{ ...meta, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayLocation}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${lineSoft}` }}>
        <span style={{ ...meta, color: inkFaint }}>{postedDate ? `Posted ${postedDate}` : ""}</span>
        <span
          onClick={() => isActive && onViewProfile(company)}
          style={{ fontFamily: font.ui, ...type.helper, fontWeight: 500, color: isActive ? ink : inkFaint, cursor: isActive ? "pointer" : "default", flexShrink: 0 }}
        >
          View post
        </span>
      </div>
    </div>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
const CoordinatorFindCompanyScreen = ({ onReportSubmit, onNavigateToReports, onMessageNow, initialCompanyId, onClearInitialCompany, onBackToOrigin, onVisitCompany, coordinator }) => {
  const { isMobile } = useBreakpoint();
  const { posts: companies, loading } = useOjtPosts();

  const [view, setView]                       = useState("list");
  const [selectedCompany, setSelectedCompany] = useState(null);
  // True only when the currently-open profile was reached via a deep link
  // (initialCompanyId — e.g. "Visit" from a student's Placement modal, or a
  // recent-company row on the Dashboard), not by clicking a card in this
  // screen's own list. Determines whether "back" should call onBackToOrigin
  // (return to wherever that link came from) or just show this list again.
  const [deepLinked, setDeepLinked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [search, setSearch]                   = useState("");
  const [showFilter, setShowFilter]           = useState(false);
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [citySearch,          setCitySearch]          = useState("");
  const filterRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (initialCompanyId && companies.length > 0) {
      // Prefer an exact match on the post itself (e.g. the specific post that
      // accepted a student). Only fall back to matching by companyId if no
      // post carries that id directly, so we don't accidentally land on the
      // wrong post when a company has more than one.
      const company = companies.find(c => c.id === initialCompanyId)
        || companies.find(c => c.companyId === initialCompanyId);
      if (company) { setSelectedCompany(company); setView("profile"); setDeepLinked(true); onVisitCompany?.({ id: company.id, name: company.companyName || company.name }); }
      if (onClearInitialCompany) onClearInitialCompany();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyId, companies]);

  const hasFilter = selectedIndustries.length > 0 || citySearch.trim();

  // Only show posts looking for students from this coordinator's own
  // College AND Program — same scoping used in CoordinatorCompanyListScreen
  // (companyMatchesCoordinator/findMatchingEntry). Department is always
  // required; Program is only required to match when BOTH sides actually
  // specify one — a coordinator scoped to a whole Department (no specific
  // Program picked) sees every post under that Department, and a post that
  // only carries the legacy department-only `departments` field (no
  // per-Program detail — see courseSelections fallback below) still shows
  // up rather than disappearing just because it predates Program-level data.
  const assignedScopes = React.useMemo(
    () => (coordinator?.deptSelections || [])
      .filter(s => s.department)
      .map(s => ({ department: s.department, program: s.program || "" })),
    [coordinator?.deptSelections]
  );
  const assignedDepartments = React.useMemo(
    () => [...new Set(assignedScopes.map(s => s.department))],
    [assignedScopes]
  );

  // A post's own Department/Program pairs. `departments` (flat array, saved
  // by CompanyCreatePostScreen.jsx) has no Program detail, so those entries
  // match on Department alone. `courseSelections` (the older per-post shape,
  // still the only place a post's Program actually lives) is used when
  // present so Program-level matching is possible.
  const getPostScopes = (c) => {
    if (Array.isArray(c.courseSelections) && c.courseSelections.length) {
      return c.courseSelections
        .filter(s => s.college)
        .map(s => ({ department: s.college, program: s.program || "" }));
    }
    if (Array.isArray(c.departments) && c.departments.length) {
      return c.departments.map(d => ({ department: d, program: "" }));
    }
    return [];
  };

  const inScopeCompanies = React.useMemo(() => {
    if (assignedScopes.length === 0) return [];
    return companies.filter(c =>
      getPostScopes(c).some(p =>
        assignedScopes.some(s =>
          p.department === s.department && (!s.program || !p.program || p.program === s.program)
        )
      )
    );
  }, [companies, assignedScopes]);

  const filtered = inScopeCompanies.filter(c => {
    const name = (c.companyName || c.company || c.name || "").toLowerCase();
    const industryArr = Array.isArray(c.industry) ? c.industry : (c.industry ? [c.industry] : []);
    const industry = industryArr.join(" ").toLowerCase();
    const locObj = (c.location && typeof c.location === "object") ? c.location : {};
    // Full location text = everything actually shown on the profile's Location section
    // (barangay, city, province, region, or a full formatted address), so searching
    // any part of what the user sees — not just the city — will find it.
    const fullLocationText = [
      c.postLocation?.address,
      locObj.fullAddress,
      locObj.street,
      locObj.barangay,
      locObj.city,
      locObj.province,
      locObj.region,
      typeof c.location === "string" ? c.location : null,
    ].filter(Boolean).join(", ").toLowerCase();
    const matchSearch   = name.includes(search.toLowerCase()) || industry.includes(search.toLowerCase()) || fullLocationText.includes(search.toLowerCase());
    const matchIndustry = selectedIndustries.length === 0 || industryArr.some(ind => selectedIndustries.includes(ind));
    const matchCity     = !citySearch.trim() || fullLocationText.includes(citySearch.trim().toLowerCase());
    return matchSearch && matchIndustry && matchCity;
  });

  const activeBadgeLabel = () => citySearch.trim() ? citySearch.trim() : null;

  const clearAllFilters = () => { setSelectedIndustries([]); setCitySearch(""); };

  const handleReportSubmit = (report) => {
    if (onReportSubmit) onReportSubmit(report);
    setShowReportModal(false);
    setShowSuccessModal(true);
  };

  const chipStyle = { background: surface, color: inkBody, border: `1px solid ${line}`, borderRadius: radius.pill, padding: "4px 12px", fontFamily: font.ui, ...type.helper, display: "flex", alignItems: "center", gap: "6px" };

  if (view === "profile" && selectedCompany) {
    return (
      <>
        <ResponsiveStyles />
        <CompanyProfile
          company={selectedCompany}
          onBack={() => {
            if (deepLinked && onBackToOrigin) { onBackToOrigin(); }
            else { setView("list"); }
            setDeepLinked(false);
          }}
          onMessageNow={() => onMessageNow && onMessageNow(selectedCompany)}
        />
        {showReportModal && (
          <ReportModal company={selectedCompany} onClose={() => setShowReportModal(false)} onSubmit={handleReportSubmit} reporter={coordinator} />
        )}
        {showSuccessModal && (
          <SuccessModal onClose={() => { setShowSuccessModal(false); if (onNavigateToReports) onNavigateToReports(); }} />
        )}
      </>
    );
  }

  return (
    <>
      <ResponsiveStyles />
      {/* Outer: vertical scroll only, no horizontal overflow */}
      <div className="coord-list-wrapper" style={{ padding: "clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px)", overflowY: "auto", flex: 1, background: page }}>

        {/* Search + Filter bar */}
        <div className="coord-search-bar" style={{ background: panel, borderRadius: radius.panel }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontFamily: font.ui, fontSize: "clamp(1.1rem, 3.5vw, 1.375rem)", fontWeight: 600, letterSpacing: "-0.01em", color: onPanel }}>Find a company</span>
            {!loading && (
              <p style={{ fontFamily: font.ui, ...type.helper, color: onPanelDim, marginTop: "2px" }}>
                {filtered.length} open {filtered.length === 1 ? "post" : "posts"} for your programs
              </p>
            )}
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: space.sm, background: color.white, borderRadius: radius.pill, padding: "9px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search"
                className="coord-search-input"
                style={{ border: "none", background: "transparent", outline: "none", color: ink, fontFamily: font.ui, ...type.control }}
              />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search" style={{ background: "none", border: "none", color: inkMuted, cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>}
            </div>
            <div ref={filterRef} style={{ position: "relative", marginLeft: "10px" }}>
              <div
                onClick={() => setShowFilter(v => !v)}
                title="Filters"
                style={{ width: "40px", height: "40px", background: hasFilter ? color.goldTint : color.white, borderRadius: radius.pill, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `1px solid ${color.onWineFaint}` : "none", position: "relative" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? onPanel : inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              </div>
              {showFilter && (
                <FilterPanel
                  selectedIndustries={selectedIndustries} setSelectedIndustries={setSelectedIndustries}
                  citySearch={citySearch} setCitySearch={setCitySearch}
                />
              )}
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {hasFilter && (
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.md, flexWrap: "wrap" }}>
            {selectedIndustries.map(ind => (
              <span key={ind} style={chipStyle}>
                {ind}<span onClick={() => setSelectedIndustries(p => p.filter(i => i !== ind))} style={{ cursor: "pointer", color: inkMuted }}>✕</span>
              </span>
            ))}
            {activeBadgeLabel() && (
              <span style={chipStyle}>
                {activeBadgeLabel()}
                <span onClick={() => setCitySearch("")} style={{ cursor: "pointer", color: inkMuted }}>✕</span>
              </span>
            )}
            <span onClick={clearAllFilters} style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, cursor: "pointer", textDecoration: "underline" }}>Clear all</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 0" }}>
            <p style={{ fontFamily: font.ui, ...type.body, color: inkFaint }}>Loading posts…</p>
          </div>
        ) : filtered.length > 0 ? (
          /* CSS grid: 2-col on ≥768px, 1-col below — controlled entirely by .coord-company-grid */
          <div className="coord-company-grid">
            {filtered.map(c => (
              <CompanyCard
                key={c.id}
                company={c}
                onViewProfile={(company) => { setSelectedCompany(company); setView("profile"); setDeepLinked(false); onVisitCompany?.({ id: company.id, name: company.companyName || company.name }); }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 24px", gap: space.sm, textAlign: "center", background: surface, border: `1px dashed ${color.wine400}`, borderRadius: radius.panel }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={inkFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p style={{ fontFamily: font.ui, fontSize: "1.0625rem", fontWeight: 600, color: ink }}>No posts match this search</p>
            <p style={{ fontFamily: font.ui, ...type.helper, color: inkMuted, maxWidth: "44ch" }}>
              {hasFilter ? "Clear a filter or search a different city to widen the results." : "New posts appear here as companies publish them for your programs."}
            </p>
            {hasFilter && (
              <button onClick={clearAllFilters} style={{ marginTop: space.sm, background: panel, color: onPanel, border: "none", borderRadius: radius.pill, padding: "9px 20px", fontFamily: font.ui, ...type.control, cursor: "pointer" }}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CoordinatorFindCompanyScreen;