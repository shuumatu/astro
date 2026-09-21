<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from 'lucide-vue-next'
import { SCENE } from './config'
import {
  ECLIPSE_KIND_KEYS,
  ECLIPSE_KEYS,
  ECLIPSE_LABELS,
  ECLIPSE_SECTION_KEYS,
  ECLIPSE_VIEW_KEYS,
} from './messages'
import type {
  EclipseCommand,
  EclipseEventKind,
  EclipsePhaseBand,
  EclipseSceneState,
  EclipseSection,
  EclipseViewMode,
} from './types'

/**
 * The eclipse demo's own control surface.
 *
 * It is mounted by the shared shell inside the stage and given two things: the state the scene
 * published and a way to send commands back. Neither the shell nor `DemoSceneSettings` knows what is
 * in either - which is what lets this demo carry a section switch, a view switch, an event picker, a
 * timeline and a lesson toggle without a single eclipse-shaped field leaking into every other demo.
 */
const props = defineProps<{
  state: EclipseSceneState
  send: (command: EclipseCommand) => void
  guided?: boolean
}>()

const { t, locale } = useI18n()

/**
 * Whether the panel starts folded away.
 *
 * On a phone the card is nearly the full width of the stage, so an open one hides the eclipse behind
 * its own controls - and in the observer view it hides the disc that the view exists to show. Folding
 * it away on a narrow viewport puts the content first and the controls one tap away, with the toggle
 * sitting in the header either way.
 */
const collapsed = ref(
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(max-width: 900px)').matches,
)
const eventPicker = ref<HTMLDetailsElement | null>(null)

const SECTIONS: EclipseSection[] = ['solar', 'lunar']
const VIEWS: EclipseViewMode[] = ['system', 'observer']

const isSolar = computed(() => props.state.section === 'solar')
const isObserver = computed(() => props.state.view === 'observer')

/**
 * Whether the scene has published anything yet.
 *
 * The shell hands the panel its state as soon as the scene sends it, which is a moment after the
 * panel itself is mounted - and the shell deliberately does not know what a populated state looks
 * like, so it cannot withhold the panel until then. Guarding here keeps the first render off an
 * empty object, where every number would be undefined and every date an Invalid Date.
 */
const ready = computed(() => typeof (props.state as Partial<EclipseSceneState>)?.section === 'string')

/** Sends a toggle by name, so the template does not have to know the command's shape. */
function toggle(control: 'shadows' | 'labels' | 'plane'): void {
  props.send({ type: 'toggle', control })
}

/**
 * Arrow keys move between the buttons of a switch, which is what a group of mutually exclusive
 * choices is expected to do. Every button stays focusable rather than using a roving tabindex: there
 * are only two of them, and a simpler contract is worth more here than saving one tab stop.
 */
function moveFocus(event: KeyboardEvent, index: number, count: number): void {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft'
    && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
  const target = (index + step + count) % count
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button')
  buttons?.[target]?.focus()
}

// ------------------------------------------------------------------ formatting

