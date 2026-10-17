// Pure helpers for the "Confirm Address" form. No React, no network.
//
// The server is the authority: it re-validates everything (odito_backend .../schema-evidence/organizationAddress.js,
// validateConfirmedAddressInput). These checks only give the owner an immediate, specific message; they mirror the same limits.

import { ADDRESS_FIELDS } from "./organizationIntent"

export const FIELD_LIMITS = Object.freeze({
  streetAddress: { required: true, min: 4, max: 200, label: "Street address" },
  addressLocality: { required: true, min: 2, max: 100, label: "City / locality" },
  addressRegion: { required: false, min: 1, max: 100, label: "State / region" },
  postalCode: { required: false, min: 1, max: 20, label: "Postal code" },
  addressCountry: { required: false, min: 1, max: 60, label: "Country" },
})

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F]/g
const BAD_CHARS = /[<>{}[\]\\`]/
const POSTAL = /^[A-Za-z0-9][A-Za-z0-9 -]{1,18}[A-Za-z0-9]$/

export const emptyAddressForm = () => ({ streetAddress: "", addressLocality: "", addressRegion: "", postalCode: "", addressCountry: "" })

/** A form prefilled from a candidate/suggestion's fields (only the five known keys; nothing is invented). */
export function formFromFields(fields) {
  const out = emptyAddressForm()
  for (const f of ADDRESS_FIELDS) if (typeof fields?.[f] === "string") out[f] = fields[f]
  return out
}

const clean = (v) => String(v ?? "").replace(CONTROL, " ").replace(/\s+/g, " ").trim()

/** @returns {{ok: boolean, errors: Record<string,string>, fields: Record<string,string>}} fields = trimmed non-empty values in canonical order */
export function validateAddressForm(form) {
  const errors = {}
  const fields = {}
  for (const f of ADDRESS_FIELDS) {
    const { required, min, max, label } = FIELD_LIMITS[f]
    const v = clean(form?.[f])
    if (!v) { if (required) errors[f] = `${label} is required`; continue }
    if (BAD_CHARS.test(v)) errors[f] = `${label} contains characters that are not allowed`
    else if (v.length < min) errors[f] = `${label} is too short`
    else if (v.length > max) errors[f] = `${label} must be ${max} characters or fewer`
    else if (f === "postalCode" && !POSTAL.test(v)) errors[f] = "Postal code may contain only letters, digits, spaces and hyphens"
    else fields[f] = v
  }
  return { ok: Object.keys(errors).length === 0, errors, fields }
}

/** True when the form differs from the candidate it was prefilled from (so a picked source no longer describes it). */
export const formEquals = (a, b) => ADDRESS_FIELDS.every((f) => clean(a?.[f]) === clean(b?.[f]))
