import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const api = vi.hoisted(() => ({ list: vi.fn(), start: vi.fn(), ensure: vi.fn(), refresh: vi.fn() }))
vi.mock("@/services/seoScanService", () => ({ default: api, seoScanService: api }))
vi.mock("@/lib/apiService", () => ({ default: { request: vi.fn() } }))
vi.mock("@/lib/socketService", () => ({
  default: { state: "disconnected", addEventListener: vi.fn(), removeEventListener: vi.fn(), joinProject: vi.fn(), onConnectionStateChange: vi.fn(() => () => {}) },
  ConnectionState: { CONNECTED: "connected", RECONNECTING: "reconnecting", DISCONNECTED: "disconnected" },
}))

import { DataStatusLine, describeDataStatus, ago } from "./DataStatusLine"

const NOW = Date.parse("2026-11-05T12:00:00Z")
const ensure = (over = {}) => ({ page: "traffic", state: "fresh", activity: "idle", hasData: true, lastUpdatedAt: "2026-11-05T11:56:00Z", lastError: null, nextAttemptAt: null, enqueued: null, scan: null, datasets: [], ...over })
const scan = (over = {}) => ({ id: "s1", status: "running", stalled: false, datasetsCompleted: 2, datasetsFailed: 0, totalDatasets: 11, ...over })
const text = (e, s = null) => describeDataStatus({ ensure: e, scan: s, now: NOW })?.text

describe("the sentences", () => {
  it("fresh: 'Data updated 4 minutes ago.'", () => {
    expect(text(ensure())).toBe("Data updated 4 minutes ago.")
    expect(ago("2026-11-05T11:59:50Z", NOW)).toBe("just now")
    expect(ago("2026-11-05T11:59:00Z", NOW)).toBe("1 minute ago")
    expect(ago("2026-11-05T09:00:00Z", NOW)).toBe("3 hours ago")
    expect(ago("2026-11-02T12:00:00Z", NOW)).toBe("3 days ago")
  })

  it("missing + being collected: 'Collecting SEO data for this section…' with progress", () => {
    const view = describeDataStatus({ ensure: ensure({ state: "missing", hasData: false, lastUpdatedAt: null, activity: "collecting" }), scan: scan(), now: NOW })
    expect(view.text).toBe("Collecting SEO data for this section…")
    expect(view.busy).toBe(true)
    expect(view.progress).toEqual({ done: 2, total: 11 })
  })

  it("queued/waiting but nothing stored: still 'Collecting…' (no progress while it waits behind another collection)", () => {
    expect(text(ensure({ state: "missing", hasData: false, activity: "queued" }), scan({ status: "queued", datasetsCompleted: 0 }))).toBe("Collecting SEO data for this section…")
    expect(describeDataStatus({ ensure: ensure({ state: "missing", hasData: false, activity: "waiting" }), scan: scan(), now: NOW }).progress).toBeNull()
  })

  it("stale and refreshing: 'Updating data…' with progress once it runs; 'Showing saved data · Refreshing in background.' while queued", () => {
    const running = describeDataStatus({ ensure: ensure({ state: "stale", activity: "collecting" }), scan: scan({ datasetsCompleted: 3, datasetsFailed: 1 }), now: NOW })
    expect(running.text).toBe("Updating data…")
    expect(running.progress).toEqual({ done: 4, total: 11 })
    expect(text(ensure({ state: "stale", activity: "queued" }), scan({ status: "queued" }))).toBe("Showing saved data · Refreshing in background.")
    expect(text(ensure({ state: "stale", activity: "waiting" }), scan())).toBe("Showing saved data · Refreshing in background.")
  })

  it("failure: 'Unable to refresh data. Showing previously saved results.'; with no data yet it says it will try again", () => {
    const err = { code: "PROVIDER_UNAVAILABLE", at: "2026-11-05T11:00:00Z", datasetId: "history" }
    expect(text(ensure({ state: "stale", activity: "cooldown", lastError: err }))).toBe("Unable to refresh data. Showing previously saved results.")
    expect(text(ensure({ state: "missing", hasData: false, activity: "cooldown", lastError: err }))).toMatch(/try again automatically/)
    expect(describeDataStatus({ ensure: ensure({ state: "stale", activity: "cooldown", lastError: err }), now: NOW }).tone).toBe("warn")
  })

  it("a collection nobody is working on yet says so calmly; saved data stays", () => {
    expect(text(ensure({ state: "stale", activity: "collecting" }), scan({ stalled: true }))).toMatch(/refresh will continue shortly/i)
  })

  it("cooldown without an error, unavailable and disabled are honest", () => {
    expect(text(ensure({ state: "stale", activity: "cooldown" }))).toBe("Showing saved data · Will refresh automatically.")
    expect(text(ensure({ state: "stale", activity: "unavailable" }))).toMatch(/updates are unavailable/i)
    expect(text(ensure({ state: "stale", activity: "disabled" }))).toMatch(/turned off/i)
  })

  it("says nothing before the server has answered", () => {
    expect(describeDataStatus({ ensure: null })).toBeNull()
  })
})

describe("DataStatusLine", () => {
  beforeEach(() => { for (const f of Object.values(api)) f.mockReset(); api.list.mockResolvedValue({ success: true, data: { scans: [] } }) })
  const mount = (page = "traffic") => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return { client, ...render(<QueryClientProvider client={client}><DataStatusLine projectId="p1" page={page} /></QueryClientProvider>) }
  }

  it("asks the server about the page exactly once on mount, shows the scan's progress, and has no scan button", async () => {
    api.ensure.mockResolvedValue({ success: true, data: ensure({ state: "missing", hasData: false, activity: "queued", enqueued: { scanId: "s1" }, scan: scan({ status: "queued", datasetsCompleted: 0 }) }) })
    mount()
    expect(await screen.findByText("Collecting SEO data for this section…")).toBeInTheDocument()
    expect(api.ensure).toHaveBeenCalledTimes(1)
    expect(api.ensure).toHaveBeenCalledWith("p1", "traffic", expect.anything())
    expect(api.start).not.toHaveBeenCalled()
    expect(api.refresh).not.toHaveBeenCalled()
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  it("a fresh page just says how old its data is", async () => {
    api.ensure.mockResolvedValue({ success: true, data: ensure({ lastUpdatedAt: new Date(Date.now() - 4 * 60_000).toISOString() }) })
    mount()
    expect(await screen.findByText("Data updated 4 minutes ago.")).toBeInTheDocument()
    expect(api.list).toHaveBeenCalled() // observing scans is a read
    expect(api.start).not.toHaveBeenCalled()
  })

  it("shows nothing (no flicker, no error banner) when the status request itself fails", async () => {
    api.ensure.mockRejectedValue(Object.assign(new Error("down"), { status: 500 }))
    mount()
    await waitFor(() => expect(api.ensure).toHaveBeenCalled())
    expect(screen.queryByTestId("seo-data-status")).toBeNull()
  })
})
