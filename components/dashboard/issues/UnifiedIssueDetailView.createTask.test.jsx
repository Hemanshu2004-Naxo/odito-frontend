import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import UnifiedIssueDetailView from "./UnifiedIssueDetailView"
import apiService from "@/lib/apiService"
import { defineCreateTaskScenarios } from "@/test-utils/createTaskScenarios"
import { runInvestigation, legacyGenerateButton, investigateButton } from "@/test-utils/investigationKit"

/**
 * UnifiedIssueDetailView backs the AISO, AEO and GEO hub issue pages.
 *   scope "domain" → DomainIssueDetailView (previously onCreateTask={() => {}})
 *   scope "page"   → IssueDetailView (its own, already-working Create Task)
 * Both are run against the shared Create Task contract for all three hubs.
 */

const PROJECT = { _id: "project-1", main_url: "https://naxonify.com/" }
let pageResolutionData

vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: PROJECT }) }))
vi.mock("@/lib/socketService", () => ({
  default: { onTaskImplemented: vi.fn(), onTaskVerified: vi.fn(), onTaskReopened: vi.fn(), offTaskImplemented: vi.fn(), offTaskVerified: vi.fn(), offTaskReopened: vi.fn(), joinProject: vi.fn() },
}))
vi.mock("@/components/recommendations/RecommendationCodeBlock", () => ({ default: () => null }))
vi.mock("@/components/recommendations/RecommendationDiffViewer", () => ({ default: () => null }))
vi.mock("@/components/recommendations/RecommendationLoadingState", () => ({ default: () => null }))
vi.mock("@/components/issue-context/CurrentStateRenderer", () => ({ default: () => null }))
vi.mock("@/components/diy/DIYRenderer", () => ({ default: () => null }))

let taskMapData
vi.mock("@/hooks/useDashboardQueries", () => ({
  useIssueUrls: () => ({ data: null, isLoading: false }),
  useActiveTaskUrls: () => ({ data: { data: { taskMap: taskMapData, fixedUrls: [], fixedCount: 0 } } }),
  useWordPressCapabilities: () => ({ data: { data: { connected: false } } }),
  useWordPressSiteSchema: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  // Page-content (H1) eligibility — not exercised by this file (its issues are not h1_missing).
  useWordPressPageResolution: () => ({ data: pageResolutionData, isLoading: false, isError: false }),
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

const HUBS = [
  { hub: "AISO Hub", card: "AISO", domainRule: "AISO-D1", pageRule: "AISO-P1" },
  { hub: "AEO Hub", card: "AEO", domainRule: "AEO-D1", pageRule: "AEO-P1" },
  { hub: "GEO Hub", card: "GEO", domainRule: "GEO-D1", pageRule: "GEO-P1" },
]
const ROOT = "https://naxonify.com"
const PAGE = "https://naxonify.com/services/seo"

for (const { hub, card, domainRule, pageRule } of HUBS) {
  // ── Domain-level issues (no page list) ───────────────────────────────────
  defineCreateTaskScenarios({
    label: `${hub} — domain-level issue`,
    apiService,
    pageUrl: ROOT, // the domain root the ai_issues document is attached to
    expectedPayload: { projectId: "project-1", issueKey: domainRule, issueName: `${card} domain issue`, issueCategory: card },
    setTaskMap: (map) => { taskMapData = map },
    renderScreen: (queryClient) => render(
      <QueryClientProvider client={queryClient}>
        <UnifiedIssueDetailView
          issueTypeName={hub}
          onBack={() => {}}
          issue={{ scope: "domain", rule_id: domainRule, issue_title: `${card} domain issue`, issue_description: "robots.txt blocks AI crawlers", severity: "high", card, evidence: { blocked: true } }}
        />
      </QueryClientProvider>
    ),
    generate: async () => {
      fireEvent.click(await screen.findByRole("button", { name: /Generate AI Recommendation/ }))
      await waitFor(() => expect(screen.getByRole("button", { name: /Regenerate/ })).toBeInTheDocument())
    },
  })

  // ── Page-level issues (delegates to IssueDetailView) ─────────────────────
  defineCreateTaskScenarios({
    label: `${hub} — page-level issue`,
    apiService,
    pageUrl: PAGE,
    expectedRecommendationId: null,
    expectedPayload: { projectId: "project-1", issueKey: pageRule, issueName: `${card} page issue`, issueCategory: card },
    setTaskMap: (map) => { taskMapData = map },
    renderScreen: (queryClient) => render(
      <QueryClientProvider client={queryClient}>
        <UnifiedIssueDetailView
          issueTypeName={hub}
          onBack={() => {}}
          issue={{ scope: "page", rule_id: pageRule, issue_title: `${card} page issue`, issue_description: "d", severity: "high", card, pages_affected: 1, affected_urls: [PAGE] }}
        />
      </QueryClientProvider>
    ),
    generate: async () => {
      fireEvent.click(await screen.findByText(PAGE))
      await runInvestigation(apiService)
      await screen.findByTestId("unified-task-actions")
    },
  })
}

describe("DomainIssueDetailView — no domain root available", () => {
  test("a project without a usable main_url gets no Create Task button rather than a dead one", async () => {
    const saved = PROJECT.main_url
    PROJECT.main_url = undefined
    try {
      const { QueryClient } = await import("@tanstack/react-query")
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      taskMapData = {}
      render(
        <QueryClientProvider client={qc}>
          <UnifiedIssueDetailView issueTypeName="AISO Hub" onBack={() => {}} issue={{ scope: "domain", rule_id: "AISO-D1", issue_title: "t", issue_description: "d", severity: "high", card: "AISO", evidence: {} }} />
        </QueryClientProvider>
      )
      expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument()
      expect(apiService.createTask).not.toHaveBeenCalled()
    } finally {
      PROJECT.main_url = saved
    }
  })
})
