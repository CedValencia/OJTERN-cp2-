// Superseded: useEligibleOjtPosts now drops the posts of blocked companies
// itself, so this is just an alias kept for screens that already import it.
// New code should import useEligibleOjtPosts directly; this file can be deleted
// once nothing imports it.
export { useEligibleOjtPosts as useVisibleOjtPosts, isCompanyBlocked } from "./useEligibleOjtPosts";