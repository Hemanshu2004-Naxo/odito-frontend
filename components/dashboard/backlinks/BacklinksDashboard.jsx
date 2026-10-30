"use client"

import { useEffect, useState } from "react"
import { useProject } from "@/contexts/ProjectContext"
import { useBacklinks } from "@/hooks/useBacklinks"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { ErrorNote } from "@/components/dashboard/shared/parts"
import { domainFromUrl, formatExact } from "../domain-overview/format"
import ActiveFilters from "../organic-keywords/ActiveFilters"
import BacklinksHeader from "./BacklinksHeader"
import BacklinksTable from "./BacklinksTable"
import ExportDialog from "./ExportDialog"
import FilterBar from "./FilterBar"
import SummaryStrip from "./SummaryStrip"
import TabsBar from "./TabsBar"
import { backlinksCsvFileName, buildBacklinksCsv, downloadCsv } from "./exportCsv"
import { lastNumberedPage } from "./constants"

/**
 * Backlinks for the selected project: every individual link pointing at the domain — where it comes from, where it points, its anchor,
 * follow status, quality, dates and whether it is broken. Tabs (All / New / Lost / Broken), group-by, search, filters, multi-sort and
 * paging all run on the server (the table only ever holds one page); the whole view lives in the URL.
 */
export default function BacklinksDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Backlinks</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its backlinks.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's tab, filters or open rows carries over.
  return <ProjectBacklinks key={projectId} projectId={projectId} project={activeProject} />
}

function ProjectBacklinks({ projectId, project }) {
  const bl = useBacklinks(projectId)
  const { state, update, page, summary } = bl
  const { toasts, notify, dismiss } = useToastQueue()
  const [refreshClicked, setRefreshClicked] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const domain = bl.target ?? domainFromUrl(project?.main_url)

  // A page past the end (a hand-edited link, or a change that left fewer links) moves back to the last page that exists; a page beyond
  // the offset window cannot be requested by number at all.
  useEffect(() => {
    const window = lastNumberedPage(state.pageSize)
    if (state.page > window) { update({ page: window }); return }
    if (page.status !== "success" || page.stale || page.total === null) return
    const last = Math.min(Math.max(1, Math.ceil(page.total / state.pageSize)), window)
    if (state.page > last) update({ page: last })
  }, [page.status, page.stale, page.total, state.page, state.pageSize, update])

  const refreshNote = refreshClicked && !bl.isFetching && bl.refreshThrottled ? "This data was refreshed less than a minute ago, so it was not requested again." : null

  const exportPage = () => {
    downloadCsv(backlinksCsvFileName(domain, state.tab, "page"), buildBacklinksCsv(page.rows))
    notify(`Exported ${formatExact(page.rows.length)} backlinks from this page.`, "success")
  }

  const filterDomain = (d) => { update({ domainFrom: d }); window.scrollTo?.({ top: 0, behavior: "smooth" }) }
  const noDomain = page.status === "error" && page.error?.code === "INVALID_TARGET"
  const viewKey = JSON.stringify(bl.request)

  return (
    <div className="space-y-6">
      <BacklinksHeader
        domain={domain}
        updatedAt={bl.updatedAt}
        onRefresh={() => { setRefreshClicked(true); bl.refresh() }}
        busy={bl.isFetching}
        refreshing={refreshClicked && bl.isFetching}
        refreshNote={refreshNote}
        rowCount={page.rows.length}
        total={page.total}
        exportDisabled={page.status !== "success" || bl.built.tooMany}
        onExportPage={exportPage}
        onExportAll={() => setExportOpen(true)}
      />

      {noDomain ? (
        <ErrorNote>This project&apos;s website URL does not have a public domain name, so its backlinks cannot be loaded. Update the project URL in Settings.</ErrorNote>
      ) : (
        <>
          <SummaryStrip summary={summary} state={state} update={update} />
          <TabsBar tab={state.tab} group={state.group} counts={bl.tabCounts} onTab={(tab) => update({ tab })} onGroup={(group) => update({ group })} />
          <FilterBar state={state} update={update} built={bl.built} activeCount={bl.chips.length} onClearAll={bl.clearFilters} />
          <ActiveFilters chips={bl.chips} onRemove={(chip) => update(chip.clear)} onClearAll={bl.clearFilters} />
          <BacklinksTable
            page={page}
            state={state}
            update={update}
            onSort={bl.sortBy}
            onFilterDomain={filterDomain}
            activeCount={bl.chips.length}
            onClearAll={bl.clearFilters}
            viewKey={viewKey}
            pageNumber={state.page}
          />
          <ExportDialog open={exportOpen} onOpenChange={setExportOpen} projectId={projectId} request={bl.request} total={page.total} domain={domain} tab={state.tab} />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
