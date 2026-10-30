import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hooks (URL state, query keys, cancellation, the disavow lists), request builder, mapping and
// components run, over the REAL recorded asgeyehospital.com referring domains.
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const listsSvc = vi.hoisted(() => ({ get: vi.fn(), change: vi.fn() }))
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }))
const stream = vi.hoisted(() => ({ downloadStreamedExport: vi.fn(), saveBlob: vi.fn() }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DEFAULT_HISTORY_MONTHS: 12,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
}))
vi.mock("@/services/referringDomainSettingsService", () => ({ default: listsSvc, referringDomainSettingsService: listsSvc }))
vi.mock("./exportCsv", async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: csv.downloadCsv }))
vi.mock("../backlinks/exportStream", async (importOriginal) => ({ ...(await importOriginal()), downloadStreamedExport: stream.downloadStreamedExport, saveBlob: stream.saveBlob }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: project.current }) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
// Radix's DropdownMenu opens on Pointer Events, which jsdom lacks: render the menu shell always-open so its items are exercised directly.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }) => children,
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, disabled, asChild, ...p }) => (asChild
    ? <span {...p}>{children}</span>
    : <button type="button" disabled={disabled} onClick={onSelect} {...p}>{children}</button>),
}))

import ReferringDomainsDashboard from "./ReferringDomainsDashboard"
import { REAL_RD, REAL_RD_DOFOLLOW, REAL_RD_LOST, REAL_RD_SPAMMY } from "./testFixtures"
import { REAL_LIVE as SUMMARY } from "../backlinks-overview/testFixtures"

const ok = (data) => ({ success: true, data })
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const envelope = (section, result, extra = {}) => ({ section, target: "asgeyehospital.com", fetchedAt: "2026-10-28T08:00:00.000Z", cached: false, refreshThrottled: false, result, ...extra })

const BUCKETS = [{ key: "0-99", min: 0, max: 99, count: 2000 }, { key: "100-199", min: 100, max: 199, count: 118 }, { key: "200-299", min: 200, max: 299, count: 40 }, { key: "300-499", min: 300, max: 499, count: 8 }, { key: "500+", min: 500, max: null, count: 1 }]
const state = { total: 3958 }
const flatConds = (filters) => (Array.isArray(filters) && filters.length && typeof filters[0] === "string" ? [filters] : (filters ?? []).filter((c) => c !== "and"))

/** A tiny fake of the server's referring-domains section over the real rows: tabs, dofollow, `domain in`, paging (rows cycled past the 10 real ones). */
function rdAnswer(req) {
  const conds = flatConds(req.filters)
  const inList = conds.find((c) => c[0] === "domain" && c[1] === "in")
  const all = [...REAL_RD.items, ...REAL_RD_SPAMMY.items]
  if (inList) {
    const found = inList[2].map((d) => all.find((r) => r.domain === d)).filter(Boolean)
    return { totalCount: found.length, items: found }
  }
  let source = REAL_RD
  if (req.status === "lost") source = REAL_RD_LOST
  else if (conds.some((c) => c[0] === "backlinks_spam_score" && c[1] === ">")) source = REAL_RD_SPAMMY
  else if (req.dofollow) source = REAL_RD_DOFOLLOW
  let items = source.items
  const like = conds.find((c) => c[0] === "domain" && c[1] === "like")
  if (like) items = items.filter((i) => i.domain.includes(like[2].slice(1, -1).toLowerCase()))
  const narrowed = Boolean(like) || source !== REAL_RD || conds.some((c) => c[0] === "first_seen")
  if (conds.some((c) => c[0] === "first_seen")) items = items.slice(0, 3)
  if (narrowed) return { totalCount: like ? items.length : conds.some((c) => c[0] === "first_seen") ? 3 : source.totalCount, items }
  const start = req.offset ?? 0
  const count = Math.max(0, Math.min(req.limit, state.total - start))
  return { totalCount: state.total, items: Array.from({ length: count }, (_, i) => { const n = start + i; const src = REAL_RD.items[n % 10]; return n < 10 ? src : { ...src, domain: `page${n}.example.com` } }) }
}

function serve(overrides = {}) {
  svc.getSection.mockImplementation(async (_pid, section, opts) => {
    if (section in overrides) { const r = overrides[section]; if (r instanceof Error) throw r; if (typeof r === "function") return r(opts); return ok(r) }
    if (section === "backlinks") return ok(envelope("backlinks", SUMMARY))
    if (section === "rd-rank-buckets") return ok(envelope("rd-rank-buckets", { buckets: BUCKETS }))
    if (section === "rd-toxic-count") return ok(envelope("rd-toxic-count", { count: 3002, spamAbove: 30 }))
    if (section === "referring-domains") {
      const r = opts.referringDomains
      return ok(envelope("referring-domains", rdAnswer(r), { query: { status: r.status, dofollow: Boolean(r.dofollow), limit: r.limit, offset: r.offset ?? 0, order_by: r.order_by } }))
    }
    throw new Error(`unexpected section ${section}`)
  })
}

let saved
/** The saved lists as the server keeps them: mutually exclusive, in the order added. */
function serveLists(initial = {}) {
  saved = { disavowed: initial.disavowed ?? [], reviewed: initial.reviewed ?? [] }
  const body = () => ({ success: true, data: { disavowed: [...saved.disavowed], reviewed: [...saved.reviewed], limits: { perList: 10000, perChange: 1000 } } })
  listsSvc.get.mockImplementation(async () => body())
  listsSvc.change.mockImplementation(async (_pid, change) => {
    const d = change.disavowed ?? {}; const r = change.reviewed ?? {}
    const leaveD = new Set([...(d.remove ?? []), ...(r.add ?? [])]); const leaveR = new Set([...(r.remove ?? []), ...(d.add ?? [])])
    saved.disavowed = [...saved.disavowed.filter((x) => !leaveD.has(x)), ...(d.add ?? []).filter((x) => !saved.disavowed.includes(x))]
    saved.reviewed = [...saved.reviewed.filter((x) => !leaveR.has(x)), ...(r.add ?? []).filter((x) => !saved.reviewed.includes(x))]
    return body()
  })
}

const calls = () => svc.getSection.mock.calls.map(([pid, section, opts, req]) => ({ pid, section, refresh: Boolean(opts?.refresh), rd: opts?.referringDomains, signal: req?.signal }))
const bySection = (s) => calls().filter((c) => c.section === s)
const pageCalls = () => bySection("referring-domains")
const lastPage = () => pageCalls().at(-1)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(ReferringDomainsDashboard)))
}
const rowEls = () => screen.getAllByTestId("rd-row")
const showing = () => screen.getByTestId("rd-showing").textContent
const tab = (id) => screen.getByTestId(`rd-tab-${id}`)
const field = (name) => screen.getByRole("textbox", { name })
const rowFor = (domain) => rowEls().find((r) => within(r).queryByTestId("rd-domain-link")?.textContent === domain)
const openRow = (row) => fireEvent.click(within(row).getByTestId("rd-expand"))
/** jsdom's Blob is not Node's: read it the way a browser does. */
const readBlob = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsText(blob) })
const loaded = async () => { await screen.findAllByTestId("rd-row") }

vi.setConfig({ testTimeout: 30000 })
beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 })
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
  window.history.replaceState(null, "", "/app/referring-domains")
  window.innerWidth = 1280
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  state.total = 3958
  serve()
  serveLists()
})
afterEach(() => { vi.restoreAllMocks() })

