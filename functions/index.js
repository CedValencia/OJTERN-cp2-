const { onDocumentUpdated, onDocumentDeleted, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;

admin.initializeApp();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Cloudinary's destroy API requires an authenticated (signed) request — the
// API key/secret must never be exposed to clients, which is why this can't
// be done from CloudinaryService.js in the app itself. Defined as secrets so
// they're not sitting in plaintext functions config; set them once with:
//   firebase functions:secrets:set 519716276839678
//   firebase functions:secrets:set p0GGy-4TjcUZIGHNc3t5HO877Ys
const cloudinaryApiKey    = defineSecret("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = defineSecret("CLOUDINARY_API_SECRET");

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
      await getAuth().deleteUser(uid);
      console.log(`Deleted Auth account for student: ${uid}`);
    } catch (error) {
      console.error(`Failed to delete Auth account for ${uid}:`, error);
    }
  }
);

// Delete Firebase Auth account when a coordinator document is deleted.
// For the invitation-based Transfer Account flow, this is the ONLY place the
// outgoing coordinator's Auth account gets removed — acceptCoordinatorInvite
// below deletes their Firestore doc using Admin SDK (transfer invites only),
// which fires this trigger as a follow-up step, keeping that function
// focused on the handoff itself.
exports.deleteCoordinatorAuthOnDocDelete = onDocumentDeleted(
  { document: "coordinators/{coordinatorId}", region: "us-central1" },
  async (event) => {
    const coordinatorId = event.params.coordinatorId;
    const deletedData = event.data.data();
    const uid = deletedData.uid || coordinatorId;

    try {
      await getAuth().deleteUser(uid);
      console.log(`Deleted Auth account for coordinator: ${uid}`);
    } catch (error) {
      console.error(`Failed to delete Auth account for ${uid}:`, error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATOR INVITES — invitation-based Transfer Account and Add Account.
// Both flows share one collection (coordinatorInvites) and these three
// functions, distinguished by each invite doc's `type`:
//   - "transfer" — accepting REMOVES the inviting coordinator's account.
//   - "add"      — accepting creates an additional account; the inviting
//     coordinator's own account is left completely untouched.
// ─────────────────────────────────────────────────────────────────────────────

const INVITE_COPY = {
  transfer: {
    subject: "OJTern - You've Been Invited as OJT Coordinator",
    heading: "Coordinator Handoff Invitation",
    body: (invite) => `<strong>${invite.fromName || invite.fromEmail}</strong> is transferring their OJT Coordinator account on OJTern to you.`,
  },
  add: {
    subject: "OJTern - You've Been Invited to Join as OJT Coordinator",
    heading: "Coordinator Invitation",
    body: (invite) => `<strong>${invite.fromName || invite.fromEmail}</strong> is inviting you to join OJTern as an additional OJT Coordinator.`,
  },
};

// Fires when the client creates a coordinatorInvites doc
// (AuthService.js → initiateCoordinatorTransfer / initiateCoordinatorAddition).
// Emails the incoming coordinator an "Accept Invitation" link carrying the
// invite's doc ID + token — same trigger-on-write pattern as
// sendApprovalEmail above. Wording adapts to invite.type.
exports.sendCoordinatorInviteEmail = onDocumentCreated(
  { document: "coordinatorInvites/{inviteId}", region: "asia-southeast1" },
  async (event) => {
    const invite = event.data.data();
    const inviteId = event.params.inviteId;
    if (!invite || invite.status !== "pending") return;

    const copy = INVITE_COPY[invite.type] || INVITE_COPY.add;
    const acceptUrl = `https://ojtern.web.app/accept-invite?id=${inviteId}&token=${invite.token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: invite.toEmail,
      subject: copy.subject,
      html: `
        <h2>${copy.heading}</h2>
        <p>Hi,</p>
        <p>${copy.body(invite)}</p>
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
      console.log(`Coordinator invite (${invite.type}) email sent to ${invite.toEmail}`);
    } catch (error) {
      console.error("Coordinator invite email send failed:", error);
    }
  }
);

// Called from the Accept Invitation screen to fetch invite details for
// display (type, fromName, toEmail, deptSelections) — token-validated
// server-side so the coordinatorInvites collection never needs to be
// readable directly by clients via Firestore rules.
exports.getCoordinatorInvite = onCall({ region: "asia-southeast1" }, async (request) => {
  const { inviteId, token } = request.data || {};
  if (!inviteId || !token) {
    throw new HttpsError("invalid-argument", "Missing invite reference.");
  }

  const db = getFirestore();
  const snap = await db.collection("coordinatorInvites").doc(inviteId).get();
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
    type: invite.type || "add",
    fromName: invite.fromName || invite.fromEmail,
    toEmail: invite.toEmail,
    deptSelections: invite.deptSelections || [],
  };
});

// Called from the Accept Invitation screen once the incoming coordinator has
// chosen their own name + password. Runs entirely server-side with Admin SDK
// privileges: creates their Auth account + Firestore profile, marks the
// invite accepted, and — ONLY for type "transfer" — deletes the outgoing
// coordinator's Firestore doc, which cascades into
// deleteCoordinatorAuthOnDocDelete above to clean up their Auth account.
// For type "add", the inviting coordinator's own doc/account is never
// touched.
exports.acceptCoordinatorInvite = onCall({ region: "asia-southeast1" }, async (request) => {
  const { inviteId, token, name, password } = request.data || {};

  if (!inviteId || !token || !name || !password) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (password.length < 8) {
    throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
  }

  const db = getFirestore();
  const inviteRef = db.collection("coordinatorInvites").doc(inviteId);
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
  const isTransfer = invite.type === "transfer";

  // Double-check the email is still free — it could have been taken between
  // when the invite was created and now.
  const dupSnap = await db.collection("coordinators").where("email", "==", normalizedEmail).get();
  if (!dupSnap.empty) {
    throw new HttpsError("already-exists", "An active account with that email already exists.");
  }

  // Admin SDK user creation doesn't touch any client session — unlike the
  // client SDK's createUserWithEmailAndPassword, nobody gets signed in as
  // this new user as a side effect.
  const newUser = await getAuth().createUser({
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
      // Only meaningful for transfer invites; harmless to record for "add"
      // too as provenance of who invited them.
      transferredFrom: isTransfer ? invite.fromUid : null,
      invitedBy: invite.fromUid,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Roll back the orphaned Auth account if the Firestore write fails.
    await getAuth().deleteUser(newUser.uid).catch(() => {});
    throw new HttpsError("internal", "Failed to create the new coordinator profile.");
  }

  await inviteRef.update({
    status: "accepted",
    acceptedAt: FieldValue.serverTimestamp(),
  });

  if (isTransfer) {
    // Remove the outgoing coordinator's Firestore doc — this fires
    // deleteCoordinatorAuthOnDocDelete above to clean up their Auth account.
    await db.collection("coordinators").doc(invite.fromUid).delete().catch((err) => {
      console.error(`Failed to remove outgoing coordinator doc ${invite.fromUid}:`, err);
    });
  }
  // type "add" — nothing further to do; the inviting coordinator keeps
  // their own account exactly as it was.

  return { uid: newUser.uid };
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ATTACHMENT CLEANUP — when a message is unsent, its Cloudinary
// file(s) should stop existing, not just stop being shown. unsendMessage
// in useChat.js clears the message's `attachments` field to null as part of
// the same write that sets `unsent: true` — this trigger reads the
// PRE-update (`before`) attachments off that write and deletes each one
// from Cloudinary. Runs after the fact (fire-and-forget from the client's
// point of view); a failure here just leaves an orphaned file in Cloudinary,
// it doesn't affect anything the user sees.
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteUnsentAttachments = onDocumentUpdated(
  {
    document: "conversations/{convId}/messages/{msgId}",
    region: "asia-southeast1",
    secrets: [cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // Only act on the specific transition unsendMessage performs: wasn't
    // unsent before, is unsent now, and there were attachments to clean up.
    // (Guards against re-running on later unrelated edits to the same doc,
    // since by then `before.attachments` will already be null.)
    if (before.unsent || !after.unsent) return;
    const attachments = before.attachments || (before.attachment ? [before.attachment] : []);
    if (attachments.length === 0) return;

    cloudinary.config({
      cloud_name: "doalndt5l", // matches CLOUDINARY_CLOUD_NAME in CloudinaryService.js
      api_key:    cloudinaryApiKey.value(),
      api_secret: cloudinaryApiSecret.value(),
    });

    for (const att of attachments) {
      // Attachments sent before this feature shipped won't have a publicId —
      // nothing to do for those, they're just orphaned in Cloudinary already.
      if (!att.publicId) {
        console.warn(`Skipping Cloudinary cleanup — no publicId on attachment "${att.name}"`);
        continue;
      }
      try {
        await cloudinary.uploader.destroy(att.publicId, {
          resource_type: att.resourceType || "image",
        });
        console.log(`Deleted Cloudinary asset ${att.publicId}`);
      } catch (error) {
        console.error(`Failed to delete Cloudinary asset ${att.publicId}:`, error);
      }
    }
  }
);