"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"
import {
  useQuestionSet, useUpdateQuestion, useApproveQuestionSet, useDiscardQuestionSet, useApprovedQuestionSet,
} from "@/hooks/useAiVisibilityQuestions"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader, Panel, ErrorNote, Notice, PageSkeleton, NoProject, Pill } from "../parts"
import {
  GENERATED_BY_LABELS, INTENT_HINTS, INTENT_ORDER, MISSING_INFO_EFFECT, MISSING_INFO_TEXT, SET_STATUS_LABELS,
  describeQuestionError, errorText, formatDateTime, intentLabel, setWarningText,
} from "../format"
import QuestionRow from "./QuestionRow"
import ProfileDialog from "../profile/ProfileDialog"

const STATUS_TONE = { approved: "success", draft: "warn", archived: "neutral" }

function InputsSummary({ inputs }) {
  const rows = [
    ["Category", inputs?.categories], ["Services", inputs?.services], ["Cities", inputs?.cities], ["Areas", inputs?.areas],
    ["Customer types", inputs?.customerTypes], ["Problems", inputs?.problems], ["Requirements", inputs?.requirements], ["Buying requirements", inputs?.buyingRequirements],
  ].filter(([, v]) => Array.isArray(v) && v.length)
  if (!rows.length) return <p className="text-sm text-muted-foreground">No business details were confirmed for this set.</p>
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v.join(", ")}</dd></div>)}
    </dl>
  )
}

/**
 * One question set. `basePath` / `engine` let another visibility feature reuse the screen; `runHref` replaces the ChatGPT run dialog with a
 * link to that feature's overview (where its own run controls live). Defaults keep the ChatGPT page exactly as it was.
 */
