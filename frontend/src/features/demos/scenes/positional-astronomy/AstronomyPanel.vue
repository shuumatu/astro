<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Compass, Focus, Globe2, Layers3, Minus, Pause, Play, Plus, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-vue-next'
import AstronomyReadout from './AstronomyReadout.vue'
import { CHAPTERS, INITIAL, horizontal, visibility, spherical, angles, equatorialToEcliptic, equatorialToGalactic, type AstronomyState } from './model'
const props = defineProps<{ state: Partial<AstronomyState>; send: (command: { type: string; value?: unknown }) => void }>()
defineOptions({ inheritAttrs: false })
const { t } = useI18n()
const k = 'demos.items.positionalAstronomy.'
const s = computed(() => ({ ...INITIAL, ...props.state }))
const folded = ref(window.innerWidth <= 900)
const answer = ref(false)
const compact = ref(window.innerWidth <= 900)
const captionFolded = ref(false)
const activeTab = ref<'explore' | 'learn'>('explore')
const ready = computed(() => props.state.chapter !== undefined)
const chapterIndex = computed(() => CHAPTERS.indexOf(s.value.chapter))
const animated = computed(() => ['daily', 'precession'].includes(s.value.chapter))
const ui = (key: string) => t(k + 'ui.' + key)
function resize() { compact.value = window.innerWidth <= 900 }
onMounted(() => window.addEventListener('resize', resize))
onBeforeUnmount(() => window.removeEventListener('resize', resize))
watch(() => [s.value.chapter, s.value.perspective], () => { answer.value = false; captionFolded.value = false })
function changeNumber(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  if (input.value.trim() === '' || !Number.isFinite(input.valueAsNumber)) { input.value = value(id); return }
  const slider = sliders.value.find(item => item.id === id)!
  const next = Math.min(slider.max, Math.max(slider.min, input.valueAsNumber))
  props.send({ type: id, value: next })
  input.value = String(next)
}
function beginNumberEdit() {
  // Keep animation's state publications from replacing a partially typed number.
  if (s.value.playing) props.send({ type: 'playing', value: false })
}
function nextChapter() {
  const chapter = CHAPTERS[chapterIndex.value + 1]
  if (chapter) select(chapter)
}
const horizontalValue = computed(() => horizontal(s.value.ra, s.value.dec, s.value.latitude, s.value.lst))
const other = computed(() => angles((s.value.chapter === 'galactic' ? equatorialToGalactic : equatorialToEcliptic)(spherical(s.value.ra * 15, s.value.dec))))
const sliders = computed(() => s.value.chapter === 'precession'
  ? [{ id: 'years', min: 0, max: 26000, step: 100, unit: t(k + 'yearsUnit') }]
  : s.value.chapter === 'horizon' && s.value.perspective === 'earth'
  ? [{ id: 'latitude', min: -90, max: 90, step: 1, unit: '°' }, { id: 'lst', min: 0, max: 24, step: .1, unit: 'h' }]
  : s.value.chapter === 'horizon'
  ? [{ id: 'azimuth', min: 0, max: 359, step: 1, unit: '°' }, { id: 'altitude', min: -90, max: 90, step: 1, unit: '°' }]
  : [{ id: 'latitude', min: -90, max: 90, step: 1, unit: '°' }, { id: 'ra', min: 0, max: 24, step: .1, unit: 'h' }, { id: 'dec', min: -90, max: 90, step: 1, unit: '°' }, { id: 'lst', min: 0, max: 24, step: .1, unit: 'h' }])
