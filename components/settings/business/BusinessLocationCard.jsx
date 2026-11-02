"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2, MapPin, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import businessInfoService from "@/services/businessInfoService"
import LocationPickerMap from "./LocationPickerMap"
import { describeStatus, locationToBody, locationToForm, newSessionToken, parseCoordinate, placeToForm, sameForm, validateLocation } from "./businessInfoUi"

const MIN_CHARS = 3
const DEBOUNCE_MS = 350

const Field = ({ id, label, error, hint, children }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {error ? <p id={`${id}-error`} className="text-xs text-destructive" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>
)

/**
 * Business Location. Nothing here is saved until the user ticks "I confirm…" AND presses Save: picking a suggestion only fills the form and
 * moves the map. Suggestions are never auto-selected, the device location is never read, and a place that Google returns without
 * coordinates cannot be used. Autocomplete and place details go through our server (one session token per search -> pick).
 */
export default function BusinessLocationCard({ projectId, data, saving, onSave, onDirtyChange, notify }) {
  const baseline = useMemo(() => locationToForm(data?.location), [data?.location])
  const [form, setForm] = useState(baseline)
  const [confirmed, setConfirmed] = useState(false)
  const [adjusted, setAdjusted] = useState(false)
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState(null)

  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [searchState, setSearchState] = useState("idle") // idle | loading | done | error
  const [searchError, setSearchError] = useState(null)
  const [picking, setPicking] = useState(false)
  const [active, setActive] = useState(-1)
  const token = useRef(newSessionToken())
  const picked = useRef(null) // the coordinates Google gave for the picked place
  const requestSeq = useRef(0)

  // The saved location changed (a save, another project): the form follows it.
  useEffect(() => { setForm(baseline); setConfirmed(false); setAdjusted(false); setServerError(null); setTouched({}) }, [baseline])

  const dirty = !sameForm(form, baseline)
  const status = data?.verification?.status ?? "missing"
  const errors = validateLocation(form)
  const hasErrors = Object.keys(errors).length > 0
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  // Debounced address search: needs 3+ characters, only the latest answer is used, and nothing is searched while a place is being fetched.
  useEffect(() => {
    const text = query.trim()
    if (text.length < MIN_CHARS) { setSuggestions([]); setSearchState("idle"); setSearchError(null); return undefined }
    const seq = ++requestSeq.current
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setSearchState("loading"); setSearchError(null)
      try {
        const res = await businessInfoService.autocomplete(projectId, { input: text, sessionToken: token.current }, { signal: ctrl.signal })
        if (seq !== requestSeq.current) return
        setSuggestions(res?.data?.suggestions ?? []); setActive(-1); setSearchState("done")
      } catch (err) {
        if (ctrl.signal.aborted || seq !== requestSeq.current) return
        setSuggestions([]); setSearchState("error")
        setSearchError(err && typeof err.status === "number" && err.message ? err.message : "Address search is unavailable right now. You can enter the address and coordinates yourself.")
      }
    }, DEBOUNCE_MS)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query, projectId])

  const edit = (patch, { coordinates = false } = {}) => {
    setForm((f) => ({ ...f, ...patch }))
    setConfirmed(false)
    setServerError(null)
    if (coordinates) setAdjusted(true)
  }
  const touch = (name) => setTouched((t) => ({ ...t, [name]: true }))

  const pick = async (s) => {
    setPicking(true); setSearchError(null)
    try {
      const res = await businessInfoService.placeDetails(projectId, { placeId: s.placeId, sessionToken: token.current })
      const place = res?.data?.place
      if (!place) throw new Error("empty")
      picked.current = place.location
      setForm(placeToForm(place)); setConfirmed(false); setAdjusted(false); setServerError(null); setTouched({})
      setQuery(""); setSuggestions([]); setSearchState("idle")
      token.current = newSessionToken() // the session ended with this lookup
    } catch (err) {
      setSearchState("error")
      setSearchError(err && typeof err.status === "number" && err.message ? err.message : "That place could not be loaded. Try another suggestion.")
    } finally { setPicking(false) }
  }

  const onSearchKey = (e) => {
    if (!suggestions.length) return
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1)) }
    // Enter only picks a suggestion the user moved to - never the first one by default.
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(suggestions[active]) }
    else if (e.key === "Escape") { setSuggestions([]); setActive(-1) }
  }

  const lat = parseCoordinate(form.lat); const lng = parseCoordinate(form.lng)
  const position = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
  const onMarker = (p) => {
    const moved = picked.current ? picked.current.lat !== p.lat || picked.current.lng !== p.lng : true
    edit({ lat: String(p.lat), lng: String(p.lng) }, { coordinates: moved })
    touch("lat")
  }

  const canSave = confirmed && !hasErrors && !saving && (dirty || status !== "confirmed")
  const submit = async (e) => {
    e.preventDefault()
    setTouched({ address: true, lat: true, lng: true, countryCode: true })
    if (!canSave) return
    setServerError(null)
    const res = await onSave({ location: locationToBody(form, { confirmed, coordinatesAdjusted: adjusted }) })
    if (res.ok) notify?.("Business location saved", "success")
    else { setServerError(res.message); notify?.("Could not save the location", "danger") }
  }

  const s = describeStatus(status)
  const err = (name) => (touched[name] || serverError ? errors[name] : undefined)

  return (
    <Card data-testid="business-location-card">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Business location</CardTitle>
          <Badge variant={s.tone === "success" ? "success" : "secondary"} data-testid="location-status-badge">{s.label}</Badge>
        </div>
        <CardDescription>
          Where your business physically is. Local Competitors searches around this point, nowhere else. This is separate from the cities you want to rank in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {status === "unconfirmed" && !dirty ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-900/20" data-testid="location-unconfirmed-note">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{s.text}</p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="biz-search">Find your business or address</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="biz-search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} autoComplete="off" className="pl-9"
                placeholder="Type a business name or street address" role="combobox" aria-expanded={suggestions.length > 0} aria-controls="biz-suggestions" aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `biz-sug-${active}` : undefined} disabled={picking}
              />
              {searchState === "loading" || picking ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" /> : null}
              {suggestions.length > 0 ? (
                <ul id="biz-suggestions" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg" data-testid="location-suggestions">
                  {suggestions.map((s2, i) => (
                    <li key={s2.placeId} id={`biz-sug-${i}`} role="option" aria-selected={i === active}>
                      <button type="button" onClick={() => pick(s2)} onMouseEnter={() => setActive(i)} className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm ${i === active ? "bg-accent" : "hover:bg-accent"}`}>
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span><span className="font-medium">{s2.primary || s2.text}</span>{s2.secondary ? <span className="block text-xs text-muted-foreground">{s2.secondary}</span> : null}</span>
                      </button>
                    </li>
                  ))}
                  <li className="px-3 py-1 text-[10px] text-muted-foreground" aria-hidden>Suggestions by Google</li>
                </ul>
              ) : null}
            </div>
            {searchState === "done" && suggestions.length === 0 && query.trim().length >= MIN_CHARS ? (
              <p className="text-xs text-muted-foreground" data-testid="location-no-results">No places found. Try a different spelling, or enter the address and coordinates below.</p>
            ) : null}
            {searchError ? <p className="text-xs text-destructive" role="alert" data-testid="location-search-error">{searchError}</p> : null}
            <p className="text-xs text-muted-foreground">Pick a suggestion to fill the form below. Nothing is saved until you confirm it.</p>
          </div>

          <LocationPickerMap position={position} onChange={onMarker} confirmed={status === "confirmed" && !dirty} />
          <p className="-mt-3 text-xs text-muted-foreground">Drag the marker, click the map, or use the arrow keys on the marker to adjust the exact position.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="biz-address" label="Full address" error={err("address")}>
                <Input id="biz-address" value={form.address} onChange={(e) => edit({ address: e.target.value })} onBlur={() => touch("address")} aria-invalid={!!err("address")} aria-describedby={err("address") ? "biz-address-error" : undefined} maxLength={300} />
              </Field>
            </div>
            <Field id="biz-line" label="Address line"><Input id="biz-line" value={form.addressLine} onChange={(e) => edit({ addressLine: e.target.value })} maxLength={200} /></Field>
            <Field id="biz-city" label="City"><Input id="biz-city" value={form.city} onChange={(e) => edit({ city: e.target.value })} maxLength={100} /></Field>
            <Field id="biz-state" label="State / region"><Input id="biz-state" value={form.state} onChange={(e) => edit({ state: e.target.value })} maxLength={100} /></Field>
            <Field id="biz-postal" label="Postal code"><Input id="biz-postal" value={form.postalCode} onChange={(e) => edit({ postalCode: e.target.value })} maxLength={20} /></Field>
            <Field id="biz-country" label="Country"><Input id="biz-country" value={form.country} onChange={(e) => edit({ country: e.target.value })} maxLength={100} /></Field>
            <Field id="biz-cc" label="Country code" error={err("countryCode")} hint="Two letters, for example IN">
              <Input id="biz-cc" value={form.countryCode} onChange={(e) => edit({ countryCode: e.target.value.toUpperCase() })} onBlur={() => touch("countryCode")} maxLength={2} aria-invalid={!!err("countryCode")} aria-describedby={err("countryCode") ? "biz-cc-error" : undefined} />
            </Field>
            <Field id="biz-lat" label="Latitude" error={err("lat")}>
              <Input id="biz-lat" inputMode="decimal" value={form.lat} onChange={(e) => edit({ lat: e.target.value }, { coordinates: true })} onBlur={() => touch("lat")} aria-invalid={!!err("lat")} aria-describedby={err("lat") ? "biz-lat-error" : undefined} />
            </Field>
            <Field id="biz-lng" label="Longitude" error={err("lng")}>
              <Input id="biz-lng" inputMode="decimal" value={form.lng} onChange={(e) => edit({ lng: e.target.value }, { coordinates: true })} onBlur={() => touch("lng")} aria-invalid={!!err("lng")} aria-describedby={err("lng") ? "biz-lng-error" : undefined} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="biz-place" label="Google Place ID" hint={form.placeId ? "Set by the Google place you picked. Clear it if this is not that place." : "None. This location was entered by hand."}>
                <div className="flex gap-2">
                  <Input id="biz-place" value={form.placeId} readOnly className="font-mono text-xs" />
                  {form.placeId ? <Button type="button" variant="outline" size="sm" onClick={() => edit({ placeId: "" })}>Clear</Button> : null}
                </div>
              </Field>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4" data-testid="location-confirm" />
            <span>
              <span className="font-medium">I confirm this is where my business is located.</span>
              <span className="block text-xs text-muted-foreground">This confirms the location only. It does not verify ownership of a Google Business Profile.</span>
            </span>
          </label>

          {serverError ? <p className="text-sm text-destructive" role="alert" data-testid="location-save-error">{serverError}</p> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!canSave} data-testid="location-save">
              {saving ? <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden />Saving…</> : dirty ? "Save location" : "Confirm location"}
            </Button>
            {dirty ? <Button type="button" variant="ghost" onClick={() => { setForm(baseline); setConfirmed(false); setAdjusted(false); setTouched({}) }}>Discard changes</Button> : null}
            {dirty ? <span className="text-xs text-muted-foreground" data-testid="location-dirty">Unsaved changes</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
