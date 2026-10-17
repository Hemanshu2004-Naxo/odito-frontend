import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import BreadcrumbFixCard from "./BreadcrumbFixCard"
import { describeBreadcrumbPages } from "./breadcrumbFix"
import apiService from "@/lib/apiService"

vi.mock("@/lib/apiService", () => ({
  default: { getWordPressFixPreview: vi.fn(), applyWordPressSchemaFix: vi.fn(), reverifyWordPressFix: vi.fn(), rollbackWordPressFix: vi.fn() },
}))

/** The breadcrumb apply card with REAL hooks, view-model and components; only the network layer is mocked. */

const SITE = "https://www.acme.test"
const FP = "c".repeat(64)
const TRAIL = [{ name: "Home", url: `${SITE}/` }, { name: "Services", url: `${SITE}/services/` }, { name: "Local SEO", url: `${SITE}/services/local-seo/` }]
const TASK = { _id: "task-1", status: "task_created", recommendationId: "rec-1" }

const preview = ({ panelState = "ready_to_apply", plan = {}, breadcrumb = {}, record = null, lifecycle = "awaiting_approval", validation = { valid: true, errors: [] } } = {}) => ({
  success: true,
  data: {
    fixType: "breadcrumb_setting", lifecycle, record, concurrency: { writes: "read_then_write" }, source: { provider: "rank_math", bridgeVersion: "1.6.0" },
    plan: { status: "ready", code: null, message: null, fingerprint: FP, changes: [{ field: "breadcrumbs_enabled", kind: "enable", before: "", after: "on", label: "Rank Math breadcrumbs" }], blocked: [], preserved: [], notWritten: [], ...plan },
    proposedChanges: [{ field: "breadcrumbs_enabled", label: "Rank Math breadcrumbs", kind: "enable", before: "", after: "on" }],
    validation, verificationStatus: { saved: "pending", rendered: "pending" },
    breadcrumb: {
      panelState, trail: TRAIL, settingNow: "off", canonicalUrl: TRAIL[2].url, live: { status: "missing" },
      target: { label: "Rank Math → Titles & Meta → Misc → Breadcrumbs" }, manual: null,
      predicted: { predictable: true, urls: TRAIL.map((t) => t.url), reason: null },
      warnings: [{ code: "SITE_WIDE", message: "This is a site-wide Rank Math setting." }, { code: "RANK_MATH_OPTIONS", message: "Rank Math options such as Hide Homepage Link change the trail it builds." }],
      scope: { kind: "site_wide", affectedCount: 15, affectedPages: [] }, jsonLd: "<script></script>", ...breadcrumb,
    },
  },
})
const record = (status, rendered = { status: "verified", fields: [] }, saved = "verified") => ({
  id: "fix-1", status, appliedAt: "2026-10-17T10:00:00Z", changes: [{ field: "breadcrumbs_enabled", before: "", after: "on", applied: true, restored: false }],
  verification: { saved: { status: saved, reasons: [] }, rendered: { status: rendered.status, reasonCode: rendered.code || null, reasons: rendered.reasons || [], checkedAt: "2026-10-17T10:00:05Z", fields: rendered.fields || [] } },
  rollback: { status: "none", restoredFields: [], conflictFields: [] },
})

function renderCard(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><BreadcrumbFixCard projectId="p1" task={TASK} recommendationLinked {...props} /></QueryClientProvider>)
}
beforeEach(() => { vi.clearAllMocks(); apiService.getWordPressFixPreview.mockResolvedValue(preview()) })

