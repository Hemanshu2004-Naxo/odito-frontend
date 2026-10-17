import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueDetailView from "./IssueDetailView"
import apiService from "@/lib/apiService"

/**
 * The Organization fix panel is part of the existing issue view: shown for organization_schema only, and only once a task
 * with a linked recommendation exists AND WordPress is connected. Real IssueDetailView + real panel; the network is mocked.
 */

vi.mock("@/contexts/ProjectContext", () => ({
  useProject: () => ({ activeProject: { _id: "project-1", main_url: "https://clinic.example" } }),
}))
vi.mock("@/lib/socketService", () => ({
  default: {
    onTaskImplemented: vi.fn(), onTaskVerified: vi.fn(), onTaskReopened: vi.fn(),
    offTaskImplemented: vi.fn(), offTaskVerified: vi.fn(), offTaskReopened: vi.fn(), joinProject: vi.fn(),
  },
}))
vi.mock("@/components/recommendations", () => ({ IssueRecommendationPanel: () => <div data-testid="ai-recommendation-panel" /> }))
vi.mock("@/components/issue-context/CurrentStateRenderer", () => ({ default: () => <div /> }))

let taskMapData
let wpCapabilitiesData
vi.mock("@/hooks/useDashboardQueries", () => ({
  useIssueUrls: () => ({ data: null, isLoading: false }),
  useActiveTaskUrls: () => ({ data: { data: { taskMap: taskMapData, fixedUrls: [], fixedCount: 0 } } }),
  useWordPressCapabilities: () => ({ data: { data: wpCapabilitiesData } }),
  useWordPressSiteSchema: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useWordPressPageResolution: () => ({ data: undefined, isLoading: false, isError: false }),
  useWordPressH1Context: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useWordPressSeoData: () => ({ data: undefined, isLoading: false, isError: false }),
  useLinkTaskRecommendation: () => ({ mutate: vi.fn(), isPending: false }),
  useRecommendationById: () => ({ data: { data: { _id: "rec-1", sections: {} } }, isLoading: false }),
}))
vi.mock("@/lib/apiService", () => ({
  default: {
    getIssueContext: vi.fn().mockResolvedValue({ success: true, data: null }),
    request: vi.fn(), createTask: vi.fn(), applyWordPressFix: vi.fn(), linkTaskRecommendation: vi.fn(), getRecommendationById: vi.fn(),
    getWordPressFixPreview: vi.fn(),
  },
}))

const PAGE_URL = "https://clinic.example/"
const CONNECTED = { connected: true, provider: "rank_math", providerLabel: "Rank Math", ambiguous: false, bridgeInstalled: true, capabilities: {} }

function renderView(issueCode = "organization_schema") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueDetailView issue={{ issue_code: issueCode, title: "Missing Organization or LocalBusiness Schema", affected_urls: [PAGE_URL] }} initialSelUrl={PAGE_URL} initialMode="ai" />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  wpCapabilitiesData = CONNECTED
  taskMapData = { [PAGE_URL]: { _id: "task-1", status: "task_created", recommendationId: "rec-1" } }
  apiService.getIssueContext.mockResolvedValue({ success: true, data: null })
  apiService.getWordPressFixPreview.mockResolvedValue({ success: true, data: {
    fixType: "organization_schema", targetUrl: PAGE_URL, lifecycle: "awaiting_approval", source: { provider: "rank_math", bridgeVersion: "1.4.0" },
    schemaIntent: { type: "Organization", action: "generate", reasons: [] },
    plan: { status: "ready", fingerprint: "c".repeat(64), changes: [{ field: "name", rankMathOption: "rank-math-options-titles.knowledgegraph_name" }], preserved: [], blocked: [], notWritten: [] },
    proposedChanges: [{ field: "name", label: "Organization name", kind: "set", before: "", after: "Clinic Eye Centre" }],
    validation: { valid: true, errors: [], warnings: [] }, verificationStatus: { saved: "pending", rendered: "pending" }, record: null,
  } })
})

describe("IssueDetailView — Organization fix panel", () => {
  test("shown beside the recommendation when a task with a linked recommendation exists and WordPress is connected; it previews THIS task", async () => {
    renderView()
    expect(await screen.findByTestId("organization-fix-panel")).toBeInTheDocument()
    expect(screen.getByTestId("ai-recommendation-panel")).toBeInTheDocument()
    expect(await screen.findByTestId("fix-changes")).toBeInTheDocument()
    expect(apiService.getWordPressFixPreview).toHaveBeenCalledWith("task-1")
  })

  test("not shown without a task, without a linked recommendation, or when WordPress is not connected — and nothing is fetched", async () => {
    taskMapData = {}
    const a = renderView(); await screen.findByTestId("ai-recommendation-panel")
    expect(screen.queryByTestId("organization-fix-panel")).not.toBeInTheDocument(); a.unmount()

    taskMapData = { [PAGE_URL]: { _id: "task-1", status: "task_created", recommendationId: null } }
    const b = renderView(); await screen.findByTestId("ai-recommendation-panel")
    expect(screen.queryByTestId("organization-fix-panel")).not.toBeInTheDocument(); b.unmount()

    taskMapData = { [PAGE_URL]: { _id: "task-1", status: "task_created", recommendationId: "rec-1" } }
    wpCapabilitiesData = { connected: false }
    renderView(); await screen.findByTestId("ai-recommendation-panel")
    expect(screen.queryByTestId("organization-fix-panel")).not.toBeInTheDocument()
    expect(apiService.getWordPressFixPreview).not.toHaveBeenCalled()
  })

  test("never shown for another issue type", async () => {
    renderView("title_missing")
    await screen.findByTestId("ai-recommendation-panel")
    expect(screen.queryByTestId("organization-fix-panel")).not.toBeInTheDocument()
    expect(apiService.getWordPressFixPreview).not.toHaveBeenCalled()
  })
})
