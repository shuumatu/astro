import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStage, type StageFrameHandler } from '../../engine/stage'
import { createScene, diagramViewport } from './index'
import type { DemoLabelAnchor, DemoScene } from '../../types'
import { CHAPTERS, type AstronomyState } from './model'

vi.mock('../../engine/stage', () => ({ createStage: vi.fn() }))
let root: THREE.Scene, frame: StageFrameHandler, demo: DemoScene, anchors: DemoLabelAnchor[]
let camera: THREE.PerspectiveCamera, snapshot: AstronomyState
let container: HTMLElement
let stop: ReturnType<typeof vi.fn>, start: ReturnType<typeof vi.fn>
const visibleLines = () => {
  const result: Line2[] = []
  root.traverse(object => { if (object instanceof Line2 && object.visible) result.push(object) })
  return result
}
beforeEach(() => {
  vi.stubGlobal('document', { hidden: false })
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(new THREE.Texture())
  root = new THREE.Scene(); stop = vi.fn(); start = vi.fn(); anchors = []
  camera = new THREE.PerspectiveCamera(45, 1.5, .1, 100)
  const home = new THREE.Vector3(8, 7, 11), target = new THREE.Vector3()
  const update = () => { camera.lookAt(target); camera.updateMatrixWorld() }
  vi.mocked(createStage).mockReturnValue({
    scene: root, camera,
    renderer: {} as THREE.WebGLRenderer, controls: { target, update } as ReturnType<typeof createStage>['controls'],
    setFrameHandler: fn => { frame = fn! }, start, stop,
    setHomeView: (position, lookAt) => { home.copy(position); target.copy(lookAt) },
    resetView: () => { camera.position.copy(home); update() }, dispose: vi.fn(),
  })
  container = { clientWidth: 1200, clientHeight: 800 } as HTMLElement
  demo = createScene(container, {
    onLabels: labels => { anchors = labels }, onState: state => { snapshot = state as AstronomyState },
  })
  demo.runCommand?.({type:'perspective',value:'observer'})
  frame(0, 0)
})
afterEach(() => { demo.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('progressive celestial diagrams', () => {
  it('switches between a real surface observer and observer-centered directions', () => {
    demo.runCommand?.({type:'perspective',value:'earth'}); frame(0,0)
    expect(root.getObjectByName('teaching-earth')?.visible).toBe(true)
    expect(anchors.map(a => a.id)).toContain('surfaceObserver')
    expect(anchors.map(a => a.id)).not.toContain('tangentHorizon')
    demo.runCommand?.({type:'step',value:1}); frame(0,0)
    expect(anchors.map(a => a.id)).toContain('tangentHorizon')
    demo.runCommand?.({type:'perspective',value:'observer'}); frame(0,0)
    expect(root.getObjectByName('teaching-earth')?.visible).toBe(false)
    expect(anchors.map(a => a.id)).toContain('observer')
  })
  it('starts without equatorial clutter and adds angle arcs one step at a time', () => {
    expect(anchors.map(a => a.id)).not.toContain('equator')
    expect(anchors.map(a => a.id)).not.toContain('azimuthArc')
    demo.runCommand?.({ type: 'step', value: 1 }); frame(0, 0)
    expect(anchors.map(a => a.id)).toContain('azimuthArc')
    expect(anchors.map(a => a.id)).not.toContain('altitudeArc')
    demo.runCommand?.({ type: 'step', value: 2 }); frame(0, 0)
    expect(anchors.map(a => a.id)).toContain('altitudeArc')
  })
  it('draws a closed horizon with no transparent depth occlusion or mirrored compass', () => {
    const horizon = visibleLines().find(line => line.material.color.getHex() === 0x64dec8 && line.material.linewidth === 2.5)!
    const positions = horizon.geometry.getAttribute('instanceStart')
    const ends = horizon.geometry.getAttribute('instanceEnd')
    expect(positions.getX(0)).toBeCloseTo(ends.getX(ends.count - 1), 8)
    expect(positions.getZ(0)).toBeCloseTo(ends.getZ(ends.count - 1), 8)
    expect(positions.getZ(0)).toBeCloseTo(-3) // North = -Z.
    expect(positions.getX(45)).toBeCloseTo(3) // East is clockwise in a top view.
    for (const line of visibleLines()) {
      expect(line.material.depthWrite).toBe(false)
      expect(line.material.depthTest).toBe(false)
      expect(line.material.linewidth).toBeGreaterThanOrEqual(1.5)
    }
  })
  it('keeps every chapter finite at extreme declinations and reuses line resources', () => {
    for (const chapter of CHAPTERS) {
      demo.runCommand?.({ type: 'chapter', value: chapter })
      demo.runCommand?.({ type: 'step', value: 2 })
      for (const value of [-90, 0, 90]) {
        demo.runCommand?.({ type: 'dec', value }); frame(0, 0)
        for (const line of visibleLines()) {
          const attr = line.geometry.getAttribute('instanceStart')
          for (let i = 0; i < attr.count; i++) expect([attr.getX(i), attr.getY(i), attr.getZ(i)].every(Number.isFinite)).toBe(true)
        }
      }
    }
    const resources = visibleLines().map(line => line.geometry)
    demo.runCommand?.({ type: 'years', value: 13000 }); frame(0, 0)
    expect(visibleLines().map(line => line.geometry)).toEqual(resources)
    demo.setSuspended?.(true); expect(stop).toHaveBeenCalledOnce()
    demo.setSuspended?.(false); expect(start).toHaveBeenCalledTimes(2)
  })
  it('distinguishes visible daily paths from paths below the horizon', () => {
    demo.runCommand?.({ type: 'chapter', value: 'daily' })
    demo.runCommand?.({ type: 'step', value: 2 }); frame(0, 0)
    const dashed = visibleLines().filter(line => line.material.dashed)
    expect(dashed.length).toBeGreaterThan(0)
    for (const line of dashed) {
      const starts = line.geometry.getAttribute('instanceStart'), ends = line.geometry.getAttribute('instanceEnd')
      for (let i = 0; i < starts.count; i++) {
        expect(starts.getY(i)).toBeLessThanOrEqual(1e-6)
        expect(ends.getY(i)).toBeLessThanOrEqual(1e-6)
      }
    }
    demo.runCommand?.({ type: 'example', value: 'circumpolar' }); frame(0, 0)
    expect(visibleLines().some(line => line.material.dashed)).toBe(false)
    demo.runCommand?.({ type: 'dec', value: -60 }); frame(0, 0)
    expect(visibleLines().filter(line => line.material.color.getHex() === 0xffce70).every(line => line.material.dashed)).toBe(true)
  })
  it('preserves the current lesson step and viewing preferences while comparing perspectives and examples', () => {
    demo.runCommand?.({ type: 'step', value: 2 })
    demo.runCommand?.({ type: 'perspective', value: 'earth' })
    expect(snapshot.step).toBe(2)
    demo.runCommand?.({ type: 'perspective', value: 'observer' })
    demo.runCommand?.({ type: 'grid' })
    demo.runCommand?.({ type: 'speed', value: .5 })
    demo.runCommand?.({ type: 'example', value: 'solstice' })
    expect(snapshot).toMatchObject({ perspective: 'observer', grid: true, speed: .5, chapter: 'ecliptic' })
    demo.runCommand?.({ type: 'perspective', value: 'earth' })
    demo.runCommand?.({ type: 'example', value: 'southeast' })
    expect(snapshot.perspective).toBe('observer')
  })
  it('applies the selected playback rate and does not advance a hidden tab', () => {
    demo.runCommand?.({ type: 'playing' })
    const lst = snapshot.lst
    demo.runCommand?.({ type: 'speed', value: 2 }); frame(.2, .2)
    expect(snapshot.lst - lst).toBeCloseTo(.18)
    demo.runCommand?.({ type: 'speed', value: -1 })
    expect(snapshot.speed).toBe(2)
    vi.stubGlobal('document', { hidden: true }); frame(.2, .4)
    expect(snapshot.lst - lst).toBeCloseTo(.18)
    vi.stubGlobal('document', { hidden: false })
    demo.runCommand?.({ type: 'chapter', value: 'precession' })
    demo.runCommand?.({ type: 'playing' }); frame(.2, .6)
    expect(snapshot.years).toBe(400)
  })
  it('pauses manual time edits and accepts an idempotent pause without advancing the lesson', () => {
    demo.runCommand?.({ type: 'playing', value: false })
    expect(snapshot).toMatchObject({ playing: false, step: 0 })
    demo.runCommand?.({ type: 'playing' })
    expect(snapshot).toMatchObject({ playing: true, step: 2 })
    demo.runCommand?.({ type: 'lst', value: 9.25 }); frame(.2, .2)
    expect(snapshot).toMatchObject({ playing: false, lst: 9.25 })
    demo.runCommand?.({ type: 'playing', value: false })
    demo.runCommand?.({ type: 'playing', value: false })
    expect(snapshot.playing).toBe(false)
    demo.runCommand?.({ type: 'chapter', value: 'precession' })
    demo.runCommand?.({ type: 'playing' })
    demo.runCommand?.({ type: 'years', value: 13000 }); frame(.2, .4)
    expect(snapshot).toMatchObject({ playing: false, years: 13000 })
  })
  it('supports bounded button zoom without changing the selected lesson', () => {
    const before = camera.position.length()
    demo.runCommand?.({ type: 'zoom', value: 'in' })
    expect(camera.position.length()).toBeLessThan(before)
    for (let i = 0; i < 12; i++) demo.runCommand?.({ type: 'zoom', value: 'in' })
    expect(camera.position.length()).toBeCloseTo(9)
    for (let i = 0; i < 12; i++) demo.runCommand?.({ type: 'zoom', value: 'out' })
    expect(camera.position.length()).toBeCloseTo(25)
    expect(snapshot.chapter).toBe('horizon')
    expect(snapshot.step).toBe(0)
  })
  it('resets the current chapter while retaining display and playback preferences', () => {
    demo.runCommand?.({ type: 'example', value: 'halfCycle' })
    demo.runCommand?.({ type: 'grid' })
    demo.runCommand?.({ type: 'speed', value: .25 })
    demo.runCommand?.({ type: 'playing' })
    demo.runCommand?.({ type: 'reset' })
    expect(snapshot).toMatchObject({ chapter: 'precession', perspective: 'observer', grid: true, speed: .25, years: 0, playing: false, step: 0 })
    const distance = camera.position.length()
    demo.runCommand?.({ type: 'camera', value: 'in' })
    expect(camera.position.length()).toBeLessThan(distance)
  })
  it('keeps the target labelled while suppressing intersecting label boxes', () => {
    demo.runCommand?.({ type: 'step', value: 2 }); frame(0, 0)
    expect(anchors.find(anchor => anchor.id === 'target')?.visible).toBe(true)
    const visible = anchors.filter(anchor => anchor.visible)
    for (let i = 0; i < visible.length; i++) {
      for (const other of visible.slice(i + 1)) {
        expect(Math.abs(visible[i]!.x - other.x) >= 86 || Math.abs(visible[i]!.y - other.y) >= 30).toBe(true)
      }
    }
  })
  it('measures sibling toolbar cards without treating their empty flex gap as an overlay', () => {
    const card = (left: number, right: number) => ({ getBoundingClientRect: () => ({ left, right, top: 0, bottom: 130, width: right - left, height: 130 }) })
    const toolbar = {
      classList: { contains: () => false },
      querySelectorAll: vi.fn(() => [card(0, 80), card(1120, 1200)]),
    }
    const query = vi.fn(() => [toolbar])
    Object.defineProperty(container, 'parentElement', { value: { querySelectorAll: query } })
    demo.runCommand?.({ type: 'chapter', value: 'equatorial' }); frame(0, 0)
    expect(query).toHaveBeenCalledWith('.overlay.top')
    expect(toolbar.querySelectorAll).toHaveBeenCalledWith('.info-card, .display-stack')
    // Both cards leave the central rectangle usable all the way to its top margin.
    expect(camera.view?.offsetY).toBe(0)
    expect(anchors.find(anchor => anchor.id === 'pole')?.visible).toBe(true)
    toolbar.querySelectorAll.mockReturnValue([card(0, 1200)])
    frame(.21, .21)
    expect(camera.view?.offsetY).toBeLessThan(0)
  })
})

describe('diagram framing around overlays', () => {
  it('fits between the desktop controls, readouts and lesson caption', () => {
    const overlays = [
      { left: 18, top: 14, right: 1382, bottom: 66 },
      { left: 18, top: 82, right: 358, bottom: 700 },
      { left: 1138, top: 82, right: 1378, bottom: 270 },
      { left: 382, top: 650, right: 1378, bottom: 740 },
    ]
    const rect = diagramViewport(1400, 800, overlays)
    expect(rect.left).toBeGreaterThanOrEqual(372)
    expect(rect.bottom).toBeLessThanOrEqual(636)
    expect(Math.min(rect.right - rect.left, rect.bottom - rect.top)).toBeGreaterThan(500)
    for (const overlay of overlays) expect(rect.left >= overlay.right || rect.right <= overlay.left || rect.top >= overlay.bottom || rect.bottom <= overlay.top).toBe(true)
  })
  it('uses the available vertical space on narrow screens and recovers space when captions collapse', () => {
    const top = { left: 12, top: 12, right: 378, bottom: 130 }
    const caption = { left: 12, top: 610, right: 378, bottom: 780 }
    const rect = diagramViewport(390, 844, [top, caption])
    expect(rect.top).toBe(144)
    expect(rect.bottom).toBe(596)
    const collapsed = diagramViewport(390, 844, [top, { ...caption, top: 730 }])
    expect(collapsed.bottom).toBeGreaterThan(rect.bottom)
    expect(collapsed.left).toBe(16)
  })
})
