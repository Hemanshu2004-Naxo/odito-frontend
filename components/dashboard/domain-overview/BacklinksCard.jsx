"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { BACKLINK_OVERVIEW_HREF } from "./KpiCards"
import OverviewCard, { FooterLink } from "./OverviewCard"
import { SectionBoundary, Skel } from "./SectionState"
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
      <div className={cn("mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tabular-nums", tone === "bad" && "text-red-600 dark:text-red-400")}>
        <span title={exact}>{value}</span>
        {children}
      </div>
      {caption ? <div className="mt-0.5 text-[11px] text-muted-foreground">{caption}</div> : null}
    </>
  )
  const box = "min-w-0 rounded-xl border border-border/60 px-3.5 py-3"
  if (!href) return <div className={box} data-testid={testId}>{body}</div>
  return (
    <Link href={href} className={cn(box, "block transition-colors hover:border-foreground/30", FOCUS)} data-testid={testId} aria-label={`${label}: ${value}. ${linkLabel}`}>
      {body}
    </Link>
  )
}

const Skeleton = () => (
  <div className="space-y-3" aria-hidden>
    <div className="grid grid-cols-2 gap-3 @min-[900px]/main:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-[84px] rounded-xl" />)}</div>
    <Skel className="h-6 w-full" />
  </div>
)

const MINUS = "−"

/** "+17 new · −14 lost linking sites, last 30 days" — new and lost each open that tab of Referring Domains. */
export function RdLast30({ last30 }) {
  const d = last30?.data
  if (!last30 || last30.status === "loading") return <Skel className="h-4 w-48" />
  if (last30.status === "error") {
    return (
      <div data-testid="do-rd-last30">
        <p role="alert" className="flex items-center gap-2 text-xs text-muted-foreground">
          Last 30 days unavailable
          <button type="button" onClick={last30.refetch} className={cn("rounded font-medium text-foreground underline-offset-2 hover:underline", FOCUS)}>Retry</button>
        </p>
      </div>
    )
  }
  if (!d) return null
  return (
    <p className="text-xs text-muted-foreground tabular-nums" data-testid="do-rd-last30" title={d.since ? `Since ${d.since}` : undefined}>
      {d.new === null ? MISSING : (
        <Link href={referringDomainsHref("new")} className={cn("rounded font-semibold text-emerald-600 hover:underline dark:text-emerald-400", FOCUS)} aria-label={`${formatExact(d.new)} new referring domains. Open the New tab`} data-testid="do-rd-new">+{formatCompact(d.new)} new</Link>
      )}
      <span aria-hidden> · </span>
      {d.lost === null ? MISSING : (
        <Link href={referringDomainsHref("lost")} className={cn("rounded font-semibold text-red-600 hover:underline dark:text-red-400", FOCUS)} aria-label={`${formatExact(d.lost)} lost referring domains. Open the Lost tab`} data-testid="do-rd-lost">{MINUS}{formatCompact(d.lost)} lost</Link>
      )}
      {" "}linking sites, last 30 days
    </p>
  )
}

