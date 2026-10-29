import { describe, expect, it } from 'vitest'
import { buildNightContext, currentNightDate, localDateTimeToUtc } from './nightWindow'
import type { TonightRequest } from './types'

const request: TonightRequest = { observer: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 }, timeZone: 'Asia/Shanghai', nightDate: '2026-10-27', windowMode: 'all-night', nowUtc: '2026-10-27T10:00:00Z', environment: 'urban', cultureId: 'western-iau', interfaceLanguage: 'zh-CN' }

describe('observing location civil time', () => {
  it('converts civil time independently of the machine time zone', () => {
    expect(localDateTimeToUtc('2026-10-27T20:00', 'Asia/Shanghai')).toBe('2026-10-27T12:00:00.000Z')
    expect(localDateTimeToUtc('2026-07-01T20:00', 'America/New_York')).toBe('2026-07-02T00:00:00.000Z')
  })
  it('rejects missing and repeated DST times', () => {
    expect(() => localDateTimeToUtc('2026-03-08T02:30', 'America/New_York')).toThrow(/不存在/)
    expect(() => localDateTimeToUtc('2026-11-01T01:30', 'America/New_York')).toThrow(/重复/)
  })
  it('rejects invalid dates and zones instead of normalizing them', () => {
    expect(() => localDateTimeToUtc('2026-02-30T20:00', 'Asia/Shanghai')).toThrow()
    expect(() => localDateTimeToUtc('2026-02-28T20:00', 'Wrong/Zone')).toThrow()
  })
  it('keeps the ongoing night after midnight', () => {
    expect(currentNightDate(new Date('2026-10-27T18:00:00Z'), 'Asia/Shanghai', request.observer)).toBe('2026-10-27')
  })
})

describe('night intervals', () => {
  it('orders sunset, twilight and next-day sunrise', () => {
    const night = buildNightContext(request)
    expect(night.status).toBe('normal')
    expect(night.sunsetUtc! < night.civilDuskUtc!).toBe(true)
    expect(night.civilDuskUtc! < night.astronomicalDuskUtc!).toBe(true)
    expect(night.astronomicalDuskUtc! < night.sunriseUtc!).toBe(true)
    expect(night.interval).toEqual({ startUtc: night.sunsetUtc, endUtc: night.sunriseUtc })
  })
  it('handles the 25-hour civil night at a DST transition', () => {
    const night = buildNightContext({ ...request, timeZone: 'America/New_York', nightDate: '2026-10-31' })
    expect(Date.parse(night.bounds.endUtc) - Date.parse(night.bounds.startUtc)).toBe(25 * 3_600_000)
  })
  it('does not manufacture sun events at high latitude', () => {
    const observer = { latitudeDeg: 69.65, longitudeDeg: 18.96, elevationMeters: 0 }
    const summer = buildNightContext({ ...request, observer, timeZone: 'Europe/Oslo', nightDate: '2026-06-21' })
    expect(summer.status).toBe('polar-day')
    expect(summer.sunsetUtc).toBeNull()
    const winter = buildNightContext({ ...request, observer, timeZone: 'Europe/Oslo', nightDate: '2026-12-21' })
    expect(winter.status).toBe('polar-night')
    expect(winter.sunriseUtc).toBeNull()
  })
  it('handles midnight DST boundaries while keeping custom civil times strict', () => {
    const observer = { latitudeDeg: 23.11, longitudeDeg: -82.37, elevationMeters: 0 }
    const spring = buildNightContext({ ...request, observer, timeZone: 'America/Havana', nightDate: '2026-03-07' })
    const fall = buildNightContext({ ...request, observer, timeZone: 'America/Havana', nightDate: '2026-10-31' })
    expect(Date.parse(spring.bounds.endUtc) - Date.parse(spring.bounds.startUtc)).toBe(23 * 3_600_000)
    expect(Date.parse(fall.bounds.endUtc) - Date.parse(fall.bounds.startUtc)).toBe(25 * 3_600_000)
    expect(() => localDateTimeToUtc('2026-03-08T00:00', 'America/Havana')).toThrow(/不存在/)
    expect(() => localDateTimeToUtc('2026-11-01T00:00', 'America/Havana')).toThrow(/重复/)
  })
  it('clips next hour and validates custom times', () => {
    const next = buildNightContext({ ...request, windowMode: 'next-hour', nowUtc: '2026-10-27T14:00:00Z' })
    expect(next.interval).toEqual({ startUtc: '2026-10-27T14:00:00.000Z', endUtc: '2026-10-27T15:00:00.000Z' })
    expect(buildNightContext({ ...request, windowMode: 'next-hour', nowUtc: '2027-01-01T00:00:00Z' }).interval).toBeNull()
    expect(() => buildNightContext({ ...request, windowMode: 'custom', customStartLocal: '2026-10-27T20:00', customEndLocal: '2026-10-27T19:00' })).toThrow()
  })
})
