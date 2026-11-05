import { formatDay, formatNumber, formatSigned } from "@/lib/history/compare"

/**
 * What each SEO page's history section shows. Pure configuration: panels read stored data only (see hooks/useDatasetHistory.js).
 * `page` selects the datasets whose freshness is listed (the backend's PAGE_DATASETS).
 */

const moved = (n) => (typeof n === "number" ? (n > 0 ? `▲ ${n}` : n < 0 ? `▼ ${-n}` : "—") : "—")
const text = (v) => v ?? "—"
const traffic = (r) => (r.traffic_change === null || r.traffic_change === undefined ? null : r.traffic_change)

const KEYWORD_COLS = [
  { id: "keyword", label: "Keyword", render: (r) => text(r.keyword), title: (r) => r.keyword },
  { id: "pos", label: "Position", render: (r) => formatNumber(r.position) },
  { id: "was", label: "Was", render: (r) => (typeof r.position === "number" && typeof r.position_change === "number" ? formatNumber(r.position + r.position_change) : "—") },
  { id: "move", label: "Moved", render: (r) => moved(r.position_change) },
  { id: "etv", label: "Traffic", render: (r) => <>{formatNumber(r.etv)} {traffic(r) !== null ? <span className="text-muted-foreground">({formatSigned(traffic(r))})</span> : null}</> },
  { id: "vol", label: "Volume", render: (r) => <>{formatNumber(r.search_volume)} {r.search_volume_change !== null && r.search_volume_change !== undefined ? <span className="text-muted-foreground">({formatSigned(r.search_volume_change)})</span> : null}</> },
]
const KEYWORD_ROW_COLS = KEYWORD_COLS.filter((c) => !["was", "move"].includes(c.id))

const BACKLINK_COLS = [
  { id: "from", label: "From", render: (r) => text(r.url_from), title: (r) => r.url_from },
  { id: "anchor", label: "Anchor", render: (r) => text(r.anchor) },
  { id: "to", label: "To", render: (r) => text(r.url_to), title: (r) => r.url_to },
  { id: "first", label: "First seen", render: (r) => formatDay(r.first_seen) },
  { id: "follow", label: "Follow", render: (r) => (r.dofollow === true ? "dofollow" : r.dofollow === false ? "nofollow" : "—") },
]

const DOMAIN_COLS = [
  { id: "domain", label: "Domain", render: (r) => text(r.domain) },
  { id: "rank", label: "Rank", render: (r) => formatNumber(r.rank) },
  { id: "rankChange", label: "Rank change", render: (r) => (typeof r.rank_change === "number" ? formatSigned(r.rank_change) : "—") },
  { id: "backlinks", label: "Backlinks", render: (r) => formatNumber(r.backlinks) },
  { id: "backlinksChange", label: "Backlinks change", render: (r) => (typeof r.backlinks_change === "number" ? formatSigned(r.backlinks_change) : "—") },
]

const KEYWORDS_CHANGES = {
  type: "changes",
  dataset: "keywords",
  title: "Keyword changes",
  emptyMessage: "No keywords have been collected yet. Run an SEO scan to store them; comparisons need two scans.",
  headline: (d) => {
    const a = d.totals?.latest; const b = d.totals?.reference
    if (!a || !b) return null
    return (
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Keywords: <strong className="text-foreground">{formatNumber(b.count)} → {formatNumber(a.count)}</strong></span>
        <span>Estimated traffic: <strong className="text-foreground">{formatNumber(b.etv)} → {formatNumber(a.etv)}</strong></span>
        <span>Top 3: <strong className="text-foreground">{formatNumber((b.pos_1 ?? 0) + (b.pos_2_3 ?? 0))} → {formatNumber((a.pos_1 ?? 0) + (a.pos_2_3 ?? 0))}</strong></span>
      </span>
    )
  },
  tiles: [
    { id: "new", label: "New keywords", read: (d) => d.new, columns: KEYWORD_ROW_COLS, empty: "No new keywords." },
    { id: "lost", label: "Lost keywords", read: (d) => d.lost, columns: KEYWORD_ROW_COLS, empty: "No keywords were lost." },
    { id: "improved", label: "Improved", read: (d) => d.improved, columns: KEYWORD_COLS, empty: "No keyword moved up." },
    { id: "declined", label: "Declined", read: (d) => d.declined, columns: KEYWORD_COLS, empty: "No keyword moved down." },
  ],
}

const BACKLINKS_CHANGES = {
  type: "changes",
  dataset: "backlinks",
  status: "live",
  title: "Backlink changes (live links)",
  emptyMessage: "No backlinks have been collected yet. Run an SEO scan to store them; comparisons need two scans.",
  tiles: [
    { id: "new", label: "New backlinks", read: (d) => d.new, columns: BACKLINK_COLS, empty: "No new backlinks." },
    { id: "lost", label: "Lost backlinks", read: (d) => d.lost, columns: BACKLINK_COLS, empty: "No backlinks were lost." },
  ],
}

const DOMAINS_CHANGES = {
  type: "changes",
  dataset: "referring-domains",
  status: "live",
  title: "Referring domain changes (live domains)",
  emptyMessage: "No referring domains have been collected yet. Run an SEO scan to store them; comparisons need two scans.",
  tiles: [
    { id: "new", label: "New domains", read: (d) => d.new, columns: DOMAIN_COLS.slice(0, 2).concat(DOMAIN_COLS[3]), empty: "No new referring domains." },
    { id: "lost", label: "Lost domains", read: (d) => d.lost, columns: DOMAIN_COLS.slice(0, 2).concat(DOMAIN_COLS[3]), empty: "No referring domains were lost." },
    { id: "rankUp", label: "Rank up", read: (d) => d.rankUp, columns: DOMAIN_COLS, empty: "No domain's rank went up." },
    { id: "rankDown", label: "Rank down", read: (d) => d.rankDown, columns: DOMAIN_COLS, empty: "No domain's rank went down." },
    { id: "backlinksUp", label: "More backlinks", read: (d) => d.backlinksUp, columns: [], empty: "—" },
    { id: "backlinksDown", label: "Fewer backlinks", read: (d) => d.backlinksDown, columns: [], empty: "—" },
  ],
}

