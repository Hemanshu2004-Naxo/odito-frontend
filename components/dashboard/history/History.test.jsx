import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const api = vi.hoisted(() => ({ list: vi.fn(), start: vi.fn(), freshness: vi.fn(), changes: vi.fn(), comparison: vi.fn(), keywordHistory: vi.fn() }))
vi.mock("@/services/seoScanService", () => ({ default: api, seoScanService: api }))
vi.mock("@/lib/apiService", () => ({ default: { request: vi.fn() } }))

import { ProjectPageHistory } from "./ProjectPageHistory"
import ChangesPanel from "./ChangesPanel"
import DatasetFreshness from "./DatasetFreshness"
import { SnapshotDeltas, KeyedSnapshotDeltas } from "./SnapshotDeltas"
import KeywordLookup from "./KeywordLookup"
import { HISTORY_ROUTES, historyRouteFor } from "./routes"

const NOW = Date.parse("2026-11-05T12:00:00Z")
const wrap = (ui) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) }
}
const ok = (data) => Promise.resolve({ success: true, data })
const keywordSpec = HISTORY_ROUTES.find((r) => r.page === "organic-keywords").panels[0]
const domainSpec = HISTORY_ROUTES.find((r) => r.page === "referring-domains").panels[0]
const overviewSpec = HISTORY_ROUTES.find((r) => r.page === "domain-overview").panels[0]
const competitorSpec = HISTORY_ROUTES.find((r) => r.page === "competitors").panels[0]

beforeEach(() => { for (const f of Object.values(api)) f.mockReset() })

const ds = (over) => ({ id: "keywords-dataset", state: "fresh", lastSuccessfulAt: "2026-11-05T09:00:00Z", rows: 3000, providerTotal: 13591, truncated: true, lastError: null, ...over })

describe("which pages have a history section", () => {
  it("covers all nine SEO pages, each with its freshness datasets and at least one panel", () => {
    const pages = HISTORY_ROUTES.map((r) => r.page).sort()
    expect(pages).toEqual(["anchors", "backlinks", "competitors", "domain-overview", "offpage-overview", "organic-keywords", "referring-domains", "top-pages", "traffic"])
    for (const r of HISTORY_ROUTES) expect(r.panels.length).toBeGreaterThan(0)
  })
  it("matches the longest route prefix and ignores other pages", () => {
    expect(historyRouteFor("/app/backlinks/list").page).toBe("backlinks")
    expect(historyRouteFor("/app/backlinks/anchors").page).toBe("anchors")
    expect(historyRouteFor("/app/referring-domains").page).toBe("referring-domains")
    expect(historyRouteFor("/app/settings")).toBeNull()
    expect(historyRouteFor("/app/domain-overviewX")).toBeNull()
    expect(historyRouteFor(null)).toBeNull()
  })
})

describe("PageHistory", () => {
  it("is collapsed and makes NO request until it is opened; opening reads stored data only", async () => {
    api.freshness.mockReturnValue(ok({ datasets: [ds()] }))
    api.changes.mockReturnValue(ok({ hasData: false }))
    api.keywordHistory.mockReturnValue(ok({}))
    wrap(<ProjectPageHistory projectId="p1" route={historyRouteFor("/app/organic-keywords")} />)
    expect(screen.queryByTestId("dataset-freshness")).toBeNull()
    expect(api.freshness).not.toHaveBeenCalled()
    expect(api.changes).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: /history & data freshness/i }))
    await screen.findByTestId("dataset-freshness")
    expect(api.freshness).toHaveBeenCalledWith("p1", "organic-keywords", expect.anything())
    await waitFor(() => expect(api.changes).toHaveBeenCalledWith("p1", { dataset: "keywords", status: null, period: "previous" }, expect.anything()))
    expect(api.start).not.toHaveBeenCalled()
  })

  it("shows the page's note about derived figures", async () => {
    api.freshness.mockReturnValue(ok({ datasets: [] }))
    api.comparison.mockReturnValue(ok({ latest: null, previous: null }))
    wrap(<ProjectPageHistory projectId="p1" route={historyRouteFor("/app/backlinks/anchors")} defaultOpen />)
    expect(await screen.findByRole("note")).toHaveTextContent(/counted from the stored backlinks/i)
  })
})

