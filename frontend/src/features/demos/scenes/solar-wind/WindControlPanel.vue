<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DIRECTIONS, INITIAL, STEPS, mapWind, type WindState } from './model'
import { REFERENCES } from './references'
const props = defineProps<{ state: object; send: (command: unknown) => void }>()
const { t } = useI18n()
const k = 'demos.items.solarWind.'
const activeTab = ref('experiment')
const ready = computed(() => 'intensity' in props.state)
const s = computed(() => ready.value ? props.state as WindState : INITIAL)
const physical = computed(() => mapWind(s.value.intensity, s.value.direction))
const level = (value: number) => value < .33 ? 'low' : value < .66 ? 'medium' : 'high'
const cameraButtons = [ ['left','←'], ['right','→'], ['up','↑'], ['down','↓'], ['in','+'], ['out','−'], ['reset','↺'] ] as const
</script>

<template>
  <div class="wind-ui" @keydown.stop>
    <div class="scene-heading">
      <small>{{ t(k + 'eyebrow') }}</small>
      <h2>{{ t(k + (s.view === 'earth' ? 'heroDetail' : 'hero')) }}</h2>
      <p>{{ t(k + 'heroSub') }}</p>
      <div class="view-switch" role="group" :aria-label="t(k + 'viewTitle')">
        <button v-for="view in ['system','earth']" :key="view" :disabled="!ready || s.contextLost" :aria-pressed="s.view === view" @click="send({type:'view',value:view})"><span aria-hidden="true">{{ view === 'system' ? '◎' : '◉' }}</span>{{ t(k + 'views.' + view) }}</button>
      </div>
    </div>
    <div class="camera-tools" role="group" :aria-label="t(k + 'viewTitle')"><button v-for="[action,icon] in cameraButtons" :key="action" :aria-label="t(k + 'camera.' + action)" :title="t(k + 'camera.' + action)" :disabled="!ready || s.contextLost" @click="send({type:'camera',value:action})">{{ icon }}</button><p>{{ t(k + 'cameraHelp') }}</p><span class="touch-help">{{ t(k + 'touchHelp') }}</span></div>
    <div class="scene-caption"><span class="caption-rule"/><p>{{ t(k + (s.view === 'earth' ? 'detailNote' : 'hint')) }}</p><div><span class="gold">{{ t(k + 'labels.wind') }}</span><span class="cyan">{{ t(k + 'labels.magnetopause') }}</span><span class="green">{{ t(k + 'activity') }}</span></div></div>
    <aside class="wind-panel" :aria-label="t(k + 'panel')">
      <header><div class="panel-title"><span class="orb" aria-hidden="true"/><h2>{{ t(k + 'panel') }}</h2><span class="lab-id" aria-hidden="true">01—03</span></div><p class="notice">{{ t(k + 'notice') }}</p>
        <div class="panel-tabs"><button :aria-pressed="activeTab === 'experiment'" aria-controls="wind-experiment" @click="activeTab = 'experiment'">{{ t(k + 'experimentTab') }}</button><button :aria-pressed="activeTab === 'learn'" aria-controls="wind-learn" @click="activeTab = 'learn'">{{ t(k + 'learnTab') }}</button></div>
      </header>
      <div class="panel-body">
        <p v-if="!ready || s.contextLost" class="notice" role="status">{{ t(k + (s.contextLost ? 'contextLost' : 'unavailable')) }}</p>
        <section v-show="activeTab === 'experiment'" id="wind-experiment">
          <fieldset :disabled="!ready || s.contextLost">
            <legend>{{ t(k + 'presetsTitle') }}</legend>
            <div class="presets"><button v-for="(preset,index) in STEPS" :key="preset" :aria-pressed="s.preset === preset" @click="send({type:'preset',value:preset})"><i aria-hidden="true">0{{ index + 1 }}</i>{{ t(k + 'presets.' + preset) }}</button></div>
            <div class="strength-heading"><label for="wind-intensity">{{ t(k + 'intensity') }}</label><output for="wind-intensity">{{ s.intensity }}<small>/ 100</small></output></div>
            <input id="wind-intensity" type="range" min="0" max="100" step="1" :value="s.intensity" :style="{'--amount': s.intensity + '%'}" aria-describedby="wind-intensity-help" @input="send({type:'intensity',value:Number(($event.target as HTMLInputElement).value)})" />
            <div class="scale" aria-hidden="true"><span>0</span><span>50</span><span>100</span></div>
            <label for="wind-direction">{{ t(k + 'direction') }}</label>
            <select id="wind-direction" :value="s.direction" aria-describedby="wind-direction-help" @change="send({type:'direction',value:($event.target as HTMLSelectElement).value})"><option v-for="direction in DIRECTIONS" :key="direction" :value="direction">{{ t(k + 'directions.' + direction) }}</option></select>
            <div class="readouts" aria-live="polite" aria-atomic="true">
              <div><span>{{ t(k + 'compression') }}</span><strong>{{ t(k + 'compressions.' + level(physical.strength)) }}</strong><i :style="{'--fill':physical.strength * 100 + '%'}"/></div>
              <div><span>{{ t(k + 'coupling') }}</span><strong>{{ t(k + 'couplings.' + s.direction) }}</strong><i :style="{'--fill':physical.coupling * 100 + '%'}"/></div>
              <div><span>{{ t(k + 'activity') }}</span><strong>{{ t(k + 'levels.' + level(physical.activity)) }}</strong><i :style="{'--fill':physical.activity * 100 + '%'}"/></div>
            </div>
            <div class="actions"><button :disabled="s.reducedMotion" :aria-pressed="s.playing && !s.reducedMotion" @click="send({type:'playing'})"><span aria-hidden="true">{{ s.playing ? 'Ⅱ' : '▷' }}</span> {{ t(k + (s.playing ? 'pause' : 'play')) }}</button><button @click="send({type:'reset'})">{{ t(k + 'reset') }}</button></div>
            <p v-if="s.reducedMotion" class="help" role="status">{{ t(k + 'reducedMotion') }}</p>
          </fieldset>
          <details class="parameter-help"><summary>{{ t(k + 'parameterHelp') }}</summary><p id="wind-intensity-help">{{ t(k + 'intensityHelp') }}</p><p id="wind-direction-help">{{ t(k + 'directionHelp') }}</p><p>{{ t(k + 'readoutHelp') }}</p></details>
        </section>
        <section v-show="activeTab === 'learn'" id="wind-learn">
          <h3>{{ t(k + 'guideTitle') }}</h3>
          <nav :aria-label="t(k + 'guideTitle')"><button v-for="(_, step) in STEPS" :key="step" :disabled="!ready || s.contextLost" :aria-pressed="s.step === step" :aria-label="t(k + 'steps.' + step + '.title')" @click="send({type:'step',value:step})">0{{ step + 1 }}</button></nav>
          <section class="lesson" aria-live="polite"><span class="chapter" aria-hidden="true">0{{ s.step + 1 }} / 03</span><h3>{{ t(k + 'steps.' + s.step + '.title') }}</h3><p>{{ t(k + 'steps.' + s.step + '.body') }}</p></section>
          <div class="actions"><button :disabled="!ready || s.contextLost || s.step === 0" @click="send({type:'step',value:s.step - 1})">← {{ t(k + 'previous') }}</button><button :disabled="!ready || s.contextLost || s.step === 2" @click="send({type:'step',value:s.step + 1})">{{ t(k + 'next') }} →</button></div>
          <p class="help">{{ t(k + 'guideHelp') }}</p>
          <ul class="legend"><li v-for="item in ['wind','field','rain','oval','reconnection']" :key="item" :class="item"><i/>{{ t(k + 'legend.' + item) }}</li></ul>
        </section>
        <details><summary>{{ t(k + 'scienceTitle') }}</summary><p>{{ t(k + 'colors') }}</p><p>{{ t(k + 'limits') }}</p><p>{{ t(k + 'timeLimits') }}</p><p>{{ t(k + 'textureCredit') }}</p><h3>{{ t(k + 'sources') }}</h3><a v-for="source in REFERENCES" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title }} ↗</a></details>
      </div>
    </aside>
  </div>
</template>

<style scoped src="./panel.css"></style>
