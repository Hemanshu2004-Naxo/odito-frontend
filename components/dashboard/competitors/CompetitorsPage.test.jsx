import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP edges are mocked; the real hooks, query cache and components run.
const mine = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), refresh: vi.fn(), addDiscovered: vi.fn() }))
vi.mock("@/services/myCompetitorsService", () => ({ default: mine, myCompetitorsService: mine }))
const overview = vi.hoisted(() => ({ getSection: vi.fn() }))
vi.mock("@/services/domainOverviewService", () => ({
  default: overview, domainOverviewService: overview, DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"], DEFAULT_HISTORY_MONTHS: 12,
}))
const settings = vi.hoisted(() => ({ get: vi.fn(), addTracked: vi.fn(), removeTracked: vi.fn(), addExcluded: vi.fn(), removeExcluded: vi.fn() }))
vi.mock("@/services/competitorSettingsService", () => ({ default: settings, competitorSettingsService: settings }))
// Relevance (Manage list) is inert here: nothing assessed, nothing requested.
const assess = vi.hoisted(() => ({ list: vi.fn(async () => ({ success: true, data: { assessments: [] } })), request: vi.fn(async () => ({ success: true, data: { assessments: [] } })), override: vi.fn(), clearOverride: vi.fn() }))
vi.mock("@/services/competitorAssessmentsService", () => ({ default: assess, competitorAssessmentsService: assess }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "p1", name: "Krishna Eye Centre", main_url: "https://krishnaeyecentre.com" } }) }))
// The discovery list, Local and Manage list are their own (separately tested) views; here they only have to appear.
vi.mock("./CompetitorsDashboard", () => ({ default: () => <div data-testid="discover-list">discovery list</div> }))
vi.mock("./LocalCompetitorsTab", () => ({ default: () => <div data-testid="local-tab" /> }))

import CompetitorsTabs from "./CompetitorsTabs"

const ok = (data) => ({ success: true, data })
const NOW = () => new Date("2026-10-20T10:00:00Z").toISOString()
const enrichment = (metrics, over = {}) => ({
  status: "enriched", lastSuccessAt: NOW(), attempts: 1, stale: false,
  sections: { rank: { status: "ok" }, backlinks: { status: "ok" }, shared: { status: "ok" } },
  metrics: { organicTraffic: null, rankingKeywords: null, pos1: null, referringDomains: null, sharedKeywords: null, ...metrics }, ...over,
})
const comp = (id, name, domain, metrics, over = {}) => ({ id, name, domain, address: null, notes: null, enrichment: enrichment(metrics), ...over })

// The reference's own figures (krishnaeyecentre.com and four competitors).
const YOU = { etv: 354, count: 101, pos_1: 1, rd: 195 }
const COMPS = [
  comp("g", "Gleneagles Hospital", "gleneagleshospitals.co.in", { organicTraffic: 60100, rankingKeywords: 5300, pos1: 163, referringDomains: 424 }),
  comp("k", "KEM Hospital", "kem.edu", { organicTraffic: 19600, rankingKeywords: 508, pos1: 35, referringDomains: 1200 }),
  comp("i", "Idealake Information Technologies", "idealake.com", { organicTraffic: 1300, rankingKeywords: 14, pos1: 3, referringDomains: 200 }, { enrichment: enrichment({ organicTraffic: 1300, rankingKeywords: 14, pos1: 3, referringDomains: 200 }, { status: "partial", sections: { rank: { status: "ok" }, backlinks: { status: "ok" }, shared: { status: "no_data" } } }) }),
  comp("h", "K. B. Haji Bachooali Eye & ENT", "kbhbhospital.com", { organicTraffic: 109, rankingKeywords: 3, pos1: 0, referringDomains: 3 }),
]
const shared = (rows) => ok({ competitor: { sharedKeywordList: { total: rows.length, keywords: rows.map(([keyword, you, them, vol = 100]) => ({ keyword, searchVolume: vol, project: { position: you }, competitor: { position: them } })) } } })
const SHARED = {
  g: shared([["eye hospital in dadar", 6, 3], ["lasik eye surgery in mumbai", 15, 1]]),
  k: shared([["eye hospital in dadar", 6, 14], ["lasik eye surgery in mumbai", 15, 31]]),
  h: shared([["eye hospital in dadar", 6, 11], ["krishna eye care", 1, 9, 880]]),
}
const DISCOVERY = [{ domain: "keniaeyehospital.com", intersections: 7, avg_position: 20, total: { count: 300, etv: 2200 }, project_shared: { etv: 1 }, competitor_shared: { etv: 1 } }, { domain: "kem.edu", intersections: 3, avg_position: 30, total: { count: 500, etv: 19600 }, project_shared: { etv: 1 }, competitor_shared: { etv: 1 } }]

