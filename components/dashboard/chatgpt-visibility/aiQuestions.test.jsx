import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"
import { createElement } from "react"

const h = vi.hoisted(() => ({
  project: { _id: "p1", project_name: "asg-eye", main_url: "https://asgeye.example", industry: "Eye hospital", location: "Ahmedabad", country: "IN" },
  push: vi.fn(), replace: vi.fn(), search: "", params: { setId: "s1" },
  sets: null, set: null, approved: null,
  generate: { mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() },
  update: { mutateAsync: vi.fn() },
  approve: { mutate: vi.fn(), isPending: false, error: null },
  discard: { mutate: vi.fn(), isPending: false, error: null },
  summary: null, run: null, runs: null, evidence: null, evidenceItem: null, history: null,
  start: { mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() },
  cancel: { mutate: vi.fn(), isPending: false, error: null },
  live: null,
  profile: null, saveProfile: { mutate: vi.fn(), isPending: false, error: null, isSuccess: false },
  trend: { isLoading: false, data: { data: { points: [] } } }, cited: { isLoading: false, data: { data: { pages: [] } } }, compare: { isLoading: false, data: undefined },
}))

vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: h.project }) }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: h.replace }),
  useSearchParams: () => new URLSearchParams(h.search),
  useParams: () => h.params,
}))
vi.mock("@/hooks/useAiVisibilityQuestions", () => ({
  useQuestionSets: () => h.sets,
  useQuestionSet: () => h.set,
  useApprovedQuestionSet: () => h.approved,
  useGenerateDraft: () => h.generate,
  useUpdateQuestion: () => h.update,
  useApproveQuestionSet: () => h.approve,
  useDiscardQuestionSet: () => h.discard,
  useBusinessProfile: () => h.profile,
  useSaveBusinessProfile: () => h.saveProfile,
}))
vi.mock("@/hooks/useChatGptVisibility", () => ({
  useChatGptSummary: () => h.summary,
  useChatGptRun: () => h.run,
  useChatGptRuns: () => h.runs,
  useChatGptPromptSets: () => ({ data: { data: [] } }),
  useRunEvidence: () => h.evidence,
  useEvidenceItem: () => h.evidenceItem,
  useQuestionHistory: () => h.history,
  useStartChatGptRun: () => h.start,
  useCancelChatGptRun: () => h.cancel,
  useChatGptLiveProgress: () => h.live,
  useVisibilityTrend: () => h.trend,
  useCitedPages: () => h.cited,
  useCompareRuns: () => h.compare,
}))

import QuestionSetsContent from "./questions/QuestionSetsContent"
import QuestionSetDetailContent from "./questions/QuestionSetDetailContent"
import ListField from "./questions/ListField"
import { validateEntry } from "./questions/inputs"
import RunApprovedDialog from "./RunApprovedDialog"
import RunResultsRouter from "./RunResultsRouter"
import ApprovedRunResults from "./evidence/ApprovedRunResults"
import QuestionsAnswersTable from "./dashboard/QuestionsAnswersTable"
import MostCitedPages from "./dashboard/MostCitedPages"
import QuestionHistoryTable from "./evidence/QuestionHistoryTable"
import ApprovedHistoryContent, { ScoreDelta } from "./evidence/ApprovedHistoryContent"
import LiveRunProgress, { progressNumbers } from "./LiveRunProgress"
import { describeQuestionError, describeApprovedRunError } from "./format"

const q = (o = {}) => ({
  id: "q1", group: "visibility", text: "Which companies offer LASIK surgery in Ahmedabad?", intent: "discovery", service: "LASIK surgery", location: "Ahmedabad",
  language: "en", templateId: "disc_service_loc", priority: "high", selectionReason: "Confirmed service used.", source: "template", enabled: true, ...o,
})
const set = (o = {}) => ({
  id: "s1", version: 3, status: "draft", generatorVersion: "1.0.0", generatedBy: "template", fallbackReason: null, model: null, language: "en",
  inputs: { categories: ["eye hospital"], services: ["LASIK surgery"], cities: ["Ahmedabad"], areas: [], customerTypes: [], problems: [], requirements: [], buyingRequirements: [], language: "en" },
  missingBusinessInformation: [], warnings: [], profileChanged: false,
  questions: [q(), q({ id: "q2", text: "Who can help with blurred vision in Ahmedabad?", intent: "problem_solving", service: null }), q({ id: "b1", group: "brand_reputation", intent: "brand_reputation", text: "What is ASG Eye Hospital known for?", service: null, location: null })],
  counts: { total: 3, enabled: 3, visibility: 2, brandReputation: 1 }, approvedAt: null, createdAt: "2026-10-24T10:00:00Z", ...o,
})
const apiError = (status, message, details) => Object.assign(new Error(message), { status, details })
const profileDto = (o = {}) => ({
  project: { name: "ASG Eye Hospital", website: "https://asgeye.example", businessType: "Service-based", industry: "healthcare", legacyIndustryText: null, subIndustry: "eye hospital", targetCity: "Mumbai", locationSource: "user_entered", location: "mumbai", country: "IN", seoScope: "local", physicalCity: "Ahmedabad" },
  confirmed: { services: ["Cataract surgery"], targetCities: [], serviceAreas: [], customerTypes: [], customerProblems: [], requirements: [], buyingRequirements: [], language: "en", updatedAt: null },
  suggestions: { services: [], servicesSource: null, city: null, competitors: [] },
  resolved: { category: "eye hospital", services: ["Cataract surgery"], targetCities: ["Mumbai"], citySource: "project.target_city", scope: "local", language: "en" },
  completeness: { missingProfile: [], missingForQuestions: ["customer_types"], conflicts: [], warnings: [], ready: true },
  profileHash: "h", industries: [{ value: "healthcare", label: "Healthcare" }, { value: "education", label: "Education" }],
  ...o,
})

