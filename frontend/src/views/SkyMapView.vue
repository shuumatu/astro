<script setup lang="ts">
import { ChevronDown, Search, Triangle } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SkyMapCanvas from '../features/sky-map/SkyMapCanvas.vue'
import { LatestCalculationScheduler } from '../features/sky-map/latestCalculationScheduler'
import { selectLocalizedName } from '../features/sky-map/localizedName'
import {
  ObservationTimeWheelBatcher,
  OBSERVATION_TIME_PRESETS,
  OBSERVATION_TIME_STEPS,
  accumulateObservationTimeWheel,
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
import {
  normalizeSkyTargetSearchTerm,
  parseSkyTargetQuery,
} from '../features/sky-map/targetSearch'
import type {
  CatalogSummary,
  SkyCalculationParameters,
  SkyFrame,
  SkyObjectSelection,
  SkySearchResult,
  SkySearchSuggestion,
} from '../features/sky-map/types'
import { SkyMapWorkerClient } from '../features/sky-map/workerClient'

type ViewStatus = 'loadingCatalog' | 'ready' | 'error'
type SkyCalculationResult = Awaited<ReturnType<SkyMapWorkerClient['calculate']>>

const ASTRONOMICAL_UNIT_KM = 149_597_870.7
const CALCULATION_DEBOUNCE_MS = 80
const TARGET_SEARCH_DEBOUNCE_MS = 70
const TARGET_SEARCH_LIMIT = 8
const TIME_WHEEL_RESET_MS = 240

const DEFAULT_OBSERVER_PRESET: ObserverPresetId = 'shenzhen'
const defaultObserverLocation = observerLocationForPreset(DEFAULT_OBSERVER_PRESET)

const { t, locale } = useI18n({ useScope: 'global' })
const controls = reactive({
  observedAt: localDateTimeValue(new Date()),
  ...defaultObserverLocation,
  cultureId: 'chinese-traditional',
  magnitudeLimit: 5.5,
  applyRefraction: true,
  showStarNames: true,
  showCultureLines: true,
  showCultureLabels: true,
  showCultureBoundaries: true,
  showSolarSystemBodies: true,
  enabledFeaturedPatternIds: [] as string[],
})
const status = ref<ViewStatus>('loadingCatalog')
const activeTimePreset = ref<ObservationTimePreset | 'custom'>('now')
const activeLocationPreset = ref<ObserverPresetId | 'custom'>(DEFAULT_OBSERVER_PRESET)
const errorMessage = ref('')
const catalog = ref<CatalogSummary | null>(null)
const frame = shallowRef<SkyFrame | null>(null)
const calculationDurationMs = ref<number | null>(null)
const selectedObject = ref<SkyObjectSelection | null>(null)
const skyCanvas = ref<InstanceType<typeof SkyMapCanvas> | null>(null)
const skyMapStage = ref<HTMLDivElement | null>(null)
const isSkyMapFullscreen = ref(false)
const fullscreenSupported = ref(false)
const targetInput = ref<HTMLInputElement | null>(null)
const targetQuery = ref('')
const targetMessage = ref('')
const targetSuggestions = ref<SkySearchSuggestion[]>([])
const targetSearchOpen = ref(false)
const targetSearchPending = ref(false)
const activeSuggestionIndex = ref(-1)
let workerClient: SkyMapWorkerClient | null = null
let calculationScheduler: LatestCalculationScheduler<
  SkyCalculationParameters,
  SkyCalculationResult
> | null = null
let calculationTimer: ReturnType<typeof setTimeout> | null = null
let targetSearchTimer: ReturnType<typeof setTimeout> | null = null
let targetSearchSequence = 0
let timeWheelResetTimer: ReturnType<typeof setTimeout> | null = null
let accumulatedTimeWheelDelta = 0
let timeWheelBatcher: ObservationTimeWheelBatcher | null = null

const statusText = computed(() => t(`skyMap.status.${status.value}`))
const observedAtLabel = computed(() => frame.value
  ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(frame.value.observedAt))
  : '—')
const visibleStarCount = computed(() => frame.value
  ? new Intl.NumberFormat(locale.value).format(frame.value.stars.length)
  : '—')
