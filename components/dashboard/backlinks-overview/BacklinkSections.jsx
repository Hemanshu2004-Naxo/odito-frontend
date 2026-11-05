"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Check, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import OverviewCard from "../domain-overview/OverviewCard"
import { SectionBoundary, SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import { LINKS } from "./constants"
import { SOURCE_VIEWS, buildFixList, buildFollowRows, buildSourceView, mainAndIps, perSite } from "./backlinkInsights"

const NAVY = "#0d1a3a"
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
const CARD = "rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
const SPAM_TEXT = { low: "text-emerald-300", medium: "text-amber-300", high: "text-red-300" }

/** The arc gauge: 240° of track, filled to rank ÷ 1,000. */
function RankGauge({ percent }) {
  const r = 80
  const start = (210 * Math.PI) / 180
  const end = (-30 * Math.PI) / 180
  const pt = (a) => [100 + r * Math.cos(a), 100 - r * Math.sin(a)]
  const [x1, y1] = pt(start)
  const [x2, y2] = pt(end)
  const d = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`
  return (
    <svg viewBox="0 0 200 170" className="h-auto w-full max-w-[230px]" aria-hidden>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="14" strokeLinecap="round" />
      {percent !== null ? <path d={d} fill="none" stroke="#2fd18b" strokeWidth="14" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.max(percent, 0.5)} 100`} data-testid="bo-rank-gauge" /> : null}
    </svg>
  )
}

