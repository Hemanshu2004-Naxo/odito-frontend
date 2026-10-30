import { describe, test, expect } from "vitest"
import { kdBand, mapKeywordsPage, mapMonthlySearches, mapRankedKeyword, mapSummary, parseProviderTime, resultTypeTag, serpFeatureList } from "./mapRankedKeyword"
import { REAL_METRICS, REAL_ROWS, TARGET, pageEnvelope } from "./testFixtures"

const byKeyword = (k) => REAL_ROWS.find((r) => r.keyword === k)
const ctx = { target: TARGET, domainTraffic: REAL_METRICS.etv }

describe("mapRankedKeyword (real asgeyehospital.com rows)", () => {
  test("a NEW keyword: position, NEW change, intent, KD band, URL, Google link", () => {
    const r = mapRankedKeyword(byKeyword("asg hospital"), ctx)
    expect(r).toMatchObject({
      keyword: "asg hospital", position: 1, change: { kind: "new", amount: null }, volume: 74000, difficulty: 0, cpc: 0.25999999046325684,
      path: "/", url: "https://www.asgeyehospital.com/", resultType: null,
    })
    expect(r.intent).toMatchObject({ value: "navigational", letter: "N", label: "Navigational" })
    expect(r.kdBand.key).toBe("easy")
    expect(r.googleUrl).toMatch(/^https:\/\/www\.google\.com\/search\?q=asg%20hospital/)
  })

  test("movement is measured absolute-to-absolute, so an improved row shows an up arrow with the right amount", () => {
    const raw = byKeyword("right eye blinking for female")
    const r = mapRankedKeyword(raw, ctx)
    expect(r.change).toEqual({ kind: "up", amount: raw.previous_position - raw.position_absolute })
    expect(r.change.amount).toBeGreaterThan(0)
  })

  test("a declined row shows a down arrow; an unchanged row shows nothing", () => {
    const down = byKeyword("eye doctor ranchi")
    expect(mapRankedKeyword(down, ctx).change).toEqual({ kind: "down", amount: down.position_absolute - down.previous_position })
    expect(mapRankedKeyword(byKeyword("asg eye hospital mysore"), ctx).change).toEqual({ kind: "same", amount: 0 })
  })

  test("the provider's own is_up / is_down / is_new flags agree with the badge on every real row", () => {
    for (const raw of REAL_ROWS) {
      const kind = mapRankedKeyword(raw, ctx).change.kind
      const flag = raw.is_new ? "new" : raw.is_up ? "up" : raw.is_down ? "down" : "same"
      expect(kind, raw.keyword).toBe(flag)
    }
  })

  test("a missing CPC is null (shown as —), never 0", () => {
    const r = mapRankedKeyword(byKeyword("asg eye hospital hajipur"), ctx)
    expect(r.cpc).toBeNull()
  })

  test("share of the domain's traffic is the row's traffic over the whole domain's", () => {
    const raw = byKeyword("asg hospital")
    const r = mapRankedKeyword(raw, ctx)
    expect(r.trafficShare).toBeCloseTo((raw.etv / REAL_METRICS.etv) * 100, 6)
    expect(mapRankedKeyword(raw, { target: TARGET }).trafficShare).toBeNull()
    expect(mapRankedKeyword(raw, { target: TARGET, domainTraffic: 0 }).trafficShare).toBeNull()
  })

  test("monthly searches are oldest -> newest with readable month labels", () => {
    const r = mapRankedKeyword(byKeyword("right eye blinking for female"), ctx)
    expect(r.monthly).toHaveLength(12)
    expect(r.monthly.map((m) => m.year * 12 + m.month)).toEqual([...r.monthly.map((m) => m.year * 12 + m.month)].sort((a, b) => a - b))
    expect(r.monthly[0].label).toMatch(/^[A-Z][a-z]{2} \d{2}$/)
  })

  test("SERP features: known ones in priority order, 'organic' never listed", () => {
    const r = mapRankedKeyword(byKeyword("asg"), ctx)
    expect(r.serpFeatures.length).toBeGreaterThanOrEqual(5)
    expect(r.serpFeatures.some((f) => f.key === "organic")).toBe(false)
    expect(r.serpFeatures.every((f) => typeof f.label === "string" && f.label)).toBe(true)
  })

  test("a URL is made from the path and the project's domain when the provider sent none; an unsafe URL is dropped", () => {
    const base = byKeyword("asg hospital")
    expect(mapRankedKeyword({ ...base, url: null, relative_url: "/lasik/" }, ctx).url).toBe("https://asgeyehospital.com/lasik/")
    expect(mapRankedKeyword({ ...base, url: "javascript:alert(1)", relative_url: "/x/" }, ctx).url).toBe("https://asgeyehospital.com/x/")
    expect(mapRankedKeyword({ ...base, check_url: "javascript:alert(1)" }, ctx).googleUrl).toBeNull()
    expect(mapRankedKeyword({ ...base, url: null, relative_url: null }, ctx).url).toBeNull()
  })

  test("a row with almost nothing keeps every figure null / empty", () => {
    const r = mapRankedKeyword({ keyword: "k", rank_changes_known: false }, ctx)
    expect(r).toMatchObject({ position: null, volume: null, difficulty: null, kdBand: null, cpc: null, intent: null, traffic: null, trafficShare: null, path: null, url: null, googleUrl: null, change: { kind: "unknown" } })
    expect(r.monthly).toEqual([])
    expect(r.serpFeatures).toEqual([])
    expect(r.lastUpdated).toBeNull()
  })
})

