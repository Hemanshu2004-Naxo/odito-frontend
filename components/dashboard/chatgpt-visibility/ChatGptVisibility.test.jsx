import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { createElement } from "react"

const hooks = vi.hoisted(() => ({ summary: null, runs: null, run: null, sets: null, start: { mutate: vi.fn(), isPending: false, error: null } }))

vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { _id: "p1" } }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams("") }))
vi.mock("@/hooks/useChatGptVisibility", () => ({
  useChatGptSummary: () => hooks.summary,
  useChatGptRuns: () => hooks.runs,
  useChatGptRun: () => hooks.run,
  useChatGptPromptSets: () => hooks.sets,
  useStartChatGptRun: () => hooks.start,
  useCancelChatGptRun: () => ({ mutate: vi.fn(), isPending: false }),
  useChatGptLiveProgress: () => null,
}))

import ResultsContent from "./ResultsContent"
import HistoryContent from "./HistoryContent"
import PromptsContent from "./PromptsContent"
import { describeStartError, formatCost, pct } from "./format"

const group = (o = {}) => ({ prompts: 3, attempted: 3, succeeded: 3, failed: 0, skipped: 0, executionSuccessRate: 1, successfulResponses: 3, brandMentions: 2, brandMentionRate: 0.6667, responsesWithWebsiteCitation: 1, websiteCitationRate: 0.3333, uniqueCitedPages: 2, citationOccurrences: 4, competitorMentions: { totalOccurrences: 0, competitors: [] }, ...o })
const run = (o = {}) => ({
  id: "r1", status: "completed", createdAt: "2026-10-24T10:00:00Z", completedAt: "2026-10-24T10:02:00Z", promptSetVersion: 2, promptGeneratedBy: "template",
  totalCost: { amount: 0.1306, unit: "provider_reported", unknownCount: 0 }, trigger: { source: "audit" }, progress: { completed: 5, total: 5, stage: "completed" },
  metrics: { overall: group({ prompts: 5, attempted: 5, succeeded: 5, successfulResponses: 5, competitorMentions: { totalOccurrences: 2, competitors: [{ name: "Rival Clinic", responses: 1, occurrences: 2 }] } }), branded: group({ prompts: 2 }), nonBranded: group(), partial: false, limitations: [] },
  ...o,
})

beforeEach(() => {
  hooks.summary = { isLoading: false, data: { data: { latest: run(), active: null } } }
  hooks.runs = { data: { data: [run(), run({ id: "r0", promptSetVersion: 1, createdAt: "2026-10-20T10:00:00Z" })], meta: { page: 1, totalPages: 1 } } }
  hooks.run = {
    isLoading: false,
    data: { data: { ...run(), target: { targetHost: "asgeye.example" }, market: { countryCode: "IN", effectiveScope: "local", city: "Ahmedabad" }, executions: [
      { category: "industry_discovery", branded: false, prompt: "Which eye hospitals?", status: "succeeded", answer: "Answer body", annotations: [{ title: "Maps", url: "https://www.google.com/maps/search/x?utm_source=chatgpt.com" }, { title: "Home", url: "https://www.asgeye.example/" }], analysis: { brandMentioned: true, brandMentionCount: 1, targetCitationCount: 1, targetPages: ["https://asgeye.example"], competitorMentions: [] }, cost: 0.026 },
      { category: "brand_recognition", branded: true, prompt: "What is ASG?", status: "failed", errorCode: "CHATGPT_TIMEOUT", annotations: [], answer: null, cost: null },
    ] } },
  }
  hooks.sets = { isLoading: false, data: { data: [{ id: "s1", version: 2, generatedBy: "template", createdAt: "2026-10-24T10:00:00Z", prompts: [{ category: "brand_recognition", text: "What is ASG?", branded: true, usesService: false, usesCompetitors: false }, { category: "industry_discovery", text: "Which eye hospitals?", branded: false, usesService: false, usesCompetitors: false }] }] } }
})

describe("ChatGPT Visibility pages", () => {
  // The five-prompt OVERVIEW was removed from the product (the main page is the approved-question dashboard; see aiQuestions.test.jsx).
  // Its legacy run detail, history and prompt-set views below are still served for older runs.
  test("results: answers, linked sources with your site marked, and failed prompts explained as excluded", () => {
    render(createElement(ResultsContent))
    expect(screen.getByText("Answer body")).toBeTruthy()
    expect(screen.getByText("Your site")).toBeTruthy()
    expect(screen.getByText(/The request timed out/)).toBeTruthy()
    expect(screen.getByText(/left out of the percentages/)).toBeTruthy()
    expect(screen.getByText("0.0260")).toBeTruthy() // the answered prompt's reported cost; the failed one shows no cost at all, never 0
    expect(document.body.textContent).not.toMatch(/Provider cost0\.0000/)
  })

  test("history compares only runs that used the same prompts", () => {
    render(createElement(HistoryContent))
    expect(screen.getAllByText("prompts changed").length).toBe(2) // both change columns
    expect(screen.getAllByRole("link").length).toBe(2)
  })

  test("prompts page lists the version in category order", () => {
    render(createElement(PromptsContent))
    expect(screen.getByText("Version 2 · current")).toBeTruthy()
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(["Industry discovery", "Brand recognition"])
  })

  test("format helpers", () => {
    expect(pct(null)).toBe("—")
    expect(pct(0)).toBe("0%")
    expect(formatCost({ amount: null, unknownCount: 2 })).toBe("Not reported")
    expect(formatCost({ amount: 0.0272, unit: "provider_reported" })).toBe("0.0272")
    expect(describeStartError({ status: 503 })).toMatch(/not enabled/)
    expect(describeStartError({ status: 429, details: { code: "PROJECT_COOLDOWN" } })).toMatch(/very recently/)
  })
})
