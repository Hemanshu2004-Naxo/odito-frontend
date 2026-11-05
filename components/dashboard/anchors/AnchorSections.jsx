"use client"

import Link from "next/link"
import { AlertTriangle, Search, Sparkles } from "lucide-react"
import { EMPTY_ANCHOR_LABEL } from "@/lib/anchors/anchorConfig"
import { cn } from "@/lib/utils"
import OverviewCard from "../domain-overview/OverviewCard"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import { backlinksHref } from "./backlinksHref"
import { VERDICT_LABEL, anchorVerdict, isSpamRow, mixLabel } from "./anchorMix"

const NAVY = "#0d1a3a"
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
export const DISAVOW_HREF = "/app/referring-domains?tab=toxic"
const VERDICT_TONE = { too_high: "text-red-700 dark:text-red-400", too_low: "text-amber-700 dark:text-amber-400", ok: "text-emerald-700 dark:text-emerald-400" }

/** "Your anchor mix": a 100% bar of the types, then each type against its typical range with a verdict, then the advice. */
export function AnchorMix({ profile, rows, advice, typeFilter, onType }) {
  return (
    <OverviewCard title="Your anchor mix" description="Share of linking sites using each kind of anchor · click a type to filter the cloud" testId="an-mix">
      <SectionBoundary state={profile} skeleton={<div className="space-y-3"><Skel className="h-16 w-full rounded-xl" />{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-10 w-full" />)}</div>} empty={rows.length === 0} emptyMessage="No anchors found for this domain yet.">
        <div className="flex h-16 w-full gap-0.5 overflow-hidden rounded-xl" role="img" aria-label={`Anchor mix: ${rows.map((r) => `${r.label} ${formatPercent1(r.percent)}`).join(", ")}`} data-testid="an-mix-bar">
          {rows.filter((r) => r.percent > 0).map((r) => (
            <button key={r.key} type="button" onClick={() => onType(r.key)} className={cn("flex h-full min-w-[6px] items-center overflow-hidden whitespace-nowrap px-3 text-sm font-semibold text-white", FOCUS)} style={{ width: `${r.percent}%`, background: r.color }} title={`${r.label}: ${formatPercent1(r.percent)}`} aria-label={`Show ${r.label} anchors`}>
              {r.percent >= 12 ? `${r.label} ${formatPercent1(r.percent)}` : null}
            </button>
          ))}
        </div>

        <div className="-mx-1 mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" data-testid="an-mix-table">
            <thead>
              <tr className="border-b border-border/70 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-1 py-2">Type</th>
                <th scope="col" className="px-2 py-2">Yours</th>
                <th scope="col" className="w-[45%] px-2 py-2">Yours vs typical range</th>
                <th scope="col" className="px-2 py-2">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={cn("cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/40", typeFilter === r.key && "bg-muted/60")} onClick={() => onType(r.key)} data-testid="an-mix-row" data-type={r.key} data-verdict={r.verdict}>
                  <th scope="row" className="px-1 py-3 text-left font-normal">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onType(r.key) }} aria-pressed={typeFilter === r.key} className={cn("flex items-start gap-3 rounded text-left", FOCUS)}>
                      <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ background: r.color }} aria-hidden />
                      <span><span className="block font-semibold">{r.label}</span><span className="block text-xs text-muted-foreground">{r.example}</span></span>
                    </button>
                  </th>
                  <td className="px-2 py-3 text-base font-semibold tabular-nums">{formatPercent1(r.percent)}</td>
                  <td className="px-2 py-3">
                    <div className="relative h-2.5 rounded-full bg-muted" role="img" aria-label={`${formatPercent1(r.percent)}; typical ${r.range[0]}–${r.range[1]}%`}>
                      <span className="absolute -top-1 h-[18px] rounded-md border border-dashed border-emerald-500 bg-emerald-100/80 dark:bg-emerald-500/20" style={{ left: `${r.range[0]}%`, width: `${r.range[1] - r.range[0]}%` }} aria-hidden />
                      <span className="absolute -top-1.5 h-[22px] w-1.5 rounded-full" style={{ left: `calc(${Math.min(100, Math.max(0, r.percent))}% - 3px)`, background: r.color }} aria-hidden />
                    </div>
                  </td>
                  <td className={cn("px-2 py-3 font-semibold", VERDICT_TONE[r.verdict])}>{VERDICT_LABEL[r.verdict]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded border border-dashed border-emerald-500 bg-emerald-100/80 dark:bg-emerald-500/20" aria-hidden />Typical range for a natural profile (rule of thumb, not a Google number)</span>
          <span>Scale 0–100%</span>
        </p>
        {advice ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200/70 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/20 dark:bg-sky-500/[0.07] dark:text-sky-200" data-testid="an-mix-advice">
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />{advice}
          </p>
        ) : null}
      </SectionBoundary>
    </OverviewCard>
  )
}

