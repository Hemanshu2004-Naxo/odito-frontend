"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Search, Sparkles } from "lucide-react"
import { useIssueUrls } from "@/hooks/useDashboardQueries"
import {
  buildIssueRows, buildPageRows, categoriesOf, filterIssueRows, filterPageRows, pageNameFromUrl, pathOf, percentOf,
  quickWin, severityStats,
} from "./onPageModel"

// Colors come from the approved On-Page design; neutrals use the theme tokens so light and dark both read well.
export const SEV = {
  high: { label: "High", pill: "bg-[#E5446D]/15 text-[#B4234A] dark:text-[#FF7A9A]", bar: "bg-[#E5446D]", accent: "bg-[#E5446D]", value: "text-[#B4234A] dark:text-[#FF7A9A]" },
  medium: { label: "Medium", pill: "bg-[#F5A524]/15 text-[#8A4A06] dark:text-[#F5B755]", bar: "bg-[#F5A524]", accent: "bg-[#F5A524]", value: "text-[#8A4A06] dark:text-[#F5B755]" },
  low: { label: "Low", pill: "bg-[#6F82F0]/15 text-[#4256D6] dark:text-[#9AA8FF]", bar: "bg-[#6F82F0]", accent: "bg-[#6F82F0]", value: "text-[#4256D6] dark:text-[#9AA8FF]" },
}
const WHO = {
  auto: { label: "Auto-fix", pill: "bg-[#6F82F0]/15 text-[#4256D6] dark:text-[#9AA8FF]" },
  you: { label: "You", pill: "bg-[#1FB37A]/15 text-[#0B6E4D] dark:text-[#5FD9A6]" },
}
const PAGE_STEP = 5
const PAGES_SHOWN = 50

export function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-8 rounded-full border px-3 text-[12px] font-bold transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted"}`}
    >
      {children}
    </button>
  )
}

export function StatCard({ label, value, sub, accent, valueColor, active, showBadge, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex flex-col gap-2.5 overflow-hidden rounded-[18px] border-2 bg-card p-4 text-left transition hover:-translate-y-0.5 ${active ? "border-foreground" : "border-border"}`}
    >
      <span className={`absolute inset-y-0 left-0 w-[5px] ${accent}`} aria-hidden="true" />
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-muted-foreground">{label}</span>
        {showBadge && <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-extrabold text-background">Showing</span>}
      </span>
      <span className={`text-[34px] font-extrabold leading-none tracking-tight ${valueColor}`}>{value.toLocaleString()}</span>
      <span className="text-[12px] text-muted-foreground">{sub}</span>
    </button>
  )
}

function SevPill({ severity }) {
  const s = SEV[severity]
  return (
    <span className={`w-16 shrink-0 rounded-full py-1 text-center text-[11px] font-extrabold ${s.pill}`}>
      {s.label}
    </span>
  )
}

function WhoPill({ who }) {
  const w = WHO[who]
  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${w.pill}`}>{w.label}</span>
}

function AffectedPages({ projectId, row, onOpen }) {
  const { data, isLoading } = useIssueUrls(projectId, row.code)
  const [shown, setShown] = useState(PAGE_STEP)
  const list = useMemo(() => {
    const src = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : null
    if (src) return src.map((u) => (typeof u === "string" ? { url: u } : u))
    return row.urls.map((url) => ({ url }))
  }, [data, row.urls])

  return (
    <div className="border-t border-border bg-muted/40 py-1.5 pl-[46px] pr-[18px] pb-5">
      <div className="flex flex-col gap-2 pt-3.5">
        <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">Affected pages</span>
        {isLoading && list.length === 0 && <span className="text-[13px] text-muted-foreground">Loading pages…</span>}
        {list.slice(0, shown).map((p) => (
          <div key={p.url} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
            <span className="flex min-w-[200px] flex-1 flex-col gap-0.5">
              <span className="truncate text-[13px] font-bold text-[#4256D6] dark:text-[#8FA0FF]">{pathOf(p.url)}</span>
              {(p.detected_value || p.issue_message) && (
                <span className="truncate text-[12px] text-muted-foreground">{String(p.detected_value || p.issue_message)}</span>
              )}
            </span>
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex h-8 items-center rounded-[9px] border border-border px-3 text-[12px] font-bold text-foreground hover:bg-muted">
              Open
            </a>
            <button type="button" onClick={() => onOpen(row.code, p.url)} className="h-8 rounded-[9px] border border-[#4256D6]/30 bg-card px-3 text-[12px] font-bold text-[#4256D6] dark:text-[#8FA0FF] hover:bg-muted">
              Fix
            </button>
          </div>
        ))}
        {list.length > shown && (
          <button type="button" onClick={() => setShown((n) => n + 20)} className="self-start py-1 text-[13px] font-bold text-[#4256D6] dark:text-[#8FA0FF]">
            Show {Math.min(20, list.length - shown)} more pages
          </button>
        )}
      </div>
    </div>
  )
}

