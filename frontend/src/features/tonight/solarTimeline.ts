import { Atmosphere, Body, Equator, Horizon, Illumination, KM_PER_AU, Observer, SearchAltitude, SearchRiseSet } from 'astronomy-engine'
import type { AstroTime } from 'astronomy-engine'
import type { NightContext, NightTimeline, TimeInterval, TonightRequest } from './types'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const BODIES = [
  ['moon', Body.Moon, '月球'], ['mercury', Body.Mercury, '水星'],
  ['venus', Body.Venus, '金星'], ['mars', Body.Mars, '火星'],
  ['jupiter', Body.Jupiter, '木星'], ['saturn', Body.Saturn, '土星'],
  ['uranus', Body.Uranus, '天王星'], ['neptune', Body.Neptune, '海王星'],
] as const

const iso = (at: number) => new Date(at).toISOString()
const interval = (start: number, end: number): TimeInterval => ({ startUtc: iso(start), endUtc: iso(end) })

// A repeated search retains short polar rise/set pairs, without depending on a
// sampling grid. Moving one second forward avoids returning the same event.
function eventsBetween(start: number, end: number, search: (date: Date, days: number) => AstroTime | null): number[] {
  const events: number[] = []
  for (let cursor = start; cursor < end;) {
    const found = search(new Date(cursor), (end - cursor) / DAY)
    if (!found) break
    const at = found.date.getTime()
    if (at < cursor || at > end) break
    events.push(at)
    cursor = at + 1000
  }
  return events
}

function geometricAltitude(body: Body, at: number, observer: Observer): number {
  const date = new Date(at)
  const equatorial = Equator(body, date, observer, true, true)
  return Horizon(date, observer, equatorial.ra, equatorial.dec, '').altitude
}

function daylightKind(altitude: number): NightTimeline['bands'][number]['kind'] {
  if (altitude >= 0) return 'day'
  if (altitude >= -6) return 'civil'
  if (altitude >= -12) return 'nautical'
  if (altitude >= -18) return 'astronomical'
  return 'night'
}

function aboveHorizon(body: Body, at: number, observer: Observer): boolean {
  const date = new Date(at)
  const equatorial = Equator(body, date, observer, true, true)
  const altitude = Horizon(date, observer, equatorial.ra, equatorial.dec, '').altitude
  // Match SearchRiseSet: standard density-adjusted 34' refraction and the
  // Moon's upper limb. Other planets are treated as points by Astronomy Engine.
  const radius = body === Body.Moon ? Math.asin(1738.1 / KM_PER_AU / equatorial.dist) * 180 / Math.PI : 0
  return altitude + radius + (34 / 60) * Atmosphere(observer.height).density >= 0
}

/** Full evening-to-morning ephemeris, independent of recommendation filters. */
export function buildSolarTimeline(request: TonightRequest, night: NightContext): NightTimeline {
  const observer = new Observer(request.observer.latitudeDeg, request.observer.longitudeDeg, request.observer.elevationMeters)
  // Night bounds are local noon to next noon. Retaining their UTC difference
  // preserves 23/25-hour civil days when the clocks change overnight.
  const noon = Date.parse(night.bounds.startUtc), nextNoon = Date.parse(night.bounds.endUtc)
  // Retain the selected interval at high latitudes and for daytime custom
  // windows instead of clipping valid recommendations off the chart.
  const start = night.interval && Date.parse(night.interval.startUtc) < noon + 4 * HOUR ? noon : noon + 4 * HOUR
  const end = night.interval && Date.parse(night.interval.endUtc) > nextNoon - 4 * HOUR ? nextNoon : nextNoon - 4 * HOUR
  const bounds = interval(start, end)
  const boundaries = new Set([start, end])
  for (const altitude of [0, -6, -12, -18]) {
    for (const direction of [-1, 1]) {
      for (const at of eventsBetween(start, end, (date, days) => SearchAltitude(Body.Sun, observer, direction, date, days, altitude))) {
        boundaries.add(at)
      }
    }
  }
  const times = [...boundaries].sort((a, b) => a - b)
  const bands: NightTimeline['bands'] = []
  for (let index = 1; index < times.length; index++) {
    const from = times[index - 1], to = times[index]
    const kind = daylightKind(geometricAltitude(Body.Sun, (from + to) / 2, observer))
    const previous = bands.at(-1)
    if (previous?.kind === kind) previous.endUtc = iso(to)
    else bands.push({ ...interval(from, to), kind })
  }
  const bodies: NightTimeline['bodies'] = BODIES.map(([targetId, body, chineseName]) => {
    const rises = eventsBetween(start, end, (date, days) => SearchRiseSet(body, observer, 1, date, days))
    const sets = eventsBetween(start, end, (date, days) => SearchRiseSet(body, observer, -1, date, days))
    const crossings = [
      ...rises.map((at) => ({ at, rising: true })),
      ...sets.map((at) => ({ at, rising: false })),
    ].sort((a, b) => a.at - b.at)
    let visible = crossings.length ? !crossings[0].rising : aboveHorizon(body, start, observer)
    let from = start
    const windows: TimeInterval[] = []
    for (const crossing of crossings) {
      if (visible && crossing.at > from) windows.push(interval(from, crossing.at))
      visible = crossing.rising
      from = crossing.at
    }
    if (visible && end > from) windows.push(interval(from, end))
    return {
      targetId, name: request.interfaceLanguage.startsWith('zh') ? chineseName : body,
      windows, riseUtc: rises.length ? iso(rises[0]) : null, setUtc: sets.length ? iso(sets[0]) : null,
      phaseFraction: Illumination(body, new Date((start + end) / 2)).phase_fraction,
    }
  })
  return { bounds, bands, bodies }
}
