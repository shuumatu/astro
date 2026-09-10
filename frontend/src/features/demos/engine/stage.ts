import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type StageFrameHandler = (deltaSeconds: number, elapsedSeconds: number) => void

export interface StageOptions {
  cameraPosition?: THREE.Vector3
  target?: THREE.Vector3
  fov?: number
  minDistance?: number
  maxDistance?: number
  minPolarAngle?: number
  maxPolarAngle?: number
  background?: number
  /** Called whenever the viewport shape changes, so scenes can re-frame themselves. */
  onResize?: (aspect: number) => void
}

export interface Stage {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly controls: OrbitControls
  setFrameHandler(handler: StageFrameHandler | null): void
  start(): void
  stop(): void
  setHomeView(position: THREE.Vector3, target: THREE.Vector3): void
  resetView(): void
  dispose(): void
}

const MAX_PIXEL_RATIO = 2
const MAX_FRAME_DELTA_SECONDS = 0.1

export function createStage(container: HTMLElement, options: StageOptions = {}): Stage {
  const scene = new THREE.Scene()
  const homeFieldOfView = options.fov ?? 45
  const camera = new THREE.PerspectiveCamera(homeFieldOfView, 1, 0.1, 4000)
  const homePosition = (options.cameraPosition ?? new THREE.Vector3(0, 18, 26)).clone()
  const homeTarget = (options.target ?? new THREE.Vector3(0, 0, 0)).clone()
  camera.position.copy(homePosition)
  camera.lookAt(homeTarget)

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setClearColor(options.background ?? 0x03060d, 1)
  // The canvas must be out of flow. In flow, its intrinsic aspect ratio feeds back into the
  // container's height and the stage grows to whatever shape the canvas last had.
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.inset = '0'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  container.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = options.minDistance ?? 6
  controls.maxDistance = options.maxDistance ?? 90
  controls.minPolarAngle = options.minPolarAngle ?? Math.PI * 0.06
  controls.maxPolarAngle = options.maxPolarAngle ?? Math.PI * 0.94
  controls.target.copy(homeTarget)
  controls.update()

  let frameHandler: StageFrameHandler | null = null
  let animationFrame = 0
  let running = false
  let elapsedSeconds = 0
  let previousTime = 0

  function resize(): void {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    options.onResize?.(camera.aspect)
  }

  function tick(): void {
    animationFrame = requestAnimationFrame(tick)
    const now = performance.now()
    const delta = previousTime === 0 ? 0 : Math.min((now - previousTime) / 1000, MAX_FRAME_DELTA_SECONDS)
    previousTime = now
    elapsedSeconds += delta
    frameHandler?.(delta, elapsedSeconds)
    // OrbitControls would fight the scripted camera moves used by the demo cinematics.
    if (controls.enabled) controls.update()
    renderer.render(scene, camera)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  return {
    scene,
    camera,
    renderer,
    controls,
    setFrameHandler(handler) {
      frameHandler = handler
    },
    start() {
      if (running) return
      running = true
      previousTime = 0
      animationFrame = requestAnimationFrame(tick)
    },
    stop() {
      if (!running) return
      running = false
      cancelAnimationFrame(animationFrame)
      animationFrame = 0
    },
    setHomeView(position, target) {
      homePosition.copy(position)
      homeTarget.copy(target)
    },
    resetView() {
      camera.position.copy(homePosition)
      camera.fov = homeFieldOfView
      camera.updateProjectionMatrix()
      controls.target.copy(homeTarget)
      controls.update()
    },
    dispose() {
      if (running) {
        running = false
        cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }
      observer.disconnect()
      controls.dispose()
      disposeSceneGraph(scene)
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    },
  }
}

function disposeSceneGraph(root: THREE.Object3D): void {
  root.traverse((object) => {
    const geometry = (object as Partial<THREE.Mesh>).geometry
    geometry?.dispose()
    const material = (object as Partial<THREE.Mesh>).material
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else if (material) disposeMaterial(material)
  })
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof THREE.Texture) value.dispose()
  }
  material.dispose()
}
