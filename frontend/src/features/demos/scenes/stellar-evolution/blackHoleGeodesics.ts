/**
 * Schwarzschild null rays for a distant observer, in units Rs = 1.
 * u = 1/r, u'' = 3u²/2 - u, u(0) = 0, u'(0) = 1/b.
 * See Bruneton (2020), eq. 8 and section 3.3.3:
 * https://ebruneton.github.io/black_hole_shader/paper.pdf
 *
 * Only geometry is relativistic here: emission remains a teaching illustration.
 * The table stores the entire incoming/outgoing path, so changing the camera's
 * elevation moves intersections instead of switching between two images.
 */
export const CRITICAL_IMPACT = Math.sqrt(27) / 2
export const RAY_TABLE = { width: 1024, height: 768, maxImpact: 32, maxAngle: 3 * Math.PI } as const

/** Cubic sampling puts resolution on both sides of the photon capture boundary. */
export function impactAt(coordinate: number): number {
  const x = coordinate * 2 - 1
  return CRITICAL_IMPACT + x ** 3 * (x < 0 ? CRITICAL_IMPACT : RAY_TABLE.maxImpact - CRITICAL_IMPACT)
}

export function impactCoordinate(impact: number): number {
  const d = impact - CRITICAL_IMPACT
  return .5 + .5 * Math.cbrt(d / (d < 0 ? CRITICAL_IMPACT : RAY_TABLE.maxImpact - CRITICAL_IMPACT))
}

/** Fourth-order Runge–Kutta; four small steps per table row. */
export function advanceRay(u: number, velocity: number, step: number): [number, number] {
  const acceleration = (value: number) => 1.5 * value * value - value
  const a = acceleration(u)
  const ub = velocity + step * a / 2
  const b = acceleration(u + step * velocity / 2)
  const uc = velocity + step * b / 2
  const c = acceleration(u + step * ub / 2)
  const ud = velocity + step * c
  const d = acceleration(u + step * uc)
  return [u + step * (velocity + 2 * ub + 2 * uc + ud) / 6,
    velocity + step * (a + 2 * b + 2 * c + d) / 6]
}

let cachedData: Uint8Array | undefined
export function rayTableData(): Uint8Array {
  if (cachedData) return cachedData
  const { width, height, maxAngle } = RAY_TABLE
  const data = new Uint8Array(width * height * 4)
  const step = maxAngle / (height - 1) / 4
  for (let x = 0; x < width; x++) {
    const impact = impactAt(x / (width - 1))
    let u = 0, velocity = 1 / Math.max(impact, .0001), terminated = false
    for (let y = 0; y < height; y++) {
      const encoded = Math.round(Math.min(1, Math.max(0, u)) * 65535)
      const index = (y * width + x) * 4
      data[index] = encoded >> 8
      data[index + 1] = encoded & 255
      data[index + 3] = 255
      for (let s = 0; s < 4 && !terminated; s++) {
        ;[u, velocity] = advanceRay(u, velocity, step)
        // Terminate rather than continuing an escaped/captured ray through a
        // fictitious second orbit. Sentinels decode outside the disk's radii.
        if (u >= 1 || u < 0) {
          u = u >= 1 ? 1 : 0
          terminated = true
        }
      }
    }
  }
  cachedData = data
  return data
}
