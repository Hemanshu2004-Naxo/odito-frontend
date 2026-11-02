"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { INDUSTRIES } from "@/lib/industries"
import TagInput from "./TagInput"
import { identityToBody, identityToForm, sameForm, validateIdentity } from "./businessInfoUi"

const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const Field = ({ id, label, error, hint, children }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>
)

/** Business Identity: the project's own words for what the business is and does. Saved on its own, apart from the location. */
export default function BusinessIdentityCard({ data, saving, onSave, onDirtyChange, notify }) {
  const baseline = useMemo(() => identityToForm(data?.identity), [data?.identity])
  const [form, setForm] = useState(baseline)
  const [serverError, setServerError] = useState(null)
  useEffect(() => { setForm(baseline); setServerError(null) }, [baseline])

  const dirty = !sameForm(form, baseline)
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  const errors = validateIdentity(form)
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setServerError(null) }
  // An older project can hold free text that is not in the list: keep showing it instead of silently dropping it.
  const legacyIndustry = form.industry && !INDUSTRIES.some((i) => i.value === form.industry)

  const submit = async (e) => {
    e.preventDefault()
    if (!dirty || Object.keys(errors).length || saving) return
    const res = await onSave({ identity: identityToBody(form) })
    if (res.ok) notify?.("Business information saved", "success")
    else { setServerError(res.message); notify?.("Could not save business information", "danger") }
  }

  return (
    <Card data-testid="business-identity-card">
      <CardHeader>
        <CardTitle className="text-lg">Business identity</CardTitle>
        <CardDescription>What your business is and offers. Odito uses this to judge which competitors are relevant.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="biz-name" label="Business name" error={errors.businessName}>
              <Input id="biz-name" value={form.businessName} onChange={(e) => set({ businessName: e.target.value })} maxLength={200} />
            </Field>
            <Field id="biz-site" label="Website" hint="The project's website. It is set when the project is created.">
              <Input id="biz-site" value={data?.identity?.website ?? ""} readOnly disabled />
            </Field>
            <Field id="biz-industry" label="Industry">
              <select id="biz-industry" className={SELECT} value={form.industry} onChange={(e) => set({ industry: e.target.value })}>
                <option value="">Not set</option>
                {legacyIndustry ? <option value={form.industry}>{form.industry} (older entry)</option> : null}
                {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </Field>
            <Field id="biz-sub" label="Sub-industry" error={errors.subIndustry} hint="The specific kind of business, for example “eye hospital”.">
              <Input id="biz-sub" value={form.subIndustry} onChange={(e) => set({ subIndustry: e.target.value })} maxLength={100} />
            </Field>
            <Field id="biz-type" label="Business type" error={errors.businessType} hint="How the business operates, for example “clinic” or “online store”.">
              <Input id="biz-type" value={form.businessType} onChange={(e) => set({ businessType: e.target.value })} maxLength={200} />
            </Field>
            <Field id="biz-primary" label="Primary category" error={errors.primaryCategory}>
              <Input id="biz-primary" value={form.primaryCategory} onChange={(e) => set({ primaryCategory: e.target.value })} maxLength={100} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="biz-secondary" label="Secondary categories" error={errors.secondaryCategories} hint="Press Enter to add. Up to 10.">
                <TagInput id="biz-secondary" values={form.secondaryCategories} onChange={(v) => set({ secondaryCategories: v })} max={10} placeholder="Add a category" ariaLabel="Secondary categories" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="biz-services" label="Services" error={errors.services} hint="What you offer. Press Enter to add. Up to 30.">
                <TagInput id="biz-services" values={form.services} onChange={(v) => set({ services: v })} max={30} placeholder="Add a service" ariaLabel="Services" />
              </Field>
            </div>
          </div>

          {serverError ? <p className="text-sm text-destructive" role="alert" data-testid="identity-save-error">{serverError}</p> : null}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!dirty || saving || Object.keys(errors).length > 0} data-testid="identity-save">
              {saving ? <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden />Saving…</> : "Save business information"}
            </Button>
            {dirty ? <Button type="button" variant="ghost" onClick={() => setForm(baseline)}>Discard changes</Button> : null}
            {dirty ? <span className="text-xs text-muted-foreground" data-testid="identity-dirty">Unsaved changes</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
