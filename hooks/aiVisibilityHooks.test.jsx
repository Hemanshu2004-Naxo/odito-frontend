import { describe, test, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const q = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), getApproved: vi.fn(), generate: vi.fn(), updateQuestion: vi.fn(), approve: vi.fn(), discard: vi.fn(), getProfile: vi.fn(), saveProfile: vi.fn() }))
const v = vi.hoisted(() => ({ getSummary: vi.fn(), listRuns: vi.fn(), getRun: vi.fn(), listPromptSets: vi.fn(), startRun: vi.fn(), cancelRun: vi.fn(), listEvidence: vi.fn(), getEvidence: vi.fn(), getQuestionHistory: vi.fn() }))
const socket = vi.hoisted(() => {
  const handlers = new Map()
  const stateCbs = new Set()
  return {
    handlers, stateCbs,
    addEventListener: vi.fn((e, h) => { if (!handlers.has(e)) handlers.set(e, new Set()); handlers.get(e).add(h) }),
    removeEventListener: vi.fn((e, h) => handlers.get(e)?.delete(h)),
    joinProject: vi.fn(),
    onConnectionStateChange: vi.fn((cb) => { stateCbs.add(cb); return () => stateCbs.delete(cb) }),
    emit: (e, payload) => handlers.get(e)?.forEach((h) => h(payload)),
  }
})
vi.mock("@/services/aiVisibilityQuestionService", () => ({ default: q }))
vi.mock("@/services/chatgptVisibilityService", () => ({ default: v }))
vi.mock("@/lib/socketService", () => ({ default: socket, ConnectionState: { CONNECTED: "connected", RECONNECTING: "reconnecting", DISCONNECTED: "disconnected" } }))

import { useQuestionSets, useGenerateDraft, useUpdateQuestion, useApproveQuestionSet, useDiscardQuestionSet, useSaveBusinessProfile } from "./useAiVisibilityQuestions"
import { useStartChatGptRun, useChatGptLiveProgress, useRunEvidence, useEvidenceItem } from "./useChatGptVisibility"
import { queryKeys } from "@/lib/query/keys"

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const spy = vi.spyOn(client, "invalidateQueries")
  const wrapper = ({ children }) => createElement(QueryClientProvider, { client }, children)
  return { client, spy, wrapper }
}
const setDto = (o = {}) => ({ id: "s1", version: 1, status: "draft", questions: [], counts: {}, ...o })

beforeEach(() => {
  Object.values(q).forEach((f) => f.mockReset()); Object.values(v).forEach((f) => f.mockReset())
  socket.handlers.clear(); socket.stateCbs.clear()
  socket.addEventListener.mockClear(); socket.removeEventListener.mockClear(); socket.joinProject.mockClear()
})

