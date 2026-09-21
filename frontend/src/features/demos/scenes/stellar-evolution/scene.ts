import * as THREE from 'three'
import { createGlowSprite, createStarburstSprite } from '../../engine/glow'
import { createStage, type Stage } from '../../engine/stage'
import { createStarfield } from '../../engine/starfield'
import type {
  DemoLabelAnchor,
  DemoScene,
  DemoSceneOptions,
  DemoSceneSettings,
} from '../../types'
import {
  createBeams,
  createCore,
  createDisk,
  createOccluder,
  createParticleShell,
  createReferenceRing,
} from './bodies'
import { createBlackHoleImage, createGasEnvelope, createMagneticField, updatePhotosphere } from './materials'
import { SCENE } from './config'
import { stageAt, stageCount } from './stages'
import {
  advanceTimeline,
  createTimeline,
  goToStage,
  nextStage,
  previousStage,
  restartTimeline,
  setPlaying,
  transitionProgress,
  type TimelineState,
} from './timeline'
import { isStellarEvolutionCommand, type StageLabelAnchor } from './types'
import {
  easeInOutCubic,
  lerpVisual,
  REFERENCE_RADIUS,
  STAGE_VISUALS,
  type StageVisual,
} from './visuals'

/**
 * The stellar-evolution demo.
 *
 * One set of shapes is drawn for every stage and driven by `visuals.ts`, so a stage change is a
 * continuous morph of the whole picture: the red giant visibly swells out of the main sequence,
 * the planetary nebula's shell closes over it, and the white dwarf shrinks to a dot inside a ring
 * that never moves. That ring is the point of the demo's honesty - see `createReferenceRing`.
 *
 * The scene owns the timeline and publishes it; the panel owns the buttons and sends commands. The
 * shared shell carries both across without reading either.
 */
export class StellarEvolutionScene implements DemoScene {
  private readonly stage: Stage
  private readonly starfield: THREE.Group

  private readonly core: THREE.Mesh
  private readonly coreMaterial: THREE.MeshBasicMaterial
  private readonly occluder: THREE.Mesh
  private readonly occluderMaterial: THREE.MeshBasicMaterial
  private readonly cloud: THREE.Points
  private readonly cloudMaterial: THREE.PointsMaterial
  /**
   * The same cloud, distributed through a shell instead of a volume.
   *
   * A molecular cloud is filled; a planetary nebula and a supernova remnant are hollow, and a filled
   * one reads as a scattered field rather than as a ring around the star. The two buffers share
   * every property but their particle positions, so only the opacity decides which is on screen.
   */
  private readonly shell: THREE.Points
  private readonly shellMaterial: THREE.PointsMaterial
  private readonly disk: THREE.Mesh
  private readonly diskMaterial: THREE.MeshBasicMaterial
  private readonly beams: THREE.Group
  private readonly beamMaterials: THREE.MeshBasicMaterial[] = []
  private readonly photonRing: THREE.Mesh
  private readonly photonRingMaterial: THREE.ShaderMaterial
  private readonly gasEnvelope: THREE.Group
  private readonly magneticField: THREE.Group
  private readonly referenceRing: THREE.Mesh
  private readonly referenceMaterial: THREE.MeshBasicMaterial
  private readonly halo: THREE.Sprite
  private readonly haloMaterial: THREE.SpriteMaterial
  private readonly flash: THREE.Sprite
  private readonly flashMaterial: THREE.SpriteMaterial

  private timeline: TimelineState = createTimeline(0)
  /** The look being morphed away from, and the look actually on screen last frame. */
  private fromVisual: StageVisual = STAGE_VISUALS['molecular-cloud']
  /** The stage on screen, so a change can be spotted and the morph restarted from where it is. */
  private drawnStageIndex = 0
  private visual: StageVisual = STAGE_VISUALS['molecular-cloud']
  private showLabels = true
  private pulsePhase = 0
  private actionPhase = 0
  private labelAccumulator = 0
  private lastPublishedBucket = -1
  /** The last play state the shell was told about, so it is told once per change and not per frame. */
  private reportedPlaying = true
  private disposed = false
  private framingScale = 1

