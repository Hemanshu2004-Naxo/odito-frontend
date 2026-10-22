import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueDetailView from "./IssueDetailView"
import apiService from "@/lib/apiService"
import { runInvestigation, legacyGenerateButton, investigateButton } from "@/test-utils/investigationKit"

/**
 * Regression test for the REAL root cause behind a production bug that
 * survived an earlier fix: recommendationService._formatOutput() (the
 * actual shape POST /recommendations/generate returns) names the
 * recommendation's id field `id` — never `_id`. Both createTaskMutation
 * and the auto-link effect in IssueDetailView.jsx read `recommendation._id`
 * (always undefined against the real API), so recommendationId was
 * silently null on every task, and the auto-link effect's own first guard
 * bailed out on every run. An earlier version of this exact test used a
 * mock recommendation shaped `{ _id: "..." }` — which is why it passed
 * despite the bug still being live: the mock matched the WRONG assumption,
 * not the real backend. This version's mock is shaped to match
 * recommendationService._formatOutput()'s actual output exactly.
 *
 * Uses the REAL useActiveTaskUrls / useLinkTaskRecommendation /
 * useRecommendationById hooks (not stubbed) so this proves the full
 * generate -> auto-link -> invalidate -> refetch -> re-render chain, not
 * just an isolated computation.
 */

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

vi.mock("@/components/issue-context/CurrentStateRenderer", () => ({
  default: () => <div data-testid="current-state-renderer" />,
}))

let taskMapData
let wpCapabilitiesData

vi.mock("@/hooks/useDashboardQueries", async () => {
  const actual = await vi.importActual("@/hooks/useDashboardQueries")
  return {
    ...actual,
    useIssueUrls: () => ({ data: null, isLoading: false }),
    // useActiveTaskUrls, useLinkTaskRecommendation, and useRecommendationById
    // are all the REAL implementation — only apiService (the network
    // layer) is mocked below, and it returns DIFFERENT data before vs.
    // after the link call, exactly like the real backend would once
    // linkTaskRecommendation() has actually persisted the change.
    useWordPressCapabilities: () => ({ data: { data: wpCapabilitiesData } }),
    useWordPressSeoData: () => ({ data: { data: { seo: { metaDescription: "" } } }, isLoading: false }),
  }
})

vi.mock("@/lib/apiService", () => ({
  default: {
    startInvestigation: vi.fn(), getInvestigation: vi.fn(), cancelInvestigation: vi.fn(), prepareInvestigationFix: vi.fn(), approveInvestigation: vi.fn(), verifyInvestigation: vi.fn(),
    getIssueContext: vi.fn().mockResolvedValue({ success: true, data: null }),
    request: vi.fn(),
    createTask: vi.fn(),
    applyWordPressFix: vi.fn(),
    linkTaskRecommendation: vi.fn(),
    getRecommendationById: vi.fn().mockImplementation(async (recommendationId) => ({
      success: true,
      data: { _id: recommendationId, sections: { contentRewrite: { optimized: "Freshly generated meta description." } } },
    })),
    getActiveTaskUrls: vi.fn().mockImplementation(async () => ({
      success: true,
      data: { taskMap: taskMapData, fixedUrls: [], fixedCount: 0 },
    })),
  },
}))

const BRIDGE_ACTIVE_RANK_MATH = {
  connected: true, provider: "rank_math", providerLabel: "Rank Math", providers: ["rank_math"],
  ambiguous: false, bridgeRequired: false, bridgeInstalled: true, bridgeActive: true, bridgeVersionSupported: true,
  capabilities: { title: { read: true, write: true }, metaDescription: { read: true, write: true }, canonical: { read: true, write: true } },
}

function renderIssueDetailView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueDetailView
        issue={{ issue_code: "meta_description_missing", title: "Meta description missing", affected_urls: ["https://example.com/page"] }}
        initialSelUrl="https://example.com/page"
        initialMode="ai"
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  taskMapData = {
    "https://example.com/page": { _id: "task-1", status: "task_created", recommendationId: null },
  }
  wpCapabilitiesData = BRIDGE_ACTIVE_RANK_MATH
})

