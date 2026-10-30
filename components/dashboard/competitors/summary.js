import { formatExact, formatRatio } from "../domain-overview/format"

/**
 * The one-line verdict in a competitor's expanded row, e.g. "dragarwal.com gets 1.4× your traffic on the 2,423 keywords you share."
 * It always says who is ahead, in words, from the same numbers as the head-to-head bar.
 * @param {import("./types").CompetitorRow} row
 */
export function describeComparison(row) {
  const { domain, sharedKeywords: shared, ourSharedTraffic: ours, theirSharedTraffic: theirs } = row
  if (ours === null || theirs === null) return `Traffic on the keywords you share with ${domain} isn't available yet.`
  const keywords = shared === null ? "the keywords you share" : `the ${formatExact(shared)} keyword${shared === 1 ? "" : "s"} you share`
  if (ours === theirs) return `${domain} and you get the same traffic on ${keywords}.`
  if (theirs > ours) {
    // `ours` can be 0: no ratio exists, say it plainly instead of "Infinity×".
    return ours > 0
      ? `${domain} gets ${formatRatio(theirs / ours)} your traffic on ${keywords}.`
      : `${domain} gets traffic on ${keywords}; you get none.`
  }
  return theirs > 0
    ? `You get ${formatRatio(ours / theirs)} ${domain}'s traffic on ${keywords}.`
    : `You get traffic on ${keywords}; ${domain} gets none.`
}
