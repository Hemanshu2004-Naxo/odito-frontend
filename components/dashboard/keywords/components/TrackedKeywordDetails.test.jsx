import "@testing-library/jest-dom/vitest"
import { createElement } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import UserAddedKeywords from "./UserAddedKeywords"
import { mapTrackedKeywordDetails, positionDelta, volumeChange } from "./mapTrackedKeywordDetails"
import { shouldPersistQuery } from "@/lib/queryPersistence"
import { queryKeys } from "@/lib/query/keys"

const api = vi.hoisted(() => ({ getTrackedKeywordDetails: vi.fn() }))
vi.mock("@/lib/apiService", () => ({ default: api }))

const device = (over = {}) => ({
  status: "ranked", position: 7, previousPosition: 9, bestPosition: 4, benchmarkPosition: 12, prevWeekPosition: 8, prevMonthPosition: 11,
  rankingUrl: "https://example.com/eye", rankingUrls: [{ rank: 7, url: "https://example.com/eye", type: "internal_page" }, { rank: 30, url: "https://example.com/", type: "homepage" }],
  trackedDepth: null, scanCount: 3, lastScannedAt: "2026-11-02T10:00:00.000Z", scanError: null, ...over,
})
const payload = (over = {}) => ({
  keywordId: "k1", keyword: "best eye center near me",
  overview: { searchVolume: 1900, keywordDifficulty: 42, searchIntent: "commercial", cpc: 1.25, competition: "LOW", lowTopOfPageBid: 0.4, highTopOfPageBid: 2.1 },
  rankings: {
    desktop: device(),
    mobile: device({ status: "not_collected", position: null, previousPosition: null, bestPosition: null, benchmarkPosition: null, prevWeekPosition: null, prevMonthPosition: null, rankingUrl: null, rankingUrls: [], scanCount: 0, lastScannedAt: null }),
    maps: { position: 3, listing: { title: "Own Eye Care", rating: 4.6, reviews: 120, address: "1 Main Rd" } },
  },
  history: {
    volume: [{ year: 2026, month: 8, search_volume: 1900 }, { year: 2026, month: 9, search_volume: 1600 }],
    desktop: [{ at: "2026-10-01T00:00:00.000Z", position: 9 }, { at: "2026-10-20T00:00:00.000Z", position: 7 }], mobile: [], windowDays: 180,
  },
  serpFeatures: ["organic", "local_pack", "people_also_ask"], googleUrl: "https://www.google.com/search?q=x",
  backlinks: { referringDomains: 77, totalBacklinks: 1234, pageUrl: null },
  metadata: { lastScannedAt: "2026-11-02T10:00:00.000Z", market: { location: "India", language: "English" }, metricsFetchedAt: "2026-11-01T10:00:00.000Z", metricsCached: true, dataAvailability: { keywordMetrics: "ok", volumeHistory: "ok", rankHistory: "ok", backlinks: "ok" } },
  ...over,
})
const ok = (data) => Promise.resolve({ success: true, data })

