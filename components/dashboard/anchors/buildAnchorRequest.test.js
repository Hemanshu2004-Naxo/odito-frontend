import { describe, expect, test } from "vitest"
import { buildAnchorFilters, buildAnchorRequest, cleanText, describeActiveFilters, effectiveSort, EMPTY_FILTERS, isDefaultRequest, nextSort } from "./buildAnchorRequest"
import { defaultPageState } from "./urlState"
import { MAX_CONDITIONS, TOO_MANY_MESSAGE } from "./constants"

const state = (patch = {}) => ({ ...defaultPageState(), ...patch })
const filtersOf = (patch) => buildAnchorFilters(state(patch))

describe("the default view", () => {
  test("is live, 50 rows, offset 0, referring domains highest first, no filters — and is recognised as the default", () => {
    const { request, built } = buildAnchorRequest(state())
    expect(request).toEqual({ status: "live", limit: 50, offset: 0, order_by: "referring_domains,desc", filters: [] })
    expect(built.tooMany).toBe(false)
    expect(isDefaultRequest(request)).toBe(true)
  })
  test("anything else is not the default view", () => {
    for (const patch of [{ status: "lost" }, { pageSize: 25 }, { page: 2 }, { q: "lasik" }, { sort: { field: "backlinks", dir: "desc" } }]) {
      expect(isDefaultRequest(buildAnchorRequest(state(patch)).request), JSON.stringify(patch)).toBe(false)
    }
  })
})

describe("the status is the request's backlinks_status_type, never a filter", () => {
  test.each(["live", "lost", "all"])("%s", (status) => {
    const { request } = buildAnchorRequest(state({ status }))
    expect(request.status).toBe(status)
    expect(request.filters).toEqual([])
  })
})

describe("filters", () => {
  test("search -> anchor like %text%; exclude -> anchor not_like %text%", () => {
    expect(filtersOf({ q: "lasik" }).conditions).toEqual([["anchor", "like", "%lasik%"]])
    expect(filtersOf({ exclude: "click here" }).conditions).toEqual([["anchor", "not_like", "%click here%"]])
  })
  test("typed wildcards and control characters cannot inject a pattern: % becomes a space, runs collapse, ends are trimmed", () => {
    expect(cleanText("  50%  off\n\tnow% ")).toBe("50 off now")
    expect(filtersOf({ q: "100%" }).conditions).toEqual([["anchor", "like", "%100%"]])
    expect(filtersOf({ q: "%%%" }).conditions).toEqual([])
    expect(filtersOf({ q: "   " }).conditions).toEqual([])
  })
  test("long text is cut to 100 characters", () => {
    expect(filtersOf({ q: "a".repeat(300) }).conditions[0][2]).toBe(`%${"a".repeat(100)}%`)
  })
  test("min referring domains, min backlinks, max spam, has broken links, first seen after — each with the right field and operator", () => {
    expect(filtersOf({ minReferringDomains: "5" }).conditions).toEqual([["referring_domains", ">=", 5]])
    expect(filtersOf({ minBacklinks: "1,200" }).conditions).toEqual([["backlinks", ">=", 1200]])
    expect(filtersOf({ maxSpam: "30" }).conditions).toEqual([["backlinks_spam_score", "<=", 30]])
    expect(filtersOf({ hasBroken: true }).conditions).toEqual([["broken_backlinks", ">", 0]])
    expect(filtersOf({ since: "2025-04-01" }).conditions).toEqual([["first_seen", ">=", "2025-04-01"]])
  })
  test("zero is a real value (min referring domains 0, spam 0), an empty field is no filter", () => {
    expect(filtersOf({ minReferringDomains: "0" }).conditions).toEqual([["referring_domains", ">=", 0]])
    expect(filtersOf({ maxSpam: "0" }).conditions).toEqual([["backlinks_spam_score", "<=", 0]])
    expect(filtersOf({ minReferringDomains: "", maxSpam: "  " }).conditions).toEqual([])
  })
  test("a wrong number or date is explained and NOT sent (nothing is half-applied)", () => {
    const f = filtersOf({ minReferringDomains: "abc", minBacklinks: "-3", maxSpam: "101", since: "2025-13-40" })
    expect(f.conditions).toEqual([])
    expect(Object.keys(f.errors).sort()).toEqual(["maxSpam", "minBacklinks", "minReferringDomains", "since"])
    expect(f.errors.maxSpam).toBe("Spam score: enter a whole number from 0 to 100.")
    expect(filtersOf({ maxSpam: "1.5" }).errors.maxSpam).toBeTruthy()
  })
  test("a valid filter next to an invalid one: only the valid one is sent", () => {
    expect(filtersOf({ q: "lasik", maxSpam: "999" }).conditions).toEqual([["anchor", "like", "%lasik%"]])
  })
  test("one exact anchor, and the empty anchor", () => {
    expect(filtersOf({ exact: "ASG Eye Hospital" }).conditions).toEqual([["anchor", "=", "ASG Eye Hospital"]])
    expect(filtersOf({ exactEmpty: true }).conditions).toEqual([["anchor", "=", ""]])
    expect(filtersOf({ exact: "x", exactEmpty: true }).conditions).toEqual([["anchor", "=", ""]])
    expect(filtersOf({ exact: "" }).conditions).toEqual([])
  })
  test("the exact anchor keeps its own spelling (it must match the provider's text); it is not cleaned like a search", () => {
    expect(filtersOf({ exact: "50% off  now" }).conditions).toEqual([["anchor", "=", "50% off  now"]])
  })
  test("the ANCHOR TYPE filter is never sent: the provider does not know our types", () => {
    const { request } = buildAnchorRequest(state({ types: ["branded", "exact"] }))
    expect(request.filters).toEqual([])
    expect(isDefaultRequest(request)).toBe(true)
  })
})

