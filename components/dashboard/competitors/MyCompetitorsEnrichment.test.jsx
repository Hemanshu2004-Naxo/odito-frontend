import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hook, query cache, polling and components run.
const svc = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), refresh: vi.fn() }))
vi.mock("@/services/myCompetitorsService", () => ({ default: svc, myCompetitorsService: svc }))
// Relevance is covered by CompetitorRelevance.test.jsx; here it is inert (nothing assessed, nothing requested).
const assessSvc = vi.hoisted(() => ({ list: vi.fn(async () => ({ success: true, data: { assessments: [] } })), request: vi.fn(async () => ({ success: true, data: { assessments: [] } })), override: vi.fn(), clearOverride: vi.fn() }))
vi.mock("@/services/competitorAssessmentsService", () => ({ default: assessSvc, competitorAssessmentsService: assessSvc }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "p1", main_url: "https://own.com" } }) }))
// The production poll is 5 s; here the real decision logic is kept but the waits are short enough to observe.
vi.mock("./enrichmentUi", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, pollInterval: (list, now) => (actual.pollInterval(list, now) ? 40 : false) }
})

import MyCompetitorsTab from "./MyCompetitorsTab"

const ok = (data) => ({ success: true, data })
const apiError = (message, code, status = 409) => Object.assign(new Error(message), { status, code })
const NOW = () => new Date().toISOString()

const metrics = (over = {}) => ({ organicTraffic: 12500, rankingKeywords: 3400, pos1: 21, top3: 80, top10: 310, positions: { pos_1: 21, pos_2_3: 59, pos_4_10: 230, pos_11_20: 400 }, backlinks: 8200, referringDomains: 640, dataforseoRank: 412, sharedKeywords: 45, sharedStored: 2, sharedTruncated: true, ...over })
const enrichment = (status, over = {}) => ({
  status, requestedAt: NOW(), finishedAt: NOW(), lastSuccessAt: status === "enriched" || status === "partial" ? NOW() : null, attempts: 1, nextAttemptAt: null, errorCode: null, stale: false,
  market: { location: "India", language: "English" },
  sections: { rank: { status: "ok", fetchedAt: NOW(), errorCode: null }, backlinks: { status: "ok", fetchedAt: NOW(), errorCode: null }, shared: { status: "ok", fetchedAt: NOW(), errorCode: null } },
  metrics: metrics(), ...over,
})
const emptyMetrics = () => Object.fromEntries(Object.keys(metrics()).map((k) => [k, null]))
const comp = (over = {}) => ({
  id: "c1", name: "ASG Eye Hospital", domain: "asgeyehospital.com", address: "Gangapur Rd, Nashik", placeId: null, source: "manual", notes: null,
  aliases: [], provenance: [{ kind: "manual", at: NOW() }], branches: [], enrichment: enrichment("enriched"), createdAt: NOW(), updatedAt: NOW(), ...over,
})

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MyCompetitorsTab /></QueryClientProvider>)
}
const table = async () => within(await screen.findByTestId("mc-table"))

beforeEach(() => { Object.values(svc).forEach((f) => f.mockReset()) })

