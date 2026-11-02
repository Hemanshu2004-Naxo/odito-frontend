"use client"

import { useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useBusinessInfo } from "@/hooks/useBusinessInfo"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import BusinessIdentityCard from "./BusinessIdentityCard"
import BusinessLocationCard from "./BusinessLocationCard"
import BusinessVerificationCard from "./BusinessVerificationCard"

/**
 * Project Settings → Business Information: verification summary, location, identity. Owns the unsaved-changes guard: reloading or closing
 * the page with edits in either form asks first. (Keyed by project in the page, so one project's edits never carry into the next.)
 */
export default function BusinessInformationSection({ projectId }) {
  const info = useBusinessInfo(projectId)
  const { toasts, notify, dismiss } = useToastQueue()
  const dirty = useRef({ identity: false, location: false })
  const setIdentityDirty = useCallback((v) => { dirty.current.identity = v }, [])
  const setLocationDirty = useCallback((v) => { dirty.current.location = v }, [])

  useEffect(() => {
    const warn = (e) => { if (dirty.current.identity || dirty.current.location) { e.preventDefault(); e.returnValue = "" } }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [])

  if (info.isLoading) {
    return <div className="space-y-6" aria-busy data-testid="business-loading">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}</div>
  }
  if (info.isError || !info.data) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-6" data-testid="business-error">
        <p className="font-medium">Business information could not be loaded.</p>
        <p className="text-sm text-muted-foreground">{info.error?.message || "Check your connection and try again."}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => info.refetch()}>Try again</Button>
      </div>
    )
  }
  return (
    <section className="space-y-6" aria-label="Business information">
      <BusinessVerificationCard data={info.data} />
      <BusinessLocationCard projectId={projectId} data={info.data} saving={info.saving} onSave={info.save} onDirtyChange={setLocationDirty} notify={notify} />
      <BusinessIdentityCard data={info.data} saving={info.saving} onSave={info.save} onDirtyChange={setIdentityDirty} notify={notify} />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </section>
  )
}
