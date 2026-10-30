import { describe, test, expect } from "vitest"
import { buildKeywordFilters, buildKeywordQuery, describeActiveFilters, joinConditions } from "./buildKeywordFilters"
import { EMPTY_FILTERS, FIELD, MAX_CONDITIONS } from "./constants"

const state = (o = {}) => ({ ...EMPTY_FILTERS, intents: [], ...o })

describe("buildKeywordFilters: nothing applied", () => {
  test("empty inputs build no filter at all (null, zero conditions, no error)", () => {
    const b = buildKeywordFilters(state())
    expect(b).toMatchObject({ conditions: [], filters: null, count: 0, tooMany: false, message: null, errors: {} })
  })

  test("whitespace-only text, an empty intent list and 'All' chips are all 'no filter'", () => {
    const b = buildKeywordFilters(state({ q: "   ", exclude: "\t", url: " ", position: "all", movement: "all", intents: [], volMin: " ", kdMax: "" }))
    expect(b.count).toBe(0)
    expect(b.filters).toBeNull()
  })

  test("a missing / undefined state is tolerated", () => {
    expect(buildKeywordFilters().count).toBe(0)
    expect(buildKeywordFilters({}).filters).toBeNull()
  })
})

describe("buildKeywordFilters: each filter becomes the documented condition", () => {
  test("keyword search is `like %text%`, trimmed, whitespace-collapsed and lowercased (the provider's like is case-sensitive)", () => {
    expect(buildKeywordFilters(state({ q: "  LASIK   Cost " })).conditions).toEqual([[FIELD.keyword, "like", "%lasik cost%"]])
  })

  test("exclude is `not_like`", () => {
    expect(buildKeywordFilters(state({ exclude: "Near Me" })).conditions).toEqual([[FIELD.keyword, "not_like", "%near me%"]])
  })

  test("a user cannot add wildcards: '%' is removed, text is capped at 100 characters", () => {
    expect(buildKeywordFilters(state({ q: "50% off%" })).conditions).toEqual([[FIELD.keyword, "like", "%50 off%"]])
    const long = buildKeywordFilters(state({ q: "a".repeat(250) })).conditions[0][2]
    expect(long).toBe(`%${"a".repeat(100)}%`)
    expect(buildKeywordFilters(state({ q: "%%%" })).count).toBe(0)
  })

  test("position chips: Top 3 / Top 10 are one condition; the ranges are two (>= and <=)", () => {
    expect(buildKeywordFilters(state({ position: "top3" })).conditions).toEqual([[FIELD.position, "<=", 3]])
    expect(buildKeywordFilters(state({ position: "top10" })).conditions).toEqual([[FIELD.position, "<=", 10]])
    expect(buildKeywordFilters(state({ position: "11-20" })).conditions).toEqual([[FIELD.position, ">=", 11], [FIELD.position, "<=", 20]])
    expect(buildKeywordFilters(state({ position: "21-50" })).conditions).toEqual([[FIELD.position, ">=", 21], [FIELD.position, "<=", 50]])
    expect(buildKeywordFilters(state({ position: "51-100" })).conditions).toEqual([[FIELD.position, ">=", 51], [FIELD.position, "<=", 100]])
    expect(buildKeywordFilters(state({ position: "bogus" })).count).toBe(0)
  })

  test("volume and KD: min only, max only, or both; thousands separators are tolerated", () => {
    expect(buildKeywordFilters(state({ volMin: "1,000" })).conditions).toEqual([[FIELD.volume, ">=", 1000]])
    expect(buildKeywordFilters(state({ volMax: "5000" })).conditions).toEqual([[FIELD.volume, "<=", 5000]])
    expect(buildKeywordFilters(state({ kdMin: "10", kdMax: "40" })).conditions).toEqual([[FIELD.difficulty, ">=", 10], [FIELD.difficulty, "<=", 40]])
    expect(buildKeywordFilters(state({ volMin: "0" })).conditions).toEqual([[FIELD.volume, ">=", 0]]) // 0 is a real minimum
  })

  test("intent: a subset is one `in` condition; none or all four mean no filter", () => {
    expect(buildKeywordFilters(state({ intents: ["commercial", "informational"] })).conditions).toEqual([[FIELD.intent, "in", ["informational", "commercial"]]])
    expect(buildKeywordFilters(state({ intents: ["informational", "navigational", "commercial", "transactional"] })).count).toBe(0)
    expect(buildKeywordFilters(state({ intents: ["not-an-intent"] })).count).toBe(0)
  })

  test("movement: New / Improved / Declined map to rank_changes.is_new / is_up / is_down = true", () => {
    expect(buildKeywordFilters(state({ movement: "new" })).conditions).toEqual([[FIELD.isNew, "=", true]])
    expect(buildKeywordFilters(state({ movement: "up" })).conditions).toEqual([[FIELD.isUp, "=", true]])
    expect(buildKeywordFilters(state({ movement: "down" })).conditions).toEqual([[FIELD.isDown, "=", true]])
  })

  test("URL contains is `like %text%` on relative_url and keeps the case the user typed (paths are case-sensitive)", () => {
    expect(buildKeywordFilters(state({ url: " /Blog/ " })).conditions).toEqual([[FIELD.url, "like", "%/Blog/%"]])
  })
})