function answer({ competitors = COMPS } = {}) {
  overview.getSection.mockImplementation(async (_p, section) => {
    if (section === "rank-overview") return ok({ market: { location: "India", language: "English" }, result: { organic: { etv: YOU.etv, count: YOU.count, pos_1: YOU.pos_1 } } })
    if (section === "backlinks") return ok({ result: { referring_domains: YOU.rd } })
    if (section === "competitors") return ok({ target: "krishnaeyecentre.com", result: { totalCount: 3, items: DISCOVERY } })
    throw new Error(`unexpected section ${section}`)
  })
  settings.get.mockResolvedValue(ok({ tracked: [], excluded: [] }))
  mine.list.mockResolvedValue(ok({ limit: 100, competitors }))
  mine.get.mockImplementation(async (_p, id) => SHARED[id] ?? ok({ competitor: { sharedKeywordList: null } }))
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><CompetitorsTabs /></QueryClientProvider>)
}
const row = (metric) => screen.getAllByTestId("sb-row").find((r) => r.dataset.metric === metric)
const cellsOf = (metric) => within(row(metric)).getAllByTestId("sb-cell")

beforeEach(() => { cleanup(); [mine, overview, settings].forEach((m) => Object.values(m).forEach((f) => f.mockReset())) })

describe("Competitors page: header and stat cards", () => {
  test("tracked, ahead (with names), behind, and the closest traffic gap to beat", async () => {
    answer()
    renderPage()
    await screen.findByTestId("sb-card")
    await waitFor(() => expect(screen.getByTestId("cp-stat-ahead")).toHaveTextContent("3"))
    expect(screen.getByRole("heading", { name: "Competitors" })).toBeInTheDocument()
    expect(screen.getByTestId("cp-stat-tracked")).toHaveTextContent(/4You can track up to 100/)
    expect(screen.getByTestId("cp-stat-ahead")).toHaveTextContent(/Gleneagles, KEM, Idealake/)
    expect(screen.getByTestId("cp-stat-behind")).toHaveTextContent(/1K\. B\. Haji Bachooali/)
    expect(screen.getByTestId("cp-stat-closest")).toHaveTextContent(/\+946More visits a month to pass Idealake/)
  })

  test("Add competitor opens the form and saves through the list", async () => {
    answer()
    mine.create.mockResolvedValue(ok({ competitor: comp("n", "New Clinic", "new.com", {}) }))
    renderPage()
    await screen.findByTestId("sb-card")
    fireEvent.click(screen.getByTestId("cp-add"))
    expect(await screen.findByTestId("mc-dialog")).toBeInTheDocument()
  })
})

describe("Competitors page: side by side", () => {
  test("you first, then the sites furthest ahead; the best in each row is tagged and green", async () => {
    answer()
    renderPage()
    await screen.findByTestId("sb-card")
    await waitFor(() => expect(cellsOf("organicTraffic")[0]).toHaveTextContent("354"))
    expect(screen.getAllByTestId("sb-site").map((s) => s.dataset.site)).toEqual(["you", "g", "k", "i", "h"])
    expect(cellsOf("organicTraffic").map((c) => c.dataset.best)).toEqual(["0", "1", "0", "0", "0"])
    expect(cellsOf("referringDomains").map((c) => c.dataset.best)).toEqual(["0", "0", "1", "0", "0"])
    expect(screen.getByTestId("sb-market")).toHaveTextContent("Google India · Oct 2026")
  })

  test("captions say how each figure compares with yours", async () => {
    answer()
    renderPage()
    await screen.findByTestId("sb-card")
    await waitFor(() => expect(cellsOf("organicTraffic")[0]).toHaveTextContent("354"))
    const caps = (m) => cellsOf(m).map((c) => within(c).getByTestId("sb-caption").textContent)
    expect(caps("organicTraffic")).toEqual(["Your number", "170× yours", "55× yours", "3.7× yours", "3.2× less than you"])
    expect(caps("rankingKeywords")[3]).toBe("7.2× less than you")
    expect(caps("pos1")[4]).toBe("They have 0")
    expect(caps("referringDomains")[3]).toBe("+5 more than you")
  })

  test("who wins: best in N of 4, beats you on M, the data status, and Remove (after confirming)", async () => {
    answer()
    mine.remove.mockResolvedValue(ok({}))
    renderPage()
    await screen.findByTestId("sb-card")
    const wins = (id) => screen.getAllByTestId("sb-wins").find((w) => w.dataset.site === id)
    await waitFor(() => expect(wins("g")).toHaveTextContent("Best in 3 of 4 · beats you on 4"))
    expect(wins("you")).toHaveTextContent("Best in 0 of 4")
    expect(wins("k")).toHaveTextContent("Best in 1 of 4 · beats you on 4")
    expect(within(wins("i")).getByTestId("sb-status")).toHaveTextContent("Partial data")
    fireEvent.click(within(wins("h")).getByTestId("sb-remove"))
    fireEvent.click(await screen.findByTestId("sb-remove-confirm"))
    await waitFor(() => expect(mine.remove).toHaveBeenCalledWith("p1", "h"))
  })

  test("it asks for nothing that costs money: no refresh flag, no competitor re-fetch", async () => {
    answer()
    renderPage()
    await screen.findByTestId("sb-card")
    await waitFor(() => expect(mine.get).toHaveBeenCalledTimes(3)) // the three saved shared-keyword lists, not the "no_data" one
    for (const call of overview.getSection.mock.calls) expect(call[2]?.refresh).toBeFalsy()
    expect(mine.refresh).not.toHaveBeenCalled()
  })
})

