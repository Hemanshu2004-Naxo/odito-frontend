/**
 * A domain the user typed or pasted -> the clean form the backend and DataForSEO take: lowercase, no protocol, no "www.", no path /
 * query / port / trailing slash or dot. Returns null for anything that is not a public-looking domain name (IP addresses, localhost,
 * single labels, other protocols, credentials, spaces). Pure: nothing is fetched. The backend applies the same rule
 * (shared/targetDomain.js normalizeDomainInput) and is the one that enforces it.
 *
 *   " https://www.Example.com/path/ "  ->  "example.com"
 */

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

function isPublicDomainName(host) {
  if (!host || host.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  const labels = host.split(".")
  return !(host.length > 253 || labels.length < 2 || !labels.every((l) => LABEL.test(l)) || /^\d+$/.test(labels[labels.length - 1])
    || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal"))
}

/** @param {unknown} input @returns {string|null} */
export function normalizeDomain(input) {
  if (typeof input !== "string") return null
  const raw = input.trim()
  if (!raw || raw.length > 2000 || /\s/.test(raw)) return null
  let url
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null
  let host = url.hostname.toLowerCase().replace(/\.$/, "")
  if (host.startsWith("www.")) host = host.slice(4)
  return isPublicDomainName(host) ? host : null
}

/**
 * Pasted text with several domains (separated by commas, spaces or new lines) -> { valid: [clean, de-duplicated], invalid: [as typed] }.
 * Used by "Manage exclusions", where a user pastes a whole list at once.
 */
export function parseDomainList(text) {
  const valid = []
  const invalid = []
  const seen = new Set()
  for (const part of String(text ?? "").split(/[\s,;]+/)) {
    if (!part) continue
    const clean = normalizeDomain(part)
    if (!clean) invalid.push(part)
    else if (!seen.has(clean)) { seen.add(clean); valid.push(clean) }
  }
  return { valid, invalid }
}
