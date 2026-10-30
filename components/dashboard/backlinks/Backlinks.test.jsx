import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hook (URL state, query keys, cancellation), request builder, mapping and components run.
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const exporter = vi.hoisted(() => ({ downloadBacklinksExport: vi.fn(), saveBlob: vi.fn() }))
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DEFAULT_HISTORY_MONTHS: 12,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
}))
vi.mock("./exportStream", async (importOriginal) => ({ ...(await importOriginal()), downloadBacklinksExport: exporter.downloadBacklinksExport, saveBlob: exporter.saveBlob }))
vi.mock("../referring-domains/exportCsv", async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: csv.downloadCsv }))
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

import BacklinksDashboard from "./BacklinksDashboard"
import { REAL_BROKEN, REAL_DEFAULT, REAL_LOST, REAL_NEW } from "./testFixtures"
import { REAL_LIVE as SUMMARY } from "../backlinks-overview/testFixtures"

const ok = (data) => ({ success: true, data })
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const envelope = (section, result, extra = {}) => ({ section, target: "asgeyehospital.com", fetchedAt: "2026-10-27T08:00:00.000Z", cached: false, refreshThrottled: false, result, ...extra })

const state = { total: 13591 }
/** A tiny fake of the server's backlinks-list section: tabs, token paging, the real rows cycled to any length. */
function listAnswer(req) {
  const isTab = (f) => Array.isArray(req.filters) && req.filters[0] === f
  const source = req.status === "lost" ? REAL_LOST : isTab("is_broken") ? REAL_BROKEN : isTab("is_new") ? REAL_NEW : REAL_DEFAULT
  const total = source === REAL_DEFAULT ? state.total : source.totalCount
  const start = req.token ? Number(req.token.slice(1)) : (req.offset ?? 0)
  const count = Math.max(0, Math.min(req.limit, total - start))
  const items = Array.from({ length: count }, (_, i) => ({ ...source.items[(start + i) % source.items.length], url_from: `https://src${start + i}.example.com/page`, domain_from: i === 0 && start === 0 ? source.items[0].domain_from : `src${start + i}.example.com` }))
  if (start === 0 && count) items[0] = { ...source.items[0] }
  return { totalCount: total, nextToken: start + count < total ? `T${start + count}` : null, items }
}

function serve(overrides = {}) {
  svc.getSection.mockImplementation(async (_pid, section, opts) => {
    if (section in overrides) { const r = overrides[section]; if (r instanceof Error) throw r; if (typeof r === "function") return r(opts); return ok(r) }
    if (section === "backlinks") return ok(envelope("backlinks", SUMMARY))
    if (section === "backlinks-list") return ok(envelope("backlinks-list", listAnswer(opts.backlinksList)))
    throw new Error(`unexpected section ${section}`)
  })
}

const calls = () => svc.getSection.mock.calls.map(([pid, section, opts, req]) => ({ pid, section, refresh: Boolean(opts?.refresh), list: opts?.backlinksList, signal: req?.signal }))
const listCalls = () => calls().filter((c) => c.section === "backlinks-list")
const lastList = () => listCalls().at(-1)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(BacklinksDashboard)))
}
const rowEls = () => screen.getAllByTestId("bl-row")
const showing = () => screen.getByTestId("bl-showing").textContent
const tab = (id) => screen.getByTestId(`bl-tab-${id}`)
const field = (name) => screen.getByRole("textbox", { name })
const chipsGroup = (testId, name) => within(screen.getByTestId(testId)).getByRole("button", { name })
const sortBtn = (key) => screen.getByTestId(`bl-sort-${key}`)

vi.setConfig({ testTimeout: 30000 })
beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 })
  vi.setConfig({ testTimeout: 30000 })
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  window.scrollTo = () => {}
  window.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
})
beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, "", "/app/backlinks/list")
  window.innerWidth = 1280
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  state.total = 13591
  serve()
})
afterEach(() => { vi.restoreAllMocks() })

describe("Backlinks: first load", () => {
  test("ONE list request (live, as_is, 50, rank desc, no filters) and the summary the Backlink Overview shares", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(listCalls()).toHaveLength(1)
    expect(lastList().list).toMatchObject({ status: "live", mode: "as_is", limit: 50, offset: 0, order_by: ["rank,desc"], filters: [] })
    expect(calls().filter((c) => c.section === "backlinks")).toHaveLength(1)
    expect(calls().filter((c) => c.section === "backlinks")[0].refresh).toBe(false)
  })

  test("the frame is there at once: title, domain, skeleton rows — no spinner page", () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Backlinks" })).toBeTruthy()
    expect(screen.getByTestId("bl-domain").textContent).toBe("asgeyehospital.com")
    expect(screen.getAllByTestId("bl-skeleton-row").length).toBeGreaterThanOrEqual(5)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("header: last updated, Refresh and Export", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(screen.getByTestId("bl-updated").textContent).toMatch(/^Last updated .*2026/)
    expect(screen.getByTestId("bl-refresh")).toBeTruthy()
    expect(screen.getByTestId("bl-export")).toBeTruthy()
  })

  test("asks for a project when none is selected, and requests nothing", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its backlinks.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
  })
})

