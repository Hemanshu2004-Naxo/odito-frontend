import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hook (URL state, query keys, cancellation), mapping, filter builder and components run.
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DEFAULT_HISTORY_MONTHS: 12,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
}))
// The project's saved brand terms (Anchors -> Anchor settings): the Brand / Non-brand split reads them.
const brandSvc = vi.hoisted(() => ({ get: vi.fn(), data: { saved: false, brand_terms: [], target_keywords: [] } }))
vi.mock("@/services/anchorSettingsService", () => ({ default: brandSvc, anchorSettingsService: brandSvc }))
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

import OrganicKeywordsDashboard from "./OrganicKeywordsDashboard"
import { REAL_METRICS, REAL_ROWS, pageEnvelope } from "./testFixtures"

const DEFAULT_ORDER = "ranked_serp_element.serp_item.etv,desc"
const TOTAL = 137
const ALL = Array.from({ length: TOTAL }, (_, i) => (i < REAL_ROWS.length ? REAL_ROWS[i] : { ...REAL_ROWS[i % REAL_ROWS.length], keyword: `${REAL_ROWS[i % REAL_ROWS.length].keyword} ${i}` }))
const ok = (data) => ({ success: true, data })
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })
const deferred = () => { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }

/** A tiny fake of the server: slices ALL by limit / offset. `total` and `rows` can be overridden per request. */
function serve(impl) {
  svc.getSection.mockImplementation(impl || (async (_pid, _section, opts) => {
    const q = opts?.query
    if (!q) return ok(pageEnvelope([REAL_ROWS[0]], { total: 4139, metrics: REAL_METRICS }))
    return ok(pageEnvelope(ALL.slice(q.offset ?? 0, (q.offset ?? 0) + q.limit), { total: TOTAL, metrics: { ...REAL_METRICS, count: TOTAL }, query: q }))
  }))
}
const calls = () => svc.getSection.mock.calls.map(([pid, section, opts, req]) => ({ pid, section, refresh: Boolean(opts?.refresh), query: opts?.query, signal: req?.signal }))
const pageCalls = () => calls().filter((c) => c.query)
const lastPageCall = () => pageCalls().at(-1)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(OrganicKeywordsDashboard)))
}

const rowEls = () => screen.getAllByTestId("ok-row")
const showing = () => screen.getByTestId("ok-showing").textContent
const field = (name) => screen.getByRole("textbox", { name })
const chip = (group, name) => within(screen.getByTestId(group)).getByRole("button", { name })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Details regions only: the results <section> is itself a named landmark region.
const detailRegions = () => screen.queryAllByRole("region", { name: /^Details for / })

vi.setConfig({ testTimeout: 30000 }) // a 50-row page with Radix controls is slow under jsdom; set before any test is collected

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
  window.history.replaceState(null, "", "/app/organic-keywords")
  window.innerWidth = 1280
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  brandSvc.data = { saved: false, brand_terms: [], target_keywords: [] }
  brandSvc.get.mockImplementation(async () => ({ success: true, data: brandSvc.data }))
  serve()
})
afterEach(() => { vi.restoreAllMocks() })

describe("Organic Keywords: first load", () => {
  test("two requests only: the whole-domain totals (the dashboard's own query) and the first page of 50, traffic descending, no filters", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const c = calls()
    expect(c).toHaveLength(2)
    expect(c.find((x) => !x.query)).toMatchObject({ section: "ranked-keywords", refresh: false })
    expect(c.find((x) => x.query).query).toEqual({ limit: 50, offset: 0, order_by: DEFAULT_ORDER, filters: [] })
  })

  test("the frame is there at once: title, domain from the project, skeleton rows and card skeletons, no spinner page", () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { name: "Organic Keywords" })).toBeTruthy()
    expect(screen.getByTestId("ok-domain").textContent).toBe("asgeyehospital.com")
    expect(screen.getAllByTestId("ok-skeleton-row").length).toBeGreaterThanOrEqual(5)
    expect(document.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThanOrEqual(10)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("header: domain, 'India · English', last updated, Refresh and Export CSV", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(screen.getByTestId("ok-market").textContent).toBe("India · English")
    expect(screen.getByTestId("ok-updated").textContent).toMatch(/^Last updated .*2026/)
    expect(screen.getByTestId("ok-refresh")).toBeTruthy()
    expect(screen.getByTestId("ok-export")).toBeTruthy()
  })

  test("asks for a project when none is selected, and requests nothing", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its organic keywords.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
  })
})

describe("Organic Keywords: summary cards (whole domain, from the unfiltered totals)", () => {
  test("total, top 3, top 10, est. traffic and movement come from metrics.organic (real asgeyehospital.com figures)", async () => {
    renderPage()
    await screen.findByTestId("ok-card-total")
    await waitFor(() => expect(screen.getByTestId("ok-card-total").textContent).toContain("4.1K"))
    expect(screen.getByTestId("ok-card-top3").textContent).toContain("473")
    expect(screen.getByTestId("ok-card-top10").textContent).toContain("1.5K")
    expect(screen.getByTestId("ok-card-traffic").textContent).toContain("100.4K")
    expect(screen.getByTestId("ok-move-new").textContent).toBe("+2.8K")
    expect(screen.getByTestId("ok-move-up").textContent).toBe("▲621")
    expect(screen.getByTestId("ok-move-down").textContent).toBe("▼572")
    expect(within(screen.getByTestId("ok-card-traffic")).getByRole("button", { name: "About Est. traffic" })).toBeTruthy()
    expect(screen.getByTestId("ok-card-total").querySelector("[title]").getAttribute("title")).toBe("4,139")
  })

  test("they do NOT change when a filter is applied, even though the provider's metrics for a filtered request describe only the matching rows", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId("ok-card-total").textContent).toContain("4.1K"))
    fireEvent.click(chip("ok-filter-position", "Top 3"))
    await waitFor(() => expect(lastPageCall().query.filters).toEqual([["ranked_serp_element.serp_item.rank_group", "<=", 3]].flat()))
    await screen.findAllByTestId("ok-row")
    expect(screen.getByTestId("ok-card-total").textContent).toContain("4.1K")
    expect(calls().filter((c) => !c.query)).toHaveLength(1) // the totals were not requested again
  })

  test("a failed totals request shows its own error with Retry; the table still works", async () => {
    let fail = true
    serve(async (_p, _s, opts) => {
      if (!opts?.query) { if (fail) throw apiError("The data service is temporarily unavailable."); return ok(pageEnvelope([REAL_ROWS[0]], { total: 4139, metrics: REAL_METRICS })) }
      return ok(pageEnvelope(ALL.slice(0, 50), { total: TOTAL }))
    })
    renderPage()
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("temporarily unavailable")
    expect((await screen.findAllByTestId("ok-row")).length).toBe(50)
    fail = false
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }))
    await waitFor(() => expect(screen.getByTestId("ok-card-total").textContent).toContain("4.1K"))
  })
})

