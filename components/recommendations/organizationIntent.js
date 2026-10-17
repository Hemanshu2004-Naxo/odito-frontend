// Pure helpers for the Organization / LocalBusiness / Hospital recommendation. No React, no network.
//
// The server decides WHICH entity to recommend (see odito_backend/.../schema-evidence/schemaIntent.js) from verified
// evidence and sends the decision as `meta.schemaEvidence.organization.intent`. The browser never re-derives a type or a
// fact: it only explains the decision and shows what the server built.

export const ORGANIZATION_ISSUE_IDS = ["organization_schema", "primary_organization_schema"]

const FACT_LABEL = {
  telephone: "Telephone", email: "Email", address: "Address", geo: "Map coordinates", hasMap: "Map link",
  openingHoursSpecification: "Opening hours", openingHours: "Opening hours", priceRange: "Price range",
  areaServed: "Service area", contactPoint: "Contact point", faxNumber: "Fax", sameAs: "Profile links",
}

const SOURCE_LABEL = {
  page_markup: "this page's own markup",
  site_entity_markup: "the site's existing entity markup",
  site_place_markup: "the site's Place markup",
  google_business_profile: "your connected Google Business Profile (verified for this website)",
  existing_organization_schema: "this page's entity markup",
  existing_website_schema: "the site's WebSite markup",
  "og:site_name": "the og:site_name tag",
  site_entity_schema: "the site's existing entity markup",
}

const INTENT_LABEL = {
  organization_schema: "Organization",
  local_business_schema: "Local business",
  hospital_schema: "Hospital",
  schema_already_present: "Existing entity",
}

const STATE_LABEL = {
  generate: "Markup generated",
  reuse: "Already in place",
  reference: "Not needed on this page",
  needs_input: "Information needed",
}

/**
 * state: generate | reuse | reference | needs_input | none
 * `applies` is false for any other issue, and for an older response without an intent (the generic panel is used).
 */
export function getOrganizationIntentModel(issueId, meta) {
  const org = meta?.schemaEvidence?.organization
  const intent = org?.intent
  if (!ORGANIZATION_ISSUE_IDS.includes(issueId) || !intent) return { applies: false, state: "none" }

  const factsUsed = []
  if (org.name?.value) factsUsed.push({ label: "Name", value: org.name.value, source: SOURCE_LABEL[org.name.source] || org.name.source })
  for (const [field, source] of Object.entries(org.factSources || {})) {
    factsUsed.push({ label: FACT_LABEL[field] || field, source: SOURCE_LABEL[source] || source })
  }
  if (org.logo?.verifiedUrl) factsUsed.push({ label: "Logo", value: org.logo.verifiedUrl, source: "fetched and confirmed as an image" })

  const profile = org.businessProfile
  const addressFix = org.addressFix || null
  return {
    applies: true,
    // The typed, server-validated "this Organization has no (complete) address" contract; null for every other Organization finding.
    addressFix: addressFix ? getAddressFixModel(addressFix) : null,
    state: intent.action,
    intent: intent.intent,
    intentLabel: INTENT_LABEL[intent.intent] || "Schema",
    stateLabel: STATE_LABEL[intent.action] || "",
    type: intent.type,
    types: intent.types || [intent.type],
    scope: intent.scope,
    placement: intent.placement,
    reasons: intent.reasons || [],
    notes: intent.notes || [],
    missing: intent.missing || [],
    optional: intent.optional || [],
    delta: intent.delta || [],
    extending: intent.mode === "extend_existing",
    reuse: intent.reuse ? { id: intent.reuse.id || intent.id || null, pageUrl: intent.reuse.pageUrl || null, reason: intent.reuse.reason || "" } : null,
    id: intent.id || null,
    factsUsed,
    profile: profile ? { trusted: !!profile.trusted, available: !!profile.available, reason: profile.reason || null } : null,
    hasCode: intent.action === "generate",
    // An address finding is judged by its contract: only a READY one is something a task can be created for.
    needsNoTask: addressFix ? addressFix.state !== "ready" : ["needs_input", "reuse", "reference"].includes(intent.action),
  }
}

// ── The address finding ───────────────────────────────────────────────────────────────────────────────────────────

export const ADDRESS_FIELDS = ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"]
export const ADDRESS_FIELD_LABEL = {
  streetAddress: "Street address", addressLocality: "City / locality", addressRegion: "State / region", postalCode: "Postal code", addressCountry: "Country",
}

const ADDRESS_SOURCE_LABEL = {
  user_confirmed: "confirmed by you in ODITO",
  page_entity_markup: "this page's Organization markup",
  page_place_markup: "a Place linked from this page's markup",
  site_entity_markup: "the site's Organization markup on another page",
  site_place_markup: "the site's Place markup",
  site_location_entity: "a separate location entity published on your site",
  google_business_profile: "your connected Google Business Profile",
  verified_business: "the business you selected when creating this project (Google Places)",
  owner_profile: "the business details you entered in ODITO (Social Media profile)",
  website_extraction: "text extracted from your website when the project was created",
}