describe("Backlinks: the table (real asgeyehospital.com rows)", () => {
  test("'Showing 1–50 of 13,591 backlinks'", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(rowEls()).toHaveLength(50)
    expect(showing()).toBe("Showing 1–50 of 13,591 backlinks")
  })

  test("source: the title in bold linking out in a new tab, the URL without its protocol underneath, favicon and flag", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    const row = rowEls()[0]
    const link = within(row).getByTestId("bl-source-link")
    expect(within(row).getByTestId("bl-source-title").textContent).toBe("Retina Eye Surgery: An Overview")
    expect(link.getAttribute("href")).toMatch(/^https:\/\/articlescad\.com\//)
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(within(row).getByTestId("bl-source-url").textContent).toMatch(/^articlescad\.com\/15-amazing-facts/)
    expect(row.querySelector("img").getAttribute("src")).toBe("https://www.google.com/s2/favicons?domain=articlescad.com&sz=32")
    expect(within(row).getByTitle("United States").textContent).toBe("🇺🇸")
  })

  test("anchor, target (path with the full URL in the tooltip, and the redirect underneath), follow, ranks, spam, dates", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    const row = rowEls()[0]
    expect(within(row).getByTestId("bl-anchor").textContent).toBe("Retina Eye Surgery")
    expect(within(row).queryByTestId("bl-type-chip")).toBeNull() // a text link has no type chip
    expect(within(row).getByTestId("bl-target-path").textContent).toBe("/specialities/retina-diseases/")
    expect(within(row).getByTestId("bl-target-path").getAttribute("title")).toBe("https://asgeyehospital.com/specialities/retina-diseases/")
    expect(within(row).getByTestId("bl-target-redirect").textContent).toBe("→ www.asgeyehospital.com/specialities/retina-diseases/")
    expect(within(row).getByTestId("bl-follow").textContent).toBe("Dofollow")
    const ranks = within(row).getAllByTestId("bl-rank")
    expect(ranks.map((r) => r.textContent)).toEqual(["542", "238"])
    expect(ranks[0].getAttribute("title")).toBe("Domain rank: 542 out of 1,000")
    expect(within(row).getByTestId("bl-spam").getAttribute("data-band")).toBe("low")
    expect(within(row).getByTestId("bl-spam").textContent).toBe("10Low")
    expect(within(row).getByText("May 5, 2026").getAttribute("title")).toMatch(/^May 5, 2026, 12:25 PM UTC/)
    expect(within(row).getByText("May 14, 2026")).toBeTruthy()
    expect(within(row).queryByTestId("bl-status")).toBeNull()
  })

  test("a missing value is '—'; a nofollow link, an image link and a link with no anchor look right (constructed rows)", async () => {
    const item = (o) => ({ ...REAL_DEFAULT.items[0], ...o })
    serve({ "backlinks-list": () => ok(envelope("backlinks-list", { totalCount: 4, nextToken: null, items: [
      item({ url_from: "https://a.com/1", dofollow: false, attributes: ["nofollow", "ugc", "sponsored"], semantic_location: "footer", domain_from_rank: null, backlink_spam_score: 45, anchor: null, item_type: "anchor" }),
      item({ url_from: "https://a.com/2", item_type: "image", anchor: null, alt: "Eye surgeon", is_new: true }),
      item({ url_from: "https://a.com/3", page_from_title: null, url_to_redirect_target: null, url_to_status_code: 200 }),
      item({ url_from: "https://a.com/4", is_lost: true, is_broken: true, url_to_status_code: 404 }),
    ] })) })
    renderPage()
    await screen.findAllByTestId("bl-row")
    const [r1, r2, r3, r4] = rowEls()
    expect(within(r1).getByTestId("bl-follow").textContent).toBe("Nofollowugcsponsored")
    expect(within(r1).getByTestId("bl-placement").textContent).toBe("Footer")
    expect(within(r1).getByTestId("bl-anchor").textContent).toBe("(no anchor text)")
    expect(within(r1).getByTestId("bl-spam").getAttribute("data-band")).toBe("high")
    expect(within(r1).getAllByTestId("bl-rank")).toHaveLength(1) // the missing domain rank is "—", not a bar
    expect(within(r1).getAllByText("—").length).toBeGreaterThanOrEqual(2)
    expect(within(r2).getByTestId("bl-anchor").textContent).toBe("Eye surgeonImage")
    expect(within(r2).getByTestId("bl-type-chip").textContent).toBe("Image")
    expect(within(r2).getByTestId("bl-status").textContent).toBe("NEW")
    expect(within(r3).getByTestId("bl-source-title").textContent).toMatch(/^a\.com\/3$/) // no title: the URL stands in
    expect(within(r3).queryByTestId("bl-target-redirect")).toBeNull()
    expect(within(r4).getByTestId("bl-status").textContent).toBe("LOSTBROKEN 404")
    for (const r of rowEls()) expect(r.textContent).not.toMatch(/NaN|undefined|\bnull\b/)
  })

  test("the headers explain themselves (info icons) and the default sort is stated", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(screen.getByRole("button", { name: "About Domain Rank" })).toBeTruthy()
    expect(screen.getByTestId("bl-sort-note").textContent).toMatch(/^Sorted by link rank, strongest first/)
  })
})

