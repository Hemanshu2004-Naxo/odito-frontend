"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/apiService'
import { queryKeys } from '@/lib/query/keys'
import { staleTimes, gcTimes } from '@/lib/query/stale-times'

/**
 * Tracked keywords for a project — replaces KeywordDashboard.jsx's manual
 * useState/useEffect + apiService.getProjectRankings() call. Response shape
 * is unchanged (the existing GET /rankings endpoint), so UserAddedKeywords.jsx
 * needs no changes to how it reads `data`.
 */
export function useKeywords(projectId) {
  return useQuery({
    queryKey: queryKeys.keywords.list(projectId),
    queryFn: () => apiService.getProjectRankings(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.DYNAMIC,
  })
}

/**
 * Optimistic INSERT of a placeholder row, but never an optimistic RANK — the
 * distinction the original (non-optimistic) version of this hook was built
 * around still holds: a real DataForSEO lookup runs server-side and its
 * result can't be predicted, so guessing a rank would be actively
 * misleading. What CAN be shown immediately, honestly, is "this keyword now
 * exists and is being checked" — current_rank/best_rank/etc. all stay null
 * on the placeholder, and last_scan_status: 'pending' is a frontend-only
 * value (the database only ever stores 'ok' or 'error' — see
 * buildKeywordUpdate in rankingHistoryService.js) that UserAddedKeywords.jsx
 * renders as a distinct "Scanning…" state, never conflated with "Not
 * ranked" or "Scan Error".
 *
 * The backend call is unchanged and still synchronous (it awaits the real
 * DataForSEO organic+maps lookup before responding) — this only changes
 * when the ROW appears, not when the scan itself runs. On success the
 * placeholder is replaced in-place with the server's own response
 * (data.keyword), which is already the complete, authoritative result — a
 * direct cache write, not a second GET round-trip, since invalidating here
 * would just re-fetch data we already have. On error the placeholder is
 * rolled back, same pattern as useDeleteKeyword below.
 */
export function useAddKeyword(projectId) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.keywords.list(projectId)

  return useMutation({
    mutationFn: (keyword) => apiService.addKeyword(projectId, keyword),

    onMutate: async (keyword) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data?.[0]) return old
        const placeholder = {
          keyword: keyword.trim(),
          current_rank: null, rank: null, best_rank: null, benchmark_rank: null,
          prev_scan_rank: null, prev_week_rank: null, prev_month_rank: null,
          maps_rank: null, maps_listing: null, ranking_urls: [],
          scan_count: 0, last_scan_status: 'pending', last_scan_error: null,
          last_rescanned_at: null, status: 'pending',
        }
        return {
          ...old,
          data: [{ ...old.data[0], keywords: [...(old.data[0].keywords || []), placeholder] }],
        }
      })

      // Marks the query stale WITHOUT triggering a duplicate fetch right
      // now (refetchType: 'none') — purely so that if the user navigates
      // away/refreshes before this mutation's own onSuccess/onError below
      // ever runs (abandoning the placeholder mid-flight), the next mount
      // refetches instead of rehydrating a "Scanning…" row that can no
      // longer resolve on its own. No polling, no extra request in the
      // normal (un-abandoned) path.
      queryClient.invalidateQueries({ queryKey, refetchType: 'none' })

      return { previous }
    },

    onSuccess: (response, keyword) => {
      const newKw = response?.data?.keyword
      const normalized = keyword.toLowerCase().trim()

      // A project with no ranking document yet has nothing in the cache to
      // patch (data: []). The backend just created that document while adding
      // the keyword, so the only correct move is to refetch — patching a
      // missing document silently did nothing and left the table empty
      // ("No tracked keywords yet") even though the keyword was saved.
      let needsRefetch = !newKw
      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data?.[0]) { needsRefetch = true; return old }
        if (!newKw) return old
        const keywords = (old.data[0].keywords || []).map((k) =>
          k.keyword.toLowerCase().trim() === normalized ? newKw : k
        )
        return {
          ...old,
          data: [{ ...old.data[0], keywords, usage: response.data.usage ?? old.data[0].usage }],
        }
      })
      if (needsRefetch) queryClient.invalidateQueries({ queryKey })
    },

    onError: (_err, _keyword, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
  })
}

/**
 * Optimistic: removes the row and decrements usage immediately, rolls back
 * on error. Safe because delete has no external side effect to undo — the
 * worst case is a brief visual flicker if the request fails, not stale data
 * pretending to be authoritative (onSettled always reconciles with the
 * server's real state regardless of the optimistic guess).
 */
export function useDeleteKeyword(projectId) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.keywords.list(projectId)

  return useMutation({
    mutationFn: (keyword) => apiService.deleteKeyword(projectId, keyword),

    onMutate: async (keyword) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data?.[0]?.keywords) return old
        const normalized = keyword.toLowerCase().trim()
        return {
          ...old,
          data: [{
            ...old.data[0],
            keywords: old.data[0].keywords.filter(
              (k) => k.keyword.toLowerCase().trim() !== normalized
            ),
          }],
        }
      })

      return { previous }
    },

    onError: (_err, _keyword, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
