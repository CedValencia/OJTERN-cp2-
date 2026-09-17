import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyBzTJYm8Au3s-w5y2Vt5vOFwYTTI3WiMJo",
    authDomain: "ojtern.firebaseapp.com",
    projectId: "ojtern",
    storageBucket: "ojtern.firebasestorage.app",
    messagingSenderId: "163988958843",
    appId: "1:163988958843:web:59ef9e0876853cf982bcde",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// ── Auth + session persistence ───────────────────────────────────────────────
// Ginagamit dito ang `initializeAuth` sa halip na `getAuth` dahil DITO LANG
// maitatakda ang persistence nang SABAY sa pag-init ng Auth.
//
// Ang dating `getAuth(app)` + `setPersistence(...)` sa dulo ng file ang dahilan
// ng auto-logout tuwing nagre-refresh:
//
//   1. Nag-i-init si `getAuth` gamit ang DEFAULT na persistence list ng Firebase
//      (IndexedDB, tapos localStorage), at doon agad siya naghahanap ng session.
//   2. Asynchronous ang `setPersistence` — tumatakbo lang siya pagkatapos nun.
//   3. Kaya sa dev, naisusulat ang session sa sessionStorage, pero sa refresh
//      ang binabasa sa simula ay IndexedDB/localStorage. Wala doon, kaya
//      nag-fi-fire ang `onAuthStateChanged` na `null`.
//   4. Hindi na ito nasasagip ng `setPersistence` mamaya: ang ginagawa niya ay
//      inililipat ang user mula sa LUMANG persistence papunta sa bago. Kung
//      wala nang user doon, wala siyang ililipat — hindi niya kinukuha yung
//      nakaupo nang session sa sessionStorage. Ulila na yun sa bawat reload.
//
// Sa `initializeAuth`, nakatakda na ang persistence bago pa magsimula ang
// restore, kaya iisa lang ang auth event at tama na agad ang binabasang storage.
//
// PAALALA: kailangang ito ang UNANG pagkakataon na na-i-initialize ang Auth
// para sa app na ito. Kung may ibang module na tumatawag ng `getAuth(app)` bago
// ma-import ang file na ito, magre-reklamo si Firebase. Palaging i-import ang
// `auth` mula rito, huwag nang tumawag ng `getAuth` kahit saan pa.
const isProduction = process.env.NODE_ENV === "production";

// Ang `initializeAuth` ay isang beses lang puwedeng tawagin bawat Firebase app.
// Sa hot reload (HMR) ay muling pinapatakbo ni webpack ang file na ito habang
// buhay pa ang dating app instance, kaya nag-a-throw siya ng
// "auth/already-initialized" — at kapag nag-throw ang module habang
// ini-evaluate, naiiwan sa temporal dead zone ang `export const auth`, kaya
// ang lumalabas sa screen ay "Cannot access 'auth' before initialization".
// Ang fallback na `getAuth(app)` ay ibinabalik lang ang Auth instance na
// na-initialize na — kasama na ang persistence na itinakda sa unang pagtakbo.
let authInstance;
try {
  authInstance = initializeAuth(app, {
    // Production: IndexedDB muna, localStorage bilang fallback (halimbawa, sa
    // Safari private mode). Nabubuhay ang login kahit isara ang browser/tab —
    // kasama na ang pagsasara/pag-background ng iOS sa "Add to Home Screen" PWA,
    // na dating lumalabas bilang hindi sinasadyang auto-logout sa totoong users.
    //
    // Dev: sessionStorage, para hindi nagdadala ng session sa bagong tab kapag
    // nagte-test ng maraming account nang sabay-sabay. Nananatili pa rin ito sa
    // refresh, dahil hindi binubura ng reload ang sessionStorage — nawawala lang
    // kapag isinara ang tab.
    persistence: isProduction
      ? [indexedDBLocalPersistence, browserLocalPersistence]
      : browserSessionPersistence,
    // Kailangan lang ito kapag may signInWithPopup/Redirect. Wala pa ngayon
    // (email + password lang ang app), pero mas mura nang nakalagay na kaysa sa
    // isang misteryosong "auth/operation-not-supported" mamaya.
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch (err) {
  if (err?.code === "auth/already-initialized") {
    authInstance = getAuth(app);
  } else {
    throw err;
  }
}

export const auth = authInstance;

// I-verify na tumatama talaga ang mode. Sa ilang setup (lalo na sa Vite) ay
// posibleng hindi mapalitan ang `process.env.NODE_ENV` at maging `undefined`,
// at kapag ganun ay SESSION persistence ang mapupunta sa deployed build —
// ibig sabihin apektado rin ang totoong users, hindi lang ikaw sa dev. Kung
// mali ang lumabas dito sa production build, palitan ang linya sa taas ng:
//     const isProduction = import.meta.env.PROD;
console.log("[firebase] NODE_ENV:", process.env.NODE_ENV, "| persistence:", isProduction ? "LOCAL" : "SESSION");

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
// Region must match where the Cloud Functions are deployed (see functions/index.js —
// coordinator-transfer functions use "asia-southeast1"), or calls will 404.
export const functions = getFunctions(app, "asia-southeast1");

export default app;