import { describe, it, expect } from "vitest"
import { render, within, fireEvent } from "@testing-library/react"
import UserAddedKeywords, { getRankChange, getMobileState } from "./UserAddedKeywords"

const wrap = (keywords) => ({
  domain: "example.com",
  location: "Nashik",
  keywords: keywords.map((k, i) => ({ _id: String(i), last_scan_status: "ok", ranking_urls: [], ...k })),
})

const mobileCell = (kw) => {
  const { container } = render(<UserAddedKeywords data={wrap([kw])} />)
  return container.querySelector('[data-label="Mobile"]')
}
const desktopCell = (kw) => {
  const { container } = render(<UserAddedKeywords data={wrap([kw])} />)
  return container.querySelector('[data-label="Desktop"]')
}

describe("getRankChange", () => {
  it("is positive for an improvement (lower number) and negative for a decline", () => {
    expect(getRankChange(8, 11)).toBe(3)
    expect(getRankChange(11, 7)).toBe(-4)
    expect(getRankChange(5, 5)).toBe(0)
  })
  it("is null whenever either side is unknown — never a fabricated change", () => {
    expect(getRankChange(null, 5)).toBeNull()
    expect(getRankChange(5, null)).toBeNull()
    expect(getRankChange(undefined, undefined)).toBeNull()
  })
})

describe("getMobileState", () => {
  it("distinguishes never-collected, failed, ranked and checked-not-found", () => {
    expect(getMobileState(undefined)).toBe("not_collected")
    expect(getMobileState(null)).toBe("not_collected")
    expect(getMobileState({ status: "not_collected" })).toBe("not_collected")
    expect(getMobileState({ last_scan_status: "error", current_rank: null })).toBe("scan_error")
    expect(getMobileState({ last_scan_status: "ok", current_rank: 9 })).toBe("ranked")
    expect(getMobileState({ last_scan_status: "ok", current_rank: null })).toBe("not_ranked")
  })
})

