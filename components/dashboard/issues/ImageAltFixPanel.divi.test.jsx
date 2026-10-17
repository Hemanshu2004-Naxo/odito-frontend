import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ImageAltFixPanel from "./ImageAltFixPanel"
import { clearAllDrafts } from "./altDraftStore"
import { describeAltError, describeResultSummary, describeSource, getImageAltModel } from "./imageAltFix"
import apiService from "@/lib/apiService"

/**
 * The Divi page-module target in the existing Apply via WordPress workflow: the source card names the exact write target, the approval is
 * for the exact text and module, and every state is explicit. Real Sapphire shapes: #301 (a Divi Fullwidth Header module, writable) and
 * #130 (the Theme Builder header logo, manual). Real panel + real hooks; only HTTP is mocked.
 */
vi.mock("@/lib/apiService", () => ({
  default: { listImageAltImages: vi.fn(), previewImageAltFix: vi.fn(), applyImageAltFix: vi.fn(), reverifyImageAltFix: vi.fn(), rollbackImageAltFix: vi.fn() },
}))

const FP = "d".repeat(64)
const HERO = "https://sapphiredigitalagency.com/wp-content/uploads/2025/12/Digital-Marketing-Agency-That-Delivers-Real-Results.webp"
const LOGO = "https://sapphiredigitalagency.com/wp-content/uploads/2025/12/sapphire-digital-Agency-1.webp"
const AI = "Digital marketing agency team reviewing campaign results"
const task = { _id: "task-1" }
const respond = (data) => ({ success: true, data })
const row = (src, over = {}) => ({ src, altState: "empty", hasAttachmentHint: true, decorativeSignals: false, figcaption: null, fix: null, aiSuggestion: false, resourceKind: "wp_media", mediaLibraryCandidate: true, ...over })

