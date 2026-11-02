/**
 * Pure rules for showing a My Competitors record's SEO enrichment (backend: modules/competitors, `enrichment` in every competitor).
 * Kept apart from the components so every wording and every polling decision is unit-tested.
 *
 * The one rule: a metric the server could not give is `null` and is shown as a dash with the REASON, never as 0. `reasonFor` turns the
 * section's own status into that reason.
 */

const STATUS = {
  no_website: { label: "No website", tone: "muted", hint: "Add a website to this competitor to get its SEO metrics." },
  not_started: { label: "Not fetched", tone: "muted", hint: "SEO metrics have not been fetched for this competitor yet." },
  pending: { label: "Queued", tone: "info", hint: "Waiting in line. The numbers appear here when they are ready." },
  processing: { label: "Updating", tone: "info", hint: "Fetching SEO metrics now." },
  enriched: { label: "Up to date", tone: "success", hint: "SEO metrics were fetched successfully." },
  partial: { label: "Partial data", tone: "warning", hint: "Some metrics could not be fetched, or the data provider has no data for part of this website." },
  no_data: { label: "No data", tone: "muted", hint: "The data provider has no data for this website." },
  failed: { label: "Failed", tone: "critical", hint: "The SEO metrics could not be fetched. You can try again." },
}

/** The three parts of a competitor's SEO data, in the order they are shown. */
export const SECTION_LABELS = Object.freeze({ rank: "Rankings", backlinks: "Backlinks", shared: "Shared keywords" })

/** What one section's status means, in words. A missing section (an older record) is "Not fetched yet", never "Loaded". */
export function sectionText(section) {
  switch (section?.status) {
    case "ok": return "Loaded"
    case "no_data": return "No data from the provider"
    case "failed": return "Failed"
    default: return "Not fetched yet"
  }
}

/** The labels of the sections that do not have values (for the partial-data explanation). */
export function missingSections(enrichment) {
  return Object.keys(SECTION_LABELS).filter((k) => enrichment?.sections?.[k]?.status !== "ok").map((k) => `${SECTION_LABELS[k]} (${sectionText(enrichment?.sections?.[k]).toLowerCase()})`)
}

/** { label, tone, hint } for the status chip. A queued record that has already been tried once is "Retrying". */
export function statusMeta(enrichment) {
  const status = enrichment?.status ?? "not_started"
  const base = STATUS[status] ?? STATUS.not_started
  if (status === "partial") {
    const missing = missingSections(enrichment)
    if (missing.length) return { ...base, hint: `Not available: ${missing.join("; ")}.${enrichment?.stale ? " This data is more than two weeks old." : ""}`, label: enrichment?.stale ? `${base.label} · stale` : base.label }
  }
  if (status === "pending" && (enrichment?.attempts ?? 0) > 0) return { ...base, label: "Retrying", hint: "A fetch failed and will be tried again automatically." }
  if ((status === "enriched" || status === "partial") && enrichment?.stale) return { ...base, label: `${base.label} · stale`, hint: `${base.hint} This data is more than two weeks old.` }
  return base
}

/** Why a metric is missing, from the status of the section it comes from ("rank" or "backlinks"). Null when it is not missing. */
export function reasonFor(enrichment, sectionKey) {
  const status = enrichment?.status ?? "not_started"
  if (status === "no_website") return "No website to look up"
  const section = enrichment?.sections?.[sectionKey] ?? null
  if (sectionKey === "shared") {
    // The head-to-head: the keywords you AND this competitor both rank for.
    if (section?.status === "no_data") return "The data provider has no shared-keyword data for your website and this one"
    if (section?.status === "failed") return "Could not be loaded. Try again"
    if (status === "pending" || status === "processing") return "Being fetched"
    if (status === "not_started") return "Not fetched yet"
    return "Not fetched yet. It is fetched on the next update"
  }
  if (section?.status === "no_data") return "The data provider has no data for this website"
  if (section?.status === "failed") return "Could not be loaded"
  if (section?.status === "not_configured") return "Not available yet"
  if (status === "pending" || status === "processing") return "Being fetched"
  if (status === "not_started") return "Not fetched yet"
  return "Not available"
}

/** Can the user ask for a refresh right now? (The server still enforces the cool-down and the in-progress rule.) */
export function canRefresh(competitor) {
  const status = competitor?.enrichment?.status
  if (!competitor?.domain) return false
  return status !== "pending" && status !== "processing" && status !== "no_website"
}

const FAST_MS = 5000
const SLOW_MS = 60000
const FAST_WINDOW_MS = 2 * 60 * 1000

/**
 * How often to re-read the list while enrichment is running: every 5 s while something is being fetched or was queued in the last two
 * minutes, every minute while something is still waiting (a retry backoff, or the server's background worker switched off), and not at
 * all once nothing is waiting. Opening the page never fetches anything by itself; this only watches work that is already queued.
 */
export function pollInterval(competitors, now = Date.now()) {
  let waiting = false
  for (const c of competitors ?? []) {
    const e = c?.enrichment
    if (!e || !c.domain) continue
    if (e.status === "processing") return FAST_MS
    if (e.status === "pending") {
      waiting = true
      const requested = e.requestedAt ? new Date(e.requestedAt).getTime() : null
      const due = e.nextAttemptAt ? new Date(e.nextAttemptAt).getTime() : null
      if ((requested && now - requested < FAST_WINDOW_MS) || (due && due - now < FAST_MS * 2 && now - (requested ?? now) < FAST_WINDOW_MS)) return FAST_MS
    }
  }
  return waiting ? SLOW_MS : false
}