describe("Referring Domains: first load", () => {
  test("one table request (live, rank desc, 50, no filters), the two profile cards, the shared summary and the saved lists — once each", async () => {
    renderPage()
    await loaded()
    await screen.findByTestId("rd-summary")
    expect(pageCalls()).toHaveLength(1)
    expect(lastPage().rd).toEqual({ status: "live", dofollow: false, limit: 50, offset: 0, order_by: "rank,desc", filters: [] })
    expect(bySection("rd-rank-buckets")).toHaveLength(1)
    expect(bySection("rd-toxic-count")).toHaveLength(1)
    expect(bySection("backlinks")).toHaveLength(1)
    expect(listsSvc.get).toHaveBeenCalledTimes(1)
  })

  test("the frame is there at once: title, domain, skeletons — no page-wide spinner", () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Referring Domains" })).toBeTruthy()
    expect(screen.getByTestId("rd-domain").textContent).toBe("asgeyehospital.com")
    expect(screen.getAllByTestId("rd-skeleton-row").length).toBeGreaterThanOrEqual(5)
    expect(screen.getByTestId("rd-summary-skeleton")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("header: last updated, Refresh, Export CSV and Export disavow file (disabled while the list is empty)", async () => {
    renderPage()
    await loaded()
    expect(screen.getByTestId("rd-updated").textContent).toMatch(/^Last updated .*2026/)
    for (const id of ["rd-refresh", "rd-export", "rd-export-disavow"]) expect(screen.getByTestId(id)).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId("rd-export-disavow").disabled).toBe(true))
  })

  test("asks for a project when none is selected, and requests nothing", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its referring domains.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
  })
})

describe("Referring Domains: the summary strip (the Backlink Overview's own answer)", () => {
  test("six figures about the whole profile, no new request", async () => {
    renderPage()
    const strip = await screen.findByTestId("rd-summary")
    expect(within(strip).getByTestId("rd-sum-domains").textContent).toContain("4K")
    expect(within(strip).getByTestId("rd-sum-dofollow").textContent).toMatch(/\d+\.\d%/)
    expect(within(strip).getByTestId("rd-sum-ips").textContent).toMatch(/\d/)
    expect(within(strip).getByTestId("rd-sum-broken").textContent).toContain("1.6K")
    expect(within(strip).getAllByText(/./).length).toBeGreaterThan(6)
    expect(bySection("backlinks")).toHaveLength(1)
  })
})

describe("Referring Domains: the table (real rows)", () => {
  test("'Showing 1–50 of 3,958 referring domains'", async () => {
    renderPage()
    await loaded()
    expect(rowEls()).toHaveLength(50)
    expect(showing()).toBe("Showing 1–50 of 3,958 referring domains")
  })

  test("domain: favicon, the domain opening the site in a new tab, the top country's flag; Sitewide chip", async () => {
    renderPage()
    await loaded()
    const row = rowFor("vasaneye.com")
    const link = within(row).getByTestId("rd-domain-link")
    expect(link.getAttribute("href")).toBe("https://vasaneye.com")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(row.querySelector("img").getAttribute("src")).toBe("https://www.google.com/s2/favicons?domain=vasaneye.com&sz=32")
    expect(within(row).getByTestId("rd-country").getAttribute("title")).toBe("India")
    expect(within(row).getByTestId("rd-sitewide").textContent).toBe("Sitewide")
  })

  test("quality chip (the server's tier), rank, backlinks 'from n pages', dofollow split bar, spam badge, placement, broken in red, first seen", async () => {
    renderPage()
    await loaded()
    const row = rowFor("vasaneye.com")
    expect(within(row).getByTestId("rd-quality").getAttribute("data-quality")).toBe("medium")
    expect(within(row).getByTestId("bl-rank").textContent).toBe("258")
    expect(within(row).getByTestId("rd-backlinks").textContent).toContain("761")
    expect(within(row).getByTestId("rd-pages").textContent).toBe("from 761 pages")
    expect(within(row).getByTestId("rd-dofollow").textContent).toContain("100.0%")
    expect(within(row).getByTestId("rd-dofollow-bar").style.width).toBe("100%")
    expect(within(row).getByTestId("bl-spam").getAttribute("data-band")).toBe("low")
    expect(within(row).getByTestId("bl-placement").textContent).toBe("Footer")
    expect(within(row).getByTestId("rd-broken").textContent).toBe("761")
    expect(within(row).getByTestId("rd-broken").className).toContain("text-red-600")
    expect(within(row).getByText("Aug 2026").getAttribute("title")).toMatch(/^Aug 19, 2026/)
  })

  test("every row has a quality tier from the server, and a missing value is '—', never 'NaN' / 'null'", async () => {
    renderPage()
    await loaded()
    for (const r of rowEls().slice(0, 10)) {
      expect(["high", "medium", "low", "toxic"]).toContain(r.getAttribute("data-quality"))
      expect(r.textContent).not.toMatch(/NaN|undefined|\bnull\b/)
    }
  })

  test("the headers explain themselves", async () => {
    renderPage()
    await loaded()
    expect(screen.getByRole("button", { name: "About Quality" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "About Rank" })).toBeTruthy()
  })
})

describe("Referring Domains: the authority distribution (whole profile, 5 count calls)", () => {
  test("five bars with their counts, labelled 'Whole profile (live links)'", async () => {
    renderPage()
    const list = await screen.findByTestId("rd-rank-buckets")
    expect(list.getAttribute("data-keys")).toBe("0-99|100-199|200-299|300-499|500+")
    expect(list.getAttribute("data-counts")).toBe("2000|118|40|8|1")
    expect(screen.getByTestId("rd-rank-scope").textContent).toBe("Whole profile (live links)")
  })

  test("a click on a bar applies that rank range to the table; a second click clears it", async () => {
    renderPage()
    await loaded()
    const bar = (await screen.findAllByTestId("rd-rank-bar")).find((b) => b.getAttribute("data-key") === "100-199")
    fireEvent.click(bar)
    await waitFor(() => expect(lastPage().rd.filters).toEqual([["rank", ">=", 100], "and", ["rank", "<=", 199]]))
    expect(window.location.search).toBe("?rmin=100&rmax=199")
    expect(screen.getAllByTestId("ok-chip").map((c) => c.textContent)).toEqual(["Rank ≥ 100", "Rank ≤ 199"])
    fireEvent.click((await screen.findAllByTestId("rd-rank-bar")).find((b) => b.getAttribute("data-key") === "100-199"))
    await waitFor(() => expect(window.location.search).toBe(""))
  })

  test("the open-ended bucket (500+) sets only a minimum", async () => {
    renderPage()
    await loaded()
    fireEvent.click((await screen.findAllByTestId("rd-rank-bar")).find((b) => b.getAttribute("data-key") === "500+"))
    await waitFor(() => expect(lastPage().rd.filters).toEqual(["rank", ">=", 500]))
  })

  test("the bars are PROFILE-LEVEL: the Dofollow switch, a tab and a filter never ask for them again or change them", async () => {
    renderPage()
    await loaded()
    await screen.findByTestId("rd-rank-buckets")
    fireEvent.click(screen.getByTestId("rd-dofollow-only"))
    await waitFor(() => expect(pageCalls()).toHaveLength(2))
    fireEvent.click(tab("lost"))
    await waitFor(() => expect(pageCalls()).toHaveLength(3))
    expect(bySection("rd-rank-buckets")).toHaveLength(1)
    expect(bySection("rd-toxic-count")).toHaveLength(1)
    for (const c of [...bySection("rd-rank-buckets"), ...bySection("rd-toxic-count")]) expect(c.rd).toBeUndefined()
    expect(screen.getByTestId("rd-rank-buckets").getAttribute("data-counts")).toBe("2000|118|40|8|1")
  })

  test("a failing card has its own error and Retry; the table is not affected", async () => {
    serve({ "rd-rank-buckets": apiError("The data service is busy.", { status: 429 }) })
    renderPage()
    await loaded()
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/busy/)
    expect(rowEls().length).toBe(50)
  })
})

