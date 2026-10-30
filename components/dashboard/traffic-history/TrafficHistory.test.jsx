import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hook (window rules), query keys, mapping and components run.
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DEFAULT_HISTORY_MONTHS: 12,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
}))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: project.current }) }))

import TrafficHistoryDashboard from "./TrafficHistoryDashboard"
import { REAL_ITEMS, OLDER_ITEMS, envelope } from "./testFixtures"

const ok = (data) => ({ success: true, data })
const win12 = () => ok(envelope(REAL_ITEMS, 12))
const win24 = () => ok(envelope([...REAL_ITEMS, ...OLDER_ITEMS], 24))
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })

/** Default server: 12 months unless 24 is asked for. Override per test. */
function serve(impl) {
  svc.getSection.mockImplementation(impl || (async (_pid, _section, opts) => (opts?.months === 24 ? win24() : win12())))
}
const calls = () => svc.getSection.mock.calls.map(([pid, section, opts]) => ({ pid, section, refresh: Boolean(opts?.refresh), months: opts?.months }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(TrafficHistoryDashboard)))
}

const rows = () => within(screen.getByTestId("th-table")).getAllByTestId("th-row")
const range = (n) => within(screen.getByTestId("th-range")).getByRole("button", { name: `${n} months` })
const pressed = (n) => range(n).getAttribute("aria-pressed")
const deferred = () => { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 }) // headroom for a loaded full-suite run
  vi.setConfig({ testTimeout: 30000 })
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
  vi.clearAllMocks()
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  serve()
})

describe("Traffic History: loading and the header", () => {
  test("one request to the shared history route, for the default 12-month window, without skipping the cache", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    expect(calls()).toEqual([{ pid: "p1", section: "history", refresh: false, months: 12 }])
  })

  test("the page frame is there at once and every section has its own skeleton", async () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { name: "Traffic History" })).toBeTruthy()
    expect(screen.getByTestId("th-domain").textContent).toBe("asgeyehospital.com") // from the project, before any answer
    expect(document.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThanOrEqual(8)
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.getByRole("group", { name: "Date range" })).toBeTruthy() // the selector is usable straight away
  })

  test("shows the domain, the market, the range selector (12 by default) and when the data was fetched", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    expect(screen.getByTestId("th-domain").textContent).toBe("asgeyehospital.com")
    expect(screen.getByTestId("th-market").textContent).toBe("India · English")
    expect(screen.getByTestId("th-updated").textContent).toMatch(/^Last updated .*2026/)
    expect([6, 12, 24].map(pressed)).toEqual(["false", "true", "false"])
  })

  test("asks for a project when none is selected", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its traffic history.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
  })
})

describe("Traffic History: summary cards", () => {
  test("latest month vs the first month of the range, with the peak underneath (real asgeyehospital.com figures)", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    const card = (k) => screen.getByTestId(`th-card-${k}`)

    expect(card("traffic").textContent).toMatch(/Organic Traffic.*100\.9K/)
    expect(screen.getByTestId("th-change-traffic").getAttribute("data-direction")).toBe("down")
    expect(screen.getByTestId("th-change-traffic").textContent).toMatch(/48\.4%/)
    expect(screen.getByTestId("th-change-traffic").className).toMatch(/red/)
    expect(card("traffic").textContent).toMatch(/vs Oct 25/)
    expect(screen.getByTestId("th-peak-traffic").textContent).toBe("Peak: 195.8K (Oct 25)")

    expect(card("keywords").textContent).toMatch(/4\.2K/)
    expect(screen.getByTestId("th-change-keywords").textContent).toMatch(/71\.1%/)
    expect(screen.getByTestId("th-peak-keywords").textContent).toBe("Peak: 16.6K (Feb 26)")

    expect(card("value").textContent).toMatch(/\$25\.1K/)
    expect(screen.getByTestId("th-change-value").textContent).toMatch(/60\.3%/)
    expect(screen.getByTestId("th-peak-value").textContent).toBe("Peak: $63.2K (Oct 25)")

    expect(card("top10").textContent).toMatch(/1\.5K/)
    expect(screen.getByTestId("th-change-top10").getAttribute("data-direction")).toBe("up")
    expect(screen.getByTestId("th-change-top10").className).toMatch(/emerald/)
    expect(screen.getByTestId("th-change-top10").textContent).toMatch(/20\.6%/)
    expect(screen.getByTestId("th-peak-top10").textContent).toBe("Peak: 1.5K (Jan 26)")
  })

  test("the exact figure is on hover, and traffic is labelled as an estimate with the CTR hint", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    expect(within(screen.getByTestId("th-card-traffic")).getByText("100.9K").getAttribute("title")).toBe("100,942")
    expect(within(screen.getByTestId("th-card-traffic")).getByText("Est. traffic")).toBeTruthy()
    const hint = within(screen.getByTestId("th-card-traffic")).getByRole("button", { name: "About Organic Traffic" })
    expect(document.getElementById(hint.getAttribute("aria-describedby")).textContent).toBe("Estimated from rankings × CTR")
  })

  test("the comparison and the peak follow the selected range", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    fireEvent.click(range(6))
    expect(screen.getByTestId("th-change-traffic").textContent).toMatch(/31\.2%/)
    expect(screen.getByTestId("th-card-traffic").textContent).toMatch(/vs Apr 26/)
    expect(screen.getByTestId("th-peak-traffic").textContent).toBe("Peak: 166.6K (May 26)")
  })

  test("four columns wide, two at medium, one on a phone", async () => {
    renderPage()
    const cls = (await screen.findByTestId("th-summary")).className
    expect(cls).toMatch(/\bgrid-cols-1\b/)
    expect(cls).toMatch(/@min-\[560px\]\/main:grid-cols-2/)
    expect(cls).toMatch(/@min-\[1100px\]\/main:grid-cols-4/)
    expect(screen.getByTestId("th-summary").children).toHaveLength(4)
  })
})

