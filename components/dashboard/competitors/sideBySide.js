import { formatCompact, formatExact } from "../domain-overview/format"
import { compareToYou, sortByLead } from "./compareToYou"

/**
 * PURE rules for the redesigned SEO competitors view: the "Side by side" grid (you + every competitor you added, one row per metric), the
 * four stat cards above it, and the "Head to head on your keywords" table built from the saved shared-keyword lists. No I/O. A figure that
 * is not known is null and is never compared, ranked or counted as a win.
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v)

/** Rows of the grid, grouped as the page shows them. For every metric MORE is better. */
export const GRID_GROUPS = Object.freeze([
  { key: "traffic", label: "Traffic & visibility", rows: [
    { key: "organicTraffic", label: "Organic traffic", hint: "Visits a month from Google" },
    { key: "rankingKeywords", label: "Ranking keywords", hint: "Keywords in the top 100" },
    { key: "pos1", label: "#1 positions", hint: "Keywords where they rank first" },
  ] },
  { key: "authority", label: "Authority", rows: [
    { key: "referringDomains", label: "Linking sites", hint: "Different websites linking in" },
  ] },
])
export const GRID_ROWS = GRID_GROUPS.flatMap((g) => g.rows)

/** "170×" / "3.7×" / "5.0×": one decimal under 10, whole above. */
export function formatTimes(ratio) {
  if (!isNum(ratio)) return null
  return ratio >= 10 ? `${Math.round(ratio)}×` : `${ratio.toFixed(1)}×`
}

/** The caption under a competitor's figure, relative to yours: "170× yours", "3.2× less than you", "+5 more than you", "They have 0". */
export function relativeCaption(you, them) {
  if (!isNum(them)) return "Not known yet"
  if (!isNum(you)) return "Yours is not known"
  if (them === you) return "Same as you"
  if (them === 0) return "They have 0"
  if (you === 0) return "You have 0"
  if (them > you) {
    const r = them / you
    return r < 1.5 ? `+${formatExact(them - you)} more than you` : `${formatTimes(r)} yours`
  }
  const r = you / them
  return r < 1.5 ? `${formatExact(you - them)} fewer than you` : `${formatTimes(r)} less than you`
}

/**
 * The grid. `own` = your metrics; `competitors` = the ones you added that have a website. Sites are you first, then the competitors that
 * lead you furthest. Each cell: { value, share (0-100 of the row's biggest), best, caption }. Each site: wins (rows where it is best) and,
 * for a competitor, how many rows it beats you on.
 */
export function buildSideBySide(own, competitors) {
  const ranked = sortByLead(
    (competitors ?? []).filter((c) => c.domain).map((c) => ({ c, result: compareToYou(own, c.enrichment?.metrics ?? {}) })),
    (r) => r.result,
  )
  const sites = [
    { id: "you", isYou: true, name: "You", domain: null, metrics: own ?? {}, result: null, competitor: null },
    ...ranked.map(({ c, result }) => ({ id: c.id, isYou: false, name: c.name || c.domain, domain: c.domain, metrics: c.enrichment?.metrics ?? {}, result, competitor: c })),
  ]
  const rows = GRID_ROWS.map((row) => {
    const values = sites.map((s) => (isNum(s.metrics[row.key]) ? s.metrics[row.key] : null))
    const max = Math.max(0, ...values.filter(isNum))
    const you = values[0]
    return {
      ...row,
      cells: sites.map((s, i) => ({
        siteId: s.id,
        value: values[i],
        share: isNum(values[i]) && max > 0 ? (values[i] / max) * 100 : 0,
        best: isNum(values[i]) && values[i] > 0 && values[i] === max,
        caption: s.isYou ? "Your number" : relativeCaption(you, values[i]),
      })),
    }
  })
  for (const s of sites) {
    s.wins = rows.filter((r) => r.cells.find((c) => c.siteId === s.id).best).length
    s.winsByRow = rows.map((r) => r.cells.find((c) => c.siteId === s.id).best)
    s.beatsYou = s.isYou ? null : rows.filter((r) => { const you = r.cells[0].value; const them = r.cells.find((c) => c.siteId === s.id).value; return isNum(you) && isNum(them) && them > you }).length
  }
  return { sites, rows, rowCount: rows.length }
}

