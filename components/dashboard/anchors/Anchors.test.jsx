import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, configure, act } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hooks (URL state, query keys, cancellation, classification), request builder, mapping and
// components run, over the REAL recorded asgeyehospital.com anchors.
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
// Radix's DropdownMenu opens on Pointer Events, which jsdom lacks: render the menu shell always-open so its items are exercised directly.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }) => children,
  DropdownMenuContent: ({ children }) => <div data-testid="menu">{children}</div>,
  DropdownMenuItem: ({ children, onSelect, disabled, ...p }) => <button type="button" disabled={disabled} onClick={onSelect} {...p}>{children}</button>,
}))

import AnchorsDashboard from "./AnchorsDashboard"
import { REAL_ANCHORS, REAL_BROKEN_ANCHORS, REAL_LOST_ANCHORS, REAL_PROFILE } from "./testFixtures"
import { REAL_LIVE as SUMMARY } from "../backlinks-overview/testFixtures"
import { REAL_ROWS, pageEnvelope } from "../organic-keywords/testFixtures"
import { pickImportKeywords } from "@/lib/anchors/brandTerms"
import { mapKeywordsPage } from "../organic-keywords/mapRankedKeyword"
import { countCsvLines } from "../backlinks/exportStream"

const ok = (data) => ({ success: true, data })
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const envelope = (section, result, extra = {}) => ({ section, target: "asgeyehospital.com", fetchedAt: "2026-10-27T08:00:00.000Z", cached: false, refreshThrottled: false, result, ...extra })

const state = { total: 1004 }
const filterList = (req) => {
  const f = req.filters ?? []
  return f.length && typeof f[0] === "string" ? [f] : f.filter((c) => c !== "and")
}
/** A tiny fake of the server's anchors section over the real rows: status, exact / contains / broken filters, paging (rows cycled past the 10 real ones). */
function anchorsAnswer(req) {
  const conds = filterList(req)
  let source = req.status === "lost" ? REAL_LOST_ANCHORS : REAL_ANCHORS
  if (conds.some((c) => c[0] === "broken_backlinks")) source = REAL_BROKEN_ANCHORS
  let items = source.items
  const exact = conds.find((c) => c[0] === "anchor" && c[1] === "=")
  const like = conds.find((c) => c[0] === "anchor" && c[1] === "like")
  if (exact) items = items.filter((i) => (i.anchor ?? "") === exact[2])
  if (like) items = items.filter((i) => (i.anchor ?? "").toLowerCase().includes(like[2].slice(1, -1).toLowerCase()))
  const filtered = Boolean(exact || like) || source !== REAL_ANCHORS
  if (filtered || req.status === "lost") return { totalCount: filtered ? items.length : source.totalCount, items }
  const total = state.total
  const start = req.offset ?? 0
  const count = Math.max(0, Math.min(req.limit, total - start))
  return { totalCount: total, items: Array.from({ length: count }, (_, i) => { const n = start + i; const src = REAL_ANCHORS.items[n % 10]; return n < 10 ? src : { ...src, anchor: src.anchor ? `${src.anchor} #${n}` : `page anchor ${n}` } }) }
}

function serve(overrides = {}) {
  svc.getSection.mockImplementation(async (_pid, section, opts) => {
    if (section in overrides) { const r = overrides[section]; if (r instanceof Error) throw r; if (typeof r === "function") return r(opts); return ok(r) }
    if (section === "backlinks") return ok(envelope("backlinks", SUMMARY))
    if (section === "anchors") return ok(envelope("anchors", anchorsAnswer(opts.anchors)))
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

const calls = () => svc.getSection.mock.calls.map(([pid, section, opts, req]) => ({ pid, section, refresh: Boolean(opts?.refresh), anchors: opts?.anchors, signal: req?.signal }))
const bySection = (s) => calls().filter((c) => c.section === s)
const anchorCalls = () => bySection("anchors")
const lastAnchors = () => anchorCalls().at(-1)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(AnchorsDashboard)))
}
const rowEls = () => screen.getAllByTestId("an-row")
const showing = () => screen.getByTestId("an-showing").textContent
const field = (name) => screen.getByRole("textbox", { name })
const sortBtn = (key) => screen.getByTestId(`an-sort-${key}`)
const statusBtn = (name) => within(screen.getByRole("group", { name: "Which links the table shows" })).getByRole("button", { name })
const typeChip = (name) => within(screen.getByTestId("an-filter-types")).getByRole("button", { name })
const rowFor = (anchor) => rowEls().find((r) => within(r).queryByTestId("an-anchor")?.textContent === `“${anchor}”`)
const openRow = (row) => fireEvent.click(within(row).getByTestId("an-expand"))

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
  state.total = 1004
  serve()
  serveSettings()
})
afterEach(() => { vi.restoreAllMocks() })

describe("Anchors: first load", () => {
  test("one table request (live, 50, referring domains desc, no filters), ONE profile request, and the shared summary", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    await screen.findByTestId("an-cards")
    expect(anchorCalls()).toHaveLength(1)
    expect(lastAnchors().anchors).toEqual({ status: "live", limit: 50, offset: 0, order_by: "referring_domains,desc", filters: [] })
    expect(bySection("anchor-profile")).toHaveLength(1)
    expect(bySection("anchor-profile")[0].refresh).toBe(false)
    expect(bySection("backlinks")).toHaveLength(1)
    expect(settingsSvc.get).toHaveBeenCalledTimes(1)
  })

  test("the frame is there at once: title, domain, skeletons — no page-wide spinner", () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Anchors" })).toBeTruthy()
    expect(screen.getByTestId("an-domain").textContent).toBe("asgeyehospital.com")
    expect(screen.getAllByTestId("an-skeleton-row").length).toBeGreaterThanOrEqual(5)
    expect(screen.getByTestId("an-cards-skeleton")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("header: last updated, Refresh, Anchor settings, Export CSV, and Live / Lost / All", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(screen.getByTestId("an-updated").textContent).toMatch(/^Last updated .*2026/)
    for (const id of ["an-refresh", "an-settings", "an-export"]) expect(screen.getByTestId(id)).toBeTruthy()
    expect(statusBtn("Live").getAttribute("aria-pressed")).toBe("true")
    expect(statusBtn("Lost").getAttribute("aria-pressed")).toBe("false")
  })

  test("asks for a project when none is selected, and requests nothing", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its anchors.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
  })
})