beforeEach(() => {
  h.push.mockReset(); h.replace.mockReset(); h.search = ""
  h.params = { setId: "s1" }
  h.generate = { mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() }
  h.update = { mutateAsync: vi.fn().mockResolvedValue({}) }
  h.approve = { mutate: vi.fn(), isPending: false, error: null }
  h.discard = { mutate: vi.fn(), isPending: false, error: null }
  h.start = { mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() }
  h.cancel = { mutate: vi.fn(), isPending: false, error: null }
  h.live = null
  h.sets = { isLoading: false, data: { data: [set({ id: "s3", version: 3, status: "draft" }), set({ id: "s2", version: 2, status: "approved", approvedAt: "2026-10-23T10:00:00Z" }), set({ id: "s1", version: 1, status: "archived" })], meta: { page: 1, limit: 10 } } }
  h.set = { isLoading: false, data: { data: set() } }
  h.approved = { isLoading: false, data: { data: set({ id: "s2", version: 2, status: "approved", approvedAt: "2026-10-23T10:00:00Z" }) } }
  h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: null } } }
  h.run = { isLoading: false, data: undefined }; h.runs = { data: { data: [] } }; h.evidence = { isLoading: false, data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } } }
  h.evidenceItem = { isLoading: false, data: null }; h.history = { isLoading: false, data: { data: [] } }
  h.profile = { isLoading: false, data: { data: profileDto() } }
  h.saveProfile = { mutate: vi.fn(), isPending: false, error: null, isSuccess: false }
  h.compare = { isLoading: false, data: undefined }
})

