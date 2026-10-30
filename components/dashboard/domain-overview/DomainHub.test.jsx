import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, configure } from "@testing-library/react"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hooks (both the five sections and the hub's extra sources), query keys, mapping and components run.
const svc = vi.hoisted(() => ({ getSection: vi.fn() }))
const competitorSvc = vi.hoisted(() => ({ get: vi.fn(), addExcluded: vi.fn(), data: { tracked: [], excluded: [], limits: { tracked: 10, excluded: 1000 } } }))
const anchorSvc = vi.hoisted(() => ({ get: vi.fn(), data: { saved: false, brand_terms: [], target_keywords: [] } }))
const project = vi.hoisted(() => ({ current: { _id: "p1", main_url: "https://www.asgeyehospital.com" } }))
vi.mock("@/services/domainOverviewService", () => ({
  default: svc,
  domainOverviewService: svc,
  DOMAIN_OVERVIEW_SECTIONS: ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"],
  DEFAULT_HISTORY_MONTHS: 12,
}))
vi.mock("@/services/competitorSettingsService", () => ({ default: competitorSvc, competitorSettingsService: competitorSvc }))
vi.mock("@/services/anchorSettingsService", () => ({ default: anchorSvc, anchorSettingsService: anchorSvc }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: project.current }) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import DomainOverviewDashboard from "./DomainOverviewDashboard"
import { rankOverview, history, rankedKeywords, competitors, backlinks, envelope, organic } from "./testFixtures"
import { REAL_PAGES_ERRORS, REAL_PAGES_OK } from "../top-pages/testFixtures"
import { REAL_BULK_ITEMS } from "../competitors/testFixtures"
import { REAL_PROFILE } from "../anchors/testFixtures"

const ok = (data) => ({ success: true, data })
const apiError = (message, { status = 502, code = "PROVIDER_UNAVAILABLE" } = {}) => Object.assign(new Error(message), { status, code })
const FIVE = ["rank-overview", "history", "ranked-keywords", "competitors", "backlinks"]
const KW = "keyword_data.keyword"

/** Healthy defaults: nothing wrong anywhere. A test overrides what it needs. */
const quiet = () => ({
  "rank-overview": rankOverview(),
  "history": history([{ year: 2026, month: 10, etv: 110000, count: 4166 }, { year: 2026, month: 9, etv: 100000, count: 4100 }]),
  "ranked-keywords": rankedKeywords(),
  "competitors": competitors(),
  "backlinks": backlinks({ broken_backlinks: 10, backlinks_spam_score: 10, referring_domains: 1000, referring_links_countries: { "": 200, IN: 150, US: 50, WW: 40 }, referring_pages: 500 }),
  "tp-counts": envelope("tp-counts", { pages: 518, errors: 0, redirects: 3 }),
  "tp-fix-first": envelope("tp-fix-first", { totalCount: 0, items: [] }),
  "rd-toxic-count": envelope("rd-toxic-count", { count: 5, spamAbove: 30 }),
  "rd-last-30": envelope("rd-last-30", { since: "2026-09-28", days: 30, new: 41, lost: 12 }),
  "domain-pages": envelope("domain-pages", REAL_PAGES_OK, { traffic: { status: "ok" } }),
  "anchor-profile": envelope("anchor-profile", null, { peek: true, cached: false, fetchedAt: null }),
  "bulk-traffic": envelope("bulk-traffic", null, { peek: true, cached: false, fetchedAt: null }),
})

let overrides
/** Answer by section; an override may be a payload, an Error, or a function of (opts). */
function serve(extra = {}) {
  overrides = { ...quiet(), ...extra }
  svc.getSection.mockImplementation(async (_pid, section, opts) => {
    // The Brand / Non-brand variants of the top-5 request carry filters; the plain one does not.
    const r = section === "ranked-keywords" && opts?.query?.filters?.length && overrides["ranked-keywords:filtered"] ? overrides["ranked-keywords:filtered"] : overrides[section]
    if (r instanceof Error) throw r
    if (typeof r === "function") return r(opts)
    return ok(r)
  })
}
const calls = () => svc.getSection.mock.calls.map(([pid, section, opts]) => ({ pid, section, opts: opts ?? {} }))
const bySection = (s) => calls().filter((c) => c.section === s)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(DomainOverviewDashboard)))
}
const fix = () => screen.getByTestId("do-fix-first")
const issues = () => within(fix()).queryAllByTestId("do-issue")
const settled = async () => { await screen.findByText("100.4K"); await waitFor(() => expect(screen.queryByTestId("do-fix-skeleton")).toBeNull()) }

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 })
  vi.setConfig({ testTimeout: 30000 })
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
  vi.clearAllMocks()
  project.current = { _id: "p1", main_url: "https://www.asgeyehospital.com" }
  competitorSvc.data = { tracked: [], excluded: [], limits: { tracked: 10, excluded: 1000 } }
  competitorSvc.get.mockImplementation(async () => ({ success: true, data: structuredClone(competitorSvc.data) }))
  anchorSvc.data = { saved: false, brand_terms: [], target_keywords: [] }
  anchorSvc.get.mockImplementation(async () => ({ success: true, data: anchorSvc.data }))
  serve()
})

