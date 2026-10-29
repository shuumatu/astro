import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { calculateSkyFrame, SkyCoordinateSampler } from '../sky-map/coordinates'
import type { FeaturedPatternPack, SkyCatalog, SkyCulturePack } from '../sky-map/types'
import { buildCandidates, RECOGNITION_CORES } from './candidates'
import { planTonight } from './engine'
import { scoreTarget, selectFeatured } from './ranking'
import { angularSeparation, findWindows, intervalMinutes, recognitionMagnitudeLimit } from './visibility'
import type { TonightRequest } from './types'

const base = '../../../../backend/services/astronomy-service/src/main/resources/catalogs/'
function read<T>(file: string): T { return JSON.parse(gunzipSync(readFileSync(new URL(base + file, import.meta.url))).toString('utf8')) }
const catalog = read<SkyCatalog>('naked-eye/catalog.json.gz')
const culture = read<SkyCulturePack>('sky-content/culture-western-iau.json.gz')
const patterns = read<FeaturedPatternPack>('sky-content/featured-patterns.json.gz')
const observer = { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 }
const request: TonightRequest = { observer, timeZone: 'Asia/Shanghai', nightDate: '2026-01-27', windowMode: 'all-night', nowUtc: '2026-01-27T08:00:00Z', environment: 'dark', cultureId: culture.id, interfaceLanguage: 'zh-CN' }

describe('independent astrometry references', () => {
  // Retrieved 2026-10-27 from NASA/JPL Horizons API, DE441, quantity 4,
  // coord@399, GEODETIC 114.0579,22.5431,0.020 km, APPARENT=AIRLESS.
  // https://ssd-api.jpl.nasa.gov/doc/horizons.html
  // Frozen values intentionally do not call Astronomy Engine for expectations.
  it('matches topocentric Moon, Saturn, Jupiter and Sun directions from Horizons', () => {
    const sampler = new SkyCoordinateSampler(catalog)
    const sky = sampler.at(new Date('2026-10-27T12:00:00Z'), observer, false)
    for (const [id, azimuthDeg, altitudeDeg] of [
      ['moon', 72.091997, 17.892167], ['saturn', 113.014750, 45.787792],
      ['jupiter', 5.841345, -53.047367], ['sun', 268.009563, -30.625771],
    ] as const) {
      expect(angularSeparation(sky.body(id), { azimuthDeg, altitudeDeg })).toBeLessThan(0.1)
    }
  })
})

describe('observing policy and windows', () => {
  it('removes the moonlight penalty after moonset', () => {
    expect(recognitionMagnitudeLimit('dark', -1, 1, 5, 50)).toBe(recognitionMagnitudeLimit('dark', -1, 0, 5, 50))
    expect(recognitionMagnitudeLimit('dark', 40, 1, 5, 50)).toBeLessThan(recognitionMagnitudeLimit('dark', 40, 1, 120, 50))
  })
  it('keeps disjoint windows separate and refines actual eligibility transitions', () => {
    const times = [0, 300_000, 600_000, 900_000, 1_200_000]
    const predicate = (at: number) => (at >= 100_000 && at <= 400_000) || at >= 800_000
    const windows = findWindows(times, times.map(predicate), predicate)
    expect(windows).toHaveLength(2)
    expect(Date.parse(windows[0].startUtc)).toBeGreaterThanOrEqual(100_000)
    expect(Date.parse(windows[0].endUtc)).toBeLessThanOrEqual(400_000)
    expect(Date.parse(windows[1].startUtc)).toBeGreaterThanOrEqual(800_000)
  })
  it('all curated cores and required anchors reference the published physical stars', () => {
    const ids = new Set(catalog.stars.map((star) => star.hipId))
    for (const core of Object.values(RECOGNITION_CORES)) {
      expect(core.members.every((id) => ids.has(id))).toBe(true)
      expect(core.anchors.every((id) => core.members.includes(id))).toBe(true)
    }
    const candidates = buildCandidates(catalog, culture, patterns, 'zh-CN')
    expect(candidates.filter((item) => item.type === 'constellation')).toHaveLength(17)
    expect(candidates.some((item) => item.id === 'sun' || item.id === 'neptune')).toBe(false)
  })
})

