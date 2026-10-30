import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hooks (URL state, query keys, cancellation, debounce), mapping and components run.
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const settingsSvc = vi.hoisted(() => ({ get: vi.fn(), addTracked: vi.fn(), removeTracked: vi.fn(), addExcluded: vi.fn(), removeExcluded: vi.fn() }))
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DEFAULT_HISTORY_MONTHS: 12,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
}))
vi.mock("@/services/competitorSettingsService", () => ({ default: settingsSvc, competitorSettingsService: settingsSvc }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: project.current }) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock("../referring-domains/exportCsv", async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: csv.downloadCsv }))
// The production debounce is 1 s; the tests only need it to be a real, observable delay.
vi.mock("./constants", async (importOriginal) => ({ ...(await importOriginal()), COMPARE_DEBOUNCE_MS: 120 }))
// jsdom has no layout: give the charts a size so their shapes are really drawn.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal()
  const React = await import("react")
  return { ...actual, ResponsiveContainer: ({ children }) => React.createElement("div", { style: { width: 800, height: 400 } }, React.cloneElement(children, { width: 800, height: 400 })) }
})

import CompetitorsDashboard from "./CompetitorsDashboard"
import { REAL_BULK_ITEMS, REAL_COMPETITORS, REAL_COMPETITORS_TOTAL, REAL_SELF } from "./testFixtures"
import { COMPARE_DEBOUNCE_MS } from "./constants"

const ok = (data) => ({ success: true, data })
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const LIMITS = { tracked: 10, excluded: 1000 }

/** The saved lists, as the server would keep them. */
let saved
/** Domains the fake bulk-traffic endpoint has no row for / answers all-zero for. */
const envelopeFor = (section, result, extra = {}) => ({ section, target: "asgeyehospital.com", market: { location: "India", language: "English" }, fetchedAt: "2026-10-27T08:00:00.000Z", cached: false, refreshThrottled: false, result, ...extra })

const SORT = {
  intersections: (r) => r.intersections,
  avg_position: (r) => r.avg_position,
  "competitor_metrics.organic.etv": (r) => r.competitor_shared?.etv,
}

/** A tiny fake of the server's competitors section: the project's exclude list, min shared keywords, sort, paging, the project's own row. */
function competitorsAnswer(req = {}) {
  const c = req ?? {}
  let rows = REAL_COMPETITORS.filter((r) => !saved.excluded.includes(r.domain))
  const f = c.filters
  const min = Array.isArray(f) && f[0] === "intersections" ? f[2] : 0
  if (min) rows = rows.filter((r) => r.intersections >= min)
  const [field, dir] = (c.order_by ?? "intersections,desc").split(",")
  const key = SORT[field]
  rows = [...rows].sort((a, b) => (dir === "asc" ? 1 : -1) * ((key(a) ?? 0) - (key(b) ?? 0)))
  const offset = c.offset ?? 0
  const page = rows.slice(offset, offset + (c.limit ?? 50))
  // Like the provider: the project's own row is in the set (it has the most shared keywords) and comes first when sorted by relevance.
  const selfFirst = offset === 0 && field === "intersections" && dir === "desc"
  // The fixture is only the first page of a much longer list: unfiltered, the provider's real total (it counts the project's own row too).
  const total = (min ? rows.length : rows.length + (REAL_COMPETITORS_TOTAL - 1 - REAL_COMPETITORS.length)) + 1
  return envelopeFor("competitors", { totalCount: total, self: selfFirst ? REAL_SELF : null, items: page })
}

function serve(overrides = {}) {
  settingsSvc.get.mockImplementation(async () => ok({ ...structuredClone(saved), limits: LIMITS }))
  settingsSvc.addTracked.mockImplementation(async (_p, d) => { if (!saved.tracked.includes(d)) saved.tracked.push(d); return ok({ ...structuredClone(saved), limits: LIMITS }) })
  settingsSvc.removeTracked.mockImplementation(async (_p, d) => { saved.tracked = saved.tracked.filter((x) => x !== d); return ok({ ...structuredClone(saved), limits: LIMITS }) })
  settingsSvc.addExcluded.mockImplementation(async (_p, ds) => { for (const d of ds) if (!saved.excluded.includes(d)) saved.excluded.push(d); return ok({ ...structuredClone(saved), limits: LIMITS }) })
  settingsSvc.removeExcluded.mockImplementation(async (_p, d) => { saved.excluded = saved.excluded.filter((x) => x !== d); return ok({ ...structuredClone(saved), limits: LIMITS }) })
  svc.getSection.mockImplementation(async (_pid, section, opts) => {
    if (section in overrides) { const r = overrides[section]; if (r instanceof Error) throw r; if (typeof r === "function") return r(opts); return ok(r) }
    if (section === "competitors") return ok(competitorsAnswer(opts?.competitors))
    if (section === "bulk-traffic") {
      // The provider answers in ITS order (here: reversed), and only for the targets it was asked about (the project is always first).
      const wanted = ["asgeyehospital.com", ...(opts?.targets ?? [])]
      const items = [...REAL_BULK_ITEMS.filter((i) => wanted.includes(i.target))].reverse()
      return ok(envelopeFor("bulk-traffic", { items }, { query: { targets: wanted } }))
    }
    if (section === "rank-overview") return ok(envelopeFor("rank-overview", { organic: { count: 4139, etv: 100411.929526025, estimated_paid_traffic_cost: 24520.31, pos_1: 165, pos_2_3: 308, pos_4_10: 1037 }, paid: null }))
    throw new Error(`unexpected section ${section}`)
  })
}

const calls = () => svc.getSection.mock.calls.map(([pid, section, opts, req]) => ({ pid, section, refresh: Boolean(opts?.refresh), competitors: opts?.competitors, targets: opts?.targets, signal: req?.signal }))
const compCalls = () => calls().filter((c) => c.section === "competitors")
const bulkCalls = () => calls().filter((c) => c.section === "bulk-traffic")
const lastComp = () => compCalls().at(-1)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(CompetitorsDashboard)))
}

