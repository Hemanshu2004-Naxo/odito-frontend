import { describe, expect, test } from "vitest"
import { defaultPageState, parseSort, parseUrlState, serializeUrlState } from "./urlState"

const params = (q) => new URLSearchParams(q)
const parse = (q) => parseUrlState(params(q))

describe("the URL", () => {
  test("the default view is an empty query string, and an empty one reads as the default", () => {
    expect(serializeUrlState(defaultPageState())).toBe("")
    expect(parse("")).toEqual(defaultPageState())
  })

  test("every part of the state survives a round trip", () => {
    const state = {
      ...defaultPageState(), status: "lost", q: "lasik", exclude: "pune", minReferringDomains: "5", minBacklinks: "10", maxSpam: "30", hasBroken: true, since: "2025-04-01",
      exact: "ASG Eye Hospital", types: ["branded", "exact"], sort: { field: "backlinks", dir: "asc" }, page: 3, pageSize: 25,
    }
    expect(parse(serializeUrlState(state))).toEqual(state)
  })

  test("the empty anchor round-trips", () => {
    const s = { ...defaultPageState(), exactEmpty: true }
    expect(serializeUrlState(s)).toBe("noanchor=1")
    expect(parse("noanchor=1")).toEqual(s)
  })

  test("an anchor with spaces, quotes, ampersands and non-Latin text survives", () => {
    const text = `50% off & "free" — लेसिक #1?`
    const s = { ...defaultPageState(), exact: text }
    expect(parse(serializeUrlState(s)).exact).toBe(text)
  })

  test("defaults are never written", () => {
    expect(serializeUrlState({ ...defaultPageState(), status: "live", page: 1, pageSize: 50, sort: { field: "referring_domains", dir: "desc" } })).toBe("")
    expect(serializeUrlState({ ...defaultPageState(), q: "  " })).toBe("")
  })

  test("status: live / lost / all; anything else is live", () => {
    expect(parse("status=all").status).toBe("all")
    expect(parse("status=lost").status).toBe("lost")
    for (const bad of ["status=new", "status=", "status=LIVE", "status=live,lost"]) expect(parse(bad).status, bad).toBe("live")
  })

  test("a hand-edited link cannot produce an invalid state", () => {
    const s = parse("rd=abc&bl=-4&spam=99999999999&since=2025-13-40&sort=hacked:desc&page=-1&size=77&types=nope,branded,branded&broken=yes")
    expect(s).toEqual({ ...defaultPageState(), types: ["branded"] })
  })

  test("sort: a known field with a direction; anything else is the default (null)", () => {
    expect(parseSort("backlinks_spam_score:asc")).toEqual({ field: "backlinks_spam_score", dir: "asc" })
    for (const bad of ["backlinks", "backlinks:up", "referring_pages:desc", "backlinks:desc:x", null, undefined, 5, ""]) expect(parseSort(bad), String(bad)).toBeNull()
  })

  test("the default sort is not written even when the user clicked back to it", () => {
    expect(serializeUrlState({ ...defaultPageState(), sort: { field: "referring_domains", dir: "desc" } })).toBe("")
    expect(serializeUrlState({ ...defaultPageState(), sort: { field: "referring_domains", dir: "asc" } })).toBe("sort=referring_domains%3Aasc")
  })

  test("page size is 25 / 50 / 100; the page is held within what the provider can answer for that size", () => {
    expect(parse("size=100").pageSize).toBe(100)
    expect(parse("size=1000").pageSize).toBe(50)
    expect(parse("page=9999&size=100").page).toBe(200)
    expect(parse("page=9999&size=25").page).toBe(800)
    expect(parse("page=3").page).toBe(3)
  })

  test("type filters are written in the types' own order, once each", () => {
    expect(serializeUrlState({ ...defaultPageState(), types: ["other", "branded", "branded"] })).toBe("types=branded%2Cother")
  })

  test("text is capped (a pasted novel cannot become a request)", () => {
    expect(parse(`q=${"a".repeat(500)}`).q.length).toBe(100)
  })

  test("a page number does not leak into a view that has no pages left (page 1 is not written)", () => {
    expect(serializeUrlState({ ...defaultPageState(), page: 1, q: "x" })).toBe("q=x")
  })
})
