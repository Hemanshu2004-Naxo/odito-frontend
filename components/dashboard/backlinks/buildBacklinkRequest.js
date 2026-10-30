import {
  DEFAULT_GROUP, DEFAULT_ORDER, DEFAULT_PAGE_SIZE, DEFAULT_TAB, FIELD, GROUPS, ITEM_TYPES, LINK_TYPE_OPTIONS, MAX_CONDITIONS, MAX_RANK, MAX_TEXT_LENGTH, OFFSET_WINDOW,
  PLACEMENTS, SORT_COLUMNS, SPAM_THRESHOLD, TABS,
} from "./constants"

/**
 * The Backlinks page's state -> the request the backend is asked (which it validates again and forwards to the provider as the
 * DataForSEO body). Pure: no React, no network. Everything that decides what is bought is decided HERE, in one place:
 *
 *  - the tab: backlinks_status_type, plus the tab's own filter (New: is_new, Broken: is_broken) — which counts towards the 8-condition limit;
 *  - the group-by: mode;
 *  - the filters: text is trimmed, "%" removed (no injected wildcards); a number or a date that is out of range is reported in `errors`
 *    and that filter is NOT applied (nothing half-applied is ever sent);
 *  - sorting: up to 3 rules; none chosen = the tab's default;
 *  - paging: `offset` while offset + limit <= 20,000; beyond that only a search_after_token continues the listing (and then there is no offset).
 *
 * More than 8 conditions is not sent at all: `built.tooMany` is true and `built.message` says what to do.
 */

