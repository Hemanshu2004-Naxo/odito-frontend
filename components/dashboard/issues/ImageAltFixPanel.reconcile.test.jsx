import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ImageAltFixPanel from "./ImageAltFixPanel"
import { clearAllDrafts } from "./altDraftStore"
import { describeDiagnosis, getImageAltModel } from "./imageAltFix"
import apiService from "@/lib/apiService"

/**
 * The audit, the recommendation, the preview and the apply action share ONE picture of each image. Real Sapphire shapes:
 *   #130 header logo  — library alt "Sapphire Digital Agency", page renders alt="" from a theme/builder template (unnamed link)
 *   #301 hero image   — meaningful library alt, a Divi module renders alt=""
 * Real panel + real hooks; only HTTP is mocked.
 */
vi.mock("@/lib/apiService", () => ({
  default: { listImageAltImages: vi.fn(), previewImageAltFix: vi.fn(), applyImageAltFix: vi.fn(), reverifyImageAltFix: vi.fn(), rollbackImageAltFix: vi.fn() },
}))

const FP = "e".repeat(64)
const LOGO = "https://sapphiredigitalagency.com/wp-content/uploads/2025/12/sapphire-digital-Agency-1.webp"
const HERO = "https://sapphiredigitalagency.com/wp-content/uploads/2025/12/Digital-Marketing-Agency-That-Delivers-Real-Results.webp"
const task = { _id: "task-1" }
const respond = (data) => ({ success: true, data })
const row = (src, over = {}) => ({ src, altState: "empty", hasAttachmentHint: true, decorativeSignals: false, figcaption: null, fix: null, aiSuggestion: true, resourceKind: "wp_media", mediaLibraryCandidate: true, ...over })

const aiRec = (alt) => ({ status: "available", alt, basis: "file name", match: "exact_src", reviewStatus: "needs_review", needsConfirmation: false, confidence: "medium", evidence: ["The image file is named “sapphire-digital-Agency-1”."], message: "Suggested by the AI recommendation from the page and file name — it cannot see the picture. Review and edit it before approving.", recommendationId: "rec-1" })

const base = (src, id) => ({
  fixType: "image_alt", targetUrl: "https://www.sapphiredigitalagency.com/", image: { sourceUrl: src, altState: "empty" },
  identity: { status: "resolved", attachmentId: id, confidence: "high", method: "attachment_id_class", evidence: ["The image carries the WordPress class wp-image-" + id + "."], matchedUrls: [src] },
  field: "alt_text", setting: `WordPress media library → attachment ${id} → alt text`, classification: { kind: "ambiguous", decorative: false, signals: [] },
  current: { alt: "", note: "" }, proposed: { alt: null }, suggestions: [], validation: { ok: null, errors: [], warnings: [] }, contentEffect: { status: "not_in_content" },
  verificationStatus: { saved: "pending", rendered: "pending" }, record: null,
})

const MISMATCH_LOGO = {
  ...base(LOGO, 130),
  current: { alt: "Sapphire Digital Agency", note: "" },
  diagnosis: { state: "library_alt_overridden", source: "theme_template", sourceLabel: "A theme or builder template (header, footer, widget area)", fixMechanism: "theme_template", supported: false, renderedAlt: "", libraryAlt: "Sapphire Digital Agency", libraryMeaningful: true, builder: "Divi", evidence: ["This image appears 2 times on the page; 1 of them render alt text and 1 render none.", "It is the only content of a link with no name, so that link has no accessible name today."], manual: "Set the alt text in that template; changing the media library would not change it." },
  plan: { status: "rendered_mismatch", code: "RENDERED_ALT_OVERRIDES_LIBRARY", fingerprint: FP, change: null, message: "WordPress already holds alt text (“Sapphire Digital Agency”) for this image, but the page renders alt=\"\": something on this page overrides it. Set the alt text in that template; changing the media library would not change it." },
  recommendation: aiRec("Sapphire Digital Agency logo and brand mark"),
}
const MISMATCH_HERO = {
  ...base(HERO, 301),
  current: { alt: "Professional digital marketing agency team", note: "" }, contentEffect: { status: "builder_reference" },
  diagnosis: { state: "library_alt_overridden", source: "page_builder_module", sourceLabel: "A page-builder module on this page", fixMechanism: "page_content", supported: false, renderedAlt: "", libraryAlt: "Professional digital marketing agency team", libraryMeaningful: true, builder: "Divi", evidence: ["The page content names this file inside a builder shortcode, and the module renders its own alt value instead of the library's."], manual: "Open this page in Divi and set the alt text on the module that shows this image." },
  plan: { status: "rendered_mismatch", code: "RENDERED_ALT_OVERRIDES_LIBRARY", fingerprint: FP, change: null, message: "WordPress already holds alt text for this image, but the page renders alt=\"\". Open this page in Divi and set the alt text on the module that shows this image." },
  recommendation: aiRec("Digital marketing agency team reviewing campaign results"),
}
const MISSING_READY = (text) => ({
  ...base(LOGO, 130),
  diagnosis: { state: "missing", source: "media_library", sourceLabel: "WordPress media library", fixMechanism: "media_library", supported: true, renderedAlt: null, libraryAlt: null, libraryMeaningful: false, builder: null, evidence: ["The page renders no alt text for this image and the media library has none."], manual: null },
  proposed: { alt: text || null }, validation: { ok: text ? true : null, errors: [], warnings: [] },
  plan: text ? { status: "ready", code: null, fingerprint: FP, message: null, change: { field: "alt_text", before: "", after: text } } : { status: "needs_input", code: "ALT_TEXT_REQUIRED", fingerprint: FP, message: "No alt text has been prepared yet." },
  recommendation: aiRec("Sapphire Digital Agency logo and brand mark"),
})

