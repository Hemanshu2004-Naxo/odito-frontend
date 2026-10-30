import { describe, test, expect } from "vitest"
import { competitorTotal, leader, mapCompetitor, mapCompetitorsPage, mapSelf, ratio, selfFromRankOverview, toCardRows } from "./mapCompetitor"
import { describeComparison } from "./summary"
import { REAL_COMPETITORS, REAL_COMPETITORS_TOTAL, REAL_SELF } from "./testFixtures"

const dragarwal = REAL_COMPETITORS.find((c) => c.domain === "dragarwal.com")
const OUR_KEYWORDS = 4139

describe("mapCompetitor: a real row (dragarwal.com against asgeyehospital.com)", () => {
  const row = mapCompetitor(dragarwal, { ourTotalKeywords: OUR_KEYWORDS })

  test("whole-site numbers are the COMPETITOR's, shared-keyword numbers are split into ours and theirs", () => {
    expect(row).toMatchObject({
      id: "dragarwal.com", domain: "dragarwal.com", sharedKeywords: 2423, avgPosition: 12.786628146925299,
      theirTotalKeywords: 10222, theirTotalTraffic: 328637.028294719, theirTrafficValue: 138179.48659965894,
    })
  })

  test("OURS = the project's numbers on the shared keywords, THEIRS = the competitor's (the spec's 'You 26K · Them 36.9K' and 'You 32 · Them 213')", () => {
    expect(row.ourSharedTraffic).toBe(26007.879283742077)
    expect(row.theirSharedTraffic).toBe(36882.67061826761)
    expect([row.ourTop1, row.theirTop1]).toEqual([32, 213])
    expect([row.ourTop2to3, row.theirTop2to3]).toEqual([151, 346])
    expect([row.ourTop4to10, row.theirTop4to10]).toEqual([643, 904])
  })

  test("who leads, and by how much", () => {
    expect(row.lead).toBe("them")
    expect(row.trafficRatio).toBeCloseTo(1.418, 3)
  })

  test("the shared bar is shared keywords ÷ the project's total keywords", () => {
    expect(row.sharedShare).toBeCloseTo((2423 / OUR_KEYWORDS) * 100, 6)
    expect(mapCompetitor(dragarwal, { ourTotalKeywords: null }).sharedShare).toBeNull()
    expect(mapCompetitor(dragarwal, { ourTotalKeywords: 0 }).sharedShare).toBeNull()
    expect(mapCompetitor(dragarwal, { ourTotalKeywords: 100 }).sharedShare).toBe(100) // never above 100%
  })
})

describe("mapCompetitor: missing data is null, never 0", () => {
  test("a row with nothing but a domain", () => {
    const row = mapCompetitor({ domain: "solo.com", intersections: null, avg_position: null, total: null, project_shared: null, competitor_shared: null })
    for (const [k, v] of Object.entries(row)) if (!["id", "domain"].includes(k)) expect(v, k).toBeNull()
  })

  test("garbage numbers are null", () => {
    const row = mapCompetitor({ domain: "x.com", intersections: NaN, avg_position: "12", total: { count: Infinity, etv: undefined }, project_shared: { etv: "5" }, competitor_shared: { etv: null } })
    expect(row.sharedKeywords).toBeNull()
    expect(row.avgPosition).toBeNull()
    expect(row.theirTotalKeywords).toBeNull()
    expect(row.lead).toBeNull()
  })

  test("ratio and leader", () => {
    expect(ratio(36, 24)).toBe(1.5)
    expect(ratio(10, 0)).toBeNull()
    expect(ratio(null, 5)).toBeNull()
    expect(ratio(5, null)).toBeNull()
    expect(leader(5, 5)).toBe("tie")
    expect(leader(6, 5)).toBe("us")
    expect(leader(0, 5)).toBe("them")
    expect(leader(null, 5)).toBeNull()
  })
})

describe("competitorTotal: the provider's total_count counts the project's own row", () => {
  test("a seen self row is subtracted", () => {
    expect(competitorTotal(18778, { selfSeen: true, filters: [] })).toBe(18777)
  })

  test("an unseen self row is still subtracted without an avg_position filter (it has the most shared keywords, so no intersections filter removes it)", () => {
    expect(competitorTotal(18778, { selfSeen: false, filters: [] })).toBe(18777)
    expect(competitorTotal(7, { selfSeen: false, filters: ["intersections", ">=", 200] })).toBe(6)
  })

  test("with an avg_position filter an unseen self row may have been filtered out, so nothing is subtracted", () => {
    expect(competitorTotal(7, { selfSeen: false, filters: ["avg_position", "<=", 5] })).toBe(7)
    expect(competitorTotal(7, { selfSeen: true, filters: [["avg_position", "<=", 5], "and", ["intersections", ">=", 2]] })).toBe(6)
  })

  test("zero stays zero (nothing matched), unknown stays unknown, and it never goes negative", () => {
    expect(competitorTotal(0, { selfSeen: true, filters: [] })).toBe(0)
    expect(competitorTotal(null, { selfSeen: false, filters: [] })).toBeNull()
    expect(competitorTotal(undefined, { selfSeen: false, filters: [] })).toBeNull()
    expect(competitorTotal(1, { selfSeen: true, filters: [] })).toBe(0)
  })
})

