import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS_KM,
  DISPLAY_RADIUS,
  MOON_ORBIT_INCLINATION_DEG,
  SECTION_MODEL,
} from './config'
import {
  angleBetweenDeg,
  angularRadiusDeg,
  circleOverlapArea,
  classifyLunarEclipse,
  classifySolarEclipse,
  createShadowCone,
  displayAxialScale,
  displayRadialScale,
  displayShadowCone,
  eclipticToVector,
  findPartialOffset,
  lunarPhaseWindows,
  nodeLongitudes,
  obscurationFraction,
  orbitPlaneBasis,
  otherSection,
  padWindow,
  projectSkyOffsetDeg,
  skyBasis,
  solarPhaseWindows,
} from './geometry'
import type { EclipseEventKind } from './types'

/** The mean Earth-Sun distance, which is what the cones are shaped by. */
const AU_KM = 149_597_870.7
/** The mean Earth-Moon distance. */
const MOON_KM = 384_400

const earthCone = createShadowCone({
  sunRadiusKm: BODY_RADIUS_KM.sun,
  bodyRadiusKm: BODY_RADIUS_KM.earth,
  sunToBodyKm: AU_KM,
})
const moonCone = createShadowCone({
  sunRadiusKm: BODY_RADIUS_KM.sun,
  bodyRadiusKm: BODY_RADIUS_KM.moon,
  sunToBodyKm: AU_KM,
})

describe('shadow cone geometry', () => {
  it('starts at the body\'s own radius and closes at the apex', () => {
    for (const [cone, radius] of [[earthCone, BODY_RADIUS_KM.earth], [moonCone, BODY_RADIUS_KM.moon]] as const) {
      expect(cone.umbraRadiusAtKm(0)).toBeCloseTo(radius, 6)
      expect(cone.penumbraRadiusAtKm(0)).toBeCloseTo(radius, 6)
      expect(cone.umbraRadiusAtKm(cone.umbraLengthKm)).toBeCloseTo(0, 3)
    }
  })

  it('closes the Earth\'s umbra well past the Moon and the Moon\'s just short of the Earth', () => {
    // The two lengths are the reason lunar eclipses are common and total solar eclipses are not.
    expect(earthCone.umbraLengthKm).toBeGreaterThan(1_300_000)
    expect(earthCone.umbraLengthKm).toBeLessThan(1_450_000)
    expect(moonCone.umbraLengthKm).toBeGreaterThan(360_000)
    expect(moonCone.umbraLengthKm).toBeLessThan(390_000)
    // The Moon's umbra reaches 384 400 km only when the Moon is near perigee, which is exactly the
    // condition for a total rather than an annular solar eclipse.
    expect(moonCone.umbraLengthKm).toBeLessThan(MOON_KM)
  })

  it('puts the Earth\'s umbra at 2.65 Moon radii across the Moon', () => {
    const umbraAtMoon = earthCone.umbraRadiusAtKm(MOON_KM)
    expect(umbraAtMoon / BODY_RADIUS_KM.moon).toBeCloseTo(2.65, 1)
    // And the penumbra is nearly twice that, which is what makes a penumbral eclipse so faint.
    expect(earthCone.penumbraRadiusAtKm(MOON_KM) / umbraAtMoon).toBeCloseTo(1.78, 1)
  })

  it('only has an antumbra past the apex', () => {
    expect(moonCone.antumbraRadiusAtKm(moonCone.umbraLengthKm)).toBeCloseTo(0, 3)
    expect(moonCone.antumbraRadiusAtKm(moonCone.umbraLengthKm * 0.5)).toBeLessThan(0)
    expect(moonCone.antumbraRadiusAtKm(moonCone.umbraLengthKm * 1.1)).toBeGreaterThan(0)
  })

  it('refuses a body larger than its Sun, or a nonsense distance', () => {
    expect(() => createShadowCone({ sunRadiusKm: 1, bodyRadiusKm: 2, sunToBodyKm: 10 })).toThrow()
    expect(() => createShadowCone({ sunRadiusKm: 10, bodyRadiusKm: 1, sunToBodyKm: 0 })).toThrow()
    expect(() => createShadowCone({ sunRadiusKm: 10, bodyRadiusKm: 0, sunToBodyKm: 5 })).toThrow()
  })
})

