import { describe, test, expect } from "vitest"
import {
  buildEntries, describeScope, describeSameAsError, describeSource, panelState, preselectedIds, quickCheckUrl, sameProfileUrl, selectedUrls, SAMEAS_STATES,
} from "./sameAsFix"

const cand = (over = {}) => ({
  id: "c1", url: "https://www.linkedin.com/company/acme", platform: "linkedin", platformLabel: "LinkedIn", kind: "organization",
  confidence: "high", status: "suggested", preselected: true, verification: "linked_from_site", reasons: ["Linked from the footer"], warnings: [],
  sources: [{ method: "page_link", pageUrl: "https://acme.com/", placement: "footer" }], ...over,
})

describe("quickCheckUrl — fast local feedback (the server decides)", () => {
  test.each([
    ["", /Enter a link/],
    ["   ", /Enter a link/],
    ["javascript:alert(1)", /not a web address/],
    ["http://www.linkedin.com/company/x", /https/],
    ["www.linkedin.com/company/x", /Start with https/],
    ["https://", /not a valid link/],
    ["https://user:pw@www.linkedin.com/company/x", /username/],
    ["https://localhost/x", /public website/],
    ["https://nodot/x", /public website/],
    ["https://www.linkedin.com/company/a b", /spaces/],
  ])("%s -> rejected", (raw, message) => {
    expect(quickCheckUrl(raw)).toMatch(message)
  })

  test("the site itself is not a profile; a normal profile passes", () => {
    expect(quickCheckUrl("https://www.acme.com/contact", { siteUrl: "https://acme.com/page" })).toMatch(/your own website/)
    expect(quickCheckUrl("https://www.linkedin.com/company/acme", { siteUrl: "https://acme.com/page" })).toBeNull()
  })
})

describe("selection model", () => {
  test("only server-suggested candidates start selected — never a weak, ambiguous or unconfirmed one", () => {
    const discovery = { candidates: [cand(), cand({ id: "c2", status: "needs_confirmation", preselected: false }), cand({ id: "c3", status: "weak", preselected: false }), cand({ id: "c4", preselected: true, status: "needs_confirmation" })] }
    expect(preselectedIds(discovery)).toEqual(["c1"])
  })

  test("entries: discovered + edited + manual, minus dismissed and already-published ones; selected urls follow the edits", () => {
    const discovery = { candidates: [cand(), cand({ id: "c2", url: "https://www.facebook.com/acme", platformLabel: "Facebook" }), cand({ id: "c3", status: "already_present" })] }
    const entries = buildEntries({
      discovery,
      manual: [{ key: "manual:1", url: "https://x.com/acme", platformLabel: "X (Twitter)", kind: "account", warnings: [] }],
      edits: { c1: { url: "https://www.linkedin.com/company/acme-corrected", platformLabel: "LinkedIn" } },
      dismissed: new Set(["c2"]),
      selected: new Set(["c1", "manual:1", "c3"]),
    })
    expect(entries.map((e) => [e.key, e.source])).toEqual([["c1", "edited"], ["manual:1", "manual"]])
    expect(selectedUrls(entries)).toEqual(["https://www.linkedin.com/company/acme-corrected", "https://x.com/acme"])
  })

  test("sameProfileUrl ignores scheme, www and trailing slashes only", () => {
    expect(sameProfileUrl("http://www.facebook.com/acme/", "https://facebook.com/acme")).toBe(true)
    expect(sameProfileUrl("https://facebook.com/acme", "https://facebook.com/acme2")).toBe(false)
  })

  test("describeSource says where a link was seen, in plain words", () => {
    expect(describeSource({ source: "manual" })).toBe("Added by you")
    expect(describeSource({ source: "discovered", verification: "declared_in_schema" })).toMatch(/structured data/)
    expect(describeSource({ source: "discovered", verification: "integration_connected" })).toMatch(/connected/)
    expect(describeSource({ source: "discovered", sources: [{ method: "page_link", pageUrl: "https://acme.com/contact", placement: "footer" }] })).toBe("Linked in the footer of /contact")
    expect(describeSource({ source: "discovered", sources: [{ method: "crawl_social_link", pageUrl: "https://acme.com/" }] })).toBe("Found by the site crawl")
  })
})

