import { TYPE_KEYS } from "@/lib/anchors/anchorConfig"
import { joinConditions } from "../backlinks/buildBacklinkRequest"
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT, DEFAULT_STATUS, FIELD, MAX_CONDITIONS, MAX_OFFSET, MAX_TEXT_LENGTH, PAGE_SIZES, SORT_COLUMNS, SORT_FIELDS, TOO_MANY_MESSAGE } from "./constants"

/**
 * The Anchors page's state -> the request the backend is asked (which validates it again and forwards it to the provider as the DataForSEO
 * body). Pure: no React, no network. Everything that decides what is bought is decided HERE:
 *
 *  - the status (Live / Lost / All) is the request's `backlinks_status_type`, not a filter;
 *  - the filters (at most 8 conditions, joined with "and"): text is trimmed and "%" removed (no injected wildcards); a number or a date that
 *    is out of range is reported in `errors` and that filter is NOT applied (nothing half-applied is ever sent);
 *  - the ANCHOR TYPE filter is not here on purpose: the provider does not know our types, so it is applied to the loaded rows on the page;
 *  - sorting: one rule; none chosen = referring domains, highest first;
 *  - paging: offset = (page - 1) × page size, never past the provider's 20,000 window.
 *
 * More than 8 conditions is not sent at all: `built.tooMany` is true and `built.message` says what to do.
 */