const activeSuggestionId = computed(() => activeSuggestionIndex.value >= 0
  ? `sky-target-suggestion-${activeSuggestionIndex.value}`
  : undefined)
const featuredPatternOptions = computed(() => (catalog.value?.featuredPatterns ?? []).map((pattern) => ({
  id: pattern.id,
  name: selectLocalizedName(pattern.names, locale.value, 'en'),
})))
const enabledFeaturedPatternCount = computed(() => controls.enabledFeaturedPatternIds.length)

watch(targetQuery, () => {
  targetMessage.value = ''
  scheduleTargetSuggestions()
})
watch(() => controls.observedAt, requestCalculation, { flush: 'sync' })
watch(() => [...controls.enabledFeaturedPatternIds], requestCalculation, { flush: 'sync' })
watch(() => [controls.cultureId, locale.value] as const, () => {
  requestCalculation()
  scheduleTargetSuggestions()
}, { flush: 'sync' })
watch(
  () => [
    controls.latitudeDeg,
    controls.longitudeDeg,
    controls.elevationMeters,
    controls.magnitudeLimit,
    controls.applyRefraction,
  ] as const,
  scheduleCalculation,
)

onMounted(() => {
  timeWheelBatcher = new ObservationTimeWheelBatcher(applyObservationMinuteDelta)
  window.addEventListener('wheel', handlePageWheel, { passive: false })
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('keydown', handleFullscreenKeydown)
  fullscreenSupported.value = document.fullscreenEnabled
    && typeof HTMLElement.prototype.requestFullscreen === 'function'
  void initialize()
})
onBeforeUnmount(() => {
  window.removeEventListener('wheel', handlePageWheel)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('keydown', handleFullscreenKeydown)
  if (calculationTimer) clearTimeout(calculationTimer)
  if (targetSearchTimer) clearTimeout(targetSearchTimer)
  targetSearchSequence += 1
  if (timeWheelResetTimer) clearTimeout(timeWheelResetTimer)
  timeWheelBatcher?.reset()
  timeWheelBatcher = null
  calculationScheduler?.dispose()
  calculationScheduler = null
  const client = workerClient
  workerClient = null
  client?.dispose()
})

async function initialize(): Promise<void> {
  status.value = 'loadingCatalog'
  errorMessage.value = ''
  calculationScheduler?.dispose()
  calculationScheduler = null
  workerClient?.dispose()
  const client = new SkyMapWorkerClient()
  workerClient = client
  try {
    const catalogSummary = await client.initialize()
    if (client !== workerClient) return
    catalog.value = catalogSummary
    controls.cultureId = catalogSummary.defaultCultureId
    calculationScheduler = new LatestCalculationScheduler(
      (parameters) => client.calculate(parameters),
      applyCalculationResult,
      fail,
    )
    requestCalculation()
  } catch (error) {
    if (client !== workerClient) return
    fail(error)
  }
}

function requestCalculation(): void {
  const parameters = currentCalculationParameters()
  if (!calculationScheduler || !catalog.value || !parameters) return
  errorMessage.value = ''
  targetMessage.value = ''
  calculationScheduler.request(parameters)
}

function applyCalculationResult(result: SkyCalculationResult): void {
  frame.value = result.frame
  selectedObject.value = selectedObject.value
    ? resolveSelectionInFrame(selectedObject.value, result.frame)
    : null
  calculationDurationMs.value = result.calculationDurationMs
  status.value = 'ready'
}

function currentCalculationParameters(): SkyCalculationParameters | null {
  const observedAt = new Date(controls.observedAt)
  const latitudeDeg = controls.latitudeDeg
  const longitudeDeg = controls.longitudeDeg
  const elevationMeters = controls.elevationMeters
  if (
    Number.isNaN(observedAt.getTime())
    || !Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90
    || !Number.isFinite(longitudeDeg) || longitudeDeg < -180 || longitudeDeg > 180
    || !Number.isFinite(elevationMeters) || elevationMeters < -500 || elevationMeters > 10_000
  ) return null
  return {
    observedAt: observedAt.toISOString(),
    observer: { latitudeDeg, longitudeDeg, elevationMeters },
    magnitudeLimit: controls.magnitudeLimit,
    minimumAltitudeDeg: 0,
    applyRefraction: controls.applyRefraction,
    cultureId: controls.cultureId,
    interfaceLanguage: locale.value,
    enabledFeaturedPatternIds: [...controls.enabledFeaturedPatternIds],
  }
}

