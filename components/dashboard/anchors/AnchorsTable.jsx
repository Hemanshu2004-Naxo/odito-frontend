"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { DateCell } from "../backlinks/cells"
import { RankCell, SpamBadge } from "../backlinks/cells"
import Pagination from "../organic-keywords/Pagination"
import { effectiveSort } from "./buildAnchorRequest"
import { MAX_OFFSET, SORT_COLUMNS, TYPE_FILTER_HINT } from "./constants"
import { AnchorCell, BacklinksCell, BrokenCell, DofollowCell, ReferringDomainsCell, TypeChip } from "./cells"
import ExpandedAnchor from "./ExpandedAnchor"

/**
 * Anchor, Type and Referring domains come first: on a narrow screen they are what stays in view while the rest scrolls sideways (the
 * Anchor column also sticks to the left edge). `sort` ties a header to a server-side sort field (constants.SORT_COLUMNS).
 */
const COLUMNS = [
  { key: "anchor", label: "Anchor", hint: "The clickable text of the link. Links without text (image links) are shown as “(empty / image link)”." },
  { key: "type", label: "Type", hint: "Our own classification, from your brand terms and target keywords (Anchor settings). It is not part of the data provider's answer." },
  { key: "referringDomains", label: "Referring domains", sort: "referringDomains", hint: "How many different sites link with this anchor. The bar is its share of all your referring domains." },
  { key: "backlinks", label: "Backlinks", sort: "backlinks", hint: "How many links use this anchor. A “sitewide” chip means 20+ links per referring domain — usually a footer or sidebar link." },
  { key: "dofollow", label: "Dofollow %", hint: "The share of the referring domains that pass ranking credit (dofollow)." },
  { key: "rank", label: "Rank", sort: "rank", hint: "The anchor's rank, 0–1000 (higher = stronger)." },
  { key: "spam", label: "Spam", sort: "spam", hint: "How likely the links with this anchor are to be spam, 0–100. 0–10 Low, 11–30 Medium, 31+ High." },
  { key: "broken", label: "Broken", sort: "broken", hint: "Backlinks with this anchor that point to pages on your site that return errors." },
  { key: "firstSeen", label: "First seen", sort: "firstSeen", hint: "When a link with this anchor was first found." },
]

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
      data-testid={`an-sort-${column.sort}`}
    >
      {column.label}
      <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
    </button>
  )
}

function Head({ column, state, onSort }) {
  const rule = effectiveSort(state)
  const primary = column.sort && rule.field === SORT_COLUMNS[column.sort] ? rule.dir : null
  return (
    <TableHead aria-sort={primary ? (primary === "asc" ? "ascending" : "descending") : undefined} className="h-auto whitespace-normal py-2 align-bottom leading-tight">
      <span className="inline-flex items-center gap-0.5">
        {column.sort ? <SortHead column={column} state={state} onSort={onSort} /> : <span>{column.label}</span>}
        <InfoHint label={column.label} text={column.hint} />
      </span>
    </TableHead>
  )
}

function cell(key, row, totalReferringDomains) {
  switch (key) {
    case "anchor": return <AnchorCell row={row} />
    case "type": return <TypeChip type={row.type} />
    case "referringDomains": return <ReferringDomainsCell row={row} total={totalReferringDomains} />
    case "backlinks": return <BacklinksCell row={row} />
    case "dofollow": return <DofollowCell row={row} />
    case "rank": return <RankCell value={row.rank} label="Rank" />
    case "spam": return <SpamBadge score={row.spamScore} band={row.spamBand} />
    case "broken": return <BrokenCell row={row} />
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
const fromInteractive = (e) => Boolean(e.target.closest("a, button, input, select, textarea"))

function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }, (_, i) => (
    <TableRow key={i} aria-hidden data-testid="an-skeleton-row">
      <TableCell className="min-w-[180px]"><Skel className="h-5 w-40" /></TableCell>
      {COLUMNS.slice(1).map((c) => <TableCell key={c.key}><Skel className="h-5 w-16" /></TableCell>)}
    </TableRow>
  ))
}

/**
 * The results panel: the "Showing x–y of N anchors" line, the sortable table with expandable rows, and the pagination. While a new request is
 * in flight the previous rows stay (dimmed) so the table never jumps to empty.
 */
