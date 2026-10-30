import { describe, expect, test } from "vitest"
import { describeAddress, mapDomainPage, mapDomainPagesPage, splitUrl, statusLabel } from "./mapDomainPage"
import { describeWaste } from "./FixFirst"
import { backlinksHref, keywordsHref } from "./links"
import { REAL_PAGES, REAL_PAGES_ERRORS, REAL_PAGES_OK } from "./testFixtures"

const NOW = Date.parse("2026-10-28T12:00:00Z")
const TARGET = "asgeyehospital.com"
const find = (set, url) => set.items.find((i) => i.url === url)
const map = (item, o = {}) => mapDomainPage({ ...item, ...o }, { target: TARGET, now: NOW })

describe("mapDomainPage (real asgeyehospital.com rows)", () => {
  test("the www homepage: blocked (403) with its counts, and the fix the server chose", () => {
    const r = map(find(REAL_PAGES_ERRORS, "https://www.asgeyehospital.com/"))
    expect(r).toMatchObject({ statusCode: 403, statusGroup: "blocked", statusLabel: "403 Blocked", backlinks: 852, referringDomains: 34, normalizedUrl: "asgeyehospital.com" })
    expect(r.suggestedFix).toBe("Server/CDN is blocking access — check firewall or bot protection")
  })
  test("/patna/: an error (404) with a redirect fix", () => {
    const r = map(find(REAL_PAGES_ERRORS, "https://asgeyehospital.com/patna/"))
    expect([r.statusLabel, r.statusGroup, r.backlinks, r.referringDomains, r.suggestedFix]).toEqual(["404", "error", 209, 3, "Add a 301 redirect to a relevant live page"])
    expect(r.path).toBe("/patna/")
    expect(r.address).toBe("/patna/")
  })
  test("a redirect: its target, no title, nothing on the page ('—'), no fix", () => {
    const r = map(find(REAL_PAGES, "https://asgeyehospital.com/"))
    expect([r.statusLabel, r.statusGroup, r.location, r.title, r.suggestedFix]).toEqual(["301", "redirect", "https://www.asgeyehospital.com/", null, null])
    expect(r.locationLabel).toBe("www.asgeyehospital.com/")
    expect(r.heading).toBe("/")
    expect([r.onPage.title, r.onPage.canonical, r.onPage.language, r.onPage.h1, r.onPage.technologies]).toEqual([null, null, null, [], []])
  })
  test("an OK page: its title in bold, its path underneath, its on-page info", () => {
    const r = map(find(REAL_PAGES_OK, "https://asgeyehospital.com/specialities/refractive-surgeries/"))
    expect(r.heading).toBe("Refractive Surgery in India | LASIK, PRK, ICL & Vision Correction | ASG Eye Hospital")
    expect(r.address).toBe("/specialities/refractive-surgeries/")
    expect(r.onPage).toMatchObject({ h1: ["Experience Visual Freedom"], language: "en", wordsCount: 2085, internalLinks: 145, externalLinks: 6, images: 57, server: "nginx", technologies: ["wordpress", "nginx"] })
    expect(r.lastCrawled.day).toBe("Aug 10, 2026")
  })
  test("dates: 'Jan 2022' in the table and the exact date in the tooltip", () => {
    const r = map(find(REAL_PAGES, "https://asgeyehospital.com/"))
    expect(r.firstSeen.label).toBe("Sep 2020")
    expect(r.firstSeen.tooltip).toMatch(/^Sep 23, 2020/)
  })
  test("the dofollow share and the stats come from the server's numbers", () => {
    const r = map(find(REAL_PAGES, "https://asgeyehospital.com/"))
    expect(r.dofollowPct).toBeCloseTo(((3223 - 155) / 3223) * 100, 9)
    expect(r.stats).toMatchObject({ referringMainDomains: 3198, referringPages: 4217, referringPagesNofollow: 769, referringPagesDofollow: 3448, referringIps: 3022, referringSubnets: 413 })
    expect(r.spamScore).toBe(40)
    expect(r.spamBand.key).toBe("high")
  })
  test("the traffic and flags the server joined; a failed join is null — never 0", () => {
    const base = find(REAL_PAGES, "https://asgeyehospital.com/")
    const joined = map(base, { traffic: 640.5, keywords: 12, flags: ["redirected_links", "bogus"] })
    expect([joined.traffic, joined.keywords, joined.flagIds]).toEqual([640.5, 12, ["redirected_links"]])
    expect(joined.flags[0]).toMatchObject({ id: "redirected_links", tone: "amber" })
    const failed = map(base, { traffic: null, keywords: null, flags: [] })
    expect([failed.traffic, failed.keywords]).toEqual([null, null])
    const zero = map(base, { traffic: 0, keywords: 0 })
    expect([zero.traffic, zero.keywords]).toEqual([0, 0])
  })
  test("the canonical: kept, and flagged when it names another page", () => {
    expect(map({ url: "https://x.com/a/", canonical: "https://x.com/b/", canonical_differs: true }).onPage).toMatchObject({ canonical: "https://x.com/b/", canonicalDiffers: true })
    expect(map({ url: "https://x.com/a/", canonical: "https://x.com/a", canonical_differs: false }).onPage.canonicalDiffers).toBe(false)
    expect(map({ url: "https://x.com/a/" }).onPage.canonicalDiffers).toBe(false)
  })
  test("the breakdowns of the link profile for the expanded row", () => {
    const r = map(find(REAL_PAGES_OK, "https://asgeyehospital.com/specialities/refractive-surgeries/"))
    expect(r.breakdowns.placement.entries.length).toBeGreaterThan(0)
    expect(r.breakdowns.countries.entries[0].label).toBeTruthy()
  })
  test("missing data is null, never 0, and nothing is NaN; a row with no status is 'unknown'", () => {
    const r = mapDomainPage({ url: "https://x.com/a", status_code: null })
    for (const k of ["referringDomains", "backlinks", "brokenBacklinks", "dofollowPct", "rank", "traffic", "keywords", "title", "location"]) expect(r[k], k).toBeNull()
    expect([r.statusGroup, r.statusLabel]).toEqual(["unknown", "Unknown"])
    expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/)
    expect(() => mapDomainPage(null)).not.toThrow()
  })
  test("a page: the total, the rows and what the server said about the traffic join", () => {
    const p = mapDomainPagesPage({ result: { totalCount: 6762, items: REAL_PAGES.items }, traffic: { status: "failed", code: "X" } }, { target: TARGET, now: NOW })
    expect([p.total, p.rows.length, p.traffic.status]).toEqual([6762, 10, "failed"])
    expect(mapDomainPagesPage(null)).toEqual({ total: null, rows: [], traffic: null })
    expect(mapDomainPagesPage({ result: { totalCount: 0, items: [] } }).total).toBe(0)
  })
})

