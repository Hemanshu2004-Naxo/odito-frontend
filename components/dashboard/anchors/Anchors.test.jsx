import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hooks (query keys, classification), mapping and components run, over the REAL recorded
// asgeyehospital.com anchor profile (the top 1,000 anchors).
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const settingsSvc = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }))
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DEFAULT_HISTORY_MONTHS: 12,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
}))
vi.mock("@/services/anchorSettingsService", () => ({ default: settingsSvc, anchorSettingsService: settingsSvc }))
vi.mock("../referring-domains/exportCsv", async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: csv.downloadCsv }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: project.current }) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))

import AnchorsDashboard from "./AnchorsDashboard"
import { REAL_PROFILE } from "./testFixtures"
import { REAL_LIVE as SUMMARY } from "../backlinks-overview/testFixtures"
import { REAL_ROWS, pageEnvelope } from "../organic-keywords/testFixtures"
import { pickImportKeywords } from "@/lib/anchors/brandTerms"
import { mapKeywordsPage } from "../organic-keywords/mapRankedKeyword"
import { countCsvLines } from "../backlinks/exportStream"

const ok = (data) => ({ success: true, data })
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })
const envelope = (section, result, extra = {}) => ({ section, target: "asgeyehospital.com", fetchedAt: "2026-10-27T08:00:00.000Z", cached: false, refreshThrottled: false, result, ...extra })

function serve(overrides = {}) {
  svc.getSection.mockImplementation(async (_pid, section, opts) => {
    if (section in overrides) { const r = overrides[section]; if (r instanceof Error) throw r; if (typeof r === "function") return r(opts); return ok(r) }
    if (section === "backlinks") return ok(envelope("backlinks", SUMMARY))
    if (section === "anchor-profile") return ok(envelope("anchor-profile", REAL_PROFILE))
    if (section === "ranked-keywords") return ok(pageEnvelope(REAL_ROWS.slice(0, 50)))
    throw new Error(`unexpected section ${section}`)
  })
}

let saved
function serveSettings() {
  saved = { saved: false, brand_terms: [], target_keywords: [], saved_at: null }
  const body = () => ({ success: true, data: { ...saved, limits: { brand_terms: 20, target_keywords: 100, term_length: 80 } } })
  settingsSvc.get.mockImplementation(async () => body())
  settingsSvc.save.mockImplementation(async (_pid, { brandTerms, targetKeywords }) => { saved = { saved: true, brand_terms: brandTerms, target_keywords: targetKeywords, saved_at: "2026-10-27T09:00:00.000Z" }; return body() })
}

const calls = () => svc.getSection.mock.calls.map(([pid, section, opts]) => ({ pid, section, refresh: Boolean(opts?.refresh) }))
const bySection = (s) => calls().filter((c) => c.section === s)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(AnchorsDashboard)))
}
const loaded = () => screen.findAllByTestId("an-cloud-item")
const items = () => screen.getAllByTestId("an-cloud-item")
const labelOf = (el) => el.querySelector("span").textContent
const mixRow = (type) => screen.getAllByTestId("an-mix-row").find((r) => r.getAttribute("data-type") === type)
/** Finds one anchor in the cloud through the search box (the cloud shows the biggest 14 at first). */
async function cloudItem(anchor) {
  fireEvent.change(screen.getByTestId("an-search"), { target: { value: anchor } })
  return waitFor(() => { const el = items().find((i) => labelOf(i) === anchor); if (!el) throw new Error(`no ${anchor}`); return el })
}

vi.setConfig({ testTimeout: 30000 })
beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 })
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  window.scrollTo = () => {}
  window.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
})
beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, "", "/app/backlinks/anchors")
  try { window.localStorage.clear() } catch { /* not available */ }
  window.innerWidth = 1280
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  serve()
  serveSettings()
})
afterEach(() => { vi.restoreAllMocks() })

