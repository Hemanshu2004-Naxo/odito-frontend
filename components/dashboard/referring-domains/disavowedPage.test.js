import { describe, expect, test } from "vitest"
import { disavowedPage, missingFrom, noLiveLinksRow, visibleDisavowed } from "./disavowedPage"

const list = ["a.com", "b.com", "c.net", "d.org"] // in the order added

describe("the Disavowed tab: the saved list is the source of truth", () => {
  test("rows are the saved domains, newest first", () => {
    expect(visibleDisavowed(list)).toEqual(["d.org", "c.net", "b.com", "a.com"])
  })
  test("the search narrows your own list (a substring, any case), nothing is requested for it", () => {
    expect(visibleDisavowed(list, ".COM")).toEqual(["b.com", "a.com"])
    expect(visibleDisavowed(list, "  ")).toHaveLength(4)
    expect(visibleDisavowed(list, "zzz")).toEqual([])
  })
  test("paging: a page of the list, the total, the page count; a page past the end comes back", () => {
    const many = Array.from({ length: 120 }, (_, i) => `d${i}.com`)
    const p2 = disavowedPage(many, { page: 2, pageSize: 50 })
    expect([p2.total, p2.pageCount, p2.page, p2.slice.length]).toEqual([120, 3, 2, 50])
    expect(p2.slice[0]).toBe("d69.com") // newest first: 119 ... 70 is page 1
    expect(disavowedPage(many, { page: 99, pageSize: 50 }).page).toBe(3)
    expect(disavowedPage([], { page: 1, pageSize: 50 })).toEqual({ total: 0, pageCount: 1, page: 1, slice: [] })
  })
  test("a bad list is an empty list", () => {
    expect(visibleDisavowed(null)).toEqual([])
    expect(disavowedPage(undefined).total).toBe(0)
  })
})

describe("what still has to be asked of the provider", () => {
  test("only the domains with no known row and no earlier 'no live links' answer", () => {
    const known = new Map([["a.com", {}]])
    const unlinked = new Set(["b.com"])
    expect(missingFrom(["a.com", "b.com", "c.net", "d.org"], known, unlinked)).toEqual(["c.net", "d.org"])
  })
  test("removing a domain leaves the question as it was: nothing new to ask", () => {
    const known = new Map([["a.com", {}], ["c.net", {}]])
    const unlinked = new Set(["d.org"])
    expect(missingFrom(["d.org", "c.net", "b.com"], known, unlinked)).toEqual(["b.com"])
    expect(missingFrom(["d.org", "c.net"], known, unlinked)).toEqual([])
  })
  test("at most 100 per request (the provider's limit for one `in` filter)", () => {
    const many = Array.from({ length: 150 }, (_, i) => `d${i}.com`)
    expect(missingFrom(many, new Map(), new Set())).toHaveLength(100)
  })
})

describe("a saved domain that no longer links", () => {
  test("is still a row, with the explanation", () => {
    expect(noLiveLinksRow("Gone.COM")).toEqual({ domain: "gone.com", noLiveLinks: true, noLiveLinksText: "No live links found" })
  })
})
