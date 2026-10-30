"use client"

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import InfoHint from "../referring-domains/InfoHint"
import { ANCHOR_HEALTH } from "@/lib/anchors/anchorConfig"

const STYLE = {
  ok: { Icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400", label: "OK" },
  warn: { Icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400", label: "Warning" },
  bad: { Icon: XCircle, className: "text-red-600 dark:text-red-400", label: "Problem" },
}

const HINT = `Checks the top anchors against simple rules: exact-match above ${ANCHOR_HEALTH.exactMaxPercent}%, branded + naked URL below ${ANCHOR_HEALTH.brandedPlusNakedMinPercent}%, one non-branded anchor above ${ANCHOR_HEALTH.repeatedAnchorMaxPercent}% of referring domains, spam above ${ANCHOR_HEALTH.spam.maxBacklinksPercent}% of backlinks, and ${ANCHOR_HEALTH.sitewide.minBacklinks}+ links from one site. They are a guide, not a verdict.`

/** "Anchor profile health": one line per check that fires, each with a status icon; one green line when none does. */
export default function ProfileHealth({ profile }) {
  const { summary, health } = profile
  return (
    <Panel title={<span className="flex items-center gap-1.5">Anchor profile health<InfoHint label="Anchor profile health" text={HINT} /></span>} description="Signs of over-optimisation or spam" className="min-w-0">
      <SectionBoundary
        state={{ status: profile.status, error: profile.error, refetch: profile.refetch }}
        skeleton={<div className="space-y-3" aria-hidden>{Array.from({ length: 3 }, (_, i) => <Skel key={i} className="h-10 w-full" />)}</div>}
        empty={!summary || summary.totals.anchors === 0}
        emptyMessage="No anchor data for this domain yet."
      >
        <ul className="space-y-2.5" data-testid="an-health">
          {health.map((c) => {
            const { Icon, className, label } = STYLE[c.status]
            return (
              <li key={c.id} className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm" data-testid={`an-health-${c.id}`} data-status={c.status}>
                <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden />
                <span className="sr-only">{label}: </span>
                <span>{c.message}</span>
              </li>
            )
          })}
        </ul>
      </SectionBoundary>
    </Panel>
  )
}
