"use client"

import { useState } from "react"
import { useProject } from "@/contexts/ProjectContext"
import { useTrafficHistory } from "@/hooks/useTrafficHistory"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { ErrorNote } from "@/components/dashboard/shared/parts"
import { EmptyNote } from "../domain-overview/SectionState"
import { domainFromUrl, formatExact } from "../domain-overview/format"
import TrafficHistoryHeader from "./TrafficHistoryHeader"
import SummaryCards from "./SummaryCards"
import TrafficKeywordsChart from "./TrafficKeywordsChart"
import TrafficValueChart from "./TrafficValueChart"
import DistributionChart from "./DistributionChart"
import MovementChart from "./MovementChart"
import MonthlyTable from "./MonthlyTable"
import { mapTrafficHistory } from "./mapTrafficHistory"

/**
 * Traffic History for the selected project: how organic traffic, keywords, traffic value and ranking positions moved month by month.
 * One response from the SAME historical-rank route the Domain Overview uses (cached on the server for 7 days) feeds every section;
 * the 6 / 12 / 24-month selector slices it, and only asking for more than has been loaded fetches again (once).
 */
export default function TrafficHistoryDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Traffic History</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its traffic history.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's range or toggles carries over.
  return <ProjectTrafficHistory key={projectId} projectId={projectId} project={activeProject} />
}

function ProjectTrafficHistory({ projectId, project }) {
  const { state, selectedMonths, selectRange, refresh, isLoadingMore } = useTrafficHistory(projectId)
  const { toasts, notify, dismiss } = useToastQueue()
  const [refreshClicked, setRefreshClicked] = useState(false)
  const vm = mapTrafficHistory(state.data, { months: selectedMonths })

  const domain = state.data?.target ?? domainFromUrl(project?.main_url)
  const market = state.data?.market ?? null
  const updatedAt = state.data?.fetchedAt ?? null
  const refreshNote = refreshClicked && !state.isFetching && state.data?.refreshThrottled
    ? "This data was refreshed less than a minute ago, so it was not requested again."
    : null

  const noDomain = state.status === "error" && state.error?.code === "INVALID_TARGET"
  const notEnough = state.status === "success" && !vm.hasEnoughHistory

  return (
    <div className="space-y-6">
      <TrafficHistoryHeader
        domain={domain}
        market={market}
        updatedAt={updatedAt}
        selected={selectedMonths}
        onSelect={selectRange}
        onRefresh={() => { setRefreshClicked(true); refresh() }}
        busy={state.isFetching}
        refreshing={refreshClicked && state.isFetching && !isLoadingMore}
        loadingMore={isLoadingMore}
        refreshNote={refreshNote}
      />

      {noDomain ? (
        <ErrorNote>This project&apos;s website URL does not have a public domain name, so its traffic history cannot be loaded. Update the project URL in Settings.</ErrorNote>
      ) : notEnough ? (
        <EmptyNote className="min-h-40">Not enough history yet for this domain.</EmptyNote>
      ) : (
        <>
          <SummaryCards state={state} summary={vm.summary} />
          <TrafficKeywordsChart state={state} range={vm.range} hasPaid={vm.hasPaid} biggestDrop={vm.biggestDrop} />
          <TrafficValueChart state={state} range={vm.range} />
          <DistributionChart state={state} range={vm.range} />
          <MovementChart state={state} range={vm.range} />
          <MonthlyTable
            state={state}
            rows={vm.tableRows}
            domain={domain}
            months={selectedMonths}
            onExported={(n) => notify(`Exported ${formatExact(n)} months.`, "success")}
            onExportError={() => notify("Could not export the table. Please try again.", "danger")}
          />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
