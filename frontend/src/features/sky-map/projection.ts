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

/**
 * Clips a visual line in the sky-map plane to the circular horizon. This keeps
 * familiar asterism edges straight while correctly hiding off-map endpoints.
 */
export function clipProjectedSegmentToCircle(
  start: ProjectedPoint,
  end: ProjectedPoint,
  radius: number,
  center = radius,
): ProjectedSegment | null {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const relativeX = start.x - center
  const relativeY = start.y - center
  const squaredLength = deltaX * deltaX + deltaY * deltaY
  const startInside = relativeX * relativeX + relativeY * relativeY <= radius * radius
  if (squaredLength < 0.000_001) return startInside ? { start, end } : null

  const projection = relativeX * deltaX + relativeY * deltaY
  const discriminant = projection * projection - squaredLength * (relativeX * relativeX + relativeY * relativeY - radius * radius)
  if (discriminant < 0) return startInside ? { start, end } : null

  const root = Math.sqrt(discriminant)
  const entry = (-projection - root) / squaredLength
  const exit = (-projection + root) / squaredLength
  const startProgress = Math.max(0, entry)
  const endProgress = Math.min(1, exit)
  if (startProgress > endProgress) return null

  return {
    start: pointAlongSegment(start, deltaX, deltaY, startProgress),
    end: pointAlongSegment(start, deltaX, deltaY, endProgress),
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

function pointAlongSegment(
  start: ProjectedPoint,
  deltaX: number,
  deltaY: number,
  progress: number,
): ProjectedPoint {
  return { x: start.x + deltaX * progress, y: start.y + deltaY * progress }
}

function shortestAngleDelta(start: number, end: number): number {
  return ((end - start + 540) % 360) - 180
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}