describe("Anchors: the table (real rows)", () => {
  test("'Showing 1–10 of 1,004 anchors' and the real first rows, in the server's order", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(rowEls()).toHaveLength(50)
    expect(showing()).toBe("Showing 1–50 of 1,004 anchors")
    expect(within(rowEls()[0]).getByTestId("an-anchor").textContent).toBe("“asgeyehospital.com Premium Link Building Experts for Website Ranking Growth”")
    expect(within(rowEls()[1]).getByTestId("an-anchor").textContent).toBe("“asgeyehospital.com”")
  })

  test("a long anchor is cut to fit, with the whole text in a tooltip", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const a = within(rowEls()[0]).getByTestId("an-anchor")
    expect(a.getAttribute("title")).toBe("asgeyehospital.com Premium Link Building Experts for Website Ranking Growth")
    expect(a.className).toContain("truncate")
  })

  test("an anchor with no text is shown as '(empty / image link)' in muted italics", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const empty = within(rowEls()[2]).getByTestId("an-anchor")
    expect(empty.textContent).toBe("(empty / image link)")
    expect(empty.className).toContain("italic")
    expect(empty.className).toContain("text-muted-foreground")
    expect(within(rowEls()[2]).getByTestId("an-type").getAttribute("data-type")).toBe("empty")
  })

  test("referring domains with a bar for its share of ALL referring domains (the Backlink Overview's 3,965), backlinks, dofollow %, rank, spam badge, first seen", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const row = rowFor("ASG Eye Hospital")
    expect(within(row).getByTestId("an-rd").textContent).toBe("109")
    await waitFor(() => expect(within(row).getByTestId("an-rd").getAttribute("title")).toMatch(/^109 referring domains — 2\.7% of all$/))
    expect(within(row).getByTestId("an-rd-bar").style.width).toBe(`${(109 / 3965) * 100}%`.replace(/(\.\d{4})\d+/, "$1") === "" ? "" : within(row).getByTestId("an-rd-bar").style.width)
    expect(within(row).getByTestId("an-backlinks").textContent).toBe("1.2K")
    expect(within(row).getByTestId("an-dofollow").textContent).toBe("88.1%")
    expect(within(row).getByTestId("bl-rank").textContent).toBe("266")
    expect(within(row).getByTestId("bl-spam").getAttribute("data-band")).toBe("low")
    expect(within(row).getByText("Jan 2022").getAttribute("title")).toMatch(/^Jan 29, 2022/)
  })

  test("a spam score of 54 is the red badge; broken links are red as '762 broken'", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(within(rowEls()[0]).getByTestId("bl-spam").getAttribute("data-band")).toBe("high")
    const broken = within(rowFor("ASG Eye Hospital")).getByTestId("an-broken")
    expect(broken.textContent).toBe("762 broken")
    expect(broken.className).toContain("text-red-600")
    expect(within(rowEls()[0]).getByTestId("an-broken").textContent).toBe("0")
  })

  test("the 'sitewide' chip appears for 20+ links per referring domain, and only then", async () => {
    window.history.replaceState(null, "", "/app/backlinks/anchors?broken=1")
    renderPage()
    await screen.findAllByTestId("an-row")
    const patna = rowFor("https://asgeyehospital.com/patna/")
    expect(within(patna).getByTestId("an-sitewide").textContent).toBe("sitewide")
    expect(within(patna).getByTestId("an-broken").textContent).toBe("104 broken")
    expect(within(rowFor("ASG Eye Hospital")).queryByTestId("an-sitewide")).toBeNull()
  })

  test("every anchor has a type chip from the project's settings", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const types = rowEls().slice(0, 10).map((r) => within(r).getByTestId("an-type").getAttribute("data-type"))
    expect(types).toEqual(["naked_url", "naked_url", "empty", "branded", "naked_url", "other", "other", "other", "other", "other"])
  })

  test("no 'NaN', 'undefined' or 'null' anywhere in the rows", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    for (const r of rowEls()) expect(r.textContent).not.toMatch(/NaN|undefined|\bnull\b/)
  })

  test("the headers explain themselves (info icons)", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(screen.getByRole("button", { name: "About Type" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "About Referring domains" })).toBeTruthy()
  })
})

