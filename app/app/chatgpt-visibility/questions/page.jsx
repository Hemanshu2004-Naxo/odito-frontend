import { Suspense } from "react"
import QuestionSetsContent from "@/components/dashboard/chatgpt-visibility/questions/QuestionSetsContent"
import { PageSkeleton } from "@/components/dashboard/chatgpt-visibility/parts"

export default function ChatGptVisibilityQuestionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QuestionSetsContent />
    </Suspense>
  )
}
