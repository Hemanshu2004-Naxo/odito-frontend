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
vi.mock("@/hooks/useChatGptVisibility", () => ({
  useChatGptSummary: () => h.summary, useChatGptRun: () => h.run, useCancelChatGptRun: () => h.cancel, useChatGptLiveProgress: () => h.live,
  useStartChatGptRun: () => h.start, useVisibilityTrend: () => h.trend, useCitedPages: () => h.cited, useRunEvidence: () => h.evidence,
  useEvidenceItem: () => h.evidenceItem, useQuestionHistory: () => h.history, useCompareRuns: () => h.compare,
}))

import VisibilityDashboard from "./VisibilityDashboard"
import BusinessProfilePanel, { profileChanges } from "./profile/BusinessProfilePanel"
import VisibilityOverviewCard from "./dashboard/VisibilityOverviewCard"
import RunComparePanel from "./evidence/RunComparePanel"
import { rateWithSample } from "./format"

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
describe("ChatGPT Visibility card", () => {
  test("five plain-language metrics, each percentage with its sample size; no execution metric among them", () => {
    render(createElement(VisibilityOverviewCard, { overview: overview() }))
    const card = screen.getByRole("region", { name: "ChatGPT Visibility" })
    expect(within(card).getByText("Visibility")).toBeTruthy()
    expect(within(card).getByText("32%")).toBeTruthy()
    expect(within(card).getByText("8 of 25 eligible answers")).toBeTruthy()
    expect(within(card).getByText("12%")).toBeTruthy()
    expect(within(card).getByText("3 of 25 eligible answers")).toBeTruthy()
    expect(within(card).getByText("20%")).toBeTruthy()
    expect(within(card).getByText("4")).toBeTruthy() // unique cited pages
    expect(within(card).getByText("9 citations in total")).toBeTruthy() // occurrences labelled separately
    expect(within(card).getByText("40%")).toBeTruthy()
    expect(within(card).getByText("Sankara Eye Care: 10 of 25 eligible answers")).toBeTruthy()
    // the confusing implementation terms are gone from the primary card
    expect(card.textContent).not.toMatch(/with your name|without your name|prompts answered|Brand mentioned/i)
    expect(document.body.textContent).not.toMatch(/\$|USD/)
  })

  test("with no eligible answers every rate is unavailable, not 0%", () => {
    render(createElement(VisibilityOverviewCard, { overview: overview({ eligibleAnswers: 0, visibility: { rate: null, answers: 0 }, recommendation: { rate: null, answers: 0 }, websiteCitation: { rate: null, answers: 0 }, uniqueCitedPages: null, citationOccurrences: null }) }))
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4)
    expect(screen.getAllByText("No eligible answers yet").length).toBe(3)
    expect(screen.queryByText("0%")).toBeNull()
  })

  test("with no competitors configured it says so instead of showing zeros", () => {
    render(createElement(VisibilityOverviewCard, { overview: overview({ competitors: { configured: false, mentioned: [] } }) }))
    expect(screen.getByText("No competitors tracked yet")).toBeTruthy()
  })

  test("each rate drills into the answers behind it", () => {
    const onDrill = vi.fn()
    render(createElement(VisibilityOverviewCard, { overview: overview(), onDrill }))
    fireEvent.click(screen.getByRole("button", { name: "Show answers that mention your business" }))
    fireEvent.click(screen.getByRole("button", { name: "Show answers that recommend your business" }))
    fireEvent.click(screen.getByRole("button", { name: "Show answers that cite your website" }))
    expect(onDrill.mock.calls.map((c) => c[0])).toEqual([{ mentioned: "true" }, { recommended: "true" }, { cited: "true" }])
  })

  test("rateWithSample formats and refuses to divide by zero", () => {
    expect(rateWithSample(0.32, 8, 25)).toEqual({ value: "32%", basis: "8 of 25 eligible answers" })
    expect(rateWithSample(1, 1, 1).basis).toBe("1 of 1 eligible answer")
    expect(rateWithSample(null, 0, 0)).toEqual({ value: "—", basis: "No eligible answers yet" })
    expect(rateWithSample(0, 0, 10).value).toBe("0%") // a real zero (with a sample) is shown as zero
  })
})

