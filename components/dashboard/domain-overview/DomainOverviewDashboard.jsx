"use client"

import { useState } from "react"
import { useProject } from "@/contexts/ProjectContext"
import { useDomainOverview } from "@/hooks/useDomainOverview"
import { useDomainHub } from "@/hooks/useDomainHub"
import { ErrorNote } from "@/components/dashboard/shared/parts"
import { formatDateTime } from "../referring-domains/format"
import DomainOverviewHeader from "./DomainOverviewHeader"
import KpiCards from "./KpiCards"
import FixFirstPanel from "./FixFirstPanel"
import TopPagesCard from "./TopPagesCard"
import TrafficTrendCard from "./TrafficTrendCard"
import KeywordPositionsCard from "./KeywordPositionsCard"
import MovementStrip from "./MovementStrip"
import TopKeywordsCard from "./TopKeywordsCard"
import CompetitorsCard from "./CompetitorsCard"
import BacklinksCard from "./BacklinksCard"
import { mapDomainOverview } from "./mapDomainOverview"
import { domainFromUrl } from "./format"

const SECTION_LABELS = {
  rankOverview: "Traffic & keywords",
  history: "History",
  rankedKeywords: "Top keywords",
  competitors: "Competitors",
  backlinks: "Backlinks",
}

/**
 * Domain Overview for the selected project: a one-screen summary of organic performance, backlinks, keyword movement and
 * competitors. Five sections load in parallel through the backend (which caches them); each has its own loading, error and
 * empty state, so one failing call never takes the page down. The domain and market always come from the project.
 */
export default function DomainOverviewDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Domain Overview</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its domain overview.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's page state carries over.
  return <ProjectDomainOverview key={projectId} projectId={projectId} project={activeProject} />
}

function ProjectDomainOverview({ projectId, project }) {
  const { sections, refreshAll, isFetching, competitorSettings } = useDomainOverview(projectId)
  const [refreshClicked, setRefreshClicked] = useState(false)
  const vm = mapDomainOverview(sections)

  const entries = Object.entries(sections)
  const loaded = entries.filter(([, s]) => s.data)
  const first = loaded[0]?.[1].data
  const domain = first?.target ?? domainFromUrl(project?.main_url)
  const market = first?.market ?? null
  // Everything beyond the five sections: Fix first, Top pages, last-30-days referring domains, anchor mix, the Brand split, tracked competitors.
  const hub = useDomainHub(projectId, { target: domain, sections, vm, competitorSettings })

  // "Last updated" = the most recent time the provider was asked; the title lists each section (history is cached longer).
  const fetchedAt = loaded.map(([name, s]) => [name, s.data.fetchedAt]).filter(([, t]) => Number.isFinite(Date.parse(t)))
  const updatedAt = fetchedAt.length ? new Date(Math.max(...fetchedAt.map(([, t]) => Date.parse(t)))).toISOString() : null
  const updatedDetail = fetchedAt.map(([name, t]) => `${SECTION_LABELS[name]}: ${formatDateTime(t)}`).join("\n")

  const allThrottled = loaded.length > 0 && loaded.every(([, s]) => s.data.refreshThrottled)
  const refreshNote = refreshClicked && !isFetching && allThrottled
    ? "This data was refreshed less than a minute ago, so it was not requested again."
    : null

  // Every section rejects a project whose URL has no public domain in the same way: say it once.
  const noDomain = entries.every(([, s]) => s.status === "error" && s.error?.code === "INVALID_TARGET")

  return (
    <div className="space-y-6">
      <DomainOverviewHeader
        domain={domain}
        market={market}
        updatedAt={updatedAt}
        updatedDetail={updatedDetail}
        busy={isFetching}
        refreshing={refreshClicked && isFetching}
        refreshNote={refreshNote}
        onRefresh={() => { setRefreshClicked(true); refreshAll() }}
      />

      {noDomain ? (
        <ErrorNote>This project&apos;s website URL does not have a public domain name, so its overview cannot be loaded. Update the project URL in Settings.</ErrorNote>
      ) : (
        <>
          <KpiCards vm={vm} sections={sections} />

          <FixFirstPanel issues={hub.issues} />

          <div className="grid grid-cols-1 gap-3 @min-[900px]/main:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <TrafficTrendCard state={sections.history} trend={vm.trend} />
            <KeywordPositionsCard state={sections.rankOverview} positions={vm.positions} hasRankingData={vm.hasRankingData} />
          </div>

          <MovementStrip state={sections.rankOverview} movement={vm.movement} hasRankingData={vm.hasRankingData} />

          <div className="grid grid-cols-1 gap-3 @min-[900px]/main:grid-cols-2">
            <TopKeywordsCard state={sections.rankedKeywords} topKeywords={vm.topKeywords} brand={hub.brand} />
            <TopPagesCard topPages={hub.topPages} />
          </div>

          <CompetitorsCard state={sections.competitors} hub={hub.competitors} settings={competitorSettings} />

          <BacklinksCard state={sections.backlinks} last30={hub.last30} anchorMix={hub.anchorMix} />
        </>
      )}
    </div>
  )
}
