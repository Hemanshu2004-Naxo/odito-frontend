import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueDetailView from "./IssueDetailView"
import apiService from "@/lib/apiService"

/**
 * sameAs (Organization profile links) inside the issue view: real IssueDetailView + real SameAsFixPanel + real hooks and a real
 * QueryClient; only the network layer is mocked. The profile links come from DISCOVERY (the site's own pages and markup) or from the
 * owner — never from the AI text — and nothing is written before the person approves the exact change.
 */

let taskMapData
let wpCapabilitiesData
let linkedRecommendationData

vi.mock("@/contexts/ProjectContext", () => ({
  useProject: () => ({ activeProject: { _id: "project-1", main_url: "https://naxonify.com" } }),
}))

vi.mock("@/lib/socketService", () => ({
  default: {
    onTaskImplemented: vi.fn(), onTaskVerified: vi.fn(), onTaskReopened: vi.fn(),
    offTaskImplemented: vi.fn(), offTaskVerified: vi.fn(), offTaskReopened: vi.fn(),
    joinProject: vi.fn(),
  },
}))

vi.mock("@/components/recommendations", () => ({
  IssueRecommendationPanel: ({ onCreateTask }) => <div data-testid="ai-recommendation-panel"><button type="button" onClick={onCreateTask}>Create Task (panel)</button></div>,
}))

vi.mock("@/components/issue-context/CurrentStateRenderer", () => ({
  default: () => <div data-testid="current-state-renderer" />,
}))

vi.mock("@/hooks/useDashboardQueries", () => ({
  useIssueUrls: () => ({ data: null, isLoading: false }),
  useActiveTaskUrls: () => ({ data: { data: { taskMap: taskMapData, fixedUrls: [], fixedCount: 0 } } }),
  useWordPressCapabilities: () => ({ data: { data: wpCapabilitiesData } }),
  useWordPressSiteSchema: () => ({ data: { data: { supported: true, provider: "rank_math", organization: { protectedSameAs: [], additionalSameAs: [] }, breadcrumbs: { enabled: false } } }, isLoading: false, isError: false, refetch: vi.fn() }),
  useWordPressPageResolution: () => ({ data: undefined, isLoading: false, isError: false }),
  useWordPressH1Context: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useWordPressSeoData: () => ({ data: undefined, isLoading: false, isError: false }),
  useLinkTaskRecommendation: () => ({ mutate: vi.fn(), isPending: false }),
  useRecommendationById: () => ({ data: linkedRecommendationData, isLoading: false }),
}))

vi.mock("@/lib/apiService", () => ({
  default: {
    getIssueContext: vi.fn().mockResolvedValue({ success: true, data: null }),
    request: vi.fn(),
    createTask: vi.fn(),
    applyWordPressFix: vi.fn(),
    linkTaskRecommendation: vi.fn(),
    getRecommendationById: vi.fn(),
    discoverSameAs: vi.fn(),
    validateSameAs: vi.fn(),
    previewSameAs: vi.fn(),
    previewSameAsTaskFix: vi.fn(),
    applyWordPressSchemaFix: vi.fn(),
    reverifyWordPressFix: vi.fn(),
    rollbackWordPressFix: vi.fn(),
  },
}))

const PAGE_URL = "https://naxonify.com/contact-us"
const ORG_ID = "https://naxonify.com/#organization"
const FB = "https://www.facebook.com/naxonify"
const LI = "https://www.linkedin.com/company/naxonify"
const FP = "b".repeat(64)

// Exactly what the AI used to say when no profile URL exists in its context — it must never reach the person as a "recommended version".
const NO_URL_RECOMMENDATION = "not provided in context — the site owner must supply their own real, verified social profile URLs before this field can be populated"

const CAPABILITIES = {
  connected: true, provider: "rank_math", providerLabel: "Rank Math", providers: ["rank_math"],
  ambiguous: false, bridgeRequired: false, bridgeInstalled: true, bridgeActive: true, bridgeVersionSupported: true,
  capabilities: { title: { read: true, write: true } },
}

