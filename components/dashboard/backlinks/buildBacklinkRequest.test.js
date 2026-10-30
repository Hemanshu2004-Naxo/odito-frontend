import { describe, test, expect } from "vitest"
import { buildBacklinkFilters, buildBacklinkRequest, describeActiveFilters, effectiveSort, nextSort, viewSignature } from "./buildBacklinkRequest"
import { defaultPageState } from "./urlState"

const st = (patch = {}) => ({ ...defaultPageState(), ...patch })
const req = (patch, opts) => buildBacklinkRequest(st(patch), opts).request

describe("tabs: backlinks_status_type plus the tab's own filter", () => {
  test("All: live, no filter", () => {
    expect(req({ tab: "all" })).toMatchObject({ status: "live", mode: "as_is", filters: [] })
  })

  test("New: live + is_new", () => {
    expect(req({ tab: "new" })).toMatchObject({ status: "live", filters: ["is_new", "=", true] })
  })

  test("Lost: status lost, no extra filter", () => {
    expect(req({ tab: "lost" })).toMatchObject({ status: "lost", filters: [] })
  })

  test("Broken: live + is_broken, sorted by domain rank (the most valuable broken links first) until the user chooses", () => {
    const r = req({ tab: "broken" })
    expect(r).toMatchObject({ status: "live", filters: ["is_broken", "=", true], order_by: ["domain_from_rank,desc"] })
    expect(req({ tab: "broken", sort: [{ field: "first_seen", dir: "asc" }] }).order_by).toEqual(["first_seen,asc"])
  })

  test("an unknown tab is All", () => {
    expect(req({ tab: "nonsense" })).toMatchObject({ status: "live", filters: [] })
  })
})

describe("group by: mode", () => {
  test.each([["all", "as_is"], ["domain", "one_per_domain"], ["anchor", "one_per_anchor"], ["bogus", "as_is"]])("%s -> %s", (group, mode) => {
    expect(req({ group }).mode).toBe(mode)
  })
})

describe("every filter becomes its documented condition", () => {
  const conds = (patch) => buildBacklinkFilters(st(patch)).conditions

  test("search source, anchor and target URL are 'like' patterns; '%' and control characters cannot be injected", () => {
    expect(conds({ q: "  news site " })).toEqual([["url_from", "like", "%news site%"]])
    expect(conds({ anchor: "eye care" })).toEqual([["anchor", "like", "%eye care%"]])
    expect(conds({ target: "/hospital/" })).toEqual([["url_to", "like", "%/hospital/%"]])
    expect(conds({ q: "100%\n%" })).toEqual([["url_from", "like", "%100%"]])
    expect(conds({ q: "   %  " })).toEqual([])
    expect(conds({ q: "x".repeat(300) })[0][2]).toHaveLength(102)
  })

  test("link type: Dofollow / Nofollow are dofollow = true / false; All is no filter", () => {
    expect(conds({ follow: "dofollow" })).toEqual([["dofollow", "=", true]])
    expect(conds({ follow: "nofollow" })).toEqual([["dofollow", "=", false]])
    expect(conds({ follow: "all" })).toEqual([])
  })

  test("item type and placement are 'in' lists of known values only", () => {
    expect(conds({ itemTypes: ["image", "anchor", "junk"] })).toEqual([["item_type", "in", ["anchor", "image"]]])
    expect(conds({ placements: ["footer", "article"] })).toEqual([["semantic_location", "in", ["article", "footer"]]])
    expect(conds({ itemTypes: ["junk"] })).toEqual([])
  })

  test("min domain rank, max spam score, countries, first seen after, hide spammy, one source domain", () => {
    expect(conds({ minRank: "250" })).toEqual([["domain_from_rank", ">=", 250]])
    expect(conds({ maxSpam: "30" })).toEqual([["backlink_spam_score", "<=", 30]])
    expect(conds({ maxSpam: "0" })).toEqual([["backlink_spam_score", "<=", 0]]) // 0 is a real limit
    expect(conds({ countries: ["US", "IN", "us", "India"] })).toEqual([["domain_from_country", "in", ["IN", "US"]]])
    expect(conds({ since: "2024-03-01" })).toEqual([["first_seen", ">=", "2024-03-01"]])
    expect(conds({ hideSpammy: true })).toEqual([["backlink_spam_score", "<", 30]])
    expect(conds({ domainFrom: "Example.com" })).toEqual([["domain_from", "=", "example.com"]])
  })

  test("a bad number or date is reported and NOT applied (nothing half-applied is ever sent)", () => {
    for (const [patch, key] of [[{ minRank: "abc" }, "minRank"], [{ minRank: "1001" }, "minRank"], [{ maxSpam: "101" }, "maxSpam"], [{ maxSpam: "-5" }, "maxSpam"], [{ since: "2024-02-31" }, "since"], [{ since: "yesterday" }, "since"]]) {
      const b = buildBacklinkFilters(st(patch))
      expect(b.errors[key], JSON.stringify(patch)).toBeTruthy()
      expect(b.conditions).toEqual([])
    }
    expect(buildBacklinkFilters(st({ minRank: "0" })).conditions).toEqual([]) // rank >= 0 filters nothing
  })

  test("a domain that is not a domain name is ignored", () => {
    expect(conds({ domainFrom: "not a domain" })).toEqual([])
    expect(conds({ domainFrom: "https://a.com/x" })).toEqual([])
  })

  test("conditions go out in a fixed order: the tab's own first", () => {
    const c = conds({ tab: "broken", follow: "dofollow", q: "news", minRank: "10" })
    expect(c.map((x) => x[0])).toEqual(["is_broken", "url_from", "dofollow", "domain_from_rank"])
  })
})

