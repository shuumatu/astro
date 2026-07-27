<script setup lang="ts">
import { ChevronDown, ChevronLeft, ChevronRight, Images, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CatalogMedia } from './types'

const props = withDefaults(defineProps<{
  media: CatalogMedia[]
  collapsible?: boolean
  compact?: boolean
}>(), { collapsible: false, compact: false })

const { t } = useI18n({ useScope: 'global' })
const collapsed = ref(false)
const selectedIndex = ref<number | null>(null)
const zoom = ref(1)
const selected = computed(() => selectedIndex.value === null ? null : props.media[selectedIndex.value] ?? null)
const zoomSurfaceStyle = computed(() => ({
  width: `min(${Math.round(1200 * zoom.value)}px, ${Math.round(86 * zoom.value)}vw)`,
}))

function open(index: number): void {
  if (!props.media[index]) return
  selectedIndex.value = index
  zoom.value = 1
  document.addEventListener('keydown', handleKeydown)
}

function close(): void {
  selectedIndex.value = null
  document.removeEventListener('keydown', handleKeydown)
}

function changeImage(offset: number): void {
  if (selectedIndex.value === null || props.media.length < 2) return
  selectedIndex.value = (selectedIndex.value + offset + props.media.length) % props.media.length
  zoom.value = 1
}

function setZoom(next: number): void {
  zoom.value = Math.max(.5, Math.min(4, Math.round(next * 4) / 4))
}

function handleWheel(event: WheelEvent): void {
  setZoom(zoom.value + (event.deltaY < 0 ? .25 : -.25))
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
  else if (event.key === 'ArrowLeft') changeImage(-1)
  else if (event.key === 'ArrowRight') changeImage(1)
  else if (event.key === '+' || event.key === '=') setZoom(zoom.value + .25)
  else if (event.key === '-') setZoom(zoom.value - .25)
}

onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
defineExpose({ open })
</script>

<template>
  <section v-if="media.length" class="media-gallery" :class="{ compact }">
    <button v-if="collapsible" type="button" class="gallery-toggle" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
      <Images :size="15" aria-hidden="true" />
      <span>{{ t('catalog.images') }}</span>
      <small>{{ media.length }}</small>
      <ChevronDown :size="15" :class="{ collapsed }" aria-hidden="true" />
    </button>
    <h2 v-else><Images :size="15" aria-hidden="true" />{{ t('catalog.images') }}<small>{{ media.length }}</small></h2>

    <div v-show="!collapsed" class="thumbnail-grid">
      <button
        v-for="(item, index) in media"
        :id="`catalog-media-${index + 1}`"
        :key="item.mediaId"
        type="button"
        :aria-label="t('catalog.openImage', { number: index + 1 })"
        @click="open(index)"
      >
        <img :src="item.url" :alt="item.altText">
        <span>{{ index + 1 }}</span>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="selected" class="lightbox" role="dialog" aria-modal="true" :aria-label="t('catalog.imageViewer')" @mousedown.self="close">
        <header>
          <span>{{ (selectedIndex ?? 0) + 1 }} / {{ media.length }}</span>
          <div class="zoom-controls">
            <button type="button" :aria-label="t('catalog.zoomOut')" :title="t('catalog.zoomOut')" :disabled="zoom <= .5" @click="setZoom(zoom - .25)"><ZoomOut :size="18" /></button>
            <output>{{ Math.round(zoom * 100) }}%</output>
            <button type="button" :aria-label="t('catalog.zoomIn')" :title="t('catalog.zoomIn')" :disabled="zoom >= 4" @click="setZoom(zoom + .25)"><ZoomIn :size="18" /></button>
            <button type="button" :aria-label="t('catalog.resetZoom')" :title="t('catalog.resetZoom')" @click="setZoom(1)"><RotateCcw :size="17" /></button>
          </div>
          <button type="button" :aria-label="t('catalog.close')" :title="t('catalog.close')" @click="close"><X :size="20" /></button>
        </header>
        <div class="lightbox-stage" @wheel.prevent="handleWheel">
          <button v-if="media.length > 1" type="button" class="previous" :aria-label="t('catalog.previousImage')" @click="changeImage(-1)"><ChevronLeft :size="26" /></button>
          <div class="zoom-surface" :style="zoomSurfaceStyle"><img :src="selected.url" :alt="selected.altText"></div>
          <button v-if="media.length > 1" type="button" class="next" :aria-label="t('catalog.nextImage')" @click="changeImage(1)"><ChevronRight :size="26" /></button>
        </div>
        <footer v-if="selected.caption || selected.attribution">{{ selected.caption || selected.attribution }}</footer>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.media-gallery { min-width: 0; }
