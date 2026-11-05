import { formatCompact, formatExact } from "../domain-overview/format"
import { FOOTER_KEY, LINKS, PROFILE_HEALTH } from "./constants"

/**
 * PURE rules for the redesigned Backlink overview: the "Fix these first" cards and the "Already good" ticks (both from the profile-health
 * checks and the same summary), the dofollow / nofollow bars, and the "Where your links come from" views. Built only from the mapped summary
 * (mapBacklinkSummary); an unknown figure leaves its card or tick out instead of guessing.
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v)
const pct1 = (v) => `${(Math.round(v * 10) / 10).toFixed(1)}%`

export const TOXIC_HREF = "/app/referring-domains?tab=toxic"

/**
 * The fix cards, worst first (problems before warnings, then by size), at most `limit`; and the checks that passed, as short sentences.
 * @returns {{ fixes: Array<{ id: string, level: "problem"|"warning", title: string, body: string, cta: { label: string, href: string } }>, good: Array<{ id: string, text: string }> }}
 */
export function buildFixList(s, limit = 3) {
  if (!s) return { fixes: [], good: [] }
  const t = s.totals
  const d = s.derived
  const fixes = []
  const good = []

  if (isNum(t.brokenBacklinks) && t.brokenBacklinks > 0) {
    fixes.push({
      id: "broken-backlinks", level: "problem", weight: 3 + (d.brokenBacklinksPercent ?? 0) / 100,
      title: `${formatExact(t.brokenBacklinks)} backlink${t.brokenBacklinks === 1 ? " points" : "s point"} to broken pages`,
      body: `${isNum(d.brokenBacklinksPercent) ? `That is ${pct1(d.brokenBacklinksPercent)} of your links. ` : ""}They land on pages that return errors, so they pass no value. Fixing or redirecting those pages wins them back.`,
      cta: { label: "See broken pages", href: LINKS.brokenBacklinks },
    })
  } else if (t.brokenBacklinks === 0) good.push({ id: "broken-backlinks", text: "No backlinks point to broken pages" })

  if (isNum(t.brokenPages) && t.brokenPages > 0) {
    fixes.push({
      id: "broken-pages", level: "problem", weight: 3,
      title: `${formatExact(t.brokenPages)} linked page${t.brokenPages === 1 ? " returns" : "s return"} errors`,
      body: "Pages on your site that other sites link to, but that no longer load. Add 301 redirects to the matching live pages.",
      cta: { label: "Get redirect plan", href: LINKS.brokenPages },
    })
  } else if (t.brokenPages === 0) good.push({ id: "broken-pages", text: "Every linked page loads" })

  const band = s.spam?.band?.key
  if (band === "high" || band === "medium") {
    fixes.push({
      id: "spam", level: band === "high" ? "problem" : "warning", weight: band === "high" ? 3.5 : 2 + s.spam.score / 100,
      title: `Spam score ${s.spam.score}/100 from low-quality sites`,
      body: "Some of the sites linking to you look spammy. Review the ones with a high spam score and add the bad ones to a disavow file.",
      cta: { label: "Review toxic sites", href: TOXIC_HREF },
    })
  } else if (band === "low") good.push({ id: "spam", text: `Low spam score (${s.spam.score}/100)` })

  const df = d.dofollowDomainsPercent
  if (isNum(df)) {
    if (df < PROFILE_HEALTH.dofollowMinPercent) {
      fixes.push({
        id: "dofollow", level: "warning", weight: 2 + (PROFILE_HEALTH.dofollowMinPercent - df) / 100,
        title: `Only ${pct1(df)} of linking sites give dofollow links`,
        body: "Nofollow links pass no ranking credit. Aim new outreach at sites that link without nofollow.",
        cta: { label: "See linking sites", href: LINKS.referringDomains },
      })
    } else good.push({ id: "dofollow", text: `${pct1(df)} of sites give dofollow links` })
  }

  const sub = d.subnetDiversity
  if (isNum(sub)) {
    if (sub < PROFILE_HEALTH.subnetDiversityMinPercent) {
      fixes.push({
        id: "subnets", level: "warning", weight: 2,
        title: "Many links come from the same networks",
        body: `Only ${pct1(sub)} network diversity. Links from many unrelated sites look more natural than many from one network.`,
        cta: { label: "See linking sites", href: LINKS.referringDomains },
      })
    } else good.push({ id: "subnets", text: `Links come from many networks (${pct1(sub)})` })
  }

  const loc = s.breakdowns?.semanticLocations
  if (loc && !loc.isEmpty) {
    const footer = loc.entries.find((e) => e.key === FOOTER_KEY)?.percent ?? 0
    if (footer > PROFILE_HEALTH.footerMaxPercent) {
      fixes.push({
        id: "footer", level: "warning", weight: 2,
        title: `${pct1(footer)} of links sit in footers`,
        body: "Footer and sitewide links carry little weight. Links inside article content count for more.",
        cta: { label: "See backlinks", href: "/app/backlinks/list" },
      })
    } else good.push({ id: "footer", text: footer === 0 ? "No footer links (0.0%)" : `Few footer links (${pct1(footer)})` })
  }

  fixes.sort((a, b) => b.weight - a.weight)
  return { fixes: fixes.slice(0, limit).map(({ weight, ...f }) => f), good }
}

