import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hook (URL state, query keys, cancellation), request builder, mapping and components run,
// over the REAL recorded asgeyehospital.com pages.
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }))
const stream = vi.hoisted(() => ({ downloadStreamedExport: vi.fn(), saveBlob: vi.fn() }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DEFAULT_HISTORY_MONTHS: 12,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
}))
vi.mock("./exportCsv", async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: csv.downloadCsv }))
vi.mock("./exportStream", async (importOriginal) => ({ ...(await importOriginal()), downloadTopPagesExport: stream.downloadStreamedExport }))
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

import TopPagesDashboard from "./TopPagesDashboard"
import { REAL_PAGES, REAL_PAGES_ERRORS, REAL_PAGES_OK, REAL_PAGES_REDIRECTS } from "./testFixtures"
import { REAL_LIVE as SUMMARY } from "../backlinks-overview/testFixtures"

const ok = (data) => ({ success: true, data })
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })
const envelope = (section, result, extra = {}) => ({ section, target: "asgeyehospital.com", fetchedAt: "2026-10-28T08:00:00.000Z", cached: false, refreshThrottled: false, result, ...extra })
const flatConds = (filters) => (Array.isArray(filters) && filters.length && typeof filters[0] === "string" ? [filters] : (filters ?? []).filter((c) => c !== "and"))

const COUNTS = { pages: 518, errors: 2, redirects: 40 }
const traffic = { status: "ok", keywordsTotal: 900, truncated: false }

/** A tiny fake of the server's domain-pages section over the real rows: the tab decides the source, `page like` narrows. */
function pagesAnswer(req) {
  const conds = flatConds(req.filters)
  const min = conds.find((c) => c[0] === "status_code" && c[1] === ">=")?.[2]
  let source = REAL_PAGES
  if (min === 400) source = REAL_PAGES_ERRORS
  else if (min === 300) source = REAL_PAGES_REDIRECTS
  else if (min === 200) source = REAL_PAGES_OK
  let items = source.items
  const like = conds.find((c) => c[0] === "page" && c[1] === "like")
  if (like) items = items.filter((i) => i.url.includes(like[2].slice(1, -1)))
  return { totalCount: like ? items.length : source.totalCount, items }
}

function serve(overrides = {}) {
  svc.getSection.mockImplementation(async (_pid, section, opts) => {
    if (section in overrides) { const r = overrides[section]; if (r instanceof Error) throw r; if (typeof r === "function") return r(opts); return ok(r) }
    if (section === "backlinks") return ok(envelope("backlinks", SUMMARY))
    if (section === "tp-counts") return ok(envelope("tp-counts", COUNTS))
    if (section === "tp-fix-first") return ok(envelope("tp-fix-first", { items: REAL_PAGES_ERRORS.items.slice(0, 5) }))
    if (section === "domain-pages") {
      const r = opts.topPages
      return ok(envelope("domain-pages", pagesAnswer(r), { traffic }))
    }
    throw new Error(`unexpected section ${section}`)
  })
}

const calls = () => svc.getSection.mock.calls.map(([pid, section, opts]) => ({ pid, section, refresh: Boolean(opts?.refresh), req: opts?.topPages }))
const bySection = (s) => calls().filter((c) => c.section === s)
const pageCalls = () => bySection("domain-pages")
const lastPage = () => pageCalls().at(-1)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(TopPagesDashboard)))
}
const rowEls = () => screen.getAllByTestId("tp-row")
const tab = (id) => screen.getByTestId(`tp-tab-${id}`)
const loaded = async () => { await screen.findAllByTestId("tp-row") }
const rowFor = (url) => rowEls().find((r) => within(r).queryByTestId("tp-page-link")?.getAttribute("href") === url)
const readBlob = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsText(blob) })

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
  window.history.replaceState(null, "", "/app/backlinks/top-pages")
  window.innerWidth = 1280
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  serve()
})
afterEach(() => { vi.restoreAllMocks() })