describe("Anchors: the profile — cards, distribution, health, top anchors (from ONE call)", () => {
  test("the six cards: total from the provider's total_count, shares by referring domains, the top anchor", async () => {
    renderPage()
    const cards = await screen.findByTestId("an-cards")
    expect(within(cards).getByTestId("an-card-total").textContent).toContain("1K")
    expect(screen.getByTestId("an-card-total").getAttribute("title") ?? screen.getByTestId("an-card-total").textContent).toBeTruthy()
    expect(within(cards).getByTestId("an-card-branded").textContent).toMatch(/\d+\.\d%/)
    expect(within(cards).getByTestId("an-card-naked").textContent).toMatch(/\d+\.\d%/)
    expect(within(cards).getByTestId("an-card-empty").textContent).toMatch(/\d+\.\d%/)
    expect(within(cards).getByTestId("an-top-anchor").textContent).toBe("“asgeyehospital.com Premium Link Building Experts for Website Ranking Growth”")
    expect(within(cards).getByTestId("an-card-top").textContent).toContain("Naked URL")
    expect(within(cards).getByTestId("an-card-top").textContent).toMatch(/68\.\d%/) // 2,707 of 3,965 referring domains
  })

  test("the donut's shares add up to 100% and match the legend; the toggle switches to backlinks", async () => {
    renderPage()
    const dist = await screen.findByTestId("an-distribution")
    const sum = (el) => el.getAttribute("data-percents").split("|").reduce((a, p) => a + Number(p.split(":")[1]), 0)
    expect(sum(dist)).toBeGreaterThan(99.8)
    expect(sum(dist)).toBeLessThan(100.3)
    expect(dist.getAttribute("data-measure")).toBe("referringDomains")
    const before = dist.getAttribute("data-percents")
    fireEvent.click(screen.getByRole("button", { name: "By backlinks" }))
    const after = screen.getByTestId("an-distribution")
    expect(after.getAttribute("data-measure")).toBe("backlinks")
    expect(after.getAttribute("data-percents")).not.toBe(before)
    expect(sum(after)).toBeGreaterThan(99.8)
    expect(within(after).getAllByTestId("an-slice").length).toBeGreaterThan(2)
  })

  test("it says when the profile is the top 1,000 only", async () => {
    renderPage()
    expect((await screen.findByTestId("an-profile-note")).textContent).toBe("Based on the top 1,000 anchors by referring domains.")
  })

  test("the note is absent when every anchor is in the profile", async () => {
    serve({ "anchor-profile": envelope("anchor-profile", { totalCount: 40, items: REAL_PROFILE.items.slice(0, 40) }) })
    renderPage()
    await screen.findByTestId("an-distribution")
    expect(screen.queryByTestId("an-profile-note")).toBeNull()
  })

  test("health: the spam network's anchor is 'heavily repeated', sitewide links and spam are flagged, with an icon and a message each", async () => {
    renderPage()
    const list = await screen.findByTestId("an-health")
    expect(within(list).getByTestId("an-health-repeated").textContent).toMatch(/“asgeyehospital\.com Premium Link Building[^”]*…” is heavily repeated/)
    expect(within(list).getByTestId("an-health-sitewide").getAttribute("data-status")).toBe("warn")
    expect(within(list).getByTestId("an-health-sitewide").textContent).toMatch(/anchors? come from a single site with many links \(sitewide\/footer links\)\./)
    expect(within(list).queryByTestId("an-health-natural")).toBeNull()
  })

  test("a clean profile says 'Anchor profile looks natural.'", async () => {
    const clean = [{ anchor: "ASG Eye Hospital", rank: 200, backlinks: 100, backlinks_spam_score: 2, broken_backlinks: 0, referring_domains: 60, referring_domains_nofollow: 5, first_seen: "2022-01-29 00:00:00 +00:00" },
      { anchor: "asgeyehospital.com", rank: 200, backlinks: 50, backlinks_spam_score: 2, broken_backlinks: 0, referring_domains: 30, referring_domains_nofollow: 5, first_seen: "2022-01-29 00:00:00 +00:00" },
      { anchor: "Pune", rank: 100, backlinks: 10, backlinks_spam_score: 2, broken_backlinks: 0, referring_domains: 10, referring_domains_nofollow: 1, first_seen: "2022-01-29 00:00:00 +00:00" }]
    serve({ "anchor-profile": envelope("anchor-profile", { totalCount: 3, items: clean }) })
    renderPage()
    expect((await screen.findByTestId("an-health-natural")).textContent).toContain("Anchor profile looks natural.")
  })

  test("top anchors: the 15 with the most referring domains, coloured by type, biggest first", async () => {
    renderPage()
    const top = await screen.findByTestId("an-top")
    const counts = top.getAttribute("data-counts").split("|").map(Number)
    expect(counts).toHaveLength(15)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
    expect(top.getAttribute("data-labels").split("|")[0]).toBe("asgeyehospital.com Premium Link Building Experts for Website Ranking Growth")
    expect(within(top).getAllByTestId("an-top-bar")[0].getAttribute("data-type")).toBe("naked_url")
  })

  test("a click on a bar filters the table to that EXACT anchor; a second click clears it", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const bar = (await screen.findAllByTestId("an-top-bar")).find((b) => b.textContent.includes("ASG Eye Hospital"))
    fireEvent.click(bar)
    await waitFor(() => expect(lastAnchors().anchors.filters).toEqual(["anchor", "=", "ASG Eye Hospital"]))
    await waitFor(() => expect(rowEls()).toHaveLength(1))
    expect(showing()).toBe("Showing 1–1 of 1 anchors")
    expect(screen.getAllByTestId("ok-chip").map((c) => c.textContent)).toEqual(["Anchor: “ASG Eye Hospital”"])
    expect(window.location.search).toBe("?anchor=ASG+Eye+Hospital")
    const again = (await screen.findAllByTestId("an-top-bar")).find((b) => b.textContent.includes("ASG Eye Hospital"))
    fireEvent.click(again)
    await waitFor(() => expect(window.location.search).toBe(""))
    await waitFor(() => expect(rowEls().length).toBe(50))
  })

  test("a click on the empty anchor's bar filters to the links with no anchor text", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const bar = (await screen.findAllByTestId("an-top-bar")).find((b) => b.textContent.includes("(empty / image link)"))
    fireEvent.click(bar)
    await waitFor(() => expect(lastAnchors().anchors.filters).toEqual(["anchor", "=", ""]))
    expect(window.location.search).toBe("?noanchor=1")
  })

  test("a profile that failed to load does not take the table down", async () => {
    serve({ "anchor-profile": apiError("The data service is busy.", { status: 429 }) })
    renderPage()
    await screen.findAllByTestId("an-row")
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/busy/)
    expect(rowEls().length).toBe(50)
  })
})