describe("how an address reads", () => {
  test("the project's own bare host shows its PATH; the homepage found as www / http is told apart", () => {
    expect(describeAddress("https://asgeyehospital.com/specialities/lasik/", TARGET).label).toBe("/specialities/lasik/")
    expect(describeAddress("https://asgeyehospital.com/", TARGET).label).toBe("/")
    expect(describeAddress("https://www.asgeyehospital.com/", TARGET).label).toBe("www.asgeyehospital.com/")
    expect(describeAddress("http://asgeyehospital.com/", TARGET).label).toBe("http://asgeyehospital.com/")
    expect(describeAddress("http://www.asgeyehospital.com/a/", TARGET).label).toBe("http://www.asgeyehospital.com/a/")
    expect(describeAddress("https://blog.asgeyehospital.com/p", TARGET).label).toBe("blog.asgeyehospital.com/p")
  })
  test("a query string is part of the path; a non-URL is shown as it is", () => {
    expect(describeAddress("https://asgeyehospital.com/a/?page=2", TARGET).path).toBe("/a/?page=2")
    expect(describeAddress("not a url", TARGET).label).toBe("not a url")
    expect(splitUrl("nope")).toBeNull()
  })
  test("status labels: 403 is 'Blocked', a missing code is 'Unknown'", () => {
    expect([statusLabel(200, "ok"), statusLabel(301, "redirect"), statusLabel(403, "blocked"), statusLabel(404, "error"), statusLabel(null, "unknown")]).toEqual(["200", "301", "403 Blocked", "404", "Unknown"])
  })
})

describe("'Fix first' sentence", () => {
  test("the example of the brief: '/patna/ returns 404 — 209 backlinks from 3 domains are wasted. Add a 301 redirect to a relevant live page.'", () => {
    expect(describeWaste(map(find(REAL_PAGES_ERRORS, "https://asgeyehospital.com/patna/")))).toBe("/patna/ returns 404 — 209 backlinks from 3 domains are wasted. Add a 301 redirect to a relevant live page.")
  })
  test("a blocked page's links MAY be wasted (the crawler is refused, visitors may not be)", () => {
    expect(describeWaste(map(find(REAL_PAGES_ERRORS, "https://www.asgeyehospital.com/")))).toBe("www.asgeyehospital.com/ returns 403 — 852 backlinks from 34 domains may be wasted. Server/CDN is blocking access — check firewall or bot protection.")
  })
  test("singular forms", () => {
    expect(describeWaste(map({ url: "https://asgeyehospital.com/x", status_code: 404, status_group: "error", backlinks: 1, referring_domains: 1, suggested_fix: "Add a 301 redirect to a relevant live page" }))).toBe("/x returns 404 — 1 backlink from 1 domain is wasted. Add a 301 redirect to a relevant live page.")
  })
})

describe("View backlinks / View keywords", () => {
  test("backlinks: the Backlinks page filtered to this EXACT target URL", () => {
    expect(backlinksHref("https://asgeyehospital.com/patna/")).toBe("/app/backlinks/list?to=https%3A%2F%2Fasgeyehospital.com%2Fpatna%2F")
    expect(new URL(backlinksHref("https://x.com/a?b=1&c=2"), "http://h").searchParams.get("to")).toBe("https://x.com/a?b=1&c=2")
  })
  test("keywords: Organic Keywords filtered by URL contains the PATH (the query string is not part of it)", () => {
    expect(keywordsHref("/specialities/lasik-surgery/")).toBe("/app/organic-keywords?url=%2Fspecialities%2Flasik-surgery%2F")
    expect(keywordsHref("/a/?page=2")).toBe("/app/organic-keywords?url=%2Fa%2F")
    expect(keywordsHref("")).toBe("/app/organic-keywords?url=%2F")
  })
})
