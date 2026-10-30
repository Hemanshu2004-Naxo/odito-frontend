import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hook, query keys, mapping and components run.
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const settingsSvc = vi.hoisted(() => ({ get: vi.fn() }))
const anchorSvc = vi.hoisted(() => ({ get: vi.fn(), data: { saved: false, brand_terms: [], target_keywords: [] } }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
  DEFAULT_HISTORY_MONTHS: 12,
}))
vi.mock("@/services/anchorSettingsService", () => ({ default: anchorSvc, anchorSettingsService: anchorSvc }))
vi.mock("@/services/competitorSettingsService", () => ({ default: settingsSvc, competitorSettingsService: settingsSvc }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: project.current }) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))
const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => router }))

import DomainOverviewDashboard from "./DomainOverviewDashboard"
import ComingSoon from "./ComingSoon"
import {
  rankOverview, history, rankedKeywords, competitors, backlinks, organic, envelope,
} from "./testFixtures"

const SECTIONS = ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"]
// The hub's extra sources, quiet by default (no error pages, a cold anchor cache); the hub's own tests make them loud.
const fixtures = () => ({
  "rank-overview": rankOverview(),
  "history": history(),
  "ranked-keywords": rankedKeywords(),
  "competitors": competitors(),
  "backlinks": backlinks(),
  "tp-counts": envelope("tp-counts", { pages: 0, errors: 0, redirects: 0 }),
  "rd-toxic-count": envelope("rd-toxic-count", { count: 0, spamAbove: 30 }),
  "rd-last-30": envelope("rd-last-30", { since: "2026-09-28", days: 30, new: 41, lost: 12 }),
  "domain-pages": envelope("domain-pages", { totalCount: 0, items: [] }),
  "anchor-profile": envelope("anchor-profile", null, { peek: true, cached: false, fetchedAt: null }),
})

/** Answer every section from `overrides` or the fixtures; an Error value rejects like apiService does. */
function answer(overrides = {}) {
  svc.getSection.mockImplementation(async (_pid, section) => {
    const r = section in overrides ? overrides[section] : fixtures()[section]
    if (r instanceof Error) throw r
    if (typeof r === "function") return r()
    return { success: true, data: r }
  })
}
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = () => createElement(QueryClientProvider, { client }, createElement(DomainOverviewDashboard))
  const utils = render(ui())
  return { ...utils, client, rerender: () => utils.rerender(ui()) }
}
const calls = () => svc.getSection.mock.calls.map(([pid, section, opts]) => ({ pid, section, refresh: Boolean(opts?.refresh) }))
const FIVE_SECTIONS = ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"]
const fiveCalls = () => calls().filter((c) => FIVE_SECTIONS.includes(c.section))
const kpi = (name) => screen.getByTestId(`do-kpi-${name}`)

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 }) // headroom for a loaded full-suite run
  vi.setConfig({ testTimeout: 30000 })
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
  vi.clearAllMocks()
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  settingsSvc.get.mockResolvedValue({ success: true, data: { tracked: [], excluded: [], limits: { tracked: 10, excluded: 1000 } } })
  anchorSvc.data = { saved: false, brand_terms: [], target_keywords: [] }
  anchorSvc.get.mockImplementation(async () => ({ success: true, data: anchorSvc.data }))
  answer()
})

describe("Domain Overview: loading", () => {
  test("all five sections are requested at once, for the project, without skipping the cache", async () => {
    renderPage()
    await screen.findByText("100.4K")
    expect(fiveCalls().map((c) => c.section).sort()).toEqual([...SECTIONS].sort())
    expect(calls().every((c) => c.pid === "p1" && c.refresh === false)).toBe(true)
  })

  test("sections show their own skeletons while loading — no page-wide spinner — and the page frame is already there", async () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { name: "Domain Overview" })).toBeTruthy()
    expect(screen.getByTestId("do-domain").textContent).toBe("asgeyehospital.com") // from the project, before any answer
    expect(screen.getByTestId("do-kpis").querySelectorAll(".skeleton-shimmer").length).toBeGreaterThanOrEqual(6)
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("the page asks for a project when none is selected", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its domain overview.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
  })
})

