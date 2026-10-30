"use client"

import Link from "next/link"
import { ArrowLeft, Construction } from "lucide-react"

/** Placeholder for a page the Domain Overview already links to but that is not built yet. */
export default function ComingSoon({ title, description }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card/50 p-8" data-testid="coming-soon">
        <Construction className="size-5 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-base font-semibold">This page is coming soon.</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">The overview already shows a summary of this data; the full view is not available yet.</p>
        </div>
        <Link href="/app/domain-overview" className="inline-flex items-center gap-1 text-sm font-medium hover:underline underline-offset-2">
          <ArrowLeft className="size-4" aria-hidden /> Back to Domain Overview
        </Link>
      </div>
    </div>
  )
}
