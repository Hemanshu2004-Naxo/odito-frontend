import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { createElement } from "react"

const h = vi.hoisted(() => ({
  project: { _id: "p1" }, push: vi.fn(),
  summary: null, approved: null, sets: null, profile: null, run: null, live: null,
  saveProfile: null, generate: null, cancel: { mutate: vi.fn(), isPending: false, error: null },
  start: { mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() },
  trend: null, cited: { isLoading: false, data: { data: { pages: [] } } }, evidence: null, evidenceItem: { isLoading: false, data: null }, history: { isLoading: false, data: { data: [] } },
  compare: null,
}))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: h.project }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }), useSearchParams: () => new URLSearchParams(""), useParams: () => ({}) }))
vi.mock("@/hooks/useAiVisibilityQuestions", () => ({
  useApprovedQuestionSet: () => h.approved, useQuestionSets: () => h.sets, useBusinessProfile: () => h.profile,
  useSaveBusinessProfile: () => h.saveProfile, useGenerateDraft: () => h.generate,
}))

import BusinessProfilePanel, { profileChanges } from "./BusinessProfilePanel"

const apiError = (status, message, details) => Object.assign(new Error(message), { status, details })
const profileDto = (o = {}) => ({
  project: { name: "ASG Eye Hospital", website: "https://asgeye.example", businessType: "Service-based", industry: "healthcare", legacyIndustryText: null, subIndustry: "eye hospital", targetCity: "Mumbai", locationSource: "user_entered", location: "mumbai", country: "IN", seoScope: "local", physicalCity: "Ahmedabad", ...(o.project || {}) },
  confirmed: { services: ["Cataract surgery"], targetCities: [], serviceAreas: [], customerTypes: [], customerProblems: [], requirements: [], buyingRequirements: [], language: "en", updatedAt: null, ...(o.confirmed || {}) },
  suggestions: { services: [], servicesSource: null, city: null, competitors: [], ...(o.suggestions || {}) },
  resolved: { category: "eye hospital", services: ["Cataract surgery"], targetCities: ["Mumbai"], citySource: "project.target_city", scope: "local", language: "en" },
  completeness: { missingProfile: [], missingForQuestions: ["customer_types"], conflicts: [], warnings: [], ready: true, ...(o.completeness || {}) },
  profileHash: "h", industries: [{ value: "healthcare", label: "Healthcare" }, { value: "education", label: "Education" }],
})
const overview = (o = {}) => ({
  source: "approved_questions", runId: "r1", questionSetVersion: 2, status: "completed", completedAt: "2026-10-24T10:30:00Z", questionsPlanned: 30, partial: false,
  eligibleAnswers: 25, execution: { attempted: 26, answered: 25, failed: 1, skipped: 0 },
  visibility: { rate: 0.32, answers: 8 }, recommendation: { rate: 0.12, answers: 3, method: "heuristic_v1" }, websiteCitation: { rate: 0.2, answers: 5 },
  uniqueCitedPages: 4, citationOccurrences: 9,
  competitors: { configured: true, mentioned: [{ name: "Sankara Eye Care", answers: 10, rate: 0.4, occurrences: 12 }] },
  cost: { knownTotal: 0.31, unit: "provider_reported", knownCount: 24, unknownCostCount: 1 }, limitations: ["SAMPLED_QUESTIONS", "UNKNOWN_COST_PRESENT"], sampled: true, ...o,
})
const approvedSet = (o = {}) => ({ id: "s2", version: 2, status: "approved", counts: { enabled: 30, total: 30 }, questions: [], approvedAt: "2026-10-20T10:00:00Z", profileChanged: false, ...o })

beforeEach(() => {
  h.push.mockReset()
  h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: null } } }
  h.approved = { isLoading: false, data: { data: approvedSet() } }
  h.sets = { isLoading: false, data: { data: [] } }
  h.profile = { isLoading: false, data: { data: profileDto() } }
  h.run = { isLoading: false, data: { data: { id: "r1", status: "completed", executionMode: "approved_questions", questionSetVersion: 2, completedAt: "2026-10-24T10:30:00Z", questions: [{ questionId: "q1", intent: "discovery" }], metrics: { brandReputation: { questions: 3, succeeded: 3, answersMentioningBrand: 2 } } } } }
  h.live = null
  h.saveProfile = { mutate: vi.fn(), isPending: false, error: null, isSuccess: false }
  h.generate = { mutate: vi.fn(), isPending: false, error: null }
  h.trend = { isLoading: false, data: { data: { points: [] } } }
  h.evidence = { isLoading: false, data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } } }
  h.compare = { isLoading: false, data: undefined }
})

