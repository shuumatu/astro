import * as THREE from 'three'
import { createStage, type Stage } from '../../engine/stage'
import { createStarfield } from '../../engine/starfield'
import {
  DEFAULT_DEMO_SETTINGS,
  type DemoHotspot,
  type DemoLabelAnchor,
  type DemoPhase,
  type DemoReadout,
  type DemoScene,
  type DemoSceneOptions,
  type DemoSceneSettings,
} from '../../types'
import { kilometresToRadii, LIGHTING, MOON_RADIUS_KM, SCENE } from './config'
import { featureTitleKey, findFeature, MOON_FEATURES, type MoonFeature } from './hotspots'
import { configurePolarSurface, poleHeightMeans } from './polarSurface'
import { logarithmicDragScale, maximumSafePolarAngle, normaliseWheelPixels } from './navigation'
import {
  dot,
  KILOMETRES_PER_DEGREE,
  lonLatToVector,
  minimumAltitudeForTexel,
  texelKilometres,
  vectorToLonLat,
} from './selenography'
import { siteBumpScale, siteFloorSite, siteLevels, siteRelief, siteTier, type MoonSite } from './sites'

const DEGREES_TO_RADIANS = Math.PI / 180
/** Relief strength the globe's own LOLA bump map is drawn with; crops scale off it. */
const BODY_BUMP_SCALE = 1.2
const LOCAL_BUMP_EXAGGERATION = 3
const BAKED_RELIEF_BUMP_FRACTION = 0.22
const GLOBAL_HEIGHT_MIN_KM = -9
const GLOBAL_HEIGHT_RANGE_KM = 19
const UP = new THREE.Vector3(0, 1, 0)
const SITE_COLOUR = 0xffb457
const TERRAIN_COLOUR = 0x72d4d8
interface Flight {
  elapsed: number
  seconds: number
  fromPosition: THREE.Vector3
  toPosition: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  fromUp: THREE.Vector3
  toUp: THREE.Vector3
  /** Set for the opening move, which hands control back when it lands. */
  intro: boolean
}

/** One tier of a feature's drill-down, plus how far its texture has got. */
interface DetailLevel {
  site: MoonSite
  /** Stable draw order, also used when the mesh is allocated lazily. */
  order: number
  /** Allocated only when the tier is close enough to begin loading. */
  mesh: THREE.Mesh | null
  /** Set as soon as the download has been started, so a tier is only ever fetched once. */
  requested: boolean
  /** Set when the texture reaches the mesh; a tier that has not loaded never fades in. */
  loaded: boolean
}

interface FocusFrame {
  normal: THREE.Vector3
  north: THREE.Vector3
  east: THREE.Vector3
}

/**
 * The Moon, rendered from NASA's LROC colour mosaic with the LOLA height map as relief, lit by
 * a directly positionable Sun. Everything the viewer can click lives in
 * `hotspots.ts`, and how far they can zoom is bounded by what that mosaic can resolve.
 */
export class MoonScene implements DemoScene {
  private readonly options: DemoSceneOptions
  private readonly stage: Stage
  private readonly group = new THREE.Group()
  private readonly graticule = new THREE.Group()
  private readonly markers = new THREE.Group()
  private readonly detailGroup = new THREE.Group()
  private readonly labelTargets = new Map<string, THREE.Object3D>()
  private readonly markerTargets = new Map<string, THREE.Mesh>()
  private readonly sunLight: THREE.DirectionalLight
  private readonly earthshine: THREE.DirectionalLight
  private readonly ambient: THREE.AmbientLight
  private readonly projected = new THREE.Vector3()
  private readonly worldPoint = new THREE.Vector3()
  private readonly cameraNormal = new THREE.Vector3()
  private readonly sunDirection = new THREE.Vector3(1, 0, 0)
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()
  private readonly homePosition = new THREE.Vector3()
  private readonly homeTarget = new THREE.Vector3()
  private readonly surface: THREE.Mesh
  private settings: DemoSceneSettings = { ...DEFAULT_DEMO_SETTINGS }
  private phase: DemoPhase = 'orbit'
  private flight: Flight | null = null
  private focusedId: string | null = null
  private pointerDownAt: { id: number, x: number, y: number } | null = null
  private gestureMoved = false
  private readoutElapsed = 0
  private lastReadout = ''
  /** Width of the surface atlas that actually loaded, which sets how far zooming may go. */
  private textureWidthPx = 8192
  private minimumAltitudeRadii = 0
  /** Distance from the focused feature that the camera orbits at, in radii. */
  private focusDistance = 0
  /** Radius of the LOLA ground point the focused camera orbits, including exaggeration. */
  private focusGroundRadius: number = SCENE.radius
  private focusFrame: FocusFrame | null = null
  /** Turntable angles in the selected site's local north/east/up frame. */
  private focusAzimuth = -Math.PI / 2
  private focusPolar = SCENE.focusArrivalTiltDeg * DEGREES_TO_RADIANS
  private readonly pointers = new Map<number, { x: number, y: number }>()
  private pinchDistance = 0
  private defaultMinPolarAngle = 0
  private defaultMaxPolarAngle = 0
  private detailVisible = false
  private detailLevels: DetailLevel[] = []
  /** Coarsest crop for the focused feature: the one the arrival view is framed around. */
  private detailSite: MoonSite | null = null
  private readonly siteTextures = new Map<string, THREE.Texture>()
  /** Relief maps for the crops, kept beside their colour so both are released together. */
  private readonly siteBumpTextures = new Map<string, THREE.Texture>()
  private readonly polarSurface: ReturnType<typeof configurePolarSurface>
  private readonly siteFeather = createFeatherTexture()
  private labelElapsed = Number.POSITIVE_INFINITY
  /** The stage fires its first resize callback while it is still being constructed. */
  private stageReady = false
  private disposed = false

