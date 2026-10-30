"use client"

import { useEffect, useRef, useState } from "react"
import { Info, X } from "lucide-react"
import { EMPTY_ANCHOR_LABEL } from "@/lib/anchors/anchorConfig"
import { useProject } from "@/contexts/ProjectContext"
import { useAnchors } from "@/hooks/useAnchors"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { ErrorNote } from "@/components/dashboard/shared/parts"
import { domainFromUrl, formatExact } from "../domain-overview/format"
import ActiveFilters from "../organic-keywords/ActiveFilters"
import AnchorSettingsDialog from "./AnchorSettingsDialog"
import AnchorsHeader from "./AnchorsHeader"
import AnchorsTable from "./AnchorsTable"
import FilterBar from "./FilterBar"
import ProfileHealth from "./ProfileHealth"
import SummaryCards from "./SummaryCards"
import TopAnchorsChart from "./TopAnchorsChart"
import TypeDistribution from "./TypeDistribution"
import { anchorsCsvFileName, buildAnchorsCsv, downloadCsv } from "./exportCsv"
import { SETTINGS_BANNER } from "./constants"

/**
 * Anchors for the selected project: every anchor text used in links pointing to the domain, with how many sites and links use it, its
 * quality and its broken links — each sorted into a type (branded, exact match, partial match, naked URL, generic, empty, other) so the
 * overall anchor profile shows over-optimisation or spam patterns.
 *
 * The cards, the donut, the top-anchors chart and the health checks come from ONE cached profile call (the top 1,000 anchors) and are
 * recalculated in the browser when the brand terms or target keywords change. The table is a separate, server-side request (status,
 * filters, sort and page); its whole view lives in the URL.
 */
export default function AnchorsDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Anchors</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its anchors.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's filters, open row or settings dialog carries over.
  return <ProjectAnchors key={projectId} projectId={projectId} project={activeProject} />
}

const bannerKey = (projectId) => `odito:anchors:settings-banner:${projectId}`
const readDismissed = (projectId) => { try { return window.localStorage.getItem(bannerKey(projectId)) === "1" } catch { return false } }

function ProjectAnchors({ projectId, project }) {
  const projectDomain = domainFromUrl(project?.main_url)
  const an = useAnchors(projectId, projectDomain)
  const { state, update, page, profile, settings } = an
  const domain = an.target ?? projectDomain
  const { toasts, notify, dismiss } = useToastQueue()
  const [refreshClicked, setRefreshClicked] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(() => readDismissed(projectId))
  const tableRef = useRef(null)

  // "No brand terms or target keywords": until the project has some of each, the types cannot be accurate.
  const needsSettings = settings.status !== "loading" && (!settings.saved || settings.settings.targetKeywords.length === 0)
  const showBanner = needsSettings && !bannerDismissed
  const dismissBanner = () => {
    setBannerDismissed(true)
    try { window.localStorage.setItem(bannerKey(projectId), "1") } catch { /* the banner just comes back next time */ }
  }
  useEffect(() => { setBannerDismissed(readDismissed(projectId)) }, [projectId])

  const refreshNote = refreshClicked && !an.isFetching && an.refreshThrottled ? "This data was refreshed less than a minute ago, so it was not requested again." : null

  const exportPage = () => {
    downloadCsv(anchorsCsvFileName(domain, "page", state.status), buildAnchorsCsv(page.rows))
    notify(`Exported ${formatExact(page.rows.length)} anchors from this page.`, "success")
  }
  const exportAll = () => {
    downloadCsv(anchorsCsvFileName(domain, "all"), buildAnchorsCsv(profile.rows))
    notify(`Exported ${formatExact(profile.rows.length)} anchors.`, "success")
  }

  // A click on a bar of the top-anchors chart filters the table to that exact anchor; a second click on it clears the filter.
  const selectedAnchor = state.exactEmpty ? EMPTY_ANCHOR_LABEL : state.exact
  const selectAnchor = (row) => {
    const same = selectedAnchor !== null && selectedAnchor === (row.isEmpty ? EMPTY_ANCHOR_LABEL : row.anchor)
    update(same ? { exact: null, exactEmpty: false } : row.isEmpty ? { exact: null, exactEmpty: true } : { exact: row.anchor, exactEmpty: false })
    if (!same) tableRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
  }

  const noDomain = page.status === "error" && page.error?.code === "INVALID_TARGET"
  const viewKey = JSON.stringify(an.request)
  const noAnchorsAtAll = an.chips.length === 0

  return (
    <div className="space-y-6">
      <AnchorsHeader
        domain={domain}
        updatedAt={an.updatedAt}
        status={state.status}
        onStatus={(status) => update({ status })}
        onRefresh={() => { setRefreshClicked(true); an.refresh() }}
        busy={an.isFetching}
        refreshing={refreshClicked && an.isFetching}
        refreshNote={refreshNote}
        rowCount={page.rows.length}
        profileCount={profile.rows.length}
        exportPageDisabled={page.status !== "success" || !page.rows.length}
        exportAllDisabled={profile.status !== "success" || !profile.rows.length}
        onExportPage={exportPage}
        onExportAll={exportAll}
        onSettings={() => setSettingsOpen(true)}
      />

      {noDomain ? (
        <ErrorNote>This project&apos;s website URL does not have a public domain name, so its anchors cannot be loaded. Update the project URL in Settings.</ErrorNote>
      ) : (
        <>
          {showBanner ? (
            <div className="flex items-start gap-3 rounded-xl border border-sky-300/60 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100" role="status" data-testid="an-settings-banner">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="flex-1">
                {SETTINGS_BANNER}{" "}
                <button type="button" onClick={() => setSettingsOpen(true)} className="font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Anchor settings</button>
              </p>
              <button type="button" onClick={dismissBanner} aria-label="Dismiss" className="grid size-6 shrink-0 place-items-center rounded hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-sky-500/20" data-testid="an-banner-dismiss">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}

          <SummaryCards profile={profile} />

          <div className="grid grid-cols-1 gap-4 @min-[1000px]/main:grid-cols-2">
            <TypeDistribution profile={profile} />
            <ProfileHealth profile={profile} />
          </div>

          <TopAnchorsChart profile={profile} onSelect={selectAnchor} selected={selectedAnchor} />

          <div ref={tableRef} className="scroll-mt-4 space-y-4">
            <FilterBar state={state} update={update} built={an.built} activeCount={an.chips.length} onClearAll={an.clearFilters} />
            <ActiveFilters chips={an.chips} onRemove={(chip) => update(chip.clear)} onClearAll={an.clearFilters} />
            <AnchorsTable
              page={page}
              state={state}
              update={update}
              onSort={an.sortBy}
              activeCount={an.chips.length}
              onClearAll={an.clearFilters}
              viewKey={viewKey}
              totalReferringDomains={an.totalReferringDomains ?? profile.summary?.totals.referringDomains ?? null}
              noAnchorsAtAll={noAnchorsAtAll}
            />
          </div>

          <AnchorSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            api={settings}
            profileRows={profile.rows}
            targetDomain={projectDomain}
            onSaved={() => notify("Anchor settings saved. The anchor types were updated.", "success")}
          />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
