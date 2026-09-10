export interface EllipticalOrbit {
  semiMajorAxis: number
  eccentricity: number
  inclinationDeg: number
  ascendingNodeDeg: number
  argumentOfPeriapsisDeg: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface OrbitFrame {
  semiMajorAxis: number
  semiMinorAxis: number
  eccentricity: number
  inclination: number
  ascendingNode: number
  argumentOfPeriapsis: number
  periapsis: Vec3
  transverse: Vec3
  normal: Vec3
}

export interface EclipticNode {
  kind: 'ascending' | 'descending'
  radius: number
  point: Vec3
}

/**
 * Builds an ecliptic reference frame (x toward the equinox, z toward ecliptic north)
 * for an ellipse described by the classical orbital elements.
 */
export function createOrbitFrame(orbit: EllipticalOrbit): OrbitFrame {
  const inclination = toRadians(orbit.inclinationDeg)
  const node = toRadians(orbit.ascendingNodeDeg)
  const argument = toRadians(orbit.argumentOfPeriapsisDeg)
  const cosInclination = Math.cos(inclination)
  const sinInclination = Math.sin(inclination)
  const cosNode = Math.cos(node)
  const sinNode = Math.sin(node)
  const cosArgument = Math.cos(argument)
  const sinArgument = Math.sin(argument)

  const periapsis: Vec3 = {
    x: cosNode * cosArgument - sinNode * sinArgument * cosInclination,
    y: sinNode * cosArgument + cosNode * sinArgument * cosInclination,
    z: sinArgument * sinInclination,
  }
  const transverse: Vec3 = {
    x: -cosNode * sinArgument - sinNode * cosArgument * cosInclination,
    y: -sinNode * sinArgument + cosNode * cosArgument * cosInclination,
    z: cosArgument * sinInclination,
  }
  const normal: Vec3 = {
    x: periapsis.y * transverse.z - periapsis.z * transverse.y,
    y: periapsis.z * transverse.x - periapsis.x * transverse.z,
    z: periapsis.x * transverse.y - periapsis.y * transverse.x,
  }
  const semiMajorAxis = orbit.semiMajorAxis
  const eccentricity = orbit.eccentricity

  return {
    semiMajorAxis,
    semiMinorAxis: semiMajorAxis * Math.sqrt(Math.max(0, 1 - eccentricity * eccentricity)),
    eccentricity,
    inclination,
    ascendingNode: node,
    argumentOfPeriapsis: argument,
    periapsis,
    transverse,
    normal,
  }
}

export function framePoint(frame: OrbitFrame, eccentricAnomaly: number): Vec3 {
  const along = frame.semiMajorAxis * (Math.cos(eccentricAnomaly) - frame.eccentricity)
  const across = frame.semiMinorAxis * Math.sin(eccentricAnomaly)
  return {
    x: frame.periapsis.x * along + frame.transverse.x * across,
    y: frame.periapsis.y * along + frame.transverse.y * across,
    z: frame.periapsis.z * along + frame.transverse.z * across,
  }
}

export function frameRadius(frame: OrbitFrame, eccentricAnomaly: number): number {
  return frame.semiMajorAxis * (1 - frame.eccentricity * Math.cos(eccentricAnomaly))
}

/** Unit vector in the direction of orbital motion at the given eccentric anomaly. */
export function frameTangent(frame: OrbitFrame, eccentricAnomaly: number): Vec3 {
  const along = -frame.semiMajorAxis * Math.sin(eccentricAnomaly)
  const across = frame.semiMinorAxis * Math.cos(eccentricAnomaly)
  const x = frame.periapsis.x * along + frame.transverse.x * across
  const y = frame.periapsis.y * along + frame.transverse.y * across
  const z = frame.periapsis.z * along + frame.transverse.z * across
  const length = Math.hypot(x, y, z)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  return { x: x / length, y: y / length, z: z / length }
}

export function perihelionRadius(frame: OrbitFrame): number {
  return frame.semiMajorAxis * (1 - frame.eccentricity)
}

export function aphelionRadius(frame: OrbitFrame): number {
  return frame.semiMajorAxis * (1 + frame.eccentricity)
}

/**
 * The two points where the orbit crosses the ecliptic plane. Two orbits that lie in
 * different planes can only ever meet on the line where those planes intersect, so the
 * nodes below are the only candidates for an orbit-to-orbit intersection.
 */
export function eclipticNodes(frame: OrbitFrame): EclipticNode[] {
  const semiLatus = frame.semiMajorAxis * (1 - frame.eccentricity ** 2)
  const cosine = Math.cos(frame.argumentOfPeriapsis)
  const ascendingRadius = semiLatus / (1 + frame.eccentricity * cosine)
  const descendingRadius = semiLatus / (1 - frame.eccentricity * cosine)
  const nodeX = Math.cos(frame.ascendingNode)
  const nodeY = Math.sin(frame.ascendingNode)

  return [
    {
      kind: 'ascending',
      radius: ascendingRadius,
      point: { x: nodeX * ascendingRadius, y: nodeY * ascendingRadius, z: 0 },
    },
    {
      kind: 'descending',
      radius: descendingRadius,
      point: { x: -nodeX * descendingRadius, y: -nodeY * descendingRadius, z: 0 },
    },
  ]
}

/** Distance from a point to a circular orbit of the given radius in the ecliptic plane. */
export function distanceToEclipticCircle(point: Vec3, radius: number): number {
  return Math.hypot(Math.hypot(point.x, point.y) - radius, point.z)
}

/**
 * Smallest time at or after `currentTime` at which a body on a periodic orbit reaches the
 * given anomaly. Used to fast-forward the Earth to the point where it crosses the stream.
 */
export function nextTimeForAnomaly(currentTime: number, period: number, anomaly: number): number {
  const phase = (normalizeAngle(anomaly) / (Math.PI * 2)) * period
  let candidate = Math.floor((currentTime - phase) / period) * period + phase
  if (candidate < currentTime - 1e-9) candidate += period
  return candidate
}

/** Ecliptic longitude of a node, used to line the Earth up with the stream crossing. */
export function eclipticLongitude(point: Vec3): number {
  return Math.atan2(point.y, point.x)
}

export function orbitPathPoints(frame: OrbitFrame, segments = 256): Vec3[] {
  const points: Vec3[] = []
  for (let index = 0; index <= segments; index += 1) {
    points.push(framePoint(frame, (index / segments) * Math.PI * 2))
  }
  return points
}

/** Kepler's third law ratio: period relative to a reference orbit in the same units. */
export function keplerPeriodRatio(semiMajorAxis: number, referenceAxis: number): number {
  return (semiMajorAxis / referenceAxis) ** 1.5
}

export function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2
  const normalized = angle % fullTurn
  return normalized < 0 ? normalized + fullTurn : normalized
}