describe("Traffic History: the date range never costs more than it must", () => {
  test("6 and 12 months are slices of the data already loaded — switching makes NO new request", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    expect(rows()).toHaveLength(13)
    fireEvent.click(range(6))
    expect(rows()).toHaveLength(7)
    expect(pressed(6)).toBe("true")
    fireEvent.click(range(12))
    expect(rows()).toHaveLength(13)
    fireEvent.click(range(6))
    fireEvent.click(range(12))
    expect(calls()).toHaveLength(1)
  })

  test("24 months fetches ONCE (and says so while it loads); after that every range is a slice", async () => {
    const pending = deferred()
    serve(async (_pid, _section, opts) => (opts?.months === 24 ? pending.promise : win12()))
    renderPage()
    await screen.findByTestId("th-summary")

    fireEvent.click(range(24))
    await screen.findByText("Loading 24 months of history…")
    expect(calls().slice(1)).toEqual([{ pid: "p1", section: "history", refresh: false, months: 24 }])
    expect(pressed(24)).toBe("true")
    expect(rows()).toHaveLength(13) // what is already loaded stays on screen meanwhile
    expect(screen.queryByRole("alert")).toBeNull()

    await act(async () => { pending.resolve(win24()) })
    await waitFor(() => expect(rows()).toHaveLength(25))
    expect(screen.queryByText("Loading 24 months of history…")).toBeNull()

    for (const n of [12, 6, 24, 12, 24]) {
      fireEvent.click(range(n))
      expect(rows()).toHaveLength(n + 1)
    }
    expect(calls()).toHaveLength(2) // the 12-month load and the single 24-month load
  })

  test("a failed 24-month load shows an error with Retry, and 12 months still works without any new request", async () => {
    serve(async (_pid, _section, opts) => { if (opts?.months === 24) throw apiError("The data service took too long to respond. Please try again.", { status: 504, code: "PROVIDER_TIMEOUT" }); return win12() })
    renderPage()
    await screen.findByTestId("th-summary")
    fireEvent.click(range(24))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/took too long to respond/)
    fireEvent.click(range(12))
    await screen.findByTestId("th-summary")
    expect(rows()).toHaveLength(13)
    expect(calls()).toHaveLength(2) // 12, then the failed 24: going back to 12 did not call again
  })

  test("the same API 2 route serves both pages: only the history section is ever requested", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    fireEvent.click(range(24))
    await waitFor(() => expect(rows()).toHaveLength(25))
    expect(new Set(calls().map((c) => c.section))).toEqual(new Set(["history"]))
  })
})

