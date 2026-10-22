import { vi, describe, test, expect, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueDetailView from "./IssueDetailView"
import apiService from "@/lib/apiService"
import { completedInvestigation, investigationResult, primeInvestigation, legacyGenerateButton, investigateButton, runInvestigation } from "@/test-utils/investigationKit"

/**
 * The unified AI action of the On-Page issue screen: ONE button, "Investigate & Recommend", backed by the investigation engine.
 * Real IssueDetailView / IssueRecommendationPanel / InvestigationPanel / useInvestigation; only the network layer (apiService) is mocked.
 */

const PROJECT = { _id: "project-1", project_name: "Acme Site", main_url: "https://example.com" }
const PAGE_A = "https://example.com/about"
const PAGE_B = "https://example.com/services"

vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "project-1", project_name: "Acme Site", main_url: "https://example.com" } }) }))
vi.mock("@/lib/socketService", () => ({
  default: { onTaskImplemented: vi.fn(), onTaskVerified: vi.fn(), onTaskReopened: vi.fn(), offTaskImplemented: vi.fn(), offTaskVerified: vi.fn(), offTaskReopened: vi.fn(), joinProject: vi.fn() },
}))
vi.mock("@/components/recommendations/RecommendationCodeBlock", () => ({ default: () => null }))
vi.mock("@/components/recommendations/RecommendationDiffViewer", () => ({ default: () => null }))
vi.mock("@/components/recommendations/RecommendationLoadingState", () => ({ default: () => <div data-testid="legacy-loading" /> }))
vi.mock("@/components/issue-context/CurrentStateRenderer", () => ({ default: () => null }))
vi.mock("@/components/diy/DIYRenderer", () => ({ default: ({ recommendation }) => <div data-testid="diy-renderer">{recommendation?.id}</div> }))
vi.mock("@/hooks/useDashboardQueries", () => ({
  useIssueUrls: () => ({ data: null, isLoading: false }),
  useActiveTaskUrls: () => ({ data: { data: { taskMap: {}, fixedUrls: [], fixedCount: 0 } } }),
  useWordPressCapabilities: () => ({ data: { data: { connected: false } } }),
  useWordPressSiteSchema: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useWordPressPageResolution: () => ({ data: undefined, isLoading: false, isError: false }),
  useWordPressH1Context: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useWordPressSeoData: () => ({ data: undefined, isLoading: false, isError: false }),
  useLinkTaskRecommendation: () => ({ mutate: vi.fn(), isPending: false }),
  useRecommendationById: () => ({ data: null, isLoading: false }),
}))
vi.mock("@/lib/apiService", () => ({
  default: {
    getIssueContext: vi.fn().mockResolvedValue({ success: true, data: null }),
    request: vi.fn(), createTask: vi.fn(), updateTaskStatus: vi.fn(), applyWordPressFix: vi.fn(), linkTaskRecommendation: vi.fn(), getRecommendationById: vi.fn(),
    startInvestigation: vi.fn(), getInvestigation: vi.fn(), cancelInvestigation: vi.fn(), prepareInvestigationFix: vi.fn(), approveInvestigation: vi.fn(), verifyInvestigation: vi.fn(),
  },
}))

const ISSUE = { issue_code: "missing_h1", title: "H1 missing", pages: 2, affected_urls: [PAGE_A, PAGE_B], category: "On-Page Issues", severity: "high" }
const legacyCalls = () => apiService.request.mock.calls.filter(([e]) => String(e).includes("/recommendations/generate"))
const tab = (name) => screen.getByRole("button", { name })

function renderView(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueDetailView issue={ISSUE} onBack={() => {}} initialSelUrl={PAGE_A} {...props} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiService.getIssueContext.mockResolvedValue({ success: true, data: null })
  apiService.request.mockImplementation(async (endpoint) => {
    if (String(endpoint).includes("/recommendations/generate")) return { success: true, data: { id: "rec-legacy-1", ruleId: "missing_h1", sections: {} }, meta: {} }
    if (String(endpoint).startsWith("/auditiq/")) return { success: true, data: { requests: { express_fix: null, technical_audit_fix: null, expert_fix: null }, services: {} } }
    return { success: true, data: null }
  })
})

