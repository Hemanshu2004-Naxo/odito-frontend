import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import AuditIqHelpPanel from "./AuditIqHelpPanel"
import apiService from "@/lib/apiService"

vi.mock("@/lib/apiService", () => ({ default: { request: vi.fn() } }))

const EMPTY_STATE = {
  requests: { express_fix: null, technical_audit_fix: null, expert_fix: null },
  services: {
    maintenance: { available: false, reason: "NOT_OFFERED" },
    strategyCall: { available: false, reason: "NOT_CONFIGURED", url: null },
  },
}

const storedRequest = (over = {}) => ({
  id: "req-1", requestType: "express_fix", issueKey: "missing_h1", issueTitle: "H1 missing",
  affectedPageCount: 12, pageUrl: null, message: null, status: "submitted", isOpen: true,
  createdAt: "2026-10-15T10:00:00.000Z", updatedAt: "2026-10-15T10:00:00.000Z", ...over,
})

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra })

let serviceState
let postHandler

// Behaves like the real API: what a POST stored (or a 409 says already exists) is what the next GET returns.
function remember(request) {
  if (request && !(serviceState instanceof Error)) {
    serviceState = { ...serviceState, requests: { ...serviceState.requests, [request.requestType]: request } }
  }
}

function installApi() {
  apiService.request.mockImplementation(async (endpoint, options = {}) => {
    if (options.method === "POST") {
      try {
        const res = await postHandler(JSON.parse(options.body))
        remember(res?.data)
        return res
      } catch (err) {
        remember(err?.data)
        throw err
      }
    }
    if (serviceState instanceof Error) throw serviceState
    return { success: true, data: serviceState }
  })
}

// The status query retries a failed load once after ~1s, so error-path assertions wait a little longer.
const SLOW = { timeout: 4000 }

const posts = () => apiService.request.mock.calls.filter(([, o]) => o?.method === "POST")
const gets = () => apiService.request.mock.calls.filter(([, o]) => !o?.method)

function renderPanel(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuditIqHelpPanel
        projectId="project-1"
        projectName="Acme Site"
        issue={{ issue_code: "missing_h1", title: "H1 missing" }}
        issueId="missing_h1"
        issueCategory="On-Page Issues"
        affectedPageCount={12}
        selUrl={null}
        onBackToAi={() => {}}
        {...props}
      />
    </QueryClientProvider>
  )
  return { ...utils, queryClient }
}

const loaded = async () => { await waitFor(() => expect(gets().length).toBeGreaterThan(0)); await screen.findByText("Express Fix") }
const card = (title) => screen.getByText(title).closest('[role="button"]')

beforeEach(() => {
  vi.clearAllMocks()
  serviceState = EMPTY_STATE
  postHandler = async () => ({ success: true, data: storedRequest() })
  installApi()
})

describe("AuditIQ tab — structure is the original static layout", () => {
  test("renders the header, the three service cards, both actions and the back button", async () => {
    renderPanel()
    await loaded()
    expect(screen.getByText("Let AuditIQ Fix It")).toBeInTheDocument()
    for (const title of ["Express Fix", "Technical Audit + Fix", "Monthly Maintenance"]) expect(screen.getByText(title)).toBeInTheDocument()
    for (const badge of ["Most Popular", "Comprehensive", "Best Value"]) expect(screen.getByText(badge)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Request Expert Fix/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Book a Strategy Call/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Back to AI Fix/ })).toBeInTheDocument()
    expect(screen.getByText(/across all 12 affected pages/)).toBeInTheDocument()
  })

  test("makes no unbacked promises (no 24h guarantee, no screenshots/rank-tracking claim)", async () => {
    renderPanel()
    await loaded()
    const text = document.body.textContent
    expect(text).not.toMatch(/24 hours|24h|rank tracking|before\/after/i)
  })

  test("loads the request status for this project + issue", async () => {
    renderPanel()
    await loaded()
    const [endpoint] = gets()[0]
    expect(endpoint).toContain("/auditiq/service-requests?")
    expect(endpoint).toContain("projectId=project-1")
    expect(endpoint).toContain("issueKey=missing_h1")
  })

  test("Back to AI Fix calls onBackToAi", async () => {
    const onBackToAi = vi.fn()
    renderPanel({ onBackToAi })
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: /Back to AI Fix/ }))
    expect(onBackToAi).toHaveBeenCalledTimes(1)
  })
})

