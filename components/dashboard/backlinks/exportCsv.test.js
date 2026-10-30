import { describe, test, expect } from "vitest"
import { backlinksCsvFileName, buildBacklinksCsv, CSV_COLUMNS, estimateExport, formatCostEstimate } from "./exportCsv"
import { countCsvLines, exportQuery } from "./exportStream"
import { mapBacklink } from "./mapBacklink"
import { buildBacklinkRequest } from "./buildBacklinkRequest"
import { defaultPageState } from "./urlState"
import { REAL_DEFAULT } from "./testFixtures"

const rows = REAL_DEFAULT.items.slice(0, 3).map((i) => mapBacklink(i))

describe("Export current page (rows on screen, no request)", () => {
  test("the header is the documented column list — the same one the server's export has", () => {
    expect(CSV_COLUMNS.map(([h]) => h)).toEqual([
      "Source URL", "Source title", "Source domain", "Domain rank", "Page rank", "Anchor", "Item type", "Target URL", "Target status", "Redirect target", "Dofollow",
      "Attributes", "Placement", "Spam score", "Country", "First seen", "Last seen", "New", "Lost", "Broken",
    ])
  })

  test("a real row: the same line the server writes for it (see backend backlinksList.test.js)", () => {
    const lines = buildBacklinksCsv(rows).split("\r\n")
    expect(lines).toHaveLength(4)
    expect(lines[1]).toBe("https://articlescad.com/15-amazing-facts-about-sash-window-maintenance-that-youve-never-heard-of-16477.html,Retina Eye Surgery: An Overview,articlescad.com,542,238,Retina Eye Surgery,anchor,https://asgeyehospital.com/specialities/retina-diseases/,301,https://www.asgeyehospital.com/specialities/retina-diseases/,yes,noopener; noreferrer,,10,US,2026-05-05 12:25:31 +00:00,2026-05-14 13:52:03 +00:00,no,no,no")
  })

  test("an image link exports its alt text as the anchor; a missing value is an empty cell, never 0; formulas are neutralised", () => {
    const img = mapBacklink({ url_from: "https://a.com/x", item_type: "image", anchor: null, alt: "=cmd|' /C calc'!A0" })
    const [, line] = buildBacklinksCsv([img]).split("\r\n")
    expect(line.split(",")[5]).toBe("'=cmd|' /C calc'!A0")
    expect(line.endsWith(",,,,,,,,")).toBe(false)
    expect(buildBacklinksCsv([mapBacklink({ url_from: "https://a.com/x" })]).split("\r\n")[1]).toBe("https://a.com/x,,,,,,,,,,,,,,,,,no,no,no")
  })

  test("no rows is just the header; the file name carries the domain, tab, scope and date", () => {
    expect(buildBacklinksCsv([]).split("\r\n")).toHaveLength(1)
    expect(backlinksCsvFileName("AsgEyeHospital.com", "broken", "page", new Date("2026-10-27T10:00:00Z"))).toBe("backlinks_asgeyehospital.com_broken_page_2026-10-27.csv")
  })
})

describe("the cost shown before a server export starts", () => {
  test("rows are capped at 10,000; each call costs a base plus a little per row", () => {
    expect(estimateExport(2500)).toMatchObject({ rows: 2500, batches: 3, capped: false })
    expect(estimateExport(2500).cost).toBeCloseTo(3 * 0.02 + 2500 * 0.00002, 10)
    const big = estimateExport(13591)
    expect(big).toMatchObject({ rows: 10000, batches: 10, capped: true })
    expect(big.cost).toBeCloseTo(0.4, 10)
    expect(estimateExport(1000)).toMatchObject({ rows: 1000, batches: 1, capped: false })
    expect(estimateExport(1001).batches).toBe(2)
  })

  test("nothing to export: no rows, no cost; unknown totals too", () => {
    for (const total of [0, null, undefined, -3]) expect(estimateExport(total)).toMatchObject({ rows: 0, batches: 0, cost: 0 })
  })

  test("the cost is worded as an estimate", () => {
    expect(formatCostEstimate(0.4)).toBe("about $0.40")
    expect(formatCostEstimate(0.0599)).toBe("about $0.06")
    expect(formatCostEstimate(0.004)).toBe("under $0.01")
  })
})

describe("the server export's request and progress counting", () => {
  test("it carries the page's tab, group, sort and filters — but never paging", () => {
    const state = { ...defaultPageState(), tab: "lost", group: "domain", follow: "dofollow", sort: [{ field: "first_seen", dir: "asc" }], page: 7, pageSize: 100 }
    const { request } = buildBacklinkRequest(state)
    const q = new URLSearchParams(exportQuery(request, 1500))
    expect(q.get("status")).toBe("lost")
    expect(q.get("mode")).toBe("one_per_domain")
    expect(q.getAll("order_by")).toEqual(["first_seen,asc"])
    expect(JSON.parse(q.get("filters"))).toEqual(["dofollow", "=", true])
    expect(q.get("max_rows")).toBe("1500")
    for (const k of ["limit", "offset", "token"]) expect(q.has(k)).toBe(false)
  })

  test("the default view sends only the row count", () => {
    expect(exportQuery(buildBacklinkRequest(defaultPageState()).request, 800)).toBe("order_by=rank%2Cdesc&max_rows=800")
  })

  test("counting rows in streamed text: a newline inside a quoted cell is not a row; chunks can split anywhere", () => {
    const csv = 'a,b\r\n"x\r\ny",1\r\n"say ""hi""\n",2\r\nlast,3\r\n'
    let whole = countCsvLines(csv)
    expect(whole.lines).toBe(4)
    for (let cut = 1; cut < csv.length; cut += 3) {
      let s = countCsvLines(csv.slice(0, cut))
      s = countCsvLines(csv.slice(cut), s)
      expect(s.lines, `cut at ${cut}`).toBe(4)
    }
    whole = countCsvLines("")
    expect(whole).toEqual({ inQuote: false, lines: 0 })
  })
})
