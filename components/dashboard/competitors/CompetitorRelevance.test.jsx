import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { useState } from "react"
import RelevanceCell from "./RelevanceCell"
import RelevanceFilters from "./RelevanceFilters"
import CompetitorsTable from "./CompetitorsTable"
import { mapCompetitor } from "./mapCompetitor"
import { REAL_COMPETITORS } from "./testFixtures"
import { applyFilters, countByClass } from "./relevanceUi"

vi.mock("next/link", () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))

// The six domains of the product brief (Krishna Eye Centre, Nashik), with the verdicts the backend rules give them.
const assessed = (domain, cls, over = {}) => ({
  domain, status: "done", class: cls, autoClass: cls, overridden: false, override: null, confidence: 0.9, level: "high", stale: false, assessedAt: "2026-11-02T10:00:00Z",
  reasons: [{ code: "x", text: `Reason for ${domain}.`, source: "website" }],
  signals: { kind: "business", sector: "high", sectorTerms: ["eye hospital", "lasik"], geo: "same_city", scope: "local", registryKind: null }, ...over,
})
const registry = (domain, kind) => assessed(domain, "informational_directory", {
  reasons: [{ code: "registry", text: `${domain} is a ${kind}.`, source: "registry" }, { code: "keyword_overlap_only", text: "It ranks for some of your keywords, but that alone does not make it a business competitor.", source: "seo" }],
  signals: { kind: "government", sector: "unknown", sectorTerms: [], geo: "unknown", scope: "local", registryKind: kind },
})
const BRIEF = [
  registry("nih.gov", "government"), registry("aao.org", "association"), registry("practo.com", "directory"), registry("eyewiki.org", "publisher"),
  assessed("clevelandclinic.org", "indirect_competitor", { signals: { kind: "business", sector: "high", sectorTerms: ["eye hospital"], geo: "different_country", scope: "local", registryKind: null } }),
  assessed("asgeyehospital.com", "direct_competitor"),
]

