import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import InvestigationPanel from "./InvestigationPanel"
import { presentResult, conciseText, sortBlockers, humanizeIssueId, pagePath } from "./investigationView"
import apiService from "@/lib/apiService"

vi.mock("@/lib/apiService", () => ({
  default: { startInvestigation: vi.fn(), getInvestigation: vi.fn(), cancelInvestigation: vi.fn(), verifyInvestigation: vi.fn(), prepareInvestigationFix: vi.fn(), approveInvestigation: vi.fn(), confirmInvestigationAddress: vi.fn() },
}))

const PAGE = "https://www.acme.test/services/seo"
const LONG = "First sentence about the problem. Second sentence adds the key detail. Third sentence is extra context. Fourth sentence is background that should be collapsed away."
const base = (over = {}) => ({
  investigationStatus: "complete", issueStatus: "confirmed", confidence: { score: 0.8, label: "high" }, summary: LONG,
  evidence: [{ evidenceId: "E3", kind: "page", finding: "x" }], rootCause: { description: "Root cause paragraph." },
  recommendedSolution: { method: "manual_code_change", strategy: LONG, rationale: "Because." },
  implementationPlan: [{ step: 1, detail: "Open the template.", owner: "user" }, { step: 2, detail: "Change the markup.", owner: "user" }],
  proposedChanges: [], codeOrConfiguration: [], risks: [], validationPlan: [{ check: "Re-fetch the page", method: "parse", expected: "one valid entity" }], limitations: ["A limitation."], additionalEvidenceRequested: [],
  automaticFixEligibility: { eligible: false, eligibility: "not_supported", reason: "No adapter." }, missingCapabilities: [], requiresHumanApproval: false,
  lifecycle: { recommendationGenerated: true, fixProposed: true, fixApplied: false, fixVerified: false, verificationStatus: "not_started" },
  proposal: { fingerprint: "cd".repeat(32), hasProposal: true },
  findings: [{ statement: "The page declares the wrong type.", basis: "observed", evidenceIds: ["E3", "E5"] }],
  safetyChecks: [{ id: "a", status: "passed", detail: "ok" }, { id: "b", status: "failed", detail: "bad" }, { id: "c", status: "blocked", detail: "wait", action: "do it" }],
  reviewItems: [], analyses: [], blockers: [], discardedModelProposal: [], ...over,
})
const inv = (r = base(), over = {}) => ({ id: "inv1", issueId: "invalid_schema_type", pageUrl: PAGE, status: "completed", stage: "completed", progress: [], planFamily: "structured_data", promptVersion: "1.2.0", evidence: [{ id: "E3", kind: "page", source: "live_fetch", status: "ok", summary: "HTTP 200", retrievedAt: new Date().toISOString() }], result: r, warnings: [], error: null, ...over })

function renderPanel(issueId = "invalid_schema_type", title = "Invalid schema type") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><InvestigationPanel projectId="p1" issueId={issueId} pageUrl={PAGE} ruleMetadata={{ title }} /></QueryClientProvider>)
}
async function show(r, issueId, title) {
  const data = inv(r, { issueId: issueId || "invalid_schema_type" })
  apiService.startInvestigation.mockResolvedValue({ success: true, data })
  apiService.getInvestigation.mockResolvedValue({ success: true, data })
  renderPanel(issueId, title)
  fireEvent.click(screen.getByTestId("investigation-start"))
  return screen.findByTestId("investigation-result")
}
beforeEach(() => { vi.clearAllMocks() })

