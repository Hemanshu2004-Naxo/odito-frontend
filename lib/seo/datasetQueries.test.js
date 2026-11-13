import { describe, it, expect } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { invalidateDataset, sectionsOfDataset } from "./datasetQueries"
import { queryKeys } from "@/lib/query/keys"

const keys = (projectId = "p1") => ({
  history: queryKeys.domainOverview.history(projectId, 12),
  rankOverview: queryKeys.domainOverview.section(projectId, "rank-overview"),
  keywordsTotals: queryKeys.domainOverview.rankedKeywords(projectId),
  keywordsPage: queryKeys.domainOverview.keywords(projectId, { limit: 25, offset: 0 }),
  backlinks: queryKeys.domainOverview.backlinks(projectId, { status: "live", dofollow: false }),
  backlinksList: queryKeys.domainOverview.backlinksList(projectId, { status: "live" }),
  anchors: queryKeys.domainOverview.anchors(projectId, { status: "live" }),
  referringDomains: queryKeys.domainOverview.referringDomains(projectId, { status: "live" }),
  topPages: queryKeys.domainOverview.topPages(projectId, { limit: 50 }),
  competitors: queryKeys.domainOverview.competitors(projectId, { limit: 50 }, "sig"),
})

function seed() {
  const client = new QueryClient()
  for (const pid of ["p1", "p2"]) for (const k of Object.values(keys(pid))) client.setQueryData(k, { ok: true })
  client.setQueryData(["social", "p1", "posts"], { ok: true })
  return client
}
const stale = (client) => Object.entries(keys("p1")).filter(([, k]) => client.getQueryState(k).isInvalidated).map(([n]) => n).sort()

describe("a completed dataset refreshes only the queries that read it", () => {
  it("history -> the traffic query and nothing else", () => {
    const c = seed(); invalidateDataset(c, "p1", "history")
    expect(stale(c)).toEqual(["history"])
  })

  it("competitors -> competitors only", () => {
    const c = seed(); invalidateDataset(c, "p1", "competitors")
    expect(stale(c)).toEqual(["competitors"])
  })

  it("the stored keyword set -> totals + table pages, not backlinks", () => {
    const c = seed(); invalidateDataset(c, "p1", "keywords-dataset")
    expect(stale(c)).toEqual(["keywordsPage", "keywordsTotals"])
  })

  it("the stored live backlink set feeds the list, anchors and top pages - not the summary or referring domains", () => {
    const c = seed(); invalidateDataset(c, "p1", "backlinks-dataset-live")
    expect(stale(c)).toEqual(["anchors", "backlinksList", "topPages"])
  })

  it("another project and other query families are never touched; an unknown dataset touches nothing", () => {
    const c = seed(); invalidateDataset(c, "p1", "backlinks")
    expect(stale(c)).toEqual(["backlinks"])
    for (const k of Object.values(keys("p2"))) expect(c.getQueryState(k).isInvalidated).toBe(false)
    expect(c.getQueryState(["social", "p1", "posts"]).isInvalidated).toBe(false)
    const d = seed()
    expect(invalidateDataset(d, "p1", "nope")).toEqual([])
    expect(stale(d)).toEqual([])
  })

  it("every dataset the pages need feeds at least one query root", () => {
    // Mirrors the backend's DATASETS (seo_data/config.js); a dataset with no mapping would never refresh its page.
    const all = ["rank-overview", "history", "ranked-keywords-top5", "keywords-dataset", "competitors", "backlinks", "backlinks-list", "backlinks-dataset-live", "backlinks-dataset-lost", "anchors", "anchor-profile",
      "referring-domains", "referring-domains-dataset-live", "referring-domains-dataset-lost", "rd-rank-buckets", "rd-toxic-count", "rd-last-30", "tp-counts", "tp-fix-first", "domain-pages-all", "domain-pages-ok", "top-pages-traffic"]
    for (const id of all) expect(sectionsOfDataset(id).length, id).toBeGreaterThan(0)
  })
})