describe('disc overlap', () => {
  it('is zero when the discs are clear of each other', () => {
    expect(circleOverlapArea(1, 1, 2)).toBe(0)
    expect(circleOverlapArea(1, 1, 3)).toBe(0)
  })

  it('is the whole smaller disc when one contains the other', () => {
    expect(circleOverlapArea(1, 1, 0)).toBeCloseTo(Math.PI, 9)
    expect(circleOverlapArea(2, 1, 0.5)).toBeCloseTo(Math.PI, 9)
  })

  it('matches the closed form for two unit discs a radius apart', () => {
    const expected = 2 * Math.acos(0.5) - 0.5 * Math.sqrt(3)
    expect(circleOverlapArea(1, 1, 1)).toBeCloseTo(expected, 9)
  })

  it('reads obscuration as a fraction of the covered disc, capped by the coverer', () => {
    expect(obscurationFraction(1, 1, 2)).toBe(0)
    // A centred total eclipse hides all of it.
    expect(obscurationFraction(0.26, 0.27, 0)).toBe(1)
    // A centred annular eclipse can never hide all of it: the smaller disc is the ceiling.
    expect(obscurationFraction(0.26, 0.24, 0)).toBeCloseTo((0.24 / 0.26) ** 2, 9)
  })
})

describe('eclipse classification', () => {
  it('splits the Earth\'s shadow into penumbral, partial and total', () => {
    const base = { moonRadiusKm: 1737.4, umbraRadiusKm: 4600, penumbraRadiusKm: 8176 }
    // Well outside both cones.
    expect(classifyLunarEclipse({ ...base, moonAxisDistanceKm: 12_000 })).toBe('none')
    // Inside the penumbra only.
    expect(classifyLunarEclipse({ ...base, moonAxisDistanceKm: 9_500 })).toBe('penumbral')
    // Touching the umbra but not swallowed by it.
    expect(classifyLunarEclipse({ ...base, moonAxisDistanceKm: 5_500 })).toBe('partial')
    // Entirely inside the umbra.
    expect(classifyLunarEclipse({ ...base, moonAxisDistanceKm: 2_000 })).toBe('total')
  })

  it('never calls a closed umbra total, however well lined up', () => {
    // Past the apex the umbra radius goes negative. A negative radius must not read as a huge one.
    const closed = { moonRadiusKm: 1737.4, umbraRadiusKm: -20, penumbraRadiusKm: 3600 }
    expect(classifyLunarEclipse({ ...closed, moonAxisDistanceKm: 0 })).toBe('penumbral')
  })

  it('splits the Moon\'s shadow into partial, total and annular', () => {
    // The Sun is 0.262 degrees across from the Earth, the Moon 0.259.
    const sun = 0.2624
    const moon = 0.2593
    expect(classifySolarEclipse({ separationDeg: 0.6, sunAngularRadiusDeg: sun, moonAngularRadiusDeg: moon }))
      .toBe('none')
    expect(classifySolarEclipse({ separationDeg: 0.4, sunAngularRadiusDeg: sun, moonAngularRadiusDeg: moon }))
      .toBe('partial')
    // Perfectly centred with a bigger Moon: total.
    expect(classifySolarEclipse({ separationDeg: 0, sunAngularRadiusDeg: sun, moonAngularRadiusDeg: 0.27 }))
      .toBe('total')
    // Perfectly centred with a smaller Moon: a ring, and the ring is what makes it annular.
    expect(classifySolarEclipse({ separationDeg: 0, sunAngularRadiusDeg: sun, moonAngularRadiusDeg: moon }))
      .toBe('annular')
  })

  it('treats the tangencies as the boundaries they are', () => {
    // External tangency - the discs just touch - is no eclipse, however close it looks.
    expect(classifySolarEclipse({ separationDeg: 0.5, sunAngularRadiusDeg: 0.25, moonAngularRadiusDeg: 0.25 }))
      .toBe('none')
    // Internal tangency - the smaller disc just fits inside the larger - is the moment the eclipse
    // becomes total or annular, and which of the two it becomes is decided by which disc is bigger.
    expect(classifySolarEclipse({ separationDeg: 0.125, sunAngularRadiusDeg: 0.125, moonAngularRadiusDeg: 0.25 }))
      .toBe('total')
    expect(classifySolarEclipse({ separationDeg: 0.125, sunAngularRadiusDeg: 0.25, moonAngularRadiusDeg: 0.125 }))
      .toBe('annular')
  })
})

