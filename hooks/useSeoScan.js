"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import seoScanService from "@/services/seoScanService"
import socketService, { ConnectionState } from "@/lib/socketService"
import { queryKeys } from "@/lib/query/keys"
import { HISTORY_ROOTS } from "@/hooks/useDatasetHistory"

/**
 * The project's SEO scans: the latest one and the action that starts one.
 *
 * The scan state lives in the DATABASE (a worker runs the scan apart from the request), so this hook never trusts a socket event as the
 * truth: an event only says "look again", and the answer always comes from GET /seo-scans. Updates arrive over Socket.IO
 * (seo_scan:* on the project room); while the socket is down, or as a slow safety net while it is up, the list is polled. A reconnect
 * refetches immediately, so a missed event or a reloaded page cannot leave the progress wrong.
 *
 * When a scan finishes, only this project's STORED-DATA queries (the pages, the history panels, the freshness lines) are invalidated.
 * Nothing here can reach the provider except starting a scan, which is an explicit user action.
 */

export const ACTIVE = ["pending", "queued", "running"]
export const isActive = (scan) => Boolean(scan) && ACTIVE.includes(scan.status)
export const POLL_MS = 3000
export const POLL_WHILE_SOCKET_UP_MS = 15000
const SOCKET_DEBOUNCE_MS = 400
export const SCAN_EVENTS = [
  "seo_scan:started", "seo_scan:progress", "seo_scan:dataset_completed", "seo_scan:dataset_failed",
  "seo_scan:completed", "seo_scan:partial", "seo_scan:failed",
]
const TERMINAL_EVENTS = new Set(["seo_scan:completed", "seo_scan:partial", "seo_scan:failed"])

/** How long to wait before reading the scan list again: never while idle; slowly (a safety net) while the socket is up; quickly while it is down. */
export const pollInterval = (scan, socketUp) => (isActive(scan) ? (socketUp ? POLL_WHILE_SOCKET_UP_MS : POLL_MS) : false)

/** Scans newest first -> { latest, lastSuccessful } (a partially completed scan still collected data). */
export function summarizeScans(scans = []) {
  const latest = scans[0] ?? null
  const lastSuccessful = scans.find((s) => s.status === "completed" || s.status === "partially_completed") ?? null
  return { latest, lastSuccessful }
}

/** Listens to the project's scan events while mounted; `onSignal(terminal)` is called for each (debounced for progress bursts). Returns whether the socket is connected. */
function useScanSocket(projectId, onSignal) {
  const [connected, setConnected] = useState(() => socketService.state === ConnectionState.CONNECTED)
  const timer = useRef(null)
  const signal = useRef(onSignal)
  signal.current = onSignal

  useEffect(() => {
    if (!projectId) return undefined
    setConnected(socketService.state === ConnectionState.CONNECTED)

    const flush = (terminal) => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
      signal.current(terminal)
    }
    const handlerFor = (event) => (payload) => {
      // Another project's event (the socket is shared by the whole app) is ignored.
      if (!payload || payload.projectId !== projectId) return
      if (TERMINAL_EVENTS.has(event)) { flush(true); return }
      if (!timer.current) timer.current = setTimeout(() => flush(false), SOCKET_DEBOUNCE_MS)
    }
    const handlers = SCAN_EVENTS.map((e) => [e, handlerFor(e)])
    for (const [e, h] of handlers) socketService.addEventListener(e, h)
    socketService.joinProject(projectId)

    const offState = socketService.onConnectionStateChange((next, prev) => {
      setConnected(next === ConnectionState.CONNECTED)
      // Events may have been missed while the connection was down: read the stored state again.
      if (next === ConnectionState.CONNECTED && prev !== ConnectionState.CONNECTED) flush(false)
    })

    return () => {
      for (const [e, h] of handlers) socketService.removeEventListener(e, h)
      offState?.()
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
    }
  }, [projectId])

  return connected
}

export function useSeoScan(projectId) {
  const qc = useQueryClient()
  const key = ["seo-scan", projectId]
  const wasActive = useRef(false)
  const [socketUp, setSocketUp] = useState(false)

  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => seoScanService.list(projectId, { signal }),
    enabled: !!projectId,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => pollInterval(query.state.data?.data?.scans?.[0], socketUp),
  })
  const { latest, lastSuccessful } = summarizeScans(q.data?.data?.scans)

  const connected = useScanSocket(projectId, () => { qc.invalidateQueries({ queryKey: key }) })
  useEffect(() => { setSocketUp(connected) }, [connected])

  useEffect(() => {
    const active = isActive(latest)
    if (wasActive.current && !active && latest) {
      qc.invalidateQueries({ queryKey: queryKeys.domainOverview.all(projectId) })
      for (const root of HISTORY_ROOTS) qc.invalidateQueries({ queryKey: [root, projectId] })
    }
    wasActive.current = active
  }, [latest, projectId, qc])

  const mutation = useMutation({
    mutationFn: (input) => seoScanService.start(projectId, input),
    // The new (or already running, `deduped`) scan is the newest: re-read the list, which then keeps updating.
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const start = useCallback((input) => mutation.mutate(input), [mutation])
  return {
    status: q.isLoading ? "loading" : q.isError ? "error" : "ready",
    latest,
    lastSuccessful,
    running: isActive(latest),
    starting: mutation.isPending,
    startError: mutation.isError ? { message: mutation.error?.message || "The scan could not be started.", code: mutation.error?.code ?? null } : null,
    socketConnected: connected,
    start,
  }
}
