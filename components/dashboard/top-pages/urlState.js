import { DEFAULT_PAGE_SIZE, DEFAULT_TAB, FLAG_IDS, MAX_OFFSET, MAX_TEXT_LENGTH, PAGE_SIZES, SORT_FIELDS, TABS, defaultSortFor } from "./constants"
import { EMPTY_FILTERS, isValidDate } from "./buildDomainPagesRequest"

/**
 * The page's state <-> the URL query string, so the tab, filters, sort, page, page size and the merge switch survive a reload and can be shared.
 * Defaults are never written, and anything unrecognised reads as the default: a hand-edited or stale link can never put the page in a state it
 * cannot render or send an invalid request.
 *
 * `?status=error` (the link on the Backlink Overview's "Broken pages" card) opens the Errors tab; `?status=redirect` and `?status=ok` likewise;
 * the page itself writes `tab=`.
 * Params: tab, q, ex (exclude), rd (min referring domains), bl (min backlinks), broken, since, flags (client-side), merge, sort (field:dir), page, size.
 */

/** @returns {import("./types").PageState} */
export const defaultPageState = () => ({ ...EMPTY_FILTERS, flags: [], tab: DEFAULT_TAB, merge: false, sort: null, page: 1, pageSize: DEFAULT_PAGE_SIZE })

const text = (v) => (typeof v === "string" ? v.slice(0, MAX_TEXT_LENGTH) : "")
const digits = (v) => (typeof v === "string" && /^\d{1,9}$/.test(v) ? v : "")

/** The status values a link may carry -> the tab they open. */
const STATUS_TO_TAB = Object.freeze({ error: "errors", errors: "errors", redirect: "redirects", redirects: "redirects", ok: "ok" })

/** "page_summary.backlinks:desc" -> { field, dir } for a known path and direction, else null. */
export function parseSort(raw) {
  if (typeof raw !== "string") return null
  const [field, dir, ...rest] = raw.split(":")
  return !rest.length && SORT_FIELDS.includes(field) && (dir === "asc" || dir === "desc") ? { field, dir } : null
}

/** @param {{ get: (name: string) => string|null }} params */
export function parseUrlState(params) {
  const get = (k) => params?.get?.(k) ?? null
  const s = defaultPageState()
  const tab = get("tab")
  s.tab = TABS.some((t) => t.id === tab) ? tab : STATUS_TO_TAB[get("status")] ?? DEFAULT_TAB
  s.q = text(get("q"))
  s.exclude = text(get("ex"))
  s.minReferringDomains = digits(get("rd"))
  s.minBacklinks = digits(get("bl"))
  s.hasBroken = get("broken") === "1"
  s.since = isValidDate(get("since") ?? "") ? get("since") : ""
  const flags = (get("flags") ?? "").split(",")
  s.flags = FLAG_IDS.filter((f) => flags.includes(f))
  s.merge = get("merge") === "1"
  s.sort = parseSort(get("sort"))
  const size = /^\d{1,3}$/.test(get("size") ?? "") ? Number(get("size")) : DEFAULT_PAGE_SIZE
  s.pageSize = PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE
  const last = Math.floor(MAX_OFFSET / s.pageSize) + 1
  const page = /^\d{1,4}$/.test(get("page") ?? "") ? Number(get("page")) : 1
  s.page = Math.min(Math.max(1, page), last)
  return s
}

/** The query string (no leading "?") for a state; "" for the default view. */
export function serializeUrlState(state) {
  const p = new URLSearchParams()
  const set = (k, v) => { if (v !== "" && v !== null && v !== undefined) p.set(k, String(v)) }
  if (state.tab !== DEFAULT_TAB) set("tab", state.tab)
  set("q", state.q?.trim())
  set("ex", state.exclude?.trim())
  set("rd", state.minReferringDomains)
  set("bl", state.minBacklinks)
  if (state.hasBroken) set("broken", "1")
  set("since", state.since)
  if (state.flags?.length) set("flags", FLAG_IDS.filter((f) => state.flags.includes(f)).join(","))
  if (state.merge) set("merge", "1")
  const def = defaultSortFor(state.tab)
  if (state.sort && !(state.sort.field === def.field && state.sort.dir === def.dir)) set("sort", `${state.sort.field}:${state.sort.dir}`)
  if (state.page > 1) set("page", state.page)
  if (state.pageSize !== DEFAULT_PAGE_SIZE) set("size", state.pageSize)
  return p.toString()
}
