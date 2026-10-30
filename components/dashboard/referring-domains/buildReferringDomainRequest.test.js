import { describe, expect, test } from "vitest"
import {
  buildReferringDomainFilters, buildReferringDomainRequest, cleanText, daysAgo, describeActiveFilters, effectiveSort, EMPTY_FILTERS, nextSort, tabFilter, viewSignature,
} from "./buildReferringDomainRequest"
import { defaultPageState } from "./urlState"
import { MAX_CONDITIONS, TOO_MANY_MESSAGE } from "./constants"

const NOW = new Date("2026-10-28T10:00:00Z")
const state = (patch = {}) => ({ ...defaultPageState(), ...patch })
const filtersOf = (patch) => buildReferringDomainFilters(state(patch), { now: NOW })
const requestOf = (patch) => buildReferringDomainRequest(state(patch), { now: NOW })

describe("the tabs", () => {
  test("All: live, no filters — the default view", () => {
    expect(requestOf().request).toEqual({ status: "live", dofollow: false, limit: 50, offset: 0, order_by: "rank,desc", filters: [] })
  })
  test("New: live + first seen in the LAST 30 DAYS", () => {
    expect(tabFilter("new", NOW)).toEqual(["first_seen", ">=", "2026-09-28"])
    expect(requestOf({ tab: "new" }).request).toMatchObject({ status: "live", filters: ["first_seen", ">=", "2026-09-28"] })
    expect(daysAgo(30, NOW)).toBe("2026-09-28")
  })
  test("Lost: the lost status, no extra filter", () => {
    expect(requestOf({ tab: "lost" }).request).toMatchObject({ status: "lost", filters: [] })
  })
  test("Toxic: live + spam score ABOVE 30", () => {
    expect(requestOf({ tab: "toxic" }).request).toMatchObject({ status: "live", filters: ["backlinks_spam_score", ">", 30] })
  })
  test("the tab's own filter joins the user's filters with \"and\", tab first", () => {
    const { filters } = requestOf({ tab: "toxic", q: "news", minRank: "10" }).request
    expect(filters).toEqual([["backlinks_spam_score", ">", 30], "and", ["domain", "like", "%news%"], "and", ["rank", ">=", 10]])
  })
  test("only the New and Toxic tabs add a filter", () => {
    expect(tabFilter("all")).toBeNull()
    expect(tabFilter("lost")).toBeNull()
    expect(tabFilter("disavowed")).toBeNull()
  })
})

describe("\"Dofollow links only\" is the request's dofollow, never a filter", () => {
  test("on: the request says so and the filters stay empty; off: it does not", () => {
    const on = requestOf({ dofollow: true }).request
    expect(on.dofollow).toBe(true)
    expect(on.filters).toEqual([])
    expect(requestOf({ dofollow: false }).request.dofollow).toBe(false)
  })
  test("it does not count towards the 8 conditions", () => {
    expect(filtersOf({ dofollow: true }).count).toBe(0)
  })
  test("a different view for the cache and the tab counts", () => {
    expect(viewSignature(requestOf({ dofollow: true }).request)).not.toBe(viewSignature(requestOf().request))
  })
})

describe("filters", () => {
  test("search -> domain like %text%; exclude -> domain not_like %text%", () => {
    expect(filtersOf({ q: "news" }).conditions).toEqual([["domain", "like", "%news%"]])
    expect(filtersOf({ exclude: "blogspot" }).conditions).toEqual([["domain", "not_like", "%blogspot%"]])
  })
  test("typed wildcards and control characters cannot inject a pattern", () => {
    expect(cleanText("  50%  off\n\tnow% ")).toBe("50 off now")
    expect(filtersOf({ q: "%%%" }).conditions).toEqual([])
    expect(filtersOf({ q: "a".repeat(300) }).conditions[0][2]).toBe(`%${"a".repeat(100)}%`)
  })
  test("min / max rank, max spam, min backlinks, has broken links, first seen after", () => {
    expect(filtersOf({ minRank: "100", maxRank: "499" }).conditions).toEqual([["rank", ">=", 100], ["rank", "<=", 499]])
    expect(filtersOf({ maxSpam: "30" }).conditions).toEqual([["backlinks_spam_score", "<=", 30]])
    expect(filtersOf({ minBacklinks: "1,200" }).conditions).toEqual([["backlinks", ">=", 1200]])
    expect(filtersOf({ hasBroken: true }).conditions).toEqual([["broken_backlinks", ">", 0]])
    expect(filtersOf({ since: "2025-04-01" }).conditions).toEqual([["first_seen", ">=", "2025-04-01"]])
  })
  test("zero is a real value (rank 0, spam 0); an empty field is no filter", () => {
    expect(filtersOf({ minRank: "0" }).conditions).toEqual([["rank", ">=", 0]])
    expect(filtersOf({ maxSpam: "0" }).conditions).toEqual([["backlinks_spam_score", "<=", 0]])
    expect(filtersOf({ minRank: "", maxSpam: "  " }).conditions).toEqual([])
  })
  test("a wrong number or date is explained and NOT sent", () => {
    const f = filtersOf({ minRank: "abc", maxRank: "1001", maxSpam: "101", minBacklinks: "-3", since: "2025-13-40" })
    expect(f.conditions).toEqual([])
    expect(Object.keys(f.errors).sort()).toEqual(["maxRank", "maxSpam", "minBacklinks", "minRank", "since"])
    expect(f.errors.maxSpam).toBe("Spam score: enter a whole number from 0 to 100.")
  })
  test("min rank above max rank is explained and neither is sent", () => {
    const f = filtersOf({ minRank: "500", maxRank: "100" })
    expect(f.conditions).toEqual([])
    expect(f.errors.minRank).toBe("Min rank is higher than max rank.")
  })
  test("equal min and max is a valid single rank", () => {
    expect(filtersOf({ minRank: "300", maxRank: "300" }).conditions).toEqual([["rank", ">=", 300], ["rank", "<=", 300]])
  })
  test("the QUALITY filter is never sent: the provider does not know our tiers", () => {
    const { request } = requestOf({ quality: ["toxic", "high"] })
    expect(request.filters).toEqual([])
  })
})

