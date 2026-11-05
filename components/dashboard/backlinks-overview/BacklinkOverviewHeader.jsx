"use client"

import { useId } from "react"
import Link from "next/link"
import { Download, Loader2, RefreshCw } from "lucide-react"
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
 * Breadcrumb + title; on the right when the data was fetched and how old the profile is, Refresh (skips the server cache for the request on
 * screen; the server still refuses to re-buy data fetched in the last minute) and Download PDF (the browser's print dialog, "Save as PDF").
 * Under it the two controls: Live / Lost / All (backlinks_status_type) and "Dofollow only" (backlinks_filters). A Lost view carries a banner,
 * because every figure on the page then describes links that no longer exist.
 */
export default function BacklinkOverviewHeader({ domain, updatedAt, since, state, update, onRefresh, refreshing, busy, refreshNote }) {
  const id = useId()
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 @min-[800px]/main:flex-row @min-[800px]/main:items-end @min-[800px]/main:justify-between">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link href="/app/dashboard" className="hover:text-foreground hover:underline underline-offset-2">Dashboard</Link></li>
              <li aria-hidden>/</li><li>SEO</li><li aria-hidden>/</li><li aria-current="page">Off-page</li>
            </ol>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Backlink overview</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="bo-meta">
            <span className="sr-only">Domain: </span><span className="font-medium text-foreground" data-testid="bo-domain">{domain || "—"}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1.5 @min-[800px]/main:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs leading-relaxed text-muted-foreground @min-[800px]/main:text-right">
              <div data-testid="bo-updated">{updatedAt ? <>Updated {formatDateTime(updatedAt)}</> : <Skel className="inline-block h-3.5 w-36 align-middle" />}</div>
              {since ? <div data-testid="bo-since">Backlink profile {since.charAt(0).toLowerCase()}{since.slice(1)}</div> : null}
            </div>
            <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy} data-testid="bo-refresh">
              {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button type="button" onClick={() => window.print()} title="Opens your browser's print dialog: choose Save as PDF" className="bg-emerald-400 font-semibold text-[#0d1a3a] hover:bg-emerald-300 print:hidden" data-testid="bo-pdf">
              <Download className="size-4" aria-hidden />Download PDF
            </Button>
          </div>
          {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground @min-[800px]/main:text-right" role="status">{refreshNote}</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 print:hidden" data-testid="bo-controls">
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