describe("Backlinks: tabs, group by and their counts", () => {
  test("Broken: live + is_broken, domain rank first, the banner, and the Suggested fix column", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(tab("broken"))
    await waitFor(() => expect(lastList().list).toMatchObject({ status: "live", filters: ["is_broken", "=", true], order_by: ["domain_from_rank,desc"] }))
    expect((await screen.findByTestId("bl-broken-banner")).textContent).toBe("1,601 backlinks point to URLs that return errors. Fix them with 301 redirects to the closest live page, or fix the server response.")
    await waitFor(() => expect(within(rowEls()[0]).getByTestId("bl-fix")).toBeTruthy())
    expect(within(rowEls()[0]).getByTestId("bl-fix").textContent).toBe("Server/CDN is blocking access — check firewall or bot protection")
    expect(within(rowEls()[0]).getByTestId("bl-status").textContent).toBe("BROKEN 403")
    expect(screen.getByRole("columnheader", { name: /Suggested fix/ })).toBeTruthy()
    expect(window.location.search).toBe("?tab=broken")
  })

  test("?broken=true (the Backlink Overview's link) opens the Broken tab straight away", async () => {
    window.history.replaceState(null, "", "/app/backlinks/list?broken=true")
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(listCalls()).toHaveLength(1)
    expect(lastList().list.filters).toEqual(["is_broken", "=", true])
    expect(tab("broken").getAttribute("aria-selected")).toBe("true")
  })

  test("Lost is status lost; New is live + is_new; other tabs have no Broken extras", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(tab("lost"))
    await waitFor(() => expect(lastList().list).toMatchObject({ status: "lost", filters: [] }))
    await waitFor(() => expect(showing()).toBe("Showing 1–50 of 3,172 backlinks"))
    expect(screen.queryByTestId("bl-broken-banner")).toBeNull()
    expect(screen.queryByRole("columnheader", { name: /Suggested fix/ })).toBeNull()
    fireEvent.click(tab("new"))
    await waitFor(() => expect(lastList().list).toMatchObject({ status: "live", filters: ["is_new", "=", true] }))
  })

  test("a tab shows its count only once it has been loaded; unopened tabs have none and are never fetched ahead of time", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    await waitFor(() => expect(screen.getByTestId("bl-tab-all-count").textContent).toBe("13,591"))
    for (const t of ["new", "lost", "broken"]) expect(screen.queryByTestId(`bl-tab-${t}-count`)).toBeNull()
    expect(listCalls()).toHaveLength(1)
    fireEvent.click(tab("broken"))
    await waitFor(() => expect(screen.getByTestId("bl-tab-broken-count").textContent).toBe("1,601"))
    expect(screen.getByTestId("bl-tab-all-count").textContent).toBe("13,591") // remembered
    expect(screen.queryByTestId("bl-tab-lost-count")).toBeNull()
    expect(listCalls()).toHaveLength(2)
  })

  test("a tab's count belongs to the current group and filters: changing them forgets it", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    await waitFor(() => expect(screen.getByTestId("bl-tab-all-count")).toBeTruthy())
    fireEvent.change(screen.getByTestId("bl-group"), { target: { value: "domain" } })
    await waitFor(() => expect(lastList().list.mode).toBe("one_per_domain"))
    await waitFor(() => expect(screen.getByTestId("bl-showing")).toBeTruthy())
    // the "All" count is for one_per_domain now; the old (as_is) number is not shown against it
    await waitFor(() => expect(screen.getByTestId("bl-tab-all-count").textContent).toBe("13,591"))
    expect(window.location.search).toBe("?group=domain")
  })

  test("Group by sends the mode: one per domain, one per anchor, and back to all links", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.change(screen.getByTestId("bl-group"), { target: { value: "anchor" } })
    await waitFor(() => expect(lastList().list.mode).toBe("one_per_anchor"))
    fireEvent.change(screen.getByTestId("bl-group"), { target: { value: "all" } })
    await waitFor(() => expect(window.location.search).toBe(""))
    expect(listCalls()).toHaveLength(2) // the first view was cached
  })

  test("the view is read from the URL on open", async () => {
    window.history.replaceState(null, "", "/app/backlinks/list?tab=lost&group=domain&follow=dofollow&sort=first_seen:asc&size=25&page=1")
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(lastList().list).toMatchObject({ status: "lost", mode: "one_per_domain", limit: 25, order_by: ["first_seen,asc"], filters: ["dofollow", "=", true] })
    expect(tab("lost").getAttribute("aria-selected")).toBe("true")
    expect(screen.getByTestId("bl-group").value).toBe("domain")
  })
})

