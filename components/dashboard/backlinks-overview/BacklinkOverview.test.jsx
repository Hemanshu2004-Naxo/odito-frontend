import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hook (URL state, query keys, cancellation), mapping and components run.
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DEFAULT_HISTORY_MONTHS: 12,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
}))
// The Domain Overview card "Your competitors" reads the saved competitors; none here.
const mineSvc = vi.hoisted(() => ({ list: vi.fn(async () => ({ success: true, data: { competitors: [], limit: 100 } })), get: vi.fn(), refresh: vi.fn() }))
vi.mock("@/services/myCompetitorsService", () => ({ default: mineSvc, myCompetitorsService: mineSvc }))
vi.mock("@/services/anchorSettingsService", () => ({
  default: { get: async () => ({ success: true, data: { saved: false, brand_terms: [], target_keywords: [] } }) },
}))
vi.mock("@/services/competitorSettingsService", () => ({
  default: { get: async () => ({ success: true, data: { tracked: [], excluded: [], limits: { tracked: 10, excluded: 1000 } } }) },
}))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: project.current }) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
// jsdom has no layout: give the charts a size so their shapes and labels are really drawn.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal()
  const React = await import("react")
  return { ...actual, ResponsiveContainer: ({ children }) => React.createElement("div", { style: { width: 800, height: 400 } }, React.cloneElement(children, { width: 800, height: 400 })) }
})

import BacklinkOverviewDashboard from "./BacklinkOverviewDashboard"
import DomainOverviewDashboard from "../domain-overview/DomainOverviewDashboard"
import { REAL_ALL, REAL_DOFOLLOW, REAL_LIVE, REAL_LOST } from "./testFixtures"

const ok = (data) => ({ success: true, data })
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const envelope = (result, extra = {}) => ({ section: "backlinks", target: "asgeyehospital.com", market: { location: "India", language: "English" }, fetchedAt: "2026-10-27T08:00:00.000Z", cached: false, refreshThrottled: false, result, ...extra })

// The page's two extra sources: new / lost linking sites (30 days) and the anchor profile PEEK (not cached here).
const LAST30 = { section: "rd-last-30", result: { since: "2026-10-05", days: 30, new: 17, lost: 14 } }
const extra = (section) => (section === "rd-last-30" ? ok(LAST30) : section === "anchor-profile" ? ok({ section, result: null }) : null)

const BY = (r) => (r.status === "lost" ? REAL_LOST : r.dofollow ? REAL_DOFOLLOW : r.status === "all" ? REAL_ALL : REAL_LIVE)
function serve(overrides = {}) {
  svc.getSection.mockImplementation(async (_pid, section, opts) => {
    if (extra(section)) return extra(section)
    if (typeof overrides === "function") return overrides(opts)
    const req = opts?.backlinks ?? { status: "live", dofollow: false }
    const result = "result" in overrides ? overrides.result : BY(req)
    return ok(envelope(result))
  })
}
/** The BACKLINKS requests only (the page's one billed section). */
const calls = () => svc.getSection.mock.calls.filter(([, section]) => section === "backlinks").map(([pid, section, opts, req]) => ({ pid, section, refresh: Boolean(opts?.refresh), backlinks: opts?.backlinks, signal: req?.signal }))
const last = () => calls().at(-1)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(BacklinkOverviewDashboard)))
}
const text = (id) => screen.getByTestId(id).textContent
const chart = (id) => screen.getByTestId(id)
const labels = (id) => chart(id).getAttribute("data-labels").split("|")
const mode = (name) => within(screen.getByTestId("bo-controls")).getByRole("button", { name })
const view = (key) => fireEvent.click(screen.getByTestId(`bo-view-${key}`))

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
  window.history.replaceState(null, "", "/app/backlinks/overview")
  window.innerWidth = 1280
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  serve()
})
afterEach(() => { vi.restoreAllMocks() })