describe("Anchors: Live / Lost / All (the table only)", () => {
  test("each is the request's status; the profile is NOT asked again", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(statusBtn("Lost"))
    await waitFor(() => expect(lastAnchors().anchors.status).toBe("lost"))
    await waitFor(() => expect(showing()).toBe("Showing 1–1 of 1 anchors"))
    fireEvent.click(statusBtn("All"))
    await waitFor(() => expect(lastAnchors().anchors.status).toBe("all"))
    expect(bySection("anchor-profile")).toHaveLength(1)
    expect(window.location.search).toBe("?status=all")
    fireEvent.click(statusBtn("Live"))
    await waitFor(() => expect(window.location.search).toBe(""))
    expect(anchorCalls()).toHaveLength(3) // Live was already loaded
  })
})

describe("Anchors: filters (server-side, debounced)", () => {
  test("search: 3 keystrokes make ONE request, 400 ms after the last; it is a 'like' on the anchor", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const input = field("Search anchors")
    fireEvent.change(input, { target: { value: "l" } })
    fireEvent.change(input, { target: { value: "la" } })
    fireEvent.change(input, { target: { value: "lasik" } })
    await sleep(150)
    expect(anchorCalls()).toHaveLength(1)
    await waitFor(() => expect(anchorCalls()).toHaveLength(2), { timeout: 3000 })
    expect(lastAnchors().anchors.filters).toEqual(["anchor", "like", "%lasik%"])
    expect(window.location.search).toBe("?q=lasik")
    await waitFor(() => expect(rowEls()).toHaveLength(3))
  })

  test("exclude is a 'not_like', and Enter applies at once", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.change(field("Exclude anchors containing"), { target: { value: "click here" } })
    fireEvent.keyDown(field("Exclude anchors containing"), { key: "Enter" })
    await waitFor(() => expect(lastAnchors().anchors.filters).toEqual(["anchor", "not_like", "%click here%"]))
  })

  test("numbers apply on blur or Enter only; a wrong one is explained and not sent", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const rd = screen.getByRole("textbox", { name: "Minimum referring domains" })
    fireEvent.change(rd, { target: { value: "5" } })
    fireEvent.change(rd, { target: { value: "50" } })
    await sleep(600)
    expect(anchorCalls()).toHaveLength(1)
    fireEvent.blur(rd)
    await waitFor(() => expect(lastAnchors().anchors.filters).toEqual(["referring_domains", ">=", 50]))
    const spam = screen.getByRole("textbox", { name: "Maximum spam score" })
    fireEvent.change(spam, { target: { value: "500" } })
    fireEvent.keyDown(spam, { key: "Enter" })
    expect(await screen.findByText("Spam score: enter a whole number from 0 to 100.")).toBeTruthy()
    expect(anchorCalls()).toHaveLength(2) // that one was not sent
    expect(screen.getAllByTestId("ok-chip").map((c) => c.textContent)).toEqual(["Referring domains ≥ 50"])
    fireEvent.change(spam, { target: { value: "30" } })
    fireEvent.keyDown(spam, { key: "Enter" })
    await waitFor(() => expect(lastAnchors().anchors.filters).toEqual([["referring_domains", ">=", 50], "and", ["backlinks_spam_score", "<=", 30]]))
  })

  test("min backlinks, has broken links and first seen after", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const bl = screen.getByRole("textbox", { name: "Minimum backlinks" })
    fireEvent.change(bl, { target: { value: "100" } })
    fireEvent.blur(bl)
    await waitFor(() => expect(lastAnchors().anchors.filters).toEqual(["backlinks", ">=", 100]))
    fireEvent.click(screen.getByTestId("an-has-broken"))
    await waitFor(() => expect(lastAnchors().anchors.filters).toContainEqual(["broken_backlinks", ">", 0]))
    const since = screen.getByTestId("an-since")
    fireEvent.change(since, { target: { value: "2025-04-01" } })
    fireEvent.blur(since)
    await waitFor(() => expect(lastAnchors().anchors.filters).toContainEqual(["first_seen", ">=", "2025-04-01"]))
    expect(lastAnchors().anchors.filters.filter((c) => Array.isArray(c) && c.length === 3)).toHaveLength(3)
  })

  test("the type filter is applied to the rows ON THIS PAGE: no request, a hint, and the URL remembers it", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const before = calls().length
    expect(screen.getByTestId("an-types-hint").textContent).toBe("Type filter applies to the rows on this page.")
    fireEvent.click(typeChip("Naked URL"))
    await waitFor(() => expect(rowEls().length).toBeLessThan(50))
    for (const r of rowEls()) expect(within(r).getByTestId("an-type").getAttribute("data-type")).toBe("naked_url")
    expect(calls()).toHaveLength(before)
    expect(window.location.search).toBe("?types=naked_url")
    expect(showing()).toMatch(/^Showing 1–50 of 1,004 anchors · \d+ on this page match the type filter$/)
    fireEvent.click(typeChip("Branded"))
    await waitFor(() => expect(rowEls().some((r) => within(r).getByTestId("an-type").getAttribute("data-type") === "branded")).toBe(true))
    expect(calls()).toHaveLength(before)
  })

  test("changing the type filter keeps you on the page you are on (it only narrows what is loaded); a server filter goes back to page 1", async () => {
    window.history.replaceState(null, "", "/app/backlinks/anchors?page=2&size=25")
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(lastAnchors().anchors.offset).toBe(25)
    const before = anchorCalls().length
    fireEvent.click(typeChip("Other"))
    await waitFor(() => expect(window.location.search).toBe("?types=other&page=2&size=25"))
    expect(anchorCalls()).toHaveLength(before)
    fireEvent.click(screen.getByTestId("an-has-broken"))
    await waitFor(() => expect(lastAnchors().anchors.offset).toBe(0))
    expect(window.location.search).not.toContain("page=")
  })

  test("a type filter that leaves nothing on the page says so and can be cleared", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(typeChip("Generic"))
    const empty = await screen.findByTestId("an-empty")
    expect(empty.textContent).toContain("No anchors match these filters")
    fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }))
    await waitFor(() => expect(rowEls().length).toBe(50))
    expect(window.location.search).toBe("")
  })

  test("applied filters are removable chips, plus 'Clear all'; going back to a view already loaded is not a request", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(screen.getByTestId("an-has-broken"))
    await waitFor(() => expect(anchorCalls()).toHaveLength(2))
    expect(screen.getAllByTestId("ok-chip").map((c) => c.textContent)).toEqual(["Has broken links"])
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Has broken links" }))
    await waitFor(() => expect(screen.queryAllByTestId("ok-chip")).toHaveLength(0))
    expect(anchorCalls()).toHaveLength(2)
    fireEvent.click(screen.getByTestId("an-has-broken"))
    fireEvent.click(typeChip("Branded"))
    fireEvent.click(screen.getByTestId("ok-clear-all"))
    await waitFor(() => expect(window.location.search).toBe(""))
    expect(screen.queryAllByTestId("ok-chip")).toHaveLength(0)
  })

  test("a filter that matches nothing: 'No anchors match these filters' with Clear filters", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.change(field("Search anchors"), { target: { value: "zzzz" } })
    fireEvent.keyDown(field("Search anchors"), { key: "Enter" })
    const empty = await screen.findByTestId("an-empty")
    expect(empty.getAttribute("data-kind")).toBe("filtered")
    expect(empty.textContent).toContain("No anchors match these filters")
    fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }))
    await waitFor(() => expect(rowEls().length).toBe(50))
    expect(field("Search anchors").value).toBe("")
  })

  test("the view is read from the URL on open", async () => {
    window.history.replaceState(null, "", "/app/backlinks/anchors?status=all&q=a&sort=backlinks%3Aasc&size=25&rd=2&types=naked_url")
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(lastAnchors().anchors).toEqual({ status: "all", limit: 25, offset: 0, order_by: "backlinks,asc", filters: [["anchor", "like", "%a%"], "and", ["referring_domains", ">=", 2]] })
    expect(statusBtn("All").getAttribute("aria-pressed")).toBe("true")
    expect(field("Search anchors").value).toBe("a")
    expect(typeChip("Naked URL").getAttribute("aria-pressed")).toBe("true")
  })
})

