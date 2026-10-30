import { describe, test, expect } from "vitest"
import { buildCompetitorsRequest, defaultPageState, parseUrlState, serializeUrlState, settingsChanged } from "./urlState"
import { DEFAULT_COMPETITORS_REQUEST, exclusionSignature, isDefaultCompetitorsRequest } from "@/lib/competitorsRequest"

const parse = (qs) => parseUrlState(new URLSearchParams(qs))

describe("the default view", () => {
  test("is exactly the request the Domain Overview card makes (one shared cache entry)", () => {
    expect(buildCompetitorsRequest(defaultPageState())).toEqual(DEFAULT_COMPETITORS_REQUEST)
    expect(isDefaultCompetitorsRequest(buildCompetitorsRequest(defaultPageState()))).toBe(true)
  })

  test("and a clean URL", () => {
    expect(serializeUrlState(defaultPageState())).toBe("")
    expect(parse("")).toEqual(defaultPageState())
  })
})

describe("state -> request", () => {
  test("page, size, sort and direction", () => {
    const r = buildCompetitorsRequest({ ...defaultPageState(), page: 3, pageSize: 25, sort: "avgPosition", dir: "asc" })
    expect(r).toMatchObject({ limit: 25, offset: 50, order_by: "avg_position,asc" })
    expect(buildCompetitorsRequest({ ...defaultPageState(), sort: "headToHead", dir: "desc" }).order_by).toBe("competitor_metrics.organic.etv,desc")
  })

  test("the toggles: 'Hide large sites' -> exclude_top_domains, 'Top 10 only' -> max_rank_group 10", () => {
    expect(buildCompetitorsRequest({ ...defaultPageState(), hideLarge: false })).toMatchObject({ exclude_top_domains: false, max_rank_group: 100 })
    expect(buildCompetitorsRequest({ ...defaultPageState(), top10: true })).toMatchObject({ exclude_top_domains: true, max_rank_group: 10 })
  })

  test("'Min. shared keywords' is a single intersections >= N condition; empty / 0 is no filter", () => {
    expect(buildCompetitorsRequest({ ...defaultPageState(), minShared: "50" }).filters).toEqual(["intersections", ">=", 50])
    expect(buildCompetitorsRequest({ ...defaultPageState(), minShared: "" }).filters).toEqual([])
    expect(buildCompetitorsRequest({ ...defaultPageState(), minShared: "0" }).filters).toEqual([])
  })

  test("the offset never goes past the provider's reachable depth", () => {
    expect(buildCompetitorsRequest({ ...defaultPageState(), page: 9999, pageSize: 100 }).offset).toBe(9999)
  })
})

describe("URL round trip", () => {
  test("every setting survives", () => {
    const state = { sort: "headToHead", dir: "asc", page: 4, pageSize: 25, hideLarge: false, top10: true, minShared: "120" }
    expect(parse(serializeUrlState(state))).toEqual(state)
    expect(serializeUrlState(state)).toBe("sort=headToHead&dir=asc&page=4&size=25&big=1&top10=1&min=120")
  })

  test("only what differs from the default is written", () => {
    expect(serializeUrlState({ ...defaultPageState(), top10: true })).toBe("top10=1")
    expect(serializeUrlState({ ...defaultPageState(), sort: "avgPosition", dir: "asc" })).toBe("sort=avgPosition")
  })

  test("a hand-edited or stale link reads as the default, never as a state the page cannot render", () => {
    expect(parse("sort=password&dir=sideways&page=-3&size=7&big=yes&top10=2&min=abc")).toEqual(defaultPageState())
    expect(parse("page=0&min=0&min=5").minShared).toBe("")
    expect(parse("min=99999999999").minShared).toBe("")
    expect(parse("size=100").pageSize).toBe(100)
  })

  test("settingsChanged is what 'Reset settings' undoes (not sort or paging)", () => {
    expect(settingsChanged(defaultPageState())).toBe(false)
    expect(settingsChanged({ ...defaultPageState(), sort: "avgPosition", page: 3 })).toBe(false)
    for (const patch of [{ hideLarge: false }, { top10: true }, { minShared: "5" }]) expect(settingsChanged({ ...defaultPageState(), ...patch })).toBe(true)
  })
})

describe("the exclude list's signature (part of the competitors query key)", () => {
  test("empty list, order and case do not matter, any change does", () => {
    expect(exclusionSignature([])).toBe("x0")
    expect(exclusionSignature(undefined)).toBe("x0")
    expect(exclusionSignature(["b.com", "A.com"])).toBe(exclusionSignature(["a.com", "b.com", "b.com"]))
    expect(exclusionSignature(["a.com"])).not.toBe(exclusionSignature(["a.com", "b.com"]))
    expect(exclusionSignature(["a.com"])).not.toBe(exclusionSignature(["b.com"]))
    expect(exclusionSignature(["a.com"])).not.toBe("x0")
  })

  test("isDefaultCompetitorsRequest notices each difference", () => {
    const d = DEFAULT_COMPETITORS_REQUEST
    for (const change of [{ limit: 25 }, { offset: 50 }, { order_by: "avg_position,asc" }, { filters: ["intersections", ">=", 5] }, { exclude_top_domains: false }, { max_rank_group: 10 }]) {
      expect(isDefaultCompetitorsRequest({ ...d, ...change }), JSON.stringify(change)).toBe(false)
    }
    expect(isDefaultCompetitorsRequest(null)).toBe(false)
    expect(isDefaultCompetitorsRequest({ ...d, filters: [] })).toBe(true)
  })
})
