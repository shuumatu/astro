import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { BODY_RADIUS_KM, MOON_ORBIT_INCLINATION_DEG } from './config'
import { angleBetweenDeg, findPartialOffset, lunarPhaseWindows } from './geometry'
import type { EclipseEventKind } from './types'
import {
  EARTH_OBLIQUITY_DEG,
  EVENT_LIST_LENGTH,
  earthBodyFrame,
  geocentricState,
  localSolarEclipse,
  lunarEclipseTiming,
  lunarGeometryAt,
  moonBodyFrame,
  moonOrbitFrame,
  nextLunarEclipses,
  nextSolarEclipses,
  observerDirection,
  observerSolarGeometryAt,
  sectionShadowGeometry,
  solarGeometryAt,
} from './ephemeris'

/** A fixed instant, so the expected eclipses are a fact rather than whatever is next today. */
const FROM_MS = Date.UTC(2026, 8, 17, 10, 0, 0)
const DAY_MS = 86_400_000

describe('geocentric positions', () => {
  it('puts the Sun an astronomical unit away and the Moon a light-second and a bit', () => {
    const state = geocentricState(FROM_MS)
    expect(state.sunDistanceKm / 1.495978707e8).toBeCloseTo(1, 1)
    expect(state.moonDistanceKm).toBeGreaterThan(350_000)
    expect(state.moonDistanceKm).toBeLessThan(410_000)
    expect(state.sunDirection.length()).toBeCloseTo(1, 9)
  })

  it('keeps the Moon inside its own orbital inclination of the ecliptic', () => {
    for (let step = 0; step < 12; step += 1) {
      const state = geocentricState(FROM_MS + step * 2.5 * DAY_MS)
      expect(Math.abs(state.moonEclipticLatitudeDeg)).toBeLessThanOrEqual(MOON_ORBIT_INCLINATION_DEG + 0.6)
    }
  })

  it('puts the Moon near zero ecliptic latitude at an eclipse and nowhere near it in between', () => {
    const totalSolar = nextSolarEclipses(FROM_MS).find((event) => event.kind === 'total')!
    const atEclipse = geocentricState(totalSolar.peakMs)
    expect(Math.abs(atEclipse.moonEclipticLatitudeDeg)).toBeLessThan(0.6)
    // A fortnight away the Moon is at its extreme, which is exactly why there is no eclipse then.
    const inBetween = geocentricState(totalSolar.peakMs + 7.4 * DAY_MS)
    expect(Math.abs(inBetween.moonEclipticLatitudeDeg)).toBeGreaterThan(2)
  })
})

describe('the Moon\'s orbital frame', () => {
  it('reports the real inclination, whatever the lesson switch draws', () => {
    const frame = moonOrbitFrame(FROM_MS)
    expect(frame.inclinationDeg).toBe(MOON_ORBIT_INCLINATION_DEG)
    expect(frame.inclinationDeg).toBeCloseTo(5.145, 3)
    expect(frame.ascendingNodeLongitudeDeg).toBeGreaterThanOrEqual(0)
    expect(frame.ascendingNodeLongitudeDeg).toBeLessThan(360)
  })

  it('finds the ascending node within a fortnight of the instant asked about', () => {
    for (let step = 0; step < 8; step += 1) {
      const timeMs = FROM_MS + step * 3.7 * DAY_MS
      const frame = moonOrbitFrame(timeMs)
      expect(Math.abs(frame.ascendingNodeTimeMs - timeMs)).toBeLessThan(16 * DAY_MS)
    }
  })

  it('reads the node off the Moon\'s own crossing, so the two cannot disagree', () => {
    const frame = moonOrbitFrame(FROM_MS)
    // The ascending node is defined as the Moon crossing the ecliptic from south to north, so the
    // Moon's ecliptic latitude there is zero and its longitude is the node's longitude.
    const state = geocentricState(frame.ascendingNodeTimeMs)
    expect(Math.abs(state.moonEclipticLatitudeDeg)).toBeLessThan(0.05)
    let difference = Math.abs(state.moonEclipticLongitudeDeg - frame.ascendingNodeLongitudeDeg) % 360
    if (difference > 180) difference = 360 - difference
    expect(difference).toBeLessThan(0.05)
  })

  it('reports a node longitude that does not drift with the time of day asked about', () => {
    const early = moonOrbitFrame(FROM_MS)
    const later = moonOrbitFrame(FROM_MS + 2 * 3600_000)
    expect(later.ascendingNodeLongitudeDeg).toBeCloseTo(early.ascendingNodeLongitudeDeg, 3)
  })
})

