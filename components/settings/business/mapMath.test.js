import { describe, expect, it } from "vitest"
import { fromViewport, project, toViewport, unproject, visibleTiles } from "./mapMath"

describe("mapMath", () => {
  it("projects and unprojects to the same point", () => {
    for (const p of [{ lat: 19.9975, lng: 73.7898 }, { lat: -33.86, lng: 151.2 }, { lat: 0.5, lng: -179.9 }]) {
      const r = unproject(project(p, 14), 14)
      expect(r.lat).toBeCloseTo(p.lat, 6)
      expect(r.lng).toBeCloseTo(p.lng, 6)
    }
  })
  it("puts the centre in the middle of the viewport and round-trips a click", () => {
    const c = { lat: 19.9975, lng: 73.7898 }
    expect(toViewport(c, c, 15, 600, 300)).toEqual({ x: 300, y: 150 })
    const back = fromViewport({ x: 420, y: 90 }, c, 15, 600, 300)
    const again = toViewport(back, c, 15, 600, 300)
    expect(again.x).toBeCloseTo(420, 4)
    expect(again.y).toBeCloseTo(90, 4)
  })
  it("covers the viewport with tiles, none off the world's edge", () => {
    const tiles = visibleTiles({ lat: 19.9975, lng: 73.7898 }, 15, 600, 300)
    expect(tiles.length).toBeGreaterThanOrEqual(6)
    expect(tiles.every((t) => t.y >= 0 && t.y < 2 ** 15 && t.x >= 0 && t.x < 2 ** 15)).toBe(true)
    expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0)
    expect(Math.max(...tiles.map((t) => t.left))).toBeGreaterThan(300)
  })
})