describe('eclipse windows around the peak', () => {
  it('nests the lunar phases inside one another', () => {
    const windows = lunarPhaseWindows({
      peakMs: 1_000_000,
      penumbralSemiDurationMinutes: 120,
      partialSemiDurationMinutes: 60,
      totalSemiDurationMinutes: 20,
    })
    expect(windows.penumbral).not.toBeNull()
    expect(windows.partial).not.toBeNull()
    expect(windows.total).not.toBeNull()
    const penumbral = windows.penumbral!
    const partial = windows.partial!
    const total = windows.total!
    // Each phase opens later and closes earlier than the one that contains it, and every one of
    // them straddles the peak.
    expect(penumbral.startMs).toBeLessThan(partial.startMs)
    expect(partial.startMs).toBeLessThan(total.startMs)
    expect(total.endMs).toBeLessThan(partial.endMs)
    expect(partial.endMs).toBeLessThan(penumbral.endMs)
    for (const window of [penumbral, partial, total]) {
      expect(window.startMs).toBeLessThan(1_000_000)
      expect(window.endMs).toBeGreaterThan(1_000_000)
    }
  })

  it('reports a phase the eclipse never reaches as absent, not as zero-length', () => {
    const windows = lunarPhaseWindows({
      peakMs: 500,
      penumbralSemiDurationMinutes: 100,
      partialSemiDurationMinutes: 0,
      totalSemiDurationMinutes: 0,
    })
    expect(windows.penumbral).not.toBeNull()
    expect(windows.partial).toBeNull()
    expect(windows.total).toBeNull()
  })

  it('makes the solar central phase optional and the partial phase not', () => {
    const partialOnly = solarPhaseWindows({ partialBeginMs: 0, partialEndMs: 100 })
    expect(partialOnly.partial).toEqual({ startMs: 0, endMs: 100 })
    expect(partialOnly.central).toBeNull()

    const central = solarPhaseWindows({ partialBeginMs: 0, partialEndMs: 100, centralBeginMs: 40, centralEndMs: 60 })
    expect(central.central).toEqual({ startMs: 40, endMs: 60 })
  })

  it('pads a window symmetrically for the scrubber', () => {
    expect(padWindow({ startMs: 1000, endMs: 2000 }, 250)).toEqual({ startMs: 750, endMs: 2250 })
  })
})

describe('the Moon\'s orbital plane', () => {
  it('lies in the ecliptic at zero inclination', () => {
    const basis = orbitPlaneBasis(0, 47)
    expect(basis.normal.z).toBeCloseTo(1, 9)
    expect(basis.ascendingNode.z).toBeCloseTo(0, 12)
    expect(basis.descendingNode.z).toBeCloseTo(0, 12)
    expect(basis.inPlane.z).toBeCloseTo(0, 12)
  })

  it('tilts away from ecliptic north by exactly the inclination', () => {
    for (const inclination of [0, MOON_ORBIT_INCLINATION_DEG, 12, 30]) {
      const basis = orbitPlaneBasis(inclination, 123)
      expect(angleBetweenDeg(basis.normal, new THREE.Vector3(0, 0, 1))).toBeCloseTo(inclination, 9)
    }
  })

  it('always keeps the node line in the ecliptic and the two nodes opposite', () => {
    for (const node of [0, 90, 200, 359]) {
      const basis = orbitPlaneBasis(MOON_ORBIT_INCLINATION_DEG, node)
      expect(basis.ascendingNode.z).toBeCloseTo(0, 12)
      expect(basis.ascendingNode.dot(basis.descendingNode)).toBeCloseTo(-1, 9)
      expect(basis.normal.dot(basis.ascendingNode)).toBeCloseTo(0, 9)
      expect(basis.normal.dot(basis.inPlane)).toBeCloseTo(0, 9)
    }
  })

  it('names both nodes, wrapping the far one back into range', () => {
    expect(nodeLongitudes(30)).toEqual([30, 210])
    expect(nodeLongitudes(200)).toEqual([200, 20])
    expect(nodeLongitudes(-10)).toEqual([350, 170])
  })
})

