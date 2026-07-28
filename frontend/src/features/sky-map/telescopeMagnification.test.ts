import { describe, expect, it } from 'vitest'
import {
  MAX_TELESCOPE_SKY_ZOOM,
  telescopeMagnificationToSkyScale,
} from './telescopeMagnification'

describe('telescope magnification simulation', () => {
  it('keeps displayed magnification synchronized with the chart scale', () => {
    expect(telescopeMagnificationToSkyScale(100)).toBe(100)
    expect(MAX_TELESCOPE_SKY_ZOOM).toBe(300)
  })
})
