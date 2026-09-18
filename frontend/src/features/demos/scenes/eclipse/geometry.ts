import * as THREE from 'three'
import type { EclipseEventKind, EclipseSection, EclipseSkyOffset } from './types'

/**
 * The eclipse demo's mathematics, with no renderer and no clock in it.
 *
 * Everything here is a pure function of real radii, real distances and real angles, which is what
 * lets the interesting claims - that an umbra closes at a definite distance, that the Earth's umbra
 * is 2.65 Moon radii across at the Moon, that totality needs the two discs to nest - be tested
 * without a browser.
 */

const DEGREES_TO_RADIANS = Math.PI / 180
const RADIANS_TO_DEGREES = 180 / Math.PI

/**
 * The shadow a body casts: a cone of full shadow that closes at a definite distance, wrapped in a
 * cone of partial shadow that only widens.
 *
 * Both come from the same two tangents to the Sun and the body, so the umbra's length is not a
 * separate quantity to be tuned - it falls out of the radii and the distance, which is exactly why
 * the Moon's umbra sometimes reaches the Earth and sometimes does not.
 */
export interface ShadowCone {
  /** Real distance from the body's centre to the umbra's apex, in kilometres. */
  umbraLengthKm: number
  /** Half-angle of the umbra cone, degrees. Negative once the cone has closed. */
  umbraHalfAngleDeg: number
  /** Half-angle of the penumbra cone, degrees. */
  penumbraHalfAngleDeg: number
  /** Real radius of the umbra at a distance from the body's centre; negative past the apex. */
  umbraRadiusAtKm(distanceKm: number): number
  /** Real radius of the penumbra at a distance from the body's centre. */
  penumbraRadiusAtKm(distanceKm: number): number
  /**
   * Real radius of the antumbra, the widening region past the umbra's apex where the body covers
   * only the middle of the Sun. Zero or negative before the apex.
   */
  antumbraRadiusAtKm(distanceKm: number): number
}

export interface ShadowConeInput {
  sunRadiusKm: number
  bodyRadiusKm: number
  /** Distance from the Sun's centre to the body's centre, in kilometres. */
  sunToBodyKm: number
}

export function createShadowCone(input: ShadowConeInput): ShadowCone {
  const { sunRadiusKm, bodyRadiusKm, sunToBodyKm } = input
  if (!(bodyRadiusKm > 0) || !(sunRadiusKm > bodyRadiusKm) || !(sunToBodyKm > 0)) {
    throw new Error('A shadow cone needs a positive body inside a larger Sun at a positive distance')
  }
  const convergence = (sunRadiusKm - bodyRadiusKm) / sunToBodyKm
  const divergence = (sunRadiusKm + bodyRadiusKm) / sunToBodyKm
  const umbraLengthKm = bodyRadiusKm / convergence

  return {
    umbraLengthKm,
    umbraHalfAngleDeg: -Math.atan(convergence) * RADIANS_TO_DEGREES,
    penumbraHalfAngleDeg: Math.atan(divergence) * RADIANS_TO_DEGREES,
    umbraRadiusAtKm: (distanceKm) => bodyRadiusKm - distanceKm * convergence,
    penumbraRadiusAtKm: (distanceKm) => bodyRadiusKm + distanceKm * divergence,
    antumbraRadiusAtKm: (distanceKm) => distanceKm * convergence - bodyRadiusKm,
  }
}

/**
 * The area two discs share, by the standard lens formula. Used for the fraction of a disc that a
 * covering disc hides, which is what "obscuration" means for a partial eclipse.
 */
export function circleOverlapArea(radiusA: number, radiusB: number, centreDistance: number): number {
  if (!(radiusA > 0) || !(radiusB > 0)) return 0
  if (centreDistance >= radiusA + radiusB) return 0
  if (centreDistance <= Math.abs(radiusA - radiusB)) return Math.PI * Math.min(radiusA, radiusB) ** 2

  const a = radiusA * radiusA
  const b = radiusB * radiusB
  const d = centreDistance
  const first = a * Math.acos((d * d + a - b) / (2 * d * radiusA))
  const second = b * Math.acos((d * d + b - a) / (2 * d * radiusB))
  const triangle = 0.5 * Math.sqrt(Math.max(0, (-d + radiusA + radiusB) * (d + radiusA - radiusB)
    * (d - radiusA + radiusB) * (d + radiusA + radiusB)))
  return first + second - triangle
}

