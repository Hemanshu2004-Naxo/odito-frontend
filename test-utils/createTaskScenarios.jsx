import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"

/**
 * Shared "Create Task" contract, run against every screen that renders the AI
 * recommendation panel. It drives the REAL panel button (never a stubbed
 * prop), so it covers the whole chain:
 *
 *   Create Task button → panel callback → screen handler → POST /tasks
 *   → success / duplicate / error handling → task-list refresh → UI feedback
 *
 * A screen that forgets to pass onCreateTask (or passes a no-op) fails here:
 * either the button is absent or clicking it never reaches apiService.createTask.
 *
 * Each screen's test file supplies:
 *   label            — describe title
 *   apiService       — the mocked apiService (request + createTask)
 *   renderScreen(qc) — mounts the screen inside a QueryClientProvider using qc
 *   generate()       — async: selects the page (if the screen needs it) and
 *                      generates a recommendation, so the panel is in its
 *                      "recommendation ready" state
 *   setTaskMap(map)  — sets what the mocked task-list query returns ({ [url]: task })
 *   pageUrl          — the URL a task must be created for
 *   expectedPayload  — the fields POST /tasks must carry (matched with objectContaining)
 */

export const RECOMMENDATION_RESPONSE = {
  success: true,
  data: { id: "rec-1", ruleId: "x", severity: "medium", sections: { whyThisMatters: "why", recommendedVersion: "fix" } },
  meta: {},
}

export const createTaskButton = () => screen.queryByRole("button", { name: /Create Task|Creating/ })

// expectedRecommendationId: legacy screens create the task from a generated recommendation ("rec-1"). The unified "Investigate & Recommend" screens
// create it from the investigation, with NO legacy record yet (null); the existing auto-link attaches one later if the compatibility adapter produces it.
export function defineCreateTaskScenarios({ label, apiService, renderScreen, generate, setTaskMap, pageUrl, expectedPayload, expectedRecommendationId = "rec-1" }) {
  let queryClient

  async function mount() {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    vi.spyOn(queryClient, "invalidateQueries")
    renderScreen(queryClient)
    await generate()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setTaskMap({})
    apiService.request.mockResolvedValue(RECOMMENDATION_RESPONSE)
  })

  describe(`${label} — Create Task`, () => {
    test("the panel offers a real, enabled Create Task button", async () => {
      await mount()
      const button = await screen.findByRole("button", { name: /Create Task/ })
      expect(button).toBeEnabled()
    })

    test("creates the task for the right project / page URL / issue, confirms it, and refreshes the task lists", async () => {
      apiService.createTask.mockResolvedValue({ success: true, data: { _id: "task-1", status: "task_created" } })
      await mount()

      fireEvent.click(await screen.findByRole("button", { name: /Create Task/ }))

      await waitFor(() => expect(apiService.createTask).toHaveBeenCalledTimes(1))
      expect(apiService.createTask).toHaveBeenCalledWith(expect.objectContaining({
        pageUrl, status: "task_created", origin: "ai_fix", recommendationId: expectedRecommendationId, ...expectedPayload,
      }))
      expect(await screen.findByText(/Task created/)).toBeInTheDocument()

      const invalidatedKeys = queryClient.invalidateQueries.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey))
      expect(invalidatedKeys.some((k) => k.includes("active-urls"))).toBe(true)   // this issue's task list
      expect(invalidatedKeys.some((k) => k.includes("summary"))).toBe(true)        // task summary counts
    })

    test("if the server reports the task already exists (created elsewhere), says so — no duplicate", async () => {
      apiService.createTask.mockResolvedValue({ success: true, data: { _id: "task-1", status: "task_created" }, alreadyExists: true })
      await mount()

      fireEvent.click(await screen.findByRole("button", { name: /Create Task/ }))

      expect(await screen.findByText(/Task already exists/)).toBeInTheDocument()
      expect(apiService.createTask).toHaveBeenCalledTimes(1)
    })

    test("a task already in the list is shown as created and Create Task is not offered again", async () => {
      setTaskMap({ [pageUrl]: { _id: "task-9", status: "task_created" } })
      await mount()

      expect(await screen.findByText(/Task Created/)).toBeInTheDocument()
      expect(createTaskButton()).not.toBeInTheDocument()
      expect(apiService.createTask).not.toHaveBeenCalled()
    })

    test("an API failure shows the API's own error message", async () => {
      apiService.createTask.mockRejectedValue(new Error("Project quota exceeded"))
      await mount()

      fireEvent.click(await screen.findByRole("button", { name: /Create Task/ }))

      expect(await screen.findByText("Project quota exceeded")).toBeInTheDocument()
    })

    test("while the request is running the button is disabled and repeated clicks send exactly one request", async () => {
      let resolveRequest
      apiService.createTask.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
      await mount()

      const button = await screen.findByRole("button", { name: /Create Task/ })
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      await waitFor(() => expect(screen.getByRole("button", { name: /Creating/ })).toBeDisabled())
      expect(apiService.createTask).toHaveBeenCalledTimes(1)

      resolveRequest({ success: true, data: { _id: "task-1", status: "task_created" } })
      expect(await screen.findByText(/Task created/)).toBeInTheDocument()
      expect(apiService.createTask).toHaveBeenCalledTimes(1)
    })
  })
}