describe("Domain Overview: header", () => {
  test("shows the domain, the market and when the data was fetched", async () => {
    renderPage()
    await screen.findByText("100.4K")
    expect(screen.getByTestId("do-domain").textContent).toBe("asgeyehospital.com")
    expect(screen.getByTestId("do-market").textContent).toBe("India · English")
    expect(screen.getByTestId("do-updated").textContent).toMatch(/^Last updated .*2026/) // the time itself is shown in the viewer's locale
    expect(screen.getByTestId("do-updated").getAttribute("title")).toMatch(/History: /) // each section's own time
  })
})

describe("Domain Overview: KPI cards", () => {
  test("six cards with compact numbers and exact values on hover", async () => {
    renderPage()
    await screen.findByText("100.4K")
    expect(within(kpi("traffic")).getByText("100.4K").getAttribute("title")).toBe("100,412")
    expect(within(kpi("traffic")).getByText("Est. monthly traffic")).toBeTruthy()
    expect(within(kpi("keywords")).getByText("4.1K").getAttribute("title")).toBe("4,139")
    expect(within(kpi("value")).getByText("$24.5K")).toBeTruthy()
    expect(kpi("rank").textContent).toMatch(/352\s*\/ 1000/)
    expect(within(kpi("backlinks")).getByText("18.3K").getAttribute("title")).toBe("18,297")
    expect(within(kpi("refdomains")).getByText("3.9K").getAttribute("title")).toBe("3,949")
    expect(screen.getByTestId("do-kpis").children).toHaveLength(6)
  })

  test("the traffic label carries the 'estimated' hint", async () => {
    renderPage()
    await screen.findByText("100.4K")
    const hint = within(kpi("traffic")).getByRole("button", { name: "About Organic Traffic" })
    expect(document.getElementById(hint.getAttribute("aria-describedby")).textContent).toBe("Estimated from rankings × CTR")
  })

  test("month-over-month change: green with an up arrow when up, red when down", async () => {
    renderPage()
    await screen.findByText("100.4K")
    const up = within(kpi("traffic")).getByTestId("do-delta")
    expect(up.textContent).toMatch(/61\.4%/)
    expect(up.getAttribute("data-direction")).toBe("up")
    expect(up.className).toMatch(/emerald/)
    expect(up.getAttribute("title")).toBe("vs Sep 26")
  })

  test("a fall is red", async () => {
    answer({ "rank-overview": rankOverview({ organic: organic({ etv: 50000, count: 3000 }) }) })
    renderPage()
    await screen.findByText("50K")
    const down = within(kpi("traffic")).getByTestId("do-delta")
    expect(down.getAttribute("data-direction")).toBe("down")
    expect(down.className).toMatch(/red/)
    expect(down.textContent).toMatch(/19\.6%/)
  })

  test("Referring Domains opens the existing Referring Domains page", async () => {
    renderPage()
    await screen.findByText("100.4K")
    const link = kpi("refdomains")
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toBe("/app/referring-domains")
    // Every card is a link: Organic Traffic and Traffic Value open Traffic History, Organic Keywords its page, the other three as before.
    expect(Array.from(screen.getByTestId("do-kpis").querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([
      "/app/traffic-history", "/app/organic-keywords", "/app/traffic-history", "/app/backlinks/overview", "/app/backlinks/overview", "/app/referring-domains",
    ])
  })

  test("paid search is a muted line, shown only when there is any", async () => {
    renderPage()
    await screen.findByText("100.4K")
    expect(screen.queryByTestId("do-paid")).toBeNull()
  })

  test("paid search appears when there is paid traffic or keywords", async () => {
    answer({ "rank-overview": rankOverview({ paid: { etv: 1200, count: 35, estimated_paid_traffic_cost: 90 } }) })
    renderPage()
    expect((await screen.findByTestId("do-paid")).textContent).toMatch(/Paid search: 1\.2K est\. monthly traffic · 35 paid keywords/)
  })

  test("a missing figure is an em dash, never 0 / NaN / undefined", async () => {
    answer({ backlinks: backlinks({ rank: null, backlinks: null, referring_domains: null }) })
    renderPage()
    await screen.findByText("100.4K")
    for (const name of ["rank", "backlinks", "refdomains"]) {
      expect(within(kpi(name)).getByText("—")).toBeTruthy()
      expect(kpi(name).querySelector(".text-3xl").textContent).toBe("—") // the figure itself; the hint text legitimately contains digits
    }
    expect(within(kpi("rank")).queryByText("/ 1000")).toBeNull()
  })
})

describe("Domain Overview: charts", () => {
  test("the trend is plotted oldest to newest, switchable between traffic and keywords, with a table for screen readers", async () => {
    renderPage()
    await screen.findByText("100.4K")
    const group = screen.getByRole("group", { name: "Metric shown in the chart" })
    expect(within(group).getByRole("button", { name: "Traffic" }).getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(within(group).getByRole("button", { name: "Keywords" }))
    expect(within(group).getByRole("button", { name: "Keywords" }).getAttribute("aria-pressed")).toBe("true")
    expect(within(group).getByRole("button", { name: "Traffic" }).getAttribute("aria-pressed")).toBe("false")
    const table = screen.getByRole("table", { name: "Organic traffic and ranking keywords by month" })
    const months = within(table).getAllByRole("row").slice(1).map((r) => r.querySelector("th").textContent)
    expect(months).toEqual(["Jul 26", "Aug 26", "Sep 26", "Oct 26"])
    expect(within(table).getAllByRole("row")[1].textContent).toMatch(/110,567.*3,758/)
  })

  test("keyword positions: the Top 10 headline and a list of the six buckets, each a link to the matching Organic Keywords range", async () => {
    renderPage()
    await screen.findByText("100.4K")
    expect(screen.getByTestId("do-top10").textContent).toBe("Top 10: 1.5K keywords (36.5%)")
    const list = screen.getByRole("list", { name: "Keywords per position range" })
    const links = within(list).getAllByRole("link")
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual([
      "Positions #1: 165 keywords. Open them in Organic Keywords", "Positions #2–3: 308 keywords. Open them in Organic Keywords",
      "Positions #4–10: 1,037 keywords. Open them in Organic Keywords", "Positions #11–20: 1,017 keywords. Open them in Organic Keywords",
      "Positions #21–50: 1,173 keywords. Open them in Organic Keywords", "Positions #51–100: 439 keywords. Open them in Organic Keywords",
    ])
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/app/organic-keywords?pos=top1", "/app/organic-keywords?pos=2-3", "/app/organic-keywords?pos=4-10",
      "/app/organic-keywords?pos=11-20", "/app/organic-keywords?pos=21-50", "/app/organic-keywords?pos=51-100",
    ])
  })

})

describe("Domain Overview: the traffic chart card opens Traffic History", () => {
  test("clicking the card (title, chart area) navigates to the Traffic History page", async () => {
    renderPage()
    await screen.findByText("100.4K")
    fireEvent.click(screen.getByRole("heading", { name: "Organic traffic — last 12 months" }))
    expect(router.push).toHaveBeenLastCalledWith("/app/traffic-history")
    fireEvent.click(screen.getByTestId("do-trend-chart"))
    expect(router.push).toHaveBeenCalledTimes(2)
  })

  test("the Traffic / Keywords toggle still works and does NOT navigate", async () => {
    renderPage()
    await screen.findByText("100.4K")
    fireEvent.click(within(screen.getByRole("group", { name: "Metric shown in the chart" })).getByRole("button", { name: "Keywords" }))
    expect(within(screen.getByRole("group", { name: "Metric shown in the chart" })).getByRole("button", { name: "Keywords" }).getAttribute("aria-pressed")).toBe("true")
    expect(router.push).not.toHaveBeenCalled()
  })

  test("a visible link is the keyboard and screen-reader way in", async () => {
    renderPage()
    await screen.findByText("100.4K")
    const link = screen.getByRole("link", { name: /View full traffic history/ })
    expect(link.getAttribute("href")).toBe("/app/traffic-history")
    fireEvent.click(link)
    expect(router.push).not.toHaveBeenCalled() // the link navigates by itself; the card handler ignores clicks on links
  })

  test("the card looks clickable", async () => {
    renderPage()
    await screen.findByText("100.4K")
    expect(screen.getByTestId("do-trend-card").className).toMatch(/cursor-pointer/)
  })
})

describe("Domain Overview: keyword movement strip", () => {
  test("New / Improved / Declined / Lost from the overview call", async () => {
    renderPage()
    await screen.findByText("100.4K")
    expect(screen.getByTestId("do-movement-new").textContent).toBe("2.8K")
    expect(screen.getByTestId("do-movement-improved").textContent).toBe("621")
    expect(screen.getByTestId("do-movement-declined").textContent).toBe("572")
    expect(screen.getByTestId("do-movement-lost").textContent).toBe("2.4K")
    expect(screen.getByTestId("do-movement-lost").getAttribute("title")).toBe("2,423")
    const strip = screen.getByTestId("do-movement")
    for (const label of ["New", "Improved", "Declined", "Lost"]) expect(within(strip).getByText(label)).toBeTruthy()
  })
})

describe("Domain Overview: top keywords", () => {
  test("rows show position, a movement badge (▲ green, ▼ red, NEW), volume, KD, traffic and a truncated URL with the full one on hover", async () => {
    renderPage()
    await screen.findByText("asg hospital")
    const rows = within(screen.getByTestId("do-top-keywords")).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(5)
    const cells = (r) => within(r).getAllByRole("cell")

    expect(cells(rows[0])[0].textContent).toBe("asg hospital")
    expect(cells(rows[0])[1].textContent).toMatch(/1\s*New/) // NEW: no previous rank
    expect(within(rows[0]).getByTestId("do-badge-new")).toBeTruthy()
    expect(cells(rows[0])[2].textContent).toBe("74K")

    expect(within(rows[1]).getByTestId("do-badge-up").textContent).toBe("▲3")
    expect(within(rows[1]).getByTestId("do-badge-up").className).toMatch(/emerald/)
    expect(cells(rows[1])[3].textContent).toBe("22")
    const url = within(rows[1]).getByRole("link")
    expect(url.textContent).toBe("/hospital/kokane-chowk-pimpri-chinchwad/")
    expect(url.getAttribute("title")).toBe("https://asgeyehospital.com/hospital/kokane-chowk-pimpri-chinchwad/")
    expect(url.className).toMatch(/truncate/)

    expect(within(rows[2]).getByTestId("do-badge-down").textContent).toBe("▼2")
    expect(within(rows[2]).getByTestId("do-badge-down").className).toMatch(/red/)

    // unchanged and unknown claim no movement at all
    for (const i of [3, 4]) expect(within(rows[i]).queryByTestId(/do-badge/)).toBeNull()
    // missing values are dashes
    expect(cells(rows[4]).slice(2).map((c) => c.textContent)).toEqual(["—", "—", "—", "—"])
  })

  test("the footer links to the (placeholder) organic keywords page with the total", async () => {
    renderPage()
    const link = await screen.findByRole("link", { name: /View all 4,139 keywords/ })
    expect(link.getAttribute("href")).toBe("/app/organic-keywords")
  })
})

describe("Domain Overview: the backlink cards", () => {
  test("Domain Rank and Backlinks open the Backlink Overview; Referring Domains keeps its own page", async () => {
    renderPage()
    await screen.findByText("100.4K")
    expect(screen.getByTestId("do-kpi-rank").getAttribute("href")).toBe("/app/backlinks/overview")
    expect(screen.getByTestId("do-kpi-rank").getAttribute("aria-label")).toBe("Domain Rank: open the Backlink Overview")
    expect(screen.getByTestId("do-kpi-backlinks").getAttribute("href")).toBe("/app/backlinks/overview")
    expect(screen.getByTestId("do-kpi-refdomains").getAttribute("href")).toBe("/app/referring-domains")
    expect(screen.getByTestId("do-kpi-refdomains").getAttribute("aria-label")).toBe("Referring Domains: open the Referring Domains page")
    expect(screen.getByTestId("do-kpi-traffic").getAttribute("href")).toBe("/app/traffic-history")
    expect(screen.getByTestId("do-kpi-traffic").getAttribute("aria-label")).toBe("Organic Traffic: open Traffic History")
    expect(screen.getByTestId("do-kpi-value").getAttribute("href")).toBe("/app/traffic-history")
    expect(screen.getByTestId("do-kpi-keywords").getAttribute("href")).toBe("/app/organic-keywords")
    expect(screen.getByTestId("do-kpi-keywords").getAttribute("aria-label")).toBe("Organic Keywords: open Organic Keywords")
  })

  test("it asks for the Backlink Overview's DEFAULT view: no parameters at all (live, no filter), so both pages share one answer", async () => {
    renderPage()
    await screen.findByText("100.4K")
    const call = svc.getSection.mock.calls.find(([, section]) => section === "backlinks")
    expect(call[2]).toEqual({ refresh: false })
  })
})

describe("Domain Overview: the Backlink overview card", () => {
  test("summarises the backlink profile from the response the cards above already use (no extra request) and links to the full page", async () => {
    answer({ backlinks: backlinks({ backlinks: 1000, referring_domains: 100, referring_domains_nofollow: 20, referring_pages: 500, referring_ips: 90, broken_backlinks: 50, backlinks_spam_score: 40, referring_links_countries: { "": 200, IN: 150, US: 50, WW: 40 }, info: { target_spam_score: 3 } }) })
    renderPage()
    const card = await screen.findByTestId("do-backlinks")
    expect(screen.getByTestId("do-bl-dofollow").textContent).toContain("80.0%")
    expect(screen.getByTestId("do-bl-spam").textContent).toContain("40")
    expect(screen.getByTestId("do-bl-spam").textContent).toContain("High")
    expect(screen.getByTestId("do-bl-broken").textContent).toContain("5.0% of links")
    expect(screen.getByTestId("do-bl-broken").querySelector("[class*='text-red']")).toBeTruthy() // broken links above 0 are red
    // Shares are of the links with a KNOWN country (500 - 200 unknown = 300); Worldwide is known; the unknown part is its own muted item.
    const countries = screen.getAllByTestId("do-country").map((li) => li.textContent.replace(/\s+/g, " ").trim())
    expect(countries).toEqual([expect.stringMatching(/India 50\.0%/), expect.stringMatching(/United States 16\.7%/), expect.stringMatching(/Worldwide 13\.3%/)])
    expect(screen.getByTestId("do-country-unknown").textContent).toBe("Unknown 40.0%")
    expect(screen.getByTestId("do-backlinks-link").getAttribute("href")).toBe("/app/backlinks/overview")
    expect(svc.getSection.mock.calls.filter(([, section]) => section === "backlinks")).toHaveLength(1)
    expect(card).toBeTruthy()
  })

  test("no backlinks: says so; a failed section: the card carries its own error and Retry", async () => {
    answer({ backlinks: backlinks({ backlinks: 0 }) })
    const { unmount } = renderPage()
    expect(await screen.findByText("No backlinks found for this domain yet.")).toBeTruthy()
    unmount()
    answer({ backlinks: apiError("The data service is busy.", { status: 429 }) })
    renderPage()
    const card = (await screen.findByText("Backlink overview")).closest("section")
    expect((await within(card).findByRole("alert")).textContent).toMatch(/busy/)
    expect(within(card).getByRole("button", { name: /Retry/ })).toBeTruthy()
  })
})

describe("Domain Overview: competitors", () => {
  test("domain with a favicon, shared keywords, average position and their traffic", async () => {
    renderPage()
    await screen.findByText("dragarwal.com")
    const rows = within(screen.getByTestId("do-competitors")).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(3)
    const first = within(rows[0]).getAllByRole("cell")
    expect(first[0].textContent).toBe("dragarwal.com")
    expect(first[1].textContent).toBe("2.4K")
    expect(first[2].textContent).toMatch(/^You 26K · Them 36\.9K/) // head-to-head on the shared keywords (replaces "their traffic")
    expect(first[3].textContent).toBe("12.8")
    expect(within(rows[0]).queryByText("328.6K")).toBeNull()
    const icon = rows[0].querySelector("img")
    expect(icon.getAttribute("src")).toBe("https://www.google.com/s2/favicons?domain=dragarwal.com&sz=32")
    expect(icon.getAttribute("alt")).toBe("")
    expect(icon.getAttribute("referrerpolicy")).toBe("no-referrer")
  })

  test("a favicon that fails to load is replaced by the domain's first letter", async () => {
    renderPage()
    await screen.findByText("dragarwal.com")
    const row = within(screen.getByTestId("do-competitors")).getAllByRole("row")[1]
    fireEvent.error(row.querySelector("img"))
    expect(row.querySelector("img")).toBeNull()
    expect(within(row).getAllByRole("cell")[0].textContent).toBe("ddragarwal.com")
  })

  test("the card asks for the Competitors page's DEFAULT view (no parameters at all) and shows the first 5 of its rows", async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ ...competitors().result.items[0], domain: `rival-${i + 1}.com`, intersections: 1000 - i }))
    answer({ competitors: competitors(many) })
    renderPage()
    await screen.findByText("rival-1.com")
    const rows = within(screen.getByTestId("do-competitors")).getAllByRole("row").slice(1)
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["rival-1.com", "rival-2.com", "rival-3.com", "rival-4.com", "rival-5.com"])
    const call = svc.getSection.mock.calls.find(([, section]) => section === "competitors")
    expect(call[2]).toEqual({ refresh: false }) // no competitors option: the plain URL, i.e. the page's default view
  })

  test("the project's own row is never listed, and the project's exclude list is loaded before the competitors are requested", async () => {
    const order = []
    settingsSvc.get.mockImplementation(async () => { order.push("settings"); return { success: true, data: { tracked: [], excluded: ["practo.com"], limits: { tracked: 10, excluded: 1000 } } } })
    svc.getSection.mockImplementation(async (_pid, section) => { order.push(section); return { success: true, data: fixtures()[section] } })
    renderPage()
    await screen.findByText("dragarwal.com")
    expect(order.indexOf("settings")).toBeLessThan(order.indexOf("competitors"))
    expect(screen.queryByText("asgeyehospital.com", { selector: "[data-testid=do-competitors] *" })).toBeNull()
  })

  test("the footer links to the competitors page", async () => {
    renderPage()
    const link = await screen.findByRole("link", { name: /View all competitors/ })
    expect(link.getAttribute("href")).toBe("/app/competitors")
  })
})