const DIVI_SOURCE = {
  kind: "divi_page_module", label: "Divi page module", moduleLabel: "Divi Fullwidth Header module", module: "et_pb_fullwidth_header", identifier: "pages/6:et_pb_fullwidth_header[0]",
  postId: 6, postType: "pages", imageAttribute: "header_image_url", altAttribute: "image_alt_text", attributePresent: false, storedValue: "", diviVersion: "4.27.7", format: "divi4_shortcode",
  evidence: "divi_builder_source",
  evidenceNote: "The attribute name comes from this Divi version's own builder source. This module has no stored value on your site yet, so the first change is also the first proof: Odito re-reads the live page afterwards and reports it if the alt does not appear.",
  writeTarget: "The image_alt_text attribute of the et_pb_fullwidth_header module that shows this image, in the content of page 6. Nothing else on the page changes.",
  verification: "Odito reads the page back, proves only that attribute changed, then fetches the live page and checks that exactly this occurrence now renders the approved alt text. The audit finding is resolved only by the next successful analysis of the page.",
  writeMode: "read_then_write", rendered: { occurrences: 1, withoutAlt: 1 },
}
const diviPreview = (text, over = {}) => ({
  fixType: "image_alt", targetUrl: "https://www.sapphiredigitalagency.com/", image: { sourceUrl: HERO, altState: "empty" },
  identity: { status: "resolved", attachmentId: 301, confidence: "high", method: "attachment_id_class", evidence: ["The image carries the WordPress class wp-image-301."], matchedUrls: [HERO] },
  field: "divi_module_alt", setting: "Divi page module → et_pb_fullwidth_header (pages/6) → image_alt_text", classification: { kind: "ambiguous", decorative: false, signals: [] },
  source: DIVI_SOURCE, concurrency: { writes: "read_then_write", creationWindow: false },
  current: { alt: "", note: 'The module has no alt attribute of its own, so Divi renders alt="".', rendered: "" }, proposed: { alt: text || null },
  suggestions: [], validation: { ok: text ? true : null, errors: [], warnings: [] }, contentEffect: { status: "builder_reference" },
  diagnosis: { state: "library_alt_overridden", source: "page_builder_module", sourceLabel: "A page-builder module on this page", fixMechanism: "page_content", supported: true, renderedAlt: "", libraryAlt: "Professional digital marketing agency team", libraryMeaningful: true, builder: "Divi", evidence: [], manual: null },
  plan: text ? { status: "ready", code: null, fingerprint: FP, message: null, change: { field: "divi_module_alt", before: "", after: text } } : { status: "needs_input", code: "ALT_TEXT_REQUIRED", fingerprint: FP, message: "No alt text has been prepared yet. It will be written to the alt attribute of the Divi Fullwidth Header module that shows this image (the media library is not changed)." },
  recommendation: null, verificationStatus: { saved: "pending", rendered: "pending" }, record: null, ...over,
})
const diviRecord = (over = {}) => ({
  id: "r1", status: "verified", target: { sourceKind: "divi_page_module", module: "et_pb_fullwidth_header" },
  changes: [{ field: "divi_module_alt", before: "", after: AI, applied: true, restored: false }],
  verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "verified", reasons: ["Confirmed on a fresh fetch of the live page. The finding resolves after the next successful analysis of the page."] } },
  rollback: { status: "none" }, ...over,
})
const MANUAL_LOGO = {
  fixType: "image_alt", targetUrl: "https://www.sapphiredigitalagency.com/", image: { sourceUrl: LOGO, altState: "empty" },
  identity: { status: "resolved", attachmentId: 130, confidence: "high", method: "attachment_id_class", evidence: [], matchedUrls: [LOGO] },
  field: "alt_text", setting: null, classification: { kind: "ambiguous", decorative: false, signals: [] },
  source: { kind: "manual", label: "Theme Builder / template (not editable by Odito)", code: "THEME_TEMPLATE_NOT_EDITABLE", status: "unsupported", message: "On Divi, headers, footers and body areas are Theme Builder layouts. WordPress does not expose them through its REST API, so Odito cannot read or change them. In Divi > Theme Builder, open the header template, edit the Menu module that shows this logo and set its logo alt text (Divi stores it as the module's logo_alt setting)." },
  current: { alt: "Sapphire Digital Agency", note: "" }, proposed: { alt: null }, suggestions: [], validation: { ok: null, errors: [], warnings: [] }, contentEffect: { status: "not_in_content" },
  diagnosis: { state: "library_alt_overridden", source: "theme_template", sourceLabel: "A theme or builder template", fixMechanism: "theme_template", supported: false, renderedAlt: "", libraryAlt: "Sapphire Digital Agency", libraryMeaningful: true, builder: "Divi", evidence: [], manual: "Set the alt text in that template." },
  plan: { status: "rendered_mismatch", code: "RENDERED_ALT_OVERRIDES_LIBRARY", fingerprint: FP, change: null, message: "WordPress already holds alt text for this image, but the page renders alt=\"\"." },
  recommendation: null, verificationStatus: { saved: "pending", rendered: "pending" }, record: null,
}
const MEDIA_SOURCE = { kind: "media_library", label: "WordPress media library", identifier: "attachment 42", attachmentId: 42, writeTarget: "The alt text field of media-library attachment 42. Nothing else about the attachment changes.", verification: "Odito reads the alt text back from WordPress, then confirms the rendered page after the next recrawl." }

let previewFn
function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ImageAltFixPanel projectId="p1" task={task} /></QueryClientProvider>)
}
const choose = async (n = 0) => { const rows = await screen.findAllByTestId("alt-image-row"); fireEvent.click(rows[n]) }
const box = () => screen.getByLabelText(/Alt text — what the image shows/)
const slow = { timeout: 3000 }

beforeEach(() => {
  vi.clearAllMocks(); clearAllDrafts()
  apiService.listImageAltImages.mockResolvedValue(respond({ images: [row(HERO), row(LOGO)] }))
  previewFn = (input) => (input.imageSrc === LOGO ? MANUAL_LOGO : diviPreview(input.proposedAlt))
  apiService.previewImageAltFix.mockImplementation(async (_id, input) => respond(previewFn(input)))
})

