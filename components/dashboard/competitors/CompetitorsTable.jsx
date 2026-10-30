"use client"

import { Fragment, useEffect, useId, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Loader2, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { TRAFFIC_HINT } from "../traffic-history/SummaryCards"
import Pagination from "../organic-keywords/Pagination"
import { SORTS } from "./constants"
import { AvgPosition, DomainLink, HeadToHead, Num, SharedKeywordsCell, TrackButton, Top1Cell } from "./cells"
import ExpandedCompetitorDetails from "./ExpandedCompetitorDetails"

/**
 * Column order keeps Track, Domain, Shared keywords and Head-to-head together at the left: on a narrow screen they are what stays in view
 * while the rest scrolls sideways (the Domain column also sticks to the left edge). `sort` ties a header to a server-side sort field
 * (constants.SORTS); the competitor's whole-site keywords and traffic cannot be sorted by the provider, so those headers have no arrow.
 */
const COLUMNS = [
  { key: "shared", label: "Shared keywords", sort: "shared", align: "end", hint: "Keywords both you and this site rank for in Google. The bar is that number as a share of all your keywords." },
  { key: "h2h", label: "Head-to-head", sort: "headToHead", hint: "Estimated monthly visits from the shared keywords: yours against theirs, sorted by theirs. Green when you lead, red when they do." },
  { key: "avgPosition", label: "Their avg. position", sort: "avgPosition", align: "end", hint: "The average Google position of this site on the shared keywords (lower is better)." },
  { key: "keywords", label: "Their total keywords", align: "end", hint: "Every keyword this site ranks for, not just the shared ones." },
  { key: "traffic", label: "Their total traffic", align: "end", hint: TRAFFIC_HINT, hintLabel: "Est. traffic" },
  { key: "top1", label: "#1 rankings", hint: "Keywords where each site ranks first, out of the shared keywords." },
]
const COLUMN_COUNT = COLUMNS.length + 2 // domain (with the star) + actions

function SortHead({ column, state, update }) {
  const active = state.sort === column.sort
  const Icon = !active ? ArrowUpDown : state.dir === "asc" ? ArrowUp : ArrowDown
  const choose = () => update(active ? { dir: state.dir === "asc" ? "desc" : "asc" } : { sort: column.sort, dir: SORTS[column.sort].dir })
  return (
    <button
      type="button"
      onClick={choose}
      className={cn("inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "text-foreground" : "text-foreground/80")}
      aria-label={`Sort by ${column.label}${active ? `, currently ${state.dir === "asc" ? "ascending" : "descending"}` : ""}`}
    >
      {column.label}
      <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
    </button>
  )
}

function Head({ column, state, update }) {
  const ariaSort = column.sort && state.sort === column.sort ? (state.dir === "asc" ? "ascending" : "descending") : undefined
  return (
    <TableHead aria-sort={ariaSort} className={cn("h-auto whitespace-normal py-2 align-bottom leading-tight", column.align === "end" && "text-right")}>
      <span className={cn("inline-flex items-center gap-0.5", column.align === "end" && "justify-end")}>
        {column.sort ? <SortHead column={column} state={state} update={update} /> : <span>{column.label}</span>}
        <InfoHint label={column.hintLabel ?? column.label} text={column.hint} />
      </span>
    </TableHead>
  )
}

function cell(key, row) {
  switch (key) {
    case "shared": return <SharedKeywordsCell row={row} />
    case "h2h": return <HeadToHead row={row} />
    case "avgPosition": return <AvgPosition value={row.avgPosition} />
    case "keywords": return <Num value={row.theirTotalKeywords} />
    case "traffic": return <Num value={row.theirTotalTraffic} />
    case "top1": return <Top1Cell row={row} />
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

function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }, (_, i) => (
    <TableRow key={i} aria-hidden data-testid="cp-skeleton-row">
      <TableCell className="min-w-[160px]"><Skel className="h-5 w-36" /></TableCell>
      {COLUMNS.map((c) => <TableCell key={c.key}><Skel className="ml-auto h-5 w-20" /></TableCell>)}
      <TableCell><Skel className="h-8 w-20" /></TableCell>
    </TableRow>
  ))
}

/**
 * The results panel: "Showing x–y of N competitors", the sortable table with expandable rows, and the pagination. While a new request is
 * in flight the previous rows stay (dimmed) so the table never jumps to empty. `highlight` is the domain a chart bubble was clicked on.
 */
export default function CompetitorsTable({
  page, state, update, trackedSet, trackPending, excludePending, onToggleTrack, onExclude, highlight, settingsActive, onResetSettings, viewKey,
}) {
  const baseId = `cp-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const [open, setOpen] = useState(null)
  // The open row belongs to the view it was opened in (page, sort, settings): when that changes it closes.
  if (open && open.viewKey !== viewKey) setOpen(null)
  const openId = open && open.viewKey === viewKey ? open.id : null
  const toggle = (row) => setOpen(openId === row.id ? null : { id: row.id, viewKey })

  const { rows, total } = page
  const first = page.offset + 1
  const showing = total === null ? null : total === 0 ? "No competitors" : `Showing ${formatExact(first)}–${formatExact(first + rows.length - 1)} of ${formatExact(total)} competitors`

  let body
  if (page.status === "loading") body = <SkeletonRows />
  else if (page.status === "error") body = null
  else {
    body = rows.map((row, i) => {
      const isOpen = openId === row.id
      const panelId = `${baseId}-${i}`
      const tracked = trackedSet.has(row.domain)
      return (
        <Fragment key={row.id}>
          <TableRow
            id={`cp-row-${row.domain}`}
            onClick={(e) => { if (!fromInteractive(e)) toggle(row) }}
            className={cn("cursor-pointer scroll-mt-24", isOpen && "bg-muted/40", highlight === row.domain && "bg-primary/10 ring-2 ring-inset ring-primary/60")}
            data-testid="cp-row"
            data-domain={row.domain}
            data-highlighted={highlight === row.domain ? "true" : undefined}
          >
            <TableCell className={cn("sticky left-0 z-10 min-w-[140px] max-w-[140px] whitespace-normal py-3 pl-2 pr-1 @min-[640px]/main:min-w-[220px] @min-[640px]/main:max-w-[280px]", isOpen ? "bg-muted" : "bg-card")}>
              <div className="flex items-center gap-1 @min-[640px]/main:gap-2">
                <TrackButton domain={row.domain} tracked={tracked} busy={trackPending.has(row.domain)} onToggle={onToggleTrack} />
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-label={`Details for ${row.domain}`}
                  onClick={() => toggle(row)}
                  className="grid size-6 shrink-0 place-items-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} aria-hidden />
                </button>
                <DomainLink domain={row.domain} hideIconOnNarrow />
              </div>
            </TableCell>
            {COLUMNS.map((c) => <TableCell key={c.key} className={cn("py-3", c.align === "end" && "text-right")}>{cell(c.key, row)}</TableCell>)}
            <TableCell className="py-3 pr-4 text-right">
              <Button type="button" variant="ghost" size="sm" onClick={() => onExclude(row.domain)} disabled={excludePending.has(row.domain)} aria-label={`Exclude ${row.domain}`} data-testid="cp-exclude">
                {excludePending.has(row.domain) ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Ban className="size-3.5" aria-hidden />} Exclude
              </Button>
            </TableCell>
          </TableRow>
          {isOpen ? (
            <TableRow className="bg-muted/30 hover:bg-muted/30" data-testid="cp-expanded-row">
              <TableCell colSpan={COLUMN_COUNT} className="whitespace-normal border-l-2 border-l-primary/60 p-0">
                <PinnedToViewport><ExpandedCompetitorDetails row={row} id={panelId} /></PinnedToViewport>
              </TableCell>
            </TableRow>
          ) : null}
        </Fragment>
      )
    })
  }

  const noRows = page.status === "success" && rows.length === 0

  return (
    <section className="rounded-xl border border-border/60 bg-card" aria-labelledby="cp-table-title" data-testid="cp-results">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4">
        <h2 id="cp-table-title" className="text-base font-semibold">Competitors</h2>
        <p className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums" role="status" data-testid="cp-showing">
          {page.stale && page.isFetching ? <Loader2 className="size-3.5 animate-spin" aria-label="Updating results" /> : null}
          {showing}
        </p>
      </div>

      {page.status === "error" ? (
        <div className="p-5"><SectionError message={page.error?.message} onRetry={page.refetch} /></div>
      ) : noRows ? (
        <div className="m-5 flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground" data-testid="cp-empty">
          {settingsActive ? (
            <>
              <p>No competitors match these settings.</p>
              <Button type="button" variant="outline" size="sm" onClick={onResetSettings}>Reset settings</Button>
            </>
          ) : (
            <p>No competitors found yet — this domain needs more rankings.</p>
          )}
        </div>
      ) : (
        <div className={cn("mt-3 border-t border-border/60 transition-opacity", page.stale && "opacity-60")} aria-busy={page.status === "loading" || (page.stale && page.isFetching)}>
          <Table data-testid="cp-table">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-[140px] bg-card pl-2 align-bottom @min-[640px]/main:min-w-[220px]">Domain <span className="sr-only">(star to track)</span></TableHead>
                {COLUMNS.map((c) => <Head key={c.key} column={c} state={state} update={update} />)}
                <TableHead className="pr-4 text-right align-bottom"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{body}</TableBody>
          </Table>
        </div>
      )}

      {page.status === "success" && total ? (
        <Pagination
          page={state.page}
          pageSize={state.pageSize}
          total={total}
          noun="competitors"
          loading={page.stale && page.isFetching}
          onPage={(p) => update({ page: p })}
          onPageSize={(pageSize) => update({ pageSize })}
        />
      ) : null}
    </section>
  )
}
