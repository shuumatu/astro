import * as Astronomy from 'astronomy-engine'
import * as THREE from 'three'
import {
  BODY_RADIUS_KM,
  MOON_ORBIT_INCLINATION_DEG,
  SECTION_MODEL,
} from './config'
import {
  angleBetweenDeg,
  angularRadiusDeg,
  classifyLunarEclipse,
  classifySolarEclipse,
  createShadowCone,
  obscurationFraction,
  projectSkyOffsetDeg,
  skyBasis,
  type ShadowCone,
} from './geometry'
import type { EclipseEventKind, EclipseEventSummary, EclipseSection, EclipseSkyOffset } from './types'

/**
 * Every real number the eclipse demo uses, and the only file that talks to astronomy-engine.
 *
 * Nothing here is hand-rolled: the eclipse times, the peak coordinates, the local contact times
 * and the positions all come from the same library, so the demo cannot disagree with itself about
 * when an eclipse happens or where it is. What the demo adds on top is geometry - the shadow cones
 * and the classification - which is a pure function of these numbers.
 */

const KM_PER_AU = Astronomy.KM_PER_AU

/** A geographic point, in degrees. */
export interface ObserverPosition {
  latitudeDeg: number
  longitudeDeg: number
}

/** Where the Sun and the Moon are, and how far away, at one instant. */
export interface GeocentricState {
  /** Sun's position relative to the Earth's centre, in the ecliptic frame, kilometres. */
  sunFromEarthKm: THREE.Vector3
  /** Moon's position relative to the Earth's centre, in the ecliptic frame, kilometres. */
  moonFromEarthKm: THREE.Vector3
  /** Unit vector from the Earth towards the Sun. */
  sunDirection: THREE.Vector3
  /** Sun's distance from the Earth, kilometres. */
  sunDistanceKm: number
  /** Moon's distance from the Earth, kilometres. */
  moonDistanceKm: number
  /** Moon's apparent ecliptic longitude and latitude, degrees, as astronomy-engine reports them. */
  moonEclipticLongitudeDeg: number
  moonEclipticLatitudeDeg: number
}

/** A vector astronomy-engine reports in J2000 equatorial coordinates, as a three.js vector. */
function toVector(vector: Astronomy.Vector): THREE.Vector3 {
  return new THREE.Vector3(vector.x, vector.y, vector.z)
}

/** The same vector in the ecliptic frame, where the Earth's orbital plane is the xy plane. */
function toEclipticVector(vector: Astronomy.Vector): THREE.Vector3 {
  return toVector(Astronomy.Ecliptic(vector).vec)
}

/** A direction given in J2000 equatorial coordinates, rotated into the ecliptic frame. */
function toEclipticDirection(direction: THREE.Vector3, time: Astronomy.AstroTime): THREE.Vector3 {
  const vector = new Astronomy.Vector(direction.x, direction.y, direction.z, time)
  return toEclipticVector(vector).normalize()
}

export function geocentricState(timeMs: number): GeocentricState {
  const time = new Astronomy.AstroTime(new Date(timeMs))
  const sun = Astronomy.GeoVector(Astronomy.Body.Sun, time, true)
  const moon = Astronomy.GeoVector(Astronomy.Body.Moon, time, true)
  const sunFromEarthKm = toEclipticVector(sun).multiplyScalar(KM_PER_AU)
  const moonFromEarthKm = toEclipticVector(moon).multiplyScalar(KM_PER_AU)
  const moonEcliptic = Astronomy.EclipticGeoMoon(time)
  return {
    sunFromEarthKm,
    moonFromEarthKm,
    sunDirection: sunFromEarthKm.clone().normalize(),
    sunDistanceKm: sunFromEarthKm.length(),
    moonDistanceKm: moonFromEarthKm.length(),
    moonEclipticLongitudeDeg: moonEcliptic.lon,
    moonEclipticLatitudeDeg: moonEcliptic.lat,
  }
}