const rowEls = () => screen.getAllByTestId("cp-row")
const rowOf = (domain) => rowEls().find((r) => r.getAttribute("data-domain") === domain)
const showing = () => screen.getByTestId("cp-showing").textContent
const toggle = (name) => screen.getByRole("switch", { name })
const sortBtn = (name) => screen.getByRole("button", { name: new RegExp(`^Sort by ${name}`) })

vi.setConfig({ testTimeout: 30000 })

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 })
  vi.setConfig({ testTimeout: 30000 })
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  window.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
})
beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, "", "/app/competitors")
  window.innerWidth = 1280
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  saved = { tracked: [], excluded: [] }
  serve()
})
afterEach(() => { vi.restoreAllMocks() })

describe("Competitors: first load", () => {
  test("loads the saved lists, then ONE competitors request for the default view; nothing is compared yet", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(settingsSvc.get).toHaveBeenCalledTimes(1)
    expect(compCalls()).toHaveLength(1)
    expect(lastComp()).toMatchObject({ pid: "p1", refresh: false, competitors: { limit: 50, offset: 0, order_by: "intersections,desc", filters: [], exclude_top_domains: true, max_rank_group: 100 } })
    expect(bulkCalls()).toHaveLength(0)
    expect(calls().filter((c) => c.section === "rank-overview")).toHaveLength(0) // the project's own row is in the response
  })

  test("the frame is there at once: title, domain from the project, skeletons — no spinner page", () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    settingsSvc.get.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Competitors" })).toBeTruthy()
    expect(screen.getByTestId("cp-domain").textContent).toBe("asgeyehospital.com")
    expect(screen.getAllByTestId("cp-skeleton-row").length).toBeGreaterThanOrEqual(5)
    expect(document.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThanOrEqual(8)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("header: domain, 'India · English', last updated, Refresh and Export CSV", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(screen.getByTestId("cp-market").textContent).toBe("India · English")
    expect(screen.getByTestId("cp-updated").textContent).toMatch(/^Last updated .*2026/)
    expect(screen.getByTestId("cp-refresh")).toBeTruthy()
    expect(screen.getByTestId("cp-export")).toBeTruthy()
  })

  test("asks for a project when none is selected, and requests nothing", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its competitors.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
    expect(settingsSvc.get).not.toHaveBeenCalled()
  })
})

describe("Competitors: the table (real asgeyehospital.com rows)", () => {
  test("the project's own row is not listed; 'Showing 1–49 of 18,777 competitors' (the provider's total counts that row)", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(rowEls()).toHaveLength(49)
    expect(rowOf("asgeyehospital.com")).toBeUndefined()
    expect(showing()).toBe(`Showing 1–49 of ${(REAL_COMPETITORS_TOTAL - 1).toLocaleString("en-US")} competitors`)
  })

  test("dragarwal.com: favicon + domain opening in a new tab, shared keywords with the share bar, average position, totals", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    const row = rowOf("dragarwal.com")
    const link = within(row).getByTestId("cp-domain-link")
    expect(link.getAttribute("href")).toBe("https://dragarwal.com")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(row.querySelector("img").getAttribute("src")).toBe("https://www.google.com/s2/favicons?domain=dragarwal.com&sz=32")
    expect(within(row).getByTestId("cp-shared").textContent).toContain("2.4K")
    expect(within(row).getByTestId("cp-shared-pct").textContent).toBe("58.5%")
    expect(within(row).getByTestId("cp-avgpos").textContent).toBe("12.8")
    const cells = within(row).getAllByRole("cell")
    expect(cells.map((c) => c.textContent)).toEqual(expect.arrayContaining(["10.2K", "328.6K"]))
    expect(cells.find((c) => c.textContent === "328.6K").querySelector("[title]").getAttribute("title")).toBe("328,637") // exact value on hover
  })

  test("head-to-head 'You 26K · Them 36.9K' is red (they lead); '#1 rankings' reads 'You 32 · Them 213'", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    const row = rowOf("dragarwal.com")
    const h2h = within(row).getByTestId("cp-h2h")
    expect(h2h.textContent).toContain("You 26K")
    expect(h2h.textContent).toContain("Them 36.9K")
    expect(h2h.getAttribute("data-lead")).toBe("them")
    expect(h2h.querySelector(".bg-red-500")).toBeTruthy()
    expect(h2h.querySelector(".bg-emerald-500")).toBeNull()
    expect(within(row).getByTestId("cp-top1").textContent.replace(/\s+/g, " ")).toBe("You 32 · Them 213")
  })

  test("when the project leads the bar is green", async () => {
    const swapped = REAL_COMPETITORS.map((r, i) => (i === 0 ? { ...r, project_shared: r.competitor_shared, competitor_shared: r.project_shared } : r))
    svc.getSection.mockImplementation(async (_p, s) => ok(s === "competitors" ? envelopeFor("competitors", { totalCount: 50, self: REAL_SELF, items: swapped }) : {}))
    renderPage()
    await screen.findAllByTestId("cp-row")
    const h2h = within(rowOf("dragarwal.com")).getByTestId("cp-h2h")
    expect(h2h.getAttribute("data-lead")).toBe("us")
    expect(h2h.querySelector(".bg-emerald-500")).toBeTruthy()
    expect(h2h.textContent).toContain("You 36.9K")
  })

  test("a missing value is '—', never 0, NaN or undefined", async () => {
    const sparse = [{ domain: "sparse.com", intersections: 12, avg_position: null, total: null, project_shared: null, competitor_shared: null }]
    svc.getSection.mockImplementation(async (_p, s) => ok(s === "competitors" ? envelopeFor("competitors", { totalCount: 2, self: REAL_SELF, items: sparse }) : {}))
    renderPage()
    await screen.findAllByTestId("cp-row")
    const row = rowOf("sparse.com")
    expect(within(row).getByTestId("cp-avgpos").textContent).toBe("—")
    expect(within(row).getByTestId("cp-h2h").textContent.replace(/\s+/g, " ")).toContain("You — · Them —")
    expect(row.textContent).not.toMatch(/NaN|undefined|\bnull\b/)
  })

  test("Est. traffic is labelled with an info icon", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(screen.getByRole("button", { name: "About Est. traffic" })).toBeTruthy()
  })
})

