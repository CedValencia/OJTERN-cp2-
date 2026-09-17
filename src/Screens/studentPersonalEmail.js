// ── Student personal (recovery) email ─────────────────────────────────────────
// Bulk-created student accounts sign in with a system-generated address stored
// in students/{uid}.email. AuthService.signIn resolves that field by Student ID,
// so it must never be edited by the student. The student's real address lives in
// students/{uid}.personalEmail and is what Forgot Password sends the reset link to.
//
// studentPersonalEmails/{normalizedEmail} → { uid } guarantees one personal email
// belongs to one student. Always change personalEmail through claimPersonalEmail()
// inside a runTransaction so the index and the student document stay in sync.
import { doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const PERSONAL_EMAIL_INDEX = "studentPersonalEmails";

const EMAIL_REGEX = /^[a-z0-9._%+\-]+@[a-z0-9\-]+(\.[a-z0-9\-]+)*\.[a-z]{2,}$/;

export const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

export const isValidEmail = (value) => {
  const email = normalizeEmail(value);
  return email.length > 0 && email.length <= 254 && !email.includes("..") && EMAIL_REGEX.test(email);
};

// Domains used for the system-generated login addresses of bulk-created student
// accounts, e.g. "2023-12345@fake-email.com" → "fake-email.com". Nobody can receive
// mail there, so those addresses are refused as a personal email.
// ⚠️ Fill this in with your real generated domain(s). Students whose login email is
// already a real inbox (such as a Gmail) may use that same address.
export const GENERATED_LOGIN_EMAIL_DOMAINS = [];

export const isGeneratedLoginEmail = (value) => {
  const domain = normalizeEmail(value).split("@")[1] || "";
  return GENERATED_LOGIN_EMAIL_DOMAINS.some(d => domain === normalizeEmail(d));
};

// Returns an error message, or "" when the email is acceptable.
export const validatePersonalEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email) return "Enter your personal email address.";
  if (!isValidEmail(email)) return "Enter a valid email address, like name@gmail.com.";
  if (isGeneratedLoginEmail(email)) {
    return "That's a system-generated login email. Enter an email address you personally own.";
  }
  return "";
};

// Transaction step: reserves `email` for `uid` and releases `previousEmail`.
// Performs all of its reads before any write, so callers may add their own
// tx.set / tx.update calls afterwards (but must not call tx.get after it).
export const claimPersonalEmail = async (tx, { uid, email, previousEmail = "" }) => {
  const next = normalizeEmail(email);
  const prev = normalizeEmail(previousEmail);

  const nextRef = doc(db, PERSONAL_EMAIL_INDEX, next);
  const prevRef = prev && prev !== next ? doc(db, PERSONAL_EMAIL_INDEX, prev) : null;

  const nextSnap = await tx.get(nextRef);
  const prevSnap = prevRef ? await tx.get(prevRef) : null;

  if (nextSnap.exists() && nextSnap.data()?.uid !== uid) {
    const inUse = new Error("Email already registered to another account.");
    inUse.code = "email-in-use";
    throw inUse;
  }

  if (!nextSnap.exists()) {
    tx.set(nextRef, { uid, createdAt: serverTimestamp() });
  }
  // Free the old address so the student (or someone else) can use it later.
  if (prevSnap?.exists() && prevSnap.data()?.uid === uid) {
    tx.delete(prevRef);
  }
};

export const personalEmailErrorMessage = (err) => {
  switch (err?.code) {
    case "email-in-use":
      return "This email is already registered to another student account. Use a different email.";
    case "permission-denied":
      return "Your account isn't allowed to save this email. Contact your coordinator for assistance.";
    case "unavailable":
    case "deadline-exceeded":
      return "No internet connection. Check your connection, then try again.";
    default:
      return "We couldn't save your email. Try again.";
  }
};