<script setup lang="ts">
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { clipAndProjectHorizonSegment, projectHorizontal } from './projection'
import type { ProjectedPoint } from './projection'
import { layoutSolarSystemLabels } from './solarSystemLabels'
import type {
  ComputedSolarSystemBody,
  SkyFrame,
  SkyObjectSelection,
  SolarSystemBodyId,
} from './types'
import {
  MAX_SKY_ZOOM,
  MIN_SKY_ZOOM,
  centerSkyViewOn,
  defaultSkyViewTransform,
  panSkyView,
  transformSkyPoint,
  zoomSkyViewAt,
} from './viewport'
import type { SkyViewTransform } from './viewport'

interface RenderedSkyObject {
  selection: SkyObjectSelection
  point: ProjectedPoint
  radius: number
}

interface DragSession {
  pointerId: number
  startX: number
  startY: number
  startTransform: SkyViewTransform
  moved: boolean
}

interface SolarSystemBodyStyle {
  fill: string
  stroke: string
  radius: number
}

interface SkyTextLabel {
  key: string
  text: string
  kind: 'culture' | 'pattern' | 'star'
  rank?: 1 | 2 | 3
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  priority: number
}

interface LabelBounds {
  left: number
  right: number
  top: number
  bottom: number
}

const SOLAR_SYSTEM_BODY_STYLES: Record<SolarSystemBodyId, SolarSystemBodyStyle> = {
  sun: { fill: '#f4c95d', stroke: '#ffe5a0', radius: 6.8 },
  moon: { fill: '#dce5e5', stroke: '#ffffff', radius: 5.8 },
  mercury: { fill: '#aaa39a', stroke: '#ddd6cd', radius: 3.5 },
  venus: { fill: '#e8cf91', stroke: '#fff0bd', radius: 4.5 },
  mars: { fill: '#c86f55', stroke: '#f0aa8c', radius: 4 },
  jupiter: { fill: '#c7a47e', stroke: '#ead5b7', radius: 5.2 },
  saturn: { fill: '#cbbb79', stroke: '#f0dea1', radius: 4.6 },
  uranus: { fill: '#86c5c7', stroke: '#c8f0ed', radius: 4 },
  neptune: { fill: '#6688cd', stroke: '#a8bff1', radius: 4 },
}

const props = defineProps<{
  frame: SkyFrame | null
  showCultureLines: boolean
  showCultureLabels: boolean
  showCultureBoundaries: boolean
  showStarNames: boolean
  showSolarSystemBodies: boolean
  selectedObject: SkyObjectSelection | null
}>()

const emit = defineEmits<{
  select: [selection: SkyObjectSelection | null]
}>()

const { t } = useI18n()
const container = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const viewportSize = ref(0)
const hoveredObject = ref<RenderedSkyObject | null>(null)
const viewTransform = ref(defaultSkyViewTransform())
const isDragging = ref(false)
let renderedStars: RenderedSkyObject[] = []
let renderedSolarSystemBodies: RenderedSkyObject[] = []
let resizeObserver: ResizeObserver | null = null
let dragSession: DragSession | null = null
let drawFrame = 0
let pointerFrame = 0
let pendingPointer: ProjectedPoint | null = null

const geometry = computed(() => {
  const size = viewportSize.value
  const center = size / 2
  const radius = Math.max(0, center - Math.max(24, size * 0.055))
  return { size, center, radius }
})

const zoomLabel = computed(() => `${Math.round(viewTransform.value.scale * 100)}%`)

const directionLabels = computed(() => {
  const { size, center, radius } = geometry.value
  const offset = Math.max(10, size * 0.018)
  return [
    { id: 'north', text: t('skyMap.directions.north'), x: center, y: center - radius - offset },
    { id: 'east', text: t('skyMap.directions.east'), x: center + radius + offset, y: center },
    { id: 'south', text: t('skyMap.directions.south'), x: center, y: center + radius + offset },
    { id: 'west', text: t('skyMap.directions.west'), x: center - radius - offset, y: center },
  ]
    .map((label) => ({ ...label, ...transformSkyPoint(label, viewTransform.value, center) }))
    .filter((label) => isPointInViewport(label, size, 8))
})

