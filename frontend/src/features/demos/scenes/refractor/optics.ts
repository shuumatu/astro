import * as THREE from 'three'

export const OPTICAL_REVISION = 9

interface SourceLandmark {
  source: string
  s: number
  front: number
  back: number
  radius: number
  center: number[]
}

/** Metres in one frame fitted to source glass, with +s pointing from objective to viewing lens. */
export interface RefractorMetadata {
  opticalRevision: number
  opticalFrame: number[]
  sourceLandmarks: { objective: SourceLandmark[]; eyepiece: SourceLandmark }
  tubeObjectiveEndS: number
  tubeEyepieceEndS: number
  minBoreRadius: number
  tubeRadiusMax: number
  /** Actual triangle/slice intersections of the tube shell: [s, minimum radius]. */
  boreSamples: [number, number][]
  objectiveFrontS: number
  objectiveS: number
  objectiveLensDiameter: number
  objectiveAperture: number
  objectiveClearStopRadius: number
  cellBoreRadius: number
  focalLength: number
  focalRatio: number
  focusS: number
  eyepieceFrontS: number
  eyepieceBackS: number
  eyepieceElementRadius: number
  eyepieceFocalLength: number
  exitPupilRadius: number
  magnification: number
  fieldAngleRad: number
  rays: TracedRay[]
  disclosure: string
}

export interface TracedRay {
  field: number
  apertureFrac: number
  exitSlope: number
  focusY: number
  /** Focal plane coordinate, not necessarily an intersection with the optical axis. */
  focusCrossing: number
  /** Objective front, equivalent objective plane, focus, eye front, eye back, outgoing beam. */
  points: [number, number][]
}

export function isRefractorMetadata(value: unknown): value is RefractorMetadata {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Partial<RefractorMetadata>
  return m.opticalRevision === OPTICAL_REVISION
    && Array.isArray(m.opticalFrame) && m.opticalFrame.length === 16
    && m.opticalFrame.every(Number.isFinite)
    && Array.isArray(m.boreSamples) && m.boreSamples.length > 0
    && Array.isArray(m.rays) && m.rays.length > 0
    && m.rays.every(r => r.points?.length === 6 && r.points.every(p => p.length === 2 && p.every(Number.isFinite)))
    && typeof m.focalLength === 'number' && m.focalLength > 0
    && typeof m.eyepieceFocalLength === 'number' && m.eyepieceFocalLength > 0
    && typeof m.objectiveAperture === 'number' && m.objectiveAperture > 0
    && !!m.sourceLandmarks?.eyepiece
}

export function opticalPoint(frame: THREE.Matrix4, s: number, height: number): THREE.Vector3 {
  return new THREE.Vector3(s, height, 0).applyMatrix4(frame)
}

export function opticalAxis(frame: THREE.Matrix4): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixColumn(frame, 0).normalize()
}

/** Recheck the exported frame against the source vertex coordinates, before display normalisation. */
export function validateSourceAlignment(root: THREE.Object3D, m: RefractorMetadata): boolean {
  const inverse = new THREE.Matrix4().fromArray(m.opticalFrame).invert()
  const expected = new Map([[1, m.objectiveFrontS], [0, m.objectiveS], [3, m.eyepieceFrontS]])
  let checked = 0
  let aligned = true
  root.updateMatrixWorld(true)
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.sourceNode !== 12) return
    const target = expected.get(object.userData.sourceComponent as number)
    if (target === undefined) return
    const transform = inverse.clone().multiply(object.matrixWorld)
    const bounds = new THREE.Box3()
    const points = object.geometry.getAttribute('position')
    for (let i = 0; i < points.count; i++) {
      bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(transform))
    }
    const center = bounds.getCenter(new THREE.Vector3())
    aligned &&= Math.abs(center.x - target) < .0005 && Math.hypot(center.y, center.z) < .001
    checked++
  })
  return checked === 3 && aligned && m.objectiveFrontS < m.objectiveS && m.objectiveS < m.eyepieceFrontS
}

