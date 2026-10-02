// ── Account standing ─────────────────────────────────────────────────────────
// One place that answers "can this account still act, and what should we tell
// the other side?" — used by the student's Recent Application (the company's
// standing), the company's Applicants (the student's standing) and the
// coordinator's Student List (the company's standing on each placement).
//
// Why a shared helper rather than reading `status` in each screen: a suspension
// that has run out still SAYS "suspended" in Firestore, because the status only
// flips when that account next signs in (see isSuspensionExpired /
// checkAndReactivateCompany in AuthService.js). A screen that trusts `status`
// alone would tell a student a company is suspended weeks after it stopped
// being true. The end date decides here, never the status on its own.

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (ms) =>
  ms ? new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

/**
 * @param {object} data   a companies/{uid} or students/{uid} document
 * @param {"company"|"student"} kind  who the document belongs to
 * @returns {{
 *   state: "active"|"suspended"|"blocked"|"archived",
 *   isActive: boolean,      // nothing is wrong — treat normally
 *   canProceed: boolean,    // false = the application can't move forward
 *   temporary: boolean,     // true = it comes back on its own (suspension)
 *   daysLeft: number,       // whole days remaining on a suspension
 *   endDate: string,        // "October 17, 2026", or ""
 *   label: string,          // short badge text
 *   message: string,        // full sentence for a notice
 * }}
 */
export const standingOf = (data, kind = "company") => {
  const active = {
    state: "active", isActive: true, canProceed: true, temporary: false,
    daysLeft: 0, endDate: "", label: "", message: "",
  };
  if (!data) return active;

  const who = kind === "student" ? "This student" : "This company";
  const status = String(data.status || "").toLowerCase();

  // Archived students: nothing is wrong with them, they're simply no longer
  // current (a graduated batch, say). Worth different wording from "blocked",
  // which is a disciplinary action — a company shouldn't be told a student is
  // in trouble when they aren't.
  if (kind === "student" && data.isArchived === true) {
    return {
      state: "archived", isActive: false, canProceed: false, temporary: false,
      daysLeft: 0, endDate: "",
      label: "No longer active",
      message: `${who} is no longer an active student, so the application can no longer proceed.`,
    };
  }

  if (status === "blocked") {
    return {
      state: "blocked", isActive: false, canProceed: false, temporary: false,
      daysLeft: 0, endDate: "",
      label: "Blocked",
      message: `${who}'s account is blocked, so the application can no longer proceed.`,
    };
  }

  if (status === "suspended") {
    const until = toMillis(data.suspendedUntil);
    // Past its end date → effectively active again, whatever `status` still says.
    if (until && Date.now() >= until) return active;

    const daysLeft = until ? Math.max(1, Math.ceil((until - Date.now()) / 86400000)) : 0;
    const endDate = formatDate(until);
    return {
      state: "suspended", isActive: false, canProceed: true, temporary: true,
      daysLeft, endDate,
      label: endDate ? `Suspended until ${endDate}` : "Suspended",
      message: endDate
        ? `${who} is suspended until ${endDate} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left), so they can't act on the application in the meantime. It stays on record and becomes active again once the suspension ends.`
        : `${who} is suspended, so they can't act on the application in the meantime.`,
    };
  }

  return active;
};

// Colors for the notice, so the three screens look the same.
export const STANDING_TONE = {
  suspended: { bg: "#FAF1DD", border: "#E4CE9B", text: "#7A5B10" },
  blocked:   { bg: "#F7E9E9", border: "#E3BFBF", text: "#8B2020" },
  archived:  { bg: "#F1F1F1", border: "#DCDCDC", text: "#555555" },
};

export default standingOf;