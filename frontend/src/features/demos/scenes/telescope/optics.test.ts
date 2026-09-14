import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildOptics, FOCAL_LENGTH, FOCUS, PRIMARY, SECONDARY, SECONDARY_NORMAL, traceRay } from './optics'

describe('model-local Newtonian optics', () => {
  it('obeys reflection at the paraboloid and the folding plane for all displayed rays', () => {
    for (let i = 0; i < 8; i++) {
      const angle = (i + .5) * Math.PI / 4
      const y = .061 * Math.cos(angle), z = .061 * Math.sin(angle)
      const [start, primary, secondary, focus] = traceRay(y, z) as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
      const incoming = primary.clone().sub(start).normalize()
      const normal = new THREE.Vector3(1, -y / (2 * FOCAL_LENGTH), -z / (2 * FOCAL_LENGTH)).normalize()
      const reflected = secondary.clone().sub(primary).normalize()
      expect(incoming.clone().reflect(normal).distanceTo(reflected)).toBeLessThan(1e-12)
      expect(reflected.clone().reflect(SECONDARY_NORMAL).distanceTo(focus.clone().sub(secondary).normalize())).toBeLessThan(1e-12)
      expect(secondary.clone().sub(SECONDARY).dot(SECONDARY_NORMAL)).toBeCloseTo(0, 12)
      expect(focus.equals(FOCUS)).toBe(true)
      expect(primary.x).toBeGreaterThan(PRIMARY.x)
      expect(start.x).toBeGreaterThan(secondary.x)
    }
  })

  it('places all secondary intersections inside the rendered ellipse', () => {
    const group = buildOptics(new THREE.Matrix4().toArray())
    group.updateMatrixWorld(true)
    const mirror = group.getObjectByName('TeachingSecondaryMirror')!
    for (let i = 0; i < 8; i++) {
      const angle = (i + .5) * Math.PI / 4
      const hit = mirror.worldToLocal(traceRay(.061 * Math.cos(angle), .061 * Math.sin(angle))[2]!.clone())
      expect(Math.abs(hit.z)).toBeLessThan(1e-12)
      expect(Math.hypot(hit.x, hit.y)).toBeLessThan(.024)
    }
  })

  it('creates visible mirrors and incremental light-path phases without any giant geometry', () => {
    const group = buildOptics(new THREE.Matrix4().toArray())
    const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
    expect(size.x).toBeLessThan(.8)
    expect(size.y).toBeLessThan(.3)
    expect(size.z).toBeLessThan(.2)
    expect(group.children.filter((child) => child.userData.lessonStep === 0)).toHaveLength(16)
    expect(group.children.filter((child) => child.userData.lessonStep === 3)).toHaveLength(1)
  })
})
