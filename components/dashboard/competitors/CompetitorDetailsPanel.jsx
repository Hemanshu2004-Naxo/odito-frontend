"use client"

import { ChevronUp, ExternalLink, Loader2, MapPin, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MISSING, formatExact } from "../domain-overview/format"
import { formatDateTime } from "../referring-domains/format"
import { DomainLink } from "./cells"
import { Metric, StatusChip } from "./EnrichmentCells"
import { SECTION_LABELS, canRefresh, sectionText, statusMeta } from "./enrichmentUi"
import SharedKeywordsList from "./SharedKeywordsList"
import { SOURCE_LABEL } from "./MyCompetitorsTable"
import RelevanceCell from "./RelevanceCell"

const mapsUrl = (c) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name)}&query_place_id=${encodeURIComponent(c.placeId)}`

function Section({ title, children, testId }) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

const Stat = ({ label, children, hint }) => (
  <div className="rounded-lg border border-border/60 p-3">
    <dt className="text-xs text-muted-foreground" title={hint}>{label}</dt>
    <dd className="mt-0.5 text-base font-semibold">{children}</dd>
  </div>
)

const BUCKETS = [["pos_1", "#1"], ["pos_2_3", "#2–3"], ["pos_4_10", "#4–10"], ["pos_11_20", "#11–20"]]

/** The distribution of the competitor's keywords by position, from the saved numbers. Missing buckets are left out, never drawn as empty. */
function Positions({ positions }) {
  const known = BUCKETS.filter(([k]) => typeof positions?.[k] === "number")
  if (known.length === 0) return null
  const max = Math.max(1, ...known.map(([k]) => positions[k]))
  return (
    <ul className="space-y-1.5" aria-label="Keywords by position" data-testid="mc-positions">
      {known.map(([k, label]) => (
        <li key={k} className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 text-muted-foreground">{label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="presentation"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (positions[k] / max) * 100)}%` }} /></span>
          <span className="w-14 shrink-0 text-right tabular-nums">{formatExact(positions[k])}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The details of one competitor, shown INLINE under its row (a dropdown, not a side drawer). It is drawn from the list the page already
 * holds, so opening it makes no request for the numbers; only the saved shared-keyword list is read (one GET of what is stored).
 * Refresh only queues work for the background worker. Local facts from Google (rating, reviews, category, status) are deliberately not
 * stored, so they are not here: they are shown in Local Competitors from Google's live results.
 */
