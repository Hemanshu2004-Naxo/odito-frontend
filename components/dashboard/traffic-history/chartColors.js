/**
 * Fixed colours for the Traffic History charts. Series that follow the page's one accent use `currentColor` (the chart wrapper sets
 * `text-primary`); the few that need their own hue live here, readable on both the light and the dark surface. Values are never
 * written in these colours — labels and numbers use text tokens — and every series is also named in a legend or tooltip.
 */

export const KEYWORDS_COLOR = "#8b5cf6" // violet-500: the second series next to traffic
export const PAID_COLOR = "#f59e0b" // amber-500: paid traffic
export const DROP_COLOR = "#dc2626" // red-600: the marked drop

/** Movement: greens above zero, reds below it; the darker of each pair is the "stronger" event (a new keyword / a decline). */
export const MOVEMENT_COLORS = Object.freeze({
  new: "#15803d", // green-700
  up: "#4ade80", // green-400
  down: "#b91c1c", // red-700
  lost: "#f87171", // red-400
})

/**
 * Ranking distribution: ONE hue, light -> dark = #51–100 -> #1. Drawn as the page accent with falling opacity, so it follows the theme
 * and reads as a magnitude ramp (not six unrelated colours).
 */
export const BUCKET_OPACITY = Object.freeze({ top1: 1, top3: 0.8, top10: 0.62, top20: 0.46, top50: 0.32, top100: 0.18 })

/** Competitors page: the competitor next to "You" (the page accent), and the extra traffic types of the Compare chart. */
export const THEM_COLOR = "#64748b" // slate-500: readable on both surfaces, deliberately not a signal colour
export const LOCAL_PACK_COLOR = "#8b5cf6" // violet-500 (organic is the cyan page accent: the hues must stay apart)
export const SNIPPET_COLOR = "#ec4899" // pink-500
