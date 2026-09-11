import * as Astronomy from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import {
  degreesBetween,
  lonLatToVector,
  minimumAltitudeForTexel,
  minimumAltitudeKm,
  moonFrame,
  moonPhase,
  searchMoonPhase,
  subSolarPoint,
  texelKilometres,
  toSelenographic,
  vectorToLonLat,
  wrapLongitude,
} from './selenography'

describe('selenographic coordinates', () => {
  it('puts the sub-Earth meridian on +X so the near side faces the default camera', () => {
    const centre = lonLatToVector(0, 0)
    expect(centre.x).toBeCloseTo(1, 6)
    expect(centre.y).toBeCloseTo(0, 6)
    expect(centre.z).toBeCloseTo(0, 6)

    // East is -Z, matching three.js' sphere UVs and the east-positive IAU convention.
    const east = lonLatToVector(90, 0)
    expect(east.z).toBeCloseTo(-1, 6)

    const north = lonLatToVector(0, 90)
    expect(north.y).toBeCloseTo(1, 6)
  })

  it('round-trips arbitrary positions, including both limbs and the poles', () => {
    for (const [lon, lat] of [
      [0, 0], [59.1, 17], [-92.8, -19.4], [128.97, -20.38], [180, 0], [-180, 0], [0, 90], [0, -90],
    ]) {
      const back = vectorToLonLat(lonLatToVector(lon, lat, 1737.4))
      expect(back.latDeg).toBeCloseTo(lat, 6)
      const longitudeDifference = Math.abs(wrapLongitude(back.lonDeg - lon))
      expect(Math.min(longitudeDifference, 360 - longitudeDifference)).toBeLessThan(1e-6)
    }
  })

  it('measures the great-circle separation between two features', () => {
    const tycho = lonLatToVector(-11.36, -43.31)
    const copernicus = lonLatToVector(-20.08, 9.62)
    // 53 degrees apart on the sphere, well beyond the 7 degree pick radius.
    expect(degreesBetween(tycho, copernicus)).toBeGreaterThan(50)
    expect(degreesBetween(tycho, lonLatToVector(-11.36, -43.31))).toBeCloseTo(0, 6)
  })
})

describe('lunar illumination', () => {
  it('reads the Moon back from the ephemeris the way libration defines it', () => {
    // The body frame comes from the IAU rotation model, so the sub-Earth point it produces has
    // to agree with astronomy-engine's own libration values, which is the check that the
    // rotation is wired up with the right sense and offset.
    for (const iso of ['2026-01-18T12:00:00Z', '2026-02-01T12:00:00Z', '2026-09-10T12:00:00Z']) {
      const date = new Date(iso)
      const time = Astronomy.MakeTime(date)
      const moon = Astronomy.GeoVector(Astronomy.Body.Moon, time, false)
      const point = toSelenographic({ x: -moon.x, y: -moon.y, z: -moon.z }, moonFrame(date))
      const libration = Astronomy.Libration(time)
      // astronomy-engine's libration model carries extra physical terms on top of the IAU
      // rotation model, so the two agree to about 0.02 degrees rather than exactly.
      expect(Math.abs(point.latDeg - libration.elat)).toBeLessThan(0.1)
      expect(Math.abs(point.lonDeg - libration.elon)).toBeLessThan(0.1)
    }
  })

  it('places the sub-solar point where the phase says it should be', () => {
    const full = searchMoonPhase(180, new Date('2026-01-01T00:00:00Z'))
    const quarter = searchMoonPhase(90, new Date('2026-01-01T00:00:00Z'))
    const newMoon = searchMoonPhase(0, new Date('2026-01-01T00:00:00Z'))
    expect(full).not.toBeNull()
    expect(quarter).not.toBeNull()
    expect(newMoon).not.toBeNull()

    // Full moon: the Sun stands over the sub-Earth point, so the near side is fully lit.
    const fullDate = full as Date
    const fullPoint = subSolarPoint(fullDate)
    expect(Math.abs(fullPoint.lonDeg)).toBeLessThan(10)
    expect(Math.abs(fullPoint.latDeg)).toBeLessThan(2)
    expect(moonPhase(fullDate).illuminatedFraction).toBeGreaterThan(0.99)

    // New moon: the Sun stands over the far side, so the near side is dark.
    const newDate = newMoon as Date
    expect(Math.abs(subSolarPoint(newDate).lonDeg)).toBeGreaterThan(170)
    expect(moonPhase(newDate).illuminatedFraction).toBeLessThan(0.01)

    // First quarter: the sub-solar point sits on the eastern limb and half the disc is lit.
    const quarterPoint = subSolarPoint(quarter as Date)
    expect(quarterPoint.lonDeg).toBeGreaterThan(70)
    expect(quarterPoint.lonDeg).toBeLessThan(110)
    expect(moonPhase(quarter as Date).illuminatedFraction).toBeGreaterThan(0.45)
    expect(moonPhase(quarter as Date).illuminatedFraction).toBeLessThan(0.55)
  })

  it('keeps the sub-solar latitude inside the lunar axial tilt', () => {
    // The Moon's equator is tilted 1.54 degrees to the ecliptic, so the sub-solar latitude
    // can never wander further than that from the equator.
    for (let day = 0; day < 360; day += 15) {
      const point = subSolarPoint(new Date(Date.UTC(2026, 0, 1) + day * 86_400_000))
      expect(Math.abs(point.latDeg)).toBeLessThan(1.6)
    }
  })
})

