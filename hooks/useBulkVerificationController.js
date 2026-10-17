"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/apiService'
import socketService from '@/lib/socketService'
import { queryKeys, issueContextPageFilter } from '@/lib/query/keys'
import { BatchState, reduceBatchState, isValidBatchTransition } from '@/lib/verification/bulkBatchState'
import { BulkVerificationController, BULK_VERIFICATION_CONCURRENCY } from '@/lib/verification/BulkVerificationController'
import { BatchVerificationController } from '@/lib/verification/BatchVerificationController'
import { isBatchVerificationEnabled } from '@/lib/featureFlags'
import { storeBatchId, readBatchId, clearBatchId } from '@/lib/verification/batchRecoveryStorage'

/**
 * React glue for BulkVerificationController (Bulk URL Verification).
 *
 * The controller itself is framework-agnostic and owns all queue/websocket
 * logic; this hook only: (1) manages the pre-batch UI states (IDLE ->
 * PREPARING -> CONFIRMING) that exist before any controller instance does,
 * (2) instantiates a fresh controller per batch on start(), (3) batches the
 * controller's onUpdate callbacks into a single React state update per
 * microtask (so N synchronous queue-pump events don't cause N renders),
 * and (4) fires exactly one scoped query invalidation when a batch reaches
 * a terminal state.
 */
