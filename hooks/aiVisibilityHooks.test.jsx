import { describe, test, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const q = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), getApproved: vi.fn(), generate: vi.fn(), updateQuestion: vi.fn(), approve: vi.fn(), discard: vi.fn(), getProfile: vi.fn(), saveProfile: vi.fn() }))
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
vi.mock("@/lib/socketService", () => ({ default: socket, ConnectionState: { CONNECTED: "connected", RECONNECTING: "reconnecting", DISCONNECTED: "disconnected" } }))

import { useQuestionSets, useGenerateDraft, useUpdateQuestion, useApproveQuestionSet, useDiscardQuestionSet, useSaveBusinessProfile } from "./useAiVisibilityQuestions"
import { queryKeys } from "@/lib/query/keys"

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const spy = vi.spyOn(client, "invalidateQueries")
  const wrapper = ({ children }) => createElement(QueryClientProvider, { client }, children)
  return { client, spy, wrapper }
}
const setDto = (o = {}) => ({ id: "s1", version: 1, status: "draft", questions: [], counts: {}, ...o })

beforeEach(() => {
  Object.values(q).forEach((f) => f.mockReset())
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
    expect(keys.some((k) => k[0] === "google-aio-visibility")).toBe(false) // not a broad invalidation
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