function formatDate(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

function formatDateTime(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  return new Intl.DateTimeFormat(locale.value, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}

function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale.value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatKilometres(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(value)} km`
}

function formatDegrees(value: number, digits = 3): string {
  return `${formatNumber(value, digits)}°`
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100, 0)}%`
}

function formatLatLon(latitude: number, longitude: number): string {
  const north = latitude >= 0 ? 'N' : 'S'
  const east = longitude >= 0 ? 'E' : 'W'
  return `${formatNumber(Math.abs(latitude), 1)}°${north} ${formatNumber(Math.abs(longitude), 1)}°${east}`
}

// ------------------------------------------------------------------ timeline

const scrubStep = computed(() => Math.max(1000, Math.round((props.state.windowEndMs - props.state.windowStartMs) / 1200)))

/** Where a band sits on the scrubber, as a percentage of the window. */
function bandStyle(band: EclipsePhaseBand): Record<string, string> {
  const span = Math.max(1, props.state.windowEndMs - props.state.windowStartMs)
  const left = ((band.startMs - props.state.windowStartMs) / span) * 100
  const width = ((band.endMs - band.startMs) / span) * 100
  return {
    left: `${Math.max(0, Math.min(100, left))}%`,
    width: `${Math.max(0.4, Math.min(100, width))}%`,
  }
}

const peakStyle = computed<Record<string, string>>(() => {
  const span = Math.max(1, props.state.windowEndMs - props.state.windowStartMs)
  const left = ((props.state.peakMs - props.state.windowStartMs) / span) * 100
  return { left: `${Math.max(0, Math.min(100, left))}%` }
})

// ------------------------------------------------------------------ observer sky

const SKY_HALF = 150
const SKY_MARGIN = 22

/**
 * Degrees to SVG units.
 *
 * The scale is set by whatever has to fit: for the solar section that is the Sun's disc plus however
 * far the Moon has drifted from it, and for the lunar section it is the penumbra. Either way the
 * discs are drawn at their real angular sizes and their real separation, so the overlap the viewer
 * sees is the overlap the sky would give them.
 */
const skyScale = computed(() => {
  const state = props.state
  const extent = isSolar.value
    // Leave room for the corona, with a stable scale through the inner phases.
    ? Math.max(0.55, state.separationDeg + state.moonAngularRadiusDeg)
    : Math.max(state.penumbraAngularRadiusDeg, state.separationDeg + state.moonAngularRadiusDeg)
  return (SKY_HALF - SKY_MARGIN) / Math.max(0.05, extent)
})

const sunRadius = computed(() => props.state.sunAngularRadiusDeg * skyScale.value)
// The photographed lunar limb is about 623 pixels from the centre of NASA's 2709px square.
// The derived 1024px corona texture preserves that relationship, so its rim tracks the live Sun.
const coronaSize = computed(() => sunRadius.value * (1024 / 235))
const coronaOpacity = computed(() => isSolar.value
  ? Math.max(0, Math.min(1, (props.state.obscuration - 0.94) / 0.06))
  : 0)

const moonCentre = computed(() => ({
  x: SKY_HALF + props.state.skyOffsetDeg.x * skyScale.value,
  // SVG y grows downwards, so a positive sky offset - up - has to come out as a smaller y.
  y: SKY_HALF - props.state.skyOffsetDeg.y * skyScale.value,
}))

const skyAriaKey = computed(() => (isSolar.value ? ECLIPSE_KEYS.solarSkyAria : ECLIPSE_KEYS.lunarSkyAria))

const moonRadius = computed(() => props.state.moonAngularRadiusDeg * skyScale.value)
const solarGuideRadius = computed(() => sunRadius.value + 7)
const lunarGuideRadius = computed(() => moonRadius.value + 6)
const solarGuideLength = computed(() => 2 * Math.PI * solarGuideRadius.value)
const lunarGuideLength = computed(() => 2 * Math.PI * lunarGuideRadius.value)
const guideGlow = computed(() => 0.35 + 0.45 * Math.sin(Math.PI * props.state.guideProgress))
const observerAssetBase = `${import.meta.env.BASE_URL}demos/eclipse/`
function chooseEvent(index: number): void {
  props.send({ type: 'event', index })
  if (eventPicker.value) eventPicker.value.open = false
}

/**
 * The label explanations, as a list rather than as tooltips.
 *
 * Ordered by what a reader needs first - the three bodies, then the parts of a shadow, then the
 * planes and their nodes, then the two markers - rather than by the order the scene happens to
 * publish its labels in, which is a detail of how the scene is built.
 */
const GLOSSARY_ORDER = [
  'sun', 'moon', 'earth',
  'umbra', 'penumbra', 'antumbra',
  'eclipticPlane', 'lunarPlane', 'ascendingNode', 'descendingNode',
  'peak', 'observer',
] as const

const glossary = computed(() => GLOSSARY_ORDER
  .map((id) => ECLIPSE_LABELS[id])
  .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined))

