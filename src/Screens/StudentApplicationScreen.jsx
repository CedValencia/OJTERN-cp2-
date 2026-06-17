import React, { useState, useRef, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import companyProfileIcon from "../icons/companyprofile.png";

// ─── COLORS ───────────────────────────────────────────────────────────────────
const darkRed = "#590101";
const red = "#8B0000";
const black = "#000000";

// TODO: Replace with real application data from backend
const REGIONS = [];
const COLLEGES = [];
const SUFFIX_OPTIONS = [];
const APPLICATIONS = [];

// ─── RESPONSIVE STYLES ────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Kufam:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #8B0000; border-radius: 4px; }
    ::-webkit-scrollbar-track { background: #f0f0f0; }
    .app-textarea::-webkit-scrollbar { width: 6px; }
    .app-textarea::-webkit-scrollbar-track { background: transparent; border-radius: 10px; }
    .app-textarea::-webkit-scrollbar-thumb { background: ${darkRed}; border-radius: 10px; }
    .sa-app-row:hover { background: #d0d0d0 !important; }

    /* ── Top bar ── */
    .sa-topbar {
      background: ${darkRed};
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      flex-wrap: wrap;
      gap: 10px;
    }
    @media (max-width: 560px) {
      .sa-topbar { padding: 10px 14px; }
    }

    /* Search input */
    .sa-search-input { width: 160px; }
    @media (max-width: 480px) {
      .sa-search-input { width: 110px; }
    }

    /* ── List scroll area ── */
    .sa-list-area {
      flex: 1;
      overflow-y: auto;
      padding: 14px 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    @media (max-width: 560px) {
      .sa-list-area { padding: 10px 12px; }
    }

    /* ── Modal outer ── */
    .sa-modal-inner {
      background: #d8d8d8;
      border-radius: 18px;
      width: 100%;
      max-width: 720px;
      max-height: 92vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }

    /* ── Modal header ── */
    .sa-modal-header {
      padding: 20px 28px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    @media (max-width: 560px) {
      .sa-modal-header { padding: 14px 16px 10px; }
      .sa-modal-title { font-size: 1.4rem !important; }
    }

    /* ── Modal body ── */
    .sa-modal-body {
      overflow-y: auto;
      padding: 0 28px 8px;
      flex: 1;
    }
    @media (max-width: 560px) {
      .sa-modal-body { padding: 0 14px 8px; }
    }

    /* ── Modal footer ── */
    .sa-modal-footer {
      background: #b0b0b0;
      padding: 14px 28px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      border-bottom-left-radius: 18px;
      border-bottom-right-radius: 18px;
      flex-shrink: 0;
    }
    @media (max-width: 480px) {
      .sa-modal-footer { padding: 12px 14px; }
    }

    /* ── Name grid: 4-col → 2-col → 1-col ── */
    .sa-name-grid {
      display: grid;
      grid-template-columns: 1fr 0.45fr 1fr 0.5fr;
      gap: 12px;
      margin-bottom: 4px;
    }
    @media (max-width: 620px) {
      .sa-name-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 380px) {
      .sa-name-grid { grid-template-columns: 1fr; }
    }

    /* ── College / Program / Major: 3-col → 1-col ── */
    .sa-college-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 4px;
    }
    @media (max-width: 620px) {
      .sa-college-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 400px) {
      .sa-college-grid { grid-template-columns: 1fr; }
    }

    /* ── Contact / Email: 2-col → 1-col ── */
    .sa-contact-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 4px;
    }
    @media (max-width: 520px) {
      .sa-contact-grid { grid-template-columns: 1fr; }
    }

    /* ── Sex picker: fixed width on desktop, full on mobile ── */
    .sa-sex-wrap {
      margin-bottom: 4px;
      width: 180px;
    }
    @media (max-width: 480px) {
      .sa-sex-wrap { width: 100%; }
    }

    /* ── Status badge in ViewApplication ── */
    .sa-status-badge {
      background: var(--status-color, #aaa);
      color: white;
      border-radius: 20px;
      padding: 4px 14px;
      font-family: 'Kufam', sans-serif;
      font-weight: 700;
      font-size: 0.76rem;
      white-space: nowrap;
    }

    /* ── Apply modal company subtitle ── */
    .sa-modal-subtitle {
      font-family: 'Kufam', sans-serif;
      font-size: 0.78rem;
      color: #666;
      margin-top: 2px;
    }
    @media (max-width: 480px) {
      .sa-modal-subtitle { font-size: 0.70rem; }
    }
  `}</style>
);

// ─── VALIDATORS ───────────────────────────────────────────────────────────────
const NAME_REGEX = /^[A-Za-zÑñ][A-Za-zÑñ\s\-]*$/;
const MIDDLE_INITIAL_REGEX = /^[A-Z]\.$/;
const SUFFIX_REGEX = /^(Jr\.|Sr\.|II|III|IV|V|VI|VII|VIII|IX|X)$/;
const GMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@gmail\.com$/;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["application/pdf", "image/png"];

const appValidators = {
  firstName: (v) => {
    if (!v || !v.trim()) return "Required";
    if (!NAME_REGEX.test(v.trim())) return "Letters, Ñ/ñ and hyphens only";
    return "";
  },
  middleInitial: (v) => {
    if (!v || !v.trim()) return "";
    if (!/^[A-Z]$/.test(v.trim()) && !MIDDLE_INITIAL_REGEX.test(v.trim())) return "Format: e.g. (A.)";
    return "";
  },
  lastName: (v) => {
    if (!v || !v.trim()) return "Required";
    if (!NAME_REGEX.test(v.trim())) return "Letters, Ñ/ñ and hyphens only";
    return "";
  },
  suffix: (v) => {
    if (!v || !v.trim()) return "";
    if (!SUFFIX_REGEX.test(v.trim())) return "e.g. Jr. Sr. II III IV";
    return "";
  },
  sex: (v) => (!v ? "Required" : ""),
  region: (v) => (!v ? "Select a region" : ""),
  college: (v) => (!v ? "Required" : ""),
  program: (v) => (!v ? "Required" : ""),
  contact: (v) => {
    if (!v || v.trim() === "+63" || v.trim() === "+63 ") return "Required";
    const digits = v.replace(/\D/g, "");
    if (digits.length !== 12) return "Must be a valid +63 number";
    return "";
  },
  email: (v) => {
    if (!v || !v.trim()) return "Required";
    if (!GMAIL_REGEX.test(v.trim())) return "Must be @gmail.com";
    return "";
  },
};

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

// ─── useField hook ────────────────────────────────────────────────────────────
const useField = (initial = "", validatorKey) => {
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const error = touched && appValidators[validatorKey] ? appValidators[validatorKey](value) : "";
  const onChange = (val) => { setValue(val); setTouched(true); };
  const touch = () => setTouched(true);
  const reset = (v = "") => { setValue(v); setTouched(false); };
  const forceValue = (v) => setValue(v);
  return { value, onChange, touch, reset, forceValue, error, hasError: !!error };
};

// ─── STYLED SELECT ─────────────────────────────────────────────────────────────
const StyledSelect = ({ value, onChange, options, placeholder, disabled, hasError }) => (
  <div style={{ position: "relative" }}>
    <select
      value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ width: "100%", appearance: "none", WebkitAppearance: "none", background: disabled ? "#e8e8e8" : "white", border: hasError ? "1.5px solid #c00" : "none", borderRadius: "20px", padding: "8px 36px 8px 14px", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: disabled ? "#aaa" : (value ? "#222" : "#999"), cursor: disabled ? "not-allowed" : "pointer", outline: "none", boxShadow: hasError ? "none" : "inset 0 1px 3px rgba(0,0,0,0.08)" }}
    >
      <option value="">{placeholder || "Select..."}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: disabled ? "#bbb" : darkRed }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
    </div>
  </div>
);

// ─── STYLED INPUT ─────────────────────────────────────────────────────────────
const StyledInput = ({ value, onChange, placeholder, type = "text", disabled, hasError }) => (
  <input
    type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    style={{ width: "100%", background: disabled ? "#e8e8e8" : "white", border: hasError ? "1.5px solid #c00" : "none", borderRadius: "20px", padding: "8px 14px", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#222", outline: "none", boxShadow: hasError ? "none" : "inset 0 1px 3px rgba(0,0,0,0.08)", boxSizing: "border-box" }}
  />
);

// ─── FIELD LABEL ──────────────────────────────────────────────────────────────
const FieldLabel = ({ children }) => (
  <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem", color: black, marginBottom: "5px", letterSpacing: "0.03em", marginTop: "10px" }}>
    {children}
  </p>
);

const FieldError = ({ msg }) => msg
  ? <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#c00", marginTop: "3px", paddingLeft: "6px" }}>{msg}</p>
  : null;

// ─── 4-LEVEL LOCATION PICKER ──────────────────────────────────────────────────
const LocationPicker = ({ region, province, city, barangay, street, onChange, disabled, regionError }) => {
  const regionData = REGIONS.find(r => r.name === region);
  const provinceData = regionData?.provinces.find(p => p.name === province);
  const cityData = provinceData?.cities.find(c => c.name === city);

  const handleRegion   = (val) => onChange({ region: val, province: "", city: "", barangay: "", street: "" });
  const handleProvince = (val) => onChange({ region, province: val, city: "", barangay: "", street: "" });
  const handleCity     = (val) => onChange({ region, province, city: val, barangay: "", street: "" });
  const handleBarangay = (val) => onChange({ region, province, city, barangay: val, street });
  const handleStreet   = (val) => onChange({ region, province, city, barangay, street: val });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div>
        <StyledSelect value={region} onChange={handleRegion} options={REGIONS.map(r => r.name)} placeholder="Select Region" disabled={disabled} hasError={!!regionError} />
        <FieldError msg={regionError} />
      </div>
      {region   && <StyledSelect value={province} onChange={handleProvince} options={regionData?.provinces.map(p => p.name) ?? []} placeholder="Select Province" disabled={disabled} />}
      {province && <StyledSelect value={city}     onChange={handleCity}     options={provinceData?.cities.map(c => c.name)    ?? []} placeholder="Select City / Municipality" disabled={disabled} />}
      {city     && <StyledSelect value={barangay} onChange={handleBarangay} options={cityData?.barangays ?? []} placeholder="Select Barangay" disabled={disabled} />}
      {city     && <StyledInput  value={street}   onChange={handleStreet}   placeholder="Street / Building (optional)" disabled={disabled} />}
    </div>
  );
};

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
const MultiFileUpload = ({ attachedFiles, onAdd, onRemove, disabled }) => {
  const fileRef = useRef();

  const handlePick = (e) => {
    const picked = Array.from(e.target.files);
    if (!picked.length) return;
    const invalid = picked.filter(f => !ALLOWED_FILE_TYPES.includes(f.type));
    if (invalid.length) { alert("Only PDF and PNG files are allowed."); e.target.value = ""; return; }
    const currentSize = (attachedFiles || []).reduce((sum, f) => sum + f.size, 0);
    const newSize = picked.reduce((sum, f) => sum + f.size, 0);
    if (currentSize + newSize > MAX_FILE_SIZE) { alert("Total file size must not exceed 10MB."); e.target.value = ""; return; }
    onAdd(picked);
    e.target.value = "";
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".pdf,.png" multiple style={{ display: "none" }} onChange={handlePick} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        {(attachedFiles || []).map((f, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", background: "white", padding: "6px 12px", borderRadius: "20px", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)", maxWidth: "200px" }}>
            {f.type === "image/png"
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            }
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.74rem", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            {!disabled && <button onClick={() => onRemove(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "0.9rem", padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>}
          </div>
        ))}
        {!disabled && (
          <div onClick={() => fileRef.current.click()} style={{ width: "56px", height: "56px", background: "white", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: "3px", border: `1.5px dashed ${darkRed}`, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={darkRed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            <span style={{ fontSize: "0.55rem", color: darkRed, fontFamily: "'Kufam', sans-serif", fontWeight: 700 }}>PDF/PNG</span>
          </div>
        )}
      </div>
      {!disabled && <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#aaa", marginTop: "5px", paddingLeft: "4px" }}>PDF and PNG only · Max 10MB total · Multiple files allowed</p>}
    </div>
  );
};

// ─── SHARED FORM STATE ────────────────────────────────────────────────────────
const useApplicationForm = (initial) => {
  const firstName     = useField(initial.firstName || "", "firstName");
  const middleInitial = useField(initial.middleInitial || "", "middleInitial");
  const lastName      = useField(initial.lastName || "", "lastName");
  const suffix        = useField(initial.suffix || "", "suffix");
  const sex           = useField(initial.sex || "", "sex");
  const contact       = useField(initial.contact || "+63 ", "contact");
  const email         = useField(initial.email || "", "email");

  const [region, setRegion]         = useState(initial.region || "");
  const [province, setProvince]     = useState(initial.province || "");
  const [city, setCity]             = useState(initial.city || "");
  const [barangay, setBarangay]     = useState(initial.barangay || "");
  const [street, setStreet]         = useState(initial.street || "");
  const [regionTouched, setRegionTouched] = useState(false);

  const [college, setCollege]       = useState(initial.college || "");
  const [program, setProgram]       = useState(initial.program || "");
  const [major, setMajor]           = useState(initial.major || "");
  const [collegeTouched, setCollegeTouched] = useState(false);
  const [programTouched, setProgramTouched] = useState(false);

  const [message, setMessage]       = useState(initial.message || "");
  const [attachedFiles, setAttachedFiles] = useState(initial.attachedFiles || []);

  const handleLocationChange = (loc) => {
    setRegion(loc.region); setProvince(loc.province); setCity(loc.city);
    setBarangay(loc.barangay); setStreet(loc.street);
    setRegionTouched(true);
  };
  const handleCollegeChange = (val) => { setCollege(val); setProgram(""); setMajor(""); setCollegeTouched(true); };
  const handleProgramChange = (val) => { setProgram(val); setMajor(""); setProgramTouched(true); };
  const handleContactChange = (val) => contact.onChange(formatPhone(val));

  const collegeData    = COLLEGES.find(c => c.name === college);
  const programOptions = collegeData?.programs.map(p => p.name) ?? [];
  const programData    = collegeData?.programs.find(p => p.name === program);
  const majorOptions   = programData?.majors ?? [];

  const regionError  = regionTouched  && !region  ? "Select a region" : "";
  const collegeError = collegeTouched && !college  ? "Required"        : "";
  const programError = programTouched && !program  ? "Required"        : "";

  const touchAll = () => {
    firstName.touch(); middleInitial.touch(); lastName.touch(); suffix.touch();
    sex.touch(); contact.touch(); email.touch();
    setRegionTouched(true); setCollegeTouched(true); setProgramTouched(true);
  };

  const isValid = () => {
    if (appValidators.firstName(firstName.value))     return false;
    if (appValidators.middleInitial(middleInitial.value)) return false;
    if (appValidators.lastName(lastName.value))       return false;
    if (appValidators.suffix(suffix.value))           return false;
    if (appValidators.sex(sex.value))                 return false;
    if (!region)                                      return false;
    if (!college)                                     return false;
    if (!program)                                     return false;
    if (appValidators.contact(contact.value))         return false;
    if (appValidators.email(email.value))             return false;
    return true;
  };

  const getFormData = () => ({
    firstName: firstName.value, middleInitial: middleInitial.value,
    lastName: lastName.value, suffix: suffix.value, sex: sex.value,
    region, province, city, barangay, street,
    college, program, major,
    contact: contact.value, email: email.value,
    message, attachedFiles,
  });

  return {
    firstName, middleInitial, lastName, suffix, sex, contact, email,
    region, province, city, barangay, street, regionError, regionTouched,
    college, program, major, setMajor, collegeError, programError,
    programOptions, majorOptions,
    message, setMessage, attachedFiles, setAttachedFiles,
    handleLocationChange, handleCollegeChange, handleProgramChange, handleContactChange,
    touchAll, isValid, getFormData,
  };
};

// ─── SHARED FORM FIELDS (used in both Apply + View modals) ───────────────────
const FormFields = ({ f, locked = false }) => (
  <>
    {/* Name */}
    <div className="sa-name-grid">
      <div>
        <FieldLabel>First Name:</FieldLabel>
        <StyledInput value={f.firstName.value} onChange={(v) => f.firstName.onChange(v.replace(/[^A-Za-zÑñ\s\-]/g, ""))} placeholder="First Name" disabled={locked} hasError={!locked && f.firstName.hasError} />
        <FieldError msg={!locked ? f.firstName.error : ""} />
      </div>
      <div>
        <FieldLabel>Middle I.:</FieldLabel>
        <StyledInput value={f.middleInitial.value} onChange={(v) => f.middleInitial.onChange(v.replace(/[^A-Z.]/g, "").slice(0, 2))} placeholder="M." disabled={locked} hasError={!locked && f.middleInitial.hasError} />
        <FieldError msg={!locked ? f.middleInitial.error : ""} />
      </div>
      <div>
        <FieldLabel>Last Name:</FieldLabel>
        <StyledInput value={f.lastName.value} onChange={(v) => f.lastName.onChange(v.replace(/[^A-Za-zÑñ\s\-]/g, ""))} placeholder="Last Name" disabled={locked} hasError={!locked && f.lastName.hasError} />
        <FieldError msg={!locked ? f.lastName.error : ""} />
      </div>
      <div>
        <FieldLabel>Suffix:</FieldLabel>
        <StyledSelect value={f.suffix.value} onChange={(v) => f.suffix.onChange(v)} options={SUFFIX_OPTIONS} placeholder="None" disabled={locked} hasError={!locked && f.suffix.hasError} />
        <FieldError msg={!locked ? f.suffix.error : ""} />
      </div>
    </div>

    {/* Sex */}
    <div className="sa-sex-wrap">
      <FieldLabel>Sex:</FieldLabel>
      <StyledSelect value={f.sex.value} onChange={(v) => f.sex.onChange(v)} options={["Male","Female"]} placeholder="Select Sex" disabled={locked} hasError={!locked && f.sex.hasError} />
      <FieldError msg={!locked ? f.sex.error : ""} />
    </div>

    {/* Location */}
    <div style={{ marginBottom: "4px" }}>
      <FieldLabel>Location:</FieldLabel>
      <LocationPicker region={f.region} province={f.province} city={f.city} barangay={f.barangay} street={f.street} onChange={f.handleLocationChange} disabled={locked} regionError={!locked ? f.regionError : ""} />
    </div>

    {/* College / Program / Major */}
    <div className="sa-college-grid">
      <div>
        <FieldLabel>College:</FieldLabel>
        <StyledSelect value={f.college} onChange={f.handleCollegeChange} options={COLLEGES.map(c => c.name)} placeholder="Select College" disabled={locked} hasError={!locked && !!f.collegeError} />
        <FieldError msg={!locked ? f.collegeError : ""} />
      </div>
      <div>
        <FieldLabel>Program:</FieldLabel>
        <StyledSelect value={f.program} onChange={f.handleProgramChange} options={f.programOptions} placeholder="Select Program" disabled={locked || !f.college} hasError={!locked && !!f.programError} />
        <FieldError msg={!locked ? f.programError : ""} />
      </div>
      <div>
        <FieldLabel>Major:</FieldLabel>
        <StyledSelect value={f.major} onChange={f.setMajor} options={f.majorOptions} placeholder={f.majorOptions.length === 0 ? "N/A" : "Select Major"} disabled={locked || f.majorOptions.length === 0} />
      </div>
    </div>

    {/* Contact & Email */}
    <div className="sa-contact-grid">
      <div>
        <FieldLabel>Contact Number:</FieldLabel>
        <StyledInput value={f.contact.value} onChange={f.handleContactChange} placeholder="+63 999-999-9999" disabled={locked} hasError={!locked && f.contact.hasError} />
        <FieldError msg={!locked ? f.contact.error : ""} />
      </div>
      <div>
        <FieldLabel>Email Address:</FieldLabel>
        <StyledInput value={f.email.value} onChange={(v) => f.email.onChange(v)} type="email" placeholder="student@gmail.com" disabled={locked} hasError={!locked && f.email.hasError} />
        <FieldError msg={!locked ? f.email.error : ""} />
      </div>
    </div>

    {/* Message */}
    <div style={{ marginBottom: "4px" }}>
      <FieldLabel>
        Application Message:{" "}
        {!locked && <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#888", fontWeight: 400 }}>(optional)</span>}
      </FieldLabel>
      <textarea
        className="app-textarea"
        value={f.message}
        onChange={e => f.setMessage(e.target.value)}
        placeholder="Write your application message..."
        disabled={locked}
        style={{ width: "100%", background: locked ? "#e8e8e8" : "white", border: "none", borderRadius: "16px", padding: "10px 14px", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#222", outline: "none", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)", resize: "none", minHeight: "90px", lineHeight: 1.6, boxSizing: "border-box", overflowY: "auto" }}
      />
    </div>

    {/* Files */}
    <div style={{ marginBottom: "8px" }}>
      <FieldLabel>Attach File:</FieldLabel>
      <MultiFileUpload
        attachedFiles={f.attachedFiles}
        onAdd={(newFiles) => {
          const currentSize = (f.attachedFiles || []).reduce((s, file) => s + file.size, 0);
          const newSize = newFiles.reduce((s, file) => s + file.size, 0);
          if (currentSize + newSize > MAX_FILE_SIZE) { alert("Total file size must not exceed 10MB."); return; }
          f.setAttachedFiles([...(f.attachedFiles || []), ...newFiles]);
        }}
        onRemove={(idx) => { const updated = [...(f.attachedFiles || [])]; updated.splice(idx, 1); f.setAttachedFiles(updated); }}
        disabled={locked}
      />
    </div>
  </>
);

// ─── APPLY MODAL ──────────────────────────────────────────────────────────────
export const ApplyModal = ({ company, onClose, onSubmit, user }) => {
  const COLLEGE_ABBR_MAP = {
    "CCS":  "College of Computer Studies",
    "CBA":  "College of Business and Accountancy",
    "CCJE": "College of Criminal Justice Education",
    "CLA":  "College of Liberal Arts",
    "CED":  "College of Education",
    "CHM":  "College of Hospitality Management",
  };
  const PROGRAM_ABBR_MAP = {
    "BSIT": "Bachelor of Information Technology",
    "BSBA (Major in Marketing Management)": "Bachelor of Science in Business Administration",
    "BSA":  "Bachelor of Science in Accountancy",
    "BS CRIM": "Bachelor of Science in Criminology",
    "BA POLSCI": "Bachelor of Arts in Political Science",
    "BEED": "Bachelor of Elementary Education",
    "BSED (Major in English)": "Bachelor of Secondary Education",
    "BSED (Major in Mathematics)": "Bachelor of Secondary Education",
    "BSTM": "Bachelor of Science in Tourism Management",
    "BSHM": "Bachelor of Science in Hospitality Management",
  };

  const f = useApplicationForm({
    firstName:     user?.firstName     || "",
    middleInitial: user?.middleInitial || "",
    lastName:      user?.lastName      || "",
    sex:           user?.sex           || "",
    email:         user?.email         || "",
    college:       COLLEGE_ABBR_MAP[user?.college] || user?.college || "",
    program:       PROGRAM_ABBR_MAP[user?.program] || user?.program || "",
    region:        user?.location?.region   || "",
    province:      user?.location?.province || "",
    city:          user?.location?.city     || "",
    barangay:      user?.location?.barangay || "",
  });

  const handleSubmit = async () => {
    f.touchAll();
    if (!f.isValid()) return;
    try {
      await addDoc(collection(db, "applications"), {
        ...f.getFormData(),
        studentId:   user?.uid        || "",
        studentName: (user?.firstName || "") + " " + (user?.lastName || ""),
        companyId:   company?.id      || company?.companyId || "",
        companyName: company?.name    || company?.companyName || "",
        status:      "Pending",
        createdAt:   serverTimestamp(),
      });
      onSubmit?.({ ...f.getFormData(), company: company?.name });
    } catch (err) {
      console.error("Failed to submit application:", err);
    }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <ResponsiveStyles />
      <div className="sa-modal-inner">
        {/* Header */}
        <div className="sa-modal-header">
          <div>
            <h2 className="sa-modal-title" style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.3rem, 4vw, 1.8rem)", color: darkRed }}>Apply Now</h2>
            <p className="sa-modal-subtitle">Applying to: <strong style={{ color: darkRed }}>{company?.name}</strong></p>
          </div>
          <button onClick={onClose} style={{ background: darkRed, border: "none", borderRadius: "50%", width: "30px", height: "30px", color: "white", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div className="sa-modal-body">
          <FormFields f={f} locked={false} />
        </div>

        {/* Footer */}
        <div className="sa-modal-footer">
          <button onClick={onClose}       style={{ padding: "10px 28px", borderRadius: "24px", background: "#555",    color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.1rem", cursor: "pointer" }}>CANCEL</button>
          <button onClick={handleSubmit}  style={{ padding: "10px 28px", borderRadius: "24px", background: darkRed,  color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.1rem", cursor: "pointer" }}>SUBMIT</button>
        </div>
      </div>
    </div>
  );
};

// ─── VIEW APPLICATION MODAL ───────────────────────────────────────────────────
const ViewApplicationModal = ({ application, onClose, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const f = useApplicationForm(application.data);

  const handleSave = () => {
    f.touchAll();
    if (!f.isValid()) return;
    onSave?.(application.id, f.getFormData());
    setIsEditing(false);
  };

  const STATUS_COLOR_MAP = {
    "In Review":   "#353A8D",
    "Accepted":    "#2d7a2d",
    "Declined":    darkRed,
    "Pending":     "#c8a800",
    "To Interview":"#7C2889",
  };
  const statusColor = STATUS_COLOR_MAP[application.status] || "#aaa";
  const fullName = application.data.lastName && application.data.firstName
    ? `${application.data.lastName}, ${application.data.firstName}`
    : "Application";
  const locked = !isEditing;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <ResponsiveStyles />
      <div className="sa-modal-inner">
        {/* Header */}
        <div className="sa-modal-header">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="sa-modal-title" style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 4vw, 1.8rem)", color: darkRed, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</h2>
            <p className="sa-modal-subtitle">Applied to: <strong style={{ color: darkRed }}>{application.company}</strong></p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <span className="sa-status-badge" style={{ background: statusColor, color: "white", borderRadius: "20px", padding: "4px 14px", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.76rem", whiteSpace: "nowrap" }}>{application.status}</span>
            <button onClick={onClose} style={{ background: darkRed, border: "none", borderRadius: "50%", width: "30px", height: "30px", color: "white", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="sa-modal-body">
          <FormFields f={f} locked={locked} />
        </div>

        {/* Footer */}
        <div className="sa-modal-footer">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} style={{ padding: "10px 28px", borderRadius: "24px", background: "#555",   color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.1rem", cursor: "pointer" }}>CANCEL</button>
              <button onClick={handleSave}                style={{ padding: "10px 28px", borderRadius: "24px", background: darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.1rem", cursor: "pointer" }}>SAVE</button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} style={{ padding: "10px 28px", borderRadius: "24px", background: "#444", color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.1rem", cursor: "pointer" }}>EDIT</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── APPLICATION ROW ──────────────────────────────────────────────────────────
const ApplicationRow = ({ application, onView }) => {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div
      className="sa-app-row"
      style={{ background: "#dadada", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "12px", transition: "background 0.15s", cursor: "pointer", position: "relative" }}
      onClick={() => onView(application)}
    >
      <div style={{ width: "38px", height: "38px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={companyProfileIcon} alt="company" style={{ width: "38px", height: "38px", objectFit: "contain" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{application.company}</span>
      </div>
      <div style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button onClick={() => setShowMenu(!showMenu)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", color: "#555", fontSize: "1.1rem", lineHeight: 1 }}>⋮</button>
        {showMenu && (
          <div style={{ position: "absolute", top: "24px", right: 0, background: "white", borderRadius: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", overflow: "hidden", zIndex: 10, minWidth: "80px" }}>
            <button onClick={() => { onView(application); setShowMenu(false); }}
              style={{ width: "100%", border: "none", background: "white", padding: "8px 12px", textAlign: "left", cursor: "pointer", fontSize: "0.78rem", fontFamily: "'Kufam', sans-serif", fontWeight: 600, color: "#222" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}>View</button>
            <div style={{ height: "1px", background: "#e0e0e0", margin: "0 8px" }} />
            <button style={{ width: "100%", border: "none", background: "white", padding: "8px 12px", textAlign: "left", cursor: "pointer", fontSize: "0.78rem", color: "#c62828", fontFamily: "'Kufam', sans-serif", fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = "#fff0f0"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MAIN APPLICATION SCREEN ──────────────────────────────────────────────────
const StudentApplicationScreen = ({ initialCompany, onModalClose }) => {
  const [search, setSearch]                     = useState("");
  const [showApply, setShowApply]               = useState(!!initialCompany);
  const [applyCompany, setApplyCompany]         = useState(initialCompany || null);
  const [viewingApplication, setViewingApplication] = useState(null);
  const [viewKey, setViewKey]                   = useState(0);
  const [applications, setApplications]         = useState(APPLICATIONS);

  const filteredApplications = applications.filter(app =>
    app.company.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (id, updatedData) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, data: updatedData } : a));
    setViewingApplication(null);
  };

  const handleView = (app) => {
    setViewingApplication(app);
    setViewKey(k => k + 1);
  };

  return (
    <>
      <ResponsiveStyles />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f0f0f0", overflow: "hidden" }}>

        {/* Top Bar */}
        <div className="sa-topbar">
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.1rem, 4vw, 1.6rem)", color: "white", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            Recent Applications
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", borderRadius: "24px", padding: "7px 16px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <div style={{ width: "1px", height: "16px", background: "rgba(0,0,0,0.2)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Application"
              className="sa-search-input"
              style={{ border: "none", background: "transparent", outline: "none", color: "black", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.05rem" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>

        {/* Application rows */}
        <div className="sa-list-area">
          {filteredApplications.map(application => (
            <ApplicationRow key={application.id} application={application} onView={handleView} />
          ))}
          {filteredApplications.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px", color: "#aaa", fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem" }}>
              No applications found.
            </div>
          )}
          {filteredApplications.length > 0 && (
            <p style={{ textAlign: "center", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#aaa", padding: "16px 0" }}>
              No more recent applications!
            </p>
          )}
        </div>
      </div>

      {viewingApplication && (
        <ViewApplicationModal
          key={viewKey}
          application={viewingApplication}
          onClose={() => setViewingApplication(null)}
          onSave={handleSave}
        />
      )}
      {showApply && (
        <ApplyModal
          company={applyCompany}
          onClose={() => { setShowApply(false); setApplyCompany(null); onModalClose?.(); }}
          onSubmit={data => console.log("Submitted:", data)}
        />
      )}
    </>
  );
};

export default StudentApplicationScreen;