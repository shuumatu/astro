import { describe, expect, it } from 'vitest'

import * as THREE from 'three'

import {
  defaultSunLongitudeDeg,
  openingSunLongitudeDeg,
  phaseDegFor,
  subSolarLatitudeDeg,
  sunDirectionFor,
} from './scene'
import { lonLatToVector } from './selenography'

/**
 * The Moon's light is a real Sun direction driven by a sub-solar-longitude dial, rather than a lamp
 * hung over the camera. These check that the direction is physical - one lit hemisphere, one
 * great-circle terminator, a solar elevation that follows from the site's position - and that the
 * dial and its phase label mean what they say.
 */
describe('the Sun as a sub-solar longitude', () => {
  it('stays on the unit sphere', () => {
    for (const longitude of [0, 45, 123, 200, 359]) {
      expect(sunDirectionFor(longitude).length()).toBeCloseTo(1, 9)
    }
  })

  /**
   * The convention the dial's label uses: longitude 0 puts the Sun over the near side, which is a
   * full Moon, and 180 puts it over the far side, which is new. Getting this backwards would label
   * every phase with its opposite.
   */
  it('puts the Sun over the near side at 0 and the far side at 180', () => {
    const near = lonLatToVector(0, 0, 1)
    const far = lonLatToVector(180, 0, 1)
    const nearSide = new THREE.Vector3(near.x, near.y, near.z)
    const farSide = new THREE.Vector3(far.x, far.y, far.z)

    const fullMoon = sunDirectionFor(0)
    expect(fullMoon.dot(nearSide), 'longitude 0 lights the near side').toBeGreaterThan(0.99)
    expect(fullMoon.dot(farSide), 'longitude 0 leaves the far side unlit').toBeLessThan(-0.99)

    const newMoon = sunDirectionFor(180)
    expect(newMoon.dot(nearSide), 'longitude 180 leaves the near side unlit').toBeLessThan(-0.99)
    expect(newMoon.dot(farSide), 'longitude 180 lights the far side').toBeGreaterThan(0.99)

    // The quarters put the terminator across the middle of the near side.
    for (const longitude of [90, 270]) {
      expect(Math.abs(sunDirectionFor(longitude).dot(nearSide)), `longitude ${longitude} is a quarter`)
        .toBeLessThan(0.02)
    }
  })

  it('labels the phase as the supplement of the longitude', () => {
    expect(phaseDegFor(0)).toBeCloseTo(180, 6)
    expect(phaseDegFor(180)).toBeCloseTo(0, 6)
    expect(phaseDegFor(90)).toBeCloseTo(270, 6)
    for (const longitude of [0, 33, 200, 359]) {
      expect(phaseDegFor(longitude)).toBeGreaterThanOrEqual(0)
      expect(phaseDegFor(longitude)).toBeLessThan(360)
    }
  })

  /**
   * A single Sun direction is what makes the terminator one great circle, and what makes a place's
   * solar elevation a consequence of where it is rather than of where the viewer stands. A
   * camera-relative lamp cannot have that property.
   */
  it('gives every place a solar elevation that depends only on position', () => {
    const latitude = subSolarLatitudeDeg()
    const elevationAt = (sun: THREE.Vector3, lon: number, lat: number) => {
      const surface = lonLatToVector(lon, lat, 1)
      const dot = sun.x * surface.x + sun.y * surface.y + sun.z * surface.z
      return (Math.asin(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI
    }

    for (const longitude of [0, 60, 180, 300]) {
      const sun = sunDirectionFor(longitude, latitude)
      // The sub-solar point sits at the dial's own longitude: the one place with the Sun overhead.
      expect(elevationAt(sun, longitude, latitude), `longitude ${longitude} sub-solar`).toBeCloseTo(90, 3)
      // Its antipode is the one place with the Sun at nadir.
      expect(elevationAt(sun, longitude + 180, -latitude), `longitude ${longitude} anti-solar`)
        .toBeCloseTo(-90, 3)
      // The terminator runs through the points a quarter turn away along the equator.
      expect(elevationAt(sun, longitude + 90, 0), `longitude ${longitude} terminator`).toBeCloseTo(0, 2)
    }
  })

  /**
   * Half the Moon is lit at every longitude. That is what makes this a phase rather than a
   * brightness, and it is the check that would catch a "direction" that is really a lamp fading in
   * and out.
   */
  it('lights half the surface, whatever the longitude', () => {
    for (const longitude of [0, 37, 90, 180, 250, 330]) {
      const sun = sunDirectionFor(longitude)
      let lit = 0
      let total = 0
      for (let lat = -84; lat <= 84; lat += 6) {
        for (let lon = -180; lon < 180; lon += 6) {
          const surface = lonLatToVector(lon, lat, 1)
          const dot = sun.x * surface.x + sun.y * surface.y + sun.z * surface.z
          total += 1
          if (dot > 0) lit += 1
        }
      }
      expect(lit / total, `longitude ${longitude}`).toBeGreaterThan(0.46)
      expect(lit / total, `longitude ${longitude}`).toBeLessThan(0.54)
    }
  })

  it('keeps the sub-solar latitude inside the Moon\'s own axial tilt', () => {
    // The Moon's spin axis leans about 1.5 degrees to the ecliptic, so the Sun never stands far from
    // the equator. A value outside this would mean the geometry, not the sky, is wrong.
    const latitude = subSolarLatitudeDeg()
    expect(Number.isFinite(latitude)).toBe(true)
    expect(Math.abs(latitude)).toBeLessThan(2)
    for (const longitude of [0, 90, 180, 270]) {
      const sun = sunDirectionFor(longitude, latitude)
      const height = (Math.asin(Math.min(1, Math.max(-1, sun.y))) * 180) / Math.PI
      expect(Math.abs(height), `longitude ${longitude} stays near the equator`).toBeLessThan(3)
    }
  })

  /**
   * The dial opens on a full Moon, not on the real Moon's phase for today. The real value is
   * available and physical, but on the day this was written it was a 2 per cent crescent, so the near
   * side - the side the demo shows - opened almost black.
   */
  it('opens on a full Moon rather than on today\'s real phase', () => {
    expect(openingSunLongitudeDeg()).toBe(0)
    const fullMoon = sunDirectionFor(openingSunLongitudeDeg())
    const near = lonLatToVector(0, 0, 1)
    expect(fullMoon.dot(new THREE.Vector3(near.x, near.y, near.z))).toBeGreaterThan(0.99)
  })

  /** The real sub-solar longitude is still computed, for anything that wants to say where the Moon is. */
  it('can still report the real Moon\'s current sub-solar longitude', () => {
    const longitude = defaultSunLongitudeDeg()
    expect(Number.isFinite(longitude)).toBe(true)
    expect(longitude).toBeGreaterThanOrEqual(0)
    expect(longitude).toBeLessThan(360)
  })
})
