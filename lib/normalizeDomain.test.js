import { describe, it, expect } from "vitest"
import { normalizeDomain, parseDomainList } from "./normalizeDomain"

describe("normalizeDomain: one clean form for every domain a user types", () => {
  it.each([
    ["https://www.Example.com/path/", "example.com"],
    ["  HTTP://WWW.EXAMPLE.COM  ", "example.com"],
    ["example.com/", "example.com"],
    ["www.example.com", "example.com"],
    ["example.com.", "example.com"],
    ["https://blog.example.co.uk:8443/a/b?x=1#top", "blog.example.co.uk"],
    ["Example.COM?utm=1", "example.com"],
    ["practo.com", "practo.com"],
  ])("%s -> %s", (input, clean) => {
    expect(normalizeDomain(input)).toBe(clean)
  })

  it("keeps a real subdomain (only a leading www. is dropped)", () => {
    expect(normalizeDomain("in.linkedin.com")).toBe("in.linkedin.com")
    expect(normalizeDomain("www.in.linkedin.com")).toBe("in.linkedin.com")
  })

  it.each([
    "", "   ", "localhost", "foo.localhost", "printer.local", "db.internal", "127.0.0.1", "10.0.0.5", "http://[::1]/", "single", "a..com", "-a.com", "a-.com",
    "a b.com", "ftp://example.com", "javascript:alert(1)", "user:pw@example.com", "https://user@example.com", "example.123", `${"a".repeat(64)}.com`,
  ])("rejects %j", (bad) => {
    expect(normalizeDomain(bad)).toBeNull()
  })

  it("rejects anything that is not a string", () => {
    for (const bad of [null, undefined, 42, ["example.com"], {}, true]) expect(normalizeDomain(bad)).toBeNull()
  })

  it("is idempotent", () => {
    const once = normalizeDomain("HTTPS://WWW.Example.com/x")
    expect(normalizeDomain(once)).toBe(once)
  })
})

describe("parseDomainList: a pasted list", () => {
  it("splits on commas, spaces and new lines, cleans each, drops duplicates and reports what is not a domain", () => {
    const out = parseDomainList("https://www.Practo.com/doctors, justdial.com\nPRACTO.com  not_a_domain;amazon.in\n\n")
    expect(out.valid).toEqual(["practo.com", "justdial.com", "amazon.in"])
    expect(out.invalid).toEqual(["not_a_domain"])
  })

  it("handles empty or missing input", () => {
    expect(parseDomainList("")).toEqual({ valid: [], invalid: [] })
    expect(parseDomainList(undefined)).toEqual({ valid: [], invalid: [] })
  })
})
