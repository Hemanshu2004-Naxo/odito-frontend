import { describe, test, expect } from "vitest"
import { displayUrl, formatCellDate, mapBacklink, mapBacklinksPage, relativePath } from "./mapBacklink"
import { REAL_BROKEN, REAL_DEFAULT, REAL_LOST } from "./testFixtures"

const NOW = Date.parse("2026-10-27T10:00:00Z")
const real = REAL_DEFAULT.items[0]
const map = (patch = {}) => mapBacklink({ ...real, ...patch }, { now: NOW })

describe("mapBacklink: a real row (articlescad.com -> asgeyehospital.com)", () => {
  const r = map()

  test("source: title, URL without the protocol, domain, country with flag", () => {
    expect(r.sourceTitle).toBe("Retina Eye Surgery: An Overview")
    expect(r.sourceUrl).toBe("https://articlescad.com/15-amazing-facts-about-sash-window-maintenance-that-youve-never-heard-of-16477.html")
    expect(r.sourceUrlDisplay).toBe("articlescad.com/15-amazing-facts-about-sash-window-maintenance-that-youve-never-heard-of-16477.html")
    expect(r.sourceDomain).toBe("articlescad.com")
    expect(r.sourceCountry).toMatchObject({ code: "US", name: "United States", flag: "🇺🇸" })
  })

  test("anchor: a text link with no item-type chip", () => {
    expect([r.anchor, r.anchorKind, r.itemType, r.itemTypeLabel]).toEqual(["Retina Eye Surgery", "text", "anchor", null])
  })

  test("target: a relative path, with the redirect it ends up at", () => {
    expect(r.targetUrl).toBe("https://asgeyehospital.com/specialities/retina-diseases/")
    expect(r.targetPath).toBe("/specialities/retina-diseases/")
    expect(r.targetRedirect).toBe("https://www.asgeyehospital.com/specialities/retina-diseases/")
    expect(r.targetRedirectDisplay).toBe("www.asgeyehospital.com/specialities/retina-diseases/")
    expect(r.targetStatus).toBe(301)
  })

  test("follow: dofollow, with its attributes (none of them ugc / sponsored)", () => {
    expect([r.isDofollow, r.attributes, r.isUgc, r.isSponsored]).toEqual([true, ["noopener", "noreferrer"], false, false])
  })

  test("quality: ranks out of 1000 and a spam score with its band", () => {
    expect([r.domainRank, r.pageRank, r.linkRank, r.spamScore]).toEqual([542, 238, 211, 10])
    expect(r.spamBand).toEqual({ key: "low", label: "Low" })
  })

  test("dates: 'May 5, 2026' in the cell, the full date-time (UTC) and how long ago in the tooltip", () => {
    expect(r.firstSeen.label).toBe("May 5, 2026")
    expect(r.lastSeen.label).toBe("May 14, 2026")
    expect(r.firstSeen.tooltip).toMatch(/^May 5, 2026, 12:25 PM UTC · .*ago$/)
    expect(r.firstSeen.raw).toBe("2026-05-05 12:25:31 +00:00")
  })

  test("placement is '—' (null) when the provider does not say; a known one is a label", () => {
    expect(r.placement).toBeNull()
    expect(map({ semantic_location: "footer" }).placement).toBe("Footer")
    expect(map({ semantic_location: "figcaption" }).placementKey).toBe("figcaption")
  })

  test("no status badges on an ordinary link", () => {
    expect(r.badges).toEqual([])
    expect(r.suggestedFix).toBeNull()
  })

  test("context: the text around the link, split so the anchor can be bold", () => {
    expect(r.context.before).toBeNull()
    // The provider's text starts with a NON-BREAKING space (U+00A0): the spacing around the anchor is kept exactly as sent.
    expect(r.context.after).toMatch(/^ refers to a group of specialized surgical procedures/)
  })

  test("source details: language, platform types, IP, external / internal link counts on the source page", () => {
    expect(r.source).toMatchObject({ language: "en", ip: "212.132.102.82", externalLinks: 1, internalLinks: 8, platformTypes: ["Unknown"] })
  })
})

