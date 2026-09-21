import { describe, expect, it } from 'vitest'
import { SCENE, STAGE_RADIUS_SOLAR } from './config'
import { STAGES } from './stages'
import type { StageId } from './types'
import {
  easeInOutCubic,
  lerpColor,
  lerpVisual,
  REFERENCE_RADIUS,
  STAGE_VISUALS,
  stageVisualAt,
  type StageVisual,
} from './visuals'

const ALL_IDS: StageId[] = [
  'molecular-cloud', 'protostar', 'main-sequence', 'red-giant', 'planetary-nebula',
  'white-dwarf', 'supernova', 'neutron-star', 'black-hole',
]

/** The numeric fields, so the interpolation tests can sweep them without listing them by hand. */
function numericFields(visual: StageVisual): Record<string, number> {
  return Object.fromEntries(
    Object.entries(visual).filter(([, value]) => typeof value === 'number'),
  ) as Record<string, number>
}

/** The three bytes of a packed 0xRRGGBB colour. */
function channelsOf(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

describe('every stage has a look', () => {
  it('defines one per stage id and nothing else', () => {
    expect(Object.keys(STAGE_VISUALS).sort()).toEqual([...ALL_IDS].sort())
    for (const id of ALL_IDS) expect(STAGE_VISUALS[id], id).toBeDefined()
  })

  it('resolves a look from a timeline index, clamping a stray one', () => {
    expect(stageVisualAt(0)).toBe(STAGE_VISUALS['molecular-cloud'])
    expect(stageVisualAt(99)).toBe(STAGE_VISUALS['black-hole'])
    expect(stageVisualAt(-4)).toBe(STAGE_VISUALS['molecular-cloud'])
  })

  it('keeps every opacity inside its range and every radius positive', () => {
    for (const id of ALL_IDS) {
      const visual = STAGE_VISUALS[id]
      for (const [key, value] of Object.entries(numericFields(visual))) {
        expect(Number.isFinite(value), `${id}.${key}`).toBe(true)
        if (/Opacity|Depth/.test(key)) {
          expect(value, `${id}.${key}`).toBeGreaterThanOrEqual(0)
          expect(value, `${id}.${key}`).toBeLessThanOrEqual(1)
        }
        // A radius of zero is how a stage says it draws no such thing, so it is a legal value; a
        // particle size of zero would draw nothing at all and is not.
        if (/Radius|Scale/.test(key)) expect(value, `${id}.${key}`).toBeGreaterThanOrEqual(0)
        if (/Size/.test(key)) expect(value, `${id}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  /**
   * One particle buffer is reused for every cloud, so the drawn size is the only thing that tells a
   * cold molecular cloud from a supernova remnant. It was wrong on the first pass: a single size
   * fine enough for the remnant turned the cloud into a field of pinpricks.
   */
  it('draws a cold cloud in fat soft blobs and a remnant in fine ones', () => {
    expect(STAGE_VISUALS['molecular-cloud'].cloudSize)
      .toBeGreaterThan(STAGE_VISUALS['planetary-nebula'].cloudSize * 2)
    expect(STAGE_VISUALS['molecular-cloud'].cloudSize)
      .toBeGreaterThan(STAGE_VISUALS.supernova.cloudSize * 2)
    for (const id of ALL_IDS) {
      expect(STAGE_VISUALS[id].cloudSize, id).toBeLessThan(STAGE_VISUALS[id].cloudRadius || Infinity)
    }
  })

  /**
   * The camera sits barely above the equatorial plane, so a flattened shell left untilted is seen
   * almost edge on. The planetary nebula and the supernova both looked like a band across the frame
   * before they were given a tilt.
   */
  it('tilts the two shells that would otherwise be seen edge on', () => {
    expect(STAGE_VISUALS['planetary-nebula'].cloudTilt).toBeGreaterThan(0.6)
    expect(STAGE_VISUALS.supernova.cloudTilt).toBeGreaterThan(0.5)
    // And a shell that is not flattened has nothing to gain from a tilt.
    expect(STAGE_VISUALS['neutron-star'].cloudTilt).toBe(0)
    expect(STAGE_VISUALS['black-hole'].cloudTilt).toBe(0)
    for (const id of ALL_IDS) {
      expect(Math.abs(STAGE_VISUALS[id].cloudTilt), id).toBeLessThan(Math.PI / 2)
    }
  })
})

/**
 * The compression is only worth having if it keeps the truth's ordering. `stages.test.ts` checks the
 * ordering itself; here the point is that the drawn radius is *derived* from the real one rather
 * than hand-typed, so the two cannot drift apart.
 */
describe('the size compression', () => {
  it('derives every stellar radius from the real one', () => {
    for (const stage of STAGES) {
      const real = STAGE_RADIUS_SOLAR[stage.id]
      if (real === null) continue
      // The one stage that is drawn at its own scale: a protostar's visible disc is dominated by
      // its dust envelope, so it is drawn from the envelope rather than from the core radius.
      expect(STAGE_VISUALS[stage.id].coreRadius, stage.id).toBeCloseTo(real ** SCENE.sizeExponent, 10)
    }
  })

  it('compresses without inverting: a bigger exponent-free radius is still drawn bigger', () => {
    const pairs: [StageId, StageId][] = [
      ['red-giant', 'main-sequence'],
      ['main-sequence', 'white-dwarf'],
      ['white-dwarf', 'neutron-star'],
    ]
    for (const [bigger, smaller] of pairs) {
      expect(STAGE_RADIUS_SOLAR[bigger]!).toBeGreaterThan(STAGE_RADIUS_SOLAR[smaller]!)
      expect(STAGE_VISUALS[bigger].coreRadius, `${bigger} vs ${smaller}`)
        .toBeGreaterThan(STAGE_VISUALS[smaller].coreRadius)
    }
  })

  it('fits the largest body inside a frame', () => {
    // The red giant must not overflow the camera's view, or the demo's most dramatic comparison is
    // the one the viewer cannot see.
    const widest = Math.max(...ALL_IDS.map((id) => STAGE_VISUALS[id].coreRadius))
    expect(widest * 2).toBeLessThan(SCENE.frameHalfHeight * 2)
  })

  it('keeps the reference circle on the Sun\'s main-sequence radius', () => {
    expect(REFERENCE_RADIUS).toBe(SCENE.referenceRadius)
    expect(STAGE_VISUALS['main-sequence'].coreRadius).toBeCloseTo(REFERENCE_RADIUS, 10)
  })
})

/**
 * Colour is the one channel that carries temperature to the eye without a label, so it has to run
 * the right way: a 3,300 K red giant cannot be drawn blue-white, and a 12,000 K white dwarf cannot
 * be drawn orange.
 */
describe('colour follows temperature', () => {
  const warmth = (hex: number): number => ((hex >> 16) & 0xff) - (hex & 0xff)

  it('draws the cool giants red and the hot remnants blue', () => {
    expect(warmth(STAGE_VISUALS['red-giant'].coreColor)).toBeGreaterThan(60)
    expect(warmth(STAGE_VISUALS['protostar'].coreColor)).toBeGreaterThan(60)
    expect(warmth(STAGE_VISUALS['white-dwarf'].coreColor)).toBeLessThan(0)
    expect(warmth(STAGE_VISUALS['neutron-star'].coreColor)).toBeLessThan(0)
    expect(warmth(STAGE_VISUALS['planetary-nebula'].coreColor)).toBeLessThan(0)
  })

  it('draws the Sun warm but not red', () => {
    const sun = STAGE_VISUALS['main-sequence'].coreColor
    expect(warmth(sun)).toBeGreaterThan(0)
    expect(warmth(sun)).toBeLessThan(warmth(STAGE_VISUALS['red-giant'].coreColor))
  })
})

describe('the shapes that make a stage recognisable', () => {
  it('hides the core in a molecular cloud, because no star has formed yet', () => {
    expect(STAGE_VISUALS['molecular-cloud'].coreVisible).toBe(false)
    expect(STAGE_VISUALS['molecular-cloud'].cloudOpacity).toBeGreaterThan(0.5)
    for (const id of ALL_IDS.filter((entry) => entry !== 'molecular-cloud')) {
      expect(STAGE_VISUALS[id].coreVisible, id).toBe(true)
    }
  })

  it('gives the protostar a dust veil, a disk and jets at once', () => {
    const protostar = STAGE_VISUALS.protostar
    expect(protostar.occluderOpacity).toBeGreaterThan(0.3)
    expect(protostar.diskOpacity).toBeGreaterThan(0.2)
    expect(protostar.beamOpacity).toBeGreaterThan(0.2)
    // Still dim and red: it is not yet a star.
    expect(protostar.haloOpacity).toBeLessThan(STAGE_VISUALS['main-sequence'].haloOpacity)
  })

  it('preserves depth in the planetary nebula instead of flattening it into a disk', () => {
    expect(STAGE_VISUALS['planetary-nebula'].cloudFlatten).toBeLessThan(0.4)
    expect(STAGE_VISUALS['molecular-cloud'].cloudFlatten).toBeLessThan(0.5)
  })

  /**
   * A filled ball reads as a scattered field; a planetary nebula and a supernova remnant are rings
   * around a star, and only look like it when their particles sit in a shell.
   */
  it('shows the hollow shell for the two stages that are shells, and the filled one for clouds', () => {
    // The shell carries the shape, so it has to dominate the faint interior glow behind it.
    expect(STAGE_VISUALS['planetary-nebula'].cloudShellOpacity)
      .toBeGreaterThan(STAGE_VISUALS['planetary-nebula'].cloudOpacity * 2)
    expect(STAGE_VISUALS.supernova.cloudShellOpacity)
      .toBeGreaterThan(STAGE_VISUALS.supernova.cloudOpacity * 2)
    // And the stages that are clouds draw no ring at all.
    expect(STAGE_VISUALS['molecular-cloud'].cloudShellOpacity).toBe(0)
    expect(STAGE_VISUALS['molecular-cloud'].cloudOpacity).toBeGreaterThan(0.5)
    expect(STAGE_VISUALS.protostar.cloudShellOpacity).toBe(0)
    expect(STAGE_VISUALS['red-giant'].cloudShellOpacity).toBe(0)
  })

  it('gives the supernova the only flash in the demo', () => {
    const flashing = ALL_IDS.filter((id) => STAGE_VISUALS[id].flashOpacity > 0)
    expect(flashing).toEqual(['supernova'])
    // The flash decays in the scene; an explosion must not blink periodically.
    expect(STAGE_VISUALS.supernova.pulseDepth).toBe(0)
    // Debris thrown outward, so the shape is a shell rather than a cloud.
    expect(STAGE_VISUALS.supernova.cloudShellOpacity).toBeGreaterThan(0.5)
  })

  it('makes a pulsar turn and pulse far faster than anything else', () => {
    const neutronStar = STAGE_VISUALS['neutron-star']
    expect(neutronStar.beamOpacity).toBeGreaterThan(0.4)
    expect(neutronStar.spinRate).toBeGreaterThan(STAGE_VISUALS['main-sequence'].spinRate * 5)
    expect(neutronStar.pulseDepth).toBeGreaterThan(STAGE_VISUALS['red-giant'].pulseDepth)
  })

  it('shortens the pulsar beams, which would otherwise hide how small the star is', () => {
    expect(STAGE_VISUALS['neutron-star'].beamScale).toBeLessThan(0.9)
    expect(STAGE_VISUALS.protostar.beamScale).toBeGreaterThan(STAGE_VISUALS['neutron-star'].beamScale)
    for (const id of ALL_IDS) expect(STAGE_VISUALS[id].beamScale, id).toBeGreaterThan(0)
  })

  it('draws a black hole as an absence with a lit ring, not as a dark star', () => {
    const blackHole = STAGE_VISUALS['black-hole']
    expect(blackHole.coreColor).toBe(0x000000)
    expect(blackHole.haloOpacity).toBe(0)
    expect(blackHole.photonRingOpacity).toBeGreaterThan(0.5)
    expect(blackHole.diskOpacity).toBeGreaterThan(0.5)
    // Nothing else in the demo is pure black, so the shadow cannot be confused with a dim body.
    const others = ALL_IDS.filter((id) => id !== 'black-hole' && STAGE_VISUALS[id].coreVisible)
    for (const id of others) expect(STAGE_VISUALS[id].coreColor, id).not.toBe(0x000000)
  })

  it('keeps the white dwarf small, faint and inside the reference circle', () => {
    const whiteDwarf = STAGE_VISUALS['white-dwarf']
    expect(whiteDwarf.coreRadius).toBeLessThan(REFERENCE_RADIUS * 0.6)
    expect(whiteDwarf.cloudOpacity).toBe(0)
    expect(whiteDwarf.diskOpacity).toBe(0)
  })
})

describe('easing', () => {
  it('pins both ends and the middle', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10)
  })

  it('clamps out-of-range input rather than overshooting', () => {
    expect(easeInOutCubic(-3)).toBe(0)
    expect(easeInOutCubic(7)).toBe(1)
  })

  it('rises monotonically', () => {
    let previous = -1
    for (let step = 0; step <= 20; step += 1) {
      const value = easeInOutCubic(step / 20)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('interpolating between two looks', () => {
  const from = STAGE_VISUALS['main-sequence']
  const to = STAGE_VISUALS['red-giant']

  it('returns the endpoints exactly', () => {
    const start = lerpVisual(from, to, 0)
    const end = lerpVisual(from, to, 1)
    expect(start).toEqual(from)
    expect(end).toEqual(to)
  })

  it('lands halfway between on every numeric field', () => {
    const middle = lerpVisual(from, to, 0.5)
    const fromNumbers = numericFields(from)
    const toNumbers = numericFields(to)
    for (const [key, value] of Object.entries(numericFields(middle))) {
      if (key.endsWith('Color')) {
        // Colours are packed 0xRRGGBB, so the midpoint has to be taken channel by channel;
        // averaging the packed integers would carry between them.
        expect(value, key).toBe(lerpColor(fromNumbers[key]!, toNumbers[key]!, 0.5))
        continue
      }
      expect(value, key).toBeCloseTo((fromNumbers[key]! + toNumbers[key]!) / 2, 6)
    }
  })

  it('mixes every colour channel to the middle, within one rounding step', () => {
    const middle = lerpVisual(from, to, 0.5)
    const fromNumbers = numericFields(from)
    const toNumbers = numericFields(to)
    const colourKeys = Object.keys(fromNumbers).filter((key) => key.endsWith('Color'))
    expect(colourKeys.length).toBeGreaterThan(5)
    for (const key of colourKeys) {
      const start = channelsOf(fromNumbers[key]!)
      const end = channelsOf(toNumbers[key]!)
      const mid = channelsOf(numericFields(middle)[key]!)
      for (let channel = 0; channel < 3; channel += 1) {
        const expected = (start[channel]! + end[channel]!) / 2
        expect(Math.abs(mid[channel]! - expected), `${key} channel ${channel}`).toBeLessThanOrEqual(0.5)
      }
    }
  })

  it('draws the core through a morph, so a protostar can swell into existence', () => {
    const mid = lerpVisual(STAGE_VISUALS['molecular-cloud'], STAGE_VISUALS.protostar, 0.4)
    expect(mid.coreVisible).toBe(true)
    expect(lerpVisual(STAGE_VISUALS['molecular-cloud'], STAGE_VISUALS.protostar, 0).coreVisible).toBe(false)
  })

  it('is stable when both ends are the same stage', () => {
    expect(lerpVisual(from, from, 0.37)).toEqual(from)
  })
})

describe('colour interpolation', () => {
  it('pins the endpoints', () => {
    expect(lerpColor(0x102030, 0x405060, 0)).toBe(0x102030)
    expect(lerpColor(0x102030, 0x405060, 1)).toBe(0x405060)
  })

  it('mixes channel by channel', () => {
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080)
    expect(lerpColor(0xff0000, 0x0000ff, 0.5)).toBe(0x800080)
  })

  it('never produces a channel outside the byte range', () => {
    for (let step = 0; step <= 10; step += 1) {
      const value = lerpColor(0x0a1b2c, 0xf0e0d0, step / 10)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(0xffffff)
    }
  })
})