let previewFn
function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ImageAltFixPanel projectId="p1" task={task} /></QueryClientProvider>)
}
const choose = async (n = 0) => { const rows = await screen.findAllByTestId("alt-image-row"); fireEvent.click(rows[n]) }
const slow = { timeout: 3000 }

beforeEach(() => {
  vi.clearAllMocks(); clearAllDrafts()
  apiService.listImageAltImages.mockResolvedValue(respond({ images: [row(LOGO), row(HERO)] }))
  previewFn = (input) => (input.imageSrc === LOGO ? MISMATCH_LOGO : MISMATCH_HERO)
  apiService.previewImageAltFix.mockImplementation(async (_id, input) => respond(previewFn(input)))
})

describe("Example B — #130, the header logo: the page overrides a library alt that already exists", () => {
  test("a template-drawn Divi image gets ONE compact manual-fix card — and no text box, no empty After, no approval, no apply", async () => {
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-manual-title", {}, slow)).toHaveTextContent("Divi Builder Image")
    expect(screen.getByTestId("alt-manual-message")).toHaveTextContent("Edit its alt text in Divi Builder.")
    for (const id of ["alt-plan-chip", "alt-diag-rendered", "alt-diag-library", "alt-diag-source", "alt-diag-fix", "alt-diag-evidence", "alt-no-write", "alt-identity", "alt-limits"]) expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Alt text — what the image shows/)).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-change")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-proposed")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Approve and apply/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: /I approve/ })).not.toBeInTheDocument()
  })

  test("the AI suggestion is still useful: shown as copy-ready text for the manual change, never filled into a writable box", async () => {
    renderPanel()
    await choose(0)
    const manual = await screen.findByTestId("alt-manual-suggestion", {}, slow)
    expect(manual).toHaveTextContent("not applied")
    expect(screen.getByTestId("alt-manual-suggestion-text")).toHaveTextContent("Sapphire Digital Agency logo and brand mark")
    expect(screen.queryByTestId("alt-ai-suggestion")).not.toBeInTheDocument()
    const writeText = vi.fn().mockResolvedValue()
    Object.assign(navigator, { clipboard: { writeText } })
    fireEvent.click(screen.getByTestId("alt-manual-copy"))
    expect(writeText).toHaveBeenCalledWith("Sapphire Digital Agency logo and brand mark")
    expect(apiService.applyImageAltFix).not.toHaveBeenCalled()
  })
})

describe("Example A — #301, the hero image: a Divi module overrides the library", () => {
  test("named as a page-builder module, not 'decorative', and not writable", async () => {
    renderPanel()
    await choose(1)
    expect(await screen.findByTestId("alt-manual-title", {}, slow)).toHaveTextContent("Divi Builder Image")
    expect(screen.getByTestId("alt-manual-fix")).not.toHaveTextContent(/Decorative/)
    expect(screen.getByTestId("alt-manual-instructions")).toHaveTextContent(/Divi/)
    expect(screen.queryByTestId("alt-plan-chip")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-diag-source")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-change")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
  })
})