const skyTextLabels = computed(() => {
  if (!props.frame || viewportSize.value === 0) return []
  const { size, center, radius } = geometry.value
  const selectedStarId = props.selectedObject?.kind === 'star' ? props.selectedObject.object.id : null
  const patternMembers = new Set(props.frame.featuredPatterns.flatMap((pattern) => pattern.memberObjectIds))
  const candidates: SkyTextLabel[] = []

  if (props.showCultureLabels) {
    for (const figure of props.frame.cultureFigures) {
      if (!figure.labelPosition || figure.labelPosition.altitudeDeg < 5) continue
      if (figure.rank === 3 && viewTransform.value.scale < 2.5) continue
      const point = transformSkyPoint(
        projectHorizontal(figure.labelPosition, radius, center),
        viewTransform.value,
        center,
      )
      candidates.push({
        key: `culture-${figure.id}`,
        text: figure.name,
        kind: 'culture',
        rank: figure.rank,
        x: point.x,
        y: point.y,
        anchor: 'middle',
        priority: figure.rank === 1 ? 50_000 : figure.rank === 2 ? 28_000 : 18_000,
      })
    }
  }

  for (const pattern of props.frame.featuredPatterns) {
    if (!pattern.labelPosition || pattern.labelPosition.altitudeDeg < 5) continue
    const point = transformSkyPoint(
      projectHorizontal(pattern.labelPosition, radius, center),
      viewTransform.value,
      center,
    )
    candidates.push({
      key: `pattern-${pattern.id}`,
      text: pattern.name,
      kind: 'pattern',
      x: point.x,
      y: point.y - 24,
      anchor: 'middle',
      priority: 95_000,
    })
  }

  if (props.showStarNames || selectedStarId || patternMembers.size > 0) {
    const magnitudeThreshold = Math.min(6.5, 2.4 + Math.log2(viewTransform.value.scale) * 1.3)
    for (const label of props.frame.starLabels) {
      const selected = label.objectId === selectedStarId
      const patternMember = patternMembers.has(label.objectId)
      if (!props.showStarNames && !selected && !patternMember) continue
      if (!selected && !patternMember && label.visualMagnitude > magnitudeThreshold) continue
      const point = transformSkyPoint(
        projectHorizontal(label, radius, center),
        viewTransform.value,
        center,
      )
      const anchor = point.x > size - 96 ? 'end' as const : 'start' as const
      const offset = anchor === 'end' ? -7 : 7
      candidates.push({
        key: `star-${label.objectId}`,
        text: label.name,
        kind: 'star',
        x: point.x + offset,
        y: point.y,
        anchor,
        priority: selected
          ? 100_000
          : patternMember ? 90_000 : 30_000 + label.labelPriority * 100 - label.visualMagnitude,
      })
    }
  }

  candidates.sort((left, right) => right.priority - left.priority || left.key.localeCompare(right.key))
  const accepted: SkyTextLabel[] = []
  const occupied: LabelBounds[] = []
  const ordinaryLimit = Math.min(260, Math.round(42 * viewTransform.value.scale))
  let ordinaryCount = 0
  for (const candidate of candidates) {
    const alwaysVisible = candidate.priority >= 90_000
    if (candidate.kind === 'star' && !alwaysVisible && ordinaryCount >= ordinaryLimit) continue
    const bounds = labelBounds(candidate, size)
    if (!bounds || occupied.some((other) => intersects(bounds, other))) continue
    accepted.push(candidate)
    occupied.push(bounds)
    if (candidate.kind === 'star' && !alwaysVisible) ordinaryCount += 1
  }
  return accepted
})

