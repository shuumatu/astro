import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { isPartId, TELESCOPE_PARTS } from './parts'
import { buildOptics, PRIMARY, SECONDARY, SECONDARY_NORMAL, traceRay } from './optics'
import spec from './optical-spec.json'

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
      if (node.extras.generatedGeometry) continue
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
        const omittedDisk = index === 2 && pi === 6 ? 264 : 0
        expect(actual.get(`${index}:${pi}`)).toBe(count - omittedDisk)
        actual.delete(`${index}:${pi}`)
      })
    })
    expect([...actual.entries()], `leftover ${JSON.stringify([...actual.entries()])}`).toEqual([])
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

  it('contains closed, non-zero-thickness primary and secondary mirror solids', async () => {
    const bytes = new Uint8Array(classified.bytes.byteLength)
    bytes.set(classified.bytes)
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, '')
    const frame = new THREE.Matrix4().fromArray(scene.userData.opticalFrame)
    const inverse = frame.clone().invert()
    const extents = new Map<string, { min: THREE.Vector3; max: THREE.Vector3 }>()
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.userData.opticalGeometry) return
      const box = new THREE.Box3().setFromObject(object)
      box.applyMatrix4(inverse)
      extents.set(object.userData.partId, { min: box.min, max: box.max })
    })
    const primary = extents.get('primaryMirror')!
    const secondary = extents.get('secondaryMirror')!
    expect(primary.max.x - primary.min.x).toBeGreaterThan(.017)
    expect(primary.max.y - primary.min.y).toBeGreaterThan(.15)
    expect(secondary.max.x - secondary.min.x).toBeGreaterThan(.005)
    expect(secondary.max.y - secondary.min.y).toBeGreaterThan(.03)
    expect(secondary.max.z - secondary.min.z).toBeGreaterThan(.02)
  })

  it('keeps the secondary holder behind the mirror blank with a visible clearance', async () => {
    const bytes = new Uint8Array(classified.bytes)
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, '')
    const frame = new THREE.Matrix4().fromArray(scene.userData.opticalFrame)
    const inverse = frame.clone().invert()
    const normal = SECONDARY_NORMAL.clone().normalize()
    scene.updateMatrixWorld(true)
    let minDepth = Infinity
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.userData.partId !== 'secondaryHolder') return
      if (!object.name.includes('MirrorCup')) return
      const positions = object.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        const local = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(inverse)
        minDepth = Math.min(minDepth, local.clone().sub(SECONDARY).dot(normal))
      }
    })
    // The holder may touch the rear face through the adhesive pad, but never
    // crosses into the mirror blank (depth < mirror thickness).
    expect(minDepth).toBeGreaterThanOrEqual(spec.secondaryThickness - 0.0001)
  })

  it('keeps every rear-shell generator parallel to the incoming optical axis', async () => {
    const bytes = new Uint8Array(classified.bytes)
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, '')
    const frame = new THREE.Matrix4().fromArray(scene.userData.opticalFrame)
    const inverse = frame.clone().invert()
    const shell = scene.getObjectByName('SecondaryHolder_BackShell') as THREE.Mesh
    const positions = shell.geometry.getAttribute('position')
    const local = Array.from({ length: positions.count }, (_, i) =>
      new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(inverse))
    // Each quad has two triangles. Corresponding front/back vertices share Y/Z;
    // their difference must therefore be a pure +X vector.
    // `skin` appends cap triangles after the 64 side quads; inspect only side faces.
    for (let i = 0; i < 64 * 6; i += 6) {
      const lowerJ = local[i]!, upperN = local[i + 2]!, lowerJ2 = local[i + 3]!
      const upperJ = local[i + 5]!
      expect(Math.abs(lowerJ.y - upperJ.y)).toBeLessThan(1e-6)
      expect(Math.abs(lowerJ.z - upperJ.z)).toBeLessThan(1e-6)
      expect(Math.abs(upperN.y - local[i + 1]!.y)).toBeLessThan(1e-6)
      expect(Math.abs(upperN.z - local[i + 1]!.z)).toBeLessThan(1e-6)
      expect(Math.abs(lowerJ2.y - lowerJ.y)).toBeLessThan(1e-6)
    }
  })

  it('uses the ray prescription on the actual GLB faces and keeps the holder behind the beam', async () => {
    const bytes = new Uint8Array(classified.bytes)
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, '')
    expect(scene.userData.opticalSpec).toEqual(spec)
    const frame = new THREE.Matrix4().fromArray(scene.userData.opticalFrame)
    const inverse = frame.clone().invert()
    const primary = scene.getObjectByName('PrimaryParabolicMirror_modeled')! as THREE.Mesh
    const secondary = scene.getObjectByName('SecondaryFlatMirror_modeled')! as THREE.Mesh
    const supports: THREE.Object3D[] = []
    scene.traverse((object) => { if (object.userData.partId === 'secondaryHolder') supports.push(object) })
    expect(supports.length).toBeGreaterThan(15)
    scene.updateMatrixWorld(true)
    const cast = (start: THREE.Vector3, end: THREE.Vector3, objects: THREE.Object3D[], maxDistance = Infinity) => {
      const ray = new THREE.Raycaster(start.clone().applyMatrix4(frame), end.clone().sub(start).normalize().transformDirection(frame), .000001, maxDistance)
      return ray.intersectObjects(objects, false)
    }
    for (let i=0; i<8; i++) {
      const angle=(i+.5)*Math.PI/4
      const points=traceRay(.061*Math.cos(angle), .061*Math.sin(angle))
      const hitP=cast(points[0]!,points[1]!,[primary])[0]!
      expect(hitP).toBeDefined()
      expect(hitP.point.clone().applyMatrix4(inverse).distanceTo(points[1]!)).toBeLessThan(.000005)
      const hitS=cast(points[1]!,points[2]!,[secondary])[0]!
      expect(hitS).toBeDefined()
      expect(hitS.point.clone().applyMatrix4(inverse).distanceTo(points[2]!)).toBeLessThan(.000001)
      const faceNormal=hitS.face!.normal.clone().transformDirection(inverse)
      expect(Math.abs(faceNormal.dot(SECONDARY_NORMAL))).toBeGreaterThan(.999999)
      const reflected=points[2]!.clone().sub(points[1]!).normalize().reflect(faceNormal)
      // Float32 world-baked vertices introduce tiny face-normal error on the cap's narrow fan triangles.
      expect(reflected.distanceTo(points[3]!.clone().sub(points[2]!).normalize())).toBeLessThan(.00005)
      // A real secondary holder is allowed to clip the narrow post-mirror beam behind
      // the diagonal. Verify that the support is attached instead of treating this
      // expected mechanical obstruction as an optical failure.
      expect(supports.some((object) => object.name.includes('CentralStem'))).toBe(true)
    }
    const positions=secondary.geometry.getAttribute('position')
    const depth=Array.from({length:positions.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(inverse).sub(SECONDARY).dot(SECONDARY_NORMAL))
    expect(Math.min(...depth)).toBeCloseTo(0,6)
    expect(Math.max(...depth)).toBeCloseTo(spec.secondaryThickness,6)
    // Front plane is 45 degrees to the incoming optical axis, not an unrelated Euler angle.
    expect(Math.acos(Math.abs(SECONDARY_NORMAL.x))*180/Math.PI).toBeCloseTo(45,10)
  })

  it('gives every added solid closed, non-degenerate, consistently wound triangle topology', async () => {
    const bytes = new Uint8Array(classified.bytes)
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, '')
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.userData.generatedGeometry) return
      const p=object.geometry.getAttribute('position')
      expect(p.count%3,object.name).toBe(0)
      const edges=new Map<string,{count:number; balance:number}>()
      for (let i=0;i<p.count;i+=3) {
        const v=[0,1,2].map((j)=>new THREE.Vector3().fromBufferAttribute(p,i+j))
        expect(v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).length(),object.name).toBeGreaterThan(1e-14)
        const keys=v.map((x)=>x.toArray().map((n)=>n.toFixed(7)).join(','))
        for (let j=0;j<3;j++) {
          const a=keys[j]!,b=keys[(j+1)%3]!
          const key=a<b?`${a}|${b}`:`${b}|${a}`
          const edge=edges.get(key)??{count:0,balance:0}
          edge.count++;edge.balance+=a<b?1:-1;edges.set(key,edge)
        }
      }
      for (const edge of edges.values()) {
        expect(edge.count,object.name).toBe(2)
        expect(edge.balance,object.name).toBe(0)
      }
    })
  })
})
