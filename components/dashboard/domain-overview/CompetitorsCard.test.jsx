import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, within, waitFor, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP edges are mocked; the real hooks, query cache and card run.
const mine = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), refresh: vi.fn() }))
vi.mock("@/services/myCompetitorsService", () => ({ default: mine, myCompetitorsService: mine }))
const overview = vi.hoisted(() => ({ getSection: vi.fn() }))
vi.mock("@/services/domainOverviewService", () => ({
  default: overview, domainOverviewService: overview, DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"], DEFAULT_HISTORY_MONTHS: 12,
}))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "p1", main_url: "https://krishnaeyecentre.com" } }) }))

import CompetitorsCard, { COMPETITORS_HREF } from "./CompetitorsCard"

const ok = (data) => ({ success: true, data })
const NOW = () => new Date().toISOString()
const comp = (id, name, domain, metrics) => ({
  id, name, domain, address: null, placeId: null, source: "manual", notes: null, aliases: [], provenance: [], branches: [], createdAt: NOW(), updatedAt: NOW(),
  enrichment: { status: "enriched", requestedAt: NOW(), finishedAt: NOW(), lastSuccessAt: NOW(), attempts: 1, errorCode: null, stale: false, sections: {}, metrics: { organicTraffic: null, rankingKeywords: null, pos1: null, referringDomains: null, sharedKeywords: null, ...metrics } },
})
const YOU = { traffic: 4200, keywords: 900, pos1: 12, links: 300 }
const answerOwn = (you = YOU) => overview.getSection.mockImplementation(async (_p, section) => (section === "rank-overview"
  ? ok({ result: { organic: { etv: you.traffic, count: you.keywords, pos_1: you.pos1 } } }) : ok({ result: { referring_domains: you.links } })))

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><CompetitorsCard /></QueryClientProvider>)
}
beforeEach(() => { cleanup(); [mine, overview].forEach((m) => Object.values(m).forEach((f) => f.mockReset())) })

describe("Domain Overview: Your competitors card", () => {
  test("lists ONLY the competitors you added (never sites that merely rank for the same keywords), each ahead / behind with arrows and numbers", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [
      comp("b", "Small Clinic", "kbhbhospital.com", { organicTraffic: 109, rankingKeywords: 3, pos1: 0, referringDomains: 3, sharedKeywords: 1 }),
      comp("a", "Big Hospital", "asgeyehospital.com", { organicTraffic: 89500, rankingKeywords: 3600, pos1: 150, referringDomains: 1292, sharedKeywords: 45 }),
    ] }))
    renderCard()
    const rows = await screen.findAllByTestId("do-competitor-row")
    expect(rows.map((r) => r.dataset.verdict)).toEqual(["ahead", "behind"]) // furthest ahead first
    expect(within(rows[0]).getByText("Big Hospital")).toBeInTheDocument()
    expect(within(rows[0]).getByTestId("yc-verdict").textContent).toMatch(/Ahead of you/)
    expect(within(rows[1]).getByTestId("yc-verdict").textContent).toMatch(/Behind you/)
    expect(within(rows[0]).getAllByTestId("yc-arrow")).toHaveLength(4)
    expect(within(rows[0]).getByTestId("yc-organicTraffic").textContent).toMatch(/^89\.5K/)
    expect(rows).toHaveLength(2)
    expect(screen.queryByText("nih.gov")).toBeNull()
  })

  test("it never asks for the discovery list or anything that costs money: only your two overview sections and the saved competitors", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [comp("a", "Big Hospital", "asgeyehospital.com", { organicTraffic: 89500 })] }))
    renderCard()
    await screen.findAllByTestId("do-competitor-row")
    await waitFor(() => expect(overview.getSection).toHaveBeenCalledTimes(2))
    expect(overview.getSection.mock.calls.map((c) => c[1]).sort()).toEqual(["backlinks", "rank-overview"])
    for (const c of overview.getSection.mock.calls) expect(c[2]).toEqual({ refresh: false })
    expect(mine.refresh).not.toHaveBeenCalled()
  })

  test("at most 5 are listed; the rest are counted and one click away", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: Array.from({ length: 8 }, (_, i) => comp(`c${i}`, `Rival ${i}`, `rival${i}.com`, { organicTraffic: 1000 * (i + 1), rankingKeywords: 10, pos1: 1, referringDomains: 10 })) }))
    renderCard()
    expect(await screen.findAllByTestId("do-competitor-row")).toHaveLength(5)
    expect(screen.getByTestId("do-competitors-more").textContent).toBe("Showing 5 of 8")
    expect(screen.getByRole("link", { name: /Compare in detail/ }).getAttribute("href")).toBe(COMPETITORS_HREF)
  })

  test("no added competitors: it says so and links to add some (no table, no zeros)", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [] }))
    renderCard()
    expect(await screen.findByTestId("do-competitors-empty")).toHaveTextContent(/not added any competitors/)
    expect(screen.getByTestId("do-competitors-add").getAttribute("href")).toBe("/app/competitors")
    expect(screen.queryByTestId("do-competitors")).toBeNull()
  })

  test("a competitor without a website cannot be compared and is not listed", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [comp("n", "Corner Clinic", null, {})] }))
    renderCard()
    expect(await screen.findByTestId("do-competitors-empty")).toHaveTextContent(/None of your competitors has a website/)
  })

  test("unknown numbers show a dash, not zero", async () => {
    answerOwn()
    mine.list.mockResolvedValue(ok({ limit: 100, competitors: [comp("a", "Half Known", "asgeyehospital.com", { organicTraffic: 50000 })] }))
    renderCard()
    const row = within(await screen.findByTestId("do-competitor-row"))
    expect(row.getByTestId("yc-rankingKeywords").textContent).toMatch(/^—/)
    expect(row.getByTestId("yc-rankingKeywords").querySelector("[data-missing]")).not.toBeNull()
  })

  test("a load failure is shown inside the card with a retry", async () => {
    answerOwn()
    mine.list.mockRejectedValueOnce(Object.assign(new Error("down"), { status: 500 })).mockResolvedValueOnce(ok({ limit: 100, competitors: [] }))
    renderCard()
    const err = await screen.findByTestId("do-competitors-error")
    err.querySelector("button").click()
    expect(await screen.findByTestId("do-competitors-empty")).toBeInTheDocument()
  })
})
