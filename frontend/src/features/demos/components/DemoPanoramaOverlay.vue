<script setup lang="ts">
/**
 * Full-screen surface panorama viewer.
 *
 * Opens over the Moon demo when the viewer asks to browse a landing site's panorama. The
 * imagery is a single photographic strip mapped onto the inside of a sphere, so turning is
 * turning: nothing is modelled or extrapolated beyond the sweep the strip actually covers, and a
 * strip that does not close cannot be dragged past its own edge.
 *
 * The demo paused behind it, the drag and zoom limits and the placement maths all live in
 * `panoramaView.ts` and `moonPanoramas.ts`; this file is only the plumbing.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as THREE from 'three'
import type { DemoHotspot, DemoPanoramaReference } from '../types'
import { panoramaCaptionKey, panoramaTitleKey } from '../scenes/moon/hotspots'
import { findPanorama, panoramasForSite, type MoonPanorama } from '../scenes/moon/moonPanoramas'
import {
  clampPitch,
  clampYaw,
  defaultPitchDeg,
  dragDegreesPerPixelByAxis,
  fovLimits,
  openingFovDeg,
  panoramaCylinderGeometry,
  panoramaYawRadians,
  PANORAMA_DEFAULT_FOV_DEG,
  yawLimits,
} from '../scenes/moon/panoramaView'

const props = defineProps<{
  /** True while the panorama should be on screen. */
  active: boolean
  /** The feature the viewer drilled into, which decides which panoramas are offered. */
  hotspot: DemoHotspot | null
  /** Pauses the scene behind the overlay. */
  suspendScene: (suspended: boolean) => void
}>()

const emit = defineEmits<{ (event: 'exit'): void }>()

const { t } = useI18n()

const canvas = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const failed = ref(false)
const currentId = ref<string | null>(null)

const siteId = computed(() => props.hotspot?.id ?? null)
const available = computed<DemoPanoramaReference[]>(() => props.hotspot?.panoramas ?? [])
const current = computed<MoonPanorama | null>(() => (currentId.value ? findPanorama(currentId.value) : null))

/** Three.js objects are kept out of the reactive graph; they are never rendered directly. */
const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
const scene = shallowRef<THREE.Scene | null>(null)
const camera = shallowRef<THREE.PerspectiveCamera | null>(null)
const mesh = shallowRef<THREE.Mesh | null>(null)
const textures = new Map<string, THREE.Texture>()

const forward = new THREE.Vector3()
const orientation = new THREE.Quaternion()
let euler = new THREE.Euler(0, 0, 0, 'YXZ')
let yaw = 0
let pitch = 0
let frame = 0
let observer: ResizeObserver | null = null

/** Every renderer this overlay creates is disposable; a reopened overlay builds a fresh one. */
function disposeRenderer(): void {
  cancelAnimationFrame(frame)
  frame = 0
  observer?.disconnect()
  observer = null
  for (const texture of textures.values()) texture.dispose()
  textures.clear()
  mesh.value?.geometry.dispose()
  const material = mesh.value?.material
  if (material && !Array.isArray(material)) material.dispose()
  mesh.value = null
  scene.value = null
  camera.value = null
  renderer.value?.dispose()
  renderer.value = null
}

function buildGeometry(panorama: MoonPanorama): THREE.CylinderGeometry {
  // A cylinder rather than a sphere: these strips are cylindrical projections, so only a cylinder
  // shows them without stretching the terrain vertically.
  const geometry = panoramaCylinderGeometry(panorama)
  // The mesh turns by the panorama's heading; the viewer's own yaw is a camera rotation, so the
  // two add up without touching the geometry again.
  geometry.rotateY(panoramaYawRadians(panorama))
  return geometry
}

