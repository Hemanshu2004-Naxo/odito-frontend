import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import UserAddedKeywords from "./UserAddedKeywords"

const data = {
  domain: "example.com",
  location: "Nashik, Maharashtra, India",
  scan_count: 4,
  last_scanned_at: "2026-09-28T10:00:00Z",
  keywords: [
    { _id: "1", keyword: "best seo agency", current_rank: 4, best_rank: 2, last_scan_rank: 5, prev_week_rank: 9, prev_month_rank: 14, benchmark_rank: 22, maps_rank: 2, ranking_urls: [{ rank: 3, type: "homepage", url: "https://example.com/" }], last_scan_status: "ok" },
    { _id: "2", keyword: "seo audit", current_rank: null, last_scan_status: "error" },
  ],
}

const LABELS = ["Desktop", "Mobile", "Last Scan", "Best", "Prev Week", "Prev Month", "Benchmark", "Maps", "Status"]

describe("UserAddedKeywords — responsive markup (styles/keywords.css re-flows it into cards)", () => {
  it("labels every metric cell so the stacked-card layout can show its column name", () => {
    const { container } = render(<UserAddedKeywords data={data} onRescan={() => {}} onDelete={() => {}} />)
    const rows = container.querySelectorAll(".kw-grid--row")
    expect(rows).toHaveLength(2)
    const labels = [...rows[0].querySelectorAll(".kw-c-m")].map((c) => c.getAttribute("data-label"))
    expect(labels).toEqual(LABELS)
  })

  it("renders the header row, the desktop index cell, and the inline index used by cards", () => {
    const { container } = render(<UserAddedKeywords data={data} />)
    expect(container.querySelector(".kw-grid--head")).toBeTruthy()
    expect(container.querySelector(".kw-c-idx")).toBeTruthy()
    expect(container.querySelector(".kw-idx-inline").textContent).toBe("1.")
  })

  it("keeps header and rows inside one scroll container so nothing can be clipped", () => {
    const { container } = render(<UserAddedKeywords data={data} />)
    const scroll = container.querySelector(".kw-table-scroll")
    expect(scroll.querySelector(".kw-grid--head")).toBeTruthy()
    expect(scroll.querySelectorAll(".kw-grid--row")).toHaveLength(2)
  })

  it("keeps rescan / delete / expand reachable and working", () => {
    const onRescan = vi.fn()
    render(<UserAddedKeywords data={data} onRescan={onRescan} onDelete={() => {}} />)
    fireEvent.click(screen.getAllByTitle("Re-scan this keyword")[0])
    expect(onRescan).toHaveBeenCalledWith("best seo agency")
    expect(screen.getAllByTitle("Stop tracking this keyword")).toHaveLength(2)
    fireEvent.click(screen.getByText("▼"))
    expect(document.querySelector(".kw-expand")).toBeTruthy()
  })
})
