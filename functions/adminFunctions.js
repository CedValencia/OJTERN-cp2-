// functions/adminFunctions.js
// Callable Cloud Functions for the separate ADMIN account (admins/{uid}).
// Admins are NOT coordinators: they have no coordinators/{uid} doc, and nobody
// can become one from the client (the `admins` collection is write-protected in
// firestore.rules; admins are created by hand in the Firebase Console).
//
// An admin signs in with a USERNAME + password. Firebase Auth only knows emails, so the
// username is mapped to a system address (<username>@admin.ojtern.local) that nobody can
// receive mail at: the same idea as student accounts. Forgot password therefore goes to
// the admin's real RECOVERY email, stored on admins/{uid}.recoveryEmail.
//
// admins/{uid} fields:
//   role: "admin"   status: "active"   name: "OJT Office"
//   username: "admin"                          (lowercase letters, digits, . _ -)
//   email: "admin@admin.ojtern.local"          (the Firebase Auth login address)
//   recoveryEmail: "ojt.office@school.edu.ph"  (a real inbox, used only by Forgot password)
//
// Loaded from the bottom of index.js, which hands over its shared mail helper:
//   Object.assign(exports, require("./adminFunctions")({ sendMail, resendApiKey }));
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("crypto");

const REGION = "asia-southeast1";
const ADMIN_LOGIN_DOMAIN = "admin.ojtern.local";          // keep in sync with AdminScreen.jsx
const ADMIN_RESET_COOLDOWN_MS = 60 * 1000;
const STALE_INVITE_AFTER_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v) => String(v ?? "").trim();
const sameText = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();

// The caller must be signed in AND have an active admins/{uid} doc.
const requireAdmin = async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  const snap = await getFirestore().collection("admins").doc(request.auth.uid).get();
  if (!snap.exists || snap.get("role") !== "admin" || snap.get("status") !== "active") {
    throw new HttpsError("permission-denied", "Administrator access required.");
  }
  const loginEmail = snap.get("email") || request.auth.token.email || "";
  return {
    uid: request.auth.uid,
    name: snap.get("name") || "",
    // A real inbox if there is one; the system login address is never shown to anyone.
    email: clean(snap.get("recoveryEmail")) || (loginEmail.endsWith(`@${ADMIN_LOGIN_DOMAIN}`) ? "" : loginEmail),
  };
};

// Checks every { department, program, specialization } against the live
// `departments` collection and returns a cleaned copy. Program and major are
// optional: an empty program means "the whole department".
const validateDeptSelections = async (db, input) => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new HttpsError("invalid-argument", "Choose at least one department.");
  }
  if (input.length > 10) throw new HttpsError("invalid-argument", "Too many departments.");

  const snap = await db.collection("departments").get();
  if (snap.empty) {
    throw new HttpsError("failed-precondition", "The departments list is not set up in Firestore yet. Open the Departments tab and seed it first.");
  }
  const catalog = snap.docs.map((d) => {
    const data = d.data();
    const programs = (Array.isArray(data.programs) ? data.programs : [])
      .map((p) => (typeof p === "string"
        ? { name: clean(p), specializations: [] }
        : { name: clean(p?.name), specializations: (p?.specializations || []).map(clean) }))
      .filter((p) => p.name);
    return { name: clean(data.name || d.id), programs };
  });

  const out = [];
  for (const sel of input) {
    const dept = catalog.find((d) => sameText(d.name, sel?.department));
    if (!dept) throw new HttpsError("invalid-argument", `Unknown department: ${clean(sel?.department) || "(blank)"}.`);

    let program = "";
    let specialization = "";
    if (clean(sel?.program)) {
      const prog = dept.programs.find((p) => sameText(p.name, sel.program));
      if (!prog) throw new HttpsError("invalid-argument", `"${clean(sel.program)}" is not a program of ${dept.name}.`);
      program = prog.name;
      if (clean(sel?.specialization)) {
        const spec = prog.specializations.find((s) => sameText(s, sel.specialization));
        if (!spec) throw new HttpsError("invalid-argument", `"${clean(sel.specialization)}" is not a major of ${prog.name}.`);
        specialization = spec;
      }
    } else if (clean(sel?.specialization)) {
      throw new HttpsError("invalid-argument", "Choose a program before choosing a major.");
    }

    const dup = out.some((o) => o.department === dept.name && o.program === program && o.specialization === specialization);
    if (!dup) out.push({ department: dept.name, program, specialization });
  }
  return out;
};

