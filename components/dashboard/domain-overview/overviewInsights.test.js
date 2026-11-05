import { describe, expect, test } from "vitest"
import { buildOneLine, describeNetMonth, describePath, describePinnedPage, describePositions, describeTopKeywords, describeTrend, issueDestination, monthName } from "./overviewInsights"
import { buildOverviewCsv, overviewCsvFileName } from "./exportOverview"

const trend = (pairs) => pairs.map(([key, etv, count = null]) => ({ key, label: key, etv, count }))

describe("describePath", () => {
  test("the root, with or without a host, is the home page; anything else is named by its path", () => {
    expect(describePath("/")).toBe("home page")
    expect(describePath("www.krishnaeyecentre.com/")).toBe("home page")
    expect(describePath("https://x.com/")).toBe("home page")
    expect(describePath("/patna/")).toBe("page /patna/")
    expect(describePath("x.com/a/b")).toBe("page /a/b")
    expect(describePath(null)).toBe("home page")
  })
})

describe("buildOneLine", () => {
  const months = trend([["2026-08", 900], ["2026-09", 800], ["2026-10", 354]])
  const kpis = { trafficChange: { percent: -55.8, direction: "down", basis: "vs Sep 26" } }
  const errorIssue = { rule: "errorPages", title: "50 pages with backlinks return errors", cta: { label: "View error pages", href: "/app/backlinks/top-pages?status=error" } }

  test("traffic direction since the baseline month + the worst error page, with a button to the error pages", () => {
    const line = buildOneLine({ kpis, trend: months, issues: [errorIssue], errorTop: { path: "/", statusCode: 403, backlinks: 539 } })
    expect(line.text).toBe("Google traffic is down 56% since September, and your home page, which has 539 backlinks, returns a 403 error. Unblocking it is the biggest single fix.")
    expect(line.cta).toEqual({ label: "See the error pages", href: "/app/backlinks/top-pages?status=error" })
  })

  test("the traffic-drop issue is skipped (the first half says it); with no other issue it says nothing is urgent", () => {
    const line = buildOneLine({ kpis, trend: months, issues: [{ rule: "trafficDrop", title: "x", cta: { label: "a", href: "/b" } }] })
    expect(line.text).toBe("Google traffic is down 56% since September. No urgent problems were found.")
    expect(line.cta).toBeNull()
  })

  test("a small change is 'steady'; growth says up", () => {
    expect(buildOneLine({ kpis: { trafficChange: { percent: 3 } }, trend: months, issues: [] }).text).toMatch(/^Google traffic is steady since September\./)
    expect(buildOneLine({ kpis: { trafficChange: { percent: 22.4 } }, trend: months, issues: [] }).text).toMatch(/^Google traffic is up 22% since September\./)
  })

  test("without a traffic change the issue alone is the line; with neither there is no banner", () => {
    const broken = { rule: "brokenBacklinks", title: "792 backlinks point to broken URLs (37.9%)", cta: { label: "Fix broken links", href: "/b" } }
    expect(buildOneLine({ kpis: {}, trend: [], issues: [broken] }).text).toBe("792 backlinks point to broken URLs (37.9%). Redirecting those URLs is the biggest single fix.")
    expect(buildOneLine({ kpis: {}, trend: [], issues: [] })).toBeNull()
  })
})

describe("describeTrend", () => {
  test("first vs last month and the biggest month-over-month fall", () => {
    const t = trend([["2025-11", 1700], ["2025-12", 1600], ["2026-01", 992], ["2026-02", 1000], ["2026-10", 548]])
    expect(describeTrend(t)).toBe("Down from 1.7K to 548 visits a month. The biggest drop was January 2026 (−38%).")
  })
  test("a gap between months is not compared across; rising series say up; too little data says nothing", () => {
    expect(describeTrend(trend([["2026-01", 100], ["2026-05", 10]]))).toBe("Down from 100 to 10 visits a month.")
    expect(describeTrend(trend([["2026-01", 100], ["2026-02", 200]]))).toBe("Up from 100 to 200 visits a month.")
    expect(describeTrend(trend([["2026-01", 100]]))).toBeNull()
  })
  test("the keywords metric uses its own unit", () => {
    expect(describeTrend(trend([["2026-01", null, 120], ["2026-02", null, 101]]), "count")).toBe("Down from 120 to 101 ranking keywords. The biggest drop was February 2026 (−16%).")
  })
})

