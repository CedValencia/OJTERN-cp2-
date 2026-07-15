import React, { useState, useRef, useEffect } from "react";
import reportIcon from "../icons/report.png";
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const MAPBOX_TOKEN = "pk.eyJ1IjoibWFraWlpaS0iLCJhIjoiY21wbTgybHVmMmc1ZzJycTFuZXRlb3NoNCJ9.FIpjF2lKTHkbU1e6qrL_Pw";

// ── Mapbox read-only map view ──────────────────────────────────────────────────
const MapboxStaticView = ({ lat, lng, address }) => {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);

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
      new mapboxgl.Marker({ color: "#8B0000" }).setLngLat([lng, lat]).addTo(map);
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
      <div style={{ width: "100%", minHeight: "200px", borderRadius: "14px", background: "#d0d8e0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        <svg width="30" height="36" viewBox="0 0 24 30" fill="#8B0000"><path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>
        <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "#555", textAlign: "center", padding: "0 12px" }}>{address || "No location set"}</span>
      </div>
    );
  }

  return <div ref={mapContainer} style={{ width: "100%", height: "300px", borderRadius: "14px", overflow: "hidden" }} />;
};

const CLOUDINARY_CLOUD_NAME    = "doalndt5l";
const CLOUDINARY_UPLOAD_PRESET = "ojtern_docs";

const red     = "#8B0000";
const darkRed = "#590101";

// ── Location data (unused — replaced by free-text city search in FilterPanel) ─
const REGIONS = [];

