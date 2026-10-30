"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import referringDomainSettingsService from "@/services/referringDomainSettingsService"
import { normalizeDomain } from "@/lib/normalizeDomain"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"

/**
 * The project's two saved lists of referring domains: `disavowed` (marked to disavow) and `reviewed` (marked "OK / keep"). They live in OUR
 * database, never in the data provider's cached answers, so a change updates the screen from the saved lists alone and NEVER refetches the
 * provider (this hook does not so much as know the query keys of the Domain Overview).
 *
 * Changes are NOT optimistic: the lists are what the server saved. The server cleans every domain and keeps the two lists apart (disavowing a
 * domain takes it out of "reviewed" and the other way round); the answer is both lists as saved, which replace the cached ones.
 * Every domain is cleaned with the shared normalizeDomain and de-duplicated here too, and a change that would do nothing sends nothing.
 *
 * Every action resolves to { ok: true } or { ok: false, message, code } and never throws.
 */

const fail = (message, code = null) => ({ ok: false, message, code })
const describe = (err) => ({
  message: err && typeof err.status === "number" && err.message ? err.message : "Couldn't save the change. Check your connection and try again.",
  code: err?.code ?? null,
})

/** Clean, unique domains from whatever was given; `bad` = the ones that are not domains. */
export function cleanDomains(input) {
  const list = Array.isArray(input) ? input : [input]
  const out = []
  const bad = []
  for (const raw of list) {
    const d = normalizeDomain(raw)
    if (!d) bad.push(String(raw)); else if (!out.includes(d)) out.push(d)
  }
  return { domains: out, bad }
}

export function useDomainLists(projectId) {
  const queryClient = useQueryClient()
  const key = queryKeys.domainLists.detail(projectId)
  const [pending, setPending] = useState(0)

  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => referringDomainSettingsService.get(projectId, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const data = q.data?.data ?? null
  const disavowed = useMemo(() => data?.disavowed ?? [], [data])
  const reviewed = useMemo(() => data?.reviewed ?? [], [data])
  const disavowedSet = useMemo(() => new Set(disavowed), [disavowed])
  const reviewedSet = useMemo(() => new Set(reviewed), [reviewed])
  const limits = data?.limits ?? { perList: 10000, perChange: 1000 }

  /** One request for one change; the saved lists come back and replace the cached ones. */
  const send = useCallback(async (change) => {
    setPending((n) => n + 1)
    try {
      const res = await referringDomainSettingsService.change(projectId, change)
      queryClient.setQueryData(key, res)
      return { ok: true }
    } catch (err) {
      const d = describe(err)
      return fail(d.message, d.code)
    } finally {
      setPending((n) => n - 1)
    }
  }, [projectId, queryClient, key])

  /** list = "disavowed" | "reviewed"; op = "add" | "remove". Only what would actually change is sent. */
  const change = useCallback(async (list, op, input) => {
    const { domains, bad } = cleanDomains(input)
    if (bad.length) return fail(`"${bad[0].slice(0, 60)}" is not a valid domain.`, "INVALID_DOMAIN")
    const current = list === "disavowed" ? disavowedSet : reviewedSet
    // Adding what is already there, or removing what is not, is nothing: nothing is sent. (A domain is never in both lists, so adding one
    // that is in the OTHER list is a real change — the server moves it.)
    const effective = domains.filter((d) => (op === "add" ? !current.has(d) : current.has(d)))
    if (effective.length === 0) return { ok: true, unchanged: true }
    if (effective.length > limits.perChange) return fail(`You can change at most ${limits.perChange.toLocaleString("en-US")} domains at once.`, "CHANGE_TOO_BIG")
    return send({ [list]: { [op]: effective } })
  }, [disavowedSet, reviewedSet, limits.perChange, send])

  return {
    status: q.isError ? "error" : data ? "success" : "loading",
    error: q.isError ? { message: describe(q.error).message } : null,
    disavowed,
    reviewed,
    disavowedSet,
    reviewedSet,
    limits,
    saving: pending > 0,
    /** Marks domain(s) to disavow (and takes them out of "reviewed"). */
    disavow: useCallback((domains) => change("disavowed", "add", domains), [change]),
    /** Takes domain(s) out of the disavow list. */
    undisavow: useCallback((domains) => change("disavowed", "remove", domains), [change]),
    /** Marks domain(s) "OK / keep" (and takes them out of the disavow list). */
    markOk: useCallback((domains) => change("reviewed", "add", domains), [change]),
    unmarkOk: useCallback((domains) => change("reviewed", "remove", domains), [change]),
  }
}
