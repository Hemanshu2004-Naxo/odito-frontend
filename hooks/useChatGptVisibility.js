"use client"

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import chatgptVisibilityService from '@/services/chatgptVisibilityService'
import socketService, { ConnectionState } from '@/lib/socketService'
import { queryKeys } from '@/lib/query/keys'
import { staleTimes } from '@/lib/query/stale-times'

const ACTIVE = ['queued', 'running']

export function useChatGptSummary(projectId) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.summary(projectId),
    queryFn: () => chatgptVisibilityService.getSummary(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.DYNAMIC,
    // Fallback for a missed socket event: poll only while a run is in progress.
    refetchInterval: (query) => (ACTIVE.includes(query.state.data?.data?.active?.status) ? 5000 : false),
  })
}

export function useChatGptRuns(projectId, params) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.runs(projectId, params),
    queryFn: () => chatgptVisibilityService.listRuns(projectId, params),
    enabled: !!projectId,
    staleTime: staleTimes.DYNAMIC,
  })
}

export function useChatGptRun(projectId, runId) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.run(projectId, runId),
    queryFn: () => chatgptVisibilityService.getRun(projectId, runId),
    enabled: !!projectId && !!runId,
    staleTime: staleTimes.DYNAMIC,
  })
}

export function useChatGptPromptSets(projectId) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.promptSets(projectId),
    queryFn: () => chatgptVisibilityService.listPromptSets(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

/** The page of stored answers for one approved-question run. Loaded only when asked for (never on the dashboard render). */
export function useRunEvidence(projectId, runId, params, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.evidence(projectId, runId, params),
    queryFn: () => chatgptVisibilityService.listEvidence(projectId, runId, params),
    enabled: !!projectId && !!runId && enabled,
    staleTime: staleTimes.DYNAMIC,
    placeholderData: (prev) => prev, // keep the previous page on screen while the next one loads (no flicker)
  })
}

/** One question's full stored answer + citations. `enabled` lets the detail sheet load it lazily. */
export function useEvidenceItem(projectId, runId, questionId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.evidenceItem(projectId, runId, questionId),
    queryFn: () => chatgptVisibilityService.getEvidence(projectId, runId, questionId),
    enabled: !!projectId && !!runId && !!questionId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** The same question across runs (and question-set versions). */
export function useQuestionHistory(projectId, questionId, { enabled = true, limit = 20 } = {}) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.questionHistory(projectId, questionId),
    queryFn: () => chatgptVisibilityService.getQuestionHistory(projectId, questionId, { limit }),
    enabled: !!projectId && !!questionId && enabled,
    staleTime: staleTimes.DYNAMIC,
  })
}

/** Visibility over time (one point per finished approved-question run). */
export function useVisibilityTrend(projectId, range) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.trend(projectId, range),
    queryFn: () => chatgptVisibilityService.getTrend(projectId, range),
    enabled: !!projectId && !!range,
    staleTime: staleTimes.DYNAMIC,
    placeholderData: (prev) => prev,
  })
}

/** The website's most-cited pages for one run. */
export function useCitedPages(projectId, runId) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.citedPages(projectId, { runId }),
    queryFn: () => chatgptVisibilityService.getCitedPages(projectId, { runId }),
    enabled: !!projectId && !!runId,
    staleTime: staleTimes.STANDARD,
  })
}

/** Side-by-side comparison of two runs; only fetched once both are chosen. */
export function useCompareRuns(projectId, runA, runB) {
  return useQuery({
    queryKey: queryKeys.chatgptVisibility.compare(projectId, runA, runB),
    queryFn: () => chatgptVisibilityService.compareRuns(projectId, runA, runB),
    enabled: !!projectId && !!runA && !!runB && runA !== runB,
    staleTime: staleTimes.STANDARD,
  })
}

/** Refresh what a run start / cancel changes. Deliberately NOT the whole feature: stored answers and question sets are untouched. */
function invalidateRunState(qc, projectId) {
  qc.invalidateQueries({ queryKey: queryKeys.chatgptVisibility.summary(projectId) })
  qc.invalidateQueries({ queryKey: [...queryKeys.chatgptVisibility.all(projectId), 'runs'] })
}

/**
 * Start a run. `mutate()` = the five-prompt check; `mutate({ questionSetId })` = the approved question set. A ref guards against a
 * double click starting two requests before React has re-rendered the button as disabled.
 */
