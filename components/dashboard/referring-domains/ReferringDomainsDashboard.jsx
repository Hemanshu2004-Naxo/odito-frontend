"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"
import { useReferringDomains } from "@/hooks/useReferringDomains"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { Button } from "@/components/ui/button"
import { ErrorNote } from "@/components/dashboard/shared/parts"
import { domainFromUrl, formatExact } from "../domain-overview/format"
import ActiveFilters from "../organic-keywords/ActiveFilters"
import ExportDialog from "../backlinks/ExportDialog"
import DisavowDialog from "./DisavowDialog"
import FilterBar from "./FilterBar"
import RankDistribution from "./RankDistribution"
import ReferringDomainsHeader from "./ReferringDomainsHeader"
import ReferringDomainsTable from "./ReferringDomainsTable"
import SummaryStrip from "./SummaryStrip"
import TabsBar from "./TabsBar"
import ToxicAlert from "./ToxicAlert"
import { buildReferringDomainsCsv, downloadCsv, referringDomainsCsvFileName } from "./exportCsv"
import { downloadReferringDomainsExport } from "./exportStream"
import { EMPTY_FILTERS } from "./buildReferringDomainRequest"

/**
 * Referring Domains for the selected project: every website linking to the domain, with its authority, link counts, follow status, spam and
 * broken-link data, a quality rating, the toxic ones to review and a Google disavow file. Tabs, search, filters, sort and paging run on the
 * server (the table only ever holds one page); the whole view lives in the URL.
 *
 * Disavowing a domain or marking it OK changes only OUR saved lists: the screen updates from them and nothing is requested from the data provider.
 */
export default function ReferringDomainsDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Referring Domains</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its referring domains.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's tab, filters, selection or open row carries over.
  return <ProjectReferringDomains key={projectId} projectId={projectId} project={activeProject} />
}

const ACTION_TEXT = {
  disavow: { one: (d) => `${d} was added to your disavow list.`, many: (n) => `${formatExact(n)} domains were added to your disavow list.` },
  undisavow: { one: (d) => `${d} was removed from your disavow list.`, many: (n) => `${formatExact(n)} domains were removed from your disavow list.` },
  markOk: { one: (d) => `${d} was marked as OK.`, many: (n) => `${formatExact(n)} domains were marked as OK.` },
  unmarkOk: { one: (d) => `The OK mark was removed from ${d}.`, many: (n) => `The OK mark was removed from ${formatExact(n)} domains.` },
}

