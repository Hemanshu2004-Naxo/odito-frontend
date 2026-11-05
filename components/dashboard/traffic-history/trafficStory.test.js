import { describe, expect, test } from "vitest"
import { buildRankGroups, buildTrafficStory, describeMovement, describeRankGroups, isBigFall } from "./trafficStory"

/** A month row the way mapTrafficHistory builds it (only what the helpers read). */
let n = 0
function row(year, month, { traffic, trafficPct = null, top10, top10Pct = null, b = {}, mv = {} }) {
  n += 1
  const buckets = { top1: 0, top3: 0, top10: 0, top20: 0, top50: 0, top100: 0, ...b }
  return {
    key: `${year}-${String(month).padStart(2, "0")}`, year, month, index: year * 12 + month - 1, label: `m${n}`,
    traffic, top10, buckets, bucketTotal: Object.values(buckets).reduce((a, v) => a + v, 0),
    movement: { new: 10, up: 5, down: 20, lost: 20, ...mv },
    mom: { traffic: { percent: trafficPct }, top10: { percent: top10Pct } },
  }
}

const krishna = () => [
  row(2025, 11, { traffic: 1700, top10: 32 }),
  row(2025, 12, { traffic: 1700, trafficPct: 4.5, top10: 32 }),
  row(2026, 1, { traffic: 1100, trafficPct: -38.1, top10: 21, top10Pct: -34 }),
  row(2026, 4, { traffic: 1100, top10: 17 }),
  row(2026, 5, { traffic: 731, trafficPct: -31.6, top10: 10, top10Pct: -41 }),
  row(2026, 10, { traffic: 548, trafficPct: -31.6 + 20, top10: 6 }),
]

describe("buildTrafficStory", () => {
  test("peak span, the drop since, the two biggest falls in date order, and the top-10 story", () => {
    const text = buildTrafficStory(krishna()).map((p) => p.text).join("")
    expect(text).toBe("Traffic peaked at 1.7K a month in Nov–Dec 2025 and has dropped 68% since. Two big falls: January (−38%) and May (−32%), both when page-1 keywords slipped. Top-10 keywords went from 32 to 6, so getting those back is the fastest way to recover traffic.")
    expect(buildTrafficStory(krishna()).filter((p) => p.strong).map((p) => p.text)).toEqual(["1.7K a month in Nov–Dec 2025", "January (−38%)", "May (−32%)"])
  })

  test("at the peak now; growth; too little data", () => {
    const up = [row(2026, 1, { traffic: 100, top10: 1 }), row(2026, 2, { traffic: 300, trafficPct: 200, top10: 4 })]
    expect(buildTrafficStory(up).map((p) => p.text).join("")).toBe("Traffic is at its highest in this range: 300 a month in Feb 2026. Top-10 keywords grew from 1 to 4.")
    expect(buildTrafficStory(up.slice(0, 1))).toBeNull()
  })
})

describe("chart notes", () => {
  test("rank groups: the group that changed most in number, then page 1", () => {
    const rows = [
      row(2026, 1, { traffic: 1, top10: 30, b: { top1: 2, top3: 3, top10: 25, top20: 40, top50: 100, top100: 120 } }),
      row(2026, 2, { traffic: 1, top10: 6, b: { top1: 1, top3: 2, top10: 3, top20: 18, top50: 50, top100: 40 } }),
    ]
    expect(describeRankGroups(rows)).toBe("Keywords in positions 21–100 shrank most in number, but page-1 keywords (green and aqua) fell from 30 to 6, and those bring most of the traffic.")
    expect(buildRankGroups(rows)[0]).toMatchObject({ g3: 5, g10: 25, g20: 40, g100: 220 })
  })

  test("movement: months that dropped more than they gained", () => {
    const rows = [row(2026, 1, { traffic: 1, top10: 1 }), row(2026, 2, { traffic: 1, top10: 1, mv: { new: 90, up: 10, down: 1, lost: 1 } })]
    expect(describeMovement(rows)).toBe("In 1 of 2 months, more keywords dropped (declined + lost) than gained.")
  })

  test("a big fall is 20% or more", () => {
    expect(isBigFall({ mom: { traffic: { percent: -20 } } })).toBe(true)
    expect(isBigFall({ mom: { traffic: { percent: -19.9 } } })).toBe(false)
    expect(isBigFall({ mom: { traffic: { percent: null } } })).toBe(false)
  })
})
