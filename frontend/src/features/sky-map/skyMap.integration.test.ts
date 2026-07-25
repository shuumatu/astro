import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { calculateSkyFrame } from './coordinates'
import type { FeaturedPatternPack, SkyCatalog, SkyCulturePack } from './types'

const catalogUrl = new URL(
  '../../../../backend/services/astronomy-service/src/main/resources/catalogs/naked-eye/catalog.json.gz',
  import.meta.url,
)
const chineseCultureUrl = new URL(
  '../../../../backend/services/astronomy-service/src/main/resources/catalogs/sky-content/culture-chinese-traditional.json.gz',
  import.meta.url,
)
const westernCultureUrl = new URL(
  '../../../../backend/services/astronomy-service/src/main/resources/catalogs/sky-content/culture-western-iau.json.gz',
  import.meta.url,
)
const featuredPatternsUrl = new URL(
  '../../../../backend/services/astronomy-service/src/main/resources/catalogs/sky-content/featured-patterns.json.gz',
  import.meta.url,
)

describe('published naked-eye catalog', () => {
  it('calculates a complete finite sky frame for Shenzhen', () => {
    const catalog = JSON.parse(gunzipSync(readFileSync(catalogUrl)).toString('utf8')) as SkyCatalog
    const culture = readCompressedJson<SkyCulturePack>(chineseCultureUrl)
    const featuredPatterns = readCompressedJson<FeaturedPatternPack>(featuredPatternsUrl)

    const frame = calculateSkyFrame(catalog, culture, featuredPatterns, {
      observedAt: '2026-07-23T14:00:00.000Z',
      observer: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
      magnitudeLimit: 6.5,
      minimumAltitudeDeg: 0,
      applyRefraction: true,
      cultureId: culture.id,
      interfaceLanguage: 'zh-CN',
      enabledFeaturedPatternIds: [],
    })

    expect(frame.stars.length).toBeGreaterThan(3000)
    expect(frame.stars.length).toBeLessThan(5000)
    expect(frame.cultureFigures).toHaveLength(312)
    expect(frame.cultureRegions).toHaveLength(0)
    expect(frame.starLabels.length).toBeGreaterThan(1000)
    expect(frame.featuredPatterns).toHaveLength(0)
    expect(frame.solarSystemBodies.length).toBeGreaterThan(0)
    expect(frame.solarSystemBodies.length).toBeLessThan(9)
    for (const star of frame.stars) {
      expect(Number.isFinite(star.azimuthDeg)).toBe(true)
      expect(Number.isFinite(star.altitudeDeg)).toBe(true)
      expect(star.azimuthDeg).toBeGreaterThanOrEqual(0)
      expect(star.azimuthDeg).toBeLessThan(360)
      expect(star.altitudeDeg).toBeGreaterThanOrEqual(0)
    }
    for (const figure of frame.cultureFigures) {
      expect(figure.name.length).toBeGreaterThan(0)
      expect(figure.labelPosition === null || Number.isFinite(figure.labelPosition.azimuthDeg)).toBe(true)
    }
    for (const body of frame.solarSystemBodies) {
      expect(Number.isFinite(body.azimuthDeg)).toBe(true)
      expect(Number.isFinite(body.altitudeDeg)).toBe(true)
      expect(Number.isFinite(body.visualMagnitude)).toBe(true)
      expect(Number.isFinite(body.distanceAu)).toBe(true)
      expect(body.azimuthDeg).toBeGreaterThanOrEqual(0)
      expect(body.azimuthDeg).toBeLessThan(360)
      expect(body.altitudeDeg).toBeGreaterThanOrEqual(0)
      expect(body.phaseFraction).toBeGreaterThanOrEqual(0)
      expect(body.phaseFraction).toBeLessThanOrEqual(1)
    }
  })

  it('calculates the published Western IAU lines, names and boundaries', () => {
    const catalog = readCompressedJson<SkyCatalog>(catalogUrl)
    const culture = readCompressedJson<SkyCulturePack>(westernCultureUrl)
    const featuredPatterns = readCompressedJson<FeaturedPatternPack>(featuredPatternsUrl)
    const frame = calculateSkyFrame(catalog, culture, featuredPatterns, {
      observedAt: '2026-07-23T14:00:00.000Z',
      observer: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
      magnitudeLimit: 5.5,
      minimumAltitudeDeg: 0,
      applyRefraction: true,
      cultureId: culture.id,
      interfaceLanguage: 'en',
      enabledFeaturedPatternIds: [],
    })

    expect(frame.cultureFigures).toHaveLength(88)
    expect(frame.cultureRegions).toHaveLength(88)
    expect(frame.cultureRegions.every((region) => region.rings.length > 0)).toBe(true)
    expect(frame.starLabels.length).toBeGreaterThan(100)
  })

  it('uses Chinese labels for Western IAU content when the interface is Chinese', () => {
    const catalog = readCompressedJson<SkyCatalog>(catalogUrl)
    const culture = readCompressedJson<SkyCulturePack>(westernCultureUrl)
    const featuredPatterns = readCompressedJson<FeaturedPatternPack>(featuredPatternsUrl)
    const frame = calculateSkyFrame(catalog, culture, featuredPatterns, {
      observedAt: '2026-07-23T14:00:00.000Z',
      observer: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
      magnitudeLimit: 5.5,
      minimumAltitudeDeg: 0,
      applyRefraction: true,
      cultureId: culture.id,
      interfaceLanguage: 'zh-CN',
      enabledFeaturedPatternIds: [],
    })

    expect(frame.cultureFigures.find((figure) => figure.id === 'constellation-and')?.name)
      .toBe('仙女座')
    expect(frame.starLabels.find((label) => label.objectId === 'HIP:91262')?.name)
      .toBe('织女一')
    expect(frame.starLabels.find((label) => label.objectId === 'HIP:78265')?.name)
      .toBe('房宿一')
    expect(frame.starLabels.find((label) => label.objectId === 'HIP:78265')?.name)
      .not.toBe('Fang')
    expect(frame.starLabels.some((label) => label.name === 'Fang')).toBe(false)
  })

  it('calculates independently enabled featured triangles with localized names and closed paths', () => {
    const catalog = readCompressedJson<SkyCatalog>(catalogUrl)
    const featuredPatterns = readCompressedJson<FeaturedPatternPack>(featuredPatternsUrl)
    const baseParameters = {
      observedAt: '2026-07-23T14:00:00.000Z',
      observer: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
      magnitudeLimit: 6.5,
      minimumAltitudeDeg: 0,
      applyRefraction: true,
    }

    const chineseCulture = readCompressedJson<SkyCulturePack>(chineseCultureUrl)
    const summerFrame = calculateSkyFrame(catalog, chineseCulture, featuredPatterns, {
      ...baseParameters,
      cultureId: chineseCulture.id,
      interfaceLanguage: 'zh-CN',
      enabledFeaturedPatternIds: ['summer-triangle'],
    })
    expect(summerFrame.featuredPatterns).toHaveLength(1)
    expect(summerFrame.featuredPatterns[0]).toMatchObject({
      id: 'summer-triangle',
      name: '夏季大三角',
      memberObjectIds: ['HIP:91262', 'HIP:102098', 'HIP:97649'],
    })
    expect(summerFrame.featuredPatterns[0].lines).toHaveLength(1)
    expect(summerFrame.featuredPatterns[0].lines[0]).toHaveLength(4)
    expect(summerFrame.featuredPatterns[0].lines[0][0]).toEqual(
      summerFrame.featuredPatterns[0].lines[0][3],
    )

    const westernCulture = readCompressedJson<SkyCulturePack>(westernCultureUrl)
    const winterFrame = calculateSkyFrame(catalog, westernCulture, featuredPatterns, {
      ...baseParameters,
      cultureId: westernCulture.id,
      interfaceLanguage: 'en',
      enabledFeaturedPatternIds: ['winter-triangle'],
    })
    expect(winterFrame.featuredPatterns).toHaveLength(1)
    expect(winterFrame.featuredPatterns[0]).toMatchObject({
      id: 'winter-triangle',
      name: 'Winter Triangle',
      memberObjectIds: ['HIP:27989', 'HIP:37279', 'HIP:32349'],
    })
    expect(winterFrame.featuredPatterns[0].lines[0]).toHaveLength(4)
    expect(winterFrame.featuredPatterns[0].lines[0][0]).toEqual(
      winterFrame.featuredPatterns[0].lines[0][3],
    )
  })

  it('filters an enabled featured pattern that does not apply to the active culture', () => {
    const catalog = readCompressedJson<SkyCatalog>(catalogUrl)
    const culture = readCompressedJson<SkyCulturePack>(chineseCultureUrl)
    const publishedPatterns = readCompressedJson<FeaturedPatternPack>(featuredPatternsUrl)
    const featuredPatterns: FeaturedPatternPack = {
      ...publishedPatterns,
      patterns: publishedPatterns.patterns.map((pattern) => ({
        ...pattern,
        cultureIds: ['future-culture'],
      })),
    }
    const frame = calculateSkyFrame(catalog, culture, featuredPatterns, {
      observedAt: '2026-07-23T14:00:00.000Z',
      observer: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
      magnitudeLimit: 6.5,
      minimumAltitudeDeg: 0,
      applyRefraction: true,
      cultureId: culture.id,
      interfaceLanguage: 'zh-CN',
      enabledFeaturedPatternIds: ['summer-triangle'],
    })

    expect(frame.featuredPatterns).toHaveLength(0)
  })
})

function readCompressedJson<T>(url: URL): T {
  return JSON.parse(gunzipSync(readFileSync(url)).toString('utf8')) as T
}
