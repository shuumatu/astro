import { describe, expect, it } from 'vitest'
import { learningStarAppearance } from './starAppearance'

describe('learning star light response', () => {
  it('keeps successively fainter stars dimmer, including stars below the old minimum disk size', () => {
    const profiles = [-1.5, 0, 1, 2, 3, 4, 5, 5.5, 6].map(mag => learningStarAppearance(mag))
    for (let index = 1; index < profiles.length; index += 1) {
      const before = profiles[index - 1], after = profiles[index]
      // Every star uses the same normalized radial profile. This quantity is
      // proportional to its integrated core intensity on the display.
      expect(after.coreOpacity * after.coreRadius ** 2).toBeLessThan(before.coreOpacity * before.coreRadius ** 2)
      expect(after.coreRadius).toBeLessThan(before.coreRadius)
    }
    expect(learningStarAppearance(5).coreOpacity).toBeLessThan(.5)
    expect(learningStarAppearance(5).haloOpacity).toBe(0)
  })

  it('keeps hue separate from brightness and provides a neutral fallback', () => {
    const warm = learningStarAppearance(1, 1.5), cool = learningStarAppearance(1, -.2)
    expect(warm.coreColor).not.toBe(cool.coreColor)
    expect(warm.coreOpacity).toBe(cool.coreOpacity)
    expect(warm.coreRadius).toBe(cool.coreRadius)
    expect(learningStarAppearance(1, NaN)).toEqual(learningStarAppearance(1, null))
  })

  it('produces bounded, finite profiles even for incomplete catalog input', () => {
    for (const magnitude of [NaN, Infinity, -Infinity, -100, 100]) {
      const profile = learningStarAppearance(magnitude)
      for (const value of [profile.coreRadius, profile.coreOpacity, profile.haloRadius, profile.haloOpacity]) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
      }
      expect(profile.coreOpacity).toBeLessThanOrEqual(1)
      expect(profile.haloOpacity).toBeLessThanOrEqual(1)
    }
  })
})
