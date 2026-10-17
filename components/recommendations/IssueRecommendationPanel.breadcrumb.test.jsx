import { describe, test, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import IssueRecommendationPanel from "./IssueRecommendationPanel"
import apiService from "@/lib/apiService"

vi.mock("./RecommendationCodeBlock", () => ({ default: ({ content }) => <pre data-testid="code-block">{content}</pre> }))
vi.mock("./RecommendationDiffViewer", () => ({ default: () => null }))
vi.mock("./RecommendationLoadingState", () => ({ default: () => <div>loading</div> }))
vi.mock("@/lib/apiService", () => ({
  default: { regenerateBreadcrumbHierarchy: vi.fn(), createTask: vi.fn(), updateTaskStatus: vi.fn(), request: vi.fn() },
}))

const ORIGIN = "https://clinic.example"
const CRAWL = `${ORIGIN}/blog`
const CANON = `${ORIGIN}/blog/`

const evidenceMeta = (breadcrumb, url = { display: CANON, trusted: true, source: "canonical_tag", crawlKey: CRAWL }) => ({ source: "claude", schemaEvidence: { kinds: ["breadcrumb"], url, breadcrumb } })
const UNKNOWN = { status: "unknown", needsInput: true, items: [], existingTrails: [], userProvided: null, conflict: null }

const baseRecommendation = (over = {}) => ({
  id: "rec-1", ruleId: "breadcrumblist_schema", severity: "medium",
  sections: { whyThisMatters: "Breadcrumbs matter.", recommendedVersion: "enabled", implementationExample: { type: "html", content: "<!-- ODITO: hierarchy could not be verified -->" } },
  ...over,
})

const generatedJsonLd = (items) => JSON.stringify({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map((i, n) => ({ "@type": "ListItem", position: n + 1, name: i.name, item: i.url })),
}, null, 2)
const generatedResponse = (items) => ({
  success: true,
  data: baseRecommendation({ id: "rec-2", sections: { whyThisMatters: "w", recommendedVersion: "enabled", implementationExample: { type: "html", content: `<script type="application/ld+json">\n${generatedJsonLd(items)}\n</script>` } } }),
  meta: evidenceMeta({ status: "user_provided", needsInput: false, items: items.map((i, n) => ({ ...i, position: n + 1 })), userProvided: { items, stale: false } }),
})

const success = (recommendation, meta, extra = {}) => ({ isIdle: false, isPending: false, isSuccess: true, isError: false, recommendation, meta, ...extra })

function renderPanel({ mutationState, issueId = "breadcrumblist_schema", selUrl = CRAWL, onRecommendationReplaced, onCreateTask, task = null } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const ui = (url) => (
    <QueryClientProvider client={qc}>
      <IssueRecommendationPanel projectId="p1" issueId={issueId} selUrl={url} issue={{ title: "Breadcrumb schema missing", category: "Schema", severity: "medium" }}
        mutationState={mutationState} onGenerate={vi.fn()} onReset={vi.fn()} onRecommendationReplaced={onRecommendationReplaced} onCreateTask={onCreateTask} task={task} />
    </QueryClientProvider>
  )
  const view = render(ui(selUrl))
  return { ...view, qc, rerenderWith: (url) => view.rerender(ui(url)) }
}

const urlInputs = () => screen.getAllByLabelText("Page URL")
const nameInputs = () => screen.getAllByLabelText("Page name")
const fill = (input, value) => fireEvent.change(input, { target: { value } })
const submitButton = () => screen.getByRole("button", { name: /Generate BreadcrumbList|Generating…/ })

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe("A. hierarchy unavailable — the form, never a fake code example", () => {
  const unknown = () => success(baseRecommendation(), evidenceMeta(UNKNOWN))

  test("shows the titled form with the required description, and NO code block", () => {
    renderPanel({ mutationState: unknown() })
    expect(screen.getByRole("heading", { name: "Complete Your Breadcrumb Hierarchy" })).toBeInTheDocument()
    expect(screen.getByText("Provide the verified pages that lead to this page. Odito will use these details to generate BreadcrumbList structured data.")).toBeInTheDocument()
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument()
    expect(screen.getByText(/will not guess your parent pages/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument()
  })

  test("the current page row is identified and prefilled with the VERIFIED canonical URL", () => {
    renderPanel({ mutationState: unknown(), onCreateTask: vi.fn() })
    const current = screen.getByTestId("breadcrumb-row-current")
    expect(within(current).getByText(/This page \(being audited\)/)).toBeInTheDocument()
    expect(within(current).getByLabelText("Page URL")).toHaveValue(CANON)
    expect(within(current).getByText(/Verified canonical URL from your site/)).toBeInTheDocument()
    expect(urlInputs()[0]).toHaveValue("")
    expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument()
  })

  test("no canonical: the URL field is EMPTY and the owner is asked to confirm the exact URL — the crawl URL is never put in", () => {
    renderPanel({ mutationState: success(baseRecommendation(), evidenceMeta(UNKNOWN, { display: CRAWL, trusted: false, source: "crawl_url", crawlKey: CRAWL })) })
    const current = screen.getByTestId("breadcrumb-row-current")
    expect(within(current).getByLabelText("Page URL")).toHaveValue("")
    expect(within(current).getByText(/No canonical tag was found for this page/)).toBeInTheDocument()
  })

  test("a layout for narrow screens exists: fields stack in a single column and become two columns from the sm breakpoint", () => {
    renderPanel({ mutationState: unknown() })
    expect(screen.getAllByTestId("breadcrumb-row")[0].querySelector(".grid")).toHaveClass("sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]")
  })

  test("every input has a visible label and the controls have accessible names", () => {
    renderPanel({ mutationState: unknown() })
    expect(nameInputs()).toHaveLength(2)
    expect(urlInputs()).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Move item 1 up" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Move item 1 down" })).toBeDisabled() // only one parent: nothing to swap with
    expect(screen.getByRole("button", { name: "Remove item 1" })).toBeDisabled() // the last remaining parent
    expect(screen.getByRole("button", { name: /Add parent page/ })).toBeEnabled()
  })

  test("a regular (non-breadcrumb) recommendation and an existing valid trail do NOT get the form (F)", () => {
    const { unmount } = renderPanel({ mutationState: success(baseRecommendation(), evidenceMeta({ ...UNKNOWN, status: "existing", needsInput: false, items: [{ position: 1, name: "Home", url: `${ORIGIN}/` }, { position: 2, name: "Blog", url: CANON }] })) })
    expect(screen.queryByTestId("breadcrumb-hierarchy-form")).not.toBeInTheDocument()
    expect(screen.queryByText("Complete Your Breadcrumb Hierarchy")).not.toBeInTheDocument()
    unmount()
    renderPanel({ issueId: "organization_schema", mutationState: success(baseRecommendation(), evidenceMeta(UNKNOWN)) })
    expect(screen.queryByTestId("breadcrumb-hierarchy-form")).not.toBeInTheDocument()
    renderPanel({ mutationState: success(baseRecommendation(), { source: "claude" }) })
  })
})