describe("describePositions", () => {
  const buckets = (v) => ["top1", "top3", "top10", "top20", "top50", "top100"].map((key, i) => ({ key, value: v[i] }))
  test("a small page-1 share says 'Only', then where most keywords sit and what that means", () => {
    expect(describePositions({ top10: { count: 7, percent: 6.9 }, buckets: buckets([1, 1, 5, 16, 53, 25]) }))
      .toBe("Only 7 keywords (6.9%) are on page 1. Most sit between positions 21 and 50, so small content fixes can move many of them up.")
  })
  test("most on page 1, or deep in 51-100", () => {
    expect(describePositions({ top10: { count: 80, percent: 80 }, buckets: buckets([60, 10, 10, 5, 5, 10]) })).toBe("80 keywords (80.0%) are on page 1. Most of your keywords are already on page 1.")
    expect(describePositions({ top10: { count: 1, percent: 1 }, buckets: buckets([1, 0, 0, 2, 3, 94]) })).toMatch(/Only 1 keyword \(1\.0%\) is on page 1\. Most sit between positions 51 and 100, so they need stronger pages/)
  })
  test("unknown top 10 says nothing", () => {
    expect(describePositions({ top10: null, buckets: [] })).toBeNull()
  })
})

describe("describeTopKeywords", () => {
  const rows = [{ keyword: "krishna eye care", traffic: 255 }, { keyword: "sri krishna eye care", traffic: 30 }, { keyword: "dr mihir kothari", traffic: 8 }]
  test("the two biggest keywords' share of all traffic; the growth sentence only when both are brand terms", () => {
    expect(describeTopKeywords(rows, 354, ["krishna"])).toBe("\"krishna eye care\" and \"sri krishna eye care\" alone bring 285 of 354 visits (81%). Non-brand keywords are where growth is.")
    expect(describeTopKeywords(rows, 354, [])).toBe("\"krishna eye care\" and \"sri krishna eye care\" alone bring 285 of 354 visits (81%).")
  })
  test("a small share or unknown total says nothing", () => {
    expect(describeTopKeywords(rows, 100000, [])).toBeNull()
    expect(describeTopKeywords(rows, null, [])).toBeNull()
  })
})

describe("small helpers", () => {
  test("pinned page note, net month, month names, button destinations", () => {
    expect(describePinnedPage([{ pinned: false }, { pinned: true, path: "/", statusCode: 403, referringDomains: 135 }])).toBe("Your home page has 135 linking sites but returns 403, so that link value is wasted.")
    expect(describePinnedPage([{ pinned: false }])).toBeNull()
    expect(describeNetMonth(-5)).toBe("This month: net −5 keywords")
    expect(describeNetMonth(1)).toBe("This month: net +1 keyword")
    expect(describeNetMonth(null)).toBeNull()
    expect(monthName("2026-09")).toBe("September")
    expect(monthName("2026-01", true)).toBe("January 2026")
    expect(issueDestination("/app/backlinks/top-pages?status=error")).toBe("Top linked pages")
    expect(issueDestination("/nowhere")).toBeNull()
  })
})

describe("buildOverviewCsv", () => {
  test("headline figures, issues and lists as rows; missing figures are empty cells, never 0", () => {
    const csv = buildOverviewCsv({
      domain: "x.com",
      market: { location: "India", language: "English" },
      vm: {
        kpis: { traffic: 354, trafficChange: { percent: -55.8, basis: "vs Sep 26" }, keywords: 101, keywordsChange: { percent: null }, trafficValue: null, domainRank: 203, backlinks: 2100, referringDomains: 195 },
        trend: [{ key: "2026-10", etv: 354, count: 101 }],
        positions: { buckets: [{ label: "#1", value: 1 }] },
        movement: { new: 45, improved: 16, declined: 36, lost: 50 },
        topKeywords: { rows: [{ keyword: "=cmd", traffic: 1, position: 1, volume: 2, difficulty: 3, path: "/" }] },
      },
      issues: [{ title: "50 pages", severity: "critical", why: "Because, reasons" }],
      topPages: [],
      summary: null,
    }).split("\r\n")
    expect(csv[0]).toBe("Section,Item,Value,Detail")
    expect(csv).toContain("Headline,Organic traffic (est. monthly),354,down 55.8% vs Sep 26")
    expect(csv).toContain("Headline,\"Traffic value (USD, est. monthly)\",") // unknown value = empty cell
    expect(csv).toContain("Fix first,50 pages,critical,\"Because, reasons\"")
    expect(csv.some((l) => l.startsWith("Top keywords,'=cmd,1,"))).toBe(true) // formula-guarded
    expect(overviewCsvFileName("x.com", new Date("2026-11-03T10:00:00Z"))).toBe("domain-overview_x.com_2026-11-03.csv")
  })
})
