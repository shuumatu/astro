// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createStage } from '../../engine/stage'
import { TelescopeScene } from './scene'
import { TELESCOPE_PARTS } from './parts'

// Exercise scene wiring with real GLB geometry; only GPU and orbit event plumbing are replaced.
vi.mock('../../engine/stage', () => ({ createStage: vi.fn() }))
let scene: TelescopeScene
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
  const file = readFileSync(resolve('public/models/telescope_newtonian_classified.glb'))
  // Copy into this jsdom realm: GLTFLoader uses instanceof ArrayBuffer to detect binary data.
  const bytes = new Uint8Array(file.byteLength)
  bytes.set(file)
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '')
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf)
  scene = new TelescopeScene(host)
  await vi.waitFor(() => expect(host.querySelector<HTMLButtonElement>('[data-part="tube"]')!.disabled).toBe(false))
})
afterEach(() => { scene?.dispose(); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const click = (selector: string) => host.querySelector<HTMLButtonElement>(selector)!.click()

describe('telescope controls with real classified geometry', () => {
  it('selects and isolates each category, and reuses a pulsing emissive material', () => {
    for (const part of TELESCOPE_PARTS) {
      click(`[data-part="${part.id}"]`)
      click('[data-isolate]')
      const selected: THREE.Mesh[] = []
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !object.userData.partId) return
        expect(object.visible).toBe(object.userData.partId === part.id)
        if (object.visible) selected.push(object)
      })
      expect(selected.length).toBeGreaterThan(0)
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
      if (object instanceof THREE.Mesh && object.userData.partId) {
        expect(object.visible).toBe(true)
        expect((object.material as THREE.Material).transparent).toBe(false)
      }
    })
  })

  it('shows optics on entry, reveals every phase, and restores after hide and reset', () => {
    click('[data-view="optics"]')
    const optics = root.getObjectByName('TeachingOptics')!
    expect(optics.visible).toBe(true)
    root.traverse((object) => {
      if (object.userData.partId === 'internalDisk') expect(object.visible).toBe(false)
    })
    expect(optics.getObjectByName('TeachingPrimaryMirror')!.visible).toBe(true)
    expect(optics.children.some((child) => child.visible && child.userData.lessonStep === 0)).toBe(true)
    for (let i = 0; i < 4; i++) {
      click(`[data-step="${i}"]`)
      for (const child of optics.children) {
        if (typeof child.userData.lessonStep === 'number') expect(child.visible).toBe(child.userData.lessonStep <= i)
      }
    }
    click('[data-rays]')
    expect(optics.children.filter((child) => typeof child.userData.lessonStep === 'number').every((child) => !child.visible)).toBe(true)
    click('[data-step="2"]')
    expect(optics.children.some((child) => child.visible && child.userData.lessonStep === 2)).toBe(true)
    scene.resetView()
    expect(optics.visible).toBe(false)
    expect(host.querySelector('.telescope-controls')!.getAttribute('data-mode')).toBe('structure')
  })
})