function numericValue(id: string) {
  if (id === 'azimuth') return horizontalValue.value.azimuth ?? 0
  if (id === 'altitude') return horizontalValue.value.altitude
  return s.value[id as 'latitude' | 'ra' | 'dec' | 'lst' | 'years']
}
function value(id: string) { return numericValue(id).toFixed(id === 'lst' || id === 'ra' || id === 'altitude' || id === 'azimuth' ? 1 : 0) }
function select(chapter: string) { answer.value = false; props.send({ type: 'chapter', value: chapter }) }
const examples = computed(() => ({ horizon: ['southeast'], equatorial: ['transit'], daily: ['circumpolar', 'southern'], ecliptic: ['solstice'], galactic: ['galacticCenter'], precession: ['halfCycle'] })[s.value.chapter])
const stepPrefix = computed(() => k + (s.value.perspective === 'earth' ? 'earthSteps.' : 'steps.') + s.value.chapter + '.')
const stepKey = computed(() => stepPrefix.value + s.value.step)
const longitudeName = computed(() => s.value.chapter === 'equatorial' ? 'ra' : s.value.chapter === 'ecliptic' ? 'eclipticLongitude' : 'galacticLongitude')
const latitudeName = computed(() => s.value.chapter === 'equatorial' ? 'dec' : s.value.chapter === 'ecliptic' ? 'eclipticLatitude' : 'galacticLatitude')
const legend = computed(() => {
  const entries: {color: string; key: string; dashed?: boolean}[] = []
  const chapter = s.value.chapter, step = s.value.step
  if (s.value.perspective === 'earth') {
    entries.push({color:'#78acff',key:'earthAxisEquator'})
    if ((chapter === 'horizon' || chapter === 'daily') && step > 0) entries.push({color:'#64dec8',key:'labels.tangentHorizon'})
    if (chapter === 'horizon' && step > 1) entries.push({color:'#ff8cad',key:'labels.poleAltitude'})
    if (chapter === 'ecliptic' && step > 0 || chapter === 'precession') entries.push({color:'#ffce70',key:'labels.ecliptic'})
    if (chapter === 'galactic' && step > 0) entries.push({color:'#d5a1ff',key:'labels.galactic'})
    if (chapter === 'precession' && step > 0) entries.push({color:'#64dec8',key:'cone'})
    if (chapter === 'precession' && step > 1) entries.push({color:'#e6efff',key:'labels.movingEquator'})
    if (chapter === 'daily' && step > 0) entries.push({color:'#ffce70',key:'labels.declinationCircle'})
    return entries
  }
  if (chapter === 'horizon' || chapter === 'daily') entries.push({color:'#64dec8', key:'labels.horizon'})
  if (chapter !== 'horizon' && (chapter !== 'daily' || step > 0)) entries.push({color:'#78acff', key:'labels.equator'})
  if (chapter === 'ecliptic' && step > 0 || chapter === 'precession') entries.push({color:'#ffce70', key:'labels.ecliptic'})
  if (chapter === 'galactic' && step > 0) entries.push({color:'#d5a1ff', key:'labels.galactic'})
  if (chapter === 'precession') {
    if (step > 0) entries.push({color:'#64dec8',key:'cone'})
    if (step > 1) entries.push({color:'#e6efff',key:'labels.movingEquator'})
  } else if (chapter === 'daily') {
    if (step > 0) entries.push({color:'#ffce70',key:'labels.dailyPath'}, {color:'#b5ad91',key:'ui.belowPath',dashed:true})
  } else {
    if (step >= (chapter === 'horizon' || chapter === 'equatorial' ? 1 : 2)) entries.push({color:'#ffce70',key:chapter === 'horizon' ? 'azimuth' : longitudeName.value})
    if (step > 1) entries.push({color:'#ff8cad',key:chapter === 'horizon' ? 'altitude' : latitudeName.value})
  }
  return entries
})
const compassPoint = computed(() => {
  const a = (horizontalValue.value.azimuth ?? 0) * Math.PI / 180
  return {x:80 + 48 * Math.sin(a), y:68 - 48 * Math.cos(a)}
})
function changeStep(step: number) { props.send({ type: 'step', value: step }) }
</script>