describe("Anchors: first load", () => {
  test("ONE profile request (plus the shared summary); the per-page table request is no longer made", async () => {
    renderPage()
    await loaded()
    expect(bySection("anchor-profile")).toHaveLength(1)
    expect(bySection("anchors")).toHaveLength(0)
    expect(calls().every((c) => !c.refresh)).toBe(true)
  })

  test("header: breadcrumb, title, domain, the anchor count, Anchor settings, Refresh and Export CSV", async () => {
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Anchors" })).toBeTruthy()
    await loaded()
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).textContent).toBe("Dashboard/SEO/Off-page")
    expect(screen.getByTestId("an-domain").textContent).toBe("asgeyehospital.com")
    expect(screen.getByTestId("an-about").textContent).toBe("The clickable words other sites use to link to you · 1,004 anchors")
    for (const id of ["an-settings", "an-refresh", "an-export"]) expect(screen.getByTestId(id)).toBeTruthy()
  })

  test("asks for a project when none is selected, and requests nothing", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its anchors.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
  })
})

describe("Anchors: your anchor mix", () => {
  test("one row per type, biggest first, each against its typical range with a verdict; the bar's shares add up to 100%", async () => {
    renderPage()
    await loaded()
    const rows = screen.getAllByTestId("an-mix-row")
    const shares = rows.map((r) => Number(within(r).getAllByRole("cell")[0].textContent.replace("%", "")))
    expect(shares).toEqual([...shares].sort((a, b) => b - a))
    expect(shares.reduce((a, b) => a + b, 0)).toBeGreaterThan(99.5)
    expect(shares.reduce((a, b) => a + b, 0)).toBeLessThan(100.5)
    for (const r of rows) expect(["too_low", "ok", "too_high"]).toContain(r.getAttribute("data-verdict"))
    // The spam network's 2,707 sites link with the domain in the anchor: naked URL is far above its typical 15–30%.
    expect(rows[0].getAttribute("data-type")).toBe("naked_url")
    expect(mixRow("naked_url").textContent).toMatch(/Too high$/)
    expect(mixRow("other").textContent).toMatch(/^Phrases/)
    expect(screen.getByTestId("an-mix-advice").textContent).toMatch(/^Naked URL anchors are \d+\.\d% of your mix, above the typical 15–30%\. Part of this comes from spammy sites/)
  })

  test("a click on a type filters the cloud to it; a second click shows all again", async () => {
    renderPage()
    await loaded()
    fireEvent.click(within(mixRow("branded")).getByRole("button"))
    await waitFor(() => expect(screen.getByTestId("an-type-filter").textContent).toMatch(/Showing Branded/))
    expect(items().every((i) => i.getAttribute("data-type") === "branded")).toBe(true)
    fireEvent.click(within(mixRow("branded")).getByRole("button"))
    await waitFor(() => expect(screen.queryByTestId("an-type-filter")).toBeNull())
  })
})

describe("Anchors: spammy anchors", () => {
  test("the banner counts the spammy anchors and their sites; Show them filters the cloud; Disavow opens the toxic list", async () => {
    renderPage()
    await loaded()
    expect(screen.getByTestId("an-spam-title").textContent).toMatch(/^\d+ spammy anchors from [\d.]+K linking sites$/)
    expect(screen.getByTestId("an-spam-disavow").getAttribute("href")).toBe("/app/referring-domains?tab=toxic")
    fireEvent.click(screen.getByTestId("an-spam-show"))
    await waitFor(() => expect(screen.getByTestId("an-type-filter").textContent).toMatch(/Spammy anchors/))
    expect(items().every((i) => i.getAttribute("data-spam") === "1")).toBe(true)
  })

  test("with no spammy anchor there is no banner", async () => {
    serve({ "anchor-profile": envelope("anchor-profile", { ...REAL_PROFILE, items: REAL_PROFILE.items.map((i) => ({ ...i, backlinks_spam_score: 5 })) }) })
    renderPage()
    await loaded()
    expect(screen.queryByTestId("an-spam")).toBeNull()
  })
})

