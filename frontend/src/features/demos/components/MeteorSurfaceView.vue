<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * Ground-level finale: the viewer tilts up from the horizon into the night sky and a meteor
 * shower radiates from a single point. The photo is panned by animating the source rectangle
 * rather than scaling a DOM node, which keeps the pan crisp at any pixel ratio.
 */
const props = defineProps<{
  active: boolean
  imageUrl: string
  /** Altitude of the radiant above the horizon, from the scene's orbital geometry. */
  radiantAltitudeDeg: number
}>()

interface Meteor {
  active: boolean
  angle: number
  distance: number
  speed: number
  length: number
  brightness: number
  life: number
  maxLife: number
}

const TILT_SECONDS = 6
/** Hold on the horizon so the ground is seen before the view swings up. */
const TILT_HOLD_SECONDS = 1.6
const METEOR_POOL = 54
/**
 * The photographed horizon sits at 70% of the image height, measured from its brightness
 * profile. The photo's true field of view and orientation are unknown, so the vertical field
 * below is an estimate: it only sets how high in the frame the radiant is drawn.
 */
const HORIZON_SOURCE_Y = 0.7
const PHOTO_VERTICAL_FOV_DEG = 46
const RADIANT_SOURCE_X = 0.46
/**
 * Constant crop of the photograph, so the move is a pure tilt rather than a zoom. It has to
 * stay narrow enough that panning to the top of the image lifts the horizon out of frame.
 */
const SOURCE_WINDOW_FRACTION = 0.62
/** Slack below the horizon before the shower is allowed to start. */
const GROUND_CLEARANCE_FRACTION = 0.02

interface SourceRect {
  x: number
  y: number
  width: number
  height: number
}

const canvas = ref<HTMLCanvasElement | null>(null)

let animationFrame = 0
let resizeObserver: ResizeObserver | null = null
let context: CanvasRenderingContext2D | null = null
let image: HTMLImageElement | null = null
let imageReady = false
let disposed = false
let running = false
let width = 0
let height = 0
let elapsedSeconds = 0
let lastTimestamp = 0
let spawnCountdown = 0
let tiltProgress = 0
let sourceRect: SourceRect = { x: 0, y: 0, width: 1, height: 1 }
const meteors: Meteor[] = Array.from({ length: METEOR_POOL }, () => ({
  active: false,
  angle: 0,
  distance: 0,
  speed: 0,
  length: 0,
  brightness: 0,
  life: 0,
  maxLife: 1,
}))

function resize(): void {
  const element = canvas.value
  const parent = element?.parentElement
  if (!element || !parent) return
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  width = Math.max(1, parent.clientWidth)
  height = Math.max(1, parent.clientHeight)
  element.width = Math.round(width * ratio)
  element.height = Math.round(height * ratio)
  context = element.getContext('2d')
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function reset(): void {
  elapsedSeconds = 0
  lastTimestamp = 0
  spawnCountdown = 0.4
  tiltProgress = 0
  for (const meteor of meteors) meteor.active = false
}

function frame(timestamp: number): void {
  animationFrame = requestAnimationFrame(frame)
  if (!context || !imageReady || !image) return
  const delta = lastTimestamp === 0 ? 0 : Math.min((timestamp - lastTimestamp) / 1000, 0.05)
  lastTimestamp = timestamp
  elapsedSeconds += delta
  tiltProgress = easeInOutCubic(Math.min(1, Math.max(0, elapsedSeconds - TILT_HOLD_SECONDS) / TILT_SECONDS))

  drawSky(context)
  drawMeteors(context, delta)
}

function drawSky(target: CanvasRenderingContext2D): void {
  if (!image) return
  const aspect = width / height
  let sourceHeight = image.height * SOURCE_WINDOW_FRACTION
  let sourceWidth = sourceHeight * aspect
  if (sourceWidth > image.width) {
    sourceWidth = image.width
    sourceHeight = sourceWidth / aspect
  }
  const travel = Math.max(0, image.height - sourceHeight)
  sourceRect = {
    x: (image.width - sourceWidth) / 2,
    y: travel * 0.9 * (1 - tiltProgress),
    width: sourceWidth,
    height: sourceHeight,
  }
  target.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    width,
    height,
  )
}

/**
 * Meteors must not appear while any ground is still on screen, so the gate is the actual
 * framing rather than a progress threshold that could drift out of step with it.
 */
function groundVisible(): boolean {
  if (!image) return true
  const horizonY = HORIZON_SOURCE_Y * image.height
  return sourceRect.y + sourceRect.height > horizonY - GROUND_CLEARANCE_FRACTION * image.height
}

/**
 * The radiant is fixed against the star background, so it is anchored in the photograph and
 * converted to screen space through the same source rectangle as the pan.
 */
function radiantScreenPosition(): { x: number, y: number } | null {
  if (!image || sourceRect.width === 0) return null
  const sourceY = HORIZON_SOURCE_Y - props.radiantAltitudeDeg / PHOTO_VERTICAL_FOV_DEG
  return {
    x: ((RADIANT_SOURCE_X * image.width) - sourceRect.x) / sourceRect.width * width,
    y: ((sourceY * image.height) - sourceRect.y) / sourceRect.height * height,
  }
}

