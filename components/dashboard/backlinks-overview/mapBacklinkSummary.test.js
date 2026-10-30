import { describe, test, expect } from "vitest"
import { buildBreakdown, describeProfileAge, describeUnknownCountries, evaluateHealth, mapBacklinkSummary, spamBand, titleCase } from "./mapBacklinkSummary"
import { PROFILE_HEALTH } from "./constants"
import { REAL_ALL, REAL_DOFOLLOW, REAL_LIVE, REAL_LOST } from "./testFixtures"

const NOW = new Date("2026-10-27T10:00:00Z")
const live = mapBacklinkSummary(REAL_LIVE, { now: NOW })
const entry = (b, key) => b.entries.find((e) => e.key === key)

describe("mapBacklinkSummary: calculated values (real asgeyehospital.com figures, live)", () => {
  test("totals are carried under clean names", () => {
    expect(live.rank).toBe(353)
    expect(live.totals).toMatchObject({
      backlinks: 18343, referringDomains: 3965, referringDomainsNofollow: 453, referringPages: 13590, referringPagesNofollow: 5102,
      referringSubnets: 837, brokenBacklinks: 1643, brokenPages: 2498,
    })
  })

  test("dofollow domains = referring domains − nofollow; dofollow % = that ÷ referring domains", () => {
    expect(live.derived.dofollowDomains).toBe(3965 - 453)
    expect(live.derived.dofollowDomainsPercent).toBeCloseTo((3512 / 3965) * 100, 9) // 88.6%
    expect(live.derived.nofollowDomains).toBe(453)
  })

  test("dofollow pages = referring pages − nofollow; dofollow pages %", () => {
    expect(live.derived.dofollowPages).toBe(13590 - 5102)
    expect(live.derived.dofollowPagesPercent).toBeCloseTo((8488 / 13590) * 100, 9)
  })

  test("backlinks per domain to 1 decimal; subnet diversity and broken % as percentages", () => {
    expect(live.derived.backlinksPerDomain).toBe(4.6) // 18343 / 3965 = 4.626
    expect(live.derived.subnetDiversity).toBeCloseTo((837 / 3965) * 100, 9) // 21.1%
    expect(live.derived.brokenBacklinksPercent).toBeCloseTo((1643 / 18343) * 100, 9) // 9.0%
  })

  test("profile age: 'Since Mar 2019 (7 yrs)', with the exact first-seen date for a tooltip", () => {
    expect(live.age.short).toBe("Since Mar 2019")
    expect(live.age.label).toBe("Since Mar 2019 (7 yrs)")
    expect(live.age.tooltip).toMatch(/^First seen .*2019/)
  })

  test("rank gauge and spam score", () => {
    expect(live.rankPercent).toBeCloseTo(35.3, 5)
    expect(live.spam).toMatchObject({ score: 17, siteScore: 5 })
    expect(live.spam.band.label).toBe("Medium")
  })

  test("dofollow-only response: the provider reports no nofollow, so 100% dofollow", () => {
    const d = mapBacklinkSummary(REAL_DOFOLLOW, { now: NOW })
    expect(d.derived.dofollowDomainsPercent).toBe(100)
    expect(d.derived.dofollowPagesPercent).toBe(100)
    expect(d.derived.backlinksPerDomain).toBe(3) // 10441 / 3512 = 2.97
  })

  test("a missing input gives null, never 0: no ratio from an unknown or a zero denominator", () => {
    const empty = mapBacklinkSummary({}, { now: NOW })
    for (const v of [empty.rank, empty.rankPercent, empty.derived.dofollowDomains, empty.derived.dofollowDomainsPercent, empty.derived.backlinksPerDomain, empty.derived.subnetDiversity, empty.derived.brokenBacklinksPercent, empty.spam.score, empty.hasBacklinks]) expect(v).toBeNull()
    const zero = mapBacklinkSummary({ backlinks: 0, referring_domains: 0, referring_domains_nofollow: 0, referring_subnets: 0, broken_backlinks: 0 }, { now: NOW })
    expect(zero.hasBacklinks).toBe(false)
    expect(zero.derived.backlinksPerDomain).toBeNull()
    expect(zero.derived.dofollowDomainsPercent).toBeNull()
    expect(zero.derived.subnetDiversity).toBeNull()
    expect(zero.derived.brokenBacklinksPercent).toBeNull()
  })

  test("nofollow larger than the total can never give a negative count", () => {
    expect(mapBacklinkSummary({ referring_domains: 5, referring_domains_nofollow: 9 }).derived.dofollowDomains).toBe(0)
  })

  test("nothing in, nothing out", () => {
    expect(mapBacklinkSummary(null)).toBeNull()
    expect(mapBacklinkSummary(undefined)).toBeNull()
  })
})

