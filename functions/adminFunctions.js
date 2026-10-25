// functions/adminFunctions.js
// Callable Cloud Functions for the separate ADMIN account (admins/{uid}).
// Admins are NOT coordinators: they have no coordinators/{uid} doc, and nobody
// can become one from the client (the `admins` collection is write-protected in
// firestore.rules; admins are created by hand in the Firebase Console, or by an existing
// admin with "Add account" / "Transfer account" in Account Profile: adminAddAdmin / adminTransferAdmin below).
//
// An admin signs in with their EMAIL + password (a normal Firebase Auth account). It is changed from
// Account Profile with Firebase's verify-before-update flow, so there is nothing to keep in sync here.
//
// FIRST-LOGIN EMAIL: on first login every admin must set their own email (the screen blocks the dashboard
// until then). There is NO code: they just type the address (twice, so a typo is caught) and adminSetFirstEmail
// makes it BOTH their sign-in email (Firebase Auth email) and their recovery email ("Forgot password" sends the
// reset link there). It only works while admins/{uid}.recoveryEmail is still empty.
// LATER CHANGES (Account Profile) are still proven with a 6-digit code (adminSendRecoveryCode /
// adminConfirmRecoveryCode). That pending code lives in adminRecoveryCodes/{uid}, which the client must
// NOT be able to read (keep it out of firestore.rules; no rule = denied).
//
// admins/{uid} fields:
//   role: "admin"   status: "active"   name: "OJT Office"
// ADD ACCOUNT and TRANSFER ACCOUNT are both invitation based: adminAddAdmin / adminTransferAdmin only write a
// coordinatorInvites doc (type "admin"; a transfer also has transfer: true). The "Accept Invitation" email is
// sent by sendCoordinatorInviteEmail (index.js). The login and admins/{uid} are created by
// acceptCoordinatorInvite -> acceptAdminInvite (index.js) once the person enters their own name and password
// on the Accept Invitation page. For a transfer, the old admin keeps access until the new one's first sign-in.
// Written by Add / Transfer account (all optional, none of them needed by the screen to work):
//   email, createdBy, createdAt                      who invited this admin
//   recoveryEmail, recoveryEmailSetAt                personal email for password reset links (set on first login)
//   recoveryEmailVerifiedAt                          only when it was later changed with a 6-digit code (Account Profile)
//   transferFrom                                     on the NEW admin until their first sign-in completes the transfer
//   transferPendingInvite / transferPendingEmail     on the CURRENT admin while the transfer invitation is not accepted yet
//   transferPendingTo (+ transferPendingEmail)       on the CURRENT admin once it was accepted (until the new admin's first sign-in)
//   status: "transferred" | "cancelled"              an old admin after a completed transfer / an unused account after a cancel (only if it could not be deleted)
//
// RENAME (Departments & Programs > Edit): adminRenameDepartmentItem renames a department / program / major AND
// every record that stores the old name as plain text (students, applications, reports, coordinators, pending
// invites, companies, ojt_posts, notifications). The catalog doc (departments/{id}) is updated LAST, so a failed
// run can simply be repeated. The doc id never changes; the abbreviation can be edited (level "abbreviation":
// catalog only, no other record stores it). Sign Up and Student Accounts read the
// catalog live, so they show the new name by themselves.
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
const RECOVERY_CODE_TTL_MS = 10 * 60 * 1000;
const RECOVERY_CODE_COOLDOWN_MS = 60 * 1000;
const RECOVERY_CODE_MAX_TRIES = 5;
const STALE_INVITE_AFTER_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v) => String(v ?? "").trim();
const sameText = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
const hashRecoveryCode = (uid, code) => crypto.createHash("sha256").update(`${uid}:${code}`).digest("hex");

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