describe("DatasetFreshness", () => {
  it("reports each dataset on its own: fresh, stale, missing, capped, and a failed refresh while keeping the old data", async () => {
    api.freshness.mockReturnValue(ok({ datasets: [
      ds(),
      ds({ id: "backlinks-dataset-live", state: "stale", lastSuccessfulAt: "2026-11-01T09:00:00Z", rows: 1500, providerTotal: 1500, truncated: false, lastError: { code: "PROVIDER_TIMEOUT", at: "2026-11-05T08:00:00Z" } }),
      ds({ id: "tp-counts", state: "missing", lastSuccessfulAt: null, rows: null, providerTotal: null, truncated: null }),
    ] }))
    wrap(<DatasetFreshness projectId="p1" page="x" now={NOW} />)
    const list = await screen.findByTestId("dataset-freshness")
    const items = within(list).getAllByRole("listitem")
    expect(items[0]).toHaveTextContent(/Organic keywords \(stored set\).*Up to date/)
    expect(items[0]).toHaveTextContent(/Collected 3 h ago · 3,000 of 13,591 rows · capped/)
    expect(items[1]).toHaveTextContent(/Out of date/)
    expect(items[1]).toHaveTextContent(/Collected 4 days ago · 1,500 rows/)
    expect(items[1]).not.toHaveTextContent(/capped/)
    expect(items[1]).toHaveTextContent(/Last refresh failed: the data service took too long\. Showing the previous data\./)
    expect(items[2]).toHaveTextContent(/Page counts.*Not collected/)
    expect(items[2]).toHaveTextContent(/Never collected/)
  })

  it("a failed read is an inline error with Retry", async () => {
    api.freshness.mockRejectedValueOnce(Object.assign(new Error("Server said no"), { status: 500 }))
    wrap(<DatasetFreshness projectId="p1" page="x" />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Server said no")
    api.freshness.mockReturnValue(ok({ datasets: [ds()] }))
    fireEvent.click(screen.getByRole("button", { name: /retry/i }))
    await screen.findByTestId("dataset-freshness")
  })
})

describe("ChangesPanel (keywords)", () => {
  const data = {
    hasData: true, kind: "keywords", period: "previous",
    latest: { scanId: "b", capturedAt: "2026-11-05T09:00:00Z", rows: 2495, truncated: false }, reference: { scanId: "a", capturedAt: "2026-11-01T09:00:00Z", rows: 2500, truncated: false },
    totals: { latest: { count: 2495, etv: 900, pos_1: 5, pos_2_3: 10 }, reference: { count: 2500, etv: 800, pos_1: 4, pos_2_3: 9 } },
    new: { count: 5, items: [{ keyword: "fresh kw", position: 7, etv: 12, search_volume: 90 }] },
    lost: { count: 10, items: [{ keyword: "old kw", position: 3, etv: 50, search_volume: 100 }] },
    improved: { count: 2, items: [{ keyword: "up kw", position: 2, position_change: 3, etv: 40, traffic_change: 15, search_volume: 100, search_volume_change: 0 }] },
    declined: { count: 0, items: [] },
  }

  it("shows the real comparison: dates, headline totals, tiles with real counts (a zero is a zero), and the rows of the selected tile", async () => {
    api.changes.mockReturnValue(ok(data))
    wrap(<ChangesPanel projectId="p1" spec={keywordSpec} />)
    expect(await screen.findByTestId("change-range")).toHaveTextContent("Nov 1, 2026 (2,500 stored) → Nov 5, 2026 (2,495 stored)")
    expect(screen.getByText(/Keywords:/).parentElement).toHaveTextContent("2,500 → 2,495")
    const tiles = screen.getAllByRole("button", { pressed: false }).concat(screen.getAllByRole("button", { pressed: true }))
    expect(screen.getByRole("button", { name: /New keywords/ })).toHaveTextContent("5")
    expect(screen.getByRole("button", { name: /Declined/ })).toHaveTextContent("0")
    expect(tiles.length).toBeGreaterThan(3)
    expect(within(screen.getByTestId("change-list")).getByText("fresh kw")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /Improved/ }))
    const list = screen.getByTestId("change-list")
    expect(within(list).getByText("up kw")).toBeTruthy()
    expect(list).toHaveTextContent("▲ 3")
    expect(list).toHaveTextContent("(+15)")
    expect(within(list).getByText("5", { exact: true })).toBeTruthy() // was position 5 (2 + 3)
    fireEvent.click(screen.getByRole("button", { name: /Declined/ }))
    expect(screen.getByTestId("change-list")).toHaveTextContent("No keyword moved down.")
  })

  it("with ONE stored scan it says there is not enough history and shows no zeros", async () => {
    api.changes.mockReturnValue(ok({ hasData: true, latest: { capturedAt: "2026-11-05T09:00:00Z", rows: 2500 }, reference: null, note: "No earlier Odito scan of this dataset exists yet, so there is nothing to compare with." }))
    wrap(<ChangesPanel projectId="p1" spec={keywordSpec} />)
    expect(await screen.findByTestId("not-enough-history")).toHaveTextContent(/Not enough historical data/)
    expect(screen.getByTestId("not-enough-history")).toHaveTextContent("The only stored scan is from Nov 5, 2026")
    expect(screen.queryByRole("button", { name: /New keywords/ })).toBeNull()
  })

  it("nothing collected, errors and loading are separate states", async () => {
    api.changes.mockReturnValueOnce(ok({ hasData: false }))
    const { unmount } = wrap(<ChangesPanel projectId="p1" spec={keywordSpec} />)
    expect(await screen.findByText(/No keywords have been collected yet/)).toBeTruthy()
    unmount()
    api.changes.mockRejectedValueOnce(Object.assign(new Error("Could not load"), { status: 500 }))
    wrap(<ChangesPanel projectId="p1" spec={keywordSpec} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load")
  })

  it("changing the period asks the server for that period and keeps the earlier answer on screen meanwhile; a capped scan is labelled", async () => {
    api.changes.mockImplementation((pid, { period }) => (period === "previous" ? ok(data) : new Promise((r) => setTimeout(() => r({ success: true, data: { ...data, period, caveat: "At least one of these scans stored only part of the provider's data (a row cap)." } }), 30))))
    wrap(<ChangesPanel projectId="p1" spec={keywordSpec} />)
    await screen.findByTestId("change-range")
    fireEvent.click(screen.getByRole("radio", { name: "7 days ago" }))
    expect(screen.getByTestId("change-range")).toBeTruthy() // previous data still shown while loading
    await waitFor(() => expect(api.changes).toHaveBeenCalledWith("p1", { dataset: "keywords", status: null, period: "week" }, expect.anything()))
    expect(await screen.findByRole("note")).toHaveTextContent(/row cap/)
  })

  it("referring domains: rank and backlink-count movement are listed with their signs", async () => {
    api.changes.mockReturnValue(ok({
      hasData: true, latest: { capturedAt: "2026-11-05T09:00:00Z", rows: 1198 }, reference: { capturedAt: "2026-11-01T09:00:00Z", rows: 1200 },
      new: { count: 3, items: [] }, lost: { count: 5, items: [] }, rankUp: { count: 1, items: [{ domain: "ref100.example.net", rank: 107, rank_change: 7, backlinks: 11, backlinks_change: 0 }] },
      rankDown: { count: 0, items: [] }, backlinksUp: { count: 20 }, backlinksDown: { count: 0 },
    }))
    wrap(<ChangesPanel projectId="p1" spec={domainSpec} />)
    fireEvent.click(await screen.findByRole("button", { name: /Rank up/ }))
    expect(screen.getByTestId("change-list")).toHaveTextContent("ref100.example.net")
    expect(screen.getByTestId("change-list")).toHaveTextContent("+7")
    expect(screen.getByRole("button", { name: /More backlinks/ })).toHaveTextContent("20")
  })
})

