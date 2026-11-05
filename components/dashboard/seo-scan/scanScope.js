/**
 * Which scan a page's "Run SEO scan" starts. The backend defines the datasets of each scope (seo_data/config.js); a page asks for the
 * scope that collects what it shows. Routes that are not SEO data pages have no scope (the bar is not shown).
 */
const ROUTES = [
  ["/app/domain-overview", "overview"],
  ["/app/traffic-history", "organic"],
  ["/app/organic-keywords", "organic"],
  ["/app/competitors", "competitors"],
  ["/app/backlinks", "offpage"],
  ["/app/referring-domains", "offpage"],
]

/** @param {string|null|undefined} pathname */
export function scopeForPath(pathname) {
  if (!pathname) return null
  const hit = ROUTES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return hit ? hit[1] : null
}