describe("Competitors: settings and sorting go to the server", () => {
  test("'Hide large sites' (ON by default) and 'Top 10 competitors only' (OFF) change the request", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(toggle("Hide large sites").getAttribute("aria-checked")).toBe("true")
    expect(toggle("Top 10 competitors only").getAttribute("aria-checked")).toBe("false")
    fireEvent.click(toggle("Top 10 competitors only"))
    await waitFor(() => expect(lastComp().competitors).toMatchObject({ max_rank_group: 10, exclude_top_domains: true }))
    fireEvent.click(toggle("Hide large sites"))
    await waitFor(() => expect(lastComp().competitors).toMatchObject({ max_rank_group: 10, exclude_top_domains: false }))
    expect(window.location.search).toBe("?big=1&top10=1")
  })

  test("going back to a setting already loaded makes no new request (cached per request)", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(toggle("Top 10 competitors only"))
    await waitFor(() => expect(compCalls()).toHaveLength(2))
    await screen.findAllByTestId("cp-row")
    fireEvent.click(toggle("Top 10 competitors only"))
    await waitFor(() => expect(toggle("Top 10 competitors only").getAttribute("aria-checked")).toBe("false"))
    await screen.findAllByTestId("cp-row")
    expect(compCalls()).toHaveLength(2)
  })

  test("'Min. shared keywords' is applied on Enter or blur only — typing makes no request — as ['intersections','>=',N]", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    const input = screen.getByTestId("cp-min-shared")
    fireEvent.change(input, { target: { value: "1" } })
    fireEvent.change(input, { target: { value: "15" } })
    fireEvent.change(input, { target: { value: "150" } })
    await sleep(500)
    expect(compCalls()).toHaveLength(1)
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect(compCalls()).toHaveLength(2))
    expect(lastComp().competitors.filters).toEqual(["intersections", ">=", 150])
    await waitFor(() => expect(rowEls().every((r) => Number(r.textContent.match(/\d/)) >= 0)).toBe(true))
    expect(rowOf("dragarwal.com")).toBeTruthy()

    fireEvent.change(input, { target: { value: "2000" } })
    fireEvent.blur(input)
    await waitFor(() => expect(lastComp().competitors.filters).toEqual(["intersections", ">=", 2000]))
    await waitFor(() => expect(rowEls().length).toBeLessThan(10))
  })

  test("a non-numeric entry is cleaned to digits", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    const input = screen.getByTestId("cp-min-shared")
    fireEvent.change(input, { target: { value: "1a2b" } })
    fireEvent.blur(input)
    await waitFor(() => expect(lastComp().competitors.filters).toEqual(["intersections", ">=", 12]))
  })

  test("sorting a column sends that field; the same column again flips the direction; the page goes back to 1", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(sortBtn("Their avg. position"))
    await waitFor(() => expect(lastComp().competitors.order_by).toBe("avg_position,asc"))
    fireEvent.click(sortBtn("Their avg. position"))
    await waitFor(() => expect(lastComp().competitors.order_by).toBe("avg_position,desc"))
    fireEvent.click(sortBtn("Head-to-head"))
    await waitFor(() => expect(lastComp().competitors.order_by).toBe("competitor_metrics.organic.etv,desc"))
    const requests = compCalls().length
    fireEvent.click(sortBtn("Shared keywords")) // back to the default order: already loaded, so no new request
    await waitFor(() => expect(screen.getByRole("columnheader", { name: /Shared keywords/ }).getAttribute("aria-sort")).toBe("descending"))
    expect(compCalls()).toHaveLength(requests)
    expect(window.location.search).toBe("")
  })

  test("the competitor's whole-site keywords and traffic cannot be sorted by the provider, so those headers offer no sort", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(screen.queryByRole("button", { name: /^Sort by Their total keywords/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Sort by Their total traffic/ })).toBeNull()
  })

  test("page size, next page and 'Go to page' are server offsets", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.change(screen.getByTestId("ok-page-size"), { target: { value: "25" } })
    await waitFor(() => expect(lastComp().competitors).toMatchObject({ limit: 25, offset: 0 }))
    await screen.findAllByTestId("cp-row")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(lastComp().competitors).toMatchObject({ limit: 25, offset: 25 }))
    await waitFor(() => expect(showing()).toMatch(/^Showing 26–/))
    expect(window.location.search).toBe("?page=2&size=25")
  })

  test("the view is read from the URL when the page opens", async () => {
    window.history.replaceState(null, "", "/app/competitors?sort=avgPosition&dir=desc&top10=1&big=1&min=300&size=25&page=1")
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(lastComp().competitors).toEqual({ limit: 25, offset: 0, order_by: "avg_position,desc", filters: ["intersections", ">=", 300], exclude_top_domains: false, max_rank_group: 10 })
    expect(toggle("Top 10 competitors only").getAttribute("aria-checked")).toBe("true")
    expect(toggle("Hide large sites").getAttribute("aria-checked")).toBe("false")
    expect(screen.getByTestId("cp-min-shared").value).toBe("300")
  })

  test("a request still running when the settings change again is cancelled, and the old answer never replaces the new one", async () => {
    let release
    const gate = new Promise((r) => { release = r })
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (pid, section, opts, req) => {
      if (section === "competitors" && opts.competitors.max_rank_group === 10 && opts.competitors.exclude_top_domains) { await gate; return ok(envelopeFor("competitors", { totalCount: 2, self: REAL_SELF, items: [REAL_COMPETITORS[3]] })) }
      return base(pid, section, opts, req)
    })
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(toggle("Top 10 competitors only")) // slow request #1
    await waitFor(() => expect(compCalls()).toHaveLength(2))
    const slow = lastComp().signal
    expect(slow.aborted).toBe(false)
    expect(rowEls().length).toBe(49) // the previous rows stay on screen
    expect(screen.getByTestId("cp-results").querySelector("[aria-busy=true]")).toBeTruthy()
    fireEvent.click(toggle("Hide large sites")) // request #2 supersedes it
    await waitFor(() => expect(slow.aborted).toBe(true))
    await waitFor(() => expect(lastComp().competitors.exclude_top_domains).toBe(false))
    release()
    await sleep(50)
    await sleep(50)
    expect(screen.getByTestId("cp-showing").textContent).not.toMatch(/Showing 1–1 of 1 /) // the cancelled request's single row never appears
    expect(rowEls().length).toBeGreaterThan(10)
  })
})

