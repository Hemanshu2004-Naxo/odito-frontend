/**
 * Pure rules for showing the business relevance of a website (backend: modules/competitors, competitor-assessments).
 *
 * Relevance is a SECOND axis next to the SEO numbers: a site can overlap a lot in search and still not be a business competitor. The
 * badge never replaces the SEO data, and a filter only hides rows from view (it never excludes a domain from the provider's results).
 */

export const CLASS_META = {
  direct_competitor: { label: "Direct", long: "Direct competitor", variant: "critical", order: 0 },
  indirect_competitor: { label: "Indirect", long: "Indirect competitor", variant: "warning", order: 1 },
  informational_directory: { label: "Informational", long: "Informational / directory", variant: "outline", order: 2 },
  not_relevant: { label: "Not relevant", long: "Not relevant", variant: "secondary", order: 3 },
  needs_review: { label: "Needs review", long: "Needs review", variant: "outline", order: 4 },
}
export const CLASS_KEYS = Object.keys(CLASS_META)

/** Where a reason's evidence came from, in plain words. */
export const SOURCE_LABEL = {
  registry: "Odito's list of well-known sites",
  website: "Its website",
  project: "Your project",
  rules: "Odito's rules",
  seo: "Search data",
}

export const FILTERS = [{ key: "all", label: "All" }, ...CLASS_KEYS.map((k) => ({ key: k, label: CLASS_META[k].long }))]

/**
 * The badge for one domain: { state: "none" | "pending" | "assessed", label, variant, hint }.
 *  none = nothing is known and nothing is queued; pending = queued or being read; assessed = a class (the user's decision, when there is one).
 */
export function badgeFor(assessment) {
  if (!assessment) return { state: "none", label: "Not checked", variant: "secondary", hint: "Business relevance has not been checked for this website yet." }
  if (assessment.class) {
    const meta = CLASS_META[assessment.class]
    const prefix = assessment.overridden ? "Set by you. " : ""
    return { state: "assessed", label: meta.label, variant: meta.variant, hint: `${prefix}${meta.long}.` }
  }
  if (assessment.status === "pending" || assessment.status === "processing") return { state: "pending", label: "Checking…", variant: "secondary", hint: "Reading its website to judge whether it is a business competitor." }
  if (assessment.status === "failed") return { state: "none", label: "Not checked", variant: "secondary", hint: "The check could not be completed." }
  return { state: "none", label: "Not checked", variant: "secondary", hint: "Business relevance has not been checked for this website yet." }
}

/** Counts per effective class for the rows given, plus how many are still being checked or not checked. */
export function countByClass(domains, byDomain) {
  const counts = Object.fromEntries(CLASS_KEYS.map((k) => [k, 0]))
  let pending = 0; let unchecked = 0
  for (const d of domains) {
    const a = byDomain.get(d)
    if (a?.class) counts[a.class] += 1
    else if (a && (a.status === "pending" || a.status === "processing")) pending += 1
    else unchecked += 1
  }
  return { counts, pending, unchecked, total: domains.length }
}

/**
 * Filters the rows ALREADY LOADED on this page by relevance and by a domain search. It changes what is shown, nothing else: the server's
 * paging, sorting and totals are untouched, and no domain is excluded from the provider's results.
 */
export function applyFilters(rows, byDomain, { filter = "all", search = "" } = {}) {
  const q = String(search ?? "").trim().toLowerCase()
  return rows.filter((r) => {
    if (q && !String(r.domain ?? "").toLowerCase().includes(q)) return false
    if (filter === "all") return true
    return byDomain.get(r.domain)?.class === filter
  })
}

/** Domains the page should ask the server to check: never assessed (absent) or stale, and not already queued. */
export function domainsToRequest(domains, byDomain, alreadyAsked = new Set()) {
  return domains.filter((d) => {
    if (alreadyAsked.has(d)) return false
    const a = byDomain.get(d)
    if (!a) return true
    if (a.status === "pending" || a.status === "processing") return false
    return a.stale === true && !a.overridden
  })
}

const POLL_MS = 4000
const POLL_WINDOW_MS = 4 * 60 * 1000

/** Re-read while something is being checked, for at most four minutes (a worker that is switched off must not make the page poll forever). */
export function assessmentPollInterval(byDomain, startedAt, now = Date.now()) {
  if (now - startedAt > POLL_WINDOW_MS) return false
  for (const a of byDomain.values()) if (a.status === "pending" || a.status === "processing") return POLL_MS
  return false
}

/** One line for the filter bar, so a filter is never mistaken for a filter over all the discovered domains. */
export function scopeNote(pageCount, total) {
  return `Applies to the ${pageCount} competitor${pageCount === 1 ? "" : "s"} loaded on this page, not to all ${total === null ? "discovered" : total.toLocaleString("en-US")} domains.`
}
