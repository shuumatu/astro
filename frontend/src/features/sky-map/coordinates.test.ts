import {
  Body,
  Equator,
  HorizonFromVector,
  Horizon,
  Illumination,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_EQJ_HOR,
  Vector,
} from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { calculateSkyFrame, propagateIcrs } from './coordinates'
import type { SkyCalculationParameters, SkyCatalog, StarRecord } from './types'

describe('calculateSkyFrame', () => {
  it('matches Astronomy Engine EQJ-to-horizon rotation', () => {
    const observedAt = '2026-07-23T14:00:00.000Z'
    const observer = { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 }
    const star = sampleStar({ raDeg: 120, decDeg: 30, pmRaMasPerYear: null, pmDecMasPerYear: null })
    const frame = calculateSkyFrame(sampleCatalog([star]), parameters(observedAt, observer))

    const date = new Date(observedAt)
    const rotation = Rotation_EQJ_HOR(
      date,
      new Observer(observer.latitudeDeg, observer.longitudeDeg, observer.elevationMeters),
    )
    const ra = star.raDeg * Math.PI / 180
    const dec = star.decDeg * Math.PI / 180
    const vector = new Vector(
      Math.cos(dec) * Math.cos(ra),
      Math.cos(dec) * Math.sin(ra),
      Math.sin(dec),
      MakeTime(date),
    )
    const expected = HorizonFromVector(RotateVector(rotation, vector), '')

    expect(frame.stars).toHaveLength(1)
    expect(frame.stars[0]).toMatchObject({
      hipId: star.hipId,
      gaiaDr3Id: star.gaiaDr3Id,
      spectralType: star.spectralType,
      astrometrySource: star.astrometrySource,
    })
    expect(frame.stars[0].azimuthDeg).toBeCloseTo(expected.lon, 10)
    expect(frame.stars[0].altitudeDeg).toBeCloseTo(expected.lat, 10)
  })

  it('filters stars by visual magnitude and minimum altitude', () => {
    const catalog = sampleCatalog([
      sampleStar({ id: 'HIP:1', hipId: 1, visualMagnitude: 1 }),
      sampleStar({ id: 'HIP:2', hipId: 2, visualMagnitude: 5 }),
    ])
    const frame = calculateSkyFrame(catalog, {
      ...parameters('2026-07-23T14:00:00.000Z'),
      magnitudeLimit: 2,
      minimumAltitudeDeg: -90,
    })

    expect(frame.stars.map((star) => star.id)).toEqual(['HIP:1'])
  })

  it('calculates topocentric positions and illumination for solar system bodies', () => {
    const observedAt = '2026-07-23T14:00:00.000Z'
    const location = { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 }
    const frame = calculateSkyFrame(
      sampleCatalog([]),
      parameters(observedAt, location),
    )
    const observer = new Observer(
      location.latitudeDeg,
      location.longitudeDeg,
      location.elevationMeters,
    )
    const equatorial = Equator(Body.Mars, new Date(observedAt), observer, true, true)
    const horizontal = Horizon(
      new Date(observedAt),
      observer,
      equatorial.ra,
      equatorial.dec,
      '',
    )
    const illumination = Illumination(Body.Mars, new Date(observedAt))
    const mars = frame.solarSystemBodies.find((body) => body.id === 'mars')

    expect(frame.solarSystemBodies.map((body) => body.id)).toEqual([
      'sun',
      'moon',
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ])
    expect(mars).toMatchObject({ ringTiltDeg: null })
    expect(mars?.azimuthDeg).toBeCloseTo(horizontal.azimuth, 10)
    expect(mars?.altitudeDeg).toBeCloseTo(horizontal.altitude, 10)
    expect(mars?.rightAscensionHours).toBeCloseTo(equatorial.ra, 10)
    expect(mars?.declinationDeg).toBeCloseTo(equatorial.dec, 10)
    expect(mars?.visualMagnitude).toBeCloseTo(illumination.mag, 10)
    expect(mars?.phaseAngleDeg).toBeCloseTo(illumination.phase_angle, 10)
    expect(mars?.phaseFraction).toBeCloseTo(illumination.phase_fraction, 10)
    expect(mars?.distanceAu).toBeCloseTo(equatorial.dist, 10)
  })

  it('applies the minimum altitude filter to solar system bodies', () => {
    const visibleFrame = calculateSkyFrame(
      sampleCatalog([]),
      parameters('2026-07-23T14:00:00.000Z'),
    )
    const filteredFrame = calculateSkyFrame(sampleCatalog([]), {
      ...parameters('2026-07-23T14:00:00.000Z'),
      minimumAltitudeDeg: 0,
    })

    expect(filteredFrame.solarSystemBodies.length).toBeLessThan(visibleFrame.solarSystemBodies.length)
    expect(filteredFrame.solarSystemBodies.every((body) => body.altitudeDeg >= 0)).toBe(true)
  })

  it('rejects an invalid observer before calculating', () => {
    expect(() => calculateSkyFrame(sampleCatalog([sampleStar()]), {
      ...parameters('2026-07-23T14:00:00.000Z'),
      observer: { latitudeDeg: 91, longitudeDeg: 114, elevationMeters: 0 },
    })).toThrow(expect.objectContaining({ code: 'INVALID_PARAMETERS' }))
  })
})

describe('propagateIcrs', () => {
  it('propagates catalog mu-alpha-star without dividing by cos(dec)', () => {
    const vector = propagateIcrs(sampleStar({
      raDeg: 0,
      decDeg: 0,
      epochYear: 2000,
      pmRaMasPerYear: 3_600,
      pmDecMasPerYear: 0,
    }), 2001)
    const propagatedRaDeg = Math.atan2(vector.y, vector.x) * 180 / Math.PI

    expect(propagatedRaDeg).toBeCloseTo(0.001, 8)
    expect(vector.z).toBeCloseTo(0, 12)
    expect(Math.hypot(vector.x, vector.y, vector.z)).toBeCloseTo(1, 12)
  })
})

function parameters(
  observedAt: string,
  observer = { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
): SkyCalculationParameters {
  return {
    observedAt,
    observer,
    magnitudeLimit: 6.5,
    minimumAltitudeDeg: -90,
    applyRefraction: false,
  }
}

function sampleCatalog(stars: StarRecord[]): SkyCatalog {
  return {
    schemaVersion: 1,
    catalogId: 'naked-eye',
    referenceFrame: 'ICRS',
    visualMagnitudeLimit: 6.5,
    stars,
    constellations: [],
  }
}

function sampleStar(overrides: Partial<StarRecord> = {}): StarRecord {
  return {
    id: 'HIP:1',
    hipId: 1,
    gaiaDr3Id: null,
    tycho2Id: null,
    hdId: null,
    raDeg: 120,
    decDeg: 30,
    epochYear: 2016,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    parallaxMas: null,
    visualMagnitude: 1,
    colorIndex: 0.5,
    spectralType: 'G2V',
    astrometrySource: 'GAIA_DR3',
    ...overrides,
  }
}
