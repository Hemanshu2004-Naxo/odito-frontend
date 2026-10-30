/**
 * The one-line insight under an expanded row, built by rules from the row's own numbers. The FIRST rule that applies wins (the most
 * telling first); no rule, no line. PURE.
 *
 *  1 "All <n> links are footer links — likely a sitewide link."   every referring page's link is in the footer
 *  2 "<n> of <m> links are broken."                                the provider flagged some of the domain's backlinks as broken
 *  3 "Mostly nofollow links."                                      under half of the referring pages carry a dofollow link
 *
 * @param {{ referringPages: number|null, footerLinks: number|null, backlinks: number|null, brokenBacklinks: number|null, dofollowPct: number|null }} row
 * @returns {string|null}
 */
export function describeInsight(row) {
  const n = (v) => v.toLocaleString("en-US")
  const { referringPages: pages, footerLinks: footer, backlinks, brokenBacklinks: broken, dofollowPct } = row
  if (pages !== null && pages > 0 && footer !== null && footer >= pages) return `All ${n(footer)} links are footer links — likely a sitewide link.`
  if (broken !== null && broken > 0 && backlinks !== null && backlinks > 0) return `${n(broken)} of ${n(backlinks)} links are broken.`
  if (dofollowPct !== null && dofollowPct < 50) return "Mostly nofollow links."
  return null
}