describe("Backlink Overview: first load", () => {
  test("ONE billed request for the whole page; the two extras only read caches", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(calls()).toHaveLength(1)
    expect(last()).toMatchObject({ pid: "p1", section: "backlinks", refresh: false, backlinks: { status: "live", dofollow: false } })
    const others = svc.getSection.mock.calls.filter(([, section]) => section !== "backlinks").map(([, section, opts]) => [section, opts])
    expect(others).toEqual(expect.arrayContaining([["rd-last-30", { refresh: false }], ["anchor-profile", { peek: true }]]))
    expect(others.every(([, o]) => !o.refresh)).toBe(true)
  })

  test("the frame is there at once: title, domain from the project, skeletons — no spinner page, no alert", () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Backlink overview" })).toBeTruthy()
    expect(text("bo-domain")).toBe("asgeyehospital.com")
    expect(document.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThanOrEqual(10)
    expect(screen.getByTestId("bo-kpis").children).toHaveLength(5)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("header: updated, profile age, Refresh, Download PDF, Live / Lost / All (Live selected) and Dofollow only (off)", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-updated")).toMatch(/^Updated .*2026/)
    expect(text("bo-since")).toBe("Backlink profile since Mar 2019")
    expect(screen.getByTestId("bo-refresh")).toBeTruthy()
    expect(text("bo-pdf")).toBe("Download PDF")
    expect(mode("Live").getAttribute("aria-pressed")).toBe("true")
    expect(mode("Lost").getAttribute("aria-pressed")).toBe("false")
    expect(mode("All").getAttribute("aria-pressed")).toBe("false")
    expect(screen.getByRole("switch", { name: "Dofollow only" }).getAttribute("aria-checked")).toBe("false")
    expect(screen.queryByTestId("bo-lost-banner")).toBeNull()
  })

  test("Download PDF opens the browser's print dialog", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {})
    renderPage()
    await screen.findByTestId("bo-rank-value")
    fireEvent.click(screen.getByTestId("bo-pdf"))
    expect(print).toHaveBeenCalledTimes(1)
  })

  test("asks for a project when none is selected, and requests nothing", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its backlink profile.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
  })
})

describe("Backlink Overview: shares its default view with the Domain Overview", () => {
  test("opening the page after the dashboard (same browser session) makes NO backlinks request: one cached answer for both", async () => {
    const other = (section) => ({ section, target: "asgeyehospital.com", market: { location: "India", language: "English" }, fetchedAt: "2026-10-27T08:00:00.000Z", result: section === "history" ? { items: [] } : section === "competitors" ? { totalCount: 0, self: null, items: [] } : section === "ranked-keywords" ? { totalCount: 0, metrics: null, items: [] } : { organic: null, paid: null } })
    svc.getSection.mockImplementation(async (_p, section) => extra(section) ?? ok(section === "backlinks" ? envelope(REAL_LIVE) : other(section)))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = render(createElement(QueryClientProvider, { client }, createElement(DomainOverviewDashboard)))
    await waitFor(() => expect(screen.getByTestId("do-kpi-rank").textContent).toContain("353"))
    first.unmount()
    const before = calls().length
    expect(before).toBe(1)
    render(createElement(QueryClientProvider, { client }, createElement(BacklinkOverviewDashboard)))
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-rank-value")).toBe("353")
    expect(calls()).toHaveLength(before)
  })
})

describe("Backlink Overview: link strength (real asgeyehospital.com figures)", () => {
  test("Domain rank 353 / 1,000 on the arc gauge", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-rank-value")).toBe("353")
    expect(text("bo-rank")).toContain("Domain rank / 1,000")
    expect(screen.getByTestId("bo-rank-gauge").getAttribute("stroke-dasharray")).toBe("35.3 100")
  })

  test("Spam score 17 / 100 · Medium on the scale, and the site's own score underneath", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-spam-value")).toBe("17")
    expect(screen.getByTestId("bo-spam-badge").getAttribute("data-band")).toBe("medium")
    expect(text("bo-spam-badge")).toBe("Medium")
    expect(within(screen.getByTestId("bo-spam")).getByRole("meter").getAttribute("aria-valuenow")).toBe("17")
    expect(text("bo-spam-site")).toBe("Your own site scores 5. The score comes from the sites linking to you.")
  })
})

