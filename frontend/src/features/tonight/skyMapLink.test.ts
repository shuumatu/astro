import { describe, expect, it } from 'vitest'
import { parseSkyMapLink, selectionForObservingLink, tonightSkyMapLocation } from './skyMapLink'
import type { SkyFrame } from '../sky-map/types'
import type { TonightRecommendation, TonightRequest } from './types'

const observer = { latitudeDeg: 22.5431, longitudeDeg: 114.0579, elevationMeters: 20 }
const query = { at: '2026-10-27T21:24:36.123+08:00', lat: '22.5431', lon: '114.0579', elevation: '20', culture: 'western-iau', targetId: 'saturn', targetType: 'planet', timeZone: 'Asia/Shanghai' }
describe('observing links', () => {
  it('retains the exact instant, coordinates and target across link creation and parsing', () => {
    const link = parseSkyMapLink(query)!
    const target = { bestAtUtc: link.at, targetId: 'saturn', targetType: 'planet', cultureId: link.cultureId } as TonightRecommendation
    const request = { observer, timeZone: link.timeZone } as TonightRequest
    expect(parseSkyMapLink(tonightSkyMapLocation(target, request).query)).toEqual(link)
    expect(link.at).toBe('2026-10-27T13:24:36.123Z')
    expect(parseSkyMapLink({})).toBeNull()
  })
  it('rejects incomplete, repeated, out-of-range or mismatched target parameters', () => {
    for (const change of [{ lon: '' }, { lat: '91' }, { elevation: 'Infinity' }, { at: '2026-10-27T20:00:00' }, { at: ['a', 'b'] }, { targetId: 'sun' }, { targetType: 'star' }, { timeZone: 'Wrong/Zone' }]) {
      expect(() => parseSkyMapLink({ ...query, ...change })).toThrow()
    }
  })
  it('waits for the exact frame instead of selecting a target in an old time or place', () => {
    const link = parseSkyMapLink(query)!
    const frame = { observedAt: link.at, cultureId: link.cultureId, observer, solarSystemBodies: [{ id: 'saturn' }] } as SkyFrame
    expect(selectionForObservingLink(link, frame)).toMatchObject({ kind: 'solarSystemBody', object: { id: 'saturn' } })
    expect(selectionForObservingLink(link, { ...frame, observedAt: '2026-10-27T13:24:00.000Z' })).toBeNull()
    expect(selectionForObservingLink(link, { ...frame, observer: { ...observer, longitudeDeg: 0 } })).toBeNull()
    expect(selectionForObservingLink(link, { ...frame, solarSystemBodies: [] })).toBeNull()
  })
})