describe("Image B — a supported Divi module: the full source details, then review, approval, apply", () => {
  test("shows the exact page, image, attachment, source type, identifier, module, setting, stored value, write target and verification method", async () => {
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-source", {}, slow)).toBeInTheDocument()
    // a module Odito CAN edit keeps the full workflow — never the compact manual card
    expect(screen.queryByTestId("alt-manual-fix")).not.toBeInTheDocument()
    expect(screen.getByTestId("alt-source-chip")).toHaveTextContent("Divi page module")
    expect(screen.getByTestId("alt-source-type")).toHaveTextContent("Divi page module")
    expect(screen.getByTestId("alt-source-id")).toHaveTextContent("pages/6:et_pb_fullwidth_header[0]")
    expect(screen.getByTestId("alt-source-module")).toHaveTextContent("Divi Fullwidth Header module (et_pb_fullwidth_header)")
    expect(screen.getByTestId("alt-source-attr")).toHaveTextContent("image_alt_text")
    expect(screen.getByTestId("alt-source-stored")).toHaveTextContent("Not set — the module has no alt attribute")
    expect(screen.getByTestId("alt-source")).toHaveTextContent("https://www.sapphiredigitalagency.com/")
    expect(screen.getByTestId("alt-source")).toHaveTextContent("attachment #301")
    expect(screen.getByTestId("alt-source")).toHaveTextContent("Divi 4.27.7")
    expect(screen.getByTestId("alt-source-target")).toHaveTextContent("image_alt_text attribute of the et_pb_fullwidth_header module")
    expect(screen.getByTestId("alt-source-verification")).toHaveTextContent(/fetches the live page/)
    expect(screen.getByTestId("alt-source-evidence")).toHaveTextContent(/first change is also the first proof/)
    expect(screen.getByTestId("alt-source-writemode")).toHaveTextContent(/no conditional write for page content/)
  })

  test("nothing prepared yet: no before/after, no approval, no apply — the person writes or reuses the text", async () => {
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-no-change", {}, slow)).toBeInTheDocument()
    expect(screen.queryByTestId("alt-change")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Approve and apply/ })).not.toBeInTheDocument()
  })

  test("with text: the real before/after (module now, rendered now, after), then states Ready for review -> Preview approved; Apply needs the tick", async () => {
    renderPanel()
    await choose(0)
    await screen.findByTestId("alt-source", {}, slow)
    fireEvent.change(box(), { target: { value: AI } })
    expect(await screen.findByTestId("alt-approval", {}, slow)).toBeInTheDocument()
    expect(screen.getByTestId("alt-current")).toHaveTextContent("(no alt attribute)")
    expect(screen.getByTestId("alt-rendered-now")).toHaveTextContent('alt="" (empty)')
    expect(screen.getByTestId("alt-proposed")).toHaveTextContent(AI)
    expect(screen.getByTestId("alt-approval-state")).toHaveTextContent("Ready for review")
    const apply = screen.getByRole("button", { name: "Approve and apply" })
    expect(apply).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting the alt text of the Divi module pages\/6:et_pb_fullwidth_header/ }))
    expect(screen.getByTestId("alt-approval-state")).toHaveTextContent("Preview approved")
    expect(apply).toBeEnabled()
    expect(screen.getByTestId("alt-not-applied")).toHaveTextContent(/touches only that one setting/)
    expect(screen.queryByTestId("alt-concurrency-note")).not.toBeInTheDocument()
  })

  test("APPLY sends only the image, the text and the fingerprint (never the module, page or attribute); success reads 'applied and verified'", async () => {
    apiService.applyImageAltFix.mockResolvedValue(respond({ fix: diviRecord(), alreadyApplied: false, immediateVerification: "success" }))
    renderPanel()
    await choose(0)
    await screen.findByTestId("alt-source", {}, slow)
    fireEvent.change(box(), { target: { value: AI } })
    await screen.findByTestId("alt-approval", {}, slow)
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting the alt text of the Divi module/ }))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    await waitFor(() => expect(apiService.applyImageAltFix).toHaveBeenCalledTimes(1))
    expect(apiService.applyImageAltFix).toHaveBeenCalledWith("task-1", { imageSrc: HERO, proposedAlt: AI, informative: false, expectedPlanFingerprint: FP })
  })
})

