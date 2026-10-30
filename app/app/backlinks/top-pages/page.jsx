import { Suspense } from "react"
import TopPagesDashboard from "@/components/dashboard/top-pages/TopPagesDashboard"

export const metadata = { title: "Top Pages" }

export default function TopPagesPage() {
  // Suspense: the page reads its tab, filters, sort and page from the URL (useSearchParams), which a statically rendered route must be able to defer.
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <TopPagesDashboard />
    </Suspense>
  )
}
