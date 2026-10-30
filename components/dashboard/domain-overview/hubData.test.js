import { describe, expect, test } from "vitest"
import { buildDashboardIssues } from "./dashboardIssues"
import { buildAnchorMix, buildCompetitorRows, buildIssueSources, headToHeadShare, latestTwoMonths, mapLast30, pickTopPagesCard } from "./hubData"
import { mapDomainPage } from "../top-pages/mapDomainPage"
import { REAL_PAGES_ERRORS, REAL_PAGES_OK } from "../top-pages/testFixtures"
import { mapCompetitorsPage } from "../competitors/mapCompetitor"
import { mapBulkTraffic } from "../competitors/mapBulkTraffic"
import { REAL_COMPETITORS, REAL_SELF, REAL_BULK_ITEMS } from "../competitors/testFixtures"
import { mapAnchorsPage } from "../anchors/mapAnchor"
import { REAL_PROFILE } from "../anchors/testFixtures"
import { mapBacklinkSummary } from "../backlinks-overview/mapBacklinkSummary"
import { REAL_LIVE } from "../backlinks-overview/testFixtures"

const NOW = Date.parse("2026-10-28T12:00:00Z")
const okRows = REAL_PAGES_OK.items.map((i) => mapDomainPage(i, { target: "asgeyehospital.com", now: NOW }))
const errRows = REAL_PAGES_ERRORS.items.map((i) => mapDomainPage(i, { target: "asgeyehospital.com", now: NOW }))
const success = (extra) => ({ status: "success", ...extra })
const summary = mapBacklinkSummary(REAL_LIVE)

describe("latestTwoMonths", () => {
  const m = (year, month, etv) => ({ year, month, etv })
  test("the newest month and the calendar month before it, whatever the order", () => {
    const r = latestTwoMonths([m(2026, 8, 5), m(2026, 10, 9), m(2026, 9, 7)])
    expect([r.latest.month, r.previous.month]).toEqual([10, 9])
  })
  test("across a year boundary", () => {
    const r = latestTwoMonths([m(2026, 1, 9), m(2025, 12, 7)])
    expect([r.latest.year, r.previous.year, r.previous.month]).toEqual([2026, 2025, 12])
  })
  test("a gap is not compared across; nothing in, nothing out", () => {
    expect(latestTwoMonths([m(2026, 10, 9), m(2026, 8, 7)]).previous).toBeNull()
    expect(latestTwoMonths([])).toEqual({ latest: null, previous: null })
    expect(latestTwoMonths(null)).toEqual({ latest: null, previous: null })
  })
})