describe('body frames for the globes', () => {
  /**
   * A textured globe has its map's pole on local +Y and its prime meridian on local +X, so both
   * have to be pointed at real directions. Getting the pole wrong is the failure that looks fine:
   * an obliquity applied with the wrong sign leans by exactly the right number of degrees towards
   * the wrong solstice.
   */
  it('puts the Earth\'s pole at the real obliquity, towards the June solstice', () => {
    const frame = earthBodyFrame(FROM_MS)
    expect(frame.pole.length()).toBeCloseTo(1, 9)
    // The mean obliquity is 23.4393 degrees, but the true one nutates by a couple of thousandths
    // of a degree either side of it, and `RotationAxis` reports the true one. Two decimals is the
    // honest tolerance for a comparison against the mean.
    expect(angleBetweenDeg(frame.pole, new THREE.Vector3(0, 0, 1))).toBeCloseTo(EARTH_OBLIQUITY_DEG, 2)
    // Positive y: the pole leans towards ecliptic longitude 90 degrees. The negative sign is the
    // December solstice, which is what a positive rotation about x produces.
    expect(frame.pole.y).toBeGreaterThan(0)
    expect(frame.pole.x).toBeCloseTo(0, 3)
  })

  it('takes the Earth\'s prime meridian from the same source as the surface markers', () => {
    const frame = earthBodyFrame(FROM_MS)
    const greenwich = observerDirection(FROM_MS, { latitudeDeg: 0, longitudeDeg: 0 })
    expect(frame.primeMeridian.distanceTo(greenwich)).toBeLessThan(1e-9)
    // A prime meridian lies in the equator, so it is perpendicular to the pole.
    expect(frame.primeMeridian.dot(frame.pole)).toBeCloseTo(0, 6)
  })

  it('turns the Earth\'s meridian round once a sidereal day and leaves the pole alone', () => {
    const first = earthBodyFrame(FROM_MS)
    const later = earthBodyFrame(FROM_MS + 6 * 3600_000)
    // A quarter of a sidereal day is very nearly 90 degrees of spin.
    expect(angleBetweenDeg(first.primeMeridian, later.primeMeridian)).toBeGreaterThan(80)
    expect(angleBetweenDeg(first.primeMeridian, later.primeMeridian)).toBeLessThan(100)
    expect(first.pole.distanceTo(later.pole)).toBeLessThan(1e-6)
  })

  it('puts the Moon\'s pole barely off the ecliptic, because that is where it is', () => {
    const frame = moonBodyFrame(FROM_MS)
    expect(frame.pole.length()).toBeCloseTo(1, 9)
    // The Moon's axis leans about 1.5 degrees to the ecliptic, not 90 and not 23.
    const tilt = angleBetweenDeg(frame.pole, new THREE.Vector3(0, 0, 1))
    expect(tilt).toBeGreaterThan(0.5)
    expect(tilt).toBeLessThan(3)
  })

  it('keeps the Moon\'s near side facing the Earth', () => {
    const state = geocentricState(FROM_MS)
    const towardEarth = state.moonFromEarthKm.clone().normalize().negate()
    const frame = moonBodyFrame(FROM_MS)
    // Tidally locked, so the prime meridian - the middle of the near side - points at the Earth,
    // give or take the libration in longitude of about eight degrees.
    expect(angleBetweenDeg(frame.primeMeridian, towardEarth)).toBeLessThan(12)
    expect(frame.primeMeridian.dot(frame.pole)).toBeCloseTo(0, 6)
  })

  it('carries the Moon round its orbit without turning its pole', () => {
    const first = moonBodyFrame(FROM_MS)
    // Half a sidereal month, which is the Moon's rotation period, so the near side has turned right
    // round. (Seven days would be a quarter of it, and about 90 degrees.)
    const later = moonBodyFrame(FROM_MS + 13.66 * DAY_MS)
    expect(first.pole.distanceTo(later.pole)).toBeLessThan(0.01)
    expect(angleBetweenDeg(first.primeMeridian, later.primeMeridian)).toBeGreaterThan(150)
    expect(angleBetweenDeg(first.primeMeridian, later.primeMeridian)).toBeLessThan(210)
  })
})

