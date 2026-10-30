import { describe, test, expect, vi, beforeEach } from "vitest"

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), request: vi.fn() }))
vi.mock("@/lib/apiService", () => ({ default: api }))

import aiVisibilityQuestionService from "./aiVisibilityQuestionService"

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