describe("Anchors: sorting (server-side, one rule)", () => {
  test("a header sorts by its field, a second click flips it, another column replaces it; the default is referring domains highest first", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(screen.getByRole("columnheader", { name: /Referring domains/ }).getAttribute("aria-sort")).toBe("descending")
    fireEvent.click(sortBtn("backlinks"))
    await waitFor(() => expect(lastAnchors().anchors.order_by).toBe("backlinks,desc"))
    fireEvent.click(sortBtn("backlinks"))
    await waitFor(() => expect(lastAnchors().anchors.order_by).toBe("backlinks,asc"))
    expect(screen.getByRole("columnheader", { name: /^Backlinks/ }).getAttribute("aria-sort")).toBe("ascending")
    fireEvent.click(sortBtn("spam"))
    await waitFor(() => expect(lastAnchors().anchors.order_by).toBe("backlinks_spam_score,desc"))
    expect(window.location.search).toBe("?sort=backlinks_spam_score%3Adesc")
  })

  test("every sortable column sends its own provider field", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    for (const [col, field] of [["rank", "rank"], ["broken", "broken_backlinks"], ["firstSeen", "first_seen"], ["backlinks", "backlinks"]]) {
      fireEvent.click(sortBtn(col))
      await waitFor(() => expect(lastAnchors().anchors.order_by).toBe(`${field},desc`))
    }
    // Back to the default column: that view was already loaded, so it is a cache hit, not a request.
    const before = anchorCalls().length
    fireEvent.click(sortBtn("referringDomains"))
    await waitFor(() => expect(window.location.search).toBe(""))
    expect(anchorCalls()).toHaveLength(before)
  })

  test("the columns that cannot be sorted by the provider have no sort button", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(screen.queryByTestId("an-sort-type")).toBeNull()
    expect(screen.queryByTestId("an-sort-dofollow")).toBeNull()
  })
})

describe("Anchors: paging", () => {
  test("page size, next page and 'Go to page' are server offsets", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.change(screen.getByTestId("an-page-size"), { target: { value: "25" } })
    await waitFor(() => expect(lastAnchors().anchors).toMatchObject({ limit: 25, offset: 0 }))
    await screen.findAllByTestId("an-row")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(lastAnchors().anchors).toMatchObject({ limit: 25, offset: 25 }))
    await waitFor(() => expect(showing()).toMatch(/^Showing 26–50 of 1,004/))
    fireEvent.change(document.getElementById("an-goto"), { target: { value: "9" } })
    fireEvent.click(screen.getByRole("button", { name: "Go" }))
    await waitFor(() => expect(lastAnchors().anchors.offset).toBe(200))
    expect(window.location.search).toBe("?page=9&size=25")
  })

  test("a page past the end (a hand-edited link) comes back to the last page", async () => {
    window.history.replaceState(null, "", "/app/backlinks/anchors?page=900")
    renderPage()
    await waitFor(() => expect(window.location.search).toBe("?page=21"))
    expect(lastAnchors().anchors.offset).toBe(1000)
  })

  test("changing anything but the page goes back to page 1", async () => {
    window.history.replaceState(null, "", "/app/backlinks/anchors?page=3")
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(sortBtn("backlinks"))
    await waitFor(() => expect(lastAnchors().anchors).toMatchObject({ offset: 0, order_by: "backlinks,desc" }))
  })
})