describe("Backlinks: filters (server-side, debounced, limited to 8)", () => {
  test("search source: 3 keystrokes make ONE request, 400 ms after the last; it is a 'like' on url_from", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    const input = field("Search source")
    fireEvent.change(input, { target: { value: "n" } })
    fireEvent.change(input, { target: { value: "ne" } })
    fireEvent.change(input, { target: { value: "news" } })
    await sleep(150)
    expect(listCalls()).toHaveLength(1)
    await waitFor(() => expect(listCalls()).toHaveLength(2), { timeout: 3000 })
    expect(lastList().list.filters).toEqual(["url_from", "like", "%news%"])
    expect(window.location.search).toBe("?q=news")
  })

  test("anchor and target URL contain-filters, and Enter applies at once", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.change(field("Anchor contains"), { target: { value: "eye hospital" } })
    fireEvent.keyDown(field("Anchor contains"), { key: "Enter" })
    await waitFor(() => expect(lastList().list.filters).toEqual(["anchor", "like", "%eye hospital%"]))
    fireEvent.change(field("Target URL contains"), { target: { value: "/hospital/" } })
    fireEvent.blur(field("Target URL contains"))
    await waitFor(() => expect(lastList().list.filters).toEqual([["anchor", "like", "%eye hospital%"], "and", ["url_to", "like", "%/hospital/%"]]))
  })

  test("numbers apply on blur or Enter only; a wrong one is explained and not sent", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    const rank = screen.getByRole("textbox", { name: "Minimum domain rank" })
    fireEvent.change(rank, { target: { value: "2" } })
    fireEvent.change(rank, { target: { value: "25" } })
    fireEvent.change(rank, { target: { value: "250" } })
    await sleep(600)
    expect(listCalls()).toHaveLength(1)
    fireEvent.blur(rank)
    await waitFor(() => expect(lastList().list.filters).toEqual(["domain_from_rank", ">=", 250]))
    const spam = screen.getByRole("textbox", { name: "Maximum spam score" })
    fireEvent.change(spam, { target: { value: "500" } })
    fireEvent.keyDown(spam, { key: "Enter" })
    expect(await screen.findByText("Spam score: enter a whole number from 0 to 100.")).toBeTruthy()
    expect(listCalls()).toHaveLength(2) // that one was not sent: only the rank filter is
    fireEvent.change(spam, { target: { value: "30" } })
    fireEvent.keyDown(spam, { key: "Enter" })
    await waitFor(() => expect(lastList().list.filters).toEqual([["domain_from_rank", ">=", 250], "and", ["backlink_spam_score", "<=", 30]]))
  })

  test("link type chips, item type and placement multi-selects, hide spammy and the date", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(chipsGroup("bl-filter-follow", "Nofollow"))
    await waitFor(() => expect(lastList().list.filters).toEqual(["dofollow", "=", false]))
    fireEvent.click(chipsGroup("bl-filter-types", "Image"))
    fireEvent.click(chipsGroup("bl-filter-types", "Text"))
    await waitFor(() => expect(lastList().list.filters).toContainEqual(["item_type", "in", ["anchor", "image"]]))
    fireEvent.click(chipsGroup("bl-filter-placement", "Footer"))
    await waitFor(() => expect(lastList().list.filters).toContainEqual(["semantic_location", "in", ["footer"]]))
    fireEvent.click(screen.getByTestId("bl-hide-spammy"))
    await waitFor(() => expect(lastList().list.filters).toContainEqual(["backlink_spam_score", "<", 30]))
    const since = screen.getByTestId("bl-since")
    fireEvent.change(since, { target: { value: "2025-01-15" } })
    fireEvent.blur(since)
    await waitFor(() => expect(lastList().list.filters).toContainEqual(["first_seen", ">=", "2025-01-15"]))
    expect(lastList().list.filters.filter((c) => Array.isArray(c) && c.length === 3)).toHaveLength(5)
  })

  test("source country: type a name, pick it; the filter is the country code, and it can be removed", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.change(within(screen.getByTestId("bl-filter-country")).getByRole("combobox"), { target: { value: "indi" } })
    fireEvent.click(await screen.findByRole("option", { name: /India(?!n)/ }).then((o) => within(o).getByRole("button")))
    await waitFor(() => expect(lastList().list.filters).toEqual(["domain_from_country", "in", ["IN"]]))
    fireEvent.change(within(screen.getByTestId("bl-filter-country")).getByRole("combobox"), { target: { value: "united st" } })
    fireEvent.click(within(await screen.findByRole("option", { name: /United States/ })).getByRole("button"))
    await waitFor(() => expect(lastList().list.filters).toEqual(["domain_from_country", "in", ["IN", "US"]]))
    fireEvent.click(screen.getByRole("button", { name: "Remove India" }))
    await waitFor(() => expect(lastList().list.filters).toEqual(["domain_from_country", "in", ["US"]]))
  })

  test("applied filters are removable chips, plus 'Clear all'; going back to a view already loaded is not a request", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(chipsGroup("bl-filter-follow", "Dofollow"))
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    fireEvent.click(screen.getByTestId("bl-hide-spammy"))
    await waitFor(() => expect(listCalls()).toHaveLength(3))
    const chips = screen.getAllByTestId("ok-chip")
    expect(chips.map((c) => c.textContent)).toEqual(["Dofollow", "Spammy links hidden"])
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Spammy links hidden" }))
    await waitFor(() => expect(screen.getAllByTestId("ok-chip").map((c) => c.textContent)).toEqual(["Dofollow"]))
    expect(listCalls()).toHaveLength(3) // the dofollow-only view was already loaded
    fireEvent.click(screen.getByTestId("ok-clear-all"))
    await waitFor(() => expect(window.location.search).toBe(""))
    expect(screen.queryAllByTestId("ok-chip")).toHaveLength(0)
    expect(listCalls()).toHaveLength(3) // the unfiltered view was already loaded
  })

  test("at most 8 conditions, counting the tab's own: the 9th is refused with a message and NOTHING is sent", async () => {
    window.history.replaceState(null, "", "/app/backlinks/list?q=a&anchor=b&target=c&follow=dofollow&types=image&place=footer&rank=5&spam=40")
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(listCalls()).toHaveLength(1)
    expect(lastList().list.filters).toHaveLength(15) // 8 conditions joined with 7 "and"
    fireEvent.click(screen.getByTestId("bl-hide-spammy"))
    expect((await screen.findByTestId("bl-too-many")).textContent).toBe("Max 8 filters — remove one to add another")
    await sleep(200)
    expect(listCalls()).toHaveLength(1)
    expect(rowEls().length).toBe(50) // the rows stay
    expect(screen.getByTestId("bl-results").querySelector("[aria-busy=true]")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Spammy links hidden" }))
    await waitFor(() => expect(screen.queryByTestId("bl-too-many")).toBeNull())
  })

  test("the tab's filter counts: 7 filters + the Broken tab is fine, and one more is not", async () => {
    window.history.replaceState(null, "", "/app/backlinks/list?tab=broken&q=a&anchor=b&target=c&follow=dofollow&types=image&place=footer&rank=5")
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(lastList().list.filters.filter((c) => Array.isArray(c) && c.length === 3)).toHaveLength(8)
    fireEvent.click(screen.getByTestId("bl-hide-spammy"))
    expect((await screen.findByTestId("bl-too-many")).textContent).toMatch(/Max 8 filters/)
    expect(listCalls()).toHaveLength(1)
  })
})