function drawMeteors(target: CanvasRenderingContext2D, delta: number): void {
  const skyClear = !groundVisible()

  if (skyClear) {
    spawnCountdown -= delta
    if (spawnCountdown <= 0) {
      const burst = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 3) : 1
      for (let index = 0; index < burst; index += 1) spawnMeteor()
      spawnCountdown = 0.05 + Math.random() * 0.16
    }
  }

  const origin = radiantScreenPosition()
  if (!origin) return
  const originX = origin.x
  const originY = origin.y
  const diagonal = Math.hypot(width, height)

  target.save()
  target.globalCompositeOperation = 'lighter'

  // A faint glow marks the radiant that every trail appears to come from.
  if (skyClear) {
    const glow = target.createRadialGradient(originX, originY, 0, originX, originY, diagonal * 0.07)
    glow.addColorStop(0, 'rgba(170, 205, 255, 0.1)')
    glow.addColorStop(1, 'rgba(120, 170, 255, 0)')
    target.fillStyle = glow
    target.beginPath()
    target.arc(originX, originY, diagonal * 0.07, 0, Math.PI * 2)
    target.fill()
  }

  for (const meteor of meteors) {
    if (!meteor.active) continue
    meteor.life += delta
    meteor.distance += meteor.speed * delta

    const progress = meteor.life / meteor.maxLife
    if (progress >= 1) {
      meteor.active = false
      continue
    }
    const alpha = meteor.brightness * Math.sin(Math.min(1, progress) * Math.PI)
    const cos = Math.cos(meteor.angle)
    const sin = Math.sin(meteor.angle)
    const headX = originX + cos * meteor.distance
    const headY = originY + sin * meteor.distance
    const tailX = originX + cos * (meteor.distance - meteor.length)
    const tailY = originY + sin * (meteor.distance - meteor.length)

    if (headX < -diagonal || headX > width + diagonal || headY < -diagonal || headY > height + diagonal) {
      meteor.active = false
      continue
    }

    const trail = target.createLinearGradient(headX, headY, tailX, tailY)
    trail.addColorStop(0, `rgba(255, 255, 246, ${alpha})`)
    trail.addColorStop(0.3, `rgba(200, 226, 255, ${alpha * 0.42})`)
    trail.addColorStop(1, 'rgba(150, 195, 255, 0)')
    target.strokeStyle = trail
    target.lineWidth = 1.4 + alpha * 1.6
    target.lineCap = 'round'
    target.beginPath()
    target.moveTo(headX, headY)
    target.lineTo(tailX, tailY)
    target.stroke()

    const head = target.createRadialGradient(headX, headY, 0, headX, headY, 7)
    head.addColorStop(0, `rgba(255, 255, 250, ${Math.min(1, alpha * 1.1)})`)
    head.addColorStop(1, 'rgba(190, 220, 255, 0)')
    target.fillStyle = head
    target.beginPath()
    target.arc(headX, headY, 7, 0, Math.PI * 2)
    target.fill()
  }

  target.restore()
}

function spawnMeteor(): void {
  const meteor = meteors.find((entry) => !entry.active)
  if (!meteor) return
  const diagonal = Math.hypot(width, height)
  const length = diagonal * (0.05 + Math.random() * 0.12)
  // Meteors appear all over the sky: the radiant is only where the backward extensions of
  // their paths meet, so a trail must start well away from it and never cross it.
  // Keep spawns near the radiant's part of the sky: with the radiant itself on screen, a
  // wide spawn radius would put most meteors outside the frame before they are ever seen.
  const distance = length + diagonal * (0.03 + Math.random() * 0.35)
  meteor.active = true
  meteor.angle = Math.random() * Math.PI * 2
  meteor.distance = distance
  meteor.speed = diagonal * (0.35 + Math.random() * 0.55)
  meteor.length = length
  meteor.brightness = 0.55 + Math.random() * 0.45
  meteor.life = 0
  meteor.maxLife = 0.9 + Math.random() * 0.9
}

function start(): void {
  if (running) return
  running = true
  resize()
  reset()
  animationFrame = requestAnimationFrame(frame)
}

function stop(): void {
  if (!running) return
  running = false
  cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

function loadImage(): void {
  if (image) return
  const element = new Image()
  element.decoding = 'async'
  element.addEventListener('load', () => {
    if (disposed) return
    image = element
    imageReady = true
  })
  element.src = props.imageUrl
}

onMounted(() => {
  loadImage()
  resizeObserver = new ResizeObserver(() => {
    resize()
  })
  const parent = canvas.value?.parentElement
  if (parent) resizeObserver.observe(parent)
  if (props.active) start()
})

onBeforeUnmount(() => {
  disposed = true
  stop()
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(() => props.active, (active) => {
  if (active) loadImage()
  if (active) start()
  else stop()
})

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
</script>

<template>
  <canvas ref="canvas" class="meteor-surface-canvas" aria-hidden="true" />
</template>

<style scoped>
/*
 * A canvas is a replaced element: `inset: 0` alone does not stretch it, so the browser lays
 * it out at its intrinsic size — the backing store, which is the CSS size times the device
 * pixel ratio. On a HiDPI screen that renders the photograph at double scale, anchored to the
 * top-left corner. The explicit box pins it to the container instead.
 */
.meteor-surface-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
</style>