function scheduleCalculation(): void {
  if (calculationTimer) clearTimeout(calculationTimer)
  calculationTimer = setTimeout(() => {
    calculationTimer = null
    requestCalculation()
  }, CALCULATION_DEBOUNCE_MS)
}

function useTimePreset(preset: ObservationTimePreset): void {
  resetPendingTimeWheel()
  activeTimePreset.value = preset
  controls.observedAt = localDateTimeValue(observationTimeForPreset(preset))
}

function useCustomTime(): void {
  activeTimePreset.value = 'custom'
}

function adjustObservationTime(step: ObservationTimeStep): void {
  resetPendingTimeWheel()
  const current = new Date(controls.observedAt)
  if (Number.isNaN(current.getTime())) return
  activeTimePreset.value = 'custom'
  controls.observedAt = localDateTimeValue(shiftObservationTime(current, step))
}

function handlePageWheel(event: WheelEvent): void {
  if (!event.ctrlKey) return
  event.preventDefault()
  const modeScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1
  const result = accumulateObservationTimeWheel(
    accumulatedTimeWheelDelta,
    event.deltaY * modeScale,
  )
  accumulatedTimeWheelDelta = result.accumulatedDelta
  if (timeWheelResetTimer) clearTimeout(timeWheelResetTimer)
  timeWheelResetTimer = setTimeout(() => {
    accumulatedTimeWheelDelta = 0
    timeWheelResetTimer = null
  }, TIME_WHEEL_RESET_MS)
  if (!result.step) return
  timeWheelBatcher?.enqueue(result.step)
}

function applyObservationMinuteDelta(minuteDelta: number): void {
  const current = new Date(controls.observedAt)
  if (Number.isNaN(current.getTime())) return
  current.setMinutes(current.getMinutes() + minuteDelta)
  activeTimePreset.value = 'custom'
  controls.observedAt = localDateTimeValue(current)
}

function resetPendingTimeWheel(): void {
  if (timeWheelResetTimer) clearTimeout(timeWheelResetTimer)
  timeWheelResetTimer = null
  timeWheelBatcher?.reset()
  accumulatedTimeWheelDelta = 0
}

function handleFullscreenChange(): void {
  isSkyMapFullscreen.value = document.fullscreenElement === skyMapStage.value
}

function handleFullscreenKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || document.fullscreenElement !== skyMapStage.value) return
  void document.exitFullscreen()
}

async function toggleSkyMapFullscreen(): Promise<void> {
  const stage = skyMapStage.value
  if (!stage || !fullscreenSupported.value) return
  if (document.fullscreenElement === stage) {
    await document.exitFullscreen()
    return
  }
  await stage.requestFullscreen()
}

function useLocationPreset(): void {
  if (activeLocationPreset.value === 'custom') return
  Object.assign(controls, observerLocationForPreset(activeLocationPreset.value))
}

function useCustomLocation(): void {
  activeLocationPreset.value = 'custom'
}

async function searchTarget(): Promise<void> {
  const target = parseSkyTargetQuery(
    targetQuery.value,
    (id) => t(`skyMap.solarSystemBodies.${id}`),
  )
  if (target.kind === 'solarSystemBody') {
    const bodyName = t(`skyMap.solarSystemBodies.${target.id}`)
    const body = frame.value?.solarSystemBodies.find((candidate) => candidate.id === target.id)
    if (!body) {
      selectedObject.value = null
      targetMessage.value = t('skyMap.targetNotVisible', { id: bodyName })
      return
    }
    controls.showSolarSystemBodies = true
    locateTarget({ kind: 'solarSystemBody', object: body })
    return
  }

  if (!normalizeSkyTargetSearchTerm(targetQuery.value)) {
    selectedObject.value = null
    targetMessage.value = t('skyMap.invalidTarget')
    return
  }

  const result = await requestTargetSuggestions()
  if (!result) return
  const exactSuggestions = result.suggestions.filter((suggestion) => suggestion.matchType === 'exact')
  if (exactSuggestions.length === 1) {
    selectTargetSuggestion(exactSuggestions[0])
    return
  }
  targetSuggestions.value = result.suggestions
  activeSuggestionIndex.value = -1
  targetSearchOpen.value = result.suggestions.length > 0
  if (result.suggestions.length === 0) {
    selectedObject.value = null
    targetMessage.value = t('skyMap.noTargetMatches')
  } else {
    targetMessage.value = t('skyMap.chooseTarget', { count: result.suggestions.length })
  }
}