  constructor(container: HTMLElement, private readonly options: DemoSceneOptions = {}) {
    const aspect = container.clientWidth / Math.max(1, container.clientHeight)
    const framing = aspect > 0 ? Math.max(1, .95 / aspect) : 1
    this.framingScale = framing
    const homePosition = new THREE.Vector3(...SCENE.cameraPosition).multiplyScalar(framing)
    this.stage = createStage(container, {
      cameraPosition: homePosition,
      target: new THREE.Vector3(...SCENE.target),
      fov: SCENE.fieldOfView,
      near: SCENE.near,
      far: SCENE.far,
      minDistance: SCENE.minDistance,
      maxDistance: SCENE.maxDistance * framing,
      background: 0x03060d,
    })
    this.stage.setHomeView(homePosition, new THREE.Vector3(...SCENE.target))

    this.starfield = createStarfield({ radius: 900, count: 900, pixelRatio: Math.min(window.devicePixelRatio || 1, 2) })
    this.stage.scene.add(this.starfield)

    this.core = createCore()
    this.coreMaterial = this.core.material as THREE.MeshBasicMaterial
    this.occluder = createOccluder()
    this.occluderMaterial = this.occluder.material as THREE.MeshBasicMaterial
    this.cloud = createParticleShell({ name: 'cloud' })
    this.cloudMaterial = this.cloud.material as THREE.PointsMaterial
    this.shell = createParticleShell({ hollow: true, seed: 0x5eed1e, name: 'shell' })
    this.shellMaterial = this.shell.material as THREE.PointsMaterial
    this.disk = createDisk()
    this.diskMaterial = this.disk.material as THREE.MeshBasicMaterial
    this.beams = createBeams()
    for (const child of this.beams.children) {
      this.beamMaterials.push((child as THREE.Mesh).material as THREE.MeshBasicMaterial)
    }
    this.photonRing = createBlackHoleImage()
    this.photonRing.name = 'photonRing'
    this.photonRingMaterial = this.photonRing.material as THREE.ShaderMaterial
    this.gasEnvelope = createGasEnvelope()
    this.magneticField = createMagneticField()
    this.beams.add(this.magneticField)
    this.referenceRing = createReferenceRing()
    this.referenceMaterial = this.referenceRing.material as THREE.MeshBasicMaterial
    this.halo = createGlowSprite({ size: 1 })
    this.haloMaterial = this.halo.material as THREE.SpriteMaterial
    this.flash = createStarburstSprite({ size: 1 })
    this.flash.name = 'supernovaFlash'
    this.flashMaterial = this.flash.material as THREE.SpriteMaterial

    // Order matters only for the opaque core and its dust veil: the veil is the front hemisphere of
    // a larger sphere, so it has to be a separate object to be drawn over the core.
    this.stage.scene.add(
      this.cloud,
      this.shell,
      this.gasEnvelope,
      this.disk,
      this.referenceRing,
      this.core,
      this.occluder,
      this.photonRing,
      this.beams,
      this.halo,
      this.flash,
    )

    this.applyVisual(STAGE_VISUALS['molecular-cloud'])
    this.stage.setFrameHandler((delta) => this.update(delta))
    this.stage.start()

    // Publish before the first frame so the panel has a stage to draw, and so a headless render
    // that never runs a frame still shows the demo's opening state rather than an empty panel.
    this.refresh()
  }

  // ---------------------------------------------------------------- demo scene API

  /**
   * Only the shared transport and the label switch are read here.
   *
   * `timeScale` is deliberately ignored: this demo's timeline is a sequence of stages rather than a
   * clock, so there is no rate for a speed slider to drive. Autoplay's pace is the per-stage dwell
   * in `config.ts`, and the panel owns the controls for it.
   */
  applySettings(settings: Partial<DemoSceneSettings>): void {
    if (this.disposed) return
    if (typeof settings.playing === 'boolean' && settings.playing !== this.timeline.playing) {
      this.timeline = setPlaying(this.timeline, settings.playing)
      this.publishState()
    }
    if (typeof settings.showLabels === 'boolean') this.showLabels = settings.showLabels
  }

