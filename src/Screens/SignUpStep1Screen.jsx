import React, { useState, useEffect, useRef, useCallback } from "react";

const darkRed = "#320000";
const red = "#8B0000";

// ── Mapbox token ──────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoibWFraWlpaS0iLCJhIjoiY21wbTgybHVmMmc1ZzJycTFuZXRlb3NoNCJ9.FIpjF2lKTHkbU1e6qrL_Pw";

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&display=swap');
    @import url('https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css');
    * { box-sizing: border-box; }

    /* ── Outer wrapper ── */
    .su1-wrapper {
      width: 100%;
      max-width: 370px;
      margin: 0 auto;
      padding: 0 12px;
    }
    @media (max-width: 400px) {
      .su1-wrapper { padding: 0 6px; }
    }

    /* ── Title ── */
    .su1-title {
      font-family: 'Jersey 25', sans-serif;
      font-size: 2.6rem;
      font-weight: 400;
      color: #1a1a1a;
      text-align: center;
      margin-bottom: 20px;
      line-height: 1.1;
      text-transform: uppercase;
    }
    @media (max-width: 360px) {
      .su1-title { font-size: 2rem; margin-bottom: 14px; }
    }

    /* ── Card border ── */
    .su1-card {
      border: 2px solid #1a1a1a;
      border-radius: 24px;
      overflow: hidden;
    }

    /* ── Card header ── */
    .su1-card-header {
      background: ${red};
      padding: 14px;
      text-align: center;
    }
    @media (max-width: 360px) {
      .su1-card-header { padding: 10px; }
      .su1-card-header span { font-size: 1.1rem !important; }
    }

    /* ── Scrollable form body ── */
    .su1-form-body {
      padding: 16px 24px 24px;
      background: white;
      max-height: 65vh;
      overflow-y: auto;
    }
    @media (max-width: 400px) {
      .su1-form-body { padding: 12px 14px 18px; }
    }

    /* ── Mapbox address search ── */
    .su1-map-container {
      width: 100%;
      height: 160px;
      border-radius: 12px;
      margin-top: 8px;
      margin-bottom: 6px;
      overflow: hidden;
      border: 1.5px solid #ccc;
      position: relative;
    }
    @media (max-width: 360px) {
      .su1-map-container { height: 130px; }
    }

    .su1-suggestions {
      position: absolute;
      top: 100%;
      left: 0; right: 0;
      background: white;
      border: 1px solid #ddd;
      border-top: none;
      border-radius: 0 0 12px 12px;
      z-index: 999;
      max-height: 180px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    .su1-suggestion-item {
      padding: 10px 14px;
      fontFamily: 'Kufam', sans-serif;
      font-size: 0.82rem;
      color: #1a1a1a;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
    }
    .su1-suggestion-item:hover {
      background: #fff0f0;
    }
    .su1-suggestion-item:last-child {
      border-bottom: none;
    }

    /* ── Bottom action row ── */
    .su1-action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 10px;
    }
    @media (max-width: 360px) {
      .su1-action-row { flex-direction: column; gap: 8px; }
      .su1-action-row button { width: 100%; }
    }

    /* ── Action buttons ── */
    .su1-btn {
      background: ${darkRed};
      color: white;
      border: none;
      border-radius: 24px;
      padding: 12px 32px;
      font-family: 'Jua', sans-serif;
      font-size: 1.1rem;
      letter-spacing: 0.08em;
      cursor: pointer;
    }
    @media (max-width: 400px) {
      .su1-btn { padding: 10px 22px; font-size: 0.95rem; }
    }


  `}</style>
);

const inputStyle = {
  width: "100%",
  padding: "10px 16px",
  background: "#590101",
  border: "none",
  borderRadius: "20px",
  color: "white",
  fontSize: "0.88rem",
  fontFamily: "'Kufam', sans-serif",
  marginBottom: "2px",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontFamily: "'Jua', sans-serif",
  fontSize: "1rem",
  fontWeight: "700",
  color: "#000000",
  marginBottom: "4px",
  marginTop: "10px",
};

const dropdownStyle = {
  ...inputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: "36px",
  cursor: "pointer",
};

const DropArrow = () => (
  <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "rgba(255,255,255,0.7)" }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
  </div>
);

const EyeIcon = ({ show, onClick }) => (
  <span onClick={onClick} style={{
    position: "absolute", right: "14px", top: "50%",
    transform: "translateY(-50%)", cursor: "pointer",
    userSelect: "none", display: "flex", alignItems: "center",
  }}>
    {show ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )}
  </span>
);

// ── Region Normalization ─────────────────────────────────────────────────────
// Mapbox returns "Central Luzon" — we normalize to "Region III – Central Luzon"
// so it matches the student filter labels consistently in Firestore.
const REGION_NORMALIZE = {
  "Ilocos Region":                 "Region I – Ilocos",
  "Region I":                      "Region I – Ilocos",
  "Cagayan Valley":                "Region II – Cagayan Valley",
  "Region II":                     "Region II – Cagayan Valley",
  "Central Luzon":                 "Region III – Central Luzon",
  "Region III":                    "Region III – Central Luzon",
  "CALABARZON":                    "Region IV-A – CALABARZON",
  "Region IV-A":                   "Region IV-A – CALABARZON",
  "Calabarzon":                    "Region IV-A – CALABARZON",
  "MIMAROPA":                      "Region IV-B – MIMAROPA",
  "Region IV-B":                   "Region IV-B – MIMAROPA",
  "Bicol Region":                  "Region V – Bicol",
  "Bicol":                         "Region V – Bicol",
  "Region V":                      "Region V – Bicol",
  "Western Visayas":               "Region VI – Western Visayas",
  "Region VI":                     "Region VI – Western Visayas",
  "Central Visayas":               "Region VII – Central Visayas",
  "Region VII":                    "Region VII – Central Visayas",
  "Eastern Visayas":               "Region VIII – Eastern Visayas",
  "Region VIII":                   "Region VIII – Eastern Visayas",
  "Zamboanga Peninsula":           "Region IX – Zamboanga Peninsula",
  "Region IX":                     "Region IX – Zamboanga Peninsula",
  "Northern Mindanao":             "Region X – Northern Mindanao",
  "Region X":                      "Region X – Northern Mindanao",
  "Davao Region":                  "Region XI – Davao",
  "Davao":                         "Region XI – Davao",
  "Region XI":                     "Region XI – Davao",
  "SOCCSKSARGEN":                  "Region XII – SOCCSKSARGEN",
  "Region XII":                    "Region XII – SOCCSKSARGEN",
  "National Capital Region":       "NCR",
  "Metro Manila":                  "NCR",
  "NCR":                           "NCR",
  "Cordillera Administrative Region": "CAR",
  "CAR":                           "CAR",
  "Caraga":                        "Region XIII – Caraga",
  "Region XIII":                   "Region XIII – Caraga",
  "Bangsamoro":                    "BARMM",
  "BARMM":                         "BARMM",
  "Bangsamoro Autonomous Region":  "BARMM",
};


// Fallback: if Mapbox doesn't return a region, derive it from the province name
const PROVINCE_TO_REGION = {
  // Region I
  "Ilocos Norte": "Region I – Ilocos", "Ilocos Sur": "Region I – Ilocos",
  "La Union": "Region I – Ilocos", "Pangasinan": "Region I – Ilocos",
  // Region II
  "Batanes": "Region II – Cagayan Valley", "Cagayan": "Region II – Cagayan Valley",
  "Isabela": "Region II – Cagayan Valley", "Nueva Vizcaya": "Region II – Cagayan Valley",
  "Quirino": "Region II – Cagayan Valley",
  // Region III
  "Aurora": "Region III – Central Luzon", "Bataan": "Region III – Central Luzon",
  "Bulacan": "Region III – Central Luzon", "Nueva Ecija": "Region III – Central Luzon",
  "Pampanga": "Region III – Central Luzon", "Tarlac": "Region III – Central Luzon",
  "Zambales": "Region III – Central Luzon",
  // Region IV-A
  "Batangas": "Region IV-A – CALABARZON", "Cavite": "Region IV-A – CALABARZON",
  "Laguna": "Region IV-A – CALABARZON", "Quezon": "Region IV-A – CALABARZON",
  "Rizal": "Region IV-A – CALABARZON",
  // Region IV-B
  "Marinduque": "Region IV-B – MIMAROPA", "Occidental Mindoro": "Region IV-B – MIMAROPA",
  "Oriental Mindoro": "Region IV-B – MIMAROPA", "Palawan": "Region IV-B – MIMAROPA",
  "Romblon": "Region IV-B – MIMAROPA",
  // Region V
  "Albay": "Region V – Bicol", "Camarines Norte": "Region V – Bicol",
  "Camarines Sur": "Region V – Bicol", "Catanduanes": "Region V – Bicol",
  "Masbate": "Region V – Bicol", "Sorsogon": "Region V – Bicol",
  // Region VI
  "Aklan": "Region VI – Western Visayas", "Antique": "Region VI – Western Visayas",
  "Capiz": "Region VI – Western Visayas", "Guimaras": "Region VI – Western Visayas",
  "Iloilo": "Region VI – Western Visayas", "Negros Occidental": "Region VI – Western Visayas",
  // Region VII
  "Bohol": "Region VII – Central Visayas", "Cebu": "Region VII – Central Visayas",
  "Negros Oriental": "Region VII – Central Visayas", "Siquijor": "Region VII – Central Visayas",
  // Region VIII
  "Biliran": "Region VIII – Eastern Visayas", "Eastern Samar": "Region VIII – Eastern Visayas",
  "Leyte": "Region VIII – Eastern Visayas", "Northern Samar": "Region VIII – Eastern Visayas",
  "Samar": "Region VIII – Eastern Visayas", "Southern Leyte": "Region VIII – Eastern Visayas",
  // Region IX
  "Zamboanga del Norte": "Region IX – Zamboanga Peninsula",
  "Zamboanga del Sur": "Region IX – Zamboanga Peninsula",
  "Zamboanga Sibugay": "Region IX – Zamboanga Peninsula",
  // Region X
  "Bukidnon": "Region X – Northern Mindanao", "Camiguin": "Region X – Northern Mindanao",
  "Lanao del Norte": "Region X – Northern Mindanao", "Misamis Occidental": "Region X – Northern Mindanao",
  "Misamis Oriental": "Region X – Northern Mindanao",
  // Region XI
  "Compostela Valley": "Region XI – Davao", "Davao de Oro": "Region XI – Davao",
  "Davao del Norte": "Region XI – Davao", "Davao del Sur": "Region XI – Davao",
  "Davao Occidental": "Region XI – Davao", "Davao Oriental": "Region XI – Davao",
  // Region XII
  "Cotabato": "Region XII – SOCCSKSARGEN", "Sarangani": "Region XII – SOCCSKSARGEN",
  "South Cotabato": "Region XII – SOCCSKSARGEN", "Sultan Kudarat": "Region XII – SOCCSKSARGEN",
  // Region XIII
  "Agusan del Norte": "Region XIII – Caraga", "Agusan del Sur": "Region XIII – Caraga",
  "Dinagat Islands": "Region XIII – Caraga", "Surigao del Norte": "Region XIII – Caraga",
  "Surigao del Sur": "Region XIII – Caraga",
  // CAR
  "Abra": "CAR", "Apayao": "CAR", "Benguet": "CAR",
  "Ifugao": "CAR", "Kalinga": "CAR", "Mountain Province": "CAR",
  // NCR (Metro Manila cities)
  "Metro Manila": "NCR",
};

const normalizeRegion = (raw) => {
  if (!raw) return "";
  // Try exact match first, then partial match
  if (REGION_NORMALIZE[raw]) return REGION_NORMALIZE[raw];
  const key = Object.keys(REGION_NORMALIZE).find(k =>
    raw.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(raw.toLowerCase())
  );
  return key ? REGION_NORMALIZE[key] : raw;
};

// ── Mapbox Location Picker ───────────────────────────────────────────────────
// Replaces the old 4-level dropdown (Region/Province/City/Barangay).
// User types an address → Mapbox Geocoding API returns suggestions →
// User selects one → map pin drops and coordinates are saved.
const LocationPicker = ({ onChange, addressText, setAddressText }) => {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markerRef       = useRef(null);
  const debounceRef     = useRef(null);

  const [suggestions,  setSuggestions]  = useState([]);
  const [showSuggest,  setShowSuggest]  = useState(false);
  const [searching,    setSearching]    = useState(false);
  const [mapReady,     setMapReady]     = useState(false);
  const [mapError,     setMapError]     = useState(false);
  const wrapperRef = useRef(null);

  // ── Load Mapbox GL JS dynamically ──────────────────────────────────────
  useEffect(() => {
    if (window.mapboxgl) { setMapReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = () => setMapReady(true);
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);
  }, []);

  // ── Initialize map once GL is ready ────────────────────────────────────
  useEffect(() => {
    if (!mapReady || mapRef.current || !mapContainerRef.current) return;
    try {
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      mapRef.current = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style:     "mapbox://styles/mapbox/streets-v12",
        center:    [121.0, 12.0], // Philippines default
        zoom:      5,
      });
      mapRef.current.addControl(new window.mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    } catch (e) {
      setMapError(true);
    }
  }, [mapReady]);

  // ── Close suggestions on outside click ─────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setShowSuggest(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Debounced Mapbox Geocoding search ──────────────────────────────────
  const handleInput = (val) => {
    setAddressText(val);
    setShowSuggest(true);
    clearTimeout(debounceRef.current);
    if (!val.trim() || val.length < 3) { setSuggestions([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json`
          + `?access_token=${MAPBOX_TOKEN}&country=PH&language=en&limit=5&types=address,place,locality,neighborhood,poi`;
        const res  = await fetch(url);
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch { setSuggestions([]); }
      finally  { setSearching(false); }
    }, 350);
  };

  // ── When user picks a suggestion ───────────────────────────────────────
  const handleSelect = (feature) => {
    const [lng, lat] = feature.center;
    const placeName  = feature.place_name;

    setAddressText(placeName);
    setSuggestions([]);
    setShowSuggest(false);

    // Parse Mapbox context array for structured PH address fields
    // Context order (innermost → outermost): neighborhood, locality, place, district, region, country
    const ctx      = feature.context || [];
    const get      = (id) => ctx.find(c => c.id.startsWith(id))?.text || "";

    const rawRegion  = get("region")   || "";
    const district   = get("district") || "";   // maps to Province in PH
    const place      = feature.place_type?.includes("place") ? feature.text : get("place");
    const locality   = get("locality") || "";   // maps to City/Municipality inside a place
    const neighborhood = get("neighborhood") || "";  // maps to Barangay

    // Normalize region to match our consistent label format
   // Province: Mapbox "district" = PH province; if empty, rawRegion might be the province
const province = district || rawRegion || "";
// Region: normalize rawRegion first; if still unrecognized, derive from province map
const normalizedRegion = normalizeRegion(rawRegion);
const region = (normalizedRegion && normalizedRegion !== rawRegion)
  ? normalizedRegion
  : (PROVINCE_TO_REGION[province] || PROVINCE_TO_REGION[rawRegion] || "");
    // City: "locality" is the city/municipality; "place" is sometimes the broader city
    const city     = locality || place || "";
    // Barangay: "neighborhood" is the closest match
    const barangay = neighborhood || "";
    // Street: if result type is "address", the feature text is the street
    const street   = feature.place_type?.includes("address") ? feature.text : "";

    onChange({
      fullAddress: placeName,
      region,
      province,
      city,
      barangay,
      street,
      lat,
      lng,
    });

    // Fly map to selected location
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 });

      // Drop / move pin
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        const el = document.createElement("div");
        el.style.cssText = `
          width:28px; height:34px;
          background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 30'%3E%3Cpath fill='%238B0000' d='M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z'/%3E%3C/svg%3E") no-repeat center/contain;
          cursor:pointer;
        `;
        markerRef.current = new window.mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(mapRef.current);
      }
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative", marginBottom: "4px" }}>
      {/* Address search input */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          placeholder="Type your company address…"
          value={addressText}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
          style={{
            ...inputStyle,
            paddingRight: "40px",
            borderRadius: showSuggest && suggestions.length > 0 ? "20px 20px 0 0" : "20px",
          }}
        />
        {searching ? (
          <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "white", fontSize: "0.8rem" }}>⏳</span>
        ) : addressText ? (
          <span
            onClick={() => { setAddressText(""); setSuggestions([]); onChange({ fullAddress:"", region:"", province:"", city:"", barangay:"", street:"", lat:null, lng:null }); }}
            style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "white", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}
          >×</span>
        ) : (
          <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>🔍</span>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggest && suggestions.length > 0 && (
        <div className="su1-suggestions">
          {suggestions.map((f, i) => (
            <div
              key={i}
              className="su1-suggestion-item"
              onMouseDown={() => handleSelect(f)}
            >
              <span style={{ fontWeight: 600 }}>📍 </span>
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem" }}>{f.place_name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      {mapError ? (
        <div style={{ width:"100%", height:"160px", background:"#f0f0f0", borderRadius:"12px", marginTop:"8px", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <p style={{ fontFamily:"'Kufam', sans-serif", fontSize:"0.75rem", color:"#888", textAlign:"center", padding:"0 12px" }}>Map unavailable. Address will still be saved.</p>
        </div>
      ) : (
        <div ref={mapContainerRef} className="su1-map-container" />
      )}
    </div>
  );
};

// ── Industries ────────────────────────────────────────────────────────────────
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

// ── Main Screen ───────────────────────────────────────────────────────────────
// Props:
//   onContinue(formData)  — called with all Step 1 data when validation passes
//   onGoSignIn            — navigate back to Sign In
//   initialData           — previously entered Step 1 data to restore when coming back from Step 2
const SignUpStep1Screen = ({ onContinue, onGoSignIn, initialData }) => {
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [location, setLocation]       = useState(
    initialData?.location ?? { fullAddress: "", region: "", province: "", city: "", barangay: "", street: "", lat: null, lng: null }
  );
  const [addressText, setAddressText] = useState(initialData?.location?.fullAddress ?? "");
  // ── Controlled field state ────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState(initialData?.companyName ?? "");
  const [industry, setIndustry]       = useState(initialData?.industry ?? "");
  const [email, setEmail]             = useState(initialData?.email ?? "");
  const [password, setPassword]       = useState(initialData?.password ?? "");
  const [confirmPassword, setConfirmPassword] = useState(initialData?.confirmPassword ?? "");
  const [errors, setErrors]           = useState({});

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};

    if (!companyName.trim())
      newErrors.companyName = "Company name is required.";

    if (!industry)
      newErrors.industry = "Please select an industry.";


    if (!location.fullAddress || !location.lat)
      newErrors.location = "Please search and select a valid address from the suggestions.";

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Please enter a valid email address.";

    if (!password || password.length < 8)
      newErrors.password = "Password must be at least 8 characters.";

    if (password !== confirmPassword)
      newErrors.confirmPassword = "Passwords do not match.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    onContinue({
      companyName,
      industry,
      location,
      email,
      password,
      confirmPassword,
    });
  };

  // ── Error helper ──────────────────────────────────────────────────────────
  const ErrMsg = ({ field }) =>
    errors[field] ? (
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "red", margin: "2px 0 6px 4px" }}>
        ⚠️ {errors[field]}
      </p>
    ) : null;

  return (
    <>
      <ResponsiveStyles />
      <div className="su1-wrapper">
        <h1 className="su1-title">
          Hi, Sign Up<br />Now!
        </h1>

        <div className="su1-card">
          {/* Header */}
          <div className="su1-card-header">
            <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "1.4rem", color: "white", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Sign-Up
            </span>
          </div>

          {/* Form body */}
          <div className="su1-form-body">
            <p style={{ fontFamily: "'Jua', sans-serif", textAlign: "center", fontSize: "0.88rem", color: "#555", marginBottom: "2px" }}>Step 1 of 2</p>
            <p style={{ fontFamily: "'Jua', sans-serif", textAlign: "center", fontSize: "1.05rem", fontWeight: "700", color: "#1a1a1a", marginBottom: "10px" }}>Create Your Account</p>
            <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "10px" }} />

            <label style={labelStyle}>Company Name:</label>
            <input
              type="text"
              placeholder="Enter your Company Name:"
              value={companyName}
              onChange={e => { setCompanyName(e.target.value); setErrors(p => ({ ...p, companyName: "" })); }}
              style={{ ...inputStyle, border: errors.companyName ? "1.5px solid red" : "none" }}
            />
            <ErrMsg field="companyName" />

            <label style={labelStyle}>Industry:</label>
            <div style={{ position: "relative", marginBottom: "2px" }}>
              <select
                value={industry}
                onChange={e => { setIndustry(e.target.value); setErrors(p => ({ ...p, industry: "" })); }}
                style={{ ...dropdownStyle, border: errors.industry ? "1.5px solid red" : "none" }}
              >
                <option value="">Choose your type of Industry:</option>
                {INDUSTRIES.map(ind => <option key={ind}>{ind}</option>)}
              </select>
              <DropArrow />
            </div>
            <ErrMsg field="industry" />

            <label style={labelStyle}>Company Address:</label>
            <LocationPicker
              onChange={val => { setLocation(val); setErrors(p => ({ ...p, location: "" })); }}
              addressText={addressText}
              setAddressText={setAddressText}
            />
            <ErrMsg field="location" />

            <label style={{ ...labelStyle, marginTop: "10px" }}>Email:</label>
            <input
              type="email"
              placeholder="Enter your Email:"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }}
              style={{ ...inputStyle, border: errors.email ? "1.5px solid red" : "none" }}
            />
            <ErrMsg field="email" />

            <label style={labelStyle}>Password:</label>
            <div style={{ position: "relative", marginBottom: "2px" }}>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Enter your password:"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: "" })); }}
                style={{ ...inputStyle, paddingRight: "44px", border: errors.password ? "1.5px solid red" : "none" }}
              />
              <EyeIcon show={showPass} onClick={() => setShowPass(!showPass)} />
            </div>
            <ErrMsg field="password" />

            <label style={labelStyle}>Confirm Password:</label>
            <div style={{ position: "relative", marginBottom: "4px" }}>
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm your password:"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: "" })); }}
                style={{ ...inputStyle, paddingRight: "44px", border: errors.confirmPassword ? "1.5px solid red" : "none" }}
              />
              <EyeIcon show={showConfirm} onClick={() => setShowConfirm(!showConfirm)} />
            </div>
            <ErrMsg field="confirmPassword" />

            <div style={{ marginBottom: "12px" }} />

            {/* Action row */}
            <div className="su1-action-row">
              <button onClick={onGoSignIn} className="su1-btn">Back</button>
              <button onClick={handleContinue} className="su1-btn">Continue</button>
            </div>

            <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "17px" }} />

            <p style={{ fontFamily: "'Kufam', sans-serif", textAlign: "center", fontSize: "0.88rem", color: "#555" }}>
              Already have an account?{" "}
              <span onClick={onGoSignIn} style={{ color: red, textDecoration: "underline", cursor: "pointer", fontWeight: "600" }}>Sign-in</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignUpStep1Screen;