describe("one primary AI action", () => {
  test("only ONE AI action is rendered: 'Investigate & Recommend' with its supporting text; no legacy generate button, no second card", async () => {
    renderView()
    const primary = await screen.findByRole("button", { name: /Investigate & Recommend/ })
    await waitFor(() => expect(primary).toBeVisible())
    expect(screen.getAllByRole("button", { name: /Investigate|Generate/ })).toHaveLength(1)
    expect(legacyGenerateButton()).not.toBeInTheDocument()
    expect(screen.queryByText("Investigate this page")).not.toBeInTheDocument()
    expect(screen.queryByText("Investigate with AI")).not.toBeInTheDocument()
    expect(screen.queryByText(/Generates a context-aware remediation strategy/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Nothing is changed on your website/)).not.toBeInTheDocument()
    expect(screen.getAllByText("Analyze the affected page, identify the root cause, and recommend the safest fix.")).toHaveLength(1)
    expect(screen.getByText("Selected URL")).toBeInTheDocument()
    expect(screen.getAllByText(PAGE_A).length).toBeGreaterThan(0)
    expect(screen.getByTestId("investigation-panel").children.length).toBe(2) // the button + its hint: no empty containers
  })

  test("clicking it starts the investigation endpoint for THIS project/issue/page and never calls the legacy recommendation endpoint", async () => {
    renderView()
    await runInvestigation(apiService)
    expect(apiService.startInvestigation).toHaveBeenCalledTimes(1)
    expect(apiService.startInvestigation).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-1", issueId: "missing_h1", pageUrl: PAGE_A, issueSource: "on_page" }))
    expect(legacyCalls()).toHaveLength(0)
    expect(apiService.request).not.toHaveBeenCalledWith(expect.stringContaining("/recommendations/generate"), expect.anything())
  })

  test("repeated clicks send ONE request", async () => {
    primeInvestigation(apiService)
    renderView()
    const btn = await screen.findByRole("button", { name: /Investigate & Recommend/ })
    fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn)
    await screen.findByTestId("investigation-result")
    expect(apiService.startInvestigation).toHaveBeenCalledTimes(1)
  })
})

