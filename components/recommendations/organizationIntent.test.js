import { describe, test, expect } from "vitest"
import { extractIntentCode, getOrganizationIntentModel } from "./organizationIntent"

const meta = (intent, over = {}) => ({
  schemaEvidence: {
    kinds: ["organization"],
    organization: {
      present: false, intent, name: { value: "Clinic Eye Centre", source: "og:site_name" },
      factSources: { address: "site_entity_markup", telephone: "google_business_profile" },
      site: null, businessProfile: { available: true, trusted: true, reason: null }, logo: { status: "verified", verifiedUrl: "https://clinic.example/logo.png" },
      ...over,
    },
  },
})
const intent = (over = {}) => ({ intent: "hospital_schema", action: "generate", type: "Hospital", types: ["Hospital", "Organization"], scope: "homepage", placement: "this_page", reasons: ["The site's own markup identifies a Hospital."], notes: [], missing: [], optional: [], id: "https://clinic.example/#organization", reuse: null, ...over })

describe("getOrganizationIntentModel", () => {
  test("applies only to organization issues that carry an intent (older responses fall back to the generic panel)", () => {
    expect(getOrganizationIntentModel("organization_schema", meta(intent())).applies).toBe(true)
    expect(getOrganizationIntentModel("primary_organization_schema", meta(intent())).applies).toBe(true)
    expect(getOrganizationIntentModel("breadcrumblist_schema", meta(intent())).applies).toBe(false)
    expect(getOrganizationIntentModel("organization_schema", { schemaEvidence: { kinds: ["organization"] } }).applies).toBe(false)
    expect(getOrganizationIntentModel("organization_schema", null).applies).toBe(false)
  })

  test("the type, state and facts-with-sources come from the server decision — nothing is derived in the browser", () => {
    const m = getOrganizationIntentModel("organization_schema", meta(intent()))
    expect(m.type).toBe("Hospital")
    expect(m.intentLabel).toBe("Hospital")
    expect(m.state).toBe("generate")
    expect(m.hasCode).toBe(true)
    expect(m.needsNoTask).toBe(false)
    expect(m.factsUsed).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Name", value: "Clinic Eye Centre", source: "the og:site_name tag" }),
      expect.objectContaining({ label: "Address", source: "the site's existing entity markup" }),
      expect.objectContaining({ label: "Telephone", source: expect.stringContaining("Google Business Profile") }),
      expect.objectContaining({ label: "Logo" }),
    ]))
  })

  test("needs_input / reuse / reference never carry code and need no task", () => {
    for (const action of ["needs_input", "reuse", "reference"]) {
      const m = getOrganizationIntentModel("organization_schema", meta(intent({ action, missing: action === "needs_input" ? [{ field: "address", label: "Street address", why: "x" }] : [] })))
      expect(m.hasCode).toBe(false)
      expect(m.needsNoTask).toBe(true)
    }
  })

  test("an untrusted Business Profile is reported as such", () => {
    const m = getOrganizationIntentModel("organization_schema", meta(intent(), { businessProfile: { available: true, trusted: false, reason: "profile_website_is_a_different_site" } }))
    expect(m.profile).toEqual({ trusted: false, available: true, reason: "profile_website_is_a_different_site" })
  })

  test("extractIntentCode returns the script block only when there is one", () => {
    const rec = (content) => ({ sections: { implementationExample: { content } } })
    expect(extractIntentCode(rec('<script type="application/ld+json">{}</script>'))).toContain("<script")
    expect(extractIntentCode(rec("<!-- ODITO: needs your input -->"))).toBeNull()
    expect(extractIntentCode({})).toBeNull()
  })
})