export function useStartChatGptRun(projectId) {
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const mutation = useMutation({
    mutationFn: (args) => chatgptVisibilityService.startRun(projectId, args || {}),
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

export function useCancelChatGptRun(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId) => chatgptVisibilityService.cancelRun(projectId, runId),
    onSuccess: () => invalidateRunState(qc, projectId),
  })
}

const PROGRESS_EVENTS = [
  'chatgpt_visibility:started', 'chatgpt_visibility:progress',
  'chatgpt_visibility:question_started', 'chatgpt_visibility:question_completed', 'chatgpt_visibility:question_failed',
]
const TERMINAL_EVENTS = ['chatgpt_visibility:completed', 'chatgpt_visibility:failed', 'chatgpt_visibility:partial', 'chatgpt_visibility:cancelled']
const EVIDENCE_REFRESH_MS = 4000

/**
 * Live progress from the chatgpt_visibility:* socket events. Only fields the backend actually emits are read (projectId, runId, status,
 * completedPrompts, totalPrompts, executionMode, questionSetVersion, succeeded/failed/skipped/pending). The payload is NEVER trusted for
 * results: a terminal event refetches the run and summary from the authenticated API, progress events refresh the stored-answer list at
 * most every few seconds, and a socket reconnect refetches everything, so a reload or a missed event cannot leave the page wrong.
 */
export function useChatGptLiveProgress(projectId) {
  const qc = useQueryClient()
  const [live, setLive] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!projectId) return undefined
    setLive(null) // a different project never inherits the previous project's live state

    const refreshRun = (runId) => {
      qc.invalidateQueries({ queryKey: queryKeys.chatgptVisibility.summary(projectId) })
      qc.invalidateQueries({ queryKey: [...queryKeys.chatgptVisibility.all(projectId), 'runs'] })
      // A finished run adds a trend point and may change the most-cited pages.
      qc.invalidateQueries({ queryKey: [...queryKeys.chatgptVisibility.all(projectId), 'trend'] })
      qc.invalidateQueries({ queryKey: [...queryKeys.chatgptVisibility.all(projectId), 'cited-pages'] })
      if (runId) {
        qc.invalidateQueries({ queryKey: queryKeys.chatgptVisibility.run(projectId, runId) })
        qc.invalidateQueries({ queryKey: queryKeys.chatgptVisibility.evidenceRun(projectId, runId) })
      }
    }

    const toLive = (p) => ({
      runId: p.runId, status: p.status, completed: p.completedPrompts, total: p.totalPrompts,
      executionMode: p.executionMode || 'legacy_prompts', questionSetVersion: p.questionSetVersion ?? null,
      succeeded: p.succeeded ?? null, failed: p.failed ?? null, skipped: p.skipped ?? null, pending: p.pending ?? null,
    })

    const onProgress = (payload) => {
      if (!payload || payload.projectId !== projectId) return
      // Bail out when nothing visible changed, so a burst of events does not re-render the page for no reason.
      setLive((prev) => {
        const next = toLive(payload)
        return prev && Object.keys(next).every((k) => prev[k] === next[k]) ? prev : next
      })
      if (payload.questionStatus && !timer.current) {
        timer.current = setTimeout(() => {
          timer.current = null
          qc.invalidateQueries({ queryKey: queryKeys.chatgptVisibility.evidenceRun(projectId, payload.runId) })
        }, EVIDENCE_REFRESH_MS)
      }
    }
    const onTerminal = (payload) => {
      if (!payload || payload.projectId !== projectId) return
      setLive(null)
      refreshRun(payload.runId)
    }

    const progressHandlers = PROGRESS_EVENTS.map((e) => [e, onProgress])
    const terminalHandlers = TERMINAL_EVENTS.map((e) => [e, onTerminal])
    for (const [e, h] of [...progressHandlers, ...terminalHandlers]) socketService.addEventListener(e, h)
    socketService.joinProject(projectId)

    // After a reconnect the room is re-joined by the socket service, but events sent while disconnected are gone: re-read the truth.
    const offState = socketService.onConnectionStateChange((next, prev) => {
      if (next === ConnectionState.CONNECTED && prev === ConnectionState.RECONNECTING) {
        setLive(null)
        refreshRun(null)
      }
    })

    return () => {
      for (const [e, h] of [...progressHandlers, ...terminalHandlers]) socketService.removeEventListener(e, h)
      offState?.()
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
    }
  }, [projectId, qc])

  return live
}
