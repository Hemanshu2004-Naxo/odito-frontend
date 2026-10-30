/**
 * What to do about a backlink whose target URL answers with an error. Shared by the Backlinks page (its Broken tab) and the Top Pages
 * page to come, so the advice is the same everywhere.
 *
 *   404 / 410  the page is gone                      -> redirect it
 *   403        the server refuses the visitor        -> a firewall / CDN / bot rule
 *   5xx        the server failed                     -> hosting
 *   anything else (or unknown)                       -> look at it
 *
 * @param {number|null|undefined} statusCode the HTTP status of the link's target URL
 * @returns {string}
 */
export function suggestFix(statusCode) {
  const code = typeof statusCode === "number" && Number.isInteger(statusCode) ? statusCode : null
  if (code === 404 || code === 410) return "Add a 301 redirect to a relevant live page"
  if (code === 403) return "Server/CDN is blocking access — check firewall or bot protection"
  if (code !== null && code >= 500 && code <= 599) return "Server error — check hosting"
  return "Check this URL"
}