describe('the schematic display', () => {
  it('scales radii and lengths by different factors, on purpose', () => {
    const radial = displayRadialScale(DISPLAY_RADIUS.earth, BODY_RADIUS_KM.earth)
    const axial = displayAxialScale(3.6, MOON_KM)
    expect(radial).toBeGreaterThan(axial)
    // Radii keep the Earth's own drawn size; lengths are compressed to the drawn gap.
    expect(radial / axial).toBeGreaterThan(10)
  })

  it('draws the Earth\'s umbra across the whole gap, wider than the Moon', () => {
    const display = displayShadowCone({
      cone: earthCone,
      casterDisplayRadius: DISPLAY_RADIUS.earth,
      casterRadiusKm: BODY_RADIUS_KM.earth,
      displayTargetDistance: 3.6,
      realTargetDistanceKm: MOON_KM,
    })
    expect(display.antumbra).toBe(false)
    expect(display.length).toBeCloseTo(3.6, 9)
    expect(display.baseRadius).toBeCloseTo(DISPLAY_RADIUS.earth, 9)
    // The one ratio the display must not lose: umbra to Moon.
    expect(display.farRadius / DISPLAY_RADIUS.moon).toBeCloseTo(2.65, 1)
    expect(display.penumbraFarRadius).toBeGreaterThan(display.farRadius)
    expect(display.penumbraLength).toBeCloseTo(3.6, 9)
  })

  it('lets the Moon\'s umbra close short of the Earth and hands the rest to the antumbra', () => {
    const display = displayShadowCone({
      cone: moonCone,
      casterDisplayRadius: DISPLAY_RADIUS.moon,
      casterRadiusKm: BODY_RADIUS_KM.moon,
      displayTargetDistance: 3.6,
      realTargetDistanceKm: MOON_KM,
    })
    expect(display.antumbra).toBe(true)
    expect(display.farRadius).toBe(0)
    expect(display.length).toBeLessThan(3.6)
    // The umbra and the antumbra together still span exactly the gap, which is what keeps the
    // total/annular distinction honest rather than a drawing convention.
    expect(display.length + display.antumbraLength).toBeCloseTo(3.6, 9)
    expect(display.antumbraFarRadius).toBeGreaterThan(0)
    expect(display.antumbraFarRadius).toBeLessThan(display.farRadius + 0.05)
  })
})

describe('frames and small-angle helpers', () => {
  it('places a direction by ecliptic longitude and latitude', () => {
    const along = eclipticToVector(0, 0)
    expect(along.x).toBeCloseTo(1, 9)
    const north = eclipticToVector(0, 90)
    expect(north.z).toBeCloseTo(1, 9)
    const node = eclipticToVector(90, 0, 2)
    expect(node.y).toBeCloseTo(2, 9)
  })

  it('measures angular radius with a tangent rather than an arc sine', () => {
    // The Moon from the Earth: 1737.4 km at 384 400 km.
    expect(angularRadiusDeg(BODY_RADIUS_KM.moon, MOON_KM)).toBeCloseTo(0.2589, 3)
    expect(angularRadiusDeg(BODY_RADIUS_KM.sun, AU_KM)).toBeCloseTo(0.2664, 3)
  })

  it('projects an offset direction onto the sky frame in degrees', () => {
    const basis = skyBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0))
    const toTheRight = new THREE.Vector3(Math.tan(0.5 * Math.PI / 180), 0, 1)
    const offset = projectSkyOffsetDeg(toTheRight, basis)
    expect(offset.x).toBeCloseTo(0.5, 6)
    expect(offset.y).toBeCloseTo(0, 9)

    const upwards = new THREE.Vector3(0, Math.tan(0.25 * Math.PI / 180), 1)
    const up = projectSkyOffsetDeg(upwards, basis)
    expect(up.y).toBeCloseTo(0.25, 6)
    expect(up.x).toBeCloseTo(0, 9)
  })

  it('keeps a sky frame orthonormal even when the up hint is degenerate', () => {
    const basis = skyBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0))
    expect(basis.right.length()).toBeCloseTo(1, 9)
    expect(basis.up.length()).toBeCloseTo(1, 9)
    expect(basis.right.dot(basis.up)).toBeCloseTo(0, 9)
    expect(basis.right.dot(basis.forward)).toBeCloseTo(0, 9)
  })
})

