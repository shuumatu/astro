// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createStage } from '../../engine/stage'
import { RemnantScene } from './scene'
import type { RemnantState } from './state'
import zh from '../../../../locales/zh-CN/common.json'
import en from '../../../../locales/en/common.json'

vi.mock('../../engine/stage', () => ({ createStage: vi.fn() }))
const { load } = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class { setDRACOLoader() { return this }; loadAsync = load },
}))
vi.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class { setDecoderPath() {}; setWorkerLimit() {}; dispose() {} },
}))
let root: THREE.Scene, scene: RemnantScene, states: RemnantState[]
let resolveModel: (value: { scene: THREE.Group }) => void
let rejectModel: (reason: Error) => void
beforeEach(() => {
  root = new THREE.Scene(); states = []
  load.mockImplementation(() => new Promise((resolve, reject) => { resolveModel = resolve; rejectModel = reject }))
  vi.mocked(createStage).mockReturnValue({
    scene: root, camera: new THREE.PerspectiveCamera(),
    controls: { update: vi.fn(), target: new THREE.Vector3() } as never,
    renderer: { domElement: document.createElement('canvas') } as never,
    start: vi.fn(), stop: vi.fn(), dispose: vi.fn(), setFrameHandler: vi.fn(), setHomeView: vi.fn(), resetView: vi.fn(),
  })
  scene = new RemnantScene(document.createElement('div'), { onState: state => states.push(state as RemnantState) })
})
afterEach(() => { scene.dispose(); vi.clearAllMocks() })
function model() {
  const group = new THREE.Group()
  group.add(new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial()))
  return group
}
it('applies wavelength presets and individual visibility without changing earlier snapshots', () => {
  const initial = states.at(-1)!
  scene.runCommand({ type: 'band', value: 'xray' })
  expect(root.getObjectByName('filaments')!.visible).toBe(false)
  expect(root.getObjectByName('diffuse')!.visible).toBe(false)
  expect(root.getObjectByName('inner')!.visible).toBe(true)
  scene.runCommand({ type: 'layer', layer: 'filaments', value: true })
  expect(states.at(-1)!.band).toBe('custom')
  expect(root.getObjectByName('filaments')!.visible).toBe(true)
  expect(initial.layers).toEqual({ inner: true, diffuse: true, filaments: true })
})
it('keeps a hidden inner layer hidden when loading completes', async () => {
  scene.runCommand({ type: 'band', value: 'visible' })
  resolveModel({ scene: model() }); await Promise.resolve()
  expect(states.at(-1)!.model).toBe('ready')
  expect(root.getObjectByName('inner')!.visible).toBe(false)
})
it('allows retry after failure and ignores duplicate retry while loading', async () => {
  rejectModel(new Error('network')); await Promise.resolve()
  expect(states.at(-1)!.model).toBe('error')
  scene.runCommand({ type: 'retry' }); scene.runCommand({ type: 'retry' })
  expect(load).toHaveBeenCalledTimes(2)
  resolveModel({ scene: model() }); await Promise.resolve()
  expect(states.at(-1)!.model).toBe('ready')
})
it('disposes a late model without attaching it or publishing after navigation', async () => {
  scene.dispose()
  const count = states.length, group = model()
  const mesh = group.children[0] as THREE.Mesh
  const dispose = vi.spyOn(mesh.geometry, 'dispose')
  resolveModel({ scene: group }); await Promise.resolve()
  expect(dispose).toHaveBeenCalled()
  expect(states).toHaveLength(count)
  expect(root.getObjectByName('inner')!.children).toHaveLength(0)
})
it('restores the composite when returning from the inner view', () => {
  scene.runCommand({ type: 'focus', value: 'inner' })
  expect(states.at(-1)!.band).toBe('xray')
  scene.runCommand({ type: 'focus', value: 'all' })
  expect(states.at(-1)!.layers).toEqual({ inner: true, diffuse: true, filaments: true })
  const count = states.length
  scene.runCommand({ type: 'layer', layer: 'unknown', value: true })
  expect(states).toHaveLength(count)
})
it('provides the same nonempty Chinese and English panel copy', () => {
  const flatten = (obj: object, prefix = ''): Record<string, string> => Object.fromEntries(Object.entries(obj)
    .flatMap(([k,v]) => typeof v === 'object' ? Object.entries(flatten(v, `${prefix}${k}.`)) : [[`${prefix}${k}`, v]]))
  const chinese = flatten(zh.demos.items.supernovaRemnant), english = flatten(en.demos.items.supernovaRemnant)
  expect(Object.keys(chinese).sort()).toEqual(Object.keys(english).sort())
  expect([...Object.values(chinese), ...Object.values(english)].every(v => typeof v === 'string' && v.length > 0)).toBe(true)
})
