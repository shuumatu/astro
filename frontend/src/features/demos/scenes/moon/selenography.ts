import * as Astronomy from 'astronomy-engine'

/**
 * Selenographic coordinate helpers.
 *
 * The scene renders the Moon as a `THREE.SphereGeometry` carrying an equirectangular map, so
 * every hotspot, the graticule, the terminator and the camera all have to agree on one
 * convention: `u = (lon + 180) / 360` and `v = (90 - lat) / 180`, with the map's top row on
 * the north pole. `lonLatToVector` is the inverse of that mapping for the sphere's vertices,
 * which is why the sign pattern below looks the way it does.
 *
 * Longitude is positive east (IAU), matching the LROC mosaic: Mare Crisium at 59 deg E sits on
 * the right-hand limb as seen from Earth's northern hemisphere.
 */

const DEGREES_TO_RADIANS = Math.PI / 180
const RADIANS_TO_DEGREES = 180 / Math.PI

/** Point on the lunar surface in the body-fixed frame that IAU cartography uses. */
export interface SelenographicPoint {
  latDeg: number
  lonDeg: number
}

export interface Vector3Like {
  x: number
  y: number
  z: number
}

/** Position of `lonDeg`/`latDeg` on a sphere of `radius`, in the scene's world frame. */
export function lonLatToVector(lonDeg: number, latDeg: number, radius = 1): Vector3Like {
  const phi = (lonDeg + 180) * DEGREES_TO_RADIANS
  const theta = (90 - latDeg) * DEGREES_TO_RADIANS
  const sinTheta = Math.sin(theta)
  return {
    x: -radius * Math.cos(phi) * sinTheta,
    y: radius * Math.cos(theta),
    z: radius * Math.sin(phi) * sinTheta,
  }
}

/** Inverse of {@link lonLatToVector}. Accepts any non-zero vector. */
export function vectorToLonLat(vector: Vector3Like): SelenographicPoint {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length === 0) return { latDeg: 0, lonDeg: 0 }
  const latDeg = 90 - Math.acos(clamp(vector.y / length, -1, 1)) * RADIANS_TO_DEGREES
  const lonDeg = wrapLongitude(Math.atan2(vector.z, -vector.x) * RADIANS_TO_DEGREES - 180)
  return { latDeg, lonDeg }
}

export function wrapLongitude(lonDeg: number): number {
  // Normalised to [-180, 180): the antimeridian is a single meridian, so +180 folds onto -180
  // and the whole globe stays a half-open interval.
  return ((lonDeg + 180) % 360 + 360) % 360 - 180
}

/** Meridian of the Moon's rotation, expressed in the J2000 equatorial frame. */
export interface MoonFrame {
  north: Vector3Like
  prime: Vector3Like
  east: Vector3Like
}

/**
 * Builds the Moon's body-fixed frame from the IAU rotation model astronomy-engine implements:
 * `spin` is the angle from the equator's J2000 ascending node to the prime meridian.
 */
export function moonFrame(date: Date): MoonFrame {
  const axis = Astronomy.RotationAxis(Astronomy.Body.Moon, date)
  const north = normalize({ x: axis.north.x, y: axis.north.y, z: axis.north.z })
  const node = normalize(cross({ x: 0, y: 0, z: 1 }, north))
  const prime = normalize(rotateAround(node, north, axis.spin * DEGREES_TO_RADIANS))
  return { north, prime, east: normalize(cross(north, prime)) }
}

/** Selonographic longitude and latitude of an inertial direction. */
export function toSelenographic(direction: Vector3Like, frame: MoonFrame): SelenographicPoint {
  const unit = normalize(direction)
  return {
    latDeg: Math.asin(clamp(dot(unit, frame.north), -1, 1)) * RADIANS_TO_DEGREES,
    lonDeg: wrapLongitude(Math.atan2(dot(unit, frame.east), dot(unit, frame.prime)) * RADIANS_TO_DEGREES),
  }
}

/**
 * Where the Sun stands overhead on the Moon. Unlike a simple elongation formula this follows
 * the real rotation model, so the terminator matches the sky to about a degree — including the
 * +-1.54 deg wobble of the sub-solar latitude across the year.
 */
