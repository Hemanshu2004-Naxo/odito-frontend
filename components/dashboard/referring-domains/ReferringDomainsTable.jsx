"use client"

import Link from "next/link"
import { Fragment, useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "./InfoHint"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { DateCell, PlacementChip, RankCell, SpamBadge } from "../backlinks/cells"
import Pagination from "../organic-keywords/Pagination"
import { effectiveSort } from "./buildReferringDomainRequest"
import { MAX_OFFSET, QUALITY_FILTER_HINT, SORT_COLUMNS } from "./constants"
import { BacklinksCell, BrokenCell, DofollowCell, DomainCell, QualityChip } from "./cells"
import ExpandedDomain, { backlinksHref } from "./ExpandedDomain"

const COLUMNS = [
  { key: "quality", label: "Quality", hint: "Our rating of the domain from its rank, spam score and how many of its links are dofollow. Toxic = spam above 30, or a low-rank domain with 100+ almost-all-nofollow links." },
  { key: "rank", label: "Rank", sort: "rank", hint: "The domain's link rank, 0–1000 (higher = stronger)." },
  { key: "backlinks", label: "Backlinks", sort: "backlinks", hint: "How many links the domain has to your site, and from how many of its pages." },
  { key: "dofollow", label: "Dofollow", hint: "The share of its referring pages that pass ranking credit." },
  { key: "spam", label: "Spam", sort: "spam", hint: "How likely the links are to be spam, 0–100. 0–10 Low, 11–30 Medium, 31+ High." },
  { key: "placement", label: "Placement", hint: "Where on its pages the domain's links mostly sit. Links inside article content are usually worth more than footer or sidebar links." },
  { key: "broken", label: "Broken", sort: "broken", hint: "Links from this domain that point to pages on your site that return errors." },
  { key: "date", label: "First seen", sort: "firstSeen", hint: "When a link from this domain was first found. On the Lost tab: when it was lost." },
]

/** Header sort options for the "Sort by" control (the provider's six sortable fields). */
export const SORT_OPTIONS = Object.freeze([
  { field: "rank", label: "Rank" }, { field: "backlinks", label: "Backlinks" }, { field: "referring_pages", label: "Referring pages" },
  { field: "backlinks_spam_score", label: "Spam score" }, { field: "broken_backlinks", label: "Broken backlinks" }, { field: "first_seen", label: "First seen" },
])

function SortHead({ column, state, onSort, label }) {
  const rule = effectiveSort(state)
  const field = SORT_COLUMNS[column.sort]
  const active = rule.field === field
  const Icon = !active ? ArrowUpDown : rule.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(column.sort)}
      className={cn("inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "text-foreground" : "text-foreground/80")}
      aria-label={`Sort by ${label}${active ? `, currently ${rule.dir === "asc" ? "ascending" : "descending"}` : ""}`}
      data-testid={`rd-sort-${column.sort}`}
    >
      {label}
      <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
    </button>
  )
}

function Head({ column, state, onSort, sortable }) {
  const rule = effectiveSort(state)
  const primary = sortable && column.sort && rule.field === SORT_COLUMNS[column.sort] ? rule.dir : null
  const label = column.key === "date" && state.tab === "lost" ? "Lost date" : column.label
  return (
    <TableHead aria-sort={primary ? (primary === "asc" ? "ascending" : "descending") : undefined} className="h-auto whitespace-normal py-2 align-bottom leading-tight">
      <span className="inline-flex items-center gap-0.5">
        {sortable && column.sort ? <SortHead column={column} state={state} onSort={onSort} label={label} /> : <span>{label}</span>}
        <InfoHint label={label} text={column.hint} />
      </span>
    </TableHead>
  )
}

function cell(key, row, tab) {
  if (row.noLiveLinks) return <span className="text-muted-foreground">—</span>
  switch (key) {
    case "quality": return <QualityChip row={row} />
    case "rank": return <RankCell value={row.rank} label="Rank" />
    case "backlinks": return <BacklinksCell row={row} />
    case "dofollow": return <DofollowCell row={row} />
    case "spam": return <SpamBadge score={row.spamScore} band={row.spamBand} />
    case "placement": return row.mainPlacement ? <PlacementChip label={row.mainPlacement.label} /> : <span className="text-muted-foreground">—</span>
    case "broken": return <BrokenCell row={row} />
    case "date": return <DateCell value={tab === "lost" ? row.lostDate : row.firstSeen} />
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
const fromInteractive = (e) => Boolean(e.target.closest("a, button, input, select, textarea, [role=menuitem], [role=checkbox]"))

function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }, (_, i) => (
    <TableRow key={i} aria-hidden data-testid="rd-skeleton-row">
      <TableCell className="w-8"><Skel className="size-4" /></TableCell>
      <TableCell className="min-w-[180px]"><Skel className="h-5 w-40" /></TableCell>
      {COLUMNS.map((c) => <TableCell key={c.key}><Skel className="h-5 w-16" /></TableCell>)}
      <TableCell className="w-10" />
    </TableRow>
  ))
}

