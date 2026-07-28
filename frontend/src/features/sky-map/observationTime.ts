export const OBSERVATION_TIME_PRESETS = ['now', 'tonight', 'tomorrowEvening'] as const
export const OBSERVATION_TIME_STEPS = [
  'previousDay',
  'previousHour',
  'nextHour',
  'nextDay',
] as const

export type ObservationTimePreset = (typeof OBSERVATION_TIME_PRESETS)[number]
export type ObservationControlStep = (typeof OBSERVATION_TIME_STEPS)[number]
export type ObservationMinuteStep = 'previousMinute' | 'nextMinute'
export type ObservationTimeStep = ObservationControlStep | ObservationMinuteStep

export interface ObservationTimeWheelResult {
  accumulatedDelta: number
  step: ObservationMinuteStep | null
}

type RequestFrame = (callback: FrameRequestCallback) => number
type CancelFrame = (handle: number) => void
const TIME_WHEEL_FRAME_INTERVAL_MS = 32

export class ObservationTimeWheelBatcher {
  private pendingMinutes = 0
  private frameHandle: number | null = null
  private lastFlushTime: number | null = null

  constructor(
    private readonly onMinutes: (minuteDelta: number) => void,
    private readonly requestFrame: RequestFrame = (callback) => (
      globalThis.requestAnimationFrame(callback)
    ),
    private readonly cancelFrame: CancelFrame = (handle) => (
      globalThis.cancelAnimationFrame(handle)
    ),
  ) {}

  enqueue(step: ObservationMinuteStep): void {
    this.pendingMinutes += step === 'nextMinute' ? 1 : -1
    if (this.frameHandle === null) this.frameHandle = this.requestFrame(this.flush)
  }

  reset(): void {
    if (this.frameHandle !== null) this.cancelFrame(this.frameHandle)
    this.frameHandle = null
    this.pendingMinutes = 0
    this.lastFlushTime = null
  }

  private readonly flush = (timestamp: number): void => {
    this.frameHandle = null
    if (
      this.lastFlushTime !== null
      && timestamp - this.lastFlushTime < TIME_WHEEL_FRAME_INTERVAL_MS
    ) {
      this.frameHandle = this.requestFrame(this.flush)
      return
    }
    this.lastFlushTime = timestamp
    const minuteDelta = this.pendingMinutes
    this.pendingMinutes = 0
    if (minuteDelta !== 0) this.onMinutes(minuteDelta)
  }
}

const OBSERVATION_TIME_WHEEL_THRESHOLD = 80

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
  } else if (step === 'previousHour' || step === 'nextHour') {
    result.setHours(result.getHours() + (step === 'previousHour' ? -1 : 1))
  } else {
    result.setMinutes(result.getMinutes() + (step === 'previousMinute' ? -1 : 1))
  }
  return result
}

export function accumulateObservationTimeWheel(
  accumulatedDelta: number,
  deltaY: number,
): ObservationTimeWheelResult {
  if (!Number.isFinite(deltaY) || deltaY === 0) {
    return { accumulatedDelta, step: null }
  }

  const continuesDirection = accumulatedDelta === 0
    || Math.sign(accumulatedDelta) === Math.sign(deltaY)
  const nextDelta = (continuesDirection ? accumulatedDelta : 0) + deltaY
  if (Math.abs(nextDelta) < OBSERVATION_TIME_WHEEL_THRESHOLD) {
    return { accumulatedDelta: nextDelta, step: null }
  }
  return {
    accumulatedDelta: 0,
    step: nextDelta < 0 ? 'nextMinute' : 'previousMinute',
  }
}