describe("Backlinks: sorting (server-side, up to 3 rules)", () => {
  test("a header sorts by its field, a second click flips it, another column replaces it", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(sortBtn("domainRank"))
    await waitFor(() => expect(lastList().list.order_by).toEqual(["domain_from_rank,desc"]))
    fireEvent.click(sortBtn("domainRank"))
    await waitFor(() => expect(lastList().list.order_by).toEqual(["domain_from_rank,asc"]))
    expect(screen.getByRole("columnheader", { name: /Domain Rank/ }).getAttribute("aria-sort")).toBe("ascending")
    fireEvent.click(sortBtn("spam"))
    await waitFor(() => expect(lastList().list.order_by).toEqual(["backlink_spam_score,asc"]))
    expect(screen.getByTestId("bl-sort-note").textContent).toMatch(/^Sorted by your choice/)
  })

  test("shift-click adds a secondary (and tertiary) sort; a 4th is ignored; the numbers show the order; it is in the URL", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(sortBtn("domainRank"))
    fireEvent.click(sortBtn("firstSeen"), { shiftKey: true })
    fireEvent.click(sortBtn("spam"), { shiftKey: true })
    await waitFor(() => expect(lastList().list.order_by).toEqual(["domain_from_rank,desc", "first_seen,desc", "backlink_spam_score,asc"]))
    expect(window.location.search).toBe("?sort=domain_from_rank%3Adesc%2Cfirst_seen%3Adesc%2Cbacklink_spam_score%3Aasc")
    fireEvent.click(sortBtn("lastSeen"), { shiftKey: true })
    await sleep(100)
    expect(lastList().list.order_by).toHaveLength(3)
    expect(within(sortBtn("firstSeen")).getByText("2")).toBeTruthy()
    fireEvent.click(sortBtn("firstSeen"), { shiftKey: true }) // shift-click on one already there flips just that rule
    await waitFor(() => expect(lastList().list.order_by).toEqual(["domain_from_rank,desc", "first_seen,asc", "backlink_spam_score,asc"]))
  })

  test("the Broken tab starts sorted by domain rank (the most valuable broken links first) and shows it", async () => {
    window.history.replaceState(null, "", "/app/backlinks/list?tab=broken")
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(lastList().list.order_by).toEqual(["domain_from_rank,desc"])
    expect(screen.getByRole("columnheader", { name: /Domain Rank/ }).getAttribute("aria-sort")).toBe("descending")
  })
})

describe("Backlinks: paging", () => {
  test("page size, next page and 'Go to page' are server offsets", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.change(screen.getByTestId("bl-page-size"), { target: { value: "25" } })
    await waitFor(() => expect(lastList().list).toMatchObject({ limit: 25, offset: 0 }))
    await screen.findAllByTestId("bl-row")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(lastList().list).toMatchObject({ limit: 25, offset: 25 }))
    await waitFor(() => expect(showing()).toMatch(/^Showing 26–50 of 13,591/))
    fireEvent.change(document.getElementById("bl-goto"), { target: { value: "9" } })
    fireEvent.click(screen.getByRole("button", { name: "Go" }))
    await waitFor(() => expect(lastList().list.offset).toBe(200))
    expect(window.location.search).toBe("?page=9&size=25")
  })

  test("with 13,591 links nothing about 'Load more' is shown: every page is reachable by number", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(screen.queryByTestId("bl-load-more-box")).toBeNull()
    expect(screen.queryByTestId("bl-window-note")).toBeNull()
  })

  test("past 20,000 links: numbered pages up to offset + limit = 20,000, then 'Load more' with the previous response's token and everything else identical", async () => {
    state.total = 25000
    window.history.replaceState(null, "", "/app/backlinks/list?page=200&size=100&follow=dofollow&sort=first_seen:asc&group=domain")
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect(lastList().list).toMatchObject({ offset: 19900, limit: 100 })
    expect(showing()).toBe("Showing 19,901–20,000 of 25,000 backlinks")
    const button = await screen.findByTestId("bl-load-more")
    expect(within(screen.getByTestId("bl-load-more-box")).getByRole("button", { name: "About Load more" })).toBeTruthy()
    fireEvent.click(button)
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(lastList().list).toMatchObject({ token: "T20000", offset: 0, limit: 100, mode: "one_per_domain", order_by: ["first_seen,asc"], filters: ["dofollow", "=", true] })
    await waitFor(() => expect(rowEls()).toHaveLength(200))
    expect(showing()).toBe("Showing 19,901–20,100 of 25,000 backlinks")
    fireEvent.click(await screen.findByTestId("bl-load-more"))
    await waitFor(() => expect(lastList().list.token).toBe("T20100"))
    await waitFor(() => expect(rowEls()).toHaveLength(300))
  })

  test("a change of view drops what 'Load more' added; the end of the list is said, not offered", async () => {
    state.total = 20050
    window.history.replaceState(null, "", "/app/backlinks/list?page=200&size=100")
    renderPage()
    fireEvent.click(await screen.findByTestId("bl-load-more"))
    await waitFor(() => expect(rowEls()).toHaveLength(150))
    expect((await screen.findByTestId("bl-end-of-list")).textContent).toMatch(/every backlink the data provider can list/)
    expect(screen.queryByTestId("bl-load-more")).toBeNull()
    fireEvent.click(tab("lost"))
    await waitFor(() => expect(rowEls()).toHaveLength(100)) // the lost view's own first page, not 150
  })

  test("a page number beyond the window (a hand-edited link) is brought back to the last numbered page", async () => {
    state.total = 25000
    window.history.replaceState(null, "", "/app/backlinks/list?page=900&size=100")
    renderPage()
    await waitFor(() => expect(lastList().list.offset).toBe(19900))
    expect(window.location.search).toBe("?page=200&size=100")
  })

  test("a failing 'Load more' says why and offers Retry", async () => {
    state.total = 25000
    window.history.replaceState(null, "", "/app/backlinks/list?page=200&size=100")
    const base = svc.getSection.getMockImplementation()
    let fail = true
    svc.getSection.mockImplementation(async (...a) => { if (a[2].backlinksList?.token && fail) throw apiError("The data service is busy. Please wait a minute and try again.", { status: 429 }); return base(...a) })
    renderPage()
    fireEvent.click(await screen.findByTestId("bl-load-more"))
    expect((await screen.findByTestId("bl-load-more-box")).textContent).toMatch(/busy/)
    fail = false
    fireEvent.click(within(screen.getByTestId("bl-load-more-box")).getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(rowEls()).toHaveLength(200))
  })
})