function ensureRenderer(): boolean {
  if (renderer.value) return true
  const element = canvas.value
  if (!element) return false
  try {
    const created = new THREE.WebGLRenderer({ canvas: element, antialias: true })
    created.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    created.outputColorSpace = THREE.SRGBColorSpace
    const builtScene = new THREE.Scene()
    const builtCamera = new THREE.PerspectiveCamera(PANORAMA_DEFAULT_FOV_DEG, 1, 0.01, 50)
    builtCamera.position.set(0, 0, 0)
    renderer.value = created
    scene.value = builtScene
    camera.value = builtCamera
    applyOrientation()
    resize()
    observer = new ResizeObserver(() => resize())
    observer.observe(element)
    return true
  } catch (error) {
    console.error('The panorama viewer could not start WebGL', error)
    failed.value = true
    return false
  }
}

function resize(): void {
  const element = canvas.value
  const active = renderer.value
  const activeCamera = camera.value
  if (!element || !active || !activeCamera) return
  const width = Math.max(1, element.clientWidth)
  const height = Math.max(1, element.clientHeight)
  active.setSize(width, height, false)
  activeCamera.aspect = width / height
  activeCamera.updateProjectionMatrix()
}

function loadTexture(panorama: MoonPanorama): THREE.Texture {
  const cached = textures.get(panorama.id)
  if (cached) return cached
  const texture = new THREE.TextureLoader().load(
    panorama.file,
    // The image is decoded off the main thread, so "loaded" arrives after this call returns.
    () => {
      loading.value = false
    },
    undefined,
    () => {
      failed.value = true
      loading.value = false
    },
  )
  texture.colorSpace = THREE.SRGBColorSpace
  // The strip's own horizontal wrap is only correct when it closes end to end. Nothing is mirrored
  // here: the cylinder's winding already presents the photograph the right way round.
  texture.wrapS = panorama.spanDeg >= 359.5 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 4
  textures.set(panorama.id, texture)
  return texture
}

function show(panorama: MoonPanorama): void {
  if (!ensureRenderer()) return
  const builtScene = scene.value
  if (!builtScene) return
  loading.value = true
  failed.value = false
  const texture = loadTexture(panorama)
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
  // A lit material would double-light a photograph that already carries its own Sun.
  const created = new THREE.Mesh(buildGeometry(panorama), material)
  if (mesh.value) {
    builtScene.remove(mesh.value)
    mesh.value.geometry.dispose()
    const previous = mesh.value.material
    if (!Array.isArray(previous)) previous.dispose()
  }
  builtScene.add(created)
  mesh.value = created
  yaw = 0
  // The camera is chosen from the strip: a 13:1 panorama would be a slit in a normal lens, and a
  // tall one would be cropped. Zoom limits follow the same reasoning.
  const activeCamera = camera.value
  if (activeCamera) {
    activeCamera.fov = openingFovDeg(panorama)
    activeCamera.updateProjectionMatrix()
  }
  pitch = defaultPitchDeg(panorama)
  applyOrientation()
  currentId.value = panorama.id
}

/** The camera looks out from the centre; yaw turns about the vertical axis, pitch tilts. */
function applyOrientation(): void {
  const activeCamera = camera.value
  if (!activeCamera) return
  // A positive yaw turns toward increasing azimuth, i.e. to the viewer's right, which is what a
  // rightward drag should do. `three`'s Y rotation runs the other way seen from above, so both
  // angles are negated here.
  euler = new THREE.Euler((-pitch * Math.PI) / 180, (-yaw * Math.PI) / 180, 0, 'YXZ')
  orientation.setFromEuler(euler)
  forward.set(0, 0, -1).applyQuaternion(orientation)
  activeCamera.lookAt(forward)
}

function limits() {
  return yawLimits(current.value ?? { spanDeg: 360 })
}

/** Zoom limits for the strip on screen, which differ because their vertical extents do. */
function zoomLimits() {
  return fovLimits(current.value ?? { verticalFovDeg: PANORAMA_DEFAULT_FOV_DEG })
}

function setFov(next: number): void {
  const activeCamera = camera.value
  if (!activeCamera) return
  const bounds = zoomLimits()
  activeCamera.fov = Math.min(bounds.max, Math.max(bounds.min, next))
  activeCamera.updateProjectionMatrix()
}

/**
 * Drag state. The pointer position is tracked explicitly rather than read from `movementX`, which
 * depends on the browser's pointer-lock and zoom behaviour and drops to zero on touch.
 */
