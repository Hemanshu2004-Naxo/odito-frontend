import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueDetailView from "./IssueDetailView"
import apiService from "@/lib/apiService"
import { runInvestigation, legacyGenerateButton, investigateButton } from "@/test-utils/investigationKit"

/**
 * The AuditIQ tab inside the real On-Page issue screen: it is wired to the real request API, keeps its
 * state across tab switches, and leaves the other two tabs exactly as they were.
 */

const PROJECT = { _id: "project-1", project_name: "Acme Site", main_url: "https://example.com" }
const PAGE = "https://example.com/about"

vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: PROJECT }) }))
vi.mock("@/lib/socketService", () => ({
  default: { onTaskImplemented: vi.fn(), onTaskVerified: vi.fn(), onTaskReopened: vi.fn(), offTaskImplemented: vi.fn(), offTaskVerified: vi.fn(), offTaskReopened: vi.fn(), joinProject: vi.fn() },
}))
vi.mock("@/components/recommendations/RecommendationCodeBlock", () => ({ default: () => null }))
vi.mock("@/components/recommendations/RecommendationDiffViewer", () => ({ default: () => null }))
vi.mock("@/components/recommendations/RecommendationLoadingState", () => ({ default: () => null }))
vi.mock("@/components/issue-context/CurrentStateRenderer", () => ({ default: () => null }))
vi.mock("@/components/diy/DIYRenderer", () => ({ default: () => null }))
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
    startInvestigation: vi.fn(), getInvestigation: vi.fn(), cancelInvestigation: vi.fn(), prepareInvestigationFix: vi.fn(), approveInvestigation: vi.fn(), verifyInvestigation: vi.fn(),
    getIssueContext: vi.fn().mockResolvedValue({ success: true, data: null }),
    request: vi.fn(), createTask: vi.fn(), updateTaskStatus: vi.fn(), applyWordPressFix: vi.fn(), linkTaskRecommendation: vi.fn(), getRecommendationById: vi.fn(),
  },
}))

const EMPTY_STATE = {
  requests: { express_fix: null, technical_audit_fix: null, expert_fix: null },
  services: { maintenance: { available: false, reason: "NOT_OFFERED" }, strategyCall: { available: false, reason: "NOT_CONFIGURED", url: null } },
}

const auditIqCalls = () => apiService.request.mock.calls.filter(([endpoint]) => String(endpoint).startsWith("/auditiq/"))

function renderView(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueDetailView
        issue={{ issue_code: "missing_h1", title: "H1 missing", pages: 7, affected_urls: [PAGE] }}
        onBack={() => {}}
        initialSelUrl={PAGE}
        {...props}
      />
    </QueryClientProvider>
  )
}

const tab = (name) => screen.getByRole("button", { name })

beforeEach(() => {
  vi.clearAllMocks()
  apiService.getIssueContext.mockResolvedValue({ success: true, data: null })
  apiService.request.mockImplementation(async (endpoint, options = {}) => {
    if (String(endpoint).startsWith("/auditiq/")) {
      if (options.method === "POST") {
        const body = JSON.parse(options.body)
        return { success: true, data: { id: "req-1", ...body, status: "submitted", isOpen: true, createdAt: "2026-10-15T10:00:00.000Z" } }
      }
      return { success: true, data: EMPTY_STATE }
    }
    return { success: true, data: null }
  })
})

