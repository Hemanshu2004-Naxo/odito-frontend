"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useProject } from "@/contexts/ProjectContext"
import { useCompetitors } from "@/hooks/useCompetitors"
import { useTrafficComparison } from "@/hooks/useTrafficComparison"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { ErrorNote } from "@/components/dashboard/shared/parts"
import { domainFromUrl, formatExact } from "../domain-overview/format"
import CompareSection from "./CompareSection"
import CompetitorsHeader from "./CompetitorsHeader"
import CompetitorsTable from "./CompetitorsTable"
import ControlsBar from "./ControlsBar"
import LandscapeChart from "./LandscapeChart"
import ManageExclusionsDialog from "./ManageExclusionsDialog"
import { buildCompetitorsCsv, competitorsCsvFileName, downloadCsv } from "./exportCsv"
import { lastReachablePage } from "./constants"
import { settingsChanged } from "./urlState"

const HIGHLIGHT_MS = 2500

/**
 * Competitors for the selected project: which sites compete with it in Google, how big they are, and how the project does against each
 * on the keywords they share. The list, its sorting, paging and settings all run on the server (the table only ever holds one page);
 * competitors can be tracked (pinned) and compared side by side.
 */
export default function CompetitorsDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Competitors</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its competitors.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's settings or open rows carries over.
  return <ProjectCompetitors key={projectId} projectId={projectId} project={activeProject} />
}

function ProjectCompetitors({ projectId, project }) {
  const projectDomain = domainFromUrl(project?.main_url)
  const cp = useCompetitors(projectId, { projectDomain })
  const { state, update, page, settings } = cp
  const compare = useTrafficComparison(projectId, cp.projectDomain, settings.tracked)
  const { toasts, notify, dismiss } = useToastQueue()
  const [refreshClicked, setRefreshClicked] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [highlight, setHighlight] = useState(null)
  const [excludePending, setExcludePending] = useState(() => new Set())
  const [trackPending, setTrackPending] = useState(() => new Set())
  const highlightTimer = useRef(null)
  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  const domain = cp.target ?? projectDomain
  const trackedSet = new Set(settings.tracked)

  // A page past the end (a hand-edited link, or a change that left fewer competitors) moves back to the last page that exists.
  useEffect(() => {
    if (page.status !== "success" || page.stale || page.total === null) return
    const last = Math.min(Math.max(1, Math.ceil(page.total / state.pageSize)), lastReachablePage(state.pageSize))
    if (state.page > last) update({ page: last })
  }, [page.status, page.stale, page.total, state.page, state.pageSize, update])

  const toggleTrack = useCallback(async (d) => {
    const isTracked = settings.tracked.includes(d)
    setTrackPending((s) => new Set(s).add(d))
    const res = isTracked ? await settings.untrack(d) : await settings.track(d)
    setTrackPending((s) => { const n = new Set(s); n.delete(d); return n })
    if (!res.ok) notify(res.message, "danger")
  }, [settings, notify])

  const excludeRow = useCallback(async (d) => {
    setExcludePending((s) => new Set(s).add(d))
    const res = await settings.exclude([d])
    setExcludePending((s) => { const n = new Set(s); n.delete(d); return n })
    notify(res.ok ? `${d} excluded. Manage exclusions to undo.` : res.message, res.ok ? "success" : "danger")
  }, [settings, notify])

  // A bubble was clicked: show its row and ring it for a moment.
  const selectDomain = useCallback((d) => {
    if (!d) return
    setHighlight(d)
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlight(null), HIGHLIGHT_MS)
    const el = document.getElementById(`cp-row-${d}`)
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" })
  }, [])

  const exportPage = () => {
    downloadCsv(competitorsCsvFileName(domain), buildCompetitorsCsv(page.rows, { tracked: trackedSet }))
    notify(`Exported ${formatExact(page.rows.length)} competitors from this page.`, "success")
  }

  const refreshNote = refreshClicked && !cp.isFetching && cp.refreshThrottled ? "This data was refreshed less than a minute ago, so it was not requested again." : null
  const noDomain = page.status === "error" && page.error?.code === "INVALID_TARGET"
  const viewKey = JSON.stringify(cp.request)
  const changed = settingsChanged(state)
  const activeCount = [!state.hideLarge, state.top10, Boolean(state.minShared)].filter(Boolean).length

  return (
    <div className="space-y-6">
      <CompetitorsHeader
        domain={domain}
        market={cp.market}
        updatedAt={cp.updatedAt}
        onRefresh={() => { setRefreshClicked(true); cp.refresh(); if (settings.tracked.length) compare.refresh() }}
        busy={cp.isFetching || compare.isFetching}
        refreshing={refreshClicked && (cp.isFetching || compare.isFetching)}
        refreshNote={refreshNote}
        onExport={exportPage}
        exportDisabled={page.status !== "success" || page.rows.length === 0}
      />

      {noDomain ? (
        <ErrorNote>This project&apos;s website URL does not have a public domain name, so its competitors cannot be loaded. Update the project URL in Settings.</ErrorNote>
      ) : (
        <>
          <ControlsBar state={state} update={update} excludedCount={settings.excluded.length} onManage={() => setManageOpen(true)} activeCount={activeCount} onReset={cp.resetSettings} />
          <LandscapeChart state={page} rows={page.rows} self={cp.self} highlight={highlight} onSelect={selectDomain} />
          <CompetitorsTable
            page={page}
            state={state}
            update={update}
            trackedSet={trackedSet}
            trackPending={trackPending}
            excludePending={excludePending}
            onToggleTrack={toggleTrack}
            onExclude={excludeRow}
            highlight={highlight}
            settingsActive={changed}
            onResetSettings={cp.resetSettings}
            viewKey={viewKey}
          />
          <CompareSection compare={compare} settings={settings} onNotify={notify} />
          <ManageExclusionsDialog open={manageOpen} onOpenChange={setManageOpen} settings={settings} onNotify={notify} />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