describe("Competitors: tracking (the star)", () => {
  test("pinning is saved, optimistic, and never refetches the competitors list", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    const before = compCalls().length
    const star = within(rowOf("dragarwal.com")).getByTestId("cp-track")
    expect(star.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(star)
    expect(within(rowOf("dragarwal.com")).getByTestId("cp-track").getAttribute("aria-pressed")).toBe("true") // at once
    await waitFor(() => expect(settingsSvc.addTracked).toHaveBeenCalledWith("p1", "dragarwal.com"))
    await sleep(COMPARE_DEBOUNCE_MS * 2)
    expect(compCalls()).toHaveLength(before)
    fireEvent.click(within(rowOf("dragarwal.com")).getByTestId("cp-track"))
    await waitFor(() => expect(settingsSvc.removeTracked).toHaveBeenCalledWith("p1", "dragarwal.com"))
    await sleep(COMPARE_DEBOUNCE_MS * 2)
    expect(compCalls()).toHaveLength(before)
    expect(within(rowOf("dragarwal.com")).getByTestId("cp-track").getAttribute("aria-pressed")).toBe("false")
  })

  test("the 11th pin is refused with a clear message and nothing is sent", async () => {
    saved.tracked = Array.from({ length: 10 }, (_, i) => `rival${i}.com`)
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(within(rowOf("dragarwal.com")).getByTestId("cp-track"))
    expect(await screen.findByText(/up to 10 competitors/)).toBeTruthy()
    expect(settingsSvc.addTracked).not.toHaveBeenCalled()
    expect(within(rowOf("dragarwal.com")).getByTestId("cp-track").getAttribute("aria-pressed")).toBe("false")
  })

  test("a failed save puts the star back and says why", async () => {
    settingsSvc.addTracked.mockRejectedValue(apiError("Could not save right now.", { status: 500, code: "INTERNAL_ERROR" }))
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(within(rowOf("dragarwal.com")).getByTestId("cp-track"))
    expect(await screen.findByText("Could not save right now.")).toBeTruthy()
    await waitFor(() => expect(within(rowOf("dragarwal.com")).getByTestId("cp-track").getAttribute("aria-pressed")).toBe("false"))
  })

  test("tracked competitors are starred after a reload (they come from the project)", async () => {
    saved.tracked = ["centreforsight.net"]
    renderPage()
    await screen.findAllByTestId("cp-row")
    await waitFor(() => expect(within(rowOf("centreforsight.net")).getByTestId("cp-track").getAttribute("aria-pressed")).toBe("true"))
    expect(within(rowOf("dragarwal.com")).getByTestId("cp-track").getAttribute("aria-pressed")).toBe("false")
  })
})