export function subSolarPoint(date: Date): SelenographicPoint {
  const time = Astronomy.MakeTime(date)
  const sun = Astronomy.GeoVector(Astronomy.Body.Sun, time, false)
  const moon = Astronomy.GeoVector(Astronomy.Body.Moon, time, false)
  const toSun = { x: sun.x - moon.x, y: sun.y - moon.y, z: sun.z - moon.z }
  return toSelenographic(toSun, moonFrame(date))
}

export interface MoonPhase {
  /** Sun-Moon-Earth angle in degrees: 0 at full moon, 180 at new moon. */
  phaseAngleDeg: number
  /** Lit fraction of the Earth-facing hemisphere, 0 to 1. */
  illuminatedFraction: number
}

export function moonPhase(date: Date): MoonPhase {
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, Astronomy.MakeTime(date))
  return {
    phaseAngleDeg: illumination.phase_angle,
    illuminatedFraction: illumination.phase_fraction,
  }
}

/**
 * Next instant the Sun and Moon reach `targetLonDeg` of ecliptic separation:
 * 0 = new moon, 90 = first quarter, 180 = full moon, 270 = last quarter.
 */
export function searchMoonPhase(targetLonDeg: number, from: Date, limitDays = 40): Date | null {
  const found = Astronomy.SearchMoonPhase(targetLonDeg, from, limitDays)
  return found ? found.date : null
}

/** Kilometres along the surface per degree of latitude, at the Moon's mean radius. */
export const KILOMETRES_PER_DEGREE = (2 * Math.PI * 1737.4) / 360

/** Equirectangular texel size of the surface map, in kilometres at the equator. */
export function texelKilometres(textureWidthPx: number): number {
  return (KILOMETRES_PER_DEGREE * 360) / Math.max(textureWidthPx, 1)
}

/**
 * Closest the camera should come to the surface, given what the imagery can actually resolve.
 *
 * At altitude `h` the viewport covers `2 h tan(fov/2)` kilometres, so the camera stops once that
 * would stretch a single texel across `maxScreenPixelsPerTexel` screen pixels. Zooming past that
 * reveals nothing new, it only makes the surface look soft — so the camera simply refuses, the
 * way a map application stops zooming when it runs out of detail.
 */
export function minimumAltitudeForTexel(
  texelKm: number,
  viewportHeightPx: number,
  fieldOfViewDeg: number,
  maxScreenPixelsPerTexel: number,
): number {
  const groundHeightKm =
    (Math.max(viewportHeightPx, 1) * Math.max(texelKm, 1e-6)) / maxScreenPixelsPerTexel
  return groundHeightKm / (2 * Math.tan((fieldOfViewDeg / 2) * DEGREES_TO_RADIANS))
}

/** Same limit for the whole-globe atlas, whose texel size follows from its width. */
export function minimumAltitudeKm(
  textureWidthPx: number,
  viewportHeightPx: number,
  fieldOfViewDeg: number,
  maxScreenPixelsPerTexel: number,
): number {
  return minimumAltitudeForTexel(
    texelKilometres(textureWidthPx),
    viewportHeightPx,
    fieldOfViewDeg,
    maxScreenPixelsPerTexel,
  )
}

export function degreesBetween(a: Vector3Like, b: Vector3Like): number {
  const cosine = clamp(dot(normalize(a), normalize(b)), -1, 1)
  return Math.acos(cosine) * RADIANS_TO_DEGREES
}

export function normalize(vector: Vector3Like): Vector3Like {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

export function dot(a: Vector3Like, b: Vector3Like): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function cross(a: Vector3Like, b: Vector3Like): Vector3Like {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function rotateAround(vector: Vector3Like, axis: Vector3Like, radians: number): Vector3Like {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const axisCross = cross(axis, vector)
  const axisDot = dot(axis, vector) * (1 - cos)
  return {
    x: vector.x * cos + axisCross.x * sin + axis.x * axisDot,
    y: vector.y * cos + axisCross.y * sin + axis.y * axisDot,
    z: vector.z * cos + axisCross.z * sin + axis.z * axisDot,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
