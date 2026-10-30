/**
 * The ONE request shape of the backlinks section (the Domain Overview's Domain Rank / Backlinks / Referring Domains cards and the
 * Backlink Overview page). The default is the page's default view — live links, no filter — so the dashboard and the page share a
 * query key in the browser and a cache entry on the server.
 */

export const BACKLINK_STATUSES = Object.freeze(["live", "lost", "all"])

/** @type {Readonly<{ status: "live"|"lost"|"all", dofollow: boolean }>} */
export const DEFAULT_BACKLINKS_REQUEST = Object.freeze({ status: "live", dofollow: false })

export const isDefaultBacklinksRequest = (r) => Boolean(r) && r.status === DEFAULT_BACKLINKS_REQUEST.status && r.dofollow === DEFAULT_BACKLINKS_REQUEST.dofollow
