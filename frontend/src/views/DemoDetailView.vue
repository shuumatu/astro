<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import DemoTopBar from '../features/demos/components/DemoTopBar.vue'
import DemoTransportBar from '../features/demos/components/DemoTransportBar.vue'
import { findDemo, type DemoControlId } from '../features/demos/registry'
import {
  DEFAULT_DEMO_SETTINGS,
  type DemoHotspot,
  type DemoLabelAnchor,
  type DemoPhase,
  type DemoRadiant,
  type DemoReadout,
  type DemoScene,
  type DemoSceneSettings,
} from '../features/demos/types'

/**
 * The shared shell every interactive demo runs in. It owns the stage, the overlay chrome and
 * the demo-independent plumbing (labels, fullscreen, keyboard, visibility) and is driven
 * entirely by the demo's entry in `registry.ts`, so adding a demo does not touch this file.
 */
const { t, locale } = useI18n()
const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))
const demo = computed(() => findDemo(slug.value))
const stageElement = ref<HTMLDivElement | null>(null)
const scene = shallowRef<DemoScene | null>(null)
const settings = ref<DemoSceneSettings>({ ...DEFAULT_DEMO_SETTINGS })
const phase = ref<DemoPhase>('orbit')
const radiant = ref<DemoRadiant>({ altitudeDeg: 18 })
const hotspot = ref<DemoHotspot | null>(null)
const readout = ref<DemoReadout | null>(null)
const unsupported = ref(false)
const sceneLoading = ref(true)
const isFullscreen = ref(false)
const fullscreenSupported = ref(false)
const surfaceComponent = shallowRef<Component | null>(null)
const panelComponent = shallowRef<Component | null>(null)

const controls = computed<DemoControlId[]>(() => demo.value?.controls ?? ['orbits', 'labels'])
const actions = computed(() => demo.value?.actions ?? [])
const features = computed(() => demo.value?.features ?? [])
const speedUnitKey = computed(() => demo.value?.speedUnitKey ?? 'demos.controls.speedValue')
const speedRange = computed(() => demo.value?.speedRange ?? { min: 0.05, max: 1.2, step: 0.05 })
const transport = computed(() => demo.value?.transport !== false)
const brightnessRange = computed(() => demo.value?.brightnessRange ?? null)
const lighting = computed(() => demo.value?.lighting ?? null)
const hintKey = computed(() => demo.value?.hintKey ?? 'demos.controls.hint')
const cinematicKey = computed(() => demo.value?.cinematicKey === undefined
  ? 'demos.cinematic.entering'
  : demo.value.cinematicKey)

/**
 * Labels arrive every frame from the scene. Their set is stable (a scene publishes all of its
 * labels, visible or not), so the template only creates nodes when a new id shows up and the
 * per-frame work stays an imperative style write rather than a re-render.
 */
const labelEntries = ref<{ id: string, textKey: string }[]>([])
const labelElements = new Map<string, HTMLElement>()
const labelWidths = new Map<string, number>()
let disposed = false
let loading = false

function collectLabelElements(): void {
  labelElements.clear()
  labelWidths.clear()
  const root = stageElement.value
  if (!root) return
  for (const element of root.querySelectorAll<HTMLElement>('[data-demo-label]')) {
    const id = element.dataset.demoLabel
    if (!id) continue
    labelElements.set(id, element)
    labelWidths.set(id, element.offsetWidth)
  }
}

function positionLabels(anchors: DemoLabelAnchor[]): void {
  const width = stageElement.value?.clientWidth ?? 0
  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]))
  for (const [id, element] of labelElements) {
    const anchor = byId.get(id)
    if (!anchor || !anchor.visible) {
      element.style.opacity = '0'
      continue
    }
    // Keep the whole label inside the stage: a label anchored near an edge would otherwise
    // have half of its text clipped away.
    const half = (labelWidths.get(id) ?? 0) / 2
    const margin = 6
    const x = width > half * 2 + margin * 2
      ? Math.min(width - half - margin, Math.max(half + margin, anchor.x))
      : anchor.x
    element.style.opacity = '1'
    element.style.transform = `translate3d(${x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0) translate(-50%, -150%)`
  }
}

function handleLabels(anchors: DemoLabelAnchor[]): void {
  const known = new Set(labelEntries.value.map((entry) => entry.id))
  const additions = anchors
    .filter((anchor) => !known.has(anchor.id))
    .map((anchor) => ({ id: anchor.id, textKey: anchor.textKey ?? `demos.scene.${anchor.id}` }))
  if (additions.length > 0) {
    labelEntries.value = [...labelEntries.value, ...additions]
    void nextTick(() => {
      collectLabelElements()
      positionLabels(anchors)
    })
    return
  }
  positionLabels(anchors)
}

