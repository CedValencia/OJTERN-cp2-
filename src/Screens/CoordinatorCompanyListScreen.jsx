import React, { useState, useRef, useEffect } from "react";

import downloadIcon from "../icons/download.png";
import pdfIcon      from "../icons/pdf.png";

import { db }                                            from "./firebase";
import { approveCompany, rejectCompany, getUserProfile } from "./AuthService";
import { collection, query, where, onSnapshot }          from "firebase/firestore";

const red     = "#8B0000";
const darkRed = "#590101";

// ── Responsive styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    /* Company grid: 2-col >=768px, 1-col below */
    .clist-company-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (max-width: 767px) {
      .clist-company-grid { grid-template-columns: 1fr; }
    }

    /* Search input shrinks on mobile */
    .clist-search-input { width: 180px; }
    @media (max-width: 480px) {
      .clist-search-input { width: 110px; }
    }

    /* Top search bar */
    .clist-search-bar {
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
    @media (max-width: 480px) {
      .clist-search-bar { padding: 10px 12px; }
    }

    /* Main content padding */
    .clist-content { padding: 20px 32px; }
    @media (max-width: 640px) {
      .clist-content { padding: 14px 14px; }
    }

    /* Profile scrollable area */
    .clist-profile-content { padding: 28px 32px; }
    @media (max-width: 640px) {
      .clist-profile-content { padding: 16px 14px; }
    }

    /* Profile top row: side-by-side on desktop, stacked on mobile */
    .clist-profile-top {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
    }
    @media (max-width: 640px) {
      .clist-profile-top { flex-direction: column; }
    }

    /* Map box: fixed width on desktop, full on mobile */
    .clist-map-box {
      width: 200px;
      flex-shrink: 0;
      border-radius: 14px;
      overflow: hidden;
      background: #d0d8e0;
      min-height: 130px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 6px;
    }
    @media (max-width: 640px) {
      .clist-map-box { width: 100%; min-height: 100px; }
    }

    /* Section title scales */
    .clist-section-title {
      font-family: 'Jersey 25', sans-serif;
      font-size: 2.4rem;
      color: #111;
      line-height: 1.1;
    }
    @media (max-width: 640px) {
      .clist-section-title { font-size: 1.6rem; }
    }

    /* Section header row */
    .clist-section-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 10px;
    }

    /* Accept/Decline button row */
    .clist-action-row {
      display: flex;
      justify-content: flex-end;
      gap: 14px;
      margin-top: 20px;
    }
    @media (max-width: 480px) {
      .clist-action-row { flex-direction: column; gap: 10px; }
      .clist-action-row button { width: 100%; }
    }

    /* Filter badges */
    .clist-filter-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      flex-wrap: wrap;
    }
    @media (max-width: 480px) {
      .clist-filter-badges { padding: 8px 12px; }
    }

    /* No horizontal overflow */
    .clist-list-wrapper {
      overflow-x: hidden;
      width: 100%;
    }

    /* Profile header back+title */
    .clist-profile-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
  `}</style>
);

// ── 4-Level Location Hierarchy ────────────────────────────────────────────────
// TODO: Populate from backend
const REGIONS = [];

const UNIQUE_REGIONS = REGIONS.reduce((acc, r) => {
  const existing = acc.find(x => x.name === r.name);
  if (existing) { existing.provinces = [...existing.provinces, ...r.provinces]; }
  else { acc.push({ ...r }); }
  return acc;
}, []);

// TODO: Populate from backend or config
const INDUSTRIES = [];

// TODO: Replace with real company data from backend
const REGISTERED_COMPANIES = [];

// TODO: Replace with real review data from backend
const REVIEW_COMPANIES = [];

// ── Doc Thumbnail — supports Cloudinary URL strings ──────────────────────────
// `url` is a Cloudinary secure_url string (PDF or image)
const DocThumbnail = ({ url, index }) => {
  const isPdf = url.toLowerCase().includes(".pdf") || url.toLowerCase().includes("/raw/");
  const fileName = url.split("/").pop().split("?")[0] || `Document ${index + 1}`;
  const icon = isPdf ? pdfIcon : null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${fileName}`}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "4px", textDecoration: "none" }}
    >
      <div style={{ position: "relative", width: "72px", height: "82px", borderRadius: "8px", overflow: "hidden", border: "1px solid #ddd", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isPdf ? (
          <>
            <img src={pdfIcon} alt="PDF" style={{ width: "56px", height: "66px", objectFit: "contain" }} />
            <img src={downloadIcon} alt="Open" style={{ position: "absolute", top: "-4px", right: "-4px", width: "22px", height: "22px", objectFit: "contain" }} />
          </>
        ) : (
          <>
            <img src={url} alt={fileName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <img src={downloadIcon} alt="Open" style={{ position: "absolute", top: "-4px", right: "-4px", width: "22px", height: "22px", objectFit: "contain" }} />
          </>
        )}
      </div>
      <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.58rem", color: "#555", textAlign: "center", wordBreak: "break-all", maxWidth: "80px", lineHeight: 1.3, marginTop: "4px" }}>
        {fileName}
      </span>
    </a>
  );
};

