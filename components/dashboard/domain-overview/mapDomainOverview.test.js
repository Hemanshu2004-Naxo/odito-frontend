import { describe, test, expect } from "vitest"
import { mapDomainOverview, mapPositionChange } from "./mapDomainOverview"
import {
  formatCompact, formatExact, formatUsdCompact, formatPercent1, formatDecimal1, formatMonthLabel, domainFromUrl, MISSING,
} from "./format"
import { allOk, ok, loading, failed, rankOverview, history, rankedKeywords, rankedKeyword, competitors, backlinks, organic, envelope } from "./testFixtures"

describe("formatting rules", () => {
  test("large numbers are compact, with the exact figure available", () => {
    expect(formatCompact(100412)).toBe("100.4K")
    expect(formatCompact(2561095)).toBe("2.6M")
    expect(formatCompact(850)).toBe("850")
    expect(formatCompact(0)).toBe("0")
    expect(formatExact(100411.93)).toBe("100,412")
    expect(formatExact(2561095)).toBe("2,561,095")
  })

  test("currency is USD and compact", () => {
    expect(formatUsdCompact(24520.31)).toBe("$24.5K")
    expect(formatUsdCompact(950.4)).toBe("$950")
    expect(formatUsdCompact(1_250_000)).toBe("$1.3M")
  })

  test("percentages and positions have one decimal; months are 'Oct 25'", () => {
    expect(formatPercent1(61.43)).toBe("61.4%")
    expect(formatPercent1(5)).toBe("5.0%")
    expect(formatDecimal1(12.786)).toBe("12.8")
    expect(formatMonthLabel(2025, 10)).toBe("Oct 25")
    expect(formatMonthLabel(2026, 1)).toBe("Jan 26")
  })

  test("null, undefined and junk are an em dash — never 0, NaN or undefined", () => {
    for (const bad of [null, undefined, NaN, Infinity, "5", {}]) {
      expect([formatCompact(bad), formatExact(bad), formatUsdCompact(bad), formatPercent1(bad), formatDecimal1(bad)]).toEqual(Array(5).fill(MISSING))
    }
    expect(formatMonthLabel(null, 3)).toBe(MISSING)
  })

  test("domainFromUrl strips protocol, www and path", () => {
    expect(domainFromUrl("https://www.asgeyehospital.com/hospital/x/")).toBe("asgeyehospital.com")
    expect(domainFromUrl("asgeyehospital.com")).toBe("asgeyehospital.com")
    for (const bad of [null, "", "   ", undefined]) expect(domainFromUrl(bad)).toBeNull()
  })
})