h2, .gallery-toggle { display: flex; align-items: center; gap: 7px; width: 100%; margin: 0 0 10px; color: #91a6aa; font-size: 12px; font-weight: 600; text-transform: uppercase; }
h2 small, .gallery-toggle small { margin-left: auto; color: #668085; font: inherit; }
.gallery-toggle { min-height: 34px; border: 0; border-bottom: 1px solid #263b40; padding: 0; background: transparent; cursor: pointer; }
.gallery-toggle svg:last-child { margin-left: 3px; transition: transform .16s ease; }
.gallery-toggle svg:last-child.collapsed { transform: rotate(-90deg); }
.thumbnail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px; }
.thumbnail-grid button { position: relative; overflow: hidden; min-width: 0; aspect-ratio: 1; border: 0; padding: 0; background: #0b1216; cursor: zoom-in; }
.thumbnail-grid img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .16s ease, opacity .16s ease; }
.thumbnail-grid button:hover img { opacity: .82; transform: scale(1.025); }
.thumbnail-grid span { position: absolute; right: 5px; bottom: 5px; display: grid; width: 20px; height: 20px; place-items: center; border: 1px solid rgb(255 255 255 / 30%); border-radius: 50%; color: white; background: rgb(4 10 13 / 72%); font-size: 10px; }
.compact .thumbnail-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.lightbox { position: fixed; z-index: 1000; inset: 0; display: grid; grid-template-rows: 54px minmax(0, 1fr) auto; color: #edf5f4; background: rgb(2 6 8 / 96%); }
.lightbox header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; border-bottom: 1px solid #26383d; padding: 0 18px; }
.lightbox header > span { color: #91a5a8; font-size: 12px; }
.lightbox header > button { justify-self: end; }
.lightbox button { display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid #31484e; border-radius: 4px; color: #d9e5e4; background: #0b1418; cursor: pointer; }
.lightbox button:disabled { opacity: .35; cursor: default; }
.zoom-controls { display: flex; align-items: center; gap: 6px; }
.zoom-controls output { width: 52px; color: #aec0c1; font-size: 12px; text-align: center; }
.lightbox-stage { position: relative; display: grid; overflow: auto; min-height: 0; place-items: center; padding: 24px 60px; }
.zoom-surface { flex: none; transition: width .12s ease; }
.zoom-surface img { display: block; width: 100%; max-height: none; object-fit: contain; }
.lightbox-stage > button { position: fixed; top: 50%; transform: translateY(-50%); }
.lightbox-stage .previous { left: 16px; }
.lightbox-stage .next { right: 16px; }
.lightbox footer { min-height: 42px; padding: 10px 20px 14px; color: #91a5a8; font-size: 12px; text-align: center; }
@media (max-width: 720px) {
  .lightbox header { grid-template-columns: auto 1fr auto; padding: 0 8px; }
  .zoom-controls { justify-self: center; }
  .zoom-controls button:last-child { display: none; }
  .lightbox-stage { padding: 16px 42px; }
  .lightbox-stage .previous { left: 4px; }
  .lightbox-stage .next { right: 4px; }
}
</style>