describe("presentation helpers", () => {
  test("conciseText keeps whole sentences up to the limit and never invents text", () => {
    expect(conciseText(LONG, { sentences: 2 })).toBe("First sentence about the problem. Second sentence adds the key detail.")
    expect(conciseText("  ")).toBe("")
    expect(conciseText(undefined)).toBe("")
    const cut = conciseText("word ".repeat(200), { sentences: 1, max: 40 })
    expect(cut.length).toBeLessThanOrEqual(41)
    expect(cut.endsWith("…")).toBe(true)
  })
  test("sortBlockers: what the user can supply first, then safety, then capability; junk dropped", () => {
    const s = sortBlockers([{ code: "C", category: "capability", message: "c" }, null, { code: "S", category: "safety", message: "s" }, { code: "I", category: "information", message: "i" }])
    expect(s.map((b) => b.code)).toEqual(["I", "S", "C"])
    expect(sortBlockers(undefined)).toEqual([])
  })
  test("title and page fallbacks", () => {
    expect(humanizeIssueId("missing_alt_text")).toBe("Missing alt text")
    expect(pagePath("https://a.test/")).toBe("Home page")
    expect(pagePath("https://a.test/x/y?z=1")).toBe("/x/y?z=1")
    expect(pagePath("not a url")).toBe("not a url")
  })

  const P = (r, extra) => presentResult({ result: base(r) }, extra)
  const elig = { eligible: true, eligibility: "eligible", reason: "ok" }
  test("one status, one action and one notice for every server state — and never an action the server would reject", () => {
    expect(P({ lifecycle: { fixVerified: true, fixApplied: true, stages: { verification: { state: "verified" } } } })).toMatchObject({ status: { key: "verified" }, action: null })
    expect(P({ lifecycle: { fixApplied: true, stages: { application: { state: "applied" }, verification: { state: "not_started" } } } })).toMatchObject({ status: { key: "applied" }, action: { kind: "verify", label: "Verify fix" } })
    expect(P({ lifecycle: { fixApplied: true, verificationStatus: "pending" } })).toMatchObject({ status: { key: "verifying" }, action: null })
    expect(P({ lifecycle: { fixApplied: true, verificationStatus: "failed", stages: { verification: { state: "failed" } } } })).toMatchObject({ status: { key: "verification_failed" }, action: { kind: "verify" } })
    expect(P({ lifecycle: { stages: { application: { state: "failed", failure: { message: "WordPress said no" } } } } })).toMatchObject({ status: { key: "application_failed" }, action: { kind: "rerun", label: "Retry" }, notice: { text: "WordPress said no" } })
    expect(P({ investigationStatus: "blocked", proposal: { hasProposal: false } })).toMatchObject({ status: { key: "needs_retry" }, action: { kind: "rerun" } })
    expect(P({ automaticFixEligibility: elig })).toMatchObject({ status: { key: "recommended" }, action: { kind: "prepare", label: "Prepare fix" } })
    expect(P({ automaticFixEligibility: elig }, { prepared: { createdTask: true } })).toMatchObject({ status: { key: "needs_approval" }, action: { kind: "approve" } })
    expect(P({ automaticFixEligibility: elig, lifecycle: { approval: { approved: true } } })).toMatchObject({ status: { key: "approved" }, action: null })
    expect(P({ automaticFixEligibility: elig, lifecycle: { approval: { invalidated: true } } })).toMatchObject({ status: { key: "approval_voided" }, action: { kind: "prepare" } })
    expect(P({ blockers: [{ code: "WORDPRESS_NOT_CONNECTED", category: "capability", message: "WordPress is not connected.", action: "Follow the manual steps." }] })).toMatchObject({ status: { key: "manual" }, action: null, notice: { code: "WORDPRESS_NOT_CONNECTED" } })
    expect(P({ blockers: [{ code: "ADDRESS_UNCONFIRMED", category: "information", message: "Address unknown." }], lifecycle: { stages: { proposal: { state: "awaiting_information" } } } })).toMatchObject({ status: { key: "action_required" }, action: null, awaitingInformation: true })
    expect(P({ issueStatus: "already_resolved" })).toMatchObject({ status: { key: "resolved" }, action: null })
  })
  test("an eligible-looking result whose server flag is false never offers Prepare", () => {
    expect(P({ automaticFixEligibility: { eligible: false, eligibility: "eligible" } }).action?.kind).not.toBe("prepare")
  })
})

