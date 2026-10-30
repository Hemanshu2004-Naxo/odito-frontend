"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { validateEntry, LIMITS } from "./inputs"

/**
 * A list of short text entries (services, cities, ...). Enter or comma adds the typed entry; each entry has a remove button. Entries are
 * validated as they are added (length, web addresses, duplicates, count), so the user learns about a problem at the field, not at submit.
 */
export default function ListField({ id, label, hint, value, onChange, placeholder, error, disabled }) {
  const [draft, setDraft] = useState("")
  const [entryError, setEntryError] = useState(null)

  /** Add one or more entries at once (a pasted "a, b, c"); the first invalid one stops the batch and is reported. */
  const addMany = (raws, keepDraft = "") => {
    let next = [...value]
    for (const raw of raws) {
      const v = raw.trim()
      if (!v) continue
      const problem = validateEntry(v, next)
      if (problem) { onChange(next); setDraft(v); setEntryError(problem); return }
      next = [...next, v]
    }
    onChange(next)
    setDraft(keepDraft)
    setEntryError(null)
  }
  const add = (raw) => addMany([raw])

  const shown = entryError || error
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
      {value.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} added`}>
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1 text-sm">
              <span>{v}</span>
              <button
                type="button" disabled={disabled} aria-label={`Remove ${v}`}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id} className="mt-2" value={draft} placeholder={value.length >= LIMITS.listItems ? "Limit reached" : placeholder}
        disabled={disabled || value.length >= LIMITS.listItems}
        aria-invalid={shown ? true : undefined} aria-describedby={[hint ? `${id}-hint` : null, shown ? `${id}-error` : null].filter(Boolean).join(" ") || undefined}
        onChange={(e) => {
          const next = e.target.value
          setEntryError(null)
          if (next.includes(",")) { const parts = next.split(","); addMany(parts.slice(0, -1), parts[parts.length - 1]); return }
          setDraft(next)
        }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft) } }}
        onBlur={() => { if (draft.trim()) add(draft) }}
      />
      {shown ? <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{shown}</p> : null}
    </div>
  )
}
