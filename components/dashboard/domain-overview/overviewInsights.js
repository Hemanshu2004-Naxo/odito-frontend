import { ISSUE_LINKS, describePath } from "./dashboardIssues"
import { formatCompact, formatExact } from "./format"

/**
 * PURE sentences for the Domain Overview: the "In one line" banner, the note under the traffic chart, under the position bars, under
 * Top keywords and under Top pages. Every sentence is built only from figures the page already loaded; when a figure is missing the
 * sentence is null (the card shows nothing) rather than a guess.
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v)
const MINUS = "−"
const pct0 = (v) => `${Math.round(Math.abs(v))}%`
const pct1 = (v) => `${(Math.round(v * 10) / 10).toFixed(1)}%`
const plural = (n, one, many) => (n === 1 ? one : many)

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
/** "2026-09" -> "September"; with `withYear` -> "September 2026". */
export function monthName(key, withYear = false) {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "")
  if (!m) return null
  const name = MONTHS[Number(m[2]) - 1]
  return name ? (withYear ? `${name} ${m[1]}` : name) : null
}

/** Where each Fix-first button lands, named the way the sidebar names it. */
export const ISSUE_DESTINATIONS = Object.freeze({
  [ISSUE_LINKS.brokenBacklinks]: "Backlinks",
  [ISSUE_LINKS.errorPages]: "Top linked pages",
  [ISSUE_LINKS.highSpam]: "Linking sites",
  [ISSUE_LINKS.trafficDrop]: "Traffic",
  [ISSUE_LINKS.keywordsLost]: "All keywords",
  [ISSUE_LINKS.anchors]: "Anchors",
})
export const issueDestination = (href) => ISSUE_DESTINATIONS[href] ?? null

export { describePath }

// ── In one line ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The traffic half: "Google traffic is down 56% since September" (null when the month-over-month change is unknown). */
function trafficClause(kpis, trend) {
  const change = kpis?.trafficChange
  if (!change || !isNum(change.percent)) return null
  const newest = trend?.[trend.length - 1]
  const base = newest ? trend.find((p) => monthIndexOfKey(p.key) === monthIndexOfKey(newest.key) - 1) : null
  const since = base ? monthName(base.key) : null
  const when = since ? ` since ${since}` : " since last month"
  if (Math.abs(change.percent) < 5) return `Google traffic is steady${when}`
  return `Google traffic is ${change.percent < 0 ? "down" : "up"} ${pct0(change.percent)}${when}`
}

function monthIndexOfKey(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "")
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : NaN
}

/** The issue half, worded for the banner. `ctx.top` is the worst error page (from the Fix first source), when known. */
function issueClause(issue, ctx) {
  if (!issue) return null
  switch (issue.rule) {
    case "errorPages": {
      const top = ctx?.errorTop
      if (top?.path) {
        const links = isNum(top.backlinks) ? `, which has ${formatExact(top.backlinks)} ${plural(top.backlinks, "backlink", "backlinks")},` : ""
        return `your ${describePath(top.path)}${links} returns a ${top.statusCode ?? "error"} error. Unblocking it is the biggest single fix`
      }
      return `${issue.title.charAt(0).toLowerCase()}${issue.title.slice(1)}. Fixing them is the biggest single fix`
    }
    case "brokenBacklinks":
      return `${issue.title.charAt(0).toLowerCase()}${issue.title.slice(1)}. Redirecting those URLs is the biggest single fix`
    case "highSpam":
      return `${issue.title.charAt(0).toLowerCase()}${issue.title.slice(1)}. Reviewing them is the first thing to do`
    case "keywordsLost":
      return `you ${issue.title.charAt(0).toLowerCase()}${issue.title.slice(1)} this month`
    default:
      return `${issue.title.charAt(0).toLowerCase()}${issue.title.slice(1)}`
  }
}

/**
 * The banner: traffic direction + the top Fix-first issue (the traffic-drop issue is skipped, the traffic half already says it).
 * @returns {{ text: string, cta: { label: string, href: string }|null }|null}
 */
export function buildOneLine({ kpis, trend, issues, errorTop }) {
  const traffic = trafficClause(kpis, trend)
  const issue = (issues ?? []).find((i) => i.rule !== "trafficDrop") ?? null
  const about = issueClause(issue, { errorTop })
  if (!traffic && !about) return null
  let text
  if (traffic && about) text = `${traffic}, and ${about}.`
  else if (traffic) text = `${traffic}. No urgent problems were found.`
  else text = `${about.charAt(0).toUpperCase()}${about.slice(1)}.`
  const cta = issue ? { label: issue.rule === "errorPages" ? "See the error pages" : issue.cta.label, href: issue.cta.href } : null
  return { text, cta }
}

// ── Organic traffic chart ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * "Down from 1.7K to 548 visits a month. The biggest drop was January 2026 (−38%)." for the plotted metric (`etv` or `count`).
 * Compares the first and last known month of the series; the biggest drop is the worst month-over-month fall between consecutive months.
 */