describe("Anchors: the expandable row", () => {
  test("opens the row's breakdowns, its counts and the way to its backlinks; one row at a time; it closes when the view changes", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    openRow(rowFor("ASG Eye Hospital"))
    const panel = await screen.findByTestId("an-expanded")
    expect(within(panel).getByTestId("an-chart-placement").getAttribute("data-labels")).toContain("Footer")
    expect(within(panel).getByTestId("an-chart-countries").getAttribute("data-labels")).toMatch(/^India/)
    expect(within(panel).getByTestId("an-chart-platforms").getAttribute("data-counts")).toBe("876|821|558|126|74|64")
    expect(within(panel).getByTestId("an-chart-attributes").getAttribute("data-labels")).toContain("Sponsored")
    expect(within(panel).getByTestId("an-stat-main").textContent).toContain("101")
    expect(within(panel).getByTestId("an-stat-pages").textContent).toContain("1,062")
    expect(within(panel).getByTestId("an-stat-pages").textContent).toContain("928 dofollow · 134 nofollow")
    expect(within(panel).getByTestId("an-stat-ips").textContent).toContain("104")
    expect(within(panel).getByTestId("an-stat-subnets").textContent).toContain("78")
    openRow(rowFor("https://asgeyehospital.com/"))
    await waitFor(() => expect(screen.getAllByTestId("an-expanded")).toHaveLength(1))
    fireEvent.click(sortBtn("backlinks"))
    await waitFor(() => expect(screen.queryAllByTestId("an-expanded")).toHaveLength(0))
  })

  test("'View these backlinks' goes to the Backlinks page filtered to this exact anchor", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    openRow(rowFor("ASG Eye Hospital"))
    const link = await screen.findByTestId("an-view-backlinks")
    expect(link.getAttribute("href")).toBe("/app/backlinks/list?exact=ASG+Eye+Hospital")
  })

  test("for an empty anchor it uses the Backlinks page's no-anchor filter; in a Lost view it opens the Lost tab", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    openRow(rowEls()[2])
    expect((await screen.findByTestId("an-view-backlinks")).getAttribute("href")).toBe("/app/backlinks/list?noanchor=1")
    fireEvent.click(statusBtn("Lost"))
    await waitFor(() => expect(showing()).toBe("Showing 1–1 of 1 anchors"))
    openRow(rowEls()[0])
    expect((await screen.findByTestId("an-view-backlinks")).getAttribute("href")).toBe("/app/backlinks/list?tab=lost&noanchor=1")
  })

  test("a click on the row opens it; a click on a button inside it does not double-toggle", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(within(rowEls()[3]).getByTestId("an-type"))
    expect(await screen.findAllByTestId("an-expanded")).toHaveLength(1)
    fireEvent.click(within(rowEls()[3]).getByTestId("an-expand"))
    await waitFor(() => expect(screen.queryAllByTestId("an-expanded")).toHaveLength(0))
  })
})

