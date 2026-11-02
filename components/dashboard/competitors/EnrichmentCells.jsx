"use client"

import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { formatDateTime } from "../referring-domains/format"
import { reasonFor, statusMeta } from "./enrichmentUi"

const TONE_VARIANT = { success: "success", warning: "warning", critical: "critical", info: "outline", muted: "secondary" }

/** The enrichment status of one competitor, as a chip. The explanation is its tooltip and is also available to screen readers. */
export function StatusChip({ enrichment, className }) {
  const meta = statusMeta(enrichment)
  const busy = enrichment?.status === "processing"
  return (
    <Badge variant={TONE_VARIANT[meta.tone] ?? "secondary"} className={cn("gap-1", className)} title={meta.hint} data-testid="mc-status" data-status={enrichment?.status ?? "not_started"}>
      {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
      {meta.label}
      <span className="sr-only">. {meta.hint}</span>
    </Badge>
  )
}

/**
 * One metric. A real number (zero included) is formatted; anything the server could not give is a dash whose tooltip says WHY
 * (no data from the provider / could not be loaded / being fetched). A missing value is never shown as 0.
 */
export function Metric({ value, enrichment, section, className, format = formatCompact, unavailable = null }) {
  const has = typeof value === "number" && Number.isFinite(value)
  if (has) return <span className={cn("tabular-nums", className)} title={formatExact(value)} data-testid="mc-metric">{format(value)}</span>
  const reason = unavailable ?? reasonFor(enrichment, section)
  return (
    <span className={cn("text-muted-foreground", className)} title={reason} data-testid="mc-metric" data-missing="true">
      {MISSING}
      <span className="sr-only"> {reason}</span>
    </span>
  )
}

/** When the numbers were last fetched successfully (the date of the data, not of the page view). */
export function UpdatedAt({ enrichment, className }) {
  const at = enrichment?.lastSuccessAt ?? null
  if (!at) return <span className={cn("text-muted-foreground", className)} title="Not fetched yet">{MISSING}</span>
  return <span className={cn("whitespace-nowrap text-xs text-muted-foreground", className)} title={formatDateTime(at)} data-testid="mc-updated">{formatDateTime(at)}</span>
}
