import { describe, it, expect, vi, beforeEach } from "vitest"

const api = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock("@/lib/apiService", () => ({ default: api }))

import domainOverviewService from "./domainOverviewService"

const urlOf = () => api.request.mock.calls.at(-1)[0]
const get = (section, opts) => domainOverviewService.getSection("p1", section, opts)

beforeEach(() => { api.request.mockReset(); api.request.mockResolvedValue({ success: true }) })

describe("backlinks section: what the browser sends", () => {
  it("the default view (live, no filter) is the plain URL: the same one the dashboard's cards use, so one server cache entry", () => {
    get("backlinks")
    expect(urlOf()).toBe("/projects/p1/domain-overview/backlinks")
    get("backlinks", { backlinks: { status: "live", dofollow: false } })
    expect(urlOf()).toBe("/projects/p1/domain-overview/backlinks")
  })

  it("Lost and All send status; Dofollow only sends dofollow=1; they combine", () => {
    get("backlinks", { backlinks: { status: "lost", dofollow: false } })
    expect(urlOf()).toBe("/projects/p1/domain-overview/backlinks?status=lost")
    get("backlinks", { backlinks: { status: "all", dofollow: false } })
    expect(urlOf()).toBe("/projects/p1/domain-overview/backlinks?status=all")
    get("backlinks", { backlinks: { status: "live", dofollow: true } })
    expect(urlOf()).toBe("/projects/p1/domain-overview/backlinks?dofollow=1")
    get("backlinks", { backlinks: { status: "lost", dofollow: true } })
    expect(urlOf()).toBe("/projects/p1/domain-overview/backlinks?status=lost&dofollow=1")
  })

  it("a refresh adds refresh=1 and nothing else changes", () => {
    get("backlinks", { refresh: true, backlinks: { status: "all", dofollow: false } })
    expect(urlOf()).toBe("/projects/p1/domain-overview/backlinks?refresh=1&status=all")
  })

  it("the request is cancellable", () => {
    const signal = new AbortController().signal
    domainOverviewService.getSection("p1", "backlinks", {}, { signal })
    expect(api.request.mock.calls.at(-1)[1]).toMatchObject({ method: "GET", signal })
  })
})

describe("competitors section: the default view is the plain URL too", () => {
  it("default = no parameters; every non-default choice is sent", () => {
    get("competitors", { competitors: { limit: 50, offset: 0, order_by: "intersections,desc", filters: [], exclude_top_domains: true, max_rank_group: 100 } })
    expect(urlOf()).toBe("/projects/p1/domain-overview/competitors")
    get("competitors", { competitors: { limit: 25, offset: 25, order_by: "avg_position,asc", filters: ["intersections", ">=", 5], exclude_top_domains: false, max_rank_group: 10 } })
    const q = new URLSearchParams(urlOf().split("?")[1])
    expect(Object.fromEntries(q)).toEqual({ limit: "25", offset: "25", order_by: "avg_position,asc", filters: '["intersections",">=",5]', exclude_top_domains: "0", max_rank_group: "10" })
  })
})

describe("backlinks-list section (the Backlinks page): the default view is the plain URL", () => {
  const base = { status: "live", mode: "as_is", limit: 50, offset: 0, order_by: ["rank,desc"], filters: [] }

  it("default = no parameters; every non-default choice is sent", () => {
    get("backlinks-list", { backlinksList: base })
    expect(urlOf()).toBe("/projects/p1/domain-overview/backlinks-list")
    get("backlinks-list", { backlinksList: { ...base, status: "lost", mode: "one_per_domain", limit: 25, offset: 50, order_by: ["domain_from_rank,desc", "first_seen,asc"], filters: ["is_new", "=", true] } })
    const q = new URLSearchParams(urlOf().split("?")[1])
    expect(q.get("status")).toBe("lost")
    expect(q.get("mode")).toBe("one_per_domain")
    expect(q.get("limit")).toBe("25")
    expect(q.get("offset")).toBe("50")
    expect(q.getAll("order_by")).toEqual(["domain_from_rank,desc", "first_seen,asc"])
    expect(JSON.parse(q.get("filters"))).toEqual(["is_new", "=", true])
  })

  it("a token REPLACES the offset (never both) and everything else is sent unchanged", () => {
    get("backlinks-list", { backlinksList: { ...base, limit: 100, offset: 0, token: "tok123", filters: ["dofollow", "=", true] } })
    const q = new URLSearchParams(urlOf().split("?")[1])
    expect([q.get("token"), q.has("offset"), q.get("limit")]).toEqual(["tok123", false, "100"])
    get("backlinks-list", { backlinksList: { ...base, offset: 100, token: "tok" } })
    expect(new URLSearchParams(urlOf().split("?")[1]).has("offset")).toBe(false)
  })
})
