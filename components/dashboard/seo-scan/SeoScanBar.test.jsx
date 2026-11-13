import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const nav = vi.hoisted(() => ({ pathname: "/app/domain-overview" }))
const proj = vi.hoisted(() => ({ activeProject: { _id: "p1" } }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => proj }))
vi.mock("@/lib/socketService", () => ({ default: {}, ConnectionState: {} }))
vi.mock("@/lib/apiService", () => ({ default: { request: vi.fn() } }))
vi.mock("./DataStatusLine", () => ({ DataStatusLine: ({ projectId, page }) => <div data-testid="status" data-project={projectId} data-page={page} /> }))

import SeoScanBar from "./SeoScanBar"
import { summarizeScans } from "@/hooks/useSeoScan"

const scan = (over = {}) => ({ id: "s1", status: "completed", finishedAt: "2026-11-04T11:00:00Z", ...over })

beforeEach(() => { nav.pathname = "/app/domain-overview"; proj.activeProject = { _id: "p1" } })

describe("SeoScanBar mounts the status line for exactly the nine SEO pages", () => {
  const PAGES = [
    ["/app/domain-overview", "domain-overview"], ["/app/traffic-history", "traffic"], ["/app/organic-keywords", "organic-keywords"], ["/app/competitors", "competitors"],
    ["/app/backlinks/overview", "offpage-overview"], ["/app/backlinks/list", "backlinks"], ["/app/backlinks/anchors", "anchors"], ["/app/referring-domains", "referring-domains"],
    ["/app/backlinks/top-pages", "top-pages"],
  ]
  for (const [path, page] of PAGES) {
    it(`${path} -> ${page}`, () => {
      nav.pathname = path
      render(<SeoScanBar />)
      expect(screen.getByTestId("status").dataset.page).toBe(page)
      expect(screen.getByTestId("status").dataset.project).toBe("p1")
    })
  }

  it("renders nothing on other pages, without a project, or for a look-alike path", () => {
    for (const path of ["/app/settings", "/app/competitorsX", "/app/dashboard", null]) {
      nav.pathname = path
      const { container, unmount } = render(<SeoScanBar />)
      expect(container.firstChild).toBeNull()
      unmount()
    }
    nav.pathname = "/app/traffic-history"; proj.activeProject = null
    const { container } = render(<SeoScanBar />)
    expect(container.firstChild).toBeNull()
  })

  it("has no scan or update button of any kind", () => {
    render(<SeoScanBar />)
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })
})

describe("summarizeScans", () => {
  it("a partially completed scan counts as the last successful one; a failed one does not", () => {
    const { latest, lastSuccessful } = summarizeScans([scan({ id: "c", status: "failed" }), scan({ id: "b", status: "partially_completed" }), scan({ id: "a" })])
    expect([latest.id, lastSuccessful.id]).toEqual(["c", "b"])
    expect(summarizeScans([]).latest).toBeNull()
  })
})