// ───────────────────────────── dashboard page ─────────────────────────────
describe("dashboard", () => {
  test("before any result: a setup checklist driven by server state", () => {
    h.approved = { isLoading: false, data: {} }
    h.sets = { isLoading: false, data: { data: [{ id: "s3", version: 3, status: "draft" }] } }
    render(createElement(VisibilityDashboard))
    expect(screen.getByText("Get your first visibility result")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Review draft" }).getAttribute("href")).toBe("/app/chatgpt-visibility/questions/s3")
    expect(screen.getByRole("button", { name: "Run approved questions" }).disabled).toBe(true)
    expect(screen.queryByRole("region", { name: "ChatGPT Visibility" })).toBeNull()
  })

  test("a location conflict on record is shown with a way to fix it", () => {
    h.profile = { isLoading: false, data: { data: profileDto({ completeness: { conflicts: [{ field: "city", values: ["mumbai", "Ahmedabad"] }], ready: false } }) } }
    render(createElement(VisibilityDashboard))
    expect(screen.getAllByRole("alert").some((n) => /Two different cities/.test(n.textContent))).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Confirm the target city" }))
    expect(screen.getByRole("dialog", { name: "Business profile" })).toBeTruthy()
  })

  test("with results: card, trend, cited pages, competitors, answers table, brand diagnostics kept apart, run details", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview() } } }
    render(createElement(VisibilityDashboard))
    expect(screen.getByRole("region", { name: "ChatGPT Visibility" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Visibility over time" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Most-cited pages" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Competitors" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Questions and answers" })).toBeTruthy()
    expect(screen.getByText(/never counted in the visibility figures above/)).toBeTruthy()
    const details = screen.getByRole("heading", { name: "Run details" }).closest("section")
    expect(within(details).getByText("26")).toBeTruthy() // questions sent: a diagnostic, not a headline figure
    expect(within(details).getByText(/1 answers had no reported cost \(not counted as zero\)/)).toBeTruthy()
  })

  test("clicking a metric filters the answers table", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview() } } }
    render(createElement(VisibilityDashboard))
    fireEvent.click(screen.getByRole("button", { name: "Show answers that mention your business" }))
    expect(screen.getByRole("button", { name: "Remove filter Mentioned" })).toBeTruthy()
  })

  test("partial runs, a newer approved set and a changed profile are each called out", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview({ partial: true, questionSetVersion: 1 }) } } }
    h.approved = { isLoading: false, data: { data: approvedSet({ profileChanged: true }) } }
    render(createElement(VisibilityDashboard))
    expect(screen.getByText(/Some questions in this run failed or were not sent/)).toBeTruthy()
    expect(screen.getByText(/Questions v2 are now approved, but these results come from v1/)).toBeTruthy()
    expect(screen.getByText(/Your business profile changed after these questions were approved/)).toBeTruthy()
  })

  test("a running approved run shows progress and blocks a second start", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, overview: null, active: { id: "r9", status: "running", executionMode: "approved_questions", questionSetVersion: 2, progress: { completed: 3, total: 10 }, questionStats: { total: 10, succeeded: 2, failed: 1, skipped: 0, pending: 7 } } } } }
    render(createElement(VisibilityDashboard))
    expect(screen.getByText("2 answered · 1 failed · 7 remaining")).toBeTruthy()
    // the header button and the checklist's run step both show the run and refuse a second start
    const buttons = screen.getAllByRole("button", { name: "Run in progress" })
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.every((b) => b.disabled)).toBe(true)
  })

  test("API failure and loading states", () => {
    h.summary = { isLoading: true }
    const { container, unmount } = render(createElement(VisibilityDashboard))
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy()
    unmount()
    h.summary = { isLoading: false, error: apiError(500, "x"), data: undefined }
    render(createElement(VisibilityDashboard))
    expect(screen.getByText(/Could not load visibility results/)).toBeTruthy()
  })

  test("trend: fewer than two runs is explained; question-set changes are disclosed", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview() } } }
    h.trend = { isLoading: false, data: { data: { points: [{ runId: "a", date: "2026-10-01T00:00:00Z", questionSetVersion: 1, comparableWithPrevious: false, figures: { visibilityRate: 0.2, recommendationRate: 0.1, websiteCitationRate: 0.1, eligibleAnswers: 20 } }] } } }
    const { unmount } = render(createElement(VisibilityDashboard))
    expect(screen.getByText(/One run so far in this range/)).toBeTruthy()
    unmount()
    h.trend = { isLoading: false, data: { data: { points: [
      { runId: "a", date: "2026-10-01T00:00:00Z", questionSetVersion: 1, comparableWithPrevious: false, figures: { visibilityRate: 0.2, recommendationRate: 0.1, websiteCitationRate: 0.1, eligibleAnswers: 20 } },
      { runId: "b", date: "2026-10-08T00:00:00Z", questionSetVersion: 2, comparableWithPrevious: false, figures: { visibilityRate: 0.32, recommendationRate: 0.12, websiteCitationRate: 0.2, eligibleAnswers: 25 } },
    ] } } }
    render(createElement(VisibilityDashboard))
    expect(screen.getByText(/The question set changed at the dashed line/)).toBeTruthy()
    const table = screen.getByRole("table", { name: "Visibility by run" })
    expect(within(table).getByText("32%")).toBeTruthy()
  })
})