describe("UserAddedKeywords — Desktop and Mobile columns", () => {
  it("renders separate Desktop and Mobile columns with their own values", () => {
    const { container } = render(
      <UserAddedKeywords data={wrap([{ keyword: "k", current_rank: 8, prev_scan_rank: 11, last_scan_rank: 11, mobile: { last_scan_status: "ok", current_rank: 12, prev_scan_rank: 14 } }])} />
    )
    const head = [...container.querySelectorAll(".kw-grid--head > div")].map((d) => d.textContent)
    expect(head).toContain("Desktop")
    expect(head).toContain("Mobile")
    expect(container.querySelector('[data-label="Desktop"]').textContent).toContain("#8")
    expect(container.querySelector('[data-label="Mobile"]').textContent).toContain("#12")
    expect(container.querySelector('[data-label="Mobile"]').textContent).not.toContain("#8")
  })

  it("shows an improvement as a green up indicator with the size of the move", () => {
    const cell = mobileCell({ keyword: "k", current_rank: 8, mobile: { last_scan_status: "ok", current_rank: 8, prev_scan_rank: 11 } })
    const up = within(cell).getByTestId("rank-change-up")
    expect(up.textContent).toBe("▲3")
  })

  it("shows a decline as a red down indicator", () => {
    const cell = mobileCell({ keyword: "k", current_rank: 8, mobile: { last_scan_status: "ok", current_rank: 11, prev_scan_rank: 7 } })
    expect(within(cell).getByTestId("rank-change-down").textContent).toBe("▼4")
  })

  it("shows a neutral dash when the position did not change", () => {
    const cell = mobileCell({ keyword: "k", current_rank: 8, mobile: { last_scan_status: "ok", current_rank: 9, prev_scan_rank: 9 } })
    expect(within(cell).getByTestId("rank-change-neutral")).toBeTruthy()
  })

  it("shows a dash for the change when there is no previous mobile history", () => {
    const cell = mobileCell({ keyword: "k", current_rank: 8, mobile: { last_scan_status: "ok", current_rank: 9, prev_scan_rank: null } })
    expect(within(cell).getByTestId("rank-change-neutral")).toBeTruthy()
    expect(cell.textContent).toContain("#9")
  })

  it("never-collected mobile is a distinct 'Not checked' state and never claims 'not in top 100'", () => {
    const cell = mobileCell({ keyword: "k", current_rank: 8 })
    expect(within(cell).getByTestId("mobile-not-collected").textContent).toBe("Not checked")
    expect(cell.textContent).not.toMatch(/top/i)
    expect(cell.textContent).not.toContain("#8") // never falls back to the desktop rank
  })

  it("a failed mobile scan with no earlier rank shows Scan Error, not 'not in top N'", () => {
    const cell = mobileCell({ keyword: "k", current_rank: 8, mobile: { last_scan_status: "error", current_rank: null, last_scan_error: "Ranking check timed out. Please try again." } })
    const err = within(cell).getByTestId("mobile-scan-error")
    expect(err.textContent).toBe("Scan Error")
    expect(err.getAttribute("title")).toContain("timed out")
    expect(cell.textContent).not.toMatch(/top/i)
  })

  it("a failed mobile scan keeps the last known rank visible and flags it as stale", () => {
    const cell = mobileCell({ keyword: "k", current_rank: 8, mobile: { last_scan_status: "error", current_rank: 11, last_scan_error: "x" } })
    const err = within(cell).getByTestId("mobile-scan-error")
    expect(err.textContent).toContain("#11")
    expect(err.textContent).toContain("⚠")
    expect(err.getAttribute("title")).toContain("last known")
  })

  it("checked-and-not-found states the verified depth only when the scan recorded one", () => {
    const withDepth = mobileCell({ keyword: "k", current_rank: 8, mobile: { last_scan_status: "ok", current_rank: null, tracked_depth: 100 } })
    expect(within(withDepth).getByTestId("mobile-not-ranked").textContent).toContain("Not in top 100")
  })

  it("checked-and-not-found without a verified depth does not claim a top-N range", () => {
    const { container } = render(
      <UserAddedKeywords data={wrap([{ keyword: "k2", current_rank: 8, mobile: { last_scan_status: "ok", current_rank: null, tracked_depth: null } }])} />
    )
    const cell = container.querySelector('[data-label="Mobile"]')
    expect(within(cell).getByTestId("mobile-not-ranked").textContent).toBe("—")
  })

  it("a pending (optimistic) keyword shows Scanning in the mobile column", () => {
    const cell = mobileCell({ keyword: "k", current_rank: null, last_scan_status: "pending" })
    expect(cell.textContent).toContain("Scanning")
  })

  it("mobile data never leaks into the desktop column and a desktop failure does not hide mobile", () => {
    const kw = { keyword: "k", current_rank: null, last_scan_status: "error", mobile: { last_scan_status: "ok", current_rank: 6, prev_scan_rank: 6 } }
    const { container } = render(<UserAddedKeywords data={wrap([kw])} />)
    expect(container.querySelector('[data-label="Desktop"]').textContent).not.toContain("#6")
    expect(container.querySelector('[data-label="Mobile"]').textContent).toContain("#6")
  })

  it("keeps the desktop cell unchanged for a legacy keyword with no mobile object", () => {
    const cell = desktopCell({ keyword: "k", current_rank: 4 })
    expect(cell.textContent).toContain("#4")
  })

  it("lists mobile ranking URLs, tagged by device, in the expanded row", () => {
    const { container, getByText } = render(
      <UserAddedKeywords data={wrap([{ keyword: "k", current_rank: 4, ranking_urls: [{ rank: 4, type: "homepage", url: "https://example.com/" }], mobile: { last_scan_status: "ok", current_rank: 9, ranking_urls: [{ rank: 9, type: "internal_page", url: "https://example.com/m" }] } }])} />
    )
    fireEvent.click(getByText("▼"))
    const rows = container.querySelectorAll(".kw-expand [data-device]")
    expect([...rows].map((r) => r.getAttribute("data-device"))).toEqual(["desktop", "mobile"])
  })
})
