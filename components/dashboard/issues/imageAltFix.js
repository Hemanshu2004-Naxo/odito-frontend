// Pure view-model helpers for the image alt-text fix panel. No React, no network.
//
// The server decides everything: which attachment the image is (and how sure it is), whether the change can take effect,
// the plan, the verdicts. These helpers only translate that into what the panel shows — and enforce the UX rules:
//   - nothing can be approved unless the server's plan is `ready`;
//   - "applied" only when WordPress accepted the write, "verified" only when BOTH the saved alt AND the recrawled page agree;
//   - a missing alt and an intentionally empty alt are never shown as the same thing.

import { describeFixError, rollbackStage, verificationSummary } from "./organizationFix"

export const IMAGE_ALT_ISSUE_ID = "images_missing_alt_text"

export const ALT_STATE_LABEL = {
  missing: "No alt attribute",
  empty: 'alt="" (empty)',
  unknown: "Missing or empty",
  blank: "Blank alt",
  present: "Has alt text",
}

export const ALT_STATE_HELP = {
  missing: "The page has no alt attribute on this image.",
  empty: 'The page has alt="". Authors use this for decorative images; a theme also outputs it when the media library has no alt text.',
  unknown: "This crawl did not record whether the attribute was missing or empty. Recrawl to find out.",
}

export const ALT_NOT_APPLICABLE_TITLE = "Nothing to fix on this page"
export const ALT_NOT_APPLICABLE_MESSAGE = "The only item flagged here is an analytics or advertising tracker (for example a Facebook Pixel), not a picture, so there is no alt text to write and nothing to implement. The audit stops reporting it on the next recrawl. Nothing is marked as fixed."

/**
 * True only on positive evidence from the server: the finding covered nothing but trackers (no picture is left to describe).
 * With no scope (an older response, no page selected) it is false and everything behaves as before.
 */
export function isAltFindingNotApplicable(issueContext) {
  const scope = issueContext?.altFindingScope
  return !!scope && scope.actionable === 0 && scope.ignoredTracking > 0
}

/** Shown on the DIY Guide tab: the WordPress alt-text fix lives on the Fix with AI tab, one image at a time. */
export const ALT_DIY_POINTER = "To change alt text directly in your WordPress media library, open the Fix with AI tab: pick one flagged image, review the exact change, approve it, and Odito applies and verifies it. Images that are not media-library files (tracking pixels, theme or plugin assets, other sites) cannot be edited that way."

/**
 * Whether the WordPress alt-text panel can be offered for the selected page, and — when it cannot — WHY, so the person is never
 * left with a silent absence. Purely about prerequisites the client already knows; everything about the images themselves
 * (identity, support, plan) is still the server's word once the panel is open.
 */
export function getAltPanelAvailability({ selUrl, taskId, wpCapabilities, capabilitiesError = false }) {
  if (!selUrl) return { available: false, reason: "no_page", message: null }
  if (!taskId) {
    return { available: false, reason: "no_task", message: "The WordPress alt-text fix needs a task for this page. Generate the AI recommendation (or create a task) to enable it." }
  }
  if (capabilitiesError) {
    return { available: false, reason: "capabilities_error", message: "Odito could not check your WordPress connection, so the alt-text fix is unavailable right now. Reload to try again — the DIY Guide is still available." }
  }
  if (!wpCapabilities) return { available: false, reason: "loading", message: null }
  if (!wpCapabilities.connected) {
    return { available: false, reason: "not_connected", message: "Connect your WordPress site to apply alt text automatically. The DIY Guide still shows how to do it by hand." }
  }
  return { available: true, reason: null, message: null }
}

/** Why an image that is not a media-library upload cannot be edited from here — shown next to it, before anyone opens it. */
export const RESOURCE_KIND_LABEL = {
  theme_asset: "Theme file",
  plugin_asset: "Plugin file",
  core_asset: "WordPress core file",
  external_image: "Another website's image",
  data_url: "Inline image",
  content_image: "Not a media-library file",
}

/** What the server set aside as analytics trackers (a count only — never the address), or null when nothing was. */
export function describeIgnored(ignored) {
  const n = Number(ignored?.trackingEndpoints) || 0
  if (n <= 0) return null
  return n === 1
    ? "1 flagged address is an analytics or advertising tracker, not a picture on your site, so it is not listed. The next recrawl removes it from this audit; nothing was fixed."
    : `${n} flagged addresses are analytics or advertising trackers, not pictures on your site, so they are not listed. The next recrawl removes them from this audit; nothing was fixed.`
}

