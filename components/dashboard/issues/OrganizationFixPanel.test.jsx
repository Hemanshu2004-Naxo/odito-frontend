import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import OrganizationFixPanel from "./OrganizationFixPanel"
import apiService from "@/lib/apiService"

vi.mock("@/lib/apiService", () => ({
  default: {
    getWordPressFixPreview: vi.fn(), applyWordPressSchemaFix: vi.fn(), reverifyWordPressFix: vi.fn(), rollbackWordPressFix: vi.fn(),
  },
}))

const FP = "b".repeat(64)
const task = { _id: "task-1" }
const apiError = (over) => Object.assign(new Error(over.message || "failed"), over)

const preview = (over = {}) => ({
  fixType: "organization_schema", projectId: "p1", targetUrl: "https://clinic.example/", lifecycle: "awaiting_approval",
  source: { provider: "rank_math", bridgeVersion: "1.4.0", writes: [] },
  schemaIntent: { type: "Hospital", action: "generate", reasons: ["The site's own markup already identifies the business as Hospital."] },
  evidence: null,
  plan: {
    status: "ready", fingerprint: FP, code: null, message: null,
    changes: [
      { field: "name", rankMathOption: "rank-math-options-titles.knowledgegraph_name" },
      { field: "type", rankMathOption: "rank-math-options-titles.local_business_type" },
    ],
    preserved: [{ field: "logo", current: "https://clinic.example/old.png", proposed: "https://clinic.example/new.png", reason: "Rank Math already has a logo; Odito does not overwrite an existing value." }],
    blocked: [], notWritten: [{ field: "telephone", message: "Verified for this recommendation but not written by Odito yet — set it in Rank Math." }],
  },
  proposedChanges: [
    { field: "name", label: "Organization name", kind: "set", before: "", after: "Clinic Eye Centre", source: "og:site_name" },
    { field: "type", label: "Business type", kind: "upgrade", before: "Organization", after: "Hospital", source: "existing_markup" },
  ],
  beforeState: {}, expectedAfterState: {}, validation: { valid: true, errors: [], warnings: [] },
  verificationStatus: { saved: "pending", rendered: "pending" }, record: null, ...over,
})
const rec = (over = {}) => ({
  id: "r1", status: "applied", approvedAt: "2026-10-15T10:00:00Z", appliedAt: "2026-10-15T10:00:01Z",
  changes: [{ field: "name", before: "", after: "Clinic Eye Centre", applied: true, restored: false }, { field: "type", before: "Organization", after: "Hospital", applied: true, restored: false }],
  verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "pending", reasons: ["The rendered page is checked on the next recrawl."] } },
  rollback: { status: "none", restoredFields: [], conflictFields: [] }, failure: null, ...over,
})

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><OrganizationFixPanel projectId="p1" task={task} /></QueryClientProvider>)
}
const respond = (data) => ({ success: true, data })

beforeEach(() => { vi.clearAllMocks() })

