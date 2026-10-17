import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, within } from "@testing-library/react"
import IssueRecommendationPanel from "./IssueRecommendationPanel"

vi.mock("./RecommendationCodeBlock", () => ({ default: ({ content }) => <pre data-testid="code-block">{content}</pre> }))
vi.mock("./RecommendationDiffViewer", () => ({ default: () => null }))
vi.mock("./RecommendationLoadingState", () => ({ default: () => <div>loading</div> }))
vi.mock("@/lib/apiService", () => ({ default: { regenerateBreadcrumbHierarchy: vi.fn(), createTask: vi.fn(), updateTaskStatus: vi.fn(), request: vi.fn() } }))

const PAGE = "https://clinic.example/gallery"
const SCRIPT = '<script type="application/ld+json">\n{"@context":"https://schema.org","@type":["Hospital","Organization"],"name":"Clinic Eye Centre"}\n</script>'

const intent = (over = {}) => ({
  intent: "hospital_schema", action: "generate", type: "Hospital", types: ["Hospital", "Organization"], scope: "homepage", placement: "this_page",
  reasons: ["The site's own markup already identifies the business as Hospital."], notes: [], missing: [], optional: ["opening hours"], id: "https://clinic.example/#organization", reuse: null, ...over,
})
const meta = (i, org = {}) => ({ source: "template", schemaEvidence: { kinds: ["organization"], url: { display: PAGE }, organization: { present: false, intent: i, name: { value: "Clinic Eye Centre", source: "og:site_name" }, factSources: { address: "site_entity_markup" }, businessProfile: null, logo: { status: "none", verifiedUrl: null }, ...org } } })
const rec = (content = SCRIPT, extra = {}) => ({
  id: "r1", ruleId: "organization_schema", severity: "low",
  sections: { whyThisMatters: "Organization markup explains who runs the site.", recommendedFix: "1. …", recommendedVersion: "{}", implementationExample: { type: "html", content } },
  changeSummary: { items: [{ field: "Hospital schema (JSON-LD)", changeType: "add", before: "none", after: "Hospital", reason: "r", priority: "medium" }] },
  ...extra,
})
const success = (recommendation, m) => ({ isIdle: false, isPending: false, isSuccess: true, isError: false, recommendation, meta: m })

function renderPanel({ mutationState, issueId = "organization_schema", onCreateTask = vi.fn() } = {}) {
  return render(
    <IssueRecommendationPanel projectId="p1" issueId={issueId} selUrl={PAGE} issue={{ title: "Missing Organization or LocalBusiness Schema", category: "Schema", severity: "low" }}
      mutationState={mutationState} onGenerate={vi.fn()} onReset={vi.fn()} onCreateTask={onCreateTask} />,
  )
}

beforeEach(() => { vi.clearAllMocks(); Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } }) })

