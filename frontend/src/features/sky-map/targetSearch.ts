import { SOLAR_SYSTEM_BODY_IDS } from './types'
import type { SolarSystemBodyId } from './types'

export type ParsedSkyTarget =
  | { kind: 'star'; hipId: number }
  | { kind: 'solarSystemBody'; id: SolarSystemBodyId }
  | { kind: 'invalid' }

export function parseSkyTargetQuery(
  query: string,
  localizedBodyName: (id: SolarSystemBodyId) => string,
): ParsedSkyTarget {
  const normalized = normalize(query)
  if (!normalized) return { kind: 'invalid' }

  const bodyId = SOLAR_SYSTEM_BODY_IDS.find((id) => (
    normalized === normalize(id) || normalized === normalize(localizedBodyName(id))
  ))
  if (bodyId) return { kind: 'solarSystemBody', id: bodyId }

  const hipMatch = query.trim().match(/^(?:HIP\s*:?\s*)?([0-9]+)$/i)
  if (!hipMatch) return { kind: 'invalid' }
  const hipId = Number(hipMatch[1])
  return Number.isSafeInteger(hipId) && hipId > 0
    ? { kind: 'star', hipId }
    : { kind: 'invalid' }
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, '')
}