<template>
  <aside v-bind="$attrs" class="astronomy-panel" :class="{ folded }" :aria-label="t(k + 'panel')" @keydown.stop>
    <button class="heading" :aria-expanded="!folded" aria-controls="astronomy-controls" @click="folded = !folded">
      <span class="heading-icon"><Compass :size="21" /></span>
      <span class="heading-text"><small>CELESTIAL LAB <i /> {{ String(chapterIndex + 1).padStart(2, '0') }} / 06</small>{{ t(k + 'panel') }}</span>
      <component :is="folded ? ChevronDown : ChevronUp" :size="17" />
    </button>
    <div v-show="!folded" id="astronomy-controls" class="panel-body">
      <p v-if="!ready" class="unavailable" role="status">{{ ui('unavailable') }}</p>
      <fieldset :disabled="!ready">
        <legend class="sr-only">{{ t(k + 'chaptersTitle') }}</legend>
        <nav class="chapters" :aria-label="t(k + 'chaptersTitle')">
          <button v-for="(chapter, index) in CHAPTERS" :key="chapter" :aria-pressed="s.chapter === chapter" @click="select(chapter)">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>{{ t(k + 'chapters.' + chapter + '.title') }}
          </button>
        </nav>
        <div class="perspectives" :aria-label="t(k + 'perspectiveTitle')">
          <button v-for="perspective in ['earth', 'observer']" :key="perspective" :aria-pressed="s.perspective === perspective" @click="send({ type: 'perspective', value: perspective })">
            <component :is="perspective === 'earth' ? Globe2 : Compass" :size="15" />{{ t(k + 'perspectives.' + perspective) }}
          </button>
        </div>
        <p class="perspective-note">{{ t(k + 'perspectiveNotes.' + s.perspective) }}</p>
        <div class="lesson-steps" :aria-label="t(k + 'followSteps')">
          <button v-for="step in [0, 1, 2]" :key="step" :aria-pressed="s.step === step" :title="t(stepPrefix + step + '.title')" @click="changeStep(step)">
            <b>{{ step + 1 }}</b><span>{{ t(stepPrefix + step + '.title') }}</span>
          </button>
        </div>
        <div class="panel-tabs" :aria-label="ui('panelSections')">
          <button :aria-pressed="activeTab === 'explore'" aria-controls="astronomy-explore" @click="activeTab = 'explore'"><SlidersHorizontal :size="14" />{{ ui('explore') }}</button>
          <button :aria-pressed="activeTab === 'learn'" aria-controls="astronomy-learn" @click="activeTab = 'learn'"><Sparkles :size="14" />{{ ui('learn') }}</button>
        </div>
        <div v-show="activeTab === 'explore'" id="astronomy-explore">
          <div v-if="animated" class="playback">
            <button class="play-button" :aria-pressed="s.playing" @click="send({ type: 'playing' })"><component :is="s.playing ? Pause : Play" :size="15" />{{ ui(s.playing ? 'pause' : 'play') }}</button>
            <label>{{ ui('speed') }}<select :value="s.speed" @change="send({ type: 'speed', value: Number(($event.target as HTMLSelectElement).value) })"><option v-for="speed in [0.25, 0.5, 1, 2]" :key="speed" :value="speed">{{ speed }}×</option></select></label>
          </div>
          <div class="section-heading"><h3>{{ t(k + 'adjust') }}</h3><button class="text-button" @click="send({ type: 'reset' }); answer = false"><RotateCcw :size="12" />{{ ui('resetLesson') }}</button></div>
          <div v-for="slider in sliders" :key="slider.id" class="slider">
            <div class="slider-heading">
              <label :for="'astro-range-' + slider.id">{{ t(k + slider.id) }}</label>
              <span class="number-field"><input :id="'astro-number-' + slider.id" type="number" :aria-label="ui('precise') + ' · ' + t(k + slider.id)" :min="slider.min" :max="slider.max" :step="slider.step" :value="value(slider.id)" :aria-describedby="'astro-help-' + slider.id" @focus="beginNumberEdit" @change="changeNumber(slider.id, $event)" /><span>{{ slider.unit }}</span></span>
            </div>
            <input :id="'astro-range-' + slider.id" type="range" :min="slider.min" :max="slider.max" :step="slider.step" :value="numericValue(slider.id)" :aria-valuetext="value(slider.id) + slider.unit" :aria-describedby="'astro-help-' + slider.id" :style="{ '--fill': ((numericValue(slider.id) - slider.min) / (slider.max - slider.min) * 100) + '%' }" @input="send({ type: slider.id, value: Number(($event.target as HTMLInputElement).value) })" />
            <small :id="'astro-help-' + slider.id">{{ t(k + 'controlHelp.' + slider.id) }}</small>
          </div>
          <div v-if="sliders.some(slider => slider.id === 'latitude')" class="presets" :aria-label="ui('latitudePresets')">
            <button v-for="latitude in [-40, 0, 40, 90]" :key="latitude" :aria-pressed="s.latitude === latitude" @click="send({ type: 'latitude', value: latitude })">{{ ui('lat' + latitude) }}</button>
          </div>
          <div class="inline-readout" :class="{ daily: s.chapter === 'daily' }"><AstronomyReadout :state="s" :send="send" /></div>
          <details class="display-options" open>
            <summary><Layers3 :size="14" />{{ ui('display') }}</summary>
            <div class="views"><button v-for="view in ['oblique', 'top', 'side']" :key="view" @click="send({ type: 'view', value: view })">{{ t(k + 'views.' + (view === 'top' && s.perspective === 'earth' ? 'axis' : view)) }}</button></div>
            <div class="display-row"><label class="grid-toggle"><input type="checkbox" :checked="s.grid" @change="send({ type: 'grid' })" />{{ t(k + 'grid') }}</label><div class="zoom-buttons"><button :aria-label="ui('zoomOut')" :title="ui('zoomOut')" @click="send({type:'camera',value:'out'})"><Minus :size="14" /></button><button :aria-label="ui('zoomIn')" :title="ui('zoomIn')" @click="send({type:'camera',value:'in'})"><Plus :size="14" /></button><button :aria-label="ui('homeView')" :title="ui('homeView')" @click="send({type:'view',value:'oblique'})"><Focus :size="14" /></button></div></div>
          </details>
        </div>
        <section v-show="activeTab === 'learn'" id="astronomy-learn" class="learning">
          <p class="chapter-intro">{{ t(k + 'chapters.' + s.chapter + '.body') }}</p>
          <section class="experiment"><h3><Sparkles :size="15" />{{ t(k + 'examplesTitle') }}</h3><div class="example-buttons"><button v-for="example in examples" :key="example" @click="send({ type: 'example', value: example }); answer = false">{{ t(k + 'examples.' + example) }}<ChevronRight :size="13" /></button></div><p>{{ t(k + 'chapters.' + s.chapter + '.task') }}</p><button class="text-button" :aria-expanded="answer" aria-controls="astronomy-answer" @click="answer = !answer">{{ t(k + (answer ? 'hide' : 'answer')) }}<component :is="answer ? ChevronUp : ChevronDown" :size="13" /></button><p v-if="answer" id="astronomy-answer" class="answer">{{ t(k + 'chapters.' + s.chapter + '.answer') }}</p></section>
        </section>
      </fieldset>
      <details class="model-notes"><summary>{{ t(k + 'notesTitle') }}</summary><p>{{ t(k + 'lineNote') }}</p><p>{{ t(k + 'notes') }}</p><a href="https://aa.usno.navy.mil/faq/" target="_blank" rel="noopener noreferrer">USNO · {{ t(k + 'reference') }} ↗</a><a href="https://docs.astropy.org/en/stable/coordinates/index.html" target="_blank" rel="noopener noreferrer">Astropy · {{ t(k + 'reference') }} ↗</a></details>
    </div>
  </aside>

  <aside v-if="ready" :class="$attrs.class" class="astronomy-hud" :aria-label="ui('readings')" @keydown.stop><AstronomyReadout :state="s" :send="send" /></aside>

  <section v-show="!compact || folded" :class="[$attrs.class, { 'caption-folded': captionFolded }]" class="lesson-caption" :aria-label="t(k + 'liveExplanation')" @keydown.stop>
    <div class="caption-heading">
      <span class="step-badge">{{ String(s.step + 1).padStart(2, '0') }}<small>/ 03</small></span>
      <div><small class="caption-eyebrow">{{ t(k + 'chapters.' + s.chapter + '.title') }} <span> / </span> {{ t(k + 'perspectives.' + s.perspective) }}</small><h2>{{ t(stepKey + '.title') }}</h2></div>
      <button class="caption-toggle" :aria-label="ui(captionFolded ? 'expandCaption' : 'collapseCaption')" :aria-expanded="!captionFolded" aria-controls="astro-caption-content" @click="captionFolded = !captionFolded"><component :is="captionFolded ? ChevronUp : ChevronDown" :size="16" /></button>
    </div>
    <div v-show="!captionFolded" id="astro-caption-content" class="caption-content">
      <svg v-if="s.chapter === 'horizon' && s.perspective === 'observer'" class="compass" viewBox="0 0 160 140" role="img" :aria-label="t(k + 'compassTitle')">
        <circle cx="80" cy="68" r="48" fill="none" stroke="#64dec8" stroke-width="1.5" /><circle cx="80" cy="68" r="32" fill="none" stroke="#243e53" stroke-dasharray="2 5" />
        <path d="M80 20V116M32 68H128" stroke="#304d65" />
        <path v-if="horizontalValue.azimuth !== null" :d="`M80 68L${compassPoint.x} ${compassPoint.y}`" stroke="#ffce70" stroke-width="2" />
        <circle v-if="horizontalValue.azimuth !== null" :cx="compassPoint.x" :cy="compassPoint.y" r="4" fill="#ffce70" />
        <circle cx="80" cy="68" r="3" fill="#e6efff" />
        <text x="80" y="12">{{ t(k + 'compass.n') }}</text><text x="142" y="72">{{ t(k + 'compass.e') }}</text><text x="80" y="132">{{ t(k + 'compass.s') }}</text><text x="16" y="72">{{ t(k + 'compass.w') }}</text>
      </svg>
      <div class="caption-body"><p class="caption-instruction">{{ t(stepKey + '.body') }}</p>
      <template v-if="s.step === 2">
      <p v-if="s.chapter === 'horizon' && s.perspective === 'earth'">{{ t(k + 'liveEarthHorizon', {lat:s.latitude.toFixed(0), height:Math.abs(s.latitude).toFixed(0)}) }}</p>
      <p v-else-if="s.chapter === 'daily' && s.perspective === 'earth'">{{ t(k + 'liveEarthDaily', {lst:s.lst.toFixed(1)}) }}</p>
      <p v-else-if="s.chapter === 'horizon' && horizontalValue.azimuth === null">{{ t(k + 'undefinedAzimuth') }}</p>
      <p v-else-if="s.chapter === 'horizon'">{{ t(k + 'liveHorizon', {az:horizontalValue.azimuth?.toFixed(1), alt:horizontalValue.altitude.toFixed(1)}) }}</p>
      <p v-else-if="s.chapter === 'equatorial'">{{ t(k + 'liveEquatorial', {ra:s.ra.toFixed(1), deg:(s.ra * 15).toFixed(1), dec:s.dec.toFixed(1)}) }}</p>
      <p v-else-if="s.chapter === 'daily'">{{ t(k + 'liveDaily', {lat:s.latitude.toFixed(0), dec:s.dec.toFixed(0), result:t(k + visibility(s.latitude,s.dec))}) }}</p>
      <p v-else-if="s.chapter === 'precession'">{{ t(k + (s.perspective === 'earth' ? 'liveEarthPrecession' : 'livePrecession'), {years:s.years.toFixed(0)}) }}</p>
      <p v-else>{{ t(k + 'liveFrame', {lonName:t(k + longitudeName), latName:t(k + latitudeName), lon:other.lon.toFixed(1), lat:other.lat.toFixed(1)}) }}</p>
      </template>

        <div class="legend" :aria-label="ui('legend')"><span v-for="entry in legend" :key="entry.key" :style="{ color: entry.color }"><i :class="{ dashed: entry.dashed }" />{{ t(k + entry.key) }}</span></div>
      </div>
    </div>
    <fieldset class="caption-actions" :disabled="!ready">
      <button :disabled="s.step === 0" :aria-label="t(k + 'previousStep')" @click="changeStep(s.step - 1)"><ChevronLeft :size="14" /><span>{{ t(k + 'previousStep') }}</span></button>
      <button v-if="animated" class="caption-play" :aria-label="ui(s.playing ? 'pause' : 'play')" :title="ui(s.playing ? 'pause' : 'play')" :aria-pressed="s.playing" @click="send({ type: 'playing' })"><component :is="s.playing ? Pause : Play" :size="14" /></button>
      <button v-if="s.step < 2" class="primary" @click="changeStep(s.step + 1)">{{ t(k + 'nextStep') }}<ChevronRight :size="14" /></button>
      <template v-else><button @click="send({ type: 'perspective', value: s.perspective === 'earth' ? 'observer' : 'earth' })"><Globe2 :size="14" />{{ ui('compareView') }}</button><button v-if="chapterIndex < CHAPTERS.length - 1" class="primary" @click="nextChapter">{{ ui('nextChapter') }}<ChevronRight :size="14" /></button><button v-else class="primary" @click="select(CHAPTERS[0])">{{ ui('startAgain') }}<RotateCcw :size="14" /></button></template>
    </fieldset>
  </section>