let dragPointerId: number | null = null
let lastPointer = { x: 0, y: 0 }
/** Degrees to turn per frame while gliding after a flick, damped on every frame. */
let glideYaw = 0
let glidePitch = 0
const GLIDE_DAMPING = 0.9
/** Below this, a glide is imperceptible and is stopped. */
const GLIDE_STOP_DEG = 0.02

function handlePointerDown(event: PointerEvent): void {
  if (!props.active) return
  if (dragPointerId !== null) return
  dragPointerId = event.pointerId
  lastPointer = { x: event.clientX, y: event.clientY }
  glideYaw = 0
  glidePitch = 0
  // Capturing means the drag survives the pointer leaving the window, which is what makes a
  // full-width sweep possible.
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  event.preventDefault()
}

function handlePointerMove(event: PointerEvent): void {
  if (dragPointerId !== event.pointerId || !current.value) return
  const dx = event.clientX - lastPointer.x
  const dy = event.clientY - lastPointer.y
  lastPointer = { x: event.clientX, y: event.clientY }
  if (dx === 0 && dy === 0) return
  turnByPixels(dx, dy)
}

function handlePointerUp(event: PointerEvent): void {
  if (dragPointerId !== event.pointerId) return
  dragPointerId = null
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
}

/**
 * Turn the view by a pointer displacement, and remember the speed so releasing mid-sweep glides on.
 *
 * Degrees per pixel is taken per axis from the camera rather than averaged, so a drag follows the
 * pointer wherever it goes: the part of the photograph under the cursor stays under it in both
 * directions at once. The division costs nothing next to the render.
 */
function turnByPixels(dx: number, dy: number): void {
  const element = canvas.value
  const activeCamera = camera.value
  if (!element || !activeCamera) return
  const perPixel = dragDegreesPerPixelByAxis(activeCamera.fov, element.clientWidth, element.clientHeight)
  // Both signs make the picture follow the pointer, which is the convention every map and panorama
  // viewer uses: drag right and the photograph slides right, drag down and it slides down.
  //
  // The pitch sign was got wrong twice by reasoning, so it is settled by measurement instead. The
  // tempting argument - "a positive pitch raises the view, so the ground slides down, so dragging
  // down should increase pitch" - does not survive contact with `applyOrientation`, which derives
  // the forward vector from the quaternion and then calls `lookAt`, so the final camera orientation
  // does not decompose the way that argument assumes.
  //
  // `docs/lunar-panorama-research/tools/measure-drag.mjs` drags the view in each axis and aligns the two
  // screenshots to report which way the picture actually went. Re-run it after touching this line; the
  // measured result for the shipping signs is "drag down -> picture down, drag right -> picture right".
  yaw = clampYaw(yaw - dx * perPixel.x, limits())
  pitch = clampPitch(pitch - dy * perPixel.y)
  glideYaw = -dx * perPixel.x
  glidePitch = -dy * perPixel.y
  applyOrientation()
}

/** Applies the decaying remainder of a flick. Returns true while there is any left to apply. */
function stepGlide(): boolean {
  if (Math.abs(glideYaw) < GLIDE_STOP_DEG && Math.abs(glidePitch) < GLIDE_STOP_DEG) {
    glideYaw = 0
    glidePitch = 0
    return false
  }
  yaw = clampYaw(yaw + glideYaw, limits())
  pitch = clampPitch(pitch + glidePitch)
  applyOrientation()
  glideYaw *= GLIDE_DAMPING
  glidePitch *= GLIDE_DAMPING
  return true
}

function handleWheel(event: WheelEvent): void {
  event.preventDefault()
  const activeCamera = camera.value
  if (!activeCamera) return
  setFov(activeCamera.fov + event.deltaY * 0.05)
}

