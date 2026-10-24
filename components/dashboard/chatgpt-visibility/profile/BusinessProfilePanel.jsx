"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBusinessProfile, useSaveBusinessProfile, useGenerateDraft } from "@/hooks/useAiVisibilityQuestions"
import { ErrorNote, Notice, Panel, Pill } from "../parts"
import { describeQuestionError, MISSING_INFO_TEXT, PROFILE_WARNING_TEXT } from "../format"
import ListField from "../questions/ListField"
import { LANGUAGES, LIMITS } from "../questions/inputs"

/**
 * The business profile questions are built from. Everything shown comes from GET .../profile; saving sends ONLY the fields the user changed
 * (PUT .../profile), and the server re-validates. Suggestions (services from the Social AI profile, a city from the project's location or
 * Google listing) are shown apart and are used only when the user accepts them - nothing is confirmed on the user's behalf.
 */

const LISTS = [
  { key: "services", label: "Services", hint: "What you offer, one per entry.", placeholder: "e.g. Cataract surgery…" },
  { key: "targetCities", label: "Other target cities", hint: "Only cities you want to be found in, besides the main one.", placeholder: "e.g. Pune…" },
  { key: "serviceAreas", label: "Areas served", hint: "Neighbourhoods or districts you serve.", placeholder: "e.g. Andheri…" },
  { key: "customerTypes", label: "Customer types", hint: "Who you serve.", placeholder: "e.g. elderly patients…" },
  { key: "customerProblems", label: "Customer problems", hint: "As a customer would describe them.", placeholder: "e.g. blurred vision…" },
  { key: "requirements", label: "Requirements customers ask for", hint: "Only capabilities you really have.", placeholder: "e.g. cashless insurance…" },
  { key: "buyingRequirements", label: "Buying requirements you meet", hint: "Only what you can confirm.", placeholder: "e.g. follow-up care…" },
]

const toForm = (d) => ({
  industry: d?.project?.industry || "",
  subIndustry: d?.project?.subIndustry || "",
  targetCity: d?.project?.targetCity || "",
  language: d?.confirmed?.language || "en",
  ...Object.fromEntries(LISTS.map(({ key }) => [key, d?.confirmed?.[key] || []])),
})

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

/** Only what changed, in the API's field names; an emptied text field is sent as null (an explicit clear). */
export function profileChanges(initial, form) {
  const out = {}
  for (const k of ["industry", "subIndustry", "targetCity"]) {
    if ((form[k] || "").trim() !== (initial[k] || "").trim()) out[k] = form[k].trim() || null
  }
  if (form.language !== initial.language) out.language = form.language
  for (const { key } of LISTS) if (!sameList(form[key], initial[key])) out[key] = form[key]
  return out
}