const readings = computed(() => {  const state = props.state
  const rows: { key: string, value: string }[] = []
  if (isSolar.value) {
    rows.push({ key: ECLIPSE_KEYS.readingSeparation, value: formatDegrees(state.separationDeg) })
    rows.push({ key: ECLIPSE_KEYS.readingSunDiameter, value: formatDegrees(state.sunAngularRadiusDeg * 2) })
    rows.push({ key: ECLIPSE_KEYS.readingMoonDiameter, value: formatDegrees(state.moonAngularRadiusDeg * 2) })
    rows.push({ key: ECLIPSE_KEYS.readingObscuration, value: formatPercent(state.obscuration) })
    rows.push({ key: ECLIPSE_KEYS.readingSunAltitude, value: formatDegrees(state.sunAltitudeDeg, 1) })
  } else {
    rows.push({ key: ECLIPSE_KEYS.readingUmbraCoverage, value: formatPercent(state.umbraCoverage) })
    rows.push({ key: ECLIPSE_KEYS.readingSeparation, value: formatDegrees(state.separationDeg) })
    rows.push({ key: ECLIPSE_KEYS.readingUmbraAngular, value: formatDegrees(state.umbraAngularRadiusDeg) })
    rows.push({ key: ECLIPSE_KEYS.readingPenumbraAngular, value: formatDegrees(state.penumbraAngularRadiusDeg) })
    rows.push({ key: ECLIPSE_KEYS.readingMoonDiameter, value: formatDegrees(state.moonAngularRadiusDeg * 2) })
  }
  rows.push({ key: ECLIPSE_KEYS.readingUmbraLength, value: formatKilometres(state.umbraLengthKm) })
  // A negative signed umbra radius means the cone has already closed before reaching the target.
  // The physical region there is the antumbra, whose radius is the magnitude of that value.
  rows.push(state.umbraRadiusAtTargetKm < 0
    ? { key: ECLIPSE_KEYS.readingAntumbraRadius, value: formatKilometres(-state.umbraRadiusAtTargetKm) }
    : { key: ECLIPSE_KEYS.readingUmbraRadius, value: formatKilometres(state.umbraRadiusAtTargetKm) })
  rows.push({ key: ECLIPSE_KEYS.readingPenumbraRadius, value: formatKilometres(state.penumbraRadiusAtTargetKm) })
  rows.push({ key: ECLIPSE_KEYS.readingCasterDistance, value: formatKilometres(state.casterToTargetKm) })
  rows.push({ key: ECLIPSE_KEYS.readingInclination, value: formatDegrees(state.inclinationDeg, 2) })
  rows.push({ key: ECLIPSE_KEYS.readingNode, value: formatDegrees(state.nodeLongitudeDeg, 1) })
  rows.push({ key: ECLIPSE_KEYS.readingMoonLatitude, value: formatDegrees(state.moonEclipticLatitudeDeg, 2) })
  return rows
})
</script>

