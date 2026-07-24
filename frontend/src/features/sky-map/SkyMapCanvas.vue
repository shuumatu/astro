<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { clipAndProjectHorizonSegment, projectHorizontal } from './projection'
import type { ProjectedPoint } from './projection'
import type { ComputedStar, SkyFrame } from './types'

interface RenderedStar {
  star: ComputedStar
  point: ProjectedPoint
  radius: number
}

const props = defineProps<{
  frame: SkyFrame | null
  showConstellationLines: boolean
  showConstellationLabels: boolean
  selectedStarId: string | null
}>()

const emit = defineEmits<{
  select: [star: ComputedStar | null]
}>()

const { t } = useI18n()
const container = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const viewportSize = ref(0)
const hoveredStar = ref<RenderedStar | null>(null)
let renderedStars: RenderedStar[] = []
let resizeObserver: ResizeObserver | null = null
let drawFrame = 0
let pointerFrame = 0
let pendingPointer: { x: number; y: number } | null = null

const geometry = computed(() => {
  const size = viewportSize.value
  const center = size / 2
  const radius = Math.max(0, center - Math.max(24, size * 0.055))
  return { size, center, radius }
})

const directionLabels = computed(() => {
  const { center, radius } = geometry.value
  const offset = Math.max(10, viewportSize.value * 0.018)
  return [
    { id: 'north', text: t('skyMap.directions.north'), x: center, y: center - radius - offset },
    { id: 'east', text: t('skyMap.directions.east'), x: center + radius + offset, y: center },
    { id: 'south', text: t('skyMap.directions.south'), x: center, y: center + radius + offset },
    { id: 'west', text: t('skyMap.directions.west'), x: center - radius - offset, y: center },
  ]
})

const constellationLabels = computed(() => {
  if (!props.frame || !props.showConstellationLabels || viewportSize.value === 0) return []
  const { center, radius } = geometry.value
  return props.frame.constellations.flatMap((constellation) => {
    if (constellation.rank > 2) return []
    return constellation.labelPositions
      .filter((coordinate) => coordinate.altitudeDeg >= 5)
      .map((coordinate, index) => ({
        key: `${constellation.id}-${index}`,
        text: constellation.id,
        rank: constellation.rank,
        ...projectHorizontal(coordinate, radius, center),
      }))
  })
})

const selectedMarker = computed(() => {
  if (!props.frame || !props.selectedStarId || viewportSize.value === 0) return null
  const star = props.frame.stars.find(({ id }) => id === props.selectedStarId)
  if (!star) return null
  const { center, radius } = geometry.value
  const scale = Math.max(0.72, Math.min(1.15, viewportSize.value / 820))
  return {
    ...projectHorizontal(star, radius, center),
    radius: magnitudeRadius(star.visualMagnitude) * scale,
  }
})
const hoveredMarker = computed(() => hoveredStar.value
  ? { ...hoveredStar.value.point, radius: hoveredStar.value.radius }
  : null)

watch(
  () => [props.frame, props.showConstellationLines] as const,
  scheduleDraw,
)

onMounted(() => {
  if (!container.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    viewportSize.value = Math.floor(entry.contentRect.width)
    scheduleDraw()
  })
  resizeObserver.observe(container.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (drawFrame) cancelAnimationFrame(drawFrame)
  if (pointerFrame) cancelAnimationFrame(pointerFrame)
})

function scheduleDraw(): void {
  if (drawFrame) cancelAnimationFrame(drawFrame)
  drawFrame = requestAnimationFrame(() => {
    drawFrame = 0
    draw()
  })
}

function draw(): void {
  const element = canvas.value
  const { size, center, radius } = geometry.value
  if (!element || size <= 0) return

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  element.width = Math.round(size * pixelRatio)
  element.height = Math.round(size * pixelRatio)
  const context = element.getContext('2d')
  if (!context) return
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, size, size)
  context.fillStyle = '#030609'
  context.fillRect(0, 0, size, size)
  drawGrid(context, center, radius)

  context.save()
  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.clip()
  if (props.frame && props.showConstellationLines) drawConstellations(context, center, radius)
  renderedStars = props.frame ? drawStars(context, center, radius) : []
  hoveredStar.value = null
  context.restore()
}

function drawGrid(context: CanvasRenderingContext2D, center: number, radius: number): void {
  context.strokeStyle = '#24434a'
  context.lineWidth = 1
  context.beginPath()
  for (const fraction of [1 / 3, 2 / 3, 1]) {
    context.moveTo(center + radius * fraction, center)
    context.arc(center, center, radius * fraction, 0, Math.PI * 2)
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = index * Math.PI / 6
    context.moveTo(center, center)
    context.lineTo(center + Math.sin(angle) * radius, center - Math.cos(angle) * radius)
  }
  context.stroke()

  context.strokeStyle = '#6b9193'
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.stroke()
}

