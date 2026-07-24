<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SkyMapCanvas from '../features/sky-map/SkyMapCanvas.vue'
import {
  OBSERVATION_TIME_PRESETS,
  OBSERVATION_TIME_STEPS,
  observationTimeForPreset,
  shiftObservationTime,
} from '../features/sky-map/observationTime'
import type {
  ObservationTimePreset,
  ObservationTimeStep,
} from '../features/sky-map/observationTime'
import {
  OBSERVER_PRESET_IDS,
  observerLocationForPreset,
} from '../features/sky-map/observerPresets'
import type { ObserverPresetId } from '../features/sky-map/observerPresets'
import { parseSkyTargetQuery } from '../features/sky-map/targetSearch'
import type {
  CatalogSummary,
  SkyCalculationParameters,
  SkyFrame,
  SkyObjectSelection,
} from '../features/sky-map/types'
import { SkyMapWorkerClient } from '../features/sky-map/workerClient'

type ViewStatus = 'loadingCatalog' | 'calculating' | 'ready' | 'error'

const ASTRONOMICAL_UNIT_KM = 149_597_870.7

const DEFAULT_OBSERVER_PRESET: ObserverPresetId = 'shenzhen'
const defaultObserverLocation = observerLocationForPreset(DEFAULT_OBSERVER_PRESET)

const { t, locale } = useI18n()
const controls = reactive({
  observedAt: localDateTimeValue(new Date()),
  ...defaultObserverLocation,
  magnitudeLimit: 5.5,
  applyRefraction: true,
  showConstellationLines: true,
  showConstellationLabels: true,
  showSolarSystemBodies: true,
})
const status = ref<ViewStatus>('loadingCatalog')
const activeTimePreset = ref<ObservationTimePreset | 'custom'>('now')
const activeLocationPreset = ref<ObserverPresetId | 'custom'>(DEFAULT_OBSERVER_PRESET)
const errorMessage = ref('')
const catalog = ref<CatalogSummary | null>(null)
const frame = ref<SkyFrame | null>(null)
const calculationDurationMs = ref<number | null>(null)
const selectedObject = ref<SkyObjectSelection | null>(null)
const skyCanvas = ref<InstanceType<typeof SkyMapCanvas> | null>(null)
const targetQuery = ref('')
const targetMessage = ref('')
let workerClient: SkyMapWorkerClient | null = null

const statusText = computed(() => t(`skyMap.status.${status.value}`))
const observedAtLabel = computed(() => frame.value
  ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(frame.value.observedAt))
  : '—')
const visibleStarCount = computed(() => frame.value
  ? new Intl.NumberFormat(locale.value).format(frame.value.stars.length)
  : '—')

watch(targetQuery, () => {
  targetMessage.value = ''
})

onMounted(() => void initialize())
onBeforeUnmount(() => workerClient?.dispose())

async function initialize(): Promise<void> {
  status.value = 'loadingCatalog'
  errorMessage.value = ''
  workerClient?.dispose()
  workerClient = new SkyMapWorkerClient()
  try {
    catalog.value = await workerClient.initialize()
    await calculate()
  } catch (error) {
    fail(error)
  }
}

async function calculate(): Promise<void> {
  if (!workerClient || !catalog.value) return
  status.value = 'calculating'
  errorMessage.value = ''
  selectedObject.value = null
  targetMessage.value = ''
  try {
    const parameters: SkyCalculationParameters = {
      observedAt: new Date(controls.observedAt).toISOString(),
      observer: {
        latitudeDeg: controls.latitudeDeg,
        longitudeDeg: controls.longitudeDeg,
        elevationMeters: controls.elevationMeters,
      },
      magnitudeLimit: controls.magnitudeLimit,
      minimumAltitudeDeg: 0,
      applyRefraction: controls.applyRefraction,
    }
    const result = await workerClient.calculate(parameters)
    frame.value = result.frame
    calculationDurationMs.value = result.calculationDurationMs
    status.value = 'ready'
  } catch (error) {
    fail(error)
  }
}

function useTimePreset(preset: ObservationTimePreset): void {
  activeTimePreset.value = preset
  controls.observedAt = localDateTimeValue(observationTimeForPreset(preset))
  void calculate()
}

function useCustomTime(): void {
  activeTimePreset.value = 'custom'
}

