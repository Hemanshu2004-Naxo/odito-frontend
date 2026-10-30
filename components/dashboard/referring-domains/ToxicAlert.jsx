"use client"

import { AlertTriangle, CheckCircle2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { PROFILE_SCOPE_LABEL } from "./constants"

/**
 * "Toxic domains": how many referring domains have a spam score above 30 (one count-only request, cached 7 days), with a way to review them,
 * and — when the project has a disavow list — a way to download it. WHOLE PROFILE: live links, no filters, no dofollow switch.
 * The disavow count comes from the project's own saved list (no request).
 */
export default function ToxicAlert({ toxic, disavowedCount, onReview, onDownload }) {
  const count = toxic.count
  const has = typeof count === "number" && count > 0
  return (
    <Panel title="Toxic domains" description={<span data-testid="rd-toxic-scope">{PROFILE_SCOPE_LABEL}</span>} className="min-w-0">
      <SectionBoundary
        state={{ status: toxic.status, error: toxic.error, refetch: toxic.refetch }}
        skeleton={<div className="space-y-3" aria-hidden><Skel className="h-6 w-3/4" /><Skel className="h-9 w-28" /></div>}
      >
        <div className="space-y-3">
          {has ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-300/70 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100" role="alert" data-testid="rd-toxic-alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p><strong className="tabular-nums" data-testid="rd-toxic-count">{formatExact(count)}</strong> referring domains have spam score above {toxic.spamAbove}</p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-300/70 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100" data-testid="rd-toxic-none">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>No referring domains have a spam score above {toxic.spamAbove}.</p>
            </div>
          )}
          {has ? <Button type="button" variant="outline" onClick={onReview} data-testid="rd-toxic-review">Review</Button> : null}
          {disavowedCount > 0 ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="rd-toxic-disavow">
              <span><strong className="tabular-nums">{formatExact(disavowedCount)}</strong> {disavowedCount === 1 ? "domain" : "domains"} in your disavow list</span>
              <span aria-hidden>·</span>
              <button type="button" onClick={onDownload} className="inline-flex items-center gap-1 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="rd-toxic-download">
                <Download className="size-3.5" aria-hidden /> Download file
              </button>
            </p>
          ) : null}
        </div>
      </SectionBoundary>
    </Panel>
  )
}
