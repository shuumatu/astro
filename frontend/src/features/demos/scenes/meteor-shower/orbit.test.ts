import { describe, expect, it } from 'vitest'
import { COMET_ORBIT, EARTH_ORBIT, EARTH_ORBIT_RADIUS, SCENE } from './config'
import {
  angleBetweenDegrees,
  aphelionRadius,
  createOrbitFrame,
  distanceToEclipticCircle,
  eccentricAnomalyFromTrueAnomaly,
  eccentricAnomalyFromMean,
  eclipticLongitude,
  eclipticNodes,
  framePoint,
  frameRadius,
  frameTangent,
  frameVelocity,
  keplerPeriodRatio,
  nextTimeForAnomaly,
  normalizeAngle,
  orbitPathPoints,
  perihelionRadius,
  radiantDirection,
  subtract,
  trueAnomalyFromEccentricAnomaly,
} from './orbit'
import type { Vec3 } from './orbit'

function length(vector: { x: number; y: number; z: number }): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function dot(left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }): number {
  return left.x * right.x + left.y * right.y + left.z * right.z
}

function separation(frame: ReturnType<typeof createOrbitFrame>, anomaly: number): number {
  return distanceToEclipticCircle(framePoint(frame, anomaly), EARTH_ORBIT_RADIUS)
}

type Vector = { x: number, y: number, z: number }

function unit(vector: Vector): Vector {
  const size = length(vector)
  return { x: vector.x / size, y: vector.y / size, z: vector.z / size }
}

function scale(vector: Vector, factor: number): Vector {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor }
}

describe('orbit frame', () => {
  it('builds an orthonormal basis for an inclined orbit', () => {
    const frame = createOrbitFrame(COMET_ORBIT)
    expect(length(frame.periapsis)).toBeCloseTo(1, 12)
    expect(length(frame.transverse)).toBeCloseTo(1, 12)
    expect(length(frame.normal)).toBeCloseTo(1, 12)
    expect(dot(frame.periapsis, frame.transverse)).toBeCloseTo(0, 12)
    expect(dot(frame.periapsis, frame.normal)).toBeCloseTo(0, 12)
    expect(dot(frame.transverse, frame.normal)).toBeCloseTo(0, 12)
  })

  it('keeps a zero-inclination orbit inside the ecliptic plane', () => {
    const frame = createOrbitFrame(EARTH_ORBIT)
    for (const point of orbitPathPoints(frame, 64)) {
      expect(Math.abs(point.z)).toBeLessThan(1e-12)
    }
    expect(Math.abs(frame.normal.z)).toBeCloseTo(1, 12)
  })

  it('reaches perihelion and aphelion at the expected anomalies', () => {
    const frame = createOrbitFrame(COMET_ORBIT)
    const perihelion = framePoint(frame, 0)
    const aphelion = framePoint(frame, Math.PI)

    expect(length(perihelion)).toBeCloseTo(perihelionRadius(frame), 12)
    expect(length(aphelion)).toBeCloseTo(aphelionRadius(frame), 12)

    const perihelionDirection = {
      x: perihelion.x / length(perihelion),
      y: perihelion.y / length(perihelion),
      z: perihelion.z / length(perihelion),
    }
    expect(dot(perihelionDirection, frame.periapsis)).toBeCloseTo(1, 12)
  })

  it('agrees with the analytic radius law r = a(1 - e cos E)', () => {
    const frame = createOrbitFrame(COMET_ORBIT)
    for (let step = 0; step <= 40; step += 1) {
      const anomaly = (step / 40) * Math.PI * 2
      expect(length(framePoint(frame, anomaly))).toBeCloseTo(frameRadius(frame, anomaly), 10)
    }
  })

  it('returns unit tangents that advance along the orbit', () => {
    const frame = createOrbitFrame(COMET_ORBIT)
    for (let step = 0; step < 16; step += 1) {
      const anomaly = (step / 16) * Math.PI * 2
      const tangent = frameTangent(frame, anomaly)
      expect(length(tangent)).toBeCloseTo(1, 10)

      const current = framePoint(frame, anomaly)
      const next = framePoint(frame, anomaly + 0.01)
      const step3d = { x: next.x - current.x, y: next.y - current.y, z: next.z - current.z }
      const stepLength = length(step3d)
      const cosine = dot(tangent, { x: step3d.x / stepLength, y: step3d.y / stepLength, z: step3d.z / stepLength })
      expect(cosine).toBeGreaterThan(0.999)
    }
  })
})

