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
  getDocs,
  addDoc,
  serverTimestamp,
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
  // This prevents pending/rejected companies from logging in
  if (role === "company") {
    const q    = query(collection(db, "companies"), where("email", "==", loginEmail.trim().toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const status = snap.docs[0].data().status;
      if (status === "pending") {
        throw new Error("Your account is pending coordinator approval. Please wait before signing in.");
      }
      if (status === "rejected") {
        throw new Error("Your account registration was rejected. Please contact the administrator.");
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

  // Approval status check (mainly for companies)
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
// PASSWORD RESET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a password-reset email only if the email exists in Firestore
 * (checks coordinators, students, and companies collections).
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

  if (!found) throw new Error("If an account is associated with this email, you will receive a password reset link shortly");

  // handleCodeInApp: true means the emailed link points at OUR OWN
  // /reset-password route (with the oobCode as a query param) instead of
  // Firebase's generic hosted reset page — so the whole flow, including the
  // final "OK, back to Sign In" step, stays inside OJTern's own UI rather
  // than bouncing through an unbranded Firebase page (and never opens a
  // second tab on its own — ResetPasswordScreen navigates back to /signin
  // in the same tab the link was opened in).
  //
  // NOTE: for the link to actually land on /reset-password instead of
  // Firebase's hosted page, a "Customize action URL" must also be set in
  // Firebase Console → Authentication → Templates → Password reset, to
  // https://ojtern.web.app/reset-password. Without that Console setting,
  // the email link still opens Firebase's own hosted page regardless of
  // what's passed here.
  await sendPasswordResetEmail(auth, normalized, {
    url: "https://ojtern.web.app/reset-password",
    handleCodeInApp: true,
  });
};

/**
 * Verifies a password-reset oobCode from the emailed link and returns the
 * email address it belongs to — called by ResetPasswordScreen on mount to
 * confirm the link is still valid before showing the "set new password" form.
 * @param {string} oobCode
 * @returns {Promise<string>} the account email this code was issued for
 */
export const verifyResetCode = (oobCode) => verifyPasswordResetCode(auth, oobCode);

/**
 * Completes a password reset using the oobCode from the emailed link —
 * called by ResetPasswordScreen once the person submits their new password.
 * @param {string} oobCode
 * @param {string} newPassword
 */
export const confirmReset = (oobCode, newPassword) => confirmPasswordReset(auth, oobCode, newPassword);

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATOR — accept / decline a company
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
// COORDINATOR ACTIVITY LOG
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
 * Format: firstInitial + lastName + last3DigitsOfStudentId + "." + department
 * e.g. firstName "Juan", lastName "Dela Cruz", studentId "2021-00123", dept "CCS"  →  "jdelacruz123.ccs"
 *
 * @param {string} lastName
 * @param {string} department  — e.g. "CCS", "COE", "CBA"
 * @returns {string}
 */
export const generateStudentPassword = (firstName, lastName, studentId, department) => {
  const firstInitial = firstName.trim()[0].toLowerCase();
  const cleanLast    = lastName.trim().toLowerCase().replace(/\s+/g, "");
  const last3        = String(studentId).trim().replace(/\D/g, "").slice(-3);
  const cleanDept    = department.trim().toLowerCase();
  return `${firstInitial}${cleanLast}${last3}.${cleanDept}`;
};

/**
 * Creates a student account.
 * Called by the coordinator from the student account creation form.
 *
 * Steps:
 *  1. Check if studentId already exists in Firestore (prevent duplicates)
 *  2. Generate default password from lastName + department
 *  3. Create Firebase Auth user with the student's email + generated password
 *  4. Write student profile to Firestore (students/{uid})
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
  // 2. Generate default password — department is derived from college abbreviation
  //    e.g. "College of Computer Studies" → coordinator passes the dept code like "CCS"
  const password = generateStudentPassword(firstName, lastName, studentId, college);

  // 3. Firebase Auth — isolated so it doesn't sign the coordinator out of their own session.
  //    The Firestore write happens inside onCreated: if it fails (e.g. rules reject it),
  //    the Auth user we just made gets rolled back instead of becoming an orphaned account.
  const uid = await createAuthUserIsolated(email.trim(), password, async (newUid) => {
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
      email:          email.trim(),
      role:             "student",
      status:           "active",
      passwordChanged:  false,
      createdBy:        createdByUid,
      createdAt:        serverTimestamp(),
    });
  });

  return { uid, password };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD — for first-login password change (students & coordinators)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Changes the current user's password and marks passwordChanged: true in Firestore,
 * then signs the user out so they land back on the sign-in screen and log in fresh
 * with their new password.
 *
 * Reauthenticates first, since Firebase's updatePassword requires a "recent login"
 * (this is what throws auth/requires-recent-login if skipped).
 *
 * @param {string} currentPassword — the user's existing password, used to reauthenticate
 * @param {string} newPassword
 * @param {"students"|"coordinators"} collectionName
 * @param {string} uid
 */
export const changePassword = async (currentPassword, newPassword, collectionName, uid, email) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No user is currently signed in.");
  }

  // Use the email parameter if provided, otherwise fall back to currentUser.email
  const userEmail = email || user.email;
  if (!userEmail) {
    throw new Error("Unable to verify user email. Please try logging in again.");
  }

  // Reauthenticate with the current password before Firebase will allow
  // updatePassword — this was the missing step causing auth/requires-recent-login.
  const credential = EmailAuthProvider.credential(userEmail, currentPassword);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (err) {
    // Log full details so we can see exactly what Firebase actually
    // returned — some SDK versions throw a raw, uncoded error instead of
    // a proper auth/wrong-password code when the backend's error format
    // changes, which otherwise shows up in the UI as a cryptic crash.
    console.error("[changePassword] reauthenticate failed:", {
      code: err.code, name: err.name, message: err.message,
      emailUsed: userEmail, passwordLength: currentPassword?.length,
    });
    if (
      err.code === "auth/wrong-password" ||
      err.code === "auth/invalid-credential"
    ) {
      throw new Error("Your current password is incorrect.");
    }
    // Any other failure (including raw SDK crashes with no .code) —
    // still treat as a credential problem rather than leaking the
    // internal error message to the user.
    throw new Error("Your current password is incorrect.");
  }

  await updatePassword(user, newPassword);

  try {
    await updateDoc(doc(db, collectionName, uid), {
      passwordChanged: true,
    });
  } catch (err) {
    // If this fails (e.g. a Firestore rules issue), the password itself
    // has ALREADY changed successfully above — but the app will keep
    // showing the "Set New Password" screen forever since the flag
    // never got set. Log full details so we can see exactly why.
    console.error("[changePassword] updateDoc(passwordChanged) failed:", {
      code: err.code, message: err.message, collectionName, uid,
    });
    throw new Error(
      "Your password was changed, but we couldn't update your account status. Please contact support — do not try changing your password again."
    );
  }

  await signOut(auth);
};

// ─────────────────────────────────────────────────────────────────────────────
// ISOLATED ACCOUNT CREATION — create a Firebase Auth user WITHOUT switching
// the current session to that new user (the normal client SDK behavior signs
// you in as whoever you just created, which we don't want here since a
// coordinator stays logged in as themselves while adding/transferring).
// ─────────────────────────────────────────────────────────────────────────────
// onCreated(uid) runs right after the Auth user is made (e.g. the Firestore
// profile write). If it throws, the just-created Auth user is deleted so we
// never leave an orphaned Auth account with no Firestore doc behind.
const createAuthUserIsolated = async (email, password, onCreated) => {
  const tempApp = initializeApp(getApp().options,`temp-${Date.now()}`);
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
// COORDINATOR — Add Account (a second coordinator who shares the same
// department / assigned industries, so both can manage the same companies)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new coordinator account that shares the inviting coordinator's
 * department selections and assigned industries.
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