import { describe, test, expect } from "vitest"
import { defaultPageState, parseSort, parseUrlState, serializeUrlState } from "./urlState"

const parse = (qs) => parseUrlState(new URLSearchParams(qs))

describe("URL state", () => {
  test("the default view is a clean URL", () => {
    expect(serializeUrlState(defaultPageState())).toBe("")
    expect(parse("")).toEqual(defaultPageState())
  })

  test("everything survives a round trip: tab, group, every filter, sort, page and page size", () => {
    const state = {
      ...defaultPageState(), tab: "lost", group: "anchor", q: "news", anchor: "eye", target: "/blog/", follow: "nofollow",
      itemTypes: ["anchor", "image"], placements: ["article", "footer"], minRank: "100", maxSpam: "20", countries: ["IN", "US"], since: "2025-01-15",
      hideSpammy: true, domainFrom: "example.com", sort: [{ field: "domain_from_rank", dir: "desc" }, { field: "first_seen", dir: "asc" }], page: 4, pageSize: 25,
    }
    expect(parse(serializeUrlState(state))).toEqual(state)
  })

  test("only what differs from the default is written", () => {
    expect(serializeUrlState({ ...defaultPageState(), tab: "new" })).toBe("tab=new")
    expect(serializeUrlState({ ...defaultPageState(), follow: "dofollow", page: 2 })).toBe("follow=dofollow&page=2")
  })

  test("?broken=true (the Backlink Overview's link) opens the Broken tab; an explicit tab wins", () => {
    expect(parse("broken=true").tab).toBe("broken")
    expect(parse("broken=true&tab=lost").tab).toBe("lost")
    expect(parse("broken=false").tab).toBe("all")
  })

  test("a hand-edited or stale link reads as the default, never as a state the page cannot render", () => {
    expect(parse("tab=nope&group=x&follow=maybe&types=junk&place=junk&rank=abc&spam=-1&cc=india,US,us&since=2024-13-45&from=Not A Domain&sort=password:asc&page=-4&size=7")).toEqual({
      ...defaultPageState(), countries: ["US"],
    })
  })

  test("sort: known fields once each, at most 3, valid directions", () => {
    expect(parseSort("domain_from_rank:desc,first_seen:asc,backlink_spam_score:asc,last_seen:desc")).toEqual([
      { field: "domain_from_rank", dir: "desc" }, { field: "first_seen", dir: "asc" }, { field: "backlink_spam_score", dir: "asc" },
    ])
    expect(parseSort("rank:desc,domain_from_rank:up,first_seen:asc,first_seen:desc")).toEqual([{ field: "first_seen", dir: "asc" }])
    expect(parseSort(null)).toEqual([])
  })

  test("page size is one of 25 / 50 / 100", () => {
    expect(parse("size=100").pageSize).toBe(100)
    expect(parse("size=1000").pageSize).toBe(50)
  })
})