describe("Backlinks: the expandable row", () => {
  test("opens the link context (the sentence with the anchor in bold), source, target and history details, and the three buttons", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(within(rowEls()[0]).getByRole("button", { name: /^Details for the link from articlescad\.com/ }))
    const panel = await screen.findByTestId("bl-expanded")
    expect(within(panel).getByTestId("bl-context-anchor").textContent).toBe("Retina Eye Surgery")
    expect(within(panel).getByTestId("bl-context-anchor").tagName).toBe("STRONG")
    expect(within(panel).getByTestId("bl-context-text").textContent).toMatch(/Retina Eye Surgery.*refers to a group of specialized surgical procedures/)
    const source = within(panel).getByTestId("bl-source-details")
    expect(source.textContent).toContain("en")
    expect(source.textContent).toContain("🇺🇸 United States")
    expect(source.textContent).toContain("212.132.102.82")
    expect(source.textContent).toContain("Unknown")
    expect(within(panel).getByRole("button", { name: "About External links on the source page" })).toBeTruthy()
    const target = within(panel).getByTestId("bl-target-details")
    expect(within(target).getByTestId("bl-target-status").textContent).toBe("Status code301")
    expect(target.textContent).toContain("https://www.asgeyehospital.com/specialities/retina-diseases/")
    const history = within(panel).getByTestId("bl-history")
    expect(history.textContent).toContain("May 5, 2026")
    expect(history.textContent).toContain("May 14, 2026")
    expect(history.textContent).toMatch(/OriginalNo|Original.*No/)
    expect(within(panel).getByTestId("bl-open-source").getAttribute("href")).toMatch(/^https:\/\/articlescad\.com/)
    expect(within(panel).getByTestId("bl-open-source").getAttribute("target")).toBe("_blank")
    expect(within(panel).getByTestId("bl-open-target").getAttribute("href")).toBe("https://asgeyehospital.com/specialities/retina-diseases/")
    expect(within(panel).queryByTestId("bl-indirect")).toBeNull()
  })

  test("'View all links from this domain' filters by that source domain", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(within(rowEls()[0]).getByRole("button", { name: /^Details for/ }))
    fireEvent.click(await screen.findByTestId("bl-view-domain"))
    await waitFor(() => expect(lastList().list.filters).toEqual(["domain_from", "=", "articlescad.com"]))
    expect(screen.getAllByTestId("ok-chip").map((c) => c.textContent)).toContain("From articlescad.com")
    expect(window.location.search).toBe("?from=articlescad.com")
  })

  test("an indirect link shows its chain; a row with no context says so; only one row is open, and it closes when the view changes", async () => {
    const item = (o) => ({ ...REAL_DEFAULT.items[0], ...o })
    serve({ "backlinks-list": () => ok(envelope("backlinks-list", { totalCount: 2, nextToken: null, items: [
      item({ url_from: "https://a.com/1", is_indirect_link: true, indirect_link_path: ["https://hop1.com/", "https://hop2.com/"], text_post: null }),
      item({ url_from: "https://a.com/2" }),
    ] })) })
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(within(rowEls()[0]).getByRole("button", { name: /^Details for/ }))
    const panel = await screen.findByTestId("bl-expanded")
    expect(within(within(panel).getByTestId("bl-indirect")).getAllByRole("listitem").map((l) => l.textContent)).toEqual(["https://hop1.com/", "https://hop2.com/"])
    expect(within(panel).getByTestId("bl-context-text").textContent).toMatch(/^No surrounding text was recorded/)
    fireEvent.click(within(rowEls()[1]).getByRole("button", { name: /^Details for/ }))
    await waitFor(() => expect(screen.getAllByTestId("bl-expanded")).toHaveLength(1))
    expect(within(screen.getByTestId("bl-expanded")).queryByTestId("bl-indirect")).toBeNull()
    fireEvent.click(chipsGroup("bl-filter-follow", "Dofollow"))
    await waitFor(() => expect(screen.queryAllByTestId("bl-expanded")).toHaveLength(0))
  })

  test("a click on the row opens it; a click on its link does not", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(within(rowEls()[0]).getByTestId("bl-source-link"))
    expect(screen.queryAllByTestId("bl-expanded")).toHaveLength(0)
    fireEvent.click(within(rowEls()[0]).getByTestId("bl-target-path"))
    expect(await screen.findAllByTestId("bl-expanded")).toHaveLength(1)
  })
})

describe("Backlinks: the summary strip (the Backlink Overview's own response)", () => {
  test("total backlinks, referring domains, broken backlinks and dofollow %, and why the list is shorter than the total", async () => {
    renderPage()
    await screen.findByTestId("bl-sum-total")
    expect(screen.getByTestId("bl-sum-total").textContent).toContain("18.3K")
    expect(screen.getByTestId("bl-sum-domains").textContent).toContain("4K")
    expect(screen.getByTestId("bl-sum-broken").textContent).toContain("1.6K")
    expect(screen.getByTestId("bl-sum-dofollow").textContent).toContain("88.6%")
    expect(screen.getByTestId("bl-summary-note").textContent).toMatch(/one row per linking page \(13,590\)/)
    expect(calls().filter((c) => c.section === "backlinks")).toHaveLength(1)
  })

  test("each number applies its tab or filter", async () => {
    renderPage()
    await screen.findByTestId("bl-sum-total")
    fireEvent.click(screen.getByTestId("bl-sum-broken"))
    await waitFor(() => expect(lastList().list.filters).toEqual(["is_broken", "=", true]))
    expect(tab("broken").getAttribute("aria-selected")).toBe("true")
    fireEvent.click(screen.getByTestId("bl-sum-domains"))
    await waitFor(() => expect(lastList().list).toMatchObject({ mode: "one_per_domain", filters: [] }))
    expect(screen.getByTestId("bl-group").value).toBe("domain")
    fireEvent.click(screen.getByTestId("bl-sum-dofollow"))
    await waitFor(() => expect(lastList().list.filters).toEqual(["dofollow", "=", true]))
    fireEvent.click(screen.getByTestId("bl-sum-total"))
    await waitFor(() => expect(window.location.search).toBe(""))
  })

  test("a failing summary does not take the table down", async () => {
    serve({ backlinks: apiError("The data service is busy.", { status: 429 }) })
    renderPage()
    await screen.findAllByTestId("bl-row")
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/busy/)
  })
})