/** Which body each section's shadow is cast by, and how far apart the pair is at one instant. */export interface SectionShadowGeometry {
  cone: ShadowCone
  /** Real distance from the caster's centre to the target's centre, kilometres. */
  casterToTargetKm: number
  /** Radius of the umbra where the target's centre sits; negative once the cone has closed. */
  umbraRadiusAtTargetKm: number
  /** Radius of the penumbra where the target's centre sits. */
  penumbraRadiusAtTargetKm: number
  /** Real radius of the casting body. */
  casterRadiusKm: number
  /** Real radius of the body the shadow falls on. */
  targetRadiusKm: number
}

export function sectionShadowGeometry(section: EclipseSection, state: GeocentricState): SectionShadowGeometry {
  const model = SECTION_MODEL[section]
  const casterRadiusKm = model.casterRadiusKm
  // Both sections cast their shadow away from the Sun, so the caster's distance from the Sun is
  // what sets the cone's shape. The Moon's own orbit is small enough to ignore in that distance.
  const sunToCasterKm = section === 'lunar'
    ? state.sunDistanceKm
    : Math.hypot(state.sunDistanceKm, state.moonDistanceKm * 0)
  const casterToTargetKm = section === 'lunar' ? state.moonDistanceKm : state.moonDistanceKm
  const cone = createShadowCone({
    sunRadiusKm: BODY_RADIUS_KM.sun,
    bodyRadiusKm: casterRadiusKm,
    sunToBodyKm: sunToCasterKm,
  })
  return {
    cone,
    casterToTargetKm,
    umbraRadiusAtTargetKm: cone.umbraRadiusAtKm(casterToTargetKm),
    penumbraRadiusAtTargetKm: cone.penumbraRadiusAtKm(casterToTargetKm),
    casterRadiusKm,
    targetRadiusKm: model.targetRadiusKm,
  }
}

/** Everything the lunar section needs about one instant. */
export interface LunarGeometry {
  state: GeocentricState
  shadow: SectionShadowGeometry
  /** Distance from the Moon's centre to the axis of the Earth's shadow, kilometres. */
  axisDistanceKm: number
  /** Apparent angular radius of the Moon, degrees. */
  moonAngularRadiusDeg: number
  /** Apparent angular radius of the Earth's umbra at the Moon, degrees. */
  umbraAngularRadiusDeg: number
  /** Apparent angular radius of the Earth's penumbra at the Moon, degrees. */
  penumbraAngularRadiusDeg: number
  /** Where the Moon's centre sits relative to the shadow axis, degrees. */
  skyOffsetDeg: EclipseSkyOffset
  /** Fraction of the Moon's disc inside the umbra, 0-1. */
  umbraCoverage: number
  kind: EclipseEventKind
}

/**
 * The lunar section's geometry at one instant.
 *
 * The shadow axis is the anti-solar direction from the Earth's centre, and the Moon's distance
 * from that axis is a plain vector rejection - no ephemeris of its own. The ecliptic north pole
 * sets the picture's roll so the Moon is always seen crossing the shadow the same way round.
 */
export function lunarGeometryAt(timeMs: number): LunarGeometry {
  const state = geocentricState(timeMs)
  const shadow = sectionShadowGeometry('lunar', state)
  const antiSolar = state.sunDirection.clone().negate()
  const moon = state.moonFromEarthKm
  const along = moon.dot(antiSolar)
  const axisDistanceKm = Math.max(0, moon.clone().addScaledVector(antiSolar, -along).length())
  const basis = skyBasis(antiSolar, new THREE.Vector3(0, 0, 1))
  const skyOffsetDeg = projectSkyOffsetDeg(moon.clone().normalize(), basis)

  const kind = classifyLunarEclipse({
    moonAxisDistanceKm: axisDistanceKm,
    moonRadiusKm: shadow.targetRadiusKm,
    umbraRadiusKm: shadow.umbraRadiusAtTargetKm,
    penumbraRadiusKm: shadow.penumbraRadiusAtTargetKm,
  })

  return {
    state,
    shadow,
    axisDistanceKm,
    moonAngularRadiusDeg: angularRadiusDeg(shadow.targetRadiusKm, state.moonDistanceKm),
    umbraAngularRadiusDeg: angularRadiusDeg(
      Math.max(0, shadow.umbraRadiusAtTargetKm),
      state.moonDistanceKm,
    ),
    penumbraAngularRadiusDeg: angularRadiusDeg(
      shadow.penumbraRadiusAtTargetKm,
      state.moonDistanceKm,
    ),
    skyOffsetDeg,
    umbraCoverage: obscurationFraction(
      shadow.targetRadiusKm,
      shadow.umbraRadiusAtTargetKm,
      axisDistanceKm,
    ),
    kind,
  }
}