describe("helpers", () => {
  test("KD bands: 0–29 easy, 30–49 moderate, 50–69 difficult, 70+ hard, unknown is null", () => {
    expect([0, 29, 30, 49, 50, 69, 70, 100].map((n) => kdBand(n).key)).toEqual(["easy", "easy", "moderate", "moderate", "difficult", "difficult", "hard", "hard"])
    expect(kdBand(null)).toBeNull()
    expect(kdBand(undefined)).toBeNull()
    expect(kdBand(0).dot).toMatch(/emerald/)
    expect(kdBand(35).dot).toMatch(/yellow/)
    expect(kdBand(55).dot).toMatch(/orange/)
    expect(kdBand(80).dot).toMatch(/red/)
  })

  test("non-organic result types get a tag; organic and missing do not; an unknown type is made readable", () => {
    expect(resultTypeTag("featured_snippet")).toEqual({ type: "featured_snippet", label: "Snippet" })
    expect(resultTypeTag("local_pack").label).toBe("Local pack")
    expect(resultTypeTag("organic")).toBeNull()
    expect(resultTypeTag(null)).toBeNull()
    expect(resultTypeTag("some_new_type").label).toBe("Some new type")
  })

  test("serpFeatureList orders known features, appends unknown ones, tolerates junk", () => {
    expect(serpFeatureList(["people_also_ask", "organic", "ai_overview", "brand_new_thing"]).map((f) => f.key)).toEqual(["ai_overview", "people_also_ask", "brand_new_thing"])
    expect(serpFeatureList(null)).toEqual([])
  })

  test("mapMonthlySearches sorts, keeps gaps as null and drops entries without a month", () => {
    const out = mapMonthlySearches([{ year: 2026, month: 3, search_volume: 5 }, { year: 2026, month: 1, search_volume: null }, { year: null, month: 2, search_volume: 9 }])
    expect(out.map((m) => [m.month, m.volume])).toEqual([[1, null], [3, 5]])
    expect(mapMonthlySearches(undefined)).toEqual([])
  })

  test("parseProviderTime reads the provider's format as UTC", () => {
    expect(parseProviderTime("2026-09-12 21:43:14 +00:00").toISOString()).toBe("2026-09-12T21:43:14.000Z")
    expect(parseProviderTime("nonsense")).toBeNull()
    expect(parseProviderTime(null)).toBeNull()
  })
})

describe("mapSummary: the five cards from UNFILTERED totals (real asgeyehospital.com)", () => {
  test("total, top 3 (#1 + #2–3), top 10 (+ #4–10), traffic and movement", () => {
    expect(mapSummary(REAL_METRICS)).toEqual({ total: 4139, top3: 165 + 308, top10: 165 + 308 + 1037, traffic: REAL_METRICS.etv, movement: { added: 2788, up: 621, down: 572 } })
  })

  test("no metrics: every figure is null (shown as —), not 0", () => {
    expect(mapSummary(null)).toEqual({ total: null, top3: null, top10: null, traffic: null, movement: { added: null, up: null, down: null } })
    expect(mapSummary(undefined).total).toBeNull()
  })
})

describe("mapKeywordsPage", () => {
  test("total_count is the number of keywords matching the filters, not the rows on the page", () => {
    const out = mapKeywordsPage(pageEnvelope(REAL_ROWS.slice(0, 3), { total: 2464 }), { domainTraffic: REAL_METRICS.etv })
    expect(out.total).toBe(2464)
    expect(out.rows).toHaveLength(3)
    expect(out.rows[0].trafficShare).not.toBeNull()
  })

  test("a page with no rows and a total of 0 is a real empty result; a missing envelope is unknown", () => {
    expect(mapKeywordsPage(pageEnvelope([], { total: 0 }))).toEqual({ total: 0, rows: [] })
    expect(mapKeywordsPage(null)).toEqual({ total: null, rows: [] })
  })
})