  resetView(): void {
    this.stage.resetView()
  }

  setSuspended(suspended: boolean): void {
    if (suspended) this.stage.stop()
    else this.stage.start()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    // Everything the demo added is in the scene graph, so the stage's own walk disposes it all.
    this.stage.dispose()
  }

  runCommand(command: unknown): void {
    if (this.disposed) return
    if (!isStellarEvolutionCommand(command)) return
    switch (command.type) {
      case 'stage':
        this.timeline = goToStage(this.timeline, command.index)
        break
      case 'next':
        this.timeline = nextStage(this.timeline)
        break
      case 'previous':
        this.timeline = previousStage(this.timeline)
        break
      case 'play':
        this.timeline = setPlaying(this.timeline, true)
        break
      case 'pause':
        this.timeline = setPlaying(this.timeline, false)
        break
      case 'toggle-playing':
        this.timeline = setPlaying(this.timeline, !this.timeline.playing)
        break
      case 'restart':
        this.timeline = restartTimeline(this.timeline)
        break
      case 'toggle-labels':
        this.showLabels = !this.showLabels
        this.options.onSettingsResolved?.({ showLabels: this.showLabels })
        break
      case 'reset-view':
        this.resetView()
        return
      default:
        return
    }
    // Recompute and republish now rather than waiting for the next frame: the panel's card and the
    // readout under the stage must agree with the button that was just pressed, and a headless run
    // barely advances `requestAnimationFrame` at all.
    this.refresh()
  }

  // ---------------------------------------------------------------- frame loop

  private update(deltaSeconds: number): void {
    if (this.disposed) return
    const framing = Math.max(1, .95 / this.stage.camera.aspect)
    if (Math.abs(framing - this.framingScale) > .001) {
      // Preserve the viewer's orbit and zoom when rotating a phone or resizing the preview.
      this.stage.camera.position.multiplyScalar(framing / this.framingScale)
      this.stage.controls.maxDistance = SCENE.maxDistance * framing
      this.stage.setHomeView(new THREE.Vector3(...SCENE.cameraPosition).multiplyScalar(framing), new THREE.Vector3(...SCENE.target))
      this.framingScale = framing
    }
    this.timeline = advanceTimeline(this.timeline, deltaSeconds * 1000)
    this.pulsePhase += deltaSeconds
    this.actionPhase += deltaSeconds
    this.labelAccumulator += deltaSeconds

    const target = STAGE_VISUALS[stageAt(this.timeline.index).id]
    if (this.timeline.index !== this.drawnStageIndex) {
      // Morph from whatever is on screen, not from the previous stage's nominal look: clicking
      // through three stages quickly should not snap the drawing back to the second one.
      this.fromVisual = this.visual
      this.drawnStageIndex = this.timeline.index
      this.publishReadout()
    }
    const eased = easeInOutCubic(transitionProgress(this.timeline))
    this.visual = eased >= 1 ? target : lerpVisual(this.fromVisual, target, eased)
    this.applyVisual(this.visual, deltaSeconds)

    this.applyStageMotion(deltaSeconds)

    // The beams sweep with the star, which is what makes a pulsar flash rather than shine.
    this.beams.rotation.y += this.visual.spinRate * deltaSeconds
    this.disk.rotation.z += 0.22 * deltaSeconds
    this.cloud.rotation.y += 0.02 * deltaSeconds
    this.shell.rotation.y = this.cloud.rotation.y

    if (this.labelAccumulator >= 1 / 30) {
      this.labelAccumulator = 0
      this.publishLabels()
    }
    this.reportPlaying()
    this.publishStateIfDue()
  }

