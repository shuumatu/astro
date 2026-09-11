import { describe, expect, it } from 'vitest'
import { lonLatToVector } from './selenography'
import { polarBlend, polarTextureUv, poleHeightMeans } from './polarSurface'

describe('native polar imagery registration', () => {
  it('maps the pole to the image centre for every longitude', () => {
    for (const lat of [-90, 90]) {
      for (let lon = -180; lon <= 180; lon += 30) {
        const [u, v] = polarTextureUv(lonLatToVector(lon, lat))
        expect(u).toBeCloseTo(0.5, 12)
        expect(v).toBeCloseTo(0.5, 12)
      }
    }
  })

  it('uses metre-scale coordinates and the NASA north/south central meridian orientations', () => {
    // At 70 degrees rho=612.7 km: this must use thousands of image pixels, not 2 pixels.
    const radiusUv = 2 * 1_737_400 * Math.tan(10 * Math.PI / 180) / (2 * 1_126_000)
    const north = polarTextureUv(lonLatToVector(0, 70))
    const south = polarTextureUv(lonLatToVector(0, -70))
    expect(north[1]).toBeCloseTo(0.5 - radiusUv, 10)
    expect(south[1]).toBeCloseTo(0.5 + radiusUv, 10)
    expect(polarTextureUv(lonLatToVector(90, 70))[0]).toBeCloseTo(0.5 + radiusUv, 10)
    expect(radiusUv).toBeGreaterThan(0.25)
  })

  it('is continuous across the longitude seam and replaces the entire polar singularity', () => {
    const west = polarTextureUv(lonLatToVector(-180, 80))
    const east = polarTextureUv(lonLatToVector(180, 80))
    expect(west[0]).toBeCloseTo(east[0], 10)
    expect(west[1]).toBeCloseTo(east[1], 10)
    expect(polarBlend(75)).toBe(0)
    expect(polarBlend(79)).toBeGreaterThan(0)
    expect(polarBlend(79)).toBeLessThan(1)
    expect(polarBlend(-82)).toBe(1)
    expect(polarBlend(90)).toBe(1)
  })

  it('reduces disagreeing longitude heights to one elevation per physical pole', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255, 255, 255, 255, 255,
      51, 51, 51, 255, 153, 153, 153, 255,
    ])
    expect(poleHeightMeans(pixels, 2, 2)).toEqual([0.5, 0.4])
  })
})
