// AuthService.js — reusable Firebase Auth + Firestore operations
// Import auth and db from firebase.js so everything uses the same app instance

import { initializeApp, getApp, deleteApp } from "firebase/app";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  getAuth,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from "firebase/firestore";

import { httpsCallable } from "firebase/functions";

import { auth, db, functions } from "./firebase";

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY — Sign Up (Step 2 calls this after Cloudinary uploads)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers a new company.
 * 1. Creates a Firebase Auth user.
 * 2. Writes the company profile to Firestore with status "pending".
 *
 * @param {object} step1Data  — { email, password, companyName, industry, location }
 * @param {string[]} verificationDocs — array of Cloudinary secure_url strings
 * @returns {Promise<string>} the new user's UID
 */
export const registerCompany = async (step1Data, verificationDocs) => {
  const { email: rawEmail, password, companyName, industry, location } = step1Data;
  const email = rawEmail.trim().toLowerCase(); // normalize so Auth + Firestore always match

  // 1. Firebase Auth
  const { user } = await createUserWithEmailAndPassword(auth, email, password);

  // 2. Firestore company doc
  await setDoc(doc(db, "companies", user.uid), {
    uid:              user.uid,
    email,
    companyName,
    industry,
    location,         // { fullAddress, region, province, city, barangay, street, lat, lng }
    verificationDocs, // Cloudinary URLs
    role:             "company",
    status:           "pending",  // coordinator must approve before sign-in
    createdAt:        serverTimestamp(),
  });

  return user.uid;
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGN IN — role-aware, status-checked
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signs in a user and verifies their role + approval status in Firestore.
 *
 * @param {"coordinator"|"student"|"company"} role
 * @param {string} emailOrStudentId — email for coordinator/company; studentId for student
 * @param {string} password
 * @returns {Promise<{ user: FirebaseUser, userData: object }>}
 * @throws descriptive Error messages safe to show in the UI
 */
export const signIn = async (role, emailOrStudentId, password) => {
  const collectionMap = {
    coordinator: "coordinators",
    student:     "students",
    company:     "companies",
  };

  let loginEmail = emailOrStudentId;

  // Students log in with student ID → resolve their email first
  if (role === "student") {
    const q    = query(collection(db, "students"), where("studentId", "==", emailOrStudentId.trim()));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Student ID not found. Please check and try again.");
    loginEmail = snap.docs[0].data().email;
  }

  // For companies — check Firestore status BEFORE attempting Auth sign-in
  // This prevents pending/rejected/suspended/blocked companies from logging in
  if (role === "company") {
    const q    = query(collection(db, "companies"), where("email", "==", loginEmail.trim().toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const companyDoc = snap.docs[0];

      // A timed suspension may have already expired — flip it back to
      // "approved" before evaluating the status below, so the company isn't
      // wrongly blocked from a suspension that's technically already over.
      await checkAndReactivateCompany(companyDoc.id);
      const freshSnap = await getDoc(doc(db, "companies", companyDoc.id));
      const status = freshSnap.exists() ? freshSnap.data().status : companyDoc.data().status;

      if (status === "pending") {
        throw new Error("Your account is pending coordinator approval. Please wait before signing in.");
      }
      if (status === "rejected") {
        throw new Error("Your account registration was rejected. Please contact the administrator.");
      }
      if (status === "suspended") {
        throw new Error("Your company account has been suspended. Please contact the system administrator for more information.");
      }
      if (status === "blocked") {
        throw new Error("Your company account has been blocked. Please contact the system administrator for more information.");
      }
    }
  }

  // Firebase Auth sign-in
  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, loginEmail.trim().toLowerCase(), password);
  } catch (err) {
    if (
      err.code === "auth/user-not-found"    ||
      err.code === "auth/wrong-password"    ||
      err.code === "auth/invalid-credential"
    ) {
     throw new Error("Invalid credentials. Please check and try again.");
    }
    throw err;
  }

  const { user } = userCredential;

  // Fetch Firestore profile
  const userSnap = await getDoc(doc(db, collectionMap[role], user.uid));
  if (!userSnap.exists()) {
    await signOut(auth);
    throw new Error("Invalid Credentials. Please check and try again.");
  }

  const userData = userSnap.data();

  // Role mismatch check
  if (userData.role !== role) {
    await signOut(auth);
    const label = role === "coordinator" ? "OJT Coordinator" : role.charAt(0).toUpperCase() + role.slice(1);
    throw new Error(`This account is not registered as a ${label}.`);  }

  // Approval / account-standing status check — enforced here (server-checked,
  // post-Auth) regardless of role, as a second line of defense behind the
  // pre-Auth company check above. This is what actually prevents a
  // suspended/blocked account from bypassing the restriction by refreshing
  // or logging in again: every sign-in re-reads this field from Firestore.
  if (userData.status === "pending") {
    await signOut(auth);
    throw new Error("Your account is pending admin approval. Please try again later.");
  }
  if (userData.status === "rejected") {
    await signOut(auth);
    throw new Error("Your account registration was rejected. Please contact the administrator.");
  }
  if (userData.status === "transferred") {
    await signOut(auth);
    throw new Error("This account has been transferred and no longer has access. Please contact your administrator.");
  }
  if (userData.status === "suspended") {
    await signOut(auth);
    throw new Error("Your company account has been suspended. Please contact the system administrator for more information.");
  }
  if (userData.status === "blocked") {
    await signOut(auth);
    throw new Error("Your company account has been blocked. Please contact the system administrator for more information.");
  }

  return { user, userData };
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGN OUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signs out the current user.
 */
export const logOut = () => signOut(auth);

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET — In-App (No Email Link Required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resets password in-app without using Firebase email links.
 * User must provide their current password to reauthenticate before changing it.
 * 
 * Flow:
 * 1. User enters email in ForgotPasswordScreen
 * 2. User enters current + new password in ResetPasswordScreen
 * 3. This function reauthenticates with current password (proves they own it)
 * 4. Updates password to the new one
 * 5. Success screen shows "Continue" button opening sign-in in new tab
 *
 * @param {string} email — user's email
 * @param {string} currentPassword — user's current password (to verify identity)
 * @param {string} newPassword — the new password to set
 * @returns {Promise<void>}
 * @throws descriptive Error (safe to show in UI)
 * 
 * @example
 * try {
 *   await resetPasswordInApp("user@example.com", "OldPassword123!", "NewPassword456!");
 *   // Success — now user can sign in with NewPassword456!
 * } catch (err) {
 *   console.error(err.message); // "Current password is incorrect."
 * }
 */
export const resetPasswordInApp = async (email, currentPassword, newPassword) => {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Reauthenticate to verify they own this account
    const cred = await signInWithEmailAndPassword(auth, normalizedEmail, currentPassword);
    const user = cred.user;

    if (!user) throw new Error("User not found after authentication.");

    // 2. Update password
    await updatePassword(user, newPassword);

    // 3. Quietly sign out — this forces them to log in with the new password
    // (otherwise they stay logged in with old session)
    // Optional: you could skip this if you want to keep them logged in
    // For security, it's better to force re-login with new credentials
    // await signOut(auth);

  } catch (err) {
    // Handle specific Firebase errors with user-friendly messages
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      throw new Error("Current password is incorrect.");
    }
    if (err.code === "auth/user-not-found") {
      throw new Error("User not found. Please check your email.");
    }
    if (err.code === "auth/weak-password") {
      throw new Error("New password is too weak.");
    }
    if (err.code === "auth/requires-recent-login") {
      throw new Error("Please sign in again before changing your password.");
    }
    // Fallback for unexpected errors
    throw new Error(err.message || "Failed to reset password. Please try again.");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET — Firebase Email Link (Older approach — kept for reference)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a password-reset email only if the email exists in Firestore
 * (checks coordinators, students, and companies collections).
 * 
 * NOTE: This uses Firebase email links (oobCode), which can expire or fail.
 * Consider using resetPasswordInApp() instead for a more reliable flow.
 *
 * @param {string} email
 * @throws descriptive Error safe to show in the UI
 */
export const resetPassword = async (email) => {
  const normalized = email.trim().toLowerCase();

  // Check all three collections for a matching email
  const cols = ["coordinators", "students", "companies"];
  let found = false;
  for (const col of cols) {
    const snap = await getDocs(query(collection(db, col), where("email", "==", normalized)));
    if (!snap.empty) { found = true; break; }
  }

  if (!found) {
    // Don't leak whether email exists or not — generic message
    throw new Error("If that email is registered, you'll receive a reset link shortly.");
  }

  try {
    await sendPasswordResetEmail(auth, normalized, {
      // Firebase's own hosted page handles the reset itself (mode=resetPassword).
      // This "url" is just the "Continue" destination shown after that's done —
      // send the user straight to sign-in, no custom in-app reset screen involved.
      url: "https://ojtern.web.app/signin",
    });
  } catch (err) {
    if (err.code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please wait a moment before trying again.");
    }
    throw new Error("Failed to send reset email. Please try again later.");
  }
};

/**
 * Verifies a Firebase password reset code (from email link).
 * Called before allowing the user to enter a new password.
 *
 * @param {string} oobCode — Firebase's reset code from the email link
 * @returns {Promise<string>} the email address associated with this reset code
 * @throws Error if code is invalid or expired
 */
export const verifyResetCode = async (oobCode) => {
  try {
    return await verifyPasswordResetCode(auth, oobCode);
  } catch (err) {
    if (err.code === "auth/expired-oob-code") {
      throw new Error("This password reset link has expired. Please request a new one.");
    }
    if (err.code === "auth/invalid-oob-code") {
      throw new Error("This password reset link is invalid. Please request a new one.");
    }
    throw err;
  }
};

/**
 * Confirms a Firebase password reset (using the oobCode from email link).
 * This is the final step in the email-link password reset flow.
 *
 * @param {string} oobCode — Firebase's reset code from the email link
 * @param {string} newPassword — the new password to set
 * @throws Error if code is expired or password is weak
 */
export const confirmReset = async (oobCode, newPassword) => {
  try {
    await confirmPasswordReset(auth, oobCode, newPassword);
  } catch (err) {
    if (err.code === "auth/expired-oob-code") {
      throw new Error("This password reset link has expired. Please request a new one.");
    }
    if (err.code === "auth/invalid-oob-code") {
      throw new Error("This password reset link is invalid. Please request a new one.");
    }
    if (err.code === "auth/weak-password") {
      throw new Error("Password is too weak. Please use a stronger password.");
    }
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY — approve/reject
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Approves a pending company registration.
 * @param {string} companyId     — Firestore doc ID (same as company's uid)
 * @param {string} coordinatorUid
 */
export const approveCompany = (companyId, coordinatorUid) =>
  updateDoc(doc(db, "companies", companyId), {
    status:     "approved",
    approvedBy: coordinatorUid,
    approvedAt: serverTimestamp(),
  });

/**
 * Rejects a pending company registration.
 * @param {string} companyId
 * @param {string} coordinatorUid
 */
export const rejectCompany = (companyId, coordinatorUid) =>
  updateDoc(doc(db, "companies", companyId), {
    status:     "rejected",
    rejectedBy: coordinatorUid,
    rejectedAt: serverTimestamp(),
  });

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records a coordinator action to the shared activity log, shown as a
 * "Recent Activity" feed on the coordinator dashboard.
 * @param {string} coordinatorUid
 * @param {string} action     short machine-readable action key, e.g. "company_approved"
 * @param {string} description human-readable summary, e.g. "Approved Gueco Repair Shops"
 * @param {object} [meta]     optional extra fields (e.g. targetId, targetName)
 */
export const logActivity = (coordinatorUid, action, description, meta = {}) =>
  addDoc(collection(db, "activity_logs"), {
    coordinatorUid,
    action,
    description,
    ...meta,
    createdAt: serverTimestamp(),
  });

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY DISCIPLINARY ACTIONS — enforcement, audit trail, company notice
// ─────────────────────────────────────────────────────────────────────────────
// Lives here (not in a screen component) because it's account/auth logic:
// it's what makes accountStatus actually mean something at sign-in time
// (see signIn() above), not just a label shown in a UI.
//
// A company's "good standing" status is "approved" (see registerCompany /
// approveCompany above) — NOT "active" ("active" is used for students and
// coordinators). Suspend/Block temporarily or permanently override that
// same `status` field on the company doc; reactivation restores "approved".

// A company auto-escalates to "suspended" once it racks up this many
// RESOLVED disciplinary actions while still in good standing. Tune this
// number to whatever the panel/adviser agrees on.
const AUTO_SUSPEND_THRESHOLD = 3;

// Coordinator picks the duration when they suspend someone directly. When the
// system auto-escalates on its own (no coordinator input at that moment),
// this is the default length used instead.
const AUTO_SUSPEND_DEFAULT_DAYS = 7;

/**
 * Applies the real effect of a coordinator action on the company's own
 * document (not just a report). Runs as a transaction so concurrent actions
 * on the same company can't race the action counter.
 *
 * @param {string} companyId
 * @param {"Require Correction"|"Warning Issued"|"Suspend Account"|"Block Account"|string} actionType
 * @param {string} coordinatorUid
 * @param {number|string} [suspensionDays]
 * @returns {Promise<{ status: string, previousStatus: string, autoEscalated: boolean, suspendedUntil: Timestamp|null } | null>}
 */
export const applyCompanyEnforcement = async (companyId, actionType, coordinatorUid, suspensionDays) => {
  if (!companyId) {
    console.warn("applyCompanyEnforcement: no companyId given — skipping.");
    return null;
  }
  const companyRef = doc(db, "companies", companyId);

  return runTransaction(db, async (transaction) => {
    const companySnap = await transaction.get(companyRef);
    if (!companySnap.exists()) {
      console.warn(`Company ${companyId} not found — skipping enforcement.`);
      return null;
    }

    const data = companySnap.data();
    const previousStatus = data.status || "approved";
    const actionCount = (data.disciplinaryActionCount || 0) + 1;

    let nextStatus = previousStatus;
    let statusReason = null;
    let autoEscalated = false;
    let suspendedUntil = null; // Timestamp | null — null means not a (timed) suspension

    if (actionType === "Block Account") {
      nextStatus = "blocked";
      statusReason = "Blocked following coordinator review.";
      // Blocks have no expiry — a human has to lift this one.
    } else if (actionType === "Suspend Account") {
      nextStatus = "suspended";
      statusReason = "Suspended following coordinator review.";
      const days = Number(suspensionDays) > 0 ? Number(suspensionDays) : AUTO_SUSPEND_DEFAULT_DAYS;
      suspendedUntil = Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    // "Require Correction", "Warning Issued", and "Others" intentionally do
    // NOT change nextStatus — the account stays active/approved per spec.

    // Auto-escalate only if the coordinator didn't already suspend/block
    // outright, and the company is still in good standing but has piled up
    // disciplinary actions.
    if (nextStatus === previousStatus && previousStatus !== "suspended" && previousStatus !== "blocked" && actionCount >= AUTO_SUSPEND_THRESHOLD) {
      nextStatus = "suspended";
      statusReason = `Auto-suspended after reaching ${actionCount} disciplinary actions.`;
      autoEscalated = true;
      suspendedUntil = Timestamp.fromMillis(Date.now() + AUTO_SUSPEND_DEFAULT_DAYS * 24 * 60 * 60 * 1000);
    }

    const update = { disciplinaryActionCount: actionCount };
    if (nextStatus !== previousStatus) {
      update.status           = nextStatus;
      update.statusReason     = statusReason;
      update.statusUpdatedAt  = serverTimestamp();
      update.statusUpdatedBy  = coordinatorUid || "";
      // suspendedUntil is only meaningful for "suspended"; clear it for
      // "blocked" (indefinite) or anything that isn't a timed suspension.
      update.suspendedUntil   = nextStatus === "suspended" ? suspendedUntil : null;
    }

    transaction.update(companyRef, update);
    return { status: nextStatus, previousStatus, autoEscalated, suspendedUntil };
  });
};

/**
 * Auto-reactivation: since suspensions can't "expire" on their own at the
 * exact minute without a scheduled backend job, something has to check the
 * expiry date and flip the status back. Called from signIn() right before a
 * company account status is evaluated, so an expired suspension never
 * wrongly blocks a login. Safe/cheap no-op if not suspended or not expired.
 *
 * @param {string} companyId
 */
export const checkAndReactivateCompany = async (companyId) => {
  if (!companyId) return null;
  const companyRef = doc(db, "companies", companyId);

  return runTransaction(db, async (transaction) => {
    const companySnap = await transaction.get(companyRef);
    if (!companySnap.exists()) return null;

    const data = companySnap.data();
    if (data.status !== "suspended" || !data.suspendedUntil) return null;

    const expiry = data.suspendedUntil.toMillis
      ? data.suspendedUntil.toMillis()
      : new Date(data.suspendedUntil).getTime();

    if (Date.now() < expiry) return null; // not expired yet

    transaction.update(companyRef, {
      status:          "approved", // companies' good-standing status, NOT "active"
      statusReason:    "Suspension period ended — auto-reactivated.",
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedBy: "system",
      suspendedUntil:  null,
    });
    return { reactivated: true };
  });
};

/**
 * Records a coordinator disciplinary action to a dedicated audit-trail
 * collection, separate from the general "Recent Activity" feed (activity_logs)
 * so it can be queried per-company and carries the exact fields required for
 * compliance review.
 *
 * @param {object} entry
 * @param {string} entry.companyId
 * @param {string} entry.companyName
 * @param {string} entry.coordinatorId
 * @param {string} entry.coordinatorName
 * @param {string} entry.actionType
 * @param {string} entry.reason            — the resolution/reason text
 * @param {string} entry.previousAccountStatus
 * @param {string} entry.newAccountStatus
 */
export const recordCompanyAction = (entry) =>
  addDoc(collection(db, "companyActions"), {
    companyId:             entry.companyId,
    companyName:           entry.companyName || "",
    coordinatorId:         entry.coordinatorId,
    coordinatorName:       entry.coordinatorName || "Coordinator",
    actionType:            entry.actionType,
    reason:                entry.reason || "",
    previousAccountStatus: entry.previousAccountStatus || "approved",
    newAccountStatus:      entry.newAccountStatus || entry.previousAccountStatus || "approved",
    createdAt:             serverTimestamp(),
  });

/**
 * Fetches the disciplinary action history for a single company, most recent
 * first — used by the Coordinator's "View Action History" panel.
 * @param {string} companyId
 * @returns {Promise<object[]>}
 */
export const getCompanyActionHistory = async (companyId) => {
  if (!companyId) return [];
  const q = query(
    collection(db, "companyActions"),
    where("companyId", "==", companyId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Notifies a company about a coordinator action by dropping a message into
 * their existing conversation with the coordinator — reuses the same
 * conversations/{convId}/messages schema as useChat.js (see makeConvId,
 * sendMessage there) instead of a separate notification system, so it shows
 * up naturally in both the Coordinator's and the Company's Messages screens,
 * with the same unread-badge behavior.
 *
 * @param {string} coordinatorUid
 * @param {string} coordinatorName
 * @param {string} companyId
 * @param {string} companyName
 * @param {string} text
 */
export const notifyCompany = async (coordinatorUid, coordinatorName, companyId, companyName, text) => {
  if (!coordinatorUid || !companyId || !text) return;
  const convId  = [coordinatorUid, companyId].sort().join("_"); // matches useChat.js makeConvId
  const convRef = doc(db, "conversations", convId);
  const snap    = await getDoc(convRef);

  if (!snap.exists()) {
    await setDoc(convRef, {
      participants:     [coordinatorUid, companyId],
      participantNames: { [coordinatorUid]: coordinatorName || "Coordinator", [companyId]: companyName || "Company" },
      participantRoles: { [coordinatorUid]: "coordinator", [companyId]: "company" },
      lastMessage:      null,
      updatedAt:        serverTimestamp(),
      createdAt:        serverTimestamp(),
    });
  }

  await addDoc(collection(db, "conversations", convId, "messages"), {
    text,
    senderId:    coordinatorUid,
    ts:          serverTimestamp(),
    edited:      false,
    unsent:      false,
    attachments: null,
  });

  await updateDoc(convRef, {
    lastMessage: { text, senderId: coordinatorUid, ts: serverTimestamp() },
    updatedAt:   serverTimestamp(),
    deletedFor:  [],
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE FETCH (generic helper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a user's Firestore profile.
 * @param {"coordinators"|"students"|"companies"} collectionName
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
export const getUserProfile = async (collectionName, uid) => {
  const snap = await getDoc(doc(db, collectionName, uid));
  return snap.exists() ? snap.data() : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT — Create account (coordinator only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the default student password.
 * Format: firstInitial + lastName + last3DigitsOfStudentId + "." + college
 * e.g. firstName "Juan", lastName "Dela Cruz", studentId "2021-00123", college "CCS"  →  "jdelacruz123.ccs"
 *
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} studentId
 * @param {string} college  — e.g. "CCS", "COE", "CBA"
 * @returns {string}
 */
export const generateStudentPassword = (firstName, lastName, studentId, college) => {
  const firstInitial = firstName.trim()[0].toLowerCase();
  const cleanLast    = lastName.trim().toLowerCase().replace(/\s+/g, "");
  const last3        = String(studentId).trim().replace(/\D/g, "").slice(-3);
  const cleanCollege = college.trim().toLowerCase();
  return `${firstInitial}${cleanLast}${last3}.${cleanCollege}`;
};

/**
 * Creates a student account (coordinator only).
 * Generates a default password from lastName + college, creates Auth + Firestore profile,
 * then signs out to avoid logging the coordinator out.
 *
 * @param {object} studentData — {
 *   studentId, lastName, middleInitial, firstName,
 *   college, program, specialization, yearSection,
 *   sex, age, email
 * }
 * @param {string} createdByUid — coordinator's UID
 * @returns {Promise<{ uid: string, password: string }>}
 *   Returns the UID and generated password so coordinator can share it with the student
 */
export const createStudentAccount = async (studentData, createdByUid) => {
  const {
    studentId, lastName, middleInitial, firstName,
    college, program, specialization, yearSection,
    sex, age, email,
  } = studentData;

  // 1. Check for duplicate studentId
  const q = query(
    collection(db, "students"),
    where("studentId", "==", studentId.trim())
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error(`Student ID "${studentId}" is already registered.`);
  }

  // 2. Generate default password
  const password = generateStudentPassword(firstName, lastName, studentId, college);

  // 3. Firebase Auth — isolated so it doesn't sign the coordinator out
  const uid = await createAuthUserIsolated(email.trim().toLowerCase(), password, async (newUid) => {
    await setDoc(doc(db, "students", newUid), {
      uid:            newUid,
      studentId:      studentId.trim(),
      lastName:       lastName.trim(),
      middleInitial:  middleInitial.trim(),
      firstName:      firstName.trim(),
      fullName: `${firstName.trim()} ${middleInitial.trim() ? middleInitial.trim().replace(/\.$/, "") + ". " : ""}${lastName.trim()}`,
      college:        college.trim(),
      program:        program.trim(),
      specialization: specialization.trim(),
      yearSection:    yearSection.trim(),
      sex,
      age:            Number(age),
      email:          email.trim().toLowerCase(),
      role:           "student",
      status:         "active",
      passwordChanged: false,
      createdBy:      createdByUid,
      createdAt:      serverTimestamp(),
    });
  });

  return { uid, password };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD — for first-login password change (students & coordinators)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Changes the current user's password and marks passwordChanged: true in Firestore,
 * then signs the user out so they land back on the sign-in screen.
 *
 * Reauthenticates first, since Firebase's updatePassword requires a "recent login".
 *
 * @param {string} currentPassword — the user's existing password
 * @param {string} newPassword
 * @param {"students"|"coordinators"} collectionName
 * @param {string} uid
 * @param {string} email
 * @throws Error with user-friendly message
 */
export const changePassword = async (currentPassword, newPassword, collectionName, uid, email) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No user is currently signed in.");
  }

  const userEmail = email || user.email;
  if (!userEmail) {
    throw new Error("Unable to verify user email. Please try logging in again.");
  }

  // Reauthenticate with current password
  const credential = EmailAuthProvider.credential(userEmail, currentPassword);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (err) {
    console.error("[changePassword] reauthenticate failed:", {
      code: err.code, message: err.message,
    });
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      throw new Error("Your current password is incorrect.");
    }
    throw new Error("Your current password is incorrect.");
  }

  // Update password
  await updatePassword(user, newPassword);

  // Mark passwordChanged in Firestore
  try {
    await updateDoc(doc(db, collectionName, uid), {
      passwordChanged: true,
    });
  } catch (err) {
    console.error("[changePassword] updateDoc failed:", {
      code: err.code, message: err.message,
    });
    throw new Error(
      "Your password was changed, but we couldn't update your account status. Please contact support."
    );
  }

  await signOut(auth);
};

// ─────────────────────────────────────────────────────────────────────────────
// ISOLATED ACCOUNT CREATION — create a Firebase Auth user WITHOUT switching
// the current session to that new user (the normal client SDK behavior signs
// you in as whoever you just created, which we don't want here since a
// coordinator stays logged in as themselves while adding/creating accounts).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a Firebase Auth user without switching the current session.
 * If onCreated callback is provided and throws, the just-created Auth user is deleted.
 * This prevents orphaned Auth accounts with no Firestore doc.
 *
 * @param {string} email
 * @param {string} password
 * @param {function} [onCreated] — optional callback(uid) after Auth user is created
 * @returns {Promise<string>} the new user's UID
 */
const createAuthUserIsolated = async (email, password, onCreated) => {
  const tempApp = initializeApp(getApp().options, `temp-${Date.now()}`);
  const tempAuth = getAuth(tempApp);
  try {
    const { user } = await createUserWithEmailAndPassword(tempAuth, email, password);
    if (onCreated) {
      try {
        await onCreated(user.uid);
      } catch (err) {
        await user.delete().catch(() => {});
        throw err;
      }
    }
    return user.uid;
  } finally {
    await deleteApp(tempApp);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT — Accept coordinator-issued company assignment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accepts a coordinator-issued company assignment for a student.
 * The invite must exist in Firestore (created by coordinator) and not yet accepted.
 *
 * @param {string} inviteId — Firestore doc ID in companyInvites collection
 * @param {string} studentUid — the logged-in student's UID
 * @returns {Promise<void>}
 * @throws Error if invite not found, already accepted, or expired
 */
export const acceptCompanyInvite = async (inviteId, studentUid) => {
  const inviteRef = doc(db, "companyInvites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invite not found.");
  }

  const inviteData = inviteSnap.data();

  // Check status
  if (inviteData.status === "accepted") {
    throw new Error("This invite has already been accepted.");
  }
  if (inviteData.status === "declined") {
    throw new Error("This invite has been declined.");
  }
  if (inviteData.status === "expired") {
    throw new Error("This invite has expired.");
  }

  // Mark invite accepted
  await updateDoc(inviteRef, {
    status: "accepted",
    acceptedBy: studentUid,
    acceptedAt: serverTimestamp(),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY — Assignment query (count pending/accepted)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all student assignments (pending/accepted/declined) for a company.
 * Used by company dashboard to show the applicant list.
 *
 * @param {string} companyUid
 * @returns {Promise<object[]>} array of invite docs with status + student data
 */
export const getCompanyAssignments = async (companyUid) => {
  const q = query(collection(db, "companyInvites"), where("companyUid", "==", companyUid));
  const snap = await getDocs(q);

  // Enrich with student data
  const assignments = await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data();
      const studentSnap = await getDoc(doc(db, "students", data.studentUid));
      return {
        id: d.id,
        ...data,
        studentData: studentSnap.exists() ? studentSnap.data() : null,
      };
    })
  );

  return assignments;
};

/**
 * Counts assignments for a company by status.
 * Quick helper for dashboard stats.
 *
 * @param {string} companyUid
 * @returns {Promise<{ pending: number, accepted: number, declined: number }>}
 */
export const getCompanyAssignmentCounts = async (companyUid) => {
  const assignments = await getCompanyAssignments(companyUid);
  return {
    pending:  assignments.filter(a => a.status === "pending").length,
    accepted: assignments.filter(a => a.status === "accepted").length,
    declined: assignments.filter(a => a.status === "declined").length,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATOR — Create account (by admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new coordinator account with a temporary password.
 * The account starts with no assigned departments — they must be added separately
 * (see assignCoordinatorDepartments, removeCoordinatorDepartment).
 *
 * The department is ALWAYS taken from the inviting coordinator's own
 * Firestore profile — never from the caller — so a coordinator can only
 * ever add accounts under their own department, regardless of what the
 * client sends.
 *
 * @param {object} accountData — { name, sex, contact, email, address, password }
 * @param {string} inviterUid — the currently logged-in coordinator's UID
 * @returns {Promise<string>} the new coordinator's UID
 */
export const createCoordinatorAccount = async (accountData, inviterUid) => {
  const { name, sex, contact, email, address, password } = accountData;
  const normalizedEmail = email.trim().toLowerCase();

  // Pull the inviter's current scope so the new coordinator shares it
  const inviterSnap = await getDoc(doc(db, "coordinators", inviterUid));
  const inviterData = inviterSnap.exists() ? inviterSnap.data() : {};

  // Check if this email already exists in coordinators collection.
  // Transferred-out accounts are now fully deleted (see transferCoordinatorAccount),
  // so any doc found here is a currently active coordinator — always a conflict.
  const dupSnap = await getDocs(query(collection(db, "coordinators"), where("email", "==", normalizedEmail)));
  if (!dupSnap.empty) {
    throw new Error("An active account with that email already exists.");
  }

  const newUid = await createAuthUserIsolated(normalizedEmail, password);

  await setDoc(doc(db, "coordinators", newUid), {
    uid: newUid,
    name: name.trim(),
    sex,
    contact,
    email: normalizedEmail,
    address,
    deptSelections: inviterData.deptSelections || [],
    assignedIndustries: inviterData.assignedIndustries || [],
    role: "coordinator",
    status: "active",
    passwordChanged: false,
    profileComplete: false,
    addedBy: inviterUid,
    createdAt: serverTimestamp(),
  });

  return newUid;
};

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATOR — Transfer Account, invitation-based (hand off to a replacement
// coordinator via an emailed "Accept" link — the current account keeps full
// ─────────────────────────────────────────────────────────────────────────────
// COORDINATOR — invitation-based flows for Transfer Account and Add Account.
// Both hand off setup to the incoming coordinator via an emailed "Accept"
// link instead of the current coordinator choosing the new person's
// name/password directly. They share one Firestore collection
// (coordinatorInvites) and one set of Cloud Functions, distinguished by
// `type`:
//   - "transfer" — the CURRENT coordinator's account is removed once
//     accepted (see acceptCoordinatorInvite in functions/index.js).
//   - "add"      — a new, additional coordinator account is created; the
//     inviting coordinator keeps their own access throughout.
// ─────────────────────────────────────────────────────────────────────────────

// Random-enough token for the accept link — not a Firebase Auth credential,
// just a shared secret the emailed link carries so the accept screen (and
// the Cloud Functions behind it) can prove "this click came from that email"
// without needing the invite doc itself to be publicly readable.
const generateInviteToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Shared implementation behind initiateCoordinatorTransfer and
 * initiateCoordinatorAddition — re-confirms the current coordinator's
 * identity, then creates a pending invite doc. A Cloud Function
 * (sendCoordinatorInviteEmail) picks up the new doc and emails the incoming
 * coordinator an "Accept" link.
 */
const createCoordinatorInvite = async (type, currentUid, currentEmail, currentPassword, newCoordinatorEmail) => {
  // 1. Re-authenticate the current coordinator before doing anything.
  await signInWithEmailAndPassword(auth, currentEmail.trim().toLowerCase(), currentPassword);

  // 2. Load the current coordinator's scope to carry over to the invite.
  const currentSnap = await getDoc(doc(db, "coordinators", currentUid));
  if (!currentSnap.exists()) throw new Error("Current coordinator profile not found.");
  const currentData = currentSnap.data();

  const normalizedFromEmail = currentEmail.trim().toLowerCase();
  const normalizedToEmail   = newCoordinatorEmail.trim().toLowerCase();

  if (normalizedToEmail === normalizedFromEmail) {
    throw new Error("The new coordinator's email must be different from your own.");
  }

  // 3. The new email must not already belong to an active coordinator.
  const dupSnap = await getDocs(query(collection(db, "coordinators"), where("email", "==", normalizedToEmail)));
  if (!dupSnap.empty) {
    throw new Error("An active account with that email already exists.");
  }

  // 4. Cancel any earlier pending invites *of the same type* from this
  // coordinator so only the latest one is acceptable (avoids two valid
  // "Accept" links floating around for the same handoff/addition). A
  // pending "add" invite and a pending "transfer" invite from the same
  // coordinator are unrelated and can coexist.
  const pendingSnap = await getDocs(query(
    collection(db, "coordinatorInvites"),
    where("fromUid", "==", currentUid),
    where("type", "==", type),
    where("status", "==", "pending"),
  ));
  await Promise.all(pendingSnap.docs.map((d) => updateDoc(d.ref, { status: "cancelled" })));

  // 5. Create the invite — the Cloud Function trigger sends the email from here.
  const inviteRef = await addDoc(collection(db, "coordinatorInvites"), {
    type,
    fromUid:            currentUid,
    fromEmail:          normalizedFromEmail,
    fromName:           currentData.name || "",
    toEmail:            normalizedToEmail,
    deptSelections:     currentData.deptSelections || [],
    assignedIndustries: currentData.assignedIndustries || [],
    token:              generateInviteToken(),
    status:             "pending",
    createdAt:          serverTimestamp(),
  });

  return inviteRef.id;
};

/**
 * Starts a coordinator handoff — the CURRENT account is removed once the
 * invite is accepted. See createCoordinatorInvite for the shared mechanics.
 *
 * @param {string} currentUid
 * @param {string} currentEmail
 * @param {string} currentPassword — re-confirms identity before inviting
 * @param {string} newCoordinatorEmail
 * @returns {Promise<string>} the new invite's Firestore doc ID
 */
export const initiateCoordinatorTransfer = (currentUid, currentEmail, currentPassword, newCoordinatorEmail) =>
  createCoordinatorInvite("transfer", currentUid, currentEmail, currentPassword, newCoordinatorEmail);

/**
 * Invites an additional coordinator to join alongside the current one — the
 * inviting coordinator's own account and access are completely unaffected,
 * before or after the invite is accepted. See createCoordinatorInvite for
 * the shared mechanics.
 *
 * @param {string} currentUid
 * @param {string} currentEmail
 * @param {string} currentPassword — re-confirms identity before inviting
 * @param {string} newCoordinatorEmail
 * @returns {Promise<string>} the new invite's Firestore doc ID
 */
export const initiateCoordinatorAddition = (currentUid, currentEmail, currentPassword, newCoordinatorEmail) =>
  createCoordinatorInvite("add", currentUid, currentEmail, currentPassword, newCoordinatorEmail);

/**
 * Looks up a pending invite (transfer OR add) for the Accept screen —
 * validated server-side by the getCoordinatorInvite Cloud Function, which
 * checks the token before returning anything. The client never reads
 * coordinatorInvites directly via Firestore rules; this callable is the
 * only way to see an invite's details before it's accepted.
 *
 * @param {string} inviteId
 * @param {string} token
 * @returns {Promise<{ type: string, fromName: string, toEmail: string, deptSelections: object[] }>}
 */
export const getCoordinatorInvite = async (inviteId, token) => {
  const call = httpsCallable(functions, "getCoordinatorInvite");
  const { data } = await call({ inviteId, token });
  return data;
};

/**
 * Accepts a coordinator invite (transfer OR add): the incoming coordinator
 * chooses their own name + password here. Everything — creating the new
 * Auth account + Firestore profile, marking the invite accepted, and (for
 * type "transfer" only) removing the outgoing coordinator's doc — happens
 * server-side in the acceptCoordinatorInvite Cloud Function using Admin SDK
 * privileges.
 *
 * @param {string} inviteId
 * @param {string} token
 * @param {string} name
 * @param {string} password
 * @returns {Promise<{ uid: string }>}
 */
export const acceptCoordinatorInvite = async (inviteId, token, name, password) => {
  const call = httpsCallable(functions, "acceptCoordinatorInvite");
  const { data } = await call({ inviteId, token, name, password });
  return data;
};

