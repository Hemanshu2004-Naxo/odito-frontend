"use client"

import { useCallback, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import businessInfoService from "@/services/businessInfoService"
import { queryKeys } from "@/lib/query/keys"

/**
 * Business Information for a project: one read, one save. `save` resolves to { ok: true } or { ok: false, code, field, message } and never
 * throws. A successful save refreshes the Local Competitors options too, so the tab sees the new location without a reload.
 */
export function useBusinessInfo(projectId) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const query = useQuery({
    queryKey: queryKeys.businessInfo.detail(projectId),
    queryFn: ({ signal }) => businessInfoService.get(projectId, { signal }),
    enabled: !!projectId,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const save = useCallback(async (body) => {
    setSaving(true)
    try {
      const res = await businessInfoService.save(projectId, body)
      queryClient.setQueryData(queryKeys.businessInfo.detail(projectId), res)
      queryClient.invalidateQueries({ queryKey: ["local-competitors", projectId] })
      // Saving a location also moves where keywords are tracked from (server-side): the Keywords page must not keep showing the old one.
      queryClient.invalidateQueries({ queryKey: queryKeys.keywords.list(projectId) })
      return { ok: true }
    } catch (err) {
      return { ok: false, code: err?.code ?? null, field: err?.field ?? null, message: err && typeof err.status === "number" && err.message ? err.message : "Could not save. Check your connection and try again." }
    } finally {
      setSaving(false)
    }
  }, [projectId, queryClient])

  return { data: query.data?.data ?? null, isLoading: query.isLoading, isError: query.isError, error: query.error, refetch: query.refetch, save, saving }
}