function ProjectReferringDomains({ projectId, project }) {
  const rd = useReferringDomains(projectId)
  const { state, update, page, lists } = rd
  const domain = rd.target ?? domainFromUrl(project?.main_url)
  const { toasts, notify, dismiss } = useToastQueue()
  const [refreshClicked, setRefreshClicked] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [disavowOpen, setDisavowOpen] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const tableRef = useRef(null)

  const viewKey = JSON.stringify([state.tab, rd.request, state.tab === "disavowed" ? [state.q, state.page, state.pageSize] : null])
  // A selection belongs to the view it was made in.
  useEffect(() => { setSelected(new Set()) }, [viewKey])

  const refreshNote = refreshClicked && !rd.isFetching && rd.refreshThrottled ? "This data was refreshed less than a minute ago, so it was not requested again." : null
  const disavowedTab = rd.isDisavowedTab
  const noDomain = page.status === "error" && page.error?.code === "INVALID_TARGET"

  const act = async (kind, domains) => {
    const res = await lists[kind](domains)
    if (!res.ok) { notify(res.message, "error"); return false }
    if (res.unchanged) return true
    notify(domains.length === 1 ? ACTION_TEXT[kind].one(domains[0]) : ACTION_TEXT[kind].many(domains.length), "success")
    return true
  }
  const onAction = (kind, row) => act(kind, [row.domain])
  const selectedList = useMemo(() => [...selected], [selected])
  const bulk = async (kind) => { if (await act(kind, selectedList)) setSelected(new Set()) }

  const toggleSelect = (d) => setSelected((prev) => { const next = new Set(prev); if (next.has(d)) next.delete(d); else next.add(d); return next })
  const toggleAll = (domains, on) => setSelected((prev) => { const next = new Set(prev); for (const d of domains) { if (on) next.add(d); else next.delete(d) } return next })

  const exportPage = () => {
    downloadCsv(referringDomainsCsvFileName(domain, state.tab === "all" ? "page" : `${state.tab}_page`), buildReferringDomainsCsv(page.rows))
    notify(`Exported ${formatExact(page.rows.length)} referring domains from this page.`, "success")
  }
  const exportSelected = () => {
    const rows = page.loadedRows.filter((r) => selected.has(r.domain))
    downloadCsv(referringDomainsCsvFileName(domain, "selected"), buildReferringDomainsCsv(rows))
    notify(`Exported ${formatExact(rows.length)} selected referring domains.`, "success")
  }

  const scrollToTable = () => tableRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
  // A bar of the rank chart applies its range to the table (the Disavowed tab has no rank filter, so it goes back to All).
  const selectBucket = (b) => {
    const applied = state.minRank === String(b.min) && state.maxRank === (b.max === null ? "" : String(b.max))
    update(applied ? { minRank: "", maxRank: "" } : { minRank: String(b.min), maxRank: b.max === null ? "" : String(b.max), tab: disavowedTab ? "all" : state.tab })
    if (!applied) scrollToTable()
  }
  const reviewToxic = () => { update({ ...EMPTY_FILTERS, quality: [], tab: "toxic" }); scrollToTable() }

  const noFilters = rd.chips.length === 0
  const bulkCount = selected.size

  return (
    <div className="space-y-6">
      <ReferringDomainsHeader
        domain={domain}
        updatedAt={rd.updatedAt}
        onRefresh={() => { setRefreshClicked(true); rd.refresh() }}
        busy={rd.isFetching || disavowedTab}
        refreshing={refreshClicked && rd.isFetching}
        refreshNote={refreshNote}
        rowCount={page.rows.length}
        total={page.total}
        exportPageDisabled={page.status !== "success" || !page.rows.length}
        exportAllDisabled={page.status !== "success" || rd.built.tooMany || disavowedTab}
        disavowCount={lists.disavowed.length}
        onExportPage={exportPage}
        onExportAll={() => setExportOpen(true)}
        onExportDisavow={() => setDisavowOpen(true)}
      />

      {noDomain ? (
        <ErrorNote>This project&apos;s website URL does not have a public domain name, so its referring domains cannot be loaded. Update the project URL in Settings.</ErrorNote>
      ) : (
        <>
          <SummaryStrip summary={rd.summary} />

          <div className="grid grid-cols-1 gap-4 @min-[1000px]/main:grid-cols-2">
            <RankDistribution buckets={rd.buckets} state={state} onSelect={selectBucket} />
            <ToxicAlert toxic={rd.toxic} disavowedCount={lists.disavowed.length} onReview={reviewToxic} onDownload={() => setDisavowOpen(true)} />
          </div>

          <div ref={tableRef} className="scroll-mt-4 space-y-4">
            <TabsBar tab={state.tab} counts={rd.tabCounts} onTab={(tab) => update({ tab })} />
            <FilterBar state={state} update={update} built={rd.built} activeCount={rd.chips.length} onClearAll={rd.clearFilters} />
            <ActiveFilters chips={rd.chips} onRemove={(chip) => update(chip.clear)} onClearAll={rd.clearFilters} />

            {bulkCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm" role="region" aria-label="Bulk actions" data-testid="rd-bulk">
                <span className="mr-1 font-medium" data-testid="rd-bulk-count">{formatExact(bulkCount)} selected</span>
                {disavowedTab ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => bulk("undisavow")} disabled={lists.saving} data-testid="rd-bulk-undisavow">Remove selected from disavow</Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => bulk("disavow")} disabled={lists.saving} data-testid="rd-bulk-disavow">Disavow selected</Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => bulk("markOk")} disabled={lists.saving} data-testid="rd-bulk-ok">Mark selected as OK</Button>
                <Button type="button" size="sm" variant="outline" onClick={exportSelected} data-testid="rd-bulk-export">Export selected</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection" data-testid="rd-bulk-clear"><X className="size-4" aria-hidden /> Clear</Button>
              </div>
            ) : null}

            <ReferringDomainsTable
              page={page}
              state={state}
              update={update}
              onSort={rd.sortBy}
              viewKey={viewKey}
              noFilters={noFilters}
              listEmpty={lists.disavowed.length === 0}
              onClearAll={rd.clearFilters}
              onAction={onAction}
              saving={lists.saving}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
            />
          </div>

          <ExportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            projectId={projectId}
            request={rd.request}
            total={page.total}
            domain={domain}
            tab={state.tab}
            noun="referring domains"
            title="Export referring domains"
            description="Everything matching the current tab and filters, as a CSV file."
            idPrefix="rd"
            download={downloadReferringDomainsExport}
            fileName={(scope) => referringDomainsCsvFileName(domain, `${state.tab}_${scope}`)}
          />
          <DisavowDialog open={disavowOpen} onOpenChange={setDisavowOpen} domains={lists.disavowed} target={domain} />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