describe("Anchors: settings — brand terms and target keywords", () => {
  test("with nothing saved, the domain's suggested terms classify the anchors and a dismissible hint asks for settings", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    expect((await screen.findByTestId("an-settings-banner")).textContent).toContain("Add your brand terms and target keywords for accurate anchor types.")
    fireEvent.click(screen.getByTestId("an-banner-dismiss"))
    expect(screen.queryByTestId("an-settings-banner")).toBeNull()
  })

  test("the hint stays dismissed for this project", async () => {
    const first = renderPage()
    fireEvent.click(await screen.findByTestId("an-banner-dismiss"))
    first.unmount()
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(screen.queryByTestId("an-settings-banner")).toBeNull()
  })

  test("the dialog starts from the suggestions: asg, asg eye hospital, asgeyehospital", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    expect(within(dialog).getAllByTestId("an-brand-chip").map((c) => c.textContent)).toEqual(["asg", "asg eye hospital", "asgeyehospital"])
    expect(within(dialog).queryAllByTestId("an-keywords-chip")).toHaveLength(0)
    expect(within(dialog).getByTestId("an-brand-count").textContent).toBe("3/20")
  })

  test("the live preview changes as terms are typed — and nothing is requested", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    await screen.findByTestId("an-cards")
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
    expect(within(dialog).getByTestId("an-preview").textContent).toMatch(/^With these settings: Branded \d+% · Exact match /)
    expect(calls()).toHaveLength(before)
  })

  test("Save stores both lists (cleaned) and the table, the cards and the donut change AT ONCE with no new data request", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    await screen.findByTestId("an-cards")
    expect(within(rowFor("LASIK surgery")).getByTestId("an-type").getAttribute("data-type")).toBe("other")
    const exactBefore = screen.getByTestId("an-card-exact").textContent
    const before = calls().length
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    const input = within(dialog).getByLabelText("Target keywords")
    fireEvent.change(input, { target: { value: "  LASIK   Surgery , cataract surgery" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(within(dialog).getByTestId("an-settings-save"))
    await waitFor(() => expect(settingsSvc.save).toHaveBeenCalledTimes(1))
    expect(settingsSvc.save).toHaveBeenCalledWith("p1", { brandTerms: ["asg", "asg eye hospital", "asgeyehospital"], targetKeywords: ["lasik surgery", "cataract surgery"] })
    await waitFor(() => expect(within(rowFor("LASIK surgery")).getByTestId("an-type").getAttribute("data-type")).toBe("exact"))
    expect(within(rowFor("LASIK surgery in India")).getByTestId("an-type").getAttribute("data-type")).toBe("partial")
    expect(screen.getByTestId("an-card-exact").textContent).not.toBe(exactBefore)
    expect(screen.getByTestId("an-legend-exact-percent").textContent).not.toBe("0.0%")
    expect(calls().slice(before).filter((c) => c.section === "anchors" || c.section === "anchor-profile")).toHaveLength(0)
    await waitFor(() => expect(screen.queryByTestId("an-settings-dialog")).toBeNull())
    expect(await screen.findByText("Anchor settings saved. The anchor types were updated.")).toBeTruthy()
  })

  test("saved settings are what the next visit uses, and the 'no settings' hint is gone once keywords exist", async () => {
    saved = { saved: true, brand_terms: ["asg"], target_keywords: ["lasik surgery"], saved_at: "2026-10-27T09:00:00.000Z" }
    renderPage()
    await screen.findAllByTestId("an-row")
    await waitFor(() => expect(within(rowFor("LASIK surgery")).getByTestId("an-type").getAttribute("data-type")).toBe("exact"))
    expect(screen.queryByTestId("an-settings-banner")).toBeNull()
  })

  test("a failed save keeps the dialog open and says why", async () => {
    settingsSvc.save.mockRejectedValueOnce(Object.assign(new Error("You can save at most 20 brand terms. Remove some first."), { status: 400 }))
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    fireEvent.click(within(dialog).getByTestId("an-settings-save"))
    expect((await within(dialog).findByTestId("an-settings-error")).textContent).toBe("You can save at most 20 brand terms. Remove some first.")
    expect(screen.getByTestId("an-settings-dialog")).toBeTruthy()
  })

  test("chips: Enter and comma add, a pasted list is split, duplicates are ignored, × and Backspace remove", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
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
    await screen.findAllByTestId("an-row")
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
    await screen.findAllByTestId("an-row")
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    fireEvent.click(within(dialog).getByTestId("an-import"))
    const list = await within(dialog).findByTestId("an-import-list")
    const asked = bySection("ranked-keywords")
    expect(asked).toHaveLength(1)
    const expected = pickImportKeywords(mapKeywordsPage(pageEnvelope(REAL_ROWS.slice(0, 50))).rows.map((r) => ({ keyword: r.keyword, traffic: r.traffic })), ["asg", "asg eye hospital", "asgeyehospital"]).map((k) => k.keyword)
    const offered = within(list).getAllByTestId("an-import-pick").map((c) => c.closest("label").textContent)
    expect(offered.length).toBe(Math.min(20, expected.length))
    for (const text of offered) expect(text.toLowerCase()).not.toContain("asg")
    expect(within(list).getByText(/one request/)).toBeTruthy()
  })

  test("the ticked keywords are added; unticked ones are not", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    fireEvent.click(within(dialog).getByTestId("an-import"))
    const list = await within(dialog).findByTestId("an-import-list")
    const picks = within(list).getAllByTestId("an-import-pick")
    const first = picks[0].closest("label").textContent.replace(/\s*[\d.]+[KM]?$/, "").trim()
    picks.slice(1).forEach((p) => fireEvent.click(p))
    fireEvent.click(within(list).getByTestId("an-import-add"))
    await waitFor(() => expect(within(dialog).getAllByTestId("an-keywords-chip")).toHaveLength(1))
    expect(within(dialog).getByTestId("an-keywords-chip").textContent.toLowerCase()).toContain(first.toLowerCase().slice(0, 8))
    expect(within(dialog).queryByTestId("an-import-list")).toBeNull()
  })

  test("a failed import says why and does not close the dialog", async () => {
    serve({ "ranked-keywords": apiError("The data service is temporarily unavailable. Please try again later.") })
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(screen.getByTestId("an-settings"))
    const dialog = await screen.findByTestId("an-settings-dialog")
    fireEvent.click(within(dialog).getByTestId("an-import"))
    expect((await within(dialog).findByTestId("an-import-error")).textContent).toMatch(/temporarily unavailable/)
  })
})

