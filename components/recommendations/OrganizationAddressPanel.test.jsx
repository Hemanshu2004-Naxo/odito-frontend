import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueRecommendationPanel from "./IssueRecommendationPanel"
import apiService from "@/lib/apiService"

vi.mock("./RecommendationCodeBlock", () => ({ default: ({ content }) => <pre data-testid="code-block">{content}</pre> }))
vi.mock("./RecommendationDiffViewer", () => ({ default: () => null }))
vi.mock("./RecommendationLoadingState", () => ({ default: () => <div>loading</div> }))
vi.mock("@/lib/apiService", () => ({ default: { regenerateBreadcrumbHierarchy: vi.fn(), confirmOrganizationAddress: vi.fn(), createTask: vi.fn(), updateTaskStatus: vi.fn(), request: vi.fn() } }))

/**
 * The Fix-with-AI panel for "Organization has no address", rendered through the REAL IssueRecommendationPanel with the contract the
 * server sends. TEST DATA ONLY: fictional business and address.
 */

const PAGE = "https://eye-hospital.example"
const ORG_ID = "https://eye-hospital.example/#organization"
const ADDR = { streetAddress: "14 Lakeview Road", addressLocality: "Rivertown", addressRegion: "Karnataka", postalCode: "560001", addressCountry: "IN" }
const BEFORE = { "@type": "Organization", "@id": ORG_ID, name: "Eye Hospital Test Site", url: "https://eye-hospital.example/" }
const AFTER = { ...BEFORE, address: { "@type": "PostalAddress", ...ADDR } }
const LINES = [
  { type: "context", text: "{" },
  { type: "context", text: '  "@type": "Organization",' },
  { type: "context", text: `  "@id": "${ORG_ID}",` },
  { type: "context", text: '  "name": "Eye Hospital Test Site",' },
  { type: "context", text: '  "url": "https://eye-hospital.example/",' },
  { type: "add", text: '  "address": {' },
  { type: "add", text: '    "@type": "PostalAddress",' },
  { type: "add", text: '    "streetAddress": "14 Lakeview Road",' },
  { type: "add", text: "  }" },
  { type: "context", text: "}" },
]

const cand = (over = {}) => ({ id: "a1", source: "site_entity_markup", sourceLabel: "x", trust: "site_markup", kind: "organization", fields: ADDR, formatted: "14 Lakeview Road, Rivertown, Karnataka, 560001, IN", structured: true, complete: true, missing: [], pageUrl: `${PAGE}/contact`, detail: null, note: null, ...over })

const fixOf = (state, over = {}) => ({
  version: 1, kind: "organization_address", issue: { id: "organization_schema", ruleId: "organization_schema" }, context: { projectId: "p1", pageUrl: PAGE },
  entity: { id: ORG_ID, types: ["Organization"], present: true }, missingProperty: "address",
  currentState: { addressState: "missing", present: false, fields: {}, missingParts: [], confirmedByEvidence: true },
  evidence: { candidates: [], alternatives: [], suggestion: null, notes: [] },
  proposal: null, state, action: "x", reasonCode: null, message: null, requiresApproval: true, modifiesWebsite: false,
  verification: { requires: ["the page is re-crawled"] }, diff: null, validation: { valid: true, errors: [] }, ...over,
})
const readyFix = (over = {}) => fixOf("ready", {
  evidence: { candidates: [cand()], alternatives: [], suggestion: null, notes: [] },
  proposal: { property: "address", value: { "@type": "PostalAddress", ...ADDR }, formatted: "14 Lakeview Road, Rivertown, Karnataka, 560001, IN", fieldSources: Object.fromEntries(Object.keys(ADDR).map((k) => [k, "site_entity_markup"])), sources: ["site_entity_markup"], status: "verified", confidence: "high", completes: null },
  diff: { before: BEFORE, after: AFTER, changes: [{ path: "address", kind: "add", before: null, after: AFTER.address }], lines: LINES },
  ...over,
})