function scheduleTargetSuggestions(): void {
  if (targetSearchTimer) clearTimeout(targetSearchTimer)
  targetSearchTimer = setTimeout(() => {
    targetSearchTimer = null
    void refreshTargetSuggestions()
  }, TARGET_SEARCH_DEBOUNCE_MS)
}

async function refreshTargetSuggestions(): Promise<void> {
  const target = parseSkyTargetQuery(
    targetQuery.value,
    (id) => t(`skyMap.solarSystemBodies.${id}`),
  )
  if (!normalizeSkyTargetSearchTerm(targetQuery.value) || target.kind === 'solarSystemBody') {
    targetSearchSequence += 1
    targetSearchPending.value = false
    targetSuggestions.value = []
    targetSearchOpen.value = false
    activeSuggestionIndex.value = -1
    return
  }
  const result = await requestTargetSuggestions()
  if (!result) return
  targetSuggestions.value = result.suggestions
  activeSuggestionIndex.value = -1
  targetSearchOpen.value = document.activeElement === targetInput.value
    && result.suggestions.length > 0
}

async function requestTargetSuggestions(): Promise<SkySearchResult | null> {
  const client = workerClient
  if (!client || !catalog.value) return null
  const sequence = ++targetSearchSequence
  targetSearchPending.value = true
  try {
    const result = await client.search({
      query: targetQuery.value,
      cultureId: controls.cultureId,
      interfaceLanguage: locale.value,
      limit: TARGET_SEARCH_LIMIT,
    })
    return sequence === targetSearchSequence ? result : null
  } catch (error) {
    if (sequence === targetSearchSequence) fail(error)
    return null
  } finally {
    if (sequence === targetSearchSequence) targetSearchPending.value = false
  }
}

function selectTargetSuggestion(suggestion: SkySearchSuggestion): void {
  targetSearchOpen.value = false
  activeSuggestionIndex.value = -1
  const label = suggestionDisplayLabel(suggestion)
  if (!suggestion.availableInCatalog) {
    selectedObject.value = null
    targetMessage.value = t('skyMap.targetUnavailable', { id: label })
    return
  }
  const star = frame.value?.stars.find((candidate) => candidate.id === suggestion.objectId)
  if (!star) {
    selectedObject.value = null
    targetMessage.value = t('skyMap.targetNotVisible', { id: label })
    return
  }
  locateTarget({ kind: 'star', object: star })
}

function handleTargetFocus(): void {
  targetSearchOpen.value = targetSuggestions.value.length > 0
}

function handleTargetBlur(): void {
  targetSearchOpen.value = false
  activeSuggestionIndex.value = -1
}

function handleTargetKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    targetSearchOpen.value = false
    activeSuggestionIndex.value = -1
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (targetSuggestions.value.length === 0) return
    event.preventDefault()
    targetSearchOpen.value = true
    const direction = event.key === 'ArrowDown' ? 1 : -1
    activeSuggestionIndex.value = (
      activeSuggestionIndex.value + direction + targetSuggestions.value.length
    ) % targetSuggestions.value.length
    return
  }
  if (event.key !== 'Enter') return
  event.preventDefault()
  const suggestion = targetSuggestions.value[activeSuggestionIndex.value]
  if (targetSearchOpen.value && suggestion) selectTargetSuggestion(suggestion)
  else void searchTarget()
}

function suggestionDisplayLabel(suggestion: SkySearchSuggestion): string {
  return suggestion.nameType === 'identifier'
    ? suggestion.term
    : `${suggestion.term} · HIP ${suggestion.hipId}`
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
  if (selection.kind === 'solarSystemBody') return t(`skyMap.solarSystemBodies.${selection.object.id}`)
  const cultureName = frame.value?.starLabels.find(
    (label) => label.objectId === selection.object.id,
  )?.name
  return cultureName ? `${cultureName} · HIP ${selection.object.hipId}` : `HIP ${selection.object.hipId}`
}

