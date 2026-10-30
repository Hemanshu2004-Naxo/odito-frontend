import { describe, it, expect } from "vitest"
import { countryFlag, countryInfo, countryName } from "./countries"

describe("countryInfo", () => {
  it("a country code gives its English name and flag", () => {
    expect(countryInfo("IN")).toEqual({ code: "IN", name: "India", flag: "🇮🇳", kind: "country" })
    expect(countryInfo("us")).toMatchObject({ code: "US", name: "United States", flag: "🇺🇸" })
    expect(countryInfo(" gb ").name).toBe("United Kingdom")
  })

  it('"" is Unknown and "WW" is Worldwide', () => {
    expect(countryInfo("")).toEqual({ code: "", name: "Unknown", flag: "", kind: "unknown" })
    expect(countryInfo(null).name).toBe("Unknown")
    expect(countryInfo(undefined).name).toBe("Unknown")
    expect(countryInfo("WW")).toEqual({ code: "WW", name: "Worldwide", flag: "🌐", kind: "worldwide" })
    expect(countryInfo("ww").name).toBe("Worldwide")
  })

  it("a code Intl does not know keeps the code (never a made-up name); non-codes are shown as they are", () => {
    expect(countryInfo("ZZ")).toMatchObject({ name: "ZZ", kind: "country" })
    expect(countryInfo("XYZ")).toEqual({ code: "XYZ", name: "XYZ", flag: "", kind: "other" })
    expect(countryName("IN")).toBe("India")
  })

  it("every country the real asgeyehospital.com response lists has a real name", () => {
    for (const code of ["IN", "US", "CO", "GB", "AR", "TR", "AI", "BR", "SG", "AZ", "BD", "RU", "IT", "DE", "LK", "IL", "ME", "MY"]) {
      expect(countryInfo(code).name, code).not.toBe(code)
    }
    expect(countryName("AI")).toBe("Anguilla")
    expect(countryName("CO")).toBe("Colombia")
  })

  it("flags are regional-indicator pairs, only for two letters", () => {
    expect(countryFlag("IN")).toBe("🇮🇳")
    expect(countryFlag("I")).toBe("")
    expect(countryFlag("")).toBe("")
    expect(countryFlag("123")).toBe("")
  })
})

describe("country search (the Backlinks page's country filter)", () => {
  it("finds by code or by name, a code first, then names that start with the text, then names that contain it", async () => {
    const { searchCountries, COUNTRY_CODES } = await import("./countries")
    expect(searchCountries("in")[0].code).toBe("IN")
    expect(searchCountries("united").map((c) => c.name)).toEqual(expect.arrayContaining(["United States", "United Kingdom"]))
    expect(searchCountries("states").map((c) => c.code)).toContain("US")
    expect(searchCountries("zzzz")).toEqual([])
    expect(searchCountries("")).toEqual([])
    expect(searchCountries("united", { limit: 2 })).toHaveLength(2)
    expect(searchCountries("india", { exclude: ["IN"] }).map((c) => c.code)).not.toContain("IN")
    expect(COUNTRY_CODES).toHaveLength(new Set(COUNTRY_CODES).size)
    expect(COUNTRY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true)
  })
})
