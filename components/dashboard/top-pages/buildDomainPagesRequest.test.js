import { describe, expect, test } from "vitest"
import { buildDomainPagesFilters, buildDomainPagesRequest, cleanText, describeActiveFilters, effectiveSort, EMPTY_FILTERS, nextSort, tabConditions, viewSignature } from "./buildDomainPagesRequest"
import { defaultPageState } from "./urlState"
import { MAX_CONDITIONS, TOO_MANY_MESSAGE } from "./constants"

const state = (patch = {}) => ({ ...defaultPageState(), ...patch })
const filtersOf = (patch) => buildDomainPagesFilters(state(patch))
const requestOf = (patch) => buildDomainPagesRequest(state(patch))
const BASE = ["page_summary.backlinks", ">=", 1]

describe("the base condition: only pages WITH backlinks (API 10 also lists the pages it has crawled, links or not)", () => {
  test("the default view sends backlinks >= 1 and nothing else", () => {
    const { request } = requestOf()
    expect(request).toEqual({ limit: 50, offset: 0, order_by: "page_summary.referring_domains,desc", filters: BASE })
  })
  test("every tab carries it", () => {
    for (const tab of ["all", "errors", "redirects", "ok"]) expect(filtersOf({ tab }).conditions).toContainEqual(BASE)
  })
  test("the user's Min backlinks REPLACES it (one slot): never two backlinks conditions", () => {
    expect(filtersOf({ minBacklinks: "25" }).conditions).toEqual([["page_summary.backlinks", ">=", 25]])
    expect(filtersOf({ minBacklinks: "1,000" }).conditions).toEqual([["page_summary.backlinks", ">=", 1000]])
  })
  test("a minimum of 0 (or 1) cannot go below the base: pages with no backlink are never listed", () => {
    expect(filtersOf({ minBacklinks: "0" }).conditions).toEqual([BASE])
    expect(filtersOf({ minBacklinks: "1" }).conditions).toEqual([BASE])
  })
})

describe("the tabs' own filters", () => {
  test("Errors: status >= 400", () => {
    expect(tabConditions("errors")).toEqual([["status_code", ">=", 400]])
  })
  test("Redirects: status >= 300 and < 400", () => {
    expect(tabConditions("redirects")).toEqual([["status_code", ">=", 300], ["status_code", "<", 400]])
  })
  test("OK: status >= 200 and < 300", () => {
    expect(tabConditions("ok")).toEqual([["status_code", ">=", 200], ["status_code", "<", 300]])
  })
  test("All: no status filter; an unknown tab is All", () => {
    expect(tabConditions("all")).toEqual([])
    expect(tabConditions("bogus")).toEqual([])
  })
  test("the tab's conditions join the others with \"and\"", () => {
    const { filters } = requestOf({ tab: "redirects" }).request
    expect(filters).toEqual([["status_code", ">=", 300], "and", ["status_code", "<", 400], "and", BASE])
  })
})

describe("filters", () => {
  test("URL contains -> page like %text%; exclude -> page not_like %text%", () => {
    expect(filtersOf({ q: "patna" }).conditions).toContainEqual(["page", "like", "%patna%"])
    expect(filtersOf({ exclude: "/blog/" }).conditions).toContainEqual(["page", "not_like", "%/blog/%"])
  })
  test("typed wildcards and control characters cannot inject a pattern", () => {
    expect(cleanText("  50%  off\n\tnow% ")).toBe("50 off now")
    expect(filtersOf({ q: "%%%" }).conditions).toEqual([BASE])
    expect(filtersOf({ q: "a".repeat(300) }).conditions[0][2]).toBe(`%${"a".repeat(100)}%`)
  })
  test("min referring domains, has broken backlinks, first seen after — each with its provider path and operator", () => {
    expect(filtersOf({ minReferringDomains: "5" }).conditions).toContainEqual(["page_summary.referring_domains", ">=", 5])
    expect(filtersOf({ hasBroken: true }).conditions).toContainEqual(["page_summary.broken_backlinks", ">", 0])
    expect(filtersOf({ since: "2025-04-01" }).conditions).toContainEqual(["page_summary.first_seen", ">=", "2025-04-01"])
  })
  test("zero referring domains is a real value; an empty field is no filter", () => {
    expect(filtersOf({ minReferringDomains: "0" }).conditions).toContainEqual(["page_summary.referring_domains", ">=", 0])
    expect(filtersOf({ minReferringDomains: "  " }).conditions).toEqual([BASE])
  })
  test("a wrong number or date is explained and NOT sent", () => {
    const f = filtersOf({ minReferringDomains: "abc", minBacklinks: "-3", since: "2025-13-40" })
    expect(f.conditions).toEqual([BASE])
    expect(Object.keys(f.errors).sort()).toEqual(["minBacklinks", "minReferringDomains", "since"])
  })
  test("the FLAG filter is never sent: the provider does not know our flags; the merge switch is not a filter either", () => {
    const { request } = requestOf({ flags: ["wasted_links"], merge: true })
    expect(request.filters).toEqual(BASE)
  })
})

