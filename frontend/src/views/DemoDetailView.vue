<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import DemoTopBar from '../features/demos/components/DemoTopBar.vue'
import DemoTransportBar from '../features/demos/components/DemoTransportBar.vue'
import DemoGuideOverlay from '../features/demos/components/DemoGuideOverlay.vue'
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
  type DemoSceneState,
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
const panoramaComponent = shallowRef<Component | null>(null)
const panelComponent = shallowRef<Component | null>(null)
/**
 * A demo's own control surface, when it ships one. The shell holds the scene's published state and
 * forwards the panel's commands, but never reads either: see `DemoDefinition.controlPanel`.
 */
const controlPanelComponent = shallowRef<Component | null>(null)
const sceneState = shallowRef<DemoSceneState>({})
/**
 * Whether the panorama viewer is open. It is the viewer's own state rather than a scene phase:
 * the scene keeps its focus on the feature, and closing the panorama returns to it unchanged.
 */
const panoramaOpen = ref(false)
const guideActive = ref(false)

const controls = computed<DemoControlId[]>(() => demo.value?.controls ?? ['orbits', 'labels'])
const actions = computed(() => demo.value?.actions ?? [])
const features = computed(() => demo.value?.features ?? [])
const speedUnitKey = computed(() => demo.value?.speedUnitKey ?? 'demos.controls.speedValue')
const speedRange = computed(() => demo.value?.speedRange ?? { min: 0.05, max: 1.2, step: 0.05 })
const transport = computed(() => demo.value?.transport !== false)
const brightnessRange = computed(() => demo.value?.brightnessRange ?? null)
const sunLongitudeRange = computed(() => demo.value?.sunLongitudeRange ?? null)
const hintKey = computed(() => demo.value?.hintKey ?? 'demos.controls.hint')
const cinematicKey = computed(() => demo.value?.cinematicKey === undefined
  ? 'demos.cinematic.entering'
  : demo.value.cinematicKey)

/**
 * Labels arrive every frame from the scene. Their set is stable (a scene publishes all of its
 * labels, visible or not), so the template only creates nodes when a new id shows up and the
 * per-frame work stays an imperative style write rather than a re-render.
 */
const labelEntries = ref<{ id: string, textKey: string, descriptionKey?: string }[]>([])
const labelElements = new Map<string, HTMLElement>()
const labelWidths = new Map<string, number>()
let disposed = false
let loading = false

/**
 * The label the pointer is over, with the explanation to show for it.
 *
 * Hit-tested against the label elements rather than handled by hovering the labels themselves. The
 * label layer has to stay `pointer-events: none` or dragging over a caption would stop rotating the
 * scene, and a caption is not worth breaking the camera for. The test is a handful of rectangles per
 * pointer move, and it only runs for labels that actually carry an explanation.
 */
const hoveredLabel = ref<{
  id: string
  textKey: string
  descriptionKey: string
  x: number
  y: number
  above: boolean
} | null>(null)

/**
 * Finds the label under a viewport point and publishes its explanation.
 *
 * Separate from the event handlers because two of them want it: moving the pointer, and releasing it.
 */
function revealLabelAt(clientX: number, clientY: number): void {
  const root = stageElement.value
  if (!root) return
  const bounds = root.getBoundingClientRect()
  for (const entry of labelEntries.value) {
    if (!entry.descriptionKey) continue
    const element = labelElements.get(entry.id)
    if (!element || element.style.opacity === '0') continue
    const rect = element.getBoundingClientRect()
    if (
      clientX < rect.left || clientX > rect.right
      || clientY < rect.top || clientY > rect.bottom
    ) continue
    // Above the label by default, below it when there is not room - a tooltip that runs off the top
    // of the stage is worse than one on the wrong side of its label.
    const above = rect.top - bounds.top > 150
    // The tooltip is wider than the label and centred on it, so a label near an edge would have half
    // its explanation clipped away. The width mirrors the stylesheet's `min(300px, 74vw)`.
    const half = Math.min(300, window.innerWidth * 0.74) / 2 + 8
    const centred = rect.left - bounds.left + rect.width / 2
    hoveredLabel.value = {
      id: entry.id,
      textKey: entry.textKey,
      descriptionKey: entry.descriptionKey,
      x: bounds.width > half * 2
        ? Math.min(bounds.width - half, Math.max(half, centred))
        : bounds.width / 2,
      y: (above ? rect.top : rect.bottom) - bounds.top,
      above,
    }
    return
  }
  hoveredLabel.value = null
}

