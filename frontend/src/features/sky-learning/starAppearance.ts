import { starColor } from '../sky-map/starColor'

export type StarRenderMode = 'natural' | 'clear'

/** Screen-space light profile for learning, not a calibrated model of eyesight.
 * A single response curve is shared by every lesson; never normalize to the
 * brightest star in the current field or to the current quiz target.
 */
export function learningStarAppearance(magnitude: number, colorIndex: number | null = null, mode: StarRenderMode = 'natural') {
  const mag = Number.isFinite(magnitude) ? Math.max(-2, Math.min(12, magnitude)) : 3
  const flux = 10 ** (-0.4 * mag)
  // Compress the flux range for an ordinary display. Small stars retain a soft
  // footprint and lose intensity instead of hitting a bright minimum disk size.
  const sigma = .35 + .75 * flux ** .16
  const coreOpacity = Math.min(1, .98 * flux ** .25)
  const haloStrength = Math.max(0, Math.min(1, (2 - mag) / 3.5))
  const color = starColor(colorIndex, mag)
  const colorStrength = Math.max(18, Math.min(62, 62 - Math.max(0, mag) * 8))
  const coreColor = `color-mix(in srgb, ${color} ${colorStrength}%, #f4f6f8)`
  if (mode === 'clear') {
    // Deliberately generous, solid markers preserve the original teaching-chart
    // readability. Their hit areas and celestial positions remain unchanged.
    const radius = Math.max(2, Math.min(5, 4.6 - mag * .55))
    return {
      coreRadius: radius,
      coreOpacity: 1,
      coreColor,
      haloRadius: radius * 2.5,
      haloOpacity: .18,
      haloColor: '#a9c8ff',
    }
  }
  return {
    coreRadius: sigma * 3,
    coreOpacity,
    coreColor,
    haloRadius: 4 + haloStrength * 3,
    haloOpacity: .16 * haloStrength,
    haloColor: `color-mix(in srgb, ${color} 72%, #f4f6f8)`,
  }
}