describe("every state is explicit", () => {
  const withRecord = (record) => { previewFn = (input) => (input.imageSrc === HERO ? diviPreview(AI, { record, plan: { status: "ready", code: null, fingerprint: FP, message: null, change: { field: "divi_module_alt", before: "", after: AI } } }) : MANUAL_LOGO) }

  test("Applied and verified: the Divi wording — module holds it, the live page renders it, the finding resolves after the next analysis", async () => {
    withRecord(diviRecord())
    renderPanel(); await choose(0)
    expect(await screen.findByTestId("alt-result-summary", {}, slow)).toHaveTextContent(/The Divi module holds the alt text and the live page renders it on exactly this image.*resolves after the next successful analysis/)
    expect(screen.getByTestId("alt-verify-saved")).toBeInTheDocument()
  })

  test("Applied; verification pending: says so and does not claim it is verified", async () => {
    withRecord(diviRecord({ status: "applied", verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "pending", reasons: ["Not confirmed yet."] } } }))
    renderPanel(); await choose(0)
    const summary = await screen.findByTestId("alt-result-summary", {}, slow)
    expect(summary).toHaveTextContent("Applied — verification pending")
    expect(summary).not.toHaveTextContent(/live page renders it on exactly this image/)
  })

  test("Verification failed: the module holds the text but the live page does not show it — the reason is shown and a rollback is offered", async () => {
    withRecord(diviRecord({ status: "verification_failed", verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "failed", reasonCode: "RENDERED_UNCHANGED", reasons: ["The module now holds the new alt text, but the live page still renders none for this image."] } } }))
    renderPanel(); await choose(0)
    expect(await screen.findByTestId("alt-result-summary", {}, slow)).toHaveTextContent("not verified")
    expect(screen.getByTestId("alt-verify-rendered")).toHaveTextContent(/still renders none/)
    expect(screen.getByRole("button", { name: /Roll back/ })).toBeInTheDocument()
  })

  test("Rolled back: the Divi wording", async () => {
    withRecord(diviRecord({ status: "rolled_back", changes: [{ field: "divi_module_alt", before: "", after: AI, applied: true, restored: true }], rollback: { status: "verified", saved: { status: "verified", reasons: [] } } }))
    renderPanel(); await choose(0)
    expect(await screen.findByTestId("alt-result-summary", {}, slow)).toHaveTextContent(/Divi module was put back as it was/)
  })

  test("Conflict detected; refresh preview: a changed page is explained, nothing was written, and the refreshed preview is one click away", async () => {
    apiService.applyImageAltFix.mockRejectedValue(Object.assign(new Error("The page changed"), { code: "CONFLICT", details: { reason: "page_changed" } }))
    renderPanel(); await choose(0)
    await screen.findByTestId("alt-source", {}, slow)
    fireEvent.change(box(), { target: { value: AI } })
    await screen.findByTestId("alt-approval", {}, slow)
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting the alt text of the Divi module/ }))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    const box2 = await screen.findByTestId("alt-error")
    expect(box2).toHaveTextContent("Conflict detected — the page changed")
    expect(box2).toHaveTextContent("Nothing was overwritten")
    expect(screen.getByRole("button", { name: "Review refreshed preview" })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /I approve setting the alt text of the Divi module/ })).not.toBeChecked()
  })
})

describe("Image A — the Theme Builder header logo: compact manual-fix card", () => {
  test("one short card (Divi Builder Image, one sentence, page, image preview); the specific setting is behind 'View instructions'; no text box, no before/after, no approval, no apply", async () => {
    renderPanel()
    await choose(1)
    expect(await screen.findByTestId("alt-manual-title", {}, slow)).toHaveTextContent("Divi Builder Image")
    expect(screen.getByTestId("alt-manual-message")).toHaveTextContent("Odito can't update this image automatically. Edit its alt text in Divi Builder.")
    expect(screen.getByTestId("alt-manual-image")).toBeInTheDocument()
    expect(screen.getByTestId("alt-manual-page")).toHaveTextContent("https://")
    expect(screen.getByText("View instructions")).toBeInTheDocument()
    expect(screen.getByTestId("alt-manual-instructions")).toHaveTextContent(/logo_alt/)
    // none of the long explanations
    for (const id of ["alt-source-chip", "alt-source-manual", "alt-identity", "alt-plan-status", "alt-diagnosis", "alt-no-write", "alt-limits", "alt-source-id"]) expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    expect(screen.queryByText(/media library/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Alt text — what the image shows/)).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-change")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Approve and apply/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/resolved|fixed/i)).not.toBeInTheDocument()
    expect(apiService.applyImageAltFix).not.toHaveBeenCalled()
  })
})

