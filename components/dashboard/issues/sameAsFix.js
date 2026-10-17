// Pure view-model helpers for the Organization sameAs panel. No React, no network.
//
// The server decides everything that matters (which links are candidates and how strong, the plan, the validation, the lifecycle, the
// verification verdicts). These helpers only turn that into what the panel shows, and enforce the UX rules:
//   - a link is selected for the person ONLY when the server marked it `suggested`; a weak or ambiguous one is never pre-selected;
//   - "applied" is shown only when the server says the write happened, "verified" only when the saved state AND the rendered page agree;
//   - nothing can be approved unless the server's plan is `ready` and its markup validation passed;
//   - the client's own URL check is a convenience (fast feedback) — the server validates everything again.

import { describeFixError } from "./organizationFix"

export const SAMEAS_ISSUE_ID = "sameas_array"

/** Shown on the DIY tab, where the older URL dialog used to be offered. */
export const SAMEAS_DIY_POINTER = "Use the Organization profile links panel on the AI Recommendation tab: Odito finds the profile links on your own site, you review or add your own, and only then approve the exact change to your Organization schema in WordPress. Odito never guesses profile URLs."

/** The states the panel can be in, in the vocabulary of the brief, with the sentence shown for each. */
export const SAMEAS_STATES = {
  looking: { label: "Looking for your profile links…", tone: "muted", text: "Odito is checking your structured data, your header and footer and a few other pages of your site." },
  candidates_discovered: { label: "Profile links found", tone: "info", text: "These links appear on your own site. Review them, change or remove what is wrong, then preview the exact change." },
  needs_confirmation: { label: "Needs your confirmation", tone: "warn", text: "Odito found possible profile links but cannot tell that they belong to your organization. Nothing is selected for you — tick the ones that are yours." },
  none_found: { label: "No profile links found", tone: "warn", text: "Odito found no organization profile links on your site, in its structured data or in your connected accounts, and will not invent one. Add the official profiles you have below, or leave sameAs out." },
  existing_present: { label: "Profiles already published", tone: "ok", text: "Every profile link Odito found is already in your Organization's sameAs. You can add another one below." },
  ready_to_preview: { label: "Preparing the preview…", tone: "info", text: "Odito is checking your selection against your WordPress settings." },
  ready_to_apply: { label: "Ready to apply", tone: "info", text: "This is the exact change. Nothing has been written to WordPress yet." },
  unsupported_source: { label: "Manual change needed", tone: "warn", text: "Odito cannot change this Organization automatically on your site. The steps and the structured data below are what to add." },
  applied_verification_pending: { label: "Applied — verification pending", tone: "info", text: "WordPress accepted the change. It is not verified until your public page shows it." },
  applied_verified: { label: "Applied and verified", tone: "ok", text: "WordPress holds the change and your public page shows it." },
  verification_failed: { label: "Applied — verification failed", tone: "bad", text: "WordPress accepted the change, but it is not verified — see below. The finding stays open." },
  rolled_back: { label: "Rolled back", tone: "muted", text: "The previous values were restored." },
  no_selection: { label: "No links selected", tone: "muted", text: "Nothing is selected, so nothing will be written. sameAs is optional." },
  blocked: { label: "Cannot be applied", tone: "warn", text: "Something has to be fixed before this can be applied — see below." },
}

const HIDDEN_HOST = /^(?:www\.)?/i

