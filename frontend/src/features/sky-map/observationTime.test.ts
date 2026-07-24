import { describe, expect, it } from 'vitest'
import {
  accumulateObservationTimeWheel,
  observationTimeForPreset,
  shiftObservationTime,
} from './observationTime'

describe('observationTimeForPreset', () => {
  it('keeps the supplied instant for the current-time preset', () => {
    const now = new Date(2026, 6, 24, 11, 15, 30, 250)

    const result = observationTimeForPreset('now', now)

    expect(result.getTime()).toBe(now.getTime())
    expect(result).not.toBe(now)
  })

  it('uses 20:00 local time for tonight', () => {
    const result = observationTimeForPreset('tonight', new Date(2026, 6, 24, 11, 15))

    expect(localParts(result)).toEqual([2026, 7, 24, 20, 0, 0, 0])
  })

  it('rolls tomorrow evening across month and year boundaries', () => {
    const result = observationTimeForPreset('tomorrowEvening', new Date(2026, 11, 31, 23, 15))

    expect(localParts(result)).toEqual([2027, 1, 1, 20, 0, 0, 0])
  })
})

describe('shiftObservationTime', () => {
  it.each([
    ['previousDay', new Date(2026, 0, 1, 0, 30), [2025, 12, 31, 0, 30]],
    ['previousHour', new Date(2026, 6, 24, 0, 30), [2026, 7, 23, 23, 30]],
    ['nextHour', new Date(2026, 6, 24, 23, 30), [2026, 7, 25, 0, 30]],
    ['previousMinute', new Date(2026, 6, 24, 0, 0), [2026, 7, 23, 23, 59]],
    ['nextMinute', new Date(2026, 6, 24, 23, 59), [2026, 7, 25, 0, 0]],
    ['nextDay', new Date(2026, 11, 31, 23, 30), [2027, 1, 1, 23, 30]],
  ] as const)('applies the %s step across calendar boundaries', (step, date, expected) => {
    expect(localParts(shiftObservationTime(date, step)).slice(0, 5)).toEqual(expected)
  })

  it('does not mutate the supplied date', () => {
    const date = new Date(2026, 6, 24, 12, 30)

    shiftObservationTime(date, 'nextHour')

    expect(localParts(date).slice(0, 5)).toEqual([2026, 7, 24, 12, 30])
  })
})

describe('accumulateObservationTimeWheel', () => {
  it('maps an upward wheel step to the next minute', () => {
    expect(accumulateObservationTimeWheel(0, -100)).toEqual({
      accumulatedDelta: 0,
      step: 'nextMinute',
    })
  })

  it('maps a downward wheel step to the previous minute', () => {
    expect(accumulateObservationTimeWheel(0, 100)).toEqual({
      accumulatedDelta: 0,
      step: 'previousMinute',
    })
  })

  it('accumulates high-resolution wheel movement until a complete step', () => {
    const partial = accumulateObservationTimeWheel(0, -30)

    expect(partial).toEqual({ accumulatedDelta: -30, step: null })
    expect(accumulateObservationTimeWheel(partial.accumulatedDelta, -55)).toEqual({
      accumulatedDelta: 0,
      step: 'nextMinute',
    })
  })

  it('resets partial movement when the wheel reverses direction', () => {
    expect(accumulateObservationTimeWheel(50, -40)).toEqual({
      accumulatedDelta: -40,
      step: null,
    })
  })
})

function localParts(date: Date): number[] {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ]
}
