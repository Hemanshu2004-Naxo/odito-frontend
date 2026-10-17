import { describe, test, expect } from "vitest"
import { describeFixError, getOrganizationFixModel, rollbackStage, verificationSummary, verifyLabel } from "./organizationFix"

const FP = "a".repeat(64)
const preview = (over = {}) => ({
  fixType: "organization_schema", targetUrl: "https://clinic.example/", lifecycle: "awaiting_approval",
  source: { provider: "rank_math", bridgeVersion: "1.4.0" },
  schemaIntent: { type: "Hospital", action: "generate", reasons: ["The site's own markup identifies a Hospital."] },
  plan: {
    status: "ready", fingerprint: FP, code: null, message: null,
    changes: [{ field: "name", rankMathOption: "rank-math-options-titles.knowledgegraph_name" }],
    preserved: [{ field: "logo", current: "https://clinic.example/old.png", proposed: "https://clinic.example/new.png", reason: "kept" }], blocked: [], notWritten: [{ field: "telephone", message: "set it in Rank Math" }],
  },
  proposedChanges: [{ field: "name", label: "Organization name", kind: "set", before: "", after: "Clinic Eye Centre", source: "og:site_name" }],
  validation: { valid: true, errors: [], warnings: [] },
  verificationStatus: { saved: "pending", rendered: "pending" }, record: null, ...over,
})
const record = (over = {}) => ({ id: "r1", status: "applied", changes: [{ field: "name", before: "", after: "Clinic Eye Centre", applied: true, restored: false }], verification: { saved: { status: "verified" }, rendered: { status: "pending" } }, rollback: { status: "none" }, ...over })

describe("getOrganizationFixModel", () => {
  test("not loaded until the server answers", () => { expect(getOrganizationFixModel(null)).toEqual({ loaded: false }) })

  test("a ready, valid plan can be approved; the changes carry their label, values and the Rank Math setting they write", () => {
    const m = getOrganizationFixModel(preview())
    expect(m.canApprove).toBe(true)
    expect(m.lifecycleLabel).toBe("Awaiting your approval")
    expect(m.changes).toEqual([expect.objectContaining({ field: "name", label: "Organization name", before: "", after: "Clinic Eye Centre", setting: "rank-math-options-titles.knowledgegraph_name" })])
    expect(m.preserved).toHaveLength(1)
    expect(m.notWritten).toHaveLength(1)
    expect(m.fingerprint).toBe(FP)
    expect(m.nothingToApply).toBe(false)
  })

  test("a plan that is not ready, or whose markup failed validation, can NEVER be approved", () => {
    for (const status of ["nothing_to_change", "unsupported", "validation_failed", "blocked"]) {
      const m = getOrganizationFixModel(preview({ plan: { ...preview().plan, status, changes: [] }, proposedChanges: [], lifecycle: "unsupported" }))
      expect(m.canApprove, status).toBe(false)
      expect(m.nothingToApply, status).toBe(true)
    }
    const invalid = getOrganizationFixModel(preview({ validation: { valid: false, errors: ["x"], warnings: [] } }))
    expect(invalid.canApprove).toBe(false)
  })

  test("once applied there is nothing left to approve; re-verify and roll back become available — and roll back disappears after it", () => {
    const applied = getOrganizationFixModel(preview({ record: record(), lifecycle: "applied" }))
    expect(applied.canApprove).toBe(false)
    expect(applied.canReverify).toBe(true)
    expect(applied.canRollback).toBe(true)
    const rolled = getOrganizationFixModel(preview({ record: record({ status: "rolled_back", changes: [{ field: "name", applied: true, restored: true }] }), lifecycle: "rolled_back" }))
    expect(rolled.canRollback).toBe(false)
    expect(rolled.canReverify).toBe(false)
    expect(rolled.canApprove).toBe(true)
  })

  test("a failed attempt (conflict, apply failed) leaves the fix approvable again", () => {
    for (const status of ["conflict_detected", "apply_failed", "permission_denied"]) {
      expect(getOrganizationFixModel(preview({ record: record({ status, changes: [] }), lifecycle: status })).canApprove, status).toBe(true)
    }
  })
})

describe("verificationSummary — saved state and the rendered page are separate; 'verified' needs BOTH", () => {
  test("only saved verified -> pending overall", () => {
    expect(verificationSummary(record(), preview())).toEqual({ saved: "verified", rendered: "pending", savedCode: null, renderedCode: null, overall: "pending" })
  })
  test("both verified -> verified; either failed -> failed", () => {
    expect(verificationSummary(record({ verification: { saved: { status: "verified" }, rendered: { status: "verified" } } }), preview()).overall).toBe("verified")
    expect(verificationSummary(record({ verification: { saved: { status: "verified" }, rendered: { status: "failed" } } }), preview()).overall).toBe("failed")
    expect(verificationSummary(record({ verification: { saved: { status: "failed" }, rendered: { status: "verified" } } }), preview()).overall).toBe("failed")
  })
  test("an unverifiable rendered page (stale crawl) is never reported as verified", () => {
    expect(verificationSummary(record({ verification: { saved: { status: "verified" }, rendered: { status: "unverifiable" } } }), preview()).overall).toBe("pending")
    expect(verifyLabel("unverifiable")).toBe("Cannot be checked yet")
  })
  test("before any apply both are pending", () => {
    expect(verificationSummary(null, preview())).toEqual({ saved: "pending", rendered: "pending", savedCode: null, renderedCode: null, overall: "pending" })
  })
})