describe('Kepler solver', () => {
  it('solves Kepler equation across the full anomaly range', () => {
    for (const eccentricity of [0, 0.1, 0.5, 0.72, 0.9]) {
      for (let step = 0; step < 24; step += 1) {
        const mean = (step / 24) * Math.PI * 2
        const anomaly = eccentricAnomalyFromMean(mean, eccentricity)
        const residual = anomaly - eccentricity * Math.sin(anomaly) - mean
        expect(Math.abs(residual)).toBeLessThan(1e-9)
      }
    }
  })

  it('normalises angles into a single turn', () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((Math.PI * 3) / 2, 12)
    expect(normalizeAngle(Math.PI * 5)).toBeCloseTo(Math.PI, 12)
  })

  it('derives true anomaly consistent with the eccentric anomaly', () => {
    const frame = createOrbitFrame(COMET_ORBIT)
    for (let step = 0; step < 12; step += 1) {
      const anomaly = (step / 12) * Math.PI * 2
      const trueAnomaly = trueAnomalyFromEccentricAnomaly(anomaly, frame.eccentricity)
      const expectedRadius = frameRadius(frame, anomaly)
      const semiLatus = frame.semiMajorAxis * (1 - frame.eccentricity ** 2)
      const radiusFromTrueAnomaly = semiLatus / (1 + frame.eccentricity * Math.cos(trueAnomaly))
      expect(radiusFromTrueAnomaly).toBeCloseTo(expectedRadius, 9)
    }
  })
})

describe('orbital velocity', () => {
  const TWOPI = Math.PI * 2

  it('round-trips between eccentric and true anomaly', () => {
    for (const eccentricity of [0, 0.2, 0.72, 0.9]) {
      for (let step = 0; step < 16; step += 1) {
        const anomaly = (step / 16) * TWOPI
        const trueAnomaly = trueAnomalyFromEccentricAnomaly(anomaly, eccentricity)
        expect(eccentricAnomalyFromTrueAnomaly(trueAnomaly, eccentricity)).toBeCloseTo(anomaly, 9)
      }
    }
  })

  it('matches a central difference of the position', () => {
    const frame = createOrbitFrame(COMET_ORBIT)
    const meanMotion = TWOPI / 2.35
    const step = 1e-6
    for (let index = 0; index < 12; index += 1) {
      const anomaly = (index / 12) * TWOPI
      const before = framePoint(frame, anomaly - step)
      const after = framePoint(frame, anomaly + step)
      const rate = meanMotion / (1 - frame.eccentricity * Math.cos(anomaly))
      const numeric = {
        x: ((after.x - before.x) / (2 * step)) * rate,
        y: ((after.y - before.y) / (2 * step)) * rate,
        z: ((after.z - before.z) / (2 * step)) * rate,
      }
      const analytic = frameVelocity(frame, anomaly, meanMotion)
      expect(analytic.x).toBeCloseTo(numeric.x, 6)
      expect(analytic.y).toBeCloseTo(numeric.y, 6)
      expect(analytic.z).toBeCloseTo(numeric.z, 6)
    }
  })

  it('satisfies the vis-viva relation at perihelion', () => {
    const frame = createOrbitFrame(COMET_ORBIT)
    const meanMotion = TWOPI / 2.35
    const velocity = frameVelocity(frame, 0, meanMotion)
    const expected = meanMotion * frame.semiMajorAxis * Math.sqrt((1 + frame.eccentricity) / (1 - frame.eccentricity))
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(expected, 9)
  })
})

describe('radiant direction', () => {
  it('points opposite the geocentric velocity', () => {
    const radiant = radiantDirection({ x: 30, y: 0, z: 0 }, { x: 10, y: 0, z: 0 })
    expect(radiant.x).toBeCloseTo(-1, 12)
    expect(Math.hypot(radiant.x, radiant.y, radiant.z)).toBeCloseTo(1, 12)
  })

  it('is independent of the meteoroid speed being the larger one', () => {
    const fast = radiantDirection({ x: 0, y: 40, z: 0 }, { x: 0, y: 10, z: 0 })
    const slow = radiantDirection({ x: 0, y: 5, z: 0 }, { x: 0, y: 10, z: 0 })
    expect(fast.y).toBeCloseTo(-1, 12)
    expect(slow.y).toBeCloseTo(1, 12)
  })
})

