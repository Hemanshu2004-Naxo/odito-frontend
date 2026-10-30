import { joinConditions } from "../backlinks/buildBacklinkRequest"
import {
  BASE_MIN_BACKLINKS, DEFAULT_PAGE_SIZE, FIELD, FLAG_IDS, MAX_CONDITIONS, MAX_OFFSET, MAX_TEXT_LENGTH, PAGE_SIZES, SORT_COLUMNS, SORT_FIELDS, TOO_MANY_MESSAGE, defaultSortFor,
} from "./constants"

/**
 * The Top Pages page's state -> the request the backend is asked (which validates it again and forwards it to the provider as the DataForSEO
 * body). Pure: no React, no network. Everything that decides what is bought is decided HERE:
 *
 *  - the TAB's own status filters: Errors = status >= 400; Redirects = status >= 300 and < 400; OK = status >= 200 and < 300; All = none. They count
 *    towards the 8-condition limit;
 *  - the BASE condition backlinks >= 1, ALWAYS (API 10 lists the pages it has crawled, links or not: live, 518 of 6,762 have a backlink). The user's
 *    "Min backlinks" REPLACES it (it takes the same slot, so it never costs a second condition);
 *  - text is trimmed, "%" removed (no injected wildcards); a number or a date that is out of range is reported in `errors` and that filter is
 *    NOT applied (nothing half-applied is ever sent);
 *  - the opportunity-FLAG filter is not here on purpose: the provider does not know our flags, so it is applied to the rows on the page;
 *  - "Merge URL variants" is not here either: it groups the rows already on the page;
 *  - sorting: one rule, none chosen = the tab's default (referring domains; on Errors, backlinks); paging: offset = (page - 1) × page size within the window.
 *
 * More than 8 conditions is not sent at all: `built.tooMany` is true and `built.message` says what to do.
 */

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
export const EMPTY_FILTERS = Object.freeze({ q: "", exclude: "", minReferringDomains: "", minBacklinks: "", hasBroken: false, since: "", flags: [] })

/** The tab's own status conditions. */
export function tabConditions(tab) {
  if (tab === "errors") return [[FIELD.status, ">=", 400]]
  if (tab === "redirects") return [[FIELD.status, ">=", 300], [FIELD.status, "<", 400]]
  if (tab === "ok") return [[FIELD.status, ">=", 200], [FIELD.status, "<", 300]]
  return []
}

/** @returns {{ conditions: Array, count: number, tooMany: boolean, message: string|null, errors: Record<string, string> }} */
export function buildDomainPagesFilters(state) {
  const conditions = [...tabConditions(state.tab)]
  const errors = {}
  const text = (op, raw) => { const t = cleanText(raw); if (t) conditions.push([FIELD.page, op, `%${t}%`]) }
  text("like", state.q)
  text("not_like", state.exclude)

  const rd = parseWhole(state.minReferringDomains)
  if (rd !== null) {
    if (Number.isNaN(rd)) errors.minReferringDomains = "Referring domains: enter a whole number."
    else conditions.push([FIELD.referringDomains, ">=", rd])
  }
  // ONE slot for backlinks: the base (>= 1), or the user's minimum when it is higher.
  const bl = parseWhole(state.minBacklinks)
  if (bl !== null && Number.isNaN(bl)) errors.minBacklinks = "Backlinks: enter a whole number."
  conditions.push([FIELD.backlinks, ">=", bl !== null && !Number.isNaN(bl) ? Math.max(BASE_MIN_BACKLINKS, bl) : BASE_MIN_BACKLINKS])

  if (state.hasBroken) conditions.push([FIELD.broken, ">", 0])
  const since = String(state.since ?? "").trim()
  if (since) {
    if (isValidDate(since)) conditions.push([FIELD.firstSeen, ">=", since])
    else errors.since = "First seen: enter a valid date (YYYY-MM-DD)."
  }
  const tooMany = conditions.length > MAX_CONDITIONS
  return { conditions, count: conditions.length, tooMany, message: tooMany ? TOO_MANY_MESSAGE : null, errors }
}

/** The sort rule in effect: the user's, else the tab's default. */
export const effectiveSort = (state) => (state.sort && SORT_FIELDS.includes(state.sort.field) ? state.sort : defaultSortFor(state.tab))

/** A header click: the same column flips its direction; another column starts at "highest first". */
export function nextSort(state, columnKey) {
  const field = SORT_COLUMNS[columnKey]
  if (!field) return state.sort ?? null
  const now = effectiveSort(state)
  if (now.field === field) return { field, dir: now.dir === "desc" ? "asc" : "desc" }
  return { field, dir: "desc" }
}

const sanePage = (page, pageSize) => Math.min(Math.max(1, Number.isInteger(page) ? page : 1), Math.floor(MAX_OFFSET / pageSize) + 1)

/**
 * @param {import("./types").PageState} state
 * @returns {{ request: import("./types").DomainPagesRequest, built: ReturnType<typeof buildDomainPagesFilters> }}
 */
export function buildDomainPagesRequest(state) {
  const built = buildDomainPagesFilters(state)
  const pageSize = PAGE_SIZES.includes(state.pageSize) ? state.pageSize : DEFAULT_PAGE_SIZE
  const sort = effectiveSort(state)
  return {
    built,
    request: {
      limit: pageSize,
      offset: (sanePage(state.page, pageSize) - 1) * pageSize,
      order_by: `${sort.field},${sort.dir}`,
      // One condition is a flat [field, operator, value]; several are joined with "and" (the provider's own shape).
      filters: joinConditions(built.conditions),
    },
  }
}

/** What identifies a view independently of sort and page: the filters (the tab's included). A tab's count belongs to this. */
export const viewSignature = (request) => JSON.stringify(request.filters)

/** The applied filters as removable chips: { id, label, clear: <state patch> }. The tab and the merge switch have their own controls. */
export function describeActiveFilters(state) {
  const chips = []
  const { errors } = buildDomainPagesFilters(state)
  const q = cleanText(state.q)
  if (q) chips.push({ id: "q", label: `URL contains “${q}”`, clear: { q: "" } })
  const ex = cleanText(state.exclude)
  if (ex) chips.push({ id: "exclude", label: `URL excludes “${ex}”`, clear: { exclude: "" } })
  const rd = parseWhole(state.minReferringDomains)
  if (rd !== null && !errors.minReferringDomains) chips.push({ id: "minReferringDomains", label: `Referring domains ≥ ${rd.toLocaleString("en-US")}`, clear: { minReferringDomains: "" } })
  const bl = parseWhole(state.minBacklinks)
  if (bl !== null && !errors.minBacklinks) chips.push({ id: "minBacklinks", label: `Backlinks ≥ ${bl.toLocaleString("en-US")}`, clear: { minBacklinks: "" } })
  if (state.hasBroken) chips.push({ id: "hasBroken", label: "Has broken backlinks", clear: { hasBroken: false } })
  if (isValidDate(String(state.since ?? "").trim())) chips.push({ id: "since", label: `First seen after ${state.since}`, clear: { since: "" } })
  const flags = FLAG_IDS.filter((f) => state.flags?.includes(f))
  if (flags.length) chips.push({ id: "flags", label: `Flags: ${flags.length} selected`, clear: { flags: [] } })
  return chips
}