describe("Traffic History: refresh", () => {
  test("Refresh skips the cache for the window on screen, once", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(calls()).toHaveLength(2))
    expect(calls()[1]).toEqual({ pid: "p1", section: "history", refresh: true, months: 12 })
    await screen.findByRole("button", { name: "Refresh" })
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(calls()).toHaveLength(3))
    expect(calls()[2].refresh).toBe(true)
  })

  test("after loading 24 months, Refresh refreshes the 24-month window", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    fireEvent.click(range(24))
    await waitFor(() => expect(rows()).toHaveLength(25))
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(calls()).toHaveLength(3))
    expect(calls()[2]).toEqual({ pid: "p1", section: "history", refresh: true, months: 24 })
  })

  test("a refresh the server declined to repeat says so", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    serve(async () => ok(envelope(REAL_ITEMS, 12, { refreshThrottled: true })))
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(await screen.findByText(/refreshed less than a minute ago/)).toBeTruthy()
  })
})

describe("Traffic History: charts", () => {
  test("all four charts have a titled section", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    for (const name of ["Organic traffic & keywords", "Traffic value", "Ranking distribution over time", "Keyword movement per month", "Monthly data"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy()
    }
    for (const id of ["th-main-chart", "th-value-chart", "th-distribution-chart", "th-movement-chart"]) expect(screen.getByTestId(id)).toBeTruthy()
  })

  test("main chart: the legend items hide and show a series", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    const legend = screen.getByRole("list", { name: "Series shown in the chart" })
    const traffic = within(legend).getByRole("button", { name: "Est. traffic" })
    const keywords = within(legend).getByRole("button", { name: "Keywords" })
    expect([traffic, keywords].map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "true"])
    fireEvent.click(keywords)
    expect(keywords.getAttribute("aria-pressed")).toBe("false")
    expect(screen.getByTestId("th-main-chart")).toBeTruthy()
    fireEvent.click(traffic)
    expect(screen.queryByTestId("th-main-chart")).toBeNull() // nothing left to draw: say so instead of an empty chart
    expect(screen.getByText("Turn a series back on in the legend to see the chart.")).toBeTruthy()
    fireEvent.click(keywords)
    expect(screen.getByTestId("th-main-chart")).toBeTruthy()
  })

  test("main chart: the month with the biggest traffic drop is called out", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    expect(screen.getByTestId("th-drop-note").textContent).toBe("Biggest traffic drop: August 2026 (−31.1% month over month)")
    fireEvent.click(range(6)) // Aug 26 is still inside the last 6 months
    expect(screen.getByTestId("th-drop-note").textContent).toMatch(/August 2026/)
  })

  test("paid traffic is hidden entirely when every month's paid traffic is 0", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    expect(screen.queryByRole("button", { name: "Paid traffic" })).toBeNull()
  })

  test("with any paid traffic, a 'Paid traffic' series toggle appears", async () => {
    const paid = REAL_ITEMS.map((i) => (i.year === 2026 && i.month === 8 ? { ...i, paid: { etv: 120, count: 4, estimated_paid_traffic_cost: 10 } } : i))
    serve(async () => ok(envelope(paid, 12)))
    renderPage()
    await screen.findByTestId("th-summary")
    const toggle = within(screen.getByRole("list", { name: "Series shown in the chart" })).getByRole("button", { name: "Paid traffic" })
    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(toggle)
    expect(toggle.getAttribute("aria-pressed")).toBe("false")
  })

  test("distribution: Count / % and Top 20 only", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    const chart = () => screen.getByTestId("th-distribution-chart")
    expect(chart().getAttribute("data-mode")).toBe("count")
    expect(chart().getAttribute("data-buckets")).toBe("top1,top3,top10,top20,top50,top100")

    fireEvent.click(within(screen.getByRole("group", { name: "Buckets shown" })).getByRole("button", { name: "Top 20 only" }))
    expect(chart().getAttribute("data-buckets")).toBe("top1,top3,top10,top20")
    fireEvent.click(within(screen.getByRole("group", { name: "Show counts or percentages" })).getByRole("button", { name: "%" }))
    expect(chart().getAttribute("data-mode")).toBe("percent")
    expect(chart().getAttribute("data-buckets")).toBe("top1,top3,top10,top20") // the two toggles combine
    fireEvent.click(within(screen.getByRole("group", { name: "Buckets shown" })).getByRole("button", { name: "All" }))
    expect(chart().getAttribute("data-buckets")).toBe("top1,top3,top10,top20,top50,top100")
    expect(within(screen.getByRole("list", { name: "Position buckets" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["#1", "#2–3", "#4–10", "#11–20", "#21–50", "#51–100"])
  })
})