describe("form editing", () => {
  const setup = () => renderPanel({ mutationState: success(baseRecommendation(), evidenceMeta(UNKNOWN)) })

  test("parents can be added, reordered and removed; the current page stays last and has no move/remove controls", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: /Add parent page/ }))
    expect(screen.getAllByTestId("breadcrumb-row")).toHaveLength(2)
    fill(nameInputs()[0], "Home"); fill(urlInputs()[0], `${ORIGIN}/`)
    fill(nameInputs()[1], "Services"); fill(urlInputs()[1], `${ORIGIN}/services/`)

    fireEvent.click(screen.getByRole("button", { name: "Move item 1 down" }))
    expect(nameInputs().map((i) => i.value)).toEqual(["Services", "Home", ""])
    expect(urlInputs()[2]).toHaveValue(CANON)

    fireEvent.click(screen.getByRole("button", { name: "Move item 2 up" }))
    expect(nameInputs().map((i) => i.value)).toEqual(["Home", "Services", ""])

    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }))
    expect(nameInputs().map((i) => i.value)).toEqual(["Services", ""])
    expect(within(screen.getByTestId("breadcrumb-row-current")).queryByRole("button", { name: /Remove|Move/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove item 1" })).toBeDisabled()
  })

  test("the number of items is capped", () => {
    setup()
    for (let i = 0; i < 15; i++) {
      const add = screen.getByRole("button", { name: /Add parent page/ })
      if (!add.disabled) fireEvent.click(add)
    }
    expect(screen.getAllByTestId("breadcrumb-row").length + 1).toBe(10)
    expect(screen.getByRole("button", { name: /Add parent page/ })).toBeDisabled()
  })

  test("positions are never asked for", () => {
    setup()
    expect(screen.queryByLabelText(/position/i)).not.toBeInTheDocument()
  })
})

