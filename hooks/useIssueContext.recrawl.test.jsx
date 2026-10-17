import { describe, test, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useIssueContext } from "./useIssueContext"
import { invalidateProject, refetchProject, queryKeys } from "@/lib/query/keys"
import apiService from "@/lib/apiService"

/**
 * The "Current State" of an issue comes from the issue-context API, derived from the latest crawl. It is cached for 5 minutes (and the
 * query cache is persisted), so after a recrawl it MUST be invalidated and refetched with the other audit data — otherwise a finding that
 * the new crawl resolved (or changed) keeps showing the old state.
 */
vi.mock("@/lib/apiService", () => ({ default: { getIssueContext: vi.fn() } }))

const PID = "6aa3a38adb695a5c7765ca61"
const ISSUE = "images_missing_alt_text"
const URL = "https://www.sapphiredigitalagency.com/"
const ctx = (status) => ({ success: true, data: { currentState: { affectedItems: [{ Image: "logo.webp", Status: status }] } } })

let qc
const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

beforeEach(() => {
  vi.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe("issue-context cache across a recrawl", () => {
  test("the hook uses the shared key (so project-wide invalidation reaches it)", () => {
    apiService.getIssueContext.mockResolvedValue(ctx("Missing"))
    renderHook(() => useIssueContext(PID, ISSUE, URL), { wrapper })
    expect(qc.getQueryCache().find({ queryKey: queryKeys.issueContext.detail(PID, ISSUE, URL) })).toBeTruthy()
    expect(queryKeys.issueContext.detail(PID, ISSUE, URL).slice(0, 2)).toEqual(queryKeys.issueContext.all(PID))
  })

  test("after a recrawl completes, a cached 'Missing' state is refetched and the NEW state is shown (not served from the 5-minute cache)", async () => {
    apiService.getIssueContext.mockResolvedValueOnce(ctx("Missing on 1 of 2 uses of this image"))
    const { result } = renderHook(() => useIssueContext(PID, ISSUE, URL), { wrapper })
    await waitFor(() => expect(result.current.data?.currentState.affectedItems[0].Status).toMatch(/Missing/))
    expect(apiService.getIssueContext).toHaveBeenCalledTimes(1)

    // the recrawl re-analysed the page: the header logo now has alt text, so nothing is affected any more
    apiService.getIssueContext.mockResolvedValue({ success: true, data: { currentState: { affectedItems: [] } } }) // invalidate + refetch each read it
    await act(async () => { invalidateProject(qc, PID); refetchProject(qc, PID) })
    await waitFor(() => expect(result.current.data.currentState.affectedItems).toEqual([]))
    expect(apiService.getIssueContext.mock.calls.length).toBeGreaterThan(1)
  })

  test("without the project-wide helpers the cached value would have been served (this is what the fix prevents)", async () => {
    apiService.getIssueContext.mockResolvedValue(ctx("Missing"))
    const { result, rerender } = renderHook(() => useIssueContext(PID, ISSUE, URL), { wrapper })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    rerender()
    expect(apiService.getIssueContext).toHaveBeenCalledTimes(1) // within staleTime: no refetch on its own
  })

  test("another project's cached context is not touched", async () => {
    qc.setQueryData(queryKeys.issueContext.detail("other-project", ISSUE, URL), ctx("Missing").data)
    qc.setQueryData(queryKeys.issueContext.detail(PID, ISSUE, URL), ctx("Missing").data)
    invalidateProject(qc, PID)
    expect(qc.getQueryState(queryKeys.issueContext.detail(PID, ISSUE, URL)).isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.issueContext.detail("other-project", ISSUE, URL)).isInvalidated).toBe(false)
  })
})
