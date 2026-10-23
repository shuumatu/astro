<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { BANDS, LAYERS, type RemnantCommand, type RemnantState } from './state'
defineProps<{ state: RemnantState; send: (command: RemnantCommand) => void }>()
const { t } = useI18n()
const key = 'demos.items.supernovaRemnant.'
const folded = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches)
</script>

<template>
  <aside class="remnant-panel" :aria-label="t(key + 'panel')">
    <button class="panel-heading" :aria-expanded="!folded" aria-controls="remnant-controls" @click="folded = !folded">
      <span><small>M1 · NGC 1952</small>{{ t(key + 'panel') }}</span><span aria-hidden="true">{{ folded ? '+' : '−' }}</span>
    </button>
    <div v-show="!folded" id="remnant-controls" class="panel-body">
      <p class="intro">{{ t(key + 'intro') }}</p>
      <h3>{{ t(key + 'bandsTitle') }}</h3>
      <div class="bands">
        <button v-for="band in BANDS" :key="band" :aria-pressed="state.band === band" @click="send({ type: 'band', value: band })">{{ t(key + 'bands.' + band) }}</button>
      </div>
      <p class="note">{{ t(key + 'bandNote') }}</p>
      <h3>{{ t(key + 'layersTitle') }}</h3>
      <label v-for="layer in LAYERS" :key="layer" class="layer">
        <input type="checkbox" :checked="state.layers?.[layer]" @change="send({ type: 'layer', layer, value: ($event.target as HTMLInputElement).checked })" />
        <span><strong>{{ t(key + 'layers.' + layer) }}</strong><small>{{ t(key + 'details.' + layer) }}</small></span>
      </label>
      <p v-if="state.model !== 'ready'" role="status" class="load-status">
        {{ t(key + (state.model === 'error' ? 'loadError' : 'loading')) }}
        <button v-if="state.model === 'error'" @click="send({ type: 'retry' })">{{ t(key + 'retry') }}</button>
      </p>
      <p v-if="state.layers && LAYERS.every(layer => !state.layers[layer])" role="status" class="note">{{ t(key + 'empty') }}</p>
      <div class="view-actions">
        <button @click="send({ type: 'focus', value: 'inner' })">{{ t(key + 'focus') }}</button>
        <button @click="send({ type: 'focus', value: 'all' })">{{ t(key + 'overview') }}</button>
        <button :aria-pressed="state.rotating" @click="send({ type: 'rotate' })">{{ t(key + 'rotate') }}</button>
      </div>
      <details>
        <summary>{{ t(key + 'scienceTitle') }}</summary>
        <p>{{ t(key + 'science') }}</p>
        <p>{{ t(key + 'reconstruction') }}</p>
        <a href="https://science.nasa.gov/3d-resources/crab-nebula/" target="_blank" rel="noopener noreferrer">{{ t(key + 'modelSource') }} ↗</a>
        <a href="https://science.nasa.gov/missions/hubble/nasas-great-observatories-help-astronomers-build-a-3d-visualization-of-an-exploded-star/" target="_blank" rel="noopener noreferrer">{{ t(key + 'scienceSource') }} ↗</a>
      </details>
      <RouterLink to="/demos/stellar-evolution">← {{ t(key + 'back') }}</RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.remnant-panel { position:absolute; z-index:6; left:1.15rem; top:var(--demo-panels-top, 100px); width:285px; max-height:calc(100% - var(--demo-panels-top, 100px) - 5rem); overflow:auto; pointer-events:auto; color:var(--color-text); background:color-mix(in srgb, var(--color-surface) 97%, transparent); border:1px solid var(--color-border); border-radius:12px; box-shadow:0 14px 38px var(--color-shadow); backdrop-filter:blur(14px); font-size:.75rem; }
.panel-heading { width:100%; display:flex; align-items:center; justify-content:space-between; border:0; padding:1rem; text-align:left; background:transparent; font-weight:650; font-size:.9rem; }
.panel-heading small { display:block; color:var(--color-blue); font-size:.6rem; letter-spacing:.15em; margin-bottom:.35rem; }
.panel-body { padding:0 1rem 1rem; }
.intro { color:var(--color-text-muted); line-height:1.7; margin:0 0 1rem; }
h3 { font-size:.72rem; margin:1rem 0 .55rem; }
button { cursor:pointer; color:inherit; font:inherit; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface-raised); padding:.45rem .55rem; }
button:hover { border-color:var(--color-blue); }
button[aria-pressed=true] { background:color-mix(in srgb, var(--color-blue) 12%, var(--color-surface)); color:var(--color-blue); border-color:var(--color-blue); }
button:focus-visible, a:focus-visible, summary:focus-visible, input:focus-visible { outline:2px solid var(--color-gold); outline-offset:3px; }
.bands { display:grid; grid-template-columns:1fr 1fr; gap:.4rem; }
.note, .load-status { color:var(--color-text-muted); font-size:.65rem; line-height:1.65; }
.layer { display:flex; gap:.6rem; padding:.65rem 0; border-bottom:1px solid var(--color-border); cursor:pointer; align-items:flex-start; }
.layer input { accent-color:var(--color-blue); margin-top:.2rem; }
.layer strong { font-size:.73rem; font-weight:550; }
.layer small { display:block; margin-top:.25rem; font-size:.65rem; color:var(--color-text-muted); line-height:1.6; }
.view-actions { display:flex; flex-wrap:wrap; gap:.4rem; margin:1rem 0; }
details { border-top:1px solid var(--color-border); padding:.7rem 0; line-height:1.7; color:var(--color-text-muted); }
summary { cursor:pointer; color:var(--color-text); }
a { display:block; color:var(--color-blue); margin-top:.5rem; line-height:1.7; text-decoration:none; }
@media(max-width:900px) { .remnant-panel { top:auto; bottom:5rem; left:.7rem; width:calc(100% - 1.4rem); max-height:min(48%, calc(100% - var(--demo-panels-top, 100px) - 5.5rem)); } .panel-heading { padding:.65rem .85rem; } .panel-heading small { display:none; } }
</style>
