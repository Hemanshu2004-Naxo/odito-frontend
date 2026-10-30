import { Suspense } from "react"
import HistoryContent from "@/components/dashboard/google-aio-visibility/HistoryContent"
import { PageSkeleton } from "@/components/dashboard/shared/parts"

export const metadata = { title: "History · Google AI Overview Visibility" }

export default function GoogleAiOverviewHistoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HistoryContent />
    </Suspense>
  )
}
