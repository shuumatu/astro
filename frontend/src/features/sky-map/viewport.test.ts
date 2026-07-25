import { describe, expect, it } from 'vitest'
import {
  MAX_SKY_ZOOM,
  centerSkyViewOn,
  defaultSkyViewTransform,
  panSkyView,
  resizeSkyViewTransform,
  skyViewportRadius,
  transformSkyPoint,
  zoomSkyViewAt,
} from './viewport'

describe('sky view transforms', () => {
  it('zooms around the pointer without moving its projected sky point', () => {
    const initial = defaultSkyViewTransform()
    const anchor = { x: 140, y: 80 }
    const zoomed = zoomSkyViewAt(initial, 2, anchor, 100, 90)
    const pointBeforeZoom = { x: 140, y: 80 }

    expect(transformSkyPoint(pointBeforeZoom, zoomed, 100).x).toBeCloseTo(anchor.x, 12)
    expect(transformSkyPoint(pointBeforeZoom, zoomed, 100).y).toBeCloseTo(anchor.y, 12)
  })

  it('constrains panning and resets offsets at the minimum zoom', () => {
    const panned = panSkyView({ scale: 2, offsetX: 0, offsetY: 0 }, 500, -500, 100)
    expect(panned).toEqual({ scale: 2, offsetX: 100, offsetY: -100 })

    const reset = zoomSkyViewAt(panned, 0.5, { x: 100, y: 100 }, 100, 100)
    expect(reset).toEqual(defaultSkyViewTransform())
  })

  it('allows detailed inspection up to the configured maximum zoom', () => {
    const zoomed = zoomSkyViewAt(defaultSkyViewTransform(), 99, { x: 100, y: 100 }, 100, 90)

    expect(zoomed.scale).toBe(MAX_SKY_ZOOM)
  })

  it('centers an inner target and clamps a horizon target to the navigable edge', () => {
    const inner = centerSkyViewOn({ x: 120, y: 80 }, 3, 100, 90)
    expect(transformSkyPoint({ x: 120, y: 80 }, inner, 100)).toEqual({ x: 100, y: 100 })

    const horizon = centerSkyViewOn({ x: 190, y: 100 }, 2, 100, 90)
    expect(horizon.offsetX).toBe(-90)
  })

  it('preserves normalized pan offsets when the viewport changes size', () => {
    const transform = { scale: 2.5, offsetX: 120, offsetY: -75 }
    const resized = resizeSkyViewTransform(transform, 480, 1080)
    const radiusRatio = skyViewportRadius(1080) / skyViewportRadius(480)

    expect(resized.scale).toBe(transform.scale)
    expect(resized.offsetX).toBeCloseTo(transform.offsetX * radiusRatio, 12)
    expect(resized.offsetY).toBeCloseTo(transform.offsetY * radiusRatio, 12)
    expect(resizeSkyViewTransform(transform, 0, 1080)).toBe(transform)
  })
})