/** Solves Kepler's equation M = E - e sin E with Newton iteration. */
export function eccentricAnomalyFromMean(meanAnomaly: number, eccentricity: number): number {
  const mean = normalizeAngle(meanAnomaly)
  let anomaly = eccentricity < 0.8 ? mean : Math.PI
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const residual = anomaly - eccentricity * Math.sin(anomaly) - mean
    const derivative = 1 - eccentricity * Math.cos(anomaly)
    const step = residual / derivative
    anomaly -= step
    if (Math.abs(step) < 1e-12) break
  }
  return anomaly
}

export function trueAnomalyFromEccentricAnomaly(eccentricAnomaly: number, eccentricity: number): number {
  return Math.atan2(
    Math.sqrt(Math.max(0, 1 - eccentricity * eccentricity)) * Math.sin(eccentricAnomaly),
    Math.cos(eccentricAnomaly) - eccentricity,
  )
}

export function eccentricAnomalyFromTrueAnomaly(trueAnomaly: number, eccentricity: number): number {
  const half = Math.atan2(
    Math.sqrt(Math.max(0, 1 - eccentricity)) * Math.sin(trueAnomaly / 2),
    Math.sqrt(1 + eccentricity) * Math.cos(trueAnomaly / 2),
  )
  return normalizeAngle(2 * half)
}

/**
 * Orbital velocity in the same ecliptic frame as framePoint. The eccentric anomaly advances
 * at dE/dt = n / (1 - e cos E), so this is the exact derivative rather than a difference
 * quotient — near perihelion a finite difference loses too much precision.
 */
export function frameVelocity(
  frame: OrbitFrame,
  eccentricAnomaly: number,
  meanMotion: number,
): Vec3 {
  const rate = meanMotion / (1 - frame.eccentricity * Math.cos(eccentricAnomaly))
  const along = -frame.semiMajorAxis * Math.sin(eccentricAnomaly) * rate
  const across = frame.semiMinorAxis * Math.cos(eccentricAnomaly) * rate
  return {
    x: frame.periapsis.x * along + frame.transverse.x * across,
    y: frame.periapsis.y * along + frame.transverse.y * across,
    z: frame.periapsis.z * along + frame.transverse.z * across,
  }
}

export function subtract(left: Vec3, right: Vec3): Vec3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }
}

export function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

/**
 * The radiant is the sky direction the shower appears to come from: exactly opposite the
 * meteoroids' geocentric velocity. It is *not* the direction of Earth's orbital motion —
 * that direction only contributes through this vector difference.
 */
export function radiantDirection(meteoroidVelocity: Vec3, earthVelocity: Vec3): Vec3 {
  const geocentric = subtract(meteoroidVelocity, earthVelocity)
  return normalize({ x: -geocentric.x, y: -geocentric.y, z: -geocentric.z })
}

export function angleBetweenDegrees(left: Vec3, right: Vec3): number {
  const a = normalize(left)
  const b = normalize(right)
  const cosine = Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z))
  return (Math.acos(cosine) * 180) / Math.PI
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}
