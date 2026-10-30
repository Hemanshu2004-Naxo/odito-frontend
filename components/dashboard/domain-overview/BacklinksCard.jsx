"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Panel } from "@/components/dashboard/shared/parts"
import { cn } from "@/lib/utils"
import { mapBacklinkSummary } from "../backlinks-overview/mapBacklinkSummary"
import { BACKLINK_OVERVIEW_HREF } from "./KpiCards"
import { SectionError, SectionBoundary, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "./format"
import { ANCHORS, BACKLINKS_LIST, BROKEN_BACKLINKS, REFERRING_DOMAINS, referringDomainsHref } from "./hubLinks"

const BAND_STYLE = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** A tile. With an `href` the WHOLE tile is the link (keyboard focusable, visible focus ring). */
function Stat({ label, value, exact, caption, tone, testId, href, linkLabel, children }) {
  const body = (
    <>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 flex flex-wrap items-center gap-2 text-xl font-semibold tabular-nums", tone === "bad" && "text-red-600 dark:text-red-400")}>
        <span title={exact}>{value}</span>
        {children}
      </div>
      {caption ? <div className="mt-0.5 text-[11px] text-muted-foreground">{caption}</div> : null}
    </>
  )
  const box = "min-w-0 rounded-lg border border-border/60 px-3 py-2.5"
  if (!href) return <div className={box} data-testid={testId}>{body}</div>
  return (
    <Link href={href} className={cn(box, "block transition-colors hover:border-foreground/30", FOCUS)} data-testid={testId} aria-label={`${label}: ${value}. ${linkLabel}`}>
      {body}
    </Link>
  )
}

const Skeleton = () => (
  <div className="space-y-3" aria-hidden>
    <div className="grid grid-cols-2 gap-3 @min-[900px]/main:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skel key={i} className="h-[74px] rounded-lg" />)}</div>
    <Skel className="h-6 w-full" />
  </div>
)

const MINUS = "−"

/** "Referring domains - last 30 days": "+41 new · −12 lost" since the Monday the window starts on. New and lost each open that tab. */
export function RdLast30({ last30 }) {
  const d = last30.data
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2.5" data-testid="do-rd-last30">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-xs text-muted-foreground">Referring domains — last 30 days</span>
        {d?.since ? <span className="text-[11px] text-muted-foreground" data-testid="do-rd-since">Since {d.since}</span> : null}
      </div>
      {last30.status === "loading" ? <Skel className="mt-1.5 h-7 w-48" /> : null}
      {last30.status === "error" ? <SectionError className="mt-2 p-3" message={last30.error?.message} onRetry={last30.refetch} /> : null}
      {last30.status === "success" && !d ? <p className="mt-1 text-sm text-muted-foreground">{MISSING}</p> : null}
      {last30.status === "success" && d ? (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xl font-semibold tabular-nums">
          {d.new === null ? <span className="text-muted-foreground">{MISSING}</span> : (
            <Link href={referringDomainsHref("new")} className={cn("rounded text-emerald-600 hover:underline dark:text-emerald-400", FOCUS)} aria-label={`${formatExact(d.new)} new referring domains. Open the New tab`} data-testid="do-rd-new">+{formatCompact(d.new)} new</Link>
          )}
          <span className="text-muted-foreground" aria-hidden>·</span>
          {d.lost === null ? <span className="text-muted-foreground">{MISSING}</span> : (
            <Link href={referringDomainsHref("lost")} className={cn("rounded text-red-600 hover:underline dark:text-red-400", FOCUS)} aria-label={`${formatExact(d.lost)} lost referring domains. Open the Lost tab`} data-testid="do-rd-lost">{MINUS}{formatCompact(d.lost)} lost</Link>
          )}
        </p>
      ) : null}
    </div>
  )
}

