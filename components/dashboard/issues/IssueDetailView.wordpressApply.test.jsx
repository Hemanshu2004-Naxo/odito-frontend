import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueDetailView from "./IssueDetailView"
import apiService from "@/lib/apiService"
import { runInvestigation, legacyGenerateButton, investigateButton } from "@/test-utils/investigationKit"

/**
 * Regression coverage for the production bug where "Apply Fix" rendered
 * enabled — and "Apply via WordPress" was offered at all — for a task that
 * had NO recommendation actually linked server-side. Root cause: the old
 * `canOfferWordPressApply` gated on this component's own local, ephemeral
 * "Generate Recommendation" mutation result, which has no relationship to
 * whether the SELECTED TASK's own `recommendationId` field is set. A task
 * created before any recommendation existed (e.g. via the DIY flow) kept
 * recommendationId: null forever, so the backend correctly rejected every
 * apply attempt with RECOMMENDATION_REQUIRED while the button stayed lit.
 *
 * This file exercises the REAL IssueDetailView + REAL DIYRenderer + a REAL
 * QueryClient (only apiService's network layer is mocked) so "does the
 * Apply button actually appear/stay disabled" is a genuine assertion about
 * the fixed component, not about a mock standing in for it.
 */

let pageResolutionData

vi.mock("@/contexts/ProjectContext", () => ({
  useProject: () => ({ activeProject: { _id: "project-1" } }),
}))

vi.mock("@/lib/socketService", () => ({
  default: {
    onTaskImplemented: vi.fn(), onTaskVerified: vi.fn(), onTaskReopened: vi.fn(),
    offTaskImplemented: vi.fn(), offTaskVerified: vi.fn(), offTaskReopened: vi.fn(),
    joinProject: vi.fn(),
  },
}))

vi.mock("@/components/recommendations", () => ({
  IssueRecommendationPanel: () => <div data-testid="ai-recommendation-panel" />,
}))

vi.mock("@/components/issue-context/CurrentStateRenderer", () => ({
  default: () => <div data-testid="current-state-renderer" />,
}))

let taskMapData
let wpCapabilitiesData
let linkedRecommendationData
let linkedRecommendationLoading
let wpSeoData
let wpSeoDataLoading
let wpSeoDataIsError
const linkMutationSpy = vi.fn().mockResolvedValue({ success: true })

vi.mock("@/hooks/useDashboardQueries", () => ({
  useIssueUrls: () => ({ data: null, isLoading: false }),
  useActiveTaskUrls: () => ({ data: { data: { taskMap: taskMapData, fixedUrls: [], fixedCount: 0 } } }),
  useWordPressCapabilities: () => ({ data: { data: wpCapabilitiesData } }),
  // IssueDetailView also calls this for site-scoped fields (same_as/breadcrumb);
  // these tests only cover per-page fields, so it stays disabled/empty.
  useWordPressSiteSchema: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  // Page-content (H1) eligibility — not exercised by this file (its issues are not h1_missing).
  useWordPressPageResolution: () => ({ data: pageResolutionData, isLoading: false, isError: false }),
  useWordPressH1Context: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useWordPressSeoData: () => ({ data: wpSeoData, isLoading: wpSeoDataLoading, isError: wpSeoDataIsError }),
  useLinkTaskRecommendation: () => ({ mutate: linkMutationSpy, isPending: false }),
  useRecommendationById: () => ({ data: linkedRecommendationData, isLoading: linkedRecommendationLoading }),
}))

vi.mock("@/lib/apiService", () => ({
  default: {
    startInvestigation: vi.fn(), getInvestigation: vi.fn(), cancelInvestigation: vi.fn(), prepareInvestigationFix: vi.fn(), approveInvestigation: vi.fn(), verifyInvestigation: vi.fn(),
    getIssueContext: vi.fn().mockResolvedValue({ success: true, data: null }),
    request: vi.fn(),
    createTask: vi.fn(),
    applyWordPressFix: vi.fn(),
    linkTaskRecommendation: vi.fn(),
    getRecommendationById: vi.fn(),
  },
}))

const BRIDGE_ACTIVE_RANK_MATH = {
  connected: true, provider: "rank_math", providerLabel: "Rank Math", providers: ["rank_math"],
  ambiguous: false, bridgeRequired: false, bridgeInstalled: true, bridgeActive: true, bridgeVersionSupported: true,
  capabilities: { title: { read: true, write: true }, metaDescription: { read: true, write: true }, canonical: { read: true, write: true } },
}

