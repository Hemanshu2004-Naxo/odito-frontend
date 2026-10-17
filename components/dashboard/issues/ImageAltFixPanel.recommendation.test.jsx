import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ImageAltFixPanel from "./ImageAltFixPanel"
import { clearAllDrafts, getDraft } from "./altDraftStore"
import apiService from "@/lib/apiService"

/**
 * Reusing the AI recommendation that already exists for the page: the WordPress panel fills the text box from the exact-match proposal
 * for the chosen image (no second AI call, no retyping), keeps the person's edits and drafts, and still needs their explicit approval.
 * Real panel + real hooks; only the HTTP layer is mocked.
 */
vi.mock("@/lib/apiService", () => ({
  default: {
    listImageAltImages: vi.fn(), previewImageAltFix: vi.fn(), applyImageAltFix: vi.fn(), reverifyImageAltFix: vi.fn(), rollbackImageAltFix: vi.fn(),
  },
}))

const FP = "e".repeat(64)
const U = "https://clinic.example/wp-content/uploads/2025/12"
const NAMES = ["logo", "david", "emily", "michael", "jane", "sophia"]
const SRCS = NAMES.map((n) => `${U}/${n}.webp`)
const aiText = (i) => `AI description for ${NAMES[i]} at the clinic`
const task = { _id: "task-1" }
const respond = (data) => ({ success: true, data })
const item = (i, over = {}) => ({ src: SRCS[i], altState: "empty", hasAttachmentHint: true, decorativeSignals: false, figcaption: null, fix: null, aiSuggestion: true, resourceKind: "wp_media", mediaLibraryCandidate: true, ...over })

const rec = (i, over = {}) => ({
  status: "available", alt: aiText(i), basis: "file name", match: "exact_src", reviewStatus: "needs_review", needsConfirmation: false, confidence: "medium",
  evidence: [`The image file is named “${NAMES[i]}”.`], message: "Suggested by the AI recommendation from the page and file name — it cannot see the picture. Review and edit it before approving.",
  recommendationId: "rec-1", generatedAt: "2026-10-16T12:00:00Z", ...over,
})
const planFor = (text) => (text
  ? { status: "ready", fingerprint: FP, code: null, message: null, change: { field: "alt_text", before: "", after: text } }
  : { status: "needs_input", fingerprint: FP, code: "ALT_TEXT_REQUIRED", message: "Write what the image shows." })
const previewFor = (i, text, recommendation) => ({
  fixType: "image_alt", targetUrl: "https://clinic.example/about-us", image: { sourceUrl: SRCS[i], altState: "empty" },
  identity: { status: "resolved", attachmentId: 100 + i, confidence: "high", method: "exact_source_url", evidence: ["Exactly one media-library attachment lists the observed file path."], matchedUrls: [SRCS[i]] },
  field: "alt_text", setting: `WordPress media library → attachment ${100 + i} → alt text`, classification: { kind: "informative", decorative: false, signals: [] },
  current: { alt: "", note: "" }, proposed: { alt: text || null }, suggestions: [], validation: { ok: text ? true : null, errors: [], warnings: [] },
  contentEffect: { status: "not_in_content" }, plan: planFor(text), recommendation, verificationStatus: { saved: "pending", rendered: "pending" }, record: null,
})

let recFn
function mockPreview() {
  apiService.previewImageAltFix.mockImplementation(async (_id, input) => {
    const i = SRCS.indexOf(input.imageSrc)
    return respond(previewFor(i, input.proposedAlt, recFn(i)))
  })
}
function renderPanel(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const ui = (p) => <QueryClientProvider client={qc}><ImageAltFixPanel projectId="p1" task={task} {...p} /></QueryClientProvider>
  const r = render(ui(props))
  return { ...r, rerenderWith: (p) => r.rerender(ui(p)) }
}
const choose = async (nth = 0) => { const rows = await screen.findAllByTestId("alt-image-row"); fireEvent.click(rows[nth]) }
const box = () => screen.getByLabelText(/Alt text — what the image shows/)
const slow = { timeout: 3000 }

beforeEach(() => {
  vi.clearAllMocks()
  clearAllDrafts()
  recFn = (i) => rec(i)
  apiService.listImageAltImages.mockResolvedValue(respond({ images: SRCS.map((_, i) => item(i)) }))
  mockPreview()
})