  constructor(container: HTMLElement, options: DemoSceneOptions = {}) {
    this.options = options

    const home = this.directionFrom(SCENE.homeLonDeg, SCENE.homeLatDeg)
    this.homePosition.copy(home).multiplyScalar(SCENE.homeDistance)
    this.homeTarget.set(0, 0, 0)

    const intro = this.directionFrom(SCENE.homeLonDeg + 34, SCENE.homeLatDeg + 21)
      .multiplyScalar(SCENE.introDistance)

    this.stage = createStage(container, {
      cameraPosition: intro,
      target: this.homeTarget,
      fov: SCENE.cameraFieldOfViewDeg,
      near: SCENE.cameraNear,
      far: SCENE.cameraFar,
      minDistance: SCENE.minCameraDistance,
      maxDistance: SCENE.maxCameraDistance,
      maxPixelRatio: SCENE.maxPixelRatio,
      onResize: (aspect) => {
        void aspect
        if (this.stageReady) this.refreshZoomFloor()
      },
    })

    this.stage.scene.add(createStarfield({
      radius: 900,
      count: 1500,
      pixelRatio: Math.min(window.devicePixelRatio || 1, SCENE.maxPixelRatio),
    }))

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
    })
    this.polarSurface = configurePolarSurface(material)
    this.surface = new THREE.Mesh(new THREE.SphereGeometry(
      SCENE.radius,
      SCENE.terrainWidthSegments,
      SCENE.terrainHeightSegments,
    ), material)
    this.surface.name = 'moon-surface'
    this.group.add(this.surface)
    this.stage.scene.add(this.group)

    this.loadTextures(material)
    this.loadPolarCaps()

    this.sunLight = new THREE.DirectionalLight(0xfff4e2, LIGHTING.sunIntensity)
    this.stage.scene.add(this.sunLight)
    this.stage.scene.add(this.sunLight.target)
    // The Earth sits over selenographic longitude 0 at the sub-Earth point, give or take libration.
    // A little earthshine, so the lunar night is not a silhouette and the viewer still reads
    // the surface they just flew over.
    this.earthshine = new THREE.DirectionalLight(0x9dc4ff, LIGHTING.earthshineIntensity)
    this.earthshine.position.copy(this.directionFrom(0, 0)).multiplyScalar(10)
    this.stage.scene.add(this.earthshine)
    this.stage.scene.add(this.earthshine.target)
    this.ambient = new THREE.AmbientLight(LIGHTING.ambientColor, LIGHTING.ambientIntensity)
    this.stage.scene.add(this.ambient)

    this.buildGraticule()
    this.buildMarkers()
    this.stage.scene.add(this.graticule)
    this.stage.scene.add(this.markers)
    this.detailGroup.renderOrder = 1
    this.stage.scene.add(this.detailGroup)
    this.refreshZoomFloor()

    const canvas = this.stage.renderer.domElement
    // Capture runs before OrbitControls' bubble listener, so the very first drag can dismiss the
    // intro and immediately start rotating instead of being swallowed by the cinematic.
    canvas.addEventListener('pointerdown', this.handlePointerDown, { capture: true })
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointercancel', this.handlePointerCancel)
    canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    window.addEventListener('keydown', this.handleKeydown)
    this.stage.controls.zoomToCursor = true
    this.stage.controls.rotateSpeed = SCENE.overviewRotateSpeed
    this.defaultMinPolarAngle = this.stage.controls.minPolarAngle
    this.defaultMaxPolarAngle = this.stage.controls.maxPolarAngle

    this.stage.controls.enabled = false
    this.flight = {
      elapsed: 0,
      seconds: SCENE.introSeconds,
      fromPosition: intro.clone(),
      toPosition: this.homePosition.clone(),
      fromTarget: this.homeTarget.clone(),
      toTarget: this.homeTarget.clone(),
      fromUp: this.stage.camera.up.clone(),
      toUp: UP.clone(),
      intro: true,
    }
    this.setPhase('cinematic')

    this.stage.setFrameHandler((delta) => this.update(delta))
    this.syncVisibility()
    this.applyBrightness()
    this.updateLightDirection()
    this.stageReady = true
    this.refreshZoomFloor()
    this.stage.start()
    this.publishReadout(true)
  }

  applySettings(settings: Partial<DemoSceneSettings>): void {
    this.settings = { ...this.settings, ...settings }
    this.syncVisibility()
    this.applyBrightness()
    this.updateLightDirection()
    this.publishReadout(true)
  }

  /** Scales every light together, so the terminator keeps its shape as the view brightens. */
  private applyBrightness(): void {
    const brightness = this.settings.brightness ?? 1
    if (this.settings.fullBright) {
      this.sunLight.intensity = LIGHTING.fullBrightSunIntensity * brightness
      this.earthshine.intensity = 0
      this.ambient.color.setHex(LIGHTING.fullBrightAmbientColor)
      this.ambient.intensity = LIGHTING.fullBrightAmbientIntensity * brightness
      return
    }
    this.sunLight.intensity = LIGHTING.sunIntensity * brightness
    this.earthshine.intensity = LIGHTING.earthshineIntensity * brightness
    this.ambient.color.setHex(LIGHTING.ambientColor)
    this.ambient.intensity = LIGHTING.ambientIntensity * brightness
  }

  /**
   * Positions the Sun in a local north/east/up frame. Azimuth is clockwise from local north and
   * elevation is above the local horizon, which is the convention used by terrain hillshades.
   * While focused, the frame belongs to that feature; in the overview it belongs to the centre
   * of the default near-side view.
   */
  private updateLightDirection(): void {
    const feature = this.focusedId ? findFeature(this.focusedId) : null
    const lonDeg = feature?.lonDeg ?? SCENE.homeLonDeg
    const latDeg = feature?.latDeg ?? SCENE.homeLatDeg
    const normal = this.directionFrom(lonDeg, latDeg)
    const north = UP.clone().addScaledVector(normal, -UP.dot(normal))
    if (north.lengthSq() < 1e-8) north.copy(perpendicular(normal))
    else north.normalize()
    const east = new THREE.Vector3().crossVectors(north, normal).normalize()
    const azimuth = ((this.settings.lightAzimuthDeg ?? 315) % 360 + 360) % 360
    const elevation = Math.min(90, Math.max(0, this.settings.lightElevationDeg ?? 28))
    const azimuthRad = azimuth * DEGREES_TO_RADIANS
    const elevationRad = elevation * DEGREES_TO_RADIANS
    const horizontal = north.multiplyScalar(Math.cos(azimuthRad))
      .addScaledVector(east, Math.sin(azimuthRad))
    this.sunDirection.copy(normal).multiplyScalar(Math.sin(elevationRad))
      .addScaledVector(horizontal, Math.cos(elevationRad))
      .normalize()
    this.sunLight.position.copy(this.sunDirection).multiplyScalar(20)
    this.sunLight.target.position.set(0, 0, 0)
  }

  resetView(): void {
    if (this.focusedId) {
      this.clearFocus()
      return
    }
    this.stage.resetView()
  }

  focusHotspot(id: string): void {
    const feature = findFeature(id)
    if (!feature) return
    this.focusedId = id
    this.options.onHotspot?.(describeFeature(feature))
    this.showSite(id)
    // The floor changes the moment a crop is in play, and the flight below reads it.
    this.refreshZoomFloor()

    const normal = this.directionFrom(feature.lonDeg, feature.latDeg)
    const relief = siteRelief(feature.id)
      ?? siteLevels(feature.id).map((site) => siteRelief(site.id)).find((entry) => entry !== null)
    this.focusGroundRadius = SCENE.radius + kilometresToRadii(
      (relief?.centerKm ?? 0) * SCENE.terrainExaggeration,
    )
    const north = UP.clone().addScaledVector(normal, -UP.dot(normal))
    if (north.lengthSq() < 1e-8) north.copy(perpendicular(normal))
    else north.normalize()
    const east = new THREE.Vector3().crossVectors(north, normal).normalize()
    this.focusFrame = { normal, north, east }
    this.focusAzimuth = -Math.PI / 2
    this.focusPolar = SCENE.focusArrivalTiltDeg * DEGREES_TO_RADIANS
    const target = normal.clone().multiplyScalar(this.focusGroundRadius)
    const altitude = Math.max(this.focusAltitudeFor(feature), this.minimumAltitudeRadii)
    // Arrive obliquely enough that displaced crater walls are visible instead of collapsing into
    // a flat nadir image. Once the flight lands, OrbitControls uses the site's normal as its up
    // axis, so dragging behaves like orbiting a small terrain model even at either lunar pole.
    this.focusDistance = altitude
    const eye = target.clone().addScaledVector(this.focusOffsetDirection(), altitude)
    // OrbitControls captures its world-up transform when it is constructed, so changing
    // camera.up for a lunar site cannot make it a reliable local-ground controller. The focused
    // view therefore uses the turntable angles above and leaves OrbitControls to the overview.
    this.stage.controls.enabled = false
    this.stage.controls.enableZoom = false
    this.stage.controls.zoomToCursor = false
    this.startFlight(eye, target, SCENE.focusSeconds, false, normal)
    this.labelElapsed = Number.POSITIVE_INFINITY
    this.updateLightDirection()
  }

  /**
   * How high to stop when flying to a feature. With a crop the framing follows the crop, so the
   * feature fills roughly two thirds of the view while the crop still covers it with margin;
   * without one the feature's declared altitude is all there is.
   */
  private focusAltitudeFor(feature: MoonFeature): number {
    const site = this.detailSite
    if (!site) return kilometresToRadii(feature.focusAltitudeKm)
    // The patch has to cover the viewport, so the breadth of the viewport decides the framing:
    // a wide screen sees more ground sideways than it does vertically.
    const viewKm = (siteSpanKm(site, feature.latDeg, feature.lonDeg) * SCENE.siteCoverage)
      / (Math.max(this.stage.camera.aspect, 0.5) * SCENE.siteCoverMargin)
    const altitudeKm = viewKm / (2 * Math.tan((this.stage.camera.fov / 2) * DEGREES_TO_RADIANS))
    return kilometresToRadii(altitudeKm)
  }

  clearFocus(): void {
    this.focusedId = null
    this.focusFrame = null
    this.options.onHotspot?.(null)
    this.hideSite()
    this.focusGroundRadius = SCENE.radius
    this.stage.controls.rotateSpeed = SCENE.overviewRotateSpeed
    this.stage.controls.minPolarAngle = this.defaultMinPolarAngle
    this.stage.controls.maxPolarAngle = this.defaultMaxPolarAngle
    this.startFlight(this.homePosition.clone(), this.homeTarget.clone(), SCENE.focusSeconds, false, UP)
    this.labelElapsed = Number.POSITIVE_INFINITY
    this.updateLightDirection()
  }

  dispose(): void {
    this.disposed = true
    const canvas = this.stage.renderer.domElement
    canvas.removeEventListener('pointerdown', this.handlePointerDown, { capture: true })
    canvas.removeEventListener('pointerup', this.handlePointerUp)
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointercancel', this.handlePointerCancel)
    canvas.removeEventListener('wheel', this.handleWheel)
    window.removeEventListener('keydown', this.handleKeydown)
    this.polarSurface.dispose()
    this.siteFeather.dispose()
    this.stage.dispose()
  }

  setSuspended(suspended: boolean): void {
    if (suspended) this.stage.stop()
    else this.stage.start()
  }

  /** Loads the LROC colour mosaic and the LOLA relief map, degrading quietly on failure. */
  private loadTextures(material: THREE.MeshStandardMaterial): void {
    const loader = new THREE.TextureLoader()
    const base = import.meta.env.BASE_URL
    const maxTextureSize = this.stage.renderer.capabilities.maxTextureSize
    // The atlas is the demo's only source of surface detail, so take the largest copy the GPU
    // will hold and step down only if a file is missing. 8K is the practical ceiling: as an
    // RGBA texture it already costs about 130 MB of graphics memory, and 16K would need four
    // times that, which most GPUs cannot give a single browser texture.
    const ladder = [
      { width: 8192, file: 'moon-color-8k.webp' },
      { width: 4096, file: 'moon-color-4k.webp' },
    ].filter((step) => step.width <= maxTextureSize)

    const apply = (index: number): void => {
      const step = ladder[index]
      if (!step) return
      const url = `${base}demos/moon/${step.file}?registered-poles=2`
      const texture = loader.load(
        url,
        () => {
          if (this.disposed) {
            texture.dispose()
            return
          }
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = Math.min(
            this.stage.renderer.capabilities.getMaxAnisotropy(),
            SCENE.colourAnisotropy,
          )
          material.map = texture
          material.needsUpdate = true
          this.textureWidthPx = step.width
          this.refreshZoomFloor()
        },
        undefined,
        () => {
          if (this.disposed) return
          apply(index + 1)
        },
      )
    }
    apply(0)

    loader.load(
      `${base}demos/moon/moon-height-4k.webp`,
      (texture) => {
        if (this.disposed) {
          texture.dispose()
          return
        }
        const heightImage = texture.image as HTMLImageElement
        const canvas = document.createElement('canvas')
        canvas.width = heightImage.width
        canvas.height = 2
        const context = canvas.getContext('2d')
        if (context) {
          // Only read the two pole rows: no full 4K RGBA readback/allocation is necessary.
          context.drawImage(heightImage, 0, 0, heightImage.width, 1, 0, 0, canvas.width, 1)
          context.drawImage(heightImage, 0, heightImage.height - 1, heightImage.width, 1,
            0, 1, canvas.width, 1)
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
          this.polarSurface.setPoleHeights(...poleHeightMeans(pixels.data, canvas.width, canvas.height))
        }
        texture.wrapS = THREE.RepeatWrapping
        texture.anisotropy = Math.min(
          this.stage.renderer.capabilities.getMaxAnisotropy(),
          SCENE.heightAnisotropy,
        )
        material.bumpMap = texture
        material.bumpScale = BODY_BUMP_SCALE
        // NASA publishes LOLA elevation relative to the 1737.4 km reference sphere. Mapping
        // those physical kilometres into scene radii makes peaks and crater floors alter the
        // actual silhouette and parallax; bumpMap then restores detail below the vertex grid.
        material.displacementMap = texture
        material.displacementScale = kilometresToRadii(
          GLOBAL_HEIGHT_RANGE_KM * SCENE.terrainExaggeration,
        )
        material.displacementBias = kilometresToRadii(
          GLOBAL_HEIGHT_MIN_KM * SCENE.terrainExaggeration,
        )
        material.needsUpdate = true
      },
      undefined,
      () => {
        // Relief is a bonus: without it the mosaic still carries the terrain.
      },
    )
  }

  /** Sample the native metre-based polar products on the globe itself at every zoom level. */
  private loadPolarCaps(): void {
    const loader = new THREE.TextureLoader()
    for (const hemisphere of ['north', 'south'] as const) {
      loader.load(`${import.meta.env.BASE_URL}demos/moon/polar-${hemisphere}-matched.webp`, (texture) => {
        if (this.disposed) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = Math.min(
          this.stage.renderer.capabilities.getMaxAnisotropy(),
          SCENE.colourAnisotropy,
        )
        this.polarSurface.setMap(hemisphere, texture)
      })
    }
  }

  private buildGraticule(): void {
    const positions: number[] = []
    const radius = SCENE.radius * SCENE.graticuleRadius
    const step = SCENE.graticuleStepDeg
    const detail = 2
    for (let lon = -180; lon < 180; lon += step) {
      for (let lat = -90; lat < 90; lat += detail) {
        pushSegment(positions, lon, lat, lon, lat + detail, radius)
      }
    }
    for (let lat = -90 + step; lat < 90; lat += step) {
      for (let lon = -180; lon < 180; lon += detail) {
        pushSegment(positions, lon, lat, lon + detail, lat, radius)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({
      color: 0x7fb2e5,
      transparent: true,
      opacity: SCENE.graticuleOpacity,
      depthWrite: false,
    })
    const lines = new THREE.LineSegments(geometry, material)
    lines.renderOrder = 2
    this.graticule.add(lines)
  }

  private buildMarkers(): void {
    for (const feature of MOON_FEATURES) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(SCENE.markerSize, 16, 12),
        new THREE.MeshBasicMaterial({
          color: feature.category === 'landingSite' ? SITE_COLOUR : TERRAIN_COLOUR,
          transparent: true,
          opacity: SCENE.markerOpacity,
        }),
      )
      marker.position.copy(this.directionFrom(feature.lonDeg, feature.latDeg))
        .multiplyScalar(SCENE.radius * SCENE.markerRadiusFactor)
      marker.renderOrder = 3
      this.markers.add(marker)
      this.markerTargets.set(feature.id, marker)

      const label = new THREE.Object3D()
      label.position.copy(marker.position)
      this.group.add(label)
      this.labelTargets.set(feature.id, label)
    }
  }

  /**
   * Markers are spheres in scene units, so they have to be resized against the camera every
   * frame or they turn into blobs as it comes down. Solving for a target pixel size directly —
   * a marker of `p` pixels across at distance `d` is `d * tan(fov/2) * p / height` world units
   * in radius — keeps them the same size on screen from the overview down to the surface.
   */
  private scaleMarkersToCamera(): void {
    const camera = this.stage.camera
    const height = Math.max(this.stage.renderer.domElement.clientHeight, 1)
    const halfFovTangent = Math.tan((camera.fov / 2) * DEGREES_TO_RADIANS)
    for (const [id, marker] of this.markerTargets) {
      const focused = id === this.focusedId
      const pixels = focused ? SCENE.markerFocusPixels : SCENE.markerPixels
      const distance = camera.position.distanceTo(marker.position)
      const radius = distance * halfFovTangent * (pixels / height)
      marker.scale.setScalar(radius / SCENE.markerSize)
    }
  }

  private syncVisibility(): void {
    this.graticule.visible = this.settings.showGrid ?? false
    if (!this.settings.showLabels) this.options.onLabels?.([])
    this.labelElapsed = Number.POSITIVE_INFINITY
  }

  private setPhase(phase: DemoPhase): void {
    if (this.phase === phase) return
    this.phase = phase
    this.options.onPhaseChange?.(phase)
  }

  private update(deltaSeconds: number): void {
    this.updateFlight(deltaSeconds)
    if (!this.focusedId) this.clampCameraAltitude()
    this.updateCameraClip()
    this.updatePolarDetailMix()
    this.scaleMarkersToCamera()
    this.updateDetail()
    this.labelElapsed += deltaSeconds
    if (this.labelElapsed >= SCENE.labelUpdateIntervalSeconds) {
      this.labelElapsed = 0
      this.publishLabels()
    }
    this.publishReadout(false, deltaSeconds)
  }

  /** Fade the high-resolution polar mosaic in only when it has enough screen size. */
  private updatePolarDetailMix(): void {
    const altitude = this.focusedId
      ? this.focusDistance
      : Math.max(this.stage.camera.position.length() - SCENE.radius, 0)
    // Keep the polar mosaic out of the overview. Its native resolution is much
    // higher than the global atlas, so even a colour-matched blend would expose
    // a circular frequency boundary at lunar-disc scale.
    // Keep the overview on one global-atlas representation. The polar mosaic
    // fades in only after the camera is genuinely close to the surface.
    const t = THREE.MathUtils.clamp((1.62 - altitude) / 0.48, 0, 1)
    this.polarSurface.setDetailMix(t * t * (3 - 2 * t))
  }

  /**
   * Pulls the near plane in as the camera descends. A fixed near plane cannot do both jobs: at
   * the deepest crop the ground is about seventy metres away and would be clipped away entirely,
   * while a plane that is always tiny throws away the depth precision that keeps a crop patch
   * from z-fighting the globe it is pasted onto. Scaling it with the altitude keeps the ground
   * just inside the frustum and the depth range narrow enough to be useful at every zoom level.
   */
  private updateCameraClip(): void {
    const camera = this.stage.camera
    const altitude = this.focusedId
      ? this.focusDistance
      : Math.max(camera.position.length() - SCENE.radius, 0)
    const near = Math.min(
      SCENE.cameraNear,
      Math.max(altitude * 0.15, SCENE.cameraNearMinimum),
    )
    if (Math.abs(camera.near - near) <= near * 0.02) return
    camera.near = near
    camera.far = SCENE.cameraFar
    camera.updateProjectionMatrix()
  }

  /**
   * Keeps the camera above the imagery's useful floor. This is a radial limit rather than an
   * orbit-controls minimum distance, because while a feature is focused the controls orbit its
   * surface point, and a minimum distance there would block zooming entirely.
   */
  private clampCameraAltitude(): void {
    const highestTerrain = kilometresToRadii(
      (GLOBAL_HEIGHT_MIN_KM + GLOBAL_HEIGHT_RANGE_KM) * SCENE.terrainExaggeration,
    )
    const minimum = SCENE.radius + highestTerrain + this.minimumAltitudeRadii
    const camera = this.stage.camera
    const distance = camera.position.length()
    if (distance >= minimum) return
    camera.position.multiplyScalar(minimum / Math.max(distance, 1e-6))
  }

  /**
   * Keeps the orbit controls, and any flight that has already been scheduled, from pushing the
   * camera closer than the surface atlas can support. The limit depends on the atlas that
   * actually loaded and on the viewport, so it is recomputed on resize.
   */
  private refreshZoomFloor(): void {
    const height = this.stage.renderer.domElement.clientHeight
    // A focused feature's crop sets the limit even before the patch has faded in, because the
    // camera is already flying towards an altitude the atlas alone could not support. The floor
    // follows the deepest tier the feature has, so the NAC close-ups are actually reachable;
    // features without them keep the wide crop's floor, as they always have.
    const candidate = this.focusedId ? siteFloorSite(this.focusedId) : null
    // Polar locations are represented by the dedicated orthographic atlas cap. A rectangular
    // longitude/latitude crop would reintroduce the pole's converging-row artefact.
    const detail = candidate && !isPolarSite(candidate) ? candidate : null
    const texelKm = detail ? siteTexelKm(detail) : texelKilometres(this.textureWidthPx)
    // The globe and the WAC crops may be stretched further than the NAC tiers, which have the
    // ground detail to lose when they are.
    const tier = detail ? siteTier(detail.id) : 'fine'
    const allowance = detail
      ? (tier === 'nac' || tier === 'nac-close'
          ? SCENE.maxScreenPixelsPerTexelNac
          : SCENE.maxScreenPixelsPerTexelDetail)
      : SCENE.maxScreenPixelsPerTexel
    const altitudeKm = Math.max(
      minimumAltitudeForTexel(
        texelKm,
        height > 0 ? height : 800,
        this.stage.camera.fov,
        allowance,
      ),
      SCENE.minimumAltitudeKm,
    )
    this.minimumAltitudeRadii = kilometresToRadii(altitudeKm)
    // Orbits the globe centre: a minimum distance is exactly an altitude limit. While a feature
    // is focused the controls orbit a surface point instead, and the radial clamp above does the
    // work, so the controls are given the same floor rather than one of their own — one of their
    // own would stop the camera long before the deepest crop is reached.
    this.stage.controls.minDistance = this.focusedId
      ? this.minimumAltitudeRadii
      : SCENE.radius + this.minimumAltitudeRadii
  }

  /** Loads the high-resolution crop for a feature and shows it once the camera is close enough. */
  private showSite(id: string): void {
    this.hideSite()
    const levels = siteLevels(id)
    if (levels.length === 0) return
    // Never lay an equirectangular mesh over an exact lunar pole. The global atlas now contains
    // the high-resolution orthographic cap, which remains geometrically well-defined there.
    if (levels.some(isPolarSite)) {
      this.detailSite = null
      this.detailLevels = []
      return
    }
    // Frame the arrival around the coarsest level, so a focused view is sharper than the atlas
    // from the moment the flight lands rather than only once the camera is nearly on the ground.
    this.detailSite = levels[0]
    this.detailLevels = levels.map((site, index) => ({
      site,
      order: index,
      mesh: null,
      requested: false,
      loaded: false,
    }))
    // The arrival crop is fetched now; the deeper tiers wait until the camera closes in on them.
    this.loadDetailLevel(this.detailLevels[0])
  }

  /** Starts downloading one tier's crop, at most once per visit to a feature. */
  private loadDetailLevel(level: DetailLevel | undefined): void {
    if (!level || level.requested) return
    level.requested = true
    const { site } = level
    const mesh = level.mesh ?? (level.mesh = this.buildDetailMesh(site, level.order))
    const apply = (texture: THREE.Texture): void => {
      if (this.disposed || !this.detailLevels.includes(level)) {
        texture.dispose()
        return
      }
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(
        this.stage.renderer.capabilities.getMaxAnisotropy(),
        SCENE.colourAnisotropy,
      )
      this.siteTextures.set(site.id, texture)
      const material = mesh.material as THREE.MeshStandardMaterial
      material.map = texture
      material.needsUpdate = true
      level.loaded = true
      this.loadSiteRelief(site, material)
    }
    const cached = this.siteTextures.get(site.id)
    if (cached) {
      apply(cached)
      return
    }
    new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}demos/moon/sites/${site.id}.webp`,
      apply,
      undefined,
      () => {
        // Without this tier the coarser ones still cover the view, just less sharply.
      },
    )
  }

  /**
   * Gives a crop the relief map that goes with it. The crop itself is albedo, so its terrain has
   * to come from a height map lit by the scene's own Sun — the same way the globe gets its relief.
   * Features whose imagery predates the height maps simply stay unlit relief, as they always were.
   */
  private loadSiteRelief(site: MoonSite, material: THREE.MeshStandardMaterial): void {
    const relief = siteRelief(site.id)
    if (relief === null) return
    // Every longitude collapses to one vertex at an exact pole. A rectangular height texture
    // cannot represent that topology without radial interpolation artifacts, so the two polar
    // colour overlays use the globe's already-displaced LOLA surface underneath instead.
    const touchesPole = site.bbox[1] <= -89.999 || site.bbox[3] >= 89.999
    if (touchesPole) return
    const bumpScale = siteBumpScale(site.id)
    const apply = (texture: THREE.Texture): void => {
      material.displacementMap = texture
      material.displacementScale = kilometresToRadii(
        relief.rangeKm * SCENE.terrainExaggeration,
      )
      material.displacementBias = kilometresToRadii(
        relief.minKm * SCENE.terrainExaggeration,
      )
      // Relit albedo crops can use the complete high-frequency normal signal. WAC/NAC crops that
      // still contain photographed shadows get a restrained term: their vertices provide real
      // parallax while this smaller bump contribution stops fine ridges disappearing between
      // vertices without embossing the photographed illumination twice.
      const physicalScale = (relief.rangeKm / GLOBAL_HEIGHT_RANGE_KM)
        * LOCAL_BUMP_EXAGGERATION
      material.bumpMap = texture
      material.bumpScale = BODY_BUMP_SCALE * (
        bumpScale ?? physicalScale * BAKED_RELIEF_BUMP_FRACTION
      )
      material.needsUpdate = true
    }
    const cached = this.siteBumpTextures.get(site.id)
    if (cached) {
      apply(cached)
      return
    }
    new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}demos/moon/bump/${site.id}.webp`,
      (texture) => {
        if (this.disposed) {
          texture.dispose()
          return
        }
        texture.anisotropy = Math.min(
          this.stage.renderer.capabilities.getMaxAnisotropy(),
          SCENE.heightAnisotropy,
        )
        this.siteBumpTextures.set(site.id, texture)
        apply(texture)
      },
      undefined,
      () => {
        // Relief is a bonus: the albedo alone still carries the terrain.
      },
    )
  }

  private hideSite(): void {
    this.detailSite = null
    this.detailVisible = false
    for (const level of this.detailLevels) {
      if (level.mesh) this.disposeDetailMesh(level.mesh)
    }
    this.detailLevels = []
    this.releaseSiteTextures(new Set())
    this.refreshZoomFloor()
  }

  /**
   * Drops the crops of features the viewer has left. A four-tier drill-down costs a few hundred
   * megabytes of graphics memory at its deepest, so keeping every feature ever visited would not
   * scale; the browser's own cache makes revisiting one cheap.
   */
  private releaseSiteTextures(keep: Set<string>): void {
    for (const [id, texture] of [...this.siteTextures]) {
      if (keep.has(id)) continue
      texture.dispose()
      this.siteTextures.delete(id)
    }
    for (const [id, texture] of [...this.siteBumpTextures]) {
      if (keep.has(id)) continue
      texture.dispose()
      this.siteBumpTextures.delete(id)
    }
  }

  private buildDetailMesh(site: MoonSite, order: number): THREE.Mesh {
    const [west, rawSouth, east, rawNorth] = site.bbox
    // A lat/lon patch that includes exactly +/-90 degrees maps an entire texture row onto one
    // SphereGeometry vertex. Any per-longitude height or normal variation there becomes a radial
    // fan of spikes. Leave a tiny atlas-backed cap at the pole; the orthographic polar mosaic is
    // used by the globe itself and the patch remains well-defined everywhere it has pixels.
    const south = Math.max(rawSouth, -89.7)
    const north = Math.min(rawNorth, 89.7)
    const tier = siteTier(site.id)
    const widthSegments = tier === 'wide'
      ? SCENE.wideTerrainSegments
      : tier === 'nac' || tier === 'nac-close'
        ? SCENE.nacTerrainSegments
        : SCENE.fineTerrainSegments
    const heightSegments = Math.max(
      48,
      Math.round(widthSegments * Math.min(1, site.height / Math.max(site.width, 1))),
    )
    const geometry = new THREE.SphereGeometry(
      SCENE.radius * SCENE.siteRadiusFactor,
      widthSegments,
      heightSegments,
      (west + 180) * DEGREES_TO_RADIANS,
      (east - west) * DEGREES_TO_RADIANS,
      (90 - north) * DEGREES_TO_RADIANS,
      (north - south) * DEGREES_TO_RADIANS,
    )
    const [red, green, blue] = site.tint
    const material = new THREE.MeshStandardMaterial({
      // The crop is a grey shaded mosaic; this is the atlas colour it stands in for. The values
      // are already linear multipliers, so they must not be decoded a second time.
      color: new THREE.Color().setRGB(red, green, blue, THREE.LinearSRGBColorSpace),
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      alphaMap: this.siteFeather,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    })
    const mesh = new THREE.Mesh(geometry, material)
    // Later levels are finer, so they paint over the coarser ones.
    mesh.renderOrder = 1 + order
    mesh.visible = false
    this.detailGroup.add(mesh)
    return mesh
  }

  private disposeDetailMesh(mesh: THREE.Mesh): void {
    this.detailGroup.remove(mesh)
    mesh.geometry.dispose()
    const material = mesh.material as THREE.Material
    material.dispose()
  }

  /**
   * Cross-fades each crop into the next once the finer crop covers enough of the viewport. The
   * same ramp is used for atlas -> wide and wide -> fine, so neither hand-off changes character.
   */
  private updateDetail(): void {
    if (this.detailLevels.length === 0) return
    const feature = this.focusedId ? findFeature(this.focusedId) : null
    // Rotation changes the camera's radial distance from the Moon but not its zoom. Using the
    // turntable distance here keeps LOD stable while the viewer tilts around a crater.
    const altitudeKm = (this.focusedId
      ? this.focusDistance
      : Math.max(this.stage.camera.position.length() - SCENE.radius, 0)
    ) * MOON_RADIUS_KM
    const viewKm = 2 * Math.max(altitudeKm, 0.5)
      * Math.tan((this.stage.camera.fov / 2) * DEGREES_TO_RADIANS)
    const appearances = this.detailLevels.map((level) => {
      const span = siteSpanKm(level.site, feature?.latDeg ?? 0, feature?.lonDeg ?? 0)
      const ratio = span / Math.max(viewKm, 0.5)
      // Deeper tiers are fetched while the view is still wider than the crop, so the texture is
      // already on the mesh when its own fade-in starts.
      if (ratio > SCENE.sitePreloadRatio) this.loadDetailLevel(level)
      return level.loaded ? smoothStep(SCENE.siteFadeIn, SCENE.siteFadeFull, ratio) : 0
    })
    let anyVisible = false
    for (const [index, level] of this.detailLevels.entries()) {
      // As the finer level comes in, remove the level below it by the exact same amount. Without
      // this, the wide photograph remained fully opaque behind fine and leaked through fine's
      // feathered edge, making the two transitions look unrelated.
      const opacity = appearances[index] * (1 - (appearances[index + 1] ?? 0))
      if (!level.mesh) continue
      ;(level.mesh.material as THREE.MeshStandardMaterial).opacity = opacity
      level.mesh.visible = opacity > 0.01
      anyVisible = anyVisible || level.mesh.visible
    }
    if (anyVisible === this.detailVisible) return
    this.detailVisible = anyVisible
    // The floor follows whichever imagery is actually on screen.
    this.refreshZoomFloor()
  }

  private updateFlight(deltaSeconds: number): void {
    const flight = this.flight
    if (!flight) return
    flight.elapsed += deltaSeconds
    const progress = Math.min(1, flight.elapsed / flight.seconds)
    const eased = easeInOutCubic(progress)
    this.stage.camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased)
    this.stage.controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased)
    this.stage.camera.up.lerpVectors(flight.fromUp, flight.toUp, eased).normalize()
    this.stage.camera.lookAt(this.stage.controls.target)
    if (progress < 1) return
    this.flight = null
    if (this.focusedId) {
      // Snap to the exact local-frame solution at the end of interpolation. OrbitControls stays
      // disabled here: it is only correct for the overview's fixed world-up frame.
      this.stage.controls.enabled = false
      this.applyFocusCamera()
    } else {
      this.stage.camera.up.copy(UP)
      this.stage.controls.enabled = true
      this.stage.controls.enableZoom = true
      this.stage.controls.zoomToCursor = true
      this.stage.controls.update()
    }
    this.labelElapsed = Number.POSITIVE_INFINITY
    if (flight.intro) this.setPhase('orbit')
  }

  private startFlight(
    position: THREE.Vector3,
    target: THREE.Vector3,
    seconds: number,
    intro: boolean,
    up = this.stage.camera.up,
  ): void {
    this.stage.controls.enabled = false
    this.flight = {
      elapsed: 0,
      seconds,
      fromPosition: this.stage.camera.position.clone(),
      toPosition: position,
      fromTarget: this.stage.controls.target.clone(),
      toTarget: target,
      fromUp: this.stage.camera.up.clone(),
      toUp: up.clone().normalize(),
      intro,
    }
  }

  private skipIntro(): void {
    if (!this.flight?.intro) return
    this.flight = null
    this.stage.camera.position.copy(this.homePosition)
    this.stage.controls.target.copy(this.homeTarget)
    this.stage.camera.up.copy(UP)
    this.stage.camera.lookAt(this.homeTarget)
    this.stage.controls.enabled = true
    this.setPhase('orbit')
  }

  /**
   * Publishes the labels that are actually worth showing: features facing the camera, capped
   * at a readable number and thinned out so two names never sit on top of each other.
   */
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
    const camera = this.stage.camera
    const candidates: { id: string, x: number, y: number, score: number, focused: boolean }[] = []
    const radiusSquared = SCENE.radius * SCENE.radius

    for (const feature of MOON_FEATURES) {
      const target = this.labelTargets.get(feature.id)
      if (!target) continue
      target.getWorldPosition(this.worldPoint)
      const facing = dot(this.worldPoint, camera.position) > radiusSquared
      if (!facing) continue
      this.projected.copy(this.worldPoint).project(camera)
      if (this.projected.z >= 1) continue
      const x = (this.projected.x * 0.5 + 0.5) * width
      const y = (-this.projected.y * 0.5 + 0.5) * height
      candidates.push({
        id: feature.id,
        x,
        y,
        score: Math.hypot(x - width / 2, y - height / 2),
        focused: feature.id === this.focusedId,
      })
    }

    candidates.sort((a, b) => (Number(b.focused) - Number(a.focused)) || a.score - b.score)
    const accepted: typeof candidates = []
    for (const candidate of candidates) {
      if (accepted.length >= SCENE.labelLimit && !candidate.focused) continue
      const clash = accepted.some((other) =>
        Math.hypot(other.x - candidate.x, other.y - candidate.y) < SCENE.labelSeparationPx)
      if (clash && !candidate.focused) continue
      accepted.push(candidate)
    }

    const shown = new Map(accepted.map((candidate) => [candidate.id, candidate]))
    const anchors: DemoLabelAnchor[] = candidates.length === 0 ? [] : MOON_FEATURES.map((feature) => {
      const candidate = shown.get(feature.id)
      return {
        id: feature.id,
        x: candidate?.x ?? 0,
        y: candidate?.y ?? 0,
        visible: candidate !== undefined,
        textKey: featureTitleKey(feature.id),
      }
    })
    handler(anchors)
  }

  private publishReadout(force: boolean, deltaSeconds = 0): void {
    const handler = this.options.onReadout
    if (!handler) return
    this.readoutElapsed += deltaSeconds
    if (!force && this.readoutElapsed < 0.5) return
    this.readoutElapsed = 0
    const altitudeKm = Math.round((this.focusedId
      ? this.focusDistance
      : Math.max(this.stage.camera.position.length() - SCENE.radius, 0)
    ) * MOON_RADIUS_KM)
    const azimuth = Math.round(this.settings.lightAzimuthDeg ?? 315)
    const elevation = Math.round(this.settings.lightElevationDeg ?? 28)
    const signature = `${Number(Boolean(this.settings.fullBright))}/${azimuth}/${elevation}/${altitudeKm}`
    if (signature === this.lastReadout) return
    this.lastReadout = signature
    const readout: DemoReadout = {
      key: this.settings.fullBright ? 'demos.items.moon.readoutFull' : 'demos.items.moon.readout',
      params: { azimuth, elevation, altitude: altitudeKm },
    }
    handler(readout)
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.pointers.size === 0) {
      this.pointerDownAt = { id: event.pointerId, x: event.clientX, y: event.clientY }
      this.gestureMoved = false
    } else {
      // Once a second contact joins, this gesture can never be interpreted as a hotspot click.
      this.gestureMoved = true
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pointers.size === 2) this.pinchDistance = this.pointerSpread()
    this.stage.renderer.domElement.setPointerCapture?.(event.pointerId)
    this.skipIntro()
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const start = this.pointerDownAt
    const wasPrimary = start?.id === event.pointerId
    const wasSinglePointer = this.pointers.size === 1
    const isTap = Boolean(
      wasPrimary
      && wasSinglePointer
      && !this.gestureMoved
      && start
      && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 6,
    )
    this.pointers.delete(event.pointerId)
    this.pinchDistance = this.pointers.size === 2 ? this.pointerSpread() : 0
    if (this.pointers.size === 0) {
      this.pointerDownAt = null
      this.gestureMoved = false
    }
    if (!isTap || this.flight || this.focusedId) return
    const feature = this.pickFeature(event)
    if (feature) this.focusHotspot(feature.id)
  }

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId)
    this.gestureMoved = true
    this.pinchDistance = this.pointers.size === 2 ? this.pointerSpread() : 0
    if (this.pointers.size === 0) this.pointerDownAt = null
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId)
    if (!previous) return
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (!this.focusedId || this.flight) return
    if (this.pointers.size === 2) {
      const spread = this.pointerSpread()
      // Spreading two fingers means closer, matching every other zoom gesture.
      if (this.pinchDistance > 0) this.zoomFocused((this.pinchDistance - spread) * 2.5)
      this.pinchDistance = spread
      this.gestureMoved = true
      return
    }
    if (this.pointers.size !== 1 || this.pointerDownAt?.id !== event.pointerId) return
    const dx = event.clientX - previous.x
    const dy = event.clientY - previous.y
    if (Math.hypot(dx, dy) < 0.01) return
    this.gestureMoved = true
    const scale = this.focusDragScale()
    this.orbitFocused(-dx * scale, dy * scale)
  }

  /** Two-finger pinch, which the orbit controls cannot do once their own zoom is switched off. */
  private readonly handleWheel = (event: WheelEvent): void => {
    if (!this.focusedId || this.flight) return
    event.preventDefault()
    // Wheel up has a negative delta and should move closer, same sense as a map.
    this.zoomFocused(normaliseWheelPixels(
      event.deltaY,
      event.deltaMode,
      this.stage.renderer.domElement.clientHeight,
    ))
  }

  private pointerSpread(): number {
    const points = [...this.pointers.values()]
    if (points.length < 2) return 0
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
  }

  /**
   * Zoom while a feature is focused. The orbit controls do not do this: their dolly works on the
   * distance to the target, and the body is held at a fixed altitude above the surface instead,
   * so the two would fight each other.
   */
  private zoomFocused(delta: number): void {
    const minimum = Math.max(this.minimumAltitudeRadii, kilometresToRadii(SCENE.minimumAltitudeKm))
    const scaled = this.focusDistance * Math.exp(delta * SCENE.focusedWheelScale)
    this.focusDistance = Math.min(SCENE.focusMaxAltitudeRadii, Math.max(minimum, scaled))
    // The orbit controls have their own zoom switched off while a feature is focused, so the
    // camera has to be moved here — otherwise this only updates a number nobody reads.
    this.applyFocusDistance()
  }

  /** Moves the camera along its current orbit direction to the distance the viewer asked for. */
  private applyFocusDistance(): void {
    this.applyFocusCamera()
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (this.flight?.intro) {
        this.skipIntro()
        return
      }
      if (this.focusedId) this.clearFocus()
      return
    }
    if (!this.focusedId || this.flight) return
    const step = SCENE.focusedKeyboardStepDeg * DEGREES_TO_RADIANS
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      this.orbitFocused(event.key === 'ArrowLeft' ? -step : step, 0)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      this.orbitFocused(0, event.key === 'ArrowUp' ? -step : step)
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      this.zoomFocused(-80)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      this.zoomFocused(80)
    }
  }

  /** Keyboard and pointer orbit share this one local tangent frame at every latitude. */
  private orbitFocused(deltaAzimuth: number, deltaPolar: number): void {
    if (!this.focusFrame) return
    this.focusAzimuth += deltaAzimuth
    this.focusPolar += deltaPolar
    this.applyFocusCamera()
  }

  /** Unit eye direction expressed in the site's north/east/up tangent frame. */
  private focusOffsetDirection(): THREE.Vector3 {
    const frame = this.focusFrame
    if (!frame) return UP.clone()
    const horizontal = frame.north.clone().multiplyScalar(Math.cos(this.focusAzimuth))
      .addScaledVector(frame.east, Math.sin(this.focusAzimuth))
    return frame.normal.clone().multiplyScalar(Math.cos(this.focusPolar))
      .addScaledVector(horizontal, Math.sin(this.focusPolar))
      .normalize()
  }

  /**
   * The configured horizon limit is tightened only when the current zoom would put the eye
   * inside the exaggerated terrain shell. This is a direct geometric bound, so there is no
   * post-frame correction to fight the drag and cause jitter.
   */
  private maximumFocusPolar(): number {
    return maximumSafePolarAngle(
      this.focusDistance,
      this.focusGroundRadius,
      kilometresToRadii(SCENE.terrainClearanceKm),
      SCENE.focusMinPolarAngle,
      SCENE.focusMaxPolarAngle,
    )
  }

  /** Applies the canonical focused-camera solution after any rotate or zoom input. */
  private applyFocusCamera(): void {
    const frame = this.focusFrame
    if (!frame) return
    this.focusPolar = Math.min(
      this.maximumFocusPolar(),
      Math.max(SCENE.focusMinPolarAngle, this.focusPolar),
    )
    const target = frame.normal.clone().multiplyScalar(this.focusGroundRadius)
    this.stage.controls.target.copy(target)
    this.stage.camera.position.copy(target)
      .addScaledVector(this.focusOffsetDirection(), this.focusDistance)
    this.stage.camera.up.copy(frame.normal)
    this.stage.camera.lookAt(target)
    this.labelElapsed = Number.POSITIVE_INFINITY
  }

  /** Pixel drag sensitivity falls logarithmically with zoom, preventing jumps at NAC scale. */
  private focusDragScale(): number {
    const minimum = Math.max(this.minimumAltitudeRadii, kilometresToRadii(SCENE.minimumAltitudeKm))
    return logarithmicDragScale(
      this.focusDistance,
      minimum,
      SCENE.focusMaxAltitudeRadii,
      SCENE.focusDragRadiansPerPixelMin,
      SCENE.focusDragRadiansPerPixelMax,
    )
  }

  private pickFeature(event: PointerEvent): MoonFeature | null {
    const canvas = this.stage.renderer.domElement
    const bounds = canvas.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return null
    this.pointerNdc.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointerNdc, this.stage.camera)
    const hits = this.raycaster.intersectObject(this.surface, false)
    if (hits.length === 0) return null
    const hit = hits[0].point
    const point = vectorToLonLat({ x: hit.x, y: hit.y, z: hit.z })

    let best: MoonFeature | null = null
    let bestAngle: number = SCENE.pickRadiusDeg
    for (const feature of MOON_FEATURES) {
      const angle = angularDistanceDeg(point.latDeg, point.lonDeg, feature.latDeg, feature.lonDeg)
      if (angle > bestAngle) continue
      bestAngle = angle
      best = feature
    }
    return best
  }

  private directionFrom(lonDeg: number, latDeg: number): THREE.Vector3 {
    const vector = lonLatToVector(lonDeg, latDeg)
    return new THREE.Vector3(vector.x, vector.y, vector.z)
  }
}

