"use client"

import { Globe, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDateTime } from "../referring-domains/format"
import { Skel } from "../domain-overview/SectionState"
import { RANGE_OPTIONS } from "./mapTrafficHistory"

/**
 * Title, domain, market, the range selector, when the data was fetched, and Refresh (which skips the server cache for the window on
 * screen). The selector only changes what is SHOWN for 6 and 12 months; asking for more than has been loaded fetches once.
 */
export default function TrafficHistoryHeader({ domain, market, updatedAt, selected, onSelect, onRefresh, busy, refreshing, loadingMore, refreshNote }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Traffic History</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground" data-testid="th-meta">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-foreground">
            <Globe className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">Domain: </span>
            <span className="font-medium" data-testid="th-domain">{domain || "—"}</span>
          </span>
          <span data-testid="th-market">{market ? `${market.location} · ${market.language}` : <Skel className="inline-block h-4 w-28 align-middle" />}</span>
          <span data-testid="th-updated">
            {updatedAt ? <>Last updated <span className="text-foreground">{formatDateTime(updatedAt)}</span></> : <Skel className="inline-block h-4 w-40 align-middle" />}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5" role="group" aria-label="Date range" data-testid="th-range">
            {RANGE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={selected === n}
                onClick={() => onSelect(n)}
                title={n === 24 ? "Loads 24 months of data the first time you pick it" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
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
        {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground lg:text-right" role="status">{refreshNote}</p> : null}
      </div>
    </div>
  )
}