export default function AnchorsTable({ page, state, update, onSort, activeCount, onClearAll, viewKey, totalReferringDomains, noAnchorsAtAll }) {
  const [open, setOpen] = useState(null)
  // The open row belongs to the view it was opened in (status, filters, sort, page): when that changes it closes.
  if (open && open.viewKey !== viewKey) setOpen(null)
  const openId = open && open.viewKey === viewKey ? open.id : null
  const toggle = (row) => setOpen(openId === row.id ? null : { id: row.id, viewKey })

  const { rows, total } = page
  const first = (state.page - 1) * state.pageSize + 1
  const typeFiltered = state.types.length > 0
  const showing = total === null ? null
    : total === 0 ? "No anchors"
      : `Showing ${formatExact(first)}–${formatExact(first + page.loadedRows.length - 1)} of ${formatExact(total)} anchors${typeFiltered ? ` · ${formatExact(rows.length)} on this page match the type filter` : ""}`

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
            className={cn("cursor-pointer", isOpen && "bg-muted/40")}
            data-testid="an-row"
            data-type={row.type}
            data-state={isOpen ? "open" : "closed"}
          >
            <TableCell className="sticky left-0 z-[1] bg-card">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggle(row)}
                  aria-expanded={isOpen}
                  aria-label={`Details for ${row.isEmpty ? "the links without anchor text" : `the anchor “${row.anchor}”`}`}
                  className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="an-expand"
                >
                  <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} aria-hidden />
                </button>
                {cell("anchor", row, totalReferringDomains)}
              </div>
            </TableCell>
            {COLUMNS.slice(1).map((c) => <TableCell key={c.key}>{cell(c.key, row, totalReferringDomains)}</TableCell>)}
          </TableRow>
          {isOpen ? (
            <TableRow className="hover:bg-transparent" data-testid="an-expanded-row">
              <TableCell colSpan={COLUMNS.length} className="whitespace-normal bg-muted/20 p-0">
                <PinnedToViewport><div className="p-4"><ExpandedAnchor row={row} status={state.status} /></div></PinnedToViewport>
              </TableCell>
            </TableRow>
          ) : null}
        </Fragment>
      )
    })
  }

  const noMatch = page.status === "success" && rows.length === 0
  return (
    <section className="rounded-xl border border-border/60 bg-card" aria-label="Anchors" data-testid="an-results">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
        <h2 className="text-base font-semibold">Anchors</h2>
        <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="an-showing">{showing ?? <Skel className="inline-block h-4 w-44 align-middle" />}</p>
      </div>
      {typeFiltered ? <p className="px-5 pt-1 text-xs text-muted-foreground">{TYPE_FILTER_HINT}</p> : null}

      {page.status === "error" ? (
        <div className="p-5"><SectionError message={page.error?.message} onRetry={page.refetch} /></div>
      ) : noMatch ? (
        <div className="p-5">
          {noAnchorsAtAll ? (
            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground" data-testid="an-empty" data-kind="none">No anchor data for this domain yet.</div>
          ) : (
            <div className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground" data-testid="an-empty" data-kind="filtered">
              <span>No anchors match these filters</span>
              <Button type="button" variant="outline" size="sm" onClick={onClearAll}>Clear filters</Button>
            </div>
          )}
        </div>
      ) : (
        <div className={cn("transition-opacity", page.stale && "opacity-60")} aria-busy={page.stale || undefined} data-testid="an-table" data-stale={page.stale ? "true" : "false"}>
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c, i) => (i === 0
                  ? <TableHead key={c.key} className="sticky left-0 z-[1] h-auto bg-card py-2 pl-9 align-bottom leading-tight"><span className="inline-flex items-center gap-0.5"><span>{c.label}</span><InfoHint label={c.label} text={c.hint} /></span></TableHead>
                  : <Head key={c.key} column={c} state={state} onSort={onSort} />))}
              </TableRow>
            </TableHeader>
            <TableBody>{body}</TableBody>
          </Table>
        </div>
      )}

      {page.status === "success" && total ? (
        <Pagination page={state.page} pageSize={state.pageSize} total={total} onPage={(p) => update({ page: p })} onPageSize={(pageSize) => update({ pageSize })} loading={page.stale} noun="anchors" maxOffset={MAX_OFFSET} idPrefix="an" />
      ) : null}
    </section>
  )
}
