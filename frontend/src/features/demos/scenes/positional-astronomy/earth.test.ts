import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS, celestialVector, earthOrientation, observerFrame } from './earth'
import { INITIAL, DEG, precessionPole } from './model'

describe('Earth and surface reference frames', () => {
  it('keeps O on the globe and its horizon tangent at every latitude', () => {
    for (const latitude of [-90, -40, 0, 40, 90]) {
      for (const lst of [0, 6, 12, 18, 24]) {
        const { position, up, east, north } = observerFrame(latitude, lst)
        expect(position.length()).toBeCloseTo(EARTH_RADIUS)
        expect(up.dot(east)).toBeCloseTo(0)
        expect(up.dot(north)).toBeCloseTo(0)
        expect(east.clone().cross(north).distanceTo(up)).toBeLessThan(1e-10)
        // A point on the tangent plane lies outside the sphere, never through its center.
        expect(position.clone().add(east).length()).toBeGreaterThan(EARTH_RADIUS)
        const pole = new THREE.Vector3(0, latitude < 0 ? -1 : 1, 0)
        expect(Math.asin(THREE.MathUtils.clamp(pole.dot(up), -1, 1)) / DEG).toBeCloseTo(Math.abs(latitude))
      }
    }
  })
  it('keeps the observer attached to the same terrestrial meridian during rotation', () => {
    for (const lst of [0, 6, 12, 18]) {
      const s = {...INITIAL, latitude:40, lst}
      const surface = new THREE.Vector3(Math.cos(s.latitude * DEG), Math.sin(s.latitude * DEG), 0).multiplyScalar(EARTH_RADIUS).applyQuaternion(earthOrientation(s))
      expect(surface.distanceTo(observerFrame(s.latitude,s.lst).position)).toBeLessThan(1e-10)
    }
  })
  it('tilts the actual globe axis and equator with the precession pole', () => {
    for (const years of [0,6500,13000,26000]) {
      const s = {...INITIAL,chapter:'precession' as const,years}
      const rotation = earthOrientation(s)
      const actualPole = new THREE.Vector3(0,1,0).applyQuaternion(rotation)
      const equatorPoint = new THREE.Vector3(1,0,0).applyQuaternion(rotation)
      const expectedPole = celestialVector(precessionPole(years))
      expect(actualPole.distanceTo(expectedPole)).toBeLessThan(1e-10)
      expect(equatorPoint.dot(expectedPole)).toBeCloseTo(0)
    }
  })
})
