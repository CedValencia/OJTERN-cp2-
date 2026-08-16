const { onDocumentUpdated, onDocumentDeleted, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Email on company approval
exports.sendApprovalEmail = onDocumentUpdated(
  { document: "companies/{companyId}", region: "asia-southeast1" },
  async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (oldData.status !== "approved" && newData.status === "approved") {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: newData.email,
        subject: "OJTern - Your Registration is Approved! ✅",
        html: `
          <h2>Welcome to OJTern!</h2>
          <p>Hi <strong>${newData.companyName}</strong>,</p>
          <p>Your company registration has been <strong>APPROVED</strong> by our coordinator.</p>
          <p>You can now:</p>
          <ul>
            <li>Log in to your company dashboard</li>
            <li>Post OJT positions</li>
            <li>View student applications</li>
          </ul>
          <p><a href="https://ojtern.app/login">Click here to sign in</a></p>
          <br/>
          <p>Best regards,<br/>OJTern Team</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Approval email sent to ${newData.email}`);
      } catch (error) {
        console.error("Email send failed:", error);
      }
    }
  }
);

// Email on company rejection
exports.sendRejectionEmail = onDocumentUpdated(
  { document: "companies/{companyId}", region: "asia-southeast1" },
  async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (oldData.status !== "rejected" && newData.status === "rejected") {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: newData.email,
        subject: "OJTern - Registration Status Update",
        html: `
          <h2>Registration Not Approved</h2>
          <p>Hi <strong>${newData.companyName}</strong>,</p>
          <p>Your registration was not approved.</p>
          <p><strong>Reason:</strong> ${newData.rejectionReason || "Please contact support."}</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Rejection email sent to ${newData.email}`);
      } catch (error) {
        console.error("Email send failed:", error);
      }
    }
  }
);

// Delete Firebase Auth account when student document is deleted
exports.deleteStudentAuthOnDocDelete = onDocumentDeleted(
  { document: "students/{studentId}", region: "us-central1" },
  async (event) => {
    const studentId = event.params.studentId;
    const deletedData = event.data.data();

    // Adjust this depending on how you store the Auth UID in the student doc
    const uid = deletedData.uid || studentId;

    try {
      await admin.auth().deleteUser(uid);
      console.log(`Deleted Auth account for student: ${uid}`);
    } catch (error) {
      console.error(`Failed to delete Auth account for ${uid}:`, error);
    }
  }
);

