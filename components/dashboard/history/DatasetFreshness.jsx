"use client"

import { AlertTriangle, CheckCircle2, CircleDashed, Clock } from "lucide-react"
import { useDatasetFreshness } from "@/hooks/useDatasetHistory"
import { Skel, SectionError } from "../domain-overview/SectionState"
import { describeSectionError } from "@/lib/describeSectionError"
import { formatNumber, timeAgo } from "@/lib/history/compare"
import { cn } from "@/lib/utils"

/** Plain names for the datasets (the ids are the scan's). */
export const DATASET_LABELS = Object.freeze({
  "rank-overview": "Domain metrics", history: "Traffic history", "ranked-keywords-top5": "Top keywords", "ranked-keywords-page": "Keyword list (first page)",
  "keywords-dataset": "Organic keywords (stored set)", competitors: "Competitors", backlinks: "Backlink summary", "backlinks-list": "Backlinks (first page)",
  "backlinks-dataset-live": "Live backlinks (stored set)", "backlinks-dataset-lost": "Lost backlinks (stored set)", anchors: "Anchors (first page)", "anchor-profile": "Anchor profile",
  "referring-domains": "Referring domains (first page)", "referring-domains-dataset-live": "Live referring domains (stored set)", "referring-domains-dataset-lost": "Lost referring domains (stored set)",
  "rd-rank-buckets": "Domain rank distribution", "rd-toxic-count": "High-spam domains", "rd-last-30": "New / lost domains, 30 days", "tp-counts": "Page counts", "tp-fix-first": "Pages to fix first",
  "domain-pages-all": "Linked pages (all)", "domain-pages-ok": "Linked pages (working)", "top-pages-traffic": "Traffic per page",
})

const ERROR_TEXT = Object.freeze({
  PROVIDER_NETWORK_ERROR: "the data service could not be reached", PROVIDER_TIMEOUT: "the data service took too long", PROVIDER_UNAVAILABLE: "the data service was unavailable",
  PROVIDER_RATE_LIMITED: "the data service was busy", PROVIDER_AUTH_FAILED: "the data service refused the request", PROVIDER_INSUFFICIENT_CREDITS: "the data service is unavailable",
  PROVIDER_REQUEST_REJECTED: "the data service could not process this domain", RATE_LIMITED: "too many requests were made",
})

const STATE = {
  fresh: { Icon: CheckCircle2, label: "Up to date", tone: "text-emerald-700 dark:text-emerald-400" },
  stale: { Icon: Clock, label: "Out of date", tone: "text-amber-700 dark:text-amber-300" },
  missing: { Icon: CircleDashed, label: "Not collected", tone: "text-muted-foreground" },
}

/**
 * Each dataset of the page on its own: a scan of one never makes another look fresh. Shows when it was last collected successfully, how many
 * rows are stored against how many exist (a capped set says so), and the last error while it is newer than the last success. A stale dataset
 * is still what the page shows; a failed refresh never turns a stored dataset into a missing one.
 */
export default function DatasetFreshness({ projectId, page, enabled = true, now = Date.now() }) {
  const q = useDatasetFreshness(projectId, page, enabled)
  if (q.isLoading) return <Skel className="h-16 w-full" />
  if (q.isError) return <SectionError message={describeSectionError(q.error)} onRetry={() => q.refetch()} />
  const rows = q.data?.data?.datasets ?? []
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Data freshness" data-testid="dataset-freshness">
      {rows.map((d) => {
        const st = STATE[d.state] ?? STATE.missing
        const capped = d.truncated === true
        return (
          <li key={d.id} className="flex items-start gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
            <st.Icon className={cn("mt-0.5 size-3.5 shrink-0", st.tone)} aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">{DATASET_LABELS[d.id] ?? d.id} <span className={cn("font-normal", st.tone)}>· {st.label}</span></p>
              <p className="text-muted-foreground">
                {d.lastSuccessfulAt ? `Collected ${timeAgo(d.lastSuccessfulAt, now)}` : "Never collected"}
                {typeof d.rows === "number" ? ` · ${formatNumber(d.rows)}${typeof d.providerTotal === "number" && d.providerTotal > d.rows ? ` of ${formatNumber(d.providerTotal)}` : ""} rows` : ""}
                {capped ? " · capped" : ""}
              </p>
              {d.lastError ? (
                <p className="flex items-center gap-1 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-3" aria-hidden /> Last refresh failed: {ERROR_TEXT[d.lastError.code] ?? "an error occurred"}. {d.lastSuccessfulAt ? "Showing the previous data." : ""}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
