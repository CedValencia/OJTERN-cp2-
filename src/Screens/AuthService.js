// AuthService.js — reusable Firebase Auth + Firestore operations
// Import auth and db from firebase.js so everything uses the same app instance

import { initializeApp, getApp, deleteApp } from "firebase/app";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
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

import { auth, db } from "./firebase";

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
     throw new Error("Invalid password. Please check and try again.");
    }
    throw err;
  }

  const { user } = userCredential;

  // Fetch Firestore profile
  const userSnap = await getDoc(doc(db, collectionMap[role], user.uid));
  if (!userSnap.exists()) {
    await signOut(auth);
    throw new Error("Account not found in the system. Please contact your administrator.");
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

  if (!found) throw new Error("No account found with that email address.");

  await sendPasswordResetEmail(auth, normalized);
};

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
// COORDINATOR — Transfer Account (hand off to a replacement coordinator;
// the current account permanently loses access once transferred)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transfers a coordinator's department/industry scope to a brand-new
 * coordinator account, then revokes the current account's access.
 *
 * @param {string} currentUid       — the coordinator initiating the transfer
 * @param {string} currentEmail     — used to re-confirm identity before transferring
 * @param {string} currentPassword  — used to re-confirm identity before transferring
 * @param {object} newAccountData   — { name, email, password }
 * @returns {Promise<string>} the new coordinator's UID
 */
export const transferCoordinatorAccount = async (currentUid, currentEmail, currentPassword, newAccountData) => {
  // 1. Re-authenticate the current coordinator before doing anything irreversible.
  // This also makes `auth.currentUser` the current coordinator on the MAIN auth
  // instance, which is what lets step 5 below delete their own Auth account
  // directly (a user can always delete themselves — no admin needed).
  const { user: reauthedUser } = await signInWithEmailAndPassword(auth, currentEmail.trim().toLowerCase(), currentPassword);

  // 2. Load the current coordinator's scope to carry over
  const currentSnap = await getDoc(doc(db, "coordinators", currentUid));
  if (!currentSnap.exists()) throw new Error("Current coordinator profile not found.");
  const currentData = currentSnap.data();

  // 3. New coordinator account — must be a brand-new email. Since transferred-out
  // accounts are now fully deleted (see step 5), there is no "reactivate a
  // transferred stub" case anymore: any existing doc with this email is a
  // currently active coordinator, which is always a conflict.
  const { name, email, password } = newAccountData;
  const normalizedEmail = email.trim().toLowerCase();

  const dupSnap = await getDocs(query(collection(db, "coordinators"), where("email", "==", normalizedEmail)));
  if (!dupSnap.empty) {
    throw new Error("An active account with that email already exists.");
  }

  const newUid = await createAuthUserIsolated(normalizedEmail, password);
  await setDoc(doc(db, "coordinators", newUid), {
    uid: newUid,
    name: name.trim(),
    email: normalizedEmail,
    sex: "",
    contact: "",
    address: "",
    deptSelections: currentData.deptSelections || [],
    assignedIndustries: currentData.assignedIndustries || [],
    role: "coordinator",
    status: "active",
    passwordChanged: false,
    profileComplete: false,
    transferredFrom: currentUid,
    createdAt: serverTimestamp(),
  });

  // 4. Fully delete the current coordinator's Firestore document — not just
  // flag it. This frees up their email immediately (no lingering doc to
  // collide with later, whether they sign up as a company/student/coordinator
  // again). Deleting this doc also fires the deleteCoordinatorAuthOnDocDelete
  // Cloud Function as a safety-net cleanup of the Auth account server-side.
  await deleteDoc(doc(db, "coordinators", currentUid));

  // 5. Delete the current coordinator's own Firebase Auth account directly.
  // This is the client SDK's "delete the currently signed-in user" call — it
  // does NOT require Admin SDK privileges because reauthedUser is deleting
  // themselves, and it also immediately signs them out, so the old email is
  // free to be reused (by a new sign-up, or by this same person again) right
  // away rather than waiting on the Cloud Function trigger to propagate.
  await reauthedUser.delete().catch((err) => {
    // If this ever fails (e.g. a stale token), the Firestore doc is already
    // gone and the deleteCoordinatorAuthOnDocDelete Cloud Function will still
    // clean up the Auth account shortly after as a fallback.
    console.error("[transferCoordinatorAccount] Auth self-delete failed, relying on Cloud Function fallback:", err);
  });

  return newUid;
};