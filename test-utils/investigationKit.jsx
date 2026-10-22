import { vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"

/**
 * Helpers for screens that render the unified "Investigate & Recommend" action.
 * The investigation API is mocked at the apiService boundary; everything above it (hook, panel, screen) is real.
 */

export const INVESTIGATION_ENDPOINT_FNS = ["startInvestigation", "getInvestigation", "cancelInvestigation", "prepareInvestigationFix", "approveInvestigation", "verifyInvestigation"]

export const investigationResult = (over = {}) => ({
  investigationStatus: "complete", issueStatus: "confirmed", confidence: { score: 0.85, label: "high" }, summary: "The page has the reported issue.",
  evidence: [{ evidenceId: "E3", kind: "page", finding: "Live page shows the issue." }],
  findings: [{ statement: "The issue is present on the live page.", basis: "observed", absence: false, evidenceIds: ["E3"], note: null }],
  rootCause: { category: "page_markup", description: "The template omits it.", symptomVersusCause: null },
  reasoning: "", recommendedSolution: { method: "manual_code_change", strategy: "Add the missing element.", rationale: null },
  implementationPlan: [], proposedChanges: [], codeOrConfiguration: [],
  automaticFixEligibility: { eligible: false, adapterId: null, eligibility: "not_supported", reason: "No automatic fix for this issue." },
  requiredCapabilities: [], missingCapabilities: [], risks: [], validationPlan: [], limitations: [], additionalEvidenceRequested: [],
  safetyChecks: [], reviewItems: [], requiresHumanApproval: false, proposal: { fingerprint: "cd".repeat(32), hasProposal: false },
  lifecycle: { recommendationGenerated: true, fixProposed: false, fixApplied: false, fixVerified: false, verificationStatus: "not_started", approval: { approved: false, invalidated: false, consumed: false } },
  ...over,
})

export const completedInvestigation = (over = {}, resultOver = {}) => ({
  id: "inv-1", issueId: "x", pageUrl: "https://example.com/about", status: "completed", stage: "completed", progress: [], planFamily: "general", promptVersion: "1.1.0",
  evidence: [{ id: "E3", kind: "page", source: "live_fetch", status: "ok", summary: "HTTP 200", retrievedAt: new Date().toISOString() }],
  result: investigationResult(resultOver), warnings: [], error: null, ...over,
})

/** Makes start + poll return a finished investigation. */
export function primeInvestigation(apiService, over = {}, resultOver = {}) {
  const data = completedInvestigation(over, resultOver)
  apiService.startInvestigation.mockResolvedValue({ success: true, data })
  apiService.getInvestigation.mockResolvedValue({ success: true, data })
  return data
}

export const investigateButton = () => screen.queryByRole("button", { name: /Investigate & Recommend/ })
export const legacyGenerateButton = () => screen.queryByRole("button", { name: /Generate AI Recommendation|Generate Recommendation|Generate Schema from/ })

/** Click the single primary AI action and wait for the finished result. */
export async function runInvestigation(apiService, over, resultOver) {
  if (apiService) primeInvestigation(apiService, over, resultOver)
  fireEvent.click(await screen.findByRole("button", { name: /Investigate & Recommend/ }))
  await screen.findByTestId("investigation-result")
}

export const mockInvestigationApi = () => Object.fromEntries(INVESTIGATION_ENDPOINT_FNS.map((n) => [n, vi.fn()]))
