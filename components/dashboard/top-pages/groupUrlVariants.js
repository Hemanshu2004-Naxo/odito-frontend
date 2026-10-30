/**
 * "Merge URL variants": the same page found as http / https / www / non-www / with or without a trailing slash is ONE page to a visitor, but the
 * provider counts each spelling on its own. This groups the rows ALREADY ON THE PAGE by their normalised URL (the server's `normalizedUrl`) into one
 * row per page: backlinks and referring domains are SUMMED (and marked approximate — a site that links to two variants is counted in both), the
 * status is the WORST in the group, and the variants stay available under it. Variants that are not on this page are not in the group.
 * PURE.
 */

/** How bad a status group is: the worst one decides the merged row's badge. */
const SEVERITY = Object.freeze({ error: 5, blocked: 4, unknown: 3, redirect: 2, ok: 1 })

const sum = (rows, key) => {
  const known = rows.filter((r) => r[key] !== null && r[key] !== undefined)
  return known.length ? known.reduce((s, r) => s + r[key], 0) : null
}

/** The variant with the worst status; of equal ones, the one with the most backlinks. */
const worst = (rows) => [...rows].sort((a, b) => (SEVERITY[b.statusGroup] ?? 0) - (SEVERITY[a.statusGroup] ?? 0) || (b.backlinks ?? 0) - (a.backlinks ?? 0))[0]

/** The dofollow share of the merged page: each variant's share weighted by its referring domains. null when none is known. */
function weightedDofollow(rows) {
  let weight = 0
  let total = 0
  for (const r of rows) {
    if (r.dofollowPct === null || !(r.referringDomains > 0)) continue
    weight += r.referringDomains
    total += r.dofollowPct * r.referringDomains
  }
  return weight > 0 ? total / weight : null
}

const earliest = (rows) => rows.filter((r) => r.firstSeen?.date).sort((a, b) => a.firstSeen.date - b.firstSeen.date)[0]?.firstSeen ?? rows[0].firstSeen

/**
 * @param {import("./types").PageRow[]} rows the rows of the current page
 * @returns {import("./types").PageRow[]} one row per page, in the order each page first appears; a page with ONE spelling is returned as it is
 */
export function groupUrlVariants(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = row.normalizedUrl || row.url
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.entries()].map(([key, members]) => {
    if (members.length === 1) return members[0]
    const bad = worst(members)
    const byBacklinks = [...members].sort((a, b) => (b.backlinks ?? 0) - (a.backlinks ?? 0))
    const main = byBacklinks[0]
    const flags = []
    for (const m of members) for (const f of m.flags) if (!flags.some((x) => x.id === f.id)) flags.push(f)
    return {
      ...main,
      id: `group:${key}`,
      // The merged row is told by its worst variant: its badge, its fix and its redirect target.
      statusCode: bad.statusCode,
      statusGroup: bad.statusGroup,
      statusLabel: bad.statusLabel,
      location: bad.location,
      locationLabel: bad.locationLabel,
      suggestedFix: members.find((m) => m.suggestedFix && m.statusGroup === bad.statusGroup)?.suggestedFix ?? bad.suggestedFix,
      referringDomains: sum(members, "referringDomains"),
      backlinks: sum(members, "backlinks"),
      brokenBacklinks: sum(members, "brokenBacklinks"),
      dofollowPct: weightedDofollow(members),
      rank: members.reduce((m, r) => (r.rank !== null && (m === null || r.rank > m) ? r.rank : m), null),
      // Every variant shares one normalised URL, so they share ONE traffic figure: it is not summed.
      traffic: members.find((m) => m.traffic !== null)?.traffic ?? null,
      keywords: members.find((m) => m.keywords !== null)?.keywords ?? null,
      flagIds: flags.map((f) => f.id),
      flags,
      firstSeen: earliest(members),
      variants: byBacklinks,
      variantCount: members.length,
      approx: true,
    }
  })
}
