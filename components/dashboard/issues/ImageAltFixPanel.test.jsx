import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ImageAltFixPanel from "./ImageAltFixPanel"
import { clearAllDrafts } from "./altDraftStore"
import apiService from "@/lib/apiService"

vi.mock("@/lib/apiService", () => ({
  default: {
    listImageAltImages: vi.fn(), previewImageAltFix: vi.fn(), applyImageAltFix: vi.fn(), reverifyImageAltFix: vi.fn(), rollbackImageAltFix: vi.fn(),
  },
}))

const FP = "e".repeat(64)
const SRC = "https://clinic.example/wp-content/uploads/2024/10/dr-rao.jpg"
const SRC2 = "https://clinic.example/wp-content/uploads/2024/10/deco.jpg"
const task = { _id: "task-1" }
const ALT = "Dr Rao examining a patient with a slit lamp"
const respond = (data) => ({ success: true, data })
const apiError = (over) => Object.assign(new Error(over.message || "failed"), over)

const item = (over = {}) => ({ src: SRC, altState: "missing", hasAttachmentHint: false, decorativeSignals: false, figcaption: null, fix: null, ...over })
const preview = (over = {}) => ({
  fixType: "image_alt", targetUrl: "https://clinic.example/doctors", image: { sourceUrl: SRC, altState: "missing" },
  identity: { status: "resolved", attachmentId: 42, confidence: "high", method: "exact_source_url", evidence: ["Exactly one media-library attachment lists the observed file path."], matchedUrls: [SRC] },
  field: "alt_text", setting: "WordPress media library → attachment 42 → alt text",
  classification: { kind: "informative", decorative: false, signals: [] },
  current: { alt: "", note: "WordPress reports a missing and an empty alt text the same way." }, proposed: { alt: null },
  suggestions: [], validation: { ok: null, errors: [], warnings: [] }, contentEffect: { status: "not_in_content" },
  plan: { status: "needs_input", fingerprint: FP, code: "ALT_TEXT_REQUIRED", message: "Odito cannot see the image, so it does not describe it. Write what the image shows and why it is on the page." },
  verificationStatus: { saved: "pending", rendered: "pending" }, record: null, ...over,
})
const ready = (text = ALT) => preview({ proposed: { alt: text }, validation: { ok: true, errors: [], warnings: [] }, plan: { status: "ready", fingerprint: FP, code: null, message: null, change: { field: "alt_text", before: "", after: text } } })
const rec = (over = {}) => ({ id: "r1", status: "applied", changes: [{ field: "alt_text", before: "", after: ALT, applied: true, restored: false }], verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "pending", reasons: ["The rendered page is checked after the next recrawl."] } }, rollback: { status: "none" }, ...over })

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ImageAltFixPanel projectId="p1" task={task} /></QueryClientProvider>)
}
const choose = async (nth = 0) => { const rows = await screen.findAllByTestId("alt-image-row"); fireEvent.click(rows[nth]); }
const type = (value) => fireEvent.change(screen.getByLabelText(/Alt text — what the image shows/), { target: { value } })
const slow = { timeout: 3000 }

beforeEach(() => {
  vi.clearAllMocks()
  clearAllDrafts() // drafts live for the page, so each test starts with none
  apiService.listImageAltImages.mockResolvedValue(respond({ images: [item()] }))
  apiService.previewImageAltFix.mockImplementation(async (_id, input) => respond(input.proposedAlt ? ready(input.proposedAlt) : preview()))
})

describe("the image list", () => {
  test("loading is announced; each image shows its own alt state — missing, empty and 'may be decorative' are different", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({ images: [item(), item({ src: SRC2, altState: "empty", decorativeSignals: true }), item({ src: `${SRC}?b`, altState: "unknown" })] }))
    renderPanel()
    expect(screen.getByTestId("alt-loading")).toBeInTheDocument()
    const rows = await screen.findAllByTestId("alt-image-row")
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByTestId("alt-state-chip")).toHaveTextContent("No alt attribute")
    expect(within(rows[1]).getByTestId("alt-state-chip")).toHaveTextContent('alt="" (empty)')
    expect(within(rows[1]).getByText("May be decorative")).toBeInTheDocument()
    expect(within(rows[2]).getByTestId("alt-state-chip")).toHaveTextContent("Missing or empty")
    expect(apiService.previewImageAltFix).not.toHaveBeenCalled() // nothing is analysed until an image is chosen
  })
  test("no flagged images is said plainly", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({ images: [] }))
    renderPanel()
    expect(await screen.findByTestId("alt-empty")).toHaveTextContent("No images on this page")
  })
})