describe("Organic Keywords: the table", () => {
  test("a NEW keyword: keyword link to Google (new tab), intent badge, position, NEW, volume, KD dot, CPC, traffic share, URL", async () => {
    renderPage()
    const row = (await screen.findAllByTestId("ok-row"))[0]
    const link = within(row).getByTestId("ok-keyword-link")
    expect(link.textContent).toContain("asg hospital")
    expect(link.getAttribute("href")).toMatch(/^https:\/\/www\.google\.com\/search\?q=asg%20hospital/)
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(within(row).getByRole("img", { name: "Navigational intent" }).textContent).toBe("N")
    expect(within(row).getByTestId("ok-position").textContent).toBe("1")
    expect(within(row).getByTestId("do-badge-new")).toBeTruthy()
    expect(within(row).getByTestId("ok-volume").textContent).toBe("74K")
    expect(within(row).getByTestId("ok-kd").textContent).toContain("0")
    expect(within(row).getByTestId("ok-kd").querySelector("[data-band]").getAttribute("data-band")).toBe("easy")
    expect(within(row).getByTestId("ok-cpc").textContent).toBe("$0.26")
    expect(within(row).getByTestId("ok-share").textContent).toMatch(/^\d+\.\d%$|^<0\.1%$/)
    const url = within(row).getByTestId("ok-url")
    expect(url.getAttribute("href")).toBe("https://www.asgeyehospital.com/")
    expect(url.getAttribute("target")).toBe("_blank")
    expect(url.getAttribute("title")).toBe("https://www.asgeyehospital.com/")
  })

  test("movement badges: improved ▲n green, declined ▼n red, unchanged nothing", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const byName = (name) => rowEls().find((r) => r.textContent.includes(name))
    const up = REAL_ROWS.find((r) => r.keyword === "right eye blinking for female")
    const down = REAL_ROWS.find((r) => r.keyword === "eye doctor ranchi")
    expect(within(byName("right eye blinking for female")).getByTestId("do-badge-up").textContent).toBe(`▲${up.previous_position - up.position_absolute}`)
    expect(within(byName("eye doctor ranchi")).getByTestId("do-badge-down").textContent).toBe(`▼${down.position_absolute - down.previous_position}`)
    const same = byName("asg eye hospital mysore")
    expect(within(same).queryByTestId("do-badge-up")).toBeNull()
    expect(within(same).queryByTestId("do-badge-down")).toBeNull()
    expect(within(same).queryByTestId("do-badge-new")).toBeNull()
  })

  test("a missing CPC is — and not $0.00", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const hajipur = rowEls().find((r) => r.textContent.includes("hajipur"))
    expect(within(hajipur).getByTestId("ok-cpc").textContent).toBe("—")
  })

  test("a non-organic result gets a tag next to the position", async () => {
    serve(async (_p, _s, opts) => (opts?.query
      ? ok(pageEnvelope([{ ...REAL_ROWS[0], type: "featured_snippet" }, REAL_ROWS[1]], { total: 2 }))
      : ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))))
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(within(rowEls()[0]).getByTestId("ok-result-type").textContent).toBe("Snippet")
    expect(within(rowEls()[1]).queryByTestId("ok-result-type")).toBeNull()
  })

  test("SERP features: icons (named for screen readers), four at most, then +N", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const icons = (r) => [...within(r).getByTestId("ok-serp").querySelectorAll("[role=img]")].filter((el) => !el.textContent.startsWith("+"))
    const many = rowEls().find((r) => r.textContent.includes("asg") && within(r).queryByTestId("ok-serp") && icons(r).length >= 4)
    const box = within(many).getByTestId("ok-serp")
    expect(icons(many)).toHaveLength(4)
    expect(box.textContent).toMatch(/\+\d+/)
    expect(icons(many).every((el) => el.getAttribute("aria-label") && el.getAttribute("title"))).toBe(true)
  })

  test("sortable headers: Keyword, Position, Traffic, Volume, KD and CPC; the default sort is shown with aria-sort", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const headers = screen.getAllByRole("columnheader")
    const sorted = headers.filter((h) => h.getAttribute("aria-sort"))
    expect(sorted).toHaveLength(1)
    expect(sorted[0].textContent).toContain("Traffic")
    expect(sorted[0].getAttribute("aria-sort")).toBe("descending")
    for (const name of ["Keyword", "Position", "Traffic", "Volume", "KD", "CPC"]) expect(screen.getByRole("button", { name: new RegExp(`^Sort by ${name}`) })).toBeTruthy()
    expect(headers.some((h) => h.textContent.trim().startsWith("Intent"))).toBe(true)
    expect(screen.queryByRole("button", { name: /^Sort by (Intent|URL|SERP)/ })).toBeNull()
  })
})