/** "Link text mix": one 100% bar of linking-site share by anchor type. Only PEEKED from the cache: when it is not there, a line says where to get it. */
export function AnchorMix({ anchorMix }) {
  const { status, data } = anchorMix
  const heading = <div className="mb-2 text-[13px] font-semibold">Link text mix <span className="font-normal text-muted-foreground">(share of linking sites)</span></div>
  if (status === "loading") return <div>{heading}<Skel className="h-3 w-full rounded-full" /></div>
  if (status === "error") return <div>{heading}<p className="text-xs text-muted-foreground" data-testid="do-anchor-mix-error">The link text mix is unavailable right now.</p></div>
  if (status === "uncached" || !data) {
    return (
      <div>
        {heading}
        <p className="text-xs text-muted-foreground" data-testid="do-anchor-mix-empty">
          <Link href={ANCHORS} className={cn("rounded font-medium text-foreground underline-offset-2 hover:underline", FOCUS)}>Open Anchors to analyse your anchor mix</Link>
        </p>
      </div>
    )
  }
  const summary = data.segments.map((s) => `${s.label} ${formatPercent1(s.percent)}`).join(", ")
  return (
    <Link href={ANCHORS} className={cn("block rounded-lg", FOCUS)} aria-label={`Link text mix: ${summary}. Open Anchors`} data-testid="do-anchor-mix">
      {heading}
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Link text mix: ${summary}`}>
        {data.segments.map((s) => <div key={s.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${s.percent}%`, backgroundColor: s.color }} title={`${s.label}: ${formatPercent1(s.percent)}`} data-testid="do-anchor-segment" data-type={s.key} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {data.segments.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label} <span className="tabular-nums">{formatPercent1(s.percent)}</span>
          </li>
        ))}
      </ul>
    </Link>
  )
}

/**
 * "Backlink health" on the Domain Overview: a short summary of the backlink profile, from the SAME backlinks response the cards above
 * already use (so it costs no extra request), with a link to the full Backlink Overview page. Every tile opens the page that shows its
 * numbers; the last-30-days line and the link text mix come from the hub. `summary` is mapBacklinkSummary() of the backlinks section.
 */
export default function BacklinksCard({ state, summary: s, last30, anchorMix }) {
  const empty = s?.hasBacklinks === false
  const dofollow = s?.derived.dofollowDomainsPercent ?? null
  const since = s?.age?.short ? `profile ${s.age.short.charAt(0).toLowerCase()}${s.age.short.slice(1)}` : null

  return (
    <OverviewCard
      title="Backlink health"
      description={["Off-page summary", since].filter(Boolean).join(" · ")}
      action={<RdLast30 last30={last30} />}
      footer={state?.status === "success" && !empty ? <FooterLink href={BACKLINK_OVERVIEW_HREF} testId="do-backlinks-link">Full backlink overview</FooterLink> : null}
    >
      <SectionBoundary state={state} skeleton={<Skeleton />} empty={empty} emptyMessage="No backlinks found for this domain yet.">
        <div className="space-y-5" data-testid="do-backlinks">
          <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-3 @min-[1000px]/main:grid-cols-5">
            <Stat label="Domain rank" value={formatCompact(s?.rank ?? null)} exact={formatExact(s?.rank ?? null)} caption="out of 1,000" href={BACKLINK_OVERVIEW_HREF} linkLabel="Open the Backlink Overview" testId="do-bl-rank" />
            <Stat label="Spam score" value={s?.spam.score ?? MISSING} caption="out of 100" href={referringDomainsHref("toxic")} linkLabel="Open the high-spam referring domains" testId="do-bl-spam">
              {s?.spam.band ? <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", BAND_STYLE[s.spam.band.key])} data-band={s.spam.band.key}>{s.spam.band.label}</span> : null}
            </Stat>
            <Stat label="Linking pages" value={formatCompact(s?.totals.referringPages)} exact={formatExact(s?.totals.referringPages)} caption={s?.totals.referringIps === null || s?.totals.referringIps === undefined ? MISSING : `from ${formatCompact(s.totals.referringIps)} IPs`} href={BACKLINKS_LIST} linkLabel="Open the Backlinks list" testId="do-bl-pages" />
            <Stat
              label="Dofollow sites"
              value={dofollow === null ? MISSING : formatPercent1(dofollow)}
              caption={s?.derived.dofollowDomains === null || s?.derived.dofollowDomains === undefined ? MISSING : `${formatExact(s.derived.dofollowDomains)} of ${formatExact(s.totals.referringDomains)} sites`}
              href={REFERRING_DOMAINS}
              linkLabel="Open Referring Domains"
              testId="do-bl-dofollow"
            />
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

          <AnchorMix anchorMix={anchorMix} />
        </div>
      </SectionBoundary>
    </OverviewCard>
  )
}
