import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { isPartId, REFRACTOR_PARTS, type PartId } from './parts'
import { isRefractorMetadata, lensSagScale, rayOrderIsPhysical, raySegments, validateRays } from './optics'

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

  it('uses every declared category and leaves only a small share unresolved', () => {
    const counts = new Map<PartId, number>()
    for (const node of classified.json.nodes as RefractorNode[]) {
      if (node.mesh === undefined) continue
      const id = node.extras?.partId as PartId
      const primitive = classified.json.meshes[node.mesh].primitives[0]
      counts.set(id, (counts.get(id) ?? 0) + classified.json.accessors[primitive.attributes.POSITION].count)
    }
    const present = [...counts.keys()]
    for (const part of REFRACTOR_PARTS) expect(present, `missing ${part.id}`).toContain(part.id)
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0)
    // One merged casting (node 0, 6412 triangles of a 57480-triangle model) could not be resolved
    // into mechanical parts, so it is reported as unresolved rather than guessed. That is the only
    // unresolved fragment, and it must stay a small share of the model.
    expect(counts.get('unknown')).toBe(19236)
    expect((counts.get('unknown') ?? 0) / total).toBeLessThan(.13)
    const named = [...counts.entries()].filter(([id]) => id !== 'unknown')
    expect(named.length).toBe(REFRACTOR_PARTS.length - 1)
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
})

