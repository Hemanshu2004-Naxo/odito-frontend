"use client"

import { useState } from "react"
import { useProject } from "@/contexts/ProjectContext"
import { useBacklinkSummary } from "@/hooks/useBacklinkSummary"
import { cn } from "@/lib/utils"
import { SectionError } from "../domain-overview/SectionState"
import { domainFromUrl } from "../domain-overview/format"
import { useBacklinkExtras } from "@/hooks/useBacklinkExtras"
import BacklinkOverviewHeader from "./BacklinkOverviewHeader"
import { AboutSite, FixFirst, FollowBars, LinkSources, LinkStrengthCard, StatTiles } from "./BacklinkSections"

/**
 * Backlink Overview for the selected project: the whole backlink profile on one screen — authority, link counts, link quality, where the
 * links come from, and the problems (broken links, spam). The page is ONE request (API 6); every card reads the same mapped summary.
 */
export default function BacklinkOverviewDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Backlink overview</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its backlink profile.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's controls carries over.
  return <ProjectBacklinks key={projectId} projectId={projectId} project={activeProject} />
}

function ProjectBacklinks({ projectId, project }) {
  const bl = useBacklinkSummary(projectId)
  const { state, update, summary } = bl
  const [refreshClicked, setRefreshClicked] = useState(false)
  const domain = bl.target ?? domainFromUrl(project?.main_url)
  const view = { status: bl.status, error: bl.error, refetch: bl.refetch }
  const refreshNote = refreshClicked && !bl.isFetching && bl.refreshThrottled ? "This data was refreshed less than a minute ago, so it was not requested again." : null
  const noDomain = bl.status === "error" && bl.error?.code === "INVALID_TARGET"
  const empty = bl.status === "success" && summary?.hasBacklinks === false
  const extras = useBacklinkExtras(projectId, { domain, totalReferringDomains: summary?.totals.referringDomains ?? null })
  const STATUS_WORD = { live: "Live links", lost: "Lost links", all: "Live and lost links" }

  return (
    <div className="space-y-5">
      <BacklinkOverviewHeader
        domain={domain}
        updatedAt={bl.updatedAt}
        since={summary?.age.short ?? null}
        state={state}
        update={update}
        onRefresh={() => { setRefreshClicked(true); bl.refresh() }}
        busy={bl.isFetching}
        refreshing={refreshClicked && bl.isFetching}
        refreshNote={refreshNote}
      />

      {bl.status === "error" && !noDomain ? (
        <div data-testid="bo-page-error"><SectionError message={bl.error?.message} onRetry={bl.refetch} /></div>
      ) : null}

      {noDomain ? (
        <SectionError message="This project's website URL does not have a public domain name, so its backlinks cannot be loaded. Update the project URL in Settings." />
      ) : empty ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground" data-testid="bo-empty">
          No backlinks found for this domain yet
        </div>
      ) : (
        <div className={cn("space-y-5 transition-opacity", bl.stale && bl.isFetching && "opacity-60")} aria-busy={bl.status === "loading" || (bl.stale && bl.isFetching)} data-testid="bo-content">
          <div className="grid gap-4 @min-[1100px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <LinkStrengthCard state={view} summary={summary} />
            <StatTiles state={view} summary={summary} extras={extras} />
          </div>
          <FixFirst state={view} summary={summary} />
          <FollowBars state={view} summary={summary} />
          <LinkSources state={view} summary={summary} />
          <AboutSite state={view} summary={summary} />
          <p className="text-xs text-muted-foreground">Data from the DataForSEO Backlinks API (backlinks/summary). {STATUS_WORD[state.status] ?? ""}{state.dofollow ? ", dofollow only" : ""}.</p>
        </div>
      )}
    </div>
  )
}

