import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueRecommendationPanel from "./IssueRecommendationPanel"
import apiService from "@/lib/apiService"

vi.mock("./RecommendationCodeBlock", () => ({ default: ({ content }) => <pre data-testid="code-block">{content}</pre> }))
vi.mock("./RecommendationDiffViewer", () => ({ default: () => null }))
vi.mock("./RecommendationLoadingState", () => ({ default: () => <div>loading</div> }))
vi.mock("@/lib/apiService", () => ({
  default: { discoverBreadcrumbs: vi.fn(), regenerateBreadcrumbHierarchy: vi.fn(), createTask: vi.fn(), updateTaskStatus: vi.fn(), request: vi.fn() },
}))

/**
 * Breadcrumb DISCOVERY inside the real recommendation panel: the page's own trail is reused, suggestions need confirmation, the manual form
 * remains the fallback, and a page that already outputs a valid BreadcrumbList is never offered a second one. Only the network is mocked.
 */

const ORIGIN = "https://acme.example"
const CRAWL = `${ORIGIN}/services/local-seo`
const CANON = `${ORIGIN}/services/local-seo/`
const evidenceMeta = { source: "claude", schemaEvidence: { kinds: ["breadcrumb"], url: { display: CANON, trusted: true, source: "canonical_tag", crawlKey: CRAWL }, breadcrumb: { status: "unknown", needsInput: true, items: [], existingTrails: [], userProvided: null, conflict: null } } }
const recommendation = { id: "rec-1", ruleId: "breadcrumblist_schema", severity: "medium", sections: { whyThisMatters: "Breadcrumbs matter.", recommendedVersion: "enabled", implementationExample: { type: "html", content: "<!-- ODITO: hierarchy could not be verified -->" } } }
const mutationState = { isIdle: false, isPending: false, isSuccess: true, isError: false, recommendation, meta: evidenceMeta }

const it_ = (name, url, origin, extra = {}) => ({ name, url, origin, needsUrl: !url, needsConfirmation: false, evidence: `evidence for ${name}`, ...extra })
const trail = (status, items, extra = {}) => ({ source: "dom", sources: ["dom"], status, items, evidence: ["The page shows this breadcrumb navigation."], warnings: [], ...extra })
const discovery = (status, recommended, extra = {}) => ({ success: true, data: { generatedAt: "t1", pageUrl: CRAWL, siteRoot: `${ORIGIN}/`, isHomePage: false, status, canonical: { url: CANON, trusted: true, source: "canonical_tag" }, recommended, trails: recommended ? [recommended] : [], current: { url: CANON, name: "Local SEO" }, existing: { count: 0, lists: [] }, conflict: null, staleFinding: false, notes: [], saved: null, sources: { crawl: { pagesConsidered: 5, hasBreadcrumbJsonLd: false }, fetched: [{ key: "page", url: CRAWL, status: "ok" }, { key: "home", url: `${ORIGIN}/`, status: "ok" }], parentCandidates: [] }, ...extra } })

const VERIFIED = discovery("verified", trail("verified", [it_("Home", `${ORIGIN}/`, "markup"), it_("Services", `${ORIGIN}/services/`, "markup"), it_("Local SEO", CANON, "current")]))
const INCOMPLETE = discovery("incomplete", trail("incomplete", [
  it_("Home", `${ORIGIN}/`, "home", { needsConfirmation: true }),
  it_("White Label Services", null, "navigation", { urlSuggestion: { url: `${ORIGIN}/white-label-services/`, evidence: 'A page on your site is titled "White Label Services".' } }),
  it_("Local SEO", CANON, "current"),
], { source: "navigation", warnings: ["White Label Services has no page URL in the menu, so Odito cannot link it."] }))

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <IssueRecommendationPanel projectId="p1" issueId="breadcrumblist_schema" selUrl={CRAWL} issue={{ title: "Breadcrumb schema missing", category: "Schema", severity: "medium" }} mutationState={mutationState} onGenerate={vi.fn()} onReset={vi.fn()} />
    </QueryClientProvider>,
  )
}
const state = () => screen.findByTestId("breadcrumb-discovery")
const inState = (name) => waitFor(() => expect(screen.getByTestId("breadcrumb-discovery")).toHaveAttribute("data-state", name))
const names = () => screen.getAllByLabelText("Page name").map((i) => i.value)
const urls = () => screen.getAllByLabelText("Page URL").map((i) => i.value)

