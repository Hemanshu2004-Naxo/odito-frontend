"use client"

import { ExternalLink, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import InfoHint from "../referring-domains/InfoHint"
import { MISSING, formatExact } from "../domain-overview/format"

function Section({ title, hint, children, testId }) {
  return (
    <section className="min-w-0 space-y-2" data-testid={testId}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">{title}{hint ? <InfoHint label={title} text={hint} /> : null}</h3>
      {children}
    </section>
  )
}

const Field = ({ label, children, testId }) => (
  <div className="flex items-baseline justify-between gap-3 text-sm" data-testid={testId}>
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
  </div>
)

const Chips = ({ items }) => (items.length
  ? <span className="inline-flex flex-wrap justify-end gap-1">{items.map((t) => <span key={t} className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-xs font-medium">{t}</span>)}</span>
  : MISSING)

const num = (v) => (v === null ? MISSING : <span className="tabular-nums">{formatExact(v)}</span>)

/**
 * Opened by clicking a row: how the link is used (the sentence around it), what the source page and the target are, the link's history,
 * and where it goes if it is indirect. Everything here is the same data as the row, never a second request.
 */
export default function ExpandedBacklink({ row, id, onFilterDomain }) {
  const { before, anchor, after } = row.context
  const hasContext = Boolean(before || after)
  const label = row.anchorKind === "image" ? (row.imageAlt ?? "(image link)") : (anchor ?? "(no anchor text)")
  return (
    <div id={id} role="region" aria-label={`Details for the link from ${row.sourceDomain ?? row.sourceUrl ?? "this source"}`} className="space-y-5 p-5" data-testid="bl-expanded">
      <Section title="Link context" testId="bl-context">
        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm leading-relaxed" data-testid="bl-context-text">
          {hasContext ? (
            <>
              {before ? <span className="text-muted-foreground">…{before}</span> : null}
              <strong className="font-semibold text-foreground" data-testid="bl-context-anchor">{label}</strong>
              {after ? <span className="text-muted-foreground">{after}…</span> : null}
            </>
          ) : (
            <>No surrounding text was recorded. Anchor: <strong className="font-semibold" data-testid="bl-context-anchor">{label}</strong></>
          )}
        </p>
      </Section>

      <div className="grid gap-6 @min-[760px]/main:grid-cols-3">
        <Section title="Source page" testId="bl-source-details">
          <dl className="space-y-1.5">
            <Field label="Language">{row.source.language ?? MISSING}</Field>
            <Field label="Country">{row.source.country ? `${row.source.country.flag} ${row.source.country.name}` : MISSING}</Field>
            <Field label="Site types"><Chips items={row.source.platformTypes} /></Field>
            <Field label="IP address"><span className="tabular-nums">{row.source.ip ?? MISSING}</span></Field>
            <Field label={<span className="inline-flex items-center gap-1">External links <InfoHint label="External links on the source page" text="How many links to other sites this page has. A page that links out a lot passes less value through each link." /></span>}>{num(row.source.externalLinks)}</Field>
            <Field label="Internal links">{num(row.source.internalLinks)}</Field>
          </dl>
        </Section>

        <Section title="Target" testId="bl-target-details">
          <dl className="space-y-1.5">
            <Field label="Status code" testId="bl-target-status">{row.targetStatus ?? MISSING}</Field>
            <Field label="Redirects to"><span className="break-all">{row.targetRedirect ?? MISSING}</span></Field>
            <Field label="Target spam score">{num(row.targetSpam)}</Field>
            <Field label="Links on the page">{num(row.linksCount)}</Field>
          </dl>
        </Section>

        <Section title="History" testId="bl-history">
          <dl className="space-y-1.5">
            <Field label="First seen"><span title={row.firstSeen.tooltip ?? undefined}>{row.firstSeen.label ?? MISSING}</span></Field>
            <Field label="Previously seen"><span title={row.prevSeen.tooltip ?? undefined}>{row.prevSeen.label ?? MISSING}</span></Field>
            <Field label="Last seen"><span title={row.lastSeen.tooltip ?? undefined}>{row.lastSeen.label ?? MISSING}</span></Field>
            <Field label={<span className="inline-flex items-center gap-1">Original <InfoHint label="Original" text="Yes: this link was already on the page when the page was first crawled." /></span>}>
              {row.original === null ? MISSING : row.original ? "Yes" : "No"}
            </Field>
          </dl>
        </Section>
      </div>

      {row.isIndirect ? (
        <Section title="Indirect link" hint="The link reaches your site through other URLs (for example a redirect). This is the chain it follows." testId="bl-indirect">
          {row.indirectPath.length ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {row.indirectPath.map((u, i) => <li key={`${u}-${i}`} className="break-all">{u}</li>)}
            </ol>
          ) : <p className="text-sm text-muted-foreground">The provider did not say which URLs it passes through.</p>}
        </Section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {row.sourceUrl ? (
          <Button asChild variant="outline" size="sm"><a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" data-testid="bl-open-source"><ExternalLink className="size-3.5" aria-hidden /> Open source page</a></Button>
        ) : null}
        {row.targetUrl ? (
          <Button asChild variant="outline" size="sm"><a href={row.targetUrl} target="_blank" rel="noopener noreferrer" data-testid="bl-open-target"><ExternalLink className="size-3.5" aria-hidden /> Open target URL</a></Button>
        ) : null}
        {row.sourceDomain ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onFilterDomain(row.sourceDomain)} data-testid="bl-view-domain"><Users className="size-3.5" aria-hidden /> View all links from this domain</Button>
        ) : null}
      </div>
    </div>
  )
}