// ── Program names, read exactly like the screens do ─────────────────────────────
// Port of normalizeDept / splitLegacyProgram in src/departmentsPrograms.js (keep the two in sync).
// Firestore may still hold old names ("BS Business Administration", "BS Education — Major in English").
// The screens show them as program + major (Bachelor of Science in Business Administration, ...), so the
// server must compare against that same cleaned form or it rejects what the dropdowns offer.
const LEGACY_MAJOR = /^(.+?)\s+[—–-]\s+Major in\s+(.+)$/i;
const PROGRAM_RENAMES = {
  "bs business administration": "Bachelor of Science in Business Administration",
  "bs education":               "Bachelor of Secondary Education",
};
const canonProgram = (n) => PROGRAM_RENAMES[String(n).trim().toLowerCase()] || String(n).trim();
const splitLegacyProgram = (name) => {
  const raw = clean(name);
  const m = LEGACY_MAJOR.exec(raw);
  return { program: canonProgram(m ? m[1] : raw), specialization: m ? m[2].trim() : "" };
};
const normalizePrograms = (rawPrograms) => {
  const programs = [];
  for (const p of Array.isArray(rawPrograms) ? rawPrograms : []) {
    const raw = String((typeof p === "string" ? p : p?.name) ?? "").trim();
    const m = LEGACY_MAJOR.exec(raw);
    const name = canonProgram(m ? m[1] : raw);
    if (!name) continue;
    let entry = programs.find((x) => sameText(x.name, name));
    if (!entry) { entry = { name, specializations: [] }; programs.push(entry); }
    const specs = [...(typeof p === "string" ? [] : p?.specializations || []), m ? m[2].trim() : ""].map(clean).filter(Boolean);
    specs.forEach((sp) => { if (!entry.specializations.some((x) => sameText(x, sp))) entry.specializations.push(sp); });
  }
  return programs;
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
    return { name: clean(data.name || d.id), programs: normalizePrograms(data.programs) };
  });

  const out = [];
  for (const sel of input) {
    const dept = catalog.find((d) => sameText(d.name, sel?.department));
    if (!dept) throw new HttpsError("invalid-argument", `Unknown department: ${clean(sel?.department) || "(blank)"}.`);

    let program = "";
    let specialization = "";
    if (clean(sel?.program)) {
      // A saved selection may still carry an old combined name: read it as program + major, like the screens do.
      const legacy = splitLegacyProgram(sel.program);
      const wantedSpec = clean(sel?.specialization) || legacy.specialization;
      const prog = dept.programs.find((p) => sameText(p.name, legacy.program));
      if (!prog) throw new HttpsError("invalid-argument", `"${legacy.program}" is not a program of ${dept.name}.`);
      program = prog.name;
      if (wantedSpec) {
        const spec = prog.specializations.find((s) => sameText(s, wantedSpec));
        if (!spec) throw new HttpsError("invalid-argument", `"${wantedSpec}" is not a major of ${prog.name}.`);
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

// Admins sign in on the normal sign-in page: signInAuto() recognises an administrator and opens the admin
// dashboard, so no emailed link needs to point at the separate /admin form any more.
const ADMIN_PAGE_URL = "https://ojtern.web.app/signin";
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

// Only the email is needed. The new administrator types their own name the first time they sign in.
const readNameAndEmail = (data) => {
  const email = clean(data?.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  return { email, name: "" };
};

// Gives an existing coordinator ADMIN access with the SAME Firebase Auth login (see adminPromoteCoordinator).
// Returns true if they were already an active admin (nothing is written then).
const promoteCoordinatorToAdmin = async (db, callerUid, uid) => {
  const coordRef = db.collection("coordinators").doc(uid);
  const adminRef = db.collection("admins").doc(uid);
  let authUser;
  try { authUser = await getAuth().getUser(uid); }
  catch (e) {
    if (e?.code === "auth/user-not-found") throw new HttpsError("failed-precondition", "This coordinator has no login yet. They have to accept their invitation first.");
    throw e;
  }
  if (authUser.disabled) throw new HttpsError("failed-precondition", "This coordinator's login is disabled.");


  const alreadyAdmin = await db.runTransaction(async (tx) => {
    const [coordSnap, adminSnap] = await Promise.all([tx.get(coordRef), tx.get(adminRef)]);
    if (!coordSnap.exists) throw new HttpsError("not-found", "Coordinator not found.");
    if (coordSnap.get("role") !== "coordinator") throw new HttpsError("failed-precondition", "That record is not a coordinator.");
    const status = clean(coordSnap.get("status"));
    if (["pending", "rejected", "transferred", "suspended", "blocked"].includes(status)) {
      throw new HttpsError("failed-precondition", `A coordinator whose status is "${status}" can't be made an admin.`);
    }

    if (adminSnap.exists && adminSnap.get("role") === "admin" && adminSnap.get("status") === "active") return true;
    // A leftover admins/{uid} that is transferred / cancelled is a different story: don't silently revive it.
    if (adminSnap.exists) throw new HttpsError("failed-precondition", "This person already has an admin record that was switched off. Remove it first or contact the developer.");

    tx.set(adminRef, {
      role: "admin",
      status: "active",
      name: clean(coordSnap.get("name")) || clean(authUser.displayName),
      email: clean(authUser.email || coordSnap.get("email")).toLowerCase(),   // Auth is the source of truth for the login email
      promotedFromCoordinator: true,
      createdBy: callerUid,
      createdAt: FieldValue.serverTimestamp(),
    });
    return false;
  });

  return alreadyAdmin;
};

// Tells an existing coordinator they now also have administrator access. No password link: they keep
// signing in with the email and password they already have.
const sendAdminPromotedEmail = async (sendMail, { email, name, invitedBy }) => {
  try {
    const who = esc(invitedBy) || "An OJTern administrator";
    const html = `
      <h2>You now have OJTern administrator access</h2>
      <p>Hi${name ? ` <strong>${esc(name)}</strong>` : " there"},</p>
      <p>${who} gave your account (${esc(email)}) administrator access. Nothing changes with your login: use the same email and password you already have.</p>
      <p>Sign in at <a href="${ADMIN_PAGE_URL}">${ADMIN_PAGE_URL}</a> and you will be taken to the administrator dashboard. Your coordinator account stays as it is.</p>
      <p>If you weren't expecting this, please contact the OJTern administrator.</p>
      <p>Best regards,<br/>OJTern Team</p>
    `;
    const text = `You now have OJTern administrator access

Hi${name ? ` ${name}` : " there"},

${clean(invitedBy) || "An OJTern administrator"} gave your account (${email}) administrator access. Nothing changes with your login: use the same email and password you already have.

Sign in at ${ADMIN_PAGE_URL} and you will be taken to the administrator dashboard. Your coordinator account stays as it is.

If you weren't expecting this, please contact the OJTern administrator.

Best regards,
OJTern Team`;
    await sendMail({ to: email, subject: "OJTern - You Now Have Administrator Access", html, text });
    return true;
  } catch (error) {
    console.error(`Admin promoted email failed for ${email}:`, error);
    return false;
  }
};

// ── Rename helpers (adminRenameDepartmentItem) ────────────────────────────────
const RENAME_MAX_NAME = 120;
const RENAME_BATCH = 400;
const squash = (v) => clean(v).replace(/\s+/g, " ");
const sameName = (a, b) => squash(a).toLowerCase() === squash(b).toLowerCase();

// Pure mappers (exported at the bottom for tests). ctx = { level, deptName, program, oldName, newName }:
//   level "department": oldName is a department name
//   level "program":    oldName is a program name inside deptName
//   level "major":      oldName is a major of `program` inside deptName
// Old records may still hold a combined program ("BS Education — Major in English"); the screens read that as
// program + major (splitLegacyProgram), so these mappers do too, and migrate such a record to the new name.
const makeRenameMappers = (ctx) => {
  const { level, deptName, program, oldName, newName } = ctx;
  const progOf = (raw) => splitLegacyProgram(raw);

  // One { department | college, program, specialization } entry -> changed copy, or null.
  const mapEntry = (e) => {
    if (!e || typeof e !== "object") return null;
    const out = { ...e };
    let changed = false;
    if (level === "department") {
      for (const k of ["department", "college"]) {
        if (k in e && sameName(e[k], oldName)) { out[k] = newName; changed = true; }
      }
      return changed ? out : null;
    }
    if (!sameName(e.department ?? e.college, deptName)) return null;
    const sp = progOf(e.program);
    if (level === "program" && sameName(sp.program, oldName)) {
      out.program = newName;
      if (!clean(e.specialization) && sp.specialization) out.specialization = sp.specialization;   // legacy "— Major in X"
      return out;
    }
    if (level === "major" && sameName(sp.program, program) && sameName(clean(e.specialization) || sp.specialization, oldName)) {
      out.program = program;
      out.specialization = newName;
      return out;
    }
    return null;
  };
  const mapEntries = (arr) => {
    if (!Array.isArray(arr)) return null;
    let any = false;
    const out = arr.map((e) => { const m = mapEntry(e); if (m) { any = true; return m; } return e; });
    return any ? out : null;
  };
  // Flat arrays of department names (companies.departments, ojt_posts.departments): department level only.
  const mapNames = (arr) => {
    if (level !== "department" || !Array.isArray(arr)) return null;
    let any = false;
    const out = arr.map((n) => { if (typeof n === "string" && sameName(n, oldName)) { any = true; return newName; } return n; });
    return any ? out : null;
  };
  // students / applications / reports: { college, program, specialization, major } -> partial update, or null.
  const mapStudent = (s) => {
    const up = {};
    if (level === "department") {
      if (sameName(s.college, oldName)) up.college = newName;
    } else if (sameName(s.college, deptName)) {
      const sp = progOf(s.program);
      if (level === "program" && sameName(sp.program, oldName)) {
        up.program = newName;
        if (!clean(s.specialization) && !clean(s.major) && sp.specialization) up.specialization = sp.specialization;
      }
      if (level === "major" && sameName(sp.program, program)) {
        if (sameName(s.specialization, oldName)) up.specialization = newName;
        if (sameName(s.major, oldName)) up.major = newName;           // older docs used `major`
        if (!clean(s.specialization) && !clean(s.major) && sameName(sp.specialization, oldName)) {
          up.program = program;                                        // legacy combined program name
          up.specialization = newName;
        }
      }
    }
    return Object.keys(up).length ? up : null;
  };
  // coordinators / companies / ojt_posts.
  const mapOrg = (d) => {
    const up = {};
    const sel = mapEntries(d.deptSelections);
    if (sel) up.deptSelections = sel;
    const names = mapNames(d.departments);
    if (names) up.departments = names;
    const cp = mapEntries(d.collegePrograms);
    if (cp) up.collegePrograms = cp;
    const cs = mapEntries(d.courseSelections);          // ojt_posts (and companies that keep one)
    if (cs) up.courseSelections = cs;
    return Object.keys(up).length ? up : null;
  };
  // Coordinator-scoped notifications carry department / program (/ specialization).
  const mapNotice = (n) => {
    const up = {};
    if (level === "department") {
      if (sameName(n.department, oldName)) up.department = newName;
    } else if (sameName(n.department, deptName)) {
      const sp = progOf(n.program);
      if (level === "program" && sameName(sp.program, oldName)) up.program = newName;
      if (level === "major" && sameName(sp.program, program) && sameName(clean(n.specialization) || sp.specialization, oldName)) {
        up.program = program;
        up.specialization = newName;
      }
    }
    return Object.keys(up).length ? up : null;
  };
  return { mapEntry, mapEntries, mapNames, mapStudent, mapOrg, mapNotice };
};

// Commits [ref, data] pairs in batches (Firestore allows 500 writes per batch).
const commitAll = async (db, pairs) => {
  for (let i = 0; i < pairs.length; i += RENAME_BATCH) {
    const batch = db.batch();
    pairs.slice(i, i + RENAME_BATCH).forEach(([ref, data]) => batch.update(ref, data));
    await batch.commit();
  }
  return pairs.length;
};
const collectUpdates = (snap, mapper) => {
  const pairs = [];
  snap.docs.forEach((d) => { const up = mapper(d.data()); if (up) pairs.push([d.ref, up]); });
  return pairs;
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

  // Gives an existing coordinator ADMIN access with the SAME Firebase Auth login (same UID, same email and
  // password): it only writes admins/{uid}. coordinators/{uid} is left untouched, so the person keeps their
  // Coordinator dashboard and can switch between the two from the top bar.
  // Idempotent: promoting someone who is already an active admin changes nothing (and sends no email).
  // A newly promoted coordinator is emailed (sendAdminPromotedEmail) that they now also have admin access.
  fns.adminPromoteCoordinator = onCall({ region: REGION, secrets: [resendApiKey] }, async (request) => {
    const caller = await requireAdmin(request);
    const db = getFirestore();

    const uid = clean(request.data?.uid);
    if (!uid) throw new HttpsError("invalid-argument", "Missing coordinator.");

    const alreadyAdmin = await promoteCoordinatorToAdmin(db, caller.uid, uid);
    let mailed = false;
    if (!alreadyAdmin) {
      // The promotion is already saved; a mail problem must not undo it (mailed:false tells the screen).
      try {
        const [authUser, coord] = await Promise.all([getAuth().getUser(uid), db.collection("coordinators").doc(uid).get()]);
        const email = clean(authUser.email || coord.get("email")).toLowerCase();
        const name = clean(coord.get("name")) || clean(authUser.displayName);
        if (email) mailed = await sendAdminPromotedEmail(sendMail, { email, name, invitedBy: caller.name });
      } catch (e) {
        console.error("adminPromoteCoordinator: could not send the promoted email:", e);
      }
    }
    return { ok: true, alreadyAdmin, mailed };
  });

  // ADMIN FORGOT PASSWORD: no sign-in needed (they can't sign in). Takes the admin's SIGN-IN email, and if it
  // belongs to an active admin account, mails the reset link to that admin's RECOVERY email (their personal
  // address set on first login). Falls back to the sign-in email only if no recovery email is set. Only ADMIN accounts
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

      // Someone who is also a coordinator already gets the standard reset email from the main
      // Forgot Password screen (same Auth account, same password), so don't send a second one.
      // Only that screen asks for this; the /admin page's own Forgot Password still always sends.
      if (request.data?.skipIfCoordinator === true) {
        const coordSnap = await db.collection("coordinators").doc(user.uid).get();
        if (coordSnap.exists && coordSnap.get("role") === "coordinator") {
          console.log(`Admin reset skipped for ${user.uid}: also a coordinator, the coordinator reset email covers it.`);
          return genericOk;
        }
      }

      const lastMs = adminSnap.get("lastPasswordResetRequestAt");
      const lastSent = lastMs && lastMs.toMillis ? lastMs.toMillis() : 0;
      if (Date.now() - lastSent < ADMIN_RESET_COOLDOWN_MS) { console.log(`Admin reset skipped for ${user.uid}: within cooldown.`); return genericOk; }

      let resetUrl;
      try { resetUrl = await getAuth().generatePasswordResetLink(email, { url: "https://ojtern.web.app/signin" }); }
      catch (error) { console.error(`Admin reset: link generation failed for ${user.uid}:`, error); return genericOk; }

      const name = adminSnap.get("name") || "there";
      const sendTo = clean(adminSnap.get("recoveryEmail")).toLowerCase() || email;
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
        <p>After resetting, sign in with your email and your new password.</p>
        <p>If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p>Best regards,<br/>OJTern Team</p>
      `;
      const text = `Reset your OJTern administrator password

Hi ${name},

We received a request to reset the password for the OJTern administrator account (${email}).

${resetUrl}

After resetting, sign in with your email and your new password.

If you didn't request this, you can safely ignore this email. Your password won't change.

Best regards,
OJTern Team`;

      try { await sendMail({ to: sendTo, subject: "OJTern - Reset Your Administrator Password", html, text }); }
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

  // RECOVERY EMAIL step 1: mails a 6-digit code to the personal address the admin typed. Used on first login
  // (nothing set yet) and from Account Profile (change). Changing an EXISTING recovery email needs a recent sign-in.
  fns.adminSendRecoveryCode = onCall({ region: REGION, secrets: [resendApiKey] }, async (request) => {
    const caller = await requireAdmin(request);
    const email = clean(request.data?.email).toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpsError("invalid-argument", "Enter a valid email address.");

    // The address becomes the sign-in email, so it must not belong to another login already.
    if (!sameText(email, caller.email)) {
      let taken = null;
      try { taken = await getAuth().getUserByEmail(email); }
      catch (e) { if (e?.code !== "auth/user-not-found") throw e; }
      if (taken && taken.uid !== caller.uid) throw new HttpsError("already-exists", "That email is already used by another OJTern account.");
    }

    const db = getFirestore();
    const meSnap = await db.collection("admins").doc(caller.uid).get();
    if (clean(meSnap.get("recoveryEmail"))) requireRecentSignIn(request);

    const ref = db.collection("adminRecoveryCodes").doc(caller.uid);
    const prev = await ref.get();
    const sentAt = prev.exists && prev.get("sentAt") && prev.get("sentAt").toMillis ? prev.get("sentAt").toMillis() : 0;
    if (Date.now() - sentAt < RECOVERY_CODE_COOLDOWN_MS) {
      throw new HttpsError("resource-exhausted", "Please wait a minute before asking for another code.");
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const name = clean(meSnap.get("name")) || "there";
    const html = `
      <h2>Verify your email</h2>
      <p>Hi <strong>${esc(name)}</strong>,</p>
      <p>Use this code to set <strong>${esc(email)}</strong> as the email for your OJTern administrator account. You will sign in with it, and password reset links will be sent here.</p>
      <p style="font-size:28px; letter-spacing:6px; font-weight:bold; margin:20px 0;">${code}</p>
      <p>The code expires in 10 minutes. If you didn't ask for it, you can safely ignore this email.</p>
      <p>Best regards,<br/>OJTern Team</p>
    `;
    const text = `Verify your recovery email

Hi ${name},

Use this code to set ${email} as the email for your OJTern administrator account. You will sign in with it, and password reset links will be sent here.

${code}

The code expires in 10 minutes. If you didn't ask for it, you can safely ignore this email.

Best regards,
OJTern Team`;
    try { await sendMail({ to: email, subject: "OJTern - Verify Your Email", html, text }); }
    catch (error) {
      console.error(`Recovery code email failed for ${caller.uid}:`, error);
      throw new HttpsError("unavailable", "We couldn't send the code. Please check the email address and try again.");
    }
    await ref.set({ email, codeHash: hashRecoveryCode(caller.uid, code), expiresAt: Date.now() + RECOVERY_CODE_TTL_MS, attempts: 0, sentAt: FieldValue.serverTimestamp() });
    return { sent: true };
  });

  // RECOVERY EMAIL step 2: checks the code, then makes that address the admin's sign-in email (Firebase Auth +
  // admins/{uid}.email) AND saves it as admins/{uid}.recoveryEmail. Returns signInEmailChanged: true when the
  // sign-in email is now different; the screen then asks them to sign in again with it (the old login's sessions are revoked).
  fns.adminConfirmRecoveryCode = onCall({ region: REGION }, async (request) => {
    const caller = await requireAdmin(request);
    const code = clean(request.data?.code);
    if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Enter the 6-digit code.");

    const db = getFirestore();
    const ref = db.collection("adminRecoveryCodes").doc(caller.uid);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("failed-precondition", "Request a new code first.");
    if (Date.now() > Number(snap.get("expiresAt") || 0)) {
      await ref.delete().catch(() => {});
      throw new HttpsError("deadline-exceeded", "That code has expired. Request a new one.");
    }
    if (Number(snap.get("attempts") || 0) >= RECOVERY_CODE_MAX_TRIES) {
      await ref.delete().catch(() => {});
      throw new HttpsError("resource-exhausted", "Too many wrong attempts. Request a new code.");
    }
    const expected = Buffer.from(String(snap.get("codeHash") || ""));
    const given = Buffer.from(hashRecoveryCode(caller.uid, code));
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      await ref.update({ attempts: FieldValue.increment(1) });
      throw new HttpsError("invalid-argument", "That code isn't right.");
    }

    const email = clean(snap.get("email")).toLowerCase();
    const adminRef = db.collection("admins").doc(caller.uid);
    const changed = !sameText(email, caller.email);

    if (changed) {
      // Re-check right before the switch: someone may have taken the address since the code was sent.
      let taken = null;
      try { taken = await getAuth().getUserByEmail(email); }
      catch (e) { if (e?.code !== "auth/user-not-found") throw e; }
      if (taken && taken.uid !== caller.uid) throw new HttpsError("already-exists", "That email is already used by another OJTern account.");
      // The code proved they own the inbox, so the address is marked verified.
      await getAuth().updateUser(caller.uid, { email, emailVerified: true });
    }
    try {
      await adminRef.update({ email, recoveryEmail: email, recoveryEmailVerifiedAt: FieldValue.serverTimestamp() });
    } catch (e) {
      if (changed) await getAuth().updateUser(caller.uid, { email: caller.email }).catch(() => {});   // keep Auth and Firestore in step
      throw e;
    }
    if (changed) await getAuth().revokeRefreshTokens(caller.uid).catch((e) => console.error("Recovery email: could not revoke sessions:", e));
    await ref.delete().catch(() => {});
    return { ok: true, email, signInEmailChanged: changed };
  });

  // FIRST-LOGIN EMAIL, no code: the admin types the address they will sign in with and use for "Forgot password".
  // Allowed ONLY while no recovery email is set yet (the first login), so it can't be used to swap the email of an
  // account that already has one (that goes through Account Profile and its code). The address must not belong to
  // another login. If it differs from the current sign-in email, the Auth email is switched and the old sessions
  // are revoked (signInEmailChanged: true), so the screen signs them out to log in again with the new email.
  fns.adminSetFirstEmail = onCall({ region: REGION }, async (request) => {
    const caller = await requireAdmin(request);
    const email = clean(request.data?.email).toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpsError("invalid-argument", "Enter a valid email address.");

    const db = getFirestore();
    const adminRef = db.collection("admins").doc(caller.uid);
    const snap = await adminRef.get();
    if (clean(snap.get("recoveryEmail"))) {
      throw new HttpsError("failed-precondition", "Your email is already set. You can change it from Account Profile.");
    }

    const changed = !sameText(email, caller.email);
    if (changed) {
      let taken = null;
      try { taken = await getAuth().getUserByEmail(email); }
      catch (e) { if (e?.code !== "auth/user-not-found") throw e; }
      if (taken && taken.uid !== caller.uid) throw new HttpsError("already-exists", "That email is already used by another OJTern account.");
      await getAuth().updateUser(caller.uid, { email, emailVerified: false });
    }
    try {
      await adminRef.update({ email, recoveryEmail: email, recoveryEmailSetAt: FieldValue.serverTimestamp() });
    } catch (e) {
      if (changed) await getAuth().updateUser(caller.uid, { email: caller.email }).catch(() => {});   // keep Auth and Firestore in step
      throw e;
    }
    if (changed) await getAuth().revokeRefreshTokens(caller.uid).catch((e) => console.error("First email: could not revoke sessions:", e));
    return { ok: true, email, signInEmailChanged: changed };
  });

  // ACCOUNT PROFILE: the admin's display name. (The sign-in email is changed from the screen with Firebase's
  // verifyBeforeUpdateEmail, which proves the new inbox is real before it takes effect.)
  fns.adminUpdateProfile = onCall({ region: REGION }, async (request) => {
    const adminUser = await requireAdmin(request);
    const name = clean(request.data?.name);
    if (!name || name.length > 60) throw new HttpsError("invalid-argument", "Enter your name (up to 60 characters).");
    await getFirestore().collection("admins").doc(adminUser.uid)
      .update({ name, profileUpdatedAt: FieldValue.serverTimestamp() });
    await getAuth().updateUser(adminUser.uid, { displayName: name }).catch((e) => console.error("adminUpdateProfile: could not update displayName:", e));
    return { ok: true };
  });

  // ACCOUNT PROFILE > ADD ACCOUNT: an admin invites another administrator (full access). Only the email is
  // typed here. The person gets an "Accept Invitation" email; after clicking it they enter their own name
  // and password, and only then is their account created. No password is shared.
  fns.adminAddAdmin = onCall({ region: REGION, secrets: [resendApiKey] }, async (request) => {
    const caller = await requireAdmin(request);
    requireRecentSignIn(request);
    const { email, name } = readNameAndEmail(request.data);
    const db = getFirestore();

    // The email already belongs to a coordinator: give THAT account admin access (same login and
    // password) instead of failing with "already has a login". Other existing logins (student, company)
    // still get the normal "already has a login" error below.
    let existing = null;
    try { existing = await getAuth().getUserByEmail(email); }
    catch (e) { if (e?.code !== "auth/user-not-found") throw e; }
    if (existing) {
      const coord = await db.collection("coordinators").doc(existing.uid).get();
      if (coord.exists && coord.get("role") === "coordinator") {
        if (existing.disabled) throw new HttpsError("failed-precondition", "This coordinator's login is disabled.");
        const alreadyAdmin = await promoteCoordinatorToAdmin(db, caller.uid, existing.uid);
        if (alreadyAdmin) throw new HttpsError("already-exists", "That person is already an administrator.");
        const promotedName = clean(coord.get("name")) || clean(existing.displayName);
        const mailed = await sendAdminPromotedEmail(sendMail, { email, name: promotedName, invitedBy: caller.name });
        return { uid: existing.uid, email, mailed, promoted: true };
      }
    }

    // An email with some OTHER login (student, company, an existing admin...) can't be invited.
    if (existing) {
      throw new HttpsError("already-exists", "That email already has a login in OJTern. Use a different email, or remove the leftover under Authentication > Users in the Firebase Console.");
    }

    // Only the latest invite for an email stays valid.
    const older = await db.collection("coordinatorInvites")
      .where("toEmail", "==", email).where("status", "==", "pending").get();
    await Promise.all(older.docs.map((d) => d.ref.update({ status: "cancelled" })));

    // sendCoordinatorInviteEmail (index.js) fires on this write and mails the Accept Invitation link.
    const ref = await db.collection("coordinatorInvites").add({
      type:               "admin",
      fromUid:            caller.uid,
      fromEmail:          caller.email,
      fromName:           caller.name || "OJTern Administrator",
      toEmail:            email,
      deptSelections:     [],
      assignedIndustries: [],
      token:              crypto.randomBytes(24).toString("hex"),
      status:             "pending",
      createdByAdmin:     true,
      createdAt:          FieldValue.serverTimestamp(),
    });
    return { inviteId: ref.id, email, mailed: true };
  });

  // Pending admin invitations THIS admin sent (not accepted yet), plus any older-style added admins whose login
  // was created up front but who never signed in. The screen lists them with a Cancel button.
  // `uid` is the invite id for invitations (adminCancelAddedAdmin accepts both kinds).
  fns.adminListPendingAdmins = onCall({ region: REGION }, async (request) => {
    const caller = await requireAdmin(request);
    const db = getFirestore();
    const out = [];
    const invites = await db.collection("coordinatorInvites")
      .where("fromUid", "==", caller.uid).where("type", "==", "admin").where("status", "==", "pending").get();
    for (const d of invites.docs) {
      if (d.get("transfer") === true) continue;   // a transfer invitation is shown (and cancelled) under Transfer account
      out.push({ uid: d.id, email: clean(d.get("toEmail")) });
    }

    const snap = await db.collection("admins").where("createdBy", "==", caller.uid).get();
    for (const d of snap.docs) {
      const x = d.data();
      if (x.status !== "active" || x.promotedFromCoordinator === true || x.transferFrom) continue;
      const u = await getAuth().getUser(d.id).catch(() => null);
      if (!u || u.metadata?.lastSignInTime) continue;
      out.push({ uid: d.id, email: clean(x.email || u.email) });
    }
    return { pending: out };
  });

  // Cancels an added admin who has not signed in yet: the unused login and admins/{uid} are deleted, so the same
  // email can be used again (Add, Transfer or Invite coordinator). If deleting the login fails it is switched off instead.
  fns.adminCancelAddedAdmin = onCall({ region: REGION }, async (request) => {
    const caller = await requireAdmin(request);
    const db = getFirestore();
    const uid = clean(request.data?.uid);
    if (!uid) throw new HttpsError("invalid-argument", "Missing administrator.");

    // A pending invitation (nothing was created yet): just switch the invite off so its link stops working.
    const inviteRef = db.collection("coordinatorInvites").doc(uid);
    const inviteSnap = await inviteRef.get();
    if (inviteSnap.exists) {
      if (inviteSnap.get("type") !== "admin" || inviteSnap.get("fromUid") !== caller.uid || inviteSnap.get("status") !== "pending") {
        throw new HttpsError("failed-precondition", "That invitation can't be cancelled here.");
      }
      if (inviteSnap.get("transfer") === true) throw new HttpsError("failed-precondition", "Cancel it from Transfer account instead.");
      await inviteRef.update({ status: "cancelled", cancelledAt: FieldValue.serverTimestamp() });
      return { cancelled: true };
    }

    const ref = db.collection("admins").doc(uid);
    const snap = await ref.get();
    if (!snap.exists || snap.get("createdBy") !== caller.uid || snap.get("promotedFromCoordinator") === true || snap.get("transferFrom")) {
      throw new HttpsError("failed-precondition", "That invitation can't be cancelled here.");
    }
    const user = await getAuth().getUser(uid).catch(() => null);
    if (user?.metadata?.lastSignInTime) throw new HttpsError("failed-precondition", "They already signed in, so this can no longer be cancelled.");
    try {
      if (user) await getAuth().deleteUser(uid);
      await ref.delete().catch(() => {});
    } catch (e) {
      console.error("Cancel added admin: could not delete the unused login, disabling it instead:", e);
      await getAuth().updateUser(uid, { disabled: true }).catch(() => {});
      await ref.update({ status: "cancelled" }).catch(() => {});
    }
    return { cancelled: true };
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
    if (callerSnap.get("transferPendingTo") || callerSnap.get("transferPendingInvite")) {
      throw new HttpsError("failed-precondition", "A transfer is already pending. Cancel it first.");
    }
    const { email, name } = readNameAndEmail(request.data);
    if (sameText(email, caller.email)) {
      throw new HttpsError("invalid-argument", "That is your own email. Enter the new administrator's email.");
    }
    // The email already belongs to a coordinator: hand the admin role to THAT account (same login and
    // password) instead of failing with "already has a login". Other existing logins still fail below.
    let existing = null;
    try { existing = await getAuth().getUserByEmail(email); }
    catch (e) { if (e?.code !== "auth/user-not-found") throw e; }
    const coord = existing ? await db.collection("coordinators").doc(existing.uid).get() : null;
    if (coord && coord.exists && coord.get("role") === "coordinator") {
      if (existing.disabled) throw new HttpsError("failed-precondition", "This coordinator's login is disabled.");
      const alreadyAdmin = await promoteCoordinatorToAdmin(db, caller.uid, existing.uid);
      if (alreadyAdmin) throw new HttpsError("already-exists", "That person is already an administrator.");
      await db.collection("admins").doc(existing.uid).update({ transferFrom: caller.uid });
      await callerRef.update({
        transferPendingTo: existing.uid, transferPendingEmail: email, transferStartedAt: FieldValue.serverTimestamp(),
      });
      const promotedName = clean(coord.get("name")) || clean(existing.displayName);
      const mailed = await sendAdminPromotedEmail(sendMail, { email, name: promotedName, invitedBy: caller.name });
      return { uid: existing.uid, email, mailed, promoted: true };
    }

    // An email with some OTHER login (student, company, an existing admin...) can't receive the role.
    if (existing) {
      throw new HttpsError("already-exists", "That email already has a login in OJTern. Use a different email, or remove the leftover under Authentication > Users in the Firebase Console.");
    }

    // Only the latest invite for an email stays valid.
    const older = await db.collection("coordinatorInvites")
      .where("toEmail", "==", email).where("status", "==", "pending").get();
    await Promise.all(older.docs.map((d) => d.ref.update({ status: "cancelled" })));

    // Same as Add account: sendCoordinatorInviteEmail (index.js) mails the Accept Invitation link. Nothing is
    // created until they accept (acceptAdminInvite), which also links the new admin to this one.
    const ref = await db.collection("coordinatorInvites").add({
      type:               "admin",
      transfer:           true,
      fromUid:            caller.uid,
      fromEmail:          caller.email,
      fromName:           caller.name || "OJTern Administrator",
      toEmail:            email,
      deptSelections:     [],
      assignedIndustries: [],
      token:              crypto.randomBytes(24).toString("hex"),
      status:             "pending",
      createdByAdmin:     true,
      createdAt:          FieldValue.serverTimestamp(),
    });
    await callerRef.update({
      transferPendingInvite: ref.id, transferPendingEmail: email, transferStartedAt: FieldValue.serverTimestamp(),
    });
    return { inviteId: ref.id, email, mailed: true };
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
      transferPendingTo: FieldValue.delete(), transferPendingInvite: FieldValue.delete(), transferPendingEmail: FieldValue.delete(), transferStartedAt: FieldValue.delete(),
    });
    await meRef.update({ transferFrom: FieldValue.delete(), transferredFrom: fromUid });
    await getAuth().updateUser(fromUid, { disabled: true }).catch((e) => console.error("Transfer: could not disable the old admin login:", e));
    await getAuth().revokeRefreshTokens(fromUid).catch((e) => console.error("Transfer: could not revoke the old admin's sessions:", e));
    return { completed: true };
  });

  // Cancels a pending transfer. While the invitation is not accepted yet, only the invitation is switched off
  // (nothing else exists). After that, if the new person never signed in, their unused login and admins doc are
  // deleted so the email can be reused.
  fns.adminCancelTransfer = onCall({ region: REGION }, async (request) => {
    const caller = await requireAdmin(request);
    const db = getFirestore();
    const meRef = db.collection("admins").doc(caller.uid);
    const meSnap = await meRef.get();
    const inviteId = clean(meSnap.get("transferPendingInvite"));
    const newUid = clean(meSnap.get("transferPendingTo"));
    const clearPending = () => meRef.update({
      transferPendingTo: FieldValue.delete(), transferPendingInvite: FieldValue.delete(),
      transferPendingEmail: FieldValue.delete(), transferStartedAt: FieldValue.delete(),
    });
    if (inviteId && !newUid) {
      const inviteRef = db.collection("coordinatorInvites").doc(inviteId);
      const inviteSnap = await inviteRef.get();
      if (inviteSnap.exists && inviteSnap.get("status") === "pending" && inviteSnap.get("fromUid") === caller.uid) {
        await inviteRef.update({ status: "cancelled", cancelledAt: FieldValue.serverTimestamp() });
      }
      await clearPending();
      return { cancelled: true };
    }
    if (!newUid) return { cancelled: false };

    const newAdminSnap = await db.collection("admins").doc(newUid).get();
    const newUser = await getAuth().getUser(newUid).catch(() => null);
    if (newAdminSnap.exists && newAdminSnap.get("promotedFromCoordinator") === true) {
      // An existing coordinator: keep their login (they still use it as a coordinator), remove only the admin access.
      await db.collection("admins").doc(newUid).delete();
    } else if (newUser && !newUser.metadata?.lastSignInTime) {
      // Never used: remove the login and its admins/{uid} doc completely, so the same email can be used
      // again for Add / Transfer (a leftover disabled login would block it with "already has a login").
      // If deleting the login fails, fall back to switching it off like before.
      try {
        await getAuth().deleteUser(newUid);
        await db.collection("admins").doc(newUid).delete().catch(() => {});
      } catch (e) {
        console.error("Cancel transfer: could not delete the unused admin login, disabling it instead:", e);
        await getAuth().updateUser(newUid, { disabled: true }).catch(() => {});
        await db.collection("admins").doc(newUid).update({ status: "cancelled" }).catch(() => {});
      }
    }
    await clearPending();
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

  // ADMIN > Departments & Programs > Edit. data: { level: "department" | "program" | "major", departmentId, program?, oldName, newName }
  //   department: oldName = the department's current name
  //   program:    oldName = the program's current name
  //   major:      program = the program the major belongs to, oldName = the major's current name
  // Order: every record that carries the old name first, the departments/{id} doc LAST. If something fails half-way
  // the catalog still has the old name, so the admin can press Edit again (already-updated records no longer match).
  fns.adminRenameDepartmentItem = onCall(
    { region: REGION, timeoutSeconds: 300, memory: "512MiB" },
    async (request) => {
      await requireAdmin(request);
      const db = getFirestore();

      const level = clean(request.data?.level);
      if (!["department", "program", "major", "abbreviation"].includes(level)) throw new HttpsError("invalid-argument", "Unknown item type.");
      const departmentId = clean(request.data?.departmentId);

      // Abbreviation (e.g. CBA -> CAB after the department was renamed). It is stored only on the catalog doc, so
      // nothing else needs updating. The doc id stays as it is.
      if (level === "abbreviation") {
        if (!departmentId) throw new HttpsError("invalid-argument", "Missing department.");
        const newAbbr = clean(request.data?.newName).toUpperCase();
        if (!/^[A-Z0-9]{2,10}$/.test(newAbbr)) throw new HttpsError("invalid-argument", "Abbreviation must be 2–10 letters or numbers, e.g. CAB.");
        const ref = db.collection("departments").doc(departmentId);
        const snap = await ref.get();
        if (!snap.exists) throw new HttpsError("not-found", "That department no longer exists.");
        const oldAbbr = clean(snap.get("abbr"));
        if (oldAbbr.toUpperCase() === newAbbr) throw new HttpsError("invalid-argument", "That is already the current abbreviation.");
        const all = await db.collection("departments").get();
        if (all.docs.some((d) => d.id !== departmentId && clean(d.get("abbr")).toUpperCase() === newAbbr)) {
          throw new HttpsError("already-exists", "That abbreviation is already used by another department.");
        }
        await ref.update({ abbr: newAbbr, updatedAt: FieldValue.serverTimestamp() });
        return { ok: true, level, oldName: oldAbbr, newName: newAbbr };
      }
      const oldName = squash(request.data?.oldName);
      const newName = squash(request.data?.newName);
      const program = squash(request.data?.program);
      if (!departmentId || !oldName) throw new HttpsError("invalid-argument", "Missing department or name.");
      if (!newName) throw new HttpsError("invalid-argument", "Enter the new name.");
      if (newName.length > RENAME_MAX_NAME) throw new HttpsError("invalid-argument", `Keep the name under ${RENAME_MAX_NAME} characters.`);
      if (newName === oldName) throw new HttpsError("invalid-argument", "That is already the current name.");
      if (level === "major" && !program) throw new HttpsError("invalid-argument", "Missing program.");
      // The screens split "<program> — Major in <major>" and rename "BS Education"; such a name would not stay as typed.
      if (level === "program" && (LEGACY_MAJOR.test(newName) || PROGRAM_RENAMES[newName.toLowerCase()])) {
        throw new HttpsError("invalid-argument", "Use the full program name, and add the major separately (not “— Major in …”).");
      }

      const deptRef = db.collection("departments").doc(departmentId);
      const deptSnap = await deptRef.get();
      if (!deptSnap.exists) throw new HttpsError("not-found", "That department no longer exists.");
      const deptName = squash(deptSnap.get("name") || deptSnap.id);
      // Same cleaned form the screens show (old combined names split into program + major).
      const programs = normalizePrograms(deptSnap.get("programs"));

      let newPrograms = null;
      let newDeptName = null;
      if (level === "department") {
        if (!sameName(deptName, oldName)) throw new HttpsError("failed-precondition", "The department name changed in the meantime. Reload and try again.");
        const all = await db.collection("departments").get();
        if (all.docs.some((d) => d.id !== departmentId && sameName(d.get("name") || d.id, newName))) {
          throw new HttpsError("already-exists", "A department with that name already exists.");
        }
        newDeptName = newName;
      } else if (level === "program") {
        if (!programs.some((p) => sameName(p.name, oldName))) throw new HttpsError("not-found", "That program no longer exists.");
        if (programs.some((p) => !sameName(p.name, oldName) && sameName(p.name, newName))) {
          throw new HttpsError("already-exists", `"${newName}" already exists in ${deptName}.`);
        }
        newPrograms = programs.map((p) => (sameName(p.name, oldName) ? { ...p, name: newName } : p));
      } else {
        const prog = programs.find((p) => sameName(p.name, program));
        if (!prog) throw new HttpsError("not-found", "That program no longer exists.");
        if (!prog.specializations.some((m) => sameName(m, oldName))) throw new HttpsError("not-found", "That major no longer exists.");
        if (prog.specializations.some((m) => !sameName(m, oldName) && sameName(m, newName))) {
          throw new HttpsError("already-exists", `"${newName}" already exists in ${prog.name}.`);
        }
        newPrograms = programs.map((p) => (p === prog
          ? { ...p, specializations: p.specializations.map((m) => (sameName(m, oldName) ? newName : m)) }
          : p));
      }

      // `program` below is the catalog's own spelling (so legacy records migrate to it).
      const canonProgramName = level === "major" ? programs.find((p) => sameName(p.name, program)).name : "";
      const m = makeRenameMappers({ level, deptName, program: canonProgramName, oldName, newName });
      const counts = { students: 0, applications: 0, reports: 0, coordinators: 0, invites: 0, companies: 0, posts: 0, notifications: 0 };

      const students = await db.collection("students").select("college", "program", "specialization", "major").get();
      counts.students = await commitAll(db, collectUpdates(students, m.mapStudent));

      // Applications keep a copy of the student's college / program / major from the day they applied.
      const applications = await db.collection("applications").select("college", "program", "specialization", "major").get();
      counts.applications = await commitAll(db, collectUpdates(applications, m.mapStudent));

      // Reports about a student keep their college / program so coordinators can scope them.
      const reports = await db.collection("reports").select("college", "program").get();
      counts.reports = await commitAll(db, collectUpdates(reports, m.mapStudent));

      const coordinators = await db.collection("coordinators").select("deptSelections", "departments", "collegePrograms").get();
      counts.coordinators = await commitAll(db, collectUpdates(coordinators, m.mapOrg));

      const invites = await db.collection("coordinatorInvites").where("status", "==", "pending").select("deptSelections").get();
      counts.invites = await commitAll(db, collectUpdates(invites, (d) => {
        const sel = m.mapEntries(d.deptSelections);
        return sel ? { deptSelections: sel } : null;
      }));

      const companies = await db.collection("companies").select("deptSelections", "courseSelections", "departments", "collegePrograms").get();
      counts.companies = await commitAll(db, collectUpdates(companies, m.mapOrg));

      const posts = await db.collection("ojt_posts").select("courseSelections", "departments").get();
      counts.posts = await commitAll(db, collectUpdates(posts, m.mapOrg));

      // Notifications: exact match on the department the notice was written with (a full scan would be too big).
      const noticeDept = level === "department" ? oldName : deptName;
      const notices = await db.collection("notifications").where("department", "==", noticeDept).get();
      counts.notifications = await commitAll(db, collectUpdates(notices, m.mapNotice));

      // The catalog itself, last.
      const catalogUpdate = { updatedAt: FieldValue.serverTimestamp() };
      if (newDeptName) catalogUpdate.name = newDeptName;
      if (newPrograms) catalogUpdate.programs = newPrograms;
      await deptRef.update(catalogUpdate);

      console.log(`adminRenameDepartmentItem ${level} "${oldName}" -> "${newName}" (${deptName}):`, counts);
      return { ok: true, level, oldName, newName, ...counts };
    }
  );

  return fns;
};

module.exports._renameTest = { makeRenameMappers, sameName };