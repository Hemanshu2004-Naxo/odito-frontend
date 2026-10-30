import { Suspense } from "react"
import AnchorsDashboard from "@/components/dashboard/anchors/AnchorsDashboard"

export const metadata = { title: "Anchors" }

export default function AnchorsPage() {
  // Suspense: the page reads its status, filters, sort and page from the URL (useSearchParams), which a statically rendered route must be able to defer.
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <AnchorsDashboard />
    </Suspense>
  )
}