describe("Fix first", () => {
  test("directly under the KPI cards; with every check healthy it says so in a green row", async () => {
    renderPage()
    await settled()
    const kpis = screen.getByTestId("do-kpis")
    expect(kpis.compareDocumentPosition(fix()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(fix()).getByTestId("do-fix-clear").textContent).toBe("No urgent issues found. Nice work.")
    expect(issues()).toHaveLength(0)
  })

  test("ranks the issues from the cached sources: severity first, each with its why and the button to the right page", async () => {
    serve({
      "backlinks": backlinks({ broken_backlinks: 3000, backlinks: 18297, referring_domains: 1000, referring_pages: 500 }), // 16.4% broken: warning
      "tp-counts": envelope("tp-counts", { pages: 518, errors: 138, redirects: 3 }),
      "tp-fix-first": envelope("tp-fix-first", { totalCount: 138, items: REAL_PAGES_ERRORS.items }),
      "rd-toxic-count": envelope("rd-toxic-count", { count: 350, spamAbove: 30 }), // 35%: critical
      "history": history([{ year: 2026, month: 10, etv: 70000, count: 4100 }, { year: 2026, month: 9, etv: 100000, count: 4100 }]), // -30%: warning
      "rank-overview": rankOverview({ organic: organic({ is_new: 10, is_lost: 40 }) }),
    })
    renderPage()
    await settled()
    await waitFor(() => expect(issues().length).toBe(5))
    expect(issues().map((i) => [i.getAttribute("data-rule"), i.getAttribute("data-severity")])).toEqual([
      ["errorPages", "critical"], ["highSpam", "critical"], ["keywordsLost", "warning"], ["brokenBacklinks", "warning"], ["trafficDrop", "warning"],
    ])
    const first = issues()[0]
    expect(first.textContent).toContain("138 pages with backlinks return errors — top: www.asgeyehospital.com/ (403, 852 links)")
    expect(within(first).getByTestId("do-issue-cta").getAttribute("href")).toBe("/app/backlinks/top-pages?status=error")
    expect(within(issues()[1]).getByTestId("do-issue-cta").getAttribute("href")).toBe("/app/referring-domains?tab=toxic")
    expect(within(issues()[3]).getByTestId("do-issue-cta").getAttribute("href")).toBe("/app/backlinks/list?broken=true")
    expect(within(issues()[4]).getByTestId("do-issue-cta").getAttribute("href")).toBe("/app/traffic-history")
    for (const i of issues()) expect(within(i).getByText(/\w{4,}/, { selector: "p.text-muted-foreground" })).toBeTruthy()
  })

  test("the high-spam rule uses the Referring Domains page's own count (no extra provider section) and spam-score is deduped away", async () => {
    serve({ "rd-toxic-count": envelope("rd-toxic-count", { count: 150, spamAbove: 30 }), "backlinks": backlinks({ backlinks_spam_score: 80, referring_domains: 1000, broken_backlinks: 10 }) })
    renderPage()
    await settled()
    await waitFor(() => expect(issues().map((i) => i.getAttribute("data-rule"))).toEqual(["highSpam"]))
    expect(bySection("rd-toxic-count")).toHaveLength(1)
  })

  test("it fills in as sources arrive: a skeleton while one is outstanding, and no 'all clear' before everything has answered", async () => {
    let release
    const gate = new Promise((r) => { release = r })
    serve({ "rd-toxic-count": async () => { await gate; return ok(envelope("rd-toxic-count", { count: 5, spamAbove: 30 })) } })
    renderPage()
    await screen.findByText("100.4K")
    await screen.findByTestId("do-fix-skeleton")
    expect(screen.queryByTestId("do-fix-clear")).toBeNull()
    release()
    await screen.findByTestId("do-fix-clear")
    expect(screen.queryByTestId("do-fix-skeleton")).toBeNull()
  })

  test("one failing source hides only its rule: the other issues stay, a small note offers Retry, and Retry asks only that source again", async () => {
    let healthy = false
    serve({
      "rd-toxic-count": () => { if (!healthy) throw apiError("The data service is busy."); return ok(envelope("rd-toxic-count", { count: 600, spamAbove: 30 })) },
      "tp-counts": envelope("tp-counts", { pages: 518, errors: 2, redirects: 3 }),
      "tp-fix-first": envelope("tp-fix-first", { totalCount: 2, items: REAL_PAGES_ERRORS.items.slice(1, 2) }),
    })
    renderPage()
    const note = await screen.findByTestId("do-fix-partial")
    expect(note.textContent).toContain("Some checks couldn't load")
    expect(issues().map((i) => i.getAttribute("data-rule"))).toEqual(["errorPages"])
    expect(issues()[0].textContent).toContain("2 pages with backlinks return errors — top: /patna/ (404, 209 links)")
    const before = calls().length
    healthy = true
    fireEvent.click(within(note).getByTestId("do-fix-retry"))
    await waitFor(() => expect(issues().map((i) => i.getAttribute("data-rule"))).toContain("highSpam"))
    expect(calls().slice(before).map((c) => c.section)).toEqual(["rd-toxic-count"])
    expect(screen.queryByTestId("do-fix-partial")).toBeNull()
  })

  test("if EVERY check failed it does not claim all is well", async () => {
    serve({ "tp-counts": apiError("x"), "rd-toxic-count": apiError("x"), "anchor-profile": apiError("x"), "history": apiError("x"), "rank-overview": apiError("x"), "backlinks": apiError("x") })
    renderPage()
    await screen.findByTestId("do-fix-partial")
    expect(screen.queryByTestId("do-fix-clear")).toBeNull()
  })

  test("the anchor rule appears (info) only when the anchor profile is already cached, and uses the saved settings", async () => {
    // Two anchors: "cataract surgery" (a saved target keyword) has 300 of the 1,000 referring domains, "ASG Eye Hospital" (branded) 700.
    const row = REAL_PROFILE.items[3]
    const profile = { totalCount: 2, items: [{ ...row, anchor: "cataract surgery", referring_domains: 300 }, { ...row, anchor: "ASG Eye Hospital", referring_domains: 700 }] }
    anchorSvc.data = { saved: true, brand_terms: ["asg"], target_keywords: ["cataract surgery"] }
    serve({ "anchor-profile": envelope("anchor-profile", profile, { peek: true, cached: true }) })
    renderPage()
    await settled()
    const anchors = await waitFor(() => { const a = issues().find((i) => i.getAttribute("data-rule") === "anchors"); expect(a).toBeTruthy(); return a })
    expect(anchors.getAttribute("data-severity")).toBe("info")
    expect(anchors.textContent).toContain("Exact-match anchors are 30.0% of your anchor profile")
    expect(within(anchors).getByTestId("do-issue-cta").getAttribute("href")).toBe("/app/backlinks/anchors")
  })
})

describe("the anchor profile is only ever PEEKED", () => {
  test("every anchor-profile request from the dashboard carries peek, and none is a refresh: API 8 can never be bought from here", async () => {
    renderPage()
    await settled()
    const anchorCalls = bySection("anchor-profile")
    expect(anchorCalls.length).toBeGreaterThan(0)
    expect(anchorCalls.every((c) => c.opts.peek === true && !c.opts.refresh)).toBe(true)
    expect(bySection("anchors")).toHaveLength(0)
  })

  test("not cached: the mix says where to get it (a link to Anchors) and no anchor issue appears", async () => {
    renderPage()
    await settled()
    const empty = await screen.findByTestId("do-anchor-mix-empty")
    expect(empty.textContent).toBe("Open Anchors to analyse your anchor mix")
    expect(within(empty).getByRole("link").getAttribute("href")).toBe("/app/backlinks/anchors")
    expect(screen.queryByTestId("do-anchor-mix")).toBeNull()
    expect(issues().some((i) => i.getAttribute("data-rule") === "anchors")).toBe(false)
  })

  test("cached: one stacked bar summing to 100%, the Anchors page's types in a legend, the whole block links to Anchors", async () => {
    anchorSvc.data = { saved: true, brand_terms: ["asg", "asg eye hospital"], target_keywords: ["cataract surgery"] }
    serve({ "anchor-profile": envelope("anchor-profile", REAL_PROFILE, { peek: true, cached: true }) })
    renderPage()
    const mix = await screen.findByTestId("do-anchor-mix")
    expect(mix.tagName).toBe("A")
    expect(mix.getAttribute("href")).toBe("/app/backlinks/anchors")
    const widths = within(mix).getAllByTestId("do-anchor-segment").map((s) => parseFloat(s.style.width))
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 4)
    expect(within(mix).getAllByRole("listitem").length).toBe(widths.length)
    expect(within(mix).getAllByTestId("do-anchor-segment").every((s) => /^#[0-9a-f]{6}$/i.test(s.style.backgroundColor) || s.style.backgroundColor.startsWith("rgb"))).toBe(true)
  })
})

describe("Keyword positions and movement are clickable", () => {
  test("each position bar opens Organic Keywords with that range", async () => {
    renderPage()
    await settled()
    const hrefs = Array.from(screen.getByRole("list", { name: "Keywords per position range" }).querySelectorAll("a")).map((a) => a.getAttribute("href"))
    expect(hrefs).toEqual(["top1", "2-3", "4-10", "11-20", "21-50", "51-100"].map((p) => `/app/organic-keywords?pos=${p}`))
  })

  test("New / Improved / Declined open Organic Keywords with the movement; Lost is not a link and explains why", async () => {
    renderPage()
    await settled()
    expect(["new", "improved", "declined"].map((k) => screen.getByTestId(`do-movement-link-${k}`).getAttribute("href"))).toEqual([
      "/app/organic-keywords?mv=new", "/app/organic-keywords?mv=up", "/app/organic-keywords?mv=down",
    ])
    const lost = screen.getByTestId("do-movement-lost-box")
    expect(lost.tagName).toBe("DIV")
    expect(lost.getAttribute("title")).toBe("Lost keywords are no longer ranking, so they can't be listed.")
    expect(within(screen.getByTestId("do-movement")).queryAllByRole("link")).toHaveLength(3)
  })

  test("Net = new - lost: red and signed with a real minus when negative, green with + when positive, singular for one", async () => {
    renderPage() // 2,788 new - 2,423 lost = +365
    await settled()
    const net = screen.getByTestId("do-net")
    expect(net.textContent).toBe("Net: +365 keywords this month")
    expect(net.getAttribute("data-direction")).toBe("up")
    expect(net.className).toMatch(/emerald/)
  })

  test("a negative net (the spec's own example: new 12, lost 20) reads −8 and is red", async () => {
    serve({ "rank-overview": rankOverview({ organic: organic({ is_new: 12, is_lost: 20, is_up: 100, is_down: 5 }) }) }) // improved / declined do NOT count
    renderPage()
    await settled()
    const net = screen.getByTestId("do-net")
    expect(net.textContent).toBe("Net: −8 keywords this month")
    expect(net.getAttribute("data-direction")).toBe("down")
    expect(net.className).toMatch(/red/)
  })

  test("one keyword is singular; zero is neutral; nothing at all is not shown", async () => {
    serve({ "rank-overview": rankOverview({ organic: organic({ is_new: 5, is_lost: 4 }) }) })
    const { unmount } = renderPage()
    await settled()
    expect(screen.getByTestId("do-net").textContent).toBe("Net: +1 keyword this month")
    unmount()
    serve({ "rank-overview": rankOverview({ organic: organic({ is_new: 4, is_lost: 4 }) }) })
    renderPage()
    await settled()
    expect(screen.getByTestId("do-net").textContent).toBe("Net: 0 keywords this month")
    expect(screen.getByTestId("do-net").getAttribute("data-direction")).toBe("flat")
  })
})

describe("Top keywords: All / Non-brand / Brand", () => {
  const saveBrand = (terms = ["asg", "asg eye hospital"]) => { anchorSvc.data = { saved: true, brand_terms: terms, target_keywords: [] } }
  const NONBRAND = [[KW, "not_like", "%asg%"], "and", [KW, "not_like", "%asg eye hospital%"]]
  const BRAND = [[[KW, "like", "%asg%"], "or", [KW, "like", "%asg eye hospital%"]]]
  const filteredCalls = () => bySection("ranked-keywords").filter((c) => c.opts.query?.filters?.length)

  test("no saved brand terms: the toggle is disabled, All is selected, the hint links to Anchor settings, and only the plain top-5 is requested", async () => {
    renderPage()
    await settled()
    const group = screen.getByRole("group", { name: "Which keywords" })
    const buttons = within(group).getAllByRole("button")
    expect(buttons.map((b) => [b.textContent, b.disabled])).toEqual([["All", true], ["Non-brand", true], ["Brand", true]])
    expect(within(group).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true")
    const hint = screen.getByTestId("do-brand-hint")
    expect(hint.textContent).toBe("Add brand terms in Anchors → Anchor settings")
    expect(hint.getAttribute("href")).toBe("/app/backlinks/anchors")
    expect(filteredCalls()).toHaveLength(0)
    expect(screen.getByTestId("do-view-all-keywords").getAttribute("href")).toBe("/app/organic-keywords")
  })

  test("saved terms: Non-brand is the default and asks for the top 5 by traffic with one not_like per term", async () => {
    saveBrand()
    serve({ "ranked-keywords:filtered": envelope("ranked-keywords", { totalCount: 3900, items: [{ keyword: "lasik cost", search_volume: 5400, keyword_difficulty: 31, position: 7, position_absolute: 7, previous_position: 5, rank_changes_known: true, etv: 900, relative_url: "/lasik/" }] }) })
    renderPage()
    await screen.findByText("lasik cost")
    expect(within(screen.getByRole("group", { name: "Which keywords" })).getByRole("button", { name: "Non-brand" }).getAttribute("aria-pressed")).toBe("true")
    expect(filteredCalls().map((c) => c.opts.query)).toEqual([{ limit: 5, offset: 0, order_by: "ranked_serp_element.serp_item.etv,desc", filters: NONBRAND }])
    expect(screen.queryByTestId("do-brand-hint")).toBeNull()
    expect(screen.getByTestId("do-view-all-keywords").textContent.trim()).toBe("View all 3,900 keywords")
    expect(screen.getByTestId("do-view-all-keywords").getAttribute("href")).toBe("/app/organic-keywords?brand=non")
  })

  test("Brand is ONE 'or' group of like conditions; All goes back to the plain list without a new request; each variant is requested once", async () => {
    saveBrand()
    serve({ "ranked-keywords:filtered": envelope("ranked-keywords", { totalCount: 240, items: [{ keyword: "asg eye hospital", search_volume: 74000, keyword_difficulty: 0, position: 1, position_absolute: 1, previous_position: 1, rank_changes_known: true, etv: 23000, relative_url: "/" }] }) })
    renderPage()
    await screen.findByText("asg eye hospital")
    const group = screen.getByRole("group", { name: "Which keywords" })
    fireEvent.click(within(group).getByRole("button", { name: "Brand" }))
    await waitFor(() => expect(filteredCalls().some((c) => JSON.stringify(c.opts.query.filters) === JSON.stringify(BRAND))).toBe(true))
    expect((await screen.findByTestId("do-view-all-keywords")).getAttribute("href")).toBe("/app/organic-keywords?brand=only")
    const requests = bySection("ranked-keywords").length
    fireEvent.click(within(group).getByRole("button", { name: "All" }))
    await waitFor(() => expect(screen.getByTestId("do-top-keywords").getAttribute("data-mode")).toBe("all"))
    fireEvent.click(within(group).getByRole("button", { name: "Non-brand" }))
    fireEvent.click(within(group).getByRole("button", { name: "Brand" }))
    expect((await screen.findByTestId("do-view-all-keywords")).getAttribute("href")).toBe("/app/organic-keywords?brand=only")
    expect(bySection("ranked-keywords").length).toBe(requests) // all three variants are already in the browser's cache
  })

  test("more than 6 terms: the 6 shortest are used", async () => {
    saveBrand(["alpha-one", "bb", "cc", "ddd", "eeee", "fffff", "gggggg", "hhhhhhh"])
    renderPage()
    await settled()
    await waitFor(() => expect(filteredCalls().length).toBe(1))
    const conds = filteredCalls()[0].opts.query.filters.filter((c) => c !== "and")
    expect(conds.map((c) => c[2])).toEqual(["%bb%", "%cc%", "%ddd%", "%eeee%", "%fffff%", "%gggggg%"])
  })

  test("a variant that fails shows its own error with Retry; the plain list is untouched underneath", async () => {
    saveBrand()
    let healthy = false
    serve({ "ranked-keywords:filtered": () => { if (!healthy) throw apiError("The data service is busy."); return ok(envelope("ranked-keywords", { totalCount: 1, items: [] })) } })
    renderPage()
    const panel = (await screen.findByRole("heading", { name: "Top keywords" })).closest("section")
    const alert = await within(panel).findByRole("alert")
    expect(alert.textContent).toMatch(/busy/)
    healthy = true
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(filteredCalls().length).toBeGreaterThan(1))
  })
})

describe("Top competitors: pinned first, head-to-head", () => {
  const LISTED = "centreforsight.net" // the second row of the fixture list
  const rowsText = () => within(screen.getByTestId("do-competitors")).getAllByTestId("do-competitor-row")

  test("without pinned competitors: the list's first rows, no stars, a head-to-head split per row instead of 'their traffic'", async () => {
    renderPage()
    await screen.findByText("dragarwal.com")
    expect(rowsText().map((r) => r.querySelector("td").textContent)).toEqual(["dragarwal.com", "centreforsight.net", "aao.org"])
    expect(screen.queryAllByTestId("do-tracked-star")).toHaveLength(0)
    expect(screen.queryByText("Their traffic")).toBeNull()
    expect(within(screen.getByTestId("do-competitors")).getAllByTestId("do-h2h").length).toBe(3)
  })

  test("a pinned competitor in the list comes first with a star; the leader's bar is green when we lead and red when they do", async () => {
    competitorSvc.data = { tracked: [LISTED], excluded: [], limits: { tracked: 10, excluded: 1000 } }
    renderPage()
    await screen.findByText(LISTED)
    const rows = rowsText()
    expect(rows[0].querySelector("td").textContent).toBe(LISTED)
    expect(within(rows[0]).getByTestId("do-tracked-star")).toBeTruthy()
    expect(rows.map((r) => r.querySelector("td").textContent)).toEqual([LISTED, "dragarwal.com", "aao.org"])
    const leads = rows.map((r) => within(r).getByTestId("do-h2h").getAttribute("data-lead"))
    expect(leads.every((l) => ["us", "them", "tie"].includes(l))).toBe(true)
    const them = rows.find((r) => within(r).getByTestId("do-h2h").getAttribute("data-lead") === "them")
    if (them) expect(within(them).getByTestId("do-h2h-bar").className).toMatch(/red/)
  })

  test("a pinned competitor that is NOT in the list: no shared keywords or head-to-head (tooltip says why); its traffic comes from the CACHED comparison", async () => {
    competitorSvc.data = { tracked: ["handmade-rival.com"], excluded: [], limits: { tracked: 10, excluded: 1000 } }
    serve({ "bulk-traffic": envelope("bulk-traffic", { items: [...REAL_BULK_ITEMS, { target: "handmade-rival.com", organic: { etv: 340, count: 12 }, paid: { etv: 0, count: 0 }, featured_snippet: null, local_pack: null }] }, { peek: true, cached: true }) })
    renderPage()
    await screen.findByText("handmade-rival.com")
    const row = rowsText()[0]
    expect(row.getAttribute("data-in-list")).toBe("0")
    expect(row.getAttribute("title")).toBe("Not found among competitors for shared keywords.")
    const cells = within(row).getAllByRole("cell")
    expect([cells[1].textContent, cells[2].textContent, cells[3].textContent]).toEqual(["—", "—", "—"])
    await waitFor(() => expect(within(row).getByTestId("do-compare-traffic").textContent).toBe("Organic traffic 340"))
    const peekCalls = bySection("bulk-traffic")
    expect(peekCalls).toHaveLength(1)
    expect(peekCalls[0].opts).toMatchObject({ peek: true, targets: ["handmade-rival.com"] })
  })

  test("the comparison is never BOUGHT from here: nothing cached = no traffic shown, still a peek", async () => {
    competitorSvc.data = { tracked: ["handmade-rival.com"], excluded: [], limits: { tracked: 10, excluded: 1000 } }
    renderPage()
    await screen.findByText("handmade-rival.com")
    await waitFor(() => expect(bySection("bulk-traffic").length).toBe(1))
    expect(screen.queryByTestId("do-compare-traffic")).toBeNull()
    expect(bySection("bulk-traffic").every((c) => c.opts.peek === true)).toBe(true)
  })

  test("no comparison is requested when every pinned competitor is in the list", async () => {
    competitorSvc.data = { tracked: [LISTED], excluded: [], limits: { tracked: 10, excluded: 1000 } }
    renderPage()
    await screen.findByText(LISTED)
    expect(bySection("bulk-traffic")).toHaveLength(0)
  })

  test("the request is the Competitors page's default view: no extra parameters (so one cache entry serves both)", async () => {
    renderPage()
    await screen.findByText("dragarwal.com")
    const c = bySection("competitors")
    expect(c).toHaveLength(1)
    expect(c[0].opts).toEqual({ refresh: false })
  })

  test("Exclude uses the Competitors page's handler (addExcluded with the domain), then the card follows the new list", async () => {
    competitorSvc.addExcluded.mockImplementation(async (_p, domains) => { competitorSvc.data = { ...competitorSvc.data, excluded: [...competitorSvc.data.excluded, ...domains] }; return ok(structuredClone(competitorSvc.data)) })
    serve({ competitors: (opts) => ok(competitors(competitorSvc.data.excluded.includes("dragarwal.com") ? competitors().result.items.slice(1) : competitors().result.items)) })
    renderPage()
    await screen.findByText("dragarwal.com")
    fireEvent.click(screen.getByRole("button", { name: "Exclude dragarwal.com" }))
    await waitFor(() => expect(screen.queryByText("dragarwal.com")).toBeNull())
    expect(competitorSvc.addExcluded).toHaveBeenCalledTimes(1)
    expect(competitorSvc.addExcluded.mock.calls[0][1]).toEqual(["dragarwal.com"])
    expect(bySection("competitors")).toHaveLength(2) // refreshed through the new exclude list, nothing else
  })

  test("a failed exclusion explains itself and keeps the row", async () => {
    competitorSvc.addExcluded.mockImplementation(async () => { throw Object.assign(new Error("You can exclude up to 1,000 domains."), { status: 409, code: "EXCLUDED_LIMIT_REACHED" }) })
    renderPage()
    await screen.findByText("dragarwal.com")
    fireEvent.click(screen.getByRole("button", { name: "Exclude dragarwal.com" }))
    expect((await screen.findByTestId("do-competitors-message")).textContent).toMatch(/1,000/)
    expect(screen.getByText("dragarwal.com")).toBeTruthy()
  })
})

describe("Top pages card", () => {
  const rows = () => within(screen.getByTestId("do-top-pages")).getAllByTestId("do-page-row")

  test("the top live pages by estimated traffic (the server's join), then the worst error page pinned at the bottom with a red status", async () => {
    const withTraffic = { ...REAL_PAGES_OK, items: REAL_PAGES_OK.items.map((p, i) => ({ ...p, traffic: [10, 900, 55, 0, 300][i], keywords: 3 })) }
    serve({
      "tp-counts": envelope("tp-counts", { pages: 518, errors: 138, redirects: 3 }),
      "tp-fix-first": envelope("tp-fix-first", { totalCount: 138, items: REAL_PAGES_ERRORS.items }),
      "domain-pages": envelope("domain-pages", withTraffic, { traffic: { status: "ok" } }),
    })
    renderPage()
    await screen.findAllByTestId("do-page-row")
    await waitFor(() => expect(rows()).toHaveLength(5))
    expect(rows().map((r) => r.getAttribute("data-pinned"))).toEqual(["0", "0", "0", "0", "1"])
    const traffics = rows().slice(0, 4).map((r) => within(r).getAllByRole("cell")[2].textContent)
    expect(traffics).toEqual(["900", "300", "55", "10"])
    const pinned = rows()[4]
    expect(within(pinned).getByTestId("tp-status").getAttribute("data-group")).toBe("blocked")
    expect(within(pinned).getByTestId("tp-status").textContent).toBe("403 Blocked")
    expect(within(pinned).getByTestId("tp-status").className).toMatch(/red/)
    expect(screen.getByTestId("do-view-all-pages").getAttribute("href")).toBe("/app/backlinks/top-pages")
  })

  test("it asks for the Top Pages page's OK tab, first page (same request: the page opens from the cache); error list shared with Fix first", async () => {
    serve({ "tp-counts": envelope("tp-counts", { pages: 518, errors: 138, redirects: 3 }), "tp-fix-first": envelope("tp-fix-first", { totalCount: 138, items: REAL_PAGES_ERRORS.items }) })
    renderPage()
    await settled()
    const req = bySection("domain-pages")
    expect(req).toHaveLength(1)
    expect(req[0].opts.topPages).toEqual({
      limit: 50, offset: 0, order_by: "page_summary.referring_domains,desc",
      filters: [["status_code", ">=", 200], "and", ["status_code", "<", 300], "and", ["page_summary.backlinks", ">=", 1]],
    })
    expect(bySection("tp-fix-first")).toHaveLength(1) // ONE request serves the Fix first rule and the pinned row
  })

  test("no error pages: four rows and no pinned one, and the Fix first list is never requested", async () => {
    renderPage()
    await screen.findAllByTestId("do-page-row")
    expect(rows()).toHaveLength(4) // the fixture has five OK pages; the card keeps the best four
    expect(rows().every((r) => r.getAttribute("data-pinned") === "0")).toBe(true)
    expect(bySection("tp-fix-first")).toHaveLength(0)
  })

  test("a failure shows its own error and Retry; the rest of the dashboard is unaffected", async () => {
    let healthy = false
    serve({ "domain-pages": () => { if (!healthy) throw apiError("The data service is busy."); return ok(envelope("domain-pages", REAL_PAGES_OK)) } })
    renderPage()
    await screen.findByText("100.4K")
    const panel = (await screen.findByRole("heading", { name: "Top pages" })).closest("section")
    const alert = await within(panel).findByRole("alert")
    healthy = true
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }))
    await within(panel).findByTestId("do-top-pages")
  })
})

