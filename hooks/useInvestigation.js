"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query/keys"
import { isActive } from "@/components/dashboard/issues/investigationView"

/**
 * One AI investigation for one (project, issue, page).
 *
 * - Starting is a mutation; the server returns the SAME investigation for repeated clicks / other tabs while one is running.
 * - Progress is polled while the investigation is queued/running, and stops when it finishes.
 * - Everything is scoped to `scope`. When the issue or page changes, the held investigation id is dropped, and a start
 *   response that arrives for an OLD scope is ignored — a slow response can never replace the current selection's result.
 * - Nothing here writes to the website.
 */
const POLL_MS = 1500

const unwrap = (response, fallback) => {
  if (!response?.success) throw Object.assign(new Error(response?.message || fallback), { code: response?.code })
  return response.data
}

export function useInvestigation({ projectId, issueId, pageUrl, ruleMetadata, issueSource }) {
  const queryClient = useQueryClient()
  const scope = `${projectId}|${issueId}|${pageUrl}`
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const [investigationId, setInvestigationId] = useState(null)
  const [startError, setStartError] = useState(null)
  // Synchronous in-flight guards. `isPending` from a mutation is read from the last RENDER, so two clicks inside one render would both
  // pass an `if (!isPending)` check; a ref flips immediately and cannot be raced.
  const inFlight = useRef({ start: false, prepare: false, verify: false, approve: false, confirm: false })
  const guarded = (key, fn) => {
    if (inFlight.current[key]) return
    inFlight.current[key] = true
    fn(() => { inFlight.current[key] = false })
  }

  // Selecting another issue or URL abandons the previous investigation's view (the server run, if any, continues harmlessly).
  useEffect(() => { setInvestigationId(null); setStartError(null) }, [scope])

  const startMutation = useMutation({
    retry: false,
    mutationFn: async (variables) => {
      const { default: apiService } = await import("@/lib/apiService")
      const data = unwrap(await apiService.startInvestigation({ projectId, issueId, pageUrl, ruleMetadata, issueSource }), "The investigation could not be started")
      return { data, scope: variables.scope }
    },
    onSuccess: ({ data, scope: startedScope }) => {
      if (startedScope !== scopeRef.current) return // stale response for a previous selection
      queryClient.setQueryData(queryKeys.investigation.detail(projectId, data.id), data)
      setInvestigationId(data.id)
    },
    onError: (error, variables) => {
      if (variables?.scope === scopeRef.current) setStartError(error)
    },
  })

  const query = useQuery({
    queryKey: queryKeys.investigation.detail(projectId, investigationId),
    enabled: !!projectId && !!investigationId,
    retry: 1,
    refetchOnWindowFocus: false,
    // Stop polling as soon as a request fails (lost connection, 404 after cleanup): the panel shows the error with a Retry instead of
    // hammering the server forever or leaving a spinner on screen.
    refetchInterval: (q) => (q.state.status !== 'error' && isActive(q.state.data?.status) ? POLL_MS : false),
    queryFn: async ({ signal }) => {
      const { default: apiService } = await import("@/lib/apiService")
      return unwrap(await apiService.getInvestigation(projectId, investigationId, { signal }), "The investigation could not be loaded")
    },
  })

  // Preparing a fix creates/finds the Task and links the recommendation; the task lists are refreshed so the existing apply panels appear.
  const prepareMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const { default: apiService } = await import("@/lib/apiService")
      return unwrap(await apiService.prepareInvestigationFix(projectId, investigationId), "The fix could not be prepared")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activeUrls(projectId, issueId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.summary(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.investigation.detail(projectId, investigationId) })
    },
  })

  const approveMutation = useMutation({
    retry: false,
    mutationFn: async (fingerprint) => {
      const { default: apiService } = await import("@/lib/apiService")
      return unwrap(await apiService.approveInvestigation(projectId, investigationId, fingerprint), "The approval could not be recorded")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.investigation.detail(projectId, investigationId) }),
  })

  const cancelMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const { default: apiService } = await import("@/lib/apiService")
      return unwrap(await apiService.cancelInvestigation(projectId, investigationId), "The investigation could not be cancelled")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.investigation.detail(projectId, investigationId) }),
  })

  const verifyMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const { default: apiService } = await import("@/lib/apiService")
      return unwrap(await apiService.verifyInvestigation(projectId, investigationId), "Verification could not be started")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.investigation.detail(projectId, investigationId) }),
  })

  // Confirming an address stores the user's assertion only (no approval, no website change); the investigation is then re-run so the
  // proposal is rebuilt on the server from the confirmed address.
  const confirmMutation = useMutation({
    retry: false,
    mutationFn: async ({ address, basisCandidateId }) => {
      const { default: apiService } = await import("@/lib/apiService")
      return unwrap(await apiService.confirmInvestigationAddress(projectId, investigationId, address, basisCandidateId), "The address could not be saved")
    },
    onSuccess: () => { setStartError(null); startMutation.mutate({ scope: scopeRef.current }) },
  })

  const investigation = investigationId ? query.data ?? null : null
  const starting = startMutation.isPending
  // A repeated click while a start request or a running investigation exists is a no-op.
  const start = () => {
    if (isActive(investigation?.status)) return
    guarded('start', (done) => {
      setStartError(null)
      startMutation.mutate({ scope: scopeRef.current }, { onSettled: done })
    })
  }

  return {
    investigation,
    isStarting: starting,
    isActive: starting || isActive(investigation?.status),
    loadError: investigationId ? query.error : null,
    retryLoad: () => query.refetch(),
    prepare: () => guarded('prepare', (done) => prepareMutation.mutate(undefined, { onSettled: done })),
    isPreparing: prepareMutation.isPending,
    prepared: prepareMutation.data || null,
    prepareError: prepareMutation.error,
    approve: (fingerprint) => guarded('approve', (done) => approveMutation.mutate(fingerprint, { onSettled: done })),
    isApproving: approveMutation.isPending,
    approveError: approveMutation.error,
    confirmAddress: (address, basisCandidateId) => guarded('confirm', (done) => confirmMutation.mutate({ address, basisCandidateId }, { onSettled: done })),
    isConfirmingAddress: confirmMutation.isPending,
    confirmAddressError: confirmMutation.error,
    startError,
    start,
    cancel: () => cancelMutation.mutate(),
    isCancelling: cancelMutation.isPending,
    verify: () => guarded('verify', (done) => verifyMutation.mutate(undefined, { onSettled: done })),
    isVerifying: verifyMutation.isPending,
    verifyError: verifyMutation.error,
  }
}

export default useInvestigation
