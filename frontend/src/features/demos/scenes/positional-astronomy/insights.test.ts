import { describe, expect, it } from 'vitest'
import { dailyAltitudeCurve, getAstronomyInsights } from './insights'
import { INITIAL, horizontal } from './model'

describe('positional astronomy teaching readouts', () => {
  it('wraps signed hour angle and transit sidereal times across midnight', () => {
    const morning = getAstronomyInsights({ ...INITIAL, ra: 23, lst: 1 })
    expect(morning.hourAngle).toBe(2)
    expect(morning.upperTransit).toBe(23)
    expect(morning.lowerTransit).toBe(11)
    expect(getAstronomyInsights({ ...INITIAL, ra: 1, lst: 23 }).hourAngle).toBe(-2)
    expect(getAstronomyInsights({ ...INITIAL, ra: 24, lst: 0 }).hourAngle).toBe(0)
  })

  it('finds actual eastward rise and westward set crossings with sidereal durations', () => {
    for (const latitude of [-65, -40, 0, 40, 65]) {
      const state = { ...INITIAL, latitude, ra: 2, dec: 20 }
      const info = getAstronomyInsights(state)
      expect(info.visibility).toBe('rises')
      expect(info.visibleHours).toBeGreaterThan(0)
      expect(info.visibleHours).toBeLessThan(24)
      for (const time of [info.rise!, info.set!]) {
        expect(time).toBeGreaterThanOrEqual(0)
        expect(time).toBeLessThan(24)
        expect(horizontal(state.ra, state.dec, latitude, time).altitude).toBeCloseTo(0, 8)
      }
      expect(horizontal(state.ra, state.dec, latitude, info.rise! - 0.01).altitude).toBeLessThan(0)
      expect(horizontal(state.ra, state.dec, latitude, info.rise! + 0.01).altitude).toBeGreaterThan(0)
      expect(horizontal(state.ra, state.dec, latitude, info.set! - 0.01).altitude).toBeGreaterThan(0)
      expect(horizontal(state.ra, state.dec, latitude, info.set! + 0.01).altitude).toBeLessThan(0)
    }
    const equator = getAstronomyInsights({ ...INITIAL, latitude: 0, ra: 2, dec: 0 })
    expect(equator.rise).toBe(20)
    expect(equator.set).toBe(8)
    expect(equator.visibleHours).toBe(12)
  })

  it('handles polar and grazing directions without invented rise and set events', () => {
    const cases = [
      { latitude: 40, dec: 60, hours: 24 },
      { latitude: 40, dec: -60, hours: 0 },
      { latitude: -40, dec: -60, hours: 24 },
      { latitude: -40, dec: 60, hours: 0 },
      { latitude: 90, dec: 20, hours: 24 },
      { latitude: -90, dec: 20, hours: 0 },
      { latitude: 40, dec: 50, hours: 24 },
      { latitude: 40, dec: -50, hours: 0 },
      { latitude: 0, dec: 90, hours: 0 },
      { latitude: 90, dec: 0, hours: 0 },
    ]
    for (const { latitude, dec, hours } of cases) {
      const info = getAstronomyInsights({ ...INITIAL, latitude, dec })
      expect(info.visibleHours).toBe(hours)
      expect(info.rise).toBeNull()
      expect(info.set).toBeNull()
      expect(info.poleAltitude).toBe(Math.abs(latitude))
      expect(info.altitudeCurve.every(point => Number.isFinite(point.altitude))).toBe(true)
    }
  })

  it('matches upper and lower culmination in both hemispheres and at zenith', () => {
    for (const latitude of [-90, -40, 0, 40, 90]) {
      for (const dec of [-90, -40, 0, 20, 40, 90]) {
        const info = getAstronomyInsights({ ...INITIAL, latitude, dec })
        expect(horizontal(INITIAL.ra, dec, latitude, info.upperTransit).altitude).toBeCloseTo(info.upperAltitude, 8)
        expect(horizontal(INITIAL.ra, dec, latitude, info.lowerTransit).altitude).toBeCloseTo(info.lowerAltitude, 8)
        expect(info.upperAltitude).toBeGreaterThanOrEqual(info.lowerAltitude)
      }
    }
    const zenith = getAstronomyInsights({ ...INITIAL, latitude: 40, dec: 40, lst: INITIAL.ra })
    expect(zenith.altitude).toBeCloseTo(90)
    expect(zenith.azimuth).toBeNull()
  })

  it('closes the curve at 24h and stabilizes horizon status against trigonometric residue', () => {
    const curve = dailyAltitudeCurve(6, 0, 0)
    expect(curve).toHaveLength(97)
    expect(curve[0]).toEqual({ lst: 0, altitude: 0 })
    expect(curve[96]).toEqual({ lst: 24, altitude: 0 })
    expect(curve[24]).toEqual({ lst: 6, altitude: 90 })
    expect(curve[72]).toEqual({ lst: 18, altitude: -90 })
    const onHorizon = getAstronomyInsights({ ...INITIAL, latitude: 0, ra: 6, dec: 0, lst: 0 })
    expect(onHorizon.horizonStatus).toBe('on')
    expect(onHorizon.aboveHorizon).toBe(false)
    expect(onHorizon.altitude).toBe(0)
  })

  it('keeps the complete precession cycle at 100% at the slider endpoint', () => {
    expect(getAstronomyInsights({ ...INITIAL, years: 0 }).precessionProgress).toBe(0)
    expect(getAstronomyInsights({ ...INITIAL, years: 13000 }).precessionProgress).toBe(0.5)
    const complete = getAstronomyInsights({ ...INITIAL, years: 26000 })
    expect(complete.precessionProgress).toBe(1)
    expect(complete.precessionAngle).toBe(360)
  })
})
