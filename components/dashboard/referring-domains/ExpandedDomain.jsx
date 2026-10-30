"use client"

import Link from "next/link"
import { ExternalLink, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatExact } from "../domain-overview/format"
import BreakdownBarCard from "../backlinks-overview/BreakdownBarCard"
import { BACKLINKS_PATH } from "./constants"

const OK = { status: "success" }
const n = (v) => (v === null || v === undefined ? "—" : formatExact(v))

function Stat({ label, children, testId }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{children}</dd>
    </div>
  )
}

/** The Backlinks page filtered to this one source domain (its `from` filter). */
export const backlinksHref = (domain) => `${BACKLINKS_PATH}?${new URLSearchParams({ from: domain }).toString()}`

/**
 * What a click on a row opens: where the links sit on their pages, which attributes they carry, what kind of links and sites they are and
 * where they are hosted (small bar charts from the row's own breakdowns), the counts behind the row, one line of insight built by rules, and
 * the way to the individual links.
 */
export default function ExpandedDomain({ row }) {
  return (
    <div className="space-y-4 py-1" data-testid="rd-expanded">
      {row.insight ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" data-testid="rd-insight">
          <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{row.insight}</span>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 @min-[900px]/main:grid-cols-2">
        <BreakdownBarCard title="Link placement" description="Where on the page the links sit" state={OK} breakdown={row.breakdowns.placement} testId="rd-chart-placement" labelWidth={120} />
        <BreakdownBarCard title="Link attributes" description="nofollow, ugc, sponsored …" state={OK} breakdown={row.breakdowns.attributes} testId="rd-chart-attributes" labelWidth={120} />
        <BreakdownBarCard title="Link types" description="Text links, image links and redirects" state={OK} breakdown={row.breakdowns.linkTypes} testId="rd-chart-types" labelWidth={120} />
        <BreakdownBarCard title="Site types" description="What kind of site this is (it can have several types)" state={OK} breakdown={row.breakdowns.platforms} testId="rd-chart-platforms" labelWidth={130} />
        <BreakdownBarCard title="Top countries" description="Where the linking pages are hosted" state={OK} breakdown={row.breakdowns.countries} testId="rd-chart-countries" labelWidth={150} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/60 bg-muted/20 p-4 @min-[640px]/main:grid-cols-4" data-testid="rd-stats">
        <Stat label="Referring pages" testId="rd-stat-pages">
          {n(row.referringPages)}
          {row.referringPagesDofollow !== null ? <span className="block text-xs font-normal text-muted-foreground">{formatExact(row.referringPagesDofollow)} dofollow · {formatExact(row.referringPagesNofollow)} nofollow</span> : null}
        </Stat>
        <Stat label="Referring IPs" testId="rd-stat-ips">{n(row.referringIps)}</Stat>
        <Stat label="Subnets" testId="rd-stat-subnets">{n(row.referringSubnets)}</Stat>
        <Stat label="Broken pages" testId="rd-stat-broken-pages">{n(row.brokenPages)}</Stat>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" data-testid="rd-view-backlinks">
          <Link href={backlinksHref(row.domain)}><ExternalLink className="size-3.5" aria-hidden /> View backlinks from {row.domain}</Link>
        </Button>
      </div>
    </div>
  )
}