// ── Admin notifications ─────────────────────────────────────────────────────────
// Written with the Admin SDK into notifications/{id}, addressed with recipientId = the admin's uid.
// firestore.rules already lets a recipient read and update their own, so no rule changes are needed.
const notifyAdmin = (db, adminUid, type, message) =>
  db.collection("notifications").add({
    type,
    recipientRole: "admin",
    recipientId:   adminUid,
    message,
    read:          false,
    createdAt:     FieldValue.serverTimestamp(),
  });

const isAdminUid = async (db, uid) => {
  if (!uid) return false;
  const snap = await db.collection("admins").doc(uid).get();
  return snap.exists && snap.get("role") === "admin" && snap.get("status") === "active";
};

const departmentsOf = (deptSelections) =>
  [...new Set((Array.isArray(deptSelections) ? deptSelections : []).map((d) => clean(d?.department)).filter(Boolean))];

// A coordinator an admin invited has just finished the first-login setup (profileComplete false → true).
// Returns true when a notification was written.
const handleCoordinatorUpdated = async (db, before, after) => {
  if (!before || !after) return false;
  if (before.profileComplete === true || after.profileComplete !== true) return false;
  if (!(await isAdminUid(db, after.invitedBy))) return false;   // only people an ADMIN invited
  const who = clean(after.name) || clean(after.email) || "A coordinator";
  const depts = departmentsOf(after.deptSelections);
  await notifyAdmin(db, after.invitedBy, "coordinator_setup_completed",
    `${who} completed their account setup${depts.length ? ` (${depts.join(", ")})` : ""} and is ready to use OJTern.`);
  return true;
};

// One reminder per admin-created invitation that is still pending after STALE_INVITE_AFTER_DAYS.
// Equality filters only (no composite index); the age check is done here. `staleNotifiedAt` makes it once per invite.
const sendStaleInviteReminders = async (db, now = Date.now()) => {
  const cutoff = now - STALE_INVITE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const snap = await db.collection("coordinatorInvites")
    .where("createdByAdmin", "==", true).where("status", "==", "pending").get();
  let sent = 0;
  for (const d of snap.docs) {
    const v = d.data();
    const created = v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : 0;
    if (!created || created > cutoff || v.staleNotifiedAt) continue;
    if (!(await isAdminUid(db, v.fromUid))) continue;
    await notifyAdmin(db, v.fromUid, "coordinator_invite_stale",
      `The invitation sent to ${v.toEmail} hasn't been accepted after ${STALE_INVITE_AFTER_DAYS} days.`);
    await d.ref.update({ staleNotifiedAt: FieldValue.serverTimestamp() });
    sent += 1;
  }
  return sent;
};

