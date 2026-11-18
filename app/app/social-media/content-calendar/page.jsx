"use client"

import { ContentPlanSection } from '@/components/social-media/ContentPlanSection'
import { useProject } from '@/contexts/ProjectContext'

/**
 * Social Media AI - Content Calendar: ONE calendar of every post on its date. The plan Odito writes from the AI strategy and the real
 * scheduled / published posts are shown together and filtered by status (Draft, In approval, Approved, Scheduled, Published), so there is no
 * second "Scheduled & published" view to look in. Reviewing happens in Content Approvals; rescheduling, retrying and cancelling a real post
 * happen in Scheduled Posts (a post opened from here goes there).
 */
export default function ContentCalendarPage() {
  const { activeProjectId } = useProject()

  return (
    <div className="flex-1 space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Content Calendar</h1>
        <p className="mt-1 text-sm text-slate-700">Every planned, scheduled and published post, on its date.</p>
      </div>

      {!activeProjectId ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm" data-testid="no-project">
          <p className="text-sm font-semibold text-slate-900">No project selected</p>
          <p className="mt-1 text-sm text-slate-700">Select or create a project to see its calendar.</p>
        </div>
      ) : (
        <ContentPlanSection projectId={activeProjectId} />
      )}
    </div>
  )
}