describe("Traffic History: monthly table", () => {
  test("newest month first; Δ columns are coloured with arrows; the oldest month shows —", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    const r = rows()
    const cells = (row) => within(row).getAllByRole("cell")

    expect(cells(r[0])[0].textContent).toBe("Oct 26")
    expect(cells(r[0])[1].textContent).toBe("100.9K")
    expect(cells(r[0])[1].querySelector("span").getAttribute("title")).toBe("100,942")
    const up = cells(r[0])[2].querySelector("[data-direction]")
    expect(up.getAttribute("data-direction")).toBe("up")
    expect(up.textContent).toMatch(/▲.*62\.3%/)
    expect(up.className).toMatch(/emerald/)
    expect(cells(r[0])[5].textContent).toBe("$25.1K")

    const aug = r.find((row) => cells(row)[0].textContent === "Aug 26")
    const down = cells(aug)[2].querySelector("[data-direction]")
    expect(down.getAttribute("data-direction")).toBe("down")
    expect(down.textContent).toMatch(/▼.*31\.1%/)
    expect(down.className).toMatch(/red/)

    const oldest = r.at(-1)
    expect(cells(oldest)[0].textContent).toBe("Oct 25")
    expect(cells(oldest)[2].textContent).toBe("—")
    expect(cells(oldest)[4].textContent).toBe("—")
  })

  test("has every column the spec asks for, in order", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    const heads = within(screen.getByTestId("th-table")).getAllByRole("columnheader").map((h) => h.querySelector("button").textContent)
    expect(heads).toEqual(["Month", "Traffic", "Δ Traffic %", "Keywords", "Δ Keywords %", "Traffic value", "#1", "#2–3", "#4–10", "#11–20", "New", "Up", "Down", "Lost"])
  })

  test("every column sorts: first click descending, second ascending, with aria-sort", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    const table = screen.getByTestId("th-table")
    const first = () => within(rows()[0]).getAllByRole("cell")[0].textContent
    const header = (label) => within(table).getByRole("button", { name: label }).closest("th")

    expect(header("Month").getAttribute("aria-sort")).toBe("descending")
    fireEvent.click(within(table).getByRole("button", { name: "Traffic" }))
    expect(first()).toBe("Oct 25") // 195.8K is the highest
    expect(header("Traffic").getAttribute("aria-sort")).toBe("descending")
    expect(header("Month").getAttribute("aria-sort")).toBe("none")
    fireEvent.click(within(table).getByRole("button", { name: "Traffic" }))
    expect(first()).toBe("Sep 26") // 62.2K is the lowest
    expect(header("Traffic").getAttribute("aria-sort")).toBe("ascending")

    fireEvent.click(within(table).getByRole("button", { name: "Δ Traffic %" }))
    expect(first()).toBe("Oct 26") // +62.3%
    fireEvent.click(within(table).getByRole("button", { name: "Δ Traffic %" }))
    expect(first()).toBe("Aug 26") // −31.1%; the oldest month (no change) is last either way
    expect(within(rows().at(-1)).getAllByRole("cell")[0].textContent).toBe("Oct 25")

    for (const label of ["Keywords", "Δ Keywords %", "Traffic value", "#1", "#2–3", "#4–10", "#11–20", "New", "Up", "Down", "Lost"]) {
      fireEvent.click(within(table).getByRole("button", { name: label }))
      expect(header(label).getAttribute("aria-sort")).toBe("descending")
      expect(rows()).toHaveLength(13)
    }
  })

  test("a month without data shows — and sorts last", async () => {
    const gap = REAL_ITEMS.map((i) => (i.year === 2026 && i.month === 3 ? { ...i, etv: null, count: null, estimated_paid_traffic_cost: null } : i))
    serve(async () => ok(envelope(gap, 12)))
    renderPage()
    await screen.findByTestId("th-summary")
    const mar = rows().find((row) => within(row).getAllByRole("cell")[0].textContent === "Mar 26")
    expect(within(mar).getAllByRole("cell")[1].textContent).toBe("—")
    expect(within(mar).getAllByRole("cell")[5].textContent).toBe("—")
    expect(mar.textContent).not.toMatch(/NaN|undefined/)
    fireEvent.click(within(screen.getByTestId("th-table")).getByRole("button", { name: "Traffic" }))
    expect(within(rows().at(-1)).getAllByRole("cell")[0].textContent).toBe("Mar 26")
  })

  test("the table scrolls sideways on a narrow screen instead of squashing", async () => {
    renderPage()
    const table = await screen.findByTestId("th-table")
    expect(table.className).toMatch(/min-w-\[1100px\]/)
    expect(table.closest('[data-slot="table-container"]').className).toMatch(/overflow-x-auto/)
  })
})