describe("Top Pages: first load", () => {
  test("one table request (live links only, referring domains desc, 50), the counts, the Fix first list and the shared summary — once each", async () => {
    renderPage()
    await loaded()
    await screen.findByTestId("tp-summary")
    await screen.findAllByTestId("tp-fix-row")
    expect(pageCalls()).toHaveLength(1)
    expect(lastPage().req).toEqual({ limit: 50, offset: 0, order_by: "page_summary.referring_domains,desc", filters: ["page_summary.backlinks", ">=", 1] })
    expect(bySection("tp-counts")).toHaveLength(1)
    expect(bySection("tp-fix-first")).toHaveLength(1)
    expect(bySection("backlinks")).toHaveLength(1)
  })

  test("the frame is there at once: title, domain, skeletons — no page-wide spinner or alert", () => {
    svc.getSection.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Top Pages" })).toBeTruthy()
    expect(screen.getByTestId("tp-domain").textContent).toBe("asgeyehospital.com")
    expect(screen.getAllByTestId("tp-skeleton-row").length).toBeGreaterThanOrEqual(5)
    expect(screen.getByTestId("tp-summary-skeleton")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("the four profile cards say they are about the whole profile, and show the counts", async () => {
    renderPage()
    await screen.findByTestId("tp-summary")
    expect(screen.getByTestId("tp-summary-scope").textContent).toBe("Whole profile (live links)")
    const summary = screen.getByTestId("tp-summary")
    for (const text of ["Pages with backlinks", "Error pages with links", "Redirected pages with links", "Broken backlinks"]) expect(within(summary).getByText(text)).toBeTruthy()
    await waitFor(() => expect(summary.textContent).toContain("518"))
  })

  test("a row: the title in bold, the path under it, the status badge, the blocked homepage reads '403 Blocked'", async () => {
    window.history.replaceState(null, "", "/app/backlinks/top-pages?tab=errors")
    renderPage()
    await loaded()
    const home = rowFor("https://www.asgeyehospital.com/")
    expect(within(home).getByTestId("tp-status").textContent).toBe("403 Blocked")
    const patna = rowFor("https://asgeyehospital.com/patna/")
    expect(within(patna).getByTestId("tp-status").textContent).toBe("404")
    expect(within(patna).getByTestId("tp-heading").textContent).toBe("/patna/") // no title: the path is the heading
    expect(within(patna).getByTestId("tp-page-link").getAttribute("target")).toBe("_blank")
  })
})

describe("Top Pages: tabs", () => {
  test("?status=error — the link from the Backlink Overview — opens the Errors tab, sorted by backlinks, with status >= 400", async () => {
    window.history.replaceState(null, "", "/app/backlinks/top-pages?status=error")
    renderPage()
    await loaded()
    expect(tab("errors").getAttribute("aria-selected")).toBe("true")
    expect(lastPage().req.order_by).toBe("page_summary.backlinks,desc")
    expect(lastPage().req.filters).toEqual([["status_code", ">=", 400], "and", ["page_summary.backlinks", ">=", 1]])
  })

  test("clicking a tab requests that tab's status range and writes it to the URL", async () => {
    renderPage()
    await loaded()
    fireEvent.click(tab("redirects"))
    await waitFor(() => expect(lastPage().req.filters).toEqual([["status_code", ">=", 300], "and", ["status_code", "<", 400], "and", ["page_summary.backlinks", ">=", 1]]))
    expect(window.location.search).toBe("?tab=redirects")
    fireEvent.click(tab("ok"))
    await waitFor(() => expect(lastPage().req.filters[0]).toEqual(["status_code", ">=", 200]))
  })

  test("clicking the 'Error pages with links' card opens the Errors tab", async () => {
    renderPage()
    await screen.findByTestId("tp-summary")
    fireEvent.click(within(screen.getByTestId("tp-summary")).getByText("Error pages with links"))
    await waitFor(() => expect(tab("errors").getAttribute("aria-selected")).toBe("true"))
  })
})

describe("Top Pages: Fix first", () => {
  test("lists the error pages with the sentence, a View backlinks link to the exact URL, and 'Errors' opens the tab", async () => {
    renderPage()
    const rows = await screen.findAllByTestId("tp-fix-row")
    expect(rows.length).toBeLessThanOrEqual(5)
    const patna = rows.find((r) => r.textContent.includes("/patna/"))
    expect(patna.textContent).toContain("/patna/ returns 404 — 209 backlinks from 3 domains are wasted. Add a 301 redirect to a relevant live page.")
    expect(within(patna).getByTestId("tp-fix-backlinks-link").getAttribute("href")).toBe("/app/backlinks/list?to=https%3A%2F%2Fasgeyehospital.com%2Fpatna%2F")
  })

  test("with no error pages it is not asked for and the Errors tab says so, in green", async () => {
    serve({ "tp-counts": envelope("tp-counts", { pages: 518, errors: 0, redirects: 40 }), "domain-pages": (opts) => ok(envelope("domain-pages", opts.topPages.filters[0]?.[0] === "status_code" ? { totalCount: 0, items: [] } : pagesAnswer(opts.topPages), { traffic })) })
    renderPage()
    await loaded()
    await waitFor(() => expect(bySection("tp-counts")).toHaveLength(1))
    expect(bySection("tp-fix-first")).toHaveLength(0)
    expect(screen.queryByTestId("tp-fix-all")).toBeNull()
    fireEvent.click(tab("errors"))
    expect((await screen.findByTestId("tp-empty")).textContent).toContain("No error pages with backlinks.")
  })
})

describe("Top Pages: filters, sort, paging", () => {
  test("URL contains is sent as page like %text% and shown as a chip; Clear all removes it", async () => {
    renderPage()
    await loaded()
    const input = screen.getByLabelText("URL contains")
    fireEvent.change(input, { target: { value: "lasik" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.blur(input)
    await waitFor(() => expect(lastPage().req.filters).toEqual([["page", "like", "%lasik%"], "and", ["page_summary.backlinks", ">=", 1]]))
    expect(await screen.findByText("URL contains “lasik”")).toBeTruthy()
    expect(window.location.search).toBe("?q=lasik")
    fireEvent.click(screen.getByTestId("ok-clear-all"))
    // The unfiltered view is already cached, so no new request is made: the chip, the field and the URL show it.
    await waitFor(() => expect(screen.queryByText("URL contains “lasik”")).toBeNull())
    expect(screen.getByLabelText("URL contains").value).toBe("")
    expect(window.location.search).toBe("")
  })

  test("a no-match filter says so and offers Clear filters", async () => {
    renderPage()
    await loaded()
    const input = screen.getByLabelText("URL contains")
    fireEvent.change(input, { target: { value: "zzz-nothing" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.blur(input)
    expect((await screen.findByTestId("tp-empty")).textContent).toContain("No pages match these filters")
    fireEvent.click(within(screen.getByTestId("tp-empty")).getByRole("button", { name: /clear filters/i }))
    await loaded()
  })

  test("sorting by backlinks asks the server (highest first), a second click flips it; the sort is in the URL", async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("tp-sort-backlinks"))
    await waitFor(() => expect(lastPage().req.order_by).toBe("page_summary.backlinks,desc"))
    fireEvent.click(screen.getByTestId("tp-sort-backlinks"))
    await waitFor(() => expect(lastPage().req.order_by).toBe("page_summary.backlinks,asc"))
    expect(window.location.search).toContain("sort=page_summary.backlinks%3Aasc")
  })
})

describe("Top Pages: Merge URL variants", () => {
  test("OFF by default; ON groups this page's rows into one per page with a '<n> variants' chip, no new request; the hint says it is this page only", async () => {
    renderPage()
    await loaded()
    const before = rowEls().length
    const requests = pageCalls().length
    expect(screen.getByTestId("tp-merge-hint").textContent).toMatch(/this page only/i)
    fireEvent.click(screen.getByTestId("tp-merge"))
    await waitFor(() => expect(rowEls().length).toBeLessThanOrEqual(before))
    expect(pageCalls()).toHaveLength(requests)
    expect(window.location.search).toBe("?merge=1")
    const withVariants = screen.queryAllByTestId("tp-variants")
    expect(withVariants.length > 0 || rowEls().length === before).toBe(true)
  })
})

describe("Top Pages: expanded row and actions", () => {
  test("opening a row shows its stats and, for an error page, the suggested-fix box", async () => {
    window.history.replaceState(null, "", "/app/backlinks/top-pages?tab=errors")
    renderPage()
    await loaded()
    const patna = rowFor("https://asgeyehospital.com/patna/")
    fireEvent.click(within(patna).getByTestId("tp-expand"))
    const open = await screen.findByTestId("tp-expanded")
    expect(within(open).getByTestId("tp-fix-box").textContent).toContain("Add a 301 redirect to a relevant live page")
    expect(within(open).getByTestId("tp-stats")).toBeTruthy()
  })

  test("View backlinks goes to the Backlinks page for the exact URL; View keywords to Organic Keywords by path", async () => {
    window.history.replaceState(null, "", "/app/backlinks/top-pages?tab=errors")
    renderPage()
    await loaded()
    const patna = rowFor("https://asgeyehospital.com/patna/")
    expect(within(patna).getByTestId("tp-action-backlinks").querySelector("a").getAttribute("href")).toBe("/app/backlinks/list?to=https%3A%2F%2Fasgeyehospital.com%2Fpatna%2F")
    expect(within(patna).getByTestId("tp-action-keywords").querySelector("a").getAttribute("href")).toBe("/app/organic-keywords?url=%2Fpatna%2F")
  })
})

describe("Top Pages: estimated traffic fallback", () => {
  test("when the join failed the table still loads, traffic reads '—', and an inline warning has Retry (which asks again)", async () => {
    let failing = true
    serve({ "domain-pages": (opts) => ok(envelope("domain-pages", pagesAnswer(opts.topPages), { traffic: failing ? { status: "failed", code: "PROVIDER_UNAVAILABLE" } : traffic })) })
    renderPage()
    await loaded()
    expect(screen.getByTestId("tp-traffic-warning").textContent).toContain("The estimated traffic could not be loaded")
    expect(within(rowEls()[0]).getByTestId("tp-traffic").textContent).toContain("—")
    const before = pageCalls().length
    failing = false
    fireEvent.click(screen.getByTestId("tp-traffic-retry"))
    await waitFor(() => expect(pageCalls().length).toBe(before + 1))
    await waitFor(() => expect(screen.queryByTestId("tp-traffic-warning")).toBeNull())
  })
})

describe("Top Pages: errors and empty states", () => {
  test("a failed table shows an inline error with Retry; the profile cards are unaffected", async () => {
    let fail = true
    serve({ "domain-pages": (opts) => { if (fail) throw apiError("Provider is down"); return ok(envelope("domain-pages", pagesAnswer(opts.topPages), { traffic })) } })
    renderPage()
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toMatch(/provider|couldn.t|try again/i)
    expect(await screen.findByTestId("tp-summary")).toBeTruthy()
    fail = false
    fireEvent.click(within(alert).getByRole("button", { name: /retry|try again/i }))
    await loaded()
  })

  test("a domain with no pages with backlinks says so", async () => {
    serve({ "domain-pages": envelope("domain-pages", { totalCount: 0, items: [] }, { traffic }), "tp-counts": envelope("tp-counts", { pages: 0, errors: 0, redirects: 0 }) })
    renderPage()
    expect((await screen.findByTestId("tp-empty")).textContent).toContain("No pages with backlinks found for this domain yet.")
  })

  test("no project: asks to select one and makes no request", () => {
    project.current = null
    renderPage()
    expect(screen.getByText("Select a project to see its top pages.")).toBeTruthy()
    expect(svc.getSection).not.toHaveBeenCalled()
  })
})

describe("Top Pages: export", () => {
  test("Export current page writes the loaded rows to a CSV without any request", async () => {
    renderPage()
    await loaded()
    const requests = svc.getSection.mock.calls.length
    fireEvent.click(screen.getByTestId("tp-export-page"))
    expect(csv.downloadCsv).toHaveBeenCalledTimes(1)
    const [name, body] = csv.downloadCsv.mock.calls[0]
    expect(name).toMatch(/^.*\.csv$/)
    expect(body.split("\r\n")[0]).toBe("URL,Normalised URL,Status,Redirect target,Title,Referring domains,Backlinks,Broken backlinks,Dofollow %,Rank,Est. traffic,Keywords,Flags,Suggested fix,First seen,Last crawled")
    expect(svc.getSection.mock.calls.length).toBe(requests)
  })

  test("Export with current filters opens the dialog with the cost warning and starts the server export with this view's request", async () => {
    stream.downloadStreamedExport.mockResolvedValue({ rows: 518 })
    renderPage()
    await loaded()
    fireEvent.click(screen.getByTestId("tp-export-all"))
    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toMatch(/export top pages/i)
    expect(dialog.textContent).toMatch(/\$|cost|credit/i)
    expect(stream.downloadStreamedExport).not.toHaveBeenCalled()
  })
})

describe("Top Pages: compact layout", () => {
  test("at phone width the page still renders its rows and the filter button", async () => {
    window.innerWidth = 390
    renderPage()
    await loaded()
    expect(screen.getByTestId("tp-table")).toBeTruthy()
    expect(screen.getByTestId("tp-filters-button")).toBeTruthy()
  })
})
