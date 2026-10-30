import {
  DEFAULT_GROUP, DEFAULT_PAGE_SIZE, DEFAULT_TAB, GROUPS, ITEM_TYPES, LINK_TYPE_OPTIONS, MAX_SORT_RULES, MAX_TEXT_LENGTH, PAGE_SIZES, PLACEMENTS, SORT_FIELDS, TABS,
} from "./constants"
import { EMPTY_FILTERS, isValidDate } from "./buildBacklinkRequest"

/**
 * The page's state <-> the URL query string, so a tab, group, filters, sort and page survive a reload and can be shared. Defaults are
 * never written, and anything unrecognised reads as the default — a hand-edited or stale link can never put the page in a state it cannot
 * render or send an invalid request. `?broken=true` (the Backlink Overview's link) opens the Broken tab.
 *
 * Params: tab, group, q, anchor, target, follow, types, place, rank, spam, cc, since, clean, from, exact, noanchor, to, sort (field:dir,field:dir), page, size.
 */

/** @returns {import("./types").PageState} */
export const defaultPageState = () => ({
  ...EMPTY_FILTERS, itemTypes: [], placements: [], countries: [],
  tab: DEFAULT_TAB, group: DEFAULT_GROUP, sort: [], page: 1, pageSize: DEFAULT_PAGE_SIZE,
})

const text = (v) => (typeof v === "string" ? v.slice(0, MAX_TEXT_LENGTH) : "")
const digits = (v) => (typeof v === "string" && /^\d{1,6}$/.test(v) ? v : "")
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)
const listOf = (v, allowed) => (typeof v === "string" ? allowed.filter((a) => v.split(",").includes(a)) : [])

/** "domain_from_rank:desc,first_seen:asc" -> [{ field, dir }] (known fields once each, at most 3). */
export function parseSort(raw) {
  if (typeof raw !== "string") return []
  const seen = new Set()
  const rules = []
  for (const part of raw.split(",")) {
    const [field, dir] = part.split(":")
    if (!SORT_FIELDS.includes(field) || !["asc", "desc"].includes(dir) || seen.has(field)) continue
    seen.add(field)
    rules.push({ field, dir })
    if (rules.length === MAX_SORT_RULES) break
  }
  return rules
}

/** @param {{ get: (name: string) => string|null }} params */
export function parseUrlState(params) {
  const get = (k) => params?.get?.(k) ?? null
  const s = defaultPageState()
  s.tab = get("broken") === "true" && !get("tab") ? "broken" : oneOf(get("tab"), TABS.map((t) => t.id), DEFAULT_TAB)
  s.group = oneOf(get("group"), GROUPS.map((g) => g.id), DEFAULT_GROUP)
  s.q = text(get("q"))
  s.anchor = text(get("anchor"))
  s.target = text(get("target"))
  s.follow = oneOf(get("follow"), LINK_TYPE_OPTIONS.map((o) => o.value), "all")
  s.itemTypes = listOf(get("types"), ITEM_TYPES.map((o) => o.value))
  s.placements = listOf(get("place"), PLACEMENTS.map((o) => o.value))
  s.minRank = digits(get("rank"))
  s.maxSpam = digits(get("spam"))
  s.countries = [...new Set((get("cc") ?? "").split(",").filter((c) => /^[A-Z]{2}$/.test(c)))].slice(0, 50)
  s.since = isValidDate(get("since") ?? "") ? get("since") : ""
  s.hideSpammy = get("clean") === "1"
  s.domainFrom = /^[a-z0-9.-]{1,253}$/.test(get("from") ?? "") ? get("from") : ""
  // One exact anchor (the Anchors page's "View these backlinks"): `exact` is its text, `noanchor=1` the links with no anchor text.
  if (get("noanchor") === "1") s.exactEmpty = true
  else if ((get("exact") ?? "") !== "") s.exactAnchor = get("exact").slice(0, 1000)
  if ((get("to") ?? "") !== "") s.exactTarget = get("to").slice(0, 2000)
  s.sort = parseSort(get("sort"))
  const page = /^\d{1,4}$/.test(get("page") ?? "") ? Number(get("page")) : 1
  s.page = page >= 1 ? page : 1
  const size = /^\d{1,3}$/.test(get("size") ?? "") ? Number(get("size")) : DEFAULT_PAGE_SIZE
  s.pageSize = PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE
  return s
}

/** The query string (no leading "?") for a state; "" for the default view. */
export function serializeUrlState(state) {
  const p = new URLSearchParams()
  const set = (k, v) => { if (v !== "" && v !== null && v !== undefined) p.set(k, String(v)) }
  if (state.tab !== DEFAULT_TAB) set("tab", state.tab)
  if (state.group !== DEFAULT_GROUP) set("group", state.group)
  set("q", state.q?.trim())
  set("anchor", state.anchor?.trim())
  set("target", state.target?.trim())
  if (state.follow !== "all") set("follow", state.follow)
  if (state.itemTypes?.length) set("types", ITEM_TYPES.map((o) => o.value).filter((v) => state.itemTypes.includes(v)).join(","))
  if (state.placements?.length) set("place", PLACEMENTS.map((o) => o.value).filter((v) => state.placements.includes(v)).join(","))
  set("rank", state.minRank)
  set("spam", state.maxSpam)
  if (state.countries?.length) set("cc", [...state.countries].sort().join(","))
  set("since", state.since)
  if (state.hideSpammy) set("clean", "1")
  set("from", state.domainFrom)
  if (typeof state.exactTarget === "string" && state.exactTarget !== "") set("to", state.exactTarget)
  if (state.exactEmpty) set("noanchor", "1")
  else if (typeof state.exactAnchor === "string" && state.exactAnchor !== "") set("exact", state.exactAnchor)
  if (state.sort?.length) set("sort", state.sort.map((r) => `${r.field}:${r.dir}`).join(","))
  if (state.page > 1) set("page", state.page)
  if (state.pageSize !== DEFAULT_PAGE_SIZE) set("size", state.pageSize)
  return p.toString()
}