describe("question-set queries and mutations", () => {
  test("list is project-scoped and cached per project: another project never sees this data", async () => {
    q.list.mockResolvedValue({ data: [setDto()] })
    const { client, wrapper } = setup()
    const { result } = renderHook(() => useQuestionSets("p1", { page: 1, limit: 10 }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(q.list).toHaveBeenCalledWith("p1", { page: 1, limit: 10 })
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.list("p1", { page: 1, limit: 10 }))).toBeTruthy()
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.list("p2", { page: 1, limit: 10 }))).toBeUndefined()
    const { result: none } = renderHook(() => useQuestionSets(undefined), { wrapper })
    expect(none.current.fetchStatus).toBe("idle") // no project -> no request
  })

  test("generate stores the server's new draft and refreshes only the list/approved queries", async () => {
    q.generate.mockResolvedValue({ data: setDto({ id: "s2", version: 2 }) })
    const { client, spy, wrapper } = setup()
    const { result } = renderHook(() => useGenerateDraft("p1"), { wrapper })
    await act(async () => { await result.current.mutateAsync() })
    expect(q.generate).toHaveBeenCalledWith("p1") // nothing but the project: the server reads the stored profile
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.set("p1", "s2")).data.version).toBe(2)
    const keys = spy.mock.calls.map((c) => c[0].queryKey)
    expect(keys).toContainEqual([...queryKeys.aiVisibilityQuestions.all("p1"), "list"])
    expect(keys).toContainEqual(queryKeys.aiVisibilityQuestions.approved("p1"))
    expect(keys.some((k) => k[0] === "chatgpt-visibility")).toBe(false) // not a broad invalidation
  })

  test("saving the profile caches the server's re-computed profile and re-reads question sets (they may now be stale)", async () => {
    q.saveProfile = vi.fn().mockResolvedValue({ data: { project: { targetCity: "Mumbai" }, completeness: { ready: true } } })
    const { client, spy, wrapper } = setup()
    const { result } = renderHook(() => useSaveBusinessProfile("p1"), { wrapper })
    await act(async () => { await result.current.mutateAsync({ targetCity: "Mumbai" }) })
    expect(q.saveProfile).toHaveBeenCalledWith("p1", { targetCity: "Mumbai" })
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.profile("p1")).data.project.targetCity).toBe("Mumbai")
    const keys = spy.mock.calls.map((c) => c[0].queryKey)
    expect(keys).toContainEqual([...queryKeys.aiVisibilityQuestions.all("p1"), "set"])
    expect(keys).toContainEqual(queryKeys.aiVisibilityQuestions.approved("p1"))
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.profile("p2"))).toBeUndefined()
  })

  test("approval state comes from the server's response, never from local state", async () => {
    const { client, wrapper } = setup()
    client.setQueryData(queryKeys.aiVisibilityQuestions.set("p1", "s1"), { data: setDto({ status: "draft" }) })
    q.approve.mockResolvedValue({ data: setDto({ status: "approved", approvedAt: "2026-10-24T10:00:00Z" }) })
    const { result } = renderHook(() => useApproveQuestionSet("p1", "s1"), { wrapper })
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.set("p1", "s1")).data.status).toBe("draft")
    await act(async () => { await result.current.mutateAsync() })
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.set("p1", "s1")).data.status).toBe("approved")
  })

  test("a refused approval (conflict) leaves the cached set untouched and re-reads the server's state", async () => {
    const { client, spy, wrapper } = setup()
    client.setQueryData(queryKeys.aiVisibilityQuestions.set("p1", "s1"), { data: setDto({ status: "draft" }) })
    q.approve.mockRejectedValue(Object.assign(new Error("changed"), { status: 409 }))
    const { result } = renderHook(() => useApproveQuestionSet("p1", "s1"), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync()).rejects.toThrow("changed") })
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.set("p1", "s1")).data.status).toBe("draft")
    expect(spy.mock.calls.map((c) => c[0].queryKey)).toContainEqual(queryKeys.aiVisibilityQuestions.set("p1", "s1"))
  })

  test("a double click sends one approve request (single flight)", async () => {
    let release
    q.approve.mockImplementation(() => new Promise((r) => { release = () => r({ data: setDto({ status: "approved" }) }) }))
    const { wrapper } = setup()
    const { result } = renderHook(() => useApproveQuestionSet("p1", "s1"), { wrapper })
    act(() => { result.current.mutate(); result.current.mutate(); result.current.mutate() })
    await waitFor(() => expect(q.approve).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(q.approve).toHaveBeenCalledTimes(1) // the second and third clicks were dropped
    await act(async () => { release() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // after it settles a new attempt is allowed again
    q.approve.mockResolvedValue({ data: setDto() })
    act(() => { result.current.mutate() })
    await waitFor(() => expect(q.approve).toHaveBeenCalledTimes(2))
  })

  test("discard and update write the server's document into the cache", async () => {
    const { client, wrapper } = setup()
    q.discard.mockResolvedValue({ data: setDto({ status: "archived" }) })
    q.updateQuestion.mockResolvedValue({ data: setDto({ questions: [{ id: "q1", enabled: false }] }) })
    const d = renderHook(() => useDiscardQuestionSet("p1", "s1"), { wrapper })
    await act(async () => { await d.result.current.mutateAsync() })
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.set("p1", "s1")).data.status).toBe("archived")
    const u = renderHook(() => useUpdateQuestion("p1", "s1"), { wrapper })
    await act(async () => { await u.result.current.mutateAsync({ questionId: "q1", changes: { enabled: false } }) })
    expect(q.updateQuestion).toHaveBeenCalledWith("p1", "s1", "q1", { enabled: false })
    expect(client.getQueryData(queryKeys.aiVisibilityQuestions.set("p1", "s1")).data.questions[0].enabled).toBe(false)
  })
})