module.exports = ({ sendMail, resendApiKey }) => {
  const fns = {};

  // Creates a coordinator invite on behalf of the admin. It reuses the existing
  // invite pipeline end to end: the sendCoordinatorInviteEmail trigger emails the
  // link, and acceptCoordinatorInvite creates the Auth user + coordinators/{uid}
  // doc (with these deptSelections) once the person sets their own name and password.
  // No temporary password is ever created or shared.
  fns.adminInviteCoordinator = onCall({ region: REGION }, async (request) => {
    const adminUser = await requireAdmin(request);
    const db = getFirestore();

    const toEmail = clean(request.data?.email).toLowerCase();
    if (!EMAIL_RE.test(toEmail)) throw new HttpsError("invalid-argument", "Enter a valid email address.");

    const deptSelections = await validateDeptSelections(db, request.data?.deptSelections);

    const dup = await db.collection("coordinators").where("email", "==", toEmail).get();
    if (!dup.empty) throw new HttpsError("already-exists", "A coordinator account with that email already exists.");

    // Accepting the invite creates a Firebase Auth login for this email. If one already exists
    // (for example a leftover from an account that was removed only from Firestore), accepting would
    // fail, so say so now instead of sending a link that can't work.
    let existingLogin = null;
    try { existingLogin = await getAuth().getUserByEmail(toEmail); }
    catch (e) { if (e?.code !== "auth/user-not-found") throw e; }
    if (existingLogin) {
      throw new HttpsError("already-exists", "That email already has a login in OJTern (it may be a leftover account). Remove it under Authentication > Users in the Firebase Console, or invite a different email.");
    }

    // Only the latest invite for an email stays valid.
    const pending = await db.collection("coordinatorInvites")
      .where("toEmail", "==", toEmail).where("status", "==", "pending").get();
    await Promise.all(pending.docs.map((d) => d.ref.update({ status: "cancelled" })));

    const ref = await db.collection("coordinatorInvites").add({
      type:               "add",                       // accepted exactly like a normal "add" invite
      fromUid:            adminUser.uid,
      fromEmail:          adminUser.email,
      fromName:           adminUser.name || "OJTern Administrator",
      toEmail,
      deptSelections,
      assignedIndustries: [],
      token:              crypto.randomBytes(24).toString("hex"),
      status:             "pending",
      createdByAdmin:     true,
      createdAt:          FieldValue.serverTimestamp(),
    });
    return { inviteId: ref.id };
  });

  // Changes which department(s)/program(s) an existing coordinator covers.
  fns.adminSetCoordinatorDepartments = onCall({ region: REGION }, async (request) => {
    await requireAdmin(request);
    const db = getFirestore();

    const uid = clean(request.data?.uid);
    if (!uid) throw new HttpsError("invalid-argument", "Missing coordinator.");
    const ref = db.collection("coordinators").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Coordinator not found.");

    const deptSelections = await validateDeptSelections(db, request.data?.deptSelections);
    await ref.update({ deptSelections, deptUpdatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
  });

  // ADMIN FORGOT PASSWORD: no sign-in needed (they can't sign in). Takes the username,
  // finds admins/{uid}, and mails a reset link to the admin's RECOVERY email, because the
  // login address (<username>@admin.ojtern.local) can't receive mail. Same approach as
  // requestStudentPasswordReset.
  //
  // Every path answers identically (unknown username, inactive admin, no recovery email,
  // cooldown, send failure), so this can't be used to find out which usernames exist.
  // Failures are only logged.
  fns.adminRequestPasswordReset = onCall({ region: REGION, secrets: [resendApiKey] }, async (request) => {
    const ident = clean(request.data?.username).toLowerCase();
    if (!ident || ident.length > 254) throw new HttpsError("invalid-argument", "Enter your username.");

    const genericOk = { sent: true };
    try {
      const db = getFirestore();
      let found = await db.collection("admins").where("username", "==", ident).limit(1).get();
      if (found.empty) found = await db.collection("admins").where("email", "==", ident).limit(1).get();
      if (found.empty) { console.log("Admin reset requested for unknown identifier."); return genericOk; }

      const adminRef = found.docs[0].ref;
      const uid = found.docs[0].id;
      const a = found.docs[0].data();
      if (a.role !== "admin" || a.status !== "active") { console.log(`Admin reset skipped for ${uid}: not an active admin.`); return genericOk; }

      const loginEmailOnDoc = clean(a.email).toLowerCase();
      const to = clean(a.recoveryEmail).toLowerCase()
        || (loginEmailOnDoc && !loginEmailOnDoc.endsWith(`@${ADMIN_LOGIN_DOMAIN}`) ? loginEmailOnDoc : "");
      if (!EMAIL_RE.test(to)) { console.error(`Admin reset: ${uid} has no usable recovery email.`); return genericOk; }

      const lastSent = a.lastPasswordResetRequestAt ? a.lastPasswordResetRequestAt.toMillis() : 0;
      if (Date.now() - lastSent < ADMIN_RESET_COOLDOWN_MS) { console.log(`Admin reset skipped for ${uid}: within cooldown.`); return genericOk; }

      let loginEmail;
      try { loginEmail = (await getAuth().getUser(uid)).email; }
      catch (error) { console.error(`Admin reset: no Auth user for ${uid}:`, error); return genericOk; }
      if (!loginEmail) { console.error(`Admin reset: Auth user ${uid} has no login email.`); return genericOk; }

      let resetUrl;
      try { resetUrl = await getAuth().generatePasswordResetLink(loginEmail, { url: "https://ojtern.web.app/admin" }); }
      catch (error) { console.error(`Admin reset: link generation failed for ${uid}:`, error); return genericOk; }

      const name = a.name || "there";
      const who = a.username ? ` (username <strong>${a.username}</strong>)` : "";
      const whoText = a.username ? ` (username ${a.username})` : "";
      const html = `
        <h2>Reset your OJTern administrator password</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>We received a request to reset the password for the OJTern administrator account${who}.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="background:#111111; border-radius:24px;">
              <a href="${resetUrl}" style="display:inline-block; padding:13px 32px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:24px;">
                Reset Password
              </a>
            </td>
          </tr>
        </table>
        <p>After resetting, sign in at the administrator page with your username and your new password.</p>
        <p>If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p>Best regards,<br/>OJTern Team</p>
      `;
      const text = `Reset your OJTern administrator password

Hi ${name},

We received a request to reset the password for the OJTern administrator account${whoText}.

${resetUrl}

After resetting, sign in at the administrator page with your username and your new password.

If you didn't request this, you can safely ignore this email. Your password won't change.

Best regards,
OJTern Team`;

      try { await sendMail({ to, subject: "OJTern - Reset Your Administrator Password", html, text }); }
      catch (error) { console.error(`Admin reset: Resend rejected the send for ${uid}:`, error); return genericOk; }

      // Recorded only after a successful send, so a failed send doesn't block retrying.
      await adminRef.update({ lastPasswordResetRequestAt: FieldValue.serverTimestamp() });
      console.log(`Admin password reset link sent for ${uid}`);
      return genericOk;
    } catch (error) {
      console.error("Admin reset: UNHANDLED failure:", error);
      return genericOk;
    }
  });

  // ACCOUNT PROFILE: change the admin's display name and recovery email. The screen asks for the
  // current password and re-authenticates right before calling this, and the token's auth_time must
  // be recent, so a stolen open session can't quietly point password resets at another inbox.
  // The previous recovery email is told about the change.
  fns.adminUpdateProfile = onCall({ region: REGION, secrets: [resendApiKey] }, async (request) => {
    const adminUser = await requireAdmin(request);

    const authTime = Number(request.auth.token.auth_time || 0);
    if (!authTime || Math.floor(Date.now() / 1000) - authTime > 300) {
      throw new HttpsError("failed-precondition", "Please confirm your password again.");
    }

    const name = clean(request.data?.name);
    const recoveryEmail = clean(request.data?.recoveryEmail).toLowerCase();
    if (!name || name.length > 60) throw new HttpsError("invalid-argument", "Enter your name (up to 60 characters).");
    if (!EMAIL_RE.test(recoveryEmail) || recoveryEmail.endsWith(`@${ADMIN_LOGIN_DOMAIN}`)) {
      throw new HttpsError("invalid-argument", "Enter a real email address for password recovery.");
    }

    const ref = getFirestore().collection("admins").doc(adminUser.uid);
    const before = (await ref.get()).data() || {};
    await ref.update({ name, recoveryEmail, profileUpdatedAt: FieldValue.serverTimestamp() });

    const oldEmail = clean(before.recoveryEmail).toLowerCase();
    if (oldEmail && oldEmail !== recoveryEmail && EMAIL_RE.test(oldEmail)) {
      try {
        await sendMail({
          to: oldEmail,
          subject: "OJTern - Administrator recovery email changed",
          html: `<h2>Recovery email changed</h2>
            <p>The recovery email for the OJTern administrator account${before.username ? ` (username <strong>${before.username}</strong>)` : ""} was just changed.
            Password reset links will now go to the new address.</p>
            <p>If this wasn't you, sign in and change your password right away, or contact the person who manages the Firebase project.</p>
            <p>Best regards,<br/>OJTern Team</p>`,
          text: `The recovery email for the OJTern administrator account${before.username ? ` (username ${before.username})` : ""} was just changed. Password reset links will now go to the new address.\n\nIf this wasn't you, sign in and change your password right away, or contact the person who manages the Firebase project.\n\nBest regards,\nOJTern Team`,
        });
      } catch (error) {
        console.error(`Admin profile: could not notify the old recovery email for ${adminUser.uid}:`, error);
      }
    }
    return { ok: true };
  });

  // NOTIFICATION: "<name> completed their account setup". "<name> accepted your invitation" is already
  // written by acceptCoordinatorInvite; this one fires when that coordinator later finishes the first-login
  // profile (coordinators/{uid}.profileComplete becomes true). Only for coordinators an admin invited.
  fns.adminNotifySetupCompleted = onDocumentUpdated(
    { document: "coordinators/{uid}", region: REGION },
    async (event) => {
      try {
        await handleCoordinatorUpdated(getFirestore(), event.data.before.data(), event.data.after.data());
      } catch (error) {
        console.error(`adminNotifySetupCompleted failed for ${event.params.uid}:`, error);
      }
    }
  );

  // NOTIFICATION: "The invitation sent to <email> hasn't been accepted after 7 days". Runs every morning
  // (Cloud Scheduler; created automatically on deploy, needs the Blaze plan you already use for functions).
  fns.adminStaleInviteReminders = onSchedule(
    { schedule: "every day 08:00", timeZone: "Asia/Manila", region: REGION },
    async () => {
      const n = await sendStaleInviteReminders(getFirestore());
      console.log(`Stale invite reminders sent: ${n}`);
    }
  );

  return fns;
};