describe('the zoom limit', () => {
  it('reports the atlas texel size, which is what bounds the magnification', () => {
    // One full circuit of the Moon spread across the atlas width.
    expect(texelKilometres(16384)).toBeCloseTo(0.666, 3)
    expect(texelKilometres(8192)).toBeCloseTo(1.333, 3)
    expect(texelKilometres(4096)).toBeCloseTo(2.665, 3)
  })

  it('stops the camera once a texel would cover several screen pixels', () => {
    // A 800-pixel-tall viewport at 40 degrees: the view spans 2 h tan(20 deg) kilometres, so a
    // 8K atlas (1.333 km per texel) stops at about 488 km, and the 4K fallback twice that.
    const eightK = minimumAltitudeKm(8192, 800, 40, 3)
    expect(eightK).toBeCloseTo(488, 0)
    expect(minimumAltitudeKm(4096, 800, 40, 3)).toBeCloseTo(976, 0)
    expect(minimumAltitudeKm(16384, 800, 40, 3)).toBeCloseTo(244, 0)
  })

  it('lets the camera closer on a smaller screen and with a looser target', () => {
    const tall = minimumAltitudeKm(8192, 1600, 40, 3)
    const short = minimumAltitudeKm(8192, 400, 40, 3)
    expect(tall).toBeGreaterThan(short)
    // Asking for fewer screen pixels per texel means accepting more magnification, so a lower
    // altitude is allowed.
    expect(minimumAltitudeKm(8192, 800, 40, 4)).toBeLessThan(minimumAltitudeKm(8192, 800, 40, 2))
  })

  it('keeps the whole disc in view at the default distance', () => {
    const floor = minimumAltitudeKm(8192, 800, 40, 3)
    expect(floor).toBeGreaterThan(0)
    expect(floor).toBeLessThan(1737.4)
  })

  it('lets a high-resolution crop carry the camera much closer', () => {
    // A hotspot crop works out at roughly 0.12 km per texel, against 1.333 for the 8K atlas, so
    // it should allow an altitude an order of magnitude lower.
    const atlasFloor = minimumAltitudeKm(8192, 800, 40, 3)
    const cropFloor = minimumAltitudeForTexel(0.12, 800, 40, 3)
    expect(cropFloor).toBeCloseTo(44, 0)
    expect(cropFloor).toBeLessThan(atlasFloor / 8)
  })
})