const clean = (raw) => String(raw ?? "").replace(/[%\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH).trim()

/** Digits only. null = empty; NaN = not a whole number. */
function parseWhole(raw) {
  const s = String(raw ?? "").replace(/[,\s]/g, "")
  if (s === "") return null
  return /^\d{1,6}$/.test(s) ? Number(s) : Number.NaN
}

/** YYYY-MM-DD that is a real calendar day, else false. */
export const isValidDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s

const tabOf = (id) => TABS.find((t) => t.id === id) ?? TABS[0]
const groupOf = (id) => GROUPS.find((g) => g.id === id) ?? GROUPS[0]

/** The sort rules in effect: the user's, else the tab's default, else null (= the provider-side default order, the link's own rank). */
export function effectiveSort(state) {
  if (state.sort?.length) return state.sort
  return tabOf(state.tab).defaultSort ?? []
}

/** @returns {{ conditions: Array, count: number, tooMany: boolean, message: string|null, errors: Record<string, string> }} */
export function buildBacklinkFilters(state) {
  const conditions = []
  const errors = {}
  const tab = tabOf(state.tab)
  if (tab.filter) conditions.push([...tab.filter])

  const like = (field, raw) => { const t = clean(raw); if (t) conditions.push([field, "like", `%${t}%`]) }
  like(FIELD.sourceUrl, state.q)
  like(FIELD.anchor, state.anchor)
  // One exact anchor (the Anchors page's "View these backlinks"): the text itself, or "" for the links with no anchor text.
  if (state.exactEmpty) conditions.push([FIELD.anchor, "=", ""])
  else if (typeof state.exactAnchor === "string" && state.exactAnchor !== "") conditions.push([FIELD.anchor, "=", state.exactAnchor.slice(0, 1000)])
  like(FIELD.targetUrl, state.target)
  // One exact target URL (the Top Pages page's "View backlinks"): the URL itself, spelled as the provider knows it.
  if (typeof state.exactTarget === "string" && state.exactTarget !== "") conditions.push([FIELD.targetUrl, "=", state.exactTarget.slice(0, 2000)])
  if (state.follow === "dofollow") conditions.push([FIELD.dofollow, "=", true])
  if (state.follow === "nofollow") conditions.push([FIELD.dofollow, "=", false])
  const itemTypes = ITEM_TYPES.map((o) => o.value).filter((v) => state.itemTypes?.includes(v))
  if (itemTypes.length) conditions.push([FIELD.itemType, "in", itemTypes])
  const placements = PLACEMENTS.map((o) => o.value).filter((v) => state.placements?.includes(v))
  if (placements.length) conditions.push([FIELD.placement, "in", placements])

  const minRank = parseWhole(state.minRank)
  if (Number.isNaN(minRank) || (minRank !== null && (minRank < 0 || minRank > MAX_RANK))) errors.minRank = `Domain rank: enter a whole number from 0 to ${MAX_RANK.toLocaleString("en-US")}.`
  else if (minRank !== null && minRank > 0) conditions.push([FIELD.domainRank, ">=", minRank])

  const maxSpam = parseWhole(state.maxSpam)
  if (Number.isNaN(maxSpam) || (maxSpam !== null && (maxSpam < 0 || maxSpam > 100))) errors.maxSpam = "Spam score: enter a whole number from 0 to 100."
  else if (maxSpam !== null) conditions.push([FIELD.spam, "<=", maxSpam])

  const countries = (state.countries ?? []).filter((c) => /^[A-Z]{2}$/.test(c))
  if (countries.length) conditions.push([FIELD.country, "in", [...new Set(countries)].sort()])

  const since = String(state.since ?? "").trim()
  if (since) {
    if (isValidDate(since)) conditions.push([FIELD.firstSeen, ">=", since])
    else errors.since = "First seen: enter a valid date (YYYY-MM-DD)."
  }
  if (state.hideSpammy) conditions.push([FIELD.spam, "<", SPAM_THRESHOLD])
  const domain = clean(state.domainFrom).toLowerCase()
  if (domain && /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(domain)) conditions.push([FIELD.domainFrom, "=", domain])

  const tooMany = conditions.length > MAX_CONDITIONS
  return {
    conditions, count: conditions.length, tooMany, errors,
    message: tooMany ? "Max 8 filters — remove one to add another" : null,
  }
}

/** One condition as DataForSEO writes it; several joined with "and". [] for none. */
export const joinConditions = (c) => (c.length <= 1 ? (c[0] ?? []) : c.flatMap((x, i) => (i ? ["and", x] : [x])))

/**
 * @param {import("./types").PageState} state
 * @param {{ token?: string|null }} [opts]  the previous response's search_after_token, to continue past the offset window
 * @returns {{ request: import("./types").BacklinksRequest, built: ReturnType<typeof buildBacklinkFilters>, windowExceeded: boolean }}
 */
export function buildBacklinkRequest(state, { token = null } = {}) {
  const built = buildBacklinkFilters(state)
  const limit = state.pageSize ?? DEFAULT_PAGE_SIZE
  const wanted = Math.max(0, ((state.page ?? 1) - 1) * limit)
  // Past the window an offset would be refused by the provider: the listing must continue from a token instead.
  const windowExceeded = !token && wanted + limit > OFFSET_WINDOW
  const sort = effectiveSort(state)
  /** @type {import("./types").BacklinksRequest} */
  const request = {
    status: tabOf(state.tab).status,
    mode: groupOf(state.group).mode,
    limit,
    offset: token ? 0 : Math.min(wanted, Math.max(0, OFFSET_WINDOW - limit)),
    order_by: sort.length ? sort.map((r) => `${r.field},${r.dir}`) : [DEFAULT_ORDER],
    filters: joinConditions(built.conditions),
    ...(token ? { token } : {}),
  }
  return { request, built, windowExceeded }
}

/** What identifies a view independently of sort and page: the tab's status, the group mode and the filters. A tab's count belongs to this. */
export function viewSignature(request) {
  return `${request.status}|${request.mode}|${JSON.stringify(request.filters)}`
}

/** The applied filters as removable chips (the tab and the group-by have their own controls). `clear` is the state patch that removes it. */
export function describeActiveFilters(state) {
  const chips = []
  const text = (id, label, value, clear) => { const t = clean(value); if (t) chips.push({ id, label: `${label}: ${t}`, clear }) }
  text("q", "Source", state.q, { q: "" })
  text("anchor", "Anchor", state.anchor, { anchor: "" })
  text("target", "Target URL", state.target, { target: "" })
  if (state.follow !== "all") chips.push({ id: "follow", label: LINK_TYPE_OPTIONS.find((o) => o.value === state.follow)?.label ?? state.follow, clear: { follow: "all" } })
  if (state.itemTypes?.length) chips.push({ id: "itemTypes", label: `Type: ${ITEM_TYPES.filter((o) => state.itemTypes.includes(o.value)).map((o) => o.label).join(", ")}`, clear: { itemTypes: [] } })
  if (state.placements?.length) chips.push({ id: "placements", label: `Placement: ${PLACEMENTS.filter((o) => state.placements.includes(o.value)).map((o) => o.label).join(", ")}`, clear: { placements: [] } })
  const rank = parseWhole(state.minRank)
  if (rank !== null && !Number.isNaN(rank) && rank > 0) chips.push({ id: "minRank", label: `Domain rank ≥ ${rank}`, clear: { minRank: "" } })
  const spam = parseWhole(state.maxSpam)
  if (spam !== null && !Number.isNaN(spam)) chips.push({ id: "maxSpam", label: `Spam ≤ ${spam}`, clear: { maxSpam: "" } })
  if (state.countries?.length) chips.push({ id: "countries", label: `Country: ${state.countries.join(", ")}`, clear: { countries: [] } })
  if (isValidDate(String(state.since ?? "").trim())) chips.push({ id: "since", label: `First seen after ${state.since}`, clear: { since: "" } })
  if (state.hideSpammy) chips.push({ id: "hideSpammy", label: "Spammy links hidden", clear: { hideSpammy: false } })
  if (typeof state.exactTarget === "string" && state.exactTarget !== "") chips.push({ id: "exactTarget", label: `Target is ${state.exactTarget.replace(/^https?:\/\//, "").slice(0, 60)}`, clear: { exactTarget: null } })
  if (state.exactEmpty) chips.push({ id: "exactAnchor", label: "Anchor: (no anchor text)", clear: { exactAnchor: null, exactEmpty: false } })
  else if (typeof state.exactAnchor === "string" && state.exactAnchor !== "") chips.push({ id: "exactAnchor", label: `Anchor is “${state.exactAnchor.length > 40 ? `${state.exactAnchor.slice(0, 39)}…` : state.exactAnchor}”`, clear: { exactAnchor: null, exactEmpty: false } })
  if (clean(state.domainFrom)) chips.push({ id: "domainFrom", label: `From ${clean(state.domainFrom)}`, clear: { domainFrom: "" } })
  return chips
}

export const EMPTY_FILTERS = Object.freeze({
  q: "", anchor: "", target: "", follow: "all", itemTypes: [], placements: [], minRank: "", maxSpam: "", countries: [], since: "", hideSpammy: false, domainFrom: "", exactAnchor: null, exactEmpty: false, exactTarget: null,
})

/** The sort rules after a header click. Plain click: that column alone (a second click flips it). Shift-click: add it (max 3), or flip it if already there. */
export function nextSort(current, columnKey, { shift = false, max = 3 } = {}) {
  const col = SORT_COLUMNS[columnKey]
  const here = current.findIndex((r) => r.field === col.field)
  const flip = (dir) => (dir === "asc" ? "desc" : "asc")
  if (!shift) {
    if (current.length === 1 && here === 0) return [{ field: col.field, dir: flip(current[0].dir) }]
    return [{ field: col.field, dir: col.dir }]
  }
  if (here >= 0) return current.map((r, i) => (i === here ? { ...r, dir: flip(r.dir) } : r))
  return current.length >= max ? current : [...current, { field: col.field, dir: col.dir }]
}

export { DEFAULT_GROUP, DEFAULT_TAB }
