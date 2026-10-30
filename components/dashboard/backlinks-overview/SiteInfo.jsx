"use client"

import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"

function Row({ label, children, testId }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm" data-testid={testId}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  )
}

const Count = ({ value }) => <span className="tabular-nums" title={formatExact(value)}>{formatCompact(value)}</span>

/** "Site info": what the provider knows about the site itself, and how many pages it crawled and how many links those pages hold. */
export default function SiteInfo({ state, summary }) {
  const s = summary
  return (
    <Panel title="Site info" description="What the data provider knows about this site" className="min-w-0">
      <SectionBoundary state={state} skeleton={<div className="space-y-2" aria-hidden>{Array.from({ length: 6 }, (_, i) => <Skel key={i} className="h-7 w-full" />)}</div>}>
        <dl className="divide-y divide-border/60" data-testid="bo-site">
          <Row label="CMS" testId="bo-site-cms">{s?.site.cms ?? MISSING}</Row>
          <Row label="Server" testId="bo-site-server">{s?.site.server ?? MISSING}</Row>
          <Row label="IP address" testId="bo-site-ip"><span className="tabular-nums">{s?.site.ipAddress ?? MISSING}</span></Row>
          <Row label="Hosting country" testId="bo-site-country">
            {s?.site.country ? <span className="inline-flex items-center gap-1.5"><span aria-hidden>{s.site.country.flag}</span>{s.site.country.name}</span> : MISSING}
          </Row>
          <Row label="Site types" testId="bo-site-types">
            {s?.site.platformTypes.length ? (
              <span className="flex flex-wrap justify-end gap-1.5">
                {s.site.platformTypes.map((t) => <span key={t} className="rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-xs font-medium">{t}</span>)}
              </span>
            ) : MISSING}
          </Row>
          <Row label="Crawled pages" testId="bo-site-crawled"><Count value={s?.totals.crawledPages ?? null} /></Row>
          <Row label="Internal links" testId="bo-site-internal"><Count value={s?.totals.internalLinks ?? null} /></Row>
          <Row label="External links (outgoing)" testId="bo-site-external"><Count value={s?.totals.externalLinks ?? null} /></Row>
        </dl>
      </SectionBoundary>
    </Panel>
  )
}
