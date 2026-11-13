// Pure data helpers for the On-Page issues screen (no React, no fetching).
// Input is the /onpage-issues payload: issues[] = { issue_code, title, issue_message, severity, category,
// pages_affected, page_urls[] } and summary = { total_issue_types, total_issues_found, total_pages_analyzed }.

export const SEVERITIES = ["high", "medium", "low"]
const SEV_RANK = { high: 3, medium: 2, low: 1 }

/** Anything that is not high/medium counts as low (info, pass, unknown) so it still shows up somewhere. */
export function normalizeSeverity(sev) {
  const s = String(sev || "").toLowerCase()
  if (s === "high" || s === "critical") return "high"
  if (s === "medium" || s === "warning") return "medium"
  return "low"
}

/**
 * "Auto-fix" = Odito can write the fix for you (WordPress-fixable field types plus the alt-text and organization fixes).
 * "You" = Odito explains how, the change is yours to make. `autoFixIds` is passed in so this stays in step with the
 * fix panels instead of keeping a second list here.
 */
export function whoFixes(issueCode, autoFixIds) {
  return autoFixIds?.has(issueCode) ? "auto" : "you"
}

export function buildIssueRows(issues = [], autoFixIds = new Set()) {
  return issues
    .map((iss) => ({
      key: `${iss.issue_code}::${iss.data_path ?? ""}`,
      code: iss.issue_code,
      title: iss.title || iss.issue_message || "Issue",
      detail: iss.issue_message && iss.issue_message !== iss.title ? iss.issue_message : "",
      severity: normalizeSeverity(iss.severity),
      category: iss.category || "Other",
      pages: iss.pages_affected || 0,
      urls: Array.isArray(iss.page_urls) ? iss.page_urls : [],
      who: whoFixes(iss.issue_code, autoFixIds),
      raw: iss,
    }))
    .sort((a, b) => b.pages - a.pages)
}

export function severityStats(rows, totalPages = 0) {
  const out = { all: { issues: 0, types: rows.length }, high: { issues: 0, types: 0 }, medium: { issues: 0, types: 0 }, low: { issues: 0, types: 0 } }
  for (const r of rows) {
    out.all.issues += r.pages
    out[r.severity].issues += r.pages
    out[r.severity].types += 1
  }
  out.totalPages = totalPages
  return out
}

/** "Fixing the top 5 issues clears X of Y problems (Z%)", and how many of those five Odito can fix itself. */
export function quickWin(rows, n = 5) {
  const total = rows.reduce((s, r) => s + r.pages, 0)
  const top = rows.slice(0, n)
  const cleared = top.reduce((s, r) => s + r.pages, 0)
  return {
    count: top.length,
    cleared,
    total,
    percent: total > 0 ? Math.round((cleared / total) * 100) : 0,
    autoCount: top.filter((r) => r.who === "auto").length,
  }
}

export function categoriesOf(rows) {
  return [...new Set(rows.map((r) => r.category))].sort()
}

export function filterIssueRows(rows, { severity = "all", category = "all", who = "all", query = "" } = {}) {
  const q = query.trim().toLowerCase()
  return rows.filter((r) => {
    if (severity !== "all" && r.severity !== severity) return false
    if (category !== "all" && r.category !== category) return false
    if (who !== "all" && r.who !== who) return false
    if (q && !`${r.title} ${r.detail} ${r.category}`.toLowerCase().includes(q)) return false
    return true
  })
}

export function pathOf(url) {
  if (!url) return "/"
  try {
    const u = new URL(url, "http://x")
    return `${u.pathname}${u.search}` || "/"
  } catch {
    return String(url)
  }
}

export function pageNameFromUrl(url) {
  const path = pathOf(url).split("?")[0]
  const last = path.split("/").filter(Boolean).pop()
  if (!last) return "Home"
  return last.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

/** Turns issue->pages into page->issues. Sorted by high-priority count, then medium, then total. */
export function buildPageRows(rows) {
  const map = new Map()
  for (const r of rows) {
    for (const url of r.urls) {
      if (!map.has(url)) map.set(url, { url, high: 0, medium: 0, low: 0, total: 0, issues: [] })
      const p = map.get(url)
      p[r.severity] += 1
      p.total += 1
      p.issues.push(r)
    }
  }
  const pages = [...map.values()]
  for (const p of pages) p.issues.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.pages - a.pages)
  return pages.sort((a, b) => b.high - a.high || b.medium - a.medium || b.total - a.total || a.url.localeCompare(b.url))
}

export function filterPageRows(pages, query = "") {
  const q = query.trim().toLowerCase()
  if (!q) return pages
  return pages.filter((p) => `${p.url} ${pageNameFromUrl(p.url)}`.toLowerCase().includes(q))
}

export function percentOf(pages, totalPages) {
  if (!totalPages) return 0
  return Math.min(100, Math.round((pages / totalPages) * 100))
}
