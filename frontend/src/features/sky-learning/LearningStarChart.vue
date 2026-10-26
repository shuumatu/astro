<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { projectLearningStars, type LearningChartStar } from './projection'
import { learningStarAppearance, type StarRenderMode } from './starAppearance'

const props = withDefaults(defineProps<{
  stars: readonly LearningChartStar[]
  paths: readonly (readonly string[])[]
  centerRaDeg: number
  centerDecDeg: number
  variant?: number
  showLabels: boolean
  labelIds?: readonly string[]
  showLines: boolean
  highlightId?: string | null
  selectedId?: string | null
  disabled?: boolean
}>(), { variant: 0, highlightId: null, selectedId: null, disabled: false })

const emit = defineEmits<{ select: [id: string] }>()
const lightProfileId = `learning-star-${useId()}`
const instructionsId = `${lightProfileId}-instructions`
const hitRadius = 22
const renderModeKey = 'astro-sky-learning-render-mode'
const renderMode = ref<StarRenderMode>(readRenderMode())
const container = ref<HTMLElement | null>(null)
const width = ref(720)
const height = computed(() => Math.max(340, Math.min(520, width.value * .68)))
let observer: ResizeObserver | undefined

function readRenderMode(): StarRenderMode {
  try { return window.localStorage.getItem(renderModeKey) === 'clear' ? 'clear' : 'natural' }
  catch { return 'natural' }
}

function setRenderMode(mode: StarRenderMode) {
  renderMode.value = mode
  // Display preferences are independent of assessment records. Restricted
  // storage should never prevent changing the current chart or answering.
  try { window.localStorage.setItem(renderModeKey, mode) } catch { /* Use this selection for the current view. */ }
}

