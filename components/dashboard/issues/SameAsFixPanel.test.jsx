import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import SameAsFixPanel from "./SameAsFixPanel"
import apiService from "@/lib/apiService"

/**
 * The sameAs panel with REAL hooks, view-model and components; only the network layer (apiService) is mocked, so every call the panel
 * makes — and, as importantly, every call it does NOT make — is observable.
 */

vi.mock("@/lib/apiService", () => ({
  default: {
    discoverSameAs: vi.fn(),
    validateSameAs: vi.fn(),
    previewSameAs: vi.fn(),
    previewSameAsTaskFix: vi.fn(),
    applyWordPressSchemaFix: vi.fn(),
    reverifyWordPressFix: vi.fn(),
    rollbackWordPressFix: vi.fn(),
  },
}))

const PAGE = "https://acme.com/contact"
const ORG_ID = "https://acme.com/#organization"
const LI = "https://www.linkedin.com/company/acme"
const FB = "https://www.facebook.com/acme"
const PIN = "https://www.pinterest.com/acmepins"
const IG = "https://www.instagram.com/acme"
const FP = "a".repeat(64)

const cand = (id, url, platformLabel, over = {}) => ({
  id, url, platform: platformLabel.toLowerCase(), platformLabel, kind: "account", confidence: "high", score: 80, status: "suggested", preselected: true,
  verification: "linked_from_site", reachability: "not_checked", reasons: ["Linked from the header or footer of the home page."], warnings: [],
  sources: [{ method: "page_link", pageUrl: "https://acme.com/", placement: "footer", detail: "Follow" }], ...over,
})

const discovery = (over = {}) => ({
  success: true,
  data: {
    generatedAt: "t1", pageUrl: PAGE, siteUrl: "https://acme.com/", state: "candidates_discovered",
    entity: { state: "absent", id: ORG_ID, name: "Acme", types: ["Organization"], existing: { urls: [], invalid: [], duplicates: [] }, scope: { kind: "site_wide", shared: true, pagesWithSameEntity: 4, affectedPages: [] } },
    candidates: [cand("c-li", LI, "LinkedIn", { kind: "organization" }), cand("c-fb", FB, "Facebook"), cand("c-pin", PIN, "Pinterest", { confidence: "low", status: "weak", preselected: false, reasons: ["Linked from page content only."] })],
    rejected: [{ url: "https://www.linkedin.com/in/jane", code: "PERSONAL_PROFILE", message: "This is a personal profile.", pages: [] }],
    conflicts: [], ignored: {}, sources: { schema: { crawledPages: 4 }, pages: [{ url: "https://acme.com/", role: "home", status: "ok" }, { url: PAGE, role: "contact", status: "ok" }], crawlSocialLinks: 3, integrations: [] },
    ...over,
  },
})

const previewFor = (urls, removeUrls = [], over = {}, sameAsOver = {}) => ({
  success: true,
  data: {
    fixType: "organization_same_as", lifecycle: "awaiting_approval", record: null, concurrency: { writes: "read_then_write" },
    source: { provider: "rank_math", bridgeVersion: "1.6.0" },
    selection: { urls, removeUrls },
    plan: {
      status: "ready", code: null, message: null, fingerprint: FP, preserved: [], blocked: [], notWritten: [],
      changes: [
        ...urls.map((u) => ({ field: "sameAs", kind: "add", before: "", after: u, label: "Organization sameAs profile", rankMathOption: "rank-math-options-titles.social_additional_profiles" })),
        ...removeUrls.map((u) => ({ field: "sameAs", kind: "remove", before: u, after: "", label: "Organization sameAs profile", rankMathOption: "rank-math-options-titles.social_additional_profiles" })),
      ],
    },
    proposedChanges: [
      ...urls.map((u) => ({ field: "sameAs", label: "Organization sameAs profile", kind: "add", before: "", after: u })),
      ...removeUrls.map((u) => ({ field: "sameAs", label: "Organization sameAs profile", kind: "remove", before: u, after: "" })),
    ],
    validation: { valid: true, errors: [], warnings: [] },
    sameAs: {
      panelState: "ready_to_apply", scope: { kind: "site_wide", pagesWithSameEntity: 4, affectedPages: [] }, alreadyPresent: [], warnings: [],
      target: { label: "Rank Math → Titles & Meta → Local SEO → Additional profiles" }, manual: null,
      additionalSameAs: [], protectedSameAs: [],
      beforeJsonLd: JSON.stringify({ "@type": "Organization", "@id": ORG_ID, name: "Acme" }, null, 2),
      recommendedJsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", "@id": ORG_ID, name: "Acme", sameAs: urls }, null, 2),
      ...sameAsOver,
    },
    ...over,
  },
})

