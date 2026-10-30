import { Suspense } from "react"
import BacklinksDashboard from "@/components/dashboard/backlinks/BacklinksDashboard"

export const metadata = { title: "Backlinks" }

export default function BacklinksListPage() {
  // Suspense: the page reads its tab, filters and sort from the URL (useSearchParams), which a statically rendered route must be able to defer.
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <BacklinksDashboard />
    </Suspense>
  )
}
