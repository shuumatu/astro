import { describe, expect, it } from 'vitest'
import { MASS_LIMITS, SCENE, STAGE_RADIUS_SOLAR, SUN } from './config'
import {
  massiveTrackStages,
  STAGE_LABEL_IDS,
  STAGES,
  solarTrackStages,
  stageAt,
  stageById,
  stageCount,
  stageIndex,
  SUPERNOVA_MASS_THRESHOLD_SOLAR,
  TRACK_BRANCH_AFTER_INDEX,
} from './stages'
import { STAGE_VISUALS } from './visuals'
import type { StageId } from './types'

const ALL_IDS: StageId[] = [
  'molecular-cloud', 'protostar', 'main-sequence', 'red-giant', 'planetary-nebula',
  'white-dwarf', 'supernova', 'neutron-star', 'black-hole',
]

describe('the stage sequence', () => {
  it('covers the nine stages in order, each exactly once', () => {
    expect(STAGES.map((stage) => stage.id)).toEqual(ALL_IDS)
    expect(stageCount()).toBe(9)
    expect(new Set(ALL_IDS).size).toBe(9)
  })

  it('clamps an out-of-range index instead of returning nothing', () => {
    expect(stageAt(-5).id).toBe('molecular-cloud')
    expect(stageAt(99).id).toBe('black-hole')
    expect(stageAt(Number.NaN).id).toBe('molecular-cloud')
  })
})

/**
 * The demo's central claim, and the one a popular account most often gets wrong: the Sun is a
 * 1 solar-mass star, so it will never explode. The two tracks are the demo's own model of that, and
 * these tests are what stop a later edit from quietly putting the Sun on the supernova branch.
 */
describe('the two evolutionary tracks', () => {
  it('puts the Sun on the low-mass path and nowhere near a supernova', () => {
    expect(solarTrackStages().map((stage) => stage.id)).toEqual([
      'molecular-cloud', 'protostar', 'main-sequence', 'red-giant', 'planetary-nebula', 'white-dwarf',
    ])
    for (const id of ['supernova', 'neutron-star', 'black-hole'] as StageId[]) {
      expect(stageById(id).track).toBe('massive')
      expect(solarTrackStages().map((stage) => stage.id)).not.toContain(id)
    }
  })

  it('branches after the main sequence, which is the only stage that is the same for every star', () => {
    expect(TRACK_BRANCH_AFTER_INDEX).toBe(stageIndex('main-sequence'))
    // Everything up to the fork is shared, and only the fork stage itself is the main sequence.
    const shared = STAGES.slice(0, TRACK_BRANCH_AFTER_INDEX + 1)
    expect(shared.map((stage) => stage.id)).toEqual(['molecular-cloud', 'protostar', 'main-sequence'])
    expect(shared.filter((stage) => stage.category === 'main').map((stage) => stage.id))
      .toEqual(['main-sequence'])
    // Everything after it belongs to one track or the other, never to both.
    for (const stage of STAGES.slice(TRACK_BRANCH_AFTER_INDEX + 1)) {
      expect(['late', 'remnant'], stage.id).toContain(stage.category)
    }
    expect(massiveTrackStages().map((stage) => stage.id)).toEqual([
      'supernova', 'neutron-star', 'black-hole',
    ])
  })

  it('keeps the Sun\'s mass below the threshold that decides the ending', () => {
    expect(SUPERNOVA_MASS_THRESHOLD_SOLAR).toBe(MASS_LIMITS.coreCollapseSupernovaSolar)
    expect(SUN.massSolar).toBeLessThan(SUPERNOVA_MASS_THRESHOLD_SOLAR)
    // The threshold the science text quotes is the same number the config holds.
    expect(MASS_LIMITS.blackHoleRemnantSolar).toBeGreaterThan(SUPERNOVA_MASS_THRESHOLD_SOLAR)
    expect(MASS_LIMITS.chandrasekharSolar).toBeLessThan(MASS_LIMITS.coreCollapseSupernovaSolar)
  })

  it('marks the main sequence as the Sun\'s current stage, and only that one', () => {
    const current = STAGES.filter((stage) => stage.id === 'main-sequence')
    expect(current).toHaveLength(1)
    expect(current[0]!.category).toBe('main')
    // Every solar-track stage before it has already happened to the Sun; the ones after have not.
    const before = solarTrackStages().slice(0, solarTrackStages().indexOf(current[0]!))
    expect(before.map((stage) => stage.id)).toEqual(['molecular-cloud', 'protostar'])
  })
})

/**
 * The demo draws sizes on a compressed scale, which is only honest if the drawing preserves the
 * ordering of the real values. These tests are what make the compression a stated approximation
 * rather than a decoration.
 */