describe("Traffic History: CSV export", () => {
  async function exportedText() {
    const blobs = []
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    globalThis.URL.createObjectURL = vi.fn((b) => { blobs.push(b); return "blob:test" })
    globalThis.URL.revokeObjectURL = vi.fn()
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }))
    await waitFor(() => expect(blobs).toHaveLength(1))
    const text = await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsText(blobs[0]) })
    const download = clicks.mock.contexts[0]?.download
    clicks.mockRestore()
    delete globalThis.URL.createObjectURL
    delete globalThis.URL.revokeObjectURL
    return { lines: text.replace(/^﻿/, "").split("\r\n"), download }
  }

  test("exports the table for the selected range, in the order shown, with the file named after the domain and range", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    fireEvent.click(range(6))
    const { lines, download } = await exportedText()
    expect(lines[0]).toBe("Month,Est. traffic,Traffic change %,Keywords,Keywords change %,Traffic value (USD),#1,#2–3,#4–10,#11–20,New,Up,Down,Lost")
    expect(lines).toHaveLength(8) // header + 7 months
    expect(lines[1]).toMatch(/^2026-10,100942,62\.3,4166,/)
    expect(lines.at(-1)).toMatch(/^2026-04,/)
    expect(download).toBe("traffic-history_asgeyehospital.com_6-months.csv")
    expect(await screen.findByText("Exported 7 months.")).toBeTruthy()
  })

  test("follows the current sort", async () => {
    renderPage()
    await screen.findByTestId("th-summary")
    fireEvent.click(within(screen.getByTestId("th-table")).getByRole("button", { name: "Traffic" }))
    const { lines } = await exportedText()
    expect(lines[1]).toMatch(/^2025-10,195799,/) // highest traffic first
    expect(lines).toHaveLength(14)
  })
})

describe("Traffic History: every section fails and recovers on its own", () => {
  test("an error shows inline in each section, with Retry, and Retry asks again", async () => {
    let healthy = false
    serve(async () => { if (!healthy) throw apiError("The data service is temporarily unavailable. Please try again later."); return win12() })
    renderPage()
    const alerts = await screen.findAllByRole("alert")
    expect(alerts).toHaveLength(6) // summary, 4 charts, table
    for (const a of alerts) {
      expect(a.textContent).toMatch(/temporarily unavailable/)
      expect(within(a).getByRole("button", { name: "Retry" })).toBeTruthy()
    }
    expect(screen.getByRole("heading", { name: "Monthly data" })).toBeTruthy() // the sections' frames stay
    healthy = true
    fireEvent.click(within(alerts[0]).getByRole("button", { name: "Retry" }))
    await screen.findByTestId("th-summary")
    expect(screen.queryByRole("alert")).toBeNull()
    expect(rows()).toHaveLength(13)
    expect(calls()).toHaveLength(2)
  })

  test("an offline request gets a plain connectivity message", async () => {
    serve(async () => { throw new Error("Failed to fetch") })
    renderPage()
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/Couldn't reach Odito/)
  })

  test("a project without a public domain gets one message, not six errors", async () => {
    serve(async () => { throw apiError("The project's website does not have a public domain name", { status: 422, code: "INVALID_TARGET" }) })
    renderPage()
    expect(await screen.findByText(/does not have a public domain name, so its traffic history cannot be loaded/)).toBeTruthy()
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
    expect(screen.queryByTestId("th-summary")).toBeNull()
  })
})

describe("Traffic History: not enough data", () => {
  test("fewer than 2 months shows one friendly message instead of charts", async () => {
    serve(async () => ok(envelope([REAL_ITEMS[0]], 12)))
    renderPage()
    expect(await screen.findByText("Not enough history yet for this domain.")).toBeTruthy()
    for (const id of ["th-summary", "th-main-chart", "th-distribution-chart", "th-movement-chart", "th-table"]) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByRole("group", { name: "Date range" })).toBeTruthy() // the user can still widen the range
  })

  test("no months at all is the same message", async () => {
    serve(async () => ok(envelope([], 12)))
    renderPage()
    expect(await screen.findByText("Not enough history yet for this domain.")).toBeTruthy()
  })
})
