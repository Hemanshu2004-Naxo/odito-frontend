"use client"

import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import InfoHint from "../referring-domains/InfoHint"
import { formatDateTime } from "../referring-domains/format"
import { MISSING, formatExact } from "../domain-overview/format"
import { formatBidRange, formatCompetition, formatCpc } from "./format"
import MonthlyVolumeChart from "./MonthlyVolumeChart"
import { SerpFeatureIcons, UrlCell } from "./cells"

function Fact({ label, hint, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-card px-3 py-2">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">{label}{hint ? <InfoHint label={label} text={hint} /> : null}</dt>
      <dd className="mt-0.5 min-w-0 text-sm font-medium tabular-nums">{children}</dd>
    </div>
  )
}

/**
 * Everything about one keyword that does not fit a table cell: its 12-month search volume, the ranking page's title and URL, how
 * contested the paid side is, the ranking page's backlink profile, and a button to see the results in Google. A figure the provider
 * did not send is "—".
 */
export default function ExpandedKeywordDetails({ row, id }) {
  return (
    <div id={id} role="region" aria-label={`Details for ${row.keyword}`} className="grid gap-5 px-5 py-4 @min-[760px]/main:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" data-testid="ok-details">
      <section className="min-w-0">
        <h3 className="mb-2 text-sm font-semibold">Searches per month</h3>
        <MonthlyVolumeChart months={row.monthly} keyword={row.keyword} />
      </section>

      <div className="min-w-0 space-y-3">
        <section className="min-w-0">
          <h3 className="text-sm font-semibold">Ranking page</h3>
          <p className="mt-1 break-words text-sm" data-testid="ok-serp-title">{row.title ?? MISSING}</p>
          <div className="mt-0.5 max-w-full text-xs"><UrlCell row={row} /></div>
        </section>

        <dl className="grid grid-cols-2 gap-2 @min-[560px]/main:grid-cols-3">
          <Fact label="Competition" hint="How many advertisers bid on this keyword in Google Ads (low, medium or high). It describes paid competition, not how hard it is to rank organically — see KD for that.">
            <span data-testid="ok-competition">{formatCompetition(row.competition)}</span>
          </Fact>
          <Fact label="Top-of-page bid" hint="The range advertisers pay per click to appear above the organic results for this keyword.">
            <span data-testid="ok-bid">{formatBidRange(row.lowBid, row.highBid)}</span>
          </Fact>
          <Fact label="CPC" hint="The average cost per click advertisers pay for this keyword.">{formatCpc(row.cpc)}</Fact>
          <Fact label="Referring domains" hint="Websites that link to the ranking page.">
            <span data-testid="ok-referring-domains">{formatExact(row.referringDomains)}</span>
          </Fact>
          <Fact label="Backlinks" hint="Links pointing at the ranking page.">
            <span data-testid="ok-backlinks">{formatExact(row.backlinks)}</span>
          </Fact>
          <Fact label="Ranking checked">
            <span className="text-xs font-normal">{row.lastUpdated ? formatDateTime(row.lastUpdated.toISOString()) : MISSING}</span>
          </Fact>
        </dl>

        {row.serpFeatures.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>On this results page:</span>
            <SerpFeatureIcons features={row.serpFeatures} />
            <span className="sr-only">{row.serpFeatures.map((f) => f.label).join(", ")}</span>
          </div>
        ) : null}

        {row.googleUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={row.googleUrl} target="_blank" rel="noopener noreferrer" data-testid="ok-view-google">
              View in Google <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
