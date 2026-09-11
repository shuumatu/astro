import { describe, expect, it } from 'vitest'
import en from '../../../../locales/en/common.json'
import zh from '../../../../locales/zh-CN/common.json'
import { MOON_FEATURE_CATEGORIES, MOON_FEATURES, featureCategoryKey, featureTitleKey } from './hotspots'

describe('lunar features', () => {
  it('has unique identifiers', () => {
    const ids = MOON_FEATURES.map((feature) => feature.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('places every feature inside selenographic bounds', () => {
    for (const feature of MOON_FEATURES) {
      expect(feature.latDeg).toBeGreaterThanOrEqual(-90)
      expect(feature.latDeg).toBeLessThanOrEqual(90)
      expect(feature.lonDeg).toBeGreaterThanOrEqual(-180)
      expect(feature.lonDeg).toBeLessThanOrEqual(180)
      expect(feature.focusAltitudeKm).toBeGreaterThan(0)
      if (feature.diameterKm !== undefined) expect(feature.diameterKm).toBeGreaterThan(0)
    }
  })

  it('covers both natural terrain and landing sites', () => {
    const categories = new Set(MOON_FEATURES.map((feature) => feature.category))
    for (const category of MOON_FEATURE_CATEGORIES) expect(categories.has(category)).toBe(true)
    expect(MOON_FEATURES.filter((feature) => feature.category === 'landingSite').length).toBeGreaterThanOrEqual(5)
  })

  /**
   * Every feature is labelled and described from the locale files, so a typo in an id would
   * otherwise only show up as a raw key on screen.
   */
  it('has a title and a description in every supported language', () => {
    for (const feature of MOON_FEATURES) {
      for (const bundle of [zh, en]) {
        const hotspots = bundle.demos.items.moon.hotspots as Record<string, { title?: string, body?: string }>
        const entry = hotspots[feature.id]
        expect(entry, `missing ${feature.id}`).toBeDefined()
        expect(entry.title?.length ?? 0).toBeGreaterThan(0)
        // Two or three sentences: long enough to teach, short enough to read in the card.
        expect(entry.body?.length ?? 0).toBeGreaterThan(40)
        expect(featureTitleKey(feature.id)).toBe(`demos.items.moon.hotspots.${feature.id}.title`)
      }
    }
  })

  it('has category names in every supported language', () => {
    for (const category of MOON_FEATURE_CATEGORIES) {
      const key = featureCategoryKey(category).replace('demos.items.moon.categories.', '')
      for (const bundle of [zh, en]) {
        const categories = bundle.demos.items.moon.categories as Record<string, string>
        expect(categories[key]?.length ?? 0).toBeGreaterThan(0)
      }
    }
  })
})
