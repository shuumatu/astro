<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import DemoTopBar from '../features/demos/components/DemoTopBar.vue'
import DemoTransportBar from '../features/demos/components/DemoTransportBar.vue'
import MeteorSurfaceView from '../features/demos/components/MeteorSurfaceView.vue'
import { findDemo } from '../features/demos/registry'
import {
  DEFAULT_DEMO_SETTINGS,
  type DemoLabelAnchor,
  type DemoPhase,
  type DemoRadiant,
  type DemoScene,
  type DemoSceneSettings,
} from '../features/demos/types'

const { t, locale } = useI18n()
const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))
const demo = computed(() => findDemo(slug.value))
const stageElement = ref<HTMLDivElement | null>(null)
const scene = shallowRef<DemoScene | null>(null)
const settings = ref<DemoSceneSettings>({ ...DEFAULT_DEMO_SETTINGS })
const phase = ref<DemoPhase>('orbit')
const radiant = ref<DemoRadiant>({ altitudeDeg: 18 })
const unsupported = ref(false)
const sceneLoading = ref(true)
const isFullscreen = ref(false)
const fullscreenSupported = ref(false)
const labelIds = ['sun', 'earth', 'comet', 'dustBand', 'meteorShowerPoint']
const nightSkyUrl = `${import.meta.env.BASE_URL}demos/meteor-shower/night-sky.jpg`
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
    if (id) labelElements.set(id, element)
  }
  for (const [id, element] of labelElements) labelWidths.set(id, element.offsetWidth)
}

function handleLabels(anchors: DemoLabelAnchor[]): void {
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

async function mountScene(): Promise<void> {
  const definition = demo.value
  const container = stageElement.value
  if (!definition || !container || loading) return
  loading = true
  try {
    const module = await definition.loadScene()
    if (disposed) return
    collectLabelElements()
    const created = module.createScene(container, {
      onLabels: handleLabels,
      onPhaseChange: (next) => {
        phase.value = next
      },
      onRadiantResolved: (resolved) => {
        radiant.value = resolved
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
  labelElements.clear()
}

function leaveSurface(): void {
  scene.value?.leaveSurfaceView?.()
}

/** The overlays only belong to the free-look phase; the cinematic plays without chrome. */
const overlaysVisible = computed(() => phase.value === 'orbit')

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
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 0.05 : -0.05
    settings.value.timeScale = Math.min(1.2, Math.max(0.05, Number((settings.value.timeScale + step).toFixed(2))))
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

watch(slug, async () => {
  unmountScene()
  unsupported.value = false
  await mountScene()
})

watch(locale, async () => {
  await nextTick()
  for (const [id, element] of labelElements) labelWidths.set(id, element.offsetWidth)
})
</script>

<template>
  <section class="demo-page">
    <div v-if="demo" ref="stageElement" class="demo-stage">
      <div class="demo-label-layer" :class="{ hidden: phase !== 'orbit' }" aria-hidden="true">
        <span
          v-for="id in labelIds"
          :key="id"
          class="demo-label"
          :data-demo-label="id"
        >{{ t(`demos.scene.${id}`) }}</span>
      </div>

      <div class="demo-surface" :class="{ visible: phase === 'surface' }">
        <MeteorSurfaceView
          :active="phase === 'surface'"
          :image-url="nightSkyUrl"
          :radiant-altitude-deg="radiant.altitudeDeg"
        />
        <div class="demo-surface-bar">
          <p class="demo-surface-caption">{{ t('demos.surface.caption') }}</p>
          <button type="button" class="demo-button" @click="leaveSurface">
            {{ t('demos.surface.exit') }}
          </button>
        </div>
      </div>

      <p v-if="unsupported" class="demo-fallback">{{ t('demos.unsupported') }}</p>
      <p v-else-if="sceneLoading" class="demo-loading" role="status">{{ t('demos.loading') }}</p>
    </div>

    <template v-if="demo">
      <DemoTopBar
        class="overlay top"
        :class="{ 'overlay-hidden': !overlaysVisible }"
        :title="t(demo.titleKey)"
        :summary="t(demo.summaryKey)"
        :show-orbits="settings.showOrbits"
        :show-labels="settings.showLabels"
        :fullscreen="isFullscreen"
        :fullscreen-supported="fullscreenSupported"
        @update:show-orbits="settings.showOrbits = $event"
        @update:show-labels="settings.showLabels = $event"
        @toggle-fullscreen="toggleFullscreen"
      />

      <p class="demo-hint overlay" :class="{ 'overlay-hidden': !overlaysVisible }">
        {{ t('demos.controls.hint') }}
      </p>

      <p class="demo-stage-message overlay" :class="{ 'overlay-hidden': phase !== 'cinematic' }" role="status">
        {{ t('demos.cinematic.entering') }}
      </p>

      <div class="overlay bottom" :class="{ 'overlay-hidden': !overlaysVisible }">
        <DemoTransportBar
          v-model:playing="settings.playing"
          v-model:time-scale="settings.timeScale"
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

.overlay.top { inset: max(12px, env(safe-area-inset-top)) clamp(12px, 2vw, 22px) auto; }
.overlay.bottom { inset: auto 0 clamp(14px, 2.4vh, 26px); display: flex; justify-content: center; pointer-events: none; }
.overlay.bottom > * { pointer-events: auto; }

.demo-hint {
  inset: auto auto clamp(14px, 2.4vh, 26px) clamp(12px, 2vw, 22px);
  max-width: 240px;
  margin: 0;
  color: #8fa4bd;
  font-size: .78rem;
  line-height: 1.5;
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

.demo-label-layer.hidden { opacity: 0; transition: opacity .5s ease; }

.demo-surface {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: #03060d;
  opacity: 0;
  pointer-events: none;
  transition: opacity .5s ease;
}

.demo-surface.visible { opacity: 1; pointer-events: auto; }

/* Dip through black, then bring the ground view up once the 3D scene is hidden. */
.demo-surface :deep(.meteor-surface-canvas) {
  opacity: 0;
  transition: opacity .8s ease .5s;
}

.demo-surface.visible :deep(.meteor-surface-canvas) { opacity: 1; }

.demo-surface-bar {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1rem .8rem;
  background: linear-gradient(transparent, rgb(3 6 13 / 78%));
}

.demo-surface-caption {
  margin: 0;
  color: #d8e4f4;
  font-size: .86rem;
  text-shadow: 0 1px 6px rgb(0 0 0 / 90%);
}

.demo-surface-bar .demo-button {
  min-height: 34px;
  padding: 0 .9rem;
  background: rgb(10 23 40 / 78%);
}

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
  border: 1px solid #35516e;
  border-radius: 4px;
  color: #c8d6e7;
  background: transparent;
  cursor: pointer;
}

.demo-button:hover { color: #07111f; background: #72d4d8; border-color: #72d4d8; }

@media (max-width: 900px) {
  .demo-hint { display: none; }
  .overlay.bottom { inset: auto 0 max(12px, env(safe-area-inset-bottom)); }
}
</style>
