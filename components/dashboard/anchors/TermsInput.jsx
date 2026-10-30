"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { normalizeText } from "@/lib/anchors/classifyAnchor"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * A chips input for a list of terms. Enter or a comma adds what was typed (a pasted list is split at commas and line breaks), leaving the
 * field adds it too, Backspace on an empty field removes the last chip, and each chip has an ×. Terms are stored the way the classifier
 * compares them (lowercase, one space between words); duplicates and blanks are ignored; the list's size and a term's length are limited.
 */
export default function TermsInput({ id, label, hint, value, onChange, max, maxLength, placeholder, testId }) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState(null)

  const add = (raw) => {
    const parts = String(raw).split(/[,\n]/).map(normalizeText).filter(Boolean)
    if (!parts.length) { setDraft(""); return }
    const next = [...value]
    for (const p of parts) {
      if (p.length > maxLength) { setError(`A term can be at most ${maxLength} characters.`); return }
      if (next.includes(p)) continue
      if (next.length >= max) { setError(`You can add at most ${max} ${label.toLowerCase()}. Remove one first.`); return }
      next.push(p)
    }
    setError(null)
    setDraft("")
    onChange(next)
  }

  return (
    <div className="min-w-0" data-testid={testId}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <span className="text-xs tabular-nums text-muted-foreground" data-testid={`${testId}-count`}>{value.length}/{max}</span>
      </div>
      <div className={cn("flex flex-wrap gap-1.5 rounded-lg border bg-background p-2", error ? "border-red-400" : "border-input")}>
        {value.map((term) => (
          <span key={term} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-muted/40 py-0.5 pl-2.5 pr-1 text-sm" data-testid={`${testId}-chip`}>
            <span className="truncate">{term}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== term))}
              aria-label={`Remove ${term}`}
              className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <Input
          id={id}
          value={draft}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => { setDraft(e.target.value); if (error) setError(null) }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft) }
            else if (e.key === "Backspace" && draft === "" && value.length) onChange(value.slice(0, -1))
          }}
          onBlur={() => { if (draft.trim()) add(draft) }}
          onPaste={(e) => {
            const text = e.clipboardData?.getData("text") ?? ""
            if (/[,\n]/.test(text)) { e.preventDefault(); add(text) }
          }}
          autoComplete="off"
          className="h-8 min-w-[10rem] flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
          aria-describedby={`${id}-hint`}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {error ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}
