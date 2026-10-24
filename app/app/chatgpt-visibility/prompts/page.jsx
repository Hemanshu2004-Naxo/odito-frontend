import { Suspense } from "react"
import PromptsContent from "@/components/dashboard/chatgpt-visibility/PromptsContent"
import { PageSkeleton } from "@/components/dashboard/chatgpt-visibility/parts"

export default function ChatGptVisibilityPromptsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PromptsContent />
    </Suspense>
  )
}