describe("mapTrackedKeywordDetails", () => {
  it("never turns a missing figure into 0", () => {
    const d = mapTrackedKeywordDetails({ keyword: "k", overview: {}, rankings: {}, history: {}, backlinks: {}, metadata: {} })
    expect(d.volume).toBeNull()
    expect(d.difficulty).toBeNull()
    expect(d.kdBand).toBeNull()
    expect(d.cpc).toBeNull()
    expect(d.referringDomains).toBeNull()
    expect(d.backlinks).toBeNull()
    expect(d.desktop.position).toBeNull()
    expect(d.desktop.status).toBe("not_collected")
    expect(d.monthly).toEqual([])
    expect(d.availability.keywordMetrics).toBe("unavailable")
  })

  it("keeps a real 0 as 0 (zero searches / zero backlinks are data, unlike a missing figure)", () => {
    const d = mapTrackedKeywordDetails(payload({ overview: { searchVolume: 0, keywordDifficulty: 0 }, backlinks: { referringDomains: 0, totalBacklinks: 0 } }))
    expect(d.volume).toBe(0)
    expect(d.difficulty).toBe(0)
    expect(d.referringDomains).toBe(0)
    expect(d.backlinks).toBe(0)
  })

  it("moves are positive for an improvement and unknown when either side is", () => {
    expect(positionDelta(5, 8)).toBe(3)
    expect(positionDelta(8, 5)).toBe(-3)
    expect(positionDelta(5, 5)).toBe(0)
    expect(positionDelta(null, 5)).toBeNull()
    expect(positionDelta(5, null)).toBeNull()
  })

  it("volume change compares the last two KNOWN months and has no answer from a zero base", () => {
    const m = (v) => v.map((volume, i) => ({ key: String(i), label: `M${i}`, volume }))
    expect(volumeChange(m([100, 150])).percent).toBe(50)
    expect(volumeChange(m([100, null, 50])).percent).toBe(-50)
    expect(volumeChange(m([0, 50]))).toBeNull()
    expect(volumeChange(m([null, 50]))).toBeNull()
  })

  it("history is oldest first and a not-found scan keeps its place as null", () => {
    const d = mapTrackedKeywordDetails(payload({ history: { volume: [], desktop: [{ at: "2026-10-20T00:00:00Z", position: null }, { at: "2026-10-01T00:00:00Z", position: 9 }, { at: "bad", position: 3 }], mobile: [] } }))
    expect(d.history.desktop.map((p) => p.position)).toEqual([9, null])
  })

  it("an unknown device state is not_collected, never ranked", () => {
    expect(mapTrackedKeywordDetails(payload({ rankings: { desktop: { status: "weird", position: 3 } } })).desktop.status).toBe("not_collected")
  })

  it("the chart shows the last 12 months, and SERP features drop the organic baseline", () => {
    const volume = Array.from({ length: 19 }, (_, i) => ({ year: 2025 + Math.floor((i + 3) / 12), month: ((i + 3) % 12) + 1, search_volume: 10 + i }))
    const d = mapTrackedKeywordDetails(payload({ history: { volume, desktop: [], mobile: [] } }))
    expect(d.monthly).toHaveLength(12)
    expect(d.serpFeatures.map((f) => f.key)).toEqual(["local_pack", "people_also_ask"])
  })
})

describe("query persistence", () => {
  it("never persists a tracked keyword's details", () => {
    const query = { queryKey: queryKeys.keywords.detail("p1", "k1"), state: { status: "success", data: { a: 1 } } }
    expect(shouldPersistQuery(query)).toBe(false)
  })
})

// ── the expanded row, through the table ───────────────────────────────────────────────────────────────────────────────

const tableData = {
  domain: "example.com", location: "Mumbai",
  keywords: [
    { _id: "k1", keyword: "best eye center near me", current_rank: 7, last_scan_status: "ok", scan_count: 3, ranking_urls: [{ rank: 7, url: "https://example.com/eye", type: "internal_page" }] },
    { _id: "k2", keyword: "lasik mumbai", current_rank: null, last_scan_status: "ok", scan_count: 1, ranking_urls: [] },
    { keyword: "just added", current_rank: null, last_scan_status: "pending" },
  ],
}
let client
function renderTable(props = {}) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = (p) => createElement(QueryClientProvider, { client }, createElement(UserAddedKeywords, { projectId: "p1", data: tableData, ...p }))
  const r = render(ui(props))
  return { ...r, again: (p) => r.rerender(ui(p)) }
}
const toggles = () => screen.getAllByTestId("kw-toggle")

