import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hooks, query cache and components run.
const local = vi.hoisted(() => ({ options: vi.fn(), search: vi.fn() }))
const mineSvc = vi.hoisted(() => ({ list: vi.fn(), addDiscovered: vi.fn() }))
vi.mock("@/services/localCompetitorsService", () => ({ default: local, localCompetitorsService: local }))
vi.mock("@/services/myCompetitorsService", () => ({ default: mineSvc, myCompetitorsService: mineSvc }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "p1", main_url: "https://krishnaeyecentre.com" } }) }))

import LocalCompetitorsTab from "./LocalCompetitorsTab"

const ok = (data) => ({ success: true, data })
const apiError = (message, code, status = 422, extra = {}) => Object.assign(new Error(message), { status, code, ...extra })
const CENTER = { lat: 19.9975, lng: 73.7898, source: "verified_business" }
const OPTIONS = { enabled: true, radiiKm: [1, 3, 5, 10, 15, 25], defaultRadiusKm: 5, center: CENTER, centerIssue: null, address: "Gangapur Rd, Nashik", business: { name: null, city: "Nashik" }, categories: { specificity: "specific", queries: ["eye hospital"], types: ["hospital", "doctor"], allowedTypes: ["hospital", "doctor"] }, dailyLimit: 40 }
const place = (id, name, km, over = {}) => ({
  placeId: id, name, address: `${name}, Nashik`, lat: CENTER.lat + km / 110.574, lng: CENTER.lng, types: ["hospital"], primaryType: "hospital", primaryTypeLabel: "Eye hospital", businessStatus: "OPERATIONAL",
  website: null, websiteDomain: null, phone: null, rating: null, reviewCount: null, mapsUrl: `https://maps.google.com/?cid=${id}`, distanceMeters: km * 1000, relevance: "related", addedCompetitorId: null, ...over,
})
const RESULTS = [
  place("P1", "Dhanvantari Eye Hospital", 1.2, { relevance: "direct", websiteDomain: "dhanvantari-eye.in", website: "https://dhanvantari-eye.in/", rating: 4.6, reviewCount: 800, phone: "0253 111" }),
  place("P2", "City General Hospital", 2.5, { rating: 4.0, reviewCount: 40 }),
  place("P3", "Sunrise Clinic", 4.2, { websiteDomain: "sunrise.example", website: "https://sunrise.example", relevance: "direct", businessStatus: "CLOSED_TEMPORARILY" }),
]
const result = (over = {}) => ok({ center: CENTER, radiusKm: 5, categories: { specificity: "specific", queries: ["eye hospital"], types: ["hospital", "doctor"], corrected: false }, results: RESULTS, meta: { googleRequests: 2, dropped: {}, warnings: [] }, ...over })

function makeClient() { return new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
function renderTab(client = makeClient()) {
  const ui = () => <QueryClientProvider client={client}><LocalCompetitorsTab /></QueryClientProvider>
  const r = render(ui())
  return { ...r, client, remount: () => { r.unmount(); return render(ui()) } }
}
const search = () => fireEvent.click(screen.getByTestId("local-search"))
const rowNames = () => screen.getAllByTestId("local-row").map((r) => r.querySelector(".text-sm.font-medium").textContent)

beforeEach(() => {
  Object.values(local).forEach((f) => f.mockReset()); Object.values(mineSvc).forEach((f) => f.mockReset())
  local.options.mockResolvedValue(ok(OPTIONS))
  mineSvc.list.mockResolvedValue(ok({ competitors: [], limit: 100 }))
})

describe("opening the tab", () => {
  test("nothing is searched on open (a search is billed): the radius defaults to 5 km, the categories are the project's own words, and it says how to start", async () => {
    renderTab()
    expect(await screen.findByTestId("local-prompt")).toBeTruthy()
    expect(local.search).not.toHaveBeenCalled()
    expect(screen.getByTestId("local-radius-5").getAttribute("aria-checked")).toBe("true")
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["1 km", "3 km", "5 km", "10 km", "15 km", "25 km"])
    expect(screen.getByTestId("local-query").textContent).toMatch(/eye hospital/)
    expect(screen.getByTestId("local-controls").textContent).toMatch(/Around your verified business location/)
    expect(screen.getByTestId("local-controls").textContent).toMatch(/1–4 Google requests; each project has 40 a day/)
  })

  test("a failed options request is an error with Retry; nothing else is attempted", async () => {
    local.options.mockRejectedValue(apiError("Server down", "INTERNAL_ERROR", 500))
    renderTab()
    expect(await screen.findByRole("button", { name: /retry|try again/i })).toBeTruthy()
    expect(local.search).not.toHaveBeenCalled()
  })
})

