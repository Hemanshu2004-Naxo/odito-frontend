import { describe, expect, test } from "vitest"
import {
  BRAND_TERM_LIMIT, MAX_CONDITIONS, brandConditionCount, buildBrandConditions, conditionWeight, defaultBrandMode, joinFilterConditions, normalizeBrandMode,
  pickBrandTerms, withBrandFilter,
} from "./brandFilter"

const KW = "keyword_data.keyword"
const TERMS = ["asg", "asg eye hospital", "asgeyehospital"]

describe("pickBrandTerms", () => {
  test("lower-cases, trims, strips % and control characters, drops empties and duplicates", () => {
    expect(pickBrandTerms(["  ASG ", "asg", "Eye%Care", "", "   ", null, undefined, "a\u0000b"])).toEqual(["a b", "asg", "eye care"])
  })
  test("more than 6: the 6 SHORTEST are used (they match the most keywords); ties go alphabetically", () => {
    const many = ["krishna eye centre", "krishna", "kec", "eye", "krishnaeyecentre", "krishna eye", "kr", "zz", "aa"]
    expect(pickBrandTerms(many)).toEqual(["aa", "kr", "zz", "eye", "kec", "krishna"])
    expect(pickBrandTerms(many)).toHaveLength(BRAND_TERM_LIMIT)
  })
  test("the choice does not depend on the order the terms were saved in", () => {
    const a = ["delta", "alpha", "echo", "bravo", "charlie", "foxtrot", "golf", "hotel"]
    expect(pickBrandTerms(a)).toEqual(pickBrandTerms([...a].reverse()))
  })
  test("a term is capped at 100 characters; a non-array is no terms", () => {
    expect(pickBrandTerms(["x".repeat(300)])[0]).toHaveLength(100)
    expect(pickBrandTerms(undefined)).toEqual([])
    expect(pickBrandTerms("asg")).toEqual([])
  })
})

describe("buildBrandConditions", () => {
  test("Non-brand: one not_like per term, no group", () => {
    expect(buildBrandConditions(TERMS, "non")).toEqual([[KW, "not_like", "%asg%"], [KW, "not_like", "%asgeyehospital%"], [KW, "not_like", "%asg eye hospital%"]]) // shortest first
  })
  test("Brand: the terms joined with \"or\" inside ONE group", () => {
    expect(buildBrandConditions(TERMS, "only")).toEqual([[[KW, "like", "%asg%"], "or", [KW, "like", "%asgeyehospital%"], "or", [KW, "like", "%asg eye hospital%"]]])
  })
  test("Brand with one term is a plain condition, not a group of one", () => {
    expect(buildBrandConditions(["asg"], "only")).toEqual([[KW, "like", "%asg%"]])
  })
  test("All, an unknown mode and no terms are no conditions", () => {
    expect(buildBrandConditions(TERMS, "all")).toEqual([])
    expect(buildBrandConditions(TERMS, "weird")).toEqual([])
    expect(buildBrandConditions([], "non")).toEqual([])
    expect(buildBrandConditions(["", " "], "only")).toEqual([])
  })
  test("with more than 6 terms only 6 are used, in both modes", () => {
    const eight = ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"]
    expect(buildBrandConditions(eight, "non")).toHaveLength(6)
    expect(buildBrandConditions(eight, "only")[0].filter((_, i) => i % 2 === 0)).toHaveLength(6)
  })
  test("the mode is normalised", () => {
    expect(["non", "only", "all", "x", null, undefined].map(normalizeBrandMode)).toEqual(["non", "only", "all", "all", "all", "all"])
  })
})

describe("the 8-condition limit counts every term", () => {
  const eight = ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"]
  test("weights: a triple is 1, a group is its members", () => {
    expect(conditionWeight([KW, "like", "%a%"])).toBe(1)
    expect(conditionWeight(buildBrandConditions(TERMS, "only")[0])).toBe(3)
    expect(brandConditionCount(eight, "non")).toBe(6)
    expect(brandConditionCount(eight, "only")).toBe(6)
    expect(brandConditionCount(eight, "all")).toBe(0)
  })
  test("6 terms + 2 other conditions is exactly 8: sent", () => {
    const other = [["a", ">=", 1], ["b", "<=", 2]]
    const r = withBrandFilter(other, eight, "non")
    expect(r.count).toBe(MAX_CONDITIONS)
    expect(r.tooMany).toBe(false)
    expect(r.filters).not.toBeNull()
  })
  test("6 terms + 3 other conditions is 9: NOT sent (filters null, tooMany true)", () => {
    const r = withBrandFilter([["a", ">=", 1], ["b", "<=", 2], ["c", "<=", 3]], eight, "only")
    expect(r.count).toBe(9)
    expect(r.tooMany).toBe(true)
    expect(r.filters).toBeNull()
  })
  test("2 terms + 3 others stays within 8", () => {
    expect(withBrandFilter([["a", ">=", 1], ["b", "<=", 2], ["c", "<=", 3]], ["x1", "y2"], "non").tooMany).toBe(false)
  })
})

describe("joinFilterConditions (the wire form the backend takes)", () => {
  test("none -> null; one triple -> the triple; several -> joined with and", () => {
    expect(joinFilterConditions([])).toBeNull()
    expect(joinFilterConditions([["a", ">=", 1]])).toEqual(["a", ">=", 1])
    expect(joinFilterConditions([["a", ">=", 1], ["b", "<=", 2]])).toEqual([["a", ">=", 1], "and", ["b", "<=", 2]])
  })
  test("a lone \"or\" group is WRAPPED so it is not read as a triple; beside others it is and-joined", () => {
    const group = buildBrandConditions(TERMS, "only")[0]
    expect(joinFilterConditions([group])).toEqual([group])
    expect(joinFilterConditions([["a", ">=", 1], group])).toEqual([["a", ">=", 1], "and", group])
  })
  test("the whole dashboard variant: top-5 request + Brand mode", () => {
    const r = withBrandFilter([], TERMS, "only")
    expect(r.filters).toEqual([[[KW, "like", "%asg%"], "or", [KW, "like", "%asgeyehospital%"], "or", [KW, "like", "%asg eye hospital%"]]])
    expect(withBrandFilter([], TERMS, "non").filters).toHaveLength(5) // 3 conditions: c1 and c2 and c3
  })
})

describe("defaultBrandMode", () => {
  test("Non-brand when brand terms are saved, All otherwise", () => {
    expect(defaultBrandMode(TERMS)).toBe("non")
    expect(defaultBrandMode([])).toBe("all")
    expect(defaultBrandMode(["  "])).toBe("all")
    expect(defaultBrandMode(undefined)).toBe("all")
  })
})