const cultureLabels = computed(() => skyTextLabels.value.filter((label) => label.kind === 'culture'))
const patternLabels = computed(() => skyTextLabels.value.filter((label) => label.kind === 'pattern'))
const starLabels = computed(() => skyTextLabels.value.filter((label) => label.kind === 'star'))

const solarSystemLabels = computed(() => {
  if (!props.frame || !props.showSolarSystemBodies || viewportSize.value === 0) return []
  const { size, center, radius } = geometry.value
  const edgeThreshold = Math.max(58, size * 0.09)
  const labels = props.frame.solarSystemBodies
    .map((body) => {
      const point = transformSkyPoint(
        projectHorizontal(body, radius, center),
        viewTransform.value,
        center,
      )
      const placeOnLeft = point.x > size - edgeThreshold
      return {
        id: body.id,
        text: t(`skyMap.solarSystemBodies.${body.id}`),
        anchor: placeOnLeft ? 'end' as const : 'start' as const,
        radius: screenSolarSystemBodyRadius(body.id),
        point,
      }
    })
    .filter(({ point }) => isPointInViewport(point, size, 0))
  return layoutSolarSystemLabels(labels, size)
})

const selectedMarker = computed(() => {
  if (!props.frame || !props.selectedObject || viewportSize.value === 0) return null
  if (props.selectedObject.kind === 'solarSystemBody' && !props.showSolarSystemBodies) return null
  const object = resolveSelection(props.selectedObject)
  if (!object) return null
  const { size, center, radius } = geometry.value
  const point = transformSkyPoint(projectHorizontal(object, radius, center), viewTransform.value, center)
  if (!isPointInViewport(point, size, 0)) return null
  const markerRadius = props.selectedObject.kind === 'star'
    ? screenStarRadius(object.visualMagnitude)
    : screenSolarSystemBodyRadius(props.selectedObject.object.id)
  return { ...point, radius: markerRadius }
})

const hoveredMarker = computed(() => hoveredObject.value
  ? { ...hoveredObject.value.point, radius: hoveredObject.value.radius }
  : null)

watch(
  () => [
    props.frame,
    props.showCultureLines,
    props.showCultureBoundaries,
    props.showSolarSystemBodies,
    viewTransform.value,
  ] as const,
  scheduleDraw,
)

onMounted(() => {
  if (!container.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    viewportSize.value = Math.floor(entry.contentRect.width)
    viewTransform.value = defaultSkyViewTransform()
    scheduleDraw()
  })
  resizeObserver.observe(container.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (drawFrame) cancelAnimationFrame(drawFrame)
  if (pointerFrame) cancelAnimationFrame(pointerFrame)
})

defineExpose({ focusObject, resetView, zoomIn, zoomOut })

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

  applyCanvasTransform(context, center)
  drawGrid(context, center, radius)
  context.save()
  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.clip()
  if (props.frame && props.showCultureBoundaries) drawCultureRegions(context, center, radius)
  if (props.frame && props.showCultureLines) drawCultureFigures(context, center, radius)
  if (props.frame) drawFeaturedPatterns(context, center, radius)
  renderedStars = props.frame ? drawStars(context, center, radius) : []
  renderedSolarSystemBodies = props.frame && props.showSolarSystemBodies
    ? drawSolarSystemBodies(context, center, radius)
    : []
  context.restore()
  context.restore()
  hoveredObject.value = null
}

function applyCanvasTransform(context: CanvasRenderingContext2D, center: number): void {
  const transform = viewTransform.value
  context.save()
  context.translate(transform.offsetX, transform.offsetY)
  context.translate(center, center)
  context.scale(transform.scale, transform.scale)
  context.translate(-center, -center)
}

function drawGrid(context: CanvasRenderingContext2D, center: number, radius: number): void {
  context.strokeStyle = '#24434a'
  context.lineWidth = 1 / viewTransform.value.scale
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
  context.lineWidth = 1.5 / viewTransform.value.scale
  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.stroke()
}

