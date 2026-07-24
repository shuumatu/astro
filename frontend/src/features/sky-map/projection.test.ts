import { describe, expect, it } from 'vitest'
import { clipAndProjectHorizonSegment, projectHorizontal } from './projection'

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
