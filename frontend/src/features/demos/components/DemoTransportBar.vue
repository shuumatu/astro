<script setup lang="ts">
import { Pause, Play, RotateCcw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const playing = defineModel<boolean>('playing', { required: true })
const timeScale = defineModel<number>('timeScale', { required: true })

const props = withDefaults(defineProps<{
  /** Locale key for the unit readout beside the slider, e.g. years or days per second. */
  unitKey?: string
  min?: number
  max?: number
  step?: number
}>(), {
  unitKey: 'demos.controls.speedValue',
  min: 0.05,
  max: 1.2,
  step: 0.05,
})

const emit = defineEmits<{ reset: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="transport" role="group" :aria-label="t('demos.controls.playback')">
    <button
      type="button"
      class="transport-button play"
      :aria-label="playing ? t('demos.controls.pause') : t('demos.controls.play')"
      :title="playing ? t('demos.controls.pause') : t('demos.controls.play')"
      @click="playing = !playing"
    >
      <Pause v-if="playing" :size="17" aria-hidden="true" />
      <Play v-else :size="17" aria-hidden="true" />
    </button>

    <label class="transport-speed">
      <span class="transport-label">{{ t('demos.controls.speed') }}</span>
      <input
        v-model.number="timeScale"
        type="range"
        :min="props.min"
        :max="props.max"
        :step="props.step"
        :aria-label="t('demos.controls.speed')"
      >
      <output class="transport-value">
        {{ t(props.unitKey, { value: timeScale.toFixed(2) }) }}
      </output>
    </label>

    <button
      type="button"
      class="transport-button"
      :aria-label="t('demos.controls.resetView')"
      :title="t('demos.controls.resetView')"
      @click="emit('reset')"
    >
      <RotateCcw :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.transport {
  display: flex;
  align-items: center;
  gap: .9rem;
  padding: .5rem .7rem;
  border: 1px solid rgb(60 84 110 / 70%);
  border-radius: 999px;
  background: rgb(7 15 26 / 82%);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 26px rgb(0 0 0 / 45%);
}

.transport-button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: none;
  border: 0;
  border-radius: 50%;
  color: #d6e4f2;
  background: transparent;
  cursor: pointer;
}

.transport-button:hover { color: #07111f; background: #72d4d8; }
.transport-button.play { color: #07111f; background: #72d4d8; }
.transport-button.play:hover { background: #8ee2e6; }

.transport-speed {
  display: flex;
  align-items: center;
  gap: .55rem;
  min-width: 0;
}

.transport-label { color: #9fb4cf; font-size: .78rem; white-space: nowrap; }
.transport-speed input { width: clamp(90px, 16vw, 170px); accent-color: #72d4d8; }
.transport-value {
  min-width: 78px;
  color: #eaf2ff;
  font-size: .78rem;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .transport { gap: .5rem; padding: .4rem .55rem; }
  .transport-label { display: none; }
  .transport-value { min-width: 0; }
}
</style>
