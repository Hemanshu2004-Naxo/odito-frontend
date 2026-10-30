"use client"

import { useRef, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"
import { useTopPages } from "@/hooks/useTopPages"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { Button } from "@/components/ui/button"
import { ErrorNote } from "@/components/dashboard/shared/parts"
import { domainFromUrl, formatExact } from "../domain-overview/format"
import ActiveFilters from "../organic-keywords/ActiveFilters"
import ExportDialog from "../backlinks/ExportDialog"
import FilterBar from "./FilterBar"
import FixFirst from "./FixFirst"
import SummaryStrip from "./SummaryStrip"
import TabsBar from "./TabsBar"
import TopPagesHeader from "./TopPagesHeader"
import TopPagesTable from "./TopPagesTable"
import { buildTopPagesCsv, downloadCsv, topPagesCsvFileName } from "./exportCsv"
import { downloadTopPagesExport } from "./exportStream"

/**
 * Top Pages for the selected project: every page of the domain that has backlinks, with its HTTP status, backlink and referring-domain counts,
 * authority, on-page info and estimated organic traffic — and the pages that waste link value (error pages and redirects with backlinks) or need
 * more links. Tabs, search, filters, sort and paging run on the server (the table only ever holds one page); the whole view lives in the URL.
 * The flag filter and "Merge URL variants" work on the rows already loaded.
 */
export default function TopPagesDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Top Pages</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its top pages.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's tab, filters or open row carries over.
  return <ProjectTopPages key={projectId} projectId={projectId} project={activeProject} />
}

function ProjectTopPages({ projectId, project }) {
  const projectDomain = domainFromUrl(project?.main_url)
  const tp = useTopPages(projectId, projectDomain)
  const { state, update, page } = tp
  const domain = tp.target || projectDomain
  const { toasts, notify, dismiss } = useToastQueue()
  const [refreshClicked, setRefreshClicked] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const tableRef = useRef(null)

  const refreshNote = refreshClicked && !tp.isFetching && tp.refreshThrottled ? "This data was refreshed less than a minute ago, so it was not requested again." : null
  const noDomain = page.status === "error" && page.error?.code === "INVALID_TARGET"
  const viewKey = JSON.stringify([state.tab, tp.request, state.merge, state.flags])
  const referringDomainsTotal = tp.summary.data?.totals.referringDomains ?? null

  const openTab = (tab) => { update({ tab }); tableRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }) }

  const exportPage = () => {
    downloadCsv(topPagesCsvFileName(domain, state.tab === "all" ? "page" : `${state.tab}_page`), buildTopPagesCsv(page.rows))
    notify(`Exported ${formatExact(page.rows.length)} pages from this page.`, "success")
  }
  const copyUrl = async (row) => {
    try {
      await navigator.clipboard.writeText(row.url)
      notify("URL copied.", "success")
    } catch {
      notify("Couldn't copy the URL. Copy it from the page link instead.", "error")
    }
  }

  return (
    <div className="space-y-6">
      <TopPagesHeader
        domain={domain}
        updatedAt={tp.updatedAt}
        onRefresh={() => { setRefreshClicked(true); tp.refresh() }}
        busy={tp.isFetching}
        refreshing={refreshClicked && tp.isFetching}
        refreshNote={refreshNote}
        rowCount={page.rows.length}
        total={page.total}
        exportPageDisabled={page.status !== "success" || !page.rows.length}
        exportAllDisabled={page.status !== "success" || tp.built.tooMany}
        onExportPage={exportPage}
        onExportAll={() => setExportOpen(true)}
      />

      {noDomain ? (
        <ErrorNote>This project&apos;s website URL does not have a public domain name, so its pages cannot be loaded. Update the project URL in Settings.</ErrorNote>
      ) : (
        <>
          <SummaryStrip counts={tp.counts} summary={tp.summary} onOpenTab={openTab} />
          <FixFirst fixFirst={tp.fixFirst} onOpenErrors={() => openTab("errors")} />

          <div ref={tableRef} className="scroll-mt-4 space-y-4">
            <TabsBar tab={state.tab} counts={tp.tabCounts} onTab={(tab) => update({ tab })} merge={state.merge} onMerge={(merge) => update({ merge, page: state.page })} />
            <FilterBar state={state} update={update} built={tp.built} activeCount={tp.chips.length} onClearAll={tp.clearFilters} />
            <ActiveFilters chips={tp.chips} onRemove={(chip) => update(chip.clear)} onClearAll={tp.clearFilters} />

            {tp.traffic.failed ? (
              <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="tp-traffic-warning">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                <span>The estimated traffic could not be loaded, so that column shows “—”. Everything else is up to date.</span>
                <Button type="button" variant="outline" size="sm" onClick={tp.traffic.retry} disabled={tp.traffic.retrying} data-testid="tp-traffic-retry">
                  {tp.traffic.retrying ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Retry
                </Button>
              </p>
            ) : null}

            <TopPagesTable
              page={page}
              state={state}
              update={update}
              onSort={tp.sortBy}
              viewKey={viewKey}
              noFilters={tp.chips.length === 0}
              onClearAll={tp.clearFilters}
              onCopy={copyUrl}
              referringDomainsTotal={referringDomainsTotal}
              trafficTruncated={tp.traffic.truncated}
            />
          </div>

          <ExportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            projectId={projectId}
            request={tp.request}
            total={page.total}
            domain={domain}
            tab={state.tab}
            noun="pages"
            title="Export top pages"
            description="Everything matching the current tab and filters, with each page's estimated traffic, as a CSV file."
            idPrefix="tp"
            download={downloadTopPagesExport}
            fileName={(scope) => topPagesCsvFileName(domain, `${state.tab}_${scope}`)}
          />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
