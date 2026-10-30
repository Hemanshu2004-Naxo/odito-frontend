import { ANCHOR_HEALTH } from "@/lib/anchors/anchorConfig"
import { TOXIC_SPAM_ABOVE } from "../referring-domains/constants"
import { formatMonthLabel } from "./format"

/**
 * The "Fix first" panel's rules. Thresholds that another page already owns are IMPORTED from that page's config (the high-spam cut-off from
 * the Referring Domains page, the exact-match share from the Anchors health checks); only what the dashboard alone decides lives here.
 */
export const DASHBOARD_ISSUES = Object.freeze({
  /** The panel shows at most this many issues. */
  maxIssues: 5,
  brokenBacklinks: Object.freeze({ criticalPercent: 20, warningPercent: 5 }),
  errorPages: Object.freeze({ criticalBacklinks: 50, criticalStatuses: Object.freeze([403]) }),
  /** share = high-spam domains ÷ referring domains. The spam score above which a domain counts is the Referring Domains page's own. */
  highSpam: Object.freeze({ criticalPercent: 30, warningPercent: 10, spamAbove: TOXIC_SPAM_ABOVE }),
  /** Latest month's organic traffic vs the month before, in percent (negative = a fall). */
  trafficDrop: Object.freeze({ criticalPercent: -40, warningPercent: -20 }),
  /** Exact-match anchors above this share of the anchor profile (the Anchors page's own threshold). */
  anchors: Object.freeze({ exactMaxPercent: ANCHOR_HEALTH.exactMaxPercent }),
  /** The backlink profile's overall spam score (0-100) at or above which it is "high" (shown only when the high-spam-domains rule is silent). */
  spamScore: Object.freeze({ highFrom: 31 }),
})

export const SEVERITY_RANK = Object.freeze({ critical: 3, warning: 2, info: 1 })

/** Where each issue's button goes. The Referring Domains tab names are that page's own (?tab=toxic is its "Toxic" tab, the high-spam domains). */
export const ISSUE_LINKS = Object.freeze({
  brokenBacklinks: "/app/backlinks/list?broken=true",
  errorPages: "/app/backlinks/top-pages?status=error",
  highSpam: "/app/referring-domains?tab=toxic",
  trafficDrop: "/app/traffic-history",
  keywordsLost: "/app/organic-keywords",
  anchors: "/app/backlinks/anchors",
})

/** The rules in the order that breaks ties (and that the spec lists them in). */
export const RULE_ORDER = Object.freeze(["brokenBacklinks", "errorPages", "highSpam", "trafficDrop", "keywordsLost", "anchors", "spamScore"])

const isNum = (v) => typeof v === "number" && Number.isFinite(v)
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
const n = (v) => fmt.format(Math.round(v))
const pct1 = (v) => `${(Math.round(v * 10) / 10).toFixed(1)}%`
const plural = (count, one, many) => (count === 1 ? one : many)

