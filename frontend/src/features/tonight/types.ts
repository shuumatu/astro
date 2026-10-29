import type { ObserverLocation, SolarSystemBodyId } from '../sky-map/types'

export type TonightWindowMode = 'evening' | 'late' | 'all-night' | 'next-hour' | 'custom'
export type ObservingEnvironment = 'urban' | 'suburban' | 'dark' | 'unknown'
export type TonightTargetType = 'moon' | 'planet' | 'star' | 'constellation' | 'asterism'

export interface TimeInterval { startUtc: string; endUtc: string }

export interface NightTimeline {
  bounds: TimeInterval
  bands: Array<TimeInterval & { kind: 'day' | 'civil' | 'nautical' | 'astronomical' | 'night' }>
  bodies: Array<{
    targetId: Exclude<SolarSystemBodyId, 'sun'>
    name: string
    windows: TimeInterval[]
    riseUtc: string | null
    setUtc: string | null
    phaseFraction: number
  }>
}

export interface TonightRequest {
  observer: ObserverLocation
  timeZone: string
  nightDate: string
  windowMode: TonightWindowMode
  customStartLocal?: string
  customEndLocal?: string
  nowUtc: string
  environment: ObservingEnvironment
  cultureId: string
  interfaceLanguage: string
}

export interface NightContext {
  nightDate: string
  timeZone: string
  bounds: TimeInterval
  interval: TimeInterval | null
  status: 'normal' | 'polar-day' | 'polar-night' | 'no-astronomical-night'
  sunsetUtc: string | null
  sunriseUtc: string | null
  civilDuskUtc: string | null
  nauticalDuskUtc: string | null
  astronomicalDuskUtc: string | null
  astronomicalDawnUtc: string | null
  moonriseUtc: string | null
  moonsetUtc: string | null
}

export type ReasonCode = 'high-altitude' | 'bright' | 'long-window' | 'pattern-visible'
  | 'moon-phase' | 'moonlight' | 'low-altitude' | 'faint-members' | 'twilight' | 'short-window'

export interface RecommendationReason {
  code: ReasonCode
  atUtc?: string
  facts: Record<string, number | string>
}

export interface AltitudeSample {
  atUtc: string
  altitudeDeg: number
  eligible: boolean
}

export interface TonightRecommendation {
  targetId: string
  targetType: TonightTargetType
  name: string
  cultureId: string
  memberIds: string[]
  magnitude: number | null
  windows: TimeInterval[]
  recommendedWindow: TimeInterval
  bestAtUtc: string
  positionAtBest: { altitudeDeg: number; azimuthDeg: number }
  score: number
  scoreBreakdown: { altitude: number; visibility: number; duration: number; interest: number }
  reasons: RecommendationReason[]
  limitations: RecommendationReason[]
  samples: AltitudeSample[]
  phaseFraction?: number
  moonPhaseDeg?: number
  anchorName?: string
}

export type ExclusionCode = 'no-dark-window' | 'below-altitude' | 'too-faint' | 'incomplete-pattern' | 'window-too-short'

export interface TonightResult {
  request: TonightRequest
  night: NightContext
  timeline: NightTimeline
  recommendations: TonightRecommendation[]
  featuredIds: string[]
  excluded: Array<{ targetId: string; name: string; targetType: TonightTargetType; reason: ExclusionCode }>
  moon: { phaseFraction: number; phaseDeg: number; atUtc: string }
  computedAtUtc: string
  weatherStatus: 'not-requested'
  versions: { engine: string; policy: string; catalog: string; skyContent: string }
}
