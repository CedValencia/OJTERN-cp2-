#!/usr/bin/env node
// functions/scripts/splitMajors.js
//
// ONE-TIME migration: separates a major from the program name.
//
//   before:  program: "BS Education — Major in English"
//   after:   program: "Bachelor of Secondary Education",  specialization: "English"
//
// Why it is needed: departmentsPrograms.js now keeps majors in each program's
// `specializations` list. Anything already saved with the old combined name
// (students, coordinators, companies, and the departments docs themselves if they
// were seeded from the old defaults) would stop matching the new program names,
// so those records are converted to the new shape.
//
// SAFE BY DEFAULT: with no flags it only PRINTS what it would change. Nothing is
// written until you add --apply.
//
//   cd functions
//   node scripts/splitMajors.js --project <your-firebase-project-id>            # dry run
//   node scripts/splitMajors.js --project <your-firebase-project-id> --apply    # write
//
// Credentials: run `gcloud auth application-default login` once, or set
// GOOGLE_APPLICATION_CREDENTIALS to a service-account key file. Back up first
// (Firestore export) before using --apply on real data.
//
// What it converts
//   • departments/*   : combined entries inside `programs` become one program with `specializations`
//   • any document    : an object that has a `program` string in the old form (a student's own
//                       `program`, or entries of `deptSelections`, wherever they sit) gets the
//                       base name in `program` and the major in `specialization`
//                       (an existing, different `specialization` is never overwritten; it is reported)
//   • everything else : a plain string in the old form that this script does NOT convert
//                       (for example inside a list of strings) is only REPORTED, because the
//                       major can't be kept in a bare string. Review those by hand.

// "BS Education — Major in English"  (em dash, en dash or hyphen)
const LEGACY = /^(.+?)\s+[—–-]\s+Major in\s+(.+)$/i;

const clean = (v) => String(v == null ? "" : v).trim();
const isPlain = (o) => o !== null && typeof o === "object" && Object.getPrototypeOf(o) === Object.prototype;

// Program names that were renamed (matched case-insensitively, whole name only).
// "BS Education" is not a real program of the College of Education; it is Bachelor of
// Secondary Education (majors English and Mathematics). Keep in step with departmentsPrograms.js.
const RENAMES = {
  "bs business administration": "Bachelor of Science in Business Administration",
  "bs education":               "Bachelor of Secondary Education",
};
const canon = (n) => RENAMES[clean(n).toLowerCase()] || clean(n);

// → { program, specialization } or null when the name needs no change
// (no embedded major and not a renamed program).
const splitProgramName = (name) => {
  const m = LEGACY.exec(clean(name));
  if (m) return { program: canon(m[1]), specialization: clean(m[2]) };
  const renamed = canon(name);
  return renamed !== clean(name) ? { program: renamed, specialization: "" } : null;
};

// Rebuilds a departments `programs` array: combined entries merge into one program per base name.
const splitProgramsArray = (programs) => {
  if (!Array.isArray(programs)) return { value: programs, changed: false };
  const out = [];
  const byName = new Map();
  let changed = false;
  const add = (name, specs) => {
    const key = name.toLowerCase();
    if (!byName.has(key)) { const entry = { name, specializations: [] }; byName.set(key, entry); out.push(entry); }
    const entry = byName.get(key);
    for (const sp of specs) if (sp && !entry.specializations.some((x) => x.toLowerCase() === sp.toLowerCase())) entry.specializations.push(sp);
  };
  for (const p of programs) {
    const name = typeof p === "string" ? p : clean(p && p.name);
    const specs = typeof p === "string" ? [] : (Array.isArray(p && p.specializations) ? p.specializations.map(clean) : []);
    if (!name) continue;
    const split = splitProgramName(name);
    if (split) { changed = true; add(split.program, [split.specialization, ...specs]); }
    else add(name, specs);
  }
  // Same shape in and out unless something was actually split (strings → maps counts as unchanged data).
  return { value: changed ? out : programs, changed };
};