/**
 * Fraction of the covered disc that the covering disc hides, 0 to 1.
 *
 * When the coverer is the larger disc and fully contains the other, the answer is exactly 1: a
 * total eclipse hides all of it. When it is the smaller one, it can never exceed the ratio of the
 * areas, which is what makes an annular eclipse read as "0.86 of the Sun" rather than "eclipsed".
 */
export function obscurationFraction(
  coveredRadius: number,
  covererRadius: number,
  centreDistance: number,
): number {
  if (!(coveredRadius > 0)) return 0
  if (centreDistance <= Math.abs(coveredRadius - covererRadius)) {
    return Math.min(1, (covererRadius * covererRadius) / (coveredRadius * coveredRadius))
  }
  return circleOverlapArea(coveredRadius, covererRadius, centreDistance)
    / (Math.PI * coveredRadius * coveredRadius)
}

/** Apparent angular radius of a sphere, degrees. `asin`, not `atan`: the disc's edge is a tangent. */
export function angularRadiusDeg(radiusKm: number, distanceKm: number): number {
  if (!(distanceKm > 0)) return 0
  return Math.asin(Math.min(1, Math.max(-1, radiusKm / distanceKm))) * RADIANS_TO_DEGREES
}

/** Angle between two directions, degrees. The vectors need not be unit length. */
export function angleBetweenDeg(a: THREE.Vector3, b: THREE.Vector3): number {
  const denominator = a.length() * b.length()
  if (denominator === 0) return 0
  const cosine = Math.min(1, Math.max(-1, a.dot(b) / denominator))
  return Math.acos(cosine) * RADIANS_TO_DEGREES
}

export interface LunarEclipseInput {
  /** Distance from the Moon's centre to the axis of the Earth's shadow, kilometres. */
  moonAxisDistanceKm: number
  moonRadiusKm: number
  /** Radius of the Earth's umbra where the Moon is; negative once the cone has closed. */
  umbraRadiusKm: number
  penumbraRadiusKm: number
}

/**
 * What the Earth's shadow is doing to the Moon.
 *
 * The three cases are three different questions about the same two circles: does the Moon clear the
 * penumbra at all, does it reach the umbra, and does the umbra swallow it whole. `none` is the
 * honest answer for most of the Moon's month and most of an eclipse's own window.
 */
export function classifyLunarEclipse(input: LunarEclipseInput): EclipseEventKind {
  const { moonAxisDistanceKm, moonRadiusKm, umbraRadiusKm, penumbraRadiusKm } = input
  if (umbraRadiusKm > 0 && moonAxisDistanceKm + moonRadiusKm <= umbraRadiusKm) return 'total'
  if (umbraRadiusKm > 0 && moonAxisDistanceKm < umbraRadiusKm + moonRadiusKm) return 'partial'
  if (moonAxisDistanceKm < penumbraRadiusKm + moonRadiusKm) return 'penumbral'
  return 'none'
}

export interface SolarEclipseInput {
  /** Angle between the centres of the two discs, degrees. */
  separationDeg: number
  sunAngularRadiusDeg: number
  moonAngularRadiusDeg: number
}

/**
 * What the Moon is doing to the Sun, as seen from one place.
 *
 * The total/annular split is decided by which disc is bigger, not by how well they are lined up:
 * a perfectly centred Moon that is too far away leaves a ring, and that ring is an annular eclipse.
 */
export function classifySolarEclipse(input: SolarEclipseInput): EclipseEventKind {
  const { separationDeg, sunAngularRadiusDeg, moonAngularRadiusDeg } = input
  if (separationDeg >= sunAngularRadiusDeg + moonAngularRadiusDeg) return 'none'
  if (separationDeg <= Math.abs(sunAngularRadiusDeg - moonAngularRadiusDeg)) {
    return moonAngularRadiusDeg >= sunAngularRadiusDeg ? 'total' : 'annular'
  }
  return 'partial'
}

