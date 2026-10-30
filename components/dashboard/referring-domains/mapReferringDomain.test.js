import { describe, expect, test } from "vitest"
import { mapNoLiveLinks, mapReferringDomain, mapReferringDomainsPage } from "./mapReferringDomain"
import { describeInsight } from "./insight"
import { REAL_RD, REAL_RD_LOST, REAL_RD_SPAMMY } from "./testFixtures"

const NOW = Date.parse("2026-10-28T12:00:00Z")
const real = (domain, set = REAL_RD) => set.items.find((i) => i.domain === domain)
const map = (domain, settings = {}, set = REAL_RD) => mapReferringDomain(real(domain, set), settings, { now: NOW })

describe("mapReferringDomain (real asgeyehospital.com rows)", () => {
  test("the numbers, and the values the SERVER decided", () => {
    const r = map("vasaneye.com")
    expect(r).toMatchObject({ domain: "vasaneye.com", rank: 258, backlinks: 761, referringPages: 761, spamScore: 0, brokenBacklinks: 761, quality: "medium", isSitewide: true, dofollowPct: 100 })
    expect(r.qualityInfo.label).toBe("Medium")
    expect(r.referringPagesDofollow).toBe(761)
    expect(r.referringPagesNofollow).toBe(0)
  })

  test("the top country (flag + name) and the main placement", () => {
    const r = map("vasaneye.com")
    expect(r.topCountry).toMatchObject({ code: "IN", name: "India" })
    expect(r.topCountry.flag).toBeTruthy()
    expect(r.mainPlacement).toEqual({ key: "footer", label: "Footer" })
    expect(map("theconsumersfeedback.com").mainPlacement.label).toBe("Section")
  })

  test("an unknown country has no flag and no country; an unknown placement says 'Not specified'", () => {
    expect(map("sportivo.network").topCountry).toBeNull()
    expect(mapReferringDomain({ domain: "a.com", main_placement: "" }).mainPlacement).toEqual({ key: "", label: "Not specified" })
    expect(mapReferringDomain({ domain: "a.com", top_country: "WW" }).topCountry).toMatchObject({ code: "WW", name: "Worldwide" })
  })

  test("the spam badge band, and the dates (first seen as 'Aug 2026' with the full date in the tooltip)", () => {
    expect(map("vasaneye.com").spamBand.key).toBe("low")
    expect(map("digitalpool.com", {}, REAL_RD_SPAMMY).spamBand.key).toBe("high")
    const r = map("vasaneye.com")
    expect(r.firstSeen.label).toBe("Aug 2026")
    expect(r.firstSeen.tooltip).toMatch(/^Aug 19, 2026/)
    expect(r.lostDate.label).toBeNull()
  })

  test("the Lost tab's rows carry a lost date", () => {
    const r = mapReferringDomain(REAL_RD_LOST.items[0], {}, { now: NOW })
    expect(r.lostDate.label).toMatch(/^[A-Z][a-z]{2} \d{4}$/)
  })

  test("toxic by the server's rules is a warning — until the user marks it OK, or disavows it", () => {
    const base = map("digitalpool.com", {}, REAL_RD_SPAMMY)
    expect(base.quality).toBe("toxic")
    expect(base.toxicWarning).toBe(true)
    expect(map("digitalpool.com", { reviewed: ["digitalpool.com"] }, REAL_RD_SPAMMY).toxicWarning).toBe(false)
    expect(map("digitalpool.com", { disavowed: ["digitalpool.com"] }, REAL_RD_SPAMMY).toxicWarning).toBe(false)
    expect(map("vasaneye.com").toxicWarning).toBe(false)
  })

  test("the disavowed / reviewed flags come from the project's lists (arrays or Sets), not from the provider's answer", () => {
    expect(map("vasaneye.com", { disavowed: ["vasaneye.com"] }).disavowed).toBe(true)
    expect(map("vasaneye.com", { disavowed: new Set(["vasaneye.com"]) }).disavowed).toBe(true)
    expect(map("vasaneye.com", { reviewed: new Set(["vasaneye.com"]) }).reviewed).toBe(true)
    expect(map("vasaneye.com", { disavowed: ["other.com"] }).disavowed).toBe(false)
    expect(map("vasaneye.com").disavowed).toBe(false)
  })

  test("the quality is NOT re-derived here: whatever the server sent is what is shown", () => {
    expect(mapReferringDomain({ domain: "a.com", rank: 999, backlinks_spam_score: 0, quality: "low" }).quality).toBe("low")
    expect(mapReferringDomain({ domain: "a.com", rank: 999, backlinks_spam_score: 0 }).quality).toBeNull()
    expect(mapReferringDomain({ domain: "a.com", quality: "bogus" }).quality).toBeNull()
  })

  test("the breakdowns for the expanded row", () => {
    const r = map("vasaneye.com")
    expect(r.breakdowns.placement.entries[0]).toMatchObject({ key: "footer", count: 761 })
    expect(r.breakdowns.countries.entries[0]).toMatchObject({ key: "IN", label: "India" })
    expect(r.breakdowns.linkTypes.entries[0].label).toBe("Text Anchor")
    expect(r.breakdowns.platforms.entries.map((e) => e.key)).toEqual(["blogs", "cms", "organization", "ecommerce"])
    expect(r.breakdowns.attributes.isEmpty).toBe(true)
  })

  test("missing data is null, never 0, and nothing is NaN", () => {
    const r = mapReferringDomain({ domain: "a.com" })
    for (const k of ["rank", "backlinks", "referringPages", "dofollowPct", "spamScore", "brokenBacklinks"]) expect(r[k], k).toBeNull()
    expect([r.spamBand, r.quality, r.topCountry, r.mainPlacement, r.insight]).toEqual([null, null, null, null, null])
    expect(r.isSitewide).toBe(false)
    expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/)
    expect(() => mapReferringDomain(null)).not.toThrow()
  })

  test("a page: the total and the rows; no result = no total; a real zero is 0", () => {
    const p = mapReferringDomainsPage(REAL_RD, {}, { now: NOW })
    expect([p.total, p.rows.length]).toEqual([3958, 10])
    expect(mapReferringDomainsPage(null)).toEqual({ total: null, rows: [] })
    expect(mapReferringDomainsPage({ totalCount: 0, items: [] })).toEqual({ total: 0, rows: [] })
  })

  test("a saved domain the provider has no live row for: still a row, saying so, with its flags", () => {
    const r = mapNoLiveLinks("gone.com", { disavowed: ["gone.com"] })
    expect(r).toMatchObject({ domain: "gone.com", noLiveLinks: true, disavowed: true, quality: null, rank: null, insight: null })
  })
})

