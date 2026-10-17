"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiService from "@/lib/apiService"
import { queryKeys } from "@/lib/query/keys"

/**
 * The typed WordPress schema fix (Organization): read-only preview + the three actions.
 *
 * - The preview is never cached across opens (staleTime 0, no focus refetch, no retry): the plan fingerprint the user
 *   approves must be as fresh as what they are looking at.
 * - No action retries automatically: a write is never repeated behind the user's back.
 * - After any action the preview is refetched and the task queries refreshed, so what is shown is what WordPress holds.
 */
export function useWordPressFixPreview(projectId, taskId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.wordpress.fixPreview(projectId, taskId),
    queryFn: async () => {
      const response = await apiService.getWordPressFixPreview(taskId)
      if (!response?.success) throw new Error(response?.message || "The fix preview could not be loaded")
      return response.data
    },
    enabled: !!projectId && !!taskId && enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

function useFixAction(projectId, taskId, fn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    retry: false,
    onSettled: () => {
      if (!projectId) return
      queryClient.invalidateQueries({ queryKey: queryKeys.wordpress.fixPreview(projectId, taskId) })
      // The sameAs workflow keeps its plan under its own keys (it is planned from a selection, before a task exists).
      queryClient.invalidateQueries({ queryKey: queryKeys.sameAs.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.summary(projectId) })
    },
  })
}

export const useApplyWordPressSchemaFix = (projectId, taskId) =>
  useFixAction(projectId, taskId, async ({ expectedPlanFingerprint }) => {
    const response = await apiService.applyWordPressSchemaFix(taskId, { expectedPlanFingerprint })
    if (!response?.success) throw new Error(response?.message || "The fix could not be applied")
    return response.data
  })

export const useReverifyWordPressFix = (projectId, taskId) =>
  useFixAction(projectId, taskId, async () => {
    const response = await apiService.reverifyWordPressFix(taskId)
    if (!response?.success) throw new Error(response?.message || "The fix could not be re-verified")
    return response.data
  })

export const useRollbackWordPressFix = (projectId, taskId) =>
  useFixAction(projectId, taskId, async () => {
    const response = await apiService.rollbackWordPressFix(taskId)
    if (!response?.success) throw new Error(response?.message || "The fix could not be rolled back")
    return response.data
  })
