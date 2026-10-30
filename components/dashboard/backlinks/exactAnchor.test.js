import { describe, expect, test } from "vitest"
import { backlinksHref } from "../anchors/backlinksHref"
import { buildBacklinkFilters, buildBacklinkRequest, describeActiveFilters } from "./buildBacklinkRequest"
import { defaultPageState, parseUrlState, serializeUrlState } from "./urlState"

/** The Anchors page's "View these backlinks" lands here: the link it builds must be read back into exactly the filter it means. */

const open = (href) => parseUrlState(new URL(href, "http://x").searchParams)
const filters = (state) => buildBacklinkFilters(state).conditions

describe("an exact anchor on the Backlinks page", () => {
  test("the Anchors page's link opens the Backlinks page filtered to that exact anchor", () => {
    const state = open(backlinksHref({ anchor: "ASG Eye Hospital" }))
    expect(state.exactAnchor).toBe("ASG Eye Hospital")
    expect(filters(state)).toEqual([["anchor", "=", "ASG Eye Hospital"]])
  })

  test("an empty anchor opens the Backlinks page's no-anchor filter", () => {
    const state = open(backlinksHref({ anchor: null }))
    expect(state.exactEmpty).toBe(true)
    expect(filters(state)).toEqual([["anchor", "=", ""]])
  })

  test("a Lost view opens the Lost tab with the anchor still applied", () => {
    const state = open(backlinksHref({ anchor: "x" }, "lost"))
    expect(state.tab).toBe("lost")
    const { request } = buildBacklinkRequest(state)
    expect(request.status).toBe("lost")
    expect(request.filters).toEqual(["anchor", "=", "x"])
  })

  test("it counts towards the 8 conditions, like every other filter", () => {
    const f = buildBacklinkFilters({ ...defaultPageState(), exactAnchor: "x", q: "a", anchor: "b", target: "c", follow: "dofollow", minRank: "5", maxSpam: "50", since: "2025-01-01", tab: "broken" })
    expect(f.count).toBe(9)
    expect(f.tooMany).toBe(true)
  })

  test("it keeps its own spelling and is written back to the URL", () => {
    const state = { ...defaultPageState(), exactAnchor: "50% off & more" }
    expect(filters(state)).toEqual([["anchor", "=", "50% off & more"]])
    expect(parseUrlState(new URLSearchParams(serializeUrlState(state))).exactAnchor).toBe("50% off & more")
    expect(serializeUrlState({ ...defaultPageState(), exactEmpty: true })).toBe("noanchor=1")
  })

  test("a chip says which anchor, and clearing it removes only that filter", () => {
    const state = { ...defaultPageState(), exactAnchor: "ASG Eye Hospital", q: "news" }
    const chips = describeActiveFilters(state)
    const chip = chips.find((c) => c.id === "exactAnchor")
    expect(chip.label).toBe("Anchor is “ASG Eye Hospital”")
    expect(filters({ ...state, ...chip.clear })).toEqual([["url_from", "like", "%news%"]])
    expect(describeActiveFilters({ ...defaultPageState(), exactEmpty: true })[0].label).toBe("Anchor: (no anchor text)")
  })

  test("without it, nothing changes: the default view still has no filters and an empty URL", () => {
    expect(filters(defaultPageState())).toEqual([])
    expect(serializeUrlState(defaultPageState())).toBe("")
    expect(defaultPageState().exactAnchor).toBeNull()
  })
})
