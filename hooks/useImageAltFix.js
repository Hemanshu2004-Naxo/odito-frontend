"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiService from "@/lib/apiService"
import { queryKeys } from "@/lib/query/keys"

/**
 * The image alt-text fix: the task's flagged images, a read-only preview per (image, text), and the three actions.
 *
 * - The preview is never cached across edits or opens (staleTime 0, no focus refetch, no retry): the plan fingerprint the person
 *   approves must describe exactly the image and text on screen.
 * - No action retries automatically: a write is never repeated behind the person's back.
 * - After any action the images and previews are refetched, so what is shown is what WordPress holds.
 */
export function useImageAltImages(projectId, taskId, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...queryKeys.wordpress.imageAlt(projectId, taskId), "images"],
    queryFn: async () => {
      const response = await apiService.listImageAltImages(taskId)
      if (!response?.success) throw new Error(response?.message || "The images could not be loaded")
      // { images, summary, ignored }: the images (open findings + every image Odito has a fix record for), the derived task-level
      // roll-up, and how many flagged addresses the server set aside as analytics trackers (a count, never an address).
      return { images: response.data.images || [], summary: response.data.summary || null, ignored: response.data.ignored || null }
    },
    enabled: !!projectId && !!taskId && enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

export function useImageAltPreview(projectId, taskId, { imageSrc, proposedAlt, informative }, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...queryKeys.wordpress.imageAlt(projectId, taskId), "preview", imageSrc || null, proposedAlt || "", !!informative],
    queryFn: async () => {
      const response = await apiService.previewImageAltFix(taskId, { imageSrc, proposedAlt, informative })
      if (!response?.success) throw new Error(response?.message || "The preview could not be loaded")
      return response.data
    },
    // While the NEXT preview of the SAME image loads (the person paused typing, or a suggestion was placed), keep showing the previous one so
    // the text box is not torn down mid-edit. Never across images, and the panel treats it as stale (isPlaceholderData): it cannot be approved.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey?.at(-3) === (imageSrc || null) ? previous : undefined),
    enabled: !!projectId && !!taskId && !!imageSrc && enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

function useAltAction(projectId, taskId, fn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    retry: false,
    onSettled: () => {
      if (!projectId) return
      queryClient.invalidateQueries({ queryKey: queryKeys.wordpress.imageAlt(projectId, taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.summary(projectId) })
    },
  })
}

export const useApplyImageAltFix = (projectId, taskId) =>
  useAltAction(projectId, taskId, async (input) => {
    const response = await apiService.applyImageAltFix(taskId, input)
    if (!response?.success) throw new Error(response?.message || "The alt text could not be applied")
    return response.data
  })

export const useReverifyImageAltFix = (projectId, taskId) =>
  useAltAction(projectId, taskId, async ({ imageSrc }) => {
    const response = await apiService.reverifyImageAltFix(taskId, { imageSrc })
    if (!response?.success) throw new Error(response?.message || "The alt text could not be re-verified")
    return response.data
  })

export const useRollbackImageAltFix = (projectId, taskId) =>
  useAltAction(projectId, taskId, async ({ imageSrc }) => {
    const response = await apiService.rollbackImageAltFix(taskId, { imageSrc })
    if (!response?.success) throw new Error(response?.message || "The alt text could not be rolled back")
    return response.data
  })
