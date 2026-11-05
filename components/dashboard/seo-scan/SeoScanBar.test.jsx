import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const api = vi.hoisted(() => ({ list: vi.fn(), start: vi.fn() }))
vi.mock("@/services/seoScanService", () => ({ default: api, seoScanService: api }))
vi.mock("@/lib/apiService", () => ({ default: { request: vi.fn() } }))

import { ProjectScanBar, timeAgo } from "./ProjectScanBar"
import { scopeForPath } from "./scanScope"
import { summarizeScans } from "@/hooks/useSeoScan"

const NOW = Date.parse("2026-11-04T12:00:00Z")
const scan = (over = {}) => ({ id: "s1", scope: "overview", status: "completed", datasetsCompleted: 5, datasetsFailed: 0, totalDatasets: 5, finishedAt: "2026-11-04T11:00:00Z", ...over })
const listOf = (...scans) => ({ success: true, data: { scans } })

function renderBar(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { client, ...render(<QueryClientProvider client={client}><ProjectScanBar projectId="p1" scope="overview" now={NOW} /></QueryClientProvider>) }
}

beforeEach(() => { api.list.mockReset(); api.start.mockReset(); api.start.mockResolvedValue({ success: true, data: { scan: scan({ status: "running" }), deduped: false } }) })

describe("scope per route", () => {
  it("maps every SEO data page to the scan that collects it, and others to none", () => {
    expect(scopeForPath("/app/domain-overview")).toBe("overview")
    expect(scopeForPath("/app/organic-keywords")).toBe("organic")
    expect(scopeForPath("/app/traffic-history")).toBe("organic")
    expect(scopeForPath("/app/competitors")).toBe("competitors")
    expect(scopeForPath("/app/backlinks/list")).toBe("offpage")
    expect(scopeForPath("/app/referring-domains")).toBe("offpage")
    expect(scopeForPath("/app/settings")).toBeNull()
    expect(scopeForPath("/app/competitorsX")).toBeNull()
    expect(scopeForPath(null)).toBeNull()
  })
})

describe("summarizeScans / timeAgo", () => {
  it("a partially completed scan counts as the last successful one; a failed one does not", () => {
    const { latest, lastSuccessful } = summarizeScans([scan({ id: "c", status: "failed" }), scan({ id: "b", status: "partially_completed" }), scan({ id: "a" })])
    expect([latest.id, lastSuccessful.id]).toEqual(["c", "b"])
    expect(summarizeScans([]).latest).toBeNull()
  })
  it("says how old the saved data is", () => {
    expect(timeAgo("2026-11-04T11:59:40Z", NOW)).toBe("just now")
    expect(timeAgo("2026-11-04T11:15:00Z", NOW)).toBe("45 min ago")
    expect(timeAgo("2026-11-04T07:00:00Z", NOW)).toBe("5 h ago")
    expect(timeAgo("2026-10-30T12:00:00Z", NOW)).toBe("5 days ago")
  })
})

describe("SeoScanBar", () => {
  it("no scan yet: says nothing was collected and offers the explicit scan for this page's scope", async () => {
    api.list.mockResolvedValue(listOf())
    renderBar()
    fireEvent.click(await screen.findByRole("button", { name: /run seo scan/i }))
    await waitFor(() => expect(api.start).toHaveBeenCalledWith("p1", { scope: "overview" }))
    expect(screen.getByText(/no seo data has been collected/i)).toBeTruthy()
  })

  it("fresh data: shows its age and offers an update (which buys only what is missing or stale, server side)", async () => {
    api.list.mockResolvedValue(listOf(scan()))
    renderBar()
    expect(await screen.findByText(/data saved 1 h ago/i)).toBeTruthy()
    expect(screen.queryByText(/out of date/i)).toBeNull()
  })

  it("old data is called stale but stays usable", async () => {
    api.list.mockResolvedValue(listOf(scan({ finishedAt: "2026-11-01T11:00:00Z" })))
    renderBar()
    expect(await screen.findByText(/may be out of date/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: /update data/i })).toBeTruthy()
  })

  it("a running scan shows progress and cannot be started twice", async () => {
    api.list.mockResolvedValue(listOf(scan({ status: "running", datasetsCompleted: 2, datasetsFailed: 1, totalDatasets: 11, finishedAt: null })))
    renderBar()
    expect(await screen.findByText(/3 of 11 datasets done/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: /scanning/i }).disabled).toBe(true)
  })

  it("partial completion: says what failed, keeps the rest, and the button retries only the failed datasets", async () => {
    api.list.mockResolvedValue(listOf(scan({ id: "p9", status: "partially_completed", datasetsCompleted: 4, datasetsFailed: 1 })))
    renderBar()
    expect(await screen.findByText(/1 dataset could not be collected/i)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /retry failed/i }))
    await waitFor(() => expect(api.start).toHaveBeenCalledWith("p1", { retryOf: "p9" }))
  })

  it("a failed scan keeps pointing at the last good data", async () => {
    api.list.mockResolvedValue(listOf(scan({ id: "f", status: "failed", finishedAt: "2026-11-04T11:50:00Z" }), scan({ id: "ok", finishedAt: "2026-11-04T09:00:00Z" })))
    renderBar()
    expect(await screen.findByText(/last scan failed\. showing data saved 3 h ago/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: /run again/i })).toBeTruthy()
  })

  it("a refused start (e.g. another scan running) shows the server's message", async () => {
    api.list.mockResolvedValue(listOf())
    api.start.mockRejectedValue(Object.assign(new Error("Another SEO scan is already running for this project."), { status: 409 }))
    renderBar()
    fireEvent.click(await screen.findByRole("button", { name: /run seo scan/i }))
    expect(await screen.findByText(/already running/i)).toBeTruthy()
  })

  it("when a running scan ends, only this project's stored-data queries are invalidated", async () => {
    api.list.mockResolvedValueOnce(listOf(scan({ status: "running", finishedAt: null })))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, "invalidateQueries")
    renderBar(client)
    await screen.findByText(/datasets done/i)
    api.list.mockResolvedValue(listOf(scan()))
    await client.invalidateQueries({ queryKey: ["seo-scan", "p1"] })
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["domain-overview", "p1"] }))
    expect(spy.mock.calls.map((c) => c[0].queryKey[0]).filter((k) => k !== "seo-scan")).toEqual(["domain-overview"])
  })
})