describe("Backlink overview: clickable tiles, the last 30 days, known-country shares", () => {
  test("every tile is a whole-tile link: Referring pages -> Backlinks, Dofollow domains -> Referring Domains, Spam score -> its high-spam tab, Broken -> broken backlinks", async () => {
    renderPage()
    await settled()
    const hrefs = Object.fromEntries(["pages", "dofollow", "spam", "broken"].map((k) => [k, screen.getByTestId(`do-bl-${k}`).getAttribute("href")]))
    expect(hrefs).toEqual({ pages: "/app/backlinks/list", dofollow: "/app/referring-domains", spam: "/app/referring-domains?tab=toxic", broken: "/app/backlinks/list?broken=true" })
    for (const k of ["pages", "dofollow", "spam", "broken"]) expect(screen.getByTestId(`do-bl-${k}`).tagName).toBe("A")
  })

  test("referring domains - last 30 days: '+41 new · −12 lost' since the Monday, each number opening its tab; one request, no market, 7-day section", async () => {
    renderPage()
    await settled()
    const tile = await screen.findByTestId("do-rd-last30")
    await waitFor(() => expect(within(tile).getByTestId("do-rd-new")).toBeTruthy())
    expect(within(tile).getByTestId("do-rd-new").textContent).toBe("+41 new")
    expect(within(tile).getByTestId("do-rd-lost").textContent).toBe("−12 lost")
    expect(within(tile).getByTestId("do-rd-new").getAttribute("href")).toBe("/app/referring-domains?tab=new")
    expect(within(tile).getByTestId("do-rd-lost").getAttribute("href")).toBe("/app/referring-domains?tab=lost")
    expect(within(tile).getByTestId("do-rd-since").textContent).toBe("Since Sep 28")
    expect(bySection("rd-last-30")).toHaveLength(1)
  })

  test("zero is a real figure; a failure shows its own error and Retry inside the tile", async () => {
    serve({ "rd-last-30": envelope("rd-last-30", { since: "2026-09-28", days: 30, new: 0, lost: 0 }) })
    const { unmount } = renderPage()
    await settled()
    await waitFor(() => expect(screen.getByTestId("do-rd-new").textContent).toBe("+0 new"))
    unmount()
    let healthy = false
    serve({ "rd-last-30": () => { if (!healthy) throw apiError("The data service is busy."); return ok(envelope("rd-last-30", { since: "2026-09-28", days: 30, new: 3, lost: 1 })) } })
    renderPage()
    await settled()
    const alert = await within(await screen.findByTestId("do-rd-last30")).findByRole("alert")
    healthy = true
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(screen.getByTestId("do-rd-new").textContent).toBe("+3 new"))
  })

  test("top link countries: shares among KNOWN countries only (Worldwide counts), then a muted 'Unknown 40.0%' of ALL links", async () => {
    renderPage() // 500 links, 200 unknown, IN 150, US 50, WW 40 -> known 300
    await settled()
    const list = screen.getAllByTestId("do-country").map((li) => li.textContent.replace(/\s+/g, " ").trim())
    expect(list[0]).toMatch(/India 50\.0%/)
    expect(list[1]).toMatch(/United States 16\.7%/)
    expect(list[2]).toMatch(/Worldwide 13\.3%/)
    expect(screen.getByTestId("do-country-unknown").textContent).toBe("Unknown 40.0%")
    expect(screen.getByTestId("do-country-unknown").className).toMatch(/muted/)
  })

  test("only the top three known countries are listed", async () => {
    serve({ backlinks: backlinks({ referring_pages: 1000, referring_links_countries: { IN: 400, US: 300, GB: 200, DE: 100 } }) })
    renderPage()
    await settled()
    expect(screen.getAllByTestId("do-country")).toHaveLength(3)
    expect(screen.queryByTestId("do-country-unknown")).toBeNull()
  })
})

