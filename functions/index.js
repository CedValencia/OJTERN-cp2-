// functions/index.js
// Deploy with: firebase deploy --only functions

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp }      = require("firebase-admin/app");
const { getAuth }            = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

/**
 * approveCompany — called by coordinator when they click "Accept"
 *
 * What it does:
 *  1. Fetches the pending company doc from Firestore
 *  2. Creates a Firebase Auth account using the stored email + password
 *  3. Updates the Firestore doc:
 *       - uid        → new Auth UID
 *       - status     → "approved"
 *       - approvedBy → coordinatorUid
 *       - approvedAt → now
 *       - password   → deleted (no longer needed)
 *  4. Re-saves the doc under the new UID as the document ID
 *     (so signIn can look up companies/{uid})
 */
exports.approveCompany = onCall(async (request) => {
  const { companyId, coordinatorUid } = request.data;

  if (!companyId || !coordinatorUid) {
    throw new HttpsError("invalid-argument", "Missing companyId or coordinatorUid.");
  }

  const db   = getFirestore();
  const auth = getAuth();

  // 1. Get the pending company doc
  const companyRef  = db.collection("companies").doc(companyId);
  const companySnap = await companyRef.get();

  if (!companySnap.exists) {
    throw new HttpsError("not-found", "Company not found.");
  }

  const companyData = companySnap.data();

  if (companyData.status !== "pending") {
    throw new HttpsError("failed-precondition", "Company is not pending approval.");
  }

  // 2. Create Firebase Auth account
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email:    companyData.email,
      password: companyData.password,
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      // Auth account already exists (e.g. approved twice) — fetch the existing one
      userRecord = await auth.getUserByEmail(companyData.email);
    } else {
      throw new HttpsError("internal", `Failed to create Auth account: ${err.message}`);
    }
  }

  const newUid = userRecord.uid;

  // 3. Create a new Firestore doc with the Auth UID as the document ID
  const newDocRef = db.collection("companies").doc(newUid);
  await newDocRef.set({
    ...companyData,
    uid:        newUid,
    status:     "approved",
    approvedBy: coordinatorUid,
    approvedAt: FieldValue.serverTimestamp(),
    password:   FieldValue.delete(), // remove stored password
  });

  // 4. Delete the old pending doc (which had an auto-generated ID)
  if (companyId !== newUid) {
    await companyRef.delete();
  }

  return { success: true, uid: newUid };
});