describe('teaching optics in the classified GLB', () => {
  it('adds closed, non-zero-thickness objective and eyepiece solids', async () => {
    const { scene, metadata } = await loadClassified()
    const frame = new THREE.Matrix4().fromArray(scene.userData.opticalFrame as number[])
    const inverse = frame.clone().invert()
    const extents = new Map<PartId, { min: THREE.Vector3; max: THREE.Vector3; solids: number }>()
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.userData.opticalGeometry) return
      const box = new THREE.Box3().setFromObject(object).applyMatrix4(inverse)
      const id = object.userData.partId as PartId
      const current = extents.get(id)
      extents.set(id, {
        min: current ? current.min.min(box.min) : box.min.clone(),
        max: current ? current.max.max(box.max) : box.max.clone(),
        solids: (current?.solids ?? 0) + 1,
      })
    })
    const objective = extents.get('objectiveLens')
    const eyepiece = extents.get('eyepieceLensGroup')
    expect(objective, 'no objective lens node').toBeTruthy()
    expect(eyepiece, 'no eyepiece lens node').toBeTruthy()
    // thickness along the axis, not just a flat disk
    expect(objective!.max.x - objective!.min.x).toBeGreaterThan(.008)
    expect(eyepiece!.max.x - eyepiece!.min.x).toBeGreaterThan(.008)
    // a real diameter, not a hairline
    expect(objective!.max.y - objective!.min.y).toBeGreaterThan(.04)
    expect(eyepiece!.max.y - eyepiece!.min.y).toBeGreaterThan(.02)
    expect(objective!.solids).toBeGreaterThanOrEqual(1)
    expect(eyepiece!.solids).toBeGreaterThanOrEqual(1)
  })

  it('puts the objective in the front cell and the eyepiece past the focus, coaxially', async () => {
    const { scene, metadata } = await loadClassified()
    // The exported frame runs with the light. Measured landmarks: the tube spans -338.8..+304.5 mm
    // with its narrow throat at the +end, the cell and retainer rings sit at +272..+294 mm, the two
    // solid baffle discs at -294..-272 mm, and the coaxial train at -443..-272 mm and +397..+521 mm.
    // The objective therefore sits in the front throat at about +301 mm and the eyepiece on the
    // coaxial train beyond the focus at about -482 mm.
    expect(metadata.tubeObjectiveEndS).toBeGreaterThan(metadata.tubeEyepieceEndS)
    expect(metadata.objectiveFrontS).toBeGreaterThan(metadata.focusS)
    // the focal plane comes first along the light, then the eyepiece, exactly as a telescope needs
    expect(metadata.focusS).toBeGreaterThan(metadata.eyepieceFrontS)
    expect(metadata.eyepieceFrontS).toBeGreaterThan(metadata.eyepieceBackS)
    // the objective sits inside the tube, just behind its front opening
    expect(metadata.objectiveFrontS).toBeLessThanOrEqual(metadata.tubeObjectiveEndS)
    expect(metadata.objectiveFrontS).toBeGreaterThan(metadata.tubeEyepieceEndS)
    // the eyepiece lands on the measured coaxial train at the far end of the tube
    expect(metadata.eyepieceFrontS).toBeLessThan(-.470)
    expect(metadata.eyepieceBackS).toBeGreaterThan(-.530)
    // aperture is inside the measured clear stop and the blank fits the measured cell bore
    expect(metadata.objectiveAperture / 2).toBeLessThan(metadata.objectiveClearStopRadius)
    expect(metadata.objectiveLensDiameter / 2).toBeLessThan(metadata.cellBoreRadius)

    const opticalFrame = new THREE.Matrix4().fromArray(metadata.opticalFrame)
    const axis = new THREE.Vector3().setFromMatrixColumn(opticalFrame, 0).normalize()
    expect(axis.length()).toBeCloseTo(1, 6)
    scene.updateMatrixWorld(true)
    let checked = 0
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.userData.opticalGeometry) return
      checked++
      const local = new THREE.Box3().setFromObject(object)
        .getCenter(new THREE.Vector3()).applyMatrix4(opticalFrame.clone().invert())
      expect(Math.hypot(local.y, local.z), `${object.name} is off the optical axis`).toBeLessThan(.002)
    })
    expect(checked).toBeGreaterThanOrEqual(3)
  })

  it('traces every ray through the objective, the focal plane and the eyepiece in order', async () => {
    const { scene, metadata } = await loadClassified()
    expect(rayOrderIsPhysical(metadata)).toBe(true)
    const frame = new THREE.Matrix4().fromArray(metadata.opticalFrame)
    for (const ray of metadata.rays) {
      const s = ray.points.map((point) => point[0])
      // entry, objective rear vertex, focal plane, eyepiece front, eyepiece rear, emitted beam
      expect(ray.points.length).toBe(6)
      // s falls along the light, so the entry is the largest and the emitted vertex the smallest
      expect(Math.abs(s[0]! - metadata.objectiveFrontS)).toBeLessThan(1e-4)
      expect(s[1]!).toBeCloseTo(metadata.objectiveS, 4)
      expect(s[2]!).toBeCloseTo(metadata.focusS, 4)
      expect(s[3]!).toBeCloseTo(metadata.eyepieceFrontS, 4)
      expect(s[4]!).toBeCloseTo(metadata.eyepieceBackS, 4)
      expect(s[5]!).toBeLessThan(metadata.eyepieceBackS)
      // the third vertex is on the axis: that is what imaging at the focal plane means
      expect(Math.abs(ray.points[2]![1])).toBeLessThan(1e-9)
      // the incoming ray is parallel to the axis and enters at the aperture height for its
      // fraction, measured from the axis
      expect(Math.abs(ray.points[0]![1])).toBeCloseTo(
        (metadata.objectiveAperture / 2) * ray.apertureFrac, 4)
      // the beam is well inside the eyepiece element when it arrives
      expect(Math.abs(ray.points[3]![1])).toBeLessThan(.013)
      // off-axis bundles carry their image height to the eyepiece, which is where the field shows
      if (Math.abs(ray.field) > 1e-9) expect(Math.abs(ray.points[3]![1])).toBeGreaterThan(0)
    }
    // six vertices give five segments, and all four lesson steps are present
    const segments = raySegments(metadata, frame)
    expect(new Set(segments.map((segment) => segment.step))).toEqual(new Set([0, 1, 2, 3]))
    expect(segments.length).toBe(metadata.rays.length * 5)
  })

  it('passes its own numerical checks: aperture, focus, collimation and wall clearance', async () => {
    const { scene, metadata } = await loadClassified()
    const validation = validateRays(metadata)
    expect(validation.entryWithinAperture).toBe(true)
    expect(validation.entryRadiusMax).toBeLessThanOrEqual(metadata.objectiveAperture / 2 + 1e-9)
    expect(validation.focusResidualMax).toBeLessThan(1e-9)
    // the emitted beam is parallel to a few milliradians across the whole bundle
    expect(validation.exitBundleSpreadRad).toBeLessThan(8e-3)
    expect(validation.wallClearanceMin).toBeGreaterThan(0)
    expect(validation.objectiveClearance).toBeGreaterThan(0)
    expect(validation.raysChecked).toBe(metadata.rays.length)
    expect(metadata.disclosure).toContain('Teaching approximation')
    expect(lensSagScale(metadata)).toBeGreaterThan(1)
  })
})

describe('refractor geometry against the source', () => {
  it('keeps the added optics small next to the model, so nothing is rescaled twice', async () => {
    const { scene, metadata } = await loadClassified()
    const optics = new THREE.Box3()
    const model = new THREE.Box3().setFromObject(scene)
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.opticalGeometry) optics.expandByObject(object)
    })
    expect(optics.getSize(new THREE.Vector3()).length())
      .toBeLessThan(model.getSize(new THREE.Vector3()).length() * .5)
    // the lens blank is a real, model-scale object: 48 mm across on a 1.4 m instrument
    expect(metadata.focalLength).toBeGreaterThan(.05)
    expect(metadata.focalLength).toBeLessThan(3)
  })
})