describe("Organic Keywords: sorting (server-side)", () => {
  test("first click on a column sorts in its natural direction, a second click flips it; each sort is a new request from page 1", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByRole("button", { name: /^Sort by Volume/ }))
    await waitFor(() => expect(lastPageCall().query.order_by).toBe("keyword_data.keyword_info.search_volume,desc"))
    fireEvent.click(screen.getByRole("button", { name: /^Sort by Volume/ }))
    await waitFor(() => expect(lastPageCall().query.order_by).toBe("keyword_data.keyword_info.search_volume,asc"))
    fireEvent.click(screen.getByRole("button", { name: /^Sort by Position/ }))
    await waitFor(() => expect(lastPageCall().query.order_by).toBe("ranked_serp_element.serp_item.rank_group,asc"))
    fireEvent.click(screen.getByRole("button", { name: /^Sort by Keyword/ }))
    await waitFor(() => expect(lastPageCall().query.order_by).toBe("keyword_data.keyword,asc"))
    expect(screen.getAllByRole("columnheader").find((h) => h.getAttribute("aria-sort")).textContent).toContain("Keyword")
    expect(lastPageCall().query.offset).toBe(0)
  })

  test("sorting while on page 3 goes back to page 1", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    fireEvent.click(await screen.findByRole("button", { name: "Next page" }))
    await waitFor(() => expect(lastPageCall().query.offset).toBe(100))
    fireEvent.click(screen.getByRole("button", { name: /^Sort by KD/ }))
    await waitFor(() => expect(lastPageCall().query).toMatchObject({ offset: 0, order_by: "keyword_data.keyword_properties.keyword_difficulty,desc" }))
  })
})

describe("Organic Keywords: filters", () => {
  test("search is debounced: three quick keystrokes make ONE request, 400 ms after the last, lowercased as `like %text%`", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const before = pageCalls().length
    const input = field("Search keywords")
    fireEvent.change(input, { target: { value: "E" } })
    fireEvent.change(input, { target: { value: "EY" } })
    fireEvent.change(input, { target: { value: "EYE" } })
    await sleep(150)
    expect(pageCalls()).toHaveLength(before) // nothing yet
    await waitFor(() => expect(pageCalls()).toHaveLength(before + 1))
    expect(lastPageCall().query.filters).toEqual(["keyword_data.keyword", "like", "%eye%"])
    await sleep(600)
    expect(pageCalls()).toHaveLength(before + 1)
  })

  test("Enter applies a text filter at once", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const input = field("Search keywords")
    fireEvent.change(input, { target: { value: "lasik" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect(lastPageCall().query.filters).toEqual(["keyword_data.keyword", "like", "%lasik%"]))
  })

  test("range filters are applied only on blur or Enter, never while typing", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const before = pageCalls().length
    const min = field("Minimum Volume")
    fireEvent.change(min, { target: { value: "1" } })
    fireEvent.change(min, { target: { value: "10" } })
    fireEvent.change(min, { target: { value: "100" } })
    await sleep(700)
    expect(pageCalls()).toHaveLength(before)
    fireEvent.keyDown(min, { key: "Enter" })
    await waitFor(() => expect(lastPageCall().query.filters).toEqual(["keyword_data.keyword_info.search_volume", ">=", 100]))
    const max = field("Maximum KD")
    fireEvent.change(max, { target: { value: "40" } })
    fireEvent.blur(max)
    await waitFor(() => expect(lastPageCall().query.filters).toContain("and"))
    const f = lastPageCall().query.filters
    expect(f).toEqual(expect.arrayContaining([["keyword_data.keyword_properties.keyword_difficulty", "<=", 40], ["keyword_data.keyword_info.search_volume", ">=", 100]]))
    expect(f).toContain("and")
  })

  test("a range with min greater than max is explained and not sent", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const before = pageCalls().length
    fireEvent.change(field("Minimum Volume"), { target: { value: "900" } })
    fireEvent.blur(field("Minimum Volume"))
    await waitFor(() => expect(pageCalls()).toHaveLength(before + 1))
    fireEvent.change(field("Maximum Volume"), { target: { value: "100" } })
    fireEvent.blur(field("Maximum Volume"))
    expect((await screen.findByText(/minimum is greater than the maximum/i)).getAttribute("role")).toBe("alert")
    // the invalid pair is dropped: no volume chip, and the table is the unfiltered view again (already loaded, so served from the cache)
    await waitFor(() => expect(screen.queryByTestId("ok-active-filters")).toBeNull())
    expect(showing()).toBe("Showing 1–50 of 137 keywords")
  })

  test("position, movement and intent controls: each click is one request with the right condition", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(chip("ok-filter-position", "11–20"))
    await waitFor(() => expect(lastPageCall().query.filters).toEqual([["ranked_serp_element.serp_item.rank_group", ">=", 11], "and", ["ranked_serp_element.serp_item.rank_group", "<=", 20]]))
    fireEvent.click(chip("ok-filter-position", "All"))
    fireEvent.click(chip("ok-filter-movement", "Improved"))
    await waitFor(() => expect(lastPageCall().query.filters).toEqual(["ranked_serp_element.serp_item.rank_changes.is_up", "=", true]))
    fireEvent.click(chip("ok-filter-movement", "All"))
    fireEvent.click(within(screen.getByTestId("ok-filter-intent")).getByRole("button", { name: /Commercial/ }))
    fireEvent.click(within(screen.getByTestId("ok-filter-intent")).getByRole("button", { name: /Transactional/ }))
    await waitFor(() => expect(lastPageCall().query.filters).toEqual(["keyword_data.search_intent_info.main_intent", "in", ["commercial", "transactional"]]))
  })

  test("exclude and URL-contains filters", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.change(field("Exclude keywords containing"), { target: { value: "Near Me" } })
    fireEvent.change(field("Ranking URL contains"), { target: { value: "/Blog/" } })
    await waitFor(() => expect(lastPageCall().query.filters).toEqual(expect.arrayContaining([["keyword_data.keyword", "not_like", "%near me%"], ["ranked_serp_element.serp_item.relative_url", "like", "%/Blog/%"]])))
  })

  test("applied filters are removable chips; Clear all removes every one", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(screen.queryByTestId("ok-active-filters")).toBeNull()
    fireEvent.click(chip("ok-filter-position", "Top 10"))
    fireEvent.click(chip("ok-filter-movement", "New"))
    const chips = await screen.findAllByTestId("ok-chip")
    expect(chips.map((c) => c.textContent)).toEqual(["Position: Top 10", "Movement: New"])
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Position: Top 10" }))
    await waitFor(() => expect(lastPageCall().query.filters).toEqual(["ranked_serp_element.serp_item.rank_changes.is_new", "=", true]))
    expect(screen.getAllByTestId("ok-chip")).toHaveLength(1)
    expect(chip("ok-filter-position", "All").getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(chip("ok-filter-position", "Top 3"))
    await screen.findAllByTestId("ok-chip")
    fireEvent.click(screen.getByTestId("ok-clear-all"))
    await waitFor(() => expect(screen.queryByTestId("ok-active-filters")).toBeNull())
    expect(window.location.search).toBe("")
    expect(chip("ok-filter-movement", "All").getAttribute("aria-pressed")).toBe("true")
  })

  test("clearing the search box (draft follows the state) when Clear all is used", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.change(field("Search keywords"), { target: { value: "eye" } })
    await waitFor(() => expect(lastPageCall().query.filters).toEqual(["keyword_data.keyword", "like", "%eye%"]))
    fireEvent.click(await screen.findByTestId("ok-clear-all"))
    await waitFor(() => expect(field("Search keywords").value).toBe(""))
  })

  test("a change of filter always goes back to page 1", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(lastPageCall().query.offset).toBe(50))
    fireEvent.click(chip("ok-filter-position", "Top 3"))
    await waitFor(() => expect(lastPageCall().query.offset).toBe(0))
  })
})