const TASK = { _id: "task-1", status: "task_created", recommendationId: "rec-1" }

function renderPanel(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const onCreateTask = vi.fn()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SameAsFixPanel projectId="project-1" pageUrl={PAGE} task={TASK} hasRecommendation recommendationLinked onCreateTask={onCreateTask} isCreatingTask={false} {...props} />
    </QueryClientProvider>,
  )
  return { ...utils, onCreateTask }
}

// The empty-selection plan (what the site allows, and the ledger record) is always asked for; a plan for a real selection is asked for
// only when something is selected.
const selectionsRequested = () => [...apiService.previewSameAsTaskFix.mock.calls.map((c) => c[1]), ...apiService.previewSameAs.mock.calls.map((c) => c[2])]
const requestedNonEmpty = () => selectionsRequested().filter((s) => s.urls.length || s.removeUrls.length)

const lastPreviewCall = () => {
  const calls = [...apiService.previewSameAsTaskFix.mock.calls, ...apiService.previewSameAs.mock.calls]
  return calls.at(-1)
}

beforeEach(() => {
  vi.clearAllMocks()
  apiService.discoverSameAs.mockResolvedValue(discovery())
  apiService.previewSameAsTaskFix.mockImplementation(async (_t, { urls, removeUrls }) => previewFor(urls, removeUrls))
  apiService.previewSameAs.mockImplementation(async (_p, _u, { urls, removeUrls }) => previewFor(urls, removeUrls))
  apiService.validateSameAs.mockImplementation(async (_p, _u, urls) => ({
    success: true, data: { valid: true, errors: [], items: urls.map((u) => ({ url: u.replace(/\/+$/, ""), platform: "x", platformLabel: "X (Twitter)", kind: "account", warnings: [], normalized: {} })) },
  }))
})

