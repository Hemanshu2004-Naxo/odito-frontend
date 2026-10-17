import { describe, test, expect } from "vitest"
import { describeAltError, describeAltItem, describeIgnored, describeManualFix, getAltPanelAvailability, getImageAltModel, isAltFindingNotApplicable } from "./imageAltFix"

describe("describeManualFix — only builder-controlled images Odito cannot change", () => {
  const base = (over = {}) => ({
    targetUrl: "https://s.example/", image: { sourceUrl: "https://s.example/wp-content/uploads/a.png" }, identity: { status: "resolved", attachmentId: 5 },
    plan: { status: "ready", fingerprint: "f" }, source: { kind: "media_library", label: "WordPress media library", writeTarget: "x" },
    diagnosis: { state: "missing", source: "media_library", fixMechanism: "media_library", supported: true, builder: null, manual: null }, ...over,
  })
  const model = (p) => getImageAltModel(p)

  test("a media-library image is NOT a manual case (the normal Apply workflow stays)", () => {
    expect(describeManualFix(model(base()))).toBeNull()
    // not even on a Divi site: a builder that may override is still writable through the library
    expect(describeManualFix(model(base({ diagnosis: { ...base().diagnosis, builder: "Divi", builderMayOverride: true } })))).toBeNull()
  })

  test("a Divi Theme Builder / unsupported module source is the compact Divi card, with the server's instructions and the suggestion", () => {
    const m = model(base({
      plan: { status: "unsupported", fingerprint: "f" },
      source: { kind: "manual", label: "Theme Builder / template (not editable by Odito)", code: "THEME_TEMPLATE_NOT_EDITABLE", message: "Set logo_alt in the header template." },
      diagnosis: { state: "library_alt_overridden", source: "theme_template", fixMechanism: "theme_template", supported: false, builder: "Divi", manual: "m" },
      recommendation: { status: "available", alt: "Acme logo" },
    }))
    expect(describeManualFix(m)).toEqual({ builder: "Divi", title: "Divi Builder Image", message: "Odito can't update this image automatically. Edit its alt text in Divi Builder.", instructions: "Set logo_alt in the header template.", suggestion: "Acme logo" })
    expect(m.canApprove).toBe(false)
  })

  test("a module that overrides the library without a manual source is also compact; a non-Divi template says so generically", () => {
    const over = model(base({ plan: { status: "rendered_mismatch", fingerprint: "f" }, diagnosis: { state: "library_alt_overridden", source: "page_builder_module", fixMechanism: "page_content", supported: false, builder: "Divi", manual: "Open it in Divi." } }))
    expect(describeManualFix(over)).toMatchObject({ title: "Divi Builder Image", instructions: "Open it in Divi.", suggestion: null })
    const plain = model(base({ plan: { status: "unsupported", fingerprint: "f" }, source: { kind: "manual", label: "Theme Builder / template (not editable by Odito)", message: "m" }, diagnosis: { fixMechanism: "theme_template", supported: false, builder: null, state: "x", source: "theme_template" } }))
    expect(describeManualFix(plain)).toMatchObject({ title: "Theme Template Image", message: "Odito can't update this image automatically. Edit its alt text in your theme or page builder." })
  })

  test("decorative, already-fixed, unidentified and not-yet-loaded images are not manual cases", () => {
    expect(describeManualFix(model(base({ plan: { status: "decorative" }, diagnosis: { state: "decorative", fixMechanism: "none", supported: false, builder: "Divi" } })))).toBeNull()
    expect(describeManualFix(model(base({ plan: { status: "stale_finding" }, diagnosis: { state: "stale_finding", fixMechanism: "none", supported: false, builder: "Divi" } })))).toBeNull()
    expect(describeManualFix(model(base({ identity: { status: "ambiguous_target" }, plan: { status: "ambiguous_target" } })))).toBeNull()
    expect(describeManualFix(model(null))).toBeNull()
  })
})

