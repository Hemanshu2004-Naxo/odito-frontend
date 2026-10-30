"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { ANCHOR_TYPES, TYPE_KEYS } from "@/lib/anchors/anchorConfig"
import { summariseAnchorProfile } from "@/lib/anchors/summariseAnchorProfile"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCompact } from "../domain-overview/format"
import TermsInput from "./TermsInput"

const share = (p) => (p === null ? null : p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`)

/**
 * "Anchor settings": the brand terms and target keywords every anchor is classified with. A live preview shows what the split would be with the
 * terms as they stand in the dialog — computed from the profile already loaded, with no request. Saving stores them on the project and the
 * page reclassifies at once. "Import from Organic Keywords" offers the best organic keywords (no brand term in them) to tick and add.
 */
export default function AnchorSettingsDialog({ open, onOpenChange, api, profileRows, targetDomain, onSaved }) {
  const { settings, saved, limits, save, loadKeywordCandidates } = api
  const [brandTerms, setBrandTerms] = useState([])
  const [targetKeywords, setTargetKeywords] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [candidates, setCandidates] = useState(null) // null = not asked; { source, rows, picked: Set }
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)

  // Every time it opens it starts from what is saved (or suggested), not from a half-edited draft.
  useEffect(() => {
    if (!open) return
    setBrandTerms([...settings.brandTerms])
    setTargetKeywords([...settings.targetKeywords])
    setError(null)
    setCandidates(null)
    setImportError(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- re-read the settings only when the dialog opens

  const preview = useMemo(() => {
    if (!profileRows?.length) return null
    const s = summariseAnchorProfile(profileRows, { brandTerms, targetKeywords }, { targetDomain })
    return TYPE_KEYS.map((key) => ({ key, label: ANCHOR_TYPES[key].label, percent: s.types[key].percentByReferringDomains })).filter((t) => t.percent !== null)
  }, [profileRows, brandTerms, targetKeywords, targetDomain])

  const importKeywords = async () => {
    setImporting(true)
    setImportError(null)
    try {
      const out = await loadKeywordCandidates(brandTerms)
      const fresh = out.rows.filter((r) => !targetKeywords.includes(r.keyword))
      setCandidates({ source: out.source, rows: fresh, picked: new Set(fresh.map((r) => r.keyword)) })
    } catch (err) {
      setImportError(err?.message || "Couldn't load your organic keywords. Try again.")
    } finally {
      setImporting(false)
    }
  }
  const togglePick = (keyword) => setCandidates((c) => {
    const picked = new Set(c.picked)
    if (picked.has(keyword)) picked.delete(keyword); else picked.add(keyword)
    return { ...c, picked }
  })
  const addPicked = () => {
    const room = limits.target_keywords - targetKeywords.length
    const add = candidates.rows.filter((r) => candidates.picked.has(r.keyword)).map((r) => r.keyword).slice(0, Math.max(0, room))
    setTargetKeywords([...targetKeywords, ...add])
    setCandidates(null)
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    const res = await save({ brandTerms, targetKeywords })
    setSaving(false)
    if (res.ok) { onSaved?.(); onOpenChange(false) } else setError(res.message)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v) }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="an-settings-dialog">
        <DialogHeader>
          <DialogTitle>Anchor settings</DialogTitle>
          <DialogDescription>
            These decide each anchor&apos;s type. Changing them re-sorts the anchors on this page instantly — nothing is requested from the data provider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <TermsInput
            id="an-brand-terms"
            testId="an-brand"
            label="Brand terms"
            hint={saved ? "Anchors containing any of these are Branded. Press Enter to add." : "Suggested from your domain — edit them, then save. Anchors containing any of these are Branded."}
            value={brandTerms}
            onChange={setBrandTerms}
            max={limits.brand_terms}
            maxLength={limits.term_length}
            placeholder="e.g. asg eye hospital"
          />

          <div className="space-y-2">
            <TermsInput
              id="an-target-keywords"
              testId="an-keywords"
              label="Target keywords"
              hint="Your money keywords. An anchor equal to one is Exact match; one containing it (or all its words) is Partial match."
              value={targetKeywords}
              onChange={setTargetKeywords}
              max={limits.target_keywords}
              maxLength={limits.term_length}
              placeholder="e.g. lasik surgery"
            />
            <Button type="button" variant="outline" size="sm" onClick={importKeywords} disabled={importing} data-testid="an-import">
              {importing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
              Import from Organic Keywords
            </Button>
            {importError ? <p role="alert" className="text-xs text-red-600 dark:text-red-400" data-testid="an-import-error">{importError}</p> : null}
            {candidates ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3" data-testid="an-import-list">
                <p className="mb-2 text-xs text-muted-foreground">
                  {candidates.source === "cache" ? "From your Organic Keywords data (already loaded)." : "Your top keywords by traffic (one request)."}{" "}
                  Branded keywords are left out. Tick the ones to keep.
                </p>
                {candidates.rows.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="an-import-none">No new keywords to add.</p> : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {candidates.rows.map((r) => (
                      <li key={r.keyword}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/60">
                          <input type="checkbox" checked={candidates.picked.has(r.keyword)} onChange={() => togglePick(r.keyword)} className="size-4" data-testid="an-import-pick" />
                          <span className="min-w-0 flex-1 truncate">{r.keyword}</span>
                          {r.traffic !== null ? <span className="text-xs tabular-nums text-muted-foreground" title="Estimated monthly visits">{formatCompact(r.traffic)}</span> : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" onClick={addPicked} disabled={!candidates.picked.size} data-testid="an-import-add">Add {candidates.picked.size || ""} selected</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCandidates(null)}>Cancel</Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm" data-testid="an-preview" aria-live="polite">
            <span className="font-medium">With these settings: </span>
            {preview ? preview.map((t, i) => <span key={t.key}>{i ? " · " : ""}{t.label} <span className="tabular-nums" data-testid={`an-preview-${t.key}`}>{share(t.percent)}</span></span>) : <span className="text-muted-foreground">the preview appears once the anchors have loaded.</span>}
          </div>
          {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400" data-testid="an-settings-error">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={saving} data-testid="an-settings-save">{saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
