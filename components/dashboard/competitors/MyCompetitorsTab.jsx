"use client"

import { useMemo, useState } from "react"
import { Loader2, Plus, Users } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"
import { useMyCompetitors } from "@/hooks/useMyCompetitors"
import { useCompetitorAssessments } from "@/hooks/useCompetitorAssessments"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { Panel } from "@/components/dashboard/shared/parts"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import MyCompetitorsTable from "./MyCompetitorsTable"

export const EMPTY = { name: "", domain: "", address: "", notes: "" }
const PAGE_SIZE = 20

/** Competitors the user chose. They are saved per project and never touched by a refresh or by how far away they are. */
export default function MyCompetitorsTab() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its competitors.</div>
  }
  return <ProjectMyCompetitors key={projectId} projectId={projectId} />
}

function ProjectMyCompetitors({ projectId }) {
  const mc = useMyCompetitors(projectId)
  const { toasts, notify, dismiss } = useToastQueue()
  const [search, setSearch] = useState("")
  const [form, setForm] = useState(null) // null = closed; { id|null, values } = open
  const [removing, setRemoving] = useState(null) // the competitor awaiting confirmation
  // The competitor whose details are open under its row (one at a time). The details are drawn from the list itself, so a refresh shows in them.
  const [detailsId, setDetailsId] = useState(null)

  // Queue a manual SEO refresh. Only queues: the numbers arrive in the background and the list re-reads itself while it is waiting.
  const refreshOne = async (c) => {
    const res = await mc.refresh(c.id)
    if (res.ok) notify(`Fetching SEO metrics for ${c.name}. They appear here when ready.`, "success")
    else notify(res.code === "REFRESH_COOLDOWN" ? `${c.name} was updated recently. Try again later.` : res.message, res.code === "REFRESH_COOLDOWN" ? "info" : "danger")
  }

  // Rows are drawn PAGE_SIZE at a time ("Show more"): every row with a website loads a third-party favicon, so a 100-entry list would
  // otherwise start up to 100 requests the moment the tab opens. Search always looks at the whole list.
  const [visible, setVisible] = useState(PAGE_SIZE)
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mc.competitors
    return mc.competitors.filter((c) => [c.name, c.domain, c.address, c.notes].some((v) => v && v.toLowerCase().includes(q)))
  }, [mc.competitors, search])
  const shown = useMemo(() => matches.slice(0, visible), [matches, visible])
  // Business relevance of the competitors on screen (at most one page of them). Saving a competitor already queued its check; this only reads it
  // and, for a record saved before relevance existed, asks once.
  const shownDomains = useMemo(() => shown.map((c) => c.domain).filter(Boolean), [shown])
  const assessments = useCompetitorAssessments(projectId, shownDomains)
  const onOverride = (d, cls) => assessments.override(d, cls).then((r) => { if (!r.ok) notify(r.message, "danger") })
  const onClearOverride = (d) => assessments.clear(d).then((r) => { if (!r.ok) notify(r.message, "danger") })
  const onReassess = (d) => assessments.reassess(d).then((r) => { if (!r.ok) notify(r.message, "danger") })

  const full = mc.competitors.length >= mc.limit

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">My competitors</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">The businesses you know compete with you. They stay on this list until you remove them.</p>
        </div>
        <Button type="button" onClick={() => setForm({ id: null, values: EMPTY })} disabled={full || mc.status !== "success"} data-testid="mc-add">
          <Plus className="size-4" aria-hidden /> Add competitor
        </Button>
      </div>

      <Panel
        title="Competitors you chose"
        description={full ? "The list is full. Remove one to add another." : undefined}
        action={<span className="pt-1 text-xs text-muted-foreground tabular-nums" data-testid="mc-count">{formatExact(mc.competitors.length)} of {formatExact(mc.limit)}</span>}
        className="min-w-0"
      >
        {mc.status === "loading" ? (
          <div className="space-y-2" aria-hidden>{Array.from({ length: 4 }, (_, i) => <Skel key={i} className="h-10 w-full" />)}</div>
        ) : mc.status === "error" ? (
          <SectionError message={mc.error?.message} onRetry={mc.refetch} />
        ) : mc.competitors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center" data-testid="mc-empty">
            <Users className="size-6 text-muted-foreground" aria-hidden />
            <p className="max-w-sm text-sm text-muted-foreground">No competitors yet. Add the businesses you already know, with a name, a website, or both.</p>
            <Button type="button" variant="outline" onClick={() => setForm({ id: null, values: EMPTY })}><Plus className="size-4" aria-hidden /> Add competitor</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {mc.competitors.length > 5 ? (
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setVisible(PAGE_SIZE) }} placeholder="Search competitors" aria-label="Search competitors" className="h-9 max-w-xs" />
            ) : null}
            {shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No competitor matches &ldquo;{search}&rdquo;.</p>
            ) : (
              <MyCompetitorsTable
                rows={shown}
                pending={mc.pending}
                expandedId={detailsId}
                onDetails={(c) => setDetailsId((id) => (id === c.id ? null : c.id))}
                onRefresh={refreshOne}
                onEdit={(c) => setForm({ id: c.id, values: { name: c.name, domain: c.domain ?? "", address: c.address ?? "", notes: c.notes ?? "" } })}
                onRemove={setRemoving}
                assessments={assessments}
                onOverride={onOverride}
                onClearOverride={onClearOverride}
                onReassess={onReassess}
              />
            )}
            {matches.length > shown.length ? (
              <div className="flex items-center justify-between gap-3 pt-1" data-testid="mc-more">
                <p className="text-xs text-muted-foreground tabular-nums" role="status">Showing {formatExact(shown.length)} of {formatExact(matches.length)}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Show {formatExact(Math.min(PAGE_SIZE, matches.length - shown.length))} more
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Panel>

      <CompetitorFormDialog
        key={form ? (form.id ?? "new") : "closed"}
        form={form}
        onClose={() => setForm(null)}
        onSave={async (id, values) => {
          const res = id ? await mc.edit(id, values) : await mc.add(values)
          if (res.ok) notify(id ? "Competitor updated." : "Competitor added.", "success")
          return res
        }}
      />

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>It will no longer be on your list. You can add it again later.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoving(null)}>Keep competitor</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                const target = removing
                setRemoving(null)
                const res = await mc.remove(target.id)
                notify(res.ok ? `${target.name} removed.` : res.message, res.ok ? "success" : "danger")
              }}
            >
              Remove competitor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