/** The four stat cards: how many you track, who is ahead, who is behind, and the smallest traffic gap to the next site ahead. */
export function buildStats(sites) {
  const comps = (sites ?? []).filter((s) => !s.isYou)
  const ahead = comps.filter((s) => s.result?.verdict === "ahead")
  const behind = comps.filter((s) => s.result?.verdict === "behind")
  const you = sites?.[0]?.metrics?.organicTraffic
  const gaps = ahead
    .map((s) => ({ s, gap: isNum(you) && isNum(s.metrics.organicTraffic) ? s.metrics.organicTraffic - you : null }))
    .filter((g) => isNum(g.gap) && g.gap > 0)
    .sort((a, b) => a.gap - b.gap)
  return {
    tracked: comps.length,
    ahead: { count: ahead.length, names: ahead.map((s) => shortName(s.name)) },
    behind: { count: behind.length, names: behind.map((s) => shortName(s.name)) },
    closest: gaps[0] ? { gap: gaps[0].gap, name: shortName(gaps[0].s.name) } : null,
  }
}

/** "Gleneagles Hospital" -> "Gleneagles"; "K. B. Haji Bachooali Eye & ENT" -> "K. B. Haji Bachooali". Drops the generic last words. */
const GENERIC = /\b(hospitals?|clinics?|centre|center|eye|ent|and|information|technologies|pvt|ltd|limited|private|the)\b/gi
export function shortName(name) {
  if (typeof name !== "string" || !name.trim()) return ""
  const cut = name.replace(GENERIC, " ").replace(/&/g, " ").replace(/\s+/g, " ").trim()
  return cut || name.trim()
}

/** "+946" with the thousands compact once it is large. */
export const formatGap = (gap) => (isNum(gap) ? `+${gap >= 10000 ? formatCompact(gap) : formatExact(gap)}` : null)

// ── Head to head ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The head-to-head table from the saved shared-keyword lists (one per competitor; each lists keywords you AND that competitor both rank
 * for, with both positions). Keywords shared with the most competitors come first, then by searches; `limit` rows. A competitor without the
 * keyword in its list is null ("–": not among the keywords you both rank for). `wins` counts the keywords where a site has the best
 * (lowest) position among the known ones; ties count for each.
 *
 * @param {Array<{ siteId: string, keywords: Array<{ keyword: string, searchVolume?: number|null, project?: { position?: number|null }, competitor?: { position?: number|null } }> }>} lists
 */
export function buildHeadToHead(lists, siteIds, limit = 8) {
  const byKeyword = new Map()
  for (const list of lists ?? []) {
    for (const k of list.keywords ?? []) {
      if (!k?.keyword) continue
      const e = byKeyword.get(k.keyword) ?? { keyword: k.keyword, volume: null, you: null, them: {} }
      if (isNum(k.searchVolume)) e.volume = Math.max(e.volume ?? 0, k.searchVolume)
      if (e.you === null && isNum(k.project?.position)) e.you = k.project.position
      if (isNum(k.competitor?.position)) e.them[list.siteId] = k.competitor.position
      byKeyword.set(k.keyword, e)
    }
  }
  const entries = [...byKeyword.values()].filter((e) => isNum(e.you))
  entries.sort((a, b) => Object.keys(b.them).length - Object.keys(a.them).length || (b.volume ?? -1) - (a.volume ?? -1) || a.you - b.you)
  const rows = entries.slice(0, limit).sort((a, b) => a.you - b.you).map((e) => {
    const positions = { you: e.you, ...Object.fromEntries((siteIds ?? []).map((id) => [id, e.them[id] ?? null])) }
    const best = Math.min(...Object.values(positions).filter(isNum))
    return {
      keyword: e.keyword,
      volume: e.volume,
      cells: ["you", ...(siteIds ?? [])].map((id) => ({ siteId: id, position: positions[id], best: isNum(positions[id]) && positions[id] === best, note: id === "you" ? null : positionNote(e.you, positions[id]) })),
    }
  })
  const wins = Object.fromEntries(["you", ...(siteIds ?? [])].map((id) => [id, rows.filter((r) => r.cells.find((c) => c.siteId === id).best).length]))
  return { rows, wins }
}

/** "3 above you" / "8 below you" / "Same as you" (a lower position number is higher in Google). */
export function positionNote(you, them) {
  if (!isNum(you) || !isNum(them)) return null
  if (them === you) return "Same as you"
  return them < you ? `${you - them} above you` : `${them - you} below you`
}