/** Fast, local feedback for a typed link. Returns an error message, or null when it looks acceptable. The server decides. */
export function quickCheckUrl(raw, { siteUrl = "" } = {}) {
  const text = typeof raw === "string" ? raw.trim() : ""
  if (!text) return "Enter a link."
  if (/\s/.test(text)) return "A link cannot contain spaces. Add one link at a time."
  if (/^javascript:|^data:|^vbscript:|^file:/i.test(text)) return "This is not a web address."
  if (/^http:\/\//i.test(text)) return "Use the https:// address of the profile."
  if (!/^https:\/\//i.test(text)) return "Start with https:// (for example https://www.linkedin.com/company/your-company)."
  let parsed
  try { parsed = new URL(text) } catch { return "This is not a valid link." }
  if (parsed.username || parsed.password) return "A link cannot contain a username or password."
  const host = parsed.hostname.toLowerCase().replace(HIDDEN_HOST, "")
  if (!host.includes(".") || host === "localhost") return "This is not a public website address."
  if (siteUrl) {
    try { if (new URL(siteUrl).hostname.toLowerCase().replace(HIDDEN_HOST, "") === host) return "This is a page of your own website. sameAs lists profiles on other sites." } catch { /* ignore */ }
  }
  return null
}

const norm = (u) => String(u || "").trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "")
export const sameProfileUrl = (a, b) => norm(a) === norm(b)

/**
 * Ids of the candidates the person starts with selected: exactly the ones the server marked `suggested` — never a weak, ambiguous or
 * unconfirmed one.
 */
export function preselectedIds(discovery) {
  return (discovery?.candidates || []).filter((c) => c.preselected && c.status === "suggested").map((c) => c.id)
}

/**
 * The one list the person edits: discovered candidates (with any correction they made), links they added, minus what they dismissed.
 * Already-published links are NOT here: they are kept as they are and shown separately.
 */
export function buildEntries({ discovery, manual = [], edits = {}, dismissed = new Set(), selected = new Set() }) {
  const fromDiscovery = (discovery?.candidates || [])
    .filter((c) => c.status !== "already_present" && !dismissed.has(c.id))
    .map((c) => ({
      key: c.id, source: edits[c.id] ? "edited" : "discovered", url: edits[c.id]?.url || c.url,
      platformLabel: edits[c.id]?.platformLabel || c.platformLabel, kind: c.kind, confidence: c.confidence, status: c.status,
      reasons: c.reasons || [], warnings: c.warnings || [], sources: c.sources || [], verification: c.verification,
      selected: selected.has(c.id),
    }))
  const fromManual = manual.map((m) => ({
    key: m.key, source: "manual", url: m.url, platformLabel: m.platformLabel, kind: m.kind, confidence: null, status: "added_by_you",
    reasons: [], warnings: m.warnings || [], sources: [], verification: "owner_entered", selected: selected.has(m.key),
  }))
  return [...fromDiscovery, ...fromManual]
}

export const selectedUrls = (entries) => entries.filter((e) => e.selected).map((e) => e.url)

/** Server-side wording of why a candidate is where it is, in one short line for the row. */
export function describeSource(entry) {
  if (entry.source === "manual") return "Added by you"
  if (entry.verification === "declared_in_schema") return "Declared in your site's structured data"
  if (entry.verification === "integration_connected") return "From an account connected in Odito"
  const first = (entry.sources || []).find((s) => s.method === "page_link") || (entry.sources || [])[0]
  if (!first) return "Found on your site"
  if (first.method === "crawl_social_link") return "Found by the site crawl"
  const where = { footer: "footer", header: "header", nav: "navigation", sidebar: "sidebar", content: "page content" }[first.placement] || "page"
  let path = first.pageUrl || ""
  try { path = new URL(first.pageUrl).pathname || "/" } catch { /* keep as is */ }
  return `Linked in the ${where} of ${path}`
}

export const CONFIDENCE_LABEL = { high: "Likely yours", medium: "Please confirm", low: "Weak match" }
export const confidenceTone = (c) => (c === "high" ? "ok" : c === "medium" ? "warn" : "muted")

/**
 * The state shown in the header chip. Order matters: a recorded fix beats everything; an unsupported source beats "ready"; "ready to
 * apply" needs the server's plan to be ready AND valid; otherwise the discovery state.
 *
 * `preview` is the plan for the CURRENT selection, `record` the ledger record of this task's fix (stable, independent of the selection),
 * `environment` the plan for an empty selection (what WordPress / the SEO plugin allows at all).
 */
export function panelState({ discoveryLoading, discovery, selectionCount, preview, record, environment, previewLoading, noLinksChosen }) {
  const fix = record?.status
  if (fix === "verified") return "applied_verified"
  if (fix === "verification_failed") return "verification_failed"
  if (fix === "rolled_back") return "rolled_back"
  if (["applying", "apply_uncertain", "applied", "verifying"].includes(fix)) return "applied_verification_pending"
  if (discovery && (preview?.plan?.status === "unsupported" || environment?.plan?.status === "unsupported")) return "unsupported_source"
  if (selectionCount > 0 && preview?.plan?.status === "ready" && preview?.validation?.valid) return "ready_to_apply"
  if (selectionCount > 0 && previewLoading) return "ready_to_preview"
  if (selectionCount > 0 && preview?.plan?.status === "blocked") return "blocked"
  if (selectionCount > 0 && preview?.plan?.status === "nothing_to_change") return "existing_present"
  if (noLinksChosen) return "no_selection"
  if (discoveryLoading && !discovery) return "looking"
  return discovery?.state && SAMEAS_STATES[discovery.state] ? discovery.state : "looking"
}

/** Errors of preview/apply, including the per-line list of an invalid link (INVALID_PROFILES). */
export function describeSameAsError(error) {
  if (!error) return null
  if (error.code === "INVALID_PROFILES") {
    const lines = (error.details?.errors || []).map((e) => e.message).filter(Boolean)
    return { title: "A link is not valid", tone: "warn", retry: false, refreshPreview: false, message: lines.length ? lines.join(" ") : error.message }
  }
  if (error.code === "WORDPRESS_NOT_CONNECTED") return { title: "WordPress is not connected", tone: "warn", retry: false, refreshPreview: false, message: error.message }
  return describeFixError(error)
}

/** Count text for the site-wide / page-specific explanation. */
export function describeScope(scope) {
  if (!scope) return null
  if (scope.kind === "site_wide") {
    const n = scope.pagesWithSameEntity || scope.affectedPages?.length || 0
    return `This Organization is published site-wide (${n} crawled page${n === 1 ? "" : "s"} carry it), so one change fixes it everywhere after the next recrawl.`
  }
  return "This Organization is specific to this page, so the change is made where this page's markup is produced."
}