describe("Domain Overview: every section fails on its own", () => {
  test("a failing history call shows an inline error with Retry in the chart only; the rest still works", async () => {
    answer({ history: apiError("The data service took too long to respond. Please try again.", { status: 504, code: "PROVIDER_TIMEOUT" }) })
    renderPage()
    await screen.findByText("100.4K")
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toMatch(/took too long to respond/)
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeTruthy()
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    // everything else is intact
    expect(screen.getByTestId("do-top10")).toBeTruthy()
    expect(screen.getByTestId("do-movement")).toBeTruthy()
    expect(screen.getByText("asg hospital")).toBeTruthy()
    expect(screen.getByText("dragarwal.com")).toBeTruthy()
    // the headline traffic survives; only its trend is unavailable
    expect(within(kpi("traffic")).getByText("100.4K")).toBeTruthy()
    expect(within(kpi("traffic")).getByText("Trend unavailable")).toBeTruthy()
    expect(within(kpi("traffic")).queryByTestId("do-delta")).toBeNull()
  })

  test("Retry refetches only that section, and the section recovers", async () => {
    let healthy = false
    answer({ history: () => { if (!healthy) throw apiError("The data service is temporarily unavailable. Please try again later."); return { success: true, data: history() } } })
    renderPage()
    const retry = await within(await screen.findByTestId("do-trend-card")).findByRole("button", { name: "Retry" })
    expect(calls().filter((c) => c.section === "history")).toHaveLength(1)
    const before = calls().length
    healthy = true
    fireEvent.click(retry)
    await screen.findByTestId("do-trend-chart")
    expect(calls().slice(before).map((c) => c.section)).toEqual(["history"])
    expect(calls().slice(before).every((c) => c.refresh === false)).toBe(true)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("a failing backlinks call affects only the three backlink cards", async () => {
    answer({ backlinks: apiError("The data service is busy. Please wait a minute and try again.", { status: 429, code: "PROVIDER_RATE_LIMITED" }) })
    renderPage()
    await screen.findByText("100.4K")
    for (const name of ["rank", "backlinks", "refdomains"]) {
      expect(within(kpi(name)).getByRole("alert").textContent).toMatch(/busy/)
      expect(within(kpi(name)).getByRole("button", { name: "Retry" })).toBeTruthy()
    }
    for (const name of ["traffic", "keywords", "value"]) expect(within(kpi(name)).queryByRole("alert")).toBeNull()
    expect(screen.getByText("asg hospital")).toBeTruthy()
  })

  test("a failing competitors or keywords call fails inside its own card", async () => {
    answer({ competitors: apiError("The data service could not process this domain.", { code: "PROVIDER_REQUEST_REJECTED" }), "ranked-keywords": apiError("The data service returned an unexpected response. Please try again.", { code: "PROVIDER_MALFORMED_RESPONSE" }) })
    renderPage()
    await screen.findByText("100.4K")
    const topKeywords = screen.getByRole("heading", { name: "Top keywords" }).closest("section")
    const competitorsCard = screen.getByRole("heading", { name: "Top competitors" }).closest("section")
    expect(within(topKeywords).getByRole("alert").textContent).toMatch(/unexpected response/)
    expect(within(competitorsCard).getByRole("alert").textContent).toMatch(/could not process/)
    expect(screen.getByTestId("do-kpis")).toBeTruthy()
  })

  test("an offline request gets a plain connectivity message", async () => {
    answer({ history: new Error("Failed to fetch") })
    renderPage()
    expect((await screen.findByRole("alert")).textContent).toMatch(/Couldn't reach Odito/)
  })

  test("a project without a public domain gets one message, not five errors", async () => {
    const e = apiError("The project's website does not have a public domain name", { status: 422, code: "INVALID_TARGET" })
    answer(Object.fromEntries(SECTIONS.map((s) => [s, e])))
    renderPage()
    expect(await screen.findByText(/does not have a public domain name, so its overview cannot be loaded/)).toBeTruthy()
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull() // retrying cannot fix the URL
    expect(screen.queryByTestId("do-kpis")).toBeNull()
  })
})

describe("Domain Overview: empty states", () => {
  test("a domain with no ranking data gets friendly messages, not broken charts", async () => {
    answer({
      "rank-overview": envelope("rank-overview", { organic: null, paid: null }),
      "history": history([]),
      "ranked-keywords": envelope("ranked-keywords", { totalCount: null, items: [] }),
      "competitors": envelope("competitors", { items: [] }),
    })
    renderPage()
    expect(await screen.findAllByText("No ranking data yet for this domain.")).toHaveLength(1) // the positions card
    expect(screen.getByText("No traffic history yet for this domain.")).toBeTruthy()
    expect(screen.getByText("No ranking keywords yet for this domain.")).toBeTruthy()
    expect(screen.getByText("No competing domains found yet.")).toBeTruthy()
    expect(screen.getByText(/No keyword movement yet/)).toBeTruthy()
    for (const name of ["traffic", "keywords", "value"]) {
      expect(within(kpi(name)).getByText("—")).toBeTruthy()
      expect(within(kpi(name)).getByText("No ranking data yet")).toBeTruthy()
    }
    expect(screen.queryByTestId("do-trend-chart")).toBeNull()
    expect(screen.queryByTestId("do-positions-chart")).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

describe("Domain Overview: refresh", () => {
  test("Refresh asks every section to skip the server cache, once each, and shows its busy state", async () => {
    renderPage()
    await screen.findByText("100.4K")
    const before = calls().length
    let release
    svc.getSection.mockImplementation((_pid, section) => new Promise((resolve) => { release = release || []; release.push(() => resolve({ success: true, data: fixtures()[section] })) }))
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await screen.findByRole("button", { name: "Refreshing…" })
    expect(screen.getByRole("button", { name: "Refreshing…" }).disabled).toBe(true)
    expect(screen.getByText("100.4K")).toBeTruthy() // the old data stays while it refreshes
    const refreshCalls = calls().slice(before)
    expect(refreshCalls.map((c) => c.section).sort()).toEqual([...SECTIONS].sort())
    expect(refreshCalls.every((c) => c.refresh === true)).toBe(true)
    await act(async () => { release.forEach((r) => r()) })
    await screen.findByRole("button", { name: "Refresh" })
  })

  test("a refresh the server declined to repeat says so", async () => {
    renderPage()
    await screen.findByText("100.4K")
    answer(Object.fromEntries(SECTIONS.map((s) => [s, { ...fixtures()[s], refreshThrottled: true, cached: true }])))
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(await screen.findByText(/refreshed less than a minute ago/)).toBeTruthy()
  })

  test("after a refresh the header shows the new fetch time", async () => {
    renderPage()
    await screen.findByText("100.4K")
    answer(Object.fromEntries(SECTIONS.map((s) => [s, { ...fixtures()[s], fetchedAt: "2026-10-27T09:15:00.000Z" }])))
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(screen.getByTestId("do-updated").getAttribute("title")).toMatch(/Traffic & keywords/))
    await waitFor(() => expect(screen.getByTestId("do-updated").textContent).not.toBe("Last updated Oct 27, 2026, 11:12 AM"))
  })
})

describe("Domain Overview: responsive layout", () => {
  test("the KPI grid is 2 columns by default, 3 at medium and 6 at wide; paired cards stack until wide", async () => {
    renderPage()
    await screen.findByText("100.4K")
    const kpiClass = screen.getByTestId("do-kpis").className
    expect(kpiClass).toMatch(/\bgrid-cols-2\b/)
    expect(kpiClass).toMatch(/@min-\[640px\]\/main:grid-cols-3/)
    expect(kpiClass).toMatch(/@min-\[1100px\]\/main:grid-cols-6/)
    const pair = screen.getByTestId("do-trend-chart").closest(".grid")
    expect(pair.className).toMatch(/\bgrid-cols-1\b/)
    expect(pair.className).toMatch(/@min-\[900px\]\/main:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\]/)
  })
})

describe("ComingSoon placeholder", () => {
  test("names the page and links back to the overview", () => {
    render(createElement(ComingSoon, { title: "Organic Keywords", description: "Every keyword." }))
    expect(screen.getByRole("heading", { name: "Organic Keywords" })).toBeTruthy()
    expect(screen.getByTestId("coming-soon").textContent).toMatch(/coming soon/)
    expect(screen.getByRole("link", { name: /Back to Domain Overview/ }).getAttribute("href")).toBe("/app/domain-overview")
  })
})
