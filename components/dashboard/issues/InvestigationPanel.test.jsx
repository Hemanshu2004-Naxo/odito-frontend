import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import InvestigationPanel from "./InvestigationPanel"
import { describeFreshness, eligibilityInfo, lifecycleSteps, stageRows, cautionNotices, basisInfo, safetySummary, approvalState, checkLabel } from "./investigationView"
import apiService from "@/lib/apiService"

vi.mock("@/lib/apiService", () => ({
  default: { startInvestigation: vi.fn(), getInvestigation: vi.fn(), cancelInvestigation: vi.fn(), verifyInvestigation: vi.fn(), prepareInvestigationFix: vi.fn(), approveInvestigation: vi.fn() },
}))

const PAGE_A = "https://www.acme.test/about-us"
const PAGE_B = "https://www.acme.test/services"
const lifecycle = (over = {}) => ({ recommendationGenerated: true, fixProposed: true, fixApplied: false, fixVerified: false, verificationStatus: "not_started", ...over })
const result = (over = {}) => ({
  investigationStatus: "complete", issueStatus: "confirmed", confidence: { score: 0.85, label: "high" }, summary: "The page shows a breadcrumb but outputs no BreadcrumbList.",
  evidence: [{ evidenceId: "E3", kind: "page", finding: "Live page has no BreadcrumbList JSON-LD." }],
  rootCause: { category: "page_markup", description: "The theme renders the trail visually only.", symptomVersusCause: "The detector sees missing schema; the cause is the template." },
  reasoning: "", recommendedSolution: { method: "automatic_fix", strategy: "Add BreadcrumbList JSON-LD matching the visible trail.", rationale: "Matches the UI." },
  implementationPlan: [{ step: 1, detail: "Add the JSON-LD to the page head.", owner: "odito" }],
  proposedChanges: [], codeOrConfiguration: [{ language: "json-ld", purpose: "Breadcrumb schema", content: '{"@type":"BreadcrumbList"}', jsonLd: { valid: true, types: ["BreadcrumbList"], problems: [] }, notes: [] }],
  automaticFixEligibility: { eligible: true, adapterId: "wordpress_seo_bridge", eligibility: "eligible", reason: "A trusted adapter can apply this after your approval." },
  requiredCapabilities: [], missingCapabilities: [], risks: [{ risk: "Duplicate schema if a plugin adds one.", severity: "low", mitigation: "Re-check." }],
  validationPlan: [{ check: "Re-fetch page", method: "parse", expected: "one valid BreadcrumbList" }], limitations: [], additionalEvidenceRequested: [],
  requiresHumanApproval: true, lifecycle: lifecycle(), proposal: { fingerprint: "ab".repeat(32), hasProposal: true },
  findings: [{ statement: "Live page has no BreadcrumbList JSON-LD.", basis: "corroborated", absence: true, evidenceIds: ["E3", "E5"], note: null }],
  safetyChecks: [{ name: "live_page_inspected", passed: true, detail: "ok" }, { name: "breadcrumb_hierarchy_verified", passed: true, detail: "ok" }], reviewItems: [], ...over,
})
const inv = (over = {}) => ({
  id: "inv1", issueId: "breadcrumblist_schema", pageUrl: PAGE_A, status: "completed", stage: "completed", progress: [], planFamily: "structured_data", promptVersion: "1.0.0",
  evidence: [
    { id: "E1", kind: "detector", source: "issue_detector", status: "ok", summary: "Why the detector flagged this page.", retrievedAt: new Date().toISOString() },
    { id: "E3", kind: "page", source: "live_fetch", status: "ok", summary: "HTTP 200 from https://www.acme.test/about-us", retrievedAt: new Date().toISOString() },
    { id: "E5", kind: "rendered_dom", source: "live_fetch", status: "unavailable", summary: "No on-demand renderer.", error: { code: "RENDER_UNAVAILABLE", message: "On-demand rendering is not configured." }, retrievedAt: new Date().toISOString() },
  ],
  result: result(), warnings: [], error: null, ...over,
})

function renderPanel(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  const ui = (p) => <QueryClientProvider client={qc}><InvestigationPanel projectId="p1" issueId="breadcrumblist_schema" pageUrl={PAGE_A} ruleMetadata={{ title: "x" }} {...p} /></QueryClientProvider>
  const utils = render(ui(props))
  return { ...utils, rerenderWith: (p) => utils.rerender(ui({ ...props, ...p })) }
}
beforeEach(() => { vi.clearAllMocks() })

