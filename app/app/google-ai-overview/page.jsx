import { Suspense } from "react"
import GoogleAioDashboard from "@/components/dashboard/google-aio-visibility/GoogleAioDashboard"
import { PageSkeleton } from "@/components/dashboard/shared/parts"

export const metadata = { title: "Google AI Overview Visibility" }

export default function GoogleAiOverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GoogleAioDashboard />
    </Suspense>
  )
}
