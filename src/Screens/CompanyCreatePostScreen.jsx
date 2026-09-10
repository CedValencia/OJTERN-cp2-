import React, { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const MAPBOX_TOKEN = "pk.eyJ1IjoibWFraWlpaS0iLCJhIjoiY21wbTgybHVmMmc1ZzJycTFuZXRlb3NoNCJ9.FIpjF2lKTHkbU1e6qrL_Pw";
const darkRed = "#590101";
const red     = "#8B0000";

// ── Responsive styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    /* Post grid: 2-col on ≥640px, 1-col below */
    .post-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    @media (max-width: 639px) {
      .post-grid { grid-template-columns: 1fr; }
    }

    /* Post modal */
    .post-modal-inner {
      width: 640px;
      max-width: 100%;
    }
    @media (max-width: 680px) {
      .post-modal-inner {
        width: 100%;
        max-width: 460px;
        border-radius: 14px;
        max-height: 82vh;
      }
    }
    @media (max-width: 480px) {
      .post-modal-inner {
        max-height: 80dvh;
      }
    }

    /* Modal body padding */
    .post-modal-body {
      padding: 0 28px 16px;
    }
    @media (max-width: 480px) {
      .post-modal-body { padding: 0 14px 12px; }
    }

    /* Modal header padding */
    .post-modal-header {
      padding: 20px 28px 12px;
    }
    @media (max-width: 480px) {
      .post-modal-header { padding: 14px 14px 10px; }
    }

    /* Modal footer padding */
    .post-modal-footer {
      padding: 14px 28px;
    }
    @media (max-width: 480px) {
      .post-modal-footer { padding: 12px 14px; }
    }

    /* Description + map row: stacked vertically, map full width */
    .post-desc-row {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Map box: full width, tall */
    .post-map-box {
      width: 100%;
      height: 320px;
      flex-shrink: 0;
      border-radius: 16px;
      overflow: hidden;
    }
    @media (max-width: 480px) {
      .post-map-box { height: 220px; }
    }

    /* Working hours + slot row: side-by-side, but slot drops below on very small screens */
    .post-hours-slot-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    @media (max-width: 400px) {
      .post-hours-slot-row { flex-direction: column; }
      .post-slot-col { flex-direction: row; align-items: center; gap: 10px; }
    }

    /* Contact info: label + input row */
    .post-contact-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    @media (max-width: 400px) {
      .post-contact-row { flex-direction: column; gap: 4px; }
    }

    /* Screen padding */
    .post-screen-padding {
      padding: 28px 32px;
    }
    @media (max-width: 640px) {
      .post-screen-padding { padding: 16px 16px; }
    }

    /* Recent Post header row */
    .post-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    /* Post button */
    .post-btn {
      padding: 10px 24px;
      font-size: 1.3rem;
    }
    @media (max-width: 480px) {
      .post-btn { padding: 8px 16px; font-size: 1rem; }
    }

    /* Modal overlay scroll on small screens */
    .post-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      padding: 12px;
      overflow-y: auto;
    }
    @media (max-width: 480px) {
      .post-modal-overlay { padding: 10px; }
    }

    /* Confirm / success mini-modals: always centered, never pinned to top */
    .post-confirm-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 1100;
      padding: 16px;
      overflow-y: auto;
    }
  `}</style>
);

// ── Google Fonts ──────────────────────────────────────────────────────────────
const GlobalFonts = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.id = "ojt-font-override";
    style.textContent = `
      .ojt-field { font-family: 'Kufam', sans-serif !important; }
      .ojt-field::placeholder { font-family: 'Kufam', sans-serif !important; color: #aaa; }
      .ojt-textarea::-webkit-scrollbar { width: 6px; }
      .ojt-textarea::-webkit-scrollbar-track { background: transparent; border-radius: 10px; }
      .ojt-textarea::-webkit-scrollbar-thumb { background: ${darkRed}; border-radius: 10px; }
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button {
        opacity: 1; background: ${darkRed}; cursor: pointer;
      }
      input[type=number] { accent-color: ${darkRed}; }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
      const s = document.getElementById("ojt-font-override");
      if (s && document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

// ── Shared pill-style field styles ────────────────────────────────────────────
const pillInputStyle = {
  width: "100%",
  padding: "8px 14px",
  background: "white",
  border: "none",
  borderRadius: "20px",
  color: "#1a1a1a",
  fontSize: "0.82rem",
  fontFamily: "'Kufam', sans-serif",
  outline: "none",
  boxSizing: "border-box",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)",
};

const pillInputReadonly = {
  ...pillInputStyle,
  background: "#e8e8e8",
  color: "#555",
  cursor: "default",
};

const pillTextareaStyle = {
  ...pillInputStyle,
  borderRadius: "16px",
  resize: "none",
  minHeight: "72px",
  lineHeight: 1.6,
  overflowY: "auto",
  scrollbarWidth: "thin",
  scrollbarColor: `${darkRed} transparent`,
};

const pillTextareaReadonly = {
  ...pillTextareaStyle,
  background: "#e8e8e8",
  color: "#555",
  cursor: "default",
};

const pillSelectStyle = {
  ...pillInputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: "34px",
  cursor: "pointer",
};

const pillSelectReadonly = {
  ...pillSelectStyle,
  background: "#e8e8e8",
  color: "#555",
  cursor: "default",
};

// ── Field Label ───────────────────────────────────────────────────────────────
const FieldLabel = ({ children }) => (
  <p style={{
    fontFamily: "'Jersey 25', sans-serif",
    fontSize: "clamp(1.05rem, 3vw, 1.3rem)",
    color: "black",
    marginBottom: "5px",
    letterSpacing: "0.03em",
    marginTop: "10px",
  }}>{children}</p>
);

// ── Inline sub-label ──────────────────────────────────────────────────────────
const inlineLabelStyle = {
  fontFamily: "'Jua', sans-serif",
  fontSize: "clamp(0.85rem, 2.5vw, 1rem)",
  color: red,
  whiteSpace: "nowrap",
};

// ── Field Error ───────────────────────────────────────────────────────────────
const FieldError = ({ msg }) => msg
  ? <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#c00", marginTop: "3px", paddingLeft: "6px" }}>{msg}</p>
  : null;

// ── Pill Select with arrow ────────────────────────────────────────────────────
const PillSelect = ({ value, onChange, options, placeholder, disabled, hasError }) => (
  <div style={{ position: "relative" }}>
    <select
      className="ojt-field"
      disabled={disabled}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        ...(disabled ? pillSelectReadonly : pillSelectStyle),
        border: hasError ? "1.5px solid #c00" : "none",
        color: value ? "#1a1a1a" : "#aaa",
      }}
    >
      <option value="">{placeholder || "Select..."}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: disabled ? "#bbb" : darkRed }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
    </div>
  </div>
);