describe("Organic Keywords: the 8-condition limit", () => {
  const apply = async () => {
    fireEvent.change(field("Search keywords"), { target: { value: "eye" } })
    fireEvent.keyDown(field("Search keywords"), { key: "Enter" })
    fireEvent.change(field("Exclude keywords containing"), { target: { value: "cost" } })
    fireEvent.keyDown(field("Exclude keywords containing"), { key: "Enter" })
    fireEvent.click(chip("ok-filter-position", "11–20"))
    for (const [name, v] of [["Minimum Volume", "10"], ["Maximum Volume", "900"], ["Minimum KD", "5"], ["Maximum KD", "60"]]) {
      fireEvent.change(field(name), { target: { value: v } })
      fireEvent.blur(field(name))
    }
  }

  test("8 conditions are sent; the 9th is not — the user is told how many to remove, and the previous results stay (dimmed)", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    await apply()
    await waitFor(() => expect(lastPageCall().query.filters.filter((x) => Array.isArray(x))).toHaveLength(8))
    expect(screen.queryByTestId("ok-too-many")).toBeNull()
    const sent = pageCalls().length
    fireEvent.click(chip("ok-filter-movement", "New"))
    const msg = await screen.findByTestId("ok-too-many")
    expect(msg.textContent).toMatch(/9 conditions/)
    expect(msg.textContent).toMatch(/at most 8/)
    await sleep(300)
    expect(pageCalls()).toHaveLength(sent) // nothing was sent for the 9th
    expect(screen.getAllByTestId("ok-row").length).toBeGreaterThan(0) // the last results are still there
    expect(screen.getByTestId("ok-export").hasAttribute("disabled")).toBe(true)
    fireEvent.click(chip("ok-filter-movement", "All"))
    await waitFor(() => expect(screen.queryByTestId("ok-too-many")).toBeNull())
  })
})

describe("Organic Keywords: pagination (total_count drives it)", () => {
  test("'Showing 1–50 of 137 keywords', 3 pages, previous disabled on the first", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(showing()).toBe("Showing 1–50 of 137 keywords")
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(within(nav).getAllByRole("button", { name: /^Page \d+$/ }).map((b) => b.textContent)).toEqual(["1", "2", "3"])
    expect(within(nav).getByRole("button", { name: "Previous page" }).hasAttribute("disabled")).toBe(true)
    expect(within(nav).getByRole("button", { name: "Page 1" }).getAttribute("aria-current")).toBe("page")
  })

  test("next, a numbered page and the last page request the right offsets and show the right range", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(showing()).toBe("Showing 51–100 of 137 keywords"))
    expect(lastPageCall().query).toMatchObject({ limit: 50, offset: 50 })
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }))
    await waitFor(() => expect(showing()).toBe("Showing 101–137 of 137 keywords"))
    expect(lastPageCall().query.offset).toBe(100)
    expect(screen.getByRole("button", { name: "Next page" }).hasAttribute("disabled")).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }))
    await waitFor(() => expect(showing()).toBe("Showing 51–100 of 137 keywords")) // page 2 was loaded before: no new request
  })

  test("page size 25 / 50 / 100: a new limit, back to page 1", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(lastPageCall().query.offset).toBe(50))
    fireEvent.change(screen.getByTestId("ok-page-size"), { target: { value: "25" } })
    await waitFor(() => expect(lastPageCall().query).toMatchObject({ limit: 25, offset: 0 }))
    await waitFor(() => expect(showing()).toBe("Showing 1–25 of 137 keywords"))
    expect(within(screen.getByRole("navigation", { name: "Pagination" })).getByRole("button", { name: "Page 6" })).toBeTruthy() // ceil(137 / 25)
    fireEvent.change(screen.getByTestId("ok-page-size"), { target: { value: "100" } })
    await waitFor(() => expect(lastPageCall().query).toMatchObject({ limit: 100, offset: 0 }))
  })

  test("Go to page jumps there, and refuses a page that does not exist", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const box = screen.getByLabelText("Go to page")
    fireEvent.change(box, { target: { value: "9" } })
    expect(screen.getByRole("button", { name: "Go" }).hasAttribute("disabled")).toBe(true)
    fireEvent.change(box, { target: { value: "3" } })
    fireEvent.click(screen.getByRole("button", { name: "Go" }))
    await waitFor(() => expect(lastPageCall().query.offset).toBe(100))
  })

  test("a different total_count changes the number of pages (the pagination follows the filters, not the domain)", async () => {
    serve(async (_p, _s, opts) => (opts?.query
      ? ok(pageEnvelope(ALL.slice(0, opts.query.filters.length ? 3 : 50), { total: opts.query.filters.length ? 3 : TOTAL }))
      : ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))))
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(showing()).toBe("Showing 1–50 of 137 keywords")
    fireEvent.click(chip("ok-filter-position", "Top 3"))
    await waitFor(() => expect(showing()).toBe("Showing 1–3 of 3 keywords"))
    expect(within(screen.getByRole("navigation", { name: "Pagination" })).getAllByRole("button", { name: /^Page \d+$/ })).toHaveLength(1)
  })

  test("a page past the end (a stale link) moves back to the last page that exists", async () => {
    window.history.replaceState(null, "", "/app/organic-keywords?page=40")
    serve(async (_p, _s, opts) => (opts?.query
      ? ok(pageEnvelope(ALL.slice(opts.query.offset, opts.query.offset + opts.query.limit), { total: TOTAL }))
      : ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))))
    renderPage()
    await waitFor(() => expect(lastPageCall().query.offset).toBe(100))
    await waitFor(() => expect(showing()).toBe("Showing 101–137 of 137 keywords"))
  })
})

