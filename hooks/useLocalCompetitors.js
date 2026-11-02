"use client"

import { useCallback, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import localCompetitorsService from "@/services/localCompetitorsService"
import { queryKeys } from "@/lib/query/keys"

/**
 * Local Competitors for a project: the options (radii, the search centre, suggested categories - no Google request) and ONE explicit search.
 *
 * The last search is kept in this tab's memory only, so switching tabs does not cost a second billed search; it is never persisted
 * (see lib/queryPersistence.js: Google's terms do not allow keeping Places content) and it is dropped a few minutes after the page is left.
 * Opening the tab never searches. `search` resolves to { ok: true } or { ok: false, code, message, address? } and never throws.
 */
export function useLocalCompetitors(projectId) {
  const queryClient = useQueryClient()
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  const options = useQuery({
    queryKey: queryKeys.localCompetitors.options(projectId),
    queryFn: ({ signal }) => localCompetitorsService.options(projectId, { signal }),
    enabled: !!projectId,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Read-only view of the last search result; nothing ever fetches through it.
  const resultQuery = useQuery({
    queryKey: queryKeys.localCompetitors.result(projectId),
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })

  const search = useCallback(async (body) => {
    setSearching(true)
    setError(null)
    try {
      const res = await localCompetitorsService.search(projectId, body)
      queryClient.setQueryData(queryKeys.localCompetitors.result(projectId), res.data)
      return { ok: true }
    } catch (err) {
      const e = { code: err?.code ?? null, message: err && typeof err.status === "number" && err.message ? err.message : "The search could not be completed. Check your connection and try again.", address: err?.address ?? null, status: err?.status ?? null }
      setError(e)
      return { ok: false, ...e }
    } finally {
      setSearching(false)
    }
  }, [projectId, queryClient])

  /** After a business is added to My competitors, mark it in the list in memory (no request). */
  const markAdded = useCallback((placeId, competitorId) => {
    queryClient.setQueryData(queryKeys.localCompetitors.result(projectId), (old) => (old ? { ...old, results: old.results.map((r) => (r.placeId === placeId ? { ...r, addedCompetitorId: competitorId } : r)) } : old))
  }, [projectId, queryClient])

  return {
    options: options.data?.data ?? null,
    optionsStatus: options.isError ? "error" : options.isSuccess ? "success" : "loading",
    optionsError: options.isError ? { code: options.error?.code ?? null, message: options.error?.message ?? null } : null,
    refetchOptions: () => options.refetch(),
    result: resultQuery.data ?? null,
    searching,
    error,
    clearError: () => setError(null),
    search,
    markAdded,
  }
}