describe("starting runs", () => {
  test("an approved run is started with the set id only, and a double click sends one request", async () => {
    let release
    v.startRun.mockImplementation(() => new Promise((r) => { release = () => r({ data: { id: "r1" } }) }))
    const { spy, wrapper } = setup()
    const { result } = renderHook(() => useStartChatGptRun("p1"), { wrapper })
    act(() => { result.current.mutate({ questionSetId: "s1" }); result.current.mutate({ questionSetId: "s1" }) })
    await waitFor(() => expect(v.startRun).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(v.startRun).toHaveBeenCalledTimes(1)
    expect(v.startRun).toHaveBeenCalledWith("p1", { questionSetId: "s1" })
    await act(async () => { release() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const keys = spy.mock.calls.map((c) => c[0].queryKey)
    expect(keys).toContainEqual(queryKeys.chatgptVisibility.summary("p1"))
    expect(keys.some((k) => k.includes("evidence"))).toBe(false) // stored answers are not re-fetched for a start
  })

  test("no argument keeps the legacy five-prompt call", async () => {
    v.startRun.mockResolvedValue({ data: { id: "r1" } })
    const { wrapper } = setup()
    const { result } = renderHook(() => useStartChatGptRun("p1"), { wrapper })
    act(() => { result.current.mutate() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(v.startRun).toHaveBeenCalledWith("p1", {})
  })
})

describe("evidence queries are lazy", () => {
  test("nothing is requested until enabled; detail needs a question id", async () => {
    const { wrapper } = setup()
    const a = renderHook(() => useEvidenceItem("p1", "r1", "q1", { enabled: false }), { wrapper })
    const b = renderHook(() => useEvidenceItem("p1", "r1", null), { wrapper })
    const c = renderHook(() => useRunEvidence("p1", "r1", { page: 1 }, { enabled: false }), { wrapper })
    expect([a.result.current.fetchStatus, b.result.current.fetchStatus, c.result.current.fetchStatus]).toEqual(["idle", "idle", "idle"])
    expect(v.getEvidence).not.toHaveBeenCalled(); expect(v.listEvidence).not.toHaveBeenCalled()
  })
})

describe("live progress (socket)", () => {
  const evt = (o = {}) => ({ projectId: "p1", runId: "r1", status: "running", completedPrompts: 3, totalPrompts: 10, executionMode: "approved_questions", questionSetVersion: 2, succeeded: 2, failed: 1, skipped: 0, pending: 7, ...o })

  test("subscribes once, joins the project room, and removes every listener on unmount", () => {
    const { wrapper } = setup()
    const { unmount } = renderHook(() => useChatGptLiveProgress("p1"), { wrapper })
    const added = socket.addEventListener.mock.calls.length
    expect(added).toBe(9) // 5 progress + 4 terminal events
    expect(socket.joinProject).toHaveBeenCalledWith("p1")
    unmount()
    expect(socket.removeEventListener.mock.calls.length).toBe(added)
    expect([...socket.handlers.values()].every((s) => s.size === 0)).toBe(true)
    expect(socket.stateCbs.size).toBe(0)
  })

  test("progress events update the counters the backend emits and ignore other projects", () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useChatGptLiveProgress("p1"), { wrapper })
    act(() => socket.emit("chatgpt_visibility:question_completed", evt()))
    expect(result.current).toMatchObject({ runId: "r1", completed: 3, total: 10, succeeded: 2, failed: 1, pending: 7, questionSetVersion: 2, executionMode: "approved_questions" })
    act(() => socket.emit("chatgpt_visibility:progress", evt({ projectId: "other", completedPrompts: 9 })))
    expect(result.current.completed).toBe(3)
  })

  test("an identical event does not produce a new state object (no needless re-render)", () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useChatGptLiveProgress("p1"), { wrapper })
    act(() => socket.emit("chatgpt_visibility:progress", evt()))
    const first = result.current
    act(() => socket.emit("chatgpt_visibility:progress", evt()))
    // the same state object is kept, so consumers that depend on it (memoised children) do not see a change
    expect(result.current).toBe(first)
    act(() => socket.emit("chatgpt_visibility:progress", evt({ completedPrompts: 4 })))
    expect(result.current).not.toBe(first)
  })

  test("a terminal event clears live state and refetches the summary and that run from the API", () => {
    const { spy, wrapper } = setup()
    const { result } = renderHook(() => useChatGptLiveProgress("p1"), { wrapper })
    act(() => socket.emit("chatgpt_visibility:progress", evt()))
    expect(result.current).not.toBeNull()
    for (const e of ["completed", "partial", "cancelled", "failed"]) {
      spy.mockClear()
      act(() => socket.emit(`chatgpt_visibility:${e}`, evt({ status: e })))
      const keys = spy.mock.calls.map((c) => c[0].queryKey)
      expect(keys).toContainEqual(queryKeys.chatgptVisibility.summary("p1"))
      expect(keys).toContainEqual(queryKeys.chatgptVisibility.run("p1", "r1"))
      expect(keys).toContainEqual(queryKeys.chatgptVisibility.evidenceRun("p1", "r1"))
    }
    expect(result.current).toBeNull()
  })

  test("question events do not invalidate on every event: the evidence list refreshes at most once per interval", () => {
    vi.useFakeTimers()
    try {
      const { spy, wrapper } = setup()
      renderHook(() => useChatGptLiveProgress("p1"), { wrapper })
      for (let i = 0; i < 20; i += 1) act(() => socket.emit("chatgpt_visibility:question_completed", evt({ completedPrompts: i, questionStatus: "succeeded", questionId: `q${i}` })))
      expect(spy).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(4100) })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0][0].queryKey).toEqual(queryKeys.chatgptVisibility.evidenceRun("p1", "r1"))
    } finally { vi.useRealTimers() }
  })

  test("after a socket reconnect the page re-reads the truth from the API", () => {
    const { spy, wrapper } = setup()
    const { result } = renderHook(() => useChatGptLiveProgress("p1"), { wrapper })
    act(() => socket.emit("chatgpt_visibility:progress", evt()))
    spy.mockClear()
    act(() => socket.stateCbs.forEach((cb) => cb("connected", "reconnecting")))
    expect(result.current).toBeNull()
    expect(spy.mock.calls.map((c) => c[0].queryKey)).toContainEqual(queryKeys.chatgptVisibility.summary("p1"))
    // a first connection (not a reconnect) is not treated as a recovery
    spy.mockClear()
    act(() => socket.stateCbs.forEach((cb) => cb("connected", "connecting")))
    expect(spy).not.toHaveBeenCalled()
  })

  test("switching project drops the previous project's live state and listeners", () => {
    const { wrapper } = setup()
    const { result, rerender } = renderHook(({ id }) => useChatGptLiveProgress(id), { wrapper, initialProps: { id: "p1" } })
    act(() => socket.emit("chatgpt_visibility:progress", evt()))
    expect(result.current).not.toBeNull()
    rerender({ id: "p2" })
    expect(result.current).toBeNull()
    expect(socket.joinProject).toHaveBeenLastCalledWith("p2")
    act(() => socket.emit("chatgpt_visibility:progress", evt())) // an event for p1 after switching
    expect(result.current).toBeNull()
  })
})