describe("the one-line insight (first rule that applies)", () => {
  const row = (o) => ({ referringPages: 10, footerLinks: 0, backlinks: 10, brokenBacklinks: 0, dofollowPct: 100, ...o })
  test("all links in the footer -> likely sitewide", () => {
    expect(describeInsight(row({ referringPages: 761, footerLinks: 761, backlinks: 761 }))).toBe("All 761 links are footer links — likely a sitewide link.")
    expect(describeInsight(row({ referringPages: 10, footerLinks: 9 }))).toBeNull()
  })
  test("some links broken", () => {
    expect(describeInsight(row({ backlinks: 1200, brokenBacklinks: 340 }))).toBe("340 of 1,200 links are broken.")
  })
  test("mostly nofollow (under half the pages carry a dofollow link)", () => {
    expect(describeInsight(row({ dofollowPct: 49.9 }))).toBe("Mostly nofollow links.")
    expect(describeInsight(row({ dofollowPct: 50 }))).toBeNull()
  })
  test("the order: footer, then broken, then nofollow", () => {
    expect(describeInsight(row({ referringPages: 5, footerLinks: 5, brokenBacklinks: 5, backlinks: 5, dofollowPct: 0 }))).toMatch(/footer links/)
    expect(describeInsight(row({ brokenBacklinks: 5, dofollowPct: 0 }))).toMatch(/broken/)
  })
  test("no data, no line", () => {
    expect(describeInsight({ referringPages: null, footerLinks: null, backlinks: null, brokenBacklinks: null, dofollowPct: null })).toBeNull()
    expect(describeInsight(row({ referringPages: 0, footerLinks: 0 }))).toBeNull()
  })
  test("the real broken domain gets its line", () => {
    expect(map("vasaneye.com").insight).toBe("All 761 links are footer links — likely a sitewide link.")
  })
})
