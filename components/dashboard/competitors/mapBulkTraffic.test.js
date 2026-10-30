import { describe, test, expect } from "vitest"
import { mapBulkTraffic, sortComparison } from "./mapBulkTraffic"
import { REAL_BULK_ITEMS } from "./testFixtures"

const envelope = (items) => ({ result: { items } })
const byDomain = (rows) => Object.fromEntries(rows.map((r) => [r.domain, r]))

describe("mapBulkTraffic: matched by target, never by index", () => {
  const requested = ["asgeyehospital.com", "centreforsight.net", "dragarwal.com"]

  test("rows come back in the REQUESTED order even when the provider answers in another", () => {
    const shuffled = [REAL_BULK_ITEMS[2], REAL_BULK_ITEMS[0], REAL_BULK_ITEMS[1]] // dragarwal, asgey, centre
    const rows = mapBulkTraffic(envelope(shuffled), requested)
    expect(rows.map((r) => r.domain)).toEqual(requested)
    expect(byDomain(rows)["dragarwal.com"].organicTraffic).toBe(328637.02829471906)
    expect(byDomain(rows)["centreforsight.net"].organicKeywords).toBe(6595)
  })

  test("the first requested target is the project", () => {
    const rows = mapBulkTraffic(envelope(REAL_BULK_ITEMS), requested)
    expect(rows.map((r) => r.isProject)).toEqual([true, false, false])
  })

  test("all four traffic types and the paid keyword count are read (real values)", () => {
    const row = byDomain(mapBulkTraffic(envelope(REAL_BULK_ITEMS), requested))["centreforsight.net"]
    expect(row).toMatchObject({
      found: true, noData: false, organicTraffic: 122538.52720367993, organicKeywords: 6595, localPackTraffic: 12274.900798082352,
      featuredSnippetTraffic: 199.09065639972687, paidTraffic: 0, paidKeywords: 0,
    })
  })

  test("a target the provider did not answer for is present, with nothing invented", () => {
    const rows = mapBulkTraffic(envelope([REAL_BULK_ITEMS[0]]), requested)
    const missing = rows[2]
    expect(missing).toMatchObject({ domain: "dragarwal.com", found: false, noData: false, organicTraffic: null, localPackTraffic: null, paidKeywords: null })
  })

  test("any metric can be null: it stays null (shown as '—'), never 0", () => {
    const rows = mapBulkTraffic(envelope([
      { target: "a.com", organic: { etv: 10, count: 2 }, paid: null, featured_snippet: null, local_pack: null },
    ]), ["me.com", "a.com"])
    expect(rows[1]).toMatchObject({ found: true, noData: false, organicTraffic: 10, paidTraffic: null, paidKeywords: null, localPackTraffic: null, featuredSnippetTraffic: null })
  })

  test("a domain the provider has nothing on comes back as all zeros: flagged noData (the real xyz123 domain)", () => {
    const rows = mapBulkTraffic(envelope(REAL_BULK_ITEMS), ["asgeyehospital.com", "this-domain-does-not-exist-xyz123.com"])
    expect(rows[1]).toMatchObject({ found: true, noData: true, organicTraffic: 0 })
    expect(rows[0].noData).toBe(false)
  })

  test("targets are compared in clean form (case, www., protocol); duplicates collapse; junk is tolerated", () => {
    const rows = mapBulkTraffic(envelope([{ target: "Dragarwal.com", organic: { etv: 1, count: 1 }, paid: null, featured_snippet: null, local_pack: null }, null, {}]), ["me.com", "https://www.dragarwal.com/", "DRAGARWAL.com"])
    expect(rows.map((r) => r.domain)).toEqual(["me.com", "dragarwal.com"])
    expect(rows[1].found).toBe(true)
    expect(mapBulkTraffic(null, ["a.com"])).toHaveLength(1)
    expect(mapBulkTraffic(undefined, undefined)).toEqual([])
  })
})

describe("sortComparison: the project stays on top, nulls go last", () => {
  const rows = [
    { domain: "b.com", isProject: false, organicTraffic: 5 },
    { domain: "me.com", isProject: true, organicTraffic: 1 },
    { domain: "a.com", isProject: false, organicTraffic: 50 },
    { domain: "n.com", isProject: false, organicTraffic: null },
    { domain: "c.com", isProject: false, organicTraffic: 20 },
  ]

  test("descending", () => {
    expect(sortComparison(rows, "organicTraffic", "desc").map((r) => r.domain)).toEqual(["me.com", "a.com", "c.com", "b.com", "n.com"])
  })

  test("ascending: the project is still first and the unknown still last", () => {
    expect(sortComparison(rows, "organicTraffic", "asc").map((r) => r.domain)).toEqual(["me.com", "b.com", "c.com", "a.com", "n.com"])
  })

  test("by domain name, and it does not change the input", () => {
    const copy = [...rows]
    expect(sortComparison(rows, "domain", "asc").map((r) => r.domain)).toEqual(["me.com", "a.com", "b.com", "c.com", "n.com"])
    expect(rows).toEqual(copy)
  })
})
