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
  blush50:  "#000000",
  blush100: "#161616",  // panel background
  blush200: "#1F1F1F",
  blush300: "#333333",  // hairlines/borders

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
  hubMaxPx:     420,  // the controls column — pills need room to breathe
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
};