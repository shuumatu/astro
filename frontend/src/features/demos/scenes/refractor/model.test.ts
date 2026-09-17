import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { isPartId, REFRACTOR_PARTS, type PartId } from './parts'
import { isRefractorMetadata, validateSourceAlignment, opticalAxis, opticalPoint, rayOrderIsPhysical, raySegments, validateRays } from './optics'

function readGLB(name: string) {
  const bytes = readFileSync(new URL(`../../../../../public/models/${name}.glb`, import.meta.url))
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
  return { bytes, json }
}

interface RefractorNode {
  mesh?: number
  name?: string
  extras?: Record<string, unknown>
}

const source = readGLB('telescope_refractor')
const classified = readGLB('telescope_refractor_classified')

async function loadClassified() {
  const bytes = new Uint8Array(classified.bytes.byteLength)
  bytes.set(classified.bytes)
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '')
  if (!isRefractorMetadata(gltf.scene.userData)) {
    throw new Error('the classified GLB has no usable refractor calibration')
  }
  // the metadata is checked once here, so every test below works with the typed shape
  return { scene: gltf.scene, metadata: gltf.scene.userData }
}

describe('reviewed refractor GLB', () => {
  it('gives every output mesh a reviewed partId from the declared taxonomy', () => {
    let meshes = 0
    for (const node of classified.json.nodes as RefractorNode[]) {
      if (node.mesh === undefined) continue
      meshes++
      expect(isPartId(node.extras?.partId), `${node.name} has no reviewed partId`).toBe(true)
      expect(typeof node.extras?.evidence).toBe('string')
      expect(String(node.extras?.evidence).length).toBeGreaterThan(40)
    }
    expect(meshes).toBeGreaterThan(80)
  })

  it('uses every declared category for source geometry with no catch-all bucket', () => {
    const fragments = new Map<PartId, number>()
    for (const node of classified.json.nodes as RefractorNode[]) {
      if (node.mesh === undefined || node.extras?.geometrySource !== 'source') continue
      const id = node.extras?.partId as PartId
      fragments.set(id, (fragments.get(id) ?? 0) + 1)
    }
    const present = [...fragments.keys()]
    for (const part of REFRACTOR_PARTS) expect(present, `missing ${part.id}`).toContain(part.id)
    expect([...fragments.values()].reduce((sum, value) => sum + value, 0)).toBe(87)
    expect(Object.fromEntries(fragments)).toMatchObject({
      objectiveLens: 2, tubeRings: 5, fasteners: 24, finderScope: 7,
      focuser: 6, diagonal: 3, eyepieceLensGroup: 2, mount: 9,
      counterweight: 2, tripod: 25,
    })
    expect(present).not.toContain('unknown')
    expect(present).not.toContain('hardware')
  })

  it('preserves every source primitive triangle count exactly', () => {
    const actual = new Map<string, number>()
    for (const node of classified.json.nodes as RefractorNode[]) {
      if (node.mesh === undefined || node.extras?.geometrySource !== 'source') continue
      const key = `${node.extras.sourceNode}:${node.extras.sourcePrimitive}`
      const primitive = classified.json.meshes[node.mesh].primitives[0]
      const vertices = classified.json.accessors[primitive.attributes.POSITION].count
      actual.set(key, (actual.get(key) ?? 0) + vertices)
    }
    const expected = new Map<string, number>()
    source.json.nodes.forEach((node: { mesh?: number }, index: number) => {
      if (node.mesh === undefined) return
      source.json.meshes[node.mesh].primitives.forEach(
        (primitive: { indices?: number; attributes: { POSITION: number } }, pi: number) => {
          const accessor = source.json.accessors[primitive.indices ?? primitive.attributes.POSITION]
          expected.set(`${index}:${pi}`, (expected.get(`${index}:${pi}`) ?? 0) + accessor.count)
        })
    })
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort())
    for (const [key, count] of expected) {
      expect(actual.get(key), `primitive ${key}`).toBe(count)
    }
  })

  it('keeps the source model unchanged and builds from a frozen hash', () => {
    expect(source.json.nodes).toHaveLength(16)
    expect(source.json.meshes).toHaveLength(8)
    expect(source.json.materials).toHaveLength(6)
    expect(source.json.scenes[0].nodes).toEqual([1, 3, 5, 7, 9, 11, 13, 15])
    const builder = readFileSync(new URL('../../../../../../tools/build-refractor-model.py', import.meta.url), 'utf8')
    expect(builder).toContain("SOURCE_HASH = 'ee85606fdecd74ebb05bbca88b6787864382870e25db55a3220d10a2c4002a09'")
    expect(builder).toContain('raise SystemExit')
  })

  it('keeps the counterweight white while rendering its shaft as metal', () => {
    const materials = classified.json.materials as Array<{ name?: string }>
    const sourceNode = (node: RefractorNode) => node.extras?.geometrySource === 'source'
      && node.extras?.partId === 'counterweight'
    const weight = (classified.json.nodes as RefractorNode[]).find(node =>
      sourceNode(node) && node.extras?.sourceNode === 4 && node.extras?.sourceComponent === 5)!
    const shaft = (classified.json.nodes as RefractorNode[]).find(node =>
      sourceNode(node) && node.extras?.sourceNode === 10 && node.extras?.sourceComponent === 10)!
    const weightPrimitive = classified.json.meshes[weight.mesh!].primitives[0]
    const shaftPrimitive = classified.json.meshes[shaft.mesh!].primitives[0]
    expect(materials[weightPrimitive.material!]?.name).toBe('refractorCounterweightFinish')
    expect(materials[shaftPrimitive.material!]?.name).toBe('refractorCounterweightRodMetal')
  })

  it('keeps the eyepiece glass optical while its barrel and requested finder barrels are black', () => {
    const materials = classified.json.materials as Array<{ name?: string }>
    const nodes = classified.json.nodes as RefractorNode[]
    const findComponent = (sourceNode: number, sourceComponent: number) => nodes.find(node =>
      node.extras?.geometrySource === 'source'
      && node.extras?.sourceNode === sourceNode
      && node.extras?.sourceComponent === sourceComponent)!
    const materialName = (node: RefractorNode) => {
      const primitive = classified.json.meshes[node.mesh!].primitives[0]
      return materials[primitive.material!]?.name
    }

    const glass = findComponent(12, 3)
    const eyepieceBarrel = findComponent(14, 4)
    const finderRearBarrel = findComponent(14, 3)
    const finderFrontBarrel = findComponent(14, 7)
    expect(glass.extras?.componentRole).toBe('eyepieceLens')
    expect(materialName(glass)).toBe('teachingEyepieceGlass')
    expect(eyepieceBarrel.extras?.componentRole).toBe('eyepieceBarrel')
    expect(finderRearBarrel.extras?.componentRole).toBe('finderRearBarrel')
    expect(finderFrontBarrel.extras?.componentRole).toBe('finderFrontBarrel')
    for (const barrel of [eyepieceBarrel, finderRearBarrel, finderFrontBarrel]) {
      expect(materialName(barrel)).toBe('refractorBlackHardware')
    }
  })

  it('uses glass for finder lenses, black for tripod spreaders, and white for the focuser collar', () => {
    const materials = classified.json.materials as Array<{ name?: string }>
    const nodes = classified.json.nodes as RefractorNode[]
    const findComponent = (sourceNode: number, sourceComponent: number) => nodes.find(node =>
      node.extras?.geometrySource === 'source'
      && node.extras?.sourceNode === sourceNode
      && node.extras?.sourceComponent === sourceComponent)!
    const materialName = (node: RefractorNode) => {
      const primitive = classified.json.meshes[node.mesh!].primitives[0]
      return materials[primitive.material!]?.name
    }
    for (const component of [2, 5]) {
      const lens = findComponent(12, component)
      expect(lens.extras?.componentRole).toMatch(/^finderLens/)
      expect(materialName(lens)).toBe('refractorFinderGlass')
    }
    for (const component of [0, 1, 2]) {
      expect(materialName(findComponent(14, component))).toBe('refractorBlackHardware')
    }
    expect(materialName(findComponent(4, 17))).toBe('refractorFocuserWhiteFinish')
  })

  it('assigns the finder mounting shoe and rear coaxial tube to their functional assemblies', () => {
    const nodes = classified.json.nodes as RefractorNode[]
    const findComponent = (sourceComponent: number) => nodes.find(node =>
      node.extras?.geometrySource === 'source'
      && node.extras?.sourceNode === 4
      && node.extras?.sourceComponent === sourceComponent)!
    expect(findComponent(16).extras?.partId).toBe('finderScope')
    expect(findComponent(16).name).toBe('FinderScope_n4_p0_c16')
    expect(findComponent(18).extras?.partId).toBe('focuser')
    expect(findComponent(18).name).toBe('Focuser_n4_p0_c18')
  })

  it('puts every reviewed fastener in its own mechanical category and renders it black', () => {
    const materials = classified.json.materials as Array<{ name?: string }>
    const fasteners = (classified.json.nodes as RefractorNode[]).filter(node =>
      node.extras?.geometrySource === 'source' && node.extras?.hardwareClass === 'fastener')
    const byType = fasteners.reduce<Record<string, number>>((counts, node) => {
      expect(node.extras?.partId, node.name).toBe('fasteners')
      const type = String(node.extras?.fastenerType)
      counts[type] = (counts[type] ?? 0) + 1
      const primitive = classified.json.meshes[node.mesh!].primitives[0]
      expect(materials[primitive.material!]?.name, node.name).toBe('refractorBlackHardware')
      return counts
    }, {})
    expect(fasteners).toHaveLength(24)
    expect(byType).toEqual({ screw: 10, clampingKnob: 13, lockLever: 1 })
    const finderLock = fasteners.find(node =>
      node.extras?.sourceNode === 14 && node.extras?.sourceComponent === 6)
    expect(finderLock?.extras?.fastenerType).toBe('clampingKnob')
  })
})