function drawCultureRegions(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
): void {
  if (!props.frame) return
  context.beginPath()
  for (const region of props.frame.cultureRegions) {
    addHorizontalLinesToPath(context, region.rings, center, radius)
  }
  context.strokeStyle = '#4f5d6d'
  context.globalAlpha = 0.52
  context.lineWidth = 0.72 / viewTransform.value.scale
  context.stroke()
  context.globalAlpha = 1
}

function drawCultureFigures(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
): void {
  if (!props.frame) return
  for (const rank of [3, 2, 1] as const) {
    context.beginPath()
    for (const figure of props.frame.cultureFigures) {
      if (figure.rank !== rank) continue
      addHorizontalLinesToPath(context, figure.lines, center, radius)
    }
    context.strokeStyle = rank === 1 ? '#3e8f8b' : rank === 2 ? '#326d70' : '#294f55'
    context.globalAlpha = rank === 1 ? 0.8 : rank === 2 ? 0.62 : 0.46
    context.lineWidth = (rank === 1 ? 1.15 : 0.8) / viewTransform.value.scale
    context.stroke()
  }
  context.globalAlpha = 1
}

function drawFeaturedPatterns(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
): void {
  if (!props.frame || props.frame.featuredPatterns.length === 0) return
  context.beginPath()
  for (const pattern of props.frame.featuredPatterns) {
    addHorizontalLinesToPath(context, pattern.lines, center, radius)
  }
  context.strokeStyle = '#d6ad52'
  context.globalAlpha = 0.92
  context.lineWidth = 1.6 / viewTransform.value.scale
  context.stroke()
  context.globalAlpha = 1
}

function addHorizontalLinesToPath(
  context: CanvasRenderingContext2D,
  lines: Array<Array<{ azimuthDeg: number; altitudeDeg: number }>>,
  center: number,
  radius: number,
): void {
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const segment = clipAndProjectHorizonSegment(line[index - 1], line[index], radius, center)
      if (!segment) continue
      context.moveTo(segment.start.x, segment.start.y)
      context.lineTo(segment.end.x, segment.end.y)
    }
  }
}

function drawStars(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
): RenderedSkyObject[] {
  if (!props.frame) return []
  const inverseScale = 1 / viewTransform.value.scale
  return props.frame.stars.map((star) => {
    const basePoint = projectHorizontal(star, radius, center)
    const point = transformSkyPoint(basePoint, viewTransform.value, center)
    const starRadius = screenStarRadius(star.visualMagnitude)
    context.fillStyle = starColor(star.colorIndex)
    context.globalAlpha = Math.max(0.55, Math.min(1, 1.05 - star.visualMagnitude * 0.055))
    context.beginPath()
    context.arc(basePoint.x, basePoint.y, starRadius * inverseScale, 0, Math.PI * 2)
    context.fill()
    return { selection: { kind: 'star', object: star }, point, radius: starRadius }
  })
}

function drawSolarSystemBodies(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
): RenderedSkyObject[] {
  if (!props.frame) return []
  const inverseScale = 1 / viewTransform.value.scale
  const rendered: RenderedSkyObject[] = []
  context.globalAlpha = 1

  for (const body of props.frame.solarSystemBodies) {
    const point = projectHorizontal(body, radius, center)
    const style = SOLAR_SYSTEM_BODY_STYLES[body.id]
    const screenRadius = screenSolarSystemBodyRadius(body.id)
    const bodyRadius = screenRadius * inverseScale
    context.save()
    context.translate(point.x, point.y)

    if (body.id === 'sun') {
      context.beginPath()
      context.arc(0, 0, bodyRadius + 2.5 * inverseScale, 0, Math.PI * 2)
      context.strokeStyle = style.stroke
      context.globalAlpha = 0.55
      context.lineWidth = 1.4 * inverseScale
      context.stroke()
      context.globalAlpha = 1
    }

    if (body.id === 'saturn') {
      context.beginPath()
      context.ellipse(0, 0, bodyRadius * 1.65, bodyRadius * 0.62, -0.3, 0, Math.PI * 2)
      context.strokeStyle = style.stroke
      context.lineWidth = 1.2 * inverseScale
      context.stroke()
    }

    context.beginPath()
    context.arc(0, 0, bodyRadius, 0, Math.PI * 2)
    context.fillStyle = style.fill
    context.fill()
    context.strokeStyle = style.stroke
    context.lineWidth = 1.1 * inverseScale
    context.stroke()
    context.restore()
    rendered.push({
      selection: { kind: 'solarSystemBody', object: body },
      point: transformSkyPoint(point, viewTransform.value, center),
      radius: screenRadius,
    })
  }

  return rendered
}

