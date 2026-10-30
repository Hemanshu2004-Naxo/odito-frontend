import { describe, test, expect } from "vitest"
import { defaultPageState, parseUrlState, serializeUrlState } from "./urlState"

const parse = (qs) => parseUrlState(new URLSearchParams(qs))

describe("URL state", () => {
  test("an empty query string is the default view, and the default view serialises to an empty string", () => {
    expect(parse("")).toEqual(defaultPageState())
    expect(serializeUrlState(defaultPageState())).toBe("")
    expect(defaultPageState()).toMatchObject({ sort: "traffic", dir: "desc", page: 1, pageSize: 50, q: "", intents: [] })
  })

  test("every filter, the sort, the page and the page size survive a round trip", () => {
    const state = {
      ...defaultPageState(), q: "cataract surgery", exclude: "cost", position: "11-20", volMin: "100", volMax: "9000", kdMin: "5", kdMax: "60",
      intents: ["informational", "commercial"], movement: "up", url: "/blog/", sort: "volume", dir: "asc", page: 3, pageSize: 25,
    }
    const qs = serializeUrlState(state)
    expect(parse(qs)).toEqual(state)
  })

  test("only what differs from the default is written", () => {
    expect(serializeUrlState({ ...defaultPageState(), q: "eye" })).toBe("q=eye")
    expect(serializeUrlState({ ...defaultPageState(), page: 2 })).toBe("page=2")
    expect(serializeUrlState({ ...defaultPageState(), pageSize: 100 })).toBe("size=100")
    // Position sorts ascending by default, so that direction is not written; traffic ascending is.
    expect(serializeUrlState({ ...defaultPageState(), sort: "position", dir: "asc" })).toBe("sort=position")
    expect(serializeUrlState({ ...defaultPageState(), dir: "asc" })).toBe("dir=asc")
  })

  test("a sort with no direction in the link takes that column's natural direction", () => {
    expect(parse("sort=position")).toMatchObject({ sort: "position", dir: "asc" })
    expect(parse("sort=keyword")).toMatchObject({ sort: "keyword", dir: "asc" })
    expect(parse("sort=volume")).toMatchObject({ sort: "volume", dir: "desc" })
  })

  test("garbage in a hand-edited or stale link is read as the default, never as an invalid state", () => {
    const s = parse("pos=top1000&mv=sideways&sort=password&dir=up&page=-4&size=7&vmin=abc&kdmax=1e9&intent=spam,commercial&q=" + "x".repeat(300))
    expect(s).toMatchObject({ position: "all", movement: "all", sort: "traffic", dir: "desc", page: 1, pageSize: 50, volMin: "", kdMax: "", intents: ["commercial"] })
    expect(s.q).toHaveLength(100)
    expect(parse("page=0").page).toBe(1)
    expect(parse("page=99999").page).toBe(1) // not a 1-4 digit page number
    expect(parse("size=25").pageSize).toBe(25)
  })

  test("blank text is not written", () => {
    expect(serializeUrlState({ ...defaultPageState(), q: "   ", url: "" })).toBe("")
  })
})
