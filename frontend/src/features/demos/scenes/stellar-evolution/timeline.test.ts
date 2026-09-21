import { describe, expect, it } from 'vitest'
import { SCENE } from './config'
import { STAGES, stageAt } from './stages'
import {
  advanceTimeline,
  createTimeline,
  dwellMsAt,
  dwellProgress,
  goToStage,
  isFinished,
  MAX_ADVANCE_MS,
  nextStage,
  previousStage,
  restartTimeline,
  setPlaying,
  transitionProgress,
  type TimelineState,
} from './timeline'

const LAST = STAGES.length - 1

/** A timeline sitting on a stage, with anything the test cares about overridden. */
function at(index: number, overrides: Partial<TimelineState> = {}): TimelineState {
  return { index, playing: true, elapsedMs: 0, sinceChangeMs: 0, ...overrides }
}

describe('starting and stepping', () => {
  it('opens on the first stage, playing, with nothing in progress', () => {
    const state = createTimeline()
    expect(state.index).toBe(0)
    expect(state.playing).toBe(true)
    expect(state.elapsedMs).toBe(0)
    // Not zero: the opening frame is already settled, so the captions are on screen at once rather
    // than appearing after the first half-second of frames.
    expect(transitionProgress(state)).toBe(1)
  })

  it('clamps the opening index', () => {
    expect(createTimeline(99).index).toBe(LAST)
    expect(createTimeline(-3).index).toBe(0)
  })

  it('steps forward and restarts both clocks', () => {
    expect(nextStage(at(0, { elapsedMs: 4000, sinceChangeMs: 1100 })))
      .toEqual({ index: 1, playing: true, elapsedMs: 0, sinceChangeMs: 0 })
  })

  it('stops at the end instead of wrapping, so the sequence has an arrival', () => {
    const atEnd = nextStage(at(LAST))
    expect(atEnd.index).toBe(LAST)
    expect(atEnd.playing).toBe(false)
    expect(isFinished(atEnd)).toBe(true)
  })

  it('steps back, and does nothing at the first stage', () => {
    expect(previousStage(at(3, { playing: false, elapsedMs: 900 })))
      .toEqual({ index: 2, playing: false, elapsedMs: 0, sinceChangeMs: 0 })
    const first = at(0, { elapsedMs: 900 })
    expect(previousStage(first)).toBe(first)
  })

  it('jumps to a stage, clamping a stray index', () => {
    expect(goToStage(createTimeline(), 4).index).toBe(4)
    expect(goToStage(createTimeline(), 99).index).toBe(LAST)
    expect(goToStage(createTimeline(), -1).index).toBe(0)
    expect(goToStage(createTimeline(), 2.6).index).toBe(3)
  })

  it('restarts the transition when asked for the stage already showing', () => {
    // A click on the current timeline node should still read as a response.
    expect(goToStage(at(4, { playing: false, elapsedMs: 5000, sinceChangeMs: 1100 }), 4))
      .toEqual({ index: 4, playing: false, elapsedMs: 0, sinceChangeMs: 0 })
  })

  it('restarts at the first stage, playing', () => {
    expect(restartTimeline(at(LAST, { playing: false, elapsedMs: 12000 })))
      .toEqual({ index: 0, playing: true, elapsedMs: 0, sinceChangeMs: 0 })
  })

  it('sets the play state without touching the stage or either clock', () => {
    expect(setPlaying(at(2, { elapsedMs: 100, sinceChangeMs: 40 }), false))
      .toEqual({ index: 2, playing: false, elapsedMs: 100, sinceChangeMs: 40 })
  })
})

describe('autoplay', () => {
  it('accumulates both clocks while playing', () => {
    const state = advanceTimeline(createTimeline(), 100)
    expect(state.index).toBe(0)
    expect(state.playing).toBe(true)
    expect(state.elapsedMs).toBe(100)
    // The transition clock carries on from where the settled opening left it.
    expect(state.sinceChangeMs).toBe(SCENE.transitionMs + 100)
  })

  it('rolls over exactly when the dwell is used up', () => {
    const dwell = dwellMsAt(0)
    const justBefore = advanceTimeline(at(0, { elapsedMs: dwell - 60 }), 50)
    expect(justBefore.index).toBe(0)
    const rolled = advanceTimeline(at(0, { elapsedMs: dwell - 60 }), 100)
    expect(rolled.index).toBe(1)
    expect(rolled.playing).toBe(true)
    expect(rolled.elapsedMs).toBe(0)
    expect(rolled.sinceChangeMs).toBe(0)
  })

  it('never lets a playing clock run past the dwell of the stage it is on', () => {
    let state: TimelineState = createTimeline()
    const totalDwell = STAGES.reduce((sum, stage) => sum + stage.dwellMs, 0)
    const steps = Math.ceil(totalDwell / 200) + 20
    for (let step = 0; step < steps; step += 1) {
      state = advanceTimeline(state, 200)
      expect(state.elapsedMs).toBeLessThanOrEqual(dwellMsAt(state.index))
    }
    // Having run for longer than the whole sequence, the timeline has arrived at its end.
    expect(state.index).toBe(LAST)
    expect(isFinished(state)).toBe(true)
  })

  it('holds on the last stage with the transition complete and autoplay off', () => {
    const state = advanceTimeline(at(LAST, { elapsedMs: dwellMsAt(LAST) - 10 }), 200)
    expect(state).toEqual({
      index: LAST,
      playing: false,
      elapsedMs: dwellMsAt(LAST),
      sinceChangeMs: 200,
    })
  })

  it('caps a stalled frame so it cannot skip stages', () => {
    // A tab restored after a minute would otherwise arrive with a delta of a minute and roll the
    // timeline through several stages at once.
    const state = advanceTimeline(createTimeline(), 60_000)
    expect(state.elapsedMs).toBe(MAX_ADVANCE_MS)
    expect(state.sinceChangeMs).toBe(SCENE.transitionMs + MAX_ADVANCE_MS)
    expect(state.index).toBe(0)
  })

  it('still crosses exactly one stage when a huge delta lands on the boundary', () => {
    expect(advanceTimeline(at(0, { elapsedMs: dwellMsAt(0) - 10 }), 60_000).index).toBe(1)
  })

  it('ignores a delta that is not a positive finite number', () => {
    const state = createTimeline()
    expect(advanceTimeline(state, 0)).toBe(state)
    expect(advanceTimeline(state, -5)).toBe(state)
    expect(advanceTimeline(state, Number.NaN)).toBe(state)
    expect(advanceTimeline(state, Number.POSITIVE_INFINITY)).toBe(state)
  })
})

