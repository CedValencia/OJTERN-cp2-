// theme.js
// Shared design tokens for OJTern.
// Change a value here and it changes everywhere; never hardcode hex in a screen.

export const color = {
  // Dating charcoal (page background) — ngayon light/white family.
  wine950: "#FFFFFF",
  wine900: "#FAFAFA",
  wine800: "#F2F2F2",
  wine700: "#EAEAEA",   // base field
  wine600: "#FFFFFF",
  wine500: "#F5F5F5",
  wine400: "#D8D8D8",   // light-gray, gagamitin natin sa field icon badge

  // Dating cream/yellowish (form panel) — ngayon dark/black family.
  // These three now resolve to CSS custom properties (see ACCENT_THEMES
  // below) instead of fixed hex, so the Coordinator's theme-color picker can
  // repaint every screen that builds ink/inkDeep/inkSoft from these tokens —
  // with no per-screen code changes and no React re-render, since the
  // browser resolves var() live wherever the string is used (including
  // inside injected <style> text). The fallback after the comma is what
  // renders before JS has run, or if the var is ever unset.
  blush50:  "var(--ojt-ink, #000000)",       // panel background (was #000000)
  blush100: "var(--ojt-ink-deep, #161616)",  // panel background (was #161616)
  blush200: "var(--ojt-ink-soft, #1F1F1F)",  // (was #1F1F1F)
  blush300: "#333333",  // hairlines/borders

  hoverWash:       "var(--ojt-hover-wash, #F2F2F2)",        // subtle row/button hover fill
  hoverWashStrong: "var(--ojt-hover-wash-strong, #EAEAEA)", // stronger fill (list rows)
  hoverBorder:     "var(--ojt-hover-border, #D8D8D8)",      // hover border on cards/rows

  // Logo badge circle (About Us). Original theme = the grey below; every other
  // theme swaps in its own `badge` value from ACCENT_THEMES via --ojt-badge.
  badge: "var(--ojt-badge, #898989)",

  gold500:  "#FFFFFF",
  gold600:  "#F2F2F2",
  goldTint: "rgba(255,255,255,0.14)",

  ink:      "#141414",   // dark text — sa LIGHT page background
  inkBody:  "#333333",
  inkMuted: "#767676",
  inkFaint: "#A8A8A8",
  white:    "#FFFFFF",

  onWine:      "#FAFAFA",   // light text — sa DARK panel ngayon
  onWineMuted: "rgba(250,250,250,0.62)",
  onWineFaint: "rgba(250,250,250,0.22)",

  danger:  "#A85450",
  warning: "#9C8144",
  info:    "#546A7B",
  success: "#5A7560",
};

// ── Coordinator/Student accent theme (nav bar "change color" picker) ─────────
// Six selectable swatches: five pastel accents + the original black/white
// look. Deliberately scoped, not global:
//   · Storage is keyed per dashboard ("coordinator", "student", ...) so
//     picking a color on one dashboard never touches another's — each role
//     keeps its own independent choice, including Company, which simply
//     never calls into this file's accent helpers and so always stays the
//     original black/white.
//   · The CSS vars this produces are meant to be spread onto that
//     dashboard's OWN top-level wrapper element (via getAccentThemeVars),
//     never onto document.documentElement — a variable set on one screen's
//     own subtree only ever cascades to that subtree, so it can't bleed
//     into a different dashboard rendered elsewhere in the same tab.
// Deeper, matte, saturated tones — not soft/pastel — while keeping each
// theme's ink → inkDeep two-stop gradient structure and hover wash triad.
export const ACCENT_THEMES = {
  default: { id: "default", label: "Original", swatch: "#141414", badge: "#898989", ink: "#000000", inkDeep: "#161616", inkSoft: "#1F1F1F", hoverWash: "#F2F2F2", hoverWashStrong: "#EAEAEA", hoverBorder: "#D8D8D8", gradient: "linear-gradient(135deg, #000000 0%, #1F1F1F 100%)" },
  red:     { id: "red",     label: "Red",       swatch: "#8B3A3A", badge: "#A85C5C", ink: "#8B3A3A", inkDeep: "#5C2626", inkSoft: "#A85C5C", hoverWash: "#F5EBEA", hoverWashStrong: "#EDD8D6", hoverBorder: "#C98F8F", gradient: "linear-gradient(135deg, #8B3A3A 0%, #5C2626 100%)" },
  blue:    { id: "blue",    label: "Blue",      swatch: "#2E5478", badge: "#4C7396", ink: "#2E5478", inkDeep: "#1C3550", inkSoft: "#4C7396", hoverWash: "#E9EEF3", hoverWashStrong: "#D7E0E9", hoverBorder: "#8FA8BC", gradient: "linear-gradient(135deg, #2E5478 0%, #1C3550 100%)" },
  violet:  { id: "violet",  label: "Violet",    swatch: "#5B4478", badge: "#7C6296", ink: "#5B4478", inkDeep: "#3A2C4E", inkSoft: "#7C6296", hoverWash: "#EEEAF3", hoverWashStrong: "#E0D9E9", hoverBorder: "#A997B9", gradient: "linear-gradient(135deg, #5B4478 0%, #3A2C4E 100%)" },
  pink:    { id: "pink",    label: "Pink",      swatch: "#8A3B58", badge: "#AD5E7A", ink: "#8A3B58", inkDeep: "#5C2438", inkSoft: "#AD5E7A", hoverWash: "#F3E9EE", hoverWashStrong: "#E9D6DF", hoverBorder: "#C98CA3", gradient: "linear-gradient(135deg, #8A3B58 0%, #5C2438 100%)" },
  yellow:  { id: "yellow",  label: "Yellow",    swatch: "#8A6A1E", badge: "#AD8A3E", ink: "#8A6A1E", inkDeep: "#5C4712", inkSoft: "#AD8A3E", hoverWash: "#F3EEE1", hoverWashStrong: "#E9E0C9", hoverBorder: "#C9A85F", gradient: "linear-gradient(135deg, #8A6A1E 0%, #5C4712 100%)" },
};
export const ACCENT_THEME_ORDER = ["default", "red", "blue", "violet", "pink", "yellow"];

