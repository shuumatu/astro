/** The shell owns timing and subtitles; the scene owns what each cue shows. */
export interface DemoGuideStep {
  id: string
  subtitleKey: string
  durationMs: number
}

export interface DemoGuideDefinition {
  titleKey: string
  steps: readonly DemoGuideStep[]
}

export interface GuidePosition {
  index: number
  elapsedMs: number
  finished: boolean
}

export function advanceGuide(
  steps: readonly DemoGuideStep[],
  position: GuidePosition,
  deltaMs: number,
): GuidePosition {
  if (position.finished || steps.length === 0 || deltaMs <= 0) return position
  let index = position.index
  let elapsedMs = position.elapsedMs + deltaMs
  while (elapsedMs >= Math.max(1, steps[index]!.durationMs)) {
    elapsedMs -= Math.max(1, steps[index]!.durationMs)
    if (index === steps.length - 1) return { index, elapsedMs: Math.max(1, steps[index]!.durationMs), finished: true }
    index += 1
  }
  return { index, elapsedMs, finished: false }
}
