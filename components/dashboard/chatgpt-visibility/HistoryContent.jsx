"use client"

import { useState } from "react"
import Link from "next/link"
import { useProject } from "@/contexts/ProjectContext"
import { useChatGptRuns } from "@/hooks/useChatGptVisibility"
import { Button } from "@/components/ui/button"
import { PageHeader, Panel, EmptyState, ErrorNote, PageSkeleton, NoProject, StatusMark } from "./parts"
import { pct, num, formatCost, formatDateTime } from "./format"

const PAGE_SIZE = 10
const TRIGGER_TEXT = { audit: "Audit", repair: "Audit", manual: "Manual" }

/** Change vs the next-older run, in percentage points. Only comparable when both runs used the same prompts. */
function Delta({ now, before, field }) {
  if (!before) return <span className="text-muted-foreground">—</span>
  if (now.promptSetVersion !== before.promptSetVersion) {
    return <span className="text-xs text-muted-foreground" title="The prompts changed between these runs, so the change is not comparable">prompts changed</span>
  }
  const a = now.metrics?.overall?.[field]
  const b = before.metrics?.overall?.[field]
  if (a == null || b == null) return <span className="text-muted-foreground">—</span>
  const pts = Math.round((a - b) * 100)
  if (pts === 0) return <span className="text-muted-foreground">no change</span>
  return (
    <span className={pts > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
      {pts > 0 ? "+" : "−"}{Math.abs(pts)} pts
    </span>
  )
}

/** `embedded`: rendered inside the combined History page (no page header; hidden when there are no five-prompt checks). */
export default function HistoryContent({ embedded = false } = {}) {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useChatGptRuns(projectId, { page, limit: PAGE_SIZE })

  if (!projectId) return <NoProject />
  if (isLoading) return <PageSkeleton />

  // Approved-question runs have their own table (ApprovedHistoryContent); their metrics have a different shape.
  const rows = (data?.data || []).filter((r) => r.status !== "skipped" && r.executionMode !== "approved_questions")
  const meta = data?.meta

  if (embedded && !error && !rows.length) return null

  return (
    <div className="space-y-6">
      {embedded ? <h2 className="text-lg font-semibold">Five-prompt checks</h2> : (
        <PageHeader
          title="History"
          description="Every check, newest first. Changes are shown against the previous check, and only when both used the same five questions."
        />
      )}
      {error ? <ErrorNote>Could not load the history.</ErrorNote> : null}
      {!rows.length ? (
        <EmptyState title="No checks yet">Once a visibility check has run, it is kept here so you can see how visibility changes over time.</EmptyState>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Started by</th>
                <th className="pb-2 pr-4 font-medium">Prompts</th>
                <th className="pb-2 text-right font-medium">Brand mentioned</th>
                <th className="pb-2 pl-3 text-right font-medium">vs previous</th>
                <th className="pb-2 text-right font-medium">Website cited</th>
                <th className="pb-2 pl-3 text-right font-medium">vs previous</th>
                <th className="pb-2 text-right font-medium">Pages</th>
                <th className="pb-2 text-right font-medium">Answered</th>
                <th className="pb-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const before = rows.slice(i + 1).find((x) => x.metrics?.overall)
                const o = r.metrics?.overall
                return (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="py-3 pr-4">
                      <Link className="underline-offset-4 hover:underline" href={`/app/chatgpt-visibility/results?run=${r.id}`}>{formatDateTime(r.createdAt)}</Link>
                    </td>
                    <td className="py-3 pr-4"><StatusMark status={r.status} /></td>
                    <td className="py-3 pr-4 text-muted-foreground">{TRIGGER_TEXT[r.trigger?.source] || "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{r.promptSetVersion ? `v${r.promptSetVersion}` : "—"}</td>
                    <td className="py-3 text-right tabular-nums">{pct(o?.brandMentionRate)}</td>
                    <td className="py-3 pl-3 text-right tabular-nums"><Delta now={r} before={before} field="brandMentionRate" /></td>
                    <td className="py-3 text-right tabular-nums">{pct(o?.websiteCitationRate)}</td>
                    <td className="py-3 pl-3 text-right tabular-nums"><Delta now={r} before={before} field="websiteCitationRate" /></td>
                    <td className="py-3 text-right tabular-nums">{num(o?.uniqueCitedPages)}</td>
                    <td className="py-3 text-right tabular-nums">{o ? `${o.succeeded} of ${o.attempted}` : "—"}</td>
                    <td className="py-3 text-right tabular-nums">{formatCost(r.totalCost)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {meta && meta.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {meta.page} of {meta.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button>
                <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Older</Button>
              </div>
            </div>
          ) : null}
        </Panel>
      )}
    </div>
  )
}
