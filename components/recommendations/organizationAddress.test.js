import { describe, test, expect } from "vitest"
import { emptyAddressForm, formEquals, formFromFields, validateAddressForm } from "./organizationAddress"
import { getAddressFixModel, getOrganizationIntentModel } from "./organizationIntent"

// TEST DATA ONLY — fictional business and address.
const GOOD = { streetAddress: "14 Lakeview Road", addressLocality: "Rivertown", addressRegion: "Karnataka", postalCode: "560001", addressCountry: "IN" }

describe("validateAddressForm — immediate, specific messages (the server re-validates everything)", () => {
  test("a full address is accepted, trimmed, in canonical order", () => {
    const v = validateAddressForm({ ...GOOD, streetAddress: "  14   Lakeview Road  " })
    expect(v.ok).toBe(true)
    expect(Object.keys(v.fields)).toEqual(["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"])
    expect(v.fields.streetAddress).toBe("14 Lakeview Road")
  })

  test("street and city are required; the rest is optional and is never filled in", () => {
    const v = validateAddressForm({ ...emptyAddressForm(), streetAddress: "14 Lakeview Road", addressLocality: "Rivertown" })
    expect(v.ok).toBe(true)
    expect(v.fields).toEqual({ streetAddress: "14 Lakeview Road", addressLocality: "Rivertown" })
    expect(validateAddressForm(emptyAddressForm()).errors).toEqual({ streetAddress: "Street address is required", addressLocality: "City / locality is required" })
  })

  test("markup, over-long and malformed values are rejected with the field's own message", () => {
    expect(validateAddressForm({ ...GOOD, streetAddress: "<b>x</b>" }).errors.streetAddress).toMatch(/not allowed/)
    expect(validateAddressForm({ ...GOOD, streetAddress: "x".repeat(201) }).errors.streetAddress).toMatch(/200/)
    expect(validateAddressForm({ ...GOOD, addressLocality: "a" }).errors.addressLocality).toMatch(/too short/)
    expect(validateAddressForm({ ...GOOD, postalCode: "56{0}001" }).errors.postalCode).toBeTruthy()
    expect(validateAddressForm({ ...GOOD, postalCode: "SW1A 1AA" }).ok).toBe(true)
  })

  test("formFromFields takes only the five known keys; formEquals ignores whitespace-only differences", () => {
    const f = formFromFields({ ...GOOD, extra: "ignored", streetAddress: GOOD.streetAddress })
    expect("extra" in f).toBe(false)
    expect(formEquals(f, { ...GOOD, streetAddress: "  14 Lakeview Road " })).toBe(true)
    expect(formEquals(f, { ...GOOD, postalCode: "560002" })).toBe(false)
  })
})

describe("getAddressFixModel — the server's contract, never re-derived", () => {
  const base = { version: 1, kind: "organization_address", entity: { id: "https://eye-hospital.example/#organization", types: ["Organization"] }, currentState: { addressState: "missing", fields: {}, missingParts: [], confirmedByEvidence: true }, evidence: { candidates: [], alternatives: [], suggestion: null, notes: [] }, requiresApproval: true, modifiesWebsite: false, validation: { valid: true, errors: [] } }

  test("state -> action: ready=Review & Apply; confirmation / conflict / nothing found=Confirm Address; review=Review Changes", () => {
    const view = (state) => getAddressFixModel({ ...base, state })
    expect([view("ready").action, view("ready").actionLabel]).toEqual(["review_and_apply", "Review & Apply"])
    for (const s of ["needs_confirmation", "conflict", "unavailable"]) expect([view(s).action, view(s).actionLabel]).toEqual(["confirm_address", "Confirm Address"])
    expect([view("needs_review").action, view("needs_review").actionLabel]).toEqual(["review_changes", "Review Changes"])
    expect(view("something_new").action).toBe("review_changes") // an unknown state is never treated as ready
  })

  test("a rejected proposal is dropped (no value to apply), and not an address contract at all is null", () => {
    const m = getAddressFixModel({ ...base, state: "needs_review", proposal: { status: "rejected", value: { streetAddress: "x" } } })
    expect(m.proposal).toBeNull()
    expect(getAddressFixModel(null)).toBeNull()
    expect(getAddressFixModel({ kind: "other" })).toBeNull()
  })

  test("candidates carry their provenance and an unverified one is labelled as not used as evidence", () => {
    const m = getAddressFixModel({ ...base, state: "needs_confirmation", evidence: { ...base.evidence, candidates: [
      { id: "a1", source: "google_business_profile", trust: "verified_integration", kind: "external", fields: { streetAddress: "14 Lakeview Road" }, formatted: "14 Lakeview Road", structured: true, complete: false },
      { id: "a2", source: "website_extraction", trust: "unverified", kind: "external", fields: {}, formatted: "14 Lakeview Road, Rivertown", structured: false, complete: false },
    ] } })
    expect(m.candidates[0]).toMatchObject({ sourceLabel: "your connected Google Business Profile", trust: "Verified for this website", trustTone: "ok" })
    expect(m.candidates[1]).toMatchObject({ trust: "Not verified — not used as evidence", trustTone: "warn", structured: false })
  })

  test("an address finding only needs a task when it is READY", () => {
    const meta = (state) => ({ schemaEvidence: { organization: { intent: { intent: "organization_schema", action: "generate", type: "Organization", types: ["Organization"], reasons: [] }, name: null, factSources: {}, logo: {}, addressFix: { ...base, state } } } })
    expect(getOrganizationIntentModel("organization_schema", meta("ready")).needsNoTask).toBe(false)
    for (const s of ["needs_confirmation", "conflict", "unavailable", "needs_review"]) expect(getOrganizationIntentModel("organization_schema", meta(s)).needsNoTask).toBe(true)
  })

  test("every other Organization finding is unchanged (no addressFix)", () => {
    const m = getOrganizationIntentModel("organization_schema", { schemaEvidence: { organization: { intent: { intent: "schema_already_present", action: "reuse", type: "Organization", types: ["Organization"], reasons: [] }, name: null, factSources: {}, logo: {} } } })
    expect(m.addressFix).toBeNull()
    expect(m.state).toBe("reuse")
  })
})
