// affiliationService.js
// ─────────────────────────────────────────────────────────────────────────────
// One place for the company ↔ college/program affiliation rules, so the
// Company Profile, Create Post, Find Company and Coordinator screens all
// agree on them.
//
// Data model (kept inside the existing companies/{uid} document — no migration):
//
//   deptSelections: [{
//     department, program,
//     status: "pending" | "approved" | "rejected" | "withdrawn",
//     requestedAt, decidedAt?, withdrawnAt?,     // Firestore Timestamps
//     history: [{ status, at, by }]              // audit trail for this pair
//   }]
//   departments: string[]   // flat mirror of NON-withdrawn departments only,
//                           // used by the coordinator's array-contains-any query
//
// Core rules implemented here:
//   • Removing a program never deletes its entry — it becomes "withdrawn".
//   • Re-adding a withdrawn program starts over at "pending" (needs new approval).
//   • A post may only target programs whose affiliation is "approved".
//     Targets that no longer are get removed from the post (kept in
//     post.withdrawnTargets for history); a post left with no targets is
//     disabled automatically.
//   • Existing applications are NEVER deleted or re-statused. They only get an
//     `affiliationWithdrawn` flag so both the student and coordinator see a notice.
//   • All of the above is written in one batch — either everything updates
//     or nothing does — and notifications are part of that same batch, so
//     they only exist if the change actually succeeded.
// ─────────────────────────────────────────────────────────────────────────────
import { collection, doc, getDocs, query, where, writeBatch, Timestamp, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "./firebase";

export const AFFILIATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
};

// Same normalisation Student Find Company already uses — college/program
// strings drift (em dash vs hyphen, spacing, casing) between screens.
export const normalizeScope = (v) => String(v || "")
  .replace(/[\u2010-\u2015]/g, "-")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

export const pairKey = (department, program) => `${normalizeScope(department)}||${normalizeScope(program)}`;
export const pairLabel = (department, program) => [department, program].filter(Boolean).join(" — ");

export const isActiveAffiliation = (s) => s && s.status !== AFFILIATION_STATUS.WITHDRAWN;

// Does an affiliation entry cover a given (college, program)? An entry with no
// program covers the whole department.
export const entryCovers = (entry, college, program) =>
  normalizeScope(entry.department) === normalizeScope(college) &&
  (!normalizeScope(entry.program) || normalizeScope(entry.program) === normalizeScope(program));

export const isPairApproved = (deptSelections, college, program) =>
  (deptSelections || []).some(s => s.status === AFFILIATION_STATUS.APPROVED && entryCovers(s, college, program));

// ── 1. Work out the next deptSelections from what the company picked ────────
// prev: deptSelections currently in Firestore
// courseSelections: the picker's [{ college, program, specialization }]
export const buildNextDeptSelections = (prev, courseSelections, actorId) => {
  const now = Timestamp.now();
  const prevList = Array.isArray(prev) ? prev : [];
  const wanted = (courseSelections || [])
    .filter(s => s.college)
    .map(s => ({ department: s.college, program: s.program || "" }));
  const wantedKeys = new Set(wanted.map(w => pairKey(w.department, w.program)));

  const added = [];        // brand-new or re-added after withdrawal → pending
  const withdrawn = [];    // active before, not wanted now → withdrawn
  const seen = new Set();
  const next = [];

  for (const entry of prevList) {
    if (!entry?.department) continue;
    const key = pairKey(entry.department, entry.program);
    if (seen.has(key)) continue;           // collapse accidental duplicates
    seen.add(key);
    const history = Array.isArray(entry.history) ? entry.history : [];

    if (wantedKeys.has(key)) {
      if (entry.status === AFFILIATION_STATUS.WITHDRAWN) {
        // Re-added: needs a fresh coordinator decision (rule #6).
        next.push({
          ...entry,
          status: AFFILIATION_STATUS.PENDING,
          requestedAt: now,
          decidedAt: null,
          withdrawnAt: null,
          history: [...history, { status: AFFILIATION_STATUS.PENDING, at: now, by: actorId || "" }],
        });
        added.push({ department: entry.department, program: entry.program || "" });
      } else {
        next.push({ ...entry, status: entry.status || AFFILIATION_STATUS.PENDING });
      }
    } else if (entry.status !== AFFILIATION_STATUS.WITHDRAWN) {
      // Removed by the company → keep the record, mark withdrawn.
      next.push({
        ...entry,
        status: AFFILIATION_STATUS.WITHDRAWN,
        previousStatus: entry.status || AFFILIATION_STATUS.PENDING,
        withdrawnAt: now,
        history: [...history, { status: AFFILIATION_STATUS.WITHDRAWN, at: now, by: actorId || "" }],
      });
      withdrawn.push({ department: entry.department, program: entry.program || "", previousStatus: entry.status || "pending" });
    } else {
      next.push(entry); // already withdrawn and still not wanted — untouched history
    }
  }

  for (const w of wanted) {
    const key = pairKey(w.department, w.program);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({
      department: w.department,
      program: w.program,
      status: AFFILIATION_STATUS.PENDING,
      requestedAt: now,
      history: [{ status: AFFILIATION_STATUS.PENDING, at: now, by: actorId || "" }],
    });
    added.push(w);
  }

  return { next, added, withdrawn };
};

