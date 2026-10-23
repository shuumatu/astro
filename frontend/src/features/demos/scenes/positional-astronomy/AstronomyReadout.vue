<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { angles, equatorialToEcliptic, equatorialToGalactic, spherical, type AstronomyState } from './model'
import { dailyAltitudeCurve, getAstronomyInsights } from './insights'

const props = defineProps<{ state: AstronomyState; send: (command: { type: string; value?: unknown }) => void }>()
const { t, locale } = useI18n()
const prefix = 'demos.items.positionalAstronomy.insights.'
const label = (key: string) => t(prefix + key)
const timeId = useId()
const readings = computed(() => getAstronomyInsights(props.state))
const isEarthHorizon = computed(() => props.state.chapter === 'horizon' && props.state.perspective === 'earth')
const isFrame = computed(() => ['equatorial', 'ecliptic', 'galactic'].includes(props.state.chapter))
const frame = computed(() => {
  if (props.state.chapter === 'equatorial') return { lon: props.state.ra, lat: props.state.dec, longitude: 'ra', latitude: 'dec', unit: 'h' }
  const galactic = props.state.chapter === 'galactic'
  const value = angles((galactic ? equatorialToGalactic : equatorialToEcliptic)(spherical(props.state.ra * 15, props.state.dec)))
  return { ...value, longitude: galactic ? 'galacticLongitude' : 'eclipticLongitude', latitude: galactic ? 'galacticLatitude' : 'eclipticLatitude', unit: '°' }
})
const showFrame = computed(() => props.state.perspective === 'earth' && isFrame.value)
const poleLabel = computed(() => props.state.latitude === 0 ? 'equatorPoles' : props.state.latitude > 0 ? 'northPole' : 'southPole')
const rounded = (value: number, digits = 1) => (Math.abs(value) < .5 * 10 ** -digits ? 0 : value).toFixed(digits)
const signed = (value: number) => (value > .05 ? '+' : '') + rounded(value)
const yearText = computed(() => new Intl.NumberFormat(locale.value).format(Math.round(props.state.years)))

const chart = { left: 30, right: 302, top: 13, bottom: 123, width: 316, height: 147 }
const plotX = (lst: number) => chart.left + Math.min(24, Math.max(0, lst)) / 24 * (chart.right - chart.left)
const plotY = (altitude: number) => chart.top + (90 - altitude) / 180 * (chart.bottom - chart.top)
const curvePath = computed(() => dailyAltitudeCurve(props.state.ra, props.state.dec, props.state.latitude).map((point, i) => `${i ? 'L' : 'M'}${plotX(point.lst).toFixed(2)},${plotY(point.altitude).toFixed(2)}`).join(' '))
const activePoint = computed(() => ({ x: plotX(props.state.lst), y: plotY(readings.value.altitude) }))
const transits = computed(() => [
  { key: 'upperTransit', lst: readings.value.upperTransit, altitude: readings.value.upperAltitude },
  { key: 'lowerTransit', lst: readings.value.lowerTransit, altitude: readings.value.lowerAltitude },
])

// Pause once per manual interaction even when a controlled parent updates on the next tick.
const pauseRequested = ref(false)
watch(() => props.state.playing, playing => { if (!playing) pauseRequested.value = false })
function pause() {
  if (props.state.playing && !pauseRequested.value) {
    pauseRequested.value = true
    props.send({ type: 'playing' })
  }
}
function chooseTime(value: number) {
  pause()
  props.send({ type: 'lst', value: Math.round(Math.min(24, Math.max(0, value)) * 100) / 100 })
}
function chooseYear(value: number) {
  pause()
  props.send({ type: 'years', value })
}

let drag: { id: number; x: number; y: number; scrubbing: boolean; cancelled: boolean } | null = null
function timeAtPointer(event: PointerEvent) {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
  if (!rect.width) return
  const x = (event.clientX - rect.left) / rect.width * chart.width
  chooseTime((x - chart.left) / (chart.right - chart.left) * 24)
}
function pointerDown(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, scrubbing: event.pointerType !== 'touch', cancelled: false }
  ;(event.currentTarget as SVGSVGElement).setPointerCapture?.(event.pointerId)
  if (drag.scrubbing) timeAtPointer(event)
}
function pointerMove(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId || drag.cancelled) return
  if (!drag.scrubbing) {
    const dx = Math.abs(event.clientX - drag.x), dy = Math.abs(event.clientY - drag.y)
    // A vertical touch gesture belongs to the scrolling controls, not the chart.
    if (dy > 6 && dy > dx) { drag.cancelled = true; return }
    if (dx <= 6 || dx <= dy) return
    drag.scrubbing = true
  }
  timeAtPointer(event)
}
function pointerUp(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  if (!drag.cancelled) timeAtPointer(event)
  drag = null
}
</script>