/** "Link strength": the domain rank on an arc gauge, what it means, and the spam score on a green-to-red scale with a marker. */
export function LinkStrengthCard({ state, summary: s }) {
  const loading = !state || state.status === "loading"
  return (
    <section className="flex min-w-0 flex-col rounded-2xl px-6 py-5 text-white shadow-sm dark:ring-1 dark:ring-white/10" style={{ background: NAVY }} aria-label="Link strength" data-testid="bo-authority">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Link strength</p>
      {state?.status === "error" ? <SectionError className="mt-4 p-3" message={state.error?.message} onRetry={state.refetch} /> : (
        <div className="mt-2 grid flex-1 items-center gap-6 @min-[700px]/main:grid-cols-[minmax(0,230px)_minmax(0,1fr)]">
          <div className="relative mx-auto w-full max-w-[230px]" data-testid="bo-rank">
            <RankGauge percent={loading ? null : s?.rankPercent ?? null} />
            <div className="absolute inset-x-0 top-[38%] text-center">
              {loading ? <Skel className="mx-auto h-10 w-24 bg-white/15" /> : (
                <>
                  <div className="text-5xl font-semibold tracking-tight tabular-nums" title={formatExact(s?.rank)} data-testid="bo-rank-value">{formatCompact(s?.rank)}</div>
                  <div className="mt-1 text-xs text-white/75">Domain rank / {(s?.rankMax ?? 1000).toLocaleString("en-US")}</div>
                </>
              )}
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <p className="text-[15px] leading-relaxed text-white/90">Overall strength of the sites linking to you. It rises when strong, relevant sites link in and falls with spam.</p>
            <div data-testid="bo-spam">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-white/85">Spam score</span>
                {loading ? <Skel className="h-4 w-24 bg-white/15" /> : (
                  <span className={cn("font-semibold tabular-nums", SPAM_TEXT[s?.spam.band?.key] ?? "text-white")}>
                    <span data-testid="bo-spam-value">{s?.spam.score ?? MISSING}</span> / 100{s?.spam.band ? <> · <span data-testid="bo-spam-badge" data-band={s.spam.band.key}>{s.spam.band.label}</span></> : null}
                  </span>
                )}
              </div>
              <div className="relative mt-2 h-2.5 rounded-full" style={{ background: "linear-gradient(90deg,#2fd18b 0%,#a3d94b 30%,#f5b83d 60%,#f43f5e 100%)" }} role="meter" aria-label="Spam score out of 100" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s?.spam.score ?? undefined}>
                {typeof s?.spam.score === "number" ? <span className="absolute -top-1 h-[18px] w-1 rounded-full bg-white shadow" style={{ left: `calc(${Math.min(100, Math.max(0, s.spam.score))}% - 2px)` }} aria-hidden /> : null}
              </div>
              <p className="mt-2 text-xs text-sky-200" data-testid="bo-spam-site">
                Your own site scores {s?.spam.siteScore ?? MISSING}. The score comes from the sites linking to you.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Tile({ label, value, exact, caption, tone, href, linkLabel, testId, loading, children }) {
  const body = (
    <div className={cn(CARD, "flex h-full min-w-0 flex-col px-5 py-4", href && "transition-colors group-hover:border-foreground/30")}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground/85">{label}</span>
        {href ? <ArrowUpRight className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden /> : null}
      </div>
      {loading ? <Skel className="mt-2 h-8 w-20" /> : (
        <div className={cn("mt-1.5 text-[32px] font-semibold leading-none tracking-tight tabular-nums", tone === "bad" && "text-red-700 dark:text-red-400", tone === "good" && "text-emerald-700 dark:text-emerald-400")} title={exact} data-testid={`${testId}-value`}>{value}</div>
      )}
      {children}
      {caption && !loading ? <p className="mt-2 text-xs text-muted-foreground" data-testid={`${testId}-caption`}>{caption}</p> : null}
    </div>
  )
  if (!href) return <div className="min-w-0" data-testid={testId}>{body}</div>
  return <Link href={href} className={cn("group block min-w-0 rounded-2xl", FOCUS)} aria-label={`${label}: ${linkLabel}`} data-testid={testId}>{body}</Link>
}

/** The tiles beside the strength card: backlinks, linking sites, broken backlinks, anchors, and new vs lost linking sites in 30 days. */
export function StatTiles({ state, summary: s, extras }) {
  const loading = !state || state.status === "loading"
  if (state?.status === "error") return <SectionError message={state.error?.message} onRetry={state.refetch} />
  const t = s?.totals ?? {}
  const d = s?.derived ?? {}
  const broken = (t.brokenBacklinks ?? 0) > 0
  const a = extras.anchors
  const l = extras.last30
  const net = l.data && typeof l.data.new === "number" && typeof l.data.lost === "number" ? l.data.new - l.data.lost : null
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 @min-[560px]/main:grid-cols-3" data-testid="bo-kpis">
      <Tile label="Backlinks" value={formatCompact(t.backlinks)} exact={formatExact(t.backlinks)} caption={perSite(d.backlinksPerDomain) ?? MISSING} href={LINKS.backlinksList} linkLabel="open the Backlinks list" testId="bo-kpi-backlinks" loading={loading} />
      <Tile label="Linking sites" value={formatCompact(t.referringDomains)} exact={formatExact(t.referringDomains)} caption={mainAndIps(t.referringMainDomains, t.referringIps) ?? MISSING} href={LINKS.referringDomains} linkLabel="open the Referring Domains page" testId="bo-kpi-domains" loading={loading} />
      <Tile label="Broken backlinks" value={formatCompact(t.brokenBacklinks)} exact={formatExact(t.brokenBacklinks)} tone={broken ? "bad" : null} caption={d.brokenBacklinksPercent === null || d.brokenBacklinksPercent === undefined ? MISSING : `${formatPercent1(d.brokenBacklinksPercent)} point to error pages`} href={LINKS.brokenBacklinks} linkLabel="see the broken backlinks" testId="bo-kpi-broken" loading={loading} />
      <Tile
        label="Anchors"
        value={a.status === "success" ? formatCompact(a.count) : MISSING}
        loading={a.status === "loading"}
        caption={a.status === "success" ? `${formatPercent1(a.nakedPercent)} are just your web address` : a.status === "uncached" ? "Open Anchors to analyse your link text" : "Not available right now"}
        href={LINKS.anchors}
        linkLabel="open Anchors"
        testId="bo-kpi-anchors"
      />
      <div className="@min-[560px]/main:col-span-2">
        <Tile
          label="New vs lost sites · 30 days"
          value={l.status === "success" && l.data ? <><span className="text-emerald-700 dark:text-emerald-400">+{formatExact(l.data.new)}</span> / <span className="text-red-700 dark:text-red-400">−{formatExact(l.data.lost)}</span></> : MISSING}
          loading={l.status === "loading"}
          caption={net === null ? (l.status === "error" ? "Not available right now" : null) : net === 0 ? "No net change in linking sites" : `Net ${net > 0 ? "gain" : "loss"} of ${formatExact(Math.abs(net))} linking site${Math.abs(net) === 1 ? "" : "s"}`}
          href={`${LINKS.referringDomains}?tab=new`}
          linkLabel="open the new linking sites"
          testId="bo-kpi-last30"
        />
      </div>
    </div>
  )
}

const LEVEL = {
  problem: { word: "Problem", box: "border-red-200/80 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/[0.06]", badge: "bg-red-700", text: "text-red-700 dark:text-red-400" },
  warning: { word: "Warning", box: "border-amber-200/80 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/[0.06]", badge: "bg-amber-600", text: "text-amber-700 dark:text-amber-400" },
}

/** "Fix these first": up to three numbered cards, worst first, each with a button to the list that fixes it, then the checks that passed. */
export function FixFirst({ state, summary }) {
  const { fixes, good } = buildFixList(summary)
  return (
    <OverviewCard title="Fix these first" action={fixes.length ? <span className="text-xs text-muted-foreground">In order of impact</span> : null} testId="bo-health">
      <SectionBoundary state={state} skeleton={<div className="grid gap-4 @min-[900px]/main:grid-cols-3">{[0, 1, 2].map((i) => <Skel key={i} className="h-[200px] rounded-2xl" />)}</div>}>
        {fixes.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" data-testid="bo-fix-clear">Nothing urgent: this backlink profile passes every check.</p>
        ) : (
          <ol className="grid gap-4 @min-[900px]/main:grid-cols-3">
            {fixes.map((f, i) => {
              const l = LEVEL[f.level]
              return (
                <li key={f.id} className={cn("flex flex-col rounded-2xl border p-5", l.box)} data-testid={`bo-health-${f.id}`} data-level={f.level}>
                  <div className="flex items-center gap-3">
                    <span className={cn("flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white", l.badge)} aria-hidden>{i + 1}</span>
                    <span className={cn("text-xs font-bold uppercase tracking-wider", l.text)}>{l.word}</span>
                  </div>
                  <h3 className="mt-4 text-[17px] font-semibold leading-snug">{f.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  <Link href={f.cta.href} className={cn("mt-4 inline-flex self-start rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90", FOCUS)} style={{ background: NAVY }} data-testid={`bo-health-${f.id}-link`}>{f.cta.label}</Link>
                </li>
              )
            })}
          </ol>
        )}
        {good.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" data-testid="bo-good">
            <span className="font-semibold">Already good:</span>
            {good.map((g) => (
              <span key={g.id} className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400" data-testid={`bo-good-${g.id}`}><Check className="size-4" aria-hidden />{g.text}</span>
            ))}
          </div>
        ) : null}
      </SectionBoundary>
    </OverviewCard>
  )
}

/** "Dofollow vs nofollow": one split bar for linking sites and one for linking pages. */
export function FollowBars({ state, summary }) {
  const rows = buildFollowRows(summary)
  return (
    <OverviewCard
      title="Dofollow vs nofollow"
      description="Only dofollow links pass ranking credit"
      action={(
        <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Colour key">
          <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-600" aria-hidden />Dofollow</li>
          <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" aria-hidden />Nofollow</li>
        </ul>
      )}
      testId="bo-follow"
    >
      <SectionBoundary state={state} skeleton={<div className="space-y-3">{[0, 1].map((i) => <Skel key={i} className="h-10 w-full rounded-lg" />)}</div>} empty={rows.length === 0} emptyMessage="No data">
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="grid items-center gap-2 @min-[640px]/main:grid-cols-[150px_minmax(0,1fr)]" data-testid={`bo-follow-${r.id}`}>
              <span className="text-sm font-semibold">{r.label}</span>
              <div className="flex h-10 overflow-hidden rounded-lg bg-slate-200 text-sm font-semibold dark:bg-slate-700" role="img" aria-label={`${r.label}: ${formatExact(r.dofollow)} dofollow (${formatPercent1(r.percent)}), ${formatExact(r.nofollow)} nofollow`}>
                <div className="flex items-center whitespace-nowrap bg-emerald-600 px-3 text-white" style={{ width: `${Math.max(r.percent, 0)}%` }}>{r.percent >= 25 ? `${formatExact(r.dofollow)} dofollow · ${formatPercent1(r.percent)}` : null}</div>
                <div className="flex flex-1 items-center justify-end whitespace-nowrap px-3 text-foreground/80">{100 - r.percent >= 15 ? `${formatExact(r.nofollow)} nofollow` : null}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionBoundary>
    </OverviewCard>
  )
}

/** "Where your links come from": six views of the breakdowns, each a 100% bar with a ranked legend of counts and shares. */
export function LinkSources({ state, summary }) {
  const [key, setKey] = useState("countries")
  const { view, rows, note } = buildSourceView(summary, key)
  return (
    <OverviewCard title="Where your links come from" description="Pick a view" testId="bo-sources">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Link source views">
        {SOURCE_VIEWS.map((v) => (
          <button key={v.key} type="button" role="tab" aria-selected={key === v.key} onClick={() => setKey(v.key)} className={cn("rounded-xl border px-4 py-2 text-sm font-semibold transition-colors", FOCUS, key === v.key ? "border-transparent text-white" : "border-border/70 bg-card hover:bg-muted")} style={key === v.key ? { background: NAVY } : undefined} data-testid={`bo-view-${v.key}`}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <SectionBoundary state={state} skeleton={<Skel className="h-[200px] w-full rounded-lg" />} empty={rows.length === 0} emptyMessage="No data">
          <div className="grid gap-6 @min-[900px]/main:grid-cols-2" data-testid={`bo-chart-${view.key}`} data-labels={rows.map((r) => r.label).join("|")} data-counts={rows.map((r) => r.count).join("|")}>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{view.caption}</p>
              <div className="mt-3 flex h-14 w-full gap-0.5 overflow-hidden rounded-lg" role="img" aria-label={`${view.label}: ${rows.slice(0, 5).map((r) => `${r.label} ${formatPercent1(r.percent)}`).join(", ")}`}>
                {rows.map((r) => <div key={r.key} className="h-full" style={{ width: `${r.width}%`, background: r.color }} title={`${r.label}: ${formatExact(r.count)} (${formatPercent1(r.percent)})`} />)}
              </div>
              {note ? (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200/70 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/20 dark:bg-sky-500/[0.07] dark:text-sky-200" data-testid="bo-unknown-note">
                  <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />{note}
                </p>
              ) : null}
            </div>
            <ul className="min-w-0 divide-y divide-border/60">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-3 py-2.5 text-sm" title={r.description ?? undefined} data-testid="bo-source-row">
                  <span className="size-3 shrink-0 rounded-sm" style={{ background: r.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                  <span className="w-16 text-right font-semibold tabular-nums" title={formatExact(r.count)}>{formatCompact(r.count)}</span>
                  <span className="w-16 text-right tabular-nums text-muted-foreground">{formatPercent1(r.percent)}</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionBoundary>
      </div>
    </OverviewCard>
  )
}

/** "About your site": what the provider knows about the site itself, as chips. Unknown facts are left out. */
export function AboutSite({ state, summary: s }) {
  if (!state || state.status !== "success" || !s) return null
  const chips = [
    ["cms", "CMS", s.site.cms],
    ["server", "Server", s.site.server],
    ["ip", "IP", s.site.ipAddress],
    ["country", "Hosted in", s.site.country?.name ?? null],
    ["crawled", "Crawled pages", s.totals.crawledPages === null ? null : formatCompact(s.totals.crawledPages)],
    ["internal", "Internal links", s.totals.internalLinks === null ? null : formatCompact(s.totals.internalLinks)],
    ["external", "Outgoing links", s.totals.externalLinks === null ? null : formatCompact(s.totals.externalLinks)],
  ].filter(([, , v]) => v)
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="bo-site">
      <span className="mr-1 font-semibold">About your site:</span>
      {chips.map(([id, label, v]) => (
        <span key={id} className="rounded-full border border-border/70 bg-card px-3 py-1 text-muted-foreground" data-testid={`bo-site-${id}`}>{label} <span className="font-semibold text-foreground">{v}</span></span>
      ))}
    </div>
  )
}
