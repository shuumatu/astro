<script setup lang="ts">
import { Pause, Play, RotateCcw, SkipBack, SkipForward, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { advanceGuide, type DemoGuideDefinition, type GuidePosition } from '../guide'

const props = defineProps<{ guide: DemoGuideDefinition }>()
const emit = defineEmits<{
  seek: [cueId: string, progress: number]
  exit: []
}>()
const { t } = useI18n()
const position = ref<GuidePosition>({ index: 0, elapsedMs: 0, finished: false })
const playing = ref(typeof window.matchMedia !== 'function'
  || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
const step = computed(() => props.guide.steps[position.value.index]!)
const fraction = computed(() => Math.min(1, position.value.elapsedMs / Math.max(1, step.value.durationMs)))
let frameId = 0
let lastFrame: number | null = null

watch(position, () => emit('seek', step.value.id, fraction.value), { immediate: true })

function frame(timestamp: number): void {
  if (playing.value && !document.hidden && !position.value.finished) {
    if (lastFrame !== null) position.value = advanceGuide(props.guide.steps, position.value, Math.min(80, timestamp - lastFrame))
    if (position.value.finished) playing.value = false
    lastFrame = timestamp
  } else {
    lastFrame = null
  }
  frameId = requestAnimationFrame(frame)
}

function jump(index: number): void {
  if (index < 0 || index >= props.guide.steps.length) return
  position.value = { index, elapsedMs: 0, finished: false }
  lastFrame = null
}

function togglePlayback(): void {
  if (position.value.finished) jump(0)
  playing.value = !playing.value
  lastFrame = null
}

onMounted(() => { frameId = requestAnimationFrame(frame) })
onBeforeUnmount(() => cancelAnimationFrame(frameId))
</script>

<template>
  <div class="guide-overlay" :aria-label="t(guide.titleKey)">
    <div class="guide-header">
      <span class="guide-heading">{{ t(guide.titleKey) }} <span>{{ position.index + 1 }} / {{ guide.steps.length }}</span></span>
      <button type="button" class="guide-icon" :aria-label="t('demos.guide.exit')" :title="t('demos.guide.exit')" @click="emit('exit')">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>

    <div class="guide-bottom">
      <p class="guide-subtitle" aria-live="polite">{{ t(step.subtitleKey) }}</p>
      <div class="guide-timeline" role="group" :aria-label="t('demos.guide.chapters')">
        <button
          v-for="(item, index) in guide.steps"
          :key="item.id"
          type="button"
          class="guide-segment"
          :class="{ current: index === position.index }"
          :aria-label="`${index + 1}. ${t(item.subtitleKey)}`"
          :aria-current="index === position.index ? 'step' : undefined"
          @click="jump(index)"
        ><span :style="{ width: `${index < position.index ? 100 : index === position.index ? fraction * 100 : 0}%` }" /></button>
      </div>
      <div class="guide-controls">
        <button type="button" class="guide-icon" :disabled="position.index === 0" :aria-label="t('demos.guide.previous')" :title="t('demos.guide.previous')" @click="jump(position.index - 1)">
          <SkipBack :size="18" aria-hidden="true" />
        </button>
        <button type="button" class="guide-play" :aria-label="t(position.finished ? 'demos.guide.replay' : playing ? 'demos.guide.pause' : 'demos.guide.play')" :title="t(position.finished ? 'demos.guide.replay' : playing ? 'demos.guide.pause' : 'demos.guide.play')" @click="togglePlayback">
          <RotateCcw v-if="position.finished" :size="19" aria-hidden="true" />
          <Pause v-else-if="playing" :size="19" aria-hidden="true" />
          <Play v-else :size="19" aria-hidden="true" />
        </button>
        <button type="button" class="guide-icon" :disabled="position.index === guide.steps.length - 1" :aria-label="t('demos.guide.next')" :title="t('demos.guide.next')" @click="jump(position.index + 1)">
          <SkipForward :size="18" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guide-overlay { position: absolute; z-index: 6; inset: 0; pointer-events: none; color: var(--color-text); }
.guide-header {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  right: clamp(14px, 2vw, 24px);
  display: flex;
  align-items: center;
  gap: .8rem;
  padding: .3rem .35rem .3rem .75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  pointer-events: auto;
}
.guide-heading { font-size: .8rem; font-weight: 600; white-space: nowrap; }
.guide-heading span { margin-left: .45rem; color: var(--color-text-muted); font-variant-numeric: tabular-nums; font-weight: 400; }
.guide-bottom {
  position: absolute;
  inset: auto 0 0;
  display: grid;
  justify-items: center;
  gap: .65rem;
  padding: 1.15rem max(18px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom));
  background: linear-gradient(transparent, color-mix(in srgb, var(--color-surface) 96%, transparent) 24%, var(--color-surface));
  pointer-events: auto;
}
.guide-subtitle {
  min-height: 3em;
  max-width: 720px;
  margin: 0;
  font-size: .96rem;
  line-height: 1.5;
  text-align: center;
  text-wrap: balance;
}
.guide-timeline { display: flex; gap: 5px; width: min(520px, 90vw); }
.guide-segment { flex: 1; height: 8px; padding: 0; border: 0; border-radius: 2px; background: var(--color-border); cursor: pointer; overflow: hidden; }
.guide-segment span { display: block; height: 100%; background: var(--color-blue); }
.guide-segment:focus-visible, .guide-icon:focus-visible, .guide-play:focus-visible { outline: 2px solid var(--color-text); outline-offset: 3px; }
.guide-controls { display: flex; align-items: center; gap: .7rem; }
.guide-icon, .guide-play {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text);
  background: var(--color-surface-raised);
  cursor: pointer;
}
.guide-play { width: 42px; height: 42px; color: var(--color-on-accent); background: var(--color-blue); border-color: var(--color-blue); }
.guide-icon:hover, .guide-play:hover { border-color: var(--color-gold); }
.guide-icon:disabled { opacity: .35; cursor: default; }
@media (max-width: 640px) {
  .guide-subtitle { min-height: 4.4em; font-size: .85rem; }
  .guide-bottom { gap: .45rem; padding-top: .8rem; }
  .guide-header { right: 12px; }
}
</style>
