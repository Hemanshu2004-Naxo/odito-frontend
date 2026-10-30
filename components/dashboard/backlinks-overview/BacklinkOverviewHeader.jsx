"use client"

import { useId } from "react"
import { Globe, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { formatDateTime } from "../referring-domains/format"
import { Skel } from "../domain-overview/SectionState"
import { Segmented } from "../traffic-history/DistributionChart"

export const STATUS_OPTIONS = [
  { value: "live", label: "Live" },
  { value: "lost", label: "Lost" },
  { value: "all", label: "All" },
]

/**
 * Title, domain, "Last updated", Refresh (skips the server cache for the request on screen; the server still refuses to re-buy data fetched
 * in the last minute) and the two controls: Live / Lost / All (backlinks_status_type) and "Dofollow only" (backlinks_filters).
 * A Lost view carries a banner, because every figure on the page then describes links that no longer exist.
 */
export default function BacklinkOverviewHeader({ domain, updatedAt, state, update, onRefresh, refreshing, busy, refreshNote }) {
  const id = useId()
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Backlink Overview</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground" data-testid="bo-meta">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-foreground">
              <Globe className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="sr-only">Domain: </span>
              <span className="font-medium" data-testid="bo-domain">{domain || "—"}</span>
            </span>
            <span data-testid="bo-updated">
              {updatedAt ? <>Last updated <span className="text-foreground">{formatDateTime(updatedAt)}</span></> : <Skel className="inline-block h-4 w-40 align-middle" />}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy} data-testid="bo-refresh">
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground lg:text-right" role="status">{refreshNote}</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3" data-testid="bo-controls">
        <Segmented label="Which links to count" value={state.status} onChange={(status) => update({ status })} options={STATUS_OPTIONS} />
        <div className="flex items-center gap-2.5">
          <Switch id={`${id}-dofollow`} checked={state.dofollow} onCheckedChange={(dofollow) => update({ dofollow })} data-testid="bo-dofollow" />
          <label htmlFor={`${id}-dofollow`} className="cursor-pointer text-sm font-medium">Dofollow only</label>
        </div>
        {busy ? <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status"><Loader2 className="size-3.5 animate-spin" aria-hidden />Updating…</span> : null}
      </div>

      {state.status === "lost" ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" role="status" data-testid="bo-lost-banner">
          Showing links that were removed or no longer found.
        </p>
      ) : null}
    </div>
  )
}