describe("Referring Domains: the toxic-domains alert (whole profile, 1 count call)", () => {
  test("'<n> referring domains have spam score above 30', labelled as the whole profile", async () => {
    renderPage()
    const alert = await screen.findByTestId("rd-toxic-alert")
    expect(alert.textContent).toBe("3,002 referring domains have spam score above 30")
    expect(screen.getByTestId("rd-toxic-scope").textContent).toBe("Whole profile (live links)")
  })

  test("Review opens the Toxic tab (other filters cleared)", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?q=a&dofollow=1")
    renderPage()
    await loaded()
    fireEvent.click(await screen.findByTestId("rd-toxic-review"))
    await waitFor(() => expect(lastPage().rd.filters).toEqual(["backlinks_spam_score", ">", 30]))
    expect(lastPage().rd.dofollow).toBe(false)
    expect(tab("toxic").getAttribute("aria-selected")).toBe("true")
    expect(window.location.search).toBe("?tab=toxic")
  })

  test("with a disavow list it says how many domains are in it, with a link to download the file; without one it says nothing", async () => {
    renderPage()
    await screen.findByTestId("rd-toxic-alert")
    expect(screen.queryByTestId("rd-toxic-disavow")).toBeNull()
  })

  test("a disavow list: '<n> domains in your disavow list · Download file' opens the confirmation", async () => {
    serveLists({ disavowed: ["a-spam.com", "b-spam.net"] })
    renderPage()
    expect((await screen.findByTestId("rd-toxic-disavow")).textContent).toContain("2 domains in your disavow list")
    fireEvent.click(screen.getByTestId("rd-toxic-download"))
    expect((await screen.findByTestId("rd-disavow-dialog"))).toBeTruthy()
  })

  test("no toxic domains: a calm line, no alert, no Review button", async () => {
    serve({ "rd-toxic-count": envelope("rd-toxic-count", { count: 0, spamAbove: 30 }) })
    renderPage()
    expect((await screen.findByTestId("rd-toxic-none")).textContent).toContain("No referring domains have a spam score above 30")
    expect(screen.queryByTestId("rd-toxic-review")).toBeNull()
  })
})

describe("Referring Domains: tabs", () => {
  test("New is live + first seen in the last 30 days; Lost is the lost status and shows lost dates; Toxic is spam above 30 with its hint", async () => {
    renderPage()
    await loaded()
    fireEvent.click(tab("new"))
    await waitFor(() => expect(lastPage().rd.filters[0]).toBe("first_seen"))
    expect(lastPage().rd.filters[1]).toBe(">=")
    expect(lastPage().rd.filters[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    fireEvent.click(tab("lost"))
    await waitFor(() => expect(lastPage().rd).toMatchObject({ status: "lost", filters: [] }))
    expect(screen.getByRole("columnheader", { name: /Lost date/ })).toBeTruthy()
    fireEvent.click(tab("toxic"))
    await waitFor(() => expect(lastPage().rd.filters).toEqual(["backlinks_spam_score", ">", 30]))
    expect(screen.getByTestId("rd-toxic-hint").textContent).toBe("Server-side filter uses spam score; quality tier is calculated per row.")
    expect(window.location.search).toBe("?tab=toxic")
  })

  test("a tab shows its count only once loaded; the others are never fetched ahead of time", async () => {
    renderPage()
    await loaded()
    await waitFor(() => expect(screen.getByTestId("rd-tab-all-count").textContent).toBe("3,958"))
    for (const t of ["new", "lost", "toxic", "disavowed"]) expect(screen.queryByTestId(`rd-tab-${t}-count`)).toBeNull()
    expect(pageCalls()).toHaveLength(1)
    fireEvent.click(tab("toxic"))
    await waitFor(() => expect(screen.getByTestId("rd-tab-toxic-count").textContent).toBe("141"))
    expect(screen.getByTestId("rd-tab-all-count").textContent).toBe("3,958")
    expect(screen.queryByTestId("rd-tab-lost-count")).toBeNull()
  })

  test("Toxic rows are highlighted; one the user has marked OK is not", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?tab=toxic")
    serveLists({ reviewed: ["iodirectory.com"] })
    renderPage()
    await loaded()
    await waitFor(() => expect(rowFor("iodirectory.com").getAttribute("data-toxic-warning")).toBe("false"))
    expect(rowFor("digitalpool.com").getAttribute("data-toxic-warning")).toBe("true")
    expect(rowFor("digitalpool.com").className).toContain("bg-red-50")
    expect(within(rowFor("iodirectory.com")).getByTestId("rd-quality").getAttribute("data-calm")).toBe("true")
  })

  test("the tab is read from the URL on open", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?tab=lost&size=25")
    renderPage()
    await loaded()
    expect(lastPage().rd).toMatchObject({ status: "lost", limit: 25 })
    expect(tab("lost").getAttribute("aria-selected")).toBe("true")
  })
})