describe("mapDomainOverview: KPIs", () => {
  const vm = mapDomainOverview(allOk())

  test("headline figures come from their own sections", () => {
    expect(vm.hasRankingData).toBe(true)
    expect(vm.kpis.traffic).toBeCloseTo(100411.93, 1)
    expect(vm.kpis.keywords).toBe(4139)
    expect(vm.kpis.trafficValue).toBeCloseTo(24520.31, 1)
    expect(vm.kpis.domainRank).toBe(352)
    expect(vm.kpis.backlinks).toBe(18297)
    expect(vm.kpis.referringDomains).toBe(3949)
  })

  test("month-over-month change is against the month BEFORE the newest month of the history, and names it", () => {
    // history newest = Oct 2026, so the baseline is Sep 2026: 62,200.06 traffic / 3,571 keywords.
    expect(vm.kpis.trafficChange).toEqual({ percent: 61.4, direction: "up", basis: "vs Sep 26" })
    expect(vm.kpis.keywordsChange).toEqual({ percent: 15.9, direction: "up", basis: "vs Sep 26" })
  })

  test("a fall is 'down', no movement is 'flat'", () => {
    const down = mapDomainOverview({ ...allOk(), rankOverview: ok(rankOverview({ organic: organic({ etv: 50000, count: 3571 }) })) })
    expect(down.kpis.trafficChange.direction).toBe("down")
    expect(down.kpis.trafficChange.percent).toBe(-19.6)
    expect(down.kpis.keywordsChange).toEqual({ percent: 0, direction: "flat", basis: "vs Sep 26" })
  })

  test("a missing baseline month, a zero baseline or a failed history gives no percentage (and never a fake one)", () => {
    const gap = mapDomainOverview({ ...allOk(), history: ok(history([{ year: 2026, month: 10, etv: 1, count: 1 }, { year: 2026, month: 7, etv: 5, count: 5 }])) })
    expect(gap.kpis.trafficChange).toEqual({ percent: null, direction: null, basis: null })
    const zero = mapDomainOverview({ ...allOk(), history: ok(history([{ year: 2026, month: 10, etv: 9, count: 9 }, { year: 2026, month: 9, etv: 0, count: null }])) })
    expect(zero.kpis.trafficChange).toEqual({ percent: null, direction: null, basis: "vs Sep 26" })
    expect(zero.kpis.keywordsChange.percent).toBeNull()
    const noHistory = mapDomainOverview({ ...allOk(), history: failed() })
    expect(noHistory.kpis.trafficChange.percent).toBeNull()
    expect(noHistory.kpis.traffic).toBeCloseTo(100411.93, 1) // the headline does not depend on the history call
  })

  test("the history series is sorted oldest -> newest for the chart, with 'Oct 25'-style labels", () => {
    expect(vm.trend.map((p) => p.label)).toEqual(["Jul 26", "Aug 26", "Sep 26", "Oct 26"])
    expect(vm.trend.map((p) => p.key)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"])
    expect(vm.trend[0]).toMatchObject({ etv: 110566.79, count: 3758 })
    const crossYear = mapDomainOverview({ ...allOk(), history: ok(history([{ year: 2026, month: 1, etv: 1, count: 1 }, { year: 2025, month: 12, etv: 2, count: 2 }, { year: 2025, month: 11, etv: 3, count: 3 }])) })
    expect(crossYear.trend.map((p) => p.label)).toEqual(["Nov 25", "Dec 25", "Jan 26"])
  })

  test("paid figures appear only when something is paid", () => {
    expect(vm.paid).toBeNull()
    const paid = mapDomainOverview({ ...allOk(), rankOverview: ok(rankOverview({ paid: { etv: 1200.4, count: 0, estimated_paid_traffic_cost: 10 } })) })
    expect(paid.paid).toEqual({ traffic: 1200.4, keywords: 0 })
    expect(mapDomainOverview({ ...allOk(), rankOverview: ok(rankOverview({ paid: null })) }).paid).toBeNull()
  })
})

describe("mapDomainOverview: positions and movement", () => {
  const vm = mapDomainOverview(allOk())

  test("the six buckets sum the right provider fields", () => {
    expect(vm.positions.buckets.map((b) => [b.label, b.value])).toEqual([
      ["#1", 165],
      ["#2–3", 308],
      ["#4–10", 1037],
      ["#11–20", 1017],
      ["#21–50", 487 + 371 + 315],
      ["#51–100", 193 + 84 + 61 + 66 + 35],
    ])
  })

  test("Top 10 is #1 + #2–3 + #4–10 and its share of all keywords has one decimal", () => {
    expect(vm.positions.top10).toEqual({ count: 165 + 308 + 1037, percent: 36.5 }) // 1,510 / 4,139 = 36.48%
  })

  test("missing bucket inputs stay unknown instead of becoming 0", () => {
    const sparse = mapDomainOverview({ ...allOk(), rankOverview: ok(rankOverview({ organic: organic({ pos_1: null, pos_2_3: null, pos_4_10: null, pos_21_30: null, pos_31_40: 7, pos_41_50: null, count: null }) })) })
    expect(sparse.positions.buckets[0].value).toBeNull()
    expect(sparse.positions.buckets[4].value).toBe(7)
    expect(sparse.positions.top10).toBeNull()
  })

  test("movement is read from API 1 (is_lost included)", () => {
    expect(vm.movement).toEqual({ new: 2788, improved: 621, declined: 572, lost: 2423 })
  })

  test("a domain with no ranking data is flagged empty; so is one with zero keywords and traffic", () => {
    expect(mapDomainOverview({ ...allOk(), rankOverview: ok(envelope("rank-overview", { organic: null, paid: null })) }).hasRankingData).toBe(false)
    expect(mapDomainOverview({ ...allOk(), rankOverview: ok(rankOverview({ organic: organic({ etv: 0, count: 0 }) })) }).hasRankingData).toBe(false)
    expect(mapDomainOverview({ rankOverview: loading() }).hasRankingData).toBe(false)
  })
})

describe("mapDomainOverview: keywords and competitors", () => {
  const vm = mapDomainOverview(allOk())

  test("movement badges compare absolute rank to absolute rank, not rank_group", () => {
    // 'asg hospital': rank_group 1 but rank_absolute 4, no previous rank -> NEW.
    // 'eye hospital near me': was 8, now (absolute) 5 -> up 3. 'lasik cost': was 5, now 7 -> down 2. Unchanged -> same.
    expect(vm.topKeywords.rows.map((r) => [r.keyword, r.change])).toEqual([
      ["asg hospital", { kind: "new", amount: null }],
      ["eye hospital near me", { kind: "up", amount: 3 }],
      ["lasik cost", { kind: "down", amount: 2 }],
      ["asg eye hospital mysore", { kind: "same", amount: 0 }],
      ["cataract surgery", { kind: "unknown", amount: null }],
    ])
    expect(vm.topKeywords.rows[0].position).toBe(1) // the position SHOWN is still rank_group
  })

  test("a keyword whose rank group differs from its absolute rank is not given a fake move", () => {
    // group 1, absolute 4, previously absolute 4: it did not move.
    expect(mapPositionChange(rankedKeyword({ position: 1, position_absolute: 4, previous_position: 4 }))).toEqual({ kind: "same", amount: 0 })
    expect(mapPositionChange({ rank_changes_known: true, previous_position: 3, position_absolute: null })).toEqual({ kind: "unknown", amount: null })
    expect(mapPositionChange(undefined)).toEqual({ kind: "unknown", amount: null })
  })

  test("rows carry volume, KD, traffic and the full URL (built from the target)", () => {
    expect(vm.topKeywords.rows[1]).toMatchObject({ volume: 246000, difficulty: 22, path: "/hospital/kokane-chowk-pimpri-chinchwad/", url: "https://asgeyehospital.com/hospital/kokane-chowk-pimpri-chinchwad/" })
    expect(vm.topKeywords.rows[4]).toMatchObject({ volume: null, difficulty: null, traffic: null, path: null, url: null })
    expect(vm.topKeywords.totalCount).toBe(4139)
  })

  test("the keyword total falls back to API 3 when API 1 has not answered", () => {
    expect(mapDomainOverview({ rankedKeywords: ok(rankedKeywords()) }).topKeywords.totalCount).toBe(4139)
    expect(mapDomainOverview({}).topKeywords.totalCount).toBeNull()
  })

  test("competitor rows are display-ready", () => {
    expect(vm.competitors[0]).toEqual({ domain: "dragarwal.com", shared: 2423, avgPosition: 12.786628146925299, traffic: 328637.028294719 })
    expect(vm.competitors).toHaveLength(3)
  })
})

describe("mapDomainOverview: each section stands alone", () => {
  test("nothing loaded: every figure is null / empty, nothing throws", () => {
    const vm = mapDomainOverview({ rankOverview: loading(), history: loading(), rankedKeywords: loading(), competitors: loading(), backlinks: loading() })
    expect(Object.values(vm.kpis).filter((v) => v !== null && typeof v !== "object")).toEqual([])
    expect(vm.trend).toEqual([])
    expect(vm.topKeywords.rows).toEqual([])
    expect(vm.competitors).toEqual([])
    expect(vm.movement).toEqual({ new: null, improved: null, declined: null, lost: null })
    expect(() => mapDomainOverview()).not.toThrow()
  })

  test("a failed section blanks only its own figures", () => {
    const vm = mapDomainOverview({ ...allOk(), backlinks: failed(), competitors: failed() })
    expect(vm.kpis.domainRank).toBeNull()
    expect(vm.kpis.backlinks).toBeNull()
    expect(vm.competitors).toEqual([])
    expect(vm.kpis.traffic).toBeCloseTo(100411.93, 1)
    expect(vm.topKeywords.rows).toHaveLength(5)
  })
})
