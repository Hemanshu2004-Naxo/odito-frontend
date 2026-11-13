import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import UserAddedKeywords, { notRankedNote, isLowConfidence } from "./UserAddedKeywords"

vi.mock("@/lib/apiService", () => ({ default: { getTrackedKeywordDetails: vi.fn(() => new Promise(() => {})) } }))
const withClient = (ui) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
const row = (kw) => render(withClient(<UserAddedKeywords data={{ domain: "example.com", location: "Nashik", keywords: [{ _id: "1", last_scan_status: "ok", ranking_urls: [], ...kw }] }} />)).container

describe("notRankedNote: a check that ran but found no ranking, said as exactly what it is", () => {
  it("complete -> 'Not in top N'; partial -> '(partial)'; unreadable results -> '(X unreadable)'; N is what was returned", () => {
    expect(notRankedNote({ status: "not_found", returned_results: 48 }).text).toBe("Not in top 48")
    expect(notRankedNote({ status: "not_found_partial", returned_results: 9 }).text).toBe("Not in top 9 (partial)")
    expect(notRankedNote({ status: "not_found_uncertain", returned_results: 100, unresolved_candidates: 3 }).text).toBe("Not in top 100 (3 unreadable)")
    expect(notRankedNote({ status: "not_found" }, 100).text).toBe("Not in top 100")
    expect(notRankedNote(undefined).text).toBe("Not ranked")
  })
  it("low confidence is only flagged for brand-name matches", () => {
    expect(isLowConfidence([{ rank: 4, url: "u", match_confidence: "low" }])).toBe(true)
    expect(isLowConfidence([{ rank: 4, url: "u" }])).toBe(false)
    expect(isLowConfidence(undefined)).toBe(false)
  })
})

describe("keyword table statuses", () => {
  it("desktop partial / uncertain / complete not-found show their own note and NEVER the Scan Error badge", () => {
    const partial = row({ current_rank: null, desktop_scan: { status: "not_found_partial", returned_results: 9 } })
    expect(partial.querySelector('[data-testid="desktop-not-ranked-note"]').textContent).toBe("Not in top 9 (partial)")
    expect(partial.textContent).not.toMatch(/Scan Error/)
    expect(partial.querySelector('[data-testid="desktop-status-not-ranked"]').textContent).toBe("Not ranked (partial)")
    const uncertain = row({ current_rank: null, desktop_scan: { status: "not_found_uncertain", returned_results: 40, unresolved_candidates: 2 } })
    expect(uncertain.querySelector('[data-testid="desktop-not-ranked-note"]').textContent).toBe("Not in top 40 (2 unreadable)")
    expect(uncertain.textContent).not.toMatch(/Scan Error/)
    const complete = row({ current_rank: null, desktop_scan: { status: "not_found", returned_results: 100 } })
    expect(complete.querySelector('[data-testid="desktop-not-ranked-note"]').textContent).toBe("Not in top 100")
  })

  it("a real scan_error still shows Scan Error (and no not-ranked note); null is never shown as rank 0", () => {
    const failed = row({ current_rank: null, last_scan_status: "error", last_scan_error: "Ranking check timed out. Please try again." })
    expect(failed.textContent).toMatch(/Scan Error/)
    expect(failed.querySelector('[data-testid="desktop-not-ranked-note"]')).toBeNull()
    expect(failed.textContent).not.toMatch(/(^|\D)0(\D|$)/)
  })

  it("a low-confidence (brand-name) rank is shown with a ≈ and an explanation", () => {
    const c = row({ current_rank: 4, ranking_urls: [{ rank: 4, url: "https://google.com/goto?url=CAES", match_confidence: "low", match_basis: "brand_name", url_masked: true }] })
    const mark = c.querySelector('[data-testid="desktop-low-confidence"]')
    expect(mark.textContent).toBe("≈")
    expect(mark.getAttribute("title")).toMatch(/brand name/i)
    const verified = row({ current_rank: 4, ranking_urls: [{ rank: 4, url: "https://example.com/" }] })
    expect(verified.querySelector('[data-testid="desktop-low-confidence"]')).toBeNull()
  })

  it("mobile uses its own scan: partial / uncertain notes, independent of desktop", () => {
    const c = row({ current_rank: 3, mobile: { last_scan_status: "ok", current_rank: null, tracked_depth: 50, scan: { status: "not_found_uncertain", returned_results: 50, unresolved_candidates: 1 } } })
    expect(c.querySelector('[data-testid="mobile-not-ranked-note"]').textContent).toBe("Not in top 50 (1 unreadable)")
  })
})