describe("Referring Domains: filters (server-side, debounced, limited to 8 including the tab's)", () => {
  test("search: 3 keystrokes make ONE request, 400 ms after the last; it is a 'like' on the domain", async () => {
    renderPage()
    await loaded()
    const input = field("Search domain")
    fireEvent.change(input, { target: { value: "v" } })
    fireEvent.change(input, { target: { value: "va" } })
    fireEvent.change(input, { target: { value: "vasan" } })
    await sleep(150)
    expect(pageCalls()).toHaveLength(1)
    await waitFor(() => expect(pageCalls()).toHaveLength(2), { timeout: 3000 })
    expect(lastPage().rd.filters).toEqual(["domain", "like", "%vasan%"])
    expect(window.location.search).toBe("?q=vasan")
    await waitFor(() => expect(rowEls()).toHaveLength(1))
  })

  test("exclude is a 'not_like', and Enter applies at once", async () => {
    renderPage()
    await loaded()
    fireEvent.change(field("Exclude domains containing"), { target: { value: "blogspot" } })
    fireEvent.keyDown(field("Exclude domains containing"), { key: "Enter" })
    await waitFor(() => expect(lastPage().rd.filters).toEqual(["domain", "not_like", "%blogspot%"]))
  })

  test("min / max rank, max spam, min backlinks apply on blur or Enter only; a wrong one is explained and not sent", async () => {
    renderPage()
    await loaded()
    const min = field("Minimum rank")
    fireEvent.change(min, { target: { value: "1" } })
    fireEvent.change(min, { target: { value: "15" } })
    await sleep(600)
    expect(pageCalls()).toHaveLength(1)
    fireEvent.blur(min)
    await waitFor(() => expect(lastPage().rd.filters).toEqual(["rank", ">=", 15]))
    const max = field("Maximum rank")
    fireEvent.change(max, { target: { value: "5" } })
    fireEvent.keyDown(max, { key: "Enter" })
    expect(await screen.findByText("Min rank is higher than max rank.")).toBeTruthy()
    expect(pageCalls()).toHaveLength(2)
    fireEvent.change(max, { target: { value: "600" } })
    fireEvent.keyDown(max, { key: "Enter" })
    await waitFor(() => expect(lastPage().rd.filters).toEqual([["rank", ">=", 15], "and", ["rank", "<=", 600]]))
    const spam = field("Maximum spam score")
    fireEvent.change(spam, { target: { value: "500" } })
    fireEvent.keyDown(spam, { key: "Enter" })
    expect(await screen.findByText("Spam score: enter a whole number from 0 to 100.")).toBeTruthy()
  })

  test("has broken links, first seen after and min backlinks", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("rd-has-broken"))
    await waitFor(() => expect(lastPage().rd.filters).toEqual(["broken_backlinks", ">", 0]))
    const since = screen.getByTestId("rd-since")
    fireEvent.change(since, { target: { value: "2025-04-01" } })
    fireEvent.blur(since)
    await waitFor(() => expect(lastPage().rd.filters).toContainEqual(["first_seen", ">=", "2025-04-01"]))
    const bl = field("Minimum backlinks")
    fireEvent.change(bl, { target: { value: "100" } })
    fireEvent.blur(bl)
    await waitFor(() => expect(lastPage().rd.filters).toContainEqual(["backlinks", ">=", 100]))
  })

  test("'Dofollow links only' is the request's dofollow flag — NOT a filter", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("rd-dofollow-only"))
    await waitFor(() => expect(pageCalls()).toHaveLength(2))
    expect(lastPage().rd).toMatchObject({ dofollow: true, filters: [] })
    expect(window.location.search).toBe("?dofollow=1")
    expect(screen.getAllByTestId("ok-chip").map((c) => c.textContent)).toEqual(["Dofollow links only"])
    await waitFor(() => expect(showing()).toMatch(/of 3,530 referring domains/))
  })

  test("the quality filter is applied to the rows ON THIS PAGE: no request, a hint, the URL remembers it", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?tab=toxic")
    renderPage()
    await loaded()
    const before = calls().length
    expect(screen.getByTestId("rd-quality-hint").textContent).toBe("Quality filter applies to the rows on this page.")
    fireEvent.click(within(screen.getByTestId("rd-filter-quality")).getByRole("button", { name: "Low" }))
    await waitFor(() => expect(rowEls()).toHaveLength(1))
    expect(within(rowEls()[0]).getByTestId("rd-quality").getAttribute("data-quality")).toBe("low")
    expect(calls()).toHaveLength(before)
    expect(window.location.search).toBe("?tab=toxic&quality=low")
    expect(screen.getByTestId("rd-quality-note").textContent).toBe("Quality filter applies to the rows on this page.")
    expect(showing()).toMatch(/· 1 on this page match the quality filter$/)
  })

  test("a quality filter that leaves nothing says so and can be cleared", async () => {
    renderPage()
    await loaded()
    fireEvent.click(within(screen.getByTestId("rd-filter-quality")).getByRole("button", { name: "Toxic" }))
    const empty = await screen.findByTestId("rd-empty")
    expect(empty.textContent).toContain("No domains match these filters")
    fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }))
    await waitFor(() => expect(rowEls().length).toBe(50))
  })

  test("at most 8 conditions INCLUDING the tab's own: the 9th is refused with a message and NOTHING is sent", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?tab=new&q=a&ex=b&rmin=1&rmax=900&spam=50&bl=1&broken=1&since=2025-01-01")
    renderPage()
    await screen.findByTestId("rd-too-many")
    await sleep(100)
    expect(pageCalls()).toHaveLength(0)
    expect(screen.getByTestId("rd-too-many").textContent).toBe("Max 8 filters — remove one to add another")
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Has broken links" }))
    await waitFor(() => expect(screen.queryByTestId("rd-too-many")).toBeNull())
    await waitFor(() => expect(pageCalls()).toHaveLength(1))
    expect(lastPage().rd.filters.filter((c) => Array.isArray(c) && c.length === 3)).toHaveLength(8) // the New tab's own + seven
  })

  test("applied filters are removable chips, plus 'Clear all'; going back to a view already loaded is not a request", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("rd-has-broken"))
    await waitFor(() => expect(pageCalls()).toHaveLength(2))
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Has broken links" }))
    await waitFor(() => expect(screen.queryAllByTestId("ok-chip")).toHaveLength(0))
    expect(pageCalls()).toHaveLength(2)
    fireEvent.click(screen.getByTestId("rd-has-broken"))
    fireEvent.click(screen.getByTestId("rd-dofollow-only"))
    fireEvent.click(screen.getByTestId("ok-clear-all"))
    await waitFor(() => expect(window.location.search).toBe(""))
  })

  test("a filter that matches nothing: 'No domains match these filters' with Clear filters", async () => {
    renderPage()
    await loaded()
    fireEvent.change(field("Search domain"), { target: { value: "zzzz" } })
    fireEvent.keyDown(field("Search domain"), { key: "Enter" })
    const empty = await screen.findByTestId("rd-empty")
    expect(empty.getAttribute("data-kind")).toBe("filtered")
    fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }))
    await waitFor(() => expect(rowEls().length).toBe(50))
    expect(field("Search domain").value).toBe("")
  })

  test("the view is read from the URL on open", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?q=a&sort=backlinks%3Aasc&size=25&rmin=2&dofollow=1&quality=medium")
    renderPage()
    await loaded()
    expect(lastPage().rd).toEqual({ status: "live", dofollow: true, limit: 25, offset: 0, order_by: "backlinks,asc", filters: [["domain", "like", "%a%"], "and", ["rank", ">=", 2]] })
    expect(field("Search domain").value).toBe("a")
    expect(within(screen.getByTestId("rd-filter-quality")).getByRole("button", { name: "Medium" }).getAttribute("aria-pressed")).toBe("true")
  })
})

describe("Referring Domains: sorting (server-side, one rule) and paging", () => {
  test("a header sorts by its field, a second click flips it; the default is rank, strongest first", async () => {
    renderPage()
    await loaded()
    expect(screen.getByRole("columnheader", { name: /^Rank/ }).getAttribute("aria-sort")).toBe("descending")
    fireEvent.click(screen.getByTestId("rd-sort-backlinks"))
    await waitFor(() => expect(lastPage().rd.order_by).toBe("backlinks,desc"))
    fireEvent.click(screen.getByTestId("rd-sort-backlinks"))
    await waitFor(() => expect(lastPage().rd.order_by).toBe("backlinks,asc"))
    fireEvent.click(screen.getByTestId("rd-sort-spam"))
    await waitFor(() => expect(lastPage().rd.order_by).toBe("backlinks_spam_score,desc"))
    expect(window.location.search).toBe("?sort=backlinks_spam_score%3Adesc")
  })

  test("the 'Sort by' control reaches all six fields, including referring pages, and flips the direction", async () => {
    renderPage()
    await loaded()
    for (const f of ["referring_pages", "broken_backlinks", "first_seen", "backlinks_spam_score", "backlinks"]) {
      fireEvent.change(screen.getByTestId("rd-sort-select"), { target: { value: f } })
      await waitFor(() => expect(lastPage().rd.order_by).toBe(`${f},desc`))
    }
    fireEvent.click(screen.getByTestId("rd-sort-dir"))
    await waitFor(() => expect(lastPage().rd.order_by).toBe("backlinks,asc"))
  })

  test("page size, next page and 'Go to page' are server offsets", async () => {
    renderPage()
    await loaded()
    fireEvent.change(screen.getByTestId("rd-page-size"), { target: { value: "25" } })
    await waitFor(() => expect(lastPage().rd).toMatchObject({ limit: 25, offset: 0 }))
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(lastPage().rd).toMatchObject({ limit: 25, offset: 25 }))
    fireEvent.change(document.getElementById("rd-goto"), { target: { value: "9" } })
    fireEvent.click(screen.getByRole("button", { name: "Go" }))
    await waitFor(() => expect(lastPage().rd.offset).toBe(200))
    expect(window.location.search).toBe("?page=9&size=25")
  })

  test("a page past the end (a hand-edited link) comes back to the last page", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?page=900")
    renderPage()
    await waitFor(() => expect(window.location.search).toBe("?page=80"))
  })
})