describe("preview", () => {
  test("loading is announced, then the exact change, the reasons, the kept values and what Odito does not write are all visible", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview()))
    renderPanel()
    expect(screen.getByTestId("fix-loading")).toBeInTheDocument()
    expect(await screen.findByTestId("fix-changes")).toBeInTheDocument()
    expect(screen.getByTestId("fix-lifecycle")).toHaveTextContent("Awaiting your approval")
    expect(screen.getByTestId("fix-why")).toHaveTextContent("Recommended type: Hospital")
    expect(screen.getByTestId("fix-why")).toHaveTextContent("already identifies the business as Hospital")
    const name = screen.getByTestId("fix-change-name")
    expect(within(name).getByText("Organization name")).toBeInTheDocument()
    expect(name).toHaveTextContent("rank-math-options-titles.knowledgegraph_name")
    expect(name).toHaveTextContent("(empty)")
    expect(name).toHaveTextContent("Clinic Eye Centre")
    expect(screen.getByTestId("fix-change-type")).toHaveTextContent("Hospital")
    expect(screen.getByTestId("fix-notes")).toHaveTextContent("Odito does not overwrite an existing value")
    expect(screen.getByTestId("fix-notes")).toHaveTextContent("telephone")
    expect(screen.getByTestId("fix-validation")).toHaveTextContent("passed validation")
    expect(screen.getByTestId("fix-not-applied")).toHaveTextContent("Nothing has been changed yet")
    expect(screen.queryByTestId("fix-result")).not.toBeInTheDocument()
  })

  test("an unsupported / blocked / nothing-to-change plan offers NO approval, with the specific reason", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({
      lifecycle: "unsupported", plan: { ...preview().plan, status: "unsupported", code: "SITE_IS_PERSON", message: "This site is configured in Rank Math as a person, not a company, so it publishes no Organization entity.", changes: [] }, proposedChanges: [],
    })))
    renderPanel()
    expect(await screen.findByTestId("fix-nothing")).toHaveTextContent("configured in Rank Math as a person")
    expect(screen.queryByRole("button", { name: /Approve and apply/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId("fix-approval")).not.toBeInTheDocument()
  })

  test("a blocked type (no address) explains what to do first", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({
      lifecycle: "proposed", plan: { ...preview().plan, status: "blocked", code: "ADDRESS_REQUIRED", message: "Hospital is a physical location, but no street address is configured.", changes: [], blocked: [{ field: "type", code: "ADDRESS_REQUIRED", message: "Hospital is a physical location, but no street address is configured in Rank Math → Local SEO." }] }, proposedChanges: [],
    })))
    renderPanel()
    expect(await screen.findByTestId("fix-blocked")).toHaveTextContent("no street address is configured")
    expect(screen.queryByRole("button", { name: /Approve and apply/ })).not.toBeInTheDocument()
  })

  test("a failed preview shows the cause and a retry; an outdated Bridge says to update the plugin", async () => {
    apiService.getWordPressFixPreview.mockRejectedValue(apiError({ status: 422, code: "FIELD_NOT_WRITABLE", message: "Applying Organization schema requires Odito SEO Bridge 1.4.0 or newer.", details: { reason: "bridge_outdated" } }))
    renderPanel()
    const box = await screen.findByTestId("fix-error")
    expect(box).toHaveTextContent("needs updating")
    expect(box).toHaveTextContent("1.4.0")
    expect(box).toHaveTextContent("Download the current Odito SEO Bridge")
  })
})

