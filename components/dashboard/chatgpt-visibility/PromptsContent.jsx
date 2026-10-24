"use client"

import { useProject } from "@/contexts/ProjectContext"
import { useChatGptPromptSets } from "@/hooks/useChatGptVisibility"
import { PageHeader, Panel, EmptyState, ErrorNote, PageSkeleton, NoProject } from "./parts"
import { CATEGORY_LABELS, CATEGORY_ORDER, PROMPT_SOURCE_LABELS, formatDateTime } from "./format"

export default function PromptsContent() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const { data, isLoading, error } = useChatGptPromptSets(projectId)

  if (!projectId) return <NoProject />
  if (isLoading) return <PageSkeleton />
  const sets = data?.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompts"
        description="The five questions asked of ChatGPT, one per category. They are written from your business profile, kept as numbered versions, and reused until the profile changes, so one check can be compared with the next."
      />
      {error ? <ErrorNote>Could not load the prompts.</ErrorNote> : null}
      {!sets.length ? (
        <EmptyState title="No prompts yet">The questions are written the first time a visibility check runs.</EmptyState>
      ) : sets.map((set, idx) => (
        <Panel
          key={set.id}
          title={`Version ${set.version}${idx === 0 ? " · current" : ""}`}
          description={`${PROMPT_SOURCE_LABELS[set.generatedBy] || set.generatedBy} · ${formatDateTime(set.createdAt)}`}
        >
          <ol className="divide-y divide-border/50">
            {[...set.prompts].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)).map((p) => (
              <li key={p.category} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">{CATEGORY_LABELS[p.category] || p.category}</h3>
                  <span className="text-xs text-muted-foreground">
                    {p.branded ? "Names your business" : "Doesn't name your business"}
                    {p.usesService ? " · uses a saved service" : ""}
                    {p.usesCompetitors ? " · names saved competitors" : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm">{p.text}</p>
              </li>
            ))}
          </ol>
        </Panel>
      ))}
    </div>
  )
}