function drawConstellations(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
): void {
  if (!props.frame) return
  for (const rank of [3, 2, 1] as const) {
    context.beginPath()
    for (const constellation of props.frame.constellations) {
      if (constellation.rank !== rank) continue
      for (const line of constellation.lines) {
        for (let index = 1; index < line.length; index += 1) {
          const segment = clipAndProjectHorizonSegment(line[index - 1], line[index], radius, center)
          if (!segment) continue
          context.moveTo(segment.start.x, segment.start.y)
          context.lineTo(segment.end.x, segment.end.y)
        }
      }
    }
    context.strokeStyle = rank === 1 ? '#3e8f8b' : rank === 2 ? '#326d70' : '#294f55'
    context.globalAlpha = rank === 1 ? 0.8 : rank === 2 ? 0.62 : 0.46
    context.lineWidth = rank === 1 ? 1.15 : 0.8
    context.stroke()
  }
  context.globalAlpha = 1
}

function drawStars(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
): RenderedStar[] {
  if (!props.frame) return []
  const scale = Math.max(0.72, Math.min(1.15, viewportSize.value / 820))
  return props.frame.stars.map((star) => {
    const point = projectHorizontal(star, radius, center)
    const starRadius = magnitudeRadius(star.visualMagnitude) * scale
    context.fillStyle = starColor(star.colorIndex)
    context.globalAlpha = Math.max(0.55, Math.min(1, 1.05 - star.visualMagnitude * 0.055))
    context.beginPath()
    context.arc(point.x, point.y, starRadius, 0, Math.PI * 2)
    context.fill()
    return { star, point, radius: starRadius }
  })
}

function magnitudeRadius(magnitude: number): number {
  return Math.max(0.55, Math.min(5, 4.15 - magnitude * 0.55))
}

function starColor(colorIndex: number | null): string {
  if (colorIndex === null) return '#eef4f5'
  if (colorIndex < -0.1) return '#a9c8ff'
  if (colorIndex < 0.35) return '#d9e7ff'
  if (colorIndex < 0.8) return '#fff4d7'
  if (colorIndex < 1.25) return '#ffd297'
  return '#ffad7b'
}

function onPointerMove(event: PointerEvent): void {
  const bounds = container.value?.getBoundingClientRect()
  if (!bounds) return
  pendingPointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  if (pointerFrame) return
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0
    hoveredStar.value = pendingPointer ? hitTest(pendingPointer.x, pendingPointer.y) : null
  })
}

function onPointerLeave(): void {
  pendingPointer = null
  hoveredStar.value = null
}

function onPointerClick(event: PointerEvent): void {
  const bounds = container.value?.getBoundingClientRect()
  if (!bounds) return
  const rendered = hitTest(event.clientX - bounds.left, event.clientY - bounds.top)
  emit('select', rendered?.star ?? null)
}

function hitTest(x: number, y: number): RenderedStar | null {
  let closest: RenderedStar | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const rendered of renderedStars) {
    const distance = Math.hypot(rendered.point.x - x, rendered.point.y - y)
    const targetRadius = Math.max(6, rendered.radius + 3)
    if (distance <= targetRadius && distance < closestDistance) {
      closest = rendered
      closestDistance = distance
    }
  }
  return closest
}
</script>

<template>
  <div
    ref="container"
    class="sky-canvas"
    :class="{ interactive: hoveredStar }"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @click="onPointerClick"
  >
    <canvas ref="canvas" role="img" :aria-label="t('skyMap.chartAria')">
      {{ t('skyMap.canvasFallback') }}
    </canvas>
    <svg
      v-if="viewportSize > 0"
      class="sky-overlay"
      :viewBox="`0 0 ${viewportSize} ${viewportSize}`"
      aria-hidden="true"
    >
      <text
        v-for="direction in directionLabels"
        :key="direction.id"
        class="direction-label"
        :x="direction.x"
        :y="direction.y"
      >{{ direction.text }}</text>
      <text
        v-for="label in constellationLabels"
        :key="label.key"
        class="constellation-label"
        :class="`rank-${label.rank}`"
        :x="label.x"
        :y="label.y"
      >{{ label.text }}</text>
      <circle
        v-if="hoveredMarker"
        class="hover-marker"
        :cx="hoveredMarker.x"
        :cy="hoveredMarker.y"
        :r="hoveredMarker.radius + 3"
      />
      <circle
        v-if="selectedMarker"
        class="selected-marker"
        :cx="selectedMarker.x"
        :cy="selectedMarker.y"
        :r="selectedMarker.radius + 6"
      />
    </svg>
  </div>
</template>

<style scoped>
.sky-canvas {
  position: relative;
  container-type: inline-size;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: #030609;
  touch-action: manipulation;
}

.sky-canvas.interactive { cursor: pointer; }

canvas,
.sky-overlay {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.sky-overlay { pointer-events: none; }

text {
  text-anchor: middle;
  dominant-baseline: central;
  letter-spacing: 0;
  paint-order: stroke;
  stroke: #030609;
  stroke-width: 3px;
  stroke-linejoin: round;
}

.direction-label {
  fill: #9db9bb;
  font-size: clamp(10px, 1.8cqw, 15px);
  font-weight: 700;
}

.constellation-label {
  fill: #8ab8b3;
  font-size: clamp(8px, 1.4cqw, 12px);
}

.constellation-label.rank-2 { fill: #668f8c; }

.hover-marker,
.selected-marker { fill: none; }
.hover-marker { stroke: #f4d47a; stroke-width: 1px; }
.selected-marker { stroke: #f4d47a; stroke-width: 2px; }
</style>