describe("buildIssueSources -> buildDashboardIssues (the real asgeyehospital.com figures)", () => {
  const inputs = (over = {}) => ({
    backlinks: success({ summary }),
    history: success({ items: [{ year: 2026, month: 10, etv: 400 }, { year: 2026, month: 9, etv: 1000 }] }),
    movement: success({ movement: { new: 10, lost: 25 } }),
    counts: success({ data: { pages: 518, errors: 138, redirects: 312 } }),
    fixFirst: success({ rows: errRows }),
    toxic: success({ count: 3002 }),
    anchors: { status: "skipped" },
    ...over,
  })
  const run = (over) => buildDashboardIssues(buildIssueSources(inputs(over)))

  test("every rule that applies fires, ranked: critical first", () => {
    const r = run()
    expect(r.issues.map((i) => [i.rule, i.severity])).toEqual([
      ["errorPages", "critical"], ["highSpam", "critical"], ["trafficDrop", "critical"], ["keywordsLost", "warning"], ["brokenBacklinks", "warning"],
    ])
    expect(r.issues.some((i) => i.rule === "spamScore")).toBe(false) // deduped by the high-spam rule
    expect(r.failed).toEqual([])
    expect(r.pending).toEqual([])
  })

  test("the error-pages issue names the top page of the Fix-first list (the www homepage is a 403 with 852 links -> critical)", () => {
    const i = run().issues.find((x) => x.rule === "errorPages")
    expect(i.title).toBe("138 pages with backlinks return errors — top: www.asgeyehospital.com/ (403, 852 links)")
    expect(i.severity).toBe("critical")
  })

  test("the broken-backlinks issue uses the summary's totals (1,643 of 18,343 = 9.0%)", () => {
    expect(run().issues.find((x) => x.rule === "brokenBacklinks").title).toBe("9.0% of backlinks point to broken URLs (1,643 links)")
  })

  test("the high-spam share is of the summary's referring domains (3,002 of 3,965)", () => {
    expect(run().issues.find((x) => x.rule === "highSpam").title).toBe("75.7% of referring domains have a high spam score (3,002)")
  })

  test("no error pages: that rule is checked and silent; a failed list keeps the count's issue without the top page", () => {
    expect(run({ counts: success({ data: { pages: 518, errors: 0, redirects: 3 } }) }).issues.some((i) => i.rule === "errorPages")).toBe(false)
    const noList = run({ fixFirst: { status: "error" } }).issues.find((i) => i.rule === "errorPages")
    expect(noList.title).toBe("138 pages with backlinks return errors")
  })

  test("a loading list keeps the error rule pending; a loading count too", () => {
    expect(run({ fixFirst: { status: "loading" } }).pending).toEqual(["errorPages"])
    expect(run({ counts: { status: "loading" } }).pending).toEqual(["errorPages"])
  })

  test("one failing source hides ONLY its rule", () => {
    const r = run({ history: { status: "error" } })
    expect(r.failed).toEqual(["trafficDrop"])
    expect(r.issues.length).toBeGreaterThanOrEqual(3)
    const toxicFails = run({ toxic: { status: "error" } })
    expect(toxicFails.failed).toEqual(["highSpam"])
    expect(toxicFails.issues.some((i) => i.rule === "spamScore")).toBe(false) // the real summary's spam score (17) is not high
  })

  test("the high-spam rule needs the backlinks summary too: if that fails, it fails; both are errors of one source", () => {
    expect(run({ backlinks: { status: "error" } }).failed.sort()).toEqual(["brokenBacklinks", "highSpam", "spamScore"].sort())
  })

  test("the anchor rule is silent when the profile is not cached, and fires (info) when the exact share is over the threshold", () => {
    expect(run().checked).not.toContain("anchors")
    const healthy = {
      backlinks: success({ summary: mapBacklinkSummary({ ...REAL_LIVE, broken_backlinks: 10 }) }),
      history: success({ items: [{ year: 2026, month: 10, etv: 1100 }, { year: 2026, month: 9, etv: 1000 }] }),
      movement: success({ movement: { new: 30, lost: 5 } }),
      counts: success({ data: { pages: 518, errors: 0, redirects: 3 } }),
      toxic: success({ count: 5 }),
    }
    const r = run({ ...healthy, anchors: success({ exactPercent: 22.5 }) })
    expect(r.issues.find((i) => i.rule === "anchors")).toMatchObject({ severity: "info", title: "Exact-match anchors are 22.5% of your anchor profile" })
  })

  test("everything healthy: no issues, and the checks that ran are listed", () => {
    const r = run({
      backlinks: success({ summary: mapBacklinkSummary({ ...REAL_LIVE, broken_backlinks: 10 }) }),
      history: success({ items: [{ year: 2026, month: 10, etv: 1100 }, { year: 2026, month: 9, etv: 1000 }] }),
      movement: success({ movement: { new: 30, lost: 5 } }),
      counts: success({ data: { pages: 518, errors: 0, redirects: 3 } }),
      toxic: success({ count: 5 }),
    })
    expect(r.issues).toEqual([])
    expect(r.checked).toEqual(["brokenBacklinks", "errorPages", "highSpam", "trafficDrop", "keywordsLost", "spamScore"])
  })

  test("everything still loading: nothing is judged, everything is pending", () => {
    const r = buildDashboardIssues(buildIssueSources({}))
    expect(r.issues).toEqual([])
    expect(r.pending.length).toBeGreaterThanOrEqual(6)
  })
})