// ── Approved Department Picker ────────────────────────────────────────────────
// A post can only be created for the department(s)/program(s) THIS company
// has actually been approved for by the matching coordinator — not any
// college in the system (that's what the old MultiCollegeProgramPicker did,
// even though College/Program data itself now comes live from Firestore via
// useDepartmentsPrograms — see ./departmentsPrograms). Every entry in
// `approvedDeptSelections` is this company's own `deptSelections` (set at
// Sign-Up / Account Profile), pre-filtered to `status === "approved"`.
// Each checked department/program now carries its own `slot` count — a
// company posting for two departments needs to say how many OJT slots it
// has for EACH one, not one combined number for the whole post (see
// PostOJTContent.handleSave, which sums these into a `slot` total for any
// other screen that still reads that combined field).
const ApprovedDepartmentPicker = ({ approvedDeptSelections, selections, onChange, readOnly }) => {
  const findSelection = (dept, program) => selections.find(s => s.college === dept && s.program === program);
  const isChecked = (dept, program) => !!findSelection(dept, program);
  const getSlot = (dept, program) => findSelection(dept, program)?.slot ?? 1;

  const toggle = (dept, program) => {
    if (isChecked(dept, program)) {
      onChange(selections.filter(s => !(s.college === dept && s.program === program)));
    } else {
      onChange([...selections, { college: dept, program, specialization: "", slot: 1 }]);
    }
  };

  const setSlot = (dept, program, slot) => {
    onChange(selections.map(s => (s.college === dept && s.program === program) ? { ...s, slot } : s));
  };

  if (approvedDeptSelections.length === 0) {
    return (
      <div style={{ background: "#fff3f3", border: `1.5px solid ${red}`, borderRadius: "14px", padding: "12px 14px", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: darkRed }}>
        You don't have any approved department yet. A coordinator needs to approve at least one of your registered departments before you can post here — check your registration status.
      </div>
    );
  }

  return (
    <div>
      {approvedDeptSelections.map((s, idx) => {
        const checked = isChecked(s.department, s.program);
        return (
          <div
            key={idx}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: "#ececec", borderRadius: "14px", padding: "10px 14px",
              marginBottom: "8px",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0, cursor: readOnly ? "default" : "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={checked}
                disabled={readOnly}
                onChange={() => toggle(s.department, s.program)}
                style={{ width: "17px", height: "17px", accentColor: darkRed, cursor: readOnly ? "default" : "pointer", flexShrink: 0 }}
              />
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#222", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ fontWeight: 700 }}>{s.department}</span>
                {s.program && <span style={{ color: "#666" }}> — {s.program}</span>}
              </span>
            </label>
            {checked && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#888", whiteSpace: "nowrap" }}>Slots:</span>
                <input
                  type="number"
                  min={1}
                  disabled={readOnly}
                  value={getSlot(s.department, s.program)}
                  onChange={e => setSlot(s.department, s.program, Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: "56px", textAlign: "center", padding: "5px 4px",
                    borderRadius: "10px", border: "none",
                    fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)",
                    background: readOnly ? "#e0e0e0" : "white",
                    color: readOnly ? "#555" : "#1a1a1a",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Expiration date helpers ──────────────────────────────────────────────────
// Dates are stored/compared as plain "YYYY-MM-DD" strings (what <input type="date">
// gives us), so lexicographic comparison is safe and avoids timezone drift from
// building Date objects. A post is "expired" the day AFTER its expirationDate —
// i.e. if a company sets Sept 9, applying is still allowed ON Sept 9 and only
// blocked starting Sept 10.
const getTodayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const isPostExpired = (post) => !!post?.expirationDate && post.expirationDate < getTodayStr();

// ── Working Hours ──────────────────────────────────────────────────────────────
// One day + one time range per entry (not a day-to-day range) — pick
// "Monday", then Monday's hours; a different day with different hours is
// its own entry via "+ Add Another Working Hours". Composed into
// "Monday (8:00am - 5:00pm)" so anything else that reads
// workingHours/workingHoursList — display screens, exports, etc. — still
// gets a single day name per entry, just no longer a "Monday - Friday" span.
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const formatTime12h = (t24) => {
  if (!t24) return "";
  const [hStr, mStr] = t24.split(":");
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? "pm" : "am";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${mStr}${period}`;
};

const to24h = (t12) => {
  const m = /^(\d{1,2}):(\d{2})(am|pm)$/i.exec((t12 || "").trim());
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const period = m[3].toLowerCase();
  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};

// Parses a previously-saved string back into its parts, so reopening an
// existing post populates the picker instead of showing it blank. Still
// tolerates an old "Monday - Friday (...)" range saved before this change —
// it just takes the first day, since there's no day-to-day picker anymore.
const parseWorkingHours = (str) => {
  const m = /^([A-Za-z]+)(?:\s*-\s*[A-Za-z]+)?\s*\((\d{1,2}:\d{2}(?:am|pm))\s*-\s*(\d{1,2}:\d{2}(?:am|pm))\)$/i.exec((str || "").trim());
  if (!m) return { day: "", timeFrom: "", timeTo: "" };
  return { day: m[1] || "", timeFrom: to24h(m[2]), timeTo: to24h(m[3]) };
};

// ── Working Hours Input ───────────────────────────────────────────────────────
const WorkingHoursInput = ({ value, onChange, readOnly, hasError }) => {
  // Local state is the actual source of truth while editing — parsed ONCE
  // from the incoming value on mount (so reopening an existing post
  // populates correctly), never re-derived from `value` afterward. This is
  // what fixes the "won't let me type/select anything" bug: the previous
  // version re-derived every field straight from the composed string on
  // every render, and emitted `onChange("")` the instant any ONE of the
  // three parts was still missing — so the very first selection (e.g. just
  // "Day") got wiped back to blank before the person could pick the next
  // one. Now, partial progress just stays in local state; the parent only
  // hears about it once the selection is actually complete.
  const [day, setDay]           = useState(() => parseWorkingHours(value).day);
  const [timeFrom, setTimeFrom] = useState(() => parseWorkingHours(value).timeFrom);
  const [timeTo, setTimeTo]     = useState(() => parseWorkingHours(value).timeTo);

  // Re-sync from `value` whenever it changes for a reason OTHER than our
  // own onChange below (e.g. the person removes an earlier "+ Add Another
  // Working Hours" entry — since each row is keyed by array index, this
  // same component instance can end up representing a completely different
  // saved entry after the array shifts, without ever unmounting/remounting).
  // This is a safe no-op the rest of the time: after our own onChange
  // fires, `value` changes to exactly what we just emitted, and parsing it
  // back just reproduces the same three values already in state.
  useEffect(() => {
    const parsed = parseWorkingHours(value);
    setDay(parsed.day);
    setTimeFrom(parsed.timeFrom);
    setTimeTo(parsed.timeTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!day || !timeFrom || !timeTo) return; // still incomplete — don't emit yet
    const timePart = `${formatTime12h(timeFrom)} - ${formatTime12h(timeTo)}`;
    onChange(`${day} (${timePart})`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, timeFrom, timeTo]);

  const timeStyle = { ...(readOnly ? pillInputReadonly : pillInputStyle), colorScheme: "light" };

  const toLabelStyle = { fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#888", flexShrink: 0, width: "20px", textAlign: "center" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Day — its own row so it never competes for width with the time inputs */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PillSelect value={day} onChange={setDay} options={DAYS_OF_WEEK} placeholder="Day" disabled={readOnly} hasError={hasError && !day} />
        </div>
      </div>
      {/* Time range for that day — each input gets full width to breathe
          (a cramped width was clipping the native time picker's clock icon
          against the text). */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input type="time" className="ojt-field" disabled={readOnly} value={timeFrom}
            onChange={e => setTimeFrom(e.target.value)}
            style={{ ...timeStyle, width: "100%", border: hasError && !timeFrom ? "1.5px solid #c00" : "none" }} />
        </div>
        <span style={toLabelStyle}>to</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input type="time" className="ojt-field" disabled={readOnly} value={timeTo}
            onChange={e => setTimeTo(e.target.value)}
            style={{ ...timeStyle, width: "100%", border: hasError && !timeTo ? "1.5px solid #c00" : "none" }} />
        </div>
      </div>
    </div>
  );
};

// ── Phone Input ───────────────────────────────────────────────────────────────
const PhoneInput = ({ value, onChange, readOnly, hasError }) => {
  const handleChange = (e) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (raw.startsWith("63")) raw = raw.slice(2);
    if (raw.length > 10) raw = raw.slice(0, 10);
    const p1 = raw.slice(0, 3), p2 = raw.slice(3, 6), p3 = raw.slice(6, 10);
    let fmt = "+63";
    if (p1) fmt += " " + p1;
    if (p2) fmt += "-" + p2;
    if (p3) fmt += "-" + p3;
    onChange(fmt);
  };
  return (
    <input className="ojt-field" type="text" disabled={readOnly}
      placeholder="+63 000-000-0000"
      value={value} onChange={handleChange}
      style={{ ...(readOnly ? pillInputReadonly : pillInputStyle), border: hasError ? "1.5px solid #c00" : "none" }} />
  );
};

// ── Gmail Email Input ─────────────────────────────────────────────────────────
const GmailInput = ({ value, onChange, readOnly, error, onBlur }) => (
  <div style={{ width: "100%" }}>
    <input className="ojt-field" type="email" disabled={readOnly}
      placeholder="example@gmail.com"
      value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}
      style={{ ...(readOnly ? pillInputReadonly : pillInputStyle), border: error ? "1.5px solid #cc0000" : "none" }} />
    <FieldError msg={error} />
  </div>
);

// ── Mapbox Location Picker ─────────────────────────────────────────────────────
const MapboxLocationPicker = ({ value, lat, lng, onChange, readOnly }) => {
  const mapContainer = React.useRef(null);
  const mapRef       = React.useRef(null);
  const markerRef    = React.useRef(null);
  const [query, setQuery]       = useState(value || "");
  const [suggestions, setSugs]  = useState([]);
  const [geocoding, setGeocoding] = useState(false);

  // Load Mapbox GL JS dynamically
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = () => {
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/standard-satellite",
        center: lat != null && lng != null ? [lng, lat] : [120.9842, 14.5995], // default: Manila
        zoom: lat != null && lng != null ? 15 : 10,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      // Prefer the company's actual stored coordinates (this may be a pin
      // they manually placed at signup) — only fall back to re-geocoding
      // the address text if we don't have coordinates at all (e.g. older
      // company records saved before pins were stored).
      if (lat != null && lng != null) {
        markerRef.current = new mapboxgl.Marker({ color: "#8B0000" }).setLngLat([lng, lat]).addTo(map);
        onChange?.({ address: value, lat, lng });
      } else if (value) {
        geocodeAndPin(value, map);
      }
    };
    document.head.appendChild(script);
  }, []);

  const geocodeAndPin = async (text, map) => {
    if (!text.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${MAPBOX_TOKEN}&country=PH&limit=1`
      );
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) return;
      const [lng, lat] = feature.center;
      const m = map || mapRef.current;
      if (!m) return;
      m.flyTo({ center: [lng, lat], zoom: 15, speed: 1.4 });
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new window.mapboxgl.Marker({ color: "#8B0000" })
        .setLngLat([lng, lat])
        .addTo(m);
      onChange({ address: text, lat, lng });
    } catch (_) {}
    finally { setGeocoding(false); }
  };

  const fetchSuggestions = async (text) => {
    if (!text.trim() || text.length < 3) { setSugs([]); return; }
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${MAPBOX_TOKEN}&country=PH&limit=5&types=place,locality,address,poi`
      );
      const data = await res.json();
      setSugs(data.features || []);
    } catch (_) { setSugs([]); }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    fetchSuggestions(val);
    if (!val.trim()) {
      onChange({ address: "", lat: null, lng: null });
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    }
  };

  const handleSelect = (feature) => {
    const label = feature.place_name;
    const [lng, lat] = feature.center;
    setQuery(label);
    setSugs([]);
    onChange({ address: label, lat, lng });
    const m = mapRef.current;
    if (!m) return;
    m.flyTo({ center: [lng, lat], zoom: 15, speed: 1.4 });
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = new window.mapboxgl.Marker({ color: "#8B0000" })
      .setLngLat([lng, lat])
      .addTo(m);
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Search input */}
      {!readOnly && (
        <div style={{ position: "relative", marginBottom: "8px" }}>
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onKeyDown={e => { if (e.key === "Enter") { setSugs([]); geocodeAndPin(query); } }}
            placeholder="Type a location (e.g. Angeles, Pampanga)..."
            style={{ ...pillInputStyle, width: "100%", boxSizing: "border-box", paddingRight: geocoding ? "40px" : "16px" }}
          />
          {geocoding && (
            <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", color: "#888" }}>Searching…</span>
          )}
          {suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #ddd", borderRadius: "10px", zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", overflow: "hidden" }}>
              {suggestions.map((s, i) => (
                <div key={i} onClick={() => handleSelect(s)}
                  style={{ padding: "9px 14px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "'Kufam', sans-serif", color: "#222", borderBottom: i < suggestions.length - 1 ? "1px solid #f0f0f0" : "none" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8f0f0"}
                  onMouseLeave={e => e.currentTarget.style.background = "white"}
                >
                  📍 {s.place_name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div className="post-map-box">
        <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
};

// ── Post Form Modal ───────────────────────────────────────────────────────────
// ── Discard-changes confirm modal ──────────────────────────────────────────────
const ConfirmDiscardModal = ({ onKeepEditing, onDiscard }) => (
  <div className="post-confirm-overlay">
    <div style={{ background: "#fff", borderRadius: "18px", maxWidth: "360px", width: "90%", padding: "26px 22px", boxShadow: "0 8px 40px rgba(0,0,0,0.35)", textAlign: "center" }}>
      <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.4rem", color: darkRed, margin: "0 0 10px" }}>Discard changes?</p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#333", margin: "0 0 22px", lineHeight: 1.4 }}>
        All your changes will be lost. Are you sure you want to cancel this change?
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
        <button onClick={onKeepEditing} style={{ padding: "9px 22px", borderRadius: "22px", background: "#e6e6e6", color: "#333", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
          Keep Editing
        </button>
        <button onClick={onDiscard} style={{ padding: "9px 22px", borderRadius: "22px", background: darkRed, color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
          Yes, Discard
        </button>
      </div>
    </div>
  </div>
);

// ── Saved-successfully modal ───────────────────────────────────────────────────
const SavedSuccessModal = ({ onClose }) => (
  <div className="post-confirm-overlay">
    <div style={{ background: "#fff", borderRadius: "18px", maxWidth: "320px", width: "90%", padding: "30px 22px 24px", boxShadow: "0 8px 40px rgba(0,0,0,0.35)", textAlign: "center" }}>
      <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#e6f7ec", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: "1.8rem", color: "#1f9254" }}>
        ✓
      </div>
      <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.4rem", color: darkRed, margin: "0 0 6px" }}>Saved successfully!</p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#555", margin: "0 0 20px" }}>
        Your post has been updated.
      </p>
      <button onClick={onClose} style={{ padding: "9px 30px", borderRadius: "22px", background: darkRed, color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
        OK
      </button>
    </div>
  </div>
);

// ── Generic confirm-action modal (used for Delete / Disable / Enable) ─────────
const ConfirmActionModal = ({ title, message, confirmLabel, danger = false, onCancel, onConfirm }) => (
  <div className="post-confirm-overlay">
    <div style={{ background: "#fff", borderRadius: "18px", maxWidth: "360px", width: "90%", padding: "26px 22px", boxShadow: "0 8px 40px rgba(0,0,0,0.35)", textAlign: "center" }}>
      <p style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.4rem", color: darkRed, margin: "0 0 10px" }}>{title}</p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", color: "#333", margin: "0 0 22px", lineHeight: 1.4 }}>
        {message}
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
        <button onClick={onCancel} style={{ padding: "9px 22px", borderRadius: "22px", background: "#e6e6e6", color: "#333", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={onConfirm} style={{ padding: "9px 22px", borderRadius: "22px", background: danger ? red : darkRed, color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

const PostFormModal = ({ post, mode, onClose, onSave, user, companyProfile }) => {
  const [isEditing, setIsEditing] = useState(mode === "create" || mode === "edit");

  // The post's location is fixed to whatever the company has set in their
  // Account Profile — it is never typed/edited from this form. Build the
  // display address the same way PersonalInfoScreen does.
  const profileLoc = companyProfile?.location || {};
  const fixedAddress = [profileLoc.street, profileLoc.barangay, profileLoc.city, profileLoc.province, profileLoc.region]
    .filter(Boolean).join(", ");

  // Only department(s) THIS company has actually been approved for by a
  // coordinator can be posted for — see ApprovedDepartmentPicker. A new
  // post defaults to ALL currently-approved departments checked (matches
  // whatever was picked/approved at Sign-Up); an existing post keeps its
  // saved selections, but drops any entry that isn't (or is no longer)
  // approved, so a revoked approval can't linger on an old post.
  const approvedDeptSelections = (companyProfile?.deptSelections || [])
    .filter(s => s.status === "approved" && s.department);
  const isApproved = (college, program) =>
    approvedDeptSelections.some(s => s.department === college && s.program === program);
  const defaultCourseSelections = approvedDeptSelections.map(s => ({ college: s.department, program: s.program, specialization: "", slot: 1 }));

  const [form, setForm] = useState({
    benefits:         post?.benefits         || "",
    courseSelections: post?.courseSelections
      ? post.courseSelections.filter(s => isApproved(s.college, s.program))
      : defaultCourseSelections,
    skillsRequired:   post?.skillsRequired   || "",
    description:      post?.description      || "",
    requirements:     post?.requirements     || "",
    workingHoursList: post?.workingHoursList || [post?.workingHours || ""],
    phone:            post?.phone || "+63 ",
    contactEmail:     post?.contactEmail || "",
    postLocation:     post?.postLocation || { address: fixedAddress, lat: profileLoc.lat ?? null, lng: profileLoc.lng ?? null },
    expirationDate:   post?.expirationDate || "",
  });

  // Keep postLocation's address in lockstep with the company profile even if
  // the profile changes while this modal is open, or if the post predates
  // this fixed-location behavior and still has a stale/empty address.
  useEffect(() => {
    if (fixedAddress && (form.postLocation?.address !== fixedAddress || form.postLocation?.lat !== (profileLoc.lat ?? null))) {
      setForm(f => ({ ...f, postLocation: { ...f.postLocation, address: fixedAddress, lat: profileLoc.lat ?? null, lng: profileLoc.lng ?? null } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedAddress, profileLoc.lat, profileLoc.lng]);

  const [errors, setErrors]                         = useState({});
  const [courseErrors, setCourseErrors]             = useState("");
  const [workingHoursErrors, setWorkingHoursErrors] = useState([]);
  const [dirty, setDirty]                           = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaved, setShowSaved]                   = useState(false);
  const readOnly = !isEditing;

  const set = (field, val) => { setForm(f => ({ ...f, [field]: val })); setDirty(true); };

  const validateGmail = (val) => {
    if (!val || !val.trim()) return "Email is required.";
    return "";
  };

  const validatePhone = (val) => {
    if (!val || val.trim() === "+63" || val.trim() === "+63 ") return "Phone number is required.";
    const digits = val.replace(/\D/g, "");
    if (digits.length < 12) return "Must be a valid +63 number.";
    return "";
  };

  const handleSave = () => {
    const newErrors = {};
    if (!form.description.trim())    newErrors.description    = "Description is required.";
    if (!form.requirements.trim())   newErrors.requirements   = "Requirements is required.";
    if (!form.benefits.trim())       newErrors.benefits       = "Benefits is required.";
    if (!form.skillsRequired.trim()) newErrors.skillsRequired = "Skills Required is required.";
    if (!form.phone.trim() || form.phone.trim() === "+63") newErrors.phone = "Phone number is required.";

    const emailErr = validateGmail(form.contactEmail);
    if (emailErr) newErrors.contactEmail = emailErr;

    // Expiration date is optional (a post with none never expires), but if
    // the company sets one it can't be a date that's already passed.
    if (form.expirationDate && form.expirationDate < getTodayStr()) {
      newErrors.expirationDate = "Expiration date can't be in the past.";
    }

    const newWhErrors = form.workingHoursList.map(h => {
      if (!h.trim()) return "Please select the day(s) and time.";
      return "";
    });
    setWorkingHoursErrors(newWhErrors);
    const hasWhError = newWhErrors.some(e => e);

    // No per-entry college/program to validate anymore — every entry in
    // courseSelections is, by construction, already one of the company's
    // approved departments (see ApprovedDepartmentPicker). Just require at
    // least one to be checked.
    const hasCourseError = form.courseSelections.length === 0;
    setCourseErrors(hasCourseError ? "Select at least one department." : "");

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0 || hasWhError || hasCourseError) return;

    onSave({ ...form, workingHours: form.workingHoursList.join(", ") });
    setDirty(false);
    setShowSaved(true);
  };

  const handleCloseClick = () => {
    if (isEditing && dirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="post-modal-overlay">
      <div className="post-modal-inner" style={{ background: "#d8d8d8", borderRadius: "20px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>

        {/* Header */}
        <div className="post-modal-header" style={{ background: "#d8d8d8", flexShrink: 0 }}>
          <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 4vw, 1.8rem)", fontWeight: "400", margin: 0, color: darkRed }}>
            {post?.companyName || post?.company || user?.companyName || "New Post"}
          </h2>
        </div>

        {/* Body */}
        <div className="post-modal-body" style={{ overflowY: "auto", flex: 1 }}>

          {/* Description + Requirements */}
          <div className="post-desc-row">
            <div style={{ width: "100%" }}>
              <FieldLabel>Description:</FieldLabel>
              <textarea className="ojt-field ojt-textarea" disabled={readOnly} value={form.description}
                onChange={e => { set("description", e.target.value); setErrors(p => ({ ...p, description: "" })); }}
                placeholder="Enter description..." rows={3}
                style={{ ...(readOnly ? pillTextareaReadonly : pillTextareaStyle), border: errors.description ? "1.5px solid #c00" : "none" }} />
              <FieldError msg={errors.description} />

              <FieldLabel>Requirements:</FieldLabel>
              <textarea className="ojt-field ojt-textarea" disabled={readOnly} value={form.requirements}
                onChange={e => { set("requirements", e.target.value); setErrors(p => ({ ...p, requirements: "" })); }}
                placeholder="Enter requirements..." rows={2}
                style={{ ...(readOnly ? pillTextareaReadonly : pillTextareaStyle), border: errors.requirements ? "1.5px solid #c00" : "none" }} />
              <FieldError msg={errors.requirements} />
            </div>

            {/* Location + Mapbox Map (fixed to Account Profile location — not editable here) */}
            <div style={{ width: "100%" }}>
              <FieldLabel>Location:</FieldLabel>
              {fixedAddress ? (
                <>
                  <div style={{ ...pillInputReadonly, marginBottom: "8px", display: "flex", alignItems: "center", boxSizing: "border-box", gap: "8px" }}>
                    <span>📍 {fixedAddress}</span>
                    {profileLoc.isManual && (
                      <span style={{ background: darkRed, color: "white", fontFamily: "'Kufam', sans-serif", fontSize: "0.65rem", padding: "2px 8px", borderRadius: "10px", whiteSpace: "nowrap" }}>
                        
                      </span>
                    )}
                  </div>
                  <MapboxLocationPicker
                    key={fixedAddress}
                    value={fixedAddress}
                    lat={profileLoc.lat}
                    lng={profileLoc.lng}
                    onChange={(loc) => set("postLocation", loc)}
                    readOnly={true}
                  />
                </>
              ) : (
                <div style={{ background: "#f0e0e0", border: `1px dashed ${darkRed}`, borderRadius: "14px", padding: "14px 16px", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: darkRed }}>
                  No location set yet. Please set your company location first.
                </div>
              )}
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#888", margin: "4px 0 0" }}>
                This follows your company's location.
              </p>
            </div>
          </div>

          {/* Working Hours */}
          <div className="post-hours-slot-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <FieldLabel>Working Hours:</FieldLabel>
              {(form.workingHoursList || [""]).map((hours, idx) => (
                <div key={idx} style={{ marginBottom: "4px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <WorkingHoursInput
                        value={hours}
                        onChange={v => {
                          const updated = [...form.workingHoursList];
                          updated[idx] = v;
                          set("workingHoursList", updated);
                          const newWh = [...workingHoursErrors];
                          newWh[idx] = "";
                          setWorkingHoursErrors(newWh);
                        }}
                        readOnly={readOnly}
                        hasError={!!workingHoursErrors[idx]}
                      />
                    </div>
                    {!readOnly && form.workingHoursList.length > 1 && (
                      <button type="button"
                        onClick={() => {
                          const u = [...form.workingHoursList]; u.splice(idx, 1); set("workingHoursList", u);
                          const we = [...workingHoursErrors]; we.splice(idx, 1); setWorkingHoursErrors(we);
                        }}
                        style={{ width: "28px", height: "28px", borderRadius: "50%", background: darkRed, border: "none", color: "white", fontFamily: "'Jua', sans-serif", fontSize: "0.85rem", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    )}
                  </div>
                  {workingHoursErrors[idx] && <FieldError msg={workingHoursErrors[idx]} />}
                </div>
              ))}
              {!readOnly && (
                <button type="button" onClick={() => set("workingHoursList", [...form.workingHoursList, ""])}
                  style={{ background: "none", border: `1.5px dashed ${red}`, borderRadius: "20px", color: red, width: "100%", padding: "7px", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", cursor: "pointer", fontWeight: 600 }}>
                  + Add Another Working Hours
                </button>
              )}
            </div>
          </div>

          {/* Post Expiration Date — optional. Once this date has passed,
              students can no longer apply to this post (enforced on the
              student-facing apply screen; this modal only lets the company
              set/edit the date and warns them once it's already passed). */}
          <FieldLabel>Post Expiration Date:</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ maxWidth: "220px", flex: "1 1 180px" }}>
              <input
                type="date"
                className="ojt-field"
                disabled={readOnly}
                min={getTodayStr()}
                value={form.expirationDate}
                onChange={e => { set("expirationDate", e.target.value); setErrors(p => ({ ...p, expirationDate: "" })); }}
                style={{
                  ...(readOnly ? pillInputReadonly : pillInputStyle),
                  colorScheme: "light",
                  border: errors.expirationDate ? "1.5px solid #c00" : "none",
                }}
              />
            </div>
            {form.expirationDate && isPostExpired({ expirationDate: form.expirationDate }) && (
              <span style={{ background: red, color: "white", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.68rem", padding: "3px 10px", borderRadius: "10px", whiteSpace: "nowrap" }}>
                Expired
              </span>
            )}
          </div>
          <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.7rem", color: "#888", margin: "4px 0 0" }}>
            Optional. Leave blank if this post should stay open indefinitely. Once this date has passed, students can no longer apply.
          </p>
          <FieldError msg={errors.expirationDate} />

          {/* Contact Information */}
          <FieldLabel>Contact Information:</FieldLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "2px" }}>
            <div className="post-contact-row">
              <span style={{ ...inlineLabelStyle, paddingTop: "8px" }}>Phone Number:</span>
              <div style={{ flex: 1 }}>
                <PhoneInput value={form.phone} onChange={v => { set("phone", v); setErrors(p => ({ ...p, phone: validatePhone(v) })); }} readOnly={readOnly} hasError={!!errors.phone} />
                <FieldError msg={errors.phone} />
              </div>
            </div>
            <div className="post-contact-row">
              <span style={{ ...inlineLabelStyle, paddingTop: "8px" }}>Email:</span>
              <div style={{ flex: 1 }}>
                <GmailInput value={form.contactEmail}
                  onChange={v => { set("contactEmail", v); setErrors(p => ({ ...p, contactEmail: validateGmail(v) })); }}
                  onBlur={() => { const e = validateGmail(form.contactEmail); if (e) setErrors(p => ({ ...p, contactEmail: e })); }}
                  readOnly={readOnly} error={errors.contactEmail} />
              </div>
            </div>
          </div>

          {/* Benefits */}
          <FieldLabel>Benefits:</FieldLabel>
          <textarea className="ojt-field ojt-textarea" disabled={readOnly} value={form.benefits}
            onChange={e => { set("benefits", e.target.value); setErrors(p => ({ ...p, benefits: "" })); }}
            placeholder="Enter benefits..." rows={2}
            style={{ ...(readOnly ? pillTextareaReadonly : pillTextareaStyle), border: errors.benefits ? "1.5px solid #c00" : "none" }} />
          <FieldError msg={errors.benefits} />

          {/* Industry — fixed to Account Profile's industry, not editable here */}
          <FieldLabel>Industry:</FieldLabel>
          <div style={{ ...pillInputReadonly, marginBottom: "8px", boxSizing: "border-box" }}>
            {Array.isArray(companyProfile?.industry)
              ? (companyProfile.industry.join(", ") || "—")
              : (companyProfile?.industry || user?.industry || "—")}
          </div>

          {/* College / Program required — restricted to approved departments,
              each with its own slot count */}
          <FieldLabel>College / Program required (set slots per department):</FieldLabel>
          <ApprovedDepartmentPicker
            approvedDeptSelections={approvedDeptSelections}
            selections={form.courseSelections}
            onChange={v => { set("courseSelections", v); setCourseErrors(""); }}
            readOnly={readOnly}
          />
          {courseErrors && <FieldError msg={courseErrors} />}

          {/* Skills */}
          <FieldLabel>Skills Required:</FieldLabel>
          <textarea className="ojt-field ojt-textarea" disabled={readOnly} value={form.skillsRequired}
            onChange={e => { set("skillsRequired", e.target.value); setErrors(p => ({ ...p, skillsRequired: "" })); }}
            placeholder="Enter required skills..." rows={2}
            style={{ ...(readOnly ? pillTextareaReadonly : pillTextareaStyle), border: errors.skillsRequired ? "1.5px solid #c00" : "none" }} />
          <FieldError msg={errors.skillsRequired} />
        </div>

        {/* Footer */}
        <div className="post-modal-footer" style={{ background: "#b0b0b0", display: "flex", justifyContent: "flex-end", gap: "10px", borderBottomLeftRadius: "20px", borderBottomRightRadius: "20px", flexShrink: 0 }}>
          <button onClick={handleCloseClick} style={{ padding: "10px 28px", borderRadius: "24px", background: "#555", color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>Close</button>
          {mode === "view" && !isEditing && (
            <button onClick={() => setIsEditing(true)} style={{ padding: "10px 28px", borderRadius: "24px", background: darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>Edit</button>
          )}
          {isEditing && mode !== "create" && (
            <button onClick={handleSave} style={{ padding: "10px 28px", borderRadius: "24px", background: darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>Save</button>
          )}
          {mode === "create" && (
            <button
              onClick={handleSave}
              disabled={approvedDeptSelections.length === 0}
              style={{
                padding: "10px 28px", borderRadius: "24px",
                background: approvedDeptSelections.length === 0 ? "#999" : darkRed,
                color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif",
                fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)",
                cursor: approvedDeptSelections.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Post
            </button>
          )}
        </div>
      </div>

      {showDiscardConfirm && (
        <ConfirmDiscardModal
          onKeepEditing={() => setShowDiscardConfirm(false)}
          onDiscard={() => { setShowDiscardConfirm(false); onClose(); }}
        />
      )}

      {showSaved && (
        <SavedSuccessModal onClose={() => { setShowSaved(false); onClose(); }} />
      )}
    </div>
  );
};

// ── Three-dot Menu ────────────────────────────────────────────────────────────
const menuItemStyle = {
  display: "block", width: "100%", padding: "10px 16px",
  background: "none", border: "none", textAlign: "left",
  fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem",
  cursor: "pointer", color: "#1a1a1a",
};

const ThreeDotMenu = ({ isDisabled, onView, onToggleDisable, onDelete }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={e => { e.stopPropagation(); setOpen(!open); }}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#555", padding: "4px 8px", lineHeight: 1 }}>⋮</button>
      {open && (
        <div
          style={{ position: "absolute", right: 0, top: "100%", background: "white", border: "1px solid #ddd", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", zIndex: 100, minWidth: "120px", overflow: "hidden" }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => { setOpen(false); onView(); }}             style={menuItemStyle}>View</button>
          <button onClick={() => { setOpen(false); onToggleDisable(); }}    style={menuItemStyle}>{isDisabled ? "Enable" : "Disable"}</button>
          <button onClick={() => { setOpen(false); onDelete(); }}           style={{ ...menuItemStyle, color: red, fontWeight: "700" }}>Delete</button>
        </div>
      )}
    </div>
  );
};

// ── Post OJT Content ──────────────────────────────────────────────────────────
const PostOJTContent = ({ user, openPostId, onPostOpened }) => {
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [companyProfile, setCompanyProfile] = useState({});
  // Pending Delete/Disable/Enable action awaiting the user's confirmation —
  // { type: "delete" | "disable" | "enable", post }.
  const [confirmAction, setConfirmAction] = useState(null);

  const openCreate = () => setModal({ mode: "create", post: null });
  const openView   = (post) => setModal({ mode: "view", post });
  const closeModal = () => setModal(null);

  // Auto-open a specific post's details when navigated here with a target id
  // (e.g. clicking a "Recent Post" on the dashboard).
  useEffect(() => {
    if (!openPostId) return;
    const target = posts.find(p => p.id === openPostId);
    if (target) {
      openView(target);
      onPostOpened?.();
    }
  }, [openPostId, posts, onPostOpened]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "companies", user.uid), (snap) => {
      if (snap.exists()) setCompanyProfile(snap.data());
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "ojt_posts"), where("companyId", "==", user.uid));
    const unsub = onSnapshot(q, snap => {
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loaded.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(loaded);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user?.uid]);

  const handleSave = async (formData) => {
    if (!user?.uid) return;
    // Flat college-name array derived from courseSelections — lets
    // CoordinatorFindCompanyScreen/StudentFindCompanyScreen filter posts by
    // college without needing to read into the courseSelections sub-array.
    const departments = (formData.courseSelections || []).map(s => s.college).filter(Boolean);
    // Total across all selected departments — kept alongside the per-department
    // counts in courseSelections so screens that still read a single `slot`
    // number (student/coordinator views) keep working unchanged.
    const totalSlot = (formData.courseSelections || []).reduce((sum, s) => sum + (s.slot || 1), 0);
    if (modal.mode === "create") {
      await addDoc(collection(db, "ojt_posts"), {
        ...formData,
        departments,
        slot:        totalSlot,
        companyId:   user.uid,
        companyName: companyProfile.companyName || user.companyName || "",
        industry:    companyProfile.industry    || user.industry    || "",
        location:    companyProfile.location    || user.location    || {},
        disabled:    false,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, "ojt_posts", modal.post.id), {
        ...formData,
        departments,
        slot:      totalSlot,
        industry: companyProfile.industry || user.industry || "",
        updatedAt: serverTimestamp(),
      });
    }
  };

  const toggleDisable = async (id) => {
    const post = posts.find(p => p.id === id);
    if (post) await updateDoc(doc(db, "ojt_posts", id), { disabled: !post.disabled });
  };

  const deletePost = async (id) => {
    await deleteDoc(doc(db, "ojt_posts", id));
  };

  // Opens the confirm modal for a Delete/Disable/Enable request instead of
  // acting immediately — the actual write only happens once the user confirms.
  const requestToggleDisable = (post) => setConfirmAction({ type: post.disabled ? "enable" : "disable", post });
  const requestDelete        = (post) => setConfirmAction({ type: "delete", post });

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    const { type, post } = confirmAction;
    setConfirmAction(null);
    if (type === "delete") await deletePost(post.id);
    else await toggleDisable(post.id);
  };

  return (
    <div className="post-screen-padding" style={{ overflowY: "auto", flex: 1 }}>
      <div style={{ background: "#e0e0e0", borderRadius: "16px", padding: "18px 20px", minHeight: "80vh" }}>

        <div className="post-header-row">
          <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: "400", margin: 0, color: "#1a1a1a" }}>
            Recent Post
          </h2>
          <button
            className="post-btn"
            onClick={openCreate}
            style={{ background: darkRed, color: "white", border: "none", borderRadius: "24px", fontFamily: "'Jersey 25', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            Post <span>+</span>
          </button>
        </div>

        <hr style={{ border: "none", borderTop: "2px solid #aaa", marginBottom: "16px" }} />

        {posts.length > 0 ? (
          <div className="post-grid">
            {posts.map(post => {
              const expired = isPostExpired(post);
              return (
                <div
                  key={post.id}
                  onClick={() => !post.disabled && openView(post)}
                  style={{
                    background: post.disabled ? "#b8b8b8" : "white",
                    borderRadius: "14px", padding: "14px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    cursor: post.disabled ? "default" : "pointer",
                    boxShadow: post.disabled ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
                    opacity: post.disabled ? 0.75 : (expired ? 0.85 : 1),
                    border: post.disabled ? "none" : (expired ? `1.5px solid ${red}` : "1.5px solid #e8e8e8"),
                    minWidth: 0,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <p style={{
                        fontFamily: "'Jersey 25', sans-serif",
                        fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)",
                        margin: "0 0 4px", color: post.disabled ? "#666" : "#1a1a1a",
                        fontWeight: "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {post.companyName || post.company || "Unnamed Company"}
                      </p>
                      {!post.disabled && expired && (
                        <span style={{ background: red, color: "white", fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.62rem", padding: "2px 8px", borderRadius: "10px", whiteSpace: "nowrap", marginBottom: "4px" }}>
                          Expired
                        </span>
                      )}
                    </div>
                    <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", margin: 0, color: "#888" }}>
                      {post.industry || post.subtitle || (post.courseSelections?.[0] ? post.courseSelections[0].college : "OJT Post")}
                    </p>
                  </div>
                  <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                    <ThreeDotMenu
                      isDisabled={post.disabled}
                      onView={() => openView(post)}
                      onToggleDisable={() => requestToggleDisable(post)}
                      onDelete={() => requestDelete(post)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80px" }}>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1rem", color: "#aaa" }}>No posts yet.</p>
          </div>
        )}
      </div>

      {modal && (
        <PostFormModal
          post={modal.post}
          mode={modal.mode}
          onClose={closeModal}
          onSave={handleSave}
          user={user}
          companyProfile={companyProfile}
        />
      )}

      {confirmAction && (
        <ConfirmActionModal
          title={
            confirmAction.type === "delete"  ? "Delete this post?" :
            confirmAction.type === "disable" ? "Disable this post?" :
                                                "Enable this post?"
          }
          message={
            confirmAction.type === "delete"
              ? "This post will be permanently removed and can't be recovered. Are you sure you want to delete it?"
              : confirmAction.type === "disable"
              ? "Students won't be able to see or apply to this post while it's disabled. You can enable it again anytime."
              : "This post will become visible to students again. Continue?"
          }
          confirmLabel={
            confirmAction.type === "delete"  ? "Yes, Delete"  :
            confirmAction.type === "disable" ? "Yes, Disable" :
                                                "Yes, Enable"
          }
          danger={confirmAction.type === "delete"}
          onCancel={() => setConfirmAction(null)}
          onConfirm={runConfirmedAction}
        />
      )}
    </div>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
const CompanyCreatePostScreen = ({ embedded = false, user, openPostId, onPostOpened }) => (
  <>
    <GlobalFonts />
    <ResponsiveStyles />
    {embedded
      ? <PostOJTContent user={user} openPostId={openPostId} onPostOpened={onPostOpened} />
      : (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f0f0f0" }}>
          <PostOJTContent user={user} openPostId={openPostId} onPostOpened={onPostOpened} />
        </div>
      )
    }
  </>
);

export default CompanyCreatePostScreen;