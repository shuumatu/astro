import * as THREE from 'three'

/**
 * Optics for the refractor demo.
 *
 * The builder (`tools/build-refractor-model.py`) solves the objective by tracing real meridional
 * rays through a spherical doublet, then places the eyepiece so its front focal plane sits on the
 * objective's traced focus. Everything the scene draws comes from that one solution, so the
 * interface, the geometry and the drawn rays cannot drift apart. Nothing here re-derives or
 * rescales the optics, because the model is normalised for display after it loads.
 */

/** Calibration published by the builder in `scenes[0].extras`. */
export interface RefractorMetadata {
  /** Axial position of the tube end that carries the objective, in metres. */
  tubeObjectiveEndS: number
  /** Axial position of the tube end that carries the eyepiece barrel, in metres. */
  tubeEyepieceEndS: number
  minBoreRadius: number
  tubeRadiusMax: number
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
  paraxialEfl: number
  fieldAngleRad: number
  rays: TracedRay[]
  /**
   * Sampled clear bore of the tube: [sStart, sEnd, smallest radius] per axial slice. The tube is
   * not a constant-diameter pipe - its cell end narrows - so clearance is checked per slice.
   */
  boreSlices: [number, number, number][]
  /**
   * Column-major 4x4 that maps optical-frame coordinates (s along the axis, then the two
   * perpendicular axes) into the baked model coordinates. It is the only frame the rays and the
   * lenses use, so normalising the model for display cannot rescale the optics a second time.
   */
  opticalFrame: number[]
  opticalDisplayScale: OpticalDisplayScale
  disclosure: string
}

export interface OpticalDisplayScale {
  baseAperture: number
  crownDiameter: number
  crownSemi: number
  eyepieceSemi: number
  targetFocalRatioForSag: number
  note: string
}

export interface TracedRay {
  field: number
  apertureFrac: number
  exitSlope: number
  /** Height at which this ray meets the eyepiece, in metres. */
  focusY: number
  /** Axial position where this ray crosses the axis: the focal plane, in metres. */
  focusCrossing: number
  /** (s, height) pairs in the optical frame, from the incoming beam to the emitted beam. */
  points: [number, number][]
}

/**
 * Vertex layout of a traced ray, in the order the light meets things:
 * [0] entry at the objective's front vertex, [1] the objective's rear vertex, [2] the focal plane,
 * [3] the eyepiece's front vertex, [4] the eyepiece's rear vertex, [5] the emitted beam.
 */
const OBJECTIVE_BACK = 1
const FOCUS_VERTEX = 2
const EYEPIECE_FIRST = 3
const START_INDEX = 0
const RAY_VERTICES = 6

export function isRefractorMetadata(value: unknown): value is RefractorMetadata {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Partial<RefractorMetadata>
  return Array.isArray(m.rays)
    && m.rays.length > 0
    && typeof m.focusS === 'number'
    && typeof m.focalLength === 'number'
    && typeof m.eyepieceFrontS === 'number'
    && typeof m.objectiveAperture === 'number'
    && typeof m.minBoreRadius === 'number'
}

/** An optical-frame point (s along the axis, height across it) in the model's own coordinates. */
export function opticalPoint(frame: THREE.Matrix4, s: number, height: number): THREE.Vector3 {
  const e = frame.elements
  return new THREE.Vector3(
    e[0]! * s + e[4]! * height + e[12]!,
    e[1]! * s + e[5]! * height + e[13]!,
    e[2]! * s + e[6]! * height + e[14]!,
  )
}

/** The optical axis direction in the model's own coordinates. */
export function opticalAxis(frame: THREE.Matrix4): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixColumn(frame, 0).normalize()
}

export interface RaySegment {
  start: THREE.Vector3
  end: THREE.Vector3
  /** 0 incoming parallel light, 1 objective refraction and convergence, 2 focal plane, 3 eyepiece. */
  step: number
  field: number
}

/**
 * Split every traced ray into the four teaching phases from its own vertices: the entry run to the
 * objective is the incoming parallel light, the objective to the focal plane is the refraction and
 * convergence, the focal plane vertex is the image, and the eyepiece and beyond is the exit.
 */
export function raySegments(metadata: RefractorMetadata, frame: THREE.Matrix4): RaySegment[] {
  const segments: RaySegment[] = []
  const stepOf = (i: number) => {
    if (i === START_INDEX) return 0
    if (i < FOCUS_VERTEX) return 1
    if (i === FOCUS_VERTEX) return 2
    return 3
  }
  for (const ray of metadata.rays) {
    const points = ray.points
    if (points.length < RAY_VERTICES) continue
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]!
      const b = points[i + 1]!
      segments.push({
        start: opticalPoint(frame, a[0], a[1]),
        end: opticalPoint(frame, b[0], b[1]),
        step: stepOf(i),
        field: ray.field,
      })
    }
  }
  return segments
}

/**
 * True when the vertex list follows the light. The exported frame runs with the light, so every
 * successive vertex sits at a smaller s: entry, objective, focal plane, eyepiece, emitted beam.
 */
