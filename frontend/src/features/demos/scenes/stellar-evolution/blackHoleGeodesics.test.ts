import { describe, expect, it, vi } from 'vitest'
import { advanceRay, CRITICAL_IMPACT, impactAt, impactCoordinate, RAY_TABLE, rayTableData } from './blackHoleGeodesics'
import { createBlackHoleImage } from './blackHoleMaterial'

function sample(impact: number, phi: number): number {
  const { width, height, maxAngle } = RAY_TABLE
  const data = rayTableData()
  const x = impactCoordinate(impact) * (width - 1), y = phi / maxAngle * (height - 1)
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const value = (i: number, j: number) => {
    const index = (j * width + i) * 4
    return (data[index]! * 256 + data[index + 1]!) / 65535
  }
  const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t
  return mix(mix(value(x0, y0), value(x0 + 1, y0), x - x0),
    mix(value(x0, y0 + 1), value(x0 + 1, y0 + 1), x - x0), y - y0)
}

describe('Schwarzschild disk ray table', () => {
  it('preserves the null-ray first integral along incoming and outgoing paths', () => {
    for (const impact of [2, 2.59, 2.61, 4, 12]) {
      let u = 0, velocity = 1 / impact
      for (let i = 0; i < 9000; i++) {
        ;[u, velocity] = advanceRay(u, velocity, .001)
        if (u >= 1 || u < 0) break
        expect(Math.abs(velocity ** 2 + u ** 2 * (1 - u) - 1 / impact ** 2)).toBeLessThan(1e-9)
      }
    }
  })

  it('agrees with independent quadrature of the radial first integral', () => {
    // Integrate dphi/du = 1/sqrt(1/b²-u²+u³), independently of the RK4 ODE.
    for (const [impact, u] of [[2.5, .25], [3, .25], [4, .12], [10, .07]]) {
      const n = 2000, h = u! / n
      const f = (v: number) => 1 / Math.sqrt(1 / impact! ** 2 - v * v + v ** 3)
      let sum = f(0) + f(u!)
      for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * f(i * h)
      expect(sample(impact!, sum * h / 3)).toBeCloseTo(u!, 4)
    }
  })

  it('captures rays below the critical impact and terminates escaped rays', () => {
    expect(sample(2, 7)).toBe(1)
    expect(sample(4, 7)).toBe(0)
    expect(sample(2.61, 7)).toBeGreaterThan(0)
    expect(sample(CRITICAL_IMPACT, 7)).toBeCloseTo(2 / 3, 2)
  })

  it('concentrates table samples around the capture boundary without folding', () => {
    let previous = -1
    for (let i = 0; i <= 1000; i++) {
      const x = i / 1000, impact = impactAt(x)
      expect(impact).toBeGreaterThan(previous)
      expect(impactCoordinate(impact)).toBeCloseTo(x, 7)
      previous = impact
    }
  })

  it('reuses CPU data but releases each material’s GPU texture independently', () => {
    const first = createBlackHoleImage(), second = createBlackHoleImage()
    const a = first.material.uniforms.rays!.value, b = second.material.uniforms.rays!.value
    expect(a.image.data === b.image.data).toBe(true)
    expect(a === b).toBe(false)
    const disposeA = vi.spyOn(a, 'dispose'), disposeB = vi.spyOn(b, 'dispose')
    first.material.dispose()
    expect(disposeA).toHaveBeenCalledOnce()
    expect(disposeB).not.toHaveBeenCalled()
    second.material.dispose()
    first.geometry.dispose()
    second.geometry.dispose()
  })
})