describe("Backlink Overview: the tiles", () => {
  const value = (id) => text(`bo-kpi-${id}-value`)
  const caption = (id) => text(`bo-kpi-${id}-caption`)

  test("backlinks, linking sites, broken backlinks, anchors and the 30-day new vs lost", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect([value("backlinks"), caption("backlinks")]).toEqual(["18.3K", "4.6 per linking site"])
    expect([value("domains"), caption("domains")]).toEqual(["4K", "3.9K main domains · 3.7K IPs"])
    expect([value("broken"), caption("broken")]).toEqual(["1.6K", "9.0% point to error pages"])
    expect(screen.getByTestId("bo-kpi-backlinks-value").getAttribute("title")).toBe("18,343")
    await waitFor(() => expect(value("last30")).toBe("+17 / −14"))
    expect(caption("last30")).toBe("Net gain of 3 linking sites")
    // The anchor profile is not cached: no figure is guessed, the tile says where to get it.
    await waitFor(() => expect(caption("anchors")).toBe("Open Anchors to analyse your link text"))
    expect(value("anchors")).toBe("—")
  })

  test("broken backlinks are red when above 0, and every tile opens its list", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(screen.getByTestId("bo-kpi-broken-value").className).toContain("text-red")
    expect(screen.getByTestId("bo-kpi-backlinks-value").className).not.toContain("text-red")
    expect(screen.getByTestId("bo-kpi-domains").getAttribute("href")).toBe("/app/referring-domains")
    expect(screen.getByTestId("bo-kpi-broken").getAttribute("href")).toBe("/app/backlinks/list?broken=true")
    expect(screen.getByTestId("bo-kpi-backlinks").getAttribute("href")).toBe("/app/backlinks/list")
    expect(screen.getByTestId("bo-kpi-anchors").getAttribute("href")).toBe("/app/backlinks/anchors")
  })

  test("zero broken links is not red", async () => {
    serve({ result: { ...REAL_LIVE, broken_backlinks: 0, broken_pages: 0 } })
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(screen.getByTestId("bo-kpi-broken-value").className).not.toContain("text-red")
    expect(value("broken")).toBe("0")
  })
})

describe("Backlink Overview: fix these first", () => {
  test("numbered cards worst first, each with its button; the passed checks are listed as 'Already good'", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    const cards = within(screen.getByTestId("bo-health")).getAllByRole("listitem")
    expect(cards.map((c) => c.getAttribute("data-testid"))).toEqual(["bo-health-broken-backlinks", "bo-health-broken-pages", "bo-health-spam"])
    expect(cards.map((c) => c.getAttribute("data-level"))).toEqual(["problem", "problem", "warning"])
    expect(cards[0].textContent).toMatch(/^1Problem1,643 backlinks point to broken pages/)
    expect(screen.getByTestId("bo-health-broken-backlinks-link").getAttribute("href")).toBe("/app/backlinks/list?broken=true")
    expect(text("bo-health-broken-pages-link")).toBe("Get redirect plan")
    expect(screen.getByTestId("bo-health-broken-pages-link").getAttribute("href")).toBe("/app/backlinks/top-pages?status=error")
    expect(text("bo-health-spam")).toContain("Spam score 17/100")
    expect(screen.getByTestId("bo-health-spam-link").getAttribute("href")).toBe("/app/referring-domains?tab=toxic")
    expect(text("bo-good")).toBe("Already good:88.6% of sites give dofollow linksFew footer links (5.6%)")
  })

  test("with nothing wrong it says so", async () => {
    serve({ result: { ...REAL_LIVE, broken_backlinks: 0, broken_pages: 0, backlinks_spam_score: 3, referring_subnets: 3900 } })
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(screen.getByTestId("bo-fix-clear")).toBeTruthy()
    expect(text("bo-good")).toContain("No backlinks point to broken pages")
  })
})