function adjustObservationTime(step: ObservationTimeStep): void {
  const current = new Date(controls.observedAt)
  if (Number.isNaN(current.getTime())) return
  activeTimePreset.value = 'custom'
  controls.observedAt = localDateTimeValue(shiftObservationTime(current, step))
  void calculate()
}

function useLocationPreset(): void {
  if (activeLocationPreset.value === 'custom') return
  Object.assign(controls, observerLocationForPreset(activeLocationPreset.value))
  void calculate()
}

function useCustomLocation(): void {
  activeLocationPreset.value = 'custom'
}

function searchTarget(): void {
  const target = parseSkyTargetQuery(
    targetQuery.value,
    (id) => t(`skyMap.solarSystemBodies.${id}`),
  )
  if (target.kind === 'invalid') {
    selectedObject.value = null
    targetMessage.value = t('skyMap.invalidTarget')
    return
  }

  if (target.kind === 'star') {
    const star = frame.value?.stars.find((candidate) => candidate.hipId === target.hipId)
    if (!star) {
      selectedObject.value = null
      targetMessage.value = t('skyMap.targetNotVisible', { id: `HIP ${target.hipId}` })
      return
    }
    locateTarget({ kind: 'star', object: star })
    return
  }

  const bodyName = t(`skyMap.solarSystemBodies.${target.id}`)
  const body = frame.value?.solarSystemBodies.find((candidate) => candidate.id === target.id)
  if (!body) {
    selectedObject.value = null
    targetMessage.value = t('skyMap.targetNotVisible', { id: bodyName })
    return
  }
  controls.showSolarSystemBodies = true
  locateTarget({ kind: 'solarSystemBody', object: body })
}

function locateTarget(selection: SkyObjectSelection): void {
  selectedObject.value = selection
  skyCanvas.value?.focusObject(selection)
  targetMessage.value = t('skyMap.targetLocated', { id: formatSelectedObject(selection) })
}

function selectObject(selection: SkyObjectSelection | null): void {
  selectedObject.value = selection
  targetMessage.value = ''
}

function fail(error: unknown): void {
  errorMessage.value = error instanceof Error ? error.message : String(error)
  status.value = 'error'
}

function localDateTimeValue(date: Date): string {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 16)
}