describe("IssueDetailView — AuditIQ tab", () => {
  test("does not touch the AuditIQ API until the tab is opened", async () => {
    renderView()
    await screen.findByText(/This issue affects 7 pages/)
    expect(auditIqCalls()).toHaveLength(0)
    expect(screen.queryByText("Let AuditIQ Fix It")).not.toBeInTheDocument()
  })

  test("opening the tab shows the real panel for this project/issue and loads its status once", async () => {
    renderView()
    fireEvent.click(tab(/AuditIQ/))
    expect(await screen.findByText("Let AuditIQ Fix It")).toBeVisible()
    expect(screen.getByText(/across all 7 affected pages/)).toBeInTheDocument()
    await waitFor(() => expect(auditIqCalls()).toHaveLength(1))
    expect(auditIqCalls()[0][0]).toContain("projectId=project-1")
    expect(auditIqCalls()[0][0]).toContain("issueKey=missing_h1")
  })

  test("a request submitted from the real screen carries the project, issue, page and page count", async () => {
    renderView()
    fireEvent.click(tab(/AuditIQ/))
    fireEvent.click((await screen.findByText("Express Fix")).closest('[role="button"]'))
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    await screen.findByText(/Request submitted/)
    const post = auditIqCalls().find(([, o]) => o?.method === "POST")
    expect(JSON.parse(post[1].body)).toMatchObject({
      projectId: "project-1", requestType: "express_fix", issueKey: "missing_h1", issueTitle: "H1 missing", affectedPageCount: 7, pageUrl: PAGE,
    })
  })

  test("switching tabs keeps the AuditIQ draft and does not re-request", async () => {
    renderView()
    fireEvent.click(tab(/AuditIQ/))
    fireEvent.click(await screen.findByRole("button", { name: /Request Expert Fix/ }))
    fireEvent.change(screen.getByLabelText("What do you need help with?"), { target: { value: "please fix every page" } })

    fireEvent.click(tab(/Fix with AI/))
    expect(screen.getByTestId("auditiq-panel")).not.toBeVisible()
    fireEvent.click(tab(/DIY Guide/))
    expect(screen.getByTestId("auditiq-panel")).not.toBeVisible()
    fireEvent.click(tab(/AuditIQ/))

    expect(screen.getByTestId("auditiq-panel")).toBeVisible()
    expect(screen.getByLabelText("What do you need help with?")).toHaveValue("please fix every page")
    expect(auditIqCalls().filter(([, o]) => !o?.method)).toHaveLength(1)
  })

  test("Back to AI Fix returns to the Fix with AI tab", async () => {
    renderView()
    fireEvent.click(tab(/AuditIQ/))
    fireEvent.click(await screen.findByRole("button", { name: /Back to AI Fix/ }))
    expect(screen.getByTestId("auditiq-panel")).not.toBeVisible()
    const primary = await screen.findByRole("button", { name: /Investigate & Recommend/ })
    await waitFor(() => expect(primary).toBeVisible()) // fade-in, see below
  })

  test("initialMode=help opens straight onto the AuditIQ tab", async () => {
    renderView({ initialMode: "help" })
    expect(await screen.findByText("Let AuditIQ Fix It")).toBeVisible()
  })
})

describe("IssueDetailView — the other tabs are unaffected", () => {
  test("Fix with AI offers exactly ONE primary AI action: Investigate & Recommend (no separate Generate button, no second card)", async () => {
    renderView()
    const primary = await screen.findByRole("button", { name: /Investigate & Recommend/ })
    await waitFor(() => expect(primary).toBeVisible()) // the panel fades in (framer-motion), so visibility is not instant
    expect(screen.getAllByRole("button", { name: /Investigate|Generate/ })).toHaveLength(1)
    expect(legacyGenerateButton()).not.toBeInTheDocument()
    expect(screen.queryByText("Investigate this page")).not.toBeInTheDocument()
    expect(screen.getByText("Analyze the affected page, identify the root cause, and recommend the safest fix.")).toBeInTheDocument()
    expect(apiService.request).not.toHaveBeenCalledWith(expect.stringContaining("/recommendations/generate"), expect.anything())
  })

  test("DIY Guide still shows its no-recommendation fallback", async () => {
    renderView()
    fireEvent.click(tab(/DIY Guide/))
    expect(await screen.findByText(/Run Investigate & Recommend first to unlock the DIY guide/)).toBeVisible()
    expect(legacyGenerateButton()).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Go to Investigate & Recommend" })).toBeVisible()
    expect(auditIqCalls()).toHaveLength(0)
  })
})