describe("Referring Domains: the expandable row", () => {
  test("the insight, five breakdown charts, the counts behind the row and the way to its backlinks; one row at a time", async () => {
    renderPage()
    await loaded()
    openRow(rowFor("vasaneye.com"))
    const panel = await screen.findByTestId("rd-expanded")
    expect(within(panel).getByTestId("rd-insight").textContent).toBe("All 761 links are footer links — likely a sitewide link.")
    expect(within(panel).getByTestId("rd-chart-placement").getAttribute("data-labels")).toBe("Footer")
    expect(within(panel).getByTestId("rd-chart-countries").getAttribute("data-labels")).toBe("India")
    expect(within(panel).getByTestId("rd-chart-types").getAttribute("data-labels")).toBe("Text Anchor")
    expect(within(panel).getByTestId("rd-chart-platforms").getAttribute("data-counts")).toBe("761|761|444|64")
    expect(within(panel).getByText("Link attributes")).toBeTruthy()
    expect(within(panel).getAllByText("No data")).toHaveLength(1) // this domain has no attributes
    expect(within(panel).getByTestId("rd-stat-pages").textContent).toContain("761")
    expect(within(panel).getByTestId("rd-stat-pages").textContent).toContain("761 dofollow · 0 nofollow")
    expect(within(panel).getByTestId("rd-stat-ips").textContent).toContain("5")
    expect(within(panel).getByTestId("rd-stat-subnets").textContent).toContain("2")
    expect(within(panel).getByTestId("rd-stat-broken-pages").textContent).toContain("1")
    openRow(rowFor("theconsumersfeedback.com"))
    await waitFor(() => expect(screen.getAllByTestId("rd-expanded")).toHaveLength(1))
    fireEvent.click(screen.getByTestId("rd-sort-backlinks"))
    await waitFor(() => expect(screen.queryAllByTestId("rd-expanded")).toHaveLength(0))
  })

  test("'View backlinks' opens the Backlinks page filtered to this source domain", async () => {
    renderPage()
    await loaded()
    openRow(rowFor("vasaneye.com"))
    expect((await screen.findByTestId("rd-view-backlinks")).getAttribute("href")).toBe("/app/backlinks/list?from=vasaneye.com")
    expect(within(rowFor("vasaneye.com")).getByTestId("rd-action-view").querySelector("a").getAttribute("href")).toBe("/app/backlinks/list?from=vasaneye.com")
  })

  test("a click on the row opens it; a click on its link does not", async () => {
    renderPage()
    await loaded()
    fireEvent.click(within(rowFor("vasaneye.com")).getByTestId("rd-domain-link"))
    expect(screen.queryAllByTestId("rd-expanded")).toHaveLength(0)
    fireEvent.click(within(rowFor("vasaneye.com")).getByTestId("rd-quality"))
    expect(await screen.findAllByTestId("rd-expanded")).toHaveLength(1)
  })
})

describe("Referring Domains: Disavow and Mark as OK — saved on the project, NO new provider request", () => {
  test("Disavow: one change is saved, the row shows the chip at once, and the data provider is not asked for anything", async () => {
    renderPage()
    await loaded()
    await screen.findByTestId("rd-rank-buckets")
    const before = calls().length
    fireEvent.click(within(rowFor("vasaneye.com")).getByTestId("rd-action-disavow"))
    await waitFor(() => expect(within(rowFor("vasaneye.com")).getByTestId("rd-disavowed")).toBeTruthy())
    expect(listsSvc.change).toHaveBeenCalledWith("p1", { disavowed: { add: ["vasaneye.com"] } })
    expect(calls()).toHaveLength(before)
    expect(await screen.findByText("vasaneye.com was added to your disavow list.")).toBeTruthy()
    expect(within(rowFor("vasaneye.com")).getByTestId("rd-action-undisavow").textContent).toBe("Remove from disavow")
    await waitFor(() => expect(screen.getByTestId("rd-export-disavow").disabled).toBe(false))
  })

  test("Remove from disavow takes the chip away, again with no provider request", async () => {
    serveLists({ disavowed: ["vasaneye.com"] })
    renderPage()
    await loaded()
    await waitFor(() => expect(within(rowFor("vasaneye.com")).getByTestId("rd-disavowed")).toBeTruthy())
    const before = calls().length
    fireEvent.click(within(rowFor("vasaneye.com")).getByTestId("rd-action-undisavow"))
    await waitFor(() => expect(within(rowFor("vasaneye.com")).queryByTestId("rd-disavowed")).toBeNull())
    expect(listsSvc.change).toHaveBeenCalledWith("p1", { disavowed: { remove: ["vasaneye.com"] } })
    expect(calls()).toHaveLength(before)
  })

  test("Mark as OK: a toxic row stops being a warning (and is calmed), no provider request; the mark can be removed", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?tab=toxic")
    renderPage()
    await loaded()
    const before = calls().length
    expect(rowFor("digitalpool.com").getAttribute("data-toxic-warning")).toBe("true")
    fireEvent.click(within(rowFor("digitalpool.com")).getByTestId("rd-action-ok"))
    await waitFor(() => expect(rowFor("digitalpool.com").getAttribute("data-toxic-warning")).toBe("false"))
    expect(listsSvc.change).toHaveBeenCalledWith("p1", { reviewed: { add: ["digitalpool.com"] } })
    expect(within(rowFor("digitalpool.com")).getByTestId("rd-reviewed")).toBeTruthy()
    expect(calls()).toHaveLength(before)
    fireEvent.click(within(rowFor("digitalpool.com")).getByTestId("rd-action-unmark"))
    await waitFor(() => expect(rowFor("digitalpool.com").getAttribute("data-toxic-warning")).toBe("true"))
  })

  test("disavowing a domain you marked OK moves it: it is disavowed and no longer reviewed", async () => {
    serveLists({ reviewed: ["vasaneye.com"] })
    renderPage()
    await loaded()
    await waitFor(() => expect(within(rowFor("vasaneye.com")).getByTestId("rd-reviewed")).toBeTruthy())
    fireEvent.click(within(rowFor("vasaneye.com")).getByTestId("rd-action-disavow"))
    await waitFor(() => expect(within(rowFor("vasaneye.com")).getByTestId("rd-disavowed")).toBeTruthy())
    expect(within(rowFor("vasaneye.com")).queryByTestId("rd-reviewed")).toBeNull()
  })

  test("a failed save changes nothing on screen and says why", async () => {
    listsSvc.change.mockRejectedValueOnce(Object.assign(new Error("A list can hold at most 10,000 domains. Remove some first."), { status: 409 }))
    renderPage()
    await loaded()
    fireEvent.click(within(rowFor("vasaneye.com")).getByTestId("rd-action-disavow"))
    expect(await screen.findByText("A list can hold at most 10,000 domains. Remove some first.")).toBeTruthy()
    expect(within(rowFor("vasaneye.com")).queryByTestId("rd-disavowed")).toBeNull()
  })

  test("the flags come from the project's lists, not from the provider's rows: they survive a new page of the same data", async () => {
    serveLists({ disavowed: ["usama.dev"] })
    renderPage()
    await loaded()
    await waitFor(() => expect(within(rowFor("usama.dev")).getByTestId("rd-disavowed")).toBeTruthy())
    fireEvent.click(screen.getByTestId("rd-sort-backlinks"))
    await waitFor(() => expect(pageCalls()).toHaveLength(2))
    await waitFor(() => expect(within(rowFor("usama.dev")).getByTestId("rd-disavowed")).toBeTruthy())
  })
})