/** What one observer sees of a solar eclipse at one instant: all of it topocentric. */
export interface ObserverSolarGeometry {
  /** Unit vector from the observer towards the Sun, J2000 equatorial frame. */
  sunDirection: THREE.Vector3
  /** Unit vector from the observer towards the Moon, J2000 equatorial frame. */
  moonDirection: THREE.Vector3
  /** The observer's local zenith, which sets the picture's roll. */
  zenith: THREE.Vector3
  /** Apparent angular radius of the Sun from the observer, degrees. */
  sunAngularRadiusDeg: number
  /** Apparent angular radius of the Moon from the observer, degrees. */
  moonAngularRadiusDeg: number
  /** Angle between the two centres, degrees. */
  separationDeg: number
  /** Where the Moon's centre sits relative to the Sun's, degrees. */
  skyOffsetDeg: EclipseSkyOffset
  /** Height of the Sun above this observer's horizon, degrees. Negative means night. */
  sunAltitudeDeg: number
  /**
   * How much of the Sun's disc the Moon covers geometrically, 0-1.
   *
   * Reported whether or not the Sun is up, because it is the alignment that is being described. The
   * `kind` is what says whether anyone there would see it.
   */
  obscuration: number
  kind: EclipseEventKind
}

/**
 * The solar section's observer view.
 *
 * Topocentric rather than geocentric, and that is not a detail: the Moon is close enough that where
 * you stand on the Earth moves it by up to a degree against the Sun, which is the whole reason a
 * total eclipse is visible from a strip a few hundred kilometres wide and nowhere else. The
 * library's own observer-corrected positions supply that parallax; the demo only turns the two
 * directions into a picture.
 *
 * The horizon is part of the answer. An observer on the far side of the Earth can have the Moon
 * lined up against the Sun's disc and still see nothing at all, because the Sun is under their
 * feet - so a below-horizon Sun is reported as no eclipse, with the geometric obscuration kept
 * alongside it for anything that wants to say why.
 */
export function observerSolarGeometryAt(timeMs: number, observer: ObserverPosition): ObserverSolarGeometry {
  const time = new Astronomy.AstroTime(new Date(timeMs))
  const site = new Astronomy.Observer(observer.latitudeDeg, observer.longitudeDeg, 0)
  const sun = Astronomy.Equator(Astronomy.Body.Sun, time, site, false, true)
  const moon = Astronomy.Equator(Astronomy.Body.Moon, time, site, false, true)
  const zenith = toVector(Astronomy.ObserverVector(time, site, false)).normalize()

  const sunDirection = toVector(sun.vec).normalize()
  const moonDirection = toVector(moon.vec).normalize()
  const sunAngularRadiusDeg = angularRadiusDeg(BODY_RADIUS_KM.sun, sun.dist * KM_PER_AU)
  const moonAngularRadiusDeg = angularRadiusDeg(BODY_RADIUS_KM.moon, moon.dist * KM_PER_AU)
  const separationDeg = angleBetweenDeg(sunDirection, moonDirection)
  const sunAltitudeDeg = 90 - angleBetweenDeg(zenith, sunDirection)
  const kind = classifySolarEclipse({ separationDeg, sunAngularRadiusDeg, moonAngularRadiusDeg })

  return {
    sunDirection,
    moonDirection,
    zenith,
    sunAngularRadiusDeg,
    moonAngularRadiusDeg,
    separationDeg,
    skyOffsetDeg: projectSkyOffsetDeg(moonDirection, skyBasis(sunDirection, zenith)),
    sunAltitudeDeg,
    obscuration: obscurationFraction(sunAngularRadiusDeg, moonAngularRadiusDeg, separationDeg),
    kind: sunAltitudeDeg > 0 ? kind : 'none',
  }
}

