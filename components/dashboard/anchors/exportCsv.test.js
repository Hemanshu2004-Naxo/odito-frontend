import { describe, expect, test } from "vitest"
import { anchorsCsvFileName, buildAnchorsCsv, CSV_COLUMNS } from "./exportCsv"
import { backlinksHref } from "./backlinksHref"
import { mapAnchor } from "./mapAnchor"
import { REAL_ANCHORS } from "./testFixtures"

const rows = REAL_ANCHORS.items.map((i) => ({ ...mapAnchor(i, { now: 0 }), type: "other" }))

describe("the anchors CSV", () => {
  test("the columns of the brief, in order", () => {
    expect(CSV_COLUMNS.map(([h]) => h)).toEqual(["Anchor", "Type", "Referring domains", "Backlinks", "Dofollow %", "Rank", "Spam score", "Broken backlinks", "First seen"])
  })

  test("one header line and one line per anchor, CRLF separated", () => {
    const lines = buildAnchorsCsv(rows).split("\r\n")
    expect(lines).toHaveLength(11)
    expect(lines[0]).toBe("Anchor,Type,Referring domains,Backlinks,Dofollow %,Rank,Spam score,Broken backlinks,First seen")
  })

  test("a real row: the type is its label, the dofollow share has one decimal, the date is the provider's own", () => {
    const line = buildAnchorsCsv([{ ...rows[3], type: "branded" }]).split("\r\n")[1]
    expect(line).toBe("ASG Eye Hospital,Branded,109,1164,88.1,266,2,762,2022-01-29 06:03:29 +00:00".replace("06:03:29", rows[3].firstSeen.raw.slice(11, 19)))
  })

  test("the empty anchor is written as text, not as an empty first column", () => {
    const line = buildAnchorsCsv([{ ...rows[2], type: "empty" }]).split("\r\n")[1]
    expect(line.startsWith("(empty / image link),Empty / image,140,932,")).toBe(true)
  })

  test("a missing value is an empty cell, never 0", () => {
    const line = buildAnchorsCsv([{ ...mapAnchor({ anchor: "x" }), type: "other" }]).split("\r\n")[1]
    expect(line).toBe("x,Other,,,,,,,")
  })

  test("an anchor that looks like a formula is neutralised, and quotes and commas are escaped", () => {
    const csv = buildAnchorsCsv([{ ...mapAnchor({ anchor: "=HYPERLINK(\"http://x\")" }), type: "other" }, { ...mapAnchor({ anchor: "a, \"b\"" }), type: "other" }])
    const [, a, b] = csv.split("\r\n")
    expect(a.startsWith("\"'=HYPERLINK(")).toBe(true)
    expect(b.startsWith('"a, ""b"""')).toBe(true)
  })

  test("a row without a type has an empty Type cell (not 'undefined')", () => {
    const line = buildAnchorsCsv([mapAnchor({ anchor: "x" })]).split("\r\n")[1]
    expect(line).not.toMatch(/undefined|null/)
  })
})

describe("file names", () => {
  const day = new Date("2026-10-27T10:00:00Z")
  test("the scope and the date are in the name; Lost / All are named; the domain is made safe", () => {
    expect(anchorsCsvFileName("asgeyehospital.com", "page", "live", day)).toBe("anchors_asgeyehospital.com_page_2026-10-27.csv")
    expect(anchorsCsvFileName("asgeyehospital.com", "all", "live", day)).toBe("anchors_asgeyehospital.com_all_2026-10-27.csv")
    expect(anchorsCsvFileName("asgeyehospital.com", "page", "lost", day)).toBe("anchors_asgeyehospital.com_lost_page_2026-10-27.csv")
    expect(anchorsCsvFileName("a/b c.com", "page", "live", day)).toBe("anchors_a-b-c.com_page_2026-10-27.csv")
    expect(anchorsCsvFileName(null, "page", "live", day)).toBe("anchors_domain_page_2026-10-27.csv")
  })
})

describe("View these backlinks", () => {
  test("an anchor opens the Backlinks page filtered to that exact anchor", () => {
    expect(backlinksHref({ anchor: "ASG Eye Hospital" })).toBe("/app/backlinks/list?exact=ASG+Eye+Hospital")
  })
  test("the empty anchor opens the Backlinks page's no-anchor filter", () => {
    expect(backlinksHref({ anchor: null })).toBe("/app/backlinks/list?noanchor=1")
  })
  test("special characters survive the trip", () => {
    const href = backlinksHref({ anchor: "50% off & more" })
    expect(new URL(href, "http://x").searchParams.get("exact")).toBe("50% off & more")
  })
  test("a Lost view opens the Lost tab; All and Live open the default", () => {
    expect(backlinksHref({ anchor: "x" }, "lost")).toBe("/app/backlinks/list?tab=lost&exact=x")
    expect(backlinksHref({ anchor: "x" }, "all")).toBe("/app/backlinks/list?exact=x")
    expect(backlinksHref({ anchor: "x" }, "live")).toBe("/app/backlinks/list?exact=x")
  })
})