describe('real quantities', () => {
  it('orders the real stellar radii the way the drawing does', () => {
    const starStages = STAGES.filter((stage) => stage.radiusSolar !== null)
    expect(starStages.length).toBeGreaterThanOrEqual(6)
    for (let index = 1; index < starStages.length; index += 1) {
      const previous = starStages[index - 1]!
      const current = starStages[index]!
      const realOrder = Math.sign(current.radiusSolar! - previous.radiusSolar!)
      const drawnOrder = Math.sign(
        STAGE_VISUALS[current.id].coreRadius - STAGE_VISUALS[previous.id].coreRadius,
      )
      expect(
        drawnOrder,
        `${previous.id} -> ${current.id}: real ${previous.radiusSolar} -> ${current.radiusSolar}`
        + ` drawn ${STAGE_VISUALS[previous.id].coreRadius} -> ${STAGE_VISUALS[current.id].coreRadius}`,
      ).toBe(realOrder)
    }
  })

  it('leaves the stages that are not one star out of the size comparison', () => {
    expect(STAGE_RADIUS_SOLAR['molecular-cloud']).toBeNull()
    expect(STAGE_RADIUS_SOLAR.supernova).toBeNull()
  })

  it('gets the direction of the two famous comparisons right', () => {
    // The red giant is far bigger than the Sun; the white dwarf is far smaller.
    expect(stageById('red-giant').radiusSolar!).toBeGreaterThan(stageById('main-sequence').radiusSolar! * 10)
    expect(stageById('white-dwarf').radiusSolar!).toBeLessThan(stageById('main-sequence').radiusSolar! / 10)
    // And the remnant of a massive star is smaller still than a white dwarf.
    expect(stageById('neutron-star').radiusSolar!).toBeLessThan(stageById('white-dwarf').radiusSolar!)
  })

  it('makes the compact remnants hotter at the surface than the red giant', () => {
    // Colour follows temperature, so this is also what justifies the blue-white drawing.
    expect(stageById('white-dwarf').temperatureK!).toBeGreaterThan(stageById('red-giant').temperatureK!)
    expect(stageById('planetary-nebula').temperatureK!).toBeGreaterThan(stageById('red-giant').temperatureK!)
    expect(stageById('neutron-star').temperatureK!).toBeGreaterThan(stageById('white-dwarf').temperatureK!)
  })

  it('gives the event horizon no surface temperature to quote', () => {
    expect(stageById('black-hole').temperatureK).toBeNull()
  })

  it('keeps every duration and mass finite and physical', () => {
    for (const stage of STAGES) {
      expect(stage.massSolar, stage.id).toBeGreaterThan(0)
      expect(stage.dwellMs, stage.id).toBeGreaterThanOrEqual(5000)
      if (stage.durationYears !== null) expect(stage.durationYears, stage.id).toBeGreaterThan(0)
    }
    // Only a black hole is given no end, and it is the last stage.
    const endless = STAGES.filter((stage) => stage.durationYears === null)
    expect(endless.map((stage) => stage.id)).toEqual(['black-hole'])
  })
})

describe('stage cards and labels', () => {
  it('gives every stage a card with three features and a Sun note', () => {
    for (const stage of STAGES) {
      expect(stage.featureKeys, stage.id).toHaveLength(3)
      expect(stage.sunKey, stage.id).toContain(`stages.`)
      expect(stage.readoutKey, stage.id).toContain(`stages.`)
      expect(stage.nameKey, stage.id).toContain(`stages.`)
      expect(stage.taglineKey, stage.id).toContain(`stages.`)
      expect(stage.bodyKey, stage.id).toContain(`stages.`)
      for (const key of [stage.nameKey, stage.taglineKey, stage.bodyKey, ...stage.featureKeys]) {
        expect(key, `${stage.id}: ${key}`).toMatch(/^demos\.items\.stellarEvolution\.stages\./)
      }
    }
  })

  it('gives every stage at least two labels, each with an explanation', () => {
    for (const stage of STAGES) {
      expect(stage.labels.length, stage.id).toBeGreaterThanOrEqual(2)
      const ids = stage.labels.map((label) => label.id)
      expect(new Set(ids).size, `${stage.id} repeats a label id`).toBe(ids.length)
      for (const label of stage.labels) {
        expect(label.textKey).toMatch(/^demos\.items\.stellarEvolution\.labels\./)
        expect(label.descriptionKey).toMatch(/^demos\.items\.stellarEvolution\.labels\./)
        expect(label.descriptionKey).not.toBe(label.textKey)
      }
    }
  })

  it('anchors every label somewhere the scene can resolve', () => {
    const anchors = new Set([
      'core-above', 'core-left', 'core-right', 'shell-above', 'shell-left', 'shell-right',
      'disk-right', 'beam-above', 'frame-left', 'frame-right',
    ])
    for (const stage of STAGES) {
      for (const label of stage.labels) {
        expect(anchors.has(label.anchor), `${stage.id}/${label.id}: ${label.anchor}`).toBe(true)
      }
    }
  })

  it('reuses only the reference-circle label across stages, and every other id once', () => {
    // The shell keys its label nodes by id and creates a node only when a new id appears, so two
    // stages may share an id only when they mean exactly the same thing by it.
    const counts = new Map<string, number>()
    for (const id of STAGE_LABEL_IDS) counts.set(id, (counts.get(id) ?? 0) + 1)
    const shared = [...counts].filter(([, count]) => count > 1).map(([id]) => id)
    expect(shared).toEqual(['referenceCircle'])
    expect(counts.size).toBe(28)
    expect(counts.get('referenceCircle')).toBe(4)
  })
})

describe('the reference circle', () => {
  it('is exactly the Sun\'s main-sequence radius, so the comparison means something', () => {
    expect(SCENE.referenceRadius).toBe(1)
    expect(STAGE_RADIUS_SOLAR['main-sequence']).toBe(SUN.radiusSolar)
    expect(STAGE_VISUALS['main-sequence'].coreRadius).toBeCloseTo(SCENE.referenceRadius, 10)
  })

  it('is hidden on the main sequence, where the body is the reference', () => {
    expect(STAGE_VISUALS['main-sequence'].referenceOpacity).toBe(0)
    expect(STAGE_VISUALS['red-giant'].referenceOpacity).toBeGreaterThan(0)
    expect(STAGE_VISUALS['white-dwarf'].referenceOpacity).toBeGreaterThan(0)
  })
})
