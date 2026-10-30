import { describe, test, expect, vi } from "vitest"

// Only the pure helpers are tested: keep the real API client (which needs env) out of the import graph.
vi.mock("@/hooks/useAiVisibilityQuestions", () => ({ useBusinessProfile: () => ({}), useSaveBusinessProfile: () => ({}), useGenerateDraft: () => ({}) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { profileChanges, COUNTRY_OPTIONS } from "./BusinessProfilePanel"

describe("country and state fields", () => {
  const base = { industry: "healthcare", subIndustry: "eye hospital", targetCity: "Nashik", targetState: "", country: "", language: "en", services: [], targetCities: [], serviceAreas: [], customerTypes: [], customerProblems: [], requirements: [], buyingRequirements: [] }
  test("only changed country / state are sent; a cleared one is an explicit null", () => {
    expect(profileChanges(base, { ...base })).toEqual({})
    expect(profileChanges(base, { ...base, country: "IN", targetState: " Maharashtra " })).toEqual({ country: "IN", targetState: "Maharashtra" })
    expect(profileChanges({ ...base, country: "IN" }, { ...base, country: "" })).toEqual({ country: null })
  })
  test("country options are ISO codes with names, India included", () => {
    expect(COUNTRY_OPTIONS.find((o) => o.code === "IN")?.name).toBe("India")
    expect(COUNTRY_OPTIONS.every((o) => /^[A-Z]{2}$/.test(o.code))).toBe(true)
  })
})