describe("Competitors: exclusions (saved on the project; they change what the provider is asked)", () => {
  test("a row's Exclude saves the domain, then the list is requested again without it", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(compCalls()).toHaveLength(1)
    fireEvent.click(within(rowOf("dragarwal.com")).getByTestId("cp-exclude"))
    await waitFor(() => expect(settingsSvc.addExcluded).toHaveBeenCalledWith("p1", ["dragarwal.com"]))
    await waitFor(() => expect(compCalls()).toHaveLength(2))
    await waitFor(() => expect(rowOf("dragarwal.com")).toBeUndefined())
    expect(showing()).toContain("Showing 1–48")
    expect(await screen.findByText(/dragarwal\.com excluded/)).toBeTruthy()
  })

  test("the new list is requested only after the server has SAVED it (never against the old list)", async () => {
    const order = []
    const add = settingsSvc.addExcluded.getMockImplementation()
    settingsSvc.addExcluded.mockImplementation(async (...a) => { await sleep(80); const r = await add(...a); order.push("saved"); return r })
    const sec = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[1] === "competitors") order.push("competitors"); return sec(...a) })
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(within(rowOf("dragarwal.com")).getByTestId("cp-exclude"))
    await waitFor(() => expect(order).toEqual(["competitors", "saved", "competitors"]))
  })

  test("Manage exclusions: shows the list, cleans pasted input, adds the valid ones, reports the rest, removes on request", async () => {
    saved.excluded = ["practo.com"]
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(screen.getByTestId("cp-manage").textContent).toContain("1")
    fireEvent.click(screen.getByTestId("cp-manage"))
    const dialog = await screen.findByTestId("cp-exclusions-dialog")
    expect(within(dialog).getByTestId("cp-exclude-list").textContent).toContain("practo.com")
    expect(within(dialog).getByTestId("cp-exclude-count").textContent).toBe("1 of 1,000 used")

    fireEvent.change(within(dialog).getByTestId("cp-exclude-input"), { target: { value: "https://www.JustDial.com/x, not_a_domain\nwww.lybrate.com" } })
    fireEvent.click(within(dialog).getByTestId("cp-exclude-add"))
    await waitFor(() => expect(settingsSvc.addExcluded).toHaveBeenCalledWith("p1", ["justdial.com", "lybrate.com"]))
    expect(await within(dialog).findByTestId("cp-exclude-error")).toBeTruthy()
    expect(within(dialog).getByTestId("cp-exclude-error").textContent).toMatch(/Added 2.*not_a_domain/)
    await waitFor(() => expect(within(dialog).getByTestId("cp-exclude-list").textContent).toContain("lybrate.com"))
    expect(within(dialog).getByTestId("cp-exclude-input").value).toBe("not_a_domain")
    expect(rowOf("lybrate.com")).toBeUndefined() // and the list was refreshed without it
    await waitFor(() => expect(lastComp()).toBeTruthy())

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove practo.com from exclusions" }))
    await waitFor(() => expect(settingsSvc.removeExcluded).toHaveBeenCalledWith("p1", "practo.com"))
    await waitFor(() => expect(within(dialog).getByTestId("cp-exclude-list").textContent).not.toContain("practo.com"))
  })

  test("Manage exclusions: nothing valid -> a message and no request; an empty list says so", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(screen.getByTestId("cp-manage"))
    const dialog = await screen.findByTestId("cp-exclusions-dialog")
    expect(within(dialog).getByTestId("cp-exclude-empty")).toBeTruthy()
    fireEvent.change(within(dialog).getByTestId("cp-exclude-input"), { target: { value: "localhost 10.0.0.1" } })
    fireEvent.click(within(dialog).getByTestId("cp-exclude-add"))
    expect((await within(dialog).findByTestId("cp-exclude-error")).textContent).toMatch(/Not a valid domain: localhost, 10\.0\.0\.1/)
    expect(settingsSvc.addExcluded).not.toHaveBeenCalled()
  })

  test("a server refusal (list full) is shown and nothing changes", async () => {
    settingsSvc.addExcluded.mockRejectedValue(apiError("You can have at most 1,000 excluded domains. Remove one first.", { status: 409, code: "EXCLUDED_LIMIT_REACHED" }))
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(screen.getByTestId("cp-manage"))
    const dialog = await screen.findByTestId("cp-exclusions-dialog")
    fireEvent.change(within(dialog).getByTestId("cp-exclude-input"), { target: { value: "a.com" } })
    fireEvent.click(within(dialog).getByTestId("cp-exclude-add"))
    expect((await within(dialog).findByTestId("cp-exclude-error")).textContent).toMatch(/at most 1,000/)
    expect(compCalls()).toHaveLength(1)
  })
})

describe("Competitors: the landscape chart", () => {
  test("every competitor with traffic, keywords and shared keywords is a bubble, and the project is one highlighted 'You' bubble from its own row", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    const chart = await screen.findByTestId("cp-landscape")
    await waitFor(() => expect(chart.querySelectorAll("[data-testid=cp-bubble]").length).toBeGreaterThan(30))
    expect(chart.querySelectorAll("[data-testid=cp-bubble-you]")).toHaveLength(1)
    expect(chart.querySelector("[data-testid=cp-bubble-you]").getAttribute("data-domain")).toBe("asgeyehospital.com")
    expect(chart.textContent).toContain("You")
    expect(chart.getAttribute("aria-label")).toMatch(/with your site highlighted/)
  })

  test("clicking a bubble scrolls to that row and highlights it for a moment", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    const chart = await screen.findByTestId("cp-landscape")
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {})
    await waitFor(() => expect(chart.querySelector("[data-domain='dragarwal.com']")).toBeTruthy())
    fireEvent.click(chart.querySelector("[data-domain='dragarwal.com']"))
    await waitFor(() => expect(rowOf("dragarwal.com").getAttribute("data-highlighted")).toBe("true"))
    expect(scroll).toHaveBeenCalled()
    expect(scroll.mock.contexts.some((el) => el.id === "cp-row-dragarwal.com")).toBe(true)
    expect(rowOf("centreforsight.net").getAttribute("data-highlighted")).toBeNull()
  })

  test("competitors that cannot be placed (no traffic data) are counted, not drawn at a made-up spot", async () => {
    const items = [REAL_COMPETITORS[0], { ...REAL_COMPETITORS[1], total: { count: 100, etv: null, estimated_paid_traffic_cost: null } }, { ...REAL_COMPETITORS[2], total: { count: 100, etv: 0 } }]
    svc.getSection.mockImplementation(async (_p, s) => ok(s === "competitors" ? envelopeFor("competitors", { totalCount: 4, self: REAL_SELF, items }) : {}))
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect((await screen.findByTestId("cp-unplaced")).textContent).toMatch(/2 competitors without traffic or keyword data are not plotted/)
    expect(screen.getByTestId("cp-landscape").getAttribute("data-points")).toBe("1")
  })

  test("without the project's own row in the response, 'You' comes from the Domain Overview totals (one cached request)", async () => {
    window.history.replaceState(null, "", "/app/competitors?sort=avgPosition")
    renderPage()
    await screen.findAllByTestId("cp-row")
    await waitFor(() => expect(screen.getByTestId("cp-landscape").getAttribute("data-you")).toBe("1"))
    expect(calls().filter((c) => c.section === "rank-overview")).toHaveLength(1)
  })

  test("'Top 10 only' with a sort that leaves the project's row off the page: 'You' is still plotted (its top-10 keywords as shared keywords)", async () => {
    window.history.replaceState(null, "", "/app/competitors?sort=avgPosition&top10=1")
    renderPage()
    await screen.findAllByTestId("cp-row")
    await waitFor(() => expect(screen.getByTestId("cp-landscape").getAttribute("data-you")).toBe("1"))
    expect(screen.queryByTestId("cp-no-you")).toBeNull()
  })

  test("the shared-keywords bar uses the same fallback", async () => {
    window.history.replaceState(null, "", "/app/competitors?sort=avgPosition")
    renderPage()
    await screen.findAllByTestId("cp-row")
    await waitFor(() => expect(within(rowEls()[0]).queryByTestId("cp-shared-pct")).toBeTruthy())
  })
})