// ───────────────────────────── question sets list ─────────────────────────────
describe("question sets list", () => {
  test("groups sets by status with version, method, counts, missing details and warnings", () => {
    h.sets.data.data[0].missingBusinessInformation = ["customer_problems", "requirements"]
    h.sets.data.data[0].warnings = ["language_not_applied_templates_are_english"]
    render(createElement(QuestionSetsContent))
    expect(screen.getByRole("heading", { name: "Approved" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Drafts" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Archived" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Version 3" }).getAttribute("href")).toBe("/app/chatgpt-visibility/questions/s3")
    expect(screen.getByText("2 missing details")).toBeTruthy()
    expect(screen.getByText("1 warning")).toBeTruthy()
    expect(screen.getAllByText(/Template/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/3 of 3 questions enabled/).length).toBe(3)
  })

  test("empty and error states are explicit, with no sample data", () => {
    h.sets = { isLoading: false, data: { data: [] } }
    const { unmount } = render(createElement(QuestionSetsContent))
    expect(screen.getByText("No question sets yet")).toBeTruthy()
    expect(screen.queryByText(/Version \d/)).toBeNull()
    unmount()
    h.sets = { isLoading: false, error: apiError(401, "x"), data: undefined }
    render(createElement(QuestionSetsContent))
    expect(screen.getByRole("alert").textContent).toMatch(/session has expired/)
  })

  test("loading shows a skeleton; the page leads with the business profile questions are generated from", () => {
    h.sets = { isLoading: true }
    const { container, unmount } = render(createElement(QuestionSetsContent))
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy()
    unmount()
    h.sets = { isLoading: false, data: { data: [] } }
    render(createElement(QuestionSetsContent))
    expect(screen.getByRole("heading", { name: "Business profile" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Generate draft questions" })).toBeTruthy()
  })

  test("pagination: 'Older' is offered only when a full page came back", () => {
    h.sets.data.data = Array.from({ length: 10 }, (_, i) => set({ id: `x${i}`, version: 20 - i, status: "archived" }))
    render(createElement(QuestionSetsContent))
    expect(screen.getByRole("button", { name: "Older" }).disabled).toBe(false)
  })
})

// ───────────────────────────── draft review ─────────────────────────────
describe("question set detail: draft review", () => {
  test("a draft shows grouped questions with enable switches and edit controls, missing details and warnings", () => {
    h.set.data.data = set({ missingBusinessInformation: ["customer_types"], warnings: ["language_not_applied_templates_are_english"] })
    render(createElement(QuestionSetDetailContent))
    expect(screen.getByRole("heading", { name: /Discovery \(1\/1\)/ })).toBeTruthy()
    expect(screen.getByRole("heading", { name: /Problem solving/ })).toBeTruthy()
    expect(screen.getByRole("heading", { name: /Brand reputation/ })).toBeTruthy()
    expect(screen.getAllByRole("switch").length).toBe(3)
    expect(screen.getAllByRole("button", { name: /Edit question/ }).length).toBe(3)
    expect(screen.getByText("Customer types")).toBeTruthy()
    expect(screen.getByText(/The questions are in English/)).toBeTruthy()
  })

  test("disabling a question sends only { enabled } for that question to the server", async () => {
    render(createElement(QuestionSetDetailContent))
    fireEvent.click(screen.getAllByRole("switch")[0])
    await waitFor(() => expect(h.update.mutateAsync).toHaveBeenCalledWith({ questionId: "q1", changes: { enabled: false } }))
  })

  test("editing: validates length, saves the new text, and shows the server's refusal while keeping what was typed", async () => {
    render(createElement(QuestionSetDetailContent))
    fireEvent.click(screen.getAllByRole("button", { name: /Edit question/ })[0])
    const box = screen.getByRole("textbox")
    fireEvent.change(box, { target: { value: "too short" } })
    expect(screen.getByText(/At least 15 characters/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save" }).disabled).toBe(true)

    h.update.mutateAsync.mockRejectedValueOnce(apiError(422, "failed", { code: "VISIBILITY_QUESTION_SET_INVALID", issues: [{ code: "BRAND_IN_VISIBILITY_QUESTION" }] }))
    fireEvent.change(box, { target: { value: "Is ASG Eye Hospital good for LASIK surgery in Ahmedabad?" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/must not name your business/))
    expect(screen.getByRole("textbox").value).toMatch(/ASG Eye Hospital/) // not lost

    h.update.mutateAsync.mockResolvedValueOnce({})
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Which clinics near Satellite offer LASIK surgery for seniors?" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(h.update.mutateAsync).toHaveBeenLastCalledWith({ questionId: "q1", changes: { text: "Which clinics near Satellite offer LASIK surgery for seniors?" } }))
  })

  test("approve asks for confirmation, then calls the server once; the page does not decide approval itself", () => {
    render(createElement(QuestionSetDetailContent))
    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByText(/Approve version 3\?/)).toBeTruthy()
    expect(within(dialog).getByText(/version 2 is archived/)).toBeTruthy() // the currently approved set is named
    expect(h.approve.mutate).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }))
    expect(h.approve.mutate).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Draft")).toBeTruthy() // still a draft until the server's response replaces the data
  })

  test("approve is disabled with no enabled visibility question, and conflicts / limits come from the server's message", () => {
    h.set.data.data = set({ questions: [q({ enabled: false }), q({ id: "b1", group: "brand_reputation", intent: "brand_reputation", enabled: true })] })
    h.approve.error = apiError(409, "This question set changed.", { code: "VISIBILITY_QUESTION_SET_STATE" })
    render(createElement(QuestionSetDetailContent))
    expect(screen.getByRole("button", { name: "Approve" }).disabled).toBe(true)
    expect(screen.getAllByRole("alert").some((n) => /changed/.test(n.textContent))).toBe(true)
  })

  test("discard confirms and then calls the server", () => {
    render(createElement(QuestionSetDetailContent))
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }))
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Discard" }))
    expect(h.discard.mutate).toHaveBeenCalledTimes(1)
  })

  test("buttons are disabled while a request is in flight (no duplicate submission)", () => {
    h.approve.isPending = true
    render(createElement(QuestionSetDetailContent))
    expect(screen.getByRole("button", { name: "Approving…" }).disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Discard draft" }).disabled).toBe(true)
  })
})

describe("question set detail: immutability and access", () => {
  test("an approved set is read-only: no switches, no edit buttons, no approve; a new draft is the supported path", () => {
    h.set.data.data = set({ status: "approved", approvedAt: "2026-10-23T10:00:00Z" })
    render(createElement(QuestionSetDetailContent))
    expect(screen.queryAllByRole("switch").length).toBe(0)
    expect(screen.queryAllByRole("button", { name: /Edit question/ }).length).toBe(0)
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull()
    expect(screen.getByText(/approved and read-only/)).toBeTruthy()
    expect(screen.getByRole("button", { name: /Update profile and generate new questions/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Run these questions/ })).toBeTruthy()
  })

  test("an archived set is read-only and cannot be run", () => {
    h.set.data.data = set({ status: "archived" })
    render(createElement(QuestionSetDetailContent))
    expect(screen.queryAllByRole("switch").length).toBe(0)
    expect(screen.queryByRole("button", { name: /Run these questions/ })).toBeNull()
    expect(screen.getByText(/archived and read-only/)).toBeTruthy()
  })

  test("another project's set (404) and an expired session (401) are explained, not shown as empty", () => {
    h.set = { isLoading: false, error: apiError(404, "Question set not found"), data: undefined }
    const { unmount } = render(createElement(QuestionSetDetailContent))
    expect(screen.getByRole("alert").textContent).toMatch(/not available to your account/)
    unmount()
    h.set = { isLoading: false, error: apiError(401, "x"), data: undefined }
    render(createElement(QuestionSetDetailContent))
    expect(screen.getByRole("alert").textContent).toMatch(/session has expired/)
  })

  test("a changed business profile is flagged, and OpenAI fallback is explained", () => {
    h.set.data.data = set({ profileChanged: true, fallbackReason: "CHATGPT_AUTH_FAILED" })
    render(createElement(QuestionSetDetailContent))
    expect(screen.getByText(/business profile has changed/)).toBeTruthy()
    expect(screen.getByText(/built-in templates/)).toBeTruthy()
  })
})

// ───────────────────────────── business details form ─────────────────────────────
// ───────────────────────────── list field ─────────────────────────────
describe("list field (used by the business profile)", () => {
  test("validates an entry as it is added: web address, duplicate, length, count", () => {
    expect(validateEntry("ok", [])).toBeNull()
    expect(validateEntry("see www.x.com", [])).toMatch(/Web addresses/)
    expect(validateEntry("LASIK", ["lasik"])).toMatch(/already/)
    expect(validateEntry("x".repeat(101), [])).toMatch(/100 characters/)
    expect(validateEntry("a", Array.from({ length: 10 }, (_, i) => `v${i}`))).toMatch(/up to 10/)
  })

  test("comma adds entries in a batch and entries can be removed", () => {
    const onChange = vi.fn()
    render(createElement(ListField, { id: "f", label: "Things", value: ["a"], onChange, placeholder: "p" }))
    fireEvent.change(screen.getByLabelText("Things"), { target: { value: "b, c," } })
    expect(onChange).toHaveBeenCalledWith(["a", "b", "c"])
    fireEvent.click(screen.getByRole("button", { name: "Remove a" }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })
})

// ───────────────────────────── running approved questions ─────────────────────────────
describe("running the approved questions", () => {
  const approved = () => set({ id: "s2", version: 2, status: "approved" })
  const open = (props = {}) => render(createElement(RunApprovedDialog, { open: true, onOpenChange: vi.fn(), projectId: "p1", set: approved(), active: null, ...props }))

  test("shows the version, the enabled count and the cost warning, then sends only the set id", () => {
    const onOpenChange = vi.fn()
    open({ onOpenChange })
    expect(screen.getByText(/Version 2 · 3 enabled questions/)).toBeTruthy()
    expect(screen.getByText(/one paid request/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Run questions" }))
    expect(h.start.mutate).toHaveBeenCalledTimes(1)
    const [vars, options] = h.start.mutate.mock.calls[0]
    expect(vars).toEqual({ questionSetId: "s2" }) // no model, provider settings or limits
    options.onSuccess()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test("is disabled while starting or while a run is active, and explains refusals from the server", () => {
    h.start.isPending = true
    const { unmount } = open()
    expect(screen.getByRole("button", { name: "Starting…" }).disabled).toBe(true)
    unmount()
    h.start.isPending = false
    const { unmount: u2 } = open({ active: { id: "r1", status: "running" } })
    expect(screen.getByRole("button", { name: "Run questions" }).disabled).toBe(true)
    expect(screen.getByText(/already in progress/)).toBeTruthy()
    u2()
    h.start.error = apiError(409, "x", { code: "QUESTION_SET_NOT_APPROVED" })
    open()
    expect(screen.getByRole("alert").textContent).toMatch(/not approved/)
  })

  test("error mapping: refusals, auth and rate limits", () => {
    expect(describeApprovedRunError(apiError(409, "x", { code: "NO_APPROVED_QUESTION_SET" }))).toMatch(/no approved question set/)
    expect(describeApprovedRunError(apiError(404, "x"))).toMatch(/not available to your account/)
    expect(describeApprovedRunError(apiError(429, "x", { code: "PROJECT_COOLDOWN" }))).toMatch(/very recently/)
    expect(describeApprovedRunError(apiError(503, "x"))).toMatch(/not enabled/)
    expect(describeQuestionError(apiError(500, "boom"))).toBe("boom")
  })
})

// ───────────────────────────── progress ─────────────────────────────
describe("live progress", () => {
  const active = (o = {}) => ({ id: "r1", status: "running", executionMode: "approved_questions", questionSetVersion: 2, progress: { completed: 4, total: 10 }, questionStats: { total: 10, succeeded: 3, failed: 1, skipped: 0, pending: 6 }, ...o })

  test("shows answered, failed and remaining from the API when there are no live events (reload / reconnect)", () => {
    render(createElement(LiveRunProgress, { active: active(), live: null, onCancel: vi.fn() }))
    expect(screen.getByText("3 answered · 1 failed · 6 remaining")).toBeTruthy()
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40")
  })

  test("live counters override the API only for the SAME run", () => {
    const live = { runId: "r1", completed: 8, total: 10, succeeded: 7, failed: 1, skipped: 0, pending: 2 }
    expect(progressNumbers(active(), live)).toMatchObject({ succeeded: 7, failed: 1, remaining: 2, completed: 8 })
    expect(progressNumbers(active(), { ...live, runId: "other" })).toMatchObject({ succeeded: 3, remaining: 6, completed: 4 })
  })

  test("queued, cancelling and not-in-flight states", () => {
    const { unmount } = render(createElement(LiveRunProgress, { active: active({ status: "queued" }), live: null, onCancel: vi.fn() }))
    expect(screen.getByText(/Waiting for a worker/)).toBeTruthy()
    unmount()
    const onCancel = vi.fn()
    const { unmount: u2 } = render(createElement(LiveRunProgress, { active: active({ cancelRequested: true }), live: null, onCancel }))
    expect(screen.getByRole("button", { name: "Cancelling…" }).disabled).toBe(true)
    u2()
    const { container } = render(createElement(LiveRunProgress, { active: active({ status: "completed" }), live: null, onCancel }))
    expect(container.firstChild).toBeNull()
  })

  test("cancel calls the API with the run id", () => {
    const onCancel = vi.fn()
    render(createElement(LiveRunProgress, { active: active(), live: null, onCancel }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel run" }))
    expect(onCancel).toHaveBeenCalledWith("r1")
  })
})

// ───────────────────────────── overview ─────────────────────────────
const metrics = (o = {}) => ({
  mode: "approved_questions", questionsPlanned: 10,
  overview: { visibilityScore: 40, mentions: 4, citedPages: 2, basedOnAnswers: 10 },
  visibility: {
    questions: 10, attempted: 10, succeeded: 10, failed: 0, skipped: 0, executionSuccessRate: 1, answersMentioningBrand: 4, brandMentionRate: 0.4, brandMentionRateOfAttempted: 0.4,
    answersRecommendingBrand: 3, recommendationRate: 0.3, answersCitingWebsite: 2, websiteCitationRate: 0.2, uniqueFirstPartyPages: 2, uniqueFirstPartyUrls: 3, firstPartyCitationOccurrences: 4, uniqueExternalDomains: 5,
    competitorMentions: { totalOccurrences: 2, competitors: [{ name: "Rival Clinic", responses: 2, occurrences: 2 }] },
  },
  brandReputation: { questions: 2, succeeded: 2, failed: 0, skipped: 0, answersMentioningBrand: 2, answersCitingWebsite: 1, uniqueFirstPartyPages: 1 },
  byIntent: { discovery: { questions: 6, attempted: 6, succeeded: 6, failed: 0, answersMentioningBrand: 3, brandMentionRate: 0.5, answersRecommendingBrand: 2, answersCitingWebsite: 1 } },
  cost: { knownTotal: 0.2345, unit: "provider_reported", knownCount: 10, unknownCostCount: 0 }, partial: false, limitations: ["SAMPLED_QUESTIONS"], sampled: true, ...o,
})
const overview = (o = {}) => ({ source: "approved_questions", runId: "r1", questionSetVersion: 2, status: "completed", completedAt: "2026-10-24T10:30:00Z", visibilityScore: 40, mentions: 4, citedPages: 2, basedOnAnswers: 10, questionsPlanned: 10, partial: false, platforms: [{ platform: "chatgpt", mentions: 4, citedPages: 2, visibilityScore: 40, basedOnAnswers: 10 }], limitations: [], sampled: true, ...o })
const runDetail = (m = metrics()) => ({ isLoading: false, data: { data: { id: "r1", status: "completed", executionMode: "approved_questions", questionSetVersion: 2, metrics: m } } })

// ───────────────────────────── evidence ─────────────────────────────
const evidenceItem = (o = {}) => ({
  runId: "r1", questionSetId: "s2", questionSetVersion: 2, questionId: "q1", group: "visibility", intent: "discovery", question: "Which companies offer LASIK surgery in Ahmedabad?",
  service: "LASIK surgery", location: "Ahmedabad", language: "en", provider: "chatgpt", status: "succeeded", attempts: 1, model: "gpt-4o-mini", modelReported: "gpt-4o-mini-2024", webSearch: true,
  country: "IN", city: "Ahmedabad", locationApplied: "provider_country_city", firstPartyPages: ["https://asgeye.example/lasik"], externalDomains: ["other.example"],
  analysis: { brandMentioned: true, brandMentionCount: 2, recommended: true, recommendationMethod: "heuristic_v1", competitorMentions: [{ name: "Rival Clinic", count: 1 }] },
  cost: 0.0123, costStatus: "reported", costUnit: "provider_reported", errorCode: null, errorClass: null, retryable: null, startedAt: "2026-10-24T10:00:00Z", completedAt: "2026-10-24T10:00:05Z", durationMs: 5000, ...o,
})
const approvedRun = (o = {}) => ({
  id: "r1", status: "completed", executionMode: "approved_questions", questionSetVersion: 2, createdAt: "2026-10-24T10:00:00Z", completedAt: "2026-10-24T10:02:00Z",
  totalCost: { amount: 0.5, unit: "provider_reported", unknownCount: 0 }, questionStats: { total: 3, succeeded: 2, failed: 1, skipped: 0, pending: 0 },
  questions: [{ questionId: "q1", intent: "discovery" }, { questionId: "q2", intent: "problem_solving" }], market: { countryCode: "IN", effectiveScope: "local", city: "Ahmedabad" }, ...o,
})

describe("evidence", () => {
  test("lists every question with type, mentioned, recommended, website cited, date and result; failures are explained", () => {
    h.evidence = { isLoading: false, data: { data: [evidenceItem(), evidenceItem({ questionId: "q2", question: "Who can help with blurred vision?", intent: "problem_solving", status: "failed", errorCode: "CHATGPT_TIMEOUT", errorClass: "retryable", analysis: null, cost: null, firstPartyPages: [] })], meta: { page: 1, totalPages: 1, total: 2 } } }
    render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun() }))
    const table = screen.getByRole("table")
    const headers = within(table).getAllByRole("columnheader").map((th) => th.textContent)
    expect(headers).toEqual(["Question", "Type", "Mentioned", "Recommended", "Website cited", "Date", "Result"])
    expect(within(table).getByText("Which companies offer LASIK surgery in Ahmedabad?")).toBeTruthy()
    expect(within(table).getByText("Yes (1)")).toBeTruthy()
    expect(within(table).getByText("The request timed out.")).toBeTruthy()
    expect(screen.getByText("Questions v2")).toBeTruthy()
  })

  test("empty states: still running vs filtered vs nothing stored", () => {
    h.evidence = { isLoading: false, data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } } }
    const { unmount } = render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun({ status: "running" }) }))
    expect(screen.getByText("No answers stored yet")).toBeTruthy()
    expect(screen.getByText(/appear here as each question is answered/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: "failed" } })
    expect(screen.getByText("No questions match")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Remove filter Result/ })).toBeTruthy()
    unmount()
  })

  test("search is debounced into ONE server filter, and filter chips can be cleared", async () => {
    vi.useFakeTimers()
    try {
      const onFilterChange = vi.fn()
      render(createElement(QuestionsAnswersTable, { projectId: "p1", run: approvedRun(), filter: { mentioned: "true" }, onFilterChange }))
      const box = screen.getByRole("searchbox", { name: "Search questions" })
      fireEvent.change(box, { target: { value: "l" } })
      fireEvent.change(box, { target: { value: "la" } })
      fireEvent.change(box, { target: { value: "lasik" } })
      expect(onFilterChange).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(400)
      expect(onFilterChange).toHaveBeenCalledTimes(1)
      expect(onFilterChange).toHaveBeenCalledWith({ mentioned: "true", q: "lasik" })
      fireEvent.click(screen.getByRole("button", { name: "Remove filter Mentioned" }))
      expect(onFilterChange).toHaveBeenLastCalledWith({ mentioned: undefined })
    } finally { vi.useRealTimers() }
  })

  test("partial, cancelled and truncated runs are labelled", () => {
    const { unmount } = render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun({ status: "partial", policy: { truncatedQuestions: 4 } }) }))
    expect(screen.getByText(/This run is partial/)).toBeTruthy()
    expect(screen.getByText(/4 enabled questions were not included/)).toBeTruthy()
    unmount()
    render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun({ status: "cancelled" }) }))
    expect(screen.getByText(/This run was cancelled/)).toBeTruthy()
  })

  test("pagination moves through server pages and the list API error is shown", () => {
    h.evidence = { isLoading: false, data: { data: [evidenceItem()], meta: { page: 1, totalPages: 3, total: 41 } } }
    const { unmount } = render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun() }))
    expect(screen.getByText(/Page 1 of 3 · 41 results/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Previous" }).disabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    unmount()
    h.evidence = { isLoading: false, error: apiError(500, "x"), data: undefined }
    render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun() }))
    expect(screen.getByText(/Could not load the answers/)).toBeTruthy()
  })

  test("opening a result shows the exact question, full answer, citations, first-party pages and why it counted; no internal ids", () => {
    h.evidence = { isLoading: false, data: { data: [evidenceItem()], meta: { page: 1, totalPages: 1, total: 1 } } }
    h.evidenceItem = { isLoading: false, data: { data: evidenceItem({
      answer: "Top options:\n1. ASG Eye Hospital for LASIK\n2. Other Clinic",
      citations: [{ url: "https://asgeye.example/lasik?utm_source=chatgpt.com", normalizedUrl: "https://asgeye.example/lasik", host: "asgeye.example", title: "LASIK", isTarget: true }, { url: "https://other.example/a", normalizedUrl: "https://other.example/a", host: "other.example", title: null, isTarget: false }],
    }) } }
    h.history = { isLoading: false, data: { data: [evidenceItem(), evidenceItem({ runId: "r0", questionSetVersion: 1, question: "Which firms offer LASIK in Ahmedabad?" })] } }
    render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun() }))
    fireEvent.click(screen.getByRole("button", { name: /Open the answer for: Which companies offer LASIK/ }))
    const sheet = screen.getByRole("dialog")
    expect(within(sheet).getByText(/1\. ASG Eye Hospital for LASIK/)).toBeTruthy()
    expect(within(sheet).getByText("Your site")).toBeTruthy()
    expect(within(sheet).getAllByText("other.example").length).toBeGreaterThan(0)
    expect(within(sheet).getByText("https://asgeye.example/lasik")).toBeTruthy()
    expect(within(sheet).getByText("0.0123")).toBeTruthy()
    const how = within(sheet).getByRole("region", { name: "How this answer counted" })
    expect(within(how).getByText(/Yes - an answered question that does not name your business/)).toBeTruthy()
    expect(within(how).getByText("Counted: your business is mentioned")).toBeTruthy()
    expect(within(how).getByText(/Counted as recommended \(estimated/)).toBeTruthy()
    expect(within(how).getByText("Counted: 1 of your pages cited")).toBeTruthy()
    expect(within(how).getByText("Ahmedabad, IN")).toBeTruthy()
    expect(within(sheet).getByText(/wording of this question changed between versions/)).toBeTruthy()
    expect(sheet.textContent).not.toMatch(/providerRequestId|claimedBy|lease|worker|stack/i)
  })

  test("a failed or brand-diagnostic result explains that it does not count, never 'not mentioned'", () => {
    h.evidence = { isLoading: false, data: { data: [evidenceItem({ status: "failed", errorCode: "CHATGPT_MALFORMED_RESPONSE", errorClass: "parse", analysis: null, cost: null })], meta: { page: 1, totalPages: 1, total: 1 } } }
    h.evidenceItem = { isLoading: false, data: { data: evidenceItem({ status: "failed", errorCode: "CHATGPT_MALFORMED_RESPONSE", errorClass: "parse", analysis: null, cost: null, retryable: false, answer: null, citations: [] }) } }
    const { unmount } = render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun() }))
    fireEvent.click(screen.getByRole("button", { name: /Open the answer for/ }))
    let sheet = screen.getByRole("dialog")
    expect(within(sheet).getAllByText(/could not be read/).length).toBeGreaterThan(0)
    expect(within(sheet).getByText(/No - no answer was collected, so it is left out rather than counted as not visible/)).toBeTruthy()
    expect(within(sheet).queryByText("Counted as not mentioning your business")).toBeNull()
    unmount()
    h.evidence = { isLoading: false, data: { data: [evidenceItem({ group: "brand_reputation", intent: "brand_reputation", question: "What is ASG Eye Hospital known for?" })], meta: { page: 1, totalPages: 1, total: 1 } } }
    h.evidenceItem = { isLoading: false, data: { data: evidenceItem({ group: "brand_reputation", intent: "brand_reputation", answer: "ASG Eye Hospital is known for LASIK.", citations: [] }) } }
    render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun() }))
    expect(screen.getByText("Brand diagnostic")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /Open the answer for/ }))
    sheet = screen.getByRole("dialog")
    expect(within(sheet).getByText(/No - this question names your business \(brand diagnostic\)/)).toBeTruthy()
  })

  test("evidence API errors in the sheet are shown (404 vs other)", () => {
    h.evidence = { isLoading: false, data: { data: [evidenceItem()], meta: { page: 1, totalPages: 1, total: 1 } } }
    h.evidenceItem = { isLoading: false, error: apiError(404, "x"), data: undefined }
    render(createElement(ApprovedRunResults, { projectId: "p1", run: approvedRun() }))
    fireEvent.click(screen.getByRole("button", { name: /Open the answer for/ }))
    expect(within(screen.getByRole("dialog")).getByText("This evidence is not available.")).toBeTruthy()
  })

  test("most-cited pages: distinct pages with occurrences vs questions; clicking one filters the answers", () => {
    h.cited = { isLoading: false, data: { data: { pages: [{ url: "https://asgeye.example/lasik", title: "LASIK", occurrences: 3, questionCount: 2, runCount: 1, lastCitedAt: "2026-10-24T10:00:00Z" }] } } }
    const onSelectPage = vi.fn()
    render(createElement(MostCitedPages, { projectId: "p1", runId: "r1", onSelectPage }))
    const row = screen.getByRole("button", { name: "Show answers citing https://asgeye.example/lasik" }).closest("tr")
    expect(within(row).getByText("3")).toBeTruthy()
    expect(within(row).getByText("2")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Show answers citing https://asgeye.example/lasik" }))
    expect(onSelectPage).toHaveBeenCalledWith("https://asgeye.example/lasik")
  })

  test("most-cited pages: empty state when no page was cited", () => {
    h.cited = { isLoading: false, data: { data: { pages: [] } } }
    render(createElement(MostCitedPages, { projectId: "p1", runId: "r1" }))
    expect(screen.getByText(/No page of your website was cited in this run/)).toBeTruthy()
  })

  test("the results route chooses the view from the run's mode: approved -> answers & citations, legacy -> the original view", () => {
    h.search = "run=r1"
    h.summary = { isLoading: false, data: { data: { latest: null, active: null } } }
    h.run = { isLoading: false, data: { data: approvedRun() } }
    h.evidence = { isLoading: false, data: { data: [evidenceItem()], meta: { page: 1, totalPages: 1, total: 1 } } }
    const { unmount } = render(createElement(RunResultsRouter))
    expect(screen.getByRole("heading", { name: "Evidence" })).toBeTruthy()
    unmount()
    h.run = { isLoading: false, data: { data: { ...approvedRun(), executionMode: "legacy_prompts", executions: [], target: {} } } }
    render(createElement(RunResultsRouter))
    expect(screen.getByRole("heading", { name: "Prompt results" })).toBeTruthy()
  })
})

