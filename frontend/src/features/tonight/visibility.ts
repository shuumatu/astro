import type { HorizontalCoordinate } from '../sky-map/types'
import type { ObservingEnvironment, TimeInterval } from './types'

export const MINUTE = 60_000
export const MIN_RECOMMENDED_MINUTES = 20

export function angularSeparation(a: HorizontalCoordinate, b: HorizontalCoordinate): number {
  const rad = Math.PI / 180
  const cosine = Math.sin(a.altitudeDeg * rad) * Math.sin(b.altitudeDeg * rad)
    + Math.cos(a.altitudeDeg * rad) * Math.cos(b.altitudeDeg * rad) * Math.cos((a.azimuthDeg - b.azimuthDeg) * rad)
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / rad
}

/** Conservative, tunable recognition heuristic; not a calibrated limiting magnitude. */
export function recognitionMagnitudeLimit(environment: ObservingEnvironment, moonAltitude: number, moonFraction: number, moonDistance: number, altitude: number): number {
  const base = { urban: 3.6, suburban: 4.8, dark: 6, unknown: 4.2 }[environment]
  const moonPenalty = moonAltitude > 0
    ? moonFraction * Math.min(1, moonAltitude / 30) * (0.25 + 0.9 * Math.max(0, 1 - moonDistance / 90))
    : 0
  const lowAltitudePenalty = Math.max(0, 30 - altitude) / 40
  return base - moonPenalty - lowAltitudePenalty
}

export function intervalMinutes(window: TimeInterval): number {
  return (Date.parse(window.endUtc) - Date.parse(window.startUtc)) / MINUTE
}

/** Boundaries are refined on the actual eligibility predicate, never interpolated scores. */
export function findWindows(times: number[], eligible: boolean[], evaluate: (at: number) => boolean): TimeInterval[] {
  const windows: TimeInterval[] = []
  let start: number | null = eligible[0] ? times[0] : null
  for (let i = 1; i < times.length; i += 1) {
    if (eligible[i] === eligible[i - 1]) continue
    let left = times[i - 1], right = times[i]
    while (right - left > 30_000) {
      const middle = (left + right) / 2
      if (evaluate(middle) === eligible[i - 1]) left = middle
      else right = middle
    }
    if (eligible[i]) start = right
    else if (start !== null) {
      windows.push({ startUtc: new Date(start).toISOString(), endUtc: new Date(left).toISOString() })
      start = null
    }
  }
  if (start !== null) windows.push({ startUtc: new Date(start).toISOString(), endUtc: new Date(times[times.length - 1]).toISOString() })
  return windows.filter((window) => intervalMinutes(window) > 0)
}
