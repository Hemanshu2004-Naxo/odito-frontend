"use client"

import { Eye, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import InfoHint from "../referring-domains/InfoHint"
import { DomainLink } from "./cells"
import { Metric, StatusChip, UpdatedAt } from "./EnrichmentCells"
import RelevanceCell from "./RelevanceCell"
import { canRefresh } from "./enrichmentUi"

const SOURCE_LABEL = { manual: "Added by you", seo: "From SEO", local: "From Local", legacy: "Imported", social: "From Social profile" }
export { SOURCE_LABEL }

function IconAction({ label, onClick, disabled, children, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testId}
      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/** The four row actions. Details never calls a provider; Refresh only queues work for the background worker. */
function RowActions({ c, busy, onDetails, onRefresh, onEdit, onRemove }) {
  const refreshable = canRefresh(c)
  return (
    <div className="flex justify-end gap-0.5">
      <IconAction label={`View details of ${c.name}`} onClick={() => onDetails(c)} testId="mc-details"><Eye className="size-4" aria-hidden /></IconAction>
      <IconAction label={`Refresh SEO metrics of ${c.name}`} disabled={busy || !refreshable} onClick={() => onRefresh(c)} testId="mc-refresh">
        <RefreshCw className="size-4" aria-hidden />
      </IconAction>
      <IconAction label={`Edit ${c.name}`} disabled={busy} onClick={() => onEdit(c)}><Pencil className="size-4" aria-hidden /></IconAction>
      <IconAction label={`Remove ${c.name}`} disabled={busy} onClick={() => onRemove(c)}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
      </IconAction>
    </div>
  )
}

function Identity({ c }) {
  return (
    <>
      <button type="button" onClick={c.__open} className="block max-w-full truncate text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" title={c.name}>{c.name}</button>
      {c.domain ? <DomainLink domain={c.domain} className="text-xs font-normal text-muted-foreground" /> : <span className="text-xs text-muted-foreground">No website</span>}
      {c.branches?.length > 1 ? <span className="ml-1 text-[11px] text-muted-foreground" title="This business has several locations">· {c.branches.length} locations</span> : null}
    </>
  )
}

const head = (label, hint, extra = "") => (
  <TableHead className={`text-right ${extra}`}>
    <span className="inline-flex items-center justify-end gap-1">{label}{hint ? <InfoHint label={label} text={hint} /> : null}</span>
  </TableHead>
)

/**
 * My Competitors as a table (sm and up) and as cards (phones). The columns thin out as the screen narrows: competitor + status + actions
 * always, then traffic, ranking keywords, last updated, and on wide screens shared keywords, #1 rankings and referring domains.
 * Every number comes from the saved enrichment; nothing here causes a provider call.
 */
export default function MyCompetitorsTable({ rows, pending, onDetails, onRefresh, onEdit, onRemove, assessments = null, onOverride, onClearOverride, onReassess }) {
  const relevance = (domain) => (domain ? <RelevanceCell domain={domain} assessment={assessments?.byDomain?.get(domain)} busy={assessments?.pending?.has(domain)} onOverride={onOverride} onClear={onClearOverride} onReassess={onReassess} /> : <span className="text-xs text-muted-foreground" title="Add a website to check whether this is a business that competes with you">—</span>)
  return (
    <>
      <div className="hidden sm:block">
        <Table data-testid="mc-table">
          <TableHeader>
            <TableRow>
              <TableHead>Competitor</TableHead>
              <TableHead className="hidden lg:table-cell">Business relevance</TableHead>
              {head("Shared keywords", "Keywords both you and this competitor rank for in Google (provider data for your project's country). It is not this competitor's total ranking keywords.", "hidden xl:table-cell")}
              {head("Organic traffic", "Estimated monthly visits from Google organic search. An estimate from the data provider, not a measured figure.", "hidden md:table-cell")}
              {head("Ranking keywords", "How many keywords this website ranks for in Google (provider estimate for your project's country).", "hidden lg:table-cell")}
              {head("#1 rankings", "Keywords where this website ranks first.", "hidden xl:table-cell")}
              {head("Referring domains", "Other websites that link to this one (provider data).", "hidden xl:table-cell")}
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Updated</TableHead>
              <TableHead className="w-36"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((raw) => {
              const c = { ...raw, __open: () => onDetails(raw) }
              const e = c.enrichment
              return (
                <TableRow key={c.id} data-testid="mc-row" data-id={c.id}>
                  <TableCell className="max-w-[260px]"><Identity c={c} /></TableCell>
                  <TableCell className="hidden lg:table-cell" data-testid="mc-relevance">{relevance(raw.domain)}</TableCell>
                  <TableCell className="hidden text-right xl:table-cell" data-testid="mc-shared">
                    {typeof e?.metrics?.sharedKeywords === "number" && e.metrics.sharedKeywords > 0
                      ? <button type="button" onClick={() => onDetails(raw)} className="rounded underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${e.metrics.sharedKeywords} shared keywords. Open the list`}><Metric value={e.metrics.sharedKeywords} enrichment={e} section="shared" /></button>
                      : <Metric value={e?.metrics?.sharedKeywords ?? null} enrichment={e} section="shared" />}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell"><Metric value={e?.metrics?.organicTraffic ?? null} enrichment={e} section="rank" /></TableCell>
                  <TableCell className="hidden text-right lg:table-cell"><Metric value={e?.metrics?.rankingKeywords ?? null} enrichment={e} section="rank" /></TableCell>
                  <TableCell className="hidden text-right xl:table-cell"><Metric value={e?.metrics?.pos1 ?? null} enrichment={e} section="rank" /></TableCell>
                  <TableCell className="hidden text-right xl:table-cell"><Metric value={e?.metrics?.referringDomains ?? null} enrichment={e} section="backlinks" /></TableCell>
                  <TableCell><StatusChip enrichment={e} /></TableCell>
                  <TableCell className="hidden lg:table-cell"><UpdatedAt enrichment={e} /></TableCell>
                  <TableCell><RowActions c={raw} busy={pending.has(raw.id)} onDetails={onDetails} onRefresh={onRefresh} onEdit={onEdit} onRemove={onRemove} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 sm:hidden" data-testid="mc-cards">
        {rows.map((raw) => {
          const c = { ...raw, __open: () => onDetails(raw) }
          const e = c.enrichment
          return (
            <li key={`card-${c.id}`} className="rounded-lg border border-border/70 p-3" data-testid="mc-card" data-id={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><Identity c={c} /></div>
                <StatusChip enrichment={e} />
              </div>
              <div className="mt-2">{relevance(raw.domain)}</div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">Organic traffic</dt><dd><Metric value={e?.metrics?.organicTraffic ?? null} enrichment={e} section="rank" /></dd></div>
                <div><dt className="text-xs text-muted-foreground">Ranking keywords</dt><dd><Metric value={e?.metrics?.rankingKeywords ?? null} enrichment={e} section="rank" /></dd></div>
                <div><dt className="text-xs text-muted-foreground">Shared keywords</dt><dd><Metric value={e?.metrics?.sharedKeywords ?? null} enrichment={e} section="shared" /></dd></div>
              </dl>
              <div className="mt-2 flex items-center justify-between gap-2">
                <UpdatedAt enrichment={e} />
                <RowActions c={raw} busy={pending.has(raw.id)} onDetails={onDetails} onRefresh={onRefresh} onEdit={onEdit} onRemove={onRemove} />
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
