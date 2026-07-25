import { describe, expect, it } from 'vitest'
import {
  clipAndProjectHorizonSegment,
  clipProjectedSegmentToCircle,
  projectHorizontal,
} from './projection'

describe('projectHorizontal', () => {
  it('places zenith at the center and cardinal horizon points around the rim', () => {
    expect(projectHorizontal({ azimuthDeg: 42, altitudeDeg: 90 }, 100)).toEqual({ x: 100, y: 100 })
    expect(projectHorizontal({ azimuthDeg: 0, altitudeDeg: 0 }, 100)).toEqual({ x: 100, y: 0 })
    expect(projectHorizontal({ azimuthDeg: 90, altitudeDeg: 0 }, 100).x).toBeCloseTo(200, 12)
    expect(projectHorizontal({ azimuthDeg: 90, altitudeDeg: 0 }, 100).y).toBeCloseTo(100, 12)
    expect(projectHorizontal({ azimuthDeg: 180, altitudeDeg: 0 }, 100).y).toBeCloseTo(200, 12)
    expect(projectHorizontal({ azimuthDeg: 270, altitudeDeg: 0 }, 100).x).toBeCloseTo(0, 12)
  })

  it('uses altitude as an azimuthal-equidistant radial scale', () => {
    expect(projectHorizontal({ azimuthDeg: 0, altitudeDeg: 30 }, 90)).toEqual({ x: 90, y: 30 })
    expect(projectHorizontal({ azimuthDeg: 0, altitudeDeg: 60 }, 90)).toEqual({ x: 90, y: 60 })
  })
})

describe('clipAndProjectHorizonSegment', () => {
  it('omits a segment fully below the horizon', () => {
    expect(clipAndProjectHorizonSegment(
      { azimuthDeg: 20, altitudeDeg: -5 },
      { azimuthDeg: 30, altitudeDeg: -10 },
      100,
    )).toBeNull()
  })

  it('clips a crossing segment at the horizon', () => {
    const segment = clipAndProjectHorizonSegment(
      { azimuthDeg: 0, altitudeDeg: 30 },
      { azimuthDeg: 0, altitudeDeg: -30 },
      100,
    )

    expect(segment?.start.x).toBeCloseTo(100, 12)
    expect(segment?.start.y).toBeCloseTo(100 / 3, 12)
    expect(segment?.end.x).toBeCloseTo(100, 12)
    expect(segment?.end.y).toBeCloseTo(0, 12)
  })

  it('interpolates azimuth across north using the shortest direction', () => {
    const segment = clipAndProjectHorizonSegment(
      { azimuthDeg: 350, altitudeDeg: 10 },
      { azimuthDeg: 10, altitudeDeg: -10 },
      100,
    )

    expect(segment?.end.x).toBeCloseTo(100, 12)
    expect(segment?.end.y).toBeCloseTo(0, 12)
  })
})

describe('clipProjectedSegmentToCircle', () => {
  it('keeps a visual line straight while clipping its off-map endpoint', () => {
    const start = { x: 140, y: 70 }
    const end = { x: 260, y: 160 }
    const segment = clipProjectedSegmentToCircle(start, end, 100)

    expect(segment).not.toBeNull()
    expect(segment!.start).toEqual(start)
    expect(Math.hypot(segment!.end.x - 100, segment!.end.y - 100)).toBeCloseTo(100, 6)
    const originalSlope = (end.y - start.y) / (end.x - start.x)
    const clippedSlope = (segment!.end.y - start.y) / (segment!.end.x - start.x)
    expect(clippedSlope).toBeCloseTo(originalSlope, 10)
  })

  it('keeps only the portion of an outside-to-outside line crossing the map', () => {
    expect(clipProjectedSegmentToCircle(
      { x: -20, y: 100 },
      { x: 220, y: 100 },
      100,
    )).toEqual({ start: { x: 0, y: 100 }, end: { x: 200, y: 100 } })

    expect(clipProjectedSegmentToCircle(
      { x: -20, y: 10 },
      { x: -10, y: 20 },
      100,
    )).toBeNull()
  })
})