function screenSolarSystemBodyRadius(id: SolarSystemBodyId): number {
  const sizeScale = Math.max(0.82, Math.min(1.15, viewportSize.value / 760))
  return SOLAR_SYSTEM_BODY_STYLES[id].radius * sizeScale
}

function screenStarRadius(magnitude: number): number {
  const sizeScale = Math.max(0.72, Math.min(1.15, viewportSize.value / 820))
  return Math.max(0.55, Math.min(5, 4.15 - magnitude * 0.55)) * sizeScale
}

function starColor(colorIndex: number | null): string {
  if (colorIndex === null) return '#eef4f5'
  if (colorIndex < -0.1) return '#a9c8ff'
  if (colorIndex < 0.35) return '#d9e7ff'
  if (colorIndex < 0.8) return '#fff4d7'
  if (colorIndex < 1.25) return '#ffd297'
  return '#ffad7b'
}

function onWheel(event: WheelEvent): void {
  if (event.ctrlKey) return
  const point = eventPoint(event)
  if (!point) return
  const factor = Math.exp(-event.deltaY * 0.0015)
  setZoom(viewTransform.value.scale * factor, point)
}

function zoomIn(): void {
  setZoom(viewTransform.value.scale * 1.4)
}

function zoomOut(): void {
  setZoom(viewTransform.value.scale / 1.4)
}

function setZoom(requestedScale: number, anchor?: ProjectedPoint): void {
  const { center, radius } = geometry.value
  viewTransform.value = zoomSkyViewAt(
    viewTransform.value,
    requestedScale,
    anchor ?? { x: center, y: center },
    center,
    radius,
  )
}

function resetView(): void {
  viewTransform.value = defaultSkyViewTransform()
}

function focusObject(selection: SkyObjectSelection): boolean {
  const object = resolveSelection(selection)
  if (!object) return false
  const { center, radius } = geometry.value
  const point = projectHorizontal(object, radius, center)
  viewTransform.value = centerSkyViewOn(
    point,
    Math.max(2.25, viewTransform.value.scale),
    center,
    radius,
  )
  return true
}

function resolveSelection(selection: SkyObjectSelection): SkyObjectSelection['object'] | null {
  if (!props.frame) return null
  return selection.kind === 'star'
    ? props.frame.stars.find(({ id }) => id === selection.object.id) ?? null
    : props.frame.solarSystemBodies.find(({ id }) => id === selection.object.id) ?? null
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  const point = eventPoint(event)
  if (!point) return
  dragSession = {
    pointerId: event.pointerId,
    startX: point.x,
    startY: point.y,
    startTransform: { ...viewTransform.value },
    moved: false,
  }
  isDragging.value = true
  container.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  const point = eventPoint(event)
  if (!point) return
  if (dragSession?.pointerId === event.pointerId) {
    const deltaX = point.x - dragSession.startX
    const deltaY = point.y - dragSession.startY
    dragSession.moved ||= Math.hypot(deltaX, deltaY) > 4
    viewTransform.value = panSkyView(
      dragSession.startTransform,
      deltaX,
      deltaY,
      geometry.value.radius,
    )
    return
  }

  pendingPointer = point
  if (pointerFrame) return
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0
    hoveredObject.value = pendingPointer ? hitTest(pendingPointer.x, pendingPointer.y) : null
  })
}

