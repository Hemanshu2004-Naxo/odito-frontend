import { beforeEach, describe, expect, test } from "vitest"
import { clearAllDrafts, clearDraft, getDraft, prefillMarker, saveDraft, shouldPrefill } from "./altDraftStore"
import { describeAltItem, describeAltRecommendation, getImageAltModel } from "./imageAltFix"

const rec = (over = {}) => describeAltRecommendation({ status: "available", alt: "Dr Rao at the clinic", match: "exact_src", recommendationId: "r1", confidence: "medium", evidence: ["The image file is named “dr-rao”."], message: "m", ...over })

beforeEach(() => clearAllDrafts())

describe("drafts", () => {
  test("are keyed per task and image, merge patches, and are cleared explicitly", () => {
    saveDraft("t1", "a.jpg", { text: "one" })
    saveDraft("t1", "a.jpg", { informative: true })
    expect(getDraft("t1", "a.jpg")).toMatchObject({ text: "one", informative: true, touched: false })
    expect(getDraft("t1", "b.jpg")).toBeNull()
    expect(getDraft("t2", "a.jpg")).toBeNull()
    clearDraft("t1", "a.jpg")
    expect(getDraft("t1", "a.jpg")).toBeNull()
  })

  test("nothing is stored without a task and an image", () => {
    expect(saveDraft("", "a.jpg", { text: "x" })).toBeNull()
    expect(saveDraft("t1", "", { text: "x" })).toBeNull()
  })
})

describe("shouldPrefill — only an empty, untouched box, once per recommendation", () => {
  const r = rec()
  test("fills a fresh empty box", () => expect(shouldPrefill(null, r, "")).toBe(true))
  test("never over text the person typed (even whitespace-free edits) or after they touched it", () => {
    expect(shouldPrefill(null, r, "My own text")).toBe(false)
    expect(shouldPrefill({ touched: true }, r, "")).toBe(false)
  })
  test("not again once this very recommendation was placed (a cleared box stays cleared)", () => {
    expect(shouldPrefill({ touched: false, prefilledFrom: prefillMarker(r) }, r, "")).toBe(false)
  })
  test("a NEWER recommendation text may be placed into an untouched empty box", () => {
    expect(shouldPrefill({ touched: false, prefilledFrom: prefillMarker(r) }, rec({ recommendationId: "r2", alt: "A newer text" }), "")).toBe(true)
  })
  test("legacy suggestions and empty states never prefill", () => {
    expect(shouldPrefill(null, rec({ status: "suggested_by_position", match: "legacy_position", needsConfirmation: true }), "")).toBe(false)
    expect(shouldPrefill(null, describeAltRecommendation({ status: "none", alt: null, message: "none" }), "")).toBe(false)
    expect(shouldPrefill(null, null, "")).toBe(false)
  })
})

describe("describeAltRecommendation", () => {
  test("an exact proposal can be prefilled; a positional legacy one can only be offered; everything else is a note", () => {
    expect(rec()).toMatchObject({ prefill: true, offer: false, note: null, legacy: false })
    expect(rec({ status: "suggested_by_position", match: "legacy_position", needsConfirmation: true })).toMatchObject({ prefill: false, offer: true, legacy: true, needsConfirmation: true })
    expect(describeAltRecommendation({ status: "none", alt: null, message: "No recommendation yet" })).toMatchObject({ prefill: false, offer: false, note: "No recommendation yet" })
    expect(describeAltRecommendation(null)).toBeNull()
  })

  test("the confidence text never claims more than the server said", () => {
    expect(rec({ confidence: "medium" }).confidenceText).toMatch(/file name or the page's own text/)
    expect(rec({ confidence: "low" }).confidenceText).toMatch(/Not backed/)
    expect(rec({ confidence: null }).confidenceText).toBeNull()
    expect(rec({ confidence: "high" }).confidenceText).toBeNull()
  })

  test("the model exposes it, and a list row knows when an exact suggestion exists", () => {
    const m = getImageAltModel({ plan: { status: "needs_input", fingerprint: "f" }, identity: { status: "resolved" }, recommendation: { status: "available", alt: "Dr Rao", recommendationId: "r" } })
    expect(m.recommendation.prefill).toBe(true)
    expect(getImageAltModel({ plan: {}, identity: {} }).recommendation).toBeNull()
    expect(describeAltItem({ src: "u", aiSuggestion: true }).hasAiSuggestion).toBe(true)
    expect(describeAltItem({ src: "u" }).hasAiSuggestion).toBe(false)
  })
})
