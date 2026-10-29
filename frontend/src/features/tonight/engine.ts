import { Body, Illumination, MoonPhase } from 'astronomy-engine'
import { SkyCoordinateSampler } from '../sky-map/coordinates'
import { SkyMapError } from '../sky-map/types'
import type { FeaturedPatternPack, HorizontalCoordinate, SkyCatalog, SkyCulturePack } from '../sky-map/types'
import { buildCandidates } from './candidates'
import type { ObservingCandidate } from './candidates'
import { buildNightContext } from './nightWindow'
import { buildSolarTimeline } from './solarTimeline'
import { scoreTarget, selectFeatured } from './ranking'
import { angularSeparation, findWindows, intervalMinutes, MINUTE, recognitionMagnitudeLimit } from './visibility'
import type { ExclusionCode, TonightRecommendation, TonightRequest, TonightResult } from './types'

export const TONIGHT_POLICY_VERSION = '1.0.0'
interface Evaluation {
  eligible: boolean
  exclusion: ExclusionCode
  position: HorizontalCoordinate
  qualityAltitude: number
  visibility: number
  magnitude: number | null
  sunAltitude: number
  moonAltitude: number
  moonSeparation: number
  moonFraction: number
  visibleMembers: number
}

export interface PlannerOptions {
  catalogVersion?: string
  skyContentVersion?: string
  cancelled?: () => boolean
  yieldControl?: () => Promise<void>
}