// ───────────────────────────── business profile ─────────────────────────────
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
    expect(h.push).toHaveBeenCalledWith("/app/chatgpt-visibility/questions/s9")
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
describe("comparing two runs", () => {
  const runs = [{ id: "b", completedAt: "2026-10-08T00:00:00Z", questionSetVersion: 2 }, { id: "a", completedAt: "2026-10-01T00:00:00Z", questionSetVersion: 2 }]
  const figures = (v) => ({ visibilityRate: v, recommendationRate: 0.1, websiteCitationRate: 0.2, uniqueCitedPages: 3, eligibleAnswers: 20, failed: 0 })

  test("equivalent runs show the changes", () => {
    h.compare = { isLoading: false, data: { data: { equivalent: true, reasons: [], questions: { comparable: 20, changed: [], onlyInA: 0, onlyInB: 0 }, a: { id: "a", questionSetVersion: 2, figures: figures(0.2) }, b: { id: "b", questionSetVersion: 2, figures: figures(0.3) }, delta: { visibilityRate: 0.1, recommendationRate: 0, websiteCitationRate: 0, uniqueCitedPages: 0 } } } }
    render(createElement(RunComparePanel, { projectId: "p1", runs }))
    expect(screen.getByText(/directly comparable/)).toBeTruthy()
    expect(screen.getByText("+10 pts")).toBeTruthy()
  })

  test("non-equivalent runs list the reasons and the changed questions, and show no change figures", () => {
    h.compare = { isLoading: false, data: { data: { equivalent: false, reasons: ["DIFFERENT_QUESTION_SET_VERSION", "QUESTIONS_CHANGED"], questions: { comparable: 18, changed: [{ questionId: "q1", reasons: ["text", "location"], before: "x", after: "Which eye hospitals in Pune offer LASIK?" }], onlyInA: 0, onlyInB: 0 }, a: { id: "a", questionSetVersion: 1, figures: figures(0.2) }, b: { id: "b", questionSetVersion: 2, figures: figures(0.3) }, delta: null } } }
    render(createElement(RunComparePanel, { projectId: "p1", runs }))
    expect(screen.getByText(/Not directly comparable/)).toBeTruthy()
    expect(screen.getByText(/different question-set versions/)).toBeTruthy()
    expect(screen.getByText(/“Which eye hospitals in Pune offer LASIK\?” \(wording, target city\)/)).toBeTruthy()
    expect(screen.queryByText(/pts/)).toBeNull()
  })

  test("is hidden with fewer than two finished runs", () => {
    const { container } = render(createElement(RunComparePanel, { projectId: "p1", runs: runs.slice(0, 1) }))
    expect(container.textContent).toBe("")
  })
})
