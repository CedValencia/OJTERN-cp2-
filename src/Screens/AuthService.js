// AuthService.js — reusable Firebase Auth + Firestore operations
// Import `auth` and `db` from firebase.js so everything uses the same app instance

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
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
      throw new Error("Invalid credentials. Please check and try again.");
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
    throw new Error(`This account is not registered as a ${label}.`);
  }

  // Approval status check (mainly for companies)
  if (userData.status === "pending") {
    await signOut(auth);
    throw new Error("Your account is pending admin approval. Please try again later.");
  }
  if (userData.status === "rejected") {
    await signOut(auth);
    throw new Error("Your account registration was rejected. Please contact the administrator.");
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
  const q    = query(collection(db, "students"), where("studentId", "==", studentId.trim()));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error(`Student ID "${studentId}" is already registered.`);

  // 2. Generate default password — department is derived from college abbreviation
  //    e.g. "College of Computer Studies" → coordinator passes the dept code like "CCS"
  const password = generateStudentPassword(firstName, lastName, studentId, college);

  // 3. Firebase Auth
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);

  // 4. Firestore student doc
  await setDoc(doc(db, "students", user.uid), {
    uid:            user.uid,
    studentId:      studentId.trim(),
    lastName:       lastName.trim(),
    middleInitial:  middleInitial.trim(),
    firstName:      firstName.trim(),
    fullName:       `${firstName.trim()} ${middleInitial.trim() ? middleInitial.trim() + ". " : ""}${lastName.trim()}`,
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

  return { uid: user.uid, password };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD — for first-login password change (students & coordinators)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Changes the current user's password and marks passwordChanged: true in Firestore.
 * @param {string} newPassword
 * @param {"students"|"coordinators"} collectionName
 * @param {string} uid
 */
export const changePassword = async (newPassword, collectionName, uid) => {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is currently signed in.");
  await updatePassword(user, newPassword);
  await updateDoc(doc(db, collectionName, uid), { passwordChanged: true });
};