export function describeTrend(trend, metric = "etv") {
  const pts = (trend ?? []).filter((p) => isNum(p[metric]))
  if (pts.length < 2) return null
  const unit = metric === "etv" ? "visits a month" : "ranking keywords"
  const first = pts[0][metric]
  const last = pts[pts.length - 1][metric]
  const dir = last < first ? "Down" : last > first ? "Up" : "Flat"
  const head = dir === "Flat" ? `Flat at ${formatCompact(last)} ${unit}.` : `${dir} from ${formatCompact(first)} to ${formatCompact(last)} ${unit}.`
  let worst = null
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1][metric]
    if (!(prev > 0) || monthIndexOfKey(pts[i].key) !== monthIndexOfKey(pts[i - 1].key) + 1) continue
    const change = ((pts[i][metric] - prev) / prev) * 100
    if (change < 0 && (!worst || change < worst.change)) worst = { key: pts[i].key, change }
  }
  const tail = worst && worst.change <= -5 ? ` The biggest drop was ${monthName(worst.key, true)} (${MINUS}${pct0(worst.change)}).` : ""
  return `${head}${tail}`
}

// ── Where your keywords rank ──────────────────────────────────────────────────────────────────────────────────────────

const BUCKET_RANGE = { top1: [1, 1], top3: [2, 3], top10: [4, 10], top20: [11, 20], top50: [21, 50], top100: [51, 100] }

/** "Only 7 keywords (6.9%) are on page 1. Most sit between positions 21 and 50, so small content fixes can move many of them up." */
export function describePositions(positions) {
  const top10 = positions?.top10
  if (!top10 || !isNum(top10.count)) return null
  const share = isNum(top10.percent) ? ` (${pct1(top10.percent)})` : ""
  const lead = top10.percent !== null && top10.percent < 25
    ? `Only ${formatExact(top10.count)} ${plural(top10.count, "keyword", "keywords")}${share} ${plural(top10.count, "is", "are")} on page 1.`
    : `${formatExact(top10.count)} ${plural(top10.count, "keyword", "keywords")}${share} ${plural(top10.count, "is", "are")} on page 1.`
  const known = (positions.buckets ?? []).filter((b) => isNum(b.value) && b.value > 0)
  if (!known.length) return lead
  const biggest = known.reduce((a, b) => (b.value > a.value ? b : a))
  const [lo, hi] = BUCKET_RANGE[biggest.key] ?? []
  if (!lo) return lead
  if (hi <= 10) return `${lead} Most of your keywords are already on page 1.`
  const where = lo === hi ? `at position ${lo}` : `between positions ${lo} and ${hi}`
  const advice = hi <= 50 ? ", so small content fixes can move many of them up" : ", so they need stronger pages to reach page 1"
  return `${lead} Most sit ${where}${advice}.`
}

/** "This month: net −5 keywords" (new minus lost). */
export function describeNetMonth(net) {
  if (!isNum(net)) return null
  const sign = net > 0 ? "+" : net < 0 ? MINUS : ""
  return `This month: net ${sign}${formatExact(Math.abs(net))} ${Math.abs(net) === 1 ? "keyword" : "keywords"}`
}

// ── Top keywords ──────────────────────────────────────────────────────────────────────────────────────────────────────

const matchesBrand = (keyword, terms) => (terms ?? []).some((t) => typeof t === "string" && t.trim() && keyword.toLowerCase().includes(t.trim().toLowerCase()))

/**
 * '"krishna eye care" and "sri krishna eye care" alone bring 285 of 354 visits (80%). Non-brand keywords are where growth is.'
 * The second sentence only when every keyword named matches a saved brand term.
 */
export function describeTopKeywords(rows, totalTraffic, brandTerms) {
  const top = (rows ?? []).filter((r) => isNum(r.traffic) && r.traffic > 0).slice(0, 2)
  if (!top.length || !isNum(totalTraffic) || totalTraffic <= 0) return null
  const sum = top.reduce((s, r) => s + r.traffic, 0)
  const share = Math.min(100, (sum / totalTraffic) * 100)
  if (share < 20) return null
  const names = top.map((r) => `"${r.keyword}"`).join(" and ")
  const verb = top.length === 1 ? "brings" : "alone bring"
  const head = `${names} ${verb} ${formatExact(sum)} of ${formatExact(totalTraffic)} visits (${pct0(share)}).`
  const allBrand = top.every((r) => matchesBrand(r.keyword, brandTerms))
  return allBrand ? `${head} Non-brand keywords are where growth is.` : head
}

// ── Top pages ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** "Your home page has 135 linking sites but returns 403, so that link value is wasted." */
export function describePinnedPage(rows) {
  const p = (rows ?? []).find((r) => r.pinned)
  if (!p) return null
  const sites = isNum(p.referringDomains) ? ` has ${formatExact(p.referringDomains)} linking ${plural(p.referringDomains, "site", "sites")} but` : ""
  const path = p.path ?? p.address
  return `Your ${describePath(path)}${sites} returns ${p.statusCode ?? "an error"}, so that link value is wasted.`
}