// Picks the right themed asset (icon, illustration, etc.) out of a per-theme
// map, given the current accentThemeId. `assets` is keyed by ACCENT_THEMES
// id ("default", "red", "blue", "violet", "pink", "yellow"); any id missing
// from the map (or an id with no match) falls back to assets.default. Screens
// still import each PNG themselves (paths are relative to each screen's own
// ../icons folder) and just build the map, e.g.:
//   import viewIcon from "../icons/view.png";
//   import redViewIcon from "../icons/redview.png";
//   ...
//   const VIEW_ICON_BY_THEME = { default: viewIcon, red: redViewIcon, ... };
//   const icon = getThemedAsset(VIEW_ICON_BY_THEME, accentThemeId);
export const getThemedAsset = (assets, accentThemeId) => {
  return (assets && assets[accentThemeId]) || (assets && assets.default);
};

// One localStorage key per dashboard scope — e.g. "ojtern.accentTheme.coordinator"
// and "ojtern.accentTheme.student" are two entirely separate values.
const accentStorageKey = (scope) => `ojtern.accentTheme.${scope}`;

// Reads the saved choice for one scope (falls back to "default" — original
// black/white — on the server, in private/incognito tabs that block
// storage, or on first visit). Pass the dashboard's own scope id, e.g.
// getSavedAccentThemeId("coordinator").
export const getSavedAccentThemeId = (scope) => {
  if (typeof window === "undefined") return "default";
  try {
    const saved = window.localStorage.getItem(accentStorageKey(scope));
    return ACCENT_THEMES[saved] ? saved : "default";
  } catch {
    return "default";
  }
};

// Persists a choice for one scope only. Returns the id that was actually
// saved (falls back to "default" for an unknown id).
export const saveAccentThemeId = (scope, id) => {
  const applied = ACCENT_THEMES[id] ? id : "default";
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(accentStorageKey(scope), applied); } catch {}
  }
  return applied;
};

// The CSS custom properties for one theme id, ready to
// spread into a dashboard's own top-level `style` prop:
//   <div style={{ width: "100vw", height: "100vh", display: "flex",
//                 flexDirection: "column", overflow: "hidden",
//                 ...getAccentThemeVars(accentThemeId) }}>
// IMPORTANT: spread these onto the dashboard's real top-level layout box —
// NOT onto a separate `display: "contents"` wrapper around it. Custom-property
// inheritance through a `display: contents` element set via the `style`
// attribute is unreliable across browsers, so vars declared that way can
// silently fail to reach descendants and every ink/paper token then just
// falls back to its hardcoded default — the picker updates state, but
// nothing on screen visibly changes. Declaring the vars directly on a real,
// box-generating element (any element that actually renders, even one with
// no visual chrome of its own) inherits normally everywhere, modals included,
// as long as those modals render as descendants of that box rather than as
// siblings outside it.
export const getAccentThemeVars = (id) => {
  const theme = ACCENT_THEMES[id] || ACCENT_THEMES.default;
  return {
    "--ojt-ink": theme.ink,
    "--ojt-ink-deep": theme.inkDeep,
    "--ojt-ink-soft": theme.inkSoft,
    "--ojt-ink-gradient": theme.gradient,
    "--ojt-hover-wash": theme.hoverWash,
    "--ojt-hover-wash-strong": theme.hoverWashStrong,
    "--ojt-hover-border": theme.hoverBorder,
    "--ojt-badge": theme.badge,
  };
};

