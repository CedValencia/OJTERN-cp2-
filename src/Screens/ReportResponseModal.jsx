import React, { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { uploadFileToFolder } from "./CloudinaryService";
import { color, font, type, space, radius, ease } from "./theme";

// ── Report response ───────────────────────────────────────────────────────────
// Opened by a COMPANY or a STUDENT from the notification a coordinator's
// decision creates. The reported party writes what they did about it and
// (depending on the action) attaches proof; the coordinator then reviews that
// on the report itself before closing it.
//
// Attachment rules, per action:
//   Warning Issued      — description required, attachment optional
//   Require Correction  — description required, attachment REQUIRED
//   Others              — description required, attachment optional
// Suspend/Block don't get a form at all: those accounts can't sign in to fill
// one in, so nothing here should ask them to.
export const RESPONDABLE_ACTIONS = ["Warning Issued", "Require Correction", "Others"];

export const responseRequirements = (action) => {
  const name = String(action || "").trim();
  if (name === "Require Correction") {
    return {
      needsResponse: true,
      fileRequired: true,
      title: "Submit your correction",
      intro: "Describe what you corrected and attach a photo or file showing the change. Your coordinator reviews this before closing the report.",
    };
  }
  if (name === "Warning Issued") {
    return {
      needsResponse: true,
      fileRequired: false,
      title: "Respond to this warning",
      intro: "Describe how you've addressed this. You can attach a photo or file, but it isn't required.",
    };
  }
  // Anything a coordinator typed under "Others".
  return {
    needsResponse: true,
    fileRequired: false,
    title: "Respond to this action",
    intro: "Describe what you did about this. You can attach a photo or file, but it isn't required.",
  };
};

const RESPONSE_DESCRIPTION_MAX = 1500;
const MAX_FILE_MB = 10;
const ACCEPTED = "image/png,image/jpeg,image/jpg,application/pdf";

const ReportResponseModal = ({ notification, responderId, responderRole, responderName, onClose, onSubmitted }) => {
  const action = notification?.action || notification?.resolutionAction || "Others";
  const reqs = responseRequirements(action);

  const [description, setDescription] = useState("");
  const [file, setFile]               = useState(null);
  const [error, setError]             = useState("");
  const [saving, setSaving]           = useState(false);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // so picking the same file twice still fires
    if (!f) return;
    if (!ACCEPTED.split(",").includes(f.type)) {
      setError("Attach a PNG, JPG, or PDF file.");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That file is over ${MAX_FILE_MB}MB. Attach a smaller one.`);
      return;
    }
    setError("");
    setFile(f);
  };

  const handleSubmit = async () => {
    if (saving) return;
    const text = description.trim();
    if (!text) { setError("Describe what you did about this."); return; }
    if (reqs.fileRequired && !file) { setError("Attach a photo or file showing the correction."); return; }
    if (!notification?.reportId) { setError("This notice isn't linked to a report. Contact your coordinator."); return; }

    setSaving(true);
    setError("");
    try {
      let uploaded = null;
      if (file) {
        uploaded = await uploadFileToFolder(file, "report_responses");
      }
      await updateDoc(doc(db, "reports", notification.reportId), {
        correctionResponse: {
          action,
          description:  text,
          attachedFile: uploaded ? { name: uploaded.name || file.name, url: uploaded.url, type: file.type } : null,
          submittedBy:   responderId || "",
          submittedRole: responderRole || "",
          submittedName: responderName || "",
          submittedAt:   new Date().toISOString(),
        },
        correctionSubmittedAt: serverTimestamp(),
      });
      onSubmitted?.();
      onClose?.();
    } catch (err) {
      console.error("Failed to submit the report response:", err);
      setError(err?.code === "permission-denied"
        ? "You're not allowed to respond to this report. Contact your coordinator."
        : "That didn't send. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    width: "100%", boxSizing: "border-box", padding: "10px 14px",
    borderRadius: radius.card, border: `1px solid ${error && !description.trim() ? color.danger : color.wine700}`,
    fontFamily: font.ui, fontSize: "0.9rem", color: color.ink, outline: "none",
    background: color.white, resize: "vertical", minHeight: "110px",
  };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 4000, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="rr-title" style={{
        width: "100%", maxWidth: "460px", maxHeight: "calc(100vh - 32px)", overflowY: "auto",
        background: color.white, borderRadius: radius.card, fontFamily: font.ui,
        boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
      }}>
        <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${color.wine700}` }}>
          <h3 id="rr-title" style={{ ...type.label, fontSize: "1.05rem", color: color.ink, margin: 0, fontWeight: 650 }}>
            {reqs.title}
          </h3>
          <p style={{ ...type.helper, color: color.inkMuted, margin: "6px 0 0", lineHeight: 1.6 }}>{reqs.intro}</p>
        </div>

        <div style={{ padding: "16px 20px", display: "grid", gap: space.sm }}>
          {notification?.message && (
            <div style={{ background: color.wine900, border: `1px solid ${color.wine700}`, borderRadius: radius.card, padding: "10px 12px" }}>
              <p style={{ ...type.helper, color: color.inkMuted, margin: 0, lineHeight: 1.6, overflowWrap: "anywhere" }}>
                {notification.message}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="rr-desc" style={{ ...type.helper, color: color.inkMuted, display: "block", marginBottom: "4px" }}>
              What did you do about this? <span style={{ color: color.danger }}>*</span>
            </label>
            <textarea
              id="rr-desc"
              value={description}
              onChange={e => { setDescription(e.target.value.slice(0, RESPONSE_DESCRIPTION_MAX)); setError(""); }}
              placeholder="Describe the action you took…"
              maxLength={RESPONSE_DESCRIPTION_MAX}
              disabled={saving}
              style={fieldStyle}
            />
              <p style={{ fontSize: "0.7rem", color: "#8a8a8a", textAlign: "right", margin: "4px 0 0" }}>{(description || "").length}/{RESPONSE_DESCRIPTION_MAX}</p>
          </div>

          <div>
            <label style={{ ...type.helper, color: color.inkMuted, display: "block", marginBottom: "4px" }}>
              Proof {reqs.fileRequired ? <span style={{ color: color.danger }}>*</span> : <span>(optional)</span>}
            </label>
            <input id="rr-file" type="file" accept={ACCEPTED} onChange={pickFile} disabled={saving} style={{ display: "none" }} />
            <label htmlFor="rr-file" style={{
              display: "inline-block", padding: "9px 16px", borderRadius: radius.pill,
              border: `1px dashed ${color.wine400}`, color: color.inkBody, cursor: saving ? "not-allowed" : "pointer",
              ...type.control, transition: `background 160ms ${ease}`,
            }}>
              {file ? "Choose a different file" : "Attach photo or file"}
            </label>
            {file && (
              <p style={{ ...type.helper, color: color.ink, margin: "8px 0 0", overflowWrap: "anywhere" }}>
                {file.name}{" "}
                <button type="button" onClick={() => setFile(null)} disabled={saving}
                  style={{ background: "none", border: "none", color: color.danger, cursor: "pointer", textDecoration: "underline", fontFamily: font.ui, ...type.helper }}>
                  remove
                </button>
              </p>
            )}
            <p style={{ ...type.helper, color: color.inkMuted, margin: "6px 0 0" }}>PNG, JPG or PDF, up to {MAX_FILE_MB}MB.</p>
          </div>

          {error && (
            <p role="alert" style={{ ...type.helper, color: color.danger, margin: 0, lineHeight: 1.5 }}>{error}</p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "0 20px 18px" }}>
          <button onClick={onClose} disabled={saving} style={{
            background: color.white, color: color.ink, border: `1px solid ${color.wine700}`,
            borderRadius: radius.pill, padding: "9px 16px", cursor: saving ? "not-allowed" : "pointer",
            fontFamily: font.ui, ...type.control,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            background: color.ink, color: color.white, border: `1px solid ${color.ink}`,
            borderRadius: radius.pill, padding: "9px 20px", cursor: saving ? "not-allowed" : "pointer",
            fontFamily: font.ui, ...type.control, opacity: saving ? 0.7 : 1,
          }}>{saving ? "Sending…" : "Submit"}</button>
        </div>
      </div>
    </div>
  );
};

export default ReportResponseModal;