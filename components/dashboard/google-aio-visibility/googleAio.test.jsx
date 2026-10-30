import "@testing-library/jest-dom/vitest"
import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"

const h = vi.hoisted(() => ({
  project: { _id: "p1" },
  summary: null, approved: null, profile: null, run: null, live: null, runs: null, evidence: null, evidenceItem: null, history: null, selection: null,
  cancel: { mutate: vi.fn(), isPending: false, error: null },
  start: { mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() },
}))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: h.project }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(""), useParams: () => ({}) }))
vi.mock("@/hooks/useAiVisibilityQuestions", () => ({ useApprovedQuestionSet: () => h.approved, useBusinessProfile: () => h.profile }))
vi.mock("@/hooks/useGoogleAioVisibility", () => ({
  useGoogleAioSummary: () => h.summary, useGoogleAioRun: () => h.run, useCancelGoogleAioRun: () => h.cancel, useGoogleAioLiveProgress: () => h.live,
  useStartGoogleAioRun: () => h.start, useGoogleAioRuns: () => h.runs, useRunEvidence: () => h.evidence, useEvidenceItem: () => h.evidenceItem,
  useQuestionHistory: () => h.history, useQuestionSelection: () => h.selection,
}))
vi.mock("../shared/profile/ProfileDialog", () => ({ default: () => null }))

import GoogleAioDashboard from "./GoogleAioDashboard"
import HistoryContent from "./HistoryContent"
import ResultsContent from "./ResultsContent"
import EvidenceBody from "./EvidenceBody"
import RunDialog from "./RunDialog"
import LiveRunProgress, { progressNumbers } from "./LiveRunProgress"
import { safeHref, pct, basis, describeStartError } from "./format"
import { sidebarSections as SIDEBAR_GROUPS } from "../../sidebar/sidebar-config"

const rate = (count, denominator) => ({ count, denominator, rate: denominator ? Math.round((count / denominator) * 10000) / 10000 : null })
const overview = (o = {}) => ({
  runId: "r1", status: "completed", completedAt: "2026-10-28T10:30:00Z", questionSetVersion: 2, questionsPlanned: 5, questionsAnswered: 5, questionsFailed: 0, questionsSkipped: 0, partial: false,
  location: { name: "Nashik,Maharashtra,India", device: "desktop", languageCode: "en" },
  aiOverview: rate(4, 5), brandMention: { ...rate(2, 4), ambiguous: 0 }, websiteCitation: { ...rate(1, 3), excluded: 1 },
  uniqueCitedPages: { count: 2, pages: ["https://a.example/1", "https://a.example/2"], citationOccurrences: 3 },
  competitors: [{ name: "Sankara Eye Care", mentions: rate(2, 4), citations: rate(1, 3) }], cost: { amount: 0.056, unit: "USD", unknownCount: 0 }, limitations: [], sampled: true, ...o,
})
const evidenceRows = [
  { questionId: "q1", position: 1, question: "Which eye hospitals in Nashik offer LASIK?", intent: "discovery", observation: "ai_overview", brandMentioned: true, websiteCited: true, referencesStatus: "available" },
  { questionId: "q2", position: 2, question: "Where can patients in Nashik treat glaucoma?", intent: "local_discovery", observation: "no_ai_overview", brandMentioned: null, websiteCited: null, referencesStatus: null },
  { questionId: "q3", position: 3, question: "Which hospitals in Nashik offer cataract surgery?", intent: "discovery", observation: "request_failed", brandMentioned: null, websiteCited: null, referencesStatus: null },
]
beforeEach(() => {
  h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: null } } }
  h.approved = { isLoading: false, data: { data: { id: "s2", version: 2, status: "approved" } } }
  h.profile = { isLoading: false, data: { data: { completeness: { conflicts: [], ready: true } } } }
  h.run = { isLoading: false, data: { data: { id: "r1", status: "completed" } } }
  h.live = null
  h.runs = { isLoading: false, data: { data: [], meta: { totalPages: 1 } } }
  h.evidence = { isLoading: false, data: { data: evidenceRows } }
  h.evidenceItem = { isLoading: false, data: null }
  h.history = { isLoading: false, data: { data: [] } }
  h.selection = { isLoading: false, data: { data: { ready: true, questions: [1, 2, 3, 4, 5].map((n) => ({ position: n, questionId: `q${n}`, question: `Question number ${n} in Nashik?`, intent: "discovery" })), questionSetVersion: 2, location: { code: 1007740, name: "Nashik,Maharashtra,India" }, languageCode: "en", device: "desktop", problem: null } } }
  h.start.mutate.mockReset()
})

