import { joinConditions } from "../backlinks/buildBacklinkRequest"
import {
  DEFAULT_PAGE_SIZE, DEFAULT_SORT, FIELD, MAX_CONDITIONS, MAX_OFFSET, MAX_RANK, MAX_TEXT_LENGTH, NEW_WINDOW_DAYS, PAGE_SIZES, QUALITY_KEYS, SORT_COLUMNS, SORT_FIELDS,
  TOO_MANY_MESSAGE, TOXIC_SPAM_ABOVE,
} from "./constants"

/**
 * The Referring Domains page's state -> the request the backend is asked (which validates it again and forwards it to the provider as the
 * DataForSEO body). Pure: no React, no network. Everything that decides what is bought is decided HERE:
 *
 *  - the TAB: All = live; New = live + first seen in the last 30 days; Lost = the lost status; Toxic = live + spam score above 30. The New and
 *    Toxic filters count towards the 8-condition limit. (The Disavowed tab asks for its saved domains instead: see disavowedPage.js.)
 *  - "Dofollow links only" is NOT a filter: it is the request's `dofollow` (the provider's backlinks_filters).
 *  - text is trimmed, "%" removed (no injected wildcards); a number or a date that is out of range is reported in `errors` and that filter is
 *    NOT applied (nothing half-applied is ever sent);
 *  - the QUALITY filter is not here on purpose: the provider does not know our tiers, so it is applied to the loaded rows on the page;
 *  - sorting: one rule, none chosen = rank, strongest first; paging: offset = (page - 1) × page size within the provider's window.
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
export const EMPTY_FILTERS = Object.freeze({
  q: "", exclude: "", minRank: "", maxRank: "", maxSpam: "", minBacklinks: "", hasBroken: false, since: "", dofollow: false, quality: [],
})

/** Today minus `days`, as YYYY-MM-DD (UTC: the provider's dates are UTC). */
export const daysAgo = (days, now = new Date()) => new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10)

/** The tab's own server filter, or null. */
export function tabFilter(tab, now = new Date()) {
  if (tab === "new") return [FIELD.firstSeen, ">=", daysAgo(NEW_WINDOW_DAYS, now)]
  if (tab === "toxic") return [FIELD.spam, ">", TOXIC_SPAM_ABOVE]
  return null
}