describe("Anchors: the cloud and the detail panel", () => {
  test("the 14 biggest first, by linking sites; bigger text for more sites; Show more adds more", async () => {
    renderPage()
    await loaded()
    expect(items()).toHaveLength(14)
    const sizes = items().map((i) => parseFloat(i.style.fontSize))
    expect(sizes[0]).toBe(30)
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
    expect(screen.getByTestId("an-cloud-count").textContent).toBe("Showing 14 of 1,000 anchors, by number of linking sites (the top 1,000 of 1,004)")
    fireEvent.click(screen.getByTestId("an-cloud-more"))
    expect(items().length).toBe(42)
  })

  test("the panel starts on the biggest spammy anchor: its numbers, 'Spam: disavow' and Go to disavow", async () => {
    renderPage()
    await loaded()
    const panel = screen.getByTestId("an-detail")
    expect(within(panel).getByTestId("an-detail-type").textContent).toBe("Spam")
    expect(within(panel).getByTestId("an-detail-anchor").textContent).toBe("“asgeyehospital.com Premium Link Building Experts for Website Ranking Growth”")
    expect(within(panel).getByTestId("an-detail-sites").textContent).toBe("Linking sites2.7K")
    expect(within(panel).getByTestId("an-detail-spam").textContent).toBe("Spam score54 · High")
    expect(within(panel).getByTestId("an-detail-first").textContent).toBe("First seenSep 2026")
    expect(within(panel).getByTestId("an-detail-verdict").getAttribute("data-tone")).toBe("bad")
    expect(within(panel).getByTestId("an-detail-action").textContent).toBe("Go to disavow")
  })

  test("a click on a normal anchor shows it, with 'See these backlinks' filtered to that exact anchor", async () => {
    renderPage()
    await loaded()
    fireEvent.click(await cloudItem("ASG Eye Hospital"))
    const panel = screen.getByTestId("an-detail")
    await waitFor(() => expect(within(panel).getByTestId("an-detail-anchor").textContent).toBe("“ASG Eye Hospital”"))
    expect(within(panel).getByTestId("an-detail-type").textContent).toBe("Branded")
    expect(within(panel).getByTestId("an-detail-verdict").getAttribute("data-tone")).toBe("good")
    expect(within(panel).getByTestId("an-detail-action").getAttribute("href")).toBe("/app/backlinks/list?exact=ASG+Eye+Hospital")
  })

  test("the empty anchor is labelled and links to the no-anchor filter", async () => {
    renderPage()
    await loaded()
    fireEvent.click(items().find((i) => labelOf(i) === "(empty / image link)"))
    expect(screen.getByTestId("an-detail-action").getAttribute("href")).toBe("/app/backlinks/list?noanchor=1")
  })

  test("search narrows the cloud; nothing matching says so", async () => {
    renderPage()
    await loaded()
    fireEvent.change(screen.getByTestId("an-search"), { target: { value: "lasik surgery" } })
    await waitFor(() => expect(items().every((i) => labelOf(i).toLowerCase().includes("lasik surgery"))).toBe(true))
    fireEvent.change(screen.getByTestId("an-search"), { target: { value: "zzzz no such anchor" } })
    expect(await screen.findByText("No anchor matches.")).toBeTruthy()
  })
})