describe("My competitors: SEO metrics", () => {
  test("an enriched competitor shows its real numbers, the status and when it was updated", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp()], limit: 100 }))
    renderTab()
    const t = await table()
    expect(t.getByText("12.5K")).toBeTruthy() // organic traffic
    expect(t.getByText("3.4K")).toBeTruthy() // ranking keywords
    expect(t.getByText("21")).toBeTruthy() // #1 rankings
    expect(t.getByText("640")).toBeTruthy() // referring domains
    expect(t.getByTestId("mc-status").dataset.status).toBe("enriched")
    expect(t.getByTestId("mc-updated")).toBeTruthy()
  })

  const sharedCell = async () => within((await table()).getByTestId("mc-shared"))
  const sharedState = (status, over = {}) => comp({ enrichment: enrichment(status === "ok" ? "enriched" : "partial", { metrics: metrics({ sharedKeywords: null, sharedStored: null, sharedTruncated: null }), sections: { rank: { status: "ok", fetchedAt: NOW(), errorCode: null }, backlinks: { status: "ok", fetchedAt: NOW(), errorCode: null }, shared: { status, fetchedAt: NOW(), errorCode: null } }, ...over }) })

  test("the shared-keyword count is the real number from the comparison, not the competitor's total ranking keywords", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp()], limit: 100 }))
    renderTab()
    const cell = await sharedCell()
    expect(cell.getByText("45")).toBeTruthy()
    const t = await table()
    expect(t.getByText("3.4K")).toBeTruthy() // ranking keywords stay a different number
    expect(cell.getByRole("button").getAttribute("aria-label")).toMatch(/45 shared keywords/)
  })

  test("no provider data for the comparison: a dash that says so, a Partial status that names it - never 0, never Up to date", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [sharedState("no_data")], limit: 100 }))
    renderTab()
    const cell = await sharedCell()
    const m = cell.getByTestId("mc-metric")
    expect(m.dataset.missing).toBe("true")
    expect(m.getAttribute("title")).toMatch(/no shared-keyword data/i)
    expect(cell.queryByText("0")).toBeNull()
    const chip = (await table()).getByTestId("mc-status")
    expect(chip.dataset.status).toBe("partial")
    expect(chip.textContent).not.toMatch(/Up to date/)
    expect(chip.getAttribute("title")).toMatch(/Shared keywords \(no data from the provider\)/)
  })

  test("a failed comparison says it could not be loaded", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [sharedState("failed")], limit: 100 }))
    renderTab()
    expect((await sharedCell()).getByTestId("mc-metric").getAttribute("title")).toMatch(/Could not be loaded/)
  })

  test("an older record without the comparison is Partial and says it is not fetched yet (never Up to date)", async () => {
    const old = comp({ enrichment: enrichment("partial", { metrics: metrics({ sharedKeywords: null, sharedStored: null, sharedTruncated: null }), sections: { rank: { status: "ok", fetchedAt: NOW(), errorCode: null }, backlinks: { status: "ok", fetchedAt: NOW(), errorCode: null }, shared: { status: "not_configured", fetchedAt: null, errorCode: "HEAD_TO_HEAD_ENDPOINT_NOT_CONFIGURED" } } }) })
    svc.list.mockResolvedValue(ok({ competitors: [old], limit: 100 }))
    renderTab()
    expect((await sharedCell()).getByTestId("mc-metric").getAttribute("title")).toMatch(/Not fetched yet/)
    expect((await table()).getByTestId("mc-status").dataset.status).toBe("partial")
  })

  test("while the competitor is queued the shared count says it is being fetched", async () => {
    const queued = comp({ enrichment: enrichment("pending", { metrics: emptyMetrics(), sections: { rank: null, backlinks: null, shared: null }, requestedAt: NOW(), nextAttemptAt: new Date(Date.now() + 3600e3).toISOString() }) })
    svc.list.mockResolvedValue(ok({ competitors: [queued], limit: 100 }))
    renderTab()
    expect((await sharedCell()).getByTestId("mc-metric").getAttribute("title")).toMatch(/Being fetched/)
  })

  test("a real zero (the provider knows the competitor and nothing is shared) is shown as 0", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp({ enrichment: enrichment("enriched", { metrics: metrics({ sharedKeywords: 0, sharedStored: 0, sharedTruncated: false }) }) })], limit: 100 }))
    renderTab()
    const m = (await sharedCell()).getByTestId("mc-metric")
    expect(m.textContent).toBe("0")
    expect(m.dataset.missing).toBeUndefined()
  })

  test("opening the shared keywords reads the SAVED list (one GET, no provider call) and shows both positions", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp()], limit: 100 }))
    svc.get.mockResolvedValue(ok({ competitor: { ...comp(), sharedKeywordList: { total: 45, shown: 2, truncated: true, fetchedAt: NOW(), market: { location: "India", language: "English" }, keywords: [
      { keyword: "eye doctor mumbai", searchVolume: 3600, cpc: 0.64, project: { position: 25, url: null, traffic: 0.1 }, competitor: { position: 9, url: null, traffic: 0.3 } },
      { keyword: "anterior staphyloma", searchVolume: 2400, cpc: null, project: { position: 41, url: null, traffic: 1.4 }, competitor: null },
    ] } } }))
    renderTab()
    fireEvent.click((await sharedCell()).getByRole("button"))
    const sheet = within(await screen.findByTestId("mc-details-sheet"))
    const list = within(await sheet.findByTestId("mc-shared-list"))
    expect(svc.get).toHaveBeenCalledTimes(1)
    expect(svc.get.mock.calls[0].slice(0, 2)).toEqual(["p1", "c1"])
    expect(svc.refresh).not.toHaveBeenCalled()
    const rows = list.getAllByTestId("mc-shared-row")
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText("eye doctor mumbai")).toBeTruthy()
    expect(rows[0].textContent).toMatch(/3,600|3600/)
    expect(rows[0].textContent).toMatch(/25/)
    expect(rows[0].textContent).toMatch(/9/)
    expect(list.getByText(/45 keywords you both rank for/)).toBeTruthy()
    expect(list.getByText(/The 2 with the most searches are listed/)).toBeTruthy()
    expect(sheet.getByTestId("mc-section-shared").textContent).toMatch(/Loaded/)
  })

  test("a comparison without values shows the reason in the details instead of an empty list, and makes no request", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [sharedState("no_data")], limit: 100 }))
    renderTab()
    fireEvent.click((await table()).getByTestId("mc-details"))
    const sheet = within(await screen.findByTestId("mc-details-sheet"))
    expect(sheet.getByTestId("mc-shared-reason").textContent).toMatch(/no shared-keyword data/i)
    expect(sheet.queryByTestId("mc-shared-list")).toBeNull()
    expect(sheet.getByTestId("mc-section-shared").textContent).toMatch(/No data from the provider/)
    expect(svc.get).not.toHaveBeenCalled()
  })

  test("a real zero in the details says nothing is shared", async () => {
    const c0 = comp({ enrichment: enrichment("enriched", { metrics: metrics({ sharedKeywords: 0, sharedStored: 0, sharedTruncated: false }) }) })
    svc.list.mockResolvedValue(ok({ competitors: [c0], limit: 100 }))
    svc.get.mockResolvedValue(ok({ competitor: { ...c0, sharedKeywordList: { total: 0, shown: 0, truncated: false, fetchedAt: NOW(), market: { location: "India", language: "English" }, keywords: [] } } }))
    renderTab()
    fireEvent.click((await table()).getByTestId("mc-details"))
    expect((await screen.findByTestId("mc-shared-zero")).textContent).toMatch(/No keywords found where you and this competitor both rank/)
  })

  test("a metric the server could not give is a dash with its REASON, never a zero", async () => {
    const e = enrichment("partial", {
      metrics: { ...emptyMetrics(), backlinks: 5, referringDomains: 2, dataforseoRank: 9 },
      sections: { rank: { status: "no_data", fetchedAt: NOW(), errorCode: null }, backlinks: { status: "ok", fetchedAt: NOW(), errorCode: null }, shared: null },
    })
    svc.list.mockResolvedValue(ok({ competitors: [comp({ enrichment: e })], limit: 100 }))
    renderTab()
    const t = await table()
    const row = within(t.getByTestId("mc-row"))
    const traffic = row.getAllByTestId("mc-metric").find((m) => /no data/i.test(m.getAttribute("title") ?? ""))
    expect(traffic).toBeTruthy()
    expect(traffic.textContent).not.toMatch(/^\s*0\s*$/)
    expect(row.queryByText(/^0$/)).toBeNull()
    expect(t.getByTestId("mc-status").dataset.status).toBe("partial")
  })

  test("a REAL zero is shown as 0 (it is a value, not a missing one)", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp({ enrichment: enrichment("enriched", { metrics: metrics({ pos1: 0 }) }) })], limit: 100 }))
    renderTab()
    const t = await table()
    expect(t.getByText("0")).toBeTruthy()
  })

  test("a name-only competitor is saved and says SEO data is unavailable until a website is added; its refresh is disabled", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp({ domain: null, enrichment: enrichment("no_website", { metrics: emptyMetrics(), sections: { rank: null, backlinks: null, shared: null } }) })], limit: 100 }))
    renderTab()
    const t = await table()
    expect(t.getAllByText("No website").length).toBeGreaterThanOrEqual(2) // under the name, and in the status chip
    expect(t.getByTestId("mc-status").dataset.status).toBe("no_website")
    expect(t.getByTestId("mc-refresh").disabled).toBe(true)
    fireEvent.click(t.getByTestId("mc-details"))
    const sheet = within(await screen.findByTestId("mc-details-sheet"))
    expect(sheet.getAllByText(/Add a website to this competitor to get its SEO metrics/i).length).toBeGreaterThan(0)
    expect(sheet.queryByTestId("mc-d-refresh")).toBeNull() // nothing to refresh without a website
  })

  test("a phone gets cards with the key numbers and the same actions", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp()], limit: 100 }))
    renderTab()
    const card = within(await screen.findByTestId("mc-card"))
    expect(card.getByText("12.5K")).toBeTruthy()
    expect(card.getByTestId("mc-status").dataset.status).toBe("enriched")
    expect(card.getByTestId("mc-details")).toBeTruthy()
  })
})

