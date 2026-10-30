import { describe, expect, test } from "vitest"
import { GENERIC_ANCHORS } from "./anchorConfig"
import { classifyAnchor, createClassifier, normalizeDomain, normalizeText } from "./classifyAnchor"

const DOMAIN = "asgeyehospital.com"
const settings = { brandTerms: ["asg", "asg eye hospital", "asgeyehospital"], targetKeywords: ["lasik surgery", "cataract surgery cost", "eye hospital in pune"] }
const type = (anchor, s = settings, d = DOMAIN) => classifyAnchor(anchor, s, d)

describe("normalisation", () => {
  test("lowercase, trim and collapse every kind of whitespace", () => {
    expect(normalizeText("  LASIK \t  Surgery  ")).toBe("lasik surgery")
    expect(normalizeText(null)).toBe("")
    expect(normalizeText(42)).toBe("")
  })
  test("a domain loses protocol, www, path, query and case", () => {
    expect(normalizeDomain("HTTPS://www.AsgEyeHospital.com/path?x=1#y")).toBe("asgeyehospital.com")
    expect(normalizeDomain("asgeyehospital.com")).toBe("asgeyehospital.com")
    expect(normalizeDomain(null)).toBe("")
  })
})

describe("1 empty", () => {
  test("null, undefined, empty and blank anchors are Empty / image", () => {
    for (const a of [null, undefined, "", "   ", " "]) expect(type(a)).toBe("empty")
  })
  test("empty wins over everything, even with no settings", () => {
    expect(type(null, { brandTerms: [""], targetKeywords: [""] })).toBe("empty")
  })
})

describe("2 naked URL", () => {
  test("contains the target domain, with or without protocol or www", () => {
    for (const a of ["asgeyehospital.com", "www.asgeyehospital.com", "https://asgeyehospital.com/", "http://www.asgeyehospital.com/lasik", "Visit asgeyehospital.com today", "ASGEYEHOSPITAL.COM"]) {
      expect(type(a)).toBe("naked_url")
    }
  })
  test("starts with http://, https:// or www. even for another domain", () => {
    for (const a of ["https://example.org/", "http://example.org", "www.example.org", "WWW.Example.org/page"]) expect(type(a)).toBe("naked_url")
  })
  test("a provider-shortened URL that still shows the domain is a naked URL", () => {
    expect(type("https://asgeyehospital.com/spe....cialities/lasik-surg")).toBe("naked_url")
  })
  test("the target domain may be given with a protocol and www", () => {
    expect(type("asgeyehospital.com offers", settings, "https://www.asgeyehospital.com/clinic")).toBe("naked_url")
  })
  test("a bare 'www' inside a word, or the word 'https' alone, is not a URL", () => {
    expect(type("wwwork", { brandTerms: [], targetKeywords: [] })).toBe("other")
    expect(type("httpsx", { brandTerms: [], targetKeywords: [] })).toBe("other")
  })
  test("naked URL is decided BEFORE branded: the domain contains the brand term", () => {
    expect(type("asgeyehospital.com")).toBe("naked_url")
  })
  test("with no target domain, only the protocol rule applies", () => {
    expect(type("asgeyehospital.com", settings, "")).toBe("branded")
    expect(type("https://x.org", settings, "")).toBe("naked_url")
  })
})

describe("3 branded", () => {
  test("contains any brand term, in any case, and the term may sit inside a longer phrase", () => {
    for (const a of ["ASG Eye Hospital", "asg", "Visit ASG for care", "the asg eye hospital in pune", "  ASG   Eye   Hospital  "]) expect(type(a)).toBe("branded")
  })
  test("branded is decided before exact and partial", () => {
    expect(type("ASG Eye Hospital lasik surgery")).toBe("branded")
    expect(type("asg lasik surgery", { brandTerms: ["asg"], targetKeywords: ["asg lasik surgery"] })).toBe("branded")
  })
  test("blank and duplicate brand terms are ignored (an empty term must not match everything)", () => {
    expect(type("lasik tips", { brandTerms: ["", "  ", "asg", "ASG"], targetKeywords: [] })).toBe("other")
  })
  test("no brand terms: nothing is branded", () => {
    expect(type("ASG Eye Hospital", { brandTerms: [], targetKeywords: [] })).toBe("other")
  })
})

