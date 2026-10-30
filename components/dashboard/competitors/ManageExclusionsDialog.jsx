"use client"

import { useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { parseDomainList } from "@/lib/normalizeDomain"
import { formatExact } from "../domain-overview/format"

/**
 * "Manage exclusions": the project's own exclude list. Domains listed here never appear as competitors (the server sends them to
 * DataForSEO as `exclude_domains`). Paste one domain or many (separated by commas, spaces or new lines); each is cleaned
 * ("https://www.Practo.com/doctors" -> practo.com). Valid ones are added; the ones that are not valid are left in the box with a
 * message. Saving changes the competitors request, so the list refreshes once the server has saved.
 */
export default function ManageExclusionsDialog({ open, onOpenChange, settings, onNotify }) {
  const [text, setText] = useState("")
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState("")
  const { excluded, excludedLimit, pending } = settings

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? excluded.filter((d) => d.includes(q)) : excluded
  }, [excluded, search])

  const add = async () => {
    const { valid, invalid } = parseDomainList(text)
    if (valid.length === 0) {
      setError(invalid.length ? `Not a valid domain: ${invalid.slice(0, 5).join(", ")}${invalid.length > 5 ? "…" : ""}. Enter domains such as example.com.` : "Enter at least one domain, for example example.com.")
      return
    }
    setAdding(true)
    setError(null)
    const res = await settings.exclude(valid)
    setAdding(false)
    if (!res.ok) { setError(res.message); return }
    setText(invalid.join("\n"))
    if (invalid.length) setError(`Added ${valid.length}. Not a valid domain: ${invalid.slice(0, 5).join(", ")}${invalid.length > 5 ? "…" : ""}.`)
    else onNotify?.(res.domains.length ? `Excluded ${res.domains.length === 1 ? res.domains[0] : `${res.domains.length} domains`}.` : "Already on the list.", "success")
  }

  const remove = async (domain) => {
    const res = await settings.unexclude(domain)
    if (!res.ok) setError(res.message)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="cp-exclusions-dialog">
        <DialogHeader>
          <DialogTitle>Manage exclusions</DialogTitle>
          <DialogDescription>
            Sites on this list never appear as competitors for this project. The world&apos;s largest sites are hidden separately with &ldquo;Hide large sites&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); add() }} className="space-y-2">
          <label htmlFor="cp-exclude-input" className="text-sm font-medium">Add domains</label>
          <Textarea
            id="cp-exclude-input"
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null) }}
            placeholder={"practo.com\njustdial.com"}
            rows={3}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "cp-exclude-error" : undefined}
            data-testid="cp-exclude-input"
          />
          {error ? <p id="cp-exclude-error" role="alert" className="text-sm text-red-600 dark:text-red-400" data-testid="cp-exclude-error">{error}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground tabular-nums" data-testid="cp-exclude-count">{formatExact(excluded.length)} of {formatExact(excludedLimit)} used</p>
            <Button type="submit" disabled={adding || !text.trim()} data-testid="cp-exclude-add">
              {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Add to list
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Excluded domains</h3>
            {excluded.length > 8 ? <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the list" aria-label="Search excluded domains" className="h-8 max-w-48" /> : null}
          </div>
          {excluded.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground" data-testid="cp-exclude-empty">No domains excluded yet.</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No excluded domain matches &ldquo;{search}&rdquo;.</p>
          ) : (
            <ul className="max-h-56 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/60" data-testid="cp-exclude-list">
              {shown.map((d) => (
                <li key={d} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                  <span className="truncate" title={d}>{d}</span>
                  <button
                    type="button"
                    onClick={() => remove(d)}
                    disabled={pending.has(d)}
                    aria-label={`Remove ${d} from exclusions`}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    {pending.has(d) ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