  private applyVisual(visual: StageVisual, deltaSeconds = 0): void {
    const pulse = visual.pulseDepth === 0
      ? 1
      : 1 + visual.pulseDepth * Math.sin(this.pulsePhase * visual.pulseRate)
    // Give every stage morph a restrained energy cue. The scene is interpolating radius, colour
    // and shell density already; this short-lived lift makes the hand-off legible without turning
    // ordinary transitions into a supernova flash.
    const transition = transitionProgress(this.timeline)
    const transitionLift = transition < 1 ? 0.14 * Math.sin(Math.PI * transition) : 0

    this.core.visible = visual.coreVisible
    this.core.scale.setScalar(Math.max(visual.coreRadius, 0.001))
    this.coreMaterial.color.setHex(visual.coreColor)
    updatePhotosphere(this.coreMaterial, this.actionPhase, visual.coreRadius)
    if (pulse !== 1) this.coreMaterial.color.multiplyScalar(pulse)
    if (deltaSeconds > 0) this.core.rotation.y += visual.spinRate * deltaSeconds

    this.occluder.visible = visual.occluderOpacity > 0.002
    this.occluder.scale.setScalar(Math.max(visual.occluderRadius, 0.001))
    this.occluderMaterial.opacity = visual.occluderOpacity

    this.halo.visible = visual.haloOpacity > 0.002
    this.haloMaterial.opacity = visual.haloOpacity * (pulse + transitionLift)
    this.haloMaterial.color.setHex(visual.haloColor)
    this.halo.scale.set(visual.haloScale, visual.haloScale, 1)

    this.cloud.visible = visual.cloudOpacity > 0.002 && visual.cloudRadius > 0.02
    this.cloudMaterial.opacity = visual.cloudOpacity
    this.cloudMaterial.color.setHex(visual.cloudColor)
    this.cloudMaterial.size = visual.cloudSize
    this.cloud.rotation.x = visual.cloudTilt
    this.cloud.scale.set(
      visual.cloudRadius,
      visual.cloudRadius * (1 - visual.cloudFlatten),
      visual.cloudRadius,
    )

    this.shell.visible = visual.cloudShellOpacity > 0.002 && visual.cloudRadius > 0.02
    this.shellMaterial.opacity = visual.cloudShellOpacity * .18
    this.shellMaterial.color.setHex(visual.cloudColor)
    this.shellMaterial.size = visual.cloudSize
    this.shell.rotation.x = visual.cloudTilt
    this.shell.scale.copy(this.cloud.scale)

    this.gasEnvelope.visible = this.shell.visible
    this.gasEnvelope.scale.copy(this.cloud.scale)
    this.gasEnvelope.rotation.copy(this.shell.rotation)
    for (const child of this.gasEnvelope.children) {
      const material = (child as THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>).material
      material.uniforms.opacity!.value = visual.cloudShellOpacity
      material.uniforms.time!.value = this.actionPhase
      material.uniforms.explosion!.value = visual.flashOpacity / STAGE_VISUALS.supernova.flashOpacity
    }

    this.disk.visible = visual.diskOpacity > 0.002 && visual.diskRadius > 0.02
    this.diskMaterial.opacity = visual.diskOpacity * (1 - visual.photonRingOpacity / .95)
    this.diskMaterial.userData.diskTime.value = this.actionPhase
    this.diskMaterial.color.setHex(visual.diskColor)
    this.disk.scale.setScalar(Math.max(visual.diskRadius, 0.001))

    this.beams.visible = visual.beamOpacity > 0.002
    this.beams.scale.setScalar(Math.max(visual.beamScale, 0.01))
    for (const material of this.beamMaterials) {
      material.opacity = visual.beamOpacity
      material.color.setHex(visual.beamColor)
    }
    const fieldOpacity = visual.beamOpacity * (1 - Math.min(1, visual.occluderOpacity * 4)) * .3
    this.magneticField.visible = fieldOpacity > .002
    for (const child of this.magneticField.children) {
      (child as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>).material.opacity = fieldOpacity
    }

    this.photonRing.visible = visual.photonRingOpacity > 0.002
    this.photonRingMaterial.uniforms.opacity!.value = visual.photonRingOpacity
    this.photonRingMaterial.uniforms.time!.value = this.actionPhase
    // Apparent Schwarzschild shadow radius is sqrt(27)/2 times the horizon radius.
    this.photonRingMaterial.uniforms.shadow!.value = Math.min(.42, visual.coreRadius * 2.598 / Math.max(.01, visual.diskRadius))
    // The black-hole disk has a fixed world-Y axis, independent of the tilted
    // protostar mesh. Its shader reads the render camera after controls update.
    this.photonRing.scale.setScalar(Math.max(visual.diskRadius, .001))

    this.referenceRing.visible = visual.referenceOpacity > 0.002
    this.referenceMaterial.opacity = visual.referenceOpacity
    this.referenceRing.quaternion.copy(this.stage.camera.quaternion)

    this.flash.visible = visual.flashOpacity > 0.002
    this.flashMaterial.opacity = visual.flashOpacity * (0.72 + 0.28 * pulse)
    this.flash.scale.set(visual.haloScale * 1.7, visual.haloScale * 1.7, 1)
  }