export async function planTonight(catalog: SkyCatalog, culture: SkyCulturePack, patterns: FeaturedPatternPack, request: TonightRequest, options: PlannerOptions = {}): Promise<TonightResult> {
  if (!['urban', 'suburban', 'dark', 'unknown'].includes(request.environment) || request.cultureId !== culture.id || !request.interfaceLanguage) {
    throw new SkyMapError('INVALID_PARAMETERS', 'Invalid observing environment, culture or language')
  }
  const night = buildNightContext(request)
  const moonAt = night.interval?.startUtc ?? night.bounds.startUtc
  const moonDate = new Date(moonAt)
  const result: TonightResult = {
    request: { ...request, observer: { ...request.observer } }, night,
    timeline: buildSolarTimeline(request, night),
    recommendations: [], featuredIds: [], excluded: [],
    moon: { phaseFraction: Illumination(Body.Moon, moonDate).phase_fraction, phaseDeg: MoonPhase(moonDate), atUtc: moonAt },
    computedAtUtc: new Date().toISOString(), weatherStatus: 'not-requested',
    versions: { engine: 'astronomy-engine@2.1.19', policy: TONIGHT_POLICY_VERSION, catalog: options.catalogVersion ?? 'unknown', skyContent: options.skyContentVersion ?? culture.version },
  }
  const candidates = buildCandidates(catalog, culture, patterns, request.interfaceLanguage)
  if (!night.interval) {
    result.excluded = candidates.map((target) => ({ targetId: target.id, name: target.name, targetType: target.type, reason: 'no-dark-window' }))
    return result
  }
  const sampler = new SkyCoordinateSampler(catalog)
  const starRecords = new Map(catalog.stars.map((star) => [star.id, star]))
  const snapshots = new Map<number, ReturnType<SkyCoordinateSampler['at']>>()
  const geometricSun = new Map<number, number>()
  const snapshot = (at: number) => {
    let value = snapshots.get(at)
    if (!value) {
      value = sampler.at(new Date(at), request.observer)
      snapshots.set(at, value)
    }
    return value
  }
  const evaluate = (candidate: ObservingCandidate, at: number): Evaluation => {
    const sky = snapshot(at)
    let sunAltitude = geometricSun.get(at)
    if (sunAltitude === undefined) {
      sunAltitude = sampler.at(new Date(at), request.observer, false).body('sun').altitudeDeg
      geometricSun.set(at, sunAltitude)
    }
    const moon = sky.body('moon')
    const body = candidate.bodyId ? sky.body(candidate.bodyId) : null
    const position = body ?? sky.star(candidate.anchorId!)!
    const magnitude = body?.visualMagnitude ?? candidate.magnitude
    const moonSeparation = angularSeparation(position, moon)
    const magLimit = (point: HorizontalCoordinate) => recognitionMagnitudeLimit(request.environment, moon.altitudeDeg, moon.phaseFraction, angularSeparation(point, moon), point.altitudeDeg)
    const minimumAltitude = candidate.id === 'mercury' ? 10 : candidate.id === 'venus' ? 15 : 20
    let darkLimit = candidate.type === 'moon' ? -3 : (magnitude ?? 5) < -3 ? -3 : (magnitude ?? 5) < -1 ? -5 : (magnitude ?? 5) <= 1 ? -6 : -9
    let qualityAltitude = position.altitudeDeg
    let visibility = clamp(((magLimit(position) - (magnitude ?? 0)) + 1) / 4)
    let visibleMembers = candidate.type === 'star' ? 1 : 0
    let eligible = true
    let exclusion: ExclusionCode = 'below-altitude'
    if (candidate.type === 'constellation' || candidate.type === 'asterism') {
      darkLimit = -12
      const members = candidate.memberIds.map((id) => ({ id, point: sky.star(id)!, magnitude: starRecords.get(id)!.visualMagnitude }))
      const visible = members.filter((member) => member.point.altitudeDeg >= minimumAltitude && member.magnitude <= magLimit(member.point))
      visibleMembers = visible.length
      const visibleIds = new Set(visible.map((member) => member.id))
      eligible = candidate.requiredIds.every((id) => visibleIds.has(id)) && visible.length >= Math.ceil(members.length * 0.8)
      exclusion = 'incomplete-pattern'
      qualityAltitude = Math.min(...members.filter((member) => candidate.requiredIds.includes(member.id)).map((member) => member.point.altitudeDeg))
      visibility = visible.length / members.length
    } else if (candidate.type === 'moon') {
      visibility = clamp(moon.phaseFraction * 8)
      eligible = moon.phaseFraction >= 0.03
      exclusion = 'too-faint'
    } else {
      eligible = magnitude !== null && magnitude <= magLimit(position)
      exclusion = 'too-faint'
    }
    if (position.altitudeDeg < minimumAltitude) { eligible = false; exclusion = 'below-altitude' }
    if (sunAltitude > darkLimit) { eligible = false; exclusion = 'no-dark-window' }
    return { eligible, exclusion, position, qualityAltitude, visibility, magnitude, sunAltitude, moonAltitude: moon.altitudeDeg, moonSeparation, moonFraction: moon.phaseFraction, visibleMembers }
  }
  const start = Date.parse(night.interval.startUtc), end = Date.parse(night.interval.endUtc)
  // A one-minute grid retains short near-threshold excursions and bounds gaps.
  // Only point positions are calculated; no rendered frames or region polygons.
  const times: number[] = []
  for (let at = start; at < end; at += MINUTE) times.push(at)
  times.push(end)
  const evaluations = candidates.map(() => [] as Evaluation[])
  const checkCancellation = () => {
    if (options.cancelled?.()) throw new SkyMapError('CALCULATION_CANCELLED', 'A newer observing request superseded this calculation')
  }
  for (let index = 0; index < times.length; index += 1) {
    checkCancellation()
    for (let target = 0; target < candidates.length; target += 1) evaluations[target].push(evaluate(candidates[target], times[index]))
    if (index % 15 === 14) await (options.yieldControl?.() ?? Promise.resolve())
  }

  for (let target = 0; target < candidates.length; target += 1) {
    checkCancellation()
    const candidate = candidates[target], values = evaluations[target]
    const windows = findWindows(times, values.map((value) => value.eligible), (at) => evaluate(candidate, at).eligible)
      .filter((window) => intervalMinutes(window) >= 5)
    if (!windows.length) {
      const counts = new Map<ExclusionCode, number>()
      for (const value of values) counts.set(value.exclusion, (counts.get(value.exclusion) ?? 0) + 1)
      const reason = values.some((value) => value.eligible) ? 'window-too-short' : [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'below-altitude'
      result.excluded.push({ targetId: candidate.id, name: candidate.name, targetType: candidate.type, reason })
      continue
    }
    const interest = (value: Evaluation) => candidate.type === 'moon' ? 0.6 + 0.4 * Math.sin(Math.PI * value.moonFraction) : candidate.type === 'star' ? 0.65 : 0.85
    const rated = windows.map((window) => {
      const first = Date.parse(window.startUtc), last = Date.parse(window.endUtc)
      const entries = times.map((at, index) => ({ at, value: values[index] })).filter((entry) => entry.at >= first && entry.at <= last && entry.value.eligible)
      const duration = clamp(intervalMinutes(window) / 120)
      const breakdownFor = (value: Evaluation) => ({ altitude: clamp((value.qualityAltitude - 10) / 50), visibility: value.visibility, duration, interest: interest(value) })
      const best = entries.reduce((a, b) => scoreTarget(candidate.type, breakdownFor(b.value)) > scoreTarget(candidate.type, breakdownFor(a.value)) ? b : a)
      const breakdown = entries.reduce((sum, entry) => {
        const value = breakdownFor(entry.value)
        return { altitude: sum.altitude + value.altitude / entries.length, visibility: sum.visibility + value.visibility / entries.length, duration, interest: sum.interest + value.interest / entries.length }
      }, { altitude: 0, visibility: 0, duration, interest: 0 })
      return { window, best, score: scoreTarget(candidate.type, breakdown), breakdown }
    }).sort((a, b) => b.score - a.score || intervalMinutes(b.window) - intervalMinutes(a.window))
    const chosen = rated[0], best = chosen.best.value, bestAtUtc = new Date(chosen.best.at).toISOString()
    const recommendation: TonightRecommendation = {
      targetId: candidate.id, targetType: candidate.type, name: candidate.name, cultureId: culture.id,
      memberIds: candidate.memberIds, magnitude: best.magnitude, windows, recommendedWindow: chosen.window,
      bestAtUtc, positionAtBest: { altitudeDeg: best.position.altitudeDeg, azimuthDeg: best.position.azimuthDeg }, score: chosen.score, scoreBreakdown: chosen.breakdown,
      reasons: [], limitations: [], anchorName: candidate.anchorName,
      samples: times.flatMap((at, index) => index % 5 === 0 || index === times.length - 1
        ? [{ atUtc: new Date(at).toISOString(), altitudeDeg: values[index].position.altitudeDeg, eligible: values[index].eligible }]
        : []),
    }
    if (best.qualityAltitude >= 30) recommendation.reasons.push({ code: 'high-altitude', atUtc: bestAtUtc, facts: { altitude: Math.round(best.qualityAltitude), pattern: candidate.type === 'constellation' || candidate.type === 'asterism' ? 1 : 0 } })
    if (candidate.type === 'moon') {
      recommendation.phaseFraction = best.moonFraction
      recommendation.moonPhaseDeg = MoonPhase(new Date(bestAtUtc))
      recommendation.reasons.push({ code: 'moon-phase', atUtc: bestAtUtc, facts: { fraction: Math.round(best.moonFraction * 100), phase: recommendation.moonPhaseDeg } })
    } else if (candidate.type === 'constellation' || candidate.type === 'asterism') {
      recommendation.reasons.push({ code: 'pattern-visible', atUtc: bestAtUtc, facts: { visible: best.visibleMembers, total: candidate.memberIds.length, anchor: candidate.anchorName ?? '' } })
      recommendation.limitations.push({ code: 'faint-members', facts: { coreOnly: 1 } })
    } else if (best.magnitude !== null) {
      recommendation.reasons.push({ code: 'bright', atUtc: bestAtUtc, facts: { magnitude: Number(best.magnitude.toFixed(1)) } })
    }
    recommendation.reasons.push({ code: 'long-window', facts: { minutes: Math.floor(intervalMinutes(chosen.window)) } })
    if (best.qualityAltitude < 30) recommendation.limitations.push({ code: 'low-altitude', atUtc: bestAtUtc, facts: { altitude: Math.round(best.qualityAltitude) } })
    if (best.sunAltitude > -12) recommendation.limitations.push({ code: 'twilight', atUtc: bestAtUtc, facts: { sunAltitude: Math.round(best.sunAltitude) } })
    if (candidate.type !== 'moon' && best.moonAltitude > 0 && best.moonFraction > 0.5) recommendation.limitations.push({ code: 'moonlight', atUtc: bestAtUtc, facts: { separation: Math.round(best.moonSeparation), fraction: Math.round(best.moonFraction * 100) } })
    if (intervalMinutes(chosen.window) < 20) recommendation.limitations.push({ code: 'short-window', facts: { minutes: Math.floor(intervalMinutes(chosen.window)) } })
    result.recommendations.push(recommendation)
    if (target % 10 === 9) await (options.yieldControl?.() ?? Promise.resolve())
  }
  result.recommendations.sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId))
  result.featuredIds = selectFeatured(result.recommendations)
  return result
}

function clamp(value: number): number { return Math.max(0, Math.min(1, value)) }
