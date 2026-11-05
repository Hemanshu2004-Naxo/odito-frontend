"use client"

import Link from "next/link"
import { Download, Loader2, RefreshCw, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "../referring-domains/format"
import { formatExact } from "../domain-overview/format"

/**
 * Breadcrumb, title and domain; on the right what the page is about ("… · 179 anchors"), Anchor settings (the brand terms and target
 * keywords the types are worked out from), Refresh (skips the server cache; the server still refuses to re-buy data fetched in the last
 * minute) and Export CSV (every anchor of the profile, no new request).
 */
export default function AnchorsHeader({ domain, updatedAt, total, onRefresh, refreshing, busy, refreshNote, exportDisabled, onExport, onSettings }) {
  return (
    <div className="flex flex-col gap-4 @min-[900px]/main:flex-row @min-[900px]/main:items-end @min-[900px]/main:justify-between">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/app/dashboard" className="hover:text-foreground hover:underline underline-offset-2">Dashboard</Link></li>
            <li aria-hidden>/</li><li>SEO</li><li aria-hidden>/</li><li>Off-page</li>
          </ol>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Anchors</h1>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="an-meta">
          <span className="sr-only">Domain: </span><span className="font-medium text-foreground" data-testid="an-domain">{domain || "—"}</span>
          {updatedAt ? <span data-testid="an-updated"> · updated {formatDateTime(updatedAt)}</span> : null}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 @min-[900px]/main:items-end">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground" data-testid="an-about">
            The clickable words other sites use to link to you{typeof total === "number" ? ` · ${formatExact(total)} anchors` : ""}
          </span>
          <Button type="button" variant="outline" onClick={onSettings} data-testid="an-settings">
            <Settings2 className="size-4" aria-hidden /> Anchor settings
          </Button>
          <Button type="button" variant="outline" onClick={onRefresh} disabled={busy} aria-busy={busy} data-testid="an-refresh">
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button type="button" variant="outline" onClick={onExport} disabled={exportDisabled} className="font-semibold" data-testid="an-export">
            <Download className="size-4" aria-hidden /> Export CSV
          </Button>
        </div>
        {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground @min-[900px]/main:text-right" role="status">{refreshNote}</p> : null}
      </div>
    </div>
  )
}
