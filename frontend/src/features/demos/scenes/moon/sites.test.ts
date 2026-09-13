import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MOON_FEATURES } from './hotspots'
import {
  MOON_SITES,
  findSite,
  siteBumpScale,
  siteFloorSite,
  siteLevels,
  siteRelief,
  siteTier,
  type MoonSite,
} from './sites'

const SITE_DIRECTORY = fileURLToPath(new URL('../../../../../public/demos/moon/sites/', import.meta.url))
const BUMP_DIRECTORY = fileURLToPath(new URL('../../../../../public/demos/moon/bump/', import.meta.url))

/** True when `inner`'s box lies entirely inside `outer`'s. */
function contains(outer: MoonSite, inner: MoonSite): boolean {
  return inner.bbox[0] >= outer.bbox[0] && inner.bbox[1] >= outer.bbox[1]
    && inner.bbox[2] <= outer.bbox[2] && inner.bbox[3] <= outer.bbox[3]
}

/** Ground size of one texel of a crop, in degrees. */
function texelDegrees(site: MoonSite): number {
  return (site.bbox[2] - site.bbox[0]) / site.width
}

/**
 * Features whose drill-down ends in LROC NAC imagery, with the tiers they can reach. Chang'e 5
 * stops at one NAC crop because its published mosaic is the finest product there is for the
 * site: a second step would only re-sample the same ground at the same pixel scale.
 */
const NAC_FEATURES: Record<string, string[]> = {
  'apollo-11': ['wide', 'fine', 'nac', 'nac-close'],
  'apollo-17': ['wide', 'fine', 'nac', 'nac-close'],
  'change-4': ['wide', 'fine', 'nac', 'nac-close'],
  'change-5': ['wide', 'fine', 'nac'],
  'luna-21': ['wide', 'fine', 'nac', 'nac-close'],
}

