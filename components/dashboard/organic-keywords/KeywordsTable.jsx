"use client"

import { Fragment, useEffect, useId, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { SORTS } from "./constants"
import { formatCpc } from "./format"
import { IntentBadge, KdCell, KeywordLink, PositionCell, SerpFeatureIcons, TrafficCell, UrlCell, VolumeCell } from "./cells"
import ExpandedKeywordDetails from "./ExpandedKeywordDetails"
import Pagination from "./Pagination"

/**
 * Column order keeps Keyword, Position and Traffic together at the left: on a narrow screen they are what stays in view while the rest
 * scrolls sideways (the Keyword column also sticks to the left edge). `sort` ties a header to a server-side sort field (constants.SORTS).
 */
const COLUMNS = [
  { key: "position", label: "Position", sort: "position", hint: "Where the page ranks in Google's results (1 = first). The arrow shows how it moved since the previous check." },
  { key: "traffic", label: "Traffic", sort: "traffic", align: "end", hint: "Estimated monthly visits from this keyword (rankings × click-through rate), and its share of the whole domain's traffic." },
  { key: "volume", label: "Volume", sort: "volume", align: "end", hint: "Average monthly searches for this keyword in this country." },
  { key: "difficulty", label: "KD", sort: "difficulty", align: "end", hint: "Keyword difficulty, 0–100: how hard it is to reach Google's top 10. Green 0–29 easy, yellow 30–49 moderate, orange 50–69 difficult, red 70+ hard." },
  { key: "intent", label: "Intent", hint: "Why people search: I informational, N navigational, C commercial, T transactional." },
  { key: "cpc", label: "CPC", sort: "cpc", align: "end", hint: "Average cost per click advertisers pay for this keyword." },
  { key: "url", label: "URL", hint: "The page on this site that ranks. Opens in a new tab." },
  { key: "serp", label: "SERP features", hint: "Extra elements on this keyword's Google results page (AI Overview, map pack, videos, …)." },
]
const COLUMN_COUNT = COLUMNS.length + 1

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
  const sortKey = column.sort
  const ariaSort = sortKey && state.sort === sortKey ? (state.dir === "asc" ? "ascending" : "descending") : undefined
  return (
    <TableHead aria-sort={ariaSort} className={cn("align-bottom", column.align === "end" && "text-right")}>
      <span className={cn("inline-flex items-center gap-0.5", column.align === "end" && "justify-end")}>
        {sortKey ? <SortHead column={column} state={state} update={update} /> : <span>{column.label}</span>}
        {column.hint ? <InfoHint label={column.label} text={column.hint} /> : null}
      </span>
    </TableHead>
  )
}

function cell(key, row) {
  switch (key) {
    case "position": return <PositionCell row={row} />
    case "traffic": return <TrafficCell row={row} />
    case "volume": return <VolumeCell row={row} />
    case "difficulty": return <KdCell row={row} />
    case "intent": return <IntentBadge intent={row.intent} />
    case "cpc": return <span className="tabular-nums" data-testid="ok-cpc">{formatCpc(row.cpc)}</span>
    case "url": return <UrlCell row={row} className="max-w-[150px]" />
    case "serp": return <SerpFeatureIcons features={row.serpFeatures} />
    default: return null
  }
}

/**
 * The expanded details span every column of a wide table, so on a narrow screen they would sit far off to the right. This keeps them at
 * the left edge and exactly as wide as the part of the table that is in view (the table's scroll container), whatever the scroll position.
 */
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

/** The click handler on a row ignores clicks on links and buttons inside it (they do their own thing). */
const fromInteractive = (e) => Boolean(e.target.closest("a, button, input, select, textarea"))

function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }, (_, i) => (
    <TableRow key={i} aria-hidden data-testid="ok-skeleton-row">
      <TableCell className="min-w-[240px]"><Skel className="h-5 w-48" /></TableCell>
      {COLUMNS.map((c) => <TableCell key={c.key}><Skel className="ml-auto h-5 w-14" /></TableCell>)}
    </TableRow>
  ))
}

/**
 * The results panel: the "Showing x–y of N" line, the sortable table with expandable rows, and the pagination. `page` is the hook's page
 * state; while a new request is in flight the previous rows stay (dimmed) so the table never jumps to empty.
 */
