"use client"

import { useEffect, useState } from "react"

/** `value`, but only after it has stopped changing for `delayMs`. Several quick changes yield ONE new value. */
export function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    if (value === debounced) return undefined
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs, debounced])
  return debounced
}
