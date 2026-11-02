import { describe, expect, it } from "vitest"
import { compareMetric, compareToYou, formatRatio, sortByLead } from "./compareToYou"

const YOU = { organicTraffic: 4200, rankingKeywords: 900, pos1: 12, referringDomains: 300 }

describe("compareMetric", () => {
  it("says who leads, by how many times and by how much", () => {
    expect(compareMetric(100, 800)).toEqual({ lead: "them", ratio: 8, diff: 700, you: 100, them: 800 })
    expect(compareMetric(800, 100)).toMatchObject({ lead: "you", ratio: 8, diff: 700 })
    expect(compareMetric(5, 5)).toMatchObject({ lead: "level", diff: 0 })
  })
  it("never compares an unknown: null is not a zero", () => {
    for (const [a, b] of [[null, 5], [5, null], [undefined, 5], [NaN, 5], ["5", 5]]) expect(compareMetric(a, b).lead).toBe("unknown")
  })
  it("a real zero IS compared (and has no ratio)", () => {
    expect(compareMetric(0, 50)).toMatchObject({ lead: "them", ratio: null, diff: 50 })
    expect(compareMetric(0, 0).lead).toBe("level")
  })
})

describe("compareToYou", () => {
  it("ahead: they lead on most known metrics", () => {
    const r = compareToYou(YOU, { organicTraffic: 89500, rankingKeywords: 3600, pos1: 1, referringDomains: 1292 })
    expect(r).toMatchObject({ verdict: "ahead", themLeads: 3, youLead: 1, known: 4 })
  })
  it("behind: you lead on most", () => {
    expect(compareToYou(YOU, { organicTraffic: 109, rankingKeywords: 3, pos1: 0, referringDomains: 3 })).toMatchObject({ verdict: "behind", youLead: 4, themLeads: 0 })
  })
  it("a tie on count is decided by organic traffic, then level", () => {
    expect(compareToYou(YOU, { organicTraffic: 9000, rankingKeywords: 100, pos1: 30, referringDomains: 300 }).verdict).toBe("ahead")
    expect(compareToYou(YOU, { organicTraffic: 100, rankingKeywords: 2000, pos1: 2, referringDomains: 300 }).verdict).toBe("behind")
    expect(compareToYou(YOU, YOU).verdict).toBe("level")
  })
  it("unknown values are left out, and with nothing comparable the verdict is unknown", () => {
    const r = compareToYou(YOU, { organicTraffic: 50000, rankingKeywords: null, pos1: null, referringDomains: null })
    expect(r).toMatchObject({ verdict: "ahead", known: 1 })
    expect(compareToYou(YOU, {}).verdict).toBe("unknown")
    expect(compareToYou(null, { organicTraffic: 5 }).verdict).toBe("unknown")
    expect(compareToYou({ organicTraffic: null }, { organicTraffic: 5 }).known).toBe(0)
  })
})

describe("formatRatio / sortByLead", () => {
  it("formats how many times larger", () => {
    expect(formatRatio(8)).toBe("8x")
    expect(formatRatio(1.34)).toBe("1.3x")
    expect(formatRatio(21.4)).toBe("21x")
    expect(formatRatio(250.2)).toBe("250x")
    expect(formatRatio(null)).toBeNull()
  })
  it("with the same count, the bigger traffic gap comes first (and, behind you, the smaller gap comes first)", () => {
    const m = (t) => ({ organicTraffic: t, rankingKeywords: 5000, pos1: 99, referringDomains: 9999 })
    const items = [{ id: "170x", m: m(170 * 4200) }, { id: "253x", m: m(253 * 4200) }]
    expect(sortByLead(items, (i) => compareToYou(YOU, i.m)).map((i) => i.id)).toEqual(["253x", "170x"])
    const weak = (t) => ({ organicTraffic: t, rankingKeywords: 1, pos1: 0, referringDomains: 1 })
    const behind = [{ id: "tiny", m: weak(10) }, { id: "almost", m: weak(4000) }]
    expect(sortByLead(behind, (i) => compareToYou(YOU, i.m)).map((i) => i.id)).toEqual(["almost", "tiny"])
  })
  it("puts the competitors furthest ahead first and the unknowns last", () => {
    const items = [
      { id: "behind", m: { organicTraffic: 10, rankingKeywords: 1, pos1: 0, referringDomains: 1 } },
      { id: "unknown", m: {} },
      { id: "ahead", m: { organicTraffic: 99999, rankingKeywords: 9999, pos1: 99, referringDomains: 9999 } },
    ]
    expect(sortByLead(items, (i) => compareToYou(YOU, i.m)).map((i) => i.id)).toEqual(["ahead", "behind", "unknown"])
  })
})
