"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import myCompetitorsService from "@/services/myCompetitorsService"
import { describeSectionError } from "@/lib/describeSectionError"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { pollInterval } from "@/components/dashboard/competitors/enrichmentUi"

/**
 * The competitors the user chose for the project. Writes are NOT optimistic: the server decides about duplicates and the limit, so the
 * list only changes with what it saved. Every action resolves to { ok: true } or { ok: false, message, code } and never throws.
 */

export const MY_COMPETITORS_LIMIT = 100

const describe = (err) => ({
  message: err && typeof err.status === "number" && err.message ? err.message : "Couldn't save the change. Check your connection and try again.",
  code: err?.code ?? null,
})

export function useMyCompetitors(projectId) {
  const queryClient = useQueryClient()
  const key = queryKeys.myCompetitors.list(projectId)
  const [pending, setPending] = useState(() => new Set()) // ids with a save running

  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => myCompetitorsService.list(projectId, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
    // Watches enrichment that is ALREADY queued (see pollInterval); opening the page never starts any.
    refetchInterval: (query) => pollInterval(query.state.data?.data?.competitors),
  })

  const data = q.data?.data ?? null
  const competitors = useMemo(() => data?.competitors ?? [], [data])
  const limit = data?.limit ?? MY_COMPETITORS_LIMIT

  const patch = useCallback((fn) => {
    queryClient.setQueryData(key, (old) => (old?.data ? { ...old, data: { ...old.data, competitors: fn(old.data.competitors) } } : old))
  }, [queryClient, key])

  const run = useCallback(async (id, call, apply) => {
    if (id) setPending((s) => new Set(s).add(id))
    try {
      const res = await call()
      patch((list) => apply(list, res.data))
      return { ok: true }
    } catch (err) {
      return { ok: false, ...describe(err) }
    } finally {
      if (id) setPending((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }, [patch])

  const add = useCallback((input) => run(null, () => myCompetitorsService.create(projectId, input), (list, d) => [d.competitor, ...list]), [projectId, run])
  const edit = useCallback((id, changes) => run(id, () => myCompetitorsService.update(projectId, id, changes), (list, d) => list.map((c) => (c.id === id ? d.competitor : c))), [projectId, run])
  /** Add a discovered business. A match with an existing record merges into it (and says so by returning created: false). */
  const addDiscovered = useCallback(async (candidate) => {
    try {
      const res = await myCompetitorsService.addDiscovered(projectId, candidate)
      const { competitor, created } = res.data
      patch((list) => (list.some((c) => c.id === competitor.id) ? list.map((c) => (c.id === competitor.id ? competitor : c)) : [competitor, ...list]))
      return { ok: true, created, competitor }
    } catch (err) {
      return { ok: false, ...describe(err) }
    }
  }, [projectId, patch])
  const remove = useCallback((id) => run(id, () => myCompetitorsService.remove(projectId, id), (list) => list.filter((c) => c.id !== id)), [projectId, run])
  /** Queue a manual refresh. The row comes back as `pending` and the polling picks up the finished numbers. */
  const refresh = useCallback((id) => run(id, () => myCompetitorsService.refresh(projectId, id), (list, d) => list.map((c) => (c.id === id ? d.competitor : c))), [projectId, run])

  return {
    status: data ? "success" : q.isError ? "error" : "loading",
    error: q.isError ? { message: describeSectionError(q.error), code: q.error?.code ?? null } : null,
    competitors,
    limit,
    pending,
    add,
    edit,
    remove,
    refresh,
    addDiscovered,
    refetch: () => q.refetch(),
  }
}
