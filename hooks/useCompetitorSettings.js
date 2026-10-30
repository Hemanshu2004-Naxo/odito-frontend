"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import competitorSettingsService from "@/services/competitorSettingsService"
import { describeSectionError } from "@/lib/describeSectionError"
import { exclusionSignature } from "@/lib/competitorsRequest"
import { normalizeDomain } from "@/lib/normalizeDomain"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"

/**
 * The project's saved competitor lists: `tracked` (pinned for the Compare section, max 10) and `excluded` (the project's own exclude
 * list, max 1,000, sent to DataForSEO by the server). Stored on the project; this is the browser's copy.
 *
 *  - Tracking is OPTIMISTIC (the star flips at once, and is rolled back with the server's reason if the save fails): the tracked list
 *    never changes the competitors list, so nothing else depends on the answer.
 *  - Excluding is NOT optimistic: the exclude list changes the question asked of the provider, so the competitors query key (which
 *    carries the list's signature) must only change once the server has really saved the list — otherwise the new key could be filled
 *    with an answer computed for the old list.
 *
 * Every action resolves to { ok: true } or { ok: false, message, code } and never throws: the caller shows the message.
 */

export const TRACKED_LIMIT = 10
export const EXCLUDED_LIMIT = 1000

const fail = (message, code) => ({ ok: false, message, code })
const describe = (err) => ({ message: err && typeof err.status === "number" && err.message ? err.message : "Couldn't save the change. Check your connection and try again.", code: err?.code ?? null })

export function useCompetitorSettings(projectId) {
  const queryClient = useQueryClient()
  const key = queryKeys.competitorSettings.detail(projectId)
  const inFlightTracked = useRef(0)
  const [pending, setPending] = useState(() => new Set()) // domains with a save running (the list they are in is not optimistic)

  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => competitorSettingsService.get(projectId, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const data = q.data?.data ?? null
  const tracked = useMemo(() => data?.tracked ?? [], [data])
  const excluded = useMemo(() => data?.excluded ?? [], [data])
  const trackedLimit = data?.limits?.tracked ?? TRACKED_LIMIT
  const excludedLimit = data?.limits?.excluded ?? EXCLUDED_LIMIT
  /** The competitors query waits for this: the list's signature is part of its key. An unreachable server still lets the page load. */
  const settled = q.isSuccess || q.isError
  const signature = q.isSuccess ? exclusionSignature(excluded) : q.isError ? "xna" : null

  const patch = useCallback((fn) => {
    queryClient.setQueryData(key, (old) => (old?.data ? { ...old, data: fn(old.data) } : old))
  }, [queryClient, key])
  const mark = (domains, on) => setPending((prev) => {
    const next = new Set(prev)
    domains.forEach((d) => (on ? next.add(d) : next.delete(d)))
    return next
  })
  const current = useCallback(() => queryClient.getQueryData(key)?.data ?? { tracked: [], excluded: [] }, [queryClient, key])

  const track = useCallback(async (input) => {
    const domain = normalizeDomain(input)
    if (!domain) return fail("Enter a valid domain, for example example.com.", "INVALID_DOMAIN")
    const list = current().tracked
    if (list.includes(domain)) return { ok: true, domain }
    if (list.length >= trackedLimit) return fail(`You can track up to ${trackedLimit} competitors. Remove one to add another.`, "TRACKED_LIMIT_REACHED")
    patch((d) => ({ ...d, tracked: [...d.tracked, domain] }))
    inFlightTracked.current += 1
    try {
      await competitorSettingsService.addTracked(projectId, domain)
      return { ok: true, domain }
    } catch (err) {
      patch((d) => ({ ...d, tracked: d.tracked.filter((x) => x !== domain) }))
      return { ...fail(describe(err).message, describe(err).code), domain }
    } finally {
      inFlightTracked.current -= 1
      // Once the last save has settled, take the server's list as the truth (concurrent saves can answer out of order).
      if (inFlightTracked.current === 0) queryClient.invalidateQueries({ queryKey: key })
    }
  }, [projectId, trackedLimit, patch, current, queryClient, key])

  const untrack = useCallback(async (input) => {
    const domain = normalizeDomain(input)
    if (!domain) return fail("Not a valid domain.", "INVALID_DOMAIN")
    const before = current().tracked
    if (!before.includes(domain)) return { ok: true, domain }
    patch((d) => ({ ...d, tracked: d.tracked.filter((x) => x !== domain) }))
    inFlightTracked.current += 1
    try {
      await competitorSettingsService.removeTracked(projectId, domain)
      return { ok: true, domain }
    } catch (err) {
      patch((d) => ({ ...d, tracked: d.tracked.includes(domain) ? d.tracked : [...d.tracked, domain] }))
      return { ...fail(describe(err).message, describe(err).code), domain }
    } finally {
      inFlightTracked.current -= 1
      if (inFlightTracked.current === 0) queryClient.invalidateQueries({ queryKey: key })
    }
  }, [projectId, patch, current, queryClient, key])

  /** @param {string[]} domains already-clean domains (see parseDomainList) */
  const exclude = useCallback(async (domains) => {
    const clean = [...new Set(domains.map((d) => normalizeDomain(d)).filter(Boolean))]
    if (clean.length === 0) return fail("Enter a valid domain, for example example.com.", "INVALID_DOMAIN")
    const fresh = clean.filter((d) => !current().excluded.includes(d))
    if (fresh.length === 0) return { ok: true, domains: [] }
    if (current().excluded.length + fresh.length > excludedLimit) {
      return fail(`The exclude list holds up to ${excludedLimit.toLocaleString("en-US")} domains. Remove some to add more.`, "EXCLUDED_LIMIT_REACHED")
    }
    mark(fresh, true)
    try {
      const res = await competitorSettingsService.addExcluded(projectId, fresh)
      // The server's list, as saved: this is what changes the competitors query key.
      queryClient.setQueryData(key, (old) => ({ ...(old ?? { success: true }), data: res.data }))
      return { ok: true, domains: fresh }
    } catch (err) {
      return fail(describe(err).message, describe(err).code)
    } finally {
      mark(fresh, false)
    }
  }, [projectId, excludedLimit, current, queryClient, key])

  const unexclude = useCallback(async (input) => {
    const domain = normalizeDomain(input)
    if (!domain) return fail("Not a valid domain.", "INVALID_DOMAIN")
    mark([domain], true)
    try {
      const res = await competitorSettingsService.removeExcluded(projectId, domain)
      queryClient.setQueryData(key, (old) => ({ ...(old ?? { success: true }), data: res.data }))
      return { ok: true, domain }
    } catch (err) {
      return fail(describe(err).message, describe(err).code)
    } finally {
      mark([domain], false)
    }
  }, [projectId, queryClient, key])

  return {
    status: data ? "success" : q.isError ? "error" : "loading",
    error: q.isError ? { message: describeSectionError(q.error), code: q.error?.code ?? null } : null,
    settled,
    signature,
    tracked,
    excluded,
    trackedLimit,
    excludedLimit,
    pending,
    track,
    untrack,
    exclude,
    unexclude,
    refetch: () => q.refetch(),
  }
}