describe("Organic Keywords: the URL keeps the view", () => {
  test("filters, sort, page and page size are written to the query string (and nothing when everything is default)", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(window.location.search).toBe("")
    fireEvent.click(chip("ok-filter-position", "Top 10"))
    fireEvent.click(screen.getByRole("button", { name: /^Sort by Volume/ }))
    fireEvent.change(screen.getByTestId("ok-page-size"), { target: { value: "25" } })
    await waitFor(() => expect(lastPageCall().query.limit).toBe(25))
    const p = new URLSearchParams(window.location.search)
    expect(Object.fromEntries(p)).toEqual({ pos: "top10", sort: "volume", size: "25" })
    fireEvent.click(await screen.findByRole("button", { name: "Next page" }))
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("page")).toBe("2"))
  })

  test("opening a link with a view in it restores that exact view: the first request already carries it", async () => {
    window.history.replaceState(null, "", "/app/organic-keywords?q=lasik&pos=top3&sort=position&page=2&size=25&intent=commercial,informational&vmin=100")
    renderPage()
    await screen.findAllByTestId("ok-row")
    const first = pageCalls()[0].query
    expect(first).toMatchObject({ limit: 25, offset: 25, order_by: "ranked_serp_element.serp_item.rank_group,asc" })
    expect(first.filters).toEqual(expect.arrayContaining([["keyword_data.keyword", "like", "%lasik%"], ["ranked_serp_element.serp_item.rank_group", "<=", 3], ["keyword_data.keyword_info.search_volume", ">=", 100], ["keyword_data.search_intent_info.main_intent", "in", ["informational", "commercial"]]]))
    expect(field("Search keywords").value).toBe("lasik")
    expect(chip("ok-filter-position", "Top 3").getAttribute("aria-pressed")).toBe("true")
    expect(screen.getAllByTestId("ok-chip").map((c) => c.textContent)).toContain("Position: Top 3")
    expect(screen.getByTestId("ok-page-size").value).toBe("25")
  })

  test("an unknown value in the link falls back to the default instead of breaking the page", async () => {
    window.history.replaceState(null, "", "/app/organic-keywords?sort=password&size=7&pos=nope&page=-3")
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(pageCalls()[0].query).toEqual({ limit: 50, offset: 0, order_by: DEFAULT_ORDER, filters: [] })
  })
})

describe("Organic Keywords: requests are cancelled and cannot overwrite newer results", () => {
  test("changing the filter while a request is in flight aborts it; its late answer is ignored", async () => {
    const first = deferred()
    const second = deferred()
    let n = 0
    serve(async (_p, _s, opts, req) => {
      if (!opts?.query) return ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))
      n += 1
      return n === 1 ? first.promise : second.promise
    })
    renderPage()
    await waitFor(() => expect(pageCalls()).toHaveLength(1))
    const firstCall = pageCalls()[0]
    fireEvent.click(chip("ok-filter-position", "Top 3"))
    await waitFor(() => expect(pageCalls()).toHaveLength(2))
    expect(firstCall.signal.aborted).toBe(true) // the browser cancelled the old request
    await act(async () => { second.resolve(ok(pageEnvelope([REAL_ROWS[1]], { total: 1 }))) })
    await waitFor(() => expect(showing()).toBe("Showing 1–1 of 1 keywords"))
    await act(async () => { first.resolve(ok(pageEnvelope(ALL.slice(0, 50), { total: TOTAL }))) }) // arrives late
    await sleep(50)
    expect(showing()).toBe("Showing 1–1 of 1 keywords")
    expect(rowEls()).toHaveLength(1)
  })

  test("while the new page loads the old rows stay, dimmed and marked busy, instead of a blank table", async () => {
    const next = deferred()
    let n = 0
    serve(async (_p, _s, opts) => {
      if (!opts?.query) return ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))
      n += 1
      return n === 1 ? ok(pageEnvelope(ALL.slice(0, 50), { total: TOTAL })) : next.promise
    })
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(pageCalls()).toHaveLength(2))
    expect(rowEls()).toHaveLength(50)
    expect(screen.getByTestId("ok-table").closest("[aria-busy]").getAttribute("aria-busy")).toBe("true")
    expect(screen.getByTestId("ok-table").closest("[aria-busy]").className).toMatch(/opacity-60/)
    expect(screen.queryByTestId("ok-skeleton-row")).toBeNull()
    await act(async () => { next.resolve(ok(pageEnvelope(ALL.slice(50, 100), { total: TOTAL }))) })
    await waitFor(() => expect(showing()).toBe("Showing 51–100 of 137 keywords"))
    expect(screen.getByTestId("ok-table").closest("[aria-busy]").className).not.toMatch(/opacity-60/)
  })

  test("going back to a view already loaded makes no request (24 h server cache + client cache)", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(showing()).toBe("Showing 51–100 of 137 keywords"))
    const n = pageCalls().length
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }))
    await waitFor(() => expect(showing()).toBe("Showing 1–50 of 137 keywords"))
    expect(pageCalls()).toHaveLength(n)
  })
})

