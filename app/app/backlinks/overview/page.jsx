import { Suspense } from "react"
import BacklinkOverviewDashboard from "@/components/dashboard/backlinks-overview/BacklinkOverviewDashboard"

export const metadata = { title: "Backlink Overview" }

export default function BacklinkOverviewPage() {
  // Suspense: the page reads its controls from the URL (useSearchParams), which a statically rendered route must be able to defer.
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <BacklinkOverviewDashboard />
    </Suspense>
  )
}
