"use client"

import Link from "next/link"
import { Check, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Panel } from "../parts"
import { APPROVED_LIMITATION_TEXT, COST_TEXT, num, pct1 } from "../format"

/**
 * Tracked competitors and how often each appears in the same eligible answers. Only competitors saved for the business are counted - this
 * is not every competitor in the market. With none configured, the panel says how to add them instead of showing zeros.
 */
export function CompetitorsPanel({ overview, onShowAnswers }) {
  const { configured, mentioned = [] } = overview.competitors
  return (
    <Panel title="Competitors" description="Tracked competitors named in the same answers, out of the same eligible answers.">
      {!configured ? (
        <p className="text-sm text-muted-foreground">
          No competitors are tracked yet. Add them in your <Link className="underline underline-offset-2" href="/app/social-media/business-profile">Social Media business profile</Link> to see how often ChatGPT names them alongside or instead of you.
        </p>
      ) : !mentioned.length ? (
        <p className="text-sm text-muted-foreground">None of your tracked competitors were named in this run.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {mentioned.map((c) => (
            <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                {pct1(c.rate)} · {c.answers} of {overview.eligibleAnswers} eligible answers
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onShowAnswers?.(c.name)} aria-label={`Show answers naming ${c.name}`}>Answers</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/**
 * Execution diagnostics and cost - deliberately NOT headline metrics: how many questions were answered says nothing about visibility.
 */
export function RunDetailsPanel({ overview }) {
  const e = overview.execution
  const cost = overview.cost
  return (
    <Panel title="Run details" description="How the run went. These are diagnostics, not visibility.">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
        <div><dt className="text-muted-foreground">Questions sent</dt><dd className="font-medium tabular-nums">{e.attempted}</dd></div>
        <div><dt className="text-muted-foreground">Answered</dt><dd className="font-medium tabular-nums">{e.answered}</dd></div>
        <div><dt className="text-muted-foreground">Failed</dt><dd className="font-medium tabular-nums">{e.failed}</dd></div>
        <div><dt className="text-muted-foreground">Not sent</dt><dd className="font-medium tabular-nums">{e.skipped}</dd></div>
        <div>
          <dt className="text-muted-foreground">Provider cost</dt>
          <dd className="font-medium tabular-nums">{COST_TEXT(cost)}</dd>
          {cost?.unknownCostCount ? <dd className="text-xs text-muted-foreground">{cost.unknownCostCount} answers had no reported cost (not counted as zero)</dd> : null}
          {cost?.knownTotal != null ? <dd className="text-xs text-muted-foreground">As reported by the data provider; the currency is not stated by its API</dd> : null}
        </div>
        <div><dt className="text-muted-foreground">Citations of your site</dt><dd className="font-medium tabular-nums">{num(overview.citationOccurrences)}</dd></div>
      </dl>
      <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
        {(overview.limitations || []).filter((c) => APPROVED_LIMITATION_TEXT[c]).map((c) => <li key={c}>{APPROVED_LIMITATION_TEXT[c]}</li>)}
        <li>“Recommended” is estimated from the wording of each answer (method heuristic_v1). Open an answer to check it.</li>
      </ul>
    </Panel>
  )
}

/** The path to a first result, each step derived from server data. */
export function SetupChecklist({ profileReady, hasDraft, draftId, approved, onEditProfile, onRun, running }) {
  const steps = [
    { done: profileReady, title: "Confirm your business profile", text: "Industry, kind of business, services and the cities you target.", action: <Button size="sm" variant={profileReady ? "outline" : "default"} onClick={onEditProfile}>{profileReady ? "Review" : "Confirm profile"}</Button> },
    { done: Boolean(approved), title: "Review and approve the questions", text: "Discovery questions never name your business; you can switch any off or reword them.", action: approved ? null : <Button size="sm" variant={hasDraft ? "default" : "outline"} asChild><Link href={hasDraft ? `/app/chatgpt-visibility/questions/${draftId}` : "/app/chatgpt-visibility/questions"}>{hasDraft ? "Review draft" : "Go to questions"}</Link></Button> },
    { done: false, title: "Run the approved questions", text: "Each question is one paid request to the data provider.", action: approved ? <Button size="sm" onClick={onRun} disabled={running}>{running ? "Run in progress" : "Run now"}</Button> : null },
  ]
  return (
    <Panel title="Get your first visibility result" description="Three steps. Nothing is sent to ChatGPT until you run approved questions.">
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {s.done ? <Check className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-label="Done" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="To do" />}
              <div>
                <div className="text-sm font-medium">{i + 1}. {s.title}</div>
                <div className="text-xs text-muted-foreground">{s.text}</div>
              </div>
            </div>
            {s.action}
          </li>
        ))}
      </ol>
    </Panel>
  )
}
