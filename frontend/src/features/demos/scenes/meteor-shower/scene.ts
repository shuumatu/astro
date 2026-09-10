import * as THREE from 'three'
import { createGlowSprite, createStarburstSprite } from '../../engine/glow'
import { createRandom } from '../../engine/random'
import { createStage, type Stage } from '../../engine/stage'
import { createStarfield } from '../../engine/starfield'
import {
  DEFAULT_DEMO_SETTINGS,
  type DemoLabelAnchor,
  type DemoPhase,
  type DemoScene,
  type DemoSceneOptions,
  type DemoSceneSettings,
} from '../../types'
import { COMET_ORBIT, EARTH_ORBIT, SCENE } from './config'
import { CometTails } from './cometTails'
import { createEarthGlobe } from './earth'
import {
  createOrbitFrame,
  eccentricAnomalyFromMean,
  eccentricAnomalyFromTrueAnomaly,
  eclipticLongitude,
  eclipticNodes,
  framePoint,
  frameTangent,
  frameVelocity,
  keplerPeriodRatio,
  nextTimeForAnomaly,
  angleBetweenDegrees,
  radiantDirection,
  type OrbitFrame,
} from './orbit'

const TWO_PI = Math.PI * 2
const DEGREES_TO_RADIANS = Math.PI / 180
const UP = new THREE.Vector3(0, 1, 0)
const EARTH_YEAR = 1

const SUN_COLOR = 0xfff2cf
const EARTH_ORBIT_COLOR = 0x6f9fe0
const DUST_BAND_COLOR = 0xe4eeff
const DUST_PARTICLE_COLOR = 0xd6e9ff
const SHOWER_MARKER_COLOR = 0xffb457
const EARTH_ORBIT_OPACITY = 0.72
const DUST_BAND_OPACITY = 0.42

/** Aphelion: the far side of the trail from where the comet sits at the start. */
const DUST_BAND_LABEL_ANOMALY = Math.PI
const ALIGNMENT_SECONDS = 2.2
const DESCENT_SECONDS = 3.4
const CLICK_TOLERANCE_PX = 6

interface Alignment {
  from: number
  to: number
  elapsed: number
}

interface Descent {
  elapsed: number
  fromPosition: THREE.Vector3
  viaPosition: THREE.Vector3
  toPosition: THREE.Vector3
  fromTarget: THREE.Vector3
  earthTarget: THREE.Vector3
  toTarget: THREE.Vector3
  fromFieldOfView: number
}

interface MeteorState {
  active: boolean
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  maxLife: number
  length: number
  brightness: number
}

class OrbitCurve extends THREE.Curve<THREE.Vector3> {
  private readonly frame: OrbitFrame

  constructor(frame: OrbitFrame) {
    super()
    this.frame = frame
  }

  override getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const point = framePoint(this.frame, t * TWO_PI)
    return optionalTarget.set(point.x, point.y, point.z)
  }
}

export class MeteorShowerScene implements DemoScene {
  private readonly options: DemoSceneOptions
  private readonly stage: Stage
  private readonly random = createRandom(0x5eed1e)
  private readonly ecliptic = new THREE.Group()
  private readonly system = new THREE.Group()
  private readonly earthOrbitGroup = new THREE.Group()
  private readonly directionGroup = new THREE.Group()
  // Assigned by buildOrbits(), which always runs from the constructor.
  private earthOrbitMesh!: THREE.Mesh
  private dustBandMesh!: THREE.Mesh
  private readonly earth = new THREE.Group()
  private readonly comet = new THREE.Group()
  private readonly marker = new THREE.Group()
  private readonly markerRing: THREE.Mesh
  private readonly markerGlow: THREE.Sprite
  private readonly markerPick: THREE.Mesh
  private readonly tails: CometTails
  private readonly starburst: THREE.Sprite
  private readonly dustGeometry: THREE.BufferGeometry
  private readonly dustPositions: Float32Array
  private readonly dustBaseAnomaly: Float32Array
  private readonly dustDrift: Float32Array
  private readonly dustScale: Float32Array
  private readonly dustNormalOffset: Float32Array
  private readonly earthFrame: OrbitFrame
  private readonly cometFrame: OrbitFrame
  private readonly cometPeriodYears: number
  private readonly labelTargets = new Map<string, THREE.Object3D>()
  private readonly projected = new THREE.Vector3()
  private readonly antiSolar = new THREE.Vector3()
  private readonly antiVelocity = new THREE.Vector3()
  private readonly worldPoint = new THREE.Vector3()
  private readonly descentTarget = new THREE.Vector3()
  private readonly homePosition = new THREE.Vector3()
  private readonly homeTarget = new THREE.Vector3()
  private readonly crossingLocal = new THREE.Vector3()
  private readonly radiantDirection = new THREE.Vector3()
  private readonly observationZenith = new THREE.Vector3()
  private readonly towardAntiSolar = new THREE.Vector3()
  private readonly meteorPositions = new Float32Array(SCENE.meteorCount * 6)
  private readonly meteorColors = new Float32Array(SCENE.meteorCount * 6)
  private readonly meteorStates: MeteorState[] = Array.from(
    { length: SCENE.meteorCount },
    () => ({
      active: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      length: 0,
      brightness: 0,
    }),
  )
  private meteorGeometry!: THREE.BufferGeometry
  private meteorLines!: THREE.LineSegments
  private readonly meteorBasisRight = new THREE.Vector3()
  private readonly meteorBasisUp = new THREE.Vector3()
  private readonly meteorSpawn = new THREE.Vector3()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()
  private settings: DemoSceneSettings = { ...DEFAULT_DEMO_SETTINGS }
  private phase: DemoPhase = 'orbit'
  private elapsedYears = 0
  private beaconSeconds = 0
  private emissionAccumulator = 0
  private emissionCursor = 0
  private crossingAngle = 0
  private alignment: Alignment | null = null
  private descent: Descent | null = null
  private pointerDownAt: { x: number, y: number } | null = null
  private radiantAltitudeDeg = 0
  private meteorSpawnAccumulator = 0
  private descentProgress = 0
  private framedAspect = 0
  private pendingAspect: number | null = null
  private userAdjustedCamera = false