describe("overview page", () => {
  test("no run yet: proper empty state, no fabricated zero figures", () => {
    render(<GoogleAioDashboard />)
    expect(screen.getByRole("heading", { name: "Google AI Overview Visibility" })).toBeInTheDocument()
    expect(screen.getByText("No Google AI Overview run yet")).toBeInTheDocument()
    expect(screen.queryByText("AI Overview appearance")).toBeNull()
    expect(screen.queryByText("0%")).toBeNull()
  })

  test("a finished run shows the five figures computed by the server, with their denominators", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview() } } }
    render(<GoogleAioDashboard />)
    expect(screen.getAllByText("AI Overview appearance")[0]).toBeInTheDocument()
    expect(screen.getByText("80%")).toBeInTheDocument()
    expect(screen.getByText("4 of 5 questions")).toBeInTheDocument()
    expect(screen.getAllByText("Brand mention rate")[0]).toBeInTheDocument()
    expect(screen.getByText("2 of 4 overviews")).toBeInTheDocument()
    expect(screen.getAllByText("Website citation rate")[0]).toBeInTheDocument()
    expect(screen.getByText("33%")).toBeInTheDocument()
    expect(screen.getByText("1 of 3 overviews with sources")).toBeInTheDocument()
    expect(screen.getAllByText("Unique cited pages")[0]).toBeInTheDocument()
    expect(screen.getAllByText("Unique cited pages")[0].parentElement).toHaveTextContent("2")
    expect(screen.getAllByText("Questions processed")[0]).toBeInTheDocument()
    expect(screen.getByText("5/5")).toBeInTheDocument()
    expect(screen.getByText("5 searched")).toBeInTheDocument()
    expect(screen.getByText("What these numbers mean")).toBeInTheDocument()
    expect(screen.getByText("Competitor visibility")).toBeInTheDocument()
  })

  test("a partial run says how many questions were searched and never calls failures 'no AI Overview'", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview({ status: "partial", partial: true, questionsAnswered: 4, questionsFailed: 1 }) } } }
    render(<GoogleAioDashboard />)
    expect(screen.getByText("5/5")).toBeInTheDocument() // 4 searched + 1 failed: all five settled
    expect(screen.getByText("4 searched · 1 failed")).toBeInTheDocument()
    expect(screen.getByText(/4 of 5 questions were searched \(1 failed\)/)).toBeInTheDocument()
  })

  test("the page carries no ChatGPT label or link", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview() } } }
    const { container } = render(<GoogleAioDashboard />)
    expect(container.textContent).not.toMatch(/chatgpt/i)
    expect(container.innerHTML).not.toMatch(/chatgpt/i)
  })

  test("the run button is disabled without an approved set and while a run is active", () => {
    h.approved = { isLoading: false, data: { data: null } }
    const { rerender } = render(<GoogleAioDashboard />)
    expect(screen.getByRole("button", { name: "Run 5 questions" })).toBeDisabled()
    h.approved = { isLoading: false, data: { data: { id: "s2", version: 2 } } }
    h.summary = { isLoading: false, data: { data: { latest: null, active: { id: "r2", status: "running", progress: { completed: 1, total: 5 }, questionStats: { succeeded: 1, failed: 0, skipped: 0 } }, overview: null } } }
    rerender(<GoogleAioDashboard />)
    expect(screen.getByRole("button", { name: "Run in progress" })).toBeDisabled()
    expect(screen.getByText("· 1/5 questions")).toBeInTheDocument()
  })

  test("the question table distinguishes an absent AI Overview from a failed request", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview() } } }
    render(<GoogleAioDashboard />)
    expect(screen.getByText("AI Overview shown")).toBeInTheDocument()
    expect(screen.getByText("No AI Overview")).toBeInTheDocument()
    expect(screen.getByText("Request failed")).toBeInTheDocument()
  })
})

