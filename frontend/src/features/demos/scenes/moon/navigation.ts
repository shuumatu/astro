/**
 * Pure camera-navigation maths kept outside the WebGL scene so safety limits and device input
 * normalization can be regression-tested without constructing a renderer.
 */

export function maximumSafePolarAngle(
  distance: number,
  targetRadius: number,
  clearance: number,
  minimumAngle: number,
  maximumAngle: number,
): number {
  const safeDistance = Math.max(distance, 1e-8)
  const minimumRadius = targetRadius + Math.max(clearance, 0)
  const cosine = (minimumRadius ** 2 - targetRadius ** 2 - safeDistance ** 2)
    / (2 * targetRadius * safeDistance)
  const physicalLimit = Math.acos(Math.min(1, Math.max(-1, cosine)))
  return Math.max(minimumAngle, Math.min(maximumAngle, physicalLimit))
}

export function logarithmicDragScale(
  distance: number,
  minimumDistance: number,
  maximumDistance: number,
  minimumScale: number,
  maximumScale: number,
): number {
  const minimum = Math.max(minimumDistance, 1e-8)
  const range = Math.max(maximumDistance / minimum, 1.0001)
  const progress = Math.min(1, Math.max(
    0,
    Math.log(Math.max(distance, minimum) / minimum) / Math.log(range),
  ))
  const eased = progress * progress * (3 - 2 * progress)
  return minimumScale + (maximumScale - minimumScale) * eased
}

/** Makes pixel-, line- and page-mode wheels produce the same bounded zoom step. */
export function normaliseWheelPixels(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  const pixels = deltaMode === 1
    ? deltaY * 16
    : deltaMode === 2
      ? deltaY * Math.max(viewportHeight, 1)
      : deltaY
  return Math.min(160, Math.max(-160, pixels))
}
