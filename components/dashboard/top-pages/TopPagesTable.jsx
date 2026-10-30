"use client"

import Link from "next/link"
import { Fragment, useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { DateCell, RankCell } from "../backlinks/cells"
import Pagination from "../organic-keywords/Pagination"
import { effectiveSort } from "./buildDomainPagesRequest"
import { FLAG_FILTER_HINT, MAX_OFFSET, SORT_COLUMNS, TRAFFIC_HINT } from "./constants"
import { BacklinksCell, DofollowCell, FlagChips, PageCell, ReferringDomainsCell, StatusBadge, TrafficCell } from "./cells"
import ExpandedPage from "./ExpandedPage"
import { backlinksHref, keywordsHref } from "./links"

const COLUMNS = [
  { key: "status", label: "Status", hint: "The HTTP status the page answers with when the crawler fetches it: 200 loads, 301 redirects, 404 is gone, 403 means the server refuses the crawler." },
  { key: "referringDomains", label: "Referring domains", sort: "referringDomains", hint: "How many different sites link to this page. The bar is its share of all your referring domains." },
  { key: "backlinks", label: "Backlinks", sort: "backlinks", hint: "How many links point to this page. A red “broken” line counts the ones the provider flagged as broken." },
  { key: "dofollow", label: "Dofollow", hint: "The share of the referring domains that pass ranking credit." },
  { key: "rank", label: "Rank", sort: "rank", hint: "The page's rank, 0–1000 (higher = stronger)." },
  { key: "traffic", label: "Est. traffic", hint: TRAFFIC_HINT },
  { key: "flags", label: "Flags", hint: "Opportunities worth acting on: links wasted on a broken page, links passing through a redirect, strong links with no rankings, and rankings with few links." },
  { key: "firstSeen", label: "First seen", sort: "firstSeen", hint: "When a link to this page was first found." },
]

/** Header sort options for the "Sort by" control (the provider's five sortable paths). */
export const SORT_OPTIONS = Object.freeze([
  { field: "page_summary.referring_domains", label: "Referring domains" }, { field: "page_summary.backlinks", label: "Backlinks" }, { field: "page_summary.rank", label: "Rank" },
  { field: "page_summary.broken_backlinks", label: "Broken backlinks" }, { field: "page_summary.first_seen", label: "First seen" },
])

function SortHead({ column, state, onSort }) {
  const rule = effectiveSort(state)
  const field = SORT_COLUMNS[column.sort]
  const active = rule.field === field
  const Icon = !active ? ArrowUpDown : rule.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(column.sort)}
      className={cn("inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "text-foreground" : "text-foreground/80")}
      aria-label={`Sort by ${column.label}${active ? `, currently ${rule.dir === "asc" ? "ascending" : "descending"}` : ""}`}
      data-testid={`tp-sort-${column.sort}`}
    >
      {column.label}
      <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
    </button>
  )
}

function Head({ column, state, onSort, trafficTruncated }) {
  const rule = effectiveSort(state)
  const primary = column.sort && rule.field === SORT_COLUMNS[column.sort] ? rule.dir : null
  const hint = column.key === "traffic" && trafficTruncated ? `${column.hint} The domain has more keywords than that, so a page can rank for more than shown.` : column.hint
  return (
    <TableHead aria-sort={primary ? (primary === "asc" ? "ascending" : "descending") : undefined} className="h-auto whitespace-normal py-2 align-bottom leading-tight">
      <span className="inline-flex items-center gap-0.5">
        {column.sort ? <SortHead column={column} state={state} onSort={onSort} /> : <span>{column.label}</span>}
        <InfoHint label={column.label} text={hint} />
      </span>
    </TableHead>
  )
}

function cell(key, row, ctx) {
  switch (key) {
    case "status": return <StatusBadge row={row} />
    case "referringDomains": return <ReferringDomainsCell row={row} total={ctx.referringDomainsTotal} />
    case "backlinks": return <BacklinksCell row={row} />
    case "dofollow": return <DofollowCell row={row} />
    case "rank": return <RankCell value={row.rank} label="Rank" />
    case "traffic": return <TrafficCell row={row} truncated={ctx.trafficTruncated} />
    case "flags": return <FlagChips row={row} />
    case "firstSeen": return <DateCell value={row.firstSeen} />
    default: return null
  }
}

/** Keeps the expanded details at the left edge and as wide as the part of the table that is in view, whatever the scroll position. */
function PinnedToViewport({ children }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(null)
  useEffect(() => {
    const scroller = ref.current?.closest('[data-slot="table-container"]')
    if (!scroller) return undefined
    const measure = () => setWidth(scroller.clientWidth || null)
    measure()
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    observer?.observe(scroller)
    return () => observer?.disconnect()
  }, [])
  return <div ref={ref} className="sticky left-0 max-w-full" style={width ? { width } : undefined}>{children}</div>
}

/** A click on a link or button inside a row does its own thing; it does not open the row. */
const fromInteractive = (e) => Boolean(e.target.closest("a, button, input, select, textarea, [role=menuitem]"))

function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }, (_, i) => (
    <TableRow key={i} aria-hidden data-testid="tp-skeleton-row">
      <TableCell className="min-w-[220px]"><Skel className="h-9 w-56" /></TableCell>
      {COLUMNS.map((c) => <TableCell key={c.key}><Skel className="h-5 w-16" /></TableCell>)}
      <TableCell className="w-10" />
    </TableRow>
  ))
}

