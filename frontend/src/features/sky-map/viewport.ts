import type { ProjectedPoint } from './projection'

export const MIN_SKY_ZOOM = 1
export const MAX_SKY_ZOOM = 32

export interface SkyViewTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export const defaultSkyViewTransform = (): SkyViewTransform => ({
  scale: MIN_SKY_ZOOM,
  offsetX: 0,
  offsetY: 0,
})

export function skyViewportRadius(viewportSize: number): number {
  return Math.max(0, viewportSize / 2 - Math.max(24, viewportSize * 0.055))
}

export function resizeSkyViewTransform(
  transform: SkyViewTransform,
  previousViewportSize: number,
  nextViewportSize: number,
): SkyViewTransform {
  const previousRadius = skyViewportRadius(previousViewportSize)
  const nextRadius = skyViewportRadius(nextViewportSize)
  if (previousRadius <= 0 || nextRadius <= 0 || previousRadius === nextRadius) return transform
  const radiusRatio = nextRadius / previousRadius
  return {
    ...transform,
    offsetX: transform.offsetX * radiusRatio,
    offsetY: transform.offsetY * radiusRatio,
  }
}

export function transformSkyPoint(
  point: ProjectedPoint,
  transform: SkyViewTransform,
  center: number,
): ProjectedPoint {
  return {
    x: center + (point.x - center) * transform.scale + transform.offsetX,
    y: center + (point.y - center) * transform.scale + transform.offsetY,
  }
}

export function zoomSkyViewAt(
  transform: SkyViewTransform,
  requestedScale: number,
  anchor: ProjectedPoint,
  center: number,
  radius: number,
): SkyViewTransform {
  const scale = clamp(requestedScale, MIN_SKY_ZOOM, MAX_SKY_ZOOM)
  if (scale === MIN_SKY_ZOOM) return defaultSkyViewTransform()

  const scaleRatio = scale / transform.scale
  return constrainSkyView({
    scale,
    offsetX: anchor.x - center - (anchor.x - center - transform.offsetX) * scaleRatio,
    offsetY: anchor.y - center - (anchor.y - center - transform.offsetY) * scaleRatio,
  }, radius)
}

export function panSkyView(
  transform: SkyViewTransform,
  deltaX: number,
  deltaY: number,
  radius: number,
): SkyViewTransform {
  return constrainSkyView({
    ...transform,
    offsetX: transform.offsetX + deltaX,
    offsetY: transform.offsetY + deltaY,
  }, radius)
}

export function centerSkyViewOn(
  point: ProjectedPoint,
  requestedScale: number,
  center: number,
  radius: number,
): SkyViewTransform {
  const scale = clamp(requestedScale, MIN_SKY_ZOOM, MAX_SKY_ZOOM)
  return constrainSkyView({
    scale,
    offsetX: -(point.x - center) * scale,
    offsetY: -(point.y - center) * scale,
  }, radius)
}

function constrainSkyView(transform: SkyViewTransform, radius: number): SkyViewTransform {
  if (transform.scale <= MIN_SKY_ZOOM) return defaultSkyViewTransform()
  const maximumOffset = radius * (transform.scale - MIN_SKY_ZOOM)
  return {
    scale: transform.scale,
    offsetX: clamp(transform.offsetX, -maximumOffset, maximumOffset),
    offsetY: clamp(transform.offsetY, -maximumOffset, maximumOffset),
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
