import { SCENE } from './config'
import { clampStageIndex, STAGES, stageAt } from './stages'

/**
 * The demo's timeline: which stage is on screen, whether it is advancing by itself, and how long it
 * has been there.
 *
 * Kept as pure functions over a plain value so the whole of the navigation - play, pause, step,
 * restart, and the autoplay roll-over - can be tested without a renderer, a clock or a browser.
 * The scene owns one of these and hands it to `advanceTimeline` once a frame.
 *
 * There are two clocks and they are not the same clock:
 *
 * - `elapsedMs` is time spent on the stage, and it only runs while autoplay is playing. It is what
 *   the panel's progress bar shows, and it has to stop when the viewer pauses, or the bar would go
 *   on filling behind a paused sequence.
 * - `sinceChangeMs` is time since the drawing last changed stage, and it runs always. It drives the
 *   morph into the new stage, so a click on "next" still animates while the sequence is paused.
 *
 * Collapsing them into one counter was the first attempt and it cannot work: pausing has to stop
 * one and not the other.
 */
export interface TimelineState {
  /** Index into `STAGES`. */
  index: number
  /** Whether autoplay is running. Manual stepping works either way. */
  playing: boolean
  /** Time on the current stage, milliseconds. Runs only while playing. */
  elapsedMs: number
  /** Time since the stage last changed, milliseconds. Runs always. */
  sinceChangeMs: number
}

/**
 * Ceiling on the time one call will consume.
 *
 * A frame that arrives after a long stall - a backgrounded tab, a breakpoint, a sleeping laptop -
 * would otherwise carry a delta of minutes and roll the timeline through several stages at once.
 * Clamping keeps a stall from turning into a slideshow, and matches the frame loop's own clamp.
 */
export const MAX_ADVANCE_MS = 250

/**
 * A timeline sitting on a stage, with nothing in progress.
 *
 * `sinceChangeMs` starts at the length of a transition rather than at zero, because there is
 * nothing to morph from: the demo opens already showing its first stage, and a transition clock at
 * zero would hold the captions back and leave the opening frame looking half-drawn until the first
 * half-second of frames had gone by.
 */
export function createTimeline(startIndex = 0): TimelineState {
  return {
    index: clampStageIndex(startIndex),
    playing: true,
    elapsedMs: 0,
    sinceChangeMs: SCENE.transitionMs,
  }
}

/** Dwell for a stage, in milliseconds. */
export function dwellMsAt(index: number): number {
  return stageAt(index).dwellMs
}

/** How long the current stage has been on screen, as a fraction of its dwell, 0-1. */
export function dwellProgress(state: TimelineState): number {
  const dwell = dwellMsAt(state.index)
  if (dwell <= 0) return 1
  return Math.min(1, Math.max(0, state.elapsedMs / dwell))
}

/**
 * How far the transition into the current stage has run, 0-1.
 *
 * The scene eases this and interpolates its drawing between the previous stage's look and this
 * one's, so every way of changing stage - a click, a step, autoplay - gets the same morph without
 * the scene having to know which of them happened.
 */
export function transitionProgress(state: TimelineState): number {
  if (SCENE.transitionMs <= 0) return 1
  return Math.min(1, Math.max(0, state.sinceChangeMs / SCENE.transitionMs))
}

/** Whether the timeline is sitting on the last stage with autoplay finished. */
export function isFinished(state: TimelineState): boolean {
  return !state.playing && state.index >= STAGES.length - 1
}

/** Jumps to a stage, restarting both clocks. The play state is left alone. */
export function goToStage(state: TimelineState, index: number): TimelineState {
  const next = clampStageIndex(index)
  // Asking for the stage already showing restarts its transition rather than doing nothing, so a
  // click on the current timeline node still reads as a response.
  return { index: next, playing: state.playing, elapsedMs: 0, sinceChangeMs: 0 }
}

/**
 * Steps one stage forward.
 *
 * At the last stage this stops the autoplay rather than wrapping, so the end of the sequence is a
 * place the viewer arrives at rather than a loop they cannot leave.
 */
export function nextStage(state: TimelineState): TimelineState {
  if (state.index >= STAGES.length - 1) return { ...state, playing: false }
  return { index: state.index + 1, playing: state.playing, elapsedMs: 0, sinceChangeMs: 0 }
}

/** Steps one stage back. At the first stage there is nowhere to go. */
export function previousStage(state: TimelineState): TimelineState {
  if (state.index <= 0) return state
  return { index: state.index - 1, playing: state.playing, elapsedMs: 0, sinceChangeMs: 0 }
}

/** Returns to the first stage and starts playing again. */
export function restartTimeline(_state: TimelineState): TimelineState {
  return { index: 0, playing: true, elapsedMs: 0, sinceChangeMs: 0 }
}

export function setPlaying(state: TimelineState, playing: boolean): TimelineState {
  return { ...state, playing }
}

/**
 * Advances the clocks, rolling over into the next stage when autoplay has finished with this one.
 *
 * The delta is clamped before it is applied, so a stalled frame can only ever advance one stage.
 */
export function advanceTimeline(state: TimelineState, deltaMs: number): TimelineState {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return state
  const step = Math.min(deltaMs, MAX_ADVANCE_MS)
  const sinceChangeMs = state.sinceChangeMs + step
  // The morph runs whatever the transport is doing; see the note on `TimelineState`.
  if (!state.playing) return { ...state, sinceChangeMs }

  const elapsedMs = state.elapsedMs + step
  const lastIndex = STAGES.length - 1
  if (state.index >= lastIndex) {
    // Hold on the last stage with the transition complete and autoplay off.
    if (elapsedMs < dwellMsAt(lastIndex)) return { ...state, elapsedMs, sinceChangeMs }
    return { index: lastIndex, playing: false, elapsedMs: dwellMsAt(lastIndex), sinceChangeMs }
  }
  if (elapsedMs < dwellMsAt(state.index)) return { ...state, elapsedMs, sinceChangeMs }
  return { index: state.index + 1, playing: true, elapsedMs: 0, sinceChangeMs: 0 }
}
