import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
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
export const db   = getFirestore(app);
export const storage = getStorage(app);
 
export default app;