export interface EclipsePhaseWindow {
  startMs: number
  endMs: number
}

export interface LunarPhaseWindows {
  penumbral: EclipsePhaseWindow | null
  partial: EclipsePhaseWindow | null
  total: EclipsePhaseWindow | null
}

export interface LunarPhaseWindowInput {
  peakMs: number
  /** astronomy-engine's semi-durations, in minutes; zero when the eclipse never reaches that phase. */
  penumbralSemiDurationMinutes: number
  partialSemiDurationMinutes: number
  totalSemiDurationMinutes: number
}

function windowAround(peakMs: number, semiDurationMinutes: number): EclipsePhaseWindow | null {
  if (!(semiDurationMinutes > 0)) return null
  const half = semiDurationMinutes * 60_000
  return { startMs: peakMs - half, endMs: peakMs + half }
}

/**
 * The four contacts of a lunar eclipse, as windows around the peak.
 *
 * A zero semi-duration means the eclipse never reaches that phase, and the window is null rather
 * than a zero-length one: the difference between "totality lasted no time" and "there was no
 * totality" is exactly what tells a partial eclipse from a total one.
 */
export function lunarPhaseWindows(input: LunarPhaseWindowInput): LunarPhaseWindows {
  return {
    penumbral: windowAround(input.peakMs, input.penumbralSemiDurationMinutes),
    partial: windowAround(input.peakMs, input.partialSemiDurationMinutes),
    total: windowAround(input.peakMs, input.totalSemiDurationMinutes),
  }
}

export interface SolarPhaseWindows {
  /** Always present: every solar eclipse has a partial phase. */
  partial: EclipsePhaseWindow
  /** The total or annular phase, when the eclipse reaches one. */
  central: EclipsePhaseWindow | null
}

export interface SolarPhaseWindowInput {
  partialBeginMs: number
  partialEndMs: number
  /** Both undefined for a partial-only eclipse. */
  centralBeginMs?: number
  centralEndMs?: number
}

export function solarPhaseWindows(input: SolarPhaseWindowInput): SolarPhaseWindows {
  const hasCentral = typeof input.centralBeginMs === 'number' && typeof input.centralEndMs === 'number'
  return {
    partial: { startMs: input.partialBeginMs, endMs: input.partialEndMs },
    central: hasCentral
      ? { startMs: input.centralBeginMs as number, endMs: input.centralEndMs as number }
      : null,
  }
}

/** Widens a window by a fixed amount on both sides, for a scrubber that can leave the event. */
export function padWindow(window: EclipsePhaseWindow, paddingMs: number): EclipsePhaseWindow {
  return { startMs: window.startMs - paddingMs, endMs: window.endMs + paddingMs }
}

/** A direction in the ecliptic frame, from the angles astronomy-engine reports. */
export function eclipticToVector(longitudeDeg: number, latitudeDeg: number, distance = 1): THREE.Vector3 {
  const longitude = longitudeDeg * DEGREES_TO_RADIANS
  const latitude = latitudeDeg * DEGREES_TO_RADIANS
  const flat = Math.cos(latitude) * distance
  return new THREE.Vector3(flat * Math.cos(longitude), flat * Math.sin(longitude), distance * Math.sin(latitude))
}

export interface OrbitPlaneBasis {
  /** Unit vector along the ascending node, in the ecliptic plane. */
  ascendingNode: THREE.Vector3
  /** The other node, opposite the first. */
  descendingNode: THREE.Vector3
  /** Unit vector in the orbital plane, 90 degrees ahead of the ascending node. */
  inPlane: THREE.Vector3
  /** Unit normal of the orbital plane, tilted from ecliptic north by the inclination. */
  normal: THREE.Vector3
}

/**
 * The Moon's orbital plane, from its inclination and where its ascending node sits.
 *
 * The plane is fixed by those two numbers and nothing else: it always contains the node line, which
 * always lies in the ecliptic. At zero inclination it *is* the ecliptic, which is the whole point of
 * the lesson switch - and it is why the switch changes the drawn plane rather than the Moon.
 */
