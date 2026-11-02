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
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "p1", main_url: "https://krishnaeyecentre.com" } }) }))
// The discovery list is its own (separately tested) page; here it only has to appear.
vi.mock("./CompetitorsDashboard", () => ({ default: () => <div data-testid="discover-list">discovery list</div> }))
vi.mock("./LocalCompetitorsTab", () => ({ default: () => <div /> }))
vi.mock("./MyCompetitorsTab", () => ({ default: () => <div data-testid="mine-tab" /> }))

import CompetitorsTabs from "./CompetitorsTabs"

const ok = (data) => ({ success: true, data })
const NOW = () => new Date().toISOString()
const enrichment = (metrics, over = {}) => ({
  status: "enriched", requestedAt: NOW(), finishedAt: NOW(), lastSuccessAt: NOW(), attempts: 1, nextAttemptAt: null, errorCode: null, stale: false, market: { location: "India", language: "English" },
  sections: { rank: { status: "ok" }, backlinks: { status: "ok" }, shared: { status: "ok" } },
  metrics: { organicTraffic: null, rankingKeywords: null, pos1: null, referringDomains: null, sharedKeywords: null, ...metrics }, ...over,
})
const comp = (id, name, domain, metrics, over = {}) => ({ id, name, domain, address: null, placeId: null, source: "manual", notes: null, aliases: [], provenance: [], branches: [], enrichment: enrichment(metrics), createdAt: NOW(), updatedAt: NOW(), ...over })

const YOU = { organicTraffic: 4200, rankingKeywords: 900, pos1: 12, referringDomains: 300 }
const answerOwn = (you = YOU) => overview.getSection.mockImplementation(async (_p, section) => {
  if (section === "rank-overview") return ok({ result: { organic: you.organicTraffic === null ? null : { etv: you.organicTraffic, count: you.rankingKeywords, pos_1: you.pos1 } } })
  if (section === "backlinks") return ok({ result: { referring_domains: you.referringDomains } })
  throw new Error(`unexpected section ${section}`)
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><CompetitorsTabs /></QueryClientProvider>)
}
const rowOf = async (name) => (await screen.findAllByTestId("yc-row")).find((r) => r.textContent.includes(name))

beforeEach(() => { cleanup(); [mine, overview].forEach((m) => Object.values(m).forEach((f) => f.mockReset())) })