describe("the 8-condition limit", () => {
  const all = { q: "a", exclude: "b", exact: "c", minReferringDomains: "1", minBacklinks: "1", maxSpam: "50", hasBroken: true, since: "2025-01-01" }
  test("all eight at once is fine", () => {
    const f = filtersOf(all)
    expect(f.count).toBe(MAX_CONDITIONS)
    expect(f.tooMany).toBe(false)
  })
  test("the controls can never go past 8: the empty anchor replaces the exact one instead of adding a ninth", () => {
    const f = filtersOf({ ...all, exactEmpty: true })
    expect(f.count).toBe(MAX_CONDITIONS)
    expect(f.tooMany).toBe(false)
    expect(f.conditions).toContainEqual(["anchor", "=", ""])
    expect(f.conditions).not.toContainEqual(["anchor", "=", "c"])
  })
  test("the refusal message is the one in the brief", () => {
    expect(TOO_MANY_MESSAGE).toBe("Max 8 filters — remove one to add another")
  })
})

describe("the filters as the provider wants them", () => {
  test("none is [], one is a flat triple, several are joined with \"and\" in a fixed order", () => {
    expect(buildAnchorRequest(state()).request.filters).toEqual([])
    expect(buildAnchorRequest(state({ q: "lasik" })).request.filters).toEqual(["anchor", "like", "%lasik%"])
    expect(buildAnchorRequest(state({ q: "lasik", minReferringDomains: "5", hasBroken: true })).request.filters).toEqual([
      ["anchor", "like", "%lasik%"], "and", ["referring_domains", ">=", 5], "and", ["broken_backlinks", ">", 0],
    ])
  })
  test("eight conditions are joined with seven \"and\"s", () => {
    const all = { q: "a", exclude: "b", exact: "c", minReferringDomains: "1", minBacklinks: "1", maxSpam: "50", hasBroken: true, since: "2025-01-01" }
    const { filters } = buildAnchorRequest(state(all)).request
    expect(filters).toHaveLength(15)
    expect(filters.filter((x) => x === "and")).toHaveLength(7)
  })
})