export interface RaySegment {
  start: THREE.Vector3
  end: THREE.Vector3
  step: number
  field: number
  apertureFrac: number
}

/** Include the sky-side incoming beam, preserving the inclination of off-axis fields. */
export function raySegments(m: RefractorMetadata, frame: THREE.Matrix4): RaySegment[] {
  return m.rays.flatMap(ray => {
    const first = ray.points[0]!
    const incomingS = Math.min(m.tubeObjectiveEndS, first[0]) - .16
    const incoming: [number, number] = [incomingS, first[1] + Math.tan(ray.field) * (incomingS - first[0])]
    const points = [incoming, ...ray.points]
    return points.slice(1).map((end, i) => ({
      start: opticalPoint(frame, ...points[i]!), end: opticalPoint(frame, ...end),
      step: i === 0 ? 0 : i <= 2 ? 1 : i === 3 ? 2 : 3,
      field: ray.field, apertureFrac: ray.apertureFrac,
    }))
  })
}

export function rayOrderIsPhysical(m: RefractorMetadata): boolean {
  const landmarks = [m.objectiveFrontS, m.objectiveS, m.focusS, m.eyepieceFrontS, m.eyepieceBackS]
  return m.rays.every(ray => ray.points.length === 6
    && ray.points.every((p, i) => p.every(Number.isFinite)
      && (i === 0 || p[0] > ray.points[i - 1]![0])
      && (i >= landmarks.length || Math.abs(p[0] - landmarks[i]!) < 1e-7))
    && Math.abs(ray.points[2]![1] - Math.tan(ray.field) * m.focalLength) < 1e-7)
}

export interface RayValidation {
  entryRadiusMax: number
  entryWithinAperture: boolean
  focusResidualMax: number
  exitSpreadRad: number
  exitBundleSpreadRad: number
  wallClearanceMin: number
  objectiveClearance: number
  raysChecked: number
}

function slope(a: [number, number], b: [number, number]): number {
  return (b[1] - a[1]) / (b[0] - a[0])
}

function heightAt(ray: TracedRay, s: number): number {
  const first = ray.points[0]!
  if (s <= first[0]) return first[1] + Math.tan(ray.field) * (s - first[0])
  const i = ray.points.findIndex(p => p[0] >= s)
  const a = ray.points[Math.max(0, i - 1)]!
  const b = ray.points[i < 0 ? ray.points.length - 1 : i]!
  return a[1] + slope(a, b) * (s - a[0])
}

/** Checks are calculated from the drawn segments, including shell samples between ray vertices. */
export function validateRays(m: RefractorMetadata): RayValidation {
  let entryMax = 0, residual = 0, clearance = Infinity
  const directions: number[] = []
  const bundles = new Map<number, number[]>()
  for (const ray of m.rays) {
    const p = ray.points
    entryMax = Math.max(entryMax, Math.abs(p[0]![1]))
    const image = Math.tan(ray.field) * m.focalLength
    // Extrapolate the objective-to-eyepiece segment, rather than trusting a declared focus field.
    const s = slope(p[1]!, p[3]!)
    residual = Math.max(residual, Math.abs(p[1]![1] + s * (m.focusS - p[1]![0]) - image),
      Math.abs(p[2]![1] - image))
    const angle = Math.atan(slope(p[4]!, p[5]!))
    directions.push(angle)
    const bundle = bundles.get(ray.field) ?? []
    bundle.push(angle); bundles.set(ray.field, bundle)
    for (const [position, radius] of m.boreSamples) {
      clearance = Math.min(clearance, radius - Math.abs(heightAt(ray, position)))
    }
  }
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values)
  return {
    entryRadiusMax: entryMax, entryWithinAperture: entryMax <= m.objectiveAperture / 2 + 1e-9,
    focusResidualMax: residual, exitSpreadRad: spread(directions),
    exitBundleSpreadRad: Math.max(...[...bundles.values()].map(spread)),
    wallClearanceMin: clearance, objectiveClearance: m.objectiveClearStopRadius - entryMax,
    raysChecked: m.rays.length,
  }
}