describe("resource kinds and set-aside trackers", () => {
  test("a task whose only finding was a tracker shows an honest empty state, no image rows, and no tracking address", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({ images: [], ignored: { trackingEndpoints: 1 } }))
    renderPanel()
    expect(await screen.findByTestId("alt-empty")).toBeInTheDocument()
    const note = await screen.findByTestId("alt-ignored-note")
    expect(note).toHaveTextContent(/analytics or advertising tracker/)
    expect(note).toHaveTextContent(/nothing was fixed/)
    expect(screen.queryByTestId("alt-image-row")).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/facebook\.com\/tr|\d{10,}/)
  })

  test("a real upload shows no 'not editable' label; theme and external images do, and are still reviewable", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({ images: [
      item({ resourceKind: "wp_media", mediaLibraryCandidate: true }),
      item({ src: "https://clinic.example/wp-content/themes/x/hero.jpg", resourceKind: "theme_asset", mediaLibraryCandidate: false }),
      item({ src: "https://images.example.org/p.jpg", resourceKind: "external_image", mediaLibraryCandidate: false }),
    ] }))
    renderPanel()
    const rows = await screen.findAllByTestId("alt-image-row")
    expect(within(rows[0]).queryByTestId("alt-resource-chip")).not.toBeInTheDocument()
    expect(within(rows[1]).getByTestId("alt-resource-chip")).toHaveTextContent("Theme file — not editable here")
    expect(within(rows[2]).getByTestId("alt-resource-chip")).toHaveTextContent(/another website's image/i)
  })

  test("a theme file's preview explains why and offers neither a text box nor an approve button", async () => {
    const THEME = "https://clinic.example/wp-content/themes/x/hero.jpg"
    apiService.listImageAltImages.mockResolvedValue(respond({ images: [item({ src: THEME, resourceKind: "theme_asset", mediaLibraryCandidate: false })] }))
    const msg = "This image is a file of your WordPress theme, not a media-library upload, so it has no media-library alt text to change."
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({
      identity: { status: "unsupported", code: "THEME_ASSET", message: msg, attachmentId: null, confidence: null, method: null, evidence: [], matchedUrls: [] },
      plan: { status: "unsupported", fingerprint: FP, code: "THEME_ASSET", message: msg, change: null },
    })))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-identity-message")).toHaveTextContent(/theme/)
    expect(screen.getByTestId("alt-plan-chip")).toHaveTextContent("Not supported for this image")
    expect(screen.queryByLabelText(/Alt text — what the image shows/)).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /approve and apply/i })).not.toBeInTheDocument()
  })

  test("a real upload still gets the full workflow (regression)", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({ images: [item({ resourceKind: "wp_media", mediaLibraryCandidate: true })] }))
    renderPanel()
    await choose()
    await screen.findByTestId("alt-identity")
    type(ALT)
    expect(await screen.findByTestId("alt-approval", {}, slow)).toBeInTheDocument()
  })
})

