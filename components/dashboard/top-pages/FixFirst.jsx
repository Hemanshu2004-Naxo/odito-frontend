"use client"

import Link from "next/link"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { StatusBadge } from "./cells"
import { PROFILE_SCOPE_LABEL } from "./constants"
import { backlinksHref } from "./links"

/**
 * The sentence for one page: "/patna/ returns 404 — 209 backlinks from 3 domains are wasted. Add a 301 redirect to a relevant live page."
 * A 403 is the crawler being refused (the page may work for visitors), so its links "may be" wasted.
 */
export function describeWaste(row) {
  const links = row.backlinks ?? 0
  const domains = row.referringDomains
  const from = domains === null ? "" : ` from ${formatExact(domains)} ${domains === 1 ? "domain" : "domains"}`
  const verb = row.statusGroup === "blocked" ? "may be wasted" : links === 1 ? "is wasted" : "are wasted"
  const fix = row.suggestedFix ? `${row.suggestedFix.replace(/[.\s]+$/, "")}.` : ""
  return `${row.address} returns ${row.statusCode} — ${formatExact(links)} ${links === 1 ? "backlink" : "backlinks"}${from} ${verb}. ${fix}`.trim()
}

/**
 * "Fix first": the five error or blocked pages with the most backlinks (one request, cached 7 days), each with what to do. Only shown when there are
 * error pages with backlinks. WHOLE PROFILE: live links, nothing the user filters changes it.
 */
export default function FixFirst({ fixFirst, onOpenErrors }) {
  if (fixFirst.status === "none") return null
  return (
    <Panel
      title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 text-red-600 dark:text-red-400" aria-hidden /> Fix first</span>}
      description={<span data-testid="tp-fix-scope">The error pages with the most backlinks · {PROFILE_SCOPE_LABEL}</span>}
      action={<Button type="button" variant="outline" size="sm" onClick={onOpenErrors} data-testid="tp-fix-all">See all error pages</Button>}
      className="min-w-0"
    >
      {fixFirst.status === "error" ? <SectionError message={fixFirst.error?.message} onRetry={fixFirst.refetch} /> : null}
      {fixFirst.status === "loading" ? <div className="space-y-3" aria-hidden data-testid="tp-fix-skeleton">{Array.from({ length: 3 }, (_, i) => <Skel key={i} className="h-14 w-full" />)}</div> : null}
      {fixFirst.status === "success" ? (
        <ol className="space-y-2.5" data-testid="tp-fix-list">
          {fixFirst.rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5" data-testid="tp-fix-row">
              <StatusBadge row={row} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm font-semibold hover:underline" title={row.url} data-testid="tp-fix-url">
                  <span className="truncate">{row.address}</span><ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                </a>
                <p className="mt-0.5 text-sm text-muted-foreground" data-testid="tp-fix-text">{describeWaste(row)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm tabular-nums" aria-label="Link counts">
                <span title="Backlinks"><strong data-testid="tp-fix-backlinks">{formatExact(row.backlinks ?? 0)}</strong> <span className="text-muted-foreground">backlinks</span></span>
                <span title="Referring domains"><strong data-testid="tp-fix-rd">{row.referringDomains === null ? "—" : formatExact(row.referringDomains)}</strong> <span className="text-muted-foreground">domains</span></span>
              </div>
              <Button asChild variant="outline" size="sm" data-testid="tp-fix-backlinks-link">
                <Link href={backlinksHref(row.url)}>View backlinks</Link>
              </Button>
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  )
}