describe("Organic Keywords: empty, error and refresh states", () => {
  test("filters that match nothing: 'No keywords match these filters' with a Clear filters button that works", async () => {
    serve(async (_p, _s, opts) => (opts?.query
      ? ok(pageEnvelope(opts.query.filters.length ? [] : ALL.slice(0, 50), { total: opts.query.filters.length ? 0 : TOTAL }))
      : ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))))
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.change(field("Search keywords"), { target: { value: "zzzz" } })
    fireEvent.keyDown(field("Search keywords"), { key: "Enter" })
    const empty = await screen.findByTestId("ok-empty")
    expect(empty.textContent).toContain("No keywords match these filters")
    expect(screen.queryByText(/doesn.t rank for any keywords/)).toBeNull()
    fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }))
    await waitFor(() => expect(screen.getAllByTestId("ok-row")).toHaveLength(50))
  })

  test("a domain with no keywords at all says so (and does not offer to clear filters)", async () => {
    serve(async (_p, _s, opts) => (opts?.query ? ok(pageEnvelope([], { total: 0 })) : ok(pageEnvelope([], { total: 0, metrics: null }))))
    renderPage()
    const empty = await screen.findByTestId("ok-empty")
    expect(empty.textContent).toContain("This domain doesn't rank for any keywords yet.")
    expect(within(empty).queryByRole("button")).toBeNull()
    expect(screen.queryByTestId("ok-table")).toBeNull()
  })

  test("a failed page request shows an inline error with Retry; the summary and filters stay usable", async () => {
    let fail = true
    serve(async (_p, _s, opts) => {
      if (!opts?.query) return ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))
      if (fail) throw apiError("The data service is temporarily unavailable.")
      return ok(pageEnvelope(ALL.slice(0, 50), { total: TOTAL }))
    })
    renderPage()
    const results = await screen.findByTestId("ok-results")
    const alert = await within(results).findByRole("alert")
    expect(alert.textContent).toContain("temporarily unavailable")
    expect(screen.getByTestId("ok-card-total").textContent).toContain("4.1K")
    expect(field("Search keywords")).toBeTruthy()
    fail = false
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }))
    await waitFor(() => expect(screen.getAllByTestId("ok-row")).toHaveLength(50))
  })

  test("a project without a public domain gets a clear message instead of a retry loop", async () => {
    serve(async () => { throw apiError("This project's website does not have a public domain name.", { status: 422, code: "INVALID_TARGET" }) })
    renderPage()
    expect((await screen.findByRole("alert")).textContent).toMatch(/does not have a public domain name/)
  })

  test("Refresh asks the server to skip its cache for both the page and the totals", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const before = calls().length
    fireEvent.click(screen.getByTestId("ok-refresh"))
    await waitFor(() => expect(calls().length).toBe(before + 2))
    const fresh = calls().slice(before)
    expect(fresh.every((c) => c.refresh)).toBe(true)
    expect(fresh.filter((c) => c.query)).toHaveLength(1)
  })

  test("when the server declines to re-buy data fetched a minute ago the page says so", async () => {
    serve(async (_p, _s, opts) => ok({ ...pageEnvelope(opts?.query ? ALL.slice(0, 50) : [], { total: opts?.query ? TOTAL : 4139, metrics: opts?.query ? null : REAL_METRICS }), refreshThrottled: Boolean(opts?.refresh) }))
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByTestId("ok-refresh"))
    expect(await screen.findByText(/refreshed less than a minute ago/)).toBeTruthy()
  })
})

describe("Organic Keywords: expandable row", () => {
  const open = async (name) => {
    const btn = await screen.findByRole("button", { name: `Details for ${name}` })
    fireEvent.click(btn)
    return screen.findByRole("region", { name: `Details for ${name}` })
  }

  test("opens inline under its row with the 12-month chart, ranking page, competition, bids, backlinks and a Google button", async () => {
    renderPage()
    const name = "asg hospital"
    const raw = REAL_ROWS.find((r) => r.keyword === name)
    expect(raw.referring_domains).not.toBeNull() // a real row with backlink figures
    const region = await open(name)
    expect(within(region).getByTestId("ok-volume-chart")).toBeTruthy()
    const table = within(region).getByRole("table", { hidden: true })
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(13) // header + 12 months
    expect(within(region).getByTestId("ok-serp-title").textContent).toBe(raw.title)
    expect(within(region).getByTestId("ok-competition").textContent).toMatch(/^(Low|Medium|High|—)$/)
    expect(within(region).getByTestId("ok-bid").textContent).toMatch(/^\$\d+\.\d\d – \$\d+\.\d\d$|^—$/)
    expect(within(region).getByTestId("ok-referring-domains").textContent).toBe(raw.referring_domains.toLocaleString("en-US"))
    expect(within(region).getByTestId("ok-backlinks").textContent).toBe(raw.backlinks.toLocaleString("en-US"))
    const view = within(region).getByTestId("ok-view-google")
    expect(view.getAttribute("href")).toBe(raw.check_url)
    expect(view.getAttribute("target")).toBe("_blank")
    const trigger = screen.getByRole("button", { name: `Details for ${name}` })
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(trigger.getAttribute("aria-controls")).toBe(region.id)
    // it sits directly after its own row
    expect(region.closest("tr").previousElementSibling).toBe(trigger.closest("tr"))
  })

  test("clicking the row also toggles it, but links inside the row do not; one row is open at a time", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const first = rowEls()[0]
    fireEvent.click(within(first).getByText("asg hospital").closest("td"))
    await waitFor(() => expect(detailRegions()).toHaveLength(1))
    fireEvent.click(within(first).getByTestId("ok-keyword-link"))
    expect(detailRegions()).toHaveLength(1) // the link did not toggle it
    fireEvent.click(rowEls()[1].querySelector("td:nth-child(2)"))
    await waitFor(() => expect(detailRegions()).toHaveLength(1))
    expect(detailRegions()[0].getAttribute("aria-label")).toBe(`Details for ${REAL_ROWS[1].keyword}`)
    fireEvent.click(screen.getByRole("button", { name: `Details for ${REAL_ROWS[1].keyword}` }))
    expect(detailRegions()).toHaveLength(0)
  })

  test("a missing figure inside the details is — (not 0)", async () => {
    serve(async (_p, _s, opts) => (opts?.query
      ? ok(pageEnvelope([{ ...REAL_ROWS[0], competition_level: null, low_top_of_page_bid: null, high_top_of_page_bid: null, referring_domains: null, backlinks: null, title: null, monthly_searches: [], check_url: null }], { total: 1 }))
      : ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))))
    renderPage()
    const region = await open("asg hospital")
    for (const id of ["ok-competition", "ok-bid", "ok-referring-domains", "ok-backlinks", "ok-serp-title"]) expect(within(region).getByTestId(id).textContent).toBe("—")
    expect(within(region).getByText("No monthly search data for this keyword.")).toBeTruthy()
    expect(within(region).queryByTestId("ok-view-google")).toBeNull()
  })

  test("the open row closes when the view changes", async () => {
    renderPage()
    await open("asg hospital")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(showing()).toBe("Showing 51–100 of 137 keywords"))
    expect(detailRegions()).toHaveLength(0)
  })
})

