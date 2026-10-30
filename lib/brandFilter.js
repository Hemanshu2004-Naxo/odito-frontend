/**
 * The Brand / Non-brand split of a keyword list, shared by the Domain Overview's "Top keywords" card and the Organic Keywords page (so a
 * "View all" link carries exactly the filter the card used). PURE.
 *
 *  - Non-brand ("non"): one  keyword NOT LIKE %term%  condition per brand term, joined with "and".
 *  - Brand ("only"):    the terms joined with "or" INSIDE ONE GROUP: [[kw like %a%], "or", [kw like %b%]] (a single term is a plain condition).
 *  - At most BRAND_TERM_LIMIT terms are used: the SHORTEST ones (they match the most keywords); ties go alphabetically so the choice — and
 *    so the cache key — never depends on the order the terms were saved in.
 *  - Terms are lower-cased (the provider's `like` is case-sensitive and stores keywords in lowercase), trimmed, stripped of "%" and control
 *    characters, capped at MAX_TERM_LENGTH, and de-duplicated.
 *  - Every term is one condition of the provider's 8: `brandConditionCount` says how many a mode takes, so a page can check its own total.
 */

export const KEYWORD_FIELD = "keyword_data.keyword"
export const BRAND_TERM_LIMIT = 6
export const MAX_TERM_LENGTH = 100
/** Conditions the provider accepts in one request. */
export const MAX_CONDITIONS = 8

/** "all" | "non" | "only" -> itself; anything else is "all". */
export const normalizeBrandMode = (v) => (v === "non" || v === "only" ? v : "all")

const cleanTerm = (raw) => String(raw ?? "").replace(/[%\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, MAX_TERM_LENGTH).trim()

/** The terms a brand filter would use: cleaned, de-duplicated, and — when there are more than BRAND_TERM_LIMIT — the shortest ones. */
export function pickBrandTerms(terms, limit = BRAND_TERM_LIMIT) {
  const unique = [...new Set((Array.isArray(terms) ? terms : []).map(cleanTerm).filter(Boolean))]
  unique.sort((a, b) => a.length - b.length || a.localeCompare(b))
  return unique.slice(0, limit)
}

/** True when this list is a group of "or" conditions (as opposed to a [field, op, value] triple). */
export const isOrGroup = (c) => Array.isArray(c) && Array.isArray(c[0])

/** How many of the provider's conditions a condition (or an "or" group) uses. */
export const conditionWeight = (c) => (isOrGroup(c) ? c.filter((_, i) => i % 2 === 0).length : 1)

/**
 * The conditions of a brand mode: [] for "all" or no terms; otherwise a list of conditions (for "only", ONE entry that may be an "or" group).
 * @param {string[]} terms the project's saved brand terms
 * @param {"all"|"non"|"only"} mode
 * @returns {Array}
 */
export function buildBrandConditions(terms, mode) {
  const picked = pickBrandTerms(terms);
  const m = normalizeBrandMode(mode)
  if (m === "all" || picked.length === 0) return []
  if (m === "non") return picked.map((t) => [KEYWORD_FIELD, "not_like", `%${t}%`])
  const likes = picked.map((t) => [KEYWORD_FIELD, "like", `%${t}%`])
  return [likes.length === 1 ? likes[0] : likes.flatMap((c, i) => (i === 0 ? [c] : ["or", c]))]
}

/** How many of the provider's 8 conditions a mode takes with these terms. */
export const brandConditionCount = (terms, mode) => buildBrandConditions(terms, mode).reduce((n, c) => n + conditionWeight(c), 0)

/**
 * The brand filter laid over an existing request's conditions, e.g. the dashboard's top-5 (no conditions): the result of joining them with
 * "and" as the provider expects. `filters` is null when there is nothing to send.
 * @param {Array} conditions the request's own conditions (triples)
 * @returns {{ conditions: Array, filters: Array|null, count: number, tooMany: boolean }}
 */
export function withBrandFilter(conditions, terms, mode) {
  const all = [...conditions, ...buildBrandConditions(terms, mode)]
  const count = all.reduce((n, c) => n + conditionWeight(c), 0)
  return { conditions: all, filters: count > MAX_CONDITIONS ? null : joinFilterConditions(all), count, tooMany: count > MAX_CONDITIONS }
}

/**
 * The `filters` value the backend takes: null for none; a lone triple as itself; a lone "or" group WRAPPED (`[group]`, so it is not mistaken
 * for a triple); several conditions joined with "and".
 */
export function joinFilterConditions(conditions) {
  if (!conditions.length) return null
  if (conditions.length === 1) return isOrGroup(conditions[0]) ? [conditions[0]] : conditions[0]
  return conditions.flatMap((c, i) => (i === 0 ? [c] : ["and", c]))
}

/** The default mode: Non-brand when the project saved brand terms, All otherwise. */
export const defaultBrandMode = (savedTerms) => (pickBrandTerms(savedTerms).length > 0 ? "non" : "all")