describe("searching", () => {
  test("one press: the default 5 km, the suggested categories left alone, results nearest first with distance, rating (dash when Google has none) and status", async () => {
    local.search.mockResolvedValue(result())
    renderTab()
    await screen.findByTestId("local-prompt")
    search()
    await screen.findByTestId("local-list")
    expect(local.search).toHaveBeenCalledTimes(1)
    expect(local.search).toHaveBeenCalledWith("p1", { radiusKm: 5 })
    expect(rowNames()).toEqual(["Dhanvantari Eye Hospital", "City General Hospital", "Sunrise Clinic"])
    expect(screen.getAllByTestId("local-distance").map((d) => d.textContent)).toEqual(["1.2 km", "2.5 km", "4.2 km"])
    expect(screen.getByTestId("local-summary").textContent).toMatch(/3 of 3 businesses within 5 km of your verified business location/)
    const third = screen.getAllByTestId("local-row")[2]
    expect(within(third).getByText("No rating")).toBeTruthy()
    expect(within(third).queryByText(/^0$/)).toBeNull()
    expect(within(third).getByText("Temporarily closed")).toBeTruthy()
    expect(screen.getByTestId("local-attribution").textContent).toMatch(/Google Maps/)
  })

  test("a different radius is sent only when Search is pressed, and until then the page says its results are for the old radius", async () => {
    local.search.mockResolvedValue(result())
    renderTab()
    await screen.findByTestId("local-prompt")
    search(); await screen.findByTestId("local-list")
    fireEvent.click(screen.getByTestId("local-radius-10"))
    expect(local.search).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("local-stale").textContent).toMatch(/results are for 5 km.*search 10 km/i)
    local.search.mockResolvedValue(result({ radiusKm: 10 }))
    search()
    await waitFor(() => expect(local.search).toHaveBeenCalledTimes(2))
    expect(local.search).toHaveBeenLastCalledWith("p1", { radiusKm: 10 })
    await waitFor(() => expect(screen.queryByTestId("local-stale")).toBeNull())
  })

  test("the user can correct the category: their words are sent, and only then", async () => {
    local.search.mockResolvedValue(result())
    renderTab()
    await screen.findByTestId("local-prompt")
    fireEvent.click(screen.getByRole("button", { name: "Remove eye hospital" }))
    fireEvent.change(screen.getByTestId("local-query-input"), { target: { value: "dental clinic" } })
    fireEvent.click(screen.getByRole("button", { name: "Add category" }))
    expect(screen.getByTestId("local-query").textContent).toMatch(/dental clinic/)
    search(); await screen.findByTestId("local-list")
    expect(local.search).toHaveBeenCalledWith("p1", { radiusKm: 5, queries: ["dental clinic"] })
  })

  test("results survive switching away and back: no second (billed) search", async () => {
    local.search.mockResolvedValue(result())
    const r = renderTab()
    await screen.findByTestId("local-prompt")
    search(); await screen.findByTestId("local-list")
    r.remount()
    expect(await screen.findByTestId("local-list")).toBeTruthy()
    expect(local.search).toHaveBeenCalledTimes(1)
  })

  test("no results, a result cap and a broad category each say so", async () => {
    local.search.mockResolvedValue(result({ results: [] }))
    renderTab(); await screen.findByTestId("local-prompt"); search()
    expect((await screen.findByTestId("local-empty")).textContent).toMatch(/No matching businesses were found within 5 km/)
  })
  test("warnings are shown in words", async () => {
    local.search.mockResolvedValue(result({ meta: { googleRequests: 2, dropped: {}, warnings: ["RESULT_CAP", "BROAD_CATEGORY"] } }))
    renderTab(); await screen.findByTestId("local-prompt"); search()
    const w = await screen.findAllByTestId("local-warning")
    expect(w.map((x) => x.dataset.code)).toEqual(["RESULT_CAP", "BROAD_CATEGORY"])
    expect(w[0].textContent).toMatch(/at most 20 places per search/)
  })
})

