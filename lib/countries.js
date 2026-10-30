/**
 * Country codes as DataForSEO reports them -> a name and a flag, shared by every page that shows where links come from (Backlink
 * Overview, Referring Domains, and the Backlinks pages to come).
 *
 *   "IN" -> { code: "IN", name: "India", flag: "🇮🇳" }
 *   "WW" -> Worldwide (the provider's code for "not tied to one country"), shown with a globe
 *   ""   -> Unknown   (the provider's empty-string key means "not determined")
 *
 * Names come from the browser's Intl data (English); a code Intl does not know keeps the code as its name, never a made-up one.
 * The flag is the regional-indicator emoji pair: it needs no image request, but some systems (Windows) draw the two letters instead.
 */

export const WORLDWIDE_CODE = "WW"
export const UNKNOWN_NAME = "Unknown"
export const WORLDWIDE_NAME = "Worldwide"

const regionNames = (() => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }) } catch { return null }
})()

/** "IN" -> 🇮🇳 (two regional-indicator symbols); "" when the code is not two letters. */
export function countryFlag(code) {
  const c = String(code ?? "").trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ""
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

/** @param {unknown} code @returns {{ code: string, name: string, flag: string, kind: "country"|"worldwide"|"unknown"|"other" }} */
export function countryInfo(code) {
  const raw = typeof code === "string" ? code.trim() : ""
  if (!raw) return { code: "", name: UNKNOWN_NAME, flag: "", kind: "unknown" }
  const upper = raw.toUpperCase()
  if (upper === WORLDWIDE_CODE) return { code: WORLDWIDE_CODE, name: WORLDWIDE_NAME, flag: "🌐", kind: "worldwide" }
  if (!/^[A-Z]{2}$/.test(upper)) return { code: raw, name: raw, flag: "", kind: "other" }
  let name = upper
  try {
    const n = regionNames?.of(upper)
    // Intl echoes an unknown code back (or says "Unknown Region"): that is not a name.
    if (n && n !== upper && !/unknown/i.test(n)) name = n
  } catch { /* keep the code */ }
  return { code: upper, name, flag: countryFlag(upper), kind: "country" }
}

/** "India" for "IN"; the code itself when it is not known. Convenience for plain-text labels. */
export const countryName = (code) => countryInfo(code).name

/** Every ISO 3166-1 alpha-2 country code, for pickers (a name comes from countryInfo). */
export const COUNTRY_CODES = Object.freeze((
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ "
  + "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP "
  + "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM "
  + "PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" "))

/** Countries matching what the user typed (a code or part of a name), best first, never the ones already chosen. */
export function searchCountries(query, { exclude = [], limit = 8 } = {}) {
  const q = String(query ?? "").trim().toLowerCase()
  if (!q) return []
  const scored = []
  for (const code of COUNTRY_CODES) {
    if (exclude.includes(code)) continue
    const name = countryInfo(code).name.toLowerCase()
    const rank = code.toLowerCase() === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : -1
    if (rank >= 0) scored.push([rank, name, code])
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).slice(0, limit).map(([, , code]) => countryInfo(code))
}