describe("SnapshotDeltas", () => {
  const snap = (organic, capturedAt) => ({ capturedAt, data: { organic } })

  it("shows before, now, absolute and percentage change; a metric missing in either snapshot is '—', not 0", async () => {
    api.comparison.mockReturnValue(ok({ period: "previous", latest: snap({ etv: 1500, count: 300, estimated_paid_traffic_cost: null, pos_1: 12 }, "2026-11-05T09:00:00Z"), previous: snap({ etv: 1000, count: 300, estimated_paid_traffic_cost: 50 }, "2026-11-01T09:00:00Z") }))
    wrap(<SnapshotDeltas projectId="p1" spec={overviewSpec} />)
    expect(await screen.findByTestId("snapshot-range")).toHaveTextContent("Nov 1, 2026 → Nov 5, 2026")
    const row = (name) => screen.getByRole("row", { name: new RegExp(name) })
    expect(row("Estimated organic traffic")).toHaveTextContent("1,000")
    expect(row("Estimated organic traffic")).toHaveTextContent("1,500")
    expect(row("Estimated organic traffic")).toHaveTextContent("+500 (+50%)")
    expect(row("Ranking keywords")).toHaveTextContent("no change")
    expect(row("Traffic value")).toHaveTextContent("—") // unavailable in the newer snapshot
    expect(row("Keywords in position 1")).toHaveTextContent("—") // unavailable in the older one
    expect(row("Traffic value")).not.toHaveTextContent("-50")
  })

  it("with one snapshot: not enough history, but what is stored now is still shown", async () => {
    api.comparison.mockReturnValue(ok({ period: "previous", latest: snap({ etv: 1500, count: 300 }, "2026-11-05T09:00:00Z"), previous: null }))
    wrap(<SnapshotDeltas projectId="p1" spec={overviewSpec} />)
    expect(await screen.findByTestId("not-enough-history")).toBeTruthy()
    expect(screen.getByRole("row", { name: /Estimated organic traffic/ })).toHaveTextContent("1,500")
  })

  it("nothing stored yet", async () => {
    api.comparison.mockReturnValue(ok({ period: "previous", latest: null, previous: null }))
    wrap(<SnapshotDeltas projectId="p1" spec={overviewSpec} />)
    expect(await screen.findByText(/No domain metrics have been collected yet/)).toBeTruthy()
  })
})

