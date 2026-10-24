import { Suspense } from "react"
import HistoryHome from "@/components/dashboard/chatgpt-visibility/HistoryHome"
import { PageSkeleton } from "@/components/dashboard/chatgpt-visibility/parts"

export default function ChatGptVisibilityHistoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HistoryHome />
    </Suspense>
  )
}
