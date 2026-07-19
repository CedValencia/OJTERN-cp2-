import React, { useState } from "react";
import { registerCompany } from "./AuthService";
import { uploadFiles }    from "./CloudinaryService";


const darkRed = "#320000";
const red = "#8B0000";

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&display=swap');
    * { box-sizing: border-box; }

    /* ── Outer wrapper ── */
    .su2-wrapper {
      width: 100%;
      max-width: 370px;
      margin: 0 auto;
      padding: 0 12px;
    }
    @media (max-width: 400px) {
      .su2-wrapper { padding: 0 6px; }
    }

    /* ── Title ── */
    .su2-title {
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
      .su2-title { font-size: 2rem; margin-bottom: 14px; }
    }

    /* ── Card border ── */
    .su2-card {
      border: 2px solid #1a1a1a;
      border-radius: 24px;
      overflow: hidden;
      position: relative;
    }

    /* ── Card header ── */
    .su2-card-header {
      background: ${red};
      padding: 14px;
      text-align: center;
    }
    @media (max-width: 360px) {
      .su2-card-header { padding: 10px; }
      .su2-card-header span { font-size: 1.1rem !important; }
    }

    /* ── Scrollable form body ── */
    .su2-form-body {
      padding: 16px 24px 24px;
      background: white;
      max-height: 65vh;
      overflow-y: auto;
      overflow-x: hidden;
    }
    @media (max-width: 400px) {
      .su2-form-body { padding: 12px 14px 18px; }
    }

    /* ── Notice banner ── */
    .su2-notice {
      background: #888;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 14px;
      text-align: center;
    }
    @media (max-width: 360px) {
      .su2-notice { padding: 10px 10px; }
    }

    /* ── Drop zone ── */
    .su2-dropzone {
      border-radius: 12px;
      padding: 20px 16px;
      text-align: center;
      margin-bottom: 10px;
      transition: all 0.2s;
    }
    @media (max-width: 360px) {
      .su2-dropzone { padding: 14px 10px; }
    }

    /* ── File list modal overlay ── */
    .su2-modal-overlay {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 999;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }

    .su2-modal-inner {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 300px;
      max-height: 88%;
      overflow-y: auto;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    }
    @media (max-width: 360px) {
      .su2-modal-inner { padding: 12px; width: 95%; }
    }

    /* ── Bottom action row ── */
    .su2-action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 10px;
    }
    @media (max-width: 360px) {
      .su2-action-row { flex-direction: column; gap: 8px; }
      .su2-action-row button { width: 100%; }
    }

    /* ── Action buttons ── */
    .su2-btn {
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
      .su2-btn { padding: 10px 22px; font-size: 0.95rem; }
    }

    /* ── File row ── */
    .su2-file-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f9f9f9;
      border-radius: 8px;
      padding: 8px 12px;
      border: 1px solid #eee;
    }
    .su2-file-name {
      font-family: 'Kufam', sans-serif;
      font-size: 0.8rem;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 80%;
    }
    @media (max-width: 360px) {
      .su2-file-name { font-size: 0.72rem; }
    }

    /* ── Terms & Conditions modal ── */
    .su2-terms-inner {
      background: white;
      border-radius: 16px;
      width: 88%;
      max-width: 280px;
      max-height: 88%;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      overflow: hidden;
    }
    @media (max-width: 360px) {
      .su2-terms-inner { width: 92%; max-height: 85%; }
    }

    .su2-terms-header {
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .su2-terms-scroll {
      padding: 12px 16px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1 1 auto;
    }
    @media (max-width: 360px) {
      .su2-terms-scroll { padding: 10px 12px; }
    }

    .su2-terms-scroll h3 {
      font-family: 'Jua', sans-serif;
      font-size: 0.82rem;
      color: #1a1a1a;
      margin: 10px 0 4px;
    }
    .su2-terms-scroll h3:first-child { margin-top: 0; }
    .su2-terms-scroll p {
      font-family: 'Kufam', sans-serif;
      font-size: 0.72rem;
      color: #444;
      line-height: 1.5;
      margin: 0 0 8px;
    }

    .su2-terms-footer {
      padding: 10px 16px;
      border-top: 1px solid #eee;
      flex-shrink: 0;
      background: white;
    }
  `}</style>
);

// ── Terms & Conditions content (placeholder — replace with OJTern's actual policy) ──
const TermsContent = () => (
  <>
    <h3>1. Acceptance of Terms</h3>
    <p>
      By registering and maintaining a Company account on OJTern — the On-the-Job Training Management Platform of Dominican College of Tarlac, Inc. ("the School") — you agree to be bound by these Terms and Conditions and the School's Privacy Policy.
      Electronic acceptance of these Terms has the same legal effect as a handwritten signature.
      If you do not agree, please discontinue use of the Platform.
    </p>

    <h3>2. Company Registration and Verification</h3>
    <p>
      Companies register through the Platform's self-registration process and must provide truthful organizational information.
      Each Company selects an industry classification, which determines the Coordinator(s) responsible for reviewing the application.
      Your account remains in Pending status until reviewed and approved by the assigned Coordinator(s), based on the School's partnership, accreditation, and administrative requirements.
      Pending or rejected accounts may not log in or access internship-related features until officially approved, and the School reserves the right to reject any registration that does not meet these requirements.
    </p>

    <h3>3. Use of the Platform</h3>
    <p>
      Your Company account may only be used to post legitimate internship opportunities, communicate with students and Coordinators, and manage OJT-related processes.
      Approved Companies are expected to maintain accurate company information, provide lawful internship opportunities, comply with the School's OJT policies, and treat students professionally and fairly.
      Misuse of the Platform — including posting misleading opportunities, harassing Users, submitting false information, or attempting to bypass verification requirements — may result in suspension or termination of your account.
    </p>

    <h3>4. Data Privacy</h3>
    <p>
      The School collects and processes Personal Information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).
      Only information reasonably necessary for internship placement is shared with your Company — such as a student's name, program, contact information, resume, and application status — and it is provided solely for legitimate OJT administration.
      Any student or applicant data you access through the Platform must be kept confidential and used only for the intended OJT process; it must never be shared, sold, or repurposed.
      The Platform uses secure cloud-based services and reasonable safeguards to protect this information against unauthorized access, alteration, disclosure, or destruction.
    </p>

    <h3>5. Account Responsibility</h3>
    <p>
      You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account, including postings and messages sent by any representative you authorize to use it.
      Passwords should be kept confidential, never shared, and changed immediately if a breach is suspected.
      Notify the School or Platform administrator right away of any unauthorized access.
      The School or an authorized Coordinator may suspend, deactivate, or terminate your account for violation of these Terms, submission of false information, or conduct that threatens the integrity or security of the Platform; a rejected or revoked Company account loses access to internship-related services.
    </p>

    <h3>6. Changes to These Terms</h3>
    <p>
      The School reserves the right to modify these Terms at any time.
      Material changes will be communicated through the Platform or via your registered email address.
      Continued use of the Platform after changes take effect constitutes acceptance of the revised Terms.
    </p>

    <h3>7. Contact</h3>
    <p>
      For questions, concerns, or requests regarding these Terms or your Personal Information, please contact the School through your assigned OJT Coordinator or the official support channel.
    </p><p style={{ fontFamily: "'Jua', sans-serif", color: "#1a1a1a" }}>Email: support@ojtern.com</p>
  </>
);

// Props:
//   onBack               — navigate back to SignUpStep1
//   onGoSignIn           — navigate to SignIn
//   onSubmitSuccess      — called after successful Firebase registration
//   step1Data            — form data from Step 1 { companyName, industry,
//                          location, email, password }
const SignUpStep2Screen = ({ onBack, onGoSignIn, onSubmitSuccess, step1Data }) => {
  const [agreed, setAgreed]         = useState(false);
  const [dragging, setDragging]     = useState(false);
  const [files, setFiles]           = useState([]);
  const [error, setError]           = useState("");
  const [expanded, setExpanded]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTerms, setShowTerms]   = useState(false);

  const MAX_TOTAL_MB = 10;
  const MAX_BYTES    = MAX_TOTAL_MB * 1024 * 1024;

  const addFiles = (newFiles) => {
    const validTypes = ["application/pdf", "image/png"];
    const filtered   = Array.from(newFiles).filter(f => validTypes.includes(f.type));
    if (filtered.length !== Array.from(newFiles).length) {
      setError("Only PDF and PNG files are allowed.");
      return;
    }
    const combined  = [...files, ...filtered];
    const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_BYTES) {
      setError("Total file size exceeds 10MB limit.");
      return;
    }
    setError("");
    setFiles(combined);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleBrowse = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setError("");
  };

  // ── Terms & Conditions modal handlers ─────────────────────────────────────
  const openTerms = () => setShowTerms(true);

  const handleCheckboxClick = () => {
    if (agreed) {
      // allow unchecking directly without re-reading the terms
      setAgreed(false);
    } else {
      setShowTerms(true);
    }
  };

  const handleAgreeTerms = () => {
    setAgreed(true);
    setShowTerms(false);
    setError("");
  };

  // ── Submit: upload docs → Firebase Auth → Firestore ──────────────────────
  const handleSubmit = async () => {
    if (!agreed) {
      setError("You must agree to the privacy policy before submitting.");
      return;
    }
    if (files.length === 0) {
      setError("Please upload at least one verification document.");
      return;
    }
    if (!step1Data) {
      setError("Step 1 data is missing. Please go back and try again.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // 1. Upload all files to Cloudinary
      const uploadedUrls = await uploadFiles(files);

      // 2. Register via AuthService (creates Auth user + Firestore doc)
      await registerCompany(step1Data, uploadedUrls);

      onSubmitSuccess();
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in instead.");
      } else {
        setError(err.message || "Submission failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalSize  = files.reduce((sum, f) => sum + f.size, 0);
  const totalMB    = (totalSize / (1024 * 1024)).toFixed(2);
  const isOverLimit = totalSize > MAX_BYTES;

  return (
    <>
      <ResponsiveStyles />
      <div className="su2-wrapper">
        <h1 className="su2-title">
          Hi, Sign Up<br />Now!
        </h1>

        <div className="su2-card">
          {/* Header */}
          <div className="su2-card-header">
            <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "1.4rem", color: "white", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Sign-Up
            </span>
          </div>

          {/* Form body */}
          <div className="su2-form-body">
            <p style={{ fontFamily: "'Jua', sans-serif", textAlign: "center", fontSize: "0.88rem", color: "#555", marginBottom: "2px" }}>Step 2 of 2</p>
            <p style={{ fontFamily: "'Jua', sans-serif", textAlign: "center", fontSize: "1.05rem", fontWeight: "700", color: "#1a1a1a", marginBottom: "10px" }}>Proof of Verification</p>

            <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "14px" }} />

            {/* Notice banner */}
            <div className="su2-notice">
              <p style={{ fontFamily: "'Jua', sans-serif", fontSize: "1rem", color: "white", fontWeight: "500", marginBottom: "4px" }}>
                Document Verification Required
              </p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "white", lineHeight: 1.5, margin: 0 }}>
                Upload valid proof documents (e.g. BIR Certificate, SEC Registration, DTI Permit, or Business Permit) to verify your company's legitimacy.
              </p>
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "red", marginBottom: "8px", textAlign: "center" }}>
                ⚠️ {error}
              </p>
            )}

            {/* Drop zone */}
            <div
              className="su2-dropzone"
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragging ? red : isOverLimit ? "red" : "#ccc"}`,
                background: dragging ? "#fff0f0" : "#f9f9f9",
              }}
            >
              <p style={{ fontFamily: "'Jua', sans-serif", fontSize: "0.95rem", color: "#1a1a1a", marginBottom: "6px" }}>
                Drag & drop Files here
              </p>
              <label style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#555", textDecoration: "underline", cursor: "pointer" }}>
                or browse to upload
                <input type="file" accept=".pdf,.png" multiple onChange={handleBrowse} style={{ display: "none" }} />
              </label>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: red, marginTop: "6px", marginBottom: 0 }}>
                PDF, PNG - max 10MB total
              </p>
            </div>

            {/* File list header */}
            {files.length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#f0f0f0", borderRadius: "10px 10px 0 0",
                  padding: "8px 12px", borderBottom: "1px solid #ddd",
                }}>
                  <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "0.85rem", color: "#333" }}>
                    📁 {files.length} file{files.length > 1 ? "s" : ""} attached
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: isOverLimit ? "red" : "#555" }}>
                      {totalMB} MB / 10 MB {isOverLimit ? "⚠️" : "✅"}
                    </span>
                    <span
                      onClick={() => setExpanded(prev => !prev)}
                      style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: red, textDecoration: "underline", cursor: "pointer" }}
                    >
                      {expanded ? "Hide ▲" : "View all ▼"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* File modal overlay */}
            {expanded && (
              <div className="su2-modal-overlay">
                <div className="su2-modal-inner">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                    <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "1rem", color: "#1a1a1a" }}>
                      📁 Attached Files ({files.length})
                    </span>
                    <span
                      onClick={() => setExpanded(false)}
                      style={{ cursor: "pointer", color: "white", background: red, borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "0.9rem", flexShrink: 0 }}
                    >
                      ✕
                    </span>
                  </div>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: isOverLimit ? "red" : "#555", marginBottom: "10px", textAlign: "right" }}>
                    Total: {totalMB} MB / 10 MB {isOverLimit ? "⚠️ Over limit!" : "✅"}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto" }}>
                    {files.map((file, index) => (
                      <div key={index} className="su2-file-row">
                        <span className="su2-file-name">
                          📄 {file.name}{" "}
                          <span style={{ color: "#888" }}>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                        </span>
                        <span
                          onClick={() => removeFile(index)}
                          style={{ cursor: "pointer", color: "red", fontWeight: "700", fontSize: "1rem", marginLeft: "8px", flexShrink: 0 }}
                        >
                          ✕
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Terms & Conditions modal overlay */}
            {showTerms && (
              <div className="su2-modal-overlay" onClick={() => setShowTerms(false)}>
                <div className="su2-terms-inner" onClick={(e) => e.stopPropagation()}>
                  <div className="su2-terms-header">
                    <span style={{ fontFamily: "'Jua', sans-serif", fontSize: "1rem", color: "#1a1a1a" }}>
                      Terms and Conditions & Privacy Policy
                    </span>
                    <span
                      onClick={() => setShowTerms(false)}
                      style={{ cursor: "pointer", color: "white", background: red, borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "0.9rem", flexShrink: 0 }}
                    >
                      ✕
                    </span>
                  </div>
                  <div className="su2-terms-scroll">
                    <TermsContent />
                  </div>
                  <div className="su2-terms-footer">
                    <button
                      onClick={handleAgreeTerms}
                      className="su2-btn"
                      style={{ width: "100%" }}
                    >
                      I Agree
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Checkbox */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <div
                onClick={handleCheckboxClick}
                style={{ width: "18px", height: "18px", border: "2px solid #888", borderRadius: "3px", cursor: "pointer", flexShrink: 0, background: agreed ? red : "white", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {agreed && <span style={{ color: "white", fontSize: "11px", fontWeight: "700" }}>✓</span>}
              </div>
              <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#333" }}>
                <span
                  onClick={openTerms}
                  style={{ textDecoration: "underline", cursor: "pointer" }}
                >
                  I have read and agree to the Terms and Conditions and Privacy Policy.
                </span>{" "}
              </span>
            </div>

            <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "16px" }} />

            {/* Action row */}
            <div className="su2-action-row">
              <button onClick={onBack} className="su2-btn" disabled={submitting}>Back</button>
              <button
                onClick={handleSubmit}
                className="su2-btn"
                disabled={submitting}
                style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>

            <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "17px" }} />

            <p style={{ fontFamily: "'Kufam', sans-serif", textAlign: "center", fontSize: "0.88rem", color: "#555" }}>
              Already have an account?{" "}
              <span
                onClick={onGoSignIn}
                style={{ color: red, textDecoration: "underline", cursor: "pointer", fontWeight: "600" }}
              >
                Sign-in
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignUpStep2Screen;