describe("approve and apply — never shows applied before WordPress confirmed", () => {
  test("Apply stays disabled until the approval box is ticked; it sends ONLY the previewed plan fingerprint", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview()))
    apiService.applyWordPressSchemaFix.mockResolvedValue(respond({ fix: rec(), alreadyApplied: false, immediateVerification: "success" }))
    renderPanel()
    const apply = await screen.findByRole("button", { name: "Approve and apply" })
    expect(apply).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox"))
    expect(apply).toBeEnabled()

    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({ lifecycle: "applied", record: rec(), plan: { ...preview().plan, status: "nothing_to_change", changes: [] }, proposedChanges: [] })))
    fireEvent.click(apply)
    await waitFor(() => expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledTimes(1))
    expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledWith("task-1", { expectedPlanFingerprint: FP })
    expect(Object.keys(apiService.applyWordPressSchemaFix.mock.calls[0][1])).toEqual(["expectedPlanFingerprint"])
  })

  test("while the request is in flight the lifecycle still says 'awaiting approval' and the button says 'Applying…' (no premature success)", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview()))
    let release
    apiService.applyWordPressSchemaFix.mockReturnValue(new Promise((r) => { release = r }))
    renderPanel()
    fireEvent.click(await screen.findByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    expect(await screen.findByRole("button", { name: "Applying to WordPress…" })).toBeDisabled()
    expect(screen.getByTestId("fix-lifecycle")).toHaveTextContent("Awaiting your approval")
    expect(screen.queryByTestId("fix-result")).not.toBeInTheDocument()
    release(respond({ fix: rec() }))
  })

  test("after a successful write: 'applied', saved verified, rendered PENDING, and the page says it is not verified yet", async () => {
    apiService.getWordPressFixPreview.mockResolvedValueOnce(respond(preview()))
    apiService.applyWordPressSchemaFix.mockResolvedValue(respond({ fix: rec() }))
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({ lifecycle: "applied", record: rec(), plan: { ...preview().plan, status: "nothing_to_change", changes: [] }, proposedChanges: [] })))
    renderPanel()
    fireEvent.click(await screen.findByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    const result = await screen.findByTestId("fix-result")
    expect(screen.getByTestId("fix-lifecycle")).toHaveTextContent("Applied — verification pending")
    expect(screen.getByTestId("fix-result-summary")).toHaveTextContent("not verified until the rendered page confirms it")
    expect(within(result).getByTestId("verify-saved")).toHaveTextContent("Verified")
    expect(within(result).getByTestId("verify-rendered")).toHaveTextContent("Not checked yet")
    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Re-verify" })).toBeInTheDocument()
  })

  test("a stale preview (409) keeps everything intact and asks for a refreshed review — no retry button", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview()))
    apiService.applyWordPressSchemaFix.mockRejectedValue(apiError({ status: 409, code: "CONFLICT", message: "changed", details: { reason: "preview_stale" } }))
    renderPanel()
    fireEvent.click(await screen.findByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    const box = await screen.findByTestId("fix-error")
    expect(box).toHaveTextContent("Your settings changed since the preview")
    expect(box).toHaveTextContent("Nothing was written")
    expect(within(box).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
    fireEvent.click(within(box).getByRole("button", { name: "Review refreshed preview" }))
    await waitFor(() => expect(apiService.getWordPressFixPreview).toHaveBeenCalledTimes(3)) // load, post-error refresh, explicit review
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  test("permission denied and a server error are explained; 'Try again' re-reads the preview and needs a FRESH approval (nothing is re-sent behind your back)", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview()))
    apiService.applyWordPressSchemaFix.mockRejectedValueOnce(apiError({ status: 403, code: "PERMISSION_DENIED", message: "You do not have permission to change site-wide SEO settings." }))
    renderPanel()
    fireEvent.click(await screen.findByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    expect(await screen.findByTestId("fix-error")).toHaveTextContent("Permission denied")
    expect(screen.getByRole("checkbox")).not.toBeChecked()

    apiService.applyWordPressSchemaFix.mockRejectedValueOnce(apiError({ status: 502, code: "WRITE_FAILED", message: "Failed to write this change to WordPress." }))
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    await waitFor(() => expect(screen.getByTestId("fix-error")).toHaveTextContent("WordPress did not respond"))
    const loads = apiService.getWordPressFixPreview.mock.calls.length
    fireEvent.click(within(screen.getByTestId("fix-error")).getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(apiService.getWordPressFixPreview.mock.calls.length).toBeGreaterThan(loads))
    expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Approve and apply" })).toBeDisabled()
  })
})