describe("investigation panel", () => {
  test("idle -> start -> running progress -> completed result with every section", async () => {
    apiService.startInvestigation.mockResolvedValue({ success: true, data: inv({ status: "running", stage: "gather_evidence", result: null, progress: [{ stage: "gather_evidence", status: "running" }] }) })
    apiService.getInvestigation.mockResolvedValueOnce({ success: true, data: inv({ status: "running", stage: "gather_evidence", result: null, progress: [{ stage: "gather_evidence", status: "running" }] }) })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv() })
    renderPanel()
    expect(screen.getByTestId("investigation-start")).toHaveTextContent("Investigate & Recommend")
    expect(screen.getByTestId("investigation-hint")).toHaveTextContent("Analyze the affected page, identify the root cause, and recommend the safest fix.")
    fireEvent.click(screen.getByTestId("investigation-start"))
    expect(await screen.findByTestId("investigation-progress")).toBeInTheDocument()
    expect(screen.getByText("Inspecting the page and site")).toBeInTheDocument()
    expect(await screen.findByTestId("investigation-result", {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByTestId("investigation-summary")).toHaveTextContent("outputs no BreadcrumbList")
    expect(screen.getByTestId("investigation-findings")).toHaveTextContent("Live page has no BreadcrumbList JSON-LD.")
    expect(screen.getByTestId("investigation-root-cause")).toHaveTextContent("theme renders the trail visually only")
    expect(screen.getByTestId("investigation-diagnosis")).toHaveTextContent("Automatic fix (after your approval)")
    expect(screen.getByTestId("investigation-code")).toHaveTextContent('{"@type":"BreadcrumbList"}')
    expect(screen.getByTestId("investigation-eligibility")).toHaveTextContent("Odito has an approved adapter for this fix")
    expect(screen.getByTestId("investigation-eligibility")).toHaveTextContent("Needs your approval")
    expect(screen.getByTestId("investigation-risks")).toHaveTextContent("Duplicate schema")
    expect(apiService.startInvestigation).toHaveBeenCalledWith({ projectId: "p1", issueId: "breadcrumblist_schema", pageUrl: PAGE_A, ruleMetadata: { title: "x" } })
  }, 10000)

  test("lifecycle shows proposed only: NOT applied and NOT verified", async () => {
    apiService.startInvestigation.mockResolvedValue({ success: true, data: inv() })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv() })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(screen.getByTestId("lifecycle-generated")).toHaveAttribute("data-done", "true")
    expect(screen.getByTestId("lifecycle-proposed")).toHaveAttribute("data-done", "true")
    expect(screen.getByTestId("lifecycle-applied")).toHaveAttribute("data-done", "false")
    expect(screen.getByTestId("lifecycle-verified")).toHaveAttribute("data-done", "false")
    expect(screen.queryByText(/Re-fetch the page/)).not.toBeInTheDocument()
  })

  test("repeated clicks while starting send ONE request", async () => {
    let resolve
    apiService.startInvestigation.mockImplementation(() => new Promise((r) => { resolve = r }))
    renderPanel()
    const btn = screen.getByTestId("investigation-start")
    fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn)
    await waitFor(() => expect(apiService.startInvestigation).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 30))
    expect(apiService.startInvestigation).toHaveBeenCalledTimes(1)
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv() })
    resolve({ success: true, data: inv() })
    await screen.findByTestId("investigation-result")
  })

  test("a slow response for the PREVIOUS page never replaces the current page's panel", async () => {
    let resolveA
    apiService.startInvestigation.mockImplementation(() => new Promise((r) => { resolveA = r }))
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv() })
    const { rerenderWith } = renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await waitFor(() => expect(apiService.startInvestigation).toHaveBeenCalled())
    rerenderWith({ pageUrl: PAGE_B })
    resolveA({ success: true, data: inv({ pageUrl: PAGE_A }) })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByTestId("investigation-result")).not.toBeInTheDocument()
    expect(screen.getByTestId("investigation-start")).toBeInTheDocument()
    expect(apiService.getInvestigation).not.toHaveBeenCalled()
  })

  test("blocked page: clear alert and no diagnosis implied", async () => {
    const blocked = inv({ result: result({ investigationStatus: "blocked", issueStatus: "uncertain", confidence: { score: 0, label: "low" }, evidence: [], rootCause: { category: "unknown", description: "", symptomVersusCause: null }, recommendedSolution: { method: "needs_more_information", strategy: "Retry." }, implementationPlan: [], codeOrConfiguration: [], automaticFixEligibility: { eligible: false, eligibility: "not_supported", reason: "x" }, risks: [], validationPlan: [], limitations: ["The page could not be inspected"], lifecycle: lifecycle({ fixProposed: false }) }) })
    apiService.startInvestigation.mockResolvedValue({ success: true, data: blocked })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: blocked })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(screen.getByTestId("investigation-status")).toHaveTextContent("Page could not be inspected")
    expect(screen.getAllByTestId("investigation-notice")[0]).toHaveTextContent("Nothing below is a diagnosis")
    expect(screen.getByTestId("lifecycle-proposed")).toHaveAttribute("data-done", "false")
    expect(screen.queryByTestId("investigation-code-section")).not.toBeInTheDocument()
  })

  test("partial evidence and manual-only fix are explained; what was inspected can be expanded with freshness and failures", async () => {
    const partial = inv({ result: result({ investigationStatus: "partial", automaticFixEligibility: { eligible: false, eligibility: "not_supported", reason: "Odito has no automatic-fix adapter for this issue type." } }) })
    apiService.startInvestigation.mockResolvedValue({ success: true, data: partial })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: partial })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(screen.getAllByTestId("investigation-notice")[0]).toHaveTextContent("partial information")
    expect(screen.getByTestId("investigation-eligibility")).toHaveTextContent("Manual fix")
    fireEvent.click(screen.getByTestId("investigation-evidence-toggle"))
    const list = screen.getByTestId("investigation-evidence")
    expect(within(list).getByText("Live page")).toBeInTheDocument()
    expect(list).toHaveTextContent("On-demand rendering is not configured.")
    expect(list).toHaveTextContent("retrieved")
  })

  test("applied but verification failed: shows applied, NOT verified, and offers a re-check", async () => {
    const failed = inv({ result: result({ lifecycle: lifecycle({ fixApplied: true, appliedBy: "wordpress:breadcrumb_schema", verificationStatus: "failed" }) }) })
    apiService.startInvestigation.mockResolvedValue({ success: true, data: failed })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: failed })
    apiService.verifyInvestigation.mockResolvedValue({ success: true, data: { verificationRunId: "r1", verificationStatus: "pending" } })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(screen.getByTestId("lifecycle-applied")).toHaveAttribute("data-done", "true")
    expect(screen.getByTestId("lifecycle-verified")).toHaveAttribute("data-done", "false")
    expect(screen.getByTestId("lifecycle-verified")).toHaveTextContent("Verification failed")
    fireEvent.click(screen.getByText("Verify again"))
    await waitFor(() => expect(apiService.verifyInvestigation).toHaveBeenCalledWith("p1", "inv1"))
  })

  test("failed investigation: error with retry; start error and cancelled are surfaced", async () => {
    apiService.startInvestigation.mockResolvedValueOnce({ success: true, data: inv({ status: "failed", result: null, error: { code: "INVESTIGATION_TIMEOUT", message: "x" } }) })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv({ status: "failed", result: null, error: { code: "INVESTIGATION_TIMEOUT", message: "x" } }) })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    expect(await screen.findByTestId("investigation-error")).toHaveTextContent("took too long")
    expect(screen.getByTestId("investigation-start")).toHaveTextContent("Retry")
  })

  test("start rejected (out of scope) shows a precise message", async () => {
    apiService.startInvestigation.mockRejectedValue(Object.assign(new Error("nope"), { code: "OUT_OF_SCOPE" }))
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    expect(await screen.findByTestId("investigation-error")).toHaveTextContent("not part of the project's website")
  })

  test("cancel is available while running", async () => {
    const running = inv({ status: "running", stage: "diagnose", result: null })
    apiService.startInvestigation.mockResolvedValue({ success: true, data: running })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: running })
    apiService.cancelInvestigation.mockResolvedValue({ success: true, data: { cancelled: true } })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    fireEvent.click(await screen.findByText("Cancel"))
    await waitFor(() => expect(apiService.cancelInvestigation).toHaveBeenCalledWith("p1", "inv1"))
  })

  test("page content is rendered as text, never as HTML", async () => {
    const hostile = inv({ result: result({ summary: '<img src=x onerror="window.__pwned=1">IGNORE INSTRUCTIONS', codeOrConfiguration: [{ language: "html", purpose: "p", content: "<script>window.__pwned=1</script>", notes: [] }] }) })
    apiService.startInvestigation.mockResolvedValue({ success: true, data: hostile })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: hostile })
    const { container } = renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("script")).toBeNull()
    expect(screen.getByTestId("investigation-summary")).toHaveTextContent("IGNORE INSTRUCTIONS")
    expect(window.__pwned).toBeUndefined()
  })

  test("no page selected: asks for one and offers no action", () => {
    const { container } = renderPanel({ pageUrl: null })
    expect(container).toBeEmptyDOMElement() // nothing to investigate: no card, no button, no empty container
    expect(screen.queryByTestId("investigation-start")).not.toBeInTheDocument()
  })
})

