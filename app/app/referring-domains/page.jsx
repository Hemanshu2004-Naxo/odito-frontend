import { Suspense } from "react"
import ReferringDomainsDashboard from "@/components/dashboard/referring-domains/ReferringDomainsDashboard"

export const metadata = { title: "Referring Domains" }

export default function ReferringDomainsPage() {
  return (
    <Suspense fallback={<div className="h-72 rounded-xl skeleton-base skeleton-shimmer" />}>
      <ReferringDomainsDashboard />
    </Suspense>
  )
}