// Flat department mirror for the coordinator query — withdrawn entries are
// left out so the company leaves that coordinator's ACTIVE list.
export const activeDepartments = (deptSelections) =>
  [...new Set((deptSelections || []).filter(isActiveAffiliation).map(s => s.department).filter(Boolean))];

// Every department the company has EVER been affiliated with, withdrawn ones
// included. Lets the coordinator's Company List still find a company for its
// read-only "Withdrawn" history after it left that coordinator's active lists.
export const allAffiliationDepartments = (deptSelections) =>
  [...new Set((deptSelections || []).map(s => s?.department).filter(Boolean))];

// ── 2. Figure out which post targets / applications a change affects ────────
// Returns, per post, the targets that are no longer approved and the ones kept.
const splitPostTargets = (post, nextDeptSelections) => {
  if (Array.isArray(post.courseSelections) && post.courseSelections.length) {
    const kept = [];
    const dropped = [];
    for (const t of post.courseSelections) {
      if (!t?.college) continue;
      (isPairApproved(nextDeptSelections, t.college, t.program) ? kept : dropped).push(t);
    }
    return { kept, dropped, legacy: false };
  }
  // Older posts that only carry a flat `departments` list.
  const depts = Array.isArray(post.departments) ? post.departments : [];
  const approvedDepts = new Set(
    (nextDeptSelections || [])
      .filter(s => s.status === AFFILIATION_STATUS.APPROVED)
      .map(s => normalizeScope(s.department))
  );
  const kept = depts.filter(d => approvedDepts.has(normalizeScope(d))).map(d => ({ college: d, program: "" }));
  const dropped = depts.filter(d => !approvedDepts.has(normalizeScope(d))).map(d => ({ college: d, program: "" }));
  return { kept, dropped, legacy: true };
};

const applicationMatchesTarget = (app, target) =>
  normalizeScope(app.college || app.department) === normalizeScope(target.college) &&
  (!normalizeScope(target.program) || normalizeScope(app.program || app.course) === normalizeScope(target.program));

const FINAL_OR_CLOSED = ["declined", "rejected", "withdrawn", "cancelled"];

// Reads everything once. Used both for the confirmation dialog (preview) and
// for the actual commit, so what the company is told is exactly what happens.
export const analyzeAffiliationImpact = async (companyId, nextDeptSelections) => {
  const [postsSnap, appsSnap] = await Promise.all([
    getDocs(query(collection(db, "ojt_posts"), where("companyId", "==", companyId))),
    getDocs(query(collection(db, "applications"), where("companyId", "==", companyId))),
  ]);
  const posts = postsSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const apps = appsSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

  const affectedPosts = [];
  const affectedApps = [];
  for (const post of posts) {
    const { kept, dropped, legacy } = splitPostTargets(post, nextDeptSelections);
    if (dropped.length === 0) continue;
    affectedPosts.push({ post, kept, dropped, legacy, willClose: kept.length === 0 });
    for (const app of apps) {
      if (app.postId !== post.id || app.affiliationWithdrawn) continue;
      const target = dropped.find(t => applicationMatchesTarget(app, t));
      if (target) affectedApps.push({ app, target, post });
    }
  }

  const openApps = affectedApps.filter(a => !FINAL_OR_CLOSED.includes(String(a.app.status || "").toLowerCase()));
  return {
    affectedPosts,
    affectedApps,
    summary: {
      postsAffected: affectedPosts.length,
      postsClosing: affectedPosts.filter(p => p.willClose).length,
      applications: openApps.length,
      accepted: openApps.filter(a => String(a.app.status || "").toLowerCase() === "accepted").length,
    },
  };
};

