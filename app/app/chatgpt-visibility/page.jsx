import { Suspense } from "react"
import VisibilityDashboard from "@/components/dashboard/chatgpt-visibility/VisibilityDashboard"
import { PageSkeleton } from "@/components/dashboard/chatgpt-visibility/parts"

export default function ChatGptVisibilityPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VisibilityDashboard />
    </Suspense>
  )
}