const LINKED_RECOMMENDATION = {
  _id: "rec-1",
  sections: { contentRewrite: { optimized: "Explore the full sitemap of Sapphire Digital Agency." } },
}

function renderIssueDetailView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueDetailView
        issue={{ issue_code: "meta_description_missing", title: "Meta description missing", affected_urls: ["https://example.com/page"] }}
        initialSelUrl="https://example.com/page"
        initialMode="diy"
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  taskMapData = {}
  wpCapabilitiesData = BRIDGE_ACTIVE_RANK_MATH
  linkedRecommendationData = null
  linkedRecommendationLoading = false
  // Real, non-empty live value by default — matches the naxonify.com bug
  // report exactly (a page with a genuine, substantial meta description),
  // so tests that don't care about this specifically don't accidentally
  // exercise the "(empty)"/"unavailable" paths by default.
  wpSeoData = { data: { seo: { metaDescription: "A real, non-empty live meta description." } } }
  wpSeoDataLoading = false
  wpSeoDataIsError = false
})

describe("IssueDetailView — WordPress apply-fix gating (recommendation linkage bug fix)", () => {
  test("task exists but has NO recommendationId: Apply via WordPress is never offered, even though the field/provider/bridge are all fine", () => {
    taskMapData = {
      "https://example.com/page": { _id: "task-1", status: "task_created", recommendationId: null },
    }
    // No recommendation has been fetched/linked — this is exactly the
    // screenshot's real server state (task.recommendationId: null).
    renderIssueDetailView()

    expect(screen.queryByText("Apply via WordPress")).not.toBeInTheDocument()
    expect(screen.getByText(/No AI recommendation is linked to this task yet/)).toBeInTheDocument()
  })

  test("task has a real, loaded recommendationId: Apply via WordPress IS offered", async () => {
    taskMapData = {
      "https://example.com/page": { _id: "task-1", status: "task_created", recommendationId: "rec-1" },
    }
    linkedRecommendationData = { data: LINKED_RECOMMENDATION }
    linkedRecommendationLoading = false

    renderIssueDetailView()

    await waitFor(() => expect(screen.getByText("Apply via WordPress")).toBeInTheDocument())
    expect(screen.queryByText(/No AI recommendation is linked/)).not.toBeInTheDocument()
  })

  test("task has a recommendationId but the fetch hasn't resolved yet: Apply via WordPress stays hidden (never offered before the link is confirmed)", () => {
    taskMapData = {
      "https://example.com/page": { _id: "task-1", status: "task_created", recommendationId: "rec-1" },
    }
    linkedRecommendationData = null
    linkedRecommendationLoading = true

    renderIssueDetailView()

    expect(screen.queryByText("Apply via WordPress")).not.toBeInTheDocument()
  })

  test("clicking the confirmation dialog's Apply Fix never sends a client-provided value — only expectedCurrentValue and approved", async () => {
    taskMapData = {
      "https://example.com/page": { _id: "task-1", status: "task_created", recommendationId: "rec-1" },
    }
    linkedRecommendationData = { data: LINKED_RECOMMENDATION }
    apiService.applyWordPressFix.mockResolvedValue({ success: true, data: { alreadyApplied: false } })

    renderIssueDetailView()

    const applyButton = await screen.findByText("Apply via WordPress")
    fireEvent.click(applyButton)

    const confirmButton = await screen.findByRole("button", { name: "Apply Fix" })
    expect(confirmButton).not.toBeDisabled()
    fireEvent.click(confirmButton)

    await waitFor(() => expect(apiService.applyWordPressFix).toHaveBeenCalledTimes(1))
    const [taskId, payload] = apiService.applyWordPressFix.mock.calls[0]
    expect(taskId).toBe("task-1")
    expect(Object.keys(payload).sort()).toEqual(["approved", "expectedCurrentValue"])
    expect(payload.approved).toBe(true)
  })

  test("if the backend still rejects with RECOMMENDATION_REQUIRED (a race the frontend gate can't fully close), Apply Fix becomes disabled rather than staying clickable", async () => {
    taskMapData = {
      "https://example.com/page": { _id: "task-1", status: "task_created", recommendationId: "rec-1" },
    }
    linkedRecommendationData = { data: LINKED_RECOMMENDATION }
    apiService.applyWordPressFix.mockRejectedValue(
      Object.assign(new Error("No AI recommendation is linked to this task yet — generate one before applying a WordPress fix."), {
        status: 422, code: "RECOMMENDATION_REQUIRED",
      })
    )

    renderIssueDetailView()

    const applyButton = await screen.findByText("Apply via WordPress")
    fireEvent.click(applyButton)
    const confirmButton = await screen.findByRole("button", { name: "Apply Fix" })
    fireEvent.click(confirmButton)

    await waitFor(() => expect(screen.getByRole("button", { name: "Apply Fix" })).toBeDisabled())
    expect(screen.getByText(/No AI recommendation is linked to this task/)).toBeInTheDocument()
  })

  test("Bridge not active for Rank Math: Apply via WordPress is not offered regardless of recommendation state", () => {
    taskMapData = {
      "https://example.com/page": { _id: "task-1", status: "task_created", recommendationId: "rec-1" },
    }
    linkedRecommendationData = { data: LINKED_RECOMMENDATION }
    wpCapabilitiesData = {
      connected: true, provider: "rank_math", providerLabel: "Rank Math", providers: ["rank_math"],
      ambiguous: false, bridgeRequired: true, bridgeInstalled: false, bridgeActive: false, bridgeVersionSupported: true,
      capabilities: { title: { read: true, write: false }, metaDescription: { read: true, write: false }, canonical: { read: true, write: false } },
    }

    renderIssueDetailView()

    expect(screen.queryByText("Apply via WordPress")).not.toBeInTheDocument()
    expect(screen.getByText(/Install the Odito SEO Bridge plugin/)).toBeInTheDocument()
  })

  test("no task exists yet for this URL: Apply via WordPress is not offered", () => {
    taskMapData = {}
    renderIssueDetailView()

    expect(screen.queryByText("Apply via WordPress")).not.toBeInTheDocument()
  })
})