<template>
  <div v-if="ready" class="eclipse-panel" :class="{ 'is-guided': guided }">
    <!-- The observer's sky. It covers the stage because it *is* the view, but it leaves the shell's
         top bar and transport bar alone: those live outside the stage and paint above it. -->
    <div v-if="isObserver" class="eclipse-sky">
      <figure class="sky-figure">
        <svg
          class="sky-canvas"
          viewBox="0 0 300 300"
          role="img"
          :aria-label="t(skyAriaKey)"
        >
          <defs>
            <radialGradient id="eclipse-sun-disc">
              <stop offset="0%" stop-color="#fff9e5" />
              <stop offset="75%" stop-color="#fff2c8" />
              <stop offset="100%" stop-color="#e8b978" />
            </radialGradient>
            <radialGradient id="eclipse-penumbra-shade">
              <stop offset="0%" stop-color="#192036" stop-opacity=".6" />
              <stop offset="78%" stop-color="#25304b" stop-opacity=".4" />
              <stop offset="100%" stop-color="#25304b" stop-opacity=".07" />
            </radialGradient>
            <clipPath id="eclipse-moon-clip">
              <circle :cx="moonCentre.x" :cy="moonCentre.y" :r="moonRadius" />
            </clipPath>
            <clipPath id="eclipse-sky-clip">
              <circle cx="150" cy="150" r="148" />
            </clipPath>
          </defs>
          <circle cx="150" cy="150" r="148" class="sky-backdrop" />
          <template v-if="!isSolar">
            <circle cx="150" cy="150" :r="state.penumbraAngularRadiusDeg * skyScale" class="sky-penumbra">
              <title>{{ t(ECLIPSE_KEYS.skyPenumbra) }}</title>
            </circle>
            <circle cx="150" cy="150" :r="Math.max(0, state.umbraAngularRadiusDeg) * skyScale" class="sky-umbra">
              <title>{{ t(ECLIPSE_KEYS.skyUmbra) }}</title>
            </circle>
          </template>
          <template v-else>
            <image
              v-if="coronaOpacity > 0"
              :href="`${observerAssetBase}corona-2024.webp`"
              :x="150 - coronaSize / 2"
              :y="150 - coronaSize / 2"
              :width="coronaSize"
              :height="coronaSize"
              :opacity="coronaOpacity"
              clip-path="url(#eclipse-sky-clip)"
              aria-hidden="true"
            />
            <circle cx="150" cy="150" :r="sunRadius" class="sky-sun">
              <title>{{ t(ECLIPSE_KEYS.skySun) }}</title>
            </circle>
          </template>
          <template v-if="isSolar">
            <circle :cx="moonCentre.x" :cy="moonCentre.y" :r="moonRadius" class="sky-moon sky-new-moon">
              <title>{{ t(ECLIPSE_KEYS.skyMoon) }}</title>
            </circle>
          </template>
          <template v-else>
            <g clip-path="url(#eclipse-moon-clip)">
              <image
                :href="`${observerAssetBase}moon-nearside.webp`"
                :x="moonCentre.x - moonRadius"
                :y="moonCentre.y - moonRadius"
                :width="moonRadius * 2"
                :height="moonRadius * 2"
                aria-hidden="true"
              />
              <circle cx="150" cy="150" :r="state.penumbraAngularRadiusDeg * skyScale" fill="url(#eclipse-penumbra-shade)" />
              <circle cx="150" cy="150" :r="Math.max(0, state.umbraAngularRadiusDeg) * skyScale" class="sky-umbra-on-moon" />
            </g>
            <circle :cx="moonCentre.x" :cy="moonCentre.y" :r="moonRadius" class="sky-moon sky-moon-outline">
              <title>{{ t(ECLIPSE_KEYS.skyMoon) }}</title>
            </circle>
          </template>
          <template v-if="!isSolar">
            <circle cx="150" cy="150" :r="Math.max(0, state.umbraAngularRadiusDeg) * skyScale" class="sky-umbra-edge" />
            <circle cx="150" cy="150" :r="state.penumbraAngularRadiusDeg * skyScale" class="sky-penumbra-edge" />
          </template>
          <g v-if="guided && state.guideCue === 'solar-partial'" class="sky-guide-effect" aria-hidden="true">
            <circle cx="150" cy="150" :r="solarGuideRadius" class="sky-guide-track" />
            <circle cx="150" cy="150" :r="solarGuideRadius" class="sky-guide-solar"
              :stroke-dasharray="`${solarGuideLength} ${solarGuideLength}`"
              :stroke-dashoffset="solarGuideLength * (1 - state.obscuration)"
              transform="rotate(-90 150 150)" />
            <circle :cx="moonCentre.x" :cy="moonCentre.y" :r="moonRadius + 2" class="sky-guide-limb" />
          </g>
          <circle v-if="guided && state.guideCue === 'solar-total'" cx="150" cy="150"
            :r="sunRadius + 5" class="sky-guide-total" :opacity="guideGlow" aria-hidden="true" />
          <g v-if="guided && state.guideCue === 'lunar-partial'" class="sky-guide-effect" aria-hidden="true">
            <circle :cx="moonCentre.x" :cy="moonCentre.y" :r="lunarGuideRadius" class="sky-guide-track" />
            <circle :cx="moonCentre.x" :cy="moonCentre.y" :r="lunarGuideRadius" class="sky-guide-lunar"
              :stroke-dasharray="`${lunarGuideLength} ${lunarGuideLength}`"
              :stroke-dashoffset="lunarGuideLength * (1 - state.umbraCoverage)"
              :transform="`rotate(-90 ${moonCentre.x} ${moonCentre.y})`" />
          </g>
          <circle v-if="guided && state.guideCue === 'lunar-total'" :cx="moonCentre.x" :cy="moonCentre.y"
            :r="moonRadius + 5" class="sky-guide-lunar-total" :opacity="guideGlow" aria-hidden="true" />
        </svg>
        <figcaption class="sky-caption">
          <span class="sky-kind">{{ t(ECLIPSE_KIND_KEYS[state.kind]) }}</span>
          <span class="sky-time">{{ formatDateTime(state.timeMs) }}</span>
        </figcaption>
      </figure>

      <p v-if="!guided && isSolar" class="sky-note" :class="{ warn: state.sunAltitudeDeg <= 0 }">
        {{ state.sunAltitudeDeg <= 0 ? t(ECLIPSE_KEYS.sunBelow) : `${t(ECLIPSE_KEYS.readingSunAltitude)} ${formatDegrees(state.sunAltitudeDeg, 1)}` }}
      </p>
      <p v-else-if="!guided && !isSolar" class="sky-note">{{ t(ECLIPSE_KEYS.lunarSkyNote) }}</p>
      <p v-if="!guided && isSolar" class="sky-note">{{ t(ECLIPSE_KEYS.solarSafetyNote) }}</p>
      <p v-if="!guided && state.kind === 'total'" class="sky-note">
        {{ t(isSolar ? ECLIPSE_KEYS.solarTotalityNote : ECLIPSE_KEYS.lunarTotalityNote) }}
      </p>
      <p v-if="!guided" class="sky-image-credit">{{ t(isSolar ? ECLIPSE_KEYS.solarImageCredit : ECLIPSE_KEYS.lunarImageCredit) }}</p>
    </div>

    <section v-if="!guided" class="eclipse-card" :class="{ collapsed }" :aria-label="t(ECLIPSE_KEYS.panelTitle)">
      <header class="card-head">
        <h2>{{ t(ECLIPSE_KEYS.panelTitle) }}</h2>
        <button
          type="button"
          class="card-collapse"
          :aria-expanded="!collapsed"
          :aria-label="t(collapsed ? ECLIPSE_KEYS.expand : ECLIPSE_KEYS.collapse)"
          @click="collapsed = !collapsed"
        >
          <ChevronDown :size="16" aria-hidden="true" />
        </button>
      </header>

      <div v-show="!collapsed" class="card-body">
        <p class="row-label">{{ t(ECLIPSE_KEYS.section) }}</p>
        <div class="switch" role="group" :aria-label="t(ECLIPSE_KEYS.section)">
          <button
            v-for="(section, index) in SECTIONS"
            :key="section"
            type="button"
            :aria-pressed="state.section === section"
            :class="{ active: state.section === section }"
            @click="send({ type: 'section', section })"
            @keydown="moveFocus($event, index, SECTIONS.length)"
          >
            {{ t(ECLIPSE_SECTION_KEYS[section]) }}
          </button>
        </div>

        <div class="switch" role="group" :aria-label="t(ECLIPSE_KEYS.view)">
          <button
            v-for="(view, index) in VIEWS"
            :key="view"
            type="button"
            :aria-pressed="state.view === view"
            :class="{ active: state.view === view }"
            @click="send({ type: 'view', view })"
            @keydown="moveFocus($event, index, VIEWS.length)"
          >
            {{ t(ECLIPSE_VIEW_KEYS[view]) }}
          </button>
        </div>

        <p class="note scale-note">{{ t(ECLIPSE_KEYS.scaleNote) }}</p>

        <details ref="eventPicker" class="event-picker">
          <summary>
            <span>{{ t(ECLIPSE_KEYS.events) }}</span>
            <span v-if="state.events[state.selectedEventIndex]" class="selected-event">
              {{ formatDate(state.events[state.selectedEventIndex]!.peakMs) }} · {{ t(ECLIPSE_KIND_KEYS[state.events[state.selectedEventIndex]!.kind]) }}
            </span>
          </summary>
          <ul class="event-list" role="list">
            <li v-for="(event, index) in state.events" :key="`${event.peakMs}`">
              <button
                type="button"
                :aria-pressed="state.selectedEventIndex === index"
                :class="{ active: state.selectedEventIndex === index }"
                @click="chooseEvent(index)"
              >
                <span class="event-date">{{ formatDate(event.peakMs) }}</span>
                <span class="event-kind">{{ t(ECLIPSE_KIND_KEYS[event.kind]) }}</span>
              </button>
            </li>
          </ul>
        </details>

        <p class="row-label">{{ t(ECLIPSE_KEYS.time) }}</p>
        <div class="scrub">
          <div class="scrub-bands" aria-hidden="true">
            <span
              v-for="band in state.phaseBands"
              :key="`${band.kind}-${band.startMs}`"
              class="scrub-band"
              :class="`band-${band.kind}`"
              :style="bandStyle(band)"
            />
            <span class="scrub-peak" :style="peakStyle" />
          </div>
          <input
            type="range"
            class="scrub-input"
            :min="state.windowStartMs"
            :max="state.windowEndMs"
            :step="scrubStep"
            :value="state.timeMs"
            :aria-label="t(ECLIPSE_KEYS.scrubAria)"
            @input="send({ type: 'scrub', timeMs: Number(($event.target as HTMLInputElement).value) })"
          >
        </div>
        <p class="time-readout">
          <span>{{ formatDateTime(state.timeMs) }}</span>
          <span class="kind">{{ t(ECLIPSE_KIND_KEYS[state.kind]) }}</span>
        </p>
        <!-- The bands are only useful if the colours mean something, so they are named. -->
        <p class="legend" :aria-label="t(ECLIPSE_KEYS.legendAria)">
          <span v-for="band in state.phaseBands" :key="band.kind" class="legend-item">
            <i class="legend-swatch" :class="`band-${band.kind}`" aria-hidden="true" />
            {{ t(ECLIPSE_KIND_KEYS[band.kind]) }}
          </span>
        </p>
        <div class="presets">
          <button type="button" class="preset" @click="send({ type: 'scrub-to-peak' })">
            {{ t(ECLIPSE_KEYS.presetGreatest) }}
          </button>
        </div>

        <template v-if="isSolar">
          <p class="row-label">{{ t(ECLIPSE_KEYS.observer) }}</p>
          <label class="slider">
            <span>{{ t(ECLIPSE_KEYS.offsetLat) }}</span>
            <input
              type="range"
              :min="-SCENE.observerOffsetLimitDeg"
              :max="SCENE.observerOffsetLimitDeg"
              :step="SCENE.observerOffsetStepDeg"
              :value="state.observerOffsetLatDeg"
              @input="send({
                type: 'observer',
                latitudeOffsetDeg: Number(($event.target as HTMLInputElement).value),
                longitudeOffsetDeg: state.observerOffsetLonDeg,
              })"
            >
            <output>{{ formatDegrees(state.observerOffsetLatDeg, 1) }}</output>
          </label>
          <label class="slider">
            <span>{{ t(ECLIPSE_KEYS.offsetLon) }}</span>
            <input
              type="range"
              :min="-SCENE.observerOffsetLimitDeg"
              :max="SCENE.observerOffsetLimitDeg"
              :step="SCENE.observerOffsetStepDeg"
              :value="state.observerOffsetLonDeg"
              @input="send({
                type: 'observer',
                latitudeOffsetDeg: state.observerOffsetLatDeg,
                longitudeOffsetDeg: Number(($event.target as HTMLInputElement).value),
              })"
            >
            <output>{{ formatDegrees(state.observerOffsetLonDeg, 1) }}</output>
          </label>
          <p v-if="state.peakLatitudeDeg !== null && state.peakLongitudeDeg !== null" class="note">
            {{ t(ECLIPSE_KEYS.peakPoint) }} {{ formatLatLon(state.peakLatitudeDeg, state.peakLongitudeDeg) }}
          </p>
          <!-- A partial eclipse is a property of where you stand, not of the event, so it cannot be
               an entry in the event list. These two put the observer where one is visible. -->
          <div class="presets">
            <button type="button" class="preset" @click="send({ type: 'observer-preset', preset: 'central' })">
              {{ t(ECLIPSE_KEYS.presetCentral) }}
            </button>
            <button type="button" class="preset" @click="send({ type: 'observer-preset', preset: 'off-path' })">
              {{ t(ECLIPSE_KEYS.presetOffPath) }}
            </button>
          </div>
        </template>

        <p class="row-label">{{ t(ECLIPSE_KEYS.display) }}</p>
        <div class="toggles">
          <label>
            <input type="checkbox" :checked="state.showShadows" @change="toggle('shadows')">
            <span>{{ t(ECLIPSE_KEYS.shadows) }}</span>
          </label>
          <label>
            <input type="checkbox" :checked="state.showLabels" @change="toggle('labels')">
            <span>{{ t(ECLIPSE_KEYS.labels) }}</span>
          </label>
          <label>
            <input type="checkbox" :checked="state.showPlane" @change="toggle('plane')">
            <span>{{ t(ECLIPSE_KEYS.plane) }}</span>
          </label>
        </div>

        <label class="teaching">
          <input
            type="checkbox"
            :checked="state.teachingZeroInclination"
            @change="send({ type: 'teaching', enabled: ($event.target as HTMLInputElement).checked })"
          >
          <span>{{ t(ECLIPSE_KEYS.teaching) }}</span>
        </label>
        <p v-if="state.teachingZeroInclination" class="note warn">{{ t(ECLIPSE_KEYS.teachingNote) }}</p>

        <p class="row-label">{{ t(ECLIPSE_KEYS.readings) }}</p>
        <dl class="readings">
          <template v-for="row in readings" :key="row.key">
            <dt>{{ t(row.key) }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>

        <!--
          The same explanations the labels show on hover, as text. A hover tooltip is a pointer-only
          affordance, and these are the one part of the demo that is plain prose - leaving them
          reachable only with a mouse would be a strange thing to do to the only accessible part.
          A native <details> gets the keyboard behaviour and the expanded state for free.
        -->
        <details class="glossary">
          <summary>{{ t(ECLIPSE_KEYS.glossary) }}</summary>
          <dl>
            <template v-for="entry in glossary" :key="entry.textKey">
              <dt>{{ t(entry.textKey) }}</dt>
              <dd>{{ t(entry.descriptionKey) }}</dd>
            </template>
          </dl>
        </details>
      </div>
    </section>
  </div>
</template>

<style scoped>
.eclipse-panel {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.eclipse-card,
.sky-figure {
  pointer-events: auto;
}

.eclipse-card {
  position: absolute;
  top: var(--demo-panels-top, 100px);
  left: clamp(12px, 2vw, 22px);
  display: flex;
  flex-direction: column;
  width: min(292px, 82vw);
  max-height: min(640px, calc(100% - var(--demo-panels-top, 100px) - 90px));
  border: 1px solid rgb(60 84 110 / 65%);
  border-radius: 8px;
  background: rgb(6 14 26 / 82%);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.eclipse-card.collapsed { width: auto; }

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  padding: .5rem .5rem .5rem .7rem;
  border-bottom: 1px solid rgb(60 84 110 / 45%);
}

.card-head h2 {
  margin: 0;
  color: #eaf2ff;
  font-size: .86rem;
  font-weight: 600;
  letter-spacing: .04em;
}

.card-collapse {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 4px;
  color: #8fa4bd;
  background: transparent;
  cursor: pointer;
}

.card-collapse:hover { color: #eaf2ff; background: rgb(60 84 110 / 45%); }
.eclipse-card.collapsed .card-collapse { transform: rotate(-90deg); }

.card-body {
  padding: .55rem .6rem .75rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.row-label {
  margin: .6rem 0 .28rem;
  color: #72d4d8;
  font-size: .66rem;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.row-label:first-child { margin-top: 0; }

.switch {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: .3rem;
  margin-bottom: .35rem;
}

.switch button {
  min-height: 34px;
  border: 1px solid #35516e;
  border-radius: 5px;
  color: #9fb4cf;
  font-size: .8rem;
  background: transparent;
  cursor: pointer;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}

.switch button:hover { color: #eaf2ff; border-color: #72d4d8; }

.switch button.active {
  border-color: #72d4d8;
  color: #07111f;
  font-weight: 600;
  background: #72d4d8;
}

.note {
  margin: .3rem 0 .1rem;
  color: #8fa4bd;
  font-size: .7rem;
  line-height: 1.45;
}

.note.warn {
  padding: .34rem .42rem;
  border-left: 2px solid #ffb457;
  color: #e6c79a;
  background: rgb(53 38 20 / 55%);
}

.scale-note {
  padding: .3rem .42rem;
  border-left: 2px solid #72d4d8;
  color: #a9c6cd;
  background: rgb(17 40 48 / 55%);
}

.event-list {
  display: grid;
  gap: .22rem;
  max-height: 132px;
  margin: 0 0 .2rem;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.event-picker {
  margin: .55rem 0 .3rem;
  border-top: 1px solid #35516e;
  border-bottom: 1px solid #35516e;
  padding: .35rem 0 .2rem;
}

.event-picker summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .15rem .45rem;
  color: #72d4d8;
  font-size: .72rem;
  cursor: pointer;
}

.selected-event { color: #c8d6e7; font-variant-numeric: tabular-nums; }
.event-picker .event-list { margin-top: .4rem; }

.event-list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .4rem;
  width: 100%;
  min-height: 28px;
  padding: 0 .45rem;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #c3d3e6;
  font-size: .74rem;
  background: rgb(255 255 255 / 3%);
  cursor: pointer;
}

.event-list button:hover { background: rgb(60 84 110 / 38%); color: #eaf2ff; }
.event-list button.active { border-color: #72d4d8; color: #8fe3e6; background: rgb(114 212 216 / 16%); }
.event-date { font-variant-numeric: tabular-nums; }
.event-kind { color: #9fb4cf; font-size: .7rem; }
.event-list button.active .event-kind { color: #8fe3e6; }

.scrub { position: relative; padding: .1rem 0 .1rem; }

.scrub-bands {
  position: relative;
  height: 8px;
  margin: 0 4px 4px;
  border-radius: 3px;
  background: rgb(255 255 255 / 6%);
}

.scrub-band {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 2px;
  opacity: .55;
}

.band-penumbral { background: #6f8fb4; }
.band-partial { background: #c8a04a; }
.band-total { background: #b4522a; }
.band-annular { background: #d8a75c; }

.scrub-peak {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 12px;
  background: #8fe3e6;
  transform: translateX(-1px);
}

.scrub-input { width: 100%; accent-color: #72d4d8; }

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: .2rem .6rem;
  margin: .1rem 0 .25rem;
  color: #8fa4bd;
  font-size: .68rem;
}

.legend-item { display: inline-flex; align-items: center; gap: .24rem; }

.legend-swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  opacity: .75;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: .28rem;
  margin: .2rem 0 .1rem;
}

.preset {
  min-height: 28px;
  padding: 0 .5rem;
  border: 1px solid #35516e;
  border-radius: 4px;
  color: #c2d8e9;
  font-size: .7rem;
  background: transparent;
  cursor: pointer;
}

.preset:hover { color: #07111f; background: #72d4d8; border-color: #72d4d8; }

.glossary {
  margin: .55rem 0 .1rem;
  border-top: 1px solid #1c2d43;
  padding-top: .45rem;
}

.glossary summary {
  color: #8fa4bd;
  font-size: .7rem;
  letter-spacing: .06em;
  cursor: pointer;
}

.glossary summary:hover { color: #72d4d8; }

.glossary dl { margin: .45rem 0 0; }

.glossary dt {
  margin-top: .45rem;
  color: #c2d8e9;
  font-size: .72rem;
  font-weight: 600;
}

.glossary dd {
  margin: .12rem 0 0;
  color: #8fa4bd;
  font-size: .7rem;
  line-height: 1.5;
}

.time-readout {
  display: flex;
  justify-content: space-between;
  gap: .4rem;
  margin: .1rem 0 .2rem;
  color: #b9c9dd;
  font-size: .72rem;
  font-variant-numeric: tabular-nums;
}

.time-readout .kind { color: #8fe3e6; }

.slider {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: .2rem .4rem;
  margin-bottom: .3rem;
  color: #9fb4cf;
  font-size: .72rem;
}

.slider input { grid-column: 1 / -1; width: 100%; accent-color: #72d4d8; }
.slider output { color: #c8d6e7; font-variant-numeric: tabular-nums; }

.toggles {
  display: flex;
  flex-wrap: wrap;
  gap: .3rem .6rem;
  margin-bottom: .3rem;
}

.toggles label,
.teaching {
  display: inline-flex;
  align-items: center;
  gap: .32rem;
  color: #c8d6e7;
  font-size: .74rem;
  cursor: pointer;
}

.toggles input,
.teaching input { accent-color: #72d4d8; }
.teaching { margin-top: .15rem; }

.readings {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: .16rem .5rem;
  margin: 0;
  font-size: .72rem;
}

.readings dt { color: #8fa4bd; }
.readings dd {
  margin: 0;
  color: #dce8f6;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.eclipse-sky {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: .5rem;
  padding: clamp(72px, 13vh, 116px) 1rem clamp(84px, 15vh, 120px);
  background: radial-gradient(circle at 50% 46%, #060c18 0%, #03060d 72%);
}

.eclipse-panel.is-guided .eclipse-sky { padding-bottom: 170px; }

.sky-figure { margin: 0; display: grid; justify-items: center; gap: .35rem; }

.sky-canvas {
  width: min(52vh, 78vw, 420px);
  height: auto;
  aspect-ratio: 1;
}

.sky-backdrop { fill: #050a14; stroke: rgb(60 84 110 / 50%); stroke-width: 1; }
.sky-sun { fill: url(#eclipse-sun-disc); }
.sky-penumbra { fill: rgb(134 176 224 / 14%); }
.sky-umbra { fill: rgb(24 36 60 / 88%); }
.sky-penumbra-edge { fill: none; stroke: rgb(134 176 224 / 55%); stroke-width: 1; stroke-dasharray: 4 4; }
.sky-umbra-edge { fill: none; stroke: #7ea6dd; stroke-width: 1.6; }
.sky-moon { stroke: #7d8798; stroke-width: 1; }
.sky-new-moon { fill: #060910; }
.sky-moon-outline { fill: none; stroke: rgb(215 223 232 / 45%); stroke-width: .7; }
.sky-umbra-on-moon { fill: rgb(104 30 21 / 80%); }
.sky-guide-track { fill: none; stroke: rgb(190 211 224 / 35%); stroke-width: 1.4; }
.sky-guide-solar, .sky-guide-lunar { fill: none; stroke-width: 3; stroke-linecap: round; }
.sky-guide-solar { stroke: #8fe3e6; }
.sky-guide-lunar { stroke: #dc9872; }
.sky-guide-limb { fill: none; stroke: rgb(143 227 230 / 65%); stroke-width: 1; }
.sky-guide-total { fill: none; stroke: #d4eff1; stroke-width: 1.6; }
.sky-guide-lunar-total { fill: none; stroke: #e9a67c; stroke-width: 2; }

.sky-caption {
  display: flex;
  gap: .6rem;
  align-items: baseline;
  color: #b9c9dd;
  font-size: .76rem;
  font-variant-numeric: tabular-nums;
}

.sky-kind { color: #8fe3e6; font-weight: 600; }

.sky-note {
  max-width: min(560px, 84vw);
  margin: 0;
  color: #8fa4bd;
  font-size: .72rem;
  line-height: 1.5;
  text-align: center;
}

.sky-note.warn { color: #e6c79a; }

.sky-image-credit {
  max-width: min(560px, 84vw);
  margin: 0;
  color: #71859f;
  font-size: .64rem;
  line-height: 1.35;
  text-align: center;
}

.eclipse-card button:focus-visible,
.eclipse-card input:focus-visible { outline: 2px solid #8ee7e9; outline-offset: 2px; }

@media (max-width: 900px) {
  .eclipse-card {
    top: auto;
    bottom: 72px;
    max-height: min(46vh, calc(100% - var(--demo-panels-top, 100px) - 84px));
    width: min(280px, 88vw);
  }

  .eclipse-sky { padding: clamp(64px, 12vh, 100px) .5rem 150px; }
  .sky-canvas { width: min(42vh, 82vw); }
}
</style>
