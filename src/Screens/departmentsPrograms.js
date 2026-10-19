import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// ── Departments / Programs (single source of truth) ─────────────────────────
// Both SignUpStep1Screen (Company registration) and
// CoordinatorAccountProfileScreen (Coordinator profile) used to keep their
// OWN hardcoded copy of this data, which could silently drift apart. This
// module is the one place it now lives, backed by Firestore so an admin can
// add/edit Colleges and Programs without a code change.
//
// A MAJOR is never part of a program's name. It lives in that program's
// `specializations` list ("Bachelor of Secondary Education" + major "English"), so Program and
// Major can be picked, stored and filtered separately everywhere.
//
// Assumed Firestore shape (adapt below if the project's actual structure
// differs — see the write-up for how to check/migrate):
//
//   departments (collection)
//     {doc, e.g. auto-id or a slug like "ccs"}
//       name:     "College of Computer Studies"   (string, required)
//       abbr:     "CCS"                            (string, optional)
//       programs: [                                (array of maps)
//         { name: "Bachelor of Science in Information Technology", specializations: [] },
//         ...
//       ]
//
// If the "departments" collection doesn't exist yet or is empty (e.g. a
// fresh environment before anyone has seeded it), DEFAULT_DEPARTMENTS below
// is used instead so Sign-Up / Coordinator Profile never show a blank
// dropdown. Once real docs exist in Firestore they take over automatically.
export const DEFAULT_DEPARTMENTS = {
  "College of Computer Studies": {
    abbr: "CCS",
    programs: [
      { name: "Bachelor of Science in Information Technology", specializations: [] },
    ],
  },
  "College of Business and Accountancy": {
    abbr: "CBA",
    programs: [
      { name: "Bachelor of Science in Business Administration", specializations: ["Marketing Management"] },
      { name: "Bachelor of Science in Accountancy", specializations: [] },
    ],
  },
  "College of Criminal Justice Education": {
    abbr: "CCJE",
    programs: [{ name: "Bachelor of Science in Criminology", specializations: [] }],
  },
  "College of Liberal Arts": {
    abbr: "CLA",
    programs: [{ name: "Bachelor of Arts in Political Science", specializations: [] }],
  },
  "College of Education": {
    abbr: "CED",
    programs: [
      { name: "Bachelor of Elementary Education", specializations: [] },
      { name: "Bachelor of Secondary Education", specializations: ["English", "Mathematics"] },
    ],
  },
  "College of Hospitality and Tourism Management": {
    abbr: "CHTM",
    programs: [
      { name: "Bachelor of Science in Tourism Management", specializations: [] },
      { name: "Bachelor of Science in Hospitality Management", specializations: [] },
    ],
  },
};

// Normalizes one raw Firestore "departments" doc into
// { abbr, programs: [{ name, specializations }] }. Tolerates `programs`
// being stored as either an array of strings or an array of maps.
// Also splits any old combined name ("BS Business Administration — Major in Marketing Management")
// into program + major on the fly, so stale Firestore data never shows a major inside a program name.
const LEGACY_MAJOR = /^(.+?)\s+[—–-]\s+Major in\s+(.+)$/i;
// "BS Education" was never a real program of the College of Education: its program is
// Bachelor of Secondary Education (majors English and Mathematics). Old records are renamed.
const RENAMES = {
  "bs business administration": "Bachelor of Science in Business Administration",
  "bs education":               "Bachelor of Secondary Education",
};
const canon = (n) => RENAMES[n.trim().toLowerCase()] || n.trim();

// For records saved before programs and majors were separated (a company's program
// "BS Education — Major in English", say): reads the old name as a program plus a major,
// so screens can show it correctly with no database migration.
//   splitLegacyProgram("BS Education — Major in English")
//     → { program: "Bachelor of Secondary Education", specialization: "English" }
export const splitLegacyProgram = (name) => {
  const raw = String(name ?? "").trim();
  const m = LEGACY_MAJOR.exec(raw);
  return { program: canon(m ? m[1] : raw), specialization: m ? m[2].trim() : "" };
};
// Also used by AdminScreen, which reads the raw `departments` docs itself.
export const normalizeDept = (data) => {
  const programs = [];
  for (const p of Array.isArray(data.programs) ? data.programs : []) {
    const raw = String((typeof p === "string" ? p : p?.name) ?? "").trim();
    const m = LEGACY_MAJOR.exec(raw);
    const name = canon(m ? m[1] : raw);
    if (!name) continue;
    let entry = programs.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!entry) { entry = { name, specializations: [] }; programs.push(entry); }
    const specs = [...(typeof p === "string" ? [] : p?.specializations || []), m ? m[2].trim() : ""].filter(Boolean);
    specs.forEach(s => { if (!entry.specializations.some(x => x.toLowerCase() === s.toLowerCase())) entry.specializations.push(s); });
  }
  return { abbr: data.abbr || "", programs };
};

// Live-subscribes to the "departments" collection so any admin edit (new
// College, new Program, renamed Program, etc.) is reflected immediately in
// both Sign-Up and Coordinator Profile without a redeploy. Falls back to
// DEFAULT_DEPARTMENTS while loading, on error, or if Firestore has nothing
// seeded yet.
export const useDepartmentsPrograms = () => {
  const [departments, setDepartments]     = useState(DEFAULT_DEPARTMENTS);
  const [loading, setLoading]             = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "departments"),
      snap => {
        if (snap.empty) {
          setDepartments(DEFAULT_DEPARTMENTS);
          setUsingFallback(true);
        } else {
          const map = {};
          snap.docs.forEach(d => {
            const data = d.data();
            const name = data.name || d.id;
            if (!name) return;
            map[name] = normalizeDept(data);
          });
          setDepartments(map);
          setUsingFallback(false);
        }
        setLoading(false);
      },
      err => {
        console.error("Failed to load departments/programs from Firestore, using fallback list:", err);
        setDepartments(DEFAULT_DEPARTMENTS);
        setUsingFallback(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { departments, departmentNames: Object.keys(departments), loading, usingFallback };
};