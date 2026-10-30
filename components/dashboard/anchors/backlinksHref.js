import { BACKLINKS_PATH } from "./constants"

/**
 * The Backlinks page filtered to ONE anchor ("View these backlinks"): `exact=<text>` is the exact anchor, `noanchor=1` the links with no anchor
 * text. A Lost view opens the Lost tab; Live and All open the default tab (the Backlinks page has no "all" tab).
 * @param {{ anchor: string|null }} row
 * @param {"live"|"lost"|"all"} [status]
 */
export function backlinksHref(row, status = "live") {
  const p = new URLSearchParams()
  if (status === "lost") p.set("tab", "lost")
  if (row.anchor === null || row.anchor === undefined) p.set("noanchor", "1")
  else p.set("exact", row.anchor)
  return `${BACKLINKS_PATH}?${p.toString()}`
}