describe('the eclipse catalogue', () => {
  it('finds the next lunar eclipses in order, whatever kind they are', () => {
    const events = nextLunarEclipses(FROM_MS)
    expect(events).toHaveLength(EVENT_LIST_LENGTH)
    for (let index = 1; index < events.length; index += 1) {
      expect(events[index].peakMs).toBeGreaterThan(events[index - 1].peakMs)
    }
    // The next one from September 2026 is the penumbral eclipse of 20 February 2027.
    expect(events[0].kind).toBe('penumbral')
    expect(new Date(events[0].peakMs).toISOString().slice(0, 10)).toBe('2027-02-20')
    for (const event of events) {
      expect(['penumbral', 'partial', 'total']).toContain(event.kind)
      // A lunar eclipse is visible from the whole night side, so it has no single peak point.
      expect(event.latitudeDeg).toBeNull()
      expect(event.longitudeDeg).toBeNull()
    }
  })

  it('reaches a total lunar eclipse inside the list, so the copper-red view is always reachable', () => {
    expect(nextLunarEclipses(FROM_MS).some((event) => event.kind === 'total')).toBe(true)
  })

  it('offers only central solar eclipses, and always with a place to stand', () => {
    const events = nextSolarEclipses(FROM_MS)
    expect(events).toHaveLength(EVENT_LIST_LENGTH)
    for (const event of events) {
      expect(['total', 'annular']).toContain(event.kind)
      // Without a published peak point there is no honest place to put the observer, which is why
      // partial-only eclipses are left to the observer offset control instead.
      expect(typeof event.latitudeDeg).toBe('number')
      expect(typeof event.longitudeDeg).toBe('number')
      expect(Math.abs(event.latitudeDeg as number)).toBeLessThanOrEqual(90)
      expect(Math.abs(event.longitudeDeg as number)).toBeLessThanOrEqual(180)
    }
    expect(events[0].kind).toBe('annular')
    expect(new Date(events[0].peakMs).toISOString().slice(0, 10)).toBe('2027-02-06')
  })
})