describe("what is shown before anything is applied", () => {
  test("ready: the exact setting, the predicted trail that matches, the site-wide scope and warnings; nothing is applied before approval", async () => {
    renderCard()
    expect(await screen.findByTestId("breadcrumb-fix-state")).toHaveAttribute("data-state", "ready_to_apply")
    expect(screen.getByTestId("breadcrumb-fix-plan")).toHaveTextContent("Rank Math → Titles & Meta → Misc → Breadcrumbs")
    expect(screen.getByTestId("breadcrumb-fix-now")).toHaveTextContent("Off")
    expect(within(screen.getByTestId("breadcrumb-fix-predicted")).getAllByRole("listitem")).toHaveLength(3)
    expect(screen.getByTestId("breadcrumb-fix-warning-SITE_WIDE")).toBeInTheDocument()
    expect(screen.getByTestId("breadcrumb-fix-scope")).toHaveTextContent("15 pages")
    expect(screen.getByText("Approve and apply")).toBeDisabled()
    expect(apiService.applyWordPressSchemaFix).not.toHaveBeenCalled()
  })

  test("renders nothing until a trail is confirmed, and nothing without a task", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(preview({ panelState: "needs_trail", plan: { status: "validation_failed", code: "TRAIL_NOT_CONFIRMED" } }))
    const { container } = renderCard()
    await waitFor(() => expect(apiService.getWordPressFixPreview).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId("breadcrumb-fix-loading")).not.toBeInTheDocument())
    expect(container).toBeEmptyDOMElement()
    const none = renderCard({ task: null })
    expect(none.container).toBeEmptyDOMElement()
  })

  test("unsupported (Rank Math would build another trail, another plugin, WordPress not connected): the manual steps and NO approval or Apply", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(preview({
      panelState: "unsupported_source", plan: { status: "unsupported", code: "TRAIL_WOULD_DIFFER", message: "Rank Math would build this trail from your page structure: A › B. It differs from the one you confirmed.", changes: [] },
      breadcrumb: { target: null, manual: { provider: "rank_math", steps: ["Set this page's Parent in the page editor so the trail matches, or publish the JSON-LD.", "Add it in ONE place only."] } },
    }))
    renderCard()
    expect(await screen.findByTestId("breadcrumb-fix-state")).toHaveAttribute("data-state", "unsupported_source")
    expect(screen.getByTestId("breadcrumb-fix-text")).toHaveTextContent("It differs from the one you confirmed")
    expect(screen.getByTestId("breadcrumb-fix-manual")).toHaveTextContent("ONE place only")
    for (const id of ["breadcrumb-fix-approval", "breadcrumb-fix-plan"]) expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    expect(screen.queryByText("Approve and apply")).not.toBeInTheDocument()
  })

  test("already valid: one sentence, no apply", async () => {
    apiService.getWordPressFixPreview.mockResolvedValue(preview({ panelState: "already_valid", plan: { status: "nothing_to_change", code: "STALE_FINDING", message: "This page already outputs a valid BreadcrumbList, so there is nothing to apply.", changes: [] } }))
    renderCard()
    expect(await screen.findByTestId("breadcrumb-fix-state")).toHaveAttribute("data-state", "already_valid")
    expect(screen.getByTestId("breadcrumb-fix-text")).toHaveTextContent("nothing to apply")
    expect(screen.queryByText("Approve and apply")).not.toBeInTheDocument()
  })

  test("without a linked recommendation the person is told to create the task first — no Apply", async () => {
    renderCard({ recommendationLinked: false })
    expect(await screen.findByTestId("breadcrumb-fix-needs-task")).toBeInTheDocument()
    expect(screen.queryByText("Approve and apply")).not.toBeInTheDocument()
  })
})

describe("approve → apply", () => {
  test("approving sends ONLY the fingerprint — once, even on a double click", async () => {
    let resolve
    apiService.applyWordPressSchemaFix.mockImplementation(() => new Promise((r) => { resolve = r }))
    renderCard()
    fireEvent.click(await screen.findByRole("checkbox", { name: /I approve switching on Rank Math breadcrumbs/ }))
    const button = screen.getByText("Approve and apply")
    fireEvent.click(button); fireEvent.click(button)
    await waitFor(() => expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledTimes(1))
    expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledWith("task-1", { expectedPlanFingerprint: FP, urls: undefined, removeUrls: undefined })
    resolve({ success: true, data: { immediateVerification: "success" } })
  })

  test("a stale preview asks for a refreshed preview and the approval is spent", async () => {
    apiService.applyWordPressSchemaFix.mockRejectedValue(Object.assign(new Error("changed"), { code: "CONFLICT", status: 409, details: { reason: "preview_stale" } }))
    renderCard()
    fireEvent.click(await screen.findByRole("checkbox", { name: /I approve switching on/ }))
    fireEvent.click(screen.getByText("Approve and apply"))
    expect(await screen.findByText("Your settings changed since the preview")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /I approve switching on/ })).not.toBeChecked()
  })
})

