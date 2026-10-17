"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/apiService'
import socketService from '@/lib/socketService'
import { queryKeys, issueContextPageFilter } from '@/lib/query/keys'

/**
 * Per-page URL Verification trigger (F4-001).
 *
 * Mirrors useAuditTrigger's start -> subscribe -> cleanup skeleton, but
 * scoped to ONE page rather than the whole project:
 *   - no project-wide invalidateProject/refetchProject — only this page's
 *     own issues query is invalidated on completion.
 *   - no polling fallback — verification:* websocket events are the sole
 *     source of truth here (explicitly required: do not poll).
 *
 * The modal only opens AFTER the start request succeeds — a rejected start
 * (already running, forbidden, invalid URL, etc.) surfaces as `startError`
 * instead, without ever opening the progress UI.
 */
export function useUrlVerification(projectId, pageUrl) {
  const queryClient = useQueryClient()

  const [isVerifying, setIsVerifying] = useState(false)
  const [startError, setStartError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  // { status: 'starting'|'processing'|'completed'|'failed', stage, percentage, errorMessage }
  const [progress, setProgress] = useState(null)

  const projectIdRef = useRef(projectId)
  const pageUrlRef = useRef(pageUrl)
  const runIdRef = useRef(null)
  useEffect(() => { projectIdRef.current = projectId }, [projectId])
  useEffect(() => { pageUrlRef.current = pageUrl }, [pageUrl])

  // The project room also carries Full Audit's own audit:* events and any
  // OTHER page's verification:* traffic on the same project — every handler
  // below ignores anything that isn't this exact run (matched by runId once
  // known; by pageUrl for the very first event, before runId is known yet).
  const isForThisRun = useCallback((payload) => {
    if (!payload) return false
    if (runIdRef.current) return payload.runId === runIdRef.current
    return payload.pageUrl === pageUrlRef.current
  }, [])

  const handleStarted = useCallback((payload) => {
    if (!isForThisRun(payload)) return
    runIdRef.current = payload.runId
    setProgress({ status: 'processing', stage: payload.currentStage || 'Queued', percentage: payload.progress ?? 0, errorMessage: null })
  }, [isForThisRun])

  const handleProgress = useCallback((payload) => {
    if (!isForThisRun(payload)) return
    setProgress({ status: 'processing', stage: payload.currentStage, percentage: payload.progress ?? 0, errorMessage: null })
  }, [isForThisRun])

  const detach = useCallback(() => {
    socketService.offVerificationStarted(handleStarted)
    socketService.offVerificationProgress(handleProgress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCompleted = useCallback((payload) => {
    if (!isForThisRun(payload)) return
    setProgress({ status: 'completed', stage: 'Completed', percentage: 100, errorMessage: null })
    detach()
    socketService.offVerificationCompleted(handleCompleted)
    socketService.offVerificationFailed(handleFailed)
    runIdRef.current = null
    setIsVerifying(false)

    const pid = projectIdRef.current
    const url = pageUrlRef.current
    if (pid && url) {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.page(pid, url) })
      // This page's "Current State" (issue context) is derived from the crawl this run just replaced. Only this page's entries.
      queryClient.invalidateQueries(issueContextPageFilter(pid, url))
      // F4-002's result panel reads this key once progress.status is
      // 'completed' — invalidate explicitly rather than relying solely on
      // the enabled-toggle to guarantee a fresh fetch even if a previous
      // run's result for this same page was already cached this session.
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.latest(pid, url) })
      // F4-003's history panel caches the project-wide list — invalidate so
      // a newly completed run shows up there too without a page refresh.
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.projectHistory(pid) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isForThisRun, detach, queryClient])

  const handleFailed = useCallback((payload) => {
    if (!isForThisRun(payload)) return
    setProgress({
      status: 'failed',
      stage: payload.currentStage || null,
      percentage: payload.progress ?? null,
      errorMessage: payload.errorMessage || 'Verification failed',
    })
    detach()
    socketService.offVerificationCompleted(handleCompleted)
    socketService.offVerificationFailed(handleFailed)
    runIdRef.current = null
    setIsVerifying(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isForThisRun, detach])

  const detachAll = useCallback(() => {
    detach()
    socketService.offVerificationCompleted(handleCompleted)
    socketService.offVerificationFailed(handleFailed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detach, handleCompleted, handleFailed])

  // Cleanup on unmount so no listener leaks past this component's lifetime.
  useEffect(() => {
    return () => {
      detachAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verifyUrl = useCallback(async () => {
    const pid = projectIdRef.current
    const url = pageUrlRef.current
    if (!pid || !url || isVerifying) return

    setIsVerifying(true)
    setStartError(null)

    try {
      const response = await apiService.verifyUrl(pid, url)
      if (!response.success) {
        throw new Error(response.message || 'Failed to start verification')
      }

      runIdRef.current = response.data?.runId || null

      socketService.onVerificationStarted(handleStarted)
      socketService.onVerificationProgress(handleProgress)
      socketService.onVerificationCompleted(handleCompleted)
      socketService.onVerificationFailed(handleFailed)
      socketService.joinProject(pid) // same room verification:* events are emitted to

      setProgress({ status: 'starting', stage: 'Queued', percentage: 0, errorMessage: null })
      setModalOpen(true)
    } catch (error) {
      setStartError(mapVerifyError(error))
      setIsVerifying(false)
    }
  }, [isVerifying, handleStarted, handleProgress, handleCompleted, handleFailed])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    // A run still in flight when the user dismisses the modal keeps running
    // server-side; we just stop listening/tracking it client-side.
    detachAll()
    runIdRef.current = null
    setIsVerifying(false)
  }, [detachAll])

  return { isVerifying, startError, modalOpen, progress, verifyUrl, closeModal }
}

function mapVerifyError(error) {
  switch (error?.status) {
    case 401:
      return 'Please sign in again to verify this page.'
    case 403:
      return 'You do not have permission to verify this page.'
    case 404:
      return 'Project not found.'
    case 409:
      return 'A verification for this page is already in progress.'
    case 400:
      return error.message || 'This page is not eligible for verification.'
    case 500:
    case 502:
    case 503:
      return 'Something went wrong on our end. Please try again shortly.'
    default:
      return error?.message || 'Something went wrong starting verification. Please try again.'
  }
}
