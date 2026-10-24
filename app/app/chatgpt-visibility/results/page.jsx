import { Suspense } from "react"
import RunResultsRouter from "@/components/dashboard/chatgpt-visibility/RunResultsRouter"
import { PageSkeleton } from "@/components/dashboard/chatgpt-visibility/parts"

export default function ChatGptVisibilityResultsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RunResultsRouter />
    </Suspense>
  )
}
