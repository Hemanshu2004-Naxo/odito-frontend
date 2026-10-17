import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueDetailView from "./IssueDetailView"
import apiService from "@/lib/apiService"

/**
 * The image alt panel is part of the existing issue view: shown for images_missing_alt_text only, and only once a task exists AND
 * WordPress is connected. No linked recommendation is required (the text is written by a person). Real IssueDetailView + real panel.
 */

vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "project-1", main_url: "https://clinic.example" } }) }))
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
  useRecommendationById: () => ({ data: undefined, isLoading: false }),
}))
vi.mock("@/lib/apiService", () => ({
  default: {
    getIssueContext: vi.fn().mockResolvedValue({ success: true, data: null }),
    request: vi.fn(), createTask: vi.fn(), applyWordPressFix: vi.fn(), linkTaskRecommendation: vi.fn(), getRecommendationById: vi.fn(),
    listImageAltImages: vi.fn(), previewImageAltFix: vi.fn(),
  },
}))

const PAGE_URL = "https://clinic.example/doctors"

function renderView(issueCode = "images_missing_alt_text", mode = "ai") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueDetailView issue={{ issue_code: issueCode, title: "Images missing alt text", affected_urls: [PAGE_URL] }} initialSelUrl={PAGE_URL} initialMode={mode} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  wpCapabilitiesData = { connected: true, provider: "none", ambiguous: false, capabilities: {} }
  taskMapData = { [PAGE_URL]: { _id: "task-1", status: "task_created", recommendationId: null } }
  apiService.getIssueContext.mockResolvedValue({ success: true, data: null })
  apiService.listImageAltImages.mockResolvedValue({ success: true, data: { images: [{ src: "https://clinic.example/wp-content/uploads/2024/10/dr-rao.jpg", altState: "missing", hasAttachmentHint: false, decorativeSignals: false, fix: null }] } })
})

describe("IssueDetailView — image alt panel", () => {
  test("shown for a task on an images_missing_alt_text issue when WordPress is connected — without any linked recommendation — and it loads THIS task's images", async () => {
    renderView()
    expect(await screen.findByTestId("image-alt-fix-panel")).toBeInTheDocument()
    expect(await screen.findByTestId("alt-image-list")).toBeInTheDocument()
    expect(apiService.listImageAltImages).toHaveBeenCalledWith("task-1")
    expect(apiService.previewImageAltFix).not.toHaveBeenCalled()
  })

  test("not shown without a task, or when WordPress is not connected — and nothing is fetched", async () => {
    taskMapData = {}
    const a = renderView(); await screen.findByTestId("ai-recommendation-panel")
    expect(screen.queryByTestId("image-alt-fix-panel")).not.toBeInTheDocument(); a.unmount()
    taskMapData = { [PAGE_URL]: { _id: "task-1", status: "task_created" } }
    wpCapabilitiesData = { connected: false }
    renderView(); await screen.findByTestId("ai-recommendation-panel")
    expect(screen.queryByTestId("image-alt-fix-panel")).not.toBeInTheDocument()
    expect(apiService.listImageAltImages).not.toHaveBeenCalled()
  })

  test("when it cannot be offered, the person is told why instead of seeing nothing", async () => {
    taskMapData = {}
    const a = renderView(); await screen.findByTestId("ai-recommendation-panel")
    expect(await screen.findByTestId("image-alt-unavailable")).toHaveAttribute("data-reason", "no_task"); a.unmount()
    taskMapData = { [PAGE_URL]: { _id: "task-1", status: "task_created" } }
    wpCapabilitiesData = { connected: false }
    renderView(); await screen.findByTestId("ai-recommendation-panel")
    const note = await screen.findByTestId("image-alt-unavailable")
    expect(note).toHaveAttribute("data-reason", "not_connected")
    expect(note).toHaveTextContent(/connect your wordpress/i)
    expect(screen.queryByTestId("image-alt-fix-panel")).not.toBeInTheDocument()
  })

  test("no explanation is shown while the panel itself is offered, nor for another issue type", async () => {
    const a = renderView(); await screen.findByTestId("image-alt-fix-panel")
    expect(screen.queryByTestId("image-alt-unavailable")).not.toBeInTheDocument(); a.unmount()
    taskMapData = {}
    renderView("title_missing"); await screen.findByTestId("ai-recommendation-panel")
    expect(screen.queryByTestId("image-alt-unavailable")).not.toBeInTheDocument()
  })

  describe("a finding that was only an analytics tracker (nothing to fix)", () => {
    const trackerOnly = () => apiService.getIssueContext.mockResolvedValue({ success: true, data: { currentState: {}, altFindingScope: { actionable: 0, ignoredTracking: 1 } } })

    test("Fix with AI tab: a notice replaces the recommendation and the WordPress panel; nothing is fetched or offered", async () => {
      trackerOnly()
      renderView()
      const note = await screen.findByTestId("image-alt-not-applicable")
      expect(note).toHaveTextContent(/Nothing to fix on this page/)
      expect(note).toHaveTextContent(/tracker/)
      expect(note).toHaveTextContent(/Nothing is marked as fixed/)
      expect(screen.queryByTestId("ai-recommendation-panel")).not.toBeInTheDocument()
      expect(screen.queryByTestId("image-alt-fix-panel")).not.toBeInTheDocument()
      expect(apiService.listImageAltImages).not.toHaveBeenCalled()
      // A product name as an example is fine; a tracking id or address is never shown.
      expect(note.textContent).not.toMatch(/\d{8,}|https?:|\/tr\b/i)
    })

    test("DIY tab: no implementation checklist and no Mark as Implemented — the same notice instead", async () => {
      trackerOnly()
      renderView("images_missing_alt_text", "diy")
      expect(await screen.findByTestId("image-alt-not-applicable")).toBeInTheDocument()
      expect(screen.queryByText(/Implementation Confirmation/i)).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /Mark as Implemented/i })).not.toBeInTheDocument()
    })

    test("when real pictures remain (actionable > 0) — or the server sent no scope — everything works as before", async () => {
      apiService.getIssueContext.mockResolvedValue({ success: true, data: { currentState: {}, altFindingScope: { actionable: 6, ignoredTracking: 2 } } })
      const a = renderView(); expect(await screen.findByTestId("image-alt-fix-panel")).toBeInTheDocument()
      expect(screen.queryByTestId("image-alt-not-applicable")).not.toBeInTheDocument(); a.unmount()
      apiService.getIssueContext.mockResolvedValue({ success: true, data: null })
      renderView(); expect(await screen.findByTestId("image-alt-fix-panel")).toBeInTheDocument()
      expect(screen.queryByTestId("image-alt-not-applicable")).not.toBeInTheDocument()
    })

    test("another issue type is never affected, even with the same scope in its context", async () => {
      trackerOnly()
      renderView("title_missing")
      expect(await screen.findByTestId("ai-recommendation-panel")).toBeInTheDocument()
      expect(screen.queryByTestId("image-alt-not-applicable")).not.toBeInTheDocument()
    })
  })

  test("never shown for another issue type", async () => {
    renderView("title_missing")
    await screen.findByTestId("ai-recommendation-panel")
    expect(screen.queryByTestId("image-alt-fix-panel")).not.toBeInTheDocument()
    expect(apiService.listImageAltImages).not.toHaveBeenCalled()
  })
})
