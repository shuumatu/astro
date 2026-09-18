import { describe, expect, it } from 'vitest'
import en from '../../locales/en/common.json'
import zh from '../../locales/zh-CN/common.json'
import { CONTROL_LABEL_KEYS, demos } from './registry'
import { ECLIPSE_LOCALE_KEYS } from './scenes/eclipse/messages'

function resolve(bundle: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[part]
  }, bundle)
}

/**
 * Every demo is described entirely by locale keys, so a typo in one of them would only show up
 * as a raw key on screen. This walks the registry and resolves each key against both bundles.
 */
describe('demo registry locale keys', () => {
  it('resolves every key the registry and the demo shell need', () => {
    const bundles = [zh, en]
    const keys = new Set<string>([
      'demos.controls.speedValue',
      'demos.controls.speedValueDays',
      'demos.controls.playback',
      'demos.controls.play',
      'demos.controls.pause',
      'demos.controls.speed',
      'demos.controls.resetView',
      'demos.controls.sunLongitude',
      'demos.controls.fullBright',
      'demos.controls.fullscreen',
      'demos.controls.exitFullscreen',
      'demos.controls.hint',
      'demos.guide.start',
      'demos.guide.exit',
      'demos.guide.chapters',
      'demos.guide.previous',
      'demos.guide.next',
      'demos.guide.play',
      'demos.guide.pause',
      'demos.guide.replay',
      'demos.card.back',
      'demos.cinematic.entering',
    ])

    for (const demo of demos) {
      keys.add(demo.titleKey)
      keys.add(demo.summaryKey)
      if (demo.hintKey) keys.add(demo.hintKey)
      if (demo.cinematicKey) keys.add(demo.cinematicKey)
      if (demo.creditKey) keys.add(demo.creditKey)
      if (demo.speedUnitKey) keys.add(demo.speedUnitKey)
      if (demo.guide) {
        keys.add(demo.guide.titleKey)
        for (const step of demo.guide.steps) keys.add(step.subtitleKey)
      }
      if (demo.panelTitleKey) keys.add(demo.panelTitleKey)
      for (const control of demo.controls ?? ['orbits', 'labels']) keys.add(CONTROL_LABEL_KEYS[control])
      for (const action of demo.actions ?? []) keys.add(action.labelKey)
      for (const feature of demo.features ?? []) {
        keys.add(feature.titleKey)
        keys.add(feature.categoryKey)
      }
    }

    for (const key of keys) {
      for (const bundle of bundles) {
        const value = resolve(bundle, key)
        expect(typeof value, `missing ${key}`).toBe('string')
        expect((value as string).length, `empty ${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('gives each demo a distinct slug and a lazily loaded scene', () => {
    const slugs = demos.map((demo) => demo.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const demo of demos) expect(typeof demo.loadScene).toBe('function')
  })

  /**
   * A demo that ships its own control panel brings its own strings, which the registry walk above
   * cannot see: the panel names them itself. So the demo declares its whole key list in one module
   * and this resolves that list, which is the only way a renamed key in a panel would be caught.
   */
  it('resolves every key the eclipse panel and scene render', () => {
    expect(ECLIPSE_LOCALE_KEYS.length).toBeGreaterThan(40)
    expect(new Set(ECLIPSE_LOCALE_KEYS).size).toBe(ECLIPSE_LOCALE_KEYS.length)
    for (const key of ECLIPSE_LOCALE_KEYS) {
      for (const bundle of [zh, en]) {
        const value = resolve(bundle, key)
        expect(typeof value, `missing ${key}`).toBe('string')
        expect((value as string).length, `empty ${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('loads the eclipse control panel lazily and keeps it out of the shared settings', () => {
    const eclipse = demos.find((demo) => demo.slug === 'eclipses')
    expect(eclipse).toBeDefined()
    expect(typeof eclipse?.controlPanel).toBe('function')
    // Every display switch belongs to the panel, so the shared chips stay out of its way.
    expect(eclipse?.controls).toEqual([])
    // And nothing eclipse-shaped leaks into the settings every other demo has to carry.
    const settings = eclipse?.defaultSettings ?? {}
    expect(Object.keys(settings).sort()).toEqual(['playing', 'showLabels', 'showOrbits', 'timeScale'])
  })

  it('names the eclipse demo\'s own timeline in minutes per second', () => {
    const eclipse = demos.find((demo) => demo.slug === 'eclipses')
    expect(eclipse?.speedUnitKey).toBe('demos.items.eclipses.speedValue')
    expect(eclipse?.speedRange).toEqual({ min: 0.1, max: 20, step: 0.1 })
  })

  it('declares a complete, ordered eclipse tour with stable cue ids', () => {
    const steps = demos.find((demo) => demo.slug === 'eclipses')?.guide?.steps ?? []
    expect(steps.map((step) => step.id)).toEqual([
      'solar-alignment', 'solar-partial', 'solar-total',
      'lunar-alignment', 'lunar-partial', 'lunar-total', 'inclination',
    ])
    expect(steps.every((step) => step.durationMs >= 5000)).toBe(true)
    expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length)
  })

  /**
   * The Moon's lighting is a real Sun position, which needs exactly one angle: the selenographic
   * longitude of the sub-solar point. An earlier version exposed two - a local azimuth and a local
   * elevation over the camera - which described a lamp hung over the viewer rather than the Sun, so
   * the same place was lit from different directions depending on where you stood.
   */
  it('places the Moon\'s Sun with a single angle, not a lamp over the camera', () => {
    const moon = demos.find((demo) => demo.slug === 'moon')
    expect(moon?.actions ?? []).toHaveLength(0)
    expect(moon?.sunLongitudeRange).toEqual({ min: 0, max: 359, step: 1 })
    // The two-angle controls are gone, and nothing replaced them: the type no longer has a field for
    // them, so this checks the runtime shape too.
    expect('lighting' in (moon ?? {})).toBe(false)
    // The longitude is filled in by the scene from the real Sun position, so a placeholder here
    // would overwrite it.
    expect(moon?.defaultSettings?.sunLongitudeDeg).toBeUndefined()
    expect(moon?.cinematicKey).toBeNull()
    expect(moon?.defaultSettings?.fullBright).toBe(false)
  })

  /**
   * The Sun slider shows the bare angle, the way the brightness and speed sliders do. It briefly also
   * named the lunar phase the angle corresponds to; that is gone, so the strings are gone too rather
   * than left behind as dead entries.
   */
  it('does not carry lunar phase names for the Sun slider', () => {
    for (const bundle of [zh, en]) {
      const controls = bundle.demos.controls as Record<string, unknown>
      const phaseKeys = Object.keys(controls).filter((key) => key.startsWith('phase'))
      expect(phaseKeys, `unexpected phase strings: ${phaseKeys.join(', ')}`).toHaveLength(0)
      // The label and the plain readout remain.
      expect(typeof controls.sunLongitude).toBe('string')
    }
  })
})
