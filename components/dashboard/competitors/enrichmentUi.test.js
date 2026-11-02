import { describe, it, expect } from "vitest"
import { statusMeta, reasonFor, canRefresh, pollInterval, sectionText, missingSections } from "./enrichmentUi"

const NOW = Date.parse("2026-11-02T12:00:00Z")
const comp = (enrichment, over = {}) => ({ id: "c", domain: "rival.com", enrichment, ...over })

describe("statusMeta", () => {
  it("has a label and an explanation for every status", () => {
    for (const status of ["no_website", "not_started", "pending", "processing", "enriched", "partial", "failed"]) {
      const m = statusMeta({ status })
      expect(m.label).toBeTruthy()
      expect(m.hint).toBeTruthy()
    }
  })
  it("a queued record that was already tried is Retrying; stale data says so; an unknown status is treated as not fetched", () => {
    expect(statusMeta({ status: "pending", attempts: 0 }).label).toBe("Queued")
    expect(statusMeta({ status: "pending", attempts: 2 }).label).toBe("Retrying")
    expect(statusMeta({ status: "enriched", stale: true }).label).toMatch(/stale/)
    expect(statusMeta({ status: "enriched", stale: false }).label).toBe("Up to date")
    expect(statusMeta({ status: "weird" }).label).toBe("Not fetched")
    expect(statusMeta(null).label).toBe("Not fetched")
  })
})

describe("reasonFor: why a value is missing", () => {
  it("names the real reason, from the section's own status", () => {
    expect(reasonFor({ status: "no_website" }, "rank")).toMatch(/No website/)
    expect(reasonFor({ status: "partial", sections: { rank: { status: "no_data" } } }, "rank")).toMatch(/no data/)
    expect(reasonFor({ status: "partial", sections: { backlinks: { status: "failed" } } }, "backlinks")).toMatch(/Could not be loaded/)
    expect(reasonFor({ status: "pending" }, "rank")).toMatch(/Being fetched/)
    expect(reasonFor({ status: "processing" }, "rank")).toMatch(/Being fetched/)
    expect(reasonFor(null, "rank")).toMatch(/Not fetched/)
  })
  it("the shared-keywords reason says which case it is: no provider data, failed, not fetched yet, being fetched", () => {
    expect(reasonFor({ status: "partial", sections: { shared: { status: "no_data" } } }, "shared")).toMatch(/no shared-keyword data/i)
    expect(reasonFor({ status: "partial", sections: { shared: { status: "failed" } } }, "shared")).toMatch(/Could not be loaded/)
    expect(reasonFor({ status: "partial", sections: { shared: { status: "not_configured" } } }, "shared")).toMatch(/Not fetched yet/)
    expect(reasonFor({ status: "enriched", sections: {} }, "shared")).toMatch(/Not fetched yet/)
    expect(reasonFor({ status: "pending", sections: {} }, "shared")).toMatch(/Being fetched/)
    expect(reasonFor({ status: "no_website" }, "shared")).toMatch(/No website/)
  })
  it("section wording never calls a missing section loaded", () => {
    expect(sectionText({ status: "ok" })).toBe("Loaded")
    expect(sectionText({ status: "no_data" })).toMatch(/No data/)
    expect(sectionText({ status: "failed" })).toBe("Failed")
    for (const s of [null, undefined, { status: "not_configured" }]) expect(sectionText(s)).toBe("Not fetched yet")
  })
})

describe("canRefresh", () => {
  it("only a competitor with a website that is not already queued or running", () => {
    expect(canRefresh(comp({ status: "enriched" }))).toBe(true)
    expect(canRefresh(comp({ status: "failed" }))).toBe(true)
    expect(canRefresh(comp(undefined))).toBe(true)
    expect(canRefresh(comp({ status: "pending" }))).toBe(false)
    expect(canRefresh(comp({ status: "processing" }))).toBe(false)
    expect(canRefresh(comp({ status: "no_website" }, { domain: null }))).toBe(false)
  })
})

describe("pollInterval: watch queued work, never create it", () => {
  const iso = (ms) => new Date(ms).toISOString()
  it("nothing waiting: no polling at all", () => {
    expect(pollInterval([comp({ status: "enriched" }), comp({ status: "failed" }), comp({ status: "no_website" }, { domain: null })], NOW)).toBe(false)
    expect(pollInterval([], NOW)).toBe(false)
    expect(pollInterval(undefined, NOW)).toBe(false)
  })
  it("something is being fetched: every 5 seconds", () => {
    expect(pollInterval([comp({ status: "processing" })], NOW)).toBe(5000)
  })
  it("just queued: every 5 seconds for the first two minutes, then a minute (a retry backoff or a switched-off worker must not poll fast forever)", () => {
    expect(pollInterval([comp({ status: "pending", requestedAt: iso(NOW - 30_000), nextAttemptAt: iso(NOW - 30_000) })], NOW)).toBe(5000)
    expect(pollInterval([comp({ status: "pending", requestedAt: iso(NOW - 10 * 60_000), nextAttemptAt: iso(NOW - 9 * 60_000) })], NOW)).toBe(60_000)
    expect(pollInterval([comp({ status: "pending", requestedAt: iso(NOW - 60_000), nextAttemptAt: iso(NOW + 30 * 60_000) })], NOW)).toBe(5000)
  })
  it("a record with no website is never waited for", () => {
    expect(pollInterval([comp({ status: "pending", requestedAt: iso(NOW) }, { domain: null })], NOW)).toBe(false)
  })
})

describe("statusMeta for the new states", () => {
  it("no_data is its own state; partial names what is missing", () => {
    expect(statusMeta({ status: "no_data" }).label).toBe("No data")
    const m = statusMeta({ status: "partial", sections: { rank: { status: "ok" }, backlinks: { status: "ok" }, shared: { status: "no_data" } } })
    expect(m.label).toBe("Partial data")
    expect(m.hint).toMatch(/Shared keywords \(no data from the provider\)/)
    expect(m.hint).not.toMatch(/Rankings|Backlinks/)
  })
  it("an older record (no shared section) is listed as missing, not loaded", () => {
    expect(missingSections({ sections: { rank: { status: "ok" }, backlinks: { status: "ok" } } })).toEqual(["Shared keywords (not fetched yet)"])
    expect(missingSections({ sections: { rank: { status: "ok" }, backlinks: { status: "ok" }, shared: { status: "ok" } } })).toEqual([])
  })
})
