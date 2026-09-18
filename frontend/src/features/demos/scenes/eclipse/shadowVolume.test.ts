import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ShadowVolume } from './shadowVolume'

const SEGMENTS = 8

function volume(): ShadowVolume {
  return new ShadowVolume({
    segments: SEGMENTS,
    color: 0x18243c,
    opacity: 0.6,
    rimColor: 0x7ea6dd,
    rimOpacity: 0.8,
  })
}

function rings(instance: ShadowVolume): { base: THREE.Vector3[], far: THREE.Vector3[] } {
  const mesh = instance.group.children[0] as THREE.Mesh
  const attribute = mesh.geometry.getAttribute('position')
  const base: THREE.Vector3[] = []
  const far: THREE.Vector3[] = []
  for (let step = 0; step <= SEGMENTS; step += 1) {
    base.push(new THREE.Vector3(attribute.getX(step * 2), attribute.getY(step * 2), attribute.getZ(step * 2)))
    far.push(new THREE.Vector3(
      attribute.getX(step * 2 + 1),
      attribute.getY(step * 2 + 1),
      attribute.getZ(step * 2 + 1),
    ))
  }
  return { base, far }
}

describe('shadow cone mesh', () => {
  it('draws a ring at each end, at the radii and length it was given', () => {
    const instance = volume()
    instance.update(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), 0.55, 0.2, 3.6)
    const { base, far } = rings(instance)

    for (const point of base) {
      // The base ring sits at the caster's centre, so its radius is the caster's drawn radius.
      expect(Math.hypot(point.x, point.z)).toBeCloseTo(0.55, 6)
      expect(point.y).toBeCloseTo(0, 6)
    }
    for (const point of far) {
      expect(Math.hypot(point.x, point.z)).toBeCloseTo(0.2, 6)
      expect(point.y).toBeCloseTo(3.6, 6)
    }
    instance.dispose()
  })

  it('collapses the far ring to a point when the umbra has closed', () => {
    const instance = volume()
    instance.update(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), 0.245, 0, 3.5)
    const { far } = rings(instance)
    for (const point of far) {
      expect(point.length()).toBeCloseTo(3.5, 6)
    }
    // Every vertex of the far ring is the same point, which is what makes the cone end in a tip.
    for (const point of far) expect(point.distanceTo(far[0])).toBeCloseTo(0, 9)
    instance.dispose()
  })

  it('aims its axis along the direction it is given, from the origin it is given', () => {
    const instance = volume()
    const origin = new THREE.Vector3(1, -2, 0.5)
    const axis = new THREE.Vector3(0, 1, 1).normalize()
    instance.update(origin, axis, 0.5, 0.5, 2)
    instance.group.updateMatrixWorld(true)

    const mesh = instance.group.children[0] as THREE.Mesh
    // A point at the far end of the local axis has to land at origin + axis * length.
    const farCentre = new THREE.Vector3(0, 2, 0).applyMatrix4(mesh.matrixWorld)
    const expected = origin.clone().addScaledVector(axis, 2)
    expect(farCentre.distanceTo(expected)).toBeLessThan(1e-9)
    instance.dispose()
  })

  it('carries its bright rim around the far end, which is where the boundary has to read', () => {
    const instance = volume()
    instance.update(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.5, 0.25, 1.5)
    const rim = instance.group.children[1] as THREE.LineLoop
    const attribute = rim.geometry.getAttribute('position')
    for (let step = 0; step <= SEGMENTS; step += 1) {
      expect(attribute.getY(step)).toBeCloseTo(1.5, 6)
      expect(Math.hypot(attribute.getX(step), attribute.getZ(step))).toBeCloseTo(0.25, 6)
    }
    instance.dispose()
  })

  it('can be hidden, dimmed and disposed without leaking its own buffers', () => {
    const instance = volume()
    instance.setVisible(false)
    expect(instance.group.visible).toBe(false)
    instance.setVisible(true)
    instance.setOpacity(0.1)
    const mesh = instance.group.children[0] as THREE.Mesh
    expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.1, 9)
    instance.dispose()
    instance.dispose()
  })

  it('emphasizes both the volume and boundary, then restores their original opacity', () => {
    const instance = volume()
    const mesh = instance.group.children[0] as THREE.Mesh
    const rim = instance.group.children[1] as THREE.LineLoop
    const edges = instance.group.children[2] as THREE.LineSegments
    instance.setEmphasis(1)
    expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(0.6)
    expect((rim.material as THREE.LineBasicMaterial).opacity).toBeGreaterThan(0.8)
    expect(edges.visible).toBe(true)
    instance.setEmphasis(0)
    expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.6)
    expect((rim.material as THREE.LineBasicMaterial).opacity).toBeCloseTo(0.8)
    expect(edges.visible).toBe(false)
    instance.dispose()
  })
})