/**
 * The two clocks do different jobs, and pausing has to stop one of them without stopping the other.
 * These are the tests that pin that down.
 */
describe('pausing', () => {
  it('freezes the dwell clock, so the progress bar does not fill behind a paused sequence', () => {
    let state = setPlaying(createTimeline(), false)
    for (let step = 0; step < 50; step += 1) state = advanceTimeline(state, 250)
    expect(state.elapsedMs).toBe(0)
    expect(dwellProgress(state)).toBe(0)
    expect(state.index).toBe(0)
    expect(state.playing).toBe(false)
  })

  it('freezes the dwell clock where it was, rather than resetting it', () => {
    let state = setPlaying(at(2, { elapsedMs: 4000 }), false)
    state = advanceTimeline(state, 120)
    expect(state.elapsedMs).toBe(4000)
    expect(state.playing).toBe(false)
  })

  it('keeps the transition clock running, so a click on "next" while paused still animates', () => {
    // A paused timeline that has just changed stage: the transition clock must still move, or the
    // morph would freeze halfway between two stages.
    const paused = setPlaying(at(3, { sinceChangeMs: 0 }), false)
    const advanced = advanceTimeline(paused, 120)
    expect(advanced.sinceChangeMs).toBe(120)
    expect(advanced.index).toBe(3)
    expect(advanced.elapsedMs).toBe(0)
    expect(transitionProgress(advanced)).toBeGreaterThan(0)
  })

  it('clamps the transition progress even after a long pause', () => {
    let state = setPlaying(createTimeline(3), false)
    for (let step = 0; step < 200; step += 1) state = advanceTimeline(state, 250)
    // The clock has run far past the transition; the progress it reports is still bounded.
    expect(state.sinceChangeMs).toBeGreaterThan(SCENE.transitionMs)
    expect(transitionProgress(state)).toBe(1)
    // And it never moves the stage on its own while the sequence is paused.
    expect(state.index).toBe(3)
  })
})

describe('progress', () => {
  it('reports the transition as finished once it has had its time', () => {
    expect(transitionProgress(at(0, { sinceChangeMs: 0 }))).toBe(0)
    expect(transitionProgress(at(0, { sinceChangeMs: SCENE.transitionMs / 2 }))).toBeCloseTo(0.5, 6)
    expect(transitionProgress(at(0, { sinceChangeMs: SCENE.transitionMs }))).toBe(1)
    expect(transitionProgress(at(0, { sinceChangeMs: SCENE.transitionMs * 10 }))).toBe(1)
  })

  it('keeps the dwell progress inside 0 and 1', () => {
    expect(dwellProgress(createTimeline())).toBe(0)
    expect(dwellProgress(at(0, { elapsedMs: dwellMsAt(0) / 2 }))).toBeCloseTo(0.5, 6)
    expect(dwellProgress(at(0, { elapsedMs: 10 * dwellMsAt(0) }))).toBe(1)
    expect(dwellProgress(at(0, { elapsedMs: -50 }))).toBe(0)
  })

  it('finishes the transition well before the shortest dwell', () => {
    // Otherwise a stage would be morphing for most of the time it is on screen.
    const shortest = Math.min(...STAGES.map((stage) => stage.dwellMs))
    expect(SCENE.transitionMs).toBeLessThan(shortest / 3)
  })
})

describe('the timeline is defined for every stage', () => {
  it('has a positive dwell for each', () => {
    for (let index = 0; index < STAGES.length; index += 1) {
      expect(dwellMsAt(index)).toBe(STAGES[index]!.dwellMs)
      expect(stageAt(index).dwellMs).toBeGreaterThan(0)
    }
  })
})
