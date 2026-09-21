export const LAYERS = ['inner', 'diffuse', 'filaments'] as const
export const BANDS = ['composite', 'visible', 'infrared', 'xray'] as const
export type Layer = typeof LAYERS[number]
export type Band = typeof BANDS[number]
export interface RemnantState {
  band: Band | 'custom'
  layers: Record<Layer, boolean>
  rotating: boolean
  model: 'loading' | 'ready' | 'error'
}
export const PRESETS: Record<Band, Record<Layer, boolean>> = {
  composite: { inner: true, diffuse: true, filaments: true },
  visible: { inner: false, diffuse: false, filaments: true },
  infrared: { inner: false, diffuse: true, filaments: true },
  xray: { inner: true, diffuse: false, filaments: false },
}
export function initialState(): RemnantState {
  return { band: 'composite', layers: { ...PRESETS.composite }, rotating: false, model: 'loading' }
}
export type RemnantCommand = { type: 'band'; value: Band } | { type: 'layer'; layer: Layer; value: boolean }
  | { type: 'rotate' } | { type: 'focus'; value: 'all' | 'inner' } | { type: 'retry' }
export function isCommand(value: unknown): value is RemnantCommand {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  if (c.type === 'rotate' || c.type === 'retry') return true
  if (c.type === 'band') return BANDS.includes(c.value as Band)
  if (c.type === 'layer') return LAYERS.includes(c.layer as Layer) && typeof c.value === 'boolean'
  return c.type === 'focus' && (c.value === 'all' || c.value === 'inner')
}
