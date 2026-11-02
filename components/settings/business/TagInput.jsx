"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"

/** A list of short text values: Enter or comma adds, Backspace on an empty box removes the last one. Case-insensitive duplicates are ignored. */
export default function TagInput({ id, values, onChange, max, maxLength = 100, placeholder, ariaLabel }) {
  const [draft, setDraft] = useState("")
  const add = (raw) => {
    const t = raw.trim().replace(/\s+/g, " ")
    if (!t || t.length > maxLength || values.length >= max || values.some((v) => v.toLowerCase() === t.toLowerCase())) { setDraft(""); return }
    onChange([...values, t]); setDraft("")
  }
  return (
    <div className="space-y-2">
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={ariaLabel}>
          {values.map((v) => (
            <li key={v} className="flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded-full p-0.5 hover:bg-accent"><X className="size-3" aria-hidden /></button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id} value={draft} placeholder={values.length >= max ? `Up to ${max} added` : placeholder} disabled={values.length >= max} maxLength={maxLength}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value.slice(0, -1)) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(draft) }
          else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1))
        }}
        onBlur={() => add(draft)}
      />
    </div>
  )
}
