"use client"

import { AlertTriangle, ArrowDown, ArrowUp, ExternalLink, Layers, MapPin, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTrackedKeywordDetails } from "@/hooks/useKeywordQueries"
import InfoHint from "../../referring-domains/InfoHint"
import { formatDateTime } from "../../referring-domains/format"
import { MISSING, formatCompact, formatExact } from "../../domain-overview/format"
import { googleSearchUrl } from "../../organic-keywords/constants"
import { formatBidRange, formatCompetition, formatCpc } from "../../organic-keywords/format"
import { Fact } from "../../organic-keywords/ExpandedKeywordDetails"
import { FEATURE_ICON, IntentBadge } from "../../organic-keywords/cells"
import MonthlyVolumeChart from "../../organic-keywords/MonthlyVolumeChart"
import { mapTrackedKeywordDetails } from "./mapTrackedKeywordDetails"
import RankHistoryChart from "./RankHistoryChart"

/**
 * The expanded row of a tracked keyword: overview, 12-month search volume, desktop / mobile ranking with history, SERP features, paid
 * competition, and the ranking page's backlinks. It fetches only when it is mounted (a row mounts it on expand), and each optional
 * source can be missing without hiding the rest: a figure that is not available is "—", with the reason said next to it.
 */

// ── small pieces ───────────────────────────────────────────────────────────────────────────────────────────────────────

function Section({ title, hint, children, className }) {
  return (
    <section className={cn("min-w-0", className)}>
      <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">{title}{hint ? <InfoHint label={title} text={hint} /> : null}</h3>
      {children}
    </section>
  )
}

function Notice({ tone = "muted", children, testId }) {
  return (
    <p data-testid={testId} className={cn("flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs", tone === "warn" ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
      {tone === "warn" ? <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden /> : null}
      <span>{children}</span>
    </p>
  )
}

/** Why the provider figures are missing, in plain words. null when they are there. */
const METRICS_NOTICE = {
  no_data: "The data provider has no search data for this keyword in this market, so volume and difficulty are not shown. This is not the same as zero searches.",
  error: "Search volume, difficulty and CPC could not be loaded right now. Your rankings below are unaffected. Collapse and re-open this row to try again.",
  rate_limited: "Too many keyword lookups in a short time. Volume and difficulty will load when you re-open this row in a few minutes.",
  not_configured: "Keyword research data is not enabled on this server, so volume and difficulty are not shown.",
  unavailable: "Search volume and difficulty are not available for this keyword.",
}

const NO_VOLUME_NOTICE = "The data provider did not report a search volume for this keyword, usually because it is searched too rarely to measure. That is not the same as zero."

/** "▲ 3" improved, "▼ 2" declined, "–" unchanged; nothing at all when there is nothing to compare with. */
export function Delta({ value, label }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">{MISSING}</span>
  if (value === 0) return <span className="inline-flex items-center gap-0.5 text-muted-foreground" aria-label={`${label}: no change`}><Minus className="size-3" aria-hidden />0</span>
  const up = value > 0
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")} aria-label={`${label}: ${up ? "improved" : "declined"} by ${Math.abs(value)}`}>
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}{Math.abs(value)}
    </span>
  )
}

const RANK_COPY = {
  not_collected: (d, name) => ({ main: "Not checked", sub: `${name} ranking has not been collected for this keyword yet. Rescan it to collect it.` }),
  scan_error: (d) => ({ main: d.position !== null ? `#${d.position}` : "Scan failed", sub: d.position !== null ? "Last known position. The most recent check failed, so this may be out of date." : "The last check failed, so the position is unknown. This is not a confirmed ranking." }),
  not_ranked: (d) => ({ main: "Not ranked", sub: d.depth ? `Not found in the top ${d.depth} results.` : "Not found in the results returned." }),
  ranked: (d) => ({ main: `#${d.position}`, sub: null }),
}