// ── Industry categories — must match exactly what companies select on sign-up ─
const INDUSTRIES = [
  "Agriculture",
  "Computer and Technology",
  "Education",
  "Finance and Economics",
  "Health Care",
  "Hospitality",
  "Manufacturing",
  "Media and News",
  "Pharmaceutical",
  "Telecommunications",
  "Transportation",
];

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
    /* Company grid: 2-col ≥768px, 1-col below — NO horizontal scroll */
    .coord-company-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (max-width: 767px) {
      .coord-company-grid { grid-template-columns: 1fr; }
    }

    /* Search bar shrinks on mobile */
    .coord-search-input {
      width: 160px;
    }
    @media (max-width: 480px) {
      .coord-search-input { width: 110px; }
    }

    /* Company profile content padding */
    .coord-profile-content {
      padding: 28px 32px 100px;
    }
    @media (max-width: 640px) {
      .coord-profile-content { padding: 16px 16px 100px; }
    }

    /* Profile top row: side-by-side on desktop, stacked on mobile */
    .coord-profile-top {
      display: flex;
      gap: 24px;
      margin-bottom: 20px;
    }
    @media (max-width: 640px) {
      .coord-profile-top { flex-direction: column; }
    }

    /* Map placeholder: full width on mobile */
    .coord-map-box {
      width: 180px;
      flex-shrink: 0;
    }
    @media (max-width: 640px) {
      .coord-map-box { width: 100%; min-height: 100px; }
    }

    /* Profile bottom bar */
    .coord-profile-bar {
      padding: 14px 32px;
    }
    @media (max-width: 640px) {
      .coord-profile-bar { padding: 12px 16px; }
    }

    /* Search+filter bar layout */
    .coord-search-bar {
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
    @media (max-width: 480px) {
      .coord-search-bar { padding: 12px 14px; }
    }

    /* List wrapper: vertical scroll only, no horizontal overflow */
    .coord-list-wrapper {
      overflow-x: hidden;
      width: 100%;
    }
  `}</style>
);

// ── Report Modal ───────────────────────────────────────────────────────────────
const ReportModal = ({ company, onClose, onSubmit, reporter }) => {
  const [step, setStep]               = useState(1);
  const [selected, setSelected]       = useState(null);
  const [description, setDescription] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);  // { name, type, url (local preview), file (raw) }
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "application/pdf"];
    if (!allowed.includes(file.type)) { alert("Only PNG, JPG, and PDF files are allowed."); return; }
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
    if (!res.ok) throw new Error("File upload failed.");
    const data = await res.json();
    return { url: data.secure_url, name: file.name, type: file.type };
  };

  const handleSubmit = async () => {
    if (!description.trim()) { alert("Please write a description."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      let fileData = null;
      if (attachedFile?.file) {
        fileData = await uploadToCloudinary(attachedFile.file);
      }

      const reportDoc = {
        companyId:      company.id   || company.uid || "",
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
      setSubmitError(err.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const cat = reportCategories.find(c => c.label === selected?.label);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div style={{ background: "white", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eee" }}>
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.5rem", color: darkRed }}>Reports:</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#555" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {step === 1 && (
            <>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "14px" }}>Please select:</p>
              {reportCategories.map((cat) => (
                <div key={cat.label} onClick={() => setSelected(cat)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", border: `2px solid ${red}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: selected?.label === cat.label ? red : "white" }}>
                    {selected?.label === cat.label && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "white" }} />}
                  </div>
                  <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.93rem", color: "#222" }}>{cat.label}</span>
                </div>
              ))}
            </>
          )}
          {step === 2 && cat && (
            <>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: "6px" }}>{cat.label}</p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#666", marginBottom: "12px" }}>More about this reason:</p>
              <hr style={{ borderColor: "#eee", marginBottom: "14px" }} />
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444", lineHeight: 1.7, marginBottom: "14px" }}>{cat.description}</p>
              {cat.details.length > 0 && (
                <>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", marginBottom: "8px" }}>Common Types:</p>
                  <ul style={{ paddingLeft: "18px" }}>
                    {cat.details.map((d, i) => <li key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.83rem", color: "#555", marginBottom: "4px" }}>{d}</li>)}
                  </ul>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "10px" }}>Write a description:</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the issue..."
                style={{ width: "100%", minHeight: "100px", border: "none", borderBottom: `2px solid ${red}`, outline: "none", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", resize: "none", background: "transparent", color: "#222", marginBottom: "20px" }}
              />
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "10px" }}>Attach File:</p>
              <input ref={fileRef} type="file" accept=".png,.pdf" style={{ display: "none" }} onChange={handleFile} />
              {!attachedFile ? (
                <div onClick={() => fileRef.current.click()} style={{ width: "80px", height: "80px", background: "#e8c8c8", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f5f5f5", padding: "10px 14px", borderRadius: "8px" }}>
                  {attachedFile.type.startsWith("image/") ? (
                    <img src={attachedFile.url} alt="preview" style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px" }} />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  )}
                  <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#555" }}>{attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "1rem" }}>✕</button>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ background: darkRed, padding: "12px 20px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          {submitError && <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "#ffcccc", margin: 0 }}>⚠️ {submitError}</p>}
          {step < 3 ? (
            <button
              onClick={() => { if (step === 1 && !selected) { alert("Please select a concern."); return; } setStep(step + 1); }}
              style={{ padding: "8px 20px", borderRadius: "20px", background: "rgba(255,255,255,0.2)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
            >
              Next {step}/3
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ padding: "8px 20px", borderRadius: "20px", background: "rgba(255,255,255,0.2)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", fontSize: "0.85rem", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Company Profile ────────────────────────────────────────────────────────────
const CompanyProfile = ({ company, onBack, onReport, onMessageNow }) => {
  const _sA = company?.slots || "0/0";
  const isFull = _sA.split("/")[0] === _sA.split("/")[1];
  const loc = company.location || {};
  const locationParts = [loc.street, loc.barangay, loc.city, loc.province, loc.region].filter(Boolean);
  const fullLocation = loc.fullAddress || locationParts.join(", ");
  const locationLines = [
    loc.region   ? `Region: ${loc.region}`          : null,
    loc.province ? `Province: ${loc.province}`      : null,
    loc.city     ? `City/Municipality: ${loc.city}` : null,
    loc.barangay ? `Barangay: ${loc.barangay}`      : null,
    loc.street   ? `Street/Building: ${loc.street}` : null,
  ].filter(Boolean);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f5f5f5", overflow: "hidden", position: "relative" }}>
      <div className="coord-profile-content" style={{ flex: 1, overflowY: "auto" }}>

        {/* Top row: description + map */}
        <div className="coord-profile-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
              <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Monomaniac One', sans-serif", fontSize: "3rem", color: "#1a1a1a", lineHeight: 1, padding: 0, flexShrink: 0 }}>←</button>
              <h1 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#111" }}>{company.companyName || company.name}</h1>
            </div>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.88rem)", color: "#444", lineHeight: 1.7 }}>{company.description}</p>
          </div>
          <div className="coord-map-box" style={{ borderRadius: "14px", overflow: "hidden", minHeight: "130px" }}>
            <MapboxStaticView
              lat={company.postLocation?.lat || company.location?.lat}
              lng={company.postLocation?.lng || company.location?.lng}
              address={company.postLocation?.address || fullLocation}
            />
          </div>
        </div>

        <hr style={{ borderColor: "#ddd", marginBottom: "20px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Requirements</h2>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", whiteSpace: "pre-line" }}>{Array.isArray(company.requirements) ? company.requirements.join("\n") : (company.requirements || "N/A")}</p>
          </div>
          <div>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1rem", fontWeight: 700, color: "#111" }}>Slot: </span>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1rem", fontWeight: 700, color: isFull ? red : "#2a7a2a" }}>{company.slot || company.slots}</span>
          </div>
        </div>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Working Hours</h2>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", marginBottom: "20px", whiteSpace: "pre-line" }}>{company.workingHours}</p>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Contact Information</h2>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", marginBottom: "4px" }}>Phone Number: {company.phone || company.contact?.phone || "N/A"}</p>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", marginBottom: "20px" }}>Email: {company.contactEmail || company.contact?.email || company.email || "N/A"}</p>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Location</h2>
        <div style={{ marginBottom: "20px" }}>
          {company.postLocation?.address ? (
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444" }}>{company.postLocation.address}</p>
          ) : (
            locationLines.map((line, i) => (
              <p key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", marginBottom: "3px" }}>{line}</p>
            ))
          )}
        </div>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Benefits</h2>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", whiteSpace: "pre-line", marginBottom: "20px" }}>{Array.isArray(company.benefits) ? company.benefits.join("\n") : (company.benefits || "N/A")}</p>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "10px" }}>Course / Program:</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
          {(Array.isArray(company.courseSelections) ? company.courseSelections : []).map((cp, i) => {
            const label = [cp.college, cp.program, cp.specialization].filter(Boolean).join(" – ");
            return (
              <span key={i} style={{ padding: "4px 14px", borderRadius: "20px", background: "#e0f0e0", color: "#2a7a2a", fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", fontWeight: 600 }}>
                {label}
              </span>
            );
          })}
        </div>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "10px" }}>Skills Required</h2>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", whiteSpace: "pre-line" }}>{Array.isArray(company.skillsRequired) ? company.skillsRequired.join("\n") : (company.skillsRequired || company.skills?.join(", ") || "N/A")}</p>
      </div>

      {/* Bottom action bar */}
      <div className="coord-profile-bar" style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onMessageNow} style={{ background: darkRed, color: "white", border: "none", borderRadius: "24px", padding: "12px 28px", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>
          Message Now!
        </button>
        <div onClick={onReport} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <img src={reportIcon} alt="Report" style={{ width: "44px", height: "44px", objectFit: "contain" }} />
          <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: darkRed, fontWeight: 600 }}>Report!</span>
        </div>
      </div>
    </div>
  );
};

// ── Back link ──────────────────────────────────────────────────────────────────
const BackLink = ({ label, onClick }) => (
  <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "6px", color: red, fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif" }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    {label}
  </div>
);

// ── Filter Panel ───────────────────────────────────────────────────────────────
const FilterPanel = ({ selectedIndustries, setSelectedIndustries, citySearch, setCitySearch }) => {
  const toggleIndustry = (ind) => setSelectedIndustries(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]);

  const clearAll = () => { setSelectedIndustries([]); setCitySearch(""); };

  return (
    <div style={{ position: "absolute", top: "48px", right: 0, width: "240px", background: "white", border: `1.5px solid ${red}`, borderRadius: "10px", boxShadow: "0 6px 24px rgba(0,0,0,0.18)", zIndex: 100, overflow: "hidden", fontFamily: "'Kufam', sans-serif" }}>
      <div style={{ padding: "10px 12px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed }}>Industry:</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontSize: "0.7rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        <div style={{ maxHeight: "130px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {INDUSTRIES.map(ind => (
            <span key={ind} onClick={() => toggleIndustry(ind)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.72rem", cursor: "pointer", userSelect: "none", background: selectedIndustries.includes(ind) ? red : "#f0e0e0", color: selectedIndustries.includes(ind) ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>{ind}</span>
          ))}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "6px 0" }} />

      <div style={{ padding: "4px 12px 10px" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, marginBottom: "6px" }}>Location (City):</p>
        <input
          type="text"
          value={citySearch}
          onChange={e => setCitySearch(e.target.value)}
          placeholder="e.g. Angeles, Tarlac..."
          style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: `1px solid ${red}`, fontSize: "0.76rem", fontFamily: "'Kufam', sans-serif", outline: "none", boxSizing: "border-box", color: darkRed }}
        />
      </div>
    </div>
  );
};

// ── Company Card ───────────────────────────────────────────────────────────────
const CompanyCard = ({ company, onViewProfile }) => {
  const isActive = company.disabled === false || company.active !== false;
  const displayName = company.companyName || company.name || "Unnamed Company";
  const displayIndustry = company.industry || "—";
  const displayLocation = typeof company.location === "object"
    ? [company.location.city, company.location.province].filter(Boolean).join(", ")
    : (company.location || "—");
  const _sB = company?.slots || "0/0";
  const totalSlots = company?.slot ?? (typeof _sB === "string" ? parseInt(_sB.split("/")[1]) : 0) ?? 0;
  const usedSlots  = typeof _sB === "string" ? parseInt(_sB.split("/")[0]) : 0;
  const isFull = usedSlots >= totalSlots && totalSlots > 0;
  const postedDate = company.createdAt?.seconds
    ? new Date(company.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : (company.posted || "");

  return (
    <div
      onClick={() => isActive && onViewProfile(company)}
      style={{
        background: isActive ? "white" : "#f0f0f0",
        borderRadius: "14px",
        border: `1.5px solid ${isActive ? "#ddd" : "#ccc"}`,
        padding: "18px 20px",
        display: "flex", flexDirection: "column", gap: "6px",
        boxShadow: isActive ? "0 2px 10px rgba(0,0,0,0.08)" : "none",
        opacity: isActive ? 1 : 0.7,
        transition: "box-shadow 0.2s, transform 0.2s",
        cursor: isActive ? "pointer" : "default",
        position: "relative",
        minWidth: 0, overflow: "hidden",
      }}
      onMouseEnter={e => { if (isActive) { e.currentTarget.style.boxShadow = "0 6px 20px rgba(139,0,0,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = isActive ? "0 2px 10px rgba(0,0,0,0.08)" : "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ position: "absolute", top: "14px", right: "14px", background: isFull ? "#e0e0e0" : "#fff0f0", border: `1px solid ${isFull ? "#bbb" : red}`, borderRadius: "20px", padding: "2px 8px", fontSize: "0.68rem", color: isFull ? "#888" : red, fontFamily: "'Kufam', sans-serif", fontWeight: "bold" }}>
        {isFull ? "Full" : `${totalSlots} slot${totalSlots !== 1 ? "s" : ""}`}
      </div>
      <h3 style={{ fontFamily: "'Jua', sans-serif", fontSize: isActive ? "1.05rem" : "0.95rem", color: isActive ? "#1a1a1a" : "#555", paddingRight: "60px", lineHeight: 1.3 }}>{displayName}</h3>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555" }}>Industry: {displayIndustry}</p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Location: {displayLocation}, Philippines</p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555" }}>Slots Available: {totalSlots}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
        <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "#999", fontStyle: "italic" }}>{postedDate ? `Posted ${postedDate}` : ""}</span>
        <span
          onClick={() => isActive && onViewProfile(company)}
          style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: isActive ? red : "#aaa", fontWeight: "bold", cursor: isActive ? "pointer" : "default", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}
        >
          View Profile
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </div>
    </div>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
const CoordinatorViewCompanyScreen = ({ onReportSubmit, onNavigateToReports, onMessageNow, initialCompanyId, onClearInitialCompany, onVisitCompany, coordinator }) => {
  const { isMobile } = useBreakpoint();
  const { posts: companies, loading } = useOjtPosts();

  const [view, setView]                       = useState("list");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
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
      const company = companies.find(c => c.id === initialCompanyId);
      if (company) { setSelectedCompany(company); setView("profile"); onVisitCompany?.({ id: company.id, name: company.companyName || company.name }); }
      if (onClearInitialCompany) onClearInitialCompany();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyId, companies]);

  const hasFilter = selectedIndustries.length > 0 || citySearch.trim();

  const filtered = companies.filter(c => {
    const name = (c.company || c.name || "").toLowerCase();
    const industry = (c.industry || "").toLowerCase();
    const loc = (c.location?.city || c.location || "").toLowerCase();
    const matchSearch   = name.includes(search.toLowerCase()) || industry.includes(search.toLowerCase()) || loc.includes(search.toLowerCase());
    const matchIndustry = selectedIndustries.length === 0 || selectedIndustries.includes(c.industry);
    const matchCity     = !citySearch.trim() || (c.location?.city || c.location?.fullAddress || c.location || "").toLowerCase().includes(citySearch.trim().toLowerCase());
    return matchSearch && matchIndustry && matchCity;
  });

  const activeBadgeLabel = () => citySearch.trim() ? `City: ${citySearch.trim()}` : null;

  const clearAllFilters = () => { setSelectedIndustries([]); setCitySearch(""); };

  const handleReportSubmit = (report) => {
    if (onReportSubmit) onReportSubmit(report);
    setShowReportModal(false);
    setView("list");
    if (onNavigateToReports) onNavigateToReports();
  };

  if (view === "profile" && selectedCompany) {
    return (
      <>
        <ResponsiveStyles />
        <CompanyProfile
          company={selectedCompany}
          onBack={() => setView("list")}
          onReport={() => setShowReportModal(true)}
          onMessageNow={() => onMessageNow && onMessageNow(selectedCompany)}
        />
        {showReportModal && (
          <ReportModal company={selectedCompany} onClose={() => setShowReportModal(false)} onSubmit={handleReportSubmit} reporter={coordinator} />
        )}
      </>
    );
  }

  return (
    <>
      <ResponsiveStyles />
      {/* Outer: vertical scroll only, no horizontal overflow */}
      <div className="coord-list-wrapper" style={{ padding: "clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px)", overflowY: "auto", flex: 1, background: "#f5f5f5" }}>

        {/* Search + Filter bar */}
        <div className="coord-search-bar" style={{ background: darkRed, borderRadius: "14px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", borderRadius: "24px", padding: "7px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <div style={{ width: "2px", height: "16px", background: "rgba(0,0,0,0.3)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Companies"
                className="coord-search-input"
                style={{ border: "none", background: "transparent", outline: "none", color: "black", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.1rem" }}
              />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1rem", padding: "0", lineHeight: 1 }}>✕</button>}
            </div>
            <div ref={filterRef} style={{ position: "relative", marginLeft: "10px" }}>
              <div onClick={() => setShowFilter(v => !v)} style={{ width: "38px", height: "38px", background: "white", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `2px solid ${red}` : "none", position: "relative" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? red : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                {hasFilter && <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "10px", height: "10px", borderRadius: "50%", background: red }} />}
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

        {/* Active filter badges */}
        {hasFilter && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#888" }}>Filters:</span>
            {selectedIndustries.map(ind => (
              <span key={ind} style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                {ind}<span onClick={() => setSelectedIndustries(p => p.filter(i => i !== ind))} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
              </span>
            ))}
            {activeBadgeLabel() && (
              <span style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                {activeBadgeLabel()}
                <span onClick={() => setCitySearch("")} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
              </span>
            )}
            <span onClick={clearAllFilters} style={{ fontSize: "0.74rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", textDecoration: "underline" }}>Clear all</span>
          </div>
        )}

        {!loading && <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#888", marginBottom: "14px" }}>
          Showing {filtered.length} compan{filtered.length !== 1 ? "ies" : "y"}
        </p>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px" }}>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#aaa" }}>Loading companies…</p>
          </div>
        ) : filtered.length > 0 ? (
          /* CSS grid: 2-col on ≥768px, 1-col below — controlled entirely by .coord-company-grid */
          <div className="coord-company-grid">
            {filtered.map(c => (
              <CompanyCard
                key={c.id}
                company={c}
                onViewProfile={(company) => { setSelectedCompany(company); setView("profile"); onVisitCompany?.({ id: company.id, name: company.companyName || company.name }); }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p style={{ fontFamily: "'Jua', sans-serif", fontSize: "1.2rem", color: "#bbb" }}>No companies found</p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#ccc" }}>No company data available yet</p>
          </div>
        )}
      </div>
    </>
  );
};

export default CoordinatorViewCompanyScreen;