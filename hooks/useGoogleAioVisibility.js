"use client"

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import googleAioVisibilityService from '@/services/googleAioVisibilityService'
import socketService, { ConnectionState } from '@/lib/socketService'
import { queryKeys } from '@/lib/query/keys'
import { staleTimes } from '@/lib/query/stale-times'

const ACTIVE = ['queued', 'running']
const keys = queryKeys.googleAioVisibility

export function useGoogleAioSummary(projectId) {
  return useQuery({
    queryKey: keys.summary(projectId),
    queryFn: () => googleAioVisibilityService.getSummary(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.DYNAMIC,
    // Fallback for a missed socket event: poll only while a run is in progress.
    refetchInterval: (query) => (ACTIVE.includes(query.state.data?.data?.active?.status) ? 5000 : false),
  })
}

/** The five questions the next run would ask, and where. Never makes a paid request. */
export function useQuestionSelection(projectId, device = 'desktop') {
  return useQuery({
    queryKey: keys.selection(projectId, device),
    queryFn: () => googleAioVisibilityService.getQuestionSelection(projectId, { device }),
    enabled: !!projectId,
    staleTime: staleTimes.DYNAMIC,
  })
}

export function useGoogleAioRuns(projectId, params) {
  return useQuery({
    queryKey: keys.runs(projectId, params),
    queryFn: () => googleAioVisibilityService.listRuns(projectId, params),
    enabled: !!projectId,
    staleTime: staleTimes.DYNAMIC,
    placeholderData: (prev) => prev,
  })
}

export function useGoogleAioRun(projectId, runId) {
  return useQuery({
    queryKey: keys.run(projectId, runId),
    queryFn: () => googleAioVisibilityService.getRun(projectId, runId),
    enabled: !!projectId && !!runId,
    staleTime: staleTimes.DYNAMIC,
  })
}

/** The (at most five) stored observations of one run. */
export function useRunEvidence(projectId, runId, { enabled = true } = {}) {
  return useQuery({
    queryKey: keys.evidenceRun(projectId, runId),
    queryFn: () => googleAioVisibilityService.listEvidence(projectId, runId),
    enabled: !!projectId && !!runId && enabled,
    staleTime: staleTimes.DYNAMIC,
  })
}

export function useEvidenceItem(projectId, runId, questionId, { enabled = true } = {}) {
  return useQuery({
    queryKey: keys.evidenceItem(projectId, runId, questionId),
    queryFn: () => googleAioVisibilityService.getEvidence(projectId, runId, questionId),
    enabled: !!projectId && !!runId && !!questionId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

export function useQuestionHistory(projectId, questionId, { enabled = true } = {}) {
  return useQuery({
    queryKey: keys.questionHistory(projectId, questionId),
    queryFn: () => googleAioVisibilityService.getQuestionHistory(projectId, questionId),
    enabled: !!projectId && !!questionId && enabled,
    staleTime: staleTimes.DYNAMIC,
  })
}

export function useGoogleAioTrend(projectId, range) {
  return useQuery({
    queryKey: keys.trend(projectId, range),
    queryFn: () => googleAioVisibilityService.getTrend(projectId, range),
    enabled: !!projectId && !!range,
    staleTime: staleTimes.DYNAMIC,
    placeholderData: (prev) => prev,
  })
}

function invalidateRunState(qc, projectId) {
  qc.invalidateQueries({ queryKey: keys.summary(projectId) })
  qc.invalidateQueries({ queryKey: [...keys.all(projectId), 'runs'] })
}

/** Start a run. A ref guards against a double click starting two requests before React re-renders the button as disabled. */
export function useStartGoogleAioRun(projectId) {
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const mutation = useMutation({
    mutationFn: (args) => googleAioVisibilityService.startRun(projectId, args || {}),
    onSuccess: () => invalidateRunState(qc, projectId),
    onSettled: () => { inFlight.current = false },
  })
  const { mutate, mutateAsync, ...rest } = mutation
  return {
    ...rest,
    mutate: (args, options) => {
      if (inFlight.current) return
      inFlight.current = true
      mutate(args, options)
    },
    mutateAsync: (args, options) => {
      if (inFlight.current) return Promise.resolve(undefined)
      inFlight.current = true
      return mutateAsync(args, options)
    },
  }
}

export function useCancelGoogleAioRun(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId) => googleAioVisibilityService.cancelRun(projectId, runId),
    onSuccess: () => invalidateRunState(qc, projectId),
  })
}

const PROGRESS_EVENTS = [
  'google_aio_visibility:started', 'google_aio_visibility:progress',
  'google_aio_visibility:question_started', 'google_aio_visibility:question_completed', 'google_aio_visibility:question_failed',
]
const TERMINAL_EVENTS = ['google_aio_visibility:completed', 'google_aio_visibility:failed', 'google_aio_visibility:partial', 'google_aio_visibility:cancelled']
const EVIDENCE_REFRESH_MS = 3000

/**
 * Live progress from the google_aio_visibility:* socket events. The payload carries only ids, counters and codes and is NEVER trusted
 * for results: a terminal event refetches the run, summary and evidence from the authenticated API, progress events refresh the stored
 * evidence at most every few seconds, and a socket reconnect refetches everything, so a reload or a missed event cannot leave the page wrong.
 * `live.current` is the 1-based position of the question being worked on (for "Question 2 of 5").
 */
export function useGoogleAioLiveProgress(projectId) {
  const qc = useQueryClient()
  const [live, setLive] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!projectId) return undefined
    setLive(null) // a different project never inherits the previous project's live state

    const refreshRun = (runId) => {
      qc.invalidateQueries({ queryKey: keys.summary(projectId) })
      qc.invalidateQueries({ queryKey: [...keys.all(projectId), 'runs'] })
      qc.invalidateQueries({ queryKey: [...keys.all(projectId), 'trend'] })
      if (runId) {
        qc.invalidateQueries({ queryKey: keys.run(projectId, runId) })
        qc.invalidateQueries({ queryKey: keys.evidenceRun(projectId, runId) })
      }
    }

    const toLive = (p, prev) => ({
      runId: p.runId, status: p.status, completed: p.completedQuestions, total: p.totalQuestions,
      current: p.questionIndex ?? (prev?.runId === p.runId ? prev.current : null),
      succeeded: p.succeeded ?? null, failed: p.failed ?? null, skipped: p.skipped ?? null, pending: p.pending ?? null,
    })

    const onProgress = (payload) => {
      if (!payload || payload.projectId !== projectId) return
      setLive((prev) => {
        const next = toLive(payload, prev)
        return prev && Object.keys(next).every((k) => prev[k] === next[k]) ? prev : next
      })
      if (payload.questionStatus && !timer.current) {
        timer.current = setTimeout(() => {
          timer.current = null
          qc.invalidateQueries({ queryKey: keys.evidenceRun(projectId, payload.runId) })
        }, EVIDENCE_REFRESH_MS)
      }
    }
    const onTerminal = (payload) => {
      if (!payload || payload.projectId !== projectId) return
      setLive(null)
      refreshRun(payload.runId)
    }

    const handlers = [...PROGRESS_EVENTS.map((e) => [e, onProgress]), ...TERMINAL_EVENTS.map((e) => [e, onTerminal])]
    for (const [e, h] of handlers) socketService.addEventListener(e, h)
    socketService.joinProject(projectId)

    const offState = socketService.onConnectionStateChange((next, prev) => {
      if (next === ConnectionState.CONNECTED && prev === ConnectionState.RECONNECTING) {
        setLive(null)
        refreshRun(null)
      }
    })

    return () => {
      for (const [e, h] of handlers) socketService.removeEventListener(e, h)
      offState?.()
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
    }
  }, [projectId, qc])

  return live
}
