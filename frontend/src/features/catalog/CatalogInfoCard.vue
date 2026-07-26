<script setup lang="ts">
import { BookOpen, ExternalLink, GripHorizontal, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { renderRestrictedMarkdown } from './markdown'
import type { CatalogEntry, CatalogObjectType } from './types'

const props = defineProps<{
  entry: CatalogEntry | null
  objectType: CatalogObjectType
  objectKey: string
  objectName: string
  facts: Array<{ label: string; value: string }>
  loading: boolean
  error: boolean
}>()

defineEmits<{ close: [] }>()

const { t } = useI18n()
const renderedBody = computed(() => props.entry ? renderRestrictedMarkdown(props.entry.bodyMarkdown) : '')
const card = ref<HTMLElement | null>(null)
const position = reactive({ x: 12, y: 12 })
const positioned = ref(false)
const dragging = ref(false)
const mobileDrawer = ref(false)
let resizeObserver: ResizeObserver | null = null
let mobileLayoutQuery: MediaQueryList | null = null
let dragSession: {
  pointerId: number
  clientX: number
  clientY: number
  startX: number
  startY: number
} | null = null

const cardStyle = computed<CSSProperties>(() => ({
  transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
  visibility: positioned.value ? 'visible' : 'hidden',
}))

onMounted(() => {
  mobileLayoutQuery = window.matchMedia('(max-width: 720px)')
  mobileDrawer.value = mobileLayoutQuery.matches
  mobileLayoutQuery.addEventListener('change', updateMobileLayout)
  void nextTick(() => {
    resetPosition()
    const element = card.value
    if (!element?.parentElement) return
    resizeObserver = new ResizeObserver(() => clampPosition(position.x, position.y))
    resizeObserver.observe(element)
    resizeObserver.observe(element.parentElement)
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  mobileLayoutQuery?.removeEventListener('change', updateMobileLayout)
})

function updateMobileLayout(event: MediaQueryListEvent): void {
  mobileDrawer.value = event.matches
  if (!event.matches) void nextTick(resetPosition)
}

function resetPosition(): void {
  const element = card.value
  const parent = element?.parentElement
  if (!element || !parent) return
  const margin = 12
  position.x = Math.max(margin, parent.clientWidth - element.offsetWidth - margin)
  position.y = Math.min(58, Math.max(margin, parent.clientHeight - element.offsetHeight - margin))
  positioned.value = true
}

function clampPosition(x: number, y: number): void {
  const element = card.value
  const parent = element?.parentElement
  if (!element || !parent || isMobileDrawer()) return
  const margin = 12
  const maximumX = Math.max(margin, parent.clientWidth - element.offsetWidth - margin)
  const maximumY = Math.max(margin, parent.clientHeight - element.offsetHeight - margin)
  position.x = Math.min(maximumX, Math.max(margin, x))
  position.y = Math.min(maximumY, Math.max(margin, y))
  positioned.value = true
}

function startDrag(event: PointerEvent): void {
  if (event.button !== 0 || isMobileDrawer()) return
  const handle = event.currentTarget as HTMLElement
  dragSession = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    startX: position.x,
    startY: position.y,
  }
  dragging.value = true
  handle.setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent): void {
  if (!dragSession || dragSession.pointerId !== event.pointerId) return
  clampPosition(
    dragSession.startX + event.clientX - dragSession.clientX,
    dragSession.startY + event.clientY - dragSession.clientY,
  )
}

function finishDrag(event: PointerEvent): void {
  if (!dragSession || dragSession.pointerId !== event.pointerId) return
  const handle = event.currentTarget as HTMLElement
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
  dragSession = null
  dragging.value = false
}

function moveWithKeyboard(event: KeyboardEvent): void {
  if (isMobileDrawer()) return
  const step = event.shiftKey ? 32 : 12
  const movement = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }[event.key]
  if (!movement) return
  event.preventDefault()
  clampPosition(position.x + movement[0], position.y + movement[1])
}

function isMobileDrawer(): boolean {
  return mobileLayoutQuery?.matches ?? window.matchMedia('(max-width: 720px)').matches
}
</script>

<template>
  <aside
    ref="card"
    class="catalog-info-card"
    :class="{ dragging }"
    :style="cardStyle"
    role="complementary"
    aria-labelledby="catalog-card-title"
  >
    <header
      class="card-header"
      :tabindex="mobileDrawer ? -1 : 0"
      :aria-label="mobileDrawer ? undefined : t('catalog.dragCard')"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="finishDrag"
      @pointercancel="finishDrag"
      @keydown="moveWithKeyboard"
    >
      <GripHorizontal class="drag-handle" :size="17" aria-hidden="true" />
      <div>
        <p>{{ t(`catalog.types.${objectType}`) }}</p>
        <h2 id="catalog-card-title">{{ entry?.title || objectName }}</h2>
      </div>
      <button type="button" class="icon-button" :aria-label="t('catalog.close')" :title="t('catalog.close')" @pointerdown.stop @click="$emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </header>

    <div class="card-scroll">
      <dl class="live-facts">
        <div v-for="fact in facts" :key="fact.label">
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        </div>
      </dl>

      <div v-if="loading" class="content-state" role="status">
        <span class="loading-dot" aria-hidden="true"></span>{{ t('catalog.loading') }}
      </div>
      <div v-else-if="error" class="content-state error" role="alert">{{ t('catalog.loadFailed') }}</div>
      <template v-else-if="entry">
        <figure v-if="entry.media[0]" class="catalog-media">
          <img :src="entry.media[0].url" :alt="entry.media[0].altText">
          <figcaption v-if="entry.media[0].caption || entry.media[0].attribution">
            {{ entry.media[0].caption || entry.media[0].attribution }}
          </figcaption>
        </figure>
        <p class="catalog-summary">{{ entry.summary }}</p>
        <div class="catalog-markdown" v-html="renderedBody"></div>
        <ul v-if="entry.knowledgePoints.length" class="knowledge-points">
          <li v-for="point in entry.knowledgePoints" :key="point">{{ point }}</li>
        </ul>
        <section v-if="entry.sources.length" class="source-list">
          <h3>{{ t('catalog.sources') }}</h3>
          <a v-for="source in entry.sources" :key="source.url" :href="source.url" target="_blank" rel="noreferrer">
            {{ source.title }}<ExternalLink :size="12" aria-hidden="true" />
          </a>
        </section>
      </template>
      <div v-else class="content-state empty">
        <BookOpen :size="21" aria-hidden="true" />
        <strong>{{ t('catalog.preparing') }}</strong>
        <span>{{ t('catalog.preparingDetail') }}</span>
      </div>
    </div>

    <RouterLink
      v-if="entry"
      class="full-entry-link"
      :to="{ name: 'catalog-detail', params: { objectType, objectKey } }"
    >{{ t('catalog.openFull') }}<ExternalLink :size="15" aria-hidden="true" /></RouterLink>
  </aside>
</template>

<style scoped>
.catalog-info-card {
  position: absolute;
  z-index: 8;
  top: 0;
  left: 0;
  width: min(380px, calc(100% - 24px));
  height: min(620px, calc(100% - 70px));
  min-height: min(360px, calc(100% - 24px));
  display: flex;
  flex-direction: column;
  border: 1px solid #34515a;
  background: rgba(8, 17, 21, .97);
  box-shadow: 0 18px 44px rgba(0, 0, 0, .42);
  color: #eaf2f1;
  will-change: transform;
}
.catalog-info-card.dragging { box-shadow: 0 22px 54px rgba(0, 0, 0, .55); }
.card-header { display: grid; grid-template-columns: 18px minmax(0, 1fr) 34px; align-items: start; gap: 10px; padding: 13px 13px 12px; border-bottom: 1px solid #243b41; cursor: grab; touch-action: none; user-select: none; }
.card-header:focus-visible { outline: 2px solid #72c9bd; outline-offset: -2px; }
.dragging .card-header { cursor: grabbing; }
.drag-handle { margin-top: 3px; color: #607c81; }
.card-header p { margin: 0 0 4px; color: #72c9bd; font-size: 11px; text-transform: uppercase; }
.card-header h2 { margin: 0; overflow-wrap: anywhere; font-size: 20px; line-height: 1.2; }
.icon-button { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #31494f; border-radius: 4px; color: #b9caca; background: transparent; cursor: pointer; }
.card-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 16px; }
.live-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 0 0 18px; background: #263a3e; }
.live-facts div { min-width: 0; padding: 10px; background: #0d181c; }
.live-facts dt { color: #789093; font-size: 11px; }
.live-facts dd { margin: 4px 0 0; overflow: hidden; color: #d8e5e4; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.catalog-media { margin: 0 0 14px; }
.catalog-media img { display: block; width: 100%; max-height: 190px; object-fit: cover; }
.catalog-media figcaption { margin-top: 6px; color: #73898c; font-size: 11px; }
.catalog-summary { margin: 0 0 14px; color: #cedbda; font-size: 14px; line-height: 1.65; }
.catalog-markdown { color: #9fb2b3; font-size: 13px; line-height: 1.7; }
.catalog-markdown :deep(p) { margin: 0 0 12px; }
.catalog-markdown :deep(a) { color: #81d3c8; text-decoration: underline; }
.knowledge-points { display: grid; gap: 8px; margin: 16px 0; padding-left: 18px; color: #c5d4d2; font-size: 13px; line-height: 1.5; }
.source-list { margin-top: 18px; padding-top: 14px; border-top: 1px solid #263b40; }
.source-list h3 { margin: 0 0 8px; color: #809699; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.source-list a { display: flex; align-items: center; gap: 5px; margin: 6px 0; color: #77c9c0; font-size: 12px; }
.content-state { display: flex; align-items: center; gap: 8px; min-height: 100px; justify-content: center; color: #8ba1a4; font-size: 13px; }
.content-state.empty { flex-direction: column; text-align: center; }
.content-state.empty span { max-width: 260px; line-height: 1.5; }
.content-state.error { color: #e3a68d; }
.loading-dot { width: 8px; height: 8px; border-radius: 50%; background: #72c9bd; animation: pulse 1s ease-in-out infinite alternate; }
.full-entry-link { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 46px; border-top: 1px solid #2b4449; color: #8edbd1; font-size: 13px; }
@keyframes pulse { to { opacity: .35; } }
@media (max-width: 720px) {
  .catalog-info-card { top: auto; right: 0; bottom: 0; left: 0; width: 100%; height: auto; min-height: 0; max-height: min(72dvh, 560px); transform: none !important; visibility: visible !important; border-right: 0; border-bottom: 0; border-left: 0; will-change: auto; }
  .card-header { grid-template-columns: minmax(0, 1fr) 34px; cursor: default; touch-action: pan-y; }
  .drag-handle { display: none; }
}
</style>
