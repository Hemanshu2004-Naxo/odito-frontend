// Pure helpers for the "Complete Your Breadcrumb Hierarchy" form. No React, no network.
//
// Client-side validation here exists ONLY for immediate feedback. The server (see
// odito_backend/.../schema-evidence/breadcrumbHierarchy.js) re-validates every value and is the only authority:
// it resolves the canonical URL from its own crawl data, never from anything sent by the browser.

export const BREADCRUMB_ISSUE_ID = "breadcrumblist_schema"
export const MAX_ITEMS = 10
export const MAX_NAME = 120
export const MAX_URL = 2048

let counter = 0
const newId = () => `bc-${Date.now().toString(36)}-${(counter += 1)}`
// origin: how the row came about — "manual" (typed), "discovered" (taken from the page's own markup), "suggested" (inferred from the menu /
// internal links: needs the owner's confirmation). A discovered/suggested row the owner changes becomes "edited" when it is sent.
// `orig` remembers what discovery proposed, so an edit can be told apart from the original.
export const blankItem = (over = {}) => ({ id: newId(), name: "", url: "", origin: "manual", evidence: null, urlSuggestion: null, orig: null, ...over })

/**
 * What the recommendation tells us about the breadcrumb hierarchy. `meta.schemaEvidence.breadcrumb` is sent by the
 * server for breadcrumb recommendations; without it the form never appears (e.g. an older cached response).
 *
 * state:
 *   unavailable    nothing verified -> show the form
 *   user_provided  the owner's hierarchy produced the recommendation -> show the generated code
 *   conflict       the page already outputs a BreadcrumbList that disagrees -> explain, never generate a duplicate
 *   existing       a valid trail is already on the page -> keep the normal recommendation (no form)
 *   none           not applicable
 */
export function getBreadcrumbModel(issueId, meta) {
  const evidence = meta?.schemaEvidence
  const b = evidence?.breadcrumb
  if (issueId !== BREADCRUMB_ISSUE_ID || !b) return { applies: false, state: "none" }
  const state = { unknown: "unavailable", user_provided: "user_provided", conflict: "conflict", existing: "existing" }[b.status] || "none"
  return {
    applies: state !== "none",
    state,
    canonicalUrl: evidence.url?.trusted ? evidence.url.display : null,
    canonicalTrusted: !!evidence.url?.trusted,
    crawlUrl: evidence.url?.crawlKey || null,
    savedItems: b.userProvided?.items || [],
    savedStale: !!b.userProvided?.stale,
    existingTrails: b.existingTrails || [],
    conflict: b.conflict || null,
  }
}

/**
 * Rows for the form. The LAST row is always the page being audited: its URL is prefilled from the verified canonical
 * when there is one. Without a canonical it is left blank — the crawl URL is never silently substituted; the owner
 * has to enter (confirm) the exact URL.
 */
export function initialFormItems(model) {
  if (model?.savedItems?.length >= 2 && !model.savedStale) {
    return model.savedItems.map((i) => blankItem({ name: i.name, url: i.url }))
  }
  const current = blankItem({ url: model?.canonicalUrl || "" })
  return [blankItem(), current]
}

export function addParent(items) {
  if (items.length >= MAX_ITEMS) return items
  return [...items.slice(0, -1), blankItem(), items[items.length - 1]]
}

/** Parents only: the final (current page) row is fixed in place, so it can neither move nor be removed. */
export function removeParent(items, index) {
  if (index < 0 || index >= items.length - 1) return items
  if (items.length <= 2) return items // always keep at least one parent
  return items.filter((_, i) => i !== index)
}

