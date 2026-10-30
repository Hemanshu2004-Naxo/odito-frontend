import { buildBrandConditions, conditionWeight, joinFilterConditions, normalizeBrandMode } from "@/lib/brandFilter"
import {
  DEFAULT_DIR, DEFAULT_PAGE_SIZE, DEFAULT_SORT, FIELD, INTENTS, MAX_CONDITIONS, MAX_TEXT_LENGTH, MOVEMENT_OPTIONS, POSITION_OPTIONS, SORTS,
} from "./constants"

/**
 * The Organic Keywords page's filter state -> the DataForSEO `filters` the backend forwards. Pure: no React, no network.
 * The result is what the server validates again (whitelist, at most 8 conditions) — this module exists so the UI can say what is wrong
 * BEFORE a billed request is made, and so the request is built in exactly one place.
 *
 * Rules (each one is a decision, tested):
 *  - Text is trimmed, whitespace collapsed, "%" removed (the user cannot inject wildcards), capped at 100 characters. The keyword search
 *    and exclusion are lowercased: the provider's `like` is case-sensitive and stores keywords in lowercase.
 *  - A range needs whole numbers inside the field's bounds; an out-of-range value or min > max is reported in `errors` and that range is
 *    not applied (nothing half-applied is ever sent).
 *  - "All 4 intents" and "no intent" are both "no filter".
 *  - More than MAX_CONDITIONS conditions is not sent at all: `tooMany` is true and `message` says how many to remove.
 */