describe("the media-library target is unchanged (regression)", () => {
  test("its source card is the simple one and the approval keeps the attachment wording and the Bridge note", async () => {
    previewFn = () => ({
      ...diviPreview(AI), source: MEDIA_SOURCE, field: "alt_text", setting: "WordPress media library → attachment 42 → alt text", contentEffect: { status: "not_in_content" },
      diagnosis: { state: "missing", source: "media_library", sourceLabel: "WordPress media library", fixMechanism: "media_library", supported: true, renderedAlt: null, libraryAlt: null, libraryMeaningful: false, builder: null, evidence: [], manual: null },
      identity: { status: "resolved", attachmentId: 42, confidence: "high", method: "exact_source_url", evidence: [], matchedUrls: [HERO] },
      current: { alt: "", note: "WordPress reports a missing and an empty alt text the same way." },
      plan: { status: "ready", code: null, fingerprint: FP, message: null, change: { field: "alt_text", before: "", after: AI } },
    })
    renderPanel(); await choose(0)
    expect(await screen.findByTestId("alt-source-type", {}, slow)).toHaveTextContent("WordPress media library")
    expect(screen.queryByTestId("alt-source-module")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-source-attr")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-rendered-now")).not.toBeInTheDocument()
    fireEvent.change(box(), { target: { value: AI } })
    expect(await screen.findByRole("checkbox", { name: /I approve setting attachment #42's alt text to the text above/ }, slow)).toBeInTheDocument()
    expect(screen.getByTestId("alt-concurrency-note")).toHaveTextContent(/Odito SEO Bridge 1.5.0/)
  })
})

describe("view-model helpers", () => {
  test("describeSource words each kind; the client never builds a target", () => {
    const d = describeSource(DIVI_SOURCE)
    expect(d).toMatchObject({ isDivi: true, isManual: false, writable: true, identifier: "pages/6:et_pb_fullwidth_header[0]", attributeText: "image_alt_text" })
    expect(d.storedText).toBe("Not set — the module has no alt attribute")
    expect(describeSource({ ...DIVI_SOURCE, attributePresent: true, storedValue: "" }).storedText).toBe('alt="" (empty)')
    expect(describeSource({ ...DIVI_SOURCE, attributePresent: true, storedValue: "Old text" }).storedText).toBe("“Old text”")
    expect(describeSource(MANUAL_LOGO.source)).toMatchObject({ isManual: true, writable: false, stateText: "Unsupported source — manual edit required" })
    expect(describeSource(MEDIA_SOURCE)).toMatchObject({ isDivi: false, isManual: false, writable: true })
    expect(describeSource(null)).toBeNull()
  })

  test("the model flags a Divi preview and a Divi fix record, and a manual source is never writable", () => {
    const m = getImageAltModel(diviPreview(AI, { record: diviRecord() }))
    expect([m.isDivi, m.fixIsDivi, m.canApprove]).toEqual([true, true, false])
    expect(getImageAltModel(diviPreview(AI)).canApprove).toBe(true)
    const manual = getImageAltModel(MANUAL_LOGO)
    expect([manual.isDivi, manual.writable, manual.canApprove]).toEqual([false, false, false])
  })

  test("conflict wording: a changed page and a changed Divi module are distinct from a replaced image file", () => {
    expect(describeAltError({ code: "CONFLICT", details: { reason: "page_changed" }, message: "x" }).title).toMatch(/page changed/)
    expect(describeAltError({ code: "CONFLICT", details: { reason: "target_changed" }, message: "The Divi module that was approved is no longer on the page as it was." }).title).toMatch(/module changed/)
    expect(describeAltError({ code: "CONFLICT", details: { reason: "target_changed" }, message: "The attachment no longer matches." }).title).toBe("The image file changed")
    expect(describeAltError({ code: "VALIDATION_FAILED", details: { reason: "edit_not_minimal" }, message: "The prepared change was not a single-attribute edit." })).toMatchObject({ tone: "bad", refreshPreview: true })
  })

  test("result wording per source and status", () => {
    expect(describeResultSummary(diviRecord(), { isDivi: true })).toMatch(/Divi module holds the alt text/)
    expect(describeResultSummary(diviRecord(), { isDivi: false })).toMatch(/crawled page shows it/)
    expect(describeResultSummary(diviRecord({ status: "applied" }), { isDivi: true })).toMatch(/Applied — verification pending/)
    expect(describeResultSummary(diviRecord({ status: "apply_uncertain" }), { isDivi: true })).toMatch(/module change was saved/)
    expect(describeResultSummary(diviRecord({ status: "conflict_detected" }), { isDivi: true })).toBe("The change was not applied.")
    expect(describeResultSummary(null)).toBeNull()
  })
})