describe("4 exact match and 5 partial match", () => {
  test("exact: equals a target keyword once normalised", () => {
    for (const a of ["lasik surgery", "Lasik Surgery", "  LASIK   surgery ", "Cataract Surgery Cost"]) expect(type(a)).toBe("exact")
  })
  test("partial: contains the keyword", () => {
    for (const a of ["Lasik Surgery in Pune", "best lasik surgery", "cheap cataract surgery cost near me"]) expect(type(a)).toBe("partial")
  })
  test("partial: contains all the words of a keyword in any order", () => {
    expect(type("surgery for lasik")).toBe("partial")
    expect(type("hospital for eye in pune")).toBe("partial")
  })
  test("a keyword's words must ALL be there: one of them is not enough", () => {
    expect(type("surgery")).toBe("other")
    expect(type("cataract surgery")).toBe("other")
    expect(type("eye care")).toBe("other")
  })
  test("words are whole words: 'surgeryx lasik' does not hold the word 'surgery'... but still contains no keyword", () => {
    expect(type("lasikx surgeryx")).toBe("other")
  })
  test("exact is checked before partial; a longer anchor with the keyword is partial, not exact", () => {
    expect(type("lasik surgery")).toBe("exact")
    expect(type("lasik surgery cost")).toBe("partial")
  })
  test("no target keywords: nothing is exact or partial", () => {
    expect(type("lasik surgery", { brandTerms: ["asg"], targetKeywords: [] })).toBe("other")
  })
  test("a blank keyword never matches", () => {
    expect(type("anything", { brandTerms: [], targetKeywords: ["", "   "] })).toBe("other")
  })
})

describe("6 generic", () => {
  test("every phrase of the starting list is generic", () => {
    for (const phrase of GENERIC_ANCHORS) expect(type(phrase, { brandTerms: [], targetKeywords: [] }), phrase).toBe("generic")
  })
  test("case, spaces and punctuation at the ends do not matter", () => {
    for (const a of ["Click Here", "  click   here  ", "Read more »", "Read more...", "[here]", "Learn More!", "Visit Website"]) expect(type(a)).toBe("generic")
  })
  test("a generic phrase inside a longer anchor is not generic", () => {
    expect(type("click here for lasik tips")).toBe("other")
    expect(type("read more about us")).toBe("other")
  })
  test("a generic phrase that contains the domain is a naked URL, one that is a brand term stays branded", () => {
    expect(type("Visit website (asgeyehospital.com)")).toBe("naked_url")
    expect(type("here", { brandTerms: ["here"], targetKeywords: [] })).toBe("branded")
  })
})

describe("7 other", () => {
  test("everything else", () => {
    for (const a of ["Jodhpur", "Pune", "eye care services", "best clinic", "123", "—"]) expect(type(a)).toBe("other")
  })
  test("settings missing altogether do not throw", () => {
    expect(type("hello", undefined)).toBe("other")
    expect(type("hello", null)).toBe("other")
    expect(type("hello", {})).toBe("other")
  })
})

describe("createClassifier", () => {
  test("gives the same answers as classifyAnchor, for many anchors", () => {
    const classify = createClassifier(settings, DOMAIN)
    for (const a of [null, "ASG", "lasik surgery", "Lasik Surgery in Pune", "click here", "www.x.com", "random"]) expect(classify(a)).toBe(type(a))
  })
  test("changing the settings changes the answer: no hidden state between classifiers", () => {
    expect(type("lasik surgery", { brandTerms: [], targetKeywords: [] })).toBe("other")
    expect(type("lasik surgery", { brandTerms: [], targetKeywords: ["lasik surgery"] })).toBe("exact")
    expect(type("lasik surgery", { brandTerms: ["lasik"], targetKeywords: ["lasik surgery"] })).toBe("branded")
  })
})
