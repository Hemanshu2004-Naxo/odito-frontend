"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatExact } from "../domain-overview/format"
import BreakdownBarCard from "../backlinks-overview/BreakdownBarCard"
import { backlinksHref } from "./backlinksHref"

const OK = { status: "success" }

function Stat({ label, children, testId }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{children}</dd>
    </div>
  )
}

const n = (v) => (v === null ? "—" : formatExact(v))

/**
 * What a click on a row opens: where the links sit on their pages, which countries they come from, what kind of sites link and which
 * attributes they carry (small bar charts from the row's own breakdowns), the counts behind the row, and the way to the individual links.
 */
export default function ExpandedAnchor({ row, status }) {
  const s = row.stats
  return (
    <div className="space-y-4 py-1" data-testid="an-expanded">
      <div className="grid grid-cols-1 gap-3 @min-[900px]/main:grid-cols-2">
        <BreakdownBarCard title="Link placement" description="Where on the page the links sit" state={OK} breakdown={row.breakdowns.placement} testId="an-chart-placement" labelWidth={120} />
        <BreakdownBarCard title="Top countries" description="Where the linking pages are hosted" state={OK} breakdown={row.breakdowns.countries} testId="an-chart-countries" labelWidth={150} />
        <BreakdownBarCard title="Linking site types" description="What kind of site links with this anchor (a site can have several types)" state={OK} breakdown={row.breakdowns.platforms} testId="an-chart-platforms" labelWidth={130} />
        <BreakdownBarCard title="Link attributes" description="nofollow, ugc, sponsored …" state={OK} breakdown={row.breakdowns.attributes} testId="an-chart-attributes" labelWidth={120} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/60 bg-muted/20 p-4 @min-[640px]/main:grid-cols-4" data-testid="an-stats">
        <Stat label="Referring main domains" testId="an-stat-main">{n(s.referringMainDomains)}</Stat>
        <Stat label="Referring pages" testId="an-stat-pages">
          {n(s.referringPages)}
          {s.referringPagesDofollow !== null ? <span className="block text-xs font-normal text-muted-foreground">{formatExact(s.referringPagesDofollow)} dofollow · {formatExact(s.referringPagesNofollow)} nofollow</span> : null}
        </Stat>
        <Stat label="Referring IPs" testId="an-stat-ips">{n(s.referringIps)}</Stat>
        <Stat label="Subnets" testId="an-stat-subnets">{n(s.referringSubnets)}</Stat>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" data-testid="an-view-backlinks">
          <Link href={backlinksHref(row, status)}>
            <ExternalLink className="size-3.5" aria-hidden /> View these backlinks
          </Link>
        </Button>
      </div>
    </div>
  )
}