// ───────────────────────────── history ─────────────────────────────
describe("historical comparison", () => {
  const hist = (o = {}) => ({ id: "r", status: "completed", executionMode: "approved_questions", questionSetVersion: 2, createdAt: "2026-10-24T10:00:00Z", completedAt: "2026-10-24T10:02:00Z", questionStats: { succeeded: 9, failed: 1, skipped: 0 },
    metrics: { overview: { visibilityScore: 40, mentions: 4, citedPages: 2 }, visibility: { succeeded: 9, attempted: 10, answersRecommendingBrand: 3 }, cost: { knownTotal: 0.1, unit: "provider_reported", knownCount: 9, unknownCostCount: 0 } }, ...o })

  test("score changes are shown only against a run that used the same question-set version", () => {
    const now = hist({ id: "a" })
    expect(render(createElement(ScoreDelta, { now, before: hist({ id: "b", metrics: { overview: { visibilityScore: 30 } } }) })).container.textContent).toBe("+10 pts")
    expect(render(createElement(ScoreDelta, { now, before: hist({ id: "c", questionSetVersion: 1 }) })).container.textContent).toMatch(/v1 → v2, not comparable/)
    expect(render(createElement(ScoreDelta, { now, before: null })).container.textContent).toBe("—")
  })

  test("the approved-run table keeps each run's version, counts answered vs attempted, and the question trend loads lazily", () => {
    h.runs = { data: { data: [hist({ id: "a" }), hist({ id: "b", questionSetVersion: 1, createdAt: "2026-10-20T10:00:00Z", completedAt: "2026-10-20T10:02:00Z" }), { id: "old", executionMode: "legacy_prompts", status: "completed" }] } }
    render(createElement(ApprovedHistoryContent))
    expect(screen.getAllByText("9 of 10").length).toBe(2)
    expect(screen.getByText("v2")).toBeTruthy()
    expect(screen.getByText("v1")).toBeTruthy()
    expect(screen.getByText(/not comparable/)).toBeTruthy()
    expect(screen.getAllByRole("link").length).toBe(2) // the legacy row is not in this table
    expect(screen.getByText("Choose a question…")).toBeTruthy()
  })

  test("question history flags changed wording and shows failures as dashes, never as 'not mentioned'", () => {
    const items = [
      evidenceItem({ runId: "r2", questionSetVersion: 3 }),
      evidenceItem({ runId: "r1", questionSetVersion: 2, status: "failed", analysis: null, firstPartyPages: [] }),
      evidenceItem({ runId: "r0", questionSetVersion: 1, question: "Different wording here for the question?" }),
    ]
    render(createElement(QuestionHistoryTable, { items }))
    expect(screen.getByText(/older results may not be directly comparable/)).toBeTruthy()
    expect(screen.getByText("Different wording")).toBeTruthy()
    const rows = screen.getAllByRole("row").slice(1)
    expect(within(rows[1]).getAllByText("—").length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText(/not the same as "not mentioned"/)).toBeTruthy()
  })

  test("empty history says so", () => {
    render(createElement(QuestionHistoryTable, { items: [] }))
    expect(screen.getByText(/no stored results yet/)).toBeTruthy()
  })
})
