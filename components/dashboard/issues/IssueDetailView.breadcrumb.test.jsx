import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueDetailView from "./IssueDetailView"
import apiService from "@/lib/apiService"
import { runInvestigation, legacyGenerateButton, investigateButton } from "@/test-utils/investigationKit"

/**
 * breadcrumblist_schema end to end through the REAL IssueDetailView, IssueRecommendationPanel, BreadcrumbHierarchyPanel
 * and DIYRenderer. Only the network layer (apiService) and the heavy code editor are replaced.
 *
 * Proves: the generate click shows the form instead of fake code; submitting the hierarchy shows the generated JSON-LD
 * in the AI tab AND the DIY guide, using ONLY the regenerate endpoint (no audit, no generate re-run); and nothing here
 * creates, implements or verifies a task.
 */

vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "project-1" } }) }))
vi.mock("@/lib/socketService", () => ({
  default: {
    onTaskImplemented: vi.fn(), onTaskVerified: vi.fn(), onTaskReopened: vi.fn(),
    offTaskImplemented: vi.fn(), offTaskVerified: vi.fn(), offTaskReopened: vi.fn(), joinProject: vi.fn(),
  },
}))
vi.mock("@/components/issue-context/CurrentStateRenderer", () => ({ default: () => <div data-testid="current-state-renderer" /> }))
vi.mock("@/components/recommendations/RecommendationCodeBlock", () => ({ default: ({ content }) => <pre data-testid="code-block">{content}</pre> }))
vi.mock("@/components/recommendations/RecommendationDiffViewer", () => ({ default: () => null }))
vi.mock("@/components/recommendations/RecommendationLoadingState", () => ({ default: () => <div>loading</div> }))

let taskMapData
let wpConnected = false
vi.mock("@/hooks/useDashboardQueries", () => ({
  useIssueUrls: () => ({ data: null, isLoading: false }),
  useActiveTaskUrls: () => ({ data: { data: { taskMap: taskMapData, fixedUrls: [], fixedCount: 0 } } }),
  useWordPressCapabilities: () => ({ data: { data: { connected: wpConnected, provider: 'rank_math', providerLabel: 'Rank Math', bridgeInstalled: true, bridgeActive: true, bridgeVersionSupported: true } } }),
  useWordPressSiteSchema: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useWordPressPageResolution: () => ({ data: undefined, isLoading: false, isError: false }),
  useWordPressH1Context: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useWordPressSeoData: () => ({ data: undefined, isLoading: false, isError: false }),
  useLinkTaskRecommendation: () => ({ mutate: vi.fn(), isPending: false }),
  useRecommendationById: () => ({ data: undefined, isLoading: false }),
}))

vi.mock("@/lib/apiService", () => ({
  default: {
    startInvestigation: vi.fn(), getInvestigation: vi.fn(), cancelInvestigation: vi.fn(), prepareInvestigationFix: vi.fn(), approveInvestigation: vi.fn(), verifyInvestigation: vi.fn(),
    getIssueContext: vi.fn().mockResolvedValue({ success: true, data: null }),
    request: vi.fn(),
    createTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    applyWordPressFix: vi.fn(),
    linkTaskRecommendation: vi.fn(),
    getRecommendationById: vi.fn(),
    regenerateBreadcrumbHierarchy: vi.fn(),
    discoverBreadcrumbs: vi.fn(),
    getWordPressFixPreview: vi.fn(),
    applyWordPressSchemaFix: vi.fn(),
  },
}))

const ORIGIN = "https://clinic.example"
const PAGE = `${ORIGIN}/blog`
const CANON = `${ORIGIN}/blog/`
const evidence = (breadcrumb) => ({ kinds: ["breadcrumb"], url: { display: CANON, trusted: true, source: "canonical_tag", crawlKey: PAGE }, breadcrumb })

