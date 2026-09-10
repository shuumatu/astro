<script setup lang="ts">
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

defineProps<{
  title: string
  summary: string
  showOrbits: boolean
  showLabels: boolean
  fullscreen: boolean
  fullscreenSupported: boolean
}>()

const emit = defineEmits<{
  'update:showOrbits': [value: boolean]
  'update:showLabels': [value: boolean]
  toggleFullscreen: []
}>()

const expanded = ref(false)
const { t } = useI18n()
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

    <div class="display-controls">
      <label class="chip">
        <input
          type="checkbox"
          :checked="showOrbits"
          @change="emit('update:showOrbits', ($event.target as HTMLInputElement).checked)"
        >
        <span>{{ t('demos.controls.orbits') }}</span>
      </label>
      <label class="chip">
        <input
          type="checkbox"
          :checked="showLabels"
          @change="emit('update:showLabels', ($event.target as HTMLInputElement).checked)"
        >
        <span>{{ t('demos.controls.labels') }}</span>
      </label>
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
.display-controls { pointer-events: auto; }

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

.display-controls { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; justify-content: flex-end; }

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

@media (max-width: 640px) {
  .info-card { max-width: 62vw; }
  .info-title { font-size: .88rem; }
  .chip { padding: 0 .45rem; font-size: .74rem; }
}
</style>