const PLAN_LABEL = {
  ready: { label: "Ready to apply", tone: "ok" },
  needs_input: { label: "Needs your description", tone: "info" },
  validation_failed: { label: "Alt text can't be published", tone: "warn" },
  decorative: { label: "Decorative — no fix required", tone: "muted" },
  needs_review: { label: "Needs your review", tone: "info" },
  rendered_mismatch: { label: "The page overrides the media library", tone: "warn" },
  stale_finding: { label: "Already fixed on the live page", tone: "ok" },
  existing_alt_preserved: { label: "Existing alt text kept", tone: "info" },
  nothing_to_change: { label: "Already set", tone: "ok" },
  unsupported: { label: "Not supported for this image", tone: "warn" },
  ambiguous_target: { label: "Target is ambiguous", tone: "warn" },
}

/** Plan statuses for which a media-library write is NOT possible: nothing to type, nothing to approve, an explanation instead. */
const NOT_WRITABLE = ["rendered_mismatch", "stale_finding", "unsupported", "ambiguous_target"]

/**
 * The comparison the person is shown, from the preview's `diagnosis`: what the page renders, what WordPress holds, what draws the image,
 * and whether Odito can change it. The server decides; this only words it.
 */
export function describeDiagnosis(d) {
  if (!d) return null
  const renderedLabel = d.renderedAlt === undefined ? "Not recorded (crawled before this was tracked)" : d.renderedAlt === null ? "No alt attribute" : d.renderedAlt === "" ? 'alt="" (empty)' : `“${d.renderedAlt}”`
  let fixText
  if (d.supported) fixText = d.builderMayOverride ? "Yes, through the WordPress media library after your approval. A page-builder module names this file and may not use the library value, so Odito checks the live page afterwards." : "Yes, through the WordPress media library after your approval."
  else if (d.state === "decorative") fixText = "No fix required."
  else if (d.state === "stale_finding") fixText = "No fix needed: the live page already shows it."
  else if (d.fixMechanism === "theme_template") fixText = "Not by Odito. Edit the template that renders this image."
  else if (d.fixMechanism === "page_content") fixText = "Not by Odito. Edit the page content or the builder module."
  else fixText = "Not by Odito."
  return {
    state: d.state, source: d.source, supported: !!d.supported, fixMechanism: d.fixMechanism || null, manual: d.manual || null, builder: d.builder || null,
    renderedLabel,
    libraryLabel: d.libraryAlt ? `“${d.libraryAlt}”` : "No alt text",
    sourceText: [d.sourceLabel, d.builder && d.source !== "media_library" ? `(${d.builder})` : null].filter(Boolean).join(" ") || "Not identifiable",
    fixText, evidence: d.evidence || [],
  }
}

export const DIVI_KIND = "divi_page_module"

/**
 * Where the change would be written, from the preview's `source`. The server derives it (the page, the module, the attribute are never
 * supplied by the client); this only words it. kind: media_library | divi_page_module | manual.
 */
export function describeSource(source) {
  if (!source) return null
  const base = { kind: source.kind, label: source.label, isDivi: source.kind === DIVI_KIND, isManual: source.kind === "manual", writable: source.kind !== "manual" && !!source.writeTarget }
  if (source.kind === DIVI_KIND) {
    return {
      ...base,
      identifier: source.identifier,
      moduleText: `${source.moduleLabel} (${source.module})`,
      attributeText: source.altAttribute,
      storedText: source.attributePresent ? (source.storedValue ? `“${source.storedValue}”` : 'alt="" (empty)') : "Not set — the module has no alt attribute",
      versionText: source.diviVersion ? `Divi ${source.diviVersion} (shortcode format)` : null,
      evidenceNote: source.evidenceNote || null,
      writeTarget: source.writeTarget, verification: source.verification,
      writeModeNote: "WordPress offers no conditional write for page content, so Odito re-reads the page immediately before writing and refuses if anything changed. An edit made in that split second is not guaranteed to be caught.",
    }
  }
  if (source.kind === "manual") return { ...base, code: source.code, message: source.message, stateText: "Unsupported source — manual edit required" }
  return { ...base, identifier: source.identifier, writeTarget: source.writeTarget, verification: source.verification }
}

