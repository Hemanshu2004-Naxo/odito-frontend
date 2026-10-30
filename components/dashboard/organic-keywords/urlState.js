import { BRAND_OPTIONS, DEFAULT_PAGE_SIZE, DEFAULT_SORT, EMPTY_FILTERS, INTENTS, MAX_TEXT_LENGTH, MOVEMENT_OPTIONS, PAGE_SIZES, POSITION_OPTIONS, SORTS } from "./constants"

/**
 * The page's state <-> the URL query string, so a filtered / sorted / paged view survives a reload and can be shared.
 * Defaults are never written (a clean URL is the unfiltered view), and anything unrecognised is read as the default — a hand-edited
 * or stale link can never put the page in a state it cannot render or send an invalid request.
 *
 * Params: q, x (exclude), pos, vmin, vmax, kdmin, kdmax, intent (comma list), mv, url, brand (non | only), sort, dir, page, size.
 */

/** @returns {import("./types").PageState} */
export const defaultPageState = () => ({
  ...EMPTY_FILTERS,
  intents: [],
  sort: DEFAULT_SORT,
  dir: SORTS[DEFAULT_SORT].dir,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
})

const text = (v) => (typeof v === "string" ? v.slice(0, MAX_TEXT_LENGTH) : "")
const digits = (v) => (typeof v === "string" && /^\d{1,10}$/.test(v) ? v : "")
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)

/** @param {{ get: (name: string) => string|null }} params a URLSearchParams (or anything with get) */
export function parseUrlState(params) {
  const get = (k) => params?.get?.(k) ?? null
  const state = defaultPageState()
  state.q = text(get("q"))
  state.exclude = text(get("x"))
  state.position = oneOf(get("pos"), POSITION_OPTIONS.map((o) => o.value), "all")
  state.volMin = digits(get("vmin"))
  state.volMax = digits(get("vmax"))
  state.kdMin = digits(get("kdmin"))
  state.kdMax = digits(get("kdmax"))
  const wanted = (get("intent") ?? "").split(",")
  state.intents = INTENTS.map((i) => i.value).filter((v) => wanted.includes(v))
  state.movement = oneOf(get("mv"), MOVEMENT_OPTIONS.map((o) => o.value), "all")
  state.url = text(get("url"))
  state.brand = oneOf(get("brand"), BRAND_OPTIONS.map((o) => o.value), "all")
  state.sort = oneOf(get("sort"), Object.keys(SORTS), DEFAULT_SORT)
  state.dir = oneOf(get("dir"), ["asc", "desc"], SORTS[state.sort].dir)
  const page = /^\d{1,4}$/.test(get("page") ?? "") ? Number(get("page")) : 1
  state.page = page >= 1 ? page : 1
  const size = /^\d{1,3}$/.test(get("size") ?? "") ? Number(get("size")) : DEFAULT_PAGE_SIZE
  state.pageSize = PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE
  return state
}

/** The query string (no leading "?") for a state; "" for the default view. */
export function serializeUrlState(state) {
  const p = new URLSearchParams()
  const set = (k, v) => { if (v !== "" && v !== null && v !== undefined) p.set(k, String(v)) }
  set("q", state.q?.trim())
  set("x", state.exclude?.trim())
  if (state.position !== "all") set("pos", state.position)
  set("vmin", state.volMin)
  set("vmax", state.volMax)
  set("kdmin", state.kdMin)
  set("kdmax", state.kdMax)
  if (state.intents?.length) set("intent", INTENTS.map((i) => i.value).filter((v) => state.intents.includes(v)).join(","))
  if (state.movement !== "all") set("mv", state.movement)
  set("url", state.url?.trim())
  if (state.brand && state.brand !== "all") set("brand", state.brand)
  if (state.sort !== DEFAULT_SORT) set("sort", state.sort)
  if (state.dir !== SORTS[state.sort]?.dir) set("dir", state.dir)
  if (state.page > 1) set("page", state.page)
  if (state.pageSize !== DEFAULT_PAGE_SIZE) set("size", state.pageSize)
  return p.toString()
}
