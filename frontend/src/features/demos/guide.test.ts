import { describe, expect, it } from 'vitest'
import { advanceGuide, type DemoGuideStep } from './guide'

const steps: DemoGuideStep[] = [
  { id: 'one', subtitleKey: 'one', durationMs: 5000 },
  { id: 'two', subtitleKey: 'two', durationMs: 7000 },
]

describe('guided demo timeline', () => {
  it('carries excess time across cues without losing the end frame', () => {
    expect(advanceGuide(steps, { index: 0, elapsedMs: 4000, finished: false }, 2500))
      .toEqual({ index: 1, elapsedMs: 1500, finished: false })
    expect(advanceGuide(steps, { index: 0, elapsedMs: 0, finished: false }, 12000))
      .toEqual({ index: 1, elapsedMs: 7000, finished: true })
  })

  it('does not advance a finished or paused clock', () => {
    const position = { index: 1, elapsedMs: 2000, finished: false }
    expect(advanceGuide(steps, position, 0)).toBe(position)
    const finished = { ...position, finished: true }
    expect(advanceGuide(steps, finished, 1000)).toBe(finished)
  })
})
