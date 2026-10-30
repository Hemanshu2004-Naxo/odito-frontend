import { Suspense } from "react"
import OrganicKeywordsDashboard from "@/components/dashboard/organic-keywords/OrganicKeywordsDashboard"

export const metadata = { title: "Organic Keywords" }

export default function OrganicKeywordsPage() {
  // Suspense: the page reads its filters from the URL (useSearchParams), which a statically rendered route must be able to defer.
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <OrganicKeywordsDashboard />
    </Suspense>
  )
}