export default function CompetitorDetailsPanel({ competitor, id, onClose, onRefresh, refreshing, assessments = null, onOverride, onClearOverride, onReassess }) {
  const c = competitor
  const e = c?.enrichment
  if (!c) return null
  return (
    <div id={id} role="region" aria-label={`Details of ${c.name}`} className="space-y-5 px-4 py-5 sm:px-6" data-testid="mc-details-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{c.name}</h3>
          {c.domain ? <DomainLink domain={c.domain} /> : <span className="text-sm text-muted-foreground">No website</span>}
          <StatusChip enrichment={e} />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} data-testid="mc-d-close">
          <ChevronUp className="size-4" aria-hidden />Hide details
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
                <Section title="Business" testId="mc-d-business">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Address</dt><dd>{c.address ?? MISSING}</dd></div>
                    <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Source</dt><dd>{[...new Set((c.provenance?.length ? c.provenance.map((p) => p.kind) : [c.source]))].map((k) => SOURCE_LABEL[k] ?? k).join(", ")}</dd></div>
                    {c.notes ? <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap">{c.notes}</dd></div> : null}
                    {c.branches?.length ? (
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-muted-foreground">{c.branches.length > 1 ? "Locations" : "Location"}</dt>
                        <dd className="space-y-1">
                          {c.branches.map((b) => (
                            <div key={b.placeId} className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden /><span>{b.address ?? "Address not saved"}</span></div>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {c.placeId ? (
                    <a href={mapsUrl(c)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline" data-testid="mc-maps-link">
                      Open in Google Maps <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : null}
                </Section>

                <Section title="Business relevance" testId="mc-d-relevance">
                  {c.domain ? (
                    <>
                      <RelevanceCell domain={c.domain} assessment={assessments?.byDomain?.get(c.domain)} busy={assessments?.pending?.has(c.domain)} onOverride={onOverride} onClear={onClearOverride} onReassess={onReassess} />
                      <p className="text-xs text-muted-foreground">Whether this website is a business that competes with yours, judged from its website and your project. It is separate from the SEO numbers below.</p>
                    </>
                  ) : <p className="text-sm text-muted-foreground">Add a website to check whether this is a business that competes with you.</p>}
                </Section>

                <Section title="Data status" testId="mc-d-status">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex gap-2"><dt className="w-32 shrink-0 text-muted-foreground">Status</dt><dd>{statusMeta(e).hint}</dd></div>
                    <div className="flex gap-2"><dt className="w-32 shrink-0 text-muted-foreground">Last updated</dt><dd>{e?.lastSuccessAt ? formatDateTime(e.lastSuccessAt) : "Never"}</dd></div>
                    {Object.keys(SECTION_LABELS).map((k) => {
                      const sec = e?.sections?.[k] ?? null
                      return (
                        <div key={k} className="flex gap-2">
                          <dt className="w-32 shrink-0 text-muted-foreground">{SECTION_LABELS[k]}</dt>
                          <dd data-testid={`mc-section-${k}`}>
                            {sectionText(sec)}{sec?.errorCode ? ` (${sec.errorCode})` : ""}
                            {sec?.fetchedAt ? <span className="block text-xs text-muted-foreground">Fetched {formatDateTime(sec.fetchedAt)}</span> : null}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                  {c.domain ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => onRefresh(c)} disabled={refreshing || !canRefresh(c)} data-testid="mc-d-refresh">
                      {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                      {e?.status === "failed" || e?.status === "partial" ? "Try again" : e?.status === "not_started" ? "Get SEO metrics" : "Refresh SEO metrics"}
                    </Button>
                  ) : <p className="text-sm text-muted-foreground">Add a website to this competitor to get its SEO metrics.</p>}
                </Section>
        </div>
        <div className="min-w-0 space-y-6">
                <Section title="SEO overview" testId="mc-d-seo">
                  <dl className="grid grid-cols-2 gap-2">
                    <Stat label="Organic traffic" hint="Estimated monthly visits from Google organic search."><Metric value={e?.metrics?.organicTraffic ?? null} enrichment={e} section="rank" /></Stat>
                    <Stat label="Ranking keywords"><Metric value={e?.metrics?.rankingKeywords ?? null} enrichment={e} section="rank" /></Stat>
                    <Stat label="Shared keywords" hint="Keywords you and this competitor both rank for. Not this competitor's total ranking keywords."><Metric value={e?.metrics?.sharedKeywords ?? null} enrichment={e} section="shared" /></Stat>
                    <Stat label="#1 rankings"><Metric value={e?.metrics?.pos1 ?? null} enrichment={e} section="rank" /></Stat>
                    <Stat label="Top 3 rankings"><Metric value={e?.metrics?.top3 ?? null} enrichment={e} section="rank" /></Stat>
                    <Stat label="Top 10 rankings"><Metric value={e?.metrics?.top10 ?? null} enrichment={e} section="rank" /></Stat>
                    <Stat label="Backlinks"><Metric value={e?.metrics?.backlinks ?? null} enrichment={e} section="backlinks" /></Stat>
                    <Stat label="Referring domains"><Metric value={e?.metrics?.referringDomains ?? null} enrichment={e} section="backlinks" /></Stat>
                    <Stat label="DataForSEO rank" hint="The data provider's own link-strength score (0-1000). It is not Domain Authority or Domain Rating."><Metric value={e?.metrics?.dataforseoRank ?? null} enrichment={e} section="backlinks" /></Stat>
                  </dl>
                  <Positions positions={e?.metrics?.positions} />
                  <p className="text-xs text-muted-foreground">Traffic and keyword numbers are the data provider's estimates{e?.market ? ` for ${e.market.location}` : ""}, not measured figures. A dash means the figure is not available, never zero.</p>
                </Section>

                <Section title="Shared keywords" testId="mc-d-shared">
                  <SharedKeywordsList competitor={c} />
                </Section>
        </div>
      </div>

            <Section title="Local" testId="mc-d-local">
              <p className="text-sm text-muted-foreground">Distance, Google rating, reviews and business status are shown in Local Competitors from Google&apos;s live results. They are not saved here, because Google does not allow storing them.</p>
            </Section>
    </div>
  )
}
