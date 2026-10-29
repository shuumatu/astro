import { Body, Equator, Horizon, Observer, SearchRiseSet } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { buildNightContext } from './nightWindow'
import { buildSolarTimeline } from './solarTimeline'
import type { NightTimeline, TonightRequest } from './types'

const HOUR = 3_600_000
const request: TonightRequest = {
  observer: { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 },
  timeZone: 'Asia/Shanghai', nightDate: '2026-10-27', windowMode: 'all-night',
  nowUtc: '2026-10-27T10:00:00Z', environment: 'urban', cultureId: 'western-iau', interfaceLanguage: 'zh-CN',
}
const build = (overrides: Partial<TonightRequest> = {}) => {
  const input = { ...request, ...overrides }
  return buildSolarTimeline(input, buildNightContext(input))
}

function expectContinuousBands(timeline: NightTimeline) {
  expect(timeline.bands[0].startUtc).toBe(timeline.bounds.startUtc)
  expect(timeline.bands.at(-1)!.endUtc).toBe(timeline.bounds.endUtc)
  for (let index = 0; index < timeline.bands.length; index++) {
    const band = timeline.bands[index]
    expect(Date.parse(band.endUtc)).toBeGreaterThan(Date.parse(band.startUtc))
    if (index) expect(band.startUtc).toBe(timeline.bands[index - 1].endUtc)
  }
}