describe("statuses are distinct and explained", () => {
  const rows = [
    { questionId: "q1", position: 1, question: "Q one?", intent: "discovery", observation: "ai_overview", brandMentioned: false, websiteCited: true, referencesStatus: "available" },
    { questionId: "q2", position: 2, question: "Q two?", intent: "discovery", observation: "request_failed", errorCode: "GOOGLE_AIO_SEARCH_ENGINE_ERROR" },
    { questionId: "q3", position: 3, question: "Q three?", intent: "discovery", observation: "no_ai_overview" },
    { questionId: "q4", position: 4, question: "Q four?", intent: "discovery", observation: "not_sent", errorCode: "NOT_SENT_PROVIDER_ACCOUNT_ERROR", skipCause: "GOOGLE_AIO_AUTH_FAILED" },
    { questionId: "q5", position: 5, question: "Q five?", intent: "discovery", observation: "cancelled", errorCode: "RUN_CANCELLED" },
  ]
  test("failed, not-sent and cancelled questions each show their own reason; found / absent show none", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview({ status: "partial", partial: true, questionsAnswered: 2, questionsFailed: 1, questionsSkipped: 1, questionsCancelled: 1 }) } } }
    h.evidence = { isLoading: false, data: { data: rows } }
    render(<GoogleAioDashboard />)
    expect(screen.getByText("AI Overview shown")).toBeInTheDocument()
    expect(screen.getByText("No AI Overview")).toBeInTheDocument()
    expect(screen.getByText("Request failed")).toBeInTheDocument()
    expect(screen.getByText("Not sent")).toBeInTheDocument()
    expect(screen.getByText("Cancelled")).toBeInTheDocument()
    expect(screen.getByText(/not a credentials problem/)).toBeInTheDocument() // 40101 is explained, not shown as an auth error
    expect(screen.getByText(/remaining searches were stopped.*provider rejected the server credentials/)).toBeInTheDocument()
    expect(screen.getByText("Cancelled before this question was sent.")).toBeInTheDocument()
    // processed = 2 searched + 1 failed + 1 not sent + 1 cancelled = 5/5, spelled out
    expect(screen.getByText("5/5")).toBeInTheDocument()
    expect(screen.getByText("2 searched · 1 failed · 1 not sent · 1 cancelled")).toBeInTheDocument()
  })
  test("processed is below 5/5 while any question has not settled", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview({ status: "partial", partial: true, questionsAnswered: 3, questionsFailed: 0, questionsSkipped: 0 }) } } }
    render(<GoogleAioDashboard />)
    expect(screen.getByText("3/5")).toBeInTheDocument()
  })
  test("evidence of a failed question shows the provider diagnostics, never credentials", () => {
    const e = { questionSetVersion: 2, question: "Q two?", intent: "discovery", location: { name: "Nashik,Maharashtra,India" }, language: "en", device: "desktop", status: "failed", observation: "request_failed", aiOverviewPresent: null, errorCode: "GOOGLE_AIO_SEARCH_ENGINE_ERROR", retryable: true, attempts: 2, durationMs: 17800,
      diagnostics: { httpStatus: null, providerCode: 40101, providerMessage: "Internal SE server error.", taskIdReturned: true, attempts: [{ attempt: 1, durationMs: 9000 }, { attempt: 2, durationMs: 8800 }] } }
    const { container } = render(<EvidenceBody e={e} />)
    expect(screen.getByText("The search request failed.")).toBeInTheDocument()
    expect(screen.getByText("Provider diagnostics")).toBeInTheDocument()
    expect(screen.getByText("40101")).toBeInTheDocument()
    expect(screen.getByText("Internal SE server error.")).toBeInTheDocument()
    expect(screen.getByText("none (no HTTP response)")).toBeInTheDocument()
    expect(screen.getByText("2 (9000 ms, 8800 ms)")).toBeInTheDocument()
    expect(container.textContent.toLowerCase()).not.toMatch(/authorization|password|basic /)
  })
  test("evidence of a not-sent question explains why and names the earlier provider error", () => {
    render(<EvidenceBody e={{ questionSetVersion: 2, question: "Q four?", status: "skipped", observation: "not_sent", errorCode: "NOT_SENT_PROVIDER_ACCOUNT_ERROR", skipCause: "GOOGLE_AIO_AUTH_FAILED", location: {}, device: "desktop" }} />)
    expect(screen.getByText("This question was never sent.")).toBeInTheDocument()
    expect(screen.getByText(/remaining searches were stopped/)).toBeInTheDocument()
  })
})