/** Add or edit. A name or a website is enough; the server cleans the website and refuses duplicates and your own site. */
export function CompetitorFormDialog({ form, onClose, onSave }) {
  const [values, setValues] = useState(form?.values ?? EMPTY)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const editing = !!form?.id
  const set = (key) => (e) => { setValues((v) => ({ ...v, [key]: e.target.value })); setError(null) }

  const submit = async (e) => {
    e.preventDefault()
    if (!values.name.trim() && !values.domain.trim()) { setError("Enter a name or a website."); return }
    setBusy(true)
    const res = await onSave(form.id, values)
    setBusy(false)
    if (res.ok) onClose()
    else setError(res.message)
  }

  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg" data-testid="mc-dialog">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit competitor" : "Add competitor"}</DialogTitle>
          <DialogDescription>A name or a website is enough. Add an address or a note if it helps you tell competitors apart.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field id="mc-name" label="Name"><Input id="mc-name" value={values.name} onChange={set("name")} maxLength={120} autoComplete="off" placeholder="Sunrise Eye Clinic" data-testid="mc-name" /></Field>
          <Field id="mc-domain" label="Website"><Input id="mc-domain" value={values.domain} onChange={set("domain")} autoComplete="off" placeholder="example.com" data-testid="mc-domain" /></Field>
          <Field id="mc-address" label="Address"><Input id="mc-address" value={values.address} onChange={set("address")} maxLength={300} autoComplete="off" /></Field>
          <Field id="mc-notes" label="Notes"><Textarea id="mc-notes" value={values.notes} onChange={set("notes")} maxLength={500} rows={3} /></Field>
          {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400" data-testid="mc-error">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} data-testid="mc-save">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {editing ? "Save changes" : "Add competitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ id, label, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}