export default function BusinessProfilePanel({ projectId, onGenerated, showGenerate = true }) {
  const router = useRouter()
  const { data, isLoading, error } = useBusinessProfile(projectId)
  const save = useSaveBusinessProfile(projectId)
  const generate = useGenerateDraft(projectId)
  const d = data?.data
  const initial = useMemo(() => toForm(d), [d])
  const [form, setForm] = useState(initial)
  const seed = JSON.stringify(initial)
  // Re-seed when the server's profile changes (after a save or a refetch) - never while the user has unsaved edits of their own.
  const [seededFrom, setSeededFrom] = useState(seed)
  useEffect(() => { if (seed !== seededFrom) { setForm(initial); setSeededFrom(seed) } }, [seed]) // eslint-disable-line react-hooks/exhaustive-deps
  // Computed before any early return so the hook below always runs in the same order.
  const changes = profileChanges(initial, form)
  const dirty = Object.keys(changes).length > 0
  useUnsavedWarning(dirty)
  // Computed before any early return so the hook below always runs in the same order.

  if (isLoading) return <div className="h-64 rounded-xl skeleton-base skeleton-shimmer" aria-busy="true" />
  if (error) return <ErrorNote>{describeQuestionError(error)}</ErrorNote>
  if (!d) return null

  const fieldErrors = save.error?.details?.fields || {}
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const c = d.completeness
  const conflict = c.conflicts?.[0]

  const onSave = () => { if (dirty) save.mutate(changes) }
  const onGenerate = () => generate.mutate(undefined, {
    onSuccess: (res) => {
      const id = res?.data?.id
      if (onGenerated) onGenerated(id)
      else if (id) router.push(`/app/chatgpt-visibility/questions/${id}`)
    },
  })

  return (
    <Panel
      title="Business profile"
      description="The confirmed details questions are written from. Discovery questions never name your business; they use only what you confirm here."
      action={c.ready && !dirty ? <Pill tone="success">Ready for questions</Pill> : <Pill tone="warn">{dirty ? "Unsaved changes" : "Needs attention"}</Pill>}
    >
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onSave() }} noValidate>
        <section aria-label="Project" className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            <div><dt className="inline text-muted-foreground">Business: </dt><dd className="inline">{d.project.name || "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">Website: </dt><dd className="inline break-all">{d.project.website || "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">How it operates: </dt><dd className="inline">{d.project.businessType || "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">Listed (physical) city: </dt><dd className="inline">{d.project.physicalCity || "—"}</dd></div>
          </dl>
          {d.project.legacyIndustryText ? (
            <p className="mt-2 text-xs text-muted-foreground">Previously saved as the industry: “{d.project.legacyIndustryText}”. Choose the industry below; it is not changed automatically.</p>
          ) : null}
        </section>

        {conflict ? (
          <ErrorNote>
            Two different cities are on record for this project: “{conflict.values[0]}” and “{conflict.values[1]}”. Confirm the main target city below; questions are not generated until you do.
          </ErrorNote>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bp-industry" className="text-sm font-medium">Industry</label>
            <select
              id="bp-industry" value={form.industry} onChange={(e) => set("industry")(e.target.value)}
              aria-invalid={fieldErrors.industry ? true : undefined}
              className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Choose an industry</option>
              {d.industries.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
            {fieldErrors.industry ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.industry}</p> : null}
          </div>
          <div>
            <label htmlFor="bp-sub" className="text-sm font-medium">Kind of business</label>
            <Input id="bp-sub" name="subIndustry" autoComplete="off" className="mt-2" value={form.subIndustry} placeholder="e.g. eye hospital…" maxLength={LIMITS.itemLength}
              aria-invalid={fieldErrors.subIndustry ? true : undefined} onChange={(e) => set("subIndustry")(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">As a customer would say it. Used in every question.</p>
            {fieldErrors.subIndustry ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.subIndustry}</p> : null}
          </div>
          <div>
            <label htmlFor="bp-city" className="text-sm font-medium">Main target city</label>
            <Input id="bp-city" name="targetCity" autoComplete="address-level2" className="mt-2" value={form.targetCity} placeholder="e.g. Mumbai…" maxLength={LIMITS.itemLength}
              aria-invalid={fieldErrors.targetCity ? true : undefined} onChange={(e) => set("targetCity")(e.target.value)} />
            {d.suggestions.city && !form.targetCity ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Suggested: {d.suggestions.city.value} ({SOURCE_TEXT[d.suggestions.city.source] || "from the project"}).{" "}
                <button type="button" className="underline underline-offset-2" onClick={() => set("targetCity")(d.suggestions.city.value)}>Use it</button>
              </p>
            ) : <p className="mt-1 text-xs text-muted-foreground">Where you want to be found. It may differ from where you are listed.</p>}
            {fieldErrors.targetCity ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.targetCity}</p> : null}
          </div>
          <div>
            <label htmlFor="bp-lang" className="text-sm font-medium">Question language</label>
            <select id="bp-lang" value={form.language} onChange={(e) => set("language")(e.target.value)} className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {d.suggestions.services?.length && !form.services.length ? (
          <Notice>
            Suggested services from your <Link className="underline underline-offset-2" href="/app/social-media/business-profile">Social Media business profile</Link>: {d.suggestions.services.join(", ")}.{" "}
            <button type="button" className="font-medium underline underline-offset-2" onClick={() => set("services")(d.suggestions.services.slice(0, LIMITS.listItems))}>Confirm these</button>
          </Notice>
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {LISTS.map((f) => (
            <ListField key={f.key} id={`bp-${f.key}`} label={f.label} hint={f.hint} placeholder={f.placeholder}
              value={form[f.key]} onChange={set(f.key)} error={fieldErrors[f.key]} disabled={save.isPending} />
          ))}
        </div>

        {c.missingForQuestions?.length ? (
          <p className="text-sm text-muted-foreground">
            Not confirmed yet: {c.missingForQuestions.map((m) => MISSING_INFO_TEXT[m] || m).join(", ")}. Questions that need them are skipped, never invented.
          </p>
        ) : null}
        {(c.warnings || []).filter((w) => PROFILE_WARNING_TEXT[w]).map((w) => <p key={w} className="text-xs text-muted-foreground">{PROFILE_WARNING_TEXT[w]}</p>)}

        {save.error ? <ErrorNote>{describeQuestionError(save.error)}</ErrorNote> : null}
        {generate.error ? <ErrorNote>{describeQuestionError(generate.error)}</ErrorNote> : null}
        {save.isSuccess && !dirty ? <Notice tone="success">Saved.</Notice> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
          {showGenerate ? (
            <Button type="button" variant="outline" disabled={dirty || !c.ready || generate.isPending} onClick={onGenerate}>
              {generate.isPending ? "Generating…" : "Generate draft questions"}
            </Button>
          ) : null}
          {dirty ? <span className="text-xs text-muted-foreground">Save your changes before generating questions.</span> : null}
        </div>
      </form>
    </Panel>
  )
}

/** Ask before leaving the page with unsaved profile edits. */
function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])
}

const SOURCE_TEXT = {
  "project.location": "from the location you entered",
  "verified_business.city": "from your Google listing",
  "verified_business.city_unverified": "from your website, unconfirmed",
}