</template>

<style scoped>
.astronomy-panel,.lesson-caption,.astronomy-hud { --muted:var(--color-text-muted); --accent:var(--color-blue); color:var(--color-text); font-size:13px; }
.astronomy-panel { position:absolute; z-index:6; left:18px; top:var(--demo-panels-top,100px); width:340px; max-height:calc(100% - var(--demo-panels-top,100px) - 64px); display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--color-border); border-radius:16px; background:linear-gradient(150deg,color-mix(in srgb, var(--color-surface-raised) 97%, transparent),color-mix(in srgb, var(--color-surface) 97%, transparent)); box-shadow:0 16px 48px var(--color-shadow);  }
button,input,select { font:inherit; }
button { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:34px; padding:7px 10px; color:inherit; border:1px solid var(--color-border); border-radius:8px; background:var(--color-surface-raised); cursor:pointer; transition:background .16s,border-color .16s; }
button:hover:not(:disabled) { border-color:var(--color-blue); background:color-mix(in srgb, var(--color-blue) 12%, var(--color-surface)); }
button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,a:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
button:disabled { opacity:.4; cursor:default; }
button[aria-pressed=true] { color:var(--color-blue); border-color:color-mix(in srgb, var(--color-blue) 45%, var(--color-border)); background:color-mix(in srgb, var(--color-blue) 12%, var(--color-surface)); }
svg { flex-shrink:0; }
fieldset { min-width:0; border:0; padding:0; margin:0; }
fieldset:disabled { opacity:.55; }
.sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.heading { flex-shrink:0; width:100%; padding:17px 16px; gap:11px; border:0; border-radius:0; background:transparent; text-align:left; }
.heading:hover:not(:disabled) { background:color-mix(in srgb, var(--color-text) 3%, transparent); border-color:transparent; }
.heading-icon { display:grid; place-items:center; width:37px; height:37px; border:1px solid color-mix(in srgb, var(--color-blue) 45%, var(--color-border)); border-radius:11px; color:var(--accent); background:color-mix(in srgb, var(--color-blue) 12%, var(--color-surface)); }
.heading-text { flex:1; font-size:14px; font-weight:600; line-height:1.5; }
.heading small { display:flex; align-items:center; gap:8px; margin-bottom:3px; color:var(--accent); font-size:9px; font-weight:500; letter-spacing:.14em; }
.heading small i { width:3px; height:3px; background:var(--color-text-subtle); border-radius:50%; }
.panel-body { padding:0 16px 16px; overflow:auto; scrollbar-width:thin; scrollbar-color:var(--color-scrollbar) transparent; overscroll-behavior:contain; }
.chapters { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.chapters button { justify-content:flex-start; padding:9px; font-size:12px; background:var(--color-surface); }
.chapters span { font-size:10px; color:var(--color-text-subtle); font-variant-numeric:tabular-nums; }
.chapters button[aria-pressed=true] { border-color:color-mix(in srgb, var(--color-blue) 45%, var(--color-border)); background:linear-gradient(110deg,color-mix(in srgb, var(--color-blue) 12%, var(--color-surface)),color-mix(in srgb, var(--color-blue) 12%, var(--color-surface))); }
.chapters button[aria-pressed=true] span { color:var(--accent); }
.perspectives { display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; margin-top:16px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:10px; }
.perspectives button { font-size:11px; padding:7px 4px; background:transparent; border-color:transparent; }
.perspectives button[aria-pressed=true] { background:color-mix(in srgb, var(--color-blue) 12%, var(--color-surface)); color:var(--color-blue); }
.perspective-note { margin:8px 1px 13px; color:var(--muted); font-size:11px; line-height:1.65; }
.lesson-steps { display:grid; gap:3px; }
.lesson-steps button { justify-content:flex-start; text-align:left; border-color:transparent; background:transparent; padding:5px 7px; color:var(--muted); font-size:11px; }
.lesson-steps b { display:grid; place-items:center; flex-shrink:0; width:21px; height:21px; border-radius:50%; color:var(--color-text-muted); background:var(--color-surface-raised); font-size:10px; }
.lesson-steps button[aria-pressed=true] { background:color-mix(in srgb, var(--color-blue) 6%, transparent); color:var(--color-text); }
.lesson-steps button[aria-pressed=true] b { color:var(--color-on-accent); background:var(--accent); }
.panel-tabs { display:flex; gap:18px; margin:14px 0 16px; border-bottom:1px solid var(--color-border); }
.panel-tabs button { flex:1; font-size:12px; border:0; border-radius:0; background:transparent; color:var(--muted); padding:10px 0; }
.panel-tabs button[aria-pressed=true] { color:var(--accent); box-shadow:0 2px var(--accent); }
.section-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:13px; }
h3 { font-size:12px; margin:0; font-weight:550; }
.text-button { padding:3px 0; min-height:28px; background:transparent; border:0; color:var(--accent); font-size:11px; }
.slider { margin:0 0 15px; }
.slider-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; }
.number-field { display:flex; align-items:center; border:1px solid var(--color-border); background:var(--color-surface); border-radius:7px; padding:3px 7px; color:var(--accent); font-size:12px; }
.number-field input { min-width:0; width:57px; border:0; background:transparent; color:var(--color-text); text-align:right; font-variant-numeric:tabular-nums; appearance:textfield; }
.number-field input::-webkit-inner-spin-button { appearance:none; }
.number-field span { padding-left:4px; color:var(--color-text-subtle); }
.slider input[type=range] { display:block; appearance:none; width:100%; height:5px; margin:14px 0; border-radius:5px; background:linear-gradient(to right,var(--color-blue) var(--fill),var(--color-border) var(--fill)); cursor:pointer; }
.slider input[type=range]::-webkit-slider-thumb { appearance:none; width:14px; height:14px; border:3px solid var(--color-on-accent); border-radius:50%; background:var(--color-blue); box-shadow:0 0 0 4px color-mix(in srgb, var(--color-blue) 10%, transparent); }
.slider input[type=range]::-moz-range-thumb { width:10px; height:10px; border:2px solid var(--color-on-accent); border-radius:50%; background:var(--color-blue); }
.slider small { display:block; color:var(--muted); font-size:10px; line-height:1.6; }
.presets { display:flex; gap:5px; margin-bottom:16px; flex-wrap:wrap; }
.presets button { flex:1; padding:5px; font-size:10px; min-height:29px; white-space:nowrap; }
.playback { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; margin-bottom:14px; border-radius:10px; background:color-mix(in srgb, var(--color-blue) 6%, transparent); border:1px solid color-mix(in srgb, var(--color-blue) 45%, var(--color-border)); }
.play-button { color:var(--color-blue); border-color:color-mix(in srgb, var(--color-blue) 45%, var(--color-border)); font-size:12px; }
.playback label { display:flex; align-items:center; gap:7px; font-size:10px; color:var(--muted); }
select { border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface-raised); color:var(--color-text); padding:6px 4px; }
.inline-readout { margin:14px 0; }
.display-options { border-top:1px solid var(--color-border); padding-top:13px; }
summary { cursor:pointer; color:var(--color-text-muted); font-size:11px; line-height:1.7; }
summary svg { vertical-align:middle; margin:0 4px; }
.views { display:flex; gap:5px; margin:10px 0; }
.views button { flex:1; font-size:10px; padding:6px 3px; }
.display-row { display:flex; align-items:center; justify-content:space-between; gap:6px; }
.grid-toggle { display:flex; gap:7px; align-items:center; color:var(--muted); font-size:11px; }
.grid-toggle input { accent-color:var(--accent); margin:0; }
.zoom-buttons { display:flex; gap:4px; }
.zoom-buttons button { padding:6px; min-height:30px; }
.learning p,.model-notes p { color:var(--color-text-muted); line-height:1.9; font-size:12px; }
.chapter-intro { margin:0 0 15px; }
.experiment { padding:13px; border:1px solid color-mix(in srgb, var(--color-gold) 35%, var(--color-border)); border-radius:10px; background:color-mix(in srgb, var(--color-gold) 4%, transparent); }
.experiment h3 { display:flex; gap:8px; align-items:center; color:var(--color-gold); }
.example-buttons { display:flex; gap:6px; flex-wrap:wrap; margin-top:11px; }
.example-buttons button { font-size:11px; color:var(--color-gold); background:color-mix(in srgb, var(--color-gold) 8%, transparent); border-color:color-mix(in srgb, var(--color-gold) 35%, var(--color-border)); }
.experiment .answer { border-left:2px solid var(--accent); padding-left:10px; color:var(--color-text-muted); }
.model-notes { margin-top:16px; border-top:1px solid var(--color-border); padding-top:12px; }
.model-notes p { font-size:11px; }
a { color:var(--accent); display:block; font-size:11px; margin:8px 0; }
.unavailable { color:var(--color-warning); font-size:12px; line-height:1.7; }
.astronomy-hud { position:absolute; z-index:5; right:22px; top:var(--demo-panels-top,100px); width:280px; max-height:calc(100% - var(--demo-panels-top,100px) - 290px); overflow:auto; scrollbar-width:thin; scrollbar-color:var(--color-scrollbar) transparent; border-radius:16px; box-sizing:border-box; }
.astronomy-hud :deep(.astronomy-readout) { padding:12px; }
.astronomy-hud :deep(.readout-heading) { margin-bottom:8px; }
.astronomy-hud :deep(.metric strong) { font-size:23px; }
.astronomy-hud :deep(.horizon-state) { margin-top:8px; }
.astronomy-hud :deep(.daily-chart) { margin-top:9px; padding-top:8px; }
.astronomy-hud :deep(.altitude-chart) { width:min(100%,218px); margin:5px auto 0; }
.astronomy-hud :deep(.chart-hint) { margin-bottom:4px; }
.astronomy-hud :deep(.time-range) { height:20px; margin-bottom:6px; }
.astronomy-hud :deep(.readout-footnote) { margin-top:6px; }
.lesson-caption { position:absolute; z-index:5; left:382px; right:22px; bottom:60px; border:1px solid var(--color-border); border-radius:14px; padding:17px 20px 12px; background:linear-gradient(125deg,color-mix(in srgb, var(--color-surface-raised) 96%, transparent),color-mix(in srgb, var(--color-surface) 96%, transparent)); box-shadow:0 12px 35px var(--color-shadow); }
.caption-heading { display:flex; gap:12px; align-items:center; }
.step-badge { display:flex; align-items:baseline; gap:4px; flex-shrink:0; font-size:23px; font-weight:400; color:var(--accent); font-variant-numeric:tabular-nums; }
.step-badge small { font-size:10px; color:var(--color-text-subtle); }
.caption-eyebrow { color:var(--color-text-muted); font-size:10px; letter-spacing:.03em; }
.caption-eyebrow span { color:var(--color-text-subtle); margin:0 5px; }
.caption-heading h2 { margin:4px 0 0; font-size:17px; font-weight:550; }
.caption-toggle { margin-left:auto; flex-shrink:0; padding:6px; min-height:30px; color:var(--color-text-muted); border:0; background:transparent; }
.caption-content { display:flex; align-items:center; gap:16px; margin-top:13px; max-height:25vh; overflow:auto; scrollbar-width:thin; }
.compass { width:106px; flex:0 0 106px; height:96px; padding:4px; border-radius:10px; background:#101b2c; color-scheme:dark; }
.compass text { text-anchor:middle; fill:#a9d7d3; font-size:10px; }
.caption-body { min-width:0; }
.caption-body p { margin:0; color:var(--color-text-muted); font-size:12px; line-height:1.75; }
.caption-body .caption-instruction { margin-bottom:6px; color:var(--color-text); }
/* Keep the diagram legend on a dark inset to match the physical scene colors. */
.legend { padding:8px 10px; border-radius:8px; background:#101b2c; color-scheme:dark; display:flex; flex-wrap:wrap; gap:6px 16px; font-size:10px; margin-top:9px; }
.legend span { display:flex; align-items:center; gap:6px; }
.legend i { width:13px; height:3px; border-radius:3px; background:currentColor; }
.legend i.dashed { height:0; border-top:2px dashed currentColor; border-radius:0; background:transparent; }
.caption-actions { display:flex; gap:7px; justify-content:flex-end; margin-top:13px; padding-top:10px; border-top:1px solid var(--color-border); }
.caption-actions button { font-size:11px; min-height:31px; }
.caption-actions button:first-child { margin-right:auto; }
.caption-actions .primary { background:var(--color-blue); color:var(--color-on-accent); border-color:var(--color-blue); font-weight:550; }
.caption-actions .primary:hover:not(:disabled) { background:color-mix(in srgb, var(--color-blue) 85%, var(--color-text)); }
@media(min-width:1201px) { .inline-readout { display:none; } }
@media(max-width:1200px) { .astronomy-hud { display:none; } .compass { display:none; } .lesson-caption { left:378px; right:18px; padding:14px 16px 11px; } }
@media(max-width:900px) {
  .astronomy-panel { left:12px; width:min(360px,calc(100% - 24px)); max-height:calc(100% - var(--demo-panels-top,100px) - 16px); }
  .astronomy-panel:not(.folded) { width:min(400px,calc(100% - 24px)); }
  .heading { padding:12px; }
  .heading-text { font-size:13px; }
  .heading-icon { width:32px; height:32px; }
  .lesson-caption { left:12px; right:12px; bottom:max(12px,env(safe-area-inset-bottom)); padding:12px 14px 10px; }
  .caption-heading h2 { font-size:14px; }
  .caption-content { max-height:22vh; margin-top:9px; }
  .caption-body p { font-size:11px; }
  .caption-actions { margin-top:9px; padding-top:8px; }
  .caption-eyebrow { font-size:9px; }
  .step-badge { font-size:20px; }
  .legend { font-size:9px; gap:6px 12px; }
}
@media(max-width:440px) {
  .caption-heading { gap:9px; }
  .caption-actions button { font-size:10px; padding:6px 8px; min-height:36px; }
  .caption-actions button:first-child span { display:none; }
  .caption-eyebrow { letter-spacing:0; }
  .perspectives button { min-height:38px; }
}
@media(max-height:650px) { .caption-content { max-height:18vh; } .lesson-caption { bottom:12px; } .astronomy-panel { max-height:calc(100% - var(--demo-panels-top,100px) - 16px); } }
@media(prefers-reduced-motion:reduce) { button { transition:none; } }
</style>
