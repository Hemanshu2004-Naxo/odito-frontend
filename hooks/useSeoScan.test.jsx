import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const api = vi.hoisted(() => ({ list: vi.fn(), start: vi.fn() }))
vi.mock("@/services/seoScanService", () => ({ default: api, seoScanService: api }))
vi.mock("@/lib/apiService", () => ({ default: { request: vi.fn() } }))

const socket = vi.hoisted(() => {
  const handlers = new Map()
  const stateListeners = new Set()
  return {
    handlers,
    stateListeners,
    state: "disconnected",
    addEventListener: vi.fn((e, h) => { if (!handlers.has(e)) handlers.set(e, new Set()); handlers.get(e).add(h) }),
    removeEventListener: vi.fn((e, h) => { handlers.get(e)?.delete(h) }),
    joinProject: vi.fn(),
    onConnectionStateChange: vi.fn((cb) => { stateListeners.add(cb); return () => stateListeners.delete(cb) }),
    emit(e, payload) { handlers.get(e)?.forEach((h) => h(payload)) },
    setState(next) { const prev = this.state; this.state = next; stateListeners.forEach((cb) => cb(next, prev)) },
  }
})
vi.mock("@/lib/socketService", () => ({
  default: socket,
  ConnectionState: { DISCONNECTED: "disconnected", CONNECTING: "connecting", CONNECTED: "connected", RECONNECTING: "reconnecting", FAILED: "failed" },
}))

import { useSeoScan, pollInterval, SCAN_EVENTS, POLL_MS, POLL_WHILE_SOCKET_UP_MS, isActive } from "./useSeoScan"

const scan = (over = {}) => ({ id: "s1", scope: "overview", status: "running", datasetsCompleted: 1, datasetsFailed: 0, totalDatasets: 5, finishedAt: null, ...over })
const list = (...scans) => Promise.resolve({ success: true, data: { scans } })

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, ...renderHook(() => useSeoScan("p1"), { wrapper }) }
}
const listeners = () => [...socket.handlers.values()].reduce((n, set) => n + set.size, 0)

beforeEach(() => {
  api.list.mockReset(); api.start.mockReset()
  socket.handlers.clear(); socket.stateListeners.clear(); socket.state = "disconnected"
  for (const f of [socket.addEventListener, socket.removeEventListener, socket.joinProject, socket.onConnectionStateChange]) f.mockClear()
})
afterEach(() => { vi.useRealTimers() })

describe("polling policy", () => {
  it("never while idle, slow while the socket is up, quick while it is down", () => {
    expect(pollInterval(scan({ status: "completed" }), false)).toBe(false)
    expect(pollInterval(null, true)).toBe(false)
    expect(pollInterval(scan({ status: "queued" }), true)).toBe(POLL_WHILE_SOCKET_UP_MS)
    expect(pollInterval(scan(), false)).toBe(POLL_MS)
    expect(POLL_WHILE_SOCKET_UP_MS).toBeGreaterThan(POLL_MS)
    expect(isActive(scan({ status: "partially_completed" }))).toBe(false)
  })
})

