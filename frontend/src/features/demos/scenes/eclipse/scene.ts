import * as THREE from 'three'
import { createGlobe, globeQuaternion } from '../../engine/globe'
import { createGlowSprite, createStarburstSprite } from '../../engine/glow'
import { createStage, type Stage } from '../../engine/stage'
import { createStarfield } from '../../engine/starfield'
import {
  type DemoLabelAnchor,
  type DemoScene,
  type DemoSceneOptions,
  type DemoSceneSettings,
} from '../../types'
import {
  BODY_RADIUS_KM,
  COLOURS,
  DISPLAY_MOON_ORBIT,
  DISPLAY_PLANE_RADIUS,
  DISPLAY_RADIUS,
  DISPLAY_SUN_DISTANCE,
  MOON_ORBIT_INCLINATION_DEG,
  SCENE,
} from './config'
import {
  displayShadowCone,
  findPartialOffset,
  lunarPhaseWindows,
  obscurationFraction,
  orbitPlaneBasis,
  padWindow,
  type DisplayShadowCone,
  type EclipsePhaseWindow,
} from './geometry'
import {
  EVENT_LIST_LENGTH,
  earthBodyFrame,
  geocentricState,
  localSolarEclipse,
  lunarEclipseTiming,
  lunarGeometryAt,
  moonBodyFrame,
  moonOrbitFrame,
  nextLunarEclipses,
  nextSolarEclipses,
  observerDirection,
  solarGeometryAt,
  type LocalSolarEclipse,
  type LunarEclipseTiming,
  type LunarGeometry,
  type ObserverPosition,
  type SolarGeometry,
} from './ephemeris'
import { ShadowVolume } from './shadowVolume'
import { eclipseGuideWindow, firstTotalContact, GUIDE_SYSTEM_FOCUS, guideFocusStrength, type EclipseGuideCue } from './guide'
import { ECLIPSE_LABELS, ECLIPSE_READOUT_KEYS } from './messages'
import {
  isEclipseCommand,
  type EclipseEventKind,
  type EclipseEventSummary,
  type EclipsePhaseBand,
  type EclipseSceneState,
  type EclipseSection,
  type EclipseViewMode,
} from './types'

const DEGREES_TO_RADIANS = Math.PI / 180
const ECLIPTIC_NORTH = new THREE.Vector3(0, 0, 1)
const ORBIT_SEGMENTS = 128
const GUIDE_EVENT_FROM_MS = Date.UTC(2026, 8, 18)

interface EclipseGuideSnapshot {
  section: EclipseSection
  view: EclipseViewMode
  events: EclipseEventSummary[]
  eventPeakMs: number
  timeMs: number
  observerOffsetLatDeg: number
  observerOffsetLonDeg: number
  showShadows: boolean
  showLabels: boolean
  showPlane: boolean
  teachingZeroInclination: boolean
  playing: boolean
  minutesPerSecond: number
  cameraPosition: THREE.Vector3
  cameraTarget: THREE.Vector3
  controlsEnabled: boolean
  userAdjustedCamera: boolean
}

/**
 * Screen-space nudges, in pixels, for labels whose anchor is not where the text should sit.
 *
 * The shell draws a label's text *above* its anchor, so a label that belongs below something has to
 * be anchored below it. That nudge has to be in pixels rather than in scene units: the two system
 * framings differ by a factor of about three in pixels per unit, so a scene-space offset would be
 * far too much in one section and nothing at all in the other.
 *
 * This is the one place a label's placement is not geometry, which is why it is a short, explicit
 * table rather than something folded into the anchor positions.
 */
const LABEL_SCREEN_NUDGE: Record<string, { x: number, y: number }> = {
  // Keep body names clear of the orbital-plane captions on narrow screens.
  earth: { x: 0, y: -10 },
  moon: { x: 0, y: -10 },
  // The two cone names otherwise land on the Moon label when the whole system is fitted to a phone.
  umbra: { x: 0, y: 10 },
  penumbra: { x: 0, y: 22 },
  antumbra: { x: 0, y: 18 },
  // Lift the inner plane's caption above its rim; the outer plane remains below its own rim.
  lunarPlane: { x: 0, y: -24 },
  // Dropped clear of the ecliptic line, so the text reads as belonging below that plane.
  eclipticPlane: { x: 0, y: 30 },
}

/**
 * Conservative half-widths of the rendered labels, including their small pill padding.
 *
 * English is wider than Chinese for every entry here. Keeping its measured widths in the scene lets
 * collision tests use the real shape of each caption and, crucially, apply the same edge clamp as
 * the DOM layer. Without that clamp a long label looked separate in projection, was pulled back
 * inside the phone viewport by the shell, and ended up covering the Earth label.
 */
const LABEL_HALF_WIDTH_PX: Record<string, number> = {
  umbra: 34,
  penumbra: 46,
  antumbra: 45,
  sun: 23,
  earth: 28,
  moon: 30,
  eclipticPlane: 58,
  lunarPlane: 84,
  peak: 67,
  observer: 42,
  ascendingNode: 68,
  descendingNode: 72,
}

/**
 * The eclipse demo.
 *
 * Two scales run side by side, and the split is enforced rather than merely intended. Every number
 * that decides *what* the viewer is looking at - which eclipse, how much of a disc is covered,
 * whether an umbra reaches - comes from `ephemeris.ts` and `geometry.ts` and is in real kilometres
 * and degrees. The numbers in `config.ts` decide only how large things are drawn, and the interface
 * says out loud that they are schematic.
 *
 * The frame is anchored on the Earth rather than the Sun: what the demo has to show is which body's
 * shadow falls on which, and that happens in the Earth-Moon system. The Sun is placed along its real
 * direction at a fixed drawn distance, so its bearing is real even though its distance is not.
 */
export class EclipseScene implements DemoScene {
  private readonly options: DemoSceneOptions
  private readonly stage: Stage
  private readonly ecliptic = new THREE.Group()
  private readonly system = new THREE.Group()
  private readonly sun = new THREE.Group()
  private readonly earth = new THREE.Group()
  private readonly moon = new THREE.Group()
  private readonly orbitPlane = new THREE.Group()
  private readonly markers = new THREE.Group()
  private readonly umbra: ShadowVolume
  private readonly penumbra: ShadowVolume
  private readonly antumbra: ShadowVolume
  private readonly sunLight: THREE.DirectionalLight
  private readonly moonMaterial: THREE.MeshStandardMaterial
  // Assigned by the build* methods, which always run from the constructor.
  private earthSurface!: THREE.Mesh
  private moonSurface!: THREE.Mesh
  private readonly lunarDisc: THREE.Mesh
  private readonly eclipticDisc: THREE.Mesh
  private readonly orbitLine: THREE.Line
  private readonly orbitPositions: Float32Array
  private readonly ascendingNodeMarker: THREE.Mesh
  private readonly descendingNodeMarker: THREE.Mesh
  private readonly peakMarker: THREE.Mesh
  private readonly observerMarker: THREE.Mesh
  private readonly umbraLabel: THREE.Object3D
  private readonly penumbraLabel: THREE.Object3D
  private readonly antumbraLabel: THREE.Object3D
  // Assigned by buildOrbitPlane, which always runs from the constructor.
  private eclipticLabel!: THREE.Object3D
  private lunarLabel!: THREE.Object3D
  private readonly labelTargets = new Map<string, THREE.Object3D>()
  private readonly bodyHalos = new Map<string, THREE.Mesh>()
  private readonly haloQuaternion = new THREE.Quaternion()
  private readonly projected = new THREE.Vector3()
  private readonly homePosition = new THREE.Vector3()
  private readonly homeTarget = new THREE.Vector3()

  private section: EclipseSection = 'solar'
  private view: EclipseViewMode = 'system'
  private showShadows = true
  private showLabels = true
  private showPlane = true
  private teachingZeroInclination = false
  private playing = true
  private minutesPerSecond = 1.5

  private timeMs = 0
  /** The scrubber's bounds: the event's own window plus a little either side. */
  private window: EclipsePhaseWindow = { startMs: 0, endMs: 1 }
  /** The event itself, from first to last contact, which is where playback opens. */
  private eventWindow: EclipsePhaseWindow = { startMs: 0, endMs: 1 }
  private events: EclipseEventSummary[] = []
  private eventIndex = 0
  private observerOffsetLatDeg = 0
  private observerOffsetLonDeg = 0
  private nodeLongitudeDeg = 0
  private observer: ObserverPosition = { latitudeDeg: 0, longitudeDeg: 0 }
  private peak: ObserverPosition | null = null
  private localEclipse: LocalSolarEclipse | null = null
  private lunarTiming: LunarEclipseTiming | null = null

