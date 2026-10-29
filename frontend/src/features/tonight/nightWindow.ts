import { Body, Equator, Horizon, Observer, SearchAltitude, SearchRiseSet } from 'astronomy-engine'
import { SkyMapError } from '../sky-map/types'
import type { ObserverLocation } from '../sky-map/types'
import type { NightContext, TimeInterval, TonightRequest } from './types'

const HOUR = 3_600_000
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  if (!timeZone || timeZone.length > 100) invalid('请选择有效的 IANA 时区 / Invalid time zone')
  let value = formatters.get(timeZone)
  if (!value) {
    try {
      value = new Intl.DateTimeFormat('en-CA', { timeZone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    } catch { invalid('请选择有效的 IANA 时区 / Invalid time zone') }
    formatters.set(timeZone, value)
  }
  return value
}

function parts(date: Date, timeZone: string): Record<string, string> {
  return Object.fromEntries(formatter(timeZone).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
}

export function formatLocalDate(date: Date, timeZone: string): string {
  const value = parts(date, timeZone)
  return `${value.year}-${value.month}-${value.day}`
}

function localEpoch(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) invalid('日期或时间格式无效 / Invalid local date-time')
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (year < 1800 || year >= 2200 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59) invalid('日期须有效且在 1800–2199 年之间 / Invalid date or unsupported year')
  return date.getTime()
}

/** Exact round-trip conversion. Ambiguous/nonexistent civil times are rejected. */
export function localDateTimeToUtc(value: string, timeZone: string): string {
  return resolveCivilTime(value, timeZone, false)
}

// Calendar boundaries use the earlier repeated instant and move forward over gaps.
// User-entered custom times remain strict so an ambiguous choice is never guessed.
function resolveCivilTime(value: string, timeZone: string, boundary: boolean): string {
  const wall = localEpoch(value)
  const offsets = new Set<number>()
  for (const delta of [-36, -12, 0, 12, 36]) {
    const instant = wall + delta * HOUR
    const p = parts(new Date(instant), timeZone)
    offsets.add(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant)
  }
  const candidates = [...offsets].map((offset) => wall - offset).sort((a, b) => a - b)
  const matches = candidates.filter((instant) => {
    const p = parts(new Date(instant), timeZone)
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === value && p.second === '00'
  })
  if (!matches.length && boundary) return new Date(candidates[candidates.length - 1]).toISOString()
  if (!matches.length) invalid('该当地时间不存在（可能因夏令时切换）/ This local time does not exist')
  if (matches.length > 1 && !boundary) invalid('该当地时间重复（夏令时切换），请选择其他时刻 / Ambiguous local time')
  return new Date(matches[0]).toISOString()
}

function addDate(date: string, days: number): string {
  const instant = localEpoch(`${date}T12:00`) + days * 24 * HOUR
  return new Date(instant).toISOString().slice(0, 10)
}

function observerFor(location: ObserverLocation): Observer {
  if (!location || !Number.isFinite(location.latitudeDeg) || Math.abs(location.latitudeDeg) > 90
    || !Number.isFinite(location.longitudeDeg) || Math.abs(location.longitudeDeg) > 180
    || !Number.isFinite(location.elevationMeters) || location.elevationMeters < -500 || location.elevationMeters > 10_000) invalid('观测地点无效 / Invalid observing location')
  return new Observer(location.latitudeDeg, location.longitudeDeg, location.elevationMeters)
}

function solarAltitude(at: number, observer: Observer): number {
  const date = new Date(at), eq = Equator(Body.Sun, date, observer, true, true)
  return Horizon(date, observer, eq.ra, eq.dec, '').altitude
}

export function currentNightDate(now: Date, timeZone: string, location: ObserverLocation): string {
  const date = formatLocalDate(now, timeZone)
  const hour = +parts(now, timeZone).hour
  if (hour >= 12) return date
  const observer = observerFor(location)
  const midnight = new Date(resolveCivilTime(`${date}T00:00`, timeZone, true))
  const rise = SearchRiseSet(Body.Sun, observer, 1, midnight, 1)
  if (rise && now.getTime() < rise.date.getTime()) return addDate(date, -1)
  if (!rise && solarAltitude(now.getTime(), observer) < 0) return addDate(date, -1)
  return date
}

export function buildNightContext(request: TonightRequest): NightContext {
  const observer = observerFor(request.observer)
  if (!Number.isFinite(Date.parse(request.nowUtc)) || !/(Z|[+-]\d{2}:\d{2})$/.test(request.nowUtc)) invalid('当前时刻须带时区 / Current instant requires a time zone')
  const date = request.nightDate
  const nextDate = addDate(date, 1)
  const start = Date.parse(resolveCivilTime(`${date}T12:00`, request.timeZone, true))
  const end = Date.parse(resolveCivilTime(`${nextDate}T12:00`, request.timeZone, true))
  const midnight = Date.parse(resolveCivilTime(`${nextDate}T00:00`, request.timeZone, true))
  if (end <= start) invalid('所选日期在该时区不存在 / This date does not exist in this time zone')
  const limit = (end - start) / (24 * HOUR)
  const event = (body: Body, direction: number, altitude?: number): string | null => {
    const value = altitude === undefined
      ? SearchRiseSet(body, observer, direction, new Date(start), limit)
      : SearchAltitude(body, observer, direction, new Date(start), limit, altitude)
    return value && value.date.getTime() >= start && value.date.getTime() < end ? value.date.toISOString() : null
  }
  const sunsetUtc = event(Body.Sun, -1), sunriseUtc = event(Body.Sun, 1)
  const astronomicalDuskUtc = event(Body.Sun, -1, -18), astronomicalDawnUtc = event(Body.Sun, 1, -18)
  const solarSamples = Array.from({ length: 49 }, (_, index) => solarAltitude(start + (end - start) * index / 48, observer))
  const status: NightContext['status'] = !sunsetUtc && !sunriseUtc && Math.min(...solarSamples) >= -0.833 ? 'polar-day'
    : !sunsetUtc && !sunriseUtc && Math.max(...solarSamples) < -0.833 ? 'polar-night'
      : Math.min(...solarSamples) > -18 ? 'no-astronomical-night' : 'normal'
  const sunset = sunsetUtc ? Date.parse(sunsetUtc) : start
  const sunrise = sunriseUtc ? Date.parse(sunriseUtc) : end
  let from: number, to: number
  switch (request.windowMode) {
    case 'evening': from = sunset; to = midnight; break
    case 'late': from = midnight; to = sunrise; break
    case 'all-night': from = sunset; to = sunrise; break
    case 'next-hour': from = Math.max(start, Date.parse(request.nowUtc)); to = Math.min(end, Date.parse(request.nowUtc) + HOUR); break
    case 'custom':
      if (!request.customStartLocal || !request.customEndLocal) invalid('请选择完整的自定义时段 / Select both custom times')
      from = Date.parse(localDateTimeToUtc(request.customStartLocal, request.timeZone))
      to = Date.parse(localDateTimeToUtc(request.customEndLocal, request.timeZone))
      if (from < start || to > end || to <= from) invalid('自定义时段须在所选日期中午至次日中午内，且结束晚于开始 / Custom interval must be ordered and within the observing night')
      break
    default: invalid('观测时段无效 / Invalid observing interval')
  }
  from = Math.max(start, from)
  to = Math.min(end, to)
  const bounds = { startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString() }
  const interval: TimeInterval | null = to > from ? { startUtc: new Date(from).toISOString(), endUtc: new Date(to).toISOString() } : null
  return { nightDate: date, timeZone: request.timeZone, bounds, interval, status, sunsetUtc, sunriseUtc,
    civilDuskUtc: event(Body.Sun, -1, -6), nauticalDuskUtc: event(Body.Sun, -1, -12), astronomicalDuskUtc, astronomicalDawnUtc,
    moonriseUtc: event(Body.Moon, 1), moonsetUtc: event(Body.Moon, -1) }
}

function invalid(message: string): never { throw new SkyMapError('INVALID_PARAMETERS', message) }