describe("socket subscription", () => {
  it("joins the project room, listens to every scan event once, and removes exactly its own listeners on unmount", async () => {
    api.list.mockReturnValue(list(scan({ status: "completed" })))
    const { unmount } = setup()
    expect(socket.joinProject).toHaveBeenCalledWith("p1")
    expect(socket.addEventListener.mock.calls.map((c) => c[0]).sort()).toEqual([...SCAN_EVENTS].sort())
    expect(listeners()).toBe(SCAN_EVENTS.length)
    unmount()
    expect(listeners()).toBe(0)
  })

  it("remounting does not stack listeners", async () => {
    api.list.mockReturnValue(list(scan({ status: "completed" })))
    const a = setup(); a.unmount()
    const b = setup()
    expect(listeners()).toBe(SCAN_EVENTS.length)
    b.unmount()
    expect(listeners()).toBe(0)
  })

  it("an event only says 'look again': the state is re-read from the API (progress bursts are debounced, a terminal event is immediate)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.list.mockReturnValue(list(scan()))
    const { result } = setup()
    await waitFor(() => expect(result.current.latest?.status).toBe("running"))
    expect(api.list).toHaveBeenCalledTimes(1)

    api.list.mockReturnValue(list(scan({ datasetsCompleted: 3 })))
    act(() => { for (let i = 0; i < 5; i += 1) socket.emit("seo_scan:progress", { projectId: "p1", scanId: "s1" }) })
    expect(api.list).toHaveBeenCalledTimes(1) // debounced
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.latest.datasetsCompleted).toBe(3))

    api.list.mockReturnValue(list(scan({ status: "completed", datasetsCompleted: 5, finishedAt: "2026-11-05T10:00:00Z" })))
    act(() => { socket.emit("seo_scan:completed", { projectId: "p1", scanId: "s1" }) })
    await waitFor(() => expect(result.current.latest.status).toBe("completed"))
    expect(result.current.running).toBe(false)
  })

  it("an event of another project is ignored", async () => {
    api.list.mockReturnValue(list(scan()))
    const { result } = setup()
    await waitFor(() => expect(result.current.latest).toBeTruthy())
    act(() => { socket.emit("seo_scan:completed", { projectId: "someone-else" }); socket.emit("seo_scan:completed", null) })
    await new Promise((r) => setTimeout(r, 50))
    expect(api.list).toHaveBeenCalledTimes(1)
  })

  it("after a reconnect the stored state is read again at once (events may have been missed)", async () => {
    api.list.mockReturnValue(list(scan()))
    const { result } = setup()
    await waitFor(() => expect(result.current.latest).toBeTruthy())
    act(() => { socket.setState("connected") })
    await waitFor(() => expect(result.current.socketConnected).toBe(true))
    api.list.mockClear()
    act(() => { socket.setState("reconnecting") })
    expect(api.list).not.toHaveBeenCalled()
    act(() => { socket.setState("connected") })
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1))
  })
})