describe("the existing recommendation fills the box", () => {
  test("choosing an image fills ITS suggested text without typing, shows the evidence and 'needs your review', and then waits for approval", async () => {
    renderPanel()
    await choose(1)
    await waitFor(() => expect(box()).toHaveValue(aiText(1)), slow)
    const card = screen.getByTestId("alt-ai-suggestion")
    expect(card).toHaveTextContent("AI suggestion")
    expect(card).toHaveTextContent("Needs your review")
    expect(screen.getByTestId("alt-ai-confidence")).toHaveTextContent(/file name/)
    expect(screen.getByTestId("alt-ai-evidence")).toHaveTextContent("david")
    // the preview was refreshed with the text, so a ready plan exists — and nothing has been written
    await waitFor(() => expect(apiService.previewImageAltFix).toHaveBeenCalledWith("task-1", expect.objectContaining({ imageSrc: SRCS[1], proposedAlt: aiText(1) })), slow)
    expect(await screen.findByTestId("alt-approval", {}, slow)).toBeInTheDocument()
    expect(screen.getByTestId("alt-proposed")).toHaveTextContent(aiText(1))
    expect(apiService.applyImageAltFix).not.toHaveBeenCalled()
  })

  test("the original image is shown in the exact-change preview", async () => {
    renderPanel()
    await choose(2)
    const change = await screen.findByTestId("alt-change-image", {}, slow)
    expect(change.querySelector("img")).toHaveAttribute("src", SRCS[2])
  })

  test("SIX recommendations, resolved independently: each image shows its own suggestion and a ready chip", async () => {
    renderPanel()
    expect(await screen.findAllByTestId("alt-ai-chip")).toHaveLength(6)
    for (const i of [4, 0, 5]) {
      await choose(i)
      await waitFor(() => expect(box()).toHaveValue(aiText(i)), slow)
    }
    expect(apiService.listImageAltImages).toHaveBeenCalledTimes(1)
  })

  test("nothing but the list and the preview is called: no generation, and one list read", async () => {
    renderPanel()
    await choose(0)
    await waitFor(() => expect(box()).toHaveValue(aiText(0)), slow)
    expect(Object.keys(apiService).sort()).toEqual(["applyImageAltFix", "listImageAltImages", "previewImageAltFix", "reverifyImageAltFix", "rollbackImageAltFix"])
  })
})

describe("the person's text always wins", () => {
  test("an edit is kept when switching images and back — the AI text never overwrites it, and 'Reset' brings it back on request", async () => {
    renderPanel()
    await choose(1)
    await waitFor(() => expect(box()).toHaveValue(aiText(1)), slow)
    fireEvent.change(box(), { target: { value: "David Peterson, our founder" } })
    await choose(2)
    await waitFor(() => expect(box()).toHaveValue(aiText(2)), slow)
    await choose(1)
    await waitFor(() => expect(box()).toHaveValue("David Peterson, our founder"), slow)
    await new Promise((r) => setTimeout(r, 600))
    expect(box()).toHaveValue("David Peterson, our founder")
    fireEvent.click(await screen.findByTestId("alt-ai-use"))
    expect(box()).toHaveValue(aiText(1))
  })

  test("a box the person CLEARED stays cleared (an AI suggestion is never re-applied behind their back)", async () => {
    renderPanel()
    await choose(0)
    await waitFor(() => expect(box()).toHaveValue(aiText(0)), slow)
    fireEvent.change(box(), { target: { value: "" } })
    await choose(1); await waitFor(() => expect(box()).toHaveValue(aiText(1)), slow)
    await choose(0)
    await waitFor(() => expect(screen.getByTestId("alt-ai-suggestion")).toBeInTheDocument(), slow)
    await new Promise((r) => setTimeout(r, 600))
    expect(box()).toHaveValue("")
  })

  test("the draft survives a tab switch (the panel unmounts) and re-opening the same image", async () => {
    const first = renderPanel()
    await choose(3)
    await waitFor(() => expect(box()).toHaveValue(aiText(3)), slow)
    fireEvent.change(box(), { target: { value: "Michael Rodriguez, partner" } })
    expect(getDraft("task-1", SRCS[3])).toMatchObject({ text: "Michael Rodriguez, partner", touched: true })
    first.unmount()
    renderPanel()
    await choose(3)
    await waitFor(() => expect(box()).toHaveValue("Michael Rodriguez, partner"), slow)
  })

  test("an unedited prefilled text is also remembered, and is not placed a second time on re-open", async () => {
    const first = renderPanel()
    await choose(0)
    await waitFor(() => expect(box()).toHaveValue(aiText(0)), slow)
    first.unmount()
    renderPanel()
    await choose(0)
    await waitFor(() => expect(box()).toHaveValue(aiText(0)), slow)
  })
})

