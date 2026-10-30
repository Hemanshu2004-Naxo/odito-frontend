import { BRAND_SPLIT_WORDS, IMPORT_KEYWORDS } from "./anchorConfig"
import { normalizeDomain, normalizeText } from "./classifyAnchor"

/**
 * Helpers for the "Anchor settings" modal. PURE.
 *  - suggestBrandTerms: the starting brand terms for a project that has not saved any, taken from its domain.
 *  - pickImportKeywords: which organic keywords to offer as target keywords.
 */

const BY_LENGTH = [...BRAND_SPLIT_WORDS].sort((a, b) => b.length - a.length)

/** "asgeyehospital" -> ["asg", "eye", "hospital"]: known words peeled off the end, the rest is the first word. One piece when nothing splits. */
function splitBrand(label) {
  const parts = []
  let rest = label
  for (let guard = 0; guard < 6; guard += 1) {
    const word = BY_LENGTH.find((w) => rest.length > w.length && rest.endsWith(w))
    if (!word) break
    parts.unshift(word)
    rest = rest.slice(0, -word.length)
  }
  return rest ? [rest, ...parts] : parts
}

/**
 * Brand terms suggested from a domain. "asgeyehospital.com" -> ["asg", "asg eye hospital", "asgeyehospital"]; "krishna-eye-centre.in" ->
 * ["krishna", "krishna eye centre", "krishnaeyecentre"]. The user edits them: this is only a start.
 * @param {string} domain with or without protocol / www / path
 */
export function suggestBrandTerms(domain) {
  const host = normalizeDomain(domain)
  const label = host.split(".")[0]
  if (!label) return []
  const hyphenated = label.split("-").filter(Boolean)
  const joined = hyphenated.join("")
  const pieces = hyphenated.length > 1 ? hyphenated : splitBrand(joined)
  const terms = []
  if (pieces.length > 1) {
    if (pieces[0].length >= 3) terms.push(pieces[0])
    terms.push(pieces.join(" "))
  }
  terms.push(joined)
  return [...new Set(terms)]
}

/**
 * Target-keyword candidates from organic keywords: the best by traffic that do not contain a brand term (a branded keyword is not a "money"
 * keyword), without repeats.
 * @param {Array<{ keyword: string, traffic: number|null }>} rows
 * @param {string[]} brandTerms
 * @param {number} [limit]
 */
export function pickImportKeywords(rows, brandTerms, limit = IMPORT_KEYWORDS.offer) {
  const brand = (brandTerms ?? []).map(normalizeText).filter(Boolean)
  const seen = new Set()
  const out = []
  const sorted = [...(rows ?? [])].filter((r) => typeof r?.keyword === "string").sort((a, b) => (b.traffic ?? -1) - (a.traffic ?? -1))
  for (const row of sorted) {
    const keyword = normalizeText(row.keyword)
    if (!keyword || seen.has(keyword) || brand.some((t) => keyword.includes(t))) continue
    seen.add(keyword)
    out.push({ keyword, traffic: row.traffic ?? null })
    if (out.length >= limit) break
  }
  return out
}
