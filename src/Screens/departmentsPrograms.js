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
      { name: "BS Business Administration — Major in Marketing Management", specializations: [] },
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
    abbr: "CE",
    programs: [
      { name: "Bachelor of Elementary Education", specializations: [] },
      { name: "BS Education — Major in English", specializations: [] },
      { name: "BS Education — Major in Mathematics", specializations: [] },
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
const normalizeDept = (data) => {
  const programs = Array.isArray(data.programs)
    ? data.programs
        .map(p =>
          typeof p === "string"
            ? { name: p, specializations: [] }
            : { name: p?.name || "", specializations: p?.specializations || [] }
        )
        .filter(p => p.name)
    : [];
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