/** Everything the solar section needs about one instant, geocentric and topocentric together. */
export interface SolarGeometry {
  state: GeocentricState
  shadow: SectionShadowGeometry
  observer: ObserverSolarGeometry
  kind: EclipseEventKind
}

export function solarGeometryAt(timeMs: number, observer: ObserverPosition): SolarGeometry {
  const state = geocentricState(timeMs)
  const shadow = sectionShadowGeometry('solar', state)
  const observerGeometry = observerSolarGeometryAt(timeMs, observer)
  return {
    state,
    shadow,
    observer: observerGeometry,
    kind: observerGeometry.kind,
  }
}

/**
 * Where a geographic point sits, as a unit direction from the Earth's centre in the ecliptic frame.
 *
 * The Earth's rotation is part of the answer: the library's observer vector carries the sidereal
 * angle, so a marker placed with this lands where the point really is at that instant - on the
 * sunlit side during a solar eclipse, and not at a fixed longitude.
 */
export function observerDirection(timeMs: number, observer: ObserverPosition): THREE.Vector3 {
  const time = new Astronomy.AstroTime(new Date(timeMs))
  const site = new Astronomy.Observer(observer.latitudeDeg, observer.longitudeDeg, 0)
  return toEclipticVector(Astronomy.ObserverVector(time, site, false)).normalize()
}

/**
 * A body's own frame, as the two directions a textured globe has to be lined up with.
 *
 * The map on a globe is an equirectangular one, so its top row is the north pole and its centre
 * column is the prime meridian. Both have to be pointed at real directions or the globe is wrong in
 * a way that is easy to look at without seeing: the eclipse demo marks places on the Earth's
 * surface, and those markers land on the wrong geography if the map is spun arbitrarily.
 */
export interface BodyFrame {
  /** Unit vector along the body's north pole, in the ecliptic frame. */
  pole: THREE.Vector3
  /** Unit vector from the body's centre towards its prime meridian on the equator. */
  primeMeridian: THREE.Vector3
}

/** The real axial tilt of the Earth to the ecliptic, in degrees. */
export const EARTH_OBLIQUITY_DEG = 23.4392911

/**
 * The Earth's frame: the IAU pole, and the prime meridian from the same observer vector that places
 * the demo's surface markers.
 *
 * The two come from different corners of the library on purpose. `RotationAxis` gives the pole, and
 * it is the honest source for it - the obliquity is a constant here only because it is one, while
 * the pole also nutates. The meridian comes from `ObserverVector` rather than from the rotation
 * model's spin angle, which differs from it by about 0.7 degrees: taking it from the same function
 * that places the markers guarantees the map and the markers agree, and a globe whose texture and
 * whose markers disagree is worse than one that is a fraction of a degree off some other
 * convention.
 */
export function earthBodyFrame(timeMs: number): BodyFrame {
  const time = new Astronomy.AstroTime(new Date(timeMs))
  const axis = Astronomy.RotationAxis(Astronomy.Body.Earth, time)
  return {
    pole: toEclipticDirection(toVector(axis.north), time),
    primeMeridian: observerDirection(timeMs, { latitudeDeg: 0, longitudeDeg: 0 }),
  }
}

/**
 * The Moon's frame, from the IAU rotation model astronomy-engine implements.
 *
 * The spin angle is measured from the node of the Moon's equator on the J2000 equator, so the node
 * has to be taken in equatorial coordinates before anything is rotated into the ecliptic - doing it
 * the other way round gives a meridian that is wrong by the obliquity. The result carries the real
 * libration, which is why the near side does not point exactly at the Earth.
 *
 * `scenes/moon/selenography.ts` computes the same frame and keeps it in equatorial coordinates,
 * which is what the selenographic hotspot work needs; this one is the ecliptic-frame version.
 */
