<script setup lang="ts">
import { ChevronDown, Compass, Maximize2, Minimize2, RotateCcw, Sun, Sunrise } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import {
  CONTROL_LABEL_KEYS,
  type DemoActionDefinition,
  type DemoControlId,
  type DemoLightingDefinition,
} from '../registry'

const props = defineProps<{
  title: string
  summary: string
  /** Which display toggles this demo offers, in the order they should appear. */
  controls: DemoControlId[]
  showOrbits: boolean
  showLabels: boolean
  showGrid: boolean
  /** One-shot buttons such as the lunar phase presets. */
  actions: DemoActionDefinition[]
  /** Brightness slider bounds, or null when the demo has no brightness control. */
  brightnessRange: { min: number; max: number; step: number } | null
  brightness: number
  lighting: DemoLightingDefinition | null
  lightAzimuth: number
  lightElevation: number
  fullBright: boolean
  fullscreen: boolean
  fullscreenSupported: boolean
}>()

const emit = defineEmits<{
  toggle: [id: DemoControlId, value: boolean]
  action: [id: string]
  'update:brightness': [value: number]
  'update:lightAzimuth': [value: number]
  'update:lightElevation': [value: number]
  'update:fullBright': [value: boolean]
  reset: []
  toggleFullscreen: []
}>()

const expanded = ref(false)
const { t } = useI18n()

const chips = computed(() => props.controls.map((id) => ({
  id,
  labelKey: CONTROL_LABEL_KEYS[id],
  checked: id === 'orbits' ? props.showOrbits : id === 'labels' ? props.showLabels : props.showGrid,
})))
</script>