describe("verification, re-verification and rollback", () => {
  const appliedPreview = (r = rec()) => preview({ lifecycle: r.status, record: r, plan: { ...preview().plan, status: "nothing_to_change", changes: [] }, proposedChanges: [] })

  test("'verified' appears only when BOTH the saved state and the rendered page are verified", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(appliedPreview(rec({ status: "verified", verification: { saved: { status: "verified" }, rendered: { status: "verified", crawledAt: "2026-10-15T11:00:00Z" } } }))))
    renderPanel()
    expect(await screen.findByTestId("fix-lifecycle")).toHaveTextContent("Verified")
    expect(screen.getByTestId("fix-result-summary")).toHaveTextContent("WordPress holds the change and your crawled page shows it")
    expect(screen.getByTestId("verify-rendered")).toHaveTextContent("Crawl from")
  })

  test("saved ok but the rendered page differs (cache/theme): verification_failed with the reasons, saved and rendered reported separately", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(appliedPreview(rec({
      status: "verification_failed",
      verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "failed", reasons: ["The deployed entity is typed Organization but the recommendation was Hospital."] } },
    }))))
    renderPanel()
    await screen.findByTestId("fix-result")
    expect(screen.getByTestId("fix-lifecycle")).toHaveTextContent("Verification failed")
    expect(screen.getByTestId("verify-saved")).toHaveTextContent("Verified")
    expect(screen.getByTestId("verify-rendered")).toHaveTextContent("Does not match")
    expect(screen.getByTestId("verify-rendered")).toHaveTextContent("typed Organization but the recommendation was Hospital")
    expect(screen.getByTestId("fix-result-summary")).toHaveTextContent("not verified")
  })

  test("Re-verify calls the server and refreshes; an unverifiable (stale-crawl) page stays 'Cannot be checked yet'", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(appliedPreview()))
    apiService.reverifyWordPressFix.mockResolvedValue(respond({ fix: rec() }))
    renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: "Re-verify" }))
    await waitFor(() => expect(apiService.reverifyWordPressFix).toHaveBeenCalledWith("task-1"))
    apiService.getWordPressFixPreview.mockResolvedValue(respond(appliedPreview(rec({ verification: { saved: { status: "verified" }, rendered: { status: "unverifiable", reasons: ["The page has not been re-crawled since the fix was applied."] } } }))))
    fireEvent.click(screen.getByRole("button", { name: "Re-verify" }))
    await waitFor(() => expect(screen.getByTestId("verify-rendered")).toHaveTextContent("Cannot be checked yet"))
    expect(screen.getByTestId("fix-lifecycle")).not.toHaveTextContent(/^Verified/)
  })

  test("Roll back needs a confirmation, restores only Odito's fields, and reports a field a person changed since", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(appliedPreview()))
    apiService.rollbackWordPressFix.mockResolvedValue(respond({ fix: rec(), message: "Restored name; type was changed after Odito wrote it, so it was left as it is now." }))
    renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: /Roll back/ }))
    expect(apiService.rollbackWordPressFix).not.toHaveBeenCalled()
    const confirm = screen.getByTestId("rollback-confirm")
    expect(confirm).toHaveTextContent("only the fields Odito changed")
    apiService.getWordPressFixPreview.mockResolvedValue(respond(appliedPreview(rec({ rollback: { status: "partial_conflict", restoredFields: ["name"], conflictFields: ["type"] } }))))
    fireEvent.click(within(confirm).getByRole("button", { name: "Yes, roll back" }))
    await waitFor(() => expect(apiService.rollbackWordPressFix).toHaveBeenCalledWith("task-1"))
    expect(await screen.findByTestId("rollback-message")).toHaveTextContent("type was changed after Odito wrote it")
    expect(await screen.findByTestId("rollback-conflict")).toHaveTextContent("type")
  })

  test("after a full rollback the result says the previous values were restored and there is nothing left to roll back", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(appliedPreview(rec({
      status: "rolled_back", changes: [{ field: "name", before: "", after: "Clinic Eye Centre", applied: true, restored: true }], rollback: { status: "rolled_back", restoredFields: ["name"], conflictFields: [] },
    }))))
    renderPanel()
    expect(await screen.findByTestId("fix-result-summary")).toHaveTextContent("The previous values were restored")
    expect(screen.queryByRole("button", { name: /Roll back/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Re-verify" })).not.toBeInTheDocument()
  })

  test("a conflict_detected record says the change was NOT applied", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({ lifecycle: "conflict_detected", record: rec({ status: "conflict_detected", changes: [], verification: { saved: { status: "pending" }, rendered: { status: "pending" } }, rollback: { status: "none", restoredFields: ["name"], conflictFields: [] } }) })))
    renderPanel()
    expect(await screen.findByTestId("fix-result-summary")).toHaveTextContent("The change was not applied. Fields already written were put back.")
    expect(screen.getByRole("button", { name: "Approve and apply" })).toBeInTheDocument()
  })
})