describe("RelevanceCell", () => {
  test("shows the class as a badge; the popover explains it with each reason's source, and says shared keywords are not enough", () => {
    render(<RelevanceCell domain="practo.com" assessment={registry("practo.com", "directory")} onOverride={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByTestId("rel-badge").textContent).toMatch(/Informational/)
    fireEvent.click(screen.getByTestId("rel-why-button"))
    const why = within(screen.getByTestId("rel-why"))
    expect(why.getByText("Informational / directory")).toBeTruthy()
    expect(why.getByText(/practo\.com is a directory/)).toBeTruthy()
    expect(why.getByText("Odito's list of well-known sites")).toBeTruthy()
    expect(why.getByText(/that alone does not make it a business competitor/)).toBeTruthy()
    expect(within(why.getByTestId("rel-signals")).getByText("Government or public body")).toBeTruthy()
    expect(why.getByText(/Keyword overlap alone never makes a site a direct competitor/)).toBeTruthy()
  })

  test("a direct competitor explains industry, services and location evidence", () => {
    render(<RelevanceCell domain="asgeyehospital.com" assessment={assessed("asgeyehospital.com", "direct_competitor")} onOverride={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(screen.getByTestId("rel-why-button"))
    const s = within(screen.getByTestId("rel-signals"))
    expect(s.getByText(/Strong match with what you do \(eye hospital, lasik\)/)).toBeTruthy()
    expect(s.getByText("Same city")).toBeTruthy()
    expect(s.getByText("A business")).toBeTruthy()
  })

  test("queued, unchecked and failed states say what is going on", () => {
    const { rerender } = render(<RelevanceCell domain="a.com" assessment={{ domain: "a.com", status: "pending", class: null }} />)
    expect(screen.getByTestId("rel-cell").dataset.state).toBe("pending")
    expect(screen.getByTestId("rel-badge").textContent).toMatch(/Checking/)
    rerender(<RelevanceCell domain="a.com" assessment={undefined} />)
    expect(screen.getByTestId("rel-cell").dataset.state).toBe("none")
    expect(screen.getByTestId("rel-badge").textContent).toMatch(/Not checked/)
  })

  test("changing the classification calls the handler with the domain and the class; a decision is shown as the user's and can be reset", () => {
    const onOverride = vi.fn(); const onClear = vi.fn()
    const mine = assessed("practo.com", "indirect_competitor", { autoClass: "informational_directory", overridden: true, override: { class: "indirect_competitor", note: "they book surgeries", at: "2026-11-02T11:00:00Z" } })
    render(<RelevanceCell domain="practo.com" assessment={mine} onOverride={onOverride} onClear={onClear} />)
    expect(screen.getByTestId("rel-badge").title).toMatch(/Set by you/)
    fireEvent.click(screen.getByTestId("rel-why-button"))
    expect(screen.getByTestId("rel-overridden").textContent).toMatch(/they book surgeries/)
    expect(screen.getByTestId("rel-overridden").textContent).toMatch(/automatic result was .Informational/)
    expect(screen.getByTestId("rel-set-indirect_competitor").getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(screen.getByTestId("rel-set-not_relevant"))
    expect(onOverride).toHaveBeenCalledWith("practo.com", "not_relevant")
    fireEvent.click(screen.getByTestId("rel-clear"))
    expect(onClear).toHaveBeenCalledWith("practo.com")
  })

  test("Check this site again asks for a fresh check of that domain, and is unavailable while one is already running", () => {
    const onReassess = vi.fn()
    const { rerender } = render(<RelevanceCell domain="a.com" assessment={assessed("a.com", "needs_review")} onOverride={vi.fn()} onClear={vi.fn()} onReassess={onReassess} />)
    fireEvent.click(screen.getByTestId("rel-why-button"))
    fireEvent.click(screen.getByTestId("rel-reassess"))
    expect(onReassess).toHaveBeenCalledWith("a.com")
    rerender(<RelevanceCell domain="a.com" assessment={{ ...assessed("a.com", "needs_review"), status: "pending" }} onOverride={vi.fn()} onClear={vi.fn()} onReassess={onReassess} />)
    expect(screen.getByTestId("rel-reassess").disabled).toBe(true)
  })

  test("without a handler there is no such button", () => {
    render(<RelevanceCell domain="a.com" assessment={assessed("a.com", "direct_competitor")} onOverride={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(screen.getByTestId("rel-why-button"))
    expect(screen.queryByTestId("rel-reassess")).toBeNull()
  })

  test("a record that was never changed by the user has no reset button", () => {
    render(<RelevanceCell domain="a.com" assessment={assessed("a.com", "direct_competitor")} onOverride={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(screen.getByTestId("rel-why-button"))
    expect(screen.queryByTestId("rel-clear")).toBeNull()
  })
})

function Harness({ rows, byDomain }) {
  const [filter, setFilter] = useState("all"); const [search, setSearch] = useState("")
  const domains = rows.map((r) => r.domain)
  const shown = applyFilters(rows, byDomain, { filter, search })
  const active = filter !== "all" || search.trim() !== ""
  return (
    <>
      <RelevanceFilters filter={filter} onFilter={setFilter} search={search} onSearch={setSearch} counts={countByClass(domains, byDomain)} loaded={rows.length} total={1629} shown={shown.length} />
      <CompetitorsTable
        page={{ status: "success", rows: shown, total: 1629, offset: 0, stale: false, isFetching: false }}
        state={{ sort: "shared", dir: "desc", page: 1, pageSize: 50 }} update={vi.fn()}
        trackedSet={new Set()} trackPending={new Set()} excludePending={new Set()} onToggleTrack={vi.fn()} onExclude={vi.fn()}
        highlight={null} settingsActive={false} onResetSettings={vi.fn()} viewKey="v"
        assessments={{ byDomain, pending: new Set() }} onOverride={vi.fn()} onClearOverride={vi.fn()}
        mineDomains={new Set()} addPending={new Set()} onAddMine={vi.fn()}
        filterInfo={{ active, loaded: rows.length, onReset: () => { setFilter("all"); setSearch("") } }}
      />
    </>
  )
}

describe("SEO table: relevance column and page filters", () => {
  const rows = ["nih.gov", "aao.org", "practo.com", "eyewiki.org", "clevelandclinic.org", "asgeyehospital.com"].map((domain, i) => ({ ...mapCompetitor({ ...REAL_COMPETITORS[i], domain }), domain }))
  const byDomain = new Map(BRIEF.map((a) => [a.domain, a]))

  test("every row has its relevance badge; the SEO columns are still there; sharing keywords does not decide it", () => {
    render(<Harness rows={rows} byDomain={byDomain} />)
    const table = within(screen.getByTestId("cp-table"))
    expect(table.getByRole("columnheader", { name: /Business relevance/ })).toBeTruthy()
    expect(table.getByRole("columnheader", { name: /Shared keywords/ })).toBeTruthy()
    const classOf = (d) => within(screen.getByTestId("cp-table").querySelector(`[data-domain="${d}"]`)).getByTestId("rel-cell").dataset.class
    expect(classOf("nih.gov")).toBe("informational_directory")
    expect(classOf("clevelandclinic.org")).toBe("indirect_competitor")
    expect(classOf("asgeyehospital.com")).toBe("direct_competitor")
  })

  test("the filter chips count the loaded page and the note says they do not cover all discovered domains", () => {
    render(<Harness rows={rows} byDomain={byDomain} />)
    expect(screen.getByTestId("rel-filter-all").textContent).toMatch(/6/)
    expect(screen.getByTestId("rel-filter-informational_directory").textContent).toMatch(/4/)
    expect(screen.getByTestId("rel-filter-direct_competitor").textContent).toMatch(/1/)
    expect(screen.getByTestId("rel-filter-needs_review").textContent).toMatch(/0/)
    expect(screen.getByTestId("rel-scope").textContent).toBe("Applies to the 6 competitors loaded on this page, not to all 1,629 domains.")
  })

  test("choosing Direct keeps only the rows of this page that are direct, says so, and nothing is removed from the data", () => {
    render(<Harness rows={rows} byDomain={byDomain} />)
    fireEvent.click(screen.getByTestId("rel-filter-direct_competitor"))
    const shown = screen.getAllByTestId("cp-row")
    expect(shown.map((r) => r.dataset.domain)).toEqual(["asgeyehospital.com"])
    expect(screen.getByTestId("cp-showing").textContent).toBe("Showing 1 of the 6 loaded on this page · 1,629 discovered")
    expect(screen.getByTestId("rel-filter-direct_competitor").getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(screen.getByTestId("rel-filter-all"))
    expect(screen.getAllByTestId("cp-row")).toHaveLength(6)
    expect(screen.getByTestId("cp-showing").textContent).toBe("Showing 1–6 of 1,629 competitors")
  })

  test("the domain search narrows the loaded rows, and a filter that matches nothing says so and can be cleared", () => {
    render(<Harness rows={rows} byDomain={byDomain} />)
    fireEvent.change(screen.getByTestId("rel-search"), { target: { value: "PRACTO" } })
    expect(screen.getAllByTestId("cp-row").map((r) => r.dataset.domain)).toEqual(["practo.com"])
    fireEvent.click(screen.getByTestId("rel-filter-direct_competitor"))
    expect(screen.queryAllByTestId("cp-row")).toHaveLength(0)
    expect(screen.getByTestId("cp-empty").textContent).toMatch(/None of the 6 competitors loaded on this page matches this filter/)
    fireEvent.click(screen.getByTestId("cp-clear-filter"))
    expect(screen.getAllByTestId("cp-row")).toHaveLength(6)
  })

  test("a row can be added to My competitors; one already there says so instead", () => {
    const onAddMine = vi.fn()
    render(
      <CompetitorsTable
        page={{ status: "success", rows: rows.slice(0, 2), total: 2, offset: 0, stale: false, isFetching: false }}
        state={{ sort: "shared", dir: "desc", page: 1, pageSize: 50 }} update={vi.fn()} trackedSet={new Set()} trackPending={new Set()} excludePending={new Set()}
        onToggleTrack={vi.fn()} onExclude={vi.fn()} highlight={null} settingsActive={false} onResetSettings={vi.fn()} viewKey="v"
        assessments={{ byDomain, pending: new Set() }} mineDomains={new Set(["aao.org"])} addPending={new Set()} onAddMine={onAddMine}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Add nih.gov to My competitors" }))
    expect(onAddMine).toHaveBeenCalledWith(expect.objectContaining({ domain: "nih.gov" }))
    expect(screen.getByTestId("cp-in-mine").textContent).toMatch(/In My competitors/)
    expect(screen.queryByRole("button", { name: "Add aao.org to My competitors" })).toBeNull()
  })

  test("without the new props the table is exactly the old one (no add button, no relevance data needed)", () => {
    render(
      <CompetitorsTable
        page={{ status: "success", rows: rows.slice(0, 2), total: 2, offset: 0, stale: false, isFetching: false }}
        state={{ sort: "shared", dir: "desc", page: 1, pageSize: 50 }} update={vi.fn()} trackedSet={new Set()} trackPending={new Set()} excludePending={new Set()}
        onToggleTrack={vi.fn()} onExclude={vi.fn()} highlight={null} settingsActive={false} onResetSettings={vi.fn()} viewKey="v"
      />,
    )
    expect(screen.queryByTestId("cp-add-mine")).toBeNull()
    expect(screen.getAllByTestId("rel-cell")[0].dataset.state).toBe("none")
    expect(screen.getByTestId("cp-showing").textContent).toBe("Showing 1–2 of 2 competitors")
  })
})