export function rayOrderIsPhysical(metadata: RefractorMetadata): boolean {
  return metadata.rays.every((ray) => {
    const s = ray.points.map(([value]) => value)
    if (ray.points.length !== RAY_VERTICES) return false
    for (let i = 0; i + 1 < s.length; i++) {
      if (!(s[i]! > s[i + 1]!)) return false
    }
    // the third vertex is the focal plane itself, and it lies between the two lens groups
    return Math.abs(s[FOCUS_VERTEX]! - metadata.focusS) < 1e-6
      && Math.abs(ray.points[FOCUS_VERTEX]![1]) < 1e-9
      && Math.abs(ray.focusCrossing - metadata.focusS) < 1e-6
  })
}

export interface RayValidation {
  /** Largest height at which an incoming ray meets the objective, in metres. */
  entryRadiusMax: number
  entryWithinAperture: boolean
  /** Largest residual height of the on-axis bundle at the focal plane, in metres. */
  focusResidualMax: number
  /** Spread of the emitted directions across the whole bundle, in radians. */
  exitSpreadRad: number
  /** Spread of the emitted directions inside a single bundle, in radians. */
  exitBundleSpreadRad: number
  /** Smallest clearance between a ray and the measured tube bore, in metres. */
  wallClearanceMin: number
  /** Smallest distance from any ray to the tube wall where the aperture is, in metres. */
  objectiveClearance: number
  raysChecked: number
}

/**
 * Re-check the published rays against the published calibration. The scene draws exactly these
 * segments, so the interface never claims a property the traced data does not have.
 */
export function validateRays(metadata: RefractorMetadata): RayValidation {
  const aperture = metadata.objectiveAperture / 2
  const front = metadata.objectiveFrontS
  const back = metadata.eyepieceBackS
  const slices = metadata.boreSlices ?? []
  const boreAt = (s: number): number => {
    for (const [lo, hi, radius] of slices) {
      if (s >= lo && s < hi) return radius
    }
    return metadata.minBoreRadius
  }
  let entryMax = 0
  let focusResidual = 0
  let clearance = Number.POSITIVE_INFINITY
  let objectiveClearance = Number.POSITIVE_INFINITY
  const allSlopes: number[] = []
  const byBundle = new Map<number, number[]>()
  for (const ray of metadata.rays) {
    const points = ray.points
    entryMax = Math.max(entryMax, Math.abs(points[0]![1]))
    if (Math.abs(ray.field) < 1e-9) {
      focusResidual = Math.max(focusResidual, Math.abs(ray.focusCrossing - metadata.focusS))
    }
    allSlopes.push(ray.exitSlope)
    const bundle = byBundle.get(ray.field) ?? []
    bundle.push(ray.exitSlope)
    byBundle.set(ray.field, bundle)
    for (const [s, height] of points) {
      // the exported s runs with the light, from the objective end down to the eyepiece
      if (s > front || s < back) continue
      const radius = boreAt(s)
      if (radius <= 0) continue
      clearance = Math.min(clearance, radius - Math.abs(height))
      if (Math.abs(s - front) < 1e-5) {
        objectiveClearance = Math.min(objectiveClearance, radius - Math.abs(height))
      }
    }
  }
  const spread = (values: number[]) => (values.length < 2 ? 0 : Math.max(...values) - Math.min(...values))
  return {
    entryRadiusMax: entryMax,
    entryWithinAperture: entryMax <= aperture + 1e-9,
    focusResidualMax: focusResidual,
    exitSpreadRad: spread(allSlopes),
    exitBundleSpreadRad: Math.max(...[...byBundle.values()].map(spread)),
    wallClearanceMin: Number.isFinite(clearance) ? clearance : 0,
    objectiveClearance: Number.isFinite(objectiveClearance) ? objectiveClearance : 0,
    raysChecked: metadata.rays.length,
  }
}

/**
 * How much to exaggerate the drawn curvature of the teaching lenses.
 *
 * Fitted to this model the doublet is about three focal lengths across, so its true sag is a few
 * hundredths of a millimetre and it would render as a flat disk, which is exactly the failure the
 * brief warns about. The factor below deepens the drawn surface to that of an ordinary f/13
 * achromat. It changes only the drawn surface: the aperture, the axis, the focal length and every
 * traced ray keep the values the builder solved, and the interface says the curvature is drawn
 * deeper than the solved one.
 */
export function lensSagScale(metadata: RefractorMetadata): number {
  const display = metadata.opticalDisplayScale
  if (!display || !Number.isFinite(metadata.focalRatio) || metadata.focalRatio <= 0) return 1
  return Math.max(1, Math.min(30, metadata.focalRatio / display.targetFocalRatioForSag))
}

/**
 * Deepen a lens mesh's drawn sag about its vertex plane, leaving its rim radius alone.
 *
 * Each vertex is moved along the optical axis by (scale - 1) times its own deviation from the
 * vertex plane, so the surface keeps its diameter, its thickness at the centre and its axis.
 */
export function exaggerateLensSag(mesh: THREE.Mesh, vertexS: number, frame: THREE.Matrix4, scale: number): void {
  if (scale <= 1) return
  const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  const e = frame.elements
  const axis = new THREE.Vector3(e[0]!, e[1]!, e[2]!).normalize()
  const point = new THREE.Vector3()
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i)
    const along = point.dot(axis) - vertexS
    point.addScaledVector(axis, along * (scale - 1))
    positions.setXYZ(i, point.x, point.y, point.z)
  }
  positions.needsUpdate = true
  mesh.geometry.computeVertexNormals()
  mesh.geometry.computeBoundingSphere()
}
