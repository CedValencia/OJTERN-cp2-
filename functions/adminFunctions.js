// functions/adminFunctions.js
// Callable Cloud Functions for the separate ADMIN account (admins/{uid}).
// Admins are NOT coordinators: they have no coordinators/{uid} doc, and nobody
// can become one from the client (the `admins` collection is write-protected in
// firestore.rules; admins are created by hand in the Firebase Console, or by an existing
// admin with "Add account" / "Transfer account" in Account Profile: adminAddAdmin / adminTransferAdmin below).
//
// An admin signs in with their EMAIL + password (a normal Firebase Auth account). That same email
// is where password reset links go. It is changed from Account Profile with Firebase's
// verify-before-update flow, so there is nothing to keep in sync here.
//
// admins/{uid} fields:
//   role: "admin"   status: "active"   name: "OJT Office"
// Written by Add / Transfer account (all optional, none of them needed by the screen to work):
//   email, createdBy, createdAt                      who invited this admin
//   transferFrom                                     on the NEW admin until their first sign-in completes the transfer
//   transferPendingTo / transferPendingEmail         on the CURRENT admin while a transfer to someone is pending
//   status: "transferred" | "cancelled"              an old admin after a completed transfer / an unused account after a cancel
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
  return {
    uid: request.auth.uid,
    name: snap.get("name") || "",
    email: clean(request.auth.token.email),
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

const ADMIN_PAGE_URL = "https://ojtern.web.app/admin";
const RECENT_SIGN_IN_SECONDS = 5 * 60;
const esc = (v) => clean(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Add / Transfer account change who can administer everything, so the caller must have signed in
// recently (the screen asks for the current password again and refreshes the token).
const requireRecentSignIn = (request) => {
  const authTime = Number(request.auth?.token?.auth_time);
  if (!authTime || Date.now() / 1000 - authTime > RECENT_SIGN_IN_SECONDS) {
    throw new HttpsError("failed-precondition", "Please enter your current password again.");
  }
};

const readNameAndEmail = (data) => {
  const email = clean(data?.email).toLowerCase();
  const name = clean(data?.name);
  if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  if (!name || name.length > 60) throw new HttpsError("invalid-argument", "Enter the person's name (up to 60 characters).");
  return { email, name };
};

// Creates the Auth login (a random password nobody ever sees) and admins/{uid}. The person sets their
// own password from the emailed link, so no password is created for anyone to share.
const createAdminAccount = async (db, { email, name, createdBy, extra = {} }) => {
  const auth = getAuth();
  let existing = null;
  try { existing = await auth.getUserByEmail(email); }
  catch (e) { if (e?.code !== "auth/user-not-found") throw e; }
  if (existing) {
    throw new HttpsError("already-exists", "That email already has a login in OJTern. Use a different email, or remove the leftover under Authentication > Users in the Firebase Console.");
  }
  const user = await auth.createUser({
    email, displayName: name, emailVerified: false,
    password: crypto.randomBytes(24).toString("base64url") + "aA1!",
  });
  try {
    await db.collection("admins").doc(user.uid).set({
      role: "admin", status: "active", name, email,
      createdBy, createdAt: FieldValue.serverTimestamp(), ...extra,
    });
  } catch (e) {
    await auth.deleteUser(user.uid).catch(() => {});   // never leave a login without its admins/{uid} doc
    throw e;
  }
  return user.uid;
};

// Emails the new admin a "set your password" link. Returns false (and only logs) if it could not be
// sent: the account already exists by then, and they can use "Forgot password" on the sign-in page.
const sendAdminInviteEmail = async (sendMail, { email, name, invitedBy, transfer }) => {
  try {
    const link = await getAuth().generatePasswordResetLink(email, { url: ADMIN_PAGE_URL });
    const who = esc(invitedBy) || "An OJTern administrator";
    const intro = transfer
      ? `${who} is handing the OJTern administrator role over to you.`
      : `${who} added you as an OJTern administrator.`;
    const html = `
      <h2>${transfer ? "You're taking over as OJTern administrator" : "You've been added as an OJTern administrator"}</h2>
      <p>Hi <strong>${esc(name)}</strong>,</p>
      <p>${intro} Set your password to activate the account (${esc(email)}).</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr>
          <td style="background:#111111; border-radius:24px;">
            <a href="${link}" style="display:inline-block; padding:13px 32px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:24px;">
              Set Your Password
            </a>
          </td>
        </tr>
      </table>
      <p>After that, sign in at the administrator page with your email and your new password.</p>
      <p>If you weren't expecting this, you can safely ignore this email.</p>
      <p>Best regards,<br/>OJTern Team</p>
    `;
    const text = `${transfer ? "You're taking over as OJTern administrator" : "You've been added as an OJTern administrator"}

Hi ${name},

${intro.replace(/&amp;|&lt;|&gt;|&quot;/g, "")} Set your password to activate the account (${email}).

${link}

After that, sign in at the administrator page with your email and your new password.

If you weren't expecting this, you can safely ignore this email.

Best regards,
OJTern Team`;
    await sendMail({ to: email, subject: transfer ? "OJTern - You're Taking Over as Administrator" : "OJTern - You've Been Added as an Administrator", html, text });
    return true;
  } catch (error) {
    console.error(`Admin invite email failed for ${email}:`, error);
    return false;
  }
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

  // ADMIN FORGOT PASSWORD: no sign-in needed (they can't sign in). Takes the admin's email, and if it
  // belongs to an active admin account, mails a reset link to that same address. Only ADMIN accounts
  // are accepted here (a coordinator, student or company email gets nothing).
  //
  // Every path answers identically (unknown email, not an admin, inactive, cooldown, send failure),
  // so this can't be used to find out which emails are admins. Failures are only logged.
  fns.adminRequestPasswordReset = onCall({ region: REGION, secrets: [resendApiKey] }, async (request) => {
    const email = clean(request.data?.email).toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpsError("invalid-argument", "Enter a valid email address.");

    const genericOk = { sent: true };
    try {
      let user;
      try { user = await getAuth().getUserByEmail(email); }
      catch (error) {
        if (error?.code !== "auth/user-not-found") console.error("Admin reset: getUserByEmail failed:", error);
        return genericOk;
      }

      const db = getFirestore();
      const adminRef = db.collection("admins").doc(user.uid);
      const adminSnap = await adminRef.get();
      if (!adminSnap.exists || adminSnap.get("role") !== "admin" || adminSnap.get("status") !== "active") {
        console.log("Admin reset skipped: that email is not an active admin.");
        return genericOk;
      }

      const lastMs = adminSnap.get("lastPasswordResetRequestAt");
      const lastSent = lastMs && lastMs.toMillis ? lastMs.toMillis() : 0;
      if (Date.now() - lastSent < ADMIN_RESET_COOLDOWN_MS) { console.log(`Admin reset skipped for ${user.uid}: within cooldown.`); return genericOk; }

      let resetUrl;
      try { resetUrl = await getAuth().generatePasswordResetLink(email, { url: "https://ojtern.web.app/admin" }); }
      catch (error) { console.error(`Admin reset: link generation failed for ${user.uid}:`, error); return genericOk; }

      const name = adminSnap.get("name") || "there";
      const html = `
        <h2>Reset your OJTern administrator password</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>We received a request to reset the password for the OJTern administrator account (${email}).</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="background:#111111; border-radius:24px;">
              <a href="${resetUrl}" style="display:inline-block; padding:13px 32px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:24px;">
                Reset Password
              </a>
            </td>
          </tr>
        </table>
        <p>After resetting, sign in at the administrator page with your email and your new password.</p>
        <p>If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p>Best regards,<br/>OJTern Team</p>
      `;
      const text = `Reset your OJTern administrator password

Hi ${name},

We received a request to reset the password for the OJTern administrator account (${email}).

${resetUrl}

After resetting, sign in at the administrator page with your email and your new password.

If you didn't request this, you can safely ignore this email. Your password won't change.

Best regards,
OJTern Team`;

      try { await sendMail({ to: email, subject: "OJTern - Reset Your Administrator Password", html, text }); }
      catch (error) { console.error(`Admin reset: Resend rejected the send for ${user.uid}:`, error); return genericOk; }

      // Recorded only after a successful send, so a failed send doesn't block retrying.
      await adminRef.update({ lastPasswordResetRequestAt: FieldValue.serverTimestamp() });
      console.log(`Admin password reset link sent for ${user.uid}`);
      return genericOk;
    } catch (error) {
      console.error("Admin reset: UNHANDLED failure:", error);
      return genericOk;
    }
  });

  // ACCOUNT PROFILE: the admin's display name. (The sign-in email is changed from the screen with Firebase's
  // verifyBeforeUpdateEmail, which proves the new inbox is real before it takes effect.)
  fns.adminUpdateProfile = onCall({ region: REGION }, async (request) => {
    const adminUser = await requireAdmin(request);
    const name = clean(request.data?.name);
    if (!name || name.length > 60) throw new HttpsError("invalid-argument", "Enter your name (up to 60 characters).");
    await getFirestore().collection("admins").doc(adminUser.uid)
      .update({ name, profileUpdatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
  });

  // ACCOUNT PROFILE > ADD ACCOUNT: an admin adds another administrator (full access). The new admin
  // gets an email with a link to set their own password. No password is shared.
  fns.adminAddAdmin = onCall({ region: REGION, secrets: [resendApiKey] }, async (request) => {
    const caller = await requireAdmin(request);
    requireRecentSignIn(request);
    const { email, name } = readNameAndEmail(request.data);
    const db = getFirestore();
    const uid = await createAdminAccount(db, { email, name, createdBy: caller.uid });
    const mailed = await sendAdminInviteEmail(sendMail, { email, name, invitedBy: caller.name, transfer: false });
    return { uid, email, mailed };
  });

  // ACCOUNT PROFILE > TRANSFER ACCOUNT: hands THIS admin role to someone else. The current admin keeps
  // full access until the new person signs in for the first time (adminCompleteTransfer), so a mistyped
  // email can never lock everyone out.
  fns.adminTransferAdmin = onCall({ region: REGION, secrets: [resendApiKey] }, async (request) => {
    const caller = await requireAdmin(request);
    requireRecentSignIn(request);
    const db = getFirestore();
    const callerRef = db.collection("admins").doc(caller.uid);
    const callerSnap = await callerRef.get();
    if (callerSnap.get("transferPendingTo")) {
      throw new HttpsError("failed-precondition", "A transfer is already pending. Cancel it first.");
    }
    const { email, name } = readNameAndEmail(request.data);
    if (sameText(email, caller.email)) {
      throw new HttpsError("invalid-argument", "That is your own email. Enter the new administrator's email.");
    }
    const uid = await createAdminAccount(db, { email, name, createdBy: caller.uid, extra: { transferFrom: caller.uid } });
    await callerRef.update({
      transferPendingTo: uid, transferPendingEmail: email, transferStartedAt: FieldValue.serverTimestamp(),
    });
    const mailed = await sendAdminInviteEmail(sendMail, { email, name, invitedBy: caller.name, transfer: true });
    return { uid, email, mailed };
  });

  // Called by the NEW admin right after they sign in (the screen does it automatically). Signing in
  // proves they own the email, so this is when the previous admin is switched off and signed out.
  // Does nothing unless a transfer to the caller really is pending.
  fns.adminCompleteTransfer = onCall({ region: REGION }, async (request) => {
    const caller = await requireAdmin(request);
    const db = getFirestore();
    const meRef = db.collection("admins").doc(caller.uid);
    const fromUid = clean((await meRef.get()).get("transferFrom"));
    if (!fromUid) return { completed: false };
    const oldRef = db.collection("admins").doc(fromUid);
    const old = await oldRef.get();
    if (!old.exists || old.get("transferPendingTo") !== caller.uid) return { completed: false };

    await oldRef.update({
      status: "transferred", transferredTo: caller.uid, transferredAt: FieldValue.serverTimestamp(),
      transferPendingTo: FieldValue.delete(), transferPendingEmail: FieldValue.delete(), transferStartedAt: FieldValue.delete(),
    });
    await meRef.update({ transferFrom: FieldValue.delete(), transferredFrom: fromUid });
    await getAuth().updateUser(fromUid, { disabled: true }).catch((e) => console.error("Transfer: could not disable the old admin login:", e));
    await getAuth().revokeRefreshTokens(fromUid).catch((e) => console.error("Transfer: could not revoke the old admin's sessions:", e));
    return { completed: true };
  });

  // Cancels a pending transfer. If the new person never signed in, their unused login is switched off.
  fns.adminCancelTransfer = onCall({ region: REGION }, async (request) => {
    const caller = await requireAdmin(request);
    const db = getFirestore();
    const meRef = db.collection("admins").doc(caller.uid);
    const newUid = clean((await meRef.get()).get("transferPendingTo"));
    if (!newUid) return { cancelled: false };

    const newUser = await getAuth().getUser(newUid).catch(() => null);
    if (newUser && !newUser.metadata?.lastSignInTime) {
      await getAuth().updateUser(newUid, { disabled: true }).catch(() => {});
      await db.collection("admins").doc(newUid).update({ status: "cancelled" }).catch(() => {});
    }
    await meRef.update({
      transferPendingTo: FieldValue.delete(), transferPendingEmail: FieldValue.delete(), transferStartedAt: FieldValue.delete(),
    });
    return { cancelled: true };
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