describe("Backlinks: cancelling and refreshing", () => {
  test("a request still running when the view changes is cancelled, and its answer never replaces the newer one", async () => {
    let release
    const gate = new Promise((r) => { release = r })
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[2].backlinksList?.status === "lost") await gate; return base(...a) })
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(tab("lost")) // slow
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    const slow = lastList().signal
    expect(slow.aborted).toBe(false)
    expect(rowEls().length).toBe(50) // previous rows stay on screen
    expect(screen.getByTestId("bl-results").querySelector("[aria-busy=true]")).toBeTruthy()
    fireEvent.click(tab("new"))
    await waitFor(() => expect(slow.aborted).toBe(true))
    release()
    await sleep(60)
    await waitFor(() => expect(tab("new").getAttribute("aria-selected")).toBe("true"))
    expect(showing()).toMatch(/of 8,184/) // the New tab's total, not the lost one's 3,172
  })

  test("Refresh asks the server to skip its cache, and a declined refresh says so", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(screen.getByTestId("bl-refresh"))
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(lastList().refresh).toBe(true)
    expect(listCalls()[0].refresh).toBe(false)
  })

  test("a refresh the server declined (data under a minute old) says so", async () => {
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { const r = await base(...a); if (a[1] === "backlinks-list" && a[2].refresh) r.data.refreshThrottled = true; return r })
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(screen.getByTestId("bl-refresh"))
    expect(await screen.findByText(/refreshed less than a minute ago/)).toBeTruthy()
  })
})

describe("Backlinks: states", () => {
  test("a failed list is an inline error with Retry", async () => {
    let fail = true
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[1] === "backlinks-list" && fail) throw apiError("The data service is temporarily unavailable. Please try again later."); return base(...a) })
    renderPage()
    const alert = await within(await screen.findByTestId("bl-results")).findByRole("alert")
    expect(alert.textContent).toMatch(/temporarily unavailable/)
    fail = false
    fireEvent.click(within(alert).getByRole("button", { name: /Retry/ }))
    await screen.findAllByTestId("bl-row")
    expect(listCalls()).toHaveLength(2)
  })

  test("no backlinks at all: 'No backlinks found for this domain yet.'", async () => {
    serve({ "backlinks-list": ok(envelope("backlinks-list", { totalCount: 0, nextToken: null, items: [] })) })
    renderPage()
    expect((await screen.findByTestId("bl-empty")).textContent).toBe("No backlinks found for this domain yet.")
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull()
  })

  test("no match for the filters: 'No backlinks match these filters' with Clear filters, which brings the rows back", async () => {
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => (a[2].backlinksList?.filters?.length ? ok(envelope("backlinks-list", { totalCount: 0, nextToken: null, items: [] })) : base(...a)))
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(chipsGroup("bl-filter-follow", "Nofollow"))
    const empty = await screen.findByTestId("bl-empty")
    expect(empty.textContent).toContain("No backlinks match these filters")
    fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }))
    await screen.findAllByTestId("bl-row")
    expect(window.location.search).toBe("")
  })

  test("empty Broken tab is a green success; empty Lost is 'No lost backlinks.'", async () => {
    window.history.replaceState(null, "", "/app/backlinks/list?tab=broken")
    serve({ "backlinks-list": ok(envelope("backlinks-list", { totalCount: 0, nextToken: null, items: [] })) })
    renderPage()
    const empty = await screen.findByTestId("bl-empty")
    expect(empty.textContent).toBe("No broken backlinks found.")
    expect(empty.getAttribute("data-kind")).toBe("success")
    expect(empty.className).toContain("emerald")
    fireEvent.click(tab("lost"))
    await waitFor(() => expect(screen.getByTestId("bl-empty").textContent).toBe("No lost backlinks."))
    fireEvent.click(tab("new"))
    await waitFor(() => expect(screen.getByTestId("bl-empty").textContent).toBe("No new backlinks."))
  })

  test("a project whose URL has no public domain name gets a plain explanation", async () => {
    serve({ "backlinks-list": apiError("The project's website does not have a public domain name", { status: 422, code: "INVALID_TARGET" }) })
    renderPage()
    expect(await screen.findByText(/does not have a public domain name, so its backlinks cannot be loaded/)).toBeTruthy()
  })
})