describe("Competitors: expandable row", () => {
  test("opens the grouped-bar chart of #1 / #2–3 / #4–10 (You vs Them), the traffic comparison, their traffic value and the one-line verdict", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(within(rowOf("dragarwal.com")).getByRole("button", { name: "Details for dragarwal.com" }))
    const panel = await screen.findByRole("region", { name: "Details for dragarwal.com" })
    expect(within(panel).getByTestId("cp-summary").textContent).toBe("dragarwal.com gets 1.4× your traffic on the 2,423 keywords you share.")
    expect(within(panel).getByTestId("cp-traffic-value").textContent).toBe("$138.2K")
    expect(within(panel).getByTestId("cp-h2h").textContent).toContain("You 26K")
    const chart = within(panel).getByTestId("cp-positions-chart")
    expect(chart.getAttribute("role")).toBe("img")
    expect(chart.getAttribute("aria-label")).toContain("#1: you 32, dragarwal.com 213")
    expect(chart.getAttribute("aria-label")).toContain("#2–3: you 151, dragarwal.com 346")
    expect(chart.getAttribute("aria-label")).toContain("#4–10: you 643, dragarwal.com 904")
  })

  test("a click on the row opens it, a click on its link or star does not, and only one is open at a time", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(within(rowOf("dragarwal.com")).getByTestId("cp-track"))
    fireEvent.click(within(rowOf("dragarwal.com")).getByTestId("cp-domain-link"))
    expect(screen.queryAllByTestId("cp-expanded")).toHaveLength(0)
    fireEvent.click(within(rowOf("dragarwal.com")).getAllByRole("cell")[2])
    expect(await screen.findAllByTestId("cp-expanded")).toHaveLength(1)
    fireEvent.click(within(rowOf("centreforsight.net")).getAllByRole("cell")[2])
    await waitFor(() => expect(screen.getAllByTestId("cp-expanded")).toHaveLength(1))
    expect(screen.getByRole("region", { name: "Details for centreforsight.net" })).toBeTruthy()
    fireEvent.click(within(rowOf("centreforsight.net")).getByRole("button", { name: "Details for centreforsight.net" }))
    await waitFor(() => expect(screen.queryAllByTestId("cp-expanded")).toHaveLength(0))
  })

  test("the open row closes when the view changes", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(within(rowOf("dragarwal.com")).getByRole("button", { name: "Details for dragarwal.com" }))
    await screen.findByTestId("cp-expanded")
    fireEvent.click(toggle("Top 10 competitors only"))
    await waitFor(() => expect(screen.queryAllByTestId("cp-expanded")).toHaveLength(0))
  })
})

describe("Competitors: states", () => {
  test("a failed list is an inline error with Retry; the rest of the page keeps working", async () => {
    let fail = true
    svc.getSection.mockImplementation(async (_p, s, o) => {
      if (s === "competitors" && fail) throw apiError("The data service is temporarily unavailable. Please try again later.")
      return ok(s === "competitors" ? competitorsAnswer(o.competitors) : {})
    })
    renderPage()
    const alerts = await screen.findAllByRole("alert")
    expect(alerts.some((a) => /temporarily unavailable/.test(a.textContent))).toBe(true)
    expect(screen.getByTestId("cp-controls")).toBeTruthy()
    fail = false
    fireEvent.click(within(screen.getByTestId("cp-results")).getByRole("button", { name: /Retry/ }))
    await screen.findAllByTestId("cp-row")
    expect(compCalls()).toHaveLength(2)
  })

  test("a new domain with no competitors: 'No competitors found yet — this domain needs more rankings.'", async () => {
    svc.getSection.mockImplementation(async (_p, s) => ok(s === "competitors" ? envelopeFor("competitors", { totalCount: 0, self: null, items: [] }) : {}))
    renderPage()
    expect((await screen.findByTestId("cp-empty")).textContent).toBe("No competitors found yet — this domain needs more rankings.")
    expect(screen.queryByRole("button", { name: "Reset settings" })).toBeNull()
    expect(screen.getByTestId("cp-export").disabled).toBe(true)
  })

  test("every result filtered out: 'No competitors match these settings' with 'Reset settings', which puts the settings back", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    const input = screen.getByTestId("cp-min-shared")
    fireEvent.change(input, { target: { value: "99999" } })
    fireEvent.blur(input)
    fireEvent.click(toggle("Top 10 competitors only"))
    const empty = await screen.findByTestId("cp-empty")
    expect(empty.textContent).toContain("No competitors match these settings.")
    const requests = compCalls().length
    fireEvent.click(within(empty).getByRole("button", { name: "Reset settings" }))
    await screen.findAllByTestId("cp-row")
    expect(compCalls()).toHaveLength(requests) // the default view was loaded at the start: no new request
    expect(window.location.search).toBe("")
    expect(toggle("Top 10 competitors only").getAttribute("aria-checked")).toBe("false")
    expect(screen.getByTestId("cp-min-shared").value).toBe("")
  })

  test("a page past the end moves back to the last page that exists", async () => {
    window.history.replaceState(null, "", "/app/competitors?page=9&size=25&min=1900")
    renderPage()
    await waitFor(() => expect(compCalls().map((c) => c.competitors.offset)).toContain(0), { timeout: 4000 })
    await screen.findAllByTestId("cp-row")
    expect(lastComp().competitors.offset).toBe(0)
    expect(window.location.search).toBe("?size=25&min=1900")
  })

  test("a project whose URL has no public domain name gets a plain explanation, not an error loop", async () => {
    svc.getSection.mockImplementation(async (_p, s) => { if (s === "competitors") throw apiError("The project's website does not have a public domain name", { status: 422, code: "INVALID_TARGET" }); return ok({}) })
    renderPage()
    expect(await screen.findByText(/does not have a public domain name/)).toBeTruthy()
  })

  test("the saved lists failing to load does not block the page", async () => {
    settingsSvc.get.mockRejectedValue(apiError("Unavailable", { status: 500 }))
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(compCalls()).toHaveLength(1)
  })
})

