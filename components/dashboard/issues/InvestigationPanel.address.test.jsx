import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import InvestigationPanel from "./InvestigationPanel"
import { normalizeChecks, checksSummary, stageList, candidateBadge } from "./investigationView"
import apiService from "@/lib/apiService"

vi.mock("@/lib/apiService", () => ({
  default: { startInvestigation: vi.fn(), getInvestigation: vi.fn(), cancelInvestigation: vi.fn(), verifyInvestigation: vi.fn(), prepareInvestigationFix: vi.fn(), approveInvestigation: vi.fn(), confirmInvestigationAddress: vi.fn() },
}))

const PAGE = "https://www.acme.test/"
const chk = (id, label, status, detail, action = null) => ({ id, name: id, label, status, passed: status === "passed", detail, action })
const CHECKS = [
  chk("live_page_inspected", "Live page inspected", "passed", "The live page was fetched."),
  chk("issue_supported_by_evidence", "Issue supported by evidence", "passed", "Evidence E3 supports it."),
  chk("address_confirmed_and_complete", "Address confirmed and complete", "blocked", "No confirmed address.", "Confirm street address and city."),
  chk("entity_identified_once", "Entity identified once", "passed", "One Organization entity."),
  chk("post_change_document_valid", "Document valid after the change", "not_run", "No change was built, so nothing could be validated."),
  chk("markup_syntactically_valid", "Markup is valid", "not_run", "No markup was proposed."),
  chk("no_unresolved_placeholders", "No placeholders", "not_run", "Nothing proposed."),
  chk("concrete_proposal_present", "Concrete proposal present", "blocked", "Waiting for the address.", "Confirm the address."),
]
const addressData = (over = {}) => ({
  analyzerId: "organization_address", operation: "address", status: "needs_confirmation", publishable: false,
  entity: { present: true, id: "https://www.acme.test/#organization", publishedBy: "rank_math" },
  existingAddress: { state: "missing" },
  guidance: { auditRule: "Audit rule flags an Organization with no address.", schemaOrg: "address is OPTIONAL on schema.org.", searchEngines: "Google lists address as recommended, not required." },
  candidates: [{ id: "c1", source: "verified_business", sourceLabel: "the business you selected when creating this project (Google Places)", trust: "unverified", trustLabel: "Unverified — suggestion only", usable: false, notUsableBecause: "it lists no website, so it cannot be tied to this one", fields: { addressLocality: "new york" }, formatted: "new york" }],
  confirmation: { state: "none" }, rankMathRoute: { applicable: true, reason: "This is a LIKELY route: not confirmed." }, ...over,
})
const result = (over = {}) => ({
  investigationStatus: "complete", issueStatus: "confirmed", confidence: { score: 0.8, label: "high" }, summary: "The Organization entity has no address.",
  evidence: [], rootCause: { description: "No address published." }, recommendedSolution: { method: "manual", strategy: "Confirm the address, then add it.", routeNote: "LIKELY route: Rank Math, Titles and Meta, Local SEO." },
  implementationPlan: [], proposedChanges: [], codeOrConfiguration: [], risks: [], validationPlan: [], limitations: [], additionalEvidenceRequested: [],
  automaticFixEligibility: { eligible: false, eligibility: "requires_integration_setup", reason: "Blocked.", requirements: [{ code: "CONFIRMED_COMPLETE_INPUT", label: "A confirmed, complete address", met: false }, { code: "USER_APPROVAL", label: "Your approval", met: false }] },
  requiresHumanApproval: false, missingCapabilities: [],
  lifecycle: { recommendationGenerated: true, fixProposed: false, fixApplied: false, fixVerified: false, verificationStatus: "not_started",
    stages: { recommendation: { state: "generated" }, proposal: { state: "awaiting_information", blockers: [] }, approval: { state: "blocked" }, application: { state: "not_started" }, verification: { state: "not_started" } } },
  proposal: { fingerprint: "ab".repeat(32), hasProposal: false },
  findings: [], safetyChecks: CHECKS, reviewItems: [],
  analyses: [{ evidenceId: "E7", analyzerId: "organization_address", summary: "s", data: addressData() }],
  blockers: [{ code: "ADDRESS_UNCONFIRMED", message: "The business address is unknown.", action: "Confirm street address and city.", category: "information" }],
  discardedModelProposal: [], ...over,
})
const inv = (r = result(), over = {}) => ({ id: "inv1", issueId: "organization_schema", pageUrl: PAGE, status: "completed", stage: "completed", progress: [], planFamily: "structured_data", promptVersion: "1.2.0", evidence: [], result: r, warnings: [], error: null, ...over })

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><InvestigationPanel projectId="p1" issueId="organization_schema" pageUrl={PAGE} ruleMetadata={{ title: "x" }} /></QueryClientProvider>)
}
async function openResult(r) {
  apiService.startInvestigation.mockResolvedValue({ success: true, data: inv(r) })
  apiService.getInvestigation.mockResolvedValue({ success: true, data: inv(r) })
  renderPanel()
  fireEvent.click(screen.getByTestId("investigation-start"))
  return screen.findByTestId("investigation-result")
}
beforeEach(() => { vi.clearAllMocks() })

