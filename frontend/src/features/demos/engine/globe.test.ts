import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createEarthGlobe, createGlobe, globeQuaternion } from './globe'

const DEGREES_TO_RADIANS = Math.PI / 180

function earthGlobe(obliquityDeg: number): { root: THREE.Group, sphere: THREE.Mesh } {
  const root = createEarthGlobe({
    radius: 1,
    obliquityDeg,
    material: new THREE.MeshBasicMaterial(),
  })
  let sphere: THREE.Mesh | null = null
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) sphere = object as THREE.Mesh
  })
  expect(sphere).not.toBeNull()
  // From the root: updating the sphere alone would leave its parent's world matrix at identity and
  // silently drop the tilt this test exists to check.
  root.updateMatrixWorld(true)
  return { root, sphere: sphere as unknown as THREE.Mesh }
}

function poleDirection(obliquityDeg: number): THREE.Vector3 {
  const { sphere } = earthGlobe(obliquityDeg)
  // The texture's north pole is the sphere's own +Y, in the group's ecliptic frame.
  return new THREE.Vector3(0, 1, 0).transformDirection(sphere.matrixWorld)
}

function degreesFromEclipticNorth(pole: THREE.Vector3): number {
  const cosine = Math.min(1, Math.max(-1, pole.clone().normalize().dot(new THREE.Vector3(0, 0, 1))))
  return (Math.acos(cosine) * 180) / Math.PI
}

describe('Earth globe orientation', () => {
  it('does not leave the axis lying in the orbital plane', () => {
    // Without the pole fix the axis sits in the ecliptic plane, 90 degrees off north, and it ends
    // up pointing towards or away from the Sun as the Earth orbits.
    expect(degreesFromEclipticNorth(poleDirection(23.44))).toBeLessThan(45)
  })

  it('leans the axis by the requested obliquity', () => {
    for (const obliquity of [0, 23.44, 45]) {
      expect(degreesFromEclipticNorth(poleDirection(obliquity))).toBeCloseTo(obliquity, 6)
    }
  })

  /**
   * The angle alone is not enough, and this is the test that was missing. A tilt applied with the
   * wrong sign leans by exactly the same number of degrees, towards the other solstice: the Earth
   * looks right from every angle and its seasons are inverted. The pole's actual direction is the
   * only thing that catches it.
   */
  it('leans towards the June solstice, not the December one', () => {
    const obliquity = 23.4392911
    const pole = poleDirection(obliquity)
    const expected = new THREE.Vector3(
      0,
      Math.sin(obliquity * DEGREES_TO_RADIANS),
      Math.cos(obliquity * DEGREES_TO_RADIANS),
    )
    expect(pole.distanceTo(expected)).toBeLessThan(1e-6)
    // Spelled out, so a reader can see which way round it is.
    expect(pole.x).toBeCloseTo(0, 9)
    expect(pole.y).toBeGreaterThan(0)
    expect(pole.z).toBeGreaterThan(0)
  })

  it('keeps the axis fixed as the Earth moves along its orbit', () => {
    // The globe itself is never rotated per frame; only the parent group's position changes.
    const { root, sphere } = earthGlobe(23.44)
    const earth = new THREE.Group()
    earth.add(root)

    const directions: THREE.Vector3[] = []
    for (const angle of [0, 1.5, 3, 4.5]) {
      earth.position.set(Math.cos(angle) * 6, Math.sin(angle) * 6, 0)
      earth.updateMatrixWorld(true)
      directions.push(new THREE.Vector3(0, 1, 0).transformDirection(sphere.matrixWorld))
    }

    for (const direction of directions) {
      expect(direction.distanceTo(directions[0])).toBeLessThan(1e-9)
    }
  })
})

describe('bare globe and its orientation', () => {
  it('leaves the map\'s pole on local +Y and its prime meridian on local +X', () => {
    const globe = createGlobe({ radius: 1, material: new THREE.MeshBasicMaterial() })
    globe.updateMatrixWorld(true)
    // Nothing is rotated, so the body-fixed frame is the object's own frame.
    expect(new THREE.Vector3(0, 1, 0).transformDirection(globe.matrixWorld).y).toBeCloseTo(1, 9)
    expect(new THREE.Vector3(1, 0, 0).transformDirection(globe.matrixWorld).x).toBeCloseTo(1, 9)
  })

  it('points the pole and the prime meridian where it is told', () => {
    const pole = new THREE.Vector3(0, 0.4, 0.9).normalize()
    const primeMeridian = new THREE.Vector3(1, 0, 0)
    const globe = createGlobe({ radius: 1, material: new THREE.MeshBasicMaterial() })
    globe.quaternion.copy(globeQuaternion(pole, primeMeridian))
    globe.updateMatrixWorld(true)

    const mappedPole = new THREE.Vector3(0, 1, 0).transformDirection(globe.matrixWorld)
    const mappedMeridian = new THREE.Vector3(1, 0, 0).transformDirection(globe.matrixWorld)
    expect(mappedPole.distanceTo(pole)).toBeLessThan(1e-9)
    expect(mappedMeridian.distanceTo(primeMeridian)).toBeLessThan(1e-9)
  })

  it('stays a proper rotation when the two directions are not quite perpendicular', () => {
    const pole = new THREE.Vector3(0, 1, 0)
    // Ten degrees off the equator: a caller's small error, not a shear.
    const sloppy = new THREE.Vector3(Math.cos(10 * DEGREES_TO_RADIANS), Math.sin(10 * DEGREES_TO_RADIANS), 0)
    const globe = createGlobe({ radius: 1, material: new THREE.MeshBasicMaterial() })
    globe.quaternion.copy(globeQuaternion(pole, sloppy))
    globe.updateMatrixWorld(true)

    const mappedPole = new THREE.Vector3(0, 1, 0).transformDirection(globe.matrixWorld)
    const mappedMeridian = new THREE.Vector3(1, 0, 0).transformDirection(globe.matrixWorld)
    expect(mappedPole.distanceTo(pole)).toBeLessThan(1e-9)
    // The meridian is pulled back onto the equator rather than tilting the whole globe.
    expect(mappedMeridian.y).toBeCloseTo(0, 9)
    expect(mappedMeridian.length()).toBeCloseTo(1, 9)
    expect(mappedPole.dot(mappedMeridian)).toBeCloseTo(0, 9)
  })

  it('turns the prime meridian with the body without moving the pole', () => {
    const pole = new THREE.Vector3(0, 0.4, 0.9).normalize()
    const globe = createGlobe({ radius: 1, material: new THREE.MeshBasicMaterial() })
    const seen: THREE.Vector3[] = []
    for (const spin of [0, 1.2, 2.4]) {
      const meridian = new THREE.Vector3(Math.cos(spin), 0, Math.sin(spin))
      meridian.addScaledVector(pole, -meridian.dot(pole)).normalize()
      globe.quaternion.copy(globeQuaternion(pole, meridian))
      globe.updateMatrixWorld(true)
      seen.push(new THREE.Vector3(1, 0, 0).transformDirection(globe.matrixWorld))
      expect(new THREE.Vector3(0, 1, 0).transformDirection(globe.matrixWorld).distanceTo(pole))
        .toBeLessThan(1e-9)
    }
    // Three different meridians really are three different orientations.
    expect(seen[0].distanceTo(seen[1])).toBeGreaterThan(0.5)
    expect(seen[1].distanceTo(seen[2])).toBeGreaterThan(0.5)
  })
})