  /** Stage-specific motion cues make each hand-off readable even when the viewer pauses. */
  private applyStageMotion(deltaSeconds: number): void {
    const stageId = stageAt(this.timeline.index).id
    const breath = Math.sin(this.actionPhase * 1.15)
    // Reset transient offsets before applying the active stage's cue, so a manual jump never
    // carries a protostellar wobble into a later remnant.
    this.cloud.position.set(0, 0, 0)
    this.shell.position.set(0, 0, 0)
    this.shell.rotation.z = 0
    this.cloud.rotation.z = 0
    this.beams.rotation.x = 0
    this.beams.rotation.z = 0.42
    if (stageId === 'molecular-cloud') {
      this.cloud.rotation.z = 0.03 * Math.sin(this.actionPhase * 0.32)
      this.cloud.position.set(0.04 * Math.sin(this.actionPhase * 0.7), 0.03 * Math.cos(this.actionPhase * 0.55), 0)
    } else if (stageId === 'protostar') {
      this.beams.rotation.set(this.disk.rotation.x + Math.PI / 2, 0, 0)
      this.disk.rotation.z += deltaSeconds * 0.85
      this.disk.scale.y = this.visual.diskRadius * (0.98 + 0.02 * Math.sin(this.actionPhase * 1.4))
      this.beams.scale.y = this.visual.beamScale * (0.98 + 0.02 * Math.sin(this.actionPhase * 2.1))
    } else if (stageId === 'main-sequence') {
      this.halo.scale.setScalar(this.visual.haloScale * (1 + 0.012 * Math.sin(this.actionPhase * 3.6)))
      this.cloud.position.set(0, 0, 0)
    } else if (stageId === 'red-giant') {
      this.halo.scale.setScalar(this.visual.haloScale * (1 + 0.04 * breath))
      this.cloud.scale.set(
        this.visual.cloudRadius * (1 + 0.025 * breath),
        this.visual.cloudRadius * (1 - this.visual.cloudFlatten) * (1 + 0.025 * breath),
        this.visual.cloudRadius * (1 + 0.025 * breath),
      )
    } else if (stageId === 'planetary-nebula') {
      const expansion = 1 + .06 * Math.min(1, this.timeline.sinceChangeMs / 10000)
      this.shell.scale.set(
        this.visual.cloudRadius * expansion,
        this.visual.cloudRadius * (1 - this.visual.cloudFlatten) * expansion,
        this.visual.cloudRadius * expansion,
      )
      this.shell.rotation.z = 0.04 * Math.sin(this.actionPhase * 0.4)
    } else if (stageId === 'white-dwarf') {
      this.haloMaterial.opacity = this.visual.haloOpacity * (0.9 + 0.1 * Math.sin(this.actionPhase * 0.7))
    } else if (stageId === 'supernova') {
      const shock = 1 + 0.09 * Math.min(1, this.timeline.elapsedMs / 1800)
      this.shell.scale.set(
        this.visual.cloudRadius * shock,
        this.visual.cloudRadius * (1 - this.visual.cloudFlatten) * shock,
        this.visual.cloudRadius * shock,
      )
      const fade = Math.exp(-Math.max(0, this.timeline.sinceChangeMs - SCENE.transitionMs) / 1700)
      this.flashMaterial.opacity *= fade
      this.haloMaterial.opacity *= .16 + .84 * fade
    } else if (stageId === 'neutron-star') {
      this.beams.rotation.z = 0.42 + 0.06 * Math.sin(this.actionPhase * 2.2)
      this.beamMaterials.forEach((material, index) => {
        material.opacity = this.visual.beamOpacity * (0.84 + 0.16 * Math.sin(this.actionPhase * 9 + index * Math.PI))
      })
    } else if (stageId === 'black-hole') {
      this.disk.rotation.z += deltaSeconds * 0.9
    }
    if (this.gasEnvelope.visible) {
      this.gasEnvelope.scale.copy(this.shell.scale)
      this.gasEnvelope.rotation.copy(this.shell.rotation)
    }
  }