describe("Referring Domains: bulk actions", () => {
  const select = (...domains) => domains.forEach((d) => fireEvent.click(within(rowFor(d)).getByTestId("rd-select")))

  test("the bar appears with a count; 'Disavow selected' is ONE request for all of them, and the selection is cleared", async () => {
    renderPage()
    await loaded()
    expect(screen.queryByTestId("rd-bulk")).toBeNull()
    select("vasaneye.com", "usama.dev")
    expect(screen.getByTestId("rd-bulk-count").textContent).toBe("2 selected")
    const before = calls().length
    fireEvent.click(screen.getByTestId("rd-bulk-disavow"))
    await waitFor(() => expect(listsSvc.change).toHaveBeenCalledTimes(1))
    expect(listsSvc.change).toHaveBeenCalledWith("p1", { disavowed: { add: expect.arrayContaining(["vasaneye.com", "usama.dev"]) } })
    expect(listsSvc.change.mock.calls[0][1].disavowed.add).toHaveLength(2)
    await waitFor(() => expect(screen.queryByTestId("rd-bulk")).toBeNull())
    expect(within(rowFor("usama.dev")).getByTestId("rd-disavowed")).toBeTruthy()
    expect(calls()).toHaveLength(before)
  })

  test("'Mark selected as OK' is one request too", async () => {
    renderPage()
    await loaded()
    select("vasaneye.com", "sportivo.network", "net-pals.com")
    fireEvent.click(screen.getByTestId("rd-bulk-ok"))
    await waitFor(() => expect(listsSvc.change).toHaveBeenCalledTimes(1))
    expect(listsSvc.change.mock.calls[0][1].reviewed.add).toHaveLength(3)
  })

  test("'Export selected' is a CSV of just those rows, with their flags, no request", async () => {
    serveLists({ disavowed: ["net-pals.com"] })
    renderPage()
    await loaded()
    await waitFor(() => expect(within(rowFor("net-pals.com")).getByTestId("rd-disavowed")).toBeTruthy())
    const before = calls().length
    select("vasaneye.com", "net-pals.com")
    fireEvent.click(screen.getByTestId("rd-bulk-export"))
    const [name, content] = csv.downloadCsv.mock.calls[0]
    expect(name).toMatch(/^referring-domains_asgeyehospital\.com_selected_\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = content.split("\r\n")
    expect(lines).toHaveLength(3)
    expect(lines[1]).toMatch(/^vasaneye\.com,Medium,258,/)
    expect(lines[2]).toMatch(/^net-pals\.com,.*,yes$/)
    expect(calls()).toHaveLength(before)
  })

  test("select-all takes every row on the page; clearing empties the selection; a change of view drops it", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("rd-select-all"))
    expect(screen.getByTestId("rd-bulk-count").textContent).toBe("50 selected")
    fireEvent.click(screen.getByTestId("rd-bulk-clear"))
    expect(screen.queryByTestId("rd-bulk")).toBeNull()
    select("vasaneye.com")
    fireEvent.click(screen.getByTestId("rd-sort-backlinks"))
    await waitFor(() => expect(screen.queryByTestId("rd-bulk")).toBeNull())
  })
})