/** @returns {{ conditions: Array, count: number, tooMany: boolean, message: string|null, errors: Record<string, string> }} */
export function buildReferringDomainFilters(state, { now = new Date() } = {}) {
  const conditions = []
  const errors = {}
  const tab = tabFilter(state.tab, now)
  if (tab) conditions.push(tab)

  const text = (op, raw) => { const t = cleanText(raw); if (t) conditions.push([FIELD.domain, op, `%${t}%`]) }
  text("like", state.q)
  text("not_like", state.exclude)

  const minRank = parseWhole(state.minRank)
  const maxRank = parseWhole(state.maxRank)
  const rankOk = (n) => n !== null && !Number.isNaN(n) && n >= 0 && n <= MAX_RANK
  if (minRank !== null && !rankOk(minRank)) errors.minRank = `Rank: enter a whole number from 0 to ${MAX_RANK.toLocaleString("en-US")}.`
  if (maxRank !== null && !rankOk(maxRank)) errors.maxRank = `Rank: enter a whole number from 0 to ${MAX_RANK.toLocaleString("en-US")}.`
  if (rankOk(minRank) && rankOk(maxRank) && minRank > maxRank) {
    errors.minRank = "Min rank is higher than max rank."
  } else {
    if (rankOk(minRank)) conditions.push([FIELD.rank, ">=", minRank])
    if (rankOk(maxRank)) conditions.push([FIELD.rank, "<=", maxRank])
  }

  const spam = parseWhole(state.maxSpam)
  if (spam !== null) {
    if (Number.isNaN(spam) || spam < 0 || spam > 100) errors.maxSpam = "Spam score: enter a whole number from 0 to 100."
    else conditions.push([FIELD.spam, "<=", spam])
  }
  const bl = parseWhole(state.minBacklinks)
  if (bl !== null) {
    if (Number.isNaN(bl)) errors.minBacklinks = "Backlinks: enter a whole number."
    else conditions.push([FIELD.backlinks, ">=", bl])
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

const sanePage = (page, pageSize) => Math.min(Math.max(1, Number.isInteger(page) ? page : 1), Math.floor(MAX_OFFSET / pageSize) + 1)

/**
 * @param {import("./types").PageState} state
 * @returns {{ request: import("./types").ReferringDomainsRequest, built: ReturnType<typeof buildReferringDomainFilters> }}
 */
export function buildReferringDomainRequest(state, { now = new Date() } = {}) {
  const built = buildReferringDomainFilters(state, { now })
  const pageSize = PAGE_SIZES.includes(state.pageSize) ? state.pageSize : DEFAULT_PAGE_SIZE
  const sort = effectiveSort(state)
  return {
    built,
    request: {
      status: state.tab === "lost" ? "lost" : "live",
      dofollow: Boolean(state.dofollow),
      limit: pageSize,
      offset: (sanePage(state.page, pageSize) - 1) * pageSize,
      order_by: `${sort.field},${sort.dir}`,
      // One condition is a flat [field, operator, value]; several are joined with "and" (the provider's own shape); none is [].
      filters: joinConditions(built.conditions),
    },
  }
}

/**
 * What identifies a view independently of sort and page: the status, the dofollow switch and the filters. A tab's count belongs to this, so a
 * count is forgotten the moment a filter changes it.
 */
export const viewSignature = (request) => JSON.stringify([request.status, request.dofollow, request.filters])

/** The applied filters as removable chips: { id, label, clear: <state patch> }. */
export function describeActiveFilters(state) {
  const chips = []
  const { errors } = buildReferringDomainFilters(state)
  const q = cleanText(state.q)
  if (q) chips.push({ id: "q", label: `Contains “${q}”`, clear: { q: "" } })
  const ex = cleanText(state.exclude)
  if (ex) chips.push({ id: "exclude", label: `Excludes “${ex}”`, clear: { exclude: "" } })
  const min = parseWhole(state.minRank)
  const max = parseWhole(state.maxRank)
  if (min !== null && !errors.minRank && !Number.isNaN(min)) chips.push({ id: "minRank", label: `Rank ≥ ${min}`, clear: { minRank: "" } })
  if (max !== null && !errors.maxRank && !Number.isNaN(max) && !(errors.minRank && min !== null)) chips.push({ id: "maxRank", label: `Rank ≤ ${max}`, clear: { maxRank: "" } })
  const spam = parseWhole(state.maxSpam)
  if (spam !== null && !errors.maxSpam) chips.push({ id: "maxSpam", label: `Spam ≤ ${spam}`, clear: { maxSpam: "" } })
  const bl = parseWhole(state.minBacklinks)
  if (bl !== null && !errors.minBacklinks) chips.push({ id: "minBacklinks", label: `Backlinks ≥ ${bl.toLocaleString("en-US")}`, clear: { minBacklinks: "" } })
  if (state.hasBroken) chips.push({ id: "hasBroken", label: "Has broken links", clear: { hasBroken: false } })
  if (isValidDate(String(state.since ?? "").trim())) chips.push({ id: "since", label: `First seen after ${state.since}`, clear: { since: "" } })
  if (state.dofollow) chips.push({ id: "dofollow", label: "Dofollow links only", clear: { dofollow: false } })
  const quality = QUALITY_KEYS.filter((k) => state.quality?.includes(k))
  if (quality.length) chips.push({ id: "quality", label: `Quality: ${quality.length} selected`, clear: { quality: [] } })
  return chips
}

export { MAX_OFFSET }
