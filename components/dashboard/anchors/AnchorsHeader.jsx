"use client"

import { ChevronDown, Download, Globe, Loader2, RefreshCw, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDateTime } from "../referring-domains/format"
import { Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { Segmented } from "../traffic-history/DistributionChart"
import { STATUSES } from "./constants"

/**
 * Title, domain, "Last updated", Refresh (skips the server cache for the table and the profile; the server still refuses to re-buy data
 * fetched in the last minute), "Anchor settings", Export CSV, and the Live / Lost / All control (the TABLE only: the cards and charts always
 * describe the live profile).
 */
export default function AnchorsHeader({
  domain, updatedAt, status, onStatus, onRefresh, refreshing, busy, refreshNote, rowCount, profileCount, exportPageDisabled, exportAllDisabled,
  onExportPage, onExportAll, onSettings,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Anchors</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground" data-testid="an-meta">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-foreground">
              <Globe className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="sr-only">Domain: </span>
              <span className="font-medium" data-testid="an-domain">{domain || "—"}</span>
            </span>
            <span data-testid="an-updated">
              {updatedAt ? <>Last updated <span className="text-foreground">{formatDateTime(updatedAt)}</span></> : <Skel className="inline-block h-4 w-40 align-middle" />}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={onSettings} data-testid="an-settings">
              <Settings2 className="size-4" aria-hidden /> Anchor settings
            </Button>
            <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy} data-testid="an-refresh">
              {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" data-testid="an-export">
                  <Download className="size-4" aria-hidden /> Export CSV <ChevronDown className="size-4 opacity-60" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem onSelect={onExportPage} disabled={exportPageDisabled} data-testid="an-export-page">
                  <div>
                    <div className="font-medium">Export current page</div>
                    <div className="text-xs text-muted-foreground">{formatExact(rowCount)} anchors on screen · no new request</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onExportAll} disabled={exportAllDisabled} data-testid="an-export-all">
                  <div>
                    <div className="font-medium">Export all anchors (up to 1,000)</div>
                    <div className="text-xs text-muted-foreground">{formatExact(profileCount)} anchors from the profile · no new request</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground lg:text-right" role="status">{refreshNote}</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented label="Which links the table shows" options={STATUSES.map((s) => ({ value: s.id, label: s.label }))} value={status} onChange={onStatus} />
        <span className="text-xs text-muted-foreground">Applies to the table below; the cards and charts describe live links.</span>
      </div>
    </div>
  )
}