describe('what one observer sees', () => {
  it('agrees with the library\'s own local search about a total eclipse', () => {
    const total = nextSolarEclipses(FROM_MS).find((event) => event.kind === 'total')!
    const site = { latitudeDeg: total.latitudeDeg as number, longitudeDeg: total.longitudeDeg as number }
    const local = localSolarEclipse(total.peakMs - 5 * DAY_MS, site)
    expect(local.kind).toBe('total')
    expect(local.obscuration).toBe(1)
    expect(local.centralBeginMs).toBeDefined()
    expect(local.centralEndMs).toBeDefined()
    // Standing on the central line, the Sun is high and the eclipse is central.
    expect(local.peakAltitudeDeg).toBeGreaterThan(0)
    expect(local.partialBeginMs).toBeLessThan(local.peakMs)
    expect(local.peakMs).toBeLessThan(local.partialEndMs)

    // The demo's own geometry, built from the library's topocentric positions, has to reach the
    // same verdict - that agreement is the check that the two models are not contradicting.
    const geometry = observerSolarGeometryAt(total.peakMs, site)
    expect(geometry.kind).toBe('total')
    expect(geometry.obscuration).toBeCloseTo(1, 6)
    expect(geometry.moonAngularRadiusDeg).toBeGreaterThan(geometry.sunAngularRadiusDeg)
  })

  it('agrees with the library about an annular eclipse, and shows the ring', () => {
    const annular = nextSolarEclipses(FROM_MS).find((event) => event.kind === 'annular')!
    const site = { latitudeDeg: annular.latitudeDeg as number, longitudeDeg: annular.longitudeDeg as number }
    expect(localSolarEclipse(annular.peakMs - 5 * DAY_MS, site).kind).toBe('annular')

    const geometry = observerSolarGeometryAt(annular.peakMs, site)
    expect(geometry.kind).toBe('annular')
    // Annular means the Moon is the smaller disc, so a ring of the Sun is left uncovered.
    expect(geometry.moonAngularRadiusDeg).toBeLessThan(geometry.sunAngularRadiusDeg)
    expect(geometry.obscuration).toBeGreaterThan(0.8)
    expect(geometry.obscuration).toBeLessThan(1)
  })

  it('turns a total eclipse into a partial one when the observer leaves the central path', () => {
    const total = nextSolarEclipses(FROM_MS).find((event) => event.kind === 'total')!
    const onPath = { latitudeDeg: total.latitudeDeg as number, longitudeDeg: total.longitudeDeg as number }
    const offPath = { latitudeDeg: onPath.latitudeDeg + 6, longitudeDeg: onPath.longitudeDeg }

    expect(observerSolarGeometryAt(total.peakMs, onPath).kind).toBe('total')
    const partial = observerSolarGeometryAt(total.peakMs, offPath)
    expect(partial.kind).toBe('partial')
    // A partial eclipse hides some of the disc and never all of it.
    expect(partial.obscuration).toBeGreaterThan(0)
    expect(partial.obscuration).toBeLessThan(1)
    // And the library, asked about the same place, says the same thing.
    expect(localSolarEclipse(total.peakMs - 5 * DAY_MS, offPath).kind).toBe('partial')
  })

  it('reaches a partial eclipse by walking the observer off the central path', () => {
    const total = nextSolarEclipses(FROM_MS).find((event) => event.kind === 'total')!
    const peak = { latitudeDeg: total.latitudeDeg as number, longitudeDeg: total.longitudeDeg as number }
    const searchStart = total.peakMs - 5 * DAY_MS

    const kindAt = (latitudeOffsetDeg: number, longitudeOffsetDeg: number): EclipseEventKind | null => {
      const local = localSolarEclipse(searchStart, {
        latitudeDeg: peak.latitudeDeg + latitudeOffsetDeg,
        longitudeDeg: peak.longitudeDeg + longitudeOffsetDeg,
      })
      return Math.abs(local.peakMs - total.peakMs) < DAY_MS ? local.kind : null
    }

    // On the path it is total; that is what makes the walk worth doing.
    expect(kindAt(0, 0)).toBe('total')

    const found = findPartialOffset(kindAt, 0.5, 20)
    expect(found).not.toBeNull()
    // The walk takes the nearest offset that works, so it should not have had to go far.
    expect(Math.abs(found!.latitudeOffsetDeg) + Math.abs(found!.longitudeOffsetDeg)).toBeLessThan(8)
    expect(kindAt(found!.latitudeOffsetDeg, found!.longitudeOffsetDeg)).toBe('partial')

    // And the observer it lands on really does see a partial eclipse, from the topocentric
    // geometry as well as from the library's local search.
    const geometry = observerSolarGeometryAt(total.peakMs, {
      latitudeDeg: peak.latitudeDeg + found!.latitudeOffsetDeg,
      longitudeDeg: peak.longitudeDeg + found!.longitudeOffsetDeg,
    })
    expect(geometry.kind).toBe('partial')
    expect(geometry.obscuration).toBeGreaterThan(0)
    expect(geometry.obscuration).toBeLessThan(1)
  })

  it('reports no eclipse at all from the far side of the planet, even when the discs line up', () => {
    const total = nextSolarEclipses(FROM_MS).find((event) => event.kind === 'total')!
    const antipode = {
      latitudeDeg: -(total.latitudeDeg as number),
      longitudeDeg: (total.longitudeDeg as number) + 180,
    }
    const geometry = observerSolarGeometryAt(total.peakMs, antipode)
    // The Moon's parallax is a degree wide, so the discs can still overlap from the antipode. What
    // makes it not an eclipse there is that the Sun is below the horizon.
    expect(geometry.sunAltitudeDeg).toBeLessThan(0)
    expect(geometry.kind).toBe('none')
    // The alignment is still reported, so the interface can explain why nothing is visible.
    expect(geometry.obscuration).toBeGreaterThanOrEqual(0)
  })

  it('agrees with the library about a total lunar eclipse', () => {
    const total = nextLunarEclipses(FROM_MS).find((event) => event.kind === 'total')!
    const timing = lunarEclipseTiming(total.peakMs)
    expect(timing.kind).toBe('total')

    const geometry = lunarGeometryAt(timing.peakMs)
    expect(geometry.kind).toBe('total')
    expect(geometry.umbraCoverage).toBeCloseTo(1, 6)
    // At greatest eclipse the Moon's centre is inside the umbra by a good margin.
    expect(geometry.axisDistanceKm).toBeLessThan(Math.abs(geometry.shadow.umbraRadiusAtTargetKm))
    expect(geometry.umbraAngularRadiusDeg).toBeGreaterThan(geometry.moonAngularRadiusDeg)
  })

  it('separates a partial lunar eclipse from a penumbral one by the umbra, not by the darkness', () => {
    const events = nextLunarEclipses(FROM_MS)
    const partial = events.find((event) => event.kind === 'partial')!
    const penumbral = events.find((event) => event.kind === 'penumbral')!

    const partialGeometry = lunarGeometryAt(lunarEclipseTiming(partial.peakMs).peakMs)
    expect(partialGeometry.kind).toBe('partial')
    expect(partialGeometry.umbraCoverage).toBeGreaterThan(0)
    expect(partialGeometry.umbraCoverage).toBeLessThan(1)
    // Part of the Moon is in the umbra: its centre is outside, its disc is not.
    expect(partialGeometry.axisDistanceKm).toBeGreaterThan(partialGeometry.shadow.umbraRadiusAtTargetKm)

    const penumbralGeometry = lunarGeometryAt(lunarEclipseTiming(penumbral.peakMs).peakMs)
    expect(penumbralGeometry.kind).toBe('penumbral')
    expect(penumbralGeometry.umbraCoverage).toBe(0)
    expect(penumbralGeometry.axisDistanceKm)
      .toBeGreaterThan(penumbralGeometry.shadow.umbraRadiusAtTargetKm + BODY_RADIUS_KM.moon)
    expect(penumbralGeometry.axisDistanceKm)
      .toBeLessThan(penumbralGeometry.shadow.penumbraRadiusAtTargetKm + BODY_RADIUS_KM.moon)
  })
})