const ORGANIC_METRICS = [
  { id: "etv", label: "Estimated organic traffic", path: "organic.etv" },
  { id: "count", label: "Ranking keywords", path: "organic.count" },
  { id: "value", label: "Traffic value", path: "organic.estimated_paid_traffic_cost", digits: 0 },
  { id: "p1", label: "Keywords in position 1", path: "organic.pos_1" },
  { id: "p23", label: "Keywords in positions 2–3", path: "organic.pos_2_3" },
  { id: "p410", label: "Keywords in positions 4–10", path: "organic.pos_4_10" },
]
const DOMAIN_SNAPSHOT = { type: "snapshot", datasetType: "domain_overview", part: "rank-overview", title: "Domain metrics: before and now", metrics: ORGANIC_METRICS, emptyMessage: "No domain metrics have been collected yet. Run an SEO scan." }

const BACKLINK_METRICS = [
  { id: "backlinks", label: "Backlinks", path: "backlinks" },
  { id: "domains", label: "Referring domains", path: "referring_domains" },
  { id: "pages", label: "Referring pages", path: "referring_pages" },
  { id: "ips", label: "Referring IPs", path: "referring_ips" },
  { id: "subnets", label: "Referring subnets", path: "referring_subnets" },
  { id: "nofollowDomains", label: "Domains linking nofollow", path: "referring_domains_nofollow", good: "down" },
  { id: "nofollowPages", label: "Pages linking nofollow", path: "referring_pages_nofollow", good: "down" },
  { id: "broken", label: "Broken backlinks", path: "broken_backlinks", good: "down" },
  { id: "spam", label: "Spam score", path: "backlinks_spam_score", good: "down" },
  { id: "rank", label: "Domain rank", path: "rank" },
]

export const HISTORY_ROUTES = Object.freeze([
  { prefix: "/app/domain-overview", page: "domain-overview", panels: [DOMAIN_SNAPSHOT] },
  { prefix: "/app/traffic-history", page: "traffic", panels: [{ ...DOMAIN_SNAPSHOT, title: "Traffic: before and now", metrics: ORGANIC_METRICS.slice(0, 3) }] },
  { prefix: "/app/organic-keywords", page: "organic-keywords", panels: [KEYWORDS_CHANGES, { type: "keyword-lookup" }] },
  {
    prefix: "/app/competitors",
    page: "competitors",
    panels: [{
      type: "keyed-snapshot", datasetType: "competitor_summary", part: "competitors", title: "Competitors: before and now", key: "domain", rowLabel: "Competitor", labelOf: (r) => r.domain,
      metrics: [{ id: "etv", label: "Traffic", get: (r) => r.total?.etv ?? null }], addedLabel: "New in the list", removedLabel: "No longer listed",
      emptyMessage: "No competitors have been collected yet. Run an SEO scan.",
    }],
  },
  { prefix: "/app/backlinks/overview", page: "offpage-overview", panels: [{ type: "snapshot", datasetType: "backlink_summary", part: "backlinks", title: "Backlink profile: before and now", metrics: BACKLINK_METRICS, emptyMessage: "No backlink summary has been collected yet. Run an SEO scan." }] },
  { prefix: "/app/backlinks/list", page: "backlinks", panels: [BACKLINKS_CHANGES] },
  {
    prefix: "/app/backlinks/anchors",
    page: "anchors",
    note: "The anchor table is the provider's data for its default view; any other page, sort or filter is counted from the stored backlinks (rank, spam score and link breakdowns are provider-only and show \"—\" there).",
    panels: [{
      type: "keyed-snapshot", datasetType: "anchor_summary", part: "anchor-profile", title: "Anchors: before and now", key: "anchor", rowLabel: "Anchor text", labelOf: (r) => r.anchor ?? "(no anchor text)",
      metrics: [{ id: "domains", label: "Referring domains", get: (r) => r.referring_domains ?? null }], addedLabel: "New anchors", removedLabel: "Anchors no longer in the top list",
      emptyMessage: "No anchor profile has been collected yet. Run an SEO scan.",
    }],
  },
  { prefix: "/app/referring-domains", page: "referring-domains", panels: [DOMAINS_CHANGES] },
  {
    prefix: "/app/backlinks/top-pages",
    page: "top-pages",
    note: "The table's default views are the provider's data; any other page, sort or filter is counted from the stored backlinks (rank and link breakdowns are provider-only and show \"—\" there).",
    panels: [{ type: "snapshot", datasetType: "top_linked_pages_summary", part: "tp-counts", title: "Linked pages: before and now", metrics: [
      { id: "pages", label: "Linked pages", path: "pages" }, { id: "errors", label: "Pages with errors", path: "errors", good: "down" }, { id: "redirects", label: "Redirecting pages", path: "redirects", good: "down" },
    ], emptyMessage: "No page counts have been collected yet. Run an SEO scan." }],
  },
])

/** The history section of a route (longest matching prefix), or null for a page that has none. */
export function historyRouteFor(pathname) {
  if (!pathname) return null
  return [...HISTORY_ROUTES].sort((a, b) => b.prefix.length - a.prefix.length).find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)) ?? null
}

