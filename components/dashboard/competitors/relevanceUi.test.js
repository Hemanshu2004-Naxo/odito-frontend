import { describe, it, expect } from "vitest"
import { badgeFor, countByClass, applyFilters, domainsToRequest, assessmentPollInterval, scopeNote, CLASS_KEYS, FILTERS, SOURCE_LABEL } from "./relevanceUi"

const A = (domain, over = {}) => [domain, { domain, status: "done", class: "direct_competitor", overridden: false, stale: false, ...over }]
const map = (...entries) => new Map(entries)

describe("badgeFor", () => {
  it("a class gives its label; the user's decision says so", () => {
    expect(badgeFor({ class: "direct_competitor", status: "done" }).label).toBe("Direct")
    expect(badgeFor({ class: "informational_directory", status: "done" }).label).toBe("Informational")
    expect(badgeFor({ class: "indirect_competitor", status: "done", overridden: true }).hint).toMatch(/^Set by you/)
  })
  it("queued or running is Checking; nothing known (or failed) is Not checked, with a reason", () => {
    expect(badgeFor({ status: "pending", class: null })).toMatchObject({ state: "pending", label: "Checking…" })
    expect(badgeFor({ status: "processing", class: null }).state).toBe("pending")
    expect(badgeFor(undefined)).toMatchObject({ state: "none", label: "Not checked" })
    expect(badgeFor({ status: "failed", class: null }).state).toBe("none")
    expect(badgeFor(undefined).hint.length).toBeGreaterThan(10)
  })
  it("a class wins over a pending status (the previous result stays visible while it is redone)", () => {
    expect(badgeFor({ status: "pending", class: "not_relevant" }).label).toBe("Not relevant")
  })
})

describe("applyFilters: only the rows already on the page", () => {
  const rows = [{ domain: "nih.gov" }, { domain: "asgeyehospital.com" }, { domain: "practo.com" }, { domain: "unknown.example" }]
  const by = map(A("nih.gov", { class: "informational_directory" }), A("asgeyehospital.com"), A("practo.com", { class: "informational_directory" }), ["unknown.example", { domain: "unknown.example", status: "pending", class: null }])
  it("all keeps every row; a class keeps only its rows (by the EFFECTIVE class)", () => {
    expect(applyFilters(rows, by, { filter: "all" })).toHaveLength(4)
    expect(applyFilters(rows, by, { filter: "direct_competitor" }).map((r) => r.domain)).toEqual(["asgeyehospital.com"])
    expect(applyFilters(rows, by, { filter: "informational_directory" }).map((r) => r.domain)).toEqual(["nih.gov", "practo.com"])
    expect(applyFilters(rows, by, { filter: "needs_review" })).toEqual([])
  })
  it("a domain search narrows any filter, case-insensitively, and an empty search changes nothing", () => {
    expect(applyFilters(rows, by, { filter: "all", search: "PRACT" }).map((r) => r.domain)).toEqual(["practo.com"])
    expect(applyFilters(rows, by, { filter: "direct_competitor", search: "practo" })).toEqual([])
    expect(applyFilters(rows, by, { search: "  " })).toHaveLength(4)
  })
  it("the filter never mutates the rows it is given", () => {
    const copy = JSON.stringify(rows)
    applyFilters(rows, by, { filter: "direct_competitor" })
    expect(JSON.stringify(rows)).toBe(copy)
  })
})

describe("countByClass", () => {
  it("counts per class, and separates 'still checking' from 'not checked'", () => {
    const by = map(A("a.com"), A("b.com", { class: "not_relevant" }), ["c.com", { status: "pending", class: null }])
    const c = countByClass(["a.com", "b.com", "c.com", "d.com"], by)
    expect([c.counts.direct_competitor, c.counts.not_relevant, c.pending, c.unchecked, c.total]).toEqual([1, 1, 1, 1, 4])
  })
})

describe("domainsToRequest: ask once for what is missing or stale, never for what is on its way", () => {
  it("missing and stale are requested; fresh, queued and user-decided are not", () => {
    const by = map(A("fresh.com"), A("stale.com", { stale: true }), ["queued.com", { status: "pending", class: null, stale: false }], A("decided.com", { stale: true, overridden: true }))
    expect(domainsToRequest(["fresh.com", "stale.com", "queued.com", "decided.com", "new.com"], by)).toEqual(["stale.com", "new.com"])
  })
  it("a domain already asked about in this view is not asked again", () => {
    expect(domainsToRequest(["new.com"], map(), new Set(["new.com"]))).toEqual([])
  })
})

describe("assessmentPollInterval", () => {
  it("polls while something is being checked, for at most four minutes, and never when nothing is", () => {
    const pending = map(["a.com", { status: "pending" }])
    expect(assessmentPollInterval(pending, 1000, 1000 + 10_000)).toBe(4000)
    expect(assessmentPollInterval(pending, 1000, 1000 + 5 * 60_000)).toBe(false)
    expect(assessmentPollInterval(map(A("a.com")), 1000, 2000)).toBe(false)
    expect(assessmentPollInterval(map(), 1000, 2000)).toBe(false)
  })
})

describe("wording", () => {
  it("the scope note says the filter covers the loaded page, not every discovered domain", () => {
    expect(scopeNote(49, 1629)).toBe("Applies to the 49 competitors loaded on this page, not to all 1,629 domains.")
    expect(scopeNote(1, null)).toMatch(/1 competitor loaded on this page, not to all discovered/)
  })
  it("a filter for every class, and a source label for every kind of reason the server sends", () => {
    expect(FILTERS.map((f) => f.key)).toEqual(["all", ...CLASS_KEYS])
    for (const s of ["registry", "website", "project", "rules", "seo"]) expect(SOURCE_LABEL[s]).toBeTruthy()
  })
})
