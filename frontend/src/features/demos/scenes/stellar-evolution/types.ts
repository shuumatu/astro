/**
 * The stellar-evolution demo's own vocabulary.
 *
 * These types are shared by exactly two files - `scene.ts` and `StellarEvolutionControlPanel.vue` -
 * and are deliberately not part of the shared demo shell. The shell carries a state snapshot and a
 * command across without reading either; see `DemoDefinition.controlPanel` in `registry.ts`.
 */

/** The nine stages, in the order the timeline plays them. */
export type StageId =
  | 'molecular-cloud'
  | 'protostar'
  | 'main-sequence'
  | 'red-giant'
  | 'planetary-nebula'
  | 'white-dwarf'
  | 'supernova'
  | 'neutron-star'
  | 'black-hole'

/**
 * Which star the stage belongs to.
 *
 * The whole point of the demo is that these two lists have different endings, so the track is a
 * property of the stage rather than something the panel infers from the order.
 */
export type StageTrack = 'solar' | 'massive'

/** Where the stage sits in a star's life, used to group the timeline. */
export type StageCategory = 'birth' | 'main' | 'late' | 'remnant'

/**
 * Where a label hangs, named rather than positioned.
 *
 * The drawn radius of the body changes by a factor of twenty-six across the timeline, so a label
 * pinned to a fixed scene coordinate would end up inside the red giant and miles away from the
 * neutron star. Anchors are resolved against whatever the current stage's radii are, in the scene.
 */
export type StageLabelAnchor =
  | 'core-above'
  | 'core-left'
  | 'core-right'
  | 'shell-above'
  | 'shell-left'
  | 'shell-right'
  | 'disk-right'
  | 'beam-above'
  | 'frame-left'
  | 'frame-right'

/** One label the current stage publishes. */
export interface StageLabel {
  id: string
  textKey: string
  descriptionKey: string
  anchor: StageLabelAnchor
}

/**
 * Everything the control panel draws.
 *
 * The `*Solar`, `*Km` and `*Years` fields are real measurements; the scene's drawing scale never
 * touches them. Anything the scene invents for the picture stays inside `scene.ts` and `visuals.ts`.
 */
export interface StellarEvolutionSceneState {
  /** Index into the ordered stage list. */
  index: number
  /** The stage at `index`, so the panel does not have to re-derive the order. */
  stageId: StageId
  track: StageTrack
  playing: boolean
  /** Milliseconds spent on the current stage. Drives the transition and the progress bar. */
  elapsedMs: number
  /** Autoplay dwell for the current stage, milliseconds. */
  dwellMs: number
  /** Whether the demo is drawing its labels. */
  showLabels: boolean
  /** Total number of stages, so the panel can render the timeline without importing the list. */
  stageCount: number

  /** Real radius of the current stage's body in solar radii, or null when it has none. */
  radiusSolar: number | null
  /** Real effective temperature of the body, K, or null where the stage has no photosphere. */
  temperatureK: number | null
  /** Real duration of the stage in years, or null when it does not end. */
  durationYears: number | null
  /** Real mass of the star this stage belongs to, solar masses. */
  massSolar: number
}

/** What the panel can ask the scene to do. */
export type StellarEvolutionCommand =
  | { type: 'stage', index: number }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle-playing' }
  | { type: 'restart' }
  | { type: 'toggle-labels' }
  | { type: 'reset-view' }

/**
 * Narrows a value the shell carried across from the panel.
 *
 * The shell hands `runCommand` an `unknown`, because naming a command there would defeat the point
 * of the channel. This is where the demo puts its own shape back on it.
 */
export function isStellarEvolutionCommand(value: unknown): value is StellarEvolutionCommand {
  if (typeof value !== 'object' || value === null) return false
  const type = (value as { type?: unknown }).type
  return type === 'stage' || type === 'next' || type === 'previous' || type === 'play'
    || type === 'pause' || type === 'toggle-playing' || type === 'restart'
    || type === 'toggle-labels' || type === 'reset-view'
}