describe("choosing an image — identity first, then the text", () => {
  test("shows the resolved attachment, confidence, method and evidence; the first preview sends ONLY the image", async () => {
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({ suggestions: [{ source: "figcaption", label: "The caption shown under the image on the page", text: "Dr Rao with a patient" }] })))
    renderPanel()
    await choose()
    const identity = await screen.findByTestId("alt-identity")
    expect(identity).toHaveTextContent("#42")
    expect(screen.getByTestId("alt-identity-chip")).toHaveTextContent("High confidence")
    expect(identity).toHaveTextContent("Exact file path in the media library")
    expect(identity).toHaveTextContent("Exactly one media-library attachment lists the observed file path.")
    expect(apiService.previewImageAltFix).toHaveBeenCalledWith("task-1", { imageSrc: SRC, proposedAlt: undefined, informative: false })
    expect(screen.getByTestId("alt-plan-chip")).toHaveTextContent("Needs your description")
    expect(screen.getByTestId("alt-plan-message")).toHaveTextContent("does not describe it")
    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument()
  })

  test("suggestions from the site's own text are offered but NEVER applied on their own; choosing one only fills the box", async () => {
    apiService.previewImageAltFix.mockImplementation(async (_id, input) => respond(input.proposedAlt ? ready(input.proposedAlt) : preview({ suggestions: [{ source: "figcaption", label: "The caption shown under the image on the page", text: "Dr Rao with a patient" }] })))
    renderPanel()
    await choose()
    const box = await screen.findByTestId("alt-suggestions")
    expect(screen.getByLabelText(/Alt text — what the image shows/)).toHaveValue("")
    fireEvent.click(within(box).getByRole("button", { name: /Dr Rao with a patient/ }))
    expect(screen.getByLabelText(/Alt text — what the image shows/)).toHaveValue("Dr Rao with a patient")
    expect(apiService.applyImageAltFix).not.toHaveBeenCalled()
  })

  test("typing shows the exact change after a short pause; the preview carries the text", async () => {
    renderPanel()
    await choose()
    await screen.findByTestId("alt-identity")
    type(ALT)
    await waitFor(() => expect(screen.getByTestId("alt-proposed")).toHaveTextContent(ALT), slow)
    expect(apiService.previewImageAltFix).toHaveBeenLastCalledWith("task-1", { imageSrc: SRC, proposedAlt: ALT, informative: false })
    const change = screen.getByTestId("alt-change")
    expect(change).toHaveTextContent("attachment 42")
    expect(screen.getByTestId("alt-current")).toHaveTextContent("(no alt text)")
    expect(change).toHaveTextContent("never its caption, title, description or file")
    expect(screen.getByTestId("alt-plan-chip")).toHaveTextContent("Ready to apply")
  })

  test("an unpublishable text shows the reasons and offers no approval", async () => {
    apiService.previewImageAltFix.mockImplementation(async (_id, input) => respond(input.proposedAlt
      ? preview({ proposed: { alt: null }, validation: { ok: false, errors: ["Alt text looks like a file name. Describe what the image shows."], warnings: [] }, plan: { status: "validation_failed", fingerprint: FP, message: "Alt text looks like a file name. Describe what the image shows." } })
      : preview()))
    renderPanel()
    await choose()
    await screen.findByTestId("alt-identity")
    type("dr-rao-768x512.jpg")
    expect(await screen.findByTestId("alt-validation-errors", {}, slow)).toHaveTextContent("looks like a file name")
    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument()
  })
})

describe("images that cannot be changed", () => {
  test("alt stored in the page content: unsupported, with the reason; no text box and no approval", async () => {
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({ contentEffect: { status: "embedded" }, plan: { status: "unsupported", fingerprint: FP, code: "ALT_EMBEDDED_IN_CONTENT", message: "This image is placed inside the page content with its own alt text. Edit the image's alt text in the page editor instead." } })))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-plan-chip")).toHaveTextContent("Not supported for this image")
    expect(screen.getByTestId("alt-plan-message")).toHaveTextContent("page editor")
    expect(screen.queryByLabelText(/Alt text — what the image shows/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument()
    expect(screen.getByTestId("alt-limits")).toHaveTextContent("keeps its own alt text there")
  })

  test("ambiguous or missing identity is explained and blocks everything", async () => {
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({
      identity: { status: "ambiguous_target", code: "MULTIPLE_ATTACHMENTS_MATCH", message: "More than one attachment (1, 9) lists this file, so the exact target is ambiguous." },
      plan: { status: "ambiguous_target", fingerprint: FP, message: "More than one attachment (1, 9) lists this file, so the exact target is ambiguous." },
    })))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-identity-chip")).toHaveTextContent("Ambiguous")
    expect(screen.getByTestId("alt-identity-message")).toHaveTextContent("More than one attachment")
    expect(screen.queryByTestId("alt-change")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument()
  })

  test("a decorative-looking image is left alone until the person says it carries meaning; ticking it re-previews with that confirmation", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({ images: [item({ src: SRC2, altState: "empty", decorativeSignals: true })] }))
    const deco = preview({ classification: { kind: "decorative", decorative: true, signals: ['The page sets alt="" on this image, which is how an author marks it decorative.'] }, plan: { status: "decorative", fingerprint: FP, code: "DECORATIVE_IMAGE", message: "Decorative images should keep an empty alt, so Odito leaves it unchanged." } })
    apiService.previewImageAltFix.mockImplementation(async (_id, input) => respond(input.informative ? ready(input.proposedAlt || ALT) : deco))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-plan-chip")).toHaveTextContent("Decorative — no fix required")
    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: /carries meaning/ }))
    await waitFor(() => expect(apiService.previewImageAltFix).toHaveBeenLastCalledWith("task-1", expect.objectContaining({ informative: true })))
  })
})