const clean = (raw) => String(raw ?? "").replace(/[%\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH).trim()

/** Digits only (thousands separators and spaces tolerated). null = empty; NaN = not a whole number. */
function parseWhole(raw) {
  const s = String(raw ?? "").replace(/[,\s]/g, "")
  if (s === "") return null
  return /^\d{1,10}$/.test(s) ? Number(s) : Number.NaN
}

const RANGES = Object.freeze({
  volume: { min: "volMin", max: "volMax", field: FIELD.volume, lo: 0, hi: 1e9, label: "Volume" },
  difficulty: { min: "kdMin", max: "kdMax", field: FIELD.difficulty, lo: 0, hi: 100, label: "KD" },
})

/** Reads one range. `{ min, max, error }`: min / max are numbers or null; on any problem both are null and `error` says why. */
function readRange(state, spec) {
  const min = parseWhole(state[spec.min])
  const max = parseWhole(state[spec.max])
  const bad = (v) => Number.isNaN(v) || (v !== null && (v < spec.lo || v > spec.hi))
  if (bad(min) || bad(max)) return { min: null, max: null, error: `${spec.label}: enter whole numbers from ${spec.lo.toLocaleString("en-US")} to ${spec.hi.toLocaleString("en-US")}.` }
  if (min !== null && max !== null && min > max) return { min: null, max: null, error: `${spec.label}: the minimum is greater than the maximum.` }
  return { min, max, error: null }
}

const positionOption = (value) => POSITION_OPTIONS.find((o) => o.value === value) ?? POSITION_OPTIONS[0]
const movementOption = (value) => MOVEMENT_OPTIONS.find((o) => o.value === value) ?? MOVEMENT_OPTIONS[0]

/** The intents that actually narrow the list: none selected and all four selected both mean "any". */
function activeIntents(state) {
  const picked = INTENTS.map((i) => i.value).filter((v) => Array.isArray(state.intents) && state.intents.includes(v))
  return picked.length === 0 || picked.length === INTENTS.length ? [] : picked
}

/** DataForSEO's `filters` value for a list of conditions: null for none, the flat triple for one, "and"-joined for several (an "or" group is wrapped). */
export const joinConditions = joinFilterConditions

/**
 * @param {import("./types").FilterState} state
 * @returns {{ conditions: Array, filters: Array|null, count: number, tooMany: boolean, message: string|null, errors: Record<string, string> }}
 */
export function buildKeywordFilters(state = {}) {
  const conditions = []
  const errors = {}

  const q = clean(state.q).toLowerCase()
  if (q) conditions.push([FIELD.keyword, "like", `%${q}%`])
  const exclude = clean(state.exclude).toLowerCase()
  if (exclude) conditions.push([FIELD.keyword, "not_like", `%${exclude}%`])

  const pos = positionOption(state.position)
  if (pos.min !== null) conditions.push([FIELD.position, ">=", pos.min])
  if (pos.max !== null) conditions.push([FIELD.position, "<=", pos.max])

  for (const [name, spec] of Object.entries(RANGES)) {
    const { min, max, error } = readRange(state, spec)
    if (error) errors[name] = error
    if (min !== null) conditions.push([spec.field, ">=", min])
    if (max !== null) conditions.push([spec.field, "<=", max])
  }

  const intents = activeIntents(state)
  if (intents.length) conditions.push([FIELD.intent, "in", intents])

  const movement = movementOption(state.movement)
  if (movement.field) conditions.push([movement.field, "=", true])

  const url = clean(state.url)
  if (url) conditions.push([FIELD.url, "like", `%${url}%`])

  // Brand / Non-brand by the project's saved brand terms (state.brandTerms, put there by the page). Each term is one of the 8 conditions.
  conditions.push(...buildBrandConditions(state.brandTerms, state.brand))

  const count = conditions.reduce((n, c) => n + conditionWeight(c), 0)
  const tooMany = count > MAX_CONDITIONS
  return {
    conditions,
    filters: tooMany ? null : joinConditions(conditions),
    count,
    tooMany,
    message: tooMany
      ? `These filters add up to ${count} conditions and at most ${MAX_CONDITIONS} can be applied at once. Remove ${count - MAX_CONDITIONS} or more (a position range, or a minimum and a maximum, each count as two).`
      : null,
    errors,
  }
}

const num = new Intl.NumberFormat("en-US")
const range = (min, max, unit) => (min !== null && max !== null ? `${unit} ${num.format(min)}–${num.format(max)}` : min !== null ? `${unit} ≥ ${num.format(min)}` : `${unit} ≤ ${num.format(max)}`)

/**
 * The applied filters as removable chips: `[{ id, label, clear }]`. `clear` is the state patch that removes just that filter.
 * Only filters that really narrow the result get a chip (an invalid range or an all-intents pick does not).
 */
export function describeActiveFilters(state = {}) {
  const chips = []
  const q = clean(state.q).toLowerCase()
  if (q) chips.push({ id: "q", label: `Keyword contains “${q}”`, clear: { q: "" } })
  const exclude = clean(state.exclude).toLowerCase()
  if (exclude) chips.push({ id: "exclude", label: `Excludes “${exclude}”`, clear: { exclude: "" } })
  const pos = positionOption(state.position)
  if (pos.value !== "all") chips.push({ id: "position", label: `Position: ${pos.label}`, clear: { position: "all" } })
  for (const [name, spec] of Object.entries(RANGES)) {
    const { min, max } = readRange(state, spec)
    if (min !== null || max !== null) chips.push({ id: name, label: range(min, max, spec.label), clear: { [spec.min]: "", [spec.max]: "" } })
  }
  const intents = activeIntents(state)
  if (intents.length) chips.push({ id: "intents", label: `Intent: ${intents.map((v) => INTENTS.find((i) => i.value === v).label).join(", ")}`, clear: { intents: [] } })
  const movement = movementOption(state.movement)
  if (movement.field) chips.push({ id: "movement", label: `Movement: ${movement.label}`, clear: { movement: "all" } })
  const url = clean(state.url)
  if (url) chips.push({ id: "url", label: `URL contains “${url}”`, clear: { url: "" } })
  if (buildBrandConditions(state.brandTerms, state.brand).length) chips.push({ id: "brand", label: normalizeBrandMode(state.brand) === "non" ? "Non-brand keywords" : "Brand keywords", clear: { brand: "all" } })
  return chips
}

/** { limit, offset, order_by, filters } for the service, from the whole page state (`page` is 1-based). */
export function buildKeywordQuery(state = {}, { limit, offset } = {}) {
  const pageSize = limit ?? state.pageSize ?? DEFAULT_PAGE_SIZE
  const sort = SORTS[state.sort] ?? SORTS[DEFAULT_SORT]
  const dir = state.dir === "asc" || state.dir === "desc" ? state.dir : DEFAULT_DIR
  const built = buildKeywordFilters(state)
  return {
    limit: pageSize,
    offset: offset ?? Math.max(0, ((state.page ?? 1) - 1) * pageSize),
    order_by: `${sort.field},${dir}`,
    filters: built.filters ?? [],
    // Not sent: lets the page tell "these filters are too many" apart from "no filters" without building twice.
    built,
  }
}