describe("mapCompetitorsPage", () => {
  const envelope = { result: { totalCount: REAL_COMPETITORS_TOTAL, self: REAL_SELF, items: REAL_COMPETITORS }, query: { offset: 0 } }
  const request = { limit: 50, offset: 0, order_by: "intersections,desc", filters: [], exclude_top_domains: true, max_rank_group: 100 }

  test("rows exclude the project; the project is returned separately with its own totals", () => {
    const page = mapCompetitorsPage(envelope, { request })
    expect(page.rows).toHaveLength(49)
    expect(page.rows.some((r) => r.domain === "asgeyehospital.com")).toBe(false)
    expect(page.self).toEqual({ domain: "asgeyehospital.com", sharedKeywords: 4139, totalKeywords: 4139, totalTraffic: 100411.929526025, trafficValue: 24520.310160559413 })
    expect(page.total).toBe(18777)
  })

  test("the shared bar uses the project's own row when the page has it, else what the caller knows", () => {
    const withSelf = mapCompetitorsPage(envelope, { request, ourTotalKeywords: 99999 })
    expect(withSelf.rows[0].sharedShare).toBeCloseTo((2423 / 4139) * 100, 6)
    const noSelf = mapCompetitorsPage({ result: { ...envelope.result, self: null } }, { request, ourTotalKeywords: 4139 })
    expect(noSelf.rows[0].sharedShare).toBeCloseTo((2423 / 4139) * 100, 6)
    expect(noSelf.self).toBeNull()
  })

  test("nothing yet / nothing found", () => {
    expect(mapCompetitorsPage(null)).toEqual({ rows: [], self: null, total: null, offset: 0 })
    const none = mapCompetitorsPage({ result: { totalCount: 0, self: null, items: [] } }, { request: { ...request, offset: 50 } })
    expect(none).toMatchObject({ rows: [], total: 0, offset: 50 })
  })

  test("offset follows the request (the table's 'Showing x–y')", () => {
    expect(mapCompetitorsPage(envelope, { request: { ...request, offset: 100 } }).offset).toBe(100)
  })

  test("the dashboard card takes the first five rows in the card's own shape", () => {
    const rows = toCardRows(mapCompetitorsPage(envelope, { request }), 5)
    expect(rows).toHaveLength(5)
    expect(rows[0]).toEqual({ domain: "dragarwal.com", shared: 2423, avgPosition: 12.786628146925299, traffic: 328637.028294719 })
  })
})

describe("the project's own row", () => {
  test("mapSelf", () => {
    expect(mapSelf(null)).toBeNull()
    expect(mapSelf({ intersections: 3 })).toBeNull()
    expect(mapSelf({ domain: "a.com", intersections: 5, total: null })).toEqual({ domain: "a.com", sharedKeywords: 5, totalKeywords: null, totalTraffic: null, trafficValue: null })
  })

  test("selfFromRankOverview repeats the real row's totals (4139 / 100,411.9 both ways)", () => {
    const fromOverview = selfFromRankOverview({ organic: { count: 4139, etv: 100411.929526025, estimated_paid_traffic_cost: 24520.310160559413 } }, "asgeyehospital.com")
    expect(fromOverview).toEqual(mapSelf(REAL_SELF))
    // "Top 10 only": the keywords ranking in the top 10 — 1510, the number the provider's own row had with max_rank_group 10
    const overview = { organic: { count: 4139, etv: 100411.929526025, estimated_paid_traffic_cost: 24520.31, pos_1: 165, pos_2_3: 308, pos_4_10: 1037 } }
    expect(selfFromRankOverview(overview, "asgeyehospital.com", 10)).toMatchObject({ sharedKeywords: 1510, totalKeywords: 4139, totalTraffic: 100411.929526025 })
    expect(selfFromRankOverview({ organic: { count: 4139, pos_1: 165 } }, "a.com", 10)).toBeNull() // not guessed when a bucket is missing
    expect(selfFromRankOverview({ organic: null }, "a.com")).toBeNull()
    expect(selfFromRankOverview(null, "a.com")).toBeNull()
    expect(selfFromRankOverview({ organic: { count: 5 } }, null)).toBeNull()
  })
})

describe("describeComparison: one honest sentence", () => {
  const base = { domain: "dragarwal.com", sharedKeywords: 2423, ourSharedTraffic: 26007.88, theirSharedTraffic: 36882.67 }

  test("they lead: '1.4× your traffic' (the spec's example)", () => {
    expect(describeComparison(base)).toBe("dragarwal.com gets 1.4× your traffic on the 2,423 keywords you share.")
  })

  test("we lead", () => {
    expect(describeComparison({ ...base, ourSharedTraffic: 36882.67, theirSharedTraffic: 26007.88 })).toBe("You get 1.4× dragarwal.com's traffic on the 2,423 keywords you share.")
  })

  test("a tie, a zero on one side (no 'Infinity×'), and unknown numbers", () => {
    expect(describeComparison({ ...base, ourSharedTraffic: 5, theirSharedTraffic: 5 })).toBe("dragarwal.com and you get the same traffic on the 2,423 keywords you share.")
    expect(describeComparison({ ...base, ourSharedTraffic: 0 })).toBe("dragarwal.com gets traffic on the 2,423 keywords you share; you get none.")
    expect(describeComparison({ ...base, theirSharedTraffic: 0 })).toBe("You get traffic on the 2,423 keywords you share; dragarwal.com gets none.")
    expect(describeComparison({ ...base, theirSharedTraffic: null })).toMatch(/isn't available/)
    expect(describeComparison({ ...base, sharedKeywords: 1 })).toContain("the 1 keyword you share")
    expect(describeComparison({ ...base, sharedKeywords: null })).toContain("the keywords you share")
  })
})
