"use client"

import { useCallback, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import apiService from "@/lib/apiService"

/**
 * Data layer for the AuditIQ tab of the issue detail page.
 *
 *   GET  /auditiq/service-requests?projectId&issueKey
 *        -> { requests: { express_fix, technical_audit_fix, expert_fix } (newest of each, or null),
 *             services: { maintenance: {available,reason}, strategyCall: {available,reason,url} } }
 *   POST /auditiq/service-requests
 *        -> 201 the stored request | 409 DUPLICATE_OPEN_REQUEST (with the existing one) | 400 validation | 429
 *
 * Everything shown to the user (status, availability, the booking URL) comes from these
 * responses — nothing is assumed locally.
 */

export const AUDITIQ_REQUEST_TYPES = ["express_fix", "technical_audit_fix", "expert_fix"]

export const auditIqQueryKey = (projectId, issueKey) => ["auditiq", "service-requests", projectId, issueKey]

export function useAuditIqServiceState(projectId, issueKey, enabled = true) {
  return useQuery({
    queryKey: auditIqQueryKey(projectId, issueKey),
    enabled: !!projectId && !!issueKey && enabled,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const qs = new URLSearchParams({ projectId, issueKey })
      const res = await apiService.request(`/auditiq/service-requests?${qs.toString()}`)
      if (!res?.success || !res.data) throw new Error(res?.message || "Could not load request status.")
      return res.data
    },
  })
}

// Server messages (4xx/5xx bodies) are curated and safe to show. A request that never got an HTTP
// response (offline, DNS, CORS) has no `status` — say that plainly instead of "Failed to fetch".
export function describeAuditIqError(err) {
  if (err && typeof err.status === "number" && err.message) return err.message
  return "Couldn't reach Odito. Check your connection and try again."
}

/**
 * submit(requestType, { message, ...context }) -> Promise<
 *   { ok: true, request }                        stored (201)
 *   { ok: false, duplicate: true, request, message }   an open one already exists (409)
 *   { ok: false, message }                              validation / server / network failure
 * >
 * Never rejects. A second call for the same type while one is in flight resolves to
 * { ok: false, inFlight: true } without sending anything; `pendingType` lets the UI disable controls.
 */
export function useSubmitAuditIqRequest({ projectId, issueKey, issueTitle, issueCategory, affectedPageCount, pageUrl }) {
  const queryClient = useQueryClient()
  const inFlight = useRef(new Set())
  const [pendingType, setPendingType] = useState(null)

  const writeRequest = useCallback((requestType, request) => {
    const key = auditIqQueryKey(projectId, issueKey)
    // Without prior data there is no `services` block to merge into — a refetch supplies the whole shape.
    queryClient.setQueryData(key, (old) => (old ? { ...old, requests: { ...old.requests, [requestType]: request } } : old))
    queryClient.invalidateQueries({ queryKey: key })
  }, [queryClient, projectId, issueKey])

  const submit = useCallback(async (requestType, { message } = {}) => {
    if (!projectId || !issueKey) return { ok: false, message: "Open a project and an issue first." }
    // A ref (not state): several clicks in the same tick must still send one request.
    if (inFlight.current.has(requestType)) return { ok: false, inFlight: true }
    inFlight.current.add(requestType)
    setPendingType(requestType)
    try {
      const res = await apiService.request("/auditiq/service-requests", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          requestType,
          issueKey,
          issueTitle: issueTitle || undefined,
          issueCategory: issueCategory || undefined,
          affectedPageCount: Number.isInteger(affectedPageCount) ? affectedPageCount : undefined,
          pageUrl: pageUrl || undefined,
          message: message || undefined,
        }),
      })
      if (!res?.success || !res.data) return { ok: false, message: res?.message || "Could not submit your request." }
      writeRequest(requestType, res.data)
      return { ok: true, request: res.data }
    } catch (err) {
      if (err?.status === 409 && err.code === "DUPLICATE_OPEN_REQUEST") {
        if (err.data) writeRequest(requestType, err.data)
        return { ok: false, duplicate: true, request: err.data || null, message: err.message }
      }
      return { ok: false, message: describeAuditIqError(err) }
    } finally {
      inFlight.current.delete(requestType)
      setPendingType((current) => (current === requestType ? null : current))
    }
  }, [projectId, issueKey, issueTitle, issueCategory, affectedPageCount, pageUrl, writeRequest])

  return { submit, pendingType }
}