describe("Backlink Overview: dofollow and where links come from", () => {
  test("Dofollow vs nofollow: a split bar for linking sites and one for linking pages", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-follow-sites")).toBe("Linking sites3,512 dofollow · 88.6%")
    expect(screen.getByTestId("bo-follow-sites").querySelector("[role=img]").getAttribute("aria-label")).toBe("Linking sites: 3,512 dofollow (88.6%), 453 nofollow")
    expect(text("bo-follow-pages")).toBe("Linking pages8,488 dofollow · 62.5%5,102 nofollow")
  })

  test("Countries (default view): Worldwide labelled, top 10 KNOWN + Others; the unknown share is a note, not a segment", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    const l = labels("bo-chart-countries")
    expect(l).toHaveLength(11)
    expect(l.slice(0, 3)).toEqual(["India", "United States", "Worldwide"])
    expect(l).not.toContain("Unknown")
    expect(l.at(-1)).toBe("Others")
    expect(text("bo-unknown-note")).toMatch(/^Country is unknown for 61\.6% of links/)
  })

  test("the other views: domain endings, site types, placement, attributes, text vs image", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    view("tlds")
    expect(labels("bo-chart-tlds").slice(0, 3)).toEqual([".com", ".in", ".org"])
    view("platformTypes")
    expect(labels("bo-chart-platformTypes")).toEqual(expect.arrayContaining(["Unknown", "Blogs", "Organization", "Message Boards"]))
    expect(text("bo-unknown-note")).toMatch(/several site types, so the shares add up to more than 100%/)
    view("semanticLocations")
    expect(labels("bo-chart-semanticLocations")).toEqual(["Not specified", "Details", "Article", "Section", "Footer", "Main", "Aside", "Figcaption", "Header", "Figure"])
    view("attributes")
    const counts = chart("bo-chart-attributes").getAttribute("data-counts").split("|").map(Number)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    view("linkTypes")
    expect(labels("bo-chart-linkTypes")).toEqual(["Text Anchor", "Image", "Redirect"])
    expect(screen.getByTestId("bo-view-linkTypes").getAttribute("aria-selected")).toBe("true")
  })

  test("About your site: the facts the provider knows, as chips", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-site-cms")).toBe("CMS Wordpress")
    expect(text("bo-site-server")).toBe("Server nginx")
    expect(text("bo-site-ip")).toBe("IP 13.205.194.193")
    expect(text("bo-site-country")).toBe("Hosted in India")
    expect(text("bo-site-crawled")).toBe("Crawled pages 6.8K")
    expect(text("bo-site-internal")).toBe("Internal links 255.9K")
    expect(text("bo-site-external")).toBe("Outgoing links 13.5K")
  })
})

