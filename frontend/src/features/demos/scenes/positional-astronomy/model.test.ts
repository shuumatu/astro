import { describe, expect, it } from 'vitest'
import { angles, eclipticToEquatorial, equatorialToEcliptic, equatorialToGalactic, galacticToEquatorial, horizontal, precessionPole, spherical, visibility, fromHorizontal, exampleState, EXAMPLES, CHAPTERS } from './model'
import zh from './zh.json'
import en from './en.json'

describe('positional astronomy', () => {
  it('lets altitude and azimuth move independently in either hemisphere', () => {
    for (const latitude of [-90, -40, 0, 40, 90]) {
      for (const azimuth of [0, 90, 135, 270, 359]) {
        for (const altitude of [-70, 0, 35, 80]) {
          const eq = fromHorizontal(azimuth, altitude, latitude, 7)
          const result = horizontal(eq.ra, eq.dec, latitude, 7)
          expect(result.altitude).toBeCloseTo(altitude, 7)
          expect(Math.sin(result.azimuth! * Math.PI / 180)).toBeCloseTo(Math.sin(azimuth * Math.PI / 180), 7)
          expect(Math.cos(result.azimuth! * Math.PI / 180)).toBeCloseTo(Math.cos(azimuth * Math.PI / 180), 7)
        }
      }
    }
  })
  it('loads physically correct worked examples and all three lesson steps', () => {
    for (const name of EXAMPLES) {
      const s = exampleState(name)
      expect(s.step).toBe(2)
      expect(s.playing).toBe(false)
    }
    const se = exampleState('southeast')
    expect(horizontal(se.ra, se.dec, se.latitude, se.lst).azimuth).toBeCloseTo(135)
    expect(horizontal(se.ra, se.dec, se.latitude, se.lst).altitude).toBeCloseTo(35)
    const summer = exampleState('solstice')
    expect(angles(equatorialToEcliptic(spherical(summer.ra * 15, summer.dec))).lat).toBeCloseTo(0, 6)
    const center = exampleState('galacticCenter')
    expect(angles(equatorialToGalactic(spherical(center.ra * 15, center.dec)))).toEqual({lon: 0, lat: 0})
    for (const chapter of CHAPTERS) {
      expect(zh.steps[chapter]).toHaveLength(3)
      expect(en.steps[chapter]).toHaveLength(3)
    }
  })
  it('places upper culmination due south at the expected altitude', () => {
    const result = horizontal(6, 20, 40, 6)
    expect(result.altitude).toBeCloseTo(70, 8)
    expect(result.azimuth).toBeCloseTo(180, 8)
  })
  it('moves an equatorial star from east to west and handles undefined zenith azimuth', () => {
    expect(horizontal(6, 0, 0, 0).azimuth).toBeCloseTo(90)
    expect(horizontal(6, 0, 0, 12).azimuth).toBeCloseTo(270)
    expect(horizontal(6, 0, 0, 6).azimuth).toBeNull()
    expect(horizontal(6, 0, 0, 6).altitude).toBeCloseTo(90)
    expect(horizontal(6, 0, 0, 18).azimuth).toBeNull()
  })
  it('classifies both hemispheres, poles, equator, and grazing boundaries', () => {
    expect(visibility(40, 60)).toBe('circumpolar')
    expect(visibility(40, -60)).toBe('never')
    expect(visibility(-40, -60)).toBe('circumpolar')
    expect(visibility(-40, 60)).toBe('never')
    expect(visibility(40, 50)).toBe('grazing')
    expect(visibility(0, 20)).toBe('rises')
    expect(visibility(90, 20)).toBe('circumpolar')
    expect(visibility(-90, 20)).toBe('never')
    expect(visibility(0, 90)).toBe('grazing')
  })
  it('matches ecliptic solstice and Galactic center reference directions', () => {
    const solstice = angles(eclipticToEquatorial(spherical(90, 0)))
    expect(solstice.lon).toBeCloseTo(90)
    expect(solstice.lat).toBeCloseTo(23.43928)
    const center = angles(galacticToEquatorial([1, 0, 0]))
    expect(center.lon).toBeCloseTo(266.405, 2)
    expect(center.lat).toBeCloseTo(-28.936, 2)
    const original = spherical(132, -43)
    for (const result of [equatorialToEcliptic(eclipticToEquatorial(original)), equatorialToGalactic(galacticToEquatorial(original))]) {
      result.forEach((n, i) => expect(n).toBeCloseTo(original[i]!, 8))
    }
  })
  it('keeps the precession cone at fixed obliquity and closes one cycle', () => {
    for (const year of [0, 6500, 13000, 26000]) {
      const pole = precessionPole(year)
      expect(Math.hypot(...pole)).toBeCloseTo(1, 10)
      expect(angles(equatorialToEcliptic(pole)).lat).toBeCloseTo(90 - 23.43928)
    }
    expect(precessionPole(0)[2]).toBeCloseTo(1)
    precessionPole(26000).forEach((n, i) => expect(n).toBeCloseTo(precessionPole(0)[i]!, 10))
  })
  it('provides matching nonempty English and Chinese lesson strings', () => {
    function paths(value: object, prefix = ''): string[] {
      return Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? paths(item, `${prefix}${key}.`) : [`${prefix}${key}`])
    }
    expect(paths(en).sort()).toEqual(paths(zh).sort())
    expect(JSON.stringify(en)).not.toContain(':""')
    expect(JSON.stringify(zh)).not.toContain(':""')
  })
})
