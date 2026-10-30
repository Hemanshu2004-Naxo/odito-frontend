import { describe, expect, test } from "vitest"
import { ANCHOR_HEALTH } from "@/lib/anchors/anchorConfig"
import { TOXIC_SPAM_ABOVE } from "../referring-domains/constants"
import { DASHBOARD_ISSUES, ISSUE_LINKS, RULE_ORDER, buildDashboardIssues } from "./dashboardIssues"

const ready = (value) => ({ state: "ready", value })
const one = (rule, value) => buildDashboardIssues({ [rule]: ready(value) }).issues[0] ?? null
const sev = (rule, value) => one(rule, value)?.severity ?? null

describe("thresholds come from the pages that own them", () => {
  test("the high-spam cut-off is the Referring Domains page's, the exact-match share is the Anchors health check's", () => {
    expect(DASHBOARD_ISSUES.highSpam.spamAbove).toBe(TOXIC_SPAM_ABOVE)
    expect(DASHBOARD_ISSUES.anchors.exactMaxPercent).toBe(ANCHOR_HEALTH.exactMaxPercent)
  })
  test("a changed config is obeyed (nothing is hard-coded in the rules)", () => {
    const loose = { ...DASHBOARD_ISSUES, brokenBacklinks: { criticalPercent: 90, warningPercent: 50 } }
    const sources = { brokenBacklinks: ready({ brokenBacklinks: 200, backlinks: 1000 }) } // 20%
    expect(buildDashboardIssues(sources).issues[0].severity).toBe("critical")
    expect(buildDashboardIssues(sources, loose).issues).toHaveLength(0)
  })
})

describe("rule 1 - broken backlinks (>= 20% critical, >= 5% warning)", () => {
  const at = (broken, total = 1000) => ({ brokenBacklinks: broken, backlinks: total })
  test("severity boundaries", () => {
    expect(sev("brokenBacklinks", at(49))).toBeNull() // 4.9%
    expect(sev("brokenBacklinks", at(50))).toBe("warning") // exactly 5%
    expect(sev("brokenBacklinks", at(199))).toBe("warning") // 19.9%
    expect(sev("brokenBacklinks", at(200))).toBe("critical") // exactly 20%
    expect(sev("brokenBacklinks", at(1000))).toBe("critical")
  })
  test("title, why and button", () => {
    const i = one("brokenBacklinks", { brokenBacklinks: 1643, backlinks: 18343 })
    expect(i.title).toBe("9.0% of backlinks point to broken URLs (1,643 links)")
    expect(i.why).toMatch(/dead pages/)
    expect(i.cta).toEqual({ label: "Fix broken links", href: "/app/backlinks/list?broken=true" })
  })
  test("one broken link is singular; no links, no broken links and unknown figures are no issue", () => {
    expect(one("brokenBacklinks", at(1, 10)).title).toBe("10.0% of backlinks point to broken URLs (1 link)")
    for (const v of [at(0), at(5, 0), { brokenBacklinks: null, backlinks: 100 }, { brokenBacklinks: 5, backlinks: null }, null, undefined]) expect(one("brokenBacklinks", v)).toBeNull()
  })
})

describe("rule 2 - error pages with backlinks (any = warning; critical at >= 50 links or a 403)", () => {
  const top = (o = {}) => ({ path: "/patna/", statusCode: 404, backlinks: 49, ...o })
  test("any error page is a warning", () => {
    expect(sev("errorPages", { count: 1, top: top() })).toBe("warning")
  })
  test("critical when the top error page has >= 50 backlinks (boundary), or returns 403 whatever its links", () => {
    expect(sev("errorPages", { count: 3, top: top({ backlinks: 50 }) })).toBe("critical")
    expect(sev("errorPages", { count: 3, top: top({ backlinks: 49 }) })).toBe("warning")
    expect(sev("errorPages", { count: 3, top: top({ statusCode: 403, backlinks: 2 }) })).toBe("critical")
    expect(sev("errorPages", { count: 3, top: top({ statusCode: 500, backlinks: 2 }) })).toBe("warning")
  })
  test("title with the top page, and the button", () => {
    const i = one("errorPages", { count: 138, top: top({ backlinks: 209 }) })
    expect(i.title).toBe("138 pages with backlinks return errors — top: /patna/ (404, 209 links)")
    expect(i.cta).toEqual({ label: "View error pages", href: "/app/backlinks/top-pages?status=error" })
  })
  test("one page is singular; without the list the title still stands (no 'top:' part); none is no issue", () => {
    expect(one("errorPages", { count: 1, top: top({ backlinks: 1 }) }).title).toBe("1 page with backlinks returns an error — top: /patna/ (404, 1 link)")
    expect(one("errorPages", { count: 4, top: null }).title).toBe("4 pages with backlinks return errors")
    expect(sev("errorPages", { count: 4, top: null })).toBe("warning")
    expect(one("errorPages", { count: 0, top: top() })).toBeNull()
    expect(one("errorPages", { count: null })).toBeNull()
  })
})

