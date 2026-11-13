/**
 * Which cached page queries a collected dataset changes. A dataset finishing refreshes ONLY those queries, so a background collection of
 * the backlinks never refetches the keywords on screen (and the page keeps showing its previous data while the refetch runs).
 *
 * The second element of a key is the project; the third is the section the query reads (lib/query/keys.js `domainOverview`).
 * The stored row sets answer more than one section: the backlink set also answers the Anchors and Top Pages roll-ups.
 */
const ROOTS = Object.freeze({
  "rank-overview": ["rank-overview"],
  history: ["history"],
  "ranked-keywords-top5": ["ranked-keywords", "top-keywords"],
  "ranked-keywords-page": ["keywords"],
  "keywords-dataset": ["ranked-keywords", "top-keywords", "keywords"],
  competitors: ["competitors"],
  backlinks: ["backlinks"],
  "backlinks-list": ["backlinks-list"],
  "backlinks-dataset-live": ["backlinks-list", "anchors", "anchor-profile", "domain-pages"],
  "backlinks-dataset-lost": ["backlinks-list", "anchors", "anchor-profile"],
  anchors: ["anchors"],
  "anchor-profile": ["anchor-profile"],
  "referring-domains": ["referring-domains"],
  "referring-domains-dataset-live": ["referring-domains"],
  "referring-domains-dataset-lost": ["referring-domains"],
  "rd-rank-buckets": ["rd-rank-buckets"],
  "rd-toxic-count": ["rd-toxic-count"],
  "rd-last-30": ["rd-last-30"],
  "tp-counts": ["tp-counts"],
  "tp-fix-first": ["tp-fix-first"],
  "domain-pages-all": ["domain-pages"],
  "domain-pages-ok": ["domain-pages"],
  "top-pages-traffic": ["domain-pages"],
})

/** The section names (third key element) a dataset feeds; unknown datasets feed nothing. */
export const sectionsOfDataset = (datasetId) => ROOTS[datasetId] ?? []

/** Marks the project's queries that read `datasetId` stale (active ones refetch). Returns the sections touched. */
export function invalidateDataset(queryClient, projectId, datasetId) {
  const sections = new Set(sectionsOfDataset(datasetId))
  if (!sections.size) return []
  queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "domain-overview" && q.queryKey[1] === projectId && sections.has(q.queryKey[2]) })
  return [...sections]
}
