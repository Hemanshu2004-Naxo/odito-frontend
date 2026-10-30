import { Suspense } from "react"
import ResultsContent from "@/components/dashboard/google-aio-visibility/ResultsContent"
import { PageSkeleton } from "@/components/dashboard/shared/parts"

export const metadata = { title: "Answers & citations · Google AI Overview Visibility" }

export default function GoogleAiOverviewResultsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResultsContent />
    </Suspense>
  )
}
