export const OBSERVATION_TIME_PRESETS = ['now', 'tonight', 'tomorrowEvening'] as const
export const OBSERVATION_TIME_STEPS = [
  'previousDay',
  'previousHour',
  'nextHour',
  'nextDay',
] as const

export type ObservationTimePreset = (typeof OBSERVATION_TIME_PRESETS)[number]
export type ObservationTimeStep = (typeof OBSERVATION_TIME_STEPS)[number]

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

export function shiftObservationTime(date: Date, step: ObservationTimeStep): Date {
  const result = new Date(date)
  if (step === 'previousDay' || step === 'nextDay') {
    result.setDate(result.getDate() + (step === 'previousDay' ? -1 : 1))
  } else {
    result.setHours(result.getHours() + (step === 'previousHour' ? -1 : 1))
  }
  return result
}