describe("after applying — saved state and the live pages are reported separately, page by page", () => {
  const verifiedFields = [{ field: "breadcrumb_matches_confirmed", ok: true }, { field: "page:https://www.acme.test/a/", ok: true, actual: "valid" }, { field: "page:https://www.acme.test/b/", ok: false, actual: "No BreadcrumbList is published on the page." }]
  const withRecord = (rec, panelState, lifecycle) => apiService.getWordPressFixPreview.mockResolvedValue(preview({ record: rec, panelState, lifecycle }))

  test("verified: both parts verified, every other page listed with its own verdict, and the finding said to close on the next recrawl", async () => {
    withRecord(record("verified", { status: "verified", fields: verifiedFields }), "applied_verified", "verified")
    renderCard()
    expect(await screen.findByTestId("breadcrumb-fix-result-summary")).toHaveTextContent(/closed by the next recrawl/)
    expect(within(screen.getByTestId("verify-saved")).getByText("Verified")).toBeInTheDocument()
    expect(within(screen.getByTestId("verify-rendered")).getByText("Verified")).toBeInTheDocument()
    const pages = screen.getByTestId("breadcrumb-fix-pages")
    expect(pages).toHaveTextContent("www.acme.test/a/"); expect(pages).toHaveTextContent("www.acme.test/b/ — No BreadcrumbList is published on the page.")
    expect(screen.queryByTestId("breadcrumb-fix-approval")).not.toBeInTheDocument()
  })

  test("saved but not on the live page: FAILED with the reason, the finding stays open, re-verify is offered", async () => {
    withRecord(record("verification_failed", { status: "failed", code: "NOT_IN_RENDERED_PAGE", reasons: ["No BreadcrumbList is published on the page.", "WordPress may still be serving a cached copy of the page."] }), "verification_failed", "verification_failed")
    renderCard()
    expect(await screen.findByTestId("breadcrumb-fix-result-summary")).toHaveTextContent(/does not show the trail you confirmed/)
    expect(screen.getByTestId("breadcrumb-fix-state")).toHaveAttribute("data-state", "verification_failed")
    expect(within(screen.getByTestId("verify-saved")).getByText("Verified")).toBeInTheDocument()
    expect(within(screen.getByTestId("verify-rendered")).getByText("Does not match")).toBeInTheDocument()
    expect(screen.getByText(/cached copy/)).toBeInTheDocument()
    apiService.reverifyWordPressFix.mockResolvedValue({ success: true, data: {} })
    fireEvent.click(screen.getByRole("button", { name: "Re-verify" }))
    await waitFor(() => expect(apiService.reverifyWordPressFix).toHaveBeenCalledWith("task-1"))
  })

  test("pending: a page that could not be checked is never shown as verified", async () => {
    withRecord(record("applied", { status: "unverifiable", code: "FETCH_FAILED", reasons: ["The public page could not be fetched."] }), "applied_verification_pending", "applied")
    renderCard()
    expect(await screen.findByTestId("breadcrumb-fix-result-summary")).toHaveTextContent(/not verified until your live page shows it/)
    expect(within(screen.getByTestId("verify-rendered")).getByText("Cannot be checked")).toBeInTheDocument()
  })

  test("rollback asks for confirmation (site-wide) and then calls the rollback", async () => {
    withRecord(record("verified"), "applied_verified", "verified")
    apiService.rollbackWordPressFix.mockResolvedValue({ success: true, data: { message: "ok", fix: {} } })
    renderCard()
    fireEvent.click(await screen.findByRole("button", { name: /Roll back/ }))
    expect(apiService.rollbackWordPressFix).not.toHaveBeenCalled()
    expect(screen.getByTestId("breadcrumb-fix-rollback-confirm")).toHaveTextContent(/whole site/)
    fireEvent.click(screen.getByRole("button", { name: "Yes, roll back" }))
    await waitFor(() => expect(apiService.rollbackWordPressFix).toHaveBeenCalledWith("task-1"))
  })
})

describe("describeBreadcrumbPages", () => {
  test("only the page:<url> fields are the other pages; their verdict comes from the server", () => {
    expect(describeBreadcrumbPages([{ field: "breadcrumb_single", ok: true }, { field: "page:https://x.test/a", ok: true }, { field: "page:https://x.test/b", ok: false, actual: "nope" }])).toEqual([
      { url: "https://x.test/a", ok: true, detail: "valid" }, { url: "https://x.test/b", ok: false, detail: "nope" },
    ])
    expect(describeBreadcrumbPages(null)).toEqual([])
  })
})
