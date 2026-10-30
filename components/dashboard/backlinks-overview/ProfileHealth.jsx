"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, XCircle } from "lucide-react"
import { Panel } from "@/components/dashboard/shared/parts"
import { cn } from "@/lib/utils"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"

const LEVELS = {
  red: { Icon: XCircle, tone: "text-red-600 dark:text-red-400", word: "Problem" },
  amber: { Icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400", word: "Warning" },
  green: { Icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400", word: "Good" },
  unknown: { Icon: CircleHelp, tone: "text-muted-foreground", word: "Unknown" },
}

/** "Profile health": the automatic checks, one row each — a status icon (never colour alone: it has its own shape and word), a message, a link. */
export default function ProfileHealth({ state, summary }) {
  const checks = summary?.health ?? []
  return (
    <Panel title="Profile health" description="Automatic checks of this backlink profile" className="min-w-0">
      <SectionBoundary state={state} skeleton={<div className="space-y-2" aria-hidden>{Array.from({ length: 6 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}</div>}>
        <ul className="divide-y divide-border/60" data-testid="bo-health">
          {checks.map((c) => {
            const { Icon, tone, word } = LEVELS[c.level] ?? LEVELS.unknown
            return (
              <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm" data-testid={`bo-health-${c.id}`} data-level={c.level}>
                <Icon className={cn("size-5 shrink-0", tone)} aria-hidden />
                <span className="sr-only">{word}: </span>
                <span className="min-w-0 flex-1">{c.message}</span>
                {c.href ? (
                  <Link href={c.href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline underline-offset-2" data-testid={`bo-health-${c.id}-link`}>
                    View <ArrowRight className="size-3.5" aria-hidden /><span className="sr-only"> {c.id === "broken-pages" ? "pages with errors" : "broken backlinks"}</span>
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      </SectionBoundary>
    </Panel>
  )
}