  /** Live numbers for the panel. Recomputed every frame, published on a throttle. */
  private kind: EclipseSceneState['kind'] = 'none'
  private eventKind: EclipseSceneState['eventKind'] = 'none'
  private sunAngularRadiusDeg = 0
  private moonAngularRadiusDeg = 0
  private separationDeg = 0
  private obscuration = 0
  private skyOffsetDeg = { x: 0, y: 0 }
  private umbraAngularRadiusDeg = 0
  private penumbraAngularRadiusDeg = 0
  private umbraCoverage = 0
  private sunAltitudeDeg = 0
  private axisDistanceKm = 0
  private casterToTargetKm = 0
  private umbraLengthKm = 0
  private umbraRadiusAtTargetKm = 0
  private penumbraRadiusAtTargetKm = 0
  private moonEclipticLatitudeDeg = 0

  private stateElapsed = 0
  private readoutElapsed = 0
  /** The kind the last readout was published for, so a change of phase is not throttled away. */
  private publishedKind: EclipseEventKind | null = null
  /** The last geometry read, kept so the cone placement does not have to ask the ephemeris again. */
  private solarGeometry: SolarGeometry | null = null
  private lunarGeometry: LunarGeometry | null = null
  private framedAspect = 0
  private pendingAspect: number | null = null
  private userAdjustedCamera = false
  private guideSnapshot: EclipseGuideSnapshot | null = null
  private guideCue: string | null = null
  private guideProgress = 0
  private hoveredLabelId: string | null = null
  private guideWindow: EclipsePhaseWindow = { startMs: 0, endMs: 0 }
  private readonly prefersReducedMotion =
    typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private disposed = false