function RowActions({ row, onAction, busy }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${row.domain}`} data-testid="rd-actions">
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {!row.noLiveLinks ? (
          <DropdownMenuItem asChild data-testid="rd-action-view">
            <Link href={backlinksHref(row.domain)}>View backlinks</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => onAction(row.disavowed ? "undisavow" : "disavow", row)} disabled={busy} data-testid={row.disavowed ? "rd-action-undisavow" : "rd-action-disavow"}>
          {row.disavowed ? "Remove from disavow" : "Disavow"}
        </DropdownMenuItem>
        {!row.noLiveLinks ? (
          <DropdownMenuItem onSelect={() => onAction(row.reviewed ? "unmarkOk" : "markOk", row)} disabled={busy} data-testid={row.reviewed ? "rd-action-unmark" : "rd-action-ok"}>
            {row.reviewed ? "Remove OK mark" : "Mark as OK"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function emptyMessage({ state, noFilters, listEmpty }) {
  if (state.tab === "disavowed" && listEmpty) return { kind: "none", text: "Your disavow list is empty." }
  if (!noFilters) return { kind: "filtered", text: "No domains match these filters" }
  if (state.tab === "toxic") return { kind: "success", text: "No toxic domains found." }
  if (state.tab === "new") return { kind: "none", text: "No new referring domains in the last 30 days." }
  if (state.tab === "lost") return { kind: "none", text: "No lost referring domains." }
  return { kind: "none", text: "No referring domains found for this domain yet." }
}

/**
 * The results panel: the "Showing x–y of N referring domains" line, the sortable table with checkboxes, an actions menu and expandable rows,
 * and the pagination. While a new request is in flight the previous rows stay (dimmed) so the table never jumps to empty.
 */
export default function ReferringDomainsTable({
  page, state, update, onSort, viewKey, noFilters, listEmpty, onClearAll, onAction, saving, selected, onToggleSelect, onToggleAll,
}) {
  const [open, setOpen] = useState(null)
  // The open row belongs to the view it was opened in (tab, filters, sort, page): when that changes it closes.
  if (open && open.viewKey !== viewKey) setOpen(null)
  const openId = open && open.viewKey === viewKey ? open.id : null
  const toggle = (row) => setOpen(openId === row.id ? null : { id: row.id, viewKey })

  const disavowedTab = state.tab === "disavowed"
  const sortable = !disavowedTab
  const { rows, total } = page
  const first = (state.page - 1) * state.pageSize + 1
  const qualityFiltered = state.quality.length > 0
  const showing = total === null ? null
    : total === 0 ? "No referring domains"
      : `Showing ${formatExact(first)}–${formatExact(first + page.loadedRows.length - 1)} of ${formatExact(total)} referring domains${qualityFiltered ? ` · ${formatExact(rows.length)} on this page match the quality filter` : ""}`
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.domain))
  const some = rows.some((r) => selected.has(r.domain))
  const rule = effectiveSort(state)

  let body
  if (page.status === "loading") body = <SkeletonRows />
  else if (page.status === "error") body = null
  else {
    body = rows.map((row) => {
      const isOpen = openId === row.id
      return (
        <Fragment key={row.id}>
          <TableRow
            onClick={(e) => { if (!fromInteractive(e) && !row.noLiveLinks) toggle(row) }}
            className={cn(!row.noLiveLinks && "cursor-pointer", isOpen && "bg-muted/40", row.toxicWarning && "bg-red-50/70 dark:bg-red-500/5")}
            data-testid="rd-row"
            data-quality={row.quality ?? ""}
            data-toxic-warning={row.toxicWarning ? "true" : "false"}
            data-state={isOpen ? "open" : "closed"}
          >
            <TableCell className="w-8">
              <input type="checkbox" checked={selected.has(row.domain)} onChange={() => onToggleSelect(row.domain)} aria-label={`Select ${row.domain}`} className="size-4 cursor-pointer" data-testid="rd-select" />
            </TableCell>
            <TableCell className="sticky left-8 z-[1] bg-card">
              <div className="flex items-center gap-1.5">
                {!row.noLiveLinks ? (
                  <button
                    type="button"
                    onClick={() => toggle(row)}
                    aria-expanded={isOpen}
                    aria-label={`Details for ${row.domain}`}
                    className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="rd-expand"
                  >
                    <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} aria-hidden />
                  </button>
                ) : <span className="size-6 shrink-0" aria-hidden />}
                <DomainCell row={row} />
              </div>
            </TableCell>
            {COLUMNS.map((c) => <TableCell key={c.key}>{cell(c.key, row, state.tab)}</TableCell>)}
            <TableCell className="w-10"><RowActions row={row} onAction={onAction} busy={saving} /></TableCell>
          </TableRow>
          {isOpen ? (
            <TableRow className="hover:bg-transparent" data-testid="rd-expanded-row">
              <TableCell colSpan={COLUMNS.length + 3} className="whitespace-normal bg-muted/20 p-0">
                <PinnedToViewport><div className="p-4"><ExpandedDomain row={row} /></div></PinnedToViewport>
              </TableCell>
            </TableRow>
          ) : null}
        </Fragment>
      )
    })
  }

  const noMatch = page.status === "success" && page.loadedRows.length === 0 && total === 0
  const typeOnlyEmpty = page.status === "success" && rows.length === 0 && page.loadedRows.length > 0
  const empty = noMatch ? emptyMessage({ state, noFilters, listEmpty }) : typeOnlyEmpty ? { kind: "filtered", text: "No domains match these filters" } : null

  return (
    <section className="rounded-xl border border-border/60 bg-card" aria-label="Referring domains" data-testid="rd-results">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
        <h2 className="text-base font-semibold">Referring domains</h2>
        <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="rd-showing">{showing ?? <Skel className="inline-block h-4 w-44 align-middle" />}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 pt-1">
        {qualityFiltered ? <p className="text-xs text-muted-foreground" data-testid="rd-quality-note">{QUALITY_FILTER_HINT}</p> : <span />}
        {sortable ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort by</span>
            <select
              value={rule.field}
              onChange={(e) => update({ sort: { field: e.target.value, dir: rule.dir } })}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="rd-sort-select"
            >
              {SORT_OPTIONS.map((o) => <option key={o.field} value={o.field}>{o.label}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => update({ sort: { field: rule.field, dir: rule.dir === "desc" ? "asc" : "desc" } })} aria-label={`Direction: ${rule.dir === "desc" ? "highest first" : "lowest first"}. Click to flip.`} data-testid="rd-sort-dir">
              {rule.dir === "desc" ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUp className="size-3.5" aria-hidden />} {rule.dir === "desc" ? "High to low" : "Low to high"}
            </Button>
          </label>
        ) : null}
      </div>

      {page.status === "error" ? (
        <div className="p-5"><SectionError message={page.error?.message} onRetry={page.refetch} /></div>
      ) : empty ? (
        <div className="p-5">
          {empty.kind === "filtered" ? (
            <div className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground" data-testid="rd-empty" data-kind="filtered">
              <span>{empty.text}</span>
              <Button type="button" variant="outline" size="sm" onClick={onClearAll}>Clear filters</Button>
            </div>
          ) : empty.kind === "success" ? (
            <div className="flex min-h-24 items-center justify-center gap-2 rounded-lg border border-emerald-300/70 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100" data-testid="rd-empty" data-kind="success">
              <CheckCircle2 className="size-4" aria-hidden />{empty.text}
            </div>
          ) : (
            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground" data-testid="rd-empty" data-kind="none">{empty.text}</div>
          )}
        </div>
      ) : (
        <div className={cn("mt-2 transition-opacity", page.stale && "opacity-60")} aria-busy={page.stale || undefined} data-testid="rd-table" data-stale={page.stale ? "true" : "false"}>
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = some && !allSelected }}
                    onChange={() => onToggleAll(rows.map((r) => r.domain), !allSelected)}
                    aria-label="Select all domains on this page"
                    className="size-4 cursor-pointer"
                    data-testid="rd-select-all"
                  />
                </TableHead>
                <TableHead className="sticky left-8 z-[1] h-auto bg-card py-2 pl-9 align-bottom leading-tight">Domain</TableHead>
                {COLUMNS.map((c) => <Head key={c.key} column={c} state={state} onSort={onSort} sortable={sortable} />)}
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{body}</TableBody>
          </Table>
        </div>
      )}

      {page.status === "success" && total ? (
        <Pagination page={state.page} pageSize={state.pageSize} total={total} onPage={(p) => update({ page: p })} onPageSize={(pageSize) => update({ pageSize })} loading={page.stale} noun="referring domains" maxOffset={MAX_OFFSET} idPrefix="rd" />
      ) : null}
    </section>
  )
}