describe("at most 8 conditions, counting the tab's own filter", () => {
  const eight = { q: "a", anchor: "b", target: "c", follow: "dofollow", itemTypes: ["image"], placements: ["footer"], minRank: "5", maxSpam: "40" }

  test("8 are fine", () => {
    const b = buildBacklinkFilters(st(eight))
    expect(b.count).toBe(8)
    expect(b.tooMany).toBe(false)
    expect(b.message).toBeNull()
  })

  test("the tab's filter is the 8th: one more tips it over", () => {
    expect(buildBacklinkFilters(st({ ...eight, tab: "new" })).tooMany).toBe(true)
    const seven = { ...eight, maxSpam: "" }
    expect(buildBacklinkFilters(st({ ...seven, tab: "broken" })).tooMany).toBe(false)
    expect(buildBacklinkFilters(st({ ...seven, tab: "broken" })).count).toBe(8)
    expect(buildBacklinkFilters(st({ ...seven, tab: "broken", hideSpammy: true })).tooMany).toBe(true)
  })

  test("over the limit the message says what to do and every filter in play is still counted", () => {
    const b = buildBacklinkFilters(st({ ...eight, hideSpammy: true, countries: ["IN"], since: "2024-01-01", domainFrom: "a.com" }))
    expect(b.count).toBe(12)
    expect(b.tooMany).toBe(true)
    expect(b.message).toBe("Max 8 filters — remove one to add another")
  })
})

describe("sorting: up to 3 rules, shift-click adds one", () => {
  test("no choice = the link's own rank, descending (the tab's default for Broken)", () => {
    expect(req({}).order_by).toEqual(["rank,desc"])
    expect(effectiveSort(st({ tab: "broken" }))).toEqual([{ field: "domain_from_rank", dir: "desc" }])
    expect(effectiveSort(st())).toEqual([])
  })

  test("the user's rules, in order, are sent as 'field,dir'", () => {
    expect(req({ sort: [{ field: "domain_from_rank", dir: "desc" }, { field: "first_seen", dir: "asc" }] }).order_by).toEqual(["domain_from_rank,desc", "first_seen,asc"])
  })

  test("click: that column alone, in its natural direction; click again flips it", () => {
    expect(nextSort([], "domainRank")).toEqual([{ field: "domain_from_rank", dir: "desc" }])
    expect(nextSort([], "spam")).toEqual([{ field: "backlink_spam_score", dir: "asc" }])
    expect(nextSort([{ field: "domain_from_rank", dir: "desc" }], "domainRank")).toEqual([{ field: "domain_from_rank", dir: "asc" }])
    expect(nextSort([{ field: "domain_from_rank", dir: "desc" }, { field: "first_seen", dir: "asc" }], "pageRank")).toEqual([{ field: "page_from_rank", dir: "desc" }])
  })

  test("shift-click: adds a secondary rule (max 3); on a column already sorted it flips that rule only", () => {
    let s = nextSort([], "domainRank")
    s = nextSort(s, "firstSeen", { shift: true })
    s = nextSort(s, "spam", { shift: true })
    expect(s).toEqual([{ field: "domain_from_rank", dir: "desc" }, { field: "first_seen", dir: "desc" }, { field: "backlink_spam_score", dir: "asc" }])
    expect(nextSort(s, "lastSeen", { shift: true })).toEqual(s) // a 4th is not added
    expect(nextSort(s, "firstSeen", { shift: true })[1]).toEqual({ field: "first_seen", dir: "asc" })
    expect(nextSort(s, "firstSeen", { shift: true })).toHaveLength(3)
  })
})

