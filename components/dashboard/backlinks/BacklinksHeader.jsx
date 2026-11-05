"use client"

import Link from "next/link"
import { ChevronDown, Download, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDateTime } from "../referring-domains/format"
import { Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { estimateExport } from "./exportCsv"

/**
 * Breadcrumb, title and domain; on the right "Updated …", Refresh (skips the server cache for the page on screen; the server still refuses to re-buy data fetched in
 * the last minute) and Export. Export has two ways: the rows on screen (no request), or everything matching the current tab and filters,
 * fetched by the server in batches — which asks for confirmation (with the cost) first.
 */
export default function BacklinksHeader({ domain, updatedAt, onRefresh, refreshing, busy, refreshNote, rowCount, total, exportDisabled, onExportPage, onExportAll }) {
  const plan = estimateExport(total)
  return (
    <div className="flex flex-col gap-4 @min-[800px]/main:flex-row @min-[800px]/main:items-end @min-[800px]/main:justify-between">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/app/dashboard" className="hover:text-foreground hover:underline underline-offset-2">Dashboard</Link></li>
            <li aria-hidden>/</li><li>SEO</li><li aria-hidden>/</li><li>Off-page</li>
          </ol>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Backlinks</h1>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="bl-meta">
          <span className="sr-only">Domain: </span><span className="font-medium text-foreground" data-testid="bl-domain">{domain || "—"}</span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 @min-[800px]/main:items-end">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground" data-testid="bl-updated">
            {updatedAt ? <>Updated {formatDateTime(updatedAt)}</> : <Skel className="inline-block h-3.5 w-36 align-middle" />}
          </span>
          <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy} data-testid="bl-refresh">
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" disabled={exportDisabled} className="bg-emerald-400 font-semibold text-[#0d1a3a] hover:bg-emerald-300" data-testid="bl-export">
                <Download className="size-4" aria-hidden /> Export <ChevronDown className="size-4 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuItem onSelect={onExportPage} disabled={!rowCount} data-testid="bl-export-page">
                <div>
                  <div className="font-medium">Export current page</div>
                  <div className="text-xs text-muted-foreground">{formatExact(rowCount)} backlinks on screen · no new request</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportAll} disabled={!plan.rows} data-testid="bl-export-all">
                <div>
                  <div className="font-medium">Export with current filters</div>
                  <div className="text-xs text-muted-foreground">
                    {plan.capped ? `The first ${formatExact(plan.rows)} of ${formatExact(total)} · ` : plan.rows ? `${formatExact(plan.rows)} backlinks · ` : ""}you confirm the cost first
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground @min-[800px]/main:text-right" role="status">{refreshNote}</p> : null}
      </div>
    </div>
  )
}