// ── Breadcrumb Back Button ────────────────────────────────────────────────────
const BackLink = ({ label, onClick }) => (
  <div
    onClick={onClick}
    style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "6px", color: red, fontSize: "0.72rem", fontFamily: "'Kufam', sans-serif" }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
    {label}
  </div>
);

// ── Filter Panel ──────────────────────────────────────────────────────────────
const FilterPanel = ({
  industries,
  selectedIndustries, setSelectedIndustries,
  selectedRegion, setSelectedRegion,
  selectedProvince, setSelectedProvince,
  selectedCity, setSelectedCity,
  selectedBarangay, setSelectedBarangay,
}) => {
  const regionData   = UNIQUE_REGIONS.find(r => r.name === selectedRegion);
  const provinceData = regionData?.provinces.find(p => p.name === selectedProvince);
  const cityData     = provinceData?.cities.find(c => c.name === selectedCity);

  // `industries` prop is passed from the main screen (coordinator's assigned industries)
  const toggleIndustry = (ind) =>
    setSelectedIndustries(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    );

  const clearAll = () => {
    setSelectedIndustries([]);
    setSelectedRegion(""); setSelectedProvince("");
    setSelectedCity(""); setSelectedBarangay("");
  };

  const locationLevel = !selectedRegion ? "region"
    : !selectedProvince ? "province"
    : !selectedCity ? "city"
    : "barangay";

  return (
    <div style={{
      position: "absolute", top: "48px", right: 0, width: "240px",
      background: "white", border: `1.5px solid ${red}`, borderRadius: "10px",
      boxShadow: "0 6px 24px rgba(0,0,0,0.18)", zIndex: 100,
      overflow: "hidden", fontFamily: "'Kufam', sans-serif"
    }}>

      {/* ── Industry + Clear All ── */}
      <div style={{ padding: "10px 12px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, margin: 0 }}>Industry:</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontSize: "0.7rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        <div style={{ maxHeight: "110px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {industries && industries.length > 0 ? (
            industries.map(ind => (
              <span key={ind} onClick={() => toggleIndustry(ind)} style={{
                padding: "3px 9px", borderRadius: "20px", fontSize: "0.72rem",
                cursor: "pointer", userSelect: "none",
                background: selectedIndustries.includes(ind) ? red : "#f0e0e0",
                color: selectedIndustries.includes(ind) ? "white" : darkRed,
                border: `1px solid ${red}`, transition: "all 0.15s"
              }}>{ind}</span>
            ))
          ) : (
            <span style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No industries available</span>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "6px 0" }} />

      {/* ── Location ── */}
      <div style={{ padding: "4px 12px 10px" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, marginBottom: "6px" }}>
          Location:
          {locationLevel !== "region" && (
            <span style={{ fontWeight: "normal", color: "#888", marginLeft: "6px", fontSize: "0.68rem" }}>
              {[selectedRegion, selectedProvince, selectedCity].filter(Boolean).join(" › ")}
            </span>
          )}
        </p>

        {locationLevel === "region" && (
          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
            {UNIQUE_REGIONS.length > 0 ? (
              UNIQUE_REGIONS.map(r => (
                <div key={r.name}
                  onClick={() => { setSelectedRegion(r.name); setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); }}
                  style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", cursor: "pointer", background: "#f7f0f0", color: darkRed, border: "1px solid #e0c0c0" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0d0d0"}
                  onMouseLeave={e => e.currentTarget.style.background = "#f7f0f0"}
                >{r.name}</div>
              ))
            ) : (
              <span style={{ fontSize: "0.72rem", color: "#bbb", fontStyle: "italic" }}>No regions available</span>
            )}
          </div>
        )}

        {locationLevel === "province" && (
          <div>
            <div onClick={() => { setSelectedRegion(""); setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); }}
              style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "6px", color: red, fontSize: "0.72rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {selectedRegion}
            </div>
            <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
              {regionData?.provinces.map(p => (
                <div key={p.name}
                  onClick={() => { setSelectedProvince(p.name); setSelectedCity(""); setSelectedBarangay(""); }}
                  style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", cursor: "pointer", background: "#f7f0f0", color: darkRed, border: "1px solid #e0c0c0" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0d0d0"}
                  onMouseLeave={e => e.currentTarget.style.background = "#f7f0f0"}
                >{p.name}</div>
              ))}
            </div>
          </div>
        )}

        {locationLevel === "city" && (
          <div>
            <div onClick={() => { setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); }}
              style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "6px", color: red, fontSize: "0.72rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {selectedProvince}
            </div>
            <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {provinceData?.cities.map(c => (
                <span key={c.name}
                  onClick={() => { setSelectedCity(c.name); setSelectedBarangay(""); }}
                  style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}
                >{c.name}</span>
              ))}
            </div>
          </div>
        )}

        {locationLevel === "barangay" && (
          <div>
            <div onClick={() => { setSelectedCity(""); setSelectedBarangay(""); }}
              style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginBottom: "6px", color: red, fontSize: "0.72rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {selectedCity}
            </div>
            <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {cityData?.barangays.map(b => (
                <span key={b}
                  onClick={() => setSelectedBarangay(prev => prev === b ? "" : b)}
                  style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.71rem", cursor: "pointer", userSelect: "none", background: selectedBarangay === b ? red : "#f0e0e0", color: selectedBarangay === b ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}
                >{b}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Mapbox Interactive Map Modal ─────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoibWFraWlpaS0iLCJhIjoiY21wbTgybHVmMmc1ZzJycTFuZXRlb3NoNCJ9.FIpjF2lKTHkbU1e6qrL_Pw";

const MapModal = ({ lat, lng, onClose }) => {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);

  useEffect(() => {
    const loadMap = () => {
      if (!mapContainerRef.current || mapRef.current) return;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      mapRef.current = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style:     "mapbox://styles/mapbox/streets-v12",
        center:    [lng, lat],
        zoom:      15,
      });
      mapRef.current.addControl(new window.mapboxgl.NavigationControl(), "top-right");
      new window.mapboxgl.Marker({ color: "#8B0000" })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    };

    if (window.mapboxgl) {
      loadMap();
    } else {
      const script = document.createElement("script");
      script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
      script.onload = loadMap;
      document.head.appendChild(script);
      const link = document.createElement("link");
      link.rel  = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
      document.head.appendChild(link);
    }

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [lat, lng]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(90vw, 700px)", height: "min(80vh, 500px)",
          borderRadius: "16px", overflow: "hidden", position: "relative",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "12px", left: "12px", zIndex: 10,
            background: "#8B0000", color: "white", border: "none",
            borderRadius: "20px", padding: "6px 16px",
            fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem",
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          ✕ Close
        </button>
      </div>
    </div>
  );
};

const MapThumbnail = ({ lat, lng }) => {
  const [showModal, setShowModal] = useState(false);
  if (!lat || !lng) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "130px", color: "#aaa", fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem" }}>
      No location data
    </div>
  );
  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        style={{ position: "relative", cursor: "zoom-in" }}
        title="Click to view interactive map"
      >
        <img
          alt="Company location map"
          style={{ width: "100%", minHeight: "130px", objectFit: "cover", display: "block", borderRadius: "8px" }}
          src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+8B0000(${lng},${lat})/${lng},${lat},14,0/400x200?access_token=${MAPBOX_TOKEN}`}
        />
        <div style={{
          position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.55)", color: "white", borderRadius: "12px",
          padding: "3px 10px", fontSize: "0.7rem", fontFamily: "'Kufam', sans-serif",
          whiteSpace: "nowrap", pointerEvents: "none",
        }}>
          🔍 Click to zoom
        </div>
      </div>
      {showModal && <MapModal lat={lat} lng={lng} onClose={() => setShowModal(false)} />}
    </>
  );
};

// ── Company Profile View ──────────────────────────────────────────────────────
const CompanyProfileView = ({ company, onBack, onAccept, onDeny }) => {
  const locationLines = [
    company.region   ? { label: "Region",           value: company.region }   : null,
    company.province ? { label: "Province",          value: company.province } : null,
    company.city     ? { label: "City/Municipality", value: company.city }     : null,
    company.barangay ? { label: "Barangay",          value: company.barangay } : null,
    company.street   ? { label: "Street/Building",   value: company.street }   : null,
  ].filter(Boolean);

  const fullAddress = [company.street, company.barangay, company.city, company.province, company.region]
    .filter(Boolean).join(", ");

  return (
    <div className="clist-list-wrapper" style={{ flex: 1, overflowY: "auto", background: "white" }}>
      <div className="clist-profile-content">

        {/* Top: info + map */}
        <div className="clist-profile-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="clist-profile-header">
              <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Monomaniac One', sans-serif", fontSize: "3rem", color: "#1a1a1a", lineHeight: 1, padding: 0, flexShrink: 0 }}>←</button>
              <h1 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#111" }}>{company.name}</h1>
            </div>
          </div>
          <div className="clist-map-box" style={{ padding: 0, overflow: "hidden" }}>
            {company.lat && company.lng ? (
              <MapThumbnail lat={company.lat} lng={company.lng} />
            ) : (
              <>
                <svg width="30" height="36" viewBox="0 0 24 30" fill={red}>
                  <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                </svg>
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#555", textAlign: "center", padding: "0 8px" }}>{fullAddress || company.location}</span>
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.65rem", color: "#888" }}>No coordinates available</span>
              </>
            )}
          </div>
        </div>

        <hr style={{ borderColor: "#eee", marginBottom: "20px" }} />

        {/* Info fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.82rem, 2vw, 0.95rem)", color: "#222" }}>
            <span style={{ fontWeight: 700 }}>Company Name: </span>{company.name}
          </p>
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.82rem, 2vw, 0.95rem)", color: "#222" }}>
            <span style={{ fontWeight: 700 }}>Industry: </span>{company.industry}
          </p>
          <div>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.82rem, 2vw, 0.95rem)", color: "#222", fontWeight: 700, marginBottom: "8px" }}>OJT College / Program:</p>
            {company.collegePrograms && company.collegePrograms.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {company.collegePrograms.map((cp, i) => {
                  const label = [cp.program, cp.major].filter(Boolean).join(" – ");
                  return (
                    <span key={i} style={{ padding: "4px 14px", borderRadius: "20px", background: "#e0f0e0", color: "#2a7a2a", fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", fontWeight: 600 }}>
                      {label}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#aaa" }}>Not specified</span>
            )}
          </div>
          <div>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.82rem, 2vw, 0.95rem)", color: "#222", fontWeight: 700, marginBottom: "6px" }}>Location:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {locationLines.map(({ label, value }, i) => (
                <p key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.88rem)", color: "#444", margin: 0 }}>
                  <span style={{ fontWeight: 600 }}>{label}: </span>{value}
                </p>
              ))}
            </div>
          </div>
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.82rem, 2vw, 0.95rem)", color: "#222" }}>
            <span style={{ fontWeight: 700 }}>Email: </span>{company.email}
          </p>
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.82rem, 2vw, 0.95rem)", color: "#222" }}>
            <span style={{ fontWeight: 700 }}>Date: </span>{company.date}
          </p>
        </div>

        <hr style={{ borderColor: "#eee", marginBottom: "24px" }} />

        {/* Attached Verification Documents — Cloudinary URLs */}
        <div style={{ marginBottom: "40px" }}>
          <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "clamp(0.95rem, 2.5vw, 1.1rem)", color: "#111", marginBottom: "14px" }}>Verification Documents:</p>
          {company.verificationDocs && company.verificationDocs.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              {company.verificationDocs.map((url, i) => (
                <DocThumbnail key={i} url={url} index={i} />
              ))}
            </div>
          ) : (
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#aaa" }}>No documents attached.</p>
          )}
        </div>

        {/* Accept / Decline buttons (review only) */}
        {company.status === "pending" && (
          <div className="clist-action-row">
            <button onClick={() => onDeny(company.id)} style={{ padding: "12px 32px", borderRadius: "24px", background: darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1rem, 3vw, 1.2rem)", cursor: "pointer", letterSpacing: "0.04em" }}>
              Decline
            </button>
            <button onClick={() => onAccept(company.id)} style={{ padding: "12px 32px", borderRadius: "24px", background: darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1rem, 3vw, 1.2rem)", cursor: "pointer", letterSpacing: "0.04em" }}>
              Accept
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Company Card ──────────────────────────────────────────────────────────────
const CompanyCard = ({ company, onViewProfile, isReview }) => (
  <div
    onClick={() => onViewProfile(company)}
    style={{ background: "white", borderRadius: "14px", border: "1.5px solid #ddd", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "6px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", transition: "box-shadow 0.2s, transform 0.2s", cursor: "pointer", minWidth: 0, overflow: "hidden" }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(139,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
  >
    <h3 style={{ fontFamily: "'Jua', sans-serif", fontSize: "1rem", color: "#1a1a1a", lineHeight: 1.3 }}>{company.name}</h3>
    <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555" }}>Industry: {company.industry}</p>
    <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Location: {company.location}</p>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
      <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "#999", fontStyle: "italic" }}>Date: {company.date}</span>
      <span onClick={(e) => { e.stopPropagation(); onViewProfile(company); }}
        style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: red, fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}
      >
        {isReview ? "Verify" : "View Profile"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </span>
    </div>
  </div>
);

// ── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({ title, count }) => (
  <div className="clist-section-header">
    <h2 className="clist-section-title">
      {title.split(" ").map((word, i) => <span key={i}>{word}<br /></span>)}
    </h2>
    <div style={{ background: "#c8c8a0", borderRadius: "24px", padding: "10px 22px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1rem, 2.5vw, 1.4rem)", color: "#333" }}>{count} Companies</span>
    </div>
  </div>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
// Maps a Firestore company doc to the shape the UI expects
const mapDoc = (docSnap) => {
  const d = docSnap.data();
  const loc = d.location || {};
  const location = [loc.street, loc.barangay, loc.city, loc.province, loc.region]
    .filter(Boolean).join(", ");
  return {
    id:               docSnap.id,
    name:             d.companyName  || "",
    industry:         d.industry     || "",
    email:            d.email        || "",
    region:           loc.region     || "",
    province:         loc.province   || loc.region || "",
    city:             loc.city       || "",
    barangay:         loc.barangay   || "",
    street:           loc.street     || "",
    lat:              loc.lat        || null,
    lng:              loc.lng        || null,
    location,
    collegePrograms:  (d.courseSelections || []).map(s => ({
      college: s.college,
      program: s.program,
      major:   s.specialization || "",
    })),
    verificationDocs: d.verificationDocs || [],
    status:           d.status       || "pending",
    date:             d.createdAt?.toDate
                        ? d.createdAt.toDate().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
                        : "—",
  };
};

// ── Main Screen ───────────────────────────────────────────────────────────────
// Props:
//   coordinatorUid  — the logged-in coordinator's Firebase UID
const CoordinatorCompanyListScreen = ({ coordinatorUid }) => {
  const [view, setView]                             = useState("list");
  const [selectedCompany, setSelectedCompany]       = useState(null);
  const [registeredList, setRegisteredList]         = useState([]);
  const [reviewList, setReviewList]                 = useState([]);
  const [assignedIndustries, setAssignedIndustries] = useState([]);
  const [loadingIndustries, setLoadingIndustries]   = useState(true);
  const [toast, setToast]                           = useState(null);
  const [search, setSearch]                         = useState("");
  const [showFilter, setShowFilter]                 = useState(false);
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [selectedRegion,   setSelectedRegion]       = useState("");
  const [selectedProvince, setSelectedProvince]     = useState("");
  const [selectedCity,     setSelectedCity]         = useState("");
  const [selectedBarangay, setSelectedBarangay]     = useState("");
  const filterRef = useRef(null);

  // ── Step 1: load coordinator's assigned industries ────────────────────────
  useEffect(() => {
    if (!coordinatorUid) return;
    getUserProfile("coordinators", coordinatorUid).then(data => {
      if (data) setAssignedIndustries(data.assignedIndustries || []);
      setLoadingIndustries(false);
    });
  }, [coordinatorUid]);

  // ── Step 2: real-time listeners scoped to coordinator's industries ─────────
  useEffect(() => {
    if (loadingIndustries || assignedIndustries.length === 0) return;

    // Firestore "in" query supports up to 30 values; chunk if needed
    const chunk = assignedIndustries.slice(0, 30);

    const pendingQ = query(
      collection(db, "companies"),
      where("industry",  "in", chunk),
      where("status",    "==", "pending")
    );
    const approvedQ = query(
      collection(db, "companies"),
      where("industry",  "in", chunk),
      where("status",    "==", "approved")
    );

    const unsubPending  = onSnapshot(pendingQ,  snap => setReviewList(snap.docs.map(mapDoc)));
    const unsubApproved = onSnapshot(approvedQ, snap => setRegisteredList(snap.docs.map(mapDoc)));

    return () => { unsubPending(); unsubApproved(); };
  }, [loadingIndustries, assignedIndustries]);

  // Close filter panel on outside click
  useEffect(() => {
    const handler = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasFilter = selectedIndustries.length > 0 || selectedRegion || selectedProvince || selectedCity || selectedBarangay;

  const applyFilter = (list) => list.filter(c => {
    const matchSearch   = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.industry.toLowerCase().includes(search.toLowerCase()) || c.location.toLowerCase().includes(search.toLowerCase());
    const matchIndustry = selectedIndustries.length === 0 || selectedIndustries.includes(c.industry);
    const matchRegion   = !selectedRegion   || c.region   === selectedRegion;
    const matchProvince = !selectedProvince || c.province === selectedProvince;
    const matchCity     = !selectedCity     || c.city     === selectedCity || c.location.toLowerCase().includes(selectedCity.toLowerCase());
    return matchSearch && matchIndustry && matchRegion && matchProvince && matchCity;
  });

  const filteredRegistered = applyFilter(registeredList);
  const filteredReview     = applyFilter(reviewList);

  const showToast = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 2500); };

  // ── Accept: set status → "approved" in Firestore ─────────────────────────
  const handleAccept = async (id) => {
    const company = reviewList.find(c => c.id === id);
    if (!company) return;
    try {
      await approveCompany(id, coordinatorUid);
      showToast(`${company.name} has been accepted.`, "#2a7a2a");
      setView("list");
    } catch (err) {
      showToast(`Failed to accept: ${err.message}`, darkRed);
    }
  };

  // ── Decline: set status → "rejected" in Firestore ────────────────────────
  const handleDeny = async (id) => {
    const company = reviewList.find(c => c.id === id);
    if (!company) return;
    try {
      await rejectCompany(id, coordinatorUid);
      showToast(`${company.name} has been declined.`, darkRed);
      setView("list");
    } catch (err) {
      showToast(`Failed to decline: ${err.message}`, darkRed);
    }
  };

  const clearAll = () => { setSelectedIndustries([]); setSelectedRegion(""); setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); };

  const activeBadgeLabel = () => {
    const parts = [selectedRegion, selectedProvince, selectedCity, selectedBarangay].filter(Boolean);
    return parts.length ? parts.join(" › ") : null;
  };

  // ── Loading / empty states ───────────────────────────────────────────────
  if (loadingIndustries) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888" }}>Loading coordinator profile…</p>
      </div>
    );
  }

  if (!loadingIndustries && assignedIndustries.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#888", textAlign: "center", padding: "0 24px" }}>
          No industries assigned to your coordinator account yet.<br />Please contact the administrator.
        </p>
      </div>
    );
  }

  if (view === "profile" && selectedCompany) {
    return (
      <>
        <ResponsiveStyles />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "white", position: "relative" }}>
          <CompanyProfileView
            company={selectedCompany}
            onBack={() => setView("list")}
            onAccept={handleAccept}
            onDeny={handleDeny}
          />
          {toast && (
            <div style={{ position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", background: toast.color, color: "white", padding: "12px 28px", borderRadius: "24px", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", fontWeight: 600, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
              {toast.msg}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <ResponsiveStyles />
      <div className="clist-list-wrapper" style={{ flex: 1, overflowY: "auto", background: "#f5f5f5", position: "relative" }}>

        {/* Search bar */}
        <div className="clist-search-bar" style={{ background: darkRed }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", borderRadius: "24px", padding: "7px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <div style={{ width: "2px", height: "16px", background: "rgba(0,0,0,0.3)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Companies"
                className="clist-search-input"
                style={{ border: "none", background: "transparent", outline: "none", color: "black", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.1rem" }}
              />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "1rem", padding: "0", lineHeight: 1 }}>✕</button>}
            </div>
            <div ref={filterRef} style={{ position: "relative", marginLeft: "10px" }}>
              <div onClick={() => setShowFilter(v => !v)} style={{ width: "38px", height: "38px", background: "white", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `2px solid ${red}` : "none", position: "relative" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? red : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {hasFilter && <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "10px", height: "10px", borderRadius: "50%", background: red }} />}
              </div>
              {showFilter && (
                <FilterPanel
                  industries={assignedIndustries}
                  selectedIndustries={selectedIndustries} setSelectedIndustries={setSelectedIndustries}
                  selectedRegion={selectedRegion}     setSelectedRegion={setSelectedRegion}
                  selectedProvince={selectedProvince} setSelectedProvince={setSelectedProvince}
                  selectedCity={selectedCity}         setSelectedCity={setSelectedCity}
                  selectedBarangay={selectedBarangay} setSelectedBarangay={setSelectedBarangay}
                />
              )}
            </div>
          </div>
        </div>

        {/* Active filter badges */}
        {hasFilter && (
          <div className="clist-filter-badges">
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#888" }}>Filters:</span>
            {selectedIndustries.map(ind => (
              <span key={ind} style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                {ind}<span onClick={() => setSelectedIndustries(p => p.filter(i => i !== ind))} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
              </span>
            ))}
            {activeBadgeLabel() && (
              <span style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                {activeBadgeLabel()}
                <span onClick={() => { setSelectedRegion(""); setSelectedProvince(""); setSelectedCity(""); setSelectedBarangay(""); }} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
              </span>
            )}
            <span onClick={clearAll} style={{ fontSize: "0.74rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", textDecoration: "underline" }}>Clear all</span>
          </div>
        )}

        <div className="clist-content">
          {/* Registered Companies */}
          <div style={{ marginBottom: "36px" }}>
            <SectionHeader title="Registered Companies" count={filteredRegistered.length} />
            {filteredRegistered.length > 0 ? (
              <div className="clist-company-grid">
                {filteredRegistered.map(c => (
                  <CompanyCard key={c.id} company={c} isReview={false} onViewProfile={(company) => { setSelectedCompany(company); setView("profile"); }} />
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#aaa", padding: "20px 0" }}>No registered companies match your filters.</p>
            )}
          </div>

          <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "32px" }} />

          {/* Companies in Review */}
          <div>
            <SectionHeader title="Companies in Review" count={filteredReview.length} />
            {filteredReview.length > 0 ? (
              <div className="clist-company-grid">
                {filteredReview.map(c => (
                  <CompanyCard key={c.id} company={c} isReview={true} onViewProfile={(company) => { setSelectedCompany(company); setView("profile"); }} />
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#aaa", padding: "20px 0" }}>No companies in review match your filters.</p>
            )}
          </div>
        </div>

        {toast && (
          <div style={{ position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", background: toast.color, color: "white", padding: "12px 28px", borderRadius: "24px", fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", fontWeight: 600, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
};

export default CoordinatorCompanyListScreen;