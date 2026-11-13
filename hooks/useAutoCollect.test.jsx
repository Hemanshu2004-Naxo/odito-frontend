import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const api = vi.hoisted(() => ({ list: vi.fn(), start: vi.fn(), ensure: vi.fn(), refresh: vi.fn() }))
vi.mock("@/services/seoScanService", () => ({ default: api, seoScanService: api }))
vi.mock("@/lib/apiService", () => ({ default: { request: vi.fn() } }))
const socket = vi.hoisted(() => {
  const handlers = new Map()
  return {
    handlers, state: "connected",
    addEventListener: vi.fn((e, h) => { if (!handlers.has(e)) handlers.set(e, new Set()); handlers.get(e).add(h) }),
    removeEventListener: vi.fn((e, h) => { handlers.get(e)?.delete(h) }),
    joinProject: vi.fn(), onConnectionStateChange: vi.fn(() => () => {}),
    emit(e, p) { handlers.get(e)?.forEach((h) => h(p)) },
  }
})
vi.mock("@/lib/socketService", () => ({ default: socket, ConnectionState: { CONNECTED: "connected", RECONNECTING: "reconnecting", DISCONNECTED: "disconnected" } }))

import { useAutoCollect } from "./useAutoCollect"
import { useManualRefresh } from "./useManualRefresh"

const scan = (over = {}) => ({ id: "s1", status: "running", stalled: false, datasetsCompleted: 0, datasetsFailed: 0, totalDatasets: 3, datasets: [], ...over })
const ens = (over = {}) => ({ success: true, data: { page: "traffic", state: "fresh", activity: "idle", hasData: true, lastUpdatedAt: "2026-11-05T10:00:00Z", lastError: null, enqueued: null, scan: null, datasets: [], ...over } })
const list = (...scans) => Promise.resolve({ success: true, data: { scans } })

let client
const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
const setup = (page = "traffic", pid = "p1") => renderHook(({ p }) => useAutoCollect(pid, p), { wrapper, initialProps: { p: page } })

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  socket.handlers.clear()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  api.list.mockReturnValue(list())
})

