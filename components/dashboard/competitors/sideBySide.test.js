import { describe, expect, test } from "vitest"
import { buildHeadToHead, buildSideBySide, buildStats, formatGap, formatTimes, positionNote, relativeCaption, shortName } from "./sideBySide"

describe("captions and names", () => {
  test("relative captions: times above 1.5×, a plain difference below it, and honest unknowns", () => {
    expect(relativeCaption(354, 60100)).toBe("170× yours")
    expect(relativeCaption(101, 508)).toBe("5.0× yours")
    expect(relativeCaption(195, 200)).toBe("+5 more than you")
    expect(relativeCaption(200, 195)).toBe("5 fewer than you")
    expect(relativeCaption(101, 3)).toBe("34× less than you")
    expect(relativeCaption(5, 5)).toBe("Same as you")
    expect(relativeCaption(1, 0)).toBe("They have 0")
    expect(relativeCaption(0, 4)).toBe("You have 0")
    expect(relativeCaption(1, null)).toBe("Not known yet")
    expect(relativeCaption(null, 4)).toBe("Yours is not known")
  })
  test("short names drop the generic words; a domain stays as it is", () => {
    expect(shortName("Gleneagles Hospital")).toBe("Gleneagles")
    expect(shortName("Idealake Information Technologies")).toBe("Idealake")
    expect(shortName("K. B. Haji Bachooali Eye & ENT")).toBe("K. B. Haji Bachooali")
    expect(shortName("kem.edu")).toBe("kem.edu")
    expect(shortName("Eye Hospital")).toBe("Eye Hospital") // nothing would be left
  })
  test("formatting", () => {
    expect(formatTimes(3.71)).toBe("3.7×")
    expect(formatTimes(170.4)).toBe("170×")
    expect(formatGap(946)).toBe("+946")
    expect(formatGap(25300)).toBe("+25.3K")
    expect(positionNote(6, 3)).toBe("3 above you")
    expect(positionNote(6, 14)).toBe("8 below you")
    expect(positionNote(6, null)).toBeNull()
  })
})

describe("buildSideBySide / buildStats", () => {
  const c = (id, name, m) => ({ id, name, domain: `${id}.com`, enrichment: { metrics: m } })
  test("an unknown figure is never best and never a win; zero everywhere has no best", () => {
    const grid = buildSideBySide({ organicTraffic: 10, rankingKeywords: null, pos1: 0, referringDomains: 5 }, [c("a", "A", { organicTraffic: null, rankingKeywords: 7, pos1: 0, referringDomains: 5 })])
    const best = (key) => grid.rows.find((r) => r.key === key).cells.map((x) => x.best)
    expect(best("organicTraffic")).toEqual([true, false])
    expect(best("rankingKeywords")).toEqual([false, true])
    expect(best("pos1")).toEqual([false, false])
    expect(best("referringDomains")).toEqual([true, true]) // a tie: both are best
    expect(grid.sites.map((s) => s.wins)).toEqual([2, 2])
  })
  test("without anyone ahead on traffic there is no 'closest to beat'", () => {
    const grid = buildSideBySide({ organicTraffic: 1000 }, [c("a", "A", { organicTraffic: 10 })])
    expect(buildStats(grid.sites).closest).toBeNull()
  })
})

describe("buildHeadToHead", () => {
  test("keywords shared with the most competitors first, ties count for every site, missing positions are null", () => {
    const lists = [
      { siteId: "a", keywords: [{ keyword: "x", searchVolume: 10, project: { position: 4 }, competitor: { position: 2 } }, { keyword: "y", searchVolume: 999, project: { position: 9 }, competitor: { position: 9 } }] },
      { siteId: "b", keywords: [{ keyword: "x", searchVolume: 10, project: { position: 4 }, competitor: { position: 2 } }] },
    ]
    const h = buildHeadToHead(lists, ["a", "b"], 1)
    expect(h.rows.map((r) => r.keyword)).toEqual(["x"])
    expect(h.rows[0].cells.map((c) => [c.siteId, c.position, c.best])).toEqual([["you", 4, false], ["a", 2, true], ["b", 2, true]])
    expect(h.wins).toEqual({ you: 0, a: 1, b: 1 })
    const all = buildHeadToHead(lists, ["a", "b"])
    expect(all.rows.find((r) => r.keyword === "y").cells.map((c) => c.position)).toEqual([9, 9, null])
  })
})
