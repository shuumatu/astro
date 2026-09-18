import type { EclipsePhaseBand } from './types'

export type EclipseGuideCue =
  | 'solar-alignment' | 'solar-partial' | 'solar-total'
  | 'lunar-alignment' | 'lunar-partial' | 'lunar-total' | 'inclination'

export const GUIDE_SYSTEM_FOCUS: Partial<Record<EclipseGuideCue, readonly string[]>> = {
  'solar-alignment': ['moon', 'umbra'],
  'lunar-alignment': ['earth', 'umbra'],
  inclination: ['eclipticPlane', 'lunarPlane', 'ascendingNode', 'descendingNode'],
}

export function guideFocusStrength(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress))
  return 0.7 + 0.3 * Math.sin(Math.PI * clamped)
}

/** The eclipse library's contact estimate can precede the live geometric classification. */
export function firstTotalContact(
  partialStartMs: number,
  peakMs: number,
  isTotal: (timeMs: number) => boolean,
): number {
  if (!isTotal(peakMs) || isTotal(partialStartMs)) return partialStartMs
  let before = partialStartMs
  let after = peakMs
  for (let step = 0; step < 24 && after - before > 1000; step += 1) {
    const middle = (before + after) / 2
    if (isTotal(middle)) after = middle
    else before = middle
  }
  return after
}

export function eclipseGuideWindow(
  cue: EclipseGuideCue,
  peakMs: number,
  bands: readonly EclipsePhaseBand[],
): { startMs: number; endMs: number } {
  const total = bands.find((band) => band.kind === 'total')
  const partial = bands.find((band) => band.kind === 'partial')
  if (cue === 'solar-partial' || cue === 'lunar-partial') {
    const ingressEnd = total?.startMs ?? peakMs
    const partialStart = partial?.startMs ?? peakMs - 3600_000
    // Lunar semi-duration contacts are approximate relative to the live shadow geometry. Begin
    // inside the partial phase so the caption and coverage ring never open on penumbral-only light.
    const startMs = cue === 'lunar-partial'
      ? partialStart + (ingressEnd - partialStart) * 0.25
      : partialStart + 60_000
    return { startMs, endMs: Math.max(startMs, ingressEnd) }
  }
  if (cue === 'solar-total' || cue === 'lunar-total') {
    if (!total) return { startMs: peakMs, endMs: peakMs }
    // Continue from the last frame of the preceding partial chapter. In particular, lunar totality
    // can last over an hour; skipping from its first contact to the middle is a visible jump.
    return { startMs: total.startMs, endMs: Math.min(total.endMs, Math.max(total.startMs, peakMs)) }
  }
  return { startMs: peakMs, endMs: peakMs }
}
