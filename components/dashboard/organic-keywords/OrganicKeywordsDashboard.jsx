"use client"

import { useEffect, useMemo, useState } from "react"
import { useProject } from "@/contexts/ProjectContext"
import { useOrganicKeywords } from "@/hooks/useOrganicKeywords"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { ErrorNote } from "@/components/dashboard/shared/parts"
import { domainFromUrl, formatExact } from "../domain-overview/format"
import ActiveFilters from "./ActiveFilters"
import FilterBar from "./FilterBar"
import KeywordsTable from "./KeywordsTable"
import OrganicKeywordsHeader from "./OrganicKeywordsHeader"
import SummaryCards from "./SummaryCards"
import { describeActiveFilters } from "./buildKeywordFilters"
import { EXPORT_ALL_LIMIT, lastReachablePage } from "./constants"
import { buildKeywordsCsv, downloadCsv, keywordsCsvFileName } from "./exportCsv"

/**
 * Organic Keywords for the selected project: every keyword the domain ranks for in Google, with position, movement, volume, difficulty,
 * intent, traffic and ranking URL. Search, filters, sorting and paging all run on the server (the table only ever holds one page);
 * the summary cards are the whole domain and do not change with the filters.
 */
export default function OrganicKeywordsDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Organic Keywords</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its organic keywords.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's filters or open rows carries over.
  return <ProjectOrganicKeywords key={projectId} projectId={projectId} project={activeProject} />
}

function ProjectOrganicKeywords({ projectId, project }) {
  const kw = useOrganicKeywords(projectId)
  const { state, update, page, totals } = kw
  const { toasts, notify, dismiss } = useToastQueue()
  const [refreshClicked, setRefreshClicked] = useState(false)
  const [exporting, setExporting] = useState(false)

  const chips = useMemo(() => describeActiveFilters(kw.effective), [kw.effective])
  const clearAll = kw.clearFilters
  const domain = kw.target ?? domainFromUrl(project?.main_url)

  // A page past the end (a hand-edited link, or a refresh that returned fewer keywords) moves back to the last page that exists.
  useEffect(() => {
    if (page.status !== "success" || page.stale || page.total === null) return
    const last = Math.min(Math.max(1, Math.ceil(page.total / state.pageSize)), lastReachablePage(state.pageSize))
    if (state.page > last) update({ page: last })
  }, [page.status, page.stale, page.total, state.page, state.pageSize, update])

  const refreshNote = refreshClicked && !kw.isFetching && kw.refreshThrottled
    ? "This data was refreshed less than a minute ago, so it was not requested again."
    : null

  const exportPage = () => {
    downloadCsv(keywordsCsvFileName(domain, "page"), buildKeywordsCsv(page.rows))
    notify(`Exported ${formatExact(page.rows.length)} keywords from this page.`, "success")
  }

  const exportAll = async () => {
    setExporting(true)
    try {
      const out = await kw.exportAll()
      downloadCsv(keywordsCsvFileName(domain, out.truncated ? `top-${EXPORT_ALL_LIMIT}` : "all"), buildKeywordsCsv(out.rows))
      notify(
        out.truncated
          ? `Exported the top ${formatExact(out.rows.length)} of ${formatExact(out.total)} keywords by current sort.`
          : `Exported ${formatExact(out.rows.length)} keywords.`,
        out.truncated ? "default" : "success",
      )
    } catch (err) {
      notify(err?.message && err.status ? err.message : "Could not export the keywords. Please try again.", "danger")
    } finally {
      setExporting(false)
    }
  }

  const noDomain = (page.status === "error" && page.error?.code === "INVALID_TARGET") || (totals.status === "error" && totals.error?.code === "INVALID_TARGET")
  // The unfiltered view with nothing at all: the empty state of the whole page, not "no match".
  const viewKey = JSON.stringify(kw.request)

  return (
    <div className="space-y-6">
      <OrganicKeywordsHeader
        domain={domain}
        market={kw.market}
        updatedAt={kw.updatedAt}
        onRefresh={() => { setRefreshClicked(true); kw.refresh() }}
        busy={kw.isFetching}
        refreshing={refreshClicked && kw.isFetching}
        refreshNote={refreshNote}
        exportProps={{
          pageRowCount: page.rows.length,
          total: page.total,
          busy: exporting,
          disabled: page.status !== "success" || kw.built.tooMany,
          onExportPage: exportPage,
          onExportAll: exportAll,
        }}
      />

      {noDomain ? (
        <ErrorNote>This project&apos;s website URL does not have a public domain name, so its keywords cannot be loaded. Update the project URL in Settings.</ErrorNote>
      ) : (
        <>
          <SummaryCards state={totals} summary={totals.summary} />
          <FilterBar state={state} update={update} built={kw.built} activeCount={chips.length} onClearAll={clearAll} hasBrandTerms={kw.brand.hasTerms} />
          <ActiveFilters chips={chips} onRemove={(chip) => update(chip.clear)} onClearAll={clearAll} />
          <KeywordsTable page={page} state={state} update={update} activeCount={chips.length} onClearAll={clearAll} viewKey={viewKey} />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
