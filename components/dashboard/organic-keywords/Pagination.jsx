"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatExact } from "../domain-overview/format"
import { MAX_OFFSET, PAGE_SIZES } from "./constants"

/** [1, "…", 4, 5, 6, "…", 40]: the first and last page, the current one and its neighbours. */
export function pageWindow(page, last) {
  const keep = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last))
  const sorted = [...keep].sort((a, b) => a - b)
  const out = []
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : "…")
    out.push(p)
  })
  return out
}

/**
 * Paging driven by the server's `total_count` for the CURRENT filters. Page size, previous / next, numbered pages and "Go to page".
 * The deepest page that can be requested is limited by the provider's offset cap; past it the footer says so instead of offering a
 * page that would fail.
 */
export default function Pagination({ page, pageSize, total, onPage, onPageSize, loading, noun = "keywords", maxOffset = MAX_OFFSET, idPrefix = "ok" }) {
  const [goto, setGoto] = useState("")
  if (total === null || total === undefined) return null
  // `maxOffset` is the deepest offset the provider answers (the Organic Keywords' is 9,999; the Anchors page's window is 20,000).
  const reachable = Math.min(Math.max(1, Math.ceil(total / pageSize)), Math.floor(maxOffset / pageSize) + 1)
  const capped = Math.ceil(total / pageSize) > reachable

  const go = () => {
    const n = Number(goto)
    if (Number.isInteger(n) && n >= 1 && n <= reachable) { onPage(n); setGoto("") }
  }
  const gotoInvalid = goto !== "" && !(Number.isInteger(Number(goto)) && Number(goto) >= 1 && Number(goto) <= reachable)

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-3 text-sm text-muted-foreground" data-testid={`${idPrefix}-pagination`}>
      <div className="flex flex-col gap-3 @min-[900px]/main:flex-row @min-[900px]/main:items-center @min-[900px]/main:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`${idPrefix}-page-size`}
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {loading ? <Loader2 className="size-4 animate-spin" aria-label="Loading page" /> : null}
        </div>

        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Pagination">
          <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Button>
          {pageWindow(page, reachable).map((p, i) => (p === "…"
            ? <span key={`gap-${i}`} className="px-1" aria-hidden>…</span>
            : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "h-8 min-w-8 rounded-md border px-2 text-sm font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  p === page ? "border-foreground bg-foreground text-background" : "border-border/70 bg-card text-foreground hover:bg-muted",
                )}
              >
                {p}
              </button>
            )))}
          <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= reachable} aria-label="Next page">
            Next <ChevronRight className="size-4" aria-hidden />
          </Button>
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <form onSubmit={(e) => { e.preventDefault(); go() }} className="flex items-center gap-2">
          <label htmlFor={`${idPrefix}-goto`} className="whitespace-nowrap">Go to page</label>
          <Input id={`${idPrefix}-goto`} inputMode="numeric" value={goto} onChange={(e) => setGoto(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} aria-invalid={gotoInvalid || undefined} placeholder={`1–${reachable}`} className="h-8 w-20" />
          <Button type="submit" variant="outline" size="sm" disabled={!goto || gotoInvalid}>Go</Button>
        </form>
        {capped ? (
          <p className="text-xs" data-testid={`${idPrefix}-depth-note`}>
            Only the first {formatExact(maxOffset + 1)} {noun} for this sort can be browsed. Narrow the filters to see the rest.
          </p>
        ) : null}
      </div>
    </div>
  )
}
