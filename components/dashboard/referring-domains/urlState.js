import { DEFAULT_PAGE_SIZE, DEFAULT_TAB, MAX_OFFSET, MAX_TEXT_LENGTH, PAGE_SIZES, QUALITY_KEYS, SORT_FIELDS, TABS, DEFAULT_SORT } from "./constants"
import { EMPTY_FILTERS, isValidDate } from "./buildReferringDomainRequest"

/**
 * The page's state <-> the URL query string, so the tab, filters, sort, page and page size survive a reload and can be shared. Defaults are
 * never written, and anything unrecognised reads as the default: a hand-edited or stale link can never put the page in a state it cannot
 * render or send an invalid request.
 *
 * Params: tab, q, ex (exclude), rmin, rmax, spam, bl (min backlinks), broken, since, dofollow, quality (client-side), sort (field:dir), page, size.
 * On the Disavowed tab only `q` (a search of your own list), `page` and `size` apply.
 */

/** @returns {import("./types").PageState} */
export const defaultPageState = () => ({ ...EMPTY_FILTERS, quality: [], tab: DEFAULT_TAB, sort: null, page: 1, pageSize: DEFAULT_PAGE_SIZE })

const text = (v) => (typeof v === "string" ? v.slice(0, MAX_TEXT_LENGTH) : "")
const digits = (v) => (typeof v === "string" && /^\d{1,9}$/.test(v) ? v : "")

/** "rank:desc" -> { field, dir } for a known field and direction, else null. */
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
  s.tab = TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB
  s.q = text(get("q"))
  s.exclude = text(get("ex"))
  s.minRank = digits(get("rmin"))
  s.maxRank = digits(get("rmax"))
  s.maxSpam = digits(get("spam"))
  s.minBacklinks = digits(get("bl"))
  s.hasBroken = get("broken") === "1"
  s.since = isValidDate(get("since") ?? "") ? get("since") : ""
  s.dofollow = get("dofollow") === "1"
  const quality = (get("quality") ?? "").split(",")
  s.quality = QUALITY_KEYS.filter((k) => quality.includes(k))
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
  set("rmin", state.minRank)
  set("rmax", state.maxRank)
  set("spam", state.maxSpam)
  set("bl", state.minBacklinks)
  if (state.hasBroken) set("broken", "1")
  set("since", state.since)
  if (state.dofollow) set("dofollow", "1")
  if (state.quality?.length) set("quality", QUALITY_KEYS.filter((k) => state.quality.includes(k)).join(","))
  if (state.sort && !(state.sort.field === DEFAULT_SORT.field && state.sort.dir === DEFAULT_SORT.dir)) set("sort", `${state.sort.field}:${state.sort.dir}`)
  if (state.page > 1) set("page", state.page)
  if (state.pageSize !== DEFAULT_PAGE_SIZE) set("size", state.pageSize)
  return p.toString()
}