function resolveSelectionInFrame(
  selection: SkyObjectSelection,
  nextFrame: SkyFrame,
): SkyObjectSelection | null {
  if (selection.kind === 'star') {
    const star = nextFrame.stars.find((candidate) => candidate.id === selection.object.id)
    return star ? { kind: 'star', object: star } : null
  }
  const body = nextFrame.solarSystemBodies.find((candidate) => candidate.id === selection.object.id)
  return body ? { kind: 'solarSystemBody', object: body } : null
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
        <form @submit.prevent>
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
                :disabled="status === 'loadingCatalog'"
                @click="useTimePreset(preset)"
              >{{ t(`skyMap.timePresets.${preset}`) }}</button>
            </div>
            <div class="time-adjustments" role="group" :aria-label="t('skyMap.adjustTime')">
              <button
                v-for="step in OBSERVATION_TIME_STEPS"
                :key="step"
                type="button"
                :title="t(`skyMap.timeSteps.${step}`)"
                :disabled="status === 'loadingCatalog'"
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
                :disabled="status === 'loadingCatalog'"
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
            <div class="target-search-shell">
              <div class="target-search">
                <input
                  ref="targetInput"
                  v-model="targetQuery"
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="sky-target-suggestions"
                  :aria-activedescendant="activeSuggestionId"
                  :aria-expanded="targetSearchOpen"
                  :aria-label="t('skyMap.target')"
                  :aria-busy="targetSearchPending"
                  :placeholder="t('skyMap.targetPlaceholder')"
                  @focus="handleTargetFocus"
                  @blur="handleTargetBlur"
                  @keydown="handleTargetKeydown"
                >
                <button
                  type="button"
                  class="icon-command"
                  :aria-label="t('skyMap.targetSearch')"
                  :title="t('skyMap.targetSearch')"
                  :disabled="!catalog || targetSearchPending"
                  @mousedown.prevent
                  @click="searchTarget"
                ><Search :size="17" aria-hidden="true" /></button>
              </div>
              <ul
                v-if="targetSearchOpen"
                id="sky-target-suggestions"
                class="target-suggestions"
                role="listbox"
              >
                <li
                  v-for="(suggestion, index) in targetSuggestions"
                  :id="`sky-target-suggestion-${index}`"
                  :key="suggestion.objectId"
                  role="option"
                  :aria-selected="index === activeSuggestionIndex"
                >
                  <button
                    type="button"
                    class="target-suggestion"
                    :class="{ active: index === activeSuggestionIndex }"
                    @mousedown.prevent
                    @click="selectTargetSuggestion(suggestion)"
                  >
                    <span class="suggestion-name">{{ suggestion.term }}</span>
                    <span class="suggestion-meta">
                      HIP {{ suggestion.hipId }} · {{ t(`skyMap.cultures.${suggestion.cultureId}`) }}
                      <template v-if="!suggestion.availableInCatalog"> · {{ t('skyMap.targetUnavailableShort') }}</template>
                    </span>
                  </button>
                </li>
              </ul>
            </div>
            <p v-if="targetMessage" class="target-message" role="status">{{ targetMessage }}</p>
          </fieldset>

          <fieldset>
            <legend>{{ t('skyMap.visibility') }}</legend>
            <label class="field full-field">
              <span>{{ t('skyMap.culture') }}</span>
              <select v-model="controls.cultureId" :disabled="status === 'loadingCatalog'">
                <option
                  v-for="cultureId in catalog?.cultureIds ?? []"
                  :key="cultureId"
                  :value="cultureId"
                >{{ t(`skyMap.cultures.${cultureId}`) }}</option>
              </select>
            </label>
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
              <input v-model="controls.showStarNames" type="checkbox">
              <span>{{ t('skyMap.starNames') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showCultureLines" type="checkbox">
              <span>{{ t('skyMap.cultureLines') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showCultureLabels" type="checkbox">
              <span>{{ t('skyMap.cultureLabels') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showCultureBoundaries" type="checkbox">
              <span>{{ t('skyMap.cultureBoundaries') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showSolarSystemBodies" type="checkbox">
              <span>{{ t('skyMap.solarSystem') }}</span>
            </label>
            <details class="featured-pattern-menu">
              <summary>
                <Triangle :size="15" aria-hidden="true" />
                <span>{{ t('skyMap.featuredPatterns') }}</span>
                <span v-if="enabledFeaturedPatternCount" class="pattern-count">{{ enabledFeaturedPatternCount }}</span>
                <ChevronDown class="menu-chevron" :size="15" aria-hidden="true" />
              </summary>
              <div class="featured-pattern-options">
                <label
                  v-for="pattern in featuredPatternOptions"
                  :key="pattern.id"
                  class="toggle-row"
                >
                  <input
                    v-model="controls.enabledFeaturedPatternIds"
                    type="checkbox"
                    :value="pattern.id"
                    :disabled="status === 'loadingCatalog'"
                  >
                  <span>{{ pattern.name }}</span>
                </label>
              </div>
            </details>
            <label class="toggle-row">
              <input v-model="controls.applyRefraction" type="checkbox">
              <span>{{ t('skyMap.refraction') }}</span>
            </label>
          </fieldset>

        </form>
      </aside>

      <div ref="skyMapStage" class="sky-map-stage">
        <SkyMapCanvas
          ref="skyCanvas"
          :frame="frame"
          :show-star-names="controls.showStarNames"
          :show-culture-lines="controls.showCultureLines"
          :show-culture-labels="controls.showCultureLabels"
          :show-culture-boundaries="controls.showCultureBoundaries"
          :show-solar-system-bodies="controls.showSolarSystemBodies"
          :selected-object="selectedObject"
          :is-fullscreen="isSkyMapFullscreen"
          :fullscreen-supported="fullscreenSupported"
          @select="selectObject"
          @toggle-fullscreen="toggleSkyMapFullscreen"
        />
        <div v-if="status === 'loadingCatalog'" class="stage-state" role="status">
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

.target-search-shell { position: relative; min-width: 0; }
.target-search { display: grid; grid-template-columns: minmax(0, 1fr) 36px; gap: .4rem; }

.target-suggestions {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  right: 40px;
  left: 0;
  overflow: hidden;
  margin: 0;
  padding: 3px;
  border: 1px solid #3a4c54;
  border-radius: 4px;
  list-style: none;
  background: #0b1115;
  box-shadow: 0 10px 24px rgb(0 0 0 / 42%);
}

.target-suggestion {
  display: grid;
  gap: .18rem;
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 2px;
  padding: .5rem .55rem;
  color: #dce6e6;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.target-suggestion:hover,
.target-suggestion.active { background: #19262b; }
.suggestion-name { overflow-wrap: anywhere; font-size: .78rem; line-height: 1.25; }
.suggestion-meta { color: #82979b; font-size: .65rem; line-height: 1.3; }

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

.featured-pattern-menu {
  border: 1px solid #34444c;
  border-radius: 4px;
  background: #090e12;
}

.featured-pattern-menu summary {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto 18px;
  align-items: center;
  gap: .4rem;
  min-height: 36px;
  padding: 0 .55rem;
  color: #becacc;
  font-size: .78rem;
  cursor: pointer;
  list-style: none;
}

.featured-pattern-menu summary::-webkit-details-marker { display: none; }
.featured-pattern-menu summary:hover { color: #e1e9e9; background: #141d22; }
.featured-pattern-menu[open] .menu-chevron { transform: rotate(180deg); }
.menu-chevron { transition: transform .16s ease; }

.pattern-count {
  min-width: 20px;
  border-radius: 10px;
  padding: .08rem .35rem;
  color: #07110f;
  background: #d6ad52;
  font-size: .65rem;
  font-weight: 700;
  text-align: center;
}

.featured-pattern-options {
  display: grid;
  gap: .65rem;
  border-top: 1px solid #26333a;
  padding: .7rem .55rem;
}

.secondary-command {
  min-height: 36px;
  border-radius: 4px;
  cursor: pointer;
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

.sky-map-stage:fullscreen {
  width: 100vw;
  height: 100vh;
  background: #030609;
}

.sky-map-stage::backdrop { background: #030609; }

.sky-map-stage:fullscreen :deep(.sky-canvas) {
  width: min(100vw, 100vh);
  height: auto;
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
