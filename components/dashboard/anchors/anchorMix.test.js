import { describe, expect, test } from "vitest"
import { anchorVerdict, buildCloud, buildMixAdvice, buildMixRows, buildSpamSummary, cloudSize, verdictFor } from "./anchorMix"

const summary = (shares) => ({
  totals: { referringDomains: 100 },
  types: Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, { percentByReferringDomains: v }])),
  classified: [{ type: "other", rd: 9, row: { anchor: "best eye hospital in Mumbai" } }],
})

describe("verdicts and the mix rows", () => {
  test("below, inside and above the typical range", () => {
    expect(verdictFor("branded", 1.5)).toBe("too_low")
    expect(verdictFor("branded", 30)).toBe("ok")
    expect(verdictFor("naked_url", 92.7)).toBe("too_high")
    expect(verdictFor("unknown", 5)).toBeNull()
    expect(verdictFor("branded", null)).toBeNull()
  })

  test("rows are biggest first, with examples from the project's own terms; unknown shares are left out", () => {
    const rows = buildMixRows(summary({ naked_url: 92.7, other: 5, branded: 1.5, empty: 0.6, generic: 0.2, exact: 0, partial: null }), { domain: "krishnaeyecentre.com", brandTerms: ["Krishna Eye Centre"], targetKeywords: ["cataract surgery"] })
    expect(rows.map((r) => [r.label, r.percent, r.verdict])).toEqual([
      ["Naked URL", 92.7, "too_high"], ["Phrases", 5, "too_low"], ["Branded", 1.5, "too_low"], ["Empty / image", 0.6, "too_low"], ["Generic", 0.2, "too_low"], ["Keyword match", 0, "too_low"],
    ])
    expect(rows.map((r) => r.example)).toEqual(["e.g. krishnaeyecentre.com", "e.g. best eye hospital in Mumbai", "e.g. Krishna Eye Centre", "Image links with no alt text", "e.g. click here, website", "Exact service words, e.g. cataract surgery"])
    expect(buildMixRows(null)).toEqual([])
  })

  test("advice: the type furthest above its range, the spam caveat, and the brand ask", () => {
    const rows = buildMixRows(summary({ naked_url: 92.7, branded: 1.5, other: 5 }))
    expect(buildMixAdvice(rows, { brand: "Krishna Eye Centre", spam: { count: 2 } })).toBe("Naked URL anchors are 92.7% of your mix, above the typical 15–30%. Part of this comes from spammy sites; once those are disavowed your real mix will look different. Ask partners and directories to link with “Krishna Eye Centre”.")
    expect(buildMixAdvice(buildMixRows(summary({ branded: 30, naked_url: 20, other: 30 })))).toBeNull()
  })
})

describe("spam, cloud and verdict", () => {
  const rows = [
    { id: "a", anchor: "Premium SEO links", referringDomains: 2700, spamScore: 54, type: "naked_url" },
    { id: "b", anchor: "Krishna Eye Centre", referringDomains: 3, spamScore: 2, type: "branded" },
    { id: "c", anchor: null, isEmpty: true, referringDomains: 19, spamScore: 0, type: "empty" },
  ]
  test("spam summary counts the anchors above the threshold and their linking sites", () => {
    expect(buildSpamSummary(rows)).toMatchObject({ count: 1, sites: 2700, title: "1 spammy anchor from 2.7K linking sites", example: "Premium SEO links" })
    expect(buildSpamSummary([rows[1]])).toBeNull()
  })
  test("cloud: biggest first, filtered by type, spam or search (the empty anchor is found by its label)", () => {
    expect(buildCloud(rows).items.map((i) => i.row.id)).toEqual(["a", "c", "b"])
    expect(buildCloud(rows, { type: "spam" }).items.map((i) => i.row.id)).toEqual(["a"])
    expect(buildCloud(rows, { type: "branded" }).total).toBe(1)
    expect(buildCloud(rows, { query: "image" }).items.map((i) => i.row.id)).toEqual(["c"])
    expect(cloudSize(2700, 2700)).toBe(30)
    expect(cloudSize(1, 2700)).toBe(14)
  })
  test("verdict: spam first, then by type", () => {
    expect(anchorVerdict(rows[0])).toMatchObject({ tone: "bad", action: "disavow" })
    expect(anchorVerdict(rows[1])).toMatchObject({ tone: "good", action: "backlinks" })
    expect(anchorVerdict({ type: "exact" }).tone).toBe("warn")
  })
})