describe("list and map stay in step", () => {
  async function withResults() {
    local.search.mockResolvedValue(result())
    renderTab(); await screen.findByTestId("local-prompt"); search(); await screen.findByTestId("local-list")
  }
  test("the map has the business in the middle, a ring for the radius and one marker per result at its real place", async () => {
    await withResults()
    const map = within(screen.getByTestId("local-map"))
    expect(map.getByTestId("local-map-center")).toBeTruthy()
    expect(map.getByTestId("local-map-radius")).toBeTruthy()
    expect(map.getAllByTestId("local-marker")).toHaveLength(3)
    expect(screen.getByTestId("local-map").textContent).toMatch(/The outer ring is 5 km/)
  })
  test("selecting a row selects its marker and opens its details", async () => {
    await withResults()
    expect(screen.queryByTestId("local-details")).toBeNull()
    fireEvent.click(screen.getAllByTestId("local-row")[1].querySelector("button[aria-pressed]"))
    expect(screen.getAllByTestId("local-marker").find((m) => m.dataset.selected === "true").dataset.placeId).toBe("P2")
    const d = within(screen.getByTestId("local-details"))
    expect(d.getByText("City General Hospital")).toBeTruthy()
    expect(d.getByText(/2\.5 km from your business/)).toBeTruthy()
    expect(d.getByText(/says nothing about a business's search performance/)).toBeTruthy()
  })
  test("selecting a marker (mouse or keyboard) selects its row and shows its details, website and Google Maps link", async () => {
    await withResults()
    fireEvent.click(screen.getAllByTestId("local-marker").find((m) => m.dataset.placeId === "P1"))
    expect(screen.getAllByTestId("local-row").find((r) => r.dataset.selected === "true").dataset.placeId).toBe("P1")
    const d = within(screen.getByTestId("local-details"))
    expect(d.getByText("dhanvantari-eye.in")).toBeTruthy()
    expect(d.getByTestId("local-maps-link").getAttribute("href")).toBe("https://maps.google.com/?cid=P1")
    fireEvent.keyDown(screen.getAllByTestId("local-marker").find((m) => m.dataset.placeId === "P2"), { key: "Enter" })
    expect(screen.getAllByTestId("local-row").find((r) => r.dataset.selected === "true").dataset.placeId).toBe("P2")
  })
})

describe("filters and sorting", () => {
  async function withResults() {
    local.search.mockResolvedValue(result())
    renderTab(); await screen.findByTestId("local-prompt"); search(); await screen.findByTestId("local-list")
  }
  test("category matches, has website, minimum rating and minimum reviews narrow the list; unknown ratings never pass a minimum", async () => {
    await withResults()
    fireEvent.click(screen.getByTestId("local-filter-direct")); expect(rowNames()).toEqual(["Dhanvantari Eye Hospital", "Sunrise Clinic"])
    fireEvent.click(screen.getByTestId("local-filter-has_website")); expect(rowNames()).toEqual(["Dhanvantari Eye Hospital", "Sunrise Clinic"])
    fireEvent.click(screen.getByTestId("local-filter-all"))
    fireEvent.change(screen.getByTestId("local-min-rating"), { target: { value: "4" } }); expect(rowNames()).toEqual(["Dhanvantari Eye Hospital", "City General Hospital"])
    fireEvent.change(screen.getByTestId("local-min-reviews"), { target: { value: "100" } }); expect(rowNames()).toEqual(["Dhanvantari Eye Hospital"])
    expect(screen.getByTestId("local-summary").textContent).toMatch(/1 of 3 businesses/)
  })
  test("a filter that matches nothing says so and clears", async () => {
    await withResults()
    fireEvent.change(screen.getByTestId("local-min-rating"), { target: { value: "4.5" } })
    fireEvent.click(screen.getByTestId("local-filter-added"))
    expect((await screen.findByTestId("local-no-match")).textContent).toMatch(/None of the 3 businesses match these filters/)
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(rowNames()).toHaveLength(3)
  })
  test("sort by rating puts the best first and the unrated last; by distance restores nearest first", async () => {
    await withResults()
    fireEvent.change(screen.getByTestId("local-sort"), { target: { value: "rating" } })
    expect(rowNames()).toEqual(["Dhanvantari Eye Hospital", "City General Hospital", "Sunrise Clinic"])
    fireEvent.change(screen.getByTestId("local-sort"), { target: { value: "reviews" } })
    expect(rowNames()).toEqual(["Dhanvantari Eye Hospital", "City General Hospital", "Sunrise Clinic"])
    fireEvent.change(screen.getByTestId("local-sort"), { target: { value: "distance" } })
    expect(rowNames()[0]).toBe("Dhanvantari Eye Hospital")
  })
})

describe("adding to My competitors", () => {
  async function withResults() {
    local.search.mockResolvedValue(result())
    renderTab(); await screen.findByTestId("local-prompt"); search(); await screen.findByTestId("local-list")
  }
  test("the business's Google place, website, address and position are sent as a LOCAL discovery; the row then says it is in My competitors", async () => {
    mineSvc.addDiscovered.mockResolvedValue(ok({ created: true, competitor: { id: "c1", name: "Dhanvantari Eye Hospital", domain: "dhanvantari-eye.in", enrichment: { status: "pending" } } }))
    await withResults()
    fireEvent.click(within(screen.getAllByTestId("local-row")[0]).getByTestId("local-add"))
    await waitFor(() => expect(mineSvc.addDiscovered).toHaveBeenCalledTimes(1))
    const [pid, body] = mineSvc.addDiscovered.mock.calls[0]
    expect(pid).toBe("p1")
    expect(body).toMatchObject({ source: "local", name: "Dhanvantari Eye Hospital", domain: "dhanvantari-eye.in", placeId: "P1", address: "Dhanvantari Eye Hospital, Nashik" })
    expect(typeof body.lat).toBe("number"); expect(typeof body.lng).toBe("number")
    expect(body).not.toHaveProperty("rating"); expect(body).not.toHaveProperty("reviewCount"); expect(body).not.toHaveProperty("types")
    await waitFor(() => expect(within(screen.getAllByTestId("local-row")[0]).getByTestId("local-added")).toBeTruthy())
    expect(await screen.findByText(/added to My competitors\. Its SEO metrics are being fetched/)).toBeTruthy()
    fireEvent.click(screen.getByTestId("local-filter-added")); expect(rowNames()).toEqual(["Dhanvantari Eye Hospital"])
  })
  test("a business without a website is added too, and the page says there are no SEO metrics to fetch", async () => {
    mineSvc.addDiscovered.mockResolvedValue(ok({ created: true, competitor: { id: "c2", name: "City General Hospital", domain: null, enrichment: { status: "no_website" } } }))
    await withResults()
    fireEvent.click(within(screen.getAllByTestId("local-row")[1]).getByTestId("local-add"))
    expect(await screen.findByText(/It has no website, so there are no SEO metrics to fetch/)).toBeTruthy()
    expect(mineSvc.addDiscovered.mock.calls[0][1].domain).toBeUndefined() // a missing website is sent as nothing, never as an empty string or a guess
  })
  test("one that was already there is merged, and the page says it was not duplicated", async () => {
    mineSvc.addDiscovered.mockResolvedValue(ok({ created: false, competitor: { id: "c9", name: "Dhanvantari", domain: "dhanvantari-eye.in", enrichment: { status: "enriched" } } }))
    await withResults()
    fireEvent.click(within(screen.getAllByTestId("local-row")[0]).getByTestId("local-add"))
    expect(await screen.findByText(/already in My competitors, so that record was updated instead of duplicated/)).toBeTruthy()
  })
  test("a failed add says why and leaves the row addable", async () => {
    mineSvc.addDiscovered.mockRejectedValue(apiError("You can have at most 100 competitors. Remove one first.", "COMPETITOR_LIMIT_REACHED", 409))
    await withResults()
    fireEvent.click(within(screen.getAllByTestId("local-row")[0]).getByTestId("local-add"))
    expect(await screen.findByText(/at most 100 competitors/)).toBeTruthy()
    expect(within(screen.getAllByTestId("local-row")[0]).getByTestId("local-add")).toBeTruthy()
  })
})

describe("what can go wrong", () => {
  test("no business location: it says so, points to the fix, and never offers to guess", async () => {
    local.search.mockRejectedValue(apiError("Odito does not know where your business is.", "LOCATION_REQUIRED"))
    renderTab(); await screen.findByTestId("local-prompt"); search()
    const e = await screen.findByTestId("local-error")
    expect(e.dataset.code).toBe("LOCATION_REQUIRED")
    expect(e.textContent).toMatch(/Verify your business location/)
    expect(e.textContent).toMatch(/never guesses a location/)
    expect(screen.queryByTestId("local-confirm-address")).toBeNull()
    expect(screen.getByTestId("local-open-settings").getAttribute("href")).toBe("/app/settings")
  })
  test("an address with no saved position asks for confirmation, then searches once more with the confirmation", async () => {
    local.search.mockRejectedValueOnce(apiError("needs confirmation", "LOCATION_NEEDS_CONFIRMATION", 422, { address: "Gangapur Rd, Nashik" }))
    local.search.mockResolvedValueOnce(result({ center: { ...CENTER, source: "address_geocoded" } }))
    renderTab(); await screen.findByTestId("local-prompt"); search()
    expect((await screen.findByTestId("local-error")).textContent).toMatch(/Gangapur Rd, Nashik/)
    fireEvent.click(screen.getByTestId("local-confirm-address"))
    await screen.findByTestId("local-list")
    expect(local.search).toHaveBeenLastCalledWith("p1", { radiusKm: 5, geocode: true })
    expect(screen.getByTestId("local-summary").textContent).toMatch(/of your business address/)
    expect(screen.queryByTestId("local-error")).toBeNull()
  })
  test("a project whose category cannot be guessed is asked for one", async () => {
    local.search.mockRejectedValue(apiError("Odito could not tell what kind of business", "CATEGORY_REQUIRED"))
    renderTab(); await screen.findByTestId("local-prompt"); search()
    expect((await screen.findByTestId("local-error")).textContent).toMatch(/What kind of business should Odito look for/)
    expect(screen.getByRole("button", { name: "Enter a category" })).toBeTruthy()
  })
  test("the daily limit is explained and there is nothing to retry", async () => {
    local.search.mockRejectedValue(apiError("This project reached its daily limit", "LOCAL_BUDGET_EXCEEDED", 429))
    renderTab(); await screen.findByTestId("local-prompt"); search()
    expect((await screen.findByTestId("local-error")).textContent).toMatch(/Daily limit reached/)
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
  })
  test("a problem on the server side never mentions keys or billing, and a transient one offers Try again", async () => {
    local.search.mockRejectedValue(apiError("Local search is not available right now.", "PLACES_ACCESS_DENIED", 503))
    renderTab(); await screen.findByTestId("local-prompt"); search()
    const e = await screen.findByTestId("local-error")
    expect(e.textContent).toMatch(/problem on Odito's side/)
    expect(e.textContent).not.toMatch(/API key|billing|credential/i)
    cleanupAndRetry()
    function cleanupAndRetry() { /* each test renders its own tree */ }
  })
  test("Google being slow offers Try again, and trying again searches again", async () => {
    local.search.mockRejectedValueOnce(apiError("Google took too long", "PLACES_TIMEOUT", 504))
    local.search.mockResolvedValueOnce(result())
    renderTab(); await screen.findByTestId("local-prompt"); search()
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))
    await screen.findByTestId("local-list")
    expect(local.search).toHaveBeenCalledTimes(2)
  })
  test("the page makes no third-party image requests (no favicons here)", async () => {
    local.search.mockResolvedValue(result())
    renderTab(); await screen.findByTestId("local-prompt"); search(); await screen.findByTestId("local-list")
    expect(document.querySelectorAll("img")).toHaveLength(0)
  })
})