<template>
  <section class="astronomy-readout" :aria-label="label('title')" @keydown.stop>
    <header class="readout-heading"><h3>{{ label('title') }}</h3><span class="sync-state"><i aria-hidden="true" />{{ label('live') }}</span></header>

    <template v-if="state.chapter === 'precession'">
      <div class="metric-pair">
        <div class="metric"><span>{{ label('elapsedYears') }}</span><strong>{{ yearText }}<small>{{ label('yearsUnit') }}</small></strong></div>
        <div class="metric accent"><span>{{ label('cycleProgress') }}</span><strong>{{ rounded(readings.precessionProgress * 100, 0) }}<small>%</small></strong></div>
      </div>
      <div class="cycle-track" role="progressbar" :aria-label="label('cycleProgress')" :aria-valuenow="Math.round(readings.precessionProgress * 100)" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${readings.precessionProgress * 100}%` }" /></div>
      <div class="cycle-stops">
        <button v-for="(key, index) in ['initial', 'halfCycle', 'fullCycle']" :key="key" :aria-label="t(prefix + 'yearAction', { years: index * 13000 })" :class="{ current: state.years === index * 13000 }" @click="chooseYear(index * 13000)">{{ label(key) }}</button>
      </div>
      <p class="readout-note">{{ label('precessionCycle') }}</p>
      <p class="readout-footnote">{{ label('precessionNote') }}</p>
    </template>

    <template v-else>
      <div v-if="isEarthHorizon" class="metric-pair">
        <div class="metric"><span>{{ label('latitude') }}</span><strong>{{ signed(state.latitude) }}<small>°</small></strong></div>
        <div class="metric accent"><span>{{ label('poleAltitude') }}</span><strong>{{ rounded(readings.poleAltitude) }}<small>°</small></strong></div>
      </div>
      <div v-else-if="showFrame" class="metric-pair">
        <div class="metric"><span>{{ label(frame.longitude) }}</span><strong>{{ rounded(frame.lon) }}<small>{{ frame.unit }}</small></strong></div>
        <div class="metric accent"><span>{{ label(frame.latitude) }}</span><strong>{{ signed(frame.lat) }}<small>°</small></strong></div>
      </div>
      <div v-else class="metric-pair">
        <div class="metric accent"><span>{{ label('altitude') }}</span><strong>{{ signed(readings.altitude) }}<small>°</small></strong></div>
        <div class="metric"><span>{{ label('azimuth') }}</span><strong>{{ readings.azimuth === null ? '—' : rounded(readings.azimuth) }}<small v-if="readings.azimuth !== null">°</small></strong></div>
      </div>

      <p v-if="isEarthHorizon" class="readout-note"><i class="status-dot" aria-hidden="true" />{{ label(poleLabel) }}</p>
      <p v-else-if="showFrame" class="readout-note">{{ label('sameTarget') }}</p>
      <div v-else class="horizon-state" :class="readings.horizonStatus">
        <span><i class="status-dot" aria-hidden="true" />{{ label(readings.horizonStatus) }}</span>
        <small v-if="state.chapter !== 'daily'">{{ label(readings.visibility) }}</small>
      </div>
      <p v-if="!isEarthHorizon && !showFrame && readings.azimuth === null" class="readout-footnote">{{ label('undefinedAzimuth') }}</p>
      <div v-if="isFrame && !showFrame" class="frame-values"><span>{{ label(frame.longitude) }} <b>{{ rounded(frame.lon) }}{{ frame.unit }}</b></span><span>{{ label(frame.latitude) }} <b>{{ signed(frame.lat) }}°</b></span></div>

      <div v-if="state.chapter === 'daily'" class="daily-chart">
        <div class="chart-heading"><h4>{{ label('curveTitle') }}</h4><span>{{ label(readings.visibility) }}</span></div>
        <svg class="altitude-chart" :viewBox="`0 0 ${chart.width} ${chart.height}`" role="img" :aria-label="label('curveLabel')" @pointerdown.stop="pointerDown" @pointermove.stop="pointerMove" @pointerup.stop="pointerUp" @pointercancel="drag = null" @lostpointercapture="drag = null">
          <title>{{ label('curveTitle') }}</title>
          <rect :x="chart.left" :y="chart.top" :width="chart.right - chart.left" :height="plotY(0) - chart.top" class="visible-sky" />
          <line v-for="altitude in [-90, 0, 90]" :key="altitude" :x1="chart.left" :x2="chart.right" :y1="plotY(altitude)" :y2="plotY(altitude)" :class="altitude === 0 ? 'horizon-line' : 'chart-grid'" />
          <template v-for="hour in [0, 6, 12, 18, 24]" :key="hour">
            <line :x1="plotX(hour)" :x2="plotX(hour)" :y1="chart.top" :y2="chart.bottom" class="chart-grid" />
            <text :x="plotX(hour)" y="140" text-anchor="middle">{{ hour }}h</text>
          </template>
          <text v-for="altitude in [-90, 0, 90]" :key="`label-${altitude}`" x="24" :y="plotY(altitude) + 3" text-anchor="end">{{ altitude }}°</text>
          <path :d="curvePath" class="altitude-path" />
          <line :x1="activePoint.x" :x2="activePoint.x" :y1="chart.top" :y2="chart.bottom" class="time-cursor" />
          <circle :cx="activePoint.x" :cy="activePoint.y" r="5.3" class="point-halo" />
          <circle :cx="activePoint.x" :cy="activePoint.y" r="3" class="current-point" />
        </svg>
        <p class="chart-hint">{{ label('curveHint') }}</p>
        <label class="time-control" :for="timeId"><span>{{ label('lst') }}</span><output>{{ rounded(state.lst, 2) }}<small>h</small></output></label>
        <input :id="timeId" class="time-range" type="range" min="0" max="24" step="0.05" :value="state.lst" :aria-label="label('timeSlider')" :aria-valuetext="t(prefix + 'timeValue', { time: rounded(state.lst, 2) })" @input="chooseTime(Number(($event.target as HTMLInputElement).value))" />
        <div class="transit-controls">
          <button v-for="transit in transits" :key="transit.key" :aria-label="t(prefix + 'transitAction', { label: label(transit.key), time: rounded(transit.lst, 2), altitude: rounded(transit.altitude) })" @click="chooseTime(transit.lst)"><span>{{ label(transit.key) }} <span aria-hidden="true">↗</span></span><strong>{{ rounded(transit.lst, 2) }}h <small>{{ signed(transit.altitude) }}°</small></strong></button>
        </div>
        <div class="daily-details"><span :title="label('hourAngleHelp')">{{ label('hourAngle') }} <b>{{ signed(readings.hourAngle) }}h</b></span><span>{{ t(prefix + 'visibleHours', { hours: rounded(readings.visibleHours) }) }}</span></div>
        <p class="readout-footnote">{{ label('siderealNote') }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.astronomy-readout{width:100%;min-width:0;box-sizing:border-box;padding:15px;border:1px solid var(--color-border);border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb, var(--color-surface-raised) 96%, transparent),color-mix(in srgb, var(--color-surface) 96%, transparent));color:var(--color-text);box-shadow:0 10px 32px var(--color-shadow);font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums;container-type:inline-size}
.readout-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.readout-heading h3{margin:0;color:var(--color-text);font-size:12px;font-weight:650;letter-spacing:.05em}
.sync-state{display:inline-flex;align-items:center;gap:6px;color:var(--color-text-muted);font-size:10px;white-space:nowrap}
.sync-state i,.status-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--color-success);flex-shrink:0}
.sync-state i{box-shadow:0 0 8px color-mix(in srgb, var(--color-success) 33%, transparent)}
.metric-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.metric{min-width:0;display:flex;flex-direction:column;gap:3px}
.metric>span{color:var(--color-text-muted);font-size:11px;overflow-wrap:anywhere}
.metric strong{font-size:27px;line-height:1.2;letter-spacing:-.035em;font-weight:550;white-space:nowrap}
.metric strong small{margin-left:4px;font-size:13px;font-weight:400;letter-spacing:0;color:var(--color-text-muted)}
.metric.accent strong{color:var(--color-success)}
.readout-note{display:flex;align-items:center;gap:7px;color:var(--color-text-muted);font-size:11px;margin:10px 0 0;line-height:1.6}
.readout-footnote{color:var(--color-text-muted);font-size:10px;line-height:1.6;margin:9px 0 0}
.horizon-state{display:flex;gap:6px 12px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-top:12px;color:var(--color-success);font-size:11px}
.horizon-state>span{display:flex;align-items:center;gap:7px}
.horizon-state small{color:var(--color-text-muted);font-size:10px}
.horizon-state.below{color:var(--color-warning)}.horizon-state.below .status-dot{background:var(--color-warning)}.horizon-state.on{color:var(--color-text)}.horizon-state.on .status-dot{background:var(--color-text)}
.frame-values{display:flex;flex-wrap:wrap;gap:5px 14px;border-top:1px solid var(--color-border);margin-top:10px;padding-top:9px;color:var(--color-text-muted);font-size:10px}
.frame-values b{color:var(--color-text);font-weight:500;margin-left:5px}
.daily-chart{margin-top:13px;border-top:1px solid var(--color-border);padding-top:12px}
.chart-heading{display:flex;flex-direction:column;gap:3px}
.chart-heading h4{margin:0;font-size:11px;font-weight:550;color:var(--color-text)}.chart-heading>span{font-size:10px;color:var(--color-text-muted)}
.altitude-chart{display:block;width:100%;height:auto;margin-top:8px;overflow:visible;cursor:ew-resize;touch-action:pan-y;user-select:none}
.altitude-chart text{fill:var(--color-text-muted);font-size:9px;pointer-events:none}
.visible-sky{fill:color-mix(in srgb, var(--color-success) 5%, transparent)}.chart-grid{stroke:var(--color-border);stroke-width:.8}.horizon-line{stroke:color-mix(in srgb, var(--color-success) 65%, transparent);stroke-dasharray:3 4;stroke-width:.9}
.altitude-path{stroke:var(--color-success);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}.time-cursor{stroke:color-mix(in srgb, var(--color-gold) 70%, transparent);stroke-width:1;stroke-dasharray:3 3}
.point-halo{fill:color-mix(in srgb, var(--color-gold) 18%, transparent)}.current-point{fill:var(--color-gold);stroke:var(--color-surface);stroke-width:1}
.chart-hint{font-size:10px;color:var(--color-text-muted);text-align:center;margin:3px 0 9px}
.time-control{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--color-text-muted);font-size:11px}.time-control output{color:var(--color-gold);font-size:13px}.time-control output small{font-size:10px;margin-left:3px}
.time-range{display:block;box-sizing:border-box;width:100%;height:24px;margin:0 0 8px;accent-color:var(--color-success);cursor:pointer;touch-action:pan-y}
.transit-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px}
.transit-controls button{min-width:0;text-align:left;border:1px solid var(--color-border);border-radius:8px;padding:7px 9px;color:var(--color-text-muted);background:var(--color-surface-raised);cursor:pointer;font:inherit;line-height:1.5;transition:background .15s,border-color .15s}
.transit-controls button>span{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px}.transit-controls button>span>span{color:var(--color-success)}
.transit-controls strong{display:flex;gap:5px 9px;flex-wrap:wrap;font-size:12px;font-weight:500;color:var(--color-text)}.transit-controls strong small{font-size:10px;color:var(--color-text-muted);font-weight:400;align-self:center}
.transit-controls button:hover,.cycle-stops button:hover{background:color-mix(in srgb, var(--color-success) 8%, transparent);border-color:color-mix(in srgb, var(--color-success) 40%, transparent)}
.daily-details{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;margin-top:10px;color:var(--color-text-muted);font-size:10px}.daily-details b{font-weight:500;color:var(--color-text);margin-left:3px}
.cycle-track{height:5px;margin-top:18px;overflow:hidden;border-radius:10px;background:var(--color-border)}.cycle-track span{height:100%;display:block;background:linear-gradient(90deg,var(--color-blue),var(--color-success));border-radius:inherit}
.cycle-stops{display:flex;justify-content:space-between;gap:4px;margin:7px -4px 0}.cycle-stops button{font:inherit;font-size:10px;color:var(--color-text-muted);cursor:pointer;border:1px solid transparent;border-radius:5px;padding:4px;background:none}.cycle-stops button.current{color:var(--color-success)}
button:focus-visible,input:focus-visible{outline:2px solid var(--color-success);outline-offset:3px}
@container (max-width: 245px){.metric strong{font-size:23px}.metric>span{font-size:10px}.metric-pair{gap:8px}.transit-controls button{padding:6px}.sync-state{font-size:9px}.readout-heading{gap:6px}.daily-details{flex-direction:column}}
@media(prefers-reduced-motion:reduce){.transit-controls button{transition:none}}
</style>
