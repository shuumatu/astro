import type { TonightRecommendation, TonightTargetType } from './types'
import { intervalMinutes, MIN_RECOMMENDED_MINUTES } from './visibility'

export function scoreTarget(type: TonightTargetType, values: TonightRecommendation['scoreBreakdown']): number {
  const weights = type === 'moon' ? [0.3, 0.1, 0.2, 0.4]
    : type === 'planet' ? [0.35, 0.3, 0.2, 0.15]
      : type === 'star' ? [0.3, 0.4, 0.15, 0.15] : [0.25, 0.4, 0.2, 0.15]
  return Math.round(100 * (values.altitude * weights[0] + values.visibility * weights[1] + values.duration * weights[2] + values.interest * weights[3]))
}

/** Reserve category opportunities, then fill without repeating the same recognition core. */
export function selectFeatured(recommendations: TonightRecommendation[], limit = 5): string[] {
  const candidates = recommendations.filter((item) => intervalMinutes(item.recommendedWindow) >= MIN_RECOMMENDED_MINUTES)
  const selected: TonightRecommendation[] = []
  const overlaps = (item: TonightRecommendation) => selected.some((other) => {
    if (!item.memberIds.length || !other.memberIds.length) return item.targetId === other.targetId
    const common = item.memberIds.filter((id) => other.memberIds.includes(id)).length
    return common / Math.min(item.memberIds.length, other.memberIds.length) > 0.5
  })
  for (const types of [['moon'], ['planet'], ['constellation', 'asterism'], ['star']] as TonightTargetType[][]) {
    const candidate = candidates.find((item) => types.includes(item.targetType) && !overlaps(item))
    if (candidate && selected.length < limit) selected.push(candidate)
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break
    if (!overlaps(candidate)) selected.push(candidate)
  }
  return selected.sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId)).map((item) => item.targetId)
}