function localBounds(mesh: THREE.Mesh, inverse: THREE.Matrix4): THREE.Box3 {
  const box = new THREE.Box3()
  const attribute = mesh.geometry.getAttribute('position')
  for (let i = 0; i < attribute.count; i++) {
    box.expandByPoint(new THREE.Vector3().fromBufferAttribute(attribute, i).applyMatrix4(inverse))
  }
  return box
}

describe('source-anchored refractor optics', () => {
  it('places each teaching lens at its corresponding source glass, pointing from large glass to small glass', async () => {
    const { scene, metadata: m } = await loadClassified()
    const frame = new THREE.Matrix4().fromArray(m.opticalFrame)
    const inverse = frame.clone().invert()
    const sources = new Map<number, THREE.Mesh>()
    scene.traverse(object => {
      if (object instanceof THREE.Mesh && object.userData.sourceNode === 12) sources.set(object.userData.sourceComponent, object)
    })
    const objective = sources.get(1)!, eye = sources.get(3)!
    const sourceCenter = (mesh: THREE.Mesh) => new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
    expect(opticalAxis(frame).dot(sourceCenter(eye).sub(sourceCenter(objective)).normalize())).toBeGreaterThan(.999)
    for (const [sourceId, target, s, thickness] of [
      [1, 'TeachingObjectiveFront', m.objectiveFrontS, .006],
      [0, 'TeachingObjectiveRear', m.objectiveS, .006],
      [3, 'TeachingEyepiece', m.eyepieceFrontS, .002],
    ] as const) {
      const original = localBounds(sources.get(sourceId)!, inverse)
      const teaching = localBounds(scene.getObjectByName(target) as THREE.Mesh, inverse)
      expect(teaching.getCenter(new THREE.Vector3()).distanceTo(original.getCenter(new THREE.Vector3()))).toBeLessThan(.0005)
      expect(teaching.getCenter(new THREE.Vector3()).x).toBeCloseTo(s, 6)
      expect(teaching.getSize(new THREE.Vector3()).x).toBeCloseTo(thickness, 6)
      expect(teaching.getSize(new THREE.Vector3()).y).toBeLessThanOrEqual(original.getSize(new THREE.Vector3()).y)
    }
    expect(validateSourceAlignment(scene, m)).toBe(true)
    const reversed = structuredClone(m)
    for (const i of [0, 1, 2, 8, 9, 10]) reversed.opticalFrame[i] *= -1
    expect(validateSourceAlignment(scene, reversed), 'the previously reversed frame must be rejected').toBe(false)
    expect(m.focalRatio).toBeCloseTo(m.focalLength / m.objectiveAperture, 8)
    expect(m.eyepieceFrontS - m.focusS).toBeCloseTo(m.eyepieceFocalLength, 8)
  })

  it('builds closed lenses without zero-area faces, open rims or inverted triangle normals', async () => {
    const { scene } = await loadClassified()
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !object.userData.opticalGeometry) return
      const attr = object.geometry.getAttribute('position')
      const normals = object.geometry.getAttribute('normal')
      const edges = new Map<string, number>()
      const vertex = (i: number) => new THREE.Vector3().fromBufferAttribute(attr, i)
      const key = (v: THREE.Vector3) => v.toArray().map(n => Math.round(n * 1e6)).join(',')
      for (let i = 0; i < attr.count; i += 3) {
        const points = [vertex(i), vertex(i+1), vertex(i+2)]
        const face = points[1]!.clone().sub(points[0]!).cross(points[2]!.clone().sub(points[0]!))
        expect(face.length()).toBeGreaterThan(1e-10)
        expect(face.normalize().dot(new THREE.Vector3().fromBufferAttribute(normals, i))).toBeGreaterThan(.999)
        for (let j = 0; j < 3; j++) {
          const edge = [key(points[j]!), key(points[(j+1)%3]!)].sort().join('|')
          edges.set(edge, (edges.get(edge) ?? 0) + 1)
        }
      }
      expect([...edges.values()].every(n => n === 2), object.name).toBe(true)
    })
  })

  it('draws symmetric parallel input, continuous converging bundles and parallel output for each field', async () => {
    const { metadata: m } = await loadClassified()
    expect(rayOrderIsPhysical(m)).toBe(true)
    const frame = new THREE.Matrix4().fromArray(m.opticalFrame)
    const segments = raySegments(m, frame)
    expect(segments).toHaveLength(m.rays.length * 6)
    for (const ray of m.rays) {
      const p = ray.points
      expect(p[0]![1]).toBeCloseTo(m.objectiveAperture / 2 * ray.apertureFrac, 8)
      expect(Math.abs(p[3]![1])).toBeLessThan(m.eyepieceElementRadius)
      expect(p[2]![1]).toBeCloseTo(Math.tan(ray.field) * m.focalLength, 8)
      const converging = (p[3]![1] - p[1]![1]) / (p[3]![0] - p[1]![0])
      expect(p[1]![1] + converging * (m.focusS - p[1]![0])).toBeCloseTo(p[2]![1], 8)
      expect((p[5]![1] - p[4]![1]) / (p[5]![0] - p[4]![0])).toBeCloseTo(-Math.tan(ray.field) * m.magnification, 8)
    }
    const axial = m.rays.filter(r => r.field === 0)
    expect(axial.map(r => r.points[0]![1]).reduce((a, b) => a+b, 0)).toBeCloseTo(0, 8)
    const entry = segments[0]!
    const localStart = entry.start.clone().applyMatrix4(frame.clone().invert())
    expect(localStart.x).toBeLessThan(m.tubeObjectiveEndS)
    expect(entry.end.distanceTo(opticalPoint(frame, ...m.rays[0]!.points[0]!))).toBeLessThan(1e-7)
  })

  it('detects wrong focus, nonparallel output and an obstruction between ray vertices', async () => {
    const { metadata: m } = await loadClassified()
    const checked = validateRays(m)
    expect(checked.entryWithinAperture).toBe(true)
    expect(checked.focusResidualMax).toBeLessThan(1e-8)
    expect(checked.exitBundleSpreadRad).toBeLessThan(1e-8)
    expect(checked.wallClearanceMin).toBeGreaterThan(.005)
    expect(m.boreSamples).toHaveLength(180)
    const broken = structuredClone(m)
    broken.rays[0]!.points[2]![1] += .01
    broken.rays[0]!.points[5]![1] += .01
    broken.boreSamples.push([(m.objectiveS + m.focusS) / 2, .001])
    const bad = validateRays(broken)
    expect(bad.focusResidualMax).toBeGreaterThan(.009)
    expect(bad.exitBundleSpreadRad).toBeGreaterThan(.01)
    expect(bad.wallClearanceMin).toBeLessThan(0)
  })
})