// ── 3. Commit everything atomically ─────────────────────────────────────────
// companyUpdate: the plain profile fields to write on companies/{uid}
//                (name, industry, location, courseSelections…) — this function
//                adds deptSelections/departments itself.
// postSync:      fields every post should mirror from the profile (name, location…)
export const commitCompanyProfileWithAffiliations = async ({
  companyId, companyName, companyUpdate, nextDeptSelections, added, withdrawn, postSync = {},
}) => {
  const impact = await analyzeAffiliationImpact(companyId, nextDeptSelections);
  const now = Timestamp.now();
  const ops = [];

  // Company profile
  ops.push(b => b.update(doc(db, "companies", companyId), {
    ...companyUpdate,
    deptSelections: nextDeptSelections,
    departments: activeDepartments(nextDeptSelections),
    affiliationDepartments: allAffiliationDepartments(nextDeptSelections),
    updatedAt: serverTimestamp(),
  }));

  // Posts: mirror profile fields on all, strip non-approved targets on affected ones.
  const affectedById = new Map(impact.affectedPosts.map(p => [p.post.id, p]));
  const postsSnap = await getDocs(query(collection(db, "ojt_posts"), where("companyId", "==", companyId)));
  for (const d of postsSnap.docs) {
    const post = d.data();
    const affected = affectedById.get(d.id);
    const update = { ...postSync };
    if (affected) {
      const droppedSlots = affected.dropped.reduce((sum, t) => sum + (Number(t.slot) || 0), 0);
      const currentSlot = typeof post.slot === "number" ? post.slot : null;
      Object.assign(update, {
        departments: [...new Set(affected.kept.map(t => t.college).filter(Boolean))],
        withdrawnTargets: arrayUnion(...affected.dropped.map(t => ({ ...t, withdrawnAt: now }))),
        updatedAt: serverTimestamp(),
      });
      if (!affected.legacy) update.courseSelections = affected.kept;
      if (currentSlot != null) update.slot = Math.max(0, currentSlot - droppedSlots);
      if (affected.willClose) {
        update.disabled = true;
        update.autoDisabledReason = "no_approved_programs";
        update.autoDisabledAt = now;
      }
    }
    if (Object.keys(update).length) ops.push(b => b.update(d.ref, update));
  }

  // Applications: flag only — status, history and records stay untouched.
  for (const { app, target } of impact.affectedApps) {
    ops.push(b => b.update(app.ref, {
      affiliationWithdrawn: true,
      affiliationWithdrawnAt: now,
      affiliationWithdrawnLabel: pairLabel(target.college, target.program),
      affiliationRestoredAt: null,   // withdrawn again after an earlier restore
    }));
  }

  // Notifications — grouped: one per student, one per withdrawn program for
  // coordinators, one summary for the company.
  const byStudent = new Map();
  for (const a of impact.affectedApps) {
    if (!a.app.studentId) continue;
    const list = byStudent.get(a.app.studentId) || [];
    list.push(a);
    byStudent.set(a.app.studentId, list);
  }
  for (const [studentId, list] of byStudent) {
    ops.push(b => b.set(doc(collection(db, "notifications")), {
      studentId,
      type: "affiliation_withdrawn",
      companyId,
      companyName: companyName || "",
      applicationIds: list.map(a => a.app.id),
      // The student dashboard opens `applicationId` when the notification is tapped.
      applicationId: list[0].app.id,
      message: `${companyName || "A company"} is no longer in the program. Your application${list.length > 1 ? "s stay" : " stays"} on record with ${list.length > 1 ? "their" : "its"} current status — your coordinator can help you follow up.`,
      read: false,
      createdAt: serverTimestamp(),
    }));
  }

  for (const w of withdrawn) {
    const related = impact.affectedApps.filter(a => entryCovers(w, a.target.college, a.target.program));
    const open = related.filter(a => !FINAL_OR_CLOSED.includes(String(a.app.status || "").toLowerCase()));
    ops.push(b => b.set(doc(collection(db, "notifications")), {
      recipientRole: "coordinator",
      department: w.department,
      program: w.program || "",
      type: "affiliation_withdrawn",
      companyId,
      companyName: companyName || "",
      previousStatus: w.previousStatus,
      openApplications: open.length,
      acceptedApplications: open.filter(a => String(a.app.status || "").toLowerCase() === "accepted").length,
      applicationIds: related.map(a => a.app.id),
      message: `${companyName || "A company"} is no longer in the program for ${pairLabel(w.department, w.program)}.` +
        (open.length ? ` ${open.length} student application${open.length > 1 ? "s" : ""} may need follow-up.` : ""),
      readBy: [],
      createdAt: serverTimestamp(),
    }));
  }

  if (added.length || withdrawn.length) {
    const parts = [];
    if (added.length) parts.push(`Sent for coordinator approval: ${added.map(a => pairLabel(a.department, a.program)).join(", ")}.`);
    if (withdrawn.length) parts.push(`Withdrawn: ${withdrawn.map(a => pairLabel(a.department, a.program)).join(", ")}.`);
    if (impact.summary.postsAffected) parts.push(`${impact.summary.postsAffected} post${impact.summary.postsAffected > 1 ? "s were" : " was"} updated${impact.summary.postsClosing ? `, ${impact.summary.postsClosing} closed because no approved program is left` : ""}.`);
    if (impact.summary.applications) parts.push(`${impact.summary.applications} existing application${impact.summary.applications > 1 ? "s remain" : " remains"} on record — please resolve ${impact.summary.applications > 1 ? "them" : "it"} with the coordinator.`);
    ops.push(b => b.set(doc(collection(db, "notifications")), {
      recipientId: companyId,
      type: "affiliation_update",
      title: "Accepted courses updated",
      message: parts.join(" "),
      read: false,
      createdAt: serverTimestamp(),
    }));
  }

  // A Firestore batch holds 500 writes. Everything normally fits in one; if a
  // very large company ever exceeds it, the profile write goes in the LAST
  // chunk so the affiliation only changes once posts/applications are done.
  const LIMIT = 450;
  if (ops.length <= LIMIT) {
    const batch = writeBatch(db);
    ops.forEach(op => op(batch));
    await batch.commit();
  } else {
    const [profileOp, ...rest] = ops;
    for (let i = 0; i < rest.length; i += LIMIT) {
      const batch = writeBatch(db);
      rest.slice(i, i + LIMIT).forEach(op => op(batch));
      await batch.commit();
    }
    const last = writeBatch(db);
    profileOp(last);
    await last.commit();
  }

  return impact.summary;
};