beforeEach(() => { vi.clearAllMocks() })

describe("a trail the page already shows is reused — the owner does not retype it", () => {
  test("the form starts from the verified trail with 'Found on your site' chips and the evidence; the last row is the verified canonical", async () => {
    apiService.discoverBreadcrumbs.mockResolvedValue(VERIFIED)
    renderPanel()
    await waitFor(() => expect(names()).toEqual(["Home", "Services", "Local SEO"]))
    expect(urls()).toEqual([`${ORIGIN}/`, `${ORIGIN}/services/`, CANON])
    expect(apiService.discoverBreadcrumbs).toHaveBeenCalledWith("p1", CRAWL)
    await inState("verified")
    expect(screen.getByTestId("breadcrumb-discovery-text")).toHaveTextContent("Your page already shows this trail")
    expect(screen.getAllByTestId("breadcrumb-origin").map((e) => e.textContent)).toEqual(["Found on your site", "Found on your site"])
    expect(screen.getAllByTestId("breadcrumb-evidence")[0]).toHaveTextContent("evidence for Home")
    expect(screen.getByTestId("breadcrumb-discovery-sources")).toHaveTextContent("Looked at 2 pages")
    expect(apiService.regenerateBreadcrumbHierarchy).not.toHaveBeenCalled() // nothing is generated until the owner confirms
  })

  test("generating sends the trail with each row's origin; editing a discovered row marks it 'edited'", async () => {
    apiService.discoverBreadcrumbs.mockResolvedValue(VERIFIED)
    apiService.regenerateBreadcrumbHierarchy.mockResolvedValue({ success: false, message: "stop" })
    renderPanel()
    await waitFor(() => expect(names()).toHaveLength(3))
    fireEvent.change(screen.getAllByLabelText("Page name")[1], { target: { value: "Our Services" } })
    expect(screen.getAllByTestId("breadcrumb-origin").map((e) => e.textContent)).toEqual(["Found on your site", "Edited by you"])
    fireEvent.click(screen.getByRole("button", { name: "Generate BreadcrumbList" }))
    await waitFor(() => expect(apiService.regenerateBreadcrumbHierarchy).toHaveBeenCalledTimes(1))
    expect(apiService.regenerateBreadcrumbHierarchy.mock.calls[0][0].items).toEqual([
      { name: "Home", url: `${ORIGIN}/`, origin: "discovered" }, { name: "Our Services", url: `${ORIGIN}/services/`, origin: "edited" }, { name: "Local SEO", url: CANON, origin: "discovered" },
    ])
  })

  test("what the person has already typed is never overwritten when discovery arrives later", async () => {
    let resolve
    apiService.discoverBreadcrumbs.mockImplementation(() => new Promise((r) => { resolve = r }))
    renderPanel()
    fireEvent.change(screen.getAllByLabelText("Page name")[0], { target: { value: "My own home" } })
    await waitFor(() => expect(apiService.discoverBreadcrumbs).toHaveBeenCalled())
    resolve(VERIFIED)
    await inState("verified")
    expect(names()[0]).toBe("My own home")
    expect(names()).toHaveLength(2)
  })
})