describe("Anchors: settings — brand terms and target keywords", () => {
  test("with nothing saved, the domain's suggested terms classify the anchors and a dismissible hint asks for settings", async () => {
    renderPage()
    await loaded()
    expect((await screen.findByTestId("an-settings-banner")).textContent).toContain("Add your brand terms and target keywords for accurate anchor types.")
    fireEvent.click(screen.getByTestId("an-banner-dismiss"))
    expect(screen.queryByTestId("an-settings-banner")).toBeNull()
  })

  test("the hint stays dismissed for this project", async () => {
    const first = renderPage()
    fireEvent.click(await screen.findByTestId("an-banner-dismiss"))
    first.unmount()
    renderPage()
    await loaded()
    expect(screen.queryByTestId("an-settings-banner")).toBeNull()
  })

  test("the dialog starts from the suggestions: asg, asg eye hospital, asgeyehospital", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    expect(within(dialog).getAllByTestId("an-brand-chip").map((c) => c.textContent)).toEqual(["asg", "asg eye hospital", "asgeyehospital"])
    expect(within(dialog).queryAllByTestId("an-keywords-chip")).toHaveLength(0)
    expect(within(dialog).getByTestId("an-brand-count").textContent).toBe("3/20")
  })

  test("the live preview changes as terms are typed — and nothing is requested", async () => {
    renderPage()
    await loaded()
    const before = calls().length
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    const read = (k) => within(dialog).getByTestId(`an-preview-${k}`).textContent
    expect(read("exact")).toBe("0%")
    const input = within(dialog).getByLabelText("Target keywords")
    fireEvent.change(input, { target: { value: "LASIK Surgery" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect(within(dialog).getAllByTestId("an-keywords-chip").map((c) => c.textContent)).toEqual(["lasik surgery"]))
    expect(read("exact")).not.toBe("0%")
    expect(calls()).toHaveLength(before)
  })

  test("Save stores both lists (cleaned) and the mix and the cloud change AT ONCE with no new data request", async () => {
    renderPage()
    await loaded()
    expect((await cloudItem("LASIK surgery")).getAttribute("data-type")).toBe("other")
    const before = calls().length
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    const input = within(dialog).getByLabelText("Target keywords")
    fireEvent.change(input, { target: { value: "  LASIK   Surgery , cataract surgery" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(within(dialog).getByTestId("an-settings-save"))
    await waitFor(() => expect(settingsSvc.save).toHaveBeenCalledTimes(1))
    expect(settingsSvc.save).toHaveBeenCalledWith("p1", { brandTerms: ["asg", "asg eye hospital", "asgeyehospital"], targetKeywords: ["lasik surgery", "cataract surgery"] })
    await waitFor(() => expect(screen.queryByTestId("an-settings-dialog")).toBeNull())
    await waitFor(async () => expect((await cloudItem("LASIK surgery")).getAttribute("data-type")).toBe("exact"))
    expect((await cloudItem("LASIK surgery in India")).getAttribute("data-type")).toBe("partial")
    expect(mixRow("exact").textContent).toContain("Exact service words, e.g. lasik surgery")
    expect(calls().slice(before).filter((c) => c.section === "anchor-profile")).toHaveLength(0)
    expect(await screen.findByText("Anchor settings saved. The anchor types were updated.")).toBeTruthy()
  })

  test("saved settings are what the next visit uses, and the 'no settings' hint is gone once keywords exist", async () => {
    saved = { saved: true, brand_terms: ["asg"], target_keywords: ["lasik surgery"], saved_at: "2026-10-27T09:00:00.000Z" }
    renderPage()
    await loaded()
    await waitFor(async () => expect((await cloudItem("LASIK surgery")).getAttribute("data-type")).toBe("exact"))
    expect(screen.queryByTestId("an-settings-banner")).toBeNull()
  })

  test("a failed save keeps the dialog open and says why", async () => {
    settingsSvc.save.mockRejectedValueOnce(Object.assign(new Error("You can save at most 20 brand terms. Remove some first."), { status: 400 }))
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    fireEvent.click(within(dialog).getByTestId("an-settings-save"))
    expect((await within(dialog).findByTestId("an-settings-error")).textContent).toBe("You can save at most 20 brand terms. Remove some first.")
    expect(screen.getByTestId("an-settings-dialog")).toBeTruthy()
  })

  test("chips: Enter and comma add, a pasted list is split, duplicates are ignored, × and Backspace remove", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    const input = within(dialog).getByLabelText("Brand terms")
    fireEvent.change(input, { target: { value: "ASG" } })
    fireEvent.keyDown(input, { key: "," })
    expect(within(dialog).getAllByTestId("an-brand-chip")).toHaveLength(3) // "asg" is already there
    fireEvent.paste(input, { clipboardData: { getData: () => "new one, other brand\nthird" } })
    await waitFor(() => expect(within(dialog).getAllByTestId("an-brand-chip")).toHaveLength(6))
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove third" }))
    expect(within(dialog).getAllByTestId("an-brand-chip")).toHaveLength(5)
    fireEvent.keyDown(input, { key: "Backspace" })
    expect(within(dialog).getAllByTestId("an-brand-chip")).toHaveLength(4)
    expect(within(dialog).getByTestId("an-brand-count").textContent).toBe("4/20")
  })

  test("a term that is too long, or a 21st brand term, is refused with a message", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    const input = within(dialog).getByLabelText("Brand terms")
    fireEvent.change(input, { target: { value: "x".repeat(81) } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect((await within(dialog).findByText("A term can be at most 80 characters.")).tagName).toBe("P")
    fireEvent.change(input, { target: { value: Array.from({ length: 17 }, (_, i) => `term${i}`).join(",") } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(within(dialog).getAllByTestId("an-brand-chip")).toHaveLength(20)
    fireEvent.change(input, { target: { value: "one more" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(await within(dialog).findByText(/You can add at most 20 brand terms/)).toBeTruthy()
  })

  test("Import from Organic Keywords with nothing cached: ONE request (top 50 by traffic), no brand keywords, at most 20 to tick", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    fireEvent.click(within(dialog).getByTestId("an-import"))
    const list = await within(dialog).findByTestId("an-import-list")
    expect(bySection("ranked-keywords")).toHaveLength(1)
    const expected = pickImportKeywords(mapKeywordsPage(pageEnvelope(REAL_ROWS.slice(0, 50))).rows.map((r) => ({ keyword: r.keyword, traffic: r.traffic })), ["asg", "asg eye hospital", "asgeyehospital"]).map((k) => k.keyword)
    const offered = within(list).getAllByTestId("an-import-pick").map((c) => c.closest("label").textContent)
    expect(offered.length).toBe(Math.min(20, expected.length))
    for (const text of offered) expect(text.toLowerCase()).not.toContain("asg")
  })

  test("a failed import says why and does not close the dialog", async () => {
    serve({ "ranked-keywords": apiError("The data service is temporarily unavailable. Please try again later.") })
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    fireEvent.click(within(dialog).getByTestId("an-import"))
    expect((await within(dialog).findByTestId("an-import-error")).textContent).toMatch(/temporarily unavailable/)
  })
})

describe("Anchors: export, refresh and states", () => {
  test("Export CSV reuses the cached profile: no request, 1,000 rows, the CURRENT types", async () => {
    saved = { saved: true, brand_terms: ["asg"], target_keywords: ["lasik surgery"], saved_at: "x" }
    renderPage()
    await loaded()
    await waitFor(() => expect(screen.getByTestId("an-export").disabled).toBe(false))
    const before = calls().length
    fireEvent.click(screen.getByTestId("an-export"))
    const [name, content] = csv.downloadCsv.mock.calls[0]
    expect(name).toMatch(/^anchors_asgeyehospital\.com_all_\d{4}-\d{2}-\d{2}\.csv$/)
    expect(countCsvLines(`${content}\r\n`).lines).toBe(1001) // quote-aware: some real anchors contain line breaks
    expect(content.split("\r\n").some((l) => /^LASIK surgery,Exact match,/.test(l))).toBe(true)
    expect(calls()).toHaveLength(before)
    expect(await screen.findByText("Exported 1,000 anchors.")).toBeTruthy()
  })

  test("Refresh asks the server to skip its cache for the profile, once", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("an-refresh"))
    await waitFor(() => expect(bySection("anchor-profile")).toHaveLength(2))
    expect(bySection("anchor-profile")[1].refresh).toBe(true)
    expect(bySection("anchors")).toHaveLength(0)
  })

  test("a refresh the server declined (data under a minute old) says so", async () => {
    serve({ "anchor-profile": (opts) => ok(envelope("anchor-profile", REAL_PROFILE, { refreshThrottled: Boolean(opts?.refresh) })) })
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("an-refresh"))
    expect(await screen.findByText(/refreshed less than a minute ago/)).toBeTruthy()
  })

  test("a failed profile is an inline error with Retry in each card; Retry loads the page", async () => {
    let fail = true
    serve({ "anchor-profile": () => { if (fail) throw apiError("The data service is temporarily unavailable. Please try again later."); return ok(envelope("anchor-profile", REAL_PROFILE)) } })
    renderPage()
    const alert = await within(await screen.findByTestId("an-mix")).findByRole("alert")
    expect(alert.textContent).toMatch(/temporarily unavailable/)
    fail = false
    fireEvent.click(within(alert).getByRole("button", { name: /Retry/ }))
    await loaded()
  })

  test("no anchors at all: a plain sentence, and nothing to export", async () => {
    serve({ "anchor-profile": envelope("anchor-profile", { totalCount: 0, items: [] }) })
    renderPage()
    expect((await screen.findAllByText("No anchors found for this domain yet.")).length).toBeGreaterThan(0)
    expect(screen.getByTestId("an-export").disabled).toBe(true)
    expect(screen.queryByTestId("an-detail")).toBeNull()
  })

  test("a project whose URL has no public domain name gets a plain explanation", async () => {
    serve({ "anchor-profile": apiError("The project's website does not have a public domain name", { status: 422, code: "INVALID_TARGET" }) })
    renderPage()
    expect(await screen.findByText(/does not have a public domain name, so its anchors cannot be loaded/)).toBeTruthy()
  })

  test("the settings failing to load does not stop the page: the suggestions are used", async () => {
    settingsSvc.get.mockRejectedValue(apiError("The data service is busy."))
    renderPage()
    await loaded()
    expect((await cloudItem("ASG Eye Hospital")).getAttribute("data-type")).toBe("branded")
  })
})
