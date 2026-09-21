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
.remnant-panel { position:absolute; z-index:6; left:1.15rem; top:var(--demo-panels-top, 100px); width:285px; max-height:calc(100% - var(--demo-panels-top, 100px) - 5rem); overflow:auto; pointer-events:auto; color:#d6e3ef; background:rgba(6,15,25,.91); border:1px solid #314456; border-radius:12px; backdrop-filter:blur(14px); font-size:.75rem; }
.panel-heading { width:100%; display:flex; align-items:center; justify-content:space-between; border:0; padding:1rem; text-align:left; background:transparent; font-weight:650; font-size:.9rem; }
.panel-heading small { display:block; color:#88bbc8; font-size:.6rem; letter-spacing:.15em; margin-bottom:.35rem; }
.panel-body { padding:0 1rem 1rem; }
.intro { color:#a7bbce; line-height:1.7; margin:0 0 1rem; }
h3 { font-size:.72rem; margin:1rem 0 .55rem; }
button { cursor:pointer; color:inherit; font:inherit; border:1px solid #35495c; border-radius:6px; background:#132334; padding:.45rem .55rem; }
button[aria-pressed=true] { background:#224d5e; color:#c6f7ff; border-color:#6bb7c7; }
button:focus-visible, a:focus-visible, summary:focus-visible, input:focus-visible { outline:2px solid #92dcea; outline-offset:3px; }
.bands { display:grid; grid-template-columns:1fr 1fr; gap:.4rem; }
.note, .load-status { color:#a8bdcd; font-size:.65rem; line-height:1.65; }
.layer { display:flex; gap:.6rem; padding:.65rem 0; border-bottom:1px solid #223344; cursor:pointer; align-items:flex-start; }
.layer input { accent-color:#86d6e0; margin-top:.2rem; }
.layer strong { font-size:.73rem; font-weight:550; }
.layer small { display:block; margin-top:.25rem; font-size:.65rem; color:#92a8bd; line-height:1.6; }
.view-actions { display:flex; flex-wrap:wrap; gap:.4rem; margin:1rem 0; }
details { border-top:1px solid #304153; padding:.7rem 0; line-height:1.7; color:#9eb3c5; }
summary { cursor:pointer; color:#c9dae6; }
a { display:block; color:#8cd1df; margin-top:.5rem; line-height:1.7; text-decoration:none; }
@media(max-width:900px) { .remnant-panel { top:auto; bottom:5rem; left:.7rem; width:calc(100% - 1.4rem); max-height:min(48%, calc(100% - var(--demo-panels-top, 100px) - 5.5rem)); } .panel-heading { padding:.65rem .85rem; } .panel-heading small { display:none; } }
</style>
