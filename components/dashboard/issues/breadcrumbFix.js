// Pure view-model helpers for the breadcrumb "Apply via WordPress" card. No React, no network.
//
// The server decides everything (the plan, the prediction, the validation, the verification verdicts). These helpers only word it.

export const BREADCRUMB_ISSUE_ID = "breadcrumblist_schema"

/** Shown on the DIY tab, where the generic "Enable Breadcrumbs" dialog used to be offered without any check of the trail. */
export const BREADCRUMB_DIY_POINTER = "Use the AI Recommendation tab: Odito looks for your page's real breadcrumb trail, you confirm it, and only then can it be published — through WordPress when the trail Rank Math would build is the one you confirmed, otherwise with the exact code and manual steps."

export const BREADCRUMB_STATES = {
  ready_to_apply: { label: "Ready to apply", tone: "info", text: "This is the exact change. Nothing has been written to WordPress yet." },
  unsupported_source: { label: "Manual change needed", tone: "warn", text: "Odito cannot publish this trail automatically on your site." },
  already_valid: { label: "Already valid", tone: "ok", text: "This page already outputs a valid BreadcrumbList." },
  applied_verification_pending: { label: "Applied — verification pending", tone: "info", text: "WordPress accepted the change. It is not verified until your live page shows it." },
  applied_verified: { label: "Applied and verified", tone: "ok", text: "WordPress holds the change and your live page publishes the trail." },
  verification_failed: { label: "Applied — verification failed", tone: "bad", text: "WordPress accepted the change, but your live page does not show the trail you confirmed. The finding stays open." },
  rolled_back: { label: "Rolled back", tone: "muted", text: "Breadcrumbs were switched off again." },
  validation_failed: { label: "Cannot be applied", tone: "warn", text: "The structured data did not pass validation." },
  blocked: { label: "Cannot be applied yet", tone: "warn", text: "Something has to be fixed before this can be applied." },
  not_available: { label: "Not available", tone: "muted", text: "There is nothing to apply for this page." },
}

export const shortUrl = (u) => { try { const x = new URL(u); return `${x.host}${x.pathname}${x.search}` } catch { return String(u || "") } }

/** The other pages of a site-wide change, from the rendered verification's `page:<url>` fields. */
export function describeBreadcrumbPages(fields) {
  return (fields || []).filter((f) => String(f.field).startsWith("page:")).map((f) => ({ url: String(f.field).slice(5), ok: !!f.ok, detail: f.ok ? "valid" : (f.actual || "not verified") }))
}