export function moonBodyFrame(timeMs: number): BodyFrame {
  const time = new Astronomy.AstroTime(new Date(timeMs))
  const axis = Astronomy.RotationAxis(Astronomy.Body.Moon, time)
  const poleEqj = toVector(axis.north).normalize()
  const nodeEqj = new THREE.Vector3(0, 0, 1).cross(poleEqj).normalize()
  const primeEqj = nodeEqj.applyAxisAngle(poleEqj, axis.spin * Math.PI / 180)
  return {
    pole: toEclipticDirection(poleEqj, time),
    primeMeridian: toEclipticDirection(primeEqj, time),
  }
}

/** The Moon's orbital plane at one instant, as the lesson switch needs to describe it. */export interface MoonOrbitFrame {
  /** The real inclination, always: the lesson switch changes what is drawn, not what is true. */
  inclinationDeg: number
  /** Ecliptic longitude of the ascending node, degrees. */
  ascendingNodeLongitudeDeg: number
  /** The nearest ascending node's time, epoch milliseconds. */
  ascendingNodeTimeMs: number
}

/**
 * Where the Moon's orbit crosses the ecliptic, near a given instant.
 *
 * `SearchMoonNode` finds the crossings; the ascending one's ecliptic longitude is read off the
 * Moon's own position at that moment, which is the definition of the node rather than a separate
 * model that could drift away from it.
 */
export function moonOrbitFrame(timeMs: number): MoonOrbitFrame {
  const searchStart = new Astronomy.AstroTime(new Date(timeMs - 16 * 86_400_000))
  let node = Astronomy.SearchMoonNode(searchStart)
  const limit = timeMs + 16 * 86_400_000

  let nearest: Astronomy.NodeEventInfo | null = null
  for (let step = 0; step < 4; step += 1) {
    const nodeTime = node.time.date.getTime()
    if (nodeTime > limit) break
    if (node.kind === Astronomy.NodeEventKind.Ascending) {
      if (!nearest || Math.abs(nodeTime - timeMs) < Math.abs(nearest.time.date.getTime() - timeMs)) {
        nearest = node
      }
    }
    node = Astronomy.NextMoonNode(node)
  }

  if (!nearest) {
    // No ascending crossing inside the window would mean the Moon stopped orbiting. Rather than
    // guess, fall back to the ecliptic longitude the Moon has right now, which is still in-plane.
    const state = geocentricState(timeMs)
    return {
      inclinationDeg: MOON_ORBIT_INCLINATION_DEG,
      ascendingNodeLongitudeDeg: ((state.moonEclipticLongitudeDeg % 360) + 360) % 360,
      ascendingNodeTimeMs: timeMs,
    }
  }

  const nodeTimeMs = nearest.time.date.getTime()
  const longitude = Astronomy.EclipticGeoMoon(nearest.time).lon
  return {
    inclinationDeg: MOON_ORBIT_INCLINATION_DEG,
    ascendingNodeLongitudeDeg: ((longitude % 360) + 360) % 360,
    ascendingNodeTimeMs: nodeTimeMs,
  }
}

const ECLIPSE_KIND_BY_LIBRARY: Record<string, EclipseEventKind> = {
  [Astronomy.EclipseKind.Penumbral]: 'penumbral',
  [Astronomy.EclipseKind.Partial]: 'partial',
  [Astronomy.EclipseKind.Annular]: 'annular',
  [Astronomy.EclipseKind.Total]: 'total',
}

function toKind(kind: Astronomy.EclipseKind): EclipseEventKind {
  return ECLIPSE_KIND_BY_LIBRARY[kind] ?? 'none'
}

/** How many eclipses the picker offers per section. Long enough that a total one is always reachable. */
export const EVENT_LIST_LENGTH = 6

