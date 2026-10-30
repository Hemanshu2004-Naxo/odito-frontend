import { describe, expect, test } from "vitest"
import { ANCHOR_HEALTH, TYPE_KEYS } from "./anchorConfig"
import { evaluateAnchorHealth, summariseAnchorProfile } from "./summariseAnchorProfile"

const settings = { brandTerms: ["asg"], targetKeywords: ["lasik surgery"] }
const opts = { targetDomain: "asgeyehospital.com" }
const row = (anchor, referringDomains, backlinks = referringDomains, spamScore = 0) => ({ anchor, referringDomains, backlinks, spamScore })

describe("summariseAnchorProfile", () => {
  const rows = [row("ASG Eye Hospital", 40, 80), row("lasik surgery", 10, 10), row("Lasik Surgery in Pune", 10, 12), row("asgeyehospital.com", 20, 25), row("click here", 5, 5), row(null, 10, 30), row("Pune", 5, 5)]
  const s = summariseAnchorProfile(rows, settings, opts)

  test("sums anchors, backlinks and referring domains per type, and has every type even when it is empty", () => {
    expect(Object.keys(s.types)).toEqual([...TYPE_KEYS])
    expect(s.types.branded).toMatchObject({ anchors: 1, backlinks: 80, referringDomains: 40 })
    expect(s.types.exact).toMatchObject({ anchors: 1, referringDomains: 10 })
    expect(s.types.partial).toMatchObject({ anchors: 1, referringDomains: 10, backlinks: 12 })
    expect(s.types.naked_url).toMatchObject({ anchors: 1, referringDomains: 20 })
    expect(s.types.generic.referringDomains).toBe(5)
    expect(s.types.empty).toMatchObject({ anchors: 1, backlinks: 30, referringDomains: 10 })
    expect(s.types.other.referringDomains).toBe(5)
    expect(s.totals).toEqual({ anchors: 7, backlinks: 167, referringDomains: 100 })
  })

  test("the shares of referring domains add up to 100%; so do the shares of backlinks", () => {
    const sum = (k) => Object.values(s.types).reduce((a, t) => a + t[k], 0)
    expect(sum("percentByReferringDomains")).toBeCloseTo(100, 9)
    expect(sum("percentByBacklinks")).toBeCloseTo(100, 9)
    expect(s.types.branded.percentByReferringDomains).toBe(40)
    expect(s.types.exact.percentByReferringDomains).toBe(10)
  })

  test("the top anchor is the one with the most referring domains, with its share of all referring domains", () => {
    expect(s.topAnchor).toMatchObject({ anchor: "ASG Eye Hospital", type: "branded", referringDomains: 40, percent: 40 })
  })

  test("a known total of distinct referring domains replaces the sum as the denominator for one anchor's share", () => {
    const withTotal = summariseAnchorProfile(rows, settings, { ...opts, totalReferringDomains: 400 })
    expect(withTotal.topAnchor.percent).toBe(10)
    expect(withTotal.types.branded.percentByReferringDomains).toBe(40) // the distribution stays a share of the anchors
  })

  test("a share never passes 100%", () => {
    expect(summariseAnchorProfile([row("x", 50)], settings, { ...opts, totalReferringDomains: 10 }).topAnchor.percent).toBe(100)
  })

  test("the empty anchor can be the top anchor and is labelled", () => {
    const t = summariseAnchorProfile([row(null, 99), row("a", 1)], settings, opts).topAnchor
    expect(t).toMatchObject({ anchor: null, label: "(empty / image link)", type: "empty" })
  })

  test("a tie goes to the anchor with more backlinks", () => {
    expect(summariseAnchorProfile([row("a", 5, 5), row("b", 5, 50)], settings, opts).topAnchor.anchor).toBe("b")
  })

  test("it reclassifies when the settings change — nothing else is needed", () => {
    const before = summariseAnchorProfile(rows, { brandTerms: [], targetKeywords: [] }, opts)
    expect(before.types.branded.anchors).toBe(0)
    expect(before.types.exact.anchors).toBe(0)
    expect(before.types.other.anchors).toBeGreaterThan(s.types.other.anchors)
    const after = summariseAnchorProfile(rows, { brandTerms: ["asg"], targetKeywords: ["lasik surgery", "pune"] }, opts)
    expect(after.types.exact.anchors).toBe(2)
  })

  test("no rows, no data: nothing is invented", () => {
    const e = summariseAnchorProfile([], settings, opts)
    expect(e.totals).toEqual({ anchors: 0, backlinks: 0, referringDomains: 0 })
    expect(e.topAnchor).toBeNull()
    expect(e.types.branded.percentByReferringDomains).toBeNull()
    expect(summariseAnchorProfile(undefined, settings, opts).totals.anchors).toBe(0)
  })

  test("missing counts count as zero in the sums but never produce NaN", () => {
    const m = summariseAnchorProfile([row("a", null, null), { anchor: "b", referringDomains: 4 }], settings, opts)
    expect(m.totals).toEqual({ anchors: 2, backlinks: 0, referringDomains: 4 })
    expect(JSON.stringify(m)).not.toMatch(/NaN|null.*undefined/)
  })
})