// ── 4. Read-side helpers (Find Company, Apply) ──────────────────────────────
// A company's affiliations with the same legacy fallback the coordinator list
// uses: companies registered before per-program status only have the flat
// `departments` array, judged by the company's top-level `status`.
export const getCompanyAffiliations = (company) => {
  if (!company) return [];
  if (Array.isArray(company.deptSelections) && company.deptSelections.length) {
    return company.deptSelections
      .filter(s => s?.department)
      .map(s => ({ ...s, program: s.program || "", status: s.status || AFFILIATION_STATUS.PENDING }));
  }
  if (Array.isArray(company.departments) && company.departments.length) {
    return company.departments.map(d => ({ department: d, program: "", status: company.status || AFFILIATION_STATUS.PENDING }));
  }
  return [];
};

// A post's targets that are still backed by an APPROVED affiliation.
export const eligiblePostTargets = (post, company) => {
  const affiliations = getCompanyAffiliations(company);
  const targets = Array.isArray(post?.courseSelections) && post.courseSelections.length
    ? post.courseSelections.filter(t => t?.college)
    : (post?.departments || []).map(d => ({ college: d, program: "" }));
  return targets.filter(t => isPairApproved(affiliations, t.college, t.program));
};

// Can a student with this college/program see and apply to this post?
export const isStudentEligibleForPost = (post, company, college, program) => {
  const collegeKey = normalizeScope(college);
  const programKey = normalizeScope(program);
  if (!collegeKey) return false;
  return eligiblePostTargets(post, company).some(t =>
    normalizeScope(t.college) === collegeKey &&
    (!programKey || !normalizeScope(t.program) || normalizeScope(t.program) === programKey)
  );
};

// ── 5. Restore applications when a program comes back to a post ────────────
// Called after the company saves a post. For every application on that post
// that is flagged `affiliationWithdrawn`, if the applicant's college/program
// is once again an APPROVED target of the post, the flag is cleared:
//   • affiliationWithdrawn → false   (warning, ⚑ follow-up and edit lock go away)
//   • affiliationRestoredAt → now    (affiliationWithdrawnAt is kept as history)
// Status, messages and everything else on the application stay untouched.
// Applications whose program was re-approved but NOT put back on this post
// stay flagged — this post still isn't open to them.
// Notifies each restored student and, per program, the coordinator — in the
// same batch, so notices exist only if the restore was saved.
export const restoreApplicationsForPost = async ({ companyId, companyName, postId, courseSelections, deptSelections }) => {
  if (!companyId || !postId) return { restored: 0 };
  const snap = await getDocs(query(
    collection(db, "applications"),
    where("companyId", "==", companyId),
    where("postId", "==", postId),
  ));
  const approvedTargets = (courseSelections || []).filter(t =>
    t?.college && isPairApproved(deptSelections, t.college, t.program)
  );
  const toRestore = [];
  snap.docs.forEach(d => {
    const app = d.data();
    if (app.affiliationWithdrawn !== true) return;
    const target = approvedTargets.find(t => applicationMatchesTarget(app, t));
    if (target) toRestore.push({ ref: d.ref, id: d.id, app, target });
  });
  if (toRestore.length === 0) return { restored: 0 };

  return commitRestore(toRestore, companyId, companyName, "on a post");
};