describe("Referring Domains: the Disavowed tab — the saved list decides which rows appear", () => {
  test("a saved domain the provider has no live row for is STILL listed, saying so, with Remove; the others show their metrics", async () => {
    serveLists({ disavowed: ["vasaneye.com", "gone-forever.com"] })
    window.history.replaceState(null, "", "/app/referring-domains?tab=disavowed")
    renderPage()
    await loaded()
    await waitFor(() => expect(rowEls()).toHaveLength(2))
    expect(showing()).toBe("Showing 1–2 of 2 referring domains")
    const gone = rowFor("gone-forever.com") // newest first
    expect(rowEls()[0]).toBe(gone)
    expect(within(gone).getByTestId("rd-no-live").textContent).toBe("No live links found")
    expect(within(gone).getByTestId("rd-disavowed")).toBeTruthy()
    expect(within(gone).getByTestId("rd-action-undisavow").textContent).toBe("Remove from disavow")
    expect(within(gone).queryByTestId("rd-expand")).toBeNull()
    expect(within(rowFor("vasaneye.com")).getByTestId("rd-quality").getAttribute("data-quality")).toBe("medium")
    expect(within(rowFor("vasaneye.com")).getByTestId("bl-rank").textContent).toBe("258")
  })

  test("it asks the provider ONCE, for the saved domains of the page (domain \"in\" [...], sorted, live, not dofollow)", async () => {
    serveLists({ disavowed: ["vasaneye.com", "gone-forever.com"] })
    window.history.replaceState(null, "", "/app/referring-domains?tab=disavowed")
    renderPage()
    await waitFor(() => expect(rowEls()).toHaveLength(2))
    expect(pageCalls()).toHaveLength(1)
    expect(lastPage().rd).toMatchObject({ status: "live", dofollow: false, filters: ["domain", "in", ["gone-forever.com", "vasaneye.com"]] })
  })

  test("removing a saved domain, with no provider request: the list shrinks, nothing is asked again", async () => {
    serveLists({ disavowed: ["vasaneye.com", "gone-forever.com"] })
    window.history.replaceState(null, "", "/app/referring-domains?tab=disavowed")
    renderPage()
    await waitFor(() => expect(rowEls()).toHaveLength(2))
    fireEvent.click(within(rowFor("gone-forever.com")).getByTestId("rd-action-undisavow"))
    await waitFor(() => expect(rowEls()).toHaveLength(1))
    expect(listsSvc.change).toHaveBeenCalledWith("p1", { disavowed: { remove: ["gone-forever.com"] } })
    expect(showing()).toBe("Showing 1–1 of 1 referring domains")
    await sleep(80)
    expect(pageCalls()).toHaveLength(1)
  })

  test("a domain disavowed on the All tab is on the Disavowed tab with no new request (its row was already loaded)", async () => {
    renderPage()
    await loaded()
    fireEvent.click(within(rowFor("usama.dev")).getByTestId("rd-action-disavow"))
    await waitFor(() => expect(within(rowFor("usama.dev")).getByTestId("rd-disavowed")).toBeTruthy())
    const before = calls().length
    fireEvent.click(tab("disavowed"))
    await waitFor(() => expect(rowEls()).toHaveLength(1))
    expect(within(rowEls()[0]).getByTestId("rd-domain-link").textContent).toBe("usama.dev")
    expect(within(rowEls()[0]).getByTestId("bl-rank").textContent).toBe("208")
    expect(calls()).toHaveLength(before)
  })

  test("the search narrows your own list; the other filters and the sort do not apply here (and say so)", async () => {
    serveLists({ disavowed: ["vasaneye.com", "usama.dev", "gone-forever.com"] })
    window.history.replaceState(null, "", "/app/referring-domains?tab=disavowed")
    renderPage()
    await waitFor(() => expect(rowEls()).toHaveLength(3))
    expect(screen.getByTestId("rd-disavow-filter-note")).toBeTruthy()
    expect(screen.queryByTestId("rd-sort-select")).toBeNull()
    expect(screen.queryByTestId("rd-sort-backlinks")).toBeNull()
    expect(screen.queryByTestId("rd-dofollow-only")).toBeNull()
    fireEvent.change(field("Search your disavow list"), { target: { value: "gone" } })
    fireEvent.keyDown(field("Search your disavow list"), { key: "Enter" })
    await waitFor(() => expect(rowEls()).toHaveLength(1))
    expect(within(rowEls()[0]).getByTestId("rd-domain-link").textContent).toBe("gone-forever.com")
    expect(window.location.search).toBe("?tab=disavowed&q=gone")
  })

  test("an empty list: 'Your disavow list is empty.'", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?tab=disavowed")
    renderPage()
    expect((await screen.findByTestId("rd-empty")).textContent).toBe("Your disavow list is empty.")
    expect(pageCalls()).toHaveLength(0)
  })

  test("the bulk action here is 'Remove selected from disavow'", async () => {
    serveLists({ disavowed: ["vasaneye.com", "gone-forever.com"] })
    window.history.replaceState(null, "", "/app/referring-domains?tab=disavowed")
    renderPage()
    await waitFor(() => expect(rowEls()).toHaveLength(2))
    fireEvent.click(screen.getByTestId("rd-select-all"))
    expect(screen.queryByTestId("rd-bulk-disavow")).toBeNull()
    fireEvent.click(screen.getByTestId("rd-bulk-undisavow"))
    await waitFor(() => expect(listsSvc.change).toHaveBeenCalledWith("p1", { disavowed: { remove: expect.arrayContaining(["vasaneye.com", "gone-forever.com"]) } }))
    expect((await screen.findByTestId("rd-empty")).textContent).toBe("Your disavow list is empty.")
  })

  test("the tab's count is the saved list's size, shown once the tab has been opened", async () => {
    serveLists({ disavowed: ["vasaneye.com", "gone-forever.com"] })
    renderPage()
    await loaded()
    expect(screen.queryByTestId("rd-tab-disavowed-count")).toBeNull()
    fireEvent.click(tab("disavowed"))
    await waitFor(() => expect(screen.getByTestId("rd-tab-disavowed-count").textContent).toBe("2"))
  })

  test("a failed request for the domains' metrics is an inline error with Retry; the saved list is still the list", async () => {
    serveLists({ disavowed: ["vasaneye.com"] })
    let fail = true
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[1] === "referring-domains" && fail) throw apiError("The data service is temporarily unavailable. Please try again later."); return base(...a) })
    window.history.replaceState(null, "", "/app/referring-domains?tab=disavowed")
    renderPage()
    const alert = await within(await screen.findByTestId("rd-results")).findByRole("alert")
    expect(alert.textContent).toMatch(/temporarily unavailable/)
    fail = false
    fireEvent.click(within(alert).getByRole("button", { name: /Retry/ }))
    await waitFor(() => expect(rowEls()).toHaveLength(1))
  })
})

describe("Referring Domains: the disavow file", () => {
  test("a confirmation first: the count and the warning; nothing is downloaded until the user confirms", async () => {
    serveLists({ disavowed: ["spam-one.com", "spam-two.net"] })
    renderPage()
    await loaded()
    await waitFor(() => expect(screen.getByTestId("rd-export-disavow").disabled).toBe(false))
    fireEvent.click(screen.getByTestId("rd-export-disavow"))
    const dialog = await screen.findByTestId("rd-disavow-dialog")
    expect(within(dialog).getByTestId("rd-disavow-count").textContent).toBe("The file will list 2 domains from your disavow list.")
    expect(within(dialog).getByTestId("rd-disavow-warning").textContent).toBe("Only disavow domains you are sure are harmful. Upload this file in Google Search Console's Disavow Links tool.")
    expect(stream.saveBlob).not.toHaveBeenCalled()
  })

  test("Download saves Google's format: a comment line, then 'domain:<domain>' per line", async () => {
    serveLists({ disavowed: ["spam-one.com", "spam-two.net"] })
    renderPage()
    await loaded()
    await waitFor(() => expect(screen.getByTestId("rd-export-disavow").disabled).toBe(false))
    fireEvent.click(screen.getByTestId("rd-export-disavow"))
    fireEvent.click(await screen.findByTestId("rd-disavow-download"))
    expect(stream.saveBlob).toHaveBeenCalledTimes(1)
    const [blob, name] = stream.saveBlob.mock.calls[0]
    expect(name).toMatch(/^disavow_asgeyehospital\.com_\d{4}-\d{2}-\d{2}\.txt$/)
    const text = await readBlob(blob)
    const lines = text.trim().split("\n")
    expect(lines[0]).toMatch(/^# Disavow file for asgeyehospital\.com — generated by Odito on \d{4}-\d{2}-\d{2}$/)
    expect(lines.slice(1)).toEqual(["domain:spam-one.com", "domain:spam-two.net"])
    expect((await screen.findByTestId("rd-disavow-done")).textContent).toBe("Downloaded 2 domains.")
  })
})

describe("Referring Domains: export", () => {
  test("Export current page: the rows on screen as a CSV (with the quality and flags), no request", async () => {
    renderPage()
    await loaded()
    const before = calls().length
    fireEvent.click(screen.getByTestId("rd-export-page"))
    const [name, content] = csv.downloadCsv.mock.calls[0]
    expect(name).toMatch(/^referring-domains_asgeyehospital\.com_page_\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = content.split("\r\n")
    expect(lines).toHaveLength(51)
    expect(lines[0]).toBe("Domain,Quality,Rank,Backlinks,Referring pages,Dofollow %,Spam score,Placement,Top country,Broken backlinks,First seen,Lost date,Disavowed")
    expect(lines[1]).toMatch(/^vasaneye\.com,Medium,258,761,761,100,0,footer,IN,761,/)
    expect(calls()).toHaveLength(before)
    expect(await screen.findByText("Exported 50 referring domains from this page.")).toBeTruthy()
  })

  test("Export with current filters: the count, the 10,000 cap and the estimated cost come first; nothing is bought before the user confirms", async () => {
    state.total = 50000
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("rd-export-all"))
    const dialog = await screen.findByTestId("rd-export-dialog")
    expect(within(dialog).getByTestId("rd-export-rows").textContent).toBe("10,000")
    expect(dialog.textContent).toContain("the first 10,000 by the current sort — 50,000 match")
    expect(within(dialog).getByTestId("rd-export-cost").textContent).toMatch(/10 requests of up to 1,000 rows, which costs about \$0\.40 \(an estimate\)/)
    expect(stream.downloadStreamedExport).not.toHaveBeenCalled()
  })

  test("Confirm: the server export runs with the page's own tab / dofollow / sort / filters; the file is saved when it arrives whole", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?tab=lost&dofollow=1&sort=backlinks%3Aasc&q=a")
    stream.downloadStreamedExport.mockResolvedValue({ blob: new Blob(["x"]), rows: 321, expected: 321 })
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("rd-export-all"))
    fireEvent.click(await screen.findByTestId("rd-export-start"))
    await waitFor(() => expect(stream.downloadStreamedExport).toHaveBeenCalledTimes(1))
    const [pid, endpoint, qs] = stream.downloadStreamedExport.mock.calls[0]
    expect([pid, endpoint]).toEqual(["p1", "referring-domains-export"])
    expect(Object.fromEntries(new URLSearchParams(qs))).toMatchObject({ status: "lost", dofollow: "1", order_by: "backlinks,asc", filters: '["domain","like","%a%"]' })
    expect(new URLSearchParams(qs).get("max_rows")).toMatch(/^\d+$/)
    expect((await screen.findByTestId("rd-export-done")).textContent).toContain("referring domains")
    expect(stream.saveBlob.mock.calls[0][1]).toMatch(/^referring-domains_asgeyehospital\.com_lost_(all|top-10000)_\d{4}-\d{2}-\d{2}\.csv$/)
  })

  test("it is not offered on the Disavowed tab (that list is yours, not a search)", async () => {
    serveLists({ disavowed: ["vasaneye.com"] })
    window.history.replaceState(null, "", "/app/referring-domains?tab=disavowed")
    renderPage()
    await waitFor(() => expect(rowEls()).toHaveLength(1))
    expect(screen.getByTestId("rd-export-all").disabled).toBe(true)
  })

  test("nothing to export: the items are disabled", async () => {
    serve({ "referring-domains": envelope("referring-domains", { totalCount: 0, items: [] }, { query: { status: "live", dofollow: false } }) })
    renderPage()
    await screen.findByTestId("rd-empty")
    expect(screen.getByTestId("rd-export-page").disabled).toBe(true)
    expect(screen.getByTestId("rd-export-all").disabled).toBe(true)
  })
})