describe("organization_schema — the intent is explained, not hidden", () => {
  test("generate: shows the chosen type, why, the validated JSON-LD with Copy, the facts used with sources, and a not-deployed notice", () => {
    renderPanel({ mutationState: success(rec(), meta(intent())) })
    const panel = screen.getByTestId("schema-intent-panel")
    expect(within(panel).getByTestId("schema-type-chip")).toHaveTextContent("Hospital")
    expect(within(panel).getByText("Why Hospital?")).toBeInTheDocument()
    expect(within(panel).getByTestId("schema-reasons")).toHaveTextContent("already identifies the business as Hospital")
    expect(within(panel).getByTestId("code-block")).toHaveTextContent('"@type":["Hospital","Organization"]')
    expect(within(panel).getByRole("button", { name: /Copy JSON-LD/ })).toBeInTheDocument()
    expect(within(panel).getByTestId("schema-facts")).toHaveTextContent("Address")
    expect(within(panel).getByTestId("schema-facts")).toHaveTextContent("the site's existing entity markup")
    expect(within(panel).getByTestId("schema-optional")).toHaveTextContent("opening hours")
    expect(within(panel).getByTestId("schema-not-deployed")).toHaveTextContent("Nothing has been added to your website")
    expect(screen.queryByText("Recommended Version")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Create Task/ })).toBeInTheDocument()
  })

  test("needs_input: asks for the missing detail, shows NO code, and offers no task for something that cannot be implemented yet", () => {
    const i = intent({ intent: "local_business_schema", type: "LocalBusiness", types: ["LocalBusiness"], action: "needs_input", scope: "location_page", missing: [{ field: "address", label: "Street address of the location", why: "A LocalBusiness is a claim of a physical place." }], reasons: ["This is a location page."] })
    renderPanel({ mutationState: success(rec("<!-- ODITO: needs your input: Street address of the location -->"), meta(i, { factSources: {} })) })
    const ask = screen.getByTestId("schema-needs-input")
    expect(ask).toHaveTextContent("Street address of the location")
    expect(ask).toHaveTextContent("No JSON-LD is shown")
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument()
    expect(screen.getByTestId("schema-type-chip")).toHaveTextContent("LocalBusiness")
    expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument()
    expect(screen.queryByText("Change Summary")).not.toBeInTheDocument()
  })

  test("reference: a page that needs no entity of its own is told the site entity is reused — its @id is shown, no code, no task", () => {
    const i = intent({ intent: "schema_already_present", action: "reference", scope: "non_entity_page", reuse: { id: "https://clinic.example/#organization", pageUrl: "https://clinic.example/", reason: "x" }, reasons: ["This is a generic page."] })
    renderPanel({ mutationState: success(rec("<!-- ODITO: no new Hospital markup is needed -->"), meta(i)) })
    const reuse = screen.getByTestId("schema-reuse")
    expect(reuse).toHaveTextContent("No standalone entity needed here")
    expect(reuse).toHaveTextContent("declared once on https://clinic.example/")
    expect(screen.getByTestId("schema-reused-id")).toHaveTextContent("https://clinic.example/#organization")
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument()
  })

  test("reuse on the page itself, and an extended existing entity (only the changed fields are listed)", () => {
    const reuse = intent({ intent: "schema_already_present", action: "reuse", reasons: ["This page already declares Hospital + Organization."] })
    const { unmount } = renderPanel({ mutationState: success(rec("<!-- ODITO: reused -->"), meta(reuse)) })
    expect(screen.getByTestId("schema-reuse")).toHaveTextContent("ODITO keeps it exactly as it is")
    unmount()
    const extend = intent({ mode: "extend_existing", delta: [{ field: "logo", kind: "add" }] })
    renderPanel({ mutationState: success(rec(), meta(extend)) })
    expect(screen.getByTestId("schema-delta")).toHaveTextContent("logo (added)")
    expect(screen.getByText(/merge into your existing markup/)).toBeInTheDocument()
  })

  test("homepage placement and an ignored Business Profile are both explained", () => {
    const i = intent({ intent: "organization_schema", type: "Organization", types: ["Organization"], placement: "homepage", scope: "non_entity_page", notes: ["The connected Google Business Profile lists a different website, so none of its details were used."], optional: [] })
    renderPanel({ mutationState: success(rec(), meta(i)) })
    expect(screen.getByTestId("schema-placement")).toHaveTextContent("Add this to your homepage")
    expect(screen.getByTestId("schema-notes")).toHaveTextContent("different website")
  })

  test("an older response without an intent keeps the generic Recommended Version section", () => {
    renderPanel({ mutationState: success(rec(), { source: "claude", schemaEvidence: { kinds: ["organization"] } }) })
    expect(screen.queryByTestId("schema-intent-panel")).not.toBeInTheDocument()
    expect(screen.getByText("Recommended Version")).toBeInTheDocument()
  })

  test("other issues never get the intent panel", () => {
    renderPanel({ issueId: "title_missing", mutationState: success(rec(), meta(intent())) })
    expect(screen.queryByTestId("schema-intent-panel")).not.toBeInTheDocument()
  })

  test("loading, error and idle states are untouched", () => {
    const { unmount } = renderPanel({ mutationState: { isIdle: false, isPending: true } })
    expect(screen.getByText("loading")).toBeInTheDocument()
    unmount()
    renderPanel({ mutationState: { isIdle: false, isError: true, error: { message: "boom" } } })
    expect(screen.getByText("Generation failed")).toBeInTheDocument()
  })
})
