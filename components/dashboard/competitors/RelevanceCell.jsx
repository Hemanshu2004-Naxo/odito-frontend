"use client"

import { Info, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { formatDateTime } from "../referring-domains/format"
import { CLASS_KEYS, CLASS_META, SOURCE_LABEL, badgeFor } from "./relevanceUi"

const KIND = { business: "A business", government: "Government or public body", education: "Educational institution", publisher: "Publisher or reference site", directory: "Directory, marketplace or platform", unknown: "Unclear" }
const SECTOR = { high: "Strong match with what you do", medium: "Partial match", low: "No match", unknown: "Could not be judged" }
const GEO = { same_city: "Same city", nearby: "Nearby", same_state: "Same state, other city", same_country: "Same country, other state", different_country: "Another country", unknown: "Location unknown" }
const LEVEL = { high: "High", medium: "Medium", low: "Low" }

function Row({ label, children }) {
  return <div className="flex gap-2 text-xs"><dt className="w-20 shrink-0 text-muted-foreground">{label}</dt><dd>{children}</dd></div>
}

/** The "why" behind a classification: the evidence that produced it, where each piece came from, and the controls to change it. */
function Why({ domain, a, busy, onOverride, onClear, onReassess }) {
  const assessed = Boolean(a?.autoClass || a?.class)
  return (
    <div className="space-y-3" data-testid="rel-why">
      <div>
        <p className="text-sm font-semibold">{a?.class ? CLASS_META[a.class].long : badgeFor(a).label}</p>
        <p className="text-xs text-muted-foreground">{domain}</p>
      </div>

      {a?.overridden ? (
        <p className="rounded-md bg-muted/60 p-2 text-xs" data-testid="rel-overridden">
          You set this{a.override?.at ? ` on ${formatDateTime(a.override.at)}` : ""}{a.override?.note ? `: “${a.override.note}”` : ""}.
          {a.autoClass ? ` Odito's automatic result was “${CLASS_META[a.autoClass].long}”.` : ""}
        </p>
      ) : null}

      {assessed && a.reasons?.length ? (
        <>
          <ul className="space-y-1.5" aria-label="Reasons">
            {a.reasons.map((r, i) => (
              <li key={`${r.code}-${i}`} className="text-xs">
                <span>{r.text}</span>{" "}
                <span className="whitespace-nowrap rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground" title="Where this evidence came from">{SOURCE_LABEL[r.source] ?? r.source}</span>
              </li>
            ))}
          </ul>
          {a.signals ? (
            <dl className="space-y-1 border-t border-border/60 pt-2" data-testid="rel-signals">
              <Row label="Website type">{KIND[a.signals.kind] ?? "Unclear"}</Row>
              <Row label="Services">{SECTOR[a.signals.sector] ?? "Could not be judged"}{a.signals.sectorTerms?.length ? ` (${a.signals.sectorTerms.slice(0, 3).join(", ")})` : ""}</Row>
              <Row label="Location">{GEO[a.signals.geo] ?? "Location unknown"}</Row>
              <Row label="Your scope">{a.signals.scope === "national" ? "National" : "Local"}</Row>
            </dl>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {a.level ? `Confidence: ${LEVEL[a.level]}. ` : ""}Keyword overlap alone never makes a site a direct competitor.{a.assessedAt ? ` Checked ${formatDateTime(a.assessedAt)}.` : ""}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{badgeFor(a).hint}</p>
      )}

      <div className="space-y-1.5 border-t border-border/60 pt-2">
        <p className="text-xs font-medium">Change the classification</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Change the classification">
          {CLASS_KEYS.map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={a?.class === k ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              aria-pressed={a?.class === k}
              disabled={busy}
              onClick={() => onOverride(domain, k)}
              data-testid={`rel-set-${k}`}
            >
              {CLASS_META[k].label}
            </Button>
          ))}
        </div>
        {a?.overridden ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} onClick={() => onClear(domain)} data-testid="rel-clear">Use Odito&apos;s automatic result</Button>
        ) : null}
        <p className="text-[11px] text-muted-foreground">Your choice is saved, always wins, and does not change which sites Google data includes.</p>
        {onReassess ? <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy || a?.status === "pending" || a?.status === "processing"} onClick={() => onReassess(domain)} data-testid="rel-reassess">Check this site again</Button> : null}
      </div>
    </div>
  )
}

/** One domain's business-relevance badge, with a popover that explains it and lets the user change it. */
export default function RelevanceCell({ domain, assessment, busy = false, onOverride, onClear, onReassess, className }) {
  const badge = badgeFor(assessment)
  return (
    <span className={cn("inline-flex items-center gap-1", className)} data-testid="rel-cell" data-state={badge.state} data-class={assessment?.class ?? ""}>
      <Badge variant={badge.variant} title={badge.hint} data-testid="rel-badge">
        {badge.state === "pending" || busy ? <Loader2 className="mr-1 size-3 animate-spin" aria-hidden /> : null}
        {badge.label}
        <span className="sr-only">. {badge.hint}</span>
      </Badge>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Why is ${domain} classified this way?`}
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="rel-why-button"
          >
            <Info className="size-3.5" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 max-w-[90vw]">
          <Why domain={domain} a={assessment} busy={busy} onOverride={onOverride} onClear={onClear} onReassess={onReassess} />
        </PopoverContent>
      </Popover>
    </span>
  )
}