/** The two dofollow / nofollow bars: linking sites and linking pages. A row with an unknown total is left out. */
export function buildFollowRows(s) {
  if (!s) return []
  const rows = [
    { id: "sites", label: "Linking sites", dofollow: s.derived.dofollowDomains, nofollow: s.derived.nofollowDomains, percent: s.derived.dofollowDomainsPercent },
    { id: "pages", label: "Linking pages", dofollow: s.derived.dofollowPages, nofollow: s.derived.nofollowPages, percent: s.derived.dofollowPagesPercent },
  ]
  return rows.filter((r) => isNum(r.dofollow) && isNum(r.nofollow) && isNum(r.percent))
}

/** The views of "Where your links come from": which breakdown each tab shows and what its sentence says. */
export const SOURCE_VIEWS = Object.freeze([
  { key: "countries", label: "Countries", caption: "Where linking pages are hosted (links with a known country)" },
  { key: "tlds", label: "Domain endings", caption: "The domain endings of the linking sites" },
  { key: "platformTypes", label: "Site types", caption: "What kind of site links to you", multi: true },
  { key: "semanticLocations", label: "Placement", caption: "Where on the page the link sits" },
  { key: "attributes", label: "Attributes", caption: "How the links are marked up", multi: true },
  { key: "linkTypes", label: "Text vs image", caption: "Text links, image links and redirects" },
])

/** Segment colours, in order; "Others" and unknowns are grey. */
export const SOURCE_PALETTE = Object.freeze(["#0d1a3a", "#4f5bd5", "#22b8cf", "#2fd18b", "#f59e0b", "#a78bfa", "#ec4899", "#14b8a6", "#f97316", "#64748b"])
const GREY = "#cbd5e1"

/**
 * One view's rows: { key, label, count, percent, color, width } where `width` is the segment's share of the 100% bar. For a multi-valued
 * breakdown (a link can have several attributes / site types) the shares add up to more than 100%, so the bar is drawn from the counts and
 * the note says so. `note` is the sentence under the bar (the unknown-country share, the multi-valued caveat).
 */
export function buildSourceView(s, key) {
  const view = SOURCE_VIEWS.find((v) => v.key === key) ?? SOURCE_VIEWS[0]
  const b = s?.breakdowns?.[view.key]
  if (!b || b.isEmpty) return { view, rows: [], note: null }
  const listed = b.entries.reduce((sum, e) => sum + (e.count ?? 0), 0)
  let i = 0
  const rows = b.entries.map((e) => {
    const grey = e.isOthers || e.key === "" || String(e.key).toLowerCase() === "unknown"
    const color = grey ? GREY : SOURCE_PALETTE[i++ % SOURCE_PALETTE.length]
    return { key: e.key, label: e.label, flag: e.flag ?? null, description: e.description ?? null, count: e.count, percent: e.percent, color, width: listed > 0 ? (e.count / listed) * 100 : 0 }
  })
  let note = null
  if (view.key === "countries" && b.unknown && isNum(b.unknown.percent)) note = `Country is unknown for ${pct1(b.unknown.percent)} of links. The shares are of the links with a known country.`
  else if (view.multi) note = `A link can have several ${view.key === "attributes" ? "attributes" : "site types"}, so the shares add up to more than 100%.`
  return { view, rows, note }
}

/** "10.7 per linking site" etc. — the tile captions. */
export const perSite = (v) => (isNum(v) ? `${v.toFixed(1)} per linking site` : null)
export const mainAndIps = (main, ips) => [isNum(main) ? `${formatCompact(main)} main domains` : null, isNum(ips) ? `${formatCompact(ips)} IPs` : null].filter(Boolean).join(" · ") || null
