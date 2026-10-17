// Per-image alt-text drafts, kept in memory for the life of the page (not in the panel, which unmounts when the person switches tab).
//
// Why it exists: the text a person typed or accepted for an image must survive a tab switch and re-opening the same image, and an AI
// suggestion must NEVER overwrite it. Each draft remembers whether the person has touched the text; only an untouched, empty draft is
// ever pre-filled, and only once per recommendation.
//
// Nothing here is sent anywhere and nothing is persisted: a draft is a convenience, the plan fingerprint and the explicit approval are
// what guard the write.

const drafts = new Map()

const key = (taskId, src) => `${taskId || ""}::${src || ""}`

export function getDraft(taskId, src) {
  return drafts.get(key(taskId, src)) || null
}

/** @param {{ text?: string, informative?: boolean, touched?: boolean, prefilledFrom?: string|null }} patch */
export function saveDraft(taskId, src, patch) {
  if (!taskId || !src) return null
  const next = { text: "", informative: false, touched: false, prefilledFrom: null, ...(drafts.get(key(taskId, src)) || {}), ...patch }
  drafts.set(key(taskId, src), next)
  return next
}

export function clearDraft(taskId, src) {
  drafts.delete(key(taskId, src))
}

/** Test helper. */
export function clearAllDrafts() {
  drafts.clear()
}

/**
 * Whether the recommendation text may be placed in the box now. Only when the person has not touched this image's text, the box is
 * empty, and this very recommendation has not already been placed (so clearing the box is respected).
 */
export function shouldPrefill(draft, recommendation, currentText) {
  if (!recommendation?.prefill || !recommendation.alt) return false
  if (draft?.touched) return false
  if ((currentText || "").trim() !== "") return false
  const marker = `${recommendation.recommendationId || ""}:${recommendation.alt}`
  return draft?.prefilledFrom !== marker
}

export const prefillMarker = (recommendation) => `${recommendation?.recommendationId || ""}:${recommendation?.alt || ""}`
