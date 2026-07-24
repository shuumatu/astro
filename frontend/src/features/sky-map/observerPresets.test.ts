import { describe, expect, it } from 'vitest'
import {
  OBSERVER_PRESET_IDS,
  OBSERVER_PRESETS,
  observerLocationForPreset,
} from './observerPresets'

describe('observer presets', () => {
  it('provides the supported city presets in display order', () => {
    expect(OBSERVER_PRESET_IDS).toEqual(['shenzhen', 'beijing', 'shanghai', 'chengdu'])
    expect(Object.keys(OBSERVER_PRESETS)).toEqual(OBSERVER_PRESET_IDS)
  })

  it('uses the configured Shenzhen coordinates', () => {
    expect(observerLocationForPreset('shenzhen')).toEqual({
      latitudeDeg: 22.5431,
      longitudeDeg: 114.0579,
      elevationMeters: 20,
    })
  })

  it('returns a copy that cannot mutate the preset', () => {
    const location = observerLocationForPreset('chengdu')

    location.elevationMeters = 0

    expect(OBSERVER_PRESETS.chengdu.elevationMeters).toBe(500)
  })
})
