export const TELESCOPE_MAGNIFICATION_PRESETS = [1, 7, 10, 20, 50, 100, 200, 300] as const

export function telescopeMagnificationToSkyScale(magnification: number): number {
  return magnification
}

export const MAX_TELESCOPE_SKY_ZOOM = telescopeMagnificationToSkyScale(
  TELESCOPE_MAGNIFICATION_PRESETS[TELESCOPE_MAGNIFICATION_PRESETS.length - 1],
)
