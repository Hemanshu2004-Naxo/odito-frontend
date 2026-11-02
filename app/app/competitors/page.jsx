import { Suspense } from "react"
import CompetitorsTabs from "@/components/dashboard/competitors/CompetitorsTabs"

export const metadata = { title: "Competitors" }

export default function CompetitorsPage() {
  // Suspense: the page reads its settings from the URL (useSearchParams), which a statically rendered route must be able to defer.
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <CompetitorsTabs />
    </Suspense>
  )
}