const cand = (id, url, platformLabel, over = {}) => ({
  id, url, platform: platformLabel.toLowerCase(), platformLabel, kind: "account", confidence: "high", score: 80, status: "suggested", preselected: true,
  verification: "linked_from_site", reachability: "not_checked", reasons: ["Linked from the footer of the home page."], warnings: [],
  sources: [{ method: "page_link", pageUrl: "https://naxonify.com/", placement: "footer", detail: "Follow" }], ...over,
})
const DISCOVERY = {
  success: true,
  data: {
    generatedAt: "t1", pageUrl: PAGE_URL, siteUrl: "https://naxonify.com/", state: "candidates_discovered",
    entity: { state: "absent", id: ORG_ID, name: "Naxonify", existing: { urls: [], invalid: [], duplicates: [] }, scope: { kind: "site_wide", pagesWithSameEntity: 5, affectedPages: [] } },
    candidates: [cand("c-fb", FB, "Facebook"), cand("c-li", LI, "LinkedIn", { kind: "organization" })],
    rejected: [], conflicts: [], ignored: {}, sources: { schema: { crawledPages: 5 }, pages: [{ url: "https://naxonify.com/", role: "home", status: "ok" }], crawlSocialLinks: 2, integrations: [] },
  },
}
const preview = (urls) => ({
  success: true,
  data: {
    fixType: "organization_same_as", lifecycle: "awaiting_approval", record: null, concurrency: { writes: "read_then_write" }, source: { provider: "rank_math", bridgeVersion: "1.6.0" },
    selection: { urls, removeUrls: [] },
    plan: { status: "ready", fingerprint: FP, preserved: [], blocked: [], notWritten: [], changes: urls.map((u) => ({ field: "sameAs", kind: "add", before: "", after: u, label: "Organization sameAs profile", rankMathOption: "rank-math-options-titles.social_additional_profiles" })) },
    proposedChanges: urls.map((u) => ({ field: "sameAs", kind: "add", label: "Organization sameAs profile", before: "", after: u })),
    validation: { valid: true, errors: [], warnings: [] },
    sameAs: { panelState: "ready_to_apply", scope: { kind: "site_wide", pagesWithSameEntity: 5, affectedPages: [] }, alreadyPresent: [], warnings: [], target: { label: "Rank Math → Titles & Meta → Local SEO → Additional profiles" }, manual: null, additionalSameAs: [], protectedSameAs: [],
      recommendedJsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", "@id": ORG_ID, sameAs: urls }, null, 2), beforeJsonLd: "{}" },
  },
})

function renderView(initialMode = "ai") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueDetailView
        issue={{ issue_code: "sameas_array", title: "Organization schema missing sameAs array", affected_urls: [PAGE_URL] }}
        initialSelUrl={PAGE_URL}
        initialMode={initialMode}
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  wpCapabilitiesData = CAPABILITIES
  taskMapData = { [PAGE_URL]: { _id: "task-1", status: "task_created", recommendationId: "rec-1" } }
  linkedRecommendationData = { data: { _id: "rec-1", ruleId: "sameas_array", sections: { recommendedVersion: NO_URL_RECOMMENDATION, contentRewrite: { optimized: NO_URL_RECOMMENDATION } } } }
  apiService.discoverSameAs.mockResolvedValue(DISCOVERY)
  apiService.previewSameAsTaskFix.mockImplementation(async (_t, { urls }) => preview(urls))
  apiService.previewSameAs.mockImplementation(async (_p, _u, { urls }) => preview(urls))
  apiService.createTask.mockResolvedValue({ success: true, data: { _id: "task-2" } })
})

describe("IssueDetailView — sameAs: profile links are discovered, reviewed, then approved", () => {
  test("the AI Recommendation tab runs discovery for the selected page and lists what the site itself shows", async () => {
    renderView()
    expect(await screen.findByTestId("sameas-panel")).toBeInTheDocument()
    expect(apiService.discoverSameAs).toHaveBeenCalledWith("project-1", PAGE_URL)
    expect(await screen.findByTestId("sameas-entry-c-fb")).toBeInTheDocument()
    expect(within(screen.getByTestId("sameas-entry-c-li")).getByRole("checkbox")).toBeChecked()
    expect(apiService.applyWordPressSchemaFix).not.toHaveBeenCalled()
  })

  test("the AI's 'not provided in context' text never reaches the panel", async () => {
    renderView()
    await screen.findByTestId("sameas-entry-c-fb")
    expect(within(screen.getByTestId("sameas-panel")).queryByText(/not provided in context/)).not.toBeInTheDocument()
  })

  test("approving applies exactly the previewed links (fingerprint + urls) and nothing else", async () => {
    apiService.applyWordPressSchemaFix.mockResolvedValue({ success: true, data: { immediateVerification: "success" } })
    renderView()
    fireEvent.click(await screen.findByRole("checkbox", { name: /I approve adding exactly/ }))
    fireEvent.click(screen.getByText("Approve and apply"))
    await waitFor(() => expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledTimes(1))
    expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledWith("task-1", { expectedPlanFingerprint: FP, urls: [FB, LI], removeUrls: [] })
    expect(apiService.applyWordPressFix).not.toHaveBeenCalled() // the older owner-typed path is not used
  })

  test("with no task the person is offered to create it from the panel — nothing is applied", async () => {
    taskMapData = {}
    linkedRecommendationData = null
    renderView()
    expect(await screen.findByTestId("sameas-needs-task")).toHaveTextContent(/Generate the AI recommendation above first/)
    expect(screen.queryByText("Approve and apply")).not.toBeInTheDocument()
    expect(apiService.applyWordPressSchemaFix).not.toHaveBeenCalled()
  })

  test("the DIY tab no longer offers the old URL dialog; it points to the AI Recommendation tab", async () => {
    renderView("diy")
    expect(await screen.findByText(/Use the Organization profile links panel on the AI Recommendation tab/)).toBeInTheDocument()
    expect(screen.queryByText("Apply via WordPress")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Add social profiles to Organization schema" })).not.toBeInTheDocument()
    expect(screen.queryByText(/no manual editing required/)).not.toBeInTheDocument()
  })

  test("an unsupported source is explained with manual steps — no Apply button", async () => {
    apiService.previewSameAsTaskFix.mockImplementation(async (_t, { urls }) => {
      const base = preview(urls)
      return { ...base, data: { ...base.data, plan: { ...base.data.plan, status: "unsupported", code: "PROVIDER_NOT_SUPPORTED", message: "Organization sameAs can only be changed through Rank Math. This site uses yoast.", changes: [] }, proposedChanges: [], sameAs: { ...base.data.sameAs, panelState: "unsupported_source", manual: { provider: "yoast", steps: ["In WordPress go to Yoast SEO → Settings → Site representation → Social profiles."] } } } }
    })
    renderView()
    expect(await screen.findByTestId("sameas-unsupported")).toHaveTextContent("Yoast SEO")
    expect(screen.queryByText("Approve and apply")).not.toBeInTheDocument()
  })
})
