"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MAX_ZOOM, MIN_ZOOM, TILE, fromViewport, metersPerPixel, toViewport, visibleTiles } from "./mapMath"

/**
 * A street map for checking and adjusting the business position. Self-contained: no Google Maps JavaScript key exists in this app, so the
 * tiles are OpenStreetMap's (attribution shown, as their tile policy requires; fine for this low-traffic settings screen, a hosted tile
 * provider is the production follow-up). The marker is the business: drag it, click the map to put it somewhere else, or focus it and use
 * the arrow keys. Dragging the background pans. Nothing here reads the device location.
 */
const H = 280
const PAN_THRESHOLD = 4

export default function LocationPickerMap({ position, onChange, confirmed = false, disabled = false, className = "" }) {
  const box = useRef(null)
  const [width, setWidth] = useState(600)
  const [zoom, setZoom] = useState(position ? 16 : 4)
  const [center, setCenter] = useState(position ?? { lat: 20.5937, lng: 78.9629 })
  const drag = useRef(null)

  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const measure = () => setWidth(Math.max(240, Math.round(el.clientWidth)))
    measure()
    if (typeof ResizeObserver === "undefined") return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A position that arrives from outside (a picked place, typed coordinates) re-centres the map; one set by dragging the marker does not.
  const lastOwn = useRef(null)
  useEffect(() => {
    if (!position) return
    if (lastOwn.current && lastOwn.current.lat === position.lat && lastOwn.current.lng === position.lng) return
    setCenter(position)
    setZoom((z) => (z < 14 ? 16 : z))
  }, [position])

  const local = useCallback((e) => {
    const r = box.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [])
  const place = useCallback((pt) => {
    const next = fromViewport(pt, center, zoom, width, H)
    const rounded = { lat: Number(next.lat.toFixed(6)), lng: Number(next.lng.toFixed(6)) }
    lastOwn.current = rounded
    onChange?.(rounded)
  }, [center, zoom, width, onChange])

  const onBackgroundDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    drag.current = { kind: "pan", start: local(e), moved: false, center }
    box.current.setPointerCapture?.(e.pointerId)
  }
  const onMarkerDown = (e) => {
    if (disabled) return
    e.stopPropagation()
    drag.current = { kind: "marker" }
    box.current.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const pt = local(e)
    if (d.kind === "marker") { place(pt); return }
    const dx = pt.x - d.start.x; const dy = pt.y - d.start.y
    if (!d.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return
    d.moved = true
    setCenter(fromViewport({ x: width / 2 - dx, y: H / 2 - dy }, d.center, zoom, width, H))
  }
  const onUp = (e) => {
    const d = drag.current
    drag.current = null
    box.current?.releasePointerCapture?.(e.pointerId)
    if (d?.kind === "pan" && !d.moved && !disabled) place(local(e))
  }

  const marker = position ? toViewport(position, center, zoom, width, H) : null
  const onMarkerKey = (e) => {
    if (disabled || !position) return
    const step = metersPerPixel(position.lat, zoom) * 10
    const dLat = step / 111_320; const dLng = step / (111_320 * Math.max(0.01, Math.cos((position.lat * Math.PI) / 180)))
    const move = { ArrowUp: [dLat, 0], ArrowDown: [-dLat, 0], ArrowLeft: [0, -dLng], ArrowRight: [0, dLng] }[e.key]
    if (!move) return
    e.preventDefault()
    const next = { lat: Number(Math.max(-90, Math.min(90, position.lat + move[0])).toFixed(6)), lng: Number(Math.max(-180, Math.min(180, position.lng + move[1])).toFixed(6)) }
    lastOwn.current = next
    onChange?.(next)
  }

  const tiles = visibleTiles(center, zoom, width, H)

  return (
    <div className={className}>
      <div
        ref={box}
        className="relative touch-none select-none overflow-hidden rounded-xl border border-border bg-muted"
        style={{ height: H, cursor: disabled ? "default" : "crosshair" }}
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { drag.current = null }}
        data-testid="location-map"
      >
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.key} src={`https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`} alt="" width={TILE} height={TILE} draggable={false} loading="lazy" className="pointer-events-none absolute max-w-none" style={{ left: t.left, top: t.top, width: TILE, height: TILE }} />
        ))}
        {marker ? (
          <button
            type="button"
            role="slider"
            aria-label="Business position on the map. Drag it, or use the arrow keys to move it."
            aria-valuetext={`${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}
            aria-valuenow={position.lat}
            disabled={disabled}
            onPointerDown={onMarkerDown}
            onKeyDown={onMarkerKey}
            className="absolute -translate-x-1/2 -translate-y-full rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ left: marker.x, top: marker.y, cursor: disabled ? "default" : "grab" }}
            data-testid="location-marker"
          >
            <svg width="30" height="40" viewBox="0 0 30 40" aria-hidden className="drop-shadow">
              <path d="M15 0C6.7 0 0 6.6 0 14.8 0 26 15 40 15 40s15-14 15-25.2C30 6.6 23.3 0 15 0z" fill={confirmed ? "#e11d48" : "#d97706"} stroke="#fff" strokeWidth="2" strokeDasharray={confirmed ? undefined : "4 2"} />
              <circle cx="15" cy="14.5" r="5.5" fill="#fff" />
            </svg>
            <span className={`pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${confirmed ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-900"}`} data-testid="marker-label">
              {confirmed ? "Confirmed location" : "Unconfirmed position"}
            </span>
          </button>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 text-sm text-muted-foreground">
            Search for the address above, or click the map to place the business.
          </div>
        )}
        <div className="absolute right-2 top-2 flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <Button type="button" size="icon" variant="secondary" className="size-8" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}><Plus className="size-4" /></Button>
          <Button type="button" size="icon" variant="secondary" className="size-8" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}><Minus className="size-4" /></Button>
        </div>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="absolute bottom-0 right-0 bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground" onPointerDown={(e) => e.stopPropagation()}>
          © OpenStreetMap contributors
        </a>
      </div>
    </div>
  )
}