/**
 * Pointing at a label explains it - but not while the camera is being dragged.
 *
 * A held button means the viewer is rotating the scene, and rotating sweeps the pointer across every
 * label on the way, so without this the explanations would flash past for the whole gesture. Touch
 * is covered by the same test, because a finger on the glass reports a held button too. Releasing
 * runs the same hit test, so a tap or a click on a label still reveals it and stays put.
 */
function handleStagePointerMove(event: PointerEvent): void {
  if (guideActive.value || event.buttons !== 0
    || (event.target !== stageElement.value && !(event.target instanceof HTMLCanvasElement))) {
    hoveredLabel.value = null
    return
  }
  revealLabelAt(event.clientX, event.clientY)
}

function handleStagePointerUp(event: PointerEvent): void {
  if (guideActive.value || (event.target !== stageElement.value
    && !(event.target instanceof HTMLCanvasElement))) {
    hoveredLabel.value = null
    return
  }
  revealLabelAt(event.clientX, event.clientY)
}

function clearHoveredLabel(): void {
  hoveredLabel.value = null
}

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
      if (hoveredLabel.value?.id === id) hoveredLabel.value = null
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
    .map((anchor) => ({
      id: anchor.id,
      textKey: anchor.textKey ?? `demos.scene.${anchor.id}`,
      descriptionKey: anchor.descriptionKey,
    }))
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
  panoramaComponent.value = null
  panelComponent.value = null
  controlPanelComponent.value = null
  if (definition.surfaceOverlay) {
    const module = await definition.surfaceOverlay()
    if (!disposed) surfaceComponent.value = module.default
  }
  if (definition.panoramaOverlay) {
    const module = await definition.panoramaOverlay()
    if (!disposed) panoramaComponent.value = module.default
  }
  if (definition.panel) {
    const module = await definition.panel()
    if (!disposed) panelComponent.value = module.default
  }
  if (definition.controlPanel) {
    const module = await definition.controlPanel()
    if (!disposed) controlPanelComponent.value = module.default
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
    hoveredLabel.value = null
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
      // A scene can resolve settings the registry could not know - the Moon's Sun position comes from
      // today's date - so the controls adopt what it actually used rather than their placeholders.
      onSettingsResolved: (resolved) => {
        settings.value = { ...settings.value, ...resolved }
      },
      onState: (next) => {
        sceneState.value = next
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
  stopGuide()
  scene.value?.dispose()
  scene.value = null
  phase.value = 'orbit'
  hotspot.value = null
  readout.value = null
  panoramaOpen.value = false
  sceneState.value = {}
  labelEntries.value = []
  labelElements.clear()
  labelWidths.clear()
  hoveredLabel.value = null
}

function leaveSurface(): void {
  scene.value?.leaveSurfaceView?.()
}

/** The viewer keeps rendering behind the panorama, so it is paused rather than torn down. */
function suspendScene(suspended: boolean): void {
  scene.value?.setSuspended?.(suspended)
}

function openPanorama(): void {
  panoramaOpen.value = true
}

function closePanorama(): void {
  panoramaOpen.value = false
}

function selectFeature(id: string): void {
  scene.value?.focusHotspot?.(id)
}

/** Carries one command from a demo's own control panel to its scene. */
function sendCommand(command: unknown): void {
  scene.value?.runCommand?.(command)
}

function startGuide(): void {
  if (!demo.value?.guide?.steps.length || !scene.value?.beginGuide
    || !scene.value.seekGuide || !scene.value.endGuide || guideActive.value) return
  scene.value.beginGuide()
  guideActive.value = true
  hoveredLabel.value = null
}

function stopGuide(): void {
  if (!guideActive.value) return
  guideActive.value = false
  scene.value?.endGuide?.()
}

const guideAvailable = computed(() => Boolean(demo.value?.guide?.steps.length
  && scene.value?.beginGuide && scene.value.seekGuide && scene.value.endGuide))

/**
 * The overlays only belong to the free-look phase; a scripted move plays without chrome. The
 * panorama viewer covers the stage, so the chrome goes with it rather than floating on top of a
 * photograph.
 */
const overlaysVisible = computed(() => phase.value === 'orbit' && !panoramaOpen.value && !guideActive.value)

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
  if (guideActive.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      stopGuide()
    }
    return
  }
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) return
  if (panoramaOpen.value) {
    // The viewer owns the arrow keys and Escape while it is open.
    if (event.key === 'Escape') closePanorama()
    return
  }
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

