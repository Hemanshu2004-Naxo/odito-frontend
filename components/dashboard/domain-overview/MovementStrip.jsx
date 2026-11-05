"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { SectionBoundary, Skel } from "./SectionState"
import { formatCompact, formatExact } from "./format"
import { LOST_HINT, movementHref } from "./hubLinks"
import { describeNetMonth } from "./overviewInsights"

// Each tile says its meaning in a word, so it never rests on colour alone.
const BOXES = [
  { key: "new", label: "New", tone: "good", hint: "Keywords that started ranking since the previous update" },
  { key: "improved", label: "Improved", tone: "good", hint: "Keywords that moved up since the previous update" },
  { key: "declined", label: "Declined", tone: "bad", hint: "Keywords that moved down since the previous update" },
  { key: "lost", label: "Lost", tone: "bad", hint: LOST_HINT },
]
const TONE = {
  good: { box: "bg-emerald-50 dark:bg-emerald-500/10", label: "text-emerald-700 dark:text-emerald-300" },
  bad: { box: "bg-red-50 dark:bg-red-500/10", label: "text-red-700 dark:text-red-300" },
}

const Skeleton = () => (
  <div className="grid grid-cols-2 gap-2 @min-[640px]/main:grid-cols-4">
    {BOXES.map((b) => <Skel key={b.key} className="h-[60px] rounded-lg" />)}
  </div>
)

const MINUS = "−"

/**
 * The net change in ranking keywords: NEW minus LOST (a keyword that merely moved up or down neither enters nor leaves the ranking).
 * Null when either figure is unknown.
 */
export function netChange(movement) {
  const { new: added, lost } = movement ?? {}
  return Number.isFinite(added) && Number.isFinite(lost) ? added - lost : null
}

/** "Net: +12 keywords this month" / "Net: −8 keywords this month" / "Net: 0 keywords this month". */
export function describeNet(net) {
  if (net === null) return null
  const sign = net > 0 ? "+" : net < 0 ? MINUS : ""
  const abs = Math.abs(net)
  return `Net: ${sign}${formatExact(abs)} ${abs === 1 ? "keyword" : "keywords"} this month`
}

/**
 * Keyword movement (API 1: is_new / is_up / is_down / is_lost — API 1, not API 3, because API 3 reports 0 lost keywords) as four tinted
 * tiles and the month's net change under them. New / Improved / Declined open Organic Keywords with that movement chosen; Lost does not
 * (those keywords no longer rank, so there is nothing to list) and says so in its tooltip.
 */
export default function MovementStrip({ state, movement, hasRankingData }) {
  const net = netChange(movement)
  const netText = describeNetMonth(net)
  return (
    <SectionBoundary state={state} skeleton={<Skeleton />} empty={!hasRankingData} emptyMessage="No keyword movement yet: this domain has no ranking data.">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 @min-[640px]/main:grid-cols-4" data-testid="do-movement">
          {BOXES.map(({ key, label, tone, hint }) => {
            const t = TONE[tone]
            const href = movementHref(key)
            const body = (
              <>
                <div className={cn("text-[11px] font-medium", t.label)}>{label}</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums" title={formatExact(movement[key])} data-testid={`do-movement-${key}`}>{formatCompact(movement[key])}</div>
              </>
            )
            const box = cn("block rounded-lg px-3 py-2", t.box)
            return href && movement[key] !== null ? (
              <Link
                key={key}
                href={href}
                title={hint}
                aria-label={`${label}: ${formatExact(movement[key])} keywords. Open them in Organic Keywords`}
                className={cn(box, "transition-shadow hover:ring-1 hover:ring-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
                data-testid={`do-movement-link-${key}`}
              >
                {body}
              </Link>
            ) : (
              <div key={key} className={box} title={hint} data-testid={key === "lost" ? "do-movement-lost-box" : undefined}>{body}</div>
            )
          })}
        </div>
        {netText ? (
          <p
            className={cn("text-xs font-medium tabular-nums", net > 0 && "text-emerald-600 dark:text-emerald-400", net < 0 && "text-red-600 dark:text-red-400", net === 0 && "text-muted-foreground")}
            data-testid="do-net"
            data-direction={net > 0 ? "up" : net < 0 ? "down" : "flat"}
          >
            {netText}
          </p>
        ) : null}
      </div>
    </SectionBoundary>
  )
}
