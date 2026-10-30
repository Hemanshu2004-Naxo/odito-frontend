"use client"

import { useProject } from "@/contexts/ProjectContext"
import QuestionSetsContent from "../shared/questions/QuestionSetsContent"
import SelectionPanel from "./SelectionPanel"
import { PAGE_BASE, SET_SIZE } from "./format"

/**
 * Questions: the shared, versioned question workflow (profile -> draft -> review -> approve) re-labelled for Google AI Overview, plus the
 * five questions the next run would actually ask.
 */
export default function QuestionsContent() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  return (
    <QuestionSetsContent basePath={PAGE_BASE} engine="Google" maxQuestions={SET_SIZE}>
      {projectId ? <SelectionPanel projectId={projectId} /> : null}
    </QuestionSetsContent>
  )
}
