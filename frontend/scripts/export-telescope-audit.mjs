// Node >= 24: export the actual scene optics for an offline geometric projection.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildOptics, FOCUS, SECONDARY } from '../src/features/demos/scenes/telescope/optics.ts'

const bytes = readFileSync(new URL('../public/models/telescope_newtonian_classified.glb', import.meta.url))
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
const inverse = new THREE.Matrix4().fromArray(scene.userData.opticalFrame).invert()
const result = { mechanics: [], optics: [], exitAxis: FOCUS.clone().sub(SECONDARY).normalize().toArray() }
function triangles(mesh, transform) {
  const pos = mesh.geometry.getAttribute('position'), ids = mesh.geometry.index
  return Array.from({ length: ids?.count ?? pos.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(pos, ids ? ids.getX(i) : i).applyMatrix4(transform).toArray())
}
scene.traverse((object) => {
  if (object instanceof THREE.Mesh && ['tube', 'focuser', 'finder', 'spider', 'mirrorCell', 'internalDisk'].includes(object.userData.partId)) {
    result.mechanics.push({ part: object.userData.partId, positions: triangles(object, inverse) })
  }
})
const optics = buildOptics(new THREE.Matrix4().toArray())
optics.updateMatrixWorld(true)
for (const object of optics.children) {
  if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
    result.optics.push({ name: object.name, step: object.userData.lessonStep, line: object instanceof THREE.Line,
      positions: triangles(object, object.matrixWorld) })
  }
}
const directory = fileURLToPath(new URL('../../.cache/telescope-audit/', import.meta.url))
mkdirSync(directory, { recursive: true })
writeFileSync(`${directory}/optics-projection.json`, JSON.stringify(result))
console.log('Exported actual GLB and optics.ts geometry for projection')
