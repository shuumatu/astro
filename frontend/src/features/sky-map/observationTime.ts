export const OBSERVATION_TIME_PRESETS = ['now', 'tonight', 'tomorrowEvening'] as const

export type ObservationTimePreset = (typeof OBSERVATION_TIME_PRESETS)[number]

export function observationTimeForPreset(
  preset: ObservationTimePreset,
  now = new Date(),
): Date {
  const result = new Date(now)
  if (preset === 'now') return result
  if (preset === 'tomorrowEvening') result.setDate(result.getDate() + 1)
  result.setHours(20, 0, 0, 0)
  return result
}