describe("SEO competitors tab: only the competitors you added, compared with you", () => {
  test("it opens on YOUR competitors, not on the discovery list, and shows only the added ones", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [
      comp("a", "ASG Eye Hospital", "asgeyehospital.com", { organicTraffic: 89500, rankingKeywords: 3600, pos1: 1, referringDomains: 1292, sharedKeywords: 45 }),
      comp("b", "K. B. Haji Bachooali Hospital", "kbhbhospital.com", { organicTraffic: 109, rankingKeywords: 3, pos1: 0, referringDomains: 3, sharedKeywords: 1 }),
    ] }))
    renderPage()
    expect(await screen.findByTestId("yc-root")).toBeInTheDocument()
    expect(screen.queryByTestId("discover-list")).toBeNull()
    expect(screen.getAllByTestId("yc-row")).toHaveLength(2)
    expect(screen.getByTestId("yc-summary").textContent).toMatch(/2 competitors you added.*1 ahead of you.*1 behind you/)
  })

  test("a competitor that leads is marked ahead (red up arrow) and one that trails is marked behind (green down arrow), with the metrics", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [
      comp("b", "Small Clinic", "kbhbhospital.com", { organicTraffic: 109, rankingKeywords: 3, pos1: 0, referringDomains: 3 }),
      comp("a", "Big Hospital", "asgeyehospital.com", { organicTraffic: 89500, rankingKeywords: 3600, pos1: 1, referringDomains: 1292 }),
    ] }))
    renderPage()
    const big = within(await rowOf("Big Hospital"))
    expect(big.getByTestId("yc-verdict").dataset.verdict).toBe("ahead")
    expect(big.getByTestId("yc-verdict").textContent).toMatch(/Ahead of you/)
    expect(big.getByTestId("yc-verdict").textContent).toMatch(/They lead on 3 of 4/)
    expect(big.getByTestId("yc-verdict").textContent).toMatch(/21x your traffic/)
    const arrows = big.getAllByTestId("yc-arrow")
    expect(arrows.map((a) => [a.dataset.metric, a.dataset.lead])).toEqual([["organicTraffic", "them"], ["rankingKeywords", "them"], ["pos1", "you"], ["referringDomains", "them"]])
    expect(arrows[0].getAttribute("title")).toMatch(/Organic traffic: they are ahead by 21x \(89,500 for them, 4,200 for you\)/)
    const small = within(await rowOf("Small Clinic"))
    expect(small.getByTestId("yc-verdict").dataset.verdict).toBe("behind")
    expect(small.getByTestId("yc-verdict").textContent).toMatch(/Behind you/)
    expect(small.getByTestId("yc-verdict").textContent).toMatch(/you have 39x their traffic/)
  })

  test("the competitor furthest ahead of you is listed first; a row for YOU gives the numbers to compare with", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [
      comp("b", "Small Clinic", "kbhbhospital.com", { organicTraffic: 109, rankingKeywords: 3, pos1: 0, referringDomains: 3 }),
      comp("a", "Big Hospital", "asgeyehospital.com", { organicTraffic: 89500, rankingKeywords: 3600, pos1: 1, referringDomains: 1292 }),
    ] }))
    renderPage()
    await screen.findByTestId("yc-root")
    await waitFor(() => expect(within(screen.getByTestId("yc-you")).getByText("4.2K")).toBeInTheDocument())
    expect(screen.getAllByTestId("yc-row").map((r) => r.dataset.id)).toEqual(["a", "b"])
    expect(within(screen.getByTestId("yc-you")).getByText("900")).toBeInTheDocument()
  })

  test("a number that is not known is a dash and is never compared (not a zero)", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [comp("a", "Half Known", "asgeyehospital.com", { organicTraffic: 50000, rankingKeywords: null, pos1: null, referringDomains: null })] }))
    renderPage()
    const row = within(await rowOf("Half Known"))
    expect(row.getAllByTestId("yc-arrow").map((a) => a.dataset.lead)).toEqual(["them", "unknown", "unknown", "unknown"])
    expect(row.getByTestId("yc-rankingKeywords").querySelector("[data-missing]")).not.toBeNull()
    expect(row.getByTestId("yc-verdict").textContent).toMatch(/They lead on 1 of 1/)
  })

  test("when YOUR own numbers are not known nothing is called ahead or behind", async () => {
    answerOwn({ organicTraffic: null, rankingKeywords: null, pos1: null, referringDomains: null })
    overview.getSection.mockImplementation(async (_p, section) => (section === "rank-overview" ? ok({ result: { organic: null } }) : ok({ result: null })))
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [comp("a", "Big Hospital", "asgeyehospital.com", { organicTraffic: 89500, rankingKeywords: 3600, pos1: 1, referringDomains: 1292 })] }))
    renderPage()
    const row = within(await rowOf("Big Hospital"))
    await waitFor(() => expect(row.getByTestId("yc-verdict").dataset.verdict).toBe("unknown"))
    expect(row.getByTestId("yc-verdict").textContent).toMatch(/Not comparable yet/)
  })

  test("it asks for NOTHING that costs money: no refresh flag, no provider-only sections, no competitor re-fetch", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [comp("a", "Big Hospital", "asgeyehospital.com", { organicTraffic: 89500, rankingKeywords: 3600, pos1: 1, referringDomains: 1292 })] }))
    renderPage()
    await screen.findByTestId("yc-root")
    await waitFor(() => expect(overview.getSection).toHaveBeenCalledTimes(2))
    expect(overview.getSection.mock.calls.map((c) => c[1]).sort()).toEqual(["backlinks", "rank-overview"])
    for (const call of overview.getSection.mock.calls) expect(call[2]?.refresh).toBeFalsy()
    expect(mine.refresh).not.toHaveBeenCalled()
  })

  test("with no added competitors it explains and offers to find some", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [] }))
    renderPage()
    expect(await screen.findByTestId("yc-empty")).toHaveTextContent(/not added any competitors/)
    fireEvent.click(screen.getByTestId("yc-find"))
    expect(await screen.findByTestId("discover-list")).toBeInTheDocument()
  })

  test("Find more competitors opens the full discovery list (so Add is still reachable) and Back returns", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [comp("a", "Big Hospital", "asgeyehospital.com", { organicTraffic: 89500 })] }))
    renderPage()
    fireEvent.click(await screen.findByTestId("yc-find"))
    expect(await screen.findByTestId("discover-list")).toBeInTheDocument()
    expect(screen.queryByTestId("yc-root")).toBeNull()
    fireEvent.click(screen.getByTestId("yc-back"))
    expect(await screen.findByTestId("yc-root")).toBeInTheDocument()
  })

  test("a competitor without a website is listed below the table with the reason, never compared", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [comp("a", "Big Hospital", "asgeyehospital.com", { organicTraffic: 89500 }), comp("n", "Corner Clinic", null, {}, { enrichment: { ...enrichment({}), status: "no_website", sections: {} } })] }))
    renderPage()
    await screen.findByTestId("yc-root")
    expect(screen.getAllByTestId("yc-row")).toHaveLength(1)
    expect(screen.getByTestId("yc-nosite").textContent).toMatch(/Corner Clinic/)
  })

  test("a load failure is shown with a retry", async () => {
    answerOwn()
    mine.list.mockRejectedValueOnce(Object.assign(new Error("down"), { status: 500 })).mockResolvedValueOnce(ok({ limit: 100, competitors: [] }))
    renderPage()
    const err = await screen.findByTestId("yc-error")
    fireEvent.click(within(err).getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("yc-empty")).toBeInTheDocument()
  })
})