describe("IssueDetailView — Apply-fix dialog current-value display (naxonify.com \"(empty)\" bug fix)", () => {
  function openApplyDialog() {
    taskMapData = {
      "https://example.com/page": { _id: "task-1", status: "task_created", recommendationId: "rec-1" },
    }
    linkedRecommendationData = { data: LINKED_RECOMMENDATION }
  }

  test("a real, non-empty live value is displayed as-is — not replaced by (empty) or a stale audit value", async () => {
    openApplyDialog()
    wpSeoData = { data: { seo: { metaDescription: "Resell professional SEO services with Naxonify. Our SEO reseller services help agencies offer SEO audits, local SEO, technical SEO, content, and reporting under their own brand." } } }

    renderIssueDetailView()
    fireEvent.click(await screen.findByText("Apply via WordPress"))

    await waitFor(() => expect(screen.getByText(/Resell professional SEO services with Naxonify/)).toBeInTheDocument())
    expect(screen.queryByText("(empty)")).not.toBeInTheDocument()
    expect(screen.queryByText(/Unable to read the current WordPress value/)).not.toBeInTheDocument()
  })

  test("a genuinely empty live value correctly shows (empty) — this case must keep working", async () => {
    openApplyDialog()
    wpSeoData = { data: { seo: { metaDescription: "" } } }

    renderIssueDetailView()
    fireEvent.click(await screen.findByText("Apply via WordPress"))

    await waitFor(() => expect(screen.getByText("(empty)")).toBeInTheDocument())
  })

  test("while the live value is still loading, shows a loading state — never (empty) and never the previous page's value", async () => {
    openApplyDialog()
    wpSeoDataLoading = true
    wpSeoData = undefined

    renderIssueDetailView()
    fireEvent.click(await screen.findByText("Apply via WordPress"))

    await waitFor(() => expect(screen.getByText("Loading current value…")).toBeInTheDocument())
    expect(screen.queryByText("(empty)")).not.toBeInTheDocument()
  })

  test("a failed live-value fetch shows an explicit unavailable message — NEVER silently displayed as (empty)", async () => {
    openApplyDialog()
    wpSeoData = undefined
    wpSeoDataIsError = true

    renderIssueDetailView()
    fireEvent.click(await screen.findByText("Apply via WordPress"))

    await waitFor(() => expect(screen.getByText(/Unable to read the current WordPress value/)).toBeInTheDocument())
    expect(screen.queryByText("(empty)")).not.toBeInTheDocument()
  })

  test("a failed live-value fetch replaces Apply Fix with Refresh Live Value — cannot apply against an unconfirmed read", async () => {
    openApplyDialog()
    wpSeoData = undefined
    wpSeoDataIsError = true

    renderIssueDetailView()
    fireEvent.click(await screen.findByText("Apply via WordPress"))

    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh Live Value" })).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Apply Fix" })).not.toBeInTheDocument()
    expect(apiService.applyWordPressFix).not.toHaveBeenCalled()
  })
})