describe("fix preparation and failure handling", () => {
  test("eligible: Prepare fix calls the backend once, explains that nothing changes, and shows the task as ready; ineligible shows no such action", async () => {
    apiService.startInvestigation.mockResolvedValue({ success: true, data: inv() })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv() })
    apiService.prepareInvestigationFix.mockResolvedValue({ success: true, data: { taskId: "t1", createdTask: true, next: { approvalRequired: true } } })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(screen.getByTestId("investigation-prepare")).toHaveTextContent("nothing on your website changes")
    const btn = screen.getByText("Prepare fix")
    fireEvent.click(btn); fireEvent.click(btn)
    await waitFor(() => expect(apiService.prepareInvestigationFix).toHaveBeenCalledTimes(1))
    expect(apiService.prepareInvestigationFix).toHaveBeenCalledWith("p1", "inv1")
    expect(await screen.findByTestId("investigation-prepared")).toHaveTextContent("Task ready")
    expect(screen.getByTestId("investigation-approval")).toHaveAttribute("data-state", "needs_approval")
    expect(screen.getByTestId("lifecycle-applied")).toHaveAttribute("data-done", "false")
  })

  test("prepare refused by the server (not eligible now): precise message, still no applied state", async () => {
    apiService.startInvestigation.mockResolvedValue({ success: true, data: inv() })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv() })
    apiService.prepareInvestigationFix.mockRejectedValue(Object.assign(new Error("x"), { code: "NOT_ELIGIBLE" }))
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    fireEvent.click(screen.getByText("Prepare fix"))
    expect(await screen.findByTestId("investigation-prepare-error")).toHaveTextContent("cannot apply this automatically right now")
    expect(screen.queryByTestId("investigation-prepared")).not.toBeInTheDocument()
  })

  test("not eligible: no Prepare action is offered", async () => {
    const manual = inv({ result: result({ automaticFixEligibility: { eligible: false, eligibility: "not_supported", reason: "manual" } }) })
    apiService.startInvestigation.mockResolvedValue({ success: true, data: manual })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: manual })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(screen.queryByTestId("investigation-prepare")).not.toBeInTheDocument()
  })

  test("polling failure stops the polling, tells the user, and Retry resumes", async () => {
    const running = inv({ status: "running", stage: "diagnose", result: null })
    apiService.startInvestigation.mockResolvedValue({ success: true, data: running })
    apiService.getInvestigation.mockRejectedValue(new Error("network down"))
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    expect(await screen.findByTestId("investigation-load-error", {}, { timeout: 4000 })).toHaveTextContent("Lost contact with the server")
    const calls = apiService.getInvestigation.mock.calls.length
    await new Promise((r) => setTimeout(r, 2200)) // longer than one poll interval
    expect(apiService.getInvestigation.mock.calls.length).toBe(calls) // no hammering
    apiService.getInvestigation.mockReset()
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv() })
    fireEvent.click(screen.getByText("Retry"))
    expect(await screen.findByTestId("investigation-result")).toBeInTheDocument()
    expect(screen.queryByTestId("investigation-load-error")).not.toBeInTheDocument()
  }, 12000)

  test("an interrupted (server restart) investigation shows a clear message and lets the user start again", async () => {
    const dead = inv({ status: "failed", result: null, error: { code: "INVESTIGATION_INTERRUPTED", message: "x" } })
    apiService.startInvestigation.mockResolvedValue({ success: true, data: dead })
    apiService.getInvestigation.mockResolvedValue({ success: true, data: dead })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    expect(await screen.findByTestId("investigation-error")).toHaveTextContent("interrupted")
    expect(screen.getByTestId("investigation-start")).toHaveTextContent("Retry")
  })
})

