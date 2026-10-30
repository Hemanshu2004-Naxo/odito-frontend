import { GENERIC_ANCHORS } from "./anchorConfig"

/**
 * classifyAnchor: sorts one anchor text into a type. PURE (no network, no state) and the only place the rules live.
 * Normalise first (lowercase, trim, collapse spaces), then return the FIRST type that matches:
 *   1 empty      null / "" (or only spaces)
 *   2 naked_url  contains the target domain, or starts with http:// https:// www.
 *   3 branded    contains any brand term
 *   4 exact      equals a target keyword
 *   5 partial    contains a target keyword, or contains all the words of one
 *   6 generic    is one of GENERIC_ANCHORS ("click here", "read more" …)
 *   7 other
 * The order matters: "ASG Eye Hospital lasik surgery" is Branded (not Partial) and "asgeyehospital.com lasik" is a Naked URL.
 */

/** @param {unknown} value lowercase, trimmed, inner whitespace (spaces, tabs, non-breaking spaces) collapsed to one space. */
export const normalizeText = (value) => (typeof value === "string" ? value.toLowerCase().replace(/\s+/g, " ").trim() : "")

/** "https://www.Example.com/path" -> "example.com". "" for anything that is not text. */
export function normalizeDomain(value) {
  return normalizeText(value).replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0]
}

const WORD = /[^\p{L}\p{N}]+/u
const words = (text) => text.split(WORD).filter(Boolean)
const trimPunctuation = (text) => text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")

const GENERIC = new Set(GENERIC_ANCHORS.map(normalizeText))

/** A term list -> normalised, non-blank, unique. */
const cleanTerms = (list) => [...new Set((Array.isArray(list) ? list : []).map(normalizeText).filter(Boolean))]

/**
 * Prepares the settings once, so a profile of 1,000 anchors does not re-normalise them 1,000 times.
 * @param {{ brandTerms?: string[], targetKeywords?: string[] }} settings
 * @param {string} targetDomain the project's domain (with or without protocol / www)
 * @returns {(anchor: string|null|undefined) => "empty"|"naked_url"|"branded"|"exact"|"partial"|"generic"|"other"}
 */
export function createClassifier(settings, targetDomain) {
  const brandTerms = cleanTerms(settings?.brandTerms)
  const keywords = cleanTerms(settings?.targetKeywords).map((text) => ({ text, words: words(text) }))
  const domain = normalizeDomain(targetDomain)

  return function classify(anchor) {
    const text = normalizeText(anchor)
    if (!text) return "empty"
    if ((domain && text.includes(domain)) || /^(https?:\/\/|www\.)/.test(text)) return "naked_url"
    if (brandTerms.some((term) => text.includes(term))) return "branded"
    if (keywords.some((k) => k.text === text)) return "exact"
    if (keywords.length) {
      const anchorWords = new Set(words(text))
      if (keywords.some((k) => text.includes(k.text) || (k.words.length > 0 && k.words.every((w) => anchorWords.has(w))))) return "partial"
    }
    if (GENERIC.has(trimPunctuation(text))) return "generic"
    return "other"
  }
}

/** One-off form of createClassifier (tests, single rows). Use createClassifier for many anchors. */
export const classifyAnchor = (anchor, settings, targetDomain) => createClassifier(settings, targetDomain)(anchor)