onMounted(() => {
  if (!container.value) return
  const resize = () => {
    const available = container.value?.getBoundingClientRect().width ?? 0
    if (available > 0) width.value = Math.max(260, Math.min(1200, available))
  }
  resize()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(resize)
    observer.observe(container.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())

const projected = computed(() => projectLearningStars(
  props.stars,
  { raDeg: props.centerRaDeg, decDeg: props.centerDecDeg },
  width.value,
  height.value,
  props.variant,
  60,
))
const renderedStars = computed(() => projected.value.map((star, index) => ({
  ...star,
  light: learningStarAppearance(star.magnitude, star.colorIndex ?? null, renderMode.value),
  coreId: `${lightProfileId}-core-${index}`,
  haloId: `${lightProfileId}-halo-${index}`,
})))
const lineSegments = computed(() => {
  const points = new Map(projected.value.map((star) => [star.id, star]))
  return props.paths.flatMap((path) => path.slice(1).flatMap((id, index) => {
    const from = points.get(path[index])
    const to = points.get(id)
    return from && to ? [{ from, to, id: `${path[index]}-${id}-${index}` }] : []
  }))
})
const labelIdSet = computed(() => props.labelIds === undefined ? null : new Set(props.labelIds))

function isLabelVisible(id: string): boolean {
  return props.showLabels && (labelIdSet.value === null || labelIdSet.value.has(id))
}

interface LabelBox { left: number; top: number; right: number; bottom: number }
const labels = computed(() => {
  // Names are not rendered or computed into accessibility labels in recall mode.
  if (!props.showLabels) return []
  const occupied: LabelBox[] = []
  return projected.value.filter(star => isLabelVisible(star.id)).sort((a, b) => a.magnitude - b.magnitude).map((star) => {
    const labelWidth = Array.from(star.name).reduce((total, char) => total + (/[\u0000-\u007f]/.test(char) ? 7 : 13), 0)
    const candidates = [
      [star.x + 18, star.y - 18], [star.x - labelWidth - 18, star.y - 18],
      [star.x + 18, star.y + 8], [star.x - labelWidth - 18, star.y + 8],
      [star.x - labelWidth / 2, star.y - 34], [star.x - labelWidth / 2, star.y + 24],
    ].map(([left, top]) => {
      left = Math.max(8, Math.min(width.value - labelWidth - 8, left))
      top = Math.max(8, Math.min(height.value - 24, top))
      const box = { left, top, right: left + labelWidth, bottom: top + 18 }
      const labelCollisions = occupied.filter((other) => box.left < other.right + 5 && box.right > other.left - 5
        && box.top < other.bottom + 3 && box.bottom > other.top - 3).length
      const starCollisions = projected.value.filter((point) => point.x > box.left - 10 && point.x < box.right + 10
        && point.y > box.top - 10 && point.y < box.bottom + 10).length
      return { box, score: labelCollisions * 2 + starCollisions }
    }).sort((a, b) => a.score - b.score)
    const box = candidates[0].box
    occupied.push(box)
    return { id: star.id, name: star.name, x: box.left, y: box.top + 13 }
  })
})

function select(id: string) {
  if (!props.disabled) emit('select', id)
}

function selectNearest(event: MouseEvent) {
  if (props.disabled) return
  // Assistive technology can activate an SVG button without pointer coordinates.
  if (event.detail === 0 && event.target instanceof Element) {
    const button = event.target.closest('[data-star-id]')
    const id = button?.getAttribute('data-star-id')
    if (id) { select(id); return }
  }
  const svg = event.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const x = (event.clientX - rect.left) * width.value / rect.width
  const y = (event.clientY - rect.top) * height.value / rect.height
  // Resolve the actual nearest star, irrespective of SVG paint order. Large
  // tap targets otherwise make a close pair's earlier member impossible to hit.
  let closest: { id: string; distance: number } | undefined
  for (const star of projected.value) {
    const distance = Math.hypot(star.x - x, star.y - y)
    if (distance <= hitRadius && (!closest || distance < closest.distance)) closest = { id: star.id, distance }
  }
  if (closest) select(closest.id)
}

function accessibleLabel(star: LearningChartStar, index: number): string {
  const base = isLabelVisible(star.id) ? star.name : `星点 ${index + 1}`
  return star.id === props.highlightId ? `${base}，待辨认的目标` : base
}
</script>

<template>
  <figure ref="container" class="learning-chart" :class="{ 'is-clear': renderMode === 'clear', 'is-interactive': !disabled }">
    <div class="learning-chart__toolbar">
      <div class="learning-chart__heading">
        <span class="learning-chart__mode-label">星区观察窗</span>
        <span class="learning-chart__mode-caption">{{ disabled ? '观察星形与明暗关系' : '点击星点，找回记忆' }}</span>
      </div>
      <div class="learning-chart__modes" role="group" aria-label="星图显示模式">
        <button type="button" class="learning-chart__natural-mode" :aria-pressed="renderMode === 'natural'" @click="setRenderMode('natural')">自然星空</button>
        <button type="button" class="learning-chart__clear-mode" :aria-pressed="renderMode === 'clear'" @click="setRenderMode('clear')">清晰认星</button>
      </div>
    </div>
    <div class="learning-chart__canvas">
      <svg
        class="learning-chart__svg"
        :viewBox="`0 0 ${width} ${height}`"
        role="group"
        :aria-label="disabled ? '学习星图，观察星点之间的位置与明暗关系' : '交互学习星图，可用 Tab 选择星点，按回车或空格确认'"
        :aria-describedby="instructionsId"
        @click="selectNearest"
      >
        <defs>
          <template v-for="star in renderedStars" :key="star.id">
            <radialGradient v-if="renderMode === 'natural'" :id="star.coreId">
              <stop offset="0" :stop-color="star.light.coreColor" />
              <stop offset=".17" :stop-color="star.light.coreColor" stop-opacity=".88" />
              <stop offset=".33" :stop-color="star.light.coreColor" stop-opacity=".61" />
              <stop offset=".5" :stop-color="star.light.coreColor" stop-opacity=".32" />
              <stop offset=".67" :stop-color="star.light.coreColor" stop-opacity=".13" />
              <stop offset=".83" :stop-color="star.light.coreColor" stop-opacity=".045" />
              <stop offset="1" :stop-color="star.light.coreColor" stop-opacity="0" />
            </radialGradient>
            <radialGradient v-if="star.light.haloOpacity > 0" :id="star.haloId">
              <stop offset="0" :stop-color="star.light.haloColor" />
              <stop offset=".25" :stop-color="star.light.haloColor" stop-opacity=".4" />
              <stop offset=".6" :stop-color="star.light.haloColor" stop-opacity=".08" />
              <stop offset="1" :stop-color="star.light.haloColor" stop-opacity="0" />
            </radialGradient>
          </template>
        </defs>
        <g v-if="showLines" class="learning-chart__lines" aria-hidden="true">
          <line
            v-for="(segment, index) in lineSegments" :key="`${segment.id}-${index}`"
            :x1="segment.from.x" :y1="segment.from.y" :x2="segment.to.x" :y2="segment.to.y"
          />
        </g>
        <g
          v-for="(star, index) in renderedStars" :key="star.id"
          class="learning-chart__star"
          :class="{ 'is-highlighted': star.id === highlightId, 'is-selected': star.id === selectedId }"
          :transform="`translate(${star.x}, ${star.y})`"
          role="button"
          :tabindex="disabled ? -1 : 0"
          :aria-label="accessibleLabel(star, index)"
          :aria-pressed="star.id === selectedId"
          :aria-disabled="disabled"
          :data-star-id="star.id"
          @keydown.enter.prevent="select(star.id)"
          @keydown.space.prevent="select(star.id)"
        >
          <circle class="learning-chart__hit" :r="hitRadius" />
          <circle class="learning-chart__focus" r="19" aria-hidden="true" />
          <circle v-if="star.id === highlightId" class="learning-chart__target" r="14" aria-hidden="true" />
          <circle v-if="star.id === selectedId" class="learning-chart__selected" r="10" aria-hidden="true" />
          <circle v-if="star.light.haloOpacity > 0" class="learning-chart__light"
            :r="star.light.haloRadius" :fill="`url(#${star.haloId})`" :opacity="star.light.haloOpacity" aria-hidden="true" />
          <circle class="learning-chart__light learning-chart__core"
            :r="star.light.coreRadius" :fill="renderMode === 'natural' ? `url(#${star.coreId})` : star.light.coreColor" :opacity="star.light.coreOpacity" aria-hidden="true" />
        </g>
        <g v-if="showLabels" class="learning-chart__labels" aria-hidden="true">
          <text v-for="label in labels" :key="label.id" :x="label.x" :y="label.y">{{ label.name }}</text>
        </g>
        <text v-if="projected.length === 0" :x="width / 2" :y="height / 2" class="learning-chart__empty" text-anchor="middle">暂无可绘制星点</text>
      </svg>
      <div class="learning-chart__canvas-meta" aria-hidden="true">
        <span class="learning-chart__badge"><i />{{ showLabels ? '星名辅助已开启' : '星名辅助已隐藏' }}</span>
        <span class="learning-chart__line-status">{{ showLines ? '连线开启' : '无连线' }}</span>
      </div>
      <div v-if="highlightId || selectedId" class="learning-chart__legend" aria-hidden="true">
        <span v-if="highlightId"><i class="learning-chart__legend-target" />标记目标</span>
        <span v-if="selectedId"><i class="learning-chart__legend-selected" />你的选择</span>
      </div>
    </div>
    <figcaption>
      <span class="learning-chart__mode-note">{{ renderMode === 'natural' ? '自然星空 · 模拟肉眼观感，星点细小、亮暗分明' : '清晰认星 · 星点放大增亮，方便辨认与记忆' }}</span>
      <span :id="instructionsId" class="learning-chart__instructions">
        <template v-if="!disabled"><kbd>Tab</kbd> 切换星点 <span aria-hidden="true">·</span> <kbd>Enter</kbd> 确认</template>
        <template v-else>视角变化用于认形，不代表此刻的地平线。</template>
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.learning-chart { margin: 0; min-width: 0; padding: 18px; border: 1px solid var(--color-border); border-radius: 22px; background: color-mix(in srgb, var(--color-surface) 88%, transparent); box-shadow: 0 14px 40px color-mix(in srgb, var(--color-shadow) 65%, transparent); }
.learning-chart__toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.learning-chart__heading { display: grid; gap: 5px; }
.learning-chart__mode-label { color: var(--color-text); font-size: 13px; font-weight: 550; letter-spacing: .06em; }
.learning-chart__mode-caption { color: var(--color-text-subtle); font-size: 11px; }
.learning-chart__modes { display: inline-flex; gap: 3px; padding: 4px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-bg); }
.learning-chart__modes button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid transparent; border-radius: 8px; padding: 8px 12px; min-height: 40px; color: var(--color-text-muted); background: transparent; font: inherit; font-size: 12px; cursor: pointer; transition: color .18s, background .18s, border-color .18s; }
.learning-chart__modes button::before { width: 7px; height: 7px; border-radius: 50%; background: currentColor; content: ''; opacity: .65; }
.learning-chart__modes .learning-chart__natural-mode::before { background: transparent; box-shadow: inset -2px -1px 0 1px currentColor; }
.learning-chart__modes button[aria-pressed='true'] { border-color: color-mix(in srgb, var(--color-gold) 25%, transparent); background: color-mix(in srgb, var(--color-gold) 10%, var(--color-surface)); color: var(--color-gold); }
.learning-chart__modes button:hover { color: var(--color-text); background: var(--color-surface-raised); }
.learning-chart__modes button:focus-visible { outline: 2px solid var(--color-blue); outline-offset: 2px; }
.learning-chart__canvas { position: relative; overflow: hidden; border: 1px solid #29384c; border-radius: 15px; background: #06090f; box-shadow: inset 0 0 65px #0005; }
.learning-chart.is-clear .learning-chart__canvas { background: radial-gradient(ellipse at 45% 42%, #15263c 0%, #0b1526 58%, #080f1c 100%); }
.learning-chart__svg { display: block; width: 100%; height: auto; }
.learning-chart__canvas-meta { position: absolute; inset: 17px 18px auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; pointer-events: none; color: #8998ad; font-size: 10px; letter-spacing: .04em; }
.learning-chart__badge { display: inline-flex; align-items: center; gap: 7px; }
.learning-chart__badge i { width: 4px; height: 4px; background: #8eabc7; border-radius: 50%; }
.learning-chart__line-status { color: #7c8da4; }
.learning-chart__legend { position: absolute; bottom: 15px; left: 18px; display: flex; gap: 16px; pointer-events: none; color: #b4c0d1; font-size: 10px; }
.learning-chart__legend > span { display: flex; align-items: center; gap: 6px; }
.learning-chart__legend i { width: 10px; height: 10px; border-radius: 50%; }
.learning-chart__legend-target { border: 1px dashed #f1cc86; }
.learning-chart__legend-selected { border: 1px solid #8dc9ff; }
.learning-chart__lines { stroke: #7e95ae; stroke-width: .8; opacity: .3; pointer-events: none; }
.learning-chart.is-clear .learning-chart__lines { stroke-width: 1.1; opacity: .5; }
.learning-chart__star { cursor: pointer; outline: none; }
.learning-chart__star[aria-disabled='true'] { cursor: default; }
.learning-chart__hit { fill: transparent; }
.learning-chart__light { pointer-events: none; }
.learning-chart__focus { fill: #e9c58206; stroke: #e9c582; stroke-width: 1.4; opacity: 0; pointer-events: none; transition: opacity .12s; }
.learning-chart__star:focus-visible .learning-chart__focus,
.learning-chart__star:not([aria-disabled='true']):hover .learning-chart__focus { opacity: 1; }
.learning-chart__target { fill: none; stroke: #f1cc86; stroke-width: 1.8; stroke-dasharray: 4 3; pointer-events: none; }
.learning-chart__selected { fill: none; stroke: #8dc9ff; stroke-width: 2; pointer-events: none; }
.learning-chart__labels { fill: #b4c0d1; font-size: 13px; font-weight: 400; paint-order: stroke; stroke: #06090f; stroke-width: 4px; stroke-linejoin: round; pointer-events: none; }
.learning-chart.is-clear .learning-chart__labels { fill: #e2e9f6; stroke: #0b1526; }
.learning-chart__empty { fill: #a6b8d1; font-size: 14px; }
.learning-chart figcaption { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; margin: 13px 2px 0; color: var(--color-text-subtle); font-size: 10px; line-height: 1.8; }
.learning-chart__instructions { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 5px; }
.learning-chart kbd { padding: 0 4px; border: 1px solid var(--color-border); border-radius: 4px; color: var(--color-text-muted); font: inherit; font-family: var(--font-mono); font-size: 9px; line-height: 1.8; }
@media (pointer: coarse) { .learning-chart__modes button { min-height: 44px; } }
@media (max-width: 600px) {
  .learning-chart { padding: 12px; border-radius: 17px; }
  .learning-chart__toolbar { gap: 10px; margin-bottom: 12px; }
  .learning-chart__mode-caption { display: none; }
  .learning-chart__modes button { padding-inline: 10px; font-size: 11px; }
  .learning-chart__canvas { border-radius: 11px; }
  .learning-chart__canvas-meta { inset: 14px 14px auto; font-size: 9px; }
  .learning-chart__legend { left: 14px; bottom: 12px; }
  .learning-chart figcaption { gap: 6px; }
}
@media (max-width: 390px) {
  .learning-chart__toolbar { align-items: stretch; }
  .learning-chart__heading { align-self: center; }
  .learning-chart__modes { width: 100%; }
  .learning-chart__modes button { flex: 1; }
  .learning-chart__mode-caption { display: inline; }
  .learning-chart__heading { display: flex; justify-content: space-between; gap: 8px; width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .learning-chart__modes button, .learning-chart__focus { transition: none; } }
</style>