describe("pickTopPagesCard", () => {
  const withTraffic = (rows, traffics) => rows.map((r, i) => ({ ...r, traffic: traffics[i] ?? null }))
  test("the top 4 OK pages by estimated traffic, then the worst error page pinned at the bottom (5 rows)", () => {
    const rows = withTraffic(okRows, [10, 900, 55, 0, 300])
    const card = pickTopPagesCard(rows, errRows[0])
    expect(card.rows).toHaveLength(5)
    expect(card.rows.slice(0, 4).map((r) => r.traffic)).toEqual([900, 300, 55, 10])
    expect(card.rows[4]).toMatchObject({ pinned: true, statusCode: errRows[0].statusCode })
    expect(card.rows.slice(0, 4).every((r) => !r.pinned && r.statusGroup === "ok")).toBe(true)
    expect(card.trafficKnown).toBe(true)
  })
  test("no error page with backlinks: four rows only", () => {
    const card = pickTopPagesCard(withTraffic(okRows, [5, 4, 3, 2, 1]), null)
    expect(card.rows).toHaveLength(4)
    expect(card.hasPinned).toBe(false)
  })
  test("a worst row that is not an error (status < 400) is never pinned", () => {
    expect(pickTopPagesCard(withTraffic(okRows, [5]), okRows[0]).hasPinned).toBe(false)
  })
  test("traffic unknown for every page (the join failed): ordered by referring domains and said so; a null traffic sorts after any figure", () => {
    const card = pickTopPagesCard(okRows, null)
    expect(card.trafficKnown).toBe(false)
    const rds = card.rows.map((r) => r.referringDomains)
    expect(rds).toEqual([...rds].sort((a, b) => b - a))
    const mixed = pickTopPagesCard(withTraffic(okRows, [null, 0, null]), null)
    expect(mixed.rows[0].traffic).toBe(0)
  })
  test("non-OK rows in the OK list (a server mix-up) are ignored; fewer than four pages is fine; nothing at all is empty", () => {
    expect(pickTopPagesCard([...errRows], null).rows).toEqual([])
    expect(pickTopPagesCard(okRows.slice(0, 2), null).rows).toHaveLength(2)
    expect(pickTopPagesCard(null, null).rows).toEqual([])
  })
})

describe("buildCompetitorRows", () => {
  const page = mapCompetitorsPage({ result: { items: REAL_COMPETITORS, self: REAL_SELF, totalCount: 18778 } })
  const listed = page.rows.map((r) => r.domain)
  const cmp = (extra = []) => mapBulkTraffic({ result: { items: [...REAL_BULK_ITEMS, ...extra] } }, ["asgeyehospital.com", "handmade-rival.com"])

  test("no tracked competitors: the first five of the list, in its order, none starred", () => {
    const { rows } = buildCompetitorRows(page, [], null)
    expect(rows.map((r) => r.domain)).toEqual(listed.slice(0, 5))
    expect(rows.every((r) => !r.tracked)).toBe(true)
  })
  test("tracked first (in the order saved), then the list fills up to five without repeating them", () => {
    const tracked = [listed[3], listed[1]]
    const { rows } = buildCompetitorRows(page, tracked, null)
    expect(rows.map((r) => r.domain)).toEqual([listed[3], listed[1], listed[0], listed[2], listed[4]])
    expect(rows.map((r) => r.tracked)).toEqual([true, true, false, false, false])
  })
  test("a tracked competitor from the list carries its shared keywords, average position and head-to-head numbers", () => {
    const { rows } = buildCompetitorRows(page, [listed[0]], null)
    const r = rows[0]
    expect(r.notInList).toBe(false)
    expect(r.sharedKeywords).toBe(page.rows[0].sharedKeywords)
    expect([r.ourSharedTraffic, r.theirSharedTraffic]).toEqual([page.rows[0].ourSharedTraffic, page.rows[0].theirSharedTraffic])
  })
  test("a tracked competitor NOT in the list: no shared keywords or head-to-head; its organic traffic from the cached comparison when known", () => {
    const withData = cmp([{ target: "handmade-rival.com", organic: { etv: 340, count: 12 }, paid: { etv: 0, count: 0 }, featured_snippet: null, local_pack: null }])
    const { rows } = buildCompetitorRows(page, ["handmade-rival.com"], withData)
    expect(rows[0]).toMatchObject({ domain: "handmade-rival.com", tracked: true, notInList: true, sharedKeywords: null, avgPosition: null, ourSharedTraffic: null, theirSharedTraffic: null, organicTraffic: 340 })
    expect(rows).toHaveLength(5)
    const noCache = buildCompetitorRows(page, ["handmade-rival.com"], null).rows[0]
    expect([noCache.notInList, noCache.organicTraffic]).toEqual([true, null])
    const notAnswered = buildCompetitorRows(page, ["handmade-rival.com"], cmp()).rows[0]
    expect(notAnswered.organicTraffic).toBeNull()
  })
  test("more tracked than rows: only the first five are shown and the rest is counted", () => {
    const tracked = Array.from({ length: 7 }, (_, i) => `rival${i}.com`)
    const r = buildCompetitorRows(page, tracked, null)
    expect(r.rows.map((x) => x.domain)).toEqual(tracked.slice(0, 5))
    expect(r.hiddenTracked).toBe(2)
  })
  test("an empty list with tracked competitors still shows them; nothing at all is empty", () => {
    expect(buildCompetitorRows({ rows: [] }, ["a.com"], null).rows.map((r) => r.domain)).toEqual(["a.com"])
    expect(buildCompetitorRows(null, [], null).rows).toEqual([])
  })
})

