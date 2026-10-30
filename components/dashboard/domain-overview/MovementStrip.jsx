"use client"

import Link from "next/link"
import { MinusCircle, PlusCircle, TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { SectionBoundary, Skel } from "./SectionState"
import { formatCompact, formatExact } from "./format"
import { LOST_HINT, movementHref } from "./hubLinks"

// Each box has an icon AND a word, so the meaning never rests on colour alone.
const BOXES = [
  { key: "new", label: "New", Icon: PlusCircle, tone: "text-sky-600 dark:text-sky-400", hint: "Keywords that started ranking since the previous update" },
  { key: "improved", label: "Improved", Icon: TrendingUp, tone: "text-emerald-600 dark:text-emerald-400", hint: "Keywords that moved up since the previous update" },
  { key: "declined", label: "Declined", Icon: TrendingDown, tone: "text-red-600 dark:text-red-400", hint: "Keywords that moved down since the previous update" },
  { key: "lost", label: "Lost", Icon: MinusCircle, tone: "text-amber-600 dark:text-amber-400", hint: LOST_HINT },
]

const Skeleton = () => (
  <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-4">
    {BOXES.map((b) => <Skel key={b.key} className="h-[72px] rounded-xl" />)}
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
 * Keyword movement (API 1: is_new / is_up / is_down / is_lost — API 1, not API 3, because API 3 reports 0 lost keywords).
 * New / Improved / Declined are links to Organic Keywords with that movement chosen; Lost is not (those keywords no longer rank, so there is
 * nothing to list) and says so in its tooltip.
 */
export default function MovementStrip({ state, movement, hasRankingData }) {
  const net = netChange(movement)
  const netText = describeNet(net)
  return (
    <SectionBoundary state={state} skeleton={<Skeleton />} empty={!hasRankingData} emptyMessage="No keyword movement yet: this domain has no ranking data.">
      <div className="space-y-2">
        {netText ? (
          <p
            className={cn("text-sm font-medium tabular-nums", net > 0 && "text-emerald-600 dark:text-emerald-400", net < 0 && "text-red-600 dark:text-red-400", net === 0 && "text-muted-foreground")}
            data-testid="do-net"
            data-direction={net > 0 ? "up" : net < 0 ? "down" : "flat"}
          >
            {netText}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-4" data-testid="do-movement">
          {BOXES.map(({ key, label, Icon, tone, hint }) => {
            const href = movementHref(key)
            const body = (
              <>
                <Icon className={cn("size-5 shrink-0", tone)} aria-hidden />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-semibold tabular-nums" title={formatExact(movement[key])} data-testid={`do-movement-${key}`}>{formatCompact(movement[key])}</div>
                </div>
              </>
            )
            const box = "flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3"
            return href && movement[key] !== null ? (
              <Link
                key={key}
                href={href}
                title={hint}
                aria-label={`${label}: ${formatExact(movement[key])} keywords. Open them in Organic Keywords`}
                className={cn(box, "transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
                data-testid={`do-movement-link-${key}`}
              >
                {body}
              </Link>
            ) : (
              <div key={key} className={box} title={hint} data-testid={key === "lost" ? "do-movement-lost-box" : undefined}>{body}</div>
            )
          })}
        </div>
      </div>
    </SectionBoundary>
  )
}
