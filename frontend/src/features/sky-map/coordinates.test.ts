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
import { selectLocalizedName } from './localizedName'
import type {
  FeaturedPatternPack,
  SkyCalculationParameters,
  SkyCatalog,
  SkyCulturePack,
  StarRecord,
} from './types'

describe('calculateSkyFrame', () => {
  it('matches Astronomy Engine EQJ-to-horizon rotation', () => {
    const observedAt = '2026-07-23T14:00:00.000Z'
    const observer = { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 }
    const star = sampleStar({ raDeg: 120, decDeg: 30, pmRaMasPerYear: null, pmDecMasPerYear: null })
    const frame = calculate(sampleCatalog([star]), parameters(observedAt, observer))

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
    const frame = calculate(catalog, {
      ...parameters('2026-07-23T14:00:00.000Z'),
      magnitudeLimit: 2,
      minimumAltitudeDeg: -90,
    })

    expect(frame.stars.map((star) => star.id)).toEqual(['HIP:1'])
  })

  it('calculates topocentric positions and illumination for solar system bodies', () => {
    const observedAt = '2026-07-23T14:00:00.000Z'
    const location = { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 }
    const frame = calculate(
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
    const visibleFrame = calculate(
      sampleCatalog([]),
      parameters('2026-07-23T14:00:00.000Z'),
    )
    const filteredFrame = calculate(sampleCatalog([]), {
      ...parameters('2026-07-23T14:00:00.000Z'),
      minimumAltitudeDeg: 0,
    })

    expect(filteredFrame.solarSystemBodies.length).toBeLessThan(visibleFrame.solarSystemBodies.length)
    expect(filteredFrame.solarSystemBodies.every((body) => body.altitudeDeg >= 0)).toBe(true)
  })

  it('rejects an invalid observer before calculating', () => {
    expect(() => calculate(sampleCatalog([sampleStar()]), {
      ...parameters('2026-07-23T14:00:00.000Z'),
      observer: { latitudeDeg: 91, longitudeDeg: 114, elevationMeters: 0 },
    })).toThrow(expect.objectContaining({ code: 'INVALID_PARAMETERS' }))
  })
})

describe('sky culture calculation', () => {
  it('uses the documented language fallback order', () => {
    const names = [
      sampleName('la', 'Lyra', false),
      sampleName('en', 'Lyre'),
      sampleName('zh-CN', '天琴座'),
    ]

    expect(selectLocalizedName(names, 'zh-CN', 'en')).toBe('天琴座')
    expect(selectLocalizedName(names, 'fr-FR', 'en')).toBe('Lyre')
  })

  it('resolves culture paths through physical HIP stars without bridging missing records', () => {
    const culture = sampleCulture({
      figures: [{
        id: 'test-figure',
        type: 'asterism',
        names: [sampleName('zh-CN', '测试星官')],
        paths: [['HIP:1', 'HIP:2', 'HIP:999', 'HIP:3', 'HIP:4']],
        labelAnchor: { objectId: 'HIP:1' },
        rank: 1,
        groupIds: [],
        sourceIds: ['test-source'],
      }],
    })
    const frame = calculate(
      sampleCatalog([1, 2, 3, 4].map((hipId) => sampleStar({ id: `HIP:${hipId}`, hipId }))),
      parameters('2026-07-23T14:00:00.000Z'),
      culture,
    )

    expect(frame.cultureFigures[0].name).toBe('测试星官')
    expect(frame.cultureFigures[0].lines).toHaveLength(2)
    expect(frame.cultureFigures[0].lines.map((line) => line.length)).toEqual([2, 2])
  })

  it('converts ICRS culture boundaries and visible star names into the frame', () => {
    const culture = sampleCulture({
      starNames: [{ objectId: 'HIP:1', labelPriority: 80, names: [sampleName('zh-CN', '示例星')] }],
      regions: [{
        id: 'test-region',
        figureId: 'test-figure',
        names: [sampleName('en', 'Test region')],
        referenceFrame: 'ICRS',
        geometry: { type: 'MultiPolygon', coordinates: [[[
          [10, 10], [20, 10], [20, 20], [10, 10],
        ]]] },
        sourceIds: ['test-source'],
      }],
      figures: [{
        id: 'test-figure',
        type: 'constellation',
        names: [sampleName('en', 'Test figure')],
        paths: [['HIP:1']],
        labelAnchor: { objectId: 'HIP:1' },
        rank: 1,
        groupIds: [],
        sourceIds: ['test-source'],
      }],
    })
    const frame = calculate(sampleCatalog([sampleStar()]), {
      ...parameters('2026-07-23T14:00:00.000Z'),
      minimumAltitudeDeg: -90,
    }, culture)

    expect(frame.starLabels).toHaveLength(1)
    expect(frame.starLabels[0]).toMatchObject({ objectId: 'HIP:1', name: '示例星', labelPriority: 80 })
    expect(frame.cultureRegions[0].rings).toHaveLength(1)
    expect(frame.cultureRegions[0].rings[0]).toHaveLength(4)
    expect(frame.cultureRegions[0].rings[0].every(
      (coordinate) => Number.isFinite(coordinate.azimuthDeg) && Number.isFinite(coordinate.altitudeDeg),
    )).toBe(true)
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
    cultureId: 'chinese-traditional',
    interfaceLanguage: 'zh-CN',
    enabledFeaturedPatternIds: [],
  }
}

function sampleCatalog(stars: StarRecord[]): SkyCatalog {
  return {
    schemaVersion: 2,
    catalogId: 'naked-eye',
    referenceFrame: 'ICRS',
    visualMagnitudeLimit: 6.5,
    stars,
  }
}

function calculate(
  catalog: SkyCatalog,
  calculationParameters: SkyCalculationParameters,
  culture = sampleCulture(),
) {
  return calculateSkyFrame(catalog, culture, sampleFeaturedPatterns(), calculationParameters)
}

function sampleCulture(overrides: Partial<SkyCulturePack> = {}): SkyCulturePack {
  return {
    schemaVersion: 1,
    id: 'chinese-traditional',
    version: 'test-1',
    names: [sampleName('zh-CN', '中国传统')],
    defaultLanguage: 'zh-CN',
    descriptions: [{ language: 'zh-CN', value: '测试', sourceId: 'test-source' }],
    sources: [{
      id: 'test-source',
      title: 'Test source',
      authors: ['Test'],
      url: 'https://astro.test',
      version: '1',
      license: 'CC0-1.0',
      attribution: 'Test',
    }],
    starNames: [],
    figures: [],
    groups: [],
    regions: [],
    ...overrides,
  }
}

function sampleFeaturedPatterns(): FeaturedPatternPack {
  return {
    schemaVersion: 1,
    id: 'featured-patterns',
    version: 'test-1',
    sources: [],
    patterns: [],
  }
}

function sampleName(language: string, value: string, preferred = true) {
  return {
    language,
    value,
    type: 'translation' as const,
    preferred,
    searchable: true,
    sourceId: 'test-source',
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