function RowActions({ row, onCopy }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${row.address}`} data-testid="tp-actions">
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild data-testid="tp-action-backlinks"><Link href={backlinksHref(row.url)}>View backlinks</Link></DropdownMenuItem>
        <DropdownMenuItem asChild data-testid="tp-action-keywords"><Link href={keywordsHref(row.path)}>View keywords</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCopy(row)} data-testid="tp-action-copy">Copy URL</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function emptyMessage({ state, noFilters }) {
  if (!noFilters) return { kind: "filtered", text: "No pages match these filters" }
  if (state.tab === "errors") return { kind: "success", text: "No error pages with backlinks." }
  if (state.tab === "redirects") return { kind: "none", text: "No redirected pages with backlinks." }
  if (state.tab === "ok") return { kind: "none", text: "No OK pages with backlinks." }
  return { kind: "none", text: "No pages with backlinks found for this domain yet." }
}

/**
 * The results panel: the "Showing x–y of N pages" line, the sortable table with expandable rows and an actions menu, and the pagination. While a new
 * request is in flight the previous rows stay (dimmed) so the table never jumps to empty. Page, Status and Referring domains come first (the Page
 * column sticks to the left edge): on a narrow screen they stay in view while the rest scrolls sideways.
 */
export default function TopPagesTable({ page, state, update, onSort, viewKey, noFilters, onClearAll, onCopy, referringDomainsTotal, trafficTruncated }) {
  const [open, setOpen] = useState(null)
  // The open row belongs to the view it was opened in (tab, filters, sort, page, merge): when that changes it closes.
  if (open && open.viewKey !== viewKey) setOpen(null)
  const openId = open && open.viewKey === viewKey ? open.id : null
  const toggle = (row) => setOpen(openId === row.id ? null : { id: row.id, viewKey })

  const { rows, total } = page
  const first = (state.page - 1) * state.pageSize + 1
  const flagFiltered = state.flags.length > 0
  const merged = state.merge && rows.some((r) => r.variantCount > 1)
  const showing = total === null ? null
    : total === 0 ? "No pages"
      : `Showing ${formatExact(first)}–${formatExact(first + page.loadedRows.length - 1)} of ${formatExact(total)} pages${flagFiltered ? ` · ${formatExact(rows.length)} on this page match the flag filter` : ""}`
  const rule = effectiveSort(state)
  const ctx = { referringDomainsTotal, trafficTruncated }

  let body
  if (page.status === "loading") body = <SkeletonRows />
  else if (page.status === "error") body = null
  else {
    body = rows.map((row) => {
      const isOpen = openId === row.id
      return (
        <Fragment key={row.id}>
          <TableRow
            onClick={(e) => { if (!fromInteractive(e)) toggle(row) }}
            className={cn("cursor-pointer", isOpen && "bg-muted/40", (row.statusGroup === "error" || row.statusGroup === "blocked") && row.flagIds.includes("wasted_links") && "bg-red-50/60 dark:bg-red-500/5")}
            data-testid="tp-row"
            data-status-group={row.statusGroup}
            data-state={isOpen ? "open" : "closed"}
          >
            <TableCell className="sticky left-0 z-[1] bg-card">
              <div className="flex items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => toggle(row)}
                  aria-expanded={isOpen}
                  aria-label={`Details for ${row.address}`}
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="tp-expand"
                >
                  <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} aria-hidden />
                </button>
                <PageCell row={row} />
              </div>
            </TableCell>
            {COLUMNS.map((c) => <TableCell key={c.key}>{cell(c.key, row, ctx)}</TableCell>)}
            <TableCell className="w-10"><RowActions row={row} onCopy={onCopy} /></TableCell>
          </TableRow>
          {isOpen ? (
            <TableRow className="hover:bg-transparent" data-testid="tp-expanded-row">
              <TableCell colSpan={COLUMNS.length + 2} className="whitespace-normal bg-muted/20 p-0">
                <PinnedToViewport><div className="p-4"><ExpandedPage row={row} referringDomainsTotal={referringDomainsTotal} /></div></PinnedToViewport>
              </TableCell>
            </TableRow>
          ) : null}
        </Fragment>
      )
    })
  }

  const noMatch = page.status === "success" && page.loadedRows.length === 0 && total === 0
  const flagOnlyEmpty = page.status === "success" && rows.length === 0 && page.loadedRows.length > 0
  const empty = noMatch ? emptyMessage({ state, noFilters }) : flagOnlyEmpty ? { kind: "filtered", text: "No pages match these filters" } : null

  return (
    <section className="rounded-xl border border-border/60 bg-card" aria-label="Pages" data-testid="tp-results">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
        <h2 className="text-base font-semibold">Pages</h2>
        <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="tp-showing">{showing ?? <Skel className="inline-block h-4 w-44 align-middle" />}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 pt-1">
        <p className="text-xs text-muted-foreground" data-testid="tp-table-notes">
          {flagFiltered ? <span data-testid="tp-flag-note">{FLAG_FILTER_HINT} </span> : null}
          {merged ? <span data-testid="tp-merge-note">Counts of merged pages are approximate sums of their variants.</span> : null}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort by</span>
          <select
            value={rule.field}
            onChange={(e) => update({ sort: { field: e.target.value, dir: rule.dir } })}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="tp-sort-select"
          >
            {SORT_OPTIONS.map((o) => <option key={o.field} value={o.field}>{o.label}</option>)}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => update({ sort: { field: rule.field, dir: rule.dir === "desc" ? "asc" : "desc" } })} aria-label={`Direction: ${rule.dir === "desc" ? "highest first" : "lowest first"}. Click to flip.`} data-testid="tp-sort-dir">
            {rule.dir === "desc" ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUp className="size-3.5" aria-hidden />} {rule.dir === "desc" ? "High to low" : "Low to high"}
          </Button>
        </label>
      </div>

      {page.status === "error" ? (
        <div className="p-5"><SectionError message={page.error?.message} onRetry={page.refetch} /></div>
      ) : empty ? (
        <div className="p-5">
          {empty.kind === "filtered" ? (
            <div className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground" data-testid="tp-empty" data-kind="filtered">
              <span>{empty.text}</span>
              <Button type="button" variant="outline" size="sm" onClick={onClearAll}>Clear filters</Button>
            </div>
          ) : empty.kind === "success" ? (
            <div className="flex min-h-24 items-center justify-center gap-2 rounded-lg border border-emerald-300/70 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100" data-testid="tp-empty" data-kind="success">
              <CheckCircle2 className="size-4" aria-hidden />{empty.text}
            </div>
          ) : (
            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground" data-testid="tp-empty" data-kind="none">{empty.text}</div>
          )}
        </div>
      ) : (
        <div className={cn("mt-2 transition-opacity", page.stale && "opacity-60")} aria-busy={page.stale || undefined} data-testid="tp-table" data-stale={page.stale ? "true" : "false"}>
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-[1] h-auto bg-card py-2 pl-9 align-bottom leading-tight">Page</TableHead>
                {COLUMNS.map((c) => <Head key={c.key} column={c} state={state} onSort={onSort} trafficTruncated={trafficTruncated} />)}
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{body}</TableBody>
          </Table>
        </div>
      )}

      {page.status === "success" && total ? (
        <Pagination page={state.page} pageSize={state.pageSize} total={total} onPage={(p) => update({ page: p })} onPageSize={(pageSize) => update({ pageSize })} loading={page.stale} noun="pages" maxOffset={MAX_OFFSET} idPrefix="tp" />
      ) : null}
    </section>
  )
}
