import { BACKLINKS_PATH, KEYWORDS_PATH } from "./constants"

/**
 * Where "View backlinks" and "View keywords" go. PURE.
 *  - the Backlinks page filtered to this EXACT target URL (its `to` parameter: url_to = <url>, spelled as the provider knows it);
 *  - the Organic Keywords page filtered to keywords whose URL contains this PATH (its `url` parameter; the query string is not part of it).
 */
export function backlinksHref(url) {
  return `${BACKLINKS_PATH}?${new URLSearchParams({ to: url }).toString()}`
}

/** @param {string} path "/specialities/lasik-surgery/?x=1" (or just "/") */
export function keywordsHref(path) {
  const clean = String(path ?? "").split("?")[0] || "/"
  return `${KEYWORDS_PATH}?${new URLSearchParams({ url: clean }).toString()}`
}
