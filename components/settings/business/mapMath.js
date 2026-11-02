/** Web-Mercator maths for the location picker's slippy map. Pure: no DOM, no network. */
export const TILE = 256
export const MIN_ZOOM = 3
export const MAX_ZOOM = 18
const MAX_LAT = 85.0511287798

export const clampLat = (lat) => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
export const worldSize = (zoom) => TILE * 2 ** zoom

/** lat/lng -> pixel in the whole world at `zoom`. */
export function project({ lat, lng }, zoom) {
  const w = worldSize(zoom)
  const s = Math.sin((clampLat(lat) * Math.PI) / 180)
  return { x: ((lng + 180) / 360) * w, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * w }
}

/** world pixel -> lat/lng (longitude wrapped into [-180, 180]). */
export function unproject({ x, y }, zoom) {
  const w = worldSize(zoom)
  const lng = (x / w) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / w
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return { lat: clampLat(lat), lng: ((((lng + 180) % 360) + 360) % 360) - 180 }
}

/** The tiles that cover a `width` x `height` viewport centred on `center`, each with its pixel offset inside the viewport. */
export function visibleTiles(center, zoom, width, height) {
  const c = project(center, zoom)
  const left = c.x - width / 2
  const top = c.y - height / 2
  const n = 2 ** zoom
  const tiles = []
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
    if (ty < 0 || ty >= n) continue
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
      tiles.push({ key: `${zoom}/${tx}/${ty}`, x: ((tx % n) + n) % n, y: ty, z: zoom, left: tx * TILE - left, top: ty * TILE - top })
    }
  }
  return tiles
}

/** lat/lng -> pixel inside the viewport. */
export function toViewport(point, center, zoom, width, height) {
  const p = project(point, zoom); const c = project(center, zoom)
  return { x: p.x - c.x + width / 2, y: p.y - c.y + height / 2 }
}

/** pixel inside the viewport -> lat/lng. */
export function fromViewport({ x, y }, center, zoom, width, height) {
  const c = project(center, zoom)
  return unproject({ x: c.x + x - width / 2, y: c.y + y - height / 2 }, zoom)
}

/** Metres per pixel at a latitude: used to size a keyboard nudge to something visible at the current zoom. */
export const metersPerPixel = (lat, zoom) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
