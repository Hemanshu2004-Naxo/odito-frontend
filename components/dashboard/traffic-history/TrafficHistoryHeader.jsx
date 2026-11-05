"use client"

import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDate } from "../referring-domains/format"
import { Skel } from "../domain-overview/SectionState"
import { RANGE_OPTIONS } from "./mapTrafficHistory"

/**
 * Breadcrumb + title with the range selector and Refresh on the right, then one meta line: domain · market · when the data was fetched ·
 * the months shown. The selector only changes what is SHOWN for 6 and 12 months; asking for more than has been loaded fetches once.
 */
export default function TrafficHistoryHeader({ domain, market, updatedAt, selected, onSelect, onRefresh, busy, refreshing, loadingMore, refreshNote, shownFrom, shownTo }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 @min-[800px]/main:flex-row @min-[800px]/main:items-end @min-[800px]/main:justify-between">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link href="/app/dashboard" className="hover:text-foreground hover:underline underline-offset-2">Dashboard</Link></li>
              <li aria-hidden>/</li>
              <li>SEO</li>
              <li aria-hidden>/</li>
              <li aria-current="page">Rankings &amp; traffic</li>
            </ol>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Traffic</h1>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1.5 @min-[800px]/main:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-muted/70 p-1" role="group" aria-label="Date range" data-testid="th-range">
              {RANGE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={selected === n}
                  onClick={() => onSelect(n)}
                  title={n === 24 ? "Loads 24 months of data the first time you pick it" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected === n ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n} months
                </button>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy}>
              {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          {loadingMore ? <p className="text-xs text-muted-foreground" role="status">Loading {selected} months of history…</p> : null}
          {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground @min-[800px]/main:text-right" role="status">{refreshNote}</p> : null}
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground" data-testid="th-meta">
        <span className="sr-only">Domain: </span>
        <span className="font-medium text-foreground" data-testid="th-domain">{domain || "—"}</span>
        <span aria-hidden>·</span>
        <span data-testid="th-market">{market ? `Google ${market.location}, ${market.language}` : <Skel className="inline-block h-4 w-28 align-middle" />}</span>
        <span aria-hidden>·</span>
        <span data-testid="th-updated">
          {updatedAt ? <>estimated from rankings, updated {formatDate(updatedAt)}</> : <Skel className="inline-block h-4 w-40 align-middle" />}
        </span>
        {shownFrom && shownTo ? <><span aria-hidden>·</span><span data-testid="th-shown">Showing {shownFrom} – {shownTo}</span></> : null}
      </p>
    </div>
  )
}