watch(() => hoveredLabel.value?.id ?? null, (id) => {
  scene.value?.highlightLabel?.(id)
}, { flush: 'sync' })
</script>

<template>
  <section class="demo-page">
    <div
      v-if="demo"
      ref="stageElement"
      class="demo-stage"
      @pointermove="handleStagePointerMove"
      @pointerup="handleStagePointerUp"
      @pointerleave="clearHoveredLabel"
    >
      <div class="demo-label-layer" aria-hidden="true">
        <span
          v-for="entry in labelEntries"
          :key="entry.id"
          class="demo-label"
          :class="{ highlighted: hoveredLabel?.id === entry.id }"
          :data-demo-label="entry.id"
        >{{ t(entry.textKey) }}</span>
      </div>

      <div
        v-if="hoveredLabel"
        class="demo-label-tip"
        :class="{ 'tip-below': !hoveredLabel.above }"
        :style="{ left: `${hoveredLabel.x}px`, top: `${hoveredLabel.y}px` }"
        role="tooltip"
      >
        <p class="demo-label-tip-title">{{ t(hoveredLabel.textKey) }}</p>
        <p class="demo-label-tip-body">{{ t(hoveredLabel.descriptionKey) }}</p>
      </div>

      <component
        v-if="surfaceComponent"
        :is="surfaceComponent"
        :active="phase === 'surface'"
        :radiant-altitude-deg="radiant.altitudeDeg"
        @exit="leaveSurface"
      />

      <component
        v-if="panoramaComponent"
        :is="panoramaComponent"
        :active="panoramaOpen"
        :hotspot="hotspot"
        :suspend-scene="suspendScene"
        @exit="closePanorama"
      />

      <component
        v-if="panelComponent && features.length > 0"
        :is="panelComponent"
        :class="{ 'stage-hidden': !overlaysVisible }"
        :title-key="demo.panelTitleKey ?? ''"
        :items="features"
        :selected="hotspot?.id ?? null"
        @select="selectFeature"
      />

      <!-- The demo's own control surface. It covers the stage when it needs to, so it sits above
           the feature panel and below the hotspot card. -->
      <component
        v-if="controlPanelComponent"
        :is="controlPanelComponent"
        :class="{ 'stage-hidden': !overlaysVisible && !guideActive }"
        :state="sceneState"
        :send="sendCommand"
        :guided="guideActive"
      />

      <DemoGuideOverlay
        v-if="guideActive && demo.guide"
        :guide="demo.guide"
        @seek="(id, progress) => scene?.seekGuide?.(id, progress)"
        @exit="stopGuide"
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
        <div v-if="demo.panoramaButtonKey" class="hotspot-panoramas">
          <button
            v-if="hotspot.panoramas && hotspot.panoramas.length > 0"
            type="button"
            class="panorama-button"
            @click="openPanorama"
          >
            <!-- A wide-angle frame, the conventional glyph for a panorama view. -->
            <svg class="panorama-button-icon" viewBox="0 0 20 14" aria-hidden="true">
              <rect x="1" y="2.5" width="18" height="9" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.5" />
              <path d="M1 5.1h18" fill="none" stroke="currentColor" stroke-width="0.9" opacity="0.55" />
            </svg>
            <span class="panorama-button-label">{{ t(demo.panoramaButtonKey) }}</span>
            <!-- How many views the place has, kept short so the button stays a button and does not
                 turn into a sentence. -->
            <span v-if="hotspot.panoramas.length > 1" class="panorama-button-count">
              {{ hotspot.panoramas.length }}
            </span>
          </button>
          <p v-else-if="demo.panoramaNoneKey" class="hotspot-note">{{ t(demo.panoramaNoneKey) }}</p>
        </div>
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
        :sun-longitude-range="sunLongitudeRange"
        :sun-longitude="settings.sunLongitudeDeg ?? 0"
        :full-bright="settings.fullBright ?? false"
        :fullscreen="isFullscreen"
        :fullscreen-supported="fullscreenSupported"
        :guide-available="guideAvailable"
        @toggle="(id, value) => {
          if (id === 'orbits') settings.showOrbits = value
          else if (id === 'labels') settings.showLabels = value
          else settings.showGrid = value
        }"
        @action="(id) => scene?.runAction?.(id)"
        @update:brightness="(value) => { settings.brightness = value }"
        @update:sun-longitude="(value) => { settings.sunLongitudeDeg = value }"
        @update:full-bright="(value) => { settings.fullBright = value }"
        @reset="scene?.resetView()"
        @toggle-fullscreen="toggleFullscreen"
        @start-guide="startGuide"
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