/** Text for a "contains" filter: control characters and "%" become spaces, runs of spaces collapse, trimmed and capped. */
export const cleanText = (raw) => String(raw ?? "").replace(/[%\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH).trim()

/** Digits only. null = empty; NaN = not a whole number. */
function parseWhole(raw) {
  const s = String(raw ?? "").replace(/[,\s]/g, "")
  if (s === "") return null
  return /^\d{1,9}$/.test(s) ? Number(s) : Number.NaN
}

/** YYYY-MM-DD that is a real calendar day. */
export const isValidDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s

/** The filter fields of a state, all empty. */
export const EMPTY_FILTERS = Object.freeze({
  q: "", exclude: "", minReferringDomains: "", minBacklinks: "", maxSpam: "", hasBroken: false, since: "", exact: null, exactEmpty: false, types: [],
})

/** @returns {{ conditions: Array, count: number, tooMany: boolean, message: string|null, errors: Record<string, string> }} */
export function buildAnchorFilters(state) {
  const conditions = []
  const errors = {}
  const text = (op, raw) => { const t = cleanText(raw); if (t) conditions.push([FIELD.anchor, op, `%${t}%`]) }
  text("like", state.q)
  text("not_like", state.exclude)

  // One exact anchor (a click on a bar of the chart): the text itself, or "" for links without any.
  if (state.exactEmpty) conditions.push([FIELD.anchor, "=", ""])
  else if (typeof state.exact === "string" && state.exact !== "") conditions.push([FIELD.anchor, "=", state.exact.slice(0, 1000)])

  const whole = (key, raw, field, label, max) => {
    const n = parseWhole(raw)
    if (n === null) return
    if (Number.isNaN(n) || n < 0 || n > max) errors[key] = `${label}: enter a whole number from 0 to ${max.toLocaleString("en-US")}.`
    else conditions.push([field, ">=", n])
  }
  whole("minReferringDomains", state.minReferringDomains, FIELD.referringDomains, "Referring domains", 100000000)
  whole("minBacklinks", state.minBacklinks, FIELD.backlinks, "Backlinks", 1000000000)
  const spam = parseWhole(state.maxSpam)
  if (spam !== null) {
    if (Number.isNaN(spam) || spam < 0 || spam > 100) errors.maxSpam = "Spam score: enter a whole number from 0 to 100."
    else conditions.push([FIELD.spam, "<=", spam])
  }
  if (state.hasBroken) conditions.push([FIELD.broken, ">", 0])
  const since = String(state.since ?? "").trim()
  if (since) {
    if (isValidDate(since)) conditions.push([FIELD.firstSeen, ">=", since])
    else errors.since = "First seen: enter a valid date (YYYY-MM-DD)."
  }

  const tooMany = conditions.length > MAX_CONDITIONS
  return { conditions, count: conditions.length, tooMany, message: tooMany ? TOO_MANY_MESSAGE : null, errors }
}

/** The sort rule in effect: the user's, else the default. */
export const effectiveSort = (state) => (state.sort && SORT_FIELDS.includes(state.sort.field) ? state.sort : DEFAULT_SORT)

/** A header click: the same column flips its direction; another column starts at "highest first". */
export function nextSort(current, columnKey) {
  const field = SORT_COLUMNS[columnKey]
  if (!field) return current ?? null
  const now = effectiveSort({ sort: current })
  if (now.field === field) return { field, dir: now.dir === "desc" ? "asc" : "desc" }
  return { field, dir: "desc" }
}

/** The page the request is for, within the provider's window. */
const sanePage = (page, pageSize) => Math.min(Math.max(1, Number.isInteger(page) ? page : 1), Math.floor(MAX_OFFSET / pageSize) + 1)

/**
 * @param {import("./types").PageState} state
 * @returns {{ request: import("./types").AnchorsRequest, built: ReturnType<typeof buildAnchorFilters> }}
 */
export function buildAnchorRequest(state) {
  const built = buildAnchorFilters(state)
  const pageSize = PAGE_SIZES.includes(state.pageSize) ? state.pageSize : DEFAULT_PAGE_SIZE
  const sort = effectiveSort(state)
  return {
    built,
    request: {
      status: state.status ?? DEFAULT_STATUS,
      limit: pageSize,
      offset: (sanePage(state.page, pageSize) - 1) * pageSize,
      order_by: `${sort.field},${sort.dir}`,
      // One condition is a flat [field, operator, value]; several are joined with "and" (the provider's own shape); none is [].
      filters: joinConditions(built.conditions),
    },
  }
}

/** The request of the default view (Live, 50, offset 0, referring domains desc, no filters): the page's first load. */
export const isDefaultRequest = (r) => r.status === DEFAULT_STATUS && r.limit === DEFAULT_PAGE_SIZE && !r.offset && r.order_by === `${DEFAULT_SORT.field},${DEFAULT_SORT.dir}` && !(r.filters?.length)

/** The applied filters as removable chips: { id, label, clear: <state patch> }. */
export function describeActiveFilters(state) {
  const chips = []
  // A value that was not applied (out of range, not a date) is not an applied filter: no chip for it.
  const { errors } = buildAnchorFilters(state)
  const q = cleanText(state.q)
  if (q) chips.push({ id: "q", label: `Contains “${q}”`, clear: { q: "" } })
  const ex = cleanText(state.exclude)
  if (ex) chips.push({ id: "exclude", label: `Excludes “${ex}”`, clear: { exclude: "" } })
  if (state.exactEmpty) chips.push({ id: "exact", label: "Anchor: (empty / image link)", clear: { exact: null, exactEmpty: false } })
  else if (typeof state.exact === "string" && state.exact !== "") chips.push({ id: "exact", label: `Anchor: “${state.exact.length > 40 ? `${state.exact.slice(0, 39)}…` : state.exact}”`, clear: { exact: null, exactEmpty: false } })
  const rd = parseWhole(state.minReferringDomains)
  if (rd !== null && !errors.minReferringDomains) chips.push({ id: "minReferringDomains", label: `Referring domains ≥ ${rd.toLocaleString("en-US")}`, clear: { minReferringDomains: "" } })
  const bl = parseWhole(state.minBacklinks)
  if (bl !== null && !errors.minBacklinks) chips.push({ id: "minBacklinks", label: `Backlinks ≥ ${bl.toLocaleString("en-US")}`, clear: { minBacklinks: "" } })
  const spam = parseWhole(state.maxSpam)
  if (spam !== null && !errors.maxSpam) chips.push({ id: "maxSpam", label: `Spam ≤ ${spam}`, clear: { maxSpam: "" } })
  if (state.hasBroken) chips.push({ id: "hasBroken", label: "Has broken links", clear: { hasBroken: false } })
  if (isValidDate(String(state.since ?? "").trim())) chips.push({ id: "since", label: `First seen after ${state.since}`, clear: { since: "" } })
  const types = TYPE_KEYS.filter((t) => state.types?.includes(t))
  if (types.length) chips.push({ id: "types", label: `Type: ${types.length} selected`, clear: { types: [] } })
  return chips
}