describe('demo shower geometry', () => {
  const TWOPI = Math.PI * 2
  const cometFrame = createOrbitFrame(COMET_ORBIT)
  const earthFrame = createOrbitFrame(EARTH_ORBIT)
  const cometPeriodYears = keplerPeriodRatio(COMET_ORBIT.semiMajorAxis, EARTH_ORBIT.semiMajorAxis)
  const crossing = eclipticNodes(cometFrame).find((node) => node.kind === 'descending')!

  // Dust rides the comet orbit, so its speed at the crossing is the comet's speed there.
  const dustVelocity = frameVelocity(
    cometFrame,
    eccentricAnomalyFromTrueAnomaly(Math.PI - cometFrame.argumentOfPeriapsis, cometFrame.eccentricity),
    TWOPI / cometPeriodYears,
  )
  const earthVelocity = frameVelocity(
    earthFrame,
    eccentricAnomalyFromTrueAnomaly(eclipticLongitude(crossing.point), earthFrame.eccentricity),
    TWOPI / 1,
  )
  const radiant = radiantDirection(dustVelocity, earthVelocity)
  const apex = { x: earthVelocity.x, y: earthVelocity.y, z: earthVelocity.z }
  const antiApex = { x: -apex.x, y: -apex.y, z: -apex.z }

  it('puts the radiant at the altitude the ground view can show', () => {
    const antiSolar = unit(crossing.point)
    const separation = angleBetweenDegrees(radiant, antiSolar)
    const targetFromRadiant = Math.min(
      ((90 - SCENE.observationRadiantAltitudeDeg) * Math.PI) / 180,
      (separation * Math.PI) / 180,
    )
    // Slide from the radiant towards the anti-sunward direction by exactly that much.
    const toward = unit(subtract(antiSolar, scale(radiant, dot(antiSolar, radiant))))
    const zenith = unit({
      x: radiant.x * Math.cos(targetFromRadiant) + toward.x * Math.sin(targetFromRadiant),
      y: radiant.y * Math.cos(targetFromRadiant) + toward.y * Math.sin(targetFromRadiant),
      z: radiant.z * Math.cos(targetFromRadiant) + toward.z * Math.sin(targetFromRadiant),
    })

    const altitude = 90 - angleBetweenDegrees(zenith, radiant)
    const sunAltitude = angleBetweenDegrees(zenith, antiSolar) - 90

    expect(altitude).toBeCloseTo(SCENE.observationRadiantAltitudeDeg, 6)
    // The site must be dark enough: the Sun well below the horizon, not just barely set.
    expect(sunAltitude).toBeLessThan(-30)
  })

  it('does not put the radiant at the apex of the Earth way', () => {
    const apexAngle = angleBetweenDegrees(apex, radiant)
    const antiApexAngle = angleBetweenDegrees(antiApex, radiant)
    // A slow, overtaking encounter like this one puts the radiant far from the apex.
    expect(apexAngle).toBeGreaterThan(45)
    expect(antiApexAngle).toBeGreaterThan(45)
  })

  it('keeps the geocentric speed at a plausible fraction of the Earth orbital speed', () => {
    const geocentric = Math.hypot(
      ...([subtract(dustVelocity, earthVelocity)].flatMap((v) => [v.x, v.y, v.z])),
    )
    const earthSpeed = Math.hypot(earthVelocity.x, earthVelocity.y, earthVelocity.z)
    expect(geocentric / earthSpeed).toBeGreaterThan(0.4)
    expect(geocentric / earthSpeed).toBeLessThan(2.5)
  })
})

describe('alignment timing', () => {
  const crossingAnomaly = (204 * Math.PI) / 180

  it('reports the ecliptic longitude of a node', () => {
    expect(eclipticLongitude({ x: 1, y: 0, z: 0 })).toBeCloseTo(0, 12)
    expect(eclipticLongitude({ x: 0, y: 1, z: 0 })).toBeCloseTo(Math.PI / 2, 12)
    expect(eclipticLongitude({ x: -1, y: 0, z: 0 })).toBeCloseTo(Math.PI, 12)
  })

  it('waits for the next crossing when the Earth has already passed it', () => {
    expect(nextTimeForAnomaly(0.2, 1, crossingAnomaly)).toBeCloseTo(204 / 360, 9)
    expect(nextTimeForAnomaly(0.9, 1, crossingAnomaly)).toBeCloseTo(1 + 204 / 360, 9)
  })

  it('returns the current time when the Earth is already at the crossing', () => {
    expect(nextTimeForAnomaly(204 / 360, 1, crossingAnomaly)).toBeCloseTo(204 / 360, 9)
  })

  it('always returns a time that places the body at the requested anomaly', () => {
    for (const current of [-3.4, -0.1, 0, 0.3, 1.75, 12.2]) {
      const time = nextTimeForAnomaly(current, 1, crossingAnomaly)
      expect(time).toBeGreaterThanOrEqual(current - 1e-9)
      expect(normalizeAngle(time * Math.PI * 2)).toBeCloseTo(normalizeAngle(crossingAnomaly), 9)
    }
  })
})

