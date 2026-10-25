"use client"

import { memo, useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRunEvidence } from "@/hooks/useChatGptVisibility"
import { EmptyState, ErrorNote, Panel, Pill, StatusMark } from "../parts"
import { INTENT_ORDER, formatDateTime, intentLabel, isActiveStatus } from "../format"
import EvidenceSheet, { failureText } from "../evidence/EvidenceSheet"

const PAGE_SIZE = 20
const YES_NO = [{ value: "", label: "Any" }, { value: "true", label: "Yes" }, { value: "false", label: "No" }]
const RESULTS = [{ value: "", label: "All results" }, { value: "succeeded", label: "Answered" }, { value: "failed", label: "Failed" }, { value: "skipped", label: "Not sent" }]
const FILTER_LABELS = { mentioned: "Mentioned", recommended: "Recommended", cited: "Website cited", citedUrl: "Cites page", competitor: "Names competitor", intent: "Type", status: "Result", group: "Questions" }
const GROUP_LABELS = { brand_reputation: "Brand diagnostic", visibility: "Discovery" }

const yesNo = (v) => (v == null ? "—" : v ? "Yes" : "No")

const Row = memo(function Row({ item, runDate, onOpen }) {
  const answered = item.status === "succeeded"
  return (
    <tr className="border-t border-border/50 align-top">
      <td className="py-2.5 pr-4">
        <button type="button" onClick={() => onOpen(item.questionId)} className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open the answer for: ${item.question}`}>
          {item.question}
        </button>
        {!answered ? <div className="mt-0.5 text-xs text-muted-foreground">{failureText(item)}</div> : null}
      </td>
      <td className="py-2.5 pr-4">{item.group === "brand_reputation" ? <Pill>Brand diagnostic</Pill> : <span className="text-muted-foreground">{intentLabel(item.intent)}</span>}</td>
      <td className="py-2.5 pr-4">{answered ? yesNo(item.analysis?.brandMentioned) : "—"}</td>
      <td className="py-2.5 pr-4">{answered && item.group !== "brand_reputation" ? yesNo(item.analysis?.recommended) : "—"}</td>
      <td className="py-2.5 pr-4">{answered ? (item.firstPartyPages.length ? `Yes (${item.firstPartyPages.length})` : "No") : "—"}</td>
      <td className="py-2.5 pr-4 text-muted-foreground">{formatDateTime(item.completedAt || runDate)}</td>
      <td className="py-2.5"><StatusMark status={item.status} /></td>
    </tr>
  )
})

/**
 * Every question of one run with its result: searchable and filterable on the server, paginated, and each row opens the full stored answer
 * and its citations (loaded only then). `filter` / `onFilterChange` are controlled by the parent so a metric or a cited page can drill in.
 */
export default function QuestionsAnswersTable({ projectId, run, filter, onFilterChange }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(filter.q || "")
  const [openId, setOpenId] = useState(null)

  // Debounced search: one request after typing stops, not one per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { if ((filter.q || "") !== search.trim()) onFilterChange({ ...filter, q: search.trim() || undefined }) }, 350)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [filter])

  // Discovery questions only: brand-name questions are no longer shown.
  const params = useMemo(() => ({ page, limit: PAGE_SIZE, ...filter, group: "visibility" }), [page, filter])
  const { data, isLoading, error } = useRunEvidence(projectId, run.id, params)
  const items = data?.data || []
  const meta = data?.meta
  const active = Object.entries(filter).filter(([k, v]) => v && k !== "q")
  const set = (k) => (e) => onFilterChange({ ...filter, [k]: e.target.value || undefined })
  const intents = useMemo(() => INTENT_ORDER.filter((i) => i !== "brand_reputation" && (run.questions || []).some((q) => q.intent === i)), [run.questions])

  return (
    <Panel title="Questions and answers" description="Open any question to read ChatGPT's full answer and the sources it linked.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative block min-w-[14rem] flex-1">
          <span className="sr-only">Search questions</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" name="q" autoComplete="off" spellCheck={false} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="pl-8" maxLength={100} />
        </label>
        <Select label="Type" value={filter.intent || ""} onChange={set("intent")} options={[{ value: "", label: "All types" }, ...intents.map((i) => ({ value: i, label: intentLabel(i) }))]} />
        <Select label="Result" value={filter.status || ""} onChange={set("status")} options={RESULTS} />
        <Select label="Mentioned" value={filter.mentioned || ""} onChange={set("mentioned")} options={YES_NO} />
        <Select label="Recommended" value={filter.recommended || ""} onChange={set("recommended")} options={YES_NO} />
        <Select label="Website cited" value={filter.cited || ""} onChange={set("cited")} options={YES_NO} />
      </div>

      {active.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {active.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-2 pr-1">
              {FILTER_LABELS[k] || k}: {k === "citedUrl" ? v.replace(/^https:\/\//, "") : k === "group" ? (GROUP_LABELS[v] || v) : k === "intent" ? intentLabel(v) : v === "true" ? "Yes" : v === "false" ? "No" : v}
              <button type="button" aria-label={`Remove filter ${FILTER_LABELS[k] || k}`} onClick={() => onFilterChange({ ...filter, [k]: undefined })} className="rounded-full p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3" aria-hidden /></button>
            </span>
          ))}
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => { setSearch(""); onFilterChange({}) }}>Clear all</Button>
        </div>
      ) : null}

      <div className="mt-4">
        {error ? <ErrorNote>{error.status === 404 ? "This run's answers are not available." : "Could not load the answers. Try again."}</ErrorNote> : null}
        {isLoading ? <div className="h-48 rounded-lg skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
        {!isLoading && !error && !items.length ? (
          <EmptyState title={active.length || filter.q ? "No questions match" : "No answers stored yet"}>
            {active.length || filter.q ? "Try a different search or filter." : isActiveStatus(run.status) ? "Answers appear here as each question is answered." : "No answers were stored for this run."}
          </EmptyState>
        ) : null}
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Question</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Mentioned</th>
                  <th className="pb-2 pr-4 font-medium">Recommended</th>
                  <th className="pb-2 pr-4 font-medium">Website cited</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>{items.map((it) => <Row key={it.questionId} item={it} runDate={run.completedAt || run.createdAt} onOpen={setOpenId} />)}</tbody>
            </table>
          </div>
        ) : null}
        {meta && meta.totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {meta.page} of {meta.totalPages} · {meta.total} results</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        ) : null}
      </div>

      <EvidenceSheet projectId={projectId} runId={run.id} questionId={openId} open={openId !== null} onOpenChange={(v) => { if (!v) setOpenId(null) }} />
    </Panel>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select value={value} onChange={onChange} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
