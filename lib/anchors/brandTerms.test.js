import { describe, expect, test } from "vitest"
import { pickImportKeywords, suggestBrandTerms } from "./brandTerms"

describe("suggestBrandTerms", () => {
  test("the example from the brief: asgeyehospital -> asg, asg eye hospital, asgeyehospital", () => {
    expect(suggestBrandTerms("asgeyehospital.com")).toEqual(["asg", "asg eye hospital", "asgeyehospital"])
  })
  test("another real project: krishnaeyecentre", () => {
    expect(suggestBrandTerms("krishnaeyecentre.com")).toEqual(["krishna", "krishna eye centre", "krishnaeyecentre"])
  })
  test("hyphenated names are split at the hyphens", () => {
    expect(suggestBrandTerms("dr-agarwals-eye.in")).toEqual(["dr agarwals eye", "dragarwalseye"]) // "dr" is too short to be a term on its own
    expect(suggestBrandTerms("krishna-eye-centre.in")).toEqual(["krishna", "krishna eye centre", "krishnaeyecentre"])
  })
  test("protocol, www, path and case are ignored", () => {
    expect(suggestBrandTerms("HTTPS://www.AsgEyeHospital.com/clinic/")).toEqual(["asg", "asg eye hospital", "asgeyehospital"])
  })
  test("a name that does not split is just itself", () => {
    expect(suggestBrandTerms("naxonify.com")).toEqual(["naxonify"])
    expect(suggestBrandTerms("example.co.uk")).toEqual(["example"])
  })
  test("a name that is only a known word is not split into nothing", () => {
    expect(suggestBrandTerms("hospital.com")).toEqual(["hospital"])
  })
  test("blank or invalid input gives no suggestions", () => {
    expect(suggestBrandTerms("")).toEqual([])
    expect(suggestBrandTerms(null)).toEqual([])
    expect(suggestBrandTerms("   ")).toEqual([])
  })
})

describe("pickImportKeywords", () => {
  const rows = [
    { keyword: "ASG eye hospital pune", traffic: 900 },
    { keyword: "lasik surgery", traffic: 500 },
    { keyword: "cataract surgery cost", traffic: 700 },
    { keyword: "Lasik Surgery", traffic: 100 },
    { keyword: "retina doctor", traffic: null },
    { keyword: "eye test near me", traffic: 300 },
    { keyword: "asg", traffic: 5000 },
  ]
  test("best by traffic first, without keywords that contain a brand term, without repeats", () => {
    expect(pickImportKeywords(rows, ["asg"]).map((k) => k.keyword)).toEqual(["cataract surgery cost", "lasik surgery", "eye test near me", "retina doctor"])
  })
  test("at most 20 by default, or the limit given", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ keyword: `kw ${i}`, traffic: i }))
    expect(pickImportKeywords(many, []).length).toBe(20)
    expect(pickImportKeywords(many, [], 5).map((k) => k.keyword)).toEqual(["kw 49", "kw 48", "kw 47", "kw 46", "kw 45"])
  })
  test("a keyword with unknown traffic is last, and a blank keyword is skipped", () => {
    const out = pickImportKeywords([{ keyword: "a", traffic: null }, { keyword: "", traffic: 9 }, { keyword: "b", traffic: 1 }], [])
    expect(out.map((k) => k.keyword)).toEqual(["b", "a"])
  })
  test("nothing cached -> nothing to offer", () => {
    expect(pickImportKeywords([], ["asg"])).toEqual([])
    expect(pickImportKeywords(undefined, undefined)).toEqual([])
  })
})