describe("view helpers", () => {
  test("normalizeChecks: every check keeps a label, status and explanation; junk is dropped; legacy shape works", () => {
    const list = normalizeChecks([null, "x", { passed: true }, { name: "no_duplicate_markup", passed: false, detail: "" }, { id: "a", status: "not_run" }, { id: "b", status: "weird", passed: true, label: "  ", detail: "d" }])
    expect(list).toHaveLength(4)
    for (const c of list) { expect(c.label.length).toBeGreaterThan(0); expect(c.detail.length).toBeGreaterThan(0); expect(["passed", "failed", "blocked", "not_run"]).toContain(c.status) }
    expect(list[1].label).toBe("No duplicate markup")
    expect(list[1].status).toBe("failed")
    expect(list[2].status).toBe("not_run")
    expect(normalizeChecks(undefined)).toEqual([])
    expect(normalizeChecks({})).toEqual([])
  })
  test("checksSummary is computed from the same records", () => {
    const s = checksSummary(CHECKS)
    expect([s.total, s.passed, s.blocked, s.notRun, s.failed]).toEqual([8, 3, 2, 3, 0])
    expect(s.text).toBe("3 passed · 2 blocked · 3 not run (of 8)")
    expect(checksSummary([]).text).toBe("No checks recorded")
  })
  test("stageList reads only the server's stages; no stages -> null (legacy fallback)", () => {
    expect(stageList(undefined)).toBeNull()
    expect(stageList({ fixApplied: true })).toBeNull()
    const st = stageList({ stages: { recommendation: { state: "generated" }, proposal: { state: "awaiting_information" }, approval: { state: "blocked" }, application: { state: "failed", failure: { message: "x" } }, verification: { state: "not_started" } } })
    expect(st.map((x) => x.label)).toEqual(["Recommendation generated", "Waiting for information from you", "Approval not possible yet", "Application failed", "Not verified"])
    expect(st[3].tone).toBe("bad")
  })
  test("candidateBadge: an unusable candidate is never shown as verified", () => {
    expect(candidateBadge({ usable: false, trustLabel: "Unverified — suggestion only" })).toEqual({ label: "Unverified — suggestion only", tone: "warn" })
    expect(candidateBadge({ usable: false }).label).toMatch(/Unverified/)
  })
})

