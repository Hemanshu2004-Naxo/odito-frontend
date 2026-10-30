import { Suspense } from "react"
import QuestionsContent from "@/components/dashboard/google-aio-visibility/QuestionsContent"
import { PageSkeleton } from "@/components/dashboard/shared/parts"

export const metadata = { title: "Questions · Google AI Overview Visibility" }

export default function GoogleAiOverviewQuestionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QuestionsContent />
    </Suspense>
  )
}
