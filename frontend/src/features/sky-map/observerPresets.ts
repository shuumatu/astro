import type { ObserverLocation } from './types'

export const OBSERVER_PRESET_IDS = [
  'shenzhen',
  'beijing',
  'shanghai',
  'chengdu',
] as const

export type ObserverPresetId = (typeof OBSERVER_PRESET_IDS)[number]

export const OBSERVER_PRESETS = {
  shenzhen: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
  beijing: { latitudeDeg: 39.9042, longitudeDeg: 116.4074, elevationMeters: 44 },
  shanghai: { latitudeDeg: 31.2304, longitudeDeg: 121.4737, elevationMeters: 4 },
  chengdu: { latitudeDeg: 30.5728, longitudeDeg: 104.0668, elevationMeters: 500 },
} as const satisfies Record<ObserverPresetId, ObserverLocation>

export function observerLocationForPreset(preset: ObserverPresetId): ObserverLocation {
  return { ...OBSERVER_PRESETS[preset] }
}
