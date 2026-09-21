// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createStage } from '../../engine/stage'
import type { DemoLabelAnchor, DemoReadout } from '../../types'
import { SCENE } from './config'
import { StellarEvolutionScene } from './scene'
import { STAGE_VISUALS } from './visuals'
import { STAGES } from './stages'
import type { StellarEvolutionSceneState } from './types'

/**
 * The scene is exercised through its real command channel and its real frame handler; only the GPU
 * and the orbit plumbing are replaced. So the timeline, the morph, the label projection and the
 * publishing are all the ones the page runs.
 */
vi.mock('../../engine/stage', () => ({ createStage: vi.fn() }))

let scene: StellarEvolutionScene
let root: THREE.Scene
let host: HTMLDivElement
let frameHandler: (delta: number, elapsed: number) => void
let stopSpy: ReturnType<typeof vi.fn>
let startSpy: ReturnType<typeof vi.fn>
let disposeSpy: ReturnType<typeof vi.fn>
let states: StellarEvolutionSceneState[] = []
let labels: DemoLabelAnchor[][] = []
let readouts: (DemoReadout | null)[] = []
let resolved: Record<string, unknown>[] = []

/** A camera placed the way `SCENE` places the real one, with its matrices ready for projection. */
function stageCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    SCENE.fieldOfView,
    STAGE_ASPECT,
    SCENE.near,
    SCENE.far,
  )
  camera.position.set(...SCENE.cameraPosition)
  camera.lookAt(...SCENE.target)
  camera.updateMatrixWorld(true)
  return camera
}

/**
 * A canvas of a real size.
 *
 * jsdom lays nothing out, so `clientWidth` is zero and every projection would collapse onto the
 * origin. The scene reads the canvas to turn a projected point into stage pixels, so the label
 * placement checks below need it to have a size.
 */
function stageCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'clientWidth', { value: STAGE_WIDTH, configurable: true })
  Object.defineProperty(canvas, 'clientHeight', { value: STAGE_HEIGHT, configurable: true })
  return canvas
}

const STAGE_ASPECT = 1.6
const STAGE_WIDTH = 1280
const STAGE_HEIGHT = STAGE_WIDTH / STAGE_ASPECT

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  // jsdom has no canvas backend and announces the fact for every texture the scene builds. The
  // scene already tolerates a missing 2d context - it just gets a blank texture - so stubbing the
  // call keeps the run's output readable without hiding anything the tests check.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = new THREE.Scene()
  stopSpy = vi.fn()
  startSpy = vi.fn()
  disposeSpy = vi.fn()
  states = []
  labels = []
  readouts = []
  resolved = []
  vi.mocked(createStage).mockReturnValue({
    scene: root,
    // A camera placed like the real one, so the label projection the scene performs is meaningful
    // rather than everything collapsing onto the origin.
    camera: stageCamera(),
    renderer: {
      domElement: stageCanvas(),
      dispose: vi.fn(),
    } as unknown as THREE.WebGLRenderer,
    controls: { target: new THREE.Vector3(), update: vi.fn(), dispose: vi.fn() } as never,
    setFrameHandler: (handler) => { frameHandler = handler! },
    start: startSpy,
    stop: stopSpy,
    setHomeView: vi.fn(),
    resetView: vi.fn(),
    dispose: disposeSpy,
  })
  scene = new StellarEvolutionScene(host, {
    onState: (state) => states.push(state as StellarEvolutionSceneState),
    onLabels: (anchors) => labels.push(anchors),
    onReadout: (readout) => readouts.push(readout),
    onSettingsResolved: (settings) => resolved.push(settings as Record<string, unknown>),
  })
})