const TRUST_LABEL = {
  user_confirmed: { label: "Confirmed by you", tone: "ok" },
  site_markup: { label: "Published on your site", tone: "ok" },
  verified_integration: { label: "Verified for this website", tone: "ok" },
  owner_provided: { label: "Entered by you", tone: "ok" },
  unverified: { label: "Not verified — not used as evidence", tone: "warn" },
}

const KIND_LABEL = {
  organization: "The organization's own address",
  place: "A place linked to the organization",
  branch: "A separate location (branch)",
  external: "A business listing",
  confirmed: "Confirmed by you",
}

// state -> what the screen offers. Review & Apply only for a validated, READY proposal; anything the owner must settle is Confirm Address.
const STATE_VIEW = {
  ready: { action: "review_and_apply", actionLabel: "Review & Apply", chip: "Ready to review", tone: "ok" },
  needs_confirmation: { action: "confirm_address", actionLabel: "Confirm Address", chip: "Confirmation needed", tone: "warn" },
  conflict: { action: "confirm_address", actionLabel: "Confirm Address", chip: "Addresses conflict", tone: "warn" },
  unavailable: { action: "confirm_address", actionLabel: "Confirm Address", chip: "No address found", tone: "warn" },
  needs_review: { action: "review_changes", actionLabel: "Review Changes", chip: "Needs review", tone: "bad" },
}

const addressText = (fields) => ADDRESS_FIELDS.map((f) => fields?.[f]).filter(Boolean).join(", ")

/** The address contract (meta.schemaEvidence.organization.addressFix) as the screen needs it. The browser never derives a value. */
export function getAddressFixModel(fix) {
  if (!fix || fix.kind !== "organization_address") return null
  const view = STATE_VIEW[fix.state] || STATE_VIEW.needs_review
  const proposal = fix.proposal && fix.proposal.status !== "rejected" ? fix.proposal : null
  const evidence = fix.evidence || {}
  const candidates = (evidence.candidates || []).map((c) => ({
    id: c.id,
    source: c.source,
    sourceLabel: ADDRESS_SOURCE_LABEL[c.source] || c.sourceLabel || c.source,
    trust: TRUST_LABEL[c.trust]?.label || c.trust,
    trustTone: TRUST_LABEL[c.trust]?.tone || "warn",
    kind: KIND_LABEL[c.kind] || c.kind,
    fields: c.fields || {},
    text: c.formatted || addressText(c.fields),
    structured: !!c.structured,
    complete: !!c.complete,
    detail: c.detail || null,
    note: c.note || null,
  }))
  return {
    state: fix.state,
    action: view.action,
    actionLabel: view.actionLabel,
    chip: view.chip,
    tone: view.tone,
    message: fix.message || null,
    reasonCode: fix.reasonCode || null,
    entityId: fix.entity?.id || null,
    entityTypes: fix.entity?.types || [],
    current: { state: fix.currentState?.addressState || "missing", fields: fix.currentState?.fields || {}, text: addressText(fix.currentState?.fields), missingParts: fix.currentState?.missingParts || [] },
    confirmedByEvidence: !!fix.currentState?.confirmedByEvidence,
    proposal: proposal ? {
      fields: Object.fromEntries(ADDRESS_FIELDS.filter((f) => proposal.value?.[f]).map((f) => [f, proposal.value[f]])),
      text: proposal.formatted || addressText(proposal.value),
      status: proposal.status,
      statusLabel: proposal.status === "confirmed_by_owner" ? "Confirmed by you" : "Verified",
      confidence: proposal.confidence,
      fieldSources: Object.fromEntries(Object.entries(proposal.fieldSources || {}).map(([f, s]) => [f, ADDRESS_SOURCE_LABEL[s] || s])),
      completes: proposal.completes || null,
    } : null,
    candidates,
    alternatives: (evidence.alternatives || []).map((a) => ({ fields: a.fields || {}, text: a.formatted || addressText(a.fields), sources: (a.sources || []).map((s) => ADDRESS_SOURCE_LABEL[s] || s), kinds: (a.kinds || []).map((k) => KIND_LABEL[k] || k) })),
    suggestion: evidence.suggestion ? { fields: evidence.suggestion.fields || {}, text: evidence.suggestion.formatted || addressText(evidence.suggestion.fields), sources: (evidence.suggestion.sources || []).map((s) => ADDRESS_SOURCE_LABEL[s] || s), partial: !!evidence.suggestion.partial } : null,
    notes: evidence.notes || [],
    diff: fix.diff ? { lines: fix.diff.lines || [], changes: fix.diff.changes || [] } : null,
    validationErrors: fix.validation?.valid === false ? fix.validation.errors || [] : [],
    verifyRequires: fix.verification?.requires || [],
    requiresApproval: fix.requiresApproval !== false,
    modifiesWebsite: !!fix.modifiesWebsite,
  }
}

/** The JSON-LD the server built (the <script> block), or null when the recommendation carries none. */
export function extractIntentCode(recommendation) {
  const content = recommendation?.sections?.implementationExample?.content
  return typeof content === "string" && /<script[^>]*application\/ld\+json/i.test(content) ? content : null
}