describe("Organic Keywords: CSV export", () => {
  let blobs
  let clicked
  beforeEach(() => {
    blobs = []
    clicked = []
    URL.createObjectURL = vi.fn((b) => { blobs.push(b); return "blob:test" })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click() { clicked.push(this.download) })
  })
  const text = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(blob) })

  test("'Export current page' downloads what is on screen and makes NO request", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    const before = calls().length
    fireEvent.click(screen.getByTestId("ok-export-page"))
    expect(calls()).toHaveLength(before)
    expect(clicked).toHaveLength(1)
    expect(clicked[0]).toMatch(/^organic-keywords_asgeyehospital\.com_page_\d{4}-\d{2}-\d{2}\.csv$/)
    const csv = await text(blobs[0])
    const lines = csv.replace(/^﻿/, "").split("\r\n")
    expect(lines[0]).toBe("Keyword,Position,Previous position (absolute),Volume,KD,CPC (USD),Intent,Traffic,Traffic value (USD),URL,SERP features")
    expect(lines).toHaveLength(51) // header + the 50 rows on the page
    expect(lines[1].startsWith("asg hospital,1,,74000,0,0.26,Navigational,")).toBe(true)
  })

  test("'Export all' makes ONE request: limit 1000, offset 0, the same filters and sort", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(chip("ok-filter-position", "Top 10"))
    fireEvent.click(screen.getByRole("button", { name: /^Sort by Volume/ }))
    await waitFor(() => expect(lastPageCall().query.order_by).toBe("keyword_data.keyword_info.search_volume,desc"))
    await screen.findAllByTestId("ok-row")
    // from page 2: the export still starts at the first row, not at the page on screen
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(lastPageCall().query.offset).toBe(50))
    await screen.findAllByTestId("ok-row")
    const before = pageCalls().length
    serve(async (_p, _s, opts) => (opts?.query ? ok(pageEnvelope(ALL.slice(0, 120), { total: 120 })) : ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))))
    fireEvent.click(screen.getByTestId("ok-export-all"))
    await waitFor(() => expect(clicked).toHaveLength(1))
    expect(pageCalls()).toHaveLength(before + 1)
    expect(lastPageCall().query).toEqual({ limit: 1000, offset: 0, order_by: "keyword_data.keyword_info.search_volume,desc", filters: ["ranked_serp_element.serp_item.rank_group", "<=", 10] })
    expect(clicked[0]).toMatch(/_all_/)
    expect((await text(blobs[0])).split("\r\n")).toHaveLength(121)
    expect(await screen.findByText("Exported 120 keywords.")).toBeTruthy()
  })

  test("when more than 1,000 keywords match, the menu warns before the click and the result says it was capped", async () => {
    serve(async (_p, _s, opts) => (opts?.query
      ? ok(pageEnvelope(ALL.slice(0, opts.query.limit === 1000 ? 100 : 50), { total: 4139 }))
      : ok(pageEnvelope([], { total: 4139, metrics: REAL_METRICS }))))
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(screen.getByTestId("ok-export-cap").textContent).toContain("Exports the top 1,000 by current sort.")
    fireEvent.click(screen.getByTestId("ok-export-all"))
    expect(await screen.findByText(/Exported the top 100 of 4,139 keywords by current sort\./)).toBeTruthy()
    expect(clicked[0]).toMatch(/top-1000/)
  })

  test("no warning when everything fits in one export", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(screen.queryByTestId("ok-export-cap")).toBeNull()
  })

  test("a failed 'Export all' says so, downloads nothing, and the page keeps working", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    serve(async (_p, _s, opts) => { if (opts?.query?.limit === 1000) throw apiError("The data service is temporarily unavailable."); return ok(pageEnvelope(ALL.slice(0, 50), { total: TOTAL })) })
    fireEvent.click(screen.getByTestId("ok-export-all"))
    expect(await screen.findByText("The data service is temporarily unavailable.")).toBeTruthy()
    expect(clicked).toHaveLength(0)
    expect(screen.getAllByTestId("ok-row")).toHaveLength(50)
  })

  test("exporting twice buys the 1,000 rows once", async () => {
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByTestId("ok-export-all"))
    await waitFor(() => expect(clicked).toHaveLength(1))
    const n = pageCalls().length
    fireEvent.click(screen.getByTestId("ok-export-all"))
    await waitFor(() => expect(clicked).toHaveLength(2))
    expect(pageCalls()).toHaveLength(n)
  })
})