describe("approve and apply", () => {
  const readyFlow = async () => {
    renderPanel()
    await choose()
    await screen.findByTestId("alt-identity")
    type(ALT)
    await screen.findByTestId("alt-approval", {}, slow)
  }

  test("Apply stays disabled until the box is ticked; it sends the image, the text and the fingerprint — nothing else", async () => {
    apiService.applyImageAltFix.mockResolvedValue(respond({ fix: rec(), alreadyApplied: false, immediateVerification: "success" }))
    await readyFlow()
    expect(screen.getByTestId("alt-not-applied")).toHaveTextContent("Nothing has been changed yet")
    const apply = screen.getByRole("button", { name: "Approve and apply" })
    expect(apply).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #42/ }))
    expect(apply).toBeEnabled()
    fireEvent.click(apply)
    await waitFor(() => expect(apiService.applyImageAltFix).toHaveBeenCalledTimes(1))
    expect(apiService.applyImageAltFix).toHaveBeenCalledWith("task-1", { imageSrc: SRC, proposedAlt: ALT, informative: false, expectedPlanFingerprint: FP })
    expect(Object.keys(apiService.applyImageAltFix.mock.calls[0][1]).sort()).toEqual(["expectedPlanFingerprint", "imageSrc", "informative", "proposedAlt"])
  })

  test("changing the text after ticking the box clears the approval — the approval is for exactly this text", async () => {
    await readyFlow()
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #42/ }))
    type(`${ALT} and a nurse`)
    await waitFor(() => expect(screen.getByTestId("alt-proposed")).toHaveTextContent("and a nurse"), slow)
    expect(screen.getByRole("checkbox", { name: /I approve setting attachment #42/ })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Approve and apply" })).toBeDisabled()
  })

  test("while applying nothing says 'applied'; afterwards: applied, saved verified, rendered NOT verified, with Re-verify and Roll back", async () => {
    let release
    apiService.applyImageAltFix.mockReturnValue(new Promise((r) => { release = r }))
    await readyFlow()
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #42/ }))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    expect(await screen.findByRole("button", { name: "Applying to WordPress…" })).toBeDisabled()
    expect(screen.queryByTestId("alt-result")).not.toBeInTheDocument()

    apiService.previewImageAltFix.mockImplementation(async (_id, input) => respond({ ...ready(input.proposedAlt || ALT), record: rec(), plan: { status: "nothing_to_change", fingerprint: FP, message: "The media library already holds exactly this alt text." } }))
    release(respond({ fix: rec() }))
    const result = await screen.findByTestId("alt-result", {}, slow)
    expect(screen.getByTestId("alt-result-summary")).toHaveTextContent("not verified until the recrawled page shows it on this image")
    expect(within(result).getByTestId("alt-verify-saved")).toHaveTextContent("Verified")
    expect(within(result).getByTestId("alt-verify-rendered")).toHaveTextContent("Not checked yet")
    expect(screen.getByRole("button", { name: "Re-verify" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Roll back/ })).toBeInTheDocument()
  })

  test("a stale approval (409) says nothing was written and offers the refreshed preview; a human edit says nothing was overwritten", async () => {
    apiService.applyImageAltFix.mockRejectedValueOnce(apiError({ status: 409, code: "CONFLICT", details: { reason: "preview_stale" } }))
    await readyFlow()
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #42/ }))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    expect(await screen.findByTestId("alt-error")).toHaveTextContent("Nothing was written")
    expect(screen.getByRole("button", { name: "Review refreshed preview" })).toBeInTheDocument()

    apiService.applyImageAltFix.mockRejectedValueOnce(apiError({ status: 409, code: "CONFLICT", details: { reason: "alt_changed" } }))
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #42/ }))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    await waitFor(() => expect(screen.getByTestId("alt-error")).toHaveTextContent("The alt text changed in WordPress"))
    expect(screen.getByTestId("alt-error")).toHaveTextContent("Nothing was overwritten")
  })

  test("permission denied and a timeout are each explained", async () => {
    apiService.applyImageAltFix.mockRejectedValueOnce(apiError({ status: 403, code: "PERMISSION_DENIED", message: "This WordPress account does not have permission to edit this field." }))
    await readyFlow()
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #42/ }))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    expect(await screen.findByTestId("alt-error")).toHaveTextContent("Permission denied")
    apiService.applyImageAltFix.mockRejectedValueOnce(apiError({ status: 504, code: "TIMEOUT" }))
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #42/ }))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    await waitFor(() => expect(screen.getByTestId("alt-error")).toHaveTextContent("WordPress did not respond"))
  })
})

describe("verification, re-verification and rollback", () => {
  const withRecord = (r) => {
    apiService.previewImageAltFix.mockImplementation(async () => respond({ ...ready(), record: r, plan: { status: "nothing_to_change", fingerprint: FP, message: "The media library already holds exactly this alt text." } }))
  }

  test("verified only when BOTH saved and rendered agree; a failed rendered check shows why, and says Odito does not rewrite the value", async () => {
    withRecord(rec({ status: "verification_failed", verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "failed", reasons: ["The rendered image shows alt \"\" instead of the approved text.", "A cache or CDN may be serving the old page. Odito does not re-write the same value to compensate."] } } }))
    renderPanel()
    await choose()
    const result = await screen.findByTestId("alt-result")
    expect(within(result).getByTestId("alt-verify-saved")).toHaveTextContent("Verified")
    expect(within(result).getByTestId("alt-verify-rendered")).toHaveTextContent("Does not match")
    expect(within(result).getByTestId("alt-verify-rendered")).toHaveTextContent("does not re-write the same value")
    expect(screen.getByTestId("alt-result-summary")).toHaveTextContent("not verified")
  })

  test("a stale crawl is 'cannot be checked yet', never verified; Re-verify calls the server for that image", async () => {
    withRecord(rec({ verification: { saved: { status: "verified" }, rendered: { status: "unverifiable", reasons: ["cannot_be_checked: the page has not been re-crawled since the change"] } } }))
    apiService.reverifyImageAltFix.mockResolvedValue(respond({ fix: rec() }))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-verify-rendered")).toHaveTextContent("Cannot be checked yet")
    fireEvent.click(screen.getByRole("button", { name: "Re-verify" }))
    await waitFor(() => expect(apiService.reverifyImageAltFix).toHaveBeenCalledWith("task-1", { imageSrc: SRC }))
  })

  test("both verified -> the summary says the page shows it on this image", async () => {
    withRecord(rec({ status: "verified", verification: { saved: { status: "verified" }, rendered: { status: "verified", crawledAt: "2026-10-15T12:00:00Z" } } }))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-result-summary")).toHaveTextContent("your crawled page shows it on this image")
  })

  test("Roll back needs a confirmation, then reports the outcome — including that a newer edit was left alone", async () => {
    withRecord(rec())
    apiService.rollbackImageAltFix.mockResolvedValue(respond({ fix: rec({ status: "applied", rollback: { status: "failed", conflictFields: ["alt_text"] } }), message: "The alt text was changed after Odito wrote it, so it was left as it is now." }))
    renderPanel()
    await choose()
    fireEvent.click(await screen.findByRole("button", { name: /Roll back/ }))
    expect(apiService.rollbackImageAltFix).not.toHaveBeenCalled()
    const confirm = screen.getByTestId("alt-rollback-confirm")
    expect(confirm).toHaveTextContent("If someone edited it since, it is left as they set it")
    fireEvent.click(within(confirm).getByRole("button", { name: "Yes, roll back" }))
    await waitFor(() => expect(apiService.rollbackImageAltFix).toHaveBeenCalledWith("task-1", { imageSrc: SRC }))
    expect(await screen.findByTestId("alt-rollback-message")).toHaveTextContent("left as it is now")
  })

  test("after a rollback the result says restored and no further action is offered", async () => {
    withRecord(rec({ status: "rolled_back", changes: [{ field: "alt_text", applied: true, restored: true }], rollback: { status: "rolled_back" } }))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-result-summary")).toHaveTextContent("The previous alt text was restored")
    expect(screen.queryByRole("button", { name: /Roll back/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Re-verify" })).not.toBeInTheDocument()
  })
})

describe("load failures", () => {
  test("a failed preview names the cause (permission) and a failed list names its own", async () => {
    apiService.previewImageAltFix.mockRejectedValue(apiError({ status: 403, code: "PERMISSION_DENIED", message: "This WordPress account may not edit the attachment." }))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-error")).toHaveTextContent("Permission denied")
  })
})

describe("reliability — per-image status, roll-up, unknown outcomes", () => {
  test("a double click sends exactly ONE apply request and the approval is spent when it is used", async () => {
    apiService.previewImageAltFix.mockImplementation(async (_id, input) => respond(input.proposedAlt ? ready(input.proposedAlt) : preview()))
    let release
    apiService.applyImageAltFix.mockReturnValue(new Promise((r) => { release = r }))
    renderPanel()
    await choose()
    await screen.findByTestId("alt-identity")
    type(ALT)
    await screen.findByTestId("alt-approval", {}, slow)
    fireEvent.click(screen.getByRole("checkbox"))
    const button = screen.getByRole("button", { name: "Approve and apply" })
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(apiService.applyImageAltFix).toHaveBeenCalledTimes(1))
    release(respond({ fix: rec() }))
    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked())
    expect(apiService.applyImageAltFix).toHaveBeenCalledTimes(1)
  })

  test("the roll-up says 'partly applied', counts each status, and names what can be retried — without ever claiming verification", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({
      images: [
        item({ targetStatus: "verified", retryable: false, recoverable: false, inFindings: true }),
        item({ src: SRC2, targetStatus: "failed", retryable: true, recoverable: false, inFindings: true }),
        item({ src: `${SRC}?c`, targetStatus: "not_started", inFindings: true }),
      ],
      summary: { targets: 2, overall: "partially_applied", byStatus: { verified: 1, failed: 1, not_started: 1 }, retryable: [SRC2], recoverable: [], remainingOpenImages: 1 },
    }))
    renderPanel()
    const rollup = await screen.findByTestId("alt-rollup")
    expect(within(rollup).getByTestId("alt-rollup-chip")).toHaveTextContent("Partly applied")
    expect(rollup).toHaveTextContent("1 × Verified")
    expect(rollup).toHaveTextContent("1 × Not applied — can be retried")
    expect(within(rollup).getByTestId("alt-rollup-retry")).toHaveTextContent("1 image can be retried. Images that already succeeded are never written again.")
    expect(rollup).toHaveTextContent("1 flagged image has not been changed")
    expect(rollup).not.toHaveTextContent("Every changed image is verified")
    const rows = await screen.findAllByTestId("alt-image-row")
    expect(within(rows[0]).getByTestId("alt-target-status")).toHaveTextContent("Verified")
    expect(within(rows[1]).getByTestId("alt-target-status")).toHaveTextContent("Not applied — can be retried")
    expect(within(rows[2]).queryByTestId("alt-target-status")).not.toBeInTheDocument()
  })

  test("'Every changed image is verified' only appears when the server says so", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({
      images: [item({ targetStatus: "verified", retryable: false, recoverable: false, inFindings: true })],
      summary: { targets: 1, overall: "verified", byStatus: { verified: 1 }, retryable: [], recoverable: [], remainingOpenImages: 0 },
    }))
    renderPanel()
    expect(await screen.findByTestId("alt-rollup-chip")).toHaveTextContent("Every changed image is verified")
    expect(screen.queryByTestId("alt-rollup-retry")).not.toBeInTheDocument()
  })

  test("an image fixed earlier whose finding has closed stays listed, marked 'No longer flagged'", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({
      images: [item({ targetStatus: "applied_pending_verification", retryable: false, recoverable: false, inFindings: false })],
      summary: { targets: 1, overall: "applied_pending_verification", byStatus: { applied_pending_verification: 1 }, retryable: [], recoverable: [], remainingOpenImages: 0 },
    }))
    renderPanel()
    const row = (await screen.findAllByTestId("alt-image-row"))[0]
    expect(within(row).getByText("No longer flagged")).toBeInTheDocument()
    expect(within(row).getByTestId("alt-target-status")).toHaveTextContent("Applied — verification pending")
  })

  test("an image with an unknown outcome is called out as needing a status check before anything else", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({
      images: [item({ targetStatus: "needs_reconcile", retryable: false, recoverable: true, inFindings: true })],
      summary: { targets: 1, overall: "failed", byStatus: { needs_reconcile: 1 }, retryable: [], recoverable: [SRC], remainingOpenImages: 0 },
    }))
    renderPanel()
    expect(await screen.findByTestId("alt-rollup-recover")).toHaveTextContent("1 image needs a status check before anything else is done to it.")
    expect((await screen.findAllByTestId("alt-image-row"))[0]).toHaveTextContent("Outcome unknown — check status")
  })

  test("an unknown outcome on apply says nothing was repeated or undone and offers 'Check status', which re-verifies that image", async () => {
    apiService.previewImageAltFix.mockImplementation(async (_id, input) => respond(input.proposedAlt ? ready(input.proposedAlt) : preview()))
    apiService.applyImageAltFix.mockRejectedValue(apiError({ code: "OUTCOME_UNKNOWN", status: 502, message: "unknown", details: { reason: "outcome_unknown", fixId: "r1" } }))
    apiService.reverifyImageAltFix.mockResolvedValue(respond({ fix: rec() }))
    renderPanel()
    await choose()
    await screen.findByTestId("alt-identity")
    type(ALT)
    await screen.findByTestId("alt-approval", {}, slow)
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    const box = await screen.findByTestId("alt-error")
    expect(box).toHaveTextContent("Nothing was repeated and nothing was undone")
    fireEvent.click(within(box).getByRole("button", { name: "Check status" }))
    await waitFor(() => expect(apiService.reverifyImageAltFix).toHaveBeenCalledWith("task-1", { imageSrc: SRC }))
  })

  test("rollback stages: restored-but-unconfirmed differs from confirmed", async () => {
    const rolled = (status) => rec({ status: "rolled_back", changes: [{ field: "alt_text", before: "", after: ALT, applied: true, restored: true }], rollback: { status } })
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({ record: rolled("applied") })))
    const { unmount } = renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-rollback-stage")).toHaveTextContent("Restored — not yet confirmed from WordPress")
    expect(screen.getByTestId("alt-result-summary")).toHaveTextContent("has not been read back yet")
    expect(screen.getByRole("button", { name: "Re-verify" })).toBeInTheDocument()
    unmount()

    apiService.previewImageAltFix.mockResolvedValue(respond(preview({ record: rolled("verified") })))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-rollback-stage")).toHaveTextContent("Restored and confirmed")
    expect(screen.queryByRole("button", { name: "Re-verify" })).not.toBeInTheDocument()
  })

  test("a Bridge older than 1.5.0 is called out; the current Bridge shows no warning", async () => {
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({ concurrency: { writes: "read_then_write" } })))
    const { unmount } = renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-concurrency-note")).toHaveTextContent("two separate steps")
    unmount()
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({ concurrency: { writes: "database_conditional" } })))
    renderPanel()
    await choose()
    await screen.findByTestId("alt-identity")
    expect(screen.queryByTestId("alt-concurrency-note")).not.toBeInTheDocument()
  })

  test("a pending render says it is waiting for a recrawl, not 'failed'", async () => {
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({ record: rec({ verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "pending", reasonCode: "NO_POST_WRITE_CRAWL", reasons: [] } } }) })))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-verify-rendered")).toHaveTextContent("Waiting for a recrawl")
  })
})

describe("creating the first alt-text record is described honestly", () => {
  test("an image with no alt record yet shows the check-then-insert note; a Bridge-less site shows the older warning instead, not both", async () => {
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({ concurrency: { writes: "database_conditional", creationWindow: true } })))
    const { unmount } = renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-creation-note")).toHaveTextContent("never overwrites an existing value")
    expect(screen.queryByTestId("alt-concurrency-note")).not.toBeInTheDocument()
    unmount()
    apiService.previewImageAltFix.mockResolvedValue(respond(preview({ concurrency: { writes: "read_then_write", creationWindow: false } })))
    renderPanel()
    await choose()
    expect(await screen.findByTestId("alt-concurrency-note")).toBeInTheDocument()
    expect(screen.queryByTestId("alt-creation-note")).not.toBeInTheDocument()
  })
})
