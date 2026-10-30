import { Suspense } from "react"
import CompetitorsDashboard from "@/components/dashboard/competitors/CompetitorsDashboard"

export const metadata = { title: "Competitors" }

export default function CompetitorsPage() {
  // Suspense: the page reads its settings from the URL (useSearchParams), which a statically rendered route must be able to defer.
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <CompetitorsDashboard />
    </Suspense>
  )
}
