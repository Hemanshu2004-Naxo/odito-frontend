import { csvCell } from "../referring-domains/exportCsv"

/**
 * The header's "Export": one CSV of what the Domain Overview shows, built in the browser from the loaded view model — no request.
 * Sections are blocks of "Section,Item,Value[,…]" rows; a missing figure is an empty cell, never 0.
 */
export function buildOverviewCsv({ domain, market, vm, issues, topPages, summary }) {
  const rows = [["Section", "Item", "Value", "Detail"]]
  const add = (...cells) => rows.push(cells)
  add("Site", "Domain", domain ?? null)
  if (market) add("Site", "Market", `${market.location} · ${market.language}`)

  const k = vm?.kpis ?? {}
  add("Headline", "Organic traffic (est. monthly)", k.traffic, describeChange(k.trafficChange))
  add("Headline", "Organic keywords", k.keywords, describeChange(k.keywordsChange))
  add("Headline", "Traffic value (USD, est. monthly)", k.trafficValue)
  add("Headline", "Domain rank (0-1000)", k.domainRank)
  add("Headline", "Backlinks", k.backlinks)
  add("Headline", "Linking sites", k.referringDomains)
  if (summary) {
    add("Backlink health", "Spam score", summary.spam?.score ?? null)
    add("Backlink health", "Linking pages", summary.totals?.referringPages ?? null)
    add("Backlink health", "Broken backlinks", summary.totals?.brokenBacklinks ?? null)
    add("Backlink health", "Dofollow linking sites", summary.derived?.dofollowDomains ?? null)
  }

  for (const i of issues ?? []) add("Fix first", i.title, i.severity, i.why)
  for (const p of vm?.trend ?? []) add("Traffic by month", p.key, p.etv, p.count === null ? null : `${p.count} keywords`)
  for (const b of vm?.positions?.buckets ?? []) add("Keyword positions", b.label, b.value)
  for (const [key, label] of [["new", "New"], ["improved", "Improved"], ["declined", "Declined"], ["lost", "Lost"]]) add("Keyword movement", label, vm?.movement?.[key] ?? null)
  for (const r of vm?.topKeywords?.rows ?? []) add("Top keywords", r.keyword, r.traffic, `position ${r.position ?? ""}; volume ${r.volume ?? ""}; KD ${r.difficulty ?? ""}; ${r.path ?? ""}`)
  for (const r of topPages ?? []) add("Top pages", r.url, r.traffic, `${r.statusLabel ?? ""}; ${r.referringDomains ?? ""} linking sites`)

  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n")
}

const round1 = (v) => Math.round(v * 10) / 10

/** { percent: -55.8, basis: "vs Sep 26" } -> "down 55.8% vs Sep 26" (a word, not a sign, so a spreadsheet never reads it as a formula). */
function describeChange(change) {
  if (typeof change?.percent !== "number" || !Number.isFinite(change.percent)) return null
  const dir = change.percent > 0 ? "up" : change.percent < 0 ? "down" : "flat"
  return `${dir} ${round1(Math.abs(change.percent))}% ${change.basis ?? ""}`.trim()
}

/** domain-overview_<domain>_<YYYY-MM-DD>.csv */
export function overviewCsvFileName(domain, date = new Date()) {
  const day = date.toISOString().slice(0, 10)
  return `domain-overview_${(domain || "site").replace(/[^a-z0-9.-]/gi, "_")}_${day}.csv`
}
