import { describe, test, expect } from "vitest"
import { CSV_COLUMNS, buildKeywordsCsv, keywordsCsvFileName } from "./exportCsv"
import { mapRankedKeyword } from "./mapRankedKeyword"
import { REAL_METRICS, REAL_ROWS, TARGET } from "./testFixtures"

const rows = REAL_ROWS.map((r) => mapRankedKeyword(r, { target: TARGET, domainTraffic: REAL_METRICS.etv }))
const parse = (csv) => csv.split("\r\n").map((l) => l)

describe("keywords CSV", () => {
  test("columns are exactly the ones asked for, in order", () => {
    expect(CSV_COLUMNS.map(([h]) => h)).toEqual([
      "Keyword", "Position", "Previous position (absolute)", "Volume", "KD", "CPC (USD)", "Intent", "Traffic", "Traffic value (USD)", "URL", "SERP features",
    ])
    expect(buildKeywordsCsv(rows).split("\r\n")[0]).toBe(CSV_COLUMNS.map(([h]) => h).join(","))
  })

  test("one line per keyword, with the values the table shows (rounded CPC, whole traffic, readable intent and features)", () => {
    const lines = parse(buildKeywordsCsv(rows))
    expect(lines).toHaveLength(rows.length + 1)
    const first = lines[1].split(",")
    expect(first[0]).toBe("asg hospital")
    expect(first[1]).toBe("1")
    expect(first[2]).toBe("") // a NEW keyword has no previous position
    expect(first[3]).toBe("74000")
    expect(first[5]).toBe("0.26") // 0.25999999046325684
    expect(first[6]).toBe("Navigational")
    expect(first[9]).toBe("https://www.asgeyehospital.com/")
    expect(lines[1]).toContain("Local pack")
  })

  test("a missing value is an empty cell, never 0", () => {
    const hajipur = rows.find((r) => r.keyword === "asg eye hospital hajipur")
    const cells = buildKeywordsCsv([hajipur]).split("\r\n")[1].split(",")
    expect(cells[5]).toBe("") // CPC
    const bare = mapRankedKeyword({ keyword: "k", rank_changes_known: false }, {})
    expect(buildKeywordsCsv([bare]).split("\r\n")[1]).toBe("k,,,,,,,,,,")
  })

  test("a keyword that starts like a spreadsheet formula is neutralised; commas and quotes are escaped", () => {
    const evil = mapRankedKeyword({ keyword: "=HYPERLINK(\"http://x\")", rank_changes_known: false }, {})
    const comma = mapRankedKeyword({ keyword: "a, \"b\"", rank_changes_known: false }, {})
    const csv = buildKeywordsCsv([evil, comma])
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://x\"\")\"")
    expect(csv).toContain("\"a, \"\"b\"\"\"")
  })

  test("the previous position is the provider's absolute rank (and labelled as such)", () => {
    const up = rows.find((r) => r.keyword === "right eye blinking for female")
    const raw = REAL_ROWS.find((r) => r.keyword === up.keyword)
    expect(buildKeywordsCsv([up]).split("\r\n")[1].split(",")[2]).toBe(String(raw.previous_position))
  })

  test("file names carry the domain, the scope and the date", () => {
    expect(keywordsCsvFileName("asgeyehospital.com", "page", new Date("2026-10-27T10:00:00Z"))).toBe("organic-keywords_asgeyehospital.com_page_2026-10-27.csv")
    expect(keywordsCsvFileName("A B/c", "top-1000", new Date("2026-01-02T00:00:00Z"))).toBe("organic-keywords_a-b-c_top-1000_2026-01-02.csv")
    expect(keywordsCsvFileName(null, "all", new Date("2026-01-02T00:00:00Z"))).toBe("organic-keywords_domain_all_2026-01-02.csv")
  })
})