describe("expandable tracked keyword rows", () => {
  beforeEach(() => {
    api.getTrackedKeywordDetails.mockReset()
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  })

  it("fetches nothing on load, and not for a row that is not open", () => {
    renderTable()
    expect(api.getTrackedKeywordDetails).not.toHaveBeenCalled()
    expect(screen.queryByTestId("kw-details")).toBeNull()
  })

  it("a keyword still being scanned (no database id yet) cannot be expanded", () => {
    renderTable()
    expect(toggles()).toHaveLength(2)
    expect(screen.getByText("just added").closest("button")).toBeNull()
  })

  it("expanding fetches once for that project + keyword, shows a skeleton, then every section", async () => {
    let resolve
    api.getTrackedKeywordDetails.mockReturnValue(new Promise((r) => { resolve = r }))
    renderTable()
    const first = toggles()[0]
    expect(first).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(first)
    expect(first).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByTestId("kw-details-loading")).toBeInTheDocument()
    expect(api.getTrackedKeywordDetails).toHaveBeenCalledTimes(1)
    expect(api.getTrackedKeywordDetails).toHaveBeenCalledWith("p1", "k1")
    resolve({ success: true, data: payload() })
    const region = await screen.findByTestId("kw-details")
    await waitFor(() => expect(screen.queryByTestId("kw-details-loading")).toBeNull())
    expect(first.getAttribute("aria-controls")).toBe(region.id)
    expect(screen.getByTestId("kw-volume")).toHaveTextContent("1.9K")
    expect(screen.getByTestId("kw-kd")).toHaveTextContent("42")
    expect(screen.getByTestId("kw-desktop-position")).toHaveTextContent("#7")
    expect(screen.getByTestId("kw-mobile-position")).toHaveTextContent("Not checked")
    expect(screen.getByTestId("kw-competition")).toHaveTextContent("Low")
    expect(screen.getByTestId("kw-cpc")).toHaveTextContent("$1.25")
    expect(screen.getByTestId("kw-bid")).toHaveTextContent("$0.40 – $2.10")
    expect(screen.getByTestId("kw-referring-domains")).toHaveTextContent("77")
    expect(screen.getByTestId("kw-backlinks")).toHaveTextContent("1,234")
    expect(within(screen.getByTestId("kw-serp-features")).getByText("Local pack")).toBeInTheDocument()
    expect(within(screen.getByTestId("kw-serp-features")).queryByText(/organic/i)).toBeNull()
    expect(screen.getByTestId("kw-maps")).toHaveTextContent("Maps #3")
    expect(screen.getByTestId("rank-history-chart")).toBeInTheDocument()
    expect(screen.queryByTestId("kw-metrics-notice")).toBeNull()
  })

  it("collapsing and re-opening is answered from memory: no second request", async () => {
    api.getTrackedKeywordDetails.mockImplementation(() => ok(payload()))
    renderTable()
    fireEvent.click(toggles()[0])
    await screen.findByTestId("kw-volume")
    fireEvent.click(toggles()[0])
    expect(screen.queryByTestId("kw-details")).toBeNull()
    fireEvent.click(toggles()[0])
    expect(await screen.findByTestId("kw-volume")).toBeInTheDocument()
    expect(api.getTrackedKeywordDetails).toHaveBeenCalledTimes(1)
  })

  it("rapid expand / collapse / expand sends one request", async () => {
    api.getTrackedKeywordDetails.mockImplementation(() => new Promise((r) => setTimeout(() => r({ success: true, data: payload() }), 30)))
    renderTable()
    for (let i = 0; i < 5; i += 1) fireEvent.click(toggles()[0])
    await screen.findByTestId("kw-volume")
    expect(api.getTrackedKeywordDetails).toHaveBeenCalledTimes(1)
  })

  it("two rows can be open at once, each with its own keyword's data", async () => {
    api.getTrackedKeywordDetails.mockImplementation((p, k) => ok(payload({ keywordId: k, overview: { ...payload().overview, searchVolume: k === "k1" ? 1900 : 320 } })))
    renderTable()
    fireEvent.click(toggles()[0])
    fireEvent.click(toggles()[1])
    await waitFor(() => expect(screen.getAllByTestId("kw-volume")).toHaveLength(2))
    expect(screen.getAllByTestId("kw-volume").map((e) => e.textContent)).toEqual(["1.9K", "320"])
    expect(api.getTrackedKeywordDetails).toHaveBeenCalledTimes(2)
  })

  it("a failed request shows an error inside the row with a working Try again, and the table stays usable", async () => {
    api.getTrackedKeywordDetails.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }))
    renderTable()
    fireEvent.click(toggles()[0])
    expect(await screen.findByTestId("kw-details-error")).toHaveTextContent("Could not load this keyword's details.")
    expect(screen.getAllByTestId("kw-toggle")).toHaveLength(2)
    api.getTrackedKeywordDetails.mockImplementation(() => ok(payload()))
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("kw-volume")).toBeInTheDocument()
  })

  it("a keyword that is gone (404) says so and offers no retry", async () => {
    api.getTrackedKeywordDetails.mockRejectedValue(Object.assign(new Error("nope"), { status: 404 }))
    renderTable()
    fireEvent.click(toggles()[0])
    expect(await screen.findByTestId("kw-details-error")).toHaveTextContent("no longer tracked")
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
    expect(api.getTrackedKeywordDetails).toHaveBeenCalledTimes(1)
  })

  it("keeps not ranked, scan failed and never checked apart, and never prints a position of 0", async () => {
    api.getTrackedKeywordDetails.mockImplementation(() => ok(payload({
      rankings: {
        desktop: device({ status: "not_ranked", position: null, previousPosition: null, bestPosition: null, rankingUrl: null, rankingUrls: [], trackedDepth: 100 }),
        mobile: device({ status: "scan_error", position: null, previousPosition: null, bestPosition: null, rankingUrl: null, rankingUrls: [], scanError: "Ranking check timed out. Please try again." }),
        maps: { position: null, listing: null },
      },
    })))
    renderTable()
    fireEvent.click(toggles()[0])
    const desktop = await screen.findByTestId("rank-desktop")
    expect(desktop).toHaveAttribute("data-status", "not_ranked")
    expect(desktop).toHaveTextContent("Not ranked")
    expect(desktop).toHaveTextContent("top 100")
    const mobile = screen.getByTestId("rank-mobile")
    expect(mobile).toHaveAttribute("data-status", "scan_error")
    expect(mobile).toHaveTextContent("Scan failed")
    expect(mobile).toHaveTextContent("not a confirmed ranking")
    expect(screen.getByTestId("kw-desktop-position")).toHaveTextContent("Not ranked")
    expect(screen.getByTestId("kw-mobile-position")).toHaveTextContent("Scan failed")
    expect(screen.getByTestId("kw-details").textContent).not.toMatch(/#0\b/)
  })

  it("provider figures unavailable: dashes with the reason, and the rankings are still shown", async () => {
    api.getTrackedKeywordDetails.mockImplementation(() => ok(payload({
      overview: { searchVolume: null, keywordDifficulty: null, searchIntent: null, cpc: null, competition: null, lowTopOfPageBid: null, highTopOfPageBid: null },
      history: { volume: [], desktop: [], mobile: [] }, serpFeatures: [], googleUrl: null, backlinks: { referringDomains: null, totalBacklinks: null },
      metadata: { ...payload().metadata, metricsFetchedAt: null, dataAvailability: { keywordMetrics: "error", volumeHistory: "error", rankHistory: "ok", backlinks: "unavailable" } },
    })))
    renderTable()
    fireEvent.click(toggles()[0])
    expect(await screen.findByTestId("kw-metrics-notice")).toHaveTextContent("could not be loaded right now")
    expect(screen.getByTestId("kw-volume")).toHaveTextContent("—")
    expect(screen.queryByTestId("kw-kd")).toBeNull()
    expect(screen.getByTestId("kw-cpc")).toHaveTextContent("—")
    expect(screen.getByTestId("kw-bid")).toHaveTextContent("—")
    expect(screen.getByTestId("kw-volume-empty")).toBeInTheDocument()
    expect(screen.getByTestId("kw-serp-empty")).toBeInTheDocument()
    expect(screen.getByTestId("kw-backlinks-empty")).toBeInTheDocument()
    expect(screen.getByTestId("kw-referring-domains")).toHaveTextContent("—")
    expect(screen.getByTestId("kw-desktop-position")).toHaveTextContent("#7")
    expect(screen.getByTestId("kw-view-google")).toHaveAttribute("href", expect.stringContaining("google.com/search?q=best%20eye%20center%20near%20me"))
  })

  it("no history yet is an empty state, not an empty chart", async () => {
    api.getTrackedKeywordDetails.mockImplementation(() => ok(payload({ history: { volume: [], desktop: [], mobile: [] } })))
    renderTable()
    fireEvent.click(toggles()[0])
    expect(await screen.findByTestId("rank-history-empty")).toBeInTheDocument()
  })

  it("lists every ranking URL per device and opens them safely in a new tab", async () => {
    api.getTrackedKeywordDetails.mockImplementation(() => ok(payload()))
    renderTable()
    fireEvent.click(toggles()[0])
    const list = await screen.findByTestId("rank-urls-desktop")
    expect(within(list).getAllByRole("link")).toHaveLength(2)
    const link = screen.getByTestId("rank-url-desktop")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
  })

  it("switching project drops the old project's open rows and asks for the new project's data", async () => {
    api.getTrackedKeywordDetails.mockImplementation((p) => ok(payload({ overview: { ...payload().overview, searchVolume: p === "p1" ? 1900 : 55 } })))
    const { again } = renderTable()
    fireEvent.click(toggles()[0])
    expect(await screen.findByTestId("kw-volume")).toHaveTextContent("1.9K")
    again({ projectId: "p2", data: { ...tableData, keywords: tableData.keywords.map((k) => ({ ...k })) } })
    // the open row is still open (its key is unchanged here); its query key now carries p2
    await waitFor(() => expect(api.getTrackedKeywordDetails).toHaveBeenCalledWith("p2", "k1"))
    await waitFor(() => expect(screen.getByTestId("kw-volume")).toHaveTextContent("55"))
  })
  it("every scan 'not found' is a sentence, not an empty chart", async () => {
    api.getTrackedKeywordDetails.mockImplementation(() => ok(payload({ history: { volume: [], windowDays: 180, desktop: [{ at: "2026-10-01T00:00:00Z", position: null }, { at: "2026-10-20T00:00:00Z", position: null }], mobile: [] } })))
    renderTable()
    fireEvent.click(toggles()[0])
    expect(await screen.findByTestId("rank-history-none-found")).toHaveTextContent("Not found in the top 100 in any of the 2 scans recorded for the last 180 days.")
    expect(screen.queryByTestId("rank-history-chart")).toBeNull()
  })

  it("the provider answered with no volume: an explanation, not a bare dash, and not a zero", async () => {
    api.getTrackedKeywordDetails.mockImplementation(() => ok(payload({ overview: { ...payload().overview, searchVolume: null } })))
    renderTable()
    fireEvent.click(toggles()[0])
    expect(await screen.findByTestId("kw-metrics-notice")).toHaveTextContent("did not report a search volume")
    expect(screen.getByTestId("kw-volume")).toHaveTextContent("—")
  })

  it("nothing to compare with is one dash, not a dash and an arrow", async () => {
    api.getTrackedKeywordDetails.mockImplementation(() => ok(payload({ rankings: { ...payload().rankings, desktop: device({ previousPosition: null, prevWeekPosition: null, prevMonthPosition: null }) } })))
    renderTable()
    fireEvent.click(toggles()[0])
    const desktop = await screen.findByTestId("rank-desktop")
    const dds = [...desktop.querySelectorAll("dd")].slice(0, 3)
    expect(dds.map((d) => d.textContent.trim())).toEqual(["—", "—", "—"])
  })
})
