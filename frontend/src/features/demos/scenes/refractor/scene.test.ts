// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createStage } from '../../engine/stage'
import { RefractorScene } from './scene'
import { REFRACTOR_PARTS } from './parts'
import { opticalAxis } from './optics'

// The scene is exercised against the real classified GLB; only the GPU and orbit plumbing are
// replaced, so the part list, the highlight materials and the traced rays are the real ones.
vi.mock('../../engine/stage', () => ({ createStage: vi.fn() }))
let scene: RefractorScene
let root: THREE.Scene
let host: HTMLDivElement
let frameHandler: (_delta: number, elapsed: number) => void

beforeEach(async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = new THREE.Scene()
  vi.mocked(createStage).mockReturnValue({
    scene: root, camera: new THREE.PerspectiveCamera(),
    renderer: { domElement: document.createElement('canvas') } as unknown as THREE.WebGLRenderer,
    controls: { target: new THREE.Vector3(), update: vi.fn() } as never,
    setFrameHandler: (fn) => { frameHandler = fn! }, start: vi.fn(), stop: vi.fn(),
    setHomeView: vi.fn(), resetView: vi.fn(), dispose: vi.fn(),
  })
  const file = readFileSync(resolve('public/models/telescope_refractor_classified.glb'))
  // Copy into this jsdom realm: GLTFLoader uses instanceof ArrayBuffer to detect binary data.
  const bytes = new Uint8Array(file.byteLength)
  bytes.set(file)
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '')
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf)
  scene = new RefractorScene(host)
  await vi.waitFor(() => expect(host.querySelector<HTMLButtonElement>('[data-part="opticalTube"]')!.disabled).toBe(false))
})
afterEach(() => { scene?.dispose(); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const click = (selector: string) => host.querySelector<HTMLButtonElement>(selector)!.click()

describe('refractor structure mode', () => {
  it('selects and isolates every source category, reusing one pulsing emissive material', () => {
    for (const part of REFRACTOR_PARTS) {
      click(`[data-part="${part.id}"]`)
      click('[data-isolate]')
      const selected: THREE.Mesh[] = []
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !object.userData.partId) return
        if (object.userData.opticalGeometry) return
        expect(object.visible).toBe(object.userData.partId === part.id)
        if (object.visible) selected.push(object)
      })
      expect(selected.length, `${part.id} has no geometry`).toBeGreaterThan(0)
      const material = selected[0]!.material as THREE.MeshStandardMaterial
      frameHandler(0, 0)
      const intensity = material.emissiveIntensity
      frameHandler(0, .3)
      expect(material.emissiveIntensity).not.toBe(intensity)
      expect(selected[0]!.material).toBe(material)
      click('[data-isolate]')
    }
    click('[data-clear]')
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.userData.partId) return
      expect(object.visible).toBe(!object.userData.opticalGeometry)
      const material = object.material as THREE.Material
      if (object.userData.opticalGeometry) {
        // the teaching glass is deliberately translucent so its edge stays readable
        expect(material.transparent).toBe(true)
      } else if (object.userData.partId === 'objectiveLens'
        || object.userData.componentRole === 'eyepieceLens'
        || String(object.userData.componentRole).startsWith('finderLens')) {
        expect(material.transparent).toBe(true)
      } else {
        expect(material.transparent).toBe(false)
      }
    })
  })

  it('uses one shared highlight material per category rather than allocating per click', () => {
    const seen = new Set<THREE.Material>()
    for (let round = 0; round < 3; round++) {
      for (const part of REFRACTOR_PARTS) {
        click(`[data-part="${part.id}"]`)
        root.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || object.userData.partId !== part.id) return
          if (object.userData.opticalGeometry) return
          seen.add(object.material as THREE.Material)
        })
      }
    }
    // one glow material per category, whatever the number of meshes or clicks
    expect(seen.size).toBe(REFRACTOR_PARTS.length)
  })

  it('distinguishes optical and mechanical source categories', () => {
    expect(host.querySelector<HTMLElement>('[data-part="objectiveLens"]')!.dataset.kind).toBe('optical')
    expect(host.querySelector<HTMLElement>('[data-part="eyepieceLensGroup"]')!.dataset.kind).toBe('optical')
    expect(host.querySelector<HTMLElement>('[data-part="diagonal"]')!.dataset.kind).toBe('optical')
    expect(host.querySelector<HTMLElement>('[data-part="opticalTube"]')!.dataset.kind).toBe('mechanical')
    expect(host.querySelector<HTMLElement>('[data-part="fasteners"]')!.dataset.kind).toBe('mechanical')
    expect(host.querySelector('[data-part="unknown"]')).toBeNull()
  })

  it('opens the shared geometry diagnostics for source and teaching meshes', () => {
    const button = host.querySelector<HTMLButtonElement>('[data-diagnostics]')!
    expect(button.getAttribute('aria-pressed')).toBe('false')
    button.click()
    expect(button.getAttribute('aria-pressed')).toBe('true')
    const panel = host.querySelector<HTMLElement>('.geometry-diagnostics')!
    expect(panel.hidden).toBe(false)
    expect(panel.querySelectorAll('[data-diagnostic-name]').length).toBeGreaterThan(80)
    expect(root.getObjectByName('GeometryDiagnostics')!.visible).toBe(true)
    button.click()
    expect(panel.hidden).toBe(true)
    expect(root.getObjectByName('GeometryDiagnostics')!.visible).toBe(false)
  })
})

