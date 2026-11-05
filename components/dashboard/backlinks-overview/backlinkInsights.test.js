import { describe, expect, test } from "vitest"
import { mapBacklinkSummary } from "./mapBacklinkSummary"
import { buildFixList, buildFollowRows, buildSourceView } from "./backlinkInsights"

const summary = (over) => mapBacklinkSummary({
  backlinks: 1000, referring_domains: 100, referring_domains_nofollow: 70, referring_pages: 500, referring_pages_nofollow: 100,
  referring_subnets: 80, broken_backlinks: 0, broken_pages: 0, backlinks_spam_score: 5,
  referring_links_semantic_locations: { footer: 200, article: 300 }, ...over,
}, { now: new Date("2026-11-03T00:00:00Z") })

describe("buildFixList", () => {
  test("low dofollow and many footer links become warnings; the clean checks are 'already good'", () => {
    const { fixes, good } = buildFixList(summary())
    expect(fixes.map((f) => [f.id, f.level])).toEqual([["dofollow", "warning"], ["footer", "warning"]])
    expect(fixes[0].title).toBe("Only 30.0% of linking sites give dofollow links")
    expect(fixes[1].title).toBe("40.0% of links sit in footers")
    expect(good.map((g) => g.text)).toEqual(["No backlinks point to broken pages", "Every linked page loads", "Low spam score (5/100)", "Links come from many networks (80.0%)"])
  })

  test("a high spam score is a problem and ranks above warnings; at most three cards", () => {
    const { fixes } = buildFixList(summary({ backlinks_spam_score: 60, broken_backlinks: 10 }))
    expect(fixes.map((f) => f.id)).toEqual(["spam", "broken-backlinks", "dofollow"])
    expect(fixes[0].level).toBe("problem")
  })

  test("unknown figures add neither a card nor a tick", () => {
    const { fixes, good } = buildFixList(mapBacklinkSummary({ backlinks: 10 }))
    expect(fixes).toEqual([])
    expect(good).toEqual([])
    expect(buildFixList(null)).toEqual({ fixes: [], good: [] })
  })
})

describe("buildFollowRows / buildSourceView", () => {
  test("follow rows need both counts; multi-valued views say their shares exceed 100%", () => {
    expect(buildFollowRows(summary()).map((r) => [r.id, r.dofollow, r.nofollow])).toEqual([["sites", 30, 70], ["pages", 400, 100]])
    expect(buildFollowRows(mapBacklinkSummary({ backlinks: 10 }))).toEqual([])
    const attrs = buildSourceView(summary({ referring_links_attributes: { nofollow: 300, ugc: 300 } }), "attributes")
    expect(attrs.rows.map((r) => [r.label, r.width])).toEqual([["Nofollow", 50], ["UGC", 50]])
    expect(attrs.note).toMatch(/several attributes, so the shares add up to more than 100%/)
    expect(buildSourceView(summary(), "tlds").rows).toEqual([])
  })
})