const intent = (over = {}) => ({ intent: "organization_schema", action: "generate", mode: "extend_existing", type: "Organization", types: ["Organization"], scope: "homepage", placement: "this_page", addressDemand: true, reasons: ["The entity has no address property."], notes: [], missing: [], optional: [], id: ORG_ID, reuse: null, delta: [{ field: "address", kind: "add" }], ...over })
const metaOf = (fix, i = intent()) => ({ source: "template", schemaEvidence: { kinds: ["organization"], url: { display: PAGE }, organization: { present: true, intent: i, name: { value: "Eye Hospital Test Site", source: "existing_organization_schema" }, factSources: {}, businessProfile: null, logo: { status: "none", verifiedUrl: null }, addressFix: fix } } })
const MERGED = '<!-- ODITO: REPLACE your existing block -->\n<script type="application/ld+json">{"@id":"x","address":{}}</script>'
const rec = () => ({
  id: "r1", ruleId: "organization_schema", severity: "low",
  sections: { whyThisMatters: "A published postal address ties the business to a real place.", recommendedFix: "1. What is missing…", recommendedVersion: "{}", implementationExample: { type: "html", content: MERGED } },
  changeSummary: { items: [{ field: "address", changeType: "add", before: "Not on the existing entity", after: "14 Lakeview Road", reason: "r", priority: "medium" }] },
})
const state = (fix, i) => ({ isIdle: false, isPending: false, isSuccess: true, isError: false, recommendation: rec(), meta: metaOf(fix, i) })

function renderPanel(fix, { onCreateTask = vi.fn(), intentOver } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueRecommendationPanel projectId="p1" issueId="organization_schema" selUrl={PAGE} issue={{ title: "Organization schema incomplete", category: "Schema", severity: "low" }}
        mutationState={state(fix, intent(intentOver))} onGenerate={vi.fn()} onReset={vi.fn()} onCreateTask={onCreateTask} />
    </QueryClientProvider>,
  )
}
const panel = () => screen.getByTestId("org-address-panel")

beforeEach(() => { vi.clearAllMocks() })

describe("READY: a verified address, a minimal change, an explicit approval path", () => {
  test("explains the missing property, shows the exact value with its source per field, and the evidence", () => {
    renderPanel(readyFix())
    const p = panel()
    expect(p).toHaveAttribute("data-state", "ready")
    expect(within(p).getByTestId("address-missing")).toHaveTextContent(/Add the address property to your existing Organization entity/)
    expect(within(p).getByTestId("address-missing")).toHaveTextContent(ORG_ID)
    expect(within(p).getByTestId("address-missing")).toHaveTextContent("It currently has no address")
    expect(within(p).getByTestId("address-missing")).toHaveTextContent("confirmed from the markup ODITO crawled")
    expect(within(p).getByTestId("address-state-chip")).toHaveTextContent("Ready to review")
    const proposal = within(p).getByTestId("address-proposal")
    expect(proposal).toHaveTextContent("Verified")
    expect(within(proposal).getByTestId("address-field-streetAddress")).toHaveTextContent("14 Lakeview Road")
    expect(within(proposal).getByTestId("address-field-streetAddress")).toHaveTextContent("the site's Organization markup on another page")
    expect(within(proposal).getByTestId("address-field-postalCode")).toHaveTextContent("560001")
    const evidence = within(p).getByTestId("address-evidence")
    expect(within(evidence).getByTestId("address-candidate")).toHaveTextContent("From the site's Organization markup on another page")
    expect(within(evidence).getByTestId("address-candidate")).toHaveTextContent("Published on your site")
  })

  test("Before vs after: ONLY the address lines are highlighted as added; nothing is removed; the rest is shown dimmed", () => {
    renderPanel(readyFix())
    const diff = screen.getByTestId("address-diff")
    const added = diff.querySelectorAll('[data-diff="add"]')
    expect(added.length).toBe(4)
    expect(added[0]).toHaveTextContent('"address": {')
    expect(diff.querySelectorAll('[data-diff="remove"]').length).toBe(0)
    expect(diff.querySelectorAll('[data-diff="context"]').length).toBe(6)
    expect(screen.getByTestId("address-diff-summary")).toHaveTextContent("keeps its @id, its type and every other property")
    expect(diff).toHaveTextContent("added:")
  })

  test("offers Review & Apply — not Confirm Address — and says generating it does not modify the website; approval comes first", () => {
    renderPanel(readyFix())
    expect(screen.getByRole("button", { name: "Review & Apply" })).toBeInTheDocument()
    expect(screen.queryByTestId("address-confirm-form")).not.toBeInTheDocument()
    expect(screen.getByTestId("address-approval-note")).toHaveTextContent("Nothing is written until you approve it")
    expect(screen.getByTestId("schema-not-deployed")).toHaveTextContent("does not modify your website")
  })

  test("Review & Apply without a WordPress fix panel explains what is needed instead of pretending; with one it scrolls to it", () => {
    renderPanel(readyFix())
    fireEvent.click(screen.getByTestId("address-review-apply"))
    expect(screen.getByTestId("address-apply-hint")).toHaveTextContent("create a task from this recommendation")

    const target = document.createElement("section")
    target.setAttribute("data-testid", "organization-fix-panel")
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)
    fireEvent.click(screen.getByTestId("address-review-apply"))
    expect(target.scrollIntoView).toHaveBeenCalled()
    expect(screen.queryByTestId("address-apply-hint")).not.toBeInTheDocument()
    target.remove()
  })

  test("the manual path shows the merged entity and says to replace, not add", () => {
    renderPanel(readyFix())
    const manual = screen.getByTestId("address-manual")
    expect(manual).toHaveTextContent("Apply it manually instead")
    expect(within(manual).getByTestId("code-block")).toHaveTextContent("REPLACE your existing block")
  })

  test("a task can be created for a READY recommendation, and the Existing-entity-is-reused text is gone", () => {
    renderPanel(readyFix())
    expect(screen.getByRole("button", { name: /Create Task/ })).toBeInTheDocument()
    expect(screen.queryByText(/Existing entity is reused/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId("schema-reuse")).not.toBeInTheDocument()
  })

  test("completing an incomplete address says the existing parts are kept", () => {
    renderPanel(readyFix({ currentState: { addressState: "incomplete", present: true, fields: { addressLocality: "Rivertown" }, missingParts: ["streetAddress"], confirmedByEvidence: true }, proposal: { ...readyFix().proposal, completes: ["streetAddress", "postalCode"] } }))
    expect(screen.getByTestId("address-missing")).toHaveTextContent("incomplete address (missing streetAddress)")
    expect(screen.getByTestId("address-proposal")).toHaveTextContent("The parts the entity already has are kept")
  })
})