describe("layout and cost", () => {
  test("top to bottom: KPI cards, Fix first, traffic + positions, movement, top keywords + top pages, competitors, backlink overview", async () => {
    renderPage()
    await settled()
    const order = ["do-kpis", "do-fix-first", "do-trend-card", "do-movement", "do-top-keywords", "do-top-pages", "do-competitors", "do-backlinks"].map((id) => screen.getByTestId(id))
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING, `${i}`).toBeTruthy()
  })

  test("a cold load asks for the five sections plus ONLY these: counts, high-spam count, last 30 days, the OK page, anchor peek (and the Fix first list when there are errors)", async () => {
    renderPage()
    await settled()
    const sections = [...new Set(calls().map((c) => c.section))].sort()
    expect(sections).toEqual([...FIVE, "anchor-profile", "domain-pages", "rd-last-30", "rd-toxic-count", "tp-counts"].sort())
    expect(calls().every((c) => c.opts.refresh !== true)).toBe(true)
  })

  test("Refresh on the header still refreshes only the five sections (the hub's longer caches are left alone)", async () => {
    renderPage()
    await settled()
    const before = calls().length
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }))
    await waitFor(() => expect(calls().length).toBeGreaterThan(before))
    expect(calls().slice(before).map((c) => c.section).sort()).toEqual([...FIVE].sort())
    expect(calls().slice(before).every((c) => c.opts.refresh === true)).toBe(true)
  })
})