describe('refractor optics mode', () => {
  it('shows the tube semi-transparently, keeps the lenses and rays visible, and steps through the path', () => {
    click('[data-view="optics"]')
    const optics = root.getObjectByName('TeachingOptics')!
    expect(optics.visible).toBe(true)
    // Source parts, including the classified source lenses, fade to keep the ray overlay readable.
    const lensCount = scene.visibleMeshes('objectiveLens').length
      + scene.visibleMeshes('eyepieceLensGroup').length
    expect(lensCount).toBeGreaterThan(0)
    for (const id of ['objectiveLens', 'eyepieceLensGroup'] as const) {
      for (const mesh of scene.visibleMeshes(id)) {
        expect(mesh.visible).toBe(true)
        expect((mesh.material as THREE.MeshStandardMaterial).opacity).toBeLessThan(.3)
      }
    }
    // the focal-point marker and the focal-plane ring belong to the imaging phase, so they appear
    // when that phase is revealed; the focus is only reached on the way to the eyepiece, which is
    // why they are gated on the last step rather than on step three
    for (let i = 0; i < 4; i++) {
      click(`[data-step="${i}"]`)
      expect(optics.getObjectByName('FocalPoint')!.visible).toBe(i >= 2)
      expect(optics.getObjectByName('FocalPlane')!.visible).toBe(i >= 2)
    }
    // the mechanical structure is translucent rather than hidden, so the rays stay in context
    let mechanical = 0
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const id: unknown = object.userData.partId
      if (typeof id !== 'string' || object.userData.opticalGeometry) return
      mechanical++
      expect(object.visible).toBe(true)
      expect((object.material as THREE.Material).transparent).toBe(true)
      expect((object.material as THREE.MeshStandardMaterial).opacity).toBeLessThan(.3)
    })
    expect(mechanical).toBeGreaterThan(50)
    // Generated teaching surfaces are separate from the source-part index and appear only here.
    const teaching: THREE.Mesh[] = []
    root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.opticalGeometry) teaching.push(object)
    })
    expect(teaching).toHaveLength(3)
    for (const mesh of teaching) {
      expect(mesh.visible).toBe(true)
      const material = mesh.material as THREE.MeshStandardMaterial
      expect(material.transparent).toBe(true)
      expect(material.opacity).toBeGreaterThan(.2)
      expect(material.opacity).toBeLessThan(1)
    }
    const rayChildren = optics.children.filter((child) => typeof child.userData.lessonStep === 'number')
    expect(rayChildren.length).toBeGreaterThanOrEqual(4)
    for (let i = 0; i < 4; i++) {
      click(`[data-step="${i}"]`)
      for (const child of rayChildren) {
        // the focal-point marker is a derived point, not a traced segment, so it is checked
        // separately above and excluded from the segment ladder
        if (child.name === 'FocalPoint' || child.name === 'FocalPlane') continue
        expect(child.visible).toBe(child.userData.lessonStep <= i && !child.userData.field)
      }
    }
  })

  it('hides and restores the light path, and resets back to structure mode', () => {
    click('[data-view="optics"]')
    const optics = root.getObjectByName('TeachingOptics')!
    click('[data-rays]')
    expect(optics.children.filter((child) => typeof child.userData.lessonStep === 'number')
      .every((child) => !child.visible)).toBe(true)
    click('[data-step="2"]')
    expect(optics.children.some((child) => child.visible && child.userData.lessonStep === 2)).toBe(true)
    scene.resetView()
    expect(optics.visible).toBe(false)
    expect(host.querySelector('.telescope-controls')!.getAttribute('data-mode')).toBe('structure')
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.userData.partId) return
      if (object.userData.opticalGeometry) return
      const glass = object.userData.partId === 'objectiveLens'
        || object.userData.componentRole === 'eyepieceLens'
        || String(object.userData.componentRole).startsWith('finderLens')
      expect((object.material as THREE.Material).transparent).toBe(glass)
    })
  })

  it('aims the camera across the optical axis, not along it', () => {
    click('[data-view="optics"]')
    const model = findModel(root)
    expect(model, 'the loaded model carries the optical frame').not.toBeNull()
    const optical = opticalAxis(new THREE.Matrix4().fromArray(
      model!.userData.opticalFrame as number[]))
    // the direction the scene picks for its side view must be perpendicular to the axis,
    // otherwise the whole light path stacks up into a single line
    const side = scene.sideViewDirection()
    expect(side).not.toBeNull()
    expect(Math.abs(side!.dot(optical))).toBeCloseTo(0, 6)
    expect(side!.length()).toBeCloseTo(1, 6)
    // The side-view sign is part of the teaching contract: increasing optical s must
    // project left-to-right, so the displayed order is objective → focus → eyepiece.
    const horizontalAxis = optical.clone().setY(0).normalize()
    expect(new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), side!).dot(horizontalAxis))
      .toBeGreaterThan(.999)
  })

  it('switches field rays, shows propagation arrows and zooms the viewing end', () => {
    click('[data-view="optics"]')
    const optics = root.getObjectByName('TeachingOptics')!
    expect(optics.children.some(c => c.name === 'PropagationArrow' && c.visible)).toBe(true)
    const fields = optics.children.filter(c => c.userData.field)
    expect(fields.length).toBeGreaterThan(0)
    expect(fields.every(c => !c.visible)).toBe(true)
    click('[data-fields]')
    expect(fields.every(c => c.visible)).toBe(true)
    click('[data-focus-view]')
    const stage = vi.mocked(createStage).mock.results.at(-1)!.value
    expect(stage.camera.position.distanceTo(stage.controls.target)).toBeCloseTo(.85)
    click('[data-diagnostics]')
    expect(host.querySelector<HTMLElement>('.geometry-diagnostics')!.hidden).toBe(false)
    click('[data-optical-home]')
    expect(stage.camera.position.distanceTo(stage.controls.target)).toBeGreaterThan(2)
  })

  it('publishes the numeric self-check the panel shows', () => {
    const check = host.querySelector('.telescope-ray-check')!
    expect(check.textContent).toContain('数值自检')
    expect(check.textContent).toContain('口径')
    expect(check.textContent).toContain('筒壁最小余量')
    const calibration = scene.calibration
    expect(calibration.validation).not.toBeNull()
    expect(calibration.validation!.wallClearanceMin).toBeGreaterThan(0)
  })
})

function findModel(root: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null
  root.traverse((object) => {
    if (!found && object.userData.opticalFrame) found = object
  })
  return found
}