describe("Express Fix / Technical Audit + Fix", () => {
  test("clicking a card opens a confirmation form with the real context — and sends nothing yet", async () => {
    renderPanel({ selUrl: "https://acme.test/about" })
    await loaded()
    fireEvent.click(card("Express Fix"))
    const form = screen.getByTestId("auditiq-form-express_fix")
    expect(within(form).getByText("H1 missing")).toBeInTheDocument()
    expect(within(form).getByText("Acme Site")).toBeInTheDocument()
    expect(within(form).getByText("12")).toBeInTheDocument()
    expect(within(form).getByText("https://acme.test/about")).toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })

  test("submits the issue context, shows 'awaiting review' (not done), and never sends ownership fields", async () => {
    renderPanel({ selUrl: "https://acme.test/about" })
    await loaded()
    fireEvent.click(card("Express Fix"))
    fireEvent.change(screen.getByLabelText(/Notes for the team/), { target: { value: "  Skip the blog  " } })
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))

    await screen.findByText(/Request submitted\. It has not been started yet/)
    expect(posts()).toHaveLength(1)
    const [endpoint, options] = posts()[0]
    expect(endpoint).toBe("/auditiq/service-requests")
    const body = JSON.parse(options.body)
    expect(body).toMatchObject({
      projectId: "project-1", requestType: "express_fix", issueKey: "missing_h1", issueTitle: "H1 missing",
      issueCategory: "On-Page Issues", affectedPageCount: 12, pageUrl: "https://acme.test/about", message: "Skip the blog",
    })
    for (const forbidden of ["userId", "status", "isOpen"]) expect(body).not.toHaveProperty(forbidden)

    const status = screen.getByTestId("auditiq-status-express_fix")
    expect(status).toHaveTextContent("Requested — awaiting review")
    expect(status).not.toHaveTextContent(/completed|fixed/i)
    expect(screen.queryByTestId("auditiq-form-express_fix")).not.toBeInTheDocument()
  })

  test("Technical Audit + Fix submits its own request type and does not claim an audit ran", async () => {
    postHandler = async (body) => ({ success: true, data: storedRequest({ requestType: body.requestType, id: "req-2" }) })
    renderPanel()
    await loaded()
    fireEvent.click(card("Technical Audit + Fix"))
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    await screen.findByText(/It has not been started yet/)
    expect(JSON.parse(posts()[0][1].body).requestType).toBe("technical_audit_fix")
    expect(screen.getByTestId("auditiq-status-technical_audit_fix")).toHaveTextContent("Requested — awaiting review")
    expect(document.body.textContent).not.toMatch(/audit (is )?complete/i)
  })

  test("repeated submits while one is in flight send exactly one request, and the form shows it is busy", async () => {
    let release
    postHandler = () => new Promise((resolve) => { release = () => resolve({ success: true, data: storedRequest() }) })
    renderPanel()
    await loaded()
    fireEvent.click(card("Express Fix"))
    const submit = screen.getByRole("button", { name: "Submit request" })
    fireEvent.click(submit)
    fireEvent.click(submit)
    fireEvent.click(submit)
    await screen.findByRole("button", { name: "Submitting…" })
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(posts()).toHaveLength(1)
    release()
    await screen.findByText(/Request submitted/)
    expect(posts()).toHaveLength(1)
  })

  test("a server failure is shown as an error, keeps the form (and the draft), and shows no success", async () => {
    postHandler = async () => { throw httpError(500, "Could not submit your request. Please try again.") }
    renderPanel()
    await loaded()
    fireEvent.click(card("Express Fix"))
    fireEvent.change(screen.getByLabelText(/Notes for the team/), { target: { value: "my note" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    expect(await screen.findByText("Could not submit your request. Please try again.")).toBeInTheDocument()
    expect(screen.getByTestId("auditiq-form-express_fix")).toBeInTheDocument()
    expect(screen.getByLabelText(/Notes for the team/)).toHaveValue("my note")
    expect(screen.queryByText(/Request submitted/)).not.toBeInTheDocument()
    expect(screen.queryByTestId("auditiq-status-express_fix")).not.toBeInTheDocument()
    // and can be retried
    expect(screen.getByRole("button", { name: "Submit request" })).toBeEnabled()
  })

  test("a network failure (no HTTP response) gets a plain-language message, not 'Failed to fetch'", async () => {
    postHandler = async () => { throw new TypeError("Failed to fetch") }
    renderPanel()
    await loaded()
    fireEvent.click(card("Express Fix"))
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    expect(await screen.findByText(/Couldn't reach Odito/)).toBeInTheDocument()
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument()
  })

  test("a rate-limit / validation message from the server is shown as returned", async () => {
    postHandler = async () => { throw httpError(429, "Too many requests. Please try again shortly.", { code: "RATE_LIMITED" }) }
    renderPanel()
    await loaded()
    fireEvent.click(card("Express Fix"))
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    expect(await screen.findByText("Too many requests. Please try again shortly.")).toBeInTheDocument()
  })

  test("409 duplicate from the server: tells the user, shows the existing request's real status, no second record", async () => {
    postHandler = async () => { throw httpError(409, "You already have an open request of this type for this issue.", { code: "DUPLICATE_OPEN_REQUEST", data: storedRequest({ status: "in_progress" }) }) }
    renderPanel()
    await loaded()
    fireEvent.click(card("Express Fix"))
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    expect(await screen.findByText(/already have an open request/)).toBeInTheDocument()
    expect(screen.getByTestId("auditiq-status-express_fix")).toHaveTextContent("In progress")
    expect(screen.queryByText(/Request submitted/)).not.toBeInTheDocument()
  })

  test("an existing open request is shown from the server and the card does not offer to send another", async () => {
    serviceState = { ...EMPTY_STATE, requests: { ...EMPTY_STATE.requests, express_fix: storedRequest({ status: "in_review" }) } }
    renderPanel()
    expect(await screen.findByTestId("auditiq-status-express_fix")).toHaveTextContent("In review")
    fireEvent.click(card("Express Fix"))
    expect(screen.queryByTestId("auditiq-form-express_fix")).not.toBeInTheDocument()
    expect(screen.getByText(/already have an open request for this issue/)).toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })

  test("a completed request is shown as completed and a new one can be started", async () => {
    serviceState = { ...EMPTY_STATE, requests: { ...EMPTY_STATE.requests, express_fix: storedRequest({ status: "completed", isOpen: false }) } }
    renderPanel()
    expect(await screen.findByTestId("auditiq-status-express_fix")).toHaveTextContent("Completed")
    fireEvent.click(card("Express Fix"))
    expect(screen.getByTestId("auditiq-form-express_fix")).toBeInTheDocument()
  })

  test("cards are keyboard operable (Enter opens the form)", async () => {
    renderPanel()
    await loaded()
    const el = card("Express Fix")
    expect(el).toHaveAttribute("tabindex", "0")
    fireEvent.keyDown(el, { key: "Enter" })
    expect(screen.getByTestId("auditiq-form-express_fix")).toBeInTheDocument()
  })
})

describe("Request Expert Fix", () => {
  const openExpert = async () => {
    renderPanel()
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: /Request Expert Fix/ }))
    return screen.getByTestId("auditiq-form-expert_fix")
  }

  test("opens a form whose description is required — empty and too-short input is rejected locally, nothing is sent", async () => {
    await openExpert()
    expect(screen.getByLabelText("What do you need help with?")).toHaveAttribute("aria-required", "true")
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 10 characters/)
    fireEvent.change(screen.getByLabelText("What do you need help with?"), { target: { value: "too short" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    expect(screen.getByRole("alert")).toHaveTextContent(/at least 10 characters/)
    expect(posts()).toHaveLength(0)
  })

  test("asks only for the description — contact details come from the account", async () => {
    const form = await openExpert()
    expect(within(form).queryByLabelText(/email|phone|name/i)).not.toBeInTheDocument()
    expect(form.querySelectorAll("input")).toHaveLength(0)
    expect(form.querySelectorAll("textarea")).toHaveLength(1)
  })

  test("a valid description is submitted as an expert_fix request and its status is shown", async () => {
    postHandler = async (body) => ({ success: true, data: storedRequest({ requestType: "expert_fix", message: body.message, id: "req-9" }) })
    await openExpert()
    fireEvent.change(screen.getByLabelText("What do you need help with?"), { target: { value: "Please fix the H1 on every product page" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    await screen.findByText(/Request submitted/)
    const body = JSON.parse(posts()[0][1].body)
    expect(body).toMatchObject({ requestType: "expert_fix", message: "Please fix the H1 on every product page", projectId: "project-1", issueKey: "missing_h1" })
    expect(screen.getByTestId("auditiq-status-expert_fix")).toHaveTextContent("Requested — awaiting review")
    // a second click now reports the open request instead of reopening the form
    fireEvent.click(screen.getByRole("button", { name: /Request Expert Fix/ }))
    expect(screen.queryByTestId("auditiq-form-expert_fix")).not.toBeInTheDocument()
    expect(screen.getByText(/already have an open request/)).toBeInTheDocument()
    expect(posts()).toHaveLength(1)
  })

  test("disables the trigger while submitting", async () => {
    postHandler = () => new Promise(() => {})
    await openExpert()
    fireEvent.change(screen.getByLabelText("What do you need help with?"), { target: { value: "Please fix the H1 on every product page" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }))
    await waitFor(() => expect(screen.getByRole("button", { name: /Request Expert Fix/ })).toBeDisabled())
    expect(posts()).toHaveLength(1)
  })
})

describe("Monthly Maintenance", () => {
  test("is reported as unavailable — no request is sent and nothing claims enrollment", async () => {
    renderPanel()
    await loaded()
    fireEvent.click(card("Monthly Maintenance"))
    const note = screen.getByText(/Monthly Maintenance isn't available yet/)
    expect(note).toHaveTextContent(/not been subscribed or charged/)
    expect(posts()).toHaveLength(0)
    expect(screen.queryByTestId("auditiq-form-maintenance")).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/subscribed to|enrolled in|you're enrolled|welcome/i)
  })

  test("when the availability lookup failed it says so instead of asserting 'unavailable'", async () => {
    serviceState = httpError(500, "Could not load your requests. Please try again.")
    renderPanel()
    await screen.findByText(/Couldn't load the status of your existing requests/, {}, SLOW)
    fireEvent.click(card("Monthly Maintenance"))
    expect(await screen.findByText(/Couldn't check whether Monthly Maintenance is available/)).toBeInTheDocument()
  })
})

describe("Book a Strategy Call", () => {
  test("not configured: shows a clear message and does not open anything", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    renderPanel()
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: /Book a Strategy Call/ }))
    expect(await screen.findByText(/booking isn't set up yet/i)).toBeInTheDocument()
    expect(open).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toMatch(/call (is )?booked|confirmed/i)
    open.mockRestore()
  })

  test("configured: opens exactly the server-provided URL in a new tab (noopener) and does not claim it is booked", async () => {
    serviceState = { ...EMPTY_STATE, services: { ...EMPTY_STATE.services, strategyCall: { available: true, reason: null, url: "https://cal.example.com/odito/strategy" } } }
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    renderPanel()
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: /Book a Strategy Call/ }))
    expect(open).toHaveBeenCalledWith("https://cal.example.com/odito/strategy", "_blank", "noopener,noreferrer")
    const note = await screen.findByText(/Your call is only booked once you complete it there/)
    expect(note.closest("div")).toHaveTextContent("Open booking page")
    expect(screen.getByRole("link", { name: "Open booking page" })).toHaveAttribute("href", "https://cal.example.com/odito/strategy")
    open.mockRestore()
  })

  test("while availability is still loading it says it is checking and opens nothing", async () => {
    apiService.request.mockImplementation(() => new Promise(() => {}))
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: /Book a Strategy Call/ }))
    expect(await screen.findByText(/Checking booking availability/)).toBeInTheDocument()
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
  })

  test("if availability could not be loaded it reports that, not 'not configured'", async () => {
    serviceState = httpError(500, "Could not load your requests. Please try again.")
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    renderPanel()
    await screen.findByText(/Couldn't load the status of your existing requests/, {}, SLOW)
    fireEvent.click(screen.getByRole("button", { name: /Book a Strategy Call/ }))
    expect(await screen.findByText(/Couldn't check booking availability/)).toBeInTheDocument()
    expect(screen.queryByText(/isn't set up yet/)).not.toBeInTheDocument()
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
  })
})

describe("state, tabs and missing context", () => {
  test("hiding the panel (tab switch) keeps a half-written note", async () => {
    const { rerender, queryClient } = renderPanel()
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: /Request Expert Fix/ }))
    fireEvent.change(screen.getByLabelText("What do you need help with?"), { target: { value: "half written note" } })
    const props = { projectId: "project-1", projectName: "Acme Site", issue: { issue_code: "missing_h1", title: "H1 missing" }, issueId: "missing_h1", issueCategory: "On-Page Issues", affectedPageCount: 12, selUrl: null, onBackToAi: () => {} }
    rerender(<QueryClientProvider client={queryClient}><AuditIqHelpPanel {...props} hidden /></QueryClientProvider>)
    expect(screen.getByTestId("auditiq-panel")).toHaveStyle({ display: "none" })
    rerender(<QueryClientProvider client={queryClient}><AuditIqHelpPanel {...props} hidden={false} /></QueryClientProvider>)
    expect(screen.getByLabelText("What do you need help with?")).toHaveValue("half written note")
  })

  test("without an active project the request buttons do nothing and no request is sent", async () => {
    renderPanel({ projectId: undefined })
    expect(screen.getByRole("button", { name: /Request Expert Fix/ })).toBeDisabled()
    fireEvent.click(card("Express Fix"))
    expect(screen.queryByTestId("auditiq-form-express_fix")).not.toBeInTheDocument()
    expect(apiService.request).not.toHaveBeenCalled()
  })

  test("a failed status load shows a retry that reloads it", async () => {
    serviceState = httpError(500, "Could not load your requests. Please try again.")
    renderPanel()
    await screen.findByText(/Couldn't load the status of your existing requests/, {}, SLOW)
    serviceState = EMPTY_STATE
    const before = gets().length
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(gets().length).toBeGreaterThan(before))
    await waitFor(() => expect(screen.queryByText(/Couldn't load the status/)).not.toBeInTheDocument())
  })
})