describe("Competitors: Compare section (API 5)", () => {
  test("nothing tracked: a hint, no request", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    expect(screen.getByTestId("cp-compare-hint").textContent).toBe("Pin competitors with ☆ to compare them here.")
    expect(screen.queryByTestId("cp-compare-table")).toBeNull()
    await sleep(COMPARE_DEBOUNCE_MS * 2)
    expect(bulkCalls()).toHaveLength(0)
  })

  test("tracked competitors are compared with the project in one request; rows are matched by name though the provider answers in reverse", async () => {
    saved.tracked = ["dragarwal.com", "centreforsight.net"]
    renderPage()
    const table = await screen.findByTestId("cp-compare-table")
    await waitFor(() => expect(within(table).getAllByTestId("cp-compare-row")).toHaveLength(3))
    expect(bulkCalls()).toHaveLength(1)
    expect(bulkCalls()[0].targets).toEqual(["centreforsight.net", "dragarwal.com"]) // sorted; the server adds the project
    const rows = within(table).getAllByTestId("cp-compare-row")
    expect(rows[0].getAttribute("data-project")).toBe("true")
    const cells = (r) => within(r).getAllByRole("cell").map((c) => c.textContent)
    const drag = rows.find((r) => r.getAttribute("data-domain") === "dragarwal.com")
    expect(cells(drag).slice(1, 7)).toEqual(["328.6K", "10.2K", "35.8K", "2.9K", "0", "0"])
    const me = cells(rows[0])
    expect(me[0]).toContain("asgeyehospital.com")
    expect(me.slice(1, 7)).toEqual(["100.4K", "4.1K", "33K", "0", "0", "0"])
  })

  test("the chart groups organic, local pack, featured snippet and paid traffic per domain", async () => {
    saved.tracked = ["dragarwal.com"]
    renderPage()
    const chart = await screen.findByTestId("cp-compare-chart")
    await waitFor(() => expect(chart.getAttribute("data-domains")).toBe("2"))
    expect(chart.getAttribute("aria-label")).toMatch(/organic, local pack, featured snippet and paid traffic/)
    const legend = screen.getByRole("list", { name: "Traffic types" })
    expect(legend.textContent).toMatch(/Organic traffic.*Local pack traffic.*Featured snippet traffic.*Paid traffic/)
  })

  test("pinning several competitors in a row is ONE comparison request, made after the list stops changing", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    for (const d of ["dragarwal.com", "centreforsight.net", "aao.org"]) {
      fireEvent.click(within(rowOf(d)).getByTestId("cp-track"))
      await sleep(15)
    }
    expect(bulkCalls()).toHaveLength(0) // still inside the quiet period
    await waitFor(() => expect(bulkCalls()).toHaveLength(1))
    await sleep(COMPARE_DEBOUNCE_MS * 2)
    expect(bulkCalls()).toHaveLength(1)
    expect(bulkCalls()[0].targets).toEqual(["aao.org", "centreforsight.net", "dragarwal.com"])
    expect(compCalls()).toHaveLength(1) // and the competitors list was never refetched
  })

  test("a change while a comparison is running cancels it; the same set again is cached (no request)", async () => {
    saved.tracked = ["dragarwal.com"]
    let release
    const gate = new Promise((r) => { release = r })
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (pid, section, opts, req) => {
      if (section === "bulk-traffic" && opts.targets.length === 2) await gate
      return base(pid, section, opts, req)
    })
    renderPage()
    await screen.findAllByTestId("cp-row")
    await screen.findByTestId("cp-compare-table")
    fireEvent.click(within(rowOf("centreforsight.net")).getByTestId("cp-track"))
    await waitFor(() => expect(bulkCalls()).toHaveLength(2))
    const slow = bulkCalls()[1].signal
    fireEvent.click(within(rowOf("centreforsight.net")).getByTestId("cp-track")) // unpin again: back to the first set
    await waitFor(() => expect(slow.aborted).toBe(true))
    release()
    await sleep(COMPARE_DEBOUNCE_MS * 2)
    expect(bulkCalls()).toHaveLength(2)
  })

  test("Add domain: validated first (no request for junk), cleaned, saved, compared — even a domain that is not in the list", async () => {
    saved.tracked = ["dragarwal.com"]
    renderPage()
    await screen.findByTestId("cp-compare-table")
    const input = screen.getByTestId("cp-add-input")
    fireEvent.change(input, { target: { value: "not a domain" } })
    fireEvent.click(screen.getByTestId("cp-add-button"))
    expect((await screen.findByTestId("cp-add-error")).textContent).toMatch(/valid domain/)
    expect(settingsSvc.addTracked).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: "https://www.Not-In-The-List.com/x" } })
    fireEvent.click(screen.getByTestId("cp-add-button"))
    await waitFor(() => expect(settingsSvc.addTracked).toHaveBeenCalledWith("p1", "not-in-the-list.com"))
    await waitFor(() => expect(bulkCalls().at(-1).targets).toEqual(["dragarwal.com", "not-in-the-list.com"]))
    await waitFor(() => expect(within(screen.getByTestId("cp-compare-table")).getAllByTestId("cp-compare-row").map((r) => r.getAttribute("data-domain"))).toContain("not-in-the-list.com"))
    expect(screen.getByTestId("cp-add-input").value).toBe("")
  })

  test("Add domain with nothing tracked yet also works (the hint stays until the first one is added)", async () => {
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.change(screen.getByTestId("cp-add-input"), { target: { value: "dragarwal.com" } })
    fireEvent.click(screen.getByTestId("cp-add-button"))
    await screen.findByTestId("cp-compare-table", {}, { timeout: 4000 })
    expect(screen.queryByTestId("cp-compare-hint")).toBeNull()
  })

  test("a domain the provider has no data for is shown, flagged 'No data' (the provider answers with zeros)", async () => {
    saved.tracked = ["this-domain-does-not-exist-xyz123.com"]
    renderPage()
    const table = await screen.findByTestId("cp-compare-table")
    await waitFor(() => expect(within(table).getByText("No data")).toBeTruthy())
  })

  test("the 11th tracked domain is refused by the add form as well", async () => {
    saved.tracked = Array.from({ length: 10 }, (_, i) => `rival${i}.com`)
    renderPage()
    await screen.findByTestId("cp-compare-table")
    expect(screen.getByTestId("cp-tracked-count").textContent).toBe("10 of 10 tracked")
    fireEvent.change(screen.getByTestId("cp-add-input"), { target: { value: "one-more.com" } })
    expect(screen.getByTestId("cp-add-button").disabled).toBe(true)
  })

  test("the table sorts by any column and keeps the project row on top; a tracked competitor can be removed from it", async () => {
    saved.tracked = ["dragarwal.com", "centreforsight.net"]
    renderPage()
    const table = await screen.findByTestId("cp-compare-table")
    await waitFor(() => expect(within(table).getAllByTestId("cp-compare-row")).toHaveLength(3))
    const order = () => within(table).getAllByTestId("cp-compare-row").map((r) => r.getAttribute("data-domain"))
    expect(order()).toEqual(["asgeyehospital.com", "dragarwal.com", "centreforsight.net"]) // organic traffic, highest first
    fireEvent.click(within(table).getByRole("button", { name: /^Sort by Organic traffic/ }))
    expect(order()).toEqual(["asgeyehospital.com", "centreforsight.net", "dragarwal.com"])
    fireEvent.click(within(table).getByRole("button", { name: /^Sort by Domain/ }))
    expect(order()).toEqual(["asgeyehospital.com", "centreforsight.net", "dragarwal.com"])
    fireEvent.click(within(table).getByRole("button", { name: "Stop tracking centreforsight.net" }))
    await waitFor(() => expect(order()).toEqual(["asgeyehospital.com", "dragarwal.com"])) // gone at once, before any new request
    await waitFor(() => expect(settingsSvc.removeTracked).toHaveBeenCalledWith("p1", "centreforsight.net"))
  })

  test("a failed comparison is an inline error with Retry; the competitors list is unaffected", async () => {
    saved.tracked = ["dragarwal.com"]
    let fail = true
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[1] === "bulk-traffic" && fail) throw apiError("The data service is busy. Please wait a minute and try again.", { status: 429, code: "PROVIDER_RATE_LIMITED" }); return base(...a) })
    renderPage()
    await screen.findAllByTestId("cp-row")
    const section = (await screen.findByText("Tracked competitors")).closest("section")
    expect((await within(section).findByRole("alert")).textContent).toMatch(/busy/)
    fail = false
    fireEvent.click(within(section).getByRole("button", { name: /Retry/ }))
    await screen.findByTestId("cp-compare-table")
    expect(rowEls().length).toBe(49)
  })

  test("the production debounce is one second", async () => {
    const actual = await vi.importActual("./constants")
    expect(actual.COMPARE_DEBOUNCE_MS).toBe(1000)
  })
})

