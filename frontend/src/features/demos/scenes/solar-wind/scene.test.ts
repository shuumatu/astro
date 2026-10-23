// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createStage, type Stage, type StageFrameHandler } from '../../engine/stage'
import type { DemoScene, DemoLabelAnchor } from '../../types'
import { createScene } from './scene'
import { PARTICLE_COUNT, type WindState } from './model'

vi.mock('../../engine/stage', () => ({ createStage: vi.fn() }))
let stage: Stage, demo: DemoScene, frame: StageFrameHandler, state: WindState, labels: DemoLabelAnchor[]
let media: EventTarget & { matches: boolean }, disconnect: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(new THREE.Texture())
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => media)
  disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect })
  const camera = new THREE.PerspectiveCamera(45, 1.5, .1, 4000)
  const canvas = document.createElement('canvas')
  stage = {
    scene: new THREE.Scene(), camera,
    controls: new OrbitControls(camera, canvas),
    renderer: { domElement: canvas, render: vi.fn() } as never,
    setFrameHandler: vi.fn(handler => { frame = handler! }), start: vi.fn(), stop: vi.fn(),
    setHomeView: vi.fn(), resetView: vi.fn(), dispose: vi.fn(),
  }
  stage.dispose = vi.fn(() => stage.controls.dispose())
  vi.mocked(createStage).mockReturnValue(stage)
  demo = createScene({ clientWidth: 1200, clientHeight: 800 } as HTMLElement, {
    onState: snapshot => { state = snapshot as WindState }, onLabels: snapshot => { labels = snapshot },
  })
})
afterEach(() => { demo?.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const points = (name: string) => stage.scene.getObjectByName(name) as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>

it('updates actual geometry and both auroral ovals without reallocating buffers', () => {
  const nose = points('boundary-1'), wind = points('solar-wind-particles')
  const geometry = wind.geometry, position = geometry.getAttribute('position')
  const before = nose.geometry.getAttribute('position').getX(0)
  demo.runCommand?.({type:'preset',value:'strong'})
  expect(nose.geometry.getAttribute('position').getX(0)).toBeGreaterThan(before)
  const north = stage.scene.getObjectByName('aurora-1-0') as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
  const south = stage.scene.getObjectByName('aurora--1-0') as typeof north
  const opacity = north.material.opacity
  demo.runCommand?.({type:'preset',value:'reconnection'})
  expect(north.material.opacity).toBeGreaterThan(opacity)
  expect(south.material.opacity).toBe(north.material.opacity)
  expect(south.position.y).toBe(-north.position.y)
  for (let value = 0; value <= 100; value += 10) { demo.runCommand?.({type:'intensity',value}); frame(.016, 1) }
  expect(wind.geometry).toBe(geometry); expect(wind.geometry.getAttribute('position')).toBe(position)
  expect(position.count).toBe(PARTICLE_COUNT)
  expect(geometry.drawRange.count).toBeLessThanOrEqual(PARTICLE_COUNT)
  stage.scene.traverse(object => {
    const a = (object as THREE.Mesh).geometry?.getAttribute('position')
    if (a) expect(Array.from(a.array).every(Number.isFinite)).toBe(true)
  })
})
it('honors pause and dynamic reduced motion while allowing immediate control updates', () => {
  const p = points('solar-wind-particles').geometry.getAttribute('position')
  const initial = Array.from(p.array)
  frame(.1, .1); expect(Array.from(p.array)).not.toEqual(initial)
  demo.runCommand?.({type:'playing'})
  const paused = Array.from(p.array); frame(.1, .2)
  expect(Array.from(p.array)).toEqual(paused)
  expect(stage.stop).toHaveBeenCalled()
  media.matches = true; media.dispatchEvent(new Event('change'))
  expect(state.reducedMotion).toBe(true)
  demo.runCommand?.({type:'preset',value:'reconnection'})
  expect(state.direction).toBe('south')
  const still = Array.from(p.array); frame(.1, .3); expect(Array.from(p.array)).toEqual(still)
  expect(stage.renderer.render).toHaveBeenCalled()
})
it('starts reduced-motion mode without scheduling animation and respects shared playback', () => {
  demo.dispose()
  stage.scene.clear()
  vi.mocked(stage.start).mockClear()
  media.matches = true
  demo = createScene({clientWidth:390,clientHeight:740} as HTMLElement)
  expect(stage.start).not.toHaveBeenCalled()
  media.matches = false; media.dispatchEvent(new Event('change'))
  expect(stage.start).toHaveBeenCalledOnce()
  demo.applySettings({playing:false})
  const p = points('solar-wind-particles').geometry.getAttribute('position')
  const snapshot = Array.from(p.array); frame(.1, .1)
  expect(Array.from(p.array)).toEqual(snapshot)
})
it('publishes labels, suspends on hidden pages and handles context loss/recovery', () => {
  expect(labels.map(l => l.id)).toContain('southAurora')
  demo.applySettings({showLabels:false}); expect(labels.every(l => !l.visible)).toBe(true)
  demo.setSuspended?.(true); expect(stage.stop).toHaveBeenCalled()
  expect(stage.controls.enabled).toBe(false)
  const starts = vi.mocked(stage.start).mock.calls.length
  const event = new Event('webglcontextlost', {cancelable:true})
  stage.renderer.domElement.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true); expect(state.contextLost).toBe(true)
  stage.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'))
  expect(stage.start).toHaveBeenCalledTimes(starts) // Still hidden.
  demo.setSuspended?.(false); expect(stage.start).toHaveBeenCalledTimes(starts + 1)
  expect(stage.controls.enabled).toBe(true)
})
it('releases stage ownership and listeners exactly once and ignores late commands', () => {
  const snapshot = state
  const position = stage.camera.position.clone()
  demo.dispose(); demo.dispose()
  expect(stage.dispose).toHaveBeenCalledOnce(); expect(disconnect).toHaveBeenCalledOnce()
  expect(stage.setFrameHandler).toHaveBeenLastCalledWith(null)
  media.matches = true; media.dispatchEvent(new Event('change'))
  stage.renderer.domElement.dispatchEvent(new Event('webglcontextlost'))
  demo.runCommand?.({type:'preset',value:'strong'})
  stage.renderer.domElement.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight'}))
  expect(stage.camera.position.equals(position)).toBe(true)
  expect(state).toBe(snapshot)
})
it('orbits and zooms while paused, preserves camera across physical controls, and resets deterministically', () => {
  demo.runCommand?.({type:'playing'})
  const home = stage.camera.position.clone()
  const initialLabels = labels.map(l => [l.x,l.y])
  demo.runCommand?.({type:'camera',value:'right'})
  expect(stage.camera.position.distanceTo(home)).toBeGreaterThan(1)
  expect(labels.map(l => [l.x,l.y])).not.toEqual(initialLabels)
  const turned = stage.camera.position.clone()
  demo.runCommand?.({type:'preset',value:'strong'})
  expect(stage.camera.position.distanceTo(turned)).toBeLessThan(1e-8)
  const distance = stage.camera.position.distanceTo(stage.controls.target)
  stage.renderer.domElement.dispatchEvent(new KeyboardEvent('keydown', {key:'+',bubbles:true,cancelable:true}))
  expect(stage.camera.position.distanceTo(stage.controls.target)).toBeLessThan(distance)
  demo.resetView()
  expect(stage.camera.position.distanceTo(home)).toBeLessThan(1e-8)
  for (let i=0;i<50;i++) demo.runCommand?.({type:'camera',value:'in'})
  expect(stage.camera.position.distanceTo(stage.controls.target)).toBeCloseTo(stage.controls.minDistance)
})
it('switches framing without changing physics and retains full 3D geometry', () => {
  const original = stage.camera.position.clone()
  demo.runCommand?.({type:'view',value:'earth'})
  expect(state.view).toBe('earth'); expect(state.intensity).toBe(20)
  expect(stage.camera.position.length()).toBeLessThan(original.length())
  const field = points('field-4').geometry.getAttribute('position')
  expect(Math.max(...Array.from({length:field.count},(_,i)=>Math.abs(field.getZ(i))))).toBeGreaterThan(1)
  demo.runCommand?.({type:'view',value:'system'})
  expect(stage.camera.position.distanceTo(original)).toBeLessThan(1e-8)
})
