"use client"

import { ChevronDown, Download, FileText, Globe, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDateTime } from "./format"
import { Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { estimateExport } from "../backlinks/exportCsv"

/**
 * Title, domain, "Last updated", Refresh (skips the server cache for the table on screen; the server still refuses to re-buy data fetched in
 * the last minute; the two profile cards keep their 7-day cache), Export CSV (the rows on screen, no request — or everything matching the current
 * filters, fetched by the server in batches, which asks for confirmation with the cost first) and "Export disavow file".
 */
export default function ReferringDomainsHeader({
  domain, updatedAt, onRefresh, refreshing, busy, refreshNote, rowCount, total, exportPageDisabled, exportAllDisabled, disavowCount,
  onExportPage, onExportAll, onExportDisavow,
}) {
  const plan = estimateExport(total)
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Referring Domains</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground" data-testid="rd-meta">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-foreground">
            <Globe className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">Domain: </span>
            <span className="font-medium" data-testid="rd-domain">{domain || "—"}</span>
          </span>
          <span data-testid="rd-updated">
            {updatedAt ? <>Last updated <span className="text-foreground">{formatDateTime(updatedAt)}</span></> : <Skel className="inline-block h-4 w-40 align-middle" />}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy} data-testid="rd-refresh">
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" data-testid="rd-export">
                <Download className="size-4" aria-hidden /> Export CSV <ChevronDown className="size-4 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuItem onSelect={onExportPage} disabled={exportPageDisabled} data-testid="rd-export-page">
                <div>
                  <div className="font-medium">Export current page</div>
                  <div className="text-xs text-muted-foreground">{formatExact(rowCount)} domains on screen · no new request</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportAll} disabled={exportAllDisabled || !plan.rows} data-testid="rd-export-all">
                <div>
                  <div className="font-medium">Export with current filters</div>
                  <div className="text-xs text-muted-foreground">
                    {plan.capped ? `The first ${formatExact(plan.rows)} of ${formatExact(total)} · ` : plan.rows ? `${formatExact(plan.rows)} domains · ` : ""}you confirm the cost first
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant="outline" onClick={onExportDisavow} disabled={disavowCount === 0} title={disavowCount === 0 ? "Your disavow list is empty" : undefined} data-testid="rd-export-disavow">
            <FileText className="size-4" aria-hidden /> Export disavow file
          </Button>
        </div>
        {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground lg:text-right" role="status">{refreshNote}</p> : null}
      </div>
    </div>
  )
}