/** One device's position: its state in words, never a 0. */
function DeviceRank({ name, d }) {
  const copy = RANK_COPY[d.status](d, name)
  const tone = d.status === "ranked" ? "text-foreground" : d.status === "scan_error" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-card px-3 py-2.5" data-testid={`rank-${name.toLowerCase()}`} data-status={d.status}>
      <div className="text-xs text-muted-foreground">{name}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", tone)}>{copy.main}</div>
      {copy.sub ? <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{copy.sub}</p> : null}
      {d.status === "ranked" || d.status === "scan_error" ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Previous scan</dt>
          <dd className="flex items-center gap-1.5 tabular-nums">{d.previous !== null ? <>#{d.previous} <Delta value={d.sinceLastScan} label="Since last scan" /></> : MISSING}</dd>
          <dt className="text-muted-foreground">A week ago</dt>
          <dd className="flex items-center gap-1.5 tabular-nums">{d.prevWeek !== null ? <>#{d.prevWeek} <Delta value={d.sinceWeek} label="Since a week ago" /></> : MISSING}</dd>
          <dt className="text-muted-foreground">A month ago</dt>
          <dd className="flex items-center gap-1.5 tabular-nums">{d.prevMonth !== null ? <>#{d.prevMonth} <Delta value={d.sinceMonth} label="Since a month ago" /></> : MISSING}</dd>
          <dt className="text-muted-foreground">Best</dt>
          <dd className="tabular-nums">{d.best !== null ? `#${d.best}` : MISSING}</dd>
          <dt className="text-muted-foreground">When first tracked</dt>
          <dd className="tabular-nums">{d.benchmark !== null ? `#${d.benchmark}` : MISSING}</dd>
        </dl>
      ) : null}
      {d.urls.length ? (
        <ul className="mt-2 space-y-1" data-testid={`rank-urls-${name.toLowerCase()}`}>
          {d.urls.slice(0, 5).map((u, i) => (
            <li key={u.url} className="flex min-w-0 items-center gap-2 text-xs">
              <span className="shrink-0 rounded bg-muted px-1.5 py-px font-medium tabular-nums">#{u.rank}</span>
              <a href={u.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" title={u.url} data-testid={i === 0 ? `rank-url-${name.toLowerCase()}` : undefined}>
                {u.type === "homepage" ? "Homepage" : u.url.replace(/^https?:\/\/(www\.)?/, "")}<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function VolumeSummary({ d }) {
  const change = d.volumeChange
  if (!change) return null
  const up = change.percent > 0
  return (
    <p className="mt-1.5 text-xs text-muted-foreground" data-testid="volume-change">
      {change.to.label}: <span className="font-medium text-foreground tabular-nums">{formatExact(change.to.volume)}</span>
      {" "}
      <span className={cn("tabular-nums", change.percent === 0 ? "" : up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
        ({change.percent === 0 ? "no change" : `${up ? "+" : "−"}${Math.abs(change.percent).toFixed(0)}%`} vs {change.from.label})
      </span>
    </p>
  )
}

// ── states ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

function DetailsSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite" data-testid="kw-details-loading">
      <span className="sr-only">Loading keyword details</span>
      <div className="grid grid-cols-2 gap-2 @min-[620px]/main:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      <div className="grid gap-4 @min-[760px]/main:grid-cols-2">
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
      </div>
    </div>
  )
}

function DetailsError({ error, onRetry }) {
  const gone = error?.status === 404
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-4 py-3" role="alert" data-testid="kw-details-error">
      <p className="flex items-center gap-2 text-sm"><AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />{gone ? "This keyword is no longer tracked in this project." : "Could not load this keyword's details."}</p>
      {gone ? null : <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

// ── the panel ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export default function TrackedKeywordDetails({ projectId, keywordId, keyword, id }) {
  const query = useTrackedKeywordDetails({ projectId, keywordId, enabled: true })
  const d = query.data ? mapTrackedKeywordDetails(query.data) : null

  return (
    <div id={id} role="region" aria-label={`Details for ${keyword}`} className="px-4 py-4 @min-[980px]/main:pl-14" data-testid="kw-details">
      {query.isPending ? <DetailsSkeleton /> : null}
      {query.isError ? <DetailsError error={query.error} onRetry={() => query.refetch()} /> : null}
      {d ? <Loaded d={d} keyword={keyword} /> : null}
    </div>
  )
}

function Loaded({ d, keyword }) {
  // The provider answered but reported no volume (too few searches to measure): say so, because "—" alone could read as "not loaded".
  const noVolumeReported = d.availability.keywordMetrics === "ok" && d.volume === null
  const metricsNotice = noVolumeReported ? NO_VOLUME_NOTICE : (METRICS_NOTICE[d.availability.keywordMetrics] ?? null)
  const hasFeatures = d.serpFeatures.length > 0
  const googleUrl = d.googleUrl ?? googleSearchUrl(keyword)
  const depth = d.desktop.depth ?? 100
  return (
    <div className="grid gap-5">
      {metricsNotice ? <Notice tone={noVolumeReported || d.availability.keywordMetrics === "no_data" || d.availability.keywordMetrics === "unavailable" ? "muted" : "warn"} testId="kw-metrics-notice">{metricsNotice}</Notice> : null}

      {/* A. overview */}
      <Section title="Overview">
        <dl className="grid grid-cols-2 gap-2 @min-[620px]/main:grid-cols-3 @min-[980px]/main:grid-cols-6">
          <Fact label="Search volume" hint={`Average searches per month${d.market ? ` in ${d.market.location}` : ""}. It is the keyword's market-wide demand, not how many people saw your site.`}>
            <span title={formatExact(d.volume)} data-testid="kw-volume">{formatCompact(d.volume)}</span>
          </Fact>
          <Fact label="Difficulty (KD)" hint="How hard it is to rank in Google's top 10 for this keyword, from 0 (easy) to 100 (hard).">
            {d.difficulty === null ? MISSING : (
              <span className="inline-flex items-center gap-1.5" title={d.kdBand ? `${d.kdBand.label} to rank for` : undefined} data-testid="kw-kd">
                {d.difficulty}
                {d.kdBand ? <><span className={cn("size-2 rounded-full", d.kdBand.dot)} aria-hidden /><span className="sr-only">{d.kdBand.label}</span></> : null}
              </span>
            )}
          </Fact>
          <Fact label="Intent" hint="What the searcher wants: information, a specific site, to compare options, or to buy.">
            {d.intent ? <span className="inline-flex items-center gap-1.5"><IntentBadge intent={d.intent} /><span className="text-xs font-normal">{d.intent.label}</span></span> : MISSING}
          </Fact>
          <Fact label="Desktop position" hint="Where this site ranks on Google desktop results at the project's location.">
            <span data-testid="kw-desktop-position">{d.desktop.position !== null ? `#${d.desktop.position}` : d.desktop.status === "not_ranked" ? "Not ranked" : d.desktop.status === "scan_error" ? "Scan failed" : "Not checked"}</span>
          </Fact>
          <Fact label="Mobile position" hint="Where this site ranks on Google mobile results at the project's location.">
            <span data-testid="kw-mobile-position">{d.mobile.position !== null ? `#${d.mobile.position}` : d.mobile.status === "not_ranked" ? "Not ranked" : d.mobile.status === "scan_error" ? "Scan failed" : "Not checked"}</span>
          </Fact>
          <Fact label="Last checked">
            <span className="text-xs font-normal" data-testid="kw-last-checked">{d.lastScannedAt ? formatDateTime(d.lastScannedAt.toISOString()) : MISSING}</span>
          </Fact>
        </dl>
      </Section>

      <div className="grid gap-5 @min-[900px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* B. search volume history */}
        <Section title="Searches per month" hint="Monthly search volume for this keyword over the last 12 months the provider reports.">
          {d.monthly.some((m) => m.volume !== null)
            ? <><MonthlyVolumeChart months={d.monthly} keyword={keyword} /><VolumeSummary d={d} /></>
            : <p className="text-sm text-muted-foreground" data-testid="kw-volume-empty">{d.availability.keywordMetrics === "ok" || d.availability.keywordMetrics === "no_data" ? "No monthly search history is available for this keyword." : "Monthly search history is not available right now."}</p>}
        </Section>

        {/* C. ranking */}
        <Section title="Ranking" hint="Desktop and mobile are scanned separately, so they can differ. Positions are organic results at the project's location.">
          <div className="grid gap-2 @min-[620px]/main:grid-cols-2">
            <DeviceRank name="Desktop" d={d.desktop} />
            <DeviceRank name="Mobile" d={d.mobile} />
          </div>
          <div className="mt-3">
            {d.availability.rankHistory === "error"
              ? <Notice tone="warn" testId="kw-history-error">Ranking history could not be loaded right now.</Notice>
              : <RankHistoryChart desktop={d.history.desktop} mobile={d.history.mobile} keyword={keyword} depth={depth} windowDays={d.history.windowDays ?? 180} />}
          </div>
          {d.maps.position !== null || d.maps.listing ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs" data-testid="kw-maps">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <div className="font-medium">Google Maps {d.maps.position !== null ? `#${d.maps.position}` : "listing"}{d.maps.listing?.title ? ` · ${d.maps.listing.title}` : ""}</div>
                {d.maps.listing ? <div className="text-muted-foreground">{[d.maps.listing.rating !== null && d.maps.listing.rating !== undefined ? `${d.maps.listing.rating} ★` : null, typeof d.maps.listing.reviews === "number" ? `${d.maps.listing.reviews.toLocaleString()} reviews` : null, d.maps.listing.address].filter(Boolean).join(" · ")}</div> : null}
              </div>
            </div>
          ) : null}
        </Section>
      </div>

      <div className="grid gap-5 @min-[760px]/main:grid-cols-3">
        {/* D. SERP features */}
        <Section title="SERP features" hint="Special results Google shows on the first page for this keyword, besides the ten blue links.">
          {hasFeatures ? (
            <ul className="flex flex-wrap gap-1.5" data-testid="kw-serp-features">
              {d.serpFeatures.map((f) => {
                const Icon = FEATURE_ICON[f.key] ?? Layers
                return <li key={f.key} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"><Icon className="size-3.5" aria-hidden />{f.label}</li>
              })}
            </ul>
          ) : <p className="text-sm text-muted-foreground" data-testid="kw-serp-empty">{d.availability.keywordMetrics === "ok" ? "No special results were found for this keyword." : "SERP features are not available for this keyword."}</p>}
        </Section>

        {/* E. competition & advertising */}
        <Section title="Competition & advertising">
          <dl className="grid grid-cols-2 gap-2">
            <Fact label="Competition" hint="How many advertisers bid on this keyword in Google Ads (low, medium or high). It describes paid competition, not how hard it is to rank organically — see KD for that."><span data-testid="kw-competition">{formatCompetition(d.competition)}</span></Fact>
            <Fact label="CPC" hint="The average cost per click advertisers pay for this keyword."><span data-testid="kw-cpc">{formatCpc(d.cpc)}</span></Fact>
            <Fact label="Top-of-page bid" hint="The range advertisers pay per click to appear above the organic results for this keyword."><span data-testid="kw-bid">{formatBidRange(d.lowBid, d.highBid)}</span></Fact>
          </dl>
        </Section>

        {/* F. backlinks */}
        <Section title="Ranking page backlinks" hint="Websites and links pointing at the page that ranks for this keyword.">
          <dl className="grid grid-cols-2 gap-2">
            <Fact label="Referring domains" hint="Websites that link to the ranking page."><span data-testid="kw-referring-domains">{formatExact(d.referringDomains)}</span></Fact>
            <Fact label="Backlinks" hint="Links pointing at the ranking page."><span data-testid="kw-backlinks">{formatExact(d.backlinks)}</span></Fact>
          </dl>
          {d.referringDomains === null && d.backlinks === null ? (
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground" data-testid="kw-backlinks-empty">Not available for this keyword yet. These come from your Organic Keywords data, so they are filled in once that keyword has been loaded there.</p>
          ) : null}
        </Section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" data-testid="kw-view-google">
            View in Google <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
          </a>
        </Button>
        {d.metricsFetchedAt ? <span className="text-[11px] text-muted-foreground" data-testid="kw-fetched-at">Search data from {formatDateTime(d.metricsFetchedAt.toISOString())}</span> : null}
      </div>
    </div>
  )
}