describe("KeyedSnapshotDeltas (competitors)", () => {
  it("lists new and gone competitors and the traffic movement of the rest, from the two stored lists", async () => {
    const list = (items, capturedAt) => ({ capturedAt, data: { items } })
    api.comparison.mockReturnValue(ok({ latest: list([{ domain: "a.com", total: { etv: 150 } }, { domain: "new.com", total: { etv: 5 } }], "2026-11-05T09:00:00Z"), previous: list([{ domain: "a.com", total: { etv: 100 } }, { domain: "old.com", total: { etv: 9 } }], "2026-11-01T09:00:00Z") }))
    wrap(<KeyedSnapshotDeltas projectId="p1" spec={competitorSpec} />)
    expect(await screen.findByRole("button", { name: /New in the list/ })).toHaveTextContent("1")
    expect(screen.getByRole("button", { name: /No longer listed/ })).toHaveTextContent("1")
    fireEvent.click(screen.getByRole("button", { name: /Changed traffic/ }))
    expect(screen.getByTestId("change-list")).toHaveTextContent("a.com")
    expect(screen.getByTestId("change-list")).toHaveTextContent("+50 (+50%)")
  })
})

describe("KeywordLookup", () => {
  it("asks for nothing until a keyword is submitted, then shows positions per stored scan and the best one", async () => {
    api.keywordHistory.mockReturnValue(ok({ keyword: "lasik", bestPosition: 2, points: [{ _id: "1", capturedAt: "2026-11-05T09:00:00Z", position: 3, trafficEstimate: 40, searchVolume: 900, rankingUrl: "https://x.com/lasik" }, { _id: "2", capturedAt: "2026-11-01T09:00:00Z", position: 2, trafficEstimate: null, searchVolume: 900, rankingUrl: null }] }))
    wrap(<KeywordLookup projectId="p1" />)
    expect(api.keywordHistory).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "  lasik " } })
    fireEvent.click(screen.getByRole("button", { name: /show history/i }))
    await waitFor(() => expect(api.keywordHistory).toHaveBeenCalledWith("p1", "lasik", expect.anything()))
    expect(await screen.findByText("Best position:")).toBeTruthy()
    const rows = screen.getAllByRole("row")
    expect(rows[1]).toHaveTextContent("Nov 5, 2026")
    expect(rows[2]).toHaveTextContent("—") // no traffic figure that scan: not 0
  })

  it("says so when no stored scan has the keyword", async () => {
    api.keywordHistory.mockReturnValue(ok({ keyword: "zzz", bestPosition: null, points: [] }))
    wrap(<KeywordLookup projectId="p1" />)
    fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "zzz" } })
    fireEvent.click(screen.getByRole("button", { name: /show history/i }))
    expect(await screen.findByText(/No stored scan contains/)).toBeTruthy()
  })
})