/** The one sentence under "Result", worded for the source that was written. */
export function describeResultSummary(fix, { isDivi = false, rollbackVerified = false } = {}) {
  if (!fix) return null
  const s = fix.status
  if (s === "rolled_back") {
    if (isDivi) return rollbackVerified ? "The Divi module was put back as it was (only its alt attribute was touched) and read back from the page." : "The Divi module was put back as it was. The page has not been read back yet to confirm it."
    return rollbackVerified ? "The previous alt text was restored and read back from WordPress." : "The previous alt text was restored. WordPress has not been read back yet to confirm it."
  }
  if (s === "apply_uncertain") return isDivi ? "WordPress did not confirm whether the module change was saved. Nothing was repeated or undone — check the status." : "WordPress did not confirm whether the alt text was saved. Nothing was repeated or undone — check the status."
  if (s === "verified") return isDivi ? "The Divi module holds the alt text and the live page renders it on exactly this image. The audit finding resolves after the next successful analysis of the page." : "WordPress holds the alt text and your crawled page shows it on this image."
  if (s === "verification_failed") return "WordPress accepted the change, but it is not verified — see below."
  if (["conflict_detected", "apply_failed", "permission_denied"].includes(s)) return "The change was not applied."
  return isDivi ? "Applied — verification pending. The change was saved; the live page has not confirmed it yet." : "WordPress accepted the change. It is not verified until the recrawled page shows it on this image."
}

const CONFIDENCE_LABEL = { high: "High confidence", medium: "Medium confidence" }
const METHOD_LABEL = {
  attachment_id_class: "WordPress attachment id (wp-image class) confirmed by the file",
  exact_source_url: "Exact file path in the media library",
}

/** One status per image (server-derived from the ledger). `not_started` shows nothing extra. */
export const TARGET_STATUS = {
  in_progress: { label: "Applying…", tone: "info" },
  needs_reconcile: { label: "Outcome unknown — check status", tone: "warn" },
  applied_pending_verification: { label: "Applied — verification pending", tone: "info" },
  verified: { label: "Verified", tone: "ok" },
  verification_failed: { label: "Verification failed", tone: "bad" },
  failed: { label: "Not applied — can be retried", tone: "warn" },
  rolled_back: { label: "Rolled back", tone: "muted" },
  rollback_incomplete: { label: "Rollback unfinished", tone: "warn" },
}

const OVERALL = {
  in_progress: { label: "A change is being applied", tone: "info" },
  partially_applied: { label: "Partly applied — some images need attention", tone: "warn" },
  failed: { label: "Not applied", tone: "bad" },
  needs_attention: { label: "Applied, but the page does not confirm it for some images", tone: "bad" },
  partially_verified: { label: "Partly verified — some images are still unconfirmed", tone: "info" },
  applied_pending_verification: { label: "Applied — waiting for the page to confirm", tone: "info" },
  verified_images_remaining: { label: "Every changed image is verified — other flagged images are untouched", tone: "ok" },
  verified: { label: "Every changed image is verified", tone: "ok" },
  rolled_back: { label: "Rolled back", tone: "muted" },
}

/** The task-level roll-up. 'verified' is only ever the server's word, and only when every changed image is verified. */
export function describeAltSummary(summary) {
  if (!summary || !summary.targets) return null
  const meta = OVERALL[summary.overall] || { label: summary.overall, tone: "muted" }
  const by = summary.byStatus || {}
  const counts = Object.entries(TARGET_STATUS).map(([key, v]) => ({ key, label: v.label, n: by[key] || 0 })).filter((c) => c.n > 0)
  return {
    overall: summary.overall, label: meta.label, tone: meta.tone, targets: summary.targets, counts,
    retryable: summary.retryable || [], recoverable: summary.recoverable || [], remaining: summary.remainingOpenImages || 0,
  }
}