function pushSegment(
  positions: number[],
  lonA: number,
  latA: number,
  lonB: number,
  latB: number,
  radius: number,
): void {
  const a = lonLatToVector(lonA, latA, radius)
  const b = lonLatToVector(lonB, latB, radius)
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
}

/** Facts shown on the info card: they stay language-neutral so the scene needs no locales. */
function describeFeature(feature: MoonFeature): DemoHotspot {
  const latitude = `${Math.abs(feature.latDeg).toFixed(2)}\u00b0${feature.latDeg < 0 ? 'S' : 'N'}`
  const longitude = `${Math.abs(feature.lonDeg).toFixed(2)}\u00b0${feature.lonDeg < 0 ? 'W' : 'E'}`
  const facts = [`${latitude} ${longitude}`]
  if (feature.diameterKm) facts.push(`\u2300 ${feature.diameterKm} km`)
  return { id: feature.id, facts }
}

/** Any unit vector perpendicular to `normal`, used to tilt the camera off a pole-on view. */
function perpendicular(normal: THREE.Vector3): THREE.Vector3 {
  const result = new THREE.Vector3().crossVectors(normal, UP)
  if (result.lengthSq() < 1e-6) result.crossVectors(normal, new THREE.Vector3(1, 0, 0))
  return result.normalize()
}

