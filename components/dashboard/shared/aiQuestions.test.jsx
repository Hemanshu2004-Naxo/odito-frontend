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

import QuestionSetsContent from "./questions/QuestionSetsContent"
import QuestionSetDetailContent from "./questions/QuestionSetDetailContent"
import ListField from "./questions/ListField"
import { validateEntry } from "./questions/inputs"
import { describeQuestionError } from "./format"

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
    expect(screen.getByRole("link", { name: "Version 3" }).getAttribute("href")).toBe("/app/google-ai-overview/questions/s3")
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
    expect(screen.getByRole("link", { name: /Go to the overview to run/ }).getAttribute("href")).toBe("/app/google-ai-overview")
  })

  test("an archived set is read-only and cannot be run", () => {
    h.set.data.data = set({ status: "archived" })
    render(createElement(QuestionSetDetailContent))
    expect(screen.queryAllByRole("switch").length).toBe(0)
    expect(screen.queryByRole("link", { name: /Go to the overview to run/ })).toBeNull()
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

