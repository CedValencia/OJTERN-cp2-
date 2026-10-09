// useEligibleOjtPosts.js
// ─────────────────────────────────────────────────────────────────────────────
// Live OJT posts for the Find Company screens (student + coordinator) and the
// student dashboard, with OJTern's affiliation rule applied:
//
//   A post only shows for a college/program while the company's affiliation
//   for that program is APPROVED.
//
// Posts are already cleaned when a company withdraws a program (see
// affiliationService.commitCompanyProfileWithAffiliations). This hook is the
// safety net for posts created before that existed, or edited by an older
// build: it reads each posting company's affiliations live and trims every
// post's `courseSelections` / `departments` down to approved programs only.
// Posts left with no approved program are dropped from the result.
//
// A BLOCKED company's posts are dropped too — read live from the same company
// documents, so blocking a company removes its posts from an open screen right
// away and unblocking brings them back.
//
// The untrimmed targets stay available as `post.allCourseSelections`.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { collection, documentId, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { eligiblePostTargets } from "./affiliationService";

const CHUNK = 30; // Firestore "in" limit

// A company is blocked when its own document says so — the same test the apply
// form uses (StudentApplicationScreen → companyAvailability).
export const isCompanyBlocked = (companyData) =>
  String(companyData?.status || "").toLowerCase() === "blocked";

export const useEligibleOjtPosts = () => {
  const [rawPosts, setRawPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [companiesById, setCompaniesById] = useState({});
  // Company ids whose doc couldn't be read (rules, network). Their posts are
  // shown untrimmed rather than hidden, so a read error never empties the screen.
  const [unreadable, setUnreadable] = useState({});

  useEffect(() => {
    const q = query(collection(db, "ojt_posts"), where("disabled", "==", false));
    const unsub = onSnapshot(q, snap => {
      const loaded = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.archived !== true);
      loaded.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setRawPosts(loaded);
      setPostsLoading(false);
    }, err => {
      console.error("Failed to load OJT posts:", err);
      setPostsLoading(false);
    });
    return () => unsub();
  }, []);

  // Stable key so we only resubscribe when the SET of companies changes.
  const companyIdsKey = useMemo(
    () => [...new Set(rawPosts.map(p => p.companyId).filter(Boolean))].sort().join("|"),
    [rawPosts]
  );

  useEffect(() => {
    const ids = companyIdsKey ? companyIdsKey.split("|") : [];
    if (ids.length === 0) return;
    const unsubs = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const q = query(collection(db, "companies"), where(documentId(), "in", chunk));
      unsubs.push(onSnapshot(q, snap => {
        setCompaniesById(prev => {
          const next = { ...prev };
          // Ids in this chunk with no doc → company deleted; treat as no affiliations.
          chunk.forEach(id => { next[id] = null; });
          snap.docs.forEach(d => { next[d.id] = d.data(); });
          return next;
        });
      }, err => {
        console.error("Failed to load company affiliations:", err);
        setUnreadable(prev => {
          const next = { ...prev };
          chunk.forEach(id => { next[id] = true; });
          return next;
        });
      }));
    }
    return () => unsubs.forEach(u => u());
  }, [companyIdsKey]);

  const companiesLoading = rawPosts.some(p =>
    p.companyId && !(p.companyId in companiesById) && !unreadable[p.companyId]
  );

  const posts = useMemo(() => rawPosts.flatMap(post => {
    if (!post.companyId || unreadable[post.companyId]) return [post];
    if (!(post.companyId in companiesById)) return []; // still loading
    const company = companiesById[post.companyId];
    if (isCompanyBlocked(company)) return []; // blocked company → its posts disappear
    const eligible = eligiblePostTargets(post, company);
    if (eligible.length === 0) return [];
    const hasCourseSelections = Array.isArray(post.courseSelections) && post.courseSelections.length > 0;
    return [{
      ...post,
      allCourseSelections: post.courseSelections || [],
      ...(hasCourseSelections ? { courseSelections: eligible } : {}),
      departments: [...new Set(eligible.map(t => t.college))],
    }];
  }), [rawPosts, companiesById, unreadable]);

  return { posts, loading: postsLoading || companiesLoading, companiesById };
};

export default useEligibleOjtPosts;

// ─────────────────────────────────────────────────────────────────────────────
// Post status for APPLICATIONS (Recent Applications, Coordinator Student List).
// An application keeps its own status when its post expires — the company can
// still move it forward — but the student and coordinator should be able to
// see that the post itself is no longer open. This reads the posts behind a
// set of applications live, in chunks of 30 (Firestore "in" limit).
// ─────────────────────────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// "YYYY-MM-DD" → "Oct 1, 2026", built from parts so it never shifts a day.
export const formatPostDate = (str) => {
  const [y, m, d] = String(str || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Returns null while the post is still open (or not loaded yet), otherwise
// { kind: "expired" | "archived" | "removed", label, detail }.
export const getPostClosure = (postId, postsById) => {
  if (!postId || !postsById || !(postId in postsById)) return null;   // unknown yet
  const post = postsById[postId];
  if (post === null) {
    return { kind: "removed", label: "Post removed", detail: "This post is no longer available." };
  }
  if (post.archived === true) {
    return { kind: "archived", label: "Post closed", detail: "The company closed this post." };
  }
  if (post.expirationDate && post.expirationDate < todayStr()) {
    const when = formatPostDate(post.expirationDate);
    return { kind: "expired", label: "Post expired", detail: when ? `This post expired on ${when}.` : "This post has expired." };
  }
  return null;
};

export const usePostsByIds = (postIds) => {
  const key = [...new Set((postIds || []).filter(Boolean))].sort().join("|");
  const [postsById, setPostsById] = useState({});
  useEffect(() => {
    const ids = key ? key.split("|") : [];
    if (ids.length === 0) return;
    const unsubs = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      unsubs.push(onSnapshot(
        query(collection(db, "ojt_posts"), where(documentId(), "in", chunk)),
        snap => setPostsById(prev => {
          const next = { ...prev };
          chunk.forEach(id => { next[id] = null; });          // missing → removed
          snap.docs.forEach(d => { next[d.id] = d.data(); });
          return next;
        }),
        err => console.error("Failed to load posts for applications:", err)
      ));
    }
    return () => unsubs.forEach(u => u());
  }, [key]);
  return postsById;
};