// Shared by both restore paths: clears the flag, keeps affiliationWithdrawnAt
// as history, and notifies students + coordinators in the same batch.
const commitRestore = async (toRestore, companyId, companyName, where_) => {
  const now = Timestamp.now();
  const batch = writeBatch(db);
  toRestore.forEach(({ ref }) => batch.update(ref, {
    affiliationWithdrawn: false,
    affiliationRestoredAt: now,
  }));

  const byStudent = new Map();
  toRestore.forEach(r => {
    if (!r.app.studentId) return;
    const list = byStudent.get(r.app.studentId) || [];
    list.push(r);
    byStudent.set(r.app.studentId, list);
  });
  byStudent.forEach((list, studentId) => {
    batch.set(doc(collection(db, "notifications")), {
      studentId,
      type: "affiliation_restored",
      companyId,
      companyName: companyName || "",
      applicationId: list[0].id,
      applicationIds: list.map(r => r.id),
      message: `${companyName || "The company"} is accepting your program again. Your application${list.length > 1 ? "s are" : " is"} active again with ${list.length > 1 ? "their" : "its"} current status.`,
      read: false,
      createdAt: serverTimestamp(),
    });
  });

  const byProgram = new Map();
  toRestore.forEach(r => {
    const key = pairKey(r.target.college, r.target.program);
    const entry = byProgram.get(key) || { target: r.target, ids: [] };
    entry.ids.push(r.id);
    byProgram.set(key, entry);
  });
  byProgram.forEach(({ target, ids }) => {
    batch.set(doc(collection(db, "notifications")), {
      recipientRole: "coordinator",
      department: target.college,
      program: target.program || "",
      type: "affiliation_restored",
      companyId,
      companyName: companyName || "",
      applicationIds: ids,
      openApplications: 0,   // nothing to follow up — this resolves earlier flags
      message: `${companyName || "A company"} restored ${pairLabel(target.college, target.program)} ${where_}. ${ids.length} earlier application${ids.length > 1 ? "s are" : " is"} active again.`,
      readBy: [],
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return { restored: toRestore.length };
};

// Today as "YYYY-MM-DD" in local time — same comparison the Find Company
// screens use for `expirationDate` (a plain date string).
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const isClosedPost = (post) =>
  post?.archived === true || (!!post?.expirationDate && post.expirationDate < todayStr());

// ── 6. Restore on RE-APPROVAL for posts that can't be edited any more ───────
// An expired or archived post can't be edited, so the company can never
// re-select the program there and restoreApplicationsForPost never runs for
// it. For those posts the coordinator's re-approval itself is the signal:
// once the company is APPROVED again for a program, applications on its
// CLOSED posts that were flagged for that program are restored.
// Open posts are NOT touched here — for them the company must still put the
// program back on the post (Rule #6: re-approval doesn't reopen posts).
// Called by the coordinator right after approveCompanyDepartment succeeds.
export const restoreApplicationsOnClosedPosts = async ({ companyId, companyName, approvedEntries }) => {
  if (!companyId || !(approvedEntries || []).length) return { restored: 0 };
  const [postsSnap, appsSnap] = await Promise.all([
    getDocs(query(collection(db, "ojt_posts"), where("companyId", "==", companyId))),
    getDocs(query(collection(db, "applications"), where("companyId", "==", companyId))),
  ]);
  const closedPostIds = new Set(postsSnap.docs.filter(d => isClosedPost(d.data())).map(d => d.id));
  // Applications whose post no longer exists count as closed too.
  const existingPostIds = new Set(postsSnap.docs.map(d => d.id));

  const toRestore = [];
  appsSnap.docs.forEach(d => {
    const app = d.data();
    if (app.affiliationWithdrawn !== true) return;
    const closed = closedPostIds.has(app.postId) || (app.postId && !existingPostIds.has(app.postId));
    if (!closed) return;
    const entry = approvedEntries.find(e => entryCovers(e, app.college || app.department, app.program || app.course));
    if (!entry) return;
    toRestore.push({ ref: d.ref, id: d.id, app, target: { college: entry.department, program: entry.program || app.program || "" } });
  });
  if (toRestore.length === 0) return { restored: 0 };
  return commitRestore(toRestore, companyId, companyName, "after re-approval (closed post)");
};