describe('meteor shower geometry', () => {
  it('brings perihelion right down to the Earth orbital radius', () => {
    const cometFrame = createOrbitFrame(COMET_ORBIT)
    expect(perihelionRadius(cometFrame)).toBeCloseTo(EARTH_ORBIT_RADIUS, 9)
    expect(aphelionRadius(cometFrame)).toBeGreaterThan(EARTH_ORBIT_RADIUS)
  })

  it('has a period closer to that of real shower parents than a two-year comet', () => {
    const period = keplerPeriodRatio(COMET_ORBIT.semiMajorAxis, EARTH_ORBIT.semiMajorAxis)
    expect(period).toBeGreaterThan(3)
    expect(period).toBeLessThan(7)
  })

  it('crosses the ecliptic plane at exactly two nodes', () => {
    const nodes = eclipticNodes(createOrbitFrame(COMET_ORBIT))
    expect(nodes).toHaveLength(2)
    expect(nodes.map((node) => node.kind)).toEqual(['ascending', 'descending'])
    for (const node of nodes) {
      expect(Math.abs(node.point.z)).toBeLessThan(1e-12)
      expect(Math.hypot(node.point.x, node.point.y)).toBeCloseTo(node.radius, 9)
    }
  })

  it('puts the descending node exactly on the Earth orbit', () => {
    const nodes = eclipticNodes(createOrbitFrame(COMET_ORBIT))
    const descending = nodes.find((node) => node.kind === 'descending')
    const ascending = nodes.find((node) => node.kind === 'ascending')
    expect(descending).toBeDefined()
    expect(ascending).toBeDefined()

    expect(descending!.radius).toBeCloseTo(EARTH_ORBIT_RADIUS, 9)
    expect(distanceToEclipticCircle(descending!.point, EARTH_ORBIT_RADIUS)).toBeLessThan(1e-9)

    // Perihelion sits on the descending node; the ascending node is out at aphelion, so it
    // can never be an intersection.
    expect(ascending!.radius).toBeCloseTo(aphelionRadius(createOrbitFrame(COMET_ORBIT)), 9)
    expect(distanceToEclipticCircle(ascending!.point, EARTH_ORBIT_RADIUS)).toBeGreaterThan(5)
  })

  it('reaches the Earth orbital radius only at its perihelion', () => {
    const cometFrame = createOrbitFrame(COMET_ORBIT)
    const samples = 7200
    let minimum = Number.POSITIVE_INFINITY

    for (let step = 0; step < samples; step += 1) {
      const anomaly = (step / samples) * Math.PI * 2
      minimum = Math.min(minimum, frameRadius(cometFrame, anomaly))
    }

    // The orbit never dips inside our orbit, so the only place it can meet us is perihelion.
    expect(minimum).toBeGreaterThanOrEqual(EARTH_ORBIT_RADIUS - 1e-9)
  })

  it('touches the Earth orbit at a single point', () => {
    const cometFrame = createOrbitFrame(COMET_ORBIT)
    const samples = 7200
    const threshold = 0.01
    let clusters = 0
    let inside = false
    let startedInside = false
    let endedInside = false
    let minimum = Number.POSITIVE_INFINITY
    let closestAnomaly = 0

    for (let step = 0; step < samples; step += 1) {
      const anomaly = (step / samples) * Math.PI * 2
      const point: Vec3 = framePoint(cometFrame, anomaly)
      const distance = distanceToEclipticCircle(point, EARTH_ORBIT_RADIUS)
      if (distance < minimum) {
        minimum = distance
        closestAnomaly = anomaly
      }
      if (step === 0) startedInside = distance < threshold
      if (step === samples - 1) endedInside = distance < threshold
      if (distance < threshold) {
        if (!inside) clusters += 1
        inside = true
      } else {
        inside = false
      }
    }
    if (startedInside && endedInside) clusters -= 1

    // A sampled minimum is only accurate to the sample spacing, so refine it before
    // asserting that the closest approach is really zero.
    const spacing = (Math.PI * 2) / samples
    let low = closestAnomaly - spacing
    let high = closestAnomaly + spacing
    for (let iteration = 0; iteration < 120; iteration += 1) {
      const left = low + (high - low) / 3
      const right = high - (high - low) / 3
      if (separation(cometFrame, left) < separation(cometFrame, right)) high = right
      else low = left
    }

    expect(separation(cometFrame, (low + high) / 2)).toBeLessThan(1e-9)
    expect(clusters).toBe(1)
  })

  it('gives the comet a longer period than the Earth', () => {
    const ratio = keplerPeriodRatio(COMET_ORBIT.semiMajorAxis, EARTH_ORBIT.semiMajorAxis)
    expect(ratio).toBeGreaterThan(1)
    expect(ratio).toBeCloseTo((COMET_ORBIT.semiMajorAxis / EARTH_ORBIT.semiMajorAxis) ** 1.5, 12)
  })
})