describe("paging: offset while offset + limit <= 20,000, then only a token", () => {
  test("a normal page is an offset", () => {
    expect(req({ page: 3, pageSize: 50 })).toMatchObject({ limit: 50, offset: 100 })
    expect(req({ page: 1 })).toMatchObject({ offset: 0 })
  })

  test("the last page the window allows still uses offset: 400 x 50 = 20,000", () => {
    const { request, windowExceeded } = buildBacklinkRequest(st({ page: 400, pageSize: 50 }))
    expect(request.offset).toBe(19950)
    expect(windowExceeded).toBe(false)
    expect(buildBacklinkRequest(st({ page: 200, pageSize: 100 })).request.offset).toBe(19900)
  })

  test("past it, an offset would be refused by the provider: the request is flagged, the offset clamped, and a token takes over", () => {
    const over = buildBacklinkRequest(st({ page: 401, pageSize: 50 }))
    expect(over.windowExceeded).toBe(true)
    expect(over.request.offset + over.request.limit).toBeLessThanOrEqual(20000)
    const withToken = buildBacklinkRequest(st({ page: 401, pageSize: 50 }), { token: "abc123" })
    expect(withToken.windowExceeded).toBe(false)
    expect(withToken.request).toMatchObject({ token: "abc123", offset: 0, limit: 50 })
  })

  test("with a token EVERYTHING else is identical to the first request (tab, group, sort, filters)", () => {
    const patch = { tab: "lost", group: "domain", follow: "dofollow", sort: [{ field: "first_seen", dir: "asc" }], pageSize: 100, page: 200 }
    const a = buildBacklinkRequest(st(patch)).request
    const b = buildBacklinkRequest(st(patch), { token: "tok" }).request
    const { offset: _o1, ...restA } = a
    const { offset: _o2, token, ...restB } = b
    expect(restB).toEqual(restA)
    expect(token).toBe("tok")
  })
})

describe("active filter chips and view signatures", () => {
  test("one removable chip per applied filter (the tab and group-by have their own controls); `clear` is the state patch that removes it", () => {
    const chips = describeActiveFilters(st({ tab: "broken", group: "domain", q: "news", follow: "dofollow", minRank: "50", countries: ["IN"], hideSpammy: true, since: "2024-01-01", domainFrom: "a.com" }))
    expect(chips.map((c) => c.label)).toEqual(["Source: news", "Dofollow", "Domain rank ≥ 50", "Country: IN", "First seen after 2024-01-01", "Spammy links hidden", "From a.com"])
    expect(chips.find((c) => c.id === "countries").clear).toEqual({ countries: [] })
    expect(chips.find((c) => c.id === "q").clear).toEqual({ q: "" })
    expect(describeActiveFilters(st())).toEqual([])
  })

  test("a bad (unapplied) value has no chip", () => {
    expect(describeActiveFilters(st({ minRank: "abc", since: "nope" }))).toEqual([])
  })

  test("a view's signature ignores sort and page, but not the tab, group or filters (a tab's count belongs to it)", () => {
    const sig = (patch) => viewSignature(buildBacklinkRequest(st(patch)).request)
    expect(sig({ page: 5, sort: [{ field: "first_seen", dir: "asc" }], pageSize: 100 })).toBe(sig({}))
    for (const patch of [{ tab: "lost" }, { tab: "new" }, { group: "domain" }, { q: "x" }]) expect(sig(patch)).not.toBe(sig({}))
  })
})