describe("submitting", () => {
  const setup = (extra) => {
    const utils = renderPanel({ mutationState: success(baseRecommendation(), evidenceMeta(UNKNOWN)), ...extra })
    fill(nameInputs()[0], "Home"); fill(urlInputs()[0], `${ORIGIN}/`); fill(nameInputs()[1], "Blog")
    return utils
  }
  const ITEMS = [{ name: "Home", url: `${ORIGIN}/` }, { name: "Blog", url: CANON }]

  test("client validation: nothing is sent, field errors are shown, and the entered values are kept", async () => {
    renderPanel({ mutationState: success(baseRecommendation(), evidenceMeta(UNKNOWN)) })
    fill(urlInputs()[0], "not a url")
    fireEvent.click(submitButton())
    expect((await screen.findAllByText("Page name is required.")).length).toBe(2) // both rows are unnamed
    expect(screen.getByText(/Enter a full URL/)).toBeInTheDocument()
    expect(apiService.regenerateBreadcrumbHierarchy).not.toHaveBeenCalled()
    expect(urlInputs()[0]).toHaveValue("not a url")
    expect(urlInputs()[0]).toHaveAttribute("aria-invalid", "true")
  })

  test("the last item must be the canonical page: a different URL is explained, not rewritten, and not sent", async () => {
    setup()
    fill(urlInputs()[1], `${ORIGIN}/news/`)
    fireEvent.click(submitButton())
    expect(await screen.findByText(/The last item must be this page. Its canonical URL is https:\/\/clinic\.example\/blog\//)).toBeInTheDocument()
    expect(urlInputs()[1]).toHaveValue(`${ORIGIN}/news/`)
    expect(apiService.regenerateBreadcrumbHierarchy).not.toHaveBeenCalled()
  })

  test("C. while generating: a loading state, a disabled form, and a second click sends nothing", async () => {
    let resolve
    apiService.regenerateBreadcrumbHierarchy.mockImplementation(() => new Promise((r) => { resolve = r }))
    setup()
    const btn = submitButton()
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByRole("button", { name: "Generating…" })).toBeDisabled())
    fireEvent.click(screen.getByRole("button", { name: "Generating…" }))
    fireEvent.submit(screen.getByTestId("breadcrumb-hierarchy-form"))
    expect(apiService.regenerateBreadcrumbHierarchy).toHaveBeenCalledTimes(1)
    expect(urlInputs()[0]).toBeDisabled()
    expect(screen.getByTestId("breadcrumb-hierarchy-form")).toHaveAttribute("aria-busy", "true")
    await act(async () => { resolve(generatedResponse(ITEMS)) })
  })

  test("the request carries exactly the page, project and the items WITHOUT positions; the abort signal is passed", async () => {
    apiService.regenerateBreadcrumbHierarchy.mockResolvedValue(generatedResponse(ITEMS))
    setup()
    fireEvent.click(submitButton())
    await waitFor(() => expect(apiService.regenerateBreadcrumbHierarchy).toHaveBeenCalledTimes(1))
    const [payload, options] = apiService.regenerateBreadcrumbHierarchy.mock.calls[0]
    expect(payload).toMatchObject({ projectId: "p1", pageUrl: CRAWL, items: ITEMS })
    expect(JSON.stringify(payload)).not.toMatch(/position/)
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  test("D. success: the generated JSON-LD, validation status, Copy Code and honest guidance replace the form", async () => {
    const onReplaced = vi.fn()
    apiService.regenerateBreadcrumbHierarchy.mockResolvedValue(generatedResponse(ITEMS))
    setup({ onRecommendationReplaced: onReplaced })
    fireEvent.click(submitButton())

    const result = await screen.findByTestId("breadcrumb-generated")
    expect(screen.queryByTestId("breadcrumb-hierarchy-form")).not.toBeInTheDocument()
    expect(screen.getByTestId("code-block").textContent).toContain('"@type": "BreadcrumbList"')
    expect(screen.getByTestId("code-block").textContent).toContain(`"item": "${CANON}"`)
    expect(within(result).getByText("Validated")).toBeInTheDocument()
    expect(within(result).getByText("Not applied to your site yet")).toBeInTheDocument()
    expect(within(screen.getByTestId("breadcrumb-validation")).getByText(/Positions run 1–2 in order; every URL is absolute and unique/)).toBeInTheDocument()
    expect(within(screen.getByTestId("breadcrumb-validation")).getByText(/verified canonical URL/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy Code" })).toBeInTheDocument()
    const guidance = screen.getByTestId("breadcrumb-guidance").textContent
    expect(guidance).toMatch(/does not change your website/)
    expect(guidance).toMatch(/never both/)
    expect(guidance).toMatch(/only after a recrawl finds the correct trail live/)
    expect(onReplaced).toHaveBeenCalledTimes(1)
    expect(onReplaced.mock.calls[0][0].data.id).toBe("rec-2")
  })

  test("copying the code copies exactly the generated code and never touches a task, a recommendation or the API", async () => {
    apiService.regenerateBreadcrumbHierarchy.mockResolvedValue(generatedResponse(ITEMS))
    setup()
    fireEvent.click(submitButton())
    await screen.findByTestId("breadcrumb-generated")
    const callsBefore = apiService.regenerateBreadcrumbHierarchy.mock.calls.length
    fireEvent.click(screen.getByRole("button", { name: "Copy Code" }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toBe(screen.getByTestId("code-block").textContent)
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument()
    expect(apiService.createTask).not.toHaveBeenCalled()
    expect(apiService.updateTaskStatus).not.toHaveBeenCalled()
    expect(apiService.regenerateBreadcrumbHierarchy.mock.calls.length).toBe(callsBefore)
  })

  test("B. the server rejects the hierarchy (422): the specific message is shown on the field and every value is preserved", async () => {
    const err = Object.assign(new Error("The breadcrumb hierarchy could not be validated."), {
      status: 422, code: "BREADCRUMB_INPUT_INVALID",
      errors: [{ index: 1, field: "url", code: "final_url_mismatch", message: `The last item must be the page being audited. Its canonical URL is ${CANON}.` }],
    })
    apiService.regenerateBreadcrumbHierarchy.mockRejectedValue(err)
    setup()
    fireEvent.click(submitButton())
    expect(await screen.findByText(/The last item must be the page being audited/)).toBeInTheDocument()
    expect(nameInputs().map((i) => i.value)).toEqual(["Home", "Blog"])
    expect(urlInputs().map((i) => i.value)).toEqual([`${ORIGIN}/`, CANON])
    expect(submitButton()).toBeEnabled()
    expect(screen.queryByTestId("breadcrumb-generated")).not.toBeInTheDocument()
  })

  test("E. regeneration fails (network / 500): an actionable error, values preserved, retry possible, nothing shown as generated", async () => {
    apiService.regenerateBreadcrumbHierarchy.mockRejectedValueOnce(new Error("Failed to regenerate the breadcrumb recommendation"))
    setup()
    fireEvent.click(submitButton())
    expect(await screen.findByText("Failed to regenerate the breadcrumb recommendation")).toBeInTheDocument()
    expect(screen.getByTestId("breadcrumb-form-errors")).toHaveAttribute("role", "alert")
    expect(nameInputs().map((i) => i.value)).toEqual(["Home", "Blog"])
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument()
    apiService.regenerateBreadcrumbHierarchy.mockResolvedValueOnce(generatedResponse(ITEMS))
    fireEvent.click(submitButton())
    expect(await screen.findByTestId("breadcrumb-generated")).toBeInTheDocument()
    expect(apiService.regenerateBreadcrumbHierarchy).toHaveBeenCalledTimes(2) // exactly one request per click — no automatic retry
  })

  test("an aborted request (the page changed) shows no error", async () => {
    apiService.regenerateBreadcrumbHierarchy.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }))
    setup()
    fireEvent.click(submitButton())
    await waitFor(() => expect(submitButton()).toBeEnabled())
    expect(screen.queryByTestId("breadcrumb-form-errors")).not.toBeInTheDocument()
  })

  test("a response that is not a success is an error, not a generated recommendation", async () => {
    apiService.regenerateBreadcrumbHierarchy.mockResolvedValue({ success: false, message: "nope" })
    setup()
    fireEvent.click(submitButton())
    expect(await screen.findByText("nope")).toBeInTheDocument()
    expect(screen.queryByTestId("breadcrumb-generated")).not.toBeInTheDocument()
  })
})

describe("generated state, edits, and page changes", () => {
  const ITEMS = [{ name: "Home", url: `${ORIGIN}/` }, { name: "Blog", url: CANON }]
  const generated = () => { const r = generatedResponse(ITEMS); return success(r.data, r.meta) }

  test("reopening the recommendation (server says user_provided) shows the saved, validated code — no form", () => {
    renderPanel({ mutationState: generated() })
    expect(screen.getByTestId("breadcrumb-generated")).toBeInTheDocument()
    expect(screen.queryByTestId("breadcrumb-hierarchy-form")).not.toBeInTheDocument()
  })

  test("Edit hierarchy reopens the form prefilled with the saved trail; Cancel returns to the code", () => {
    renderPanel({ mutationState: generated() })
    fireEvent.click(screen.getByRole("button", { name: "Edit hierarchy" }))
    expect(nameInputs().map((i) => i.value)).toEqual(["Home", "Blog"])
    expect(urlInputs().map((i) => i.value)).toEqual([`${ORIGIN}/`, CANON])
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByTestId("breadcrumb-generated")).toBeInTheDocument()
  })

  test("the generated code is shown with an unvalidatable body as NOT validated (never claimed ready)", () => {
    const r = generatedResponse(ITEMS)
    r.data.sections.implementationExample.content = "<script type=\"application/ld+json\">{ not json }</script>"
    renderPanel({ mutationState: success(r.data, r.meta) })
    expect(screen.getByText("Could not be validated")).toBeInTheDocument()
    expect(screen.queryByTestId("breadcrumb-validation")).not.toBeInTheDocument()
  })

  test("changing the audited page drops the regenerated result (it belongs to one page)", async () => {
    apiService.regenerateBreadcrumbHierarchy.mockResolvedValue(generatedResponse(ITEMS))
    const view = renderPanel({ mutationState: success(baseRecommendation(), evidenceMeta(UNKNOWN)) })
    fill(nameInputs()[0], "Home"); fill(urlInputs()[0], `${ORIGIN}/`); fill(nameInputs()[1], "Blog")
    fireEvent.click(submitButton())
    await screen.findByTestId("breadcrumb-generated")
    view.rerenderWith(`${ORIGIN}/other`)
    await waitFor(() => expect(screen.getByTestId("breadcrumb-hierarchy-form")).toBeInTheDocument())
  })

  test("G. a conflict explains itself, shows the existing trail, generates nothing and offers an edit", () => {
    const conflict = { kind: "existing_valid_differs", existingItems: [{ position: 1, name: "Home", url: `${ORIGIN}/` }, { position: 2, name: "News", url: `${ORIGIN}/news/` }, { position: 3, name: "Blog", url: CANON }] }
    renderPanel({ mutationState: success(baseRecommendation(), evidenceMeta({ status: "conflict", needsInput: false, items: [], existingTrails: [], userProvided: { items: ITEMS, stale: false }, conflict })), onCreateTask: vi.fn() })
    const box = screen.getByTestId("breadcrumb-conflict")
    expect(within(box).getByText("This page already outputs a BreadcrumbList")).toBeInTheDocument()
    expect(within(box).getByText(/would create a second BreadcrumbList, so none was generated/)).toBeInTheDocument()
    expect(within(box).getByText(/News/)).toBeInTheDocument()
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument()
    fireEvent.click(within(box).getByRole("button", { name: "Edit my hierarchy" }))
    expect(screen.getByTestId("breadcrumb-hierarchy-form")).toBeInTheDocument()
  })

  test("an invalid existing trail is explained with its problems", () => {
    renderPanel({ mutationState: success(baseRecommendation(), evidenceMeta({ status: "conflict", needsInput: false, items: [], existingTrails: [], userProvided: null, conflict: { kind: "existing_invalid", existingProblems: ["position_not_sequential", "duplicate_url"] } })) })
    expect(screen.getByText(/not valid/)).toBeInTheDocument()
    expect(screen.getByText(/position_not_sequential, duplicate_url/)).toBeInTheDocument()
  })
})

describe("lifecycle: nothing here implements or verifies anything", () => {
  test("generating does not call the task API; an implemented task keeps its status banner untouched", async () => {
    const ITEMS = [{ name: "Home", url: `${ORIGIN}/` }, { name: "Blog", url: CANON }]
    apiService.regenerateBreadcrumbHierarchy.mockResolvedValue(generatedResponse(ITEMS))
    renderPanel({ mutationState: success(baseRecommendation(), evidenceMeta(UNKNOWN)), task: { status: "implemented" } })
    expect(screen.getByText(/Implemented — Pending Verification/)).toBeInTheDocument()
    fill(nameInputs()[0], "Home"); fill(urlInputs()[0], `${ORIGIN}/`); fill(nameInputs()[1], "Blog")
    fireEvent.click(submitButton())
    await screen.findByTestId("breadcrumb-generated")
    expect(screen.getByText(/Implemented — Pending Verification/)).toBeInTheDocument()
    expect(screen.queryByText(/Verified Fixed/)).not.toBeInTheDocument()
    expect(apiService.createTask).not.toHaveBeenCalled()
    expect(apiService.updateTaskStatus).not.toHaveBeenCalled()
    expect(apiService.request).not.toHaveBeenCalled() // no audit / job endpoint was hit
  })
})
