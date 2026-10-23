import { describe, expect, it } from 'vitest'
import { DIRECTIONS, INITIAL, PRESETS, mapWind, reduceWind } from './model'

describe('solar wind teaching responses', () => {
  it('separates pressure from field-dependent coupling', () => {
    const quiet = mapWind(20, 'north'), strong = mapWind(85, 'north'), south = mapWind(85, 'south')
    expect(strong.nose).toBeLessThan(quiet.nose)
    expect(strong.tail).toBeGreaterThan(quiet.tail)
    expect(south.nose).toBe(strong.nose)
    expect(south.activity).toBeGreaterThan(strong.activity * 3)
    expect(south.ovalColatitude).toBeGreaterThan(strong.ovalColatitude)
    expect(south.ovalWidth).toBeGreaterThan(strong.ovalWidth)
    expect(mapWind(40, 'south').activity).toBeGreaterThan(mapWind(100, 'north').activity)
    expect(strong.activity).toBeGreaterThan(0) // Northward does not switch auroras off.
  })
  it('keeps all supported states finite, ordered and outside Earth', () => {
    for (const direction of DIRECTIONS) {
      let last = mapWind(0, direction)
      for (let intensity = 1; intensity <= 100; intensity++) {
        const next = mapWind(intensity, direction)
        expect(Object.values(next).every(Number.isFinite)).toBe(true)
        expect(next.nose).toBeGreaterThan(1)
        expect(next.nose).toBeLessThan(last.nose)
        expect(next.activity).toBeGreaterThan(last.activity)
        expect(next.activity).toBeLessThanOrEqual(1)
        expect(next.ovalColatitude).toBeLessThan(Math.PI / 4)
        last = next
      }
    }
    for (const invalid of [NaN, Infinity, -Infinity]) expect(mapWind(invalid, 'north')).toEqual(mapWind(20, 'north'))
    expect(mapWind(-50, 'north')).toEqual(mapWind(0, 'north'))
    expect(mapWind(200, 'south')).toEqual(mapWind(100, 'south'))
  })
})

describe('interaction state', () => {
  it('loads repeatable presets and compares field direction at identical strength', () => {
    const strong = reduceWind(INITIAL, { type: 'preset', value: 'strong' })
    const south = reduceWind(strong, { type: 'preset', value: 'reconnection' })
    expect(strong.intensity).toBe(south.intensity)
    expect(strong.direction).toBe('north'); expect(south.direction).toBe('south')
    expect(INITIAL.intensity).toBe(20)
    for (const [preset, values] of Object.entries(PRESETS)) {
      expect(reduceWind(south, {type:'preset', value:preset})).toMatchObject({ ...values, preset })
    }
  })
  it('seeks guide steps out of order and preserves playback/preferences', () => {
    const paused = { ...INITIAL, playing: false, reducedMotion: true }
    for (const step of [2, 0, 1, 2]) {
      const state = reduceWind(paused, { type: 'step', value: step })
      expect(state.step).toBe(step)
      expect(state.playing).toBe(false); expect(state.reducedMotion).toBe(true)
      expect(state.preset).toBe(['quiet', 'strong', 'reconnection'][step])
    }
  })
  it('clamps adjustments, marks custom state and resets without overriding system preferences', () => {
    const custom = reduceWind(INITIAL, {type:'intensity',value:105})
    expect(custom).toMatchObject({intensity:100,preset:'custom'})
    expect(reduceWind(INITIAL, {type:'intensity',value:-5}).intensity).toBe(0)
    expect(reduceWind(custom, {type:'direction',value:'south'})).toMatchObject({intensity:100,direction:'south',preset:'custom'})
    const reset = reduceWind({...custom,reducedMotion:true}, {type:'reset'})
    expect(reset).toEqual({...INITIAL,reducedMotion:true})
    expect(reduceWind(INITIAL, {type:'playing'}).playing).toBe(false)
  })
  it('rejects malformed and nonfinite opaque commands', () => {
    for (const command of [null, 'south', {}, {type:'intensity',value:NaN}, {type:'intensity',value:Infinity}, {type:'intensity',value:'85'}, {type:'direction',value:'up'}, {type:'preset',value:'__proto__'}, {type:'step',value:-1}, {type:'step',value:3}, {type:'step',value:.5}]) {
      expect(reduceWind(INITIAL, command)).toBe(INITIAL)
    }
  })
})