export function describeAltItem(item) {
  const status = TARGET_STATUS[item.targetStatus] || null
  return {
    ...item,
    statusLabel: status?.label || null,
    statusTone: status?.tone || null,
    // Only said when the server knows it is NOT an upload; an upload (or an older record with no kind) shows nothing extra.
    resourceLabel: item.mediaLibraryCandidate === false ? (RESOURCE_KIND_LABEL[item.resourceKind] || null) : null,
    // An exact-match AI proposal exists for this image (the text itself is only loaded once the image is chosen).
    hasAiSuggestion: item.aiSuggestion === true,
    altStateLabel: ALT_STATE_LABEL[item.altState] || ALT_STATE_LABEL.unknown,
    altStateHelp: ALT_STATE_HELP[item.altState] || null,
    fixLabel: item.fix ? ({ applied: "Applied", verified: "Verified", verification_failed: "Verification failed", rolled_back: "Rolled back", conflict_detected: "Conflict", apply_failed: "Failed", permission_denied: "Permission denied" }[item.fix.status] || item.fix.status) : null,
  }
}

const CONFIDENCE_TEXT = { medium: "Supported by the file name or the page's own text", low: "Not backed by anything the page says about this image" }

/**
 * The AI recommendation for ONE image, from the preview. The server decides everything (the match, the evidence, the confidence); this only
 * says what the panel may do with it:
 *   prefill  an exact-match proposal: it may fill an EMPTY, untouched text box (the person still edits and approves it)
 *   offer    a text-only legacy recommendation mapped by position: shown as a button, never filled in
 *   note     every other state: say why there is nothing to reuse
 */
export function describeAltRecommendation(rec) {
  if (!rec) return null
  const hasText = typeof rec.alt === "string" && rec.alt.trim() !== ""
  return {
    status: rec.status,
    alt: hasText ? rec.alt : null,
    basis: rec.basis || null,
    message: rec.message || null,
    evidence: rec.evidence || [],
    confidence: rec.confidence || null,
    confidenceText: CONFIDENCE_TEXT[rec.confidence] || null,
    needsConfirmation: !!rec.needsConfirmation,
    recommendationId: rec.recommendationId || null,
    generatedAt: rec.generatedAt || null,
    prefill: rec.status === "available" && hasText,
    offer: rec.status === "suggested_by_position" && hasText,
    note: !hasText ? (rec.message || null) : null,
    legacy: rec.match === "legacy_position",
  }
}

/**
 * The compact "edit it in your builder" view, for an image whose alt text is drawn by something Odito cannot change: a page-builder
 * module or Theme Builder template it cannot safely edit. Decided from what the server already reported (`source` is manual, or the
 * diagnosis says a builder module / theme template overrides the library and nothing is writable) — never from the image URL.
 * null for everything else: a media-library image keeps the normal workflow, and a decorative / already-fixed / unidentified one is not
 * a builder case.
 */
export function describeManualFix(model) {
  if (!model?.loaded || !model.identity?.resolved) return null
  const d = model.diagnosis
  const blocked = model.source?.isManual || (!model.writable && !!d && !d.supported && ["theme_template", "page_content"].includes(d.fixMechanism))
  return blocked ? manualView(model) : null
}

function manualView(model) {
  const d = model.diagnosis
  const builder = d?.builder || (/divi/i.test(model.source?.label || "") ? "Divi" : null)
  const rec = model.recommendation
  return {
    builder,
    title: builder ? `${builder} Builder Image` : "Theme Template Image",
    message: `Odito can't update this image automatically. Edit its alt text in ${builder ? `${builder} Builder` : "your theme or page builder"}.`,
    // The server's own, specific instructions (which module / template and which setting) — behind one subtle disclosure.
    instructions: model.source?.message || d?.manual || null,
    suggestion: rec && (rec.prefill || rec.offer) ? rec.alt : null,
  }
}

