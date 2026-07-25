const COLOR_INDEX_MIN = -0.4
const COLOR_INDEX_MAX = 2
const COLOR_LOOKUP_SIZE = 256
const MAGNITUDE_MIN = -1.5
const MAGNITUDE_MAX = 6.5
const MAGNITUDE_LOOKUP_SIZE = 16
const NEUTRAL_STAR_COLOR = 'rgb(232 239 239)'

type LinearRgb = readonly [number, number, number]

interface ColorStop {
  colorIndex: number
  color: LinearRgb
}

const COLOR_STOPS: readonly ColorStop[] = [
  { colorIndex: -0.4, color: hexToLinearRgb('#8db4ff') },
  { colorIndex: -0.2, color: hexToLinearRgb('#a9c8ff') },
  { colorIndex: 0, color: hexToLinearRgb('#cddaff') },
  { colorIndex: 0.3, color: hexToLinearRgb('#edf1ff') },
  { colorIndex: 0.65, color: hexToLinearRgb('#fff4df') },
  { colorIndex: 1, color: hexToLinearRgb('#ffdeb2') },
  { colorIndex: 1.4, color: hexToLinearRgb('#ffc08e') },
  { colorIndex: 2, color: hexToLinearRgb('#ff956e') },
]

const BASE_COLOR_LOOKUP = Array.from(
  { length: COLOR_LOOKUP_SIZE },
  (_, index) => interpolatedColor(colorIndexForLookup(index)),
)

const STAR_COLOR_LOOKUP = Array.from(
  { length: MAGNITUDE_LOOKUP_SIZE },
  (_, magnitudeIndex) => {
    const magnitude = MAGNITUDE_MIN
      + (magnitudeIndex / (MAGNITUDE_LOOKUP_SIZE - 1)) * (MAGNITUDE_MAX - MAGNITUDE_MIN)
    const neutralMix = 0.06 + 0.34 * normalizedMagnitude(magnitude)
    return BASE_COLOR_LOOKUP.map((color) => toCssRgb(mixLinearRgb(color, [1, 1, 1], neutralMix)))
  },
)

export function starColor(colorIndex: number | null, visualMagnitude: number): string {
  if (colorIndex === null || !Number.isFinite(colorIndex)) return NEUTRAL_STAR_COLOR
  return STAR_COLOR_LOOKUP[magnitudeLookupIndex(visualMagnitude)][colorLookupIndex(colorIndex)]
}

function colorIndexForLookup(index: number): number {
  return COLOR_INDEX_MIN + (index / (COLOR_LOOKUP_SIZE - 1)) * (COLOR_INDEX_MAX - COLOR_INDEX_MIN)
}

function colorLookupIndex(colorIndex: number): number {
  const normalized = (clamp(colorIndex, COLOR_INDEX_MIN, COLOR_INDEX_MAX) - COLOR_INDEX_MIN)
    / (COLOR_INDEX_MAX - COLOR_INDEX_MIN)
  return Math.round(normalized * (COLOR_LOOKUP_SIZE - 1))
}

function magnitudeLookupIndex(visualMagnitude: number): number {
  return Math.round(normalizedMagnitude(visualMagnitude) * (MAGNITUDE_LOOKUP_SIZE - 1))
}

function normalizedMagnitude(visualMagnitude: number): number {
  return clamp((visualMagnitude - MAGNITUDE_MIN) / (MAGNITUDE_MAX - MAGNITUDE_MIN), 0, 1)
}

function interpolatedColor(colorIndex: number): LinearRgb {
  const upperIndex = COLOR_STOPS.findIndex((stop) => stop.colorIndex >= colorIndex)
  if (upperIndex <= 0) return COLOR_STOPS[0].color
  if (upperIndex === -1) return COLOR_STOPS.at(-1)!.color
  const lower = COLOR_STOPS[upperIndex - 1]
  const upper = COLOR_STOPS[upperIndex]
  const progress = (colorIndex - lower.colorIndex) / (upper.colorIndex - lower.colorIndex)
  return mixLinearRgb(lower.color, upper.color, progress)
}

function mixLinearRgb(left: LinearRgb, right: LinearRgb, progress: number): LinearRgb {
  return [
    left[0] + (right[0] - left[0]) * progress,
    left[1] + (right[1] - left[1]) * progress,
    left[2] + (right[2] - left[2]) * progress,
  ]
}

function hexToLinearRgb(hex: string): LinearRgb {
  return [
    srgbToLinear(Number.parseInt(hex.slice(1, 3), 16) / 255),
    srgbToLinear(Number.parseInt(hex.slice(3, 5), 16) / 255),
    srgbToLinear(Number.parseInt(hex.slice(5, 7), 16) / 255),
  ]
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function toCssRgb(color: LinearRgb): string {
  return `rgb(${color.map((value) => Math.round(linearToSrgb(value) * 255)).join(' ')})`
}

function linearToSrgb(value: number): number {
  const clamped = clamp(value, 0, 1)
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
