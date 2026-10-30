"use client"

import { Fragment, useEffect, useId, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { effectiveSort } from "./buildBacklinkRequest"
import { BROKEN_BANNER, MAX_SORT_RULES, SORT_COLUMNS } from "./constants"
import { AnchorCell, DateCell, FollowCell, PlacementChip, RankCell, SourceCell, SpamBadge, StatusBadges, TargetCell } from "./cells"
import BacklinksPagination from "./BacklinksPagination"
import ExpandedBacklink from "./ExpandedBacklink"

/**
 * Column order keeps Source, Anchor and Follow together at the left: on a narrow screen they are what stays in view while the rest scrolls
 * sideways (the Source column also sticks to the left edge). `sort` ties a header to a server-side sort field (constants.SORT_COLUMNS).
 */
const COLUMNS = [
  { key: "anchor", label: "Anchor", hint: "The clickable text of the link. For an image link, the image's alt text." },
  { key: "follow", label: "Follow", hint: "Dofollow links can pass ranking credit; nofollow links ask search engines not to. ugc and sponsored mark user-generated and paid links." },
  { key: "target", label: "Target URL", hint: "The page on your site the link points to. A redirect shows where it ends up." },
  { key: "domainRank", label: "Domain Rank", sort: "domainRank", hint: "The linking site's rank, 0–1000 (higher = stronger)." },
  { key: "pageRank", label: "Page Rank", sort: "pageRank", hint: "The linking page's own rank, 0–1000." },
  { key: "spam", label: "Spam", sort: "spam", hint: "How likely this link is to be spam, 0–100. 0–10 Low, 11–30 Medium, 31+ High." },
  { key: "placement", label: "Placement", hint: "Where on the page the link sits. Links inside article content are usually worth more than footer or sidebar links." },
  { key: "firstSeen", label: "First seen", sort: "firstSeen", hint: "When the link was first found." },
  { key: "lastSeen", label: "Last seen", sort: "lastSeen", hint: "When the link was last confirmed." },
  { key: "status", label: "Status" },
]
const FIX_COLUMN = { key: "fix", label: "Suggested fix", hint: "What to do about this link, based on the status code your page returns." }

function SortHead({ column, state, onSort }) {
  const rules = effectiveSort(state)
  const spec = SORT_COLUMNS[column.sort]
  const index = rules.findIndex((r) => r.field === spec.field)
  const active = index >= 0
  const dir = active ? rules[index].dir : null
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={(e) => onSort(column.sort, { shift: e.shiftKey })}
      className={cn("inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "text-foreground" : "text-foreground/80")}
      aria-label={`Sort by ${column.label}${active ? `, currently ${dir === "asc" ? "ascending" : "descending"}${rules.length > 1 ? `, sort ${index + 1} of ${rules.length}` : ""}` : ""}. Shift-click to add a secondary sort.`}
      data-testid={`bl-sort-${column.sort}`}
    >
      {column.label}
      <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      {active && rules.length > 1 ? <span className="grid size-4 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background" aria-hidden>{index + 1}</span> : null}
    </button>
  )
}

function Head({ column, state, onSort }) {
  const rules = effectiveSort(state)
  const spec = column.sort ? SORT_COLUMNS[column.sort] : null
  const primary = spec && rules[0]?.field === spec.field ? rules[0].dir : null
  return (
    <TableHead aria-sort={primary ? (primary === "asc" ? "ascending" : "descending") : undefined} className="h-auto whitespace-normal py-2 align-bottom leading-tight">
      <span className="inline-flex items-center gap-0.5">
        {column.sort ? <SortHead column={column} state={state} onSort={onSort} /> : <span>{column.label}</span>}
        {column.hint ? <InfoHint label={column.label} text={column.hint + (column.sort ? " Shift-click to add a secondary sort (up to 3)." : "")} /> : null}
      </span>
    </TableHead>
  )
}

function cell(key, row) {
  switch (key) {
    case "anchor": return <AnchorCell row={row} />
    case "follow": return <FollowCell row={row} />
    case "target": return <TargetCell row={row} />
    case "domainRank": return <RankCell value={row.domainRank} label="Domain rank" />
    case "pageRank": return <RankCell value={row.pageRank} label="Page rank" />
    case "spam": return <SpamBadge score={row.spamScore} band={row.spamBand} />
    case "placement": return <PlacementChip label={row.placement} />
    case "firstSeen": return <DateCell value={row.firstSeen} />
    case "lastSeen": return <DateCell value={row.lastSeen} />
    case "status": return <StatusBadges badges={row.badges} />
    case "fix": return <span className="block min-w-[200px] max-w-[280px] whitespace-normal text-sm" data-testid="bl-fix">{row.suggestedFix}</span>
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
const fromInteractive = (e) => Boolean(e.target.closest("a, button, input, select, textarea"))

function SkeletonRows({ columns, count = 8 }) {
  return Array.from({ length: count }, (_, i) => (
    <TableRow key={i} aria-hidden data-testid="bl-skeleton-row">
      <TableCell className="min-w-[280px]"><Skel className="h-9 w-64" /></TableCell>
      {columns.map((c) => <TableCell key={c.key}><Skel className="h-5 w-20" /></TableCell>)}
    </TableRow>
  ))
}

const EMPTY_TEXT = { all: "No backlinks found for this domain yet.", new: "No new backlinks.", lost: "No lost backlinks.", broken: "No broken backlinks found." }

/**
 * The results panel: the "Showing x–y of N backlinks" line, the Broken tab's banner, the sortable table with expandable rows, and the
 * pagination. While a new request is in flight the previous rows stay (dimmed) so the table never jumps to empty.
 */
export default function BacklinksTable({ page, state, update, onSort, onFilterDomain, activeCount, onClearAll, viewKey, pageNumber }) {
  const baseId = `bl-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const [open, setOpen] = useState(null)
  // The open row belongs to the view it was opened in (tab, filters, sort, page): when that changes it closes.
  if (open && open.viewKey !== viewKey) setOpen(null)
  const openId = open && open.viewKey === viewKey ? open.id : null
  const toggle = (row) => setOpen(openId === row.id ? null : { id: row.id, viewKey })

  const broken = state.tab === "broken"
  const columns = broken ? [...COLUMNS, FIX_COLUMN] : COLUMNS
  const columnCount = columns.length + 1
  const { rows, total } = page
  const first = (pageNumber - 1) * state.pageSize + 1
  const showing = total === null ? null : total === 0 ? "No backlinks" : `Showing ${formatExact(first)}–${formatExact(first + rows.length - 1)} of ${formatExact(total)} backlinks`

  let body
  if (page.status === "loading") body = <SkeletonRows columns={columns} />
  else if (page.status === "error") body = null
  else {
    body = rows.map((row, i) => {
      const isOpen = openId === row.id
      const panelId = `${baseId}-${i}`
      return (
        <Fragment key={row.id}>
          <TableRow onClick={(e) => { if (!fromInteractive(e)) toggle(row) }} className={cn("cursor-pointer align-top", isOpen && "bg-muted/40")} data-testid="bl-row">
            <TableCell className={cn("sticky left-0 z-10 py-3 pl-3", isOpen ? "bg-muted" : "bg-card")}>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-label={`Details for the link from ${row.sourceDomain ?? row.sourceUrl ?? "this source"}`}
                  onClick={() => toggle(row)}
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} aria-hidden />
                </button>
                <SourceCell row={row} />
              </div>
            </TableCell>
            {columns.map((c) => <TableCell key={c.key} className="py-3">{cell(c.key, row)}</TableCell>)}
          </TableRow>
          {isOpen ? (
            <TableRow className="bg-muted/30 hover:bg-muted/30" data-testid="bl-expanded-row">
              <TableCell colSpan={columnCount} className="whitespace-normal border-l-2 border-l-primary/60 p-0">
                <PinnedToViewport><ExpandedBacklink row={row} id={panelId} onFilterDomain={onFilterDomain} /></PinnedToViewport>
              </TableCell>
            </TableRow>
          ) : null}
        </Fragment>
      )
    })
  }

  const noRows = page.status === "success" && rows.length === 0
  const filtered = activeCount > 0

  return (
    <section className="rounded-xl border border-border/60 bg-card" aria-labelledby="bl-table-title" data-testid="bl-results">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4">
        <h2 id="bl-table-title" className="text-base font-semibold">Backlinks</h2>
        <p className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums" role="status" data-testid="bl-showing">
          {page.stale && page.isFetching ? <Loader2 className="size-3.5 animate-spin" aria-label="Updating results" /> : null}
          {showing}
        </p>
      </div>

      {broken && page.status === "success" && total ? (
        <p className="mx-5 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="bl-broken-banner">
          {BROKEN_BANNER(formatExact(total))}
        </p>
      ) : null}

      {page.status === "error" ? (
        <div className="p-5"><SectionError message={page.error?.message} onRetry={page.refetch} /></div>
      ) : noRows ? (
        filtered ? (
          <div className="m-5 flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground" data-testid="bl-empty">
            <p>No backlinks match these filters</p>
            <Button type="button" variant="outline" size="sm" onClick={onClearAll}>Clear filters</Button>
          </div>
        ) : broken ? (
          <div className="m-5 flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-8 text-center text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200" data-testid="bl-empty" data-kind="success">
            <CheckCircle2 className="size-6" aria-hidden />
            <p className="font-medium">{EMPTY_TEXT.broken}</p>
          </div>
        ) : (
          <div className="m-5 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground" data-testid="bl-empty">
            <p>{EMPTY_TEXT[state.tab] ?? EMPTY_TEXT.all}</p>
          </div>
        )
      ) : (
        <div className={cn("mt-3 border-t border-border/60 transition-opacity", page.stale && "opacity-60")} aria-busy={page.status === "loading" || (page.stale && page.isFetching)}>
          <Table data-testid="bl-table">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-[280px] bg-card pl-3 align-bottom">Source</TableHead>
                {columns.map((c) => <Head key={c.key} column={c} state={state} onSort={onSort} />)}
              </TableRow>
            </TableHeader>
            <TableBody>{body}</TableBody>
          </Table>
          <p className="px-5 pb-2 pt-1 text-xs text-muted-foreground" data-testid="bl-sort-note">
            {effectiveSort(state).length ? "Sorted by your choice" : "Sorted by link rank, strongest first"} · Shift-click a column to add a secondary sort (up to {MAX_SORT_RULES}).
          </p>
        </div>
      )}

      {page.status === "success" && total ? (
        <BacklinksPagination
          page={pageNumber}
          pageSize={state.pageSize}
          total={total}
          loading={page.stale && page.isFetching}
          onPage={(p) => update({ page: p })}
          onPageSize={(pageSize) => update({ pageSize })}
          nextToken={page.nextToken}
          loadMore={page.loadMore}
          loadingMore={page.loadingMore}
          moreError={page.moreError}
        />
      ) : null}
    </section>
  )
}