/** Everything the panel shows for one image, from `POST /tasks/:id/image-alt/preview`. `preview` may be null while loading. */
export function getImageAltModel(preview) {
  if (!preview) return { loaded: false }
  const plan = preview.plan || {}
  const fix = preview.record || null
  const meta = PLAN_LABEL[plan.status] || { label: plan.status, tone: "muted" }
  const alreadyDone = !!fix && ["applying", "apply_uncertain", "applied", "verifying", "verified", "verification_failed"].includes(fix.status)
  const rolledBack = fix?.status === "rolled_back"
  return {
    loaded: true,
    targetUrl: preview.targetUrl,
    image: preview.image,
    identity: {
      status: preview.identity?.status,
      resolved: preview.identity?.status === "resolved",
      attachmentId: preview.identity?.attachmentId ?? null,
      confidenceLabel: CONFIDENCE_LABEL[preview.identity?.confidence] || null,
      confidence: preview.identity?.confidence || null,
      methodLabel: METHOD_LABEL[preview.identity?.method] || null,
      evidence: preview.identity?.evidence || [],
      matchedUrls: preview.identity?.matchedUrls || [],
      code: preview.identity?.code || null,
      message: preview.identity?.message || null,
    },
    field: preview.field,
    setting: preview.setting,
    classification: preview.classification,
    currentAlt: preview.current?.alt || "",
    currentNote: preview.current?.note || null,
    proposedAlt: preview.proposed?.alt ?? null,
    suggestions: preview.suggestions || [],
    recommendation: describeAltRecommendation(preview.recommendation),
    diagnosis: describeDiagnosis(preview.diagnosis),
    source: describeSource(preview.source),
    isDivi: preview.source?.kind === DIVI_KIND,
    fixIsDivi: fix?.target?.sourceKind === DIVI_KIND,
    currentRendered: preview.current?.rendered,
    // A text box, an exact before/after and an approval make sense only where a media-library write is possible.
    writable: !NOT_WRITABLE.includes(plan.status),
    validation: preview.validation || { ok: null, errors: [], warnings: [] },
    contentEffect: preview.contentEffect?.status || null,
    planStatus: plan.status,
    planLabel: meta.label,
    planTone: meta.tone,
    planCode: plan.code || null,
    planMessage: plan.message || null,
    fingerprint: plan.fingerprint,
    canApprove: plan.status === "ready" && !alreadyDone,
    fix,
    alreadyDone,
    verification: verificationSummary(fix, preview),
    // Re-verify also reconciles an uncertain apply, and re-checks a rollback that was applied but not yet confirmed.
    canReverify: !!fix && (["applied", "verifying", "verification_failed", "verified", "apply_uncertain"].includes(fix.status) || (rolledBack && fix.rollback?.status === "applied")),
    uncertain: fix?.status === "apply_uncertain",
    canRollback: !!fix?.changes?.some((c) => c.applied && !c.restored) && !rolledBack && fix?.status !== "apply_uncertain",
    rollback: fix?.rollback || null,
    rollbackStage: rollbackStage(fix?.rollback),
    concurrency: preview.concurrency?.writes || null,
    creationWindow: !!preview.concurrency?.creationWindow,
  }
}

/** Alt-specific failures first; everything else is the shared WordPress fix vocabulary. */
export function describeAltError(error) {
  if (!error) return null
  const reason = error.details?.reason
  if (error.code === "IMAGE_NOT_FLAGGED") {
    return { tone: "warn", retry: false, refreshPreview: true, updatePlugin: false, title: "This image is no longer a finding", message: "It may already have been fixed, or the page was recrawled. Refresh the list." }
  }
  if (error.code === "CONFLICT" && reason === "alt_changed") {
    return { tone: "warn", retry: false, refreshPreview: true, updatePlugin: false, title: "The alt text changed in WordPress", message: "Someone edited this image's alt text after you previewed it. Nothing was overwritten. Review the refreshed preview." }
  }
  if (error.code === "CONFLICT" && reason === "page_changed") {
    return { tone: "warn", retry: false, refreshPreview: true, updatePlugin: false, title: "Conflict detected — the page changed", message: "The page was edited in WordPress after you previewed it. Nothing was overwritten. Review the refreshed preview." }
  }
  if (error.code === "CONFLICT" && reason === "target_changed" && /Divi module/.test(error.message || "")) {
    return { tone: "warn", retry: false, refreshPreview: true, updatePlugin: false, title: "Conflict detected — the module changed", message: "The Divi module you approved is no longer on the page as it was. Nothing was written. Review the refreshed preview." }
  }
  if (error.code === "CONFLICT" && reason === "target_changed") {
    return { tone: "warn", retry: false, refreshPreview: true, updatePlugin: false, title: "The image file changed", message: "The attachment no longer matches the image you approved. Nothing was written. Review the refreshed preview." }
  }
  if (error.code === "VALIDATION_FAILED" && reason === "edit_not_minimal") {
    return { tone: "bad", retry: false, refreshPreview: true, updatePlugin: false, title: "The change could not be made safely", message: error.message }
  }
  if (error.code === "FIELD_NOT_WRITABLE" && reason === "site_mismatch") {
    return { tone: "warn", retry: false, refreshPreview: false, updatePlugin: false, title: "Not the connected site", message: error.message }
  }
  return describeFixError(error)
}
