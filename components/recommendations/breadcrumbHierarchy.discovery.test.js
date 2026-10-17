import { describe, test, expect } from "vitest"
import { DISCOVERY_STATE, describeDiscovery, discoveryStartItems, itemsFromTrail, toPayloadItems, blankItem } from "./breadcrumbHierarchy"

const ORIGIN = "https://acme.example"
const CANON = `${ORIGIN}/services/local-seo/`
const trail = (status, items, extra = {}) => ({ source: "dom", status, items, evidence: ["The page shows this breadcrumb navigation."], warnings: [], ...extra })
const it = (name, url, origin, extra = {}) => ({ name, url, origin, needsUrl: !url, evidence: `ev ${name}`, ...extra })
const discovery = (over = {}) => ({
  status: "verified", canonical: { url: CANON, trusted: true }, notes: [], isHomePage: false,
  recommended: trail("verified", [it("Home", `${ORIGIN}/`, "markup"), it("Services", `${ORIGIN}/services/`, "markup"), it("Local SEO", CANON, "current")]), ...over,
})

describe("itemsFromTrail — a discovered trail becomes the form's rows", () => {
  test("a verified trail: every row is 'discovered', the last row is this page with the VERIFIED canonical, nothing is invented", () => {
    const rows = itemsFromTrail(discovery().recommended, { canonicalUrl: CANON })
    expect(rows.map((r) => [r.name, r.url, r.origin])).toEqual([["Home", `${ORIGIN}/`, "discovered"], ["Services", `${ORIGIN}/services/`, "discovered"], ["Local SEO", CANON, "discovered"]])
    expect(rows[0].orig).toEqual({ name: "Home", url: `${ORIGIN}/` })
  })

  test("a suggested trail (menu / links) marks its parent rows 'suggested'; a menu heading without a page stays EMPTY and carries its URL suggestion", () => {
    const t = trail("incomplete", [
      it("Home", `${ORIGIN}/`, "home", { needsConfirmation: true }),
      it("White Label Services", null, "navigation", { urlSuggestion: { url: `${ORIGIN}/white-label-services/`, evidence: 'A page on your site is titled "White Label Services".' } }),
      it("Local SEO", CANON, "current"),
    ], { source: "navigation" })
    const rows = itemsFromTrail(t, { canonicalUrl: CANON })
    expect(rows.map((r) => r.origin)).toEqual(["suggested", "suggested", "discovered"])
    expect(rows[1].url).toBe("")
    expect(rows[1].urlSuggestion.url).toBe(`${ORIGIN}/white-label-services/`)
    expect(rows[2].urlSuggestion).toBeNull()
  })

  test("without a verified canonical the current page's URL is left blank for the owner to confirm — the crawl URL is never put in", () => {
    const rows = itemsFromTrail(discovery().recommended, { canonicalUrl: null })
    expect(rows[rows.length - 1].url).toBe("")
  })

  test("a trail with fewer than two items gives no rows", () => {
    expect(itemsFromTrail(trail("verified", [it("Only", CANON, "current")]), {})).toBeNull()
    expect(itemsFromTrail(null, {})).toBeNull()
  })
})

describe("discoveryStartItems — only a trail the form can honestly start from", () => {
  test.each(["verified", "suggested", "incomplete"])("%s: start from it", (status) => {
    expect(discoveryStartItems(discovery({ status, recommended: trail(status, discovery().recommended.items) }))).toHaveLength(3)
  })
  test.each(["already_valid", "conflict", "not_found"])("%s: no starting rows (nothing to enter, or nothing found)", (status) => {
    expect(discoveryStartItems(discovery({ status }))).toBeNull()
  })
  test("no recommended trail, or no discovery at all", () => {
    expect(discoveryStartItems(discovery({ recommended: null }))).toBeNull()
    expect(discoveryStartItems(null)).toBeNull()
  })
})

describe("toPayloadItems — origin is recorded, and an edit of a discovered row is told apart", () => {
  test("untouched discovered rows keep their origin; changing the name OR the URL makes it 'edited'; typed rows are 'manual'", () => {
    const rows = itemsFromTrail(discovery().recommended, { canonicalUrl: CANON })
    expect(toPayloadItems(rows).map((r) => r.origin)).toEqual(["discovered", "discovered", "discovered"])
    rows[1] = { ...rows[1], name: "Our services" }
    rows[0] = { ...rows[0], url: `${ORIGIN}/home/` }
    expect(toPayloadItems(rows).map((r) => r.origin)).toEqual(["edited", "edited", "discovered"])
    expect(toPayloadItems([blankItem({ name: " A ", url: " https://acme.example/a " })])).toEqual([{ name: "A", url: "https://acme.example/a", origin: "manual" }])
  })
  test("whitespace around an unchanged value is not an edit", () => {
    const rows = itemsFromTrail(discovery().recommended, { canonicalUrl: CANON })
    rows[0] = { ...rows[0], name: " Home " }
    expect(toPayloadItems(rows)[0].origin).toBe("discovered")
  })
})

describe("describeDiscovery", () => {
  test("loading, error and missing discovery never replace the form; already_valid and conflict do", () => {
    expect(describeDiscovery({ isLoading: true })).toMatchObject({ state: "looking", replacesForm: false })
    expect(describeDiscovery({ isError: true })).toMatchObject({ state: "unavailable", replacesForm: false })
    expect(describeDiscovery({ discovery: null })).toMatchObject({ state: "unavailable", replacesForm: false })
    expect(describeDiscovery({ discovery: discovery({ status: "already_valid" }) })).toMatchObject({ state: "already_valid", replacesForm: true, tone: "ok" })
    expect(describeDiscovery({ discovery: discovery({ status: "conflict" }) })).toMatchObject({ state: "conflict", replacesForm: true, tone: "bad" })
    for (const status of ["verified", "suggested", "incomplete", "not_found"]) expect(describeDiscovery({ discovery: discovery({ status }) }).replacesForm).toBe(false)
  })
  test("notes and evidence are bounded and come from the server", () => {
    const d = describeDiscovery({ discovery: discovery({ notes: ["n1", "n2", "n3"], recommended: trail("verified", [], { warnings: ["w1", "w2"], evidence: ["e1"] }) }) })
    expect(d.notes).toEqual(["n1", "n2", "n3", "w1"]); expect(d.evidence).toEqual(["e1"])
  })
  test("every state has a label and ONE sentence; none repeats the form's 'will not guess' sentence", () => {
    for (const [k, v] of Object.entries(DISCOVERY_STATE)) { expect(v.label.length).toBeGreaterThan(3); expect(v.text.length).toBeGreaterThan(20); expect(v.text).not.toMatch(/will not guess your parent pages/); expect(k).toBeTruthy() }
  })
})