export function orbitPlaneBasis(inclinationDeg: number, ascendingNodeLongitudeDeg: number): OrbitPlaneBasis {
  const node = ascendingNodeLongitudeDeg * DEGREES_TO_RADIANS
  const inclination = inclinationDeg * DEGREES_TO_RADIANS
  const ascendingNode = new THREE.Vector3(Math.cos(node), Math.sin(node), 0)
  const inPlane = new THREE.Vector3(
    -Math.sin(node) * Math.cos(inclination),
    Math.cos(node) * Math.cos(inclination),
    Math.sin(inclination),
  )
  return {
    ascendingNode,
    descendingNode: ascendingNode.clone().negate(),
    inPlane,
    normal: new THREE.Vector3().crossVectors(ascendingNode, inPlane).normalize(),
  }
}

/** The two ecliptic longitudes where the Moon's orbit meets the ecliptic. */
export function nodeLongitudes(ascendingNodeLongitudeDeg: number): [number, number] {
  const ascending = ((ascendingNodeLongitudeDeg % 360) + 360) % 360
  return [ascending, (ascending + 180) % 360]
}

export interface SkyBasis {
  /** The direction the viewer is looking, which is the centre of the picture. */
  forward: THREE.Vector3
  right: THREE.Vector3
  up: THREE.Vector3
}

/**
 * A screen-like frame at right angles to a viewing direction, so a second direction can be placed
 * on a picture. The hint only chooses the roll; it need not be perpendicular to `forward`.
 */
export function skyBasis(forward: THREE.Vector3, upHint: THREE.Vector3): SkyBasis {
  const look = forward.clone().normalize()
  let up = upHint.clone()
  if (up.lengthSq() === 0 || Math.abs(up.clone().normalize().dot(look)) > 1 - 1e-9) {
    up = new THREE.Vector3(0, 0, 1)
    if (Math.abs(up.dot(look)) > 1 - 1e-9) up = new THREE.Vector3(0, 1, 0)
  }
  const right = new THREE.Vector3().crossVectors(up, look).normalize()
  return { forward: look, right, up: new THREE.Vector3().crossVectors(look, right).normalize() }
}

/**
 * Where a direction sits in the sky frame, in degrees, with `x` to the right and `y` up.
 *
 * A gnomonic projection rather than a naive dot product: the two agree to a hundredth of a degree
 * over the few degrees an eclipse spans, but the tangent form stays correct if it is ever asked
 * about something wider.
 */
export function projectSkyOffsetDeg(direction: THREE.Vector3, basis: SkyBasis): EclipseSkyOffset {
  const along = direction.dot(basis.forward)
  if (along <= 0) return { x: 0, y: 0 }
  return {
    x: Math.atan2(direction.dot(basis.right), along) * RADIANS_TO_DEGREES,
    y: Math.atan2(direction.dot(basis.up), along) * RADIANS_TO_DEGREES,
  }
}

/** Converts a real radius into scene units, using the factor that drew the body it belongs to. */
export function displayRadialScale(displayRadius: number, realRadiusKm: number): number {
  return displayRadius / realRadiusKm
}

/** Converts a real length into scene units, using the factor that drew the distance it spans. */
export function displayAxialScale(displayDistance: number, realDistanceKm: number): number {
  if (!(realDistanceKm > 0)) return 0
  return displayDistance / realDistanceKm
}

export interface DisplayShadowCone {
  /** Display length of the umbra, from the caster's centre along its axis. */
  length: number
  /** Display radius at the caster's centre, which is the caster's own drawn radius. */
  baseRadius: number
  /** Display radius where the umbra stops: at the target, or at the apex if it closes first. */
  farRadius: number
  /** True when the umbra closes before the target, so only the antumbra reaches it. */
  antumbra: boolean
  /** Display length of the antumbra past the apex; zero unless `antumbra`. */
  antumbraLength: number
  /** Display radius of the antumbra where the target sits; zero unless `antumbra`. */
  antumbraFarRadius: number
  /** Display length of the penumbra, which always spans the whole gap. */
  penumbraLength: number
  /** Display radius of the penumbra where the target sits. */
  penumbraFarRadius: number
}