/** The next few lunar eclipses of any kind, starting from an instant. */
export function nextLunarEclipses(fromMs: number, count = EVENT_LIST_LENGTH): EclipseEventSummary[] {
  const events: EclipseEventSummary[] = []
  let eclipse = Astronomy.SearchLunarEclipse(new Date(fromMs))
  for (let step = 0; step < count; step += 1) {
    events.push({
      kind: toKind(eclipse.kind),
      peakMs: eclipse.peak.date.getTime(),
      latitudeDeg: null,
      longitudeDeg: null,
    })
    eclipse = Astronomy.NextLunarEclipse(eclipse.peak)
  }
  return events
}

/**
 * The next few solar eclipses whose greatest phase is central somewhere.
 *
 * Partial-only eclipses are left out on purpose. astronomy-engine publishes a peak coordinate only
 * for total and annular eclipses, and without one there is no honest place to put the observer -
 * a partial eclipse is partial because of where you stand, so it belongs to the observer offset
 * control rather than to the event list.
 */
export function nextSolarEclipses(fromMs: number, count = EVENT_LIST_LENGTH): EclipseEventSummary[] {
  const events: EclipseEventSummary[] = []
  let eclipse = Astronomy.SearchGlobalSolarEclipse(new Date(fromMs))
  for (let step = 0; step < count * 6 && events.length < count; step += 1) {
    const kind = toKind(eclipse.kind)
    if (kind === 'total' || kind === 'annular') {
      events.push({
        kind,
        peakMs: eclipse.peak.date.getTime(),
        latitudeDeg: eclipse.latitude ?? null,
        longitudeDeg: eclipse.longitude ?? null,
      })
    }
    eclipse = Astronomy.NextGlobalSolarEclipse(eclipse.peak)
  }
  return events
}

/** What one observer gets from a solar eclipse: the four contacts and the greatest phase. */
export interface LocalSolarEclipse {
  kind: EclipseEventKind
  obscuration: number
  partialBeginMs: number
  partialEndMs: number
  peakMs: number
  /** Undefined for a partial-only eclipse at this place. */
  centralBeginMs?: number
  centralEndMs?: number
  /** Altitude of the Sun above this observer's horizon at greatest eclipse, degrees. */
  peakAltitudeDeg: number
}

/**
 * The eclipse one observer actually sees, found by astronomy-engine from their coordinates.
 *
 * This is the same search the library uses for eclipse maps, so the contact times and the kind it
 * reports are the ones a published table would give, not a second opinion derived from the demo's
 * own geometry.
 */
export function localSolarEclipse(
  fromMs: number,
  observer: ObserverPosition,
): LocalSolarEclipse {
  const site = new Astronomy.Observer(observer.latitudeDeg, observer.longitudeDeg, 0)
  const info = Astronomy.SearchLocalSolarEclipse(new Date(fromMs), site)
  return {
    kind: toKind(info.kind),
    obscuration: info.obscuration,
    partialBeginMs: info.partial_begin.time.date.getTime(),
    partialEndMs: info.partial_end.time.date.getTime(),
    peakMs: info.peak.time.date.getTime(),
    centralBeginMs: info.total_begin?.time.date.getTime(),
    centralEndMs: info.total_end?.time.date.getTime(),
    peakAltitudeDeg: info.peak.altitude,
  }
}

/** The four contacts of a lunar eclipse, from the library's own semi-durations. */
export interface LunarEclipseTiming {
  kind: EclipseEventKind
  peakMs: number
  obscuration: number
  penumbralSemiDurationMinutes: number
  partialSemiDurationMinutes: number
  totalSemiDurationMinutes: number
}

export function lunarEclipseTiming(peakMs: number): LunarEclipseTiming {
  // Re-searching from a little before the peak finds the same event and returns its durations, so
  // the event list only has to carry the peak instant.
  const info = Astronomy.SearchLunarEclipse(new Date(peakMs - 2 * 86_400_000))
  return {
    kind: toKind(info.kind),
    peakMs: info.peak.date.getTime(),
    obscuration: info.obscuration,
    penumbralSemiDurationMinutes: info.sd_penum,
    partialSemiDurationMinutes: info.sd_partial,
    totalSemiDurationMinutes: info.sd_total,
  }
}