describe("breakdowns: sorted arrays of { key, label, count, percent }", () => {
  test("countries: Worldwide is labelled, names and flags come from the shared helper, top 10 KNOWN countries + Others (the unknown is NOT an entry)", () => {
    const c = live.breakdowns.countries
    expect(c.entries).toHaveLength(11)
    expect(c.entries.some((e) => e.key === "")).toBe(false)
    expect(c.entries.slice(0, 3).map((e) => [e.key, e.label])).toEqual([["IN", "India"], ["US", "United States"], ["WW", "Worldwide"]])
    expect(entry(c, "IN").flag).toBe("🇮🇳")
    expect(entry(c, "WW").flag).toBe("🌐")
    const sorted = c.entries.slice(0, 10).map((e) => e.count)
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a))
  })

  test("country shares are of the KNOWN links only: 13,590 links − 8,367 unknown = 5,223 (India 2,492 = 47.7%, not 18.3%); Worldwide counts as known", () => {
    const c = live.breakdowns.countries
    expect(c.knownBase).toBe(13590 - 8367)
    expect(entry(c, "IN").percent).toBeCloseTo((2492 / 5223) * 100, 9)
    expect(entry(c, "WW").percent).toBeCloseTo((872 / 5223) * 100, 9)
    expect(c.entries.reduce((s, e) => s + e.percent, 0)).toBeCloseTo(100, 6) // the known countries + Others add up to 100%
  })

  test("the unknown is reported on its own, as a share of ALL links (61.6%), so the untracked part is still visible", () => {
    const u = live.breakdowns.countries.unknown
    expect(u).toMatchObject({ key: "", label: "Unknown", count: 8367 })
    expect(u.percent).toBeCloseTo((8367 / 13590) * 100, 9)
    expect(describeUnknownCountries(live.breakdowns.countries)).toMatch(/^Unknown: 61\.6% of links/)
  })

  test("'Others' = KNOWN links − the top 10 (the countries the provider did not list), so every known link is accounted for", () => {
    const c = live.breakdowns.countries
    const others = c.entries.at(-1)
    expect(others).toMatchObject({ key: "__others__", label: "Others", isOthers: true })
    expect(c.entries.reduce((s, e) => s + e.count, 0)).toBe(13590 - 8367)
  })

  test("no unknown country: shares are of all links, and there is no unknown item; only unknown: nothing is known", () => {
    const none = mapBacklinkSummary({ ...REAL_LIVE, referring_links_countries: { IN: 30, US: 10 }, referring_pages: 40 }).breakdowns.countries
    expect(none.unknown).toBeNull()
    expect(none.entries.map((e) => [e.key, e.percent])).toEqual([["IN", 75], ["US", 25]])
    expect(describeUnknownCountries(none)).toBeNull()
    const onlyUnknown = mapBacklinkSummary({ ...REAL_LIVE, referring_links_countries: { "": 40 }, referring_pages: 40 }).breakdowns.countries
    expect(onlyUnknown.isEmpty).toBe(true)
    expect(onlyUnknown.unknown).toMatchObject({ count: 40, percent: 100 })
  })

  test("TLDs keep their dot, top 10 + Others; a ccTLD names its country in the tooltip, a generic one does not", () => {
    const t = live.breakdowns.tlds
    expect(t.entries.slice(0, 3).map((e) => e.label)).toEqual([".com", ".in", ".org"])
    expect(entry(t, "in").description).toBe("India country-code domain")
    expect(entry(t, "com").description).toBeNull()
    expect(t.entries).toHaveLength(11)
    expect(t.entries.at(-1).count).toBe(13590 - 11501)
  })

  test("link placement: the empty key is 'Not specified', labels are Title Case", () => {
    const s = live.breakdowns.semanticLocations
    expect(entry(s, "").label).toBe("Not specified")
    expect(entry(s, "article").label).toBe("Article")
    expect(entry(s, "footer").percent).toBeCloseTo((761 / 13590) * 100, 9)
    expect(s.entries.every((e) => !e.isOthers)).toBe(true) // 10 entries: nothing to fold
  })

  test("site types: 'unknown' is Unknown, hyphenated keys are Title Case ('Message Boards')", () => {
    const p = live.breakdowns.platformTypes
    expect(entry(p, "unknown").label).toBe("Unknown")
    expect(entry(p, "message-boards").label).toBe("Message Boards")
    expect(entry(p, "organization").label).toBe("Organization")
    expect(p.entries.some((e) => e.isOthers)).toBe(false)
  })

  test("link attributes: sorted descending, sponsored and ugc are highlighted and explained", () => {
    const a = live.breakdowns.attributes
    expect(a.entries.map((e) => e.key)).toEqual(["nofollow", "noopener", "noreferrer", "external", "ugc", "sponsored"])
    expect(entry(a, "sponsored")).toMatchObject({ highlight: true, count: 17 })
    expect(entry(a, "sponsored").description).toMatch(/paid/i)
    expect(entry(a, "ugc").description).toMatch(/user-generated/i)
    expect(entry(a, "ugc").label).toBe("UGC")
    expect(entry(a, "nofollow").highlight).toBeFalsy()
  })

  test("link types: friendly names", () => {
    expect(live.breakdowns.linkTypes.entries.map((e) => e.label)).toEqual(["Text Anchor", "Image", "Redirect"])
  })

  test("a breakdown the provider omitted (the real LOST response has no attributes) or sent empty is isEmpty, not an empty chart", () => {
    const lost = mapBacklinkSummary(REAL_LOST, { now: NOW })
    expect(lost.breakdowns.attributes).toMatchObject({ isEmpty: true, entries: [] })
    expect(lost.breakdowns.countries.isEmpty).toBe(false)
    expect(mapBacklinkSummary({ referring_links_tld: {} }).breakdowns.tlds.isEmpty).toBe(true)
  })

  test("all links: figures come from the response, nothing is carried over from live", () => {
    const all = mapBacklinkSummary(REAL_ALL, { now: NOW })
    expect(all.totals.backlinks).toBe(21529)
    expect(all.breakdowns.countries.base).toBe(16762)
  })

  test("buildBreakdown on its own: ties sort by key, junk counts are dropped, a missing base falls back to what was listed", () => {
    const b = buildBreakdown({ b: 5, a: 5, c: 10, bad: "x", n: null }, { kind: "type", base: null })
    expect(b.entries.map((e) => e.key)).toEqual(["c", "a", "b"])
    expect(b.entries[0].percent).toBe(50)
    expect(b.base).toBe(20)
    expect(buildBreakdown(null, { kind: "tld", base: 5 }).isEmpty).toBe(true)
  })

  test("buildBreakdown topN for a multi-valued breakdown folds only what was listed (no invented remainder)", () => {
    const obj = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, 12 - i]))
    const b = buildBreakdown(obj, { kind: "platform", base: 100, topN: 10, singleValued: false })
    expect(b.entries.at(-1)).toMatchObject({ isOthers: true, count: 2 + 1 })
    const single = buildBreakdown(obj, { kind: "country", base: 100, topN: 10 })
    expect(single.entries.at(-1).count).toBe(100 - (12 + 11 + 10 + 9 + 8 + 7 + 6 + 5 + 4 + 3))
  })

  test("titleCase", () => {
    expect(titleCase("message-boards")).toBe("Message Boards")
    expect(titleCase("organization")).toBe("Organization")
    expect(titleCase("a_b c")).toBe("A B C")
  })
})