describe("Backlink Overview: Live / Lost / All and Dofollow only", () => {
  test("Lost: a new request, the banner, and the lost figures; a breakdown the provider omitted says 'No data'", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    fireEvent.click(mode("Lost"))
    await waitFor(() => expect(last().backlinks).toEqual({ status: "lost", dofollow: false }))
    expect((await screen.findByTestId("bo-lost-banner")).textContent).toBe("Showing links that were removed or no longer found.")
    await waitFor(() => expect(text("bo-rank-value")).toBe("272"))
    expect(text("bo-kpi-backlinks-value")).toBe("3.2K")
    view("attributes")
    expect(within(screen.getByTestId("bo-sources")).getByText("No data")).toBeTruthy()
    expect(window.location.search).toBe("?status=lost")
  })

  test("All and Dofollow only each ask for their own response; dofollow-only reads 100% dofollow", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    fireEvent.click(mode("All"))
    await waitFor(() => expect(last().backlinks).toEqual({ status: "all", dofollow: false }))
    await waitFor(() => expect(text("bo-kpi-backlinks-value")).toBe("21.5K"))
    fireEvent.click(mode("Live"))
    fireEvent.click(screen.getByRole("switch", { name: "Dofollow only" }))
    await waitFor(() => expect(last().backlinks).toEqual({ status: "live", dofollow: true }))
    await waitFor(() => expect(text("bo-follow-sites")).toContain("100.0%"))
    expect(window.location.search).toBe("?dofollow=1")
  })

  test("each combination is bought ONCE: going back to one already loaded makes no request", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    fireEvent.click(mode("Lost"))
    await waitFor(() => expect(calls()).toHaveLength(2))
    await waitFor(() => expect(text("bo-rank-value")).toBe("272"))
    fireEvent.click(mode("Live"))
    await waitFor(() => expect(text("bo-rank-value")).toBe("353"))
    fireEvent.click(mode("Lost"))
    await waitFor(() => expect(text("bo-rank-value")).toBe("272"))
    fireEvent.click(screen.getByRole("switch", { name: "Dofollow only" }))
    await waitFor(() => expect(calls()).toHaveLength(3))
    fireEvent.click(screen.getByRole("switch", { name: "Dofollow only" }))
    await waitFor(() => expect(text("bo-rank-value")).toBe("272"))
    expect(calls()).toHaveLength(3)
  })

  test("the previous figures stay on screen (dimmed) while the new ones load", async () => {
    let release
    const gate = new Promise((r) => { release = r })
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[2]?.backlinks?.status === "lost") await gate; return base(...a) })
    renderPage()
    await screen.findByTestId("bo-rank-value")
    fireEvent.click(mode("Lost"))
    await waitFor(() => expect(calls()).toHaveLength(2))
    expect(text("bo-rank-value")).toBe("353")
    expect(screen.getByTestId("bo-content").getAttribute("aria-busy")).toBe("true")
    expect(screen.getByTestId("bo-content").className).toContain("opacity-60")
    release()
    await waitFor(() => expect(text("bo-rank-value")).toBe("272"))
  })

  test("a request still running when the controls change again is cancelled, and its answer never replaces the newer one", async () => {
    let release
    const gate = new Promise((r) => { release = r })
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[2]?.backlinks?.status === "lost") await gate; return base(...a) })
    renderPage()
    await screen.findByTestId("bo-rank-value")
    fireEvent.click(mode("Lost"))
    await waitFor(() => expect(calls()).toHaveLength(2))
    const slow = last().signal
    expect(slow.aborted).toBe(false)
    fireEvent.click(mode("All"))
    await waitFor(() => expect(slow.aborted).toBe(true))
    await waitFor(() => expect(text("bo-rank-value")).toBe("353"))
    release()
    await sleep(50)
    expect(text("bo-kpi-backlinks-value")).toBe("21.5K")
    expect(screen.queryByTestId("bo-lost-banner")).toBeNull()
  })

  test("the controls are read from the URL when the page opens", async () => {
    window.history.replaceState(null, "", "/app/backlinks/overview?status=all&dofollow=1")
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(last().backlinks).toEqual({ status: "all", dofollow: true })
    expect(mode("All").getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("switch", { name: "Dofollow only" }).getAttribute("aria-checked")).toBe("true")
  })

  test("junk in the URL reads as the default", async () => {
    window.history.replaceState(null, "", "/app/backlinks/overview?status=bogus&dofollow=yes")
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(last().backlinks).toEqual({ status: "live", dofollow: false })
  })

  test("Refresh asks the server to skip its cache, once", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    fireEvent.click(screen.getByTestId("bo-refresh"))
    await waitFor(() => expect(calls()).toHaveLength(2))
    expect(last().refresh).toBe(true)
    expect(calls()[0].refresh).toBe(false)
  })

  test("a refresh the server declined (data under a minute old) says so", async () => {
    serve((opts) => ok(envelope(REAL_LIVE, { refreshThrottled: Boolean(opts.refresh) })))
    renderPage()
    await screen.findByTestId("bo-rank-value")
    fireEvent.click(screen.getByTestId("bo-refresh"))
    expect(await screen.findByText(/refreshed less than a minute ago/)).toBeTruthy()
  })
})