describe("one coordinated request when a page opens", () => {
  it("asks the server once per page, never starts a scan itself, and reports the answer", async () => {
    api.ensure.mockResolvedValue(ens({ state: "missing", hasData: false, activity: "queued", enqueued: { scanId: "s1" }, scan: scan({ status: "queued" }) }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(api.ensure).toHaveBeenCalledTimes(1)
    expect(api.ensure).toHaveBeenCalledWith("p1", "traffic", expect.anything())
    expect(result.current.ensure.activity).toBe("queued")
    expect(result.current.scan.id).toBe("s1")
    expect(api.start).not.toHaveBeenCalled()
    expect(api.refresh).not.toHaveBeenCalled()
  })

  it("repeated mounting (remounts, other components using it) does not ask again within the minute", async () => {
    api.ensure.mockResolvedValue(ens())
    const a = setup(); await waitFor(() => expect(a.result.current.status).toBe("ready")); a.unmount()
    const b = setup(); await waitFor(() => expect(b.result.current.status).toBe("ready")); b.unmount()
    const c = setup(); await waitFor(() => expect(c.result.current.status).toBe("ready"))
    expect(api.ensure).toHaveBeenCalledTimes(1)
  })

  it("navigating to another page asks for THAT page only; going back reuses the first answer", async () => {
    api.ensure.mockResolvedValue(ens())
    const { result, rerender } = setup("traffic")
    await waitFor(() => expect(result.current.status).toBe("ready"))
    rerender({ p: "competitors" })
    await waitFor(() => expect(api.ensure).toHaveBeenCalledWith("p1", "competitors", expect.anything()))
    rerender({ p: "traffic" })
    await waitFor(() => expect(result.current.ensure).toBeTruthy())
    expect(api.ensure).toHaveBeenCalledTimes(2)
  })

  it("makes no request without a project or a page", () => {
    renderHook(() => useAutoCollect(undefined, "traffic"), { wrapper })
    renderHook(() => useAutoCollect("p1", null), { wrapper })
    expect(api.ensure).not.toHaveBeenCalled()
  })

  it("a queued collection makes the scan list be read at once, so its progress shows", async () => {
    api.ensure.mockResolvedValue(ens({ state: "missing", hasData: false, activity: "queued", enqueued: { scanId: "s1" }, scan: scan({ status: "queued" }) }))
    setup()
    await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it("a failed status request does not break the page: the status is 'error' and nothing else happens", async () => {
    api.ensure.mockRejectedValue(Object.assign(new Error("x"), { status: 500 }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.ensure).toBeNull()
    expect(api.start).not.toHaveBeenCalled()
  })
})

describe("following the collection", () => {
  it("when the watched scan ends, the page's collection state is read again (it may queue what is left, or show the failure)", async () => {
    api.ensure.mockResolvedValueOnce(ens({ state: "missing", hasData: false, activity: "collecting", enqueued: { scanId: "s1" }, scan: scan() }))
    api.list.mockReturnValue(list(scan()))
    const { result } = setup()
    await waitFor(() => expect(result.current.scan?.id).toBe("s1"))
    expect(api.ensure).toHaveBeenCalledTimes(1)

    api.ensure.mockResolvedValue(ens())
    api.list.mockReturnValue(list(scan({ status: "completed", finishedAt: "2026-11-05T10:05:00Z" })))
    act(() => { socket.emit("seo_scan:completed", { projectId: "p1", scanId: "s1" }) })
    await waitFor(() => expect(api.ensure).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.ensure.activity).toBe("idle"))
    expect(result.current.scan).toBeNull()
  })

  it("keeps the previous answer on screen while it is read again (no flicker)", async () => {
    api.ensure.mockResolvedValueOnce(ens({ state: "stale", activity: "collecting", scan: scan() }))
    api.list.mockReturnValue(list(scan()))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe("ready"))
    let release
    api.ensure.mockReturnValue(new Promise((r) => { release = r }))
    act(() => { client.invalidateQueries({ queryKey: ["seo-ensure", "p1"], refetchType: "active" }) })
    await waitFor(() => expect(api.ensure).toHaveBeenCalledTimes(2))
    expect(result.current.status).toBe("ready")
    expect(result.current.ensure.state).toBe("stale")
    release(ens())
    await waitFor(() => expect(result.current.ensure.state).toBe("fresh"))
  })
})

describe("the optional manual refresh", () => {
  it("only queues through the same coordinator and re-reads the scan list and the page state", async () => {
    api.refresh.mockResolvedValue({ success: true, data: { accepted: true, scan: scan({ status: "queued" }) } })
    const spy = vi.spyOn(client, "invalidateQueries")
    const { result } = renderHook(() => useManualRefresh("p1", "traffic"), { wrapper })
    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.result?.accepted).toBe(true))
    expect(api.refresh).toHaveBeenCalledWith("p1", "traffic")
    expect(api.start).not.toHaveBeenCalled()
    const keys = spy.mock.calls.map((c) => c[0].queryKey)
    expect(keys).toEqual(expect.arrayContaining([["seo-scan", "p1"], ["seo-ensure", "p1"]]))
  })

  it("a refusal (cooldown) is reported from the server's answer", async () => {
    api.refresh.mockRejectedValue(Object.assign(new Error("x"), { status: 409, code: "COOLDOWN", data: { accepted: false, reason: "COOLDOWN", retryAt: "2026-11-05T13:00:00Z" } }))
    const { result } = renderHook(() => useManualRefresh("p1", "traffic"), { wrapper })
    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.result?.reason).toBe("COOLDOWN"))
    expect(result.current.result.accepted).toBe(false)
  })
})