describe('published catalog observing plan', () => {
  it('produces four categories with feasible windows and matching sky-map positions', async () => {
    const result = await planTonight(catalog, culture, patterns, request)
    expect(new Set(result.recommendations.map((item) => item.targetType))).toEqual(new Set(['moon', 'planet', 'star', 'constellation', 'asterism']))
    expect(result.featuredIds.length).toBeGreaterThanOrEqual(3)
    expect(result.featuredIds.length).toBeLessThanOrEqual(5)
    const start = Date.parse(result.night.interval!.startUtc), end = Date.parse(result.night.interval!.endUtc)
    for (const target of result.recommendations) {
      expect(Date.parse(target.bestAtUtc)).toBeGreaterThanOrEqual(start)
      expect(Date.parse(target.bestAtUtc)).toBeLessThanOrEqual(end)
      expect(Date.parse(target.bestAtUtc)).toBeGreaterThanOrEqual(Date.parse(target.recommendedWindow.startUtc))
      expect(Date.parse(target.bestAtUtc)).toBeLessThanOrEqual(Date.parse(target.recommendedWindow.endUtc))
      expect(target.reasons.length).toBeGreaterThanOrEqual(2)
      expect(target.positionAtBest.altitudeDeg).toBeGreaterThanOrEqual(target.targetId === 'mercury' ? 10 : target.targetId === 'venus' ? 15 : 20)
      if (result.featuredIds.includes(target.targetId)) expect(intervalMinutes(target.recommendedWindow)).toBeGreaterThanOrEqual(20)
    }
    const star = result.recommendations.find((target) => target.targetType === 'star')!
    const frame = calculateSkyFrame(catalog, culture, patterns, { observedAt: star.bestAtUtc, observer, magnitudeLimit: 6.5, minimumAltitudeDeg: 0, applyRefraction: true, cultureId: culture.id, interfaceLanguage: 'zh-CN', enabledFeaturedPatternIds: [] })
    const rendered = frame.stars.find((item) => item.id === star.targetId)!
    expect(angularSeparation(rendered, star.positionAtBest)).toBeLessThan(0.00001)
  })
  it('does not recommend stars during a polar summer day', async () => {
    const result = await planTonight(catalog, culture, patterns, { ...request, observer: { latitudeDeg: 69.65, longitudeDeg: 18.96, elevationMeters: 10 }, timeZone: 'Europe/Oslo', nightDate: '2026-06-21', nowUtc: '2026-06-21T12:00:00Z' })
    expect(result.night.status).toBe('polar-day')
    expect(result.recommendations).toHaveLength(0)
    expect(result.featuredIds).toHaveLength(0)
  })
  it('cancels superseded calculations between batches', async () => {
    let cancelled = false
    await expect(planTonight(catalog, culture, patterns, request, { cancelled: () => cancelled, yieldControl: async () => { cancelled = true } })).rejects.toMatchObject({ code: 'CALCULATION_CANCELLED' })
  })
  it('keeps the date and results independent from the browser current date', async () => {
    const first = await planTonight(catalog, culture, patterns, { ...request, windowMode: 'evening' })
    const second = await planTonight(catalog, culture, patterns, { ...request, windowMode: 'evening', nowUtc: '2027-01-01T00:00:00Z' })
    expect(first.recommendations).toEqual(second.recommendations)
    expect(selectFeatured(first.recommendations)).toEqual(first.featuredIds)
    for (const target of first.recommendations) expect(scoreTarget(target.targetType, target.scoreBreakdown)).toBe(target.score)
  })
})