function IssueRow({ row, totalPages, projectId, expanded, onToggle, onOpen }) {
  const pct = percentOf(row.pages, totalPages)
  return (
    <div className="border-t border-border">
      <div className={`grid items-center gap-3 px-[18px] py-3 transition-colors hover:bg-muted/40 ${expanded ? "bg-muted/40" : ""}`} style={{ gridTemplateColumns: "minmax(0,1fr) 110px 170px 110px 120px" }}>
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-w-0 items-center gap-3 text-left text-foreground">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "none" }} aria-hidden="true" />
          <SevPill severity={row.severity} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[14px] font-bold">{row.title}</span>
            {row.detail && <span className="truncate text-[12px] text-muted-foreground">{row.detail}</span>}
          </span>
        </button>
        <span className="text-[12px] font-semibold text-muted-foreground">{row.category}</span>
        <span className="flex flex-col gap-1">
          <span className="text-[13px]"><strong>{row.pages}</strong> <span className="text-muted-foreground">of {totalPages} · {pct}%</span></span>
          <span className="block h-[5px] rounded-[3px] bg-muted"><span className={`block h-[5px] rounded-[3px] ${SEV[row.severity].bar}`} style={{ width: `${pct}%` }} /></span>
        </span>
        <span><WhoPill who={row.who} /></span>
        <button
          type="button"
          onClick={() => (row.who === "auto" ? onOpen(row.code) : onToggle())}
          className={`h-9 rounded-[10px] text-[12px] font-bold ${row.who === "auto" ? "bg-[#4256D6] text-white hover:bg-[#3547BD]" : "border border-border bg-card text-foreground hover:bg-muted"}`}
        >
          {row.who === "auto" ? "Fix with AI" : expanded ? "Close" : "See how"}
        </button>
      </div>
      {expanded && <AffectedPages projectId={projectId} row={row} onOpen={onOpen} />}
    </div>
  )
}