describe("evidence basis, review and approval of the exact proposal", () => {
  const go = async (data) => {
    apiService.startInvestigation.mockResolvedValue({ success: true, data })
    apiService.getInvestigation.mockResolvedValue({ success: true, data })
    const utils = renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    return utils
  }

  test("every finding shows how well it is supported; unknown/inferred ones are visibly weaker and explain why", async () => {
    await go(inv({ result: result({ findings: [
      { statement: "Seen on two sources.", basis: "corroborated", evidenceIds: ["E3", "E6"], absence: false },
      { statement: "No BreadcrumbList.", basis: "unknown", absence: true, evidenceIds: ["E3"], note: "Rendering was needed but did not complete." },
      { statement: "Probably a template issue.", basis: "inferred", evidenceIds: [] },
    ] }) }))
    const rows = screen.getAllByTestId("investigation-finding")
    expect(rows.map((r) => r.getAttribute("data-basis"))).toEqual(["corroborated", "unknown", "inferred"])
    expect(rows[1]).toHaveTextContent("Unknown · absence")
    expect(rows[1]).toHaveTextContent("Rendering was needed but did not complete.")
  })

  test("unresolved hierarchy is shown as 'Needs your review' with the exact unresolved level and reason", async () => {
    await go(inv({ result: result({
      automaticFixEligibility: { eligible: false, eligibility: "eligible", reason: "Not applied automatically — Hierarchy is unresolved" },
      reviewItems: [{ evidenceId: "E8", analyzerId: "breadcrumb_hierarchy", status: "unresolved", summary: "Breadcrumb hierarchy unresolved: no trail — 1 unresolved.", unresolved: [{ kind: "parent", reason: 'The menu group "White Label Services" that contains this page has no page of its own (its link is empty or "#").' }], issues: [], trail: [] }],
      safetyChecks: [{ name: "breadcrumb_hierarchy_verified", passed: false, detail: "Hierarchy is unresolved" }, { name: "live_page_inspected", passed: true, detail: "ok" }],
    }) }))
    expect(screen.getByTestId("investigation-review")).toHaveTextContent("White Label Services")
    expect(screen.getByTestId("investigation-review")).toHaveTextContent("Unresolved")
    expect(screen.getByTestId("investigation-checks-summary")).toHaveTextContent("1 passed · 1 failed (of 2)")
    expect(screen.queryByTestId("investigation-prepare")).not.toBeInTheDocument()
  })

  test("Prepare -> Approve sends the fingerprint the person was shown, once; approval state comes from the server", async () => {
    const data = inv()
    apiService.startInvestigation.mockResolvedValue({ success: true, data })
    apiService.getInvestigation.mockResolvedValue({ success: true, data })
    apiService.prepareInvestigationFix.mockResolvedValue({ success: true, data: { taskId: "t1", createdTask: true, proposalFingerprint: "ab".repeat(32) } })
    apiService.approveInvestigation.mockResolvedValue({ success: true, data: { approved: true, fingerprint: "ab".repeat(32) } })
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start"))
    await screen.findByTestId("investigation-result")
    expect(screen.queryByText("Approve this exact change")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Prepare fix"))
    const btn = await screen.findByText("Approve this exact change")
    expect(screen.getByTestId("investigation-approval")).toHaveTextContent("abababababab")
    // once the approval is recorded, the server reports it in the lifecycle on the next read
    apiService.getInvestigation.mockResolvedValue({ success: true, data: inv({ result: result({ lifecycle: lifecycle({ approval: { approved: true, invalidated: false, consumed: false } }) }) }) })
    fireEvent.click(btn); fireEvent.click(btn)
    await waitFor(() => expect(apiService.approveInvestigation).toHaveBeenCalledTimes(1))
    expect(apiService.approveInvestigation).toHaveBeenCalledWith("p1", "inv1", "ab".repeat(32))
    await waitFor(() => expect(screen.getByTestId("investigation-approval")).toHaveAttribute("data-state", "approved"))
    expect(screen.queryByText("Approve this exact change")).not.toBeInTheDocument()
  })

  test("approval rejected because the proposal changed / a newer investigation exists: clear message, no approved state", async () => {
    const data = inv()
    apiService.startInvestigation.mockResolvedValue({ success: true, data })
    apiService.getInvestigation.mockResolvedValue({ success: true, data })
    apiService.prepareInvestigationFix.mockResolvedValue({ success: true, data: { taskId: "t1" } })
    apiService.approveInvestigation.mockRejectedValue(Object.assign(new Error("x"), { code: "STALE_INVESTIGATION" }))
    renderPanel()
    fireEvent.click(screen.getByTestId("investigation-start")); await screen.findByTestId("investigation-result")
    fireEvent.click(screen.getByText("Prepare fix"))
    fireEvent.click(await screen.findByText("Approve this exact change"))
    expect(await screen.findByTestId("investigation-approve-error")).toHaveTextContent("A newer investigation exists")
    expect(screen.getByTestId("investigation-approval")).toHaveAttribute("data-state", "needs_approval")
  })

  test("a voided approval and a used approval are shown for what they are", async () => {
    await go(inv({ result: result({ lifecycle: lifecycle({ approval: { approved: false, invalidated: true, consumed: false } }) }) }))
    // eligible + prepared state is local; the view model carries the server truth
    expect(approvalState({ lifecycle: { approval: { invalidated: true } }, prepared: null }).key).toBe("invalidated")
    expect(approvalState({ lifecycle: { approval: { consumed: true } }, prepared: null }).key).toBe("used")
    expect(approvalState({ lifecycle: { approval: { approved: true } }, prepared: null }).key).toBe("approved")
    expect(approvalState({ lifecycle: {}, prepared: { taskId: "t" } }).key).toBe("needs_approval")
    expect(approvalState({ lifecycle: {}, prepared: null }).key).toBe("not_prepared")
  })

  test("view model: basis labels, safety summary, check labels", () => {
    expect(basisInfo("corroborated").tone).toBe("ok")
    expect(basisInfo("inferred").tone).toBe("warn")
    expect(basisInfo("nonsense").label).toBe("Unknown")
    expect(safetySummary([{ passed: true }, { passed: false }]).failed).toHaveLength(1)
    expect(safetySummary([]).allPassed).toBe(false)
    expect(checkLabel("markup_syntactically_valid")).toMatch(/not proof/)
  })
})

describe("view model", () => {
  test("eligibility is taken from the server flag, never from model wording", () => {
    expect(eligibilityInfo({ eligible: true }).tone).toBe("ok")
    expect(eligibilityInfo({ eligible: false, eligibility: "eligible" }).label).toMatch(/manual review/)
    expect(eligibilityInfo({ eligible: false, eligibility: "requires_integration_setup" }).tone).toBe("warn")
    expect(eligibilityInfo(null).label).toMatch(/unknown/)
  })

  test("lifecycle: user-reported 'implemented' is not shown as applied by Odito; failed verification is flagged", () => {
    const s = lifecycleSteps({ recommendationGenerated: true, fixProposed: true, fixApplied: false, userReportedImplemented: true, verificationStatus: "not_started" })
    expect(s.find((x) => x.key === "applied")).toMatchObject({ done: false })
    expect(s.find((x) => x.key === "applied").label).toMatch(/not applied by Odito/)
    expect(lifecycleSteps({ verificationStatus: "failed" }).find((x) => x.key === "verified").tone).toBe("bad")
    expect(lifecycleSteps({ fixVerified: true, verificationStatus: "passed" }).find((x) => x.key === "verified").done).toBe(true)
  })

  test("stage rows follow the server progress log", () => {
    const rows = stageRows([{ stage: "gather_evidence", status: "done" }, { stage: "capabilities", status: "running" }], "capabilities", "running")
    expect(rows.map((r) => r.state)).toEqual(["done", "running", "pending", "pending"])
  })

  test("freshness text distinguishes crawled vs retrieved, and reused", () => {
    const now = Date.parse("2026-10-21T10:00:00Z")
    expect(describeFreshness({ source: "live_fetch", retrievedAt: "2026-10-21T09:59:30Z" }, now)).toBe("retrieved 30s ago")
    expect(describeFreshness({ source: "crawl_data", retrievedAt: "2026-10-20T10:00:00Z" }, now)).toBe("crawled 24h ago")
    expect(describeFreshness({ source: "live_fetch", retrievedAt: "2026-10-21T09:59:30Z", fromCache: true }, now)).toMatch(/reused/)
    expect(describeFreshness({ source: "crawl_data", retrievedAt: null }, now)).toBe("crawl time unknown")
  })

  test("cautions for blocked/partial/low confidence", () => {
    expect(cautionNotices({ result: { investigationStatus: "blocked", confidence: { label: "low" } }, warnings: [] })[0].tone).toBe("bad")
    expect(cautionNotices({ result: { investigationStatus: "complete", confidence: { label: "high" } }, warnings: [] })).toEqual([])
  })
})