describe("discovery → review", () => {
  test("lists what was found with where it was seen; only the confident ones start selected; nothing is written", async () => {
    renderPanel()
    expect(await screen.findByTestId("sameas-entry-c-li")).toBeInTheDocument()
    expect(apiService.discoverSameAs).toHaveBeenCalledWith("project-1", PAGE)
    expect(within(screen.getByTestId("sameas-entry-c-li")).getByRole("checkbox")).toBeChecked()
    expect(within(screen.getByTestId("sameas-entry-c-fb")).getByRole("checkbox")).toBeChecked()
    expect(within(screen.getByTestId("sameas-entry-c-pin")).getByRole("checkbox")).not.toBeChecked()
    expect(within(screen.getByTestId("sameas-entry-c-li")).getByText("Linked in the footer of /")).toBeInTheDocument()
    expect(within(screen.getByTestId("sameas-entry-c-pin")).getByText("Weak match")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId("sameas-state")).toHaveAttribute("data-state", "ready_to_apply"))
    expect(screen.getByTestId("sameas-discovery-summary")).toHaveTextContent("Looked at 2 pages")
    expect(apiService.applyWordPressSchemaFix).not.toHaveBeenCalled()
  })

  test("every candidate says the server did not open its link; ignored links are explained", async () => {
    renderPanel()
    const row = await screen.findByTestId("sameas-entry-c-li")
    expect(within(row).getByText(/has not checked that the page loads/)).toBeInTheDocument()
    expect(within(row).getByRole("link", { name: new RegExp(LI) })).toHaveAttribute("rel", expect.stringContaining("noopener"))
    fireEvent.click(screen.getByText(/Links Odito did not suggest/))
    expect(screen.getByText(/personal profile/)).toBeInTheDocument()
  })

  test("nothing confident: nothing is selected for the person and no preview is requested", async () => {
    apiService.discoverSameAs.mockResolvedValue(discovery({ state: "needs_confirmation", candidates: [cand("c-fb", FB, "Facebook", { confidence: "medium", status: "needs_confirmation", preselected: false })] }))
    renderPanel({ task: null })
    expect(await screen.findByTestId("sameas-entry-c-fb")).toBeInTheDocument()
    expect(within(screen.getByTestId("sameas-entry-c-fb")).getByRole("checkbox")).not.toBeChecked()
    expect(screen.getByTestId("sameas-state")).toHaveAttribute("data-state", "needs_confirmation")
    expect(requestedNonEmpty()).toEqual([])
  })

  test("no links found: the panel says so, offers manual entry and 'continue without links', and never writes", async () => {
    apiService.discoverSameAs.mockResolvedValue(discovery({ state: "none_found", candidates: [], rejected: [] }))
    renderPanel({ task: null })
    expect(await screen.findByTestId("sameas-no-candidates")).toBeInTheDocument()
    expect(screen.getByTestId("sameas-state")).toHaveAttribute("data-state", "none_found")
    expect(screen.getByTestId("sameas-state-text")).toHaveTextContent(/will not invent one/)
    expect(screen.getByLabelText("Add a profile link")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("sameas-no-links"))
    expect(screen.getByTestId("sameas-state")).toHaveAttribute("data-state", "no_selection")
    expect(requestedNonEmpty()).toEqual([])
    expect(apiService.applyWordPressSchemaFix).not.toHaveBeenCalled()
  })

  test("existing sameAs: published profiles are shown as kept; only Odito-managed ones can be removed", async () => {
    apiService.discoverSameAs.mockResolvedValue(discovery({
      state: "existing_present", candidates: [],
      entity: { state: "populated", id: ORG_ID, name: "Acme", existing: { urls: [FB, IG], invalid: [], duplicates: [] }, scope: { kind: "site_wide", pagesWithSameEntity: 4, affectedPages: [] } },
    }))
    apiService.previewSameAsTaskFix.mockImplementation(async (_t, { urls, removeUrls }) => previewFor(urls, removeUrls, {}, { additionalSameAs: [IG], protectedSameAs: [FB] }))
    renderPanel()
    const existing = await screen.findByTestId("sameas-existing")
    expect(within(existing).getByText(FB)).toBeInTheDocument()
    await waitFor(() => expect(within(existing).getAllByRole("checkbox")).toHaveLength(1)) // only the additional one is removable
    fireEvent.click(within(existing).getByRole("checkbox"))
    await waitFor(() => expect(lastPreviewCall()).toBeTruthy())
    await waitFor(() => expect(apiService.previewSameAsTaskFix).toHaveBeenLastCalledWith("task-1", { urls: [], removeUrls: [IG] }))
    expect(await screen.findByTestId("sameas-change-remove")).toHaveTextContent(IG)
  })
})

