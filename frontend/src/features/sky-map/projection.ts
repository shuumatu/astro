import type { HorizontalCoordinate } from './types'

const DEG_TO_RAD = Math.PI / 180

export interface ProjectedPoint {
  x: number
  y: number
}

export interface ProjectedSegment {
  start: ProjectedPoint
  end: ProjectedPoint
}

export function projectHorizontal(
  coordinate: HorizontalCoordinate,
  radius: number,
  center = radius,
): ProjectedPoint {
  const distance = ((90 - coordinate.altitudeDeg) / 90) * radius
  const azimuth = coordinate.azimuthDeg * DEG_TO_RAD
  return {
    x: center + Math.sin(azimuth) * distance,
    y: center - Math.cos(azimuth) * distance,
  }
}

export function clipAndProjectHorizonSegment(
  start: HorizontalCoordinate,
  end: HorizontalCoordinate,
  radius: number,
  center = radius,
): ProjectedSegment | null {
  const startVisible = start.altitudeDeg >= 0
  const endVisible = end.altitudeDeg >= 0
  if (!startVisible && !endVisible) return null

  let clippedStart = start
  let clippedEnd = end
  if (startVisible !== endVisible) {
    const intersection = horizonIntersection(start, end)
    if (startVisible) clippedEnd = intersection
    else clippedStart = intersection
  }

  return {
    start: projectHorizontal(clippedStart, radius, center),
    end: projectHorizontal(clippedEnd, radius, center),
  }
}

function horizonIntersection(
  start: HorizontalCoordinate,
  end: HorizontalCoordinate,
): HorizontalCoordinate {
  const altitudeRange = end.altitudeDeg - start.altitudeDeg
  const progress = -start.altitudeDeg / altitudeRange
  const azimuthDelta = shortestAngleDelta(start.azimuthDeg, end.azimuthDeg)
  return {
    azimuthDeg: normalizeDegrees(start.azimuthDeg + azimuthDelta * progress),
    altitudeDeg: 0,
  }
}

function shortestAngleDelta(start: number, end: number): number {
  return ((end - start + 540) % 360) - 180
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}
