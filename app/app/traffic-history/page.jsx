import { Suspense } from "react"
import TrafficHistoryDashboard from "@/components/dashboard/traffic-history/TrafficHistoryDashboard"

export const metadata = { title: "Traffic History" }

export default function TrafficHistoryPage() {
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <TrafficHistoryDashboard />
    </Suspense>
  )
}