// ───────────────────────────── metrics card ─────────────────────────────
describe("business profile panel", () => {
  test("shows stored values, a read-only project summary, and what is not confirmed yet", () => {
    render(createElement(BusinessProfilePanel, { projectId: "p1" }))
    expect(screen.getByLabelText("Industry").value).toBe("healthcare")
    expect(screen.getByLabelText("Kind of business").value).toBe("eye hospital")
    expect(screen.getByLabelText("Main target city").value).toBe("Mumbai")
    expect(screen.getByText("Ahmedabad")).toBeTruthy() // the physical (listed) city, shown apart from the target
    expect(screen.getByText(/Not confirmed yet: Customer types/)).toBeTruthy()
    expect(screen.getByText("Ready for questions")).toBeTruthy()
  })

  test("Save is disabled until something changes, then sends ONLY the changed fields; generating waits for a save", () => {
    render(createElement(BusinessProfilePanel, { projectId: "p1" }))
    expect(screen.getByRole("button", { name: "Save profile" }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Main target city"), { target: { value: "Pune" } })
    expect(screen.getByRole("button", { name: "Generate draft questions" }).disabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))
    expect(h.saveProfile.mutate).toHaveBeenCalledWith({ targetCity: "Pune" })
  })

  test("generate creates a draft from the stored profile and opens it", () => {
    render(createElement(BusinessProfilePanel, { projectId: "p1" }))
    fireEvent.click(screen.getByRole("button", { name: "Generate draft questions" }))
    const [, options] = h.generate.mutate.mock.calls[0]
    options.onSuccess({ data: { id: "s9" } })
    expect(h.push).toHaveBeenCalledWith("/app/google-ai-overview/questions/s9")
  })

  test("a legacy free-text industry is explained, not silently converted; a city conflict blocks generation", () => {
    h.profile = { isLoading: false, data: { data: profileDto({ project: { industry: null, legacyIndustryText: "Service-based" }, completeness: { conflicts: [{ field: "city", values: ["mumbai", "Ahmedabad"] }], ready: false } }) } }
    render(createElement(BusinessProfilePanel, { projectId: "p1" }))
    expect(screen.getByText(/Previously saved as the industry: “Service-based”/)).toBeTruthy()
    expect(screen.getByLabelText("Industry").value).toBe("")
    expect(screen.getByText(/Two different cities are on record/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Generate draft questions" }).disabled).toBe(true)
  })

  test("suggestions are only used when accepted", () => {
    h.profile = { isLoading: false, data: { data: profileDto({ project: { targetCity: null }, confirmed: { services: [] }, suggestions: { services: ["LASIK", "Retina care"], city: { value: "mumbai", source: "project.location" } } }) } }
    render(createElement(BusinessProfilePanel, { projectId: "p1" }))
    expect(screen.getByLabelText("Main target city").value).toBe("")
    fireEvent.click(screen.getByRole("button", { name: "Use it" }))
    expect(screen.getByLabelText("Main target city").value).toBe("mumbai")
    fireEvent.click(screen.getByRole("button", { name: "Confirm these" }))
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))
    expect(h.saveProfile.mutate).toHaveBeenCalledWith({ targetCity: "mumbai", services: ["LASIK", "Retina care"] })
  })

  test("server field errors are shown next to the field and the input is kept", () => {
    h.saveProfile = { mutate: vi.fn(), isPending: false, isSuccess: false, error: apiError(422, "x", { code: "INVALID_PROFILE", fields: { subIndustry: "Contains a web address or text that is not allowed" } }) }
    render(createElement(BusinessProfilePanel, { projectId: "p1" }))
    expect(screen.getByText("Contains a web address or text that is not allowed")).toBeTruthy()
    expect(screen.getByText(/Check the highlighted fields/)).toBeTruthy()
  })

  test("profileChanges: an emptied field is an explicit clear; unchanged fields are not sent", () => {
    const base = { industry: "healthcare", subIndustry: "eye hospital", targetCity: "Mumbai", language: "en", services: ["A"], targetCities: [], serviceAreas: [], customerTypes: [], customerProblems: [], requirements: [], buyingRequirements: [] }
    expect(profileChanges(base, { ...base })).toEqual({})
    expect(profileChanges(base, { ...base, targetCity: "  " })).toEqual({ targetCity: null })
    expect(profileChanges(base, { ...base, services: ["A", "B"], language: "hi" })).toEqual({ services: ["A", "B"], language: "hi" })
  })
})

// ───────────────────────────── comparing runs ─────────────────────────────