describe("mapBacklink: the cases the real sample does not contain (constructed rows)", () => {
  test("an image link: shown by its alt text, with an Image chip", () => {
    const r = map({ item_type: "image", anchor: null, alt: "Eye surgeon at work", image_url: "https://x.com/i.jpg" })
    expect([r.anchorKind, r.imageAlt, r.itemTypeLabel, r.anchor]).toEqual(["image", "Eye surgeon at work", "Image", null])
  })

  test("a link with no anchor at all", () => {
    const r = map({ anchor: "   ", item_type: "anchor" })
    expect(r.anchorKind).toBe("empty")
    expect(r.anchor).toBeNull()
  })

  test("a redirect or canonical link gets its type chip", () => {
    expect(map({ item_type: "redirect" }).itemTypeLabel).toBe("Redirect")
    expect(map({ item_type: "canonical" }).itemTypeLabel).toBe("Canonical")
    expect(map({ item_type: "weird-new-type" }).itemTypeLabel).toBe("Weird New Type")
  })

  test("nofollow, ugc and sponsored", () => {
    const r = map({ dofollow: false, attributes: ["nofollow", "ugc", "sponsored"] })
    expect([r.isDofollow, r.isUgc, r.isSponsored]).toEqual([false, true, true])
  })

  test("a title-less page falls back to the URL in the cell (the title is just null here)", () => {
    expect(map({ page_from_title: null }).sourceTitle).toBeNull()
  })

  test("the spam bands: 0–10 Low, 11–30 Medium, 31+ High; unknown has none", () => {
    expect([0, 10, 11, 30, 31, 100].map((s) => map({ backlink_spam_score: s }).spamBand.key)).toEqual(["low", "low", "medium", "medium", "high", "high"])
    expect(map({ backlink_spam_score: null }).spamBand).toBeNull()
  })

  test("status badges: NEW, LOST and BROKEN with the status code, in that order", () => {
    expect(map({ is_new: true }).badges).toEqual([{ key: "new", label: "NEW" }])
    expect(map({ is_lost: true }).badges).toEqual([{ key: "lost", label: "LOST" }])
    expect(map({ is_broken: true, url_to_status_code: 404 }).badges).toEqual([{ key: "broken", label: "BROKEN 404" }])
    expect(map({ is_new: true, is_broken: true, url_to_status_code: 410 }).badges.map((b) => b.label)).toEqual(["NEW", "BROKEN 410"])
    expect(map({ is_broken: true, url_to_status_code: null }).badges).toEqual([{ key: "broken", label: "BROKEN" }])
  })

  test("everything the provider left out is null — never 0, NaN or undefined", () => {
    const r = mapBacklink({ url_from: "https://a.com/x" }, { now: NOW })
    for (const k of ["sourceTitle", "anchor", "targetUrl", "targetPath", "targetRedirect", "targetStatus", "isDofollow", "placement", "domainRank", "pageRank", "spamScore", "spamBand", "original", "sourceCountry"]) expect(r[k], k).toBeNull()
    expect([r.firstSeen.label, r.lastSeen.label, r.firstSeen.tooltip]).toEqual([null, null, null])
    expect(r.attributes).toEqual([])
    expect(r.indirectPath).toEqual([])
    expect(r.source.platformTypes).toEqual([])
  })

  test("an indirect link keeps its path", () => {
    const r = map({ is_indirect_link: true, indirect_link_path: ["https://a.com/", "https://b.com/"] })
    expect([r.isIndirect, r.indirectPath]).toEqual([true, ["https://a.com/", "https://b.com/"]])
  })
})

describe("broken links get a suggested fix from the target's status (real broken rows are all 403)", () => {
  test("the real rows", () => {
    const rows = REAL_BROKEN.items.map((i) => mapBacklink(i, { now: NOW }))
    expect(rows.every((r) => r.isBroken && r.targetStatus === 403)).toBe(true)
    expect(rows[0].suggestedFix).toBe("Server/CDN is blocking access — check firewall or bot protection")
    expect(rows[0].badges).toEqual([{ key: "broken", label: "BROKEN 403" }])
  })

  test("404 / 5xx / other", () => {
    expect(map({ is_broken: true, url_to_status_code: 404 }).suggestedFix).toBe("Add a 301 redirect to a relevant live page")
    expect(map({ is_broken: true, url_to_status_code: 503 }).suggestedFix).toBe("Server error — check hosting")
    expect(map({ is_broken: true, url_to_status_code: 418 }).suggestedFix).toBe("Check this URL")
  })
})

describe("display helpers", () => {
  test("displayUrl drops the protocol and a lone trailing slash, nothing else", () => {
    expect(displayUrl("https://www.example.com/")).toBe("www.example.com")
    expect(displayUrl("http://example.com/a/b/")).toBe("example.com/a/b/")
    expect(displayUrl("https://example.com/a?x=1")).toBe("example.com/a?x=1")
    expect(displayUrl("")).toBeNull()
    expect(displayUrl(null)).toBeNull()
  })

  test("relativePath is the path on the target site; the home page is '/'", () => {
    expect(relativePath("https://asgeyehospital.com/")).toBe("/")
    expect(relativePath("https://asgeyehospital.com")).toBe("/")
    expect(relativePath("https://a.com/x/y/?q=1")).toBe("/x/y/?q=1")
    expect(relativePath("not a url")).toBe("not a url")
    expect(relativePath(null)).toBeNull()
  })

  test("dates are UTC so a day never slips", () => {
    expect(formatCellDate(new Date("2026-10-05T23:59:59Z"))).toBe("Oct 5, 2026")
    expect(formatCellDate(null)).toBeNull()
  })
})

describe("mapBacklinksPage", () => {
  test("rows, total and the token for the next batch; ids are unique even for a page that links twice", () => {
    const page = mapBacklinksPage({ result: { totalCount: 13591, nextToken: "tok", items: [real, real] } }, { now: NOW })
    expect(page.total).toBe(13591)
    expect(page.nextToken).toBe("tok")
    expect(page.rows).toHaveLength(2)
    expect(new Set(page.rows.map((r) => r.id)).size).toBe(2)
  })

  test("the real pages", () => {
    expect(mapBacklinksPage({ result: REAL_DEFAULT }).rows).toHaveLength(30)
    expect(mapBacklinksPage({ result: REAL_LOST }).total).toBe(3172)
  })

  test("nothing yet, and an empty result (0 matches is a total of 0, not unknown)", () => {
    expect(mapBacklinksPage(null)).toEqual({ rows: [], total: null, nextToken: null })
    expect(mapBacklinksPage({ result: { totalCount: 0, nextToken: null, items: [] } })).toEqual({ rows: [], total: 0, nextToken: null })
  })
})
