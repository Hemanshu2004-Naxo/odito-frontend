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

const BY = (r) => (r.status === "lost" ? REAL_LOST : r.dofollow ? REAL_DOFOLLOW : r.status === "all" ? REAL_ALL : REAL_LIVE)
function serve(overrides = {}) {
  svc.getSection.mockImplementation(async (_pid, section, opts) => {
    if (typeof overrides === "function") return overrides(opts)
    const req = opts?.backlinks ?? { status: "live", dofollow: false }
    const result = "result" in overrides ? overrides.result : BY(req)
    return ok(envelope(result))
  })
}
const calls = () => svc.getSection.mock.calls.map(([pid, section, opts, req]) => ({ pid, section, refresh: Boolean(opts?.refresh), backlinks: opts?.backlinks, signal: req?.signal }))
const last = () => calls().at(-1)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(BacklinkOverviewDashboard)))
}
const text = (id) => screen.getByTestId(id).textContent
const chart = (id) => screen.getByTestId(id)
const labels = (id) => chart(id).getAttribute("data-labels").split("|")
const mode = (name) => screen.getByRole("button", { name })

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
  test("ONE request for the whole page: the backlinks section, live, no filter, cache allowed", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(calls()).toHaveLength(1)
    expect(last()).toMatchObject({ pid: "p1", section: "backlinks", refresh: false, backlinks: { status: "live", dofollow: false } })
  })

  test("the frame is there at once: title, domain from the project, skeletons shaped like the cards — no spinner page, no alert", () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Backlink Overview" })).toBeTruthy()
    expect(text("bo-domain")).toBe("asgeyehospital.com")
    expect(document.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThanOrEqual(20)
    expect(screen.getByTestId("bo-kpis").children).toHaveLength(8)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("header: domain, last updated, Refresh, the Live / Lost / All control (Live selected) and Dofollow only (off)", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-updated")).toMatch(/^Last updated .*2026/)
    expect(screen.getByTestId("bo-refresh")).toBeTruthy()
    expect(mode("Live").getAttribute("aria-pressed")).toBe("true")
    expect(mode("Lost").getAttribute("aria-pressed")).toBe("false")
    expect(mode("All").getAttribute("aria-pressed")).toBe("false")
    expect(screen.getByRole("switch", { name: "Dofollow only" }).getAttribute("aria-checked")).toBe("false")
    expect(screen.queryByTestId("bo-lost-banner")).toBeNull()
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
    svc.getSection.mockImplementation(async (_p, section) => ok(section === "backlinks" ? envelope(REAL_LIVE) : other(section)))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = render(createElement(QueryClientProvider, { client }, createElement(DomainOverviewDashboard)))
    await waitFor(() => expect(screen.getByTestId("do-kpi-rank").textContent).toContain("353"))
    first.unmount()
    const before = calls().filter((c) => c.section === "backlinks").length
    expect(before).toBe(1)
    render(createElement(QueryClientProvider, { client }, createElement(BacklinkOverviewDashboard)))
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-rank-value")).toBe("353")
    expect(calls().filter((c) => c.section === "backlinks")).toHaveLength(before)
  })
})

describe("Backlink Overview: authority strip (real asgeyehospital.com figures)", () => {
  test("Domain Rank: '353 / 1,000' with a gauge and an info icon", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-rank")).toContain("353")
    expect(text("bo-rank")).toContain("/ 1,000")
    expect(screen.getByTestId("bo-rank-gauge").style.width).toBe("35.3%")
    expect(within(screen.getByTestId("bo-rank")).getByRole("meter").getAttribute("aria-valuenow")).toBe("353")
    expect(within(screen.getByTestId("bo-rank")).getByRole("button", { name: "About Domain Rank" })).toBeTruthy()
  })

  test("Spam Score: 17 with a Medium (amber) badge, and the site's own score underneath", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-spam-value")).toBe("17")
    const badge = screen.getByTestId("bo-spam-badge")
    expect(badge.textContent).toBe("Medium")
    expect(badge.getAttribute("data-band")).toBe("medium")
    expect(badge.className).toContain("amber")
    expect(text("bo-spam-site")).toBe("Site's own spam score: 5")
  })

  test("Profile age: 'Since Mar 2019' (7 yrs or more, with the first-seen date as a tooltip)", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-age-value")).toBe("Since Mar 2019")
    expect(text("bo-age-detail")).toMatch(/^\(\d+ yrs\)$/)
    expect(screen.getByTestId("bo-age-value").getAttribute("title")).toMatch(/^First seen .*2019/)
  })
})