describe("the supported workflow is unchanged for a genuinely missing alt", () => {
  test("before any text exists there is NO before/after card (an empty After is not a proposal); once a text exists the real change is shown and can be approved", async () => {
    previewFn = (input) => MISSING_READY(input.proposedAlt)
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-diag-fix", {}, slow)).toHaveTextContent(/Yes, through the WordPress media library/)
    // a supported media-library image never gets the compact manual card
    expect(screen.queryByTestId("alt-manual-fix")).not.toBeInTheDocument()
    // the AI suggestion fills the box, which makes the preview ready
    await waitFor(() => expect(screen.getByLabelText(/Alt text — what the image shows/)).toHaveValue("Sapphire Digital Agency logo and brand mark"), slow)
    expect(await screen.findByTestId("alt-proposed", {}, slow)).toHaveTextContent("Sapphire Digital Agency logo and brand mark")
    expect(screen.getByTestId("alt-current")).toHaveTextContent("(no alt text)")
    expect(await screen.findByTestId("alt-approval", {}, slow)).toBeInTheDocument()
  })

  test("with nothing prepared yet, a short note replaces the before/after", async () => {
    previewFn = () => ({ ...MISSING_READY(null), recommendation: { status: "none", alt: null, message: "There is no AI recommendation for this page yet. Generate it above to get a suggested alt text, or write the description yourself.", evidence: [] } })
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-no-change", {}, slow)).toHaveTextContent("No change is prepared yet")
    expect(screen.queryByTestId("alt-change")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
  })
})

describe("the other states", () => {
  test("stale finding: says the live page already has it, offers nothing, and does not call it applied", async () => {
    previewFn = () => ({ ...MISMATCH_LOGO, diagnosis: { ...MISMATCH_LOGO.diagnosis, state: "stale_finding", fixMechanism: "none", manual: null, evidence: ["A fresh read of the live page shows alt text on every occurrence of this image."] }, plan: { status: "stale_finding", code: "FINDING_STALE", fingerprint: FP, change: null, message: "The live page already renders alt text on every occurrence of this image, so this finding is out of date. It leaves the audit on the next recrawl; nothing was changed." } })
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-plan-chip", {}, slow)).toHaveTextContent("Already fixed on the live page")
    expect(screen.getByTestId("alt-diag-fix")).toHaveTextContent("No fix needed")
    expect(screen.getByTestId("alt-plan-message")).toHaveTextContent(/nothing was changed/)
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-result")).not.toBeInTheDocument()
  })

  test("needs review: alt=\"\" with no evidence — the person confirms the image carries meaning to continue; the box and checkbox are available", async () => {
    previewFn = () => ({ ...MISSING_READY(null), classification: { kind: "ambiguous", decorative: false, signals: [] }, diagnosis: { ...MISSING_READY(null).diagnosis, state: "needs_review", renderedAlt: "" }, plan: { status: "needs_review", code: "REVIEW_EMPTY_ALT", fingerprint: FP, change: null, message: "The page renders alt=\"\" on this image and nothing in the markup says whether that is deliberate." } })
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-plan-chip", {}, slow)).toHaveTextContent("Needs your review")
    expect(screen.getByRole("checkbox", { name: /carries meaning/ })).toBeInTheDocument()
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: /carries meaning/ }))
    await waitFor(() => expect(apiService.previewImageAltFix).toHaveBeenLastCalledWith("task-1", expect.objectContaining({ informative: true })))
  })

  test("an unsupported image still explains itself and offers no text box (regression)", async () => {
    previewFn = () => ({ ...base(LOGO, 130), plan: { status: "unsupported", code: "ALT_EMBEDDED_IN_CONTENT", fingerprint: FP, change: null, message: "This image is placed inside the page content." }, contentEffect: { status: "embedded" }, recommendation: null, diagnosis: null })
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-plan-message", {}, slow)).toHaveTextContent(/inside the page content/)
    expect(screen.queryByLabelText(/Alt text — what the image shows/)).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-diagnosis")).not.toBeInTheDocument()
  })
})

describe("view-model helpers", () => {
  test("describeDiagnosis words each fix mechanism honestly", () => {
    const d = (o) => describeDiagnosis({ state: "library_alt_overridden", source: "theme_template", sourceLabel: "T", fixMechanism: "theme_template", supported: false, renderedAlt: "", libraryAlt: "x", evidence: [], ...o })
    expect(d({}).fixText).toMatch(/Edit the template/)
    expect(d({ fixMechanism: "page_content" }).fixText).toMatch(/page content or the builder module/)
    expect(d({ supported: true, fixMechanism: "media_library", builderMayOverride: true }).fixText).toMatch(/checks the live page afterwards/)
    expect(d({ state: "decorative", fixMechanism: "none" }).fixText).toBe("No fix required.")
    expect(d({ renderedAlt: null }).renderedLabel).toBe("No alt attribute")
    expect(d({ renderedAlt: undefined }).renderedLabel).toMatch(/Not recorded/)
    expect(d({ libraryAlt: null }).libraryLabel).toBe("No alt text")
    expect(describeDiagnosis(null)).toBeNull()
  })

  test("writable is false exactly where a media-library write cannot apply; approval needs a ready plan", () => {
    const m = (status) => getImageAltModel({ plan: { status, fingerprint: "f" }, identity: { status: "resolved" } })
    for (const s of ["rendered_mismatch", "stale_finding", "unsupported", "ambiguous_target"]) { expect(m(s).writable).toBe(false); expect(m(s).canApprove).toBe(false) }
    for (const s of ["ready", "needs_input", "needs_review", "decorative", "validation_failed", "existing_alt_preserved", "nothing_to_change"]) expect(m(s).writable).toBe(true)
    expect(m("ready").canApprove).toBe(true)
    expect(m("needs_review").canApprove).toBe(false)
  })
})
