"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import competitorAssessmentsService from "@/services/competitorAssessmentsService"
import { queryKeys } from "@/lib/query/keys"
import { assessmentPollInterval, domainsToRequest } from "@/components/dashboard/competitors/relevanceUi"

/**
 * The business relevance of the given domains (the rows of the page being viewed, or the saved competitors).
 *
 *  - It reads what is stored (cheap, no request to any site).
 *  - With `autoRequest`, it then asks the server to check the domains that have no assessment yet or a stale one - ONCE per domain per view -
 *    and watches until they are done (bounded: see assessmentPollInterval). Nothing else ever starts a check.
 *  - A user's decision is saved by `override` / `clear` and replaces the row at once with the server's answer.
 * Every action resolves to { ok: true } or { ok: false, message, code } and never throws.
 */

const describe = (err) => ({ message: err && typeof err.status === "number" && err.message ? err.message : "Couldn't save the change. Check your connection and try again.", code: err?.code ?? null })

export function useCompetitorAssessments(projectId, domains, { autoRequest = true } = {}) {
  const queryClient = useQueryClient()
  const clean = useMemo(() => [...new Set((domains ?? []).filter(Boolean))].sort(), [domains])
  const signature = clean.join(",")
  const key = queryKeys.competitorAssessments.list(projectId, signature)
  const startedAt = useRef(Date.now())
  const asked = useRef(new Set())
  const [pending, setPending] = useState(() => new Set())

  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => competitorAssessmentsService.list(projectId, clean, { signal }),
    enabled: !!projectId && clean.length > 0,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const list = query.state.data?.data?.assessments ?? []
      return assessmentPollInterval(new Map(list.map((a) => [a.domain, a])), startedAt.current)
    },
  })

  const byDomain = useMemo(() => new Map((q.data?.data?.assessments ?? []).map((a) => [a.domain, a])), [q.data])

  // A new set of domains is a new view: the polling window starts again.
  useEffect(() => { startedAt.current = Date.now() }, [signature])

  // Ask once per domain per view for what is missing or stale.
  useEffect(() => {
    if (!autoRequest || !q.isSuccess) return
    const wanted = domainsToRequest(clean, byDomain, asked.current)
    if (wanted.length === 0) return
    wanted.forEach((d) => asked.current.add(d))
    let cancelled = false
    competitorAssessmentsService.request(projectId, wanted)
      .then((res) => {
        if (cancelled) return
        const fresh = res?.data?.assessments ?? []
        queryClient.setQueryData(key, (old) => {
          const merged = new Map((old?.data?.assessments ?? []).map((a) => [a.domain, a]))
          fresh.forEach((a) => merged.set(a.domain, a))
          return { success: true, data: { assessments: [...merged.values()] } }
        })
        startedAt.current = Date.now()
        queryClient.invalidateQueries({ queryKey: key })
      })
      .catch(() => { /* the badges stay "Not checked"; nothing else is affected */ })
    return () => { cancelled = true }
    // `byDomain` changes as results arrive; `asked` stops anything being requested twice.
  }, [autoRequest, q.isSuccess, signature, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = useCallback((assessment) => {
    queryClient.setQueryData(key, (old) => {
      const merged = new Map((old?.data?.assessments ?? []).map((a) => [a.domain, a]))
      if (assessment) merged.set(assessment.domain, assessment)
      return { success: true, data: { assessments: [...merged.values()] } }
    })
  }, [queryClient, key])

  const run = useCallback(async (domain, call) => {
    setPending((s) => new Set(s).add(domain))
    try {
      const res = await call()
      apply(res?.data?.assessment ?? null)
      queryClient.invalidateQueries({ queryKey: ["competitor-assessments", projectId] })
      return { ok: true }
    } catch (err) {
      return { ok: false, ...describe(err) }
    } finally {
      setPending((s) => { const n = new Set(s); n.delete(domain); return n })
    }
  }, [apply, queryClient, projectId])

  const override = useCallback((domain, cls, note) => run(domain, () => competitorAssessmentsService.override(projectId, domain, cls, note)), [projectId, run])
  const clear = useCallback((domain) => run(domain, () => competitorAssessmentsService.clearOverride(projectId, domain)), [projectId, run])

  /** "Check this site again": queue a fresh check (the user's own decision, if any, is kept). The page then watches it like any other check. */
  const reassess = useCallback(async (domain) => {
    setPending((s) => new Set(s).add(domain))
    try {
      const res = await competitorAssessmentsService.request(projectId, [domain], { force: true })
      res?.data?.assessments?.forEach(apply)
      startedAt.current = Date.now()
      queryClient.invalidateQueries({ queryKey: ["competitor-assessments", projectId] })
      return { ok: true }
    } catch (err) {
      return { ok: false, ...describe(err) }
    } finally {
      setPending((s) => { const n = new Set(s); n.delete(domain); return n })
    }
  }, [projectId, apply, queryClient])

  return { byDomain, status: q.isError ? "error" : q.isSuccess ? "success" : clean.length === 0 ? "idle" : "loading", pending, override, clear, reassess, refetch: () => q.refetch() }
}
