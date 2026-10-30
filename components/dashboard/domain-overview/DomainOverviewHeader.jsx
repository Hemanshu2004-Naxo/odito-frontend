"use client"

import { Globe, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "../referring-domains/format"
import { Skel } from "./SectionState"

/**
 * Domain, market ("India · English"), when the data was fetched, and the Refresh button (which skips the server cache).
 * `fetchedAt` is when the provider was last asked — the oldest and newest across sections can differ, so the title lists each.
 */
export default function DomainOverviewHeader({ domain, market, updatedAt, updatedDetail, onRefresh, busy, refreshing, refreshNote }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Domain Overview</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground" data-testid="do-meta">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-foreground">
            <Globe className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">Domain: </span>
            <span className="font-medium" data-testid="do-domain">{domain || "—"}</span>
          </span>
          <span data-testid="do-market">{market ? `${market.location} · ${market.language}` : <Skel className="inline-block h-4 w-28 align-middle" />}</span>
          <span data-testid="do-updated" title={updatedDetail || undefined}>
            {updatedAt ? <>Last updated <span className="text-foreground">{formatDateTime(updatedAt)}</span></> : <Skel className="inline-block h-4 w-40 align-middle" />}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy}>
          {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
        {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground sm:text-right" role="status">{refreshNote}</p> : null}
      </div>
    </div>
  )
}
