"use client"

import { useState } from "react"
import Link from "next/link"
import { useProject } from "@/contexts/ProjectContext"
import { useGoogleAioSummary, useGoogleAioRun, useCancelGoogleAioRun, useGoogleAioLiveProgress } from "@/hooks/useGoogleAioVisibility"
import { useApprovedQuestionSet, useBusinessProfile } from "@/hooks/useAiVisibilityQuestions"
import { Button } from "@/components/ui/button"
import { PageHeader, Panel, EmptyState, ErrorNote, Notice, PageSkeleton, Figure, StatusMark } from "../shared/parts"
import ProfileDialog from "../shared/profile/ProfileDialog"
import LiveRunProgress from "./LiveRunProgress"
import RunDialog from "./RunDialog"
import QuestionResultsTable from "./QuestionResultsTable"
import {
  PAGE_BASE, QUESTIONS_PER_RUN, LIMITATION_TEXT, METRIC_HELP, DEVICES, basis, errorText, formatCost, formatDateTime, num, pct, isActiveStatus, processedCount,
} from "./format"

export function NoProject() {
  return <EmptyState title="Select a project">Choose a project in the sidebar to see how Google's AI Overviews treat it.</EmptyState>
}

function Metrics({ overview }) {
  const o = overview
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-5">
      <Figure label="AI Overview appearance" value={pct(o.aiOverview?.rate)} basis={basis(o.aiOverview, "questions")} tone="data" />
      <Figure label="Brand mention rate" value={pct(o.brandMention?.rate)} basis={basis(o.brandMention, "overviews")} tone="data" />
      <Figure label="Website citation rate" value={pct(o.websiteCitation?.rate)} basis={basis(o.websiteCitation, "overviews with sources")} tone="data" />
      <Figure label="Unique cited pages" value={num(o.uniqueCitedPages?.count)} basis={`${o.uniqueCitedPages?.citationOccurrences ?? 0} citations in total`} />
      <Figure
        label="Questions processed"
        value={`${processedCount({ succeeded: o.questionsAnswered, failed: o.questionsFailed, skipped: o.questionsSkipped, cancelled: o.questionsCancelled })}/${o.questionsPlanned ?? QUESTIONS_PER_RUN}`}
        basis={[`${o.questionsAnswered ?? 0} searched`, o.questionsFailed ? `${o.questionsFailed} failed` : null, o.questionsSkipped ? `${o.questionsSkipped} not sent` : null, o.questionsCancelled ? `${o.questionsCancelled} cancelled` : null].filter(Boolean).join(" · ")}
      />
    </div>
  )
}

function MetricHelp() {
  return (
    <details className="rounded-lg border border-border/60 bg-card px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium">What these numbers mean</summary>
      <dl className="mt-3 space-y-2 text-muted-foreground">
        <div><dt className="font-medium text-foreground">AI Overview appearance</dt><dd>{METRIC_HELP.aiOverview}</dd></div>
        <div><dt className="font-medium text-foreground">Brand mention rate</dt><dd>{METRIC_HELP.brandMention}</dd></div>
        <div><dt className="font-medium text-foreground">Website citation rate</dt><dd>{METRIC_HELP.websiteCitation}</dd></div>
        <div><dt className="font-medium text-foreground">Unique cited pages</dt><dd>{METRIC_HELP.uniquePages}</dd></div>
        <div><dt className="font-medium text-foreground">Questions processed</dt><dd>{METRIC_HELP.questions}</dd></div>
      </dl>
    </details>
  )
}