describe("My competitors: watching queued work", () => {
  test("while a competitor is queued the list re-reads itself until it is done, and then stops", async () => {
    svc.list
      .mockResolvedValueOnce(ok({ competitors: [comp({ enrichment: enrichment("pending", { metrics: emptyMetrics(), requestedAt: NOW(), nextAttemptAt: NOW(), sections: { rank: null, backlinks: null, shared: null }, attempts: 0 }) })], limit: 100 }))
      .mockResolvedValueOnce(ok({ competitors: [comp({ enrichment: enrichment("processing", { metrics: emptyMetrics() }) })], limit: 100 }))
      .mockResolvedValue(ok({ competitors: [comp()], limit: 100 }))
    renderTab()
    const t = await table()
    expect(t.getByTestId("mc-status").dataset.status).toBe("pending")
    await waitFor(() => expect(within(screen.getByTestId("mc-table")).getByTestId("mc-status").dataset.status).toBe("enriched"), { timeout: 4000 })
    expect(within(screen.getByTestId("mc-table")).getByText("12.5K")).toBeTruthy()
    const callsWhenDone = svc.list.mock.calls.length
    await new Promise((r) => setTimeout(r, 300))
    expect(svc.list.mock.calls.length).toBe(callsWhenDone) // nothing is waiting any more: no further requests
  })

  test("an already finished list is read once and never polled", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp(), comp({ id: "c2", name: "Other", domain: "other.com", enrichment: enrichment("failed", { metrics: emptyMetrics() }) })], limit: 100 }))
    renderTab()
    await table()
    await new Promise((r) => setTimeout(r, 300))
    expect(svc.list).toHaveBeenCalledTimes(1)
  })
})