describe("approval and apply", () => {
  test("approving applies exactly the text on screen with the previewed fingerprint; the client sends no provenance (the server decides it)", async () => {
    apiService.applyImageAltFix.mockResolvedValue(respond({ fix: { id: "r1", status: "applied", changes: [{ field: "alt_text", before: "", after: aiText(1), applied: true, restored: false }], verification: { saved: { status: "verified", reasons: [] }, rendered: { status: "pending", reasons: [] } }, rollback: { status: "none" } }, alreadyApplied: false, immediateVerification: "success" }))
    renderPanel()
    await choose(1)
    await screen.findByTestId("alt-approval", {}, slow)
    expect(screen.getByRole("button", { name: "Approve and apply" })).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #101/ }))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    await waitFor(() => expect(apiService.applyImageAltFix).toHaveBeenCalledTimes(1))
    expect(apiService.applyImageAltFix).toHaveBeenCalledWith("task-1", { imageSrc: SRCS[1], proposedAlt: aiText(1), informative: false, expectedPlanFingerprint: FP })
    // the draft is spent once WordPress accepted it
    await waitFor(() => expect(getDraft("task-1", SRCS[1])).toBeNull())
  })

  test("a failed or stale apply keeps what the person had (nothing is lost, nothing is shown as fixed)", async () => {
    apiService.applyImageAltFix.mockRejectedValue(Object.assign(new Error("changed"), { code: "CONFLICT", details: { reason: "preview_stale" } }))
    renderPanel()
    await choose(1)
    await screen.findByTestId("alt-approval", {}, slow)
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #101/ }))
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }))
    expect(await screen.findByTestId("alt-error")).toBeInTheDocument()
    expect(getDraft("task-1", SRCS[1])).toMatchObject({ text: aiText(1) })
    expect(screen.queryByTestId("alt-result")).not.toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /I approve setting attachment #101/ })).not.toBeChecked()
  })
})

describe("when there is nothing reliable to reuse", () => {
  test("legacy text-only recommendation matched by position: offered as a button to confirm, NEVER filled in", async () => {
    recFn = (i) => rec(i, { status: "suggested_by_position", match: "legacy_position", needsConfirmation: true, confidence: "low", message: "Taken from the earlier text-only recommendation and matched by position. Check that it describes THIS image before using it." })
    renderPanel()
    await choose(2)
    expect(await screen.findByTestId("alt-ai-message", {}, slow)).toHaveTextContent(/matched by position/)
    await new Promise((r) => setTimeout(r, 600))
    expect(box()).toHaveValue("")
    fireEvent.click(screen.getByTestId("alt-ai-use"))
    expect(box()).toHaveValue(aiText(2))
  })

  test.each([
    ["ambiguous_legacy", /cannot be matched to this image with certainty/],
    ["none", /Generate it above/],
    ["no_match", /does not cover this image/],
    ["not_provided", /nothing in the page to describe/],
    ["unavailable", /could not be read right now/],
  ])("%s: says why, leaves the box empty, and the person can still write the text", async (status, pattern) => {
    const messages = {
      ambiguous_legacy: "The existing AI recommendation is plain text and cannot be matched to this image with certainty. Regenerate it, or write the description yourself.",
      none: "There is no AI recommendation for this page yet. Generate it above to get a suggested alt text, or write the description yourself.",
      no_match: "The AI recommendation does not cover this image. Regenerate the recommendation, or write the description yourself.",
      not_provided: "The AI recommendation found nothing in the page to describe this image from. Write the description yourself.",
      unavailable: "The AI recommendation could not be read right now. Write the description yourself, or try again.",
    }
    recFn = () => ({ status, alt: null, basis: null, match: null, needsConfirmation: false, confidence: null, evidence: [], message: messages[status], reviewStatus: "needs_review", recommendationId: null })
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-ai-note", {}, slow)).toHaveTextContent(pattern)
    expect(screen.queryByTestId("alt-ai-suggestion")).not.toBeInTheDocument()
    expect(box()).toHaveValue("")
    fireEvent.change(box(), { target: { value: "Reception desk with two staff members" } })
    expect(await screen.findByTestId("alt-approval", {}, slow)).toBeInTheDocument()
  })

  test("an image that cannot be identified gets no suggestion at all (the server sends none)", async () => {
    apiService.previewImageAltFix.mockResolvedValue(respond({
      ...previewFor(0, null, null),
      identity: { status: "ambiguous_target", code: "MULTIPLE_ATTACHMENTS_MATCH", message: "More than one attachment lists this file.", attachmentId: null, evidence: [], matchedUrls: [] },
      plan: { status: "ambiguous_target", fingerprint: FP, code: "MULTIPLE_ATTACHMENTS_MATCH", message: "More than one attachment lists this file." },
    }))
    renderPanel()
    await choose(0)
    expect(await screen.findByTestId("alt-identity-message")).toBeInTheDocument()
    expect(screen.queryByTestId("alt-ai-suggestion")).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Alt text — what the image shows/)).not.toBeInTheDocument()
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
  })
})