async function loadOverlays(): Promise<void> {
  const definition = demo.value
  if (!definition) return
  surfaceComponent.value = null
  panelComponent.value = null
  if (definition.surfaceOverlay) {
    const module = await definition.surfaceOverlay()
    if (!disposed) surfaceComponent.value = module.default
  }
  if (definition.panel) {
    const module = await definition.panel()
    if (!disposed) panelComponent.value = module.default
  }
}

async function mountScene(): Promise<void> {
  const definition = demo.value
  const container = stageElement.value
  if (!definition || !container || loading) return
  loading = true
  try {
    const module = await definition.loadScene()
    if (disposed) return
    labelEntries.value = []
    labelElements.clear()
    labelWidths.clear()
    const created = module.createScene(container, {
      onLabels: handleLabels,
      onPhaseChange: (next) => {
        phase.value = next
      },
      onRadiantResolved: (resolved) => {
        radiant.value = resolved
      },
      onHotspot: (next) => {
        hotspot.value = next
      },
      onReadout: (next) => {
        readout.value = next
      },
    })
    scene.value = created
    created.applySettings({ ...settings.value })
    container.querySelector('canvas')?.setAttribute('aria-label', t('demos.canvasAria'))
    unsupported.value = false
  } catch (error) {
    console.error('Failed to start the demo scene', error)
    unsupported.value = true
  } finally {
    loading = false
    sceneLoading.value = false
  }
}

function unmountScene(): void {
  scene.value?.dispose()
  scene.value = null
  phase.value = 'orbit'
  hotspot.value = null
  readout.value = null
  labelEntries.value = []
  labelElements.clear()
  labelWidths.clear()
}

function leaveSurface(): void {
  scene.value?.leaveSurfaceView?.()
}

function selectFeature(id: string): void {
  scene.value?.focusHotspot?.(id)
}

/** The overlays only belong to the free-look phase; a scripted move plays without chrome. */
const overlaysVisible = computed(() => phase.value === 'orbit')

const selectedFeature = computed(() =>
  hotspot.value ? features.value.find((feature) => feature.id === hotspot.value?.id) ?? null : null)

const readoutText = computed(() => {
  const value = readout.value
  if (!value) return ''
  const params: Record<string, string | number> = { ...value.params }
  if (value.timestampMs !== undefined) {
    params.date = new Intl.DateTimeFormat(locale.value, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value.timestampMs))
  }
  return t(value.key, params)
})

function handleFullscreenChange(): void {
  isFullscreen.value = document.fullscreenElement === stageElement.value
}

async function toggleFullscreen(): Promise<void> {
  const element = stageElement.value
  if (!element || !fullscreenSupported.value) return
  if (document.fullscreenElement === element) {
    await document.exitFullscreen()
    return
  }
  await element.requestFullscreen()
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) return
  if (event.key === 'Escape' && phase.value === 'surface') {
    leaveSurface()
    return
  }
  if (phase.value !== 'orbit') return
  if (event.code === 'Space') {
    event.preventDefault()
    settings.value.playing = !settings.value.playing
  } else if (transport.value && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault()
    const range = speedRange.value
    const step = event.key === 'ArrowRight' ? range.step : -range.step
    const next = settings.value.timeScale + step
    settings.value.timeScale = Math.min(range.max, Math.max(range.min, Number(next.toFixed(3))))
  } else if (event.key === 'r' || event.key === 'R') {
    scene.value?.resetView()
  } else if (event.key === 'f' || event.key === 'F') {
    void toggleFullscreen()
  }
}

/** Rendering a full-viewport scene behind a hidden tab is pure waste. */
function handleVisibilityChange(): void {
  scene.value?.setSuspended?.(document.hidden)
}

onMounted(() => {
  fullscreenSupported.value = document.fullscreenEnabled
    && typeof HTMLElement.prototype.requestFullscreen === 'function'
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  void loadOverlays()
  void mountScene()
})

onBeforeUnmount(() => {
  disposed = true
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  unmountScene()
})

watch(settings, (value) => {
  scene.value?.applySettings({ ...value })
}, { deep: true })

watch(demo, (definition) => {
  settings.value = { ...DEFAULT_DEMO_SETTINGS, ...(definition?.defaultSettings ?? {}) }
}, { immediate: true })

watch(slug, async () => {
  unmountScene()
  unsupported.value = false
  disposed = false
  void loadOverlays()
  await mountScene()
})

watch(locale, async () => {
  await nextTick()
  collectLabelElements()
})
</script>