export function moveParent(items, index, delta) {
  const target = index + delta
  const lastParent = items.length - 2
  if (index < 0 || index > lastParent || target < 0 || target > lastParent) return items
  const next = items.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** What the server accepts. Positions are NOT sent: they are generated from the order. */
export const toPayloadItems = (items) => items.map((it) => {
  const name = it.name.trim()
  const url = it.url.trim()
  const changed = !!it.orig && (it.orig.name !== name || it.orig.url !== url)
  return { name, url, origin: changed ? "edited" : (it.origin || "manual") }
})

// ── Discovery ────────────────────────────────────────────────────────────────────────────────────────────────────
// The server (breadcrumb discovery) classifies the page's trail; these helpers only word it and turn a discovered trail into form rows.

/** Page-level state of the discovery: the headline, a tone and ONE sentence. */
export const DISCOVERY_STATE = {
  looking: { label: "Looking for your breadcrumbs…", tone: "muted", text: "Odito is checking this page's structured data and breadcrumb navigation, and your site menu." },
  already_valid: { label: "Already valid", tone: "ok", text: "This page already outputs a valid BreadcrumbList, so there is nothing to add. The finding leaves the audit after the next analysis of the page." },
  verified: { label: "Trail found on your page", tone: "ok", text: "Your page already shows this trail. Check it, then generate the structured data." },
  suggested: { label: "Trail suggested", tone: "info", text: "Odito inferred a likely trail from your site menu or internal links. Nothing is confirmed until you check every page and generate." },
  incomplete: { label: "Trail incomplete", tone: "warn", text: "Odito found only part of the trail. Add the missing page URL, or remove that level." },
  not_found: { label: "No trail found", tone: "warn", text: "No reliable breadcrumb trail was found on this page. Enter the pages that lead to it." },
  conflict: { label: "Existing breadcrumb needs fixing", tone: "bad", text: "This page already outputs a BreadcrumbList that is invalid or duplicated. Adding another would create a second entity — fix or remove the existing one where it comes from." },
  unavailable: { label: "Automatic lookup unavailable", tone: "muted", text: "The page could not be looked up just now, so enter the pages that lead to it yourself." },
}

export const ORIGIN_LABEL = { manual: "Added by you", discovered: "Found on your site", suggested: "Suggested — confirm", edited: "Edited by you" }
export const originTone = (o) => (o === "discovered" ? "ok" : o === "suggested" ? "warn" : "info")

/**
 * The form rows for a discovered trail. The LAST row is always this page, with the verified canonical (never the crawl URL); a row with no
 * URL stays empty and is asked for; nothing is invented.
 */
export function itemsFromTrail(trail, { canonicalUrl = null } = {}) {
  const items = (trail?.items || []).map((i, idx, all) => {
    const last = idx === all.length - 1
    const fromMarkup = i.origin === "markup" || i.origin === "current"
    const origin = fromMarkup && trail.status !== "suggested" ? "discovered" : "suggested"
    const url = last ? (canonicalUrl || "") : (i.url || "")
    return blankItem({ name: i.name || "", url, origin: last ? "discovered" : origin, evidence: i.evidence || null, urlSuggestion: !last && !i.url ? (i.urlSuggestion || null) : null, orig: { name: i.name || "", url } })
  })
  return items.length >= 2 ? items : null
}

/** The trail the page should start with: the server's recommended trail when it has one the form can use. */
export function discoveryStartItems(discovery) {
  if (!discovery || !discovery.recommended || ["already_valid", "conflict", "not_found"].includes(discovery.status)) return null
  return itemsFromTrail(discovery.recommended, { canonicalUrl: discovery.canonical?.trusted ? discovery.canonical.url : null })
}

/** What the panel shows for the discovery: state info, whether the form is replaced by an explanation, and the notes worth reading. */
export function describeDiscovery({ discovery, isLoading, isError }) {
  if (isLoading) return { state: "looking", ...DISCOVERY_STATE.looking, replacesForm: false, notes: [] }
  if (isError || !discovery) return { state: "unavailable", ...DISCOVERY_STATE.unavailable, replacesForm: false, notes: [] }
  const info = DISCOVERY_STATE[discovery.status] || DISCOVERY_STATE.not_found
  const warnings = (discovery.recommended?.warnings || [])
  return {
    state: discovery.status, ...info, replacesForm: ["already_valid", "conflict"].includes(discovery.status),
    notes: [...(discovery.notes || []), ...warnings].slice(0, 4),
    evidence: discovery.recommended?.evidence || [],
    isHomePage: !!discovery.isHomePage,
  }
}

const urlKey = (u) => {
  try {
    const p = new URL(u)
    return `${p.protocol}//${p.host}${p.pathname.replace(/\/+$/, "")}${p.search}`
  } catch { return null }
}

/**
 * Immediate, conservative feedback. Returns { fieldErrors: { [rowId]: { name?, url? } }, formErrors: string[] }.
 * It never rewrites anything the user typed.
 */
export function validateItems(items, { canonicalUrl = null, crawlUrl = null } = {}) {
  const fieldErrors = {}
  const formErrors = []
  const put = (id, field, message) => { fieldErrors[id] = { ...fieldErrors[id], [field]: fieldErrors[id]?.[field] || message } }

  if (items.length < 2) formErrors.push("Add at least one parent page before the current page.")
  if (items.length > MAX_ITEMS) formErrors.push(`A breadcrumb trail can have at most ${MAX_ITEMS} items.`)

  const seen = new Map()
  items.forEach((it, index) => {
    const name = it.name.trim()
    const url = it.url.trim()
    if (!name) put(it.id, "name", "Page name is required.")
    else if (name.length > MAX_NAME) put(it.id, "name", `Use ${MAX_NAME} characters or fewer.`)

    if (!url) { put(it.id, "url", "Page URL is required."); return }
    if (url.length > MAX_URL) { put(it.id, "url", "This URL is too long."); return }
    let parsed
    try { parsed = new URL(url) } catch { put(it.id, "url", "Enter a full URL, for example https://example.com/page/."); return }
    if (!/^https?:\/\//i.test(url)) put(it.id, "url", "Only http:// and https:// URLs are supported.")
    else if (parsed.username || parsed.password) put(it.id, "url", "URLs must not contain a username or password.")
    else if (parsed.hash) put(it.id, "url", "Remove the #fragment — use the page's own URL.")
    else {
      const key = urlKey(url)
      if (seen.has(key)) put(it.id, "url", `This is the same page as item ${seen.get(key) + 1}.`)
      else seen.set(key, index)
    }
  })

  const last = items[items.length - 1]
  const expected = canonicalUrl || crawlUrl
  if (last && !fieldErrors[last.id]?.url && last.url.trim() && expected && urlKey(last.url.trim()) !== urlKey(expected)) {
    put(last.id, "url", canonicalUrl
      ? `The last item must be this page. Its canonical URL is ${canonicalUrl}.`
      : `The last item must be this page (${crawlUrl}). Confirm its exact URL.`)
  }
  return { fieldErrors, formErrors }
}

export const hasErrors = ({ fieldErrors, formErrors }) => formErrors.length > 0 || Object.keys(fieldErrors).length > 0

/** Maps the server's 422 `errors` (index/field/code/message) onto the form's rows. Unmapped errors become form-level. */
export function mapServerErrors(error, items) {
  const fieldErrors = {}
  const formErrors = []
  const list = Array.isArray(error?.errors) ? error.errors : []
  for (const e of list) {
    const row = Number.isInteger(e.index) ? items[e.index] : null
    if (row && (e.field === "name" || e.field === "url")) {
      fieldErrors[row.id] = { ...fieldErrors[row.id], [e.field]: fieldErrors[row.id]?.[e.field] || e.message }
    } else if (row) {
      fieldErrors[row.id] = { ...fieldErrors[row.id], url: fieldErrors[row.id]?.url || e.message }
    } else formErrors.push(e.message)
  }
  if (!list.length) formErrors.push(error?.message || "The hierarchy could not be validated.")
  return { fieldErrors, formErrors }
}

/** Pulls the generated JSON-LD out of the recommendation's code block, for display of the validation summary. */
export function parseGeneratedBreadcrumb(content) {
  if (typeof content !== "string") return null
  const body = content.replace(/<\/?script[^>]*>/gi, "").trim()
  try {
    const json = JSON.parse(body)
    if (json?.["@type"] !== "BreadcrumbList" || !Array.isArray(json.itemListElement)) return null
    return json
  } catch { return null }
}

export function summarizeGenerated(json) {
  if (!json) return null
  const list = json.itemListElement
  const positions = list.map((i) => i.position)
  const urls = list.map((i) => urlKey(i.item))
  return {
    itemCount: list.length,
    consecutive: positions.every((p, i) => p === i + 1),
    uniqueUrls: new Set(urls).size === urls.length && urls.every(Boolean),
    allAbsolute: list.every((i) => /^https?:\/\//i.test(i.item || "")),
  }
}