describe("describeFixError — the remediation matches the cause", () => {
  const err = (over) => Object.assign(new Error(over.message || "m"), over)
  test("a stale preview asks for a refreshed review, never a blind retry", () => {
    const i = describeFixError(err({ status: 409, code: "CONFLICT", details: { reason: "preview_stale" } }))
    expect(i.refreshPreview).toBe(true); expect(i.retry).toBe(false); expect(i.tone).toBe("warn")
    expect(i.message).toMatch(/Nothing was written/)
  })
  test("a conflict during the write says nothing was overwritten (and that written fields were put back)", () => {
    const i = describeFixError(err({ status: 409, code: "CONFLICT", message: "A setting changed", details: { restoredFields: ["name"] } }))
    expect(i.message).toMatch(/put back/); expect(i.message).toMatch(/Nothing was overwritten/); expect(i.retry).toBe(false)
  })
  test("permission denied, invalid credentials, outdated Bridge, unsupported, validation, rate limit, timeout", () => {
    expect(describeFixError(err({ status: 403, code: "PERMISSION_DENIED" })).title).toBe("Permission denied")
    expect(describeFixError(err({ status: 401, code: "INVALID_CREDENTIALS" })).title).toMatch(/rejected the connection/)
    const old = describeFixError(err({ status: 422, code: "FIELD_NOT_WRITABLE", message: "needs 1.4.0", details: { reason: "bridge_outdated" } }))
    expect(old.updatePlugin).toBe(true); expect(old.retry).toBe(false)
    expect(describeFixError(err({ status: 422, code: "FIELD_NOT_WRITABLE", message: "no" })).title).toBe("Not supported on this site")
    expect(describeFixError(err({ status: 422, code: "VALIDATION_FAILED" })).retry).toBe(false)
    expect(describeFixError(err({ status: 429 })).title).toBe("Too many attempts")
    const t = describeFixError(err({ status: 504 }))
    expect(t.message).toMatch(/Nothing is assumed to have been written/); expect(t.retry).toBe(true)
  })
  test("no error -> null", () => { expect(describeFixError(null)).toBeNull() })
})

describe("reliability states", () => {
  test("pending says WHY (waiting for a recrawl); unverifiable with a reason code is 'cannot be checked', never 'not yet'", () => {
    expect(verifyLabel("pending", "NO_POST_WRITE_CRAWL")).toBe("Waiting for a recrawl")
    expect(verifyLabel("pending", "PAGE_NOT_CRAWLED")).toBe("Page not crawled yet")
    expect(verifyLabel("pending")).toBe("Not checked yet")
    expect(verifyLabel("unverifiable", "ASSET_UNREACHABLE")).toBe("Cannot be checked")
    expect(verifyLabel("unverifiable")).toBe("Cannot be checked yet") // legacy records without a code keep their wording
    expect(verifyLabel("failed", "RENDERED_DIFFERS")).toBe("Does not match")
  })

  test("the reason code travels with each verification part", () => {
    const fix = { status: "applied", verification: { saved: { status: "verified" }, rendered: { status: "pending", reasonCode: "NO_POST_WRITE_CRAWL" } }, changes: [], rollback: { status: "none" } }
    expect(verificationSummary(fix, {}).renderedCode).toBe("NO_POST_WRITE_CRAWL")
  })

  test("rollback stages are distinct: requested, applied (not yet confirmed), verified; the legacy value reads as restored", () => {
    expect(rollbackStage({ status: "none" })).toBeNull()
    expect(rollbackStage({ status: "requested" }).label).toMatch(/not finished/)
    expect(rollbackStage({ status: "applied" }).label).toMatch(/not yet confirmed/)
    expect(rollbackStage({ status: "verified" }).key).toBe("verified")
    expect(rollbackStage({ status: "rolled_back" }).key).toBe("verified")
    expect(rollbackStage({ status: "partial_conflict" }).tone).toBe("warn")
  })

  test("an apply whose outcome is unknown cannot be approved again, offers a status check instead, and cannot be rolled back until reconciled", () => {
    const m = getOrganizationFixModel({ plan: { status: "ready", fingerprint: "a".repeat(64), changes: [] }, validation: { valid: true }, lifecycle: "apply_uncertain",
      record: { status: "apply_uncertain", changes: [{ field: "name", applied: false, restored: false }], verification: {}, rollback: { status: "none" } } })
    expect(m.uncertain).toBe(true)
    expect(m.canApprove).toBe(false)
    expect(m.canReverify).toBe(true)
    expect(m.canRollback).toBe(false)
    expect(m.lifecycleLabel).toBe("Outcome unknown — check status")
  })

  test("a rollback that is applied but not yet confirmed can be re-checked", () => {
    const m = getOrganizationFixModel({ plan: { status: "nothing_to_change", fingerprint: "a".repeat(64), changes: [] }, validation: { valid: true }, lifecycle: "rolled_back",
      record: { status: "rolled_back", changes: [{ field: "name", applied: true, restored: true }], verification: {}, rollback: { status: "applied" } } })
    expect(m.canReverify).toBe(true)
    expect(m.canRollback).toBe(false)
    expect(m.rollbackStage.key).toBe("applied")
  })

  test("OUTCOME_UNKNOWN is explained as 'nothing repeated, nothing undone' with a status check, not a retry", () => {
    const info = describeFixError(Object.assign(new Error("x"), { code: "OUTCOME_UNKNOWN", status: 502, details: { reason: "outcome_unknown" } }))
    expect(info.checkStatus).toBe(true)
    expect(info.retry).toBe(false)
    expect(info.message).toMatch(/Nothing was repeated and nothing was undone/)
  })

  test("the preview's concurrency guarantee is passed through so the panel can state it honestly", () => {
    const m = getOrganizationFixModel({ plan: { status: "ready", fingerprint: "a".repeat(64), changes: [] }, validation: { valid: true }, concurrency: { writes: "read_then_write" } })
    expect(m.concurrency).toBe("read_then_write")
  })
})
