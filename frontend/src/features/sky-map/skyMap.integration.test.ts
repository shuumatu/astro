import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { calculateSkyFrame } from './coordinates'
import type { SkyCatalog } from './types'

const catalogUrl = new URL(
  '../../../../backend/services/astronomy-service/src/main/resources/catalogs/naked-eye/catalog.json.gz',
  import.meta.url,
)

describe('published naked-eye catalog', () => {
  it('calculates a complete finite sky frame for Shenzhen', () => {
    const catalog = JSON.parse(gunzipSync(readFileSync(catalogUrl)).toString('utf8')) as SkyCatalog

    const frame = calculateSkyFrame(catalog, {
      observedAt: '2026-07-23T14:00:00.000Z',
      observer: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
      magnitudeLimit: 6.5,
      minimumAltitudeDeg: 0,
      applyRefraction: true,
    })

    expect(frame.stars.length).toBeGreaterThan(3000)
    expect(frame.stars.length).toBeLessThan(5000)
    expect(frame.constellations).toHaveLength(88)
    for (const star of frame.stars) {
      expect(Number.isFinite(star.azimuthDeg)).toBe(true)
      expect(Number.isFinite(star.altitudeDeg)).toBe(true)
      expect(star.azimuthDeg).toBeGreaterThanOrEqual(0)
      expect(star.azimuthDeg).toBeLessThan(360)
      expect(star.altitudeDeg).toBeGreaterThanOrEqual(0)
    }
    for (const constellation of frame.constellations) {
      expect(constellation.lines.length).toBeGreaterThan(0)
      expect(constellation.labelPositions.length).toBeGreaterThan(0)
    }
  })
})
