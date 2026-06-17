import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase";

import CompanyPostOJTScreen from "./CompanyPostOJTScreen";
import CompanyApplicantsScreen from "./CompanyApplicantsScreen";
import CompanyMessageScreen from "./CompanyMessagesScreen";
import CompanyAccountProfileScreen from "./CompanyAccountProfileScreen";
import AboutScreen from "./AboutScreen";

import logo from "../icons/ojtern.png";
import dashboardIcon      from "../icons/dashboard.png";
import userIcon from "../icons/user.png";
import viewIcon           from "../icons/view.png";
import postOJTIcon        from "../icons/post.png";
import applicantsIcon     from "../icons/applicants.png";
import messagesIcon       from "../icons/messages.png";
import accountProfileIcon from "../icons/accountprofile.png";
import aboutIcon          from "../icons/about.png";

const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&family=Monomaniac+One&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #8B0000; border-radius: 4px; }
    ::-webkit-scrollbar-track { background: #f0f0f0; }
    .cnav-item:hover { background: rgba(185,185,185,0.7) !important; }
    .cnav-item.active { background: rgba(185,185,185,0.7) !important; }
    .applicant-row:hover { background: #d4d4d4 !important; }
    .post-row:hover { background: #d4d4d4 !important; }
  `}</style>
);

const red     = "#8B0000";
const darkRed = "#590101";

const navItems = [
  { key: "dashboard",      label: "Dashboard",       icon: dashboardIcon },
  { key: "postojt",        label: "Post OJT",        icon: postOJTIcon },
  { key: "applicants",     label: "Applicants",      icon: applicantsIcon },
  { key: "messages",       label: "Messages",        icon: messagesIcon },
  { key: "accountprofile", label: "Account Profile", icon: accountProfileIcon },
  { key: "about",          label: "About",           icon: aboutIcon },
];

export const Sidebar = ({ activeNav, setActiveNav }) => (
  <div style={{
    width: "260px", flexShrink: 0,
    background: "#e0e0e0", display: "flex",
    flexDirection: "column", overflowY: "auto",
    borderRight: "1px solid #ccc",
  }}>
    {navItems.map((item) => (
      <div
        key={item.key}
        className={`cnav-item ${activeNav === item.key ? "active" : ""}`}
        onClick={() => setActiveNav(item.key)}
        style={{
          display: "flex", alignItems: "center", gap: "14px",
          padding: "16px 20px", cursor: "pointer",
          borderBottom: "1px solid #ccc", transition: "background 0.15s",
          background: activeNav === item.key ? "rgba(139,0,0,0.10)" : "transparent",
        }}
      >
        <img
          src={item.icon} alt={item.label}
          style={{
            width: "30px", height: "30px", objectFit: "contain",
            flexShrink: 0, opacity: activeNav === item.key ? 1 : 0.35,
          }}
        />
        <span style={{
          fontFamily: "'Jersey 25', sans-serif", fontSize: "1.3rem",
          opacity: activeNav === item.key ? 1 : 0.35,
        }}>
          {item.label}
        </span>
      </div>
    ))}
  </div>
);

export const TopNavBar = () => (
  <div style={{
    height: "70px", flexShrink: 0,
    background: `linear-gradient(90deg, ${red} 0%, ${darkRed} 100%)`,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <img src={logo} alt="OJTern" style={{ width: "46px", height: "46px", objectFit: "contain" }} />
      <span style={{
        fontFamily: "'Monomaniac One', sans-serif", fontSize: "1.5rem",
        color: "white", letterSpacing: "0.03em",
      }}>OJTern</span>
    </div>
    <div style={{ cursor: "pointer" }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    </div>
  </div>
);

const PersonAvatar = ({ size = 36 }) => (
  <img
    src={userIcon}
    alt="user"
    style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
  />
);

const ArrowBtn = ({ color = red }) => (
  <div style={{
    width: "30px", height: "30px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, cursor: "pointer",
  }}>
    <img src={viewIcon} alt="view" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
  </div>
);

const PostIcon = ({ size = 40 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }}>
    <img src={postOJTIcon} alt="post" style={{ width: size * 1.5, height: size * 1.5, objectFit: "contain" }} />
  </div>
);

const StatusBadge = ({ status }) => {
  const cfg = {
    Accepted:     { bg: "#2d7a2d", text: "white" },
    Declined:     { bg: darkRed,   text: "white" },
    "Pending": { bg: "#c8a800", text: "white" },
  }[status] || { bg: "#aaa", text: "white" };

  return (
    <div style={{
      background: cfg.bg, color: cfg.text,
      borderRadius: "20px", padding: "4px 16px",
      fontFamily: "'Kufam', sans-serif", fontWeight: 700,
      fontSize: "0.78rem", cursor: "pointer", flexShrink: 0,
      minWidth: "90px", textAlign: "center",
    }}>
      {status}
    </div>
  );
};


const DashboardContent = ({ onNavigate, applications = [], posts = [] }) => {
  const totalApplicants    = applications.length;
  const acceptedApplicants = applications.filter(a => a.status === "Accepted").length;
  const recentApplicants   = [...applications].sort((a, b) => {
    const aTs = a.appliedAt?.seconds || 0;
    const bTs = b.appliedAt?.seconds || 0;
    return bTs - aTs;
  }).slice(0, 5);
  const recentPosts = posts.slice(0, 5);

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", flex: 1 }}>
      <div style={{
        background: "#e8e8e8", borderRadius: "18px",
        padding: "30px 40px", marginBottom: "28px",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.07)",
        textAlign: "center",
      }}>
        <h1 style={{
          fontFamily: "'Jersey 25', sans-serif",
          fontSize: "5.5rem", color: darkRed,
          textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "-10px",
        }}>
          Welcome to OJTern
        </h1>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1.5rem", color: darkRed }}>
          Find the perfect OJT for you!
        </p>
      </div>

      <hr style={{ border: "none", borderTop: "1.5px solid #ddd", marginBottom: "24px" }} />

      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div style={{
          flex: 1, background: "#e8e8e8", borderRadius: "14px",
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ background: darkRed, padding: "10px 16px" }}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: "bold", fontSize: "1rem", color: "white" }}>Company Stats</span>
          </div>
          <div style={{ padding: "12px", display: "flex", gap: "14px", height: "220px" }}>
            <div style={{ flex: 1, borderRadius: "12px", padding: "2px 12px" }}>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1rem", color: "#000", marginBottom: "12px" }}>Total Applicants</p>
              <div style={{ background: darkRed, borderRadius: "10px", width: "100%", height: "120px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "4rem", color: "white" }}>{totalApplicants}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ position: "relative", width: "28px", height: "28px" }}>
                <div onClick={() => onNavigate("applicants")} style={{ position: "absolute", top: "-30px", left: "215px", width: "45px", height: "45px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
  <img src={viewIcon} alt="view" style={{ width: "70px", height: "70px", objectFit: "contain" }} />
</div>
              </div>
            </div>
            </div>
            <div style={{ flex: 1, borderRadius: "12px", padding: "2px 12px" }}>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1rem", color: "#000", marginBottom: "12px" }}>Accepted Applicants</p>
              <div style={{ background: "#ccc", borderRadius: "10px", width: "100%", height: "120px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "4rem", color: "white" }}>{acceptedApplicants}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
  <div style={{ position: "relative", width: "28px", height: "28px" }}>
    <div onClick={() => onNavigate("applicants")} style={{ position: "absolute", top: "-30px", left: "215px", width: "45px", height: "45px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
  <img src={viewIcon} alt="view" style={{ width: "70px", height: "70px", objectFit: "contain" }} />
</div>
  </div>
</div>
            </div>
          </div>
        </div>

        <div style={{
          flex: 1, background: "#e8e8e8", borderRadius: "14px",
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ background: darkRed, padding: "10px 16px" }}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: "bold", fontSize: "1rem", color: "white" }}>Recent Post</span>
          </div>
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", height: "220px", overflowY: "auto" }}>
            {recentPosts.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#aaa", fontStyle: "italic" }}>No posts yet.</p>
              </div>
            ) : recentPosts.map((p, i) => (
              <div key={i} className="post-row" onClick={() => onNavigate("postojt")}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#d8d8d8", borderRadius: "8px", padding: "9px 12px", cursor: "pointer" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#222", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.companyName || "OJT Post"}</p>
                  <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: "#888" }}>{p.industry || ""} {p.createdAt?.seconds ? "• " + new Date(p.createdAt.seconds * 1000).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</p>
                </div>
                <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: darkRed, fontWeight: 700, flexShrink: 0, marginLeft: "8px" }}>{p.slot || 0} slot{p.slot !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "#e8e8e8", borderRadius: "14px", overflow: "hidden" }}>
        <div style={{ background: darkRed, padding: "10px 16px" }}>
          <span style={{ fontFamily: "'Kufam', sans-serif", fontWeight: "bold", fontSize: "1rem", color: "white" }}>Recent Applicants</span>
        </div>
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "240px", overflowY: "auto" }}>
          {recentApplicants.length === 0 ? (
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#aaa", fontStyle: "italic", textAlign: "center", padding: "16px" }}>No applicants yet.</p>
          ) : (
            recentApplicants.map((a, i) => (
              <div
                key={i} className="applicant-row"
                onClick={() => onNavigate("applicants")}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#d8d8d8", borderRadius: "8px", padding: "9px 12px", transition: "background 0.15s", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <PersonAvatar size={36} />
                  <div style={{ width: "1px", height: "28px", background: "#bbb" }} />
                  <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.88rem", color: "#222", fontWeight: 600 }}>{a.studentName || a.studentFullName || a.name || "Student"}</span>
                </div>
                <StatusBadge status={a.status || "Pending"} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Company Dashboard ─────────────────────────────────────────────────────
const CompanyDashboardScreen = ({ user, onLogout }) => {
  const [activeNav, setActiveNav]           = useState("dashboard");
  const [applications, setApplications]     = useState([]);
  const [posts, setPosts]                   = useState([]);
  const [pendingContact, setPendingContact] = useState(null);

  // Fetch company posts
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "ojt_posts"),
      where("companyId", "==", user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      console.log("Posts found:", snap.docs.length, "for uid:", user.uid);
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Posts error:", err));
    return () => unsub();
  }, [user?.uid]);

  // ── Load applications for this company ───────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "applications"),
      where("companyId", "==", user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      console.log("Applications found:", snap.docs.length, "for uid:", user.uid);
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Applications error:", err));
    return () => unsub();
  }, [user?.uid]);

  const handleNavigateToMessages = (contact) => {
    setPendingContact(contact);
    setActiveNav("messages");
  };

  const renderContent = () => {
    switch (activeNav) {
      case "dashboard":
        return <DashboardContent onNavigate={setActiveNav} applications={applications} posts={posts} />;
      case "postojt":
        return <CompanyPostOJTScreen embedded user={user} />;
      case "applicants":
        return (
          <CompanyApplicantsScreen
            embedded
            onNavigateToMessages={handleNavigateToMessages}
          />
        );
      case "messages":
        return (
          <CompanyMessageScreen
            user={user}
            openContact={pendingContact}
            onContactOpened={() => setPendingContact(null)}
          />
        );

      case "about":
        return <AboutScreen />;

      case "accountprofile":
        return <CompanyAccountProfileScreen user={user} onLogout={onLogout} />;
        
    }
    
  };

  return (
    <>
      <FontImport />
      <div style={{
        width: "100vw", height: "100vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <TopNavBar />
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            overflowY: "auto", background: "#f5f5f5",
          }}>
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
};

export default CompanyDashboardScreen;