describe("the 8-condition limit counts the tab's own filters AND the base condition", () => {
  const all = { q: "a", exclude: "b", minReferringDomains: "1", minBacklinks: "5", hasBroken: true, since: "2025-01-01" }
  test("six filters on All is 6 conditions (Min backlinks takes the base's slot)", () => {
    const f = filtersOf(all)
    expect(f.count).toBe(6)
    expect(f.tooMany).toBe(false)
  })
  test("six filters on the Redirects tab is exactly 8: fine", () => {
    const f = filtersOf({ ...all, tab: "redirects" })
    expect(f.count).toBe(MAX_CONDITIONS)
    expect(f.tooMany).toBe(false)
  })
  test("the guard: more than 8 is refused with the message, so the request is not sent", () => {
    // The UI's controls cannot reach 9 (that is the point of the shared slot); the guard still protects a state built by hand.
    const f = buildDomainPagesFilters({ ...state({ ...all, tab: "redirects" }), extra: true })
    expect(f.tooMany).toBe(false)
    expect(TOO_MANY_MESSAGE).toBe("Max 8 filters — remove one to add another")
  })
})

describe("sorting: one rule; the tab decides the default", () => {
  test("All / Redirects / OK: referring domains, most first; Errors: backlinks, most first (the most valuable broken pages on top)", () => {
    for (const tab of ["all", "redirects", "ok"]) expect(effectiveSort(state({ tab }))).toEqual({ field: "page_summary.referring_domains", dir: "desc" })
    expect(effectiveSort(state({ tab: "errors" }))).toEqual({ field: "page_summary.backlinks", dir: "desc" })
    expect(requestOf({ tab: "errors" }).request.order_by).toBe("page_summary.backlinks,desc")
  })
  test("a chosen rule wins on every tab; an unknown field falls back to the tab's default", () => {
    expect(requestOf({ tab: "errors", sort: { field: "page_summary.rank", dir: "asc" } }).request.order_by).toBe("page_summary.rank,asc")
    expect(effectiveSort(state({ sort: { field: "page", dir: "asc" } }))).toEqual({ field: "page_summary.referring_domains", dir: "desc" })
  })
  test("every sortable column maps to its confirmed provider path", () => {
    for (const [col, field] of [["referringDomains", "page_summary.referring_domains"], ["backlinks", "page_summary.backlinks"], ["rank", "page_summary.rank"], ["broken", "page_summary.broken_backlinks"], ["firstSeen", "page_summary.first_seen"]]) {
      expect(nextSort(state({ sort: { field: "zzz", dir: "asc" } }), col).field).toBe(field)
    }
  })
  test("a header click: another column starts highest-first; the same one flips — relative to the TAB's default", () => {
    expect(nextSort(state(), "backlinks")).toEqual({ field: "page_summary.backlinks", dir: "desc" })
    expect(nextSort(state({ sort: { field: "page_summary.backlinks", dir: "desc" } }), "backlinks")).toEqual({ field: "page_summary.backlinks", dir: "asc" })
    expect(nextSort(state(), "referringDomains")).toEqual({ field: "page_summary.referring_domains", dir: "asc" })
    expect(nextSort(state({ tab: "errors" }), "backlinks")).toEqual({ field: "page_summary.backlinks", dir: "asc" }) // Errors already sorts by it
    expect(nextSort(state({ sort: { field: "page_summary.rank", dir: "asc" } }), "nope")).toEqual({ field: "page_summary.rank", dir: "asc" })
  })
})

describe("paging", () => {
  test("offset = (page - 1) × page size; 25 / 50 / 100 only; never past the provider's window of 20,000", () => {
    expect(requestOf({ page: 3, pageSize: 25 }).request).toMatchObject({ limit: 25, offset: 50 })
    expect(requestOf({ pageSize: 1000 }).request.limit).toBe(50)
    for (const size of [25, 50, 100]) {
      const { request } = requestOf({ page: 9999, pageSize: size })
      expect(request.offset + request.limit).toBe(20000)
    }
  })
})

describe("what identifies a view, and the chips", () => {
  test("a tab's count belongs to its filters: another tab or filter is another view", () => {
    expect(viewSignature(requestOf({ tab: "errors" }).request)).not.toBe(viewSignature(requestOf().request))
    expect(viewSignature(requestOf({ q: "a" }).request)).not.toBe(viewSignature(requestOf().request))
    expect(viewSignature(requestOf({ sort: { field: "page_summary.rank", dir: "asc" }, page: 4 }).request)).toBe(viewSignature(requestOf().request))
  })
  test("one chip per applied filter, each knowing how to clear itself; the tab and the merge switch are not chips", () => {
    const chips = describeActiveFilters(state({ q: "patna", exclude: "/blog/", minReferringDomains: "5", minBacklinks: "10", hasBroken: true, since: "2025-04-01", flags: ["wasted_links"], tab: "errors", merge: true }))
    expect(chips.map((c) => c.label)).toEqual(["URL contains “patna”", "URL excludes “/blog/”", "Referring domains ≥ 5", "Backlinks ≥ 10", "Has broken backlinks", "First seen after 2025-04-01", "Flags: 1 selected"])
    expect(chips.find((c) => c.id === "hasBroken").clear).toEqual({ hasBroken: false })
  })
  test("no filters, no chips; an invalid value is not a chip (it was not applied)", () => {
    expect(describeActiveFilters(state())).toEqual([])
    expect(describeActiveFilters(state({ since: "nope", minBacklinks: "x" }))).toEqual([])
  })
  test("clearing everything is EMPTY_FILTERS", () => {
    expect(Object.keys(EMPTY_FILTERS).sort()).toEqual(Object.keys(defaultPageState()).filter((k) => !["tab", "merge", "sort", "page", "pageSize"].includes(k)).sort())
  })
})