describe("spam bands: 0–10 Low, 11–30 Medium, 31+ High", () => {
  test.each([[0, "Low"], [10, "Low"], [11, "Medium"], [17, "Medium"], [30, "Medium"], [31, "High"], [100, "High"]])("%i is %s", (score, label) => {
    expect(spamBand(score).label).toBe(label)
  })
  test("unknown has no band", () => {
    expect(spamBand(null)).toBeNull()
    expect(spamBand(undefined)).toBeNull()
  })
})

describe("profile age", () => {
  const at = (iso, now) => describeProfileAge(iso, new Date(now))
  test("years, months, and under a month", () => {
    expect(at("2019-03-19 06:16:01 +00:00", "2026-10-27T00:00:00Z").label).toBe("Since Mar 2019 (7 yrs)")
    expect(at("2025-10-01 00:00:00 +00:00", "2026-10-27T00:00:00Z").label).toBe("Since Oct 2025 (1 yr)")
    expect(at("2026-05-10 00:00:00 +00:00", "2026-10-27T00:00:00Z").label).toBe("Since May 2026 (5 mos)")
    expect(at("2026-10-20 00:00:00 +00:00", "2026-10-27T00:00:00Z").label).toBe("Since Oct 2026 (<1 mo)")
  })
  test("a month is only complete once the day of the month has passed", () => {
    expect(at("2025-10-28 00:00:00 +00:00", "2026-10-27T00:00:00Z").label).toBe("Since Oct 2025 (11 mos)")
  })
  test("an unreadable or missing date is null, not 'Invalid Date'", () => {
    for (const bad of [null, undefined, "", "not a date", 5]) expect(at(bad, "2026-10-27T00:00:00Z")).toEqual({ date: null, short: null, label: null, tooltip: null, months: null })
  })
})