  constructor(container: HTMLElement, options: DemoSceneOptions = {}) {
    this.options = options

    this.stage = createStage(container, {
      cameraPosition: new THREE.Vector3(0, 9, 16),
      target: new THREE.Vector3(),
      fov: SCENE.cameraFieldOfViewDeg,
      minDistance: SCENE.minCameraDistance,
      maxDistance: SCENE.maxCameraDistance,
      onResize: (aspect) => {
        this.pendingAspect = aspect
      },
    })

    this.stage.scene.add(createStarfield({
      radius: 260,
      count: 1400,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    }))

    // Content is authored in ecliptic coordinates with +Z toward ecliptic north; this group turns
    // that into the renderer's y-up world. `system` carries no transform of its own - it exists so
    // everything the scene builds can be added and removed as one - so ecliptic coordinates and
    // `system` coordinates are the same numbers, which is what lets the camera framing work in
    // ecliptic terms and convert once at the end.
    this.ecliptic.rotation.x = SCENE.eclipticPlaneRotationXDeg * DEGREES_TO_RADIANS
    this.ecliptic.add(this.system)
    this.stage.scene.add(this.ecliptic)

    this.sunLight = new THREE.DirectionalLight(0xfff4e2, 2.7)
    this.system.add(this.sunLight, this.sunLight.target)
    this.system.add(new THREE.AmbientLight(0x2b3f5e, 0.5))

    this.moonMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      // A faint self-lit term keeps the Moon's far side readable as a disc. Without it the new Moon
      // of the solar section is a black circle on a black sky, which is correct and useless.
      emissive: 0x0c1220,
    })

    this.buildSun()
    const earthSurface = this.buildEarth()
    this.buildMoon()

    this.umbra = new ShadowVolume({
      color: COLOURS.umbra,
      opacity: 0.62,
      rimColor: COLOURS.umbraEdge,
      rimOpacity: 0.85,
    })
    this.penumbra = new ShadowVolume({
      color: COLOURS.penumbra,
      opacity: 0.16,
      rimColor: COLOURS.penumbra,
      rimOpacity: 0.4,
    })
    this.antumbra = new ShadowVolume({
      color: COLOURS.antumbra,
      opacity: 0.24,
      rimColor: COLOURS.antumbra,
      rimOpacity: 0.7,
    })
    this.system.add(this.umbra.group, this.penumbra.group, this.antumbra.group)

    const plane = this.buildOrbitPlane()
    this.eclipticDisc = plane.eclipticDisc
    this.lunarDisc = plane.lunarDisc
    this.orbitLine = plane.orbitLine
    this.orbitPositions = plane.orbitPositions
    this.ascendingNodeMarker = plane.ascendingNodeMarker
    this.descendingNodeMarker = plane.descendingNodeMarker
    this.system.add(this.orbitPlane)

    const markerMeshes = this.buildMarkers()
    this.peakMarker = markerMeshes.peak
    this.observerMarker = markerMeshes.observer
    this.system.add(this.markers)

    // The three cones are the demo's subject, so each carries a label anchor the scene places along
    // its own axis every frame - the cones change shape continuously and a fixed anchor would drift
    // off them.
    this.umbraLabel = new THREE.Object3D()
    this.penumbraLabel = new THREE.Object3D()
    this.antumbraLabel = new THREE.Object3D()
    this.system.add(this.umbraLabel, this.penumbraLabel, this.antumbraLabel)
    this.labelTargets.set('umbra', this.umbraLabel)
    this.labelTargets.set('penumbra', this.penumbraLabel)
    this.labelTargets.set('antumbra', this.antumbraLabel)

    this.loadTextures(earthSurface)

    this.reloadEvents()
    this.selectEvent(this.defaultEventIndex())

    this.stage.controls.addEventListener('start', this.handleControlsStart)

    this.stage.setFrameHandler((delta) => this.update(delta))
    this.syncVisibility()
    this.stage.start()
    this.publishState()
    this.publishReadout()
  }

  // ---------------------------------------------------------------- construction

  private buildSun(): void {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(DISPLAY_RADIUS.sun, 40, 28),
      new THREE.MeshBasicMaterial({ color: COLOURS.sun }),
    )
    this.sun.add(sphere)
    this.sun.add(createGlowSprite({
      color: COLOURS.sunGlow,
      size: DISPLAY_RADIUS.sun * SCENE.sunGlowScale,
      opacity: 0.85,
    }))
    this.sun.add(createStarburstSprite({
      color: 0xfff3d2,
      size: DISPLAY_RADIUS.sun * SCENE.sunStarburstScale,
      opacity: 0.45,
    }))
    this.system.add(this.sun)
    this.addBodyHalo('sun', this.sun, DISPLAY_RADIUS.sun)
    this.labelTargets.set('sun', anchorNorthOf(this.sun, DISPLAY_RADIUS.sun))
  }

  /**
   * Returns the globe's own sphere, which is where the shared day texture has to be attached.
   *
   * The globe carries no baked-in rotation: its orientation is set every frame from the real body
   * frame, because the demo marks places on the surface and the map has to turn underneath them.
   */
  private buildEarth(): THREE.Mesh {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0,
      emissive: 0x0b1e30,
      emissiveIntensity: 0.45,
    })
    this.earthSurface = createGlobe({ radius: DISPLAY_RADIUS.earth, material })
    this.earth.add(this.earthSurface)
    this.system.add(this.earth)
    this.addBodyHalo('earth', this.earth, DISPLAY_RADIUS.earth)
    this.labelTargets.set('earth', anchorNorthOf(this.earth, DISPLAY_RADIUS.earth))
    return this.earthSurface
  }

  private buildMoon(): void {
    this.moonSurface = createGlobe({ radius: DISPLAY_RADIUS.moon, material: this.moonMaterial })
    this.moon.add(this.moonSurface)
    this.system.add(this.moon)
    this.addBodyHalo('moon', this.moon, DISPLAY_RADIUS.moon)
    this.labelTargets.set('moon', anchorNorthOf(this.moon, DISPLAY_RADIUS.moon))
  }

  /**
   * Lines both globes up with the sky.
   *
   * This is the fix for a bug that was invisible until the Moon's map was looked at closely: a
   * textured sphere has its map's north pole on its own +Y, and a scene authored in ecliptic
   * coordinates has +Z as ecliptic north, so an unrotated globe lies on its side with its pole in
   * the orbital plane. The Moon was drawn that way, and the Earth was drawn with its obliquity
   * applied as a positive rotation about x, which leans it by the right number of degrees towards
   * the wrong solstice.
   *
   * Both are set from the real body frame now - pole and prime meridian, straight from the
   * ephemeris - so the map, the terminator and the two surface markers all agree.
   */
  private orientGlobes(): void {
    const earth = earthBodyFrame(this.timeMs)
    this.earthSurface.quaternion.copy(globeQuaternion(earth.pole, earth.primeMeridian))
    const moon = moonBodyFrame(this.timeMs)
    this.moonSurface.quaternion.copy(globeQuaternion(moon.pole, moon.primeMeridian))
  }

  private buildOrbitPlane(): {
    eclipticDisc: THREE.Mesh
    lunarDisc: THREE.Mesh
    orbitLine: THREE.Line
    orbitPositions: Float32Array
    ascendingNodeMarker: THREE.Mesh
    descendingNodeMarker: THREE.Mesh
  } {
    const eclipticDisc = new THREE.Mesh(
      new THREE.CircleGeometry(DISPLAY_PLANE_RADIUS.ecliptic, 96),
      new THREE.MeshBasicMaterial({
        color: COLOURS.eclipticPlane,
        transparent: true,
        opacity: 0.09,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    const lunarDisc = new THREE.Mesh(
      new THREE.CircleGeometry(DISPLAY_PLANE_RADIUS.lunar, 96),
      new THREE.MeshBasicMaterial({
        color: COLOURS.lunarPlane,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    // A rim on each disc, so a plane seen nearly edge-on still reads as a plane and not as a line.
    eclipticDisc.add(ringOutline(DISPLAY_PLANE_RADIUS.ecliptic, COLOURS.eclipticPlane, 0.42))
    lunarDisc.add(ringOutline(DISPLAY_PLANE_RADIUS.lunar, COLOURS.lunarPlane, 0.6))

    const orbitPositions = new Float32Array((ORBIT_SEGMENTS + 1) * 3)
    const orbitGeometry = new THREE.BufferGeometry()
    orbitGeometry.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3))
    const orbitLine = new THREE.Line(orbitGeometry, new THREE.LineBasicMaterial({
      color: COLOURS.moonOrbit,
      transparent: true,
      opacity: 0.5,
    }))

    const nodeGeometry = new THREE.SphereGeometry(0.07, 16, 12)
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: COLOURS.node })
    const ascendingNodeMarker = new THREE.Mesh(nodeGeometry, nodeMaterial)
    const descendingNodeMarker = new THREE.Mesh(nodeGeometry, nodeMaterial)

    // Both plane labels are placed every frame rather than pinned to a fixed bearing on their disc;
    // see `placePlaneLabels` for why a fixed bearing does not work.
    this.eclipticLabel = new THREE.Object3D()
    this.lunarLabel = new THREE.Object3D()

    this.orbitPlane.add(
      eclipticDisc,
      lunarDisc,
      orbitLine,
      ascendingNodeMarker,
      descendingNodeMarker,
      this.eclipticLabel,
      this.lunarLabel,
    )

    this.labelTargets.set('ascendingNode', ascendingNodeMarker)
    this.labelTargets.set('descendingNode', descendingNodeMarker)
    this.labelTargets.set('eclipticPlane', this.eclipticLabel)
    this.labelTargets.set('lunarPlane', this.lunarLabel)

    return { eclipticDisc, lunarDisc, orbitLine, orbitPositions, ascendingNodeMarker, descendingNodeMarker }
  }

  private addBodyHalo(id: string, body: THREE.Group, radius: number): void {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.07, radius * 1.13, 80),
      new THREE.MeshBasicMaterial({
        color: 0x8fe3e6,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
      }),
    )
    halo.visible = false
    halo.renderOrder = 10
    body.add(halo)
    this.bodyHalos.set(id, halo)
  }

  private buildMarkers(): { peak: THREE.Mesh, observer: THREE.Mesh } {
    const peak = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      new THREE.MeshBasicMaterial({ color: COLOURS.peakMarker }),
    )
    const observer = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      new THREE.MeshBasicMaterial({ color: COLOURS.observerMarker }),
    )
    this.markers.add(peak, observer)
    this.labelTargets.set('peak', peak)
    this.labelTargets.set('observer', observer)
    return { peak, observer }
  }

  /** Reuses the demo's existing Earth and Moon imagery rather than shipping copies of it. */
  private loadTextures(earthSurface: THREE.Mesh): void {
    const loader = new THREE.TextureLoader()
    const base = import.meta.env.BASE_URL
    const anisotropy = this.stage.renderer.capabilities.getMaxAnisotropy()

    const earthMaterial = earthSurface.material as THREE.MeshStandardMaterial
    const earthTexture = loader.load(
      `${base}demos/meteor-shower/earth-day.jpg`,
      undefined,
      undefined,
      () => {
        earthMaterial.map = null
        earthMaterial.needsUpdate = true
      },
    )
    earthTexture.colorSpace = THREE.SRGBColorSpace
    earthTexture.anisotropy = anisotropy
    earthMaterial.map = earthTexture
    earthMaterial.needsUpdate = true

    const moonTexture = loader.load(
      `${base}demos/moon/moon-color-4k.webp`,
      undefined,
      undefined,
      () => {
        this.moonMaterial.map = null
        this.moonMaterial.emissiveMap = null
        this.moonMaterial.needsUpdate = true
      },
    )
    moonTexture.colorSpace = THREE.SRGBColorSpace
    moonTexture.anisotropy = anisotropy
    this.moonMaterial.map = moonTexture
    this.moonMaterial.emissiveMap = moonTexture
    this.moonMaterial.needsUpdate = true
  }

  // ---------------------------------------------------------------- demo scene API

  applySettings(settings: Partial<DemoSceneSettings>): void {
    if (this.guideSnapshot) return
    // Only the transport lives in the shared settings for this demo. Every display switch belongs
    // to the demo's own panel, so the two cannot end up disagreeing about whether labels are on.
    if (typeof settings.playing === 'boolean') this.playing = settings.playing
    if (typeof settings.timeScale === 'number') this.minutesPerSecond = settings.timeScale
  }

  resetView(): void {
    this.userAdjustedCamera = false
    this.frameSystem(this.stage.camera.aspect)
    this.stage.resetView()
  }

  setSuspended(suspended: boolean): void {
    if (suspended) this.stage.stop()
    else this.stage.start()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stage.controls.removeEventListener('start', this.handleControlsStart)
    this.umbra.dispose()
    this.penumbra.dispose()
    this.antumbra.dispose()
    for (const halo of this.bodyHalos.values()) {
      halo.geometry.dispose()
      ;(halo.material as THREE.Material).dispose()
    }
    this.stage.dispose()
  }

  highlightLabel(id: string | null): void {
    this.hoveredLabelId = id && this.labelTargets.has(id) ? id : null
    this.updateEmphasis()
  }

  runCommand(command: unknown): void {
    if (this.guideSnapshot) return
    if (!isEclipseCommand(command)) return
    switch (command.type) {
      case 'section':
        this.setSection(command.section)
        return
      case 'view':
        this.view = command.view
        this.syncVisibility()
        this.publishState()
        return
      case 'toggle':
        if (command.control === 'shadows') this.showShadows = !this.showShadows
        else if (command.control === 'labels') this.showLabels = !this.showLabels
        else this.showPlane = !this.showPlane
        this.syncVisibility()
        this.publishState()
        return
      case 'teaching':
        this.teachingZeroInclination = command.enabled
        this.refreshOrbitPlane()
        this.publishState()
        return
      case 'scrub':
        this.scrubTo(command.timeMs)
        return
      case 'event':
        this.selectEvent(command.index)
        return
      case 'observer':
        this.setObserverOffset(command.latitudeOffsetDeg, command.longitudeOffsetDeg)
        return
      case 'scrub-to-peak':
        this.scrubTo(this.events[this.eventIndex]?.peakMs ?? this.timeMs)
        return
      case 'observer-preset':
        if (command.preset === 'central') this.setObserverOffset(0, 0)
        else this.moveObserverOffPath()
        return
      case 'reset':
        this.selectEvent(this.eventIndex)
        this.resetView()
        return
      default:
        return
    }
  }

  beginGuide(): void {
    if (this.guideSnapshot) return
    this.guideSnapshot = {
      section: this.section,
      view: this.view,
      events: this.events.map((event) => ({ ...event })),
      eventPeakMs: this.events[this.eventIndex]?.peakMs ?? this.timeMs,
      timeMs: this.timeMs,
      observerOffsetLatDeg: this.observerOffsetLatDeg,
      observerOffsetLonDeg: this.observerOffsetLonDeg,
      showShadows: this.showShadows,
      showLabels: this.showLabels,
      showPlane: this.showPlane,
      teachingZeroInclination: this.teachingZeroInclination,
      playing: this.playing,
      minutesPerSecond: this.minutesPerSecond,
      cameraPosition: this.stage.camera.position.clone(),
      cameraTarget: this.stage.controls.target.clone(),
      controlsEnabled: this.stage.controls.enabled,
      userAdjustedCamera: this.userAdjustedCamera,
    }
    this.playing = false
    this.stage.controls.enabled = false
    this.options.onSettingsResolved?.({ playing: false })
  }

  seekGuide(cueId: string, progress: number): void {
    if (!this.guideSnapshot) return
    if (this.guideCue !== cueId) this.prepareGuideCue(cueId)
    const fraction = Math.max(0, Math.min(1, progress))
    this.guideProgress = fraction
    this.updateEmphasis()
    const timeMs = this.guideWindow.startMs
      + (this.guideWindow.endMs - this.guideWindow.startMs) * fraction
    if (this.timeMs === timeMs) {
      this.publishState()
      return
    }
    this.timeMs = timeMs
    this.refreshReadouts()
    this.publishState()
    this.publishReadout()
  }

  endGuide(): void {
    const saved = this.guideSnapshot
    if (!saved) return
    this.guideSnapshot = null
    this.guideCue = null
    this.guideProgress = 0
    this.section = saved.section
    this.events = saved.events
    const selected = this.events.findIndex((event) => event.peakMs === saved.eventPeakMs)
    this.selectEvent(selected >= 0 ? selected : 0)
    this.setObserverOffset(saved.observerOffsetLatDeg, saved.observerOffsetLonDeg)
    this.view = saved.view
    this.showShadows = saved.showShadows
    this.showLabels = saved.showLabels
    this.showPlane = saved.showPlane
    this.teachingZeroInclination = saved.teachingZeroInclination
    this.timeMs = saved.timeMs
    this.minutesPerSecond = saved.minutesPerSecond
    this.playing = saved.playing
    this.refreshOrbitPlane()
    this.syncVisibility()
    this.refreshReadouts()
    this.stage.camera.position.copy(saved.cameraPosition)
    this.stage.controls.target.copy(saved.cameraTarget)
    this.stage.controls.enabled = saved.controlsEnabled
    this.stage.camera.lookAt(saved.cameraTarget)
    this.stage.controls.update()
    this.userAdjustedCamera = saved.userAdjustedCamera
    this.options.onSettingsResolved?.({ playing: saved.playing, timeScale: saved.minutesPerSecond })
    this.publishState()
    this.publishReadout()
    this.updateEmphasis()
  }

  private prepareGuideCue(cueId: string): void {
    const section: EclipseSection = cueId.startsWith('solar-') ? 'solar' : 'lunar'
    const view: EclipseViewMode = cueId === 'solar-alignment'
      || cueId === 'lunar-alignment' || cueId === 'inclination' ? 'system' : 'observer'
    if (this.guideCue === null || this.section !== section) {
      this.section = section
      this.events = section === 'solar'
        ? nextSolarEclipses(GUIDE_EVENT_FROM_MS, EVENT_LIST_LENGTH)
        : nextLunarEclipses(GUIDE_EVENT_FROM_MS, EVENT_LIST_LENGTH)
      this.selectEvent(this.defaultEventIndex())
    }
    this.guideCue = cueId
    this.guideProgress = 0
    this.playing = false
    this.options.onSettingsResolved?.({ playing: false })
    this.view = view
    this.showShadows = true
    this.showLabels = true
    this.showPlane = true
    this.teachingZeroInclination = false
    if (section === 'solar' && (this.observerOffsetLatDeg !== 0 || this.observerOffsetLonDeg !== 0)) {
      this.setObserverOffset(0, 0)
    }
    this.refreshOrbitPlane()
    this.syncVisibility()
    if (view === 'system') this.resetView()

    const peak = this.events[this.eventIndex]?.peakMs ?? this.timeMs
    let bands = this.phaseBands()
    if (section === 'lunar' && (cueId === 'lunar-partial' || cueId === 'lunar-total')) {
      const partial = bands.find((band) => band.kind === 'partial')
      if (partial && bands.some((band) => band.kind === 'total')) {
        const contact = firstTotalContact(partial.startMs, peak,
          (timeMs) => lunarGeometryAt(timeMs).kind === 'total')
        bands = bands.map((band) => band.kind === 'total' ? { ...band, startMs: contact } : band)
      }
    }
    this.guideWindow = eclipseGuideWindow(cueId as EclipseGuideCue, peak, bands)
    this.timeMs = this.guideWindow.startMs
    this.refreshReadouts()
    this.publishState()
    this.publishReadout()
    this.updateEmphasis()
  }

  // ---------------------------------------------------------------- commands

  private setSection(section: EclipseSection): void {
    if (this.section === section) return
    this.section = section
    this.observerOffsetLatDeg = 0
    this.observerOffsetLonDeg = 0
    this.reloadEvents()
    this.selectEvent(this.defaultEventIndex())
  }

  private defaultEventIndex(): number {
    // Lead with a complete alignment, while keeping the chronological picker intact.
    const totalIndex = this.events.findIndex((event) => event.kind === 'total')
    return totalIndex >= 0 ? totalIndex : 0
  }

  private reloadEvents(): void {
    const from = Date.now()
    this.events = this.section === 'solar'
      ? nextSolarEclipses(from, EVENT_LIST_LENGTH)
      : nextLunarEclipses(from, EVENT_LIST_LENGTH)
  }

  private scrubTo(timeMs: number): void {
    this.timeMs = Math.min(this.window.endMs, Math.max(this.window.startMs, timeMs))
    // Read the numbers for the new instant before publishing them. A command has to publish a state
    // that already reflects it; waiting for the next frame publishes the previous instant's
    // classification, which is how the panel and the readout ended up disagreeing.
    this.refreshReadouts()
    // Dragging the timeline pauses it. A running clock fights the drag: the thumb jumps back to
    // wherever playback has got to between the pointer's moves and the next published frame. The
    // play button is right there to start it again.
    if (this.playing) {
      this.playing = false
      this.options.onSettingsResolved?.({ playing: false })
    }
    this.publishState()
    this.publishReadout()
  }

  /**
   * Sets playback so that the selected eclipse plays out in about `targetPlaybackSeconds`.
   *
   * The events on offer run from under two hours to over six, so one fixed speed either rushes the
   * short ones past or leaves the viewer waiting through the long ones. The speed is reported back
   * to the shell, so the transport's readout shows the value actually in use rather than a
   * placeholder - which is the whole reason `onSettingsResolved` exists.
   */
  private applyPlaybackSpeed(): void {
    const minutes = Math.max(1, (this.eventWindow.endMs - this.eventWindow.startMs) / 60_000)
    const speed = Math.min(
      SCENE.minutesPerSecond.max,
      Math.max(SCENE.minutesPerSecond.min, minutes / SCENE.targetPlaybackSeconds),
    )
    this.minutesPerSecond = Number(speed.toFixed(2))
    this.options.onSettingsResolved?.({ timeScale: this.minutesPerSecond })
  }

  /**
   * Loads one eclipse and rewinds to its first contact.
   *
   * The whole timeline - the scrubber's bounds, the phase bands, the observer's default position and
   * the local contact times - is derived from the event, so choosing an event is the only thing that
   * has to happen for everything downstream to be right.
   */
  private selectEvent(index: number): void {
    if (this.events.length === 0) return
    this.eventIndex = Math.min(Math.max(index, 0), this.events.length - 1)
    const event = this.events[this.eventIndex]
    this.eventKind = event.kind

    if (this.section === 'solar') {
      this.peak = event.latitudeDeg !== null && event.longitudeDeg !== null
        ? { latitudeDeg: event.latitudeDeg, longitudeDeg: event.longitudeDeg }
        : null
      this.observer = this.peak
        ? { ...this.peak }
        : { latitudeDeg: 0, longitudeDeg: 0 }
      this.recomputeLocalSolarEclipse()
    } else {
      this.peak = null
      this.lunarTiming = lunarEclipseTiming(event.peakMs)
      this.eventWindow = this.lunarEventWindow(this.lunarTiming)
      this.window = padWindow(this.eventWindow, SCENE.windowPaddingSeconds * 1000)
      this.localEclipse = null
      this.applyPlaybackSpeed()
    }

    this.nodeLongitudeDeg = moonOrbitFrame(event.peakMs).ascendingNodeLongitudeDeg
    // Open on first contact rather than on the padded start: the first frame should already be the
    // alignment the demo is about, not the clear sky half an hour before it. A minute *inside* it,
    // though, because exactly on first contact the Moon's limb has only just reached the shadow and
    // the classification can fall either side of the boundary - which made a lunar eclipse open on
    // "no eclipse at all".
    const span = this.eventWindow.endMs - this.eventWindow.startMs
    this.timeMs = this.eventWindow.startMs + Math.min(60_000, span * 0.01)
    // A demo that starts moving on its own is exactly what a reduced-motion preference asks not to
    // happen, so it opens paused and waits for the play button.
    this.playing = !this.prefersReducedMotion
    this.options.onSettingsResolved?.({ playing: this.playing })
    this.refreshOrbitPlane()
    this.frameSystem(this.stage.camera.aspect)
    this.stage.camera.position.copy(this.homePosition)
    this.stage.controls.target.copy(this.homeTarget)
    this.stage.camera.lookAt(this.homeTarget)
    this.stage.controls.update()
    this.userAdjustedCamera = false
    this.refreshReadouts()
    this.publishState()
    this.publishReadout()
  }

  /**
   * A lunar eclipse's own window: the widest phase it reaches.
   *
   * Which phase that is comes straight from the library's semi-durations, so a penumbral eclipse
   * gets a penumbral window and a total one gets a window that contains its totality - no separate
   * rule for each kind.
   */
  private lunarEventWindow(timing: LunarEclipseTiming): EclipsePhaseWindow {
    const windows = lunarPhaseWindows({
      peakMs: timing.peakMs,
      penumbralSemiDurationMinutes: timing.penumbralSemiDurationMinutes,
      partialSemiDurationMinutes: timing.partialSemiDurationMinutes,
      totalSemiDurationMinutes: timing.totalSemiDurationMinutes,
    })
    return windows.penumbral ?? windows.partial ?? windows.total
      ?? { startMs: timing.peakMs - 3600_000, endMs: timing.peakMs + 3600_000 }
  }

  private recomputeLocalSolarEclipse(): void {
    const event = this.events[this.eventIndex]
    const local = localSolarEclipse(event.peakMs - 5 * 86_400_000, this.observer)
    // A search from the observer's own coordinates can return a *different* eclipse when they are
    // far off the path: the next one they can see, which may be months later. Adopting its contacts
    // would silently move the whole timeline out from under the selected event, so a result that is
    // not this event is discarded and the window falls back to the global peak.
    const sameEvent = Math.abs(local.peakMs - event.peakMs) < 86_400_000
    this.localEclipse = sameEvent ? local : null
    this.eventKind = sameEvent ? local.kind : event.kind
    this.eventWindow = sameEvent
      ? { startMs: local.partialBeginMs, endMs: local.partialEndMs }
      : { startMs: event.peakMs - 3 * 3600_000, endMs: event.peakMs + 3 * 3600_000 }
    this.window = padWindow(this.eventWindow, SCENE.windowPaddingSeconds * 1000)
    this.applyPlaybackSpeed()
  }

  /**
   * Moves the observer to the nearest place that sees a partial eclipse.
   *
   * The walk itself is `findPartialOffset`, which is pure and tested; all this adds is the lookup it
   * walks with - the library's own local search, guarded against returning a different eclipse when
   * the observer is far off the path.
   */
  private moveObserverOffPath(): void {
    if (this.section !== 'solar' || !this.peak) return
    const peak = this.peak
    const event = this.events[this.eventIndex]
    const searchStart = event.peakMs - 5 * 86_400_000

    const kindAt = (latitudeOffsetDeg: number, longitudeOffsetDeg: number): EclipseEventKind | null => {
      const local = localSolarEclipse(searchStart, {
        latitudeDeg: Math.min(89.5, Math.max(-89.5, peak.latitudeDeg + latitudeOffsetDeg)),
        longitudeDeg: wrapLongitude(peak.longitudeDeg + longitudeOffsetDeg),
      })
      return Math.abs(local.peakMs - event.peakMs) < 86_400_000 ? local.kind : null
    }

    // Already off the path: nothing to do, and moving would only take the viewer further away.
    if (kindAt(this.observerOffsetLatDeg, this.observerOffsetLonDeg) === 'partial') return

    const found = findPartialOffset(kindAt, SCENE.observerOffsetStepDeg, SCENE.observerOffsetLimitDeg)
    this.setObserverOffset(found?.latitudeOffsetDeg ?? 0, found?.longitudeOffsetDeg ?? 0)
  }

  private setObserverOffset(latitudeOffsetDeg: number, longitudeOffsetDeg: number): void {
    const limit = SCENE.observerOffsetLimitDeg
    this.observerOffsetLatDeg = Math.min(limit, Math.max(-limit, latitudeOffsetDeg))
    this.observerOffsetLonDeg = Math.min(limit, Math.max(-limit, longitudeOffsetDeg))
    if (this.section !== 'solar' || !this.peak) return
    this.observer = {
      latitudeDeg: Math.min(89.5, Math.max(-89.5, this.peak.latitudeDeg + this.observerOffsetLatDeg)),
      longitudeDeg: wrapLongitude(this.peak.longitudeDeg + this.observerOffsetLonDeg),
    }
    this.recomputeLocalSolarEclipse()
    this.timeMs = Math.min(this.window.endMs, Math.max(this.window.startMs, this.timeMs))
    this.refreshReadouts()
    this.publishState()
    this.publishReadout()
  }

  // ---------------------------------------------------------------- per frame

  private update(deltaSeconds: number): void {
    this.applyPendingFraming()

    if (this.playing) {
      this.timeMs += deltaSeconds * this.minutesPerSecond * 60_000
      if (this.timeMs >= this.window.endMs) {
        this.timeMs = this.window.endMs
        this.playing = false
        this.options.onSettingsResolved?.({ playing: false })
        this.publishState()
      }
    }

    const state = geocentricState(this.timeMs)
    this.sun.position.copy(state.sunDirection).multiplyScalar(DISPLAY_SUN_DISTANCE)
    this.sunLight.position.copy(this.sun.position)
    this.sunLight.target.position.set(0, 0, 0)
    this.moon.position
      .copy(state.moonFromEarthKm)
      .normalize()
      .multiplyScalar(DISPLAY_MOON_ORBIT)

    // One geometry pass per frame: the section decides which one, and the Moon's own colour needs
    // the same numbers, so it is read once and handed to the step that places the cones.
    if (this.section === 'solar') {
      this.solarGeometry = this.readSolarReadouts()
      this.placeSolarCones(this.solarGeometry)
    } else {
      this.lunarGeometry = this.readLunarReadouts()
      this.placeLunarCones(this.lunarGeometry)
    }

    this.orientGlobes()
    this.updateMarkers()
    this.placePlaneLabels()
    this.updateEmphasis()
    this.updateLabels()

    this.stateElapsed += deltaSeconds
    if (this.stateElapsed >= SCENE.stateIntervalSeconds) {
      this.stateElapsed = 0
      this.publishState()
    }
    this.readoutElapsed += deltaSeconds
    // The readout is on a coarser throttle than the state, which is fine for a clock but not for
    // the classification: an annular phase lasts a couple of minutes of simulated time, which
    // playback crosses in about a second, so a throttled readout can miss it entirely and sit there
    // disagreeing with the panel about what is happening. A change of kind publishes at once.
    if (this.readoutElapsed >= 0.5 || this.kind !== this.publishedKind) {
      this.readoutElapsed = 0
      this.publishReadout()
    }
  }

  /**
   * The solar section's numbers, without touching the 3D.
   *
   * Reading the ephemeris and placing the cones are separate steps on purpose. A command can change
   * the instant or the observer and has to publish a state that already reflects it, and doing the
   * two together would either publish a stale classification or move the cones to where the Moon was
   * on the previous frame.
   */
  private readSolarReadouts(): SolarGeometry {
    const geometry = solarGeometryAt(this.timeMs, this.observer)
    this.kind = geometry.kind
    this.moonEclipticLatitudeDeg = geometry.state.moonEclipticLatitudeDeg
    this.sunAngularRadiusDeg = geometry.observer.sunAngularRadiusDeg
    this.moonAngularRadiusDeg = geometry.observer.moonAngularRadiusDeg
    this.separationDeg = geometry.observer.separationDeg
    this.obscuration = geometry.observer.obscuration
    this.skyOffsetDeg = geometry.observer.skyOffsetDeg
    this.umbraCoverage = 0
    this.sunAltitudeDeg = geometry.observer.sunAltitudeDeg
    this.axisDistanceKm = 0
    // The Earth's shadow is not what this section is about, so the panel's lunar readouts are zero
    // rather than a stale number from the other section.
    this.umbraAngularRadiusDeg = 0
    this.penumbraAngularRadiusDeg = 0

    const shadow = geometry.shadow
    this.casterToTargetKm = shadow.casterToTargetKm
    this.umbraLengthKm = shadow.cone.umbraLengthKm
    this.umbraRadiusAtTargetKm = shadow.umbraRadiusAtTargetKm
    this.penumbraRadiusAtTargetKm = shadow.penumbraRadiusAtTargetKm
    return geometry
  }

  private placeSolarCones(geometry: SolarGeometry): void {
    // Cast by the Moon, from the Moon's drawn position, aimed away from the Sun.
    const origin = this.moon.position
    const axis = origin.clone().normalize().negate()
    const display = displayShadowCone({
      cone: geometry.shadow.cone,
      casterDisplayRadius: DISPLAY_RADIUS.moon,
      casterRadiusKm: BODY_RADIUS_KM.moon,
      displayTargetDistance: DISPLAY_MOON_ORBIT,
      realTargetDistanceKm: geometry.shadow.casterToTargetKm,
    })
    this.umbra.update(origin, axis, display.baseRadius, display.farRadius, display.length)
    this.penumbra.update(origin, axis, display.baseRadius, display.penumbraFarRadius, display.penumbraLength)
    this.antumbra.update(
      origin.clone().addScaledVector(axis, display.length),
      axis,
      Math.max(display.farRadius, 1e-4),
      display.antumbraFarRadius,
      Math.max(display.antumbraLength, 1e-4),
    )
    this.antumbra.setVisible(this.showShadows && display.antumbra)
    this.placeShadowLabels(origin, axis, display)
    // A new Moon: the side facing the Earth is the unlit one, so nothing dims it and nothing
    // reddens it. Its faint self-lit term is what keeps it readable as a disc.
    this.updateMoonAppearance(0, 0)
  }

  private readLunarReadouts(): LunarGeometry {
    const geometry = lunarGeometryAt(this.timeMs)
    this.kind = geometry.kind
    this.moonEclipticLatitudeDeg = geometry.state.moonEclipticLatitudeDeg
    this.umbraCoverage = geometry.umbraCoverage
    this.axisDistanceKm = geometry.axisDistanceKm
    this.sunAltitudeDeg = 0
    this.umbraAngularRadiusDeg = geometry.umbraAngularRadiusDeg
    this.penumbraAngularRadiusDeg = geometry.penumbraAngularRadiusDeg
    this.skyOffsetDeg = geometry.skyOffsetDeg
    this.moonAngularRadiusDeg = geometry.moonAngularRadiusDeg
    this.separationDeg = Math.hypot(geometry.skyOffsetDeg.x, geometry.skyOffsetDeg.y)
    // What the observer is watching here is the Moon against the Earth's shadow, so the covered
    // fraction is the umbra's.
    this.obscuration = geometry.umbraCoverage
    this.sunAngularRadiusDeg = 0

    const shadow = geometry.shadow
    this.casterToTargetKm = shadow.casterToTargetKm
    this.umbraLengthKm = shadow.cone.umbraLengthKm
    this.umbraRadiusAtTargetKm = shadow.umbraRadiusAtTargetKm
    this.penumbraRadiusAtTargetKm = shadow.penumbraRadiusAtTargetKm
    return geometry
  }

  private placeLunarCones(geometry: LunarGeometry): void {
    // Cast by the Earth, which sits at the frame's origin, aimed anti-sunward.
    const axis = geometry.state.sunDirection.clone().negate()
    const display = displayShadowCone({
      cone: geometry.shadow.cone,
      casterDisplayRadius: DISPLAY_RADIUS.earth,
      casterRadiusKm: BODY_RADIUS_KM.earth,
      displayTargetDistance: DISPLAY_MOON_ORBIT,
      realTargetDistanceKm: geometry.shadow.casterToTargetKm,
    })
    const origin = new THREE.Vector3()
    this.umbra.update(origin, axis, display.baseRadius, display.farRadius, display.length)
    this.penumbra.update(origin, axis, display.baseRadius, display.penumbraFarRadius, display.penumbraLength)
    this.antumbra.setVisible(false)
    this.placeShadowLabels(origin, axis, display)
    // The dimming is the real fraction of the Moon's disc inside the penumbra, not a curve fitted
    // to how the eclipse looks: the same overlap integral that decides whether the eclipse is
    // penumbral at all decides how much of the Moon is shaded.
    this.updateMoonAppearance(
      obscurationFraction(
        geometry.shadow.targetRadiusKm,
        geometry.shadow.penumbraRadiusAtTargetKm,
        geometry.axisDistanceKm,
      ),
      geometry.umbraCoverage,
    )
  }

  /** Recomputes the numbers for whatever the current instant and observer now are. */
  private refreshReadouts(): void {
    if (this.events.length === 0) return
    if (this.section === 'solar') this.solarGeometry = this.readSolarReadouts()
    else this.lunarGeometry = this.readLunarReadouts()
  }

  /**
   * Puts the three cone labels on the cones themselves.
   *
   * They are laid out as a triangle rather than in a line, and that is the whole of the design. All
   * three name parts of one shape only a couple of hundred pixels long on screen, so anchors placed
   * near each other get thinned away - and the penumbra's was the one being lost, which is the wrong
   * label to lose when telling an umbra from a penumbra is the point of the demo. The umbra's sits
   * on the axis half way along; the penumbra's and the antumbra's sit off to the same side, near the
   * two ends, where each of them actually is.
   */
  private placeShadowLabels(
    origin: THREE.Vector3,
    axis: THREE.Vector3,
    display: DisplayShadowCone,
  ): void {
    const side = new THREE.Vector3().crossVectors(axis, ECLIPTIC_NORTH)
    if (side.lengthSq() < 1e-9) side.set(0, 1, 0)
    side.normalize()

    // Far enough off the axis to clear it, and further still for a cone that is wider there.
    const lateral = SCENE.labelLateralOffset + display.penumbraFarRadius * SCENE.labelLateralPerRadius

    // In the lunar section the Moon sits at the cone's far end. Pulling the umbra caption toward
    // Earth leaves room for the Moon's own label on a phone; the solar section has the Earth at the
    // far end and keeps the caption farther along the much narrower lunar cone.
    const umbraLabelAlong = this.section === 'lunar' ? 0.25 : 0.65
    this.umbraLabel.position.copy(origin).addScaledVector(axis, display.length * umbraLabelAlong)
    this.penumbraLabel.position
      .copy(origin)
      .addScaledVector(axis, display.length * 0.3)
      .addScaledVector(side, lateral)
    this.antumbraLabel.position
      .copy(origin)
      .addScaledVector(axis, (display.length + display.antumbraLength) * 0.95)
      .addScaledVector(side, lateral)
  }

  /**
   * The two surface points of the solar section.
   *
   * Both are placed by their real direction from the Earth's centre, which the ephemeris supplies
   * with the sidereal rotation already in it - so the observer drifts across the globe as the
   * eclipse unfolds, and both markers are on the sunlit side because that is where they really are.
   *
   * What is deliberately not modelled is the Earth's own spin, so the globe's texture does not turn
   * underneath them. The markers are therefore placed by direction rather than by map geography.
   */
  private updateMarkers(): void {
    const show = this.section === 'solar'
    this.markers.visible = show
    if (!show) return
    this.observerMarker.position
      .copy(observerDirection(this.timeMs, this.observer))
      .multiplyScalar(DISPLAY_RADIUS.earth)
    this.peakMarker.visible = this.peak !== null
    if (this.peak) {
      this.peakMarker.position
        .copy(observerDirection(this.timeMs, this.peak))
        .multiplyScalar(DISPLAY_RADIUS.earth)
    }
  }

  /**
   * The Moon's colour, from the two real coverages.
   *
   * Nothing here is decorative: the dimming is the fraction of the disc inside the penumbra and the
   * copper is the fraction inside the umbra, so the Moon turns red exactly when the geometry says it
   * is wholly in shadow, and not a moment earlier.
   */
  private updateMoonAppearance(penumbraCoverage: number, umbraCoverage: number): void {
    const dim = 1 - 0.55 * Math.min(1, penumbraCoverage)
    this.moonMaterial.color.setRGB(dim, dim, dim * 0.99)
    // The base term is the faint self-lit disc; the copper is the refracted sunlight that reaches
    // the Moon through the Earth's atmosphere during totality. See the copy in the locale bundles:
    // it is an approximation of that effect, not a measurement of it.
    const copper = umbraCoverage * 0.85
    this.moonMaterial.emissive.setRGB(0.05 + 0.71 * copper, 0.07 + 0.32 * copper, 0.11 + 0.16 * copper)
  }

  private updateEmphasis(): void {
    const ids = this.guideSnapshot
      ? GUIDE_SYSTEM_FOCUS[this.guideCue as EclipseGuideCue] ?? []
      : this.hoveredLabelId ? [this.hoveredLabelId] : []
    const active = new Set(ids)
    const strength = this.guideSnapshot ? guideFocusStrength(this.guideProgress) : 1

    this.ecliptic.getWorldQuaternion(this.haloQuaternion).invert().multiply(this.stage.camera.quaternion)
    for (const [id, halo] of this.bodyHalos) {
      halo.visible = this.view === 'system' && active.has(id)
      if (!halo.visible) continue
      halo.quaternion.copy(this.haloQuaternion)
      halo.scale.setScalar(1 + strength * 0.025)
      ;(halo.material as THREE.MeshBasicMaterial).opacity = strength * 0.9
    }

    this.umbra.setEmphasis(active.has('umbra') ? strength : 0)
    this.penumbra.setEmphasis(active.has('penumbra') ? strength : 0)
    this.antumbra.setEmphasis(active.has('antumbra') ? strength : 0)

    const plane = (mesh: THREE.Mesh, id: string, baseFill: number, baseRim: number): void => {
      const amount = active.has(id) ? strength : 0
      ;(mesh.material as THREE.MeshBasicMaterial).opacity = baseFill + amount * 0.2
      const rim = mesh.children[0] as THREE.LineLoop
      ;(rim.material as THREE.LineBasicMaterial).opacity = Math.min(1, baseRim + amount * 0.35)
    }
    plane(this.eclipticDisc, 'eclipticPlane', 0.09, 0.42)
    plane(this.lunarDisc, 'lunarPlane', 0.13, 0.6)
    ;(this.orbitLine.material as THREE.LineBasicMaterial).opacity = active.has('lunarPlane') ? 0.9 : 0.5

    for (const [id, marker] of [
      ['ascendingNode', this.ascendingNodeMarker],
      ['descendingNode', this.descendingNodeMarker],
      ['peak', this.peakMarker],
      ['observer', this.observerMarker],
    ] as const) marker.scale.setScalar(active.has(id) ? 1 + strength * 1.3 : 1)
  }

  private syncVisibility(): void {
    this.umbra.setVisible(this.showShadows)
    this.penumbra.setVisible(this.showShadows)
    if (this.section === 'lunar') this.antumbra.setVisible(false)
    this.orbitPlane.visible = this.showPlane
    if (!this.showLabels) this.options.onLabels?.([])
  }

  private refreshOrbitPlane(): void {
    const inclination = this.teachingZeroInclination ? 0 : MOON_ORBIT_INCLINATION_DEG
    const basis = orbitPlaneBasis(inclination, this.nodeLongitudeDeg)

    this.lunarDisc.quaternion.setFromUnitVectors(ECLIPTIC_NORTH, basis.normal)

    const positions = this.orbitPositions
    for (let step = 0; step <= ORBIT_SEGMENTS; step += 1) {
      const angle = (step / ORBIT_SEGMENTS) * Math.PI * 2
      const along = Math.cos(angle) * DISPLAY_MOON_ORBIT
      const across = Math.sin(angle) * DISPLAY_MOON_ORBIT
      positions[step * 3] = basis.ascendingNode.x * along + basis.inPlane.x * across
      positions[step * 3 + 1] = basis.ascendingNode.y * along + basis.inPlane.y * across
      positions[step * 3 + 2] = basis.ascendingNode.z * along + basis.inPlane.z * across
    }
    this.orbitLine.geometry.getAttribute('position').needsUpdate = true
    this.orbitLine.geometry.computeBoundingSphere()

    this.ascendingNodeMarker.position.copy(basis.ascendingNode).multiplyScalar(DISPLAY_MOON_ORBIT)
    this.descendingNodeMarker.position.copy(basis.descendingNode).multiplyScalar(DISPLAY_MOON_ORBIT)
  }

  /**
   * Puts the two plane labels out along the Sun-Earth axis, stacked one above the other, at whichever
   * end of it is emptier.
   *
   * Both the axis and the stacking are forced by the geometry, and it took three wrong answers to
   * find them:
   *
   * - **Along the Sun-Earth axis.** The camera looks along that axis, so a label placed on the
   *   camera's own right direction lands among the Sun's, the Moon's and the cones' labels. The two
   *   discs are concentric, so the only place their rims pull apart far enough to be told apart is
   *   where the radial direction is not foreshortened, and that is the two ends of this axis.
   * - **The emptier end, not a fixed one.** Each section has a body near one end: the Moon sits
   *   sunward in a solar eclipse and anti-solar in a lunar one. Taking the end whose nearest body is
   *   furthest away clears both, which is why the direction is measured rather than assumed.
   * - **Stacked, because a 5.14 degree tilt is small.** The rims are about 29 pixels apart at the
   *   ends of the axis and only 12 at the top and bottom, so a label at the top cannot say which
   *   ellipse it belongs to. Separated across the axis instead, one clearly inside the lunar disc and
   *   one clearly out on the ecliptic's rim, each is unambiguous.
   */
  private placePlaneLabels(): void {
    const sunward = this.sun.position.clone().normalize()
    if (sunward.lengthSq() < 1e-8) sunward.set(1, 0, 0)

    // How far the ecliptic label's anchor would sit from the nearest body, at each end.
    const anchorRadius = DISPLAY_PLANE_RADIUS.ecliptic * SCENE.eclipticPlaneLabelRadius
    let away = sunward
    let bestClearance = -1
    for (const candidate of [sunward, sunward.clone().negate()]) {
      const anchor = candidate.clone().multiplyScalar(anchorRadius)
      const clearance = Math.min(
        anchor.distanceTo(this.sun.position),
        anchor.distanceTo(this.moon.position),
      )
      if (clearance > bestClearance) {
        bestClearance = clearance
        away = candidate
      }
    }

    const normal = ECLIPTIC_NORTH.clone().applyQuaternion(this.lunarDisc.quaternion)

    this.eclipticLabel.position
      .copy(away)
      .multiplyScalar(anchorRadius)
    this.lunarLabel.position
      .copy(away)
      .multiplyScalar(DISPLAY_PLANE_RADIUS.lunar * SCENE.lunarPlaneLabelRadius)
      .addScaledVector(normal, DISPLAY_PLANE_RADIUS.lunar * SCENE.lunarPlaneLabelLift)
  }

  // ---------------------------------------------------------------- framing

  /**
   * Frames the alignment side-on.
   *
   * A fixed camera angle would sometimes look straight down the Sun-Earth-Moon line, which is the
   * one direction in which the whole diagram collapses into a single dot. Placing the camera
   * perpendicular to that line - with a modest tilt out of the ecliptic - guarantees the viewer sees
   * the cones and the bodies beside each other on the first frame, whichever eclipse is loaded.
   */
  private frameSystem(aspect: number): void {
    const state = geocentricState(this.timeMs)
    const sunLocal = state.sunDirection.clone().multiplyScalar(DISPLAY_SUN_DISTANCE)
    const moonLocal = state.moonFromEarthKm.clone().normalize().multiplyScalar(DISPLAY_MOON_ORBIT)

    const axis = moonLocal.clone().sub(sunLocal)
    if (axis.lengthSq() < 1e-9) axis.copy(state.sunDirection)
    axis.normalize()
    const side = new THREE.Vector3().crossVectors(axis, ECLIPTIC_NORTH)
    if (side.lengthSq() < 1e-9) side.set(0, 1, 0)
    side.normalize()

    const elevation = SCENE.cameraElevationDeg * DEGREES_TO_RADIANS
    const direction = side.multiplyScalar(Math.cos(elevation))
      .addScaledVector(ECLIPTIC_NORTH, Math.sin(elevation))
      .normalize()

    const box = new THREE.Box3().setFromPoints([sunLocal, moonLocal, new THREE.Vector3()])
    const target = box.getCenter(new THREE.Vector3())
    let radius = 0
    for (const point of [sunLocal, moonLocal, new THREE.Vector3()]) {
      radius = Math.max(radius, point.distanceTo(target))
    }
    radius += SCENE.framingMargin

    const vertical = (SCENE.cameraFieldOfViewDeg * DEGREES_TO_RADIANS) / 2
    // The narrower of the two half-angles is what constrains the fit, so a portrait viewport has to
    // be fitted to its width. The floor is only here to stop an absurdly tall viewport pushing the
    // camera into the distance; setting it too high - 0.6 was - makes the fit wrong instead, and the
    // Earth ends up clipped off the right edge on a phone.
    const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.35, aspect))
    const distance = radius / (Math.sin(Math.min(vertical, horizontal)) * SCENE.cameraFramingFill)

    this.ecliptic.updateMatrixWorld(true)
    this.homeTarget.copy(this.ecliptic.localToWorld(target))
    this.homePosition.copy(this.ecliptic.localToWorld(target.clone().addScaledVector(direction, distance)))
    this.framedAspect = aspect
    this.stage.setHomeView(this.homePosition, this.homeTarget)
  }

  private applyPendingFraming(): void {
    const aspect = this.pendingAspect
    this.pendingAspect = null
    if (aspect === null) return
    if (this.framedAspect > 0 && Math.abs(aspect - this.framedAspect) / this.framedAspect < 0.03) return
    this.frameSystem(aspect)
    if (this.userAdjustedCamera) return
    this.stage.camera.position.copy(this.homePosition)
    this.stage.controls.target.copy(this.homeTarget)
    this.stage.camera.lookAt(this.homeTarget)
  }

  // ---------------------------------------------------------------- publishing

  private snapshot(): EclipseSceneState {
    return {
      section: this.section,
      view: this.view,
      showShadows: this.showShadows,
      showLabels: this.showLabels,
      showPlane: this.showPlane,
      teachingZeroInclination: this.teachingZeroInclination,
      playing: this.playing,
      guideCue: this.guideSnapshot ? this.guideCue : null,
      guideProgress: this.guideSnapshot ? this.guideProgress : 0,
      timeMs: this.timeMs,
      windowStartMs: this.window.startMs,
      windowEndMs: this.window.endMs,
      peakMs: this.events[this.eventIndex]?.peakMs ?? this.timeMs,
      kind: this.kind,
      eventKind: this.eventKind,
      sunAngularRadiusDeg: this.sunAngularRadiusDeg,
      moonAngularRadiusDeg: this.moonAngularRadiusDeg,
      separationDeg: this.separationDeg,
      obscuration: this.obscuration,
      skyOffsetDeg: { ...this.skyOffsetDeg },
      umbraAngularRadiusDeg: this.umbraAngularRadiusDeg,
      penumbraAngularRadiusDeg: this.penumbraAngularRadiusDeg,
      umbraCoverage: this.umbraCoverage,
      sunAltitudeDeg: this.sunAltitudeDeg,
      axisDistanceKm: this.axisDistanceKm,
      casterToTargetKm: this.casterToTargetKm,
      umbraLengthKm: this.umbraLengthKm,
      umbraRadiusAtTargetKm: this.umbraRadiusAtTargetKm,
      penumbraRadiusAtTargetKm: this.penumbraRadiusAtTargetKm,
      inclinationDeg: this.teachingZeroInclination ? 0 : MOON_ORBIT_INCLINATION_DEG,
      nodeLongitudeDeg: this.nodeLongitudeDeg,
      moonEclipticLatitudeDeg: this.moonEclipticLatitudeDeg,
      events: this.events.map((event) => ({ ...event })),
      selectedEventIndex: this.eventIndex,
      phaseBands: this.phaseBands(),
      observerLatitudeDeg: this.observer.latitudeDeg,
      observerLongitudeDeg: this.observer.longitudeDeg,
      observerOffsetLatDeg: this.observerOffsetLatDeg,
      observerOffsetLonDeg: this.observerOffsetLonDeg,
      peakLatitudeDeg: this.peak?.latitudeDeg ?? null,
      peakLongitudeDeg: this.peak?.longitudeDeg ?? null,
    }
  }

  private publishState(): void {
    this.options.onState?.(this.snapshot())
  }

  /**
   * The selected eclipse's phases, widest first.
   *
   * The bands come from the same windows the scrubber is bounded by, so what the viewer sees marked
   * on the timeline is exactly what the geometry says: a total phase that is absent for a partial
   * eclipse is absent here too, rather than drawn as a zero-width sliver.
   */
  private phaseBands(): EclipsePhaseBand[] {
    if (this.section === 'solar') {
      const local = this.localEclipse
      if (!local) return []
      const bands: EclipsePhaseBand[] = []
      if (typeof local.centralBeginMs === 'number' && typeof local.centralEndMs === 'number') {
        bands.push({
          kind: local.kind === 'annular' ? 'annular' : 'total',
          startMs: local.centralBeginMs,
          endMs: local.centralEndMs,
        })
      }
      bands.push({ kind: 'partial', startMs: local.partialBeginMs, endMs: local.partialEndMs })
      return bands
    }

    const timing = this.lunarTiming
    if (!timing) return []
    const windows = lunarPhaseWindows({
      peakMs: timing.peakMs,
      penumbralSemiDurationMinutes: timing.penumbralSemiDurationMinutes,
      partialSemiDurationMinutes: timing.partialSemiDurationMinutes,
      totalSemiDurationMinutes: timing.totalSemiDurationMinutes,
    })
    const bands: EclipsePhaseBand[] = []
    if (windows.penumbral) bands.push({ kind: 'penumbral', ...windows.penumbral })
    if (windows.partial) bands.push({ kind: 'partial', ...windows.partial })
    if (windows.total) bands.push({ kind: 'total', ...windows.total })
    return bands
  }

  private publishReadout(): void {
    this.publishedKind = this.kind
    this.options.onReadout?.({
      key: ECLIPSE_READOUT_KEYS[this.kind],
      timestampMs: this.timeMs,
    })
  }

  private updateLabels(): void {
    const handler = this.options.onLabels
    if (!handler) return
    if (!this.showLabels || this.view === 'observer') {
      handler([])
      return
    }

    const applicable: Record<string, boolean> = {
      sun: true,
      earth: true,
      moon: true,
      eclipticPlane: this.showPlane,
      lunarPlane: this.showPlane,
      ascendingNode: this.showPlane,
      descendingNode: this.showPlane,
      umbra: this.showShadows,
      penumbra: this.showShadows,
      antumbra: this.showShadows && this.antumbra.group.visible,
      peak: this.section === 'solar' && this.peak !== null,
      observer: this.section === 'solar',
    }

    const canvas = this.stage.renderer.domElement
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Project every applicable label first, then thin them: two names sitting on top of each other
    // are worse than one name. The cones outrank everything - they are the demo's subject - then the
    // bodies, which are recognisable without a caption, then the planes and their nodes, then the two
    // markers, whose positions the panel gives in numbers anyway.
    const priority: Record<string, number> = {
      umbra: 0, penumbra: 0, antumbra: 0,
      sun: 1, earth: 1, moon: 1,
      eclipticPlane: 2, lunarPlane: 2,
      peak: 3, observer: 3,
      ascendingNode: 4, descendingNode: 4,
    }
    const candidates: { id: string, x: number, y: number, rank: number, halfWidth: number }[] = []
    const anchors: DemoLabelAnchor[] = []
    const copy = (id: string): Pick<DemoLabelAnchor, 'textKey' | 'descriptionKey'> =>
      ECLIPSE_LABELS[id] ?? { textKey: `demos.scene.${id}` }

    for (const [id, object] of this.labelTargets) {
      if (!applicable[id]) {
        anchors.push({ id, x: 0, y: 0, visible: false, ...copy(id) })
        continue
      }
      object.getWorldPosition(this.projected)
      this.projected.project(this.stage.camera)
      if (this.projected.z >= 1) {
        anchors.push({ id, x: 0, y: 0, visible: false, ...copy(id) })
        continue
      }
      const nudge = LABEL_SCREEN_NUDGE[id]
      const halfWidth = LABEL_HALF_WIDTH_PX[id] ?? 48
      const rawX = (this.projected.x * 0.5 + 0.5) * width + (nudge?.x ?? 0)
      const margin = 6
      candidates.push({
        id,
        // Mirror the DOM layer's edge clamp before testing collisions. Long English labels are
        // otherwise moved after this test and can cover a higher-priority body caption on phones.
        x: width > (halfWidth + margin) * 2
          ? Math.min(width - halfWidth - margin, Math.max(halfWidth + margin, rawX))
          : rawX,
        y: (-this.projected.y * 0.5 + 0.5) * height + (nudge?.y ?? 0),
        rank: priority[id] ?? 4,
        halfWidth,
      })
    }

    candidates.sort((a, b) => a.rank - b.rank)
    const kept = new Map<string, { x: number, y: number, halfWidth: number }>()
    for (const candidate of candidates) {
      // The exact horizontal half-width matters here: "Moon's orbital plane" is nearly four times
      // as wide as "Sun". A fixed centre-distance either lets the former overlap or hides the latter
      // needlessly.
      const clash = [...kept.values()].some((other) =>
        Math.abs(other.x - candidate.x)
          < other.halfWidth + candidate.halfWidth + SCENE.labelGapPx.x
        && Math.abs(other.y - candidate.y)
          < SCENE.labelHeightPx + SCENE.labelGapPx.y)
      if (clash) continue
      kept.set(candidate.id, {
        x: candidate.x,
        y: candidate.y,
        halfWidth: candidate.halfWidth,
      })
    }

    for (const candidate of candidates) {
      const position = kept.get(candidate.id)
      anchors.push({
        id: candidate.id,
        x: position?.x ?? candidate.x,
        y: position?.y ?? candidate.y,
        visible: position !== undefined,
        ...copy(candidate.id),
      })
    }
    handler(anchors)
  }

  private readonly handleControlsStart = (): void => {
    this.userAdjustedCamera = true
  }
}

/**
 * An invisible point just above a body, for its label to hang from.
 *
 * The shell draws a label above whatever anchor the scene publishes, so anchoring on a body's centre
 * drops the text inside its disc - which is unreadable against a bright Sun.
 *
 * "Above" means ecliptic north, which is +Z here and not the frame's +Y. The scene's content is
 * authored in ecliptic coordinates and only rotated into the renderer's y-up world at the very top
 * of the graph, so an offset along +Y inside `system` points at the camera instead of up the screen
 * and leaves the label exactly where it was.
 */
function anchorNorthOf(parent: THREE.Object3D, radius: number): THREE.Object3D {
  const anchor = new THREE.Object3D()
  anchor.position.set(0, 0, radius)
  parent.add(anchor)
  return anchor
}

/** A thin bright outline for one of the orbital discs. */
function ringOutline(radius: number, color: number, opacity: number): THREE.LineLoop {  const points: THREE.Vector3[] = []
  for (let step = 0; step < 128; step += 1) {
    const angle = (step / 128) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  )
}

/** Keeps a longitude inside (-180, 180]. */
function wrapLongitude(degrees: number): number {
  let value = (((degrees + 180) % 360) + 360) % 360 - 180
  if (value <= -180) value += 360
  return value
}