/* The explanation a label shows when the pointer is over it. Informational only, so it never takes
   pointer events: the hit test lives on the stage and the camera keeps working underneath. */
.demo-label-tip {
  position: absolute;
  z-index: 5;
  width: min(300px, 74vw);
  padding: .5rem .62rem .55rem;
  border: 1px solid #2b4661;
  border-radius: 6px;
  background: rgb(7 17 31 / 96%);
  box-shadow: 0 10px 28px rgb(0 0 0 / 58%);
  transform: translate(-50%, calc(-100% - 10px));
  pointer-events: none;
}

.demo-label-tip.tip-below { transform: translate(-50%, 10px); }

.demo-label-tip-title {
  margin: 0 0 .22rem;
  color: #72d4d8;
  font-size: .74rem;
  font-weight: 600;
  letter-spacing: .04em;
}

.demo-label-tip-body {
  margin: 0;
  color: #b9cade;
  font-size: .72rem;
  line-height: 1.52;
}

.demo-label {
  position: absolute;
  top: 0;
  left: 0;
  padding: .08rem .38rem;
  border: 1px solid rgb(83 112 145 / 30%);
  border-radius: 3px;
  color: #eaf2ff;
  font-size: .85rem;
  letter-spacing: .06em;
  background: rgb(4 11 21 / 68%);
  box-shadow: 0 2px 8px rgb(0 0 0 / 32%);
  white-space: nowrap;
  text-shadow: 0 1px 6px rgb(0 0 0 / 90%);
  opacity: 0;
  will-change: transform;
}

.demo-label.highlighted {
  border-color: #8fe3e6;
  color: #f4ffff;
  background: rgb(17 57 68 / 94%);
  box-shadow: 0 0 0 2px rgb(114 212 216 / 20%), 0 0 16px rgb(114 212 216 / 45%);
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

.hotspot-panoramas { margin: 0 0 .5rem; }

/**
 * The way into the panorama viewer, from the feature card.
 *
 * Sized to its content rather than stretched across the card: a full-width bar for a two-word
 * action read as a banner and dominated the card. It stays the strongest control here by being
 * filled rather than outlined, so it still outranks the plain "back to the overview" button below
 * it without taking the whole width to say so.
 */
.panorama-button {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  max-width: 100%;
  min-height: 36px;
  padding: 0 .75rem;
  border: 1px solid #72d4d8;
  border-radius: 5px;
  color: #07111f;
  font-size: .82rem;
  font-weight: 600;
  letter-spacing: .02em;
  white-space: nowrap;
  background: #72d4d8;
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease;
}

.panorama-button:hover { background: #9ae7ea; border-color: #9ae7ea; }

.panorama-button:focus-visible { outline: 2px solid #eaf2ff; outline-offset: 2px; }

.panorama-button-icon { flex: none; width: 17px; height: 12px; }

.panorama-button-label { overflow: hidden; text-overflow: ellipsis; }

.panorama-button-count {
  flex: none;
  display: grid;
  place-items: center;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 .26rem;
  border-radius: 999px;
  font-size: .66rem;
  font-weight: 700;
  color: #d8f6f7;
  background: rgb(7 17 31 / 72%);
}

.hotspot-note { margin: 0; color: #6d86a3; font-size: .74rem; line-height: 1.5; }

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