describe("suggested and incomplete trails need the owner", () => {
  test("a menu heading with no page stays EMPTY, is asked for, and offers a URL suggestion the owner can accept; the home row says it needs confirming", async () => {
    apiService.discoverBreadcrumbs.mockResolvedValue(INCOMPLETE)
    renderPanel()
    await waitFor(() => expect(names()).toEqual(["Home", "White Label Services", "Local SEO"]))
    expect(urls()).toEqual([`${ORIGIN}/`, "", CANON])
    await inState("incomplete")
    expect(screen.getAllByTestId("breadcrumb-origin").map((e) => e.textContent)).toEqual(["Suggested — confirm", "Suggested — confirm"])
    expect(screen.getByText(/has no page URL in the menu/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("breadcrumb-url-suggestion"))
    expect(urls()[1]).toBe(`${ORIGIN}/white-label-services/`)
    expect(screen.queryByTestId("breadcrumb-url-suggestion")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("breadcrumb-origin")[1]).toHaveTextContent("Edited by you")
  })

  test("submitting with the missing URL still empty is refused on that row — nothing is sent", async () => {
    apiService.discoverBreadcrumbs.mockResolvedValue(INCOMPLETE)
    renderPanel()
    await waitFor(() => expect(names()).toHaveLength(3))
    fireEvent.click(screen.getByRole("button", { name: "Generate BreadcrumbList" }))
    expect(await screen.findByText("Page URL is required.")).toBeInTheDocument()
    expect(apiService.regenerateBreadcrumbHierarchy).not.toHaveBeenCalled()
  })
})

describe("manual fallback", () => {
  test("not_found: an empty form, a short honest sentence, and the explicit promise not to guess", async () => {
    apiService.discoverBreadcrumbs.mockResolvedValue(discovery("not_found", null))
    renderPanel()
    await inState("not_found")
    expect(screen.getByTestId("breadcrumb-discovery-text")).toHaveTextContent("No reliable breadcrumb trail was found")
    expect(screen.getByText(/will not guess your parent pages/)).toBeInTheDocument()
    expect(names()).toEqual(["", ""])
    expect(urls()[1]).toBe(CANON)
    expect(screen.queryByTestId("breadcrumb-origin")).not.toBeInTheDocument()
  })

  test("the lookup failing leaves the manual form fully usable", async () => {
    apiService.discoverBreadcrumbs.mockRejectedValue(new Error("down"))
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("breadcrumb-discovery")).toHaveAttribute("data-state", "unavailable"))
    expect(screen.getByRole("button", { name: "Generate BreadcrumbList" })).toBeEnabled()
    expect(names()).toEqual(["", ""])
  })

  test("'Look again' asks the server to bypass its memo", async () => {
    apiService.discoverBreadcrumbs.mockResolvedValue(discovery("not_found", null))
    renderPanel()
    await state()
    apiService.discoverBreadcrumbs.mockResolvedValue(VERIFIED)
    fireEvent.click(screen.getByRole("button", { name: /Look again/ }))
    await waitFor(() => expect(apiService.discoverBreadcrumbs).toHaveBeenLastCalledWith("p1", CRAWL, { refresh: true }))
  })
})

describe("a page that already has a BreadcrumbList is never offered a second one", () => {
  test("already_valid: the existing trail is shown, there is NO form and NO generate button, and the finding is said to leave on the next analysis", async () => {
    apiService.discoverBreadcrumbs.mockResolvedValue(discovery("already_valid", trail("already_valid", [it_("Home", `${ORIGIN}/`, "markup"), it_("Local SEO", CANON, "markup")], { source: "json_ld" }), { staleFinding: true }))
    renderPanel()
    await inState("already_valid")
    expect(screen.getByTestId("breadcrumb-existing-trail")).toHaveTextContent("Local SEO")
    expect(screen.getByTestId("breadcrumb-discovery-text")).toHaveTextContent(/nothing to add/)
    expect(screen.queryByTestId("breadcrumb-hierarchy-form")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Generate BreadcrumbList" })).not.toBeInTheDocument()
  })

  test("conflict (invalid or duplicated BreadcrumbList): explained with the problems, no form", async () => {
    apiService.discoverBreadcrumbs.mockResolvedValue(discovery("conflict", null, { conflict: { kind: "multiple_lists", problems: ["duplicate_url", "position_not_sequential"] } }))
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("breadcrumb-discovery")).toHaveAttribute("data-state", "conflict"))
    expect(within(screen.getByTestId("breadcrumb-discovery")).getByText(/duplicate_url, position_not_sequential/)).toBeInTheDocument()
    expect(screen.queryByTestId("breadcrumb-hierarchy-form")).not.toBeInTheDocument()
  })
})
