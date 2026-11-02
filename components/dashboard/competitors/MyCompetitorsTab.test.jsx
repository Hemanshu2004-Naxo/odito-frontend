import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Only the HTTP layer is mocked: the real hook, query cache and components run.
const svc = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock("@/services/myCompetitorsService", () => ({ default: svc, myCompetitorsService: svc }))
// Relevance is covered by CompetitorRelevance.test.jsx; here it is inert (nothing assessed, nothing requested).
const assessSvc = vi.hoisted(() => ({ list: vi.fn(async () => ({ success: true, data: { assessments: [] } })), request: vi.fn(async () => ({ success: true, data: { assessments: [] } })), override: vi.fn(), clearOverride: vi.fn() }))
vi.mock("@/services/competitorAssessmentsService", () => ({ default: assessSvc, competitorAssessmentsService: assessSvc }))
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "p1", main_url: "https://own.com" } }) }))

import MyCompetitorsTab from "./MyCompetitorsTab"

const comp = (over = {}) => ({ id: "c1", name: "Sunrise Eye Clinic", domain: "sunrise.com", address: null, placeId: null, source: "manual", notes: null, createdAt: "2026-10-30T00:00:00Z", updatedAt: "2026-10-30T00:00:00Z", ...over })
const ok = (data) => ({ success: true, data })
const apiError = (message, code, status = 409) => Object.assign(new Error(message), { status, code })

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MyCompetitorsTab /></QueryClientProvider>)
}

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset())
})

describe("My competitors tab", () => {
  test("empty list shows the empty state, and adding saves through the server then lists it", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [], limit: 100 }))
    svc.create.mockResolvedValue(ok({ competitor: comp() }))
    renderTab()

    expect(await screen.findByTestId("mc-empty")).toBeTruthy()
    fireEvent.click(screen.getAllByRole("button", { name: /add competitor/i })[0])
    const dialog = await screen.findByTestId("mc-dialog")
    fireEvent.change(within(dialog).getByTestId("mc-name"), { target: { value: "Sunrise Eye Clinic" } })
    fireEvent.change(within(dialog).getByTestId("mc-domain"), { target: { value: "https://www.Sunrise.com/" } })
    fireEvent.click(within(dialog).getByTestId("mc-save"))

    await waitFor(() => expect(svc.create).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "Sunrise Eye Clinic", domain: "https://www.Sunrise.com/" })))
    expect(await screen.findByTestId("mc-row")).toBeTruthy()
    expect(screen.getByTestId("mc-count").textContent).toContain("1 of 100")
  })

  test("a form with neither name nor website is not sent", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [], limit: 100 }))
    renderTab()
    await screen.findByTestId("mc-empty")
    fireEvent.click(screen.getAllByRole("button", { name: /add competitor/i })[0])
    fireEvent.click(await screen.findByTestId("mc-save"))
    expect((await screen.findByTestId("mc-error")).textContent).toMatch(/name or a website/i)
    expect(svc.create).not.toHaveBeenCalled()
  })

  test("a duplicate answer from the server is shown in the form and nothing is added", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [], limit: 100 }))
    svc.create.mockRejectedValue(apiError("This competitor is already in your list.", "COMPETITOR_EXISTS"))
    renderTab()
    await screen.findByTestId("mc-empty")
    fireEvent.click(screen.getAllByRole("button", { name: /add competitor/i })[0])
    fireEvent.change(await screen.findByTestId("mc-domain"), { target: { value: "sunrise.com" } })
    fireEvent.click(screen.getByTestId("mc-save"))
    expect((await screen.findByTestId("mc-error")).textContent).toMatch(/already in your list/i)
    expect(screen.queryByTestId("mc-row")).toBeNull()
  })

  test("editing sends only the form values and replaces the row with the server's answer", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp()], limit: 100 }))
    svc.update.mockResolvedValue(ok({ competitor: comp({ name: "Sunrise Vision", notes: "bigger" }) }))
    renderTab()
    fireEvent.click(within(await screen.findByTestId("mc-table")).getByRole("button", { name: "Edit Sunrise Eye Clinic" }))
    fireEvent.change(await screen.findByTestId("mc-name"), { target: { value: "Sunrise Vision" } })
    fireEvent.click(screen.getByTestId("mc-save"))
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith("p1", "c1", expect.objectContaining({ name: "Sunrise Vision" })))
    expect(await within(screen.getByTestId("mc-table")).findByText("Sunrise Vision")).toBeTruthy()
  })

  test("removing asks first, then deletes", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp()], limit: 100 }))
    svc.remove.mockResolvedValue(ok({ id: "c1" }))
    renderTab()
    fireEvent.click(within(await screen.findByTestId("mc-table")).getByRole("button", { name: "Remove Sunrise Eye Clinic" }))
    expect(svc.remove).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole("button", { name: "Remove competitor" }))
    await waitFor(() => expect(svc.remove).toHaveBeenCalledWith("p1", "c1"))
    await waitFor(() => expect(screen.queryByTestId("mc-row")).toBeNull())
  })

  test("a failed load shows an error with Retry", async () => {
    svc.list.mockRejectedValue(apiError("The server is down.", "INTERNAL_ERROR", 500))
    renderTab()
    expect(await screen.findByRole("button", { name: /retry|try again/i })).toBeTruthy()
  })

  test("a long list is drawn 20 rows at a time, so only those rows load a favicon; search still covers every entry", async () => {
    const many = Array.from({ length: 45 }, (_, i) => comp({ id: `c${i}`, name: `Clinic ${i}`, domain: `clinic${i}.example.com` }))
    svc.list.mockResolvedValue(ok({ competitors: many, limit: 100 }))
    renderTab()
    await screen.findAllByTestId("mc-row")
    const faviconsOnScreen = () => document.querySelectorAll('[data-testid="mc-table"] img').length
    expect(screen.getAllByTestId("mc-row")).toHaveLength(20)
    expect(faviconsOnScreen()).toBeLessThanOrEqual(20)
    expect(screen.getByTestId("mc-more").textContent).toContain("Showing 20 of 45")

    fireEvent.click(within(screen.getByTestId("mc-more")).getByRole("button"))
    expect(screen.getAllByTestId("mc-row")).toHaveLength(40)
    fireEvent.click(within(screen.getByTestId("mc-more")).getByRole("button", { name: "Show 5 more" }))
    expect(screen.getAllByTestId("mc-row")).toHaveLength(45)
    expect(screen.queryByTestId("mc-more")).toBeNull()

    // search reaches entries that are not drawn yet, and starts again from the first 20 matches
    fireEvent.change(screen.getByLabelText("Search competitors"), { target: { value: "clinic4" } })
    expect(screen.getAllByTestId("mc-row").map((r) => r.textContent).every((t) => t.includes("Clinic 4"))).toBe(true)
    expect(screen.getAllByTestId("mc-row")).toHaveLength(6) // Clinic 4, 40-44
  })

  test("a list of 20 or fewer shows no Show more", async () => {
    svc.list.mockResolvedValue(ok({ competitors: Array.from({ length: 20 }, (_, i) => comp({ id: `c${i}`, name: `C ${i}`, domain: `c${i}.example.com` })), limit: 100 }))
    renderTab()
    await screen.findAllByTestId("mc-row")
    expect(screen.queryByTestId("mc-more")).toBeNull()
  })

  test("a full list disables Add", async () => {
    svc.list.mockResolvedValue(ok({ competitors: [comp()], limit: 1 }))
    renderTab()
    await screen.findByTestId("mc-row")
    expect(screen.getByTestId("mc-add").disabled).toBe(true)
  })
})
