import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth, browserLocalPersistence, browserSessionPersistence, setPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBzTJYm8Au3s-w5y2Vt5vOFwYTTI3WiMJo",
    authDomain: "ojtern.firebaseapp.com",
    projectId: "ojtern",
    storageBucket: "ojtern.firebasestorage.app",
    messagingSenderId: "163988958843",
    appId: "1:163988958843:web:59ef9e0876853cf982bcde",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Some ad blockers / privacy extensions (Brave Shields, uBlock, etc.) flag
// Firestore's real-time "Listen" channel as a tracking beacon — the URL
// pattern (…/Listen/channel…&SID=…) looks similar to an analytics ping —
// and block it with net::ERR_BLOCKED_BY_CLIENT. `autoDetectLongPolling`
// lets the SDK probe and fall back to a connection shape that's less likely
// to match those filter-list patterns, instead of always using the default
// WebChannel transport.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);

// Session persistence:
// - In local dev (`npm start`), use session persistence so every dev server
//   restart shows the sign-in screen again — convenient for testing multiple
//   accounts without manually logging out each time.
// - In production (the deployed build real users hit), use local
//   persistence instead, so a login survives the browser/tab being closed —
//   including iOS closing/backgrounding an "Add to Home Screen" PWA, which
//   was otherwise showing up as an unwanted auto-logout for real users.
const persistenceMode = process.env.NODE_ENV === "production"
  ? browserLocalPersistence
  : browserSessionPersistence;
setPersistence(auth, persistenceMode)
  .then(() => console.log("[firebase] Persistence set to:", process.env.NODE_ENV === "production" ? "LOCAL" : "SESSION"))
  .catch((err) => console.error("[firebase] setPersistence FAILED:", err.code, err.message));

export default app;