// One-time cleanup for browsers/tabs that ran an earlier version of this
// file, which used to write --ojt-ink/-deep/-soft straight onto
// document.documentElement (the <html> tag). That inline style survives
// a hot-reload of the JS bundle since it's a live DOM mutation, not
// something a code change alone can undo — so on a stale tab it could
// keep leaking a coordinator's/student's old color into every screen,
// Company included, until a hard refresh. This removes it unconditionally
// the moment the module loads, since the current implementation never
// writes to documentElement itself — only to each dashboard's own scoped
// wrapper — so anything found there can only be leftover.
if (typeof document !== "undefined") {
  const rootStyle = document.documentElement.style;
  rootStyle.removeProperty("--ojt-ink");
  rootStyle.removeProperty("--ojt-ink-deep");
  rootStyle.removeProperty("--ojt-ink-soft");
  rootStyle.removeProperty("--ojt-hover-wash");
  rootStyle.removeProperty("--ojt-hover-wash-strong");
  rootStyle.removeProperty("--ojt-hover-border");
  rootStyle.removeProperty("--ojt-badge");
}

export const font = {
  ui:   "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  logo: "'Monomaniac One', sans-serif", // wordmark only — never for UI text
};

export const type = {
  heading:   { fontSize: "2rem",      fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em" },
  subhead:   { fontSize: "0.9375rem", fontWeight: 400, lineHeight: 1.5 },
  label:     { fontSize: "0.875rem",  fontWeight: 500, lineHeight: 1.4 },
  body:      { fontSize: "0.9375rem", fontWeight: 400, lineHeight: 1.55 },
  control:   { fontSize: "0.9375rem", fontWeight: 500, lineHeight: 1.4 },
  helper:    { fontSize: "0.8125rem", fontWeight: 400, lineHeight: 1.45 },
};

export const space = { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", xxl: "48px" };

// Everything in the comps is a pill or a big soft rectangle.
export const radius = { field: "999px", pill: "999px", panel: "26px", card: "18px" };

export const shadow = {
  panel: "0 24px 64px rgba(10,10,10,0.44), 0 2px 6px rgba(10,10,10,0.20)",
  pill:  "0 5px 14px rgba(10,10,10,0.28)",
  input: "0 1px 2px rgba(32,30,31,0.06)",
  focus: "0 0 0 3px rgba(32,30,31,0.24)",
};

// ── Motion ───────────────────────────────────────────────────────────────────
// One decelerating curve. Ease-in-out accelerates before it slows, which is
// what reads as a snap; a pure ease-out starts fast and settles.
export const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
export const timing = {
  hold:    1100, // logo sits full-screen
  rise:     900, // logo travels up, hub controls fade in
  slide:    780, // hub shifts left, form panel slides in
};

// Geometry for the three stages.
export const stageGeom = {
  // Both halves are centred in their own 50% of the viewport: the hub's
  // centre moves from 50vw to 25vw, the panel's sits at ~75vw.
  hubShiftVw:   -27,  // how far left the hub column travels when a form opens
  hubMaxPx:     480,  // the controls column — pills need room to breathe
  formWidthVw:   44,
  formMaxPx:    600,
  formRightVw:  8,    // gap from the right edge; larger = panel sits further left

  // The controls sit in normal flow under the lockup, so during the splash the
  // whole column is pushed DOWN by roughly half the controls' height. That
  // lands the lockup on the true centre of the screen, and releasing it to 0
  // is what makes the mark travel upward as the controls fade in.
  splashLiftPx:       236,
  splashLiftMobilePx: 200,

  markSplashPx: 210,
  markHubPx:    176,
  markFormPx:   156,
  wordSplashRem: 4.4,
  wordHubRem:    3.5,
  wordFormRem:   3.1,
};

// ── Backgrounds ──────────────────────────────────────────────────────────────
// Radial pools over a linear base. Painted at viewport size so it never
// restretches while anything on top of it animates.
export const wineField = [
  "radial-gradient(120% 90% at 50% 0%, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0) 55%)",
  "radial-gradient(140% 100% at 15% 100%, #EDEDED 0%, rgba(237,237,237,0) 60%)",
  "linear-gradient(165deg, #FFFFFF 0%, #FAFAFA 35%, #F2F2F2 70%, #EAEAEA 100%)",
].join(", ");

// Diagonal capsules drifting across the field — the streaks in the comps.
// x/y are viewport percentages; w/h are px; o is opacity.
export const capsules = [

];
export const capsuleAngle = [];

export default {
  color, font, type, space, radius, shadow,
  ease, timing, stageGeom, wineField, capsules, capsuleAngle,
  ACCENT_THEMES, ACCENT_THEME_ORDER, getSavedAccentThemeId, saveAccentThemeId, getAccentThemeVars, getThemedAsset,
};