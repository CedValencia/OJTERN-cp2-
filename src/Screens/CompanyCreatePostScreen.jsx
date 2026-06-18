import React, { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const black   = "#000000";
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

    /* Post modal: full screen on mobile */
    .post-modal-inner {
      width: 640px;
      max-width: 100%;
    }
    @media (max-width: 680px) {
      .post-modal-inner {
        width: 100%;
        border-radius: 14px;
        max-height: 95vh;
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

    /* Description + map row: side-by-side on desktop, stacked on mobile */
    .post-desc-row {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    @media (max-width: 480px) {
      .post-desc-row { flex-direction: column; }
    }

    /* Map box: fixed on desktop, full width on mobile */
    .post-map-box {
      width: 130px;
      height: 148px;
      flex-shrink: 0;
      margin-top: 30px;
    }
    @media (max-width: 480px) {
      .post-map-box { width: 100%; height: 80px; margin-top: 0; }
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
      .post-modal-overlay { align-items: flex-start; padding: 8px; }
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
    color: black,
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

// ── Multi-College Program Picker ──────────────────────────────────────────────
const COLLEGE_PROGRAM_DATA = {
  "College of Computer Studies":           { programs: ["BSIT"] },
  "College of Business and Accountancy":   { programs: ["BSBA (Major in Marketing Management)", "BSA"] },
  "College of Education":                  { programs: ["BSED (Major in English)", "BSED (Major in Mathematics)", "BEED (Generalist)"] },
  "College of Criminal Justice Education": { programs: ["BS Crim"] },
  "College of Hospitality Management":     { programs: ["BSTM", "BSHM"] },
  "College of Liberal Arts":               { programs: ["BA Pol Sci"] },
};

const MultiCollegeProgramPicker = ({ selections, onChange, readOnly, errors }) => {
  const colleges = Object.keys(COLLEGE_PROGRAM_DATA);

  const addEntry    = () => onChange([...selections, { college: "", program: "", specialization: "" }]);
  const removeEntry = (idx) => onChange(selections.filter((_, i) => i !== idx));
  const updateEntry = (idx, field, value) => {
    const updated = selections.map((entry, i) => {
      if (i !== idx) return entry;
      if (field === "college") return { college: value, program: "", specialization: "" };
      if (field === "program") return { ...entry, program: value, specialization: "" };
      return { ...entry, [field]: value };
    });
    onChange(updated);
  };

  return (
    <div>
      {selections.map((entry, idx) => {
        const programs = COLLEGE_PROGRAM_DATA[entry.college]?.programs || [];
        const err = errors?.[idx];
        return (
          <div key={idx} style={{ background: "#ececec", borderRadius: "14px", padding: "10px 12px", marginBottom: "8px" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: entry.college ? "6px" : "0" }}>
              <div style={{ flex: 1 }}>
                <PillSelect value={entry.college} onChange={v => updateEntry(idx, "college", v)} options={colleges} placeholder="Select College" disabled={readOnly} hasError={err?.college} />
                {err?.college && <FieldError msg="College is required." />}
              </div>
              {!readOnly && selections.length > 1 && (
                <button type="button" onClick={() => removeEntry(idx)}
                  style={{ width: "28px", height: "28px", borderRadius: "50%", background: darkRed, border: "none", color: "white", fontFamily: "'Jua', sans-serif", fontSize: "0.85rem", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              )}
            </div>
            {entry.college && (
              <div>
                <PillSelect value={entry.program} onChange={v => updateEntry(idx, "program", v)} options={programs} placeholder="Select Program" disabled={readOnly} hasError={err?.program} />
                {err?.program && <FieldError msg="Program is required." />}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <button onClick={addEntry} style={{ background: "none", border: `1.5px dashed ${red}`, borderRadius: "20px", color: red, width: "100%", padding: "7px", fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", cursor: "pointer", marginTop: "2px", fontWeight: 600 }}>
          + Add Another College / Program
        </button>
      )}
    </div>
  );
};

// ── Working Hours pattern ─────────────────────────────────────────────────────
const workingHoursPattern = /^([A-Za-z\s]+(\s?-\s?[A-Za-z\s]+)?)\s\(\d{1,2}:\d{2}(am|pm)\s-\s\d{1,2}:\d{2}(am|pm)\)$/i;

// ── Working Hours Input ───────────────────────────────────────────────────────
const WorkingHoursInput = ({ value, onChange, readOnly, hasError }) => {
  const handleChange = (e) => {
    let v = e.target.value;
    const parenIdx = v.indexOf("(");
    if (parenIdx === -1) { onChange(v); return; }
    const dayPart  = v.slice(0, parenIdx);
    let timePart   = v.slice(parenIdx + 1).replace(/\)/g, "");
    timePart = timePart.replace(/[^0-9apm:\-\s]/gi, "");
    onChange(dayPart + "(" + timePart + (timePart.length > 0 ? ")" : ""));
  };
  const handleBlur = () => {
    if (value && value.includes("(") && !value.includes(")")) onChange(value + ")");
  };
  return (
    <input className="ojt-field" type="text" disabled={readOnly}
      placeholder="Monday - Friday (8:00am - 5:00pm)"
      value={value} onChange={handleChange} onBlur={handleBlur}
      style={{ ...(readOnly ? pillInputReadonly : pillInputStyle), border: hasError ? "1.5px solid #c00" : "none" }} />
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

// ── Post Form Modal ───────────────────────────────────────────────────────────
const PostFormModal = ({ post, mode, onClose, onSave, user }) => {
  const [isEditing, setIsEditing] = useState(mode === "create" || mode === "edit");

  const [form, setForm] = useState({
    benefits:         post?.benefits         || "",
    courseSelections: post?.courseSelections || [{ college: "", program: "", specialization: "" }],
    skillsRequired:   post?.skillsRequired   || "",
    description:      post?.description      || "",
    requirements:     post?.requirements     || "",
    workingHoursList: post?.workingHoursList || [post?.workingHours || ""],
    slot:             post?.slot ?? 1,
    phone:            post?.phone || "+63 ",
    contactEmail:     post?.contactEmail || "",
  });

  const [errors, setErrors]                         = useState({});
  const [courseErrors, setCourseErrors]             = useState([]);
  const [workingHoursErrors, setWorkingHoursErrors] = useState([]);
  const readOnly = !isEditing;

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const validateGmail = (val) => {
    if (!val || !val.trim()) return "Email is required.";
    if (!val.toLowerCase().endsWith("@gmail.com")) return "Email must end with @gmail.com";
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
    if (form.slot <= 0)              newErrors.slot           = "Slot must be at least 1.";

    const emailErr = validateGmail(form.contactEmail);
    if (emailErr) newErrors.contactEmail = emailErr;

    const newWhErrors = form.workingHoursList.map(h => {
      if (!h.trim()) return "Working hours is required.";
      if (!workingHoursPattern.test(h.trim())) return "Format: Monday - Friday (8:00am - 5:00pm)";
      return "";
    });
    setWorkingHoursErrors(newWhErrors);
    const hasWhError = newWhErrors.some(e => e);

    const newCourseErrors = form.courseSelections.map(entry => {
      const err = {};
      if (!entry.college) err.college = true;
      if (entry.college && !entry.program) err.program = true;
      return err;
    });
    setCourseErrors(newCourseErrors);
    const hasCourseError = newCourseErrors.some(e => Object.keys(e).length > 0);

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0 || hasWhError || hasCourseError) return;

    onSave({ ...form, workingHours: form.workingHoursList.join(", ") });
    onClose();
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

          {/* Description + map row */}
          <div className="post-desc-row">
            <div style={{ flex: 1, minWidth: 0 }}>
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

            {/* Map placeholder */}
            <div className="post-map-box" style={{ borderRadius: "16px", background: "#c8d8e8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1.5px dashed #aaa" }}>
              <span style={{ fontSize: "1.8rem" }}>🗺️</span>
            </div>
          </div>

          {/* Working Hours + Slot */}
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

            {/* Slot */}
            <div className="post-slot-col" style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <FieldLabel>Slot:</FieldLabel>
              <input className="ojt-field" type="number" disabled={readOnly} min={1} value={form.slot}
                onChange={e => { set("slot", Math.max(1, parseInt(e.target.value) || 1)); setErrors(p => ({ ...p, slot: "" })); }}
                style={{ ...(readOnly ? pillInputReadonly : pillInputStyle), width: "70px", textAlign: "center", fontSize: "1rem", padding: "7px 6px", border: errors.slot ? "1.5px solid #c00" : "none" }} />
              <FieldError msg={errors.slot} />
            </div>
          </div>

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

          {/* College / Program / Major */}
          <FieldLabel>College / Program / Major:</FieldLabel>
          <MultiCollegeProgramPicker
            selections={form.courseSelections}
            onChange={v => { set("courseSelections", v); setCourseErrors([]); }}
            readOnly={readOnly}
            errors={courseErrors}
          />

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
          <button onClick={onClose} style={{ padding: "10px 28px", borderRadius: "24px", background: "#555", color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>Close</button>
          {mode === "view" && !isEditing && (
            <button onClick={() => setIsEditing(true)} style={{ padding: "10px 28px", borderRadius: "24px", background: darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>Edit</button>
          )}
          {isEditing && mode !== "create" && (
            <button onClick={handleSave} style={{ padding: "10px 28px", borderRadius: "24px", background: darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>Save</button>
          )}
          {mode === "create" && (
            <button onClick={handleSave} style={{ padding: "10px 28px", borderRadius: "24px", background: darkRed, color: "white", border: "none", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>Post</button>
          )}
        </div>
      </div>
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
const PostOJTContent = ({ user }) => {
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [companyProfile, setCompanyProfile] = useState({});

  const openCreate = () => setModal({ mode: "create", post: null });
  const openView   = (post) => setModal({ mode: "view", post });
  const closeModal = () => setModal(null);

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
    if (modal.mode === "create") {
      await addDoc(collection(db, "ojt_posts"), {
        ...formData,
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
            {posts.map(post => (
              <div
                key={post.id}
                onClick={() => !post.disabled && openView(post)}
                style={{
                  background: post.disabled ? "#b8b8b8" : "white",
                  borderRadius: "14px", padding: "14px 16px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: post.disabled ? "default" : "pointer",
                  boxShadow: post.disabled ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
                  opacity: post.disabled ? 0.75 : 1,
                  border: post.disabled ? "none" : "1.5px solid #e8e8e8",
                  minWidth: 0,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily: "'Jersey 25', sans-serif",
                    fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)",
                    margin: "0 0 4px", color: post.disabled ? "#666" : "#1a1a1a",
                    fontWeight: "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {post.companyName || post.company || "Unnamed Company"}
                  </p>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", margin: 0, color: "#888" }}>
                    {post.industry || post.subtitle || (post.courseSelections?.[0] ? post.courseSelections[0].college : "OJT Post")}
                  </p>
                </div>
                <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                  <ThreeDotMenu
                    isDisabled={post.disabled}
                    onView={() => openView(post)}
                    onToggleDisable={() => toggleDisable(post.id)}
                    onDelete={() => deletePost(post.id)}
                  />
                </div>
              </div>
            ))}
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
        />
      )}
    </div>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
const CompanyCreatePostScreen = ({ embedded = false, user }) => (
  <>
    <GlobalFonts />
    <ResponsiveStyles />
    {embedded
      ? <PostOJTContent user={user} />
      : (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f0f0f0" }}>
          <PostOJTContent user={user} />
        </div>
      )
    }
  </>
);

export default CompanyCreatePostScreen;