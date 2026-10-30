"use client"

import Link from "next/link"
import { AlertTriangle, ExternalLink, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import BreakdownBarCard from "../backlinks-overview/BreakdownBarCard"
import { BacklinksCell, Chip, DofollowCell, ReferringDomainsCell, StatusBadge } from "./cells"
import { FLAG_TONE } from "./constants"
import { backlinksHref, keywordsHref } from "./links"

const OK = { status: "success" }
const n = (v) => (v === null || v === undefined ? MISSING : formatExact(v))

function Stat({ label, children, testId }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium tabular-nums">{children}</dd>
    </div>
  )
}

/** One line of the on-page info: hidden when there is nothing to show (redirects and errors usually have none of it). */
function Info({ label, value, testId, warn }) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return null
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-sm", warn && "text-amber-700 dark:text-amber-300")}>{value}</dd>
    </div>
  )
}

/**
 * What a click on a row opens: the page's link profile (small bar charts from its own breakdowns), the counts behind the row, what was found ON the
 * page (title, H1, canonical with a warning when it names another page, language, size, links, images, technologies, server, the last crawl —
 * each hidden when empty), the fix for an error page in a highlighted box, and every opportunity flag with its explanation. A merged row lists its
 * variants, each with its own status and counts.
 */
export default function ExpandedPage({ row, referringDomainsTotal }) {
  const o = row.onPage
  const hasOnPage = Boolean(o.title || o.h1.length || o.canonical || o.language || o.wordsCount || o.internalLinks || o.externalLinks || o.images || o.technologies.length || o.server || row.lastCrawled.label)
  const isError = row.statusGroup === "error" || row.statusGroup === "blocked"
  return (
    <div className="space-y-4 py-1" data-testid="tp-expanded">
      {isError && row.suggestedFix ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-300/70 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100" data-testid="tp-fix-box">
          <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div><p className="font-semibold">Suggested fix</p><p data-testid="tp-fix-text">{row.suggestedFix}</p></div>
        </div>
      ) : null}

      {row.flags.length ? (
        <ul className="space-y-1.5" aria-label="Opportunities" data-testid="tp-flag-list">
          {row.flags.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`tp-flag-explain-${f.id}`}>
              <Chip className={FLAG_TONE[f.tone]}>{f.label}</Chip><span>{f.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {row.variants ? (
        <div className="rounded-lg border border-border/60" data-testid="tp-variant-list">
          <p className="border-b border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium">{row.variantCount} variants of this page <span className="font-normal text-muted-foreground">(counts above are sums — approximate)</span></p>
          <ul className="divide-y divide-border/60">
            {row.variants.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 text-sm" data-testid="tp-variant">
                <StatusBadge row={v} />
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline" title={v.url} data-testid="tp-variant-url">{v.url}</a>
                {v.locationLabel ? <span className="truncate text-xs text-muted-foreground" title={v.location}>→ {v.locationLabel}</span> : null}
                <span className="flex items-center gap-4 tabular-nums">
                  <ReferringDomainsCell row={v} total={referringDomainsTotal} />
                  <BacklinksCell row={v} />
                  <DofollowCell row={v} />
                </span>
                <Button asChild variant="ghost" size="sm"><Link href={backlinksHref(v.url)}>View backlinks</Link></Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 @min-[900px]/main:grid-cols-2">
        <BreakdownBarCard title="Link placement" description="Where on the linking pages the links sit" state={OK} breakdown={row.breakdowns.placement} testId="tp-chart-placement" labelWidth={120} />
        <BreakdownBarCard title="Link attributes" description="nofollow, ugc, sponsored …" state={OK} breakdown={row.breakdowns.attributes} testId="tp-chart-attributes" labelWidth={120} />
        <BreakdownBarCard title="Top countries" description="Where the linking pages are hosted" state={OK} breakdown={row.breakdowns.countries} testId="tp-chart-countries" labelWidth={150} />
        <BreakdownBarCard title="Linking site types" description="What kind of site links here (a site can have several types)" state={OK} breakdown={row.breakdowns.platforms} testId="tp-chart-platforms" labelWidth={130} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/60 bg-muted/20 p-4 @min-[640px]/main:grid-cols-3 @min-[1000px]/main:grid-cols-6" data-testid="tp-stats">
        <Stat label="Referring main domains" testId="tp-stat-main">{n(row.stats.referringMainDomains)}</Stat>
        <Stat label="Referring pages" testId="tp-stat-pages">
          {n(row.stats.referringPages)}
          {row.stats.referringPagesDofollow !== null ? <span className="block text-xs font-normal text-muted-foreground">{formatExact(row.stats.referringPagesDofollow)} dofollow · {formatExact(row.stats.referringPagesNofollow)} nofollow</span> : null}
        </Stat>
        <Stat label="Referring IPs" testId="tp-stat-ips">{n(row.stats.referringIps)}</Stat>
        <Stat label="Subnets" testId="tp-stat-subnets">{n(row.stats.referringSubnets)}</Stat>
        <Stat label="Backlink spam score" testId="tp-stat-spam">{row.spamScore === null ? MISSING : `${row.spamScore}${row.spamBand ? ` · ${row.spamBand.label}` : ""}`}</Stat>
        <Stat label="Broken pages" testId="tp-stat-broken-pages">{n(row.stats.brokenPages)}</Stat>
      </dl>

      {hasOnPage ? (
        <div className="space-y-2" data-testid="tp-onpage">
          <h3 className="text-sm font-semibold">On the page</h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-border/60 p-4 @min-[700px]/main:grid-cols-2">
            <Info label="Title" value={o.title} testId="tp-info-title" />
            <Info label="H1" value={o.h1.join(" · ")} testId="tp-info-h1" />
            <Info
              label="Canonical"
              value={o.canonical ? <span className="inline-flex flex-wrap items-center gap-1.5">{o.canonical}{o.canonicalDiffers ? <span className="inline-flex items-center gap-1 font-medium" data-testid="tp-canonical-warning"><AlertTriangle className="size-3.5" aria-hidden />points to a different page than this one</span> : null}</span> : null}
              testId="tp-info-canonical"
              warn={o.canonicalDiffers}
            />
            <Info label="Language" value={o.language} testId="tp-info-language" />
            <Info label="Words" value={o.wordsCount ? formatExact(o.wordsCount) : null} testId="tp-info-words" />
            <Info label="Internal / external links" value={o.internalLinks || o.externalLinks ? `${formatCompact(o.internalLinks ?? 0)} / ${formatCompact(o.externalLinks ?? 0)}` : null} testId="tp-info-links" />
            <Info label="Images" value={o.images ? formatExact(o.images) : null} testId="tp-info-images" />
            <Info label="Page spam score" value={o.pageSpamScore ? String(o.pageSpamScore) : null} testId="tp-info-spam" />
            <Info label="Technologies" value={o.technologies.join(", ")} testId="tp-info-tech" />
            <Info label="Server" value={o.server} testId="tp-info-server" />
            <Info label="Last crawled" value={row.lastCrawled.label ? <span title={row.lastCrawled.tooltip ?? undefined}>{row.lastCrawled.day}</span> : null} testId="tp-info-crawled" />
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" data-testid="tp-view-backlinks">
          <Link href={backlinksHref(row.url)}><ExternalLink className="size-3.5" aria-hidden /> View backlinks</Link>
        </Button>
        <Button asChild variant="outline" size="sm" data-testid="tp-view-keywords">
          <Link href={keywordsHref(row.path)}>View keywords</Link>
        </Button>
      </div>
    </div>
  )
}