<template>
  <section class="demo-page">
    <div v-if="demo" ref="stageElement" class="demo-stage">
      <div class="demo-label-layer" aria-hidden="true">
        <span
          v-for="entry in labelEntries"
          :key="entry.id"
          class="demo-label"
          :data-demo-label="entry.id"
        >{{ t(entry.textKey) }}</span>
      </div>

      <component
        v-if="surfaceComponent"
        :is="surfaceComponent"
        :active="phase === 'surface'"
        :radiant-altitude-deg="radiant.altitudeDeg"
        @exit="leaveSurface"
      />

      <component
        v-if="panelComponent && features.length > 0"
        :is="panelComponent"
        class="overlay-hidden-aware"
        :class="{ 'stage-hidden': !overlaysVisible }"
        :title-key="demo.panelTitleKey ?? ''"
        :items="features"
        :selected="hotspot?.id ?? null"
        @select="selectFeature"
      />

      <aside
        v-if="hotspot && selectedFeature"
        class="hotspot-card"
        :class="{ 'stage-hidden': !overlaysVisible }"
      >
        <p class="hotspot-category">{{ t(selectedFeature.categoryKey) }}</p>
        <h2>{{ t(selectedFeature.titleKey) }}</h2>
        <p v-if="hotspot.facts.length" class="hotspot-facts">
          <span v-for="fact in hotspot.facts" :key="fact">{{ fact }}</span>
        </p>
        <p class="hotspot-body">{{ t(`demos.items.${demo.slug}.hotspots.${hotspot.id}.body`) }}</p>
        <button type="button" class="demo-button" @click="scene?.clearFocus?.()">
          {{ t('demos.card.back') }}
        </button>
      </aside>

      <p v-if="unsupported" class="demo-fallback">{{ t('demos.unsupported') }}</p>
      <p v-else-if="sceneLoading" class="demo-loading" role="status">{{ t('demos.loading') }}</p>
    </div>

    <template v-if="demo">
      <DemoTopBar
        class="overlay top"
        :class="{ 'overlay-hidden': !overlaysVisible }"
        :title="t(demo.titleKey)"
        :summary="t(demo.summaryKey)"
        :controls="controls"
        :show-orbits="settings.showOrbits"
        :show-labels="settings.showLabels"
        :show-grid="settings.showGrid ?? false"
        :actions="actions"
        :brightness-range="brightnessRange"
        :brightness="settings.brightness ?? 1"
        :lighting="lighting"
        :light-azimuth="settings.lightAzimuthDeg ?? 315"
        :light-elevation="settings.lightElevationDeg ?? 28"
        :full-bright="settings.fullBright ?? false"
        :fullscreen="isFullscreen"
        :fullscreen-supported="fullscreenSupported"
        @toggle="(id, value) => {
          if (id === 'orbits') settings.showOrbits = value
          else if (id === 'labels') settings.showLabels = value
          else settings.showGrid = value
        }"
        @action="(id) => scene?.runAction?.(id)"
        @update:brightness="(value) => { settings.brightness = value }"
        @update:light-azimuth="(value) => { settings.lightAzimuthDeg = value }"
        @update:light-elevation="(value) => { settings.lightElevationDeg = value }"
        @update:full-bright="(value) => { settings.fullBright = value }"
        @reset="scene?.resetView()"
        @toggle-fullscreen="toggleFullscreen"
      />

      <div class="overlay bottom-left" :class="{ 'overlay-hidden': !overlaysVisible }">
        <p class="demo-hint">{{ t(hintKey) }}</p>
        <p v-if="readoutText" class="demo-readout">{{ readoutText }}</p>
      </div>

      <p
        v-if="demo.creditKey"
        class="demo-credit overlay"
        :class="{ 'overlay-hidden': !overlaysVisible }"
      >{{ t(demo.creditKey) }}</p>

      <p
        v-if="cinematicKey"
        class="demo-stage-message overlay"
        :class="{ 'overlay-hidden': phase !== 'cinematic' }"
        role="status"
      >
        {{ t(cinematicKey) }}
      </p>

      <div v-if="transport" class="overlay bottom" :class="{ 'overlay-hidden': !overlaysVisible }">
        <DemoTransportBar
          v-model:playing="settings.playing"
          v-model:time-scale="settings.timeScale"
          :unit-key="speedUnitKey"
          :min="speedRange.min"
          :max="speedRange.max"
          :step="speedRange.step"
          @reset="scene?.resetView()"
        />
      </div>
    </template>

    <p v-else class="demo-missing">{{ t('demos.notFoundHint') }}</p>
  </section>
</template>