function PageRow({ page, expanded, onToggle, onOpen }) {
  return (
    <div className="border-t border-border">
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="grid w-full items-center gap-3 px-[18px] py-3 text-left transition-colors hover:bg-muted/40" style={{ gridTemplateColumns: "minmax(0,1fr) 70px 70px 70px 90px" }}>
        <span className="flex min-w-0 items-center gap-3">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "none" }} aria-hidden="true" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[14px] font-bold text-foreground">{pageNameFromUrl(page.url)}</span>
            <span className="truncate text-[12px] text-[#4256D6] dark:text-[#8FA0FF]">{pathOf(page.url)}</span>
          </span>
        </span>
        <span className={`text-[14px] font-extrabold ${SEV.high.value}`}>{page.high}</span>
        <span className={`text-[14px] font-extrabold ${SEV.medium.value}`}>{page.medium}</span>
        <span className={`text-[14px] font-extrabold ${SEV.low.value}`}>{page.low}</span>
        <span className="text-[14px] font-extrabold text-foreground">{page.total}</span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 bg-muted/40 pb-[18px] pl-[46px] pr-[18px] pt-1.5">
          {page.issues.map((q) => (
            <div key={q.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <SevPill severity={q.severity} />
              <span className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-bold text-foreground">{q.title}</span>
                {q.detail && <span className="text-[12px] text-muted-foreground">{q.detail}</span>}
              </span>
              <WhoPill who={q.who} />
              <button type="button" onClick={() => onOpen(q.code, page.url)} className="h-8 rounded-[9px] bg-foreground px-3 text-[12px] font-bold text-background">
                {q.who === "auto" ? "Fix with AI" : "See how"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The On-Page issues list: severity cards, quick win, toolbar (By issue / By page, search, filters) and the two lists.
 * Opening a fix is delegated (`onOpenIssue(code, url?)`) to the existing issue workspace; nothing about fixing lives here.
 */
export default function OnPageIssuesView({ issues, summary, projectId, autoFixIds, onOpenIssue, error, title = "On-Page issues", crumb = "On-Page", emptyMessage = "No on-page issues found. Your site looks great!" }) {
  const [view, setView] = useState("issue")
  const [severity, setSeverity] = useState("all")
  const [category, setCategory] = useState("all")
  const [who, setWho] = useState("all")
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(null)
  const [pagesShown, setPagesShown] = useState(PAGES_SHOWN)

  const totalPages = summary?.total_pages_analyzed ?? 0
  const rows = useMemo(() => buildIssueRows(issues, autoFixIds), [issues, autoFixIds])
  const stats = useMemo(() => severityStats(rows, totalPages), [rows, totalPages])
  const win = useMemo(() => quickWin(rows), [rows])
  const cats = useMemo(() => categoriesOf(rows), [rows])
  const hasAuto = rows.some((r) => r.who === "auto") // screens with nothing Odito can auto-fix (Accessibility) hide the Who fixes filter
  const visibleRows = useMemo(() => filterIssueRows(rows, { severity, category, who, query }), [rows, severity, category, who, query])
  const pages = useMemo(() => buildPageRows(rows), [rows])
  const visiblePages = useMemo(() => filterPageRows(pages, query), [pages, query])
  const hasFilters = severity !== "all" || category !== "all" || who !== "all" || query !== ""
  const clearAll = () => { setSeverity("all"); setCategory("all"); setWho("all"); setQuery("") }
  const pickSeverity = (s) => { setSeverity((cur) => (cur === s ? "all" : s)); setView("issue") }
  const listTitle = severity === "all" ? `All issues · ${visibleRows.length} types` : `${SEV[severity].label} priority · ${visibleRows.length} types`

  if (error) return <div className="py-12 text-center text-red-500">Failed to load issues: {String(error)}</div>
  if (rows.length === 0) return <div className="py-12 text-center text-muted-foreground">{emptyMessage}</div>

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-muted-foreground">
            <Link href="/app/domain-overview" className="hover:underline">Dashboard</Link> / SEO / <span className="font-bold text-foreground">{crumb}</span>
          </span>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">{title}</h1>
        </div>
        <span className="text-[13px] text-muted-foreground">{totalPages} pages scanned</span>
      </header>

      <div role="group" aria-label="Filter by severity" className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))" }}>
        <StatCard label="All issues" value={stats.all.issues} sub={`${stats.all.types} issue types · ${totalPages} pages`} accent="bg-foreground" valueColor="text-foreground" active={severity === "all"} showBadge={severity === "all"} onClick={() => { setSeverity("all"); setView("issue") }} />
        {["high", "medium", "low"].map((s) => (
          <StatCard
            key={s}
            label={`${SEV[s].label} priority`}
            value={stats[s].issues}
            sub={`${stats[s].types} issue type${stats[s].types === 1 ? "" : "s"}${s === "high" ? " · fix first" : ""}`}
            accent={SEV[s].accent}
            valueColor={SEV[s].value}
            active={severity === s}
            showBadge={severity === s}
            onClick={() => pickSeverity(s)}
          />
        ))}
      </div>

      {win.count > 0 && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-[#0A86A0]/30 bg-[#0A86A0]/10 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#0A86A0] text-white"><Sparkles className="h-[18px] w-[18px]" aria-hidden="true" /></span>
          <span className="min-w-[240px] flex-1 text-[14px] leading-normal">
            <strong>Quick win:</strong> fixing the top {win.count} issue{win.count === 1 ? "" : "s"} below clears <strong>{win.cleared.toLocaleString()} of {win.total.toLocaleString()}</strong> problems ({win.percent}%).
            {win.autoCount > 0 && <> {win.autoCount === win.count ? "All" : win.autoCount} of them odito can fix for you automatically.</>}
          </span>
          {win.autoCount > 0 && (
            <button type="button" onClick={() => { setView("issue"); setSeverity("all"); setWho("auto") }} className="h-10 rounded-xl bg-foreground px-3.5 text-[13px] font-bold text-background">
              Show auto-fixable
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="tablist" aria-label="View" className="flex gap-0.5 rounded-xl bg-muted p-1">
            {[["issue", "By issue"], ["page", "By page"]].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => { setView(id); setExpanded(null) }} className={`h-9 rounded-[9px] px-3.5 text-[13px] font-bold ${view === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-muted-foreground">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search issues or pages</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={view === "issue" ? 'Search issues, e.g. "meta description"' : "Search pages by title or URL"} className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-foreground outline-none" />
          </label>
          {hasFilters && <button type="button" onClick={clearAll} className="h-11 rounded-xl px-3 text-[13px] font-bold text-[#4256D6] dark:text-[#8FA0FF]">Clear filters</button>}
        </div>
        {view === "issue" && (
          <div className="flex flex-wrap items-center gap-x-[18px] gap-y-3">
            {cats.length > 1 && <div role="group" aria-label="Category" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[12px] font-bold text-muted-foreground">Type</span>
              {["all", ...cats].map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c === "all" ? "All" : c}</Chip>)}
            </div>}
            {hasAuto && <div role="group" aria-label="Who fixes it" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[12px] font-bold text-muted-foreground">Who fixes</span>
              {[["all", "Anyone"], ["auto", "Auto-fix"], ["you", "You"]].map(([id, label]) => <Chip key={id} active={who === id} onClick={() => setWho(id)}>{label}</Chip>)}
            </div>}
          </div>
        )}
      </div>

      {view === "issue" ? (
        <section aria-label="Issues" className="overflow-hidden rounded-[20px] border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-[18px] py-3.5">
            <span className="text-[14px] font-extrabold">{listTitle}</span>
            <span className="text-[12px] text-muted-foreground">Sorted by pages affected · click a row to see pages and fixes</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid gap-3 border-b border-border px-[18px] py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground" style={{ gridTemplateColumns: "minmax(0,1fr) 110px 170px 110px 120px" }}>
                <span>Issue</span><span>Type</span><span>Pages affected</span><span>Who fixes</span><span />
              </div>
              {visibleRows.map((row) => (
                <IssueRow key={row.key} row={row} totalPages={totalPages} projectId={projectId} expanded={expanded === row.key} onToggle={() => setExpanded((cur) => (cur === row.key ? null : row.key))} onOpen={onOpenIssue} />
              ))}
              {visibleRows.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-[18px] py-10 text-center">
                  <span className="text-[15px] font-extrabold">No issues match these filters</span>
                  <button type="button" onClick={clearAll} className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-bold">Clear filters</button>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section aria-label="Pages" className="overflow-hidden rounded-[20px] border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-[18px] py-3.5">
            <span className="text-[14px] font-extrabold">{Math.min(pagesShown, visiblePages.length)} of {visiblePages.length} pages shown</span>
            <span className="text-[12px] text-muted-foreground">Sorted by most high-priority issues · click a page to see its issues</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid gap-3 border-b border-border px-[18px] py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground" style={{ gridTemplateColumns: "minmax(0,1fr) 70px 70px 70px 90px" }}>
                <span>Page</span><span>High</span><span>Medium</span><span>Low</span><span>Total</span>
              </div>
              {visiblePages.slice(0, pagesShown).map((p) => (
                <PageRow key={p.url} page={p} expanded={expanded === p.url} onToggle={() => setExpanded((cur) => (cur === p.url ? null : p.url))} onOpen={onOpenIssue} />
              ))}
              {visiblePages.length > pagesShown && (
                <button type="button" onClick={() => setPagesShown((n) => n + PAGES_SHOWN)} className="w-full border-t border-border py-3 text-[13px] font-bold text-[#4256D6] dark:text-[#8FA0FF]">
                  Show {Math.min(PAGES_SHOWN, visiblePages.length - pagesShown)} more pages
                </button>
              )}
              {visiblePages.length === 0 && <div className="px-[18px] py-10 text-center text-[15px] font-extrabold">{pages.length === 0 ? "No page-level data for this audit yet" : "No pages match your search"}</div>}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
