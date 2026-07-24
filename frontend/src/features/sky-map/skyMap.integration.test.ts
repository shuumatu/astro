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
})

function readCompressedJson<T>(url: URL): T {
  return JSON.parse(gunzipSync(readFileSync(url)).toString('utf8')) as T
}