afterEach(() => {
  scene?.dispose()
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function lastState() {
  return states[states.length - 1]!
}

function find(name: string): THREE.Object3D {
  let found: THREE.Object3D | null = null
  root.traverse((object) => {
    if (object.name === name) found = object
  })
  expect(found, `no object named ${name}`).not.toBeNull()
  return found!
}

/** Drives the frame loop for a number of seconds, in the deltas a real loop would deliver. */
function runFrames(seconds: number, delta = 1 / 60): void {
  const steps = Math.ceil(seconds / delta)
  for (let step = 0; step < steps; step += 1) frameHandler(delta, step * delta)
}

describe('opening the scene', () => {
  it('starts the frame loop and publishes a first state before any frame runs', () => {
    expect(startSpy).toHaveBeenCalled()
    expect(states.length).toBeGreaterThan(0)
    expect(lastState().index).toBe(0)
    expect(lastState().playing).toBe(true)
    // A headless render that never advances a frame still has a card to show.
    expect(readouts[readouts.length - 1]?.key).toBe(STAGES[0]!.readoutKey)
    expect(labels[labels.length - 1]!.length).toBe(STAGES[0]!.labels.length)
  })

  it('publishes the Sun\'s own numbers with the main-sequence stage', () => {
    scene.runCommand({ type: 'stage', index: 2 })
    const state = lastState()
    expect(state.index).toBe(2)
    expect(state.playing).toBe(true)
    // Real figures, straight from the config, with nothing drawn in between.
    expect(state.radiusSolar).toBe(1)
    expect(state.temperatureK).toBe(5772)
    expect(state.massSolar).toBe(1)
    expect(state.durationYears).toBe(1e10)
  })
})

/**
 * The stale-publish trap: a handler that changes the stage and only then publishes what it computed
 * before the change shows the previous stage's numbers under the new stage's picture.
 */
describe('the command channel', () => {
  it('publishes the new stage immediately, not on the next frame', () => {
    scene.runCommand({ type: 'next' })
    expect(lastState().index).toBe(1)
    expect(lastState().radiusSolar).toBe(STAGES[1]!.radiusSolar)
    expect(readouts[readouts.length - 1]?.key).toBe(STAGES[1]!.readoutKey)
  })

  it('steps forward and back, and stops at both ends', () => {
    scene.runCommand({ type: 'previous' })
    expect(lastState().index).toBe(0)
    for (let step = 0; step < STAGES.length + 4; step += 1) scene.runCommand({ type: 'next' })
    expect(lastState().index).toBe(STAGES.length - 1)
    expect(lastState().playing).toBe(false)
  })

  it('clamps a stage index from the panel', () => {
    scene.runCommand({ type: 'stage', index: 99 })
    expect(lastState().index).toBe(STAGES.length - 1)
    scene.runCommand({ type: 'stage', index: -4 })
    expect(lastState().index).toBe(0)
  })

  it('plays, pauses, toggles and restarts', () => {
    scene.runCommand({ type: 'pause' })
    expect(lastState().playing).toBe(false)
    scene.runCommand({ type: 'toggle-playing' })
    expect(lastState().playing).toBe(true)
    scene.runCommand({ type: 'toggle-playing' })
    expect(lastState().playing).toBe(false)
    scene.runCommand({ type: 'play' })
    expect(lastState().playing).toBe(true)
    scene.runCommand({ type: 'stage', index: 5 })
    scene.runCommand({ type: 'restart' })
    expect(lastState().index).toBe(0)
    expect(lastState().playing).toBe(true)
  })

  it('tells the shell about a resolved play state, so the shared controls agree', () => {
    scene.runCommand({ type: 'pause' })
    expect(resolved[resolved.length - 1]).toEqual({ playing: false })
    scene.runCommand({ type: 'play' })
    expect(resolved[resolved.length - 1]).toEqual({ playing: true })
  })

  it('toggles the labels off, publishing an empty set and reporting the setting', () => {
    scene.runCommand({ type: 'toggle-labels' })
    expect(lastState().showLabels).toBe(false)
    expect(labels[labels.length - 1]).toEqual([])
    expect(resolved[resolved.length - 1]).toEqual({ showLabels: false })
    scene.runCommand({ type: 'toggle-labels' })
    expect(lastState().showLabels).toBe(true)
    expect(labels[labels.length - 1]!.length).toBeGreaterThan(0)
  })

  it('ignores anything that is not one of its commands', () => {
    const before = states.length
    for (const value of [null, undefined, 42, 'next', {}, { type: 'nope' }, { type: 7 }]) {
      scene.runCommand(value)
    }
    expect(states.length).toBe(before)
    expect(lastState().index).toBe(0)
  })
})

describe('the frame loop', () => {
  it('keeps a rapid manual jump continuous from the shape already on screen', () => {
    scene.runCommand({ type: 'pause' })
    scene.runCommand({ type: 'stage', index: 2 })
    runFrames(1.3)
    scene.runCommand({ type: 'stage', index: 3 })
    runFrames(.35)
    const radius = find('core').scale.x
    scene.runCommand({ type: 'stage', index: 5 })
    expect(find('core').scale.x).toBe(radius)
    runFrames(1.3)
    expect(find('core').scale.x).toBeCloseTo(STAGE_VISUALS['white-dwarf'].coreRadius)
  })

  it('lets the explosion flash fade into a remnant even when autoplay is paused', () => {
    scene.runCommand({ type: 'pause' })
    scene.runCommand({ type: 'stage', index: 6 })
    runFrames(1.3)
    const flash = find('supernovaFlash') as THREE.Sprite
    const bright = flash.material.opacity
    runFrames(8)
    expect(flash.material.opacity).toBeLessThan(bright * .05)
    expect(find('gasEnvelope').visible).toBe(true)
    expect(lastState().index).toBe(6)
  })

  it('removes shell gas and field overlays when jumping between unrelated stages', () => {
    scene.runCommand({ type: 'pause' })
    scene.runCommand({ type: 'stage', index: 4 })
    runFrames(1.3)
    expect(find('gasEnvelope').visible).toBe(true)
    scene.runCommand({ type: 'stage', index: 7 })
    runFrames(1.3)
    expect(find('gasEnvelope').visible).toBe(false)
    expect(find('magneticField').visible).toBe(true)
    scene.runCommand({ type: 'stage', index: 1 })
    runFrames(1.3)
    expect(find('magneticField').visible).toBe(false)
  })

  it('places both beam apexes at the star rather than pointing their wide ends inward', () => {
    const beams = find('beams')
    for (const cone of beams.children.filter((child) => child instanceof THREE.Mesh)) {
      cone.updateMatrix()
      const geometry = (cone as THREE.Mesh<THREE.ConeGeometry>).geometry
      const apex = new THREE.Vector3(0, geometry.parameters.height / 2, 0).applyMatrix4(cone.matrix)
      expect(apex.length()).toBeLessThan(1e-6)
    }
  })

  it('advances the stage once the dwell is used up', () => {
    runFrames(1)
    expect(lastState().index).toBe(0)
    // The molecular cloud's dwell, plus a margin.
    runFrames(STAGES[0]!.dwellMs / 1000 + 0.5)
    expect(lastState().index).toBe(1)
  })

  it('does not advance while paused, but keeps the drawing responsive', () => {
    scene.runCommand({ type: 'pause' })
    runFrames(30)
    expect(lastState().index).toBe(0)
    expect(lastState().playing).toBe(false)
  })

  it('morphs the drawing into the new stage over the transition', () => {
    const core = find('core')
    scene.runCommand({ type: 'stage', index: 3 })
    // Straight after the command the drawing is still on the way out of the old stage.
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    expect(core.scale.x).toBeCloseTo(STAGE_VISUALS['red-giant'].coreRadius, 4)
  })

  it('swells the star from the main sequence to the red giant and shrinks it to the white dwarf', () => {
    const core = find('core')
    scene.runCommand({ type: 'stage', index: 2 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    const onMainSequence = core.scale.x
    scene.runCommand({ type: 'stage', index: 3 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    const asRedGiant = core.scale.x
    scene.runCommand({ type: 'stage', index: 5 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    const asWhiteDwarf = core.scale.x
    expect(asRedGiant).toBeGreaterThan(onMainSequence * 2)
    expect(asWhiteDwarf).toBeLessThan(onMainSequence / 2)
  })

  it('hides the core inside a molecular cloud and shows it once the protostar forms', () => {
    const core = find('core')
    scene.runCommand({ type: 'stage', index: 0 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    expect(core.visible).toBe(false)
    scene.runCommand({ type: 'stage', index: 1 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    expect(core.visible).toBe(true)
  })

  it('shows the reference circle everywhere but the main sequence, where the body is the reference', () => {
    const ring = find('referenceRing')
    scene.runCommand({ type: 'stage', index: 2 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    expect(ring.visible).toBe(false)
    scene.runCommand({ type: 'stage', index: 3 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    expect(ring.visible).toBe(true)
  })

  it('lights the photon ring only for the black hole', () => {
    const ring = find('photonRing')
    scene.runCommand({ type: 'stage', index: 7 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    expect(ring.visible).toBe(false)
    scene.runCommand({ type: 'stage', index: 8 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    expect(ring.visible).toBe(true)
  })
})

describe('labels', () => {
  it('keeps black-hole captions attached to the optical image around the full orbit', () => {
    const stage = vi.mocked(createStage).mock.results[0]!.value
    scene.runCommand({ type: 'stage', index: 8 })
    scene.runCommand({ type: 'pause' })
    runFrames(1.3)
    const baseline = labels[labels.length - 1]!.map(({ id, x, y }) => ({ id, x, y }))
    for (let i = 0; i < baseline.length; i++) {
      for (const other of baseline.slice(i + 1)) {
        expect(Math.abs(baseline[i]!.x - other.x) >= 180 || Math.abs(baseline[i]!.y - other.y) >= 30).toBe(true)
      }
    }
    const distance = stage.camera.position.length()
    for (const [elevation, azimuth] of [[10, 90], [10, 180], [10, 270], [85, 45], [-45, 120]]) {
      const phi = THREE.MathUtils.degToRad(elevation!)
      const theta = THREE.MathUtils.degToRad(azimuth!)
      stage.camera.position.set(
        distance * Math.cos(phi) * Math.sin(theta),
        distance * Math.sin(phi),
        distance * Math.cos(phi) * Math.cos(theta),
      )
      stage.camera.lookAt(0, 0, 0)
      stage.camera.updateMatrixWorld(true)
      runFrames(.1)
      for (const expected of baseline) {
        const actual = labels[labels.length - 1]!.find((label) => label.id === expected.id)!
        expect(actual.visible).toBe(true)
        expect(actual.x).toBeCloseTo(expected.x, 4)
        expect(actual.y).toBeCloseTo(expected.y, 4)
      }
    }
  })

  it('separates compact-remnant captions on a narrow viewport', () => {
    const stage = vi.mocked(createStage).mock.results[0]!.value
    Object.defineProperty(stage.renderer.domElement, 'clientWidth', { value: 390 })
    Object.defineProperty(stage.renderer.domElement, 'clientHeight', { value: 740 })
    stage.camera.aspect = 390 / 740
    stage.camera.updateProjectionMatrix()
    scene.runCommand({ type: 'pause' })
    for (const index of [5, 7]) {
      scene.runCommand({ type: 'stage', index })
      runFrames(1.3)
      const visible = labels[labels.length - 1]!.filter((label) => label.visible)
      for (let i = 0; i < visible.length; i += 1) {
        for (let j = i + 1; j < visible.length; j += 1) {
          expect(Math.abs(visible[i]!.x - visible[j]!.x) >= 180 || Math.abs(visible[i]!.y - visible[j]!.y) >= 30).toBe(true)
        }
      }
    }
  })

  it('publishes the current stage\'s labels with a name and an explanation each', () => {
    scene.runCommand({ type: 'stage', index: 2 })
    const published = labels[labels.length - 1]!
    expect(published.map((anchor) => anchor.id)).toEqual(STAGES[2]!.labels.map((label) => label.id))
    for (const anchor of published) {
      expect(anchor.textKey).toContain('stellarEvolution.labels.')
      expect(anchor.descriptionKey).toContain('About')
      expect(typeof anchor.x).toBe('number')
      expect(typeof anchor.y).toBe('number')
    }
  })

  it('holds the new captions back until the morph is past halfway', () => {
    scene.runCommand({ type: 'stage', index: 6 })
    // The ids are the target stage's from the instant the stage changes, so the panel's card and
    // the published set always agree...
    const published = labels[labels.length - 1]!
    expect(published.map((anchor) => anchor.id)).toEqual(STAGES[6]!.labels.map((label) => label.id))
    // ...but they are not shown until the drawing has mostly become the new stage.
    expect(published.every((anchor) => !anchor.visible)).toBe(true)
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    expect(labels[labels.length - 1]!.every((anchor) => anchor.visible)).toBe(true)
  })

  it('keeps every label id stable, so the shell never has to rebuild its nodes', () => {
    const ids = new Set<string>()
    for (let index = 0; index < STAGES.length; index += 1) {
      scene.runCommand({ type: 'stage', index })
      runFrames(0.2)
      for (const anchor of labels[labels.length - 1]!) {
        expect(anchor.id.length).toBeGreaterThan(0)
        ids.add(anchor.id)
      }
    }
    expect(ids.size).toBe(28)
  })

  /**
   * Two placement faults that a DOM dump cannot see and a screenshot only shows as a caption that
   * is simply not there. Both were found by looking at the rendered page.
   */
  it('keeps every caption inside the frame vertically', () => {
    for (let index = 0; index < STAGES.length; index += 1) {
      scene.runCommand({ type: 'stage', index })
      runFrames(SCENE.transitionMs / 1000 + 0.1)
      for (const anchor of labels[labels.length - 1]!) {
        if (!anchor.visible) continue
        // The shell draws a label above its anchor and does not clamp vertically, so an anchor past
        // the top of the stage means the caption is eaten by the stage's `overflow: hidden`. The
        // molecular cloud, the supernova and the red giant all did this before the clamp.
        expect(anchor.y, `${STAGES[index]!.id}/${anchor.id} at y=${anchor.y}`).toBeGreaterThan(0)
        expect(anchor.y, `${STAGES[index]!.id}/${anchor.id} at y=${anchor.y}`).toBeLessThan(STAGE_HEIGHT)
      }
    }
  })

  it('keeps every caption inside the band of the stage the panels do not cover', () => {
    const halfWidth = SCENE.frameHalfHeight * STAGE_ASPECT
    const toScene = (fraction: number): number => (fraction * 2 - 1) * halfWidth
    const left = toScene(SCENE.labelSafeBand.left)
    const right = toScene(SCENE.labelSafeBand.right)
    for (let index = 0; index < STAGES.length; index += 1) {
      scene.runCommand({ type: 'stage', index })
      runFrames(SCENE.transitionMs / 1000 + 0.1)
      for (const anchor of labels[labels.length - 1]!) {
        if (!anchor.visible) continue
        // Back from stage pixels into the scene units the clamp is expressed in.
        const sceneX = (((anchor.x / STAGE_WIDTH) * 2) - 1) * halfWidth
        expect(sceneX, `${STAGES[index]!.id}/${anchor.id}`).toBeGreaterThanOrEqual(left - 1e-6)
        expect(sceneX, `${STAGES[index]!.id}/${anchor.id}`).toBeLessThanOrEqual(right + 1e-6)
      }
    }
  })

  it('does not caption the reference circle on the stage where it is not drawn', () => {
    scene.runCommand({ type: 'stage', index: 2 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    const onMainSequence = labels[labels.length - 1]!.find((anchor) => anchor.id === 'referenceCircle')
    expect(onMainSequence).toBeDefined()
    expect(onMainSequence!.visible).toBe(false)
    scene.runCommand({ type: 'stage', index: 3 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    expect(labels[labels.length - 1]!.find((anchor) => anchor.id === 'referenceCircle')!.visible).toBe(true)
  })

  it('separates the captions on a body too small to hang three of them on', () => {
    // A neutron star's drawn radius is a tenth of a unit, so without the minimum the three captions
    // would land on the same few pixels.
    scene.runCommand({ type: 'stage', index: 7 })
    runFrames(SCENE.transitionMs / 1000 + 0.1)
    const visible = labels[labels.length - 1]!.filter((anchor) => anchor.visible)
    expect(visible.length).toBe(STAGES[7]!.labels.length)
    for (const first of visible) {
      for (const second of visible) {
        if (first.id === second.id) continue
        expect(Math.hypot(first.x - second.x, first.y - second.y), `${first.id} vs ${second.id}`)
          .toBeGreaterThan(40)
      }
    }
  })
})

describe('lifecycle', () => {
  it('honours the shared play setting', () => {
    scene.applySettings({ playing: false })
    expect(lastState().playing).toBe(false)
    runFrames(30)
    expect(lastState().index).toBe(0)
    scene.applySettings({ playing: true })
    expect(lastState().playing).toBe(true)
  })

  it('stops and restarts the render loop when suspended', () => {
    scene.setSuspended(true)
    expect(stopSpy).toHaveBeenCalled()
    scene.setSuspended(false)
    expect(startSpy).toHaveBeenCalled()
  })

  it('releases the stage once, and ignores everything after', () => {
    scene.dispose()
    scene.dispose()
    expect(disposeSpy).toHaveBeenCalledTimes(1)
    const before = states.length
    scene.runCommand({ type: 'next' })
    expect(states.length).toBe(before)
  })

  it('leaves the frame handler inert after disposal', () => {
    scene.dispose()
    const before = states.length
    runFrames(2)
    expect(states.length).toBe(before)
  })
})
