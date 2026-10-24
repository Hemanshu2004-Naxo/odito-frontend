"use client"

import { useProject } from "@/contexts/ProjectContext"
import { PageHeader, NoProject } from "./parts"
import ApprovedHistoryContent from "./evidence/ApprovedHistoryContent"
import HistoryContent from "./HistoryContent"

/** History: approved-question runs (tied to their question-set version) and, below, the original five-prompt checks. */
export default function HistoryHome() {
  const { activeProject } = useProject()
  if (!activeProject?._id) return <NoProject />
  return (
    <div className="space-y-8">
      <PageHeader
        title="History"
        description="Every check, newest first. A change is only shown against a previous run that asked the same questions."
      />
      <ApprovedHistoryContent />
      <HistoryContent embedded />
    </div>
  )
}
