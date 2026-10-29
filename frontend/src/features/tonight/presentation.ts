import { formatLocalDate } from './nightWindow'
import type { RecommendationReason, TonightTargetType } from './types'

export function timeLabel(instant: string | null, zone: string, nightDate: string, language: string): string {
  if (!instant) return '—'
  const date = new Date(instant), tomorrow = formatLocalDate(date, zone) !== nightDate
  const time = new Intl.DateTimeFormat(language, { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  return `${tomorrow ? language.startsWith('zh') ? '次日 ' : 'Next day ' : ''}${time}`
}

export function directionName(azimuth: number, language: string): string {
  return (language.startsWith('zh') ? ['北', '东北', '东', '东南', '南', '西南', '西', '西北'] : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])[Math.round(azimuth / 45) % 8]
}

export function typeName(type: TonightTargetType, language: string): string {
  const names = { moon: ['月球', 'Moon'], planet: ['行星', 'Planet'], star: ['亮星', 'Bright star'], constellation: ['星座', 'Constellation'], asterism: ['星群', 'Asterism'] }
  return names[type][language.startsWith('zh') ? 0 : 1]
}

export function moonPhaseName(phase: number, language: string): string {
  const names = [['新月', 'New moon'], ['蛾眉月', 'Waxing crescent'], ['上弦月', 'First quarter'], ['盈凸月', 'Waxing gibbous'], ['满月附近', 'Near full moon'], ['亏凸月', 'Waning gibbous'], ['下弦月', 'Last quarter'], ['残月', 'Waning crescent']]
  return names[Math.round(phase / 45) % 8][language.startsWith('zh') ? 0 : 1]
}

export function reasonText(reason: RecommendationReason, language: string): string {
  const zh = language.startsWith('zh'), f = reason.facts
  switch (reason.code) {
    case 'high-altitude': return f.pattern
      ? zh ? `最佳时刻的关键骨架星均在约 ${f.altitude}° 或更高处，较少受低空影响。` : `At the best time, key pattern stars are about ${f.altitude}° or higher, clear of the lowest sky.`
      : zh ? `最佳时刻高出地平线约 ${f.altitude}°，较少受低空影响。` : `About ${f.altitude}° above the horizon at the best time, clear of the lowest sky.`
    case 'bright': return zh ? `视星等约 ${f.magnitude}，适合裸眼寻找。` : `Magnitude ${f.magnitude}: a promising naked-eye target.`
    case 'long-window': return zh ? `有约 ${f.minutes} 分钟的连续观测窗口。` : `A continuous observing window of about ${f.minutes} minutes.`
    case 'pattern-visible': return zh ? `主要骨架 ${f.visible}/${f.total} 颗星满足条件，先找 ${f.anchor}。` : `${f.visible}/${f.total} core stars meet the conditions. Start with ${f.anchor}.`
    case 'moon-phase': return zh ? `月面受光约 ${f.fraction}%，${moonPhaseName(Number(f.phase), language)}；可辨认月相与明暗区域。` : `${f.fraction}% illuminated, ${moonPhaseName(Number(f.phase), language).toLowerCase()}; explore its phase and bright/dark regions.`
    case 'moonlight': return zh ? `月亮在地平线上，与目标约相隔 ${f.separation}°；暗星可能较难辨认。` : `The Moon is above the horizon, about ${f.separation}° away; fainter stars may be harder to see.`
    case 'low-altitude': return zh ? `评价高度约 ${f.altitude}°，请找对应方向无遮挡的位置。` : `Assessed altitude about ${f.altitude}°: find an unobstructed view in that direction.`
    case 'faint-members': return zh ? '只评估主要图形，较暗成员及整个星座天区不保证可见。' : 'Only the core pattern is assessed, not every faint member or the entire constellation region.'
    case 'twilight': return zh ? '天空仍有暮光或晨光，寻找目标会更有挑战。' : 'Twilight makes locating the target more challenging.'
    case 'short-window': return zh ? `窗口只有约 ${f.minutes} 分钟，请提前准备。` : `Only about ${f.minutes} minutes: be ready in advance.`
  }
}