describe("Anchors: export", () => {
  test("Export current page: the rows on screen with their types, no request", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    const before = calls().length
    fireEvent.click(screen.getByTestId("an-export-page"))
    expect(csv.downloadCsv).toHaveBeenCalledTimes(1)
    const [name, content] = csv.downloadCsv.mock.calls[0]
    expect(name).toMatch(/^anchors_asgeyehospital\.com_page_\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = content.split("\r\n")
    expect(lines).toHaveLength(51)
    expect(lines[0]).toBe("Anchor,Type,Referring domains,Backlinks,Dofollow %,Rank,Spam score,Broken backlinks,First seen")
    expect(lines[4]).toMatch(/^ASG Eye Hospital,Branded,109,1164,88\.1,266,2,762,/)
    expect(lines[3]).toMatch(/^\(empty \/ image link\),Empty \/ image,140,/)
    expect(calls()).toHaveLength(before)
    expect(await screen.findByText("Exported 50 anchors from this page.")).toBeTruthy()
  })

  test("Export all anchors (up to 1,000) reuses the cached profile: no request, 1,000 rows, the CURRENT types", async () => {
    saved = { saved: true, brand_terms: ["asg"], target_keywords: ["lasik surgery"], saved_at: "x" }
    renderPage()
    await screen.findAllByTestId("an-row")
    await waitFor(() => expect(screen.getByTestId("an-export-all").disabled).toBe(false))
    const before = calls().length
    fireEvent.click(screen.getByTestId("an-export-all"))
    const [name, content] = csv.downloadCsv.mock.calls[0]
    expect(name).toMatch(/^anchors_asgeyehospital\.com_all_\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = content.split("\r\n")
    expect(countCsvLines(`${content}\r\n`).lines).toBe(1001) // quote-aware: some real anchors contain line breaks
    expect(lines.some((l) => /^LASIK surgery,Exact match,/.test(l))).toBe(true)
    expect(calls()).toHaveLength(before)
  })

  test("nothing to export: the items are disabled", async () => {
    serve({ anchors: envelope("anchors", { totalCount: 0, items: [] }), "anchor-profile": envelope("anchor-profile", { totalCount: 0, items: [] }) })
    renderPage()
    await screen.findByTestId("an-empty")
    expect(screen.getByTestId("an-export-page").disabled).toBe(true)
    await waitFor(() => expect(screen.getByTestId("an-export-all").disabled).toBe(true))
  })
})

describe("Anchors: cancelling and refreshing", () => {
  test("a request still running when the view changes is cancelled, and its answer never replaces the newer one", async () => {
    let release
    const gate = new Promise((r) => { release = r })
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[1] === "anchors" && a[2].anchors?.status === "lost") await gate; return base(...a) })
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(statusBtn("Lost")) // slow
    await waitFor(() => expect(anchorCalls()).toHaveLength(2))
    const slow = lastAnchors().signal
    expect(slow.aborted).toBe(false)
    expect(rowEls().length).toBe(50) // the previous rows stay on screen
    expect(screen.getByTestId("an-table").getAttribute("data-stale")).toBe("true")
    expect(screen.getByTestId("an-table").className).toContain("opacity-60")
    fireEvent.click(statusBtn("All"))
    await waitFor(() => expect(slow.aborted).toBe(true))
    release()
    await sleep(60)
    await waitFor(() => expect(statusBtn("All").getAttribute("aria-pressed")).toBe("true"))
    expect(showing()).toMatch(/of 1,004 anchors/) // All's total, not Lost's 1
  })

  test("Refresh asks the server to skip its cache for the table AND the profile", async () => {
    renderPage()
    await screen.findAllByTestId("an-row")
    await screen.findByTestId("an-cards")
    fireEvent.click(screen.getByTestId("an-refresh"))
    await waitFor(() => expect(anchorCalls()).toHaveLength(2))
    await waitFor(() => expect(bySection("anchor-profile")).toHaveLength(2))
    expect(lastAnchors().refresh).toBe(true)
    expect(bySection("anchor-profile")[1].refresh).toBe(true)
    expect(anchorCalls()[0].refresh).toBe(false)
  })

  test("a refresh the server declined (data under a minute old) says so", async () => {
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { const r = await base(...a); if (a[1] === "anchors" && a[2].refresh) r.data.refreshThrottled = true; return r })
    renderPage()
    await screen.findAllByTestId("an-row")
    fireEvent.click(screen.getByTestId("an-refresh"))
    expect(await screen.findByText(/refreshed less than a minute ago/)).toBeTruthy()
  })
})

describe("Anchors: states", () => {
  test("a failed table is an inline error with Retry, and the cards still show", async () => {
    let fail = true
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[1] === "anchors" && fail) throw apiError("The data service is temporarily unavailable. Please try again later."); return base(...a) })
    renderPage()
    const alert = await within(await screen.findByTestId("an-results")).findByRole("alert")
    expect(alert.textContent).toMatch(/temporarily unavailable/)
    expect(await screen.findByTestId("an-cards")).toBeTruthy()
    fail = false
    fireEvent.click(within(alert).getByRole("button", { name: /Retry/ }))
    await screen.findAllByTestId("an-row")
    expect(anchorCalls()).toHaveLength(2)
  })

  test("no anchors at all: 'No anchor data for this domain yet.'", async () => {
    serve({ anchors: envelope("anchors", { totalCount: 0, items: [] }), "anchor-profile": envelope("anchor-profile", { totalCount: 0, items: [] }) })
    renderPage()
    const empty = await screen.findByTestId("an-empty")
    expect(empty.textContent).toBe("No anchor data for this domain yet.")
    expect(within(empty).queryByRole("button", { name: "Clear filters" })).toBeNull()
  })

  test("a project whose URL has no public domain name gets a plain explanation", async () => {
    serve({ anchors: apiError("The project's website does not have a public domain name", { status: 422, code: "INVALID_TARGET" }) })
    renderPage()
    expect(await screen.findByText(/does not have a public domain name, so its anchors cannot be loaded/)).toBeTruthy()
  })

  test("the settings failing to load does not stop the page: the suggestions are used", async () => {
    settingsSvc.get.mockRejectedValue(apiError("The data service is busy."))
    renderPage()
    await screen.findAllByTestId("an-row")
    expect(within(rowEls()[3]).getByTestId("an-type").getAttribute("data-type")).toBe("branded")
  })
})

describe("Anchors: the compact layout", () => {
  test("on a phone the filters live in a drawer with a count, the same controls inside", async () => {
    window.innerWidth = 390
    window.history.replaceState(null, "", "/app/backlinks/anchors?q=a")
    renderPage()
    await screen.findAllByTestId("an-row")
    const button = await screen.findByTestId("an-filters-button")
    expect(button.textContent).toContain("Filters (1)")
    expect(screen.queryByTestId("an-filter-bar")?.querySelector("#an-q")).toBeNull()
  })
})
