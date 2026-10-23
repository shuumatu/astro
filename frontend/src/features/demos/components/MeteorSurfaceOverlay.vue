<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MeteorSurfaceView from './MeteorSurfaceView.vue'

/**
 * The meteor shower's ground-level finale. The demo definition points at this component, so
 * the shared demo page no longer has to know about the night-sky photograph or the caption.
 */
defineProps<{
  active: boolean
  radiantAltitudeDeg: number
}>()

const emit = defineEmits<{ exit: [] }>()

const { t } = useI18n()
const nightSkyUrl = `${import.meta.env.BASE_URL}demos/meteor-shower/night-sky.jpg`
</script>

<template>
  <div class="demo-surface" :class="{ visible: active }">
    <MeteorSurfaceView :active="active" :image-url="nightSkyUrl" :radiant-altitude-deg="radiantAltitudeDeg" />
    <div class="demo-surface-bar">
      <p class="demo-surface-caption">{{ t('demos.surface.caption') }}</p>
      <button type="button" class="demo-button" @click="emit('exit')">
        {{ t('demos.surface.exit') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
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
  /* This caption is on the night-sky canvas, independent of the control theme. */
  color: #d8e4f4;
  font-size: .86rem;
  text-shadow: 0 1px 6px rgb(0 0 0 / 90%);
}

.demo-surface-bar .demo-button {
  min-height: 34px;
  padding: 0 .9rem;
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
}

/* Scoped styles do not cross the component boundary, so the button carries its own rules. */
.demo-button {
  min-height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
}

.demo-surface-bar .demo-button:hover { color: var(--color-on-accent); background: var(--color-blue); border-color: var(--color-blue); }
</style>
