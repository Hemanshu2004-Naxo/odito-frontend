import { describe, it, expect } from "vitest"
import { compareKeyedRows, formatDay, formatNumber, formatPercent, formatSigned, metricDelta, valueAt } from "./compare"

describe("metricDelta", () => {
  it("computes the absolute and percentage change when both sides are known", () => {
    expect(metricDelta(150, 100)).toEqual({ current: 150, previous: 100, abs: 50, pct: 50, known: true })
    expect(metricDelta(50, 100)).toMatchObject({ abs: -50, pct: -50 })
  })
  it("a real zero stays a zero and a change from zero has an absolute change but no percentage", () => {
    expect(metricDelta(0, 0)).toMatchObject({ abs: 0, pct: null, known: true })
    expect(metricDelta(10, 0)).toMatchObject({ abs: 10, pct: null, known: true })
  })
  it("an unknown side is unavailable - never treated as zero", () => {
    for (const [c, p] of [[null, 5], [5, null], [undefined, 5], [5, "x"], [NaN, 1]]) {
      expect(metricDelta(c, p)).toMatchObject({ abs: null, pct: null, known: false })
    }
  })
})

describe("valueAt", () => {
  it("reads a dotted path of a stored payload and gives null for anything missing", () => {
    expect(valueAt({ organic: { etv: 12 } }, "organic.etv")).toBe(12)
    expect(valueAt({ organic: null }, "organic.etv")).toBeNull()
    expect(valueAt(null, "a.b")).toBeNull()
    expect(valueAt({ a: "text" }, "a")).toBeNull()
  })
})

describe("compareKeyedRows", () => {
  const spec = { key: "domain", metrics: [{ id: "etv", get: (r) => r.total?.etv ?? null }] }
  it("finds new rows, gone rows and moved metrics (and ignores unchanged ones)", () => {
    const before = [{ domain: "a.com", total: { etv: 10 } }, { domain: "b.com", total: { etv: 20 } }, { domain: "gone.com", total: { etv: 1 } }]
    const now = [{ domain: "a.com", total: { etv: 10 } }, { domain: "b.com", total: { etv: 35 } }, { domain: "new.com", total: { etv: 5 } }]
    const r = compareKeyedRows(now, before, spec)
    expect(r.added.map((x) => x.domain)).toEqual(["new.com"])
    expect(r.removed.map((x) => x.domain)).toEqual(["gone.com"])
    expect(r.changed).toHaveLength(1)
    expect(r.changed[0].key).toBe("b.com")
    expect(r.changed[0].deltas.etv.abs).toBe(15)
  })
  it("a metric missing on one side is not a change", () => {
    const r = compareKeyedRows([{ domain: "a.com", total: { etv: 10 } }], [{ domain: "a.com", total: null }], spec)
    expect(r.changed).toEqual([])
  })
  it("empty or missing lists are fine", () => {
    expect(compareKeyedRows(undefined, undefined, spec)).toEqual({ added: [], removed: [], changed: [] })
  })
})

describe("formatting", () => {
  it("unknown values print as an em dash, known ones keep their sign", () => {
    expect(formatSigned(null)).toBe("—")
    expect(formatSigned(1234)).toBe("+1,234")
    expect(formatSigned(-5)).toBe("-5")
    expect(formatSigned(0)).toBe("0")
    expect(formatNumber(undefined)).toBe("—")
    expect(formatNumber(0)).toBe("0")
    expect(formatPercent(null)).toBe("—")
    expect(formatPercent(12.34)).toBe("+12%")
    expect(formatPercent(-3.25)).toBe("-3.3%")
  })
  it("dates are shown in UTC", () => {
    expect(formatDay("2026-11-04T23:30:00Z")).toBe("Nov 4, 2026")
    expect(formatDay(null)).toBe("—")
    expect(formatDay("nope")).toBe("—")
  })
})