/** Each rule: ready value -> an issue or null. `impact` is how far past its WARNING threshold the figure is, so unlike units can be ranked. */
const RULES = {
  brokenBacklinks(v, c) {
    if (!isNum(v?.brokenBacklinks) || !isNum(v?.backlinks) || v.backlinks <= 0 || v.brokenBacklinks <= 0) return null
    const percent = (v.brokenBacklinks / v.backlinks) * 100
    const t = c.brokenBacklinks
    if (percent < t.warningPercent) return null
    return {
      severity: percent >= t.criticalPercent ? "critical" : "warning",
      title: `${pct1(percent)} of backlinks point to broken URLs (${n(v.brokenBacklinks)} ${plural(v.brokenBacklinks, "link", "links")})`,
      why: "Those links lead visitors and search engines to dead pages, so their value is lost.",
      cta: { label: "Fix broken links", href: ISSUE_LINKS.brokenBacklinks },
      impact: percent / t.warningPercent,
    }
  },

  errorPages(v, c) {
    if (!isNum(v?.count) || v.count <= 0) return null
    const top = v.top ?? null
    const t = c.errorPages
    const critical = Boolean(top) && ((isNum(top.backlinks) && top.backlinks >= t.criticalBacklinks) || t.criticalStatuses.includes(top.statusCode))
    const lead = top ? ` — top: ${top.path} (${top.statusCode}, ${n(top.backlinks ?? 0)} ${plural(top.backlinks, "link", "links")})` : ""
    return {
      severity: critical ? "critical" : "warning",
      title: `${n(v.count)} ${plural(v.count, "page with backlinks returns an error", "pages with backlinks return errors")}${lead}`,
      why: "Links that point to an error page pass no value. Redirect them to a live page.",
      cta: { label: "View error pages", href: ISSUE_LINKS.errorPages },
      impact: top && isNum(top.backlinks) ? Math.max(top.backlinks, 1) / t.criticalBacklinks : 1 / t.criticalBacklinks,
    }
  },

  highSpam(v, c) {
    if (!isNum(v?.count) || !isNum(v?.referringDomains) || v.referringDomains <= 0 || v.count <= 0) return null
    const percent = (v.count / v.referringDomains) * 100
    const t = c.highSpam
    if (percent < t.warningPercent) return null
    return {
      severity: percent >= t.criticalPercent ? "critical" : "warning",
      title: `${pct1(percent)} of referring domains have a high spam score (${n(v.count)})`,
      why: `Sites with a spam score above ${t.spamAbove} can hurt how search engines see your link profile.`,
      cta: { label: "Review domains", href: ISSUE_LINKS.highSpam },
      impact: percent / t.warningPercent,
    }
  },

  trafficDrop(v, c) {
    const latest = v?.latest
    const previous = v?.previous
    if (!isNum(latest?.etv) || !isNum(previous?.etv) || previous.etv <= 0) return null
    const percent = ((latest.etv - previous.etv) / previous.etv) * 100
    const t = c.trafficDrop
    if (percent > t.warningPercent) return null
    return {
      severity: percent <= t.criticalPercent ? "critical" : "warning",
      title: `Organic traffic fell ${pct1(Math.abs(percent))} vs ${formatMonthLabel(previous.year, previous.month)}`,
      why: "Fewer people are finding the site through Google than a month ago.",
      cta: { label: "View traffic history", href: ISSUE_LINKS.trafficDrop },
      impact: percent / t.warningPercent,
    }
  },

  keywordsLost(v) {
    if (!isNum(v?.lost) || !isNum(v?.new) || !(v.lost > v.new)) return null
    return {
      severity: "warning",
      title: `Lost ${n(v.lost)} ${plural(v.lost, "keyword", "keywords")}, gained ${n(v.new)}`,
      why: "More keywords stopped ranking than started, so the site is shrinking in search.",
      cta: { label: "View keywords", href: ISSUE_LINKS.keywordsLost },
      impact: v.lost / Math.max(v.new, 1),
    }
  },

  anchors(v, c) {
    if (!isNum(v?.exactPercent) || !(v.exactPercent > c.anchors.exactMaxPercent)) return null
    return {
      severity: "info",
      title: `Exact-match anchors are ${pct1(v.exactPercent)} of your anchor profile`,
      why: `Above ${c.anchors.exactMaxPercent}% can look manipulative. Mix in branded and natural anchors.`,
      cta: { label: "Review anchors", href: ISSUE_LINKS.anchors },
      impact: v.exactPercent / c.anchors.exactMaxPercent,
    }
  },

  spamScore(v, c) {
    if (!isNum(v?.score) || v.score < c.spamScore.highFrom) return null
    return {
      severity: "warning",
      title: `Your backlink spam score is high (${n(v.score)}/100)`,
      why: "A high overall spam score suggests many low-quality sites link to you.",
      cta: { label: "Review domains", href: ISSUE_LINKS.highSpam },
      impact: v.score / c.spamScore.highFrom,
    }
  },
}

/**
 * Turns the dashboard's data sources into the "Fix first" list. PURE: no React, no network.
 *
 * `sources` is `{ [rule]: { state: "ready" | "loading" | "error" | "skipped", value? } }` with the rule names of RULE_ORDER. A source that is
 *  - "ready" is judged by its rule;
 *  - "loading" is `pending` (the panel keeps its skeleton until none is);
 *  - "error" is `failed` (only that rule is missing; the panel says "Some checks couldn't load");
 *  - "skipped" or absent is silently left out (e.g. the anchor profile when it is not cached).
 *
 * The result is ranked by severity (critical > warning > info), then by impact (how far past the warning threshold), then by rule order,
 * and cut to `maxIssues`. The "spam score high" issue is dropped whenever the high-spam-domains rule fires (they say the same thing).
 *
 * @returns {{ issues: Array<{ id: string, rule: string, severity: string, title: string, why: string, cta: { label: string, href: string }, impact: number }>,
 *   pending: string[], failed: string[], total: number, checked: string[] }}
 */
export function buildDashboardIssues(sources = {}, configs = DASHBOARD_ISSUES) {
  const found = []
  const pending = []
  const failed = []
  const checked = []
  for (const rule of RULE_ORDER) {
    const source = sources?.[rule]
    if (!source || source.state === "skipped") continue
    if (source.state === "loading") { pending.push(rule); continue }
    if (source.state === "error") { failed.push(rule); continue }
    if (source.state !== "ready") continue
    checked.push(rule)
    const issue = RULES[rule](source.value, configs)
    if (issue) found.push({ id: rule, rule, ...issue })
  }
  const deduped = found.some((i) => i.rule === "highSpam") ? found.filter((i) => i.rule !== "spamScore") : found
  deduped.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.impact - a.impact || RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule))
  return { issues: deduped.slice(0, configs.maxIssues), pending, failed, total: deduped.length, checked }
}
