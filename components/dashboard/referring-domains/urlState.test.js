import { describe, expect, test } from "vitest"
import { defaultPageState, parseSort, parseUrlState, serializeUrlState } from "./urlState"

const parse = (q) => parseUrlState(new URLSearchParams(q))

describe("the URL", () => {
  test("the default view is an empty query string, and an empty one reads as the default", () => {
    expect(serializeUrlState(defaultPageState())).toBe("")
    expect(parse("")).toEqual(defaultPageState())
  })

  test("every part of the state survives a round trip", () => {
    const state = {
      ...defaultPageState(), tab: "toxic", q: "news", exclude: "blogspot", minRank: "100", maxRank: "499", maxSpam: "30", minBacklinks: "10", hasBroken: true,
      since: "2025-04-01", dofollow: true, quality: ["medium", "toxic"], sort: { field: "backlinks", dir: "asc" }, page: 3, pageSize: 25,
    }
    expect(parse(serializeUrlState(state))).toEqual(state)
  })

  test("defaults are never written, even when the user clicked back to them", () => {
    expect(serializeUrlState({ ...defaultPageState(), tab: "all", page: 1, pageSize: 50, sort: { field: "rank", dir: "desc" } })).toBe("")
    expect(serializeUrlState({ ...defaultPageState(), sort: { field: "rank", dir: "asc" } })).toBe("sort=rank%3Aasc")
    expect(serializeUrlState({ ...defaultPageState(), q: "  " })).toBe("")
  })

  test("every tab reads back; anything else is All", () => {
    for (const tab of ["all", "new", "lost", "toxic", "disavowed"]) expect(parse(`tab=${tab}`).tab).toBe(tab)
    for (const bad of ["tab=bogus", "tab=", "tab=TOXIC"]) expect(parse(bad).tab).toBe("all")
  })

  test("a hand-edited link cannot produce an invalid state", () => {
    const s = parse("rmin=abc&rmax=-4&spam=99999999999&bl=1.5&since=2025-13-40&sort=hacked:desc&page=-1&size=77&quality=nope,toxic,toxic&broken=yes&dofollow=true")
    expect(s).toEqual({ ...defaultPageState(), quality: ["toxic"] })
  })

  test("sort: a known field with a direction; anything else is the default (null)", () => {
    expect(parseSort("referring_pages:asc")).toEqual({ field: "referring_pages", dir: "asc" })
    for (const bad of ["rank", "rank:up", "domain:desc", "rank:desc:x", null, undefined, 5, ""]) expect(parseSort(bad), String(bad)).toBeNull()
  })

  test("page size is 25 / 50 / 100; the page is held within what the provider can answer for that size", () => {
    expect(parse("size=100").pageSize).toBe(100)
    expect(parse("size=1000").pageSize).toBe(50)
    expect(parse("page=9999&size=100").page).toBe(200)
    expect(parse("page=9999&size=25").page).toBe(800)
  })

  test("quality tiers are written in their own order, once each", () => {
    expect(serializeUrlState({ ...defaultPageState(), quality: ["toxic", "high", "high"] })).toBe("quality=high%2Ctoxic")
  })

  test("the dofollow switch is 1 or nothing; text is capped", () => {
    expect(serializeUrlState({ ...defaultPageState(), dofollow: true })).toBe("dofollow=1")
    expect(parse("dofollow=1").dofollow).toBe(true)
    expect(parse(`q=${"a".repeat(500)}`).q.length).toBe(100)
  })
})
