"use client"

import { Download, Globe, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "../referring-domains/format"
import { Skel } from "../domain-overview/SectionState"

/**
 * Title, domain, market ("India · English"), when the data was fetched, Refresh (skips the server cache for the list on screen and the
 * comparison; the server still refuses to re-buy data fetched within the last minute) and Export CSV (the competitors on screen: no request).
 */
export default function CompetitorsHeader({ domain, market, updatedAt, onRefresh, refreshing, busy, refreshNote, onExport, exportDisabled }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Competitors</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground" data-testid="cp-meta">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-foreground">
            <Globe className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">Domain: </span>
            <span className="font-medium" data-testid="cp-domain">{domain || "—"}</span>
          </span>
          <span data-testid="cp-market">{market ? `${market.location} · ${market.language}` : <Skel className="inline-block h-4 w-28 align-middle" />}</span>
          <span data-testid="cp-updated">
            {updatedAt ? <>Last updated <span className="text-foreground">{formatDateTime(updatedAt)}</span></> : <Skel className="inline-block h-4 w-40 align-middle" />}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy} data-testid="cp-refresh">
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button type="button" variant="outline" onClick={onExport} disabled={exportDisabled} data-testid="cp-export" title="Downloads the competitors on screen">
            <Download className="size-4" aria-hidden /> Export CSV
          </Button>
        </div>
        {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground lg:text-right" role="status">{refreshNote}</p> : null}
      </div>
    </div>
  )
}