export interface DisplayShadowConeInput {
  cone: ShadowCone
  /** The caster's drawn radius, in scene units. */
  casterDisplayRadius: number
  /** The caster's real radius, kilometres. Its drawn radius divided by this is the radial scale. */
  casterRadiusKm: number
  /** Display distance from the caster's centre to the target's centre. */
  displayTargetDistance: number
  /** Real distance from the caster's centre to the target's centre, kilometres. */
  realTargetDistanceKm: number
}

/**
 * Maps a real shadow cone into the schematic display.
 *
 * The two axes are scaled by different factors and that is the point: radii use the body's own
 * drawn size, lengths use the compressed distance. So the umbra still closes exactly where it
 * really does - relative to the gap it has to cross - while its radii stay comparable to the discs
 * the viewer can actually see. Without the split either the cone is invisible or the total/annular
 * distinction disappears.
 */
export function displayShadowCone(input: DisplayShadowConeInput): DisplayShadowCone {
  const radial = displayRadialScale(input.casterDisplayRadius, input.casterRadiusKm)
  const axial = displayAxialScale(input.displayTargetDistance, input.realTargetDistanceKm)
  const realLength = Math.min(input.cone.umbraLengthKm, input.realTargetDistanceKm)
  const closesEarly = input.cone.umbraLengthKm < input.realTargetDistanceKm

  const farRealRadius = input.cone.umbraRadiusAtKm(input.realTargetDistanceKm)
  return {
    length: realLength * axial,
    baseRadius: input.casterDisplayRadius,
    farRadius: Math.max(0, farRealRadius) * radial,
    antumbra: closesEarly,
    antumbraLength: closesEarly ? (input.realTargetDistanceKm - input.cone.umbraLengthKm) * axial : 0,
    antumbraFarRadius: closesEarly
      ? Math.max(0, input.cone.antumbraRadiusAtKm(input.realTargetDistanceKm)) * radial
      : 0,
    penumbraLength: input.displayTargetDistance,
    penumbraFarRadius: input.cone.penumbraRadiusAtKm(input.realTargetDistanceKm) * radial,
  }
}

/** The section a command switches to, which is always the other one. */
export function otherSection(section: EclipseSection): EclipseSection {
  return section === 'solar' ? 'lunar' : 'solar'
}

/** An observer offset from an eclipse's peak point, in degrees. */
export interface ObserverOffset {
  latitudeOffsetDeg: number
  longitudeOffsetDeg: number
}

/**
 * The nearest observer offset that sees a partial eclipse.
 *
 * Walks outwards in steps and takes the first candidate that reports one, so the observer ends up as
 * close to the central path as it can be while still losing totality. How far off the path you have
 * to stand depends on the eclipse and on which way the path runs, which is why this is a search
 * rather than a formula - and why the answer is not something the event list can offer, since a
 * partial eclipse is a property of where you stand rather than of the event.
 *
 * The lookup is a callback, so the walk itself can be tested without a scene, a renderer or an
 * ephemeris. It returns null when nothing inside the limit reports a partial eclipse, which is the
 * honest answer for an observer who cannot reach one.
 */
export function findPartialOffset(
  kindAt: (latitudeOffsetDeg: number, longitudeOffsetDeg: number) => EclipseEventKind | null,
  stepDeg: number,
  limitDeg: number,
): ObserverOffset | null {
  if (!(stepDeg > 0) || !(limitDeg > 0)) return null
  const steps = Math.floor(limitDeg / stepDeg + 1e-9)
  for (let index = 1; index <= steps; index += 1) {
    const radius = index * stepDeg
    // North, east, south, west: a ring rather than a line, because a path can run either way.
    const ring: ObserverOffset[] = [
      { latitudeOffsetDeg: radius, longitudeOffsetDeg: 0 },
      { latitudeOffsetDeg: 0, longitudeOffsetDeg: radius },
      { latitudeOffsetDeg: -radius, longitudeOffsetDeg: 0 },
      { latitudeOffsetDeg: 0, longitudeOffsetDeg: -radius },
    ]
    for (const candidate of ring) {
      if (kindAt(candidate.latitudeOffsetDeg, candidate.longitudeOffsetDeg) === 'partial') return candidate
    }
  }
  return null
}
