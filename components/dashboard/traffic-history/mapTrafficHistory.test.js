import { describe, test, expect } from "vitest"
import { mapTrafficHistory, buildDistribution, buildMovement, distributionBuckets, sortRows, RANGE_OPTIONS } from "./mapTrafficHistory"
import { REAL_ITEMS, OLDER_ITEMS, envelope } from "./testFixtures"
import { buildTrafficHistoryCsv, trafficHistoryCsvFileName } from "./exportCsv"

// Expected figures below were derived independently from the 13 real months (plain arithmetic on the raw items).
const real = () => mapTrafficHistory(envelope(REAL_ITEMS, 12), { months: 12 })
const month = (items, y, m, o = {}) => ({ ...items.find((i) => i.year === y && i.month === m), ...o })

describe("mapTrafficHistory: sorting and rows", () => {
  const vm = real()

  test("months are sorted ONCE, oldest -> newest, even though the provider sends them newest first", () => {
    expect(REAL_ITEMS[0].month).toBe(10) // newest first on the wire
    expect(vm.range.map((r) => r.key)).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"])
    expect(vm.tableRows.map((r) => r.key)).toEqual([...vm.range].reverse().map((r) => r.key)) // the table starts with the newest
  })

  test("labels: 'Oct 25' for axes, 'October 2025' for tooltips", () => {
    expect(vm.range[0]).toMatchObject({ label: "Oct 25", longLabel: "October 2025" })
    expect(vm.range[12]).toMatchObject({ label: "Oct 26", longLabel: "October 2026" })
  })

  test("a row carries its figures, bucket totals and movement", () => {
    const oct26 = vm.range[12]
    expect(oct26).toMatchObject({ traffic: 100942.3, keywords: 4166, value: 25111.32, top10: 163 + 316 + 1043 })
    expect(oct26.buckets).toEqual({ top1: 163, top3: 316, top10: 1043, top20: 1031, top50: 1176, top100: 437 })
    expect(oct26.bucketTotal).toBe(4166) // the six buckets add up to the month's keywords
    expect(oct26.movement).toMatchObject({ new: 2806 })
    expect(Object.keys(oct26.movement)).toEqual(["new", "up", "down", "lost"])
  })

  test("month-over-month: (this − previous) / previous × 100, vs the previous CALENDAR month", () => {
    const pct = (key) => vm.range.find((r) => r.key === key).mom.traffic
    expect(pct("2025-11")).toEqual({ percent: -24.7, direction: "down" })
    expect(pct("2026-01")).toEqual({ percent: 23.1, direction: "up" })
    expect(pct("2026-08")).toEqual({ percent: -31.1, direction: "down" })
    expect(pct("2026-10")).toEqual({ percent: 62.3, direction: "up" })
  })

  test("the oldest month of the data has no change (—), not 0", () => {
    expect(vm.range[0].mom.traffic).toEqual({ percent: null, direction: null })
    expect(vm.range[0].mom.keywords.percent).toBeNull()
  })

  test("a previous month of 0 gives no percentage; a gap in the series gives no change across the gap", () => {
    const items = [month(REAL_ITEMS, 2026, 10), month(REAL_ITEMS, 2026, 9, { etv: 0 }), month(REAL_ITEMS, 2026, 7)]
    const r = mapTrafficHistory(envelope(items), { months: 12 }).range
    expect(r.map((x) => x.key)).toEqual(["2026-07", "2026-09", "2026-10"])
    expect(r[1].mom.traffic.percent).toBeNull() // Aug is missing: Sep vs Jul would be a two-month change
    expect(r[2].mom.traffic.percent).toBeNull() // previous month's traffic is 0
    expect(r[2].mom.keywords.percent).not.toBeNull()
  })

  test("a repeated month keeps only the later entry", () => {
    const r = mapTrafficHistory(envelope([month(REAL_ITEMS, 2026, 10), month(REAL_ITEMS, 2026, 9), month(REAL_ITEMS, 2026, 9, { etv: 1 })]), { months: 12 }).range
    expect(r).toHaveLength(2)
    expect(r[0].traffic).toBe(1)
  })
})