describe("My competitors: details and refresh", () => {
  test("opening the details re-reads nothing but the saved competitor (no refresh, no provider) and shows the whole picture", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp({ placeId: "ChIJ_1", branches: [{ placeId: "ChIJ_1", address: "Gangapur Rd, Nashik", lat: null, lng: null }, { placeId: "ChIJ_2", address: "College Rd, Nashik", lat: null, lng: null }], provenance: [{ kind: "local", at: NOW() }, { kind: "seo", at: NOW() }] })], limit: 100 }))
    renderTab()
    const t = await table()
    const before = svc.list.mock.calls.length
    fireEvent.click(t.getByTestId("mc-details"))
    const sheet = within(await screen.findByTestId("mc-details-sheet"))
    expect(sheet.getByTestId("mc-d-seo")).toBeTruthy()
    expect(sheet.getByTestId("mc-positions")).toBeTruthy()
    expect(sheet.getByText("DataForSEO rank")).toBeTruthy()
    expect(within(sheet.getByTestId("mc-d-business")).getByText(/From Local, From SEO/)).toBeTruthy()
    expect(sheet.getByText("College Rd, Nashik")).toBeTruthy()
    expect(sheet.getByTestId("mc-maps-link").getAttribute("href")).toMatch(/query_place_id=ChIJ_1/)
    expect(sheet.getByTestId("mc-section-rank").textContent).toMatch(/Loaded/)
    expect(within(sheet.getByTestId("mc-d-local")).getByText(/not saved here/i)).toBeTruthy()
    expect(sheet.queryByText(/Domain Authority|Domain Rating/i, { selector: "dt, dd, h3" })).toBeNull()
    expect(svc.list.mock.calls.length).toBe(before)
    // The saved shared-keyword list is the ONE read (a GET of what is stored); nothing refreshes and no provider is involved.
    await waitFor(() => expect(svc.get).toHaveBeenCalledTimes(1))
    expect(svc.refresh).not.toHaveBeenCalled()
  })

  test("Refresh queues the update: the row turns queued, and the finished numbers arrive by polling", async () => {
    svc.list
      .mockResolvedValueOnce(ok({ competitors: [comp({ enrichment: enrichment("enriched", { finishedAt: new Date(Date.now() - 3 * 864e5).toISOString() }) })], limit: 100 }))
      .mockResolvedValue(ok({ competitors: [comp()], limit: 100 }))
    svc.refresh.mockResolvedValue(ok({ competitor: comp({ enrichment: enrichment("pending", { attempts: 0, requestedAt: NOW(), nextAttemptAt: NOW() }) }) }))
    renderTab()
    const t = await table()
    fireEvent.click(t.getByTestId("mc-refresh"))
    await waitFor(() => expect(svc.refresh).toHaveBeenCalledWith("p1", "c1"))
    await waitFor(() => expect(within(screen.getByTestId("mc-table")).getByTestId("mc-status").dataset.status).toMatch(/pending|enriched/))
    expect(await screen.findByText(/Fetching SEO metrics for ASG Eye Hospital/)).toBeTruthy()
    expect(svc.create).not.toHaveBeenCalled()
  })

  test("a refresh inside the cool-down is explained and changes nothing", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp()], limit: 100 }))
    svc.refresh.mockRejectedValue(apiError("This competitor was updated recently. Please try again later.", "REFRESH_COOLDOWN", 429))
    renderTab()
    const t = await table()
    fireEvent.click(t.getByTestId("mc-refresh"))
    expect(await screen.findByText(/was updated recently/i)).toBeTruthy()
    expect(within(screen.getByTestId("mc-table")).getByTestId("mc-status").dataset.status).toBe("enriched")
  })

  test("a record saved before enrichment existed offers to fetch its metrics (nothing is fetched by itself)", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp({ enrichment: { ...enrichment("enriched"), status: "not_started", lastSuccessAt: null, metrics: emptyMetrics(), sections: { rank: null, backlinks: null, shared: null } } })], limit: 100 }))
    renderTab()
    const t = await table()
    expect(t.getByTestId("mc-status").dataset.status).toBe("not_started")
    fireEvent.click(t.getByTestId("mc-details"))
    expect(await screen.findByTestId("mc-d-refresh")).toBeTruthy()
    expect(screen.getByTestId("mc-d-refresh").textContent).toMatch(/Get SEO metrics/)
    expect(svc.refresh).not.toHaveBeenCalled()
  })

  test("a failed competitor shows which section failed and offers Try again", async () => {
    const e = enrichment("failed", { metrics: emptyMetrics(), sections: { rank: { status: "failed", fetchedAt: null, errorCode: "PROVIDER_TIMEOUT" }, backlinks: { status: "failed", fetchedAt: null, errorCode: "PROVIDER_TIMEOUT" }, shared: null } })
    svc.list.mockResolvedValue(ok({ competitors: [comp({ enrichment: e })], limit: 100 }))
    renderTab()
    fireEvent.click((await table()).getByTestId("mc-details"))
    const sheet = within(await screen.findByTestId("mc-details-sheet"))
    expect(sheet.getByTestId("mc-section-rank").textContent).toMatch(/Failed \(PROVIDER_TIMEOUT\)/)
    expect(sheet.getByTestId("mc-d-refresh").textContent).toMatch(/Try again/)
  })
})