export default function QuestionSetDetailContent({ basePath = "/app/google-ai-overview", engine = "Google", runHref = null }) {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const { setId } = useParams()
  const { data, isLoading, error } = useQuestionSet(projectId, setId)
  const { data: approvedData } = useApprovedQuestionSet(projectId)
  const update = useUpdateQuestion(projectId, setId)
  const approve = useApproveQuestionSet(projectId, setId)
  const discard = useDiscardQuestionSet(projectId, setId)
  const [confirm, setConfirm] = useState(null) // "approve" | "discard"
  const [newDraftOpen, setNewDraftOpen] = useState(false)

  const set = data?.data
  const approvedSet = approvedData?.data

  // Stable callbacks so QuestionRow (memoised) does not re-render for an unrelated question's change.
  const { mutateAsync: updateAsync } = update
  const onToggle = useCallback((questionId, enabled) => updateAsync({ questionId, changes: { enabled } }), [updateAsync])
  const onSave = useCallback((questionId, text) => updateAsync({ questionId, changes: { text } }), [updateAsync])

  const groups = useMemo(() => {
    const by = new Map()
    for (const q of (set?.questions || []).filter((x) => x.group !== "brand_reputation")) {
      const key = q.group === "brand_reputation" ? "brand_reputation" : q.intent
      if (!by.has(key)) by.set(key, [])
      by.get(key).push(q)
    }
    const known = INTENT_ORDER.filter((k) => by.has(k))
    const other = [...by.keys()].filter((k) => !INTENT_ORDER.includes(k))
    return [...known, ...other].map((k) => ({ key: k, questions: by.get(k) }))
  }, [set?.questions])


  if (!projectId) return <NoProject />
  if (isLoading) return <PageSkeleton />

  if (error || !set) {
    return (
      <div className="space-y-4">
        <Link href={`${basePath}/questions`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />All question sets</Link>
        <ErrorNote>{error ? describeQuestionError(error) : "Question set not found."}</ErrorNote>
      </div>
    )
  }

  const isDraft = set.status === "draft"
  const isApproved = set.status === "approved"
  const enabledVisibility = set.questions.filter((q) => q.enabled && q.group === "visibility").length
  const missing = set.missingBusinessInformation || []
  const warnings = set.warnings || []

  const doConfirm = () => {
    if (confirm === "approve") approve.mutate()
    if (confirm === "discard") discard.mutate()
    setConfirm(null)
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {isDraft ? (
        <>
          <Button variant="outline" disabled={discard.isPending || approve.isPending} onClick={() => setConfirm("discard")}>Discard draft</Button>
          <Button disabled={approve.isPending || discard.isPending || enabledVisibility === 0} onClick={() => setConfirm("approve")}>{approve.isPending ? "Approving…" : "Approve"}</Button>
        </>
      ) : null}
      {isApproved ? (
        <>
          <Button variant="outline" onClick={() => setNewDraftOpen(true)}>Update profile and generate new questions</Button>
          <Button asChild><Link href={runHref || basePath}>Go to the overview to run</Link></Button>
        </>
      ) : null}
      {set.status === "archived" ? <Button variant="outline" onClick={() => setNewDraftOpen(true)}>Update profile and generate new questions</Button> : null}
    </div>
  )

  return (
    <div className="space-y-6">
      <Link href={`${basePath}/questions`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />All question sets
      </Link>

      <PageHeader
        title={`Version ${set.version}`}
        description={`${SET_STATUS_LABELS[set.status] || set.status} · generated ${formatDateTime(set.createdAt)} · ${GENERATED_BY_LABELS[set.generatedBy] || set.generatedBy}${set.model ? ` (${set.model})` : ""}`}
        actions={actions}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={STATUS_TONE[set.status]}>{SET_STATUS_LABELS[set.status] || set.status}</Pill>
        <span className="text-sm text-muted-foreground tabular-nums">{set.counts.enabled} of {set.counts.total} questions enabled</span>
        {isApproved && set.approvedAt ? <span className="text-sm text-muted-foreground">Approved {formatDateTime(set.approvedAt)}</span> : null}
      </div>

      {approve.error ? <ErrorNote>{describeQuestionError(approve.error)}</ErrorNote> : null}
      {discard.error ? <ErrorNote>{describeQuestionError(discard.error)}</ErrorNote> : null}
      {set.fallbackReason ? <Notice tone="warn">OpenAI rewording was not used for this draft ({errorText(set.fallbackReason)}); the questions come from the built-in templates.</Notice> : null}
      {set.profileChanged ? <Notice tone="warn">Your business profile has changed since this set was generated, so some questions may no longer match it (for example a different target city). Generate new questions from the updated profile.</Notice> : null}
      {!isDraft ? (
        <Notice>
          {isApproved
            ? "This set is approved and read-only. To change a question, generate a new draft: approving it will archive this version."
            : "This set is archived and read-only. It is kept so past results can be traced to the exact questions that were asked."}
        </Notice>
      ) : (
        <Notice>
          Switch off any question that does not fit your business and reword the rest. The server checks every edit: an unbranded question may not name your business, a competitor or your website.
          {approvedSet && approvedSet.id !== set.id ? ` Approving this draft will archive version ${approvedSet.version}, which is currently approved.` : ""}
        </Notice>
      )}

      {missing.length || warnings.length ? (
        <Panel title="Before you approve" description="What the server could not use, and what it ignored or changed.">
          {missing.length ? (
            <ul className="space-y-1 text-sm">
              {missing.map((m) => <li key={m}><span className="font-medium">{MISSING_INFO_TEXT[m] || m}</span> <span className="text-muted-foreground">not confirmed. {MISSING_INFO_EFFECT[m] || ""}</span></li>)}
            </ul>
          ) : null}
          {warnings.length ? <ul className={`space-y-1 text-sm text-muted-foreground ${missing.length ? "mt-3" : ""}`}>{warnings.map((w) => <li key={w}>{setWarningText(w)}</li>)}</ul> : null}
        </Panel>
      ) : null}

      <Panel title="Confirmed business details" description="What this set was built from.">
        <InputsSummary inputs={set.inputs} />
      </Panel>

      {groups.map(({ key, questions }) => (
        <Panel
          key={key}
          title={`${intentLabel(key)} (${questions.filter((q) => q.enabled).length}/${questions.length})`}
          description={INTENT_HINTS[key]}
        >
          <ul className="divide-y divide-border/50">
            {questions.map((q) => <QuestionRow key={q.id} question={q} editable={isDraft} onToggle={onToggle} onSave={onSave} />)}
          </ul>
        </Panel>
      ))}

      {isDraft && enabledVisibility === 0 ? <ErrorNote>Enable at least one visibility question before approving.</ErrorNote> : null}

      <AlertDialog open={confirm !== null} onOpenChange={(v) => { if (!v) setConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "approve" ? `Approve version ${set.version}?` : `Discard version ${set.version}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "approve"
                ? `${set.counts.enabled} enabled ${set.counts.enabled === 1 ? "question is" : "questions are"} frozen. After approval nothing in this set can be edited${approvedSet && approvedSet.id !== set.id ? `, and version ${approvedSet.version} is archived` : ""}. Approving does not send anything to ${engine}: that happens when you run the set.`
                : "The draft is archived and cannot be approved or edited. You can generate a new draft at any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
            <AlertDialogAction onClick={doConfirm}>{confirm === "approve" ? "Approve" : "Discard"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProfileDialog open={newDraftOpen} onOpenChange={setNewDraftOpen} projectId={projectId} />
    </div>
  )
}