describe('the four contacts around the peak', () => {
  it('nests the real phases of a total lunar eclipse around its peak', () => {
    const total = nextLunarEclipses(FROM_MS).find((event) => event.kind === 'total')!
    const timing = lunarEclipseTiming(total.peakMs)
    const windows = lunarPhaseWindows({
      peakMs: timing.peakMs,
      penumbralSemiDurationMinutes: timing.penumbralSemiDurationMinutes,
      partialSemiDurationMinutes: timing.partialSemiDurationMinutes,
      totalSemiDurationMinutes: timing.totalSemiDurationMinutes,
    })

    expect(windows.total).not.toBeNull()
    expect(windows.partial).not.toBeNull()
    expect(windows.penumbral).not.toBeNull()
    const totalWindow = windows.total!
    const partialWindow = windows.partial!
    const penumbralWindow = windows.penumbral!

    // The whole eclipse lasts hours; totality is the shortest phase and sits inside the other two.
    expect(penumbralWindow.endMs - penumbralWindow.startMs).toBeGreaterThan(4 * 3600_000)
    expect(totalWindow.startMs).toBeGreaterThan(partialWindow.startMs)
    expect(totalWindow.endMs).toBeLessThan(partialWindow.endMs)
    expect(partialWindow.startMs).toBeGreaterThan(penumbralWindow.startMs)
    expect(partialWindow.endMs).toBeLessThan(penumbralWindow.endMs)

    // And the classification follows the window: total inside the total window, partial outside it
    // but inside the partial one, penumbral beyond that.
    expect(lunarGeometryAt(timing.peakMs).kind).toBe('total')
    expect(lunarGeometryAt(totalWindow.startMs - 60_000).kind).toBe('partial')
    expect(lunarGeometryAt(partialWindow.startMs - 60_000).kind).toBe('penumbral')
    expect(lunarGeometryAt(penumbralWindow.startMs - 60_000).kind).toBe('none')
  })

  it('has no total phase at all for a penumbral eclipse', () => {
    const penumbral = nextLunarEclipses(FROM_MS).find((event) => event.kind === 'penumbral')!
    const timing = lunarEclipseTiming(penumbral.peakMs)
    expect(timing.partialSemiDurationMinutes).toBe(0)
    expect(timing.totalSemiDurationMinutes).toBe(0)
    expect(lunarPhaseWindows({
      peakMs: timing.peakMs,
      penumbralSemiDurationMinutes: timing.penumbralSemiDurationMinutes,
      partialSemiDurationMinutes: timing.partialSemiDurationMinutes,
      totalSemiDurationMinutes: timing.totalSemiDurationMinutes,
    }).total).toBeNull()
  })
})