  constructor(container: HTMLElement, options: DemoSceneOptions = {}) {
    this.options = options
    this.earthFrame = createOrbitFrame(EARTH_ORBIT)
    this.cometFrame = createOrbitFrame(COMET_ORBIT)
    this.cometPeriodYears = keplerPeriodRatio(COMET_ORBIT.semiMajorAxis, EARTH_ORBIT.semiMajorAxis)
    this.resolveShowerGeometry()

    // Frame against the real viewport shape: a full-bleed stage is rarely 16:9.
    const aspect = container.clientWidth > 0 && container.clientHeight > 0
      ? container.clientWidth / container.clientHeight
      : 16 / 9
    const framing = frameOrbits([this.earthFrame, this.cometFrame], aspect)
    this.homePosition.copy(framing.cameraPosition)
    this.homeTarget.copy(framing.target)
    this.framedAspect = aspect
    this.stage = createStage(container, {
      cameraPosition: framing.cameraPosition,
      target: framing.target,
      fov: SCENE.cameraFieldOfViewDeg,
      minDistance: SCENE.minCameraDistance,
      maxDistance: SCENE.maxCameraDistance,
      onResize: (nextAspect) => {
        this.pendingAspect = nextAspect
      },
    })

    this.dustPositions = new Float32Array(SCENE.dustCount * 3)
    this.dustBaseAnomaly = new Float32Array(SCENE.dustCount)
    this.dustDrift = new Float32Array(SCENE.dustCount)
    this.dustScale = new Float32Array(SCENE.dustCount)
    this.dustNormalOffset = new Float32Array(SCENE.dustCount)

    this.stage.scene.add(createStarfield({
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    }))

    // Content is authored in ecliptic coordinates (z toward ecliptic north); this group
    // rotates the whole system into the renderer's y-up world.
    this.ecliptic.rotation.x = SCENE.eclipticPlaneRotationXDeg * DEGREES_TO_RADIANS
    this.system.rotation.z = SCENE.systemAzimuthDeg * DEGREES_TO_RADIANS
    this.ecliptic.add(this.system)
    this.stage.scene.add(this.ecliptic)

    this.buildSun()
    this.starburst = this.buildStarburst()
    this.buildOrbits()
    this.buildEarth()
    this.tails = this.buildComet()
    this.dustGeometry = this.buildDust()
    this.buildMeteors()

    const marker = this.buildShowerMarker()
    this.markerRing = marker.ring
    this.markerGlow = marker.glow
    this.markerPick = marker.pick

    const canvas = this.stage.renderer.domElement
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    this.stage.controls.addEventListener('start', this.handleControlsStart)

    this.stage.setFrameHandler((delta) => this.update(delta))
    this.syncVisibility()
    this.stage.start()
  }

  applySettings(settings: Partial<DemoSceneSettings>): void {
    this.settings = { ...this.settings, ...settings }
    this.syncVisibility()
  }

  resetView(): void {
    if (this.phase !== 'orbit') return
    this.userAdjustedCamera = false
    this.stage.resetView()
  }

  /** Leaves the ground-level view and returns to the orbital overview. */
  leaveSurfaceView(): void {
    this.alignment = null
    this.descent = null
    this.stage.controls.enabled = true
    this.stage.start()
    this.setOrbitFade(1)
    this.stage.resetView()
    this.setPhase('orbit')
  }

  dispose(): void {
    const canvas = this.stage.renderer.domElement
    canvas.removeEventListener('pointerdown', this.handlePointerDown)
    canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.stage.controls.removeEventListener('start', this.handleControlsStart)
    this.stage.dispose()
  }

  setSuspended(suspended: boolean): void {
    if (suspended) {
      this.stage.stop()
      return
    }
    // The ground view keeps the 3D stage stopped on purpose.
    if (this.phase !== 'surface') this.stage.start()
  }