// Delete Firebase Auth account when a coordinator document is deleted.
// For the invitation-based Transfer Account flow, this is the ONLY place the
// outgoing coordinator's Auth account gets removed — acceptCoordinatorTransfer
// below deletes their Firestore doc using Admin SDK, which fires this trigger
// as a follow-up step, keeping that function focused on the handoff itself.
exports.deleteCoordinatorAuthOnDocDelete = onDocumentDeleted(
  { document: "coordinators/{coordinatorId}", region: "us-central1" },
  async (event) => {
    const coordinatorId = event.params.coordinatorId;
    const deletedData = event.data.data();
    const uid = deletedData.uid || coordinatorId;

    try {
      await admin.auth().deleteUser(uid);
      console.log(`Deleted Auth account for coordinator: ${uid}`);
    } catch (error) {
      console.error(`Failed to delete Auth account for ${uid}:`, error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATOR TRANSFER — invitation-based handoff
// ─────────────────────────────────────────────────────────────────────────────

// Fires when the client creates a coordinatorTransferInvites doc
// (AuthService.js → initiateCoordinatorTransfer). Emails the incoming
// coordinator an "Accept Invitation" link carrying the invite's doc ID +
// token — same trigger-on-write pattern as sendApprovalEmail above.
exports.sendCoordinatorTransferInviteEmail = onDocumentCreated(
  { document: "coordinatorTransferInvites/{inviteId}", region: "asia-southeast1" },
  async (event) => {
    const invite = event.data.data();
    const inviteId = event.params.inviteId;
    if (!invite || invite.status !== "pending") return;

    const acceptUrl = `https://ojtern.web.app/accept-transfer?id=${inviteId}&token=${invite.token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: invite.toEmail,
      subject: "OJTern - You've Been Invited as OJT Coordinator",
      html: `
        <h2>Coordinator Handoff Invitation</h2>
        <p>Hi,</p>
        <p><strong>${invite.fromName || invite.fromEmail}</strong> is transferring their OJT Coordinator account on OJTern to you.</p>
        <p>Click below to accept the invitation and set up your own account:</p>
        <p>
          <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#8B0000;color:#ffffff;text-decoration:none;border-radius:6px;">
            Accept Invitation
          </a>
        </p>
        <p>If you weren't expecting this, you can safely ignore this email — no account will be created unless you click the link above and complete setup.</p>
        <br/>
        <p>Best regards,<br/>OJTern Team</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Transfer invite email sent to ${invite.toEmail}`);
    } catch (error) {
      console.error("Transfer invite email send failed:", error);
    }
  }
);

// Called from the Accept Invitation screen to fetch invite details for
// display (fromName, toEmail, deptSelections) — token-validated server-side
// so the coordinatorTransferInvites collection never needs to be readable
// directly by clients via Firestore rules.
exports.getCoordinatorTransferInvite = onCall({ region: "asia-southeast1" }, async (request) => {
  const { inviteId, token } = request.data || {};
  if (!inviteId || !token) {
    throw new HttpsError("invalid-argument", "Missing invite reference.");
  }

  const db = admin.firestore();
  const snap = await db.collection("coordinatorTransferInvites").doc(inviteId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "This invitation was not found.");
  }
  const invite = snap.data();

  if (invite.token !== token) {
    throw new HttpsError("permission-denied", "Invalid invitation link.");
  }
  if (invite.status !== "pending") {
    throw new HttpsError("failed-precondition", "This invitation is no longer valid.");
  }

  return {
    fromName: invite.fromName || invite.fromEmail,
    toEmail: invite.toEmail,
    deptSelections: invite.deptSelections || [],
  };
});

// Called from the Accept Invitation screen once the incoming coordinator has
// chosen their own name + password. Runs entirely server-side with Admin SDK
// privileges: creates their Auth account + Firestore profile, marks the
// invite accepted, then deletes the outgoing coordinator's Firestore doc —
// which cascades into deleteCoordinatorAuthOnDocDelete above to clean up
// their Auth account.
exports.acceptCoordinatorTransfer = onCall({ region: "asia-southeast1" }, async (request) => {
  const { inviteId, token, name, password } = request.data || {};

  if (!inviteId || !token || !name || !password) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (password.length < 8) {
    throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
  }

  const db = admin.firestore();
  const inviteRef = db.collection("coordinatorTransferInvites").doc(inviteId);
  const inviteSnap = await inviteRef.get();

  if (!inviteSnap.exists) {
    throw new HttpsError("not-found", "This invitation was not found.");
  }
  const invite = inviteSnap.data();

  if (invite.token !== token) {
    throw new HttpsError("permission-denied", "Invalid invitation link.");
  }
  if (invite.status !== "pending") {
    throw new HttpsError("failed-precondition", "This invitation is no longer valid.");
  }

  const normalizedEmail = invite.toEmail;

  // Double-check the email is still free — it could have been taken between
  // when the invite was created and now.
  const dupSnap = await db.collection("coordinators").where("email", "==", normalizedEmail).get();
  if (!dupSnap.empty) {
    throw new HttpsError("already-exists", "An active account with that email already exists.");
  }

  // Admin SDK user creation doesn't touch any client session — unlike the
  // client SDK's createUserWithEmailAndPassword, nobody gets signed in as
  // this new user as a side effect.
  const newUser = await admin.auth().createUser({
    email: normalizedEmail,
    password,
    displayName: name.trim(),
  });

  try {
    await db.collection("coordinators").doc(newUser.uid).set({
      uid: newUser.uid,
      name: name.trim(),
      email: normalizedEmail,
      sex: "",
      contact: "",
      address: "",
      deptSelections: invite.deptSelections || [],
      assignedIndustries: invite.assignedIndustries || [],
      role: "coordinator",
      status: "active",
      passwordChanged: true, // they just chose it themselves during accept
      profileComplete: false,
      transferredFrom: invite.fromUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Roll back the orphaned Auth account if the Firestore write fails.
    await admin.auth().deleteUser(newUser.uid).catch(() => {});
    throw new HttpsError("internal", "Failed to create the new coordinator profile.");
  }

  await inviteRef.update({
    status: "accepted",
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Remove the outgoing coordinator's Firestore doc — this fires
  // deleteCoordinatorAuthOnDocDelete above to clean up their Auth account.
  await db.collection("coordinators").doc(invite.fromUid).delete().catch((err) => {
    console.error(`Failed to remove outgoing coordinator doc ${invite.fromUid}:`, err);
  });

  return { uid: newUser.uid };
});