"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useProject } from "@/contexts/ProjectContext"
import { useChatGptSummary, useChatGptRun, useCancelChatGptRun, useChatGptLiveProgress } from "@/hooks/useChatGptVisibility"
import { useApprovedQuestionSet, useQuestionSets, useBusinessProfile } from "@/hooks/useAiVisibilityQuestions"
import { Button } from "@/components/ui/button"
import { PageHeader, Panel, ErrorNote, Notice, PageSkeleton, NoProject, StatusMark, FailureNote } from "./parts"
import { describeQuestionError, formatDateTime } from "./format"
import LiveRunProgress from "./LiveRunProgress"
import RunApprovedDialog from "./RunApprovedDialog"
import ProfileDialog from "./profile/ProfileDialog"
import VisibilityOverviewCard from "./dashboard/VisibilityOverviewCard"
import VisibilityTrendChart from "./dashboard/VisibilityTrendChart"
import MostCitedPages from "./dashboard/MostCitedPages"
import QuestionsAnswersTable from "./dashboard/QuestionsAnswersTable"
import { CompetitorsPanel, RunDetailsPanel, SetupChecklist } from "./dashboard/SupportingPanels"

/**
 * ChatGPT Visibility: whether ChatGPT finds and recommends the business when customers ask relevant questions. Everything shown comes from
 * the API; nothing is computed here except presentation. The latest finished approved-question run drives the figures; the evidence behind
 * any figure is one click away.
 */
export default function VisibilityDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const { data: summary, isLoading, error } = useChatGptSummary(projectId)
  const { data: approvedData, isLoading: approvedLoading } = useApprovedQuestionSet(projectId)
  const setsParams = useMemo(() => ({ page: 1, limit: 10 }), [])
  const { data: setsData } = useQuestionSets(projectId, setsParams)
  const { data: profileData } = useBusinessProfile(projectId)
  const live = useChatGptLiveProgress(projectId)
  const cancel = useCancelChatGptRun(projectId)
  const [range, setRange] = useState("90d")
  const [filter, setFilter] = useState({})
  const [profileOpen, setProfileOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const tableRef = useRef(null)

  const overview = summary?.data?.overview || null
  const active = summary?.data?.active || null
  const approved = approvedData?.data || null
  const { data: runData } = useChatGptRun(projectId, overview?.runId)
  const run = runData?.data || null
  const draft = (setsData?.data || []).find((s) => s.status === "draft")
  const profile = profileData?.data

  const drill = useCallback((next) => {
    setFilter(next)
    tableRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
  }, [])

  if (!projectId) return <NoProject />
  if (isLoading || approvedLoading) return <PageSkeleton />

  const approvedActive = active?.executionMode === "approved_questions"
  const newerApproved = approved && overview && approved.version !== overview.questionSetVersion

  return (
    <div className="space-y-6">
      <PageHeader
        title="ChatGPT Visibility"
        description="Whether ChatGPT finds, recommends and links to your business when customers ask about what you offer."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setProfileOpen(true)}>Business profile</Button>
            <Button variant="outline" asChild><Link href={approved ? `/app/chatgpt-visibility/questions/${approved.id}` : "/app/chatgpt-visibility/questions"}>Questions</Link></Button>
            <Button onClick={() => setRunOpen(true)} disabled={!approved || Boolean(active)}>{active ? "Run in progress" : "Run approved questions"}</Button>
          </div>
        )}
      />

      {error ? <ErrorNote>Could not load visibility results. Try again shortly.</ErrorNote> : null}
      {cancel.error ? <ErrorNote>{describeQuestionError(cancel.error)}</ErrorNote> : null}
      {profile?.completeness?.conflicts?.length ? (
        <ErrorNote>Two different cities are on record for this project. <button type="button" className="underline underline-offset-2" onClick={() => setProfileOpen(true)}>Confirm the target city</button> so questions target the right market.</ErrorNote>
      ) : null}

      {approvedActive ? <LiveRunProgress active={active} live={live} onCancel={(id) => cancel.mutate(id)} cancelling={cancel.isPending} /> : null}

      {!overview ? (
        <SetupChecklist
          profileReady={Boolean(profile?.completeness?.ready)}
          hasDraft={Boolean(draft)} draftId={draft?.id} approved={approved}
          onEditProfile={() => setProfileOpen(true)} onRun={() => setRunOpen(true)} running={Boolean(active)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <StatusMark status={overview.status} />
            <span>Latest run {formatDateTime(overview.completedAt)}</span>
            <span>Questions v{overview.questionSetVersion}</span>
            <Link href="/app/chatgpt-visibility/history" className="text-foreground underline-offset-4 hover:underline">Compare runs</Link>
          </div>
          {overview.partial ? <Notice tone="warn">Some questions in this run failed or were not sent. The figures use only the answers that came back.</Notice> : null}
          {newerApproved ? <Notice tone="warn">Questions v{approved.version} are now approved, but these results come from v{overview.questionSetVersion}. Run the approved questions to update them.</Notice> : null}
          {approved?.profileChanged ? <Notice tone="warn">Your business profile changed after these questions were approved. <Link className="underline underline-offset-2" href="/app/chatgpt-visibility/questions">Generate new questions</Link> so they match the profile.</Notice> : null}
          <FailureNote run={run} />

          <VisibilityOverviewCard overview={overview} onDrill={drill} />
          <VisibilityTrendChart projectId={projectId} range={range} onRangeChange={setRange} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <MostCitedPages projectId={projectId} runId={overview.runId} onSelectPage={(url) => drill({ citedUrl: url })} />
            <CompetitorsPanel overview={overview} onShowAnswers={(name) => drill({ competitor: name })} />
          </div>
          <div ref={tableRef} className="scroll-mt-4">
            {run ? <QuestionsAnswersTable projectId={projectId} run={run} filter={filter} onFilterChange={setFilter} /> : <Panel><div className="h-24 rounded-lg skeleton-base skeleton-shimmer" aria-busy="true" /></Panel>}
          </div>
          {run?.metrics?.brandReputation?.questions ? (
            <Panel title="What ChatGPT knows about your business" description="Answers to questions that name your business. They check accuracy and are never counted in the visibility figures above.">
              <p className="text-sm tabular-nums">
                {run.metrics.brandReputation.succeeded} of {run.metrics.brandReputation.questions} answered · {run.metrics.brandReputation.answersMentioningBrand} describe your business
                {" "}<Button variant="link" size="sm" className="h-auto p-0" onClick={() => drill({ group: "brand_reputation" })}>Read them</Button>
              </p>
            </Panel>
          ) : null}
          <RunDetailsPanel overview={overview} />
        </>
      )}

      <p className="max-w-3xl text-xs text-muted-foreground">
        A sample of ChatGPT's answers to your approved questions, collected through a data provider. Answers vary between users and over time, and a change between runs does not by itself show what caused it.
        This is separate from the on-page AI readiness scores in the AISO, AEO and GEO hubs.
      </p>

      {approved ? <RunApprovedDialog open={runOpen} onOpenChange={setRunOpen} projectId={projectId} set={approved} active={active} /> : null}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} projectId={projectId} />
    </div>
  )
}
