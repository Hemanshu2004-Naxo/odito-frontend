import { normalizeDomain } from "@/lib/normalizeDomain"

/**
 * Backend bulk-traffic response -> one row per REQUESTED target, in the requested order. The provider answers in a different order
 * from the request, so rows are matched by `target`, never by index. A target the provider did not answer for (or answered with a
 * metric set to null) gets null for what is missing — shown as "—", never 0. A target with ALL zeros is the provider's way of saying
 * "no data for this domain" (live-checked): it is flagged `noData`.
 *
 * @param {{ result?: { items?: Array<{ target: string, organic: any, paid: any, featured_snippet: any, local_pack: any }> } }|null|undefined} response
 * @param {string[]} requestedTargets  the project first, then the tracked competitors
 * @returns {import("./types").ComparisonRow[]}
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)

export function mapBulkTraffic(response, requestedTargets) {
  const byTarget = new Map()
  for (const item of response?.result?.items ?? []) {
    const key = normalizeDomain(item?.target) ?? String(item?.target ?? "").toLowerCase()
    if (key && !byTarget.has(key)) byTarget.set(key, item)
  }
  const seen = new Set()
  const rows = []
  ;(requestedTargets ?? []).forEach((target, index) => {
    const domain = normalizeDomain(target) ?? String(target ?? "").toLowerCase()
    if (!domain || seen.has(domain)) return
    seen.add(domain)
    const item = byTarget.get(domain) ?? null
    const organic = item?.organic ?? null
    const everything = [item?.organic, item?.paid, item?.featured_snippet, item?.local_pack]
    rows.push({
      domain,
      isProject: index === 0,
      found: Boolean(item),
      noData: Boolean(item) && everything.every((m) => !m || (m.etv === 0 && m.count === 0)) && organic !== null,
      organicTraffic: num(organic?.etv),
      organicKeywords: num(organic?.count),
      localPackTraffic: num(item?.local_pack?.etv),
      featuredSnippetTraffic: num(item?.featured_snippet?.etv),
      paidTraffic: num(item?.paid?.etv),
      paidKeywords: num(item?.paid?.count),
    })
  })
  return rows
}

/** Sort the comparison table by a column; the project's row always stays at the top. Nulls sort last either way. */
export function sortComparison(rows, key, dir) {
  const project = rows.filter((r) => r.isProject)
  const rest = rows.filter((r) => !r.isProject)
  const sign = dir === "asc" ? 1 : -1
  rest.sort((a, b) => {
    const av = key === "domain" ? a.domain : a[key]
    const bv = key === "domain" ? b.domain : b[key]
    const aNull = av === null || av === undefined
    const bNull = bv === null || bv === undefined
    if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1
    return typeof av === "string" ? sign * av.localeCompare(bv) : sign * (av - bv)
  })
  return [...project, ...rest]
}