describe("Confirm Address — nothing found, or something the owner must settle", () => {
  test("nothing found: no value, no diff, no Apply — a form with required street and city and an honest explanation", () => {
    renderPanel(fixOf("unavailable", { message: "No address was found on your site, in your business profile or in the business details stored in ODITO." }))
    expect(panel()).toHaveAttribute("data-state", "unavailable")
    expect(screen.getByTestId("address-unavailable")).toHaveTextContent("No address can be proposed yet")
    expect(screen.getByTestId("address-evidence")).toHaveTextContent("None of them holds an address")
    expect(screen.queryByTestId("address-proposal")).not.toBeInTheDocument()
    expect(screen.queryByTestId("address-diff")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Review & Apply" })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Street address/)).toHaveAttribute("aria-required", "true")
    expect(screen.getByLabelText(/City \/ locality/)).toHaveAttribute("aria-required", "true")
    expect(screen.getByRole("button", { name: "Confirm Address" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument()
  })

  test("validation: empty and invalid input is refused locally with field messages and sends nothing", () => {
    renderPanel(fixOf("unavailable"))
    fireEvent.click(screen.getByRole("button", { name: "Confirm Address" }))
    expect(screen.getByText("Street address is required")).toBeInTheDocument()
    expect(screen.getByText("City / locality is required")).toBeInTheDocument()
    expect(screen.getByLabelText(/Street address/)).toHaveAttribute("aria-invalid", "true")
    fireEvent.change(screen.getByLabelText(/Street address/), { target: { value: "<script>x</script>" } })
    fireEvent.change(screen.getByLabelText(/City \/ locality/), { target: { value: "Rivertown" } })
    fireEvent.click(screen.getByRole("button", { name: "Confirm Address" }))
    expect(screen.getByText(/Street address contains characters that are not allowed/)).toBeInTheDocument()
    expect(apiService.confirmOrganizationAddress).not.toHaveBeenCalled()
  })

  test("a valid address is sent once (typed => no basisSource), the regenerated recommendation replaces the panel", async () => {
    let release
    apiService.confirmOrganizationAddress.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ success: true, data: rec(), meta: metaOf(readyFix()) }) }))
    renderPanel(fixOf("unavailable"))
    fireEvent.change(screen.getByLabelText(/Street address/), { target: { value: " 14 Lakeview Road " } })
    fireEvent.change(screen.getByLabelText(/City \/ locality/), { target: { value: "Rivertown" } })
    fireEvent.change(screen.getByLabelText(/Postal code/), { target: { value: "560001" } })
    const submit = screen.getByRole("button", { name: "Confirm Address" })
    fireEvent.click(submit)
    fireEvent.click(submit)
    fireEvent.click(submit)
    await screen.findByRole("button", { name: "Confirming…" })
    expect(screen.getByRole("button", { name: "Confirming…" })).toBeDisabled()
    expect(screen.getByLabelText(/Street address/)).toBeDisabled()
    expect(apiService.confirmOrganizationAddress).toHaveBeenCalledTimes(1)
    const [args] = apiService.confirmOrganizationAddress.mock.calls[0]
    expect(args).toMatchObject({ projectId: "p1", pageUrl: PAGE, address: { streetAddress: "14 Lakeview Road", addressLocality: "Rivertown", postalCode: "560001" } })
    expect(args.basisSource).toBeUndefined()
    expect(Object.keys(args.address)).toEqual(["streetAddress", "addressLocality", "postalCode"])
    release()
    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "ready"))
    expect(screen.getByRole("button", { name: "Review & Apply" })).toBeInTheDocument()
    expect(screen.getByTestId("address-diff")).toBeInTheDocument()
  })

  test("a server rejection is shown, the typed values are kept, and nothing is claimed", async () => {
    apiService.confirmOrganizationAddress.mockRejectedValue(Object.assign(new Error("Street address contains characters that are not allowed"), { status: 422 }))
    renderPanel(fixOf("unavailable"))
    fireEvent.change(screen.getByLabelText(/Street address/), { target: { value: "14 Lakeview Road" } })
    fireEvent.change(screen.getByLabelText(/City \/ locality/), { target: { value: "Rivertown" } })
    fireEvent.click(screen.getByRole("button", { name: "Confirm Address" }))
    expect(await screen.findByTestId("address-server-error")).toHaveTextContent("characters that are not allowed")
    expect(screen.getByLabelText(/Street address/)).toHaveValue("14 Lakeview Road")
    expect(panel()).toHaveAttribute("data-state", "unavailable")
    expect(screen.getByRole("button", { name: "Confirm Address" })).toBeEnabled()
  })

  test("conflict: every alternative is shown with its source; Use this prefills; the chosen source is recorded only while unedited", async () => {
    apiService.confirmOrganizationAddress.mockResolvedValue({ success: true, data: rec(), meta: metaOf(readyFix()) })
    const OTHER = { streetAddress: "9 Harbour Street", addressLocality: "Portville", addressRegion: "Goa", postalCode: "403001", addressCountry: "IN" }
    renderPanel(fixOf("conflict", {
      message: "2 different addresses were found.",
      evidence: {
        candidates: [cand({ id: "a1" }), cand({ id: "a2", source: "site_place_markup", kind: "place", fields: OTHER, formatted: "9 Harbour Street, Portville, Goa, 403001, IN" })],
        alternatives: [{ fields: ADDR, formatted: "14 Lakeview Road, Rivertown, Karnataka, 560001, IN", sources: ["site_entity_markup"], kinds: ["organization"] }, { fields: OTHER, formatted: "9 Harbour Street, Portville, Goa, 403001, IN", sources: ["site_place_markup"], kinds: ["place"] }],
        suggestion: null, notes: [],
      },
    }))
    expect(panel()).toHaveAttribute("data-state", "conflict")
    expect(screen.getByTestId("address-state-chip")).toHaveTextContent("Addresses conflict")
    expect(screen.getAllByTestId("address-candidate")).toHaveLength(2)
    const choices = within(screen.getByTestId("address-choices"))
    expect(choices.getByText("14 Lakeview Road, Rivertown, Karnataka, 560001, IN")).toBeInTheDocument()
    expect(choices.getByText("9 Harbour Street, Portville, Goa, 403001, IN")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Review & Apply" })).not.toBeInTheDocument()

    // choose the second one, then edit it: the form no longer matches that source, so no basisSource is sent
    fireEvent.click(within(screen.getByTestId("address-choices")).getAllByRole("button", { name: "Use this" })[1])
    expect(screen.getByLabelText(/Street address/)).toHaveValue("9 Harbour Street")
    fireEvent.change(screen.getByLabelText(/Postal code/), { target: { value: "403002" } })
    fireEvent.click(screen.getByRole("button", { name: "Confirm Address" }))
    await waitFor(() => expect(apiService.confirmOrganizationAddress).toHaveBeenCalledTimes(1))
    expect(apiService.confirmOrganizationAddress.mock.calls[0][0].basisSource).toBeUndefined()
    expect(apiService.confirmOrganizationAddress.mock.calls[0][0].address.postalCode).toBe("403002")
  })

  test("choosing a found structured address UNEDITED records where it came from", async () => {
    apiService.confirmOrganizationAddress.mockResolvedValue({ success: true, data: rec(), meta: metaOf(readyFix()) })
    renderPanel(fixOf("conflict", { evidence: { candidates: [cand({ id: "a1" })], alternatives: [{ fields: ADDR, formatted: "x", sources: ["site_entity_markup"], kinds: ["organization"] }], suggestion: null, notes: [] } }))
    fireEvent.click(screen.getAllByRole("button", { name: "Use this" })[0])
    fireEvent.click(screen.getByRole("button", { name: "Confirm Address" }))
    await waitFor(() => expect(apiService.confirmOrganizationAddress).toHaveBeenCalledTimes(1))
    expect(apiService.confirmOrganizationAddress.mock.calls[0][0]).toMatchObject({ address: ADDR })
  })

  test("only a partial / unverified address was found: it is a SUGGESTION, labelled as such, never published or pre-approved", () => {
    renderPanel(fixOf("needs_confirmation", {
      message: "Addresses were found, but none is complete and verified enough to publish.",
      evidence: {
        candidates: [
          cand({ id: "g", source: "google_business_profile", trust: "verified_integration", kind: "external", fields: { streetAddress: "14 Lakeview Road" }, formatted: "14 Lakeview Road", complete: false, note: "Google stores this as street lines only." }),
          cand({ id: "w", source: "website_extraction", trust: "unverified", kind: "external", fields: {}, formatted: "14 Lakeview Road, Rivertown", structured: false, complete: false }),
        ],
        alternatives: [], suggestion: { fields: { streetAddress: "14 Lakeview Road" }, formatted: "14 Lakeview Road", sources: ["google_business_profile"], partial: true }, notes: [],
      },
    }))
    expect(panel()).toHaveAttribute("data-state", "needs_confirmation")
    expect(screen.getByTestId("address-suggestion")).toHaveTextContent("Found, but incomplete")
    expect(screen.getByTestId("address-suggestion")).toHaveTextContent("ODITO does not fill in the missing parts")
    const [g, w] = screen.getAllByTestId("address-candidate")
    expect(g).toHaveAttribute("data-trust", "ok")
    expect(g).toHaveTextContent("incomplete (needs a street and a city)")
    expect(g).toHaveTextContent("Google stores this as street lines only")
    expect(w).toHaveAttribute("data-trust", "warn")
    expect(w).toHaveTextContent("Not verified — not used as evidence")
    expect(w).toHaveTextContent("free text (not structured)")
    expect(screen.getByLabelText(/Street address/)).toHaveValue("14 Lakeview Road") // prefilled from the suggestion only
    expect(screen.getByLabelText(/City \/ locality/)).toHaveValue("")
    expect(screen.queryByTestId("address-proposal")).not.toBeInTheDocument()
  })
})