describe("panelState — the honest state of the panel", () => {
  const base = { discoveryLoading: false, discovery: { state: "candidates_discovered" }, selectionCount: 0, preview: null, previewLoading: false, noLinksChosen: false }
  const ready = { plan: { status: "ready" }, validation: { valid: true }, sameAs: { panelState: "ready_to_apply" }, record: null }
  const rec = (status) => ({ status })

  test("discovery states, each with its own wording", () => {
    for (const state of ["candidates_discovered", "needs_confirmation", "none_found", "existing_present"]) {
      expect(panelState({ ...base, discovery: { state } })).toBe(state)
      expect(SAMEAS_STATES[state].text.length).toBeGreaterThan(20)
    }
    expect(panelState({ ...base, discovery: null, discoveryLoading: true })).toBe("looking")
  })

  test("none found says to add manually and never promises a link", () => {
    expect(SAMEAS_STATES.none_found.text).toMatch(/will not invent one/)
  })

  test("a selection moves to ready_to_preview, then ready_to_apply only when the server's plan is ready AND valid", () => {
    expect(panelState({ ...base, selectionCount: 1, previewLoading: true })).toBe("ready_to_preview")
    expect(panelState({ ...base, selectionCount: 1, preview: ready })).toBe("ready_to_apply")
    expect(panelState({ ...base, selectionCount: 1, preview: { ...ready, validation: { valid: false } } })).not.toBe("ready_to_apply")
    expect(panelState({ ...base, selectionCount: 1, preview: { plan: { status: "blocked" }, validation: { valid: false }, sameAs: {} } })).toBe("blocked")
  })

  test("an unsupported source wins over ready and shows the manual-action state", () => {
    expect(panelState({ ...base, selectionCount: 1, preview: { plan: { status: "unsupported" }, validation: { valid: true }, sameAs: {} } })).toBe("unsupported_source")
    // known from the empty-selection plan, before anything is selected
    expect(panelState({ ...base, environment: { plan: { status: "unsupported" } } })).toBe("unsupported_source")
  })

  test("recorded fixes beat everything: pending, verified, failed, rolled back", () => {
    expect(panelState({ ...base, selectionCount: 1, record: rec("applied") })).toBe("applied_verification_pending")
    expect(panelState({ ...base, selectionCount: 1, record: rec("verified") })).toBe("applied_verified")
    expect(panelState({ ...base, selectionCount: 1, record: rec("verification_failed") })).toBe("verification_failed")
    expect(panelState({ ...base, selectionCount: 0, record: rec("rolled_back") })).toBe("rolled_back")
  })

  test("'continue without links' is its own calm state", () => {
    expect(panelState({ ...base, noLinksChosen: true })).toBe("no_selection")
  })
})

describe("errors and scope wording", () => {
  test("invalid links list every reason the server gave", () => {
    const info = describeSameAsError(Object.assign(new Error("x"), { code: "INVALID_PROFILES", details: { errors: [{ message: "A." }, { message: "B." }] } }))
    expect(info.title).toBe("A link is not valid")
    expect(info.message).toBe("A. B.")
  })

  test("a stale preview asks for a refreshed preview; other errors fall through to the shared vocabulary", () => {
    expect(describeSameAsError(Object.assign(new Error("x"), { code: "CONFLICT", details: { reason: "preview_stale" } })).refreshPreview).toBe(true)
    expect(describeSameAsError(null)).toBeNull()
  })

  test("site-wide vs page-specific scope", () => {
    expect(describeScope({ kind: "site_wide", pagesWithSameEntity: 35 })).toMatch(/site-wide \(35 crawled pages carry it\)/)
    expect(describeScope({ kind: "page_specific" })).toMatch(/specific to this page/)
    expect(describeScope(null)).toBeNull()
  })
})