function onPointerUp(event: PointerEvent): void {
  if (!dragSession || dragSession.pointerId !== event.pointerId) return
  const point = eventPoint(event)
  if (!dragSession.moved && point) emit('select', hitTest(point.x, point.y)?.selection ?? null)
  finishDrag(event.pointerId)
}

function onPointerCancel(event: PointerEvent): void {
  if (dragSession?.pointerId === event.pointerId) finishDrag(event.pointerId)
}

function finishDrag(pointerId: number): void {
  if (container.value?.hasPointerCapture(pointerId)) container.value.releasePointerCapture(pointerId)
  dragSession = null
  isDragging.value = false
}

function onPointerLeave(): void {
  pendingPointer = null
  hoveredObject.value = null
}

function eventPoint(event: MouseEvent): ProjectedPoint | null {
  const bounds = container.value?.getBoundingClientRect()
  if (!bounds) return null
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

function hitTest(x: number, y: number): RenderedSkyObject | null {
  return hitTestCollection(renderedSolarSystemBodies, x, y, 8)
    ?? hitTestCollection(renderedStars, x, y, 6)
}

function hitTestCollection(
  objects: RenderedSkyObject[],
  x: number,
  y: number,
  minimumRadius: number,
): RenderedSkyObject | null {
  let closest: RenderedSkyObject | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const rendered of objects) {
    const distance = Math.hypot(rendered.point.x - x, rendered.point.y - y)
    const targetRadius = Math.max(minimumRadius, rendered.radius + 3)
    if (distance <= targetRadius && distance < closestDistance) {
      closest = rendered
      closestDistance = distance
    }
  }
  return closest
}

function isPointInViewport(point: ProjectedPoint, size: number, margin: number): boolean {
  return point.x >= margin && point.x <= size - margin && point.y >= margin && point.y <= size - margin
}

function labelBounds(label: SkyTextLabel, viewportSize: number): LabelBounds | null {
  const fontSize = label.kind === 'culture'
    ? Math.max(8, Math.min(12, viewportSize * 0.014))
    : label.kind === 'pattern'
      ? Math.max(9, Math.min(13, viewportSize * 0.0155))
      : Math.max(8, Math.min(12, viewportSize * 0.0135))
  const width = [...label.text].reduce(
    (total, character) => total + (character.codePointAt(0)! > 255 ? fontSize : fontSize * 0.58),
    0,
  )
  const left = label.anchor === 'middle' ? label.x - width / 2 : label.anchor === 'end' ? label.x - width : label.x
  const bounds = {
    left: left - 3,
    right: left + width + 3,
    top: label.y - fontSize * 0.72 - 2,
    bottom: label.y + fontSize * 0.72 + 2,
  }
  return bounds.left >= 2 && bounds.right <= viewportSize - 2 && bounds.top >= 2 && bounds.bottom <= viewportSize - 2
    ? bounds
    : null
}

function intersects(left: LabelBounds, right: LabelBounds): boolean {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top
}
</script>

