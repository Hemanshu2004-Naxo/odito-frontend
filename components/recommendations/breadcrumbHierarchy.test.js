import { describe, test, expect } from "vitest"
import {
  MAX_ITEMS, addParent, getBreadcrumbModel, hasErrors, initialFormItems, mapServerErrors, moveParent, parseGeneratedBreadcrumb,
  removeParent, summarizeGenerated, toPayloadItems, validateItems,
} from "./breadcrumbHierarchy"

const CANON = "https://clinic.example/blog/"
const CRAWL = "https://clinic.example/blog"
const row = (id, name, url) => ({ id, name, url })
const ctx = { canonicalUrl: CANON, crawlUrl: CRAWL }

const meta = (breadcrumb, url = { display: CANON, trusted: true, crawlKey: CRAWL }) => ({ schemaEvidence: { url, breadcrumb } })

describe("getBreadcrumbModel — which state the recommendation is in", () => {
  test("unknown hierarchy -> the form (state unavailable), with the verified canonical", () => {
    const m = getBreadcrumbModel("breadcrumblist_schema", meta({ status: "unknown" }))
    expect(m).toMatchObject({ applies: true, state: "unavailable", canonicalUrl: CANON, canonicalTrusted: true, crawlUrl: CRAWL })
  })
  test("an owner-confirmed trail -> user_provided; a conflict -> conflict; a valid existing trail -> existing", () => {
    expect(getBreadcrumbModel("breadcrumblist_schema", meta({ status: "user_provided", userProvided: { items: [{ name: "A", url: "u" }] } })).state).toBe("user_provided")
    expect(getBreadcrumbModel("breadcrumblist_schema", meta({ status: "conflict", conflict: { kind: "existing_invalid" } })).state).toBe("conflict")
    expect(getBreadcrumbModel("breadcrumblist_schema", meta({ status: "existing" })).state).toBe("existing")
  })
  test("any other issue, or a response without the evidence, never shows the form", () => {
    expect(getBreadcrumbModel("organization_schema", meta({ status: "unknown" })).applies).toBe(false)
    expect(getBreadcrumbModel("breadcrumblist_schema", {}).applies).toBe(false)
    expect(getBreadcrumbModel("breadcrumblist_schema", null).applies).toBe(false)
  })
  test("an untrusted canonical is NOT offered as the canonical (the crawl URL is never substituted)", () => {
    const m = getBreadcrumbModel("breadcrumblist_schema", meta({ status: "unknown" }, { display: CRAWL, trusted: false, crawlKey: CRAWL }))
    expect(m.canonicalUrl).toBeNull()
    expect(m.canonicalTrusted).toBe(false)
  })
})

