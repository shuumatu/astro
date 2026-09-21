import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { createStage, type Stage } from '../../engine/stage'
import { createStarfield } from '../../engine/starfield'
import type { DemoScene, DemoSceneOptions, DemoSceneSettings } from '../../types'
import { createDiffuseCloud, createFilaments, innerMaterial } from './bodies'
import { initialState, isCommand, LAYERS, PRESETS } from './state'

export class RemnantScene implements DemoScene {
  private stage: Stage
  private root = new THREE.Group()
  private layers = { inner: new THREE.Group(), diffuse: createDiffuseCloud(), filaments: createFilaments() }
  private state = initialState()
  private decoder = new DRACOLoader()
  private disposed = false
  private showLabels = true
  private framing = 1
  private focused = false
  constructor(container: HTMLElement, private options: DemoSceneOptions = {}) {
    this.framing = Math.max(1, .95 / Math.max(.1, container.clientWidth / Math.max(1, container.clientHeight)))
    this.stage = createStage(container, {
      cameraPosition: new THREE.Vector3(0, .4, 11.8).multiplyScalar(this.framing),
      target: new THREE.Vector3(), fov: 43, minDistance: 2.5, maxDistance: 32*this.framing,
      background: 0x03060d, maxPixelRatio: 1.6,
    })
    this.root.rotation.z = -.32
    this.layers.inner.name = 'inner'
    this.root.add(...Object.values(this.layers))
    this.stage.scene.add(this.root, createStarfield({ count: 700, radius: 700, pixelRatio: 1 }))
    this.stage.controls.autoRotateSpeed = .45
    this.decoder.setDecoderPath(`${import.meta.env.BASE_URL}models/crab-nebula/draco/`)
    this.decoder.setWorkerLimit(1)
    this.stage.setFrameHandler(() => this.frame())
    this.publish()
    this.stage.start()
    void this.loadModel()
  }
  private publish() {
    this.options.onState?.({ ...this.state, layers: { ...this.state.layers } })
  }
  private async loadModel() {
    this.state.model = 'loading'; this.publish()
    try {
      const gltf = await new GLTFLoader().setDRACOLoader(this.decoder)
        .loadAsync(`${import.meta.env.BASE_URL}models/crab-nebula/nasa-crab.glb`)
      if (this.disposed) { disposeObject(gltf.scene); return }
      const box = new THREE.Box3().setFromObject(gltf.scene)
      const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3())
      const scale = 3.4 / Math.max(size.x, size.y, size.z)
      gltf.scene.position.copy(center).multiplyScalar(-scale)
      gltf.scene.scale.setScalar(scale)
      gltf.scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          const old = Array.isArray(object.material) ? object.material : [object.material]
          old.forEach(material => material.dispose())
          object.material = innerMaterial()
        }
      })
      this.layers.inner.add(gltf.scene)
      this.state.model = 'ready'
    } catch {
      if (this.disposed) return
      this.state.model = 'error'
    }
    this.publish()
  }
  runCommand(command: unknown) {
    if (!isCommand(command) || this.disposed) return
    if (command.type === 'band') {
      this.state.band = command.value; this.state.layers = { ...PRESETS[command.value] }
    } else if (command.type === 'layer') {
      this.state.layers[command.layer] = command.value; this.state.band = 'custom'
    } else if (command.type === 'rotate') {
      this.state.rotating = !this.state.rotating
    } else if (command.type === 'focus') {
      this.focused = command.value === 'inner'
      this.state.band = this.focused ? 'xray' : 'composite'
      this.state.layers = { ...PRESETS[this.state.band] }
      this.stage.camera.position.set(0, .4, this.focused ? 5.8 : 11.8).multiplyScalar(this.framing)
      this.stage.controls.target.set(0,0,0)
      this.stage.controls.update()
    } else if (command.type === 'retry' && this.state.model === 'error') { void this.loadModel() }
    for (const layer of LAYERS) this.layers[layer].visible = this.state.layers[layer]
    this.stage.controls.autoRotate = this.state.rotating
    this.publish()
  }
  private frame() {
    const next = Math.max(1, .95 / this.stage.camera.aspect)
    if (Math.abs(next - this.framing) > .001) {
      this.stage.camera.position.multiplyScalar(next / this.framing)
      this.framing = next
      this.stage.controls.maxDistance = 32*next
    }
    const canvas = this.stage.renderer.domElement
    this.root.updateMatrixWorld(true)
    const anchors = [
      { id: 'inner', p: new THREE.Vector3(.8, .5, 0) },
      { id: 'diffuse', p: new THREE.Vector3(-1.1, -.8, .5) },
      { id: 'filaments', p: new THREE.Vector3(.4, 2.7, 0) },
    ] as const
    this.options.onLabels?.(anchors.map(({ id, p }) => {
      p.applyMatrix4(this.root.matrixWorld).project(this.stage.camera)
      return { id, x: (p.x*.5+.5)*canvas.clientWidth, y: (-p.y*.5+.5)*canvas.clientHeight,
        visible: this.showLabels && this.state.layers[id] && (id !== 'inner' || this.state.model === 'ready') && Math.abs(p.z)<1 && Math.abs(p.x)<.95 && Math.abs(p.y)<.95,
        textKey: `demos.items.supernovaRemnant.layers.${id}`, descriptionKey: `demos.items.supernovaRemnant.details.${id}` }
    }))
  }
  applySettings(settings: Partial<DemoSceneSettings>) {
    if (settings.showLabels !== undefined) this.showLabels = settings.showLabels
  }
  resetView() {
    this.focused = false
    this.stage.setHomeView(new THREE.Vector3(0,.4,11.8).multiplyScalar(this.framing), new THREE.Vector3())
    this.stage.resetView()
  }
  setSuspended(suspended: boolean) { if (suspended) this.stage.stop(); else this.stage.start() }
  dispose() { this.disposed = true; this.stage.dispose(); this.decoder.dispose() }
}
function disposeObject(root: THREE.Object3D) {
  root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach(material => material.dispose())
    }
  })
}