describe("rule 3 - high-spam referring domains (>= 30% critical, >= 10% warning)", () => {
  const at = (count, total = 1000) => ({ count, referringDomains: total })
  test("severity boundaries", () => {
    expect(sev("highSpam", at(99))).toBeNull()
    expect(sev("highSpam", at(100))).toBe("warning")
    expect(sev("highSpam", at(299))).toBe("warning")
    expect(sev("highSpam", at(300))).toBe("critical")
  })
  test("title uses the share of referring domains, the why names the page's own spam score, the button opens that page's Toxic tab", () => {
    const i = one("highSpam", { count: 3002, referringDomains: 3965 })
    expect(i.title).toBe("75.7% of referring domains have a high spam score (3,002)")
    expect(i.why).toContain(`above ${TOXIC_SPAM_ABOVE}`)
    expect(i.cta).toEqual({ label: "Review domains", href: "/app/referring-domains?tab=toxic" })
  })
  test("no referring domains, zero or unknown counts are no issue", () => {
    for (const v of [at(0), at(5, 0), { count: null, referringDomains: 10 }, { count: 5, referringDomains: null }]) expect(one("highSpam", v)).toBeNull()
  })
})

describe("rule 4 - traffic drop (<= -40% critical, <= -20% warning)", () => {
  const month = (etv, year, m) => ({ etv, year, month: m })
  const drop = (latest, previous = 1000) => ({ latest: month(latest, 2026, 10), previous: month(previous, 2026, 9) })
  test("severity boundaries", () => {
    expect(sev("trafficDrop", drop(801))).toBeNull() // -19.9%
    expect(sev("trafficDrop", drop(800))).toBe("warning") // exactly -20%
    expect(sev("trafficDrop", drop(601))).toBe("warning")
    expect(sev("trafficDrop", drop(600))).toBe("critical") // exactly -40%
    expect(sev("trafficDrop", drop(0))).toBe("critical")
  })
  test("a rise or no change is no issue", () => {
    expect(sev("trafficDrop", drop(1000))).toBeNull()
    expect(sev("trafficDrop", drop(5000))).toBeNull()
  })
  test("title names the month it is compared with, the button opens Traffic History", () => {
    const i = one("trafficDrop", { latest: month(540, 2026, 10), previous: month(1000, 2026, 9) })
    expect(i.title).toBe("Organic traffic fell 46.0% vs Sep 26")
    expect(i.cta).toEqual({ label: "View traffic history", href: "/app/traffic-history" })
  })
  test("an unknown or zero previous month cannot be compared: no issue", () => {
    expect(one("trafficDrop", drop(10, 0))).toBeNull()
    expect(one("trafficDrop", { latest: month(10, 2026, 10), previous: null })).toBeNull()
    expect(one("trafficDrop", { latest: month(null, 2026, 10), previous: month(10, 2026, 9) })).toBeNull()
  })
})

