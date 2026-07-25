import { describe, expect, it } from 'vitest'
import { starColor } from './starColor'

describe('starColor', () => {
  it('maps B-V colour indices continuously from blue to red', () => {
    expect(starColor(-0.3, 1)).not.toBe(starColor(-0.2, 1))
    expect(starColor(0.2, 1)).not.toBe(starColor(0.3, 1))
    expect(starColor(1.6, 1)).not.toBe(starColor(1.8, 1))
  })

  it('desaturates faint stars without changing their B-V ordering', () => {
    expect(starColor(1.4, 6)).not.toBe(starColor(1.4, 0))
    expect(starColor(-0.2, 6)).not.toBe(starColor(-0.2, 0))
  })

  it('clamps extreme B-V values and uses a neutral fallback when unavailable', () => {
    expect(starColor(-10, 1)).toBe(starColor(-0.4, 1))
    expect(starColor(10, 1)).toBe(starColor(2, 1))
    expect(starColor(null, 1)).toBe('rgb(232 239 239)')
  })
})