describe("reliability — duplicate submits, stale approvals, unknown outcomes, rollback stages", () => {
  test("a double click sends exactly ONE apply request, and the approval is spent the moment it is used", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview()))
    let release
    apiService.applyWordPressSchemaFix.mockReturnValue(new Promise((r) => { release = r }))
    renderPanel()
    fireEvent.click(await screen.findByRole("checkbox"))
    const button = screen.getByRole("button", { name: "Approve and apply" })
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledTimes(1))
    release(respond({ fix: rec() }))
    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked())
    expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledTimes(1)
  })

  test("after a SUCCESSFUL apply the old tick cannot approve anything again (a re-shown plan needs a new approval)", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview()))
    apiService.applyWordPressSchemaFix.mockResolvedValue(respond({ fix: rec(), alreadyApplied: false }))
    renderPanel()
    fireEvent.click(await screen.findByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    await waitFor(() => expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked())
    expect(screen.getByRole("button", { name: "Approve and apply" })).toBeDisabled()
  })

  test("an unknown outcome says nothing was repeated or undone, offers 'Check status' (a re-check) and never a blind retry", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview()))
    apiService.applyWordPressSchemaFix.mockRejectedValue(apiError({ code: "OUTCOME_UNKNOWN", status: 502, message: "unknown", details: { reason: "outcome_unknown", fixId: "r1" } }))
    apiService.reverifyWordPressFix.mockResolvedValue(respond({ fix: rec() }))
    renderPanel()
    fireEvent.click(await screen.findByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    const box = await screen.findByTestId("fix-error")
    expect(box).toHaveTextContent("WordPress did not confirm the change")
    expect(box).toHaveTextContent("Nothing was repeated and nothing was undone")
    expect(within(box).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
    fireEvent.click(within(box).getByRole("button", { name: "Check status" }))
    await waitFor(() => expect(apiService.reverifyWordPressFix).toHaveBeenCalledTimes(1))
  })

  test("an apply_uncertain record: lifecycle says so, approval is gone, 'Check status' re-checks, Roll back is not offered yet", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({ lifecycle: "apply_uncertain", record: rec({ status: "apply_uncertain", changes: [{ field: "name", before: "", after: "Clinic Eye Centre", applied: false, restored: false }], verification: { saved: { status: "pending" }, rendered: { status: "pending" } } }) })))
    apiService.reverifyWordPressFix.mockResolvedValue(respond({ fix: rec() }))
    renderPanel()
    expect(await screen.findByTestId("fix-lifecycle")).toHaveTextContent("Outcome unknown — check status")
    expect(screen.getByTestId("fix-result-summary")).toHaveTextContent("Nothing was repeated or undone")
    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Roll back/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Check status" }))
    await waitFor(() => expect(apiService.reverifyWordPressFix).toHaveBeenCalledTimes(1))
  })

  test("rollback stages are shown honestly: restored-but-unconfirmed is NOT the same as confirmed, and it can be re-checked", async () => {
    const rolled = (status) => rec({ status: "rolled_back", changes: [{ field: "name", before: "", after: "Clinic Eye Centre", applied: true, restored: true }], rollback: { status, restoredFields: ["name"], conflictFields: [] } })
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({ lifecycle: "rolled_back", record: rolled("applied") })))
    const { unmount } = renderPanel()
    expect(await screen.findByTestId("rollback-stage")).toHaveTextContent("Restored — not yet confirmed from WordPress")
    expect(screen.getByTestId("fix-result-summary")).toHaveTextContent("has not been read back yet")
    expect(screen.getByRole("button", { name: "Re-verify" })).toBeInTheDocument()
    unmount()

    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({ lifecycle: "rolled_back", record: rolled("verified") })))
    renderPanel()
    expect(await screen.findByTestId("rollback-stage")).toHaveTextContent("Restored and confirmed")
    expect(screen.queryByRole("button", { name: "Re-verify" })).not.toBeInTheDocument()
  })

  test("reason codes are shown: a pending render says it is waiting for a recrawl, not 'failed'", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({ lifecycle: "applied", record: rec({ verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "pending", reasonCode: "NO_POST_WRITE_CRAWL", reasons: [] } } }), plan: { ...preview().plan, status: "nothing_to_change", changes: [] }, proposedChanges: [] })))
    renderPanel()
    expect(await screen.findByTestId("verify-rendered")).toHaveTextContent("Waiting for a recrawl")
  })

  test("an older Bridge is called out: the write is check-then-write, not one conditional step", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({ concurrency: { writes: "read_then_write" } })))
    renderPanel()
    expect(await screen.findByTestId("fix-concurrency-note")).toHaveTextContent("older than 1.5.0")
  })

  test("with the current Bridge no warning is shown", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(respond(preview({ concurrency: { writes: "database_conditional" } })))
    renderPanel()
    await screen.findByTestId("fix-changes")
    expect(screen.queryByTestId("fix-concurrency-note")).not.toBeInTheDocument()
  })
})