describe("Referring Domains: cancelling and refreshing", () => {
  test("a request still running when the view changes is cancelled, and its answer never replaces the newer one", async () => {
    let release
    const gate = new Promise((r) => { release = r })
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[1] === "referring-domains" && a[2].referringDomains?.status === "lost") await gate; return base(...a) })
    renderPage()
    await loaded()
    fireEvent.click(tab("lost")) // slow
    await waitFor(() => expect(pageCalls()).toHaveLength(2))
    const slow = lastPage().signal
    expect(slow.aborted).toBe(false)
    expect(rowEls().length).toBe(50)
    expect(screen.getByTestId("rd-table").getAttribute("data-stale")).toBe("true")
    fireEvent.click(tab("toxic"))
    await waitFor(() => expect(slow.aborted).toBe(true))
    release()
    await sleep(60)
    await waitFor(() => expect(tab("toxic").getAttribute("aria-selected")).toBe("true"))
    expect(showing()).toMatch(/of 141 referring domains/)
  })

  test("Refresh asks the server to skip its cache for the table", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("rd-refresh"))
    await waitFor(() => expect(pageCalls()).toHaveLength(2))
    expect(lastPage().refresh).toBe(true)
    expect(pageCalls()[0].refresh).toBe(false)
  })

  test("a refresh the server declined (data under a minute old) says so", async () => {
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { const r = await base(...a); if (a[1] === "referring-domains" && a[2].refresh) r.data.refreshThrottled = true; return r })
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("rd-refresh"))
    expect(await screen.findByText(/refreshed less than a minute ago/)).toBeTruthy()
  })
})

describe("Referring Domains: states", () => {
  test("a failed table is an inline error with Retry; the cards still show", async () => {
    let fail = true
    const base = svc.getSection.getMockImplementation()
    svc.getSection.mockImplementation(async (...a) => { if (a[1] === "referring-domains" && fail) throw apiError("The data service is temporarily unavailable. Please try again later."); return base(...a) })
    renderPage()
    const alert = await within(await screen.findByTestId("rd-results")).findByRole("alert")
    expect(alert.textContent).toMatch(/temporarily unavailable/)
    expect(await screen.findByTestId("rd-summary")).toBeTruthy()
    fail = false
    fireEvent.click(within(alert).getByRole("button", { name: /Retry/ }))
    await loaded()
    expect(pageCalls()).toHaveLength(2)
  })

  test("no referring domains at all: 'No referring domains found for this domain yet.'", async () => {
    serve({ "referring-domains": envelope("referring-domains", { totalCount: 0, items: [] }, { query: { status: "live", dofollow: false } }) })
    renderPage()
    const empty = await screen.findByTestId("rd-empty")
    expect(empty.textContent).toBe("No referring domains found for this domain yet.")
    expect(within(empty).queryByRole("button", { name: "Clear filters" })).toBeNull()
  })

  test("an empty Toxic tab is a green success: 'No toxic domains found.'", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?tab=toxic")
    serve({ "referring-domains": envelope("referring-domains", { totalCount: 0, items: [] }, { query: { status: "live", dofollow: false } }) })
    renderPage()
    const empty = await screen.findByTestId("rd-empty")
    expect(empty.textContent).toBe("No toxic domains found.")
    expect(empty.getAttribute("data-kind")).toBe("success")
    expect(empty.className).toContain("emerald")
  })

  test("empty New and Lost tabs say so", async () => {
    window.history.replaceState(null, "", "/app/referring-domains?tab=lost")
    serve({ "referring-domains": envelope("referring-domains", { totalCount: 0, items: [] }, { query: { status: "lost", dofollow: false } }) })
    renderPage()
    expect((await screen.findByTestId("rd-empty")).textContent).toBe("No lost referring domains.")
    fireEvent.click(tab("new"))
    await waitFor(() => expect(screen.getByTestId("rd-empty").textContent).toBe("No new referring domains in the last 30 days."))
  })

  test("a project whose URL has no public domain name gets a plain explanation", async () => {
    serve({ "referring-domains": apiError("The project's website does not have a public domain name", { status: 422, code: "INVALID_TARGET" }) })
    renderPage()
    expect(await screen.findByText(/does not have a public domain name, so its referring domains cannot be loaded/)).toBeTruthy()
  })

  test("the saved lists failing to load does not stop the page", async () => {
    listsSvc.get.mockRejectedValue(apiError("The data service is busy."))
    renderPage()
    await loaded()
    expect(rowEls().length).toBe(50)
    expect(within(rowFor("vasaneye.com")).queryByTestId("rd-disavowed")).toBeNull()
  })
})

describe("Referring Domains: the compact layout", () => {
  test("on a phone the filters live in a drawer with a count", async () => {
    window.innerWidth = 390
    window.history.replaceState(null, "", "/app/referring-domains?q=a")
    renderPage()
    await loaded()
    expect((await screen.findByTestId("rd-filters-button")).textContent).toContain("Filters (1)")
  })
})
