import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { isPartId, TELESCOPE_PARTS } from './parts'
import { buildOptics, PRIMARY, SECONDARY } from './optics'

function readGLB(name: string) {
  const bytes = readFileSync(new URL(`../../../../../public/models/${name}.glb`, import.meta.url))
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
  return { bytes, json }
}

describe('reviewed telescope GLB', () => {
  const source = readGLB('telescope_newtonian_reflector')
  const classified = readGLB('telescope_newtonian_classified')

  it('has explicit semantic metadata for every fragment and preserves triangle counts by source primitive', () => {
    const actual = new Map<string, number>()
    const categories = new Set<string>()
    for (const node of classified.json.nodes) {
      expect(isPartId(node.extras.partId)).toBe(true)
      categories.add(node.extras.partId)
      const key = `${node.extras.sourceNode}:${node.extras.sourcePrimitive}`
      const primitive = classified.json.meshes[node.mesh].primitives[0]
      const count = classified.json.accessors[primitive.attributes.POSITION].count
      actual.set(key, (actual.get(key) ?? 0) + count / 3)
    }
    expect([...categories].sort()).toEqual(TELESCOPE_PARTS.map((part) => part.id).sort())
    source.json.nodes.forEach((node: { mesh?: number }, index: number) => {
      if (node.mesh === undefined) return
      source.json.meshes[node.mesh].primitives.forEach((p: { indices?: number; attributes: { POSITION: number } }, pi: number) => {
        const count = source.json.accessors[p.indices ?? p.attributes.POSITION].count / 3
        expect(actual.get(`${index}:${pi}`)).toBe(count)
        actual.delete(`${index}:${pi}`)
      })
    })
    expect(actual.size).toBe(0)
  })

  it('loads with the actual frontend GLTFLoader and fits the mirrors inside the tube frame', async () => {
    const buffer = classified.bytes.buffer.slice(classified.bytes.byteOffset, classified.bytes.byteOffset + classified.bytes.byteLength)
    const { scene } = await new GLTFLoader().parseAsync(buffer, '')
    const frame = scene.userData.opticalFrame
    expect(frame).toHaveLength(16)
    const inverse = new THREE.Matrix4().fromArray(frame).invert()
    const tubeBox = new THREE.Box3()
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      expect(isPartId(object.userData.partId)).toBe(true)
      if (object.userData.partId !== 'tube') return
      const positions = object.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        tubeBox.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(inverse))
      }
    })
    expect(tubeBox.containsPoint(PRIMARY)).toBe(true)
    expect(tubeBox.containsPoint(SECONDARY)).toBe(true)
    expect(tubeBox.min.x).toBeCloseTo(-.43727, 4)
    expect(tubeBox.max.x).toBeCloseTo(.19138, 4)
    const optics = buildOptics(frame)
    const modelSize = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).length()
    expect(new THREE.Box3().setFromObject(optics).getSize(new THREE.Vector3()).length()).toBeLessThan(modelSize)
  })
})
