import { Suspense } from "react"
import QuestionSetDetailContent from "@/components/dashboard/chatgpt-visibility/questions/QuestionSetDetailContent"
import { PageSkeleton } from "@/components/dashboard/chatgpt-visibility/parts"

export default function ChatGptVisibilityQuestionSetPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QuestionSetDetailContent />
    </Suspense>
  )
}