export function useBulkVerificationController({ projectId, concurrency = BULK_VERIFICATION_CONCURRENCY } = {}) {
  const queryClient = useQueryClient()
  const [state, setState] = useState(BatchState.IDLE)
  const [progress, setProgress] = useState(null)

  const controllerRef = useRef(null)
  const flushScheduledRef = useRef(false)
  const latestSnapshotRef = useRef(null)
  const invalidatedBatchIdRef = useRef(null)
  // Mirrors `state`, but readable synchronously — React state updates are
  // batched/async, so gating start() on stale `state` from closure would
  // let it fire even when the transition table just rejected it. This ref
  // is always the source of truth for "can we transition right now".
  const stateRef = useRef(BatchState.IDLE)

  const applyTransition = useCallback((next) => {
    const nextState = reduceBatchState(stateRef.current, next)
    stateRef.current = nextState
    setState(nextState)
    return nextState
  }, [])

  const flush = useCallback(() => {
    flushScheduledRef.current = false
    const snapshot = latestSnapshotRef.current
    if (!snapshot) return
    setProgress(snapshot)
    if (stateRef.current !== snapshot.state) {
      stateRef.current = snapshot.state
      setState(snapshot.state)
    }
  }, [])

  const handleControllerUpdate = useCallback((snapshot) => {
    latestSnapshotRef.current = snapshot
    if (!flushScheduledRef.current) {
      flushScheduledRef.current = true
      queueMicrotask(flush)
    }
  }, [flush])

  // F4-019: prepare() is the exact moment every mount/project-change already
  // calls (right after reset(), from the Optimization Center page's own
  // effect — unchanged, no page-level code was touched for this migration).
  // Piggybacking the resume check here, rather than a separate mount effect,
  // avoids a race against that same effect's reset()+prepare() sequence:
  // this way resume-detection always runs AFTER reset() has already put the
  // state back to IDLE, never before. Batch mode only — the legacy flow has
  // no server-side batch concept to resume against.
  const prepare = useCallback(() => {
    if (isBatchVerificationEnabled() && projectId) {
      const storedBatchId = readBatchId(projectId)
      if (storedBatchId) {
        // Bypasses the normal transition table on purpose — same precedent
        // reset() below already sets: a resumed batch goes straight to
        // RUNNING, skipping the pre-batch PREPARING/CONFIRMING UI states
        // entirely (there is nothing to confirm; the batch already exists).
        stateRef.current = BatchState.RUNNING
        setState(BatchState.RUNNING)

        const controller = new BatchVerificationController({ projectId, apiService, socketService, onUpdate: handleControllerUpdate })
        controllerRef.current = controller
        controller.resume(storedBatchId)
        return
      }
    }
    applyTransition(BatchState.PREPARING)
  }, [projectId, applyTransition, handleControllerUpdate])
  const confirm = useCallback(() => applyTransition(BatchState.CONFIRMING), [applyTransition])
  const cancelConfirm = useCallback(() => applyTransition(BatchState.PREPARING), [applyTransition])

  const start = useCallback((urls) => {
    if (!projectId || !urls?.length) return
    if (!isValidBatchTransition(stateRef.current, BatchState.STARTING)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[BulkVerification] start() called from invalid state: ${stateRef.current} (expected CONFIRMING)`)
      }
      return
    }
    applyTransition(BatchState.STARTING)

    // F4-019: the ONLY branch point for the whole migration — everything
    // downstream (progress model, snapshot shape, modal props) is identical
    // regardless of which controller class is instantiated here.
    const controller = isBatchVerificationEnabled()
      ? new BatchVerificationController({ projectId, urls, apiService, socketService, onUpdate: handleControllerUpdate })
      : new BulkVerificationController({ projectId, urls, concurrency, apiService, socketService, onUpdate: handleControllerUpdate })
    controllerRef.current = controller
    controller.start()
  }, [projectId, concurrency, applyTransition, handleControllerUpdate])

  const reset = useCallback(() => {
    controllerRef.current?.destroy()
    controllerRef.current = null
    latestSnapshotRef.current = null
    setProgress(null)
    // reset() is a hard return-to-idle from any terminal (or pre-batch)
    // state — bypasses the transition table on purpose rather than being
    // rejected when called from, say, PREPARING (closing the drawer before
    // ever starting a batch).
    stateRef.current = BatchState.IDLE
    setState(BatchState.IDLE)
    // F4-019: deliberately does NOT clear the persisted batchId (see the
    // dedicated effect below, which clears it only once the batch reaches
    // a terminal state). The Optimization Center page calls reset() then
    // prepare() on EVERY mount/project-change — if reset() cleared it here,
    // prepare()'s resume check immediately below would never find anything
    // to resume, breaking recovery after a browser reload. A batch that's
    // still genuinely running server-side should stay resumable even if
    // the user navigated away from it client-side.
  }, [])

  // Detach any live controller's websocket listeners on unmount — in-flight
  // server-side runs keep running; only client-side tracking stops.
  useEffect(() => {
    return () => {
      controllerRef.current?.destroy()
    }
  }, [])

  // Scoped invalidation, fired exactly once per batch when it reaches a
  // terminal state. Per completed URL: its own issues + latest-verification
  // queries. Once per project: verification history + this project's task
  // queries (Optimization Center reads these) — never a full app reload,
  // never another project's data.
  useEffect(() => {
    if (!progress) return
    if (progress.state !== BatchState.COMPLETED && progress.state !== BatchState.FAILED) return
    if (invalidatedBatchIdRef.current === progress.batchId) return
    invalidatedBatchIdRef.current = progress.batchId

    let anyCompleted = false
    for (const [url, urlState] of progress.urls) {
      if (urlState.status === 'completed') {
        anyCompleted = true
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.page(projectId, url) })
        queryClient.invalidateQueries({ queryKey: queryKeys.verification.latest(projectId, url) })
        // That page's "Current State" (issue context) comes from the crawl this batch just replaced.
        queryClient.invalidateQueries(issueContextPageFilter(projectId, url))
      }
    }
    if (anyCompleted) {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.projectHistory(projectId) })
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId) })
  }, [progress, projectId, queryClient])

  // F4-019 §5: persist the batch endpoint's batchId as soon as it's known,
  // and clear it once the batch reaches a terminal state. This — not the
  // controller instance, which does not survive a reload — is what lets
  // prepare() (above) resume tracking the same in-flight batch after a full
  // browser reload instead of silently losing all progress UI. No-op in
  // legacy mode (progress.batchId is the client-generated crypto.randomUUID()
  // from BulkVerificationController, which nothing downstream should ever
  // try to resume against).
  useEffect(() => {
    if (!isBatchVerificationEnabled() || !projectId || !progress?.batchId) return
    if (progress.state === BatchState.COMPLETED || progress.state === BatchState.FAILED) {
      clearBatchId(projectId)
    } else {
      storeBatchId(projectId, progress.batchId)
    }
  }, [progress, projectId])

  return { state, progress, prepare, confirm, cancelConfirm, start, reset }
}
