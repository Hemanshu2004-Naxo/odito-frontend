import { describe, it, expect } from "vitest"
import { suggestFix } from "./suggestFix"

describe("suggestFix", () => {
  it("404 and 410: redirect it", () => {
    expect(suggestFix(404)).toBe("Add a 301 redirect to a relevant live page")
    expect(suggestFix(410)).toBe("Add a 301 redirect to a relevant live page")
  })

  it("403: the server or CDN is blocking access", () => {
    expect(suggestFix(403)).toBe("Server/CDN is blocking access — check firewall or bot protection")
  })

  it("every 5xx: hosting", () => {
    for (const c of [500, 502, 503, 504, 599]) expect(suggestFix(c), String(c)).toBe("Server error — check hosting")
  })

  it("everything else, and an unknown status, is 'Check this URL' (never a made-up diagnosis)", () => {
    for (const c of [200, 301, 302, 400, 401, 405, 429, 499, 600, 0, null, undefined, "404", 404.5, NaN]) expect(suggestFix(c), String(c)).toBe("Check this URL")
  })
})
