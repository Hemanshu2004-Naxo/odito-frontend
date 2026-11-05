"use client"

import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"
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

export const BLOCKED_NOTE = "Pages that return 403 need a different fix: crawlers are refused there. Ask your host to allow search-engine and SEO bots in the firewall or CDN."

/**
 * "Redirect plan" (the Fix first list): the five error or blocked pages with the most backlinks (one request, cached 7 days), each with what to do,
 * its link counts and a way to its backlinks. Only shown when there are error pages with backlinks. WHOLE PROFILE: nothing the user filters
 * changes it. A blocked (403) page in the list adds the note that it needs a different fix.
 */
export default function FixFirst({ fixFirst, onOpenErrors }) {
  if (fixFirst.status === "none") return null
  const rows = fixFirst.status === "success" ? fixFirst.rows : []
  const blocked = rows.some((r) => r.statusCode === 403 || r.statusGroup === "blocked")
  return (
    <section className="rounded-2xl px-5 py-5 text-white shadow-sm dark:ring-1 dark:ring-white/10" style={{ background: "#0d1a3a" }} aria-labelledby="tp-fix-title" data-testid="tp-fix">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="tp-fix-title" className="text-lg font-semibold">Redirect plan</h2>
          <p className="text-sm text-white/75" data-testid="tp-fix-scope">The error pages with the most backlinks, and what to do · {PROFILE_SCOPE_LABEL}</p>
        </div>
        <button type="button" onClick={onOpenErrors} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#0d1a3a] hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" data-testid="tp-fix-all">See all error pages</button>
      </div>

      <div className="mt-4">
        {fixFirst.status === "error" ? <SectionError message={fixFirst.error?.message} onRetry={fixFirst.refetch} /> : null}
        {fixFirst.status === "loading" ? <div className="space-y-2" aria-hidden data-testid="tp-fix-skeleton">{Array.from({ length: 3 }, (_, i) => <Skel key={i} className="h-14 w-full bg-white/10" />)}</div> : null}
        {fixFirst.status === "success" ? (
          <ol className="space-y-2" data-testid="tp-fix-list">
            {rows.map((row) => (
              <li key={row.id} className="grid items-center gap-x-4 gap-y-2 rounded-xl bg-white/[0.06] px-4 py-3 @min-[900px]/main:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,1.6fr)_auto]" data-testid="tp-fix-row">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusBadge row={row} className="shrink-0" />
                  <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 font-mono text-sm text-rose-200 hover:underline" title={row.url} data-testid="tp-fix-url">
                    <span className="truncate">{row.address}</span><ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
                  </a>
                </div>
                <ArrowRight className="hidden size-4 text-emerald-300 @min-[900px]/main:block" aria-hidden />
                <p className="min-w-0 text-sm text-white/85" data-testid="tp-fix-text">{describeWaste(row)}</p>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm tabular-nums">
                  <span title="Backlinks"><strong data-testid="tp-fix-backlinks">{formatExact(row.backlinks ?? 0)}</strong> <span className="text-white/70">links</span></span>
                  <span title="Referring domains"><strong data-testid="tp-fix-rd">{row.referringDomains === null ? "—" : formatExact(row.referringDomains)}</strong> <span className="text-white/70">domains</span></span>
                  <Link href={backlinksHref(row.url)} className="rounded-md border border-white/25 px-2.5 py-1 text-xs font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" data-testid="tp-fix-backlinks-link">View backlinks</Link>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {blocked ? <p className="mt-4 text-sm text-white/80" data-testid="tp-fix-blocked">{BLOCKED_NOTE}</p> : null}
      </div>
    </section>
  )
}
