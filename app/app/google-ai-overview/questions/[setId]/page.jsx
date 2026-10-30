import { Suspense } from "react"
import QuestionSetDetailContent from "@/components/dashboard/shared/questions/QuestionSetDetailContent"
import { PageSkeleton } from "@/components/dashboard/shared/parts"

export const metadata = { title: "Question set · Google AI Overview Visibility" }

export default function GoogleAiOverviewQuestionSetPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QuestionSetDetailContent basePath="/app/google-ai-overview" engine="Google" runHref="/app/google-ai-overview" />
    </Suspense>
  )
}
