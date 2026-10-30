import { Suspense } from "react"
import DomainOverviewDashboard from "@/components/dashboard/domain-overview/DomainOverviewDashboard"

export const metadata = { title: "Domain Overview" }

export default function DomainOverviewPage() {
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <DomainOverviewDashboard />
    </Suspense>
  )
}