describe("address remediation UI", () => {
  test("blocked / awaiting information: blockers, route as LIKELY, no code, no prepare button, awaiting stage", async () => {
    await openResult()
    expect(screen.getByTestId("investigation-blocker")).toHaveTextContent("ADDRESS_UNCONFIRMED")
    expect(screen.getByTestId("investigation-notice")).toHaveTextContent("Confirm street address and city.")
    // shown once: the technical list excludes the blocker already shown in the notice
    expect(document.querySelectorAll('[data-code="ADDRESS_UNCONFIRMED"]')).toHaveLength(2) // notice wrapper + its code marker
    expect(within(screen.getByTestId("investigation-technical")).queryByText("ADDRESS_UNCONFIRMED")).toBeNull()
    expect(screen.queryByTestId("investigation-code-section")).toBeNull()
    expect(screen.queryByTestId("investigation-prepare")).toBeNull()
    expect(screen.getByTestId("investigation-route-note")).toHaveTextContent("LIKELY route")
    expect(screen.getByTestId("stage-proposal")).toHaveAttribute("data-state", "awaiting_information")
    expect(screen.getByTestId("stage-application")).toHaveTextContent("Not applied")
    expect(screen.getByTestId("stage-verification")).toHaveTextContent("Not verified")
    expect(screen.getByTestId("investigation-requirements")).toHaveTextContent("0/2 met")
  })

  test("all eight checks are rendered with name, status, explanation and action; the summary matches; not-run checks are not shown as passed", async () => {
    await openResult()
    const items = screen.getAllByTestId("investigation-check")
    expect(items).toHaveLength(8)
    for (const li of items) { expect(li.textContent.trim().length).toBeGreaterThan(15) }
    expect(screen.getAllByTestId("investigation-checks-summary")[0]).toHaveTextContent("3 passed · 2 blocked · 3 not run (of 8)")
    const notRun = items.filter((li) => li.getAttribute("data-status") === "not_run")
    expect(notRun).toHaveLength(3)
    for (const li of notRun) { expect(li).toHaveAttribute("data-passed", "false"); expect(li).toHaveTextContent("Not run") }
    const blocked = items.find((li) => li.getAttribute("data-status") === "blocked")
    expect(blocked).toHaveTextContent("What to do: Confirm street address and city.")
    expect(document.querySelectorAll("li:empty").length).toBe(0)
  })

  test("degenerate checks (missing label/detail, junk entries) still render readable rows, never empty bullets", async () => {
    await openResult(result({ safetyChecks: [null, { name: "no_duplicate_markup", passed: false }, { id: "x", status: "not_run" }, 7] }))
    const items = screen.getAllByTestId("investigation-check")
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent("No duplicate markup")
    expect(items[0]).toHaveTextContent("No explanation was recorded.")
    expect(items[1]).toHaveTextContent("This check was not run.")
    expect(screen.getByTestId("investigation-checks-summary")).toHaveTextContent("0 passed · 1 failed · 1 not run (of 2)")
  })

  test("no checks at all: nothing is rendered rather than an empty details", async () => {
    await openResult(result({ safetyChecks: undefined }))
    expect(screen.queryByTestId("investigation-safety")).toBeNull()
  })

  test("evidence provenance: the Places result is labelled Unverified with the reason and is never presented as authoritative", async () => {
    await openResult()
    const cand = screen.getByTestId("address-candidate")
    expect(cand).toHaveAttribute("data-usable", "false")
    expect(cand).toHaveTextContent("Unverified — suggestion only")
    expect(cand).toHaveTextContent("Google Places")
    expect(cand).toHaveTextContent("it lists no website")
    const ev = screen.getByTestId("address-evidence")
    expect(ev).toHaveTextContent("Observed")
    expect(ev).toHaveTextContent("published by Rank Math")
    expect(ev).toHaveTextContent("The entity has no address property.")
    expect(screen.getByTestId("address-guidance")).toHaveTextContent("OPTIONAL")
    expect(screen.getByTestId("address-guidance")).toHaveTextContent("recommended, not required")
  })

  test("the confirmation form needs street + city, never auto-fills other fields, sends only what was typed and then re-runs the investigation", async () => {
    apiService.confirmInvestigationAddress.mockResolvedValue({ success: true, data: { confirmed: true } })
    await openResult()
    const submit = screen.getByTestId("address-confirm")
    expect(submit).toBeDisabled()
    fireEvent.click(within(screen.getByTestId("address-candidate")).getByText("Use this as a starting point"))
    expect(screen.getByLabelText("City *")).toHaveValue("new york")
    expect(screen.getByLabelText("Street address *")).toHaveValue("")
    expect(screen.getByLabelText("Postal code")).toHaveValue("")
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Street address *"), { target: { value: "  12 Harbour Road " } })
    fireEvent.change(screen.getByLabelText("City *"), { target: { value: "Mumbai" } })
    expect(submit).not.toBeDisabled()
    expect(screen.getByTestId("address-form")).toHaveTextContent("does not approve or change anything on your website")
    fireEvent.click(submit)
    await waitFor(() => expect(apiService.confirmInvestigationAddress).toHaveBeenCalledWith("p1", "inv1", { streetAddress: "12 Harbour Road", addressLocality: "Mumbai" }, null))
    await waitFor(() => expect(apiService.startInvestigation).toHaveBeenCalledTimes(2))
    expect(apiService.prepareInvestigationFix).not.toHaveBeenCalled()
    expect(apiService.approveInvestigation).not.toHaveBeenCalled()
  })

  test("a rejected confirmation shows the server's message and does not re-run", async () => {
    apiService.confirmInvestigationAddress.mockResolvedValue({ success: false, code: "ADDRESS_INPUT_INVALID", message: "Street address looks like a placeholder." })
    await openResult()
    fireEvent.change(screen.getByLabelText("Street address *"), { target: { value: "x" } })
    fireEvent.change(screen.getByLabelText("City *"), { target: { value: "y" } })
    fireEvent.click(screen.getByTestId("address-confirm"))
    expect(await screen.findByTestId("address-confirm-error")).toHaveTextContent("Enter a real street address and city")
    expect(apiService.startInvestigation).toHaveBeenCalledTimes(1)
  })

  test("user-confirmed address is labelled as the user's assertion, not as verified", async () => {
    const data = addressData({ confirmation: { state: "confirmed_by_user", formatted: "12 Harbour Road, Mumbai", confirmedAt: "2026-10-20T10:00:00.000Z", verifiedExternally: false } })
    await openResult(result({ analyses: [{ evidenceId: "E7", data }] }))
    expect(screen.getByTestId("address-confirmed")).toHaveTextContent("User-confirmed")
    expect(screen.getByTestId("address-confirmed")).toHaveTextContent("not independently verified")
    expect(screen.getByTestId("address-confirm")).toHaveTextContent("Update confirmed address")
  })

  test("the model's withheld draft is announced", async () => {
    await openResult(result({ discardedModelProposal: [{ codeBlocks: 2, changes: 1, reason: "Withheld: the address is unknown." }] }))
    expect(screen.getByTestId("investigation-discarded")).toHaveTextContent("draft code was withheld")
  })

  test("applied stays separate from verified", async () => {
    const stages = { recommendation: { state: "generated" }, proposal: { state: "available" }, approval: { state: "used" }, application: { state: "applied" }, verification: { state: "not_started" } }
    await openResult(result({ blockers: [], analyses: [], lifecycle: { fixProposed: true, fixApplied: true, fixVerified: false, verificationStatus: "not_started", stages } }))
    expect(screen.getByTestId("stage-application")).toHaveTextContent("Applied to the website")
    expect(screen.getByTestId("stage-verification")).toHaveTextContent("Not verified")
    expect(screen.queryByTestId("investigation-address")).toBeNull()
  })
})
