import { describe, expect, it } from 'vitest'
import { observationTimeForPreset } from './observationTime'

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
