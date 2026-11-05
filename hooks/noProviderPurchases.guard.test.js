import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

/**
 * A guard on the SOURCE of every hook that reads SEO data from the backend. Opening, paging, sorting, filtering or switching tabs on any of
 * the nine SEO pages must never ask the server to buy provider data. The server enforces it (a plain read is database-only), and this test
 * keeps the browser honest:
 *
 *  1. every call to domainOverviewService.getSection passes `refresh` as the literal `false`, or through the "refresh next fetch" tokens
 *     that only a user's Refresh / Retry handler sets (consume(...), refreshNext.current.delete(...), consume(skipServerCacheNext));
 *  2. no such hook polls (`refetchInterval`) or forces a refetch on mount / reconnect;
 *  3. the set of hooks allowed to call the service is explicit, so a NEW caller has to be looked at (and added here) on purpose.
 */

const root = path.resolve(__dirname, "..")
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8")

const SEO_HOOKS = [
  "hooks/useAnchors.js", "hooks/useAnchorSettings.js", "hooks/useBacklinkExtras.js", "hooks/useBacklinks.js", "hooks/useBacklinkSummary.js", "hooks/useCompetitors.js", "hooks/useDomainHub.js",
  "hooks/useDomainOverview.js", "hooks/useOrganicKeywords.js", "hooks/useOwnSeoMetrics.js", "hooks/useReferringDomains.js", "hooks/useTopPages.js",
  "hooks/useTrafficComparison.js", "hooks/useTrafficHistory.js",
]

const walk = (dir, out = []) => {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "test-results", "e2e"].includes(name.name)) continue
    const full = path.join(dir, name.name)
    if (name.isDirectory()) walk(full, out)
    else if (/\.(js|jsx)$/.test(name.name) && !/\.test\./.test(name.name) && !/\.guard\./.test(name.name)) out.push(full)
  }
  return out
}

describe("no SEO page can buy provider data by being opened", () => {
  it("only the known hooks call domainOverviewService.getSection", () => {
    const callers = ["hooks", "components", "lib", "app", "contexts", "providers"]
      .flatMap((d) => (fs.existsSync(path.join(root, d)) ? walk(path.join(root, d)) : []))
      .filter((f) => /domainOverviewService\.getSection\(/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(root, f).replaceAll("\\", "/"))
      .sort()
    const known = SEO_HOOKS.filter((h) => /domainOverviewService\.getSection\(/.test(read(h))).sort()
    expect(callers).toEqual(known)
    expect(callers.length).toBeGreaterThanOrEqual(10)
  })

  it("every getSection call sends refresh as false or through the user-action tokens - never true, never a stray variable", () => {
    const SAFE = /^(false|consume\(refreshNext\.current, "[a-z]+"\)|refreshNext\.current\.delete\(section\)|consume\(skipServerCacheNext\))$/
    let calls = 0
    for (const rel of SEO_HOOKS) {
      const src = read(rel)
      for (const m of src.matchAll(/getSection\([^)]*?\{\s*([^}]*?)\}/gs)) {
        const options = m[1]
        const refresh = /\brefresh:\s*((?:consume\([^)]*\)|refreshNext\.current\.delete\([^)]*\)|[A-Za-z_.]+))/.exec(options)
        if (!refresh) continue // no refresh option: the server default (a plain read)
        calls += 1
        expect(SAFE.test(refresh[1].trim()), `${rel}: refresh: ${refresh[1]}`).toBe(true)
      }
    }
    expect(calls).toBeGreaterThan(15)
    // the shorthand form (`{ refresh, ... }`) is only allowed where the value is a one-shot ref armed by the hook's own refresh handler
    for (const rel of SEO_HOOKS) {
      const src = read(rel)
      if (/getSection\([^)]*\{\s*refresh\s*[,}]/.test(src)) {
        expect(src, rel).toMatch(/const refresh = refreshNext\.current\s+refreshNext\.current = false/)
        expect(src, rel).toMatch(/const refresh = useCallback\(\(\) => \{\s+refreshNext\.current = true/)
      }
    }
  })

  it("the tokens are only set inside the hooks' explicit refresh handlers", () => {
    for (const rel of SEO_HOOKS) {
      const src = read(rel)
      // every place that arms a refresh token (add / set) must sit in a function the user triggers: refresh / refreshAll / retry
      for (const m of src.matchAll(/refreshNext\.current\.add\(/g)) {
        const before = src.slice(0, m.index)
        const lastFn = [...before.matchAll(/(?:const|function)\s+(\w+)\s*(?:=\s*(?:useCallback\()?\(?|\()/g)].at(-1)?.[1] ?? ""
        expect(/^(refresh\w*|retry\w*|reload\w*)$/i.test(lastFn), `${rel}: refresh armed in "${lastFn}"`).toBe(true)
      }
    }
  })

  it("no SEO hook polls, or forces a refetch on mount / reconnect / focus", () => {
    for (const rel of SEO_HOOKS) {
      const src = read(rel)
      expect(src, rel).not.toMatch(/refetchInterval/)
      expect(src, rel).not.toMatch(/refetchOnMount:\s*(true|["']always["'])/)
      expect(src, rel).not.toMatch(/refetchOnReconnect:\s*(true|["']always["'])/)
      expect(src, rel).not.toMatch(/refetchOnWindowFocus:\s*(true|["']always["'])/)
    }
  })
})
