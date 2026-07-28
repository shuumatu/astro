import { describe, expect, it } from 'vitest'
import {
  PRELOAD_MINUTE_RADIUS,
  adjacentTimeCalculationParameters,
  skyCalculationParametersKey,
} from './framePreload'
import type { SkyCalculationParameters } from './types'

const parameters: SkyCalculationParameters = {
  observedAt: '2026-07-28T12:00:00.000Z',
  observer: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
  magnitudeLimit: 5.5,
  minimumAltitudeDeg: 0,
  applyRefraction: true,
  cultureId: 'western-iau',
  interfaceLanguage: 'zh-CN',
  enabledFeaturedPatternIds: [],
}

describe('sky frame preloading', () => {
  it('builds 60 minutes in the preferred direction before the reverse direction', () => {
    const adjacent = adjacentTimeCalculationParameters(parameters)

    expect(adjacent).toHaveLength(PRELOAD_MINUTE_RADIUS * 2)
    expect(adjacent.slice(0, 4).map(({ observedAt }) => observedAt)).toEqual([
      '2026-07-28T12:01:00.000Z',
      '2026-07-28T12:02:00.000Z',
      '2026-07-28T12:03:00.000Z',
      '2026-07-28T12:04:00.000Z',
    ])
    expect(adjacent[PRELOAD_MINUTE_RADIUS - 1].observedAt).toBe('2026-07-28T13:00:00.000Z')
    expect(adjacent[PRELOAD_MINUTE_RADIUS].observedAt).toBe('2026-07-28T11:59:00.000Z')
    expect(adjacent.at(-1)?.observedAt).toBe('2026-07-28T11:00:00.000Z')
  })

  it('prioritizes previous minutes after reverse navigation', () => {
    const adjacent = adjacentTimeCalculationParameters(parameters, -1)

    expect(adjacent.slice(0, 2).map(({ observedAt }) => observedAt)).toEqual([
      '2026-07-28T11:59:00.000Z',
      '2026-07-28T11:58:00.000Z',
    ])
  })

  it('keys every calculation-affecting parameter', () => {
    const originalKey = skyCalculationParametersKey(parameters)

    expect(skyCalculationParametersKey({ ...parameters, magnitudeLimit: 4.5 })).not.toBe(originalKey)
    expect(skyCalculationParametersKey({
      ...parameters,
      observer: { ...parameters.observer, longitudeDeg: 120 },
    })).not.toBe(originalKey)
  })
})