describe("Backlink Overview: the eight KPI cards", () => {
  const value = (id) => text(`bo-kpi-${id}-value`)
  const caption = (id) => text(`bo-kpi-${id}-caption`)

  test("figures, with the exact value in a tooltip, and the calculated line under each", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(screen.getByTestId("bo-kpis").children).toHaveLength(8)
    expect([value("backlinks"), caption("backlinks")]).toEqual(["18.3K", "4.6 per domain"])
    expect([value("domains"), caption("domains")]).toEqual(["4K", "3.9K main domains"])
    expect(value("pages")).toBe("13.6K")
    expect(value("ips")).toBe("3.7K")
    expect([value("subnets"), caption("subnets")]).toEqual(["837", "21.1% diversity"])
    expect([value("dofollow"), caption("dofollow")]).toEqual(["3.5K", "88.6% of domains"])
    expect([value("broken"), caption("broken")]).toEqual(["1.6K", "9.0% of links"])
    expect(value("broken-pages")).toBe("2.5K")
    expect(screen.getByTestId("bo-kpi-backlinks-value").getAttribute("title")).toBe("18,343")
    expect(screen.getByTestId("bo-kpi-dofollow-value").getAttribute("title")).toBe("3,512")
  })

  test("Broken Backlinks is red when above 0; the cards that link somewhere do", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(screen.getByTestId("bo-kpi-broken-value").className).toContain("text-red")
    expect(screen.getByTestId("bo-kpi-broken-pages-value").className).toContain("text-red")
    expect(screen.getByTestId("bo-kpi-backlinks-value").className).not.toContain("text-red")
    expect(screen.getByTestId("bo-kpi-domains").getAttribute("href")).toBe("/app/referring-domains")
    expect(screen.getByTestId("bo-kpi-broken").getAttribute("href")).toBe("/app/backlinks/list?broken=true")
    expect(screen.getByTestId("bo-kpi-broken-pages").getAttribute("href")).toBe("/app/backlinks/top-pages?status=error")
    expect(screen.getByTestId("bo-kpi-backlinks").tagName).toBe("DIV")
  })

  test("zero broken links is not red", async () => {
    serve({ result: { ...REAL_LIVE, broken_backlinks: 0, broken_pages: 0 } })
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(screen.getByTestId("bo-kpi-broken-value").className).not.toContain("text-red")
    expect(value("broken")).toBe("0")
  })
})

describe("Backlink Overview: the charts", () => {
  test("Follow vs Nofollow: two donuts (domains, pages) with the dofollow % in the centre", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-donut-domains-center")).toBe("88.6%")
    expect(text("bo-donut-pages-center")).toBe("62.5%")
    expect(text("bo-donut-domains")).toContain("3,512 · 88.6%")
    expect(text("bo-donut-domains")).toContain("453 · 11.4%")
    expect(text("bo-donut-pages")).toContain("8,488 · 62.5%")
    expect(text("bo-donut-pages")).toContain("5,102 · 37.5%")
  })

  test("Link attributes: sorted descending; sponsored and UGC are amber and each bar explains itself", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(labels("bo-chart-attributes")).toEqual(["Nofollow", "Noopener", "Noreferrer", "External", "UGC", "Sponsored"])
    const counts = chart("bo-chart-attributes").getAttribute("data-counts").split("|").map(Number)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    expect(chart("bo-chart-attributes").getAttribute("aria-label")).toContain("Nofollow 5,102 (37.5%)")
    expect(screen.getByText(/Amber bars: sponsored and ugc/)).toBeTruthy()
  })

  test("Top countries: Worldwide labelled, full names, top 10 KNOWN countries + Others (11 bars); the unknown is a note, not a bar", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    const l = labels("bo-chart-countries")
    expect(l).toHaveLength(11)
    expect(l.slice(0, 3)).toEqual(["India", "United States", "Worldwide"])
    expect(l).not.toContain("Unknown")
    expect(l).toContain("Colombia")
    expect(l).toContain("Anguilla")
    expect(l.at(-1)).toBe("Others")
    expect(chart("bo-chart-countries").textContent).toContain("🇮🇳 India")
    expect(chart("bo-chart-countries").textContent).toContain("🌐 Worldwide")
    expect(screen.getByText(/Unknown: 61\.6% of links/)).toBeTruthy()
  })

  test("Top TLDs: dotted, top 10 + Others", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    const l = labels("bo-chart-tlds")
    expect(l.slice(0, 3)).toEqual([".com", ".in", ".org"])
    expect(l).toHaveLength(11)
    expect(l.at(-1)).toBe("Others")
  })

  test("Linking site types, Link placement and Link types: Title Case, 'Not specified' for the empty placement key", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(labels("bo-chart-platforms")).toEqual(expect.arrayContaining(["Unknown", "Blogs", "Organization", "Cms", "News", "Ecommerce", "Message Boards", "Wikis"]))
    expect(labels("bo-chart-placement")).toEqual(["Not specified", "Details", "Article", "Section", "Footer", "Main", "Aside", "Figcaption", "Header", "Figure"])
    expect(labels("bo-chart-types")).toEqual(["Text Anchor", "Image", "Redirect"])
    expect(within(screen.getByTestId("bo-chart-placement").closest("section")).getByRole("button", { name: "About Link placement" })).toBeTruthy()
  })
})