<template>
  <div class="top-bar">
    <div class="info-card" :class="{ expanded }">
      <button
        type="button"
        class="info-toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span class="info-heading">
          <span class="info-kicker">{{ t('demos.kicker') }}</span>
          <span class="info-title">{{ title }}</span>
        </span>
        <ChevronDown class="info-chevron" :size="16" aria-hidden="true" />
      </button>
      <div v-show="expanded" class="info-body">
        <p class="info-summary">{{ summary }}</p>
        <RouterLink class="info-back" to="/demos">{{ t('demos.backToList') }}</RouterLink>
      </div>
    </div>

    <div class="display-stack">
      <div class="display-controls">
        <label v-if="lighting" class="chip slider light-slider" :title="t('demos.controls.lightAzimuth')">
          <Compass :size="14" aria-hidden="true" />
          <input
            type="range"
            :min="lighting.azimuthRange.min"
            :max="lighting.azimuthRange.max"
            :step="lighting.azimuthRange.step"
            :value="lightAzimuth"
            :aria-label="t('demos.controls.lightAzimuth')"
            @input="emit('update:lightAzimuth', Number(($event.target as HTMLInputElement).value))"
          >
          <output class="chip-value angle">{{ Math.round(lightAzimuth) }}°</output>
        </label>
        <label v-if="lighting" class="chip slider light-slider" :title="t('demos.controls.lightElevation')">
          <Sunrise :size="14" aria-hidden="true" />
          <input
            type="range"
            :min="lighting.elevationRange.min"
            :max="lighting.elevationRange.max"
            :step="lighting.elevationRange.step"
            :value="lightElevation"
            :aria-label="t('demos.controls.lightElevation')"
            @input="emit('update:lightElevation', Number(($event.target as HTMLInputElement).value))"
          >
          <output class="chip-value angle">{{ Math.round(lightElevation) }}°</output>
        </label>
        <label v-if="lighting" class="chip" :title="t('demos.controls.fullBright')">
          <input
            type="checkbox"
            :checked="fullBright"
            @change="emit('update:fullBright', ($event.target as HTMLInputElement).checked)"
          >
          <span>{{ t('demos.controls.fullBright') }}</span>
        </label>
        <label v-if="brightnessRange" class="chip slider" :title="t('demos.controls.brightness')">
          <Sun :size="14" aria-hidden="true" />
          <input
            type="range"
            :min="brightnessRange.min"
            :max="brightnessRange.max"
            :step="brightnessRange.step"
            :value="brightness"
            :aria-label="t('demos.controls.brightness')"
            @input="emit('update:brightness', Number(($event.target as HTMLInputElement).value))"
          >
          <output class="chip-value">{{ Math.round(brightness * 100) }}%</output>
        </label>
        <label v-for="chip in chips" :key="chip.id" class="chip">
          <input
            type="checkbox"
            :checked="chip.checked"
            @change="emit('toggle', chip.id, ($event.target as HTMLInputElement).checked)"
          >
          <span>{{ t(chip.labelKey) }}</span>
        </label>
        <button
          type="button"
          class="chip icon"
          :aria-label="t('demos.controls.resetView')"
          :title="t('demos.controls.resetView')"
          @click="emit('reset')"
        >
          <RotateCcw :size="15" aria-hidden="true" />
        </button>
        <button
          v-if="fullscreenSupported"
          type="button"
          class="chip icon"
          :aria-label="t(fullscreen ? 'demos.controls.exitFullscreen' : 'demos.controls.fullscreen')"
          :title="t(fullscreen ? 'demos.controls.exitFullscreen' : 'demos.controls.fullscreen')"
          @click="emit('toggleFullscreen')"
        >
          <Minimize2 v-if="fullscreen" :size="15" aria-hidden="true" />
          <Maximize2 v-else :size="15" aria-hidden="true" />
        </button>
      </div>

      <div v-if="actions.length" class="action-bar" role="group">
        <button
          v-for="action in actions"
          :key="action.id"
          type="button"
          class="chip action"
          @click="emit('action', action.id)"
        >
          {{ t(action.labelKey) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  pointer-events: none;
}

.info-card,
.display-stack { pointer-events: auto; }

.info-card {
  max-width: min(420px, 60vw);
  border: 1px solid rgb(60 84 110 / 65%);
  border-radius: 8px;
  background: rgb(7 15 26 / 78%);
  backdrop-filter: blur(8px);
}

.info-toggle {
  display: flex;
  align-items: center;
  gap: .6rem;
  width: 100%;
  padding: .5rem .7rem;
  border: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.info-heading { display: grid; gap: .15rem; min-width: 0; }
.info-kicker {
  color: #72d4d8;
  font-size: .66rem;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.info-title { color: #eaf2ff; font-size: 1rem; font-weight: 600; line-height: 1.25; }
.info-chevron { flex: none; color: #9fb4cf; transition: transform .2s ease; }
.info-card.expanded .info-chevron { transform: rotate(180deg); }

.info-body {
  padding: 0 .7rem .7rem;
  border-top: 1px solid rgb(60 84 110 / 45%);
}

.info-summary {
  margin: .6rem 0 .5rem;
  color: #b9c9dd;
  font-size: .84rem;
  line-height: 1.55;
}

.info-back { color: #72d4d8; font-size: .82rem; }
.info-back:hover { text-decoration: underline; }

.display-stack {
  display: grid;
  gap: .4rem;
  justify-items: end;
  max-width: min(920px, 78vw);
}

.display-controls { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; justify-content: flex-end; }
.action-bar { display: flex; align-items: center; gap: .3rem; flex-wrap: wrap; justify-content: flex-end; }
.chip.action { padding: 0 .5rem; font-size: .74rem; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  min-height: 30px;
  padding: 0 .6rem;
  border: 1px solid rgb(60 84 110 / 65%);
  border-radius: 999px;
  color: #c8d6e7;
  font-size: .78rem;
  background: rgb(7 15 26 / 78%);
  backdrop-filter: blur(8px);
  cursor: pointer;
}

.chip:hover { color: #eaf2ff; border-color: #72d4d8; }
.chip input { accent-color: #72d4d8; }
.chip.icon { width: 30px; padding: 0; justify-content: center; }
.chip.slider { gap: .4rem; cursor: default; }
.chip.slider input[type='range'] { width: 84px; accent-color: #72d4d8; }
.chip.light-slider input[type='range'] { width: 72px; }
.chip-value { min-width: 34px; color: #9fb4cf; font-size: .72rem; text-align: right; }
.chip-value.angle { min-width: 30px; }

@media (max-width: 640px) {
  .info-card { max-width: 62vw; }
  .info-title { font-size: .88rem; }
  .chip { padding: 0 .45rem; font-size: .74rem; }
  .display-stack { max-width: 52vw; }
}
</style>