  // ---------------------------------------------------------------- publishing

  /**
   * Recomputes everything derived from the timeline and pushes it out.
   *
   * Called from every command as well as from the frame loop, so a button press is reflected in the
   * panel and in the drawing immediately rather than one frame later.
   */
  private refresh(): void {
    // Capture the actual on-screen shape before resetting a transition. This also handles
    // several clicks between frames and selecting the current stage again without snapping.
    if (this.timeline.sinceChangeMs === 0) {
      this.fromVisual = this.visual
      this.drawnStageIndex = this.timeline.index
    }
    const target = STAGE_VISUALS[stageAt(this.timeline.index).id]
    const eased = easeInOutCubic(transitionProgress(this.timeline))
    this.visual = eased >= 1 ? target : lerpVisual(this.fromVisual, target, eased)
    this.applyVisual(this.visual)
    this.publishState()
    this.publishReadout()
    this.publishLabels()
    this.reportPlaying()
  }

  /**
   * Tells the shell when the play state changes, so its shared controls agree with the panel.
   *
   * Two things move it: a command from the panel, and autoplay reaching the end of the sequence.
   * Reporting it only on the change keeps the shell from re-rendering on every frame.
   */
  private reportPlaying(): void {
    if (this.timeline.playing === this.reportedPlaying) return
    this.reportedPlaying = this.timeline.playing
    this.options.onSettingsResolved?.({ playing: this.reportedPlaying })
  }

  private snapshot() {
    const stage = stageAt(this.timeline.index)
    return {
      index: this.timeline.index,
      stageId: stage.id,
      track: stage.track,
      playing: this.timeline.playing,
      elapsedMs: this.timeline.elapsedMs,
      dwellMs: stage.dwellMs,
      showLabels: this.showLabels,
      stageCount: stageCount(),
      radiusSolar: stage.radiusSolar,
      temperatureK: stage.temperatureK,
      durationYears: stage.durationYears,
      massSolar: stage.massSolar,
    }
  }

  private publishState(): void {
    const state = this.snapshot()
    this.lastPublishedBucket = Math.floor(state.elapsedMs / STATE_PUBLISH_INTERVAL_MS)
    this.options.onState?.(state)
  }

  /**
   * Republish while something is actually moving.
   *
   * The panel's progress bar needs the elapsed time, but publishing every frame would re-render it
   * sixty times a second for a bar that moves over several seconds. Ten times a second is smooth to
   * the eye and quiet to Vue; a paused timeline that has finished its morph publishes nothing at
   * all, because nothing about it is changing.
   */
  private publishStateIfDue(): void {
    if (this.lastPublishedBucket === -1) return
    const bucket = Math.floor(this.timeline.elapsedMs / STATE_PUBLISH_INTERVAL_MS)
    const stillMoving = this.timeline.playing
      || transitionProgress(this.timeline) < 1
    if (!stillMoving || bucket === this.lastPublishedBucket) return
    this.publishState()
  }

