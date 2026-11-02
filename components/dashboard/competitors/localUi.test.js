import { describe, it, expect } from "vitest"
import { formatDistance, applyLocalFilters, sortLocal, projectToMap, describeLocalError, warningText, RADII_KM, DEFAULT_RADIUS_KM } from "./localUi"

const R = (id, over = {}) => ({ placeId: id, name: id, distanceMeters: 1000, relevance: "related", websiteDomain: null, rating: null, reviewCount: null, addedCompetitorId: null, lat: 20, lng: 73.8, ...over })

describe("radius and distance", () => {
  it("the radii are 1, 3, 5, 10, 15 and 25 km and 5 is the default", () => {
    expect(RADII_KM).toEqual([1, 3, 5, 10, 15, 25])
    expect(DEFAULT_RADIUS_KM).toBe(5)
  })
  it("formats metres and kilometres, and an unknown distance as a dash (never 0)", () => {
    expect(formatDistance(850)).toBe("850 m")
    expect(formatDistance(1234)).toBe("1.2 km")
    expect(formatDistance(12_400)).toBe("12 km")
    expect(formatDistance(null)).toBe("—")
    expect(formatDistance(undefined)).toBe("—")
    expect(formatDistance(NaN)).toBe("—")
  })
})

describe("applyLocalFilters", () => {
  const list = [R("a", { relevance: "direct", websiteDomain: "a.com", rating: 4.5, reviewCount: 300 }), R("b", { addedCompetitorId: "c1", rating: 3.9, reviewCount: 20 }), R("c", { websiteDomain: "c.com" })]
  it("each filter keeps only what it says", () => {
    expect(applyLocalFilters(list, { filter: "direct" }).map((r) => r.placeId)).toEqual(["a"])
    expect(applyLocalFilters(list, { filter: "has_website" }).map((r) => r.placeId)).toEqual(["a", "c"])
    expect(applyLocalFilters(list, { filter: "not_added" }).map((r) => r.placeId)).toEqual(["a", "c"])
    expect(applyLocalFilters(list, { filter: "added" }).map((r) => r.placeId)).toEqual(["b"])
    expect(applyLocalFilters(list, {})).toHaveLength(3)
  })
  it("a minimum rating or review count never lets an UNKNOWN value pass as if it were enough", () => {
    expect(applyLocalFilters(list, { minRating: 4 }).map((r) => r.placeId)).toEqual(["a"])
    expect(applyLocalFilters(list, { minReviews: 100 }).map((r) => r.placeId)).toEqual(["a"])
    expect(applyLocalFilters(list, { minRating: 1 }).map((r) => r.placeId)).toEqual(["a", "b"])
  })
  it("does not change the list it is given", () => {
    const copy = JSON.stringify(list)
    applyLocalFilters(list, { filter: "direct" })
    expect(JSON.stringify(list)).toBe(copy)
  })
})

describe("sortLocal", () => {
  const list = [R("far", { distanceMeters: 4000, rating: 4.9, reviewCount: 10, relevance: "unclassified" }), R("near", { distanceMeters: 500, rating: null, reviewCount: null, relevance: "direct" }), R("mid", { distanceMeters: 2000, rating: 4.1, reviewCount: 900, relevance: "related" })]
  it("by distance (the default), nearest first", () => expect(sortLocal(list).map((r) => r.placeId)).toEqual(["near", "mid", "far"]))
  it("by rating or reviews, best first, with UNKNOWN last (never treated as the worst or best value)", () => {
    expect(sortLocal(list, "rating").map((r) => r.placeId)).toEqual(["far", "mid", "near"])
    expect(sortLocal(list, "reviews").map((r) => r.placeId)).toEqual(["mid", "far", "near"])
  })
  it("by relevance: category matches, then related, then unclassified, nearest first within each", () => {
    expect(sortLocal(list, "relevance").map((r) => r.placeId)).toEqual(["near", "mid", "far"])
  })
})

describe("projectToMap: to scale around the business", () => {
  const centre = { lat: 20, lng: 73.8 }
  it("the business is the middle; a place exactly at the radius touches the edge of the plotted area; north is up", () => {
    const north = { placeId: "n", lat: 20 + 5 / 110.574, lng: 73.8 }
    const east = { placeId: "e", lat: 20, lng: 73.8 + 5 / (111.32 * Math.cos((20 * Math.PI) / 180)) }
    const [n, e] = projectToMap(centre, [north, east], 5)
    expect(n.x).toBeCloseTo(50, 5)
    expect(n.y).toBeCloseTo(8, 5) // 50 - (50 - margin 8)
    expect(e.y).toBeCloseTo(50, 5)
    expect(e.x).toBeCloseTo(92, 5)
  })
  it("a closer place is plotted proportionally closer; a place without coordinates is not plotted; no centre means nothing", () => {
    const half = { placeId: "h", lat: 20 + 2.5 / 110.574, lng: 73.8 }
    expect(projectToMap(centre, [half], 5)[0].y).toBeCloseTo(29, 5)
    expect(projectToMap(centre, [{ placeId: "x", lat: null, lng: null }], 5)).toEqual([])
    expect(projectToMap(null, [half], 5)).toEqual([])
  })
  it("a point beyond the ring is clamped to the edge, never drawn off the map", () => {
    const p = projectToMap(centre, [{ placeId: "far", lat: 25, lng: 80 }], 5)[0]
    expect(p.x).toBeLessThanOrEqual(92)
    expect(p.y).toBeGreaterThanOrEqual(8)
  })
})

describe("errors and warnings", () => {
  it("each code the server can answer has plain words, and the ones the user can fix say how", () => {
    expect(describeLocalError({ code: "LOCATION_REQUIRED" }).action).toBe("settings")
    expect(describeLocalError({ code: "LOCATION_NEEDS_CONFIRMATION" }).action).toBe("confirm")
    expect(describeLocalError({ code: "CATEGORY_REQUIRED" }).action).toBe("category")
    expect(describeLocalError({ code: "PLACES_TIMEOUT" }).action).toBe("retry")
    expect(describeLocalError({ code: "LOCAL_BUDGET_EXCEEDED" }).action).toBeNull()
  })
  it("a problem on the server's side never blames the user or names a key", () => {
    for (const code of ["PLACES_KEY_INVALID", "PLACES_ACCESS_DENIED", "PLACES_BILLING_REQUIRED", "PLACES_NOT_CONFIGURED"]) {
      const m = describeLocalError({ code })
      expect(`${m.title} ${m.text}`).not.toMatch(/key|billing|credential|API/i)
    }
  })
  it("an unknown error falls back to the server's own safe message", () => {
    expect(describeLocalError({ code: "WEIRD", message: "Something odd" }).text).toBe("Something odd")
    expect(describeLocalError(null).text).toBeTruthy()
  })
  it("every warning the server sends has a sentence; an unknown one has none", () => {
    for (const c of ["RESULT_CAP", "SOME_SEARCHES_FAILED", "BROAD_CATEGORY"]) expect(warningText(c)).toBeTruthy()
    expect(warningText("NOPE")).toBeNull()
  })
})