describe("Competitors page: head to head", () => {
  test("positions per site from the saved shared keywords; the best is green; '–' when not shared; wins at the bottom", async () => {
    answer()
    renderPage()
    const table = await screen.findByTestId("h2h-table")
    const rows = within(table).getAllByTestId("h2h-row")
    expect(rows.map((r) => r.querySelector("th").textContent)).toEqual(["krishna eye care", "eye hospital in dadar", "lasik eye surgery in mumbai"])
    const dadar = rows[1]
    const cell = (id) => dadar.querySelector(`[data-site="${id}"]`)
    expect(cell("you")).toHaveTextContent("#6")
    expect(cell("g")).toHaveTextContent("#33 above you")
    expect(cell("k")).toHaveTextContent("#148 below you")
    expect(cell("i")).toHaveTextContent("–")
    expect(rows[0].querySelector('[data-site="you"]')).toHaveTextContent("#1Highest")
    expect(within(table).getByTestId("h2h-wins").textContent).toBe("Highest of these sites1 of 32 of 30 of 30 of 30 of 3")
  })
})

describe("Competitors page: suggestions and states", () => {
  test("suggested sites exclude the ones already added; Add saves it as a discovered SEO competitor", async () => {
    answer()
    mine.addDiscovered.mockResolvedValue(ok({ created: true, competitor: comp("n", "keniaeyehospital.com", "keniaeyehospital.com", {}) }))
    renderPage()
    const rows = await screen.findAllByTestId("sg-row")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent("keniaeyehospital.com2.2K traffic a month · 7 shared keywords")
    fireEvent.click(within(rows[0]).getByTestId("sg-add"))
    await waitFor(() => expect(mine.addDiscovered).toHaveBeenCalledWith("p1", { source: "seo", domain: "keniaeyehospital.com", name: "keniaeyehospital.com" }))
  })

  test("'See all sites' opens the discovery list and Back returns", async () => {
    answer()
    renderPage()
    fireEvent.click(await screen.findByTestId("yc-find"))
    expect(await screen.findByTestId("discover-list")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("yc-back"))
    expect(await screen.findByTestId("yc-root")).toBeInTheDocument()
  })

  test("no competitors: an empty state with Add; one without a website is named, never compared", async () => {
    answer({ competitors: [comp("n", "Corner Clinic", null, {}, { enrichment: { ...enrichment({}), status: "no_website", sections: {} } })] })
    renderPage()
    expect(await screen.findByTestId("yc-empty")).toHaveTextContent(/not added any competitors with a website/)
    expect(screen.getByTestId("yc-nosite")).toHaveTextContent(/Corner Clinic/)
    expect(screen.queryByTestId("sb-card")).toBeNull()
  })

  test("a load failure is shown with a retry", async () => {
    answer()
    mine.list.mockReset()
    mine.list.mockRejectedValueOnce(Object.assign(new Error("down"), { status: 500 })).mockResolvedValueOnce(ok({ limit: 100, competitors: [] }))
    renderPage()
    const err = await screen.findByTestId("yc-error")
    fireEvent.click(within(err).getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("yc-empty")).toBeInTheDocument()
  })

  test("the tabs switch to Local competitors and Manage list", async () => {
    answer()
    renderPage()
    await screen.findByTestId("sb-card")
    fireEvent.click(screen.getByTestId("cp-tab-local"))
    expect(screen.getByTestId("local-tab")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("cp-tab-mine"))
    expect(await screen.findByTestId("mc-count")).toBeInTheDocument()
  })
})