describe("Review Changes — the entity is ambiguous or the proposal failed validation", () => {
  test("no Apply, no form, no task; the reasons are shown on request", () => {
    renderPanel(fixOf("needs_review", { message: "This page describes the organization more than once.", validation: { valid: false, errors: ['"streetAddress" is not supported by any verified source'] } }))
    expect(panel()).toHaveAttribute("data-state", "needs_review")
    expect(screen.getByTestId("address-state-chip")).toHaveTextContent("Needs review")
    expect(screen.queryByRole("button", { name: "Review & Apply" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("address-confirm-form")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId("address-review-reasons")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Review Changes" }))
    expect(screen.getByTestId("address-review-reasons")).toHaveTextContent("describes the organization more than once")
    expect(screen.getByTestId("address-review-reasons")).toHaveTextContent("not supported by any verified source")
  })

  test("an INVALID proposal never gets an Apply button, even if the server left a diff or a 'generate' action behind", () => {
    const rejected = fixOf("needs_review", { proposal: { property: "address", value: { "@type": "PostalAddress", streetAddress: "77 Invented Avenue" }, status: "rejected", fieldSources: {} }, diff: { before: BEFORE, after: AFTER, changes: [], lines: LINES }, validation: { valid: false, errors: ["not supported"] } })
    renderPanel(rejected)
    expect(screen.queryByRole("button", { name: "Review & Apply" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("address-proposal")).not.toBeInTheDocument()
    expect(screen.queryByTestId("address-diff")).not.toBeInTheDocument()
    expect(screen.queryByText("77 Invented Avenue")).not.toBeInTheDocument()
  })
})

describe("nothing here claims the website changed", () => {
  test.each([["ready", readyFix()], ["unavailable", fixOf("unavailable")], ["needs_review", fixOf("needs_review")]])("%s: states plainly that this is a recommendation", (_n, fix) => {
    renderPanel(fix)
    expect(screen.getByTestId("schema-not-deployed")).toHaveTextContent("does not modify your website")
    // no success claim of any kind (the notice's own "before it reports anything as fixed" is a promise, not a claim)
    expect(document.body.textContent).not.toMatch(/(?<!nothing )has been (added|applied|fixed|changed)|was (added|applied|fixed)|(is|are) (now )?fixed|applied successfully|successfully (added|applied)|address (was|has been) (saved|published)/i)
  })
})