describe('the section shadow at a real instant', () => {
  it('keeps the Earth\'s umbra wider than the Moon and the Moon\'s umbra marginal', () => {
    const state = geocentricState(FROM_MS)
    const lunar = sectionShadowGeometry('lunar', state)
    const solar = sectionShadowGeometry('solar', state)

    // The Earth's umbra at the Moon: about 2.65 Moon radii, which is why lunar eclipses are common.
    expect(lunar.umbraRadiusAtTargetKm / BODY_RADIUS_KM.moon).toBeCloseTo(2.65, 1)
    expect(lunar.umbraRadiusAtTargetKm).toBeGreaterThan(0)

    // The Moon's umbra at the Earth is within a few per cent of closing, one way or the other -
    // that knife edge is the difference between a total and an annular solar eclipse.
    const ratio = solar.umbraRadiusAtTargetKm / BODY_RADIUS_KM.moon
    expect(Math.abs(ratio)).toBeLessThan(0.5)
  })

  it('measures the two caster cones from the same Sun distance', () => {
    const state = geocentricState(FROM_MS)
    expect(sectionShadowGeometry('lunar', state).casterRadiusKm).toBe(BODY_RADIUS_KM.earth)
    expect(sectionShadowGeometry('solar', state).casterRadiusKm).toBe(BODY_RADIUS_KM.moon)
    // A smaller caster means a shorter umbra, which is the whole reason the Moon's shadow has to
    // reach across the gap while the Earth's has length to spare.
    expect(sectionShadowGeometry('solar', state).cone.umbraLengthKm)
      .toBeLessThan(sectionShadowGeometry('lunar', state).cone.umbraLengthKm)
  })
})

describe('the solar section end to end', () => {
  it('reports the arrangement and the observer view from one instant', () => {
    const total = nextSolarEclipses(FROM_MS).find((event) => event.kind === 'total')!
    const site = { latitudeDeg: total.latitudeDeg as number, longitudeDeg: total.longitudeDeg as number }
    const geometry = solarGeometryAt(total.peakMs, site)

    expect(geometry.kind).toBe('total')
    // The Moon has to be between the Sun and the Earth, and the ephemeris has to say so.
    expect(geometry.state.moonDistanceKm).toBeLessThan(geometry.state.sunDistanceKm)
    const moonDirection = geometry.state.moonFromEarthKm.clone().normalize()
    expect(moonDirection.dot(geometry.state.sunDirection)).toBeGreaterThan(0.99)
    // The observer's own view is a different, topocentric measurement of the same event.
    expect(geometry.observer.separationDeg).toBeLessThan(
      geometry.observer.sunAngularRadiusDeg + geometry.observer.moonAngularRadiusDeg,
    )
  })

  it('puts the Moon opposite the Sun for a lunar eclipse', () => {
    const total = nextLunarEclipses(FROM_MS).find((event) => event.kind === 'total')!
    const geometry = lunarGeometryAt(lunarEclipseTiming(total.peakMs).peakMs)
    const moonDirection = geometry.state.moonFromEarthKm.clone().normalize()
    expect(moonDirection.dot(geometry.state.sunDirection)).toBeLessThan(-0.99)
  })
})