describe("rule 5 - keywords lost (lost > new = warning)", () => {
  test("only when MORE were lost than gained", () => {
    expect(sev("keywordsLost", { new: 10, lost: 11 })).toBe("warning")
    expect(sev("keywordsLost", { new: 10, lost: 10 })).toBeNull()
    expect(sev("keywordsLost", { new: 10, lost: 3 })).toBeNull()
    expect(sev("keywordsLost", { new: 0, lost: 1 })).toBe("warning")
  })
  test("title and button", () => {
    const i = one("keywordsLost", { new: 12, lost: 20 })
    expect(i.title).toBe("Lost 20 keywords, gained 12")
    expect(i.cta).toEqual({ label: "View keywords", href: "/app/organic-keywords" })
    expect(one("keywordsLost", { new: 0, lost: 1 }).title).toBe("Lost 1 keyword, gained 0")
  })
  test("unknown figures are no issue", () => {
    expect(one("keywordsLost", { new: null, lost: 5 })).toBeNull()
    expect(one("keywordsLost", { new: 5, lost: null })).toBeNull()
  })
})

describe("rule 6 - anchor over-optimisation (info; exact-match share above the Anchors threshold)", () => {
  const max = ANCHOR_HEALTH.exactMaxPercent
  test("strictly above the threshold, and always info", () => {
    expect(sev("anchors", { exactPercent: max })).toBeNull()
    expect(sev("anchors", { exactPercent: max + 0.1 })).toBe("info")
    expect(sev("anchors", { exactPercent: 80 })).toBe("info")
  })
  test("title and button", () => {
    const i = one("anchors", { exactPercent: 18.44 })
    expect(i.title).toBe("Exact-match anchors are 18.4% of your anchor profile")
    expect(i.cta).toEqual({ label: "Review anchors", href: "/app/backlinks/anchors" })
  })
  test("unknown share is no issue", () => {
    expect(one("anchors", { exactPercent: null })).toBeNull()
  })
})

describe("dedupe - the spam-score issue never appears beside the high-spam-domains one", () => {
  const spam = ready({ score: 55 })
  test("alone, a high spam score is a warning", () => {
    const r = buildDashboardIssues({ spamScore: spam })
    expect(r.issues.map((i) => [i.rule, i.severity])).toEqual([["spamScore", "warning"]])
    expect(sev("spamScore", { score: 30 })).toBeNull()
    expect(sev("spamScore", { score: 31 })).toBe("warning")
  })
  test("when high-spam domains fire (at any severity), the spam-score issue is dropped", () => {
    for (const count of [100, 300]) {
      const r = buildDashboardIssues({ highSpam: ready({ count, referringDomains: 1000 }), spamScore: spam })
      expect(r.issues.map((i) => i.rule)).toEqual(["highSpam"])
    }
  })
  test("when high-spam domains are below their threshold, the spam-score issue stays", () => {
    const r = buildDashboardIssues({ highSpam: ready({ count: 50, referringDomains: 1000 }), spamScore: spam })
    expect(r.issues.map((i) => i.rule)).toEqual(["spamScore"])
  })
  test("when the high-spam source failed or is loading, the spam-score issue is NOT hidden (it may be the only signal)", () => {
    expect(buildDashboardIssues({ highSpam: { state: "error" }, spamScore: spam }).issues.map((i) => i.rule)).toEqual(["spamScore"])
  })
})