describe("concise default view", () => {
  test("header, what we found, recommended fix, one action — and long detail collapsed", async () => {
    await show(base())
    expect(screen.getByTestId("investigation-title")).toHaveTextContent("Invalid schema type")
    expect(screen.getByTestId("investigation-page")).toHaveTextContent("/services/seo")
    expect(screen.getByTestId("investigation-state")).toHaveTextContent("Manual fix")
    expect(screen.getByTestId("investigation-summary")).toHaveTextContent("Second sentence adds the key detail.")
    expect(screen.getByTestId("investigation-summary")).not.toHaveTextContent("Third sentence")
    expect(screen.getByTestId("investigation-solution")).toHaveTextContent("Third sentence is extra context.")
    expect(screen.getByTestId("investigation-solution")).not.toHaveTextContent("Fourth sentence")
    expect(document.querySelectorAll("details[open]")).toHaveLength(0)
    expect(screen.getByTestId("investigation-verify-hint")).toHaveTextContent("Re-fetch the page → one valid entity")
  })

  test("fix instructions are not duplicated here (they live in the DIY Guide)", async () => {
    await show(base())
    expect(screen.queryByTestId("investigation-plan")).toBeNull()
    expect(screen.queryByText(/fix instructions/i)).toBeNull()
    expect(screen.queryByText("Open the template.")).toBeNull()
  })

  test("only one primary AI entry point: before a result there is one Investigate & Recommend, after it there is none", async () => {
    apiService.startInvestigation.mockResolvedValue({ success: true, data: inv() })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv() })
    renderPanel()
    expect(screen.getAllByRole("button", { name: /Investigate & Recommend/ })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: /Generate AI Recommendation|Investigate this page/i })).toBeNull()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(screen.queryByRole("button", { name: /Investigate & Recommend/ })).toBeNull()
  })

  test("a blocker is stated once in the primary view; technical details do not repeat it", async () => {
    const blockers = [{ code: "WORDPRESS_NOT_CONNECTED", category: "capability", message: "WordPress is not connected.", action: "Follow the manual instructions." }, { code: "NO_AUTOMATIC_ADAPTER", category: "capability", message: "No adapter.", action: null }]
    await show(base({ blockers }))
    expect(screen.getByTestId("investigation-notice")).toHaveTextContent("WordPress is not connected. Follow the manual instructions.")
    const tech = screen.getByTestId("investigation-technical")
    expect(within(tech).queryByText("WORDPRESS_NOT_CONNECTED")).toBeNull()
    expect(within(tech).getByText("NO_AUTOMATIC_ADAPTER")).toBeInTheDocument()
    expect(screen.getAllByTestId("investigation-notice")).toHaveLength(1)
  })

  test("no empty sections: nothing to show -> no Risks / Validation checks disclosure", async () => {
    await show(base({ risks: [], safetyChecks: [], implementationPlan: [], validationPlan: [], recommendedSolution: { method: "manual_code_change", strategy: "Do it." } }))
    expect(screen.queryByTestId("investigation-risks")).toBeNull()
    expect(screen.queryByTestId("investigation-safety-group")).toBeNull()
    expect(screen.queryByTestId("investigation-verify-hint")).toBeNull()
  })

  test("a high risk stays visible; lower risks are collapsed", async () => {
    await show(base({ risks: [{ risk: "Could break the page.", severity: "high", mitigation: "Back up first." }, { risk: "Minor cache delay.", severity: "low", mitigation: "" }] }))
    expect(screen.getByTestId("investigation-risks-high")).toHaveTextContent("Could break the page.")
    expect(screen.getByTestId("investigation-risks")).not.toHaveAttribute("open")
    expect(screen.getByTestId("investigation-risks")).not.toHaveTextContent("Could break the page.")
  })

  test("raw evidence ids are not shown to users in findings", async () => {
    await show(base())
    const f = screen.getByTestId("investigation-finding")
    expect(f).toHaveTextContent("The page declares the wrong type.")
    expect(f.textContent).not.toMatch(/\bE\d+\b/)
  })

  test("check summary in the collapsed header matches the underlying records and safe fallbacks are used", async () => {
    await show(base())
    expect(screen.getByTestId("investigation-checks-summary")).toHaveTextContent("1 passed · 1 failed · 1 blocked (of 3)")
    expect(screen.getAllByTestId("investigation-check")).toHaveLength(3)
    expect(screen.getByTestId("investigation-safety-group")).not.toHaveAttribute("open")
    expect(screen.getAllByTestId("investigation-check")[0]).toHaveTextContent("a")
  })

  test("code is in Technical details only; an invalid block is flagged and never presented as ready; absent when the server withheld it", async () => {
    const bad = { language: "json-ld", purpose: "Schema", content: '{"@type":"Organization"}', jsonLd: { valid: false, types: [], problems: ["Missing @context."] }, notes: [] }
    await show(base({ codeOrConfiguration: [bad] }))
    const section = screen.getByTestId("investigation-code-section")
    expect(within(screen.getByTestId("investigation-technical")).getByTestId("investigation-code-section")).toBe(section)
    expect(section).toHaveTextContent("did not pass validation: Missing @context.")
  })

  test("category-agnostic: different issue categories render the same layout from the same fields (no per-issue layouts)", async () => {
    for (const [issueId, title] of [["image_alt_missing", "Missing image alt text"], ["meta_description_missing", "Missing meta description"], ["canonical_issue", "Canonical problem"]]) {
      document.body.innerHTML = ""
      vi.clearAllMocks()
      await show(base(), issueId, title)
      expect(screen.getByTestId("investigation-title")).toHaveTextContent(title)
      for (const id of ["investigation-state", "investigation-summary", "investigation-solution", "investigation-diagnosis", "investigation-technical", "investigation-lifecycle"]) expect(screen.getByTestId(id)).toBeInTheDocument()
    }
  })

  test("title falls back to a readable issue name when no rule title is given", async () => {
    const data = inv(base(), { issueId: "missing_alt_text" })
    apiService.startInvestigation.mockResolvedValue({ success: true, data })
    apiService.getInvestigation.mockResolvedValue({ success: true, data })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
    render(<QueryClientProvider client={qc}><InvestigationPanel projectId="p1" issueId="missing_alt_text" pageUrl={PAGE} /></QueryClientProvider>)
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(screen.getByTestId("investigation-title")).toHaveTextContent("Missing alt text")
  })

  test("applied vs verified: status shows Applied with a Verify fix action, then Verify fix calls the backend", async () => {
    apiService.verifyInvestigation.mockResolvedValue({ success: true, data: { verificationStatus: "pending" } })
    await show(base({ lifecycle: { recommendationGenerated: true, fixProposed: true, fixApplied: true, fixVerified: false, verificationStatus: "not_started", stages: { recommendation: { state: "generated" }, proposal: { state: "available" }, approval: { state: "used" }, application: { state: "applied" }, verification: { state: "not_started" } } } }))
    expect(screen.getByTestId("investigation-state")).toHaveTextContent("Applied")
    expect(screen.getByTestId("stage-verification")).toHaveTextContent("Not verified")
    fireEvent.click(screen.getByRole("button", { name: "Verify fix" }))
    await vi.waitFor(() => expect(apiService.verifyInvestigation).toHaveBeenCalledWith("p1", "inv1"))
  })

  test("blocked page: Retry investigation is the primary action and the notice says the page could not be inspected", async () => {
    await show(base({ investigationStatus: "blocked", proposal: { fingerprint: "x", hasProposal: false } }))
    expect(screen.getByTestId("investigation-notice")).toHaveTextContent("could not be inspected")
    expect(screen.getByRole("button", { name: "Retry investigation" })).toBeInTheDocument()
    expect(screen.getAllByTestId("investigation-rerun")).toHaveLength(1)
  })
})
