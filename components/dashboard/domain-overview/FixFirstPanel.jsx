"use client"

import Link from "next/link"
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Skel } from "./SectionState"

const SEVERITY = {
  critical: { Icon: AlertOctagon, label: "Critical", icon: "text-red-600 dark:text-red-400", row: "border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5" },
  warning: { Icon: AlertTriangle, label: "Warning", icon: "text-amber-600 dark:text-amber-400", row: "border-amber-200 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5" },
  info: { Icon: Info, label: "Info", icon: "text-sky-600 dark:text-sky-400", row: "border-border/60 bg-card" },
}

export const EMPTY_MESSAGE = "No urgent issues found. Nice work."
export const PARTIAL_MESSAGE = "Some checks couldn't load"

function IssueRow({ issue }) {
  const s = SEVERITY[issue.severity] ?? SEVERITY.info
  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 @min-[700px]/main:flex-row @min-[700px]/main:items-center", s.row)} data-testid="do-issue" data-severity={issue.severity} data-rule={issue.rule}>
      <s.Icon className={cn("size-5 shrink-0", s.icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          <span className="sr-only">{s.label}: </span>
          {issue.title}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{issue.why}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 self-start @min-[700px]/main:self-center">
        <Link href={issue.cta.href} data-testid="do-issue-cta">{issue.cta.label}</Link>
      </Button>
    </li>
  )
}

/**
 * "Fix first": up to five issues, worst first, each with why it matters and a button to the page that fixes it. The panel fills in as each
 * source arrives (rows appear, a skeleton row waits for the rest); a source that fails hides only its own rule and is mentioned below with
 * a Retry. With nothing wrong it says so — but only when something was actually checked.
 *
 * @param {{ issues: ReturnType<typeof import("./dashboardIssues").buildDashboardIssues> & { retry: () => void } }} props
 */
export default function FixFirstPanel({ issues }) {
  const { issues: list, pending, failed, total, checked } = issues
  const waiting = pending.length > 0
  const allClear = !waiting && list.length === 0 && checked.length > 0

  return (
    <section aria-labelledby="do-fix-first-title" className="space-y-3" data-testid="do-fix-first">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="do-fix-first-title" className="text-base font-semibold">Fix first</h2>
        {total > list.length ? <span className="text-xs text-muted-foreground" data-testid="do-fix-more">Showing {list.length} of {total}</span> : null}
      </div>

      {list.length > 0 ? <ul className="space-y-2">{list.map((i) => <IssueRow key={i.id} issue={i} />)}</ul> : null}

      {waiting ? (
        <div className="space-y-2" aria-hidden data-testid="do-fix-skeleton">
          {Array.from({ length: list.length === 0 ? 3 : 1 }, (_, i) => <Skel key={i} className="h-[62px] w-full rounded-xl" />)}
        </div>
      ) : null}

      {allClear ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" role="status" data-testid="do-fix-clear">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {EMPTY_MESSAGE}
        </div>
      ) : null}

      {failed.length > 0 && !waiting ? (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" data-testid="do-fix-partial">
          {PARTIAL_MESSAGE} <span aria-hidden>·</span>
          <button type="button" onClick={issues.retry} className="inline-flex items-center gap-1 rounded font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="do-fix-retry">
            <RefreshCw className="size-3" aria-hidden /> Retry
          </button>
        </p>
      ) : null}
    </section>
  )
}