describe('solar system timeline', () => {
  it('covers local 16:00 through next-day 08:00 with all eight bodies in a stable order', () => {
    const timeline = build()
    expect(timeline.bounds).toEqual({ startUtc: '2026-10-27T08:00:00.000Z', endUtc: '2026-10-28T00:00:00.000Z' })
    expect(timeline.bodies.map((body) => body.targetId)).toEqual(['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'])
    expect(timeline.bodies.map((body) => body.name)).toEqual(['月球', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星'])
    expect(build({ interfaceLanguage: 'en' }).bodies[7].name).toBe('Neptune')
    for (const body of timeline.bodies) {
      expect(body.phaseFraction).toBeGreaterThanOrEqual(0)
      expect(body.phaseFraction).toBeLessThanOrEqual(1)
    }
  })

  it('uses geometric solar altitude for contiguous daylight and twilight bands', () => {
    const timeline = build()
    expectContinuousBands(timeline)
    expect(timeline.bands.map((band) => band.kind)).toEqual(['day', 'civil', 'nautical', 'astronomical', 'night', 'astronomical', 'nautical', 'civil', 'day'])
    const observer = new Observer(request.observer.latitudeDeg, request.observer.longitudeDeg, request.observer.elevationMeters)
    for (const band of timeline.bands) {
      const date = new Date((Date.parse(band.startUtc) + Date.parse(band.endUtc)) / 2)
      const equatorial = Equator(Body.Sun, date, observer, true, true)
      const altitude = Horizon(date, observer, equatorial.ra, equatorial.dec, '').altitude
      const expected = altitude >= 0 ? 'day' : altitude >= -6 ? 'civil' : altitude >= -12 ? 'nautical' : altitude >= -18 ? 'astronomical' : 'night'
      expect(band.kind).toBe(expected)
    }
  })

  it('labels actual rise/set events and leaves clipped chart edges unlabeled', () => {
    const timeline = build()
    const observer = new Observer(request.observer.latitudeDeg, request.observer.longitudeDeg, request.observer.elevationMeters)
    const start = new Date(timeline.bounds.startUtc)
    const days = (Date.parse(timeline.bounds.endUtc) - start.getTime()) / (24 * HOUR)
    let clippedWindows = 0
    for (const entry of timeline.bodies) {
      const body = (entry.targetId[0].toUpperCase() + entry.targetId.slice(1)) as Body
      expect(entry.riseUtc).toBe(SearchRiseSet(body, observer, 1, start, days)?.date.toISOString() ?? null)
      expect(entry.setUtc).toBe(SearchRiseSet(body, observer, -1, start, days)?.date.toISOString() ?? null)
      for (const window of entry.windows) {
        expect(window.startUtc >= timeline.bounds.startUtc).toBe(true)
        expect(window.endUtc <= timeline.bounds.endUtc).toBe(true)
        expect(window.startUtc < window.endUtc).toBe(true)
        if (window.startUtc === timeline.bounds.startUtc) {
          expect(entry.riseUtc).not.toBe(window.startUtc)
          clippedWindows++
        } else expect(window.startUtc).toBe(entry.riseUtc)
        if (window.endUtc === timeline.bounds.endUtc) {
          expect(entry.setUtc).not.toBe(window.endUtc)
          clippedWindows++
        } else expect(window.endUtc).toBe(entry.setUtc)
      }
    }
    expect(clippedWindows).toBeGreaterThan(0)
    const moon = timeline.bodies[0]
    expect(moon.riseUtc).not.toBeNull()
    expect(moon.setUtc).toBeNull()
    expect(moon.windows.at(-1)!.endUtc).toBe(timeline.bounds.endUtc)
  })

  it('keeps horizon windows independent of equipment, darkness and selected recommendation interval', () => {
    const fullNight = build()
    expect(build({ windowMode: 'next-hour', nowUtc: '2026-10-27T14:00:00Z', environment: 'dark' })).toEqual(fullNight)
    expect(build({ windowMode: 'custom', customStartLocal: '2026-10-27T20:00', customEndLocal: '2026-10-27T21:00' })).toEqual(fullNight)
  })

  it.each([
    ['2026-03-07', '2026-03-07T21:00:00.000Z', '2026-03-08T12:00:00.000Z', 15],
    ['2026-10-31', '2026-10-31T20:00:00.000Z', '2026-11-01T13:00:00.000Z', 17],
  ])('preserves local chart endpoints over the %s DST transition', (nightDate, startUtc, endUtc, hours) => {
    const timeline = build({ nightDate, timeZone: 'America/New_York', observer: { latitudeDeg: 40.7128, longitudeDeg: -74.006, elevationMeters: 10 } })
    expect(timeline.bounds).toEqual({ startUtc, endUtc })
    expect(Date.parse(endUtc) - Date.parse(startUtc)).toBe(Number(hours) * HOUR)
    expectContinuousBands(timeline)
  })

  it.each([
    ['2026-06-21', 'day'], ['2026-12-21', 'night'],
  ] as const)('handles polar conditions on %s while retaining real horizon crossings', (nightDate, kind) => {
    const timeline = build({ nightDate, timeZone: 'Etc/UTC', observer: { latitudeDeg: 89, longitudeDeg: 0, elevationMeters: 0 } })
    expect(timeline.bands).toEqual([{ ...timeline.bounds, kind }])
    for (const body of timeline.bodies) {
      if (!body.riseUtc && !body.setUtc) expect([[], [timeline.bounds]]).toContainEqual(body.windows)
      for (const at of [body.riseUtc, body.setUtc].filter(Boolean)) {
        expect(at! >= timeline.bounds.startUtc && at! <= timeline.bounds.endUtc).toBe(true)
      }
    }
    expect(timeline.bodies.some((body) => body.windows.length === 1 && body.windows[0].startUtc === timeline.bounds.startUtc && body.windows[0].endUtc === timeline.bounds.endUtc)).toBe(true)
    // Slowly changing declination can still produce real planetary or lunar
    // horizon crossings at high latitudes; polar night describes the Sun only.
    if (nightDate === '2026-12-21') expect(timeline.bodies.some(body => body.riseUtc || body.setUtc)).toBe(true)
  })

  it('keeps daytime custom and polar observing windows inside the chart', () => {
    const input = { ...request, windowMode: 'custom' as const, customStartLocal: '2026-10-27T12:30', customEndLocal: '2026-10-28T11:00' }
    const night = buildNightContext(input), timeline = buildSolarTimeline(input, night)
    expect(timeline.bounds).toEqual(night.bounds)
    expectContinuousBands(timeline)
  })
})