describe("sorting: one rule, referring domains highest first by default", () => {
  test("no choice = the default; a chosen rule is used", () => {
    expect(effectiveSort(state())).toEqual({ field: "referring_domains", dir: "desc" })
    expect(buildAnchorRequest(state({ sort: { field: "backlinks_spam_score", dir: "asc" } })).request.order_by).toBe("backlinks_spam_score,asc")
  })
  test("an unknown field falls back to the default instead of being sent", () => {
    expect(effectiveSort(state({ sort: { field: "referring_pages", dir: "desc" } }))).toEqual({ field: "referring_domains", dir: "desc" })
  })
  test("a header click: another column starts highest-first, the same one flips", () => {
    expect(nextSort(null, "backlinks")).toEqual({ field: "backlinks", dir: "desc" })
    expect(nextSort({ field: "backlinks", dir: "desc" }, "backlinks")).toEqual({ field: "backlinks", dir: "asc" })
    expect(nextSort({ field: "backlinks", dir: "asc" }, "backlinks")).toEqual({ field: "backlinks", dir: "desc" })
    expect(nextSort(null, "referringDomains")).toEqual({ field: "referring_domains", dir: "asc" }) // the default is already descending
    expect(nextSort({ field: "backlinks", dir: "asc" }, "spam")).toEqual({ field: "backlinks_spam_score", dir: "desc" })
  })
  test("every sortable column maps to a provider field; an unknown column changes nothing", () => {
    for (const [col, field] of [["referringDomains", "referring_domains"], ["backlinks", "backlinks"], ["rank", "rank"], ["spam", "backlinks_spam_score"], ["broken", "broken_backlinks"], ["firstSeen", "first_seen"]]) {
      expect(nextSort(null, col).field).toBe(field)
    }
    expect(nextSort({ field: "rank", dir: "asc" }, "nope")).toEqual({ field: "rank", dir: "asc" })
  })
})

describe("paging", () => {
  test("offset = (page - 1) × page size", () => {
    expect(buildAnchorRequest(state({ page: 3, pageSize: 25 })).request).toMatchObject({ limit: 25, offset: 50 })
    expect(buildAnchorRequest(state({ page: 2, pageSize: 100 })).request).toMatchObject({ limit: 100, offset: 100 })
  })
  test("page sizes are 25 / 50 / 100: anything else is 50", () => {
    expect(buildAnchorRequest(state({ pageSize: 1000 })).request.limit).toBe(50)
  })
  test("never past the provider's window of 20,000 (offset + limit)", () => {
    for (const size of [25, 50, 100]) {
      const { request } = buildAnchorRequest(state({ page: 9999, pageSize: size }))
      expect(request.offset + request.limit).toBeLessThanOrEqual(20000)
      expect(request.offset + request.limit).toBe(20000)
    }
    expect(buildAnchorRequest(state({ page: 0 })).request.offset).toBe(0)
    expect(buildAnchorRequest(state({ page: -4 })).request.offset).toBe(0)
  })
})

describe("applied filters as chips", () => {
  test("one chip per filter, each knowing how to clear itself", () => {
    const chips = describeActiveFilters(state({ q: "lasik", exclude: "pune", exact: "ASG", minReferringDomains: "5", minBacklinks: "10", maxSpam: "30", hasBroken: true, since: "2025-04-01", types: ["branded"] }))
    expect(chips.map((c) => c.id)).toEqual(["q", "exclude", "exact", "minReferringDomains", "minBacklinks", "maxSpam", "hasBroken", "since", "types"])
    expect(chips.map((c) => c.label)).toEqual(["Contains “lasik”", "Excludes “pune”", "Anchor: “ASG”", "Referring domains ≥ 5", "Backlinks ≥ 10", "Spam ≤ 30", "Has broken links", "First seen after 2025-04-01", "Type: 1 selected"])
    expect(chips[2].clear).toEqual({ exact: null, exactEmpty: false })
  })
  test("no filters, no chips; an invalid value is not a chip (it was not applied)", () => {
    expect(describeActiveFilters(state())).toEqual([])
    expect(describeActiveFilters(state({ maxSpam: "999", since: "nope", minBacklinks: "abc" }))).toEqual([])
  })
  test("the empty anchor has its own chip", () => {
    expect(describeActiveFilters(state({ exactEmpty: true }))[0].label).toBe("Anchor: (empty / image link)")
  })
  test("clearing a chip's patch empties exactly that filter", () => {
    const s = state({ q: "a", hasBroken: true })
    const chip = describeActiveFilters(s).find((c) => c.id === "hasBroken")
    expect(describeActiveFilters({ ...s, ...chip.clear }).map((c) => c.id)).toEqual(["q"])
    expect(Object.keys(EMPTY_FILTERS).sort()).toEqual(Object.keys(defaultPageState()).filter((k) => !["status", "sort", "page", "pageSize"].includes(k)).sort())
  })
})