describe("Backlink Overview: states", () => {
  test("no backlinks at all: 'No backlinks found for this domain yet' and no charts", async () => {
    serve({ result: { ...REAL_LIVE, backlinks: 0, referring_domains: 0, referring_pages: 0 } })
    renderPage()
    expect((await screen.findByTestId("bo-empty")).textContent).toBe("No backlinks found for this domain yet")
    expect(screen.queryByTestId("bo-content")).toBeNull()
    expect(screen.queryByTestId("bo-chart-countries")).toBeNull()
    expect(screen.getByTestId("bo-controls")).toBeTruthy()
  })

  test("an empty breakdown shows 'No data' in its own view instead of an empty bar; the rest of the page still shows", async () => {
    serve({ result: { ...REAL_LIVE, referring_links_tld: {}, referring_links_countries: null } })
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(within(screen.getByTestId("bo-sources")).getByText("No data")).toBeTruthy() // countries
    view("tlds")
    expect(within(screen.getByTestId("bo-sources")).getByText("No data")).toBeTruthy()
    expect(screen.queryByTestId("bo-chart-tlds")).toBeNull()
    view("attributes")
    expect(screen.getByTestId("bo-chart-attributes")).toBeTruthy()
    expect(screen.getByTestId("bo-follow-sites")).toBeTruthy()
  })

  test("a failed request: one page-level banner with Retry (and each card says so inline); Retry loads the page", async () => {
    let fail = true
    svc.getSection.mockImplementation(async (_p, section) => { if (extra(section)) return extra(section); if (fail) throw apiError("The data service is temporarily unavailable. Please try again later."); return ok(envelope(REAL_LIVE)) })
    renderPage()
    const banner = await screen.findByTestId("bo-page-error")
    expect(banner.textContent).toMatch(/temporarily unavailable/)
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(4)
    fail = false
    fireEvent.click(within(banner).getByRole("button", { name: /Retry/ }))
    await screen.findByTestId("bo-rank-value")
    expect(screen.queryByTestId("bo-page-error")).toBeNull()
    expect(calls()).toHaveLength(2)
  })

  test("a card's own Retry also reloads (it is the same single request)", async () => {
    let fail = true
    svc.getSection.mockImplementation(async (_p, section) => { if (extra(section)) return extra(section); if (fail) throw apiError("Nope."); return ok(envelope(REAL_LIVE)) })
    renderPage()
    await screen.findByTestId("bo-page-error")
    fail = false
    fireEvent.click(within(screen.getByTestId("bo-health")).getByRole("button", { name: /Retry/ }))
    await screen.findByTestId("bo-rank-value")
    expect(calls()).toHaveLength(2)
  })

  test("a failed switch keeps the page usable: the controls stay, the error is shown", async () => {
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[2]?.backlinks?.status === "lost") throw apiError("The data service is busy. Please wait a minute and try again.", { status: 429 }); return base(...a) })
    renderPage()
    await screen.findByTestId("bo-rank-value")
    fireEvent.click(mode("Lost"))
    expect((await screen.findByTestId("bo-page-error")).textContent).toMatch(/busy/)
    expect(mode("Live")).toBeTruthy()
  })

  test("a project whose URL has no public domain name gets a plain explanation", async () => {
    svc.getSection.mockImplementation(async () => { throw apiError("The project's website does not have a public domain name", { status: 422, code: "INVALID_TARGET" }) })
    renderPage()
    expect(await screen.findByText(/does not have a public domain name, so its backlinks cannot be loaded/)).toBeTruthy()
  })

  test("missing values are '—', never 0, NaN or undefined", async () => {
    serve({ result: { backlinks: 100, referring_domains: null, referring_pages: null, info: {}, referring_links_countries: { IN: 5 } } })
    renderPage()
    await screen.findByTestId("bo-kpis")
    await waitFor(() => expect(text("bo-kpi-backlinks-value")).toBe("100"))
    expect(text("bo-rank-value")).toBe("—")
    expect(text("bo-spam-value")).toBe("—")
    expect(screen.queryByTestId("bo-since")).toBeNull()
    expect(text("bo-kpi-domains-value")).toBe("—")
    expect(text("bo-kpi-domains-caption")).toBe("—")
    expect(screen.queryByTestId("bo-site-cms")).toBeNull() // unknown facts are left out, never shown as 0
    expect(screen.getByTestId("bo-content").textContent).not.toMatch(/NaN|undefined|\bnull\b/)
  })
})