function formatCoordinate(value: number | undefined, suffix: string): string {
  if (value === undefined) return '—'
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)}${suffix}`
}

function formatSelectedObject(selection = selectedObject.value): string {
  if (!selection) return '—'
  return selection.kind === 'star'
    ? `HIP ${selection.object.hipId}`
    : t(`skyMap.solarSystemBodies.${selection.object.id}`)
}

function formatSelectedDetail(): string {
  const selection = selectedObject.value
  if (!selection) return '—'
  if (selection.kind === 'star') return selection.object.spectralType ?? '—'
  return new Intl.NumberFormat(locale.value, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(selection.object.phaseFraction)
}

function formatSelectedData(): string {
  const selection = selectedObject.value
  if (!selection) return '—'
  if (selection.kind === 'star') return t(`skyMap.sources.${selection.object.astrometrySource}`)
  if (selection.object.id === 'moon') {
    const kilometers = selection.object.distanceAu * ASTRONOMICAL_UNIT_KM
    return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(kilometers)} km`
  }
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(selection.object.distanceAu)} AU`
}
</script>

<template>
  <section class="sky-map-page">
    <header class="sky-map-header">
      <div>
        <p class="sky-map-kicker">{{ t('skyMap.kicker') }}</p>
        <h1>{{ t('skyMap.title') }}</h1>
      </div>
      <div class="catalog-meta" aria-live="polite">
        <span class="status-dot" :class="status" aria-hidden="true"></span>
        <span>{{ statusText }}</span>
        <span v-if="catalog">{{ t('skyMap.catalogVersion', { version: catalog.version }) }}</span>
      </div>
    </header>

    <div class="sky-map-workspace">
      <aside class="sky-controls">
        <form @submit.prevent="calculate">
          <fieldset>
            <legend>{{ t('skyMap.observation') }}</legend>
            <label class="field full-field">
              <span>{{ t('skyMap.observedAt') }}</span>
              <input
                v-model="controls.observedAt"
                type="datetime-local"
                required
                @input="useCustomTime"
              >
            </label>
            <div class="time-presets" role="group" :aria-label="t('skyMap.quickTimes')">
              <button
                v-for="preset in OBSERVATION_TIME_PRESETS"
                :key="preset"
                type="button"
                :class="{ active: activeTimePreset === preset }"
                :aria-pressed="activeTimePreset === preset"
                :disabled="status === 'loadingCatalog' || status === 'calculating'"
                @click="useTimePreset(preset)"
              >{{ t(`skyMap.timePresets.${preset}`) }}</button>
            </div>
            <div class="time-adjustments" role="group" :aria-label="t('skyMap.adjustTime')">
              <button
                v-for="step in OBSERVATION_TIME_STEPS"
                :key="step"
                type="button"
                :title="t(`skyMap.timeSteps.${step}`)"
                :disabled="status === 'loadingCatalog' || status === 'calculating'"
                @click="adjustObservationTime(step)"
              >{{ t(`skyMap.timeSteps.${step}`) }}</button>
            </div>
          </fieldset>

          <fieldset>
            <legend>{{ t('skyMap.location') }}</legend>
            <label class="field full-field">
              <span>{{ t('skyMap.locationPreset') }}</span>
              <select
                v-model="activeLocationPreset"
                :disabled="status === 'loadingCatalog' || status === 'calculating'"
                @change="useLocationPreset"
              >
                <option
                  v-for="preset in OBSERVER_PRESET_IDS"
                  :key="preset"
                  :value="preset"
                >{{ t(`skyMap.locationPresets.${preset}`) }}</option>
                <option value="custom">{{ t('skyMap.locationPresets.custom') }}</option>
              </select>
            </label>
            <div class="coordinate-grid">
              <label class="field">
                <span>{{ t('skyMap.latitude') }}</span>
                <input v-model.number="controls.latitudeDeg" type="number" min="-90" max="90" step="0.0001" required @input="useCustomLocation">
              </label>
              <label class="field">
                <span>{{ t('skyMap.longitude') }}</span>
                <input v-model.number="controls.longitudeDeg" type="number" min="-180" max="180" step="0.0001" required @input="useCustomLocation">
              </label>
            </div>
            <label class="field full-field">
              <span>{{ t('skyMap.elevation') }}</span>
              <input v-model.number="controls.elevationMeters" type="number" min="-500" max="10000" step="1" required @input="useCustomLocation">
            </label>
          </fieldset>

          <fieldset>
            <legend>{{ t('skyMap.target') }}</legend>
            <div class="target-search">
              <input
                v-model="targetQuery"
                type="search"
                :aria-label="t('skyMap.target')"
                :placeholder="t('skyMap.targetPlaceholder')"
                @keydown.enter.prevent="searchTarget"
              >
              <button
                type="button"
                class="icon-command"
                :aria-label="t('skyMap.targetSearch')"
                :title="t('skyMap.targetSearch')"
                :disabled="!frame"
                @click="searchTarget"
              ><Search :size="17" aria-hidden="true" /></button>
            </div>
            <p v-if="targetMessage" class="target-message" role="status">{{ targetMessage }}</p>
          </fieldset>

          <fieldset>
            <legend>{{ t('skyMap.visibility') }}</legend>
            <label class="range-field">
              <span>{{ t('skyMap.magnitudeLimit') }}</span>
              <output>{{ controls.magnitudeLimit.toFixed(1) }}</output>
              <input
                v-model.number="controls.magnitudeLimit"
                type="range"
                min="-1"
                max="6.5"
                step="0.1"
                :aria-label="t('skyMap.magnitudeLimit')"
              >
            </label>
            <label class="toggle-row">
              <input v-model="controls.showConstellationLines" type="checkbox">
              <span>{{ t('skyMap.constellationLines') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showConstellationLabels" type="checkbox">
              <span>{{ t('skyMap.constellationLabels') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showSolarSystemBodies" type="checkbox">
              <span>{{ t('skyMap.solarSystem') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.applyRefraction" type="checkbox">
              <span>{{ t('skyMap.refraction') }}</span>
            </label>
          </fieldset>

          <button class="primary-command" type="submit" :disabled="status === 'loadingCatalog' || status === 'calculating'">
            {{ t('skyMap.update') }}
          </button>
        </form>
      </aside>

      <div class="sky-map-stage">
        <SkyMapCanvas
          ref="skyCanvas"
          :frame="frame"
          :show-constellation-lines="controls.showConstellationLines"
          :show-constellation-labels="controls.showConstellationLabels"
          :show-solar-system-bodies="controls.showSolarSystemBodies"
          :selected-object="selectedObject"
          @select="selectObject"
        />
        <div v-if="status === 'loadingCatalog' || (status === 'calculating' && !frame)" class="stage-state" role="status">
          <span class="loading-indicator" aria-hidden="true"></span>
          <span>{{ statusText }}</span>
        </div>
        <div v-else-if="status === 'error'" class="stage-state error-state" role="alert">
          <strong>{{ t('skyMap.loadFailed') }}</strong>
          <span>{{ errorMessage }}</span>
          <button type="button" class="secondary-command" @click="initialize">{{ t('skyMap.retry') }}</button>
        </div>
      </div>
    </div>

    <footer class="sky-readout">
      <dl>
        <div>
          <dt>{{ t('skyMap.observedAt') }}</dt>
          <dd>{{ observedAtLabel }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.visibleStars') }}</dt>
          <dd>{{ visibleStarCount }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.calculationTime') }}</dt>
          <dd>{{ calculationDurationMs === null ? '—' : `${calculationDurationMs.toFixed(1)} ms` }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.selectedObject') }}</dt>
          <dd>{{ formatSelectedObject() }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.magnitude') }}</dt>
          <dd>{{ selectedObject ? selectedObject.object.visualMagnitude.toFixed(2) : '—' }}</dd>
        </div>
        <div>
          <dt>{{ selectedObject?.kind === 'solarSystemBody' ? t('skyMap.phase') : t('skyMap.spectralType') }}</dt>
          <dd>{{ formatSelectedDetail() }}</dd>
        </div>
        <div>
          <dt>{{ selectedObject?.kind === 'solarSystemBody' ? t('skyMap.distance') : t('skyMap.dataSource') }}</dt>
          <dd>{{ formatSelectedData() }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.position') }}</dt>
          <dd>{{ formatCoordinate(selectedObject?.object.azimuthDeg, '°') }} / {{ formatCoordinate(selectedObject?.object.altitudeDeg, '°') }}</dd>
        </div>
      </dl>
    </footer>
  </section>
</template>

<style scoped>
.sky-map-page { padding: 1.5rem 0 2.5rem; }

@media (min-width: 901px) {
  .sky-map-page {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    height: calc(100vh - 68px);
    height: calc(100dvh - 68px);
    min-height: 480px;
    padding: 1rem 0;
  }
}

.sky-map-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  padding-bottom: 1rem;
}

.sky-map-kicker {
  margin: 0 0 .3rem;
  color: #6fcbbb;
  font-size: .78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.sky-map-header h1 {
  margin: 0;
  font-size: 1.8rem;
  line-height: 1.2;
}

.catalog-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: .45rem 1rem;
  color: #99aaad;
  font-size: .82rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  margin-top: .3rem;
  border-radius: 50%;
  background: #d2ab52;
}

.status-dot.ready { background: #65c49f; }
.status-dot.error { background: #e47b72; }

.sky-map-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  border: 1px solid #26333a;
  background: #080c10;
}

.sky-controls {
  min-height: 0;
  border-right: 1px solid #26333a;
  background: #10161b;
}

.sky-controls form { display: grid; }

fieldset {
  display: grid;
  gap: .75rem;
  min-width: 0;
  margin: 0;
  padding: 1rem;
  border: 0;
  border-bottom: 1px solid #26333a;
}

legend {
  width: 100%;
  padding: 0 0 .15rem;
  color: #d9e4e4;
  font-size: .82rem;
  font-weight: 700;
}

.field,
.range-field {
  display: grid;
  gap: .38rem;
  min-width: 0;
  color: #91a3a7;
  font-size: .76rem;
}

.coordinate-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .55rem;
}

.time-presets,
.time-adjustments {
  display: grid;
  overflow: hidden;
  border: 1px solid #3a4c54;
  border-radius: 4px;
}

.time-presets { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.time-adjustments { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.time-presets button,
.time-adjustments button {
  min-width: 0;
  min-height: 42px;
  border: 0;
  border-right: 1px solid #3a4c54;
  padding: .35rem .2rem;
  color: #9eafb2;
  background: transparent;
  font-size: .68rem;
  line-height: 1.25;
  cursor: pointer;
}

.time-presets button:last-child,
.time-adjustments button:last-child { border-right: 0; }
.time-presets button.active { color: #07110f; background: #86cbc1; font-weight: 700; }
.time-presets button:hover:not(:disabled, .active),
.time-adjustments button:hover:not(:disabled) { color: #dfe8e8; background: #182329; }

input[type="datetime-local"],
input[type="number"],
input[type="search"],
select {
  width: 100%;
  min-height: 36px;
  border: 1px solid #34444c;
  border-radius: 4px;
  padding: 0 .55rem;
  color: #e8efef;
  background: #090e12;
}

select { color-scheme: dark; }

.target-search { display: grid; grid-template-columns: minmax(0, 1fr) 36px; gap: .4rem; }

.icon-command {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid #3a4c54;
  border-radius: 4px;
  padding: 0;
  color: #c7d4d5;
  background: transparent;
  cursor: pointer;
}

.icon-command:hover:not(:disabled) { color: #07110f; background: #6fcbbb; }
.target-message { margin: 0; color: #d9bd75; font-size: .72rem; line-height: 1.45; }

.range-field { grid-template-columns: 1fr auto; }
.range-field input { grid-column: 1 / -1; width: 100%; accent-color: #6fcbbb; }
.range-field output { color: #f3ce70; font-variant-numeric: tabular-nums; }

.toggle-row {
  display: flex;
  align-items: center;
  gap: .55rem;
  color: #becacc;
  font-size: .82rem;
  cursor: pointer;
}

.toggle-row input { width: 15px; height: 15px; margin: 0; accent-color: #6fcbbb; }

.primary-command,
.secondary-command {
  min-height: 36px;
  border-radius: 4px;
  cursor: pointer;
}

.primary-command {
  margin: 1rem;
  border: 1px solid #6fcbbb;
  color: #07110f;
  background: #6fcbbb;
  font-weight: 700;
}

.secondary-command {
  border: 1px solid #3a4c54;
  padding: 0 .7rem;
  color: #c7d4d5;
  background: transparent;
}

button:disabled { cursor: wait; opacity: .55; }

.sky-map-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #030609;
}

@media (min-width: 901px) {
  .sky-map-workspace { min-height: 0; overflow: hidden; }

  .sky-controls {
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-color: #455860 #10161b;
    scrollbar-width: thin;
  }

  .sky-map-stage { container-type: size; }

  .sky-map-stage :deep(.sky-canvas) {
    width: min(100cqw, 100cqh);
    height: auto;
  }

  .sky-readout dl > div { padding: .65rem .75rem; }
}

.stage-state {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: .75rem;
  padding: 2rem;
  color: #bac7c8;
  background: rgb(3 6 9 / 82%);
  text-align: center;
}

.loading-indicator {
  width: 28px;
  height: 28px;
  border: 2px solid #2a4648;
  border-top-color: #6fcbbb;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

.error-state { color: #e9b1ab; }
.error-state span { max-width: 34rem; color: #aebbbc; font-size: .82rem; }

.sky-readout {
  border: 1px solid #26333a;
  border-top: 0;
  background: #10161b;
}

.sky-readout dl {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  margin: 0;
}

.sky-readout dl > div { min-width: 0; padding: .8rem 1rem; border-right: 1px solid #26333a; }
.sky-readout dl > div:last-child { border-right: 0; }
.sky-readout dt { margin-bottom: .25rem; color: #71878b; font-size: .68rem; }
.sky-readout dd {
  margin: 0;
  color: #dce6e6;
  font-size: .82rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .sky-map-workspace { grid-template-columns: 1fr; }
  .sky-controls { border-right: 0; border-bottom: 1px solid #26333a; }
  .sky-controls form { grid-template-columns: repeat(3, 1fr); }
  fieldset { border-right: 1px solid #26333a; border-bottom: 0; }
  .primary-command { align-self: end; grid-column: 1 / -1; }
  .sky-readout dl { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .sky-readout dl > div:nth-child(4) { border-right: 0; }
  .sky-readout dl > div:nth-child(-n + 4) { border-bottom: 1px solid #26333a; }
}

@media (max-width: 620px) {
  .sky-map-page { padding-top: 1rem; }
  .sky-map-header { align-items: start; flex-direction: column; gap: .65rem; }
  .catalog-meta { justify-content: flex-start; }
  .sky-controls form { grid-template-columns: 1fr; }
  fieldset { border-right: 0; border-bottom: 1px solid #26333a; }
  .sky-readout dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sky-readout dl > div { border-right: 1px solid #26333a; border-bottom: 1px solid #26333a; }
  .sky-readout dl > div:nth-child(even) { border-right: 0; }
  .sky-readout dl > div:nth-last-child(-n + 2) { border-bottom: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .loading-indicator { animation: none; }
}
</style>
