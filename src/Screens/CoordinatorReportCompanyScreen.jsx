import React, { useState, useEffect } from "react";

const red     = "#8B0000";
const darkRed = "#590101";

// ── Responsive styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Kufam:wght@400;600;700&family=Jua&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #8B0000; border-radius: 4px; }

    /* Main scroll area */
    .rc-screen {
      flex: 1;
      overflow-y: auto;
      padding: 28px 32px;
    }
    @media (max-width: 560px) {
      .rc-screen { padding: 18px 14px; }
    }

    /* Header row */
    .rc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    /* Title */
    .rc-title {
      font-family: 'Jersey 25', sans-serif;
      font-size: 3rem;
      color: ${darkRed};
      line-height: 1.1;
    }
    @media (max-width: 480px) {
      .rc-title { font-size: 2rem; }
    }

    /* Total badge */
    .rc-total-badge {
      border: 2px solid #333;
      border-radius: 12px;
      padding: 10px 20px;
      text-align: center;
      min-width: 80px;
    }
    @media (max-width: 480px) {
      .rc-total-badge { padding: 8px 14px; min-width: 60px; }
    }

    /* ── TABLE — desktop only ── */
    .rc-table-wrap { width: 100%; }
    .rc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.83rem;
    }
    .rc-th {
      padding: 10px 14px;
      text-align: left;
      color: white;
      font-family: 'Kufam', sans-serif;
      font-weight: 600;
      white-space: nowrap;
    }
    .rc-td {
      padding: 12px 14px;
      font-family: 'Kufam', sans-serif;
      font-weight: 600;
      border-bottom: 1px solid #eee;
    }

    /* ── CARD LIST — mobile only ── */
    .rc-card-list { display: none; flex-direction: column; gap: 10px; }

    .rc-card {
      background: #dadada;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rc-card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .rc-card-bottom {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 8px;
    }

    .rc-card-label {
      font-family: 'Kufam', sans-serif;
      font-size: 0.68rem;
      color: #999;
      margin-bottom: 2px;
    }

    .rc-card-value {
      font-family: 'Kufam', sans-serif;
      font-size: 0.84rem;
      font-weight: 600;
      color: #222;
    }

    /* Switch between table and cards at 560px */
    @media (max-width: 560px) {
      .rc-table-wrap { display: none; }
      .rc-card-list  { display: flex; }
    }

    /* Report detail modal */
    .rc-modal-inner {
      background: white;
      border-radius: 16px;
      width: 520px;
      max-width: calc(100vw - 32px);
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .rc-modal-header {
      background: ${darkRed};
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .rc-modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    @media (max-width: 480px) {
      .rc-modal-body { padding: 14px; }
    }
  `}</style>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const isAllowedType = (file) =>
  file && (file.type === "image/png" || file.type === "application/pdf");

const handleDownload = (file) => {
  const a = document.createElement("a");
  a.href = file.url;
  a.download = file.name;
  a.click();
};

// ── Image Lightbox ────────────────────────────────────────────────────────────
const ImageLightbox = ({ src, name, onClose }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9000, flexDirection: "column",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(0,0,0,0.5)",
        }}
      >
        <span style={{
          fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem",
          color: "rgba(255,255,255,0.8)",
          maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => handleDownload({ url: src, name })}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px",
              padding: "7px 14px", color: "white",
              fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
              width: "34px", height: "34px", color: "white", fontSize: "1.1rem",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>
      </div>

      <img
        src={src} alt={name}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "90vw", maxHeight: "80vh",
          borderRadius: "10px", objectFit: "contain",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
};

// ── Shared styles & icons ─────────────────────────────────────────────────────
const downloadBtnStyle = {
  display: "flex", alignItems: "center", gap: "6px",
  padding: "7px 18px", borderRadius: "16px",
  border: `1.5px solid ${red}`, background: "white", color: red,
  fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem",
  cursor: "pointer", fontWeight: 600,
};

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const PdfIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

// ── Report Detail Modal ───────────────────────────────────────────────────────
export const ReportDetailModal = ({ report, onClose }) => {
  const [lightbox, setLightbox] = useState(false);

  if (!report) return null;

  const file    = report.attachedFile;
  const allowed = isAllowedType(file);
  const isPng   = allowed && file.type === "image/png";
  const isPdf   = allowed && file.type === "application/pdf";

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "16px",
      }}>
        <div className="rc-modal-inner">
          <div className="rc-modal-header">
            <span style={{
              fontFamily: "'Jersey 25', sans-serif",
              fontSize: "clamp(1.1rem, 4vw, 1.4rem)",
              color: "white",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {report.company}
            </span>
            <button
              onClick={onClose}
              style={{
                background: "white", border: "none", borderRadius: "50%",
                width: "28px", height: "28px", cursor: "pointer",
                fontWeight: "bold", fontSize: "1rem", color: "#333",
                flexShrink: 0, marginLeft: "10px",
              }}
            >✕</button>
          </div>

          <div className="rc-modal-body">
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Reported Company:</b> {report.company}
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", marginBottom: "8px" }}>
              <b>Concern:</b> {report.concern}
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", marginBottom: "16px" }}>
              <b>Date:</b> {report.date}
            </p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", fontWeight: 700, marginBottom: "6px" }}>
              DESCRIPTION:
            </p>
            <div style={{ background: "#f5f5f5", borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444", lineHeight: 1.6 }}>
                {report.description}
              </p>
            </div>

            {file && (
              <>
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.9rem", fontWeight: 700, marginBottom: "10px" }}>
                  Attached File:
                </p>
                {!allowed && (
                  <div style={{
                    background: "#fff3f3", border: `1px solid ${red}`,
                    borderRadius: "8px", padding: "12px 14px",
                    fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: red,
                  }}>
                    Unsupported file type. Only PNG images and PDF files can be previewed or downloaded.
                  </div>
                )}
                {isPng && (
                  <div>
                    <div
                      onClick={() => setLightbox(true)}
                      style={{ position: "relative", display: "inline-block", cursor: "zoom-in", marginBottom: "10px" }}
                    >
                      <img
                        src={file.url} alt="attachment"
                        style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid #ddd", display: "block" }}
                      />
                      <div
                        style={{
                          position: "absolute", inset: 0, borderRadius: "8px",
                          background: "rgba(0,0,0,0.22)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: 0, transition: "opacity 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0"}
                      >
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          <line x1="11" y1="8" x2="11" y2="14"/>
                          <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                      </div>
                    </div>
                    <button onClick={() => handleDownload(file)} style={downloadBtnStyle}>
                      <DownloadIcon /> Download Image
                    </button>
                  </div>
                )}
                {isPdf && (
                  <div>
                    <iframe
                      src={file.url} title="PDF Preview"
                      style={{ width: "100%", height: "340px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "10px" }}
                    />
                    <div style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      background: "#f5f5f5", padding: "10px 14px",
                      borderRadius: "8px", marginBottom: "10px",
                    }}>
                      <PdfIcon />
                      <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#555", flex: 1 }}>
                        {file.name}
                      </span>
                    </div>
                    <button onClick={() => handleDownload(file)} style={downloadBtnStyle}>
                      <DownloadIcon /> Download PDF
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {lightbox && isPng && (
        <ImageLightbox src={file.url} name={file.name} onClose={() => setLightbox(false)} />
      )}
    </>
  );
};

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <p style={{ color: "#bbb", fontSize: "1rem", fontFamily: "'Jua', sans-serif" }}>No reports submitted yet.</p>
    <p style={{ color: "#ccc", fontSize: "0.82rem", fontFamily: "'Kufam', sans-serif" }}>Reports submitted from a company profile will appear here.</p>
  </div>
);

// ── View button (reused in both table and cards) ──────────────────────────────
const ViewButton = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "5px 16px", borderRadius: "16px",
      border: `1.5px solid ${red}`, background: "white", color: red,
      fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem",
      cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
    }}
  >View</button>
);

// ── Report Company Screen ─────────────────────────────────────────────────────
const CoordinatorReportCompanyScreen = ({ reports = [], onViewReport }) => (
  <>
    <ResponsiveStyles />
    <div className="rc-screen">

      {/* Header */}
      <div className="rc-header">
        <h1 className="rc-title">Report<br />List</h1>
        <div className="rc-total-badge">
          <div style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.4rem, 4vw, 2rem)", color: "#222" }}>
            {reports.length}
          </div>
          <div style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", fontWeight: 700, color: "#222" }}>
            Total
          </div>
        </div>
      </div>

      {/* ── Desktop: table ── */}
      <div className="rc-table-wrap">
        <table className="rc-table">
          <thead>
            <tr style={{ background: darkRed }}>
              {["Reported Company", "Concern", "Date", "Action"].map(h => (
                <th key={h} className="rc-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={i}>
                <td className="rc-td">{r.company}</td>
                <td className="rc-td">{r.concern}</td>
                <td className="rc-td">{r.date}</td>
                <td className="rc-td">
                  <ViewButton onClick={() => onViewReport && onViewReport(r)} />
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "60px" }}>
                  <EmptyState />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: cards ── */}
      <div className="rc-card-list">
        {reports.map((r, i) => (
          <div key={i} className="rc-card">
            <div className="rc-card-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="rc-card-label">Reported Company</p>
                <p className="rc-card-value" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.company}
                </p>
              </div>
              <ViewButton onClick={() => onViewReport && onViewReport(r)} />
            </div>
            <div className="rc-card-bottom">
              <div>
                <p className="rc-card-label">Concern</p>
                <p className="rc-card-value">{r.concern}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p className="rc-card-label">Date</p>
                <p className="rc-card-value">{r.date}</p>
              </div>
            </div>
          </div>
        ))}
        {reports.length === 0 && (
          <div style={{ paddingTop: "60px" }}>
            <EmptyState />
          </div>
        )}
      </div>

    </div>
  </>
);

export default CoordinatorReportCompanyScreen;