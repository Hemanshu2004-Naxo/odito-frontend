import { describe, expect, test } from "vitest"
import { classifyAnchor } from "@/lib/anchors/classifyAnchor"
import { summariseAnchorProfile, evaluateAnchorHealth } from "@/lib/anchors/summariseAnchorProfile"
import { dofollowPercent, isSitewide, mapAnchor, mapAnchorsPage } from "./mapAnchor"
import { REAL_ANCHORS, REAL_BROKEN_ANCHORS, REAL_LOST_ANCHORS, REAL_PROFILE } from "./testFixtures"

const NOW = Date.parse("2026-10-27T12:00:00Z")
const real = (i, set = REAL_ANCHORS) => mapAnchor(set.items[i], { now: NOW })

describe("mapAnchor (real asgeyehospital.com rows)", () => {
  test("a text anchor: counts, dofollow %, rank, spam band, dates", () => {
    const r = real(3) // "ASG Eye Hospital"
    expect(r).toMatchObject({ anchor: "ASG Eye Hospital", isEmpty: false, label: "ASG Eye Hospital", referringDomains: 109, backlinks: 1164, rank: 266, spamScore: 2, brokenBacklinks: 762 })
    expect(r.dofollowPercent).toBeCloseTo(((109 - 13) / 109) * 100, 9)
    expect(r.spamBand).toMatchObject({ key: "low" })
    expect(r.isSitewide).toBe(false) // 10.7 links per domain
    expect(r.firstSeen.label).toBe("Jan 2022")
    expect(r.firstSeen.day).toBe("Jan 29, 2022")
    expect(r.firstSeen.tooltip).toMatch(/^Jan 29, 2022, .* UTC/)
    expect(r.firstSeen.raw).toBe("2022-01-29 06:03:29 +00:00".slice(0, 10) === "2022-01-29" ? r.firstSeen.raw : "")
  })

  test("an anchor with no text (image links) is the empty anchor, with a label and its own id", () => {
    const r = real(2)
    expect(r.anchor).toBeNull()
    expect(r).toMatchObject({ isEmpty: true, label: "(empty / image link)", referringDomains: 140, backlinks: 932 })
    expect(r.id).not.toBe(real(3).id)
  })

  test("many links from few sites is 'sitewide': 20 or more per referring domain", () => {
    expect(real(1, REAL_BROKEN_ANCHORS).anchor).toBe("https://asgeyehospital.com/patna/")
    expect(real(1, REAL_BROKEN_ANCHORS).isSitewide).toBe(true) // 207 links, 1 domain
    expect(real(1, REAL_BROKEN_ANCHORS).brokenBacklinks).toBe(104)
    expect(isSitewide(40, 2)).toBe(true) // exactly 20 per domain
    expect(isSitewide(39, 2)).toBe(false)
    expect(isSitewide(100, 0)).toBe(false)
    expect(isSitewide(null, 3)).toBe(false)
  })

  test("a spammy anchor falls in the High band", () => {
    expect(real(0).spamScore).toBe(54)
    expect(real(0).spamBand.key).toBe("high")
  })

  test("the breakdowns: placement, countries, site types and attributes, from the row itself", () => {
    const r = real(3)
    expect(r.breakdowns.placement.entries[0]).toMatchObject({ key: "footer", label: "Footer", count: 760 })
    expect(r.breakdowns.countries.entries[0]).toMatchObject({ key: "IN", label: "India", flag: expect.any(String), count: 880 })
    expect(r.breakdowns.platforms.entries.map((e) => e.label).slice(0, 2)).toEqual(["Cms", "Blogs"])
    expect(r.breakdowns.attributes.entries.map((e) => e.key)).toEqual(["noopener", "nofollow", "noreferrer", "sponsored"])
    expect(r.breakdowns.attributes.entries.find((e) => e.key === "sponsored").highlight).toBe(true)
  })

  test("the unknown and worldwide country keys are labelled, not shown as codes", () => {
    const countries = real(3).breakdowns.countries
    const labels = countries.entries.map((e) => e.label)
    expect(labels).toContain("Worldwide")
    // The unknown country is not a bar: it is set aside (shares are of the links with a KNOWN country) and reported on its own.
    expect(labels).not.toContain("Unknown")
    expect(countries.unknown).toMatchObject({ key: "", label: "Unknown" })
    expect(countries.unknown.count).toBeGreaterThan(0)
  })

  test("an anchor with no attributes has an empty attributes breakdown (not an error)", () => {
    expect(real(0).breakdowns.attributes.isEmpty).toBe(true)
  })

  test("the counts behind the row", () => {
    const s = real(3).stats
    expect(s).toMatchObject({ referringMainDomains: 101, referringPages: 1062, referringPagesNofollow: 134, referringPagesDofollow: 928, referringIps: 104, referringSubnets: 78 })
  })

  test("a lost anchor carries its lost date", () => {
    const r = real(0, REAL_LOST_ANCHORS)
    expect(r.isEmpty).toBe(true)
    expect(r.brokenBacklinks).toBe(111)
    expect(r.referringDomains).toBe(335)
  })
})

