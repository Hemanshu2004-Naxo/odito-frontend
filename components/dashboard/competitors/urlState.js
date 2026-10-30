import { DEFAULT_PAGE_SIZE, DEFAULT_SORT, MAX_OFFSET, MIN_SHARED_MAX_DIGITS, PAGE_SIZES, SORTS } from "./constants"

/**
 * The page's state <-> the URL query string, so a view survives a reload and can be shared. Defaults are never written, and anything
 * unrecognised reads as the default — a hand-edited or stale link can never put the page in a state it cannot render.
 *
 * Params: sort, dir, page, size, big=1 (show the largest sites), top10=1, min (minimum shared keywords).
 */

/** @returns {import("./types").PageState} */
export const defaultPageState = () => ({
  sort: DEFAULT_SORT,
  dir: SORTS[DEFAULT_SORT].dir,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  hideLarge: true,
  top10: false,
  minShared: "",
})

const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)

/** @param {{ get: (name: string) => string|null }} params */
export function parseUrlState(params) {
  const get = (k) => params?.get?.(k) ?? null
  const state = defaultPageState()
  state.sort = oneOf(get("sort"), Object.keys(SORTS), DEFAULT_SORT)
  state.dir = oneOf(get("dir"), ["asc", "desc"], SORTS[state.sort].dir)
  const page = /^\d{1,4}$/.test(get("page") ?? "") ? Number(get("page")) : 1
  state.page = page >= 1 ? page : 1
  const size = /^\d{1,3}$/.test(get("size") ?? "") ? Number(get("size")) : DEFAULT_PAGE_SIZE
  state.pageSize = PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE
  state.hideLarge = get("big") !== "1"
  state.top10 = get("top10") === "1"
  const min = get("min") ?? ""
  state.minShared = /^\d+$/.test(min) && min.length <= MIN_SHARED_MAX_DIGITS && Number(min) > 0 ? String(Number(min)) : ""
  return state
}

/** The query string (no leading "?") for a state; "" for the default view. */
export function serializeUrlState(state) {
  const p = new URLSearchParams()
  if (state.sort !== DEFAULT_SORT) p.set("sort", state.sort)
  if (state.dir !== SORTS[state.sort]?.dir) p.set("dir", state.dir)
  if (state.page > 1) p.set("page", String(state.page))
  if (state.pageSize !== DEFAULT_PAGE_SIZE) p.set("size", String(state.pageSize))
  if (!state.hideLarge) p.set("big", "1")
  if (state.top10) p.set("top10", "1")
  if (state.minShared) p.set("min", state.minShared)
  return p.toString()
}

/**
 * The state -> the request the server is asked. `filters` is a flat DataForSEO condition (or [] for none): the only filter the page
 * offers is "minimum shared keywords" -> ["intersections", ">=", N], applied when committed (Enter / blur), never per keystroke.
 * @param {import("./types").PageState} state
 * @returns {import("./types").CompetitorsRequest}
 */
export function buildCompetitorsRequest(state) {
  const min = state.minShared ? Number(state.minShared) : 0
  const sort = SORTS[state.sort] ?? SORTS[DEFAULT_SORT]
  return {
    limit: state.pageSize,
    offset: Math.min(Math.max(0, (state.page - 1) * state.pageSize), MAX_OFFSET),
    order_by: `${sort.field},${state.dir}`,
    filters: min > 0 ? ["intersections", ">=", min] : [],
    exclude_top_domains: state.hideLarge,
    max_rank_group: state.top10 ? 10 : 100,
  }
}

/** True when any setting differs from the default view's (sort and paging excluded): what "Reset settings" undoes. */
export const settingsChanged = (state) => !state.hideLarge || state.top10 || Boolean(state.minShared)

/** What "Reset settings" puts back. */
export const SETTINGS_RESET = Object.freeze({ hideLarge: true, top10: false, minShared: "" })