function handleKeydown(event: KeyboardEvent): void {
  if (!props.active) return
  const activeCamera = camera.value
  if (!activeCamera) return
  const step = 3
  if (event.key === 'ArrowLeft') {
    yaw = clampYaw(yaw - step, limits())
  } else if (event.key === 'ArrowRight') {
    yaw = clampYaw(yaw + step, limits())
  } else if (event.key === 'ArrowUp') {
    pitch = clampPitch(pitch - step)
  } else if (event.key === 'ArrowDown') {
    pitch = clampPitch(pitch + step)
  } else if (event.key === '+' || event.key === '=') {
    setFov(activeCamera.fov - 4)
    return
  } else if (event.key === '-' || event.key === '_') {
    setFov(activeCamera.fov + 4)
    return
  } else {
    return
  }
  event.preventDefault()
  applyOrientation()
}

function tick(): void {
  frame = requestAnimationFrame(tick)
  const activeRenderer = renderer.value
  const builtScene = scene.value
  const activeCamera = camera.value
  if (!activeRenderer || !builtScene || !activeCamera || !props.active) return
  // A glide only runs when the pointer is not down, so a drag is never fought by its own momentum.
  if (dragPointerId === null) stepGlide()
  activeRenderer.render(builtScene, activeCamera)
}

function open(id: string): void {
  const panorama = findPanorama(id)
  if (panorama) show(panorama)
}

watch(
  () => props.active,
  (active) => {
    props.suspendScene(active)
    if (active) {
      const first = available.value[0]
      if (first) open(first.id)
      loading.value = available.value.length > 0
      if (!frame) frame = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(frame)
      frame = 0
      yaw = 0
      pitch = 0
    }
  },
  { immediate: true },
)

// Drilling into a different feature while the viewer is open swaps in that site's first
// panorama rather than leaving the previous site's imagery on screen.
watch(
  () => [props.active, siteId.value] as const,
  ([active]) => {
    if (!active) return
    const first = available.value[0]
    if (first && first.id !== currentId.value) open(first.id)
  },
)

watch(currentId, (id) => {
  if (id) loading.value = false
})

onMounted(() => {
  // On the window rather than the canvas: nothing gives the canvas focus, so a listener scoped
  // to it would never fire for the keys the viewer advertises.
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  disposeRenderer()
})
</script>

<template>
  <div
    class="pano"
    :class="{ 'pano-open': active }"
    :aria-hidden="active ? 'false' : 'true'"
    role="dialog"
    :aria-label="t('demos.items.moon.panorama.label')"
  >
    <canvas
      ref="canvas"
      class="pano-canvas"
      :aria-label="t('demos.items.moon.panorama.canvasAria')"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @wheel="handleWheel"
    />

    <header class="pano-bar">
      <div class="pano-heading">
        <p class="pano-site">{{ hotspot ? t(`demos.items.moon.hotspots.${hotspot.id}.title`) : '' }}</p>
        <h2 v-if="current">{{ t(panoramaTitleKey(current.id)) }}</h2>
      </div>
      <div class="pano-actions">
        <div v-if="available.length > 1" class="pano-picker" role="tablist">
          <button
            v-for="entry in available"
            :key="entry.id"
            type="button"
            role="tab"
            class="pano-tab"
            :class="{ 'pano-tab-active': entry.id === currentId }"
            :aria-selected="entry.id === currentId"
            @click="open(entry.id)"
          >
            {{ t(entry.titleKey) }}
          </button>
        </div>
        <button type="button" class="pano-exit" @click="emit('exit')">
          {{ t('demos.items.moon.panorama.close') }}
        </button>
      </div>
    </header>

    <p v-if="loading" class="pano-status" role="status">{{ t('demos.items.moon.panorama.loading') }}</p>
    <p v-else-if="failed" class="pano-status pano-error">{{ t('demos.items.moon.panorama.failed') }}</p>
    <p v-else-if="available.length === 0" class="pano-status">{{ t('demos.items.moon.panorama.none') }}</p>

    <footer v-if="current" class="pano-foot">
      <p class="pano-caption">{{ t(panoramaCaptionKey(current.id)) }}</p>
      <p class="pano-meta">
        <span>{{ current.sourceFrames }}</span>
        <span>{{ current.credit }} · {{ current.licence }}</span>
        <span v-if="current.spanSource === 'modelled'" class="pano-caveat">
          {{ t('demos.items.moon.panorama.sweepModelled') }}
        </span>
      </p>
      <p class="pano-hint">{{ t('demos.items.moon.panorama.hint') }}</p>
    </footer>
  </div>
