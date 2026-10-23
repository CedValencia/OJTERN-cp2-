// src/DashboardSwitcher.jsx
// Top-bar toggle between the Coordinator dashboard (/coordinator) and the Admin dashboard (/admin).
// Shown ONLY to someone who has BOTH an active admins/{uid} doc and a coordinators/{uid} doc, so everyone
// else sees nothing. It is navigation only: the real protection is still firestore.rules + requireAdmin.
//
//   <DashboardSwitcher current="coordinator" />   // in CoordinatorDashboardScreen's top bar
//   <DashboardSwitcher current="admin" />         // in AdminScreen's top bar
//
// It uses a full page navigation (window.location) because AdminScreen lives outside the coordinator
// router; the Firebase session is kept, so nobody has to sign in again.
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const PATHS = { coordinator: "/coordinator", admin: "/admin" };
// Remembers which dashboard this tab was last on. Both dashboards hide the address bar path
// (it always shows "/"), so after a refresh the root page can't tell them apart: it used to
// always send someone with both roles to the coordinator dashboard. SplashScreen reads this key.
export const LAST_DASHBOARD_KEY = "ojtern:lastDashboard";
const COORDINATOR_BLOCKED = ["pending", "rejected", "transferred", "suspended", "blocked"];

const useHasBothDashboards = () => {
  const [both, setBoth] = useState(false);
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { setBoth(false); return; }
    try {
      const [a, c] = await Promise.all([
        getDoc(doc(db, "admins", u.uid)),
        getDoc(doc(db, "coordinators", u.uid)),
      ]);
      const isAdmin = a.exists() && a.get("role") === "admin" && a.get("status") === "active";
      const isCoordinator = c.exists() && c.get("role") === "coordinator" && !COORDINATOR_BLOCKED.includes(c.get("status"));
      setBoth(isAdmin && isCoordinator);
    } catch {
      setBoth(false);   // a doc the rules don't let this person read just means "no switcher"
    }
  }), []);
  return both;
};

const segStyle = (active) => ({
  border: 0, cursor: active ? "default" : "pointer", borderRadius: 999, padding: "6px 12px",
  fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap",
  background: active ? "#fff" : "transparent", color: active ? "#111" : "rgba(255,255,255,0.9)",
});

export default function DashboardSwitcher({ current }) {
  const both = useHasBothDashboards();
  // Record where this tab is, even when the switcher itself is hidden (single-role accounts).
  useEffect(() => {
    try { sessionStorage.setItem(LAST_DASHBOARD_KEY, current); } catch { /* storage unavailable: default behaviour */ }
  }, [current]);
  if (!both) return null;

  const go = (key) => {
    if (key === current) return;
    try { sessionStorage.setItem(LAST_DASHBOARD_KEY, key); } catch { /* ignore */ }
    window.location.assign(PATHS[key]);
  };
  return (
    <div role="group" aria-label="Switch dashboard"
      style={{ display: "inline-flex", gap: 2, padding: 3, marginRight: 8, borderRadius: 999, border: "1px solid rgba(255,255,255,0.35)", flexShrink: 0 }}>
      <button type="button" style={segStyle(current === "coordinator")} aria-pressed={current === "coordinator"} onClick={() => go("coordinator")}>Coordinator</button>
      <button type="button" style={segStyle(current === "admin")} aria-pressed={current === "admin"} onClick={() => go("admin")}>Admin</button>
    </div>
  );
}