/** Great-circle separation in degrees, which is the right measure for picking a feature. */
function angularDistanceDeg(latA: number, lonA: number, latB: number, lonB: number): number {
  const toRadians = DEGREES_TO_RADIANS
  const a = lonLatToVector(lonA, latA)
  const b = lonLatToVector(lonB, latB)
  return Math.acos(Math.min(1, Math.max(-1,
    a.x * b.x + a.y * b.y + a.z * b.z))) / toRadians
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * How much ground a crop guarantees around a feature, in kilometres: twice the smallest distance
 * from the feature to one of the crop's edges. Crops are usually centred on their feature, where
 * this is just the shorter side, but a crop pushed off the antimeridian is not, and the framing
 * has to follow the feature rather than the middle of the image.
 */
function siteSpanKm(site: MoonSite, latDeg: number, lonDeg: number): number {
  const [west, south, east, north] = site.bbox
  const cosLat = Math.max(Math.cos(latDeg * DEGREES_TO_RADIANS), 0.02)
  const westKm = (lonDeg - west) * KILOMETRES_PER_DEGREE * cosLat
  const eastKm = (east - lonDeg) * KILOMETRES_PER_DEGREE * cosLat
  const southKm = (latDeg - south) * KILOMETRES_PER_DEGREE
  const northKm = (north - latDeg) * KILOMETRES_PER_DEGREE
  return 2 * Math.min(westKm, eastKm, southKm, northKm)
}

/** Ground size of one crop texel, which sets how deep the camera may zoom over that feature. */
function siteTexelKm(site: MoonSite): number {
  const [west, south, east, north] = site.bbox
  const midLat = ((south + north) / 2) * DEGREES_TO_RADIANS
  const widthKm = (east - west) * KILOMETRES_PER_DEGREE * Math.max(Math.cos(midLat), 0.02)
  const heightKm = (north - south) * KILOMETRES_PER_DEGREE
  return Math.max(widthKm / site.width, heightKm / site.height)
}

function isPolarSite(site: MoonSite): boolean {
  return site.bbox[1] <= -89.999 || site.bbox[3] >= 89.999
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Alpha ramp for a detail patch: fully opaque in the middle, fading over the outer fifth so the
 * sharp crop melts into the atlas instead of ending on a hard rectangle.
 */
function createFeatherTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The lunar detail patch needs a 2D canvas context')
  const fade = 0.2
  const pixels = context.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y) / size
      const alpha = Math.min(1, edge / fade)
      const offset = (y * size + x) * 4
      // Three.js samples an alphaMap colour channel (not the source image's alpha channel), so
      // keep this as an opaque grayscale mask rather than relying on canvas transparency.
      const mask = Math.round(alpha * 255)
      pixels.data[offset] = mask
      pixels.data[offset + 1] = mask
      pixels.data[offset + 2] = mask
      pixels.data[offset + 3] = 255
    }
  }
  context.putImageData(pixels, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}