describe("initialFormItems", () => {
  test("blank parent + the current page prefilled from the verified canonical", () => {
    const items = initialFormItems({ canonicalUrl: CANON })
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ name: "", url: "" })
    expect(items[1]).toMatchObject({ name: "", url: CANON })
  })
  test("no verified canonical: the current page URL is left EMPTY for the owner to enter/confirm — never the crawl URL", () => {
    const items = initialFormItems({ canonicalUrl: null, crawlUrl: CRAWL })
    expect(items[1].url).toBe("")
  })
  test("a saved hierarchy is restored; a stale one is not", () => {
    const saved = [{ name: "Home", url: "https://clinic.example/" }, { name: "Blog", url: CANON }]
    expect(initialFormItems({ canonicalUrl: CANON, savedItems: saved }).map((i) => [i.name, i.url])).toEqual(saved.map((i) => [i.name, i.url]))
    expect(initialFormItems({ canonicalUrl: CANON, savedItems: saved, savedStale: true })[0].name).toBe("")
  })
  test("rows have unique ids", () => {
    const ids = initialFormItems({}).map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("add / move / remove", () => {
  const base = () => [row("a", "Home", "h"), row("b", "Services", "s"), row("c", "Blog", "b")]

  test("a parent is added BEFORE the current page, which stays last; capped at the maximum", () => {
    const out = addParent(base())
    expect(out).toHaveLength(4)
    expect(out[3].id).toBe("c")
    let many = base()
    for (let i = 0; i < 20; i++) many = addParent(many)
    expect(many).toHaveLength(MAX_ITEMS)
    expect(many[many.length - 1].id).toBe("c")
  })

  test("move up / down reorders parents only; the current page can never move or be displaced", () => {
    expect(moveParent(base(), 1, -1).map((i) => i.id)).toEqual(["b", "a", "c"])
    expect(moveParent(base(), 0, 1).map((i) => i.id)).toEqual(["b", "a", "c"])
    expect(moveParent(base(), 0, -1).map((i) => i.id)).toEqual(["a", "b", "c"])
    expect(moveParent(base(), 1, 1).map((i) => i.id)).toEqual(["a", "b", "c"]) // would swap with the current page
    expect(moveParent(base(), 2, -1).map((i) => i.id)).toEqual(["a", "b", "c"]) // the current page itself
  })

  test("a parent can be removed, but never the current page, and never the last remaining parent", () => {
    expect(removeParent(base(), 0).map((i) => i.id)).toEqual(["b", "c"])
    expect(removeParent(base(), 2).map((i) => i.id)).toEqual(["a", "b", "c"])
    const two = [row("a", "Home", "h"), row("c", "Blog", "b")]
    expect(removeParent(two, 0)).toBe(two)
    expect(removeParent(base(), -1).length).toBe(3)
  })

  test("the helpers never mutate their input", () => {
    const items = base()
    const frozen = JSON.stringify(items)
    addParent(items); moveParent(items, 0, 1); removeParent(items, 0)
    expect(JSON.stringify(items)).toBe(frozen)
  })

  test("positions are not part of the payload — they come from the order on the server", () => {
    expect(toPayloadItems([row("a", " Home ", " https://clinic.example/ "), row("c", "Blog", CANON)])).toEqual([
      { name: "Home", url: "https://clinic.example/", origin: "manual" }, { name: "Blog", url: CANON, origin: "manual" },
    ])
  })
})

describe("validateItems — immediate feedback only", () => {
  const good = () => [row("a", "Home", "https://clinic.example/"), row("c", "Blog", CANON)]

  test("a valid hierarchy has no errors", () => {
    expect(hasErrors(validateItems(good(), ctx))).toBe(false)
  })
  test("missing names and URLs are reported per row and field", () => {
    const r = validateItems([row("a", "", ""), row("c", "Blog", CANON)], ctx)
    expect(r.fieldErrors.a).toEqual({ name: "Page name is required.", url: "Page URL is required." })
  })
  test("invalid URLs, schemes, credentials and fragments", () => {
    for (const [url, text] of [["nope", /full URL/], ["ftp://clinic.example/", /http/], ["javascript:alert(1)", /http/], ["https://u:p@clinic.example/", /username/], ["https://clinic.example/#x", /fragment/]]) {
      expect(validateItems([row("a", "Home", url), row("c", "Blog", CANON)], ctx).fieldErrors.a.url).toMatch(text)
    }
  })
  test("duplicates, including trailing-slash duplicates, are caught on the later row", () => {
    const r = validateItems([row("a", "A", "https://clinic.example/x"), row("b", "B", "https://clinic.example/x/"), row("c", "Blog", CANON)], ctx)
    expect(r.fieldErrors.b.url).toMatch(/same page as item 1/)
  })
  test("the last item must be the canonical; a trailing slash alone is accepted; the message says it is not rewritten", () => {
    expect(validateItems([row("a", "Home", "https://clinic.example/"), row("c", "Blog", "https://clinic.example/news/")], ctx).fieldErrors.c.url).toMatch(/canonical URL is https:\/\/clinic\.example\/blog\//)
    expect(hasErrors(validateItems([row("a", "Home", "https://clinic.example/"), row("c", "Blog", CRAWL)], ctx))).toBe(false)
  })
  test("without a canonical the last item must still be THIS page, and the owner is asked to confirm it", () => {
    const r = validateItems([row("a", "Home", "https://clinic.example/"), row("c", "Blog", "https://clinic.example/else/")], { canonicalUrl: null, crawlUrl: CRAWL })
    expect(r.fieldErrors.c.url).toMatch(/Confirm its exact URL/)
  })
  test("length and count limits", () => {
    expect(validateItems([row("a", "x".repeat(121), "https://clinic.example/"), row("c", "Blog", CANON)], ctx).fieldErrors.a.name).toMatch(/120/)
    expect(validateItems([row("c", "Blog", CANON)], ctx).formErrors[0]).toMatch(/at least one parent/)
  })
})

describe("mapServerErrors — the server is the authority", () => {
  const items = [row("a", "Home", "x"), row("c", "Blog", "y")]
  test("field errors land on the right row and field; the rest become form-level", () => {
    const r = mapServerErrors({ errors: [{ index: 1, field: "url", code: "final_url_mismatch", message: "must be canonical" }, { index: 0, field: "name", message: "bad name" }, { code: "too_few_items", message: "Add at least two items" }] }, items)
    expect(r.fieldErrors).toEqual({ c: { url: "must be canonical" }, a: { name: "bad name" } })
    expect(r.formErrors).toEqual(["Add at least two items"])
  })
  test("an error without a list falls back to the message", () => {
    expect(mapServerErrors({ message: "boom" }, items).formErrors).toEqual(["boom"])
  })
})

describe("generated result parsing", () => {
  const json = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://clinic.example/" }, { "@type": "ListItem", position: 2, name: "Blog", item: CANON }] }
  const code = `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>`

  test("parses the script-wrapped JSON-LD and summarises it", () => {
    expect(parseGeneratedBreadcrumb(code)).toEqual(json)
    expect(summarizeGenerated(json)).toEqual({ itemCount: 2, consecutive: true, uniqueUrls: true, allAbsolute: true })
  })
  test("anything that is not a BreadcrumbList is not summarised as valid", () => {
    expect(parseGeneratedBreadcrumb("<!-- no trail -->")).toBeNull()
    expect(parseGeneratedBreadcrumb(JSON.stringify({ "@type": "Organization" }))).toBeNull()
    expect(parseGeneratedBreadcrumb(undefined)).toBeNull()
    expect(summarizeGenerated(null)).toBeNull()
  })
  test("a broken trail is reported as such", () => {
    const bad = { ...json, itemListElement: [json.itemListElement[0], { ...json.itemListElement[1], position: 4, item: json.itemListElement[0].item }] }
    expect(summarizeGenerated(bad)).toMatchObject({ consecutive: false, uniqueUrls: false })
  })
})
