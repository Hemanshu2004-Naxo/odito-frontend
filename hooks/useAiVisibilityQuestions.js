"use client"

import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import aiVisibilityQuestionService from '@/services/aiVisibilityQuestionService'
import { queryKeys } from '@/lib/query/keys'
import { staleTimes } from '@/lib/query/stale-times'

/**
 * Question-set queries and mutations. Approval state lives ONLY on the server: every mutation writes the document the server returned
 * into the cache (never a locally computed "approved"), and the list / approved queries are invalidated so the next read is the server's.
 * All keys are project-scoped, and the cache is excluded from localStorage persistence (lib/queryPersistence.js).
 */

export function useQuestionSets(projectId, params = { page: 1, limit: 10 }) {
  return useQuery({
    queryKey: queryKeys.aiVisibilityQuestions.list(projectId, params),
    queryFn: () => aiVisibilityQuestionService.list(projectId, params),
    enabled: !!projectId,
    staleTime: staleTimes.REALTIME,
  })
}

export function useQuestionSet(projectId, setId) {
  return useQuery({
    queryKey: queryKeys.aiVisibilityQuestions.set(projectId, setId),
    queryFn: () => aiVisibilityQuestionService.get(projectId, setId),
    enabled: !!projectId && !!setId,
    staleTime: staleTimes.REALTIME,
  })
}

/** The set runs execute. `data.data` is undefined when the project has none. */
export function useApprovedQuestionSet(projectId) {
  return useQuery({
    queryKey: queryKeys.aiVisibilityQuestions.approved(projectId),
    queryFn: () => aiVisibilityQuestionService.getApproved(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.REALTIME,
  })
}

/** Wrap a mutation so a double click cannot send two requests before React re-renders the button as disabled. */
function singleFlight(mutation, inFlight) {
  const { mutate, mutateAsync, ...rest } = mutation
  return {
    ...rest,
    mutate: (vars, options) => { if (inFlight.current) return; inFlight.current = true; mutate(vars, options) },
    mutateAsync: (vars, options) => { if (inFlight.current) return Promise.resolve(undefined); inFlight.current = true; return mutateAsync(vars, options) },
  }
}

const refreshLists = (qc, projectId) => {
  qc.invalidateQueries({ queryKey: [...queryKeys.aiVisibilityQuestions.all(projectId), 'list'] })
  qc.invalidateQueries({ queryKey: queryKeys.aiVisibilityQuestions.approved(projectId) })
}
const storeSet = (qc, projectId, response) => {
  const set = response?.data
  if (set?.id) qc.setQueryData(queryKeys.aiVisibilityQuestions.set(projectId, set.id), response)
}

/** The confirmed business profile questions are built from, plus what is missing / contradictory (server-computed). */
export function useBusinessProfile(projectId) {
  return useQuery({
    queryKey: queryKeys.aiVisibilityQuestions.profile(projectId),
    queryFn: () => aiVisibilityQuestionService.getProfile(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.REALTIME,
  })
}

/**
 * Save the customer's confirmation of the profile. The server returns the re-computed profile, which replaces the cache. Question sets are
 * re-read too: a profile change marks the approved set as "profile changed".
 */
export function useSaveBusinessProfile(projectId) {
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const m = useMutation({
    mutationFn: (changes) => aiVisibilityQuestionService.saveProfile(projectId, changes),
    onSuccess: (response) => {
      qc.setQueryData(queryKeys.aiVisibilityQuestions.profile(projectId), response)
      qc.invalidateQueries({ queryKey: [...queryKeys.aiVisibilityQuestions.all(projectId), 'set'] })
      refreshLists(qc, projectId)
    },
    onSettled: () => { inFlight.current = false },
  })
  return singleFlight(m, inFlight)
}

/** Generates a DRAFT from the stored profile (nothing is sent). Returns the new draft as the server created it. */
export function useGenerateDraft(projectId) {
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const m = useMutation({
    mutationFn: () => aiVisibilityQuestionService.generate(projectId),
    onSuccess: (response) => { storeSet(qc, projectId, response); refreshLists(qc, projectId) },
    onSettled: () => { inFlight.current = false },
  })
  return singleFlight(m, inFlight)
}

/** changes: { enabled?, text? }. The server returns the whole updated set; that is what is cached. */
export function useUpdateQuestion(projectId, setId) {
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: ({ questionId, changes }) => aiVisibilityQuestionService.updateQuestion(projectId, setId, questionId, changes),
    onSuccess: (response) => { storeSet(qc, projectId, response); qc.invalidateQueries({ queryKey: [...queryKeys.aiVisibilityQuestions.all(projectId), 'list'] }) },
  })
  return m
}

export function useApproveQuestionSet(projectId, setId) {
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const m = useMutation({
    mutationFn: () => aiVisibilityQuestionService.approve(projectId, setId),
    onSuccess: (response) => { storeSet(qc, projectId, response); refreshLists(qc, projectId) },
    // A conflict means the server's state differs from what the page showed: re-read it either way.
    onError: () => { qc.invalidateQueries({ queryKey: queryKeys.aiVisibilityQuestions.set(projectId, setId) }); refreshLists(qc, projectId) },
    onSettled: () => { inFlight.current = false },
  })
  return singleFlight(m, inFlight)
}

export function useDiscardQuestionSet(projectId, setId) {
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const m = useMutation({
    mutationFn: () => aiVisibilityQuestionService.discard(projectId, setId),
    onSuccess: (response) => { storeSet(qc, projectId, response); refreshLists(qc, projectId) },
    onError: () => { qc.invalidateQueries({ queryKey: queryKeys.aiVisibilityQuestions.set(projectId, setId) }) },
    onSettled: () => { inFlight.current = false },
  })
  return singleFlight(m, inFlight)
}