describe('finding a partial eclipse by moving the observer', () => {
  /**
   * A partial eclipse is a property of where you stand rather than of the event, so it cannot be an
   * entry in the event list. This walk is how the panel offers one, and it is pure, so it can be
   * tested against a lookup that answers however the test likes.
   */
  it('takes the nearest offset that reports a partial eclipse', () => {
    const asked: string[] = []
    // Partial from 1.5 degrees of latitude outwards, and only there.
    const kindAt = (lat: number, lon: number): EclipseEventKind => {
      asked.push(`${lat},${lon}`)
      return Math.abs(lat) >= 1.5 ? 'partial' : 'total'
    }
    const found = findPartialOffset(kindAt, 0.5, 20)
    expect(found).toEqual({ latitudeOffsetDeg: 1.5, longitudeOffsetDeg: 0 })
    // Rings of four - north, east, south, west - widening until one of them works, and no further.
    // The whole ring is asked before it widens, because a path can run either way.
    expect(asked).toEqual([
      '0.5,0', '0,0.5', '-0.5,0', '0,-0.5',
      '1,0', '0,1', '-1,0', '0,-1',
      '1.5,0',
    ])
  })

  it('looks in every direction before widening the ring', () => {
    // Only due east works, so the search has to try all four points of the first ring.
    const found = findPartialOffset((lat, lon) => (lon === 0.5 ? 'partial' : 'total'), 0.5, 20)
    expect(found).toEqual({ latitudeOffsetDeg: 0, longitudeOffsetDeg: 0.5 })
  })

  it('answers nothing when no offset inside the limit sees a partial eclipse', () => {
    // An observer who only ever sees totality, or only ever sees nothing.
    expect(findPartialOffset(() => 'total', 0.5, 4)).toBeNull()
    expect(findPartialOffset(() => null, 0.5, 4)).toBeNull()
    expect(findPartialOffset(() => 'none', 0.5, 4)).toBeNull()
  })

  it('refuses a step or a limit that cannot be walked', () => {
    expect(findPartialOffset(() => 'partial', 0, 20)).toBeNull()
    expect(findPartialOffset(() => 'partial', 0.5, 0)).toBeNull()
    expect(findPartialOffset(() => 'partial', -0.5, 20)).toBeNull()
  })

  it('walks exactly to the limit and no further', () => {
    let furthest = 0
    findPartialOffset((lat) => {
      furthest = Math.max(furthest, Math.abs(lat))
      return 'total'
    }, 0.5, 2)
    expect(furthest).toBeCloseTo(2, 9)
  })
})

describe('section model', () => {
  it('makes the Moon the caster in a solar eclipse and the Earth in a lunar one', () => {
    expect(SECTION_MODEL.solar.caster).toBe('moon')
    expect(SECTION_MODEL.solar.subject).toBe('sun')
    expect(SECTION_MODEL.solar.alignment).toEqual(['sun', 'moon', 'earth'])

    expect(SECTION_MODEL.lunar.caster).toBe('earth')
    expect(SECTION_MODEL.lunar.subject).toBe('moon')
    expect(SECTION_MODEL.lunar.alignment).toEqual(['sun', 'earth', 'moon'])
  })

  it('offers each section only the kinds it can reach', () => {
    expect(SECTION_MODEL.solar.kinds).toEqual(['partial', 'total', 'annular'])
    expect(SECTION_MODEL.lunar.kinds).toEqual(['penumbral', 'partial', 'total'])
    for (const section of ['solar', 'lunar'] as const) {
      expect(SECTION_MODEL[section].caster).not.toBe(SECTION_MODEL[otherSection(section)].caster)
    }
  })

  it('switches to the other section and back', () => {
    expect(otherSection('solar')).toBe('lunar')
    expect(otherSection('lunar')).toBe('solar')
  })
})
