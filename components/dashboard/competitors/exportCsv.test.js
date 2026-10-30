import { describe, test, expect } from "vitest"
import { buildCompetitorsCsv, competitorsCsvFileName, CSV_COLUMNS } from "./exportCsv"
import { mapCompetitor } from "./mapCompetitor"
import { REAL_COMPETITORS } from "./testFixtures"

const rows = REAL_COMPETITORS.slice(0, 3).map((c) => mapCompetitor(c, { ourTotalKeywords: 4139 }))

describe("competitors CSV (the rows on screen)", () => {
  const lines = buildCompetitorsCsv(rows, { tracked: new Set(["dragarwal.com"]) }).split("\r\n")

  test("one header and one line per competitor, in the documented column order", () => {
    expect(lines).toHaveLength(4)
    expect(lines[0].split(",")).toHaveLength(CSV_COLUMNS.length)
    expect(lines[0].startsWith("Domain,Tracked,Shared keywords,")).toBe(true)
  })

  test("real values for dragarwal.com: whole numbers, ours vs theirs in the right columns, tracked flag", () => {
    const cells = Object.fromEntries(CSV_COLUMNS.map(([h], i) => [h, lines[1].split(",")[i]]))
    expect(cells).toMatchObject({
      Domain: "dragarwal.com", Tracked: "yes", "Shared keywords": "2423", "Their avg. position": "12.8", "Their total keywords": "10222",
      "Their total traffic": "328637", "Their traffic value (USD)": "138179",
      "Your traffic on shared keywords": "26008", "Their traffic on shared keywords": "36883", "Your #1 rankings": "32", "Their #1 rankings": "213",
    })
    expect(cells["Shared keywords (% of your keywords)"]).toBe("58.5")
    expect(lines[2].split(",")[1]).toBe("no")
  })

  test("a missing value is an empty cell, never 0; text is formula-guarded", () => {
    const csv = buildCompetitorsCsv([mapCompetitor({ domain: "=cmd|' /C calc'!A0", intersections: null }), mapCompetitor({ domain: "solo.com" })])
    const [, evil, solo] = csv.split("\r\n")
    expect(evil.startsWith("'=") || evil.startsWith("\"'=")).toBe(true)
    expect(solo).toBe("solo.com,no,,,,,,,,,,,,,,")
  })

  test("no rows is just the header; the file name carries the domain and date", () => {
    expect(buildCompetitorsCsv([]).split("\r\n")).toHaveLength(1)
    expect(competitorsCsvFileName("AsgEyeHospital.com", new Date("2026-10-27T10:00:00Z"))).toBe("competitors_asgeyehospital.com_2026-10-27.csv")
    expect(competitorsCsvFileName(null, new Date("2026-10-27T10:00:00Z"))).toBe("competitors_domain_2026-10-27.csv")
  })
})