// Walks any value without mutating it. Returns { value, changed } and records review items.
const convert = (node, path, report) => {
  if (Array.isArray(node)) {
    let changed = false;
    const value = node.map((item, i) => {
      if (typeof item === "string" && LEGACY.test(clean(item))) report.unhandled.push({ path: `${path}[${i}]`, value: item });
      const r = convert(item, `${path}[${i}]`, report);
      if (r.changed) changed = true;
      return r.value;
    });
    return { value: changed ? value : node, changed };
  }
  if (!isPlain(node)) return { value: node, changed: false };   // Timestamps, GeoPoints, etc. stay untouched

  let changed = false;
  const next = {};
  for (const [k, v] of Object.entries(node)) {
    const r = convert(v, path ? `${path}.${k}` : k, report);
    next[k] = r.value;
    if (r.changed) changed = true;
    if (k !== "program" && typeof v === "string" && LEGACY.test(clean(v))) report.unhandled.push({ path: path ? `${path}.${k}` : k, value: v });
  }
  if (typeof node.program === "string") {
    const split = splitProgramName(node.program);
    if (split) {
      next.program = split.program;
      const existing = clean(node.specialization);
      if (!split.specialization) { /* rename only: leave specialization alone */ }
      else if (!existing) next.specialization = split.specialization;
      else if (existing.toLowerCase() !== split.specialization.toLowerCase()) {
        report.conflicts.push({ path, program: node.program, specialization: existing });
      }
      changed = true;
    }
  }
  return { value: changed ? next : node, changed };
};

// One document → { updates: { topLevelField: newValue }, report }
const planDocument = (collectionName, data) => {
  const report = { unhandled: [], conflicts: [] };
  const updates = {};

  if (collectionName === "departments") {
    const r = splitProgramsArray(data.programs);
    if (r.changed) updates.programs = r.value;
    return { updates, report };
  }

  // The document itself is treated as an object so a top-level `program` (a student's own) is
  // handled the same way as one inside `deptSelections`. Unchanged branches keep their identity,
  // so comparing by reference tells which top-level fields actually changed.
  const r = convert(data, "", report);
  if (r.changed) {
    for (const key of Object.keys(r.value)) if (r.value[key] !== data[key]) updates[key] = r.value[key];
  }
  return { updates, report };
};

module.exports = { splitProgramName, splitProgramsArray, convert, planDocument, LEGACY };

// ───────────────────────────── CLI ─────────────────────────────
if (require.main === module) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
  const APPLY = process.argv.includes("--apply");
  const projectId = arg("--project") || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) { console.error("Pass --project <firebase-project-id>"); process.exit(1); }

  const admin = require("firebase-admin");
  admin.initializeApp({ projectId });
  const db = admin.firestore();

  const COLLECTIONS = ["departments", "students", "coordinators", "companies", "ojt_posts", "applications", "coordinatorInvites"];

  (async () => {
    console.log(`${APPLY ? "APPLYING changes to" : "DRY RUN on"} project "${projectId}"\n`);
    let total = 0;
    for (const name of COLLECTIONS) {
      const snap = await db.collection(name).get();
      const changes = [];
      const review = [];
      snap.forEach((d) => {
        const { updates, report } = planDocument(name, d.data());
        if (Object.keys(updates).length) changes.push({ ref: d.ref, id: d.id, updates });
        report.unhandled.forEach((u) => review.push(`${d.id}: ${u.path} = "${u.value}"`));
        report.conflicts.forEach((c) => review.push(`${d.id}: ${c.path} has program "${c.program}" but specialization "${c.specialization}" (kept)`));
      });

      console.log(`${name}: ${snap.size} docs, ${changes.length} to change`);
      changes.slice(0, 5).forEach((c) => console.log(`   ${c.id}: ${Object.keys(c.updates).join(", ")}`));
      if (changes.length > 5) console.log(`   … and ${changes.length - 5} more`);
      if (review.length) { console.log("   NEEDS A MANUAL LOOK:"); review.slice(0, 20).forEach((r) => console.log(`   - ${r}`)); }

      if (APPLY) {
        for (let i = 0; i < changes.length; i += 400) {
          const batch = db.batch();
          changes.slice(i, i + 400).forEach((c) => batch.update(c.ref, c.updates));
          await batch.commit();
        }
      }
      total += changes.length;
    }
    console.log(`\n${APPLY ? "Updated" : "Would update"} ${total} document(s).${APPLY ? "" : "  Re-run with --apply to write."}`);
  })().catch((e) => { console.error(e); process.exit(1); });
}