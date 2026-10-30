"use client"

import { useState } from "react"
import { useProject } from "@/contexts/ProjectContext"
import { useBacklinkSummary } from "@/hooks/useBacklinkSummary"
import { cn } from "@/lib/utils"
import { SectionError } from "../domain-overview/SectionState"
import { domainFromUrl } from "../domain-overview/format"
import AuthorityStrip from "./AuthorityStrip"
import BacklinkOverviewHeader from "./BacklinkOverviewHeader"
import BreakdownBarCard from "./BreakdownBarCard"
import FollowDonuts from "./FollowDonuts"
import KpiGrid from "./KpiGrid"
import ProfileHealth from "./ProfileHealth"
import SiteInfo from "./SiteInfo"
import { PLACEMENT_HINT } from "./constants"

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
        <h1 className="text-2xl font-semibold tracking-tight">Backlink Overview</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its backlink profile.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's controls carries over.
  return <ProjectBacklinks key={projectId} projectId={projectId} project={activeProject} />
}

const Row = ({ children }) => <div className="grid gap-4 @min-[900px]/main:grid-cols-2">{children}</div>

function ProjectBacklinks({ projectId, project }) {
  const bl = useBacklinkSummary(projectId)
  const { state, update, summary } = bl
  const [refreshClicked, setRefreshClicked] = useState(false)
  const domain = bl.target ?? domainFromUrl(project?.main_url)
  const view = { status: bl.status, error: bl.error, refetch: bl.refetch }
  const refreshNote = refreshClicked && !bl.isFetching && bl.refreshThrottled ? "This data was refreshed less than a minute ago, so it was not requested again." : null
  const noDomain = bl.status === "error" && bl.error?.code === "INVALID_TARGET"
  const empty = bl.status === "success" && summary?.hasBacklinks === false

  return (
    <div className="space-y-6">
      <BacklinkOverviewHeader
        domain={domain}
        updatedAt={bl.updatedAt}
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
        <div className={cn("space-y-6 transition-opacity", bl.stale && bl.isFetching && "opacity-60")} aria-busy={bl.status === "loading" || (bl.stale && bl.isFetching)} data-testid="bo-content">
          <AuthorityStrip state={view} summary={summary} />
          <KpiGrid state={view} summary={summary} />

          <Row>
            <FollowDonuts state={view} summary={summary} />
            <BreakdownBarCard
              title="Link attributes"
              description="How the links are marked up (a link can have several)"
              state={view}
              breakdown={summary?.breakdowns.attributes}
              testId="bo-chart-attributes"
              labelWidth={96}
              note="Amber bars: sponsored and ugc links. Hover any bar to see what the attribute means."
            />
          </Row>

          <Row>
            <BreakdownBarCard title="Top countries" description="Where the linking pages are hosted" state={view} breakdown={summary?.breakdowns.countries} testId="bo-chart-countries" labelWidth={150} />
            <BreakdownBarCard title="Top TLDs" description="The domain endings of the linking sites" state={view} breakdown={summary?.breakdowns.tlds} testId="bo-chart-tlds" labelWidth={110} />
          </Row>

          <Row>
            <BreakdownBarCard title="Linking site types" description="What kind of site links to you (a site can have several types)" state={view} breakdown={summary?.breakdowns.platformTypes} testId="bo-chart-platforms" labelWidth={130} />
            <BreakdownBarCard title="Link placement" description="Where on the page the link sits" hint={PLACEMENT_HINT} state={view} breakdown={summary?.breakdowns.semanticLocations} testId="bo-chart-placement" labelWidth={120} />
          </Row>

          <BreakdownBarCard title="Link types" description="Text links, image links and redirects" state={view} breakdown={summary?.breakdowns.linkTypes} testId="bo-chart-types" labelWidth={120} />

          <Row>
            <ProfileHealth state={view} summary={summary} />
            <SiteInfo state={view} summary={summary} />
          </Row>
        </div>
      )}
    </div>
  )
}