function Competitors({ overview }) {
  const list = overview.competitors || []
  if (!list.length) return null
  return (
    <Panel title="Competitor visibility" description="Competitors saved for this business, in the same overviews. Being named and being linked are different things, so they are counted separately.">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">Competitor</th><th className="py-2 pr-3 font-medium">Named in overviews</th><th className="py-2 font-medium">Linked in sources</th></tr></thead>
        <tbody className="divide-y divide-border/40">
          {list.map((c) => (
            <tr key={c.name}>
              <td className="py-2 pr-3">{c.name}</td>
              <td className="py-2 pr-3 tabular-nums">{c.mentions?.denominator ? `${c.mentions.count} of ${c.mentions.denominator}` : "—"}</td>
              <td className="py-2 tabular-nums">{c.citations?.denominator ? `${c.citations.count} of ${c.citations.denominator}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

export default function GoogleAioDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const { data: summary, isLoading, error } = useGoogleAioSummary(projectId)
  const { data: approvedData, isLoading: approvedLoading } = useApprovedQuestionSet(projectId)
  const { data: profileData } = useBusinessProfile(projectId)
  const live = useGoogleAioLiveProgress(projectId)
  const cancel = useCancelGoogleAioRun(projectId)
  const [profileOpen, setProfileOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)

  const overview = summary?.data?.overview || null
  const active = summary?.data?.active || null
  const latest = summary?.data?.latest || null
  const approved = approvedData?.data || null
  const { data: runData } = useGoogleAioRun(projectId, overview?.runId)
  const run = runData?.data || null
  const profile = profileData?.data

  if (!projectId) return <NoProject />
  if (isLoading || approvedLoading) return <PageSkeleton />

  const inFlight = Boolean(active && isActiveStatus(active.status))
  const newerApproved = approved && overview && approved.version !== overview.questionSetVersion
  const failedLatest = latest && !overview && latest.status !== "completed" ? latest : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google AI Overview Visibility"
        description="Whether Google's AI Overviews appear for the questions your customers search, name your business and link to your website."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setProfileOpen(true)}>Business profile</Button>
            <Button variant="outline" asChild><Link href={`${PAGE_BASE}/questions`}>Questions</Link></Button>
            <Button onClick={() => setRunOpen(true)} disabled={!approved || inFlight}>{inFlight ? "Run in progress" : "Run 5 questions"}</Button>
          </div>
        )}
      />

      {error ? <ErrorNote>Could not load visibility results. Try again shortly.</ErrorNote> : null}
      {cancel.error ? <ErrorNote>{cancel.error.message || "Could not cancel the run."}</ErrorNote> : null}
      {profile?.completeness?.conflicts?.length ? (
        <ErrorNote>Two different cities are on record for this project. <button type="button" className="underline underline-offset-2" onClick={() => setProfileOpen(true)}>Confirm the target city</button> so Google is searched from the right place.</ErrorNote>
      ) : null}

      {inFlight ? <LiveRunProgress active={active} live={live} onCancel={(id) => cancel.mutate(id)} cancelling={cancel.isPending} /> : null}

      {!overview ? (
        <EmptyState
          title="No Google AI Overview run yet"
          action={approved ? <Button onClick={() => setRunOpen(true)} disabled={inFlight}>Run 5 questions</Button> : <Button asChild><Link href={`${PAGE_BASE}/questions`}>Set up questions</Link></Button>}
        >
          {approved
            ? `Odito will search Google for ${QUESTIONS_PER_RUN} of your approved questions and record what Google shows. Nothing is estimated before the first run.`
            : "Confirm your business profile, generate a question set and approve it. Then Odito searches Google for five of those questions."}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <StatusMark status={overview.status} />
            <span>Last run {formatDateTime(overview.completedAt)}</span>
            <span>Questions v{overview.questionSetVersion}</span>
            {overview.location ? <span>{overview.location.name} · {DEVICES[overview.location.device] || overview.location.device}</span> : null}
            <Link href={`${PAGE_BASE}/history`} className="text-foreground underline-offset-4 hover:underline">History</Link>
          </div>
          {overview.partial ? <Notice tone="warn">{overview.questionsAnswered} of {overview.questionsPlanned} questions were searched ({[overview.questionsFailed ? `${overview.questionsFailed} failed` : null, overview.questionsSkipped ? `${overview.questionsSkipped} not sent` : null, overview.questionsCancelled ? `${overview.questionsCancelled} cancelled` : null].filter(Boolean).join(", ")}). The figures use only the searched ones; failed or unsent questions are not counted as "no AI Overview".</Notice> : null}
          {newerApproved ? <Notice tone="warn">Questions v{approved.version} are now approved, but these results come from v{overview.questionSetVersion}.</Notice> : null}
          {run?.failureCode && run.status !== "completed" ? <ErrorNote>{errorText(run.failureCode)}</ErrorNote> : null}
          {failedLatest ? <ErrorNote>{errorText(failedLatest.failureCode) || "The latest run failed."}</ErrorNote> : null}

          <Metrics overview={overview} />
          <MetricHelp />
          {(overview.limitations || []).filter((l) => LIMITATION_TEXT[l]).map((l) => <Notice key={l}>{LIMITATION_TEXT[l]}</Notice>)}
          <QuestionResultsTable projectId={projectId} runId={overview.runId} />
          <Competitors overview={overview} />
          <p className="text-xs text-muted-foreground tabular-nums">Provider cost of this run: {formatCost(overview.cost)}</p>
        </>
      )}
      {!overview && failedLatest ? <ErrorNote>{errorText(failedLatest.failureCode) || "The latest run failed."}</ErrorNote> : null}

      <p className="max-w-3xl text-xs text-muted-foreground">
        A sample of what Google showed for five searches, collected through a data provider. Google's AI Overviews vary by place, device and over time, and a change between runs does not by itself show what caused it.
      </p>

      <RunDialog open={runOpen} onOpenChange={setRunOpen} projectId={projectId} active={active} onEditProfile={() => { setRunOpen(false); setProfileOpen(true) }} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} projectId={projectId} showGenerate={false} />
    </div>
  )
}