describe("buildKeywordFilters: the provider's filter shape", () => {
  test("one condition is the flat triple; several are joined with 'and' (the order is stable)", () => {
    expect(buildKeywordFilters(state({ q: "eye" })).filters).toEqual([FIELD.keyword, "like", "%eye%"])
    const b = buildKeywordFilters(state({ q: "eye", position: "top10", movement: "new" }))
    expect(b.filters).toEqual([[FIELD.keyword, "like", "%eye%"], "and", [FIELD.position, "<=", 10], "and", [FIELD.isNew, "=", true]])
  })

  test("joinConditions", () => {
    expect(joinConditions([])).toBeNull()
    expect(joinConditions([["a", "=", 1]])).toEqual(["a", "=", 1])
    expect(joinConditions([["a", "=", 1], ["b", "=", 2]])).toEqual([["a", "=", 1], "and", ["b", "=", 2]])
  })
})

describe("buildKeywordFilters: the 8-condition limit", () => {
  // keyword like (1) + not_like (1) + 11–20 (2) + volume min/max (2) + KD min/max (2) = 8
  const eight = state({ q: "eye", exclude: "cost", position: "11-20", volMin: "10", volMax: "9000", kdMin: "5", kdMax: "60" })

  test("exactly 8 conditions are allowed and sent", () => {
    const b = buildKeywordFilters(eight)
    expect(b.count).toBe(MAX_CONDITIONS)
    expect(b.tooMany).toBe(false)
    expect(b.filters).not.toBeNull()
  })

  test("9 conditions are NOT sent: tooMany, no filters, and a message that says how many to remove", () => {
    const b = buildKeywordFilters({ ...eight, intents: ["commercial"] })
    expect(b.count).toBe(9)
    expect(b.tooMany).toBe(true)
    expect(b.filters).toBeNull()
    expect(b.message).toMatch(/9 conditions/)
    expect(b.message).toMatch(/at most 8/)
    expect(b.message).toMatch(/Remove 1 or more/)
  })

  test("every filter at once is 11 conditions", () => {
    const b = buildKeywordFilters({ ...eight, intents: ["commercial"], movement: "new", url: "/x/" })
    expect(b.count).toBe(11)
    expect(b.message).toMatch(/Remove 3 or more/)
  })
})

