"use client"

import { useCallback, useState } from 'react'

let nextId = 1

/**
 * Minimal local toast queue for pages with no backend to confirm actions
 * against. No toast library exists anywhere in this app - kept as a small
 * shared hook (rather than one copy per module) so future frontend-only
 * pages can reuse it instead of re-implementing the same 15 lines.
 *
 * notify(message, tone, { action: { label, onClick }, duration }): a toast with an action (e.g. "Retry") stays longer by default.
 */
export function useToastQueue() {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback((message, tone = 'default', { action = null, duration } = {}) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, tone, action }])
    setTimeout(() => dismiss(id), duration ?? (action ? 8000 : 2800))
  }, [dismiss])

  return { toasts, notify, dismiss }
}
