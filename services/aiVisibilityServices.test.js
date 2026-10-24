import { describe, test, expect, vi, beforeEach } from "vitest"

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), request: vi.fn() }))
vi.mock("@/lib/apiService", () => ({ default: api }))

import aiVisibilityQuestionService from "./aiVisibilityQuestionService"
import chatgptVisibilityService from "./chatgptVisibilityService"

beforeEach(() => { api.get.mockReset(); api.post.mockReset(); api.request.mockReset() })

describe("question-set service: the contract with the backend", () => {
  test("every call is project-scoped and uses the documented paths", () => {
    aiVisibilityQuestionService.list("p1", { page: 2, limit: 5 })
    aiVisibilityQuestionService.get("p1", "s1")
    aiVisibilityQuestionService.getApproved("p1")
    aiVisibilityQuestionService.approve("p1", "s1")
    aiVisibilityQuestionService.discard("p1", "s1")
    expect(api.get.mock.calls.map((c) => c[0])).toEqual([
      "/ai-visibility/projects/p1/question-sets?page=2&limit=5",
      "/ai-visibility/projects/p1/question-sets/s1",
      "/ai-visibility/projects/p1/question-sets/approved",
    ])
    expect(api.post.mock.calls.map((c) => c[0])).toEqual([
      "/ai-visibility/projects/p1/question-sets/s1/approve",
      "/ai-visibility/projects/p1/question-sets/s1/discard",
    ])
  })

  test("generate sends nothing: the server builds questions from the STORED, confirmed profile", () => {
    aiVisibilityQuestionService.generate("p1", { category: "ignored", services: ["ignored"] })
    expect(api.post).toHaveBeenCalledWith("/ai-visibility/projects/p1/question-sets", {})
  })

  test("the business profile is read with GET and saved with PUT of only the changed fields", () => {
    aiVisibilityQuestionService.getProfile("p1")
    aiVisibilityQuestionService.saveProfile("p1", { targetCity: "Mumbai", services: ["Cataract surgery"] })
    expect(api.get).toHaveBeenCalledWith("/ai-visibility/projects/p1/profile")
    expect(api.request).toHaveBeenCalledWith("/ai-visibility/projects/p1/profile", { method: "PUT", body: JSON.stringify({ targetCity: "Mumbai", services: ["Cataract surgery"] }) })
  })

  test("editing a question is a PATCH of enabled/text for that question id (URL-encoded)", () => {
    aiVisibilityQuestionService.updateQuestion("p1", "s1", "q_a/b", { enabled: false })
    expect(api.request).toHaveBeenCalledWith("/ai-visibility/projects/p1/question-sets/s1/questions/q_a%2Fb", { method: "PATCH", body: JSON.stringify({ enabled: false }) })
  })
})

describe("visibility service: approved runs and evidence", () => {
  test("no argument starts the legacy five-prompt check with an empty body", () => {
    chatgptVisibilityService.startRun("p1")
    expect(api.post).toHaveBeenCalledWith("/ai-visibility/chatgpt/projects/p1/runs", {})
  })

  test("an approved run sends only the mode and the question set id: never a model, provider setting or cost limit", () => {
    chatgptVisibilityService.startRun("p1", { questionSetId: "s9", model: "gpt-evil", maxRunCost: 999, webSearch: false })
    expect(api.post).toHaveBeenCalledWith("/ai-visibility/chatgpt/projects/p1/runs", { mode: "approved_questions", questionSetId: "s9" })
  })

  test("reporting endpoints: trend range, cited pages by run, comparison of two runs", () => {
    chatgptVisibilityService.getTrend("p1", "30d")
    chatgptVisibilityService.getCitedPages("p1", { runId: "r1" })
    chatgptVisibilityService.compareRuns("p1", "a", "b")
    expect(api.get.mock.calls.map((c) => c[0])).toEqual([
      "/ai-visibility/chatgpt/projects/p1/trend?range=30d",
      "/ai-visibility/chatgpt/projects/p1/cited-pages?runId=r1",
      "/ai-visibility/chatgpt/projects/p1/compare?runA=a&runB=b",
    ])
  })

  test("table filters are passed through; empty ones are dropped", () => {
    chatgptVisibilityService.listEvidence("p1", "r1", { page: 1, limit: 20, mentioned: "true", q: "lasik", cited: "", citedUrl: "https://asgeye.example/a", competitor: undefined })
    expect(api.get).toHaveBeenCalledWith("/ai-visibility/chatgpt/projects/p1/runs/r1/evidence?page=1&limit=20&mentioned=true&citedUrl=https%3A%2F%2Fasgeye.example%2Fa&q=lasik")
  })

  test("evidence list builds a bounded, filtered query; detail and history are scoped and encoded", () => {
    chatgptVisibilityService.listEvidence("p1", "r1", { page: 3, limit: 20, status: "failed", intent: "discovery", group: undefined })
    chatgptVisibilityService.getEvidence("p1", "r1", "q 1")
    chatgptVisibilityService.getQuestionHistory("p1", "q 1", { limit: 5 })
    expect(api.get.mock.calls.map((c) => c[0])).toEqual([
      "/ai-visibility/chatgpt/projects/p1/runs/r1/evidence?page=3&limit=20&status=failed&intent=discovery",
      "/ai-visibility/chatgpt/projects/p1/runs/r1/evidence/q%201",
      "/ai-visibility/chatgpt/projects/p1/questions/q%201/history?limit=5",
    ])
  })
})
