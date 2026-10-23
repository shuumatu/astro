export type FieldDirection = 'north' | 'sideways' | 'south'
export type Preset = 'quiet' | 'strong' | 'reconnection'
export interface WindState {
  intensity: number
  direction: FieldDirection
  preset: Preset | 'custom'
  step: number
  playing: boolean
  reducedMotion: boolean
  contextLost: boolean
  view: 'system' | 'earth'
}
export const PRESETS = {
  quiet: { intensity: 20, direction: 'north' },
  strong: { intensity: 85, direction: 'north' },
  reconnection: { intensity: 85, direction: 'south' },
} as const
export const INITIAL: WindState = {
  ...PRESETS.quiet, preset: 'quiet', step: 0, playing: true, reducedMotion: false, contextLost: false, view: 'system',
}
export const STEPS = ['quiet', 'strong', 'reconnection'] as const
export const DIRECTIONS: FieldDirection[] = ['north', 'sideways', 'south']
export const LABELS = ['sun', 'wind', 'earth', 'magnetopause', 'tail', 'northAurora', 'southAurora', 'imf', 'reconnection'] as const
export const PARTICLE_COUNT = 240

/** Dimensionless teaching responses, NOT fitted physical equations or a forecast.
 * Pressure and coupling are deliberately separate. Holding density fixed, a real
 * standoff distance scales roughly as dynamic pressure^(-1/6); here even the
 * distance is exaggerated for legibility. Tail length is a visual proxy for
 * deformation/stored energy, not a claim that real tail length follows this law.
 */
export function mapWind(intensity: number, direction: FieldDirection) {
  const strength = Math.min(100, Math.max(0, Number.isFinite(intensity) ? intensity : 20)) / 100
  const coupling = { north: .12, sideways: .4, south: 1 }[direction]
  const activity = .08 + (.22 + .7 * strength) * coupling
  return {
    strength, coupling, activity,
    nose: 3.1 - .95 * strength,
    tail: 5.2 + 1.6 * strength + 1.1 * coupling,
    ovalColatitude: (17 + 13 * activity) * Math.PI / 180,
    ovalWidth: .035 + .065 * activity,
  }
}

/** Validate the opaque shell command boundary; invalid input must not poison geometry. */
export function reduceWind(state: WindState, command: unknown): WindState {
  if (!command || typeof command !== 'object') return state
  const { type, value } = command as { type?: unknown; value?: unknown }
  if (type === 'view' && (value === 'system' || value === 'earth')) return { ...state, view: value }
  if (type === 'intensity' && typeof value === 'number' && Number.isFinite(value))
    return { ...state, intensity: Math.round(Math.max(0, Math.min(100, value))), preset: 'custom' }
  if (type === 'direction' && DIRECTIONS.includes(value as FieldDirection))
    return { ...state, direction: value as FieldDirection, preset: 'custom' }
  if (type === 'preset' && STEPS.includes(value as Preset))
    return { ...state, ...PRESETS[value as Preset], preset: value as Preset, step: STEPS.indexOf(value as Preset) }
  if (type === 'step' && typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < STEPS.length) {
    const preset = STEPS[value]!
    return { ...state, ...PRESETS[preset], preset, step: value }
  }
  if (type === 'playing') return { ...state, playing: !state.playing }
  if (type === 'reset') return { ...INITIAL, reducedMotion: state.reducedMotion, contextLost: state.contextLost }
  return state
}