describe("Competitors: refresh and export", () => {
  test("Refresh asks the server to skip its cache for the list (and the comparison when something is tracked)", async () => {
    saved.tracked = ["dragarwal.com"]
    renderPage()
    await screen.findByTestId("cp-compare-table")
    fireEvent.click(screen.getByTestId("cp-refresh"))
    await waitFor(() => expect(compCalls().at(-1).refresh).toBe(true))
    await waitFor(() => expect(bulkCalls().at(-1).refresh).toBe(true))
    expect(compCalls()[0].refresh).toBe(false)
  })

  test("a refresh the server declined (data under a minute old) says so", async () => {
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { const r = await base(...a); if (a[1] === "competitors" && a[2].refresh) r.data.refreshThrottled = true; return r })
    renderPage()
    await screen.findAllByTestId("cp-row")
    fireEvent.click(screen.getByTestId("cp-refresh"))
    expect(await screen.findByText(/refreshed less than a minute ago/)).toBeTruthy()
  })

  test("Export CSV downloads the competitors on screen and makes no request", async () => {
    saved.tracked = ["dragarwal.com"]
    renderPage()
    await screen.findAllByTestId("cp-row")
    await screen.findByTestId("cp-compare-table")
    const before = calls().length
    fireEvent.click(screen.getByTestId("cp-export"))
    expect(csv.downloadCsv).toHaveBeenCalledTimes(1)
    const [name, content] = csv.downloadCsv.mock.calls[0]
    expect(name).toMatch(/^competitors_asgeyehospital\.com_\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = content.split("\r\n")
    expect(lines).toHaveLength(50)
    expect(lines.find((l) => l.startsWith("dragarwal.com,yes,2423,"))).toBeTruthy()
    expect(calls()).toHaveLength(before)
    expect(await screen.findByText("Exported 49 competitors from this page.")).toBeTruthy()
  })
})