describe("profile health: one row per automatic check, thresholds from one config object", () => {
  const byId = (m) => Object.fromEntries(m.health.map((h) => [h.id, h]))

  test("real live figures", () => {
    const h = byId(live)
    expect(h["broken-backlinks"]).toMatchObject({ level: "red", href: "/app/backlinks/list?broken=true", message: "1,643 backlinks point to broken URLs — fix with redirects." })
    expect(h["broken-pages"]).toMatchObject({ level: "red", href: "/app/backlinks/top-pages?status=error", message: "2,498 of your pages with links return errors." })
    expect(h.spam).toMatchObject({ level: "amber", message: "Spam score 17/100." })
    expect(h.dofollow.level).toBe("green")
    expect(h.subnets).toMatchObject({ level: "amber", message: "Many links come from the same networks." })
    expect(h.footer).toMatchObject({ level: "green", message: "5.6% of links are footer links." })
    expect(live.health.map((x) => x.id)).toEqual(["broken-backlinks", "broken-pages", "spam", "dofollow", "subnets", "footer"])
  })

  test("spam: 31+ red, 11–30 amber, else green", () => {
    const level = (score) => byId(mapBacklinkSummary({ ...REAL_LIVE, backlinks_spam_score: score }))["spam"].level
    expect([level(5), level(10), level(11), level(30), level(31), level(80)]).toEqual(["green", "green", "amber", "amber", "red", "red"])
  })

  test("dofollow below 50% is amber; subnet diversity below 30% is amber; footer above 30% is amber", () => {
    const m = (patch) => byId(mapBacklinkSummary({ ...REAL_LIVE, ...patch }))
    expect(m({ referring_domains_nofollow: 3000 }).dofollow).toMatchObject({ level: "amber", message: "Most linking domains are nofollow." })
    expect(m({ referring_subnets: 3000 }).subnets.level).toBe("green")
    expect(m({ referring_links_semantic_locations: { footer: 5000, article: 8590 } }).footer).toMatchObject({ level: "amber", message: "36.8% of links are footer links." })
  })

  test("a threshold is exclusive: exactly at the limit is still green", () => {
    const total = 1000
    const at = (footer) => byId(mapBacklinkSummary({ referring_pages: total, referring_links_semantic_locations: { footer } })).footer.level
    expect([at(300), at(301)]).toEqual(["green", "amber"])
    expect(PROFILE_HEALTH).toEqual({ spam: { low: 10, medium: 30 }, dofollowMinPercent: 50, subnetDiversityMinPercent: 30, footerMaxPercent: 30 })
  })

  test("clean profile: zero broken is green; missing data is 'unknown', never a guess", () => {
    const clean = byId(mapBacklinkSummary({ ...REAL_LIVE, broken_backlinks: 0, broken_pages: 0 }))
    expect([clean["broken-backlinks"].level, clean["broken-pages"].level]).toEqual(["green", "green"])
    expect(clean["broken-backlinks"].href).toBeNull()
    const none = byId(mapBacklinkSummary({}))
    expect(Object.values(none).every((h) => h.level === "unknown" && h.href === null)).toBe(true)
  })

  test("evaluateHealth reads the view model only", () => {
    expect(evaluateHealth(live)).toEqual(live.health)
  })
})

describe("site info", () => {
  test("CMS, server, IP, hosting country (flag + name) and site types", () => {
    expect(live.site).toEqual({
      cms: "Wordpress", server: "nginx", ipAddress: "13.205.194.193", country: { code: "IN", name: "India", flag: "🇮🇳", kind: "country" }, platformTypes: ["Cms", "Blogs", "Organization"],
    })
    expect(live.totals).toMatchObject({ crawledPages: REAL_LIVE.crawled_pages, internalLinks: REAL_LIVE.internal_links_count, externalLinks: REAL_LIVE.external_links_count })
  })
  test("missing info stays null / empty", () => {
    expect(mapBacklinkSummary({}).site).toEqual({ cms: null, server: null, ipAddress: null, country: null, platformTypes: [] })
  })
})

describe("lost links", () => {
  test("the lost date is read; the figures are the lost links'", () => {
    const lost = mapBacklinkSummary(REAL_LOST, { now: NOW })
    expect(lost.lostDate.toISOString().slice(0, 10)).toBe("2026-10-27")
    expect(lost.totals.backlinks).toBe(3186)
    expect(lost.rank).toBe(272)
  })
})