const UNKNOWN_RESPONSE = {
  success: true,
  data: { id: "rec-1", ruleId: "breadcrumblist_schema", severity: "medium", sections: { whyThisMatters: "Breadcrumbs matter.", recommendedFix: "Explain.", recommendedVersion: "enabled", implementationExample: { type: "html", content: "<!-- ODITO: the parent pages could not be verified from the crawl -->" } } },
  meta: { source: "claude", schemaEvidence: evidence({ status: "unknown", needsInput: true, items: [], existingTrails: [], userProvided: null, conflict: null }) },
}
const JSON_LD = JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
  { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` }, { "@type": "ListItem", position: 2, name: "Blog", item: CANON },
] }, null, 2)
const GENERATED_RESPONSE = {
  success: true,
  data: { id: "rec-2", ruleId: "breadcrumblist_schema", severity: "medium", sections: { whyThisMatters: "w", recommendedFix: "Pick one way.", recommendedVersion: "enabled", implementationExample: { type: "html", content: `<script type="application/ld+json">\n${JSON_LD}\n</script>` } } },
  meta: { source: "template", schemaEvidence: evidence({ status: "user_provided", needsInput: false, items: [], existingTrails: [], conflict: null, userProvided: { items: [{ name: "Home", url: `${ORIGIN}/` }, { name: "Blog", url: CANON }], stale: false } }) },
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueDetailView issue={{ issue_code: "breadcrumblist_schema", title: "Breadcrumb schema missing", category: "Schema", affected_urls: [PAGE] }} initialSelUrl={PAGE} initialMode="ai" />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  taskMapData = {}
  wpConnected = false
  apiService.request.mockImplementation(async (endpoint) => {
    if (endpoint === "/recommendations/generate") return UNKNOWN_RESPONSE
    throw new Error(`unexpected request: ${endpoint}`)
  })
  apiService.regenerateBreadcrumbHierarchy.mockResolvedValue(GENERATED_RESPONSE)
})

describe("IssueDetailView — breadcrumb hierarchy workflow", () => {
  test("generate -> form (no fake code) -> submit -> generated JSON-LD in the AI tab and the DIY guide, with no audit and no task changes", async () => {
    renderView()
    await runInvestigation(apiService)

    expect(await screen.findByRole("heading", { name: "Complete Your Breadcrumb Hierarchy" })).toBeInTheDocument()
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument()
    expect(apiService.request).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getAllByLabelText("Page name")[0], { target: { value: "Home" } })
    fireEvent.change(screen.getAllByLabelText("Page URL")[0], { target: { value: `${ORIGIN}/` } })
    fireEvent.change(screen.getAllByLabelText("Page name")[1], { target: { value: "Blog" } })
    expect(screen.getAllByLabelText("Page URL")[1]).toHaveValue(CANON)
    fireEvent.click(screen.getByRole("button", { name: "Generate BreadcrumbList" }))

    const generated = await screen.findByTestId("breadcrumb-generated")
    expect(within(generated).getByText("Validated")).toBeInTheDocument()
    expect(screen.getByTestId("code-block").textContent).toContain('"@type": "BreadcrumbList"')

    expect(apiService.regenerateBreadcrumbHierarchy).toHaveBeenCalledTimes(1)
    expect(apiService.regenerateBreadcrumbHierarchy.mock.calls[0][0]).toMatchObject({ projectId: "project-1", pageUrl: PAGE, items: [{ name: "Home", url: `${ORIGIN}/` }, { name: "Blog", url: CANON }] })
    expect(apiService.request).toHaveBeenCalledTimes(1) // the original generate only — nothing re-ran, no audit endpoint

    // the DIY guide shows the SAME regenerated recommendation
    fireEvent.click(screen.getByRole("button", { name: /DIY Guide/ }))
    await waitFor(() => expect(screen.getAllByText(/BreadcrumbList/).length).toBeGreaterThan(0))
    expect(document.body.textContent).toContain('"@type": "BreadcrumbList"')
    expect(document.body.textContent).not.toContain("could not be verified from the crawl")

    expect(apiService.createTask).not.toHaveBeenCalled()
    expect(apiService.updateTaskStatus).not.toHaveBeenCalled()
  })

  test("re-running the investigation does not call the legacy generate endpoint again, and the owner-confirmed trail stays on this page", async () => {
    renderView()
    await runInvestigation(apiService)
    await screen.findByRole("heading", { name: "Complete Your Breadcrumb Hierarchy" })
    fireEvent.change(screen.getAllByLabelText("Page name")[0], { target: { value: "Home" } })
    fireEvent.change(screen.getAllByLabelText("Page URL")[0], { target: { value: `${ORIGIN}/` } })
    fireEvent.change(screen.getAllByLabelText("Page name")[1], { target: { value: "Blog" } })
    fireEvent.click(screen.getByRole("button", { name: "Generate BreadcrumbList" }))
    await screen.findByTestId("breadcrumb-generated")

    fireEvent.click(screen.getByTestId("investigation-rerun"))
    await waitFor(() => expect(apiService.startInvestigation).toHaveBeenCalledTimes(2))
    expect(apiService.request).toHaveBeenCalledTimes(1) // the single compatibility call; nothing re-ran
    expect(legacyGenerateButton()).not.toBeInTheDocument()
  })

  test("an issue that is not breadcrumb schema never shows the form", async () => {
    apiService.request.mockResolvedValue({ ...UNKNOWN_RESPONSE, data: { ...UNKNOWN_RESPONSE.data, ruleId: "x" }, meta: { source: "claude" } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <IssueDetailView issue={{ issue_code: "meta_description_missing", title: "Meta", affected_urls: [PAGE] }} initialSelUrl={PAGE} initialMode="ai" />
      </QueryClientProvider>
    )
    await runInvestigation(apiService)
    expect(screen.queryByTestId("breadcrumb-hierarchy-form")).not.toBeInTheDocument()
    expect(apiService.request).not.toHaveBeenCalled() // no owner-input panel -> the legacy endpoint is never needed
  })
})

describe("IssueDetailView — breadcrumbs are applied only through the checked flow", () => {
  const previewFor = (panelState) => ({
    success: true,
    data: {
      fixType: "breadcrumb_setting", lifecycle: "awaiting_approval", record: null, concurrency: { writes: "read_then_write" }, source: { provider: "rank_math" },
      plan: { status: "ready", fingerprint: "d".repeat(64), changes: [{ field: "breadcrumbs_enabled", kind: "enable", before: "", after: "on", label: "Rank Math breadcrumbs" }], blocked: [], preserved: [], notWritten: [] },
      proposedChanges: [{ field: "breadcrumbs_enabled", kind: "enable", before: "", after: "on", label: "Rank Math breadcrumbs" }], validation: { valid: true, errors: [] },
      breadcrumb: { panelState, trail: [], settingNow: "off", target: { label: "Rank Math → Titles & Meta → Misc → Breadcrumbs" }, manual: null, predicted: { predictable: true, urls: [] }, warnings: [], scope: { kind: "site_wide", affectedCount: 3, affectedPages: [] } },
    },
  })

  test("the generic 'Enable Breadcrumbs' dialog is gone: the DIY guide never offers Apply via WordPress for breadcrumbs, and points to the checked flow", async () => {
    wpConnected = true
    taskMapData = { [PAGE]: { _id: "task-1", status: "task_created", recommendationId: "rec-2" } }
    renderView()
    await runInvestigation(apiService)
    await screen.findByRole("heading", { name: "Complete Your Breadcrumb Hierarchy" })
    fireEvent.click(screen.getByRole("button", { name: /DIY Guide/ }))
    expect(await screen.findByText(/Odito looks for your page's real breadcrumb trail, you confirm it/)).toBeInTheDocument()
    expect(screen.queryByText("Apply via WordPress")).not.toBeInTheDocument()
    expect(screen.queryByText("Enable Rank Math Breadcrumbs?")).not.toBeInTheDocument()
    expect(apiService.applyWordPressFix).not.toHaveBeenCalled()
  })

  test("with a task, the apply card shows the server's plan; without a task there is no card and no WordPress call", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(previewFor("ready_to_apply"))
    taskMapData = {}
    const { unmount } = renderView()
    await runInvestigation(apiService)
    await screen.findByRole("heading", { name: "Complete Your Breadcrumb Hierarchy" })
    expect(screen.queryByTestId("breadcrumb-fix-card")).not.toBeInTheDocument()
    expect(apiService.getWordPressFixPreview).not.toHaveBeenCalled()
    unmount()

    taskMapData = { [PAGE]: { _id: "task-1", status: "task_created", recommendationId: "rec-2" } }
    renderView()
    await runInvestigation(apiService)
    expect(await screen.findByTestId("breadcrumb-fix-card")).toBeInTheDocument()
    expect(apiService.getWordPressFixPreview).toHaveBeenCalledWith("task-1")
    expect(screen.getByTestId("breadcrumb-fix-state")).toHaveAttribute("data-state", "ready_to_apply")
  })
})
