"use client"

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useProject } from '@/contexts/ProjectContext'
import { useDesignJobs } from '@/hooks/useSocialMediaAI'
import { useToastQueue } from '@/hooks/useToastQueue'
import SocialMediaToastStack from '@/components/social-media/SocialMediaToastStack'
import { DESIGN_JOBS_EVENT, pendingDesignJobs, settleDesignJob, doneMessage } from '@/lib/socialMedia/designJobs'

/**
 * The "your design is done" notification, on ANY page of the app: a design job runs on the server, so the person can leave the page that
 * started it. While this browser has a job it started and has not announced yet, the project's jobs are polled (and only then); when the
 * server reports it finished, a toast says so (and a browser notification too, when the person allowed them), with a link to open it.
 */
export function DesignJobsWatcher() {
  const { activeProjectId } = useProject()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(() => pendingDesignJobs(activeProjectId))
  const { toasts, notify, dismiss } = useToastQueue()
  const announced = useRef(new Set())

  useEffect(() => {
    const refresh = () => setPending(pendingDesignJobs(activeProjectId))
    refresh()
    window.addEventListener(DESIGN_JOBS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener(DESIGN_JOBS_EVENT, refresh); window.removeEventListener('storage', refresh) }
  }, [activeProjectId])

  const { data: jobs } = useDesignJobs(activeProjectId, { watching: pending.length > 0 })

  useEffect(() => {
    if (!jobs || !pending.length) return
    for (const p of pending) {
      const mine = jobs.filter((j) => j.publicationId === p.publicationId)
      if (!mine.length || mine.some((j) => j.active)) continue
      const finished = mine.find((j) => j.finishedAt && Date.parse(j.finishedAt) >= p.startedAt - 1000)
      if (!finished || announced.current.has(finished.id + finished.finishedAt)) continue
      announced.current.add(finished.id + finished.finishedAt)
      settleDesignJob(p.projectId, p.publicationId)
      const msg = doneMessage(finished, p.label)
      const href = `/app/social-media/creative-studio?publicationId=${encodeURIComponent(p.publicationId)}`
      notify(<span>{msg.text} <a href={href} className="font-semibold text-violet-700 underline">Open</a></span>, msg.tone)
      queryClient.invalidateQueries({ queryKey: ['social'] })
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') new Notification('Odito', { body: msg.text })
      } catch { /* notifications are optional */ }
    }
  }, [jobs, pending, notify, queryClient])

  return <SocialMediaToastStack toasts={toasts} onDismiss={dismiss} />
}

export default DesignJobsWatcher