/** "Anchor mix": one 100% bar of referring-domain share by anchor type. Only PEEKED from the cache: when it is not there, a line says where to get it. */
export function AnchorMix({ anchorMix }) {
  const { status, data } = anchorMix
  if (status === "loading") return <Skel className="h-12 w-full rounded-lg" />
  if (status === "error") return <p className="text-xs text-muted-foreground" data-testid="do-anchor-mix-error">The anchor mix is unavailable right now.</p>
  if (status === "uncached" || !data) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="do-anchor-mix-empty">
        <Link href={ANCHORS} className={cn("rounded font-medium text-foreground underline-offset-2 hover:underline", FOCUS)}>Open Anchors to analyse your anchor mix</Link>
      </p>
    )
  }
  const summary = data.segments.map((s) => `${s.label} ${formatPercent1(s.percent)}`).join(", ")
  return (
    <Link href={ANCHORS} className={cn("block rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:border-foreground/30", FOCUS)} aria-label={`Anchor mix: ${summary}. Open Anchors`} data-testid="do-anchor-mix">
      <div className="mb-1.5 text-xs text-muted-foreground">Anchor mix <span className="text-[11px]">(share of referring domains)</span></div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Anchor mix: ${summary}`}>
        {data.segments.map((s) => <div key={s.key} className="h-full" style={{ width: `${s.percent}%`, backgroundColor: s.color }} title={`${s.label}: ${formatPercent1(s.percent)}`} data-testid="do-anchor-segment" data-type={s.key} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {data.segments.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label} <span className="text-muted-foreground tabular-nums">{formatPercent1(s.percent)}</span>
          </li>
        ))}
      </ul>
    </Link>
  )
}

/**
 * "Backlink overview" on the Domain Overview: a short summary of the backlink profile, from the SAME backlinks response the three
 * cards above already use (so it costs no extra request), with a link to the full Backlink Overview page. Every tile opens the page that
 * shows its numbers; the last-30-days tiles and the anchor mix come from the hub.
 */
export default function BacklinksCard({ state, last30, anchorMix }) {
  const s = useMemo(() => mapBacklinkSummary(state?.data?.result), [state?.data])
  const empty = s?.hasBacklinks === false
  const countriesBreakdown = s?.breakdowns.countries
  // Known countries only (Worldwide is known); the untracked part is its own muted item.
  const countries = countriesBreakdown ? countriesBreakdown.entries.filter((e) => !e.isOthers).slice(0, 3) : []
  const unknown = countriesBreakdown?.unknown ?? null
  const dofollow = s?.derived.dofollowDomainsPercent ?? null

  return (
    <Panel
      title="Backlink overview"
      description="Quality and health of the links pointing at your site"
      action={(
        <Link href={BACKLINK_OVERVIEW_HREF} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline underline-offset-2" data-testid="do-backlinks-link">
          View full overview <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
      className="min-w-0"
    >
      <SectionBoundary state={state} skeleton={<Skeleton />} empty={empty} emptyMessage="No backlinks found for this domain yet.">
        <div className="space-y-4" data-testid="do-backlinks">
          <div className="grid grid-cols-2 gap-3 @min-[900px]/main:grid-cols-4">
            <Stat label="Referring pages" value={formatCompact(s?.totals.referringPages)} exact={formatExact(s?.totals.referringPages)} caption={s?.totals.referringIps === null || s?.totals.referringIps === undefined ? MISSING : `${formatCompact(s.totals.referringIps)} IPs`} href={BACKLINKS_LIST} linkLabel="Open the Backlinks list" testId="do-bl-pages" />
            <Stat label="Dofollow domains" value={dofollow === null ? MISSING : formatPercent1(dofollow)} caption={s?.derived.dofollowDomains === null || s?.derived.dofollowDomains === undefined ? MISSING : `${formatCompact(s.derived.dofollowDomains)} domains`} href={REFERRING_DOMAINS} linkLabel="Open Referring Domains" testId="do-bl-dofollow" />
            <Stat label="Spam score" value={s?.spam.score ?? MISSING} caption={`Site's own: ${s?.spam.siteScore ?? MISSING}`} href={referringDomainsHref("toxic")} linkLabel="Open the high-spam referring domains" testId="do-bl-spam">
              {s?.spam.band ? <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", BAND_STYLE[s.spam.band.key])} data-band={s.spam.band.key}>{s.spam.band.label}</span> : null}
            </Stat>
            <Stat
              label="Broken backlinks"
              value={formatCompact(s?.totals.brokenBacklinks)}
              exact={formatExact(s?.totals.brokenBacklinks)}
              tone={(s?.totals.brokenBacklinks ?? 0) > 0 ? "bad" : null}
              caption={s?.derived.brokenBacklinksPercent === null || s?.derived.brokenBacklinksPercent === undefined ? MISSING : `${formatPercent1(s.derived.brokenBacklinksPercent)} of links`}
              href={BROKEN_BACKLINKS}
              linkLabel="Open the broken backlinks"
              testId="do-bl-broken"
            />
          </div>

          <RdLast30 last30={last30} />

          <div className="grid gap-4 @min-[900px]/main:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>Dofollow vs nofollow domains</span><span className="tabular-nums">{dofollow === null ? MISSING : `${formatPercent1(dofollow)} dofollow`}</span></div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={dofollow === null ? "Dofollow share unknown" : `${formatPercent1(dofollow)} of referring domains are dofollow`}>
                {dofollow !== null ? <div className="h-full bg-primary" style={{ width: `${Math.max(dofollow, 1)}%` }} data-testid="do-bl-dofollow-bar" /> : null}
              </div>
            </div>
            <div className="text-xs text-muted-foreground" data-testid="do-bl-countries">
              <div className="mb-1.5">Top link countries <span className="text-[11px]">(of links with a known country)</span></div>
              {countries.length || unknown ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
                  {countries.map((c) => <li key={c.key} title={`${formatExact(c.count)} links`} data-testid="do-country"><span aria-hidden>{c.flag}</span> {c.label} <span className="text-muted-foreground tabular-nums">{formatPercent1(c.percent)}</span></li>)}
                  {unknown ? <li className="text-muted-foreground" title={`${formatExact(unknown.count)} links with no known country`} data-testid="do-country-unknown">Unknown <span className="tabular-nums">{formatPercent1(unknown.percent)}</span></li> : null}
                </ul>
              ) : <span>{MISSING}</span>}
            </div>
          </div>

          <AnchorMix anchorMix={anchorMix} />
        </div>
      </SectionBoundary>
    </Panel>
  )
}
