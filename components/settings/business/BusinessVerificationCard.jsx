"use client"

import { Link2, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { describeStatus, formatWhen } from "./businessInfoUi"

const SOURCE = { google_places: "Chosen from Google Places", manual: "Entered by hand" }

const Row = ({ label, children }) => (
  <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4">
    <dt className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-sm">{children}</dd>
  </div>
)

/**
 * Business Verification: what Odito knows about the location, and, separately, whether a Google Business Profile is connected.
 * Choosing a place never changes the second: the two answers come from different data.
 */
export default function BusinessVerificationCard({ data }) {
  const v = data?.verification
  const loc = data?.location
  const s = describeStatus(v?.status)
  const when = formatWhen(v?.updatedAt)
  const none = <span className="text-muted-foreground">None</span>
  return (
    <Card data-testid="business-verification-card">
      <CardHeader>
        <CardTitle className="text-lg">Business verification</CardTitle>
        <CardDescription>What Odito knows about where your business is, and how sure it is.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <Badge variant={s.tone === "success" ? "success" : "secondary"} data-testid="verification-status">{s.label}</Badge>
            <p className="text-sm text-muted-foreground">{s.text}</p>
          </div>
        </div>
        <dl className="divide-y divide-border/60">
          <Row label="Selected address">{loc?.address ?? none}</Row>
          <Row label="Coordinates">
            {loc?.lat != null && loc?.lng != null
              ? <span className="font-mono text-xs">{loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}{v?.coordinatesAdjusted ? " (marker adjusted by you)" : ""}</span>
              : none}
          </Row>
          <Row label="Google Place ID">{loc?.placeId ? <span className="font-mono text-xs">{loc.placeId}</span> : none}</Row>
          <Row label="Source">{v?.source ? SOURCE[v.source] : none}</Row>
          <Row label="Last updated">{when ?? <span className="text-muted-foreground">{v?.status === "unconfirmed" ? "Not confirmed yet" : "Never"}</span>}</Row>
          <Row label="Google Business Profile">
            <span className="flex items-center gap-1.5" data-testid="gbp-status">
              <Link2 className="size-3.5" aria-hidden />
              {v?.googleBusinessProfileConnected ? "Connected" : "Not connected"}
            </span>
            <span className="block text-xs text-muted-foreground">Connecting a Business Profile is separate. Picking an address here does not verify ownership of one.</span>
          </Row>
        </dl>
      </CardContent>
    </Card>
  )
}
