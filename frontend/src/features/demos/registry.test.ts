import { describe, expect, it } from 'vitest'
import en from '../../locales/en/common.json'
import zh from '../../locales/zh-CN/common.json'
import { CONTROL_LABEL_KEYS, demos } from './registry'

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
      'demos.controls.lightAzimuth',
      'demos.controls.lightElevation',
      'demos.controls.fullBright',
      'demos.controls.fullscreen',
      'demos.controls.exitFullscreen',
      'demos.controls.hint',
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

  it('uses direct terrain lighting instead of lunar phase presets', () => {
    const moon = demos.find((demo) => demo.slug === 'moon')
    expect(moon?.actions ?? []).toHaveLength(0)
    expect(moon?.lighting).toEqual({
      azimuthRange: { min: 0, max: 359, step: 1 },
      elevationRange: { min: 5, max: 90, step: 1 },
    })
    expect(moon?.cinematicKey).toBeNull()
    expect(moon?.defaultSettings?.fullBright).toBe(false)
  })
})
