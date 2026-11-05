"use client"

import Link from "next/link"
import { Download, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "../referring-domains/format"
import { Skel } from "./SectionState"

const PILL = "inline-flex items-center rounded-full border border-border/70 bg-card px-3 py-1 text-xs"

/**
 * Breadcrumb + title on the left; the domain, market ("Google India · English"), when the data was fetched, Refresh (skips the server
 * cache) and Export (a CSV of what the page shows) on the right. `updatedAt` is the newest fetch; the title lists each section.
 */
export default function DomainOverviewHeader({ domain, market, updatedAt, updatedDetail, onRefresh, onExport, canExport, busy, refreshing, refreshNote }) {
  return (
    <div className="flex flex-col gap-3 @min-[900px]/main:flex-row @min-[900px]/main:items-end @min-[900px]/main:justify-between">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/app/dashboard" className="hover:text-foreground hover:underline underline-offset-2">Dashboard</Link></li>
            <li aria-hidden>/</li>
            <li>SEO</li>
            <li aria-hidden>/</li>
            <li aria-current="page">Rankings &amp; traffic</li>
          </ol>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Domain overview</h1>
      </div>
      <div className="flex flex-col items-start gap-1 @min-[900px]/main:items-end">
        <div className="flex flex-wrap items-center gap-2" data-testid="do-meta">
          <span className={`${PILL} font-semibold`}>
            <span className="sr-only">Domain: </span>
            <span data-testid="do-domain">{domain || "—"}</span>
          </span>
          <span className={`${PILL} text-muted-foreground`} data-testid="do-market">
            {market ? `Google ${market.location} · ${market.language}` : <Skel className="inline-block h-3.5 w-28 align-middle" />}
          </span>
          <span className={`${PILL} text-muted-foreground`} data-testid="do-updated" title={updatedDetail || undefined}>
            {updatedAt ? <>Updated {formatDateTime(updatedAt)}</> : <Skel className="inline-block h-3.5 w-32 align-middle" />}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={busy} aria-busy={busy}>
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button type="button" size="sm" onClick={onExport} disabled={!canExport} className="bg-foreground text-background hover:bg-foreground/90" data-testid="do-export">
            <Download className="size-4" aria-hidden />Export
          </Button>
        </div>
        {refreshNote ? <p className="max-w-xs text-xs text-muted-foreground @min-[900px]/main:text-right" role="status">{refreshNote}</p> : null}
      </div>
    </div>
  )
}
