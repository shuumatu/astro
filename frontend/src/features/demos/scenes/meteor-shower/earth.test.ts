import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createEarthGlobe } from './earth'

function poleDirection(obliquityDeg: number): THREE.Vector3 {
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
  root.updateMatrixWorld(true)
  // The texture's north pole is the sphere's own +Y, in the group's ecliptic frame.
  return new THREE.Vector3(0, 1, 0).transformDirection((sphere as unknown as THREE.Mesh).matrixWorld)
}

function degreesFromEclipticNorth(pole: THREE.Vector3): number {
  const cosine = Math.min(1, Math.max(-1, pole.clone().normalize().dot(new THREE.Vector3(0, 0, 1))))
  return (Math.acos(cosine) * 180) / Math.PI
}

describe('Earth globe orientation', () => {
  it('does not leave the axis lying in the orbital plane', () => {
    // Without the pole fix the axis sits in the ecliptic plane, 90 degrees off north, and it
    // ends up pointing towards or away from the Sun as the Earth orbits.
    expect(degreesFromEclipticNorth(poleDirection(23.44))).toBeLessThan(45)
  })

  it('leans the axis by the requested obliquity', () => {
    for (const obliquity of [0, 23.44, 45]) {
      expect(degreesFromEclipticNorth(poleDirection(obliquity))).toBeCloseTo(obliquity, 6)
    }
  })

  it('keeps the axis fixed as the Earth moves along its orbit', () => {
    // The globe itself is never rotated per frame; only the parent group's position changes.
    const root = createEarthGlobe({ radius: 1, obliquityDeg: 23.44, material: new THREE.MeshBasicMaterial() })
    const earth = new THREE.Group()
    earth.add(root)
    let sphere: THREE.Mesh | null = null
    root.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) sphere = object as THREE.Mesh
    })

    const directions: THREE.Vector3[] = []
    for (const angle of [0, 1.5, 3, 4.5]) {
      earth.position.set(Math.cos(angle) * 6, Math.sin(angle) * 6, 0)
      earth.updateMatrixWorld(true)
      directions.push(new THREE.Vector3(0, 1, 0).transformDirection((sphere as unknown as THREE.Mesh).matrixWorld))
    }

    for (const direction of directions) {
      expect(direction.distanceTo(directions[0])).toBeLessThan(1e-9)
    }
  })
})
