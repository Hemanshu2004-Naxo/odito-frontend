import { describe, expect, test } from "vitest"
import { buildReferringDomainsCsv, CSV_COLUMNS, csvCell, referringDomainsCsvFileName } from "./exportCsv"
import { referringDomainsExportQuery } from "./exportStream"
import { mapReferringDomain } from "./mapReferringDomain"
import { backlinksHref } from "./ExpandedDomain"
import { REAL_RD } from "./testFixtures"

const rows = (settings = {}) => REAL_RD.items.map((i) => mapReferringDomain(i, settings, { now: 0 }))

describe("the referring domains CSV", () => {
  test("the columns of the brief, in order — the same header as the server's export", () => {
    expect(CSV_COLUMNS.map(([h]) => h).join(",")).toBe("Domain,Quality,Rank,Backlinks,Referring pages,Dofollow %,Spam score,Placement,Top country,Broken backlinks,First seen,Lost date,Disavowed")
  })
  test("one header line and one line per domain", () => {
    expect(buildReferringDomainsCsv(rows()).split("\r\n")).toHaveLength(11)
  })
  test("a real row, exactly what the server writes for it", () => {
    const row = rows({ disavowed: ["vasaneye.com"] })[0]
    const [, line] = buildReferringDomainsCsv([row]).split("\r\n")
    expect(line).toBe(`vasaneye.com,Medium,258,761,761,100,0,footer,IN,761,${row.firstSeen.raw},,yes`)
  })
  test("the Disavowed column follows the project's list", () => {
    const lines = buildReferringDomainsCsv(rows({ disavowed: ["net-pals.com"] })).split("\r\n")
    expect(lines.filter((l) => l.endsWith(",yes"))).toHaveLength(1)
    expect(lines.find((l) => l.startsWith("net-pals.com,"))).toMatch(/,yes$/)
  })
  test("a missing value is an empty cell, never 0; an unknown country or placement is empty", () => {
    const row = mapReferringDomain({ domain: "a.com", top_country: "", main_placement: "" })
    expect(buildReferringDomainsCsv([row]).split("\r\n")[1]).toBe("a.com,,,,,,,,,,,,no")
  })
  test("a domain that looks like a formula is neutralised", () => {
    expect(buildReferringDomainsCsv([mapReferringDomain({ domain: "=cmd|x" })]).split("\r\n")[1].startsWith("'=cmd|x")).toBe(true)
    expect(csvCell("=1+1")).toBe("'=1+1")
    expect(csvCell('a, "b"')).toBe('"a, ""b"""')
    expect(csvCell(null)).toBe("")
    expect(csvCell(NaN)).toBe("")
  })
  test("file names say what they hold", () => {
    const day = new Date("2026-10-28T10:00:00Z")
    expect(referringDomainsCsvFileName("asgeyehospital.com", "page", day)).toBe("referring-domains_asgeyehospital.com_page_2026-10-28.csv")
    expect(referringDomainsCsvFileName("a/b c.com", "toxic_all", day)).toBe("referring-domains_a-b-c.com_toxic_all_2026-10-28.csv")
  })
})

describe("the server export's query string", () => {
  const base = { status: "live", dofollow: false, limit: 50, offset: 0, order_by: "rank,desc", filters: [] }
  test("the plain view sends nothing but the row count the user agreed to", () => {
    expect(referringDomainsExportQuery(base, 10000)).toBe("max_rows=10000")
  })
  test("status, dofollow, sort and filters; never limit or offset (the server pages by itself)", () => {
    const q = new URLSearchParams(referringDomainsExportQuery({ ...base, status: "lost", dofollow: true, limit: 25, offset: 50, order_by: "backlinks,asc", filters: ["rank", ">=", 5] }, 500))
    expect(Object.fromEntries(q)).toEqual({ status: "lost", dofollow: "1", order_by: "backlinks,asc", filters: '["rank",">=",5]', max_rows: "500" })
  })
})

describe("View backlinks", () => {
  test("opens the Backlinks page filtered to this one source domain", () => {
    expect(backlinksHref("vasaneye.com")).toBe("/app/backlinks/list?from=vasaneye.com")
  })
})