describe("scan completion", () => {
  const seedKeys = (client) => {
    for (const key of [["domain-overview", "p1", "history", "v2", 12], ["domain-overview", "p1", "competitors", "v2", "s", {}], ["domain-overview", "p1", "backlinks-list", {}],
      ["dataset-changes", "p1", "keywords"], ["dataset-freshness", "p1", "backlinks"], ["snapshot-comparison", "p1"], ["keyword-history", "p1", "x"], ["seo-ensure", "p1", "traffic"],
      ["domain-overview", "p2", "history", "v2", 12], ["dataset-changes", "p2", "keywords"], ["seo-ensure", "p2", "traffic"], ["social", "p1", "posts"]]) {
      client.setQueryData(key, { ok: true })
    }
  }
  const invalidated = (client, key) => client.getQueryState(key)?.isInvalidated

  it("each completed dataset refreshes ONLY the queries that read it - not the whole page, not another project", async () => {
    api.list.mockReturnValueOnce(list(scan({ datasets: [{ id: "rank-overview", status: "completed", cached: false }, { id: "history", status: "pending" }, { id: "competitors", status: "pending" }] })))
    const { client, result } = setup()
    seedKeys(client)
    await waitFor(() => expect(result.current.running).toBe(true))
    // The first look only records what was already done: nothing is refetched for it.
    expect(invalidated(client, ["domain-overview", "p1", "history", "v2", 12])).toBe(false)

    api.list.mockReturnValue(list(scan({ datasets: [{ id: "rank-overview", status: "completed", cached: false }, { id: "history", status: "completed", cached: false }, { id: "competitors", status: "pending" }] })))
    act(() => { socket.emit("seo_scan:dataset_completed", { projectId: "p1", datasetId: "history" }) })
    await waitFor(() => expect(invalidated(client, ["domain-overview", "p1", "history", "v2", 12])).toBe(true))
    expect(invalidated(client, ["domain-overview", "p1", "competitors", "v2", "s", {}])).toBe(false)
    expect(invalidated(client, ["domain-overview", "p1", "backlinks-list", {}])).toBe(false)
    expect(invalidated(client, ["domain-overview", "p2", "history", "v2", 12])).toBe(false)
    expect(invalidated(client, ["social", "p1", "posts"])).toBe(false)
    expect(invalidated(client, ["dataset-changes", "p1", "keywords"])).toBe(false) // history panels wait for the end of the scan
  })

  it("a dataset answered from stored data (cached: no purchase) changes nothing on screen, so it refreshes nothing", async () => {
    api.list.mockReturnValueOnce(list(scan({ datasets: [{ id: "history", status: "pending" }] })))
    const { client, result } = setup()
    seedKeys(client)
    await waitFor(() => expect(result.current.running).toBe(true))
    api.list.mockReturnValue(list(scan({ datasets: [{ id: "history", status: "completed", cached: true }] })))
    act(() => { socket.emit("seo_scan:dataset_completed", { projectId: "p1", datasetId: "history" }) })
    await waitFor(() => expect(result.current.latest.datasets[0].status).toBe("completed"))
    expect(invalidated(client, ["domain-overview", "p1", "history", "v2", 12])).toBe(false)
  })

  it("the polling fallback finds completed datasets too (no socket needed)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.list.mockReturnValueOnce(list(scan({ datasets: [{ id: "competitors", status: "pending" }] })))
    const { client, result } = setup()
    seedKeys(client)
    await waitFor(() => expect(result.current.running).toBe(true))
    api.list.mockReturnValue(list(scan({ datasets: [{ id: "competitors", status: "completed", cached: false }] })))
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS + 100) })
    await waitFor(() => expect(invalidated(client, ["domain-overview", "p1", "competitors", "v2", "s", {}])).toBe(true))
    expect(invalidated(client, ["domain-overview", "p1", "history", "v2", 12])).toBe(false)
  })

  it("a section that was showing 'not collected yet' is read again as soon as a dataset completes", async () => {
    api.list.mockReturnValueOnce(list(scan({ datasets: [{ id: "history", status: "pending" }, { id: "competitors", status: "pending" }] })))
    const { client, result } = setup()
    const missing = ["domain-overview", "p1", "backlinks-list", { status: "live" }]
    client.getQueryCache().build(client, { queryKey: missing, queryFn: () => Promise.reject(Object.assign(new Error("n"), { code: "NOT_SCANNED", status: 404 })) })
    await client.fetchQuery({ queryKey: missing, queryFn: () => Promise.reject(Object.assign(new Error("n"), { code: "NOT_SCANNED", status: 404 })), retry: false }).catch(() => {})
    await waitFor(() => expect(result.current.running).toBe(true))
    api.list.mockReturnValue(list(scan({ datasets: [{ id: "history", status: "completed", cached: false }, { id: "competitors", status: "pending" }] })))
    act(() => { socket.emit("seo_scan:dataset_completed", { projectId: "p1" }) })
    await waitFor(() => expect(invalidated(client, missing)).toBe(true))
  })

  it("when the scan ends: history / freshness panels and this page's collection state are read again; other projects are not touched", async () => {
    api.list.mockReturnValueOnce(list(scan()))
    const { client, result } = setup()
    seedKeys(client)
    await waitFor(() => expect(result.current.running).toBe(true))
    api.list.mockReturnValue(list(scan({ status: "partially_completed", finishedAt: "2026-11-05T10:00:00Z" })))
    act(() => { socket.emit("seo_scan:partial", { projectId: "p1" }) })
    await waitFor(() => expect(result.current.running).toBe(false))
    await waitFor(() => expect(invalidated(client, ["seo-ensure", "p1", "traffic"])).toBe(true))
    for (const key of [["dataset-changes", "p1", "keywords"], ["dataset-freshness", "p1", "backlinks"], ["snapshot-comparison", "p1"], ["keyword-history", "p1", "x"]]) expect(invalidated(client, key)).toBe(true)
    for (const key of [["domain-overview", "p2", "history", "v2", 12], ["dataset-changes", "p2", "keywords"], ["seo-ensure", "p2", "traffic"], ["social", "p1", "posts"]]) expect(invalidated(client, key)).toBe(false)
    // The page's own data was refreshed dataset by dataset, not wholesale at the end.
    expect(invalidated(client, ["domain-overview", "p1", "backlinks-list", {}])).toBe(false)
  })

  it("starting a scan is the only action, sends exactly what was asked, and re-reads the list", async () => {
    api.list.mockReturnValue(list())
    api.start.mockResolvedValue({ success: true, data: { scan: scan({ status: "queued" }), deduped: false } })
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe("ready"))
    act(() => { result.current.start({ scope: "offpage" }) })
    await waitFor(() => expect(api.start).toHaveBeenCalledWith("p1", { scope: "offpage" }))
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
  })

  it("a refused start surfaces the server's message", async () => {
    api.list.mockReturnValue(list())
    api.start.mockRejectedValue(Object.assign(new Error("Another SEO scan is already running for this project."), { status: 409, code: "SCAN_IN_PROGRESS" }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe("ready"))
    act(() => { result.current.start({ scope: "overview" }) })
    await waitFor(() => expect(result.current.startError?.message).toMatch(/already running/))
  })
})