describe("ranking: severity, then impact, then rule order; at most 5", () => {
  const all = () => ({
    brokenBacklinks: ready({ brokenBacklinks: 90, backlinks: 1000 }), // 9% warning, impact 1.8
    errorPages: ready({ count: 4, top: { path: "/a/", statusCode: 404, backlinks: 80 } }), // critical, impact 1.6
    highSpam: ready({ count: 150, referringDomains: 1000 }), // 15% warning, impact 1.5
    trafficDrop: ready({ latest: { etv: 500, year: 2026, month: 10 }, previous: { etv: 1000, year: 2026, month: 9 } }), // -50% critical, impact 2.5
    keywordsLost: ready({ new: 2, lost: 9 }), // warning, impact 4.5
    anchors: ready({ exactMaxPercent: 0, exactPercent: 30 }), // info
    spamScore: ready({ score: 90 }), // warning, dropped by the dedupe
  })
  test("critical first (the larger impact first), then warnings by impact, then info", () => {
    const r = buildDashboardIssues(all())
    expect(r.issues.map((i) => [i.rule, i.severity])).toEqual([
      ["trafficDrop", "critical"], ["errorPages", "critical"], ["keywordsLost", "warning"], ["brokenBacklinks", "warning"], ["highSpam", "warning"],
    ])
  })
  test("shows at most 5 but knows the real total (the anchors info issue is the 6th)", () => {
    const r = buildDashboardIssues(all())
    expect(r.issues).toHaveLength(5)
    expect(r.total).toBe(6)
    expect(r.issues.some((i) => i.rule === "anchors")).toBe(false)
  })
  test("equal severity and impact fall back to the rule order", () => {
    const r = buildDashboardIssues({ keywordsLost: ready({ new: 1, lost: 2 }), brokenBacklinks: ready({ brokenBacklinks: 100, backlinks: 1000 }) }) // 10%/5% = 2 vs 2/1 = 2
    expect(r.issues.map((i) => i.rule)).toEqual(["brokenBacklinks", "keywordsLost"])
  })
  test("the order of the sources object does not matter", () => {
    const a = buildDashboardIssues(all()).issues.map((i) => i.rule)
    const b = buildDashboardIssues(Object.fromEntries(Object.entries(all()).reverse())).issues.map((i) => i.rule)
    expect(b).toEqual(a)
  })
  test("every issue has a severity, a title, a why and a button", () => {
    for (const i of buildDashboardIssues(all()).issues) {
      expect(["critical", "warning", "info"]).toContain(i.severity)
      expect(i.title.length).toBeGreaterThan(10)
      expect(i.why.length).toBeGreaterThan(10)
      expect(i.cta.label).toBeTruthy()
      expect(i.cta.href.startsWith("/app/")).toBe(true)
    }
  })
})

describe("sources that are missing, loading, failed or skipped", () => {
  test("nothing at all: no issues, nothing pending or failed", () => {
    expect(buildDashboardIssues({})).toMatchObject({ issues: [], pending: [], failed: [], total: 0, checked: [] })
    expect(buildDashboardIssues()).toMatchObject({ issues: [], pending: [], failed: [] })
    expect(buildDashboardIssues(null)).toMatchObject({ issues: [] })
  })
  test("loading sources are pending (the panel keeps its skeleton); the others are judged meanwhile", () => {
    const r = buildDashboardIssues({ brokenBacklinks: ready({ brokenBacklinks: 500, backlinks: 1000 }), highSpam: { state: "loading" }, errorPages: { state: "loading" } })
    expect(r.pending).toEqual(["errorPages", "highSpam"])
    expect(r.issues.map((i) => i.rule)).toEqual(["brokenBacklinks"])
  })
  test("a failed source hides ONLY its rule and is reported", () => {
    const r = buildDashboardIssues({ brokenBacklinks: ready({ brokenBacklinks: 500, backlinks: 1000 }), trafficDrop: { state: "error" } })
    expect(r.failed).toEqual(["trafficDrop"])
    expect(r.issues.map((i) => i.rule)).toEqual(["brokenBacklinks"])
  })
  test("a skipped source (anchor profile not cached) is silent: not failed, not pending, not checked", () => {
    const r = buildDashboardIssues({ anchors: { state: "skipped" } })
    expect(r).toMatchObject({ issues: [], pending: [], failed: [], checked: [] })
  })
  test("`checked` lists the rules that really ran (so 'no issues' can be told apart from 'nothing was checked')", () => {
    const r = buildDashboardIssues({ keywordsLost: ready({ new: 5, lost: 1 }), anchors: { state: "skipped" }, trafficDrop: { state: "error" } })
    expect(r.checked).toEqual(["keywordsLost"])
    expect(r.issues).toEqual([])
  })
  test("an unknown state is ignored rather than guessed at", () => {
    expect(buildDashboardIssues({ brokenBacklinks: { state: "weird", value: { brokenBacklinks: 900, backlinks: 1000 } } }).issues).toEqual([])
  })
})

describe("the rules and their links", () => {
  test("seven rules, each with a link target; the Referring Domains one is that page's Toxic tab", () => {
    expect(RULE_ORDER).toEqual(["brokenBacklinks", "errorPages", "highSpam", "trafficDrop", "keywordsLost", "anchors", "spamScore"])
    expect(ISSUE_LINKS.highSpam).toBe("/app/referring-domains?tab=toxic")
  })
})
