import type { LocationQuery } from 'vue-router'
import type { ObserverLocation, SkyFrame, SkyObjectSelection } from '../sky-map/types'
import type { TonightRecommendation, TonightRequest, TonightTargetType } from './types'

export interface SkyMapLink {
  at: string
  observer: ObserverLocation
  cultureId: string
  targetId: string
  targetType: TonightTargetType
  timeZone: string
}

export function tonightSkyMapLocation(target: TonightRecommendation, request: TonightRequest) {
  return { path: '/sky-map', query: { at: target.bestAtUtc, lat: String(request.observer.latitudeDeg), lon: String(request.observer.longitudeDeg), elevation: String(request.observer.elevationMeters), culture: target.cultureId, targetId: target.targetId, targetType: target.targetType, timeZone: request.timeZone } }
}

export function parseSkyMapLink(query: LocationQuery): SkyMapLink | null {
  if (!['at', 'targetId', 'targetType', 'lat', 'lon'].some((key) => key in query)) return null
  const string = (key: string) => { const value = query[key]; if (typeof value !== 'string' || !value) throw new Error('观测链接参数不完整 / Incomplete observing link'); return value }
  const number = (key: string, minimum: number, maximum: number) => { const value = Number(string(key)); if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error('观测链接坐标无效 / Invalid observing coordinates'); return value }
  const instant = string('at'), date = new Date(instant)
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(instant) || !Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1800 || date.getUTCFullYear() >= 2200) throw new Error('观测链接时刻无效 / Invalid observing instant')
  const timeZone = string('timeZone')
  new Intl.DateTimeFormat('en', { timeZone }).format(date)
  const cultureId = string('culture')
  if (!['western-iau', 'chinese-traditional'].includes(cultureId)) throw new Error('星空文化无效 / Invalid sky culture')
  const targetType = string('targetType') as TonightTargetType, targetId = string('targetId')
  const valid = targetType === 'star' ? /^HIP:[1-9]\d*$/.test(targetId)
    : targetType === 'moon' ? targetId === 'moon'
      : targetType === 'planet' ? ['mercury', 'venus', 'mars', 'jupiter', 'saturn'].includes(targetId)
        : targetType === 'asterism' ? ['summer-triangle', 'winter-triangle'].includes(targetId)
          : targetType === 'constellation' && /^constellation-[a-z]{3}$/.test(targetId)
  if (!valid) throw new Error('观测目标无效 / Invalid observing target')
  return { at: date.toISOString(), observer: { latitudeDeg: number('lat', -90, 90), longitudeDeg: number('lon', -180, 180), elevationMeters: number('elevation', -500, 10_000) }, cultureId, targetId, targetType, timeZone }
}

export function selectionForObservingLink(link: SkyMapLink, frame: SkyFrame): SkyObjectSelection | null {
  if (link.at !== frame.observedAt || link.cultureId !== frame.cultureId || Object.entries(link.observer).some(([key, value]) => frame.observer[key as keyof ObserverLocation] !== value)) return null
  if (link.targetType === 'star') { const object = frame.stars.find((star) => star.id === link.targetId); return object ? { kind: 'star', object } : null }
  if (link.targetType === 'constellation') { const object = frame.cultureFigures.find((figure) => figure.id === link.targetId); return object ? { kind: 'cultureFigure', object } : null }
  if (link.targetType === 'asterism') { const object = frame.featuredPatterns.find((pattern) => pattern.id === link.targetId); return object ? { kind: 'featuredPattern', object } : null }
  const object = frame.solarSystemBodies.find((body) => body.id === link.targetId)
  return object ? { kind: 'solarSystemBody', object } : null
}
