"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useProject } from "@/contexts/ProjectContext"
import { useGoogleAioRuns } from "@/hooks/useGoogleAioVisibility"
import { PageHeader, Panel, EmptyState, ErrorNote, PageSkeleton, StatusMark } from "../shared/parts"
import { NoProject } from "./GoogleAioDashboard"
import { PAGE_BASE, DEVICES, QUESTIONS_PER_RUN, errorText, formatCost, formatDateTime, num, pct, processedCount } from "./format"

const PAGE_SIZE = 10

/** Every Google AI Overview run of the project. */
export default function HistoryContent() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useGoogleAioRuns(projectId, { page, limit: PAGE_SIZE })
  const runs = data?.data || []
  const totalPages = data?.meta?.totalPages ?? data?.pagination?.totalPages ?? (runs.length === PAGE_SIZE ? page + 1 : page)

  if (!projectId) return <NoProject />
  if (isLoading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <PageHeader title="History" description="Every Google AI Overview run for this project, newest first. Each run asked five questions." />
      {error ? <ErrorNote>Could not load the history. Try again.</ErrorNote> : null}
      {!runs.length && !error ? <EmptyState title="No runs yet">Run the five questions from the overview to start the history.</EmptyState> : null}
      {runs.length ? (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Run</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Questions</th>
                  <th className="py-2 pr-3 font-medium">AI Overview</th><th className="py-2 pr-3 font-medium">Mentions</th><th className="py-2 pr-3 font-medium">Citations</th>
                  <th className="py-2 pr-3 font-medium">Pages</th><th className="py-2 pr-3 font-medium">Cost</th><th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3"><div>{formatDateTime(r.createdAt)}</div><div className="text-xs text-muted-foreground">{r.location?.name || "—"} · {DEVICES[r.location?.device] || "—"} · v{r.questionSetVersion}</div></td>
                    <td className="py-2.5 pr-3"><StatusMark status={r.status} />{r.failureCode && r.status !== "completed" ? <div className="text-xs text-muted-foreground">{errorText(r.failureCode)}</div> : null}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{processedCount(r.questionStats)}/{r.progress?.total ?? QUESTIONS_PER_RUN}<div className="text-xs text-muted-foreground">{r.questionStats?.succeeded ?? 0} searched{r.questionStats?.failed ? ` · ${r.questionStats.failed} failed` : ""}{r.questionStats?.skipped ? ` · ${r.questionStats.skipped} not sent` : ""}</div></td>
                    <td className="py-2.5 pr-3 tabular-nums">{pct(r.metrics?.aiOverview?.rate)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{pct(r.metrics?.brandMention?.rate)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{pct(r.metrics?.websiteCitation?.rate)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{num(r.metrics?.uniqueCitedPages?.count)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{formatCost(r.totalCost)}</td>
                    <td className="py-2.5 text-right"><Button variant="ghost" size="sm" asChild><Link href={`${PAGE_BASE}/results?runId=${r.id}`}>Evidence</Link></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {page > 1 || page < totalPages ? (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {page}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Older</Button>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  )
}
