import { describe, expect, test } from "vitest"
import { defaultPageState, parseSort, parseUrlState, serializeUrlState } from "./urlState"

const parse = (q) => parseUrlState(new URLSearchParams(q))

describe("the URL", () => {
  test("the default view is an empty query string, and an empty one reads as the default", () => {
    expect(serializeUrlState(defaultPageState())).toBe("")
    expect(parse("")).toEqual(defaultPageState())
  })

  test("every part of the state survives a round trip (the merge switch and the flag filter included)", () => {
    const state = {
      ...defaultPageState(), tab: "redirects", q: "patna", exclude: "/blog/", minReferringDomains: "5", minBacklinks: "10", hasBroken: true, since: "2025-04-01",
      flags: ["redirected_links", "links_no_traffic"], merge: true, sort: { field: "page_summary.rank", dir: "asc" }, page: 3, pageSize: 25,
    }
    expect(parse(serializeUrlState(state))).toEqual(state)
  })

  test("?status=error — the Backlink Overview's link — opens the Errors tab", () => {
    expect(parse("status=error").tab).toBe("errors")
    expect(parse("status=errors").tab).toBe("errors")
    expect(parse("status=redirect").tab).toBe("redirects")
    expect(parse("status=ok").tab).toBe("ok")
  })
  test("an explicit tab wins over status; a bad value of either is All", () => {
    expect(parse("tab=ok&status=error").tab).toBe("ok")
    for (const bad of ["status=bogus", "status=", "tab=bogus", "tab=ERRORS"]) expect(parse(bad).tab, bad).toBe("all")
  })
  test("the page writes tab=, not status=", () => {
    expect(serializeUrlState({ ...defaultPageState(), tab: "errors" })).toBe("tab=errors")
  })

  test("defaults are never written, even when the user clicked back to them — the default sort depends on the TAB", () => {
    expect(serializeUrlState({ ...defaultPageState(), sort: { field: "page_summary.referring_domains", dir: "desc" } })).toBe("")
    expect(serializeUrlState({ ...defaultPageState(), tab: "errors", sort: { field: "page_summary.backlinks", dir: "desc" } })).toBe("tab=errors")
    expect(serializeUrlState({ ...defaultPageState(), tab: "errors", sort: { field: "page_summary.referring_domains", dir: "desc" } })).toBe("tab=errors&sort=page_summary.referring_domains%3Adesc")
    expect(serializeUrlState({ ...defaultPageState(), q: "  " })).toBe("")
  })

  test("a hand-edited link cannot produce an invalid state", () => {
    const s = parse("rd=abc&bl=-4&since=2025-13-40&sort=hacked:desc&page=-1&size=77&flags=nope,wasted_links,wasted_links&broken=yes&merge=true")
    expect(s).toEqual({ ...defaultPageState(), flags: ["wasted_links"] })
  })

  test("sort: a known path with a direction; anything else is the default (null)", () => {
    expect(parseSort("page_summary.first_seen:asc")).toEqual({ field: "page_summary.first_seen", dir: "asc" })
    for (const bad of ["page_summary.rank", "page_summary.rank:up", "page:desc", "meta.title:asc", null, undefined, 5, ""]) expect(parseSort(bad), String(bad)).toBeNull()
  })

  test("page size is 25 / 50 / 100; the page is held within what the provider can answer for that size", () => {
    expect(parse("size=100").pageSize).toBe(100)
    expect(parse("size=1000").pageSize).toBe(50)
    expect(parse("page=9999&size=100").page).toBe(200)
  })

  test("the merge switch is 1 or nothing; flags are written in their own order, once each; text is capped", () => {
    expect(serializeUrlState({ ...defaultPageState(), merge: true })).toBe("merge=1")
    expect(serializeUrlState({ ...defaultPageState(), flags: ["traffic_few_links", "wasted_links", "wasted_links"] })).toBe("flags=wasted_links%2Ctraffic_few_links")
    expect(parse(`q=${"a".repeat(500)}`).q.length).toBe(100)
  })
})