/** The red banner: how many spammy anchors, with "Show them" (filters the cloud) and "Disavow sites". */
export function SpamBanner({ spam, onShow }) {
  if (!spam) return null
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-red-200/80 bg-red-50/60 px-5 py-4 @min-[800px]/main:flex-row @min-[800px]/main:items-center dark:border-red-500/30 dark:bg-red-500/[0.06]" aria-label="Spammy anchors" data-testid="an-spam">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-700 text-white" aria-hidden><AlertTriangle className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold" data-testid="an-spam-title">{spam.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {spam.example ? <>Phrases like &ldquo;{spam.example.length > 40 ? `${spam.example.slice(0, 39)}…` : spam.example}&rdquo; </> : "These anchors "}
          come from sites with a high spam score, not real recommendations. Disavow those sites so Google ignores them.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" onClick={onShow} className={cn("rounded-lg border border-red-200 bg-card px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300", FOCUS)} data-testid="an-spam-show">Show them</button>
        <Link href={DISAVOW_HREF} className={cn("rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800", FOCUS)} data-testid="an-spam-disavow">Disavow sites</Link>
      </div>
    </section>
  )
}

/** "All anchors": the cloud. Bigger = more linking sites; colour = type (red = spam). A click opens the anchor in the panel. */
export function AnchorCloud({ profile, cloud, query, onQuery, typeFilter, onClearType, selectedId, onSelect, onMore, colors }) {
  const filterLabel = typeFilter === "spam" ? "Spammy anchors" : typeFilter ? mixLabel(typeFilter) : null
  return (
    <OverviewCard
      title="All anchors"
      description="Bigger = more sites use it. Click one for details."
      action={(
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Search anchors</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search anchors" className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="an-search" />
        </label>
      )}
      className="h-full"
      testId="an-cloud-card"
    >
      <SectionBoundary state={profile} skeleton={<div className="flex flex-wrap gap-2">{Array.from({ length: 10 }, (_, i) => <Skel key={i} className="h-10 w-40 rounded-xl" />)}</div>} empty={profile.rows?.length === 0} emptyMessage="No anchors found for this domain yet.">
        {filterLabel ? (
          <p className="mb-3 flex items-center gap-2 text-sm" data-testid="an-type-filter">
            Showing <span className="font-semibold">{filterLabel}</span>
            <button type="button" onClick={onClearType} className={cn("rounded text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400", FOCUS)}>Show all</button>
          </p>
        ) : null}
        {cloud.items.length === 0 ? <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No anchor matches.</p> : (
          <ul className="flex flex-wrap gap-2" data-testid="an-cloud">
            {cloud.items.map(({ row, size, spam }) => {
              const color = colors[row.type] ?? "#64748b"
              const selected = row.id === selectedId
              const label = row.isEmpty ? EMPTY_ANCHOR_LABEL : row.anchor
              return (
                <li key={row.id} className="max-w-full">
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    aria-pressed={selected}
                    className={cn("max-w-full rounded-xl px-4 py-1.5 text-left font-semibold leading-tight transition-shadow", FOCUS, selected && "ring-2 ring-offset-1 ring-[#0d1a3a] dark:ring-indigo-400", row.isEmpty && "italic")}
                    style={spam ? { background: selected ? "#e11d48" : "#ffe4e6", color: selected ? "#fff" : "#be123c", fontSize: size } : { background: `${color}1f`, color, fontSize: size }}
                    title={`${label} · ${formatExact(row.referringDomains)} linking sites`}
                    data-testid="an-cloud-item"
                    data-type={row.type}
                    data-spam={spam ? "1" : "0"}
                  >
                    <span className="line-clamp-1 break-all">{label.length > 48 ? `${label.slice(0, 47)}…` : label}</span>
                    <span className="ml-1.5 align-middle text-[11px] font-medium opacity-80">{formatExact(row.referringDomains)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span data-testid="an-cloud-count">Showing {formatExact(cloud.items.length)} of {formatExact(cloud.total)} anchors, by number of linking sites{profile.truncated ? ` (the top ${formatExact(profile.rows.length)} of ${formatExact(profile.total)})` : ""}</span>
          {cloud.total > cloud.items.length ? <button type="button" onClick={onMore} className={cn("rounded font-medium text-indigo-600 hover:underline dark:text-indigo-400", FOCUS)} data-testid="an-cloud-more">Show more</button> : null}
        </div>
      </SectionBoundary>
    </OverviewCard>
  )
}

const TONE_BOX = {
  bad: "border-red-200/80 bg-red-50/60 text-red-800 dark:border-red-500/30 dark:bg-red-500/[0.06] dark:text-red-200",
  warn: "border-amber-200/80 bg-amber-50/60 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/[0.06] dark:text-amber-200",
  good: "border-emerald-200/80 bg-emerald-50/60 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/[0.06] dark:text-emerald-200",
  neutral: "border-border/70 bg-muted/40 text-foreground",
}

/** The panel beside the cloud: the chosen anchor's numbers, what it means, and the next step. */
export function AnchorDetail({ row, status, colors }) {
  if (!row) return <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground" data-testid="an-detail-empty">Click an anchor to see its details.</div>
  const spam = isSpamRow(row)
  const v = anchorVerdict(row)
  const label = row.isEmpty ? EMPTY_ANCHOR_LABEL : row.anchor
  const tile = (name, value, tone, testId) => (
    <div className="rounded-xl bg-muted/50 px-3.5 py-3" data-testid={testId}>
      <div className="text-xs text-muted-foreground">{name}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", tone === "bad" && "text-red-700 dark:text-red-400")}>{value}</div>
    </div>
  )
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" aria-label="Anchor details" data-testid="an-detail">
      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={spam ? { background: "#ffe4e6", color: "#be123c" } : { background: `${colors[row.type] ?? "#64748b"}1f`, color: colors[row.type] ?? "#64748b" }} data-testid="an-detail-type">
        {spam ? "Spam" : mixLabel(row.type)}
      </span>
      <h2 className="mt-3 text-xl font-semibold leading-snug" data-testid="an-detail-anchor">{row.isEmpty ? label : `“${label}”`}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {tile("Linking sites", formatCompact(row.referringDomains), null, "an-detail-sites")}
        {tile("Backlinks", formatCompact(row.backlinks), null, "an-detail-backlinks")}
        {tile("Dofollow", row.dofollowPercent === null ? MISSING : formatPercent1(row.dofollowPercent).replace(".0%", "%"), null, "an-detail-dofollow")}
        {tile("Broken", formatCompact(row.brokenBacklinks), (row.brokenBacklinks ?? 0) > 0 ? "bad" : null, "an-detail-broken")}
        {tile("Spam score", row.spamScore === null ? MISSING : `${row.spamScore}${row.spamBand ? ` · ${row.spamBand.label}` : ""}`, spam ? "bad" : null, "an-detail-spam")}
        {tile("First seen", row.firstSeen?.label ?? MISSING, null, "an-detail-first")}
      </div>
      <div className={cn("mt-4 rounded-xl border px-4 py-3 text-sm", TONE_BOX[v.tone])} data-testid="an-detail-verdict" data-tone={v.tone}>
        <p className="font-semibold">{v.title}</p>
        <p className="mt-1 leading-relaxed opacity-90">{v.text}</p>
      </div>
      <Link
        href={v.action === "disavow" ? DISAVOW_HREF : backlinksHref(row, status)}
        className={cn("mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90", FOCUS)}
        style={{ background: NAVY }}
        data-testid="an-detail-action"
      >
        {v.action === "disavow" ? "Go to disavow" : "See these backlinks"}
      </Link>
    </section>
  )
}