  private publishReadout(): void {
    this.options.onReadout?.({ key: stageAt(this.timeline.index).readoutKey })
  }

  private publishLabels(): void {
    const anchors = this.options.onLabels
    if (!anchors) return
    if (!this.showLabels) {
      anchors([])
      return
    }
    // The captions are always the *target* stage's, so the published set and the panel's card agree
    // from the instant the stage changes. Their appearance is what waits: they are held back until
    // the morph is past halfway, so the new caption does not land on the old body.
    const eased = easeInOutCubic(transitionProgress(this.timeline))
    const stage = stageAt(this.timeline.index)
    const width = this.stage.renderer.domElement.clientWidth
    const height = this.stage.renderer.domElement.clientHeight
    const published: DemoLabelAnchor[] = []
    for (const label of stage.labels) {
      const point = stage.id === 'black-hole'
        ? this.blackHoleLabelPosition(label.id)
        : this.anchorPosition(label.anchor)
      const projected = this.project(point, width, height)
      published.push({
        id: label.id,
        x: Math.min(width * SCENE.labelSafeBand.right, Math.max(width * SCENE.labelSafeBand.left, projected.x)),
        y: projected.y,
        visible: projected.visible && eased >= 0.5 && this.isLabelDrawn(label.id),
        textKey: label.textKey,
        descriptionKey: label.descriptionKey,
      })
    }
    if (width <= 1180 || stage.id === 'black-hole') {
      // Compact remnants put several anchors on almost the same pixel on a phone.
      // Stagger visible captions in screen space, leaving enough room for translated text.
      const placed: DemoLabelAnchor[] = []
      for (const label of published) {
        if (!label.visible) continue
        label.x = Math.max(90, Math.min(width - 90, label.x))
        for (let attempt = 0; attempt < published.length; attempt += 1) {
          if (!placed.some((other) => Math.abs(other.x - label.x) < 180 && Math.abs(other.y - label.y) < 30)) break
          label.y += 32
        }
        placed.push(label)
      }
    }
    anchors(published)
  }

  /** Keep black-hole captions attached to the same view-space image when orbiting. */
  private blackHoleLabelPosition(id: string): THREE.Vector3 {
    const radius = this.visual.diskRadius
    const shadow = this.photonRingMaterial.uniforms.shadow!.value * radius
    const point = id === 'blackHoleShadow'
      ? new THREE.Vector3(0, shadow * .3, 0)
      : id === 'photonRing'
        ? new THREE.Vector3(shadow * 1.06, shadow * .65, 0)
        : new THREE.Vector3(radius * .76, -.04 * radius, 0)
    return point.applyQuaternion(this.stage.camera.quaternion)
  }

  /**
   * Where a label hangs, resolved against the current stage's drawn radii.
   *
   * Named anchors rather than fixed coordinates, because the drawn body changes size by a factor of
   * twenty-six across the timeline: a coordinate that sits nicely outside a neutron star is buried
   * inside the red giant.
   *
   * Two corrections are applied on top of the geometry, both of them about being readable rather
   * than about being accurate:
   *
   * - A minimum radius, because a neutron star's drawn radius is a tenth of a unit and three
   *   captions anchored to it would land on top of one another.
   * - A clamp into the part of the frame the demo's own panel does not cover, because a caption
   *   behind the panel is no caption at all.
   */
  private anchorPosition(anchor: StageLabelAnchor): THREE.Vector3 {
    const core = this.visual.coreRadius
    const cloud = this.visual.cloudRadius
    const disk = Math.max(this.visual.diskRadius, 0.3)
    const beam = Math.max(this.visual.haloScale * 0.86, 1.1)
    const reference = REFERENCE_RADIUS + 0.5
    switch (anchor) {
      case 'core-above':
        return new THREE.Vector3(0, this.clampLabelY(Math.max(core * 1.45, 0.62)), 0)
      case 'core-left':
        return new THREE.Vector3(this.clampLabelX(-Math.max(core * 1.15, 0.46)), Math.max(core * 0.1, 0.06), 0)
      case 'core-right':
        return new THREE.Vector3(this.clampLabelX(Math.max(core * 1.15, 0.46)), Math.max(core * 0.1, 0.06), 0)
      case 'shell-above':
        return new THREE.Vector3(0, this.clampLabelY(Math.max(cloud * 0.72, 0.62)), 0)
      case 'shell-left':
        return new THREE.Vector3(this.clampLabelX(-Math.max(cloud * 0.86, 0.5)), 0, 0)
      case 'shell-right':
        return new THREE.Vector3(this.clampLabelX(Math.max(cloud * 0.86, 0.5)), 0, 0)
      case 'disk-right':
        return new THREE.Vector3(this.clampLabelX(disk * 1.02), 0.16, 0)
      case 'beam-above':
        return new THREE.Vector3(0, this.clampLabelY(beam), 0)
      case 'frame-left':
        return new THREE.Vector3(this.clampLabelX(-reference), 0, 0)
      case 'frame-right':
        return new THREE.Vector3(this.clampLabelX(reference), 0, 0)
    }
  }