describe("Organic Keywords: compact screens", () => {
  test("below 1024px the filters live in a 'Filters' drawer (with a count of what is applied); inline fields are not rendered", async () => {
    window.innerWidth = 600
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(screen.queryByRole("textbox", { name: "Search keywords" })).toBeNull()
    const btn = await screen.findByTestId("ok-filters-button")
    expect(btn.textContent).toContain("Filters")
    fireEvent.click(btn)
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search keywords" }), { target: { value: "eye" } })
    fireEvent.keyDown(within(dialog).getByRole("textbox", { name: "Search keywords" }), { key: "Enter" })
    await waitFor(() => expect(lastPageCall().query.filters).toEqual(["keyword_data.keyword", "like", "%eye%"]))
    expect(within(dialog).getByRole("button", { name: "Clear all" })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByTestId("ok-filters-button").textContent).toContain("1")
    expect(screen.getAllByTestId("ok-chip")).toHaveLength(1)
  })

  test("Keyword, Position and Traffic are the first columns, and the table scrolls sideways for the rest", async () => {
    window.innerWidth = 600
    renderPage()
    await screen.findAllByTestId("ok-row")
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(heads.slice(0, 3).map((h, i) => h.startsWith(["Keyword", "Position", "Traffic"][i]))).toEqual([true, true, true])
    expect(screen.getByTestId("ok-table").closest("[data-slot=table-container]").className).toMatch(/overflow-x-auto/)
  })
})

describe("Organic Keywords: switching project", () => {
  test("a new project starts from its own state: nothing from the previous project is kept", async () => {
    const { rerender } = renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(screen.getByRole("button", { name: `Details for ${REAL_ROWS[0].keyword}` }))
    expect(detailRegions()).toHaveLength(1)
    project.current = { _id: "p2", main_url: "https://example.org" }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    rerender(createElement(QueryClientProvider, { client }, createElement(OrganicKeywordsDashboard)))
    await waitFor(() => expect(calls().some((c) => c.pid === "p2")).toBe(true))
    expect(detailRegions()).toHaveLength(0)
  })
})

describe("Organic Keywords: every position range of the Domain Overview bars has a chip", () => {
  const POS = "ranked_serp_element.serp_item.rank_group"
  test.each([
    ["Top 1", "top1", [[POS, "<=", 1]]],
    ["2–3", "2-3", [[POS, ">=", 2], [POS, "<=", 3]]],
    ["4–10", "4-10", [[POS, ">=", 4], [POS, "<=", 10]]],
    ["11–20", "11-20", [[POS, ">=", 11], [POS, "<=", 20]]],
    ["21–50", "21-50", [[POS, ">=", 21], [POS, "<=", 50]]],
    ["51–100", "51-100", [[POS, ">=", 51], [POS, "<=", 100]]],
  ])("%s -> ?pos=%s", async (label, value, conds) => {
    window.history.replaceState(null, "", `/app/organic-keywords?pos=${value}`)
    renderPage()
    await screen.findAllByTestId("ok-row")
    const expected = conds.length === 1 ? conds[0] : [conds[0], "and", conds[1]]
    expect(lastPageCall().query.filters).toEqual(expected)
    expect(screen.getByText(`Position: ${label}`)).toBeTruthy()
  })
})

describe("Organic Keywords: Brand / Non-brand (the project's saved brand terms)", () => {
  const KW = "keyword_data.keyword"
  const withBrand = () => { brandSvc.data = { saved: true, brand_terms: ["asg", "asg eye hospital"], target_keywords: [] } }

  test("?brand=non adds one not_like per term (shortest first); the first page request waits for the terms and is sent once", async () => {
    withBrand()
    window.history.replaceState(null, "", "/app/organic-keywords?brand=non")
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(lastPageCall().query.filters).toEqual([[KW, "not_like", "%asg%"], "and", [KW, "not_like", "%asg eye hospital%"]])
    expect(pageCalls().every((c) => c.query.filters.length === 3)).toBe(true) // never an unfiltered page in between
    expect(screen.getByText("Non-brand keywords")).toBeTruthy()
  })

  test("?brand=only is ONE group of like conditions joined with \"or\" (wrapped, so it is not read as a triple)", async () => {
    withBrand()
    window.history.replaceState(null, "", "/app/organic-keywords?brand=only")
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(lastPageCall().query.filters).toEqual([[[KW, "like", "%asg%"], "or", [KW, "like", "%asg eye hospital%"]]])
    expect(screen.getByText("Brand keywords")).toBeTruthy()
  })

  test("with no saved brand terms the parameter changes nothing (no filter, no chip, no Brand row in the filters)", async () => {
    window.history.replaceState(null, "", "/app/organic-keywords?brand=non")
    renderPage()
    await screen.findAllByTestId("ok-row")
    expect(lastPageCall().query.filters).toEqual([])
    expect(screen.queryByText("Non-brand keywords")).toBeNull()
    expect(screen.queryByTestId("ok-filter-brand")).toBeNull()
  })

  test("the Brand chips appear only when terms are saved, and choosing one writes ?brand= and changes the request", async () => {
    withBrand()
    renderPage()
    await screen.findAllByTestId("ok-row")
    fireEvent.click(await screen.findByRole("button", { name: "Brand" }))
    await waitFor(() => expect(lastPageCall().query.filters[0]?.[0]?.[0]).toBe(KW))
    expect(window.location.search).toBe("?brand=only")
  })

  test("terms count toward the 8 conditions: 6 used at most, and a clash with other filters is reported, not sent", async () => {
    brandSvc.data = { saved: true, brand_terms: ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"], target_keywords: [] }
    window.history.replaceState(null, "", "/app/organic-keywords?brand=non&pos=11-20&vmin=1&vmax=9")
    renderPage()
    await screen.findByTestId("ok-too-many")
    expect(pageCalls().length).toBe(0)
  })
})