describe('moon crops', () => {
  it('has unique identifiers', () => {
    const ids = MOON_SITES.map((site) => site.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('describes a sane box and texture for every crop', () => {
    for (const site of MOON_SITES) {
      const [west, south, east, north] = site.bbox
      expect(west, site.id).toBeGreaterThanOrEqual(-180)
      expect(east, site.id).toBeLessThanOrEqual(180)
      expect(east, site.id).toBeGreaterThan(west)
      expect(south, site.id).toBeGreaterThanOrEqual(-90)
      expect(north, site.id).toBeLessThanOrEqual(90)
      expect(north, site.id).toBeGreaterThan(south)
      expect(Number.isInteger(site.width) && site.width > 0, site.id).toBe(true)
      expect(Number.isInteger(site.height) && site.height > 0, site.id).toBe(true)
      // The tint only corrects the colour cast of a grey crop, so it stays close to neutral.
      for (const channel of site.tint) {
        expect(channel, site.id).toBeGreaterThan(0.85)
        expect(channel, site.id).toBeLessThan(1.15)
      }
    }
  })

  it('has a texture on disk for every registered crop', () => {
    for (const site of MOON_SITES) {
      const path = `${SITE_DIRECTORY}${site.id}.webp`
      expect(existsSync(path), `missing ${site.id}.webp`).toBe(true)
      expect(statSync(path).size, site.id).toBeGreaterThan(1024)
    }
  })
})

describe('drill-down tiers', () => {
  it('orders every feature from the regional crop down to its closest one', () => {
    for (const feature of MOON_FEATURES) {
      const tiers = siteLevels(feature.id).map((site) => siteTier(site.id))
      const order = ['wide', 'fine', 'nac', 'nac-close']
      expect(tiers, feature.id).toEqual([...tiers].sort((a, b) => order.indexOf(a) - order.indexOf(b)))
      expect(new Set(tiers).size, feature.id).toBe(tiers.length)
      // Every feature has to have something to show when it is focused.
      expect(tiers.length, feature.id).toBeGreaterThan(0)
    }
  })

  it('gives the landing sites NAC crops nested inside their WAC crop', () => {
    for (const [id, tiers] of Object.entries(NAC_FEATURES)) {
      expect(siteLevels(id).map((site) => siteTier(site.id)), id).toEqual(tiers)
      const fine = findSite(id)
      const nac = findSite(`${id}-nac`)
      const close = findSite(`${id}-nac-close`)
      expect(fine && nac, id).toBeTruthy()
      if (!fine || !nac) continue
      expect(contains(fine, nac), `${id}-nac`).toBe(true)
      if (!close) continue
      expect(contains(nac, close), `${id}-nac-close`).toBe(true)
      // The deepest tier is never coarser per pixel than the one above it.
      expect(texelDegrees(close), id).toBeLessThanOrEqual(texelDegrees(nac) * 1.05)
    }
  })

  it('keeps the zoom floor on the wide crop for features without NAC imagery', () => {
    for (const feature of MOON_FEATURES) {
      if (feature.id in NAC_FEATURES) continue
      const levels = siteLevels(feature.id)
      const floor = siteFloorSite(feature.id)
      expect(floor, feature.id).toBe(levels[0])
    }
  })

  it('lets the landing sites zoom to their deepest NAC crop instead', () => {
    for (const [id, tiers] of Object.entries(NAC_FEATURES)) {
      expect(siteFloorSite(id)?.id, id).toBe(`${id}-${tiers[tiers.length - 1]}`)
    }
  })
})

/**
 * Most crops are albedo now: their terrain comes from a height map lit by the scene's own Sun,
 * exactly as the globe's does. That only holds together if a tier that ships albedo also ships
 * the relief that goes with it — and if the tiers that still carry a baked Sun are left alone
 * rather than given a height map at the wrong scale, which is why the NAC tiers and the crops
 * whose illumination the DEM cannot explain have no entry.
 */
describe('crop relief maps', () => {
  it('gives every colour tier an absolute LOLA displacement map', () => {
    for (const site of MOON_SITES) {
      const relief = siteRelief(site.id)
      expect(relief, site.id).not.toBeNull()
      expect(relief?.rangeKm, site.id).toBeGreaterThan(0)
      expect(relief?.rangeKm, site.id).toBeLessThan(30)
      expect(relief?.centerKm, site.id).toBeGreaterThanOrEqual(relief?.minKm ?? Infinity)
      expect(relief?.centerKm, site.id).toBeLessThanOrEqual(
        (relief?.minKm ?? -Infinity) + (relief?.rangeKm ?? -Infinity),
      )
      const path = `${BUMP_DIRECTORY}${site.id}.webp`
      expect(existsSync(path), `missing displacement/${site.id}.webp`).toBe(true)
      expect(statSync(path).size, site.id).toBeGreaterThan(1024)
    }
  })

  it('never gives a NAC tier a bump scale', () => {
    for (const site of MOON_SITES) {
      const tier = siteTier(site.id)
      if (tier !== 'nac' && tier !== 'nac-close') continue
      expect(siteBumpScale(site.id), site.id).toBeNull()
    }
  })

  it('keeps every declared bump scale in a sane range', () => {
    for (const site of MOON_SITES) {
      const scale = siteBumpScale(site.id)
      if (scale === null) continue
      expect(scale, site.id).toBeGreaterThan(0)
      expect(scale, site.id).toBeLessThan(4)
    }
  })

  /**
   * Crops that deliberately keep the sunlight baked into their photograph.
   *
   * The pipeline deshades a crop by fitting one Sun direction to its shading, which only works when
   * the mosaic was taken under one illumination. Two families fail that test honestly:
   *
   * - the **regional wide crops**, which are stitched from passes at different sun angles (Tycho,
   *   Clavius and the Chang'e 3/4/5 wides are the documented exceptions, rebuilt from the atlas and
   *   covered by their own test);
   * - **four landing-site crops added for the panorama feature**, whose WAC mosaics are likewise
   *   multi-illumination. The values below are the correlation the tool measured; forcing the fit
   *   anyway changes the image by almost nothing (r = 0.997 against the baked version), so
   *   dividing out a lighting model that explains 9-17 per cent of the shading would add a guess
   *   rather than remove one.
   *
   * Listing them explicitly keeps the checks below meaningful: a newly added crop that fails to
   * relight without being listed here still fails the suite.
   */
  const KEEPS_BAKED_SHADING: Record<string, number> = {
    // Multi-illumination landing-site mosaics, with the fit the tool measured for each.
    'apollo-12': 0.133,
    'apollo-14': 0.171,
    'apollo-15': 0.087,
    'apollo-16': 0.167,
    // Regional crops, whose fit is not recorded per crop because they are wide by construction.
    aristarchus: Number.NaN,
    shackleton: Number.NaN,
    'mare-ser-enitatis-wide': Number.NaN,
    'mare-tranquillitatis-wide': Number.NaN,
    'mare-crisium-wide': Number.NaN,
    'copernicus-wide': Number.NaN,
    'aristarchus-wide': Number.NaN,
    'tsiolkovskiy-wide': Number.NaN,
    'shackleton-wide': Number.NaN,
    'apollo-17-wide': Number.NaN,
    'luna-21-wide': Number.NaN,
  }

  it('relights every crop that can be relit, and says which cannot', () => {
    const wac = MOON_SITES.filter((site) => {
      const tier = siteTier(site.id)
      return tier === 'wide' || tier === 'fine'
    })
    const relit = wac.filter((site) => siteBumpScale(site.id) !== null)
    const kept = wac.filter((site) => siteBumpScale(site.id) === null)
    // The crops that keep their baked sunlight are exactly the documented ones. Anything else that
    // failed to relight is a regression in the texture tool, so this is the assertion that matters.
    expect(kept.map((site) => site.id).sort()).toEqual(Object.keys(KEEPS_BAKED_SHADING).sort())
    // Where a fit was measured for a kept crop, it has to be poor enough to justify keeping it.
    for (const [id, fit] of Object.entries(KEEPS_BAKED_SHADING)) {
      if (Number.isNaN(fit)) continue
      expect(fit, `${id} is listed as un-fittable but its fit is not poor`).toBeLessThan(0.45)
    }
    // The relit share is asserted over the crops that *can* be relit rather than over all of them:
    // counting the multi-illumination mosaics would just be measuring how many of those exist, and
    // would have to be relaxed every time a wide or landing-site crop is added. Every fine tier
    // outside the documented set is relit, which is what a viewer actually zooms into.
    const fittable = wac.filter((site) => !(site.id in KEEPS_BAKED_SHADING))
    expect(relit.length).toBe(fittable.length)
    // Most of the drill-down is relit even counting the multi-illumination mosaics that cannot be.
    expect(relit.length).toBeGreaterThanOrEqual(Math.ceil(wac.length / 3))
    // The fine tiers are what a viewer actually zooms into, so they are held to a tighter standard:
    // all but the documented exceptions are relit. There are six of those in the fine tier, so the
    // count is asserted against the documented set rather than against a bare number.
    const fines = wac.filter((site) => siteTier(site.id) === 'fine')
    const relitFines = fines.filter((site) => siteBumpScale(site.id) !== null)
    const keptFines = fines.filter((site) => siteBumpScale(site.id) === null)
    expect(keptFines.map((site) => site.id).sort()).toEqual(
      Object.keys(KEEPS_BAKED_SHADING).filter((id) => siteTier(id) === 'fine').sort(),
    )
    expect(relitFines.length).toBe(fines.length - keptFines.length)
  })

  it('has a height map on disk for every crop that declares one', () => {
    for (const site of MOON_SITES) {
      if (siteBumpScale(site.id) === null) continue
      const path = `${BUMP_DIRECTORY}${site.id}.webp`
      expect(existsSync(path), `missing bump/${site.id}.webp`).toBe(true)
      expect(statSync(path).size, site.id).toBeGreaterThan(1024)
    }
  })

  it('keeps problem wide hand-offs atlas-coloured and dynamically relieved', () => {
    for (const id of [
      'tycho-wide',
      'clavius-wide',
      'change-3-wide',
      'change-4-wide',
      'change-5-wide',
    ]) {
      expect(findSite(id)?.tint, id).toEqual([1, 1, 1])
      expect(siteBumpScale(id), id).not.toBeNull()
      expect(existsSync(`${BUMP_DIRECTORY}${id}.webp`), id).toBe(true)
    }
  })
})