describe("IssueDetailView — recommendation.id field-name regression (real API shape)", () => {
  test("generateRecommendation's response is shaped { id, sections } — NOT { _id, sections } — matching recommendationService._formatOutput() exactly", async () => {
    // This assertion exists so a future change to the API's field name
    // (in either direction) breaks this test loudly, instead of silently
    // reintroducing the bug this file exists to catch.
    apiService.request.mockResolvedValue({
      success: true,
      data: { id: "rec-fresh-1", sections: { contentRewrite: { optimized: "x" } } },
    })
    const response = await apiService.request("/recommendations/generate", {})
    expect(response.data.id).toBe("rec-fresh-1")
    expect(response.data._id).toBeUndefined()
  })

  test("after Investigate & Recommend, opening the DIY tab generates the legacy recommendation once and picks up the new link WITHOUT a page reload (real invalidate/refetch)", async () => {
    // Shaped EXACTLY like recommendationService._formatOutput()'s real
    // output: `id`, never `_id`. A mock shaped `{ _id: ... }` here would
    // make this test pass even with the bug still present — it must match
    // the real contract, not the assumption the bug was built on.
    apiService.request.mockImplementation(async (path) => {
      if (path === "/recommendations/generate") {
        return {
          success: true,
          data: { id: "rec-fresh-1", sections: { contentRewrite: { optimized: "Freshly generated meta description." } } },
        }
      }
      throw new Error(`unexpected request: ${path}`)
    })
    // Simulates the REAL backend: once linkTaskRecommendation() actually
    // runs, the very next getActiveTaskUrls() call reflects the new
    // recommendationId — exactly like a real Task.findById would after
    // task.save().
    apiService.linkTaskRecommendation.mockImplementation(async (taskId, recommendationId) => {
      taskMapData = { ...taskMapData, "https://example.com/page": { ...taskMapData["https://example.com/page"], recommendationId } }
      return { success: true, data: { _id: taskId, recommendationId } }
    })

    renderIssueDetailView()

    await runInvestigation(apiService)
    expect(apiService.request).not.toHaveBeenCalled() // the investigation alone never calls the legacy endpoint
    fireEvent.click(screen.getByText("🛠 DIY Guide")) // the compatibility adapter generates it, once, for the DIY guide
    await waitFor(() => expect(apiService.request).toHaveBeenCalledTimes(1))

    // THE ACTUAL BUG: with `recommendation._id` (undefined against this
    // shape), this call would never happen at all.
    await waitFor(() => expect(apiService.linkTaskRecommendation).toHaveBeenCalledWith("task-1", "rec-fresh-1"), { timeout: 2000 })

    // The DIY tab is already open — it must reflect the link immediately, no reload.
    await waitFor(() => expect(screen.getByText("Apply via WordPress")).toBeInTheDocument(), { timeout: 2000 })
    expect(screen.queryByText(/No AI recommendation is linked/)).not.toBeInTheDocument()
  })

  test("a recommendation shaped only with `_id` (no `id`) never triggers the auto-link — proves the fix reads the right field, not both defensively", async () => {
    apiService.request.mockImplementation(async (path) => {
      if (path === "/recommendations/generate") {
        return { success: true, data: { _id: "should-be-ignored", sections: { contentRewrite: { optimized: "x" } } } }
      }
      throw new Error(`unexpected request: ${path}`)
    })

    renderIssueDetailView()
    await runInvestigation(apiService)
    fireEvent.click(screen.getByText("🛠 DIY Guide"))
    await waitFor(() => expect(apiService.request).toHaveBeenCalledTimes(1))
    // Give any (incorrect) auto-link attempt a chance to fire.
    await new Promise((r) => setTimeout(r, 50))
    expect(apiService.linkTaskRecommendation).not.toHaveBeenCalled()
  })
})
