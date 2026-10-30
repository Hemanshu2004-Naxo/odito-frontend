"use client"

import { ChevronDown, Download, Globe, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDateTime } from "../referring-domains/format"
import { Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { estimateExport } from "../backlinks/exportCsv"

/**
 * Title, domain, "Last updated", Refresh (skips the server cache for the table on screen; the server still refuses to re-buy data fetched in the last
 * minute; the profile cards and the traffic keep their 7-day cache) and Export CSV (the rows on screen, no request — or everything matching the current
 * filters, fetched by the server in batches, which asks for confirmation with the cost first).
 */
export default function TopPagesHeader({ domain, updatedAt, onRefresh, refreshing, busy, refreshNote, rowCount, total, exportPageDisabled, exportAllDisabled, onExportPage, onExportAll }) {
  const plan = estimateExport(total)
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Top Pages</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground" data-testid="tp-meta">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-foreground">
            <Globe className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">Domain: </span>
            <span className="font-medium" data-testid="tp-domain">{domain || "—"}</span>
          </span>
          <span data-testid="tp-updated">
            {updatedAt ? <>Last updated <span className="text-foreground">{formatDateTime(updatedAt)}</span></> : <Skel className="inline-block h-4 w-40 align-middle" />}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy} data-testid="tp-refresh">
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" data-testid="tp-export">
                <Download className="size-4" aria-hidden /> Export CSV <ChevronDown className="size-4 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuItem onSelect={onExportPage} disabled={exportPageDisabled} data-testid="tp-export-page">
                <div>
                  <div className="font-medium">Export current page</div>
                  <div className="text-xs text-muted-foreground">{formatExact(rowCount)} pages on screen · no new request</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportAll} disabled={exportAllDisabled || !plan.rows} data-testid="tp-export-all">
                <div>
                  <div className="font-medium">Export with current filters</div>
                  <div className="text-xs text-muted-foreground">
                    {plan.capped ? `The first ${formatExact(plan.rows)} of ${formatExact(total)} · ` : plan.rows ? `${formatExact(plan.rows)} pages · ` : ""}you confirm the cost first
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground lg:text-right" role="status">{refreshNote}</p> : null}
      </div>
    </div>
  )
}
