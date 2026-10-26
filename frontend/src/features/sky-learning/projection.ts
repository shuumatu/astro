export interface CelestialPoint {
  raDeg: number
  decDeg: number
}

export interface ChartPoint {
  x: number
  y: number
}

export interface LearningChartStar extends CelestialPoint {
  id: string
  name: string
  aliases: readonly string[]
  magnitude: number
  colorIndex?: number | null
}

export type ProjectedLearningStar = LearningChartStar & ChartPoint

const DEG_TO_RAD = Math.PI / 180
const VIEW_ROTATIONS = [0, 28, -35, 65, -70, 110]

export function viewRotation(variant: number): number {
  const index = Number.isFinite(variant) ? Math.trunc(variant) : 0
  return VIEW_ROTATIONS[((index % VIEW_ROTATIONS.length) + VIEW_ROTATIONS.length) % VIEW_ROTATIONS.length]
}

/** Stereographic celestial projection, initially north up and east left.
 * Works across RA zero and near either pole. This is a learning chart, not an
 * observer's horizon. The antipode cannot be represented by this projection.
 */
export function projectCelestialPoint(
  point: CelestialPoint,
  center: CelestialPoint,
  rotationDeg = 0,
): ChartPoint | null {
  if (![point.raDeg, point.decDeg, center.raDeg, center.decDeg, rotationDeg].every(Number.isFinite)
    || Math.abs(point.decDeg) > 90 || Math.abs(center.decDeg) > 90) return null

  const deltaRa = (point.raDeg - center.raDeg) * DEG_TO_RAD
  const dec = point.decDeg * DEG_TO_RAD
  const centerDec = center.decDeg * DEG_TO_RAD
  const cosineDistance = Math.sin(centerDec) * Math.sin(dec)
    + Math.cos(centerDec) * Math.cos(dec) * Math.cos(deltaRa)
  const denominator = 1 + cosineDistance
  if (denominator < 1e-10) return null

  const scale = 2 / denominator
  const east = Math.cos(dec) * Math.sin(deltaRa)
  const north = Math.cos(centerDec) * Math.sin(dec)
    - Math.sin(centerDec) * Math.cos(dec) * Math.cos(deltaRa)
  const x = -scale * east
  const y = -scale * north
  const rotation = rotationDeg * DEG_TO_RAD
  return {
    x: x * Math.cos(rotation) - y * Math.sin(rotation),
    y: x * Math.sin(rotation) + y * Math.cos(rotation),
  }
}

/** Uniform fitting preserves the projected pattern's shape. No star is clipped
 * by magnitude or by the real-world horizon in this dedicated practice view.
 */
export function projectLearningStars(
  stars: readonly LearningChartStar[],
  center: CelestialPoint,
  width: number,
  height: number,
  variant = 0,
  padding = 60,
): ProjectedLearningStar[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return []
  const projected = stars.flatMap((star) => {
    const position = projectCelestialPoint(star, center, viewRotation(variant))
    return position ? [{ ...star, ...position }] : []
  })
  if (projected.length === 0) return []

  const minX = Math.min(...projected.map((point) => point.x))
  const maxX = Math.max(...projected.map((point) => point.x))
  const minY = Math.min(...projected.map((point) => point.y))
  const maxY = Math.max(...projected.map((point) => point.y))
  const middleX = (minX + maxX) / 2
  const middleY = (minY + maxY) / 2
  const safePadding = Math.max(0, Math.min(Number.isFinite(padding) ? padding : 60, width / 3, height / 3))
  const fitScale = Math.min(
    (width - safePadding * 2) / Math.max(maxX - minX, 1e-8),
    (height - safePadding * 2) / Math.max(maxY - minY, 1e-8),
  )
  return projected.map((star) => ({
    ...star,
    x: width / 2 + (star.x - middleX) * fitScale,
    y: height / 2 + (star.y - middleY) * fitScale,
  }))
}