describe("states", () => {
  test("running: the same button becomes 'Investigating page...' (disabled, one spinner row of progress, no second loading UI)", async () => {
    let resolve
    apiService.startInvestigation.mockImplementation(() => new Promise((r) => { resolve = r }))
    renderView()
    fireEvent.click(await screen.findByRole("button", { name: /Investigate & Recommend/ }))
    const busy = await screen.findByRole("button", { name: /Investigating page/ })
    expect(busy).toBeDisabled()
    expect(screen.queryByTestId("legacy-loading")).not.toBeInTheDocument()
    expect(screen.queryByText("Starting…")).not.toBeInTheDocument()
    expect(screen.queryByTestId("investigation-hint")).not.toBeInTheDocument()
    const running = completedInvestigation({ status: "running", stage: "gather_evidence", result: null, progress: [{ stage: "gather_evidence", status: "running" }] })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: running })
    resolve({ success: true, data: running })
    expect(await screen.findByTestId("investigation-progress")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Investigating page/ })).toBeDisabled()
  })

  test("completed: findings, root cause, recommended solution and supporting evidence are shown; the primary start button is gone", async () => {
    renderView()
    await runInvestigation(apiService, {}, { summary: "The H1 is missing from the template.", rootCause: { category: "shared_template", description: "The theme header has no H1.", symptomVersusCause: null }, recommendedSolution: { method: "manual_code_change", strategy: "Add one H1 to the page template.", rationale: null } })
    expect(screen.getByTestId("investigation-summary")).toHaveTextContent("H1 is missing")
    expect(screen.getByTestId("investigation-findings")).toHaveTextContent("The issue is present on the live page.")
    expect(screen.getByTestId("investigation-root-cause")).toHaveTextContent("theme header has no H1")
    expect(screen.getByTestId("investigation-solution")).toHaveTextContent("Add one H1 to the page template.")
    fireEvent.click(screen.getByTestId("investigation-evidence-toggle"))
    expect(within(screen.getByTestId("investigation-evidence")).getByText("Live page")).toBeInTheDocument()
    expect(investigateButton()).not.toBeInTheDocument()
    expect(screen.getByTestId("investigation-rerun")).toHaveTextContent("Investigate again")
  })

  test("completed does NOT mean applied or verified: lifecycle shows neither, there is no 'Verified Fixed', and Create Task is just a task", async () => {
    renderView()
    await runInvestigation(apiService)
    expect(screen.getByTestId("lifecycle-applied")).toHaveAttribute("data-done", "false")
    expect(screen.getByTestId("lifecycle-verified")).toHaveAttribute("data-done", "false")
    expect(screen.queryByText(/Verified Fixed/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Implemented — Pending Verification/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Re-fetch the page and re-run the check/)).not.toBeInTheDocument()
    expect(apiService.applyWordPressFix).not.toHaveBeenCalled()
    expect(apiService.verifyInvestigation).not.toHaveBeenCalled()
  })

  test("blocked / insufficient evidence: the limitation is explained and a retry is offered", async () => {
    renderView()
    await runInvestigation(apiService, {}, { investigationStatus: "blocked", issueStatus: "uncertain", confidence: { score: 0, label: "low" }, evidence: [], findings: [], limitations: ["The page could not be inspected"], lifecycle: { recommendationGenerated: true, fixProposed: false, fixApplied: false, fixVerified: false, verificationStatus: "not_started" } })
    expect(screen.getAllByTestId("investigation-notice")[0]).toHaveTextContent("could not be inspected")
    expect(screen.getByTestId("investigation-limitations")).toHaveTextContent("The page could not be inspected")
    apiService.startInvestigation.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Retry investigation" }))
    await waitFor(() => expect(apiService.startInvestigation).toHaveBeenCalledTimes(1))
  })

  test("failed: a useful error and a Retry that starts a new investigation", async () => {
    apiService.startInvestigation.mockResolvedValueOnce({ success: true, data: completedInvestigation({ status: "failed", result: null, error: { code: "INVESTIGATION_TIMEOUT", message: "x" } }) })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: completedInvestigation({ status: "failed", result: null, error: { code: "INVESTIGATION_TIMEOUT", message: "x" } }) })
    renderView()
    fireEvent.click(await screen.findByRole("button", { name: /Investigate & Recommend/ }))
    expect(await screen.findByTestId("investigation-error")).toHaveTextContent("took too long")
    const retry = screen.getByRole("button", { name: "Retry" })
    primeInvestigation(apiService)
    fireEvent.click(retry)
    await screen.findByTestId("investigation-result")
    expect(apiService.startInvestigation).toHaveBeenCalledTimes(2)
  })

  test("a rejected start (e.g. out of scope) is shown with its specific message", async () => {
    apiService.startInvestigation.mockRejectedValue(Object.assign(new Error("x"), { code: "OUT_OF_SCOPE" }))
    renderView()
    fireEvent.click(await screen.findByRole("button", { name: /Investigate & Recommend/ }))
    expect(await screen.findByTestId("investigation-error")).toHaveTextContent("not part of the project's website")
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled()
  })
})

describe("selection safety", () => {
  test("switching URLs never shows the previous URL's result (or a late response for it) under the new selection", async () => {
    let resolveA
    apiService.startInvestigation.mockImplementation(() => new Promise((r) => { resolveA = r }))
    renderView()
    fireEvent.click(await screen.findByRole("button", { name: /Investigate & Recommend/ }))
    await screen.findByRole("button", { name: /Investigating page/ })
    fireEvent.click(screen.getByText(PAGE_B)) // select another affected URL while A is still running
    const idleB = await screen.findByRole("button", { name: /Investigate & Recommend/ })
    expect(idleB).toBeEnabled()
    // A's response arrives late
    const dataA = completedInvestigation({ pageUrl: PAGE_A }, { summary: "RESULT FOR PAGE A" })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: dataA })
    resolveA({ success: true, data: dataA })
    await new Promise((r) => setTimeout(r, 80))
    expect(screen.queryByText("RESULT FOR PAGE A")).not.toBeInTheDocument()
    expect(screen.queryByTestId("investigation-result")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Investigate & Recommend/ })).toBeEnabled()
    expect(apiService.getInvestigation).not.toHaveBeenCalled()
  })

  test("a finished result stays with its own URL: B shows its own idle state, A's result is not carried over", async () => {
    renderView()
    await runInvestigation(apiService, {}, { summary: "RESULT FOR PAGE A" })
    expect(screen.getByTestId("investigation-summary")).toHaveTextContent("RESULT FOR PAGE A")
    fireEvent.click(screen.getByText(PAGE_B))
    expect(await screen.findByRole("button", { name: /Investigate & Recommend/ })).toBeInTheDocument()
    expect(screen.queryByText("RESULT FOR PAGE A")).not.toBeInTheDocument()
  })
})

