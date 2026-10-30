"use client"

import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { RANK_HINT } from "./constants"

/** Shared shell of a small stat card. Loading, error and the figure itself are the three things a card can show. */
export function StatCard({ label, hint, state, testId, className, children }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-xl border border-border/60 bg-card p-4", className)} data-testid={testId}>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{label}</span>
        {hint ? <InfoHint label={label} text={hint} /> : null}
      </div>
      {!state || state.status === "loading" ? (
        <>
          <Skel className="mt-2 h-8 w-28" />
          <Skel className="mt-2 h-3.5 w-32" />
        </>
      ) : state.status === "error" ? (
        <SectionError className="mt-2 p-3" message={state.error?.message} onRetry={state.refetch} />
      ) : children}
    </div>
  )
}

const BAND_STYLE = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
}

/**
 * The authority strip: Domain Rank (a number out of 1000 with a gauge), Spam Score (0–100 with a Low / Medium / High badge, the
 * site's own score underneath) and the profile's age.
 */
export default function AuthorityStrip({ state, summary }) {
  const s = summary
  return (
    <div className="grid gap-3 @min-[760px]/main:grid-cols-3" data-testid="bo-authority">
      <StatCard label="Domain Rank" hint={RANK_HINT} state={state} testId="bo-rank">
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight" title={formatExact(s?.rank)} data-testid="bo-rank-value">{formatCompact(s?.rank)}</span>
          {s?.rank !== null && s?.rank !== undefined ? <span className="text-sm text-muted-foreground">/ {s.rankMax.toLocaleString("en-US")}</span> : null}
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label="Domain rank out of 1,000"
          aria-valuemin={0}
          aria-valuemax={s?.rankMax ?? 1000}
          aria-valuenow={s?.rank ?? undefined}
          aria-valuetext={s?.rank === null || s?.rank === undefined ? "unknown" : `${s.rank} out of ${s.rankMax}`}
        >
          {s?.rankPercent !== null && s?.rankPercent !== undefined ? <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(s.rankPercent, 1)}%` }} data-testid="bo-rank-gauge" /> : null}
        </div>
      </StatCard>

      <StatCard label="Spam Score" state={state} testId="bo-spam" hint="How likely the links pointing at this domain are to be spam, from 0 (clean) to 100.">
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-4xl font-semibold tracking-tight" data-testid="bo-spam-value">{s?.spam.score ?? MISSING}</span>
          {s?.spam.score !== null && s?.spam.score !== undefined ? <span className="text-sm text-muted-foreground">/ 100</span> : null}
          {s?.spam.band ? (
            <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", BAND_STYLE[s.spam.band.key])} data-testid="bo-spam-badge" data-band={s.spam.band.key}>{s.spam.band.label}</span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground" data-testid="bo-spam-site">Site&apos;s own spam score: <span className="tabular-nums">{s?.spam.siteScore ?? MISSING}</span></p>
      </StatCard>

      <StatCard label="Profile age" state={state} testId="bo-age" hint="How long ago DataForSEO first found a link to this domain.">
        <div className="mt-1.5 text-3xl font-semibold tracking-tight" title={s?.age.tooltip ?? undefined} data-testid="bo-age-value">{s?.age.short ?? MISSING}</div>
        <p className="mt-2 text-xs text-muted-foreground" data-testid="bo-age-detail">{s?.age.label ? s.age.label.replace(/^Since [A-Za-z]{3} \d{4} /, "") : "First link date unknown"}</p>
      </StatCard>
    </div>
  )
}