describe("manual entry, edit, remove — validated inline", () => {
  test("a typed link is checked locally first (no network for an obviously wrong one), then by the server", async () => {
    renderPanel()
    await screen.findByTestId("sameas-entry-c-li")
    const input = screen.getByLabelText("Add a profile link")
    fireEvent.change(input, { target: { value: "http://x.com/acme" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    expect(await screen.findByTestId("sameas-new-error")).toHaveTextContent(/https/)
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    expect(await screen.findByTestId("sameas-new-error")).toHaveTextContent(/not a web address/)
    expect(apiService.validateSameAs).not.toHaveBeenCalled()

    apiService.validateSameAs.mockResolvedValueOnce({ success: true, data: { valid: false, errors: [{ index: 0, code: "PERSONAL_PROFILE", message: "This is a personal profile." }], items: [] } })
    fireEvent.change(input, { target: { value: "https://www.linkedin.com/in/jane" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    expect(await screen.findByTestId("sameas-new-error")).toHaveTextContent("This is a personal profile.")
    expect(screen.queryByText("Added by you")).not.toBeInTheDocument()
  })

  test("a valid link joins the list as 'Added by you', is selected, and goes into the plan; a duplicate is refused", async () => {
    renderPanel()
    await screen.findByTestId("sameas-entry-c-li")
    const input = screen.getByLabelText("Add a profile link")
    fireEvent.change(input, { target: { value: "https://x.com/acme/" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    expect(await screen.findByText("Added by you", { selector: "span" })).toBeInTheDocument()
    await waitFor(() => expect(apiService.previewSameAsTaskFix).toHaveBeenLastCalledWith("task-1", { urls: expect.arrayContaining([LI, FB, "https://x.com/acme"]), removeUrls: [] }))
    expect(input).toHaveValue("")

    fireEvent.change(input, { target: { value: LI } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    expect(await screen.findByTestId("sameas-new-error")).toHaveTextContent("already in the list")
  })

  test("a discovered link can be corrected: the corrected, re-validated URL is what is planned", async () => {
    renderPanel()
    fireEvent.click(await screen.findByLabelText(`Edit ${FB}`))
    const edit = screen.getByLabelText("Edit profile link")
    fireEvent.change(edit, { target: { value: "https://www.facebook.com/acme-official" } })
    fireEvent.click(screen.getByRole("button", { name: "Save link" }))
    await waitFor(() => expect(apiService.previewSameAsTaskFix).toHaveBeenLastCalledWith("task-1", { urls: expect.arrayContaining(["https://www.facebook.com/acme-official"]), removeUrls: [] }))
    expect(lastPreviewCall()[1].urls).not.toContain(FB)
    expect(screen.getByText("Edited by you")).toBeInTheDocument()
  })

  test("a link can be removed and restored", async () => {
    renderPanel()
    fireEvent.click(await screen.findByLabelText(`Remove ${FB}`))
    expect(screen.queryByTestId("sameas-entry-c-fb")).not.toBeInTheDocument()
    await waitFor(() => expect(apiService.previewSameAsTaskFix).toHaveBeenLastCalledWith("task-1", { urls: [LI], removeUrls: [] }))
    fireEvent.click(within(screen.getByTestId("sameas-dismissed")).getByRole("button", { name: /Restore/ }))
    expect(await screen.findByTestId("sameas-entry-c-fb")).toBeInTheDocument()
  })
})

describe("preview → approve → apply", () => {
  test("shows the exact change, the scope, the target and the structured data; nothing is applied before approval", async () => {
    renderPanel()
    expect(await screen.findByTestId("sameas-changes")).toHaveTextContent(LI)
    expect(screen.getByTestId("sameas-changes")).toHaveTextContent(FB)
    expect(screen.getByTestId("sameas-changes")).toHaveTextContent("Rank Math → Titles & Meta → Local SEO → Additional profiles")
    expect(screen.getByTestId("sameas-scope")).toHaveTextContent(/site-wide \(4 crawled pages/)
    const after = JSON.parse(screen.getByTestId("sameas-jsonld-after").textContent)
    expect(after.sameAs).toEqual([LI, FB]); expect(after["@id"]).toBe(ORG_ID)
    expect(screen.getByTestId("sameas-validation")).toHaveTextContent(/passed validation/)
    expect(screen.getByText("Approve and apply")).toBeDisabled()
    expect(apiService.applyWordPressSchemaFix).not.toHaveBeenCalled()
  })

  test("approving sends the fingerprint and exactly the previewed links — once, even on a double click", async () => {
    let resolve
    apiService.applyWordPressSchemaFix.mockImplementation(() => new Promise((r) => { resolve = r }))
    renderPanel()
    fireEvent.click(await screen.findByRole("checkbox", { name: /I approve adding exactly/ }))
    const button = screen.getByText("Approve and apply")
    fireEvent.click(button); fireEvent.click(button)
    await waitFor(() => expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledTimes(1))
    expect(apiService.applyWordPressSchemaFix).toHaveBeenCalledWith("task-1", { expectedPlanFingerprint: FP, urls: [LI, FB], removeUrls: [] })
    expect(screen.getByText("Applying to WordPress…")).toBeDisabled()
    resolve({ success: true, data: { immediateVerification: "success" } })
  })

  test("no task yet: the panel says what is needed and offers to create it — never an Apply", async () => {
    const { onCreateTask } = renderPanel({ task: null, recommendationLinked: false })
    expect(await screen.findByTestId("sameas-needs-task")).toHaveTextContent(/Create a task for this page/)
    expect(screen.queryByText("Approve and apply")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Create task" }))
    expect(onCreateTask).toHaveBeenCalledTimes(1)
    expect(apiService.previewSameAs).toHaveBeenCalledWith("project-1", PAGE, { urls: [LI, FB], removeUrls: [] })
  })

  test("without a recommendation yet it asks for one first", async () => {
    renderPanel({ task: null, recommendationLinked: false, hasRecommendation: false })
    expect(await screen.findByTestId("sameas-needs-task")).toHaveTextContent(/Generate the AI recommendation above first/)
  })

  test("a stale preview error offers the refreshed preview and keeps the person's selection", async () => {
    apiService.applyWordPressSchemaFix.mockRejectedValue(Object.assign(new Error("changed"), { code: "CONFLICT", status: 409, details: { reason: "preview_stale" } }))
    renderPanel()
    fireEvent.click(await screen.findByRole("checkbox", { name: /I approve adding exactly/ }))
    fireEvent.click(screen.getByText("Approve and apply"))
    expect(await screen.findByText("Your settings changed since the preview")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Review refreshed preview" })).toBeInTheDocument()
    expect(within(screen.getByTestId("sameas-entry-c-li")).getByRole("checkbox")).toBeChecked()
  })

  test("an invalid link reported by the server is shown with its reason", async () => {
    apiService.previewSameAsTaskFix.mockRejectedValue(Object.assign(new Error("One or more profile links are not valid."), { code: "INVALID_PROFILES", status: 400, details: { errors: [{ index: 0, message: "This looks like a placeholder or example address." }] } }))
    renderPanel()
    expect(await screen.findByText("A link is not valid")).toBeInTheDocument()
    expect(screen.getByText(/placeholder or example address/)).toBeInTheDocument()
  })
})

describe("unsupported and blocked sources — a manual path, never a fake Apply", () => {
  test("another SEO plugin: the steps and the same structured data are shown; no approval", async () => {
    apiService.previewSameAsTaskFix.mockImplementation(async (_t, { urls }) => previewFor(urls, [], {
      plan: { status: "unsupported", code: "PROVIDER_NOT_SUPPORTED", message: "Organization sameAs can only be changed through Rank Math. This site uses yoast.", fingerprint: FP, changes: [], preserved: [], blocked: [], notWritten: [] },
      proposedChanges: [], lifecycle: "unsupported",
    }, { panelState: "unsupported_source", manual: { provider: "yoast", steps: ["In WordPress go to Yoast SEO → Settings → Site representation → Social profiles.", "Add the profile URLs to the Organization that already exists — do not add a second Organization."] } }))
    renderPanel()
    const box = await screen.findByTestId("sameas-unsupported")
    expect(box).toHaveTextContent("Yoast SEO")
    expect(box).toHaveTextContent("do not add a second Organization")
    expect(screen.getByTestId("sameas-state")).toHaveAttribute("data-state", "unsupported_source")
    expect(screen.queryByText("Approve and apply")).not.toBeInTheDocument()
    expect(screen.queryByTestId("sameas-approval")).not.toBeInTheDocument()
    expect(JSON.parse((await screen.findByTestId("sameas-jsonld-after")).textContent).sameAs).toEqual([LI, FB])
  })

  test("a blocked plan explains what to fix", async () => {
    apiService.previewSameAsTaskFix.mockImplementation(async (_t, { urls }) => previewFor(urls, [], {
      plan: { status: "blocked", code: "BRIDGE_UPDATE_REQUIRED", message: "Update the Odito SEO Bridge.", fingerprint: FP, changes: [], preserved: [], blocked: [{ field: "sameAs", code: "BRIDGE_UPDATE_REQUIRED", message: "Update the Odito SEO Bridge plugin." }], notWritten: [] },
      proposedChanges: [],
    }))
    renderPanel()
    expect(await screen.findByTestId("sameas-blocked")).toHaveTextContent("Update the Odito SEO Bridge plugin.")
    expect(screen.queryByText("Approve and apply")).not.toBeInTheDocument()
  })
})

describe("after applying — saved state and public page are reported separately", () => {
  const record = (status, rendered, saved = "verified", extra = {}) => ({
    id: "fix-1", status, appliedAt: "2026-10-17T10:00:00Z",
    changes: [{ field: "sameAs", before: "", after: LI, applied: true, restored: false }, { field: "sameAs", before: "", after: FB, applied: true, restored: false }],
    verification: {
      saved: { status: saved, reasons: [] },
      rendered: { status: rendered.status, reasonCode: rendered.code || null, reasons: rendered.reasons || [], checkedAt: "2026-10-17T10:00:05Z", fields: rendered.fields || [] },
    },
    rollback: { status: "none", restoredFields: [], conflictFields: [] }, ...extra,
  })
  const withRecord = (rec, lifecycle) => apiService.previewSameAsTaskFix.mockImplementation(async (_t, { urls, removeUrls }) => previewFor(urls, removeUrls, { record: rec, lifecycle }, { panelState: "applied_verification_pending" }))

  test("verified: both parts are verified and the finding is said to be closed by the next recrawl", async () => {
    withRecord(record("verified", { status: "verified", fields: [{ field: "approved_urls_present", ok: true }, { field: "no_second_organization", ok: true }] }), "verified")
    renderPanel()
    expect(await screen.findByTestId("sameas-result-summary")).toHaveTextContent(/shows it/)
    expect(screen.getByTestId("sameas-state")).toHaveAttribute("data-state", "applied_verified")
    expect(within(screen.getByTestId("verify-saved")).getByText("Verified")).toBeInTheDocument()
    expect(within(screen.getByTestId("verify-rendered")).getByText("Verified")).toBeInTheDocument()
    expect(screen.getByTestId("verify-rendered-checks")).toHaveTextContent("approved urls present")
    expect(screen.queryByTestId("sameas-approval")).not.toBeInTheDocument()
  })

  test("saved but not on the public page: verification FAILED, the finding stays open, and the reason mentions the cache", async () => {
    withRecord(record("verification_failed", { status: "failed", code: "NOT_IN_RENDERED_PAGE", reasons: ["Missing from the published sameAs", "WordPress may still be serving a cached copy of the page."], fields: [{ field: "approved_urls_present", ok: false, actual: "Missing" }] }), "verification_failed")
    renderPanel()
    expect(await screen.findByTestId("sameas-result-summary")).toHaveTextContent(/not verified/)
    expect(screen.getByTestId("sameas-state")).toHaveAttribute("data-state", "verification_failed")
    expect(within(screen.getByTestId("verify-saved")).getByText("Verified")).toBeInTheDocument()
    expect(within(screen.getByTestId("verify-rendered")).getByText("Does not match")).toBeInTheDocument()
    expect(screen.getByText(/cached copy/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Re-verify" }))
    await waitFor(() => expect(apiService.reverifyWordPressFix).toHaveBeenCalledWith("task-1"))
  })

  test("pending: applied but the public page could not be checked is never shown as verified", async () => {
    withRecord(record("applied", { status: "unverifiable", code: "FETCH_FAILED", reasons: ["The public page could not be fetched."] }), "applied")
    renderPanel()
    expect(await screen.findByTestId("sameas-result-summary")).toHaveTextContent(/not verified until your public page shows it/)
    expect(screen.getByTestId("sameas-state")).toHaveAttribute("data-state", "applied_verification_pending")
    expect(within(screen.getByTestId("verify-rendered")).getByText("Cannot be checked")).toBeInTheDocument()
  })

  test("rollback needs a confirmation and then calls the rollback", async () => {
    withRecord(record("verified", { status: "verified" }), "verified")
    apiService.rollbackWordPressFix.mockResolvedValue({ success: true, data: { message: "Restored the previous values.", fix: {} } })
    renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: /Roll back/ }))
    expect(apiService.rollbackWordPressFix).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Yes, roll back" }))
    await waitFor(() => expect(apiService.rollbackWordPressFix).toHaveBeenCalledWith("task-1"))
  })
})

describe("discovery failure", () => {
  test("is reported with a retry, and manual entry still works", async () => {
    apiService.discoverSameAs.mockRejectedValueOnce(Object.assign(new Error("The service is unavailable."), { status: 503 }))
    renderPanel({ task: null })
    expect(await screen.findByTestId("fix-error")).toBeInTheDocument()
    expect(screen.getByLabelText("Add a profile link")).toBeInTheDocument()
    apiService.discoverSameAs.mockResolvedValue(discovery())
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("sameas-entry-c-li")).toBeInTheDocument()
  })

  test("'Look again' asks the server to bypass its memo", async () => {
    renderPanel()
    await screen.findByTestId("sameas-entry-c-li")
    apiService.discoverSameAs.mockResolvedValue(discovery({ generatedAt: "t2" }))
    fireEvent.click(screen.getByRole("button", { name: /Look again/ }))
    await waitFor(() => expect(apiService.discoverSameAs).toHaveBeenLastCalledWith("project-1", PAGE, { refresh: true }))
  })
})