  private buildSun(): void {
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(SCENE.sunRadius, 48, 32),
      new THREE.MeshBasicMaterial({ color: SUN_COLOR }),
    )
    this.system.add(sun)
    this.system.add(createGlowSprite({ color: 0xffcf85, size: SCENE.sunGlowSize, opacity: 0.85 }))
    this.system.add(new THREE.PointLight(0xfff0d0, 60, 0, 2))
    this.system.add(new THREE.AmbientLight(0x2a3f5c, 1.2))
    this.labelTargets.set('sun', sun)
  }

  private buildStarburst(): THREE.Sprite {
    const sprite = createStarburstSprite({ color: 0xfff3d2, size: SCENE.sunStarburstSize, opacity: 0.5 })
    this.system.add(sprite)
    return sprite
  }

  private buildOrbits(): void {
    this.earthOrbitMesh = new THREE.Mesh(
      new THREE.TubeGeometry(new OrbitCurve(this.earthFrame), 320, SCENE.orbitTubeRadius, 8, true),
      new THREE.MeshBasicMaterial({
        color: EARTH_ORBIT_COLOR,
        transparent: true,
        opacity: EARTH_ORBIT_OPACITY,
        depthWrite: false,
      }),
    )
    this.earthOrbitGroup.add(this.earthOrbitMesh)
    this.system.add(this.earthOrbitGroup)

    // The comet's orbit doubles as the dust trail: the particles are spread along it.
    this.dustBandMesh = new THREE.Mesh(
      new THREE.TubeGeometry(new OrbitCurve(this.cometFrame), 360, SCENE.dustBandRadius, 10, true),
      new THREE.MeshBasicMaterial({
        color: DUST_BAND_COLOR,
        transparent: true,
        opacity: DUST_BAND_OPACITY,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.system.add(this.dustBandMesh)

    this.directionGroup.add(...directionArrows(this.earthFrame, 3, EARTH_ORBIT_COLOR, 0.34))
    this.directionGroup.add(...directionArrows(this.cometFrame, 4, DUST_BAND_COLOR, 0.44))
    this.system.add(this.directionGroup)

    const marker = framePoint(this.cometFrame, DUST_BAND_LABEL_ANOMALY)
    const normal = this.cometFrame.normal
    const label = new THREE.Object3D()
    label.position.set(
      marker.x + normal.x * 0.5,
      marker.y + normal.y * 0.5,
      marker.z + normal.z * 0.5,
    )
    this.system.add(label)
    this.labelTargets.set('dustBand', label)
  }

  /**
   * Works out where the shower actually comes from. The radiant is opposite the meteoroids'
   * geocentric velocity — the vector difference between the stream and the Earth — so it is a
   * specific direction in the sky, not a free choice, and it is generally nowhere near the
   * direction of the Earth's orbital motion.
   */
  private resolveShowerGeometry(): void {
    const crossing = eclipticNodes(this.cometFrame).find((node) => node.kind === 'descending')
    if (!crossing) throw new Error('The comet orbit must cross the ecliptic to reach the Earth orbit')

    this.crossingAngle = eclipticLongitude(crossing.point)
    this.crossingLocal.set(crossing.point.x, crossing.point.y, crossing.point.z)

    // Dust rides the comet orbit, so the stream's velocity here is the comet's velocity at
    // the node; the Earth's velocity is taken at the same point of its own orbit.
    const dustVelocity = frameVelocity(
      this.cometFrame,
      eccentricAnomalyFromTrueAnomaly(
        Math.PI - this.cometFrame.argumentOfPeriapsis,
        this.cometFrame.eccentricity,
      ),
      TWO_PI / this.cometPeriodYears,
    )
    const earthVelocity = frameVelocity(
      this.earthFrame,
      eccentricAnomalyFromTrueAnomaly(this.crossingAngle, this.earthFrame.eccentricity),
      TWO_PI / EARTH_YEAR,
    )
    const toWorld = contentRotation()
    const radiant = radiantDirection(dustVelocity, earthVelocity)
    this.radiantDirection.set(radiant.x, radiant.y, radiant.z).applyMatrix4(toWorld).normalize()

    // Observation site: pick the zenith that puts the radiant at the altitude the ground view
    // can actually show, then slide it as close to the anti-sunward direction as that allows.
    // Standing there it is properly dark — the Sun ends up far below the horizon — and the
    // radiant sits in the middle of the photographed sky instead of above the top of it.
    const antiSolar = this.crossingLocal.clone().applyMatrix4(toWorld).normalize()
    const separation = angleBetweenDegrees(this.radiantDirection, antiSolar)
    const targetFromRadiant = Math.min(
      (90 - SCENE.observationRadiantAltitudeDeg) * DEGREES_TO_RADIANS,
      separation * DEGREES_TO_RADIANS,
    )
    this.towardAntiSolar
      .copy(antiSolar)
      .addScaledVector(this.radiantDirection, -antiSolar.dot(this.radiantDirection))
    if (this.towardAntiSolar.lengthSq() < 1e-10) this.towardAntiSolar.copy(UP).cross(this.radiantDirection)
    this.towardAntiSolar.normalize()
    this.observationZenith
      .copy(this.radiantDirection)
      .multiplyScalar(Math.cos(targetFromRadiant))
      .addScaledVector(this.towardAntiSolar, Math.sin(targetFromRadiant))
      .normalize()
    this.radiantAltitudeDeg = 90 - angleBetweenDegrees(this.observationZenith, this.radiantDirection)
    this.options.onRadiantResolved?.({ altitudeDeg: this.radiantAltitudeDeg })
  }

  /**
   * Marks the one point where the Earth orbit and the dust trail actually meet. Clicking it
   * runs the scripted sequence that ends looking up at the shower from the ground.
   */
  private buildShowerMarker(): { ring: THREE.Mesh, glow: THREE.Sprite, pick: THREE.Mesh } {
    const position = this.crossingLocal.clone()

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.44, 0.62, 56),
      new THREE.MeshBasicMaterial({
        color: SHOWER_MARKER_COLOR,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    ring.position.copy(position)

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xfff1d6 }),
    )
    core.position.copy(position)

    const glow = createGlowSprite({ color: SHOWER_MARKER_COLOR, size: 3.2, opacity: 0.8 })
    glow.position.copy(position)

    // Invisible to the renderer but still raycastable, so the marker is easy to click.
    const pick = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    pick.position.copy(position)

    const label = new THREE.Object3D()
    label.position.copy(position).addScaledVector(this.cometFrame.normal, 0.55)
    this.labelTargets.set('meteorShowerPoint', label)

    this.marker.add(ring, core, glow, pick, label)
    this.system.add(this.marker)

    return { ring, glow, pick }
  }

  private buildEarth(): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0,
      // Keeps the night side from going completely black; no city-light map is modelled.
      emissive: 0x0b1e30,
      emissiveIntensity: 0.6,
    })
    const texture = new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}demos/meteor-shower/earth-day.jpg`,
      undefined,
      undefined,
      () => {
        // Fall back to the plain globe rather than rendering an untextured black ball.
        material.map = null
        material.needsUpdate = true
      },
    )
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = this.stage.renderer.capabilities.getMaxAnisotropy()
    material.map = texture

    this.earth.add(createEarthGlobe({
      radius: SCENE.earthRadius,
      obliquityDeg: SCENE.earthObliquityDeg,
      material,
    }))
    this.system.add(this.earth)
    this.labelTargets.set('earth', this.earth)
  }

  private buildComet(): CometTails {
    const nucleus = new THREE.Mesh(
      new THREE.SphereGeometry(SCENE.cometRadius, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xe8f4ff }),
    )
    this.comet.add(nucleus)
    this.comet.add(createGlowSprite({ color: 0xcfe8ff, size: SCENE.cometRadius * 4, opacity: 0.75 }))

    const tails = new CometTails({
      ionLength: SCENE.ionTailLength,
      ionBaseRadius: SCENE.ionTailBaseRadius,
      ionTipRadius: SCENE.ionTailTipRadius,
      dustLength: SCENE.dustTailLength,
      dustBaseRadius: SCENE.dustTailBaseRadius,
      dustTipRadius: SCENE.dustTailTipRadius,
      dustBendDeg: SCENE.dustTailBendDeg,
    })
    this.comet.add(tails.group)
    this.system.add(this.comet)
    this.labelTargets.set('comet', this.comet)

    return tails
  }

  private buildDust(): THREE.BufferGeometry {
    for (let index = 0; index < SCENE.dustCount; index += 1) {
      // Pre-seed the whole orbit so the trail is already visible before the first emission.
      this.dustBaseAnomaly[index] = this.random() * TWO_PI
      this.dustDrift[index] = (this.random() - 0.5) * 0.06
      this.dustScale[index] = 1 + (this.random() - 0.5) * 0.015
      this.dustNormalOffset[index] = (this.random() - 0.5) * 0.05
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3))
    const material = new THREE.PointsMaterial({
      color: DUST_PARTICLE_COLOR,
      size: 0.075,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    this.system.add(points)
    return geometry
  }

  /**
   * Meteors for the descent: every streak is fired along the anti-radiant direction, so the
   * trails converge on exactly the patch of sky the ground view then continues.
   */
  private buildMeteors(): void {
    this.meteorGeometry = new THREE.BufferGeometry()
    this.meteorGeometry.setAttribute('position', new THREE.BufferAttribute(this.meteorPositions, 3))
    this.meteorGeometry.setAttribute('color', new THREE.BufferAttribute(this.meteorColors, 3))
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.meteorLines = new THREE.LineSegments(this.meteorGeometry, material)
    this.meteorLines.frustumCulled = false
    this.meteorLines.visible = false
    this.stage.scene.add(this.meteorLines)
  }

  private updateMeteors(deltaSeconds: number): void {
    // Wait until the camera is actually falling towards the planet and turning skyward —
    // otherwise meteors would streak across the orbital overview the moment it is clicked.
    const visible = this.phase === 'cinematic' && this.descentProgress > SCENE.meteorStartProgress
    this.meteorLines.visible = visible
    if (!visible) return

    this.meteorBasisRight.crossVectors(this.radiantDirection, UP).normalize()
    this.meteorBasisUp.crossVectors(this.meteorBasisRight, this.radiantDirection).normalize()

    this.meteorSpawnAccumulator += deltaSeconds * SCENE.meteorsPerSecond
    const requested = Math.floor(this.meteorSpawnAccumulator)
    if (requested > 0) this.meteorSpawnAccumulator -= requested
    for (let index = 0; index < Math.min(requested, 12); index += 1) this.spawnMeteor()

    const positions = this.meteorPositions
    const colors = this.meteorColors

    for (let index = 0; index < this.meteorStates.length; index += 1) {
      const meteor = this.meteorStates[index]
      const base = index * 6
      if (!meteor.active) {
        for (let offset = 0; offset < 6; offset += 1) {
          positions[base + offset] = 0
          colors[base + offset] = 0
        }
        continue
      }

      meteor.life += deltaSeconds
      const progress = meteor.life / meteor.maxLife
      if (progress >= 1) {
        meteor.active = false
        continue
      }

      meteor.position.addScaledVector(meteor.velocity, deltaSeconds)
      const speed = meteor.velocity.length()
      const tailScale = speed === 0 ? 0 : meteor.length / speed
      const alpha = meteor.brightness * Math.sin(Math.min(1, progress) * Math.PI)

      positions[base] = meteor.position.x
      positions[base + 1] = meteor.position.y
      positions[base + 2] = meteor.position.z
      positions[base + 3] = meteor.position.x - meteor.velocity.x * tailScale
      positions[base + 4] = meteor.position.y - meteor.velocity.y * tailScale
      positions[base + 5] = meteor.position.z - meteor.velocity.z * tailScale

      colors[base] = alpha
      colors[base + 1] = alpha
      colors[base + 2] = alpha
      colors[base + 3] = 0
      colors[base + 4] = 0
      colors[base + 5] = 0
    }

    this.meteorGeometry.getAttribute('position').needsUpdate = true
    this.meteorGeometry.getAttribute('color').needsUpdate = true
  }

  private spawnMeteor(): void {
    const meteor = this.meteorStates.find((state) => !state.active)
    if (!meteor) return

    const distance = 30 + this.random() * 80
    const radius = 3 + this.random() * 20
    const angle = this.random() * TWO_PI
    this.meteorSpawn
      .copy(this.stage.camera.position)
      .addScaledVector(this.radiantDirection, distance)
      .addScaledVector(this.meteorBasisRight, Math.cos(angle) * radius)
      .addScaledVector(this.meteorBasisUp, Math.sin(angle) * radius)

    meteor.active = true
    meteor.position.copy(this.meteorSpawn)
    meteor.velocity.copy(this.radiantDirection).multiplyScalar(-(28 + this.random() * 46))
    meteor.life = 0
    meteor.maxLife = 0.9 + this.random() * 0.9
    meteor.length = 6 + this.random() * 14
    meteor.brightness = 0.5 + this.random() * 0.5
  }

  private syncVisibility(): void {
    this.earthOrbitGroup.visible = this.settings.showOrbits
    this.directionGroup.visible = this.settings.showOrbits
    this.marker.visible = this.phase === 'orbit'
    if (this.phase === 'orbit') this.setOrbitFade(1)
    if (!this.settings.showLabels) this.options.onLabels?.([])
  }

  /**
   * The diagram lines stop making sense once the camera is inside the stream — the trail
   * would fill the lens as a solid bar — so they fade out during the descent.
   */
  private setOrbitFade(fade: number): void {
    const clamped = Math.min(1, Math.max(0, fade))
    ;(this.earthOrbitMesh.material as THREE.MeshBasicMaterial).opacity = EARTH_ORBIT_OPACITY * clamped
    ;(this.dustBandMesh.material as THREE.MeshBasicMaterial).opacity = DUST_BAND_OPACITY * clamped
    this.directionGroup.visible = this.settings.showOrbits && clamped > 0.4
  }

  private setPhase(phase: DemoPhase): void {
    if (this.phase === phase) return
    this.phase = phase
    this.syncVisibility()
    this.options.onPhaseChange?.(phase)
  }

  private update(deltaSeconds: number): void {
    this.applyPendingFraming()

    if (this.phase === 'cinematic') {
      this.updateCinematic(deltaSeconds)
    } else if (this.settings.playing) {
      this.elapsedYears += deltaSeconds * this.settings.timeScale
      this.starburst.material.rotation += deltaSeconds * 0.04
    }

    const earthAnomaly = eccentricAnomalyFromMean(this.elapsedYears * TWO_PI, this.earthFrame.eccentricity)
    const earthPoint = framePoint(this.earthFrame, earthAnomaly)
    this.earth.position.set(earthPoint.x, earthPoint.y, earthPoint.z)

    const cometMeanAnomaly = (this.elapsedYears / this.cometPeriodYears + SCENE.cometEpochOffset) * TWO_PI
    const cometAnomaly = eccentricAnomalyFromMean(cometMeanAnomaly, this.cometFrame.eccentricity)
    const cometPoint = framePoint(this.cometFrame, cometAnomaly)
    this.comet.position.set(cometPoint.x, cometPoint.y, cometPoint.z)
    this.updateTails(cometPoint, cometAnomaly)

    this.emitDust(deltaSeconds, cometAnomaly)
    this.updateDust()
    this.updateMeteors(deltaSeconds)
    this.updateMarker(deltaSeconds)
    this.publishLabels()
  }

  private updateCinematic(deltaSeconds: number): void {
    const alignment = this.alignment
    if (alignment) {
      alignment.elapsed += deltaSeconds
      const progress = Math.min(1, alignment.elapsed / ALIGNMENT_SECONDS)
      this.elapsedYears = alignment.from + (alignment.to - alignment.from) * easeInOutCubic(progress)
      if (progress >= 1) {
        this.alignment = null
        this.beginDescent()
      }
      return
    }

    const descent = this.descent
    if (!descent) return
    descent.elapsed += deltaSeconds
    const progress = Math.min(1, descent.elapsed / DESCENT_SECONDS)
    this.descentProgress = progress
    const eased = easeInOutCubic(progress)
    this.stage.camera.position.copy(
      quadraticBezier(descent.fromPosition, descent.viaPosition, descent.toPosition, eased),
    )
    // Keep the Earth centred while falling towards it, then swing out to the horizon at the
    // very end so the view arrives already facing the sky.
    this.descentTarget.lerpVectors(descent.fromTarget, descent.earthTarget, smoothStep(0, 0.22, progress))
    this.descentTarget.lerp(descent.toTarget, smoothStep(0.6, 1, progress))
    this.stage.controls.target.copy(this.descentTarget)
    this.stage.camera.lookAt(this.stage.controls.target)
    // Narrowing the lens magnifies the approach; the planet is far too small to read at
    // orbital scale otherwise.
    this.stage.camera.fov = descent.fromFieldOfView + (SCENE.descentFieldOfViewDeg - descent.fromFieldOfView) * eased
    this.stage.camera.updateProjectionMatrix()
    this.setOrbitFade(1 - eased)
    if (progress >= 1) this.finishCinematic()
  }

  /** Runs the Earth forward to the crossing, then flies the camera down to its night side. */
  private beginSurfaceSequence(): void {
    this.stage.controls.enabled = false
    this.descentProgress = 0
    this.alignment = {
      from: this.elapsedYears,
      to: nextTimeForAnomaly(this.elapsedYears, EARTH_YEAR, this.crossingAngle),
      elapsed: 0,
    }
    this.setPhase('cinematic')
  }

  private beginDescent(): void {
    const earthWorld = this.worldPoint.copy(this.earth.position)
    this.system.localToWorld(earthWorld)
    // The Sun sits at the world origin, so the outward radial is the anti-sunward direction:
    // standing there puts the viewer on the night side, facing the horizon.
    const outward = earthWorld.clone().normalize()
    const surface = earthWorld.clone()
      .addScaledVector(this.observationZenith, SCENE.earthRadius * SCENE.descentRadiusFactor)
    // Arrive looking in the direction the shower actually comes from, so the ground view can
    // pick up the same patch of sky — but angled slightly below it, which leaves the radiant
    // high in frame instead of pinned to the centre.
    const offset = SCENE.descentRadiantOffsetDeg * DEGREES_TO_RADIANS
    const towardHorizon = this.observationZenith.clone().negate()
      .projectOnPlane(this.radiantDirection)
      .normalize()
    const horizon = this.radiantDirection.clone()
      .multiplyScalar(Math.cos(offset))
      .addScaledVector(towardHorizon, Math.sin(offset))
      .normalize()
    const fromPosition = this.stage.camera.position.clone()
    const viaPosition = fromPosition.clone().lerp(surface, 0.5)
    viaPosition.y += fromPosition.distanceTo(surface) * 0.22

    this.descent = {
      elapsed: 0,
      fromPosition,
      viaPosition,
      toPosition: surface,
      fromTarget: this.stage.controls.target.clone(),
      earthTarget: earthWorld.clone(),
      toTarget: surface.clone().addScaledVector(horizon, 60),
      fromFieldOfView: this.stage.camera.fov,
    }
  }

  private finishCinematic(): void {
    this.descent = null
    this.setPhase('surface')
    this.stage.stop()
  }

  /**
   * The two tails are aimed by different physics: the ion tail straight away from the Sun,
   * the dust tail towards the trailing direction because its grains keep their own orbits.
   */
  private updateTails(point: { x: number, y: number, z: number }, cometAnomaly: number): void {
    const distance = Math.hypot(point.x, point.y, point.z)
    if (distance === 0) return
    this.antiSolar.set(point.x / distance, point.y / distance, point.z / distance)

    const velocity = frameVelocity(this.cometFrame, cometAnomaly, TWO_PI / this.cometPeriodYears)
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
    if (speed === 0) return
    this.antiVelocity.set(-velocity.x / speed, -velocity.y / speed, -velocity.z / speed)

    // A comet is far more active near perihelion, where the tails are longest.
    const activity = Math.min(1.5, Math.max(0.45, 4.2 / distance))
    this.tails.update(this.antiSolar, this.antiVelocity, activity)
  }

  private emitDust(deltaSeconds: number, cometAnomaly: number): void {
    if (this.phase !== 'orbit' || !this.settings.playing) return
    this.emissionAccumulator += deltaSeconds * this.settings.timeScale * SCENE.dustPerYear
    const requested = Math.floor(this.emissionAccumulator)
    if (requested <= 0) return
    this.emissionAccumulator -= requested
    const budget = Math.min(requested, SCENE.maxDustPerFrame)

    for (let emitted = 0; emitted < budget; emitted += 1) {
      const index = this.emissionCursor
      this.emissionCursor = (this.emissionCursor + 1) % SCENE.dustCount
      const drift = (this.random() - 0.5) * 0.09
      const emissionAnomaly = cometAnomaly + (this.random() - 0.5) * 0.05
      // Each grain ends up on a slightly different orbit, so the stream smears out.
      this.dustBaseAnomaly[index] = emissionAnomaly - drift * this.elapsedYears
      this.dustDrift[index] = drift
      this.dustScale[index] = 1 + (this.random() - 0.5) * 0.02
      this.dustNormalOffset[index] = (this.random() - 0.5) * 0.06
    }
  }

  private updateDust(): void {
    const frame = this.cometFrame
    const { periapsis, transverse, normal } = frame
    const semiMajorAxis = frame.semiMajorAxis
    const semiMinorAxis = frame.semiMinorAxis
    const eccentricity = frame.eccentricity
    const positions = this.dustPositions

    for (let index = 0; index < SCENE.dustCount; index += 1) {
      const anomaly = this.dustBaseAnomaly[index] + this.dustDrift[index] * this.elapsedYears
      const scale = this.dustScale[index]
      const along = semiMajorAxis * (Math.cos(anomaly) - eccentricity) * scale
      const across = semiMinorAxis * Math.sin(anomaly) * scale
      const offset = this.dustNormalOffset[index]
      const base = index * 3
      positions[base] = periapsis.x * along + transverse.x * across + normal.x * offset
      positions[base + 1] = periapsis.y * along + transverse.y * across + normal.y * offset
      positions[base + 2] = periapsis.z * along + transverse.z * across + normal.z * offset
    }

    this.dustGeometry.getAttribute('position').needsUpdate = true
  }

  private updateMarker(deltaSeconds: number): void {
    this.beaconSeconds += deltaSeconds
    const pulse = 0.5 + 0.5 * Math.sin(this.beaconSeconds * 2.6)
    this.markerGlow.scale.setScalar(3 + pulse * 1.2)
    this.markerRing.scale.setScalar(0.94 + pulse * 0.1)
    ;(this.markerRing.material as THREE.MeshBasicMaterial).opacity = 0.55 + pulse * 0.35
  }

  /**
   * Re-frames when the viewport shape changes. The first fit happens before the browser has
   * settled the layout on some devices, and a window resize or rotation changes it again.
   * Once the user has moved the camera their position is left alone; only the view that
   * "reset view" returns to is updated.
   */
  private applyPendingFraming(): void {
    const aspect = this.pendingAspect
    this.pendingAspect = null
    if (aspect === null || this.phase !== 'orbit') return
    if (this.framedAspect > 0 && Math.abs(aspect - this.framedAspect) / this.framedAspect < 0.04) return

    const framing = frameOrbits([this.earthFrame, this.cometFrame], aspect)
    this.framedAspect = aspect
    this.homePosition.copy(framing.cameraPosition)
    this.homeTarget.copy(framing.target)
    this.stage.setHomeView(this.homePosition, this.homeTarget)

    if (this.userAdjustedCamera) return
    this.stage.camera.position.copy(this.homePosition)
    this.stage.controls.target.copy(this.homeTarget)
    this.stage.camera.lookAt(this.homeTarget)
  }

  private publishLabels(): void {
    const handler = this.options.onLabels
    if (!handler) return
    if (!this.settings.showLabels) {
      handler([])
      return
    }

    const canvas = this.stage.renderer.domElement
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const anchors: DemoLabelAnchor[] = []

    for (const [id, object] of this.labelTargets) {
      if (id === 'meteorShowerPoint' && this.phase !== 'orbit') continue
      object.getWorldPosition(this.projected)
      this.projected.project(this.stage.camera)
      anchors.push({
        id,
        x: (this.projected.x * 0.5 + 0.5) * width,
        y: (-this.projected.y * 0.5 + 0.5) * height,
        visible: this.projected.z < 1,
      })
    }

    handler(anchors)
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDownAt = { x: event.clientX, y: event.clientY }
  }

  private readonly handleControlsStart = (): void => {
    this.userAdjustedCamera = true
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const start = this.pointerDownAt
    this.pointerDownAt = null
    if (!start || this.phase !== 'orbit') return
    // Ignore the pointerup that ends an orbit drag.
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_TOLERANCE_PX) return
    if (!this.hitsShowerMarker(event)) return
    this.beginSurfaceSequence()
  }

  private hitsShowerMarker(event: PointerEvent): boolean {
    const canvas = this.stage.renderer.domElement
    const bounds = canvas.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return false
    this.pointerNdc.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointerNdc, this.stage.camera)
    return this.raycaster.intersectObject(this.markerPick, false).length > 0
  }
}

/**
 * Maps ecliptic-frame content (z toward ecliptic north) into the renderer's y-up world,
 * including the scene's own azimuth. Used for both points and directions.
 */
function contentRotation(): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeRotationX(SCENE.eclipticPlaneRotationXDeg * DEGREES_TO_RADIANS)
    .multiply(new THREE.Matrix4().makeRotationZ(SCENE.systemAzimuthDeg * DEGREES_TO_RADIANS))
}

function directionArrows(
  frame: OrbitFrame,
  count: number,
  color: number,
  opacity: number,
): THREE.Mesh[] {
  const geometry = new THREE.ConeGeometry(0.13, 0.42, 10)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  })
  const arrows: THREE.Mesh[] = []

  for (let index = 0; index < count; index += 1) {
    const anomaly = (index / count) * TWO_PI + 0.35
    const point = framePoint(frame, anomaly)
    const tangent = frameTangent(frame, anomaly)
    const arrow = new THREE.Mesh(geometry, material)
    arrow.position.set(point.x, point.y, point.z)
    arrow.quaternion.setFromUnitVectors(UP, new THREE.Vector3(tangent.x, tangent.y, tangent.z))
    arrows.push(arrow)
  }

  return arrows
}

/**
 * Frames the camera on the drawn orbits. A bounding sphere alone frames an eccentric orbit
 * far too loosely, and the projected size of an inclined orbit depends strongly on the view
 * direction, so the distance is fitted against the actual projection instead.
 */
function frameOrbits(
  frames: OrbitFrame[],
  aspect: number,
): { cameraPosition: THREE.Vector3, target: THREE.Vector3 } {
  const toWorld = contentRotation()
  const samples: THREE.Vector3[] = []
  const point = new THREE.Vector3()

  for (const frame of frames) {
    for (let index = 0; index < 240; index += 1) {
      const local = framePoint(frame, (index / 240) * TWO_PI)
      point.set(local.x, local.y, local.z).applyMatrix4(toWorld)
      samples.push(point.clone())
    }
  }

  const box = new THREE.Box3()
  for (const sample of samples) box.expandByPoint(sample)
  const target = box.getCenter(new THREE.Vector3())

  let radius = 0
  for (const sample of samples) radius = Math.max(radius, sample.distanceTo(target))

  const elevation = SCENE.cameraElevationDeg * DEGREES_TO_RADIANS
  const azimuth = SCENE.cameraAzimuthDeg * DEGREES_TO_RADIANS
  const direction = new THREE.Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  )

  const probe = new THREE.PerspectiveCamera(SCENE.cameraFieldOfViewDeg, aspect, 0.1, 4000)
  probe.up.set(0, 1, 0)
  let distance = radius / Math.sin((SCENE.cameraFieldOfViewDeg * DEGREES_TO_RADIANS) / 2)
  const cameraPosition = new THREE.Vector3()

  for (let iteration = 0; iteration < 8; iteration += 1) {
    cameraPosition.copy(target).addScaledVector(direction, distance)
    probe.position.copy(cameraPosition)
    probe.lookAt(target)
    probe.updateMatrixWorld()

    let extent = 0
    for (const sample of samples) {
      const projected = sample.clone().project(probe)
      extent = Math.max(extent, Math.abs(projected.x), Math.abs(projected.y))
    }
    if (!Number.isFinite(extent) || extent <= 0) break
    distance *= extent / SCENE.cameraFramingFill
  }

  cameraPosition.copy(target).addScaledVector(direction, distance)
  return { target, cameraPosition }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function quadraticBezier(
  from: THREE.Vector3,
  via: THREE.Vector3,
  to: THREE.Vector3,
  t: number,
): THREE.Vector3 {
  const inverse = 1 - t
  return new THREE.Vector3()
    .addScaledVector(from, inverse * inverse)
    .addScaledVector(via, 2 * inverse * t)
    .addScaledVector(to, t * t)
}