describe("evaluateAnchorHealth", () => {
  const health = (rows, s = settings, o = opts) => evaluateAnchorHealth(summariseAnchorProfile(rows, s, o))
  const ids = (checks) => checks.map((c) => c.id)

  test("a brand-led profile is green: 'Anchor profile looks natural.'", () => {
    const checks = health([row("ASG Eye Hospital", 50), row("asgeyehospital.com", 12), row("https://asgeyehospital.com/", 12), row("www.asgeyehospital.com", 6), row("Pune", 10), row("lasik surgery", 4), row("eye care", 6)])
    expect(checks).toEqual([{ id: "natural", status: "ok", message: "Anchor profile looks natural." }])
  })

  test("exact share above 10% -> amber, exactly at 10% is fine", () => {
    const over = health([row("ASG", 60), row("lasik surgery", 11), row("Pune", 29)])
    expect(over.find((c) => c.id === "exact")).toEqual({ id: "exact", status: "warn", message: "High share of exact-match anchors can look manipulative." })
    expect(ids(health([row("ASG", 60), row("lasik surgery", 10), row("Pune", 30)]))).not.toContain("exact")
  })

  test("branded + naked URL below 30% -> amber; at 30% it is fine", () => {
    const low = health([row("ASG", 20), row("Pune", 40), row("Delhi", 40)])
    expect(low.find((c) => c.id === "brand").message).toBe("Few branded anchors — natural profiles are usually brand-heavy.")
    expect(ids(health([row("ASG", 15), row("asgeyehospital.com", 15), row("Pune", 35), row("Delhi", 35)]))).not.toContain("brand")
  })

  test("one non-branded anchor above 15% of referring domains is 'heavily repeated'; a branded one is not", () => {
    const rep = health([row("ASG", 40), row("Best clinic", 30), row("x", 20)])
    expect(rep.find((c) => c.id === "repeated").message).toBe("“Best clinic” is heavily repeated (+1 more).")
    expect(health([row("ASG", 40), row("Best clinic", 20), row("x", 10), row("y", 10), row("z", 10), row("w", 10)]).find((c) => c.id === "repeated").message).toBe("“Best clinic” is heavily repeated.")
    expect(ids(health([row("ASG one", 80), row("a", 5), row("b", 5), row("c", 5), row("d", 5)]))).not.toContain("repeated")
  })

  test("the repeated-anchor check uses the share of ALL distinct referring domains when it is known", () => {
    const rows = [row("ASG", 60), row("Best clinic", 30), row("x", 10)]
    expect(ids(health(rows))).toContain("repeated")
    expect(ids(health(rows, settings, { ...opts, totalReferringDomains: 1000 }))).not.toContain("repeated")
  })

  test("the empty anchor is never called 'repeated'", () => {
    expect(ids(health([row("ASG", 10), row(null, 90)]))).not.toContain("repeated")
  })

  test("spammy anchors (score above 30) carrying more than 10% of backlinks -> red; at exactly 10% or score 30 it is fine", () => {
    const bad = health([row("ASG", 50, 90, 5), row("junk", 5, 11, 31)])
    expect(bad.find((c) => c.id === "spam")).toEqual({ id: "spam", status: "bad", message: "Spammy anchors detected." })
    expect(ids(health([row("ASG", 50, 90, 5), row("junk", 5, 10, 31)]))).not.toContain("spam")
    expect(ids(health([row("ASG", 50, 50, 5), row("junk", 5, 50, 30)]))).not.toContain("spam")
  })

  test("an unknown spam score is not treated as spam", () => {
    expect(ids(health([row("ASG", 50, 50, null), row("junk", 5, 500, undefined)]))).not.toContain("spam")
  })

  test("anchors from ONE site with 50+ links are 'sitewide/footer'; 49 links or 2 sites are not", () => {
    const rows = [row("ASG", 50), row("footer link", 1, 50), row("also footer", 1, 900), row("small", 1, 49), row("two sites", 2, 500)]
    const c = health(rows).find((x) => x.id === "sitewide")
    expect(c.message).toBe("2 anchors come from a single site with many links (sitewide/footer links).")
    expect(health([row("ASG", 50), row("footer link", 1, 50)]).find((x) => x.id === "sitewide").message).toBe("1 anchor comes from a single site with many links (sitewide/footer links).")
    expect(ids(health([row("ASG", 50), row("small", 1, 49)]))).not.toContain("sitewide")
  })

  test("several problems are all listed, in a fixed order, and 'natural' is not among them", () => {
    const rows = [row("junk exact", 30, 100, 80), row("lasik surgery", 30, 100, 80), row("x", 40, 100, 80)]
    const c = health(rows)
    expect(ids(c)).toEqual(["exact", "brand", "repeated", "spam"])
    expect(ids(c)).not.toContain("natural")
  })

  test("no data -> no checks (nothing is judged from an empty profile)", () => {
    expect(health([])).toEqual([])
  })

  test("the thresholds come from ONE config object and can be changed", () => {
    const rows = [row("ASG", 60), row("lasik surgery", 11), row("Pune", 29)]
    expect(ids(evaluateAnchorHealth(summariseAnchorProfile(rows, settings, opts), { ...ANCHOR_HEALTH, exactMaxPercent: 50 }))).not.toContain("exact")
    expect(ANCHOR_HEALTH).toMatchObject({ exactMaxPercent: 10, brandedPlusNakedMinPercent: 30, repeatedAnchorMaxPercent: 15 })
  })
})
