"use client"

import Link from "next/link"
import { ChevronDown, Download, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDateTime } from "../referring-domains/format"
import { Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { estimateExport } from "../backlinks/exportCsv"

/**
 * Breadcrumb, title, domain and when it was updated; on the right what the page is about ("… · 84 pages"), Refresh (skips the server cache for the table on screen; the server still refuses to re-buy data fetched in the last
 * minute; the profile cards and the traffic keep their 7-day cache) and Export CSV (the rows on screen, no request — or everything matching the current
 * filters, fetched by the server in batches, which asks for confirmation with the cost first).
 */
export default function TopPagesHeader({ domain, updatedAt, pageCount, onRefresh, refreshing, busy, refreshNote, rowCount, total, exportPageDisabled, exportAllDisabled, onExportPage, onExportAll }) {
  const plan = estimateExport(total)
  return (
    <div className="flex flex-col gap-4 @min-[900px]/main:flex-row @min-[900px]/main:items-end @min-[900px]/main:justify-between">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/app/dashboard" className="hover:text-foreground hover:underline underline-offset-2">Dashboard</Link></li>
            <li aria-hidden>/</li><li>SEO</li><li aria-hidden>/</li><li>Off-page</li>
          </ol>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Top linked pages</h1>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="tp-meta">
          <span className="sr-only">Domain: </span><span className="font-medium text-foreground" data-testid="tp-domain">{domain || "—"}</span>
          <span data-testid="tp-updated">{updatedAt ? <> · updated {formatDateTime(updatedAt)}</> : <Skel className="ml-2 inline-block h-3.5 w-36 align-middle" />}</span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 @min-[900px]/main:items-end">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground" data-testid="tp-about">Your pages that other sites link to{typeof pageCount === "number" ? ` · ${formatExact(pageCount)} pages` : ""}</span>
          <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy} data-testid="tp-refresh">
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="font-semibold" data-testid="tp-export">
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
        {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground @min-[900px]/main:text-right" role="status">{refreshNote}</p> : null}
      </div>
    </div>
  )
}