describe("progress 1/5 -> 5/5", () => {
  const active = (completed) => ({ id: "r2", status: "running", progress: { completed, total: 5 }, questionStats: { total: 5, succeeded: completed, failed: 0, skipped: 0 } })
  test.each([0, 1, 2, 3, 4])("shows %i/5 and which question is being searched", (done) => {
    const live = { runId: "r2", completed: done, total: 5, current: done + 1, succeeded: done, failed: 0, skipped: 0 }
    const { unmount } = render(<LiveRunProgress active={active(done)} live={live} onCancel={() => {}} />)
    expect(screen.getByText(`· ${done}/5 questions`)).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(`Searching question ${done + 1} of 5`)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(Math.round((done / 5) * 100)))
    unmount()
  })
  test("live counters of ANOTHER run are ignored, and completion never exceeds the total", () => {
    const n = progressNumbers(active(2), { runId: "other", completed: 5, total: 5, current: 5 })
    expect(n.completed).toBe(2)
    expect(progressNumbers({ id: "r", progress: { completed: 9, total: 5 } }, null).completed).toBe(5)
  })
  test("a finished run renders no progress panel", () => {
    const { container } = render(<LiveRunProgress active={{ id: "r2", status: "completed" }} live={null} onCancel={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("evidence", () => {
  const base = { questionSetVersion: 2, question: "Which eye hospitals in Nashik offer LASIK?", intent: "discovery", location: { name: "Nashik,Maharashtra,India" }, language: "en", device: "desktop", retrievedAt: "2026-10-28T10:15:30Z", status: "succeeded", observation: "ai_overview", aiOverviewPresent: true, brandMentioned: true, mentionStatus: "mentioned", websiteCited: true, referencesStatus: "available", referenceCount: 2, competitors: [], cost: 0.0112, costUnit: "USD" }

  test("shows the captured overview, the exact question and clickable http(s) sources", () => {
    render(<EvidenceBody e={{ ...base, overview: { text: "ASG Eye Hospital offers LASIK in Nashik." }, references: [{ url: "https://asgeye.example/lasik", host: "asgeye.example", title: "LASIK", isOwned: true }, { url: "https://practo.example/x", host: "practo.example", title: "Practo", isOwned: false }], rejectedReferences: 0 }} />)
    expect(screen.getByText("Which eye hospitals in Nashik offer LASIK?")).toBeInTheDocument()
    expect(screen.getByText("ASG Eye Hospital offers LASIK in Nashik.")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: /LASIK/ })
    expect(link).toHaveAttribute("href", "https://asgeye.example/lasik")
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(screen.getByText("Your site")).toBeInTheDocument()
  })

  test("untrusted overview text is rendered as text, and non-http(s) references never become links", () => {
    const evil = "<img src=x onerror=alert(1)><script>alert(1)</script>"
    const { container } = render(<EvidenceBody e={{ ...base, overview: { text: evil }, references: [{ url: "javascript:alert(1)", host: null, title: "bad", isOwned: false }], rejectedReferences: 0 }} />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("script")).toBeNull()
    expect(container.textContent).toContain(evil)
    expect(screen.queryByRole("link")).toBeNull()
  })

  test("an absent AI Overview is explained as a successful search, not an error", () => {
    render(<EvidenceBody e={{ ...base, observation: "no_ai_overview", aiOverviewPresent: false, brandMentioned: null, websiteCited: null }} />)
    expect(screen.getByText("Google showed no AI Overview for this search.")).toBeInTheDocument()
    expect(screen.getByText(/The request worked/)).toBeInTheDocument()
    expect(screen.queryByText("The search request failed.")).toBeNull()
  })

  test("a failed request shows the reason and is not described as 'no AI Overview'", () => {
    render(<EvidenceBody e={{ ...base, status: "failed", observation: "request_failed", aiOverviewPresent: null, errorCode: "GOOGLE_AIO_TIMEOUT", retryable: true }} />)
    expect(screen.getByText("The search request failed.")).toBeInTheDocument()
    expect(screen.getByText("The request timed out.")).toBeInTheDocument()
    expect(screen.getByText(/left out of the percentages/)).toBeInTheDocument()
    expect(screen.queryByText("Google showed no AI Overview for this search.")).toBeNull()
  })

  test("an overview without source links says citations could not be checked", () => {
    render(<EvidenceBody e={{ ...base, referencesStatus: "unavailable", websiteCited: null, referenceCount: 0, overview: { text: "ASG Eye Hospital offers LASIK." }, references: [] }} />)
    expect(screen.getByText(/without readable source links/)).toBeInTheDocument()
    expect(screen.getByText("No source links returned")).toBeInTheDocument()
  })
})

describe("answers & citations and routes", () => {
  test("results page lists the five-question run and loads evidence lazily", () => {
    h.summary = { isLoading: false, data: { data: { latest: null, active: null, overview: overview() } } }
    render(<ResultsContent />)
    expect(screen.getByRole("heading", { name: "Answers & citations" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Show" })).toHaveLength(3)
    expect(screen.getByText("Request failed")).toBeInTheDocument()
  })
  test("results page without any run has an empty state", () => {
    render(<ResultsContent />)
    expect(screen.getByText("No results yet")).toBeInTheDocument()
  })
  test("every route module compiles and exports a page", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:5000/api") // the real API client (used by the unmocked question-set screens) refuses to load without it
    const mods = await Promise.all([
      import("../../../app/app/google-ai-overview/page.jsx"),
      import("../../../app/app/google-ai-overview/questions/page.jsx"),
      import("../../../app/app/google-ai-overview/questions/[setId]/page.jsx"),
      import("../../../app/app/google-ai-overview/results/page.jsx"),
      import("../../../app/app/google-ai-overview/history/page.jsx"),
    ])
    for (const mod of mods) expect(typeof mod.default).toBe("function")
  })
})

describe("history", () => {
  test("lists the Google runs with their processed counts, status and reasons", () => {
    h.runs = { isLoading: false, data: { data: [
      { id: "r1", status: "completed", createdAt: "2026-10-28T10:00:00Z", questionSetVersion: 2, location: { name: "Nashik,Maharashtra,India", device: "desktop" }, questionStats: { succeeded: 5, failed: 0 }, progress: { total: 5 }, metrics: { aiOverview: { rate: 0.8 }, brandMention: { rate: 0.5 }, websiteCitation: { rate: 0.33 }, uniqueCitedPages: { count: 2 } }, totalCost: { amount: 0.056, unit: "USD", unknownCount: 0 } },
      { id: "r0", status: "failed", failureCode: "GOOGLE_AIO_AUTH_FAILED", createdAt: "2026-10-27T10:00:00Z", questionSetVersion: 2, location: { name: "Nashik,Maharashtra,India", device: "mobile" }, questionStats: { succeeded: 0, failed: 1 }, progress: { total: 5 }, metrics: null, totalCost: null },
    ], meta: { totalPages: 1 } } }
    render(<HistoryContent />)
    const rows = screen.getAllByRole("row")
    expect(within(rows[1]).getByText("80%")).toBeInTheDocument()
    expect(within(rows[1]).getByText("5/5")).toBeInTheDocument()
    expect(within(rows[2]).getByText("The data provider rejected the server credentials.")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Evidence" })[0]).toHaveAttribute("href", "/app/google-ai-overview/results?runId=r1")
  })
  test("empty history has an empty state", () => {
    render(<HistoryContent />)
    expect(screen.getByText("No runs yet")).toBeInTheDocument()
  })
})

describe("run dialog", () => {
  test("shows exactly five questions and the verified location; starts with only the device", () => {
    render(<RunDialog open onOpenChange={() => {}} projectId="p1" active={null} />)
    expect(screen.getAllByText(/Question number \d in Nashik\?/)).toHaveLength(5)
    expect(screen.getByText("Nashik,Maharashtra,India")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Run 5 questions" }))
    expect(h.start.mutate).toHaveBeenCalledTimes(1)
    expect(h.start.mutate.mock.calls[0][0]).toEqual({ device: "desktop" })
  })
  test("cannot start when the server says the selection is not ready (e.g. city not found)", () => {
    h.selection = { isLoading: false, data: { data: { ready: false, questions: [], problem: { code: "LOCATION_NOT_FOUND" } } } }
    render(<RunDialog open onOpenChange={() => {}} projectId="p1" active={null} />)
    expect(screen.getByRole("button", { name: "Run 5 questions" })).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(/will not search another place/)
  })
  test("a location problem offers a way to edit the profile (country / state / city)", () => {
    h.selection = { isLoading: false, data: { data: { ready: false, questions: [], problem: { code: "LOCATION_COUNTRY_MISSING" } } } }
    const onEdit = vi.fn()
    render(<RunDialog open onOpenChange={() => {}} projectId="p1" active={null} onEditProfile={onEdit} />)
    fireEvent.click(screen.getByRole("button", { name: /Edit business profile/ }))
    expect(onEdit).toHaveBeenCalled()
  })
  test("cannot start with fewer than five questions", () => {
    h.selection = { isLoading: false, data: { data: { ready: true, questions: [{ position: 1, questionId: "q1", question: "Only one question here?", intent: "discovery" }], problem: null } } }
    render(<RunDialog open onOpenChange={() => {}} projectId="p1" active={null} />)
    expect(screen.getByRole("button", { name: "Run 5 questions" })).toBeDisabled()
  })
})

describe("helpers and navigation", () => {
  test("safeHref only allows http(s)", () => {
    expect(safeHref("https://a.example")).toBe("https://a.example")
    expect(safeHref("http://a.example")).toBe("http://a.example")
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//a.example", "ftp://a", null, undefined]) expect(safeHref(bad)).toBeNull()
  })
  test("unknown is an en dash, not zero", () => {
    expect(pct(null)).toBe("—")
    expect(pct(0)).toBe("0%")
    expect(basis({ count: 0, denominator: 0 }, "overviews")).toBe("No overviews to measure yet")
  })
  test("start errors are explained in plain language", () => {
    expect(describeStartError({ status: 422, details: { code: "NOT_ENOUGH_QUESTIONS" } })).toMatch(/fewer than five/)
    expect(describeStartError({ status: 409 })).toMatch(/already in progress/)
  })
  test("the sidebar group is Google AI Overview and nothing in the sidebar links to ChatGPT Visibility", () => {
    const labels = SIDEBAR_GROUPS.map((g) => g.label)
    expect(labels).toContain("Google AI Overview")
    expect(labels).not.toContain("ChatGPT Visibility")
    const group = SIDEBAR_GROUPS.find((g) => g.id === "google-ai-overview")
    expect(group.items.map((i) => i.href)).toEqual(["/app/google-ai-overview", "/app/google-ai-overview/questions", "/app/google-ai-overview/results", "/app/google-ai-overview/history"])
    expect(JSON.stringify(SIDEBAR_GROUPS)).not.toMatch(/chatgpt-visibility/)
  })
})