<template>
  <div
    ref="container"
    class="sky-canvas"
    :class="{
      interactive: hoveredObject,
      'can-pan': viewTransform.scale > MIN_SKY_ZOOM,
      dragging: isDragging,
    }"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointerleave="onPointerLeave"
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
        v-for="label in cultureLabels"
        :key="label.key"
        class="culture-label"
        :class="`rank-${label.rank}`"
        :x="label.x"
        :y="label.y"
        :text-anchor="label.anchor"
      >{{ label.text }}</text>
      <text
        v-for="label in patternLabels"
        :key="label.key"
        class="pattern-label"
        :x="label.x"
        :y="label.y"
        :text-anchor="label.anchor"
      >{{ label.text }}</text>
      <text
        v-for="label in starLabels"
        :key="label.key"
        class="star-label"
        :class="`anchor-${label.anchor}`"
        :x="label.x"
        :y="label.y"
        :text-anchor="label.anchor"
      >{{ label.text }}</text>
      <line
        v-for="label in solarSystemLabels.filter(({ displaced }) => displaced)"
        :key="`${label.id}-leader`"
        class="solar-system-leader"
        :x1="label.point.x"
        :y1="label.point.y"
        :x2="label.leaderX"
        :y2="label.y"
      />
      <text
        v-for="label in solarSystemLabels"
        :key="label.id"
        class="solar-system-label"
        :class="`anchor-${label.anchor}`"
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

    <div class="navigation-tools" role="toolbar" :aria-label="t('skyMap.navigation')" @pointerdown.stop @click.stop>
      <button
        type="button"
        :aria-label="t('skyMap.zoomOut')"
        :title="t('skyMap.zoomOut')"
        :disabled="viewTransform.scale <= MIN_SKY_ZOOM"
        @click="zoomOut"
      ><ZoomOut :size="17" aria-hidden="true" /></button>
      <output aria-live="polite">{{ zoomLabel }}</output>
      <button
        type="button"
        :aria-label="t('skyMap.zoomIn')"
        :title="t('skyMap.zoomIn')"
        :disabled="viewTransform.scale >= MAX_SKY_ZOOM"
        @click="zoomIn"
      ><ZoomIn :size="17" aria-hidden="true" /></button>
      <button
        type="button"
        :aria-label="t('skyMap.resetView')"
        :title="t('skyMap.resetView')"
        :disabled="viewTransform.scale <= MIN_SKY_ZOOM"
        @click="resetView"
      ><Maximize2 :size="17" aria-hidden="true" /></button>
    </div>
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
  touch-action: none;
  user-select: none;
}

.sky-canvas.interactive canvas { cursor: pointer; }
.sky-canvas.can-pan canvas { cursor: grab; }
.sky-canvas.dragging canvas { cursor: grabbing; }

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

.culture-label {
  fill: #8ab8b3;
  font-size: clamp(8px, 1.4cqw, 12px);
}

.culture-label.rank-2 { fill: #668f8c; }
.culture-label.rank-3 { fill: #557576; }

.pattern-label {
  fill: #f1c969;
  font-size: clamp(9px, 1.55cqw, 13px);
  font-weight: 700;
}

.star-label {
  fill: #d9e4dc;
  font-size: clamp(8px, 1.35cqw, 12px);
}

.star-label.anchor-start { text-anchor: start; }
.star-label.anchor-end { text-anchor: end; }

.solar-system-leader {
  stroke: #968e73;
  stroke-width: 1px;
}

.solar-system-label {
  fill: #f0e6c8;
  font-size: clamp(9px, 1.55cqw, 13px);
  font-weight: 700;
}

.solar-system-label.anchor-start { text-anchor: start; }
.solar-system-label.anchor-end { text-anchor: end; }

.hover-marker,
.selected-marker { fill: none; }
.hover-marker { stroke: #f4d47a; stroke-width: 1px; }
.selected-marker { stroke: #f4d47a; stroke-width: 2px; }

.navigation-tools {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  display: grid;
  grid-template-columns: 34px 52px 34px 34px;
  align-items: center;
  overflow: hidden;
  border: 1px solid #3a4b51;
  border-radius: 4px;
  background: rgb(9 14 18 / 92%);
}

.navigation-tools button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-right: 1px solid #303e44;
  padding: 0;
  color: #d2dddd;
  background: transparent;
  cursor: pointer;
}

.navigation-tools button:last-child { border-right: 0; border-left: 1px solid #303e44; }
.navigation-tools button:hover:not(:disabled) { color: #07110f; background: #6fcbbb; }
.navigation-tools button:disabled { color: #526065; cursor: default; }
.navigation-tools output { color: #9fb1b3; font-size: .72rem; text-align: center; }
</style>
