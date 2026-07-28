import type { SkyCalculationParameters } from './types'

export const PRELOAD_MINUTE_RADIUS = 60

export type TimeNavigationDirection = -1 | 1

export function skyCalculationParametersKey(parameters: SkyCalculationParameters): string {
  return JSON.stringify([
    parameters.observedAt,
    parameters.observer.latitudeDeg,
    parameters.observer.longitudeDeg,
    parameters.observer.elevationMeters,
    parameters.magnitudeLimit,
    parameters.minimumAltitudeDeg,
    parameters.applyRefraction,
    parameters.cultureId,
    parameters.interfaceLanguage,
    parameters.enabledFeaturedPatternIds,
  ])
}

export function adjacentTimeCalculationParameters(
  parameters: SkyCalculationParameters,
  preferredDirection: TimeNavigationDirection = 1,
): SkyCalculationParameters[] {
  const observedAtMs = Date.parse(parameters.observedAt)
  if (!Number.isFinite(observedAtMs)) return []
  const adjacent: SkyCalculationParameters[] = []
  for (const direction of [preferredDirection, -preferredDirection]) {
    for (let distance = 1; distance <= PRELOAD_MINUTE_RADIUS; distance += 1) {
      const observedAt = new Date(observedAtMs)
      observedAt.setMinutes(observedAt.getMinutes() + direction * distance)
      adjacent.push({
        ...parameters,
        observedAt: observedAt.toISOString(),
        observer: { ...parameters.observer },
        enabledFeaturedPatternIds: [...parameters.enabledFeaturedPatternIds],
      })
    }
  }
  return adjacent
}
