import { describe, expect, test } from "vitest"
import { groupUrlVariants } from "./groupUrlVariants"
import { mapDomainPage } from "./mapDomainPage"
import { buildTopPagesCsv, CSV_COLUMNS } from "./exportCsv"
import { REAL_PAGES, REAL_PAGES_ERRORS } from "./testFixtures"

const NOW = Date.parse("2026-10-28T12:00:00Z")
const map = (item, o = {}) => mapDomainPage({ ...item, ...o }, { target: "asgeyehospital.com", now: NOW })
const real = (set, url, o) => map(set.items.find((i) => i.url === url), o)

// The homepage as the live data has it: https (301 -> www), http (301 -> www), and www itself — blocked (403).
const https = (o) => real(REAL_PAGES, "https://asgeyehospital.com/", o)
const http = (o) => real(REAL_PAGES, "http://asgeyehospital.com/", o)
const www = (o) => real(REAL_PAGES_ERRORS, "https://www.asgeyehospital.com/", o)
const lasik = () => real(REAL_PAGES, "https://asgeyehospital.com/specialities/lasik-surgery/")

describe("groupUrlVariants: the www / http / https versions of the homepage are ONE page", () => {
  const rows = [https(), lasik(), http(), www()]
  const merged = groupUrlVariants(rows)

  test("one row per page, in the order each page first appears", () => {
    expect(merged).toHaveLength(2)
    expect(merged[0].normalizedUrl).toBe("asgeyehospital.com")
    expect(merged[1].normalizedUrl).toBe("asgeyehospital.com/specialities/lasik-surgery")
  })
  test("a page with ONE spelling is returned as it is (no chip, no 'approx')", () => {
    expect(merged[1]).toBe(rows[1])
    expect(merged[1].variantCount).toBe(1)
    expect(merged[1].approx).toBe(false)
    expect(merged[1].variants).toBeNull()
  })
  test("backlinks and referring domains are SUMMED, and marked approximate", () => {
    const home = merged[0]
    expect(home.backlinks).toBe(4689 + 278 + 852)
    expect(home.referringDomains).toBe(3223 + 117 + 34)
    expect(home.approx).toBe(true)
    expect(home.variantCount).toBe(3)
  })
  test("the status is the WORST in the group: the www version is blocked (403) although the other two only redirect", () => {
    const home = merged[0]
    expect([home.statusCode, home.statusGroup, home.statusLabel]).toEqual([403, "blocked", "403 Blocked"])
    expect(home.suggestedFix).toBe("Server/CDN is blocking access — check firewall or bot protection")
  })
  test("the variants stay under the merged row, most backlinks first, each with its OWN status and counts", () => {
    expect(merged[0].variants.map((v) => [v.url, v.statusCode, v.backlinks])).toEqual([
      ["https://asgeyehospital.com/", 301, 4689], ["https://www.asgeyehospital.com/", 403, 852], ["http://asgeyehospital.com/", 301, 278],
    ])
  })
  test("the dofollow share is weighted by referring domains; the rank is the best; the first seen is the earliest", () => {
    const home = merged[0]
    const expected = (((3223 - 155) / 3223) * 100 * 3223 + ((117 - 86) / 117) * 100 * 117 + (www().dofollowPct * 34)) / (3223 + 117 + 34)
    expect(home.dofollowPct).toBeCloseTo(expected, 6)
    expect(home.rank).toBe(Math.max(https().rank, http().rank, www().rank))
    expect(home.firstSeen.date.getTime()).toBe(Math.min(...[https(), http(), www()].map((r) => r.firstSeen.date.getTime())))
  })
  test("the traffic is NOT summed (every variant shares one normalised URL, so one figure); a failed join stays null", () => {
    const withTraffic = groupUrlVariants([https({ traffic: 100, keywords: 4 }), http({ traffic: 100, keywords: 4 }), www({ traffic: 100, keywords: 4 })])
    expect([withTraffic[0].traffic, withTraffic[0].keywords]).toEqual([100, 4])
    expect(groupUrlVariants([https(), http()])[0].traffic).toBeNull()
  })
  test("the flags are the union of the variants' flags, without repeats", () => {
    const g = groupUrlVariants([
      real(REAL_PAGES, "https://asgeyehospital.com/", { flags: ["redirected_links"] }),
      real(REAL_PAGES, "http://asgeyehospital.com/", { flags: ["redirected_links"] }),
      real(REAL_PAGES_ERRORS, "https://www.asgeyehospital.com/", { flags: ["wasted_links"] }),
    ])[0]
    expect(g.flagIds).toEqual(["redirected_links", "wasted_links"])
  })
  test("the merged row is a NEW row (the loaded rows are not changed) and has its own stable id", () => {
    const before = JSON.stringify(rows)
    const again = groupUrlVariants(rows)
    expect(JSON.stringify(rows)).toBe(before)
    expect(again[0].id).toBe("group:asgeyehospital.com")
    expect(again[0]).not.toBe(rows[0])
  })
});