describe("a recommendation generated while the panel is open", () => {
  test("changing the recommendation key re-reads the list and the chosen preview, and a previous approval is cleared", async () => {
    const view = renderPanel({ recommendationKey: "a:1" })
    await choose(0)
    await screen.findByTestId("alt-approval", {}, slow)
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #100/ }))
    const listCalls = apiService.listImageAltImages.mock.calls.length
    view.rerenderWith({ recommendationKey: "b:2" })
    await waitFor(() => expect(apiService.listImageAltImages.mock.calls.length).toBeGreaterThan(listCalls))
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /I approve setting attachment #100/ })).not.toBeChecked())
  })
})

describe("editing the suggestion while the next preview loads", () => {
  test("the text box stays mounted (focus is not lost), and the on-screen preview cannot be approved until the fresh plan arrives", async () => {
    renderPanel()
    await choose(1)
    await screen.findByTestId("alt-approval", {}, slow)
    const before = box()
    // the next preview is slow: the person has changed the text and the plan on screen belongs to the old text
    let release
    apiService.previewImageAltFix.mockImplementation((_id, input) => new Promise((resolve) => {
      release = () => resolve(respond(previewFor(SRCS.indexOf(input.imageSrc), input.proposedAlt, recFn(1))))
    }))
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve setting attachment #101/ }))
    fireEvent.change(box(), { target: { value: `${aiText(1)} (edited)` } })
    await waitFor(() => expect(release).toBeTypeOf("function"), slow)
    expect(box()).toBe(before)
    expect(screen.queryByTestId("alt-approval")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument()
    release()
    expect(await screen.findByTestId("alt-approval", {}, slow)).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /I approve setting attachment #101/ })).not.toBeChecked()
  })

  test("the previous preview is never carried over to a DIFFERENT image", async () => {
    renderPanel()
    await choose(1)
    await waitFor(() => expect(screen.getByTestId("alt-proposed")).toHaveTextContent(aiText(1)), slow)
    apiService.previewImageAltFix.mockImplementation(() => new Promise(() => {}))
    await choose(2)
    await waitFor(() => expect(screen.queryByTestId("alt-identity")).not.toBeInTheDocument(), slow)
    expect(screen.queryByTestId("alt-proposed")).not.toBeInTheDocument()
  })
})

describe("the list chip", () => {
  test("only images with an exact AI suggestion show it; a fixed image shows its status instead", async () => {
    apiService.listImageAltImages.mockResolvedValue(respond({ images: [item(0), item(1, { aiSuggestion: false }), item(2, { targetStatus: "verified", fix: { status: "verified" } })] }))
    renderPanel()
    const rows = await screen.findAllByTestId("alt-image-row")
    expect(within(rows[0]).queryByTestId("alt-ai-chip")).toBeInTheDocument()
    expect(within(rows[1]).queryByTestId("alt-ai-chip")).not.toBeInTheDocument()
    expect(within(rows[2]).queryByTestId("alt-ai-chip")).not.toBeInTheDocument()
  })
})
