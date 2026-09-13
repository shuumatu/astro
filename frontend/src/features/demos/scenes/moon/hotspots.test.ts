import { describe, expect, it } from 'vitest'
import en from '../../../../locales/en/common.json'
import zh from '../../../../locales/zh-CN/common.json'
import {
  MOON_FEATURE_CATEGORIES,
  MOON_FEATURES,
  featureCategoryKey,
  featureTitleKey,
  panoramaTitleKey,
} from './hotspots'
import { MOON_PANORAMAS } from './moonPanoramas'

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

  /**
   * The panorama viewer names each panorama from its own locale key, and lists the controls in
   * the same block. A missing entry would show a raw key over a full-screen photograph, so it is
   * checked here rather than left to a manual look at the page.
   */
  it('has a title and caption for every panorama in every supported language', () => {
    for (const panorama of MOON_PANORAMAS) {
      expect(panoramaTitleKey(panorama.id)).toBe(`demos.items.moon.panorama.${panorama.id}.title`)
      for (const bundle of [zh, en]) {
        const block = bundle.demos.items.moon.panorama as Record<string, { title?: string, caption?: string }>
        const entry = block[panorama.id]
        expect(entry, `missing panorama text for ${panorama.id}`).toBeDefined()
        expect(entry.title?.length ?? 0, panorama.id).toBeGreaterThan(0)
        expect(entry.caption?.length ?? 0, panorama.id).toBeGreaterThan(40)
      }
    }
  })

  it('has viewer chrome strings in every supported language', () => {
    const keys = ['open', 'close', 'loading', 'failed', 'none', 'label', 'canvasAria', 'hint']
    for (const bundle of [zh, en]) {
      // The block holds both the chrome strings and one `{ title, caption }` object per
      // panorama, so the flat lookup needs the union widened rather than a direct cast.
      const block = bundle.demos.items.moon.panorama as unknown as Record<string, string>
      for (const key of keys) expect(block[key]?.length ?? 0, key).toBeGreaterThan(0)
    }
  })

  /**
   * The viewer asks for its strings through literal keys, which is exactly the kind of thing a
   * plural/singular slip breaks silently: the page renders the raw key over a photograph. This
   * checks the literals the component actually uses still resolve.
   */
  it('resolves every panorama key the viewer asks for', () => {
    const literals = ['open', 'close', 'loading', 'failed', 'none', 'label', 'canvasAria', 'hint', 'sweepModelled']
    for (const bundle of [zh, en]) {
      const moon = bundle.demos.items.moon as Record<string, unknown>
      const block = moon.panorama as Record<string, unknown>
      expect(block, 'the panorama block must be named in the singular, as the viewer asks for it').toBeDefined()
      for (const key of literals) expect(block[key], key).toBeDefined()
    }
  })

  /**
   * The viewer draws no compass direction, so it has nothing to disclaim. An earlier version carried
   * a note reading "north on screen is not north on the Moon", which described a label that does not
   * exist. This keeps that wording from returning without the feature.
   */
  it('carries no orientation disclaimer for a direction it never draws', () => {
    for (const bundle of [zh, en]) {
      const block = bundle.demos.items.moon.panorama as Record<string, unknown>
      expect(block.orientationApproximate, 'no compass direction is labelled, so nothing to disclaim')
        .toBeUndefined()
    }
  })
})