describe("other tabs and compatibility", () => {
  test("DIY Guide and AuditIQ remain available; DIY explains what to do first and offers no legacy generate button", async () => {
    renderView()
    await screen.findByRole("button", { name: /Investigate & Recommend/ })
    fireEvent.click(tab(/DIY Guide/))
    expect(await screen.findByText(/Run Investigate & Recommend first to unlock the DIY guide/)).toBeVisible()
    expect(legacyGenerateButton()).not.toBeInTheDocument()
    expect(legacyCalls()).toHaveLength(0)
    fireEvent.click(screen.getByRole("button", { name: "Go to Investigate & Recommend" }))
    expect(await screen.findByRole("button", { name: /Investigate & Recommend/ })).toBeVisible()
    fireEvent.click(tab(/AuditIQ/))
    expect(await screen.findByText("Let AuditIQ Fix It")).toBeVisible()
  })

  test("compat adapter: after an investigation, opening the DIY guide generates the legacy recommendation ONCE through the existing endpoint and renders it", async () => {
    renderView()
    await runInvestigation(apiService)
    expect(legacyCalls()).toHaveLength(0)
    fireEvent.click(tab(/DIY Guide/))
    expect(await screen.findByTestId("diy-renderer")).toHaveTextContent("rec-legacy-1")
    expect(legacyCalls()).toHaveLength(1)
    fireEvent.click(tab(/Fix with AI/))
    fireEvent.click(tab(/DIY Guide/))
    await new Promise((r) => setTimeout(r, 50))
    expect(legacyCalls()).toHaveLength(1)
    // and the legacy result is not painted into the AI tab as a second recommendation
    fireEvent.click(tab(/Fix with AI/))
    expect(screen.queryByText(/Regenerate/)).not.toBeInTheDocument()
    expect(legacyGenerateButton()).not.toBeInTheDocument()
  })

  test("the legacy recommendation is never fetched before the investigation has completed, even when DIY is opened first", async () => {
    let resolve
    apiService.startInvestigation.mockImplementation(() => new Promise((r) => { resolve = r }))
    renderView()
    fireEvent.click(await screen.findByRole("button", { name: /Investigate & Recommend/ }))
    fireEvent.click(tab(/DIY Guide/))
    await new Promise((r) => setTimeout(r, 60))
    expect(legacyCalls()).toHaveLength(0)
    void resolve
  })

  test("Create Task is offered after the investigation (not before) and links no legacy recommendation that does not exist", async () => {
    apiService.createTask.mockResolvedValue({ success: true, data: { _id: "task-1", status: "task_created" } })
    renderView()
    await screen.findByRole("button", { name: /Investigate & Recommend/ })
    expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument()
    await runInvestigation(apiService)
    fireEvent.click(await screen.findByRole("button", { name: /Create Task/ }))
    await waitFor(() => expect(apiService.createTask).toHaveBeenCalledTimes(1))
    expect(apiService.createTask).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-1", issueKey: "missing_h1", pageUrl: PAGE_A, origin: "ai_fix", recommendationId: null, status: "task_created" }))
    expect(legacyCalls()).toHaveLength(0)
  })

  test("a breadcrumb issue still reaches the owner-input panel: the adapter supplies the legacy evidence after the investigation", async () => {
    apiService.request.mockImplementation(async (endpoint) => {
      if (String(endpoint).includes("/recommendations/generate")) {
        return {
          success: true, data: { id: "rec-b", ruleId: "breadcrumblist_schema", sections: {} },
          meta: { schemaEvidence: { url: { trusted: true, display: PAGE_A, crawlKey: PAGE_A }, breadcrumb: { status: "unknown", userProvided: null, existingTrails: [] } } },
        }
      }
      return { success: true, data: null }
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <IssueDetailView issue={{ issue_code: "breadcrumblist_schema", title: "BreadcrumbList schema missing", affected_urls: [PAGE_A] }} initialSelUrl={PAGE_A} initialMode="ai" />
      </QueryClientProvider>
    )
    await runInvestigation(apiService)
    expect(await screen.findByRole("heading", { name: "Complete Your Breadcrumb Hierarchy" })).toBeInTheDocument()
    expect(legacyCalls()).toHaveLength(1)
    expect(legacyGenerateButton()).not.toBeInTheDocument()
  })
})