describe("getAltPanelAvailability — every reason the WordPress panel is withheld is said out loud", () => {
  const ok = { selUrl: "https://s.example/p", taskId: "t1", wpCapabilities: { connected: true } }

  test("offered only with a page, a task, and a connected WordPress site", () => {
    expect(getAltPanelAvailability(ok)).toEqual({ available: true, reason: null, message: null })
  })

  test("no page selected: nothing to explain yet", () => {
    expect(getAltPanelAvailability({ ...ok, selUrl: null })).toMatchObject({ available: false, reason: "no_page", message: null })
  })

  test("no task: explains how to get one", () => {
    const r = getAltPanelAvailability({ ...ok, taskId: undefined })
    expect(r).toMatchObject({ available: false, reason: "no_task" })
    expect(r.message).toMatch(/needs a task/i)
  })

  test("WordPress not connected: says to connect it and that DIY remains", () => {
    const r = getAltPanelAvailability({ ...ok, wpCapabilities: { connected: false } })
    expect(r).toMatchObject({ available: false, reason: "not_connected" })
    expect(r.message).toMatch(/connect your wordpress/i)
    expect(r.message).toMatch(/DIY/)
  })

  test("a failed capability check is reported, not treated as 'not connected' and not swallowed", () => {
    const r = getAltPanelAvailability({ ...ok, wpCapabilities: undefined, capabilitiesError: true })
    expect(r).toMatchObject({ available: false, reason: "capabilities_error" })
    expect(r.message).toMatch(/could not check/i)
  })

  test("still loading: no message and no panel (it is not a failure)", () => {
    expect(getAltPanelAvailability({ ...ok, wpCapabilities: undefined })).toMatchObject({ available: false, reason: "loading", message: null })
  })
})

const FP = "d".repeat(64)
const preview = (over = {}) => ({
  fixType: "image_alt", targetUrl: "https://clinic.example/doctors",
  image: { sourceUrl: "https://clinic.example/wp-content/uploads/2024/10/dr-rao.jpg", altState: "missing" },
  identity: { status: "resolved", attachmentId: 42, confidence: "high", method: "exact_source_url", evidence: ["Exactly one media-library attachment lists the observed file path."], matchedUrls: [] },
  field: "alt_text", setting: "WordPress media library → attachment 42 → alt text",
  classification: { kind: "informative", decorative: false, signals: [] },
  current: { alt: "", note: "WordPress reports a missing and an empty alt text the same way." }, proposed: { alt: "Dr Rao with a patient" },
  suggestions: [], validation: { ok: true, errors: [], warnings: [] }, contentEffect: { status: "not_in_content" },
  plan: { status: "ready", fingerprint: FP, code: null, message: null },
  verificationStatus: { saved: "pending", rendered: "pending" }, record: null, ...over,
})
const record = (over = {}) => ({ status: "applied", changes: [{ field: "alt_text", applied: true, restored: false }], verification: { saved: { status: "verified" }, rendered: { status: "pending" } }, rollback: { status: "none" }, ...over })

describe("getImageAltModel", () => {
  test("not loaded until the server answers", () => { expect(getImageAltModel(null)).toEqual({ loaded: false }) })

  test("a ready plan can be approved; identity carries the attachment, confidence, method and evidence", () => {
    const m = getImageAltModel(preview())
    expect(m.canApprove).toBe(true)
    expect(m.planLabel).toBe("Ready to apply")
    expect(m.identity).toMatchObject({ resolved: true, attachmentId: 42, confidenceLabel: "High confidence" })
    expect(m.identity.methodLabel).toMatch(/Exact file path/)
    expect(m.identity.evidence).toHaveLength(1)
    expect(m.setting).toMatch(/attachment 42/)
    expect(m.fingerprint).toBe(FP)
  })

  test("EVERY other plan status can never be approved: needs input, invalid, decorative, existing alt, nothing to change, unsupported, ambiguous", () => {
    for (const status of ["needs_input", "validation_failed", "decorative", "existing_alt_preserved", "nothing_to_change", "unsupported", "ambiguous_target"]) {
      const m = getImageAltModel(preview({ plan: { status, fingerprint: FP, message: "why" } }))
      expect(m.canApprove, status).toBe(false)
      expect(m.planLabel.length, status).toBeGreaterThan(3)
    }
  })

  test("an unresolved identity is explained, with the reason code and message", () => {
    const m = getImageAltModel(preview({ identity: { status: "ambiguous_target", code: "MULTIPLE_ATTACHMENTS_MATCH", message: "More than one attachment lists this file." }, plan: { status: "ambiguous_target", fingerprint: FP, message: "More than one attachment lists this file." } }))
    expect(m.identity.resolved).toBe(false)
    expect(m.identity.message).toMatch(/More than one/)
    expect(m.canApprove).toBe(false)
  })

  test("once applied there is nothing to approve; re-verify and roll back appear — and roll back disappears after it", () => {
    const applied = getImageAltModel(preview({ record: record() }))
    expect(applied.canApprove).toBe(false)
    expect(applied.canReverify).toBe(true)
    expect(applied.canRollback).toBe(true)
    const rolled = getImageAltModel(preview({ record: record({ status: "rolled_back", changes: [{ applied: true, restored: true }] }) }))
    expect(rolled.canRollback).toBe(false)
    expect(rolled.canReverify).toBe(false)
  })

  test("saved and rendered stay separate: 'verified' needs both", () => {
    expect(getImageAltModel(preview({ record: record() })).verification).toEqual({ saved: "verified", rendered: "pending", savedCode: null, renderedCode: null, overall: "pending" })
    expect(getImageAltModel(preview({ record: record({ verification: { saved: { status: "verified" }, rendered: { status: "verified" } } }) })).verification.overall).toBe("verified")
    expect(getImageAltModel(preview({ record: record({ verification: { saved: { status: "verified" }, rendered: { status: "unverifiable" } } }) })).verification.overall).toBe("pending")
  })
})