describe("Backlinks: export", () => {
  test("Export current page: the rows on screen as a CSV, no request", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    const before = calls().length
    fireEvent.click(screen.getByTestId("bl-export-page"))
    expect(csv.downloadCsv).toHaveBeenCalledTimes(1)
    const [name, content] = csv.downloadCsv.mock.calls[0]
    expect(name).toMatch(/^backlinks_asgeyehospital\.com_all_page_\d{4}-\d{2}-\d{2}\.csv$/)
    expect(content.split("\r\n")).toHaveLength(51)
    expect(content.split("\r\n")[0]).toMatch(/^Source URL,Source title,Source domain,Domain rank,Page rank,Anchor/)
    expect(calls()).toHaveLength(before)
    expect(await screen.findByText("Exported 50 backlinks from this page.")).toBeTruthy()
  })

  test("Export with current filters: nothing is bought before the user confirms — the count, the 10,000 cap and the estimated cost come first", async () => {
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(screen.getByTestId("bl-export-all"))
    const dialog = await screen.findByTestId("bl-export-dialog")
    expect(within(dialog).getByTestId("bl-export-rows").textContent).toBe("10,000")
    expect(dialog.textContent).toContain("the first 10,000 by the current sort — 13,591 match")
    expect(within(dialog).getByTestId("bl-export-cost").textContent).toMatch(/10 requests of up to 1,000 rows, which costs about \$0\.40 \(an estimate\)/)
    expect(exporter.downloadBacklinksExport).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByTestId("bl-export-dialog")).toBeNull())
    expect(exporter.downloadBacklinksExport).not.toHaveBeenCalled()
  })

  test("a small export: all rows, one request, and the cost says so", async () => {
    state.total = 640
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(screen.getByTestId("bl-export-all"))
    const dialog = await screen.findByTestId("bl-export-dialog")
    expect(within(dialog).getByTestId("bl-export-rows").textContent).toBe("640")
    expect(dialog.textContent).not.toContain("the first")
    expect(within(dialog).getByTestId("bl-export-cost").textContent).toMatch(/1 request of up to 1,000 rows, which costs about \$0\.03/)
  })

  test("Confirm: the server export runs with the page's own tab / group / sort / filters; progress is shown; the file is saved when it arrives whole", async () => {
    window.history.replaceState(null, "", "/app/backlinks/list?tab=lost&group=domain&follow=dofollow&sort=first_seen:asc&page=3")
    let resolve
    exporter.downloadBacklinksExport.mockImplementation((_pid, _params, { onStart, onProgress }) => new Promise((res) => {
      onStart({ rows: 3172, batches: 4 })
      onProgress(1000)
      resolve = (rows) => res({ blob: new Blob(["x"]), rows, expected: 3172 })
    }))
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(screen.getByTestId("bl-export-all"))
    fireEvent.click(await screen.findByTestId("bl-export-start"))
    await waitFor(() => expect(exporter.downloadBacklinksExport).toHaveBeenCalledTimes(1))
    const [pid, params] = exporter.downloadBacklinksExport.mock.calls[0]
    expect(pid).toBe("p1")
    expect(params.maxRows).toBe(3172)
    expect(params.request).toMatchObject({ status: "lost", mode: "one_per_domain", order_by: ["first_seen,asc"], filters: ["dofollow", "=", true] })
    expect(params.request.token).toBeUndefined()
    expect((await screen.findByTestId("bl-export-progress")).textContent).toContain("1,000 of 3,172 backlinks")
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("32")
    expect(exporter.saveBlob).not.toHaveBeenCalled()
    resolve(3172)
    expect((await screen.findByTestId("bl-export-done")).textContent).toContain("Exported 3,172 backlinks")
    expect(exporter.saveBlob).toHaveBeenCalledTimes(1)
    expect(exporter.saveBlob.mock.calls[0][1]).toMatch(/^backlinks_asgeyehospital\.com_lost_all_\d{4}-\d{2}-\d{2}\.csv$/)
  })

  test("Cancel stops the export: the request is aborted, nothing is saved, and the dialog says so", async () => {
    let signal
    exporter.downloadBacklinksExport.mockImplementation((_p, _q, hooks) => new Promise((_res, rej) => {
      signal = hooks.signal
      hooks.onStart({ rows: 10000, batches: 10 })
      signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))
    }))
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(screen.getByTestId("bl-export-all"))
    fireEvent.click(await screen.findByTestId("bl-export-start"))
    fireEvent.click(await screen.findByTestId("bl-export-cancel"))
    expect(signal.aborted).toBe(true)
    expect((await screen.findByTestId("bl-export-cancelled")).textContent).toMatch(/Nothing was saved/)
    expect(exporter.saveBlob).not.toHaveBeenCalled()
  })

  test("closing the dialog while it runs cancels it too", async () => {
    let signal
    exporter.downloadBacklinksExport.mockImplementation((_p, _q, hooks) => new Promise(() => { signal = hooks.signal }))
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(screen.getByTestId("bl-export-all"))
    fireEvent.click(await screen.findByTestId("bl-export-start"))
    await screen.findByTestId("bl-export-running")
    fireEvent.keyDown(screen.getByTestId("bl-export-dialog"), { key: "Escape" })
    await waitFor(() => expect(signal.aborted).toBe(true))
  })

  test("a failed export says why, saves nothing, and can be retried", async () => {
    exporter.downloadBacklinksExport.mockRejectedValueOnce(Object.assign(new Error("The export was interrupted before it finished, so nothing was saved. Please try again."), { name: "ExportError" }))
    renderPage()
    await screen.findAllByTestId("bl-row")
    fireEvent.click(screen.getByTestId("bl-export-all"))
    fireEvent.click(await screen.findByTestId("bl-export-start"))
    expect((await screen.findByTestId("bl-export-error")).textContent).toMatch(/interrupted.*nothing was saved/)
    expect(exporter.saveBlob).not.toHaveBeenCalled()
    exporter.downloadBacklinksExport.mockResolvedValueOnce({ blob: new Blob(["x"]), rows: 10000, expected: 10000 })
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect((await screen.findByTestId("bl-export-done")).textContent).toContain("Exported 10,000 backlinks")
  })

  test("nothing to export: the item is disabled", async () => {
    serve({ "backlinks-list": ok(envelope("backlinks-list", { totalCount: 0, nextToken: null, items: [] })) })
    renderPage()
    await screen.findByTestId("bl-empty")
    expect(screen.getByTestId("bl-export").disabled).toBe(false)
    expect(screen.getByTestId("bl-export-all").disabled).toBe(true)
    expect(screen.getByTestId("bl-export-page").disabled).toBe(true)
  })
})