</template>

<style scoped>
.pano {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  background: #000;
  opacity: 0;
  visibility: hidden;
  transition: opacity .4s ease, visibility .4s ease;
}

.pano-open { opacity: 1; visibility: visible; }

.pano-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}

.pano-canvas:active { cursor: grabbing; }

.pano-bar {
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: .6rem 1rem;
  align-items: flex-start;
  justify-content: space-between;
  padding: clamp(12px, 2vw, 20px) clamp(12px, 2vw, 22px);
  background: linear-gradient(rgb(0 0 0 / 72%), transparent);
  pointer-events: none;
}

/* Children take pointer events back individually: a full-width bar must not swallow a drag that
   starts beside the buttons. */
.pano-heading,
.pano-actions { pointer-events: auto; }

.pano-site {
  margin: 0 0 .15rem;
  color: #72d4d8;
  font-size: .68rem;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.pano-heading h2 { margin: 0; color: #eaf2ff; font-size: 1.05rem; text-shadow: 0 1px 6px rgb(0 0 0 / 90%); }

.pano-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  align-items: center;
  /* Never let the controls run off the edge of the stage. */
  max-width: 100%;
}

.pano-picker { display: flex; flex-wrap: wrap; gap: .35rem; }

.pano-tab {
  min-height: 32px;
  padding: 0 .7rem;
  border: 1px solid rgb(80 110 140 / 70%);
  border-radius: 5px;
  color: #c8d6e7;
  font-size: .74rem;
  background: rgb(6 14 26 / 72%);
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease, color .18s ease;
}

.pano-tab:hover { border-color: #72d4d8; color: #eaf2ff; background: rgb(14 30 48 / 88%); }

.pano-tab-active { color: #07111f; background: #72d4d8; border-color: #72d4d8; }

/**
 * The way back out of the viewer.
 *
 * This used to carry a `demo-button` class, which is scoped to `DemoDetailView` and so never
 * applied here: the button rendered with the browser's default chrome, which is why it looked both
 * plain and cramped. It is styled locally instead, deliberately the most prominent control on the
 * screen because it is the only escape from a full-screen view.
 */
.pano-exit {
  min-height: 38px;
  padding: 0 1.05rem;
  border: 1px solid #72d4d8;
  border-radius: 5px;
  color: #d8f6f7;
  font-size: .8rem;
  font-weight: 600;
  letter-spacing: .04em;
  white-space: nowrap;
  background: rgb(10 34 46 / 88%);
  cursor: pointer;
  transition: background .18s ease, color .18s ease, border-color .18s ease;
}

.pano-exit:hover { color: #07111f; background: #72d4d8; }

.pano-exit:focus-visible { outline: 2px solid #eaf2ff; outline-offset: 2px; }

.pano-status {
  position: absolute;
  z-index: 3;
  inset: 50% 1rem auto;
  transform: translateY(-50%);
  margin: 0;
  color: #b9c9dd;
  font-size: .9rem;
  letter-spacing: .06em;
  text-align: center;
  text-shadow: 0 1px 8px rgb(0 0 0 / 90%);
}

.pano-error { color: #ffb4a2; }

.pano-foot {
  position: relative;
  z-index: 2;
  margin-top: auto;
  padding: clamp(12px, 2vw, 20px) clamp(12px, 2vw, 22px);
  background: linear-gradient(transparent, rgb(0 0 0 / 78%));
}

.pano-caption { max-width: 62ch; margin: 0 0 .35rem; color: #dce7f6; font-size: .84rem; line-height: 1.6; }

.pano-meta { display: flex; flex-direction: column; gap: .12rem; margin: 0 0 .3rem; color: #8fa4bd; font-size: .7rem; }

.pano-caveat { color: #f0c98a; }

.pano-hint { margin: 0; color: #6d86a3; font-size: .7rem; }

@media (max-width: 900px) {
  .pano-caption { font-size: .78rem; }
}
</style>