describe("buildKeywordFilters: invalid ranges are reported, never sent", () => {
  test("min greater than max: both are dropped and the field is told why", () => {
    const b = buildKeywordFilters(state({ volMin: "500", volMax: "100" }))
    expect(b.count).toBe(0)
    expect(b.errors.volume).toMatch(/minimum is greater than the maximum/)
  })

  test("not a whole number / out of bounds / negative", () => {
    expect(buildKeywordFilters(state({ volMin: "abc" })).errors.volume).toMatch(/whole numbers/)
    expect(buildKeywordFilters(state({ volMin: "1.5" })).errors.volume).toBeTruthy()
    expect(buildKeywordFilters(state({ volMin: "-5" })).errors.volume).toBeTruthy()
    expect(buildKeywordFilters(state({ kdMax: "150" })).errors.difficulty).toMatch(/0 to 100/)
    expect(buildKeywordFilters(state({ kdMax: "150" })).count).toBe(0)
  })

  test("one bad range does not drop the other filters", () => {
    const b = buildKeywordFilters(state({ q: "eye", kdMin: "90", kdMax: "10" }))
    expect(b.conditions).toEqual([[FIELD.keyword, "like", "%eye%"]])
    expect(b.errors.difficulty).toBeTruthy()
  })
})

describe("describeActiveFilters: removable chips", () => {
  test("nothing applied, no chips", () => {
    expect(describeActiveFilters(state())).toEqual([])
  })

  test("one chip per applied filter, each with the patch that removes only it", () => {
    const chips = describeActiveFilters(state({ q: "Eye", exclude: "cost", position: "top3", volMin: "100", volMax: "5000", kdMax: "40", intents: ["commercial"], movement: "down", url: "/blog/" }))
    expect(chips.map((c) => c.label)).toEqual([
      "Keyword contains “eye”",
      "Excludes “cost”",
      "Position: Top 3",
      "Volume 100–5,000",
      "KD ≤ 40",
      "Intent: Commercial",
      "Movement: Declined",
      "URL contains “/blog/”",
    ])
    expect(chips.find((c) => c.id === "volume").clear).toEqual({ volMin: "", volMax: "" })
    expect(chips.find((c) => c.id === "position").clear).toEqual({ position: "all" })
    expect(chips.find((c) => c.id === "intents").clear).toEqual({ intents: [] })
  })

  test("a range that is invalid, or all four intents, is not shown as a chip (it does not narrow anything)", () => {
    expect(describeActiveFilters(state({ volMin: "9", volMax: "1" }))).toEqual([])
    expect(describeActiveFilters(state({ intents: ["informational", "navigational", "commercial", "transactional"] }))).toEqual([])
  })
})

describe("buildKeywordQuery", () => {
  test("page 3 of 50 is offset 100; the sort becomes '<field>,<dir>'", () => {
    const q = buildKeywordQuery(state({ page: 3, pageSize: 50, sort: "volume", dir: "asc" }))
    expect(q).toMatchObject({ limit: 50, offset: 100, order_by: `${FIELD.volume},asc`, filters: [] })
  })

  test("defaults: traffic descending, page 1, no filters", () => {
    expect(buildKeywordQuery(state({ page: 1, pageSize: 50, sort: "traffic", dir: "desc" }))).toMatchObject({ limit: 50, offset: 0, order_by: `${FIELD.traffic},desc`, filters: [] })
  })

  test("an unknown sort falls back to traffic; the export asks for the first 1,000 rows regardless of the page", () => {
    expect(buildKeywordQuery(state({ page: 4, pageSize: 25, sort: "bogus", dir: "sideways" })).order_by).toBe(`${FIELD.traffic},desc`)
    expect(buildKeywordQuery(state({ page: 4, pageSize: 25 }), { limit: 1000, offset: 0 })).toMatchObject({ limit: 1000, offset: 0 })
  })

  test("filters are carried in the provider shape, and a too-large set is not", () => {
    expect(buildKeywordQuery(state({ q: "eye" })).filters).toEqual([FIELD.keyword, "like", "%eye%"])
    const many = buildKeywordQuery(state({ q: "a", exclude: "b", position: "11-20", volMin: "1", volMax: "2", kdMin: "1", kdMax: "2", movement: "new" }))
    expect(many.built.tooMany).toBe(true)
    expect(many.filters).toEqual([])
  })
})
