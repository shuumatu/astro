import { DEG, PRECESSION_PERIOD, horizontal, visibility, wrap, type AstronomyState } from './model'

export interface AltitudeSample {
  /** Local sidereal hours; the final point retains 24 to close the chart. */
  lst: number
  altitude: number
}

export interface AstronomyInsights {
  /** Signed sidereal hours: negative east of the meridian, positive west. */
  hourAngle: number
  altitude: number
  azimuth: number | null
  visibility: ReturnType<typeof visibility>
  horizonStatus: 'above' | 'on' | 'below'
  aboveHorizon: boolean
  upperAltitude: number
  lowerAltitude: number
  upperTransit: number
  lowerTransit: number
  /** Sidereal hours strictly above the geometric horizon (no refraction). */
  visibleHours: number
  /** Crossing times in local sidereal hours; null for tangency or no crossing. */
  rise: number | null
  set: number | null
  poleAltitude: number
  precessionProgress: number
  precessionAngle: number
  altitudeCurve: AltitudeSample[]
}

const cleanZero = (value: number) => Math.abs(value) < 1e-9 ? 0 : value

/** One sidereal rotation of a fixed equatorial direction, including both ends. */
export function dailyAltitudeCurve(ra: number, dec: number, latitude: number): AltitudeSample[] {
  return Array.from({ length: 97 }, (_, index) => {
    const lst = index / 4
    return { lst, altitude: cleanZero(horizontal(ra, dec, latitude, lst).altitude) }
  })
}

/**
 * Geometric teaching readouts; all time fields use local sidereal hours, not civil time.
 * Hour-angle and altitude conventions follow USNO:
 * https://aa.usno.navy.mil/faq/alt_az
 * Solve sin(h) = sin(phi) sin(dec) + cos(phi) cos(dec) cos(H) at h = 0
 * for crossings. Treat poles and horizon tangencies separately to avoid division by zero.
 */
export function getAstronomyInsights(state: AstronomyState): AstronomyInsights {
  const { latitude, ra, dec, lst, years } = state
  const position = horizontal(ra, dec, latitude, lst)
  const altitude = cleanZero(position.altitude)
  const kind = visibility(latitude, dec)
  const a = Math.sin(latitude * DEG) * Math.sin(dec * DEG)
  const b = Math.cos(latitude * DEG) * Math.cos(dec * DEG)
  let visibleHours = 0
  let rise: number | null = null
  let set: number | null = null
  if (kind === 'circumpolar') visibleHours = 24
  else if (kind === 'grazing') {
    // A lower tangency remains above except for one instant. Upper tangency,
    // and a direction fixed on the horizon, have no time strictly above it.
    visibleHours = a > 1e-10 ? 24 : 0
  } else if (kind === 'rises') {
    const crossingHourAngle = Math.acos(Math.max(-1, Math.min(1, -a / b))) / DEG / 15
    visibleHours = 2 * crossingHourAngle
    rise = wrap(ra - crossingHourAngle, 24)
    set = wrap(ra + crossingHourAngle, 24)
  }
  const precessionProgress = Math.max(0, Math.min(1, years / PRECESSION_PERIOD))
  return {
    hourAngle: cleanZero(wrap(lst - ra + 12, 24) - 12),
    altitude,
    azimuth: position.azimuth,
    visibility: kind,
    horizonStatus: altitude > 0 ? 'above' : altitude < 0 ? 'below' : 'on',
    aboveHorizon: altitude > 0,
    upperAltitude: cleanZero(90 - Math.abs(latitude - dec)),
    lowerAltitude: cleanZero(Math.abs(latitude + dec) - 90),
    upperTransit: wrap(ra, 24),
    lowerTransit: wrap(ra + 12, 24),
    visibleHours,
    rise,
    set,
    poleAltitude: Math.abs(latitude),
    precessionProgress,
    precessionAngle: precessionProgress * 360,
    altitudeCurve: dailyAltitudeCurve(ra, dec, latitude),
  }
}
