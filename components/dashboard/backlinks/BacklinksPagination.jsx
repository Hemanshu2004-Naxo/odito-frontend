"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { formatExact } from "../domain-overview/format"
import { pageWindow } from "../organic-keywords/Pagination"
import { OFFSET_WINDOW, PAGE_SIZES, lastNumberedPage } from "./constants"

export const LOAD_MORE_HINT = `The data provider only lets you jump to a page number within the first ${OFFSET_WINDOW.toLocaleString("en-US")} backlinks. Beyond that, links are loaded in batches, each one continuing exactly where the previous one ended.`

/**
 * Numbered pages while offset + limit stays within the provider's 20,000-row window (page size 25 / 50 / 100, "Go to page"). When more
 * links match than that window holds, the last numbered page is followed by a "Load more" button that continues from the previous
 * response's search_after_token and appends the next batch.
 */
export default function BacklinksPagination({ page, pageSize, total, onPage, onPageSize, loading, nextToken, loadMore, loadingMore, moreError }) {
  const [goto, setGoto] = useState("")
  if (total === null || total === undefined) return null
  const window = lastNumberedPage(pageSize)
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const reachable = Math.min(lastPage, window)
  const beyondWindow = lastPage > window
  const atEnd = page >= reachable

  const go = () => {
    const n = Number(goto)
    if (Number.isInteger(n) && n >= 1 && n <= reachable) { onPage(n); setGoto("") }
  }
  const gotoInvalid = goto !== "" && !(Number.isInteger(Number(goto)) && Number(goto) >= 1 && Number(goto) <= reachable)

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-3 text-sm text-muted-foreground" data-testid="bl-pagination">
      <div className="flex flex-col gap-3 @min-[900px]/main:flex-row @min-[900px]/main:items-center @min-[900px]/main:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="bl-page-size"
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {loading ? <Loader2 className="size-4 animate-spin" aria-label="Loading page" /> : null}
        </div>

        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Pagination">
          <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft className="size-4" aria-hidden /> Previous</Button>
          {pageWindow(page, reachable).map((p, i) => (p === "…"
            ? <span key={`gap-${i}`} className="px-1" aria-hidden>…</span>
            : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cn("h-8 min-w-8 rounded-md border px-2 text-sm font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", p === page ? "border-foreground bg-foreground text-background" : "border-border/70 bg-card text-foreground hover:bg-muted")}
              >
                {p}
              </button>
            )))}
          <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= reachable} aria-label="Next page">Next <ChevronRight className="size-4" aria-hidden /></Button>
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={(e) => { e.preventDefault(); go() }} className="flex items-center gap-2">
          <label htmlFor="bl-goto" className="whitespace-nowrap">Go to page</label>
          <Input id="bl-goto" inputMode="numeric" value={goto} onChange={(e) => setGoto(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} aria-invalid={gotoInvalid || undefined} placeholder={`1–${reachable}`} className="h-8 w-24" />
          <Button type="submit" variant="outline" size="sm" disabled={!goto || gotoInvalid}>Go</Button>
        </form>

        {beyondWindow && atEnd ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="bl-load-more-box">
            {moreError ? <span role="alert" className="text-xs text-red-600 dark:text-red-400">{moreError.message}</span> : null}
            {nextToken || moreError ? (
              <Button type="button" variant="outline" onClick={moreError ? moreError.retry : loadMore} disabled={loadingMore} data-testid="bl-load-more">
                {loadingMore ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {moreError ? "Retry" : "Load more"}
              </Button>
            ) : <span className="text-xs" data-testid="bl-end-of-list">That is every backlink the data provider can list for these filters.</span>}
            <InfoHint label="Load more" text={LOAD_MORE_HINT} />
          </div>
        ) : beyondWindow ? (
          <p className="text-xs" data-testid="bl-window-note">{formatExact(total)} backlinks match. Page numbers cover the first {formatExact(window * pageSize)}; after that, use &ldquo;Load more&rdquo;.</p>
        ) : null}
      </div>
    </div>
  )
}