describe("the 8-condition limit counts the tab's own filter", () => {
  const all = { q: "a", exclude: "b", minRank: "1", maxRank: "900", maxSpam: "50", minBacklinks: "1", hasBroken: true, since: "2025-01-01" }
  test("eight filters on the All tab is fine", () => {
    const f = filtersOf(all)
    expect(f.count).toBe(MAX_CONDITIONS)
    expect(f.tooMany).toBe(false)
  })
  test("eight filters on the New (or Toxic) tab is NINE conditions: refused with the message, so the request is not sent", () => {
    for (const tab of ["new", "toxic"]) {
      const f = filtersOf({ ...all, tab })
      expect(f.count).toBe(9)
      expect(f.tooMany).toBe(true)
      expect(f.message).toBe("Max 8 filters — remove one to add another")
    }
    expect(TOO_MANY_MESSAGE).toBe("Max 8 filters — remove one to add another")
  })
  test("seven filters on the New tab is exactly eight: fine", () => {
    const { since, ...seven } = all
    expect(filtersOf({ ...seven, tab: "new" }).tooMany).toBe(false)
  })
})

describe("sorting: one rule, rank strongest first by default", () => {
  test("none chosen = rank desc; a chosen rule is used; an unknown field falls back", () => {
    expect(effectiveSort(state())).toEqual({ field: "rank", dir: "desc" })
    expect(requestOf({ sort: { field: "referring_pages", dir: "asc" } }).request.order_by).toBe("referring_pages,asc")
    expect(effectiveSort(state({ sort: { field: "domain", dir: "asc" } }))).toEqual({ field: "rank", dir: "desc" })
  })
  test("every sortable field of the brief maps to the provider's field", () => {
    for (const [col, field] of [["rank", "rank"], ["backlinks", "backlinks"], ["pages", "referring_pages"], ["spam", "backlinks_spam_score"], ["broken", "broken_backlinks"], ["firstSeen", "first_seen"]]) {
      expect(nextSort({ field: "zzz", dir: "asc" }, col).field).toBe(field)
    }
  })
  test("a header click: another column starts highest-first; the same one flips", () => {
    expect(nextSort(null, "backlinks")).toEqual({ field: "backlinks", dir: "desc" })
    expect(nextSort({ field: "backlinks", dir: "desc" }, "backlinks")).toEqual({ field: "backlinks", dir: "asc" })
    expect(nextSort(null, "rank")).toEqual({ field: "rank", dir: "asc" }) // the default is already descending
    expect(nextSort({ field: "rank", dir: "asc" }, "nope")).toEqual({ field: "rank", dir: "asc" })
  })
})

describe("paging", () => {
  test("offset = (page - 1) × page size; 25 / 50 / 100 only", () => {
    expect(requestOf({ page: 3, pageSize: 25 }).request).toMatchObject({ limit: 25, offset: 50 })
    expect(requestOf({ pageSize: 1000 }).request.limit).toBe(50)
  })
  test("never past the provider's window of 20,000", () => {
    for (const size of [25, 50, 100]) {
      const { request } = requestOf({ page: 9999, pageSize: size })
      expect(request.offset + request.limit).toBe(20000)
    }
    expect(requestOf({ page: -4 }).request.offset).toBe(0)
  })
})

describe("applied filters as chips", () => {
  test("one chip per filter, each knowing how to clear itself", () => {
    const chips = describeActiveFilters(state({ q: "news", exclude: "blogspot", minRank: "100", maxRank: "499", maxSpam: "30", minBacklinks: "10", hasBroken: true, since: "2025-04-01", dofollow: true, quality: ["toxic"] }))
    expect(chips.map((c) => c.label)).toEqual(["Contains “news”", "Excludes “blogspot”", "Rank ≥ 100", "Rank ≤ 499", "Spam ≤ 30", "Backlinks ≥ 10", "Has broken links", "First seen after 2025-04-01", "Dofollow links only", "Quality: 1 selected"])
    const dofollow = chips.find((c) => c.id === "dofollow")
    expect(dofollow.clear).toEqual({ dofollow: false })
  })
  test("no filters, no chips; an invalid value is not a chip (it was not applied)", () => {
    expect(describeActiveFilters(state())).toEqual([])
    expect(describeActiveFilters(state({ maxSpam: "999", since: "nope", minRank: "abc", minBacklinks: "x" }))).toEqual([])
  })
  test("the tab is not a chip (it has its own control)", () => {
    expect(describeActiveFilters(state({ tab: "toxic" }))).toEqual([])
  })
  test("clearing everything is EMPTY_FILTERS", () => {
    expect(Object.keys(EMPTY_FILTERS).sort()).toEqual(Object.keys(defaultPageState()).filter((k) => !["tab", "sort", "page", "pageSize"].includes(k)).sort())
  })
})
