import { TYPE_KEYS } from "@/lib/anchors/anchorConfig"
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT, DEFAULT_STATUS, MAX_OFFSET, MAX_TEXT_LENGTH, PAGE_SIZES, SORT_FIELDS, STATUSES } from "./constants"
import { EMPTY_FILTERS, isValidDate } from "./buildAnchorRequest"

/**
 * The page's state <-> the URL query string, so the status, filters, sort, page and page size survive a reload and can be shared.
 * Defaults are never written, and anything unrecognised reads as the default: a hand-edited or stale link can never put the page in a
 * state it cannot render or send an invalid request.
 *
 * Params: status, q, ex (exclude), rd (min referring domains), bl (min backlinks), spam, broken, since, anchor (exact), noanchor,
 * types (client-side), sort (field:dir), page, size.
 */

/** @returns {import("./types").PageState} */
export const defaultPageState = () => ({ ...EMPTY_FILTERS, types: [], status: DEFAULT_STATUS, sort: null, page: 1, pageSize: DEFAULT_PAGE_SIZE })

const text = (v) => (typeof v === "string" ? v.slice(0, MAX_TEXT_LENGTH) : "")
const digits = (v) => (typeof v === "string" && /^\d{1,9}$/.test(v) ? v : "")

/** "referring_domains:desc" -> { field, dir } for a known field and direction, else null. */
export function parseSort(raw) {
  if (typeof raw !== "string") return null
  const [field, dir, ...rest] = raw.split(":")
  return !rest.length && SORT_FIELDS.includes(field) && (dir === "asc" || dir === "desc") ? { field, dir } : null
}

/** @param {{ get: (name: string) => string|null }} params */
export function parseUrlState(params) {
  const get = (k) => params?.get?.(k) ?? null
  const s = defaultPageState()
  const status = get("status")
  s.status = STATUSES.some((x) => x.id === status) ? status : DEFAULT_STATUS
  s.q = text(get("q"))
  s.exclude = text(get("ex"))
  s.minReferringDomains = digits(get("rd"))
  s.minBacklinks = digits(get("bl"))
  s.maxSpam = digits(get("spam"))
  s.hasBroken = get("broken") === "1"
  s.since = isValidDate(get("since") ?? "") ? get("since") : ""
  if (get("noanchor") === "1") s.exactEmpty = true
  else if ((get("anchor") ?? "") !== "") s.exact = get("anchor").slice(0, 1000)
  const types = (get("types") ?? "").split(",")
  s.types = TYPE_KEYS.filter((t) => types.includes(t))
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
  if (state.status !== DEFAULT_STATUS) set("status", state.status)
  set("q", state.q?.trim())
  set("ex", state.exclude?.trim())
  set("rd", state.minReferringDomains)
  set("bl", state.minBacklinks)
  set("spam", state.maxSpam)
  if (state.hasBroken) set("broken", "1")
  set("since", state.since)
  if (state.exactEmpty) set("noanchor", "1")
  else if (typeof state.exact === "string" && state.exact !== "") set("anchor", state.exact)
  if (state.types?.length) set("types", TYPE_KEYS.filter((t) => state.types.includes(t)).join(","))
  if (state.sort && !(state.sort.field === DEFAULT_SORT.field && state.sort.dir === DEFAULT_SORT.dir)) set("sort", `${state.sort.field}:${state.sort.dir}`)
  if (state.page > 1) set("page", state.page)
  if (state.pageSize !== DEFAULT_PAGE_SIZE) set("size", state.pageSize)
  return p.toString()
}