describe("every spelling variant is recognised", () => {
  const row = (url) => mapDomainPage({ url, normalized_url: url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, ""), status_code: 200, status_group: "ok", backlinks: 1, referring_domains: 1 }, { target: "x.com" })
  test("http / https / www / trailing slash of the same page merge; a different path does not", () => {
    const g = groupUrlVariants([row("https://x.com/a/"), row("http://x.com/a"), row("https://www.x.com/a/"), row("https://x.com/b/")])
    expect(g.map((r) => r.variantCount)).toEqual([3, 1])
  })
  test("nothing to merge: the same rows; no rows: no rows", () => {
    const rows = [row("https://x.com/a"), row("https://x.com/b")]
    expect(groupUrlVariants(rows)).toEqual(rows)
    expect(groupUrlVariants([])).toEqual([])
  })
  test("a row with no status (0 / null) is the 'unknown' group: worse than a redirect, better than an error", () => {
    const g = groupUrlVariants([
      mapDomainPage({ url: "https://x.com/", normalized_url: "x.com", status_code: 301, status_group: "redirect", backlinks: 5 }, { target: "x.com" }),
      mapDomainPage({ url: "http://x.com/", normalized_url: "x.com", status_code: 0, status_group: "unknown", backlinks: 9 }, { target: "x.com" }),
    ])[0]
    expect(g.statusGroup).toBe("unknown")
  })
  test("a figure missing from every variant stays missing (null), not 0", () => {
    const g = groupUrlVariants([
      mapDomainPage({ url: "https://x.com/", normalized_url: "x.com", status_code: 301, status_group: "redirect" }, { target: "x.com" }),
      mapDomainPage({ url: "http://x.com/", normalized_url: "x.com", status_code: 301, status_group: "redirect" }, { target: "x.com" }),
    ])[0]
    expect([g.backlinks, g.referringDomains, g.dofollowPct, g.rank]).toEqual([null, null, null, null])
  })
})

describe("the CSV (same columns as the server's export)", () => {
  test("the header", () => {
    expect(CSV_COLUMNS.map(([h]) => h).join(",")).toBe("URL,Normalised URL,Status,Redirect target,Title,Referring domains,Backlinks,Broken backlinks,Dofollow %,Rank,Est. traffic,Keywords,Flags,Suggested fix,First seen,Last crawled")
  })
  test("a real row: status, redirect target, the normalised URL, the fix; EMPTY traffic cells when the join failed", () => {
    const line = buildTopPagesCsv([www()]).split("\r\n")[1]
    const cells = line.split(",")
    expect(cells.slice(0, 3)).toEqual(["https://www.asgeyehospital.com/", "asgeyehospital.com", "403"])
    expect([cells[10], cells[11]]).toEqual(["", ""])
    expect(line).toContain("Server/CDN is blocking access — check firewall or bot protection")
  })
  test("traffic 0 is written as 0 (it is a real zero); flags as words", () => {
    const row = real(REAL_PAGES_ERRORS, "https://www.asgeyehospital.com/", { traffic: 0, keywords: 0, flags: ["wasted_links"] })
    const cells = buildTopPagesCsv([row]).split("\r\n")[1].split(",")
    expect([cells[10], cells[11], cells[12]]).toEqual(["0", "0", "Links point to a broken page"])
  })
  test("merged rows are written with their summed counts and worst status; a formula-looking title is neutralised", () => {
    const home = groupUrlVariants([https(), http(), www()])[0]
    const cells = buildTopPagesCsv([home]).split("\r\n")[1].split(",")
    expect([cells[2], cells[5], cells[6]]).toEqual(["403", "3374", "5819"])
    expect(buildTopPagesCsv([mapDomainPage({ url: "https://x.com/", title: "=cmd|x" })]).split("\r\n")[1]).toContain("\"'=cmd|x\"".replace(/"/g, "")) // csvCell prefixes a quote
  })
})