export default function KeywordsTable({ page, state, update, activeCount, onClearAll, viewKey }) {
  const baseId = `ok-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const [open, setOpen] = useState(null)
  // The open row belongs to the view it was opened in (page, sort, filters): when that changes it closes, so coming back never re-opens it.
  if (open && open.viewKey !== viewKey) setOpen(null)
  const openId = open && open.viewKey === viewKey ? open.id : null
  const toggle = (row) => setOpen(openId === row.id ? null : { id: row.id, viewKey })

  const { rows, total } = page
  const first = (state.page - 1) * state.pageSize + 1
  const showing = total === null ? null : total === 0 ? "No keywords" : `Showing ${formatExact(first)}–${formatExact(first + rows.length - 1)} of ${formatExact(total)} keywords`

  let body
  if (page.status === "loading") {
    body = <SkeletonRows />
  } else if (page.status === "error") {
    body = null
  } else {
    body = rows.map((row, i) => {
      const isOpen = openId === row.id
      const panelId = `${baseId}-${i}`
      return (
        <Fragment key={row.id}>
          <TableRow onClick={(e) => { if (!fromInteractive(e)) toggle(row) }} className={cn("cursor-pointer", isOpen && "bg-muted/40")} data-testid="ok-row">
            <TableCell className={cn("sticky left-0 z-10 min-w-[220px] max-w-[300px] whitespace-normal py-3 pl-4", isOpen ? "bg-muted" : "bg-card")}>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-label={`Details for ${row.keyword}`}
                  onClick={() => toggle(row)}
                  className="mt-px grid size-6 shrink-0 place-items-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} aria-hidden />
                </button>
                <div className="min-w-0 pt-px"><KeywordLink row={row} /></div>
              </div>
            </TableCell>
            {COLUMNS.map((c) => (
              <TableCell key={c.key} className={cn("py-3", c.align === "end" && "text-right")}>{cell(c.key, row)}</TableCell>
            ))}
          </TableRow>
          {isOpen ? (
            <TableRow className="bg-muted/30 hover:bg-muted/30" data-testid="ok-expanded-row">
              <TableCell colSpan={COLUMN_COUNT} className="whitespace-normal border-l-2 border-l-primary/60 p-0">
                <PinnedToViewport><ExpandedKeywordDetails row={row} id={panelId} /></PinnedToViewport>
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
    <section className="rounded-xl border border-border/60 bg-card" aria-labelledby="ok-table-title" data-testid="ok-results">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4">
        <h2 id="ok-table-title" className="text-base font-semibold">Keywords</h2>
        <p className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums" role="status" data-testid="ok-showing">
          {page.stale && page.isFetching ? <Loader2 className="size-3.5 animate-spin" aria-label="Updating results" /> : null}
          {showing}
        </p>
      </div>

      {page.status === "error" ? (
        <div className="p-5"><SectionError message={page.error?.message} onRetry={page.refetch} /></div>
      ) : noRows ? (
        <div className="m-5 flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground" data-testid="ok-empty">
          {filtered ? (
            <>
              <p>No keywords match these filters.</p>
              <Button type="button" variant="outline" size="sm" onClick={onClearAll}>Clear filters</Button>
            </>
          ) : (
            <p>This domain doesn&apos;t rank for any keywords yet.</p>
          )}
        </div>
      ) : (
        <div className={cn("mt-3 border-t border-border/60 transition-opacity", page.stale && "opacity-60")} aria-busy={page.status === "loading" || (page.stale && page.isFetching)}>
          <Table data-testid="ok-table">
            <TableHeader>
              <TableRow>
                <TableHead aria-sort={state.sort === "keyword" ? (state.dir === "asc" ? "ascending" : "descending") : undefined} className="sticky left-0 z-10 min-w-[220px] bg-card pl-4 align-bottom">
                  <SortHead column={{ label: "Keyword", sort: "keyword" }} state={state} update={update} />
                </TableHead>
                {COLUMNS.map((c) => <Head key={c.key} column={c} state={state} update={update} />)}
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
          loading={page.stale && page.isFetching}
          onPage={(p) => update({ page: p })}
          onPageSize={(pageSize) => update({ pageSize })}
        />
      ) : null}
    </section>
  )
}