describe("headToHeadShare", () => {
  test("our share of ours + theirs; unknown or empty sides give null", () => {
    expect(headToHeadShare(12, 340)).toBeCloseTo((12 / 352) * 100, 9)
    expect(headToHeadShare(100, 0)).toBe(100)
    expect(headToHeadShare(0, 0)).toBeNull()
    expect(headToHeadShare(null, 5)).toBeNull()
    expect(headToHeadShare(5, undefined)).toBeNull()
  })
})

describe("mapLast30", () => {
  test("new, lost and the Monday the window starts on, as 'Sep 28'", () => {
    expect(mapLast30({ result: { since: "2026-09-28", days: 30, new: 41, lost: 12 } })).toEqual({ since: "Sep 28", sinceDate: "2026-09-28", new: 41, lost: 12 })
  })
  test("zero is a real figure; a bad or missing part is null; no result is null", () => {
    expect(mapLast30({ result: { since: "2026-09-28", new: 0, lost: 0 } })).toMatchObject({ new: 0, lost: 0 })
    expect(mapLast30({ result: { since: "nope", new: null } })).toEqual({ since: null, sinceDate: null, new: null, lost: null })
    expect(mapLast30({ result: null })).toBeNull()
    expect(mapLast30(null)).toBeNull()
  })
})

describe("buildAnchorMix (the Anchors page's classification and colours)", () => {
  const rows = mapAnchorsPage(REAL_PROFILE).rows
  const settings = { brandTerms: ["asg", "asg eye hospital", "asgeyehospital"], targetKeywords: ["cataract surgery", "lasik"] }
  test("segments add up to 100% of referring-domain share, in the Anchors page's type order, with its colours", () => {
    const mix = buildAnchorMix(rows, settings, { targetDomain: "asgeyehospital.com" })
    expect(mix.segments.reduce((s, x) => s + x.percent, 0)).toBeCloseTo(100, 6)
    expect(mix.segments.every((s) => /^#[0-9a-f]{6}$/i.test(s.color) && s.percent > 0)).toBe(true)
    expect(mix.anchors).toBe(rows.length)
  })
  test("brand terms change the split (the same rows, another classification)", () => {
    const withBrand = buildAnchorMix(rows, settings, { targetDomain: "asgeyehospital.com" })
    const without = buildAnchorMix(rows, { brandTerms: [], targetKeywords: [] }, { targetDomain: "asgeyehospital.com" })
    const branded = (m) => m.segments.find((s) => s.key === "branded")?.percent ?? 0
    expect(branded(withBrand)).toBeGreaterThan(branded(without))
  })
  test("the exact share is what the Anchors page's health check uses", () => {
    const mix = buildAnchorMix(rows, { brandTerms: [], targetKeywords: ["asg eye hospital"] }, { targetDomain: "asgeyehospital.com" })
    expect(mix.exactPercent === null || mix.exactPercent >= 0).toBe(true)
  })
  test("nothing cached (no rows) or no referring domains: null", () => {
    expect(buildAnchorMix([], settings)).toBeNull()
    expect(buildAnchorMix(null, settings)).toBeNull()
    expect(buildAnchorMix([{ anchor: "x", referringDomains: 0, backlinks: 0 }], settings)).toBeNull()
  })
})