describe("mapTrafficHistory: the selected range", () => {
  test("N months = the latest month and the N before it (12 -> 13 points)", () => {
    expect(real().range).toHaveLength(13)
    const six = mapTrafficHistory(envelope(REAL_ITEMS), { months: 6 })
    expect(six.range.map((r) => r.key)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"])
    expect(six.availableMonths).toBe(7)
  })

  test("24 months over a 24-month response; 6 and 12 slice the SAME response without refetching", () => {
    const env = envelope([...REAL_ITEMS, ...OLDER_ITEMS], 24)
    expect(mapTrafficHistory(env, { months: 24 }).range).toHaveLength(25)
    expect(mapTrafficHistory(env, { months: 12 }).range).toHaveLength(13)
    expect(mapTrafficHistory(env, { months: 6 }).range).toHaveLength(7)
    expect(mapTrafficHistory(env, { months: 12 }).range[0].key).toBe("2025-10")
  })

  test("a longer range than the data has just returns what exists", () => {
    expect(mapTrafficHistory(envelope(REAL_ITEMS), { months: 24 }).range).toHaveLength(13)
  })

  test("slicing keeps the true month-over-month of the range's oldest month when an earlier month was fetched", () => {
    const env = envelope([...REAL_ITEMS, ...OLDER_ITEMS], 24)
    const first12 = mapTrafficHistory(env, { months: 12 }).range[0]
    expect(first12.key).toBe("2025-10")
    expect(first12.mom.traffic.percent).not.toBeNull() // Sep 2025 is in the response
    expect(mapTrafficHistory(env, { months: 24 }).range[0].mom.traffic.percent).toBeNull() // the first month of ALL the data
  })

  test("the default range is 12 and the options are 6 / 12 / 24", () => {
    expect(RANGE_OPTIONS).toEqual([6, 12, 24])
    expect(mapTrafficHistory(envelope(REAL_ITEMS)).range).toHaveLength(13)
  })
})

describe("mapTrafficHistory: summary cards (latest month vs the first month of the range, plus the peak)", () => {
  const { summary } = real()

  test("traffic: 100,942 now vs 195,799 at the start = −48.4%, peak Oct 25", () => {
    expect(summary.traffic.latest).toBe(100942.3)
    expect(summary.traffic.change).toEqual({ percent: -48.4, direction: "down", basis: "vs Oct 25" })
    expect(summary.traffic.peak).toEqual({ value: 195799.37, label: "Oct 25" })
  })

  test("keywords, traffic value and top 10", () => {
    expect(summary.keywords.change.percent).toBe(-71.1)
    expect(summary.keywords.peak).toEqual({ value: 16589, label: "Feb 26" })
    expect(summary.value.latest).toBe(25111.32)
    expect(summary.value.change.percent).toBe(-60.3)
    expect(summary.value.peak.label).toBe("Oct 25")
    expect(summary.top10.latest).toBe(1522)
    expect(summary.top10.change).toEqual({ percent: 20.6, direction: "up", basis: "vs Oct 25" })
    expect(summary.top10.peak).toEqual({ value: 1526, label: "Jan 26" })
  })

  test("the comparison follows the selected range", () => {
    const six = mapTrafficHistory(envelope(REAL_ITEMS), { months: 6 }).summary
    expect(six.traffic.change).toEqual({ percent: -31.2, direction: "down", basis: "vs Apr 26" })
    expect(six.traffic.peak).toEqual({ value: 166640.93, label: "May 26" }) // the peak is of the RANGE (Apr–Oct 26), not of all the data (Oct 25)
  })

  test("a zero or unknown starting point gives no percentage; an unknown latest value shows as null", () => {
    const zeroStart = mapTrafficHistory(envelope([month(REAL_ITEMS, 2026, 10), month(REAL_ITEMS, 2026, 9, { etv: 0 })]), { months: 12 }).summary
    expect(zeroStart.traffic.change.percent).toBeNull()
    const noLatest = mapTrafficHistory(envelope([month(REAL_ITEMS, 2026, 10, { etv: null, count: null }), month(REAL_ITEMS, 2026, 9)]), { months: 12 }).summary
    expect(noLatest.traffic.latest).toBeNull()
    expect(noLatest.traffic.change.percent).toBeNull()
    expect(noLatest.traffic.peak.value).toBe(month(REAL_ITEMS, 2026, 9).etv)
  })
})

describe("mapTrafficHistory: biggest drop, paid data and not-enough-history", () => {
  test("the biggest month-over-month traffic fall is marked: Aug 2026, −31.1%", () => {
    expect(real().biggestDrop).toEqual({ key: "2026-08", label: "Aug 26", percent: -31.1 })
  })

  test("no fall in the range = nothing to mark", () => {
    const rising = [month(REAL_ITEMS, 2026, 10, { etv: 300 }), month(REAL_ITEMS, 2026, 9, { etv: 200 }), month(REAL_ITEMS, 2026, 8, { etv: 100 })]
    expect(mapTrafficHistory(envelope(rising), { months: 12 }).biggestDrop).toBeNull()
  })

  test("paid data is hidden unless some month in the range has paid traffic", () => {
    expect(real().hasPaid).toBe(false)
    const withPaid = REAL_ITEMS.map((i) => (i.month === 8 && i.year === 2026 ? { ...i, paid: { etv: 120, count: 4, estimated_paid_traffic_cost: 10 } } : i))
    expect(mapTrafficHistory(envelope(withPaid), { months: 12 }).hasPaid).toBe(true)
    expect(mapTrafficHistory(envelope(withPaid), { months: 6 }).hasPaid).toBe(true)
    // paid traffic outside the selected range does not count
    const oldPaid = REAL_ITEMS.map((i) => (i.month === 11 && i.year === 2025 ? { ...i, paid: { etv: 50, count: 1, estimated_paid_traffic_cost: 5 } } : i))
    expect(mapTrafficHistory(envelope(oldPaid), { months: 6 }).hasPaid).toBe(false)
    // null paid blocks and null etv are not "paid data"
    expect(mapTrafficHistory(envelope(REAL_ITEMS.map((i) => ({ ...i, paid: null }))), { months: 12 }).hasPaid).toBe(false)
  })

  test("fewer than 2 months is not enough history", () => {
    expect(mapTrafficHistory(null).hasEnoughHistory).toBe(false)
    expect(mapTrafficHistory(envelope([])).hasEnoughHistory).toBe(false)
    expect(mapTrafficHistory(envelope([month(REAL_ITEMS, 2026, 10)])).hasEnoughHistory).toBe(false)
    expect(mapTrafficHistory(envelope([month(REAL_ITEMS, 2026, 10), month(REAL_ITEMS, 2026, 9)])).hasEnoughHistory).toBe(true)
  })

  test("nothing loaded gives an empty, safe view model", () => {
    for (const input of [null, undefined, envelope([]), { result: null }]) {
      const vm = mapTrafficHistory(input)
      expect(vm.range).toEqual([])
      expect(vm.tableRows).toEqual([])
      expect(vm.biggestDrop).toBeNull()
      expect(vm.summary.traffic.latest).toBeNull()
      expect(vm.summary.traffic.peak).toEqual({ value: null, label: null })
    }
  })

  test("a month the provider sent no metrics for stays in the series as nulls, never zeros", () => {
    const gap = { year: 2026, month: 9, etv: null, count: null, estimated_paid_traffic_cost: null, pos_1: null, paid: null }
    const r = mapTrafficHistory(envelope([month(REAL_ITEMS, 2026, 10), gap]), { months: 12 }).range
    expect(r[0]).toMatchObject({ traffic: null, keywords: null, value: null, top10: null, bucketTotal: null })
    expect(r[0].buckets.top1).toBeNull()
    expect(r[0].movement.new).toBeNull()
  })
})

describe("distribution chart data", () => {
  const range = real().range

  test("counts: one datum per month with each bucket's count", () => {
    const d = buildDistribution(range, { percent: false, top20Only: false })
    expect(d).toHaveLength(13)
    expect(d[12]).toMatchObject({ label: "Oct 26", top1: 163, top3: 316, top10: 1043, top20: 1031, top50: 1176, top100: 437, total: 4166 })
  })

  test("%: each bucket's share of that month's total across all six buckets", () => {
    const d = buildDistribution(range, { percent: true, top20Only: false })
    expect(d[12].top1).toBeCloseTo((163 / 4166) * 100, 6) // 3.9126%
    const sum = ["top1", "top3", "top10", "top20", "top50", "top100"].reduce((s, k) => s + d[12][k], 0)
    expect(sum).toBeCloseTo(100, 6)
    expect(d[12].top1__count).toBe(163) // the count stays available for the tooltip
  })

  test("Top 20 only keeps just #1 … #11–20, and % is still a share of the WHOLE month (not rescaled to 100)", () => {
    expect(distributionBuckets(true).map((b) => b.key)).toEqual(["top1", "top3", "top10", "top20"])
    expect(distributionBuckets(false)).toHaveLength(6)
    const d = buildDistribution(range, { percent: true, top20Only: true })
    expect(Object.keys(d[12]).filter((k) => /^top\d+$/.test(k))).toEqual(["top1", "top3", "top10", "top20"])
    const sum = ["top1", "top3", "top10", "top20"].reduce((s, k) => s + d[12][k], 0)
    expect(sum).toBeCloseTo(((163 + 316 + 1043 + 1031) / 4166) * 100, 6)
    expect(sum).toBeLessThan(100)
  })

  test("a month with no bucket data is a gap (null) in both modes, and a zero total gives no percentage", () => {
    const gap = { ...range[0], bucketTotal: null, buckets: Object.fromEntries(Object.keys(range[0].buckets).map((k) => [k, null])) }
    for (const percent of [false, true]) expect(buildDistribution([gap], { percent })[0].top1).toBeNull()
    const zero = { ...range[0], bucketTotal: 0, buckets: Object.fromEntries(Object.keys(range[0].buckets).map((k) => [k, 0])) }
    expect(buildDistribution([zero], { percent: true })[0].top1).toBeNull()
    expect(buildDistribution([zero], { percent: false })[0].top1).toBe(0)
  })
})

describe("movement chart data", () => {
  test("New and Improved are positive, Declined and Lost are negative (below the zero line); unknown stays null", () => {
    const d = buildMovement(real().range)
    expect(d[12]).toMatchObject({ label: "Oct 26", new: 2806 })
    expect(d[12].up).toBeGreaterThan(0)
    expect(d[12].down).toBeLessThan(0)
    expect(d[12].lost).toBeLessThan(0)
    const r = real().range[12]
    expect(d[12].down).toBe(-r.movement.down)
    const gap = buildMovement([{ ...r, movement: { new: null, up: null, down: null, lost: null } }])[0]
    expect([gap.new, gap.up, gap.down, gap.lost]).toEqual([null, null, null, null])
  })
})

describe("table sorting", () => {
  const rows = real().tableRows

  test("by month: newest first descending, oldest first ascending", () => {
    expect(sortRows(rows, "month", "desc")[0].key).toBe("2026-10")
    expect(sortRows(rows, "month", "asc")[0].key).toBe("2025-10")
  })

  test("by a numeric column, both directions", () => {
    expect(sortRows(rows, "traffic", "desc")[0].key).toBe("2025-10") // 195,799
    expect(sortRows(rows, "traffic", "asc")[0].key).toBe("2026-09") // 62,200
    expect(sortRows(rows, "keywords", "desc")[0].key).toBe("2026-02")
    expect(sortRows(rows, "trafficChange", "asc")[0].key).toBe("2026-08") // −31.1%
    expect(sortRows(rows, "trafficChange", "desc")[0].key).toBe("2026-10") // +62.3%
    expect(sortRows(rows, "top1", "desc")).toHaveLength(13)
  })

  test("unknown values sort LAST in both directions (a gap is never the biggest or the smallest)", () => {
    const withGap = rows.map((r) => (r.key === "2026-03" ? { ...r, traffic: null } : r))
    expect(sortRows(withGap, "traffic", "desc").at(-1).key).toBe("2026-03")
    expect(sortRows(withGap, "traffic", "asc").at(-1).key).toBe("2026-03")
    // the oldest month has no change: it goes last when sorting by change
    expect(sortRows(rows, "trafficChange", "desc").at(-1).key).toBe("2025-10")
    expect(sortRows(rows, "trafficChange", "asc").at(-1).key).toBe("2025-10")
  })

  test("sorting never mutates its input and an unknown column falls back to month", () => {
    const copy = [...rows]
    sortRows(rows, "traffic", "asc")
    expect(rows).toEqual(copy)
    expect(sortRows(rows, "nope", "desc")[0].key).toBe("2026-10")
  })
})

describe("CSV", () => {
  const rows = real().tableRows

  test("header and one line per month, exact numbers, in the order given", () => {
    const lines = buildTrafficHistoryCsv(rows).split("\r\n")
    expect(lines[0]).toBe("Month,Est. traffic,Traffic change %,Keywords,Keywords change %,Traffic value (USD),#1,#2–3,#4–10,#11–20,New,Up,Down,Lost")
    expect(lines).toHaveLength(14)
    expect(lines[1]).toMatch(/^2026-10,100942,62\.3,4166,/)
    expect(lines[1]).toContain(",25111.32,163,316,1043,1031,2806,")
    expect(lines.at(-1)).toMatch(/^2025-10,195799,,14435,,63215\.06,/) // the oldest month has no change: an empty cell
  })

  test("a missing figure is an empty cell, never 0 / NaN / undefined", () => {
    const gap = { ...rows[0], traffic: null, keywords: null, value: null, buckets: { top1: null, top3: null, top10: null, top20: null }, movement: { new: null, up: null, down: null, lost: null }, mom: { traffic: { percent: null }, keywords: { percent: null } } }
    expect(buildTrafficHistoryCsv([gap]).split("\r\n")[1]).toBe("2026-10,,,,,,,,,,,,,")
    expect(buildTrafficHistoryCsv([])).toBe(buildTrafficHistoryCsv([]).split("\r\n")[0])
  })

  test("the file name carries the domain and the range", () => {
    expect(trafficHistoryCsvFileName("asgeyehospital.com", 12)).toBe("traffic-history_asgeyehospital.com_12-months.csv")
    expect(trafficHistoryCsvFileName("A B/../x", 24)).toBe("traffic-history_a-b-..-x_24-months.csv")
    expect(trafficHistoryCsvFileName(null, 6)).toBe("traffic-history_domain_6-months.csv")
  })
})