<style scoped>
.demo-missing { padding: 3rem 0; color: #aabbd0; }

.demo-page {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.demo-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #03060d;
}

.demo-stage:fullscreen { width: 100vw; height: 100vh; }

/* Overlays float above the canvas: the containers never swallow pointer events, only the
   controls inside them do. */
.overlay {
  position: absolute;
  z-index: 4;
  transition: opacity .45s ease;
}

.overlay-hidden { opacity: 0; pointer-events: none; }

.stage-hidden { opacity: 0; pointer-events: none; transition: opacity .45s ease; }

.overlay.top { inset: max(12px, env(safe-area-inset-top)) clamp(12px, 2vw, 22px) auto; }
.overlay.bottom { inset: auto 0 clamp(14px, 2.4vh, 26px); display: flex; justify-content: center; pointer-events: none; }
.overlay.bottom > * { pointer-events: auto; }

.overlay.bottom-left {
  inset: auto auto clamp(14px, 2.4vh, 26px) clamp(12px, 2vw, 22px);
  max-width: 260px;
  pointer-events: none;
}

.demo-hint {
  margin: 0;
  color: #8fa4bd;
  font-size: .78rem;
  line-height: 1.5;
  text-shadow: 0 1px 6px rgb(0 0 0 / 85%);
}

.demo-readout {
  margin: .3rem 0 0;
  color: #b9c9dd;
  font-size: .74rem;
  letter-spacing: .02em;
  text-shadow: 0 1px 6px rgb(0 0 0 / 85%);
}

.demo-credit {
  /* Sits above the transport bar rather than behind it. */
  inset: auto clamp(12px, 2vw, 22px) clamp(64px, 9vh, 88px) auto;
  max-width: min(420px, 40vw);
  margin: 0;
  color: #6d86a3;
  font-size: .64rem;
  line-height: 1.45;
  text-align: right;
  text-shadow: 0 1px 6px rgb(0 0 0 / 85%);
  pointer-events: none;
}

.demo-stage-message {
  inset: auto 0 auto;
  top: 12%;
  margin: 0;
  color: #d8e4f4;
  font-size: .92rem;
  letter-spacing: .08em;
  text-align: center;
  text-shadow: 0 1px 8px rgb(0 0 0 / 90%);
  pointer-events: none;
}

.demo-label-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.demo-label {
  position: absolute;
  top: 0;
  left: 0;
  padding: .05rem .35rem;
  border-radius: 3px;
  color: #eaf2ff;
  font-size: .85rem;
  letter-spacing: .06em;
  white-space: nowrap;
  text-shadow: 0 1px 6px rgb(0 0 0 / 90%);
  opacity: 0;
  will-change: transform;
}

.hotspot-card {
  position: absolute;
  z-index: 5;
  left: clamp(12px, 2vw, 22px);
  bottom: clamp(96px, 17vh, 156px);
  width: min(320px, 74vw);
  padding: .85rem .9rem .95rem;
  border: 1px solid rgb(60 84 110 / 65%);
  border-radius: 8px;
  background: rgb(6 14 26 / 86%);
  backdrop-filter: blur(8px);
  transition: opacity .3s ease;
}

.hotspot-category {
  margin: 0 0 .2rem;
  color: #72d4d8;
  font-size: .68rem;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.hotspot-card h2 { margin: 0; color: #eaf2ff; font-size: 1.05rem; }

.hotspot-facts {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin: .35rem 0 .5rem;
  color: #9fb4cf;
  font-size: .76rem;
  letter-spacing: .03em;
}

.hotspot-body { margin: 0 0 .7rem; color: #b9c9dd; font-size: .84rem; line-height: 1.6; }

.demo-fallback {
  position: absolute;
  inset: 50% 1rem auto;
  transform: translateY(-50%);
  margin: 0;
  color: #ffb4a2;
  font-size: .9rem;
  text-align: center;
}

.demo-loading {
  position: absolute;
  inset: 50% 1rem auto;
  transform: translateY(-50%);
  margin: 0;
  color: #9fb4cf;
  font-size: .9rem;
  letter-spacing: .08em;
  text-align: center;
}

.demo-button {
  min-height: 38px;
  padding: 0 .9rem;
  border: 1px solid #35516e;
  border-radius: 4px;
  color: #c8d6e7;
  background: transparent;
  cursor: pointer;
}

.demo-button:hover { color: #07111f; background: #72d4d8; border-color: #72d4d8; }

@media (max-width: 900px) {
  .overlay.bottom { inset: auto 0 max(12px, env(safe-area-inset-bottom)); }
  .overlay.bottom-left { display: none; }
  .demo-credit { display: none; }
  .hotspot-card { bottom: 74px; }
}
</style>