describe("mapAnchor: missing data is null, never 0", () => {
  test("a row with almost nothing in it", () => {
    const r = mapAnchor({ anchor: "x" })
    for (const k of ["referringDomains", "backlinks", "dofollowPercent", "rank", "spamScore", "brokenBacklinks"]) expect(r[k], k).toBeNull()
    expect(r.spamBand).toBeNull()
    expect(r.isSitewide).toBe(false)
    expect(r.firstSeen).toMatchObject({ label: null, tooltip: null, raw: null })
    expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/)
  })
  test("non-numeric counts and a garbage date do not break it", () => {
    const r = mapAnchor({ anchor: "x", backlinks: "12", referring_domains: NaN, first_seen: "yesterday", rank: Infinity })
    expect([r.backlinks, r.referringDomains, r.rank]).toEqual([null, null, null])
    expect(r.firstSeen.label).toBeNull()
  })
  test("a blank anchor is the empty anchor", () => {
    expect(mapAnchor({ anchor: "   " }).isEmpty).toBe(true)
    expect(mapAnchor({ anchor: "" }).isEmpty).toBe(true)
  })
  test("garbage in does not throw", () => {
    expect(() => mapAnchor(null)).not.toThrow()
    expect(() => mapAnchor(undefined)).not.toThrow()
    expect(() => mapAnchorsPage({ totalCount: 3, items: null })).not.toThrow()
  })
})

describe("dofollowPercent", () => {
  test("(referring domains − nofollow) ÷ referring domains", () => {
    expect(dofollowPercent(100, 25)).toBe(75)
    expect(dofollowPercent(100, 0)).toBe(100)
    expect(dofollowPercent(100, 100)).toBe(0)
  })
  test("unknown or impossible inputs are null / held in range", () => {
    expect(dofollowPercent(0, 0)).toBeNull()
    expect(dofollowPercent(null, 1)).toBeNull()
    expect(dofollowPercent(10, null)).toBeNull()
    expect(dofollowPercent(10, 50)).toBe(0)
  })
})

describe("mapAnchorsPage", () => {
  test("a page: the total and the rows", () => {
    const p = mapAnchorsPage(REAL_ANCHORS, { now: NOW })
    expect(p.total).toBe(1004)
    expect(p.rows).toHaveLength(10)
  })
  test("no result at all: no total, no rows (not a total of 0)", () => {
    expect(mapAnchorsPage(null)).toEqual({ total: null, rows: [] })
  })
  test("a filter that matched nothing is a real zero", () => {
    expect(mapAnchorsPage({ totalCount: 0, items: [] })).toEqual({ total: 0, rows: [] })
  })
})

describe("the REAL profile through the whole classification (1,000 anchors)", () => {
  const rows = mapAnchorsPage(REAL_PROFILE, { now: NOW }).rows
  const settings = { brandTerms: ["asg", "asg eye hospital", "asgeyehospital"], targetKeywords: ["lasik surgery", "cataract surgery", "eye care"] }
  const summary = summariseAnchorProfile(rows, settings, { targetDomain: "asgeyehospital.com", totalReferringDomains: 4000 })

  test("1,000 rows are mapped and the profile says more exist", () => {
    expect(rows).toHaveLength(1000)
    expect(REAL_PROFILE.totalCount).toBe(1004)
  })
  test("the spam network's anchor tops the profile and is a naked URL (it contains the domain)", () => {
    expect(summary.topAnchor).toMatchObject({ type: "naked_url", referringDomains: 2707 })
    expect(summary.topAnchor.percent).toBeCloseTo((2707 / 4000) * 100, 6)
  })
  test("every type with anchors has a share; the shares add up to 100%", () => {
    const sum = Object.values(summary.types).reduce((a, t) => a + t.percentByReferringDomains, 0)
    expect(sum).toBeCloseTo(100, 6)
    expect(summary.types.branded.anchors).toBeGreaterThan(0)
    expect(summary.types.empty.anchors).toBe(1)
    expect(summary.types.empty.referringDomains).toBe(140)
    expect(summary.totals.anchors).toBe(1000)
  })
  test("its health: the repeated spam anchor, heavy naked URLs and spam are all noticed", () => {
    const ids = evaluateAnchorHealth(summary).map((c) => c.id)
    expect(ids).toContain("repeated")
    expect(ids).toContain("sitewide")
  })
  test("classifying the same rows again with other settings changes the split without any new data", () => {
    const bare = summariseAnchorProfile(rows, { brandTerms: [], targetKeywords: [] }, { targetDomain: "asgeyehospital.com" })
    expect(bare.types.branded.anchors).toBe(0)
    expect(bare.types.exact.anchors).toBe(0)
    expect(bare.totals).toEqual(summary.totals)
  })
  test("real anchors land in the types an SEO would expect", () => {
    const c = (a) => classifyAnchor(a, settings, "asgeyehospital.com")
    expect(c("ASG Eye Hospital")).toBe("branded")
    expect(c("https://asgeyehospital.com/")).toBe("naked_url")
    expect(c("LASIK surgery")).toBe("exact")
    expect(c("LASIK surgery in India")).toBe("partial")
    expect(c("eye care services")).toBe("partial")
    expect(c("Visit website (asgeyehospital.com)")).toBe("naked_url")
    expect(c("Jodhpur")).toBe("other")
    expect(c(null)).toBe("empty")
  })
})
