import { describe, expect, it } from 'vitest'
import {
  logarithmicDragScale,
  maximumSafePolarAngle,
  normaliseWheelPixels,
} from './navigation'

describe('focused lunar navigation', () => {
  it('keeps a close oblique camera outside the terrain shell', () => {
    const distance = 0.00005
    const clearance = 0.00001
    const polar = maximumSafePolarAngle(distance, 1, clearance, 0.1, Math.PI / 2)
    const radiusSquared = 1 + distance ** 2 + 2 * distance * Math.cos(polar)
    expect(Math.sqrt(radiusSquared)).toBeGreaterThanOrEqual(1 + clearance - 1e-12)
  })

  it('uses the configured horizon cap when there is ample clearance', () => {
    expect(maximumSafePolarAngle(0.5, 1, 0.00001, 0.1, 1.2)).toBeCloseTo(1.2)
  })

  it('slows pixel rotation smoothly toward the closest imagery', () => {
    const close = logarithmicDragScale(0.001, 0.001, 1, 0.002, 0.005)
    const middle = logarithmicDragScale(0.03, 0.001, 1, 0.002, 0.005)
    const far = logarithmicDragScale(1, 0.001, 1, 0.002, 0.005)
    expect(close).toBe(0.002)
    expect(middle).toBeGreaterThan(close)
    expect(middle).toBeLessThan(far)
    expect(far).toBe(0.005)
  })

  it('normalizes wheel line and page units and caps trackpad spikes', () => {
    expect(normaliseWheelPixels(2, 1, 900)).toBe(32)
    expect(normaliseWheelPixels(-1, 2, 900)).toBe(-160)
    expect(normaliseWheelPixels(500, 0, 900)).toBe(160)
  })
})