describe("Backlink Overview: profile health and site info", () => {
  test("six checks with a status, a message and links where there is somewhere to go", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    const row = (id) => screen.getByTestId(`bo-health-${id}`)
    expect(screen.getByTestId("bo-health").children).toHaveLength(6)
    expect(row("broken-backlinks").getAttribute("data-level")).toBe("red")
    expect(row("broken-backlinks").textContent).toContain("1,643 backlinks point to broken URLs — fix with redirects.")
    expect(screen.getByTestId("bo-health-broken-backlinks-link").getAttribute("href")).toBe("/app/backlinks/list?broken=true")
    expect(row("broken-pages").textContent).toContain("2,498 of your pages with links return errors.")
    expect(screen.getByTestId("bo-health-broken-pages-link").getAttribute("href")).toBe("/app/backlinks/top-pages?status=error")
    expect([row("spam").getAttribute("data-level"), row("spam").textContent]).toEqual(["amber", expect.stringContaining("Spam score 17/100.")])
    expect(row("dofollow").getAttribute("data-level")).toBe("green")
    expect(row("subnets").getAttribute("data-level")).toBe("amber")
    expect(row("subnets").textContent).toContain("Many links come from the same networks.")
    expect(row("footer").getAttribute("data-level")).toBe("green")
    expect(row("footer").textContent).toContain("5.6% of links are footer links.")
    expect(screen.queryByTestId("bo-health-spam-link")).toBeNull()
  })

  test("Site info: CMS, server, IP, hosting country with flag, site-type chips, crawled pages, internal and outgoing links", async () => {
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(text("bo-site-cms")).toContain("Wordpress")
    expect(text("bo-site-server")).toContain("nginx")
    expect(text("bo-site-ip")).toContain("13.205.194.193")
    expect(text("bo-site-country")).toContain("🇮🇳")
    expect(text("bo-site-country")).toContain("India")
    expect(text("bo-site-types")).toContain("Blogs")
    expect(text("bo-site-types")).toContain("Organization")
    expect(text("bo-site-crawled")).toContain("6.8K")
    expect(text("bo-site-internal")).toContain("255.9K")
    expect(text("bo-site-external")).toContain("13.5K")
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
    const attrs = screen.getByText("Link attributes").closest("section")
    expect(within(attrs).getByText("No data")).toBeTruthy()
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
    await waitFor(() => expect(text("bo-donut-domains-center")).toBe("100.0%"))
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
    svc.getSection.mockImplementation(async (...a) => { if (a[2].backlinks.status === "lost") await gate; return base(...a) })
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
    svc.getSection.mockImplementation(async (...a) => { if (a[2].backlinks.status === "lost") await gate; return base(...a) })
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
    window.history.replaceState(null, "", "/app/backlinks/overview?status=bogus&dofollow=yes")
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

  test("an empty breakdown shows 'No data' in its own card instead of an empty chart; the rest of the page still shows", async () => {
    serve({ result: { ...REAL_LIVE, referring_links_tld: {}, referring_links_countries: null } })
    renderPage()
    await screen.findByTestId("bo-rank-value")
    expect(within(screen.getByText("Top TLDs").closest("section")).getByText("No data")).toBeTruthy()
    expect(within(screen.getByText("Top countries").closest("section")).getByText("No data")).toBeTruthy()
    expect(screen.queryByTestId("bo-chart-tlds")).toBeNull()
    expect(screen.getByTestId("bo-chart-attributes")).toBeTruthy()
  })

  test("a failed request: one page-level banner with Retry (and each card says so inline); Retry loads the page", async () => {
    let fail = true
    svc.getSection.mockImplementation(async () => { if (fail) throw apiError("The data service is temporarily unavailable. Please try again later."); return ok(envelope(REAL_LIVE)) })
    renderPage()
    const banner = await screen.findByTestId("bo-page-error")
    expect(banner.textContent).toMatch(/temporarily unavailable/)
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(5)
    fail = false
    fireEvent.click(within(banner).getByRole("button", { name: /Retry/ }))
    await screen.findByTestId("bo-rank-value")
    expect(screen.queryByTestId("bo-page-error")).toBeNull()
    expect(calls()).toHaveLength(2)
  })

  test("a card's own Retry also reloads (it is the same single request)", async () => {
    let fail = true
    svc.getSection.mockImplementation(async () => { if (fail) throw apiError("Nope."); return ok(envelope(REAL_LIVE)) })
    renderPage()
    await screen.findByTestId("bo-page-error")
    fail = false
    fireEvent.click(within(screen.getByText("Profile health").closest("section")).getByRole("button", { name: /Retry/ }))
    await screen.findByTestId("bo-rank-value")
    expect(calls()).toHaveLength(2)
  })

  test("a failed switch keeps the page usable: the controls stay, the error is shown", async () => {
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[2].backlinks.status === "lost") throw apiError("The data service is busy. Please wait a minute and try again.", { status: 429 }); return base(...a) })
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
    expect(text("bo-age-value")).toBe("—")
    expect(text("bo-kpi-domains-value")).toBe("—")
    expect(text("bo-kpi-subnets-caption")).toBe("—")
    expect(text("bo-kpi-dofollow-caption")).toBe("—")
    expect(text("bo-donut-domains")).not.toMatch(/NaN|undefined|null/)
    expect(text("bo-site-cms")).toContain("—")
    expect(screen.getByTestId("bo-content").textContent).not.toMatch(/NaN|undefined|\bnull\b/)
  })
})
