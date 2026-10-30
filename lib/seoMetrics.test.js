import { describe, test, expect } from "vitest"
import { POSITION_BUCKETS, bucketValues, sumKnown, top10Count, percentChange, changeDirection, monthIndex, isNum } from "./seoMetrics"

const metrics = (o = {}) => ({
  pos_1: 163, pos_2_3: 316, pos_4_10: 1043, pos_11_20: 1031, pos_21_30: 491, pos_31_40: 371, pos_41_50: 314,
  pos_51_60: 193, pos_61_70: 84, pos_71_80: 60, pos_81_90: 65, pos_91_100: 35, ...o,
})

describe("position buckets (one grouping for the whole app)", () => {
  test("six buckets, in rank order, with the agreed labels", () => {
    expect(POSITION_BUCKETS.map((b) => [b.key, b.label])).toEqual([
      ["top1", "#1"], ["top3", "#2–3"], ["top10", "#4–10"], ["top20", "#11–20"], ["top50", "#21–50"], ["top100", "#51–100"],
    ])
  })

  test("#21–50 and #51–100 add up the right provider fields", () => {
    const v = Object.fromEntries(bucketValues(metrics()).map((b) => [b.key, b.value]))
    expect(v).toEqual({ top1: 163, top3: 316, top10: 1043, top20: 1031, top50: 491 + 371 + 314, top100: 193 + 84 + 60 + 65 + 35 })
  })

  test("a bucket the provider did not report is null, not 0; a half-reported bucket sums what exists", () => {
    const v = Object.fromEntries(bucketValues(metrics({ pos_1: null, pos_21_30: null, pos_31_40: 7, pos_41_50: undefined })).map((b) => [b.key, b.value]))
    expect(v.top1).toBeNull()
    expect(v.top50).toBe(7)
    expect(bucketValues(null).every((b) => b.value === null)).toBe(true)
    expect(bucketValues(undefined)).toHaveLength(6)
  })

  test("the fields are frozen so no page can reshuffle them", () => {
    expect(Object.isFrozen(POSITION_BUCKETS)).toBe(true)
  })
})

describe("top 10 and sums", () => {
  test("top 10 = #1 + #2–3 + #4–10", () => {
    expect(top10Count(metrics())).toBe(163 + 316 + 1043)
    expect(top10Count(metrics({ pos_1: null }))).toBe(316 + 1043)
    expect(top10Count(metrics({ pos_1: null, pos_2_3: null, pos_4_10: null }))).toBeNull()
    expect(top10Count(null)).toBeNull()
  })

  test("sumKnown ignores unknowns and returns null when nothing is known", () => {
    expect(sumKnown([1, null, 2, undefined, NaN, "3"])).toBe(3)
    expect(sumKnown([])).toBeNull()
    expect(sumKnown([null, undefined])).toBeNull()
    expect(sumKnown([0, null])).toBe(0) // a real zero is a zero
  })

  test("isNum rejects everything that is not a finite number", () => {
    for (const bad of [null, undefined, NaN, Infinity, "1", {}, []]) expect(isNum(bad)).toBe(false)
    expect(isNum(0)).toBe(true)
  })
})

describe("percentChange: (current − previous) / previous × 100, one decimal", () => {
  test("rises, falls and rounding", () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(100942.3, 62200.06)).toBe(62.3)
    expect(percentChange(76203.98, 110566.79)).toBe(-31.1)
    expect(percentChange(100, 100)).toBe(0)
    expect(percentChange(1, 3)).toBe(-66.7)
  })

  test("a previous value of 0, or any unknown, has no percentage (never Infinity / NaN)", () => {
    expect(percentChange(10, 0)).toBeNull()
    expect(percentChange(0, 0)).toBeNull()
    for (const [a, b] of [[null, 5], [5, null], [undefined, 5], [NaN, 5], [5, NaN], ["5", 5]]) expect(percentChange(a, b)).toBeNull()
  })

  test("going to zero is a 100% fall (the previous was real)", () => {
    expect(percentChange(0, 50)).toBe(-100)
  })

  test("direction", () => {
    expect(changeDirection(0.1)).toBe("up")
    expect(changeDirection(-0.1)).toBe("down")
    expect(changeDirection(0)).toBe("flat")
    expect(changeDirection(null)).toBeNull()
    expect(changeDirection(NaN)).toBeNull()
  })
})

describe("monthIndex", () => {
  test("consecutive months differ by one, across a year boundary", () => {
    expect(monthIndex(2026, 1) - monthIndex(2025, 12)).toBe(1)
    expect(monthIndex(2026, 10) - monthIndex(2025, 10)).toBe(12)
    expect(monthIndex(2026, 3) - monthIndex(2026, 1)).toBe(2)
  })
})