describe("resource kinds — only an upload is offered as editable", () => {
  test("a non-upload says what it is and that it is not editable here; an upload (or an old record with no kind) says nothing extra", () => {
    expect(describeAltItem({ src: "u", resourceKind: "theme_asset", mediaLibraryCandidate: false }).resourceLabel).toBe("Theme file")
    expect(describeAltItem({ src: "u", resourceKind: "plugin_asset", mediaLibraryCandidate: false }).resourceLabel).toBe("Plugin file")
    expect(describeAltItem({ src: "u", resourceKind: "external_image", mediaLibraryCandidate: false }).resourceLabel).toMatch(/another website/i)
    expect(describeAltItem({ src: "u", resourceKind: "wp_media", mediaLibraryCandidate: true }).resourceLabel).toBeNull()
    expect(describeAltItem({ src: "u" }).resourceLabel).toBeNull()
  })

  test("trackers that were set aside are reported by count only, and never as a fix", () => {
    expect(describeIgnored(null)).toBeNull()
    expect(describeIgnored({ trackingEndpoints: 0 })).toBeNull()
    expect(describeIgnored({ trackingEndpoints: 1 })).toMatch(/1 flagged address is an analytics or advertising tracker/)
    expect(describeIgnored({ trackingEndpoints: 3 })).toMatch(/3 flagged addresses/)
    for (const n of [1, 3]) expect(describeIgnored({ trackingEndpoints: n })).toMatch(/nothing was fixed/)
    expect(describeIgnored({ trackingEndpoints: 1 })).not.toMatch(/https?:|\d{8,}/)
  })
})

describe("describeAltItem — missing, empty and unknown are never the same thing", () => {
  test("labels and help differ for each alt state", () => {
    const labels = ["missing", "empty", "unknown"].map((altState) => describeAltItem({ src: "u", altState }))
    expect(new Set(labels.map((l) => l.altStateLabel)).size).toBe(3)
    expect(labels[1].altStateHelp).toMatch(/decorative/)
    expect(describeAltItem({ src: "u", altState: "missing", fix: { status: "verified" } }).fixLabel).toBe("Verified")
  })
})

describe("describeAltError", () => {
  const err = (over) => Object.assign(new Error(over.message || "m"), over)
  test("alt-specific failures keep their own wording and never offer a blind retry", () => {
    expect(describeAltError(err({ code: "IMAGE_NOT_FLAGGED" })).title).toMatch(/no longer a finding/)
    const edited = describeAltError(err({ status: 409, code: "CONFLICT", details: { reason: "alt_changed" } }))
    expect(edited.message).toMatch(/Nothing was overwritten/); expect(edited.retry).toBe(false)
    expect(describeAltError(err({ status: 409, code: "CONFLICT", details: { reason: "target_changed" } })).title).toMatch(/image file changed/)
    expect(describeAltError(err({ status: 422, code: "FIELD_NOT_WRITABLE", message: "not on the site", details: { reason: "site_mismatch" } })).title).toMatch(/connected site/)
  })
  test("everything else uses the shared WordPress vocabulary (stale preview, permission, timeout)", () => {
    expect(describeAltError(err({ status: 409, code: "CONFLICT", details: { reason: "preview_stale" } })).refreshPreview).toBe(true)
    expect(describeAltError(err({ status: 403, code: "PERMISSION_DENIED" })).title).toBe("Permission denied")
    expect(describeAltError(err({ status: 504 })).retry).toBe(true)
    expect(describeAltError(null)).toBeNull()
  })
})

describe("isAltFindingNotApplicable — only on positive evidence", () => {
  test("true only when the finding covered nothing but trackers", () => {
    expect(isAltFindingNotApplicable({ altFindingScope: { actionable: 0, ignoredTracking: 1 } })).toBe(true)
    for (const ctx of [null, undefined, {}, { altFindingScope: null }, { altFindingScope: { actionable: 3, ignoredTracking: 1 } }, { altFindingScope: { actionable: 0, ignoredTracking: 0 } }]) {
      expect(isAltFindingNotApplicable(ctx)).toBe(false)
    }
  })
})