  /**
   * Keeps an anchor inside the band of the stage the demo's own panels do not cover.
   *
   * The shell clamps a label into the stage's rectangle, not into the part of it that is not behind
   * a panel, so this is the scene's job. The band is a fraction of the stage width rather than a
   * pixel count, so it holds as the viewport changes; `SCENE.labelSafeBand` says which panel widths
   * it is derived from.
   */
  private clampLabelX(x: number): number {
    const halfWidth = SCENE.frameHalfHeight * this.stage.camera.aspect
    // A fraction of the width is a fraction of the NDC range, which is twice the half-width.
    const toScene = (fraction: number): number => (fraction * 2 - 1) * halfWidth
    return Math.min(toScene(SCENE.labelSafeBand.right), Math.max(toScene(SCENE.labelSafeBand.left), x))
  }

  /**
   * Keeps an anchor inside the top and bottom of the frame.
   *
   * The shell positions a label above its anchor and does not clamp vertically, so an anchor past
   * the top of the stage puts the caption outside it, where `overflow: hidden` eats it. A large
   * cloud's top edge is well past the frame, which is what made three captions vanish.
   */
  private clampLabelY(y: number): number {
    return Math.min(SCENE.frameHalfHeight * 0.8, Math.max(-SCENE.frameHalfHeight * 0.6, y))
  }

  /**
   * Whether the thing a label names is on screen in this stage.
   *
   * Only one label can be orphaned: the reference circle is deliberately hidden on the main
   * sequence, where the body itself is the reference, and a caption floating over the Sun with no
   * circle under it would read as a bug. It is published as invisible rather than dropped, because
   * the shell creates a DOM node the first time it sees an id and a set that gained and lost
   * members would rebuild its nodes on every stage change.
   */
  private isLabelDrawn(id: string): boolean {
    if (id === 'referenceCircle') return this.visual.referenceOpacity > 0.002
    return true
  }

  /**
   * Projects a scene point to stage pixels.
   *
   * The camera never moves unless the viewer moves it, but it can be moved, so the projection is
   * recomputed every frame rather than cached.
   */
  private project(point: THREE.Vector3, width: number, height: number): { x: number, y: number, visible: boolean } {
    const ndc = point.clone().project(this.stage.camera)
    return {
      x: (ndc.x * 0.5 + 0.5) * width,
      y: (-ndc.y * 0.5 + 0.5) * height,
      // `z` past 1 means the point is behind the camera. Horizontally a caption just outside the
      // frame is fine, because the shell pulls it back in and it still reads as belonging to what
      // it points at; vertically it is not, because there is no such pull and the caption is
      // simply gone.
      visible: ndc.z < 1 && Math.abs(ndc.x) < 1.6 && Math.abs(ndc.y) < 1.05,
    }
  }
}

/** How often the elapsed time is republished to the panel, milliseconds. */
const STATE_PUBLISH_INTERVAL_MS = 100
